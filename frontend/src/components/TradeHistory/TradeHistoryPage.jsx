import { useState, useEffect } from 'react';
import { useAccounts } from '../../context/AccountContext';
import { api } from '../../utils/api';
import AccountFilter from '../Dashboard/AccountFilter';
import {
  Search, Download, ArrowUpDown, Filter, RefreshCw,
  TrendingUp, TrendingDown, BarChart3, Award, Bot, Hand
} from 'lucide-react';

export default function TradeHistoryPage() {
  const { getFilterParams, viewMode, selectedBrokerId, selectedAccountId } = useAccounts();
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState(null);
  const [symbols, setSymbols] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Function to get "today" string YYYY-MM-DD
  const getTodayStr = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  };

  // Filters
  const [symbolFilter, setSymbolFilter] = useState('');
  const [sideFilter, setSideFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  
  // Date Filters
  const [dateMode, setDateMode] = useState('day'); // 'day', 'week', 'month'
  const [dateFrom, setDateFrom] = useState(getTodayStr());
  const [dateTo, setDateTo] = useState(getTodayStr());

  const [dateWeek, setDateWeek] = useState(''); // e.g., '2023-W01'
  const [dateMonth, setDateMonth] = useState(''); // e.g., '2023-01'
  const [dateYear, setDateYear] = useState(''); // e.g., '2023'

  const [sortBy, setSortBy] = useState('closed_at');
  const [sortDir, setSortDir] = useState('DESC');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {
        ...getFilterParams(),
        page, limit: 50,
        sort_by: sortBy, sort_dir: sortDir,
        ...(symbolFilter && { symbol: symbolFilter }),
        ...(sideFilter && { side: sideFilter }),
        ...(sourceFilter && { source: sourceFilter }),
        ...(dateFrom && { from: dateFrom }),
        ...(dateTo && { to: dateTo }),
      };

      const [tradeData, statsData, symbolsData] = await Promise.all([
        api.getTrades(params),
        api.getTradeStats({
          ...getFilterParams(),
          ...(dateFrom && { from: dateFrom }),
          ...(dateTo && { to: dateTo }),
        }),
        api.getSymbols(),
      ]);

      setTrades(tradeData.trades);
      setTotal(tradeData.total);
      setPages(tradeData.pages);
      setStats(statsData);
      setSymbols(symbolsData);
    } catch (err) {
      console.error('Trade history error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [viewMode, selectedBrokerId, selectedAccountId, page, sortBy, sortDir, symbolFilter, sideFilter, sourceFilter, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle date mode shifts
  useEffect(() => {
    if (dateMode === 'day') {
      const today = getTodayStr();
      setDateFrom(today);
      setDateTo(today);
    } else if (dateMode === 'week') {
      // Sets the week based on current date
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
      const week1 = new Date(d.getFullYear(), 0, 4);
      const w = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
      const weekStr = `${d.getFullYear()}-W${w.toString().padStart(2, '0')}`;
      setDateWeek(weekStr);
      handleWeekChange(weekStr);
    } else if (dateMode === 'month') {
      // Sets the month based on current date
      const d = new Date();
      const monthStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      setDateMonth(monthStr);
      handleMonthChange(monthStr);
    } else if (dateMode === 'year') {
      const yStr = new Date().getFullYear().toString();
      setDateYear(yStr);
      handleYearChange(yStr);
    }
  }, [dateMode]);

  const handleWeekChange = (val) => {
    setDateWeek(val);
    if (!val) {
       setDateFrom(''); setDateTo(''); return;
    }
    const [year, week] = val.split('-W');
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    
    // Shift back 1 day so week starts on Sunday instead of Monday
    const targetWeekStart = new Date(ISOweekStart);
    targetWeekStart.setDate(ISOweekStart.getDate() - 1);
    
    const targetWeekEnd = new Date(targetWeekStart);
    targetWeekEnd.setDate(targetWeekStart.getDate() + 6);
    
    setDateFrom(targetWeekStart.toISOString().split('T')[0]);
    setDateTo(targetWeekEnd.toISOString().split('T')[0]);
    setPage(1);
  };

  const handleMonthChange = (val) => {
    setDateMonth(val);
    if (!val) {
       setDateFrom(''); setDateTo(''); return;
    }
    const [year, month] = val.split('-');
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    
    setDateFrom(firstDay.toISOString().split('T')[0]);
    setDateTo(lastDay.toISOString().split('T')[0]);
    setPage(1);
  };

  const handleYearChange = (val) => {
    setDateYear(val);
    if (!val) {
      setDateFrom(''); setDateTo(''); return;
    }
    setDateFrom(`${val}-01-01`);
    setDateTo(`${val}-12-31`);
    setPage(1);
  };

  const handleSyncBroker = async () => {
    if (viewMode !== 'account' || !selectedAccountId) {
      alert('กรุณาเลือก "บัญชี" (Account) ที่ต้องการอัพเดตข้อมูลจากการตั้งค่าด้านบนก่อน');
      return;
    }
    const confirmed = await window.customConfirm('ระบบจะดึงข้อมูลประวัติการเทรดล่าสุดจาก Broker\nต้องการดำเนินการต่อหรือไม่?');
    if (!confirmed) return;
    
    setSyncing(true);
    try {
      await api.syncTrades(selectedAccountId);
      alert('อัพเดตข้อมูลสำเร็จ!');
      fetchData();
    } catch (err) {
      alert(`การอัพเดตล้มเหลว: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir(d => d === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(col);
      setSortDir('DESC');
    }
    setPage(1);
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val);
    const prefix = num >= 0 ? '+' : '';
    return `${prefix}$${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title">ประวัติการเทรด</h1>
        </div>
        <div className="header-right">
          <button 
            className="btn btn-primary" 
            onClick={handleSyncBroker} 
            disabled={syncing || loading}
            style={{ marginRight: 'var(--space-md)' }}
          >
            {syncing ? <RefreshCw className="spin" size={16} /> : <Download size={16} />}
            อัพเดตข้อมูลกับโบรกเกอร์
          </button>
          <AccountFilter />
        </div>
      </div>

      <div className="content-area">
        {/* Stats Cards */}
        {stats && (
          <div className="stat-grid">
            <div className="card">
              <div className="card-header">
                <span className="card-title">กำไรรวม</span>
                <BarChart3 size={16} style={{ color: 'var(--accent-primary)' }} />
              </div>
              <div className={`card-value ${stats.total_pnl >= 0 ? 'profit' : 'loss'}`}>
                {formatCurrency(stats.total_pnl)}
              </div>
              <div className="card-sub">{stats.total_trades} เทรด | Volume: {stats.total_volume?.toFixed(2)} lots</div>
            </div>
            <div className="card">
              <div className="card-header">
                <span className="card-title">Win Rate</span>
                <Award size={16} style={{ color: 'var(--accent-tertiary)' }} />
              </div>
              <div className="card-value">{stats.win_rate}%</div>
              <div className="card-sub">Win: {stats.winning_trades} | Loss: {stats.losing_trades}</div>
            </div>
            <div className="card">
              <div className="card-header">
                <span className="card-title">เทรดที่ดีที่สุด</span>
                <TrendingUp size={16} style={{ color: 'var(--profit)' }} />
              </div>
              <div className="card-value profit">{formatCurrency(stats.best_trade)}</div>
              <div className="card-sub">เฉลี่ย Win: {formatCurrency(stats.avg_win)}</div>
            </div>
            <div className="card">
              <div className="card-header">
                <span className="card-title">เทรดที่แย่ที่สุด</span>
                <TrendingDown size={16} style={{ color: 'var(--loss)' }} />
              </div>
              <div className="card-value loss">{formatCurrency(stats.worst_trade)}</div>
              <div className="card-sub">เฉลี่ย Loss: {formatCurrency(stats.avg_loss)}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{
          display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)',
          flexWrap: 'wrap', alignItems: 'center'
        }}>
          <Filter size={14} style={{ color: 'var(--text-tertiary)' }} />

          <select className="filter-select" value={symbolFilter} onChange={e => { setSymbolFilter(e.target.value); setPage(1); }}>
            <option value="">ทุก Symbol</option>
            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select className="filter-select" value={sideFilter} onChange={e => { setSideFilter(e.target.value); setPage(1); }}>
            <option value="">Buy & Sell</option>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>

          <select className="filter-select" value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(1); }}>
            <option value="">เทรดทั้งหมด</option>
            <option value="bot">🤖 เทรดออโต้</option>
            <option value="manual">✋ เทรดมือ</option>
          </select>

          <select className="filter-select" value={dateMode} onChange={e => { setDateMode(e.target.value); setPage(1); }}>
            <option value="day">📅 รูปแบบ: วัน</option>
            <option value="week">📅 รูปแบบ: สัปดาห์</option>
            <option value="month">📅 รูปแบบ: เดือน</option>
            <option value="year">📅 รูปแบบ: ปี</option>
          </select>

          {dateMode === 'day' && (
            <>
              <input type="date" className="filter-select" style={{ padding: '6px 10px', fontSize: 12 }}
                value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>ถึง</span>
              <input type="date" className="filter-select" style={{ padding: '6px 10px', fontSize: 12 }}
                value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
            </>
          )}

          {dateMode === 'week' && (
            <input type="week" className="filter-select" style={{ padding: '6px 10px', fontSize: 12 }}
              value={dateWeek} onChange={e => handleWeekChange(e.target.value)} />
          )}

          {dateMode === 'month' && (
            <input type="month" className="filter-select" style={{ padding: '6px 10px', fontSize: 12 }}
              value={dateMonth} onChange={e => handleMonthChange(e.target.value)} />
          )}

          {dateMode === 'year' && (
            <select className="filter-select" style={{ padding: '6px 10px', fontSize: 12 }}
              value={dateYear} onChange={e => handleYearChange(e.target.value)}>
              {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}

          {(symbolFilter || sideFilter || sourceFilter || dateFrom || dateTo) && (
            <button className="btn btn-ghost btn-sm" onClick={() => {
              setSymbolFilter('');
              setSideFilter('');
              setSourceFilter('');
              setDateFrom('');
              setDateTo('');
              setPage(1);
            }}>
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {/* Trade Table */}
        <div className="data-table-wrapper">
          <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 420px)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('closed_at')}>เวลาปิด {sortBy === 'closed_at' && (sortDir === 'ASC' ? '↑' : '↓')}</th>
                  <th>Broker</th>
                  <th>บัญชี</th>
                  <th onClick={() => handleSort('symbol')}>Symbol {sortBy === 'symbol' && (sortDir === 'ASC' ? '↑' : '↓')}</th>
                  <th>Side</th>
                  <th>เทรด</th>
                  <th onClick={() => handleSort('lot_size')}>Lot {sortBy === 'lot_size' && (sortDir === 'ASC' ? '↑' : '↓')}</th>
                  <th>ราคาเปิด</th>
                  <th>ราคาปิด</th>
                  <th onClick={() => handleSort('pnl')}>PnL {sortBy === 'pnl' && (sortDir === 'ASC' ? '↑' : '↓')}</th>
                  <th>Commission</th>
                  <th>Swap</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(trade => (
                  <tr key={trade.id}>
                    <td>
                      {trade.closed_at ?
                        new Date(trade.closed_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : '-'
                      }
                    </td>
                    <td style={{ fontFamily: 'var(--font-sans)', fontSize: 11 }}>{trade.broker_name}</td>
                    <td style={{ fontFamily: 'var(--font-sans)', fontSize: 11 }}>{trade.account_name}</td>
                    <td style={{ fontWeight: 600 }}>{trade.symbol}</td>
                    <td>
                      <span className={`badge ${trade.side === 'BUY' ? 'badge-buy' : 'badge-sell'}`}>
                        {trade.side}
                      </span>
                    </td>
                    <td>
                      {trade.bot_id ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent-primary)', fontSize: 11 }}>
                          <Bot size={13} /> Bot
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)', fontSize: 11 }}>
                          <Hand size={13} /> Manual
                        </span>
                      )}
                    </td>
                    <td>{parseFloat(trade.lot_size).toFixed(2)}</td>
                    <td>{parseFloat(trade.entry_price).toFixed(trade.symbol?.includes('JPY') ? 3 : 5)}</td>
                    <td>{trade.exit_price ? parseFloat(trade.exit_price).toFixed(trade.symbol?.includes('JPY') ? 3 : 5) : '-'}</td>
                    <td className={parseFloat(trade.pnl) >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                      {formatCurrency(trade.pnl)}
                    </td>
                    <td style={{ color: 'var(--text-tertiary)' }}>{parseFloat(trade.commission).toFixed(2)}</td>
                    <td style={{ color: 'var(--text-tertiary)' }}>{parseFloat(trade.swap).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination">
            <span className="pagination-info">
              แสดง {((page - 1) * 50) + 1}-{Math.min(page * 50, total)} จาก {total} รายการ
            </span>
            <div className="pagination-buttons">
              <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>ก่อนหน้า</button>
              {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                const p = Math.max(1, page - 2) + i;
                if (p > pages) return null;
                return (
                  <button key={p} className={`pagination-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>
                    {p}
                  </button>
                );
              })}
              <button className="pagination-btn" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>ถัดไป</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
