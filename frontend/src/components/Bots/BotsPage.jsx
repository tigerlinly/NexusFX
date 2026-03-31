import { useState, useEffect, useRef } from 'react';
import { api } from '../../utils/api';
import { Bot, Play, Square, Settings, Activity, Plus, Trash2, Cpu } from 'lucide-react';
import { io } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';

export default function BotsPage() {
  const { user } = useAuth();
  const [bots, setBots] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [_loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedBot, setSelectedBot] = useState(null);
  const [botLogs, setBotLogs] = useState([]);
  const [liveActivities, setLiveActivities] = useState({});
  const socketRef = useRef(null);
  
  const [formData, setFormData] = useState({
    bot_name: '', account_id: '', strategy_type: 'Scalper'
  });

  const fetchData = async () => {
    try {
      const [bts, accs] = await Promise.all([
        api.getBots(), api.getAccounts()
      ]);
      setBots(bts);
      setAccounts(accs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalLogs = async () => {
    try {
      const logs = await api.getAllBotLogs();
      setBotLogs(logs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { 
    fetchData(); 
    fetchGlobalLogs();
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const wsUrl = import.meta.env.VITE_WS_URL;
    const socket = io(wsUrl ? wsUrl : undefined);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', user.id);
    });

    socket.on('bot_activity', (data) => {
      setLiveActivities(prev => ({
        ...prev,
        [data.bot_id]: {
          message: data.message,
          event_type: data.event_type,
          timestamp: data.timestamp
        }
      }));

      setBotLogs(prev => {
        // Keep only log-worthy events
        if (data.event_type === 'SCANNING') return prev;
        
        // If a specific bot is selected and the event is for another bot, ignore it
        if (selectedBot && selectedBot.id !== data.bot_id) return prev;
        
        return [{
          id: Date.now(),
          bot_id: data.bot_id,
          // Extract bot_name roughly from state if possible, though it defaults to basic info
          bot_name: data.bot_name || `Bot #${data.bot_id}`,
          created_at: data.timestamp,
          event_type: data.event_type,
          message: data.message
        }, ...prev].slice(0, 100);
      });
    });

    return () => socket.disconnect();
  }, [user?.id, selectedBot]);

  const handleCreateBot = async (e) => {
    e.preventDefault();
    try {
      await api.createBot(formData);
      setShowModal(false);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleStatus = async (bot) => {
    try {
      await api.updateBot(bot.id, { is_active: !bot.is_active });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteBot = async (id) => {
    if (!await window.customConfirm('ยืนยันลบ Bot นี้?')) return;
    try {
      await api.deleteBot(id);
      setSelectedBot(null);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleViewLogs = async (bot) => {
    if (selectedBot?.id === bot.id) {
      handleCloseLogs();
      return;
    }
    
    setSelectedBot(bot);
    try {
      const logs = await api.getBotLogs(bot.id);
      setBotLogs(logs);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCloseLogs = () => {
    setSelectedBot(null);
    fetchGlobalLogs();
  };

  const handleClearLogs = async (botId) => {
    if (!await window.customConfirm('ยืนยันเคลียร์ Log ทั้งหมดของ Bot นี้?')) return;
    try {
      await api.clearBotLogs(botId);
      setBotLogs([]);
      fetchData(); // refresh recent_events count
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <>
      {/* Pulse animation for active bot log buttons */}
      <style>{`
        @keyframes logPulse {
          0% { box-shadow: 0 0 4px rgba(0, 230, 118, 0.4); }
          50% { box-shadow: 0 0 12px rgba(0, 230, 118, 0.8), 0 0 24px rgba(0, 230, 118, 0.3); }
          100% { box-shadow: 0 0 4px rgba(0, 230, 118, 0.4); }
        }
        .btn-log-active {
          background: rgba(0, 230, 118, 0.15) !important;
          border: 1px solid rgba(0, 230, 118, 0.5) !important;
          color: #00e676 !important;
          animation: logPulse 2s ease-in-out infinite;
        }
        .btn-log-active:hover {
          background: rgba(0, 230, 118, 0.25) !important;
        }
      `}</style>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title">เครื่องมือเทรดอัตโนมัติ (Bots)</h1>
        </div>
        <div className="header-right">
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <Plus size={14} /> สร้าง Bot
          </button>
        </div>
      </div>

      <div className="content-area">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 'var(--space-lg)' }}>
          {/* Bots Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-md)', alignContent: 'start' }}>
            {bots.length === 0 ? (
              <div className="chart-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-2xl)' }}>
                <Bot size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                <p style={{ color: 'var(--text-tertiary)' }}>ยังไม่มี Trading Bot — คลิก 'สร้าง Bot' เพื่อเริ่มต้น</p>
              </div>
            ) : bots.map(bot => (
              <div key={bot.id} className="card" style={{ border: selectedBot?.id === bot.id ? '1px solid var(--accent-primary)' : '' }}>
                <div className="card-header" style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                      background: bot.is_active ? 'var(--profit-bg)' : 'var(--bg-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Cpu size={18} style={{ color: bot.is_active ? 'var(--profit)' : 'var(--text-muted)' }} />
                    </div>
                    <div>
                      <div className="card-title" style={{ fontSize: 14 }}>{bot.bot_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>บัญชี: {bot.account_name}</div>
                    </div>
                  </div>
                  <span className={`badge ${bot.is_active ? 'badge-buy' : 'badge-sell'}`}>
                    {bot.status}
                  </span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <div>
                    กลยุทธ์: <strong style={{ color: 'var(--accent-secondary)' }}>{bot.strategy_type}</strong>
                  </div>
                  <div>อัปเดต: {new Date(bot.updated_at).toLocaleDateString('th-TH')}</div>
                </div>

                {liveActivities[bot.id] && (
                  <div style={{ 
                    padding: '8px 12px', 
                    borderRadius: 'var(--radius-sm)', 
                    background: liveActivities[bot.id].event_type === 'SCANNING' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0, 230, 118, 0.1)',
                    marginBottom: 16,
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    animation: 'logPulse 2s ease-in-out'
                  }}>
                    <Activity size={12} style={{ color: liveActivities[bot.id].event_type === 'SCANNING' ? 'var(--info)' : 'var(--profit)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{liveActivities[bot.id].message}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border-primary)', paddingTop: 16 }}>
                  <button 
                    className={`btn btn-sm ${bot.is_active ? 'btn-danger' : 'btn-primary'}`} 
                    style={{ flex: 1 }}
                    onClick={() => handleToggleStatus(bot)}
                  >
                    {bot.is_active ? <><Square size={14} fill="currentColor" /> หยุด</> : <><Play size={14} fill="currentColor" /> เริ่ม</>}
                  </button>
                  <button
                    className={`btn btn-sm ${bot.recent_events > 0 ? 'btn-log-active' : 'btn-secondary'}`}
                    onClick={() => handleViewLogs(bot)}
                    title={bot.recent_events > 0 ? `มี ${bot.recent_events} กิจกรรมใน 24 ชม.` : 'ดูบันทึกเหตุการณ์'}
                  >
                    <Activity size={14} /> Log{bot.recent_events > 0 ? ` (${bot.recent_events})` : ''}
                  </button>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDeleteBot(bot.id)} style={{ color: 'var(--loss)' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Bot Event Logs */}
          <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 'calc(100vh - 150px)', position: 'sticky', top: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="chart-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={16} style={{ color: 'var(--accent-secondary)' }} />
                {selectedBot ? `${selectedBot.bot_name} Logs` : 'Live Tracking (All Bots)'}
              </h3>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {botLogs.length > 0 && selectedBot && (
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => handleClearLogs(selectedBot.id)}
                    style={{ color: 'var(--loss)', fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                    title={`เคลียร์ Log ของ ${selectedBot.bot_name}`}
                  >
                    <Trash2 size={12} /> เคลียร์
                  </button>
                )}
                {selectedBot && (
                   <button className="btn-icon" onClick={handleCloseLogs} title="ดู Log ทั้งหมด"><Square size={14} /></button>
                )}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)' }}>
              {botLogs.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 20 }}>ไม่มีบันทึกเหตุการณ์</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {botLogs.map(log => (
                    <div key={log.id} style={{ fontSize: 10 }}>
                      <div style={{ color: 'var(--text-tertiary)', fontSize: 10, marginBottom: 2, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{new Date(log.created_at).toLocaleString('th-TH')}</span>
                        {!selectedBot && log.bot_name && (
                           <span style={{ color: 'var(--accent-secondary)' }}>{log.bot_name}</span>
                        )}
                      </div>
                      <div style={{ color: log.event_type === 'ERROR' ? 'var(--loss)' : 'var(--text-primary)', fontSize: 10, lineHeight: '1.4' }}>
                        <strong style={{ opacity: 0.8 }}>[{log.event_type}]</strong> {log.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">🤖 สร้าง Trading Bot ใหม่</h2>
            <form onSubmit={handleCreateBot}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">ชื่อ Bot</label>
                <input className="form-input" required value={formData.bot_name} onChange={e => setFormData({ ...formData, bot_name: e.target.value })} placeholder="เช่น Sniper V1" />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">ผูกกับบัญชีเทรด</label>
                <select className="filter-select" required value={formData.account_id} onChange={e => setFormData({ ...formData, account_id: e.target.value })} style={{ width: '100%' }}>
                  <option value="">-- เลือกบัญชี --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.account_name} ({acc.account_number})</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">ประเภทกลยุทธ์</label>
                <select className="filter-select" value={formData.strategy_type} onChange={e => setFormData({ ...formData, strategy_type: e.target.value })} style={{ width: '100%' }}>
                  <option value="Scalper">Scalper (เก็บสั้น)</option>
                  <option value="Swing">Swing Trade</option>
                  <option value="Grid">Grid Trading</option>
                  <option value="Martingale">Martingale</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary">บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
