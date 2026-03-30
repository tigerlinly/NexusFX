import { useState, useEffect } from 'react';
import { ShoppingCart, Star, BarChart2, CheckCircle2, TrendingUp, Zap } from 'lucide-react';
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
    
    if (!await window.customConfirm(confirmMsg)) return;

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

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title">สโตร์กลยุทธ์ (Strategy Marketplace)</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
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
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-lg)'
        }}>
          {strategies.map(bot => {
            const isOwned = purchased.includes(bot.id);
            return (
              <div key={bot.id} className="summary-card" style={{ padding: 'var(--space-lg)', position: 'relative' }}>
                {bot.isHot && (
                  <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--warning)', fontSize: 12, fontWeight: 700 }}>
                    <Zap size={14} fill="currentColor" /> ขายดี (HOT)
                  </div>
                )}
                
                <h3 style={{ fontSize: 18, marginBottom: 4, paddingRight: 60 }}>{bot.name}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>โดย: <span style={{ color: 'var(--accent-primary)' }}>{bot.author}</span></div>
                
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20, minHeight: 40 }}>
                  {bot.description}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  <div style={{ background: 'rgba(0,255,136,0.05)', padding: 12, borderRadius: 8, border: '1px solid rgba(0,255,136,0.1)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>ผลตอบแทน (ROI)</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--profit)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <TrendingUp size={16} /> {bot.roi}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, border: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>ความเสี่ยง (DD)</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--loss)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <BarChart2 size={16} /> -{bot.drawdown}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Star size={14} style={{ color: '#FAAD14' }} fill="#FAAD14" />
                    <span>{bot.rating} ({bot.users} ผู้ติดตาม)</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{bot.price}</div>
                </div>

                <button 
                  className="btn" 
                  disabled={isOwned}
                  style={{ 
                    width: '100%', 
                    background: isOwned ? 'var(--bg-secondary)' : 'var(--gradient-primary)',
                    color: isOwned ? 'var(--profit)' : '#000',
                    border: 'none',
                    fontWeight: 600
                  }}
                  onClick={() => handlePurchase(bot.id)}
                >
                  {isOwned ? (
                    <><CheckCircle2 size={16} style={{ marginRight: 6 }} /> ติดตั้งลงพอร์ตแล้ว</>
                  ) : (
                    <><ShoppingCart size={16} style={{ marginRight: 6 }} /> หยิบใส่พอร์ต (Copy Trade)</>
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
