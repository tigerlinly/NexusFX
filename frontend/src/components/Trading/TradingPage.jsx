import { useState } from 'react';
import { Cpu, TerminalSquare } from 'lucide-react';
import BotsPage from '../Bots/BotsPage';
import TerminalPage from '../Terminal/TerminalPage';

const TABS = [
  { id: 'bots', label: 'Trading Bots', icon: Cpu },
  { id: 'terminal', label: 'ส่งคำสั่ง (Terminal)', icon: TerminalSquare },
];

export default function TradingPage() {
  const [activeTab, setActiveTab] = useState('bots');

  return (
    <>
      <div className="header">
        <div className="header-left">
          <h1 className="page-title">Trading</h1>
        </div>
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
          <BotsContent />
        </div>
        <div style={{ display: activeTab === 'terminal' ? 'block' : 'none' }}>
          <TerminalContent />
        </div>
      </div>
    </>
  );
}

// Wrapper components that render only the content (no header/content-area wrapper)
function BotsContent() {
  return <BotsPage embedded />;
}

function TerminalContent() {
  return <TerminalPage embedded />;
}
