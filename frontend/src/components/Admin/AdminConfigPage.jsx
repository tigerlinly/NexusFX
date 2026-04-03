import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import {
  Shield, Settings, CreditCard, Server, GitBranch, Activity,
  BarChart3, Bell, Handshake, Lock, Save, Eye, EyeOff, RefreshCw,
  CheckCircle, AlertTriangle, ChevronRight
} from 'lucide-react';

const CATEGORY_META = {
  payment: {
    label: 'ช่องทางชำระเงิน',
    sublabel: 'Payment Gateway',
    icon: CreditCard,
    color: '#00c896',
    desc: 'ตั้งค่า Stripe, Crypto, PromptPay, บัญชีธนาคาร'
  },
  infrastructure: {
    label: 'โครงสร้างพื้นฐาน',
    sublabel: 'Infrastructure',
    icon: Server,
    color: '#6c5ce7',
    desc: 'SSL, CloudFlare, CDN, Nginx, Backup'
  },
  cicd: {
    label: 'CI/CD Pipeline',
    sublabel: 'Deployment',
    icon: GitBranch,
    color: '#fdcb6e',
    desc: 'GitHub Actions, Docker Registry, Auto Deploy'
  },
  monitoring: {
    label: 'ระบบตรวจสอบ',
    sublabel: 'Monitoring',
    icon: Activity,
    color: '#e17055',
    desc: 'Prometheus, Grafana, Sentry, Health Check'
  },
  trading: {
    label: 'เครื่องมือเทรด',
    sublabel: 'Trading Engine',
    icon: BarChart3,
    color: '#0984e3',
    desc: 'Risk Limits, Execution Mode, Sync Intervals'
  },
  notification: {
    label: 'การแจ้งเตือน',
    sublabel: 'Notification',
    icon: Bell,
    color: '#00b894',
    desc: 'SMTP, Line Notify, Telegram Bot'
  },
  b2b: {
    label: 'ระบบตัวแทน',
    sublabel: 'B2B / White-label',
    icon: Handshake,
    color: '#fab1a0',
    desc: 'Commission Rate, Team Size, Custom Domain'
  },
  security: {
    label: 'ความปลอดภัย',
    sublabel: 'Security',
    icon: Lock,
    color: '#ff7675',
    desc: 'MFA, JWT, Session, IP Whitelist, Brute Force'
  }
};

export default function AdminConfigPage() {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState('payment');
  const [configs, setConfigs] = useState([]);
  const [editedValues, setEditedValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [showSecrets, setShowSecrets] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchConfigs = useCallback(async (cat) => {
    setLoading(true);
    try {
      const data = await api.getSystemConfig(cat);
      setConfigs(data);
      setEditedValues({});
    } catch (err) {
      console.error('Config fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs(activeCategory);
  }, [activeCategory, fetchConfigs]);

  const handleChange = (key, value) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
    setSaveResult(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const toUpdate = Object.entries(editedValues).map(([key, value]) => ({ key, value }));
      if (toUpdate.length === 0) {
        setSaveResult({ type: 'info', message: 'ไม่มีการเปลี่ยนแปลง' });
        setSaving(false);
        return;
      }
      const res = await api.updateSystemConfigBulk(toUpdate);
      setSaveResult({ type: 'success', message: `✅ บันทึกสำเร็จ ${res.updated} รายการ` });
      setEditedValues({});
      fetchConfigs(activeCategory);
    } catch (err) {
      setSaveResult({ type: 'error', message: '❌ ' + (err.message || 'เกิดข้อผิดพลาด') });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(editedValues).length > 0;

  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
    return (
      <>
        <div className="header"><div className="header-left"><h1 className="page-title">ตั้งค่าระบบ</h1></div></div>
        <div className="content-area">
          <div className="chart-card" style={{ textAlign: 'center', padding: 60 }}>
            <Shield size={64} style={{ color: 'var(--loss)', marginBottom: 16 }} />
            <h2 style={{ fontWeight: 700, marginBottom: 8 }}>ไม่มีสิทธิ์เข้าถึง</h2>
            <p style={{ color: 'var(--text-tertiary)' }}>ต้องเป็น Admin เท่านั้น</p>
          </div>
        </div>
      </>
    );
  }

  const categories = Object.entries(CATEGORY_META);
  const activeMeta = CATEGORY_META[activeCategory] || {};
  const ActiveIcon = activeMeta.icon || Settings;

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={20} style={{ color: 'var(--accent-primary)' }} />
            ตั้งค่าระบบ (System Configuration)
          </h1>
        </div>
        <div className="header-right">
          {hasChanges && (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {saving ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}
              {saving ? 'กำลังบันทึก...' : `บันทึกการเปลี่ยนแปลง (${Object.keys(editedValues).length})`}
            </button>
          )}
        </div>
      </div>

      <div className="content-area">
        {saveResult && (
          <div style={{
            padding: '10px 16px', borderRadius: 'var(--radius-md)', marginBottom: 16,
            background: saveResult.type === 'success' ? 'rgba(0,200,150,0.1)' : saveResult.type === 'error' ? 'rgba(255,71,87,0.1)' : 'rgba(255,200,50,0.1)',
            color: saveResult.type === 'success' ? 'var(--profit)' : saveResult.type === 'error' ? 'var(--loss)' : 'var(--warning)',
            border: `1px solid ${saveResult.type === 'success' ? 'var(--profit)' : saveResult.type === 'error' ? 'var(--loss)' : 'var(--warning)'}`,
            fontSize: 13, display: 'flex', alignItems: 'center', gap: 8
          }}>
            {saveResult.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            {saveResult.message}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 'var(--space-lg)', minHeight: 500 }}>
          {/* Left sidebar - Categories */}
          <div className="chart-card" style={{ padding: 0, overflow: 'hidden', alignSelf: 'flex-start' }}>
            <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid var(--border-primary)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>
                หมวดหมู่ / Categories
              </div>
            </div>
            <nav style={{ padding: '4px' }}>
              {categories.map(([key, meta]) => {
                const Icon = meta.icon;
                const isActive = activeCategory === key;
                return (
                  <button
                    key={key}
                    onClick={() => { setActiveCategory(key); setEditedValues({}); setSaveResult(null); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '10px 12px', background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                      border: 'none', borderLeft: isActive ? `3px solid ${meta.color}` : '3px solid transparent',
                      cursor: 'pointer', textAlign: 'left', borderRadius: 0,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Icon size={16} style={{ color: isActive ? meta.color : 'var(--text-tertiary)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {meta.label}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{meta.sublabel}</div>
                    </div>
                    {isActive && <ChevronRight size={14} style={{ color: meta.color }} />}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right content - Config fields */}
          <div className="chart-card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Category Header */}
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid var(--border-primary)',
              background: `linear-gradient(135deg, ${activeMeta.color}11, transparent)`,
              display: 'flex', alignItems: 'center', gap: 12
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 'var(--radius-md)',
                background: `${activeMeta.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <ActiveIcon size={20} style={{ color: activeMeta.color }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{activeMeta.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{activeMeta.desc}</div>
              </div>
            </div>

            {/* Config Items */}
            <div style={{ padding: '16px 24px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                  <RefreshCw size={24} className="spin" style={{ marginBottom: 12 }} />
                  <div>กำลังโหลดค่ากำหนด...</div>
                </div>
              ) : configs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                  ไม่มีค่ากำหนดในหมวดนี้
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {configs.map(cfg => {
                    const currentValue = editedValues[cfg.key] !== undefined ? editedValues[cfg.key] : cfg.value;
                    const isEdited = editedValues[cfg.key] !== undefined;
                    const isSecret = cfg.is_secret;
                    const isRevealed = showSecrets[cfg.key];
                    
                    // Determine input type based on value patterns
                    const isBooleanish = ['true', 'false'].includes(cfg.value);
                    const isNumeric = !isNaN(cfg.value) && cfg.value !== '' && !isBooleanish;

                    return (
                      <div key={cfg.key} style={{
                        padding: '14px 16px', borderRadius: 'var(--radius-md)',
                        border: isEdited ? '1px solid var(--accent-primary)' : '1px solid var(--border-primary)',
                        background: isEdited ? 'rgba(99,179,237,0.03)' : 'var(--bg-tertiary)',
                        transition: 'border-color 0.2s'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 600 }}>
                              {cfg.key}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                              {cfg.description}
                            </div>
                          </div>
                          {isSecret && (
                            <button
                              className="btn btn-ghost btn-icon"
                              style={{ width: 28, height: 28 }}
                              onClick={() => setShowSecrets(prev => ({ ...prev, [cfg.key]: !prev[cfg.key] }))}
                              title={isRevealed ? 'ซ่อนค่า' : 'แสดงค่า'}
                            >
                              {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          )}
                        </div>

                        {isBooleanish ? (
                          <div style={{ display: 'flex', gap: 8 }}>
                            {['true', 'false'].map(val => (
                              <button
                                key={val}
                                onClick={() => handleChange(cfg.key, val)}
                                style={{
                                  padding: '6px 16px', borderRadius: 'var(--radius-sm)',
                                  border: currentValue === val ? `2px solid ${val === 'true' ? 'var(--profit)' : 'var(--loss)'}` : '1px solid var(--border-primary)',
                                  background: currentValue === val ? (val === 'true' ? 'rgba(0,200,150,0.1)' : 'rgba(255,71,87,0.1)') : 'transparent',
                                  color: currentValue === val ? (val === 'true' ? 'var(--profit)' : 'var(--loss)') : 'var(--text-secondary)',
                                  cursor: 'pointer', fontWeight: currentValue === val ? 600 : 400, fontSize: 13
                                }}
                              >
                                {val === 'true' ? 'เปิด (ON)' : 'ปิด (OFF)'}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div style={{ position: 'relative' }}>
                            <input
                              className="form-input"
                              type={isSecret && !isRevealed ? 'password' : isNumeric ? 'text' : 'text'}
                              value={currentValue || ''}
                              onChange={e => handleChange(cfg.key, e.target.value)}
                              placeholder={cfg.description || 'กรอกค่า...'}
                              style={{
                                width: '100%', fontFamily: 'var(--font-mono)', fontSize: 13,
                                background: 'var(--bg-secondary)',
                                paddingRight: isEdited ? 80 : 12
                              }}
                            />
                            {isEdited && (
                              <span style={{
                                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                fontSize: 10, color: 'var(--accent-primary)', fontWeight: 600,
                                background: 'rgba(99,179,237,0.15)', padding: '2px 8px', borderRadius: 'var(--radius-sm)'
                              }}>
                                แก้ไขแล้ว
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer with save button */}
            {hasChanges && (
              <div style={{
                padding: '16px 24px', borderTop: '1px solid var(--border-primary)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(99,179,237,0.03)'
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  มี {Object.keys(editedValues).length} รายการที่แก้ไข
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setEditedValues({}); setSaveResult(null); }}>
                    ยกเลิก
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {saving ? <RefreshCw size={12} className="spin" /> : <Save size={12} />}
                    {saving ? 'กำลังบันทึก...' : 'บันทึกทั้งหมด'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
