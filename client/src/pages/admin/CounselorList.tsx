/**
 * Admin Counselor List Page (상담사 목록)
 * Data: Supabase API (mock fallback when not configured)
 */
import { useState, useEffect, useCallback } from 'react';
import { ROLE_ADMIN, ROLE_COUNSELOR, isAdminRole, type AppRole } from '@shared/const';
import { Search, Plus, Edit3, Trash2, X, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { usePageGuard } from '@/hooks/usePageGuard';
import { fetchCounselors, createCounselor, updateCounselor, deleteCounselor } from '@/lib/api';
import type { CounselorRow } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/supabase';

const PRIMARY_HEX = '#009C64';

interface CounselorForm {
  name: string;
  email: string;
  phone: string;
  branch: string;
  status: '재직' | '휴직' | '퇴직';
  role: AppRole;
}

const EMPTY_FORM: CounselorForm = {
  name: '', email: '', phone: '', branch: '', status: '재직', role: ROLE_COUNSELOR,
};

function CounselorModal({
  counselor,
  onSave,
  onClose,
}: {
  counselor: CounselorRow | null;
  onSave: (form: CounselorForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CounselorForm>(() =>
    counselor
      ? {
          name: counselor.name,
          email: counselor.email || '',
          phone: counselor.phone || '',
          branch: counselor.branch || '',
          status: counselor.status || '재직',
          role: counselor.role || ROLE_COUNSELOR,
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('이름을 입력해주세요.'); return; }
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-card rounded-md shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{counselor ? '상담사 수정' : '상담사 등록'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-sm hover:bg-muted"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {!isSupabaseConfigured() && (
            <div className="flex items-center gap-2 p-3 rounded-sm border border-amber-200 bg-amber-50 text-amber-800 text-xs">
              <AlertTriangle size={13} />
              Supabase 미설정 — 저장이 실제 DB에 반영되지 않습니다.
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5">이름 <span className="text-destructive">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="홍길동"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">이메일</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">연락처</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="010-0000-0000"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">지점</label>
              <input
                type="text"
                value={form.branch}
                onChange={e => setForm(f => ({ ...f, branch: e.target.value }))}
                className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="서울 강남지점"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">상태</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as '재직' | '휴직' | '퇴직' }))}
                className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="재직">재직</option>
                <option value="휴직">휴직</option>
                <option value="퇴직">퇴직</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">권한</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: Number(e.target.value) as AppRole }))}
              className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={ROLE_COUNSELOR}>상담사</option>
              <option value={ROLE_ADMIN}>관리자</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-1.5 disabled:opacity-60">
              {saving ? <Loader2 size={13} className="animate-spin" /> : null}
              저장
            </button>
            <button type="button" onClick={onClose} className="btn-cancel">취소</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CounselorList() {
  const { canRender } = usePageGuard('admin');
  const [counselors, setCounselors] = useState<CounselorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<CounselorRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CounselorRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCounselors();
      setCounselors(data);
    } catch (e: any) {
      toast.error('데이터 로드 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = counselors.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.branch || '').includes(search)
  );

  const handleSave = async (form: CounselorForm) => {
    if (!isSupabaseConfigured()) {
      // Demo mode: update local state only
      if (editTarget) {
        setCounselors(prev => prev.map(c => c.id === editTarget.id ? { ...c, ...form } : c));
        toast.success('수정되었습니다. (데모 모드)');
      } else {
        const newC: CounselorRow = {
          id: `demo_${Date.now()}`,
          ...form,
          client_count: 0,
          completed_count: 0,
          created_at: new Date().toISOString(),
        } as any;
        setCounselors(prev => [newC, ...prev]);
        toast.success('등록되었습니다. (데모 모드)');
      }
      setShowModal(false);
      setEditTarget(null);
      return;
    }
    try {
      if (editTarget) {
        const updated = await updateCounselor(editTarget.id, form);
        setCounselors(prev => prev.map(c => c.id === updated.id ? updated : c));
        toast.success('상담사 정보가 수정되었습니다.');
      } else {
        const created = await createCounselor(form as any);
        setCounselors(prev => [created, ...prev]);
        toast.success('상담사가 등록되었습니다.');
      }
      setShowModal(false);
      setEditTarget(null);
    } catch (e: any) {
      toast.error('저장 실패: ' + e.message);
    }
  };

  const handleDelete = async (c: CounselorRow) => {
    if (!isSupabaseConfigured()) {
      setCounselors(prev => prev.filter(x => x.id !== c.id));
      toast.success('삭제되었습니다. (데모 모드)');
      setDeleteTarget(null);
      return;
    }
    try {
      await deleteCounselor(c.id);
      setCounselors(prev => prev.filter(x => x.id !== c.id));
      toast.success('삭제되었습니다.');
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error('삭제 실패: ' + e.message);
    }
  };

  const statusColor = (s: string) => s === '재직' ? 'badge-active' : s === '휴직' ? 'badge-pending' : 'badge-cancelled';

  if (!canRender) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">상담사 목록</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            전체 {counselors.length}명
            {!isSupabaseConfigured() && <span className="ml-2 text-amber-600">(데모 데이터)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-sm hover:bg-muted" title="새로고침">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => { setEditTarget(null); setShowModal(true); }}
            className="btn-primary"
          >
            <Plus size={15} className="mr-1" />
            상담사 등록
          </button>
        </div>
      </div>

      <div className="bg-card rounded-md p-4 shadow-sm border border-border">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 지점, 이메일로 검색..."
            className="w-full pl-9 pr-4 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="bg-card rounded-md shadow-sm border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-muted-foreground mr-2" />
            <span className="text-sm text-muted-foreground">데이터 로드 중...</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">이름</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">연락처</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">지점</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">담당자 수</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">완료</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">상태</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {search ? '검색 결과가 없습니다.' : '등록된 상담사가 없습니다.'}
                  </td>
                </tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-sm flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: PRIMARY_HEX }}>
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.email || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{c.phone || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{c.branch || '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{c.client_count ?? 0}</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <span style={{ color: PRIMARY_HEX }} className="font-semibold">{c.completed_count ?? 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={statusColor(c.status || '재직')}>{c.status || '재직'}</span>
                        <span className={isAdminRole(c.role) ? 'badge-pending' : 'badge-active'}>
                          {isAdminRole(c.role) ? '관리자' : '상담사'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditTarget(c); setShowModal(true); }}
                          className="p-1.5 rounded-sm hover:bg-muted transition-colors"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="p-1.5 rounded-sm hover:bg-destructive/10 transition-colors text-destructive"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <CounselorModal
          counselor={editTarget}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-card rounded-md shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-foreground mb-2">상담사 삭제</h3>
            <p className="text-sm text-muted-foreground mb-5">
              <strong>{deleteTarget.name}</strong> 상담사를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="btn-cancel">취소</button>
              <button onClick={() => handleDelete(deleteTarget)} className="btn-destructive">삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
