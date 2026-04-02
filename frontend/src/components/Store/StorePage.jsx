import { useState, useEffect } from 'react';
import { ShoppingCart, Star, BarChart2, CheckCircle2, TrendingUp, Zap, Shield } from 'lucide-react';
import { api } from '../../utils/api';

export default function StorePage() {
  const [purchased, setPurchased] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [botsData, accsData] = await Promise.all([
          api.getStoreBots(),
          api.getAccounts()
        ]);
        setStrategies(botsData);
        setAccounts(accsData);
        if (accsData.length > 0) setSelectedAccountId(accsData[0].id);
      } catch (err) {
        console.error('Failed to load store data:', err);
      }
    };
    fetchData();
  }, []);

  const handlePurchase = async (bot) => {
    if (!selectedAccountId) return alert('กรุณาเลือกบัญชีเทรดก่อนเชื่อมต่อบอท');
    const confirmMsg = bot.price > 0 
      ? `คุณต้องการเช่าบอท ${bot.name} ในราคา $${bot.price} USD หรือไม่? (ระบบจะหักเงินจาก Wallet)`
      : `คุณต้องการติดตั้งบอท ${bot.name} (ฟรี) ลงในพอร์ตหรือไม่?`;
    
    if (!confirm(confirmMsg)) return;

    setProcessing(true);
    try {
      const res = await api.purchaseBot({ botId: bot.id, accountId: selectedAccountId });
      if (res.success) {
        setPurchased([...purchased, bot.id]);
        alert(`ดึงบอทลงระบบสำเร็จ! เข้าไปกดเริ่มการทำงานที่หน้า Trading Bots ได้เลย`);
      }
    } catch (err) {
      alert(err.message || 'เกิดข้อผิดพลาดในการเช่าบอท อาจเป็นเพราะยอดเงิน USD ไม่เพียงพอ');
    } finally {
      setProcessing(false);
    }
  };

  // Risk level color based on drawdown percentage
  const getRiskColor = (dd) => {
    const val = parseFloat(dd);
    if (val <= 5) return 'var(--profit)';
    if (val <= 15) return 'var(--warning)';
    return 'var(--loss)';
  };

  const getRiskLabel = (dd) => {
    const val = parseFloat(dd);
    if (val <= 5) return 'ความเสี่ยงต่ำ';
    if (val <= 15) return 'ความเสี่ยงปานกลาง';
    return 'ความเสี่ยงสูง';
  };

  return (
    <>
      <div className="header" style={{ height: 'auto', minHeight: 'auto', padding: '12px 24px 12px 60px' }}>
        <div className="header-left" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          <h1 className="page-title">สโตร์กลยุทธ์ (Strategy Marketplace)</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            ค้นหาและคัดลอกสุดยอดหุ่นยนต์เทรด (Copy Trading) จากผู้ใช้งานทั่วโลก
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>ติดตั้งลงบัญชี:</label>
          <select 
            className="form-input" 
            style={{ width: 250 }}
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
          >
            {accounts.length === 0 && <option value="">ไม่มีบัญชี - กรุณาสร้างบัญชีก่อน</option>}
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.account_name} ({acc.account_number})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="content-area">
        {/* Free Strategy Banner */}
        <div style={{ 
          background: 'linear-gradient(135deg, rgba(0,255,136,0.08), rgba(0,200,255,0.05))', 
          border: '1px solid rgba(0,255,136,0.15)', 
          borderRadius: 10, padding: '14px 20px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <Shield size={22} style={{ color: 'var(--profit)', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--profit)', marginBottom: 2 }}>กลยุทธ์พื้นฐาน — ฟรีสำหรับสมาชิกทุกคน</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>ระบบจัดเตรียมกลยุทธ์พื้นฐาน 4 รูปแบบ ได้แก่ Scalper, Swing Trade, Grid Trading และ Martingale ให้ใช้งานได้ฟรีไม่มีค่าใช้จ่าย</div>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16
        }}>
          {strategies.map(bot => {
            const isOwned = purchased.includes(bot.id);
            return (
              <div key={bot.id} className="summary-card" style={{ padding: 16, position: 'relative' }}>
                {bot.isHot && (
                  <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--warning)', fontSize: 11, fontWeight: 700 }}>
                    <Zap size={12} fill="currentColor" /> HOT
                  </div>
                )}
                
                <h3 style={{ fontSize: 16, marginBottom: 6, paddingRight: 50 }}>{bot.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <span style={{ 
                    fontSize: 10, background: 'rgba(0,200,255,0.1)', color: 'var(--accent-primary)', 
                    padding: '1px 6px', borderRadius: 3, fontWeight: 600, border: '1px solid rgba(0,200,255,0.2)'
                  }}>
                    {bot.type}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>โดย: <span style={{ color: 'var(--accent-primary)' }}>{bot.author}</span></span>
                </div>
                
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 14, minHeight: 50 }}>
                  {bot.description}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div style={{ background: 'rgba(0,255,136,0.05)', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(0,255,136,0.1)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>ผลตอบแทน (ROI)</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--profit)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <TrendingUp size={14} /> {bot.roi}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>ความเสี่ยง (DD)</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: getRiskColor(bot.drawdown), display: 'flex', alignItems: 'center', gap: 4 }}>
                      <BarChart2 size={14} /> -{bot.drawdown}
                    </div>
                    <div style={{ fontSize: 9, color: getRiskColor(bot.drawdown), marginTop: 1 }}>{getRiskLabel(bot.drawdown)}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Star size={12} style={{ color: '#FAAD14' }} fill="#FAAD14" />
                    <span>{bot.rating} ({bot.users} ผู้ติดตาม)</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: bot.price === 0 ? 'var(--profit)' : 'var(--text-primary)' }}>
                    {bot.price === 0 ? '🆓 ฟรี' : `$${bot.price}`}
                  </div>
                </div>

                <button 
                  className="btn" 
                  disabled={isOwned || processing}
                  style={{ 
                    width: '100%', 
                    padding: '8px 0',
                    background: isOwned ? 'var(--bg-secondary)' : 'var(--gradient-primary)',
                    color: isOwned ? 'var(--profit)' : '#000',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: 13
                  }}
                  onClick={() => handlePurchase(bot)}
                >
                  {isOwned ? (
                    <><CheckCircle2 size={14} style={{ marginRight: 6 }} /> ติดตั้งลงพอร์ตแล้ว</>
                  ) : (
                    <><ShoppingCart size={14} style={{ marginRight: 6 }} /> หยิบใส่พอร์ต (Copy Trade)</>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
