"""Seed demo data into MongoDB for the AIUGIP LMS platform."""
import uuid
from datetime import datetime, timedelta
from app.utils.security import hash_password

# Default study PDF for fresh seed only (local file served under /uploads/).
DEFAULT_STUDY_PDF_URL = "/uploads/Deep learning based speaker recognition tutorial_Ruijie.pdf"

# Bihar universities + colleges for student registration dropdown (idempotent upsert by code).
# Tuples: (university_name, university_code)
REGISTRATION_UNIVERSITIES = [
    ("Bihar Vidhyapeet University", "BVU"),
    ("Patna University", "PU"),
    ("Aryabhatta Knowledge University", "AKU"),
    ("Babasaheb Bhimrao Ambedkar Bihar University", "BRABU"),
    ("Magadh University", "MU"),
    ("Tilka Manjhi Bhagalpur University", "TMBU"),
    ("Lalit Narayan Mithila University", "LNMU"),
    ("Jai Prakash University", "JPU"),
    ("Purnea University", "PUREA"),
    ("Patliputra University", "PPU"),
    ("Bihar University of Health Sciences", "BUHS"),
]

# Tuples: (college_name, college_code, city, university_code)
REGISTRATION_COLLEGES = [
    ("Bihar Institute of Technology", "BIT-P", "Patna", "BVU"),
    ("A.N. College, Patna", "ANC-P", "Patna", "PU"),
    ("Patna University (Affiliated / Other)", "PU-GEN", "Patna", "PU"),
    ("Patna College", "PU-PATCOL", "Patna", "PU"),
    ("Patna Science College", "PSC-P", "Patna", "PU"),
    ("Bihar National College", "PU-BNC", "Patna", "PU"),
    ("T.N.B. College", "PU-TNB", "Patna", "PU"),
    ("Marwari College", "PU-MARW", "Patna", "PU"),
    ("Mirza Ghalib College", "PU-MGC", "Patna", "PU"),
    ("Jamuni Lal College", "PU-JLC", "Patna", "PU"),
    ("Central University of Bihar", "CUB-G", "Gaya", "AKU"),
    ("IIT Patna", "IITP", "Patna", "AKU"),
    ("Babasaheb Bhimrao Ambedkar Bihar University — Affiliated College", "BRABU-AFF", "Muzaffarpur", "BRABU"),
    ("Magadh University — Affiliated College", "MU-AFF", "Gaya", "MU"),
    ("Tilka Manjhi Bhagalpur University — Affiliated College", "TMBU-AFF", "Bhagalpur", "TMBU"),
    ("Lalit Narayan Mithila University — Affiliated College", "LNMU-AFF", "Darbhanga", "LNMU"),
    ("Jai Prakash University — Affiliated College", "JPU-AFF", "Chapra", "JPU"),
    ("Purnea University — Affiliated College", "PUREA-AFF", "Purnea", "PUREA"),
    ("Patliputra University — Affiliated College", "PPU-AFF", "Patna", "PPU"),
    ("Bihar University of Health Sciences — Affiliated College", "BUHS-AFF", "Patna", "BUHS"),
]


async def ensure_bihar_registration_catalog():
    """Insert missing Bihar universities/colleges used by registration (safe on every startup)."""
    from app.models.user import University, College

    uni_by_code = {}
    for name, code in REGISTRATION_UNIVERSITIES:
        existing = await University.find_one(University.code == code)
        if existing:
            uni_by_code[code] = existing
            continue
        u = University(name=name, code=code, state="Bihar")
        await u.insert()
        uni_by_code[code] = u

    for cname, ccode, city, uni_code in REGISTRATION_COLLEGES:
        if await College.find_one(College.code == ccode):
            continue
        parent = uni_by_code.get(uni_code)
        if not parent:
            continue
        await College(
            name=cname,
            code=ccode,
            city=city,
            university_id=str(parent.id),
        ).insert()

    print("  ✅ Bihar registration colleges catalog ensured")


def _ensure_module4_study_pdf(course):
    """
    Normalize module 4 to a study-only PDF module.
    This aligns the requested learning flow and guarantees PDF rendering in study phase.
    """
    modules = course.modules or []
    if len(modules) < 4:
        return False

    m4 = modules[3]
    changed = False

    if getattr(m4, "module_type", None) != "study":
        m4.module_type = "study"
        changed = True
    if getattr(m4, "section_type", None) != "study":
        m4.section_type = "study"
        changed = True
    if getattr(m4, "quiz_id", None):
        m4.quiz_id = None
        changed = True

    # Keep only PDF/text resources so this module is rendered in study section.
    existing_contents = m4.contents or []
    filtered = []
    for c in existing_contents:
        ctype = (getattr(c, "content_type", "") or "").lower()
        if ctype in {"pdf", "text"}:
            filtered.append(c)

    if not filtered:
        from app.models.course import ModuleContent
        filtered = [
            ModuleContent(
                id=str(uuid.uuid4())[:8],
                title="Module 4 Study Material",
                content_type="pdf",
                content_url=DEFAULT_STUDY_PDF_URL,
                duration_minutes=15,
                order_index=1,
            )
        ]

    # Re-order; keep existing PDF URLs unless missing.
    for idx, c in enumerate(filtered, start=1):
        c.order_index = idx
        if (c.content_type or "").lower() == "pdf" and not (getattr(c, "content_url", None) or "").strip():
            c.content_url = DEFAULT_STUDY_PDF_URL

    if len(filtered) != len(existing_contents) or any((getattr(c, "content_type", "") or "").lower() == "video" for c in existing_contents):
        changed = True
    m4.contents = filtered
    return changed


async def seed_demo_data():
    """Seed initial data if the database is empty."""
    from app.models.user import University, College, Student, Admin
    from app.models.course import Course, Module, ModuleContent, Enrollment
    from app.models.quiz import Quiz, QuizQuestion
    from app.models.assignment import Assignment
    from app.models.assignment_section import AssignmentSection

    # Check if data already exists
    student_count = await Student.find().count()
    existing_assignment_sections_count = await AssignmentSection.find().count()
    if student_count > 0:
        # Do not mutate course module URLs on startup — that overwrote admin R2/local uploads
        # with hardcoded links every restart. Content is owned by admins in the DB.

        # In case DB already seeded, we still want assignment section templates/submission
        # definitions to exist for the frontend.
        if existing_assignment_sections_count == 0:
            print("🧩 Seeding assignment section templates...")
            now = datetime.utcnow()

            # Keep the "Nov 15" label but calculate a future date for the server logic.
            nov_15 = datetime(now.year, 11, 15)
            locked_until_at = nov_15 if now < nov_15 else datetime(now.year + 1, 11, 15)

            def due_date_in(days: int) -> str:
                return (now + timedelta(days=days)).strftime("%Y-%m-%d")

            templates = [
                AssignmentSection(
                    module_id="1",
                    title="Module 01: Orientation Report",
                    description="Summarize the core objectives and ethical framework discussed during orientation.",
                    weight=15,
                    due_days=3,
                    due_date=due_date_in(3),
                    color="#dc2626",
                ),
                AssignmentSection(
                    module_id="5",
                    title="Research Project Proposal",
                    description="Outline your proposed research methodology for the upcoming AI project.",
                    weight=25,
                    due_days=12,
                    due_date=due_date_in(12),
                    color="#1e3a5f",
                ),
                AssignmentSection(
                    module_id="4",
                    title="Ethics in AI: Case Study",
                    description="A detailed analysis of algorithmic bias in modern credit scoring systems.",
                    weight=10,
                    due_days=None,
                    due_date=due_date_in(6),
                    color=None,
                ),
                AssignmentSection(
                    module_id="2",
                    title="Baseline Technical Assessment",
                    description="Initial skills evaluation covering Python basics and machine learning fundamentals.",
                    weight=20,
                    due_days=None,
                    due_date=due_date_in(-2),
                    color=None,
                ),
                AssignmentSection(
                    module_id="8",
                    title="Final Capstone Project",
                    description="Instructions will be released after the completion of Module 04.",
                    weight=30,
                    locked_until_at=locked_until_at,
                    locked_until="Nov 15",
                    color="#1e3a5f",
                ),
            ]
            for t in templates:
                await t.insert()
            print("  ✅ Assignment section templates inserted")

        # Seed a couple of submissions so the UI shows variety on first run.
        demo_student = await Student.find_one()
        if demo_student:
            existing_submission_count = await Assignment.find(
                Assignment.student_id == str(demo_student.id)
            ).count()
            if existing_submission_count == 0:
                print("📄 Seeding demo assignment submissions...")
                now = datetime.utcnow()

                submitted = Assignment(
                    student_id=str(demo_student.id),
                    module_id="4",
                    title="Ethics in AI: Case Study",
                    file_url="/uploads/assignments/placeholder_submitted.pdf",
                    file_name="placeholder_submitted.pdf",
                    status="submitted",
                    submitted_at=now - timedelta(days=3),
                )
                await submitted.insert()

                graded = Assignment(
                    student_id=str(demo_student.id),
                    module_id="2",
                    title="Baseline Technical Assessment",
                    file_url="/uploads/assignments/placeholder_graded.pdf",
                    file_name="placeholder_graded.pdf",
                    status="graded",
                    marks=92,
                    max_marks=100,
                    feedback="Excellent work. Your understanding of concepts is strong.",
                    submitted_at=now - timedelta(days=8),
                    graded_at=now - timedelta(days=5),
                )
                await graded.insert()
                print("  ✅ Demo assignment submissions inserted")

        await ensure_bihar_registration_catalog()
        print("📦 Database already has data — skipping base seed.")
        return

    print("🌱 Seeding demo data into MongoDB...")

    # ─── 1–2. Universities + colleges (registration catalog + demo student links) ───
    await ensure_bihar_registration_catalog()

    demo_college_codes = ["BIT-P", "ANC-P", "PSC-P", "CUB-G", "IITP"]
    colleges = []
    for code in demo_college_codes:
        c = await College.find_one(College.code == code)
        if not c:
            raise RuntimeError(f"Seed error: college code {code} missing after catalog ensure")
        colleges.append(c)
    print("  ✅ Demo college references resolved")

    # ─── 3. Create Admin ───
    admin = Admin(
        name="AIUGIP Super Admin",
        email="admin@aiugip.edu.in",
        password_hash=hash_password("admin123"),
        role="super_admin",
    )
    await admin.insert()
    print("  ✅ Admin created (admin@aiugip.edu.in / admin123)")

    # ─── 4. Create Demo Students ───
    students_data = [
        {"name": "Rajesh Kumar", "mobile": "9876543210", "email": "rajesh@test.com", "gender": "Male",
         "father_name": "Ramesh Kumar", "mother_name": "Sunita Kumar", "dob": "2002-05-15",
         "course_name": "B.Tech CSE", "semester": "6th", "roll_number": "BIT/CSE/2021/001",
         "reg_number": "BVU-2021-10001", "college_idx": 0},
        {"name": "Ananya Sharma", "mobile": "9876543211", "email": "ananya@test.com", "gender": "Female",
         "father_name": "Vikas Sharma", "mother_name": "Meena Sharma", "dob": "2001-08-22",
         "course_name": "BCA", "semester": "4th", "roll_number": "ANC/BCA/2022/045",
         "reg_number": "PU-2022-20045", "college_idx": 1},
        {"name": "Priya Patel", "mobile": "9876543212", "email": "priya@test.com", "gender": "Female",
         "father_name": "Mohan Patel", "mother_name": "Kavita Patel", "dob": "2002-03-10",
         "course_name": "B.Sc Computer Science", "semester": "5th", "roll_number": "PSC/CS/2021/012",
         "reg_number": "PU-2021-30012", "college_idx": 2},
        {"name": "Vikram Singh", "mobile": "9876543213", "email": "vikram@test.com", "gender": "Male",
         "father_name": "Ajay Singh", "mother_name": "Rekha Singh", "dob": "2001-11-05",
         "course_name": "B.Tech AI/ML", "semester": "6th", "roll_number": "CUB/AI/2021/008",
         "reg_number": "AKU-2021-40008", "college_idx": 3},
        {"name": "Neha Gupta", "mobile": "9876543214", "email": "neha@test.com", "gender": "Female",
         "father_name": "Sanjay Gupta", "mother_name": "Pooja Gupta", "dob": "2002-07-18",
         "course_name": "B.Tech ECE", "semester": "4th", "roll_number": "IITP/ECE/2022/033",
         "reg_number": "AKU-2022-50033", "college_idx": 4},
        {"name": "Arun Mehta", "mobile": "9876543215", "email": "arun@test.com", "gender": "Male",
         "father_name": "Deepak Mehta", "mother_name": "Sarita Mehta", "dob": "2001-01-25",
         "course_name": "MCA", "semester": "3rd", "roll_number": "BIT/MCA/2023/007",
         "reg_number": "BVU-2023-60007", "college_idx": 0},
    ]

    students = []
    for sd in students_data:
        s = Student(
            name=sd["name"], mobile=sd["mobile"], email=sd["email"], gender=sd["gender"],
            father_name=sd["father_name"], mother_name=sd["mother_name"], dob=sd["dob"],
            course_name=sd["course_name"], semester=sd["semester"],
            roll_number=sd["roll_number"], reg_number=sd["reg_number"],
            college_id=str(colleges[sd["college_idx"]].id),
            password_hash=hash_password("password123"),
        )
        await s.insert()
        students.append(s)
    print(f"  ✅ {len(students)} students created")

    # ─── 5. Create Course with Modules ───
    def mid():
        return str(uuid.uuid4())[:8]

    modules = [
        Module(
            id=mid(), title="Module 1: Orientation & Onboarding", description="Introduction to the AIUGIP program, objectives, and expectations.",
            order_index=1, module_type="orientation", is_mandatory=True,
            contents=[
                ModuleContent(id=mid(), title="Welcome to AIUGIP", content_type="video", content_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ", duration_minutes=15, order_index=1),
                ModuleContent(id=mid(), title="Program Overview", content_type="pdf", content_url="/uploads/program_overview.pdf", duration_minutes=10, order_index=2),
                ModuleContent(id=mid(), title="Code of Conduct", content_type="text", content_text="All interns must adhere to professional standards...", duration_minutes=5, order_index=3),
            ],
        ),
        Module(
            id=mid(), title="Module 2: Communication Skills", description="Professional communication, email etiquette, and presentation skills.",
            order_index=2, module_type="communication", is_mandatory=True,
            contents=[
                ModuleContent(id=mid(), title="Business Communication", content_type="video", content_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ", duration_minutes=20, order_index=1),
                ModuleContent(id=mid(), title="Email Writing Guide", content_type="pdf", content_url="/uploads/email_guide.pdf", duration_minutes=10, order_index=2),
            ],
        ),
        Module(
            id=mid(), title="Module 3: Digital Literacy", description="Essential digital skills including cloud computing, cybersecurity basics, and data management.",
            order_index=3, module_type="digital", is_mandatory=True,
            contents=[
                ModuleContent(id=mid(), title="Cloud Computing Basics", content_type="video", content_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ", duration_minutes=25, order_index=1),
                ModuleContent(id=mid(), title="Cybersecurity Essentials", content_type="video", content_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ", duration_minutes=20, order_index=2),
                ModuleContent(id=mid(), title="Data Management", content_type="pdf", content_url="/uploads/data_mgmt.pdf", duration_minutes=15, order_index=3),
            ],
        ),
        Module(
            id=mid(), title="Module 4: Entrepreneurship & Innovation", description="Start-up culture, business planning, and innovation frameworks.",
            order_index=4, module_type="entrepreneurship", is_mandatory=True,
            contents=[
                ModuleContent(id=mid(), title="Entrepreneurship Mindset", content_type="video", content_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ", duration_minutes=20, order_index=1),
                ModuleContent(id=mid(), title="Business Model Canvas", content_type="pdf", content_url="/uploads/bmc.pdf", duration_minutes=15, order_index=2),
            ],
        ),
        Module(
            id=mid(), title="Module 5: Research Methodology", description="Scientific research methods, literature review, and academic writing.",
            order_index=5, module_type="research", is_mandatory=True,
            contents=[
                ModuleContent(id=mid(), title="Research Methods", content_type="video", content_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ", duration_minutes=25, order_index=1),
                ModuleContent(id=mid(), title="Citation Guide", content_type="pdf", content_url="/uploads/citation.pdf", duration_minutes=10, order_index=2),
            ],
        ),
        Module(
            id=mid(), title="Module 6: Field Work & Project", description="Real-world project work and industry exposure.",
            order_index=6, module_type="fieldwork", is_mandatory=True,
            contents=[
                ModuleContent(id=mid(), title="Project Guidelines", content_type="video", content_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ", duration_minutes=15, order_index=1),
                ModuleContent(id=mid(), title="Report Writing Template", content_type="pdf", content_url="/uploads/report_template.pdf", duration_minutes=10, order_index=2),
            ],
        ),
        Module(
            id=mid(), title="Module 7: Final Assessment", description="Comprehensive assessment covering all modules.",
            order_index=7, module_type="assessment", is_mandatory=True,
            contents=[
                ModuleContent(id=mid(), title="Assessment Instructions", content_type="text", content_text="Complete the final quiz and submit your project report.", duration_minutes=5, order_index=1),
            ],
        ),
        Module(
            id=mid(), title="Module 8: Feedback & Certificate", description="Program feedback and certificate generation.",
            order_index=8, module_type="feedback", is_mandatory=True,
            contents=[
                ModuleContent(id=mid(), title="Feedback Form", content_type="text", content_text="Please provide your honest feedback about the program.", duration_minutes=5, order_index=1),
            ],
        ),
    ]

    course = Course(
        title="All India Undergraduate Internship Program (AIUGIP)",
        description="A comprehensive 120-hour internship program designed to enhance undergraduate skills in communication, digital literacy, entrepreneurship, and research methodology. Organized by TADRI and AIC Bihar Vidhyapeet.",
        total_hours=120,
        is_active=True,
        modules=modules,
    )
    # Fresh install only: normalize module 4 study layout (does not touch other modules' URLs).
    _ensure_module4_study_pdf(course)
    await course.insert()
    print("  ✅ Course with 8 modules created")

    # ─── 6. Create Quiz for assessment module ───
    assessment_module = modules[6]  # Module 7
    quiz_questions = [
        QuizQuestion(id=mid(), question_text="What is the primary objective of the AIUGIP program?",
                     option_a="Entertainment", option_b="Skill Development for undergraduates",
                     option_c="Sports training", option_d="Cooking classes",
                     correct_option="b", marks=10),
        QuizQuestion(id=mid(), question_text="Which organization co-organizes AIUGIP?",
                     option_a="NASA", option_b="WHO",
                     option_c="TADRI & AIC Bihar Vidhyapeet", option_d="UN",
                     correct_option="c", marks=10),
        QuizQuestion(id=mid(), question_text="What is the total duration of the internship program?",
                     option_a="60 Hours", option_b="90 Hours",
                     option_c="120 Hours", option_d="150 Hours",
                     correct_option="c", marks=10),
        QuizQuestion(id=mid(), question_text="Which module covers Business Model Canvas?",
                     option_a="Communication Skills", option_b="Digital Literacy",
                     option_c="Entrepreneurship & Innovation", option_d="Research Methodology",
                     correct_option="c", marks=10),
        QuizQuestion(id=mid(), question_text="What is the purpose of the final assessment?",
                     option_a="Fun activity", option_b="Comprehensive evaluation of learnings",
                     option_c="Attendance check", option_d="Photo session",
                     correct_option="b", marks=10),
        QuizQuestion(id=mid(), question_text="Cloud computing is covered under which module?",
                     option_a="Orientation", option_b="Communication Skills",
                     option_c="Digital Literacy", option_d="Entrepreneurship",
                     correct_option="c", marks=10),
        QuizQuestion(id=mid(), question_text="What format should the project report follow?",
                     option_a="Any format", option_b="Standard template provided in Module 6",
                     option_c="PowerPoint only", option_d="No report needed",
                     correct_option="b", marks=10),
        QuizQuestion(id=mid(), question_text="What is the minimum passing score for the quiz?",
                     option_a="30%", option_b="40%",
                     option_c="50%", option_d="70%",
                     correct_option="c", marks=10),
        QuizQuestion(id=mid(), question_text="Email etiquette is part of which module?",
                     option_a="Digital Literacy", option_b="Communication Skills",
                     option_c="Research Methodology", option_d="Field Work",
                     correct_option="b", marks=10),
        QuizQuestion(id=mid(), question_text="How is the certificate verified?",
                     option_a="Phone call", option_b="In-person visit",
                     option_c="QR Code / Online verification", option_d="Not verified",
                     correct_option="c", marks=10),
    ]

    quiz = Quiz(
        module_id=assessment_module.id,
        course_id=str(course.id),
        title="AIUGIP Final Assessment",
        description="Comprehensive assessment covering all program modules. You have 45 minutes to complete 10 questions.",
        time_limit_minutes=45,
        passing_score=50,
        total_marks=100,
        max_attempts=3,
        questions=quiz_questions,
        status="active",
    )
    await quiz.insert()

    # Update the module's quiz_id reference
    course.modules[6].quiz_id = str(quiz.id)
    await course.save()
    print("  ✅ Final Assessment Quiz (10 questions)")

    # ─── 7. Create Enrollments for demo students ───
    for s in students:
        enrollment = Enrollment(student_id=str(s.id), course_id=str(course.id))
        await enrollment.insert()
    print(f"  ✅ {len(students)} enrollments created")

    # ─── 8. Seed assignment section templates (for AssignmentPage) ───
    existing_assignment_sections_count = await AssignmentSection.find().count()
    if existing_assignment_sections_count == 0:
        print("🧩 Seeding assignment section templates...")
        now = datetime.utcnow()

        nov_15 = datetime(now.year, 11, 15)
        locked_until_at = nov_15 if now < nov_15 else datetime(now.year + 1, 11, 15)

        def due_date_in(days: int) -> str:
            return (now + timedelta(days=days)).strftime("%Y-%m-%d")

        templates = [
            AssignmentSection(
                module_id="1",
                title="Module 01: Orientation Report",
                description="Summarize the core objectives and ethical framework discussed during orientation.",
                weight=15,
                due_days=3,
                due_date=due_date_in(3),
                color="#dc2626",
            ),
            AssignmentSection(
                module_id="5",
                title="Research Project Proposal",
                description="Outline your proposed research methodology for the upcoming AI project.",
                weight=25,
                due_days=12,
                due_date=due_date_in(12),
                color="#1e3a5f",
            ),
            AssignmentSection(
                module_id="4",
                title="Ethics in AI: Case Study",
                description="A detailed analysis of algorithmic bias in modern credit scoring systems.",
                weight=10,
                due_days=None,
                due_date=due_date_in(6),
                color=None,
            ),
            AssignmentSection(
                module_id="2",
                title="Baseline Technical Assessment",
                description="Initial skills evaluation covering Python basics and machine learning fundamentals.",
                weight=20,
                due_days=None,
                due_date=due_date_in(-2),
                color=None,
            ),
            AssignmentSection(
                module_id="8",
                title="Final Capstone Project",
                description="Instructions will be released after the completion of Module 04.",
                weight=30,
                locked_until_at=locked_until_at,
                locked_until="Nov 15",
                color="#1e3a5f",
            ),
        ]
        for t in templates:
            await t.insert()
        print("  ✅ Assignment section templates inserted")

    # ─── 9. Seed demo assignment submissions (so cards show submitted/graded) ───
    # Use the first created student (same one returned by get_demo_student()).
    demo_student = await Student.find_one()
    if demo_student:
        existing_submission_count = await Assignment.find(
            Assignment.student_id == str(demo_student.id)
        ).count()
        if existing_submission_count == 0:
            print("📄 Seeding demo assignment submissions...")
            now = datetime.utcnow()

            submitted = Assignment(
                student_id=str(demo_student.id),
                module_id="4",
                title="Ethics in AI: Case Study",
                file_url="/uploads/assignments/placeholder_submitted.pdf",
                file_name="placeholder_submitted.pdf",
                status="submitted",
                submitted_at=now - timedelta(days=3),
            )
            await submitted.insert()

            graded = Assignment(
                student_id=str(demo_student.id),
                module_id="2",
                title="Baseline Technical Assessment",
                file_url="/uploads/assignments/placeholder_graded.pdf",
                file_name="placeholder_graded.pdf",
                status="graded",
                marks=92,
                max_marks=100,
                feedback="Excellent work. Your understanding of concepts is strong.",
                submitted_at=now - timedelta(days=8),
                graded_at=now - timedelta(days=5),
            )
            await graded.insert()
            print("  ✅ Demo assignment submissions inserted")

    print("🎉 Seed data complete! Database is ready.")
    print(f"   Demo student login: 9876543210 / password123")
    print(f"   Admin login: admin@aiugip.edu.in / admin123")
