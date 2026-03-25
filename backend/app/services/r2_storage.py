"""
Cloudflare R2 Object Storage service.

R2 is S3-compatible, so we use boto3 with a custom endpoint.
Falls back to local disk storage when R2 credentials are not configured.

Environment variables:
  R2_ACCESS_KEY_ID       – R2 API token access key
  R2_SECRET_ACCESS_KEY   – R2 API token secret key
  R2_BUCKET_NAME         – Name of the R2 bucket
  R2_ACCOUNT_ID          – Cloudflare account ID (used to build the endpoint)
  R2_PUBLIC_URL          – (optional) Custom domain / public bucket URL for serving files
"""

import os
import uuid
import logging
from typing import Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.config import settings

logger = logging.getLogger(__name__)

# ── Module-level lazy singleton ──
_s3_client = None


def _validate_r2_config() -> None:
    """
    Validate required R2 settings with basic shape checks.
    Cloudflare R2 access key IDs are 32 chars; endpoint should be a URL.
    """
    aid = (settings.R2_ACCESS_KEY_ID or "").strip()
    secret = (settings.R2_SECRET_ACCESS_KEY or "").strip()
    bucket = (settings.R2_BUCKET_NAME or "").strip()
    endpoint = (settings.R2_ENDPOINT_URL or "").strip()

    if not aid or not secret or not bucket or not endpoint:
        raise RuntimeError("R2 is not fully configured: set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT_URL")
    if aid.startswith("http://") or aid.startswith("https://"):
        raise RuntimeError("Invalid R2_ACCESS_KEY_ID: got a URL. Use the 32-character Access Key ID from Cloudflare R2 API tokens.")
    if len(aid) != 32:
        raise RuntimeError(f"Invalid R2_ACCESS_KEY_ID length: expected 32, got {len(aid)}")
    if secret.lower() in {"your_secret_access_key", "changeme", "replace-me"}:
        raise RuntimeError("Invalid R2_SECRET_ACCESS_KEY: placeholder value detected")
    if not endpoint.startswith("http://") and not endpoint.startswith("https://"):
        raise RuntimeError("Invalid R2_ENDPOINT_URL: must start with http:// or https://")


def _get_s3_client():
    """Return a cached boto3 S3 client configured for Cloudflare R2."""
    global _s3_client
    if _s3_client is not None:
        return _s3_client

    _validate_r2_config()
    _s3_client = boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(
            signature_version="s3v4",
            retries={"max_attempts": 3, "mode": "standard"},
        ),
        region_name="auto",  # R2 uses "auto"
    )
    return _s3_client


def is_r2_enabled() -> bool:
    """Return True when all required R2 settings are present."""
    try:
        _validate_r2_config()
        return True
    except Exception:
        return False


# Keep backward-compatible alias so existing imports don't break
is_gcs_enabled = is_r2_enabled


def _safe_key(original_filename: str, prefix: str = "") -> str:
    """Build a unique object key that preserves the original extension."""
    ext = os.path.splitext(original_filename)[1] if original_filename else ""
    unique = uuid.uuid4().hex[:12]
    key = f"{unique}{ext}"
    if prefix:
        key = f"{prefix.strip('/')}/{key}"
    return key


async def upload_file(
    file_contents: bytes,
    original_filename: str,
    prefix: str = "",
    content_type: Optional[str] = None,
) -> str:
    """
    Upload bytes to R2 and return the public URL.

    Parameters
    ----------
    file_contents : bytes
        Raw file bytes.
    original_filename : str
        Original file name (used to determine the extension).
    prefix : str
        Folder-like prefix inside the bucket, e.g. ``"content"`` or ``"assignments"``.
    content_type : str | None
        MIME type. If None, R2 infers from the key extension.

    Returns
    -------
    str
        Public URL for the uploaded object.
    """
    _validate_r2_config()

    client = _get_s3_client()
    key = _safe_key(original_filename, prefix)

    extra_args = {}
    if content_type:
        extra_args["ContentType"] = content_type

    try:
        client.put_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=key,
            Body=file_contents,
            **extra_args,
        )
        logger.info("Uploaded %s to R2 bucket %s", key, settings.R2_BUCKET_NAME)
    except ClientError as exc:
        logger.error("R2 upload failed for key=%s: %s", key, exc)
        raise

    # Build the public URL
    if settings.R2_PUBLIC_URL:
        return f"{settings.R2_PUBLIC_URL.rstrip('/')}/{key}"

    # Fallback: use the S3 endpoint (only works if bucket has public access)
    return f"{settings.R2_ENDPOINT_URL}/{settings.R2_BUCKET_NAME}/{key}"


async def generate_presigned_url(key: str, expires_in: int = 3600) -> str:
    """Generate a presigned URL for downloading a private object."""
    client = _get_s3_client()
    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": key},
        ExpiresIn=expires_in,
    )
    return url


async def generate_presigned_put_url(
    key: str,
    content_type: Optional[str] = None,
    expires_in: int = 3600,
) -> str:
    """Generate a presigned URL for uploading an object directly from client."""
    _validate_r2_config()
    client = _get_s3_client()
    params = {"Bucket": settings.R2_BUCKET_NAME, "Key": key}
    if content_type:
        params["ContentType"] = content_type
    return client.generate_presigned_url(
        "put_object",
        Params=params,
        ExpiresIn=expires_in,
    )


async def delete_file(key: str) -> bool:
    """Delete an object from R2. Returns True on success."""
    if not is_r2_enabled():
        return False

    client = _get_s3_client()
    try:
        client.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
        logger.info("Deleted %s from R2 bucket %s", key, settings.R2_BUCKET_NAME)
        return True
    except ClientError as exc:
        logger.error("R2 delete failed for key=%s: %s", key, exc)
        return False


async def list_files(prefix: str = "", max_keys: int = 100) -> list:
    """List objects in the bucket under a given prefix."""
    if not is_r2_enabled():
        return []

    client = _get_s3_client()
    try:
        response = client.list_objects_v2(
            Bucket=settings.R2_BUCKET_NAME,
            Prefix=prefix,
            MaxKeys=max_keys,
        )
        return [
            {
                "key": obj["Key"],
                "size": obj["Size"],
                "last_modified": obj["LastModified"].isoformat(),
            }
            for obj in response.get("Contents", [])
        ]
    except ClientError as exc:
        logger.error("R2 list failed for prefix=%s: %s", prefix, exc)
        return []
