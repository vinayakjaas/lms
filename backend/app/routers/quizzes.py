import random
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from app.models.user import Student
from app.models.quiz import Quiz, QuizAttempt, QuizResponse
from app.utils.security import get_current_student

router = APIRouter(prefix="/api/quizzes", tags=["Quizzes"])


@router.get("/my/completed-quiz-ids")
async def my_completed_quiz_ids(student: Student = Depends(get_current_student)):
    """Quiz document ids the student has at least one completed attempt for."""
    attempts = await QuizAttempt.find(
        QuizAttempt.student_id == str(student.id),
        QuizAttempt.status == "completed",
    ).to_list()
    return {"quiz_ids": list({str(a.quiz_id) for a in attempts})}


@router.get("/{quiz_id}")
async def get_quiz(quiz_id: str, student: Student = Depends(get_current_student)):
    from beanie import PydanticObjectId
    try:
        quiz = await Quiz.get(PydanticObjectId(quiz_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Attempt stats
    completed_attempts = await QuizAttempt.find(
        QuizAttempt.student_id == str(student.id),
        QuizAttempt.quiz_id == str(quiz.id),
        QuizAttempt.status == "completed",
    ).to_list()
    attempt_count = len(completed_attempts)
    best_attempt = max(completed_attempts, key=lambda a: (a.percentage or 0), default=None)
    attempts_left = max(0, (quiz.max_attempts or 0) - attempt_count)

    questions = list(quiz.questions)
    if quiz.randomize:
        random.shuffle(questions)

    return {
        "id": str(quiz.id),
        "title": quiz.title,
        "description": quiz.description,
        "time_limit_minutes": quiz.time_limit_minutes,
        "total_marks": quiz.total_marks,
        "max_attempts": quiz.max_attempts,
        "attempts_used": attempt_count,
        "attempts_left": attempts_left,
        "best_score": best_attempt.score if best_attempt else None,
        "best_percentage": best_attempt.percentage if best_attempt else None,
        "questions": [
            {
                "id": q.id,
                "question_text": q.question_text,
                "option_a": q.option_a,
                "option_b": q.option_b,
                "option_c": q.option_c,
                "option_d": q.option_d,
                "marks": q.marks,
            }
            for q in questions
        ],
    }


@router.post("/{quiz_id}/start")
async def start_quiz(quiz_id: str, student: Student = Depends(get_current_student)):
    from beanie import PydanticObjectId
    quiz = await Quiz.get(PydanticObjectId(quiz_id))
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    sid = str(student.id)
    qid = str(quiz.id)

    completed_attempts = await QuizAttempt.find(
        QuizAttempt.student_id == sid,
        QuizAttempt.quiz_id == qid,
        QuizAttempt.status == "completed",
    ).count()
    if completed_attempts >= (quiz.max_attempts or 0):
        raise HTTPException(status_code=403, detail="Maximum attempts reached")

    # Check for in-progress attempt
    existing = await QuizAttempt.find_one(
        QuizAttempt.student_id == sid,
        QuizAttempt.quiz_id == qid,
        QuizAttempt.status == "in_progress",
    )
    if existing:
        return {"attempt_id": str(existing.id), "started_at": existing.started_at.isoformat()}

    attempt = QuizAttempt(
        student_id=sid,
        quiz_id=qid,
        total_marks=quiz.total_marks,
    )
    await attempt.insert()
    return {"attempt_id": str(attempt.id), "started_at": attempt.started_at.isoformat()}


@router.post("/{quiz_id}/submit")
async def submit_quiz(quiz_id: str, data: dict, student: Student = Depends(get_current_student)):
    from beanie import PydanticObjectId
    sid = str(student.id)

    quiz = await Quiz.get(PydanticObjectId(quiz_id))
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    attempt = await QuizAttempt.find_one(
        QuizAttempt.student_id == sid,
        QuizAttempt.quiz_id == str(quiz.id),
        QuizAttempt.status == "in_progress",
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="No active attempt found")

    # Build a lookup of questions by id
    q_lookup = {q.id: q for q in quiz.questions}

    score = 0
    details = []
    responses = []

    for resp in data.get("responses", []):
        question_id = str(resp.get("question_id", ""))
        selected = resp.get("selected_option", "").lower()
        question = q_lookup.get(question_id)
        if not question:
            continue

        is_correct = selected == question.correct_option.lower()
        if is_correct:
            score += question.marks

        responses.append(QuizResponse(
            question_id=question_id,
            selected_option=selected,
            is_correct=is_correct,
        ))
        details.append({
            "question_id": question_id,
            "selected": selected,
            "correct": question.correct_option,
            "is_correct": is_correct,
            "marks": question.marks if is_correct else 0,
        })

    attempt.score = score
    attempt.percentage = round((score / quiz.total_marks * 100) if quiz.total_marks > 0 else 0)
    attempt.status = "completed"
    attempt.completed_at = datetime.utcnow()
    attempt.responses = responses
    await attempt.save()

    return {
        "attempt_id": str(attempt.id),
        "score": score,
        "total_marks": quiz.total_marks,
        "percentage": attempt.percentage,
        "status": "completed",
        "details": details,
    }


@router.get("/{quiz_id}/results")
async def get_quiz_results(quiz_id: str, student: Student = Depends(get_current_student)):
    sid = str(student.id)

    attempts = await QuizAttempt.find(
        QuizAttempt.student_id == sid,
        QuizAttempt.quiz_id == quiz_id,
    ).sort("-completed_at").to_list()

    return [
        {
            "attempt_id": str(a.id),
            "score": a.score,
            "total_marks": a.total_marks,
            "percentage": a.percentage,
            "status": a.status,
            "started_at": a.started_at.isoformat() if a.started_at else None,
            "completed_at": a.completed_at.isoformat() if a.completed_at else None,
        }
        for a in attempts
    ]
