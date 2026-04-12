import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import {
  Shield, Users, UserCheck, Activity, DollarSign, Server, Database,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, BarChart3,
  PieChart as PieChartIcon, Wallet, Banknote, Zap, RefreshCw,
  Settings2, Edit3, Save, X, GripVertical, Eye, EyeOff, RotateCcw, Check
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area
} from 'recharts';

const ROLE_COLORS = ['#00C49F', '#FFBB28', '#FF8042', '#0088FE', '#8884d8', '#FF6B6B'];
const ROLE_LABELS = {
  user: 'ผู้ใช้งาน',
  team_lead: 'ผู้นำทีม',
  admin: 'ผู้ดูแล',
  super_admin: 'Super Admin',
  agent: 'ตัวแทน',
};

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Layout State
  const [layout, setLayout] = useState(['summary', 'charts', 'checkpoints']);
  const [editMode, setEditMode] = useState(false);
  const [editLayout, setEditLayout] = useState([]);
  
  // Drag & Drop state
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const dragStartIdx = useRef(null);

  const ALL_WIDGETS = ['summary', 'charts', 'checkpoints'];
  const WIDGET_NAMES = {
    summary: 'การ์ดสรุปข้อมูล',
    charts: 'กราฟสัดส่วน & กระแสเงินสด',
    checkpoints: 'สิ่งที่ผู้ดูแลควรติดตาม (Checkpoints)',
  };
  const WIDGET_ICONS = {
    summary: <Wallet size={16} />,
    charts: <PieChartIcon size={16} />,
    checkpoints: <Activity size={16} />,
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, rl] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminRoles(),
      ]);
      setOverview(ov);
      setRoles(rl);

      // Load layout from localStorage
      const savedLayout = localStorage.getItem(`nexusfx_admin_layout_${user?.id}`);
      if (savedLayout) {
        try {
          const parsed = JSON.parse(savedLayout);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setLayout(parsed);
          }
        } catch(e){}
      }
    } catch (err) {
      console.error('Admin Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (val) => {
    if (val === undefined || val === null || val === '') return '$0.00';
    const num = parseFloat(val);
    if (isNaN(num)) return '$0.00';
    if (num === 0) return '$0.00';
    const prefix = num > 0 ? '+' : '-';
    return `${prefix}$${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatNumber = (val) => {
    return Number(val || 0).toLocaleString('en-US');
  };

  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
    return (
      <>
        <div className="header">
          <div className="header-left">
            <h1 className="page-title">Admin Dashboard</h1>
          </div>
        </div>
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

  // Prepare role data for pie chart
  const roleData = roles.map(r => ({
    name: ROLE_LABELS[r.role_name] || r.role_name,
    value: parseInt(r.user_count) || 0,
    key: r.role_name
  })).filter(r => r.value > 0);

  const totalUsers = roleData.reduce((sum, r) => sum + r.value, 0);

  // Prepare revenue data for bar chart
  const revenueData = overview ? [
    { name: 'ยอดฝาก', amount: parseFloat(overview.revenue?.total_deposits || 0), color: 'var(--profit)' },
    { name: 'ยอดถอน', amount: parseFloat(overview.revenue?.total_withdrawals || 0), color: 'var(--loss)' },
    { name: 'ค่าธรรมเนียม', amount: parseFloat(overview.revenue?.total_fees || 0), color: 'var(--warning)' },
  ] : [];

  const CustomTooltipChart = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-md)', padding: '12px', fontSize: 12
      }}>
        <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color || 'var(--text-primary)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
            {p.name}: ${Number(p.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        ))}
      </div>
    );
  };

  const PieCustomLabel = ({ cx, cy }) => (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" style={{ fill: 'var(--text-primary)', fontSize: 22, fontWeight: 700 }}>
      {totalUsers}
    </text>
  );

  // =============================================
  // DRAG & DROP HANDLERS
  // =============================================
  const handleDragStart = useCallback((e, idx) => {
    dragStartIdx.current = idx;
    setDraggedItem(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  }, []);

  const handleDragOver = useCallback((e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverItem(idx);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverItem(null);
  }, []);

  const handleDrop = useCallback((e, dropIdx) => {
    e.preventDefault();
    const startIdx = dragStartIdx.current;
    if (startIdx === null || startIdx === dropIdx) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    const newLayout = [...editLayout];
    const [removed] = newLayout.splice(startIdx, 1);
    newLayout.splice(dropIdx, 0, removed);
    
    setEditLayout(newLayout);
    setDraggedItem(null);
    setDragOverItem(null);
    dragStartIdx.current = null;
  }, [editLayout]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverItem(null);
    dragStartIdx.current = null;
  }, []);

  const toggleWidget = useCallback((type) => {
    setEditLayout(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  }, []);

  const enterEditMode = () => {
    setEditLayout([...layout]);
    setEditMode(true);
  };

  const saveLayout = async () => {
    try {
      localStorage.setItem(`nexusfx_admin_layout_${user?.id}`, JSON.stringify(editLayout));
      setLayout(editLayout);
      setEditMode(false);
    } catch {
      alert('Failed to save layout');
    }
  };

  const resetLayout = () => {
    setEditLayout(['summary', 'charts', 'checkpoints']);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditLayout([]);
  };

  // =============================================
  // EDIT MODE TOOLBAR
  // =============================================
  const renderEditToolbar = () => {
    if (!editMode) return null;

    return (
      <div className="edit-toolbar" style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--accent-primary)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-md) var(--space-lg)',
        marginBottom: 'var(--space-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-md)',
        animation: 'slideDown 0.3s ease',
        boxShadow: '0 4px 20px rgba(0, 200, 150, 0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-primary)', fontWeight: 600, fontSize: 13 }}>
            <Edit3 size={16} /> โหมดแก้ไข
          </div>
          
          <div style={{ height: 20, width: 1, background: 'var(--border-secondary)' }} />
          
          {/* Widget toggles */}
          {ALL_WIDGETS.map(type => {
            const isActive = editLayout.includes(type);
            return (
              <button
                key={type}
                onClick={() => toggleWidget(type)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 12px', borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-primary)'}`,
                  background: isActive ? 'rgba(0, 200, 150, 0.1)' : 'var(--bg-tertiary)',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  transition: 'all 0.2s ease',
                }}
                title={isActive ? 'คลิกเพื่อซ่อน' : 'คลิกเพื่อแสดง'}
              >
                {isActive ? <Eye size={13} /> : <EyeOff size={13} />}
                {WIDGET_ICONS[type]}
                {WIDGET_NAMES[type]}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button 
            onClick={resetLayout}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-primary)', background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12,
            }}
          >
            <RotateCcw size={13} /> รีเซ็ต
          </button>
          <button 
            onClick={cancelEdit}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-primary)', background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12,
            }}
          >
            <X size={13} /> ยกเลิก
          </button>
          <button 
            onClick={saveLayout}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 14px', borderRadius: 'var(--radius-sm)',
              border: 'none', background: 'var(--gradient-primary)',
              color: '#000', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}
          >
            <Check size={13} /> บันทึก
          </button>
        </div>
      </div>
    );
  };

  // =============================================
  // WIDGET RENDERERS
  // =============================================
  const renderWidget = (type, idx) => {
    const isEditing = editMode;
    const isDragging = draggedItem === idx;
    const isDragOver = dragOverItem === idx;

    const wrapperStyle = {
      position: 'relative',
      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      opacity: isDragging ? 0.4 : 1,
      transform: isDragOver ? 'scale(1.01)' : 'scale(1)',
    };

    const editOverlayStyle = isEditing ? {
      outline: isDragOver 
        ? '2px dashed var(--accent-primary)' 
        : '2px dashed var(--border-secondary)',
      outlineOffset: '4px',
      borderRadius: 'var(--radius-lg)',
      cursor: 'grab',
    } : {};

    const dragHandle = isEditing ? (
      <div 
        className="drag-handle"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 10px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-secondary)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 11,
          color: 'var(--text-tertiary)',
          pointerEvents: 'none',
        }}
      >
        <GripVertical size={14} />
        <span>{WIDGET_NAMES[type]}</span>
      </div>
    ) : null;

    const content = (() => {
      switch (type) {
        case 'summary':
          return (
            <div className="stat-grid" style={{ marginBottom: 'var(--space-lg)' }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">ผู้ใช้ทั้งหมด</span>
                  <div className="card-icon" style={{ background: 'rgba(0, 200, 150, 0.1)' }}>
                    <Users size={18} style={{ color: 'var(--accent-primary)' }} />
                  </div>
                </div>
                <div className="card-value">{formatNumber(totalUsers)}</div>
                <div className="card-sub">{roleData.length} บทบาท</div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">เทรดเดอร์ที่ Active</span>
                  <div className="card-icon" style={{ background: 'rgba(251, 146, 60, 0.1)' }}>
                    <Activity size={18} style={{ color: '#fb923c' }} />
                  </div>
                </div>
                <div className="card-value" style={{ color: '#fb923c' }}>{formatNumber(overview?.active_traders)}</div>
                <div className="card-sub">มีการเทรดล่าสุด</div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">System PNL รวม</span>
                  <div className="card-icon" style={{ background: (overview?.total_pnl || 0) >= 0 ? 'var(--profit-bg)' : 'var(--loss-bg)' }}>
                    {(overview?.total_pnl || 0) >= 0
                      ? <ArrowUpRight size={18} style={{ color: 'var(--profit)' }} />
                      : <ArrowDownRight size={18} style={{ color: 'var(--loss)' }} />
                    }
                  </div>
                </div>
                <div className={`card-value ${(overview?.total_pnl || 0) >= 0 ? 'profit' : 'loss'}`}>
                  {formatCurrency(overview?.total_pnl)}
                </div>
                <div className="card-sub">{formatNumber(overview?.total_trades)} เทรดทั้งหมด</div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">ยอดฝากรวม</span>
                  <div className="card-icon" style={{ background: 'rgba(14, 165, 233, 0.1)' }}>
                    <Banknote size={18} style={{ color: 'var(--accent-secondary)' }} />
                  </div>
                </div>
                <div className="card-value">
                  ${Number(overview?.revenue?.total_deposits || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="card-sub">
                  ถอน: ${Number(overview?.revenue?.total_withdrawals || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">กลุ่ม / ทีม</span>
                  <div className="card-icon" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                    <Server size={18} style={{ color: 'var(--accent-tertiary)' }} />
                  </div>
                </div>
                <div className="card-value">{formatNumber(overview?.total_groups)}</div>
                <div className="card-sub">Active Communities</div>
              </div>
            </div>
          );

        case 'charts':
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
              {/* Role Distribution Pie Chart */}
              <div className="chart-card">
                <h3 className="chart-title" style={{ marginBottom: 'var(--space-md)' }}>
                  สัดส่วนผู้ใช้งาน (Role)
                </h3>
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={roleData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        labelLine={false}
                        label={PieCustomLabel}
                      >
                        {roleData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={ROLE_COLORS[index % ROLE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 8 }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value, name) => [`${value} คน`, name]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        iconSize={8}
                        formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Revenue Bar Chart */}
              <div className="chart-card">
                <div className="chart-header">
                  <h3 className="chart-title" style={{ margin: 0 }}>กระแสเงินสด & ค่าธรรมเนียมระบบ</h3>
                </div>
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fontSize: 12 }} />
                      <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 12 }} tickFormatter={(val) => `$${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`} />
                      <Tooltip content={<CustomTooltipChart />} />
                      <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={60}>
                        {revenueData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          );

        case 'checkpoints':
          return (
            <div className="chart-card" style={{ marginBottom: 'var(--space-lg)' }}>
              <h3 className="chart-title" style={{ marginBottom: 'var(--space-lg)' }}>สิ่งที่ผู้ดูแลควรติดตาม (Admin Checkpoints)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 10,
                    background: 'rgba(0, 196, 159, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#00C49F', flexShrink: 0
                  }}>
                    <Database size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 2 }}>Trading Volume Total</div>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {formatNumber(overview?.total_trades)} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>Trades</span>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 10,
                    background: (overview?.total_pnl || 0) >= 0 ? 'rgba(0, 196, 159, 0.1)' : 'rgba(255, 71, 87, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: (overview?.total_pnl || 0) >= 0 ? '#00C49F' : '#FF4757', flexShrink: 0
                  }}>
                    {(overview?.total_pnl || 0) >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 2 }}>System Total PNL</div>
                    <div style={{
                      fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)',
                      color: (overview?.total_pnl || 0) >= 0 ? 'var(--profit)' : 'var(--loss)'
                    }}>
                      {formatCurrency(overview?.total_pnl)}
                    </div>
                  </div>
                </div>

                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 10,
                    background: 'rgba(0, 136, 254, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#0088FE', flexShrink: 0
                  }}>
                    <Zap size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 2 }}>ค่าธรรมเนียมรวม</div>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--warning)' }}>
                      ${Number(overview?.revenue?.total_fees || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 10,
                    background: 'rgba(139, 92, 246, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#8b5cf6', flexShrink: 0
                  }}>
                    <Server size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 2 }}>Active Groups / Communities</div>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {formatNumber(overview?.total_groups)} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>Groups</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );

        default: return null;
      }
    })();

    return (
      <div
        key={type}
        style={{ ...wrapperStyle, ...editOverlayStyle }}
        draggable={isEditing}
        onDragStart={isEditing ? (e) => handleDragStart(e, idx) : undefined}
        onDragOver={isEditing ? (e) => handleDragOver(e, idx) : undefined}
        onDragLeave={isEditing ? handleDragLeave : undefined}
        onDrop={isEditing ? (e) => handleDrop(e, idx) : undefined}
        onDragEnd={isEditing ? handleDragEnd : undefined}
      >
        {dragHandle}
        {content}
      </div>
    );
  };

  const displayLayout = editMode ? editLayout : layout;

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={20} style={{ color: 'var(--accent-primary)' }} />
            Admin Dashboard
          </h1>
        </div>
        <div className="header-right">
          <button className="btn btn-ghost btn-sm" onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} /> รีเฟรช
          </button>
          
          <button 
            className="btn-icon" 
            title={editMode ? 'ออกจากโหมดแก้ไข' : 'ปรับแต่งแดชบอร์ด'}
            onClick={editMode ? cancelEdit : enterEditMode}
            style={{
              color: editMode ? 'var(--accent-primary)' : 'var(--text-secondary)',
              background: editMode ? 'rgba(0, 200, 150, 0.1)' : 'transparent',
              marginLeft: 8
            }}
          >
            <Settings2 size={18} />
          </button>
        </div>
      </div>

      <div className="content-area">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
            กำลังโหลดข้อมูล...
          </div>
        ) : (
          <>
            {renderEditToolbar()}
            
            {editMode && (
              <div style={{ 
                color: 'var(--text-tertiary)', fontSize: 12, marginBottom: 'var(--space-md)',
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 12px',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border-secondary)',
              }}>
                <GripVertical size={14} /> 
                ลากและวางวิดเจ็ตเพื่อเรียงลำดับใหม่ หรือคลิกปุ่มด้านบนเพื่อแสดง/ซ่อนวิดเจ็ต
              </div>
            )}

            {!loading && displayLayout.map((type, idx) => renderWidget(type, idx))}
            
            {editMode && displayLayout.length === 0 && (
              <div style={{
                textAlign: 'center', padding: 'var(--space-2xl)',
                color: 'var(--text-tertiary)', fontSize: 14,
                border: '2px dashed var(--border-secondary)',
                borderRadius: 'var(--radius-lg)',
              }}>
                ไม่มีวิดเจ็ตที่แสดงอยู่ — คลิกปุ่มด้านบนเพื่อเพิ่มวิดเจ็ต
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
