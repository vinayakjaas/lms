from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime


class Assignment(Document):
    student_id: str
    module_id: str
    course_id: Optional[str] = None
    title: Optional[str] = None
    file_url: str
    file_name: Optional[str] = None
    status: str = "submitted"  # submitted, reviewed, graded
    marks: Optional[int] = None
    max_marks: int = 100
    feedback: Optional[str] = None
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    graded_at: Optional[datetime] = None

    class Settings:
        name = "assignments"
