import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', email: '', password: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await register(form.username, form.email, form.password);
      } else {
        await login(form.username, form.password);
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-lg)' }}>
          <div className="sidebar-logo" style={{ width: 56, height: 56, fontSize: 24 }}>N</div>
        </div>
        <h1 className="login-title">NexusFX</h1>
        <p className="login-subtitle">
          {isRegister ? 'สร้างบัญชีใหม่เพื่อเริ่มต้น' : 'เข้าสู่ระบบ Trading Platform'}
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

          <button className="btn btn-primary btn-lg" type="submit" disabled={loading}
            style={{ width: '100%', marginTop: 'var(--space-sm)' }}>
            {loading ? 'กำลังดำเนินการ...' : (
              isRegister ? (<><UserPlus size={16} /> สมัครสมาชิก</>) : (<><LogIn size={16} /> เข้าสู่ระบบ</>)
            )}
          </button>
        </form>

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
      </div>
    </div>
  );
}
