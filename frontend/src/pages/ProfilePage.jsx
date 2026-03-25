import { useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { User, Mail, Phone, Calendar, GraduationCap, Building, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

function useWindowWidth() {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => { const h = () => setWidth(window.innerWidth); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h); }, []);
    return width;
}

export default function ProfilePage() {
    const w = useWindowWidth();
    const isMobile = w <= 768;
    const isSmall = w <= 480;
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        authAPI.getProfile()
            .then((r) => setProfile(r.data))
            .catch((e) => {
                const msg = e.response?.data?.detail || 'Could not load your profile';
                toast.error(msg);
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

    const p = profile || {};

    const fields = [
        { icon: User, label: 'Full Name', value: p.name },
        { icon: User, label: "Father's Name", value: p.father_name },
        { icon: User, label: "Mother's Name", value: p.mother_name },
        { icon: Calendar, label: 'Date of Birth', value: p.dob },
        { icon: User, label: 'Gender', value: p.gender },
        { icon: Phone, label: 'Mobile', value: p.mobile },
        { icon: Mail, label: 'Email', value: p.email },
        { icon: GraduationCap, label: 'Course', value: p.course_name },
        { icon: GraduationCap, label: 'Semester', value: p.semester },
        { icon: Building, label: 'College', value: p.college_name },
        { icon: MapPin, label: 'University', value: p.university_name },
        { icon: GraduationCap, label: 'Roll Number', value: p.roll_number },
        { icon: GraduationCap, label: 'Reg. Number', value: p.reg_number },
    ];

    return (
        <div className="animate-fadeIn">
            <div className="page-header" style={{ marginBottom: isMobile ? '16px' : '24px' }}>
                <div><h1 className="page-title">My Profile</h1><p className="page-subtitle">Student information</p></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '240px 1fr', gap: isMobile ? '16px' : '24px' }}>
                {/* Photo Card */}
                <div className="glass-card" style={{ padding: isMobile ? '20px' : '24px', textAlign: 'center' }}>
                    <div style={{
                        width: isMobile ? '90px' : '120px', height: isMobile ? '90px' : '120px', borderRadius: '50%', margin: '0 auto 16px',
                        background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: isMobile ? '2.2rem' : '3rem', fontWeight: '800', color: 'white',
                        overflow: 'hidden',
                    }}>
                        {p.photo_url ? (
                            <img src={`http://localhost:8000${p.photo_url}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            p.name?.charAt(0) || 'S'
                        )}
                    </div>
                    <h3 style={{ marginBottom: '4px', fontSize: isMobile ? '1.1rem' : '1.2rem' }}>{p.name}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{p.course_name || 'Student'}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{p.semester}</p>
                </div>

                {/* Details */}
                <div className="glass-card" style={{ padding: isMobile ? '20px' : '28px' }}>
                    <h3 style={{ marginBottom: '18px', fontSize: '1.1rem' }}>Personal & Academic Details</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr' : isMobile ? '1fr 1fr' : '1fr 1fr', gap: isMobile ? '14px' : '18px' }}>
                        {fields.map((f, i) => f.value && (
                            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <f.icon size={16} style={{ color: 'var(--primary-400)', marginTop: '3px', flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{f.label}</div>
                                    <div style={{ fontWeight: '500', fontSize: '0.88rem' }}>{f.value}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
