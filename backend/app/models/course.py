from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ModuleContent(BaseModel):
    """Embedded sub-document for module content."""
    id: str  # unique id within course
    title: str
    content_type: str  # video, pdf, ppt, text
    content_url: Optional[str] = None
    content_text: Optional[str] = None
    duration_minutes: int = 0
    order_index: int = 0
    is_mandatory: bool = True
    # Visibility controls
    visibility_mode: str = "all"  # all | colleges | students | colleges_and_students
    visible_college_ids: List[str] = []
    visible_student_ids: List[str] = []


class Module(BaseModel):
    """Embedded sub-document for module."""
    id: str  # unique id within course
    title: str
    description: Optional[str] = None
    order_index: int
    module_type: Optional[str] = None
    # Explicit learning phase: "video", "study", "assignment", "quiz"
    # If not set, the frontend infers it from contents / quiz_id.
    section_type: Optional[str] = None
    is_mandatory: bool = True
    contents: List[ModuleContent] = []
    quiz_id: Optional[str] = None  # reference to Quiz document
    # Visibility controls
    visibility_mode: str = "all"  # all | colleges | students | colleges_and_students
    visible_college_ids: List[str] = []
    visible_student_ids: List[str] = []


class Course(Document):
    title: str
    description: Optional[str] = None
    total_hours: int = 120
    is_active: bool = True
    modules: List[Module] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "courses"


class Enrollment(Document):
    student_id: str
    course_id: str
    enrolled_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    status: str = "active"  # active, completed, dropped

    class Settings:
        name = "enrollments"


class Progress(Document):
    enrollment_id: str
    student_id: str
    course_id: str
    module_id: str
    content_id: Optional[str] = None
    watch_percentage: float = 0.0
    completed: bool = False
    time_spent_seconds: int = 0
    last_accessed: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "progress"
