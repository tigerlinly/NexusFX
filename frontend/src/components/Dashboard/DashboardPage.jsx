import { useState, useEffect, useRef, useCallback } from 'react';
import { useAccounts } from '../../context/AccountContext';
import { api } from '../../utils/api';
import AccountFilter from './AccountFilter';
import {
  DollarSign, TrendingUp, TrendingDown, Activity, BarChart3,
  PieChart, Target, Wallet, ArrowUpRight, ArrowDownRight, Banknote,
  Edit3, Save, X, Settings2, GripVertical, Eye, EyeOff, RotateCcw, Check
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine, Label
} from 'recharts';

export default function DashboardPage() {
  const { getFilterParams, viewMode } = useAccounts();
  const [summary, setSummary] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [targetStatus, setTargetStatus] = useState([]);
  const [chartFilterType, setChartFilterType] = useState('duration');
  const [chartPeriod, setChartPeriod] = useState('30');
  const [selectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState(['targets', 'summary', 'chart', 'breakdown']);
  const [editMode, setEditMode] = useState(false);
  const [editLayout, setEditLayout] = useState([]);
  
  // Drag & Drop state
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const dragStartIdx = useRef(null);

  const ALL_WIDGETS = ['targets', 'summary', 'chart', 'breakdown'];
  const WIDGET_NAMES = {
    targets: 'เป้าหมายรายวัน',
    summary: 'การ์ดสรุปข้อมูล',
    chart: 'กราฟกำไร/ขาดทุน',
    breakdown: 'สรุปแยกบัญชี',
  };
  const WIDGET_ICONS = {
    targets: <Target size={16} />,
    summary: <Wallet size={16} />,
    chart: <BarChart3 size={16} />,
    breakdown: <PieChart size={16} />,
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const formatDate = (d) => {
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
      };
      
      let startDateStr, endDateStr;
      const today = new Date();
      
      if (chartFilterType === 'duration') {
        endDateStr = formatDate(today);
        const past = new Date(today);
        past.setDate(past.getDate() - parseInt(chartPeriod) + 1);
        startDateStr = formatDate(past);
      } else if (chartFilterType === 'current_month') {
        endDateStr = formatDate(today);
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        startDateStr = formatDate(start);
      } else {
        const start = new Date(selectedYear, selectedMonth, 1);
        startDateStr = formatDate(start);
        
        if (selectedYear === today.getFullYear() && selectedMonth === today.getMonth()) {
          endDateStr = formatDate(today);
        } else {
          const end = new Date(selectedYear, selectedMonth + 1, 0);
          endDateStr = formatDate(end);
        }
      }

      const params = getFilterParams();
      const [sum, chart, brk, targets, widgetsData] = await Promise.all([
        api.getDashboardSummary(params),
        api.getPnlChart({ ...params, start_date: startDateStr, end_date: endDateStr }),
        api.getAccountBreakdown(params),
        api.getTargetStatus(),
        api.getWidgets().catch(() => [])
      ]);
      setSummary(sum);
      setChartData(chart);
      setBreakdown(brk);
      setTargetStatus(targets);

      const defaultLayout = ['targets', 'summary', 'chart', 'breakdown'];
      if (widgetsData && widgetsData.length > 0) {
        setLayout(widgetsData.sort((a,b) => a.position_y - b.position_y).map(w => w.widget_type));
      } else {
        setLayout(defaultLayout);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [chartFilterType, chartPeriod, selectedMonth, selectedYear, getFilterParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData, viewMode]);

  const formatCurrency = (val) => {
    if (val === undefined || val === null || val === '') return '$0.00';
    const num = parseFloat(val);
    if (isNaN(num)) return '$0.00';
    if (num === 0) return '$0.00';
    const prefix = num > 0 ? '+' : '-';
    return `${prefix}$${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // =============================================
  // DRAG & DROP HANDLERS
  // =============================================
  const handleDragStart = useCallback((e, idx) => {
    dragStartIdx.current = idx;
    setDraggedItem(idx);
    e.dataTransfer.effectAllowed = 'move';
    // Set a custom drag image (optional - uses default ghost)
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
      const payload = editLayout.map((type, idx) => ({
        widget_type: type,
        position_y: idx,
        position_x: 0,
      }));
      await api.updateWidgets(payload);
      setLayout(editLayout);
      setEditMode(false);
    } catch {
      alert('Failed to save layout');
    }
  };

  const resetLayout = () => {
    setEditLayout(['targets', 'summary', 'chart', 'breakdown']);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditLayout([]);
  };

  // =============================================
  // CHART HELPERS
  // =============================================
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-md)', padding: '12px', fontSize: 12
      }}>
        <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>
          {typeof label === 'string' && label.includes('T') ? label.split('T')[0] : label}
        </div>
        <div style={{ color: payload[0].value >= 0 ? 'var(--profit)' : 'var(--loss)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
          กำไร/ขาดทุน: {formatCurrency(payload[0].value)}
        </div>
        {payload[1] && (
          <div style={{ color: 'var(--accent-secondary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            กำไรสะสม: {formatCurrency(payload[1].value)}
          </div>
        )}
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
        case 'targets':
          if (targetStatus.length === 0) return (
            <div style={{ padding: 'var(--space-lg)', color: 'var(--text-tertiary)', textAlign: 'center', fontSize: 13 }}>
              ยังไม่มีเป้าหมายรายวัน — ตั้งค่าได้ที่หน้า Daily Targets
            </div>
          );
          return (
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              {targetStatus.map(t => (
                <div key={t.id} className={`target-widget ${t.reached ? 'reached' : ''}`}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-md)' }}>
                    <div className="flex items-center gap-sm">
                      <Target size={18} style={{ color: t.reached ? 'var(--profit)' : 'var(--accent-primary)' }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>
                        เป้ากำไรวันนี้ {t.account_name ? `(${t.account_name})` : '(รวมทั้งหมด)'} <span style={{ color: 'var(--text-tertiary)', fontWeight: 'normal', marginLeft: 6 }}>{t.progress.toFixed(1)}%</span>
                      </span>
                    </div>
                    <div className="flex items-baseline">
                      <span className="target-pnl" style={{ color: t.current_pnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                        {t.current_pnl > 0 ? '+' : t.current_pnl < 0 ? '-' : ''}{formatCurrency(Math.abs(t.current_pnl))}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 24, margin: '0 8px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>/</span>
                      <span className="target-amount" style={{ color: 'var(--text-secondary)', fontSize: 24, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                        ${parseFloat(t.target_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div className={`progress-fill ${t.reached ? 'reached' : ''}`} style={{ width: `${Math.min(100, Math.max(0, t.progress))}%` }} />
                  </div>
                  {t.reached && (
                    <div className="flex justify-end mt-md" style={{ fontSize: 11 }}>
                      <span style={{ color: 'var(--profit)', fontWeight: 600 }}>🎯 ถึงเป้าแล้ว!</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );

        case 'summary':
          return (
            <div className="stat-grid" style={{ marginBottom: 'var(--space-lg)' }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">ยอดคงเหลือ</span>
                  <div className="card-icon" style={{ background: 'rgba(0, 200, 150, 0.1)' }}><Wallet size={18} style={{ color: 'var(--accent-primary)' }} /></div>
                </div>
                <div className="card-value">${summary?.total_balance?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}</div>
                <div className="card-sub">{summary?.accounts_count || 0} บัญชี</div>
              </div>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">ถอนเงิน</span>
                  <div className="card-icon" style={{ background: 'rgba(251, 146, 60, 0.1)' }}><Banknote size={18} style={{ color: '#fb923c' }} /></div>
                </div>
                <div className="card-value" style={{ color: '#fb923c' }}>${summary?.total_withdrawal?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}</div>
                <div className="card-sub">{summary?.accounts_count || 0} บัญชี</div>
              </div>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Equity</span>
                  <div className="card-icon" style={{ background: 'rgba(14, 165, 233, 0.1)' }}><BarChart3 size={18} style={{ color: 'var(--accent-secondary)' }} /></div>
                </div>
                <div className="card-value">${summary?.total_equity?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}</div>
                <div className="card-sub">Floating: {formatCurrency(summary?.floating_pnl)}</div>
              </div>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">กำไรวันนี้</span>
                  <div className="card-icon" style={{ background: summary?.total_pnl_today >= 0 ? 'var(--profit-bg)' : 'var(--loss-bg)' }}>
                    {summary?.total_pnl_today >= 0 ? <ArrowUpRight size={18} style={{ color: 'var(--profit)' }} /> : <ArrowDownRight size={18} style={{ color: 'var(--loss)' }} />}
                  </div>
                </div>
                <div className={`card-value ${summary?.total_pnl_today >= 0 ? 'profit' : 'loss'}`}>{formatCurrency(summary?.total_pnl_today)}</div>
                <div className="card-sub">{summary?.total_trades_today || 0} เทรด</div>
              </div>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Win Rate วันนี้</span>
                  <div className="card-icon" style={{ background: 'rgba(139, 92, 246, 0.1)' }}><PieChart size={18} style={{ color: 'var(--accent-tertiary)' }} /></div>
                </div>
                <div className="card-value">{summary?.win_rate_today || 0}%</div>
                <div className="card-sub">Volume: {summary?.volume_today?.toFixed(2) || '0.00'} lots</div>
              </div>
            </div>
          );

        case 'chart': {
          const boundaryLines = [];
          const monthLabels = [];
          if (chartData && chartData.length > 0) {
            let currentMonth = null;
            const groupedByMonth = {};
            
            chartData.forEach((d) => {
              const dateObj = new Date(d.date);
              const monthKey = `${dateObj.getFullYear()}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
              
              if (!groupedByMonth[monthKey]) groupedByMonth[monthKey] = [];
              groupedByMonth[monthKey].push(d);

              if (monthKey !== currentMonth) {
                if (currentMonth !== null) {
                  boundaryLines.push({ date: d.date });
                }
                currentMonth = monthKey;
              }
            });

            Object.entries(groupedByMonth).forEach(([monthKey, days]) => {
              // พยายามหาวันที่ 15 ของเดือน ถ้ายาวเต็มเดือน จะได้อยู่ตรงกลางเป๊ะๆ
              let targetDay = days[Math.floor(days.length / 2)];
              const fifteenth = days.find(d => new Date(d.date).getDate() === 15);
              if (fifteenth) {
                targetDay = fifteenth;
              }
              monthLabels.push({ date: targetDay.date, label: monthKey });
            });
          }

          return (
            <div className="chart-card" style={{ marginBottom: 'var(--space-lg)' }}>
              <div className="chart-header">
                <div className="chart-title-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <h3 className="chart-title" style={{ margin: 0 }}>กราฟกำไร/ขาดทุน</h3>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 12, height: 3, background: 'var(--accent-primary)' }}></span>กำไร/ขาดทุน</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 12, height: 3, borderTop: '3px dashed #00b4d8' }}></span>กำไรสะสม</div>
                  </div>
                </div>
                <div className="filter-group" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select className="filter-select filter-select-view" value={chartFilterType} onChange={(e) => setChartFilterType(e.target.value)} style={{ minWidth: 120, height: 32, border: '1px solid #ffffff' }}>
                    <option value="duration" hidden>เลือกระยะเวลา</option>
                    <option value="current_month">เดือนปัจจุบัน</option>
                    <option value="custom_month">ระบุเดือน...</option>
                  </select>
                  <div className="filter-group" style={{ display: 'flex', border: '1px solid #ffffff', borderRadius: '6px', overflow: 'hidden' }}>
                    {['7', '14', '30', '60', '90'].map(p => (
                      <button
                        key={p}
                        className={`filter-btn ${chartFilterType === 'duration' && String(chartPeriod) === String(p) ? 'active' : ''}`}
                        onClick={() => { setChartFilterType('duration'); setChartPeriod(p); }}
                        style={{ 
                          border: 'none', borderRadius: 0, padding: '4px 12px',
                          background: chartFilterType === 'duration' && String(chartPeriod) === String(p) ? 'var(--accent-primary)' : 'transparent',
                          color: chartFilterType === 'duration' && String(chartPeriod) === String(p) ? '#fff' : 'var(--text-secondary)'
                        }}
                      >{p}D</button>
                    ))}
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={chartData} margin={{ top: 55, right: 30, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                  <XAxis dataKey="date" interval={0} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickFormatter={(val) => new Date(val).getDate().toString()} />
                  <YAxis tickCount={10} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickFormatter={(val) => { const abs = Math.abs(val); return abs >= 1000 ? (val / 1000).toLocaleString() + 'K' : val; }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#ffffff" strokeDasharray="3 3" />
                  {boundaryLines.map(m => (
                    <ReferenceLine key={`bound-${m.date}`} x={m.date} stroke="var(--accent-secondary)" strokeOpacity={0.6} strokeDasharray="4 4" />
                  ))}
                  {monthLabels.map(m => (
                    <ReferenceLine key={`label-${m.date}`} x={m.date} stroke="none">
                      <Label value={m.label} position="top" fill="var(--accent-secondary)" fontSize={12} offset={25} />
                    </ReferenceLine>
                  ))}
                  <Area type="monotone" dataKey="pnl" stroke="var(--accent-primary)" fill="url(#pnlGradient)" strokeWidth={2} />
                  <Area type="monotone" dataKey="cumulative_pnl" stroke="#00b4d8" fill="none" strokeWidth={3} strokeDasharray="8 6" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          );
        }

        case 'breakdown':
          if (breakdown.length === 0) return (
            <div className="chart-card" style={{ padding: 'var(--space-xl)', color: 'var(--text-tertiary)', textAlign: 'center' }}>
              ยังไม่มีข้อมูลบัญชีเทรด
            </div>
          );
          return (
            <div className="chart-card" style={{ marginTop: 24, marginBottom: 24 }}>
              <h3 className="chart-title" style={{ marginBottom: 'var(--space-lg)' }}>สรุปแยกบัญชี</h3>
              <div className="data-table-wrapper" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Broker</th><th>บัญชี</th><th>Balance</th><th>Equity</th><th>กำไรวันนี้</th><th>เทรดวันนี้</th><th>Win Rate</th></tr>
                  </thead>
                  <tbody>
                    {breakdown.map(b => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 500 }}>{b.broker_name}</td>
                        <td>{b.account_name} <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>#{b.account_number}</span></td>
                        <td>${parseFloat(b.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td>${parseFloat(b.equity).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className={parseFloat(b.today_pnl) >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatCurrency(b.today_pnl)}</td>
                        <td>{b.today_trades}</td>
                        <td>{parseFloat(b.today_win_rate).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
  // RENDER
  // =============================================
  const displayLayout = editMode ? editLayout : layout;

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title">Dashboard</h1>
        </div>
        <div className="header-right">
          <AccountFilter />
          <button 
            className="btn-icon" 
            title={editMode ? 'ออกจากโหมดแก้ไข' : 'ปรับแต่งแดชบอร์ด'}
            onClick={editMode ? cancelEdit : enterEditMode}
            style={{
              color: editMode ? 'var(--accent-primary)' : 'var(--text-secondary)',
              background: editMode ? 'rgba(0, 200, 150, 0.1)' : 'transparent',
            }}
          >
            <Settings2 size={18} />
          </button>
        </div>
      </div>

      <div className="content-area">
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
      </div>
    </>
  );
}
