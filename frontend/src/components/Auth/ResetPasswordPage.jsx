import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setError('ไม่พบ Token สำหรับรีเซ็ตรหัสผ่าน กรุณาตรวจสอบลิงก์ในอีเมลอีกครั้ง');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || password !== confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน');
      return;
    }
    if (!token) return;
    
    setLoading(true);
    setError('');
    
    try {
      await api.resetPassword({ token, newPassword: password });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: 'var(--space-md)'
    }}>
      <div style={{
        width: '100%', maxWidth: 400, background: 'var(--bg-card)',
        padding: 'var(--space-xl)', borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-primary)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
          <div className="sidebar-logo" style={{ width: 64, height: 64, fontSize: 28, margin: '0 auto var(--space-md)' }}>N</div>
          <h1 style={{ fontSize: 24, margin: '0 0 8px 0', fontFamily: 'var(--font-sans)' }}>ตั้งรหัสผ่านใหม่</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: 0 }}>
            กรุณาตั้งรหัสผ่านใหม่ เพื่อเข้าสู่ระบบ NexusFX
          </p>
        </div>

        {error && (
          <div style={{
            padding: 'var(--space-sm) var(--space-md)', background: 'var(--loss-bg)',
            border: '1px solid var(--loss)', borderRadius: 'var(--radius-md)', color: 'var(--loss)',
            fontSize: 12, marginBottom: 'var(--space-md)', textAlign: 'center',
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
              รหัสผ่านของคุณถูกเปลี่ยนเรียบร้อยแล้ว คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที
            </p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/login')}>
              เข้าสู่ระบบ
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="รหัสผ่านใหม่"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: 40 }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="ยืนยันรหัสผ่านใหม่"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  style={{ paddingRight: 40 }}
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

            <button className="btn btn-primary btn-lg" type="submit" disabled={loading || !token}
              style={{ width: '100%', marginTop: 'var(--space-sm)' }}>
              {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
