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
        <div style={{
          display: 'flex',
          gap: 4,
          marginBottom: 'var(--space-lg)',
          background: 'var(--bg-secondary)',
          padding: 4,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-primary)',
          width: 'fit-content',
        }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  background: isActive ? 'var(--accent-primary)' : 'transparent',
                  color: isActive ? '#0a0e17' : 'var(--text-secondary)',
                  transition: 'all 0.2s ease',
                }}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
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
