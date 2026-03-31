import { useState, useEffect } from 'react';
import { Shield, Save, DollarSign, Wallet, Building, AlertTriangle } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminBillingPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    STRIPE_SECRET_KEY: '',
    CRYPTO_WALLET_ADDRESS: '',
    BANK_ACCOUNT_INFO: ''
  });

  const fetchConfig = async () => {
    try {
      const data = await api.getSystemConfig();
      setConfig(data);
      const newForm = { ...formData };
      data.forEach(item => {
        newForm[item.key] = item.value;
      });
      setFormData(newForm);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(formData)) {
        await api.updateSystemConfig({ key, value });
      }
      alert('บันทึกการตั้งค่าการรับเงินเรียบร้อยแล้ว');
      fetchConfig();
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="content-area">
        <div className="chart-card" style={{ textAlign: 'center', padding: 60 }}>
           <h2 style={{ color: 'var(--loss)' }}>ไม่มีสิทธิ์เข้าถึง</h2>
        </div>
      </div>
    );
  }

  if (loading) return <div className="content-area">กำลังโหลดข้อมูล...</div>;

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign size={20} style={{ color: 'var(--profit)' }} />
            การจัดการบัญชีรับเงิน (Admin)
          </h1>
        </div>
      </div>

      <div className="content-area">
        <div className="chart-card" style={{ maxWidth: 800 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>บัญชีรับค่าบริการและส่วนแบ่งกำไร (System Wallet)</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
              ระบบ NexusFX มีการเก็บค่าบริการแยกจากบัญชีเทรดโบรกเกอร์ (Broker Account) ของผู้ใช้
              <br/>เงินที่ผู้ใช้ฝากเข้ามาจะถูกส่งตรงไปที่บัญชีหรือช่องทางที่คุณกำหนดไว้ในหน้านี้
              <br/>จากนั้นระบบจะบวกยอดเป็น <b>"เครดิต (USD)" </b>ใน System Wallet ของผู้ใช้
            </p>
          </div>

          <form onSubmit={handleSave}>
            <div className="form-group" style={{ marginBottom: 24, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 8, border: '1px solid var(--border-primary)' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15 }}>
                <Wallet size={16} style={{ color: '#6366f1' }}/>
                Stripe Secret Key (บัตรเครดิต)
              </label>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>ใช้สำหรับการรับชำระผ่านบัตรเครดิต โดยจะต้องใช้ Secret Key จากแผงควบคุมของ Stripe</p>
              <input 
                type="password" 
                className="form-input" 
                name="STRIPE_SECRET_KEY"
                value={formData.STRIPE_SECRET_KEY}
                onChange={handleChange}
                placeholder="sk_live_... หรือ sk_test_..."
              />
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={12}/> หมายเหตุ: การสร้างและแก้ไขต้องทำการ Restart Backend ให้ระบบอ่านค่าใหม่ (ในเวอร์ชันปัจจุบัน)
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 24, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 8, border: '1px solid var(--border-primary)' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15 }}>
                <DollarSign size={16} style={{ color: 'var(--accent-secondary)' }}/>
                กระเป๋าเงินคริปโต (TRC20 USD หรือ USDT)
              </label>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>ใช้สำหรับแสดงที่อยู่ในการโอนเงินให้ลูกค้า (กรณีเติมเงินแบบ Manual)</p>
              <input 
                type="text" 
                className="form-input" 
                name="CRYPTO_WALLET_ADDRESS"
                value={formData.CRYPTO_WALLET_ADDRESS}
                onChange={handleChange}
                placeholder="T..."
              />
            </div>

            <div className="form-group" style={{ marginBottom: 24, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 8, border: '1px solid var(--border-primary)' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15 }}>
                <Building size={16} style={{ color: 'var(--text-secondary)' }}/>
                ข้อมูลบัญชีธนาคาร (Bank Transfer)
              </label>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>แสดงในหน้าฝากเงินให้ลูกค้าโอนเข้าบัญชีส่วนกลาง</p>
              <input 
                type="text" 
                className="form-input" 
                name="BANK_ACCOUNT_INFO"
                value={formData.BANK_ACCOUNT_INFO}
                onChange={handleChange}
                placeholder="เช่น ธ.กสิกรไทย 123-4-56789-0 (บริษัท เน็กซัส เอฟเอ็กซ์)"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Save size={16}/> {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่ารับเงิน'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
