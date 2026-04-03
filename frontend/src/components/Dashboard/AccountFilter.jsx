import { useAccounts } from '../../context/AccountContext';
import { ChevronDown } from 'lucide-react';

export default function AccountFilter() {
  const {
    accounts, accountsByBroker, viewMode,
    selectedBrokerId, selectedAccountId,
    selectAll, selectBroker, selectAccount
  } = useAccounts();

  const brokerGroups = Object.values(accountsByBroker);

  const handleViewChange = (e) => {
    const mode = e.target.value;
    if (mode === 'all') {
      selectAll();
    } else if (mode === 'broker') {
      if (brokerGroups.length > 0) selectBroker(brokerGroups[0].broker_id);
    } else if (mode === 'account') {
      if (accounts.length > 0) selectAccount(accounts[0].id);
    }
  };

  const handleBrokerChange = (e) => {
    const brokerId = parseInt(e.target.value);
    if (viewMode === 'broker') {
      selectBroker(brokerId);
    } else {
      const group = accountsByBroker[brokerId];
      if (group && group.accounts.length > 0) {
        selectAccount(group.accounts[0].id);
      }
    }
  };

  return (
    <div className="account-filter">
      {/* Account Selector — appears leftmost when account mode */}
      {viewMode === 'account' && (
        <div className="filter-dropdown-wrapper">
          <select
            className="filter-select filter-select-accent"
            value={selectedAccountId || ''}
            onChange={(e) => selectAccount(parseInt(e.target.value))}
          >
            {accounts
              .filter(a => !selectedBrokerId || a.broker_id === selectedBrokerId)
              .map(a => (
                <option key={a.id} value={a.id}>
                  {a.account_name} ({a.account_number})
                </option>
              ))}
          </select>
        </div>
      )}

      {/* Broker Selector — appears middle when account mode, or left when broker mode */}
      {(viewMode === 'broker' || viewMode === 'account') && (
        <div className="filter-dropdown-wrapper">
          <select
            className="filter-select filter-select-accent"
            value={selectedBrokerId || ''}
            onChange={handleBrokerChange}
          >
            {brokerGroups.map(g => (
              <option key={g.broker_id} value={g.broker_id}>
                {g.broker_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* View Mode Dropdown — rightmost */}
      <div className="filter-dropdown-wrapper">
        <select
          className="filter-select filter-select-view"
          value={viewMode}
          onChange={handleViewChange}
        >
          <option value="all">📊 รวมบัญชี</option>
          <option value="broker">🏦 แยก Broker</option>
          <option value="account">👤 แยกบัญชี</option>
        </select>
      </div>
    </div>
  );
}
