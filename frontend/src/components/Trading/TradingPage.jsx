import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Cpu, TerminalSquare, Target, History, Settings2, Edit3, Eye, EyeOff, RotateCcw, X, Check, GripHorizontal } from 'lucide-react';
import BotsPage from '../Bots/BotsPage';
import TerminalPage from '../Terminal/TerminalPage';
import DailyTargetPage from '../Targets/DailyTargetPage';
import TradeHistoryPage from '../TradeHistory/TradeHistoryPage';

const DEFAULT_TABS = [
  { id: 'bots', label: 'Trading Bots', icon: Cpu },
  { id: 'terminal', label: 'ส่งคำสั่ง (Terminal)', icon: TerminalSquare },
  { id: 'targets', label: 'เป้ากำไรรายวัน', icon: Target },
  { id: 'history', label: 'ประวัติการเทรด', icon: History },
];

export default function TradingPage() {
  const location = useLocation();
  const [layout, setLayout] = useState(['bots', 'terminal', 'targets', 'history']);
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'bots');
  const [editMode, setEditMode] = useState(false);
  const [editLayout, setEditLayout] = useState([]);
  
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const dragStartIdx = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('nexusfx_trading_layout');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLayout(parsed);
          if (!location.state?.tab && !parsed.includes(activeTab)) {
            setActiveTab(parsed[0]);
          }
        }
      } catch {
        console.error('Failed to load layout');
      }
    }
  }, []);

  useEffect(() => {
    if (location.state?.tab && layout.includes(location.state.tab)) {
      setActiveTab(location.state.tab);
    }
  }, [location.state?.tab, layout]);

  // Drag & Drop
  const handleDragStart = (e, idx) => {
    dragStartIdx.current = idx;
    setDraggedItem(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverItem(idx);
  };

  const handleDragLeave = () => setDragOverItem(null);

  const handleDrop = (e, dropIdx) => {
    e.preventDefault();
    const startIdx = dragStartIdx.current;
    if (startIdx === null || startIdx === dropIdx) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }
    const newLayout = [...editLayout];
    const [removed] = newLayout.splice(startIdx, 1);
    newLayout.splice(dropIdx, 0, removed);
    
    setEditLayout(newLayout);
    setDraggedItem(null);
    setDragOverItem(null);
    dragStartIdx.current = null;
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
    dragStartIdx.current = null;
  };

  const toggleTab = (id) => {
    setEditLayout(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const enterEditMode = () => {
    setEditLayout([...layout]);
    setEditMode(true);
  };

  const saveLayout = () => {
    setLayout(editLayout);
    localStorage.setItem('nexusfx_trading_layout', JSON.stringify(editLayout));
    setEditMode(false);
    if (!editLayout.includes(activeTab) && editLayout.length > 0) {
      setActiveTab(editLayout[0]);
    }
  };

  const resetLayout = () => setEditLayout(['bots', 'terminal', 'targets', 'history']);
  const cancelEdit = () => { setEditMode(false); setEditLayout([]); };

  const renderEditToolbar = () => {
    if (!editMode) return null;
    return (
      <div className="edit-toolbar" style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--accent-primary)',
        borderRadius: 'var(--radius-lg)', padding: 'var(--space-md) var(--space-lg)',
        marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 'var(--space-md)', animation: 'slideDown 0.3s ease', boxShadow: '0 4px 20px rgba(0, 200, 150, 0.1)', flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-primary)', fontWeight: 600, fontSize: 13 }}>
            <Edit3 size={16} /> โหมดแก้ไข
          </div>
          <div style={{ height: 20, width: 1, background: 'var(--border-secondary)' }} />
          {DEFAULT_TABS.map(tab => {
            const isActive = editLayout.includes(tab.id);
            const Icon = tab.icon;
            return (
              <button
                key={tab.id} onClick={() => toggleTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-primary)'}`,
                  background: isActive ? 'rgba(0, 200, 150, 0.1)' : 'var(--bg-tertiary)',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all 0.2s ease',
                }}
              >
                {isActive ? <Eye size={13} /> : <EyeOff size={13} />}
                <Icon size={14} />{tab.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={resetLayout} className="btn-icon" style={{ fontSize: 12, border: '1px solid var(--border-primary)' }}><RotateCcw size={13} /> รีเซ็ต</button>
          <button onClick={cancelEdit} className="btn-icon" style={{ fontSize: 12, border: '1px solid var(--border-primary)' }}><X size={13} /> ยกเลิก</button>
          <button onClick={saveLayout} className="btn" style={{ fontSize: 12, background: 'var(--gradient-primary)', color: '#000', fontWeight: 600 }}><Check size={13} /> บันทึก</button>
        </div>
      </div>
    );
  };

  const displayTabs = (editMode ? editLayout : layout).map(id => DEFAULT_TABS.find(t => t.id === id)).filter(Boolean);

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title">Trading</h1>
        </div>
        <div className="header-right" id="trading-header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button 
            className="btn-icon" 
            title={editMode ? 'ออกจากโหมดแก้ไข' : 'ปรับแต่ง Tab'}
            onClick={editMode ? cancelEdit : enterEditMode}
            style={{
              color: editMode ? 'var(--accent-primary)' : 'var(--text-secondary)',
              background: editMode ? 'rgba(0, 200, 150, 0.1)' : 'transparent',
            }}
          >
            <Settings2 size={18} />
          </button>
        </div>
      </div>

      <div className="content-area">
        {renderEditToolbar()}

        {/* Tab Navigation */}
        <div className="chart-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', background: 'rgba(0,0,0,0.1)', flexWrap: 'wrap' }}>
            {displayTabs.length === 0 && (
              <div style={{ padding: '14px 20px', color: 'var(--text-tertiary)', fontSize: 13 }}>ไม่มี Tab ที่เลือก</div>
            )}
            {displayTabs.map((tab, idx) => {
              const Icon = tab.icon;
              const isDragging = draggedItem === idx;
              const isDragOver = dragOverItem === idx;
              return (
                <button
                  key={tab.id}
                  draggable={editMode}
                  onDragStart={editMode ? (e) => handleDragStart(e, idx) : undefined}
                  onDragOver={editMode ? (e) => handleDragOver(e, idx) : undefined}
                  onDragLeave={editMode ? handleDragLeave : undefined}
                  onDrop={editMode ? (e) => handleDrop(e, idx) : undefined}
                  onDragEnd={editMode ? handleDragEnd : undefined}
                  onClick={() => !editMode && setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px',
                    background: isDragOver ? 'rgba(0, 200, 150, 0.05)' : 'transparent',
                    border: 'none',
                    color: activeTab === tab.id && !editMode ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    borderBottom: activeTab === tab.id && !editMode ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    cursor: editMode ? 'grab' : 'pointer', fontWeight: activeTab === tab.id && !editMode ? 600 : 500, fontSize: 14, marginBottom: -1,
                    whiteSpace: 'nowrap', opacity: isDragging ? 0.4 : 1, transition: 'all 0.2s', position: 'relative'
                  }}
                >
                  {editMode && <GripHorizontal size={14} style={{ color: 'var(--text-tertiary)' }} />}
                  <Icon size={16} />{tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {!editMode && (
          <>
            <div style={{ display: activeTab === 'bots' ? 'block' : 'none' }}>
              <BotsContent isActive={activeTab === 'bots'} />
            </div>
            <div style={{ display: activeTab === 'terminal' ? 'block' : 'none' }}>
              <TerminalContent isActive={activeTab === 'terminal'} />
            </div>
            <div style={{ display: activeTab === 'targets' ? 'block' : 'none' }}>
              <TargetsContent isActive={activeTab === 'targets'} />
            </div>
            <div style={{ display: activeTab === 'history' ? 'block' : 'none' }}>
              <HistoryContent isActive={activeTab === 'history'} />
            </div>
          </>
        )}
      </div>
    </>
  );
}

// Wrapper components that render only the content (no header/content-area wrapper)
function BotsContent({ isActive }) {
  return <BotsPage embedded isActive={isActive} />;
}

function TerminalContent({ isActive }) {
  return <TerminalPage embedded isActive={isActive} />;
}

function TargetsContent({ isActive }) {
  return <DailyTargetPage embedded isActive={isActive} />;
}

function HistoryContent({ isActive }) {
  return <TradeHistoryPage embedded isActive={isActive} />;
}
