import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { useAuth } from './AuthContext';

const AccountContext = createContext(null);

export function AccountProvider({ children }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [brokers, setBrokers] = useState([]);
  const [viewMode, setViewMode] = useState('all'); // 'all' | 'broker' | 'account'
  const [selectedBrokerId, setSelectedBrokerId] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    if (!user) return;
    try {
      const [accs, brks] = await Promise.all([
        api.getAccounts(),
        api.getBrokers(),
      ]);
      setAccounts(accs);
      setBrokers(brks);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Group accounts by broker
  const accountsByBroker = accounts.reduce((acc, account) => {
    const key = account.broker_id;
    if (!acc[key]) {
      acc[key] = {
        broker_id: account.broker_id,
        broker_name: account.broker_display_name || account.broker_name,
        accounts: [],
      };
    }
    acc[key].accounts.push(account);
    return acc;
  }, {});

  // Get filter params for API calls
  const getFilterParams = () => {
    const params = { view: viewMode };
    if (viewMode === 'broker' && selectedBrokerId) {
      params.broker_id = selectedBrokerId;
    }
    if (viewMode === 'account' && selectedAccountId) {
      params.account_id = selectedAccountId;
    }
    return params;
  };

  const selectAll = () => {
    setViewMode('all');
    setSelectedBrokerId(null);
    setSelectedAccountId(null);
  };

  const selectBroker = (brokerId) => {
    setViewMode('broker');
    setSelectedBrokerId(brokerId);
    setSelectedAccountId(null);
  };

  const selectAccount = (accountId) => {
    setViewMode('account');
    setSelectedAccountId(accountId);
    const acc = accounts.find(a => a.id === accountId);
    if (acc) setSelectedBrokerId(acc.broker_id);
  };

  return (
    <AccountContext.Provider value={{
      accounts, brokers, accountsByBroker,
      viewMode, selectedBrokerId, selectedAccountId,
      loading, fetchAccounts, getFilterParams,
      selectAll, selectBroker, selectAccount,
      setViewMode, setSelectedBrokerId, setSelectedAccountId,
    }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccounts() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccounts must be used within AccountProvider');
  return ctx;
}
