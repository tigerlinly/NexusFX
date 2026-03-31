import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import {
  Wallet, ArrowUpRight, ArrowDownRight, Plus, Minus, DollarSign,
  TrendingUp, Clock, RefreshCw, Search
} from 'lucide-react';

export default function WalletPage() {
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [totalTx, setTotalTx] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(null); // 'deposit' | 'withdraw'
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [depositMethod, setDepositMethod] = useState('test');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filter) params.type = filter;
      
      const [sum, txData] = await Promise.all([
        api.getWalletSummary(),
        api.getTransactions(params),
      ]);
      setSummary(sum);
      setTransactions(txData.transactions);
      setTotalTx(txData.total);
    } catch (err) {
      console.error('Wallet fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchData(); 
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      alert('เริ่มดำเนินการชำระเงินเรียบร้อยแล้ว (Stripe Session Closed)');
      window.history.replaceState(null, '', window.location.pathname);
    } else if (params.get('payment') === 'cancelled') {
      alert('คุณได้ยกเลิกการทำรายการชำระเงิน');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [page, filter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    setProcessing(true);
    try {
      if (showModal === 'deposit') {
        if (depositMethod === 'test') {
          // Direct topup — skip payment gateway
          await api.topup({ amount: parseFloat(amount), currency: 'USD' });
          alert(`ฝากเงิน $${parseFloat(amount).toFixed(2)} ยอดเข้าสู่กระเป๋า USD แล้ว! (โหมดทดสอบ)`);
        } else {
          // Stripe checkout
          const res = await api.createCheckout({ amountUSD: parseFloat(amount) });
          if (res.url) {
            window.location.href = res.url;
            return; // Redirecting to Stripe
          }
        }
      } else {
        await api.withdraw({ amount: parseFloat(amount), note });
        alert(`ทำรายการถอนเงิน $${parseFloat(amount).toFixed(2)} สำเร็จ!`);
      }
      setShowModal(null);
      setAmount('');
      setNote('');
      fetchData();
    } catch (err) {
      alert(err.message || 'เกิดข้อผิดพลาดในการทำรายการ');
    } finally {
      if (depositMethod === 'test' || showModal !== 'deposit') {
        setProcessing(false);
      }
    }
  };

  const handleTestDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setProcessing(true);
    try {
      await api.topup({ amount: parseFloat(amount), currency: 'USD' });
      setShowModal(null);
      setAmount('');
      setNote('');
      fetchData();
      alert('เติมเงินทดสอบสำเร็จ!');
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (val) => {
    if (!val && val !== 0) return '$0.00';
    return `$${parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const typeColors = {
    DEPOSIT: { bg: 'var(--profit-bg)', color: 'var(--profit)', icon: ArrowDownRight, label: 'ฝากเงิน' },
    WITHDRAW: { bg: 'var(--loss-bg)', color: 'var(--loss)', icon: ArrowUpRight, label: 'ถอนเงิน' },
    FEE: { bg: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-tertiary)', icon: DollarSign, label: 'ค่าธรรมเนียม' },
    TRANSFER: { bg: 'rgba(14, 165, 233, 0.1)', color: 'var(--accent-secondary)', icon: RefreshCw, label: 'โอนเงิน' },
  };

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title">กระเป๋าเงิน</h1>
        </div>
        <div className="header-right" style={{ gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal('deposit')}>
            <Plus size={14} /> ฝากเงิน
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowModal('withdraw')}>
            <Minus size={14} /> ถอนเงิน
          </button>
        </div>
      </div>

      <div className="content-area">
        {/* Wallet Cards */}
        <div className="stat-grid">
          <div className="card">
            <div className="card-header">
              <span className="card-title">ยอดคงเหลือ</span>
              <div className="card-icon" style={{ background: 'rgba(0, 200, 150, 0.1)' }}>
                <Wallet size={18} style={{ color: 'var(--accent-primary)' }} />
              </div>
            </div>
            <div className="card-value">{formatCurrency(summary?.total_balance)}</div>
            <div className="card-sub">มีอยู่: {formatCurrency(summary?.available_balance)}</div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">ฝากเดือนนี้</span>
              <div className="card-icon" style={{ background: 'var(--profit-bg)' }}>
                <ArrowDownRight size={18} style={{ color: 'var(--profit)' }} />
              </div>
            </div>
            <div className="card-value profit">{formatCurrency(summary?.monthly?.total_deposits)}</div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">ถอนเดือนนี้</span>
              <div className="card-icon" style={{ background: 'var(--loss-bg)' }}>
                <ArrowUpRight size={18} style={{ color: 'var(--loss)' }} />
              </div>
            </div>
            <div className="card-value loss">{formatCurrency(summary?.monthly?.total_withdrawals)}</div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">ค่าธรรมเนียมเดือนนี้</span>
              <div className="card-icon" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                <DollarSign size={18} style={{ color: 'var(--accent-tertiary)' }} />
              </div>
            </div>
            <div className="card-value">{formatCurrency(summary?.monthly?.total_fees)}</div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title">ประวัติธุรกรรม</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {['', 'DEPOSIT', 'WITHDRAW', 'FEE'].map(f => (
                <button
                  key={f}
                  className={`filter-btn ${filter === f ? 'active' : ''}`}
                  onClick={() => { setFilter(f); setPage(1); }}
                  style={{ padding: '4px 14px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border-primary)' }}
                >
                  {f === '' ? 'ทั้งหมด' : typeColors[f]?.label || f}
                </button>
              ))}
            </div>
          </div>

          <div className="data-table-wrapper" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ประเภท</th>
                  <th>จำนวน</th>
                  <th>สกุลเงิน</th>
                  <th>สถานะ</th>
                  <th>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>
                      ไม่มีธุรกรรม
                    </td>
                  </tr>
                ) : transactions.map(tx => {
                  const typeInfo = typeColors[tx.type] || typeColors.DEPOSIT;
                  const Icon = typeInfo.icon;
                  return (
                    <tr key={tx.id}>
                      <td style={{ fontFamily: 'var(--font-sans)' }}>
                        {new Date(tx.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })}
                        <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 10 }}>
                          {new Date(tx.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: typeInfo.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon size={12} style={{ color: typeInfo.color }} />
                          </div>
                          <span style={{ fontFamily: 'var(--font-sans)', color: typeInfo.color, fontWeight: 600 }}>{typeInfo.label}</span>
                        </div>
                      </td>
                      <td style={{ color: tx.type === 'DEPOSIT' ? 'var(--profit)' : tx.type === 'WITHDRAW' ? 'var(--loss)' : 'var(--text-primary)', fontWeight: 600 }}>
                        {tx.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </td>
                      <td>{tx.currency || 'USD'}</td>
                      <td>
                        <span className={`badge ${tx.status === 'COMPLETED' ? 'badge-buy' : tx.status === 'PENDING' ? 'badge-open' : 'badge-closed'}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-tertiary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tx.note || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalTx > 20 && (
            <div className="pagination">
              <span className="pagination-info">{totalTx} รายการ</span>
              <div className="pagination-buttons">
                <button className="pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>ก่อนหน้า</button>
                <button className="pagination-btn active">{page}</button>
                <button className="pagination-btn" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= totalTx}>ถัดไป</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deposit/Withdraw Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">
              {showModal === 'deposit' ? '💰 ฝากเงิน' : '💸 ถอนเงิน'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">จำนวนเงิน (USD)</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              {showModal === 'deposit' && (
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">รูปแบบการทำรายการ</label>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: depositMethod === 'test' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      <input 
                        type="radio" 
                        name="depositMethod" 
                        value="test" 
                        checked={depositMethod === 'test'} 
                        onChange={() => setDepositMethod('test')} 
                      />
                      ทดสอบ (เพิ่มยอดเข้าทันที)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: depositMethod === 'real' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      <input 
                        type="radio" 
                        name="depositMethod" 
                        value="real" 
                        checked={depositMethod === 'real'} 
                        onChange={() => setDepositMethod('real')} 
                      />
                      โอนจริง (ไปที่ Payment)
                    </label>
                  </div>
                </div>
              )}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">หมายเหตุ</label>
                <input
                  className="form-input"
                  placeholder="เพิ่มหมายเหตุ (ไม่จำเป็น)"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(null)}>ยกเลิก</button>
                {showModal === 'deposit' && (
                  <button 
                    type="button" 
                    className="btn" 
                    style={{ background: 'var(--profit)', color: '#fff' }} 
                    onClick={handleTestDeposit}
                    disabled={processing}
                  >
                    ทดสอบเติมเงิน
                  </button>
                )}
                <button type="submit" className={`btn ${showModal === 'deposit' ? 'btn-primary' : 'btn-danger'}`} disabled={processing}>
                  {processing ? 'กำลังดำเนินการ...' : showModal === 'deposit' ? 'ฝากเงิน Stripe' : 'ถอนเงิน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
