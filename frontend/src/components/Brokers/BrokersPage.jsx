import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import ConfirmDialog from '../Layout/ConfirmDialog';
import { ShieldCheck, Globe, Star, ExternalLink, Award, CheckCircle2, Plus, Edit2, Trash2, X } from 'lucide-react';

export default function BrokersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  
  const [brokers, setBrokers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBroker, setEditingBroker] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '', display_name: '', market_type: 'Forex', protocol: 'MT5',
    regulation: '', country: '', website: '', max_leverage: '',
    min_deposit: 0, spread_from: '', platforms: 'MT4, MT5',
    rating: 0, description: '', logo_url: ''
  });
  const [confirmDialog, setConfirmDialog] = useState({ open: false });

  const showConfirm = (message, onConfirm, options = {}) => {
    setConfirmDialog({ open: true, message, onConfirm, ...options });
  };
  const closeConfirm = () => setConfirmDialog({ open: false });

  useEffect(() => {
    fetchBrokers();
  }, []);

  const fetchBrokers = async () => {
    try {
      const data = await api.getBrokers();
      setBrokers(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingBroker(null);
    setFormData({
      name: '', display_name: '', market_type: 'Forex', protocol: 'MT5',
      regulation: '', country: '', website: '', max_leverage: '',
      min_deposit: 0, spread_from: '', platforms: 'MT4, MT5',
      rating: 0, description: '', logo_url: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (broker) => {
    setEditingBroker(broker);
    setFormData({
      name: broker.name || '',
      display_name: broker.display_name || '',
      market_type: broker.market_type || 'Forex',
      protocol: broker.protocol || 'MT5',
      regulation: broker.regulation || '',
      country: broker.country || '',
      website: broker.website || '',
      max_leverage: broker.max_leverage || '',
      min_deposit: broker.min_deposit || 0,
      spread_from: broker.spread_from || '',
      platforms: broker.platforms || 'MT4, MT5',
      rating: broker.rating || 0,
      description: broker.description || '',
      logo_url: broker.logo_url || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id, name) => {
    showConfirm(
      `ต้องการลบโบรกเกอร์ “${name}” ออกจากระบบหรือไม่? ข้อมูลทั้งหมดจะหายไปและไม่สามารถกู้คืนได้`,
      async () => {
        closeConfirm();
        try {
          await api.deleteBroker(id);
          setBrokers(brokers.filter(b => b.id !== id));
        } catch (err) {
          alert(err.message);
        }
      },
      { title: 'ยืนยันการลบโบรกเกอร์', confirmText: 'ลบเลย', variant: 'danger' }
    );
  };

  const handleToggleActive = async (broker) => {
    try {
      const updated = await api.updateBroker(broker.id, { ...broker, is_active: !broker.is_active });
      setBrokers(brokers.map(b => b.id === updated.id ? { ...b, is_active: updated.is_active } : b));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleAllowTeam = async (broker) => {
    try {
      await api.allowBrokerForTeam({ broker_id: broker.id, is_allowed: !broker.is_allowed_for_team });
      setBrokers(brokers.map(b => b.id === broker.id ? { ...b, is_allowed_for_team: !broker.is_allowed_for_team } : b));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingBroker) {
        const updated = await api.updateBroker(editingBroker.id, formData);
        setBrokers(brokers.map(b => b.id === updated.id ? updated : b));
      } else {
        const created = await api.createBroker(formData);
        setBrokers([...brokers, created]);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Star key={i} size={14} fill="#FFD700" color="#FFD700" />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<Star key={i} size={14} fill="currentColor" color="#FFD700" style={{ opacity: 0.5 }} />);
      } else {
        stars.push(<Star key={i} size={14} color="var(--border-primary)" />);
      }
    }
    return <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>{stars} <span style={{ marginLeft: 4, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{rating}</span></div>;
  };

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
      'fxgt.com': { url: '/logos/fxgt.png', abbr: 'FX', color: '#00A1E0', bg: '#001A24' },
    };

    for (const [key, data] of Object.entries(brokerLogos)) {
      if (name.includes(key)) return data;
    }
    const abbr = (brokerName || 'BR').substring(0, 2).toUpperCase();
    return { url: null, abbr, color: '#90A4AE', bg: '#1A2433' };
  };

  const BrokerLogo = ({ brokerName, dbLogoUrl, size = 64 }) => {
    const [imgError, setImgError] = useState(false);
    const logoData = getBrokerLogo(brokerName);
    // Always use local logo first, DB logo as last resort
    const finalUrl = logoData.url || dbLogoUrl;
    
    if (finalUrl && !imgError) {
      return (
        <div style={{
          width: size, height: size, borderRadius: 12, overflow: 'hidden',
          backgroundColor: logoData.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${logoData.color}40`, padding: 4, flexShrink: 0
        }}>
          <img 
            src={finalUrl} 
            alt={brokerName}
            style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8 }}
            onError={() => setImgError(true)}
          />
        </div>
      );
    }

    return (
      <div style={{
        width: size, height: size, borderRadius: 12,
        backgroundColor: logoData.bg, color: logoData.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.4, fontWeight: 800, letterSpacing: '-0.5px',
        border: `1px solid ${logoData.color}40`, flexShrink: 0
      }}>
        {logoData.abbr}
      </div>
    );
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>กำลังโหลดรายชื่อโบรกเกอร์...</div>;
  }

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={24} style={{ color: 'var(--accent-primary)' }} />
            โบรกเกอร์ที่ได้รับการรับรอง
          </h1>
        </div>
        {isAdmin && (
          <div className="header-right">
            <button className="btn btn-primary" onClick={handleOpenAdd}>
              <Plus size={16} /> เพิ่มโบรกเกอร์ใหม่
            </button>
          </div>
        )}
      </div>

      {error ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--loss)' }}>{error}</div>
      ) : (
        <div className="content-area">
          <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, rgba(0, 210, 165, 0.1), rgba(0, 150, 200, 0.05))', border: '1px solid var(--accent-primary)', padding: '24px 32px' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <ShieldCheck size={32} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>มาตราฐานความปลอดภัยระดับสากล</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 14 }}>
                  รายชื่อโบรกเกอร์ทั้งหมดในแพลตฟอร์มของเราได้รับการคัดเลือกและตรวจสอบใบอนุญาต (Regulation) จากหน่วยงานที่น่าเชื่อถือระดับโลก (FCA, ASIC, CySEC) เพื่อให้คุณมั่นใจในความปลอดภัยของเงินทุนและการส่งคำสั่งเทรดที่โปร่งใส การผูกบัญชี MT5 เข้ากับ NexusFX สามารถใช้ได้กับทุกโบรกเกอร์ในรายการนี้
                </p>
              </div>
            </div>
          </div>

          {brokers.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
              ยังไม่มีข้อมูลโบรกเกอร์ในระบบ
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 24 }}>
              {brokers.map((broker) => (
                <div key={broker.id} className="card hover-glow" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: 24, borderBottom: '1px solid var(--border-primary)' }}>
                    {/* Row 1: Logo + Name + Active Badge + Edit + Delete */}
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
                      <BrokerLogo brokerName={broker.name} dbLogoUrl={broker.logo_url} size={64} />
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>{broker.display_name}</h3>
                      
                      {isAdmin && (
                        <>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleOpenEdit(broker)} title="แก้ไข">
                            <Edit2 size={16} />
                          </button>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(broker.id, broker.name)} style={{ color: 'var(--loss)' }} title="ลบ">
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}

                      {!isAdmin && broker.rating >= 4.5 && !broker.is_lead && (
                        <div style={{ background: 'rgba(255, 215, 0, 0.1)', color: '#FFD700', padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Award size={12} /> TOP
                        </div>
                      )}
                    </div>

                    {/* Row 2: Stars + Data Status + Active Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 80 }}>
                      {renderStars(Number(broker.rating) || 0)}
                      
                      {isAdmin && (
                        <>
                          {broker.has_data ? (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                              🟢 พร้อมเทรด
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
                              🟠 รอข้อมูล Data
                            </span>
                          )}
                          <button onClick={() => handleToggleActive(broker)}
                            className={`btn btn-sm ${broker.is_active ? 'btn-primary' : 'btn-outline'}`}
                            style={{ fontSize: 11, padding: '2px 8px', height: 'auto', minHeight: 0 }}
                          >
                            {broker.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </>
                      )}

                      {broker.is_lead && (
                        <button onClick={() => handleToggleAllowTeam(broker)}
                          className={`btn btn-sm ${broker.is_allowed_for_team ? 'btn-primary' : 'btn-outline'}`}
                          style={{ fontSize: 11, padding: '4px 12px', height: 'auto', minHeight: 0 }}
                        >
                          {broker.is_allowed_for_team ? '✅ อนุญาตสำหรับกลุ่ม' : '❌ ปิดกั้นสำหรับกลุ่ม'}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6, flex: 1 }}>
                      {broker.description || 'ไม่มีคำอธิบาย'}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                      <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>ประเทศ/สำนักงาน</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{broker.country || '-'}</div>
                      </div>
                      <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Leverage สูงสุด</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{broker.max_leverage || '-'}</div>
                      </div>
                      <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>ฝากขั้นต่ำ (Min. Deposit)</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>${broker.min_deposit || '0'}</div>
                      </div>
                      <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>เริ่มต้น Spread</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{broker.spread_from || '-'}</div>
                      </div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>ใบอนุญาตกำกับดูแล (Regulation)</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(broker.regulation || 'None').split(',').map(reg => (
                          <span key={reg} className="badge badge-buy" style={{ fontSize: 10, padding: '4px 8px' }}><CheckCircle2 size={10} style={{ marginRight: 4 }} /> {reg.trim()}</span>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>แพลตฟอร์มรองรับ</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{broker.platforms || 'MT4, MT5'}</div>
                    </div>

                    <a 
                      href={broker.website} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center', display: 'flex', gap: 8 }}
                    >
                      <ExternalLink size={16} /> สมัครสมาชิกบัญชีเทรด
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2>{editingBroker ? 'แก้ไขโบรกเกอร์' : 'เพิ่มโบรกเกอร์ใหม่'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>รหัสโบรกเกอร์ (Name) *</label>
                  <input type="text" className="form-control" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="เช่น ICMarkets" disabled={!!editingBroker} />
                </div>
                <div className="form-group">
                  <label>ชื่อแสดงผล (Display Name) *</label>
                  <input type="text" className="form-control" required value={formData.display_name} onChange={e => setFormData({...formData, display_name: e.target.value})} placeholder="เช่น IC Markets Global" />
                </div>
                <div className="form-group">
                  <label>ประเทศ (Country)</label>
                  <input type="text" className="form-control" value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} placeholder="เช่น Australia" />
                </div>
                <div className="form-group">
                  <label>เว็บไซต์ลิงก์ (Website URL)</label>
                  <input type="url" className="form-control" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} placeholder="https://..." />
                </div>
                <div className="form-group">
                  <label>เรตติ้ง (Rating 1-5)</label>
                  <input type="number" step="0.1" min="1" max="5" className="form-control" value={formData.rating} onChange={e => setFormData({...formData, rating: parseFloat(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label>ฝากขั้นต่ำ (Min Deposit $)</label>
                  <input type="number" className="form-control" value={formData.min_deposit} onChange={e => setFormData({...formData, min_deposit: parseFloat(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label>Leverage สูงสุด</label>
                  <input type="text" className="form-control" value={formData.max_leverage} onChange={e => setFormData({...formData, max_leverage: e.target.value})} placeholder="เช่น 1:500" />
                </div>
                <div className="form-group">
                  <label>เริ่มต้น Spread</label>
                  <input type="text" className="form-control" value={formData.spread_from} onChange={e => setFormData({...formData, spread_from: e.target.value})} placeholder="เช่น 0.0 pips" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>ใบอนุญาต (Regulation)</label>
                  <input type="text" className="form-control" value={formData.regulation} onChange={e => setFormData({...formData, regulation: e.target.value})} placeholder="เช่น ASIC (Australia), CySEC (Cyprus)" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>แพลตฟอร์ม (Platforms)</label>
                  <input type="text" className="form-control" value={formData.platforms} onChange={e => setFormData({...formData, platforms: e.target.value})} placeholder="เช่น MT4, MT5, cTrader" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>ลิงก์ Logo URL</label>
                  <input type="url" className="form-control" value={formData.logo_url} onChange={e => setFormData({...formData, logo_url: e.target.value})} placeholder="https://..." />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>คำอธิบายโบรกเกอร์ (Description)</label>
                  <textarea className="form-control" rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: 24 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
                  ยกเลิก
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.confirmText}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirm}
      />
    </>
  );
}
