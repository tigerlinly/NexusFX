import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AccountProvider } from './context/AccountContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout/Layout';
import LoginPage from './components/Auth/LoginPage';
import DashboardPage from './components/Dashboard/DashboardPage';
import TradeHistoryPage from './components/TradeHistory/TradeHistoryPage';
import DailyTargetPage from './components/Targets/DailyTargetPage';
import AccountsPage from './components/Accounts/AccountsPage';
import SettingsPage from './components/Settings/SettingsPage';
import WalletPage from './components/Wallet/WalletPage';
import GroupsPage from './components/Groups/GroupsPage';
import ReportsPage from './components/Reports/ReportsPage';
import BillingPage from './components/Billing/BillingPage';
import StorePage from './components/Store/StorePage';
import AdminPage from './components/Admin/AdminPage';
import AdminBillingPage from './components/Admin/AdminBillingPage';
import BotsPage from './components/Bots/BotsPage';
import TerminalPage from './components/Terminal/TerminalPage';
import TradingPage from './components/Trading/TradingPage';
import ForgotPasswordPage from './components/Auth/ForgotPasswordPage';
import ResetPasswordPage from './components/Auth/ResetPasswordPage';
import HeatmapPage from './components/Heatmap/HeatmapPage';
import StrategiesPage from './components/Strategies/StrategiesPage';
import ForumsPage from './components/Forums/ForumsPage';
import BrokersPage from './components/Brokers/BrokersPage';
import AgentDashboard from './components/Agent/AgentDashboard';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)', color: 'var(--text-primary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="sidebar-logo" style={{ width: 56, height: 56, fontSize: 24, margin: '0 auto var(--space-md)' }}>N</div>
          <div style={{ color: 'var(--text-tertiary)' }}>กำลังโหลด...</div>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <AccountProvider>
            <Layout />
          </AccountProvider>
        </ProtectedRoute>
      }>
        <Route index element={<DashboardPage />} />
        <Route path="trading" element={<TradingPage />} />
        <Route path="bots" element={<Navigate to="/trading" replace />} />
        <Route path="terminal" element={<Navigate to="/trading" replace />} />
        <Route path="trades" element={<Navigate to="/trading" replace state={{ tab: 'history' }} />} />
        <Route path="targets" element={<Navigate to="/trading" replace state={{ tab: 'targets' }} />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="store" element={<StorePage />} />
        <Route path="strategies" element={<Navigate to="/store" replace />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="heatmap" element={<Navigate to="/reports" replace />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="admin/billing" element={<AdminBillingPage />} />
        <Route path="forums" element={<ForumsPage />} />
        <Route path="brokers" element={<BrokersPage />} />
        <Route path="agent" element={<AgentDashboard />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
          <h1>404 - ไม่พบหน้าที่ต้องการ</h1>
        </div>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <AppRoutes />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
