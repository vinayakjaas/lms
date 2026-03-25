from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


# ── Auth Schemas ──
class StudentRegister(BaseModel):
    name: str
    father_name: Optional[str] = None
    mother_name: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[str] = None
    mobile: str
    email: Optional[str] = None
    password: str
    course_name: Optional[str] = None
    semester: Optional[str] = None
    college_id: Optional[int] = None
    roll_number: Optional[str] = None
    reg_number: Optional[str] = None
    undertaking_accepted: bool = False


class LoginRequest(BaseModel):
    username: str  # mobile or email
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ── Student Schemas ──
class StudentProfile(BaseModel):
    id: int
    name: str
    father_name: Optional[str]
    mother_name: Optional[str]
    dob: Optional[date]
    gender: Optional[str]
    mobile: str
    email: Optional[str]
    course_name: Optional[str]
    semester: Optional[str]
    college_name: Optional[str] = None
    university_name: Optional[str] = None
    roll_number: Optional[str]
    reg_number: Optional[str]
    photo_url: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Course Schemas ──
class ModuleContentOut(BaseModel):
    id: int
    title: str
    content_type: str
    content_url: Optional[str]
    content_text: Optional[str]
    duration_minutes: int
    is_mandatory: bool

    class Config:
        from_attributes = True


class ModuleOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    order_index: int
    module_type: Optional[str]
    is_mandatory: bool
    contents: List[ModuleContentOut] = []
    is_completed: bool = False
    is_locked: bool = False

    class Config:
        from_attributes = True


class CourseOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    total_hours: int
    is_active: bool
    modules: List[ModuleOut] = []
    progress_percentage: float = 0.0

    class Config:
        from_attributes = True


# ── Quiz Schemas ──
class QuestionOut(BaseModel):
    id: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    marks: int

    class Config:
        from_attributes = True


class QuizOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    time_limit_minutes: int
    total_marks: int
    max_attempts: int
    questions: List[QuestionOut] = []

    class Config:
        from_attributes = True


class QuizSubmitRequest(BaseModel):
    responses: List[dict]  # [{"question_id": 1, "selected_option": "a"}, ...]


class QuizResultOut(BaseModel):
    attempt_id: int
    score: int
    total_marks: int
    percentage: int
    status: str
    details: List[dict] = []

    class Config:
        from_attributes = True


# ── Assignment Schemas ──
class AssignmentOut(BaseModel):
    id: int
    module_id: int
    title: Optional[str]
    file_url: str
    file_name: Optional[str]
    status: str
    marks: Optional[int]
    max_marks: int
    feedback: Optional[str]
    submitted_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Grade Schemas ──
class GradeOut(BaseModel):
    quiz_score: float
    assignment_score: float
    attendance_score: float
    total_score: float
    grade: str
    quiz_weighted: float = 0.0
    assignment_weighted: float = 0.0
    attendance_weighted: float = 0.0

    class Config:
        from_attributes = True


# ── Certificate Schemas ──
class CertificateOut(BaseModel):
    id: int
    certificate_id: str
    student_name: str
    college_name: Optional[str]
    course_name: Optional[str]
    grade: Optional[str]
    duration: str
    issue_date: Optional[date]
    pdf_url: Optional[str]
    qr_code_url: Optional[str]

    class Config:
        from_attributes = True


class EligibilityOut(BaseModel):
    is_eligible: bool
    modules_completed: bool
    assignment_submitted: bool
    final_test_attempted: bool
    feedback_submitted: bool


# ── Feedback Schema ──
class FeedbackRequest(BaseModel):
    course_id: int
    rating: int
    comments: Optional[str] = None


# ── Admin Schemas ──
class AdminLogin(BaseModel):
    email: str
    password: str


class DashboardStats(BaseModel):
    total_students: int
    total_colleges: int
    total_universities: int
    active_courses: int
    completion_rate: float
    avg_grade: Optional[str]


class CollegeOut(BaseModel):
    id: int
    name: str
    code: str
    city: Optional[str]
    university_name: Optional[str]
    student_count: int = 0
    logo_url: Optional[str]

    class Config:
        from_attributes = True


class UniversityOut(BaseModel):
    id: int
    name: str
    code: str
    state: Optional[str]
    college_count: int = 0

    class Config:
        from_attributes = True


# ── Progress Schema ──
class ProgressUpdate(BaseModel):
    module_id: int
    content_id: Optional[int] = None
    watch_percentage: float = 0.0
    time_spent_seconds: int = 0
