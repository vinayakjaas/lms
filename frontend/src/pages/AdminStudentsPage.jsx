import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { Filter, Download, Upload, FileText, Edit3, X, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

function useWindowWidth() {
    const [w, setW] = useState(window.innerWidth);
    useEffect(() => { const h = () => setW(window.innerWidth); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h); }, []);
    return w;
}

const colors = ['#f59e0b', '#4f46e5', '#10b981', '#8b5cf6', '#ec4899', '#0ea5e9', '#ef4444'];
const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '??';

export default function AdminStudentsPage() {
    const w = useWindowWidth();
    const isMobile = w <= 768;
    const [students, setStudents] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [filter, setFilter] = useState('All Students');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [reviewScore, setReviewScore] = useState('');
    const [reviewNotes, setReviewNotes] = useState('');
    const [loading, setLoading] = useState(true);

    const filters = ['All Students', 'Top Performing', 'Needs Review'];

    useEffect(() => {
        setLoading(true);
        adminAPI.students({ page, limit: 20, search: searchTerm || undefined })
            .then(r => {
                setStudents(r.data?.students || []);
                setTotal(r.data?.total || 0);
            })
            .catch(() => setStudents([]))
            .finally(() => setLoading(false));
    }, [page, searchTerm]);

    const filteredStudents = students.filter(s => {
        if (filter === 'Top Performing') return s.progress >= 80;
        if (filter === 'Needs Review') return s.grade === 'N/A' || s.progress < 50;
        return true;
    });

    const statusForStudent = (s) => {
        if (s.progress >= 80) return { label: 'ACTIVE', color: '#10b981' };
        if (s.progress < 30) return { label: 'AT RISK', color: '#ef4444' };
        return { label: 'IN PROGRESS', color: '#f59e0b' };
    };

    const reloadStudents = async () => {
        setLoading(true);
        try {
            const r = await adminAPI.students({ page, limit: 20, search: searchTerm || undefined });
            setStudents(r.data?.students || []);
            setTotal(r.data?.total || 0);
        } catch {
            setStudents([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSelectedStudent = async () => {
        if (!selectedStudent?.id) return;
        const ok = window.confirm(
            `Delete "${selectedStudent.name}"?\n\nThis will delete the student and all related data.`
        );
        if (!ok) return;
        try {
            await adminAPI.deleteStudent(selectedStudent.id);
            toast.success('Student deleted');
            setSelectedStudent(null);
            await reloadStudents();
        } catch (err) {
            toast.error(err?.response?.data?.detail || 'Failed to delete student');
        }
    };

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-end', marginBottom: '8px', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
                <div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>Academic Management › <span style={{ fontWeight: '600', color: '#2563eb' }}>Student Data</span></div>
                    <h1 style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: '800', color: '#0f172a' }}>Student Profiles</h1>
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

            {/* Search */}
            <div style={{ position: 'relative', maxWidth: '350px', marginBottom: '16px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input type="text" placeholder="Search students by name, mobile, roll number..."
                    value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                    style={{ width: '100%', padding: '10px 14px 10px 38px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.82rem', background: '#f8fafc', outline: 'none' }}
                />
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0', marginBottom: '20px', flexWrap: 'wrap' }}>
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
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', alignSelf: 'center' }}>Showing {filteredStudents.length} of {total}</span>
            </div>

            {/* Layout: Table + Review Panel */}
            <div style={{ display: 'grid', gridTemplateColumns: selectedStudent && !isMobile ? '1fr 360px' : '1fr', gap: '24px' }}>
                <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                    {!isMobile && (
                        <div style={{
                            display: 'grid', gridTemplateColumns: '1.8fr 1.2fr 0.8fr 0.8fr 1fr 0.5fr',
                            padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
                        }}>
                            {['STUDENT NAME', 'COLLEGE', 'PROGRESS', 'GRADE', 'STATUS', 'ACTION'].map(h => (
                                <div key={h} style={{ fontSize: '0.58rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</div>
                            ))}
                        </div>
                    )}

                    {filteredStudents.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                            <FileText size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                            <div style={{ fontSize: '0.92rem' }}>No students found</div>
                        </div>
                    )}

                    {filteredStudents.map((s, i) => {
                        const st = statusForStudent(s);
                        return (
                            <div key={s.id} style={{
                                display: isMobile ? 'flex' : 'grid',
                                gridTemplateColumns: isMobile ? undefined : '1.8fr 1.2fr 0.8fr 0.8fr 1fr 0.5fr',
                                flexDirection: isMobile ? 'column' : undefined,
                                gap: isMobile ? '8px' : '0',
                                padding: isMobile ? '14px 16px' : '14px 20px',
                                borderBottom: '1px solid #f1f5f9', alignItems: isMobile ? 'flex-start' : 'center',
                                cursor: 'pointer', background: selectedStudent?.id === s.id ? '#f0f4ff' : 'transparent',
                            }} onClick={() => setSelectedStudent(s)}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '50%', background: colors[i % colors.length],
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontSize: '0.6rem', fontWeight: '700', flexShrink: 0,
                                    }}>{getInitials(s.name)}</div>
                                    <div>
                                        <div style={{ fontWeight: '600', fontSize: '0.85rem', color: '#0f172a' }}>{s.name}</div>
                                        <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{s.reg_number || s.roll_number || s.mobile}</div>
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.82rem', color: '#475569' }}>{s.college_name || 'N/A'}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: isMobile ? '100px' : '60px', height: '6px', background: '#e2e8f0', borderRadius: '20px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${s.progress || 0}%`, background: (s.progress || 0) >= 80 ? '#1e3a5f' : '#f59e0b', borderRadius: '20px' }}></div>
                                    </div>
                                    <span style={{ fontSize: '0.78rem', fontWeight: '600', color: (s.progress || 0) >= 80 ? '#1e3a5f' : '#f59e0b' }}>{s.progress || 0}%</span>
                                </div>
                                <div>
                                    <span style={{ fontWeight: '700', fontSize: '0.88rem', color: '#0f172a' }}>{s.grade || 'N/A'}</span>
                                    {s.total_score > 0 && <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '4px' }}>({s.total_score})</span>}
                                </div>
                                <div>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        fontSize: '0.62rem', fontWeight: '700', color: st.color, textTransform: 'uppercase',
                                    }}>
                                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: st.color }}></span>
                                        {st.label}
                                    </span>
                                </div>
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

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Page {page} of {Math.ceil(total / 20) || 1}</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}><ChevronLeft size={14} /></button>
                            <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} style={{ padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: page * 20 >= total ? 'not-allowed' : 'pointer', opacity: page * 20 >= total ? 0.5 : 1 }}><ChevronRight size={14} /></button>
                        </div>
                    </div>
                </div>

                {/* Review Panel */}
                {selectedStudent && (
                    <div className="glass-card" style={{ padding: isMobile ? '20px' : '24px', position: isMobile ? 'fixed' : 'relative', inset: isMobile ? '0' : 'auto', zIndex: isMobile ? 200 : 'auto', top: isMobile ? 'var(--header-height)' : 'auto', overflowY: 'auto', borderRadius: isMobile ? '0' : '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a' }}>Student Profile</h3>
                                <p style={{ fontSize: '0.78rem', color: '#64748b' }}><strong>{selectedStudent.name}</strong></p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button
                                    onClick={handleDeleteSelectedStudent}
                                    style={{
                                        background: '#fee2e2',
                                        border: '1px solid #fecaca',
                                        color: '#dc2626',
                                        cursor: 'pointer',
                                        padding: '8px 12px',
                                        borderRadius: '10px',
                                        fontWeight: '700',
                                        fontSize: '0.82rem',
                                    }}
                                >
                                    Delete
                                </button>
                                <button onClick={() => setSelectedStudent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div style={{ fontSize: '0.6rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>STUDENT DETAILS</div>
                        {[
                            { label: 'College', value: selectedStudent.college_name || 'N/A' },
                            { label: 'Course', value: selectedStudent.course_name || 'N/A' },
                            { label: 'Semester', value: selectedStudent.semester || 'N/A' },
                            { label: 'Roll Number', value: selectedStudent.roll_number || 'N/A' },
                            { label: 'Reg Number', value: selectedStudent.reg_number || 'N/A' },
                            { label: 'Mobile', value: selectedStudent.mobile || 'N/A' },
                            { label: 'Email', value: selectedStudent.email || 'N/A' },
                            { label: 'Grade', value: selectedStudent.grade || 'N/A' },
                            { label: 'Progress', value: `${selectedStudent.progress || 0}%` },
                        ].map((d, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{d.label}</span>
                                <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0f172a' }}>{d.value}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
