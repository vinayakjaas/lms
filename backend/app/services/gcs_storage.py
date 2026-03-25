"""
Backward-compatible shim.

All imports from ``app.services.gcs_storage`` are now redirected
to the Cloudflare R2 storage service (``app.services.r2_storage``).
"""

from app.services.r2_storage import (          # noqa: F401
    is_r2_enabled as is_gcs_enabled,
    upload_file,
    delete_file,
    list_files,
    generate_presigned_url,
)

# Re-export is_r2_enabled under the old name that existing code uses.
__all__ = [
    "is_gcs_enabled",
    "upload_file",
    "delete_file",
    "list_files",
    "generate_presigned_url",
]
