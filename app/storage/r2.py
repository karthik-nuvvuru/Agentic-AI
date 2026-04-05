"""Cloudflare R2 (S3-compatible) client for file uploads.

Falls back to local filesystem if R2 credentials aren't set.
"""
from __future__ import annotations

import uuid
from io import BytesIO
from typing import AsyncGenerator

import aioboto3
import structlog
from app.core.config import get_settings

log = structlog.get_logger(__name__)


class R2Storage:
    """Uploads / retrieves files from Cloudflare R2."""

    def __init__(self) -> None:
        s = get_settings()
        self._access_key = s.r2_access_key_id
        self._secret_key = s.r2_secret_access_key
        self._bucket = s.r2_bucket_name
        self._endpoint = s.r2_endpoint_url
        self._configured = bool(self._access_key and self._secret_key and self._bucket)

    def _session(self) -> aioboto3.Session:
        return aioboto3.Session(
            aws_access_key_id=self._access_key,
            aws_secret_access_key=self._secret_key,
        )

    async def upload(self, data: bytes, filename: str, mime: str = "application/octet-stream") -> str:
        """Upload raw bytes, return the public key (filename)."""
        if not self._configured:
            log.warning("r2_not_configured_falling_back_to_local", filename=filename)
            raise RuntimeError("R2 not configured")

        key = f"uploads/{uuid.uuid4().hex[:12]}_{filename}"
        async with self._session().client(
            "s3",
            endpoint_url=self._endpoint,
            region_name="auto",
        ) as client:
            await client.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=data,
                ContentType=mime,
            )
        log.info("r2_upload_complete", key=key)
        return key

    async def get_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate a presigned download URL (1 hour default)."""
        async with self._session().client(
            "s3",
            endpoint_url=self._endpoint,
            region_name="auto",
        ) as client:
            url = await client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self._bucket, "Key": key},
                ExpiresIn=expires_in,
            )
        return url

    async def delete(self, key: str) -> None:
        async with self._session().client(
            "s3",
            endpoint_url=self._endpoint,
            region_name="auto",
        ) as client:
            await client.delete_object(Bucket=self._bucket, Key=key)
