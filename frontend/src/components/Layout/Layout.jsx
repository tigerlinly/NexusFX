import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, History, Target, Settings, LogOut,
  Building2, Menu, Wallet, Users, BarChart3, Shield, Cpu, TerminalSquare, CreditCard, Store, Flame, Copy, MessageSquare, Globe, DollarSign, X, Handshake
} from 'lucide-react';
import NotificationBell from './NotificationBell';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('nexusfx_sidebar_collapsed') === 'true';
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile sidebar when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const handleToggleSidebar = () => {
    if (isMobile) {
      setIsMobileOpen(!isMobileOpen);
    } else {
      const newVal = !isCollapsed;
      setIsCollapsed(newVal);
      localStorage.setItem('nexusfx_sidebar_collapsed', newVal.toString());
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isTeamLead = user?.role === 'team_lead' || isAdmin;
  const isAgent = user?.role === 'agent' || isAdmin;

  // Determine sidebar classes based on mobile vs desktop
  let sidebarClass = 'sidebar ';
  if (isMobile) {
    sidebarClass += isMobileOpen ? 'mobile-open ' : 'mobile-closed ';
    // Reset collapsed state on mobile so items have labels
  } else {
    sidebarClass += isCollapsed ? 'collapsed ' : '';
  }

  // Determine if labels should be shown
  const showLabels = isMobile || !isCollapsed;

  return (
    <div className="app-layout">
      {/* Mobile Overlay */}
      {isMobile && isMobileOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setIsMobileOpen(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 199,
            backdropFilter: 'blur(4px)'
          }}
        />
      )}

      {/* Sidebar */}
      <aside className={sidebarClass}>
        <div className="sidebar-header" style={{ justifyContent: showLabels ? 'flex-start' : 'center' }}>
          <div className="sidebar-logo">N</div>
          {showLabels && <span className="sidebar-brand">NexusFX</span>}
          {isMobile && (
            <button className="btn btn-icon btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setIsMobileOpen(false)}>
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {showLabels && <div className="sidebar-section-title">Trading</div>}
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end title="Dashboard">
            <LayoutDashboard size={18} className="nav-icon" />
            {showLabels && <span>Dashboard</span>}
          </NavLink>
          <NavLink to="/trading" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Trading">
            <Cpu size={18} className="nav-icon" />
            {showLabels && <span>Trading</span>}
          </NavLink>


          <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="รายงาน/วิเคราะห์">
            <BarChart3 size={18} className="nav-icon" />
            {showLabels && <span>รายงาน/วิเคราะห์</span>}
          </NavLink>
          <NavLink to="/heatmap" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Exposure Heatmap">
            <Flame size={18} className="nav-icon" />
            {showLabels && <span>Exposure Heatmap</span>}
          </NavLink>

          <NavLink to="/store" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Marketplace">
            <Store size={18} className="nav-icon" />
            {showLabels && <span>Marketplace</span>}
          </NavLink>

          {showLabels && <div className="sidebar-section-title">สังคมการเทรด (Community)</div>}
          <NavLink to="/forums" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="เว็บบอร์ด (Forums)">
            <MessageSquare size={18} className="nav-icon" />
            {showLabels && <span>เว็บบอร์ดโซเชียล</span>}
          </NavLink>

          {showLabels && <div className="sidebar-section-title">การเงิน & สมาชิก</div>}
          <NavLink to="/wallet" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="กระเป๋าเงิน">
            <Wallet size={18} className="nav-icon" />
            {showLabels && <span>กระเป๋าเงิน</span>}
          </NavLink>
          <NavLink to="/billing" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="แพ็กเกจสมาชิก">
            <CreditCard size={18} className="nav-icon" />
            {showLabels && <span>แพ็กเกจสมาชิก</span>}
          </NavLink>

          {showLabels && <div className="sidebar-section-title">บัญชี</div>}
          <NavLink to="/accounts" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="จัดการบัญชี">
            <Building2 size={18} className="nav-icon" />
            {showLabels && <span>จัดการบัญชี</span>}
          </NavLink>
          <NavLink to="/brokers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="โบรกเกอร์ (Brokers)">
            <Globe size={18} className="nav-icon" />
            {showLabels && <span>โบรกเกอร์แนะนำ</span>}
          </NavLink>

          {isTeamLead && (
            <>
              {showLabels && <div className="sidebar-section-title">ทีม</div>}
              <NavLink to="/groups" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="จัดการกลุ่ม/ทีม">
                <Users size={18} className="nav-icon" />
                {showLabels && <span>จัดการกลุ่ม/ทีม</span>}
              </NavLink>
            </>
          )}

          {isAgent && (
            <>
              {showLabels && <div className="sidebar-section-title">ตัวแทน (Agent)</div>}
              <NavLink to="/agent" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="ระบบตัวแทน">
                <Handshake size={18} className="nav-icon" />
                {showLabels && <span>ระบบตัวแทน</span>}
              </NavLink>
            </>
          )}

          {isAdmin && (
            <>
              {showLabels && <div className="sidebar-section-title">ผู้ดูแล</div>}
              <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive && window.location.pathname === '/admin' ? 'active' : ''}`} title="แผงควบคุม" end>
                <Shield size={18} className="nav-icon" />
                {showLabels && <span>แผงควบคุม</span>}
              </NavLink>
              <NavLink to="/admin/billing" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="ตั้งค่าบัญชีรับเงิน">
                <DollarSign size={18} className="nav-icon" />
                {showLabels && <span>ตั้งค่าบัญชีรับเงิน</span>}
              </NavLink>
            </>
          )}

          {showLabels && <div className="sidebar-section-title">ตั้งค่า</div>}
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="ตั้งค่าระบบ">
            <Settings size={18} className="nav-icon" />
            {showLabels && <span>ตั้งค่าระบบ</span>}
          </NavLink>
        </nav>

        {/* User section */}
        <div style={{
          padding: showLabels ? 'var(--space-md) var(--space-lg)' : 'var(--space-md)',
          borderTop: '1px solid var(--border-primary)',
          display: 'flex', alignItems: 'center', justifyContent: !showLabels ? 'center' : 'space-between',
          flexDirection: !showLabels ? 'column' : 'row',
          gap: !showLabels ? '12px' : '0'
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
            {showLabels && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{user?.display_name || user?.username}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ 
                    display: 'inline-block', 
                    width: 6, height: 6, borderRadius: '50%',
                    background: user?.role === 'admin' ? 'var(--loss)' : user?.role === 'team_lead' ? 'var(--warning)' : 'var(--profit)'
                  }}></span>
                  {user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : user?.role === 'agent' ? 'Agent' : user?.role === 'team_lead' ? 'Team Lead' : 'Trader'}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <NotificationBell />
            <button className="btn btn-ghost btn-icon" onClick={handleLogout} title="ออกจากระบบ">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content" style={{ position: 'relative' }}>
        <div className="main-header-controls" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'absolute', top: 12, left: 12, zIndex: 100 }}>
          <button 
            className="sidebar-toggle-btn"
            onClick={handleToggleSidebar}
            title="ซ่อน/แสดง เมนู"
            style={{ position: 'static' }}
          >
            <Menu size={20} />
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
