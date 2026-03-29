import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Palette, Bell, Globe, Moon, Save, Eye, EyeOff, Key, Shield } from 'lucide-react';
import { api } from '../../utils/api';

export default function SettingsPage() {
  const { currentTheme, changeTheme, themes } = useTheme();
  const [activeTab, setActiveTab] = useState('theme');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);

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
    telegram_chat_id: ''
  });

  useEffect(() => {
    fetchSettings();
    checkMfaStatus();
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
      setSettings({
        theme_id: data.theme_id || currentTheme || 'dark-trading',
        notifications_enabled: data.notifications_enabled ?? true,
        sound_enabled: data.sound_enabled ?? true,
        notify_new_trade: data.notify_new_trade ?? false,
        metaapi_token: data.metaapi_token || '',
        auto_sync: data.auto_sync ?? true,
        language: data.language || 'th',
        timezone: data.timezone || 'Asia/Bangkok',
        binance_api_key: data.binance_api_key || '',
        binance_api_secret: data.binance_api_secret || '',
        twelvedata_api_key: data.twelvedata_api_key || '',
        line_notify_token: data.line_notify_token || '',
        telegram_bot_token: data.telegram_bot_token || '',
        telegram_chat_id: data.telegram_chat_id || ''
      });
      if (data.theme_id && data.theme_id !== currentTheme) {
        // Suppress warning if missing from contexts, just try to set it.
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

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...settings,
        theme_id: settings.theme_id || currentTheme
      };
      console.log('Saving settings payload:', payload);
      await api.updateSettings(payload);
      alert('บันทึกการตั้งค่าเรียบร้อยแล้ว');
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
    { id: 'mt5', label: 'การเชื่อมต่อ MT5', icon: Globe },
    { id: 'apis', label: 'API Keys', icon: Key },
    { id: 'security', label: 'ความปลอดภัย', icon: Shield },
    { id: 'general', label: 'ทั่วไป', icon: Moon },
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
    } catch (err) {
      alert('ส่งแจ้งเตือนล้มเหลว ตรวจสอบว่าใส่ Token ถูกต้องและกดบันทึกแล้วหรือยัง');
    }
  };

  const handleTestTelegram = async () => {
    try {
      await api.testTelegram();
      alert('ส่งแจ้งเตือนทดสอบสำเร็จ กรุณาตรวจสอบ Telegram ของคุณ');
    } catch (err) {
      alert('ส่งแจ้งเตือนล้มเหลว ตรวจสอบว่าใส่ Token/Chat ID ถูกต้องและกดบันทึกแล้วหรือยัง');
    }
  };

  if (loading) return null;

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title">ตั้งค่าระบบ</h1>
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
                      }}
                    >
                      <div className="theme-preview">
                        {theme.colors.map((color, i) => (
                          <div key={i} className="theme-preview-stripe" style={{ background: color }} />
                        ))}
                      </div>
                      <div className="theme-name">{theme.name}</div>
                    </div>
                  ))}
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
              </div>
            )}

            {/* MT5 Connection */}
            {activeTab === 'mt5' && (
              <div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">ซิงค์อัตโนมัติ</div>
                    <div className="settings-desc">ดึงข้อมูลเทรดจาก MT5 ทุก 10 วินาที</div>
                  </div>
                  <div 
                    className={`toggle ${settings.auto_sync ? 'active' : ''}`} 
                    onClick={() => handleLocalUpdate('auto_sync', !settings.auto_sync)} 
                  />
                </div>
                <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', borderBottom: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '12px' }}>
                    <div className="settings-label" style={{ marginBottom: 0 }}>MetaApi Token</div>
                    <div className="settings-desc" style={{ marginTop: 0 }}>
                      ใช้สำหรับเชื่อมต่อกับ MetaTrader 5 โดยอัตโนมัติ — <a href="https://metaapi.cloud/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>รับ Token ที่นี่</a>
                    </div>
                  </div>
                  <div style={{ position: 'relative', display: 'flex' }}>
                    <textarea
                      className="form-input"
                      placeholder="ใส่ Token จาก metaapi.cloud"
                      rows={20}
                      style={{ 
                        width: '100%', 
                        fontFamily: 'monospace',
                        minHeight: '400px',
                        lineHeight: '1.5',
                        resize: 'vertical',
                        paddingRight: '46px',
                        WebkitTextSecurity: showToken ? 'none' : 'disc'
                      }}
                      value={settings.metaapi_token}
                      onChange={(e) => handleLocalUpdate('metaapi_token', e.target.value)}
                    />
                    <button 
                      className="btn btn-ghost btn-icon" 
                      onClick={() => setShowToken(!showToken)}
                      title={showToken ? 'ซ่อน Token' : 'แสดง Token'}
                      style={{ position: 'absolute', right: '4px', top: '4px' }}
                    >
                      {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* APIs Connections */}
            {activeTab === 'apis' && (
              <div>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 'var(--space-lg)' }}>
                  เชื่อมต่อกุญแจ API ต่างๆ (API Tokens) เพื่อดึงข้อมูลราคาและการเทรดจากภายนอก
                </p>

                {/* Binance API */}
                <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '12px' }}>
                    <div className="settings-label" style={{ marginBottom: 0 }}>Binance API Key</div>
                    <div className="settings-desc" style={{ marginTop: 0 }}>
                      ใช้ผูกระบบเทรดคริปโต — <a href="https://www.binance.com/en/my/settings/api-management" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>รับ API Key ที่นี่</a>
                    </div>
                  </div>
                  <div style={{ position: 'relative', display: 'flex' }}>
                    <input
                      className="form-input"
                      type={showToken ? 'text' : 'password'}
                      placeholder="ใส่ Binance API Key"
                      style={{ width: '100%', paddingRight: '46px' }}
                      value={settings.binance_api_key}
                      onChange={(e) => handleLocalUpdate('binance_api_key', e.target.value)}
                    />
                    <button 
                      className="btn btn-ghost btn-icon" 
                      onClick={() => setShowToken(!showToken)}
                      style={{ position: 'absolute', right: '4px', top: '4px' }}
                    >
                      {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Binance Secret */}
                <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '12px' }}>
                    <div className="settings-label" style={{ marginBottom: 0 }}>Binance API Secret</div>
                    <div className="settings-desc" style={{ marginTop: 0 }}>
                      คัดลอกจากหน้าสร้าง API Key ของ Binance — <a href="https://www.binance.com/en/my/settings/api-management" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>จัดการ API</a>
                    </div>
                  </div>
                  <div style={{ position: 'relative', display: 'flex' }}>
                    <input
                      className="form-input"
                      type={showToken ? 'text' : 'password'}
                      placeholder="ใส่ Binance Secret Key"
                      style={{ width: '100%', paddingRight: '46px' }}
                      value={settings.binance_api_secret}
                      onChange={(e) => handleLocalUpdate('binance_api_secret', e.target.value)}
                    />
                    <button 
                      className="btn btn-ghost btn-icon" 
                      onClick={() => setShowToken(!showToken)}
                      style={{ position: 'absolute', right: '4px', top: '4px' }}
                    >
                      {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* TwelveData API */}
                <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '12px' }}>
                    <div className="settings-label" style={{ marginBottom: 0 }}>TwelveData API Key</div>
                    <div className="settings-desc" style={{ marginTop: 0 }}>
                      ใช้สำหรับดึงราคาสินทรัพย์ (Forex, Stocks) — <a href="https://twelvedata.com/account/api-keys" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>รับ API Key ที่นี่</a>
                    </div>
                  </div>
                  <div style={{ position: 'relative', display: 'flex' }}>
                    <input
                      className="form-input"
                      type={showToken ? 'text' : 'password'}
                      placeholder="ใส่ TwelveData API Key"
                      style={{ width: '100%', paddingRight: '46px' }}
                      value={settings.twelvedata_api_key}
                      onChange={(e) => handleLocalUpdate('twelvedata_api_key', e.target.value)}
                    />
                    <button 
                      className="btn btn-ghost btn-icon" 
                      onClick={() => setShowToken(!showToken)}
                      style={{ position: 'absolute', right: '4px', top: '4px' }}
                    >
                      {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Line Notify Token */}
                <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '12px' }}>
                    <div className="settings-label" style={{ marginBottom: 0 }}>Line Notify Token</div>
                    <div className="settings-desc" style={{ marginTop: 0 }}>
                      ยิงแจ้งเตือนการเทรดผ่าน LINE — <a href="https://notify-bot.line.me/my/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>รับ Token ที่นี่</a>
                    </div>
                  </div>
                  <div style={{ position: 'relative', display: 'flex', gap: '12px' }}>
                    <input
                      className="form-input"
                      type={showToken ? 'text' : 'password'}
                      placeholder="ใส่ Line Notify Token"
                      style={{ flex: 1, paddingRight: '46px' }}
                      value={settings.line_notify_token}
                      onChange={(e) => handleLocalUpdate('line_notify_token', e.target.value)}
                    />
                    <button 
                      className="btn btn-ghost btn-icon" 
                      onClick={() => setShowToken(!showToken)}
                      style={{ position: 'absolute', right: '120px', top: '4px' }}
                    >
                      {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
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
                        style={{ width: '100%', paddingRight: '46px' }}
                        value={settings.telegram_bot_token}
                        onChange={(e) => handleLocalUpdate('telegram_bot_token', e.target.value)}
                      />
                      <button 
                        className="btn btn-ghost btn-icon" 
                        onClick={() => setShowToken(!showToken)}
                        style={{ position: 'absolute', right: '4px', top: '22px' }}
                      >
                        {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
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
