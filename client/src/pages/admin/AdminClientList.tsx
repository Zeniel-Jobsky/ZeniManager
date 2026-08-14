/**
 * Admin Client List Page (상담자 목록 - 관리자)
 * Design: 모던 웰니스 미니멀리즘
 * Data: Supabase API with mock fallback
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Download, Upload, RefreshCw, Loader2, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { usePageGuard } from '@/hooks/usePageGuard';
import { fetchClients, fetchCounselors, createClient } from '@/lib/api';
import type { ClientRow, CounselorRow } from '@/lib/supabase';

const PRIMARY_HEX = '#009C64';
const ITEMS_PER_PAGE = 20;

const stageColors: Record<string, string> = {
  '초기상담': 'badge-active',
  '심층상담': 'badge-pending',
  '취업지원': 'badge-pending',
  '취업완료': 'badge-completed',
  '사후관리': 'badge-active',
};

const CSV_HEADERS = [
  '순번', '연도', '배정구분', '이름', '주민번호(앞6자리)', '연락처', '최종상담일', '연령', '성별', '사업유형',
  '참여유형', '참여단계', '역량등급', '인정통지일', '희망직무', '상담내역', '주소', '출신학교', '전공', '최종학력',
  '초기상담(1차)', 'IAP수립일', 'IAP운영기간', '참여수당신청일', '재진단날짜', '재진단여부', '일경험유형', '참여의사',
  '참여기업', '참여기간', '수료여부', '훈련과정명', '훈련개강일', '훈련종료일', '훈련수당', '집중취업알선시작일',
  '집중취업알선종료일', '취업지원종료일', '취업구분', '취업일자', '취업처', '취업직무', '급여', '취업소요기간', '퇴사일',
  '1차(1개월)', '1차상태', '2차(6개월)', '2차상태', '3차(12개월)', '3차상태', '4차(18개월)', '4차상태', '담당자', '지점'
];

export default function AdminClientList() {
  const { canRender } = usePageGuard('admin');
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [counselors, setCounselors] = useState<CounselorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  
  const [currentPage, setCurrentPage] = useState(1);

  // 🚨 스크롤 타겟용 Ref 추가
  const topRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🚨 페이지가 변경될 때마다 topRef 위치로 스크롤
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentPage]);

  const loadClients = () => {
    setLoading(true);
    Promise.all([fetchClients(), fetchCounselors()])
      .then(([clientsData, counselorsData]) => {
        setCounselors(counselorsData);

        const counselorMap = new Map(counselorsData.map(c => [c.user_id, c]));

        const enrichedClients = clientsData.map(client => {
          const counselor = client.counselor_id ? counselorMap.get(client.counselor_id) : undefined;
          return {
            ...client,
            counselor_name: counselor ? counselor.user_name : null,
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

  useEffect(() => {
    setCurrentPage(1);
  }, [search, branchFilter, stageFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedData = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleExportCSV = () => {
    if (filtered.length === 0) return toast.error('내보낼 데이터가 없습니다.');

    const rows = filtered.map(c => [
      c.seq_no || '', c.year || '', c.assignment_type || '', c.name || '', c.resident_id_masked || '',
      c.phone || '', c.last_counsel_date || '', c.age || '', c.gender || '', c.business_type || '',
      c.participation_type || '', c.participation_stage || '', c.competency_grade || '', c.recognition_date || '',
      c.desired_job || '', c.counsel_notes || '', c.address || '', c.school || '', c.major || '', c.education_level || '',
      c.initial_counsel_date || '', c.iap_date || '', c.iap_duration || '', c.allowance_apply_date || '',
      c.rediagnosis_date || '', c.rediagnosis_yn || '', c.work_exp_type || '', c.work_exp_intent || '',
      c.work_exp_company || '', c.work_exp_period || '', c.work_exp_completed || '', c.training_name || '',
      c.training_start || '', c.training_end || '', c.training_allowance || '', c.intensive_start || '',
      c.intensive_end || '', c.support_end_date || '', c.employment_type || '', c.employment_date || '',
      c.employer || '', c.job_title || '', c.salary || '', c.employment_duration || '', c.resignation_date || '',
      c.retention_1m_date || '', c.retention_1m_yn || '', c.retention_6m_date || '', c.retention_6m_yn || '',
      c.retention_12m_date || '', c.retention_12m_yn || '', c.retention_18m_date || '', c.retention_18m_yn || '',
      c.counselor_name || '', c.branch || ''
    ]);

    const csvContent = "\uFEFF" + [CSV_HEADERS, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `상담자목록_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.success('엑셀 형식으로 내보내기가 완료되었습니다.');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split('\n').filter(r => r.trim());
        if (rows.length < 2) throw new Error("데이터가 없거나 부족합니다.");

        const parseRow = (rowStr: string) => 
          rowStr.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.replace(/^"|"$/g, '').trim());

        const headers = parseRow(rows[0]);
        const nameIdx = headers.indexOf('이름');
        const phoneIdx = headers.indexOf('연락처');

        if (nameIdx === -1 || phoneIdx === -1) {
          throw new Error("'이름'과 '연락처' 열이 필수적으로 포함되어 있어야 합니다.");
        }

        let successCount = 0;
        let failCount = 0;

        toast.info(`총 ${rows.length - 1}개의 데이터 처리를 시작합니다...`);

        for (let i = 1; i < rows.length; i++) {
          const cols = parseRow(rows[i]);
          if (cols.length < 2 || !cols[nameIdx]) continue; 

          const name = cols[nameIdx];
          const phone = cols[phoneIdx];
          const genderRaw = headers.indexOf('성별') !== -1 ? cols[headers.indexOf('성별')] : '';
          const ageRaw = headers.indexOf('나이') !== -1 ? cols[headers.indexOf('나이')] : '';
          const counselorName = headers.indexOf('담당상담사') !== -1 ? cols[headers.indexOf('담당상담사')] : '';
          const stageRaw = headers.indexOf('참여단계') !== -1 ? cols[headers.indexOf('참여단계')] : '';
          const bizTypeRaw = headers.indexOf('사업유형') !== -1 ? cols[headers.indexOf('사업유형')] : '';
          const empTypeRaw = headers.indexOf('취업구분') !== -1 ? cols[headers.indexOf('취업구분')] : '';
          
          const matchedCounselor = counselors.find(c => c.user_name === counselorName);

          try {
            await createClient({
              name,
              phone,
              gender: genderRaw === '남' ? '남' : (genderRaw === '여' ? '여' : null),
              age: parseInt(ageRaw) || null,
              counselor_id: matchedCounselor ? matchedCounselor.user_id : undefined,
              participation_stage: stageRaw || undefined,
              business_type: bizTypeRaw || undefined,
              employment_type: empTypeRaw || undefined,
            });
            successCount++;
          } catch (err) {
            console.error(`Failed to import client [${name}]:`, err);
            failCount++;
          }
        }

        if (failCount === 0) {
          toast.success(`${successCount}명의 상담자 데이터가 성공적으로 추가되었습니다.`);
        } else {
          toast.warning(`${successCount}명 성공, ${failCount}명 실패했습니다.`);
        }
        
        loadClients(); 
      } catch (err: any) {
        toast.error('CSV 처리 중 오류: ' + err.message);
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; 
      }
    };

    reader.readAsText(file, 'euc-kr');
  };

  if (!canRender) return null;

  return (
    <div ref={topRef} className="space-y-4"> {/* 🚨 최상단 div에 ref를 부착합니다 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">상담자 목록</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            전체 {clients.length}명 · 검색 결과 {filtered.length}명
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={loadClients} className="btn-cancel flex items-center gap-1.5" disabled={loading || importing}>
            <RefreshCw size={14} className={loading && !importing ? 'animate-spin' : ''} />
            새로고침
          </button>
          
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
          />
          
          <button onClick={handleImportClick} className="btn-primary flex items-center gap-1.5" disabled={importing || loading}>
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            CSV 추가하기
          </button>

          <button onClick={handleExportCSV} className="btn-cancel flex items-center gap-1.5" disabled={loading || importing}>
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

      <div className="bg-card rounded-md shadow-sm border border-border flex flex-col overflow-hidden">
        {loading && !importing ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
            <RefreshCw size={16} className="animate-spin" />
            데이터 로딩 중...
          </div>
        ) : (
          <>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">이름 / 인적사항</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">연락처</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">담당 상담사</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">지점</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">참여단계</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">사업 유형</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">취업구분</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                        {search || branchFilter !== 'all' || stageFilter !== 'all'
                          ? '검색 결과가 없습니다.'
                          : '등록된 상담자가 없습니다.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map(c => (
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
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
                <div className="text-sm text-muted-foreground">
                  총 <span className="font-medium text-foreground">{filtered.length}</span>건 중 {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                  {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} 표시
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-sm border border-border bg-background hover:bg-muted disabled:opacity-50 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm font-medium px-2 text-foreground">
                    {currentPage} <span className="text-muted-foreground font-normal">/ {totalPages}</span>
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-sm border border-border bg-background hover:bg-muted disabled:opacity-50 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}