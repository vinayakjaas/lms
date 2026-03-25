import { useEffect, useMemo, useState } from 'react';
import { adminAPI, courseAPI } from '../services/api';
import { Eye, Save, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

const VISIBILITY_MODES = [
    { value: 'all', label: 'Visible to all students' },
    { value: 'colleges', label: 'Only selected colleges' },
    { value: 'students', label: 'Only selected students' },
    { value: 'colleges_and_students', label: 'Selected colleges OR selected students' },
];

export default function AdminVisibilityPage() {
    const [courses, setCourses] = useState([]);
    const [students, setStudents] = useState([]);
    const [colleges, setColleges] = useState([]);

    const [moduleId, setModuleId] = useState('');
    const [contentId, setContentId] = useState('');
    const [search, setSearch] = useState('');

    const [mode, setMode] = useState('all');
    const [selectedCollegeIds, setSelectedCollegeIds] = useState([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [cr, sr, colr] = await Promise.all([
                    courseAPI.list(),
                    adminAPI.students({ page: 1, limit: 500 }),
                    adminAPI.colleges(),
                ]);
                setCourses(cr.data || []);
                setStudents(sr.data?.students || []);
                setColleges(colr.data || []);
            } catch {
                toast.error('Failed to load visibility data');
            }
        })();
    }, []);

    const modules = useMemo(() => {
        const list = [];
        for (const c of courses || []) {
            for (const m of c.modules || []) {
                list.push({
                    ...m,
                    course_id: c.id,
                    course_title: c.title,
                    title_with_course: `${c.title} — ${m.title}`,
                });
            }
        }
        return list;
    }, [courses]);

    const currentModule = useMemo(() => modules.find((m) => m.id === moduleId), [modules, moduleId]);
    const currentContents = currentModule?.contents || [];
    const currentContent = currentContents.find((c) => c.id === contentId) || null;

    useEffect(() => {
        if (!currentModule) return;
        if (contentId && currentContent) {
            setMode(currentContent.visibility_mode || 'all');
            setSelectedCollegeIds(currentContent.visible_college_ids || []);
            setSelectedStudentIds(currentContent.visible_student_ids || []);
            return;
        }
        setMode(currentModule.visibility_mode || 'all');
        setSelectedCollegeIds(currentModule.visible_college_ids || []);
        setSelectedStudentIds(currentModule.visible_student_ids || []);
    }, [moduleId, contentId, currentModule, currentContent]);

    const filteredStudents = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return students;
        return students.filter((s) =>
            (s.name || '').toLowerCase().includes(q)
            || (s.mobile || '').toLowerCase().includes(q)
            || (s.reg_number || '').toLowerCase().includes(q)
        );
    }, [students, search]);

    const toggleSet = (setter, value) => {
        setter((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
    };

    const saveVisibility = async () => {
        if (!moduleId) {
            toast.error('Please select module');
            return;
        }
        setSaving(true);
        try {
            if (contentId) {
                await adminAPI.updateModuleContent(moduleId, contentId, {
                    visibility_mode: mode,
                    visible_college_ids: selectedCollegeIds,
                    visible_student_ids: selectedStudentIds,
                });
            } else {
                await adminAPI.updateModule(moduleId, {
                    visibility_mode: mode,
                    visible_college_ids: selectedCollegeIds,
                    visible_student_ids: selectedStudentIds,
                });
            }

            const r = await courseAPI.list();
            setCourses(r.data || []);
            toast.success(contentId ? 'Content visibility updated' : 'Module visibility updated');
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Failed to save visibility');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="animate-fadeIn">
            <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>
                    Course Management
                </div>
                <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#0f172a' }}>
                    Content Visibility
                </h1>
                <p style={{ fontSize: '0.86rem', color: '#64748b' }}>
                    Control which students or institutions can see each module/content item.
                </p>
            </div>

            <div className="glass-card" style={{ padding: '18px', marginBottom: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                            Module
                        </div>
                        <select
                            value={moduleId}
                            onChange={(e) => {
                                setModuleId(e.target.value);
                                setContentId('');
                            }}
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}
                        >
                            <option value="">Select module</option>
                            {modules.map((m) => (
                                <option key={`${m.course_id}-${m.id}`} value={m.id}>{m.title_with_course}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                            Content (optional)
                        </div>
                        <select
                            value={contentId}
                            onChange={(e) => setContentId(e.target.value)}
                            disabled={!moduleId}
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}
                        >
                            <option value="">Apply to module only</option>
                            {currentContents.map((c) => (
                                <option key={c.id} value={c.id}>{c.title} ({c.content_type})</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="glass-card" style={{ padding: '18px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <Eye size={16} />
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Visibility Rules</h3>
                </div>
                <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', marginBottom: '12px' }}
                >
                    {VISIBILITY_MODES.map((v) => (
                        <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                </select>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                            Colleges ({selectedCollegeIds.length})
                        </div>
                        <div style={{ maxHeight: '220px', overflow: 'auto' }}>
                            {colleges.map((c) => (
                                <label key={c.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.82rem', marginBottom: '6px' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedCollegeIds.includes(c.id)}
                                        onChange={() => toggleSet(setSelectedCollegeIds, c.id)}
                                    />
                                    <span>{c.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                            <Filter size={13} />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Filter students..."
                                style={{ width: '100%', padding: '7px 9px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '0.8rem' }}
                            />
                        </div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                            Students ({selectedStudentIds.length})
                        </div>
                        <div style={{ maxHeight: '220px', overflow: 'auto' }}>
                            {filteredStudents.map((s) => (
                                <label key={s.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.82rem', marginBottom: '6px' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedStudentIds.includes(s.id)}
                                        onChange={() => toggleSet(setSelectedStudentIds, s.id)}
                                    />
                                    <span>{s.name} ({s.mobile || s.reg_number || 'N/A'})</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <button
                onClick={saveVisibility}
                disabled={saving || !moduleId}
                className="btn"
                style={{
                    background: '#0f172a', color: 'white', padding: '10px 16px', borderRadius: '10px',
                    fontWeight: 700, opacity: (saving || !moduleId) ? 0.7 : 1,
                }}
            >
                <Save size={15} style={{ marginRight: '6px' }} />
                {saving ? 'Saving...' : 'Save Visibility'}
            </button>
        </div>
    );
}
