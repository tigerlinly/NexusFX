import { useState, useEffect } from 'react';
import { MonitorPlay, Settings, RefreshCw, Terminal, Server } from 'lucide-react';

export default function AdminVncPage() {
  const [activeNode, setActiveNode] = useState('node1');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timestamp, setTimestamp] = useState(Date.now());

  // Force update service worker to clear outdated cache rules for /vnc/
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach(registration => registration.update());
      });
    }
  }, []);

  // Nodes configuration
  const nodes = [
    { id: 'node1', name: 'Node 1 (Primary Data)', url: '/vnc/node1/', status: 'online' },
    { id: 'node2', name: 'Node 2 (Standby Data)', url: '/vnc/node2/', status: 'offline' },
    { id: 'node3', name: 'Node 3 (Strategy)', url: '/vnc/node3/', status: 'offline' }
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimestamp(Date.now());
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  const currentNode = nodes.find(n => n.id === activeNode);

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 20px)' }}>
      <div className="page-header" style={{ marginBottom: 'var(--space-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">
            <Terminal size={24} className="text-secondary" />
            การจัดการ MT5 Nodes (VNC)
          </h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative', width: '240px' }}>
            <select
              className="form-control"
              value={activeNode}
              onChange={(e) => setActiveNode(e.target.value)}
              style={{ paddingLeft: '36px', appearance: 'auto', backgroundColor: '#1e2433', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', height: '40px', borderRadius: '8px' }}
            >
              {nodes.map(node => (
                <option key={node.id} value={node.id}>
                  {node.name} {node.status === 'online' ? '🟢' : '⚪'}
                </option>
              ))}
            </select>
            <Server size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
          </div>
          
          <button className="btn btn-outline" onClick={handleRefresh} disabled={isRefreshing} style={{ height: '40px' }}>
            <RefreshCw size={18} className={isRefreshing ? 'spin' : ''} />
            โหลดหน้าจอใหม่
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ background: '#1e2433', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a0aabc', fontSize: '14px' }}>
            <MonitorPlay size={16} />
            <span>เชื่อมต่อกับเซิร์ฟเวอร์: <strong>{currentNode.name}</strong></span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
             <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Password VNC: nexusfx</span>
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative', background: '#000', overflow: 'hidden' }}>
          {currentNode.status === 'online' ? (
            <iframe
              id="vnc-iframe"
              src={`${currentNode.url}?nocache=${timestamp}`}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              title={`VNC ${currentNode.name}`}
            ></iframe>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
              <Server size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <h3>โหนดนี้ยังไม่เปิดใช้งาน</h3>
              <p>เครื่องเซิร์ฟเวอร์ หรือ Docker Container สำหรับโหนดนี้ยังไม่ถูกตั้งค่า</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
