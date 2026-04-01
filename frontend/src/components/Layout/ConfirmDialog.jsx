import { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle, Trash2, Info, X } from 'lucide-react';

/**
 * Custom Confirm Dialog — แทนที่ native browser confirm()
 *
 * Usage:
 *   const [confirmState, setConfirmState] = useState({ open: false });
 *   const showConfirm = (message, onConfirm, options) =>
 *     setConfirmState({ open: true, message, onConfirm, ...options });
 *
 *   <ConfirmDialog
 *     open={confirmState.open}
 *     title={confirmState.title}
 *     message={confirmState.message}
 *     variant={confirmState.variant} // 'danger' | 'warning' | 'info' | 'success'
 *     confirmText={confirmState.confirmText}
 *     cancelText={confirmState.cancelText}
 *     onConfirm={() => { confirmState.onConfirm?.(); setConfirmState({ open: false }); }}
 *     onCancel={() => setConfirmState({ open: false })}
 *   />
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  variant = 'warning',
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  onConfirm,
  onCancel,
  loading = false,
}) {
  const confirmBtnRef = useRef(null);

  // Focus confirm button when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => confirmBtnRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  const variantConfig = {
    danger: {
      icon: <Trash2 size={24} />,
      iconBg: 'rgba(239, 68, 68, 0.15)',
      iconColor: '#ef4444',
      confirmBg: 'linear-gradient(135deg, #ef4444, #dc2626)',
      confirmHover: '#dc2626',
      confirmShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
    },
    warning: {
      icon: <AlertTriangle size={24} />,
      iconBg: 'rgba(245, 158, 11, 0.15)',
      iconColor: '#f59e0b',
      confirmBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
      confirmHover: '#d97706',
      confirmShadow: '0 4px 15px rgba(245, 158, 11, 0.4)',
    },
    info: {
      icon: <Info size={24} />,
      iconBg: 'rgba(59, 130, 246, 0.15)',
      iconColor: '#3b82f6',
      confirmBg: 'linear-gradient(135deg, #3b82f6, #2563eb)',
      confirmHover: '#2563eb',
      confirmShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
    },
    success: {
      icon: <CheckCircle size={24} />,
      iconBg: 'rgba(34, 197, 94, 0.15)',
      iconColor: '#22c55e',
      confirmBg: 'linear-gradient(135deg, #22c55e, #16a34a)',
      confirmHover: '#16a34a',
      confirmShadow: '0 4px 15px rgba(34, 197, 94, 0.4)',
    },
  };

  const cfg = variantConfig[variant] || variantConfig.warning;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={!loading ? onCancel : undefined}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.15s ease',
        }}
      />

      {/* Dialog */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        animation: 'slideUp 0.2s ease',
      }}>
        <div style={{
          background: 'linear-gradient(145deg, #1e293b, #0f172a)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          padding: '28px',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: cfg.iconBg,
              color: cfg.iconColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {cfg.icon}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f1f5f9' }}>
                {title || 'ยืนยันการดำเนินการ'}
              </h3>
            </div>
            {!loading && (
              <button onClick={onCancel} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#64748b', padding: '4px', borderRadius: '6px',
                display: 'flex', alignItems: 'center',
                transition: 'color 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
                onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Message */}
          <p style={{
            margin: '0 0 24px 0',
            color: '#94a3b8',
            fontSize: '0.9rem',
            lineHeight: 1.6,
            paddingLeft: '62px',
          }}>
            {message}
          </p>

          {/* Divider */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 -28px 20px' }} />

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={onCancel}
              disabled={loading}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: '#94a3b8',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'all 0.2s',
                opacity: loading ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#f1f5f9'; } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
            >
              {cancelText}
            </button>
            <button
              ref={confirmBtnRef}
              onClick={onConfirm}
              disabled={loading}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                background: loading ? '#475569' : cfg.confirmBg,
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                transition: 'all 0.2s',
                boxShadow: loading ? 'none' : cfg.confirmShadow,
                display: 'flex', alignItems: 'center', gap: '8px',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {loading && (
                <span style={{
                  width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff', borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite', display: 'inline-block',
                }} />
              )}
              {confirmText}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
