from beanie import Document
from datetime import datetime
from typing import Optional, List


class AssignmentSection(Document):
    """
    Defines the assignment metadata shown on the frontend (title, due date, weight, etc).
    Student uploads/submissions still live in the existing `Assignment` collection.
    """

    # Matches the `module_id` used by the frontend when uploading.
    module_id: str
    title: str
    description: Optional[str] = None

    weight: int = 0

    # Display fields used by the UI.
    due_days: Optional[int] = None
    due_date: Optional[str] = None  # e.g. "YYYY-MM-DD"
    color: Optional[str] = None

    # If set and locked_until_at is in the future, UI should treat the assignment as "upcoming".
    locked_until_at: Optional[datetime] = None
    locked_until: Optional[str] = None  # display label (e.g. "Nov 15")

    max_marks: int = 100

    # Submission guidelines – list of {"title": ..., "description": ...}
    submission_guidelines: Optional[List[dict]] = None

    # Accepted file formats, e.g. ["PDF", "DOCX"]
    accepted_formats: Optional[List[str]] = None

    # Optional question paper / brief attached by admin (PDF).
    questions_pdf_url: Optional[str] = None
    questions_pdf_name: Optional[str] = None

    class Settings:
        name = "assignment_sections"

