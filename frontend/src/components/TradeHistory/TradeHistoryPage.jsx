import { useState, useEffect } from 'react';
import { useAccounts } from '../../context/AccountContext';
import { api } from '../../utils/api';
import AccountFilter from '../Dashboard/AccountFilter';
import {
  Search, Download, ArrowUpDown, Filter,
  TrendingUp, TrendingDown, BarChart3, Award
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

  // Filters
  const [symbolFilter, setSymbolFilter] = useState('');
  const [sideFilter, setSideFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
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

  useEffect(() => { fetchData(); }, [viewMode, selectedBrokerId, selectedAccountId, page, sortBy, sortDir, symbolFilter, sideFilter, dateFrom, dateTo]);

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

          <input type="date" className="form-input" style={{ padding: '6px 10px', fontSize: 12 }}
            value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
          <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>ถึง</span>
          <input type="date" className="form-input" style={{ padding: '6px 10px', fontSize: 12 }}
            value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />

          {(symbolFilter || sideFilter || dateFrom || dateTo) && (
            <button className="btn btn-ghost btn-sm" onClick={() => {
              setSymbolFilter('');
              setSideFilter('');
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
