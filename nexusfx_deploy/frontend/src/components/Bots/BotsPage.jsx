import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { Bot, Play, Square, Settings, Activity, Plus, Trash2, Cpu } from 'lucide-react';

export default function BotsPage() {
  const [bots, setBots] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedBot, setSelectedBot] = useState(null);
  const [botLogs, setBotLogs] = useState([]);
  
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

  useEffect(() => { fetchData(); }, []);

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
    setSelectedBot(bot);
    try {
      const logs = await api.getBotLogs(bot.id);
      setBotLogs(logs);
    } catch (err) {
      console.error(err);
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
        <div style={{ display: 'grid', gridTemplateColumns: selectedBot ? '1fr 350px' : '1fr', gap: 'var(--space-lg)' }}>
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
          {selectedBot && (
            <div className="chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 className="chart-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Activity size={16} style={{ color: 'var(--accent-secondary)' }} />
                  {selectedBot.bot_name} Logs
                </h3>
                <button className="btn-icon" onClick={() => setSelectedBot(null)}><Square size={14} /></button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)' }}>
                {botLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 20 }}>ไม่มีบันทึกเหตุการณ์</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {botLogs.map(log => (
                      <div key={log.id} style={{ fontSize: 12 }}>
                        <div style={{ color: 'var(--text-tertiary)', fontSize: 10, marginBottom: 2 }}>
                          {new Date(log.created_at).toLocaleString('th-TH')}
                        </div>
                        <div style={{ color: log.event_type === 'ERROR' ? 'var(--loss)' : 'var(--text-primary)' }}>
                          <strong style={{ opacity: 0.8 }}>[{log.event_type}]</strong> {log.message}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
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
