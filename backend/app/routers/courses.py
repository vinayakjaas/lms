from fastapi import APIRouter, Depends, HTTPException, Header
from app.models.user import Student
from app.models.course import Course, Enrollment, Progress
from app.utils.security import get_current_student
from datetime import datetime
from typing import Optional

router = APIRouter(prefix="/api/courses", tags=["Courses"])


def _is_visible(mode: str, student_college_id: Optional[str], student_id: Optional[str], college_ids: list, student_ids: list) -> bool:
    m = (mode or "all").lower()
    if m == "all":
        return True
    if not student_id:
        return True
    in_college = bool(student_college_id and student_college_id in (college_ids or []))
    in_student = bool(student_id and student_id in (student_ids or []))
    if m == "colleges":
        return in_college
    if m == "students":
        return in_student
    if m == "colleges_and_students":
        return in_college or in_student
    return True


async def _resolve_optional_student_from_auth(authorization: Optional[str]) -> Optional[Student]:
    """Best-effort student resolution for visibility filtering without forcing auth for admin pages."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization[7:].strip()
    if not token:
        return None
    try:
        from app.utils.security import decode_token
        payload = decode_token(token)
        if payload.get("type") != "student":
            return None
        raw_id = payload.get("sub") or payload.get("user_id")
        if not raw_id:
            return None
        from beanie import PydanticObjectId
        return await Student.get(PydanticObjectId(str(raw_id)))
    except Exception:
        return None


def module_to_dict(m, student: Optional[Student] = None):
    sid = str(student.id) if student else None
    scid = str(student.college_id) if student and student.college_id else None
    mod_visible = _is_visible(
        getattr(m, "visibility_mode", "all"),
        scid,
        sid,
        getattr(m, "visible_college_ids", []) or [],
        getattr(m, "visible_student_ids", []) or [],
    )
    if not mod_visible:
        return None

    filtered_contents = []
    for c in sorted(m.contents, key=lambda x: x.order_index):
        c_visible = _is_visible(
            getattr(c, "visibility_mode", "all"),
            scid,
            sid,
            getattr(c, "visible_college_ids", []) or [],
            getattr(c, "visible_student_ids", []) or [],
        )
        if not c_visible:
            continue
        filtered_contents.append(
            {
                "id": c.id,
                "title": c.title,
                "content_type": c.content_type,
                "content_url": c.content_url,
                "content_text": c.content_text,
                "duration_minutes": c.duration_minutes,
                "is_mandatory": c.is_mandatory,
                "visibility_mode": getattr(c, "visibility_mode", "all"),
                "visible_college_ids": getattr(c, "visible_college_ids", []) or [],
                "visible_student_ids": getattr(c, "visible_student_ids", []) or [],
            }
        )

    return {
        "id": m.id,
        "title": m.title,
        "description": m.description,
        "order_index": m.order_index,
        "module_type": m.module_type,
        "section_type": getattr(m, "section_type", None),
        "is_mandatory": m.is_mandatory,
        "contents": filtered_contents,
        "is_completed": False,
        "is_locked": False,
        "quiz_id": m.quiz_id,
        "visibility_mode": getattr(m, "visibility_mode", "all"),
        "visible_college_ids": getattr(m, "visible_college_ids", []) or [],
        "visible_student_ids": getattr(m, "visible_student_ids", []) or [],
    }


def course_to_dict(c, student: Optional[Student] = None):
    modules = []
    for m in sorted(c.modules, key=lambda x: x.order_index):
        md = module_to_dict(m, student)
        if md is not None:
            modules.append(md)
    return {
        "id": str(c.id),
        "title": c.title,
        "description": c.description,
        "total_hours": c.total_hours,
        "is_active": c.is_active,
        "modules": modules,
        "progress_percentage": 0.0,
    }


@router.get("/")
async def list_courses(authorization: Optional[str] = Header(None)):
    courses = await Course.find(Course.is_active == True).to_list()
    student = await _resolve_optional_student_from_auth(authorization)
    return [course_to_dict(c, student) for c in courses]


@router.get("/{course_id}")
async def get_course(course_id: str, authorization: Optional[str] = Header(None)):
    from beanie import PydanticObjectId
    try:
        course = await Course.get(PydanticObjectId(course_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Course not found")
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    student = await _resolve_optional_student_from_auth(authorization)
    return course_to_dict(course, student)


@router.post("/{course_id}/enroll")
async def enroll(course_id: str, student: Student = Depends(get_current_student)):
    from beanie import PydanticObjectId
    course = await Course.get(PydanticObjectId(course_id))
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    existing = await Enrollment.find_one(
        Enrollment.student_id == str(student.id),
        Enrollment.course_id == course_id,
    )
    if existing:
        return {"message": "Already enrolled", "enrollment_id": str(existing.id)}

    enrollment = Enrollment(student_id=str(student.id), course_id=course_id)
    await enrollment.insert()
    return {"message": "Enrolled successfully", "enrollment_id": str(enrollment.id)}


@router.get("/{course_id}/progress")
async def get_progress(course_id: str, student: Student = Depends(get_current_student)):
    from beanie import PydanticObjectId
    sid = str(student.id)

    enrollment = await Enrollment.find_one(
        Enrollment.student_id == sid,
        Enrollment.course_id == course_id,
    )
    if not enrollment:
        enrollment = Enrollment(student_id=sid, course_id=course_id)
        await enrollment.insert()

    course = await Course.get(PydanticObjectId(course_id))
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    total_modules = len(course.modules)

    progress_items = await Progress.find(
        Progress.enrollment_id == str(enrollment.id)
    ).to_list()

    completed = sum(1 for p in progress_items if p.completed)

    module_progress = {}
    for p in progress_items:
        module_progress[p.module_id] = {
            "module_id": p.module_id,
            "watch_percentage": p.watch_percentage,
            "completed": p.completed,
            "time_spent_seconds": p.time_spent_seconds,
        }

    return {
        "total_modules": total_modules,
        "completed_modules": completed,
        "progress_percentage": round((completed / total_modules * 100) if total_modules > 0 else 0, 1),
        "module_progress": module_progress,
    }


@router.put("/progress")
async def update_progress(data: dict, student: Student = Depends(get_current_student)):
    module_id = data.get("module_id")
    content_id = data.get("content_id")
    watch_percentage = data.get("watch_percentage", 0.0)
    time_spent_seconds = data.get("time_spent_seconds", 0)

    if not module_id:
        raise HTTPException(status_code=400, detail="module_id required")

    # Find the course that contains this module
    courses = await Course.find().to_list()
    target_course = None
    target_module = None
    for c in courses:
        for m in c.modules:
            if m.id == module_id:
                target_course = c
                target_module = m
                break
        if target_course:
            break

    if not target_course:
        raise HTTPException(status_code=404, detail="Module not found")

    sid = str(student.id)
    cid = str(target_course.id)

    enrollment = await Enrollment.find_one(
        Enrollment.student_id == sid,
        Enrollment.course_id == cid,
    )
    if not enrollment:
        enrollment = Enrollment(student_id=sid, course_id=cid)
        await enrollment.insert()

    eid = str(enrollment.id)

    # Sequential lock check
    if target_module.order_index > 1:
        prev_module = None
        for m in target_course.modules:
            if m.order_index == target_module.order_index - 1:
                prev_module = m
                break
        if prev_module:
            prev_progress = await Progress.find_one(
                Progress.enrollment_id == eid,
                Progress.module_id == prev_module.id,
            )
            if not prev_progress or not prev_progress.completed:
                raise HTTPException(status_code=403, detail="Complete previous module first")

    progress = await Progress.find_one(
        Progress.enrollment_id == eid,
        Progress.module_id == module_id,
    )
    if not progress:
        progress = Progress(
            enrollment_id=eid,
            student_id=sid,
            course_id=cid,
            module_id=module_id,
            content_id=content_id,
        )

    progress.watch_percentage = max(progress.watch_percentage, watch_percentage)
    progress.time_spent_seconds += time_spent_seconds
    if watch_percentage >= 90:
        progress.completed = True
    progress.last_accessed = datetime.utcnow()

    await progress.save()
    return {"message": "Progress updated", "completed": progress.completed}
