import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  Users, Plus, UserPlus, UserMinus, Trophy, TrendingUp,
  Crown, BarChart3, ChevronRight, Edit2, Trash2, X, ShieldAlert
} from 'lucide-react';

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [formData, setFormData] = useState({ group_name: '', description: '', max_members: 50 });
  const [editForm, setEditForm] = useState({ group_name: '', description: '', max_members: 50 });
  const [memberUsername, setMemberUsername] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [processing, setProcessing] = useState(false);
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const data = await api.getGroups();
      setGroups(data);
    } catch (err) {
      console.error('Groups fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGroups(); }, []);

  const handleSelectGroup = async (group) => {
    try {
      const [detail, perf] = await Promise.all([
        api.getGroup(group.id),
        api.getGroupPerformance(group.id, { period: 30 }),
      ]);
      setSelectedGroup(detail);
      setPerformance(perf);
    } catch (err) {
      console.error('Group detail error:', err);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      await api.createGroup(formData);
      setShowCreateModal(false);
      setFormData({ group_name: '', description: '', max_members: 50 });
      fetchGroups();
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      await api.addGroupMember(selectedGroup.id, { username: memberUsername });
      setShowAddMember(false);
      setMemberUsername('');
      handleSelectGroup(selectedGroup);
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!await window.customConfirm('ต้องการลบสมาชิกนี้?')) return;
    try {
      await api.removeGroupMember(selectedGroup.id, userId);
      handleSelectGroup(selectedGroup);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!await window.customConfirm('ต้องการลบกลุ่มนี้?')) return;
    try {
      await api.deleteGroup(groupId);
      setSelectedGroup(null);
      setPerformance(null);
      fetchGroups();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenAddMember = async () => {
    setShowAddMember(true);
    setMemberUsername('');
    try {
      const users = await api.getAvailableUsers();
      setAvailableUsers(users);
    } catch (err) {
      console.error('Fetch available users error:', err);
      setAvailableUsers([]);
    }
  };

  const handleOpenEditGroup = () => {
    setEditForm({
      group_name: selectedGroup.group_name || '',
      description: selectedGroup.description || '',
      max_members: selectedGroup.max_members || 50,
    });
    setShowEditGroup(true);
  };

  const handleSaveGroupName = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const payload = {
        group_name: editForm.group_name,
        description: editForm.description,
      };
      // Only admin can update max_members
      if (isAdmin) {
        payload.max_members = parseInt(editForm.max_members) || 50;
      }
      await api.updateGroup(selectedGroup.id, payload);
      setShowEditGroup(false);
      // Refresh data
      const updated = { ...selectedGroup, ...payload };
      setSelectedGroup(updated);
      fetchGroups();
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const [globalStopLoss, setGlobalStopLoss] = useState('');
  
  useEffect(() => {
    if (selectedGroup?.config?.global_stop_loss) {
      setGlobalStopLoss(selectedGroup.config.global_stop_loss);
    } else {
      setGlobalStopLoss('');
    }
  }, [selectedGroup]);

  const handleUpdateConfig = async () => {
    try {
      await api.updateGroupConfig(selectedGroup.id, { global_stop_loss: parseFloat(globalStopLoss) || 0 });
      alert('บันทึกการตั้งค่าความเสี่ยงเรียบร้อย');
      handleSelectGroup(selectedGroup);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEmergencyClose = async () => {
    const reason = prompt('ระบุเหตุผลในการปิดฉุกเฉิน:');
    if (!reason) return;
    try {
      const res = await api.emergencyCloseGroup(selectedGroup.id, { reason });
      alert(`ปิดฉุกเฉินสำเร็จ!\nยกเลิกออเดอร์: ${res.cancelled_orders}\nหยุดบอท: ${res.stopped_bots}`);
    } catch (err) {
      alert(err.message);
    }
  };

  const formatCurrency = (val) => {
    if (!val && val !== 0) return '$0.00';
    const num = parseFloat(val);
    return `${num >= 0 ? '+' : ''}$${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title">จัดการกลุ่ม/ทีม</h1>
        </div>
        <div className="header-right">
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} /> สร้างกลุ่ม
          </button>
        </div>
      </div>

      <div className="content-area">
        <div style={{ display: 'grid', gridTemplateColumns: selectedGroup ? '360px 1fr' : '1fr', gap: 'var(--space-lg)' }}>
          {/* Group List */}
          <div>
            {groups.length === 0 ? (
              <div className="chart-card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                <p style={{ color: 'var(--text-tertiary)' }}>ยังไม่มีกลุ่ม — กดสร้างกลุ่มเพื่อเริ่มต้น</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {groups.map(g => (
                  <div
                    key={g.id}
                    className="card"
                    onClick={() => handleSelectGroup(g)}
                    style={{
                      cursor: 'pointer',
                      borderColor: selectedGroup?.id === g.id ? 'var(--accent-primary)' : undefined,
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Crown size={14} style={{ color: 'var(--warning)' }} />
                          {g.group_name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                          หัวหน้า: {g.lead_name || g.lead_username} · {g.member_count} สมาชิก
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Group Detail */}
          {selectedGroup && (
            <div>
              {/* Group Info Card */}
              <div className="chart-card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h3 className="chart-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Crown size={18} style={{ color: 'var(--warning)' }} />
                      {selectedGroup.group_name}
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                      {selectedGroup.description || 'ไม่มีคำอธิบาย'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={handleOpenEditGroup} title="แก้ไขชื่อกลุ่ม">
                      <Edit2 size={14} />
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={handleOpenAddMember}>
                      <UserPlus size={14} /> เพิ่มสมาชิก
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteGroup(selectedGroup.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Performance Summary */}
                {performance && (
                  <div className="stat-grid" style={{ marginBottom: 0 }}>
                    <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                      <div className="card-title" style={{ marginBottom: 8 }}>กำไรรวมทีม</div>
                      <div className={`card-value ${performance.summary.total_pnl >= 0 ? 'profit' : 'loss'}`} style={{ fontSize: 20 }}>
                        {formatCurrency(performance.summary.total_pnl)}
                      </div>
                    </div>
                    <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                      <div className="card-title" style={{ marginBottom: 8 }}>เทรดรวม</div>
                      <div className="card-value" style={{ fontSize: 20 }}>{performance.summary.total_trades}</div>
                    </div>
                    <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                      <div className="card-title" style={{ marginBottom: 8 }}>Win Rate ทีม</div>
                      <div className="card-value" style={{ fontSize: 20 }}>{performance.summary.avg_win_rate}%</div>
                    </div>
                    <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                      <div className="card-title" style={{ marginBottom: 8 }}>สมาชิก</div>
                      <div className="card-value" style={{ fontSize: 20 }}>{performance.summary.member_count}</div>
                    </div>
                  </div>
                )}

                {/* Risk Management Section */}
                {selectedGroup.lead_username === JSON.parse(localStorage.getItem('user'))?.username && (
                  <div className="stat-grid" style={{ marginTop: 24 }}>
                    <div className="card" style={{ background: 'var(--bg-tertiary)', gridColumn: 'span 2' }}>
                      <div className="card-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ShieldAlert size={16} style={{ color: 'var(--warning)' }} />
                        จัดการความเสี่ยงทีม (Global Stop-Loss)
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, display: 'block' }}>ตั้งค่าจุดตัดขาดทุนรวมของทีม (%)</label>
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ height: 38 }}
                            value={globalStopLoss} 
                            onChange={e => setGlobalStopLoss(e.target.value)} 
                            placeholder="เช่น 10 (ตัดขาดทุนเมื่อติดลบ 10%)" 
                          />
                        </div>
                        <button className="btn btn-primary" style={{ height: 38 }} onClick={handleUpdateConfig}>บันทึกค่า</button>
                      </div>
                    </div>
                    
                    <div className="card" style={{ background: 'rgba(235, 87, 87, 0.05)', border: '1px solid rgba(235, 87, 87, 0.2)', gridColumn: 'span 2' }}>
                      <div className="card-title" style={{ marginBottom: 12, color: 'var(--loss)' }}>Emergency Actions</div>
                      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>ใช้ในกรณีฉุกเฉินเท่านั้น จะทำการปิดบอททั้งหมดและยกเลิกคำสั่งค้างของคุณและลูกทีมทันที</p>
                      <button className="btn" style={{ width: '100%', background: 'var(--loss)', color: '#fff', border: 'none' }} onClick={handleEmergencyClose}>
                        <ShieldAlert size={14} /> ปิด Position ของลูกทีมทุกคน (Emergency Close)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Members Table */}
              <div className="chart-card">
                <h3 className="chart-title" style={{ marginBottom: 16 }}>สมาชิกในทีม</h3>
                <div className="data-table-wrapper" style={{ border: 'none' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>สมาชิก</th>
                        <th>บทบาท</th>
                        <th>กำไร (30D)</th>
                        <th>เทรด</th>
                        <th>Win Rate</th>
                        <th>เข้าร่วม</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedGroup.members || []).map(m => {
                        const perf = performance?.members?.find(p => p.user_id === m.user_id);
                        return (
                          <tr key={m.user_id}>
                            <td style={{ fontFamily: 'var(--font-sans)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                  width: 28, height: 28, borderRadius: '50%',
                                  background: 'var(--gradient-primary)', display: 'flex',
                                  alignItems: 'center', justifyContent: 'center',
                                  fontSize: 11, fontWeight: 700, color: '#0a0e17'
                                }}>
                                  {(m.display_name || m.username)?.[0]?.toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{m.display_name || m.username}</div>
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>@{m.username}</div>
                                </div>
                              </div>
                            </td>
                            <td><span className="badge badge-open">{m.role_name || 'user'}</span></td>
                            <td className={perf && parseFloat(perf.total_pnl) >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                              {perf ? formatCurrency(perf.total_pnl) : '-'}
                            </td>
                            <td>{perf?.total_trades || 0}</td>
                            <td>{perf?.win_rate || '0.0'}%</td>
                            <td style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                              {new Date(m.joined_at).toLocaleDateString('th-TH')}
                            </td>
                            <td>
                              <button
                                className="btn btn-ghost btn-icon"
                                onClick={() => handleRemoveMember(m.user_id)}
                                title="ลบสมาชิก"
                                style={{ width: 28, height: 28 }}
                              >
                                <UserMinus size={14} style={{ color: 'var(--loss)' }} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {(!selectedGroup.members || selectedGroup.members.length === 0) && (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>
                            ยังไม่มีสมาชิก — กดเพิ่มสมาชิกเพื่อเริ่มต้น
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">👥 สร้างกลุ่มใหม่</h2>
            <form onSubmit={handleCreateGroup}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">ชื่อกลุ่ม</label>
                <input className="form-input" value={formData.group_name} onChange={e => setFormData(p => ({ ...p, group_name: e.target.value }))} required autoFocus />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">คำอธิบาย</label>
                <input className="form-input" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">จำนวนสมาชิกสูงสุด</label>
                <input className="form-input" type="number" value={formData.max_members} onChange={e => setFormData(p => ({ ...p, max_members: parseInt(e.target.value) }))} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary" disabled={processing}>{processing ? 'กำลังสร้าง...' : 'สร้างกลุ่ม'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="modal-overlay" onClick={() => setShowAddMember(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">👤 เพิ่มสมาชิก</h2>
            <form onSubmit={handleAddMember}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">เลือกสมาชิก</label>
                {availableUsers.length > 0 ? (
                  <select 
                    className="filter-select" 
                    value={memberUsername} 
                    onChange={e => setMemberUsername(e.target.value)} 
                    required
                    style={{ width: '100%', padding: '10px 14px' }}
                  >
                    <option value="">-- เลือกผู้ใช้ --</option>
                    {availableUsers.map(u => (
                      <option key={u.id} value={u.username}>
                        {u.display_name || u.username} (@{u.username})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '12px 0' }}>
                    ไม่มีผู้ใช้ที่ว่างอยู่ (ทุกคนอยู่ในกลุ่มแล้ว)
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddMember(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary" disabled={processing || !memberUsername}>{processing ? 'กำลังเพิ่ม...' : 'เพิ่มสมาชิก'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditGroup && (
        <div className="modal-overlay" onClick={() => setShowEditGroup(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">✏️ แก้ไขกลุ่ม</h2>
            <form onSubmit={handleSaveGroupName}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">ชื่อกลุ่ม</label>
                <input className="form-input" value={editForm.group_name} onChange={e => setEditForm(p => ({ ...p, group_name: e.target.value }))} required autoFocus />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">คำอธิบาย</label>
                <input className="form-input" value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} placeholder="คำอธิบายกลุ่ม (ไม่จำเป็น)" />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">จำนวนสมาชิกสูงสุด</label>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  value={editForm.max_members}
                  onChange={e => setEditForm(p => ({ ...p, max_members: e.target.value }))}
                  disabled={!isAdmin}
                  style={!isAdmin ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                />
                {!isAdmin && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>เฉพาะ Admin เท่านั้นที่แก้ไขจำนวนสมาชิกได้</p>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditGroup(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary" disabled={processing}>{processing ? 'กำลังบันทึก...' : 'บันทึก'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
