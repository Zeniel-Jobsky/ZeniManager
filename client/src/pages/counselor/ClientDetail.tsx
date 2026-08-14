/**
 * Client Detail Page (상담자 상세 정보)
 */
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useParams } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import {
  ChevronLeft, User, Phone, Edit3, ClipboardList,
  Loader2, Trash2, Save, AlertTriangle, ChevronRight, Plus,
  Check, X
} from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchClientById, fetchSessions, createSession,
  deleteSession, fetchSurveys, createSurvey, updateClient, updateSession
} from '@/lib/api';
import type { ClientRow, SessionRow, SurveyRow } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/supabase';
import { ClientSummaryAnalysisTab } from './ClientSummaryAnalysisTab';

const PRIMARY = '#009C64';

type ClientTab = 'manage' | 'history' | 'input' | 'survey' | 'summary';

// ─── Survey Definitions ──────────────────────────────────────────────────────

const SURVEY_QUESTIONS = [
  { key: 'q1_job_goal', label: '구직목표 수립', desc: '취업하고자 하는 직종이나 분야에 대한 목표가 있습니까?' },
  { key: 'q2_will_3months', label: '3개월 내 구직의지', desc: '3개월 이내에 취업하고자 하는 의지가 있습니까?' },
  { key: 'q3_job_plan', label: '희망직종 구직계획', desc: '희망 직종에 취업하기 위한 구체적인 계획이 있습니까?' },
  { key: 'q4_skill_need', label: '구직기술 필요도', desc: '이력서 작성, 면접 준비 등 구직기술 지원이 필요합니까?' },
  { key: 'q5_info_need', label: '구직정보 필요도', desc: '취업처 발굴, 채용정보 등 구직정보 지원이 필요합니까?' },
  { key: 'q6_competency', label: '취업역량 향상도', desc: '직업훈련, 자격증 취득 등 취업역량 향상 지원이 필요합니까?' },
  { key: 'q7_barrier', label: '취업장애요인', desc: '건강, 가족돌봄, 교통 등 취업에 장애가 되는 요인이 있습니까?' },
  { key: 'q8_health', label: '건강상태', desc: '현재 건강상태는 취업활동에 지장이 없습니까?' },
] as const;

const SURVEY_OPTIONS = [
  { value: 3, label: '예', color: '#009C64' },
  { value: 2, label: '보통', color: '#f59e0b' },
  { value: 1, label: '아니오', color: '#ef4444' },
];

function SurveyTab({ clientId, counselorId }: { clientId: string; counselorId?: string }) {
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [barrierDetail, setBarrierDetail] = useState('');
  const [surveyDate, setSurveyDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSurveys(clientId);
      setSurveys(data);
    } catch (e: any) {
      toast.error('설문 데이터 로드 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const totalScore = SURVEY_QUESTIONS.reduce((sum, q) => sum + (answers[q.key] || 0), 0);
  const maxScore = SURVEY_QUESTIONS.length * 3;

  const handleSave = async () => {
    if (Object.keys(answers).length < SURVEY_QUESTIONS.length) {
      toast.error('모든 항목에 응답해주세요.');
      return;
    }
    if (!isSupabaseConfigured()) {
      toast.error('Supabase 설정이 필요합니다.');
      return;
    }
    setSaving(true);
    try {
      await createSurvey({
        client_id: clientId,
        counselor_id: counselorId || null,
        survey_date: surveyDate,
        q1_job_goal: answers['q1_job_goal'] || null,
        q2_will_3months: answers['q2_will_3months'] || null,
        q3_job_plan: answers['q3_job_plan'] || null,
        q4_skill_need: answers['q4_skill_need'] || null,
        q5_info_need: answers['q5_info_need'] || null,
        q6_competency: answers['q6_competency'] || null,
        q7_barrier: answers['q7_barrier'] || null,
        q7_barrier_detail: barrierDetail || null,
        q8_health: answers['q8_health'] || null,
      } as any);
      toast.success('설문이 저장되었습니다.');
      setShowForm(false);
      setAnswers({});
      setBarrierDetail('');
      load();
    } catch (e: any) {
      toast.error('저장 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={20} className="animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-foreground">구직준비도 설문 이력</div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium text-white"
          style={{ background: PRIMARY }}
        >
          <Plus size={12} />
          새 설문 입력
        </button>
      </div>

      {showForm && (
        <div className="border border-border rounded-sm p-4 space-y-4 bg-muted/10">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">구직준비도 점검 설문지</div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">설문일</label>
              <input
                type="date"
                value={surveyDate}
                onChange={e => setSurveyDate(e.target.value)}
                className="text-xs px-2 py-1 rounded-sm border border-input bg-background"
              />
            </div>
          </div>

          <div className="space-y-3">
            {SURVEY_QUESTIONS.map((q, idx) => (
              <div key={q.key} className="space-y-1.5">
                <div className="text-xs font-medium text-foreground">{idx + 1}. {q.label}</div>
                <div className="text-xs text-muted-foreground">{q.desc}</div>
                <div className="flex gap-2">
                  {SURVEY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAnswers(a => ({ ...a, [q.key]: opt.value }))}
                      className="flex-1 py-1.5 rounded-sm text-xs font-medium border transition-all"
                      style={answers[q.key] === opt.value
                        ? { background: opt.color, borderColor: opt.color, color: 'white' }
                        : { borderColor: '#e5e7eb', color: '#6b7280' }
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="text-sm">총점: <span className="font-bold" style={{ color: PRIMARY }}>{totalScore}</span></div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary py-1.5 px-3 text-xs">저장</button>
              <button onClick={() => setShowForm(false)} className="btn-cancel py-1.5 px-3 text-xs">취소</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {surveys.map(s => (
          <div key={s.id} className="border border-border rounded-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{s.survey_date} 설문</div>
              <div className="text-xs text-muted-foreground">총점: {s.total_score}점</div>
            </div>
            <div className="text-sm font-bold" style={{ color: PRIMARY }}>{Math.round(((s.total_score || 0) / 24) * 100)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const [client, setClient] = useState<ClientRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ClientTab>('manage');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newSession, setNewSession] = useState({
    type: '초기상담',
    content: '',
    nextAction: '',
    date: new Date().toISOString().split('T')[0],
    session_number: 1,
    start_time: '',
    end_time: '',
    holland_code: '',
    profiling_grade: '',
    document_link: '',
  });

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionContent, setEditSessionContent] = useState<string>('');

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchClientById(id);
      if (data) setClient(data);
      else toast.error('상담자 정보를 찾을 수 없습니다.');
    } catch (e: any) {
      toast.error('데이터 로드 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadSessions = useCallback(async () => {
    if (!id) return;
    setSessionsLoading(true);
    try {
      const data = await fetchSessions(id);
      setSessions(data);
    } catch (e: any) {
      toast.error('상담 이력 로드 실패');
    } finally {
      setSessionsLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (activeTab === 'history' || activeTab === 'input') loadSessions();
  }, [activeTab, loadSessions]);

  const startEdit = (field: string, initialValue: any) => {
    setEditingField(field);
    setEditValue(String(initialValue ?? ''));
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleUpdateField = async (field: string) => {
    if (!id || !client) return;
    setSaving(true);
    try {
      if (field === 'memo') {
        await updateClient(id, { memo: editValue });
        setClient({ ...client, memo: editValue } as ClientRow);
        toast.success('적용되었습니다.');
        setEditingField(null);
        return;
      }

      // Map frontend fields (ClientRow) back to Supabase column names
      let dbKey = field;
      let val: any = editValue;

      if (field === 'name') dbKey = 'client_name';
      if (field === 'phone') dbKey = 'phone_encrypted';
      if (field === 'gender') {
        dbKey = 'gender_code';
        val = editValue === '남' ? 'M' : 'F';
      }
      if (field === 'school') dbKey = 'school_name';
      if (field === 'desired_job') dbKey = 'desired_job_1';
      if (field === 'business_type') {
        dbKey = 'business_type_code';
        const num = Number(editValue);
        val = isNaN(num) ? null : num;
      }

      // Numeric fields conversion
      if (field === 'age' || field === 'retest_stat') {
        const num = Number(editValue);
        val = isNaN(num) ? null : num;
      }

      await updateClient(id, { [dbKey]: val });

      // Update local state with the same key used in ClientRow
      setClient({ ...client, [field]: val } as ClientRow);
      toast.success('적용되었습니다.');
      setEditingField(null);
    } catch (e: any) {
      toast.error('수정 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSession = async (session: SessionRow) => {
    try {
      await updateSession(session.id, {
        ...session,
        content: editSessionContent
      });
      setSessions(prev => prev.map(s => s.id === session.id ? { ...s, content: editSessionContent } : s));
      toast.success('상담 이력이 수정되었습니다.');
      setEditingSessionId(null);
    } catch (e: any) {
      toast.error('수정 실패: ' + e.message);
    }
  };

  useEffect(() => {
    const used = sessions.filter(s => (s.type === newSession.type || (newSession.type === '일반상담' && !s.type))).map(s => s.session_number);
    let nextNum = 1;
    while (used.includes(nextNum)) nextNum++;
    setNewSession(prev => ({ ...prev, session_number: nextNum }));
  }, [newSession.type, sessions]);

  const handleSaveSession = async () => {
    if (!newSession.content.trim()) { toast.error('상담 내용을 입력해주세요.'); return; }
    if (!id) return;
    setSaving(true);
    try {
      await createSession({
        client_id: id,
        date: newSession.date,
        type: newSession.type,
        content: newSession.content,
        counselor_name: user?.name || null,
        counselor_id: user?.id || null,
        next_action: newSession.nextAction || null,
        session_number: newSession.session_number,
        start_time: newSession.start_time || null,
        end_time: newSession.end_time || null,
        holland_code: newSession.holland_code || null,
        profiling_grade: newSession.profiling_grade || null,
        document_link: newSession.document_link || null,
      });
      toast.success('저장되었습니다.');
      setNewSession({ ...newSession, content: '', nextAction: '', start_time: '', end_time: '', holland_code: '', profiling_grade: '', document_link: '' });
      loadSessions();
      setActiveTab('history');
    } catch (e: any) {
      toast.error('저장 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSession = async (sid: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      await deleteSession(sid);
      setSessions(prev => prev.filter(s => s.id !== sid));
      toast.success('삭제되었습니다.');
    } catch (e: any) {
      toast.error('삭제 실패');
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <Loader2 size={24} className="animate-spin text-muted-foreground mb-2" />
      <span className="text-sm text-muted-foreground">상담자 정보를 불러오는 중...</span>
    </div>
  );

  if (!client) return (
    <div className="p-8 text-center text-muted-foreground">상담자를 찾을 수 없습니다.</div>
  );

  const stageColors: Record<string, string> = {
    '초기상담': 'badge-active', '심층상담': 'badge-pending',
    '취업지원': 'badge-pending', '취업완료': 'badge-completed', '사후관리': 'badge-active',
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/clients/list')} className="p-1.5 rounded-sm hover:bg-muted transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm flex items-center justify-center text-white font-bold text-lg" style={{ background: PRIMARY }}>
            {client.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              {client.name} 
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">#{client.id}</span>
            </h1>
            <p className="text-sm text-muted-foreground">{client.phone || '연락처 없음'} · {client.counselor_name || '담당자 미지정'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-card rounded-t-md px-2 overflow-x-auto">
        {[
          { id: 'manage', label: '상담관리' },
          { id: 'history', label: '상담이력' },
          { id: 'input', label: '상담입력' },
          { id: 'survey', label: '\uad6c\uc9c1\uc900\ube44\ub3c4' },
          { id: 'summary', label: '\uc694\uc57d \ubc0f \ubd84\uc11d' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ClientTab)}
            className="px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap"
            style={activeTab === tab.id
              ? { borderColor: PRIMARY, color: PRIMARY }
              : { borderColor: 'transparent', color: '#6b7280' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-card rounded-b-md border border-t-0 border-border p-6 shadow-sm min-h-[500px]">
        {activeTab === 'manage' && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <section>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">기본 정보</h3>
                <div className="space-y-4">
                  {/* Name */}
                  <div className="group">
                    <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">성함</label>
                    {editingField === 'name' ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="flex-1 text-sm bg-background border border-primary px-2 py-1 rounded-sm outline-none"
                        />
                        <button onClick={() => handleUpdateField('name')} className="p-1 text-primary hover:bg-primary/10 rounded-sm"><Check size={16} /></button>
                        <button onClick={cancelEdit} className="p-1 text-muted-foreground hover:bg-muted rounded-sm"><X size={16} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-sm group-hover:bg-muted/30 p-1 -m-1 rounded-sm transition-colors">
                        <div className="flex items-center gap-2"><User size={14} className="text-muted-foreground" /> {client.name}</div>
                        <button onClick={() => startEdit('name', client.name)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-primary transition-all"><Edit3 size={13} /></button>
                      </div>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="group">
                    <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">연락처</label>
                    {editingField === 'phone' ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="flex-1 text-sm bg-background border border-primary px-2 py-1 rounded-sm outline-none"
                        />
                        <button onClick={() => handleUpdateField('phone')} className="p-1 text-primary hover:bg-primary/10 rounded-sm"><Check size={16} /></button>
                        <button onClick={cancelEdit} className="p-1 text-muted-foreground hover:bg-muted rounded-sm"><X size={16} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-sm group-hover:bg-muted/30 p-1 -m-1 rounded-sm transition-colors">
                        <div className="flex items-center gap-2"><Phone size={14} className="text-muted-foreground" /> {client.phone || '-'}</div>
                        <button onClick={() => startEdit('phone', client.phone)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-primary transition-all"><Edit3 size={13} /></button>
                      </div>
                    )}
                  </div>

                  {/* Age/Gender */}
                  <div className="group">
                    <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">나이 / 성별</label>
                    <div className="flex items-center justify-between text-sm group-hover:bg-muted/30 p-1 -m-1 rounded-sm transition-colors">
                      <div className="flex items-center gap-4">
                        {/* Age Edit */}
                        <div className="flex items-center gap-1 group/age">
                          {editingField === 'age' ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                autoFocus
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                className="w-12 text-sm bg-background border border-primary px-1 rounded-sm outline-none"
                              />
                              <span>세</span>
                              <button onClick={() => handleUpdateField('age')} className="p-0.5 text-primary hover:bg-primary/10 rounded-sm"><Check size={14} /></button>
                              <button onClick={cancelEdit} className="p-0.5 text-muted-foreground hover:bg-muted rounded-sm"><X size={14} /></button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span>{client.age}세</span>
                              <button onClick={() => startEdit('age', client.age)} className="opacity-0 group-hover/age:opacity-100 p-0.5 text-muted-foreground hover:text-primary transition-all"><Edit3 size={11} /></button>
                            </div>
                          )}
                        </div>

                        <div className="w-[1px] h-3 bg-border"></div>

                        {/* Gender Edit */}
                        <div className="flex items-center gap-1 group/gender">
                          {editingField === 'gender' ? (
                            <div className="flex items-center gap-1">
                              <select
                                autoFocus
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                className="text-sm bg-background border border-primary rounded-sm outline-none cursor-pointer"
                              >
                                <option value="남">남</option>
                                <option value="여">여</option>
                              </select>
                              <button onClick={() => handleUpdateField('gender')} className="p-0.5 text-primary hover:bg-primary/10 rounded-sm"><Check size={14} /></button>
                              <button onClick={cancelEdit} className="p-0.5 text-muted-foreground hover:bg-muted rounded-sm"><X size={14} /></button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span>{client.gender || '성별 미지정'}</span>
                              <button onClick={() => startEdit('gender', client.gender)} className="opacity-0 group-hover/gender:opacity-100 p-0.5 text-muted-foreground hover:text-primary transition-all"><Edit3 size={11} /></button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Education */}
                  <div className="group">
                    <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">학력</label>
                    {editingField === 'education_level' ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="flex-1 text-sm bg-background border border-primary px-2 py-1 rounded-sm outline-none"
                        />
                        <button onClick={() => handleUpdateField('education_level')} className="p-1 text-primary hover:bg-primary/10 rounded-sm"><Check size={16} /></button>
                        <button onClick={cancelEdit} className="p-1 text-muted-foreground hover:bg-muted rounded-sm"><X size={16} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-sm group-hover:bg-muted/30 p-1 -m-1 rounded-sm transition-colors">
                        <div>{client.education_level || '-'}</div>
                        <button onClick={() => startEdit('education_level', client.education_level)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-primary transition-all"><Edit3 size={13} /></button>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">진행 현황</h3>
                <div className="space-y-4">
                  <div className="group">
                    <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">참여단계</label>
                    {editingField === 'participation_stage' ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="flex-1 text-sm bg-background border border-primary px-2 py-1 rounded-sm outline-none cursor-pointer"
                        >
                          {Object.keys(stageColors).map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <button onClick={() => handleUpdateField('participation_stage')} className="p-1 text-primary hover:bg-primary/10 rounded-sm"><Check size={16} /></button>
                        <button onClick={cancelEdit} className="p-1 text-muted-foreground hover:bg-muted rounded-sm"><X size={16} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-sm group-hover:bg-muted/30 p-1 -m-1 rounded-sm transition-colors cursor-pointer" onClick={() => startEdit('participation_stage', client.participation_stage)}>
                        <span className={stageColors[client.participation_stage || ''] || 'badge-active'}>{client.participation_stage || '초기'}</span>
                        <button className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground transition-all"><Edit3 size={13} /></button>
                      </div>
                    )}
                  </div>

                  {/* Score uses retest_stat only so detail/list/dashboard all share one live source of truth. */}
                  <div className="group">
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="text-[11px] font-medium text-muted-foreground">점수</label>
                    </div>
                    {editingField === 'retest_stat' ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="w-20 text-sm bg-background border border-primary px-2 py-1 rounded-sm outline-none font-bold text-primary"
                        />
                        <span className="text-sm font-bold text-primary">점</span>
                        <div className="flex-1"></div>
                        <button onClick={() => handleUpdateField('retest_stat')} className="p-1 text-primary hover:bg-primary/10 rounded-sm"><Check size={16} /></button>
                        <button onClick={cancelEdit} className="p-1 text-muted-foreground hover:bg-muted rounded-sm"><X size={16} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between group-hover:bg-muted/30 p-1 -m-1 rounded-sm transition-colors">
                        <div className="text-lg font-bold" style={{ color: PRIMARY }}>{client.retest_stat ?? '-'}</div>
                        <button onClick={() => startEdit('retest_stat', client.retest_stat)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-primary transition-all"><Edit3 size={13} /></button>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Memo */}
              <section className="group">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">메모</h3>
                  {editingField !== 'memo' && (
                    <button onClick={() => startEdit('memo', client.memo)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-primary transition-all"><Edit3 size={13} /></button>
                  )}
                </div>
                {editingField === 'memo' ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      rows={5}
                      className="w-full text-sm bg-background border border-primary px-3 py-2 rounded-sm outline-none resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-1 text-xs border border-border rounded-sm hover:bg-muted transition-colors"><X size={14} /> 취소</button>
                      <button onClick={() => handleUpdateField('memo')} className="flex items-center gap-1 px-3 py-1 text-xs text-white rounded-sm transition-colors" style={{ background: PRIMARY }}><Check size={14} /> 저장</button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-muted/30 rounded-sm text-sm whitespace-pre-wrap group-hover:bg-muted/50 transition-colors">{client.memo || '메모가 없습니다.'}</div>
                )}
              </section>
            </div>

            {/* Second Column: Detailed Info */}
            <div className="space-y-6">
              <section>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">상세 정보</h3>
                <div className="space-y-4">
                  {/* Business Type */}
                  <div className="group">
                    <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">사업 유형</label>
                    {editingField === 'business_type' ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="flex-1 text-sm bg-background border border-primary px-2 py-1 rounded-sm outline-none"
                        />
                        <button onClick={() => handleUpdateField('business_type')} className="p-1 text-primary hover:bg-primary/10 rounded-sm"><Check size={16} /></button>
                        <button onClick={cancelEdit} className="p-1 text-muted-foreground hover:bg-muted rounded-sm"><X size={16} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-sm group-hover:bg-muted/30 p-1 -m-1 rounded-sm transition-colors">
                        <div>{client.business_type || '-'}</div>
                        <button onClick={() => startEdit('business_type', client.business_type)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-primary transition-all"><Edit3 size={13} /></button>
                      </div>
                    )}
                  </div>

                  {/* Participation Type */}
                  <div className="group">
                    <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">참여 유형</label>
                    {editingField === 'participation_type' ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="flex-1 text-sm bg-background border border-primary px-2 py-1 rounded-sm outline-none"
                        />
                        <button onClick={() => handleUpdateField('participation_type')} className="p-1 text-primary hover:bg-primary/10 rounded-sm"><Check size={16} /></button>
                        <button onClick={cancelEdit} className="p-1 text-muted-foreground hover:bg-muted rounded-sm"><X size={16} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-sm group-hover:bg-muted/30 p-1 -m-1 rounded-sm transition-colors">
                        <div>{client.participation_type || '-'}</div>
                        <button onClick={() => startEdit('participation_type', client.participation_type)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-primary transition-all"><Edit3 size={13} /></button>
                      </div>
                    )}
                  </div>

                  {/* Desired Job */}
                  <div className="group">
                    <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">희망 직종</label>
                    {editingField === 'desired_job' ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="flex-1 text-sm bg-background border border-primary px-2 py-1 rounded-sm outline-none"
                        />
                        <button onClick={() => handleUpdateField('desired_job')} className="p-1 text-primary hover:bg-primary/10 rounded-sm"><Check size={16} /></button>
                        <button onClick={cancelEdit} className="p-1 text-muted-foreground hover:bg-muted rounded-sm"><X size={16} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-sm group-hover:bg-muted/30 p-1 -m-1 rounded-sm transition-colors">
                        <div>{client.desired_job || '-'}</div>
                        <button onClick={() => startEdit('desired_job', client.desired_job)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-primary transition-all"><Edit3 size={13} /></button>
                      </div>
                    )}
                  </div>

                  {/* School & Major Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="group">
                      <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">학교</label>
                      {editingField === 'school' ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="flex-1 text-sm bg-background border border-primary px-2 py-1 rounded-sm outline-none w-full"
                          />
                          <button onClick={() => handleUpdateField('school')} className="p-1 text-primary hover:bg-primary/10 rounded-sm"><Check size={16} /></button>
                          <button onClick={cancelEdit} className="p-1 text-muted-foreground hover:bg-muted rounded-sm"><X size={16} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-sm group-hover:bg-muted/30 p-1 -m-1 rounded-sm transition-colors">
                          <div className="truncate">{client.school || '-'}</div>
                          <button onClick={() => startEdit('school', client.school)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-primary transition-all shrink-0"><Edit3 size={13} /></button>
                        </div>
                      )}
                    </div>
                    
                    <div className="group">
                      <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">전공</label>
                      {editingField === 'major' ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="flex-1 text-sm bg-background border border-primary px-2 py-1 rounded-sm outline-none w-full"
                          />
                          <button onClick={() => handleUpdateField('major')} className="p-1 text-primary hover:bg-primary/10 rounded-sm"><Check size={16} /></button>
                          <button onClick={cancelEdit} className="p-1 text-muted-foreground hover:bg-muted rounded-sm"><X size={16} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-sm group-hover:bg-muted/30 p-1 -m-1 rounded-sm transition-colors">
                          <div className="truncate">{client.major || '-'}</div>
                          <button onClick={() => startEdit('major', client.major)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-primary transition-all shrink-0"><Edit3 size={13} /></button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Driving & Car Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="group">
                      <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">운전가능 여부</label>
                      {editingField === 'driving_yn' ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="flex-1 text-sm bg-background border border-primary px-2 py-1 rounded-sm outline-none w-full"
                            placeholder="Y/N"
                          />
                          <button onClick={() => handleUpdateField('driving_yn')} className="p-1 text-primary hover:bg-primary/10 rounded-sm"><Check size={16} /></button>
                          <button onClick={cancelEdit} className="p-1 text-muted-foreground hover:bg-muted rounded-sm"><X size={16} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-sm group-hover:bg-muted/30 p-1 -m-1 rounded-sm transition-colors">
                          <div>{client.driving_yn === 'Y' || client.driving_yn === 'y' || client.driving_yn === '가능' ? '가능' : client.driving_yn === 'N' || client.driving_yn === 'n' || client.driving_yn === '불가능' ? '불가능' : (client.driving_yn || '-')}</div>
                          <button onClick={() => startEdit('driving_yn', client.driving_yn)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-primary transition-all shrink-0"><Edit3 size={13} /></button>
                        </div>
                      )}
                    </div>
                    
                    <div className="group">
                      <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">자차 여부</label>
                      {editingField === 'own_car_yn' ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="flex-1 text-sm bg-background border border-primary px-2 py-1 rounded-sm outline-none w-full"
                            placeholder="Y/N"
                          />
                          <button onClick={() => handleUpdateField('own_car_yn')} className="p-1 text-primary hover:bg-primary/10 rounded-sm"><Check size={16} /></button>
                          <button onClick={cancelEdit} className="p-1 text-muted-foreground hover:bg-muted rounded-sm"><X size={16} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-sm group-hover:bg-muted/30 p-1 -m-1 rounded-sm transition-colors">
                          <div>{client.own_car_yn === 'Y' || client.own_car_yn === 'y' || client.own_car_yn === '있음' ? '있음' : client.own_car_yn === 'N' || client.own_car_yn === 'n' || client.own_car_yn === '없음' ? '없음' : (client.own_car_yn || '-')}</div>
                          <button onClick={() => startEdit('own_car_yn', client.own_car_yn)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-primary transition-all shrink-0"><Edit3 size={13} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            {sessionsLoading ? <Loader2 className="animate-spin mx-auto mt-8 opacity-20" /> :
              sessions.length === 0 ? <p className="text-center py-12 text-muted-foreground text-sm">기록된 상담 이력이 없습니다.</p> :
                sessions.map(s => (
                  <div key={s.id} className="border border-border rounded-sm p-4 hover:bg-muted/10 transition-colors group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="badge-active px-2 py-0.5">{s.type || '일반상담'}</span>
                        {s.session_number != null && (
                          <>
                            <span className="text-muted-foreground text-xs">-</span>
                            <span className="badge-pending px-2 py-0.5">{s.session_number}회차</span>
                          </>
                        )}
                        <span className="text-xs text-muted-foreground ml-1">{s.date}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {editingSessionId !== s.id && (
                          <button onClick={() => { setEditingSessionId(s.id); setEditSessionContent(s.content || ''); }} className="p-1 hover:text-primary transition-colors"><Edit3 size={14} /></button>
                        )}
                        <button onClick={() => handleDeleteSession(s.id)} className="p-1 hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>

                    {editingSessionId === s.id ? (
                      <div className="space-y-2">
                        <textarea
                          autoFocus
                          value={editSessionContent}
                          onChange={e => setEditSessionContent(e.target.value)}
                          rows={4}
                          className="w-full text-sm bg-background border border-primary px-3 py-2 rounded-sm outline-none resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditingSessionId(null)} className="flex items-center gap-1 px-3 py-1 text-[11px] border border-border rounded-sm hover:bg-muted transition-colors"><X size={12} /> 취소</button>
                          <button onClick={() => handleUpdateSession(s)} className="flex items-center gap-1 px-3 py-1 text-[11px] text-white rounded-sm transition-colors" style={{ background: PRIMARY }}><Check size={12} /> 저장</button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{s.content}</p>
                    )}
                  </div>
                ))}
          </div>
        )}

        {activeTab === 'input' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium mb-1.5 block">상담유형</label>
                <select
                  value={newSession.type}
                  onChange={e => setNewSession({ ...newSession, type: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-sm text-sm"
                >
                  {['초기상담', '심층상담', '취업지원', '사후관리', '집단상담', '기타'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block">상담회차</label>
                <select
                  value={newSession.session_number}
                  onChange={e => setNewSession({ ...newSession, session_number: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-input rounded-sm text-sm"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(n => {
                    const isUsed = sessions.some(s => (s.type === newSession.type || (!s.type && newSession.type === '일반상담')) && s.session_number === n);
                    return (
                      <option key={n} value={n} disabled={isUsed}>
                        {n}회차 {isUsed ? "(작성됨)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block">상담일</label>
                <input
                  type="date"
                  value={newSession.date}
                  onChange={e => setNewSession({ ...newSession, date: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-sm text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium mb-1.5 block">상담 시간 <span className="text-muted-foreground font-normal">(선택)</span></label>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={newSession.start_time}
                    onChange={e => setNewSession({...newSession, start_time: e.target.value})}
                    className="flex-1 px-3 py-2 border border-input rounded-sm text-sm"
                  />
                  <span className="flex items-center text-muted-foreground">-</span>
                  <input
                    type="time"
                    value={newSession.end_time}
                    onChange={e => setNewSession({...newSession, end_time: e.target.value})}
                    className="flex-1 px-3 py-2 border border-input rounded-sm text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block">첨부 파일 <span className="text-muted-foreground font-normal">(추후 업데이트 예정)</span></label>
                <div className="flex px-3 py-2 border border-input rounded-sm border-dashed items-center justify-center text-muted-foreground text-sm cursor-not-allowed bg-muted/20">
                  <span className="mr-2">📎</span> 첨부파일 선택
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium mb-1.5 block">프로파일링 등급 <span className="text-muted-foreground font-normal">(선택)</span></label>
                <input
                    type="text"
                    placeholder="예: A등급"
                    value={newSession.profiling_grade}
                    onChange={e => setNewSession({...newSession, profiling_grade: e.target.value})}
                    className="w-full px-3 py-2 border border-input rounded-sm text-sm"
                 />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block">홀랜드 코드 <span className="text-muted-foreground font-normal">(선택)</span></label>
                <input
                    type="text"
                    placeholder="예: RIA"
                    value={newSession.holland_code}
                    onChange={e => setNewSession({...newSession, holland_code: e.target.value})}
                    className="w-full px-3 py-2 border border-input rounded-sm text-sm"
                 />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block">상담내용</label>
              <textarea
                rows={8}
                value={newSession.content}
                onChange={e => setNewSession({ ...newSession, content: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-sm text-sm resize-none"
                placeholder="상담 내용을 상세히 입력하세요..."
              />
            </div>
            <button
              onClick={handleSaveSession}
              disabled={saving}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              상담 일지 저장
            </button>
          </div>
        )}

        {activeTab === 'survey' && (
          <SurveyTab clientId={id!} counselorId={user?.counselorId} />
        )}

        {activeTab === 'summary' && (
          <ClientSummaryAnalysisTab client={client} />
        )}
      </div>
    </div>
  );
}
