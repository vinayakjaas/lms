import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import init_db, close_db

from app.routers import auth, courses, quizzes, assignments, grades, certificates, admin, assignment_sections


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    await init_db()
    from app.services.seed_data import seed_demo_data
    await seed_demo_data()
    yield
    # Shutdown
    await close_db()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="All India Undergraduate Internship Program - Learning Management System (MongoDB)",
    lifespan=lifespan,
)

# CORS — explicit origins so browsers send cookies (withCredentials) from the SPA
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount upload directory for static files
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include routers
app.include_router(auth.router)
app.include_router(courses.router)
app.include_router(quizzes.router)
app.include_router(assignments.router)
app.include_router(assignment_sections.router)
app.include_router(grades.router)
app.include_router(certificates.router)
app.include_router(admin.router)


@app.get("/")
async def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "database": "MongoDB Atlas",
        "docs": "/docs",
        "status": "running",
    }


@app.get("/health")
async def health():
    result = {"status": "healthy", "database": "mongodb"}

    # Check R2 connectivity
    from app.services.r2_storage import is_r2_enabled
    result["r2_enabled"] = is_r2_enabled()
    if is_r2_enabled():
        try:
            from app.services.r2_storage import _get_s3_client
            from app.config import settings
            client = _get_s3_client()
            client.head_bucket(Bucket=settings.R2_BUCKET_NAME)
            result["r2_bucket"] = settings.R2_BUCKET_NAME
            result["r2_status"] = "connected"
        except Exception as e:
            result["r2_status"] = f"error: {str(e)}"

    return result

