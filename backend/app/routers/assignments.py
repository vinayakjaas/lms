import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import Optional
from app.models.user import Student
from app.models.assignment import Assignment
from app.models.course import Course
from app.utils.security import get_current_student
from app.config import settings
from datetime import datetime

router = APIRouter(prefix="/api/assignments", tags=["Assignments"])


@router.post("/upload")
async def upload_assignment(
    module_id: str = Form(...),
    title: Optional[str] = Form(None),
    file: UploadFile = File(...),
    student: Student = Depends(get_current_student),
):
    # Prevent re-upload once a module assignment has been graded.
    already_graded = await Assignment.find_one(
        Assignment.student_id == str(student.id),
        Assignment.module_id == module_id,
        Assignment.status == "graded",
    )
    if already_graded:
        raise HTTPException(status_code=400, detail="Assignment already graded. Re-upload is disabled.")

    # Validate file type
    allowed_types = [".pdf", ".doc", ".docx"]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF/DOC files allowed")

    # Store assignment files in R2 or local disk.
    from app.services.r2_storage import is_r2_enabled, upload_file as r2_upload

    file_bytes = await file.read()

    if is_r2_enabled():
        file_url = await r2_upload(
            file_contents=file_bytes,
            original_filename=file.filename or "assignment",
            prefix="assignments",
            content_type=file.content_type,
        )
    else:
        upload_dir = os.path.join(settings.UPLOAD_DIR, "assignments")
        os.makedirs(upload_dir, exist_ok=True)
        filename = f"{student.id}_{module_id}_{file.filename}"
        file_path = os.path.join(upload_dir, filename)
        with open(file_path, "wb") as f:
            f.write(file_bytes)
        file_url = f"/uploads/assignments/{filename}"

    # Best-effort mapping: persist course_id for cleaner grade aggregation and admin filtering.
    mapped_course_id = None
    try:
        course = await Course.find_one({"modules.id": module_id})
        if course:
            mapped_course_id = str(course.id)
    except Exception:
        mapped_course_id = None

    assignment = Assignment(
        student_id=str(student.id),
        module_id=module_id,
        course_id=mapped_course_id,
        title=title or file.filename,
        file_url=file_url,
        file_name=file.filename,
    )
    await assignment.insert()

    return {
        "id": str(assignment.id),
        "module_id": assignment.module_id,
        "title": assignment.title,
        "file_url": assignment.file_url,
        "file_name": assignment.file_name,
        "status": assignment.status,
        "marks": assignment.marks,
        "max_marks": assignment.max_marks,
        "feedback": assignment.feedback,
        "submitted_at": assignment.submitted_at.isoformat() if assignment.submitted_at else None,
    }


@router.get("/my")
async def my_assignments(student: Student = Depends(get_current_student)):
    assignments = await Assignment.find(
        Assignment.student_id == str(student.id)
    ).to_list()

    return [
        {
            "id": str(a.id),
            "module_id": a.module_id,
            "title": a.title,
            "file_url": a.file_url,
            "file_name": a.file_name,
            "status": a.status,
            "marks": a.marks,
            "max_marks": a.max_marks,
            "feedback": a.feedback,
            "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
        }
        for a in assignments
    ]


@router.put("/{assignment_id}/grade")
async def grade_assignment(
    assignment_id: str,
    marks: int = Form(...),
    feedback: Optional[str] = Form(None),
):
    from beanie import PydanticObjectId
    assignment = await Assignment.get(PydanticObjectId(assignment_id))
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    assignment.marks = marks
    assignment.feedback = feedback
    assignment.status = "graded"
    assignment.graded_at = datetime.utcnow()
    await assignment.save()

    return {"message": "Assignment graded", "marks": marks}
