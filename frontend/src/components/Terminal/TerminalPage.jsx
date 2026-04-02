import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { io } from 'socket.io-client';
import { Send, TrendingUp, TrendingDown, Crosshair, Target, ShieldAlert, Activity } from 'lucide-react';

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
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 450px) 1fr', gap: 'var(--space-xl)' }}>
          {/* Action Panel */}
          <div className="chart-card">
            <h3 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
              <Activity size={18} style={{ color: 'var(--accent-primary)' }} />
              ส่งคำสั่งซื้อขาย
            </h3>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">บัญชีเทรด</label>
              <select 
                className="form-input" 
                value={formData.account_id}
                onChange={e => setFormData({ ...formData, account_id: e.target.value })}
              >
                {accounts.length === 0 ? <option value="">ไม่มีบัญชี - โปรดสร้างใหม่</option> : null}
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_name} ({acc.account_number}) - {acc.broker_name}
                  </option>
                ))}
              </select>
            </div>

      <div className="form-group" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label className="form-label" style={{ marginBottom: 0 }}>คู่ที่ต้องการเทรด (Symbol)</label>
          {livePrice && (
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block' }}></span>
              Market Price: {livePrice.toFixed(2)}
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
              else matchedSymbols = ['BTCUSDT', 'XAUUSD', 'EURUSD']; // Fallback
            }
            
            return matchedSymbols.map(sym => (
              <option key={sym} value={sym}>{sym}</option>
            ));
          })()}
        </select>
      </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">ประเภทคำสั่ง (Type)</label>
                <select 
                  className="form-input" 
                  value={formData.orderType}
                  onChange={e => setFormData({ ...formData, orderType: e.target.value })}
                >
                  <option value="MARKET">Market (ราคาปัจจุบัน)</option>
                  <option value="LIMIT">Limit (ตั้งราคารอล่วงหน้า)</option>
                  <option value="STOP">Stop-Limit</option>
                </select>
              </div>

              {formData.orderType !== 'MARKET' ? (
                <div className="form-group">
                  <label className="form-label">ราคาที่ต้องการ (Price)</label>
                  <input 
                    type="number"
                    step="0.00001"
                    className="form-input" 
                    placeholder="ราคา Entry"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">ราคาที่ต้องการ (Price)</label>
                  <input className="form-input" value="Auto Match" disabled style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }} />
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label">ปริมาณการเทรด (Lot Size)</label>
              <input 
                type="number"
                step="0.01"
                min="0.01"
                className="form-input" 
                value={formData.lot_size}
                onChange={e => setFormData({ ...formData, lot_size: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ShieldAlert size={12} style={{ color: 'var(--loss)' }} /> Stop Loss
                </label>
                <input 
                  type="number"
                  step="0.00001"
                  className="form-input" 
                  placeholder="ราคาตัดขาดทุน"
                  value={formData.sl}
                  onChange={e => setFormData({ ...formData, sl: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Target size={12} style={{ color: 'var(--profit)' }} /> Take Profit
                </label>
                <input 
                  type="number"
                  step="0.00001"
                  className="form-input" 
                  placeholder="ราคาเป้าหมาย"
                  value={formData.tp}
                  onChange={e => setFormData({ ...formData, tp: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button 
                className="btn" 
                style={{ height: 48, background: 'var(--loss)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 16 }}
                onClick={() => handleTrade('SELL')}
                disabled={processing}
              >
                <TrendingDown size={18} style={{ marginRight: 8 }} />
                SELL (Short)
              </button>
              <button 
                className="btn" 
                style={{ height: 48, background: 'var(--profit)', color: '#000', border: 'none', fontWeight: 600, fontSize: 16 }}
                onClick={() => handleTrade('BUY')}
                disabled={processing}
              >
                <TrendingUp size={18} style={{ marginRight: 8 }} />
                BUY (Long)
              </button>
            </div>
            {processing && <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>กำลังส่งคำสั่งเข้าสู่ตลาด...</div>}
          </div>

          {/* Activity / Visualization Panel */}
          <div>
            <div className="chart-card" style={{ height: '100%' }}>
              <h3 className="chart-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Crosshair size={18} style={{ color: 'var(--accent-secondary)' }} />
                ออเดอร์ล่าสุด (Session Orders)
              </h3>
              
              {recentOrders.length === 0 ? (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                  คุณยังไม่ได้เริ่มส่งออเดอร์ใด ๆ ในรอบนี้
                </div>
              ) : (
                <div className="data-table-wrapper" style={{ border: 'none' }}>
                  <table className="data-table" style={{ fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th>สัญลักษณ์</th>
                        <th>ประเภท</th>
                        <th>ขนาด (Lot)</th>
                        <th>สถานะ</th>
                        <th>เวลาส่งคำสั่ง</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order, idx) => (
                        <tr key={order.id || idx}>
                          <td style={{ fontWeight: 600 }}>{order.symbol}</td>
                          <td>
                            <span className={`badge ${order.side === 'BUY' ? 'badge-buy' : 'badge-sell'}`}>
                              {order.side}
                            </span>
                          </td>
                          <td>{order.lot_size}</td>
                          <td>
                            <span className="badge badge-open">{order.status}</span>
                          </td>
                          <td style={{ color: 'var(--text-tertiary)' }}>เพิ่งส่ง</td>
                        </tr>
                      ))}
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
