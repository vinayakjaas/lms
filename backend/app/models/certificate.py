from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime, date


class Certificate(Document):
    student_id: str
    course_id: str
    certificate_id: str  # unique ID like AIUGIP-XXXX-2024
    student_name: Optional[str] = None
    college_name: Optional[str] = None
    course_name: Optional[str] = None
    semester: Optional[str] = None
    roll_number: Optional[str] = None
    reg_number: Optional[str] = None
    internship_title: Optional[str] = None
    duration: str = "120 Hours"
    grade: Optional[str] = None
    qr_code_url: Optional[str] = None
    pdf_url: Optional[str] = None
    issue_date: Optional[str] = None  # stored as ISO string
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "certificates"


class Feedback(Document):
    student_id: str
    course_id: str
    rating: Optional[int] = None  # 1-5
    comments: Optional[str] = None
    submitted_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "feedback"
