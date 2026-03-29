const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('nexusfx_token');
}

export function setToken(token) {
  localStorage.setItem('nexusfx_token', token);
}

export function clearToken() {
  localStorage.removeItem('nexusfx_token');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && !endpoint.includes('/auth/login')) {
    clearToken();
    window.location.href = '/login';
    throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  forgotPassword: (body) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify(body) }),
  resetPassword: (body) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),

  // Brokers
  getBrokers: () => request('/brokers'),

  // Accounts
  getAccounts: () => request('/accounts'),
  addAccount: (body) => request('/accounts', { method: 'POST', body: JSON.stringify(body) }),
  updateAccount: (id, body) => request(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  syncAccount: (id) => request(`/accounts/${id}/sync`, { method: 'POST' }),

  // Dashboard
  getDashboardSummary: (params) => request(`/dashboard/summary?${new URLSearchParams(params)}`),
  getPnlChart: (params) => request(`/dashboard/pnl-chart?${new URLSearchParams(params)}`),
  getAccountBreakdown: (params) => request(`/dashboard/account-breakdown?${new URLSearchParams(params)}`),
  getWidgets: () => request('/dashboard/widgets'),
  updateWidgets: (widgets) => request('/dashboard/widgets', { method: 'PUT', body: JSON.stringify({ widgets }) }),

  // Trades
  getTrades: (params) => request(`/trades?${new URLSearchParams(params)}`),
  getTradeStats: (params) => request(`/trades/stats?${new URLSearchParams(params)}`),
  getSymbols: () => request('/trades/symbols'),
  placeManualTrade: (body) => request('/trades', { method: 'POST', body: JSON.stringify(body) }),

  // Bots
  getBots: () => request('/bots'),
  createBot: (body) => request('/bots', { method: 'POST', body: JSON.stringify(body) }),
  updateBot: (id, body) => request(`/bots/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteBot: (id) => request(`/bots/${id}`, { method: 'DELETE' }),
  getBotLogs: (id) => request(`/bots/${id}/logs`),
  // Store & Billing
  getStoreBots: () => request('/store/bots'),
  purchaseBot: (body) => request('/store/purchase', { method: 'POST', body: JSON.stringify(body) }),
  getPlans: () => request('/billing/plans'),
  upgradeSubscription: (body) => request('/billing/upgrade', { method: 'POST', body: JSON.stringify(body) }),
  getSubscriptionHistory: () => request('/billing/history'),
  calculateProfitSharing: (body) => request('/billing/profit-sharing/calculate', { method: 'POST', body: JSON.stringify(body) }),
  settleProfitSharing: (body) => request('/billing/profit-sharing/settle', { method: 'POST', body: JSON.stringify(body) }),
  getProfitSharingHistory: () => request('/billing/profit-sharing/history'),

  // Targets
  getTargets: () => request('/targets'),
  getTargetStatus: () => request('/targets/status'),
  createTarget: (body) => request('/targets', { method: 'POST', body: JSON.stringify(body) }),
  updateTarget: (id, body) => request(`/targets/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTarget: (id) => request(`/targets/${id}`, { method: 'DELETE' }),
  targetAction: (id, body) => request(`/targets/${id}/action`, { method: 'POST', body: JSON.stringify(body) }),
  getTargetHistory: () => request('/targets/history'),

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: (data) => request('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  testLineNotify: () => request('/settings/test-line', { method: 'POST' }),

  // =============================================
  // NEW: Groups / Team Management
  // =============================================
  getGroups: () => request('/groups'),
  getAvailableUsers: () => request('/groups/available-users'),
  getGroup: (id) => request(`/groups/${id}`),
  createGroup: (body) => request('/groups', { method: 'POST', body: JSON.stringify(body) }),
  updateGroup: (id, body) => request(`/groups/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteGroup: (id) => request(`/groups/${id}`, { method: 'DELETE' }),
  addGroupMember: (id, body) => request(`/groups/${id}/members`, { method: 'POST', body: JSON.stringify(body) }),
  removeGroupMember: (group_id, user_id) => request(`/groups/${group_id}/members/${user_id}`, { method: 'DELETE' }),
  getGroupPerformance: (groupId, params) => request(`/groups/${groupId}/performance?${new URLSearchParams(params)}`),
  updateGroupConfig: (id, body) => request(`/groups/${id}/config`, { method: 'PUT', body: JSON.stringify(body) }),
  emergencyCloseGroup: (id, body) => request(`/groups/${id}/emergency-close`, { method: 'POST', body: JSON.stringify(body) }),

  // =============================================
  // NEW: Wallet & Financial Transactions
  // =============================================
  getWallet: () => request('/wallet'),
  getWalletSummary: () => request('/wallet/summary'),
  getTransactions: (params = {}) => request(`/wallet/transactions?${new URLSearchParams(params)}`),
  deposit: (body) => request('/wallet/deposit', { method: 'POST', body: JSON.stringify(body) }),
  topup: (body) => request('/wallet/topup', { method: 'POST', body: JSON.stringify(body) }),
  withdraw: (body) => request('/wallet/withdraw', { method: 'POST', body: JSON.stringify(body) }),

  // =============================================
  // NEW: Reports & Analytics
  // =============================================
  getWeeklyReport: (params = {}) => request(`/reports/weekly?${new URLSearchParams(params)}`),
  getMonthlyReport: (params = {}) => request(`/reports/monthly?${new URLSearchParams(params)}`),
  getAnalytics: (params = {}) => request(`/reports/analytics?${new URLSearchParams(params)}`),
  exportReport: (body) => request('/reports/export', { method: 'POST', body: JSON.stringify(body) }),
  getExportHistory: () => request('/reports/exports'),

  // =============================================
  // NEW: Admin Panel
  // =============================================
  getAdminOverview: () => request('/admin/overview'),
  getAdminUsers: (params = {}) => request(`/admin/users?${new URLSearchParams(params)}`),
  updateAdminUser: (id, body) => request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  getAuditLogs: (params = {}) => request(`/admin/audit-logs?${new URLSearchParams(params)}`),
  getAdminRevenue: (params = {}) => request(`/admin/revenue?${new URLSearchParams(params)}`),
  getAdminRoles: () => request('/admin/roles'),
  activateKillSwitch: (body) => request('/admin/kill-switch', { method: 'POST', body: JSON.stringify(body) }),
};
