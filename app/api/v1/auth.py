"""
Auth router — register, login (email/password), refresh token,
Google OAuth, GitHub OAuth.
"""

from __future__ import annotations

import uuid

import httpx
from authlib.integrations.httpx_client import AsyncOAuth2Client
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import create_access_token, create_refresh_token, hash_password, verify_password
from app.db.models import User
from app.db.session import db_session

router = APIRouter(prefix="/v1/auth", tags=["auth"])

# ------------------------------------------------------------------
# Request / response models
# ------------------------------------------------------------------
class RegisterRequest(BaseModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(default="", max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


def _user_payload(u: User) -> dict:
    return {"id": str(u.id), "email": u.email, "name": u.name, "avatar_url": u.avatar_url}


# ------------------------------------------------------------------
# Register
# ------------------------------------------------------------------
@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, session: AsyncSession = Depends(db_session)):
    existing = await session.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=req.email,
        name=req.name or req.email.split("@")[0],
        password_hash=hash_password(req.password),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)

    return TokenResponse(access_token=access, refresh_token=refresh, user=_user_payload(user))


# ------------------------------------------------------------------
# Login
# ------------------------------------------------------------------
@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, session: AsyncSession = Depends(db_session)):
    result = await session.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)

    return TokenResponse(access_token=access, refresh_token=refresh, user=_user_payload(user))


# ------------------------------------------------------------------
# Refresh
# ------------------------------------------------------------------
class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(req: RefreshRequest, session: AsyncSession = Depends(db_session)):
    from app.core.auth import decode_access_token

    payload = decode_access_token(req.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    uid = payload.get("sub")
    result = await session.execute(select(User).where(User.id == uuid.UUID(uid)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return TokenResponse(access_token=create_access_token(user.id), refresh_token=create_refresh_token(user.id), user=_user_payload(user))


# ------------------------------------------------------------------
# OAuth state store (in-memory with 10-min TTL is fine for state)
# ------------------------------------------------------------------
_oauth_states: dict[str, dict] = {}


def _new_state(provider: str) -> str:
    import time
    state = str(uuid.uuid4())
    _oauth_states[state] = {"provider": provider, "ts": time.time()}
    # cleanup expired
    expired = [k for k, v in _oauth_states.items() if time.time() - v["ts"] > 600]
    for k in expired:
        del _oauth_states[k]
    return state


def _verify_state(state: str) -> str | None:
    entry = _oauth_states.pop(state, None)
    if entry:
        return entry["provider"]
    return None


# ------------------------------------------------------------------
# Google OAuth
# ------------------------------------------------------------------
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
    authorization_url, state = client.create_authorization_url(
        "https://accounts.google.com/o/oauth2/v2/auth",
        redirect_uri=redirect_uri,
        state=_new_state("google"),
    )
    return {"authorization_url": authorization_url}


@router.get("/google/callback")
async def google_callback(request: Request, session: AsyncSession = Depends(db_session)):
    code = request.query_params.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="No code provided")

    client = _oauth_client_google()
    token = await client.fetch_token(
        "https://oauth2.googleapis.com/token",
        code=code,
        redirect_uri=str(request.url_for("google_callback")),
    )
    id_token = token.get("id_token")
    if not id_token:
        raise HTTPException(status_code=400, detail="No id_token received")

    # Decode ID token to get user info
    from jose import jwt as jose_jwt
    info = jose_jwt.decode(id_token, options={"verify_signature": False, "verify_aud": False})

    email = info.get("email", "")
    name = info.get("name", "")
    avatar = info.get("picture", "")

    return await _upsert_and_respond(email, name, avatar, session, "google")


# ------------------------------------------------------------------
# GitHub OAuth
# ------------------------------------------------------------------
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
    authorization_url, state = client.create_authorization_url(
        "https://github.com/login/oauth/authorize",
        redirect_uri=redirect_uri,
        state=_new_state("github"),
    )
    return {"authorization_url": authorization_url}


@router.get("/github/callback")
async def github_callback(request: Request, session: AsyncSession = Depends(db_session)):
    code = request.query_params.get("code")
    state = request.query_params.get("state")
    if not code:
        raise HTTPException(status_code=400, detail="No code provided")

    client = _oauth_client_github()
    token = await client.fetch_token(
        "https://github.com/login/oauth/access_token",
        code=code,
        redirect_uri=str(request.url_for("github_callback")),
    )

    async with httpx.AsyncClient() as http:
        r = await http.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {token['access_token']}", "Accept": "application/vnd.github.v3+json"},
        )
        profile = r.json()

    email = profile.get("email") or f"github-{profile.get('id')}@local"
    name = profile.get("name") or profile.get("login", "")
    avatar = profile.get("avatar_url", "")

    return await _upsert_and_respond(email, name, avatar, session, "github")


# ------------------------------------------------------------------
# Helper: find or create user from OAuth, return tokens
# ------------------------------------------------------------------
async def _upsert_and_respond(email: str, name: str, avatar: str, session: AsyncSession, provider: str) -> dict:
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=email,
            name=name,
            password_hash="",  # no password for OAuth users
            avatar_url=avatar,
            auth_provider=provider,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)

    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "user": _user_payload(user),
    }


# ------------------------------------------------------------------
# Me (current user info)
# ------------------------------------------------------------------
@router.get("/me")
async def me(request: Request):
    return {"user": request.state.user}
