/**
 * Admin Business Dashboard (사업 대시보드 - 통합 필터 & 드릴다운)
 * Design: 모던 웰니스 미니멀리즘
 */
import { useState, useEffect, useMemo } from 'react';
import { usePageGuard } from '@/hooks/usePageGuard';
import { fetchClients, fetchCounselors } from '@/lib/api';
import type { ClientRow, CounselorRow } from '@/lib/supabase';
import { Link } from 'wouter';
import {
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Building2, Users, TrendingUp, Target, Loader2, Filter, ChevronRight } from 'lucide-react';

const PRIMARY_HEX = '#009C64';
const COLORS = ['#009C64', '#4299E1', '#F6AD55', '#9F7AEA', '#FC8181', '#38B2AC'];

const STAGE_COLORS = {
  '초기상담': '#4299E1',
  '심층상담': '#9F7AEA',
  '취업지원': '#F6AD55',
  '취업완료': '#009C64',
  '사후관리': '#38B2AC',
};

// 가로형 구조 정렬 및 링크 우측 상단 배치 적용된 StatCard
function StatCard({ icon, label, value, subLabel, bgHex, colorHex, linkTo, linkText }: {
  icon: React.ReactNode; label: string; value: string | number; subLabel?: string; bgHex: string; colorHex: string; linkTo?: string; linkText?: string;
}) {
  return (
    <div className="bg-card rounded-md p-5 shadow-sm border border-border flex flex-col justify-between relative">
      {/* 우측 상단 링크 배치 */}
      {linkTo && linkText && (
        <div className="absolute top-4 right-4">
          <Link href={linkTo}>
            <a className="inline-flex items-center gap-0.5 text-xs font-medium hover:underline transition-colors" style={{ color: PRIMARY_HEX }}>
              {linkText} <ChevronRight size={13} />
            </a>
          </Link>
        </div>
      )}
      
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: bgHex, color: colorHex }}>
          {icon}
        </div>
        <div className="flex-1 mt-0.5">
          <div className="text-sm font-medium text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold text-foreground mt-1">{value}</div>
          {subLabel && <div className="text-xs text-muted-foreground mt-1">{subLabel}</div>}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { canRender } = usePageGuard('admin');
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [counselors, setCounselors] = useState<CounselorRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 필터 상태
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedBusiness, setSelectedBusiness] = useState('all');

  useEffect(() => {
    Promise.all([fetchClients(), fetchCounselors()])
      .then(([clientsData, counselorsData]) => {
        setClients(clientsData);
        setCounselors(counselorsData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ─── 1. 드롭다운 옵션 추출 ───
  const branchOptions = useMemo(() => ['all', ...Array.from(new Set(counselors.map(c => c.department).filter(Boolean)))], [counselors]);
  const businessOptions = useMemo(() => ['all', ...Array.from(new Set(clients.map(c => c.business_type).filter(Boolean)))], [clients]);

  // ─── 2. 필터링된 데이터 계산 ───
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const counselor = counselors.find(con => con.user_id === c.counselor_id);
      const clientBranch = counselor?.department || c.branch || '미지정';
      
      const matchBranch = selectedBranch === 'all' || clientBranch === selectedBranch;
      const matchBusiness = selectedBusiness === 'all' || c.business_type === selectedBusiness;
      return matchBranch && matchBusiness;
    });
  }, [clients, counselors, selectedBranch, selectedBusiness]);

  // ─── 3. KPI 수치 계산 ───
  const totalCount = filteredClients.length;
  const completedCount = filteredClients.filter(c => !!c.employment_type || c.participation_stage === '취업완료').length;
  const inProgress = totalCount - completedCount;
  const avgRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // ─── 4. 프로세스 과정 수 ───
  const stageData = useMemo(() => {
    const order = ['초기상담', '심층상담', '취업지원', '취업완료', '사후관리'];
    const map: Record<string, number> = { '초기상담': 0, '심층상담': 0, '취업지원': 0, '취업완료': 0, '사후관리': 0 };
    filteredClients.forEach(c => {
      if (c.participation_stage && map[c.participation_stage] !== undefined) {
        map[c.participation_stage]++;
      }
    });
    return order.map(name => ({ name, value: map[name] }));
  }, [filteredClients]);

  // ─── 5. 월별 성사율 추이 (진행 중인 인원 대비 취업 비율) ───
  const trendData = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    
    // 최근 6개월 문자열 생성
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    return months.map(monthStr => {
      const [yearStr, monStr] = monthStr.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monStr);

      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);

      let activeCount = 0;
      let employedCount = 0;

      filteredClients.forEach(c => {
        // 내담자 등록일 확인
        const createdDateStr = c.created_at || c.initial_counsel_date;
        if (!createdDateStr) return;
        const createdDate = new Date(createdDateStr);
        if (isNaN(createdDate.getTime())) return;

        // 해당 월이 끝나기 전에 등록하지 않았다면 활성 대상 아님
        if (createdDate > endOfMonth) return;

        let isEmployedThisMonth = false;
        let isEmployedBeforeThisMonth = false;

        // 취업일자 기준 상태 계산
        if (c.employment_date) {
          const empDate = new Date(c.employment_date);
          if (!isNaN(empDate.getTime())) {
            if (empDate < startOfMonth) {
              isEmployedBeforeThisMonth = true;
            } else if (empDate >= startOfMonth && empDate <= endOfMonth) {
              isEmployedThisMonth = true;
            }
          }
        }

        // 해당 월이 시작하기 전에 이미 취업했다면, 해당 월에는 '진행 중'이 아님
        if (isEmployedBeforeThisMonth) return;

        // 조건을 통과했다면 해당 월에 '상담 진행 중'이었거나 '해당 월에 취업'한 활성 인원임
        activeCount++;

        if (isEmployedThisMonth) {
          employedCount++;
        }
      });

      return {
        month: `${month}월`,
        rate: activeCount > 0 ? Math.round((employedCount / activeCount) * 100) : 0
      };
    });
  }, [filteredClients]);

  // ─── 6. 파이 차트 데이터 ───
  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;
    filteredClients.forEach(c => {
      const bt = c.business_type || '미지정';
      map[bt] = (map[bt] || 0) + 1;
      total++;
    });
    return Object.entries(map).map(([name, value]) => ({ 
      name, 
      value, 
      percent: total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
    })).sort((a, b) => b.value - a.value);
  }, [filteredClients]);

  // ─── 7. 테이블 데이터 ───
  const tableData = useMemo(() => {
    if (selectedBranch === 'all') {
      const map: Record<string, { total: number; done: number; counselorCount: number }> = {};
      
      counselors.forEach(con => {
        const b = con.department || '미지정';
        if (!map[b]) map[b] = { total: 0, done: 0, counselorCount: 0 };
        map[b].counselorCount++;
      });

      filteredClients.forEach(c => {
        const counselor = counselors.find(con => con.user_id === c.counselor_id);
        const b = counselor?.department || c.branch || '미지정';
        if (!map[b]) map[b] = { total: 0, done: 0, counselorCount: 0 };
        map[b].total++;
        if (!!c.employment_type || c.participation_stage === '취업완료') map[b].done++;
      });

      return Object.entries(map).map(([name, v]) => ({
        name, counselorCount: v.counselorCount, total: v.total, done: v.done, 
        rate: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0
      })).sort((a, b) => b.rate - a.rate);
    } else {
      const branchCounselors = counselors.filter(c => c.department === selectedBranch);
      return branchCounselors.map(con => {
        const conClients = filteredClients.filter(c => c.counselor_id === con.user_id);
        const done = conClients.filter(c => !!c.employment_type || c.participation_stage === '취업완료').length;
        return {
          name: con.user_name, total: conClients.length, done: done,
          rate: conClients.length > 0 ? Math.round((done / conClients.length) * 100) : 0
        };
      }).sort((a, b) => b.rate - a.rate);
    }
  }, [filteredClients, counselors, selectedBranch]);

  const maxStageValue = Math.max(...stageData.map(s => s.value), 1);

  if (!canRender) return null;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      
      {/* ─── 상단 타이틀 ─── */}
      <div>
        <h1 className="text-xl font-bold text-foreground">사업 대시보드</h1>
        <p className="text-sm text-muted-foreground mt-1">지점 및 사업유형별 성과를 분석합니다.</p>
      </div>

      {/* ─── 분리된 필터 컨트롤 ─── */}
      <div className="flex flex-wrap items-center gap-4 bg-card p-4 rounded-md border border-border shadow-sm">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground mr-2">성과 필터</span>
        </div>
        <div className="flex gap-3">
          <select 
            value={selectedBranch} 
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-3 py-1.5 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">전체 지점</option>
            {branchOptions.filter(b => b !== 'all').map(b => <option key={String(b)} value={String(b)}>{String(b)}</option>)}
          </select>
          <select 
            value={selectedBusiness} 
            onChange={(e) => setSelectedBusiness(e.target.value)}
            className="px-3 py-1.5 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">전체 사업유형</option>
            {businessOptions.filter(b => b !== 'all').map(b => <option key={String(b)} value={String(b)}>{String(b)}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={32} /></div>
      ) : (
        <>
          {/* ─── 1. KPI Cards (아이콘 우측 정렬, 노란색 아이콘 반영) ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              icon={<Users size={20} />} 
              label="관리 상담자" 
              value={`${totalCount}명`} 
              subLabel="필터 적용" 
              bgHex="#E8F5E9" // 옅은 초록
              colorHex={PRIMARY_HEX}
              linkTo="/admin/clients"
              linkText="상담자 목록 열기"
            />
            <StatCard 
              icon={<TrendingUp size={20} />} 
              label="진행 중" 
              value={`${inProgress}명`} 
              subLabel="취업 전 단계" 
              bgHex="#EBF8FF" // 옅은 파랑
              colorHex="#4299E1"
            />
            <StatCard 
              icon={<Target size={20} />} 
              label="취업 성공" 
              value={`${completedCount}명`} 
              subLabel="누적 완료" 
              bgHex="#E8F5E9" // 옅은 초록
              colorHex={PRIMARY_HEX}
            />
            <StatCard 
              icon={<Building2 size={20} />} 
              label="취업 성사율" 
              value={`${avgRate}%`} 
              subLabel="평균" 
              bgHex="#FEF3C7" // 노란색(Amber) 계열
              colorHex="#D97706" // 짙은 노란색
            />
          </div>

          {/* ─── 2. Pipeline & Trend (높이 확장 및 여백 조절) ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* 프로세스 과정 수 (커스텀 프로그레스 바) */}
            <div className="bg-card rounded-md p-6 shadow-sm border border-border flex flex-col min-h-[400px]">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">프로세스 과정 수</h3>
                  <p className="text-xs text-muted-foreground">현재 선택된 조건의 내담자 분포입니다.</p>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col justify-center space-y-7 pb-4">
                {stageData.map((stage) => {
                  const widthPct = maxStageValue > 0 ? (stage.value / maxStageValue) * 100 : 0;
                  const barColor = STAGE_COLORS[stage.name as keyof typeof STAGE_COLORS] || '#CBD5E0';
                  
                  return (
                    <div key={stage.name}>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-foreground font-medium">{stage.name}</span>
                        <span className="text-foreground font-semibold">{stage.value}명</span>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${widthPct}%`, backgroundColor: barColor }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 월별 추이 (DB 연동 기반 진행 중 인원 대비) */}
            <div className="bg-card rounded-md p-6 shadow-sm border border-border flex flex-col min-h-[400px]">
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-foreground mb-1">월별 성사율 추이</h3>
                <p className="text-xs text-muted-foreground">상담 진행 중인 사람 중 해당 월에 취업한 비율입니다.</p>
              </div>
              <div className="flex-1 relative min-h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={PRIMARY_HEX} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={PRIMARY_HEX} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.88 0.008 75)" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <YAxis domain={['auto', 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: '6px', fontSize: '12px' }} formatter={(val: number) => [`${val}%`, '성사율']} />
                    <Area type="monotone" dataKey="rate" stroke={PRIMARY_HEX} strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" activeDot={{ r: 6 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ─── 3. Drill-down Analysis (Pie & Table) ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 동적 파이 차트 */}
            {selectedBusiness === 'all' && (
              <div className="bg-card rounded-md p-5 shadow-sm border border-border lg:col-span-1">
                <h3 className="text-sm font-semibold text-foreground mb-1">사업 유형별 비율</h3>
                <p className="text-xs text-muted-foreground mb-4">현재 조건에 해당하는 내담자의 사업 비중입니다.</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value" nameKey="name">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '6px', fontSize: '12px' }} 
                      formatter={(val: number, name: string, props: any) => [`${val}명 (${props.payload.percent}%)`, '배정 인원']} 
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', marginTop: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 동적 실적 테이블 */}
            <div className={`bg-card rounded-md p-0 shadow-sm border border-border flex flex-col ${selectedBusiness === 'all' ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              <div className="p-5 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  {selectedBranch === 'all' ? '지점별 상세 실적' : `${selectedBranch} 소속 상담사 실적`}
                </h3>
                <p className="text-xs text-muted-foreground">목표 달성률이 높은 순서대로 정렬됩니다.</p>
              </div>
              <div className="overflow-auto flex-1 p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr>
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                        {selectedBranch === 'all' ? '지점명' : '상담사명'}
                      </th>
                      {selectedBranch === 'all' && (
                        <th className="text-right px-5 py-3 font-medium text-muted-foreground">상담사 수</th>
                      )}
                      <th className="text-right px-5 py-3 font-medium text-muted-foreground">배정 인원</th>
                      <th className="text-right px-5 py-3 font-medium text-muted-foreground">취업 완료</th>
                      <th className="text-right px-5 py-3 font-medium text-muted-foreground">성사율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.length === 0 ? (
                      <tr><td colSpan={selectedBranch === 'all' ? 5 : 4} className="px-5 py-8 text-center text-muted-foreground">데이터가 없습니다.</td></tr>
                    ) : (
                      tableData.map((row: any) => (
                        <tr key={row.name} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="px-5 py-3 font-medium text-foreground">{row.name}</td>
                          {selectedBranch === 'all' && (
                            <td className="px-5 py-3 text-right text-muted-foreground">{row.counselorCount}명</td>
                          )}
                          <td className="px-5 py-3 text-right text-muted-foreground">{row.total}명</td>
                          <td className="px-5 py-3 text-right text-muted-foreground">{row.done}명</td>
                          <td className="px-5 py-3 text-right font-bold">
                            <span className={row.rate >= avgRate ? 'text-primary' : 'text-foreground'}>{row.rate}%</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}