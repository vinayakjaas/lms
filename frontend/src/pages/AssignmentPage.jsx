import { useState, useEffect, useRef } from 'react';
import { assignmentAPI } from '../services/api';
import { Upload, FileText, CheckCircle, AlertCircle, Calendar, ArrowRight, Star, Lock, BookOpen, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

function useWindowWidth() {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => { const h = () => setWidth(window.innerWidth); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h); }, []);
    return width;
}

export default function AssignmentPage() {
    const w = useWindowWidth();
    const isMobile = w <= 768;
    const isSmall = w <= 480;
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('All');
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileRef = useRef(null);

    const filters = ['All', 'Pending', 'Submitted', 'Graded'];

    useEffect(() => { loadAssignments(); }, []);

    const loadAssignments = async () => {
        try {
            const res = await assignmentAPI.mySections();
            setAssignments(res.data || []);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load assignments');
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (file) => {
        if (!file) return;
        if (selectedAssignment?.status === 'graded') { toast.error('Assignment already graded. Re-upload disabled.'); return; }
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['pdf', 'doc', 'docx'].includes(ext)) { toast.error('Only PDF/DOC files allowed'); return; }
        setUploading(true);
        try {
            const fd = new FormData(); fd.append('file', file); fd.append('module_id', selectedAssignment?.module_id || '5'); fd.append('title', file.name);
            await assignmentAPI.upload(fd); toast.success('Assignment uploaded! ✅'); setSelectedAssignment(null); loadAssignments();
        } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed'); }
        finally { setUploading(false); }
    };

    const filteredAssignments = activeFilter === 'All' ? assignments : assignments.filter(a => a.status.toLowerCase() === activeFilter.toLowerCase());

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

    if (selectedAssignment) {
        return <AssignmentDetail assignment={selectedAssignment} onBack={() => setSelectedAssignment(null)} onUpload={handleUpload} uploading={uploading} dragOver={dragOver} setDragOver={setDragOver} fileRef={fileRef} isMobile={isMobile} />;
    }

    const getStatusBadge = (a) => {
        if (a.status === 'pending') return <span style={{ background: a.color || '#dc2626', color: 'white', fontSize: '0.6rem', fontWeight: '700', padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DUE IN {a.due_days ?? 0} DAYS</span>;
        if (a.status === 'submitted') return <span style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#d1fae5', color: '#065f46', fontSize: '0.6rem', fontWeight: '700', padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span> SUBMITTED</span>;
        if (a.status === 'graded') return <span style={{ background: '#d1fae5', color: '#065f46', fontSize: '0.6rem', fontWeight: '700', padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase' }}>GRADED: {a.grade || '—'}</span>;
        if (a.status === 'upcoming') return <span style={{ background: '#1e3a5f', color: 'white', fontSize: '0.6rem', fontWeight: '700', padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase' }}>UPCOMING</span>;
    };

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-end', marginBottom: isMobile ? '20px' : '28px', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '14px' : '0' }}>
                <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>AIUGIP INTERNSHIP</div>
                    <h1 style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: '800', color: '#0f172a' }}>My Assignments</h1>
                </div>
                <div style={{ display: 'flex', gap: '0', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                    {filters.map(f => (
                        <button key={f} onClick={() => setActiveFilter(f)} style={{
                            padding: isMobile ? '6px 14px' : '8px 20px', fontSize: isMobile ? '0.75rem' : '0.85rem', fontWeight: '500', cursor: 'pointer',
                            background: activeFilter === f ? '#0f172a' : 'white', color: activeFilter === f ? 'white' : '#64748b',
                            border: 'none', borderRight: '1px solid #e2e8f0', transition: 'all 0.2s',
                        }}>{f}</button>
                    ))}
                </div>
            </div>

            {/* Assignment Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr' : isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: isMobile ? '12px' : '20px', marginBottom: '28px' }}>
                {filteredAssignments.map(a => (
                    <div key={a.id} className="glass-card" style={{ padding: '0', overflow: 'hidden', opacity: a.status === 'upcoming' ? 0.8 : 1, cursor: a.status !== 'upcoming' ? 'pointer' : 'default' }} onClick={() => a.status !== 'upcoming' && setSelectedAssignment(a)}>
                        <div style={{ height: '4px', background: a.status === 'pending' ? (a.color || '#dc2626') : a.status === 'submitted' ? '#94a3b8' : a.status === 'graded' ? '#94a3b8' : '#1e3a5f' }}></div>
                        <div style={{ padding: isMobile ? '14px' : '20px 22px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '6px' }}>
                                {getStatusBadge(a)}
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>Weight: {a.weight}%</span>
                            </div>
                            <h3 style={{ fontSize: isMobile ? '0.9rem' : '1.05rem', fontWeight: '700', color: '#0f172a', marginBottom: '8px', lineHeight: '1.3' }}>{a.title}</h3>
                            <p style={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: '#64748b', lineHeight: '1.5', marginBottom: '16px', minHeight: isMobile ? 'auto' : '40px' }}>{a.description}</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '8px' }}>
                                {a.status === 'pending' && (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748b' }}><Calendar size={14} /> {a.due_date}</div>
                                        <button className="btn" style={{ background: '#0f172a', color: 'white', padding: '6px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}><Upload size={12} /> Upload</button>
                                    </>
                                )}
                                {a.status === 'submitted' && (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748b' }}><Calendar size={14} /> {a.due_date}</div>
                                        <span style={{ fontSize: '0.78rem', fontWeight: '600', color: '#dc2626' }}>Review</span>
                                    </>
                                )}
                                {a.status === 'graded' && (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748b' }}><Star size={14} /> Score: {a.marks ?? 0}/{a.max_marks ?? 100}</div>
                                        <button className="btn" style={{ background: '#dc2626', color: 'white', padding: '6px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>View <ArrowRight size={12} /></button>
                                    </>
                                )}
                                {a.status === 'upcoming' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#94a3b8', width: '100%', justifyContent: 'center' }}><Lock size={14} /> Locked until {a.locked_until}</div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Performance Overview Card */}
                <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', borderRadius: '16px', padding: isMobile ? '20px' : '28px', color: 'white' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7, marginBottom: '12px' }}>PERFORMANCE OVERVIEW</div>
                    <div style={{ fontSize: isMobile ? '2rem' : '2.5rem', fontWeight: '800', fontFamily: "'Outfit', sans-serif", marginBottom: '4px' }}>4.8 / 5.0</div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '24px' }}>Current Average Grade</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>Completion Rate</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>85%</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '20px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: '85%', background: '#3b82f6', borderRadius: '20px' }}></div>
                    </div>
                    <p style={{ fontSize: '0.72rem', opacity: 0.6, marginTop: '14px', lineHeight: '1.4' }}>You are in the top 5% of interns this cohort.</p>
                </div>
            </div>

            {/* End of Assignments Footer */}
            <div style={{ textAlign: 'center', padding: isMobile ? '24px 0 16px' : '40px 0 20px', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <BookOpen size={24} style={{ color: '#64748b' }} />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>End of Current Assignments</h3>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: '400px', margin: '0 auto' }}>Check back next Monday for new modules and institutional tasks from AIC Bihar Vidhyapeet.</p>
                <button style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '700', fontSize: '0.85rem', marginTop: '16px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>View Archived Assignments <ExternalLink size={14} /></button>
            </div>
        </div>
    );
}

const FALLBACK_GUIDELINES = [
    { t: 'Originality Policy', d: 'Turnitin report must show less than 15% similarity index.' },
    { t: 'Formatting Standards', d: 'Use APA 7th Edition for citations. 12pt Manrope/Inter font.' },
    { t: 'Privacy & Data', d: 'Anonymize all interview participant names in the report.' },
];

function toAbsoluteAssetUrl(url) {
    if (!url) return '';
    const u = String(url).trim();
    if (!u) return '';
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    if (u.startsWith('/uploads/')) return `http://localhost:8000${u}`;
    return u;
}

function AssignmentDetail({ assignment, onBack, onUpload, uploading, dragOver, setDragOver, fileRef, isMobile }) {
    const a = assignment;
    const guidelineRows = Array.isArray(a.submission_guidelines) && a.submission_guidelines.length > 0
        ? a.submission_guidelines.map((g) => ({ t: g.title || 'Guideline', d: g.description || '' }))
        : FALLBACK_GUIDELINES;
    const formatList = Array.isArray(a.accepted_formats) && a.accepted_formats.length > 0
        ? a.accepted_formats
        : ['PDF', 'DOCX'];
    const questionsPdfHref = toAbsoluteAssetUrl(a.questions_pdf_url || '');
    return (
        <div className="animate-fadeIn" style={{ maxWidth: '1000px' }}>
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>← Back to Assignments</button>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 260px', gap: isMobile ? '16px' : '28px', marginBottom: '28px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        <span style={{ background: a.color || '#dc2626', color: 'white', fontSize: '0.65rem', fontWeight: '700', padding: '4px 14px', borderRadius: '20px', textTransform: 'uppercase' }}>ASSIGNMENT</span>
                        {a.due_days != null ? <span style={{ fontSize: '0.85rem', color: '#64748b' }}>/ Due in {a.due_days} days</span> : null}
                    </div>
                    <h1 style={{ fontSize: isMobile ? '1.4rem' : '2rem', fontWeight: '800', color: '#0f172a', lineHeight: '1.2', marginBottom: '16px' }}>{a.title}</h1>
                    <p style={{ fontSize: '0.92rem', color: '#64748b', lineHeight: '1.7' }}>{a.description || ''}</p>
                    {questionsPdfHref && (
                        <a
                            href={questionsPdfHref}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '14px',
                                fontSize: '0.86rem', fontWeight: '700', color: '#2563eb', textDecoration: 'none',
                                padding: '10px 14px', borderRadius: '10px', border: '1px solid #bfdbfe', background: '#eff6ff',
                            }}
                        >
                            <FileText size={18} /> {a.questions_pdf_name || 'Download assignment questions (PDF)'}
                        </a>
                    )}
                </div>
                <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', borderRadius: '14px', padding: isMobile ? '20px' : '28px', color: 'white' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7, marginBottom: '8px' }}>WEIGHTAGE</div>
                    <div style={{ fontSize: '2.4rem', fontWeight: '800', fontFamily: "'Outfit', sans-serif", marginBottom: '4px' }}>{a.weight}%</div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '14px' }}>of Grade</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', opacity: 0.8 }}><Calendar size={14} /> Deadline: {a.due_date || 'Oct 28, 2023'}</div>
                    {a.status === 'graded' && (
                        <div style={{ marginTop: '10px', fontSize: '0.85rem', fontWeight: '700' }}>
                            Grade: {a.grade || '—'} ({a.marks ?? 0}/{a.max_marks ?? 100})
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '16px' : '28px', marginBottom: '28px' }}>
                <div className="glass-card" style={{ padding: isMobile ? '20px' : '28px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: '700', marginBottom: '20px', color: '#0f172a' }}>📋 Submission Guidelines</h3>
                    {guidelineRows.map((g, i) => (
                        <div key={i} style={{ marginBottom: '14px' }}>
                            <h4 style={{ fontSize: '0.88rem', fontWeight: '700', color: '#0f172a', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb' }}></span> {g.t}
                            </h4>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: '1.6', marginLeft: '12px' }}>{g.d}</p>
                        </div>
                    ))}
                </div>

                <div>
                    {a.status !== 'graded' ? (
                    <div className={`upload-zone ${dragOver ? 'drag-over' : ''}`} style={{ marginBottom: '16px', border: '2px dashed #cbd5e1', borderRadius: '14px', padding: isMobile ? '24px 16px' : '36px' }}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => { e.preventDefault(); setDragOver(false); onUpload(e.dataTransfer.files[0]); }}
                        onClick={() => fileRef.current?.click()}>
                        <input type="file" ref={fileRef} style={{ display: 'none' }} accept=".pdf,.doc,.docx" onChange={(e) => onUpload(e.target.files[0])} />
                        {uploading ? (
                            <><div className="spinner" style={{ margin: '0 auto' }}></div><p style={{ color: '#94a3b8', marginTop: '12px' }}>Uploading...</p></>
                        ) : (
                            <>
                                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                    <Upload size={22} style={{ color: '#64748b' }} />
                                </div>
                                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>Upload Final Report</h3>
                                <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Drag and drop or click to browse</p>
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '14px', flexWrap: 'wrap' }}>
                                    <button className="btn" style={{ background: '#0f172a', color: 'white', padding: '8px 18px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: '600' }}>Select File</button>
                                    <button className="btn btn-secondary" style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: '600' }}>External Link</button>
                                </div>
                            </>
                        )}
                    </div>
                    ) : (
                    <div className="glass-card" style={{ marginBottom: '16px', padding: isMobile ? '18px' : '22px', border: '1px solid #d1fae5', background: '#ecfdf5' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: '#065f46', fontWeight: '700' }}>
                            <CheckCircle size={16} /> Assignment graded
                        </div>
                        <div style={{ fontSize: '0.84rem', color: '#166534' }}>
                            Score: {a.marks ?? 0}/{a.max_marks ?? 100} | Grade: {a.grade || '—'}
                        </div>
                        {a.feedback && <div style={{ marginTop: '8px', fontSize: '0.82rem', color: '#065f46' }}>Feedback: {a.feedback}</div>}
                        <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#16a34a' }}>Re-upload is disabled after grading.</div>
                    </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div className="glass-card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={16} style={{ color: '#10b981' }} />
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#0f172a' }}>Formats</div>
                                <div style={{ display: 'flex', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
                                    {formatList.map((fmt) => (
                                        <span key={fmt} style={{ fontSize: '0.6rem', fontWeight: '600', color: '#64748b', padding: '1px 6px', background: '#f1f5f9', borderRadius: '3px' }}>{fmt}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="glass-card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Upload size={16} style={{ color: '#8b5cf6' }} />
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#0f172a' }}>Size Limit</div>
                                <div style={{ fontSize: '1rem', fontWeight: '800', color: '#0f172a', fontFamily: "'Outfit'" }}>25 MB</div>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
                        <button className="btn" style={{ background: '#10b981', color: 'white', padding: '12px 24px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '700' }}>Submit Final Assignment</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
