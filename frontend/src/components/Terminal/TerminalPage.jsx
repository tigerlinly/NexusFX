import { useState, useEffect, useRef } from 'react';
import { api } from '../../utils/api';
import { io } from 'socket.io-client';
import { Send, TrendingUp, TrendingDown, Crosshair, Target, ShieldAlert, Activity, RefreshCw } from 'lucide-react';

const BROKER_SYMBOLS = {
  exness: ['XAUUSDm', 'EURUSDm', 'GBPUSDm', 'BTCUSDm', 'XAUUSD', 'EURUSD', 'BTCUSD'],
  xm: ['XAUUSD#', 'EURUSD#', 'GBPUSD#', 'BTCUSD#', 'XAUUSD', 'EURUSD'],
  hfm: ['XAUUSD-c', 'EURUSD-c', 'XAUUSD', 'EURUSD'],
  icmarkets: ['XAUUSD', 'EURUSD', 'GBPUSD', 'AUDUSD', 'BTCUSD'],
  binance: ['BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'BNBUSDT', 'SOLUSDT', 'DOGEUSDT'],
  fbs: ['XAUUSD', 'EURUSD', 'GBPUSD']
};

export default function TerminalPage({ embedded = false }) {
  const [accounts, setAccounts] = useState([]);
  const [formData, setFormData] = useState({
    account_id: '',
    symbol: 'BTCUSDT',
    orderType: 'MARKET',
    price: '',
    lot_size: 0.1,
    sl: '',
    tp: '',
  });
  const [processing, setProcessing] = useState(false);
  const [recentOrders, setRecentOrders] = useState([]);
  const [marketPrices, setMarketPrices] = useState({});
  const [livePrice, setLivePrice] = useState(null);
  const [fetchingAll, setFetchingAll] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [viewMode, setViewMode] = useState('single');

  // Refs to avoid useEffect dependency restarts (prevents flickering)
  const viewModeRef = useRef(viewMode);
  const fetchingAllRef = useRef(fetchingAll);
  const accountsRef = useRef(accounts);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { fetchingAllRef.current = fetchingAll; }, [fetchingAll]);
  useEffect(() => { accountsRef.current = accounts; }, [accounts]);

  const fetchAllTrades = async () => {
    const accs = accountsRef.current;
    let allTrades = [];
    const promises = accs.map(async (acc) => {
      try {
        const trades = await api.getLiveTrades(acc.id);
        if (Array.isArray(trades)) {
          return trades.map(t => ({ ...t, _accountId: acc.id, _accountName: acc.account_name || acc.broker_name }));
        }
      } catch (e) {
        console.error(`Failed to fetch live trades for ${acc.id}`, e);
      }
      return [];
    });
    const results = await Promise.all(promises);
    results.forEach(res => { allTrades = allTrades.concat(res); });
    return allTrades;
  };

  const refreshAllAccountsTrades = async () => {
    if (accounts.length === 0) return alert('ไม่มีบัญชีให้ดึงข้อมูล');
    setFetchingAll(true);
    setViewMode('all');
    try {
      const allTrades = await fetchAllTrades();
      setRecentOrders(allTrades);

      // Auto-sync live trades to history database
      if (allTrades.length > 0) {
        try {
          const syncResult = await api.syncLiveTrades(allTrades);
          console.log(`[SyncLive] ${syncResult.message}`);
        } catch (syncErr) {
          console.warn('[SyncLive] Failed to sync live trades to history:', syncErr);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching all trades');
    } finally {
      setFetchingAll(false);
    }
  };

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const accs = await api.getAccounts();
        setAccounts(accs);
        if (accs.length > 0) {
          setFormData(prev => ({ ...prev, account_id: accs[0].id }));
        }
      } catch (err) {
        console.error('Failed to fetch accounts:', err);
      }
    };
    fetchAccounts();

    // Setup Socket
    const socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:4000');
    socket.on('market_prices', (prices) => {
      setMarketPrices(prices);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Poll Live Trades Every 3 Seconds — only restart when account_id changes
  useEffect(() => {
    if (!formData.account_id) return;
    let timer;
    let cancelled = false;

    const pollTrades = async () => {
      if (cancelled) return;
      // Skip this tick if a manual fetch-all is in progress
      if (fetchingAllRef.current) {
        timer = setTimeout(pollTrades, 3000);
        return;
      }
      try {
        if (viewModeRef.current === 'all') {
          const allTrades = await fetchAllTrades();
          if (!cancelled) setRecentOrders(allTrades);
        } else {
          const trades = await api.getLiveTrades(formData.account_id);
          if (!cancelled && Array.isArray(trades)) {
            setRecentOrders(trades.map(t => ({...t, _accountId: formData.account_id})));
          }
        }
      } catch (err) {
        console.error('Live trades err:', err);
      }
      if (!cancelled) timer = setTimeout(pollTrades, 3000);
    };
    pollTrades();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [formData.account_id]);

  // Sync live price when symbol or marketPrices change
  useEffect(() => {
    const symbolKey = formData.symbol?.toUpperCase();
    if (symbolKey && marketPrices[symbolKey]) {
      setLivePrice(marketPrices[symbolKey]);
    } else {
      setLivePrice(null);
    }
  }, [formData.symbol, marketPrices]);

  // Sync default symbol when account changes
  useEffect(() => {
    if (!formData.account_id || accounts.length === 0) return;
    const selectedAccount = accounts.find(a => a.id.toString() === formData.account_id.toString());
    
    let matchedSymbols = [];
    if (selectedAccount?.supported_symbols && Array.isArray(selectedAccount.supported_symbols) && selectedAccount.supported_symbols.length > 0) {
      matchedSymbols = selectedAccount.supported_symbols;
    } else {
      const bName = selectedAccount?.broker_name?.toLowerCase()?.replace(/\s/g, '') || '';
      if (bName.includes('exness')) matchedSymbols = BROKER_SYMBOLS.exness;
      else if (bName.includes('xm')) matchedSymbols = BROKER_SYMBOLS.xm;
      else if (bName.includes('hfm') || bName.includes('hot')) matchedSymbols = BROKER_SYMBOLS.hfm;
      else if (bName.includes('icmarket')) matchedSymbols = BROKER_SYMBOLS.icmarkets;
      else if (bName.includes('binance')) matchedSymbols = BROKER_SYMBOLS.binance;
      else if (bName.includes('fbs')) matchedSymbols = BROKER_SYMBOLS.fbs;
      else matchedSymbols = ['BTCUSDT', 'XAUUSD', 'EURUSD'];
    }
    
    setFormData(prev => {
      if (!matchedSymbols.includes(prev.symbol)) {
        return { ...prev, symbol: matchedSymbols[0] };
      }
      return prev;
    });
  }, [formData.account_id, accounts]);

  const handleTrade = async (side) => {
    if (!formData.account_id) return alert('กรุณาเลือกบัญชีเทรด');
    if (!formData.symbol) return alert('กรุณาระบุคู่เงิน (Symbol)');
    if (formData.lot_size <= 0) return alert('Lot size ต้องมากกว่า 0');

    setProcessing(true);
    try {
      const payload = {
        ...formData,
        side,
        order_type: formData.orderType,
        entry_price: formData.orderType === 'MARKET' ? null : parseFloat(formData.price),
        sl: formData.sl ? parseFloat(formData.sl) : null,
        tp: formData.tp ? parseFloat(formData.tp) : null,
      };

      const res = await api.placeManualTrade(payload);
      
      // Update local recent orders for UI feedback
      if (res.order) {
        setRecentOrders(prev => [res.order, ...prev].slice(0, 5));
      }
      alert(`ส่งคำสั่ง ${side} สำเร็จ! (สถานะ: กำลังรอการจับคู่)`);
      
      // Reset SL/TP inputs for next trade
      setFormData(prev => ({ ...prev, sl: '', tp: '' }));
    } catch (err) {
      alert(err || err.message || 'Error placing trade');
    } finally {
      setProcessing(false);
    }
  };

  const handleCloseAll = async (type) => {
    if (!window.confirm(`ยืนยันการปิดออเดอร์ ${type} ทั้งหมด?`)) return;
    
    const ordersToClose = recentOrders.filter(o => type === 'ALL' || o.side === type);
    if (ordersToClose.length === 0) return alert('ไม่มีออเดอร์ให้ปิด');

    setProcessing(true);
    try {
      const byAccount = {};
      ordersToClose.forEach(o => {
        const accId = o._accountId || formData.account_id;
        if (!byAccount[accId]) byAccount[accId] = [];
        byAccount[accId].push(o.ticket);
      });

      for (const [accId, tickets] of Object.entries(byAccount)) {
        await api.closeTrades(accId, tickets);
      }
      alert('คำสั่งปิดส่งสำเร็จ!');
      const closedTickets = ordersToClose.map(o => o.ticket);
      setRecentOrders(prev => prev.filter(o => !closedTickets.includes(o.ticket)));
    } catch (err) {
      alert(err || err.message || 'Error closing trades');
    } finally {
      setProcessing(false);
    }
  };

  const handleCloseOrder = async (idxToClose) => {
    const order = recentOrders[idxToClose];
    if (!order || !order.ticket) return alert('รหัสออเดอร์ไม่ถูกต้อง');
    if (!window.confirm(`ยืนยันการปิดออเดอร์ ${order.ticket}?`)) return;

    setProcessing(true);
    try {
      const accId = order._accountId || formData.account_id;
      await api.closeTrades(accId, [order.ticket]);
      alert('คำสั่งปิดสำเร็จ!');
      setRecentOrders(prev => prev.filter((_, idx) => idx !== idxToClose));
      setSelectedOrders(prev => prev.filter(t => t !== order.ticket));
    } catch (err) {
      alert(err || err.message || 'Error closing trade');
    } finally {
      setProcessing(false);
    }
  };

  const handleCloseSelected = async () => {
    if (selectedOrders.length === 0) return alert('กรุณาเลือกรายการที่ต้องการปิด');
    if (!window.confirm(`ยืนยันการปิดออเดอร์ที่เลือก (${selectedOrders.length} รายการ)?`)) return;

    setProcessing(true);
    try {
      const ordersToClose = recentOrders.filter(o => selectedOrders.includes(o.ticket));
      const byAccount = {};
      ordersToClose.forEach(o => {
        const accId = o._accountId || formData.account_id;
        if (!byAccount[accId]) byAccount[accId] = [];
        byAccount[accId].push(o.ticket);
      });

      for (const [accId, tickets] of Object.entries(byAccount)) {
        await api.closeTrades(accId, tickets);
      }
      alert('คำสั่งปิดรายการที่เลือกสำเร็จ!');
      const closedTickets = ordersToClose.map(o => o.ticket);
      setRecentOrders(prev => prev.filter(o => !closedTickets.includes(o.ticket)));
      setSelectedOrders([]);
    } catch (err) {
      alert(err || err.message || 'Error closing selected trades');
    } finally {
      setProcessing(false);
    }
  };

  const handleSelectOrder = (ticket) => {
    setSelectedOrders(prev => {
      if (prev.includes(ticket)) return prev.filter(t => t !== ticket);
      return [...prev, ticket];
    });
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === recentOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(recentOrders.map(o => o.ticket));
    }
  };

  return (
    <>
      {!embedded && (
        <div className="header">
          <div className="header-left">
            <h1 className="page-title">เทอร์มินัลคำสั่ง (Terminal)</h1>
          </div>
        </div>
      )}

      <div className={embedded ? '' : 'content-area'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
          {/* Action Panel */}
          <div className="chart-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <Activity size={18} style={{ color: 'var(--accent-primary)' }} />
                ส่งคำสั่งซื้อขาย
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  className="btn" 
                  style={{ width: 100, height: 42, background: 'var(--loss)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => handleTrade('SELL')} disabled={processing}
                >
                  <TrendingDown size={14} style={{ marginRight: 4 }} /> SELL
                </button>
                <button 
                  className="btn" 
                  style={{ width: 100, height: 42, background: 'var(--profit)', color: '#000', border: 'none', fontWeight: 600, fontSize: 13, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => handleTrade('BUY')} disabled={processing}
                >
                  <TrendingUp size={14} style={{ marginRight: 4 }} /> BUY
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: '1 1 200px' }}>
                <label className="form-label" style={{ marginBottom: 6 }}>บัญชีเทรด</label>
                <select 
                  className="form-input" 
                  value={formData.account_id}
                  onChange={e => {
                    setFormData({ ...formData, account_id: e.target.value });
                    setViewMode('single');
                  }}
                >
                  {accounts.length === 0 ? <option value="">ไม่มีบัญชี - โปรดสร้างใหม่</option> : null}
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_name} ({acc.account_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ flex: '1 1 120px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>คู่ (Symbol)</label>
                  {livePrice && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <span className="live-dot" style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block' }}></span>
                      {livePrice.toFixed(2)}
                    </span>
                  )}
                </div>
                <select 
                  className="form-input" 
                  value={formData.symbol}
                  onChange={e => setFormData({ ...formData, symbol: e.target.value })}
                  required
                >
                  {(() => {
                    const selectedAccount = accounts.find(a => a.id.toString() === formData.account_id?.toString());
                    let matchedSymbols = [];
                    
                    if (selectedAccount?.supported_symbols && Array.isArray(selectedAccount.supported_symbols) && selectedAccount.supported_symbols.length > 0) {
                      matchedSymbols = selectedAccount.supported_symbols;
                    } else {
                      const bName = selectedAccount?.broker_name?.toLowerCase()?.replace(/\s/g, '') || '';
                      if (bName.includes('exness')) matchedSymbols = BROKER_SYMBOLS.exness;
                      else if (bName.includes('xm')) matchedSymbols = BROKER_SYMBOLS.xm;
                      else if (bName.includes('hfm') || bName.includes('hot')) matchedSymbols = BROKER_SYMBOLS.hfm;
                      else if (bName.includes('icmarket')) matchedSymbols = BROKER_SYMBOLS.icmarkets;
                      else if (bName.includes('binance')) matchedSymbols = BROKER_SYMBOLS.binance;
                      else if (bName.includes('fbs')) matchedSymbols = BROKER_SYMBOLS.fbs;
                      else matchedSymbols = ['BTCUSDT', 'XAUUSD', 'EURUSD'];
                    }
                    return matchedSymbols.map(sym => (
                      <option key={sym} value={sym}>{sym}</option>
                    ));
                  })()}
                </select>
              </div>

              <div className="form-group" style={{ flex: '1 1 50px' }}>
                <label className="form-label" style={{ marginBottom: 6 }}>Lot Size</label>
                <input 
                  type="number" step="0.01" min="0.01"
                  className="form-input" value={formData.lot_size}
                  onChange={e => setFormData({ ...formData, lot_size: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>

              <div className="form-group" style={{ flex: '1 1 80px' }}>
                <label className="form-label" style={{ marginBottom: 6 }}>ประเภท</label>
                <select 
                  className="form-input" 
                  value={formData.orderType}
                  onChange={e => setFormData({ ...formData, orderType: e.target.value })}
                >
                  <option value="MARKET">Market</option>
                  <option value="LIMIT">Limit</option>
                  <option value="STOP">Stop-Limit</option>
                </select>
              </div>

              <div className="form-group" style={{ flex: '1 1 75px' }}>
                <label className="form-label" style={{ marginBottom: 6 }}>ราคา</label>
                {formData.orderType !== 'MARKET' ? (
                  <input 
                    type="number" step="0.00001"
                    className="form-input" placeholder="ราคา Entry"
                    value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })}
                  />
                ) : (
                  <input className="form-input" value="Auto Match" disabled style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }} />
                )}
              </div>

              <div className="form-group" style={{ flex: '1 1 50px' }}>
                <label className="form-label" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ShieldAlert size={12} style={{ color: 'var(--loss)' }} /> SL
                </label>
                <input 
                  type="number" step="0.00001"
                  className="form-input" placeholder="ราคา SL"
                  value={formData.sl} onChange={e => setFormData({ ...formData, sl: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ flex: '1 1 50px' }}>
                <label className="form-label" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Target size={12} style={{ color: 'var(--profit)' }} /> TP
                </label>
                <input 
                  type="number" step="0.00001"
                  className="form-input" placeholder="ราคา TP"
                  value={formData.tp} onChange={e => setFormData({ ...formData, tp: e.target.value })}
                />
              </div>
            </div>
            {processing && <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>กำลังส่งคำสั่งเข้าสู่ตลาด...</div>}
          </div>

          {/* Activity / Visualization Panel */}
          <div>
            <div className="chart-card" style={{ height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 className="chart-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Crosshair size={18} style={{ color: 'var(--accent-secondary)' }} />
                  ออเดอร์ล่าสุด (Session Orders)
                </h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button 
                    className="btn btn-sm btn-secondary" 
                    title="ดึงออเดอร์จากทุกบัญชีเข้ามารวมกัน"
                    onClick={refreshAllAccountsTrades}
                    disabled={fetchingAll}
                    style={{ fontSize: 12, padding: '4px 12px' }}
                  >
                    <RefreshCw size={14} className={fetchingAll ? "spin" : ""} style={{ marginRight: 4, display: 'inline-block', animation: fetchingAll ? 'spin 1s linear infinite' : 'none' }} /> 
                    {fetchingAll ? 'กำลังดึงข้อมูล...' : 'ดึงข้อมูล'}
                  </button>
                  {recentOrders.length > 0 && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {selectedOrders.length > 0 && (
                        <button className="btn btn-sm" style={{ background: 'rgba(234, 179, 8, 0.1)', color: 'var(--warning)', border: 'none', padding: '4px 12px', fontSize: 12 }} onClick={handleCloseSelected}>
                          Close Selected ({selectedOrders.length})
                        </button>
                      )}
                      <button className="btn btn-sm" style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--profit)', border: 'none', padding: '4px 12px', fontSize: 12 }} onClick={() => handleCloseAll('BUY')}>Close All Buy</button>
                      <button className="btn btn-sm" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--loss)', border: 'none', padding: '4px 12px', fontSize: 12 }} onClick={() => handleCloseAll('SELL')}>Close All Sell</button>
                      <button className="btn btn-sm" style={{ background: 'rgba(234, 179, 8, 0.1)', color: 'var(--warning)', border: 'none', padding: '4px 12px', fontSize: 12 }} onClick={() => handleCloseAll('ALL')}>Close All</button>
                    </div>
                  )}
                </div>
              </div>
              
              <style>{`
                @keyframes spin {
                  100% { transform: rotate(360deg); }
                }
              `}</style>
              
              {recentOrders.length === 0 ? (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                  คุณยังไม่ได้เริ่มส่งออเดอร์ใด ๆ ในรอบนี้
                </div>
              ) : (
                <div className="data-table-wrapper" style={{ border: 'none' }}>
                  <table className="data-table" style={{ fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 40, textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={recentOrders.length > 0 && selectedOrders.length === recentOrders.length}
                            onChange={handleSelectAll}
                            style={{ cursor: 'pointer' }}
                          />
                        </th>
                        <th>สัญลักษณ์</th>
                        <th>ประเภท</th>
                        <th>ขนาด (Lot)</th>
                        <th>กำไร/ขาดทุน</th>
                        <th>สถานะ</th>
                        <th>เวลาส่งคำสั่ง</th>
                        <th style={{ textAlign: 'right' }}>จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order, idx) => {
                        const pnl = order.pnl || 0;
                        const isProfit = pnl >= 0;
                        return (
                          <tr key={order.ticket || order.id || idx}>
                            <td style={{ textAlign: 'center' }}>
                               <input 
                                 type="checkbox"
                                 checked={selectedOrders.includes(order.ticket)}
                                 onChange={() => handleSelectOrder(order.ticket)}
                                 style={{ cursor: 'pointer' }}
                               />
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {order.symbol}
                              {order._accountName && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400, marginTop: 2 }}>{order._accountName}</div>}
                            </td>
                            <td>
                              <span className={`badge ${order.side === 'BUY' ? 'badge-buy' : 'badge-sell'}`}>
                                {order.side}
                              </span>
                            </td>
                            <td>{order.lot_size}</td>
                            <td style={{ color: isProfit ? 'var(--profit)' : 'var(--loss)', fontWeight: 600 }}>
                              {isProfit ? '+' : ''}{pnl.toFixed(2)}
                            </td>
                            <td>
                              <span className="badge badge-open">{order.status}</span>
                            </td>
                            <td style={{ color: 'var(--text-tertiary)' }}>เพิ่งส่ง</td>
                            <td style={{ textAlign: 'right' }}>
                              <button className="btn btn-sm" style={{ background: 'transparent', color: 'var(--loss)', border: '1px solid var(--loss)', padding: '2px 8px', fontSize: 11 }} onClick={() => handleCloseOrder(idx)}>Close</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
