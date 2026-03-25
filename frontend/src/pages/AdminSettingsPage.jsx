import { useState } from 'react';
import { Settings, Bell, Shield, Globe, Database, HelpCircle } from 'lucide-react';

export default function AdminSettingsPage() {
    const [activeTab, setActiveTab] = useState('general');

    const tabs = [
        { id: 'general', label: 'General', icon: Settings },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'integrations', label: 'Integrations', icon: Globe },
    ];

    return (
        <div className="animate-fadeIn">
            <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>SYSTEM CONFIGURATION</div>
                <h1 style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a' }}>Admin Settings</h1>
                <p style={{ fontSize: '0.92rem', color: '#64748b' }}>Manage platform settings, notifications, and security.</p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid #f1f5f9', marginBottom: '28px', overflowX: 'auto' }}>
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                        padding: '12px 20px', fontSize: '0.88rem', fontWeight: '500', cursor: 'pointer',
                        background: 'none', border: 'none', color: activeTab === t.id ? '#0f172a' : '#94a3b8',
                        borderBottom: activeTab === t.id ? '2px solid #0f172a' : '2px solid transparent',
                        marginBottom: '-2px', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap',
                    }}>
                        <t.icon size={16} /> {t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'general' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', maxWidth: '700px' }}>
                    <div className="glass-card" style={{ padding: '28px' }}>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', marginBottom: '18px' }}>Platform Information</h3>
                        {[
                            { label: 'Platform Name', value: 'AIUGIP Admin Portal', type: 'text' },
                            { label: 'Admin Email', value: 'admin@aiugip.edu.in', type: 'email' },
                            { label: 'Maximum Batch Size', value: '1000', type: 'number' },
                            { label: 'Internship Duration (Hours)', value: '120', type: 'number' },
                        ].map((f, i) => (
                            <div key={i} style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>{f.label}</label>
                                <input type={f.type} defaultValue={f.value}
                                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', background: '#f8fafc', outline: 'none' }}
                                />
                            </div>
                        ))}
                        <button className="btn" style={{ background: '#0f172a', color: 'white', padding: '10px 24px', borderRadius: '10px', fontWeight: '700', fontSize: '0.88rem', marginTop: '8px' }}>Save Changes</button>
                    </div>

                    <div className="glass-card" style={{ padding: '28px' }}>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Database size={18} style={{ color: '#4f46e5' }} /> Data Management
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <button className="btn" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', padding: '14px', borderRadius: '10px', fontWeight: '600', fontSize: '0.85rem' }}>Export All Data</button>
                            <button className="btn" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', padding: '14px', borderRadius: '10px', fontWeight: '600', fontSize: '0.85rem' }}>Import Students</button>
                            <button className="btn" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', padding: '14px', borderRadius: '10px', fontWeight: '600', fontSize: '0.85rem' }}>Backup Database</button>
                            <button className="btn" style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626', padding: '14px', borderRadius: '10px', fontWeight: '600', fontSize: '0.85rem' }}>Reset Demo Data</button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab !== 'general' && (
                <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
                    <HelpCircle size={48} style={{ color: '#cbd5e1', margin: '0 auto 16px' }} />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>{tabs.find(t => t.id === activeTab)?.label} Settings</h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>This section is under development. Check back soon.</p>
                </div>
            )}
        </div>
    );
}
