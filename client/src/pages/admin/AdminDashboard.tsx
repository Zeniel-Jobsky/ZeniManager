/**
 * Admin Business Dashboard (사업 대시보드)
 * Design: 모던 웰니스 미니멀리즘
 * Features: 지점별, 사업별(유형), 취업구분(성사율) 통계
 * Data: Supabase API with mock fallback
 */
import { useState, useEffect } from 'react';
import { usePageGuard } from '@/hooks/usePageGuard';
import { BRANCH_STATS } from '@/lib/mockData';
import { fetchClients } from '@/lib/api';
import type { ClientRow } from '@/lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { Building2, Users, TrendingUp, Award, ChevronUp, ChevronDown } from 'lucide-react';

const PRIMARY_HEX = '#009C64';
const COLORS = ['#009C64', '#4299E1', '#F6AD55', '#9F7AEA', '#FC8181'];

function StatCard({ icon, label, value, change, changeType }: {
  icon: React.ReactNode; label: string; value: string | number;
  change?: string; changeType?: 'up' | 'down';
}) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-sm flex items-center justify-center" style={{ background: 'oklch(0.92 0.05 162.5)' }}>
          {icon}
        </div>
        {change && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${changeType === 'up' ? 'text-green-600' : 'text-red-500'}`}>
            {changeType === 'up' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {change}
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </div>
    </div>
  );
}

const employmentData = [
  { month: '1월', rate: 58.2 },
  { month: '2월', rate: 61.5 },
  { month: '3월', rate: 63.8 },
  { month: '4월', rate: 65.2 },
  { month: '5월', rate: 67.1 },
  { month: '6월', rate: 69.4 },
  { month: '7월', rate: 68.9 },
  { month: '8월', rate: 71.2 },
  { month: '9월', rate: 72.5 },
  { month: '10월', rate: 74.1 },
  { month: '11월', rate: 73.8 },
  { month: '12월', rate: 75.5 },
];

export default function AdminDashboard() {
  const { canRender } = usePageGuard('admin');
  const [activeTab, setActiveTab] = useState<'branch' | 'business' | 'employment'>('branch');
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients().then((data: ClientRow[]) => {
      setClients(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const totalClients = clients.length;
  const totalCompleted = clients.filter(c => c.employment_type && c.employment_type !== '').length;
  const avgRate = totalClients > 0 ? Math.round(totalCompleted / totalClients * 100) : 0;

  // Build branch stats from real data
  const branchMap: Record<string, { clients: number; completed: number }> = {};
  clients.forEach(c => {
    const b = c.branch || '미지정';
    if (!branchMap[b]) branchMap[b] = { clients: 0, completed: 0 };
    branchMap[b].clients++;
    if (c.employment_type && c.employment_type !== '') branchMap[b].completed++;
  });
  const branchStats = Object.entries(branchMap).map(([branch, stats]) => ({
    branch,
    clients: stats.clients,
    completed: stats.completed,
    rate: stats.clients > 0 ? Math.round(stats.completed / stats.clients * 100) : 0,
  }));
  const displayBranchStats = branchStats.length > 0 ? branchStats : BRANCH_STATS;

  // Business type stats from real data
  const businessMap: Record<string, { count: number; completed: number }> = {};
  clients.forEach(c => {
    const bt = c.business_type || '기타';
    if (!businessMap[bt]) businessMap[bt] = { count: 0, completed: 0 };
    businessMap[bt].count++;
    if (c.employment_type && c.employment_type !== '') businessMap[bt].completed++;
  });
  const businessTypeData = Object.entries(businessMap).map(([name, stats]) => ({
    name,
    value: stats.count,
    rate: stats.count > 0 ? Math.round(stats.completed / stats.count * 100) : 0,
  }));
  const displayBusinessData = businessTypeData.length > 0 ? businessTypeData : [
    { name: '취업성공패키지', value: 145, rate: 68.2 },
    { name: '일반취업', value: 98, rate: 72.4 },
    { name: '창업지원', value: 42, rate: 54.8 },
    { name: '직업훈련', value: 89, rate: 63.1 },
  ];

  if (!canRender) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">사업 대시보드</h1>
        <p className="text-sm text-muted-foreground mt-0.5">전체 사업 현황 및 성과 지표</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users size={18} color={PRIMARY_HEX} />}
          label="전체 상담자"
          value={loading ? '...' : totalClients}
          change="12.5%"
          changeType="up"
        />
        <StatCard
          icon={<Building2 size={18} color={PRIMARY_HEX} />}
          label="운영 지점"
          value={loading ? '...' : displayBranchStats.length}
          change="1개"
          changeType="up"
        />
        <StatCard
          icon={<TrendingUp size={18} color={PRIMARY_HEX} />}
          label="취업 완료"
          value={loading ? '...' : totalCompleted}
          change="2명"
          changeType="up"
        />
        <StatCard
          icon={<Award size={18} color={PRIMARY_HEX} />}
          label="평균 취업 성사율"
          value={loading ? '...' : `${avgRate}%`}
          change="3.2%"
          changeType="up"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { id: 'branch', label: '지점별' },
          { id: 'business', label: '사업별(유형)' },
          { id: 'employment', label: '취업구분(성사율)' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'branch' | 'business' | 'employment')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
              activeTab === tab.id ? 'border-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            style={activeTab === tab.id ? { borderColor: PRIMARY_HEX, color: PRIMARY_HEX } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Branch Tab */}
      {activeTab === 'branch' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card rounded-md p-5 shadow-sm border border-border">
              <h3 className="text-sm font-semibold text-foreground mb-4">지점별 상담자 수</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={displayBranchStats} layout="vertical" barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.008 75)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 65)' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="branch" type="category" tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 65)' }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip contentStyle={{ borderRadius: '6px', border: '1px solid oklch(0.88 0.008 75)', fontSize: '12px' }} />
                  <Bar dataKey="clients" name="상담자 수" fill={PRIMARY_HEX} radius={[0, 3, 3, 0]} />
                  <Bar dataKey="completed" name="취업완료" fill="#4299E1" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-md p-5 shadow-sm border border-border">
              <h3 className="text-sm font-semibold text-foreground mb-4">지점별 성사율</h3>
              <div className="space-y-3">
                {displayBranchStats.map((branch, i) => (
                  <div key={branch.branch}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-foreground">{branch.branch}</span>
                      <span className="text-sm font-semibold" style={{ color: PRIMARY_HEX }}>{branch.rate}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${branch.rate}%`, background: COLORS[i % COLORS.length] }}
                      />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-xs text-muted-foreground">전체 {branch.clients}명</span>
                      <span className="text-xs text-muted-foreground">완료 {branch.completed}명</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Branch Table */}
          <div className="bg-card rounded-md shadow-sm border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">지점명</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">전체 상담자</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">취업완료</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">성사율</th>
                </tr>
              </thead>
              <tbody>
                {displayBranchStats.map(branch => (
                  <tr key={branch.branch} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium text-foreground">{branch.branch}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{branch.clients}명</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{branch.completed}명</td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: PRIMARY_HEX }}>{branch.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Business Type Tab */}
      {activeTab === 'business' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card rounded-md p-5 shadow-sm border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-4">사업 유형별 분포</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={displayBusinessData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={3}
                >
                  {displayBusinessData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '6px', border: '1px solid oklch(0.88 0.008 75)', fontSize: '12px' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card rounded-md p-5 shadow-sm border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-4">사업 유형별 성사율</h3>
            <div className="space-y-4">
              {displayBusinessData.map((item, i) => (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i] }}></span>
                      <span className="text-sm text-foreground">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold" style={{ color: COLORS[i] }}>{item.rate}%</span>
                      <span className="text-xs text-muted-foreground ml-2">{item.value}명</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${item.rate}%`, background: COLORS[i] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Employment Rate Tab */}
      {activeTab === 'employment' && (
        <div className="space-y-4">
          <div className="bg-card rounded-md p-5 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">월별 취업 성사율 추이</h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full" style={{ background: PRIMARY_HEX }}></span>
                성사율 (%)
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={employmentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.008 75)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 65)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[50, 80]} tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 65)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '6px', border: '1px solid oklch(0.88 0.008 75)', fontSize: '12px' }}
                  formatter={(v: number) => [`${v}%`, '성사율']}
                />
                <Line type="monotone" dataKey="rate" stroke={PRIMARY_HEX} strokeWidth={2.5} dot={{ fill: PRIMARY_HEX, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: '취업 성공', value: totalCompleted, unit: '명', color: PRIMARY_HEX },
              { label: '진행 중', value: totalClients - totalCompleted, unit: '명', color: '#4299E1' },
              { label: '이번 달 성사율', value: '75.5', unit: '%', color: '#009C64' },
              { label: '전월 대비', value: '+1.7', unit: '%', color: '#48BB78' },
            ].map(item => (
              <div key={item.label} className="stat-card text-center">
                <div className="text-2xl font-bold" style={{ color: item.color }}>{item.value}<span className="text-base">{item.unit}</span></div>
                <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
