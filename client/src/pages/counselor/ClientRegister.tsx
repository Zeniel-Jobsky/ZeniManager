/**
 * Client Registration Page (상담자 등록)
 * Design: 모던 웰니스 미니멀리즘
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { ChevronLeft, User, Phone, Mail, Calendar, Building2, Briefcase } from 'lucide-react';
import { usePageGuard } from '@/hooks/usePageGuard';

export default function ClientRegister() {
  const { canRender } = usePageGuard('counselor');
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    age: '',
    gender: '남',
    branch: '',
    businessType: '취업성공패키지',
    processStage: '초기상담',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      toast.error('이름과 연락처는 필수 입력 항목입니다.');
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setLoading(false);
    toast.success(`${form.name}님이 등록되었습니다.`);
    navigate('/clients/list');
  };

  if (!canRender) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/clients/list')}
          className="p-1.5 rounded-sm hover:bg-muted transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">상담자 등록</h1>
          <p className="text-sm text-muted-foreground mt-0.5">새 상담자 정보를 입력하세요</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Info */}
        <div className="bg-card rounded-md p-5 shadow-sm border border-border space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <User size={15} />
            기본 정보
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium mb-1.5">
                이름 <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="홍길동"
                className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">성별</label>
              <div className="flex gap-2">
                {['남', '여'].map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => update('gender', g)}
                    className={`flex-1 py-2 rounded-sm text-sm font-medium border transition-all ${
                      form.gender === g ? 'text-white' : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                    style={form.gender === g ? { background: '#009C64', borderColor: '#009C64' } : {}}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                연락처 <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => update('phone', e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full pl-8 pr-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">나이</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="number"
                  value={form.age}
                  onChange={e => update('age', e.target.value)}
                  placeholder="30"
                  min="15"
                  max="80"
                  className="w-full pl-8 pr-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">이메일</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                placeholder="example@email.com"
                className="w-full pl-8 pr-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Counseling Info */}
        <div className="bg-card rounded-md p-5 shadow-sm border border-border space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Briefcase size={15} />
            상담 정보
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">지점</label>
              <div className="relative">
                <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={form.branch}
                  onChange={e => update('branch', e.target.value)}
                  placeholder="서울 강남지점"
                  className="w-full pl-8 pr-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">초기 단계</label>
              <select
                value={form.processStage}
                onChange={e => update('processStage', e.target.value)}
                className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {['초기상담', '심층상담', '취업지원', '취업완료', '사후관리'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">사업 유형</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['취업성공패키지', '일반취업', '창업지원', '직업훈련'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => update('businessType', type)}
                  className={`py-2 px-2 rounded-sm text-xs font-medium border transition-all ${
                    form.businessType === type ? 'text-white' : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                  style={form.businessType === type ? { background: '#009C64', borderColor: '#009C64' } : {}}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">메모</label>
            <textarea
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              placeholder="특이사항이나 메모를 입력하세요..."
              rows={3}
              className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => navigate('/clients/list')}
            className="btn-cancel"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-60"
          >
            {loading ? '등록 중...' : '등록하기'}
          </button>
        </div>
      </form>
    </div>
  );
}
