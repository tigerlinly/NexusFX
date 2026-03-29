import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useAccounts } from '../../context/AccountContext';
import {
  Building2, Plus, Pencil, Trash2, Link2, Link2Off, Save, RefreshCw
} from 'lucide-react';

export default function AccountsPage() {
  const { accounts, brokers, fetchAccounts } = useAccounts();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const [formData, setFormData] = useState({
    broker_id: '', account_number: '', account_name: '', account_type: 'Real',
    currency: 'USD', server: '', metaapi_account_id: ''
  });

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        broker_id: parseInt(formData.broker_id),
      };
      
      if (editId) {
        await api.updateAccount(editId, payload);
      } else {
        await api.addAccount(payload);
      }
      
      setShowForm(false);
      setEditId(null);
      setFormData({ broker_id: '', account_number: '', account_name: '', account_type: 'Real', currency: 'USD', server: '', metaapi_account_id: '' });
      fetchAccounts();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = (acc) => {
    setFormData({
      broker_id: acc.broker_id,
      account_number: acc.account_number,
      account_name: acc.account_name || '',
      account_type: acc.account_type || 'Real',
      currency: acc.currency || 'USD',
      server: acc.server || '',
      metaapi_account_id: acc.metaapi_account_id || ''
    });
    setEditId(acc.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!await window.customConfirm('ลบบัญชีนี้?')) return;
    await api.updateAccount(id, { is_active: false });
    fetchAccounts();
  };

  const handleSync = async (accId) => {
    setSyncingId(accId);
    try {
      const result = await api.syncAccount(accId);
      alert(`✅ Sync สำเร็จ! Balance: $${result.balance}, Equity: $${result.equity}`);
      fetchAccounts();
    } catch (err) {
      alert(`❌ Sync ล้มเหลว: ${err.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  // Group by broker (with logo)
  const grouped = accounts.reduce((acc, a) => {
    const key = a.broker_display_name || a.broker_name;
    if (!acc[key]) acc[key] = { accs: [], logo: a.broker_logo, broker_name: a.broker_name };
    acc[key].accs.push(a);
    return acc;
  }, {});

  const getBrokerLogo = (brokerName) => {
    const name = (brokerName || '').toLowerCase();
    const logos = {
      'exness': 'https://www.google.com/s2/favicons?domain=exness.com&sz=32',
      'xm': 'https://www.google.com/s2/favicons?domain=xm.com&sz=32',
      'ic markets': 'https://www.google.com/s2/favicons?domain=icmarkets.com&sz=32',
      'icmarkets': 'https://www.google.com/s2/favicons?domain=icmarkets.com&sz=32',
      'fbs': 'https://www.google.com/s2/favicons?domain=fbs.com&sz=32',
      'pepperstone': 'https://www.google.com/s2/favicons?domain=pepperstone.com&sz=32',
      'roboforex': 'https://www.google.com/s2/favicons?domain=roboforex.com&sz=32',
      'hfm': 'https://www.google.com/s2/favicons?domain=hfm.com&sz=32',
      'hotforex': 'https://www.google.com/s2/favicons?domain=hfm.com&sz=32',
      'avatrade': 'https://www.google.com/s2/favicons?domain=avatrade.com&sz=32',
      'tickmill': 'https://www.google.com/s2/favicons?domain=tickmill.com&sz=32',
      'fxpro': 'https://www.google.com/s2/favicons?domain=fxpro.com&sz=32',
      'oanda': 'https://www.google.com/s2/favicons?domain=oanda.com&sz=32',
    };
    for (const [key, url] of Object.entries(logos)) {
      if (name.includes(key)) return url;
    }
    return null;
  };

  const getBrokerLink = (brokerId) => {
    const broker = brokers.find(b => parseInt(b.id) === parseInt(brokerId));
    if (!broker) return '#';
    const name = (broker.name || '').toLowerCase();
    if (name.includes('exness')) return 'https://www.exness.com/';
    if (name.includes('ic markets')) return 'https://icmarkets.com/';
    if (name.includes('xm')) return 'https://www.xm.com/';
    if (name.includes('fbs')) return 'https://fbs.com/';
    if (name.includes('roboforex')) return 'https://roboforex.com/';
    if (name.includes('pepperstone')) return 'https://pepperstone.com/';
    return `https://www.google.com/search?q=${encodeURIComponent(broker.name)}+broker`;
  };

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title">จัดการบัญชี</h1>
        </div>
        <div className="header-right">
          <button className="btn btn-primary btn-sm" onClick={() => {
            setShowForm(!showForm);
            setEditId(null);
            if (!showForm) {
              setFormData({ broker_id: '', account_number: '', account_name: '', account_type: 'Real', currency: 'USD', server: '', metaapi_account_id: '' });
            }
          }}>
            <Plus size={14} /> เพิ่มบัญชี
          </button>
        </div>
      </div>

      <div className="content-area">
        {/* Add Account Form */}
        {showForm && (
          <div className="settings-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <h3 className="settings-section-title" style={{ marginBottom: 0 }}>
                {editId ? <Pencil size={18} /> : <Building2 size={18} />} 
                {editId ? 'แก้ไขบัญชี MT5' : 'เพิ่มบัญชี MT5'}
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setEditId(null); }}>
                  ยกเลิก
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleSave}
                  disabled={!formData.broker_id || !formData.account_number}>
                  <Save size={14} /> บันทึก
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr 3fr', gap: 'var(--space-md)' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '6px' }}>
                  <span>Broker</span>
                  {formData.broker_id && (
                    <a href={getBrokerLink(formData.broker_id)} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
                      ไปที่เว็บไซต์
                    </a>
                  )}
                </label>
                <select className="filter-select" value={formData.broker_id}
                  onChange={e => setFormData(p => ({ ...p, broker_id: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px' }}>
                  <option value="">เลือก Broker</option>
                  {brokers.map(b => <option key={b.id} value={b.id}>{b.display_name || b.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label className="form-label">เลขบัญชี</label>
                <input className="form-input" placeholder="12345678" value={formData.account_number}
                  onChange={e => setFormData(p => ({ ...p, account_number: e.target.value }))} />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label className="form-label">Server</label>
                <input className="form-input" placeholder="Exness-MT5Real" value={formData.server}
                  onChange={e => setFormData(p => ({ ...p, server: e.target.value }))} />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '6px' }}>
                  <span>MetaApi Account ID</span>
                  <a href="https://app.metaapi.cloud/" target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
                    สมัครและรับ Token
                  </a>
                </label>
                <input className="form-input" placeholder="สำหรับเชื่อมต่อ MT5 อัตโนมัติ" value={formData.metaapi_account_id}
                  onChange={e => setFormData(p => ({ ...p, metaapi_account_id: e.target.value }))} />
              </div>

            </div>
          </div>
        )}

        {/* Accounts grouped by broker */}
        {Object.entries(grouped).map(([brokerName, group]) => {
          const accs = group.accs;
          const logoUrl = group.logo || getBrokerLogo(group.broker_name || brokerName);
          return (
          <div key={brokerName} className="settings-section">
            <h3 className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {logoUrl ? (
                <img src={logoUrl} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />
              ) : (
                <Building2 size={16} />
              )}
              {brokerName}
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                ({accs.length} บัญชี)
              </span>
            </h3>

            {accs.map(acc => (
              <div key={acc.id} className="settings-row" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'minmax(120px, 1.5fr) minmax(60px, 0.6fr) minmax(40px, 0.4fr) minmax(80px, 0.8fr) minmax(80px, 0.8fr) minmax(90px, 0.8fr) auto', 
                gap: '12px', 
                alignItems: 'center',
                padding: '12px 16px',
                minHeight: '48px'
              }}>
                <div style={{ overflow: 'hidden' }}>
                  <span style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{acc.account_name || '-'}</span>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>#{acc.account_number}</div>
                </div>
                <div>
                  <span style={{ fontWeight: 500, fontSize: 12 }}>{acc.account_type || '-'}</span>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>ประเภท</div>
                </div>
                <div>
                  <span style={{ fontWeight: 500, fontSize: 12 }}>{acc.currency || 'USD'}</span>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>สกุล</div>
                </div>
                <div>
                  <span className="font-mono" style={{ fontWeight: 600, fontSize: 12 }}>${parseFloat(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Balance</div>
                </div>
                <div>
                  <span className="font-mono" style={{ fontWeight: 600, fontSize: 12 }}>${parseFloat(acc.equity).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Equity</div>
                </div>
                <div>
                  {acc.is_connected ? (
                    <span style={{ color: 'var(--profit)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Link2 size={11} /> เชื่อมต่อแล้ว
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Link2Off size={11} /> ยังไม่เชื่อมต่อ
                    </span>
                  )}
                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    {acc.last_sync_at ? `Sync: ${new Date(acc.last_sync_at).toLocaleTimeString('th-TH')}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', flexShrink: 0 }}>
                  {acc.metaapi_account_id && (
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleSync(acc.id)}
                      disabled={syncingId === acc.id}
                      style={{ color: 'var(--accent-primary)', padding: '4px' }} title="Sync จาก MetaAPI">
                      <RefreshCw size={13} className={syncingId === acc.id ? 'spin' : ''} />
                    </button>
                  )}
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleEdit(acc)}
                    style={{ color: 'var(--text-secondary)', padding: '4px' }} title="แก้ไขบัญชี">
                    <Pencil size={13} />
                  </button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(acc.id)}
                    style={{ color: 'var(--loss)', padding: '4px' }} title="ลบบัญชี">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          );
        })}

        {Object.keys(grouped).length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>
            <Building2 size={40} style={{ opacity: 0.2, marginBottom: 'var(--space-md)' }} />
            <div>ยังไม่มีบัญชีในระบบ — กดปุ่ม "เพิ่มบัญชี" เพื่อเริ่มต้น</div>
          </div>
        )}
      </div>
    </>
  );
}
