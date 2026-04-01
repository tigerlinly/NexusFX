import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { LogIn, UserPlus, Eye, EyeOff, Handshake } from 'lucide-react';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('invite');

  const [isRegister, setIsRegister] = useState(!!inviteCode);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [showMfa, setShowMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  // Agent branding from invite code
  const [inviteBranding, setInviteBranding] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(!!inviteCode);

  // Validate invite code and get agent branding
  useEffect(() => {
    if (!inviteCode) return;
    setInviteLoading(true);
    api.validateInvite(inviteCode)
      .then(data => {
        setInviteBranding(data);
        setIsRegister(true);
      })
      .catch(() => {
        setError('ลิงก์เชิญไม่ถูกต้องหรือหมดอายุแล้ว');
      })
      .finally(() => setInviteLoading(false));
  }, [inviteCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await register(form.username, form.email, form.password, inviteCode || undefined);
        navigate('/');
      } else {
        const response = await login(form.username, form.password, mfaCode);
        if (response?.mfa_required) {
          setShowMfa(true);
          setError(''); // clear error, wait for mfa code
          return;
        }
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (inviteLoading) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div className="sidebar-logo" style={{ width: 56, height: 56, fontSize: 24, margin: '0 auto var(--space-lg)' }}>N</div>
          <div style={{ color: 'var(--text-tertiary)' }}>กำลังตรวจสอบลิงก์เชิญ...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Agent Branding Banner */}
        {inviteBranding && (
          <div style={{
            background: `linear-gradient(135deg, ${inviteBranding.primary_color || 'var(--accent-primary)'}22, transparent)`,
            border: `1px solid ${inviteBranding.primary_color || 'var(--accent-primary)'}44`,
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: 'var(--space-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            {inviteBranding.logo_url ? (
              <img src={inviteBranding.logo_url} alt="" style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                background: inviteBranding.primary_color || 'var(--accent-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 16,
              }}>
                <Handshake size={18} />
              </div>
            )}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {inviteBranding.platform_name || inviteBranding.tenant_name || 'Agent Partner'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                คุณได้รับเชิญให้เข้าร่วมทีม
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-lg)' }}>
          <div className="sidebar-logo" style={{ width: 56, height: 56, fontSize: 24 }}>N</div>
        </div>
        <h1 className="login-title">NexusFX</h1>
        <p className="login-subtitle">
          {inviteBranding
            ? `สมัครสมาชิกเข้าร่วมทีม ${inviteBranding.platform_name || ''}`
            : isRegister ? 'สร้างบัญชีใหม่เพื่อเริ่มต้น' : 'เข้าสู่ระบบ Trading Platform'}
        </p>

        {error && (
          <div style={{
            padding: 'var(--space-sm) var(--space-md)',
            background: 'var(--loss-bg)',
            border: '1px solid var(--loss)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--loss)',
            fontSize: 12,
            marginBottom: 'var(--space-md)',
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          {!showMfa ? (
            <>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="ชื่อผู้ใช้"
                  value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  required
                />
              </div>

              {isRegister && (
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    className="form-input"
                    type="email"
                    placeholder="email@example.com"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="รหัสผ่าน"
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    required
                    style={{ width: '100%', paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {!isRegister && (
                <div style={{ textAlign: 'right', marginTop: 8, marginBottom: 16 }}>
                  <button
                    type="button"
                    onClick={() => window.location.href = '/forgot-password'}
                    style={{
                      background: 'none', border: 'none', color: 'var(--text-tertiary)',
                      cursor: 'pointer', fontSize: 13, textDecoration: 'underline'
                    }}
                  >
                    ลืมรหัสผ่าน?
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <LogIn size={14} /> รหัส 2FA (Authenticator)
              </label>
              <input
                className="form-input"
                type="text"
                placeholder="กรอก 6 หลัก"
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value)}
                maxLength={6}
                required
                autoFocus
              />
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => { setShowMfa(false); setMfaCode(''); setError(''); }}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-tertiary)',
                    cursor: 'pointer', fontSize: 13, textDecoration: 'underline'
                  }}
                >
                  ย้อนกลับ
                </button>
              </div>
            </div>
          )}

          <button className="btn btn-primary btn-lg" type="submit" disabled={loading}
            style={{ width: '100%', marginTop: 'var(--space-sm)' }}>
            {loading ? 'กำลังดำเนินการ...' : (
              showMfa ? 'ยืนยันรหัส 2FA' : isRegister ? (<><UserPlus size={16} /> สมัครสมาชิก</>) : (<><LogIn size={16} /> เข้าสู่ระบบ</>)
            )}
          </button>
        </form>

        {!showMfa && !inviteCode && (
          <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
            <button
              onClick={() => { setIsRegister(p => !p); setError(''); }}
              style={{
                background: 'none', border: 'none', color: 'var(--accent-primary)',
                cursor: 'pointer', fontSize: 13
              }}
            >
              {isRegister ? 'มีบัญชีแล้ว? เข้าสู่ระบบ' : 'ยังไม่มีบัญชี? สมัครสมาชิก'}
            </button>
          </div>
        )}

        {inviteCode && !isRegister && (
          <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
            <button
              onClick={() => setIsRegister(true)}
              style={{
                background: 'none', border: 'none', color: 'var(--accent-primary)',
                cursor: 'pointer', fontSize: 13
              }}
            >
              ยังไม่มีบัญชี? สมัครสมาชิกผ่านลิงก์เชิญ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
