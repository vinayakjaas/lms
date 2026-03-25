import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import DashboardLayout from './pages/DashboardLayout';
import Dashboard from './pages/Dashboard';
import CoursePage from './pages/CoursePage';
import QuizPage from './pages/QuizPage';
import AssignmentPage from './pages/AssignmentPage';
import GradesPage from './pages/GradesPage';
import CertificatePage from './pages/CertificatePage';
import ProfilePage from './pages/ProfilePage';
import HelpPage from './pages/HelpPage';
import Login from './pages/Login';
import Register from './pages/Register';

import AdminLayout from './pages/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import AdminCoursePage from './pages/AdminCoursePage';
import AdminStudentsPage from './pages/AdminStudentsPage';
import AdminQuizPage from './pages/AdminQuizPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import AdminAssignmentPage from './pages/AdminAssignmentPage';
import AdminVisibilityPage from './pages/AdminVisibilityPage';
import AdminLogin from './pages/AdminLogin';

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner" />
            </div>
        );
    }
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    return children;
}

function HomeRedirect() {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner" />
            </div>
        );
    }
    return <Navigate to={user ? '/dashboard' : '/login'} replace />;
}

function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin/login" element={<AdminLogin />} />

            <Route
                path="/dashboard"
                element={(
                    <ProtectedRoute>
                        <DashboardLayout />
                    </ProtectedRoute>
                )}
            >
                <Route index element={<Dashboard />} />
                <Route path="course" element={<CoursePage />} />
                <Route path="quiz" element={<QuizPage />} />
                <Route path="assignments" element={<AssignmentPage />} />
                <Route path="grades" element={<GradesPage />} />
                <Route path="certificate" element={<CertificatePage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="help" element={<HelpPage />} />
            </Route>

            <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="courses" element={<AdminCoursePage />} />
                <Route path="students" element={<AdminStudentsPage />} />
                <Route path="quizzes" element={<AdminQuizPage />} />
                <Route path="assignments" element={<AdminAssignmentPage />} />
                <Route path="visibility" element={<AdminVisibilityPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
            </Route>

            <Route path="/" element={<HomeRedirect />} />
            <Route path="*" element={<HomeRedirect />} />
        </Routes>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
                <Toaster
                    position="top-right"
                    toastOptions={{
                        style: {
                            background: '#ffffff',
                            color: '#1e293b',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        },
                    }}
                />
            </AuthProvider>
        </BrowserRouter>
    );
}
