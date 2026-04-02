import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useAccounts } from '../../context/AccountContext';
import AccountFilter from '../Dashboard/AccountFilter';
import { Flame, TrendingUp, TrendingDown, BarChart3, Activity, AlertTriangle, Clock } from 'lucide-react';

export default function HeatmapPage({ embedded = false }) {
  const { getFilterParams } = useAccounts();
  const [data, setData] = useState({ symbols: [], accounts: [], hourly: [] });
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = { ...getFilterParams(), days };
        const result = await api.getHeatmapData(params);
        setData(result);
      } catch (err) {
        console.error('Heatmap error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [getFilterParams, days]);

  const formatCurrency = (val) => {
    if (val === undefined || val === null || val === '') return '$0.00';
    const num = parseFloat(val || 0);
    if (isNaN(num)) return '$0.00';
    if (num === 0) return '$0.00';
    const prefix = num > 0 ? '+' : '-';
    return `${prefix}$${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Color scale based on PnL
  const getPnlColor = (pnl, intensity = 1) => {
    if (pnl > 0) return `rgba(0, 230, 138, ${Math.min(0.15 + intensity * 0.6, 0.8)})`;
    if (pnl < 0) return `rgba(255, 71, 87, ${Math.min(0.15 + intensity * 0.6, 0.8)})`;
    return 'var(--bg-tertiary)';
  };

  // Size scale (bigger = more lots)
  const getBlockSize = (lots, maxLots) => {
    if (maxLots === 0) return 1;
    return Math.max(1, Math.min(3, Math.ceil((lots / maxLots) * 3)));
  };

  const symbols = data?.symbols || [];
  const hourly = data?.hourly || [];
  const accounts = data?.accounts || [];

  const maxLots = symbols.length > 0 ? Math.max(...symbols.map(s => s.total_lots), 1) : 1;
  const maxPnl = symbols.length > 0 ? Math.max(...symbols.map(s => Math.abs(s.total_pnl)), 1) : 1;
  const maxHourlyTrades = hourly.length > 0 ? Math.max(...hourly.map(h => h.trade_count), 1) : 1;

  return (
    <div style={embedded ? { padding: 0 } : {}}>
      {!embedded ? (
        <div className="header">
          <div className="header-left">
            <h1 className="page-title"><Flame size={22} style={{ color: 'var(--accent-primary)', marginRight: 8, verticalAlign: 'middle' }} />Exposure Heatmap</h1>
          </div>
          <div className="header-right">
            <AccountFilter />
            <div className="filter-group" style={{ display: 'flex', border: '1px solid var(--border-secondary)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              {[7, 14, 30, 60].map(d => (
                <button
                  key={d}
                  className={`filter-btn ${days === d ? 'active' : ''}`}
                  onClick={() => setDays(d)}
                  style={{ border: 'none', borderRadius: 0, padding: '4px 12px' }}
                >{d}D</button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-md)' }}>
          <div className="header-right">
            <AccountFilter />
            <div className="filter-group" style={{ display: 'flex', border: '1px solid var(--border-secondary)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              {[7, 14, 30, 60].map(d => (
                <button
                  key={d}
                  className={`filter-btn ${days === d ? 'active' : ''}`}
                  onClick={() => setDays(d)}
                  style={{ border: 'none', borderRadius: 0, padding: '4px 12px' }}
                >{d}D</button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="content-area">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>กำลังโหลดข้อมูล Heatmap...</div>
        ) : (
          <>
            {/* =============================================
                SYMBOL HEATMAP GRID
                ============================================= */}
            <div className="chart-card" style={{ marginBottom: 'var(--space-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                <h3 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChart3 size={18} style={{ color: 'var(--accent-secondary)' }} />
                  Symbol Exposure Map
                </h3>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(0, 230, 138, 0.5)' }}></span> กำไร
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(255, 71, 87, 0.5)' }}></span> ขาดทุน
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ display: 'inline-block', border: '2px solid var(--warning)', width: 12, height: 12, borderRadius: 3 }}></span> ไม้เปิด
                  </span>
                </div>
              </div>

              {symbols.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-tertiary)' }}>ไม่มีข้อมูลเทรดในช่วงเวลานี้</div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 'var(--space-sm)',
                }}>
                  {symbols.map(sym => {
                    const intensity = Math.abs(sym.total_pnl) / maxPnl;
                    const sizeClass = getBlockSize(sym.total_lots, maxLots);
                    const hasOpen = sym.open_lots > 0;

                    return (
                      <div
                        key={sym.symbol}
                        style={{
                          background: getPnlColor(sym.total_pnl, intensity),
                          border: hasOpen ? '2px solid var(--warning)' : '1px solid var(--border-primary)',
                          borderRadius: 'var(--radius-md)',
                          padding: sizeClass >= 2 ? 'var(--space-md)' : 'var(--space-sm)',
                          gridColumn: sizeClass >= 3 ? 'span 2' : 'span 1',
                          transition: 'all 0.3s ease',
                          cursor: 'default',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                        title={`${sym.symbol}: ${sym.trade_count} trades, PnL: ${formatCurrency(sym.total_pnl)}, Win Rate: ${sym.win_rate}%`}
                      >
                        {/* Symbol name */}
                        <div style={{ fontSize: sizeClass >= 2 ? 16 : 13, fontWeight: 700, fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                          {sym.symbol}
                        </div>
                        
                        {/* PnL */}
                        <div style={{
                          fontSize: sizeClass >= 2 ? 18 : 14,
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          color: sym.total_pnl >= 0 ? 'var(--profit)' : 'var(--loss)',
                          marginBottom: 4,
                        }}>
                          {formatCurrency(sym.total_pnl)}
                        </div>

                        {/* Stats row */}
                        <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                          <span>{sym.trade_count} trades</span>
                          <span>{sym.total_lots.toFixed(2)} lots</span>
                          <span>WR: {sym.win_rate}%</span>
                        </div>

                        {/* Buy/Sell bar */}
                        <div style={{ display: 'flex', gap: 2, marginTop: 6, height: 4, borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{
                            width: `${(sym.buy_count / sym.trade_count) * 100}%`,
                            background: 'var(--profit)',
                            borderRadius: '2px 0 0 2px',
                          }} />
                          <div style={{
                            width: `${(sym.sell_count / sym.trade_count) * 100}%`,
                            background: 'var(--loss)',
                            borderRadius: '0 2px 2px 0',
                          }} />
                        </div>

                        {/* Open lots badge */}
                        {hasOpen && (
                          <div style={{
                            position: 'absolute', top: 6, right: 6,
                            background: 'var(--warning)', color: '#000',
                            borderRadius: 'var(--radius-full)', padding: '1px 8px',
                            fontSize: 10, fontWeight: 700,
                          }}>
                            {sym.open_lots.toFixed(2)} open
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* =============================================
                HOURLY ACTIVITY HEATMAP
                ============================================= */}
            <div className="chart-card" style={{ marginBottom: 'var(--space-lg)' }}>
              <h3 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-lg)' }}>
                <Clock size={18} style={{ color: 'var(--accent-tertiary)' }} />
                Hourly Trading Activity
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(24, 1fr)',
                gap: 3,
              }}>
                {hourly.map(h => {
                  const intensity = h.trade_count / maxHourlyTrades;
                  return (
                    <div
                      key={h.hour}
                      style={{
                        background: h.trade_count > 0 ? getPnlColor(h.pnl, intensity) : 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 2px',
                        textAlign: 'center',
                        border: '1px solid var(--border-primary)',
                        transition: 'all 0.2s ease',
                      }}
                      title={`${h.hour}:00 — ${h.trade_count} trades, PnL: ${formatCurrency(h.pnl)}`}
                    >
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>{h.hour}:00</div>
                      <div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{h.trade_count}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* =============================================
                ACCOUNT EXPOSURE TABLE
                ============================================= */}
            <div className="chart-card">
              <h3 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-lg)' }}>
                <Activity size={18} style={{ color: 'var(--accent-primary)' }} />
                Account Exposure Summary
              </h3>
              <div className="data-table-wrapper" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Broker</th>
                      <th>บัญชี</th>
                      <th>ไม้เปิด</th>
                      <th>Exposure (lots)</th>
                      <th>Floating PnL</th>
                      <th>ความเสี่ยง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map(acc => {
                      const riskLevel = acc.total_exposure > 10 ? 'high' : acc.total_exposure > 5 ? 'medium' : 'low';
                      const riskColors = { high: 'var(--loss)', medium: 'var(--warning)', low: 'var(--profit)' };
                      const riskLabels = { high: 'สูง', medium: 'ปานกลาง', low: 'ต่ำ' };
                      return (
                        <tr key={acc.id}>
                          <td style={{ fontWeight: 500 }}>{acc.broker_name}</td>
                          <td>{acc.account_name}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{acc.open_trades}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{acc.total_exposure.toFixed(2)}</td>
                          <td className={acc.floating_pnl >= 0 ? 'pnl-positive' : 'pnl-negative'} style={{ fontFamily: 'var(--font-mono)' }}>
                            {formatCurrency(acc.floating_pnl)}
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '2px 10px', borderRadius: 'var(--radius-full)',
                              background: riskLevel === 'high' ? 'var(--loss-bg)' : riskLevel === 'medium' ? 'var(--warning-bg)' : 'var(--profit-bg)',
                              color: riskColors[riskLevel], fontSize: 12, fontWeight: 600,
                            }}>
                              {riskLevel === 'high' && <AlertTriangle size={12} />}
                              {riskLabels[riskLevel]}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {accounts.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>ไม่มีบัญชีที่ใช้งาน</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
