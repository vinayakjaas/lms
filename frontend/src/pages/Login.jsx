import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI, setStudentAccessToken } from '../services/api';
import { LogIn, Eye, EyeOff, Phone, Lock, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const { login, user, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!authLoading && user) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, authLoading, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password) {
            toast.error('Please fill in all fields');
            return;
        }
        setLoading(true);
        try {
            const res = await authAPI.login({ username, password });
            if (res.data?.access_token) {
                setStudentAccessToken(res.data.access_token);
            }
            await login(res.data.user);
            toast.success('Welcome back! 🎉');
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) {
        return (
            <div className="auth-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="auth-container">
            <div className="auth-card glass-card animate-fadeInUp">
                <div className="auth-logo">
                    <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🎓</div>
                    <h1>AIUGIP</h1>
                    <p>All India Undergraduate Internship Program</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        TADRI & AIC Bihar Vidyapeet
                    </p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">
                            <Phone size={14} style={{ display: 'inline', marginRight: '6px' }} />
                            Mobile Number or Email
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Enter mobile number or email"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">
                            <Lock size={14} style={{ display: 'inline', marginRight: '6px' }} />
                            Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPass ? 'text' : 'password'}
                                className="form-input"
                                style={{ width: '100%', paddingRight: '44px' }}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(!showPass)}
                                style={{
                                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                                }}
                            >
                                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', marginTop: '8px' }}>
                        {loading ? <span className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></span> : <><LogIn size={18} /> Sign In</>}
                    </button>

                    <div className="auth-divider">or</div>

                    <Link to="/register" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                        <GraduationCap size={18} /> New Student? Register Here
                    </Link>
                </form>

                <div style={{ textAlign: 'center', marginTop: '20px', padding: '12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        Seeded demo: mobile <strong>9876543210</strong> or email <strong>rajesh@test.com</strong> — password <strong>password123</strong>
                    </span>
                </div>

                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <Link to="/admin/login" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Admin Login →
                    </Link>
                </div>
            </div>
        </div>
    );
}
