import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { courseAPI, quizAPI } from '../services/api';
import { Clock, CheckCircle, XCircle, AlertCircle, ArrowLeft, ArrowRight, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';

function useWindowWidth() {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => { const h = () => setWidth(window.innerWidth); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h); }, []);
    return width;
}

export default function QuizPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const lockQuizId = (searchParams.get('quizId') || '').trim();

    const w = useWindowWidth();
    const isMobile = w <= 768;
    const [quizzes, setQuizzes] = useState([]);
    const [activeQuiz, setActiveQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentQ, setCurrentQ] = useState(0);
    const [answers, setAnswers] = useState({});
    const [marked, setMarked] = useState(new Set());
    const [timeLeft, setTimeLeft] = useState(0);
    const [result, setResult] = useState(null);
    const [phase, setPhase] = useState('list');
    const [loading, setLoading] = useState(true);
    const [showPalette, setShowPalette] = useState(false);
    const timerRef = useRef(null);

    const warnedBadQuizParam = useRef(false);

    useEffect(() => { loadQuizzes(); return () => clearInterval(timerRef.current); }, []);

    useEffect(() => {
        warnedBadQuizParam.current = false;
    }, [lockQuizId]);

    useEffect(() => {
        if (loading || phase !== 'list' || !lockQuizId || quizzes.length === 0) return;
        const found = quizzes.some((q) => String(q.id) === String(lockQuizId));
        if (!found && !warnedBadQuizParam.current) {
            warnedBadQuizParam.current = true;
            toast.error('Quiz not found for this link.');
        }
    }, [loading, phase, lockQuizId, quizzes]);

    const loadQuizzes = async () => {
        try {
            const courses = await courseAPI.list();
            const quizMap = new Map();
            for (const course of courses.data) {
                for (const mod of course.modules) {
                    // Show any module-linked quiz, not only "assessment" module type.
                    if (mod.quiz_id) {
                        try {
                            const q = await quizAPI.get(mod.quiz_id);
                            quizMap.set(q.data.id, q.data);
                        } catch { }
                    }
                }
            }
            setQuizzes(Array.from(quizMap.values()));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const startQuiz = async (quiz) => {
        try {
            await quizAPI.start(quiz.id);
            setActiveQuiz(quiz); setQuestions(quiz.questions); setTimeLeft(quiz.time_limit_minutes * 60);
            setAnswers({}); setMarked(new Set()); setCurrentQ(0); setPhase('quiz');
            timerRef.current = setInterval(() => { setTimeLeft(prev => { if (prev <= 1) { clearInterval(timerRef.current); handleSubmit(); return 0; } return prev - 1; }); }, 1000);
        } catch (err) { toast.error(err.response?.data?.detail || 'Failed to start quiz'); }
    };

    const handleSubmit = async () => {
        clearInterval(timerRef.current);
        try {
            const responses = Object.entries(answers).map(([qId, opt]) => ({ question_id: qId, selected_option: opt }));
            const res = await quizAPI.submit(activeQuiz.id, { responses });
            setResult(res.data); setPhase('result'); toast.success('Quiz submitted! ✅');
        } catch (err) { toast.error(err.response?.data?.detail || 'Submission failed'); }
    };

    const toggleMark = () => {
        const q = questions[currentQ];
        setMarked(prev => { const s = new Set(prev); s.has(q.id) ? s.delete(q.id) : s.add(q.id); return s; });
    };

    const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    const getQStatus = (q, idx) => {
        if (idx === currentQ) return 'current';
        if (marked.has(q.id)) return 'marked';
        if (answers[q.id]) return 'answered';
        return 'unvisited';
    };

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

    // ─── Quiz List ───
    if (phase === 'list') {
        return (
            <div className="animate-fadeIn">
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>AIUGIP INTERNSHIP</div>
                    <h1 style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>Quiz & Assessment</h1>
                    <p style={{ color: '#64748b', fontSize: '0.92rem' }}>Final assessment MCQ test</p>
                </div>
                {lockQuizId && (
                    <div style={{
                        marginBottom: '16px', padding: '12px 16px', borderRadius: '12px',
                        background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: '0.85rem', color: '#1e40af',
                    }}>
                        You opened quizzes from a module. Only that quiz can be attempted; others are disabled until you return via <strong>My Course</strong> or clear the filter.
                    </div>
                )}
                {quizzes.length > 0 ? quizzes.map((q) => {
                    const lockedByModule = Boolean(lockQuizId && String(q.id) !== String(lockQuizId));
                    return (
                        <div
                            key={q.id}
                            className="glass-card"
                            style={{
                                padding: isMobile ? '20px' : '28px', marginBottom: '16px',
                                opacity: lockedByModule ? 0.55 : 1,
                            }}
                        >
                            <span style={{ background: '#1e3a5f', color: 'white', fontSize: '0.6rem', fontWeight: '700', padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase' }}>DATA SCIENCE & AI</span>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#0f172a', margin: '12px 0 6px' }}>{q.title}</h3>
                            <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '14px' }}>{q.description}</p>
                            {lockedByModule && (
                                <p style={{ fontSize: '0.8rem', color: '#b45309', marginBottom: '12px' }}>
                                    Open this quiz from <strong>Start quiz now</strong> on its module, or use the Quiz menu without a module link to access all quizzes.
                                </p>
                            )}
                            <div style={{ display: 'flex', gap: '14px', marginBottom: '18px', flexWrap: 'wrap', fontSize: '0.82rem', color: '#64748b' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> {q.time_limit_minutes} min</span>
                                <span>{q.questions?.length || 30} Qs</span>
                                <span>Total: {q.total_marks}</span>
                                <span>Attempts: {q.attempts_used ?? 0}/{q.max_attempts ?? 0}</span>
                                <span>Best: {q.best_score != null ? `${q.best_score}/${q.total_marks} (${q.best_percentage}%)` : '—'}</span>
                            </div>
                            {!lockedByModule && q.attempts_left > 0 ? (
                                <button type="button" className="btn" style={{ background: '#0f172a', color: 'white', padding: '10px 28px', borderRadius: '10px', fontWeight: '700', fontSize: '0.88rem' }} onClick={() => startQuiz(q)}>
                                    Attempt Quiz ({q.attempts_left} left)
                                </button>
                            ) : !lockedByModule ? (
                                <button type="button" className="btn" disabled style={{ background: '#94a3b8', color: 'white', padding: '10px 28px', borderRadius: '10px', fontWeight: '700', fontSize: '0.88rem', cursor: 'not-allowed' }}>
                                    Attempts Exhausted
                                </button>
                            ) : (
                                <button type="button" className="btn" disabled style={{ background: '#e2e8f0', color: '#94a3b8', padding: '10px 28px', borderRadius: '10px', fontWeight: '700', fontSize: '0.88rem', cursor: 'not-allowed' }}>
                                    {"Not this module's quiz"}
                                </button>
                            )}
                        </div>
                    );
                }) : (
                    <div className="glass-card" style={{ padding: '50px', textAlign: 'center' }}>
                        <AlertCircle size={36} style={{ color: '#94a3b8', marginBottom: '12px' }} />
                        <h3 style={{ color: '#475569', marginBottom: '6px' }}>No Quizzes Available</h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>Complete all modules first.</p>
                    </div>
                )}
            </div>
        );
    }

    // ─── Quiz Taking ───
    if (phase === 'quiz') {
        const q = questions[currentQ];
        const totalQ = questions.length;

        const PaletteContent = () => (
            <>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', fontStyle: 'italic', marginBottom: '4px' }}>Question Palette</h3>
                <div style={{ fontSize: '0.65rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '14px' }}>MODULE 01: FUNDAMENTALS</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '16px' }}>
                    {[{ color: '#0f172a', label: 'ANSWERED' }, { color: '#e2e8f0', label: 'UNVISITED' }, { color: '#1e3a5f', label: 'CURRENT', border: true }, { color: '#f59e0b', label: 'MARKED' }].map((l, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: l.color, border: l.border ? '2px solid #0f172a' : 'none' }}></div>
                            <span style={{ fontSize: '0.55rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>{l.label}</span>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '5px' }}>
                    {questions.map((qq, idx) => {
                        const status = getQStatus(qq, idx);
                        const bg = status === 'current' ? '#1e3a5f' : status === 'answered' ? '#0f172a' : status === 'marked' ? '#f59e0b' : '#f1f5f9';
                        const clr = status === 'unvisited' ? '#94a3b8' : 'white';
                        return (
                            <button key={idx} onClick={() => { setCurrentQ(idx); if (isMobile) setShowPalette(false); }} style={{
                                width: '32px', height: '32px', borderRadius: '6px', background: bg, color: clr,
                                border: status === 'current' ? '2px solid #0f172a' : '1px solid #e2e8f0',
                                fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>{String(idx + 1).padStart(2, '0')}</button>
                        );
                    })}
                </div>
            </>
        );

        return (
            <div className="animate-fadeIn" style={{ margin: isMobile ? '0' : '-28px -32px', minHeight: isMobile ? 'auto' : 'calc(100vh - var(--header-height))' }}>
                {/* Assessment Header */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: isMobile ? '10px 16px' : '14px 28px', background: 'white', borderBottom: '1px solid #e2e8f0',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px' }}>
                        <span style={{ fontWeight: '800', fontSize: isMobile ? '0.88rem' : '1rem', color: '#0f172a', fontFamily: "'Outfit'" }}>AIUGIP</span>
                        {!isMobile && <span style={{ fontSize: '0.88rem', color: '#475569' }}>Assessment Portal</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {isMobile && (
                            <button onClick={() => setShowPalette(!showPalette)} style={{
                                padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0',
                                background: showPalette ? '#e0e7ff' : 'white', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', color: '#0f172a',
                            }}>Q{currentQ + 1}/{totalQ}</button>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#10b981', color: 'white', padding: '6px 14px', borderRadius: '8px', fontWeight: '700', fontSize: '0.85rem' }}>
                            <Clock size={14} /> {formatTime(timeLeft)}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: isMobile ? 'auto' : 'calc(100vh - var(--header-height) - 60px)' }}>
                    {/* Question Palette — side panel on desktop, dropdown on mobile */}
                    {!isMobile && (
                        <div style={{ width: '220px', padding: '20px', borderRight: '1px solid #e2e8f0', background: 'white' }}>
                            <PaletteContent />
                        </div>
                    )}
                    {isMobile && showPalette && (
                        <div style={{ padding: '16px', background: 'white', borderBottom: '1px solid #e2e8f0' }}>
                            <PaletteContent />
                        </div>
                    )}

                    {/* Question Content */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ flex: 1, padding: isMobile ? '20px 16px' : '32px 40px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
                                <div>
                                    <span style={{ background: '#1e3a5f', color: 'white', fontSize: '0.55rem', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', textTransform: 'uppercase' }}>DATA SCIENCE & AI</span>
                                    <div style={{ marginTop: '8px' }}>
                                        <span style={{ fontSize: isMobile ? '1.2rem' : '1.6rem', fontWeight: '800', color: '#0f172a', fontFamily: "'Outfit'" }}>Question {String(currentQ + 1).padStart(2, '0')}</span>
                                        <span style={{ fontSize: '1rem', color: '#cbd5e1', fontWeight: '400' }}> / {totalQ}</span>
                                    </div>
                                </div>
                                <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>WEIGHTAGE: {q.marks || 4} MARKS</span>
                            </div>

                            <div style={{ fontSize: isMobile ? '0.92rem' : '1.05rem', color: '#334155', lineHeight: '1.7', marginBottom: '24px' }}>{q.question_text}</div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {['a', 'b', 'c', 'd'].map(opt => {
                                    const isSelected = answers[q.id] === opt;
                                    return (
                                        <div key={opt} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))} style={{
                                            display: 'flex', alignItems: 'center', gap: '14px',
                                            padding: isMobile ? '12px 14px' : '16px 20px', borderRadius: '12px',
                                            border: isSelected ? '2px solid #0f172a' : '1px solid #e2e8f0',
                                            background: isSelected ? '#f0f4ff' : 'white', cursor: 'pointer',
                                        }}>
                                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: isSelected ? '5px solid #0f172a' : '2px solid #cbd5e1', background: 'white', flexShrink: 0 }}></div>
                                            <span style={{ fontSize: isMobile ? '0.85rem' : '0.95rem', color: '#334155', lineHeight: '1.5' }}>{q[`option_${opt}`]}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Bottom Nav */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: isMobile ? '12px 16px' : '16px 40px', borderTop: '1px solid #e2e8f0', background: 'white',
                            flexWrap: 'wrap', gap: '8px',
                        }}>
                            <button disabled={currentQ === 0} onClick={() => setCurrentQ(currentQ - 1)} style={{
                                display: 'flex', alignItems: 'center', gap: '6px', padding: isMobile ? '8px 14px' : '10px 22px',
                                borderRadius: '8px', border: '2px dashed #cbd5e1', background: 'white',
                                color: currentQ === 0 ? '#cbd5e1' : '#0f172a', fontWeight: '600', fontSize: isMobile ? '0.8rem' : '0.9rem',
                                cursor: currentQ === 0 ? 'not-allowed' : 'pointer',
                            }}><ArrowLeft size={14} /> Previous</button>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button onClick={toggleMark} style={{
                                    padding: isMobile ? '8px 12px' : '10px 22px', borderRadius: '8px',
                                    border: '1px solid #e2e8f0', background: marked.has(q.id) ? '#fef3c7' : 'white',
                                    color: '#0f172a', fontWeight: '600', fontSize: isMobile ? '0.78rem' : '0.9rem', cursor: 'pointer',
                                }}>Mark for Review</button>
                                {currentQ < totalQ - 1 ? (
                                    <button onClick={() => setCurrentQ(currentQ + 1)} style={{
                                        display: 'flex', alignItems: 'center', gap: '6px', padding: isMobile ? '8px 14px' : '10px 22px',
                                        borderRadius: '8px', background: '#0f172a', color: 'white', fontWeight: '600', fontSize: isMobile ? '0.8rem' : '0.9rem', cursor: 'pointer', border: 'none',
                                    }}>Save & Next <ArrowRight size={14} /></button>
                                ) : (
                                    <button onClick={handleSubmit} style={{
                                        display: 'flex', alignItems: 'center', gap: '6px', padding: isMobile ? '8px 14px' : '10px 22px',
                                        borderRadius: '8px', background: '#10b981', color: 'white', fontWeight: '600', fontSize: isMobile ? '0.8rem' : '0.9rem', cursor: 'pointer', border: 'none',
                                    }}><CheckCircle size={14} /> Submit Quiz</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Results ───
    return (
        <div className="animate-fadeIn" style={{ maxWidth: '700px', margin: '0 auto' }}>
            <div className="glass-card" style={{ padding: isMobile ? '28px 20px' : '48px', textAlign: 'center' }}>
                <div style={{ width: isMobile ? '80px' : '120px', height: isMobile ? '80px' : '120px', borderRadius: '50%', margin: '0 auto 20px', background: result.percentage >= 50 ? '#d1fae5' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {result.percentage >= 50 ? <CheckCircle size={isMobile ? 40 : 56} style={{ color: '#10b981' }} /> : <XCircle size={isMobile ? 40 : 56} style={{ color: '#ef4444' }} />}
                </div>
                <h2 style={{ fontSize: isMobile ? '1.2rem' : '1.5rem', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>{result.percentage >= 50 ? 'Congratulations! 🎉' : 'Try Again!'}</h2>
                <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '0.92rem' }}>{result.percentage >= 50 ? 'You passed the assessment.' : 'You need 50% to pass.'}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                    {[{ val: result.score, label: 'Score', color: '#4f46e5' }, { val: result.total_marks, label: 'Total', color: '#0f172a' }, { val: `${result.percentage}%`, label: 'Percentage', color: result.percentage >= 50 ? '#10b981' : '#ef4444' }].map((s, i) => (
                        <div key={i} style={{ padding: '14px', background: '#f8fafc', borderRadius: '12px' }}>
                            <div style={{ fontSize: isMobile ? '1.4rem' : '1.8rem', fontWeight: '800', color: s.color, fontFamily: "'Outfit'" }}>{s.val}</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{s.label}</div>
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    className="btn"
                    style={{ background: '#0f172a', color: 'white', padding: '10px 28px', borderRadius: '10px', fontWeight: '700', fontSize: '0.88rem' }}
                    onClick={() => {
                        if (lockQuizId) {
                            navigate('/dashboard/course');
                        } else {
                            setPhase('list');
                            setResult(null);
                        }
                    }}
                >
                    {lockQuizId ? 'Back to My Course' : 'Back to Quizzes'}
                </button>
            </div>
        </div>
    );
}
