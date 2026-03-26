import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

/** Must match backend `STUDENT_COOKIE_NAME` (default lms_student). */
export const STUDENT_COOKIE_NAME = import.meta.env.VITE_STUDENT_COOKIE_NAME || 'lms_student';

/** First-party fallback when API is on another domain (e.g. Vercel + Railway): third-party cookies often clear on refresh (Safari ITP). */
export const STUDENT_TOKEN_STORAGE_KEY = 'lms_student_jwt';

function readCookie(name) {
    const prefix = `${name}=`;
    const chunks = `; ${document.cookie}`.split(';');
    for (const raw of chunks) {
        const c = raw.trim();
        if (c.startsWith(prefix)) {
            return decodeURIComponent(c.slice(prefix.length));
        }
    }
    return '';
}

/** Student JWT from cookie (same-site or when browser keeps third-party cookie). */
export function getStudentTokenFromCookie() {
    return readCookie(STUDENT_COOKIE_NAME).trim();
}

/** Prefer cookie, then localStorage (cross-site SPA). */
export function getStudentAccessToken() {
    const fromCookie = getStudentTokenFromCookie();
    if (fromCookie) return fromCookie;
    try {
        return (localStorage.getItem(STUDENT_TOKEN_STORAGE_KEY) || '').trim();
    } catch {
        return '';
    }
}

export function setStudentAccessToken(token) {
    const t = (token || '').trim();
    if (!t) return;
    try {
        localStorage.setItem(STUDENT_TOKEN_STORAGE_KEY, t);
    } catch {
        /* ignore quota / private mode */
    }
}

export function clearStudentAuthCookie() {
    if (typeof window === 'undefined') return;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    const sameSite = window.location.protocol === 'https:' ? 'None' : 'Lax';
    document.cookie = `${STUDENT_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=${sameSite}${secure}`;
}

export function clearStudentSessionClient() {
    clearStudentAuthCookie();
    try {
        localStorage.removeItem(STUDENT_TOKEN_STORAGE_KEY);
    } catch {
        /* ignore */
    }
}

const api = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
});

function pathFromRequestUrl(url) {
    if (!url) return '';
    try {
        if (url.startsWith('http')) return new URL(url).pathname;
    } catch {
        /* ignore */
    }
    return url.split('?')[0];
}

api.interceptors.request.use((config) => {
    const url = config.url || '';
    const method = (config.method || 'get').toLowerCase();
    const pathOnly = pathFromRequestUrl(url);
    // Registration flow loads colleges without admin login — skip attaching tokens.
    if (pathOnly === '/admin/colleges' && method === 'get') {
        return config;
    }
    const isAdminCall = pathOnly.includes('/admin/') || url.includes('/admin/');
    const isAdminLogin = pathOnly.includes('/admin/login') || url.includes('/admin/login');
    // Student routes must never send adminToken; admin routes (except login) use adminToken.
    const token = isAdminCall && !isAdminLogin
        ? localStorage.getItem('adminToken')
        : getStudentAccessToken();
    const trimmed = token ? String(token).trim() : '';
    if (trimmed) {
        config.headers.Authorization = `Bearer ${trimmed}`;
    }
    return config;
});

api.interceptors.response.use(
    (res) => res,
    (err) => {
        const status = err.response?.status;
        const url = err.config?.url || '';
        if (status === 401) {
            if (url.includes('/auth/me')) {
                return Promise.reject(err);
            }
            if (url.includes('/admin/') && !url.includes('/admin/login')) {
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminUser');
            } else if (!url.includes('/admin/') && getStudentAccessToken()) {
                clearStudentSessionClient();
                localStorage.removeItem('user');
                fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
                const p = window.location.pathname;
                if (!p.startsWith('/login') && !p.startsWith('/register')) {
                    window.location.assign('/login');
                }
            }
        }
        return Promise.reject(err);
    }
);

// Courses
export const courseAPI = {
    list: () => api.get('/courses/'),
    get: (id) => api.get(`/courses/${id}`),
    enroll: (id) => api.post(`/courses/${id}/enroll`),
    getProgress: (id) => api.get(`/courses/${id}/progress`),
    updateProgress: (data) => api.put('/courses/progress', data),
};

// Quizzes
export const quizAPI = {
    myCompletedQuizIds: () => api.get('/quizzes/my/completed-quiz-ids'),
    get: (id) => api.get(`/quizzes/${id}`),
    start: (id) => api.post(`/quizzes/${id}/start`),
    submit: (id, data) => api.post(`/quizzes/${id}/submit`, data),
    results: (id) => api.get(`/quizzes/${id}/results`),
};

// Assignments
export const assignmentAPI = {
    // Let axios set multipart boundary; manual Content-Type can break upload and header merge.
    upload: (formData) => api.post('/assignments/upload', formData),
    my: () => api.get('/assignments/my'),
    mySections: () => api.get('/assignment-sections/my'),
};

// Grades
export const gradeAPI = {
    my: () => api.get('/grades/my'),
    getCourse: (courseId) => api.get(`/grades/my/${courseId}`),
    dashboardSummary: () => api.get('/grades/summary/dashboard'),
};

// Certificates
export const certAPI = {
    eligibility: (courseId) => api.get(`/certificates/eligibility/${courseId}`),
    generate: (courseId) => api.post(`/certificates/generate/${courseId}`),
    my: () => api.get('/certificates/my'),
    verify: (certId) => api.get(`/certificates/${certId}/verify`),
    submitFeedback: (data) => api.post('/certificates/feedback', data),
};

// Admin
export const adminAPI = {
    login: (data) => api.post('/admin/login', data),
    dashboard: () => api.get('/admin/dashboard'),
    students: (params) => api.get('/admin/students', { params }),
    deleteStudent: (studentId) => api.delete(`/admin/students/${studentId}`),
    colleges: () => api.get('/admin/colleges'),
    universities: () => api.get('/admin/universities'),
    createUniversity: (data) => api.post('/admin/universities', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    createCollege: (data) => api.post('/admin/colleges', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    createCourse: (data) => api.post('/admin/courses', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    quizzes: () => api.get('/admin/quizzes'),
    getQuiz: (id) => api.get(`/admin/quizzes/${id}`),
    createQuiz: (data) => api.post('/admin/quizzes', data),
    updateQuiz: (quizId, data) => api.patch(`/admin/quizzes/${quizId}`, data),
    deleteQuiz: (quizId) => api.delete(`/admin/quizzes/${quizId}`),
    createContent: (formData) =>
        api.post('/admin/content', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),
    presignContentUpload: (data) => api.post('/admin/content/presign-upload', data),
    createModule: (formData) =>
        api.post('/admin/modules', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),
    updateModule: (moduleId, data) => api.patch(`/admin/modules/${moduleId}`, data),
    deleteModule: (moduleId) => api.delete(`/admin/modules/${moduleId}`),
    updateModuleContent: (moduleId, contentId, data) =>
        api.patch(`/admin/modules/${moduleId}/contents/${contentId}`, data),
    deleteModuleContent: (moduleId, contentId) =>
        api.delete(`/admin/modules/${moduleId}/contents/${contentId}`),
    updateModuleSectionType: (moduleId, sectionType) =>
        api.patch(`/admin/modules/${moduleId}/section-type`, { section_type: sectionType }),
    assignments: (params) => api.get('/admin/assignments', { params }),
    assignmentStats: () => api.get('/admin/assignments/stats'),
    gradeAssignment: (id, data) => api.put(`/admin/assignments/${id}/grade`, data),
    assignmentSections: () => api.get('/admin/assignment-sections'),
    createAssignmentSection: (data) => api.post('/admin/assignment-sections', data),
    updateAssignmentSection: (sectionId, data) => api.patch(`/admin/assignment-sections/${sectionId}`, data),
    deleteAssignmentSection: (sectionId) => api.delete(`/admin/assignment-sections/${sectionId}`),
    uploadAssignmentQuestionsPdf: (sectionId, formData) =>
        api.post(`/admin/assignment-sections/${sectionId}/questions-pdf`, formData),
};

// Auth
export const authAPI = {
    register: (formData) => api.post('/auth/register', formData),
    login: (data) => api.post('/auth/login', data),
    logout: () => api.post('/auth/logout'),
    // Bust caches/proxies that might return another user's cached /me
    getProfile: () =>
        api.get('/auth/me', {
            params: { _: Date.now() },
            headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        }),
};

export default api;
