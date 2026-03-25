from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime, date


class University(Document):
    name: str
    code: str
    state: Optional[str] = None
    logo_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "universities"


class College(Document):
    university_id: Optional[str] = None  # str ObjectId reference
    name: str
    code: str
    city: Optional[str] = None
    logo_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "colleges"


class Student(Document):
    name: str
    father_name: Optional[str] = None
    mother_name: Optional[str] = None
    dob: Optional[str] = None  # stored as string YYYY-MM-DD
    gender: Optional[str] = None
    mobile: str
    email: Optional[str] = None
    password_hash: str
    course_name: Optional[str] = None
    semester: Optional[str] = None
    college_id: Optional[str] = None  # str ObjectId reference
    # When a student selects "Other" (college outside the predefined list).
    other_college_name: Optional[str] = None
    roll_number: Optional[str] = None
    reg_number: Optional[str] = None
    photo_url: Optional[str] = None
    college_id_url: Optional[str] = None
    signature_url: Optional[str] = None
    undertaking_accepted: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "students"


class Admin(Document):
    name: str
    email: str
    password_hash: str
    role: str = "admin"  # super_admin, admin
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "admins"
