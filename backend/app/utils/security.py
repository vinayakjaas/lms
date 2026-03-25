import jwt
import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException, status, Header, Cookie
from app.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    now = datetime.utcnow()
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    # NumericDate (Unix seconds) — consistent across PyJWT versions and clients
    to_encode["exp"] = int(expire.timestamp())
    if "iat" not in to_encode:
        to_encode["iat"] = int(now.timestamp())
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def get_demo_student():
    """Return the first student in MongoDB (demo mode, no auth)."""
    from app.models.user import Student
    student = await Student.find_one()
    if not student:
        raise HTTPException(status_code=404, detail="No students found. Please restart the server to seed data.")
    return student


async def get_current_student(
    authorization: Optional[str] = Header(None),
    student_cookie: Optional[str] = Cookie(None, alias=settings.STUDENT_COOKIE_NAME),
):
    """
    Resolve student from HttpOnly cookie first (authoritative on login), then Authorization Bearer.
    Avoids mismatches when localStorage holds a stale token but the cookie matches the last login.
    """
    from app.models.user import Student
    from beanie import PydanticObjectId

    token: Optional[str] = None
    if student_cookie and student_cookie.strip():
        token = student_cookie.strip()
    elif authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(token)
    if payload.get("type") != "student":
        raise HTTPException(status_code=403, detail="Invalid token type")
    raw_id = payload.get("sub")
    if raw_id is None or raw_id == "":
        raw_id = payload.get("user_id")
    uid = str(raw_id).strip() if raw_id is not None else ""
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token")
    try:
        oid = PydanticObjectId(uid)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    student = await Student.get(oid)
    if not student:
        raise HTTPException(status_code=401, detail="Student not found")
    if not student.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")
    return student


async def get_demo_admin():
    """Return the first admin in MongoDB (demo mode, no auth)."""
    from app.models.user import Admin
    admin = await Admin.find_one()
    if not admin:
        raise HTTPException(status_code=404, detail="No admin found. Please restart the server to seed data.")
    return admin
