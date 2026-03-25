from fastapi import APIRouter, Depends, HTTPException
from datetime import date
from app.models.user import Student, College
from app.models.course import Course, Enrollment, Progress
from app.models.quiz import QuizAttempt
from app.models.assignment import Assignment
from app.models.grade import Grade
from app.models.certificate import Certificate, Feedback
from app.services.certificate_service import generate_certificate_pdf, generate_certificate_id
from app.utils.security import get_current_student
from app.routers.grades import calculate_and_save_grade

router = APIRouter(prefix="/api/certificates", tags=["Certificates"])


async def check_eligibility(student_id: str, course_id: str) -> dict:
    from beanie import PydanticObjectId
    course = await Course.get(PydanticObjectId(course_id))
    if not course:
        return {"is_eligible": False, "modules_completed": False, "assignment_submitted": False,
                "final_test_attempted": False, "feedback_submitted": False}

    enrollment = await Enrollment.find_one(
        Enrollment.student_id == student_id,
        Enrollment.course_id == course_id,
    )
    if not enrollment:
        return {"is_eligible": False, "modules_completed": False, "assignment_submitted": False,
                "final_test_attempted": False, "feedback_submitted": False}

    # 1. Module completion
    total_modules = len(course.modules)
    completed = await Progress.find(
        Progress.enrollment_id == str(enrollment.id),
        Progress.completed == True,
    ).count()
    modules_completed = completed >= total_modules and total_modules > 0

    # 2. Assignment Submitted
    assignment_count = await Assignment.find(
        Assignment.student_id == student_id,
    ).count()
    assignment_submitted = assignment_count > 0

    # 3. Final Test Attempted
    final_test_attempted = False
    from app.models.quiz import Quiz
    for module in course.modules:
        if module.module_type == "assessment":
            quizzes = await Quiz.find(
                Quiz.module_id == module.id,
                Quiz.course_id == course_id,
            ).to_list()
            for quiz in quizzes:
                attempt = await QuizAttempt.find_one(
                    QuizAttempt.student_id == student_id,
                    QuizAttempt.quiz_id == str(quiz.id),
                    QuizAttempt.status == "completed",
                )
                if attempt:
                    final_test_attempted = True
                    break

    # 4. Feedback Submitted
    feedback_count = await Feedback.find(
        Feedback.student_id == student_id,
        Feedback.course_id == course_id,
    ).count()
    feedback_submitted = feedback_count > 0

    is_eligible = all([modules_completed, assignment_submitted, final_test_attempted, feedback_submitted])

    return {
        "is_eligible": is_eligible,
        "modules_completed": modules_completed,
        "assignment_submitted": assignment_submitted,
        "final_test_attempted": final_test_attempted,
        "feedback_submitted": feedback_submitted,
    }


@router.get("/eligibility/{course_id}")
async def get_eligibility(course_id: str, student: Student = Depends(get_current_student)):
    return await check_eligibility(str(student.id), course_id)


@router.post("/generate/{course_id}")
async def generate_certificate(course_id: str, student: Student = Depends(get_current_student)):
    from beanie import PydanticObjectId
    sid = str(student.id)

    # Check if already generated
    existing = await Certificate.find_one(
        Certificate.student_id == sid,
        Certificate.course_id == course_id,
    )
    if existing:
        return {
            "id": str(existing.id),
            "certificate_id": existing.certificate_id,
            "student_name": existing.student_name,
            "college_name": existing.college_name,
            "course_name": existing.course_name,
            "grade": existing.grade,
            "duration": existing.duration,
            "issue_date": existing.issue_date,
            "pdf_url": existing.pdf_url,
            "qr_code_url": existing.qr_code_url,
        }

    # Get grade
    grade = await calculate_and_save_grade(sid, course_id)

    # Get student details
    course = await Course.get(PydanticObjectId(course_id))
    college_name = ""
    if student.college_id:
        try:
            college = await College.get(PydanticObjectId(student.college_id))
            if college:
                college_name = college.name
        except Exception:
            pass

    cert_id = generate_certificate_id()
    today = date.today()

    pdf_url = await generate_certificate_pdf(
        student_name=student.name,
        course_name=course.title,
        semester=student.semester or "N/A",
        college_name=college_name,
        roll_number=student.roll_number or "N/A",
        reg_number=student.reg_number or "N/A",
        internship_title=course.title,
        duration="120 Hours",
        grade=grade.grade,
        certificate_id=cert_id,
        issue_date=today,
    )

    certificate = Certificate(
        student_id=sid,
        course_id=course_id,
        certificate_id=cert_id,
        student_name=student.name,
        college_name=college_name,
        course_name=course.title,
        semester=student.semester,
        roll_number=student.roll_number,
        reg_number=student.reg_number,
        internship_title=course.title,
        duration="120 Hours",
        grade=grade.grade,
        pdf_url=pdf_url,
        qr_code_url=f"/api/certificates/{cert_id}/verify",
        issue_date=today.isoformat(),
    )
    await certificate.insert()

    return {
        "id": str(certificate.id),
        "certificate_id": certificate.certificate_id,
        "student_name": certificate.student_name,
        "college_name": certificate.college_name,
        "course_name": certificate.course_name,
        "grade": certificate.grade,
        "duration": certificate.duration,
        "issue_date": certificate.issue_date,
        "pdf_url": certificate.pdf_url,
        "qr_code_url": certificate.qr_code_url,
    }


@router.get("/{cert_id}/verify")
async def verify_certificate(cert_id: str):
    certificate = await Certificate.find_one(Certificate.certificate_id == cert_id)
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")

    return {
        "valid": True,
        "certificate_id": certificate.certificate_id,
        "student_name": certificate.student_name,
        "college_name": certificate.college_name,
        "course_name": certificate.course_name,
        "grade": certificate.grade,
        "duration": certificate.duration,
        "issue_date": certificate.issue_date,
        "issued_by": "TADRI & AIC Bihar Vidyapeet",
    }


@router.get("/my")
async def my_certificates(student: Student = Depends(get_current_student)):
    certs = await Certificate.find(
        Certificate.student_id == str(student.id)
    ).to_list()
    return [
        {
            "id": str(c.id),
            "certificate_id": c.certificate_id,
            "student_name": c.student_name,
            "college_name": c.college_name,
            "course_name": c.course_name,
            "grade": c.grade,
            "duration": c.duration,
            "issue_date": c.issue_date,
            "pdf_url": c.pdf_url,
            "qr_code_url": c.qr_code_url,
        }
        for c in certs
    ]


@router.post("/feedback")
async def submit_feedback(data: dict, student: Student = Depends(get_current_student)):
    sid = str(student.id)
    course_id = data.get("course_id", "")
    rating = data.get("rating", 0)
    comments = data.get("comments", "")

    existing = await Feedback.find_one(
        Feedback.student_id == sid,
        Feedback.course_id == str(course_id),
    )
    if existing:
        return {"message": "Feedback already submitted"}

    feedback = Feedback(
        student_id=sid,
        course_id=str(course_id),
        rating=rating,
        comments=comments,
    )
    await feedback.insert()
    return {"message": "Feedback submitted successfully"}
