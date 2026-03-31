import { useState } from 'react';
import { api } from '../../utils/api';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');
    
    try {
      await api.forgotPassword({ email });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      padding: 'var(--space-md)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: 'var(--bg-card)',
        padding: 'var(--space-xl)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-primary)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
          <div className="sidebar-logo" style={{ width: 64, height: 64, fontSize: 28, margin: '0 auto var(--space-md)' }}>N</div>
          <h1 style={{ fontSize: 24, margin: '0 0 8px 0', fontFamily: 'var(--font-sans)' }}>ลืมรหัสผ่าน?</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: 0 }}>
            กรอกอีเมลของคุณเพื่อรับลิงก์สำหรับตั้งค่ารหัสผ่านใหม่
          </p>
        </div>

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

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: 'var(--profit-bg)', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-md)' }}>
              <CheckCircle size={32} color="var(--profit)" />
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-xl)' }}>
              เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปที่ <strong>{email}</strong> แล้ว โปรดตรวจสอบกล่องข้อความของคุณ
            </p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/login')}>
              กลับไปหน้าเข้าสู่ระบบ
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  style={{ paddingLeft: 40 }}
                />
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            <button className="btn btn-primary btn-lg" type="submit" disabled={loading}
              style={{ width: '100%', marginTop: 'var(--space-sm)' }}>
              {loading ? 'กำลังดำเนินการ...' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
            </button>
          </form>
        )}

        {!success && (
          <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'none', border: 'none', color: 'var(--text-tertiary)',
                cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '0 auto'
              }}
            >
              <ArrowLeft size={14} /> กลับไปหน้าเข้าสู่ระบบ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
