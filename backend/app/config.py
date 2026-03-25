import os
from dotenv import load_dotenv

# Ensure backend `.env` is always loaded (even if cwd differs) and overrides any already-exported env vars.
# This prevents accidentally using an old exported MONGODB_URL (often mongodb+srv://...) and hitting DNS SRV timeouts.
_ENV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(dotenv_path=_ENV_PATH, override=True)


class Settings:
    PROJECT_NAME: str = "AIUGIP LMS"
    PROJECT_VERSION: str = "2.0.0"

    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "aiugip_lms")

    SECRET_KEY: str = os.getenv("SECRET_KEY", "aiugip-lms-secret-key-change-in-production-2024")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")
    CERTIFICATE_DIR: str = os.getenv("CERTIFICATE_DIR", "uploads/certificates")

    BASE_URL: str = os.getenv("BASE_URL", "http://localhost:8000")

    # Browser auth: HttpOnly cookie name (student). Must match frontend + security.get_current_student.
    STUDENT_COOKIE_NAME: str = os.getenv("STUDENT_COOKIE_NAME", "lms_student")
    # Controls cookie SameSite behavior for cross-site frontend -> backend requests.
    # For production deployments where frontend and backend are on different domains (Vercel + Railway),
    # set this to "none" and ensure COOKIE_SECURE=true.
    STUDENT_COOKIE_SAMESITE: str = os.getenv("STUDENT_COOKIE_SAMESITE", "").strip().lower()
    # CORS: credentials + cookies require explicit origins (not "*").
    CORS_ORIGINS: list = [
        o.strip()
        for o in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,http://localhost:4173,http://127.0.0.1:4173",
        ).split(",")
        if o.strip()
    ]
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "false").lower() in ("1", "true", "yes")
    # False = SPA can read cookie and send Authorization: Bearer (required for current frontend).
    # True = HttpOnly only; use server-side cookie auth without JS reading the token.
    STUDENT_COOKIE_HTTPONLY: bool = os.getenv("STUDENT_COOKIE_HTTPONLY", "false").lower() in ("1", "true", "yes")

    # ── Cloudflare R2 Object Storage ──
    R2_ACCOUNT_ID: str = os.getenv("R2_ACCOUNT_ID", "")
    R2_ACCESS_KEY_ID: str = os.getenv("R2_ACCESS_KEY_ID", "")
    R2_SECRET_ACCESS_KEY: str = os.getenv("R2_SECRET_ACCESS_KEY", "")
    R2_BUCKET_NAME: str = os.getenv("R2_BUCKET_NAME", "")
    R2_ENDPOINT_URL: str = os.getenv("R2_ENDPOINT_URL", "")
    # Public URL for serving files (set to your custom domain or R2 public bucket URL)
    R2_PUBLIC_URL: str = os.getenv("R2_PUBLIC_URL", "")

    # SMTP settings for OTP
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")


settings = Settings()
