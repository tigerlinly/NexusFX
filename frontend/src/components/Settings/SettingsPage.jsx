import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Palette, Bell, Globe, Moon, Save, Eye, EyeOff, Key, Shield, Copy, Check, Clock, Plus, Trash2 } from 'lucide-react';
import { api } from '../../utils/api';

export default function SettingsPage() {
  const { currentTheme, changeTheme, themes } = useTheme();
  const [activeTab, setActiveTab] = useState('theme');
  const [activeCustomTab, setActiveCustomTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [copiedField, setCopiedField] = useState('');

  const resetCustomColors = () => {
    const keys = [
      'custom-text-color', 'custom-font-size', 'custom-bg-app',
      'custom-bg-header', 'custom-font-size-header',
      'custom-bg-sidebar', 'custom-font-size-sidebar',
      'custom-bg-content', 'custom-font-size-content'
    ];
    setSettings(prev => ({ ...prev, custom_colors: {} }));
    keys.forEach(k => document.documentElement.style.removeProperty(`--${k}`));
    localStorage.removeItem('nexusfx_custom_colors');
    api.updateSettings({ custom_colors: {} }).catch(console.error);
  };

  const handleCopy = async (field) => {
    const value = settings[field] || settings[`${field}_actual`];
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // MFA State
  const [mfaStatus, setMfaStatus] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [passwordForMfa, setPasswordForMfa] = useState('');

  // Form State
  const [settings, setSettings] = useState({
    theme_id: currentTheme || 'dark-trading',
    notifications_enabled: true,
    sound_enabled: true,
    notify_new_trade: false,
    metaapi_token: '',
    auto_sync: true,
    language: 'th',
    timezone: 'Asia/Bangkok',
    binance_api_key: '',
    binance_api_secret: '',
    twelvedata_api_key: '',
    line_notify_token: '',
    telegram_bot_token: '',
    telegram_chat_id: '',
    sync_schedules: ['07:00'],
    custom_colors: {}
  });

  useEffect(() => {
    fetchSettings();
    checkMfaStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkMfaStatus = async () => {
    try {
      const { mfa_enabled } = await api.getMFAStatus();
      setMfaStatus(mfa_enabled);
    } catch (err) {
      console.error('Failed to get MFA status', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const data = await api.getSettings();
      // Load actual decrypted values from backend (for display & copy)
      setSettings({
        theme_id: data.theme_id || currentTheme || 'dark-trading',
        notifications_enabled: data.notifications_enabled ?? true,
        sound_enabled: data.sound_enabled ?? true,
        notify_new_trade: data.notify_new_trade ?? false,
        metaapi_token: data.metaapi_token_actual || '',
        auto_sync: data.auto_sync ?? true,
        language: data.language || 'th',
        timezone: data.timezone || 'Asia/Bangkok',
        binance_api_key: data.binance_api_key_actual || '',
        binance_api_secret: data.binance_api_secret_actual || '',
        twelvedata_api_key: data.twelvedata_api_key_actual || '',
        line_notify_token: data.line_notify_token_actual || '',
        telegram_bot_token: data.telegram_bot_token_actual || '',
        telegram_chat_id: data.telegram_chat_id || '',
        sync_schedules: data.sync_schedules || ['07:00'],
        custom_colors: data.custom_colors || {}
      });
      if (data.theme_id && data.theme_id !== currentTheme) {
        changeTheme(data.theme_id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLocalUpdate = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleAddSchedule = () => {
    setSettings(prev => {
      const s = prev.sync_schedules ? [...prev.sync_schedules, '12:00'] : ['07:00', '12:00'];
      return { ...prev, sync_schedules: s.sort() };
    });
  };

  const handleUpdateSchedule = (index, value) => {
    setSettings(prev => {
      const newSchedules = [...(prev.sync_schedules || [])];
      newSchedules[index] = value;
      return { ...prev, sync_schedules: newSchedules.sort() };
    });
  };

  const handleRemoveSchedule = (index) => {
    setSettings(prev => {
      const newSchedules = (prev.sync_schedules || []).filter((_, i) => i !== index);
      return { ...prev, sync_schedules: newSchedules };
    });
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      // Validation for custom colors
      const sanitizedColors = {};
      if (settings.custom_colors) {
        for (const [key, val] of Object.entries(settings.custom_colors)) {
          if (!val) continue;
          if (key.includes('font-size')) {
             if (/^\d+(px|rem|em|%)$/.test(val)) sanitizedColors[key] = val;
          } else {
             if (/^#([0-9a-fA-F]{3}){1,2}$/.test(val) || val.startsWith('rgba') || val.startsWith('hsl')) {
               sanitizedColors[key] = val;
             }
          }
        }
      }

      const payload = {
        theme_id: settings.theme_id || currentTheme,
        notifications_enabled: settings.notifications_enabled,
        sound_enabled: settings.sound_enabled,
        notify_new_trade: settings.notify_new_trade,
        auto_sync: settings.auto_sync,
        language: settings.language,
        timezone: settings.timezone,
        telegram_chat_id: settings.telegram_chat_id,
        sync_schedules: settings.sync_schedules,
        custom_colors: sanitizedColors,
      };

      // Always include API keys so they re-encrypt correctly
      if (settings.metaapi_token) payload.metaapi_token = settings.metaapi_token;
      if (settings.binance_api_key) payload.binance_api_key = settings.binance_api_key;
      if (settings.binance_api_secret) payload.binance_api_secret = settings.binance_api_secret;
      if (settings.twelvedata_api_key) payload.twelvedata_api_key = settings.twelvedata_api_key;
      if (settings.line_notify_token) payload.line_notify_token = settings.line_notify_token;
      if (settings.telegram_bot_token) payload.telegram_bot_token = settings.telegram_bot_token;

      await api.updateSettings(payload);
      alert('บันทึกการตั้งค่าเรียบร้อยแล้ว');
      fetchSettings();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'theme', label: 'ธีมสี', icon: Palette },
    { id: 'notifications', label: 'การแจ้งเตือน', icon: Bell },
    { id: 'schedule', label: 'ตั้งเวลาอัพเดท', icon: Clock },
    { id: 'security', label: 'ความปลอดภัย', icon: Shield },
    { id: 'general', label: 'ทั่วไป', icon: Moon }
  ];

  const handleSetupMFA = async () => {
    try {
      const data = await api.setupMFA();
      setMfaSetupData(data);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleVerifyMFA = async () => {
    try {
      if (!mfaCode) return alert('กรุณากรอกรหัส 6 หลัก');
      const data = await api.verifyMFA({ code: mfaCode });
      alert(data.message);
      setMfaStatus(true);
      setMfaSetupData(null);
      setMfaCode('');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDisableMFA = async () => {
    try {
      if (!passwordForMfa && !mfaCode) return alert('กรุณากรอกรหัส 2FA หรือรหัสผ่านเพื่อปิดใช้งาน');
      const data = await api.disableMFA({ code: mfaCode, password: passwordForMfa });
      alert(data.message);
      setMfaStatus(false);
      setMfaCode('');
      setPasswordForMfa('');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTestLineNotify = async () => {
    try {
      await api.testLineNotify();
      alert('ส่งแจ้งเตือนทดสอบสำเร็จ กรุณาตรวจสอบ LINE ของคุณ');
    } catch {
      alert('ส่งแจ้งเตือนล้มเหลว ตรวจสอบว่าใส่ Token ถูกต้องและกดบันทึกแล้วหรือยัง');
    }
  };

  const handleTestTelegram = async () => {
    try {
      await api.testTelegram();
      alert('ส่งแจ้งเตือนทดสอบสำเร็จ กรุณาตรวจสอบ Telegram ของคุณ');
    } catch {
      alert('ส่งแจ้งเตือนล้มเหลว ตรวจสอบว่าใส่ Token/Chat ID ถูกต้องและกดบันทึกแล้วหรือยัง');
    }
  };

  if (loading) return null;

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title">ตั้งค่าส่วนตัว (Personal Settings)</h1>
        </div>
      </div>

      <div className="content-area">
        <div className="settings-section" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Internal Tabs Navigation replacing Section Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-primary)', padding: '0 16px 0 8px', background: 'rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex' }}>
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '16px 20px',
                      background: 'transparent',
                      color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      border: 'none',
                      borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                      cursor: 'pointer',
                      fontWeight: isActive ? 600 : 500,
                      transition: 'all 0.2s ease',
                      fontSize: '15px',
                      marginBottom: '-1px'
                    }}
                  >
                    <Icon size={18} />
                    {tab.label}
                  </button>
                )
              })}
            </div>
            <div>
              <button 
                className="btn btn-primary btn-sm" 
                onClick={handleSaveAll}
                disabled={isSaving}
              >
                <Save size={14} /> {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>

          <div style={{ padding: 'var(--space-2xl)' }}>
            {/* Theme Selector */}
            {activeTab === 'theme' && (
              <div>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 'var(--space-lg)' }}>
                  เลือกธีมสีที่ต้องการ — อย่าลืมกด "บันทึก" เพื่อยืนยันการเปลี่ยนแปลง
                </p>

                <div className="theme-grid">
                  {themes.map(theme => (
                    <div
                      key={theme.id}
                      className={`theme-card ${currentTheme === theme.id ? 'active' : ''}`}
                      onClick={() => {
                        changeTheme(theme.id);
                        handleLocalUpdate('theme_id', theme.id);
                        resetCustomColors();
                      }}
                    >
                      <div className="theme-preview">
                        {theme.colors.map((color, i) => (
                          <div key={i} className="theme-preview-stripe" style={{ background: color }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="card" style={{ marginTop: 'var(--space-2xl)', background: 'var(--bg-tertiary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                    <h3 style={{ fontSize: 16 }}>การปรับแต่งธีมขั้นสูง (Advanced Customization)</h3>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={resetCustomColors}
                      title="คืนค่ากลับเป็นค่าตั้งต้นของธีม"
                    >
                      Reset Default
                    </button>
                  </div>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 'var(--space-lg)' }}>
                    ตัวเลือกเหล่านี้จะถูกนำไปแทนที่สีและขนาดของธีมหลัก คุณสามารถปรับจูนได้ตามต้องการ
                  </p>

                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', marginBottom: 'var(--space-lg)', overflowX: 'auto' }}>
                    {[
                      {
                        category: 'แอปพลิเคชัน (General App)',
                        items: [
                          { key: 'custom-text-color', label: 'สีตัวอักษร (Text Color)', type: 'color' },
                          { key: 'custom-font-size', label: 'ขนาดตัวอักษรหลัก', type: 'select', options: ['11px', '12px', '13px', '14px', '15px', '16px', '18px', '20px'] },
                          { key: 'custom-bg-app', label: 'สีพื้นหลังหลัก (App)', type: 'color' },
                        ]
                      },
                      {
                        category: 'แถบด้านบน (Headbar)',
                        items: [
                          { key: 'custom-bg-header', label: 'สีพื้น Headbar', type: 'color' },
                          { key: 'custom-font-size-header', label: 'ขนาดอักษร Header', type: 'select', options: ['11px', '12px', '13px', '14px', '15px', '16px', '18px', '20px'] }
                        ]
                      },
                      {
                        category: 'แถบด้านข้าง (Sidebar)',
                        items: [
                          { key: 'custom-bg-sidebar', label: 'สีพื้น Sidebar', type: 'color' },
                          { key: 'custom-font-size-sidebar', label: 'ขนาดอักษร Sidebar', type: 'select', options: ['11px', '12px', '13px', '14px', '15px', '16px', '18px', '20px'] }
                        ]
                      },
                      {
                        category: 'พื้นที่เนื้อหา (Content Area)',
                        items: [
                          { key: 'custom-bg-content', label: 'สีพื้น Content', type: 'color' },
                          { key: 'custom-font-size-content', label: 'ขนาดอักษร Content', type: 'select', options: ['11px', '12px', '13px', '14px', '15px', '16px', '18px', '20px'] }
                        ]
                      }
                    ].map((group, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveCustomTab(idx)}
                        style={{
                          padding: '12px 16px',
                          background: 'transparent',
                          color: activeCustomTab === idx ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          border: 'none',
                          borderBottom: activeCustomTab === idx ? '2px solid var(--accent-primary)' : '2px solid transparent',
                          cursor: 'pointer',
                          fontWeight: activeCustomTab === idx ? 600 : 500,
                          fontSize: '13px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {group.category}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-lg)' }}>
                    {[
                      {
                        category: 'แอปพลิเคชัน (General App)',
                        items: [
                          { key: 'custom-text-color', label: 'สีตัวอักษร (Text Color)', type: 'color' },
                          { key: 'custom-font-size', label: 'ขนาดตัวอักษรหลัก', type: 'select', options: ['11px', '12px', '13px', '14px', '15px', '16px', '18px', '20px'] },
                          { key: 'custom-bg-app', label: 'สีพื้นหลังหลัก (App)', type: 'color' },
                        ]
                      },
                      {
                        category: 'แถบด้านบน (Headbar)',
                        items: [
                          { key: 'custom-bg-header', label: 'สีพื้น Headbar', type: 'color' },
                          { key: 'custom-font-size-header', label: 'ขนาดอักษร Header', type: 'select', options: ['11px', '12px', '13px', '14px', '15px', '16px', '18px', '20px'] }
                        ]
                      },
                      {
                        category: 'แถบด้านข้าง (Sidebar)',
                        items: [
                          { key: 'custom-bg-sidebar', label: 'สีพื้น Sidebar', type: 'color' },
                          { key: 'custom-font-size-sidebar', label: 'ขนาดอักษร Sidebar', type: 'select', options: ['11px', '12px', '13px', '14px', '15px', '16px', '18px', '20px'] }
                        ]
                      },
                      {
                        category: 'พื้นที่เนื้อหา (Content Area)',
                        items: [
                          { key: 'custom-bg-content', label: 'สีพื้น Content', type: 'color' },
                          { key: 'custom-font-size-content', label: 'ขนาดอักษร Content', type: 'select', options: ['11px', '12px', '13px', '14px', '15px', '16px', '18px', '20px'] }
                        ]
                      }
                    ][activeCustomTab].items.map((item) => (
                      <div key={item.key}>
                        <label className="form-label" style={{ fontSize: 12 }}>{item.label}</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {item.type === 'select' ? (
                            <select
                              className="form-input"
                              value={(settings.custom_colors && settings.custom_colors[item.key]) || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleLocalUpdate('custom_colors', { ...(settings.custom_colors || {}), [item.key]: val });
                                if (val) {
                                  document.documentElement.style.setProperty(`--${item.key}`, val);
                                } else {
                                  document.documentElement.style.removeProperty(`--${item.key}`);
                                }
                              }}
                            >
                              <option value="">-- ค่าเริ่มต้น (Default) --</option>
                              {item.options.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={item.type}
                              className="form-input"
                              style={item.type === 'color' ? { padding: 4, height: 38, cursor: 'pointer' } : {}}
                              placeholder={item.placeholder || ''}
                              value={(settings.custom_colors && settings.custom_colors[item.key]) || ''}
                              onChange={(e) => {
                                 const val = e.target.value;
                                 handleLocalUpdate('custom_colors', { ...(settings.custom_colors || {}), [item.key]: val });
                                 if (val) {
                                   document.documentElement.style.setProperty(`--${item.key}`, val);
                                 } else {
                                   document.documentElement.style.removeProperty(`--${item.key}`);
                                 }
                              }}
                            />
                          )}
                          {settings.custom_colors && settings.custom_colors[item.key] && (
                            <button 
                              className="btn btn-secondary btn-icon" 
                              title="ล้างค่า"
                              onClick={() => {
                                const newCustom = { ...settings.custom_colors };
                                delete newCustom[item.key];
                                handleLocalUpdate('custom_colors', newCustom);
                                document.documentElement.style.removeProperty(`--${item.key}`);
                              }}>
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Notifications */}
            {activeTab === 'notifications' && (
              <div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">แจ้งเตือนเมื่อถึงเป้ากำไร</div>
                    <div className="settings-desc">เปิดแจ้งเตือนเมื่อกำไรรายวันถึงเป้าที่ตั้งไว้</div>
                  </div>
                  <div 
                    className={`toggle ${settings.notifications_enabled ? 'active' : ''}`} 
                    onClick={() => handleLocalUpdate('notifications_enabled', !settings.notifications_enabled)} 
                  />
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">เสียงแจ้งเตือน</div>
                    <div className="settings-desc">เปิดเสียงเมื่อมีการแจ้งเตือน</div>
                  </div>
                  <div 
                    className={`toggle ${settings.sound_enabled ? 'active' : ''}`} 
                    onClick={() => handleLocalUpdate('sound_enabled', !settings.sound_enabled)} 
                  />
                </div>
                <div className="settings-row" style={{ borderBottom: 'none' }}>
                  <div>
                    <div className="settings-label">แจ้งเตือนการเทรดใหม่</div>
                    <div className="settings-desc">แจ้งเตือนเมื่อมีการเปิด/ปิดออเดอร์ใหม่</div>
                  </div>
                  <div 
                    className={`toggle ${settings.notify_new_trade ? 'active' : ''}`} 
                    onClick={() => handleLocalUpdate('notify_new_trade', !settings.notify_new_trade)} 
                  />
                </div>

                <div style={{ marginTop: 'var(--space-2xl)' }}>
                  <h3 style={{ marginBottom: 'var(--space-md)', fontSize: 15, fontWeight: 600 }}>เชื่อมต่อการแจ้งเตือนภายนอก</h3>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 'var(--space-lg)' }}>
                    เชื่อมต่อช่องทางการแจ้งเตือนไปยังแอปพลิเคชันภายนอก (LINE Notify, Telegram)
                  </p>

                  {/* Line Notify Token */}
                  <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '12px' }}>
                      <div className="settings-label" style={{ marginBottom: 0 }}>Line Notify Token</div>
                      <div className="settings-desc" style={{ marginTop: 0 }}>
                        ยิงแจ้งเตือนการเทรดผ่าน LINE — <a href="https://notify-bot.line.me/my/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>รับ Token ที่นี่</a>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input
                          className="form-input"
                          type={showToken ? 'text' : 'password'}
                          placeholder="ใส่ Line Notify Token"
                          style={{ width: '100%', paddingRight: '80px' }}
                          value={settings.line_notify_token}
                          onChange={(e) => handleLocalUpdate('line_notify_token', e.target.value)}
                        />
                        <div style={{ position: 'absolute', right: '4px', top: '4px', display: 'flex', gap: '2px' }}>
                          <button className="btn btn-ghost btn-icon" onClick={() => setShowToken(!showToken)} title={showToken ? 'ซ่อน' : 'แสดง'}>
                            {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                          {settings.line_notify_token && (
                            <button className="btn btn-ghost btn-icon" onClick={() => handleCopy('line_notify_token')} title="คัดลอก" style={{ color: copiedField === 'line_notify_token' ? 'var(--profit)' : undefined }}>
                              {copiedField === 'line_notify_token' ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                          )}
                        </div>
                      </div>
                      <button onClick={handleTestLineNotify} className="btn-secondary" style={{ whiteSpace: 'nowrap' }}>
                        ทดสอบการส่ง
                      </button>
                    </div>
                  </div>

                  {/* Telegram Bot Token & Chat ID */}
                  <div className="settings-row" style={{ borderBottom: 'none', flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '12px' }}>
                      <div className="settings-label" style={{ marginBottom: 0 }}>Telegram Notifications</div>
                      <div className="settings-desc" style={{ marginTop: 0 }}>
                        ยิงแจ้งเตือนการเทรดผ่าน Telegram (สร้าง Bot ด้วย @BotFather)
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <label className="form-label" style={{ fontSize: 12 }}>Bot Token</label>
                        <input
                          className="form-input"
                          type={showToken ? 'text' : 'password'}
                          placeholder="123456789:ABCDEF..."
                          style={{ width: '100%', paddingRight: '80px' }}
                          value={settings.telegram_bot_token}
                          onChange={(e) => handleLocalUpdate('telegram_bot_token', e.target.value)}
                        />
                        <div style={{ position: 'absolute', right: '4px', top: '22px', display: 'flex', gap: '2px' }}>
                          <button className="btn btn-ghost btn-icon" onClick={() => setShowToken(!showToken)} title={showToken ? 'ซ่อน' : 'แสดง'}>
                            {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                          {settings.telegram_bot_token && (
                            <button className="btn btn-ghost btn-icon" onClick={() => handleCopy('telegram_bot_token')} title="คัดลอก" style={{ color: copiedField === 'telegram_bot_token' ? 'var(--profit)' : undefined }}>
                              {copiedField === 'telegram_bot_token' ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ flex: 1 }}>
                        <label className="form-label" style={{ fontSize: 12 }}>Chat ID</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            className="form-input"
                            type="text"
                            placeholder="เช่น 123456789"
                            style={{ flex: 1 }}
                            value={settings.telegram_chat_id}
                            onChange={(e) => handleLocalUpdate('telegram_chat_id', e.target.value)}
                          />
                          <button onClick={handleTestTelegram} className="btn-secondary" style={{ whiteSpace: 'nowrap' }}>
                            ทดสอบการส่ง
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Schedule */}
            {activeTab === 'schedule' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: 0 }}>
                    ตั้งเวลาอัพเดตพอร์ตการเปิด/ปิดออเดอร์อัตโนมัติ (เวลา Default คือ 07:00 น.)
                  </p>
                  <button className="btn btn-secondary btn-sm" onClick={handleAddSchedule}>
                    <Plus size={14} /> เพิ่มเวลาอัพเดต
                  </button>
                </div>

                <div style={{ display: 'grid', gap: '12px' }}>
                  {(settings.sync_schedules || []).length === 0 ? (
                    <div className="empty-state" style={{ padding: 'var(--space-xl)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)' }}>
                      ยังไม่ได้ตั้งเวลาอัพเดตอัตโนมัติ
                    </div>
                  ) : (
                    settings.sync_schedules.map((schedule, i) => (
                      <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-tertiary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Clock size={18} color="var(--accent-primary)" />
                          <input
                            type="time"
                            className="form-input"
                            style={{ background: 'var(--bg-secondary)', width: '120px' }}
                            value={schedule}
                            onChange={(e) => handleUpdateSchedule(i, e.target.value)}
                          />
                        </div>
                        <button className="btn btn-ghost btn-icon" style={{ color: 'var(--loss)' }} onClick={() => handleRemoveSchedule(i)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}


            {/* Security / MFA */}
            {activeTab === 'security' && (
              <div>
                <h3 style={{ marginBottom: 'var(--space-md)', fontSize: 16 }}>การยืนยันตัวตนแบบสองขั้นตอน (2FA)</h3>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 'var(--space-lg)' }}>
                  เปิดใช้งาน 2FA เพื่อเพิ่มความปลอดภัยให้กับบัญชีของคุณ โดยคุณจะต้องสแกน QR Code ด้วยแอปเตือนภัยเช่น Google Authenticator
                </p>

                <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>สถานะ 2FA</div>
                      <div style={{ fontSize: 13, color: mfaStatus ? 'var(--profit)' : 'var(--text-tertiary)', marginTop: 4 }}>
                        {mfaStatus ? 'เปิดใช้งานแล้ว' : 'ยังไม่ได้เปิดใช้งาน'}
                      </div>
                    </div>
                    <div>
                      {!mfaStatus && !mfaSetupData && (
                        <button className="btn btn-primary btn-sm" onClick={handleSetupMFA}>
                          เปิดใช้งาน 2FA
                        </button>
                      )}
                    </div>
                  </div>

                  {mfaSetupData && !mfaStatus && (
                    <div style={{ marginTop: 'var(--space-lg)', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--border-primary)' }}>
                      <div style={{ textAlign: 'center', marginBottom: 16 }}>
                        <img src={mfaSetupData.qr_code} alt="QR Code" style={{ background: '#fff', padding: 8, borderRadius: 8, width: 200, height: 200 }} />
                        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-tertiary)' }}>
                          สแกน QR Code ด้วย Google Authenticator หรือ Authy
                          <br />
                          หรือใส่รหัส: <code style={{ userSelect: 'all', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>{mfaSetupData.secret}</code>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 12, maxWidth: 300, margin: '0 auto' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="รหัส 6 หลัก"
                          maxLength={6}
                          value={mfaCode}
                          onChange={(e) => setMfaCode(e.target.value)}
                        />
                        <button className="btn btn-primary" onClick={handleVerifyMFA}>ยืนยัน</button>
                      </div>
                    </div>
                  )}

                  {mfaStatus && (
                    <div style={{ marginTop: 'var(--space-lg)', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--border-primary)' }}>
                      <h4 style={{ fontSize: 14, marginBottom: 12, color: 'var(--loss)' }}>ปิดการใช้งาน 2FA</h4>
                      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>หากต้องการปิด กรุณายืนยันด้วยรหัส 2FA ปัจจุบัน หรือรหัสผ่านของคุณ</p>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="รหัส 2FA"
                          maxLength={6}
                          value={mfaCode}
                          onChange={(e) => setMfaCode(e.target.value)}
                          style={{ width: 150 }}
                        />
                        <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-tertiary)' }}>หรือ</span>
                        <input
                          type="password"
                          className="form-input"
                          placeholder="รหัสผ่านเข้าสู่ระบบ"
                          value={passwordForMfa}
                          onChange={(e) => setPasswordForMfa(e.target.value)}
                          style={{ width: 200 }}
                        />
                        <button className="btn" style={{ background: 'var(--loss)', color: '#fff' }} onClick={handleDisableMFA}>ปิดการใช้งาน</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Locale */}
            {activeTab === 'general' && (
              <div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">ภาษา</div>
                    <div className="settings-desc">ภาษาที่ใช้แสดงผล</div>
                  </div>
                  <select 
                    className="filter-select" 
                    value={settings.language} 
                    onChange={(e) => handleLocalUpdate('language', e.target.value)}
                    style={{ width: 160 }}
                  >
                    <option value="th">🇹🇭 ภาษาไทย</option>
                    <option value="en">🇬🇧 English</option>
                  </select>
                </div>
                <div className="settings-row" style={{ borderBottom: 'none' }}>
                  <div>
                    <div className="settings-label">Timezone</div>
                    <div className="settings-desc">เขตเวลาที่ใช้แสดงผล</div>
                  </div>
                  <select 
                    className="filter-select" 
                    value={settings.timezone} 
                    onChange={(e) => handleLocalUpdate('timezone', e.target.value)}
                    style={{ width: 200 }}
                  >
                    <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">New York (UTC-5)</option>
                    <option value="Europe/London">London (UTC+0)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
