import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Cpu, TerminalSquare, Target, History } from 'lucide-react';
import BotsPage from '../Bots/BotsPage';
import TerminalPage from '../Terminal/TerminalPage';
import DailyTargetPage from '../Targets/DailyTargetPage';
import TradeHistoryPage from '../TradeHistory/TradeHistoryPage';

const TABS = [
  { id: 'bots', label: 'Trading Bots', icon: Cpu },
  { id: 'terminal', label: 'ส่งคำสั่ง (Terminal)', icon: TerminalSquare },
  { id: 'targets', label: 'เป้ากำไรรายวัน', icon: Target },
  { id: 'history', label: 'ประวัติการเทรด', icon: History },
];

export default function TradingPage() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'bots');

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state?.tab]);

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title">Trading</h1>
        </div>
        <div className="header-right" id="trading-header-actions" style={{ display: 'flex', gap: 8 }}></div>
      </div>

      <div className="content-area">
        {/* Tab Navigation */}
        <div className="chart-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', background: 'rgba(0,0,0,0.1)', overflowX: 'auto' }}>
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px',
                    background: 'transparent', border: 'none',
                    color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    cursor: 'pointer', fontWeight: activeTab === tab.id ? 600 : 500, fontSize: 14, marginBottom: -1,
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Icon size={16} />{tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content - render both but hide inactive for state preservation */}
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
