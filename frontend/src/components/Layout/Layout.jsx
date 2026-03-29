import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, History, Target, Settings, LogOut, TrendingUp, User,
  Building2, ChevronDown, Menu, Wallet, Users, BarChart3, Shield, Cpu, TerminalSquare, CreditCard, Store, Flame, Copy, MessageSquare
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('nexusfx_sidebar_collapsed') === 'true';
  });

  const handleToggleCollapse = () => {
    const newVal = !isCollapsed;
    setIsCollapsed(newVal);
    localStorage.setItem('nexusfx_sidebar_collapsed', newVal.toString());
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'admin';
  const isTeamLead = user?.role === 'team_lead' || isAdmin;

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header" style={{ justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
          <div className="sidebar-logo">N</div>
          {!isCollapsed && <span className="sidebar-brand">NexusFX</span>}
        </div>

        <nav className="sidebar-nav">
          {!isCollapsed && <div className="sidebar-section-title">Trading</div>}
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end title="Dashboard">
            <LayoutDashboard size={18} className="nav-icon" />
            {!isCollapsed && <span>Dashboard</span>}
          </NavLink>
          <NavLink to="/terminal" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="เทอร์มินัลคำสั่ง (Terminal)">
            <TerminalSquare size={18} className="nav-icon" />
            {!isCollapsed && <span>ส่งคำสั่ง (Terminal)</span>}
          </NavLink>
          <NavLink to="/trades" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="ประวัติการเทรด">
            <History size={18} className="nav-icon" />
            {!isCollapsed && <span>ประวัติการเทรด</span>}
          </NavLink>
          <NavLink to="/targets" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="เป้ากำไรรายวัน">
            <Target size={18} className="nav-icon" />
            {!isCollapsed && <span>เป้ากำไรรายวัน</span>}
          </NavLink>
          <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="รายงาน/วิเคราะห์">
            <BarChart3 size={18} className="nav-icon" />
            {!isCollapsed && <span>รายงาน/วิเคราะห์</span>}
          </NavLink>
          <NavLink to="/heatmap" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Exposure Heatmap">
            <Flame size={18} className="nav-icon" />
            {!isCollapsed && <span>Exposure Heatmap</span>}
          </NavLink>
          <NavLink to="/bots" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Trading Bots">
            <Cpu size={18} className="nav-icon" />
            {!isCollapsed && <span>Trading Bots</span>}
          </NavLink>

          <NavLink to="/store" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="สโตร์กลยุทธ์">
            <Store size={18} className="nav-icon" />
            {!isCollapsed && <span>Trading Bots</span>}
          </NavLink>

          <NavLink to="/strategies" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="ตลาด Copy Trading">
            <Copy size={18} className="nav-icon" />
            {!isCollapsed && <span>Copy Trading</span>}
          </NavLink>

          {!isCollapsed && <div className="sidebar-section-title">สังคมการเทรด (Community)</div>}
          <NavLink to="/forums" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="เว็บบอร์ด (Forums)">
            <MessageSquare size={18} className="nav-icon" />
            {!isCollapsed && <span>เว็บบอร์ดโซเชียล</span>}
          </NavLink>

          {!isCollapsed && <div className="sidebar-section-title">การเงิน & สมาชิก</div>}
          <NavLink to="/wallet" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="กระเป๋าเงิน">
            <Wallet size={18} className="nav-icon" />
            {!isCollapsed && <span>กระเป๋าเงิน</span>}
          </NavLink>
          <NavLink to="/billing" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="แพ็กเกจสมาชิก">
            <CreditCard size={18} className="nav-icon" />
            {!isCollapsed && <span>แพ็กเกจสมาชิก</span>}
          </NavLink>

          {!isCollapsed && <div className="sidebar-section-title">บัญชี</div>}
          <NavLink to="/accounts" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="จัดการบัญชี">
            <Building2 size={18} className="nav-icon" />
            {!isCollapsed && <span>จัดการบัญชี</span>}
          </NavLink>

          {isTeamLead && (
            <>
              {!isCollapsed && <div className="sidebar-section-title">ทีม</div>}
              <NavLink to="/groups" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="จัดการกลุ่ม/ทีม">
                <Users size={18} className="nav-icon" />
                {!isCollapsed && <span>จัดการกลุ่ม/ทีม</span>}
              </NavLink>
            </>
          )}

          {isAdmin && (
            <>
              {!isCollapsed && <div className="sidebar-section-title">ผู้ดูแล</div>}
              <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="แผงควบคุม">
                <Shield size={18} className="nav-icon" />
                {!isCollapsed && <span>แผงควบคุม</span>}
              </NavLink>
            </>
          )}

          {!isCollapsed && <div className="sidebar-section-title">ตั้งค่า</div>}
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="ตั้งค่าระบบ">
            <Settings size={18} className="nav-icon" />
            {!isCollapsed && <span>ตั้งค่าระบบ</span>}
          </NavLink>
        </nav>

        {/* User section */}
        <div style={{
          padding: isCollapsed ? 'var(--space-md)' : 'var(--space-md) var(--space-lg)',
          borderTop: '1px solid var(--border-primary)',
          display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between',
          flexDirection: isCollapsed ? 'column' : 'row',
          gap: isCollapsed ? '12px' : '0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--gradient-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 13, color: '#0a0e17',
              flexShrink: 0
            }}>
              {user?.display_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            {!isCollapsed && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{user?.display_name || user?.username}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ 
                    display: 'inline-block', 
                    width: 6, height: 6, borderRadius: '50%',
                    background: user?.role === 'admin' ? 'var(--loss)' : user?.role === 'team_lead' ? 'var(--warning)' : 'var(--profit)'
                  }}></span>
                  {user?.role === 'admin' ? 'Admin' : user?.role === 'team_lead' ? 'Team Lead' : 'Trader'}
                </div>
              </div>
            )}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={handleLogout} title="ออกจากระบบ">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content" style={{ position: 'relative' }}>
        <button 
          className="sidebar-toggle-btn"
          onClick={handleToggleCollapse}
          title="ซ่อน/แสดง เมนู"
        >
          <Menu size={20} />
        </button>
        <Outlet />
      </main>
    </div>
  );
}
