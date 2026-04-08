import React from 'react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Users, Shield, UserCheck, Activity, Database, Server } from 'lucide-react';

const COLORS = ['#00C49F', '#FFBB28', '#FF8042', '#0088FE', '#8884d8'];

export default function AdminUsageDashboard({ overview, roles }) {
  if (!overview || !roles) return <div style={{ padding: 20 }}>กำลังโหลดข้อมูล Dashboard...</div>;

  const roleData = roles.map(r => ({
    name: r.role_name,
    value: parseInt(r.user_count) || 0
  })).filter(r => r.value > 0);

  const formatCurrency = (val) => {
    return '$' + Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
  };

  const revenueData = [
    { name: 'Deposits', amount: overview.revenue?.total_deposits || 0 },
    { name: 'Withdrawals', amount: overview.revenue?.total_withdrawals || 0 },
    { name: 'Fees', amount: overview.revenue?.total_fees || 0 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={24} style={{ color: 'var(--accent-primary)' }} />
          Admin Usage Dashboard
        </h2>
      </div>

      {/* Top Cards */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
          <div className="card-header">
            <span className="card-title">ผู้ใช้งานทั่วไป (Users)</span>
            <Users size={16} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div className="card-value">
            {roleData.find(r => r.name === 'user')?.value || 0}
          </div>
        </div>
        <div className="card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
          <div className="card-header">
            <span className="card-title">ผู้นำทีม (Team Leads)</span>
            <UserCheck size={16} style={{ color: 'var(--accent-secondary)' }} />
          </div>
          <div className="card-value">
            {roleData.find(r => r.name === 'team_lead')?.value || 0}
          </div>
        </div>
        <div className="card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
          <div className="card-header">
            <span className="card-title">ผู้ดูแลระบบ (Admins)</span>
            <Shield size={16} style={{ color: 'var(--loss)' }} />
          </div>
          <div className="card-value">
            {roleData.find(r => r.name === 'admin' || r.name === 'super_admin')?.value || 0}
          </div>
        </div>
        <div className="card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
          <div className="card-header">
            <span className="card-title">เทรดที่ใช้งานล่าสุด</span>
            <Activity size={16} style={{ color: 'var(--profit)' }} />
          </div>
          <div className="card-value">
            {overview.active_traders || 0}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
        
        {/* Role Distribution Chart */}
        <div className="card" style={{ background: 'var(--bg-secondary)', padding: '24px' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>สัดส่วนผู้ใช้งาน (Role Distribution)</h3>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roleData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {roleData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 8 }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Financial Flow Chart */}
        <div className="card" style={{ background: 'var(--bg-secondary)', padding: '24px' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>กระแสเงินสด & ค่าธรรมเนียมระบบ</h3>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{fontSize: 12}} />
                <YAxis stroke="var(--text-secondary)" tick={{fontSize: 12}}tickFormatter={(val) => `$${val/1000}k`} />
                <RechartsTooltip 
                  formatter={(value) => formatCurrency(value)}
                  cursor={{fill: 'rgba(255,255,255,0.05)'}}
                  contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 8 }}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {revenueData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.name === 'Withdrawals' ? 'var(--loss)' : entry.name === 'Fees' ? 'var(--warning)' : 'var(--profit)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* System Health / Admin Checkpoints */}
      <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 12, marginBottom: 8 }}>สิ่งที่ผู้ดูแลระบบควรติดตาม (Admin Checkpoints)</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--bg-secondary)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(0, 196, 159, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00C49F' }}>
            <Database size={24} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Trading Volume Total</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{overview.total_trades.toLocaleString()} Trades</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--bg-secondary)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(255, 187, 40, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFBB28' }}>
            <Activity size={24} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>System Total PNL</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: overview.total_pnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
              {formatCurrency(overview.total_pnl)}
            </div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--bg-secondary)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(0, 136, 254, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0088FE' }}>
            <Server size={24} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Active Groups / Communities</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{overview.total_groups} Groups</div>
          </div>
        </div>
      </div>

    </div>
  );
}
