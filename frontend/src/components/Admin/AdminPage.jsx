import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import {
  Shield, Users, BarChart3, DollarSign, Activity, Search,
  Edit2, UserCheck, UserX, Eye, AlertTriangle, Clock, ChevronDown,
  Building, UserPlus, Percent, X
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
  const [editingUser, setEditingUser] = useState(null);
  const [agents, setAgents] = useState([]);
  const [totalAgents, setTotalAgents] = useState(0);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [agentForm, setAgentForm] = useState({ user_id: '', tenant_name: '', platform_name: '', revenue_share_pct: 10, max_users: 50 });
  const [agentStats, setAgentStats] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);

  const fetchData = useCallback(async () => {
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
      } else if (activeTab === 'agents') {
        const data = await api.getAdminAgents({ search, page, limit: 20 });
        setAgents(data.agents);
        setTotalAgents(data.total);
      }
    } catch (err) {
      console.error('Admin fetch error:', err);
    }
  }, [activeTab, search, roleFilter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    if (val === undefined || val === null || val === '') return '$0.00';
    const num = parseFloat(val);
    if (isNaN(num)) return '$0.00';
    if (num === 0) return '$0.00';
    const prefix = num > 0 ? '+' : '-';
    return `${prefix}$${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    try {
      await api.createAdminAgent(agentForm);
      setShowCreateAgent(false);
      setAgentForm({ user_id: '', tenant_name: '', platform_name: '', revenue_share_pct: 10, max_users: 50 });
      fetchData();
    } catch (err) {
      alert(err.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleViewAgentStats = async (userId) => {
    try {
      const data = await api.getAdminAgentStats(userId);
      setAgentStats(data);
      setSelectedAgent(userId);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateAgent = async (userId, updates) => {
    try {
      await api.updateAdminAgent(userId, updates);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
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
    { id: 'agents', label: 'จัดการตัวแทน', icon: Building },
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
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Admin</option>
                    <option value="agent">Agent</option>
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

            {/* Agents Tab */}
            {activeTab === 'agents' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 600 }}>🏢 จัดการตัวแทน (Agent / B2B Partner)</h4>
                  <button className="btn btn-sm btn-primary" onClick={() => setShowCreateAgent(true)}>
                    <UserPlus size={14} /> สร้างตัวแทนใหม่
                  </button>
                </div>

                <div className="data-table-wrapper" style={{ border: 'none' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ตัวแทน</th>
                        <th>แพลตฟอร์ม</th>
                        <th>สมาชิก</th>
                        <th>Revenue Share</th>
                        <th>คอมมิชชั่นรวม</th>
                        <th>สถานะ</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>ยังไม่มีตัวแทน</td></tr>
                      ) : agents.map(a => (
                        <tr key={a.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: '50%',
                                background: a.primary_color || 'var(--gradient-primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 700, color: '#fff'
                              }}>
                                {(a.display_name || a.username)?.[0]?.toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{a.display_name || a.username}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{a.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>{a.platform_name || a.tenant_name || '-'}</div>
                            {a.domain && <div style={{ fontSize: 10, color: 'var(--accent-primary)' }}>{a.domain}</div>}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{parseInt(a.member_count || 0)}/{a.max_users || 50}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Percent size={12} style={{ color: 'var(--warning)' }} />
                              {parseFloat(a.revenue_share_pct || 10).toFixed(1)}%
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--warning)' }}>
                            ${parseFloat(a.total_commission || 0).toFixed(2)}
                          </td>
                          <td>
                            <span className={`badge ${a.is_active ? 'badge-buy' : 'badge-sell'}`}>
                              {a.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-ghost btn-icon" onClick={() => handleViewAgentStats(a.id)}
                                title="ดูสถิติ" style={{ width: 28, height: 28 }}>
                                <Eye size={12} />
                              </button>
                              <button className="btn btn-ghost btn-icon" onClick={() => handleUpdateAgent(a.id, { is_active: !a.is_active })}
                                title={a.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'} style={{ width: 28, height: 28 }}>
                                {a.is_active ? <UserX size={12} style={{ color: 'var(--loss)' }} /> : <UserCheck size={12} style={{ color: 'var(--profit)' }} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalAgents > 20 && (
                  <div className="pagination">
                    <span className="pagination-info">{totalAgents} ตัวแทน</span>
                    <div className="pagination-buttons">
                      <button className="pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>ก่อนหน้า</button>
                      <button className="pagination-btn active">{page}</button>
                      <button className="pagination-btn" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= totalAgents}>ถัดไป</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Agent Modal */}
      {showCreateAgent && (
        <div className="modal-overlay" onClick={() => setShowCreateAgent(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserPlus size={20} /> สร้างตัวแทนใหม่
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
              เลือกผู้ใช้ที่ต้องการ promote เป็น Agent แล้วสร้าง Tenant ให้
            </p>
            <form onSubmit={handleCreateAgent}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">User ID *</label>
                <input className="form-input" type="number" required value={agentForm.user_id}
                  onChange={e => setAgentForm(f => ({ ...f, user_id: e.target.value }))} placeholder="เช่น 5" />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">ชื่อ Tenant *</label>
                <input className="form-input" required value={agentForm.tenant_name}
                  onChange={e => setAgentForm(f => ({ ...f, tenant_name: e.target.value }))} placeholder="เช่น Alpha Trading Team" />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">ชื่อแพลตฟอร์ม</label>
                <input className="form-input" value={agentForm.platform_name}
                  onChange={e => setAgentForm(f => ({ ...f, platform_name: e.target.value }))} placeholder="เช่น AlphaTrade" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div className="form-group">
                  <label className="form-label">Revenue Share (%)</label>
                  <input className="form-input" type="number" step="0.5" min="0" max="50"
                    value={agentForm.revenue_share_pct} onChange={e => setAgentForm(f => ({ ...f, revenue_share_pct: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">สมาชิกสูงสุด</label>
                  <input className="form-input" type="number" min="1" max="1000"
                    value={agentForm.max_users} onChange={e => setAgentForm(f => ({ ...f, max_users: e.target.value }))} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateAgent(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary">สร้างตัวแทน</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Agent Stats Modal */}
      {selectedAgent && agentStats && (
        <div className="modal-overlay" onClick={() => { setSelectedAgent(null); setAgentStats(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={20} /> สถิติตัวแทน: {agentStats.tenant?.name}
            </h2>
            <div className="stat-grid" style={{ marginBottom: 20 }}>
              <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="card-title" style={{ marginBottom: 4 }}>สมาชิก</div>
                <div className="card-value" style={{ fontSize: 18 }}>
                  {parseInt(agentStats.members?.active || 0)} / {parseInt(agentStats.members?.total || 0)}
                </div>
                <div className="card-sub">Active / Total</div>
              </div>
              <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="card-title" style={{ marginBottom: 4 }}>เทรดรวม</div>
                <div className="card-value" style={{ fontSize: 18 }}>
                  {parseInt(agentStats.trades?.total_trades || 0).toLocaleString()}
                </div>
                <div className="card-sub">
                  Win {parseInt(agentStats.trades?.winning || 0)} / Lose {parseInt(agentStats.trades?.losing || 0)}
                </div>
              </div>
              <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="card-title" style={{ marginBottom: 4 }}>กำไร/ขาดทุน</div>
                <div className={`card-value ${parseFloat(agentStats.trades?.total_pnl) >= 0 ? 'profit' : 'loss'}`} style={{ fontSize: 18 }}>
                  {formatCurrency(agentStats.trades?.total_pnl)}
                </div>
              </div>
            </div>
            <div className="stat-grid" style={{ marginBottom: 20 }}>
              <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="card-title" style={{ marginBottom: 4 }}>คอมมิชชั่นจ่ายแล้ว</div>
                <div className="card-value profit" style={{ fontSize: 18 }}>
                  ${parseFloat(agentStats.commissions?.settled || 0).toFixed(2)}
                </div>
              </div>
              <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="card-title" style={{ marginBottom: 4 }}>คอมมิชชั่นรอจ่าย</div>
                <div className="card-value" style={{ fontSize: 18, color: 'var(--warning)' }}>
                  ${parseFloat(agentStats.commissions?.pending || 0).toFixed(2)}
                </div>
              </div>
              <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="card-title" style={{ marginBottom: 4 }}>ลิงก์เชิญ</div>
                <div className="card-value" style={{ fontSize: 18 }}>
                  {parseInt(agentStats.invitations?.active || 0)} / {parseInt(agentStats.invitations?.total || 0)}
                </div>
                <div className="card-sub">Active / Total</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: '1px solid var(--border-primary)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                Revenue Share: <strong style={{ color: 'var(--warning)' }}>{parseFloat(agentStats.tenant?.revenue_share_pct || 10)}%</strong>
                {' | '}สมาชิกสูงสุด: <strong>{agentStats.tenant?.max_users || 50}</strong>
                {' | '}Plan: <strong>{agentStats.tenant?.subscription_plan || 'enterprise'}</strong>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setSelectedAgent(null); setAgentStats(null); }}>ปิด</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
