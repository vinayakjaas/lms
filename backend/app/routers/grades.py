from fastapi import APIRouter, Depends, HTTPException
from beanie import PydanticObjectId
from app.models.user import Student
from app.models.course import Course, Enrollment, Progress
from app.models.quiz import Quiz, QuizAttempt
from app.models.assignment import Assignment
from app.models.grade import Grade
from app.utils.security import get_current_student

router = APIRouter(prefix="/api/grades", tags=["Grades"])


def _module_phase(m) -> str:
    """Mirror frontend CoursePage getModulePhase for gating."""
    st = (getattr(m, "section_type", None) or "").lower()
    mt = (getattr(m, "module_type", None) or "").lower()
    if st in ("quiz", "assessment"):
        return "quiz"
    if st == "assignment":
        return "assignment"
    if st == "study":
        return "study"
    if st == "video":
        return "video"
    if mt in ("assessment", "quiz") or getattr(m, "quiz_id", None):
        return "quiz"
    if mt == "assignment":
        return "assignment"
    if mt == "feedback":
        return "quiz"
    contents = getattr(m, "contents", None) or []
    has_video = any((getattr(c, "content_type", "") or "").lower() == "video" for c in contents)
    has_pdf = any((getattr(c, "content_type", "") or "").lower() == "pdf" for c in contents)
    if has_pdf and not has_video:
        return "study"
    return "video"


async def course_final_grade_eligible(course: Course, student_id: str, enrollment_id: str) -> tuple[bool, dict]:
    """
    Final letter grade may be shown only when:
    - Every module is marked complete (Progress.completed)
    - Every module with a quiz_id has a completed quiz attempt
    - Every assignment-phase module has a graded assignment for that module_id
    """
    progress_items = await Progress.find(Progress.enrollment_id == enrollment_id).to_list()
    by_mod = {p.module_id: p for p in progress_items}

    modules_total = len(course.modules)
    modules_completed = sum(1 for m in course.modules if by_mod.get(m.id) and by_mod[m.id].completed)
    all_modules_complete = modules_total == 0 or modules_completed == modules_total

    quiz_modules = [m for m in course.modules if getattr(m, "quiz_id", None) and str(m.quiz_id).strip()]
    quiz_done = 0
    for m in quiz_modules:
        qid = str(m.quiz_id).strip()
        n = await QuizAttempt.find(
            QuizAttempt.student_id == student_id,
            QuizAttempt.quiz_id == qid,
            QuizAttempt.status == "completed",
        ).count()
        if n > 0:
            quiz_done += 1
    quizzes_ok = len(quiz_modules) == 0 or quiz_done == len(quiz_modules)

    assign_modules = [m for m in course.modules if _module_phase(m) == "assignment"]
    assign_graded = 0
    for m in assign_modules:
        module_id = str(getattr(m, "id", "")).strip()
        if not module_id:
            continue
        ex = await Assignment.find_one(
            Assignment.student_id == student_id,
            Assignment.module_id == module_id,
            Assignment.status == "graded",
        )
        if ex:
            assign_graded += 1
    assignments_ok = len(assign_modules) == 0 or assign_graded == len(assign_modules)

    eligible = all_modules_complete and quizzes_ok and assignments_ok
    detail = {
        "all_modules_complete": all_modules_complete,
        "modules_completed": modules_completed,
        "modules_total": modules_total,
        "quizzes_completed": quiz_done,
        "quizzes_required": len(quiz_modules),
        "assignments_graded": assign_graded,
        "assignments_required": len(assign_modules),
    }
    return eligible, detail


async def calculate_and_save_grade(student_id: str, course_id: str) -> Grade:
    """Auto-calculate grade based on quiz (30%), assignment (30%), attendance (40%)."""
    course = await Course.get(PydanticObjectId(course_id))
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # 1. Quiz score (30%): find all quizzes for this course's modules
    quiz_scores = []
    for module in course.modules:
        quizzes = await Quiz.find(
            Quiz.module_id == module.id,
            Quiz.course_id == course_id,
        ).to_list()
        for quiz in quizzes:
            best_attempt = await QuizAttempt.find(
                QuizAttempt.student_id == student_id,
                QuizAttempt.quiz_id == str(quiz.id),
                QuizAttempt.status == "completed",
            ).sort("-percentage").first_or_none()
            if best_attempt:
                quiz_scores.append(best_attempt.percentage)

    quiz_avg = sum(quiz_scores) / len(quiz_scores) if quiz_scores else 0

    # 2. Assignment score (30%)
    # Limit to this course's modules to avoid mixing assignments from other courses/sections.
    course_module_ids = {str(getattr(m, "id", "")).strip() for m in course.modules if str(getattr(m, "id", "")).strip()}
    student_assignments = await Assignment.find(
        Assignment.student_id == student_id,
    ).to_list()
    # Treat "has marks" as source of truth for score contribution (safer than status-only filtering).
    scored_assignments_all = [
        a for a in student_assignments
        if a.marks is not None and (a.max_marks or 0) > 0
    ]
    scored_assignments = [
        a for a in scored_assignments_all
        if (str(getattr(a, "module_id", "")).strip() in course_module_ids)
        or (str(getattr(a, "course_id", "")).strip() == str(course_id).strip())
    ]
    # Legacy fallback: old records may have course_id=None and module ids outside course.modules.
    # If strict matching finds none, still include student's graded assignments so marks are reflected.
    if not scored_assignments:
        scored_assignments = scored_assignments_all

    assignment_avg = 0
    if scored_assignments:
        # One score per module: keep the latest scored submission for each module.
        latest_by_module = {}
        for a in scored_assignments:
            key = str(getattr(a, "module_id", "")).strip() or str(getattr(a, "id", "")).strip()
            prev = latest_by_module.get(key)
            if prev is None:
                latest_by_module[key] = a
                continue
            a_ts = getattr(a, "graded_at", None) or getattr(a, "submitted_at", None)
            p_ts = getattr(prev, "graded_at", None) or getattr(prev, "submitted_at", None)
            if a_ts and p_ts and a_ts > p_ts:
                latest_by_module[key] = a
        valid = list(latest_by_module.values())
        if valid:
            assignment_avg = sum((a.marks / a.max_marks * 100) for a in valid) / len(valid)

    # 3. Attendance score (40%): module completion
    enrollment = await Enrollment.find_one(
        Enrollment.student_id == student_id,
        Enrollment.course_id == course_id,
    )

    attendance_score = 0
    if enrollment:
        total_modules = len(course.modules)
        completed = await Progress.find(
            Progress.enrollment_id == str(enrollment.id),
            Progress.completed == True,
        ).count()
        attendance_score = (completed / total_modules * 100) if total_modules > 0 else 0

    # Calculate weighted total
    total = (quiz_avg * 0.30) + (assignment_avg * 0.30) + (attendance_score * 0.40)
    grade_letter = Grade.calculate_grade(total)

    # Save or update grade
    existing = await Grade.find_one(
        Grade.student_id == student_id,
        Grade.course_id == course_id,
    )
    if existing:
        existing.quiz_score = quiz_avg
        existing.assignment_score = assignment_avg
        existing.attendance_score = attendance_score
        existing.total_score = round(total, 2)
        existing.grade = grade_letter
        await existing.save()
        return existing

    grade = Grade(
        student_id=student_id,
        course_id=course_id,
        quiz_score=quiz_avg,
        assignment_score=assignment_avg,
        attendance_score=attendance_score,
        total_score=round(total, 2),
        grade=grade_letter,
    )
    await grade.insert()
    return grade


@router.get("/summary/dashboard")
async def dashboard_grade_summary(student: Student = Depends(get_current_student)):
    """Dashboard: show letter grade only when full course requirements are met; else N/A."""
    sid = str(student.id)
    enrollments = await Enrollment.find(Enrollment.student_id == sid).to_list()
    if not enrollments:
        return {
            "show_final_grade": False,
            "grade": None,
            "total_score": None,
            "course_id": None,
            "course_title": None,
            "checklist": None,
        }

    enrollment = enrollments[0]
    course_id = enrollment.course_id
    course = await Course.get(PydanticObjectId(course_id))
    if not course:
        return {
            "show_final_grade": False,
            "grade": None,
            "total_score": None,
            "course_id": course_id,
            "course_title": None,
            "checklist": None,
        }

    eligible, checklist = await course_final_grade_eligible(course, sid, str(enrollment.id))
    if not eligible:
        return {
            "show_final_grade": False,
            "grade": None,
            "total_score": None,
            "course_id": course_id,
            "course_title": course.title,
            "checklist": checklist,
        }

    g = await calculate_and_save_grade(sid, course_id)
    return {
        "show_final_grade": True,
        "grade": g.grade,
        "total_score": g.total_score,
        "course_id": course_id,
        "course_title": course.title,
        "checklist": checklist,
    }


@router.get("/my")
async def get_my_grades(student: Student = Depends(get_current_student)):
    sid = str(student.id)
    enrollments = await Enrollment.find(Enrollment.student_id == sid).to_list()

    grades = []
    for enrollment in enrollments:
        grade = await calculate_and_save_grade(sid, enrollment.course_id)
        course_title = None
        try:
            c = await Course.get(PydanticObjectId(enrollment.course_id))
            if c:
                course_title = c.title
        except Exception:
            pass
        grades.append({
            "course_id": enrollment.course_id,
            "course_title": course_title,
            "quiz_score": grade.quiz_score,
            "assignment_score": grade.assignment_score,
            "attendance_score": grade.attendance_score,
            "total_score": grade.total_score,
            "grade": grade.grade,
            "quiz_weighted": round(grade.quiz_score * 0.30, 2),
            "assignment_weighted": round(grade.assignment_score * 0.30, 2),
            "attendance_weighted": round(grade.attendance_score * 0.40, 2),
        })
    return grades


@router.get("/my/{course_id}")
async def get_course_grade(course_id: str, student: Student = Depends(get_current_student)):
    grade = await calculate_and_save_grade(str(student.id), course_id)
    return {
        "quiz_score": grade.quiz_score,
        "assignment_score": grade.assignment_score,
        "attendance_score": grade.attendance_score,
        "total_score": grade.total_score,
        "grade": grade.grade,
        "quiz_weighted": round(grade.quiz_score * 0.30, 2),
        "assignment_weighted": round(grade.assignment_score * 0.30, 2),
        "attendance_weighted": round(grade.attendance_score * 0.40, 2),
    }
