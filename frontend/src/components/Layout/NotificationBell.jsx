import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { api } from '../../utils/api';
import { io } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';

const ICON_MAP = {
  trade_executed: '✅',
  trade_failed: '❌',
  trade_opened: '📈',
  trade_closed: '💰',
  risk_alert: '⚠️',
  system: 'ℹ️',
  info: 'ℹ️',
};

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);
  const socketRef = useRef(null);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [notifs, countData] = await Promise.all([
          api.getNotifications(20),
          api.getUnreadCount()
        ]);
        setNotifications(notifs);
        setUnreadCount(countData.count || 0);
      } catch (err) {
        console.warn('Failed to fetch notifications:', err);
      }
    };
    fetchData();

    // Poll unread count every 30 seconds
    const interval = setInterval(async () => {
      try {
        const countData = await api.getUnreadCount();
        setUnreadCount(countData.count || 0);
      } catch { /* ignore */ }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Socket.io for real-time notifications
  useEffect(() => {
    if (!user?.id) return;

    const wsUrl = import.meta.env.VITE_WS_URL || (import.meta.env.PROD ? undefined : 'http://localhost:4000');
    const socket = io(wsUrl ? wsUrl : undefined);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', user.id);
    });

    socket.on('notification', (notification) => {
      setNotifications(prev => [notification, ...prev].slice(0, 50));
      setUnreadCount(prev => prev + 1);
      
      // Play sound if available
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdmt3fHx4dHR7goaHhYN+eXd7f4OGh4eEgHx4d3x/goaHh4WBfXl3e3+ChoaGhIB8eHd7fYKFhoaEgHx4eHt9goWGhoSAfHh4e32ChYaGhIB8');
        audio.volume = 0.3;
        audio.play().catch(() => {});
      } catch { /* ignore */ }
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.id]);

  // Close panel on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = async () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen && notifications.length === 0) {
      try {
        const notifs = await api.getNotifications(20);
        setNotifications(notifs);
      } catch { /* ignore */ }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch { /* ignore */ }
  };

  const getTimeAgo = useCallback((dateStr) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'เมื่อกี้';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} นาทีที่แล้ว`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} ชม.ที่แล้ว`;
    return `${Math.floor(seconds / 86400)} วันที่แล้ว`;
  }, []);

  return (
    <>
      <style>{`
        .notif-bell-wrapper {
          position: relative;
        }
        .notif-bell-btn {
          position: relative;
          width: 36px; height: 36px;
          border-radius: 10px;
          background: transparent;
          border: 1px solid var(--border-primary);
          color: var(--text-secondary);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .notif-bell-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-secondary);
        }
        .notif-bell-btn.has-unread {
          color: var(--accent-primary);
          border-color: rgba(0, 230, 118, 0.3);
        }
        .notif-badge {
          position: absolute; top: -4px; right: -4px;
          background: var(--loss);
          color: #fff;
          font-size: 9px; font-weight: 700;
          min-width: 16px; height: 16px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          padding: 0 4px;
          line-height: 1;
          animation: notifBadgePulse 2s ease-in-out infinite;
        }
        @keyframes notifBadgePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        .notif-panel {
          position: absolute;
          bottom: calc(100% + 12px);
          left: 0;
          width: 380px;
          max-height: 480px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-primary);
          border-radius: 12px;
          box-shadow: 0 -12px 40px rgba(0,0,0,0.4);
          z-index: 9999;
          display: flex; flex-direction: column;
          overflow: hidden;
          animation: notifSlideInUp 0.2s ease-out;
          transform-origin: bottom left;
        }
        @keyframes notifSlideInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .notif-panel-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border-primary);
        }
        .notif-panel-header h3 {
          font-size: 14px; font-weight: 700; margin: 0;
          color: var(--text-primary);
        }
        .notif-panel-body {
          overflow-y: auto; flex: 1;
          max-height: 380px;
        }
        .notif-item {
          display: flex; gap: 10px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-primary);
          transition: background 0.15s;
          cursor: default;
        }
        .notif-item:hover {
          background: var(--bg-hover);
        }
        .notif-item.unread {
          background: rgba(0, 230, 118, 0.03);
          border-left: 3px solid var(--accent-primary);
        }
        .notif-item .notif-icon {
          font-size: 18px; flex-shrink: 0;
          width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 8px;
          background: var(--bg-tertiary);
        }
        .notif-item .notif-content {
          flex: 1; min-width: 0;
        }
        .notif-item .notif-title {
          font-size: 12px; font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }
        .notif-item .notif-message {
          font-size: 11px; color: var(--text-secondary);
          line-height: 1.4;
          word-break: break-word; /* Allows long messages to wrap gracefully */
        }
        .notif-item .notif-time {
          font-size: 10px; color: var(--text-tertiary);
          margin-top: 3px;
        }
        .notif-empty {
          padding: 40px 20px;
          text-align: center;
          color: var(--text-tertiary);
          font-size: 13px;
        }
        .notif-mark-btn {
          background: none; border: none;
          color: var(--text-tertiary);
          cursor: pointer;
          font-size: 11px;
          display: flex; align-items: center; gap: 4px;
          padding: 4px 8px;
          border-radius: 6px;
          transition: all 0.15s;
        }
        .notif-mark-btn:hover {
          background: var(--bg-hover);
          color: var(--accent-primary);
        }
      `}</style>

      <div className="notif-bell-wrapper" ref={panelRef}>
        <button 
          className={`notif-bell-btn ${unreadCount > 0 ? 'has-unread' : ''}`}
          onClick={handleToggle}
          title={`การแจ้งเตือน${unreadCount > 0 ? ` (${unreadCount} ใหม่)` : ''}`}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>

        {isOpen && (
          <div className="notif-panel">
            <div className="notif-panel-header">
              <h3>🔔 การแจ้งเตือน</h3>
              <div style={{ display: 'flex', gap: 4 }}>
                {unreadCount > 0 && (
                  <button className="notif-mark-btn" onClick={handleMarkAllRead} title="อ่านทั้งหมด">
                    <CheckCheck size={14} /> อ่านแล้ว
                  </button>
                )}
                <button className="notif-mark-btn" onClick={() => setIsOpen(false)} title="ปิด">
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="notif-panel-body">
              {notifications.length === 0 ? (
                <div className="notif-empty">
                  <Bell size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <div>ยังไม่มีการแจ้งเตือน</div>
                </div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`}>
                    <div className="notif-icon">
                      {ICON_MAP[n.type] || 'ℹ️'}
                    </div>
                    <div className="notif-content">
                      <div className="notif-title">{n.title}</div>
                      <div className="notif-message">{n.message}</div>
                      <div className="notif-time">{getTimeAgo(n.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
