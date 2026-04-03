import { useState } from 'react';
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
    currency: 'USD', server: '', metaapi_account_id: '', connection_type: 'TYPE_3_METAAPI',
    is_master: false, copy_target_id: '', api_credentials: '{}'
  });

  const formatCurrency = (val) => {
    if (val === undefined || val === null || val === '') return '$0.00';
    const num = parseFloat(val);
    if (isNaN(num)) return '$0.00';
    if (num === 0) return '$0.00';
    const prefix = num > 0 ? '+' : '-';
    return `${prefix}$${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleSave = async () => {
    try {
      let parsedCredentials = {};
      try {
        if (formData.connection_type === 'TYPE_2_API' && formData.api_credentials.trim()) {
          parsedCredentials = JSON.parse(formData.api_credentials);
        }
      } catch {
        return alert('API Credentials ต้องเป็นรูปแบบ JSON ที่ถูกต้อง');
      }

      const payload = {
        ...formData,
        broker_id: parseInt(formData.broker_id),
        api_credentials: parsedCredentials,
        copy_target_id: formData.copy_target_id || null
      };
      
      if (editId) {
        await api.updateAccount(editId, payload);
      } else {
        await api.addAccount(payload);
      }
      
      setShowForm(false);
      setEditId(null);
      setFormData({ broker_id: '', account_number: '', account_name: '', account_type: 'Real', currency: 'USD', server: '', metaapi_account_id: '', connection_type: 'TYPE_3_METAAPI', is_master: false, copy_target_id: '', api_credentials: '{}' });
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
      metaapi_account_id: acc.metaapi_account_id || '',
      connection_type: acc.connection_type || 'TYPE_3_METAAPI',
      is_master: acc.is_master || false,
      copy_target_id: acc.copy_target_id || '',
      api_credentials: JSON.stringify(acc.api_credentials || {}, null, 2)
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
    const brokerLogos = {
      'exness': { url: '/logos/exness.png', abbr: 'ex', color: '#F5C518', bg: '#2D2D00' },
      'xm': { url: '/logos/xm.png', abbr: 'XM', color: '#E2001A', bg: '#2D0004' },
      'ic markets': { url: '/logos/icmarkets.png', abbr: 'IC', color: '#00B4D8', bg: '#002833' },
      'icmarkets': { url: '/logos/icmarkets.png', abbr: 'IC', color: '#00B4D8', bg: '#002833' },
      'fbs': { url: '/logos/fbs.png', abbr: 'FB', color: '#5BC0BE', bg: '#0B3D3B' },
      'pepperstone': { url: '/logos/pepperstone.png', abbr: 'PP', color: '#0074E0', bg: '#001A33' },
      'roboforex': { url: '/logos/roboforex.png', abbr: 'RF', color: '#2196F3', bg: '#0D2137' },
      'hfm': { url: '/logos/hfm.png', abbr: 'HF', color: '#C62828', bg: '#2D0000' },
      'hotforex': { url: '/logos/hfm.png', abbr: 'HF', color: '#C62828', bg: '#2D0000' },
      'avatrade': { url: '/logos/avatrade.png', abbr: 'AV', color: '#1565C0', bg: '#0D1F33' },
      'tickmill': { url: '/logos/tickmill.png', abbr: 'TM', color: '#4CAF50', bg: '#0D2D0F' },
      'fxpro': { url: '/logos/fxpro.png', abbr: 'FX', color: '#FF6F00', bg: '#331600' },
      'oanda': { url: '/logos/oanda.png', abbr: 'OA', color: '#000000', bg: '#1A1A1A' },
      'fxtm': { url: '/logos/fxtm.png', abbr: 'FT', color: '#0D47A1', bg: '#051933' },
      'octafx': { url: '/logos/octafx.png', abbr: 'OF', color: '#FF6F00', bg: '#331600' },
      'vantage': { url: '/logos/vantage.png', abbr: 'VT', color: '#E53935', bg: '#2D0000' },
      'fxgt': { url: '/logos/fxgt.png', abbr: 'FX', color: '#00A1E0', bg: '#001A24' },
    };

    for (const [key, data] of Object.entries(brokerLogos)) {
      if (name.includes(key)) return data;
    }
    // Default fallback
    const abbr = (brokerName || 'BR').substring(0, 2).toUpperCase();
    return { url: null, abbr, color: '#90A4AE', bg: '#1A2433' };
  };

  const BrokerLogo = ({ brokerName, size = 28 }) => {
    const [imgError, setImgError] = useState(false);
    const logoData = getBrokerLogo(brokerName);
    
    if (logoData.url && !imgError) {
      return (
        <div style={{
          width: size, height: size, borderRadius: '50%', overflow: 'hidden',
          backgroundColor: logoData.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `2px solid ${logoData.color}40`, flexShrink: 0
        }}>
          <img 
            src={logoData.url} 
            alt={brokerName}
            style={{ width: size - 4, height: size - 4, objectFit: 'contain', borderRadius: '50%' }}
            onError={() => setImgError(true)}
          />
        </div>
      );
    }

    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        backgroundColor: logoData.bg, color: logoData.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.35, fontWeight: 700, letterSpacing: '-0.5px',
        border: `2px solid ${logoData.color}40`, flexShrink: 0
      }}>
        {logoData.abbr}
      </div>
    );
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
              setFormData({ broker_id: '', account_number: '', account_name: '', account_type: 'Real', currency: 'USD', server: '', metaapi_account_id: '', connection_type: 'TYPE_3_METAAPI', is_master: false, copy_target_id: '', api_credentials: '{}' });
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
                <label className="form-label">ประเภทการเชื่อมต่อ (Connection Type)</label>
                <select className="filter-select" value={formData.connection_type}
                  onChange={e => setFormData(p => ({ ...p, connection_type: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px' }}>
                  <option value="TYPE_3_METAAPI">Cloud Protocol (MetaAPI)</option>
                  <option value="TYPE_1_EA">MQL Bridge EA (รัน EA บน MT4/MT5 เอง)</option>
                  <option value="TYPE_2_API">Native Open API (เช่น cTrader/Binance)</option>
                </select>
              </div>

              {formData.connection_type === 'TYPE_3_METAAPI' && (
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
              )}
              
              {formData.connection_type !== 'TYPE_3_METAAPI' && (
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gridColumn: 'span 1' }}>
                  <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <p style={{ margin: '0 0 6px 0', color: 'var(--text-primary)', fontWeight: '500' }}>ℹ️ System Note</p>
                    {formData.connection_type === 'TYPE_1_EA' 
                      ? 'ระบบจะสร้าง Bridge Token ให้อัตโนมัติหลังจากท่านบันทึก กรุณานำ Token ไปใส่ใน EA Bridge ของคุณเพื่อเริ่มการเชื่อมต่อ 24/7'
                      : 'กรุณากรอก API Credentials ในช่องด้านล่าง (รูปแบบ JSON)'
                    }
                  </div>
                </div>
              )}

              {formData.connection_type === 'TYPE_2_API' && (
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gridColumn: 'span 4' }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '6px' }}>
                    <span>API Credentials (JSON format)</span>
                  </label>
                  <textarea className="form-input font-mono" placeholder={'{\n  "apiKey": "xxxx",\n  "apiSecret": "xxxx"\n}'} value={formData.api_credentials}
                    onChange={e => setFormData(p => ({ ...p, api_credentials: e.target.value }))} rows={4} />
                </div>
              )}

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gridColumn: 'span 2' }}>
                <label className="form-label text-emerald-400">Master Account (สัญญาณเทรดต้นทาง)</label>
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                    <input type="checkbox" checked={formData.is_master} onChange={e => setFormData(p => ({ ...p, is_master: e.target.checked, copy_target_id: '' }))} />
                     ตั้งเป็น Master
                  </label>
                </div>
              </div>

              {!formData.is_master && (
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gridColumn: 'span 2' }}>
                  <label className="form-label text-blue-400">Copy Trade Target (ก๊อปปี้เทรดจาก)</label>
                  <select className="filter-select" value={formData.copy_target_id}
                    onChange={e => setFormData(p => ({ ...p, copy_target_id: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px' }}>
                    <option value="">-- ไม่ก๊อปปี้ใคร --</option>
                    {accounts.filter(a => a.is_master && a.id !== editId).map(a => (
                      <option key={a.id} value={a.id}>{a.account_name} (#{a.account_number})</option>
                    ))}
                  </select>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Accounts grouped by broker */}
        {Object.entries(grouped).map(([brokerName, group]) => {
          const accs = group.accs;
          return (
          <div key={brokerName} className="settings-section">
            <h3 className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BrokerLogo brokerName={group.broker_name || brokerName} size={32} />
              <span>{brokerName}</span>
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                ({accs.length} บัญชี)
              </span>
            </h3>

            {accs.map(acc => (
              <div key={acc.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
                <div className="settings-row" style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'minmax(120px, 1.5fr) minmax(40px, 0.4fr) minmax(80px, 0.8fr) minmax(80px, 0.8fr) minmax(90px, 0.8fr) auto', 
                  gap: '12px', 
                  alignItems: 'center',
                  minHeight: '48px',
                  padding: 0,
                  border: 'none',
                  background: 'none'
                }}>
                <div style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BrokerLogo brokerName={group.broker_name || brokerName} size={22} />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{acc.account_name || '-'}</span>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>#{acc.account_number}</div>
                  </div>
                </div>

                <div>
                  <span style={{ fontWeight: 500, fontSize: 12 }}>{acc.currency || 'USD'}</span>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>สกุล</div>
                </div>
                <div>
                  <span className="font-mono" style={{ fontWeight: 600, fontSize: 12 }}>{formatCurrency(acc.balance)}</span>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Balance</div>
                </div>
                <div>
                  <span className="font-mono" style={{ fontWeight: 600, fontSize: 12 }}>{formatCurrency(acc.equity)}</span>
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
              
              {acc.bridge_token && (
                  <div style={{ marginTop: '0px', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--text-secondary)' }}>
                       <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>EA Bridge Token:</span>
                       <code style={{ background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px', userSelect: 'all' }}>{acc.bridge_token}</code>
                    </div>
                  </div>
              )}
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
