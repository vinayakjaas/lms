import { useState, useEffect } from 'react';
import { certAPI, courseAPI, authAPI } from '../services/api';
import { Award, Download, CheckCircle, XCircle, Share2, Star, Send, Shield, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

function useWindowWidth() {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => { const h = () => setWidth(window.innerWidth); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h); }, []);
    return width;
}

export default function CertificatePage() {
    const w = useWindowWidth();
    const isMobile = w <= 768;
    const isSmall = w <= 480;
    const [certificates, setCertificates] = useState([]);
    const [eligibility, setEligibility] = useState(null);
    const [courseId, setCourseId] = useState(null);
    const [profile, setProfile] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [feedback, setFeedback] = useState({ rating: 5, comments: '' });
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [courses, profileRes] = await Promise.all([courseAPI.list(), authAPI.getProfile().catch(() => ({ data: {} }))]);
            setProfile(profileRes.data);
            if (courses.data.length > 0) {
                const cid = courses.data[0].id;
                setCourseId(cid);
                const [certsRes, eligRes] = await Promise.all([certAPI.my(), certAPI.eligibility(cid).catch(() => null)]);
                setCertificates(certsRes.data);
                if (eligRes) setEligibility(eligRes.data);
            }
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try { const res = await certAPI.generate(courseId); setCertificates([res.data]); toast.success('Certificate generated! 🎉'); } catch (err) { toast.error(err.response?.data?.detail || 'Generation failed'); }
        finally { setGenerating(false); }
    };

    const submitFeedback = async () => {
        try {
            await certAPI.submitFeedback({ course_id: courseId, rating: feedback.rating, comments: feedback.comments });
            setFeedbackSubmitted(true); toast.success('Feedback submitted! 🙏');
            const eligRes = await certAPI.eligibility(courseId).catch(() => null);
            if (eligRes) setEligibility(eligRes.data);
        } catch (err) { toast.error('Feedback already submitted or error'); }
    };

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

    const cert = certificates[0];
    const studentName = profile?.name || cert?.student_name || 'Student';

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-start', marginBottom: isMobile ? '20px' : '28px', flexDirection: isMobile ? 'column' : 'row', gap: '14px' }}>
                <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#d1fae5', color: '#065f46', fontSize: '0.65rem', fontWeight: '700', padding: '4px 12px', borderRadius: '20px', marginBottom: '10px', textTransform: 'uppercase' }}>
                        <Shield size={12} /> VERIFIED AUTHENTICITY
                    </div>
                    <h1 style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>Academic Credential</h1>
                    <p style={{ fontSize: isMobile ? '0.85rem' : '0.95rem', color: '#64748b', maxWidth: '450px', lineHeight: '1.6' }}>
                        This digital certificate verifies completion of the National Internship Program.
                    </p>
                </div>
                {cert && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <a href={`http://localhost:8000${cert.pdf_url}`} target="_blank" className="btn" style={{
                            background: '#0f172a', color: 'white', padding: isMobile ? '10px 16px' : '12px 24px',
                            borderRadius: '10px', fontWeight: '700', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px',
                        }}><Download size={14} /> Download PDF</a>
                        <button className="btn" style={{
                            background: 'white', color: '#0f172a', padding: isMobile ? '10px 16px' : '12px 24px',
                            borderRadius: '10px', fontWeight: '600', fontSize: '0.82rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '6px',
                        }}><Share2 size={14} /> Share</button>
                    </div>
                )}
            </div>

            {/* Feedback Section */}
            {!feedbackSubmitted && !cert && (
                <div className="glass-card" style={{ padding: isMobile ? '20px' : '28px', marginBottom: '24px' }}>
                    <h3 style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }}>
                        <Star size={18} style={{ color: '#f59e0b' }} /> Submit Feedback
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '14px' }}>Required for certificate generation.</p>
                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>Rating</label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            {[1, 2, 3, 4, 5].map(r => (
                                <button key={r} onClick={() => setFeedback({ ...feedback, rating: r })} style={{
                                    width: '40px', height: '40px', borderRadius: '8px', border: '1px solid #e2e8f0',
                                    background: feedback.rating >= r ? '#0f172a' : '#f8fafc', color: feedback.rating >= r ? 'white' : '#94a3b8',
                                    cursor: 'pointer', fontSize: '1rem', fontWeight: '700',
                                }}>{r}</button>
                            ))}
                        </div>
                    </div>
                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>Comments (Optional)</label>
                        <textarea className="form-input" rows={3} placeholder="Share your experience..." value={feedback.comments} onChange={(e) => setFeedback({ ...feedback, comments: e.target.value })} style={{ resize: 'vertical', borderRadius: '10px' }} />
                    </div>
                    <button className="btn" style={{ background: '#0f172a', color: 'white', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={submitFeedback}>
                        <Send size={14} /> Submit
                    </button>
                </div>
            )}

            {/* Eligibility */}
            {eligibility && !cert && (
                <div className="glass-card" style={{ padding: isMobile ? '20px' : '28px', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', marginBottom: '16px' }}>Certificate Eligibility</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                        {[
                            { label: '100% Module Completion', ok: eligibility.modules_completed },
                            { label: 'Assignment Submitted', ok: eligibility.assignment_submitted },
                            { label: 'Final Assessment Attempted', ok: eligibility.final_test_attempted },
                            { label: 'Feedback Submitted', ok: eligibility.feedback_submitted },
                        ].map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: '#f8fafc' }}>
                                {item.ok ? <CheckCircle size={18} style={{ color: '#10b981' }} /> : <XCircle size={18} style={{ color: '#ef4444' }} />}
                                <span style={{ color: item.ok ? '#0f172a' : '#94a3b8', fontWeight: '500', fontSize: '0.88rem' }}>{item.label}</span>
                            </div>
                        ))}
                    </div>
                    <button className="btn" style={{ width: '100%', background: '#10b981', color: 'white', padding: '12px', borderRadius: '10px', fontWeight: '700', fontSize: '0.92rem' }} onClick={handleGenerate} disabled={generating}>
                        {generating ? <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></span> : <><Award size={16} /> Generate Certificate</>}
                    </button>
                </div>
            )}

            {/* Certificate Display */}
            {cert && (
                <>
                    <div style={{
                        background: '#f8fafc', borderRadius: isMobile ? '14px' : '20px',
                        padding: isMobile ? '24px 16px' : '48px',
                        border: '3px solid #1e3a5f', position: 'relative', marginBottom: isMobile ? '16px' : '28px', textAlign: 'center',
                    }}>
                        {!isMobile && (
                            <div style={{ position: 'absolute', inset: '8px', border: '1px solid #cbd5e1', borderRadius: '14px', pointerEvents: 'none' }}></div>
                        )}

                        {/* TADRI | AIC */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? '12px' : '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '800', fontSize: isMobile ? '0.88rem' : '1rem', color: '#1e3a5f' }}>TADRI</span>
                            <span style={{ width: '1px', background: '#cbd5e1' }}></span>
                            <span style={{ fontWeight: '700', fontSize: isMobile ? '0.88rem' : '1rem', color: '#0f172a' }}>AIC Bihar Vidhyapeet</span>
                        </div>

                        <div style={{ fontSize: '0.6rem', fontWeight: '700', color: '#b8860b', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>
                            ALL INDIA UNDERGRADUATE INTERNSHIP PROGRAM (AIUGIP)
                        </div>

                        <h2 style={{ fontSize: isMobile ? '1.5rem' : '2.2rem', fontWeight: '800', color: '#0f172a', fontFamily: "'Outfit'", marginBottom: '14px' }}>Certificate of Completion</h2>

                        <p style={{ fontSize: isMobile ? '0.85rem' : '0.95rem', color: '#94a3b8', fontStyle: 'italic', marginBottom: '8px' }}>This is to certify that</p>

                        <h3 style={{
                            fontSize: isMobile ? '1.4rem' : '2rem', fontWeight: '700', color: '#0f172a',
                            fontFamily: "'Outfit'", marginBottom: '8px', paddingBottom: '8px',
                            borderBottom: '2px solid #e2e8f0', display: 'inline-block',
                        }}>{studentName}</h3>

                        <p style={{ fontSize: isMobile ? '0.82rem' : '0.92rem', color: '#64748b', lineHeight: '1.7', maxWidth: '520px', margin: '14px auto 18px' }}>
                            has successfully completed the intensive <strong>120-Hour National Internship Program</strong>,
                            demonstrating exceptional proficiency and dedication.
                        </p>

                        <div style={{ fontSize: '0.65rem', fontWeight: '700', color: '#b8860b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: isMobile ? '20px' : '28px' }}>
                            SPECIALIZED IN ADVANCED ARTIFICIAL INTELLIGENCE & GOVERNANCE
                        </div>

                        {/* Signatures */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? '20px' : '60px', marginBottom: '18px', flexWrap: 'wrap' }}>
                            {[
                                { label: 'EXECUTIVE DIRECTOR, TADRI', short: 'Dir.' },
                                { label: `ID: ${cert.certificate_id}`, short: 'QR', isQR: true },
                                { label: 'ACADEMIC DEAN, AIC BIHAR', short: 'Dean' },
                            ].map((s, i) => (
                                <div key={i} style={{ textAlign: 'center', flexShrink: 0 }}>
                                    <div style={{
                                        width: isMobile ? '40px' : '56px', height: isMobile ? '40px' : '56px',
                                        borderRadius: s.isQR ? '8px' : '50%', background: '#e2e8f0',
                                        margin: '0 auto 6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <span style={{ fontSize: '0.6rem', fontWeight: '700', color: '#94a3b8' }}>{s.short}</span>
                                    </div>
                                    <div style={{ fontSize: isMobile ? '0.55rem' : '0.6rem', fontWeight: '600', color: s.isQR ? '#2563eb' : '#94a3b8', textTransform: 'uppercase', maxWidth: '120px' }}>{s.label}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ fontSize: '0.68rem', color: '#cbd5e1', fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                            ISSUED ON {cert.issue_date ? new Date(cert.issue_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase() : 'PENDING'}
                        </div>
                    </div>

                    {/* Detail Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? '12px' : '16px' }}>
                        <div className="glass-card" style={{ padding: isMobile ? '16px' : '22px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <BookOpen size={16} style={{ color: '#4338ca' }} />
                                </div>
                                <span style={{ fontWeight: '700', fontSize: '0.88rem', color: '#0f172a' }}>Program Details</span>
                            </div>
                            <div style={{ fontSize: '0.6rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>DESCRIPTION</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: '500', color: '#475569', marginBottom: '8px' }}>{cert.duration || '120-Hour'} AI Governance</div>
                            <div style={{ height: '3px', background: '#2563eb', borderRadius: '2px', width: '60%' }}></div>
                        </div>

                        <div className="glass-card" style={{ padding: isMobile ? '16px' : '22px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Star size={16} style={{ color: '#d97706' }} />
                                </div>
                                <span style={{ fontWeight: '700', fontSize: '0.88rem', color: '#0f172a' }}>Academic Standing</span>
                            </div>
                            <div style={{ display: 'flex', gap: '20px' }}>
                                <div>
                                    <div style={{ fontSize: '0.6rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>FINAL GRADE</div>
                                    <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#0f172a', fontFamily: "'Outfit'" }}>{cert.grade}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.6rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>PERCENTILE</div>
                                    <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>Top 2%</div>
                                </div>
                            </div>
                        </div>

                        <div className="glass-card" style={{ padding: isMobile ? '16px' : '22px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Shield size={16} style={{ color: '#2563eb' }} />
                                </div>
                                <span style={{ fontWeight: '700', fontSize: '0.88rem', color: '#0f172a' }}>Public Registry</span>
                            </div>
                            <div style={{ fontSize: '0.6rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>REGISTRY ID</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: '700', color: '#0f172a', marginBottom: '10px', fontFamily: "'Outfit'" }}>{cert.certificate_id}</div>
                            <a href={cert.qr_code_url ? `http://localhost:8000${cert.qr_code_url}` : '#'} target="_blank" style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0f172a', textDecoration: 'underline' }}>View Blockchain Record</a>
                        </div>
                    </div>
                </>
            )}

            {/* Not eligible */}
            {!cert && !eligibility && (
                <div className="glass-card" style={{ padding: isMobile ? '40px 20px' : '60px', textAlign: 'center' }}>
                    <Award size={isMobile ? 44 : 60} style={{ color: '#cbd5e1', margin: '0 auto 16px' }} />
                    <h2 style={{ fontSize: isMobile ? '1.1rem' : '1.4rem', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Certificate Not Available Yet</h2>
                    <p style={{ color: '#94a3b8', maxWidth: '400px', margin: '0 auto', fontSize: '0.88rem' }}>Complete all modules, assignments, assessment, and feedback to unlock.</p>
                </div>
            )}
        </div>
    );
}
