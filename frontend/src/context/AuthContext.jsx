import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, getStudentAccessToken, clearStudentSessionClient } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const logout = useCallback(async () => {
        try {
            await authAPI.logout();
        } catch {
            /* still clear client state */
        }
        clearStudentSessionClient();
        localStorage.removeItem('user');
        setUser(null);
    }, []);

    /** After login/register: cookie may be set for API host; localStorage mirrors JWT for cross-site (Vercel→Railway). */
    const login = useCallback(async (userData) => {
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        try {
            const res = await authAPI.getProfile();
            const merged = {
                ...userData,
                id: res.data.id,
                name: res.data.name,
                email: res.data.email,
                mobile: res.data.mobile,
                course_name: res.data.course_name,
                semester: res.data.semester,
            };
            setUser(merged);
            localStorage.setItem('user', JSON.stringify(merged));
        } catch {
            /* keep login payload; cookie + bearer still work for APIs */
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        const init = async () => {
            const studentToken = getStudentAccessToken();
            const savedUser = localStorage.getItem('user');
            if (!studentToken) {
                if (savedUser) localStorage.removeItem('user');
                if (!cancelled) setLoading(false);
                return;
            }
            try {
                let parsed = {};
                if (savedUser) {
                    try {
                        parsed = JSON.parse(savedUser);
                        if (!cancelled) setUser(parsed);
                    } catch {
                        parsed = {};
                    }
                }
                const res = await authAPI.getProfile();
                if (cancelled) return;
                const merged = {
                    ...parsed,
                    id: res.data.id,
                    name: res.data.name,
                    email: res.data.email,
                    mobile: res.data.mobile,
                    course_name: res.data.course_name,
                    semester: res.data.semester,
                };
                setUser(merged);
                localStorage.setItem('user', JSON.stringify(merged));
            } catch {
                if (!cancelled) {
                    clearStudentSessionClient();
                    localStorage.removeItem('user');
                    setUser(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        init();
        return () => { cancelled = true; };
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
