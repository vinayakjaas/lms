from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File
from typing import Optional, List
from app.models.user import Admin, Student, University, College
from app.models.course import Course, Module, ModuleContent, Enrollment, Progress
from app.models.quiz import Quiz, QuizAttempt
from app.models.assignment import Assignment
from app.models.assignment_section import AssignmentSection
from app.models.grade import Grade
from app.models.certificate import Certificate, Feedback
from app.utils.security import hash_password, verify_password, create_access_token
import uuid
from datetime import datetime
import os
import shutil
from app.config import settings

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.post("/login")
async def admin_login(data: dict):
    email = data.get("email", "")
    password = data.get("password", "")

    admin = await Admin.find_one(Admin.email == email)
    if not admin or not verify_password(password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": str(admin.id), "type": "admin"})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": str(admin.id), "name": admin.name, "email": admin.email, "type": "admin"},
    }


@router.get("/dashboard")
async def dashboard_stats():
    total_students = await Student.find().count()
    total_colleges = await College.find().count()
    total_universities = await University.find().count()
    active_courses = await Course.find(Course.is_active == True).count()

    total_enrollments = await Enrollment.find().count()
    completed_enrollments = await Enrollment.find(Enrollment.status == "completed").count()
    completion_rate = (completed_enrollments / total_enrollments * 100) if total_enrollments > 0 else 0

    # Average grade
    all_grades = await Grade.find().to_list()
    avg_score = sum(g.total_score for g in all_grades) / len(all_grades) if all_grades else 0
    avg_grade = Grade.calculate_grade(avg_score) if avg_score > 0 else None

    # Total submissions
    total_submissions = await Assignment.find().count()

    # Certificates issued
    certificates_issued = await Certificate.find().count()

    # Recent submissions
    recent_assignments = await Assignment.find().sort("-submitted_at").limit(10).to_list()
    recent_submissions = []
    for a in recent_assignments:
        student = None
        try:
            from beanie import PydanticObjectId
            student = await Student.get(PydanticObjectId(a.student_id))
        except Exception:
            pass
        recent_submissions.append({
            "id": str(a.id),
            "student_name": student.name if student else "Unknown",
            "module_id": a.module_id,
            "title": a.title,
            "status": a.status,
            "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
        })

    # Module completion stats
    courses = await Course.find(Course.is_active == True).to_list()
    module_stats = []
    for c in courses:
        for m in c.modules[:5]:  # top 5
            total_progress = await Progress.find(Progress.module_id == m.id).count()
            completed_count = await Progress.find(
                Progress.module_id == m.id,
                Progress.completed == True,
            ).count()
            module_stats.append({
                "module_name": m.title,
                "enrolled": total_progress or 1,
                "completed": completed_count,
                "percentage": round((completed_count / total_progress * 100) if total_progress > 0 else 0),
            })

    return {
        "total_students": total_students,
        "total_colleges": total_colleges,
        "total_universities": total_universities,
        "active_courses": active_courses,
        "completion_rate": round(completion_rate, 1),
        "avg_grade": avg_grade,
        "total_submissions": total_submissions,
        "certificates_issued": certificates_issued,
        "recent_submissions": recent_submissions,
        "module_stats": module_stats[:5],
    }


@router.get("/students")
async def list_students(
    page: int = 1,
    limit: int = 20,
    college_id: Optional[str] = None,
    search: Optional[str] = None,
):
    import re

    query_filters = {}
    if college_id:
        query_filters["college_id"] = college_id
    if search:
        query_filters["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"mobile": {"$regex": search, "$options": "i"}},
            {"roll_number": {"$regex": search, "$options": "i"}},
        ]

    total = await Student.find(query_filters).count()
    students = await Student.find(query_filters).skip((page - 1) * limit).limit(limit).to_list()

    result = []
    for s in students:
        college_name = ""
        if s.college_id:
            try:
                from beanie import PydanticObjectId
                college = await College.get(PydanticObjectId(s.college_id))
                if college:
                    college_name = college.name
            except Exception:
                pass

        grade_obj = await Grade.find_one(Grade.student_id == str(s.id))

        # Calculate progress
        enrollments = await Enrollment.find(Enrollment.student_id == str(s.id)).to_list()
        total_progress = 0
        total_modules = 0
        for enr in enrollments:
            try:
                course = await Course.get(PydanticObjectId(enr.course_id))
                if course:
                    total_modules += len(course.modules)
            except Exception:
                pass
            completed = await Progress.find(
                Progress.enrollment_id == str(enr.id),
                Progress.completed == True,
            ).count()
            total_progress += completed

        progress_pct = round((total_progress / total_modules * 100) if total_modules > 0 else 0)

        result.append({
            "id": str(s.id),
            "name": s.name,
            "mobile": s.mobile,
            "email": s.email,
            "college_name": college_name,
            "course_name": s.course_name,
            "semester": s.semester,
            "roll_number": s.roll_number,
            "reg_number": s.reg_number,
            "grade": grade_obj.grade if grade_obj else "N/A",
            "total_score": grade_obj.total_score if grade_obj else 0,
            "progress": progress_pct,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })

    return {"total": total, "page": page, "limit": limit, "students": result}


@router.delete("/students/{student_id}")
async def delete_student(student_id: str):
    """Delete a student and all related records (progress, enrollments, assignments, quizzes, grades, certificates, feedback)."""
    from beanie import PydanticObjectId

    try:
        sid_obj = PydanticObjectId(student_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid student id")

    student = await Student.get(sid_obj)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    sid = str(student.id)
    deleted = {}

    # Student related docs
    feedbacks = await Feedback.find(Feedback.student_id == sid).to_list()
    for f in feedbacks:
        await f.delete()
    deleted["feedback"] = len(feedbacks)

    certificates = await Certificate.find(Certificate.student_id == sid).to_list()
    for c in certificates:
        await c.delete()
    deleted["certificates"] = len(certificates)

    quiz_attempts = await QuizAttempt.find(QuizAttempt.student_id == sid).to_list()
    for qa in quiz_attempts:
        await qa.delete()
    deleted["quiz_attempts"] = len(quiz_attempts)

    grades = await Grade.find(Grade.student_id == sid).to_list()
    for g in grades:
        await g.delete()
    deleted["grades"] = len(grades)

    assignments = await Assignment.find(Assignment.student_id == sid).to_list()
    for a in assignments:
        await a.delete()
    deleted["assignments"] = len(assignments)

    progress_items = await Progress.find(Progress.student_id == sid).to_list()
    for p in progress_items:
        await p.delete()
    deleted["progress"] = len(progress_items)

    enrollments = await Enrollment.find(Enrollment.student_id == sid).to_list()
    for e in enrollments:
        await e.delete()
    deleted["enrollments"] = len(enrollments)

    await student.delete()

    return {
        "message": "Student deleted",
        "student_id": sid,
        "deleted": deleted,
    }


@router.get("/colleges")
async def list_colleges():
    colleges = await College.find().to_list()
    result = []
    for c in colleges:
        student_count = await Student.find(Student.college_id == str(c.id)).count()
        uni = None
        if c.university_id:
            try:
                from beanie import PydanticObjectId
                uni = await University.get(PydanticObjectId(c.university_id))
            except Exception:
                pass
        result.append({
            "id": str(c.id),
            "name": c.name,
            "code": c.code,
            "city": c.city,
            "university_id": c.university_id,
            "university_name": uni.name if uni else None,
            "university_state": uni.state if uni else None,
            "student_count": student_count,
            "logo_url": c.logo_url,
        })
    return result


@router.get("/universities")
async def list_universities():
    universities = await University.find().to_list()
    result = []
    for u in universities:
        college_count = await College.find(College.university_id == str(u.id)).count()
        result.append({
            "id": str(u.id),
            "name": u.name,
            "code": u.code,
            "state": u.state,
            "college_count": college_count,
        })
    return result


@router.post("/universities")
async def create_university(
    name: str = Form(...),
    code: str = Form(...),
    state: Optional[str] = Form(None),
):
    uni = University(name=name, code=code, state=state)
    await uni.insert()
    return {"id": str(uni.id), "name": uni.name, "code": uni.code}


@router.post("/colleges")
async def create_college(
    name: str = Form(...),
    code: str = Form(...),
    university_id: str = Form(...),
    city: Optional[str] = Form(None),
):
    college = College(name=name, code=code, university_id=university_id, city=city)
    await college.insert()
    return {"id": str(college.id), "name": college.name, "code": college.code}


@router.post("/courses")
async def create_course(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    total_hours: int = Form(120),
):
    course = Course(title=title, description=description, total_hours=total_hours)
    await course.insert()
    return {"id": str(course.id), "title": course.title}


@router.post("/modules")
async def create_module(
    course_id: str = Form(...),
    title: str = Form(...),
    order_index: int = Form(...),
    module_type: Optional[str] = Form(None),
    section_type: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    is_mandatory: bool = Form(True),
):
    from beanie import PydanticObjectId
    course = await Course.get(PydanticObjectId(course_id))
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    module_id = str(uuid.uuid4())[:8]
    module = Module(
        id=module_id,
        title=title,
        order_index=order_index,
        module_type=module_type,
        section_type=section_type,
        description=description,
        is_mandatory=is_mandatory,
        visibility_mode="all",
        visible_college_ids=[],
        visible_student_ids=[],
    )
    course.modules.append(module)
    await course.save()
    return {"id": module_id, "title": title, "section_type": section_type, "order_index": order_index}


@router.patch("/modules/{module_id}/section-type")
async def update_module_section_type(module_id: str, data: dict):
    """Update the section_type of a module (video | study | assignment | quiz)."""
    section_type = data.get("section_type")
    if section_type not in ("video", "study", "assignment", "quiz", None):
        raise HTTPException(status_code=400, detail="section_type must be one of: video, study, assignment, quiz")

    courses = await Course.find().to_list()
    for c in courses:
        for idx, m in enumerate(c.modules):
            if m.id == module_id:
                c.modules[idx].section_type = section_type
                await c.save()
                return {"module_id": module_id, "section_type": section_type}
    raise HTTPException(status_code=404, detail="Module not found")


@router.patch("/modules/{module_id}")
async def update_module(module_id: str, data: dict):
    """Update module metadata (title/description/order/type/section/quiz)."""
    from beanie import PydanticObjectId

    courses = await Course.find().to_list()
    for c in courses:
        for idx, m in enumerate(c.modules):
            if m.id != module_id:
                continue

            if "title" in data and data.get("title") is not None:
                c.modules[idx].title = str(data.get("title")).strip()
            if "description" in data:
                c.modules[idx].description = data.get("description")
            if "order_index" in data and data.get("order_index") is not None:
                try:
                    c.modules[idx].order_index = int(data.get("order_index"))
                except Exception:
                    raise HTTPException(status_code=400, detail="order_index must be an integer")
            if "module_type" in data:
                c.modules[idx].module_type = data.get("module_type")
            if "section_type" in data:
                c.modules[idx].section_type = data.get("section_type")
            linked_quiz_id = None
            if "quiz_id" in data:
                qid = data.get("quiz_id")
                linked_quiz_id = str(qid).strip() if qid else None
                c.modules[idx].quiz_id = linked_quiz_id
            if "is_mandatory" in data and data.get("is_mandatory") is not None:
                c.modules[idx].is_mandatory = bool(data.get("is_mandatory"))
            if "visibility_mode" in data and data.get("visibility_mode") is not None:
                c.modules[idx].visibility_mode = str(data.get("visibility_mode"))
            if "visible_college_ids" in data and data.get("visible_college_ids") is not None:
                c.modules[idx].visible_college_ids = [str(x) for x in (data.get("visible_college_ids") or [])]
            if "visible_student_ids" in data and data.get("visible_student_ids") is not None:
                c.modules[idx].visible_student_ids = [str(x) for x in (data.get("visible_student_ids") or [])]

            await c.save()

            # Keep Quiz document in sync and ensure only one module references this quiz.
            if "quiz_id" in data and linked_quiz_id:
                all_courses = await Course.find().to_list()
                for oc in all_courses:
                    dirty = False
                    for j, om in enumerate(oc.modules):
                        if om.id == module_id:
                            continue
                        if om.quiz_id == linked_quiz_id:
                            oc.modules[j].quiz_id = None
                            dirty = True
                    if dirty:
                        await oc.save()
                try:
                    quiz = await Quiz.get(PydanticObjectId(linked_quiz_id))
                    if quiz:
                        quiz.module_id = module_id
                        quiz.course_id = str(c.id)
                        await quiz.save()
                except Exception:
                    pass

            return {
                "module_id": module_id,
                "title": c.modules[idx].title,
                "description": c.modules[idx].description,
                "order_index": c.modules[idx].order_index,
                "module_type": c.modules[idx].module_type,
                "section_type": c.modules[idx].section_type,
                "quiz_id": c.modules[idx].quiz_id,
                "is_mandatory": c.modules[idx].is_mandatory,
                "visibility_mode": getattr(c.modules[idx], "visibility_mode", "all"),
                "visible_college_ids": getattr(c.modules[idx], "visible_college_ids", []),
                "visible_student_ids": getattr(c.modules[idx], "visible_student_ids", []),
            }
    raise HTTPException(status_code=404, detail="Module not found")


@router.patch("/modules/{module_id}/contents/{content_id}")
async def update_module_content(module_id: str, content_id: str, data: dict):
    """Update a specific content item inside a module."""
    courses = await Course.find().to_list()
    for c in courses:
        for m_idx, m in enumerate(c.modules):
            if m.id != module_id:
                continue
            for ct_idx, ct in enumerate(c.modules[m_idx].contents):
                if ct.id != content_id:
                    continue

                if "title" in data and data.get("title") is not None:
                    c.modules[m_idx].contents[ct_idx].title = str(data.get("title")).strip()
                if "content_type" in data and data.get("content_type") is not None:
                    c.modules[m_idx].contents[ct_idx].content_type = str(data.get("content_type")).strip()
                if "content_url" in data:
                    c.modules[m_idx].contents[ct_idx].content_url = data.get("content_url")
                if "content_text" in data:
                    c.modules[m_idx].contents[ct_idx].content_text = data.get("content_text")
                if "duration_minutes" in data and data.get("duration_minutes") is not None:
                    try:
                        c.modules[m_idx].contents[ct_idx].duration_minutes = int(data.get("duration_minutes"))
                    except Exception:
                        raise HTTPException(status_code=400, detail="duration_minutes must be an integer")
                if "order_index" in data and data.get("order_index") is not None:
                    try:
                        c.modules[m_idx].contents[ct_idx].order_index = int(data.get("order_index"))
                    except Exception:
                        raise HTTPException(status_code=400, detail="order_index must be an integer")
                if "is_mandatory" in data and data.get("is_mandatory") is not None:
                    c.modules[m_idx].contents[ct_idx].is_mandatory = bool(data.get("is_mandatory"))
                if "visibility_mode" in data and data.get("visibility_mode") is not None:
                    c.modules[m_idx].contents[ct_idx].visibility_mode = str(data.get("visibility_mode"))
                if "visible_college_ids" in data and data.get("visible_college_ids") is not None:
                    c.modules[m_idx].contents[ct_idx].visible_college_ids = [str(x) for x in (data.get("visible_college_ids") or [])]
                if "visible_student_ids" in data and data.get("visible_student_ids") is not None:
                    c.modules[m_idx].contents[ct_idx].visible_student_ids = [str(x) for x in (data.get("visible_student_ids") or [])]

                await c.save()
                updated = c.modules[m_idx].contents[ct_idx]
                return {
                    "module_id": module_id,
                    "content_id": content_id,
                    "title": updated.title,
                    "content_type": updated.content_type,
                    "content_url": updated.content_url,
                    "content_text": updated.content_text,
                    "duration_minutes": updated.duration_minutes,
                    "order_index": updated.order_index,
                    "is_mandatory": updated.is_mandatory,
                    "visibility_mode": getattr(updated, "visibility_mode", "all"),
                    "visible_college_ids": getattr(updated, "visible_college_ids", []),
                    "visible_student_ids": getattr(updated, "visible_student_ids", []),
                }
            raise HTTPException(status_code=404, detail="Content not found")
    raise HTTPException(status_code=404, detail="Module not found")


@router.delete("/modules/{module_id}")
async def delete_module(module_id: str):
    """Delete a module from its course."""
    courses = await Course.find().to_list()
    for c in courses:
        for idx, m in enumerate(c.modules):
            if m.id == module_id:
                removed_title = m.title
                c.modules.pop(idx)
                await c.save()
                return {"message": "Module deleted", "module_id": module_id, "title": removed_title}
    raise HTTPException(status_code=404, detail="Module not found")


@router.delete("/modules/{module_id}/contents/{content_id}")
async def delete_module_content(module_id: str, content_id: str):
    """Delete a specific content item from a module."""
    courses = await Course.find().to_list()
    for c in courses:
        for m_idx, m in enumerate(c.modules):
            if m.id != module_id:
                continue
            for ct_idx, ct in enumerate(c.modules[m_idx].contents):
                if ct.id != content_id:
                    continue
                removed_title = ct.title
                c.modules[m_idx].contents.pop(ct_idx)
                await c.save()
                return {
                    "message": "Content deleted",
                    "module_id": module_id,
                    "content_id": content_id,
                    "title": removed_title,
                }
            raise HTTPException(status_code=404, detail="Content not found")
    raise HTTPException(status_code=404, detail="Module not found")


@router.post("/content")
async def create_content(
    module_id: str = Form(...),
    title: str = Form(...),
    content_type: str = Form(...),
    content_url: Optional[str] = Form(None),
    content_text: Optional[str] = Form(None),
    duration_minutes: int = Form(0),
    order_index: int = Form(0),
    file: Optional[UploadFile] = File(None),
):
    # Find the course containing this module
    courses = await Course.find().to_list()
    target_course = None
    target_module_idx = None
    for c in courses:
        for idx, m in enumerate(c.modules):
            if m.id == module_id:
                target_course = c
                target_module_idx = idx
                break
        if target_course:
            break

    if not target_course:
        raise HTTPException(status_code=404, detail="Module not found")

    # If admin uploads a file, store in R2 or local disk.
    final_content_url = content_url
    if file is not None:
        from app.services.r2_storage import is_r2_enabled, upload_file as r2_upload

        file_bytes = await file.read()

        if is_r2_enabled():
            final_content_url = await r2_upload(
                file_contents=file_bytes,
                original_filename=file.filename or "upload",
                prefix="content",
                content_type=file.content_type,
            )
        else:
            os.makedirs(os.path.join(settings.UPLOAD_DIR, "content"), exist_ok=True)
            ext = os.path.splitext(file.filename or "")[1] or ""
            safe_name = f"{module_id}_{str(uuid.uuid4())[:8]}{ext}"
            abs_path = os.path.join(settings.UPLOAD_DIR, "content", safe_name)
            with open(abs_path, "wb") as f:
                f.write(file_bytes)
            final_content_url = f"/uploads/content/{safe_name}"

    content_id = str(uuid.uuid4())[:8]
    content = ModuleContent(
        id=content_id,
        title=title,
        content_type=content_type,
        content_url=final_content_url,
        content_text=content_text,
        duration_minutes=duration_minutes,
        order_index=order_index,
        visibility_mode="all",
        visible_college_ids=[],
        visible_student_ids=[],
    )
    target_course.modules[target_module_idx].contents.append(content)
    await target_course.save()
    return {"id": content_id, "title": title}


@router.post("/content/presign-upload")
async def presign_content_upload(data: dict):
    """
    Create a presigned upload URL so browser uploads directly to R2.
    This is much faster for large videos than proxying through backend.
    """
    from app.services.r2_storage import (
        is_r2_enabled,
        _safe_key,
        generate_presigned_put_url,
    )

    if not is_r2_enabled():
        raise HTTPException(status_code=400, detail="R2 is not configured")

    filename = str(data.get("filename") or "").strip()
    content_type = str(data.get("content_type") or "").strip() or None
    prefix = str(data.get("prefix") or "content").strip() or "content"
    if not filename:
        raise HTTPException(status_code=400, detail="filename is required")

    key = _safe_key(filename, prefix=prefix)
    try:
        upload_url = await generate_presigned_put_url(
            key=key,
            content_type=content_type,
            expires_in=3600,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate upload URL: {exc}")

    if settings.R2_PUBLIC_URL:
        public_url = f"{settings.R2_PUBLIC_URL.rstrip('/')}/{key}"
    else:
        public_url = f"{settings.R2_ENDPOINT_URL.rstrip('/')}/{settings.R2_BUCKET_NAME}/{key}"

    return {
        "key": key,
        "upload_url": upload_url,
        "public_url": public_url,
    }


@router.get("/quizzes")
async def list_quizzes():
    """List all quizzes for admin management."""
    quizzes = await Quiz.find().to_list()
    result = []
    for q in quizzes:
        total_attempts = await QuizAttempt.find(
            QuizAttempt.quiz_id == str(q.id),
            QuizAttempt.status == "completed",
        ).count()

        # Average score
        attempts = await QuizAttempt.find(
            QuizAttempt.quiz_id == str(q.id),
            QuizAttempt.status == "completed",
        ).to_list()
        avg_score = round(sum(a.percentage for a in attempts) / len(attempts)) if attempts else 0

        result.append({
            "id": str(q.id),
            "title": q.title,
            "description": q.description,
            "module_id": q.module_id,
            "course_id": q.course_id,
            "status": q.status,
            "total_questions": len(q.questions),
            "total_attempts": total_attempts,
            "avg_score": avg_score,
            "time_limit_minutes": q.time_limit_minutes,
            "created_at": q.created_at.isoformat() if q.created_at else None,
        })
    return result


@router.post("/quizzes")
async def create_quiz(data: dict):
    """Create a new quiz from admin panel."""
    from app.models.quiz import QuizQuestion

    title = data.get("title", "")
    module_id = data.get("module_id", "")
    course_id = data.get("course_id", "")
    time_limit = data.get("time_limit_minutes", 30)
    questions_data = data.get("questions", [])

    if not title:
        raise HTTPException(status_code=400, detail="Quiz title required")

    questions = []
    total_marks = 0
    for i, qd in enumerate(questions_data):
        q_id = str(uuid.uuid4())[:8]
        q = QuizQuestion(
            id=q_id,
            question_text=qd.get("prompt", ""),
            option_a=qd.get("options", ["", "", "", ""])[0],
            option_b=qd.get("options", ["", "", "", ""])[1],
            option_c=qd.get("options", ["", "", "", ""])[2],
            option_d=qd.get("options", ["", "", "", ""])[3],
            correct_option=["a", "b", "c", "d"][qd.get("correct", 0)],
            marks=qd.get("marks", 10),
        )
        questions.append(q)
        total_marks += q.marks

    quiz = Quiz(
        module_id=module_id,
        course_id=course_id,
        title=title,
        time_limit_minutes=time_limit,
        total_marks=total_marks or len(questions) * 10,
        questions=questions,
        status="active",
    )
    await quiz.insert()

    # Link the created quiz back to the corresponding module so students can discover it.
    from beanie import PydanticObjectId
    try:
        course_doc = await Course.get(PydanticObjectId(course_id))
        if course_doc:
            for m in course_doc.modules:
                if m.id == module_id:
                    m.quiz_id = str(quiz.id)
                    break
            await course_doc.save()
    except Exception:
        # If linking fails, still return the created quiz.
        pass

    return {"id": str(quiz.id), "title": quiz.title, "total_questions": len(questions)}


@router.get("/quizzes/{quiz_id}")
async def get_quiz_admin(quiz_id: str):
    """Fetch quiz + questions for admin preview."""
    from beanie import PydanticObjectId
    try:
        quiz = await Quiz.get(PydanticObjectId(quiz_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    correct_map = ["a", "b", "c", "d"]
    questions = [
        {
            "id": q.id,
            "prompt": q.question_text,
            "options": [q.option_a, q.option_b, q.option_c, q.option_d],
            "correct": (correct_map.index(q.correct_option) if q.correct_option in correct_map else 0),
            "marks": q.marks,
            "explanation": q.explanation,
        }
        for q in quiz.questions
    ]

    return {
        "id": str(quiz.id),
        "title": quiz.title,
        "description": quiz.description,
        "module_id": quiz.module_id,
        "course_id": quiz.course_id,
        "status": quiz.status,
        "time_limit_minutes": quiz.time_limit_minutes,
        "total_marks": quiz.total_marks,
        "max_attempts": quiz.max_attempts,
        "questions": questions,
    }


@router.patch("/quizzes/{quiz_id}")
async def update_quiz_admin(quiz_id: str, data: dict):
    """
    Update an existing quiz (questions + metadata) and keep the quiz linked to the chosen module.
    Also refreshes total_marks based on question marks.
    """
    from beanie import PydanticObjectId
    from app.models.quiz import QuizQuestion

    try:
        quiz = await Quiz.get(PydanticObjectId(quiz_id))
    except Exception:
        quiz = None

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    title = (data.get("title") or "").strip()
    module_id = (data.get("module_id") or "").strip() or quiz.module_id
    course_id = (data.get("course_id") or "").strip() or quiz.course_id
    time_limit = data.get("time_limit_minutes", quiz.time_limit_minutes)
    questions_data = data.get("questions") or []

    if not title:
        raise HTTPException(status_code=400, detail="Quiz title required")
    if not module_id or not course_id:
        raise HTTPException(status_code=400, detail="module_id and course_id are required")
    if not questions_data:
        raise HTTPException(status_code=400, detail="At least one question is required")

    questions = []
    total_marks = 0
    for qd in questions_data:
        q_id = str(uuid.uuid4())[:8]
        options = qd.get("options") or ['', '', '', '']
        if not isinstance(options, list):
            options = ['', '', '', '']
        # Ensure length 4
        if len(options) < 4:
            options = list(options) + [''] * (4 - len(options))
        options = options[:4]
        # NOTE: `correct` is the selected option index: 0,1,2,3
        correct_idx = qd.get("correct", 0)
        try:
            correct_idx = int(correct_idx)
        except Exception:
            correct_idx = 0
        correct_letter = ["a", "b", "c", "d"][correct_idx] if 0 <= correct_idx < 4 else "a"

        q = QuizQuestion(
            id=q_id,
            question_text=(qd.get("prompt") or "").strip(),
            option_a=(options[0] or ''),
            option_b=(options[1] or ''),
            option_c=(options[2] or ''),
            option_d=(options[3] or ''),
            correct_option=correct_letter,
            marks=int(qd.get("marks") or 10),
            explanation=(qd.get("explanation") or None),
        )
        questions.append(q)
        total_marks += q.marks

    # Update quiz doc
    quiz.title = title
    quiz.module_id = module_id
    quiz.course_id = course_id
    quiz.time_limit_minutes = int(time_limit) if time_limit is not None else quiz.time_limit_minutes
    quiz.total_marks = int(total_marks) if total_marks else len(questions) * 10
    quiz.questions = questions
    quiz.status = data.get("status") or quiz.status or "active"
    await quiz.save()

    # Unlink this quiz id from any module in all courses
    courses = await Course.find().to_list()
    for c in courses:
        modified = False
        for m in c.modules:
            if getattr(m, "quiz_id", None) == str(quiz.id):
                m.quiz_id = None
                modified = True
        if modified:
            await c.save()

    # Link quiz to the updated module
    try:
        course_doc = await Course.get(PydanticObjectId(course_id))
        if course_doc:
            for m in course_doc.modules:
                if m.id == module_id:
                    m.quiz_id = str(quiz.id)
                    break
            await course_doc.save()
    except Exception:
        pass

    return {"message": "Quiz updated", "quiz_id": str(quiz.id)}


@router.delete("/quizzes/{quiz_id}")
async def delete_quiz_admin(quiz_id: str):
    """Delete quiz, unlink it from module, and remove all quiz attempts + grades derived from that quiz."""
    from beanie import PydanticObjectId

    try:
        quiz = await Quiz.get(PydanticObjectId(quiz_id))
    except Exception:
        quiz = None

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    qid = str(quiz.id)
    course_id = str(quiz.course_id)

    # Delete all quiz attempts (removes quiz marks history)
    quiz_attempts = await QuizAttempt.find(QuizAttempt.quiz_id == qid).to_list()
    for qa in quiz_attempts:
        await qa.delete()

    # Delete stored grades for this course so dashboards re-compute correctly
    grades = await Grade.find(Grade.course_id == course_id).to_list()
    for g in grades:
        await g.delete()

    # Unlink from module
    courses = await Course.find().to_list()
    for c in courses:
        modified = False
        for m in c.modules:
            if getattr(m, "quiz_id", None) == qid:
                m.quiz_id = None
                modified = True
        if modified:
            await c.save()

    await quiz.delete()

    return {"message": "Quiz deleted", "quiz_id": qid}


# ────────────────────────────────────────
# Assignment management endpoints
# ────────────────────────────────────────

@router.get("/assignments")
async def list_assignments(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    module_id: Optional[str] = None,
):
    """Return all submitted assignment rows (all modules, all students)."""
    from beanie import PydanticObjectId

    status_filter_norm = status_filter.lower() if status_filter else None
    query_filters = {}
    if module_id:
        query_filters["module_id"] = module_id
    if status_filter_norm and status_filter_norm != "all":
        query_filters["status"] = status_filter_norm

    total = await Assignment.find(query_filters).count()
    submissions = (
        await Assignment.find(query_filters)
        .sort("-submitted_at")
        .skip((page - 1) * limit)
        .limit(limit)
        .to_list()
    )

    all_sections = await AssignmentSection.find().to_list()
    section_map = {s.module_id: s for s in all_sections}
    student_cache = {}
    college_cache = {}

    results = []
    for a in submissions:
        student = student_cache.get(a.student_id)
        if student is None:
            try:
                student = await Student.get(PydanticObjectId(a.student_id))
            except Exception:
                student = None
            student_cache[a.student_id] = student

        if search and student:
            sterm = search.lower()
            if (
                sterm not in (student.name or "").lower()
                and sterm not in (student.mobile or "").lower()
                and sterm not in (student.roll_number or "").lower()
                and sterm not in (student.reg_number or "").lower()
            ):
                continue

        section = section_map.get(a.module_id)
        assignment_name = (section.title if section and section.title else a.title) or f"Module {a.module_id}"

        college_name = ""
        if student and student.college_id:
            college_name = college_cache.get(student.college_id, "")
            if not college_name:
                try:
                    college = await College.get(PydanticObjectId(student.college_id))
                    college_name = college.name if college else ""
                except Exception:
                    college_name = ""
                college_cache[student.college_id] = college_name

        results.append(
            {
                "id": str(a.id),
                "student_id": a.student_id,
                "student_name": student.name if student else "Unknown",
                "student_reg": (student.reg_number or student.roll_number or "") if student else "",
                "college_name": college_name,
                "module_id": a.module_id,
                "module_title": section.title if section else f"Module {a.module_id}",
                "assignment_name": assignment_name,
                "title": a.title,
                "file_url": a.file_url,
                "file_name": a.file_name,
                "status": a.status,
                "marks": a.marks,
                "max_marks": a.max_marks,
                "feedback": a.feedback,
                "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
                "graded_at": a.graded_at.isoformat() if a.graded_at else None,
            }
        )

    if search:
        total = len(results)
        results = results[:limit]

    return {"total": total, "page": page, "limit": limit, "submissions": results}



@router.put("/assignments/{assignment_id}/grade")
async def admin_grade_assignment(
    assignment_id: str,
    data: dict,
):
    """Grade or review a student assignment."""
    from beanie import PydanticObjectId

    try:
        assignment = await Assignment.get(PydanticObjectId(assignment_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    marks = data.get("marks")
    feedback = data.get("feedback")

    if marks is not None:
        assignment.marks = int(marks)
        assignment.status = "graded"
        assignment.graded_at = datetime.utcnow()

    if feedback is not None:
        assignment.feedback = feedback

    if marks is None and feedback:
        assignment.status = "reviewed"

    await assignment.save()
    return {"message": "Assignment updated", "id": str(assignment.id), "marks": assignment.marks, "status": assignment.status}


@router.get("/assignment-sections")
async def list_assignment_sections():
    """List all assignment section definitions."""
    sections = await AssignmentSection.find().to_list()

    # Count submissions per module
    results = []
    for s in sections:
        total_subs = await Assignment.find(Assignment.module_id == s.module_id).count()
        graded_subs = await Assignment.find(
            Assignment.module_id == s.module_id,
            Assignment.status == "graded",
        ).count()
        pending_subs = await Assignment.find(
            Assignment.module_id == s.module_id,
            Assignment.status == "submitted",
        ).count()

        results.append({
            "id": str(s.id),
            "module_id": s.module_id,
            "title": s.title,
            "description": s.description,
            "weight": s.weight,
            "max_marks": s.max_marks,
            "due_date": s.due_date,
            "due_days": s.due_days,
            "color": s.color,
            "locked_until": s.locked_until,
            "submission_guidelines": s.submission_guidelines,
            "accepted_formats": s.accepted_formats,
            "questions_pdf_url": getattr(s, "questions_pdf_url", None),
            "questions_pdf_name": getattr(s, "questions_pdf_name", None),
            "total_submissions": total_subs,
            "graded_submissions": graded_subs,
            "pending_submissions": pending_subs,
        })

    return results


@router.post("/assignment-sections")
async def create_assignment_section(data: dict):
    """Create a new assignment section (template)."""
    title = data.get("title", "")
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")

    module_id = data.get("module_id", str(uuid.uuid4())[:8])

    section = AssignmentSection(
        module_id=module_id,
        title=title,
        description=data.get("description"),
        weight=data.get("weight", 0),
        max_marks=data.get("max_marks", 100),
        due_date=data.get("due_date"),
        due_days=data.get("due_days"),
        color=data.get("color"),
        locked_until=data.get("locked_until"),
        submission_guidelines=data.get("submission_guidelines"),
        accepted_formats=data.get("accepted_formats"),
        questions_pdf_url=data.get("questions_pdf_url"),
        questions_pdf_name=data.get("questions_pdf_name"),
    )
    await section.insert()

    return {
        "id": str(section.id),
        "module_id": section.module_id,
        "title": section.title,
    }


@router.patch("/assignment-sections/{section_id}")
async def update_assignment_section(section_id: str, data: dict):
    """Update assignment section (template) metadata."""
    from beanie import PydanticObjectId

    try:
        section = await AssignmentSection.get(PydanticObjectId(section_id))
    except Exception:
        section = None
    if not section:
        raise HTTPException(status_code=404, detail="Assignment section not found")

    if "title" in data and data.get("title") is not None:
        t = str(data.get("title") or "").strip()
        if not t:
            raise HTTPException(status_code=400, detail="Title cannot be empty")
        section.title = t
    if "description" in data:
        section.description = data.get("description")
    if "module_id" in data and data.get("module_id") is not None:
        section.module_id = str(data.get("module_id")).strip()
    if "weight" in data and data.get("weight") is not None:
        try:
            section.weight = int(data.get("weight"))
        except Exception:
            raise HTTPException(status_code=400, detail="weight must be an integer")
    if "max_marks" in data and data.get("max_marks") is not None:
        try:
            section.max_marks = int(data.get("max_marks"))
        except Exception:
            raise HTTPException(status_code=400, detail="max_marks must be an integer")
    if "due_date" in data:
        section.due_date = data.get("due_date")
    if "due_days" in data:
        v = data.get("due_days")
        section.due_days = int(v) if v is not None and v != "" else None
    if "color" in data:
        section.color = data.get("color")
    if "locked_until" in data:
        section.locked_until = data.get("locked_until")
    if "submission_guidelines" in data:
        section.submission_guidelines = data.get("submission_guidelines")
    if "accepted_formats" in data:
        section.accepted_formats = data.get("accepted_formats")
    if "questions_pdf_url" in data:
        nv = data.get("questions_pdf_url")
        if nv is None and (section.questions_pdf_url or ""):
            qurl = section.questions_pdf_url or ""
            if "/assignment_questions/" in qurl:
                fn = os.path.basename(qurl)
                disk_path = os.path.join(settings.UPLOAD_DIR, "assignment_questions", fn)
                try:
                    if os.path.isfile(disk_path):
                        os.remove(disk_path)
                except Exception:
                    pass
        section.questions_pdf_url = nv
    if "questions_pdf_name" in data:
        section.questions_pdf_name = data.get("questions_pdf_name")

    await section.save()
    return {
        "id": str(section.id),
        "module_id": section.module_id,
        "title": section.title,
        "questions_pdf_url": section.questions_pdf_url,
        "questions_pdf_name": section.questions_pdf_name,
    }


@router.post("/assignment-sections/{section_id}/questions-pdf")
async def upload_assignment_section_questions_pdf(section_id: str, file: UploadFile = File(...)):
    """Attach or replace optional questions PDF for an assignment section."""
    from beanie import PydanticObjectId

    try:
        section = await AssignmentSection.get(PydanticObjectId(section_id))
    except Exception:
        section = None
    if not section:
        raise HTTPException(status_code=404, detail="Assignment section not found")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    old_url = getattr(section, "questions_pdf_url", None) or ""
    if "/assignment_questions/" in old_url:
        fn_old = os.path.basename(old_url)
        old_path = os.path.join(settings.UPLOAD_DIR, "assignment_questions", fn_old)
        try:
            if os.path.isfile(old_path):
                os.remove(old_path)
        except Exception:
            pass

    upload_dir = os.path.join(settings.UPLOAD_DIR, "assignment_questions")
    os.makedirs(upload_dir, exist_ok=True)
    safe = f"{section_id}_{file.filename or 'questions.pdf'}"
    dest = os.path.join(upload_dir, safe)
    contents = await file.read()
    with open(dest, "wb") as f:
        f.write(contents)

    section.questions_pdf_url = f"/uploads/assignment_questions/{safe}"
    section.questions_pdf_name = file.filename or "questions.pdf"
    await section.save()

    return {
        "questions_pdf_url": section.questions_pdf_url,
        "questions_pdf_name": section.questions_pdf_name,
    }


@router.delete("/assignment-sections/{section_id}")
async def delete_assignment_section(section_id: str):
    """Delete an assignment section template (does not delete student submissions)."""
    from beanie import PydanticObjectId

    try:
        section = await AssignmentSection.get(PydanticObjectId(section_id))
    except Exception:
        section = None
    if not section:
        raise HTTPException(status_code=404, detail="Assignment section not found")

    qurl = getattr(section, "questions_pdf_url", None) or ""
    if "/assignment_questions/" in qurl:
        fn = os.path.basename(qurl)
        disk_path = os.path.join(settings.UPLOAD_DIR, "assignment_questions", fn)
        try:
            if os.path.isfile(disk_path):
                os.remove(disk_path)
        except Exception:
            pass

    await section.delete()
    return {"message": "Assignment section deleted", "id": section_id}


@router.get("/assignments/stats")
async def assignment_stats():
    """Aggregate assignment statistics for the admin dashboard banner."""
    total_submissions = await Assignment.find().count()
    pending_review = await Assignment.find(Assignment.status == "submitted").count()
    graded = await Assignment.find(Assignment.status == "graded").count()

    # Avg marks of graded assignments
    graded_assignments = await Assignment.find(Assignment.status == "graded").to_list()
    avg_marks = (
        round(sum(a.marks for a in graded_assignments if a.marks is not None) / len(graded_assignments), 1)
        if graded_assignments
        else 0
    )

    # Upcoming deadline from assignment sections
    sections = await AssignmentSection.find().to_list()
    upcoming = None
    for s in sorted(sections, key=lambda x: x.due_date or "9999"):
        if s.due_date:
            upcoming = {"module_id": s.module_id, "title": s.title, "due_date": s.due_date, "color": s.color}
            break

    return {
        "total_submissions": total_submissions,
        "pending_review": pending_review,
        "graded": graded,
        "avg_performance": avg_marks,
        "upcoming_deadline": upcoming,
    }

