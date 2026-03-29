import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { ShieldCheck, Globe, Star, ExternalLink, Award, TrendingUp, CheckCircle2 } from 'lucide-react';

export default function BrokersPage() {
  const [brokers, setBrokers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBrokers();
  }, []);

  const fetchBrokers = async () => {
    try {
      const data = await api.getBrokers();
      setBrokers(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
               if (i < fullStars) {
        stars.push(<Star key={i} size={14} fill="#FFD700" color="#FFD700" />);
      } else if (i === fullStars && hasHalfStar) {
        // Simple half star work-around using SVG gradient or just a colored outline
        stars.push(<Star key={i} size={14} fill="currentColor" color="#FFD700" style={{ opacity: 0.5 }} />);
      } else {
        stars.push(<Star key={i} size={14} color="var(--border-primary)" />);
      }
    }
    return <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>{stars} <span style={{ marginLeft: 4, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{rating}</span></div>;
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>กำลังโหลดรายชื่อโบรกเกอร์...</div>;
  }

  if (error) {
    return <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--loss)' }}>{error}</div>;
  }

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={24} style={{ color: 'var(--accent-primary)' }} />
            โบรกเกอร์ที่ได้รับการรับรอง
          </h1>
        </div>
      </div>

      <div className="content-area">
        <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, rgba(0, 210, 165, 0.1), rgba(0, 150, 200, 0.05))', border: '1px solid var(--accent-primary)', padding: '24px 32px' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <ShieldCheck size={32} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>มาตราฐานความปลอดภัยระดับสากล</h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 14 }}>
                รายชื่อโบรกเกอร์ทั้งหมดในแพลตฟอร์มของเราได้รับการคัดเลือกและตรวจสอบใบอนุญาต (Regulation) จากหน่วยงานที่น่าเชื่อถือระดับโลก (FCA, ASIC, CySEC) เพื่อให้คุณมั่นใจในความปลอดภัยของเงินทุนและการส่งคำสั่งเทรดที่โปร่งใส การผูกบัญชี MT5 เข้ากับ NexusFX สามารถใช้ได้กับทุกโบรกเกอร์ในรายการนี้
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 24 }}>
          {brokers.map((broker) => (
            <div key={broker.id} className="card hover-glow" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: 24, borderBottom: '1px solid var(--border-primary)', display: 'flex', gap: 16, alignItems: 'center', position: 'relative' }}>
                <div style={{ 
                  width: 64, height: 64, borderRadius: 12, background: 'var(--bg-primary)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid var(--border-primary)', padding: 4, overflow: 'hidden'
                }}>
                  {broker.logo_url ? (
                    <img src={broker.logo_url} alt={broker.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                  ) : null}
                  <div style={{ display: broker.logo_url ? 'none' : 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: 'var(--text-muted)' }}>
                    {broker.name[0]}
                  </div>
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{broker.display_name}</h3>
                  {renderStars(Number(broker.rating) || 0)}
                </div>
                {broker.rating >= 4.5 && (
                  <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255, 215, 0, 0.1)', color: '#FFD700', padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Award size={12} /> TOP
                  </div>
                )}
              </div>
              
              <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6, flex: 1 }}>
                  {broker.description || 'ไม่มีคำอธิบาย'}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                  <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>ประเทศ/สำนักงาน</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{broker.country || '-'}</div>
                  </div>
                  <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Leverage สูงสุด</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{broker.max_leverage || '-'}</div>
                  </div>
                  <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>ฝากขั้นต่ำ (Min. Deposit)</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>${broker.min_deposit || '0'}</div>
                  </div>
                  <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>เริ่มต้น Spread</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{broker.spread_from || '-'}</div>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>ใบอนุญาตกำกับดูแล (Regulation)</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(broker.regulation || 'None').split(',').map(reg => (
                      <span key={reg} className="badge badge-buy" style={{ fontSize: 10, padding: '4px 8px' }}><CheckCircle2 size={10} style={{ marginRight: 4 }} /> {reg.trim()}</span>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>แพลตฟอร์มรองรับ</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{broker.platforms || 'MT4, MT5'}</div>
                </div>

                <a 
                  href={broker.website} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', display: 'flex', gap: 8 }}
                >
                  <ExternalLink size={16} /> สมัครสมาชิกบัญชีเทรด
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
