import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { Users, BookOpen, FileText, Award, TrendingUp } from 'lucide-react';

function useWindowWidth() {
    const [w, setW] = useState(window.innerWidth);
    useEffect(() => { const h = () => setW(window.innerWidth); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h); }, []);
    return w;
}

export default function AdminDashboardPage() {
    const w = useWindowWidth();
    const isMobile = w <= 768;
    const isSmall = w <= 480;
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        adminAPI.dashboard().then(r => setStats(r.data)).catch(e => console.error('Dashboard error:', e)).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

    const statCards = [
        { label: 'TOTAL INTERNS', value: (stats?.total_students || 0).toLocaleString(), icon: Users, bg: '#dbeafe', color: '#2563eb', badge: `${stats?.total_colleges || 0} Colleges`, badgeBg: '#d1fae5', badgeColor: '#065f46' },
        { label: 'ACTIVE MODULES', value: stats?.active_courses || '0', icon: BookOpen, bg: '#d1fae5', color: '#10b981', badge: `${stats?.total_universities || 0} Universities`, badgeBg: '#f1f5f9', badgeColor: '#64748b' },
        { label: 'TOTAL SUBMISSIONS', value: (stats?.total_submissions || 0).toLocaleString(), icon: FileText, bg: '#e0e7ff', color: '#4f46e5', badge: `${stats?.completion_rate || 0}% Rate`, badgeBg: '#fef3c7', badgeColor: '#d97706' },
        { label: 'CERTIFICATES ISSUED', value: (stats?.certificates_issued || 0).toLocaleString(), icon: Award, bg: '#fce7f3', color: '#db2777', badge: stats?.avg_grade ? `Avg: ${stats.avg_grade}` : 'N/A', badgeBg: '#d1fae5', badgeColor: '#065f46' },
    ];

    const recentSubmissions = stats?.recent_submissions || [];
    const moduleStats = stats?.module_stats || [];

    // Initials + color helper
    const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '??';
    const colors = ['#4f46e5', '#8b5cf6', '#10b981', '#0ea5e9', '#f59e0b', '#ef4444'];

    // Time ago helper
    const timeAgo = (isoStr) => {
        if (!isoStr) return 'N/A';
        const diff = Date.now() - new Date(isoStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins} mins ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
        return `${Math.floor(hrs / 24)} day${Math.floor(hrs / 24) > 1 ? 's' : ''} ago`;
    };

    const statusInfo = (s) => {
        if (s === 'graded') return { label: 'Graded', color: '#10b981' };
        if (s === 'reviewed') return { label: 'Reviewed', color: '#2563eb' };
        return { label: 'Pending Review', color: '#f59e0b' };
    };

    return (
        <div className="animate-fadeIn">
            {/* Breadcrumb */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-end', marginBottom: isMobile ? '20px' : '28px', flexDirection: isMobile ? 'column' : 'row', gap: '8px' }}>
                <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                        ADMIN DASHBOARD <span style={{ color: '#94a3b8' }}>›</span> ANALYTICS OVERVIEW
                    </div>
                    <h1 style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: '800', color: '#0f172a' }}>Institutional Performance</h1>
                </div>
            </div>

            {/* Stat Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isSmall ? 'repeat(2, 1fr)' : isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                gap: isMobile ? '12px' : '20px', marginBottom: isMobile ? '20px' : '28px',
            }}>
                {statCards.map((s, i) => (
                    <div key={i} className="glass-card" style={{ padding: isMobile ? '16px' : '22px', position: 'relative' }}>
                        <span style={{
                            position: 'absolute', top: isMobile ? '12px' : '16px', right: isMobile ? '12px' : '16px',
                            fontSize: '0.55rem', fontWeight: '700', padding: '3px 8px', borderRadius: '20px',
                            background: s.badgeBg, color: s.badgeColor, textTransform: 'uppercase',
                        }}>{s.badge}</span>
                        <div style={{
                            width: isMobile ? '36px' : '44px', height: isMobile ? '36px' : '44px',
                            borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: '12px',
                        }}>
                            <s.icon size={isMobile ? 18 : 22} style={{ color: s.color }} />
                        </div>
                        <div style={{ fontSize: '0.6rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{s.label}</div>
                        <div style={{ fontSize: isMobile ? '1.6rem' : '2.2rem', fontWeight: '800', color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Recent Submissions + Module Completion */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 340px',
                gap: isMobile ? '16px' : '24px',
            }}>
                {/* Recent Submissions */}
                <div className="glass-card" style={{ padding: isMobile ? '18px' : '28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>Recent Submissions</h3>
                            <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Real-time academic activity log</p>
                        </div>
                    </div>

                    {!isMobile && (
                        <div style={{
                            display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
                            padding: '8px 0', borderBottom: '1px solid #e2e8f0', marginBottom: '6px',
                        }}>
                            {['INTERN NAME', 'ASSIGNMENT', 'TIMESTAMP', 'STATUS'].map(h => (
                                <div key={h} style={{ fontSize: '0.6rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</div>
                            ))}
                        </div>
                    )}

                    {recentSubmissions.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                            <FileText size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                            <div style={{ fontSize: '0.88rem' }}>No submissions yet</div>
                        </div>
                    )}

                    {recentSubmissions.map((s, i) => {
                        const si = statusInfo(s.status);
                        return (
                            <div key={i} style={{
                                display: isMobile ? 'flex' : 'grid',
                                gridTemplateColumns: isMobile ? undefined : '1.5fr 1fr 1fr 1fr',
                                flexDirection: isMobile ? 'column' : undefined,
                                gap: isMobile ? '4px' : '0',
                                padding: '14px 0', borderBottom: i < recentSubmissions.length - 1 ? '1px solid #f1f5f9' : 'none',
                                alignItems: isMobile ? 'flex-start' : 'center',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '50%', background: colors[i % colors.length],
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontSize: '0.6rem', fontWeight: '700', flexShrink: 0,
                                    }}>{getInitials(s.student_name)}</div>
                                    <span style={{ fontWeight: '600', fontSize: '0.88rem', color: '#0f172a' }}>{s.student_name}</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#475569' }}>{s.title}</div>
                                <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{timeAgo(s.submitted_at)}</div>
                                <div>
                                    <span style={{
                                        fontSize: '0.68rem', fontWeight: '600', color: si.color,
                                        padding: '4px 10px', borderRadius: '20px',
                                        background: si.color + '15',
                                    }}>{si.label}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Module Completion */}
                <div className="glass-card" style={{ padding: isMobile ? '18px' : '24px' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>Module Completion</h3>
                    <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '18px' }}>Module enrollment vs completion</p>

                    {moduleStats.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                            <div style={{ fontSize: '0.85rem' }}>No module data yet</div>
                        </div>
                    )}

                    {moduleStats.map((m, i) => (
                        <div key={i} style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0f172a' }}>{m.module_name?.substring(0, 30)}</span>
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                    {m.completed} / {m.enrolled}
                                    <span style={{ fontWeight: '600', color: '#0f172a' }}> ({m.percentage}%)</span>
                                </span>
                            </div>
                            <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '20px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${m.percentage}%`, background: m.percentage > 50 ? '#10b981' : '#1e3a5f', borderRadius: '20px', transition: 'width 0.6s ease' }}></div>
                            </div>
                        </div>
                    ))}

                    <div style={{ display: 'flex', gap: '20px', marginTop: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                            <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>COMPLETED</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e2e8f0' }}></div>
                            <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>ENROLLED</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
