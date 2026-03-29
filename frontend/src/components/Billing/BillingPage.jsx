import { useState } from 'react';
import { ShieldCheck, Check, CreditCard } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function BillingPage() {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);

  const plans = [
    {
      id: 'basic',
      name: 'Starter Trader',
      price: 29,
      features: ['รันบอทสูงสุด 2 ตัว', 'อัปเดตราคาแบบ Real-time', 'อีเมลแจ้งเตือนเมื่อออเดอร์เข้า', 'ประวัติย้อนหลัง 30 วัน'],
      isPopular: false,
    },
    {
      id: 'pro',
      name: 'Pro Algo',
      price: 99,
      features: ['รันบอทสูงสุด 10 ตัว', 'รวมฟีเจอร์ Starter Trader', 'ดึงสัญญาณ TradingView Webhook', 'Line Notify เรียลไทม์', 'ประวัติเข้าใช้งานไม่จำกัด (Archive)'],
      isPopular: true,
    },
    {
      id: 'enterprise',
      name: 'White-label / B2B',
      price: 199,
      features: ['รันบอทไม่จำกัด', 'ตั้งค่าทีมและหัวหน้างาน (RBAC)', 'เชื่อม API Key หลายพอร์ต', 'ปรับแต่งสีธีม-โลโก้ของตัวเอง', 'ทีมซัพพอร์ตระดับ Priority'],
      isPopular: false,
    }
  ];

  const handleUpgrade = async (plan) => {
    const confirmMsg = `ยืนยันการทำรายการ: อัปเกรดเป็น ${plan.name} ในราคา $${plan.price} USDT ต่อเดือน ใช่หรือไม่?`;
    if (!await window.customConfirm(confirmMsg)) return;

    setProcessing(true);
    try {
      const res = await api.upgradeSubscription({ planId: plan.id });
      if (res.success) {
        alert(res.message);
        // Page refresh to refetch user context if role changed
        if (plan.id === 'enterprise') window.location.reload();
      }
    } catch (err) {
      alert(err.message || 'เกิดข้อผิดพลาดในการชำระเงิน กรุณาเติมเงิน USDT ให้เพียงพอ');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title">แพ็กเกจสมาชิก (Billing & Memberships)</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
            ยกระดับพลังการเทรดของคุณด้วยเซิร์ฟเวอร์ความเร็วสูง และบอทอัจฉริยะ (สถานะ: {user?.role})
          </p>
        </div>
      </div>

      <div className="content-area">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 'var(--space-xl)'
        }}>
          {plans.map(plan => (
            <div key={plan.id} className="summary-card" style={{ 
              position: 'relative', 
              padding: 'var(--space-xl)', 
              border: plan.isPopular ? '2px solid var(--accent-primary)' : '1px solid var(--border-primary)',
              transform: plan.isPopular ? 'translateY(-10px)' : 'none',
              boxShadow: plan.isPopular ? '0 20px 40px rgba(0,255,136,0.1)' : 'none',
              zIndex: plan.isPopular ? 2 : 1
            }}>
              {plan.isPopular && (
                <div style={{
                  position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--accent-primary)', color: '#000', padding: '2px 16px',
                  borderRadius: 20, fontSize: 12, fontWeight: 700, letterSpacing: 1
                }}>
                  ยอดนิยมที่สุด (POPULAR)
                </div>
              )}
              
              <h3 style={{ fontSize: 20, marginBottom: 8, color: plan.isPopular ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{plan.name}</h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 32 }}>
                <span style={{ fontSize: 40, fontWeight: 700 }}>${plan.price}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>/ เดือน</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
                {plan.features.map((feat, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <Check size={18} style={{ color: 'var(--profit)', flexShrink: 0, marginTop: 2 }} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{feat}</span>
                  </div>
                ))}
              </div>

              <button 
                className="btn" 
                disabled={processing}
                onClick={() => handleUpgrade(plan)}
                style={{ 
                  width: '100%', 
                  background: plan.isPopular ? 'var(--gradient-primary)' : 'transparent',
                  color: plan.isPopular ? '#000' : 'var(--text-primary)',
                  border: plan.isPopular ? 'none' : '1px solid var(--border-primary)',
                  height: 48,
                  fontSize: 16,
                  fontWeight: 600
                }}
              >
                <CreditCard size={18} style={{ marginRight: 8 }} />
                อัปเกรดเป็น {plan.name}
              </button>
            </div>
          ))}
        </div>
        
        <div style={{ marginTop: 'var(--space-2xl)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <ShieldCheck size={16} /> รองรับการชำระเงินผ่านบัตรเครดิต, พร้อมเพย์, และคริปโต (USDT)
        </div>
      </div>
    </>
  );
}
