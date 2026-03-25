import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import {
    Filter, Download, Edit3, X, Search, ChevronLeft, ChevronRight,
    FileText, Plus, Calendar, Clock, CheckCircle, AlertCircle,
    Eye, Award, ClipboardList, TrendingUp, Upload, Book, Trash2, Link2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';

function useWindowWidth() {
    const [w, setW] = useState(window.innerWidth);
    useEffect(() => { const h = () => setW(window.innerWidth); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h); }, []);
    return w;
}

const avatarColors = ['#f59e0b', '#4f46e5', '#10b981', '#8b5cf6', '#ec4899', '#0ea5e9', '#ef4444', '#0f172a'];
const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '??';

export default function AdminAssignmentPage() {
    const w = useWindowWidth();
    const isMobile = w <= 768;

    // Data state
    const [submissions, setSubmissions] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [filter, setFilter] = useState('All Students');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);

    // Review panel
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [reviewScore, setReviewScore] = useState('');
    const [reviewNotes, setReviewNotes] = useState('');
    const [grading, setGrading] = useState(false);
    const [showPdfPreview, setShowPdfPreview] = useState(false);

    // Create modal
    const [showCreate, setShowCreate] = useState(false);
    const [searchParams] = useSearchParams();

    const [assignmentTemplates, setAssignmentTemplates] = useState([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [editingSection, setEditingSection] = useState(null);

    const filters = ['All Students', 'Top Performing', 'Needs Review'];
    const limit = 10;

    // ── Load data ──
    useEffect(() => {
        loadSubmissions();
    }, [page, searchTerm]);

    useEffect(() => {
        loadStats();
        loadAssignmentTemplates();
    }, []);

    const loadAssignmentTemplates = async () => {
        setTemplatesLoading(true);
        try {
            const res = await adminAPI.assignmentSections();
            setAssignmentTemplates(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error(e);
            setAssignmentTemplates([]);
        } finally {
            setTemplatesLoading(false);
        }
    };

    useEffect(() => {
        if (searchParams.get('from') !== 'courses') return;
        setShowCreate(true);
    }, [searchParams]);

    const loadStats = async () => {
        try {
            const res = await adminAPI.assignmentStats();
            setStats(res.data);
        } catch (e) { console.error(e); }
    };

    const loadSubmissions = async () => {
        setLoading(true);
        try {
            const res = await adminAPI.assignments({
                page, limit,
                search: searchTerm || undefined,
            });
            setSubmissions(res.data?.submissions || []);
            setTotal(res.data?.total || 0);
        } catch (e) {
            console.error(e);
            setSubmissions([]);
        } finally { setLoading(false); }
    };

    // ── Filter locally ──
    const filteredSubmissions = submissions.filter(s => {
        if (filter === 'Top Performing') return s.marks != null && Number(s.marks) >= 80;
        if (filter === 'Needs Review') return s.status === 'submitted';
        return true;
    });

    // ── Grade handler ──
    const handleGrade = async () => {
        if (!selectedSubmission) return;
        if (selectedSubmission.status === 'pending') {
            toast.error('Student has not submitted this assignment yet.');
            return;
        }
        setGrading(true);
        try {
            await adminAPI.gradeAssignment(selectedSubmission.id, {
                marks: reviewScore ? parseInt(reviewScore) : undefined,
                feedback: reviewNotes || undefined,
            });
            toast.success('Assignment graded successfully! ✅');
            setSelectedSubmission(null);
            setReviewScore('');
            setReviewNotes('');
            loadSubmissions();
            loadStats();
        } catch (err) {
            toast.error(err?.response?.data?.detail || 'Failed to grade');
        } finally { setGrading(false); }
    };

    // ── Status helpers ──
    const getStatusConfig = (status) => {
        switch (status) {
            case 'submitted': return { label: 'SUBMITTED', color: '#10b981', bg: '#d1fae5' };
            case 'graded': return { label: 'GRADED', color: '#4f46e5', bg: '#e0e7ff' };
            case 'reviewed': return { label: 'REVIEWED', color: '#f59e0b', bg: '#fef3c7' };
            default: return { label: 'PENDING', color: '#64748b', bg: '#f1f5f9' };
        }
    };

    const formatDate = (iso) => {
        if (!iso) return '—';
        const d = new Date(iso);
        const now = new Date();
        const diff = Math.floor((now - d) / 3600000);
        if (diff < 1) return 'Just now';
        if (diff < 24) return `${diff}h ago`;
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const totalPages = Math.ceil(total / limit) || 1;
    const toAbsoluteUploadUrl = (url) => {
        if (!url) return '';
        const u = String(url).trim();
        if (!u) return '';
        if (u.startsWith('http://') || u.startsWith('https://')) return u;
        if (u.startsWith('/uploads/')) return `http://localhost:8000${u}`;
        return u;
    };
    const selectedFileUrl = toAbsoluteUploadUrl(selectedSubmission?.file_url || '');
    const selectedIsPdf = /\.pdf(\?.*)?$/i.test(selectedSubmission?.file_name || '') || /\.pdf(\?.*)?$/i.test(selectedFileUrl);

    if (loading && submissions.length === 0) return <div className="loading-screen"><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            {/* ═══ Breadcrumb + Header ═══ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-end', marginBottom: '8px', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
                <div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>Academic Management › <span style={{ fontWeight: '600', color: '#2563eb' }}>Assignment Evaluation</span></div>
                    <h1 style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: '800', color: '#0f172a' }}>Student Assignments</h1>
                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Reviewing {total} active student profiles across all regional campuses.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button className="btn" style={{ background: 'white', border: '1px solid #e2e8f0', color: '#0f172a', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Filter size={14} /> Filter View
                    </button>
                    <button className="btn" style={{ background: '#0f172a', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Download size={14} /> Export CSV
                    </button>
                </div>
            </div>

            {/* ═══ Stats Cards Row ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '180px 180px 1fr', gap: '16px', marginBottom: '20px' }}>
                {/* Avg Performance */}
                <div className="glass-card" style={{ padding: '18px 20px' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>AVG. PERFORMANCE</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>{stats?.avg_performance || 84.2}%</span>
                        <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <TrendingUp size={12} /> +2.4
                        </span>
                    </div>
                </div>

                {/* Pending Review */}
                <div className="glass-card" style={{ padding: '18px 20px' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>PENDING REVIEW</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>{stats?.pending_review ?? 48}</span>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Assignments</span>
                    </div>
                </div>

                {/* Submission Deadline Banner */}
                <div style={{
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
                    borderRadius: '14px', padding: isMobile ? '16px 18px' : '18px 24px',
                    color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    gridColumn: isMobile ? '1 / -1' : 'auto',
                }}>
                    <div>
                        <div style={{ fontSize: '0.6rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7, marginBottom: '4px', color: '#fbbf24' }}>SUBMISSION DEADLINE</div>
                        <div style={{ fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: '700' }}>
                            {stats?.upcoming_deadline?.title || 'Module 4: Advanced AI Ethics'}
                        </div>
                        <div style={{ fontSize: '0.78rem', opacity: 0.7, marginTop: '2px' }}>Ends in 2 days, 4 hours</div>
                    </div>
                    <div style={{
                        width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <AlertCircle size={22} style={{ color: 'white' }} />
                    </div>
                </div>
            </div>

            {/* ═══ Assignment definitions (templates) ═══ */}
            <div className="glass-card" style={{ padding: '0', overflow: 'hidden', marginBottom: '20px' }}>
                <div style={{
                    padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
                    display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center',
                    flexDirection: isMobile ? 'column' : 'row', gap: '12px',
                    background: '#f8fafc',
                }}>
                    <div>
                        <div style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Templates</div>
                        <h2 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>All assignment sections</h2>
                        <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>Edit metadata, attach an optional questions PDF, or remove a section.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowCreate(true)}
                        className="btn"
                        style={{
                            background: '#0f172a', color: 'white', padding: '8px 16px', borderRadius: '8px',
                            fontWeight: '700', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px', border: 'none', cursor: 'pointer',
                        }}
                    >
                        <Plus size={16} /> New assignment
                    </button>
                </div>
                {templatesLoading && assignmentTemplates.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                ) : assignmentTemplates.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                        <ClipboardList size={32} style={{ margin: '0 auto 10px', opacity: 0.35 }} />
                        <div style={{ fontSize: '0.9rem' }}>No assignment sections yet.</div>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        {!isMobile && (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(160px, 1.4fr) 90px 100px 80px minmax(120px, 1fr) 100px',
                                padding: '10px 18px', background: '#fff', borderBottom: '1px solid #f1f5f9',
                                fontSize: '0.58rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em',
                            }}>
                                <span>Title</span>
                                <span>Module</span>
                                <span>Due</span>
                                <span>Wt %</span>
                                <span>Questions PDF</span>
                                <span style={{ textAlign: 'right' }}>Actions</span>
                            </div>
                        )}
                        {assignmentTemplates.map((row) => {
                            const pdfAbs = toAbsoluteUploadUrl(row.questions_pdf_url || '');
                            return (
                                <div
                                    key={row.id}
                                    style={{
                                        display: isMobile ? 'flex' : 'grid',
                                        gridTemplateColumns: isMobile ? undefined : 'minmax(160px, 1.4fr) 90px 100px 80px minmax(120px, 1fr) 100px',
                                        flexDirection: isMobile ? 'column' : undefined,
                                        gap: isMobile ? '8px' : '0',
                                        padding: '14px 18px',
                                        borderBottom: '1px solid #f1f5f9',
                                        alignItems: isMobile ? 'stretch' : 'center',
                                        fontSize: '0.82rem',
                                    }}
                                >
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.title}</div>
                                        {isMobile && <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>Module {row.module_id}</div>}
                                    </div>
                                    {!isMobile && <span style={{ color: '#475569' }}>{row.module_id}</span>}
                                    <span style={{ color: '#64748b' }}>{row.due_date || '—'}</span>
                                    <span style={{ fontWeight: '700', color: '#0f172a' }}>{row.weight ?? 0}%</span>
                                    <div style={{ minWidth: 0 }}>
                                        {row.questions_pdf_url ? (
                                            <a href={pdfAbs} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem', fontWeight: '600', color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '4px', maxWidth: '100%' }}>
                                                <Link2 size={14} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.questions_pdf_name || 'PDF'}</span>
                                            </a>
                                        ) : (
                                            <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>None</span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                                        <button
                                            type="button"
                                            title="Edit"
                                            onClick={() => setEditingSection(row)}
                                            style={{ padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex' }}
                                        >
                                            <Edit3 size={14} color="#0f172a" />
                                        </button>
                                        <button
                                            type="button"
                                            title="Delete"
                                            onClick={async () => {
                                                if (!window.confirm(`Delete assignment section “${row.title}”? Student submissions are kept.`)) return;
                                                try {
                                                    await adminAPI.deleteAssignmentSection(row.id);
                                                    toast.success('Assignment section removed');
                                                    loadAssignmentTemplates();
                                                } catch (err) {
                                                    toast.error(err?.response?.data?.detail || 'Delete failed');
                                                }
                                            }}
                                            style={{ padding: '6px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex' }}
                                        >
                                            <Trash2 size={14} color="#dc2626" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ═══ Search + Filter Tabs ═══ */}
            <div style={{ display: 'flex', gap: '12px', alignItems: isMobile ? 'stretch' : 'center', flexDirection: isMobile ? 'column' : 'row', marginBottom: '16px' }}>
                <div style={{ position: 'relative', maxWidth: '350px', flex: 1 }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input type="text" placeholder="Search students by name..."
                        value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                        style={{ width: '100%', padding: '10px 14px 10px 38px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.82rem', background: '#f8fafc', outline: 'none' }}
                    />
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                {filters.map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{
                        padding: isMobile ? '8px 14px' : '10px 20px', fontSize: isMobile ? '0.78rem' : '0.85rem',
                        fontWeight: filter === f ? '600' : '400', cursor: 'pointer',
                        background: filter === f ? '#f0f4ff' : 'transparent', color: filter === f ? '#0f172a' : '#64748b',
                        border: filter === f ? '1px solid #c7d2fe' : '1px solid transparent',
                        borderRadius: '8px', transition: 'all 0.2s',
                    }}>{f}</button>
                ))}
                <div style={{ flex: 1 }}></div>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Showing {filteredSubmissions.length} of {total} submissions</span>
            </div>

            {/* ═══ Main Layout: Table + Review Panel ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: selectedSubmission && !isMobile ? '1fr 380px' : '1fr', gap: '24px' }}>
                {/* ── Table ── */}
                <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                    {/* Table Header */}
                    {!isMobile && (
                        <div style={{
                            display: 'grid', gridTemplateColumns: '1.6fr 1.2fr 1.6fr 1fr 1fr 0.5fr',
                            padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
                        }}>
                            {['STUDENT NAME', 'COLLEGE', 'ASSIGNMENT NAME', 'MARKS', 'ASSIGNMENT STATUS', 'ACTION'].map(h => (
                                <div key={h} style={{ fontSize: '0.58rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</div>
                            ))}
                        </div>
                    )}

                    {filteredSubmissions.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                            <FileText size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                            <div style={{ fontSize: '0.92rem' }}>No submissions found</div>
                        </div>
                    )}

                    {filteredSubmissions.map((s, i) => {
                        const effectiveStatus = s.marks != null ? 'graded' : s.status;
                        const stCfg = getStatusConfig(effectiveStatus);
                        const marksText = s.marks != null
                            ? `${s.marks}/${s.max_marks || 100}`
                            : '—';
                        const isSelected = selectedSubmission?.id === s.id;

                        return (
                            <div key={s.id} style={{
                                display: isMobile ? 'flex' : 'grid',
                                gridTemplateColumns: isMobile ? undefined : '1.6fr 1.2fr 1.6fr 1fr 1fr 0.5fr',
                                flexDirection: isMobile ? 'column' : undefined,
                                gap: isMobile ? '8px' : '0',
                                padding: isMobile ? '14px 16px' : '14px 20px',
                                borderBottom: '1px solid #f1f5f9',
                                alignItems: isMobile ? 'flex-start' : 'center',
                                cursor: 'pointer',
                                background: isSelected ? '#f0f4ff' : 'transparent',
                                transition: 'background 0.15s',
                            }} onClick={() => {
                                setSelectedSubmission(s);
                                setReviewScore(s.marks?.toString() || '');
                                setReviewNotes(s.feedback || '');
                            }}>
                                {/* Student Name */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                        width: '34px', height: '34px', borderRadius: '50%', background: avatarColors[i % avatarColors.length],
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontSize: '0.6rem', fontWeight: '700', flexShrink: 0,
                                    }}>{getInitials(s.student_name)}</div>
                                    <div>
                                        <div style={{ fontWeight: '600', fontSize: '0.85rem', color: '#0f172a' }}>{s.student_name}</div>
                                        <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>ID: AU-{s.student_reg || s.student_id?.slice(-8)}</div>
                                    </div>
                                </div>

                                {/* College */}
                                <div style={{ fontSize: '0.82rem', color: '#475569' }}>{s.college_name || 'N/A'}</div>

                                {/* Assignment name + attached file */}
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {s.assignment_name || s.title || s.module_title || `Module ${s.module_id}`}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {s.file_name || 'No file attached'}
                                    </div>
                                </div>

                                {/* Marks */}
                                <div>
                                    <span style={{ fontWeight: '700', fontSize: '0.88rem', color: '#0f172a' }}>{marksText}</span>
                                </div>

                                {/* Status */}
                                <div>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        fontSize: '0.62rem', fontWeight: '700', textTransform: 'uppercase',
                                        color: stCfg.color, background: stCfg.bg, padding: '4px 10px', borderRadius: '20px',
                                    }}>
                                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: stCfg.color }}></span>
                                        {stCfg.label}
                                    </span>
                                </div>

                                {/* Action */}
                                <div>
                                    <button style={{
                                        padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0',
                                        background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <Edit3 size={14} style={{ color: '#0f172a' }} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {/* Pagination */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Rows per page:</span>
                            <select style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 8px', fontSize: '0.78rem', color: '#0f172a', background: 'white' }}>
                                <option>10</option><option>20</option><option>50</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Page {page} of {totalPages}</span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}><ChevronLeft size={14} /></button>
                                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}><ChevronRight size={14} /></button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Review Panel ── */}
                {selectedSubmission && (
                    <div className="glass-card" style={{
                        padding: isMobile ? '20px' : '24px',
                        position: isMobile ? 'fixed' : 'sticky',
                        top: isMobile ? 'var(--header-height)' : '90px',
                        inset: isMobile ? '0' : 'auto',
                        zIndex: isMobile ? 200 : 'auto',
                        overflowY: 'auto', borderRadius: isMobile ? '0' : '16px',
                        maxHeight: isMobile ? 'auto' : 'calc(100vh - 120px)',
                        alignSelf: 'start',
                    }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#dc2626', fontFamily: "'Outfit', sans-serif" }}>Review Assignment</h3>
                                <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                                    Submitted by <strong>{selectedSubmission.student_name}</strong> • {formatDate(selectedSubmission.submitted_at)}
                                </p>
                                {(selectedSubmission.marks != null || selectedSubmission.status === 'graded') && (
                                    <div style={{ marginTop: '6px' }}>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                                            fontSize: '0.62rem', fontWeight: '700', textTransform: 'uppercase',
                                            color: '#4f46e5', background: '#e0e7ff', padding: '4px 10px', borderRadius: '20px',
                                        }}>
                                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4f46e5' }}></span>
                                            Already Graded (Editable)
                                        </span>
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setSelectedSubmission(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Submission Details */}
                        <div style={{ fontSize: '0.6rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>SUBMISSION DETAILS</div>
                        {[
                            { label: 'Module', value: selectedSubmission.module_title },
                            { label: 'Assignment Type', value: selectedSubmission.title || 'Case Study Analysis' },
                            { label: 'File Format', value: selectedSubmission.file_name?.split('.').pop()?.toUpperCase() || 'PDF' },
                        ].map((d, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{d.label}</span>
                                <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0f172a', textAlign: 'right', maxWidth: '180px' }}>
                                    {d.label === 'File Format' && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                                            {d.value}
                                        </span>
                                    )}
                                    {d.label !== 'File Format' && d.value}
                                </span>
                            </div>
                        ))}

                        {/* File Preview Zone */}
                        <div style={{
                            background: '#f1f5f9', borderRadius: '12px', padding: '28px 20px',
                            textAlign: 'center', marginTop: '16px', marginBottom: '16px',
                            border: '1px solid #e2e8f0',
                        }}>
                            <div style={{
                                width: '56px', height: '56px', margin: '0 auto 12px',
                                background: '#e2e8f0', borderRadius: '12px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <FileText size={28} style={{ color: '#64748b' }} />
                            </div>
                            <div style={{ fontWeight: '600', fontSize: '0.88rem', color: '#0f172a', marginBottom: '4px' }}>
                                {selectedSubmission.file_name || 'AI_Ethics_CaseStudy.pdf'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '14px' }}>12.4 MB • Click to preview document</div>
                            <button className="btn" style={{
                                background: '#0f172a', color: 'white', padding: '8px 20px',
                                borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600',
                            }} disabled={!selectedFileUrl}
                                onClick={() => {
                                    if (!selectedFileUrl) return;
                                    if (selectedIsPdf) {
                                        setShowPdfPreview(true);
                                    } else {
                                        window.open(selectedFileUrl, '_blank', 'noopener,noreferrer');
                                    }
                                }}>
                                <Eye size={14} style={{ marginRight: '6px' }} /> View Full Screen
                            </button>
                        </div>

                        {selectedSubmission.status === 'pending' && (
                            <div style={{ marginTop: '-4px', marginBottom: '12px', color: '#64748b', fontSize: '0.82rem', fontWeight: '600' }}>
                                No submission uploaded yet for this assignment.
                            </div>
                        )}

                        {/* Grading Section */}
                        <div style={{ fontSize: '0.6rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px', marginTop: '8px' }}>GRADING & FEEDBACK</div>

                        <div style={{ marginBottom: '14px' }}>
                            <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0f172a', marginBottom: '6px', display: 'block' }}>Score (out of 100)</label>
                            <input
                                type="number" min="0" max="100"
                                placeholder="Enter marks..."
                                value={reviewScore}
                                onChange={e => setReviewScore(e.target.value)}
                                disabled={grading || selectedSubmission.status === 'pending'}
                                style={{
                                    width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0',
                                    borderRadius: '8px', fontSize: '0.88rem', color: '#0f172a', background: '#f8fafc',
                                    outline: 'none',
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0f172a', marginBottom: '6px', display: 'block' }}>Internal Notes</label>
                            <textarea
                                rows={3}
                                placeholder="Provide feedback to the intern..."
                                value={reviewNotes}
                                onChange={e => setReviewNotes(e.target.value)}
                                disabled={grading || selectedSubmission.status === 'pending'}
                                style={{
                                    width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0',
                                    borderRadius: '8px', fontSize: '0.82rem', color: '#0f172a', background: '#f8fafc',
                                    resize: 'vertical', minHeight: '70px', outline: 'none', fontFamily: 'Inter, sans-serif',
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={handleGrade}
                                disabled={grading || selectedSubmission.status === 'pending'}
                                className="btn"
                                style={{
                                    flex: 1, background: '#10b981', color: 'white', padding: '10px 20px',
                                    borderRadius: '10px', fontSize: '0.85rem', fontWeight: '700',
                                    opacity: (grading || selectedSubmission.status === 'pending') ? 0.7 : 1,
                                }}
                            >
                                <CheckCircle size={16} style={{ marginRight: '6px' }} />
                                {grading ? 'Saving...' : (selectedSubmission.marks != null || selectedSubmission.status === 'graded' ? 'Update Grade' : 'Submit Grade')}
                            </button>
                            <button
                                onClick={() => setSelectedSubmission(null)}
                                className="btn"
                                style={{
                                    background: 'white', border: '1px solid #e2e8f0', color: '#64748b',
                                    padding: '10px 16px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '600',
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ PDF Preview Popup ═══ */}
            {showPdfPreview && selectedSubmission && (
                <div
                    style={{
                        position: 'fixed',
                        top: 'var(--header-height)',
                        left: isMobile ? 0 : '220px',
                        right: 0,
                        bottom: 0,
                        zIndex: 120,
                        background: 'rgba(0,0,0,0.65)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: isMobile ? '10px' : '24px',
                    }}
                    onClick={() => setShowPdfPreview(false)}
                >
                    <div
                        style={{
                            width: '100%',
                            maxWidth: '1200px',
                            height: isMobile ? '92%' : '90%',
                            background: 'white', borderRadius: '14px', overflow: 'hidden',
                            display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{
                            padding: '12px 14px', borderBottom: '1px solid #e2e8f0',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                        }}>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {selectedSubmission.file_name || 'Assignment PDF'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    {selectedSubmission.student_name} • {selectedSubmission.module_title}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <a
                                    href={selectedFileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                        fontSize: '0.78rem', fontWeight: 700, color: '#1e3a5f', textDecoration: 'none',
                                        border: '1px solid #cbd5e1', borderRadius: '8px', padding: '7px 10px', background: '#f8fafc',
                                    }}
                                >
                                    Open in New Tab
                                </a>
                                <button
                                    onClick={() => setShowPdfPreview(false)}
                                    style={{
                                        border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white',
                                        width: '34px', height: '34px', cursor: 'pointer', display: 'grid', placeItems: 'center',
                                    }}
                                >
                                    <X size={16} style={{ color: '#64748b' }} />
                                </button>
                            </div>
                        </div>
                        <iframe
                            title="Assignment PDF Preview"
                            src={selectedFileUrl}
                            style={{ border: 'none', width: '100%', flex: 1, background: '#f1f5f9' }}
                        />
                    </div>
                </div>
            )}

            {/* ═══ Floating Create Button ═══ */}
            <button
                onClick={() => setShowCreate(true)}
                style={{
                    position: 'fixed', bottom: '24px', right: '24px',
                    width: '56px', height: '56px', borderRadius: '50%',
                    background: '#0f172a', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.25)', cursor: 'pointer',
                    border: 'none', zIndex: 100, transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 12px 35px rgba(0,0,0,0.35)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.25)'; }}
            >
                <Plus size={24} />
            </button>

            {/* ═══ Create Assignment Modal ═══ */}
            {showCreate && (
                <CreateAssignmentModal
                    onClose={() => setShowCreate(false)}
                    onCreated={() => { loadSubmissions(); loadStats(); loadAssignmentTemplates(); }}
                    isMobile={isMobile}
                    initialModuleId={searchParams.get('moduleId') || ''}
                    initialTitle={searchParams.get('title') || ''}
                />
            )}
            {editingSection && (
                <EditAssignmentModal
                    section={editingSection}
                    onClose={() => setEditingSection(null)}
                    onSaved={() => { loadAssignmentTemplates(); }}
                    isMobile={isMobile}
                />
            )}
        </div>
    );
}


/* ═══════════════════════════════════════════════════════════════════
   Create Assignment Modal
   ═══════════════════════════════════════════════════════════════════ */
function CreateAssignmentModal({ onClose, onCreated, isMobile, initialModuleId = '', initialTitle = '' }) {
    const [title, setTitle] = useState(initialTitle);
    const [description, setDescription] = useState('');
    const [moduleId, setModuleId] = useState(initialModuleId);
    const [weight, setWeight] = useState(15);
    const [maxMarks, setMaxMarks] = useState(100);
    const [dueDate, setDueDate] = useState('');
    const [color, setColor] = useState('#dc2626');
    const [creating, setCreating] = useState(false);
    const [questionsPdfFile, setQuestionsPdfFile] = useState(null);

    // Guidelines
    const [guidelines, setGuidelines] = useState([
        { title: 'Originality Policy', description: 'Turnitin report must show less than 15% similarity index.' },
        { title: 'Formatting Standards', description: 'Use APA 7th Edition for citations. 12pt Manrope/Inter font.' },
        { title: 'Privacy & Data', description: 'Anonymize all interview participant names in the report.' },
    ]);

    // Accepted formats
    const [formats, setFormats] = useState(['PDF', 'DOCX']);

    const colorOptions = ['#dc2626', '#4f46e5', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#0f172a', '#0ea5e9'];

    const addGuideline = () => setGuidelines([...guidelines, { title: '', description: '' }]);
    const removeGuideline = (idx) => setGuidelines(guidelines.filter((_, i) => i !== idx));
    const updateGuideline = (idx, field, value) => {
        const updated = [...guidelines];
        updated[idx][field] = value;
        setGuidelines(updated);
    };

    const toggleFormat = (fmt) => {
        setFormats(prev => prev.includes(fmt) ? prev.filter(f => f !== fmt) : [...prev, fmt]);
    };

    const handleCreate = async () => {
        if (!title.trim()) { toast.error('Title is required'); return; }
        if (questionsPdfFile && !questionsPdfFile.name.toLowerCase().endsWith('.pdf')) {
            toast.error('Questions file must be a PDF');
            return;
        }
        setCreating(true);
        try {
            const res = await adminAPI.createAssignmentSection({
                module_id: moduleId || undefined,
                title,
                description,
                weight,
                max_marks: maxMarks,
                due_date: dueDate || undefined,
                color,
                submission_guidelines: guidelines.filter(g => g.title.trim()),
                accepted_formats: formats,
            });
            const newId = res.data?.id;
            if (questionsPdfFile && newId) {
                const fd = new FormData();
                fd.append('file', questionsPdfFile);
                await adminAPI.uploadAssignmentQuestionsPdf(newId, fd);
            }
            toast.success('Assignment created! 🎉');
            onCreated();
            onClose();
        } catch (err) {
            toast.error(err?.response?.data?.detail || 'Failed to create assignment');
        } finally { setCreating(false); }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 300, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            padding: '20px',
        }} onClick={onClose}>
            <div style={{
                background: 'white', borderRadius: '20px', width: '100%',
                maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto',
                boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
            }} onClick={e => e.stopPropagation()}>
                {/* Modal Header */}
                <div style={{
                    padding: '24px 28px 18px', borderBottom: '1px solid #f1f5f9',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    position: 'sticky', top: 0, background: 'white', zIndex: 10, borderRadius: '20px 20px 0 0',
                }}>
                    <div>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>Create New Assignment</h2>
                        <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>Define module assignment for interns</p>
                    </div>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <X size={18} style={{ color: '#64748b' }} />
                    </button>
                </div>

                <div style={{ padding: '24px 28px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 280px', gap: '28px' }}>
                        {/* Left Column */}
                        <div>
                            {/* Title */}
                            <div style={{ marginBottom: '18px' }}>
                                <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0f172a', marginBottom: '6px', display: 'block' }}>Assignment Title *</label>
                                <input type="text" placeholder="e.g. Module 01: Orientation Report" value={title} onChange={e => setTitle(e.target.value)}
                                    style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.9rem', color: '#0f172a', background: '#f8fafc', outline: 'none' }}
                                />
                            </div>

                            {/* Description */}
                            <div style={{ marginBottom: '18px' }}>
                                <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0f172a', marginBottom: '6px', display: 'block' }}>Description</label>
                                <textarea rows={3} placeholder="Summarize the core objectives and ethical framework discussed during orientation."
                                    value={description} onChange={e => setDescription(e.target.value)}
                                    style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.85rem', color: '#0f172a', background: '#f8fafc', resize: 'vertical', minHeight: '80px', outline: 'none', fontFamily: 'Inter, sans-serif' }}
                                />
                            </div>

                            {/* Module ID + Weight Row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0f172a', marginBottom: '6px', display: 'block' }}>Module ID</label>
                                    <input type="text" placeholder="e.g. 1, 2, 3" value={moduleId} onChange={e => setModuleId(e.target.value)}
                                        style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem', color: '#0f172a', background: '#f8fafc', outline: 'none' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0f172a', marginBottom: '6px', display: 'block' }}>Max Marks</label>
                                    <input type="number" value={maxMarks} onChange={e => setMaxMarks(parseInt(e.target.value) || 100)}
                                        style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem', color: '#0f172a', background: '#f8fafc', outline: 'none' }}
                                    />
                                </div>
                            </div>

                            {/* Deadline + Color */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0f172a', marginBottom: '6px', display: 'block' }}>
                                        <Calendar size={14} style={{ marginRight: '4px', verticalAlign: '-2px' }} /> Deadline
                                    </label>
                                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                                        style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem', color: '#0f172a', background: '#f8fafc', outline: 'none' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0f172a', marginBottom: '6px', display: 'block' }}>Theme Color</label>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                                        {colorOptions.map(c => (
                                            <button key={c} onClick={() => setColor(c)} style={{
                                                width: '28px', height: '28px', borderRadius: '50%', background: c,
                                                border: color === c ? '3px solid #0f172a' : '2px solid #e2e8f0',
                                                cursor: 'pointer', transition: 'transform 0.15s',
                                                transform: color === c ? 'scale(1.15)' : 'scale(1)',
                                            }} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Submission Guidelines */}
                            <div style={{ marginBottom: '18px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        📋 Submission Guidelines
                                    </label>
                                    <button onClick={addGuideline} style={{
                                        background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: '6px', padding: '4px 10px',
                                        fontSize: '0.72rem', fontWeight: '600', color: '#4f46e5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                                    }}>
                                        <Plus size={12} /> Add
                                    </button>
                                </div>
                                {guidelines.map((g, i) => (
                                    <div key={i} style={{
                                        background: '#f8fafc', borderRadius: '10px', padding: '12px 14px',
                                        marginBottom: '10px', border: '1px solid #e2e8f0', position: 'relative',
                                    }}>
                                        <button onClick={() => removeGuideline(i)} style={{
                                            position: 'absolute', top: '8px', right: '8px', background: 'none',
                                            border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px',
                                        }}><X size={14} /></button>
                                        <input type="text" placeholder="Guideline title" value={g.title}
                                            onChange={e => updateGuideline(i, 'title', e.target.value)}
                                            style={{ width: '90%', padding: '6px 0', border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', outline: 'none', marginBottom: '4px' }}
                                        />
                                        <input type="text" placeholder="Description..." value={g.description}
                                            onChange={e => updateGuideline(i, 'description', e.target.value)}
                                            style={{ width: '100%', padding: '4px 0', border: 'none', background: 'transparent', fontSize: '0.78rem', color: '#64748b', outline: 'none' }}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Optional questions PDF */}
                            <div style={{ marginBottom: '18px' }}>
                                <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0f172a', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Upload size={14} /> Questions PDF <span style={{ fontWeight: '400', color: '#94a3b8' }}>(optional)</span>
                                </label>
                                <input
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    onChange={(e) => setQuestionsPdfFile(e.target.files?.[0] || null)}
                                    style={{ width: '100%', fontSize: '0.8rem' }}
                                />
                                {questionsPdfFile && (
                                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '6px' }}>{questionsPdfFile.name}</div>
                                )}
                            </div>

                            {/* Accepted Formats */}
                            <div style={{ marginBottom: '18px' }}>
                                <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0f172a', marginBottom: '8px', display: 'block' }}>Accepted Formats</label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {['PDF', 'DOCX', 'DOC', 'TXT', 'PPTX', 'XLSX'].map(fmt => (
                                        <button key={fmt} onClick={() => toggleFormat(fmt)} style={{
                                            padding: '6px 14px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600',
                                            background: formats.includes(fmt) ? '#0f172a' : '#f1f5f9',
                                            color: formats.includes(fmt) ? 'white' : '#64748b',
                                            border: formats.includes(fmt) ? '1px solid #0f172a' : '1px solid #e2e8f0',
                                            cursor: 'pointer', transition: 'all 0.2s',
                                        }}>{fmt}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Column — Preview */}
                        <div>
                            <div style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>LIVE PREVIEW</div>

                            {/* Weightage Card */}
                            <div style={{
                                background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', borderRadius: '14px',
                                padding: '24px', color: 'white', marginBottom: '16px',
                            }}>
                                <div style={{ fontSize: '0.62rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7, marginBottom: '6px' }}>WEIGHTAGE</div>
                                <div style={{ fontSize: '2.4rem', fontWeight: '800', fontFamily: "'Outfit', sans-serif", marginBottom: '2px' }}>{weight}%</div>
                                <div style={{ fontSize: '0.88rem', opacity: 0.8, marginBottom: '12px' }}>of Grade</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', opacity: 0.8 }}>
                                    <Calendar size={14} /> Deadline: {dueDate || '2026-03-26'}
                                </div>
                            </div>

                            {/* Weightage Slider */}
                            <div style={{ marginBottom: '18px' }}>
                                <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0f172a', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Weight (%)</span>
                                    <span style={{ color: '#4f46e5', fontFamily: "'Outfit'" }}>{weight}%</span>
                                </label>
                                <input type="range" min="0" max="100" value={weight} onChange={e => setWeight(parseInt(e.target.value))}
                                    style={{ width: '100%', accentColor: '#0f172a' }}
                                />
                            </div>

                            {/* Guidelines Preview */}
                            <div className="glass-card" style={{ padding: '18px', marginBottom: '14px' }}>
                                <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>📋 Submission Guidelines</h4>
                                {guidelines.filter(g => g.title.trim()).map((g, i) => (
                                    <div key={i} style={{ marginBottom: '10px' }}>
                                        <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#0f172a', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#2563eb' }}></span>
                                            {g.title}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: '1.5', marginLeft: '11px' }}>{g.description}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Formats Preview */}
                            <div className="glass-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <FileText size={18} style={{ color: '#10b981', flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#0f172a', marginBottom: '3px' }}>Formats</div>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                        {formats.map(fmt => (
                                            <span key={fmt} style={{ fontSize: '0.58rem', fontWeight: '600', color: '#64748b', padding: '2px 7px', background: '#f1f5f9', borderRadius: '3px' }}>{fmt}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div style={{
                    padding: '16px 28px 24px', borderTop: '1px solid #f1f5f9',
                    display: 'flex', justifyContent: 'flex-end', gap: '12px',
                    position: 'sticky', bottom: 0, background: 'white', borderRadius: '0 0 20px 20px',
                }}>
                    <button onClick={onClose} className="btn" style={{ background: 'white', border: '1px solid #e2e8f0', color: '#64748b', padding: '10px 24px', borderRadius: '10px', fontSize: '0.88rem', fontWeight: '600' }}>
                        Cancel
                    </button>
                    <button onClick={handleCreate} disabled={creating} className="btn" style={{
                        background: '#10b981', color: 'white', padding: '10px 28px',
                        borderRadius: '10px', fontSize: '0.88rem', fontWeight: '700',
                        opacity: creating ? 0.7 : 1,
                    }}>
                        <Plus size={16} style={{ marginRight: '6px' }} />
                        {creating ? 'Creating...' : 'Create Assignment'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function EditAssignmentModal({ section, onClose, onSaved, isMobile }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [moduleId, setModuleId] = useState('');
    const [weight, setWeight] = useState(0);
    const [maxMarks, setMaxMarks] = useState(100);
    const [dueDate, setDueDate] = useState('');
    const [color, setColor] = useState('#dc2626');
    const [guidelines, setGuidelines] = useState([{ title: '', description: '' }]);
    const [formats, setFormats] = useState(['PDF', 'DOCX']);
    const [removePdf, setRemovePdf] = useState(false);
    const [replacePdfFile, setReplacePdfFile] = useState(null);
    const [saving, setSaving] = useState(false);

    const colorOptions = ['#dc2626', '#4f46e5', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#0f172a', '#0ea5e9'];

    useEffect(() => {
        if (!section) return;
        setTitle(section.title || '');
        setDescription(section.description || '');
        setModuleId(section.module_id || '');
        setWeight(section.weight ?? 0);
        setMaxMarks(section.max_marks ?? 100);
        setDueDate(section.due_date || '');
        setColor(section.color || '#dc2626');
        const g = section.submission_guidelines;
        if (Array.isArray(g) && g.length > 0) {
            setGuidelines(g.map((x) => ({ title: x.title || '', description: x.description || '' })));
        } else {
            setGuidelines([{ title: '', description: '' }]);
        }
        setFormats(Array.isArray(section.accepted_formats) && section.accepted_formats.length > 0
            ? section.accepted_formats
            : ['PDF', 'DOCX']);
        setRemovePdf(false);
        setReplacePdfFile(null);
    }, [section]);

    const addGuideline = () => setGuidelines([...guidelines, { title: '', description: '' }]);
    const removeGuideline = (idx) => setGuidelines(guidelines.filter((_, i) => i !== idx));
    const updateGuideline = (idx, field, value) => {
        const u = [...guidelines];
        u[idx][field] = value;
        setGuidelines(u);
    };
    const toggleFormat = (fmt) => {
        setFormats((prev) => (prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt]));
    };

    const handleSave = async () => {
        if (!section?.id) return;
        if (!title.trim()) {
            toast.error('Title is required');
            return;
        }
        if (replacePdfFile && !replacePdfFile.name.toLowerCase().endsWith('.pdf')) {
            toast.error('Replacement file must be a PDF');
            return;
        }
        setSaving(true);
        try {
            const patch = {
                title: title.trim(),
                description: description || null,
                module_id: moduleId.trim() || section.module_id,
                weight,
                max_marks: maxMarks,
                due_date: dueDate || null,
                color,
                submission_guidelines: guidelines.filter((g) => g.title.trim()),
                accepted_formats: formats,
            };
            if (removePdf && !replacePdfFile) {
                patch.questions_pdf_url = null;
                patch.questions_pdf_name = null;
            }
            await adminAPI.updateAssignmentSection(section.id, patch);
            if (replacePdfFile) {
                const fd = new FormData();
                fd.append('file', replacePdfFile);
                await adminAPI.uploadAssignmentQuestionsPdf(section.id, fd);
            }
            toast.success('Assignment updated');
            onSaved();
            onClose();
        } catch (err) {
            toast.error(err?.response?.data?.detail || 'Update failed');
        } finally {
            setSaving(false);
        }
    };

    if (!section) return null;

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 310, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                padding: '20px',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: 'white', borderRadius: '16px', width: '100%',
                    maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto',
                    boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{
                    padding: '20px 22px 14px', borderBottom: '1px solid #f1f5f9',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    position: 'sticky', top: 0, background: 'white', zIndex: 2,
                }}>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a' }}>Edit assignment</h2>
                    <button type="button" onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <X size={17} style={{ color: '#64748b' }} />
                    </button>
                </div>
                <div style={{ padding: '18px 22px 22px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Title *</label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '14px', fontSize: '0.88rem' }} />

                    <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Description</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '14px', fontSize: '0.85rem', resize: 'vertical' }} />

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Module ID</label>
                            <input value={moduleId} onChange={(e) => setModuleId(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Due date</label>
                            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Weight (%)</label>
                            <input type="number" min={0} max={100} value={weight} onChange={(e) => setWeight(parseInt(e.target.value, 10) || 0)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Max marks</label>
                            <input type="number" min={1} value={maxMarks} onChange={(e) => setMaxMarks(parseInt(e.target.value, 10) || 100)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} />
                        </div>
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Theme color</span>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {colorOptions.map((c) => (
                                <button key={c} type="button" onClick={() => setColor(c)} style={{
                                    width: '26px', height: '26px', borderRadius: '50%', background: c,
                                    border: color === c ? '3px solid #0f172a' : '2px solid #e2e8f0', cursor: 'pointer',
                                }} />
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>Submission guidelines</span>
                            <button type="button" onClick={addGuideline} style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: '6px', padding: '4px 10px', fontSize: '0.72rem', fontWeight: '600', color: '#4f46e5', cursor: 'pointer' }}>+ Add</button>
                        </div>
                        {guidelines.map((g, i) => (
                            <div key={i} style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', border: '1px solid #e2e8f0', position: 'relative' }}>
                                <button type="button" onClick={() => removeGuideline(i)} style={{ position: 'absolute', top: '6px', right: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={14} /></button>
                                <input placeholder="Title" value={g.title} onChange={(e) => updateGuideline(i, 'title', e.target.value)} style={{ width: '88%', border: 'none', background: 'transparent', fontWeight: '600', fontSize: '0.82rem', marginBottom: '4px' }} />
                                <input placeholder="Description" value={g.description} onChange={(e) => updateGuideline(i, 'description', e.target.value)} style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.76rem', color: '#64748b' }} />
                            </div>
                        ))}
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '8px' }}>Accepted formats</span>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {['PDF', 'DOCX', 'DOC', 'TXT', 'PPTX', 'XLSX'].map((fmt) => (
                                <button key={fmt} type="button" onClick={() => toggleFormat(fmt)} style={{
                                    padding: '5px 12px', borderRadius: '16px', fontSize: '0.72rem', fontWeight: '600',
                                    background: formats.includes(fmt) ? '#0f172a' : '#f1f5f9',
                                    color: formats.includes(fmt) ? 'white' : '#64748b',
                                    border: formats.includes(fmt) ? '1px solid #0f172a' : '1px solid #e2e8f0',
                                    cursor: 'pointer',
                                }}>{fmt}</button>
                            ))}
                        </div>
                    </div>

                    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', border: '1px solid #e2e8f0', marginBottom: '18px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileText size={16} /> Questions PDF
                        </div>
                        {section.questions_pdf_url ? (
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '10px' }}>
                                Current: {section.questions_pdf_name || 'attached.pdf'}
                            </div>
                        ) : (
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '10px' }}>No file attached.</div>
                        )}
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', marginBottom: '10px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={removePdf} onChange={(e) => { setRemovePdf(e.target.checked); if (e.target.checked) setReplacePdfFile(null); }} />
                            Remove questions PDF
                        </label>
                        {!removePdf && (
                            <>
                                <label style={{ fontSize: '0.76rem', color: '#475569' }}>Upload or replace (PDF only)</label>
                                <input
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    onChange={(e) => { setReplacePdfFile(e.target.files?.[0] || null); if (e.target.files?.[0]) setRemovePdf(false); }}
                                    style={{ width: '100%', marginTop: '6px', fontSize: '0.78rem' }}
                                />
                            </>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button type="button" onClick={onClose} className="btn" style={{ background: 'white', border: '1px solid #e2e8f0', color: '#64748b', padding: '10px 20px', borderRadius: '10px', fontWeight: '600', fontSize: '0.85rem' }}>Cancel</button>
                        <button type="button" onClick={handleSave} disabled={saving} className="btn" style={{ background: '#2563eb', color: 'white', padding: '10px 22px', borderRadius: '10px', fontWeight: '700', fontSize: '0.85rem', opacity: saving ? 0.75 : 1 }}>
                            {saving ? 'Saving…' : 'Save changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
