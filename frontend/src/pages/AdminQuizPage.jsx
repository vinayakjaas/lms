import { useState, useEffect, useMemo } from 'react';
import { courseAPI, adminAPI } from '../services/api';
import { Plus, FileText, CheckCircle, Upload, Trash2, Eye, Send, ArrowRight, TrendingUp, AlertCircle, ChevronLeft, ChevronRight, Filter, Search, Sparkles, Award, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';

function useWindowWidth() {
    const [w, setW] = useState(window.innerWidth);
    useEffect(() => { const h = () => setW(window.innerWidth); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h); }, []);
    return w;
}

export default function AdminQuizPage() {
    const w = useWindowWidth();
    const isMobile = w <= 768;
    const isSmall = w <= 480;
    const [view, setView] = useState('list'); // list | create
    const [editingQuizId, setEditingQuizId] = useState(null);
    const [quizFilter, setQuizFilter] = useState('All Quizzes');
    const [loadingQuizzes, setLoadingQuizzes] = useState(false);
    const [quizzes, setQuizzes] = useState([]);
    const [courses, setCourses] = useState([]);

    // List controls
    const [quizSearch, setQuizSearch] = useState('');
    const [moduleFilterId, setModuleFilterId] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 4;

    // Create form linking
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [selectedModuleId, setSelectedModuleId] = useState('');

    // Create form state
    const [quizTitle, setQuizTitle] = useState('');
    const [timeLimit, setTimeLimit] = useState(45);
    const [questions, setQuestions] = useState([
        { id: 1, prompt: '', options: ['', '', '', ''], correct: 1 },
    ]);

    // Preview modal
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewQuiz, setPreviewQuiz] = useState(null);
    const [searchParams] = useSearchParams();

    const addQuestion = () => {
        setQuestions([...questions, { id: questions.length + 1, prompt: '', options: ['', '', '', ''], correct: 0 }]);
    };

    const updateQuestion = (idx, field, value) => {
        const qs = [...questions];
        qs[idx][field] = value;
        setQuestions(qs);
    };

    const updateOption = (qIdx, oIdx, value) => {
        const qs = [...questions];
        qs[qIdx].options[oIdx] = value;
        setQuestions(qs);
    };

    const removeQuestion = (idx) => {
        if (questions.length <= 1) return;
        setQuestions(questions.filter((_, i) => i !== idx));
    };

    const allModules = useMemo(() => {
        const out = [];
        for (const c of courses || []) {
            for (const m of c.modules || []) {
                out.push({
                    id: m.id,
                    title: m.title,
                    course_id: c.id,
                    course_title: c.title,
                    quiz_id: m.quiz_id || null,
                });
            }
        }
        return out;
    }, [courses]);

    const moduleById = useMemo(() => {
        const map = new Map();
        for (const m of allModules) map.set(m.id, m);
        return map;
    }, [allModules]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const [courseRes, quizRes] = await Promise.all([courseAPI.list(), adminAPI.quizzes()]);
                if (cancelled) return;
                setCourses(courseRes.data || []);
                setQuizzes(quizRes.data || []);
            } catch (e) {
                console.error(e);
                if (!cancelled) { setCourses([]); setQuizzes([]); }
            }
        };

        setLoadingQuizzes(true);
        load().finally(() => {
            if (!cancelled) setLoadingQuizzes(false);
        });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (searchParams.get('from') !== 'courses') return;
        setView('create');
        setEditingQuizId(null);
        const presetTitle = searchParams.get('title');
        if (presetTitle) setQuizTitle(presetTitle);
    }, [searchParams]);

    useEffect(() => {
        if (!allModules.length) return;

        const requestedModuleId = searchParams.get('moduleId');
        const requested = requestedModuleId
            ? allModules.find((m) => m.id === requestedModuleId)
            : null;

        // When opened from Course Deploy Content, force selected linked module.
        if (searchParams.get('from') === 'courses' && requested) {
            setSelectedCourseId(requested.course_id);
            setSelectedModuleId(requested.id);
        }

        if (!selectedModuleId) {
            const first = requested || allModules[0];
            setSelectedCourseId(first.course_id);
            setSelectedModuleId(first.id);
        }

        if (!moduleFilterId) {
            setModuleFilterId(allModules[0].id);
        }
    }, [allModules, selectedModuleId, moduleFilterId, searchParams]);

    const handlePublish = async () => {
        if (!quizTitle.trim()) { toast.error('Quiz title required'); return; }
        if (!selectedCourseId || !selectedModuleId) { toast.error('Select a linked module'); return; }
        if (!questions.length) { toast.error('Add at least one question'); return; }

        const payload = {
            title: quizTitle.trim(),
            module_id: selectedModuleId,
            course_id: selectedCourseId,
            time_limit_minutes: Number(timeLimit) || 0,
            questions: questions.map(q => ({
                prompt: q.prompt,
                options: q.options,
                correct: q.correct,
            })),
        };

        try {
            if (editingQuizId) {
                await adminAPI.updateQuiz(editingQuizId, payload);
                toast.success('Quiz updated successfully! ✅');
            } else {
                await adminAPI.createQuiz(payload);
                toast.success('Quiz published successfully! 🎉');
            }
            setEditingQuizId(null);
            setView('list');
            setPage(1);

            const quizRes = await adminAPI.quizzes();
            setQuizzes(quizRes.data || []);
        } catch (err) {
            toast.error(err.response?.data?.detail || (editingQuizId ? 'Failed to update quiz' : 'Failed to create quiz'));
        }
    };

    const handleEditQuiz = async (quiz) => {
        if (!quiz?.id) return;
        setEditingQuizId(quiz.id);
        setView('create');
        setPreviewOpen(false);
        setPreviewLoading(false);

        setQuizTitle(quiz.title || '');
        setTimeLimit(quiz.time_limit_minutes || 30);
        setSelectedCourseId(quiz.course_id || '');
        setSelectedModuleId(quiz.module_id || '');

        try {
            const res = await adminAPI.getQuiz(quiz.id);
            const q = res.data;
            const loadedQuestions = (q.questions || []).map((qq, idx) => ({
                id: idx + 1,
                prompt: qq.prompt || '',
                options: qq.options || ['', '', '', ''],
                correct: typeof qq.correct === 'number' ? qq.correct : 0,
            }));
            setQuestions(loadedQuestions.length ? loadedQuestions : [{ id: 1, prompt: '', options: ['', '', '', ''], correct: 0 }]);
        } catch (err) {
            toast.error(err?.response?.data?.detail || 'Failed to load quiz for editing');
            setEditingQuizId(null);
        }
    };

    const handleDeleteQuiz = async (quiz) => {
        if (!quiz?.id) return;
        const ok = window.confirm(`Delete quiz "${quiz.title}"?\n\nThis will delete the quiz and all submitted attempts/marks for that quiz.`);
        if (!ok) return;
        try {
            await adminAPI.deleteQuiz(quiz.id);
            toast.success('Quiz deleted');
            if (editingQuizId === quiz.id) setEditingQuizId(null);
            const quizRes = await adminAPI.quizzes();
            setQuizzes(quizRes.data || []);
        } catch (err) {
            toast.error(err?.response?.data?.detail || 'Failed to delete quiz');
        }
    };

    const handlePreviewBuilder = () => {
        setPreviewQuiz({
            id: 'preview',
            title: quizTitle || 'Untitled Quiz',
            module_id: selectedModuleId,
            course_id: selectedCourseId,
            status: 'draft',
            time_limit_minutes: Number(timeLimit) || 0,
            total_marks: questions.length * 10,
            questions: questions.map(q => ({
                id: q.id,
                prompt: q.prompt,
                options: q.options,
                correct: q.correct,
                marks: 10,
                explanation: null,
            })),
        });
        setPreviewOpen(true);
    };

    const handleViewQuiz = async (quiz) => {
        setPreviewOpen(true);
        setPreviewLoading(true);
        setPreviewQuiz(null);
        try {
            const res = await adminAPI.getQuiz(quiz.id);
            setPreviewQuiz(res.data);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to load quiz');
            setPreviewOpen(false);
        } finally {
            setPreviewLoading(false);
        }
    };

    const PreviewModal = () => {
        if (!previewOpen) return null;

        const mod = previewQuiz?.module_id ? moduleById.get(previewQuiz.module_id) : null;
        return (
            <div
                onClick={() => setPreviewOpen(false)}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    background: 'rgba(15, 23, 42, 0.55)',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: isMobile ? 'flex-end' : 'center',
                    justifyContent: 'center',
                    padding: isMobile ? '0' : '24px',
                }}
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="glass-card"
                    style={{
                        width: isMobile ? '100%' : '720px',
                        maxHeight: isMobile ? '86vh' : '80vh',
                        overflow: 'auto',
                        padding: isMobile ? '14px' : '22px',
                        background: 'white',
                        borderRadius: '16px',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div>
                            <div style={{ fontWeight: '800', fontSize: '1.05rem', color: '#0f172a' }}>{previewQuiz?.title || 'Preview'}</div>
                            <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '4px' }}>
                                {mod ? `${mod.course_title} - ${mod.title}` : previewQuiz?.module_id || ''}
                            </div>
                        </div>
                        <button
                            onClick={() => setPreviewOpen(false)}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#94a3b8',
                                fontWeight: '800',
                                fontSize: '1.2rem',
                                lineHeight: 1,
                            }}
                            aria-label="Close preview"
                        >
                            ×
                        </button>
                    </div>

                    {previewLoading ? (
                        <div style={{ padding: '30px 0', textAlign: 'center', color: '#64748b' }}>Loading preview...</div>
                    ) : previewQuiz ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', color: '#64748b', fontSize: '0.78rem' }}>
                                <span style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 10px', borderRadius: '10px' }}>
                                    Time Limit: {previewQuiz.time_limit_minutes} min
                                </span>
                                <span style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 10px', borderRadius: '10px' }}>
                                    Questions: {previewQuiz.questions?.length || 0}
                                </span>
                            </div>

                            {(previewQuiz.questions || []).map((q, idx) => (
                                <div key={q.id || idx} style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px', background: '#f8fafc' }}>
                                    <div style={{ fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
                                        Q{idx + 1}. {q.prompt}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {(q.options || []).map((opt, oi) => {
                                            const isCorrect = typeof q.correct === 'number' ? oi === q.correct : false;
                                            return (
                                                <div
                                                    key={oi}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        padding: '10px 12px',
                                                        borderRadius: '12px',
                                                        border: isCorrect ? '2px solid #10b981' : '1px solid #e2e8f0',
                                                        background: isCorrect ? '#d1fae5' : 'white',
                                                    }}
                                                >
                                                    <div style={{ width: '22px', textAlign: 'center', fontWeight: '800', color: '#0f172a' }}>
                                                        {String.fromCharCode(65 + oi)}
                                                    </div>
                                                    <div style={{ color: '#334155', fontWeight: 600 }}>{opt || '—'}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {q.explanation ? (
                                        <div style={{ marginTop: '10px', color: '#64748b', fontSize: '0.82rem' }}>{q.explanation}</div>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '30px 0', textAlign: 'center', color: '#64748b' }}>No preview available.</div>
                    )}
                </div>
            </div>
        );
    };

    const filteredQuizzes = useMemo(() => {
        const s = (quizSearch || '').trim().toLowerCase();
        let list = quizzes || [];

        if (quizFilter === 'By Module' && moduleFilterId) {
            list = list.filter(q => q.module_id === moduleFilterId);
        }

        if (s) {
            list = list.filter(q => {
                const mod = moduleById.get(q.module_id);
                return (
                    (q.title || '').toLowerCase().includes(s) ||
                    (mod?.title || '').toLowerCase().includes(s) ||
                    (mod?.course_title || '').toLowerCase().includes(s)
                );
            });
        }

        return list;
    }, [quizzes, quizFilter, moduleFilterId, quizSearch, moduleById]);

    const pagedQuizzes = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredQuizzes.slice(start, start + pageSize);
    }, [filteredQuizzes, page, pageSize]);

    // Pagination helpers (for the list view UI).
    const totalItems = filteredQuizzes.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const showingStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
    const showingEnd = Math.min(page * pageSize, totalItems);

    const pageNumbers = (() => {
        const maxButtons = 5;
        if (totalPages <= maxButtons) return Array.from({ length: totalPages }, (_, i) => i + 1);

        const start = Math.max(1, page - 2);
        const end = Math.min(totalPages, start + maxButtons - 1);
        const nums = [];
        for (let p = start; p <= end; p += 1) nums.push(p);
        return nums;
    })();

    useEffect(() => {
        setPage(1);
    }, [quizFilter, moduleFilterId, quizSearch]);

    const statCards = useMemo(() => {
        const totalQuizzes = quizzes.length;
        const totalAttempts = quizzes.reduce((sum, q) => sum + (q.total_attempts || 0), 0);

        // Weighted average by completed attempts.
        const totalCompletedAttempts = quizzes.reduce((sum, q) => sum + (q.total_attempts || 0), 0);
        let weightedSum = 0;
        for (const q of quizzes) {
            const attempts = q.total_attempts || 0;
            if (attempts > 0) weightedSum += (q.avg_score || 0) * attempts;
        }
        const avgSuccessRate = totalCompletedAttempts > 0 ? Math.round((weightedSum / totalCompletedAttempts) * 10) / 10 : 0;

        const draftCount = quizzes.filter(q => (q.status || '').toLowerCase() !== 'active').length;

        return [
            {
                label: 'Total Quizzes',
                value: totalQuizzes.toString(),
                icon: FileText,
                bg: '#dbeafe',
                color: '#2563eb',
                badge: 'All Time',
                badgeBg: '#d1fae5',
                badgeColor: '#065f46',
            },
            {
                label: 'Completed Attempts',
                value: totalAttempts.toLocaleString(),
                icon: CheckCircle,
                bg: '#e0e7ff',
                color: '#4f46e5',
                badge: 'All Time',
                badgeBg: '#f1f5f9',
                badgeColor: '#64748b',
            },
            {
                label: 'Avg. Success Rate',
                value: `${avgSuccessRate}%`,
                icon: TrendingUp,
                bg: '#fef3c7',
                color: '#d97706',
                badge: avgSuccessRate > 0 ? 'Overall' : 'No Data',
                badgeBg: '#d1fae5',
                badgeColor: '#065f46',
            },
            {
                label: 'Draft Mode',
                value: draftCount.toString(),
                icon: AlertCircle,
                bg: '#fee2e2',
                color: '#ef4444',
                badge: draftCount > 0 ? 'Action Required' : 'All Good',
                badgeBg: '#fee2e2',
                badgeColor: '#ef4444',
            },
        ];
    }, [quizzes]);

    // ─── Create Assessment View ───
    if (view === 'create') {
        return (
            <div className="animate-fadeIn">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-end', marginBottom: '28px', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
                    <div>
                        <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>QUIZ BUILDER</div>
                        <h1 style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: '800', color: '#0f172a' }}>Create Assessment</h1>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button className="btn" onClick={handlePreviewBuilder} style={{ background: 'white', border: '1px solid #e2e8f0', color: '#0f172a', padding: '10px 18px', borderRadius: '10px', fontWeight: '600', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Eye size={14} /> Preview Quiz
                        </button>
                        <button className="btn" onClick={handlePublish} style={{ background: '#0f172a', color: 'white', padding: '10px 18px', borderRadius: '10px', fontWeight: '700', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Send size={14} /> {editingQuizId ? 'Update Quiz' : 'Publish Quiz'}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', gap: isMobile ? '16px' : '28px' }}>
                    {/* Left: General Info */}
                    <div>
                        <div className="glass-card" style={{ padding: isMobile ? '20px' : '24px', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '0.65rem', fontWeight: '700', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '18px' }}>GENERAL INFORMATION</h3>

                            <label style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>QUIZ TITLE</label>
                            <input type="text" placeholder="e.g., Advanced Data Structures" value={quizTitle} onChange={e => setQuizTitle(e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', color: '#334155', background: '#f8fafc', outline: 'none', marginBottom: '16px' }}
                            />

                            <label style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>LINKED MODULE</label>
                            <select
                                value={`${selectedCourseId}|${selectedModuleId}`}
                                onChange={(e) => {
                                    const [cid, mid] = e.target.value.split('|');
                                    setSelectedCourseId(cid);
                                    setSelectedModuleId(mid);
                                }}
                                style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.82rem', color: '#334155', background: '#f8fafc', outline: 'none', cursor: 'pointer', marginBottom: '16px' }}
                            >
                                <option value="" disabled>Select linked module...</option>
                                {allModules.map((m) => (
                                    <option key={`${m.course_id}-${m.id}`} value={`${m.course_id}|${m.id}`}>
                                        {m.course_title} - {m.title}
                                    </option>
                                ))}
                            </select>

                            <label style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>TIME LIMIT (MINUTES)</label>
                            <input type="number" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))}
                                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', color: '#334155', background: '#f8fafc', outline: 'none' }}
                            />
                        </div>

                        {/* Creator Note */}
                        <div style={{ background: '#fef3c7', borderLeft: '3px solid #f59e0b', borderRadius: '0 10px 10px 0', padding: '16px' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: '700', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                ℹ️ CREATOR NOTE
                            </div>
                            <p style={{ fontSize: '0.82rem', color: '#92400e', lineHeight: '1.6' }}>
                                Ensure questions align with the Bloom's Taxonomy levels defined in the module curriculum.
                            </p>
                        </div>
                    </div>

                    {/* Right: Questions */}
                    <div>
                        {questions.map((q, idx) => (
                            <div key={q.id} className="glass-card" style={{ padding: isMobile ? '18px' : '24px', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#b8a070', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: '700' }}>{String(idx + 1).padStart(2, '0')}</span>
                                        <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>QUESTION {['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'][idx] || idx + 1}</span>
                                    </div>
                                    <button onClick={() => removeQuestion(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <label style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>QUESTION PROMPT</label>
                                <textarea placeholder="Enter your question here..." value={q.prompt} onChange={e => updateQuestion(idx, 'prompt', e.target.value)} rows={3}
                                    style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', background: '#f8fafc', outline: 'none', resize: 'vertical', marginBottom: '16px' }}
                                />

                                <div style={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr' : '1fr 1fr', gap: '12px' }}>
                                    {['A', 'B', 'C', 'D'].map((opt, oi) => (
                                        <div key={opt}>
                                            <label style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>OPTION {opt}</label>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <input type="text" placeholder={`Choice ${oi + 1}`} value={q.options[oi]} onChange={e => updateOption(idx, oi, e.target.value)}
                                                    style={{ flex: 1, padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.82rem', background: '#f8fafc', outline: 'none' }}
                                                />
                                                <button onClick={() => updateQuestion(idx, 'correct', oi)} style={{
                                                    width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                                                    background: q.correct === oi ? '#10b981' : '#f1f5f9',
                                                    border: q.correct === oi ? '2px solid #10b981' : '1px solid #e2e8f0',
                                                    color: q.correct === oi ? 'white' : '#94a3b8', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                    <CheckCircle size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* Add Question */}
                        <div onClick={addQuestion} style={{
                            border: '2px dashed #cbd5e1', borderRadius: '14px', padding: '28px',
                            textAlign: 'center', cursor: 'pointer',
                        }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                                <Plus size={20} style={{ color: '#64748b' }} />
                            </div>
                            <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>ADD NEXT QUESTION</div>
                        </div>

                        {/* Footer Info */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexWrap: 'wrap', gap: '12px' }}>
                            <div style={{ display: 'flex', gap: '16px', fontSize: '0.72rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>
                                <span>TOTAL: {questions.length} QUESTION{questions.length > 1 ? 'S' : ''}</span>
                                <span>TOTAL MARKS: {questions.length * 10}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Upload size={14} /> IMPORT FROM CSV
                                </button>
                                <button onClick={() => setQuestions([{ id: 1, prompt: '', options: ['', '', '', ''], correct: 0 }])} style={{ background: 'none', border: 'none', color: '#94a3b8', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer' }}>🔄 CLEAR ALL</button>
                            </div>
                        </div>
                    </div>
                </div>
                <PreviewModal />
            </div>
        );
    }

    // ─── List View ───
    return (
        <div className="animate-fadeIn">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-end', marginBottom: '8px', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
                <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>ACADEMIC ASSESSMENT</div>
                    <h1 style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: '800', color: '#0f172a' }}>Quiz Management</h1>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '500px', lineHeight: '1.6' }}>
                        Oversee and optimize your institutional assessments. Track student performance trends and manage quiz availability across all academic modules.
                    </p>
                </div>
                <button className="btn" onClick={() => { setEditingQuizId(null); setView('create'); }} style={{
                    background: '#10b981', color: 'white', padding: '12px 22px', borderRadius: '10px',
                    fontWeight: '700', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                    <Plus size={16} /> Add New Quiz
                </button>
            </div>

            {/* Stats */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isSmall ? 'repeat(2, 1fr)' : isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                gap: isMobile ? '12px' : '20px', margin: isMobile ? '20px 0' : '28px 0',
            }}>
                {statCards.map((s, i) => (
                    <div key={i} className="glass-card" style={{ padding: isMobile ? '16px' : '20px', position: 'relative' }}>
                        <span style={{
                            position: 'absolute', top: '12px', right: '12px',
                            fontSize: '0.5rem', fontWeight: '700', padding: '3px 8px', borderRadius: '20px',
                            background: s.badgeBg, color: s.badgeColor, textTransform: 'uppercase',
                        }}>{s.badge}</span>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                            <s.icon size={18} style={{ color: s.color }} />
                        </div>
                        <div style={{ fontSize: '0.6rem', fontWeight: '600', color: '#94a3b8', marginBottom: '4px' }}>{s.label}</div>
                        <div style={{ fontSize: isMobile ? '1.4rem' : '1.8rem', fontWeight: '800', color: '#0f172a', fontFamily: "'Outfit'" }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Assessment Registry */}
            <div className="glass-card" style={{ padding: '0', overflow: 'hidden', marginBottom: '24px' }}>
                <div style={{ padding: isMobile ? '16px' : '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }}>Assessment Registry</h3>
                        <div style={{ display: 'flex', gap: '0', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                            {['All Quizzes', 'By Module'].map(f => (
                                <button key={f} onClick={() => { setQuizFilter(f); setPage(1); }} style={{
                                    padding: '6px 14px', fontSize: '0.75rem', fontWeight: '500', cursor: 'pointer',
                                    background: quizFilter === f ? '#f0f4ff' : 'white', color: quizFilter === f ? '#0f172a' : '#94a3b8',
                                    border: 'none', borderRight: '1px solid #e2e8f0',
                                }}>{f}</button>
                            ))}
                        </div>
                        {quizFilter === 'By Module' && (
                            <select
                                value={moduleFilterId}
                                onChange={(e) => { setModuleFilterId(e.target.value); setPage(1); }}
                                style={{ marginLeft: '12px', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.75rem', background: '#f8fafc', color: '#334155', outline: 'none' }}
                            >
                                {allModules.map((m) => (
                                    <option key={`${m.course_id}-${m.id}`} value={m.id}>
                                        {m.course_title} - {m.title}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {!isMobile && (
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input type="text" value={quizSearch} onChange={(e) => { setQuizSearch(e.target.value); setPage(1); }} placeholder="Search assessments..." style={{
                                    padding: '8px 10px 8px 30px', border: '1px solid #e2e8f0', borderRadius: '8px',
                                    fontSize: '0.78rem', background: '#f8fafc', outline: 'none', width: '180px',
                                }} />
                            </div>
                        )}
                        <button style={{
                            padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
                            background: 'white', fontSize: '0.78rem', fontWeight: '500', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b',
                        }}><Filter size={14} /> Filter</button>
                    </div>
                </div>

                {/* Table Header */}
                {!isMobile && (
                    <div style={{
                        display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.8fr 0.8fr 0.6fr',
                        padding: '10px 24px', borderBottom: '1px solid #e2e8f0',
                    }}>
                        {['ASSESSMENT NAME & MODULE', 'STATUS', 'TOTAL ATTEMPTS', 'AVG. SCORE', 'ACTIONS'].map(h => (
                            <div key={h} style={{ fontSize: '0.58rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: h === 'ACTIONS' ? 'center' : 'left' }}>{h}</div>
                        ))}
                    </div>
                )}

                {loadingQuizzes ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Loading quizzes...</div>
                ) : pagedQuizzes.length > 0 ? (
                    pagedQuizzes.map((q, i) => {
                        const index = (page - 1) * pageSize + i + 1;
                        const statusKey = (q.status || '').toLowerCase();
                        const isActive = statusKey === 'active';
                        const statusLabel = statusKey ? statusKey.charAt(0).toUpperCase() + statusKey.slice(1) : 'Draft';

                        const mod = moduleById.get(q.module_id);
                        const moduleTitle = mod?.title || q.module_id || '—';

                        const totalAttempts = q.total_attempts || 0;
                        const hasAttempts = totalAttempts > 0;
                        const emptyAttemptsLabel = isActive ? 'No attempts yet' : 'Not Published';

                        const avgScore = typeof q.avg_score === 'number' ? q.avg_score : 0;
                        const progressWidth = `${Math.max(0, Math.min(100, avgScore))}%`;

                        return (
                            <div key={q.id} style={{
                                display: isMobile ? 'flex' : 'grid',
                                gridTemplateColumns: isMobile ? undefined : '2fr 0.8fr 0.8fr 0.8fr 0.6fr',
                                flexDirection: isMobile ? 'column' : undefined,
                                gap: isMobile ? '8px' : '0',
                                padding: isMobile ? '14px 16px' : '16px 24px',
                                borderBottom: '1px solid #f1f5f9', alignItems: isMobile ? 'flex-start' : 'center',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{
                                        width: '36px', height: '36px', borderRadius: '8px',
                                        background: isActive ? '#e0e7ff' : '#fef3c7',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.72rem', fontWeight: '700',
                                        color: isActive ? '#4338ca' : '#d97706',
                                        flexShrink: 0,
                                    }}>{String(index).padStart(2, '0')}</span>
                                    <div>
                                        <div style={{ fontWeight: '600', fontSize: '0.88rem', color: '#0f172a' }}>{q.title || 'Untitled Quiz'}</div>
                                        <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{moduleTitle}</div>
                                    </div>
                                </div>
                                <div>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        fontSize: '0.68rem', fontWeight: '600',
                                        color: isActive ? '#10b981' : '#f59e0b',
                                    }}>
                                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: isActive ? '#10b981' : '#f59e0b' }}></span>
                                        {statusLabel}
                                    </span>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    {hasAttempts ? (
                                        <div>
                                            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#0f172a' }}>{totalAttempts}</div>
                                            <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Completed Attempts</div>
                                        </div>
                                    ) : (
                                        <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                                            —<br />
                                            <span style={{ fontSize: '0.62rem' }}>{emptyAttemptsLabel}</span>
                                        </span>
                                    )}
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    {hasAttempts ? (
                                        <div>
                                            <span style={{
                                                fontWeight: '700', fontSize: '0.88rem', color: '#0f172a',
                                                padding: '4px 12px', border: '1px solid #e2e8f0', borderRadius: '6px',
                                            }}>{avgScore}%</span>
                                            <div style={{ height: '3px', background: '#e2e8f0', borderRadius: '20px', marginTop: '6px', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: progressWidth, background: '#2563eb', borderRadius: '20px' }}></div>
                                            </div>
                                        </div>
                                    ) : (
                                        <span style={{ color: '#94a3b8' }}>—</span>
                                    )}
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => handleViewQuiz(q)}
                                            style={{
                                                padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0',
                                                background: 'white', cursor: 'pointer', color: '#0f172a', fontSize: '0.72rem', fontWeight: '600',
                                            }}
                                        >
                                            View
                                        </button>
                                        <button
                                            onClick={() => handleEditQuiz(q)}
                                            style={{
                                                padding: '6px 12px', borderRadius: '6px', border: '1px solid #c7d2fe',
                                                background: '#f0f4ff', cursor: 'pointer', color: '#3730a3', fontSize: '0.72rem', fontWeight: '700',
                                            }}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeleteQuiz(q)}
                                            style={{
                                                padding: '6px 12px', borderRadius: '6px', border: '1px solid #fecaca',
                                                background: '#fee2e2', cursor: 'pointer', color: '#dc2626', fontSize: '0.72rem', fontWeight: '700',
                                            }}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div style={{ padding: '50px', textAlign: 'center' }}>
                        <AlertCircle size={36} style={{ color: '#94a3b8', marginBottom: '12px' }} />
                        <h3 style={{ color: '#475569', marginBottom: '6px' }}>No Quizzes Found</h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>Create a quiz to get started.</p>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                        Showing {showingStart}-{showingEnd} of {totalItems} Assessments
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.6 : 1 }}
                        >
                            <ChevronLeft size={14} />
                        </button>
                        {pageNumbers.map(p => (
                            <button
                                key={p}
                                onClick={() => setPage(p)}
                                style={{
                                    padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px',
                                    background: p === page ? '#f0f4ff' : 'white', color: '#0f172a', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer',
                                }}
                            >
                                {p}
                            </button>
                        ))}
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.6 : 1 }}
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom: Insights + Quick Shortcuts */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: isMobile ? '16px' : '24px' }}>
                {/* Institutional Insights */}
                <div style={{
                    background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', borderRadius: '16px',
                    padding: isMobile ? '24px' : '32px', color: 'white', position: 'relative', overflow: 'hidden',
                }}>
                    <h3 style={{ fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: '800', marginBottom: '10px', color: 'white' }}>Institutional Insights</h3>
                    <p style={{ fontSize: '0.85rem', opacity: 0.8, lineHeight: '1.6', marginBottom: '20px' }}>
                        Our algorithm detected a 15% increase in difficulty perception in Module 04. Consider reviewing the assessment content.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'white', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer' }}>View Detailed Report</button>
                        <button style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#1e3a5f', color: 'white', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer' }}>Dismiss Alert</button>
                    </div>
                    <TrendingUp size={80} style={{ position: 'absolute', right: '20px', bottom: '20px', opacity: 0.1 }} />
                </div>

                {/* Quick Shortcuts */}
                <div className="glass-card" style={{ padding: isMobile ? '18px' : '22px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', marginBottom: '14px' }}>Quick Shortcuts</h3>
                    {[
                        { icon: Upload, label: 'Bulk Upload', desc: 'Import from CSV/Excel', color: '#f59e0b', bg: '#fef3c7' },
                        { icon: Award, label: 'Certifications', desc: 'Manage badge criteria', color: '#8b5cf6', bg: '#ede9fe' },
                        { icon: Sparkles, label: 'AI Generator', desc: 'Generate questions from text', color: '#2563eb', bg: '#dbeafe' },
                    ].map((s, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '12px', borderRadius: '10px', cursor: 'pointer',
                            marginBottom: '6px', background: '#f8fafc',
                        }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <s.icon size={16} style={{ color: s.color }} />
                            </div>
                            <div>
                                <div style={{ fontWeight: '600', fontSize: '0.85rem', color: '#0f172a' }}>{s.label}</div>
                                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{s.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* FAB */}
            <button onClick={() => { setEditingQuizId(null); setView('create'); }} style={{
                position: 'fixed', bottom: isMobile ? '20px' : '30px', right: isMobile ? '20px' : '30px',
                width: '56px', height: '56px', borderRadius: '14px', background: '#0f172a',
                color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 50,
            }}>
                <MessageSquare size={22} />
            </button>
            <PreviewModal />
        </div>
    );
}
