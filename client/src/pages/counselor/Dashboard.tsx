/**
 * Counselor Dashboard
 * Design: 모던 웰니스 미니멀리즘
 * Features: 전체 상담자 수, 프로세스 현황, 캘린더, 메모장(칸반)
 * Data: Supabase API (mock fallback when not configured)
 */
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { ROLE_COUNSELOR } from '@shared/const';
import { usePageGuard } from '@/hooks/usePageGuard';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchDashboardStats,
  fetchClients,
  fetchDashboardCalendarEntries,
  fetchDashboardCalendarMonthCounts,
  type DashboardStats,
  type DashboardCalendarEntry,
} from '@/lib/api';
import { MONTHLY_STATS, INITIAL_KANBAN, type KanbanColumn, type MemoCard } from '@/lib/mockData';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { ClientRow } from '@/lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart,
} from 'recharts';
import {
  Users, TrendingUp, CheckCircle2, Search, Plus, X, ChevronLeft, ChevronRight,
  AlertCircle, Calendar as CalendarIcon, StickyNote, Loader2, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

const PRIMARY_HEX = '#009C64';

type CalendarRangeMode = 'today' | 'week' | 'selected-day';

type CalendarDayCell = {
  key: string;
  date: Date;
  isCurrentMonth: boolean;
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildCalendarCells(month: Date): CalendarDayCell[] {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const gridEnd = addDays(monthEnd, 6 - monthEnd.getDay());
  const cells: CalendarDayCell[] = [];

  for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    cells.push({
      key: toDateKey(cursor),
      date: new Date(cursor),
      isCurrentMonth: cursor.getMonth() === month.getMonth() && cursor.getFullYear() === month.getFullYear(),
    });
  }

  return cells;
}

function formatPanelDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return `${year}.${month}.${day}`;
}

function getDayStatus(dateKey: string, todayKey: string): 'past' | 'today' | 'upcoming' {
  if (dateKey < todayKey) return 'past';
  if (dateKey > todayKey) return 'upcoming';
  return 'today';
}

function buildRange(mode: CalendarRangeMode, selectedDate: string, todayKey: string) {
  if (mode === 'today') {
    return { start: todayKey, end: todayKey, anchor: todayKey };
  }

  if (mode === 'selected-day') {
    return { start: selectedDate, end: selectedDate, anchor: selectedDate };
  }

  const anchor = selectedDate || todayKey;
  const [year, month, day] = anchor.split('-').map(Number);
  const anchorDate = new Date(year, month - 1, day);
  const start = toDateKey(addDays(anchorDate, -6));
  return { start, end: anchor, anchor };
}

function formatTimeRange(startTime: string | null, endTime: string | null) {
  if (startTime && endTime) return `${startTime.slice(0, 5)} ~ ${endTime.slice(0, 5)}`;
  if (startTime) return startTime.slice(0, 5);
  return '시간 미정';
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }: {
  icon: ReactNode; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="stat-card flex items-start gap-4">
      <div className="w-10 h-10 rounded-sm flex items-center justify-center flex-shrink-0" style={{ background: color || 'oklch(0.92 0.05 162.5)' }}>
        {icon}
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold text-foreground mt-0.5">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Live Calendar ────────────────────────────────────────────────────────────

function LiveCalendar({
  month,
  selectedDate,
  counts,
  onMonthChange,
  onSelectDate,
}: {
  month: Date;
  selectedDate: string;
  counts: Record<string, number>;
  onMonthChange: (nextMonth: Date) => void;
  onSelectDate: (dateKey: string, date: Date) => void;
}) {
  const todayKey = toDateKey(new Date());
  const cells = buildCalendarCells(month);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="p-1 rounded-sm hover:bg-muted">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold">{month.getFullYear()}년 {month.getMonth() + 1}월</span>
        <button onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="p-1 rounded-sm hover:bg-muted">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {['일', '월', '화', '수', '목', '금', '토'].map(label => (
          <div key={label} className="text-xs text-muted-foreground py-1 font-medium">{label}</div>
        ))}

        {cells.map(cell => {
          const count = counts[cell.key] ?? 0;
          const status = getDayStatus(cell.key, todayKey);
          const isSelected = cell.key === selectedDate;
          const isToday = status === 'today';

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelectDate(cell.key, cell.date)}
              className={`min-h-[52px] rounded-sm border p-1.5 text-left transition-colors ${
                cell.isCurrentMonth ? 'bg-background hover:bg-muted/40' : 'bg-muted/20 hover:bg-muted/40'
              }`}
              style={{
                borderColor: isSelected ? PRIMARY_HEX : undefined,
                boxShadow: isSelected ? `0 0 0 1px ${PRIMARY_HEX}` : undefined,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`text-xs font-medium ${
                    !cell.isCurrentMonth ? 'text-muted-foreground/60' :
                    isToday ? 'text-white rounded-sm px-1.5 py-0.5' :
                    status === 'past' ? 'text-muted-foreground' : 'text-foreground'
                  }`}
                  style={isToday ? { background: PRIMARY_HEX } : undefined}
                >
                  {cell.date.getDate()}
                </span>

                {count > 0 && cell.isCurrentMonth && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${status === 'past' ? 'text-muted-foreground' : 'text-white'}`}
                    style={{ background: status === 'past' ? '#E5E7EB' : PRIMARY_HEX }}
                  >
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span>현재 담당 일정</span>
        <span>과거는 흐리게, 오늘은 강조</span>
      </div>
    </div>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────

function KanbanBoard() {
  const [columns, setColumns] = useState<KanbanColumn[]>(INITIAL_KANBAN);
  const [newCardColumn, setNewCardColumn] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');

  const addCard = (colId: string) => {
    if (!newCardTitle.trim()) return;
    const newCard: MemoCard = {
      id: `m${Date.now()}`,
      title: newCardTitle,
      content: '',
      priority: 'medium',
    };
    setColumns(cols => cols.map(col =>
      col.id === colId ? { ...col, cards: [...col.cards, newCard] } : col
    ));
    setNewCardTitle('');
    setNewCardColumn(null);
  };

  const removeCard = (colId: string, cardId: string) => {
    setColumns(cols => cols.map(col =>
      col.id === colId ? { ...col, cards: col.cards.filter(c => c.id !== cardId) } : col
    ));
  };

  const priorityColor = (p: string) => {
    if (p === 'high') return 'badge-cancelled';
    if (p === 'medium') return 'badge-pending';
    return 'badge-active';
  };
  const priorityLabel = (p: string) => p === 'high' ? '높음' : p === 'medium' ? '보통' : '낮음';

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map(col => (
        <div key={col.id} className="flex-shrink-0 w-64 bg-muted/50 rounded-md p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-foreground">{col.title}</span>
            <span className="text-xs text-muted-foreground bg-background rounded-sm px-1.5 py-0.5">{col.cards.length}</span>
          </div>
          <div className="space-y-2">
            {col.cards.map(card => (
              <div key={card.id} className="bg-card rounded-sm p-3 shadow-sm border border-border group">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium text-foreground leading-tight">{card.title}</div>
                  <button
                    onClick={() => removeCard(col.id, card.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-destructive"
                  >
                    <X size={12} />
                  </button>
                </div>
                {card.content && <div className="text-xs text-muted-foreground mt-1">{card.content}</div>}
                <div className="flex items-center gap-2 mt-2">
                  <span className={priorityColor(card.priority)}>{priorityLabel(card.priority)}</span>
                  {card.clientName && <span className="text-xs text-muted-foreground">{card.clientName}</span>}
                  {card.dueDate && <span className="text-xs text-muted-foreground ml-auto">{card.dueDate}</span>}
                </div>
              </div>
            ))}
          </div>
          {newCardColumn === col.id ? (
            <div className="mt-2">
              <input
                autoFocus
                value={newCardTitle}
                onChange={e => setNewCardTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCard(col.id); if (e.key === 'Escape') setNewCardColumn(null); }}
                placeholder="카드 제목..."
                className="w-full px-2 py-1.5 text-xs rounded-sm border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="flex gap-1 mt-1">
                <button onClick={() => addCard(col.id)} className="btn-primary text-xs py-1 px-2">추가</button>
                <button onClick={() => setNewCardColumn(null)} className="btn-cancel text-xs py-1 px-2">취소</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setNewCardColumn(col.id)}
              className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full py-1.5 rounded-sm hover:bg-background transition-colors"
            >
              <Plus size={12} />
              카드 추가
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function CounselorDashboard() {
  const { canRender, user } = usePageGuard('counselor');
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'calendar' | 'memo'>('overview');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<ClientRow[]>([]);
  const [searching, setSearching] = useState(false);

  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [calendarMode, setCalendarMode] = useState<CalendarRangeMode>('today');
  const [monthCounts, setMonthCounts] = useState<Record<string, number>>({});
  const [calendarEntries, setCalendarEntries] = useState<DashboardCalendarEntry[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const counselorScopeId = user?.role === ROLE_COUNSELOR ? user.counselorId : undefined;
  const todayKey = toDateKey(new Date());
  const currentRange = buildRange(calendarMode, selectedDate, todayKey);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await fetchDashboardStats(counselorScopeId);
      setStats(data);
    } catch (e: any) {
      toast.error('통계 로드 실패: ' + e.message);
    } finally {
      setStatsLoading(false);
    }
  }, [counselorScopeId]);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const all = await fetchClients(user?.role === ROLE_COUNSELOR ? user.counselorId : undefined);
        const q = searchQuery.toLowerCase();
        setSearchResults(all.filter(c =>
          c.name.toLowerCase().includes(q) ||
          (c.phone || '').includes(q) ||
          (c.desired_job || '').toLowerCase().includes(q)
        ).slice(0, 10));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [counselorScopeId, searchQuery]);

  const loadCalendarMonth = useCallback(async () => {
    if (!counselorScopeId) {
      setMonthCounts({});
      return;
    }

    setMonthLoading(true);
    try {
      const counts = await fetchDashboardCalendarMonthCounts(
        counselorScopeId,
        toDateKey(startOfMonth(calendarMonth)),
        toDateKey(endOfMonth(calendarMonth)),
      );
      setMonthCounts(counts);
      setCalendarError(null);
    } catch (e: any) {
      setCalendarError(e.message || '캘린더 데이터를 불러오지 못했습니다.');
    } finally {
      setMonthLoading(false);
    }
  }, [calendarMonth, counselorScopeId]);

  const loadCalendarEntries = useCallback(async () => {
    if (!counselorScopeId) {
      setCalendarEntries([]);
      return;
    }

    setEntriesLoading(true);
    try {
      const entries = await fetchDashboardCalendarEntries(counselorScopeId, currentRange.start, currentRange.end);
      setCalendarEntries(entries);
      setCalendarError(null);
    } catch (e: any) {
      setCalendarError(e.message || '일정 목록을 불러오지 못했습니다.');
    } finally {
      setEntriesLoading(false);
    }
  }, [counselorScopeId, currentRange.end, currentRange.start]);

  useEffect(() => {
    if (activeTab !== 'calendar') return;
    loadCalendarMonth();
  }, [activeTab, loadCalendarMonth]);

  useEffect(() => {
    if (activeTab !== 'calendar') return;
    loadCalendarEntries();
  }, [activeTab, loadCalendarEntries]);

  useEffect(() => {
    if (activeTab !== 'calendar') return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      loadCalendarMonth();
      loadCalendarEntries();
    }, 30 * 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, [activeTab, loadCalendarEntries, loadCalendarMonth]);

  const refreshCalendar = useCallback(() => {
    loadCalendarMonth();
    loadCalendarEntries();
  }, [loadCalendarEntries, loadCalendarMonth]);

  const handleDateSelect = useCallback((dateKey: string, date: Date) => {
    setSelectedDate(dateKey);
    setCalendarMode('selected-day');
    if (date.getMonth() !== calendarMonth.getMonth() || date.getFullYear() !== calendarMonth.getFullYear()) {
      setCalendarMonth(startOfMonth(date));
    }
  }, [calendarMonth]);

  const handleCalendarRowClick = useCallback((entry: DashboardCalendarEntry) => {
    const status = getDayStatus(entry.counselDate, todayKey);
    const tab = status === 'past' ? 'history' : 'input';
    navigate(`/clients/list?clientId=${encodeURIComponent(entry.clientId)}&tab=${tab}&date=${entry.counselDate}`);
  }, [navigate, todayKey]);

  const totalClients = stats?.totalClients ?? 0;
  const completedClients = stats?.employed ?? 0;
  const pendingClients = stats?.followUpNeeded ?? 0;
  const activeProcesses = stats?.inProgress ?? 0;

  const processStages = stats?.stageBreakdown ?? [
    { stage: '초기상담', count: 0 },
    { stage: '심층상담', count: 0 },
    { stage: '취업지원', count: 0 },
    { stage: '취업완료', count: 0 },
    { stage: '사후관리', count: 0 },
  ];
  const stageColors: Record<string, string> = {
    '초기상담': '#4299E1', '심층상담': '#9F7AEA',
    '취업지원': '#F6AD55', '취업완료': PRIMARY_HEX, '사후관리': '#68D391',
  };
  const maxStageCount = Math.max(...processStages.map(s => s.count), 1);

  if (!canRender) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">업무 대시보드</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            안녕하세요, {user?.name}님. 오늘도 좋은 하루 되세요.
            {!isSupabaseConfigured() && <span className="ml-2 text-amber-600 text-xs">(데모 모드)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadStats} className="p-1.5 rounded-sm hover:bg-muted" title="새로고침">
            <RefreshCw size={14} className={statsLoading ? 'animate-spin' : ''} />
          </button>
          <div className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="상담자 검색 (이름, 전화번호, 희망직종...)"
          className="w-full pl-9 pr-4 py-2.5 rounded-sm border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        )}
      </div>

      {searchQuery && (
        <div className="bg-card rounded-md border border-border shadow-sm overflow-hidden">
          {searching ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 size={16} className="animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">검색 중...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">검색 결과가 없습니다.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">이름</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">연락처</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">담당 상담사</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">단계</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map(c => (
                  <tr
                    key={c.id}
                    className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer"
                    onClick={() => { setSearchQuery(''); navigate('/clients/list'); }}
                  >
                    <td className="px-4 py-2.5 font-medium">{c.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.phone || '-'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.counselor_name || '-'}</td>
                    <td className="px-4 py-2.5">
                      <span className="badge-active">{c.participation_stage || '-'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card animate-pulse">
              <div className="w-10 h-10 rounded-sm bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted rounded w-2/3" />
                <div className="h-6 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))
        ) : (
          <>
            <StatCard icon={<Users size={18} color={PRIMARY_HEX} />} label="전체 상담자 수" value={totalClients} sub="담당 상담자" color="oklch(0.92 0.05 162.5)" />
            <StatCard icon={<TrendingUp size={18} color="#4299E1" />} label="진행 중" value={activeProcesses} sub="프로세스 진행" color="oklch(0.92 0.04 240)" />
            <StatCard icon={<CheckCircle2 size={18} color={PRIMARY_HEX} />} label="취업 완료" value={completedClients} sub={totalClients > 0 ? `성사율 ${Math.round(completedClients / totalClients * 100)}%` : '-'} color="oklch(0.92 0.05 162.5)" />
            <StatCard icon={<AlertCircle size={18} color="#F6AD55" />} label="후속 상담 필요" value={pendingClients} sub="팔로업 대상" color="oklch(0.95 0.06 85)" />
          </>
        )}
      </div>

      <div className="flex gap-1 border-b border-border">
        {[
          { id: 'overview', label: '현황', icon: <TrendingUp size={14} /> },
          { id: 'calendar', label: '캘린더', icon: <CalendarIcon size={14} /> },
          { id: 'memo', label: '메모장', icon: <StickyNote size={14} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'overview' | 'calendar' | 'memo')}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px"
            style={activeTab === tab.id
              ? { borderColor: PRIMARY_HEX, color: PRIMARY_HEX }
              : { borderColor: 'transparent', color: '#6b7280' }
            }
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-card rounded-md p-5 shadow-sm border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-4">월별 상담 현황</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={MONTHLY_STATS} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.008 75)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 65)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 65)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '6px', border: '1px solid oklch(0.88 0.008 75)', fontSize: '12px' }} />
                <Bar dataKey="clients" name="상담자" fill={PRIMARY_HEX} radius={[3, 3, 0, 0]} />
                <Bar dataKey="completed" name="취업완료" fill="#4299E1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card rounded-md p-5 shadow-sm border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-4">프로세스 과정 수</h3>
            <div className="space-y-3">
              {processStages.map(stage => (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground">{stage.stage}</span>
                    <span className="text-xs font-semibold text-foreground">{stage.count}명</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(stage.count / maxStageCount) * 100}%`,
                        background: stageColors[stage.stage] || PRIMARY_HEX,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 bg-card rounded-md p-5 shadow-sm border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-4">상담 세션 추이</h3>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={MONTHLY_STATS}>
                <defs>
                  <linearGradient id="sessionGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PRIMARY_HEX} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={PRIMARY_HEX} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.008 75)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 65)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'oklch(0.55 0.015 65)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '6px', border: '1px solid oklch(0.88 0.008 75)', fontSize: '12px' }} />
                <Area type="monotone" dataKey="sessions" name="세션 수" stroke={PRIMARY_HEX} strokeWidth={2} fill="url(#sessionGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-card rounded-md p-5 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">캘린더</h3>
              {monthLoading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
            </div>
            <LiveCalendar
              month={calendarMonth}
              selectedDate={selectedDate}
              counts={monthCounts}
              onMonthChange={setCalendarMonth}
              onSelectDate={handleDateSelect}
            />
          </div>

          <div className="lg:col-span-2 bg-card rounded-md p-5 shadow-sm border border-border">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">현재 담당 일정</h3>
                <div className="text-xs text-muted-foreground mt-1">
                  기준일 {formatPanelDate(currentRange.anchor)}
                  {calendarMode === 'week' && ` · ${formatPanelDate(currentRange.start)} ~ ${formatPanelDate(currentRange.end)}`}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setCalendarMode('today')}
                  className="px-3 py-1.5 rounded-sm text-xs font-medium border"
                  style={calendarMode === 'today' ? { background: PRIMARY_HEX, borderColor: PRIMARY_HEX, color: 'white' } : undefined}
                >
                  오늘
                </button>
                <button
                  onClick={() => setCalendarMode('week')}
                  className="px-3 py-1.5 rounded-sm text-xs font-medium border"
                  style={calendarMode === 'week' ? { background: PRIMARY_HEX, borderColor: PRIMARY_HEX, color: 'white' } : undefined}
                >
                  7일
                </button>
                <button
                  onClick={() => setCalendarMode('selected-day')}
                  className="px-3 py-1.5 rounded-sm text-xs font-medium border"
                  style={calendarMode === 'selected-day' ? { background: PRIMARY_HEX, borderColor: PRIMARY_HEX, color: 'white' } : undefined}
                >
                  선택일
                </button>
                <button onClick={refreshCalendar} className="p-2 rounded-sm border hover:bg-muted" title="일정 새로고침">
                  <RefreshCw size={14} className={monthLoading || entriesLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {calendarError && (
              <div className="mb-3 rounded-sm border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {calendarError}
              </div>
            )}

            {entriesLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
                <Loader2 size={16} className="animate-spin" />
                일정 목록을 불러오는 중입니다.
              </div>
            ) : calendarEntries.length === 0 ? (
              <div className="rounded-sm border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                선택한 범위에 표시할 일정이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {calendarEntries.map(entry => {
                  const status = getDayStatus(entry.counselDate, todayKey);
                  const statusLabel = status === 'past' ? '지난 일정' : status === 'today' ? '오늘 일정' : '예정';
                  const statusClass = status === 'past'
                    ? 'text-muted-foreground bg-muted'
                    : status === 'today'
                      ? 'text-white'
                      : 'text-foreground bg-emerald-50';

                  return (
                    <button
                      key={entry.counselId}
                      type="button"
                      onClick={() => handleCalendarRowClick(entry)}
                      className="w-full flex items-center gap-3 p-3 rounded-sm border border-border hover:bg-muted/30 transition-colors text-left"
                    >
                      <div className="text-center w-16 flex-shrink-0">
                        <div className="text-xs text-muted-foreground">{entry.counselDate.slice(5).replace('-', '.')}</div>
                        <div className="text-xs font-medium text-foreground mt-0.5">{formatTimeRange(entry.startTime, entry.endTime)}</div>
                      </div>
                      <div className="w-px h-10 bg-border flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{entry.clientName}</div>
                        <div className="text-xs text-muted-foreground mt-1">{entry.participationStage || '미설정'}</div>
                      </div>
                      <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${statusClass}`} style={status === 'today' ? { background: PRIMARY_HEX } : undefined}>
                        {statusLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'memo' && (
        <div className="bg-card rounded-md p-5 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">메모장 (칸반)</h3>
          </div>
          <KanbanBoard />
        </div>
      )}
    </div>
  );
}
