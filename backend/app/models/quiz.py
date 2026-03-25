from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class QuizQuestion(BaseModel):
    """Embedded sub-document for quiz questions."""
    id: str
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str  # a, b, c, or d
    marks: int = 1
    explanation: Optional[str] = None


class Quiz(Document):
    module_id: str  # reference to module id within a course
    course_id: str  # reference to Course document
    title: str
    description: Optional[str] = None
    time_limit_minutes: int = 30
    passing_score: int = 50
    total_marks: int = 100
    randomize: bool = True
    max_attempts: int = 3
    questions: List[QuizQuestion] = []
    status: str = "active"  # active, draft
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "quizzes"


class QuizResponse(BaseModel):
    """Embedded sub-document for quiz responses."""
    question_id: str
    selected_option: Optional[str] = None
    is_correct: bool = False


class QuizAttempt(Document):
    student_id: str
    quiz_id: str
    score: int = 0
    total_marks: int = 0
    percentage: int = 0
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    status: str = "in_progress"  # in_progress, completed, timed_out
    responses: List[QuizResponse] = []

    class Settings:
        name = "quiz_attempts"
