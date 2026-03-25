import { NavLink, Outlet } from 'react-router-dom';
import {
    LayoutDashboard, BookOpen, Users, ClipboardCheck, Settings,
    Menu, X, GraduationCap, Search, Bell, Grid3X3, LogOut, HelpCircle, FileCheck, Eye
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const navItems = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/admin/courses', icon: BookOpen, label: 'Course Management' },
    { to: '/admin/students', icon: Users, label: 'Student Data' },
    { to: '/admin/quizzes', icon: ClipboardCheck, label: 'Quiz Management' },
    { to: '/admin/assignments', icon: FileCheck, label: 'Assignments' },
    { to: '/admin/visibility', icon: Eye, label: 'Content Visibility' },
    { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

export default function AdminLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const navigate = useNavigate();

    useEffect(() => {
        const h = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, []);

    const handleNavClick = () => { if (isMobile) setSidebarOpen(false); };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {/* Top Header */}
            <header style={{
                display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '20px',
                padding: isMobile ? '10px 16px' : '12px 32px', background: '#ffffff',
                borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 150,
                height: 'var(--header-height)',
            }}>
                {isMobile && (
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
                        background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px',
                        padding: '8px', color: '#0f172a', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                    }}>
                        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                )}

                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, width: isMobile ? 'auto' : '220px' }}>
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '8px', background: '#0f172a',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <GraduationCap size={20} style={{ color: 'white' }} />
                    </div>
                    <div>
                        <div style={{ fontWeight: '800', fontSize: '0.88rem', color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>AIUGIP Admin</div>
                        {!isMobile && <div style={{ fontSize: '0.55rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: '1' }}>ACADEMIC MANAGEMENT</div>}
                    </div>
                </div>

                {/* Center: Portal name + search
                {!isMobile && (
                    <>
                        <span style={{ fontWeight: '700', fontSize: '0.95rem', color: '#0f172a', fontFamily: "'Outfit'" }}>AIUGIP Portal</span>
                        <div style={{ flex: 1, maxWidth: '400px', position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input type="text" placeholder="Search internships, students or modules..." style={{
                                width: '100%', padding: '10px 14px 10px 40px', border: '1px solid #e2e8f0',
                                borderRadius: '10px', fontSize: '0.82rem', color: '#334155', background: '#f8fafc', outline: 'none',
                            }} />
                        </div>
                    </>
                )} */}

                <div style={{ flex: 1 }}></div>

                {/* Right */}
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px' }}>
                    {/* <button style={{
                        width: '36px', height: '36px', borderRadius: '8px', background: '#f8fafc',
                        border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: '#64748b',
                    }}><Bell size={18} /></button> */}
                    {/* {!isMobile && (
                        // <button style={{
                        //     width: '36px', height: '36px', borderRadius: '8px', background: '#f8fafc',
                        //     border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        //     cursor: 'pointer', color: '#64748b',
                        // }}><Grid3X3 size={18} /></button>
                    )} */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: isMobile ? '4px' : '8px' }}>
                        {!isMobile && (
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: '600', fontSize: '0.85rem', color: '#0f172a' }}>Admin Profile</div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Super User</div>
                            </div>
                        )}
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '8px', background: '#0f172a',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.85rem', fontWeight: '700', color: 'white', flexShrink: 0,
                        }}>A</div>
                    </div>
                </div>
            </header>

            <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                {/* Mobile overlay */}
                {isMobile && sidebarOpen && (
                    <div onClick={() => setSidebarOpen(false)} style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                        zIndex: 99, top: 'var(--header-height)',
                    }} />
                )}

                {/* Sidebar */}
                <aside style={{
                    width: isMobile ? '260px' : '220px',
                    position: 'fixed', top: 'var(--header-height)', left: 0,
                    height: 'calc(100vh - var(--header-height))',
                    background: '#ffffff', borderRight: '1px solid #e2e8f0',
                    padding: '20px 0', display: 'flex', flexDirection: 'column',
                    transform: isMobile && !sidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
                    transition: 'transform 0.3s ease',
                    zIndex: isMobile ? 100 : 1,
                    boxShadow: isMobile && sidebarOpen ? '4px 0 20px rgba(0,0,0,0.15)' : 'none',
                }}>
                    <nav style={{ flex: 1, padding: '0 12px' }}>
                        {navItems.map(item => (
                            <NavLink key={item.to} to={item.to} end={item.end}
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                            >
                                <item.icon size={18} />
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>
                    <div style={{ borderTop: '1px solid #f1f5f9', margin: '0 12px', paddingTop: '12px' }}>
                        {/* <NavLink to="/admin/help" className="nav-item" onClick={handleNavClick}>
                            <HelpCircle size={18} /> Support
                        </NavLink> */}
                        <button
                            onClick={() => {
                                localStorage.removeItem('adminToken');
                                localStorage.removeItem('adminUser');
                                navigate('/admin/login');
                            }}
                            className="nav-item"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                                background: 'none', border: 'none', cursor: 'pointer',
                                padding: '10px 14px', borderRadius: '8px', color: '#ef4444',
                                fontWeight: '500', fontSize: '0.88rem',
                            }}
                        >
                            <LogOut size={18} /> Logout
                        </button>
                    </div>

                    {/* Footer */}
                    <div style={{
                        margin: '12px', padding: '14px', borderTop: '1px solid #f1f5f9',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ color: 'white', fontSize: '0.5rem', fontWeight: '800' }}>T</span>
                            </div>
                            <span style={{ fontSize: '0.68rem', fontWeight: '600', color: '#0f172a' }}>TADRI</span>
                        </div>
                        <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>AIC BIHAR</span>
                    </div>
                </aside>

                {/* Main */}
                <main style={{
                    marginLeft: isMobile ? 0 : '220px',
                    padding: isMobile ? '16px' : '28px 32px',
                    background: '#f8f9fc', flex: 1, minHeight: 'calc(100vh - var(--header-height))',
                    overflowX: 'hidden', minWidth: 0,
                }}>
                    <Outlet />
                </main>
            </div>

           
        </div>
    );
}
