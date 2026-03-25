import { useState, useEffect, useMemo } from 'react';
import { adminAPI, courseAPI } from '../services/api';
import { Upload, Plus, Edit3, Grid3X3, ArrowRight, Link2, X, ChevronDown, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

function useWindowWidth() {
    const [w, setW] = useState(window.innerWidth);
    useEffect(() => {
        const h = () => setW(window.innerWidth);
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, []);
    return w;
}

// ─── Phase config (matches CoursePage) ────────────────────────────────────────
const PHASE_CFG = {
    video:      { label: 'Video Lecture',   icon: '🎬', color: '#2563eb', bg: '#eff6ff',  border: '#bfdbfe', contentType: 'video' },
    study:      { label: 'Study Materials', icon: '📖', color: '#10b981', bg: '#ecfdf5',  border: '#a7f3d0', contentType: 'pdf'   },
    assignment: { label: 'Assignment',      icon: '📝', color: '#f59e0b', bg: '#fffbeb',  border: '#fde68a', contentType: null    },
    quiz:       { label: 'Quiz/Assessment', icon: '🎯', color: '#8b5cf6', bg: '#f5f3ff',  border: '#ddd6fe', contentType: 'quiz'  },
};

function inferPhase(module) {
    const st = (module?.section_type || '').toLowerCase();
    const mt = (module?.module_type || '').toLowerCase();
    if (st === 'quiz' || st === 'assessment') return 'quiz';
    if (st === 'assignment') return 'assignment';
    if (st === 'study') return 'study';
    if (st === 'video') return 'video';
    if (mt === 'assessment' || mt === 'quiz' || module?.quiz_id) return 'quiz';
    if (mt === 'assignment') return 'assignment';
    const contents = module?.contents || [];
    const hasVideo = contents.some(c => (c.content_type || '').toLowerCase() === 'video');
    const hasPdf = contents.some(c => (c.content_type || '').toLowerCase() === 'pdf');
    if (hasPdf && !hasVideo) return 'study';
    return 'video';
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AdminCoursePage() {
    const w = useWindowWidth();
    const isMobile = w <= 768;
    const isSmall = w <= 480;
    const navigate = useNavigate();

    const [courses, setCourses] = useState([]);
    const [showCreateModule, setShowCreateModule] = useState(false);
    const [editingModule, setEditingModule] = useState(null);

    const [form, setForm] = useState({
        contentTitle: '',
        contentType: 'video',
        videoUrl: '',
        durationMinutes: 45,
        videoLanguage: 'English',
    });
    const [contentFile, setContentFile] = useState(null);
    const [deploying, setDeploying] = useState(false);

    const modulesFlat = useMemo(() => {
        const list = [];
        for (const c of courses || []) {
            for (const m of c.modules || []) {
                list.push({
                    id: m.id,
                    title: m.title,
                    description: m.description || '',
                    module_type: m.module_type,
                    section_type: m.section_type,
                    quiz_id: m.quiz_id || null,
                    order_index: m.order_index,
                    is_mandatory: m.is_mandatory,
                    contents: m.contents || [],
                    course_id: c.id,
                    course_title: c.title,
                });
            }
        }
        return list;
    }, [courses]);

    const [selectedModuleId, setSelectedModuleId] = useState('');

    const loadCourses = async () => {
        try {
            const r = await courseAPI.list();
            setCourses(r.data || []);
        } catch {
            setCourses([]);
        }
    };

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const r = await courseAPI.list();
                if (!cancelled) setCourses(r.data || []);
            } catch {
                if (!cancelled) setCourses([]);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    // Auto-set content type based on selected module's phase
    useEffect(() => {
        if (!selectedModuleId) return;
        const mod = modulesFlat.find(m => m.id === selectedModuleId);
        if (!mod) return;
        const phase = inferPhase(mod);
        const suggested = PHASE_CFG[phase]?.contentType;
        if (suggested) setForm(f => ({ ...f, contentType: suggested }));
    }, [selectedModuleId, modulesFlat]);

    const handleDeploy = async () => {
        if (!form.contentTitle.trim()) { toast.error('Content title required'); return; }
        if (!selectedModuleId) { toast.error('Linked module is required'); return; }
        if (!['video', 'pdf', 'text'].includes(form.contentType)) {
            toast.error('Use Create Quiz / Create Assignment for this type');
            return;
        }
        if (['video', 'pdf'].includes(form.contentType) && !contentFile && !(form.videoUrl || '').trim()) {
            toast.error(`Upload a ${form.contentType.toUpperCase()} file or add URL`);
            return;
        }

        const selectedModule = modulesFlat.find(m => m.id === selectedModuleId);
        const nextOrderIndex = (selectedModule?.contents?.length || 0) + 1;

        try {
            setDeploying(true);
            // Large files upload faster when browser sends directly to R2 via presigned URL.
            let finalContentUrl = (form.videoUrl || '').trim();
            if (contentFile) {
                const presignRes = await adminAPI.presignContentUpload({
                    filename: contentFile.name || 'upload.bin',
                    content_type: contentFile.type || 'application/octet-stream',
                    prefix: 'content',
                });
                const uploadUrl = presignRes?.data?.upload_url;
                finalContentUrl = presignRes?.data?.public_url || '';
                if (!uploadUrl || !finalContentUrl) {
                    throw new Error('Presigned upload URL is missing');
                }

                const uploadResp = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': contentFile.type || 'application/octet-stream',
                    },
                    body: contentFile,
                });
                if (!uploadResp.ok) {
                    throw new Error(`Direct upload failed (${uploadResp.status})`);
                }
            }

            const fd = new FormData();
            fd.append('module_id', selectedModuleId);
            fd.append('title', form.contentTitle.trim());
            fd.append('content_type', form.contentType);
            fd.append('content_url', finalContentUrl);
            const durationValue = Number(form.durationMinutes || 0);
            fd.append('content_text', form.contentType === 'video' ? (form.videoLanguage || '').trim() : '');
            fd.append('duration_minutes', String(durationValue > 0 ? durationValue : 45));
            fd.append('order_index', String(nextOrderIndex));

            await adminAPI.createContent(fd);
            toast.success('Content deployed! ✅');
            setForm({
                contentTitle: '',
                contentType: 'video',
                videoUrl: '',
                durationMinutes: 45,
                videoLanguage: 'English',
            });
            setContentFile(null);
            await loadCourses();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Failed to deploy content');
        } finally {
            setDeploying(false);
        }
    };

    const handleDeleteModule = async (module) => {
        if (!module?.id) return;
        const ok = window.confirm(`Delete module "${module.title}" and all its contents?`);
        if (!ok) return;
        try {
            await adminAPI.deleteModule(module.id);
            toast.success('Module deleted');
            if (selectedModuleId === module.id) setSelectedModuleId('');
            await loadCourses();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Failed to delete module');
        }
    };

    const selectedModule = modulesFlat.find(m => m.id === selectedModuleId);
    const selectedPhase = selectedModule ? inferPhase(selectedModule) : 'video';
    const selectedPhaseCfg = PHASE_CFG[selectedPhase];

    // Phase summary stats
    const phaseCounts = Object.keys(PHASE_CFG).reduce((acc, key) => {
        acc[key] = modulesFlat.filter(m => inferPhase(m) === key).length;
        return acc;
    }, {});

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-end', marginBottom: isMobile ? '20px' : '24px', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
                <div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>Course Management</div>
                    <h1 style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: '800', color: '#0f172a' }}>Course Content Hub</h1>
                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Manage modules, learning paths, and academic materials.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button className="btn" style={{ background: 'white', border: '1px solid #e2e8f0', color: '#0f172a', padding: '10px 18px', borderRadius: '10px', fontWeight: '600', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Edit3 size={14} /> Edit Curriculum
                    </button>
                    <button className="btn" onClick={() => setShowCreateModule(true)} style={{ background: '#0f172a', color: 'white', padding: '10px 18px', borderRadius: '10px', fontWeight: '700', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={14} /> Add New Module
                    </button>
                </div>
            </div>

            {/* Learning Phase Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                {Object.entries(PHASE_CFG).map(([key, cfg]) => (
                    <div key={key} className="glass-card" style={{ padding: '16px 18px', borderLeft: `4px solid ${cfg.color}` }}>
                        <div style={{ fontSize: '1.4rem', marginBottom: '6px' }}>{cfg.icon}</div>
                        <div style={{ fontSize: '0.58rem', fontWeight: '700', color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>{key}</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f172a' }}>{cfg.label}</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a', fontFamily: "'Outfit'", marginTop: '6px' }}>{phaseCounts[key]}</div>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>modules</div>
                    </div>
                ))}
            </div>

            {/* Upload + Modules Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '320px 1fr', gap: isMobile ? '16px' : '28px', marginBottom: '28px' }}>
                {/* Upload Content Card */}
                <div className="glass-card" style={{ padding: isMobile ? '20px' : '28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '22px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Upload size={18} style={{ color: '#10b981' }} />
                        </div>
                        <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>Deploy Content</h3>
                    </div>

                    {/* Content Title */}
                    <label style={{ fontSize: '0.62rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>CONTENT TITLE</label>
                    <input type="text" placeholder="e.g. Introduction to AI Ethics" value={form.contentTitle}
                        onChange={e => setForm({ ...form, contentTitle: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', color: '#334155', background: '#f8fafc', outline: 'none', marginBottom: '16px' }}
                    />

                    {/* Linked Module */}
                    <label style={{ fontSize: '0.62rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>LINKED MODULE</label>
                    <select value={selectedModuleId} onChange={(e) => setSelectedModuleId(e.target.value)}
                        style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.82rem', color: '#334155', background: '#f8fafc', outline: 'none', cursor: 'pointer', marginBottom: '10px' }}>
                        <option value="">Select linked module *</option>
                        {modulesFlat.map((m) => (
                            <option key={m.id} value={m.id}>
                                {PHASE_CFG[inferPhase(m)]?.icon} {m.course_title} — {m.title}
                            </option>
                        ))}
                    </select>

                    {/* Phase Hint */}
                    {selectedModule && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: selectedPhaseCfg.bg, border: `1px solid ${selectedPhaseCfg.border}`, borderRadius: '8px', marginBottom: '16px' }}>
                            <span style={{ fontSize: '1rem' }}>{selectedPhaseCfg.icon}</span>
                            <span style={{ fontSize: '0.75rem', color: selectedPhaseCfg.color, fontWeight: '700' }}>
                                {selectedPhaseCfg.label} phase detected
                            </span>
                        </div>
                    )}

                    {/* Content Type */}
                    <label style={{ fontSize: '0.62rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>CONTENT TYPE</label>
                    <select value={form.contentType} onChange={e => setForm({ ...form, contentType: e.target.value })}
                        style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.82rem', color: '#334155', background: '#f8fafc', outline: 'none', cursor: 'pointer', marginBottom: '16px' }}>
                        <option value="video">🎬 Video Lesson</option>
                        <option value="pdf">📖 PDF Document</option>
                        <option value="quiz">🎯 Quiz</option>
                        <option value="assignment">📝 Assignment</option>
                        <option value="text">📝 Text / Notes</option>
                    </select>

                    {(form.contentType === 'video' || form.contentType === 'pdf') && (
                        <>
                            <label style={{ fontSize: '0.62rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>
                                {form.contentType === 'video' ? 'UPLOAD VIDEO' : 'UPLOAD PDF'}
                            </label>
                            <input
                                type="file"
                                accept={form.contentType === 'video' ? 'video/*' : 'application/pdf'}
                                onChange={(e) => setContentFile(e.target.files?.[0] || null)}
                                style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.82rem', color: '#334155', background: '#f8fafc', outline: 'none', cursor: 'pointer', marginBottom: '10px' }}
                            />

                            <label style={{ fontSize: '0.62rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>
                                OR URL (optional)
                            </label>
                            <div style={{ position: 'relative', marginBottom: '20px' }}>
                                <Link2 size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input type="url" placeholder="https://…" value={form.videoUrl}
                                    onChange={e => setForm({ ...form, videoUrl: e.target.value })}
                                    style={{ width: '100%', padding: '10px 14px 10px 34px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.82rem', color: '#334155', background: '#f8fafc', outline: 'none' }}
                                />
                            </div>
                            {form.contentType === 'video' && (
                                <>
                                    <label style={{ fontSize: '0.62rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>
                                        VIDEO DURATION (MINUTES)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={form.durationMinutes}
                                        onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                                        style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.82rem', color: '#334155', background: '#f8fafc', outline: 'none', marginBottom: '10px' }}
                                    />
                                    <label style={{ fontSize: '0.62rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>
                                        VIDEO LANGUAGE
                                    </label>
                                    <input
                                        type="text"
                                        value={form.videoLanguage}
                                        onChange={(e) => setForm({ ...form, videoLanguage: e.target.value })}
                                        placeholder="e.g. English"
                                        style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.82rem', color: '#334155', background: '#f8fafc', outline: 'none', marginBottom: '20px' }}
                                    />
                                </>
                            )}
                        </>
                    )}

                    {form.contentType === 'text' && (
                        <>
                            <label style={{ fontSize: '0.62rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>TEXT/NOTES LINK (optional)</label>
                            <div style={{ position: 'relative', marginBottom: '20px' }}>
                                <Link2 size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input type="url" placeholder="https://…" value={form.videoUrl}
                                    onChange={e => setForm({ ...form, videoUrl: e.target.value })}
                                    style={{ width: '100%', padding: '10px 14px 10px 34px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.82rem', color: '#334155', background: '#f8fafc', outline: 'none' }}
                                />
                            </div>
                        </>
                    )}

                    {(form.contentType === 'video' || form.contentType === 'pdf' || form.contentType === 'text') && (
                        <button className="btn" onClick={handleDeploy} disabled={deploying} style={{
                            width: '100%', background: '#1e3a5f', color: 'white', padding: '14px', borderRadius: '10px',
                            fontWeight: '700', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            opacity: deploying ? 0.75 : 1,
                        }}>
                            {deploying ? 'Deploying…' : 'Deploy Content'} <ArrowRight size={16} />
                        </button>
                    )}

                    {form.contentType === 'quiz' && (
                        <button className="btn" onClick={() => {
                            if (!form.contentTitle.trim()) { toast.error('Content title required'); return; }
                            if (!selectedModuleId) { toast.error('Linked module is required'); return; }
                            const q = new URLSearchParams({
                                from: 'courses',
                                moduleId: selectedModule?.id || '',
                                title: form.contentTitle.trim(),
                            });
                            navigate(`/admin/quizzes?${q.toString()}`);
                        }} style={{
                            width: '100%', background: '#8b5cf6', color: 'white', padding: '14px', borderRadius: '10px',
                            fontWeight: '700', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        }}>
                            Create Quiz <ArrowRight size={16} />
                        </button>
                    )}

                    {form.contentType === 'assignment' && (
                        <button className="btn" onClick={() => {
                            if (!form.contentTitle.trim()) { toast.error('Content title required'); return; }
                            if (!selectedModuleId) { toast.error('Linked module is required'); return; }
                            const q = new URLSearchParams({
                                from: 'courses',
                                moduleId: selectedModule?.id || '',
                                title: form.contentTitle.trim(),
                            });
                            navigate(`/admin/assignments?${q.toString()}`);
                        }} style={{
                            width: '100%', background: '#f59e0b', color: 'white', padding: '14px', borderRadius: '10px',
                            fontWeight: '700', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        }}>
                            Create Assignment <ArrowRight size={16} />
                        </button>
                    )}
                </div>

                {/* Module Cards Grid */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Grid3X3 size={16} style={{ color: '#4338ca' }} />
                            </div>
                            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>All Modules</h3>
                        </div>
                        <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#10b981', padding: '4px 10px', background: '#d1fae5', borderRadius: '20px', textTransform: 'uppercase' }}>
                            {modulesFlat.length} TOTAL
                        </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr' : 'repeat(2, 1fr)', gap: isMobile ? '12px' : '14px' }}>
                        {modulesFlat.length > 0 ? modulesFlat.map((m) => {
                            const phase = inferPhase(m);
                            const cfg = PHASE_CFG[phase];
                            return (
                                <div key={`${m.course_id}-${m.id}`} className="glass-card" style={{ padding: isMobile ? '16px' : '20px', overflow: 'hidden', position: 'relative' }}>
                                    {/* Top color bar */}
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: cfg.color, borderRadius: '8px 8px 0 0' }} />

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', marginTop: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', border: `1px solid ${cfg.border}` }}>
                                                {cfg.icon}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.52rem', fontWeight: '700', color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                    {cfg.label}
                                                </div>
                                                <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>MOD {m.order_index != null ? String(m.order_index).padStart(2, '0') : '—'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <h4 style={{ fontSize: isMobile ? '0.88rem' : '0.95rem', fontWeight: '700', color: '#0f172a', marginBottom: '12px', lineHeight: '1.3' }}>
                                        {m.title}
                                    </h4>

                                    {/* Content type pills */}
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                                        {['video', 'pdf', 'text', 'quiz'].map(ct => {
                                            const count = m.contents.filter(c => (c.content_type || '').toLowerCase() === ct).length;
                                            if (count === 0) return null;
                                            const ctLabels = { video: '🎬', pdf: '📄', text: '📝', quiz: '🎯' };
                                            return (
                                                <span key={ct} style={{ fontSize: '0.62rem', fontWeight: '600', color: '#475569', padding: '2px 8px', background: '#f1f5f9', borderRadius: '4px' }}>
                                                    {ctLabels[ct]} {count} {ct}
                                                </span>
                                            );
                                        })}
                                        {m.quiz_id && (
                                            <span style={{ fontSize: '0.62rem', fontWeight: '700', color: '#8b5cf6', padding: '2px 8px', background: '#f5f3ff', borderRadius: '4px' }}>
                                                🎯 Has Quiz
                                            </span>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#10b981', fontWeight: '600' }}>
                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                                            {m.contents?.length || 0} Resources
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button
                                                onClick={() => setEditingModule(m)}
                                                style={{
                                                    fontSize: '0.7rem', fontWeight: '700', color: '#0f172a',
                                                    background: 'white', border: '1px solid #e2e8f0',
                                                    padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                }}>
                                                <Edit3 size={11} /> Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteModule(m)}
                                                style={{
                                                    fontSize: '0.7rem', fontWeight: '700', color: '#dc2626',
                                                    background: '#fff1f2', border: '1px solid #fecdd3',
                                                    padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                }}>
                                                <Trash2 size={11} /> Delete
                                            </button>
                                            <button
                                                onClick={() => setSelectedModuleId(m.id)}
                                                style={{
                                                    fontSize: '0.7rem', fontWeight: '700', color: cfg.color,
                                                    background: cfg.bg, border: `1px solid ${cfg.border}`,
                                                    padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                }}>
                                                Add Content <ArrowRight size={11} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div style={{ gridColumn: '1 / -1', padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                                No modules found. Create one using the button above.
                            </div>
                        )}
                    </div>

                    {/* Roadmap Banner */}
                    <div style={{
                        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
                        borderRadius: '16px', padding: isMobile ? '24px' : '28px',
                        marginTop: '16px', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
                        gap: isMobile ? '16px' : '28px', flexDirection: isMobile ? 'column' : 'row',
                    }}>
                        <div style={{ flex: 1, color: 'white' }}>
                            <h3 style={{ fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: '800', marginBottom: '4px', color: 'white' }}>
                                Academic Excellence Roadmap
                            </h3>
                            <p style={{ fontSize: '0.82rem', opacity: 0.7 }}>
                                Structured learning: 🎬 Video → 📖 Study → 📝 Assignment → 🎯 Quiz
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {['TADRI', 'AIC BIHAR'].map((t, i) => (
                                <div key={i} style={{ padding: '12px 18px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'white' }}>{t}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Module Modal */}
            {showCreateModule && (
                <CreateModuleModal
                    courses={courses}
                    isMobile={isMobile}
                    onClose={() => setShowCreateModule(false)}
                    onCreated={async () => { await loadCourses(); setShowCreateModule(false); }}
                />
            )}

            {editingModule && (
                <EditModuleModal
                    module={editingModule}
                    isMobile={isMobile}
                    onClose={() => setEditingModule(null)}
                    onSaved={async () => {
                        await loadCourses();
                        setEditingModule(null);
                    }}
                />
            )}
        </div>
    );
}

function EditModuleModal({ module, isMobile, onClose, onSaved }) {
    const [moduleForm, setModuleForm] = useState({
        title: module.title || '',
        description: module.description || '',
        section_type: module.section_type || inferPhase(module),
        module_type: module.module_type || inferPhase(module),
        order_index: module.order_index || 1,
        quiz_id: module.quiz_id || '',
        is_mandatory: module.is_mandatory !== false,
    });
    const [contents, setContents] = useState((module.contents || []).map((c) => ({ ...c })));
    const [savingModule, setSavingModule] = useState(false);
    const [savingContentId, setSavingContentId] = useState('');
    const [allQuizzes, setAllQuizzes] = useState([]);

    useEffect(() => {
        let cancelled = false;
        adminAPI.quizzes()
            .then((r) => {
                if (!cancelled) setAllQuizzes(r.data || []);
            })
            .catch(() => {
                if (!cancelled) setAllQuizzes([]);
            });
        return () => { cancelled = true; };
    }, []);

    const quizzesForSelect = useMemo(() => {
        const cid = String(module.course_id || '');
        const list = allQuizzes || [];
        const sameCourse = list.filter((q) => String(q.course_id) === cid);
        return sameCourse.length ? sameCourse : list;
    }, [allQuizzes, module.course_id]);

    const setContentField = (contentId, key, value) => {
        setContents((prev) => prev.map((c) => (c.id === contentId ? { ...c, [key]: value } : c)));
    };

    const saveModule = async () => {
        if (!moduleForm.title.trim()) {
            toast.error('Module title is required');
            return;
        }
        setSavingModule(true);
        try {
            await adminAPI.updateModule(module.id, {
                title: moduleForm.title.trim(),
                description: moduleForm.description,
                section_type: moduleForm.section_type,
                module_type: moduleForm.module_type,
                order_index: Number(moduleForm.order_index || 1),
                quiz_id: moduleForm.quiz_id?.trim() || null,
                is_mandatory: Boolean(moduleForm.is_mandatory),
            });
            toast.success('Module updated');
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Failed to update module');
        } finally {
            setSavingModule(false);
        }
    };

    const saveContent = async (content) => {
        setSavingContentId(content.id);
        try {
            await adminAPI.updateModuleContent(module.id, content.id, {
                title: content.title?.trim() || '',
                content_type: content.content_type,
                content_url: content.content_url || '',
                content_text: content.content_text || '',
                duration_minutes: Number(content.duration_minutes || 0),
                order_index: Number(content.order_index || 0),
                is_mandatory: content.is_mandatory !== false,
            });
            toast.success('Content updated');
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Failed to update content');
        } finally {
            setSavingContentId('');
        }
    };

    const deleteContent = async (content) => {
        const ok = window.confirm(`Delete content "${content?.title || 'Untitled'}"?`);
        if (!ok) return;
        setSavingContentId(content.id);
        try {
            await adminAPI.deleteModuleContent(module.id, content.id);
            setContents((prev) => prev.filter((c) => c.id !== content.id));
            toast.success('Content deleted');
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Failed to delete content');
        } finally {
            setSavingContentId('');
        }
    };

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 320, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', padding: '20px',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: 'white', borderRadius: '20px', width: '100%',
                    maxWidth: '920px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ padding: '22px 24px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a' }}>Edit Module</h2>
                        <p style={{ fontSize: '0.78rem', color: '#64748b' }}>{module.course_title}</p>
                    </div>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', width: '34px', height: '34px', cursor: 'pointer' }}>
                        <X size={16} style={{ color: '#64748b' }} />
                    </button>
                </div>

                <div style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                        <input value={moduleForm.title} onChange={(e) => setModuleForm((f) => ({ ...f, title: e.target.value }))}
                            placeholder="Module title"
                            style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }} />
                        <input value={moduleForm.description} onChange={(e) => setModuleForm((f) => ({ ...f, description: e.target.value }))}
                            placeholder="Description"
                            style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }} />
                        <select value={moduleForm.section_type} onChange={(e) => setModuleForm((f) => ({ ...f, section_type: e.target.value }))}
                            style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
                            <option value="video">video</option>
                            <option value="study">study</option>
                            <option value="assignment">assignment</option>
                            <option value="quiz">quiz</option>
                        </select>
                        <input type="number" value={moduleForm.order_index} onChange={(e) => setModuleForm((f) => ({ ...f, order_index: e.target.value }))}
                            placeholder="Order index"
                            style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }} />
                        <div style={{ gridColumn: isMobile ? undefined : '1 / -1' }}>
                            <label style={{ fontSize: '0.62rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>
                                Link existing quiz
                            </label>
                            <select
                                value={moduleForm.quiz_id || ''}
                                onChange={(e) => setModuleForm((f) => ({ ...f, quiz_id: e.target.value }))}
                                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}
                            >
                                <option value="">— No quiz linked —</option>
                                {quizzesForSelect.map((q) => (
                                    <option key={q.id} value={q.id}>
                                        {q.title} · {q.total_questions ?? 0} Qs
                                    </option>
                                ))}
                                {moduleForm.quiz_id && !quizzesForSelect.some((q) => String(q.id) === String(moduleForm.quiz_id)) && (
                                    <option value={moduleForm.quiz_id}>
                                        Current link: {String(moduleForm.quiz_id).slice(0, 12)}…
                                    </option>
                                )}
                            </select>
                            <input
                                value={moduleForm.quiz_id}
                                onChange={(e) => setModuleForm((f) => ({ ...f, quiz_id: e.target.value }))}
                                placeholder="Or paste quiz ID manually"
                                style={{ width: '100%', marginTop: '8px', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', fontSize: '0.82rem' }}
                            />
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '6px', lineHeight: 1.45 }}>
                                {quizzesForSelect.length === 0
                                    ? 'No quizzes loaded. Create one under Quiz Management, then open Edit again.'
                                    : 'Choose a quiz and click Save Module. If this quiz was linked elsewhere, that link is cleared automatically.'}
                            </div>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#334155' }}>
                            <input type="checkbox" checked={moduleForm.is_mandatory} onChange={(e) => setModuleForm((f) => ({ ...f, is_mandatory: e.target.checked }))} />
                            Mandatory module
                        </label>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
                        <button onClick={saveModule} disabled={savingModule} className="btn"
                            style={{ background: '#0f172a', color: 'white', padding: '9px 16px', borderRadius: '8px', fontWeight: 700, opacity: savingModule ? 0.7 : 1 }}>
                            {savingModule ? 'Saving...' : 'Save Module'}
                        </button>
                    </div>

                    <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                        Module Contents ({contents.length})
                    </div>
                    <div style={{ display: 'grid', gap: '10px' }}>
                        {contents.map((ct) => (
                            <div key={ct.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', background: '#f8fafc' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 0.8fr 0.8fr', gap: '8px', marginBottom: '8px' }}>
                                    <input value={ct.title || ''} onChange={(e) => setContentField(ct.id, 'title', e.target.value)}
                                        placeholder="Content title" style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                                    <input value={ct.content_type || ''} onChange={(e) => setContentField(ct.id, 'content_type', e.target.value)}
                                        placeholder="Type" style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                                    <input type="number" value={ct.order_index ?? 0} onChange={(e) => setContentField(ct.id, 'order_index', e.target.value)}
                                        placeholder="Order" style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                                </div>
                                <input value={ct.content_url || ''} onChange={(e) => setContentField(ct.id, 'content_url', e.target.value)}
                                    placeholder="Content URL" style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '8px' }} />
                                <textarea rows={2} value={ct.content_text || ''} onChange={(e) => setContentField(ct.id, 'content_text', e.target.value)}
                                    placeholder="Content text / notes"
                                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '8px', fontFamily: 'inherit' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                                        <input type="checkbox" checked={ct.is_mandatory !== false} onChange={(e) => setContentField(ct.id, 'is_mandatory', e.target.checked)} />
                                        Mandatory
                                    </label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => deleteContent(ct)} disabled={savingContentId === ct.id}
                                            style={{ background: '#fff1f2', color: '#dc2626', border: '1px solid #fecdd3', borderRadius: '8px', padding: '7px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', opacity: savingContentId === ct.id ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <Trash2 size={12} />
                                            Delete
                                        </button>
                                        <button onClick={() => saveContent(ct)} disabled={savingContentId === ct.id}
                                            style={{ background: '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', padding: '7px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', opacity: savingContentId === ct.id ? 0.7 : 1 }}>
                                            {savingContentId === ct.id ? 'Saving...' : 'Save Content'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ padding: '14px 24px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                    <button onClick={onClose} style={{ background: 'white', border: '1px solid #e2e8f0', color: '#64748b', padding: '9px 16px', borderRadius: '8px' }}>
                        Close
                    </button>
                    <button onClick={onSaved} className="btn" style={{ background: '#10b981', color: 'white', padding: '9px 16px', borderRadius: '8px', fontWeight: 700 }}>
                        Refresh & Done
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Create Module Modal ───────────────────────────────────────────────────────
function CreateModuleModal({ courses, isMobile, onClose, onCreated }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [sectionType, setSectionType] = useState('video');
    const [courseId, setCourseId] = useState(courses[0]?.id || '');
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        if (!title.trim()) { toast.error('Module title is required'); return; }
        if (!courseId) { toast.error('Select a course'); return; }
        setCreating(true);
        try {
            const existingModules = courses.find(c => c.id === courseId)?.modules || [];
            const nextOrder = existingModules.length + 1;

            const fd = new FormData();
            fd.append('course_id', courseId);
            fd.append('title', title.trim());
            fd.append('description', description.trim());
            fd.append('order_index', String(nextOrder));
            fd.append('section_type', sectionType);
            fd.append('module_type', sectionType);

            await adminAPI.createModule(fd);
            toast.success('Module created! 🎉');
            await onCreated();
        } catch (err) {
            toast.error(err?.response?.data?.detail || 'Failed to create module');
        } finally { setCreating(false); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', padding: '20px' }}
            onClick={onClose}>
            <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '520px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}
                onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ padding: '24px 28px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>Create New Module</h2>
                        <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>Choose a learning phase and module details</p>
                    </div>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <X size={16} style={{ color: '#64748b' }} />
                    </button>
                </div>

                <div style={{ padding: '24px 28px' }}>
                    {/* Phase Selector */}
                    <label style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '10px' }}>
                        LEARNING PHASE *
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '20px' }}>
                        {Object.entries(PHASE_CFG).map(([key, cfg]) => (
                            <button key={key} type="button" onClick={() => setSectionType(key)} style={{
                                padding: '12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                                background: sectionType === key ? cfg.bg : '#f8fafc',
                                border: sectionType === key ? `2px solid ${cfg.color}` : '2px solid #e2e8f0',
                                transition: 'all 0.15s',
                            }}>
                                <span style={{ fontSize: '1.4rem', display: 'block', marginBottom: '4px' }}>{cfg.icon}</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: sectionType === key ? cfg.color : '#475569' }}>{cfg.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Course */}
                    <label style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>COURSE</label>
                    <select value={courseId} onChange={e => setCourseId(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', color: '#334155', background: '#f8fafc', outline: 'none', marginBottom: '16px' }}>
                        {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>

                    {/* Title */}
                    <label style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>MODULE TITLE *</label>
                    <input type="text" placeholder={`e.g. ${PHASE_CFG[sectionType]?.label}: Introduction`}
                        value={title} onChange={e => setTitle(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem', color: '#334155', background: '#f8fafc', outline: 'none', marginBottom: '16px' }}
                    />

                    {/* Description */}
                    <label style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>DESCRIPTION</label>
                    <textarea rows={3} placeholder="Brief description of what students will learn..."
                        value={description} onChange={e => setDescription(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', color: '#334155', background: '#f8fafc', resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif', marginBottom: '0' }}
                    />
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 28px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button onClick={onClose} className="btn" style={{ background: 'white', border: '1px solid #e2e8f0', color: '#64748b', padding: '10px 20px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '600' }}>
                        Cancel
                    </button>
                    <button onClick={handleCreate} disabled={creating} className="btn" style={{
                        background: PHASE_CFG[sectionType]?.color, color: 'white',
                        padding: '10px 24px', borderRadius: '10px', fontSize: '0.88rem', fontWeight: '700',
                        opacity: creating ? 0.7 : 1,
                        display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                        <Plus size={16} /> {creating ? 'Creating…' : 'Create Module'}
                    </button>
                </div>
            </div>
        </div>
    );
}

