from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime


class Grade(Document):
    student_id: str
    course_id: str
    quiz_score: float = 0.0       # 30% weight
    assignment_score: float = 0.0  # 30% weight
    attendance_score: float = 0.0  # 40% weight
    total_score: float = 0.0
    grade: Optional[str] = None    # A+, A, B, C, D, F
    calculated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "grades"

    @staticmethod
    def calculate_grade(total_score: float) -> str:
        if total_score >= 90:
            return "A+"
        elif total_score >= 80:
            return "A"
        elif total_score >= 70:
            return "B"
        elif total_score >= 60:
            return "C"
        elif total_score >= 50:
            return "D"
        else:
            return "F"
