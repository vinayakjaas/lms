import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI, adminAPI, setStudentAccessToken } from '../services/api';
import { UserPlus, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const REQUIRED_BIHAR_COLLEGE_OPTIONS = [
    'Patna University (Affiliated / Other)',
    'Babasaheb Bhimrao Ambedkar Bihar University — Affiliated College',
    'Magadh University — Affiliated College',
    'Tilka Manjhi Bhagalpur University — Affiliated College',
    'Lalit Narayan Mithila University — Affiliated College',
    'Jai Prakash University — Affiliated College',
    'Purnea University — Affiliated College',
    'Patliputra University — Affiliated College',
    'Bihar University of Health Sciences — Affiliated College',
    'Patna College',
    'Patna Science College',
    'Bihar National College',
    'T.N.B. College',
    'Marwari College',
    'Mirza Ghalib College',
    'Jamuni Lal College',
];

function isValidEmail(s) {
    const t = (s || '').trim();
    if (!t) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function isValidIndianMobile(s) {
    const d = String(s || '').replace(/\D/g, '');
    return d.length === 10 && /^[6-9]\d{9}$/.test(d);
}

function useWindowWidth() {
    const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
    useEffect(() => {
        const onResize = () => setW(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return w;
}

export default function Register() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [colleges, setColleges] = useState([]);
    const { login, user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const w = useWindowWidth();
    const isMobile = w <= 768;

    const [form, setForm] = useState({
        name: '', father_name: '', mother_name: '', dob: '', gender: '',
        mobile: '', email: '', password: '', confirm_password: '',
        course_name: '', semester: '', college_id: '',
        roll_number: '', reg_number: '', undertaking_accepted: false,
        other_college_name: '',
    });

    useEffect(() => {
        adminAPI.colleges()
            .then((r) => {
                const list = Array.isArray(r.data) ? r.data : [];
                const bihar = list.filter((c) => {
                    const st = (c.university_state || '').toString().toLowerCase();
                    if (st === 'bihar') return true;
                    const uni = (c.university_name || '').toString().toLowerCase();
                    return uni.includes('bihar');
                });
                const byName = new Map();
                bihar.forEach((c) => {
                    const key = (c.name || '').trim().toLowerCase();
                    if (!key) return;
                    byName.set(key, c);
                });
                // Ensure user-requested Bihar colleges are visible even if not yet seeded in DB.
                REQUIRED_BIHAR_COLLEGE_OPTIONS.forEach((name) => {
                    const key = name.trim().toLowerCase();
                    if (!byName.has(key)) {
                        byName.set(key, {
                            id: `fallback-${key.replace(/[^a-z0-9]+/g, '-')}`,
                            name,
                            code: '',
                            city: 'Bihar',
                            university_state: 'Bihar',
                        });
                    }
                });
                const merged = Array.from(byName.values())
                    .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
                setColleges(merged);
            })
            .catch(() => setColleges([]));
    }, []);

    useEffect(() => {
        if (!authLoading && user) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, authLoading, navigate]);

    const updateForm = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

    const validateStep1 = () => {
        if (!form.name?.trim()) {
            toast.error('Full name is required');
            return false;
        }
        if (!form.father_name?.trim()) {
            toast.error("Father's name is required");
            return false;
        }
        if (!form.mother_name?.trim()) {
            toast.error("Mother's name is required");
            return false;
        }
        if (!form.dob?.trim()) {
            toast.error('Date of birth is required');
            return false;
        }
        if (!form.gender) {
            toast.error('Gender is required');
            return false;
        }
        if (!isValidIndianMobile(form.mobile)) {
            toast.error('Enter a valid 10-digit mobile number');
            return false;
        }
        if (!isValidEmail(form.email)) {
            toast.error('Enter a valid email address');
            return false;
        }
        if (!form.password) {
            toast.error('Password is required');
            return false;
        }
        if (form.password !== form.confirm_password) {
            toast.error('Passwords do not match');
            return false;
        }
        return true;
    };

    const validateStep2 = () => {
        if (!form.college_id) {
            toast.error('Please select a college');
            return false;
        }
        if (form.college_id === 'other' && !form.other_college_name?.trim()) {
            toast.error('Please enter your Other College Name');
            return false;
        }
        if (!form.course_name?.trim()) {
            toast.error('Course / program is required');
            return false;
        }
        if (!form.semester?.trim()) {
            toast.error('Semester is required');
            return false;
        }
        return true;
    };

    const goNext = () => {
        if (step === 1) {
            if (!validateStep1()) return;
        }
        if (step === 2) {
            if (!validateStep2()) return;
        }
        setStep((s) => s + 1);
    };

    const handleSubmit = async () => {
        if (!validateStep1()) {
            setStep(1);
            return;
        }
        if (!validateStep2()) {
            setStep(2);
            return;
        }
        if (!form.undertaking_accepted) {
            toast.error('Please accept the undertaking');
            return;
        }

        setLoading(true);
        try {
            const fd = new FormData();
            const skip = ['confirm_password'];
            Object.entries(form).forEach(([k, v]) => {
                if (skip.includes(k)) return;
                if (k === 'college_id' && v === 'other') return;
                if (k === 'other_college_name' && form.college_id !== 'other') return;
                if (k === 'undertaking_accepted') {
                    fd.append(k, v ? 'true' : 'false');
                    return;
                }
                if (v === '' || v === null || v === undefined) return;
                fd.append(k, v);
            });

            const res = await authAPI.register(fd);
            if (res.data?.access_token) {
                setStudentAccessToken(res.data.access_token);
            }
            await login(res.data.user);
            toast.success('Registration successful! 🎉');
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    const steps = [
        { num: 1, title: 'Personal Info' },
        { num: 2, title: 'Academic Details' },
        { num: 3, title: 'Confirmation' },
    ];

    if (authLoading) {
        return (
            <div className="auth-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="auth-container">
            <div className="auth-card glass-card animate-fadeInUp" style={{ maxWidth: '560px' }}>
                <div className="auth-logo">
                    <h1>Student Registration</h1>
                    <p>AIUGIP Internship Program</p>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', justifyContent: 'center' }}>
                    {steps.map((s, idx) => (
                        <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '50%', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: '700',
                                background: step >= s.num ? 'var(--gradient-primary)' : 'var(--bg-glass)',
                                color: step >= s.num ? 'white' : 'var(--text-muted)',
                                border: '1px solid ' + (step >= s.num ? 'transparent' : 'var(--border-color)'),
                            }}>
                                {step > s.num ? <Check size={14} /> : s.num}
                            </div>
                            {idx < steps.length - 1 && (
                                <div style={{ width: '24px', height: '2px', background: step > s.num ? 'var(--primary-500)' : 'var(--border-color)' }} />
                            )}
                        </div>
                    ))}
                </div>

                <div className="auth-form">
                    {step === 1 && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Full Name *</label>
                                <input className="form-input" placeholder="Enter your full name" value={form.name} onChange={e => updateForm('name', e.target.value)} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label className="form-label">Father&apos;s Name *</label>
                                    <input className="form-input" placeholder="Father's name" value={form.father_name} onChange={e => updateForm('father_name', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Mother&apos;s Name *</label>
                                    <input className="form-input" placeholder="Mother's name" value={form.mother_name} onChange={e => updateForm('mother_name', e.target.value)} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label className="form-label">Date of Birth *</label>
                                    <input className="form-input" type="date" value={form.dob} onChange={e => updateForm('dob', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Gender *</label>
                                    <select className="form-input" value={form.gender} onChange={e => updateForm('gender', e.target.value)}>
                                        <option value="">Select</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Mobile Number *</label>
                                <input className="form-input" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile number" value={form.mobile} onChange={e => updateForm('mobile', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email *</label>
                                <input className="form-input" type="email" placeholder="your@email.com" value={form.email} onChange={e => updateForm('email', e.target.value)} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label className="form-label">Password *</label>
                                    <input className="form-input" type="password" placeholder="Create password" value={form.password} onChange={e => updateForm('password', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Confirm Password *</label>
                                    <input className="form-input" type="password" placeholder="Re-enter password" value={form.confirm_password} onChange={e => updateForm('confirm_password', e.target.value)} />
                                </div>
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <div className="form-group">
                                <label className="form-label">College *</label>
                                <select className="form-input" value={form.college_id} onChange={e => updateForm('college_id', e.target.value)}>
                                    <option value="">Select College</option>
                                    {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    <option value="other">Other </option>
                                </select>
                            </div>
                            {form.college_id === 'other' && (
                                <div className="form-group">
                                    <label className="form-label">Other College Name *</label>
                                    <input
                                        className="form-input"
                                        placeholder="Enter your college name"
                                        value={form.other_college_name}
                                        onChange={(e) => updateForm('other_college_name', e.target.value)}
                                    />
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label className="form-label">Course / Program *</label>
                                    <input className="form-input" placeholder="e.g., B.A., B.Sc., B.Tech" value={form.course_name} onChange={e => updateForm('course_name', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Semester *</label>
                                    <select className="form-input" value={form.semester} onChange={e => updateForm('semester', e.target.value)}>
                                        <option value="">Select</option>
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={`Semester ${s}`}>Semester {s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label className="form-label">Roll Number</label>
                                    <input className="form-input" placeholder="Enter roll number" value={form.roll_number} onChange={e => updateForm('roll_number', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Registration Number</label>
                                    <input className="form-input" placeholder="Enter reg. number" value={form.reg_number} onChange={e => updateForm('reg_number', e.target.value)} />
                                </div>
                            </div>
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <div className="glass-card" style={{ padding: '20px' }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '16px', color: 'var(--primary-400)' }}>Review Your Details</h3>
                                {[
                                    ['Name', form.name],
                                    ['Father', form.father_name],
                                    ['Mother', form.mother_name],
                                    ['Date of Birth', form.dob],
                                    ['Gender', form.gender ? form.gender.charAt(0).toUpperCase() + form.gender.slice(1) : ''],
                                    ['Mobile', form.mobile],
                                    ['Email', form.email],
                                    ['Course', form.course_name],
                                    ['Semester', form.semester],
                                    [
                                        'College',
                                        form.college_id === 'other'
                                            ? (form.other_college_name || 'Other')
                                            : (colleges.find((c) => c.id === form.college_id)?.name || 'N/A'),
                                    ],
                                    ['Roll No.', form.roll_number || '—'],
                                    ['Reg. No.', form.reg_number || '—'],
                                ].map(([k, v]) => (
                                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{k}</span>
                                        <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>{v}</span>
                                    </div>
                                ))}
                            </div>
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                <input type="checkbox" checked={form.undertaking_accepted} onChange={e => updateForm('undertaking_accepted', e.target.checked)}
                                    style={{ marginTop: '3px', accentColor: 'var(--primary-500)' }} />
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    I hereby declare that all information provided is true and correct. I agree to the Terms & Conditions and Privacy Policy of AIUGIP.
                                </span>
                            </label>
                        </>
                    )}

                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        {step > 1 && (
                            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(step - 1)}>
                                <ArrowLeft size={16} /> Back
                            </button>
                        )}
                        {step < 3 ? (
                            <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={goNext}>
                                Next <ArrowRight size={16} />
                            </button>
                        ) : (
                            <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit} disabled={loading}>
                                {loading ? <span className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></span> : <><UserPlus size={16} /> Complete Registration</>}
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <Link to="/login" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Already registered? Sign In →
                    </Link>
                </div>
            </div>
        </div>
    );
}
