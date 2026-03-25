from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.config import settings

client: AsyncIOMotorClient = None


async def init_db():
    """Initialize MongoDB connection and Beanie ODM."""
    global client
    # Fail fast on bad host / network (e.g. missing MONGODB_URL on Railway defaults to localhost).
    client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        serverSelectionTimeoutMS=15_000,
        connectTimeoutMS=15_000,
    )
    db = client[settings.MONGODB_DB_NAME]

    from app.models.user import University, College, Student, Admin
    from app.models.course import Course, Enrollment, Progress
    from app.models.quiz import Quiz, QuizAttempt
    from app.models.assignment import Assignment
    from app.models.grade import Grade
    from app.models.assignment_section import AssignmentSection
    from app.models.certificate import Certificate, Feedback

    await init_beanie(
        database=db,
        document_models=[
            University, College, Student, Admin,
            Course, Enrollment, Progress,
            Quiz, QuizAttempt,
            Assignment, Grade,
            AssignmentSection,
            Certificate, Feedback,
        ],
    )


async def close_db():
    """Close MongoDB connection."""
    global client
    if client:
        client.close()
