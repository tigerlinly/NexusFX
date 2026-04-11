import { useState } from 'react';
import { MonitorPlay, Settings, RefreshCw, Terminal, Server } from 'lucide-react';

export default function AdminVncPage() {
  const [activeNode, setActiveNode] = useState('node1');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Nodes configuration
  const nodes = [
    { id: 'node1', name: 'Node 1 (Primary Data)', url: '/vnc/node1/vnc_lite.html', status: 'online' },
    { id: 'node2', name: 'Node 2 (Standby Data)', url: '/vnc/node2/vnc_lite.html', status: 'offline' },
    { id: 'node3', name: 'Node 3 (Strategy)', url: '/vnc/node3/vnc_lite.html', status: 'offline' }
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Add small delay to show animation and force iframe reload
    setTimeout(() => {
      const iframe = document.getElementById('vnc-iframe');
      if (iframe) {
        iframe.src = iframe.src;
      }
      setIsRefreshing(false);
    }, 500);
  };

  const currentNode = nodes.find(n => n.id === activeNode);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          <Terminal size={24} className="text-secondary" />
          การจัดการ MT5 Nodes (VNC)
        </h1>
        <p className="page-subtitle">ควบคุมและจัดการหน้าจอ MT5 สำหรับ Infrastructure แบบรวมศูนย์</p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
        {nodes.map(node => (
          <button
            key={node.id}
            className={`btn ${activeNode === node.id ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveNode(node.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Server size={18} />
            {node.name}
            {node.status === 'online' ? (
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--profit)' }}></span>
            ) : (
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-tertiary)' }}></span>
            )}
          </button>
        ))}

        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw size={18} className={isRefreshing ? 'spin' : ''} />
            โหลดหน้าจอใหม่
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', height: 'calc(100vh - 240px)', minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#1e2433', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a0aabc', fontSize: '14px' }}>
            <MonitorPlay size={16} />
            <span>เชื่อมต่อกับเซิร์ฟเวอร์: <strong>{currentNode.name}</strong></span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
             <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Password VNC: nexusfx</span>
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative', background: '#000' }}>
          {currentNode.status === 'online' ? (
            <iframe
              id="vnc-iframe"
              src={currentNode.url}
              style={{ width: '100%', height: '100%', border: 'none' }}
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
