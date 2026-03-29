import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import {
  BarChart3, PieChart, Clock, Calendar, Download, FileText,
  TrendingUp, TrendingDown, Target, Award, AlertTriangle, Brain
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart as RPieChart, Pie, Cell, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

const COLORS = ['#00c896', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#6366f1'];
const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [period, setPeriod] = useState('30');
  const [analytics, setAnalytics] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [exports, setExports] = useState([]);
  const [psychologyData, setPsychologyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'analytics') {
        const data = await api.getAnalytics({ period });
        setAnalytics(data);
      } else if (activeTab === 'weekly') {
        const data = await api.getWeeklyReport({ weeks: 12 });
        setWeeklyData(data);
      } else if (activeTab === 'monthly') {
        const data = await api.getMonthlyReport({ months: 12 });
        setMonthlyData(data);
      } else if (activeTab === 'export') {
        const data = await api.getExportHistory();
        setExports(data);
      } else if (activeTab === 'psychology') {
        const data = await api.getPsychologyReport({ days: period });
        setPsychologyData(data);
      }
    } catch (err) {
      console.error('Reports fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeTab, period]);

  const handleExport = async (reportType) => {
    setExporting(true);
    try {
      const result = await api.exportReport({ report_type: reportType, format: 'CSV' });
      if (result.file_url) {
        const link = document.createElement('a');
        link.href = result.file_url;
        link.download = `${reportType.toLowerCase()}_report.csv`;
        link.click();
      }
      if (activeTab === 'export') fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (val) => {
    if (!val && val !== 0) return '$0.00';
    const num = parseFloat(val);
    return `${num >= 0 ? '+' : ''}$${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const tabs = [
    { id: 'analytics', label: 'วิเคราะห์การเทรด', icon: BarChart3 },
    { id: 'psychology', label: 'จิตวิทยาการเทรด', icon: Brain },
    { id: 'weekly', label: 'สรุปรายสัปดาห์', icon: Calendar },
    { id: 'monthly', label: 'สรุปรายเดือน', icon: Calendar },
    { id: 'export', label: 'ส่งออกรายงาน', icon: Download },
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: 12, fontSize: 12 }}>
        <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color || 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {p.name}: {typeof p.value === 'number' ? formatCurrency(p.value) : p.value}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title">รายงานและวิเคราะห์</h1>
        </div>
        <div className="header-right" style={{ gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => handleExport('TRADES')} disabled={exporting}>
            <Download size={14} /> {exporting ? 'กำลังส่งออก...' : 'Export เทรด'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('DAILY')} disabled={exporting}>
            <FileText size={14} /> Export ข้อมูลรายวัน
          </button>
        </div>
      </div>

      <div className="content-area">
        {/* Tab navigation */}
        <div className="chart-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', background: 'rgba(0,0,0,0.1)' }}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
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
            {/* Analytics Tab */}
            {activeTab === 'analytics' && analytics && (
              <div>
                {/* Period Selector */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                  {['7', '14', '30', '60', '90'].map(p => (
                    <button key={p} className={`filter-btn ${period === p ? 'active' : ''}`}
                      onClick={() => setPeriod(p)}
                      style={{ padding: '6px 16px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border-primary)' }}>
                      {p} วัน
                    </button>
                  ))}
                </div>

                {/* Risk Metrics */}
                <div className="stat-grid" style={{ marginBottom: 24 }}>
                  <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="card-header">
                      <span className="card-title">Win Rate</span>
                      <Award size={16} style={{ color: 'var(--accent-primary)' }} />
                    </div>
                    <div className="card-value">{analytics.risk_metrics?.win_rate || 0}%</div>
                  </div>
                  <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="card-header">
                      <span className="card-title">Risk : Reward</span>
                      <Target size={16} style={{ color: 'var(--accent-secondary)' }} />
                    </div>
                    <div className="card-value">1:{analytics.risk_metrics?.risk_reward_ratio || '0'}</div>
                  </div>
                  <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="card-header">
                      <span className="card-title">เทรดดีที่สุด</span>
                      <TrendingUp size={16} style={{ color: 'var(--profit)' }} />
                    </div>
                    <div className="card-value profit" style={{ fontSize: 20 }}>{formatCurrency(analytics.risk_metrics?.best_trade)}</div>
                  </div>
                  <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="card-header">
                      <span className="card-title">เทรดแย่ที่สุด</span>
                      <TrendingDown size={16} style={{ color: 'var(--loss)' }} />
                    </div>
                    <div className="card-value loss" style={{ fontSize: 20 }}>{formatCurrency(analytics.risk_metrics?.worst_trade)}</div>
                  </div>
                </div>

                {/* Symbol Performance */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)', marginBottom: 24 }}>
                  <div className="card" style={{ background: 'var(--bg-tertiary)', padding: 'var(--space-lg)' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>กำไรแยกตามสินทรัพย์</h4>
                    {analytics.symbol_performance?.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={analytics.symbol_performance.slice(0, 8)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                          <XAxis dataKey="symbol" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
                          <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="total_pnl" name="PnL" radius={[4, 4, 0, 0]}>
                            {analytics.symbol_performance.slice(0, 8).map((entry, i) => (
                              <Cell key={i} fill={parseFloat(entry.total_pnl) >= 0 ? '#00c896' : '#ff4757'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>ไม่มีข้อมูล</p>}
                  </div>

                  <div className="card" style={{ background: 'var(--bg-tertiary)', padding: 'var(--space-lg)' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>สัดส่วนการเทรดแยกตามสินทรัพย์</h4>
                    {analytics.symbol_performance?.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <RPieChart>
                          <Pie data={analytics.symbol_performance.slice(0, 6)} cx="50%" cy="50%" outerRadius={80} dataKey="total_trades" nameKey="symbol" label={({ symbol, percent }) => `${symbol} ${(percent * 100).toFixed(0)}%`}>
                            {analytics.symbol_performance.slice(0, 6).map((_, i) => (
                              <Cell key={i} fill={COLORS[i]} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </RPieChart>
                      </ResponsiveContainer>
                    ) : <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>ไม่มีข้อมูล</p>}
                  </div>
                </div>

                {/* Hourly & Day of Week */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
                  <div className="card" style={{ background: 'var(--bg-tertiary)', padding: 'var(--space-lg)' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                      <Clock size={14} style={{ marginRight: 6 }} />ผลการเทรดตามชั่วโมง
                    </h4>
                    {analytics.hourly_distribution?.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={analytics.hourly_distribution}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                          <XAxis dataKey="hour" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} tickFormatter={v => `${v}:00`} />
                          <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="total_pnl" name="PnL" radius={[2, 2, 0, 0]}>
                            {analytics.hourly_distribution.map((entry, i) => (
                              <Cell key={i} fill={parseFloat(entry.total_pnl) >= 0 ? '#00c896' : '#ff4757'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>ไม่มีข้อมูล</p>}
                  </div>

                  <div className="card" style={{ background: 'var(--bg-tertiary)', padding: 'var(--space-lg)' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                      <Calendar size={14} style={{ marginRight: 6 }} />ผลการเทรดตามวัน
                    </h4>
                    {analytics.day_of_week?.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={analytics.day_of_week.map(d => ({ ...d, day: DAY_NAMES[d.day_num] }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                          <XAxis dataKey="day" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
                          <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="total_pnl" name="PnL" radius={[2, 2, 0, 0]}>
                            {analytics.day_of_week.map((entry, i) => (
                              <Cell key={i} fill={parseFloat(entry.total_pnl) >= 0 ? '#00c896' : '#ff4757'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>ไม่มีข้อมูล</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Weekly Tab */}
            {activeTab === 'weekly' && (
              <div className="data-table-wrapper" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead><tr><th>ปี</th><th>สัปดาห์</th><th>บัญชี</th><th>PnL</th><th>เทรด</th><th>Win Rate</th><th>Volume</th></tr></thead>
                  <tbody>
                    {weeklyData.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>ไม่มีข้อมูล</td></tr>
                    ) : weeklyData.map((w, i) => (
                      <tr key={i}>
                        <td>{w.year}</td>
                        <td>W{w.week_number}</td>
                        <td style={{ fontFamily: 'var(--font-sans)' }}>{w.account_name}</td>
                        <td className={parseFloat(w.total_pnl) >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatCurrency(w.total_pnl)}</td>
                        <td>{w.total_trades}</td>
                        <td>{parseFloat(w.win_rate).toFixed(1)}%</td>
                        <td>{parseFloat(w.total_volume).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Monthly Tab */}
            {activeTab === 'monthly' && (
              <div className="data-table-wrapper" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead><tr><th>ปี</th><th>เดือน</th><th>บัญชี</th><th>PnL</th><th>ค่าธรรมเนียม</th><th>เทรด</th><th>Win Rate</th><th>Volume</th></tr></thead>
                  <tbody>
                    {monthlyData.length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>ไม่มีข้อมูล</td></tr>
                    ) : monthlyData.map((m, i) => (
                      <tr key={i}>
                        <td>{m.year}</td>
                        <td>{m.month}</td>
                        <td style={{ fontFamily: 'var(--font-sans)' }}>{m.account_name}</td>
                        <td className={parseFloat(m.total_pnl) >= 0 ? 'pnl-positive' : 'pnl-negative'}>{formatCurrency(m.total_pnl)}</td>
                        <td>{formatCurrency(m.total_fees)}</td>
                        <td>{m.total_trades}</td>
                        <td>{parseFloat(m.win_rate).toFixed(1)}%</td>
                        <td>{parseFloat(m.total_volume).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Export Tab */}
            {activeTab === 'export' && (
              <div>
                <div style={{ marginBottom: 24, display: 'flex', gap: 16 }}>
                  <div className="card" style={{ flex: 1, cursor: 'pointer', background: 'var(--bg-tertiary)' }} onClick={() => handleExport('TRADES')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'rgba(0,200,150,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Download size={18} style={{ color: 'var(--accent-primary)' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>ส่งออกประวัติเทรด</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>ดาวน์โหลดเป็น CSV</div>
                      </div>
                    </div>
                  </div>
                  <div className="card" style={{ flex: 1, cursor: 'pointer', background: 'var(--bg-tertiary)' }} onClick={() => handleExport('DAILY')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'rgba(14,165,233,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={18} style={{ color: 'var(--accent-secondary)' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>ส่งออกสรุปรายวัน</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>ดาวน์โหลดเป็น CSV</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Export History */}
                <h4 style={{ fontSize: 14, marginBottom: 12 }}>ประวัติการส่งออก</h4>
                <div className="data-table-wrapper" style={{ border: 'none' }}>
                  <table className="data-table">
                    <thead><tr><th>วันที่</th><th>ประเภท</th><th>รูปแบบ</th><th>สถานะ</th><th></th></tr></thead>
                    <tbody>
                      {exports.length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>ยังไม่มีประวัติ</td></tr>
                      ) : exports.map(ex => (
                        <tr key={ex.id}>
                          <td style={{ fontFamily: 'var(--font-sans)' }}>{new Date(ex.created_at).toLocaleDateString('th-TH')}</td>
                          <td><span className="badge badge-open">{ex.report_type}</span></td>
                          <td>{ex.format}</td>
                          <td><span className={`badge ${ex.status === 'COMPLETED' ? 'badge-buy' : 'badge-open'}`}>{ex.status}</span></td>
                          <td>
                            {ex.file_url && (
                              <a href={ex.file_url} download className="btn btn-ghost btn-sm"><Download size={12} /></a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Psychology Tab */}
            {activeTab === 'psychology' && psychologyData && (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                  {['7', '14', '30', '60', '90'].map(p => (
                    <button key={p} className={`filter-btn ${period === p ? 'active' : ''}`}
                      onClick={() => setPeriod(p)}
                      style={{ padding: '6px 16px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border-primary)' }}>
                      {p} วัน
                    </button>
                  ))}
                </div>

                <div className="stat-grid" style={{ marginBottom: 24, gridTemplateColumns: '1fr 3fr' }}>
                  <div className="card" style={{ background: 'var(--bg-tertiary)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 8 }}>คะแนนวินัยการเทรด</div>
                    <div style={{ 
                      fontSize: 48, fontWeight: 700, 
                      color: psychologyData.overall_score >= 80 ? 'var(--profit)' : psychologyData.overall_score >= 50 ? 'var(--warning)' : 'var(--loss)' 
                    }}>
                      {psychologyData.overall_score}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>/ 100</div>
                  </div>

                  <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>คำแนะนำการปรับปรุงพฤติกรรม</h4>
                    <ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 14, lineHeight: '1.8' }}>
                      {psychologyData.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>พฤติกรรมที่ตรวจพบ</h4>
                <div style={{ display: 'grid', gap: 12 }}>
                  {psychologyData.patterns.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 32, background: 'var(--bg-tertiary)', borderRadius: 8, color: 'var(--text-tertiary)' }}>
                      ไม่มีข้อมูลพฤติกรรมในช่วงเวลานี้
                    </div>
                  ) : psychologyData.patterns.map((pattern, i) => {
                    let badgeColor = 'var(--text-tertiary)';
                    let bgColor = 'var(--bg-secondary)';
                    
                    if (pattern.severity === 'critical') { badgeColor = 'var(--loss)'; bgColor = 'rgba(255, 71, 87, 0.1)'; }
                    else if (pattern.severity === 'high') { badgeColor = 'var(--loss)'; bgColor = 'rgba(255, 71, 87, 0.05)'; }
                    else if (pattern.severity === 'medium') { badgeColor = 'var(--warning)'; bgColor = 'rgba(245, 158, 11, 0.1)'; }
                    else if (pattern.severity === 'positive') { badgeColor = 'var(--profit)'; bgColor = 'rgba(0, 200, 150, 0.1)'; }

                    return (
                      <div key={i} style={{ 
                        background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8,
                        borderLeft: `4px solid ${badgeColor}`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{pattern.name}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{pattern.description}</div>
                          </div>
                          <div style={{ 
                            background: bgColor, color: badgeColor, 
                            padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600 
                          }}>
                            {pattern.severity.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
