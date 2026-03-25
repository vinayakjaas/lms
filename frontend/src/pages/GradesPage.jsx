import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { gradeAPI } from '../services/api';
import { ClipboardCheck, BookOpen, Calendar, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';

function useWindowWidth() {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
        const h = () => setWidth(window.innerWidth);
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, []);
    return width;
}

/** Show detailed grade card only after at least one graded quiz attempt or graded assignment exists. */
function hasAssessmentActivity(g) {
    const q = Number(g?.quiz_score);
    const a = Number(g?.assignment_score);
    return (Number.isFinite(q) && q > 0) || (Number.isFinite(a) && a > 0);
}

export default function GradesPage() {
    const w = useWindowWidth();
    const isMobile = w <= 768;
    const isSmall = w <= 480;
    const [grades, setGrades] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        gradeAPI
            .my()
            .then((r) => setGrades(Array.isArray(r.data) ? r.data : []))
            .catch(() => {
                toast.error('Could not load grades');
                setGrades([]);
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner" />
            </div>
        );
    }

    const grade = grades.find(hasAssessmentActivity) || null;
    const showGrades = grade != null;

    const gradeColor = (g) =>
        ({ 'A+': '#10b981', A: '#10b981', B: '#0ea5e9', C: '#f59e0b', D: '#f97316', F: '#ef4444' }[g] || '#64748b');

    const gradeScale = [
        { g: 'A+', range: '90% - 100%', label: 'EXCELLENT', color: '#10b981' },
        { g: 'A', range: '80% - 89%', label: 'VERY GOOD', color: '#10b981' },
        { g: 'B', range: '70% - 79%', label: 'GOOD', color: '#0ea5e9' },
        { g: 'C', range: '60% - 69%', label: 'SATISFACTORY', color: '#f59e0b' },
        { g: 'D', range: '40% - 59%', label: 'PASS', color: '#f97316' },
        { g: 'F', range: '< 40%', label: 'FAIL', color: '#ef4444' },
    ];

    const quizScore = grade ? Number(grade.quiz_score) : 0;
    const assignmentScore = grade ? Number(grade.assignment_score) : 0;
    const attendanceScore = grade ? Number(grade.attendance_score) : 0;
    const totalScore = grade ? Number(grade.total_score) : 0;
    const studentGrade = grade?.grade || '—';
    const quizWeighted = grade ? Number(grade.quiz_weighted) : 0;
    const assignmentWeighted = grade ? Number(grade.assignment_weighted) : 0;
    const attendanceWeighted = grade ? Number(grade.attendance_weighted) : 0;

    return (
        <div className="animate-fadeIn">
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: isMobile ? 'flex-start' : 'flex-start',
                    marginBottom: isMobile ? '20px' : '32px',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: '12px',
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: '0.68rem',
                            fontWeight: '700',
                            color: '#2563eb',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            marginBottom: '6px',
                        }}
                    >
                        ASSESSMENT OVERVIEW
                    </div>
                    <h1 style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: '800', color: '#0f172a' }}>
                        Grade Performance
                    </h1>
                </div>
            </div>

            {!showGrades && (
                <div
                    className="glass-card"
                    style={{
                        padding: isMobile ? '32px 24px' : '48px 40px',
                        textAlign: 'center',
                        maxWidth: '520px',
                        margin: '0 auto 32px',
                    }}
                >
                    <div
                        style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '16px',
                            background: '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px',
                        }}
                    >
                        <BarChart3 size={30} style={{ color: '#64748b' }} />
                    </div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', marginBottom: '10px' }}>
                        No grades yet
                    </h2>
                    <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6, marginBottom: '24px' }}>
                        Your grade appears after you complete at least one <strong>quiz</strong> or receive a graded{' '}
                        <strong>assignment</strong>. Progress alone does not generate a final grade until then.
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Link to="/dashboard/course" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                            Go to My Course
                        </Link>
                        <Link
                            to="/dashboard/quiz"
                            className="btn btn-secondary"
                            style={{ textDecoration: 'none' }}
                        >
                            Quizzes
                        </Link>
                        <Link
                            to="/dashboard/assignments"
                            className="btn btn-secondary"
                            style={{ textDecoration: 'none' }}
                        >
                            Assignments
                        </Link>
                    </div>
                </div>
            )}

            {showGrades && (
                <>
                    {grade.course_title && (
                        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
                            Showing grades for: <strong style={{ color: '#0f172a' }}>{grade.course_title}</strong>
                        </p>
                    )}

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : '1fr 320px',
                            gap: isMobile ? '16px' : '24px',
                            marginBottom: isMobile ? '20px' : '28px',
                        }}
                    >
                        <div
                            className="glass-card"
                            style={{
                                padding: isMobile ? '24px' : '36px',
                                display: 'flex',
                                gap: isMobile ? '20px' : '36px',
                                alignItems: 'center',
                                flexDirection: isMobile ? 'column' : 'row',
                            }}
                        >
                            <div
                                style={{
                                    position: 'relative',
                                    width: isMobile ? '120px' : '160px',
                                    height: isMobile ? '120px' : '160px',
                                    flexShrink: 0,
                                }}
                            >
                                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                                    <path
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="#e2e8f0"
                                        strokeWidth="2.5"
                                    />
                                    <path
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke={gradeColor(studentGrade)}
                                        strokeWidth="2.5"
                                        strokeDasharray={`${Math.min(100, Math.max(0, totalScore))}, 100`}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        textAlign: 'center',
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: isMobile ? '1.8rem' : '2.2rem',
                                            fontWeight: '800',
                                            color: '#0f172a',
                                            fontFamily: "'Outfit'",
                                        }}
                                    >
                                        {studentGrade}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: '600', color: gradeColor(studentGrade) }}>
                                        {totalScore.toFixed(1)}%
                                    </div>
                                </div>
                            </div>
                            <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
                                <h2
                                    style={{
                                        fontSize: isMobile ? '1.1rem' : '1.4rem',
                                        fontWeight: '800',
                                        color: '#0f172a',
                                        marginBottom: '10px',
                                        lineHeight: '1.2',
                                    }}
                                >
                                    Your current performance
                                </h2>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '1.7', marginBottom: '12px' }}>
                                    Overall score blends quizzes (30%), assignments (30%), and module completion (40%).
                                    Minimum 40% overall is required for certification eligibility.
                                </p>
                            </div>
                        </div>

                        <div
                            style={{
                                background: 'linear-gradient(135deg, #0f172a, #1e3a5f)',
                                borderRadius: '16px',
                                padding: isMobile ? '22px' : '28px',
                                color: 'white',
                            }}
                        >
                            <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '20px', color: 'white' }}>
                                Weightage distribution
                            </h3>
                            {[
                                { label: 'QUIZZES', pct: 30, fill: '#3b82f6' },
                                { label: 'ASSIGNMENTS', pct: 30, fill: '#b8a070' },
                                { label: 'MODULE COMPLETION', pct: 40, fill: '#0f172a' },
                            ].map((item, i) => (
                                <div key={i} style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                        <span
                                            style={{
                                                fontSize: '0.65rem',
                                                fontWeight: '700',
                                                letterSpacing: '0.08em',
                                                color: '#94a3b8',
                                            }}
                                        >
                                            {item.label}
                                        </span>
                                        <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'white' }}>
                                            {item.pct}%
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            height: '5px',
                                            background: 'rgba(255,255,255,0.15)',
                                            borderRadius: '20px',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <div
                                            style={{
                                                height: '100%',
                                                width: `${item.pct * 2.5}%`,
                                                background: item.fill,
                                                borderRadius: '20px',
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                            <p style={{ fontSize: '0.72rem', opacity: 0.6, marginTop: '8px', lineHeight: '1.5' }}>
                                Minimum 40% overall required for certification.
                            </p>
                        </div>
                    </div>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: isSmall ? '1fr' : 'repeat(3, 1fr)',
                            gap: isMobile ? '12px' : '20px',
                            marginBottom: isMobile ? '24px' : '36px',
                        }}
                    >
                        {[
                            {
                                icon: ClipboardCheck,
                                score: quizScore,
                                label: 'QUIZ AVERAGE',
                                color: '#4f46e5',
                                bg: '#e0e7ff',
                                weighted: quizWeighted,
                                max: 30,
                            },
                            {
                                icon: BookOpen,
                                score: assignmentScore,
                                label: 'ASSIGNMENTS',
                                color: '#b8860b',
                                bg: '#fef3c7',
                                weighted: assignmentWeighted,
                                max: 30,
                            },
                            {
                                icon: Calendar,
                                score: attendanceScore,
                                label: 'MODULE COMPLETION',
                                color: '#0f172a',
                                bg: '#f1f5f9',
                                weighted: attendanceWeighted,
                                max: 40,
                            },
                        ].map((item, i) => (
                            <div key={i} className="glass-card" style={{ padding: isMobile ? '16px' : '22px', textAlign: 'center' }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '12px',
                                        marginBottom: '8px',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '10px',
                                            background: item.bg,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <item.icon size={18} style={{ color: item.color }} />
                                    </div>
                                    <div style={{ textAlign: 'left' }}>
                                        <div
                                            style={{
                                                fontSize: isMobile ? '1.6rem' : '2rem',
                                                fontWeight: '800',
                                                color: '#0f172a',
                                                fontFamily: "'Outfit'",
                                            }}
                                        >
                                            {item.score.toFixed(1)}%
                                        </div>
                                        <div
                                            style={{
                                                fontSize: '0.6rem',
                                                fontWeight: '700',
                                                color: '#94a3b8',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.08em',
                                            }}
                                        >
                                            {item.label}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: '10px' }}>
                                    <div style={{ fontSize: '0.82rem', color: '#475569', fontWeight: '500', marginBottom: '5px' }}>
                                        <span style={{ fontWeight: '400' }}>Weighted </span>
                                        <span style={{ fontWeight: '800', fontSize: '0.95rem' }}>
                                            {item.weighted.toFixed(1)}/{item.max}
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            height: '4px',
                                            background: '#f1f5f9',
                                            borderRadius: '20px',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <div
                                            style={{
                                                height: '100%',
                                                width: `${Math.min(100, (item.weighted / item.max) * 100)}%`,
                                                background: item.color,
                                                borderRadius: '20px',
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <h3
                style={{
                    fontSize: '1.1rem',
                    fontWeight: '700',
                    color: '#0f172a',
                    marginBottom: '16px',
                    paddingLeft: '12px',
                    borderLeft: '3px solid #0f172a',
                    fontStyle: 'italic',
                }}
            >
                Institutional grade scale
            </h3>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: isSmall ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)',
                    gap: isMobile ? '8px' : '12px',
                }}
            >
                {gradeScale.map((item) => (
                    <div
                        key={item.g}
                        style={{
                            padding: isMobile ? '14px 10px' : '20px 16px',
                            borderRadius: '14px',
                            textAlign: 'center',
                            background: showGrades && studentGrade === item.g ? '#f0fdf4' : '#f8fafc',
                            border:
                                showGrades && studentGrade === item.g
                                    ? `2px solid ${item.color}`
                                    : '1px solid #e2e8f0',
                        }}
                    >
                        <div
                            style={{
                                fontSize: isMobile ? '1.4rem' : '2rem',
                                fontWeight: '800',
                                color: item.color,
                                fontFamily: "'Outfit'",
                                marginBottom: '4px',
                            }}
                        >
                            {item.g}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '500', marginBottom: '3px' }}>
                            {item.range}
                        </div>
                        <div
                            style={{
                                fontSize: '0.55rem',
                                fontWeight: '700',
                                color: item.color,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                            }}
                        >
                            {item.label}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
