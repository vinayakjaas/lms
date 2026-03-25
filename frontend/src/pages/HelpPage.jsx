import { Mail, Phone, MapPin, MessageCircle, FileText, ExternalLink } from 'lucide-react';

export default function HelpPage() {
    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div><h1 className="page-title">Help Desk</h1><p className="page-subtitle">Need assistance? We're here to help!</p></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                {[
                    { icon: Mail, label: 'Email Support', value: 'support@aiugip.in', desc: 'Get response within 24 hours', color: '#4f46e5' },
                    { icon: Phone, label: 'Phone Support', value: '+91-XXXX-XXXXXX', desc: 'Mon–Sat, 10:00 AM – 6:00 PM', color: '#10b981' },
                    { icon: MapPin, label: 'Office', value: 'Bihar Vidyapeet, Patna', desc: 'TADRI Research Center', color: '#f59e0b' },
                ].map((item, i) => (
                    <div key={i} className="glass-card" style={{ padding: '24px' }}>
                        <item.icon size={24} style={{ color: item.color, marginBottom: '12px' }} />
                        <h3 style={{ fontSize: '1rem', marginBottom: '4px' }}>{item.label}</h3>
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>{item.value}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.desc}</div>
                    </div>
                ))}
            </div>

            <h3 style={{ marginBottom: '16px' }}>Frequently Asked Questions</h3>
            {[
                { q: 'How long is the internship program?', a: 'The AIUGIP internship program is 120 hours in duration.' },
                { q: 'What is the passing grade?', a: 'You need a minimum grade of D (50% or above) to receive a certificate.' },
                { q: 'Can I retake the quiz?', a: 'Yes, you have up to 3 attempts for the final assessment quiz. The best score is considered.' },
                { q: 'How is my grade calculated?', a: 'Your grade is calculated based on: Quiz (30%), Assignment (30%), and Attendance/Content Completion (40%).' },
                { q: 'How do I verify my certificate?', a: 'Each certificate has a unique QR code. Scanning it will show the verification page with your details.' },
                { q: 'When will I receive my certificate?', a: 'You can download your certificate immediately after completing all requirements and passing the assessment.' },
            ].map((item, i) => (
                <details key={i} className="glass-card" style={{ padding: '16px 20px', marginBottom: '10px', cursor: 'pointer' }}>
                    <summary style={{ fontWeight: '600', fontSize: '0.95rem', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MessageCircle size={16} style={{ color: 'var(--primary-400)' }} /> {item.q}
                    </summary>
                    <p style={{ marginTop: '12px', color: 'var(--text-secondary)', fontSize: '0.9rem', paddingLeft: '24px' }}>{item.a}</p>
                </details>
            ))}

            <div className="glass-card" style={{ padding: '24px', marginTop: '24px' }}>
                <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={18} /> Important Documents
                </h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {['Internship Guidelines', 'Terms & Conditions', 'Privacy Policy'].map((doc, i) => (
                        <a key={i} href="#" className="btn btn-secondary btn-sm">
                            <ExternalLink size={14} /> {doc}
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
}
