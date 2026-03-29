import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import {
  Shield, Users, BarChart3, DollarSign, Activity, Search,
  Edit2, UserCheck, UserX, Eye, AlertTriangle, Clock, ChevronDown
} from 'lucide-react';

export default function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [auditLogs, setAuditLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const [ov, rl] = await Promise.all([
          api.getAdminOverview(),
          api.getAdminRoles(),
        ]);
        setOverview(ov);
        setRoles(rl);
      } else if (activeTab === 'users') {
        const data = await api.getAdminUsers({ search, role: roleFilter, page, limit: 20 });
        setUsers(data.users);
        setTotalUsers(data.total);
      } else if (activeTab === 'audit') {
        const data = await api.getAuditLogs({ page, limit: 30 });
        setAuditLogs(data.logs);
        setTotalLogs(data.total);
      }
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeTab, page]);
  useEffect(() => { if (activeTab === 'users') fetchData(); }, [search, roleFilter]);

  const handleUpdateUser = async (userId, updates) => {
    try {
      await api.updateAdminUser(userId, updates);
      setEditingUser(null);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const formatCurrency = (val) => {
    if (!val && val !== 0) return '$0.00';
    return `$${parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const [showKillModal, setShowKillModal] = useState(false);
  const [killReason, setKillReason] = useState('');
  const [isKilling, setIsKilling] = useState(false);

  const handleKillSwitch = async (e) => {
    e.preventDefault();
    setIsKilling(true);
    try {
      const res = await api.activateKillSwitch({ reason: killReason });
      alert(`Kill Switch Activated!\nBots Stopped: ${res.bots_stopped}\nOrders Cancelled: ${res.orders_cancelled}`);
      setShowKillModal(false);
      setKillReason('');
      fetchData(); // Refresh overview
    } catch (err) {
      alert(err.message);
    } finally {
      setIsKilling(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <>
        <div className="header"><div className="header-left"><h1 className="page-title">แผงควบคุมผู้ดูแล</h1></div></div>
        <div className="content-area">
          <div className="chart-card" style={{ textAlign: 'center', padding: 60 }}>
            <Shield size={64} style={{ color: 'var(--loss)', marginBottom: 16 }} />
            <h2 style={{ fontWeight: 700, marginBottom: 8 }}>ไม่มีสิทธิ์เข้าถึง</h2>
            <p style={{ color: 'var(--text-tertiary)' }}>ต้องเป็น Admin เท่านั้น</p>
          </div>
        </div>
      </>
    );
  }

  const tabs = [
    { id: 'overview', label: 'ภาพรวมระบบ', icon: Activity },
    { id: 'users', label: 'จัดการผู้ใช้', icon: Users },
    { id: 'audit', label: 'Audit Logs', icon: Eye },
  ];

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={20} style={{ color: 'var(--accent-primary)' }} />
            แผงควบคุมระบบ (Admin)
          </h1>
        </div>
        <div className="header-right">
          <button className="btn btn-sm" style={{ background: 'var(--loss-bg)', color: 'var(--loss)', border: '1px solid var(--loss)' }} onClick={() => setShowKillModal(true)}>
            <AlertTriangle size={14} /> STOP SYSTEM (Kill Switch)
          </button>
        </div>
      </div>

      {showKillModal && (
        <div className="modal-overlay" onClick={() => setShowKillModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ border: '2px solid var(--loss)' }}>
            <h2 className="modal-title" style={{ color: 'var(--loss)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={24} /> ยืนยันหยุดการทำงานฉุกเฉิน
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 13, lineHeight: 1.5 }}>
              การกดใช้งาน <strong>Kill Switch</strong> จะทำให้:
              <br/>1. Trading Bots ทุกตัวในระบบหยุดทำงาน (Status = STOPPED)
              <br/>2. คำสั่งซื้อขายที่ค้างอยู่ (Pending Orders) ถูกยกเลิกทันที
            </p>
            <form onSubmit={handleKillSwitch}>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">เหตุผล / ข้อความใน Audit Log</label>
                <input 
                  className="form-input" 
                  autoFocus 
                  required 
                  value={killReason} 
                  onChange={e => setKillReason(e.target.value)} 
                  placeholder="เช่น พบความผันผวนของตลาดผิดปกติ..." 
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowKillModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--loss)', color: '#fff' }} disabled={isKilling}>
                  {isKilling ? 'กำลังหยุดระบบ...' : 'ยืนยันหยุดการทำงาน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="content-area">
        {/* Tab navigation */}
        <div className="chart-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', background: 'rgba(0,0,0,0.1)' }}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setPage(1); }} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px',
                  background: 'transparent', border: 'none',
                  color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  cursor: 'pointer', fontWeight: activeTab === tab.id ? 600 : 500, fontSize: 14, marginBottom: -1
                }}>
                  <Icon size={16} />{tab.label}
                </button>
              );
            })}
          </div>

          <div style={{ padding: 'var(--space-xl)' }}>
            {/* Overview Tab */}
            {activeTab === 'overview' && overview && (
              <div>
                <div className="stat-grid" style={{ marginBottom: 24 }}>
                  <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="card-header">
                      <span className="card-title">ผู้ใช้ทั้งหมด</span>
                      <Users size={16} style={{ color: 'var(--accent-primary)' }} />
                    </div>
                    <div className="card-value">{overview.total_users}</div>
                    <div className="card-sub">{overview.active_traders} คนมีบัญชีเทรด</div>
                  </div>
                  <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="card-header">
                      <span className="card-title">เทรดทั้งหมด</span>
                      <BarChart3 size={16} style={{ color: 'var(--accent-secondary)' }} />
                    </div>
                    <div className="card-value">{overview.total_trades.toLocaleString()}</div>
                  </div>
                  <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="card-header">
                      <span className="card-title">กลุ่มทั้งหมด</span>
                      <Users size={16} style={{ color: 'var(--accent-tertiary)' }} />
                    </div>
                    <div className="card-value">{overview.total_groups}</div>
                  </div>
                  <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="card-header">
                      <span className="card-title">กำไรรวมระบบ</span>
                      <DollarSign size={16} style={{ color: overview.total_pnl >= 0 ? 'var(--profit)' : 'var(--loss)' }} />
                    </div>
                    <div className={`card-value ${overview.total_pnl >= 0 ? 'profit' : 'loss'}`}>
                      {formatCurrency(overview.total_pnl)}
                    </div>
                  </div>
                </div>

                {/* Revenue */}
                <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>💰 ข้อมูลรายได้</h4>
                <div className="stat-grid">
                  <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="card-title" style={{ marginBottom: 8 }}>ฝากเงินรวม</div>
                    <div className="card-value profit" style={{ fontSize: 20 }}>{formatCurrency(overview.revenue?.total_deposits)}</div>
                  </div>
                  <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="card-title" style={{ marginBottom: 8 }}>ถอนเงินรวม</div>
                    <div className="card-value loss" style={{ fontSize: 20 }}>{formatCurrency(overview.revenue?.total_withdrawals)}</div>
                  </div>
                  <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="card-title" style={{ marginBottom: 8 }}>ค่าธรรมเนียมรวม</div>
                    <div className="card-value" style={{ fontSize: 20, color: 'var(--warning)' }}>{formatCurrency(overview.revenue?.total_fees)}</div>
                  </div>
                </div>

                {/* Roles */}
                {roles.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>🔑 บทบาทในระบบ</h4>
                    <div style={{ display: 'flex', gap: 12 }}>
                      {roles.map(r => (
                        <div key={r.id} className="card" style={{ background: 'var(--bg-tertiary)', flex: 1 }}>
                          <div style={{ fontWeight: 600, textTransform: 'capitalize', marginBottom: 4 }}>{r.role_name}</div>
                          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{r.user_count}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input className="form-input" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                      placeholder="ค้นหาชื่อผู้ใช้, อีเมล..." style={{ paddingLeft: 36, width: '100%' }}
                    />
                  </div>
                  <select className="filter-select" value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}>
                    <option value="">ทุกบทบาท</option>
                    <option value="admin">Admin</option>
                    <option value="team_lead">Team Lead</option>
                    <option value="user">User</option>
                  </select>
                </div>

                <div className="data-table-wrapper" style={{ border: 'none' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ผู้ใช้</th>
                        <th>อีเมล</th>
                        <th>บทบาท</th>
                        <th>บัญชี</th>
                        <th>กำไรรวม</th>
                        <th>สถานะ</th>
                        <th>เข้าสู่ระบบล่าสุด</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td style={{ fontFamily: 'var(--font-sans)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0a0e17' }}>
                                {(u.display_name || u.username)?.[0]?.toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{u.display_name || u.username}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>@{u.username}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontFamily: 'var(--font-sans)', fontSize: 12 }}>{u.email}</td>
                          <td>
                            {editingUser === u.id ? (
                              <select className="filter-select" defaultValue={u.role}
                                onChange={e => handleUpdateUser(u.id, { role_name: e.target.value })}
                                style={{ minWidth: 100 }}
                              >
                                <option value="admin">Admin</option>
                                <option value="team_lead">Team Lead</option>
                                <option value="user">User</option>
                              </select>
                            ) : (
                              <span className={`badge ${u.role === 'admin' ? 'badge-sell' : u.role === 'team_lead' ? 'badge-open' : 'badge-closed'}`}>
                                {u.role || 'user'}
                              </span>
                            )}
                          </td>
                          <td>{u.accounts_count}</td>
                          <td className={parseFloat(u.total_pnl) >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                            {formatCurrency(u.total_pnl)}
                          </td>
                          <td>
                            <span className={`badge ${u.is_active ? 'badge-buy' : 'badge-sell'}`}>
                              {u.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                            {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('th-TH') : '-'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-ghost btn-icon" onClick={() => setEditingUser(editingUser === u.id ? null : u.id)} style={{ width: 28, height: 28 }}>
                                <Edit2 size={12} />
                              </button>
                              <button className="btn btn-ghost btn-icon" onClick={() => handleUpdateUser(u.id, { is_active: !u.is_active })} style={{ width: 28, height: 28 }}>
                                {u.is_active ? <UserX size={12} style={{ color: 'var(--loss)' }} /> : <UserCheck size={12} style={{ color: 'var(--profit)' }} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalUsers > 20 && (
                  <div className="pagination">
                    <span className="pagination-info">{totalUsers} ผู้ใช้</span>
                    <div className="pagination-buttons">
                      <button className="pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>ก่อนหน้า</button>
                      <button className="pagination-btn active">{page}</button>
                      <button className="pagination-btn" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= totalUsers}>ถัดไป</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Audit Logs Tab */}
            {activeTab === 'audit' && (
              <div>
                <div className="data-table-wrapper" style={{ border: 'none' }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>เวลา</th><th>ผู้ใช้</th><th>การกระทำ</th><th>รายละเอียด</th><th>IP Address</th></tr>
                    </thead>
                    <tbody>
                      {auditLogs.length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>ไม่มีข้อมูล Audit Log</td></tr>
                      ) : auditLogs.map(log => (
                        <tr key={log.id}>
                          <td style={{ fontFamily: 'var(--font-sans)', fontSize: 11 }}>
                            {new Date(log.created_at).toLocaleDateString('th-TH')}{' '}
                            {new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ fontFamily: 'var(--font-sans)', fontWeight: 500 }}>{log.display_name || log.username || '-'}</td>
                          <td>
                            <span className={`badge ${log.action?.includes('login') ? 'badge-buy' : log.action?.includes('delete') ? 'badge-sell' : 'badge-open'}`}>
                              {log.action}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-tertiary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {log.details ? JSON.stringify(log.details).substring(0, 80) : '-'}
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.ip_address || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalLogs > 30 && (
                  <div className="pagination">
                    <span className="pagination-info">{totalLogs} รายการ</span>
                    <div className="pagination-buttons">
                      <button className="pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>ก่อนหน้า</button>
                      <button className="pagination-btn active">{page}</button>
                      <button className="pagination-btn" onClick={() => setPage(p => p + 1)} disabled={page * 30 >= totalLogs}>ถัดไป</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
