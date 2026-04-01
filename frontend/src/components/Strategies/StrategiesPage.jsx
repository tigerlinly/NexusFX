import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import ConfirmDialog from '../Layout/ConfirmDialog';
import { ShoppingCart, Target, Users, TrendingUp, CheckCircle2, Plus, Zap, Activity, AlertTriangle } from 'lucide-react';

export default function StrategiesPage() {
  const [activeTab, setActiveTab] = useState('marketplace');
  const [strategies, setStrategies] = useState([]);
  const [myStrategies, setMyStrategies] = useState([]);
  const [mySubscriptions, setMySubscriptions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', risk_level: 'medium', price_monthly: 0 });
  const [confirmDialog, setConfirmDialog] = useState({ open: false });

  const showConfirm = (message, onConfirm, options = {}) => {
    setConfirmDialog({ open: true, message, onConfirm, ...options });
  };
  const closeConfirm = () => setConfirmDialog({ open: false });

  // Publish Signal Modal State
  const [showSignalModal, setShowSignalModal] = useState(false);
  const [activeStrategyId, setActiveStrategyId] = useState(null);
  const [signalForm, setSignalForm] = useState({
    symbol: 'EURUSD',
    side: 'BUY',
    lot_size: 0.01,
    entry_price: '',
    sl: '',
    tp: '',
    signal_type: 'MARKET'
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'marketplace') {
        const [stratData, subsData, accsData] = await Promise.all([
          api.getStrategies(),
          api.getMySubscriptions(),
          api.getAccounts()
        ]);
        setStrategies(stratData.strategies || stratData);
        setMySubscriptions(subsData);
        setAccounts(accsData);
        if (accsData.length > 0 && !selectedAccountId) setSelectedAccountId(accsData[0].id);
      } else if (activeTab === 'my') {
        const data = await api.getMyStrategies();
        setMyStrategies(data);
      }
    } catch (err) {
      console.error('Failed to load strategies:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (strategy) => {
    if (!selectedAccountId) return alert('กรุณาเลือกบัญชีเทรดก่อนกดติดตามกลยุทธ์');
    showConfirm(
      `ต้องการติดตามกลยุทธ์ “${strategy.name}” หรือไม่? คำสั่งจะถูกคัดลอกเข้าบัญชี ${selectedAccountId} โดยอัตโนมัติ`,
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
      'ยกเลิกการติดตามกลยุทธ์นี้หรือไม่? ระบบจะหยุดคัดลอกคำสั่งจากกลยุทธ์นี้ทันที',
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
      fetchData(); // refresh counts
    } catch (err) {
      alert(err.message || 'เกิดข้อผิดพลาดในการส่ง Signal');
    }
  };

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title">ศูนย์รวมกลยุทธ์ (Copy Trading)</h1>
        </div>
        {activeTab === 'my' && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> สร้างกลยุทธ์ใหม่
          </button>
        )}
      </div>

      <div className="content-area">
        <div className="chart-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', background: 'rgba(0,0,0,0.1)' }}>
            <button
              onClick={() => setActiveTab('marketplace')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px',
                background: 'transparent', border: 'none',
                color: activeTab === 'marketplace' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === 'marketplace' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                cursor: 'pointer', fontWeight: activeTab === 'marketplace' ? 600 : 500, fontSize: 14, marginBottom: -1
              }}
            >
              <ShoppingCart size={16} /> ตลาด (Marketplace)
            </button>
            <button
              onClick={() => setActiveTab('my')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px',
                background: 'transparent', border: 'none',
                color: activeTab === 'my' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === 'my' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                cursor: 'pointer', fontWeight: activeTab === 'my' ? 600 : 500, fontSize: 14, marginBottom: -1
              }}
            >
              <Target size={16} /> กลยุทธ์ของฉัน
            </button>
          </div>

          <div style={{ padding: 'var(--space-xl)' }}>
            {/* Marketplace Tab */}
            {activeTab === 'marketplace' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                  <label style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>เลือกบัญชีคัดลอกเทรด:</label>
                  <select 
                    className="form-input" 
                    style={{ width: 250, padding: '4px 8px', fontSize: 13 }}
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

                {loading ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>กำลังโหลดกลยุทธ์...</div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: 'var(--space-lg)'
                  }}>
                    {strategies.length === 0 ? (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                        ยังไม่มีผู้เผยแพร่กลยุทธ์ในขณะนี้
                      </div>
                    ) : strategies.map(strat => {
                      const isSubscribed = strat.is_subscribed || mySubscriptions.some(sub => sub.strategy_id === strat.id);
                      
                      return (
                        <div key={strat.id} className="card" style={{ background: 'var(--bg-tertiary)', border: isSubscribed ? '1px solid var(--accent-primary)' : '1px solid var(--border-primary)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 600 }}>{strat.name}</h3>
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: 4, fontSize: 11, color: 'var(--warning)' }}>
                              {strat.risk_level.toUpperCase()}
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#000', fontWeight: 'bold' }}>
                              {(strat.publisher_name || strat.publisher_username)?.[0]?.toUpperCase()}
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>@{strat.publisher_username}</span>
                          </div>

                          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16, minHeight: 40 }}>
                            {strat.description || 'ไม่มีรายละเอียด'}
                          </p>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>ผู้ติดตาม</div>
                              <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', gap: 4, alignItems: 'center' }}><Users size={14}/> {strat.subscribers_count || 0}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>ค่าธรรมเนียม/เดือน</div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: strat.is_free ? 'var(--profit)' : 'var(--text-primary)' }}>
                                {strat.is_free ? 'ฟรี' : `$${strat.price_monthly}`}
                              </div>
                            </div>
                          </div>

                          {isSubscribed ? (
                            <button className="btn btn-secondary" style={{ width: '100%', color: 'var(--loss)', borderColor: 'var(--loss)' }} onClick={() => handleUnsubscribe(strat.id)}>
                              ยกเลิกการติดตาม
                            </button>
                          ) : (
                            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleSubscribe(strat)}>
                              คัดลอกเทรด
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* My Strategies Tab */}
            {activeTab === 'my' && (
              <div>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>กำลังโหลดกลยุทธ์ของคุณ...</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-lg)' }}>
                    {myStrategies.length === 0 ? (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                        คุณยังไม่ได้สร้างกลยุทธ์ใดๆ (คลิกที่ 'สร้างกลยุทธ์ใหม่' เพื่อเริ่มต้นเป็น Master Trader)
                      </div>
                    ) : myStrategies.map(strat => (
                      <div key={strat.id} className="card" style={{ background: 'var(--bg-tertiary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                          <h3 style={{ fontSize: 16, fontWeight: 600 }}>{strat.name}</h3>
                          <span className={`badge ${strat.is_published ? 'badge-buy' : 'badge-open'}`}>
                            {strat.is_published ? 'เผยแพร่แล้ว' : 'ส่วนตัว'}
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>ผู้ติดตาม</div>
                            <div style={{ fontSize: 18, fontWeight: 700 }}>{strat.active_subs || 0}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>คำสั่ง (Signals)</div>
                            <div style={{ fontSize: 18, fontWeight: 700 }}>{strat.total_signals || 0}</div>
                          </div>
                        </div>

                        <button 
                          className="btn btn-secondary" 
                          style={{ width: '100%', background: 'var(--gradient-primary)', color: '#000', border: 'none', fontWeight: 600 }} 
                          onClick={() => { setActiveStrategyId(strat.id); setShowSignalModal(true); }}
                        >
                          <Activity size={14} style={{ marginRight: 6 }}/> ส่ง Signal หานักลงทุน
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

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
                  <input type="text" className="form-input" value={signalForm.symbol} onChange={e => setSignalForm({...signalForm, symbol: e.target.value.toUpperCase()})} required placeholder="เช่น EURUSD, BTCUSDT" />
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
                การกดส่ง Signal จะกระจายคำสั่งนี้ไปยังผู้ติดตามทั้งหมดทันที! กรุณาตรวจสอบข้อมูลให้ถูกต้องครบถ้วน
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
