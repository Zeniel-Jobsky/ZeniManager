/**
 * Admin Client List Page (상담자 목록 - 관리자)
 * Design: 모던 웰니스 미니멀리즘
 * Data: Supabase API with mock fallback
 */
import { useState, useEffect } from 'react';
import { usePageGuard } from '@/hooks/usePageGuard';
import { fetchClients, fetchCounselors } from '@/lib/api'; // ✅ fetchCounselors 추가
import type { ClientRow } from '@/lib/supabase';
import { Search, Download, Filter, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const PRIMARY_HEX = '#009C64';

const stageColors: Record<string, string> = {
  '초기상담': 'badge-active',
  '심층상담': 'badge-pending',
  '취업지원': 'badge-pending',
  '취업완료': 'badge-completed',
  '사후관리': 'badge-active',
};

export default function AdminClientList() {
  const { canRender } = usePageGuard('admin');
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');

  const loadClients = () => {
    setLoading(true);
    // ✅ fetchClients와 fetchCounselors를 동시에 호출
    Promise.all([fetchClients(), fetchCounselors()])
      .then(([clientsData, counselorsData]) => {
        // 상담사 정보를 찾기 쉽게 Map 객체로 변환 (키: user_id, 값: 상담사 데이터)
        const counselorMap = new Map(counselorsData.map(c => [c.user_id, c]));

        // client 데이터에 상담사 이름(user_name)과 지점(department) 매핑
        const enrichedClients = clientsData.map(client => {
          const counselor = client.counselor_id ? counselorMap.get(client.counselor_id) : undefined;
          return {
            ...client,
            // 매칭되는 상담사가 있으면 user_name, 없으면 null (화면에서 '-'로 표시됨)
            counselor_name: counselor ? counselor.user_name : null,
            // 지점 필터링도 정상 작동하도록 department 값 매핑
            branch: counselor && counselor.department ? counselor.department : null
          };
        });

        setClients(enrichedClients);
        setLoading(false);
      })
      .catch(err => {
        toast.error('데이터 로드 실패: ' + err.message);
        setLoading(false);
      });
  };

  useEffect(() => { loadClients(); }, []);

  const branches = ['all', ...Array.from(new Set(clients.map(c => c.branch).filter(Boolean) as string[]))];
  const stages = ['all', '초기상담', '심층상담', '취업지원', '취업완료', '사후관리'];

  const filtered = clients.filter(c => {
    const matchSearch = !search ||
      c.name.includes(search) ||
      (c.phone || '').includes(search) ||
      (c.counselor_name || '').includes(search);
    const matchBranch = branchFilter === 'all' || c.branch === branchFilter;
    const matchStage = stageFilter === 'all' || c.participation_stage === stageFilter;
    return matchSearch && matchBranch && matchStage;
  });

  const handleExport = () => {
    // Build CSV from filtered data
    const headers = ['이름', '성별', '나이', '연락처', '담당상담사', '지점', '참여단계', '사업유형', '취업구분', '취업일자'];
    const rows = filtered.map(c => [
      c.name,
      c.gender || '',
      c.age || '',
      c.phone || '',
      c.counselor_name || '',
      c.branch || '',
      c.participation_stage || '',
      c.business_type || '',
      c.employment_type || '',
      c.employment_date || '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `상담자목록_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV 파일이 다운로드되었습니다.');
  };

  if (!canRender) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">상담자 목록</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            전체 {clients.length}명 · 검색 결과 {filtered.length}명
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadClients} className="btn-cancel flex items-center gap-1.5" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            새로고침
          </button>
          <button onClick={handleExport} className="btn-cancel flex items-center gap-1.5">
            <Download size={14} />
            CSV 내보내기
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-md p-4 shadow-sm border border-border space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 연락처, 담당 상담사로 검색..."
            className="w-full pl-9 pr-4 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              className="px-3 py-1.5 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">전체 지점</option>
              {branches.filter(b => b !== 'all').map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <select
            value={stageFilter}
            onChange={e => setStageFilter(e.target.value)}
            className="px-3 py-1.5 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">전체 단계</option>
            {stages.filter(s => s !== 'all').map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-card rounded-md shadow-sm border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
            <RefreshCw size={16} className="animate-spin" />
            데이터 로딩 중...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">이름</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">연락처</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">담당 상담사</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">지점</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">참여단계</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">사업 유형</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">취업구분</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {search || branchFilter !== 'all' || stageFilter !== 'all'
                      ? '검색 결과가 없습니다.'
                      : '등록된 상담자가 없습니다.'}
                  </td>
                </tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-sm flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: PRIMARY_HEX }}
                        >
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{c.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.gender && `${c.gender}`}{c.age && `, ${c.age}세`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{c.phone || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{c.counselor_name || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">{c.branch || '-'}</td>
                    <td className="px-4 py-3">
                      {c.participation_stage
                        ? <span className={stageColors[c.participation_stage] || 'badge-active'}>{c.participation_stage}</span>
                        : <span className="text-muted-foreground">-</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{c.business_type || '-'}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {c.employment_type
                        ? <span className="badge-completed">{c.employment_type}</span>
                        : <span className="text-muted-foreground text-xs">미취업</span>
                      }
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}