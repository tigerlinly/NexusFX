import { useState, useEffect } from 'react';
import { useAccounts } from '../../context/AccountContext';
import { api } from '../../utils/api';
import AccountFilter from './AccountFilter';
import {
  DollarSign, TrendingUp, TrendingDown, Activity, BarChart3,
  PieChart, Target, Wallet, ArrowUpRight, ArrowDownRight, Banknote, Edit3, Save, X, Settings2
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
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState(['targets', 'summary', 'chart', 'breakdown']);
  const [showLayoutModal, setShowLayoutModal] = useState(false);
  const [editLayout, setEditLayout] = useState([]);

  const fetchData = async () => {
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
  };

  useEffect(() => {
    fetchData();
  }, [viewMode, chartFilterType, chartPeriod, selectedMonth, selectedYear, getFilterParams]);

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '$0.00';
    const num = parseFloat(val);
    const prefix = num >= 0 ? '+' : '';
    return `${prefix}$${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      setShowLayoutModal(false);
    } catch (err) {
      alert('Failed to save layout');
    }
  };

  const monthTransitions = [];
  chartData.forEach((d, i) => {
    if (i > 0) {
      const prevDate = new Date(chartData[i-1].date);
      const currDate = new Date(d.date);
      if (prevDate.getMonth() !== currDate.getMonth()) {
        monthTransitions.push(d.date);
      }
    }
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-md)', padding: '12px', fontSize: 12
      }}>
        <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
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

  const renderWidget = (type) => {
    switch (type) {
      case 'targets':
        if (targetStatus.length === 0) return null;
        return (
          <div key="targets" style={{ marginBottom: 'var(--space-lg)' }}>
            {targetStatus.map(t => (
              <div key={t.id} className={`target-widget ${t.reached ? 'reached' : ''}`}>
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-md)' }}>
                  <div className="flex items-center gap-sm">
                    <Target size={18} style={{ color: t.reached ? 'var(--profit)' : 'var(--accent-primary)' }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      เป้ากำไรวันนี้ {t.account_name ? `(${t.account_name})` : '(รวมทั้งหมด)'}
                    </span>
                  </div>
                  <div>
                    <span className="target-pnl" style={{ color: t.current_pnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}>{formatCurrency(t.current_pnl)}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 14, margin: '0 6px' }}>/</span>
                    <span className="target-amount" style={{ color: 'var(--text-primary)', fontSize: 20 }}>${parseFloat(t.target_amount).toFixed(2)}</span>
                  </div>
                </div>
                <div className="progress-bar">
                  <div className={`progress-fill ${t.reached ? 'reached' : ''}`} style={{ width: `${Math.min(100, Math.max(0, t.progress))}%` }} />
                </div>
                <div className="flex justify-between mt-md" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  <span>{t.progress.toFixed(1)}%</span>
                  {t.reached && <span style={{ color: 'var(--profit)', fontWeight: 600 }}>🎯 ถึงเป้าแล้ว!</span>}
                </div>
              </div>
            ))}
          </div>
        );

      case 'summary':
        return (
          <div key="summary" className="stat-grid" style={{ marginBottom: 'var(--space-lg)' }}>
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

      case 'chart':
        return (
          <div key="chart" className="chart-card" style={{ marginBottom: 'var(--space-lg)' }}>
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
                {/* Custom Month Handling logic */}
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
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
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
                <Area type="monotone" dataKey="pnl" stroke="var(--accent-primary)" fill="url(#pnlGradient)" strokeWidth={2} />
                <Area type="monotone" dataKey="cumulative_pnl" stroke="#00b4d8" fill="none" strokeWidth={3} strokeDasharray="8 6" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );

      case 'breakdown':
        if (breakdown.length === 0) return null;
        return (
          <div key="breakdown" className="chart-card">
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
  };

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title">Dashboard</h1>
        </div>
        <div className="header-right">
          <AccountFilter />
          <button className="btn-icon" title="ตั้งค่าแดชบอร์ด" onClick={() => { setEditLayout([...layout]); setShowLayoutModal(true); }}>
            <Settings2 size={18} />
          </button>
        </div>
      </div>

      <div className="content-area">
        {!loading && layout.map(type => renderWidget(type))}
      </div>

      {showLayoutModal && (
        <div className="modal-overlay" onClick={() => setShowLayoutModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 400 }}>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Edit3 size={18} style={{ color: 'var(--accent-secondary)' }} /> ปรับแต่งแดชบอร์ด
            </h2>
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 16 }}>
                คุณสามารถเปิด/ปิดส่วนต่างๆ และเรียงลำดับใหม่ได้
              </p>
              
              {/* Note: This is a simplified configurator */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['summary', 'targets', 'chart', 'breakdown'].map((widgetType) => {
                  const isActive = editLayout.includes(widgetType);
                  const names = {
                    summary: 'การ์ดสรุปข้อมูล (Summary)',
                    targets: 'เป้าหมายรายวัน (Daily Targets)',
                    chart: 'กราฟกำไร/ขาดทุน (PnL Chart)',
                    breakdown: 'ตารางสรุปแยกบัญชี (Account Breakdown)'
                  };
                  return (
                    <div key={widgetType} style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${isActive ? 'var(--accent-primary)' : 'transparent'}`
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>{names[widgetType]}</div>
                      </div>
                      <button 
                        className={`btn btn-sm ${isActive ? 'btn-ghost' : 'btn-primary'}`}
                        onClick={() => {
                          if (isActive) setEditLayout(editLayout.filter(l => l !== widgetType));
                          else setEditLayout([...editLayout, widgetType]);
                        }}
                      >
                        {isActive ? 'ซ่อน' : 'แสดง'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditLayout(['targets', 'summary', 'chart', 'breakdown'])}>คืนค่าเริ่มต้น</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowLayoutModal(false)}>ยกเลิก</button>
                <button type="button" className="btn btn-primary" onClick={saveLayout}>บันทึกเค้าโครง</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
