const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('nexusfx_token');
}

export function setToken(token) {
  localStorage.setItem('nexusfx_token', token);
}

export function clearToken() {
  const theme = localStorage.getItem('nexusfx_theme');
  const sidebar = localStorage.getItem('nexusfx_sidebar_collapsed');
  
  localStorage.clear();
  sessionStorage.clear();
  
  if (theme) localStorage.setItem('nexusfx_theme', theme);
  if (sidebar) localStorage.setItem('nexusfx_sidebar_collapsed', sidebar);
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
  getHeatmapData: (params = {}) => request(`/dashboard/heatmap?${new URLSearchParams(params)}`),

  // Trades
  getTrades: (params) => request(`/trades?${new URLSearchParams(params)}`),
  getLiveTrades: (accountId) => request(`/trades/live/${accountId}`),
  getTradeStats: (params) => request(`/trades/stats?${new URLSearchParams(params)}`),
  getSymbols: () => request('/trades/symbols'),
  placeManualTrade: (body) => request('/trades', { method: 'POST', body: JSON.stringify(body) }),
  syncTrades: (accountId) => request(`/trades/sync/${accountId}`, { method: 'POST' }),
  syncAllTrades: () => request('/trades/sync-all', { method: 'POST' }),
  closeTrades: (accountId, tickets) => request(`/trades/close/${accountId}`, { method: 'POST', body: JSON.stringify({ tickets }) }),
  syncLiveTrades: (trades) => request('/trades/sync-live', { method: 'POST', body: JSON.stringify({ trades }) }),

  // Bots
  getBots: () => request('/bots'),
  createBot: (body) => request('/bots', { method: 'POST', body: JSON.stringify(body) }),
  updateBot: (id, body) => request(`/bots/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteBot: (id) => request(`/bots/${id}`, { method: 'DELETE' }),
  getBotLogs: (id) => request(`/bots/${id}/logs`),
  getAllBotLogs: () => request('/bots/logs/all'),
  clearBotLogs: (id) => request(`/bots/${id}/logs`, { method: 'DELETE' }),
  // Store & Billing
  getStoreBots: () => request('/store/bots'),
  purchaseBot: (body) => request('/store/purchase', { method: 'POST', body: JSON.stringify(body) }),
  getPlans: () => request('/billing/plans'),
  getCurrentPlan: () => request('/billing/current'),
  upgradeSubscription: (body) => request('/billing/upgrade', { method: 'POST', body: JSON.stringify(body) }),
  getSubscriptionHistory: () => request('/billing/history'),
  createCheckout: (body) => request('/billing/checkout', { method: 'POST', body: JSON.stringify(body) }),
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
  testTelegram: () => request('/settings/test-telegram', { method: 'POST' }),

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
  getTransactions: (params = {}) => {
    const cleaned = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null));
    const qs = new URLSearchParams(cleaned).toString();
    return request(`/wallet/transactions${qs ? '?' + qs : ''}`);
  },
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
  adjustUserBalance: (id, body) => request(`/admin/users/${id}/adjust-balance`, { method: 'POST', body: JSON.stringify(body) }),
  getAdjustments: (status = 'PENDING') => request(`/admin/adjustments?status=${status}`),
  approveAdjustment: (id, action) => request(`/admin/adjustments/${id}/approve`, { method: 'POST', body: JSON.stringify({ action }) }),
  getAuditLogs: (params = {}) => request(`/admin/audit-logs?${new URLSearchParams(params)}`),
  getAdminRevenue: (params = {}) => request(`/admin/revenue?${new URLSearchParams(params)}`),
  getAdminRoles: () => request('/admin/roles'),
  getSystemConfig: () => request('/admin/system-config'),
  updateSystemConfig: (body) => request('/admin/system-config', { method: 'PUT', body: JSON.stringify(body) }),
  activateKillSwitch: (body) => request('/admin/kill-switch', { method: 'POST', body: JSON.stringify(body) }),

  // =============================================
  // NEW: MFA
  // =============================================
  setupMFA: () => request('/mfa/setup', { method: 'POST' }),
  verifyMFA: (body) => request('/mfa/verify', { method: 'POST', body: JSON.stringify(body) }),
  disableMFA: (body) => request('/mfa/disable', { method: 'POST', body: JSON.stringify(body) }),
  getMFAStatus: () => request('/mfa/status'),

  // =============================================
  // NEW: Strategies (Copy Trading)
  // =============================================
  getStrategies: (params = {}) => request(`/strategies?${new URLSearchParams(params)}`),
  getMyStrategies: () => request('/strategies/my'),
  createStrategy: (body) => request('/strategies', { method: 'POST', body: JSON.stringify(body) }),
  updateStrategy: (id, body) => request(`/strategies/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  subscribeStrategy: (id, body) => request(`/strategies/${id}/subscribe`, { method: 'POST', body: JSON.stringify(body) }),
  unsubscribeStrategy: (id) => request(`/strategies/${id}/unsubscribe`, { method: 'POST' }),
  getMySubscriptions: () => request('/strategies/subscriptions/my'),
  getStrategySignals: (id, params = {}) => request(`/strategies/${id}/signals?${new URLSearchParams(params)}`),
  publishSignal: (id, body) => request(`/strategies/${id}/signal`, { method: 'POST', body: JSON.stringify(body) }),

  // =============================================
  // NEW: Trade Psychology
  // =============================================
  getPsychologyReport: (params = {}) => request(`/reports/psychology?${new URLSearchParams(params)}`),
  getPsychologyHistory: () => request('/reports/psychology/history'),

  // =============================================
  // NEW: Social Forums (Community)
  // =============================================
  getForums: (params = {}) => request(`/forums?${new URLSearchParams(params)}`),
  createForumPost: (body) => request('/forums', { method: 'POST', body: JSON.stringify(body) }),
  getForumPost: (id) => request(`/forums/${id}`),
  createForumComment: (id, body) => request(`/forums/${id}/comments`, { method: 'POST', body: JSON.stringify(body) }),
  likeForumPost: (id) => request(`/forums/${id}/like`, { method: 'POST' }),
  getLeaderboard: () => request('/forums/leaderboard'),

  // Brokers (CRUD)
  // =============================================
  createBroker: (body) => request('/brokers', { method: 'POST', body: JSON.stringify(body) }),
  updateBroker: (id, body) => request(`/brokers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteBroker: (id) => request(`/brokers/${id}`, { method: 'DELETE' }),

  // =============================================
  // Notifications (In-App)
  // =============================================
  getNotifications: (limit = 30) => request(`/notifications?limit=${limit}`),
  getUnreadCount: () => request('/notifications/unread-count'),
  markAllRead: () => request('/notifications/read-all', { method: 'PUT' }),
  markRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),

  // =============================================
  // B2B / Agent System
  // =============================================
  getAgentTenant: () => request('/agents/my-tenant'),
  getAgentTeam: (params = {}) => request(`/agents/my-team?${new URLSearchParams(params)}`),
  getAgentTeamPerformance: (params = {}) => request(`/agents/team-performance?${new URLSearchParams(params)}`),
  createAgentInvite: (body) => request('/agents/invite', { method: 'POST', body: JSON.stringify(body) }),
  getAgentInvitations: () => request('/agents/invitations'),
  cancelAgentInvite: (id) => request(`/agents/invitations/${id}`, { method: 'DELETE' }),
  toggleAgentMember: (id) => request(`/agents/members/${id}/toggle`, { method: 'PUT' }),
  removeAgentMember: (id) => request(`/agents/members/${id}`, { method: 'DELETE' }),
  getAgentBranding: () => request('/agents/branding'),
  updateAgentBranding: (body) => request('/agents/branding', { method: 'PUT', body: JSON.stringify(body) }),
  getAgentCommissions: (params = {}) => request(`/agents/commissions?${new URLSearchParams(params)}`),
  validateInviteCode: (code) => request(`/agents/validate-invite/${code}`),

  // Public invite validation (no auth needed)
  validateInvite: async (code) => {
    const res = await fetch(`${API_BASE}/auth/validate-invite/${code}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Invalid invite');
    return data;
  },

  // Admin Agent Management
  getAdminAgents: (params = {}) => request(`/admin/agents?${new URLSearchParams(params)}`),
  createAdminAgent: (body) => request('/admin/agents', { method: 'POST', body: JSON.stringify(body) }),
  updateAdminAgent: (userId, body) => request(`/admin/agents/${userId}`, { method: 'PUT', body: JSON.stringify(body) }),
  getAdminAgentStats: (userId) => request(`/admin/agents/${userId}/stats`),

  // Admin Commission Management
  settleAgentCommissions: (userId) => request(`/admin/agents/${userId}/settle`, { method: 'POST' }),
  triggerCommissionCalc: () => request('/admin/commissions/calculate', { method: 'POST' }),
  getCommissionEngineStatus: () => request('/admin/commissions/status'),
};
