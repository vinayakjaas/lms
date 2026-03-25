import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, BookOpen, FileText, ClipboardCheck,
    BarChart3, Award, HelpCircle, User, Menu, X, GraduationCap,
    Search, Bell, Settings, LogOut,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/dashboard/course', icon: BookOpen, label: 'My Course' },
    { to: '/dashboard/assignments', icon: FileText, label: 'Assignments' },
    { to: '/dashboard/quiz', icon: ClipboardCheck, label: 'Quiz' },
    { to: '/dashboard/grades', icon: BarChart3, label: 'Grades' },
    { to: '/dashboard/certificate', icon: Award, label: 'Certificate' },
];

const bottomNavItems = [
    { to: '/dashboard/profile', icon: User, label: 'My Profile' },
    { to: '/dashboard/help', icon: HelpCircle, label: 'Help Desk' },
];

export default function DashboardLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Close sidebar on route change on mobile
    const handleNavClick = () => {
        if (isMobile) setSidebarOpen(false);
    };

    return (
        <div className="dashboard-layout" style={{ flexDirection: 'column' }}>
            {/* Top Header Bar */}
            <header style={{
                display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '20px',
                padding: isMobile ? '10px 16px' : '12px 32px', background: '#ffffff',
                borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 150,
                height: 'var(--header-height)',
            }}>
                {/* Mobile Menu Button */}
                {isMobile && (
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        style={{
                            background: 'none', border: '1px solid #e2e8f0',
                            borderRadius: '8px', padding: '8px', color: '#0f172a',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', flexShrink: 0,
                        }}
                    >
                        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                )}

                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, width: isMobile ? 'auto' : 'var(--sidebar-width)' }}>
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '8px', background: '#0f172a',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <GraduationCap size={20} style={{ color: 'white' }} />
                    </div>
                    <div>
                        <div style={{ fontWeight: '800', fontSize: '1rem', color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>AIUGIP</div>
                        {!isMobile && (
                            <div style={{ fontSize: '0.55rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: '1' }}>UNDERGRADUATE<br />PROGRAM</div>
                        )}
                    </div>
                </div>

                {/* Search Bar — hidden on mobile */}
                

                <div style={{ flex: 1 }}></div>

                {/* Right: Notifications + Settings + User */}
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px' }}>
                    
                    {isMobile && (
                        <button
                            type="button"
                            onClick={() => { void logout().then(() => navigate('/login')); }}
                            title="Logout"
                            style={{
                                width: '36px', height: '36px', borderRadius: '8px', background: '#fef2f2',
                                border: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: '#dc2626',
                            }}
                        >
                            <LogOut size={16} />
                        </button>
                    )}
                    
                    {!isMobile && (
                        <button
                            type="button"
                            onClick={() => { void logout().then(() => navigate('/login')); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '8px 14px', borderRadius: '8px', border: '1px solid #e2e8f0',
                                background: 'white', color: '#64748b', fontWeight: '600', fontSize: '0.8rem',
                                cursor: 'pointer',
                            }}
                        >
                            <LogOut size={16} /> Logout
                        </button>
                    )}

                    {/* User */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: isMobile ? '4px' : '8px' }}>
                        {!isMobile && (
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: '600', fontSize: '0.85rem', color: '#0f172a' }}>{user?.name || 'Student'}</div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{user?.course_name || 'AIUGIP Intern'}</div>
                            </div>
                        )}
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '8px', background: '#f59e0b',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.85rem', fontWeight: '700', color: 'white', flexShrink: 0,
                        }}>
                            {(user?.name || 'S').charAt(0).toUpperCase()}
                        </div>
                    </div>
                </div>
            </header>

            <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                {/* Mobile overlay */}
                {isMobile && sidebarOpen && (
                    <div
                        onClick={() => setSidebarOpen(false)}
                        style={{
                            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                            zIndex: 99, top: 'var(--header-height)',
                        }}
                    />
                )}

                {/* Sidebar */}
                <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} style={{
                    top: 'var(--header-height)', height: 'calc(100vh - var(--header-height))',
                    background: '#ffffff', borderRight: '1px solid #e2e8f0',
                    padding: '20px 0 20px 0',
                }}>
                    <nav className="sidebar-nav" style={{ padding: '0 12px' }}>
                        {navItems.map(item => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/dashboard'}
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                            >
                                <item.icon size={18} />
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>

                    <div style={{ borderTop: '1px solid #f1f5f9', margin: '12px 12px', paddingTop: '12px' }}>
                        {bottomNavItems.map(item => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                                style={{ margin: '0 0 2px 0' }}
                            >
                                <item.icon size={18} />
                                {item.label}
                            </NavLink>
                        ))}
                        <button
                            type="button"
                            onClick={() => { void logout().then(() => { navigate('/login'); handleNavClick(); }); }}
                            className="nav-item"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                                background: 'none', border: 'none', cursor: 'pointer',
                                padding: '10px 14px', borderRadius: '8px', color: '#ef4444',
                                fontWeight: '500', fontSize: '0.88rem', marginTop: '4px',
                            }}
                        >
                            <LogOut size={18} /> Sign out
                        </button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="main-content" style={{
                    marginLeft: isMobile ? 0 : 'var(--sidebar-width)',
                    padding: isMobile ? '16px' : '28px 32px',
                    background: '#f8f9fc', flex: 1, minHeight: 'calc(100vh - var(--header-height))',
                }}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
