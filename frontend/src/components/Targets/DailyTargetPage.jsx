import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../utils/api';
import { useAccounts } from '../../context/AccountContext';
import {
  Target, Plus, Trash2, Check, Play, Pause, Clock, Trophy, History
} from 'lucide-react';

export default function DailyTargetPage({ embedded = false, isActive = true }) {
  const { accounts } = useAccounts();
  const [targets, setTargets] = useState([]);
  const [targetStatus, setTargetStatus] = useState([]);
  const [history, setHistory] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ account_id: '', target_amount: '', action_on_reach: 'NOTIFY' });
  const [showModal, setShowModal] = useState(null); // target that reached

  const fetchData = useCallback(async () => {
    try {
      const [t, s, h] = await Promise.all([
        api.getTargets(),
        api.getTargetStatus(),
        api.getTargetHistory(),
      ]);
      setTargets(t);
      setTargetStatus(s);
      setHistory(h);
    } catch (err) {
      console.error('Targets error:', err);
    }
  }, []);

  const [portalTarget, setPortalTarget] = useState(null);
  useEffect(() => {
    if (embedded) {
      setPortalTarget(document.getElementById('trading-header-actions'));
    }
  }, [embedded]);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  // Check for newly reached targets
  useEffect(() => {
    const newlyReached = targetStatus.find(s => s.reached && !s.handled);
    if (newlyReached && !showModal) {
      setTimeout(() => setShowModal(newlyReached), 0);
    }
  }, [targetStatus, showModal]);

  const handleCreate = async () => {
    try {
      await api.createTarget({
        account_id: formData.account_id || null,
        target_amount: parseFloat(formData.target_amount),
        action_on_reach: formData.action_on_reach,
      });
      setShowForm(false);
      setFormData({ account_id: '', target_amount: '', action_on_reach: 'NOTIFY' });
      fetchData();
    } catch (err) {
      console.error('Create target error:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!await window.customConfirm('ลบเป้าหมายนี้?')) return;
    await api.deleteTarget(id);
    fetchData();
  };

  const handleToggle = async (id, isActive) => {
    await api.updateTarget(id, { is_active: !isActive });
    fetchData();
  };

  const handleAction = async (targetId, action) => {
    await api.targetAction(targetId, { action });
    setShowModal(null);
    fetchData();
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null || val === '') return '$0.00';
    const num = parseFloat(val);
    if (isNaN(num)) return '$0.00';
    if (num === 0) return '$0.00';
    const prefix = num > 0 ? '+' : '-';
    return `${prefix}$${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <>
      {!embedded && (
      <div className="header">
        <div className="header-left">
          <h1 className="page-title">เป้ากำไรรายวัน</h1>
        </div>
        <div className="header-right">
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
            <Plus size={14} /> ตั้งเป้าใหม่
          </button>
        </div>
      </div>
      )}

      {embedded && isActive && portalTarget && createPortal(
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} /> ตั้งเป้าใหม่
        </button>,
        portalTarget
      )}

      <div className={embedded ? "" : "content-area"}>
        {/* Create Form */}
        {showForm && (
          <div className="settings-section" style={{ marginBottom: 'var(--space-lg)' }}>
            <h3 className="settings-section-title"><Target size={18} /> ตั้งเป้ากำไรใหม่</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label className="form-label">บัญชี</label>
                <select
                  className="filter-select"
                  value={formData.account_id}
                  onChange={e => setFormData(p => ({ ...p, account_id: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px' }}
                >
                  <option value="">รวมทุกบัญชี</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.account_name} ({a.broker_display_name})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">เป้ากำไร (USD)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="100.00"
                  value={formData.target_amount}
                  onChange={e => setFormData(p => ({ ...p, target_amount: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">เมื่อถึงเป้า</label>
                <select
                  className="filter-select"
                  value={formData.action_on_reach}
                  onChange={e => setFormData(p => ({ ...p, action_on_reach: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px' }}
                >
                  <option value="NOTIFY">แจ้งเตือนให้เลือก</option>
                  <option value="AUTO_STOP">หยุดอัตโนมัติ</option>
                </select>
              </div>
              <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={handleCreate} disabled={!formData.target_amount}>
                  <Check size={14} /> สร้างเป้าหมาย
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Targets with Progress */}
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 'var(--space-md)' }}>
          <Target size={16} style={{ color: 'var(--accent-primary)', marginRight: 8 }} />
          เป้าหมายที่กำลังใช้งาน
        </h3>

        {targetStatus.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>
            <Target size={40} style={{ opacity: 0.2, marginBottom: 'var(--space-md)' }} />
            <div>ยังไม่มีเป้าหมาย — กดปุ่ม "ตั้งเป้าใหม่" เพื่อเริ่มต้น</div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
          {targets.map(t => {
            const status = targetStatus.find(s => s.id === t.id);
            const progress = status?.progress || 0;
            const currentPnl = status?.current_pnl || 0;
            const reached = status?.reached || false;

            return (
              <div key={t.id} className={`target-widget ${reached ? 'reached' : ''}`}>
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-sm)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {t.account_name ? `${t.broker_name} — ${t.account_name}` : 'รวมทุกบัญชี'}
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 'normal', marginLeft: 12, fontSize: 14 }}>{progress.toFixed(1)}%</span>
                  </div>
                  <div className="flex gap-xs">
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => handleToggle(t.id, t.is_active)}
                      title={t.is_active ? 'หยุดชั่วคราว' : 'เปิดใช้งาน'}
                      style={{ width: 28, height: 28, padding: 0 }}
                    >
                      {t.is_active ? <Pause size={12} /> : <Play size={12} />}
                    </button>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => handleDelete(t.id)}
                      style={{ width: 28, height: 28, padding: 0, color: 'var(--loss)' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-sm)' }}>
                  <span className="font-mono" style={{
                    fontSize: 22, fontWeight: 700,
                    color: currentPnl >= 0 ? 'var(--profit)' : 'var(--loss)'
                  }}>
                    {currentPnl > 0 ? '+' : currentPnl < 0 ? '-' : ''}${Math.abs(currentPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="font-mono" style={{
                    fontSize: 22, fontWeight: 700, color: 'var(--text-secondary)'
                  }}>
                    / ${parseFloat(t.target_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="progress-bar" style={{ marginBottom: 'var(--space-xs)' }}>
                  <div className={`progress-fill ${reached ? 'reached' : ''}`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
                </div>

                <div className="flex justify-end" style={{ fontSize: 11 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    {t.action_on_reach === 'AUTO_STOP' ? '🔴 หยุดอัตโนมัติ' : '🔔 แจ้งเตือน'}
                  </span>
                </div>

                {reached && !status?.handled && (
                  <div style={{ marginTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-sm)' }}>
                    <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => handleAction(t.id, 'STOPPED')}>
                      <Pause size={12} /> หยุดเทรด
                    </button>
                    <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => handleAction(t.id, 'CONTINUED')}>
                      <Play size={12} /> เทรดต่อ
                    </button>
                  </div>
                )}
                
                {reached && status?.handled && (
                  <div style={{ marginTop: 'var(--space-md)', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', padding: '6px 0', background: 'var(--bg-secondary)', borderRadius: 4 }}>
                    <Check size={14} style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle', color: 'var(--success)' }} />
                    <span style={{ display: 'inline-block', verticalAlign: 'middle' }}>บันทึกการตัดสินใจแล้ว</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Target History */}
        {history.length > 0 && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 'var(--space-md)' }}>
              <History size={16} style={{ color: 'var(--accent-secondary)', marginRight: 8 }} />
              ประวัติการถึงเป้า
            </h3>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>วันที่</th>
                    <th>บัญชี</th>
                    <th>เป้าหมาย</th>
                    <th>กำไรตอนถึงเป้า</th>
                    <th>การตัดสินใจ</th>
                    <th>กำไรสุดท้าย</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id}>
                      <td>{new Date(h.reached_date).toLocaleDateString('th-TH')}</td>
                      <td style={{ fontFamily: 'var(--font-sans)' }}>{h.account_name || 'รวมทั้งหมด'}</td>
                      <td>{formatCurrency(h.target_amount)}</td>
                      <td className="pnl-positive">{formatCurrency(h.pnl_at_reach)}</td>
                      <td>
                        <span className={`badge ${h.user_action === 'STOPPED' ? 'badge-sell' : 'badge-buy'}`}>
                          {h.user_action === 'STOPPED' ? 'หยุดเทรด' : 'เทรดต่อ'}
                        </span>
                      </td>
                      <td className={parseFloat(h.final_pnl || 0) >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                        {h.final_pnl ? formatCurrency(h.final_pnl) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Target Reached Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
              <Trophy size={48} style={{ color: 'var(--profit)', marginBottom: 'var(--space-md)' }} />
              <h2 className="modal-title">🎯 ถึงเป้ากำไรแล้ว!</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                กำไรวันนี้ถึงเป้าที่ตั้งไว้แล้ว
              </p>
            </div>

            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--text-tertiary)' }}>กำไรปัจจุบัน</span>
                <span className="font-mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--profit)' }}>
                  +${showModal.current_pnl?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center mt-md">
                <span style={{ color: 'var(--text-tertiary)' }}>เป้าหมาย</span>
                <span className="font-mono" style={{ fontSize: 18, color: 'var(--text-primary)' }}>
                  ${parseFloat(showModal.target_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 'var(--space-lg)', textAlign: 'center' }}>
              คุณต้องการหยุดเทรดหรือเทรดต่อ?
            </p>

            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn btn-danger btn-lg" onClick={() => handleAction(showModal.id, 'STOPPED')}>
                <Pause size={16} /> หยุดเทรด
              </button>
              <button className="btn btn-primary btn-lg" onClick={() => handleAction(showModal.id, 'CONTINUED')}>
                <Play size={16} /> เทรดต่อ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
