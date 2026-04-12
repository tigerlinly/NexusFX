import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import ConfirmDialog from '../Layout/ConfirmDialog';
import {
  Shield, Users, BarChart3, DollarSign, Activity, Search,
  Edit2, UserCheck, UserX, Eye, AlertTriangle, Clock, ChevronDown,
  Building, UserPlus, Percent, X, Zap, CheckCircle, Calculator, RefreshCw, Trash2, Key
} from 'lucide-react';
import DockerNodes from './DockerNodes';
import AdminUsageDashboard from './AdminUsageDashboard';

export default function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [auditLogs, setAuditLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [rolesData, setRolesData] = useState([]);
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
  const [commissionStatus, setCommissionStatus] = useState(null);
  const [settlingAgent, setSettlingAgent] = useState(null);
  const [calcRunning, setCalcRunning] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustData, setAdjustData] = useState({ userId: null, amount: '', reason: '', username: '' });
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ userId: null, newPassword: '', username: '' });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [adjustments, setAdjustments] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({ open: false });

  // Helper: show custom confirm dialog
  const showConfirm = (message, onConfirm, options = {}) => {
    setConfirmDialog({ open: true, message, onConfirm, ...options });
  };
  const closeConfirm = () => setConfirmDialog({ open: false });

  const fetchData = useCallback(async () => {
    try {
      if (activeTab === 'users') {
        const data = await api.getAdminUsers({ search, role: roleFilter, page, limit: 20 });
        setUsers(data.users);
        setTotalUsers(data.total);
      } else if (activeTab === 'adjustments') {
        const data = await api.getAdjustments('PENDING');
        setAdjustments(data);
      } else if (activeTab === 'audit') {
        const data = await api.getAuditLogs({ page, limit: 30 });
        setAuditLogs(data.logs);
        setTotalLogs(data.total);
      } else if (activeTab === 'role_details') {
        const data = await api.getAdminRoles();
        setRolesData(data || []);
      } else if (activeTab === 'agents') {
        const [data, status] = await Promise.all([
          api.getAdminAgents({ search, page, limit: 20 }),
          api.getCommissionEngineStatus().catch(() => null),
        ]);
        setAgents(data.agents);
        setTotalAgents(data.total);
        if (status) setCommissionStatus(status);
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

  const handleDeleteUser = async (user) => {
    showConfirm(
      `ยืนยันการลบผู้ใช้ ${user.username} หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`,
      async () => {
        closeConfirm();
        try {
          await api.deleteAdminUser(user.id);
          alert('ลบผู้ใช้สำเร็จ');
          fetchData();
        } catch (err) {
          alert('❌ ' + (err.message || 'เกิดข้อผิดพลาด'));
        }
      },
      { title: 'ยืนยันการลบผู้ใช้', confirmText: 'ลบผู้ใช้', variant: 'danger' }
    );
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

  const handleSettleCommissions = async (userId) => {
    showConfirm(
      'ต้องการจ่ายค่าคอมมิชชั่นค้างจ่ายทั้งหมดให้ตัวแทนนี้หรือไม่? ยอดเงินจะถูกโอนเข้า Wallet ของตัวแทนทันที',
      async () => {
        closeConfirm();
        setSettlingAgent(userId);
        try {
          const res = await api.settleAgentCommissions(userId);
          alert(`✅ จ่ายค่าคอมสำเร็จ\nจำนวน: ${res.settled_count} รายการ\nยอดรวม: $${parseFloat(res.settled_amount || 0).toFixed(2)}`);
          fetchData();
        } catch (err) {
          alert('❌ ' + (err.message || 'เกิดข้อผิดพลาด'));
        } finally {
          setSettlingAgent(null);
        }
      },
      { title: 'ยืนยันการจ่ายค่าคอมมิชชั่น', confirmText: 'จ่ายเลย', variant: 'success' }
    );
  };

  const handleTriggerCalc = async () => {
    showConfirm(
      'ระบบจะคำนวณค่าคอมมิชชั่นใหม่ทั้งหมด สำหรับตัวแทนทุกคนในระบบ ใช้เวลาสักครู่',
      async () => {
        closeConfirm();
        setCalcRunning(true);
        try {
          const res = await api.triggerCommissionCalc();
          alert(`✅ คำนวณค่าคอมสำเร็จ\nตัวแทนที่ประมวลผล: ${res.agents_processed || 0}\nค่าคอมใหม่: ${res.commissions_created || 0} รายการ`);
          fetchData();
        } catch (err) {
          alert('❌ ' + (err.message || 'เกิดข้อผิดพลาด'));
        } finally {
          setCalcRunning(false);
        }
      },
      { title: 'ยืนยันการคำนวณค่าคอมมิชชั่นทั้งระบบ', confirmText: 'คำนวณเลย', variant: 'warning' }
    );
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setIsChangingPassword(true);
    try {
      await api.adminChangeUserPassword(passwordData.userId, { new_password: passwordData.newPassword });
      alert(`✅ เปลี่ยนรหัสผ่านสำหรับ ${passwordData.username} สำเร็จ!`);
      setShowPasswordModal(false);
      setPasswordData({ userId: null, newPassword: '', username: '' });
    } catch (err) {
      alert(`❌ ${err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน'}`);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleAdjustBalance = async (e) => {
    e.preventDefault();
    setIsAdjusting(true);
    try {
      await api.adjustUserBalance(adjustData.userId, { amount: adjustData.amount, reason: adjustData.reason });
      alert(`✅ ปรับปรุงยอดเงินให้ผู้ใช้ ${adjustData.username} สำเร็จ!`);
      setShowAdjustModal(false);
      setAdjustData({ userId: null, amount: '', reason: '', username: '' });
      fetchData(); // Refresh overview
    } catch (err) {
      alert(`❌ ${err.message || 'เกิดข้อผิดพลาดในการปรับยอดเงิน'}`);
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleApproveAdjustment = async (id, action) => {
    const isApprove = action === 'APPROVE';
    showConfirm(
      isApprove
        ? 'ยืนยันการอนุมัติคำขอปรับยอดเงินนี้? ยอดเงินจะถูกปรับทันทีและไม่สามารถย้อนกลับได้'
        : 'ยืนยันการปฏิเสธคำขอปรับยอดเงินนี้?',
      async () => {
        closeConfirm();
        try {
          await api.approveAdjustment(id, action);
          alert(`✅ อัปเดตสถานะคำขอสำเร็จ`);
          fetchData();
        } catch (err) {
          alert(`❌ ${err.message || 'เกิดข้อผิดพลาดในการจัดการคำขอ'}`);
        }
      },
      { title: isApprove ? 'อนุมัติคำขอ' : 'ปฏิเสธคำขอ', confirmText: isApprove ? 'อนุมัติ' : 'ปฏิเสธ', variant: isApprove ? 'success' : 'danger' }
    );
  };

  if (user?.role !== 'admin' && user?.role !== 'super_admin' && user?.role !== 'team_lead') {
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
    { id: 'users', label: 'จัดการผู้ใช้', icon: Users },
    { id: 'adjustments', label: 'รออนุมัติเงิน', icon: DollarSign },
    { id: 'agents', label: 'จัดการตัวแทน', icon: Building },
    { id: 'role_details', label: 'รายละเอียดผู้ใช้แยกตามบทบาท', icon: BarChart3 },
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

      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ border: '2px solid var(--accent-primary)' }}>
            <h2 className="modal-title" style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Key size={24} /> เปลี่ยนรหัสผ่านผู้ใช้
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 13, lineHeight: 1.5 }}>
              คุณกำลังเปลี่ยนรหัสผ่านใหม่ให้กับผู้ใช้: <strong>{passwordData.username}</strong>
            </p>
            <form onSubmit={handlePasswordReset}>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">รหัสผ่านใหม่ (ขั้นต่ำ 6 ตัวอักษร)</label>
                <input 
                  className="form-input" 
                  type="text"
                  autoFocus 
                  required 
                  minLength={6}
                  value={passwordData.newPassword} 
                  onChange={e => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))} 
                  placeholder="กรอกรหัสผ่านใหม่" 
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary" disabled={isChangingPassword}>
                  {isChangingPassword ? 'กำลังเปลี่ยน...' : 'ยืนยันเปลี่ยนรหัสผ่าน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAdjustModal && (
        <div className="modal-overlay" onClick={() => setShowAdjustModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ border: '2px solid var(--accent-primary)' }}>
            <h2 className="modal-title" style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <DollarSign size={24} /> ปรับปรุงยอดเงินผู้ใช้ (Manual Adjustment)
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 13, lineHeight: 1.5 }}>
              คุณกำลังปรับยอดเงินให้กับผู้ใช้: <strong>{adjustData.username}</strong>
            </p>
            <form onSubmit={handleAdjustBalance}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">จำนวนเงิน USD (ใส่จำนวนติดลบเพื่อหักเงิน)</label>
                <input 
                  className="form-input" 
                  type="number"
                  step="0.01"
                  autoFocus 
                  required 
                  value={adjustData.amount} 
                  onChange={e => setAdjustData(prev => ({ ...prev, amount: e.target.value }))} 
                  placeholder="เช่น 100 หรือ -50" 
                />
              </div>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">เหตุผล / ข้อความใน Audit Log</label>
                <input 
                  className="form-input" 
                  required 
                  value={adjustData.reason} 
                  onChange={e => setAdjustData(prev => ({ ...prev, reason: e.target.value }))} 
                  placeholder="เช่น คืนเงินฝากตกหล่น หรือ หักลบยอดค้าง..." 
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdjustModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary" disabled={isAdjusting}>
                  {isAdjusting ? 'กำลังปรับยอด...' : 'ยืนยันปรับยอดเงิน'}
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
                              <button className="btn btn-ghost btn-icon" onClick={() => {
                                setPasswordData({ userId: u.id, newPassword: '', username: u.display_name || u.username });
                                setShowPasswordModal(true);
                              }} title="เปลี่ยนรหัสผ่าน" style={{ width: 28, height: 28 }}>
                                <Key size={12} style={{ color: 'var(--accent-primary)' }} />
                              </button>
                              <button className="btn btn-ghost btn-icon" onClick={() => {
                                setAdjustData({ userId: u.id, amount: '', reason: '', username: u.display_name || u.username });
                                setShowAdjustModal(true);
                              }} title="ปรับปรุงยอดเงิน" style={{ width: 28, height: 28 }}>
                                <DollarSign size={12} style={{ color: 'var(--accent-primary)' }} />
                              </button>
                              <button className="btn btn-ghost btn-icon" onClick={() => setEditingUser(editingUser === u.id ? null : u.id)} style={{ width: 28, height: 28 }}>
                                <Edit2 size={12} />
                              </button>
                              <button className="btn btn-ghost btn-icon" onClick={() => handleDeleteUser(u)} style={{ width: 28, height: 28 }} title="ลบผู้ใช้">
                                <Trash2 size={12} style={{ color: 'var(--loss)' }} />
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

            {/* Adjustments Tab */}
            {activeTab === 'adjustments' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 600 }}>รายการขออนุมัติปรับยอดเงิน (Pending Adjustments)</h2>
                </div>
                
                <div className="data-table-wrapper" style={{ border: 'none' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>วันที่ / เวลา</th>
                        <th>ผู้ใช้งาน (Target)</th>
                        <th>ผู้ขอทำรายการ (Maker)</th>
                        <th>จำนวนเงิน (USD)</th>
                        <th>เหตุผล (Reason)</th>
                        <th style={{ textAlign: 'right' }}>การจัดการ (Checker)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjustments.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>ไม่มีรายการรออนุมัติในขณะนี้</td></tr>
                      ) : adjustments.map(adj => (
                        <tr key={adj.id}>
                          <td style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                            {new Date(adj.created_at).toLocaleString('th-TH')}
                          </td>
                          <td style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500 }}>
                            {adj.target_username || `- UID ${adj.user_id}`}
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{adj.target_email}</div>
                          </td>
                          <td style={{ fontSize: 12 }}>{adj.requested_by_username || `Admin ID: ${adj.requested_by}`}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: adj.amount > 0 ? 'var(--profit)' : 'var(--loss)' }}>
                            {formatCurrency(adj.amount)}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{adj.reason}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button 
                                className="btn btn-sm" 
                                style={{ background: 'var(--profit)', color: '#fff', border: 'none' }}
                                onClick={() => handleApproveAdjustment(adj.id, 'APPROVE')}
                                disabled={user?.role !== 'super_admin' && user?.role !== 'team_lead'}
                                title={user?.role !== 'super_admin' && user?.role !== 'team_lead' ? 'สิทธิ์ไม่เพียงพอ (ต้องเป็น Team Lead หรือ Super Admin)' : 'อนุมัติ'}
                              >
                                ยืนยัน
                              </button>
                              <button 
                                className="btn btn-sm" 
                                style={{ background: 'var(--loss)', color: '#fff', border: 'none' }}
                                onClick={() => handleApproveAdjustment(adj.id, 'REJECT')}
                                disabled={user?.role !== 'super_admin' && user?.role !== 'team_lead'}
                                title={user?.role !== 'super_admin' && user?.role !== 'team_lead' ? 'สิทธิ์ไม่เพียงพอ' : 'ปฏิเสธ'}
                              >
                                ปฏิเสธ
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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

            {/* Role Details Tab */}
            {activeTab === 'role_details' && (
              <div>
                <h3 className="chart-title" style={{ marginBottom: 'var(--space-lg)', fontSize: 16 }}>รายละเอียดผู้ใช้แยกตามบทบาท</h3>
                <div className="data-table-wrapper" style={{ border: 'none' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>บทบาท</th>
                        <th>จำนวนผู้ใช้</th>
                        <th>สัดส่วน</th>
                        <th style={{ width: '40%' }}>Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const ROLE_COLORS = ['#00C49F', '#FFBB28', '#FF8042', '#0088FE', '#8884d8'];
                        let formattedRoles = rolesData.map(r => ({
                           name: r.role_name === 'admin' ? 'ผู้ดูแล' :
                                 r.role_name === 'team_lead' ? 'ผู้นำทีม' : 
                                 r.role_name === 'user' ? 'ผู้ใช้งาน' : r.role_name,
                           value: parseInt(r.user_count) || 0
                        })).filter(r => r.value > 0);
                        const tUsers = formattedRoles.reduce((sum, r) => sum + r.value, 0);

                        if (formattedRoles.length === 0) {
                          return <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>ไม่มีข้อมูลบทบาท</td></tr>;
                        }

                        return formattedRoles.map((r, idx) => (
                          <tr key={idx}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                  width: 10, height: 10, borderRadius: '50%',
                                  background: ROLE_COLORS[idx % ROLE_COLORS.length], flexShrink: 0
                                }} />
                                <span style={{ fontWeight: 600 }}>{r.name}</span>
                              </div>
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{r.value}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                              {tUsers > 0 ? ((r.value / tUsers) * 100).toFixed(1) : 0}%
                            </td>
                            <td>
                              <div className="progress-bar" style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                                <div
                                  className="progress-fill"
                                  style={{
                                    height: '100%',
                                    width: `${tUsers > 0 ? (r.value / tUsers) * 100 : 0}%`,
                                    background: ROLE_COLORS[idx % ROLE_COLORS.length],
                                    borderRadius: 3
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Agents Tab */}
            {activeTab === 'agents' && (
              <div>
                {/* Commission Engine Status Bar */}
                {commissionStatus && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '10px 16px',
                    background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                    marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)',
                    border: '1px solid var(--border-primary)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Zap size={14} style={{ color: commissionStatus.running ? 'var(--profit)' : 'var(--text-tertiary)' }} />
                      <span>Commission Engine: <strong style={{ color: commissionStatus.running ? 'var(--profit)' : 'var(--text-tertiary)' }}>
                        {commissionStatus.running ? 'Running' : 'Idle'}
                      </strong></span>
                    </div>
                    {commissionStatus.last_run && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} />
                        <span>Last Run: {new Date(commissionStatus.last_run).toLocaleString('th-TH')}</span>
                      </div>
                    )}
                    {commissionStatus.next_run && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <RefreshCw size={12} />
                        <span>Next: {new Date(commissionStatus.next_run).toLocaleString('th-TH')}</span>
                      </div>
                    )}
                    <div style={{ marginLeft: 'auto' }}>
                      <button
                        className="btn btn-sm"
                        style={{ fontSize: 11, padding: '4px 10px', background: 'var(--accent-primary)', color: '#fff', border: 'none' }}
                        onClick={handleTriggerCalc}
                        disabled={calcRunning}
                      >
                        <Calculator size={12} /> {calcRunning ? 'กำลังคำนวณ...' : 'คำนวณค่าคอมทันที'}
                      </button>
                    </div>
                  </div>
                )}

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
                              <button className="btn btn-ghost btn-icon" onClick={() => handleSettleCommissions(a.id)}
                                title="จ่ายค่าคอม" style={{ width: 28, height: 28 }}
                                disabled={settlingAgent === a.id}>
                                {settlingAgent === a.id
                                  ? <RefreshCw size={12} className="spin" style={{ color: 'var(--warning)' }} />
                                  : <CheckCircle size={12} style={{ color: 'var(--warning)' }} />}
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

      {activeTab === 'terminals' && (
        <DockerNodes />
      )}

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
