from fastapi import APIRouter, Depends
from typing import Dict, Optional
from datetime import datetime

from app.models.user import Student
from app.models.assignment import Assignment
from app.models.assignment_section import AssignmentSection
from app.utils.security import get_current_student


router = APIRouter(prefix="/api/assignment-sections", tags=["Assignment Sections"])


def calculate_assignment_grade_letter(marks: int, max_marks: int) -> str:
    if max_marks <= 0:
        return "F"
    percentage = (marks / max_marks) * 100
    if percentage >= 90:
        return "A+"
    if percentage >= 80:
        return "A"
    if percentage >= 70:
        return "B"
    if percentage >= 60:
        return "C"
    if percentage >= 50:
        return "D"
    return "F"


@router.get("/my")
async def my_assignment_sections(student: Student = Depends(get_current_student)):
    """
    Returns a list of assignment sections (definitions) merged with the current student's submissions.
    Response shape matches what `frontend/src/pages/AssignmentPage.jsx` expects.
    """

    sid = str(student.id)
    templates = await AssignmentSection.find().to_list()

    # Submissions: if we have graded submissions, keep the latest graded one.
    # Otherwise, keep the latest submission (submitted/reviewed).
    submissions = await Assignment.find(Assignment.student_id == sid).to_list()
    latest_by_module: Dict[str, Assignment] = {}
    for s in submissions:
        prev = latest_by_module.get(s.module_id)
        if prev is None:
            latest_by_module[s.module_id] = s
            continue

        # Graded takes precedence over submitted.
        if s.status == "graded":
            if prev.status != "graded":
                latest_by_module[s.module_id] = s
            else:
                # Both graded: pick the latest graded timestamp if available, else submitted_at.
                s_ts = s.graded_at or s.submitted_at
                prev_ts = prev.graded_at or prev.submitted_at
                if s_ts and prev_ts and s_ts > prev_ts:
                    latest_by_module[s.module_id] = s
        else:
            # Only update when we don't already have a graded submission.
            if prev.status != "graded":
                if s.submitted_at and prev.submitted_at and s.submitted_at > prev.submitted_at:
                    latest_by_module[s.module_id] = s

    now = datetime.utcnow()

    def sort_key(t: AssignmentSection):
        try:
            return int(t.module_id)
        except Exception:
            return 10**9

    templates.sort(key=sort_key)

    results = []
    for t in templates:
        s: Optional[Assignment] = latest_by_module.get(t.module_id)

        if s:
            if s.status == "graded":
                status = "graded"
            else:
                # Includes "submitted" / "reviewed" -> treat as submitted for UI.
                status = "submitted"
        else:
            if t.locked_until_at and now < t.locked_until_at:
                status = "upcoming"
            else:
                status = "pending"

        marks = s.marks if s else None
        max_marks = s.max_marks if s else t.max_marks
        feedback = s.feedback if s else None
        has_feedback = bool(feedback)

        grade = None
        if status == "graded" and marks is not None:
            grade = calculate_assignment_grade_letter(marks=marks, max_marks=max_marks)

        results.append(
            {
                "id": t.module_id,
                "module_id": t.module_id,
                "title": t.title,
                "description": t.description,
                "status": status,
                "weight": t.weight,
                "due_days": t.due_days,
                "due_date": t.due_date,
                "color": t.color,
                "locked_until": t.locked_until,

                "marks": marks,
                "max_marks": max_marks,
                "feedback": feedback,
                "has_feedback": has_feedback,
                "grade": grade,

                "file_url": s.file_url if s else None,
                "file_name": s.file_name if s else None,
                "submitted_at": s.submitted_at.isoformat() if s and s.submitted_at else None,

                "questions_pdf_url": getattr(t, "questions_pdf_url", None),
                "questions_pdf_name": getattr(t, "questions_pdf_name", None),
                "submission_guidelines": t.submission_guidelines,
                "accepted_formats": t.accepted_formats,
            }
        )

    return results

