import { useState, useEffect, useRef } from 'react';
import { api } from '../../utils/api';
import { Bot, Play, Square, Settings, Activity, Plus, Trash2, Cpu, ShoppingCart } from 'lucide-react';
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
    bot_name: '', account_id: '', strategy_type: 'Scalper',
    primary_timeframe: 'M5',
    analysis_timeframes: ['M5', 'M15'],
    indicators_config: [{ name: 'RSI', weight: 40 }],
    min_confidence: 60,
    symbols: ['XAUUSD'], // from parameters usually, but lifted up for ui
    sl_pips: 15,
    tp_ratio: 1.5,
    trail_trigger_pips: 10,
    trail_distance_pips: 8,
    breakeven_trigger_pips: 12
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingBotId, setEditingBotId] = useState(null);

  const availableIndicators = ['RSI', 'MACD', 'EMA', 'BollingerBands', 'Engulfing', 'PinBar'];
  const timeframes = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M10', 'M12', 'M15', 'M20', 'M30', 'H1', 'H2', 'H3', 'H4', 'H6', 'H8', 'H12', 'D1', 'W1', 'WN'];

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
        if (data.event_type === 'SCANNING') return prev;
        if (selectedBot && selectedBot.id !== data.bot_id) return prev;
        
        return [{
          id: Date.now(),
          bot_id: data.bot_id,
          bot_name: data.bot_name || `Bot #${data.bot_id}`,
          created_at: data.timestamp,
          event_type: data.event_type,
          message: data.message
        }, ...prev].slice(0, 100);
      });
    });

    return () => socket.disconnect();
  }, [user?.id, selectedBot]);

  const openCreateModal = () => {
    setIsEditMode(false);
    setEditingBotId(null);
    setFormData({
      bot_name: '', account_id: '', strategy_type: 'Scalper',
      primary_timeframe: '5m',
      analysis_timeframes: ['5m', '15m'],
      indicators_config: [{ name: 'RSI', weight: 40 }],
      min_confidence: 60,
      symbols: ['XAUUSD'],
      sl_pips: 15,
      tp_ratio: 1.5,
      trail_trigger_pips: 10,
      trail_distance_pips: 8,
      breakeven_trigger_pips: 12
    });
    setShowModal(true);
  };

  const openEditModal = (bot) => {
    setIsEditMode(true);
    setEditingBotId(bot.id);
    setFormData({
      bot_name: bot.bot_name || '',
      account_id: bot.account_id || '',
      strategy_type: bot.strategy_type || 'Custom',
      primary_timeframe: bot.primary_timeframe || '5m',
      analysis_timeframes: bot.analysis_timeframes || ['5m'],
      indicators_config: bot.indicators_config || [],
      min_confidence: bot.min_confidence || 60,
      symbols: bot.parameters?.symbols || ['XAUUSD'],
      sl_pips: bot.parameters?.sl_pips || 15,
      tp_ratio: bot.parameters?.tp_ratio || 1.5,
      trail_trigger_pips: bot.parameters?.trail_trigger_pips || 10,
      trail_distance_pips: bot.parameters?.trail_distance_pips || 8,
      breakeven_trigger_pips: bot.parameters?.breakeven_trigger_pips || 12
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        parameters: {
          symbols: formData.symbols,
          sl_pips: parseFloat(formData.sl_pips),
          tp_ratio: parseFloat(formData.tp_ratio),
          trail_trigger_pips: parseFloat(formData.trail_trigger_pips),
          trail_distance_pips: parseFloat(formData.trail_distance_pips),
          breakeven_trigger_pips: parseFloat(formData.breakeven_trigger_pips)
        }
      };
      if (isEditMode) {
        await api.updateBot(editingBotId, payload);
      } else {
        await api.createBot(payload);
      }
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
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Helpers for multi-select arrays
  const handleToggleAnalysisTF = (tf) => {
    const arr = formData.analysis_timeframes;
    if (arr.includes(tf)) setFormData({ ...formData, analysis_timeframes: arr.filter(x => x !== tf) });
    else setFormData({ ...formData, analysis_timeframes: [...arr, tf] });
  };

  const handleAddIndicator = () => {
    setFormData({
      ...formData,
      indicators_config: [...formData.indicators_config, { name: availableIndicators[0], weight: 20 }]
    });
  };

  const handleRemoveIndicator = (idx) => {
    const list = [...formData.indicators_config];
    list.splice(idx, 1);
    setFormData({ ...formData, indicators_config: list });
  };

  const handleIndicatorChange = (idx, field, value) => {
    const list = [...formData.indicators_config];
    list[idx][field] = field === 'weight' ? parseInt(value) || 0 : value;
    setFormData({ ...formData, indicators_config: list });
  };

  return (
    <>
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
        .modal-body-scroll {
          max-height: 70vh;
          overflow-y: auto;
          padding-right: 8px;
        }
        .tag-toggle {
          padding: 4px 12px;
          border-radius: 16px;
          border: 1px solid var(--border-primary);
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .tag-toggle.active {
          background: rgba(0, 230, 118, 0.15);
          border-color: var(--profit);
          color: var(--profit);
        }
      `}</style>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title">เครื่องมือเทรดอัตโนมัติ (Bots)</h1>
        </div>
        <div className="header-right" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => window.location.href = '/store'} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ShoppingCart size={14} /> เพิ่มจาก Store
          </button>
          <button className="btn btn-primary btn-sm" onClick={openCreateModal}>
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
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <div>กลยุทธ์: <strong style={{ color: 'var(--accent-secondary)' }}>{bot.strategy_type}</strong></div>
                  <div>TF หลัก: <strong>{bot.primary_timeframe}</strong></div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <span>ดู TF: {bot.analysis_timeframes?.join(', ')}</span>
                  <span>ความเชื่อมั่นขั้นต่ำ: {bot.min_confidence}%</span>
                </div>

                {liveActivities[bot.id] && (
                  <div style={{ 
                    padding: '8px 12px', borderRadius: 'var(--radius-sm)', 
                    background: liveActivities[bot.id].event_type === 'SCANNING' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0, 230, 118, 0.1)',
                    marginBottom: 16, fontSize: 11, display: 'flex', alignItems: 'center', gap: 8,
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
                  <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(bot)}>
                    <Settings size={14} />ตั้งค่า
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

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ width: 600, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">🤖 {isEditMode ? 'ตั้งค่า Trading Bot' : 'สร้าง Trading Bot ใหม่'}</h2>
            <form onSubmit={handleSubmit} className="modal-body-scroll">
              
              <div className="modal-grid-3">
                <div className="form-group">
                  <label className="form-label">ชื่อ Bot</label>
                  <input className="form-input" required value={formData.bot_name} onChange={e => setFormData({ ...formData, bot_name: e.target.value })} placeholder="เช่น Sniper V1" />
                </div>
                <div className="form-group">
                  <label className="form-label">ผูกกับบัญชีเทรด</label>
                  <select className="filter-select" required value={formData.account_id} onChange={e => setFormData({ ...formData, account_id: e.target.value })} style={{ width: '100%' }}>
                    <option value="">-- เลือกบัญชี --</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.account_name} ({acc.account_number})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">ประเภทกลยุทธ์พื้นฐาน</label>
                  <select className="filter-select" value={formData.strategy_type} onChange={e => setFormData({ ...formData, strategy_type: e.target.value })} style={{ width: '100%' }}>
                    <option value="Scalper">Scalper (เก็บสั้น)</option>
                    <option value="Swing">Swing Trade</option>
                    <option value="Grid">Grid Trading</option>
                    <option value="Martingale">Martingale</option>
                    <option value="Custom">Custom (ปรับแต่งเอง)</option>
                  </select>
                </div>
              </div>

              <div className="modal-grid-2">
                <div className="form-group">
                  <label className="form-label">Timeframe หลัก (ในการเข้าไม้)</label>
                  <select className="filter-select" value={formData.primary_timeframe} onChange={e => setFormData({ ...formData, primary_timeframe: e.target.value })} style={{ width: '100%' }}>
                    {timeframes.map(tf => <option key={tf} value={tf}>{tf}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">คู่เงินที่เทรด (Symbols - คั่นด้วยจุลภาค)</label>
                  <input className="form-input" required value={formData.symbols.join(', ')} onChange={e => setFormData({ ...formData, symbols: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="XAUUSD, EURUSD" />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="form-label">ต้องวิเคราะห์จากกราฟใดบ้าง (Analysis Timeframes)</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {timeframes.map(tf => (
                    <button 
                      key={tf} type="button" 
                      className={`tag-toggle ${formData.analysis_timeframes.includes(tf) ? 'active' : ''}`}
                      onClick={() => handleToggleAnalysisTF(tf)}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  เลือก Timeframe ให้อัลกอริทึมวิเคราะห์เทรนด์และสัญญาณประกอบการตัดสินใจ
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 16, borderTop: '1px solid var(--border-primary)', paddingTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label className="form-label" style={{ margin: 0 }}>ตั้งค่า Indicators (กำหนดน้ำหนักคะแนนรวม = 100%)</label>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={handleAddIndicator}>
                    <Plus size={14} /> เพิ่ม Indicator
                  </button>
                </div>
                {formData.indicators_config.length === 0 && (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 12, textAlign: 'center', padding: 10 }}>ไม่มีการตั้งค่า Indicator ใช้การตัดสินใจพื้นฐาน</div>
                )}
                {formData.indicators_config.map((ind, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'center' }}>
                    <select className="filter-select" value={ind.name} onChange={e => handleIndicatorChange(idx, 'name', e.target.value)} style={{ flex: 1 }}>
                      {availableIndicators.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>น้ำหนัก:</span>
                      <input 
                        type="number" min="0" max="100" 
                        className="form-input" 
                        style={{ width: 80, padding: '4px 8px', height: 'auto' }} 
                        value={ind.weight} 
                        onChange={e => handleIndicatorChange(idx, 'weight', e.target.value)} 
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>%</span>
                    </div>
                    <button type="button" className="btn-icon" onClick={() => handleRemoveIndicator(idx)} style={{ color: 'var(--loss)' }}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>ความเชื่อมั่นขั้นต่ำในการออกไม้ (Min Confidence)</span>
                  <span style={{ color: 'var(--profit)' }}>{formData.min_confidence}%</span>
                </label>
                <input 
                  type="range" 
                  min="0" max="100" step="5"
                  style={{ width: '100%', accentColor: 'var(--profit)' }}
                  value={formData.min_confidence}
                  onChange={e => setFormData({ ...formData, min_confidence: parseInt(e.target.value) })}
                />
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  คะแนนที่คำนวณจาก Indicators ต้องถึงเป้าหมายจึงจะเปิดออเดอร์
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 16, marginBottom: 16 }}>
                <h4 style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-primary)' }}>ตั้งค่าความเสี่ยง และ Trailing Stop / TP</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Stop Loss (Pips)</label>
                    <input type="number" step="0.1" min="1" className="form-input" required value={formData.sl_pips} onChange={e => setFormData({ ...formData, sl_pips: e.target.value })} placeholder="15" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">TP Ratio (Risk:Reward)</label>
                    <input type="number" step="0.1" min="0.1" className="form-input" required value={formData.tp_ratio} onChange={e => setFormData({ ...formData, tp_ratio: e.target.value })} placeholder="1.5 = 1.5x ของ SL" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div className="form-group" title="เลื่อน SL มาคุ้มทุนเมื่อกำไรถึง (Pips)">
                    <label className="form-label">Breakeven Pips</label>
                    <input type="number" step="0.1" min="0" className="form-input" required value={formData.breakeven_trigger_pips} onChange={e => setFormData({ ...formData, breakeven_trigger_pips: e.target.value })} />
                  </div>
                  <div className="form-group" title="เริ่ม Trailing เมื่อกำไรถึง (Pips)">
                    <label className="form-label">Trail Start Pips</label>
                    <input type="number" step="0.1" min="0" className="form-input" required value={formData.trail_trigger_pips} onChange={e => setFormData({ ...formData, trail_trigger_pips: e.target.value })} />
                  </div>
                  <div className="form-group" title="ระยะ SL จากจุดราคาสูงสุด (Pips)">
                    <label className="form-label">Trail Distance</label>
                    <input type="number" step="0.1" min="1" className="form-input" required value={formData.trail_distance_pips} onChange={e => setFormData({ ...formData, trail_distance_pips: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="modal-actions" style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary">{isEditMode ? 'บันทึกการแก้ไข' : 'สร้าง Bot'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
