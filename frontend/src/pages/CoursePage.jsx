import { useState, useEffect, useRef } from 'react';
import { courseAPI, assignmentAPI, quizAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import {
    Play, FileText, CheckCircle, Lock, Clock, BookOpen,
    Globe, Award, ArrowRight, ExternalLink, ChevronRight, Upload,
    Target, Brain, ClipboardList,
} from 'lucide-react';
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

function extractGoogleDriveFileId(url) {
    if (!url) return null;
    const m = String(url).match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
}

function toAbsoluteContentUrl(url) {
    if (!url) return '';
    const u = String(url).trim();
    if (!u) return '';
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    if (u.startsWith('/uploads/')) return `http://localhost:8000${u}`;
    return u;
}

function isDirectVideoFile(url) {
    const u = toAbsoluteContentUrl(url).toLowerCase();
    return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/.test(u);
}

function toRenderableUrl(url) {
    const abs = toAbsoluteContentUrl(url);
    const fileId = extractGoogleDriveFileId(abs);
    if (fileId) return `https://drive.google.com/file/d/${fileId}/preview`;
    return abs;
}

function getVideoLanguage(content) {
    const lang = (content?.content_text || '').trim();
    return lang || 'English';
}

function toDriveStreamUrl(url) {
    const fileId = extractGoogleDriveFileId(toAbsoluteContentUrl(url));
    if (!fileId) return null;
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

// ─── Phase Detection ───────────────────────────────────────────────────────────
function getModulePhase(mod) {
    if (!mod) return 'video';
    const st = (mod.section_type || '').toLowerCase();
    const mt = (mod.module_type || '').toLowerCase();
    if (st === 'quiz' || st === 'assessment') return 'quiz';
    if (st === 'assignment') return 'assignment';
    if (st === 'study') return 'study';
    if (st === 'video') return 'video';
    // Infer from module_type
    if (mt === 'assessment' || mt === 'quiz' || mod.quiz_id) return 'quiz';
    if (mt === 'assignment') return 'assignment';
    if (mt === 'feedback') return 'quiz';
    // Infer from contents
    const contents = mod.contents || [];
    const hasVideo = contents.some(c => (c.content_type || '').toLowerCase() === 'video');
    const hasPdf = contents.some(c => (c.content_type || '').toLowerCase() === 'pdf');
    if (hasPdf && !hasVideo) return 'study';
    return 'video';
}

/** Whether the student may use "Mark as complete" for this module. */
function canMarkModuleComplete(mod, completedQuizIds, myAssignments) {
    if (!mod) return false;
    const ph = getModulePhase(mod);
    if (ph === 'quiz') {
        const qid = mod.quiz_id ? String(mod.quiz_id) : '';
        // If quiz link is missing, don't block module completion.
        if (!qid) return true;
        return completedQuizIds.includes(qid);
    }
    if (ph === 'assignment') {
        // Assignments should not block module completion; grading affects grade only.
        return true;
    }
    return true;
}

function markCompleteHint(mod, completedQuizIds, myAssignments) {
    if (!mod) return '';
    const ph = getModulePhase(mod);
    if (ph === 'quiz') {
        const qid = mod.quiz_id ? String(mod.quiz_id) : '';
        if (!qid) return 'This module has no quiz linked.';
        if (!completedQuizIds.includes(qid)) return 'Complete and submit the module quiz first.';
    }
    if (ph === 'assignment') {
        // No hint needed: assignment modules are always completable.
    }
    return '';
}

const PHASE_CFG = {
    video: {
        label: 'Video Lecture', shortLabel: 'VIDEO',
        color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: '🎬',
        gradient: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
    },
    study: {
        label: 'Study Materials', shortLabel: 'STUDY',
        color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', icon: '📖',
        gradient: 'linear-gradient(135deg, #065f46, #10b981)',
    },
    assignment: {
        label: 'Assignment', shortLabel: 'ASSIGN',
        color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', icon: '📝',
        gradient: 'linear-gradient(135deg, #92400e, #f59e0b)',
    },
    quiz: {
        label: 'Quiz & Assessment', shortLabel: 'QUIZ',
        color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', icon: '🎯',
        gradient: 'linear-gradient(135deg, #4c1d95, #7c3aed)',
    },
};

const LEARNING_PATH_STEPS = [
    { key: 'video', emoji: '🎬', label: 'Video Lectures', desc: 'Watch curated lessons' },
    { key: 'study', emoji: '📖', label: 'Study Materials', desc: 'Read PDFs & notes' },
    { key: 'assignment', emoji: '📝', label: 'Assignments', desc: 'Submit your work' },
    { key: 'quiz', emoji: '🎯', label: 'Quiz / Assessment', desc: 'Test your knowledge' },
];

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CoursePage() {
    const navigate = useNavigate();
    const w = useWindowWidth();
    const isMobile = w <= 768;

    const [courses, setCourses] = useState([]);
    const [activeCourse, setActiveCourse] = useState(null);
    const [progress, setProgress] = useState(null);
    const [activeModule, setActiveModule] = useState(null);
    const [activeVideoId, setActiveVideoId] = useState('');
    const [activePdfId, setActivePdfId] = useState('');
    const [activeNoteId, setActiveNoteId] = useState('');
    const [loading, setLoading] = useState(true);
    const [showSidebar, setShowSidebar] = useState(!isMobile);
    const [myAssignments, setMyAssignments] = useState([]);
    const [completedQuizIds, setCompletedQuizIds] = useState([]);
    const [quizStatsById, setQuizStatsById] = useState({});
    const autoCompletedRef = useRef(new Set());

    const refreshAssessmentGates = async () => {
        try {
            const [ar, qr] = await Promise.all([assignmentAPI.my(), quizAPI.myCompletedQuizIds()]);
            setMyAssignments(ar.data || []);
            setCompletedQuizIds(qr.data?.quiz_ids || []);
        } catch {
            /* ignore */
        }
    };

    const refreshActiveQuizStats = async (module = activeModule) => {
        const qid = module?.quiz_id ? String(module.quiz_id) : '';
        if (!qid) return;
        try {
            const res = await quizAPI.get(qid);
            setQuizStatsById((prev) => ({ ...prev, [qid]: res.data }));
        } catch {
            /* ignore */
        }
    };

    useEffect(() => { loadCourses(); }, []);

    useEffect(() => {
        if (!activeCourse?.id) return;
        let cancelled = false;
        (async () => {
            try {
                const [ar, qr] = await Promise.all([assignmentAPI.my(), quizAPI.myCompletedQuizIds()]);
                if (cancelled) return;
                setMyAssignments(ar.data || []);
                setCompletedQuizIds(qr.data?.quiz_ids || []);
            } catch {
                /* ignore */
            }
        })();
        return () => { cancelled = true; };
    }, [activeCourse?.id]);

    useEffect(() => {
        refreshActiveQuizStats(activeModule);
    }, [activeModule?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        // When user comes back from Quiz page, refresh gates + quiz stats.
        const sync = () => {
            refreshAssessmentGates();
            refreshActiveQuizStats(activeModule);
        };
        window.addEventListener('focus', sync);
        document.addEventListener('visibilitychange', sync);
        return () => {
            window.removeEventListener('focus', sync);
            document.removeEventListener('visibilitychange', sync);
        };
    }, [activeModule?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadCourses = async () => {
        try {
            const res = await courseAPI.list();
            setCourses(res.data);
            if (res.data.length > 0) {
                const first = res.data[0];
                setActiveCourse(first);
                try {
                    await courseAPI.enroll(first.id);
                } catch (e) {
                    console.error(e);
                    toast.error(e.response?.data?.detail || 'Could not enroll in course');
                }
                try {
                    const prog = await courseAPI.getProgress(first.id);
                    setProgress(prog.data);
                } catch (e) {
                    console.error(e);
                    toast.error(e.response?.data?.detail || 'Could not load your progress. Try logging in again.');
                }
                if (first?.modules?.length > 0) setActiveModule(first.modules[0]);
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.detail || 'Failed to load courses');
        }
        finally { setLoading(false); }
    };

    const handleModuleClick = async (module, idx) => {
        if (idx > 0 && progress) {
            const prevModule = activeCourse.modules[idx - 1];
            if (!progress.module_progress?.[prevModule.id]?.completed) {
                toast.error('Complete the previous module first');
                return;
            }
        }
        setActiveModule(module);
        if (isMobile) setShowSidebar(false);
    };

    const updateProgress = async (moduleId, pct) => {
        try {
            await courseAPI.updateProgress({ module_id: moduleId, watch_percentage: pct, time_spent_seconds: 60 });
            const prog = await courseAPI.getProgress(activeCourse.id);
            setProgress(prog.data);
            await refreshAssessmentGates();
            if (pct >= 90) toast.success('Module completed! ✅');
        } catch (err) { toast.error(err.response?.data?.detail || 'Error updating progress'); }
    };

    // ── Computed ──────────────────────────────────────────────────────────────
    const progressPct = progress?.progress_percentage || 0;
    const completedModules = progress?.completed_modules || 0;
    const totalModules = progress?.total_modules || 0;
    const activeModuleIdx = activeCourse?.modules?.findIndex(m => m.id === activeModule?.id) ?? 0;
    const nextModule = activeCourse?.modules?.[activeModuleIdx + 1];

    const moduleContents = activeModule?.contents || [];
    const videoContents = moduleContents.filter(c => (c.content_type || '').toLowerCase() === 'video');
    const pdfContents = moduleContents.filter(c => (c.content_type || '').toLowerCase() === 'pdf');
    const noteContents = moduleContents.filter(c => (c.content_text || '').trim().length > 0);
    const totalDuration = moduleContents.reduce((s, c) => s + (c.duration_minutes || 0), 0) || 45;

    useEffect(() => {
        if (videoContents.length > 0 && !videoContents.some(v => v.id === activeVideoId))
            setActiveVideoId(videoContents[0].id);
        if (pdfContents.length > 0 && !pdfContents.some(p => p.id === activePdfId))
            setActivePdfId(pdfContents[0].id);
        if (noteContents.length > 0 && !noteContents.some(n => n.id === activeNoteId))
            setActiveNoteId(noteContents[0].id);
    }, [activeModule?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const activeVideo = videoContents.find(v => v.id === activeVideoId) || videoContents[0];
    const activePdf = pdfContents.find(p => p.id === activePdfId) || pdfContents[0];
    const activeNote = noteContents.find(n => n.id === activeNoteId) || noteContents[0];

    const phase = getModulePhase(activeModule);
    const phaseCfg = PHASE_CFG[phase];
    const isCompleted = progress?.module_progress?.[activeModule?.id]?.completed;
    const activeQuizId = activeModule?.quiz_id ? String(activeModule.quiz_id) : '';
    const activeQuizStats = activeQuizId ? quizStatsById[activeQuizId] : null;
    const isQuizPassed = phase === 'quiz'
        && activeQuizId
        && completedQuizIds.includes(activeQuizId);
    const hasQuizResultNow = phase === 'quiz'
        && activeQuizId
        && (
            activeQuizStats?.best_score != null
            || Number(activeQuizStats?.attempts_used || 0) > 0
        );
    const allowMarkComplete = activeModule
        ? canMarkModuleComplete(activeModule, completedQuizIds, myAssignments)
        : false;
    const markBlockedHint = activeModule && !isCompleted
        ? markCompleteHint(activeModule, completedQuizIds, myAssignments)
        : '';

    useEffect(() => {
        // Auto-complete quiz modules as soon as result stats are visible.
        // This avoids waiting for a delayed completed-ids refresh.
        if (!activeModule?.id || phase !== 'quiz' || !(isQuizPassed || hasQuizResultNow) || isCompleted) return;
        if (autoCompletedRef.current.has(activeModule.id)) return;
        autoCompletedRef.current.add(activeModule.id);
        updateProgress(activeModule.id, 100);
    }, [activeModule?.id, phase, isQuizPassed, hasQuizResultNow, isCompleted]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                        My Courses › <span style={{ fontWeight: '600', color: '#0f172a' }}>AIUGIP Intern Program</span>
                    </div>
                    <h1 style={{ fontSize: isMobile ? '1.2rem' : '1.6rem', fontWeight: '800', color: '#0f172a', lineHeight: '1.2' }}>
                        {activeModule?.title || 'Module Overview'}
                    </h1>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {isMobile && (
                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '8px 14px' }} onClick={() => setShowSidebar(!showSidebar)}>
                            <BookOpen size={16} /> Modules
                        </button>
                    )}
                    <button className="btn" style={{ background: '#0f172a', color: 'white', fontSize: '0.8rem', padding: '8px 16px', borderRadius: '10px', fontWeight: '700' }}
                        onClick={() => updateProgress(activeModule?.id, 100)}>
                        Resume Learning
                    </button>
                </div>
            </div>

            {/* Main Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: isMobile ? '16px' : '28px' }}>

                {/* ── LEFT: Phase Content ── */}
                <div style={{ order: isMobile ? 2 : 1 }}>

                    {/* Phase Banner */}
                    <div style={{
                        background: phaseCfg.bg, border: `1px solid ${phaseCfg.border}`,
                        borderRadius: '14px', padding: '14px 18px', marginBottom: '20px',
                        display: 'flex', alignItems: 'center', gap: '12px',
                    }}>
                        <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>{phaseCfg.icon}</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.58rem', fontWeight: '700', color: phaseCfg.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                {phaseCfg.shortLabel} PHASE
                            </div>
                            <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>{phaseCfg.label}</div>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'right' }}>
                            <div>{moduleContents.length} items</div>
                            <div>{totalDuration} min</div>
                        </div>
                    </div>

                    {/* ════ VIDEO PHASE ════ */}
                    {phase === 'video' && (
                        <>
                            {/* Player */}
                            <div style={{
                                background: 'linear-gradient(135deg, #374151, #1f2937)', borderRadius: '16px',
                                aspectRatio: '16/9', position: 'relative', overflow: 'hidden', marginBottom: '20px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {activeVideo?.content_url ? (
                                    extractGoogleDriveFileId(activeVideo.content_url) ? (
                                        <video
                                            controls
                                            controlsList="nodownload noplaybackrate"
                                            disablePictureInPicture
                                            onContextMenu={(e) => e.preventDefault()}
                                            playsInline
                                            src={toDriveStreamUrl(activeVideo.content_url)}
                                            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', position: 'absolute', top: 0, left: 0 }}
                                        />
                                    ) : isDirectVideoFile(activeVideo.content_url) ? (
                                        <video
                                            controls
                                            controlsList="nodownload noplaybackrate"
                                            disablePictureInPicture
                                            onContextMenu={(e) => e.preventDefault()}
                                            playsInline
                                            src={toAbsoluteContentUrl(activeVideo.content_url)}
                                            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', position: 'absolute', top: 0, left: 0 }}
                                        />
                                    ) : (
                                        <iframe
                                            src={toRenderableUrl(activeVideo.content_url)}
                                            style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', top: 0, left: 0 }}
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
                                            allowFullScreen
                                            title={activeVideo.title}
                                        />
                                    )
                                ) : (
                                    <>
                                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                            <Play size={30} style={{ color: 'white', marginLeft: '4px' }} />
                                        </div>
                                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Play size={14} style={{ color: '#60a5fa' }} />
                                            <span style={{ color: 'white', fontSize: '0.78rem', fontWeight: '600' }}>
                                                {activeVideo?.title || 'Select a video to play'}
                                            </span>
                                            <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px' }}>
                                                <div style={{ height: '100%', width: '35%', background: '#2563eb', borderRadius: '2px' }} />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Video Playlist */}
                            <div className="glass-card" style={{ padding: isMobile ? '12px' : '20px', marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    🎬 Video Playlist
                                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '500', marginLeft: '4px' }}>{videoContents.length} video{videoContents.length !== 1 ? 's' : ''}</span>
                                </h3>
                                {videoContents.length > 0 ? videoContents.map((v, idx) => (
                                    <div key={v.id} onClick={() => setActiveVideoId(v.id)} style={{
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        padding: isMobile ? '10px 12px' : '12px 14px', borderRadius: '10px', cursor: 'pointer',
                                        background: v.id === activeVideoId ? phaseCfg.bg : 'transparent',
                                        border: v.id === activeVideoId ? `1px solid ${phaseCfg.border}` : '1px solid transparent',
                                        marginBottom: '6px', transition: 'all 0.15s',
                                    }}>
                                        <div style={{
                                            width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
                                            background: v.id === activeVideoId ? phaseCfg.color : '#e2e8f0',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <Play size={14} style={{ color: v.id === activeVideoId ? 'white' : '#64748b', marginLeft: '2px' }} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.58rem', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' }}>Video {idx + 1}</div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px', flexShrink: 0, minWidth: 0 }}>
                                            {v.duration_minutes > 0 && (
                                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                                    {v.duration_minutes}m
                                                </span>
                                            )}
                                            <span style={{ fontSize: '0.7rem', color: '#64748b', background: '#f1f5f9', borderRadius: '999px', padding: '2px 8px', flexShrink: 0, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}>
                                                {getVideoLanguage(v)}
                                            </span>
                                            {/* {v.content_url && (
                                                <a href={toRenderableUrl(v.content_url)} target="_blank" rel="noreferrer"
                                                    onClick={e => e.stopPropagation()}
                                                    style={{ color: phaseCfg.color, display: 'flex', alignItems: 'center' }}>
                                                    <ExternalLink size={12} />
                                                </a>
                                            )} */}
                                        </div>
                                    </div>
                                )) : (
                                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>No videos in this module yet.</div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ════ STUDY PHASE ════ */}
                    {phase === 'study' && (
                        <div className="glass-card" style={{ padding: '24px', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                📖 Study Materials
                                <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '500' }}>{pdfContents.length + noteContents.length} resource{(pdfContents.length + noteContents.length) !== 1 ? 's' : ''}</span>
                            </h3>

                            {pdfContents.length === 0 && noteContents.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                                    <FileText size={36} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                                    <div>No study materials for this module yet.</div>
                                </div>
                            )}

                            {pdfContents.map((p, idx) => (
                                <div key={p.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '14px',
                                    padding: '16px', borderRadius: '12px', background: '#f8fafc',
                                    border: p.id === activePdfId ? `2px solid ${phaseCfg.color}` : '1px solid #e2e8f0',
                                    marginBottom: '10px', cursor: 'pointer', transition: 'all 0.15s',
                                }} onClick={() => setActivePdfId(p.id)}>
                                    <div style={{ width: '44px', height: '50px', background: '#e0e7ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <FileText size={22} style={{ color: '#4f46e5' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.58rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>PDF Document {idx + 1}</div>
                                        <div style={{ fontSize: '0.88rem', fontWeight: '700', color: '#0f172a', marginBottom: '2px' }}>{p.title}</div>
                                        {p.duration_minutes > 0 && (
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Clock size={10} /> {p.duration_minutes} min read
                                            </div>
                                        )}
                                    </div>
                                    {p.content_url && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActivePdfId(p.id);
                                            }}
                                            style={{
                                                padding: '8px 16px', background: phaseCfg.color, color: 'white',
                                                borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700',
                                                border: 'none', cursor: 'pointer', display: 'flex',
                                                alignItems: 'center', gap: '5px', flexShrink: 0,
                                            }}
                                        >
                                            Read Here <FileText size={12} />
                                        </button>
                                    )}
                                </div>
                            ))}

                            {activePdf?.content_url && (
                                <div style={{
                                    marginTop: '14px',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    border: `1px solid ${phaseCfg.border}`,
                                    background: 'white',
                                }}>
                                    <div style={{
                                        padding: '10px 14px',
                                        borderBottom: `1px solid ${phaseCfg.border}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '10px',
                                    }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#0f172a' }}>
                                            Reading: {activePdf.title}
                                        </div>
                                        {/* <a
                                            href={toRenderableUrl(activePdf.content_url)}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ fontSize: '0.75rem', color: phaseCfg.color, textDecoration: 'none', fontWeight: 700 }}
                                        >
                                            Open in new tab
                                        </a> */}
                                    </div>
                                    <iframe
                                        title={activePdf.title}
                                        src={toRenderableUrl(activePdf.content_url)}
                                        style={{ width: '100%', height: isMobile ? '65vh' : '78vh', border: 'none' }}
                                    />
                                </div>
                            )}

                            {noteContents.map((n, idx) => (
                                <div key={n.id} style={{ padding: '16px', borderRadius: '12px', background: '#fffbeb', border: `1px solid #fde68a`, marginBottom: '10px', cursor: 'pointer' }}
                                    onClick={() => setActiveNoteId(n.id)}>
                                    <div style={{ fontSize: '0.58rem', color: '#92400e', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>📝 Note {idx + 1} — {n.title}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: '1.7', whiteSpace: 'pre-wrap', maxHeight: n.id === activeNoteId ? 'none' : '80px', overflow: 'hidden' }}>
                                        {n.content_text}
                                    </div>
                                    {n.content_text?.length > 200 && (
                                        <div style={{ fontSize: '0.75rem', color: phaseCfg.color, fontWeight: '700', marginTop: '6px' }}>
                                            {n.id === activeNoteId ? '▲ Show less' : '▼ Read more'}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ════ ASSIGNMENT PHASE ════ */}
                    {phase === 'assignment' && (
                        <div className="glass-card" style={{ padding: isMobile ? '24px' : '36px', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                                <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: phaseCfg.bg, border: `1px solid ${phaseCfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span style={{ fontSize: '1.8rem' }}>📝</span>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.6rem', fontWeight: '700', color: phaseCfg.color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>ASSIGNMENT REQUIRED</div>
                                    <h2 style={{ fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: '800', color: '#0f172a' }}>{activeModule?.title}</h2>
                                </div>
                            </div>

                            <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: '1.8', marginBottom: '24px' }}>
                                {activeModule?.description || 'Complete the assignment for this module and submit it through the Assignments portal for evaluation by your mentor.'}
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '12px', marginBottom: '28px' }}>
                                {[
                                    { icon: '📅', label: 'Submission', value: 'Check Deadlines' },
                                    { icon: '⚖️', label: 'Evaluation', value: 'Mentor Review' },
                                    { icon: '🏆', label: 'Weightage', value: 'Counts to Grade' },
                                ].map((item, i) => (
                                    <div key={i} style={{ padding: '14px', background: phaseCfg.bg, border: `1px solid ${phaseCfg.border}`, borderRadius: '10px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>{item.icon}</div>
                                        <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>{item.label}</div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: phaseCfg.color }}>{item.value}</div>
                                    </div>
                                ))}
                            </div>

                            <button className="btn" onClick={() => navigate('/dashboard/assignments')} style={{
                                width: '100%', background: phaseCfg.gradient, color: 'white',
                                padding: '16px', borderRadius: '12px', fontWeight: '700', fontSize: '1rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                            }}>
                                <Upload size={18} /> Go to Assignments <ArrowRight size={18} />
                            </button>
                        </div>
                    )}

                    {/* ════ QUIZ PHASE ════ */}
                    {phase === 'quiz' && (
                        <>
                            <div style={{
                                background: phaseCfg.gradient, borderRadius: '16px',
                                padding: isMobile ? '28px 24px' : '40px', color: 'white', marginBottom: '20px',
                            }}>
                                <div style={{ fontSize: '3rem', marginBottom: '12px', lineHeight: 1 }}>🎯</div>
                                <div style={{ fontSize: '0.6rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.14em', opacity: 0.8, marginBottom: '6px' }}>
                                    QUIZ / ASSESSMENT
                                </div>
                                <h2 style={{ fontSize: isMobile ? '1.4rem' : '1.8rem', fontWeight: '800', marginBottom: '10px', color: 'white', lineHeight: '1.2' }}>
                                    {activeModule?.title}
                                </h2>
                                <p style={{ fontSize: '0.88rem', opacity: 0.8, marginBottom: '28px', lineHeight: '1.6' }}>
                                    {activeModule?.description || 'Test your knowledge across all the modules covered so far. Complete within the time limit for best results.'}
                                </p>

                                <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
                                    {[
                                        { val: activeQuizStats?.time_limit_minutes ? `${activeQuizStats.time_limit_minutes} min` : '—', lbl: 'Time Limit' },
                                        { val: activeQuizStats?.questions?.length ? `${activeQuizStats.questions.length} Qs` : '—', lbl: 'Questions' },
                                        { val: activeQuizStats?.max_attempts ? `${activeQuizStats.max_attempts} Tries` : '—', lbl: 'Attempts' },
                                        { val: '50%', lbl: 'Pass Mark' },
                                    ].map(({ val, lbl }) => (
                                        <div key={lbl} style={{ padding: '12px 18px', background: 'rgba(255,255,255,0.15)', borderRadius: '10px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.2)' }}>
                                            <div style={{ fontSize: '1.1rem', fontWeight: '800' }}>{val}</div>
                                            <div style={{ fontSize: '0.6rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{lbl}</div>
                                        </div>
                                    ))}
                                </div>
                                {activeQuizStats?.best_score != null && (
                                    <div style={{ marginBottom: '20px', fontSize: '0.88rem', lineHeight: 1.6 }}>
                                        <div style={{ fontWeight: '700' }}>
                                            Your Best Score: {activeQuizStats.best_score}/{activeQuizStats.total_marks} ({activeQuizStats.best_percentage}%)
                                        </div>
                                        <div style={{ opacity: 0.9 }}>
                                            Attempts used: {activeQuizStats.attempts_used}/{activeQuizStats.max_attempts}
                                        </div>
                                    </div>
                                )}

                                <button
                                    className="btn"
                                    onClick={() => {
                                        if (activeModule?.quiz_id) {
                                            navigate(`/dashboard/quiz?quizId=${encodeURIComponent(activeModule.quiz_id)}`);
                                        } else {
                                            navigate('/dashboard/quiz');
                                        }
                                    }}
                                    style={{
                                        background: '#b8a070', color: 'white', padding: '14px 36px',
                                        borderRadius: '12px', fontWeight: '800', fontSize: '1rem', letterSpacing: '0.06em',
                                        display: 'inline-flex', alignItems: 'center', gap: '10px',
                                    }}
                                >
                                    {isQuizPassed ? 'RETAKE / REVIEW QUIZ' : 'START QUIZ NOW'} <ArrowRight size={18} />
                                </button>
                                {isQuizPassed && !isCompleted && (
                                    <div style={{ marginTop: '10px', fontSize: '0.82rem', opacity: 0.9 }}>
                                        Quiz completed. Module will be marked complete automatically.
                                    </div>
                                )}
                            </div>

                            {/* Instructions if there's text content */}
                            {noteContents.length > 0 && (
                                <div className="glass-card" style={{ padding: '20px', marginBottom: '20px' }}>
                                    <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>📋 Instructions</h3>
                                    {noteContents.map(n => (
                                        <div key={n.id} style={{ fontSize: '0.85rem', color: '#475569', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                                            {n.content_text}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* Description (video + study phases) */}
                    {(phase === 'video' || phase === 'study') && (
                        <div style={{ marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', marginBottom: '10px' }}>About this Module</h2>
                            <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.8' }}>
                                {activeModule?.description || 'This module covers key concepts and practical skills relevant to the AIUGIP internship program.'}
                            </p>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: '500', color: '#475569', padding: '5px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px' }}>
                                    <Clock size={11} /> {totalDuration} min
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: '500', color: '#475569', padding: '5px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px' }}>
                                    <Globe size={11} /> English
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: '500', color: '#10b981', padding: '5px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '20px' }}>
                                    <Award size={11} /> Certificate Eligible
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Mark Complete — gated for quiz (must submit) and assignment (must be graded) */}
                    {activeModule && (
                        <>
                            <button
                                type="button"
                                className="btn"
                                style={{
                                    width: '100%', padding: '14px',
                                    background: isCompleted ? '#d1fae5' : (allowMarkComplete ? phaseCfg.gradient : '#e2e8f0'),
                                    color: isCompleted ? '#065f46' : (allowMarkComplete ? 'white' : '#94a3b8'),
                                    borderRadius: '12px', fontWeight: '700', fontSize: '0.95rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    marginBottom: '8px', cursor: isCompleted || !allowMarkComplete ? 'not-allowed' : 'pointer',
                                }}
                                onClick={() => updateProgress(activeModule.id, 100)}
                                disabled={isCompleted || !allowMarkComplete}
                                title={!isCompleted && !allowMarkComplete ? markBlockedHint : undefined}
                            >
                                <CheckCircle size={18} />
                                {isCompleted ? 'Module Completed ✓' : 'Mark as Complete'}
                            </button>
                            {!isCompleted && !allowMarkComplete && markBlockedHint && (
                                <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '12px', lineHeight: 1.5 }}>
                                    {markBlockedHint}
                                </p>
                            )}
                        </>
                    )}
                </div>

                {/* ── RIGHT: Sidebar ── */}
                <div style={{ order: isMobile ? 1 : 2, display: isMobile && !showSidebar ? 'none' : 'block' }}>

                    {/* Progress Card */}
                    <div className="glass-card" style={{ padding: isMobile ? '16px' : '22px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div>
                                <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#0f172a' }}>Overall Progress</div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{completedModules} of {totalModules} completed</div>
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#2563eb', fontFamily: "'Outfit'" }}>{progressPct}%</div>
                        </div>
                        <div className="progress-bar" style={{ height: '7px', marginBottom: '14px' }}>
                            <div className="progress-fill" style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #2563eb, #8b5cf6)' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div style={{ textAlign: 'center', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.58rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>TOTAL TIME</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a' }}>24h 15m</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.58rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>RANK</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#94a3b8' }}>—</div>
                            </div>
                        </div>
                    </div>

                    {/* Learning Path */}
                    {/* <div className="glass-card" style={{ padding: isMobile ? '16px' : '20px', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Target size={16} style={{ color: '#8b5cf6' }} /> Learning Path
                        </h3>
                        {LEARNING_PATH_STEPS.map(({ key, emoji, label, desc }, stepIdx) => {
                            const modulesOfPhase = activeCourse?.modules?.filter(m => getModulePhase(m) === key) || [];
                            const doneCount = modulesOfPhase.filter(m => progress?.module_progress?.[m.id]?.completed).length;
                            const isPhaseActive = phase === key;
                            const cfg = PHASE_CFG[key];
                            return (
                                <div key={key} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 12px', borderRadius: '10px', marginBottom: '6px',
                                    background: isPhaseActive ? cfg.bg : 'transparent',
                                    border: isPhaseActive ? `1px solid ${cfg.border}` : '1px solid transparent',
                                    transition: 'all 0.2s',
                                }}>
                                    <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{emoji}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: '600', color: isPhaseActive ? cfg.color : '#0f172a' }}>{label}</div>
                                        <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                                            {modulesOfPhase.length > 0 ? `${doneCount}/${modulesOfPhase.length} modules` : desc}
                                        </div>
                                    </div>
                                    {modulesOfPhase.length > 0 && doneCount === modulesOfPhase.length ? (
                                        <CheckCircle size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                                    ) : isPhaseActive ? (
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                                    ) : null}
                                </div>
                            );
                        })}
                    </div> */}

                    {/* Module List */}
                    <div className="glass-card" style={{ padding: isMobile ? '16px' : '20px', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BookOpen size={16} style={{ color: '#2563eb' }} /> Course Modules
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {activeCourse?.modules?.map((m, idx) => {
                                const mPhase = getModulePhase(m);
                                const mCfg = PHASE_CFG[mPhase];
                                const completed = progress?.module_progress?.[m.id]?.completed;
                                const locked = idx > 0 && !progress?.module_progress?.[activeCourse.modules[idx - 1].id]?.completed;
                                const isActive = activeModule?.id === m.id;
                                return (
                                    <div key={m.id} onClick={() => !locked && handleModuleClick(m, idx)} style={{
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        padding: '10px 12px', borderRadius: '8px',
                                        cursor: locked ? 'not-allowed' : 'pointer',
                                        background: isActive ? mCfg.bg : 'transparent',
                                        borderLeft: isActive ? `3px solid ${mCfg.color}` : '3px solid transparent',
                                        opacity: locked ? 0.5 : 1,
                                        transition: 'all 0.15s',
                                    }}>
                                        <div style={{
                                            width: '30px', height: '30px', borderRadius: '7px', flexShrink: 0,
                                            background: isActive ? mCfg.color : '#f1f5f9',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.95rem',
                                        }}>
                                            {mCfg.icon}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.52rem', color: isActive ? mCfg.color : '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                {mCfg.shortLabel} · MOD {String(idx + 1).padStart(2, '0')}
                                            </div>
                                            <div style={{ fontSize: '0.78rem', fontWeight: '600', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {m.title}
                                            </div>
                                        </div>
                                        {completed ? (
                                            <CheckCircle size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                                        ) : locked ? (
                                            <Lock size={13} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                        <button style={{ width: '100%', padding: '10px', marginTop: '10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>
                            View Full Syllabus
                        </button>
                    </div>

                    {/* Up Next */}
                    {nextModule && (
                        <div style={{ background: '#faf5eb', borderRadius: '12px', padding: isMobile ? '16px' : '20px', border: '1px solid #f0e6d0' }}>
                            <div style={{ fontSize: '0.55rem', fontWeight: '700', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>UP NEXT</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <span style={{ fontSize: '1.1rem' }}>{PHASE_CFG[getModulePhase(nextModule)]?.icon}</span>
                                <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#0f172a', lineHeight: '1.3' }}>
                                    Module {String(activeModuleIdx + 2).padStart(2, '0')}: {nextModule.title}
                                </div>
                            </div>
                            <button className="btn" style={{ width: '100%', background: '#b8a070', color: 'white', padding: '10px', borderRadius: '10px', fontWeight: '600', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                onClick={() => handleModuleClick(nextModule, activeModuleIdx + 1)}>
                                Next Module <ArrowRight size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
