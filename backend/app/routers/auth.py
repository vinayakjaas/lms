import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import Optional
from app.models.user import Student, College, University
from app.utils.security import hash_password, verify_password, create_access_token, get_current_student
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

NO_STORE = {"Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache"}


def _student_token_cookie_params() -> dict:
    return {
        "key": settings.STUDENT_COOKIE_NAME,
        "httponly": settings.STUDENT_COOKIE_HTTPONLY,
        "samesite": "lax",
        "max_age": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "path": "/",
        "secure": settings.COOKIE_SECURE,
    }


def _student_jwt_payload(student: Student) -> dict:
    """JWT claims: identity for APIs + embedded profile hints (authoritative data still from DB via sub)."""
    sid = str(student.id)
    return {
        "sub": sid,
        "user_id": sid,
        "type": "student",
        "name": student.name,
        "mobile": student.mobile,
        "email": student.email or "",
        "course_name": student.course_name or "",
        "semester": student.semester or "",
    }


def student_session_response(body: dict, token: str) -> JSONResponse:
    r = JSONResponse(content=body)
    r.set_cookie(value=token, **_student_token_cookie_params())
    return r


@router.post("/register")
async def register(
    name: str = Form(...),
    mobile: str = Form(...),
    password: str = Form(...),
    email: Optional[str] = Form(None),
    father_name: Optional[str] = Form(None),
    mother_name: Optional[str] = Form(None),
    dob: Optional[str] = Form(None),
    gender: Optional[str] = Form(None),
    course_name: Optional[str] = Form(None),
    semester: Optional[str] = Form(None),
    college_id: Optional[str] = Form(None),
    other_college_name: Optional[str] = Form(None),
    roll_number: Optional[str] = Form(None),
    reg_number: Optional[str] = Form(None),
    undertaking_accepted: bool = Form(False),
    photo: Optional[UploadFile] = File(None),
    college_id_card: Optional[UploadFile] = File(None),
    signature: Optional[UploadFile] = File(None),
):
    # Check if mobile already exists
    existing = await Student.find_one(Student.mobile == mobile)
    if existing:
        raise HTTPException(status_code=400, detail="Mobile number already registered")

    if email:
        existing_email = await Student.find_one(Student.email == email)
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")

    # Handle file uploads — R2 or local fallback
    from app.services.r2_storage import is_r2_enabled, upload_file as r2_upload

    upload_dir = os.path.join(settings.UPLOAD_DIR, "students")
    os.makedirs(upload_dir, exist_ok=True)

    photo_url = None
    college_id_url = None
    signature_url = None

    if photo:
        photo_bytes = await photo.read()
        if is_r2_enabled():
            photo_url = await r2_upload(photo_bytes, photo.filename, prefix="students/photos", content_type=photo.content_type)
        else:
            photo_path = os.path.join(upload_dir, f"{mobile}_photo_{photo.filename}")
            with open(photo_path, "wb") as f:
                f.write(photo_bytes)
            photo_url = f"/uploads/students/{mobile}_photo_{photo.filename}"

    if college_id_card:
        cid_bytes = await college_id_card.read()
        if is_r2_enabled():
            college_id_url = await r2_upload(cid_bytes, college_id_card.filename, prefix="students/id-cards", content_type=college_id_card.content_type)
        else:
            cid_path = os.path.join(upload_dir, f"{mobile}_id_{college_id_card.filename}")
            with open(cid_path, "wb") as f:
                f.write(cid_bytes)
            college_id_url = f"/uploads/students/{mobile}_id_{college_id_card.filename}"

    if signature:
        sig_bytes = await signature.read()
        if is_r2_enabled():
            signature_url = await r2_upload(sig_bytes, signature.filename, prefix="students/signatures", content_type=signature.content_type)
        else:
            sig_path = os.path.join(upload_dir, f"{mobile}_sig_{signature.filename}")
            with open(sig_path, "wb") as f:
                f.write(sig_bytes)
            signature_url = f"/uploads/students/{mobile}_sig_{signature.filename}"

    student = Student(
        name=name,
        father_name=father_name,
        mother_name=mother_name,
        dob=dob,
        gender=gender,
        mobile=mobile,
        email=email,
        password_hash=hash_password(password),
        course_name=course_name,
        semester=semester,
        college_id=college_id,
        other_college_name=other_college_name,
        roll_number=roll_number,
        reg_number=reg_number,
        photo_url=photo_url,
        college_id_url=college_id_url,
        signature_url=signature_url,
        undertaking_accepted=undertaking_accepted,
    )
    await student.insert()

    # Enroll new students in every active course so modules, progress, and grades align with this account.
    from app.models.course import Course, Enrollment

    sid = str(student.id)
    for c in await Course.find(Course.is_active == True).to_list():
        cid = str(c.id)
        exists = await Enrollment.find_one(
            Enrollment.student_id == sid,
            Enrollment.course_id == cid,
        )
        if not exists:
            await Enrollment(student_id=sid, course_id=cid).insert()

    token = create_access_token(_student_jwt_payload(student))
    return student_session_response(
        {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": sid,
                "name": student.name,
                "mobile": student.mobile,
                "email": student.email,
                "course_name": student.course_name,
                "semester": student.semester,
                "type": "student",
            },
        },
        token,
    )


@router.post("/login")
async def login(data: dict):
    username = data.get("username", "")
    password = data.get("password", "")

    student = await Student.find_one(
        {"$or": [{"mobile": username}, {"email": username}]}
    )

    if not student or not verify_password(password, student.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not student.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    sid = str(student.id)
    token = create_access_token(_student_jwt_payload(student))
    return student_session_response(
        {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": sid,
                "name": student.name,
                "mobile": student.mobile,
                "email": student.email,
                "course_name": student.course_name,
                "semester": student.semester,
                "type": "student",
            },
        },
        token,
    )


@router.post("/logout")
async def logout_student():
    r = JSONResponse(content={"ok": True})
    r.delete_cookie(key=settings.STUDENT_COOKIE_NAME, path="/")
    return r


@router.get("/me")
async def get_profile(student: Student = Depends(get_current_student)):
    college_name = getattr(student, "other_college_name", None)
    university_name = None
    if student.college_id:
        from beanie import PydanticObjectId
        try:
            college = await College.get(PydanticObjectId(student.college_id))
            if college:
                college_name = college.name
                if college.university_id:
                    uni = await University.get(PydanticObjectId(college.university_id))
                    if uni:
                        university_name = uni.name
        except Exception:
            pass

    return JSONResponse(
        content={
            "id": str(student.id),
            "name": student.name,
            "father_name": student.father_name,
            "mother_name": student.mother_name,
            "dob": student.dob,
            "gender": student.gender,
            "mobile": student.mobile,
            "email": student.email,
            "course_name": student.course_name,
            "semester": student.semester,
            "college_name": college_name,
            "university_name": university_name,
            "roll_number": student.roll_number,
            "reg_number": student.reg_number,
            "photo_url": student.photo_url,
            "created_at": student.created_at.isoformat() if student.created_at else None,
        },
        headers=NO_STORE,
    )
