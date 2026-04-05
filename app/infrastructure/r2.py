"""Cloudflare R2 file storage (S3-compatible). Free tier = 10 GB."""
from __future__ import annotations

import uuid

import structlog
from app.core.config import get_settings

log = structlog.get_logger(__name__)


def _boto_client():
    try:
        import boto3
    except ImportError:
        raise ImportError("pip install boto3 for R2 support")
    s = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=s.r2_endpoint_url,
        aws_access_key_id=s.r2_access_key_id,
        aws_secret_access_key=s.r2_secret_access_key,
        region_name="auto",
    )


def upload_file(file_data: bytes, filename: str, mime: str = "application/octet-stream") -> str:
    """Upload to R2, return the S3 key."""
    s = get_settings()
    if not s.r2_bucket_name:
        raise RuntimeError("R2_BUCKET_NAME not set")
    key = f"uploads/{uuid.uuid4().hex[:12]}_{filename}"
    _boto_client().put_object(Bucket=s.r2_bucket_name, Key=key, Body=file_data, ContentType=mime)
    log.info("r2_uploaded", key=key, size=len(file_data))
    return key


def get_download_url(key: str, expires: int = 3600) -> str:
    """Presigned URL valid for `expires` seconds."""
    s = get_settings()
    return _boto_client().generate_presigned_url(
        "get_object", Params={"Bucket": s.r2_bucket_name, "Key": key}, ExpiresIn=expires
    )


def delete_file(key: str) -> None:
    s = get_settings()
    _boto_client().delete_object(Bucket=s.r2_bucket_name, Key=key)
    log.info("r2_deleted", key=key)
