import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { courseAPI, gradeAPI } from '../services/api';
import {
    BookOpen, FileText, ClipboardCheck, BarChart3, Download,
    TrendingUp, Clock, Award, ArrowRight, HelpCircle, Star, ChevronRight
} from 'lucide-react';

function useWindowWidth() {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
        const h = () => setWidth(window.innerWidth);
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, []);
    return width;
}

export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const w = useWindowWidth();
    const isMobile = w <= 768;
    const isSmall = w <= 480;
    const [courses, setCourses] = useState([]);
    const [progress, setProgress] = useState(null);
    const [gradeSummary, setGradeSummary] = useState(null);
    const [allGrades, setAllGrades] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [coursesRes, summaryRes, gradesRes] = await Promise.all([
                courseAPI.list(),
                gradeAPI.dashboardSummary().catch(() => ({ data: null })),
                gradeAPI.my().catch(() => ({ data: [] })),
            ]);
            setCourses(coursesRes.data);
            setGradeSummary(summaryRes.data);
            setAllGrades(Array.isArray(gradesRes.data) ? gradesRes.data : []);
            if (coursesRes.data.length > 0) {
                const progRes = await courseAPI.getProgress(coursesRes.data[0].id).catch(() => null);
                if (progRes) setProgress(progRes.data);
            }
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

    const showFinalGrade = gradeSummary?.show_final_grade === true;
    const fallbackGrade = allGrades.find((g) => g?.grade || g?.total_score != null) || null;
    const displayLetter = gradeSummary?.grade || fallbackGrade?.grade || 'N/A';
    const rawScore = gradeSummary?.total_score ?? fallbackGrade?.total_score;
    const displayScore = rawScore != null ? `${Number(rawScore).toFixed(1)}%` : '—';
    const progressPct = progress?.progress_percentage || 0;
    const completedModules = progress?.completed_modules || 0;
    const totalModules = progress?.total_modules || 0;
    const totalDurationMinutes = (courses || []).reduce(
        (courseAcc, c) => courseAcc + (c.modules || []).reduce(
            (moduleAcc, m) => moduleAcc + (m.contents || []).reduce(
                (contentAcc, ct) => contentAcc + Number(ct.duration_minutes || 0),
                0
            ),
            0
        ),
        0
    );
    const durationHours = Math.floor(totalDurationMinutes / 60);
    const durationMins = totalDurationMinutes % 60;
    const durationLabel = durationHours > 0
        ? `${durationHours}h${durationMins > 0 ? ` ${durationMins}m` : ''}`
        : `${durationMins || 0}m`;

    const phases = ['ONBOARDING', 'FOUNDATION', 'CURRENT PHASE', 'FINAL PROJECT', 'CERTIFICATION'];
    const currentPhase = completedModules <= 1 ? 0 : completedModules <= 3 ? 1 : completedModules <= 5 ? 2 : completedModules <= 6 ? 3 : 4;

    const quickActions = [
        { label: 'My Course', icon: BookOpen, path: '/dashboard/course', bg: '#e0e7ff', color: '#4338ca' },
        { label: 'Assignments', icon: FileText, path: '/dashboard/assignments', bg: '#dbeafe', color: '#1e40af' },
        { label: 'Quiz', icon: ClipboardCheck, path: '/dashboard/quiz', bg: '#fef3c7', color: '#d97706' },
        { label: 'Grades', icon: BarChart3, path: '/dashboard/grades', bg: '#e0e7ff', color: '#4338ca' },
        { label: 'Certificate', icon: Download, path: '/dashboard/certificate', bg: '#d1fae5', color: '#065f46' },
    ];

    return (
        <div className="animate-fadeIn">
            {/* Welcome Banner */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
                borderRadius: isMobile ? '12px' : '16px', padding: isMobile ? '24px 20px' : '32px 36px', marginBottom: isMobile ? '20px' : '28px',
                color: 'white', position: 'relative', overflow: 'hidden',
            }}>
                {!isMobile && (
                    <div style={{ position: 'absolute', right: '30px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }}>
                        <Award size={120} />
                    </div>
                )}
                <div style={{
                    display: 'inline-block', background: '#10b981', color: 'white',
                    fontSize: '0.65rem', fontWeight: '700', padding: '4px 12px',
                    borderRadius: '20px', marginBottom: '12px', letterSpacing: '0.05em', textTransform: 'uppercase',
                }}>
                    SUMMER INTERNSHIP 2024
                </div>
                <h1 style={{ fontSize: isMobile ? '1.4rem' : '1.8rem', fontWeight: '800', marginBottom: '10px', color: 'white' }}>
                    Welcome back{user?.name ? `, ${user.name.split(' ')[0]}!` : '!'}
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.8)', maxWidth: '550px', fontSize: isMobile ? '0.85rem' : '0.95rem', lineHeight: '1.6' }}>
                    You're doing great! You've completed {progressPct}% of your internship program.
                    {completedModules < totalModules && ' Complete all modules to earn your AIUGIP certificate.'}
                </p>
                <button className="btn" style={{
                    marginTop: '16px', background: '#10b981', color: 'white',
                    padding: isMobile ? '8px 18px' : '10px 22px', borderRadius: '8px', fontWeight: '600', fontSize: '0.9rem',
                    display: 'flex', alignItems: 'center', gap: '8px',
                }} onClick={() => navigate('/dashboard/course')}>
                    Resume Learning <ChevronRight size={16} />
                </button>
            </div>

            {/* Stats Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isSmall ? '1fr' : isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                gap: isMobile ? '12px' : '20px', marginBottom: isMobile ? '20px' : '32px',
            }}>
                {/* Course Progress */}
                <div className="glass-card" style={{ padding: isMobile ? '16px' : '22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingUp size={20} style={{ color: '#2563eb' }} />
                        </div>
                        {progressPct > 0 && !isSmall && (
                            <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#10b981', background: '#d1fae5', padding: '3px 8px', borderRadius: '20px' }}>
                                +{Math.round(progressPct / 10)}%
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: '0.65rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>COURSE PROGRESS</div>
                    <div style={{ fontSize: isMobile ? '1.6rem' : '2rem', fontWeight: '800', fontFamily: "'Outfit', sans-serif", color: '#0f172a' }}>{progressPct}%</div>
                    <div className="progress-bar" style={{ height: '4px', marginTop: '8px' }}>
                        <div className="progress-fill" style={{ width: `${progressPct}%`, background: '#2563eb' }}></div>
                    </div>
                </div>

                {/* Modules Done */}
                <div className="glass-card" style={{ padding: isMobile ? '16px' : '22px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                        <Star size={20} style={{ color: '#059669' }} />
                    </div>
                    <div style={{ fontSize: '0.65rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>MODULES DONE</div>
                    <div style={{ fontSize: isMobile ? '1.6rem' : '2rem', fontWeight: '800', fontFamily: "'Outfit', sans-serif", color: '#0f172a' }}>
                        {completedModules}<span style={{ fontSize: '1rem', fontWeight: '400', color: '#94a3b8' }}>/{totalModules}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                        {completedModules < totalModules ? `Module ${completedModules + 1} next` : 'All complete!'}
                    </div>
                </div>

                {/* Current Grade */}
                <div className="glass-card" style={{ padding: isMobile ? '16px' : '22px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                        <Award size={20} style={{ color: '#d97706' }} />
                    </div>
                    <div style={{ fontSize: '0.65rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>CURRENT GRADE</div>
                    <div style={{ fontSize: isMobile ? '1.6rem' : '2rem', fontWeight: '800', fontFamily: "'Outfit', sans-serif", color: '#0f172a' }}>
                        {displayLetter}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Score: {displayScore}</div>
                    {!showFinalGrade && !fallbackGrade && (
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '8px', lineHeight: 1.45 }}>
                            Complete every module, all quizzes, and graded assignments to unlock your final grade.
                        </div>
                    )}
                </div>

                {/* Total Duration */}
                <div className="glass-card" style={{ padding: isMobile ? '16px' : '22px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                        <Clock size={20} style={{ color: '#4338ca' }} />
                    </div>
                    <div style={{ fontSize: '0.65rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>TOTAL DURATION</div>
                    <div style={{ fontSize: isMobile ? '1.6rem' : '2rem', fontWeight: '800', fontFamily: "'Outfit', sans-serif", color: '#0f172a' }}>
                        {durationLabel}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Auto-calculated from all module content</div>
                </div>
            </div>

            {/* Journey Milestone Tracker */}
           



            {/* Quick Actions */}
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '16px', fontStyle: 'italic' }}>Quick Actions</h2>
            <div style={{
                display: 'grid',
                gridTemplateColumns: isSmall ? 'repeat(3, 1fr)' : isMobile ? 'repeat(3, 1fr)' : 'repeat(5, 1fr)',
                gap: isMobile ? '10px' : '16px', marginBottom: isMobile ? '20px' : '28px',
            }}>
                {quickActions.map((a, i) => (
                    <div key={i} className="glass-card" style={{
                        padding: isMobile ? '14px 10px' : '20px', textAlign: 'center', cursor: 'pointer',
                    }} onClick={() => navigate(a.path)}>
                        <div style={{
                            width: isMobile ? '40px' : '52px', height: isMobile ? '40px' : '52px', borderRadius: '14px', background: a.bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px',
                        }}>
                            <a.icon size={isMobile ? 20 : 24} style={{ color: a.color }} />
                        </div>
                        <div style={{ fontSize: isMobile ? '0.72rem' : '0.85rem', fontWeight: '600', color: '#334155' }}>{a.label}</div>
                    </div>
                ))}
            </div>

            {/* Help Desk Banner */}
            <div className="glass-card" style={{
                padding: isMobile ? '16px' : '18px 24px',
                display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
                gap: isMobile ? '12px' : '16px', marginBottom: '20px',
                flexDirection: isMobile ? 'column' : 'row',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <HelpCircle size={22} style={{ color: '#4338ca' }} />
                    </div>
                    <div>
                        <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#0f172a' }}>Need academic help?</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Our help desk is available 24/7 for technical and course queries.</div>
                    </div>
                </div>
                <button className="btn btn-secondary" style={{ fontWeight: '700', fontSize: '0.85rem', whiteSpace: 'nowrap' }} onClick={() => navigate('/dashboard/help')}>
                    Contact Support
                </button>
            </div>
        </div>
    );
}
