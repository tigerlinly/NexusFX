import { useState, useEffect } from 'react';
import { Shield, Save, DollarSign, Wallet, Building, AlertTriangle } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminBillingPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    STRIPE_PUBLISHABLE_KEY: '',
    STRIPE_SECRET_KEY: '',
    STRIPE_WEBHOOK_SECRET: '',
    CRYPTO_WALLET_ADDRESS: '',
    BANK_ACCOUNT_INFO: '',
    PROMPTPAY_ID: '',
    PAYMENT_ENABLED: 'false'
  });

  const fetchConfig = async () => {
    try {
      const data = await api.getSystemConfig();
      setFormData(prev => {
        const newForm = { ...prev };
        data.forEach(item => {
          if (item.key in newForm) {
            newForm[item.key] = item.value;
          }
        });
        return newForm;
      });
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
            {/* 1. Payment System Switch */}
            <div className="form-group" style={{ marginBottom: 24, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 8, border: '1px solid var(--border-primary)' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15 }}>
                เปิด/ปิด ระบบชำระเงิน (Payment Gateway)
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {['true', 'false'].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, PAYMENT_ENABLED: val }))}
                    style={{
                      padding: '8px 24px', borderRadius: 'var(--radius-sm)',
                      border: formData.PAYMENT_ENABLED === val ? `2px solid ${val === 'true' ? 'var(--profit)' : 'var(--loss)'}` : '1px solid var(--border-primary)',
                      background: formData.PAYMENT_ENABLED === val ? (val === 'true' ? 'rgba(0,200,150,0.1)' : 'rgba(255,71,87,0.1)') : 'transparent',
                      color: formData.PAYMENT_ENABLED === val ? (val === 'true' ? 'var(--profit)' : 'var(--loss)') : 'var(--text-secondary)',
                      cursor: 'pointer', fontWeight: formData.PAYMENT_ENABLED === val ? 600 : 400, fontSize: 14
                    }}
                  >
                    {val === 'true' ? 'เปิด (ON)' : 'ปิด (OFF)'}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Stripe Config */}
            <div className="form-group" style={{ marginBottom: 24, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 8, border: '1px solid var(--border-primary)' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, marginBottom: 16 }}>
                <Wallet size={16} style={{ color: '#6366f1' }}/>
                ระบบชำระเงินด้วยบัตรเครดิต (Stripe API)
              </label>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Stripe Publishable Key</label>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>โชว์ในฝั่งหน้าเว็บ (Frontend) ขึ้นต้นด้วย pk_live_ หรือ pk_test_</p>
                  <input 
                    type="text" 
                    className="form-input" 
                    name="STRIPE_PUBLISHABLE_KEY"
                    value={formData.STRIPE_PUBLISHABLE_KEY}
                    onChange={handleChange}
                    placeholder="pk_live_... หรือ pk_test_..."
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Stripe Secret Key</label>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>ใช้ยืนยันการทำธุรกรรมหลังบ้าน ขึ้นต้นด้วย sk_live_ หรือ sk_test_</p>
                  <input 
                    type="password" 
                    className="form-input" 
                    name="STRIPE_SECRET_KEY"
                    value={formData.STRIPE_SECRET_KEY}
                    onChange={handleChange}
                    placeholder="sk_live_... หรือ sk_test_..."
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Stripe Webhook Signing Secret</label>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>ใช้ตรวจสอบข้อมูล Webhook จาก Stripe ขึ้นต้นด้วย whsec_...</p>
                  <input 
                    type="password" 
                    className="form-input" 
                    name="STRIPE_WEBHOOK_SECRET"
                    value={formData.STRIPE_WEBHOOK_SECRET}
                    onChange={handleChange}
                    placeholder="whsec_..."
                  />
                </div>
              </div>

              <div style={{ marginTop: 16, fontSize: 12, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={12}/> หมายเหตุ: การสร้างและแก้ไข Secret/Webhook ต้องทำการ Restart Backend ให้ระบบอ่านค่าใหม่
              </div>
            </div>

            {/* 3. PromptPay */}
            <div className="form-group" style={{ marginBottom: 24, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 8, border: '1px solid var(--border-primary)' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15 }}>
                <DollarSign size={16} style={{ color: '#115293' }}/>
                ระบบรับชำระเงินโอนพร้อมเพย์ (PromptPay)
              </label>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>ลูกค้าจะสแกน QR Code แล้วโอนเงินเข้ามา</p>
              <input 
                type="text" 
                className="form-input" 
                name="PROMPTPAY_ID"
                value={formData.PROMPTPAY_ID}
                onChange={handleChange}
                placeholder="เบอร์โทรศัพท์ หรือ เลขบัตรประชาชน เช่น 0812345678"
              />
            </div>

            {/* 4. Crypto */}
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

            {/* 5. Bank Account */}
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
