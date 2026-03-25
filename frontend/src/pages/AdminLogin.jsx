import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { adminAPI } from '../services/api';
import { Shield, Mail, Lock, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminLogin() {
    const [email, setEmail] = useState('admin@aiugip.edu.in');
    const [password, setPassword] = useState('admin123');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (localStorage.getItem('adminToken')) {
            navigate('/admin', { replace: true });
        }
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await adminAPI.login({ email, password });
            localStorage.setItem('adminToken', res.data.access_token);
            localStorage.setItem('adminUser', JSON.stringify(res.data.user));
            toast.success('Welcome, Admin!');
            navigate('/admin');
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card glass-card animate-fadeInUp">
                <div className="auth-logo">
                    <Shield size={48} style={{ color: 'var(--primary-400)', marginBottom: '8px' }} />
                    <h1>Admin Portal</h1>
                    <p>AIUGIP Management Dashboard</p>
                </div>
                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label"><Mail size={14} style={{ display: 'inline', marginRight: '6px' }} />Email</label>
                        <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@aiugip.edu.in" required />
                    </div>
                    <div className="form-group">
                        <label className="form-label"><Lock size={14} style={{ display: 'inline', marginRight: '6px' }} />Password</label>
                        <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required />
                    </div>
                    <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                        {loading ? <span className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></span> : <><LogIn size={18} /> Admin Login</>}
                    </button>
                </form>
                <div style={{ textAlign: 'center', marginTop: '20px', padding: '12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Demo: admin@aiugip.edu.in / admin123</span>
                </div>
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <Link to="/login" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>← Student login</Link>
                </div>
            </div>
        </div>
    );
}
