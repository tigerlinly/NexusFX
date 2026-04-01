import { useState, useEffect } from 'react';
import { ShieldCheck, Check, CreditCard, Loader2, Crown, Clock, AlertTriangle } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function BillingPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [plansData, current] = await Promise.all([
          api.getPlans(),
          api.getCurrentPlan(),
        ]);
        setPlans(plansData);
        setCurrentPlan(current);
      } catch (err) {
        console.error('Failed to load plans:', err);
        setPlans([]); // Fetch failed, fallback to empty to enforce DB-only plans.
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleUpgrade = async (plan) => {
    const confirmMsg = `ยืนยันการทำรายการ: อัปเกรดเป็น ${plan.plan_name} ในราคา $${plan.monthly_price} USD ต่อเดือน ใช่หรือไม่?`;
    if (!await window.customConfirm(confirmMsg)) return;

    setProcessing(true);
    try {
      const res = await api.upgradeSubscription({ planId: plan.plan_key });
      if (res.success) {
        alert(res.message);
        // Refresh current plan
        const updated = await api.getCurrentPlan();
        setCurrentPlan(updated);
      }
    } catch (err) {
      alert(err.message || 'เกิดข้อผิดพลาดในการชำระเงิน กรุณาเติมเงิน USD ให้เพียงพอ');
    } finally {
      setProcessing(false);
    }
  };

  const getFeatures = (plan) => {
    if (Array.isArray(plan.features)) return plan.features;
    try { return JSON.parse(plan.features); } catch { return []; }
  };

  const getDaysRemaining = () => {
    if (!currentPlan?.plan_expires_at) return null;
    const now = new Date();
    const exp = new Date(currentPlan.plan_expires_at);
    const diff = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const daysLeft = getDaysRemaining();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: 'var(--text-tertiary)' }}>
        <Loader2 size={24} className="spin" style={{ marginRight: 8 }} /> กำลังโหลดแพ็กเกจ...
      </div>
    );
  }

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
        {/* Current Plan Card */}
        <div className="chart-card" style={{ marginBottom: 'var(--space-xl)', padding: 'var(--space-xl)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: currentPlan?.plan_key === 'free' ? 'rgba(100,100,100,0.15)' :
                  currentPlan?.plan_key === 'basic' ? 'rgba(0,200,150,0.12)' :
                  currentPlan?.plan_key === 'pro' ? 'rgba(139,92,246,0.15)' :
                  'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,140,0,0.2))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${
                  currentPlan?.plan_key === 'free' ? 'var(--border-primary)' :
                  currentPlan?.plan_key === 'basic' ? 'var(--accent-primary)' :
                  currentPlan?.plan_key === 'pro' ? 'var(--accent-tertiary)' :
                  '#FFD700'
                }40`
              }}>
                <Crown size={28} style={{
                  color: currentPlan?.plan_key === 'free' ? 'var(--text-tertiary)' :
                    currentPlan?.plan_key === 'basic' ? 'var(--accent-primary)' :
                    currentPlan?.plan_key === 'pro' ? 'var(--accent-tertiary)' :
                    '#FFD700'
                }} />
              </div>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 4 }}>แพ็คเกจปัจจุบัน</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {currentPlan?.plan_name || 'Free Trial'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 2 }}>ราคา</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-primary)' }}>
                  ${currentPlan?.monthly_price || 0}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>/เดือน</span>
                </div>
              </div>

              {daysLeft !== null && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 2 }}>เหลืออีก</div>
                  <div style={{
                    fontSize: 20, fontWeight: 700,
                    color: daysLeft <= 0 ? 'var(--loss)' : daysLeft <= 7 ? '#F59E0B' : 'var(--profit)'
                  }}>
                    {daysLeft <= 0 ? 'หมดอายุ' : `${daysLeft} วัน`}
                  </div>
                </div>
              )}

              {currentPlan?.plan_expires_at && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                    {daysLeft <= 0 ? 'หมดอายุเมื่อ' : 'หมดอายุ'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, color: 'var(--text-secondary)' }}>
                    <Clock size={14} />
                    {new Date(currentPlan.plan_expires_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {daysLeft !== null && daysLeft <= 7 && daysLeft > 0 && (
            <div style={{
              marginTop: 16, padding: '10px 16px', borderRadius: 8,
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
              color: '#F59E0B', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8
            }}>
              <AlertTriangle size={16} /> แพ็คเกจของคุณจะหมดอายุใน {daysLeft} วัน กรุณาต่ออายุเพื่อใช้งานต่อ
            </div>
          )}
          {daysLeft !== null && daysLeft <= 0 && (
            <div style={{
              marginTop: 16, padding: '10px 16px', borderRadius: 8,
              background: 'var(--loss-bg)', border: '1px solid rgba(239,68,68,0.3)',
              color: 'var(--loss)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8
            }}>
              <AlertTriangle size={16} /> แพ็คเกจของคุณหมดอายุแล้ว กรุณาอัปเกรดเพื่อใช้งานต่อ
            </div>
          )}
        </div>

        {/* Plan Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 'var(--space-xl)'
        }}>
          {plans.map(plan => {
            const features = getFeatures(plan);
            const isCurrentPlan = currentPlan?.plan_key === plan.plan_key && daysLeft > 0;
            return (
              <div key={plan.plan_key || plan.id} className="summary-card" style={{ 
                position: 'relative', 
                padding: 'var(--space-xl)', 
                border: isCurrentPlan ? '2px solid var(--accent-primary)' :
                  plan.is_popular ? '2px solid var(--accent-tertiary)' : '1px solid var(--border-primary)',
                transform: plan.is_popular ? 'translateY(-10px)' : 'none',
                boxShadow: plan.is_popular ? '0 20px 40px rgba(0,255,136,0.1)' : 'none',
                zIndex: plan.is_popular ? 2 : 1
              }}>
                {isCurrentPlan && (
                  <div style={{
                    position: 'absolute', top: -14, right: 16,
                    background: 'var(--accent-primary)', color: '#000', padding: '2px 12px',
                    borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: 0.5
                  }}>
                    ✓ ใช้งานอยู่
                  </div>
                )}
                {plan.is_popular && !isCurrentPlan && (
                  <div style={{
                    position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--accent-tertiary)', color: '#FFF', padding: '2px 16px',
                    borderRadius: 20, fontSize: 12, fontWeight: 700, letterSpacing: 1
                  }}>
                    ยอดนิยมที่สุด (POPULAR)
                  </div>
                )}
                
                <h3 style={{ fontSize: 20, marginBottom: 8, color: isCurrentPlan ? 'var(--accent-primary)' : plan.is_popular ? 'var(--accent-tertiary)' : 'var(--text-primary)' }}>{plan.plan_name}</h3>
                {plan.description && (
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 12 }}>{plan.description}</p>
                )}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 32 }}>
                  <span style={{ fontSize: 40, fontWeight: 700 }}>${plan.monthly_price}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>/ เดือน</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
                  {features.map((feat, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <Check size={18} style={{ color: 'var(--profit)', flexShrink: 0, marginTop: 2 }} />
                      <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{feat}</span>
                    </div>
                  ))}
                </div>

                <button 
                  className="btn" 
                  disabled={processing || isCurrentPlan}
                  onClick={() => handleUpgrade(plan)}
                  style={{ 
                    width: '100%', 
                    background: isCurrentPlan ? 'rgba(0,200,150,0.15)' :
                      plan.is_popular ? 'var(--gradient-primary)' : 'transparent',
                    color: isCurrentPlan ? 'var(--accent-primary)' :
                      plan.is_popular ? '#000' : 'var(--text-primary)',
                    border: isCurrentPlan ? '1px solid var(--accent-primary)' :
                      plan.is_popular ? 'none' : '1px solid var(--border-primary)',
                    height: 48,
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: isCurrentPlan ? 'default' : 'pointer',
                    opacity: isCurrentPlan ? 0.8 : 1,
                  }}
                >
                  {isCurrentPlan ? (
                    <><Check size={18} style={{ marginRight: 8 }} /> กำลังใช้งานแพ็คเกจนี้</>
                  ) : (
                    <><CreditCard size={18} style={{ marginRight: 8 }} /> อัปเกรดเป็น {plan.plan_name}</>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        
        <div style={{ marginTop: 'var(--space-2xl)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <ShieldCheck size={16} /> รองรับการชำระเงินผ่านบัตรเครดิต, พร้อมเพย์, และคริปโต (USD)
        </div>
      </div>
    </>
  );
}
