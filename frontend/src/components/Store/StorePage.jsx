import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Star, BarChart2, CheckCircle2, TrendingUp, Zap, Shield, Info, Target, Users, Plus, Activity, AlertTriangle, Copy } from 'lucide-react';
import { api } from '../../utils/api';
import ConfirmDialog from '../Layout/ConfirmDialog';

export default function StorePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('bots');
  const [purchased, setPurchased] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [processing, setProcessing] = useState(false);

  // Copy Trading states (from StrategiesPage)
  const [copyStrategies, setCopyStrategies] = useState([]);
  const [myStrategies, setMyStrategies] = useState([]);
  const [mySubscriptions, setMySubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create Strategy Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', risk_level: 'medium', price_monthly: 0 });

  // Signal Modal
  const [showSignalModal, setShowSignalModal] = useState(false);
  const [activeStrategyId, setActiveStrategyId] = useState(null);
  const [signalForm, setSignalForm] = useState({
    symbol: 'EURUSD', side: 'BUY', lot_size: 0.01,
    entry_price: '', sl: '', tp: '', signal_type: 'MARKET'
  });

  // Confirm Dialog
  const [confirmDialog, setConfirmDialog] = useState({ open: false });
  const showConfirm = (message, onConfirm, options = {}) => {
    setConfirmDialog({ open: true, message, onConfirm, ...options });
  };
  const closeConfirm = () => setConfirmDialog({ open: false });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'bots') {
        const [botsData, accsData] = await Promise.all([
          api.getStoreBots(),
          api.getAccounts()
        ]);
        setStrategies(botsData);
        setAccounts(accsData);
        if (accsData.length > 0 && !selectedAccountId) setSelectedAccountId(accsData[0].id);
      } else if (activeTab === 'copy') {
        const [stratData, subsData, accsData] = await Promise.all([
          api.getStrategies(),
          api.getMySubscriptions(),
          api.getAccounts()
        ]);
        setCopyStrategies(stratData.strategies || stratData);
        setMySubscriptions(subsData);
        setAccounts(accsData);
        if (accsData.length > 0 && !selectedAccountId) setSelectedAccountId(accsData[0].id);
      } else if (activeTab === 'my') {
        const data = await api.getMyStrategies();
        setMyStrategies(data);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  // === Bot Store handlers ===
  const handlePurchase = async (bot) => {
    if (!selectedAccountId) return alert('กรุณาเลือกบัญชีเทรดก่อนเชื่อมต่อบอท');
    const confirmMsg = bot.price > 0 
      ? `คุณต้องการเช่าบอท ${bot.name} ในราคา $${bot.price} USD หรือไม่?`
      : `คุณต้องการติดตั้งบอท ${bot.name} (ฟรี) ลงในพอร์ตหรือไม่?`;
    
    if (!confirm(confirmMsg)) return;

    setProcessing(true);
    try {
      const res = await api.purchaseBot({ botId: bot.id, accountId: selectedAccountId });
      if (res.success) {
        setPurchased([...purchased, bot.id]);
        alert('ดึงบอทลงระบบสำเร็จ! กำลังพาไปหน้าจัดการบอท...');
        navigate('/bots');
      }
    } catch (err) {
      alert(err.message || 'เกิดข้อผิดพลาดในการเช่าบอท');
    } finally {
      setProcessing(false);
    }
  };

  // === Copy Trade handlers ===
  const handleSubscribe = async (strategy) => {
    if (!selectedAccountId) return alert('กรุณาเลือกบัญชีเทรดก่อนกดติดตามกลยุทธ์');
    showConfirm(
      `ต้องการติดตามกลยุทธ์ "${strategy.name}" หรือไม่? คำสั่งจะถูกคัดลอกเข้าบัญชีโดยอัตโนมัติ`,
      async () => {
        closeConfirm();
        try {
          await api.subscribeStrategy(strategy.id, { account_id: selectedAccountId, lot_multiplier: 1.0 });
          alert('ติดตามกลยุทธ์เรียบร้อยแล้ว!');
          fetchData();
        } catch (err) {
          alert(err.message || 'เกิดข้อผิดพลาดในการติดตามกลยุทธ์');
        }
      },
      { title: 'ติดตามกลยุทธ์ (Copy Trade)', confirmText: 'ติดตามเลย', variant: 'info' }
    );
  };

  const handleUnsubscribe = async (strategyId) => {
    showConfirm(
      'ยกเลิกการติดตามกลยุทธ์นี้หรือไม่?',
      async () => {
        closeConfirm();
        try {
          await api.unsubscribeStrategy(strategyId);
          alert('ยกเลิกการติดตามเรียบร้อยแล้ว');
          fetchData();
        } catch (err) {
          alert(err.message);
        }
      },
      { title: 'ยกเลิกการติดตาม', confirmText: 'ยกเลิก', variant: 'danger' }
    );
  };

  // === My Strategy handlers ===
  const handleCreateStrategy = async (e) => {
    e.preventDefault();
    try {
      await api.createStrategy(createForm);
      alert('สร้างกลยุทธ์เรียบร้อย! ตอนนี้คุณสามารถส่ง Signal ได้แล้ว');
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '', risk_level: 'medium', price_monthly: 0 });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePublishSignal = async (e) => {
    e.preventDefault();
    try {
      if (!activeStrategyId) return;
      const payload = { ...signalForm };
      if (payload.signal_type === 'MARKET') delete payload.entry_price;
      
      const res = await api.publishSignal(activeStrategyId, payload);
      alert(`ส่ง Signal สำเร็จ! แจ้งเตือนไปยังนักลงทุน ${res.notified_subscribers} คนเรียบร้อยแล้ว`);
      setShowSignalModal(false);
      setActiveStrategyId(null);
      setSignalForm({ symbol: 'EURUSD', side: 'BUY', lot_size: 0.01, entry_price: '', sl: '', tp: '', signal_type: 'MARKET' });
      fetchData();
    } catch (err) {
      alert(err.message || 'เกิดข้อผิดพลาดในการส่ง Signal');
    }
  };

  // Risk helpers
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

  // Tab definitions
  const tabs = [
    { key: 'bots', icon: <Shield size={15} />, label: 'บอทสำเร็จรูป' },
    { key: 'copy', icon: <Copy size={15} />, label: 'Copy จากเทรดเดอร์' },
    { key: 'my', icon: <Target size={15} />, label: 'กลยุทธ์ของฉัน' },
  ];

  return (
    <>
      <div className="header" style={{ height: 'auto', minHeight: 'auto', padding: '12px 24px 12px 60px' }}>
        <div className="header-left" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          <h1 className="page-title">Marketplace</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            ค้นหาบอทสำเร็จรูป, Copy Trade จากนักเทรดมืออาชีพ หรือสร้างกลยุทธ์ของคุณเอง
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {activeTab === 'my' ? (
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
              <Plus size={14} /> สร้างกลยุทธ์ใหม่
            </button>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      <div className="content-area">

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 16,
          background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
          padding: 4, border: '1px solid var(--border-primary)'
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 16px', borderRadius: 'var(--radius-sm)',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                transition: 'all 0.2s',
                background: activeTab === tab.key ? 'rgba(0, 230, 118, 0.12)' : 'transparent',
                color: activeTab === tab.key ? 'var(--profit)' : 'var(--text-tertiary)',
                boxShadow: activeTab === tab.key ? '0 0 8px rgba(0, 230, 118, 0.15)' : 'none',
                borderBottom: activeTab === tab.key ? '2px solid var(--profit)' : '2px solid transparent'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ============ TAB 1: บอทสำเร็จรูป ============ */}
        {activeTab === 'bots' && (
          <>
            {/* Green info banner */}
            <div style={{
              background: 'rgba(0, 230, 118, 0.08)',
              border: '1px solid rgba(0, 230, 118, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 12
            }}>
              <Info size={20} style={{ color: 'var(--profit)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--profit)', fontSize: 13, marginBottom: 2 }}>กลยุทธ์พื้นฐาน — ฟรีสำหรับสมาชิกทุกคน</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ระบบจัดเตรียมกลยุทธ์พื้นฐาน 4 รูปแบบ ได้แก่ Scalper, Swing Trade, Grid Trading และ Martingale ให้ใช้งานได้ฟรีไม่มีค่าใช้จ่าย</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {strategies.map(bot => {
                const isOwned = purchased.includes(bot.id);
                return (
                  <div key={bot.id} className="card">
                    <div className="card-header" style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                          background: 'var(--profit-bg)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <Shield size={18} style={{ color: 'var(--profit)' }} />
                        </div>
                        <div>
                          <div className="card-title" style={{ fontSize: 14, textTransform: 'none', letterSpacing: 0 }}>{bot.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>โดย: {bot.author}</div>
                        </div>
                      </div>
                      {bot.isHot ? (
                        <span className="badge badge-buy" style={{ background: 'rgba(251,191,36,0.15)', color: 'var(--warning)' }}>
                          <Zap size={10} fill="currentColor" style={{ marginRight: 3 }} /> HOT
                        </span>
                      ) : (
                        <span className="badge" style={{ background: 'rgba(0,200,255,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(0,200,255,0.2)' }}>
                          {bot.type}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <div>กลยุทธ์: <strong style={{ color: 'var(--accent-secondary)' }}>{bot.type}</strong></div>
                      <div style={{ fontWeight: 700, color: bot.price === 0 ? 'var(--profit)' : 'var(--text-primary)' }}>
                        {bot.price === 0 ? '🆓 ฟรี' : `$${bot.price}`}
                      </div>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 12, minHeight: 42 }}>
                      {bot.description}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                      <div style={{ background: 'rgba(0,255,136,0.05)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,255,136,0.1)' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>ผลตอบแทน (ROI)</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--profit)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <TrendingUp size={13} /> {bot.roi}
                        </div>
                      </div>
                      <div style={{ background: 'var(--bg-tertiary)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>ความเสี่ยง (DD)</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: getRiskColor(bot.drawdown), display: 'flex', alignItems: 'center', gap: 4 }}>
                          <BarChart2 size={13} /> -{bot.drawdown}
                        </div>
                        <div style={{ fontSize: 9, color: getRiskColor(bot.drawdown) }}>{getRiskLabel(bot.drawdown)}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Star size={12} style={{ color: '#FAAD14' }} fill="#FAAD14" />
                        <span>{bot.rating} ({bot.users} ผู้ติดตาม)</span>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 12 }}>
                      <button 
                        className={`btn btn-sm ${isOwned ? 'btn-secondary' : 'btn-primary'}`}
                        disabled={isOwned || processing}
                        style={{ width: '100%' }}
                        onClick={() => handlePurchase(bot)}
                      >
                        {isOwned ? (
                          <><CheckCircle2 size={14} /> ติดตั้งลงพอร์ตแล้ว</>
                        ) : (
                          <><ShoppingCart size={14} /> หยิบใส่พอร์ต (Copy Trade)</>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ============ TAB 2: Copy จากเทรดเดอร์ ============ */}
        {activeTab === 'copy' && (
          <>
            {/* Info banner */}
            <div style={{
              background: 'rgba(0, 150, 255, 0.08)',
              border: '1px solid rgba(0, 150, 255, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 12
            }}>
              <Copy size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--accent-primary)', fontSize: 13, marginBottom: 2 }}>Copy Trade — คัดลอกคำสั่งจากนักเทรดมืออาชีพ</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ติดตามกลยุทธ์จากนักเทรดจริง เมื่อพวกเขาเปิดออเดอร์ ระบบจะคัดลอกมาที่บัญชีของคุณอัตโนมัติ</div>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>กำลังโหลดกลยุทธ์...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {copyStrategies.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', borderRadius: 8, border: '1px solid var(--border-primary)' }}>
                    ยังไม่มีผู้เผยแพร่กลยุทธ์ในขณะนี้
                  </div>
                ) : copyStrategies.map(strat => {
                  const isSubscribed = strat.is_subscribed || mySubscriptions.some(sub => sub.strategy_id === strat.id);
                  return (
                    <div key={strat.id} className="card">
                      <div className="card-header" style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'var(--gradient-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, color: '#000', fontWeight: 'bold'
                          }}>
                            {(strat.publisher_name || strat.publisher_username)?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="card-title" style={{ fontSize: 14, textTransform: 'none', letterSpacing: 0 }}>{strat.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>@{strat.publisher_username}</div>
                          </div>
                        </div>
                        <span className="badge" style={{
                          background: strat.risk_level === 'high' ? 'rgba(255,71,87,0.15)' : strat.risk_level === 'medium' ? 'rgba(251,191,36,0.15)' : 'rgba(0,230,118,0.15)',
                          color: strat.risk_level === 'high' ? 'var(--loss)' : strat.risk_level === 'medium' ? 'var(--warning)' : 'var(--profit)'
                        }}>
                          {strat.risk_level?.toUpperCase()}
                        </span>
                      </div>

                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 12, minHeight: 42 }}>
                        {strat.description || 'ไม่มีรายละเอียด'}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                        <div style={{ background: 'var(--bg-tertiary)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>ผู้ติดตาม</div>
                          <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Users size={13} /> {strat.subscribers_count || 0}
                          </div>
                        </div>
                        <div style={{ background: 'var(--bg-tertiary)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>ค่าธรรมเนียม/เดือน</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: strat.is_free ? 'var(--profit)' : 'var(--text-primary)' }}>
                            {strat.is_free ? 'ฟรี' : `$${strat.price_monthly}`}
                          </div>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 12 }}>
                        {isSubscribed ? (
                          <button className="btn btn-sm btn-secondary" style={{ width: '100%', color: 'var(--loss)', borderColor: 'var(--loss)' }} onClick={() => handleUnsubscribe(strat.id)}>
                            ยกเลิกการติดตาม
                          </button>
                        ) : (
                          <button className="btn btn-sm btn-primary" style={{ width: '100%' }} onClick={() => handleSubscribe(strat)}>
                            <Copy size={14} /> คัดลอกเทรด
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ============ TAB 3: กลยุทธ์ของฉัน ============ */}
        {activeTab === 'my' && (
          <>
            {/* Info banner */}
            <div style={{
              background: 'rgba(124, 77, 255, 0.08)',
              border: '1px solid rgba(124, 77, 255, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 12
            }}>
              <Target size={20} style={{ color: '#7c4dff', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, color: '#7c4dff', fontSize: 13, marginBottom: 2 }}>Master Trader — สร้างรายได้จากการเทรดของคุณ</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>สร้างกลยุทธ์แล้วส่ง Signal ให้นักลงทุนติดตาม ทุกครั้งที่มีคนสมัคร คุณจะได้รับค่าธรรมเนียมรายเดือน</div>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>กำลังโหลดกลยุทธ์ของคุณ...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {myStrategies.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', borderRadius: 8, border: '1px solid var(--border-primary)' }}>
                    <Target size={32} style={{ marginBottom: 8, opacity: 0.4 }} /><br/>
                    คุณยังไม่ได้สร้างกลยุทธ์ใดๆ<br/>
                    <span style={{ fontSize: 11 }}>คลิกที่ "สร้างกลยุทธ์ใหม่" ด้านบนเพื่อเริ่มต้นเป็น Master Trader</span>
                  </div>
                ) : myStrategies.map(strat => (
                  <div key={strat.id} className="card">
                    <div className="card-header" style={{ marginBottom: 12 }}>
                      <div>
                        <div className="card-title" style={{ fontSize: 14, textTransform: 'none', letterSpacing: 0 }}>{strat.name}</div>
                      </div>
                      <span className={`badge ${strat.is_published ? 'badge-buy' : 'badge-open'}`}>
                        {strat.is_published ? 'เผยแพร่แล้ว' : 'ส่วนตัว'}
                      </span>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                      <div style={{ background: 'var(--bg-tertiary)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>ผู้ติดตาม</div>
                        <div style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Users size={14} /> {strat.active_subs || 0}
                        </div>
                      </div>
                      <div style={{ background: 'var(--bg-tertiary)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Signal ที่ส่ง</div>
                        <div style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Activity size={14} /> {strat.total_signals || 0}
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 12 }}>
                      <button 
                        className="btn btn-sm" 
                        style={{ width: '100%', background: 'var(--gradient-primary)', color: '#000', border: 'none', fontWeight: 600 }} 
                        onClick={() => { setActiveStrategyId(strat.id); setShowSignalModal(true); }}
                      >
                        <Activity size={14} /> ส่ง Signal หานักลงทุน
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* === Create Strategy Modal === */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <h2 style={{ marginBottom: 20 }}>สร้างกลยุทธ์ใหม่</h2>
            <form onSubmit={handleCreateStrategy}>
              <div className="form-group">
                <label className="form-label">ชื่อกลยุทธ์</label>
                <input type="text" className="form-input" value={createForm.name} onChange={e => setCreateForm({...createForm, name: e.target.value})} required placeholder="ตั้งชื่อให้ดึงดูดนักลงทุน" />
              </div>
              <div className="form-group">
                <label className="form-label">รายละเอียด</label>
                <textarea className="form-input" rows={3} value={createForm.description} onChange={e => setCreateForm({...createForm, description: e.target.value})} placeholder="สไตล์การเทรด และจุดเด่น..." />
              </div>
              <div className="form-group">
                <label className="form-label">ระดับความเสี่ยง</label>
                <select className="form-input" value={createForm.risk_level} onChange={e => setCreateForm({...createForm, risk_level: e.target.value})}>
                  <option value="low">ต่ำ (Low Risk)</option>
                  <option value="medium">กลาง (Medium Risk)</option>
                  <option value="high">สูง (High Risk)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">ค่าบริการต่อเดือน (USD) - ใส่ 0 เพื่อให้ใช้ฟรี</label>
                <input type="number" className="form-input" min="0" step="1" value={createForm.price_monthly} onChange={e => setCreateForm({...createForm, price_monthly: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>สร้างกลยุทธ์</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === Publish Signal Modal === */}
      {showSignalModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <h2 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={20} color="var(--accent-primary)" /> ส่ง Signal (Copy Trade)
            </h2>
            <form onSubmit={handlePublishSignal}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">ประเภทออเดอร์</label>
                  <select className="form-input" value={signalForm.signal_type} onChange={e => setSignalForm({...signalForm, signal_type: e.target.value})}>
                    <option value="MARKET">Market Execution</option>
                    <option value="PENDING">Pending Order</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">คู่เงิน / สินทรัพย์</label>
                  <input type="text" className="form-input" value={signalForm.symbol} onChange={e => setSignalForm({...signalForm, symbol: e.target.value.toUpperCase()})} required placeholder="เช่น EURUSD" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">ฝั่ง (Side)</label>
                  <select className="form-input" value={signalForm.side} onChange={e => setSignalForm({...signalForm, side: e.target.value})} style={{ background: signalForm.side === 'BUY' ? 'rgba(0,200,150,0.1)' : 'rgba(255,71,87,0.1)', color: signalForm.side === 'BUY' ? 'var(--profit)' : 'var(--loss)' }}>
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Lot Size (ค่าเริ่มต้น)</label>
                  <input type="number" step="0.01" min="0.01" className="form-input" value={signalForm.lot_size} onChange={e => setSignalForm({...signalForm, lot_size: e.target.value})} required />
                </div>
              </div>

              {signalForm.signal_type === 'PENDING' && (
                <div className="form-group">
                  <label className="form-label">ราคาเข้า (Entry Price)</label>
                  <input type="number" step="0.00001" className="form-input" value={signalForm.entry_price} onChange={e => setSignalForm({...signalForm, entry_price: e.target.value})} required />
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Stop Loss (SL)</label>
                  <input type="number" step="0.00001" className="form-input" value={signalForm.sl} onChange={e => setSignalForm({...signalForm, sl: e.target.value})} placeholder="ปล่อยว่างได้" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Take Profit (TP)</label>
                  <input type="number" step="0.00001" className="form-input" value={signalForm.tp} onChange={e => setSignalForm({...signalForm, tp: e.target.value})} placeholder="ปล่อยว่างได้" />
                </div>
              </div>

              <div style={{ padding: 12, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 8, fontSize: 13, color: 'var(--warning)', marginBottom: 24 }}>
                <AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> 
                การกดส่ง Signal จะกระจายคำสั่งนี้ไปยังผู้ติดตามทั้งหมดทันที!
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowSignalModal(false); setActiveStrategyId(null); }}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>ยืนยันส่ง Signal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.confirmText}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirm}
      />
    </>
  );
}
