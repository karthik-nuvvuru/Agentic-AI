"""
Auth router — register, login, token refresh with rotation + httpOnly cookie,
Google OAuth, GitHub OAuth.
"""
from __future__ import annotations

import uuid

import httpx
import structlog
from authlib.integrations.httpx_client import AsyncOAuth2Client
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    blacklist_refresh_token,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.db.models import User
from app.db.session import db_session

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/v1/auth", tags=["auth"])

_REFRESH_COOKIE = "refresh_token"
_COOKIE_AGE = 7 * 24 * 60 * 60  # 7 days in seconds


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def _strip(s: str) -> str:
    """Strip leading/trailing whitespace."""
    return s.strip()


class RegisterRequest(BaseModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(default="", max_length=255)

    @field_validator("email", "name", "password", mode="before")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)

    @field_validator("email", "password", mode="before")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v


class TokenUserOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict[str, str | None]


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


def _user_payload(u: User) -> dict:
    return {
        "id": str(u.id),
        "email": u.email,
        "name": u.name,
        "avatar_url": u.avatar_url,
    }


def _set_refresh_cookie(response: Response, token: str) -> None:
    from app.core.config import get_settings
    settings = get_settings()
    response.set_cookie(
        key=_REFRESH_COOKIE,
        value=token,
        max_age=_COOKIE_AGE,
        httponly=True,
        secure=settings.app_env == "prod",
        samesite="lax",
        path="/v1/auth/refresh",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=_REFRESH_COOKIE, path="/v1/auth/refresh")


# ------------------------------------------------------------------
# Register
# ------------------------------------------------------------------
@router.post("/register", response_model=TokenUserOut)
async def register(
    req: RegisterRequest,
    response: Response,
    session: AsyncSession = Depends(db_session),
):
    existing = await session.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=_strip(req.email),
        name=_strip(req.name) or _strip(req.email).split("@")[0],
        password_hash=hash_password(req.password),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    access = create_access_token(user.id)
    refresh_str, _ = create_refresh_token(user.id)

    _set_refresh_cookie(response, refresh_str)
    return TokenUserOut(access_token=access, user=_user_payload(user))


# ------------------------------------------------------------------
# Login
# ------------------------------------------------------------------
@router.post("/login", response_model=TokenUserOut)
async def login(
    req: LoginRequest,
    response: Response,
    session: AsyncSession = Depends(db_session),
):
    result = await session.execute(select(User).where(User.email == _strip(req.email)))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access = create_access_token(user.id)
    refresh_str, _ = create_refresh_token(user.id)

    _set_refresh_cookie(response, refresh_str)
    return TokenUserOut(access_token=access, user=_user_payload(user))


# ------------------------------------------------------------------
# Refresh — rotation with blacklist
# ------------------------------------------------------------------
class RefreshResponse(BaseModel):
    access_token: str
    user: UserOut


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(db_session),
):
    old_token = request.cookies.get(_REFRESH_COOKIE)
    if not old_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    payload = decode_refresh_token(old_token)
    if not payload or payload.get("type") != "refresh":
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    jti = payload.get("jti")
    if jti:
        from app.core.auth import is_refresh_blacklisted
        if await is_refresh_blacklisted(jti):
            _clear_refresh_cookie(response)
            raise HTTPException(status_code=401, detail="Token has been revoked")

    uid = payload.get("sub")
    result = await session.execute(select(User).where(User.id == uuid.UUID(uid)))
    user = result.scalar_one_or_none()
    if not user:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="User not found")

    # Blacklist old token
    if jti:
        await blacklist_refresh_token(jti, ttl_seconds=604800)

    # Issue new pair
    access = create_access_token(user.id)
    new_refresh, _ = create_refresh_token(user.id)
    _set_refresh_cookie(response, new_refresh)

    return RefreshResponse(access_token=access, user=UserOut(**_user_payload(user)))


# ------------------------------------------------------------------
# Logout
# ------------------------------------------------------------------
@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(db_session),
):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        from app.core.auth import blacklist_token
        await blacklist_token(auth[7:])

    # Also blacklist refresh
    old_token = request.cookies.get(_REFRESH_COOKIE)
    if old_token:
        payload = decode_refresh_token(old_token)
        if payload:
            jti = payload.get("jti")
            if jti:
                await blacklist_refresh_token(jti, ttl_seconds=604800)
        _clear_refresh_cookie(response)

    return {"status": "logged_out"}


# ------------------------------------------------------------------
# OAuth helpers
# ------------------------------------------------------------------
_oauth_states: dict[str, dict] = {}


def _new_state(provider: str) -> str:
    import time
    state = str(uuid.uuid4())
    _oauth_states[state] = {"provider": provider, "ts": time.time()}
    expired = [k for k, v in _oauth_states.items() if time.time() - v["ts"] > 600]
    for k in expired:
        del _oauth_states[k]
    return state


def _verify_state(state: str) -> str | None:
    entry = _oauth_states.pop(state, None)
    return entry["provider"] if entry else None


async def _upsert_and_respond(
    email: str, name: str, avatar: str, session: AsyncSession, provider: str, response: Response
):
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=email,
            name=name,
            password_hash="",
            avatar_url=avatar,
            auth_provider=provider,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

    access = create_access_token(user.id)
    refresh_str, _ = create_refresh_token(user.id)
    _set_refresh_cookie(response, refresh_str)

    return TokenUserOut(access_token=access, user=_user_payload(user))


# ── Google OAuth ──────────────────────────────────────────────
GOOGLE_SCOPES = ["openid", "email", "profile"]


def _oauth_client_google() -> AsyncOAuth2Client:
    from app.core.config import get_settings
    s = get_settings()
    return AsyncOAuth2Client(
        client_id=s.google_client_id,
        client_secret=s.google_client_secret,
        scope=" ".join(GOOGLE_SCOPES),
    )


@router.get("/google/login")
async def google_login(request: Request):
    client = _oauth_client_google()
    redirect_uri = str(request.url_for("google_callback"))
    auth_url, _ = client.create_authorization_url(
        "https://accounts.google.com/o/oauth2/v2/auth",
        redirect_uri=redirect_uri,
        state=_new_state("google"),
    )
    return {"authorization_url": auth_url}


@router.get("/google/callback", response_model=TokenUserOut)
async def google_callback(
    request: Request,
    response: Response,
    state: str | None = None,
    session: AsyncSession = Depends(db_session),
):
    code = request.query_params.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="No code provided")

    provider = _verify_state(state or "")
    if provider != "google":
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    client = _oauth_client_google()
    token = await client.fetch_token(
        "https://oauth2.googleapis.com/token",
        code=code,
        redirect_uri=str(request.url_for("google_callback")),
    )
    access_token = token.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="No access_token")

    async with httpx.AsyncClient() as http:
        r = await http.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if r.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch user info")
        info = r.json()

    return await _upsert_and_respond(
        info.get("email", ""),
        info.get("name", ""),
        info.get("picture", ""),
        session,
        "google",
        response,
    )


# ── GitHub OAuth ──────────────────────────────────────────────
def _oauth_client_github() -> AsyncOAuth2Client:
    from app.core.config import get_settings
    s = get_settings()
    return AsyncOAuth2Client(
        client_id=s.github_client_id,
        client_secret=s.github_client_secret,
    )


@router.get("/github/login")
async def github_login(request: Request):
    client = _oauth_client_github()
    redirect_uri = str(request.url_for("github_callback"))
    auth_url, _ = client.create_authorization_url(
        "https://github.com/login/oauth/authorize",
        redirect_uri=redirect_uri,
        state=_new_state("github"),
    )
    return {"authorization_url": auth_url}


@router.get("/github/callback", response_model=TokenUserOut)
async def github_callback(
    request: Request,
    response: Response,
    state: str | None = None,
    session: AsyncSession = Depends(db_session),
):
    code = request.query_params.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="No code provided")

    _verify_state(state or "")  # consume state

    client = _oauth_client_github()
    token = await client.fetch_token(
        "https://github.com/login/oauth/access_token",
        code=code,
        redirect_uri=str(request.url_for("github_callback")),
    )

    async with httpx.AsyncClient() as http:
        r = await http.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {token['access_token']}",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        profile = r.json()

    email = profile.get("email") or f"github-{profile.get('id')}@local"
    name = profile.get("name") or profile.get("login", "")
    avatar = profile.get("avatar_url", "")

    return await _upsert_and_respond(email, name, avatar, session, "github", response)


# ------------------------------------------------------------------
# Me (current user info)
# ------------------------------------------------------------------
@router.get("/me")
async def me(request: Request):
    return {"user": getattr(request.state, "user", {})}
