import { useState, useEffect, useCallback } from 'react';
import { api } from '../../utils/api';
import {
  Users, TrendingUp, DollarSign, Link2, Copy, UserPlus, UserMinus,
  UserCheck, UserX, Search, BarChart3, Trophy, Clock, Send, X, RefreshCw,
  Palette, ChevronDown, ExternalLink
} from 'lucide-react';

export default function AgentDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [tenant, setTenant] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [team, setTeam] = useState([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [invitations, setInvitations] = useState([]);
  const [commissions, setCommissions] = useState(null);
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [teamSearch, setTeamSearch] = useState('');
  const [teamPage, setTeamPage] = useState(1);
  const [period, setPeriod] = useState('30');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMaxUses, setInviteMaxUses] = useState(10);
  const [inviteResult, setInviteResult] = useState(null);
  const [showBrandingModal, setShowBrandingModal] = useState(false);
  const [brandingForm, setBrandingForm] = useState({});

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '$0.00';
    const num = parseFloat(val);
    if (isNaN(num)) return '$0.00';
    const prefix = num > 0 ? '+' : num < 0 ? '-' : '';
    return `${prefix}$${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const [t, p] = await Promise.all([
          api.getAgentTenant(),
          api.getAgentTeamPerformance({ period }),
        ]);
        setTenant(t);
        setPerformance(p);
      } else if (activeTab === 'team') {
        const data = await api.getAgentTeam({ page: teamPage, search: teamSearch, limit: 15 });
        setTeam(data.members);
        setTotalMembers(data.total);
      } else if (activeTab === 'invitations') {
        const data = await api.getAgentInvitations();
        setInvitations(data);
      } else if (activeTab === 'commissions') {
        const data = await api.getAgentCommissions({ page: 1, limit: 50 });
        setCommissions(data);
      } else if (activeTab === 'branding') {
        const data = await api.getAgentBranding();
        setBranding(data);
        setBrandingForm(data);
      }
    } catch (err) {
      console.error('Agent fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, period, teamPage, teamSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    try {
      const result = await api.createAgentInvite({
        email: inviteEmail || null,
        max_uses: inviteMaxUses,
        expires_days: 7,
      });
      setInviteResult(result);
      setInviteEmail('');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCopyInvite = (code) => {
    const url = `${window.location.origin}/register?invite=${code}`;
    navigator.clipboard.writeText(url);
    alert('คัดลอกลิงก์เชิญแล้ว!');
  };

  const handleToggleMember = async (id) => {
    try {
      await api.toggleAgentMember(id);
      fetchData();
    } catch (err) { alert(err.message); }
  };

  const handleRemoveMember = async (id, name) => {
    if (!confirm(`ต้องการลบ ${name} ออกจากทีมหรือไม่?`)) return;
    try {
      await api.removeAgentMember(id);
      fetchData();
    } catch (err) { alert(err.message); }
  };

  const handleCancelInvite = async (id) => {
    try {
      await api.cancelAgentInvite(id);
      fetchData();
    } catch (err) { alert(err.message); }
  };

  const handleUpdateBranding = async (e) => {
    e.preventDefault();
    try {
      await api.updateAgentBranding(brandingForm);
      alert('อัปเดตแบรนด์เรียบร้อย!');
      setShowBrandingModal(false);
      fetchData();
    } catch (err) { alert(err.message); }
  };

  const tabs = [
    { id: 'overview', label: 'ภาพรวมทีม', icon: BarChart3 },
    { id: 'team', label: 'สมาชิกในทีม', icon: Users },
    { id: 'invitations', label: 'ลิงก์เชิญ', icon: Link2 },
    { id: 'commissions', label: 'ค่าคอมมิชชั่น', icon: DollarSign },
    { id: 'branding', label: 'แบรนด์', icon: Palette },
  ];

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={20} style={{ color: 'var(--accent-primary)' }} />
            ระบบตัวแทน (Agent)
          </h1>
          {tenant && (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 8 }}>
              {tenant.platform_name || tenant.name} • {tenant.member_count || 0} สมาชิก
            </span>
          )}
        </div>
        <div className="header-right">
          <button className="btn btn-sm btn-primary" onClick={() => setShowInviteModal(true)}>
            <UserPlus size={14} /> เชิญสมาชิก
          </button>
        </div>
      </div>

      <div className="content-area">
        {/* Tab navigation */}
        <div className="chart-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', background: 'rgba(0,0,0,0.1)', overflowX: 'auto' }}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setTeamPage(1); }} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px',
                  background: 'transparent', border: 'none',
                  color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  cursor: 'pointer', fontWeight: activeTab === tab.id ? 600 : 500, fontSize: 13,
                  marginBottom: -1, whiteSpace: 'nowrap'
                }}>
                  <Icon size={15} />{tab.label}
                </button>
              );
            })}
          </div>

          <div style={{ padding: 'var(--space-xl)' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
                <RefreshCw size={32} className="spin" style={{ marginBottom: 12 }} />
                <div>กำลังโหลดข้อมูล...</div>
              </div>
            ) : (
              <>
                {/* ===== OVERVIEW TAB ===== */}
                {activeTab === 'overview' && performance && (
                  <div>
                    {/* Summary Cards */}
                    <div className="stat-grid" style={{ marginBottom: 24 }}>
                      <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="card-header">
                          <span className="card-title">สมาชิกในทีม</span>
                          <Users size={16} style={{ color: 'var(--accent-primary)' }} />
                        </div>
                        <div className="card-value">{performance.summary.active_members}</div>
                        <div className="card-sub">จาก {tenant?.max_users || 50} คน</div>
                      </div>
                      <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="card-header">
                          <span className="card-title">กำไรรวมทีม</span>
                          <TrendingUp size={16} style={{ color: performance.summary.total_pnl >= 0 ? 'var(--profit)' : 'var(--loss)' }} />
                        </div>
                        <div className={`card-value ${performance.summary.total_pnl >= 0 ? 'profit' : 'loss'}`}>
                          {formatCurrency(performance.summary.total_pnl)}
                        </div>
                        <div className="card-sub">{performance.summary.total_trades} เทรด | Win Rate {performance.summary.win_rate}%</div>
                      </div>
                      <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="card-header">
                          <span className="card-title">กำไรวันนี้</span>
                          <DollarSign size={16} style={{ color: performance.summary.today_pnl >= 0 ? 'var(--profit)' : 'var(--loss)' }} />
                        </div>
                        <div className={`card-value ${performance.summary.today_pnl >= 0 ? 'profit' : 'loss'}`}>
                          {formatCurrency(performance.summary.today_pnl)}
                        </div>
                      </div>
                      <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="card-header">
                          <span className="card-title">คอมมิชชั่น</span>
                          <DollarSign size={16} style={{ color: 'var(--warning)' }} />
                        </div>
                        <div className="card-value" style={{ color: 'var(--warning)' }}>
                          ${parseFloat(performance.summary.commission_settled || 0).toFixed(2)}
                        </div>
                        <div className="card-sub">รอจ่าย ${parseFloat(performance.summary.commission_pending || 0).toFixed(2)}</div>
                      </div>
                    </div>

                    {/* Period selector */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h4 style={{ fontSize: 15, fontWeight: 600 }}>🏆 Top Performers</h4>
                      <select className="filter-select" value={period} onChange={e => setPeriod(e.target.value)} style={{ width: 'auto' }}>
                        <option value="7">7 วัน</option>
                        <option value="14">14 วัน</option>
                        <option value="30">30 วัน</option>
                        <option value="60">60 วัน</option>
                        <option value="90">90 วัน</option>
                      </select>
                    </div>

                    {/* Top Performers */}
                    {performance.top_performers && performance.top_performers.length > 0 ? (
                      <div className="data-table-wrapper" style={{ border: 'none' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>อันดับ</th>
                              <th>สมาชิก</th>
                              <th>จำนวนเทรด</th>
                              <th>กำไร/ขาดทุน</th>
                            </tr>
                          </thead>
                          <tbody>
                            {performance.top_performers.map((p, i) => (
                              <tr key={p.id}>
                                <td>
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: 28, height: 28, borderRadius: '50%',
                                    background: i === 0 ? 'linear-gradient(135deg, #FFD700, #FF8C00)' :
                                               i === 1 ? 'linear-gradient(135deg, #C0C0C0, #808080)' :
                                               i === 2 ? 'linear-gradient(135deg, #CD7F32, #8B4513)' : 'var(--bg-secondary)',
                                    fontWeight: 700, fontSize: 12, color: i < 3 ? '#fff' : 'var(--text-secondary)'
                                  }}>
                                    {i < 3 ? <Trophy size={14} /> : i + 1}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{
                                      width: 30, height: 30, borderRadius: '50%', background: 'var(--gradient-primary)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontWeight: 700, fontSize: 12, color: '#0a0e17'
                                    }}>
                                      {(p.display_name || p.username)?.[0]?.toUpperCase()}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.display_name || p.username}</div>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{parseInt(p.total_trades).toLocaleString()}</td>
                                <td className={parseFloat(p.total_pnl) >= 0 ? 'pnl-positive' : 'pnl-negative'} style={{ fontWeight: 600 }}>
                                  {formatCurrency(p.total_pnl)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                        ยังไม่มีข้อมูลเทรดในช่วงนี้
                      </div>
                    )}
                  </div>
                )}

                {/* ===== TEAM TAB ===== */}
                {activeTab === 'team' && (
                  <div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input className="form-input" value={teamSearch} onChange={e => { setTeamSearch(e.target.value); setTeamPage(1); }}
                          placeholder="ค้นหาชื่อ, อีเมล..." style={{ paddingLeft: 36, width: '100%' }}
                        />
                      </div>
                    </div>

                    <div className="data-table-wrapper" style={{ border: 'none' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>สมาชิก</th>
                            <th>อีเมล</th>
                            <th>บทบาท</th>
                            <th>เทรดรวม</th>
                            <th>กำไร/ขาดทุน</th>
                            <th>สถานะ</th>
                            <th>เข้าสู่ระบบล่าสุด</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {team.length === 0 ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>ยังไม่มีสมาชิกในทีม</td></tr>
                          ) : team.map(m => (
                            <tr key={m.id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{
                                    width: 28, height: 28, borderRadius: '50%', background: 'var(--gradient-primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                              <td style={{ fontSize: 12 }}>{m.email}</td>
                              <td><span className="badge badge-open">{m.role || 'user'}</span></td>
                              <td style={{ fontFamily: 'var(--font-mono)' }}>{parseInt(m.total_trades || 0).toLocaleString()}</td>
                              <td className={parseFloat(m.total_pnl) >= 0 ? 'pnl-positive' : 'pnl-negative'} style={{ fontWeight: 600 }}>
                                {formatCurrency(m.total_pnl)}
                              </td>
                              <td>
                                <span className={`badge ${m.is_active ? 'badge-buy' : 'badge-sell'}`}>
                                  {m.is_active ? 'Active' : 'Disabled'}
                                </span>
                              </td>
                              <td style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                {m.last_login_at ? new Date(m.last_login_at).toLocaleDateString('th-TH') : '-'}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button className="btn btn-ghost btn-icon" onClick={() => handleToggleMember(m.id)}
                                    title={m.is_active ? 'ระงับ' : 'เปิดใช้'} style={{ width: 28, height: 28 }}>
                                    {m.is_active ? <UserX size={12} style={{ color: 'var(--loss)' }} /> : <UserCheck size={12} style={{ color: 'var(--profit)' }} />}
                                  </button>
                                  <button className="btn btn-ghost btn-icon" onClick={() => handleRemoveMember(m.id, m.display_name || m.username)}
                                    title="ลบออกจากทีม" style={{ width: 28, height: 28 }}>
                                    <UserMinus size={12} style={{ color: 'var(--loss)' }} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {totalMembers > 15 && (
                      <div className="pagination">
                        <span className="pagination-info">{totalMembers} สมาชิก</span>
                        <div className="pagination-buttons">
                          <button className="pagination-btn" onClick={() => setTeamPage(p => Math.max(1, p - 1))} disabled={teamPage === 1}>ก่อนหน้า</button>
                          <button className="pagination-btn active">{teamPage}</button>
                          <button className="pagination-btn" onClick={() => setTeamPage(p => p + 1)} disabled={teamPage * 15 >= totalMembers}>ถัดไป</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ===== INVITATIONS TAB ===== */}
                {activeTab === 'invitations' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <h4 style={{ fontSize: 15, fontWeight: 600 }}>🔗 ลิงก์เชิญสมาชิก</h4>
                      <button className="btn btn-sm btn-primary" onClick={() => setShowInviteModal(true)}>
                        <UserPlus size={14} /> สร้างลิงก์ใหม่
                      </button>
                    </div>

                    <div className="data-table-wrapper" style={{ border: 'none' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>รหัสเชิญ</th>
                            <th>อีเมล</th>
                            <th>ใช้ไปแล้ว</th>
                            <th>หมดอายุ</th>
                            <th>สถานะ</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {invitations.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>ยังไม่มีลิงก์เชิญ</td></tr>
                          ) : invitations.map(inv => {
                            const expired = new Date(inv.expires_at) < new Date();
                            const full = inv.max_uses > 0 && inv.used_count >= inv.max_uses;
                            const active = inv.is_active && !expired && !full;
                            return (
                              <tr key={inv.id}>
                                <td>
                                  <code style={{ fontSize: 11, background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 4 }}>
                                    {inv.invite_code.substring(0, 16)}...
                                  </code>
                                </td>
                                <td style={{ fontSize: 12 }}>{inv.email || '-'}</td>
                                <td style={{ fontFamily: 'var(--font-mono)' }}>{inv.used_count}/{inv.max_uses || '∞'}</td>
                                <td style={{ fontSize: 11, color: expired ? 'var(--loss)' : 'var(--text-tertiary)' }}>
                                  {new Date(inv.expires_at).toLocaleDateString('th-TH')}
                                </td>
                                <td>
                                  <span className={`badge ${active ? 'badge-buy' : 'badge-sell'}`}>
                                    {active ? 'ใช้งานได้' : expired ? 'หมดอายุ' : full ? 'เต็ม' : 'ยกเลิก'}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    {active && (
                                      <button className="btn btn-ghost btn-icon" onClick={() => handleCopyInvite(inv.invite_code)}
                                        title="คัดลอกลิงก์" style={{ width: 28, height: 28 }}>
                                        <Copy size={12} />
                                      </button>
                                    )}
                                    {active && (
                                      <button className="btn btn-ghost btn-icon" onClick={() => handleCancelInvite(inv.id)}
                                        title="ยกเลิก" style={{ width: 28, height: 28 }}>
                                        <X size={12} style={{ color: 'var(--loss)' }} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ===== COMMISSIONS TAB ===== */}
                {activeTab === 'commissions' && (
                  <div>
                    {commissions && commissions.summary && (
                      <div className="stat-grid" style={{ marginBottom: 24 }}>
                        <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                          <div className="card-title" style={{ marginBottom: 8 }}>คอมมิชชั่นรวม</div>
                          <div className="card-value" style={{ color: 'var(--warning)' }}>
                            ${parseFloat(commissions.summary.total_commission || 0).toFixed(2)}
                          </div>
                        </div>
                        <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                          <div className="card-title" style={{ marginBottom: 8 }}>จ่ายแล้ว</div>
                          <div className="card-value profit">
                            ${parseFloat(commissions.summary.total_settled || 0).toFixed(2)}
                          </div>
                        </div>
                        <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                          <div className="card-title" style={{ marginBottom: 8 }}>รอจ่าย</div>
                          <div className="card-value" style={{ color: 'var(--accent-primary)' }}>
                            ${parseFloat(commissions.summary.total_pending || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="data-table-wrapper" style={{ border: 'none' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>วันที่</th>
                            <th>ประเภท</th>
                            <th>จากสมาชิก</th>
                            <th>อัตรา</th>
                            <th>จำนวน</th>
                            <th>สถานะ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(!commissions || commissions.commissions?.length === 0) ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>ยังไม่มีค่าคอมมิชชั่น</td></tr>
                          ) : commissions.commissions.map(c => (
                            <tr key={c.id}>
                              <td style={{ fontSize: 11 }}>{new Date(c.created_at).toLocaleDateString('th-TH')}</td>
                              <td><span className="badge badge-open">{c.commission_type}</span></td>
                              <td style={{ fontSize: 12 }}>{c.source_display_name || c.source_username || '-'}</td>
                              <td style={{ fontFamily: 'var(--font-mono)' }}>{parseFloat(c.rate_pct)}%</td>
                              <td style={{ fontWeight: 600, color: 'var(--warning)' }}>${parseFloat(c.amount).toFixed(2)}</td>
                              <td>
                                <span className={`badge ${c.status === 'SETTLED' ? 'badge-buy' : 'badge-open'}`}>
                                  {c.status === 'SETTLED' ? 'จ่ายแล้ว' : 'รอจ่าย'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ===== BRANDING TAB ===== */}
                {activeTab === 'branding' && branding && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <h4 style={{ fontSize: 15, fontWeight: 600 }}>🎨 ตั้งค่าแบรนด์</h4>
                      <button className="btn btn-sm btn-primary" onClick={() => { setBrandingForm(branding); setShowBrandingModal(true); }}>
                        <Palette size={14} /> แก้ไข
                      </button>
                    </div>

                    <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                      <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="card-title" style={{ marginBottom: 12 }}>ชื่อแพลตฟอร์ม</div>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>{branding.platform_name || 'NexusFX'}</div>
                      </div>
                      <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="card-title" style={{ marginBottom: 12 }}>สีหลัก</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 8, background: branding.primary_color || '#007bff', border: '2px solid var(--border-primary)' }} />
                          <code style={{ fontSize: 13 }}>{branding.primary_color || '#007bff'}</code>
                        </div>
                      </div>
                      <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="card-title" style={{ marginBottom: 12 }}>สีรอง</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 8, background: branding.secondary_color || '#6c757d', border: '2px solid var(--border-primary)' }} />
                          <code style={{ fontSize: 13 }}>{branding.secondary_color || '#6c757d'}</code>
                        </div>
                      </div>
                      <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="card-title" style={{ marginBottom: 12 }}>โดเมน</div>
                        <div style={{ fontSize: 14, color: branding.domain ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                          {branding.domain || 'ยังไม่ตั้งค่า'}
                        </div>
                      </div>
                    </div>

                    {branding.logo_url && (
                      <div style={{ marginTop: 24 }}>
                        <div className="card-title" style={{ marginBottom: 12 }}>โลโก้</div>
                        <img src={branding.logo_url} alt="Logo" style={{ maxHeight: 80, borderRadius: 8, border: '1px solid var(--border-primary)' }} />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ===== INVITE MODAL ===== */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => { setShowInviteModal(false); setInviteResult(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserPlus size={20} /> สร้างลิงก์เชิญสมาชิก
            </h2>

            {inviteResult ? (
              <div>
                <div style={{ background: 'var(--profit-bg)', border: '1px solid var(--profit)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, color: 'var(--profit)', marginBottom: 8 }}>✅ สร้างลิงก์เชิญเรียบร้อย!</div>
                  <div style={{ fontSize: 12, wordBreak: 'break-all', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>
                    {window.location.origin}/register?invite={inviteResult.invitation.invite_code}
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => handleCopyInvite(inviteResult.invitation.invite_code)}>
                    <Copy size={14} /> คัดลอกลิงก์
                  </button>
                </div>
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => { setShowInviteModal(false); setInviteResult(null); fetchData(); }}>ปิด</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateInvite}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">อีเมลผู้รับเชิญ (ไม่บังคับ)</label>
                  <input className="form-input" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    placeholder="example@email.com" />
                </div>
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label">จำนวนครั้งที่ใช้ได้</label>
                  <select className="form-input" value={inviteMaxUses} onChange={e => setInviteMaxUses(parseInt(e.target.value))}>
                    <option value="1">1 ครั้ง</option>
                    <option value="5">5 ครั้ง</option>
                    <option value="10">10 ครั้ง</option>
                    <option value="25">25 ครั้ง</option>
                    <option value="50">50 ครั้ง</option>
                    <option value="0">ไม่จำกัด</option>
                  </select>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowInviteModal(false)}>ยกเลิก</button>
                  <button type="submit" className="btn btn-primary"><Send size={14} /> สร้างลิงก์เชิญ</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ===== BRANDING MODAL ===== */}
      {showBrandingModal && (
        <div className="modal-overlay" onClick={() => setShowBrandingModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Palette size={20} /> แก้ไขแบรนด์
            </h2>
            <form onSubmit={handleUpdateBranding}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">ชื่อแพลตฟอร์ม</label>
                <input className="form-input" value={brandingForm.platform_name || ''} onChange={e => setBrandingForm(f => ({ ...f, platform_name: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">URL โลโก้</label>
                <input className="form-input" value={brandingForm.logo_url || ''} onChange={e => setBrandingForm(f => ({ ...f, logo_url: e.target.value }))} placeholder="https://..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div className="form-group">
                  <label className="form-label">สีหลัก</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" value={brandingForm.primary_color || '#007bff'} onChange={e => setBrandingForm(f => ({ ...f, primary_color: e.target.value }))}
                      style={{ width: 40, height: 36, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
                    <input className="form-input" value={brandingForm.primary_color || ''} onChange={e => setBrandingForm(f => ({ ...f, primary_color: e.target.value }))} style={{ flex: 1 }} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">สีรอง</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" value={brandingForm.secondary_color || '#6c757d'} onChange={e => setBrandingForm(f => ({ ...f, secondary_color: e.target.value }))}
                      style={{ width: 40, height: 36, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
                    <input className="form-input" value={brandingForm.secondary_color || ''} onChange={e => setBrandingForm(f => ({ ...f, secondary_color: e.target.value }))} style={{ flex: 1 }} />
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBrandingModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary">บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
