/**
 * api.ts — Supabase data access layer
 * All functions require Supabase to be configured.
 * Mock data has been removed.
 */
import { normalizeAppRole } from '@shared/const';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import type {
  ClientRow, ClientInsert,
  SessionRow, SessionInsert,
  CounselorRow, CounselorInsert,
  SurveyRow, SurveyInsert,
  MemoCardRow, MemoCardInsert,
} from './supabase';

// ─── Helper ───────────────────────────────────────────────────────────────────

function sb() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase가 설정되지 않았습니다. 설정 메뉴에서 Supabase URL과 API 키를 입력하세요.');
  return client;
}

const SESSION_META_MARKER = '\n\n[__CALENDAR_FLOW_META__]\n';

type LiveClientRecord = {
  client_id: number;
  client_name: string;
  counselor_id: string | null;
  age: number | null;
  gender_code: string | null;
  phone_encrypted: string | null;
  education_level: string | null;
  school_name: string | null;
  major: string | null;
  business_type_code: number | null;
  participation_type: string | null;
  participation_stage: string | null;
  desired_job_1: string | null;
  hire_type: string | null;
  job_place_start: string | null;
  job_place_end: string | null;
  iap_to: string | null;
  retest_stat: number | null;
  continue_serv_1_stat: string | null;
  memo: string | null;
  business_code?: { participate_type: string | null }[] | null;
  created_at: string | null;
  update_at: string | null;
};

type LiveCounselHistoryRecord = {
  counsel_id: number;
  client_id: number;
  user_id: string | null;
  counsel_date: string;
  start_time: string | null;
  end_time: string | null;
  session_number: number | null;
  counselor_opinion: string | null;
  counsel_type: string | null;
  create_at: string | null;
  document_link?: string | null;
  economic_situation?: number | null;
  social_situation_family?: number | null;
  social_situation_society?: number | null;
  self_esteem?: number | null;
  self_efficacy?: number | null;
  holland_code?: string | null;
  career_fluidity?: number | null;
  info_gathering?: number | null;
  personality_test_result?: string | null;
  life_history_result?: string | null;
  profiling_grade?: string | null;
  memo?: string | null;
};

function encodeSessionPayload(type: string, content: string, nextAction?: string | null): string {
  const meta = JSON.stringify({ type, nextAction: nextAction || null });
  return `${content}${SESSION_META_MARKER}${meta}`;
}

function decodeSessionPayload(
  rawContent: string | null | undefined,
  fallbackType?: string | null,
): { content: string | null; type: string; nextAction: string | null } {
  if (!rawContent) {
    return { content: null, type: fallbackType || '상담기록', nextAction: null };
  }

  const markerIndex = rawContent.indexOf(SESSION_META_MARKER);
  if (markerIndex < 0) {
    return { content: rawContent, type: fallbackType || '상담기록', nextAction: null };
  }

  const content = rawContent.slice(0, markerIndex);
  const metaRaw = rawContent.slice(markerIndex + SESSION_META_MARKER.length);

  try {
    const meta = JSON.parse(metaRaw) as { type?: string; nextAction?: string | null };
    return {
      content,
      type: meta.type || fallbackType || '상담기록',
      nextAction: meta.nextAction || null,
    };
  } catch {
    return { content: rawContent, type: fallbackType || '상담기록', nextAction: null };
  }
}

// ─── Clients ─────────────────────────────────────────────────────────────────

const CLIENT_SELECT_FIELDS = `
  client_id,
  client_name,
  counselor_id,
  age,
  gender_code,
  phone_encrypted,
  education_level,
  school_name,
  major,
  business_type_code,
  participation_type,
  participation_stage,
  desired_job_1,
  hire_type,
  job_place_start,
  job_place_end,
  iap_to,
  retest_stat,
  continue_serv_1_stat,
  memo,
  business_code (
    participate_type
  ),
  created_at,
  update_at
`;

export async function fetchClients(counselorId?: string): Promise<ClientRow[]> {
  if (!isSupabaseConfigured()) return [];

  let q = sb()
    .from('client')
    .select(CLIENT_SELECT_FIELDS)
    .order('iap_to', { ascending: true, nullsFirst: false });

  if (counselorId) q = q.eq('counselor_id', counselorId);

  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as LiveClientRecord[]).map(row => liveClientToRow(row));
}

export async function fetchClientById(id: string): Promise<ClientRow | null> {
  if (!isSupabaseConfigured()) return null;

  const numericId = Number(id);
  if (Number.isNaN(numericId)) return null;

  const { data, error } = await sb()
    .from('client')
    .select(CLIENT_SELECT_FIELDS)
    .eq('client_id', numericId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw error;
  }
  return liveClientToRow(data as LiveClientRecord);
}

export async function createClient(input: any): Promise<ClientRow> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');

  const payload = {
    client_name: input.name,
    counselor_id: input.counselor_id,
    age: input.age,
    gender_code: input.gender,
    phone_encrypted: input.phone,
    resident_id: input.resident_id,
    birth_date: input.birth_date,
    address_1: input.address_1,
    address_2: input.address_2,
    has_car: input.has_car,
    can_drive: input.can_drive,
    MBTI: input.MBTI,
    is_working_parttime: input.is_working_parttime,
    future_card_stat: input.future_card_stat ? 1 : 0,
    capa: input.capa,
    desired_job_1: input.desired_job_1,
    desired_job_2: input.desired_job_2,
    desired_job_3: input.desired_job_3,
    desired_area_1: input.desired_area_1,
    desired_area_2: input.desired_area_2,
    desired_area_3: input.desired_area_3,
    desired_payment: input.desired_payment,
    work_ex_desire: input.work_ex_desire ? Number(input.work_ex_desire) : null,
    work_ex_type: input.work_ex_type ? Number(input.work_ex_type) : null,
    work_ex_company: input.work_ex_company,
    work_ex_start: input.work_ex_start,
    work_ex_end: input.work_ex_end,
    work_ex_graduate: input.work_ex_graduate ? Number(input.work_ex_graduate) : null,
    education_level: input.education_level,
    school_name: input.school,
    major: input.major,
    business_type_code: input.business_type ? Number(input.business_type) : null,
    participation_type: input.participation_type,
    participation_stage: input.participation_stage,
    memo: input.memo,
  };

  const { data, error } = await sb()
    .from('client')
    .insert(payload)
    .select(CLIENT_SELECT_FIELDS)
    .single();

  if (error) throw error;
  return liveClientToRow(data as LiveClientRecord);
  return liveClientToRow(data as LiveClientRecord);
}

export async function updateClient(id: string, input: Partial<ClientInsert>): Promise<ClientRow> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');
  const { data, error } = await sb()
    .from('client')
    .update({ ...input, update_at: new Date().toISOString().split('T')[0] })
    .eq('client_id', Number(id))
    .select(CLIENT_SELECT_FIELDS)
    .single();
  if (error) throw error;
  return liveClientToRow(data as LiveClientRecord);
}

export async function deleteClient(id: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');
  const { error } = await sb().from('client').delete().eq('client_id', Number(id));
  if (error) throw error;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

const SESSION_SELECT_FIELDS =
  'counsel_id, client_id, user_id, counsel_date, start_time, end_time, session_number, counselor_opinion, counsel_type, document_link, economic_situation, social_situation_family, social_situation_society, self_esteem, self_efficacy, holland_code, career_fluidity, info_gathering, personality_test_result, life_history_result, profiling_grade, memo, create_at';

export async function fetchSessions(clientId: string): Promise<SessionRow[]> {
  if (!isSupabaseConfigured()) return [];

  const numericClientId = Number(clientId);
  if (Number.isNaN(numericClientId)) return [];

  const { data, error } = await sb()
    .from('counsel_history')
    .select(SESSION_SELECT_FIELDS)
    .eq('client_id', numericClientId)
    .order('counsel_date', { ascending: false })
    .order('start_time', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as LiveCounselHistoryRecord[]).map(row => liveCounselHistoryToSessionRow(row));
}

export async function createSession(input: SessionInsert): Promise<SessionRow> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');

  const numericClientId = Number(input.client_id);
  if (Number.isNaN(numericClientId)) throw new Error('유효한 상담자 ID가 아닙니다.');
  if (!input.counselor_id) throw new Error('로그인한 상담사 정보가 없습니다.');

  const payload: any = {
    client_id: numericClientId,
    user_id: input.counselor_id,
    counsel_date: input.date,
    create_at: input.date,
    counselor_opinion: input.content || '',
    counsel_type: input.type || '상담기록',
    start_time: input.start_time || null,
    end_time: input.end_time || null,
    document_link: input.document_link || null,
    economic_situation: input.economic_situation ?? null,
    social_situation_family: input.social_situation_family ?? null,
    social_situation_society: input.social_situation_society ?? null,
    self_esteem: input.self_esteem ?? null,
    self_efficacy: input.self_efficacy ?? null,
    holland_code: input.holland_code || null,
    career_fluidity: input.career_fluidity ?? null,
    info_gathering: input.info_gathering ?? null,
    personality_test_result: input.personality_test_result || null,
    life_history_result: input.life_history_result || null,
    profiling_grade: input.profiling_grade || null,
    memo: input.memo || null,
  };

  const { data, error } = await sb()
    .from('counsel_history')
    .insert(payload)
    .select(SESSION_SELECT_FIELDS)
    .single();

  if (error) throw error;
  return liveCounselHistoryToSessionRow(data as LiveCounselHistoryRecord);
}

export async function updateSession(id: string, input: Partial<SessionInsert>): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');

  const { error } = await sb()
    .from('counsel_history')
    .update({
      counselor_opinion: input.content || '',
      counsel_type: input.type || '상담기록',
      counsel_date: input.date,
    })
    .eq('counsel_id', Number(id));

  if (error) throw error;
}

export async function deleteSession(id: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');
  const counselId = Number(id);
  if (Number.isNaN(counselId)) throw new Error('유효한 상담 이력 ID가 아닙니다.');
  const { error } = await sb().from('counsel_history').delete().eq('counsel_id', counselId);
  if (error) throw error;
}

// ─── Counselors ───────────────────────────────────────────────────────────────

export async function fetchCounselors(): Promise<CounselorRow[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await sb()
    .from('user')
    .select('user_id, user_name, department, memo, role')
    .order('user_name');

  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    user_id: row.user_id,
    user_name: row.user_name ?? '이름 미상',
    department: row.department ?? '',
    memo: row.memo ?? null,
    role: row.role != null ? normalizeAppRole(row.role) : null,
    client_count: 0,
    completed_count: 0,
  }));
}

export async function createCounselor(input: CounselorInsert): Promise<CounselorRow> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');
  const payload = {
    user_name: input.user_name,
    department: input.department ?? '',
    memo: input.memo ?? null,
    role: input.role ?? null,
  };
  const { data, error } = await sb()
    .from('user')
    .insert(payload)
    .select('user_id, user_name, department, memo, role')
    .single();
  if (error) throw error;
  return {
    user_id: (data as any).user_id,
    user_name: (data as any).user_name ?? '이름 미상',
    department: (data as any).department ?? '',
    memo: (data as any).memo ?? null,
    role: (data as any).role != null ? normalizeAppRole((data as any).role) : null,
    client_count: 0,
    completed_count: 0,
  };
}

export async function updateCounselor(userId: string, input: Partial<CounselorInsert>): Promise<CounselorRow> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');
  const payload: Record<string, unknown> = {};
  if (input.user_name != null) payload.user_name = input.user_name;
  if (input.department != null) payload.department = input.department;
  if (input.memo !== undefined) payload.memo = input.memo;
  if (input.role !== undefined) payload.role = input.role;
  const { data, error } = await sb()
    .from('user')
    .update(payload)
    .eq('user_id', userId)
    .select('user_id, user_name, department, memo, role')
    .single();
  if (error) throw error;
  return {
    user_id: (data as any).user_id,
    user_name: (data as any).user_name ?? '이름 미상',
    department: (data as any).department ?? '',
    memo: (data as any).memo ?? null,
    role: (data as any).role != null ? normalizeAppRole((data as any).role) : null,
    client_count: 0,
    completed_count: 0,
  };
}

export async function deleteCounselor(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');
  const { error } = await sb().from('user').delete().eq('user_id', userId);
  if (error) throw error;
}

// ─── Surveys ─────────────────────────────────────────────────────────────────

export async function fetchSurveys(clientId: string): Promise<SurveyRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await sb()
    .from('survey_responses')
    .select('*')
    .eq('client_id', clientId)
    .order('survey_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createSurvey(input: SurveyInsert): Promise<SurveyRow> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');
  const { data, error } = await sb().from('survey_responses').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateSurvey(id: string, input: Partial<SurveyInsert>): Promise<SurveyRow> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');
  const { data, error } = await sb()
    .from('survey_responses')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Memo Cards ───────────────────────────────────────────────────────────────

export async function fetchMemoCards(counselorId: string): Promise<MemoCardRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await sb()
    .from('memo_cards')
    .select('*')
    .eq('counselor_id', counselorId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createMemoCard(input: MemoCardInsert): Promise<MemoCardRow> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');
  const { data, error } = await sb().from('memo_cards').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateMemoCard(id: string, input: Partial<MemoCardInsert>): Promise<MemoCardRow> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');
  const { data, error } = await sb()
    .from('memo_cards')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMemoCard(id: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');
  const { error } = await sb().from('memo_cards').delete().eq('id', id);
  if (error) throw error;
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export interface DashboardStats {
  totalClients: number;
  inProgress: number;
  employed: number;
  followUpNeeded: number;
  stageBreakdown: { stage: string; count: number }[];
  averageScore: number | null;
  scoredClients: number;
  unscoredClients: number;
  scoreDistribution: { range: string; count: number }[];
}

export interface DashboardMonthlyStat {
  month: string;   // 'YYYY-MM'
  total: number;
  employed: number;
  rate: number;    // 0-100
}

export interface DashboardCalendarEntry {
  counselId: string;
  clientId: string;
  clientName: string;
  counselDate: string;
  startTime: string | null;
  endTime: string | null;
  participationStage: string | null;
}

const SCORE_DIST_FALLBACK = [
  { range: '0-59', count: 0 },
  { range: '60-69', count: 0 },
  { range: '70-79', count: 0 },
  { range: '80-89', count: 0 },
  { range: '90-100', count: 0 },
];

export async function fetchDashboardStats(counselorId?: string): Promise<DashboardStats> {
  if (!isSupabaseConfigured()) {
    return {
      totalClients: 0, inProgress: 0, employed: 0, followUpNeeded: 0,
      stageBreakdown: [], averageScore: null, scoredClients: 0,
      unscoredClients: 0, scoreDistribution: SCORE_DIST_FALLBACK,
    };
  }

  let q = sb().from('client').select('participation_stage, hire_type');
  if (counselorId) q = q.eq('counselor_id', counselorId);
  const { data, error } = await q;
  if (error) throw error;

  const rows = data ?? [];
  const stages = ['초기상담', '심층상담', '취업지원', '직업훈련', '취업알선', '취업완료', '사후관리'];
  return {
    totalClients: rows.length,
    inProgress: rows.filter((r: any) => r.participation_stage !== '취업완료').length,
    employed: rows.filter((r: any) => r.hire_type != null).length,
    followUpNeeded: 0,
    stageBreakdown: stages.map(s => ({
      stage: s,
      count: rows.filter((r: any) => r.participation_stage === s).length,
    })),
    averageScore: null,
    scoredClients: 0,
    unscoredClients: rows.length,
    scoreDistribution: SCORE_DIST_FALLBACK,
  };
}

export async function fetchDashboardMonthlyStats(counselorId: string): Promise<DashboardMonthlyStat[]> {
  if (!isSupabaseConfigured()) return [];

  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const startDate = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

  const { data, error } = await sb()
    .from('client')
    .select('participation_stage, hire_type, created_at')
    .eq('counselor_id', counselorId)
    .gte('created_at', startDate);

  if (error) return [];

  const monthMap: Record<string, { total: number; employed: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap[key] = { total: 0, employed: 0 };
  }

  (data ?? []).forEach((row: any) => {
    const key = (row.created_at as string)?.slice(0, 7);
    if (!key || !monthMap[key]) return;
    monthMap[key].total++;
    if (row.hire_type != null) monthMap[key].employed++;
  });

  return Object.entries(monthMap).map(([month, v]) => ({
    month,
    total: v.total,
    employed: v.employed,
    rate: v.total > 0 ? Math.round((v.employed / v.total) * 100) : 0,
  }));
}

export async function fetchDashboardCalendarMonthCounts(
  authUserId: string,
  monthStart: string,
  monthEnd: string,
): Promise<Record<string, number>> {
  if (!isSupabaseConfigured()) return {};

  const { data: histories, error } = await sb()
    .from('counsel_history')
    .select('client_id, counsel_date')
    .eq('user_id', authUserId)
    .gte('counsel_date', monthStart)
    .lte('counsel_date', monthEnd);

  if (error) throw error;

  return (histories ?? []).reduce<Record<string, number>>((acc, row: any) => {
    const date = row.counsel_date as string;
    acc[date] = (acc[date] ?? 0) + 1;
    return acc;
  }, {});
}

export async function fetchDashboardCalendarEntries(
  authUserId: string,
  startDate: string,
  endDate: string,
): Promise<DashboardCalendarEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const { data: histories, error } = await sb()
    .from('counsel_history')
    .select('counsel_id, client_id, counsel_date, start_time, end_time')
    .eq('user_id', authUserId)
    .gte('counsel_date', startDate)
    .lte('counsel_date', endDate)
    .order('counsel_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) throw error;

  const clientIds = Array.from(new Set((histories ?? []).map((h: any) => h.client_id)));
  let clientMap: Record<number, { client_name: string; participation_stage: string | null }> = {};

  if (clientIds.length > 0) {
    const { data: clients } = await sb()
      .from('client')
      .select('client_id, client_name, participation_stage')
      .in('client_id', clientIds);
    (clients ?? []).forEach((c: any) => {
      clientMap[c.client_id] = { client_name: c.client_name, participation_stage: c.participation_stage };
    });
  }

  return (histories ?? []).map((h: any) => {
    const client = clientMap[h.client_id];
    return {
      counselId: String(h.counsel_id),
      clientId: String(h.client_id),
      clientName: client?.client_name ?? '(이름 없음)',
      counselDate: h.counsel_date,
      startTime: h.start_time ?? null,
      endTime: h.end_time ?? null,
      participationStage: client?.participation_stage ?? null,
    };
  });
}

// ─── 개인 메모 ─────────────────────────────────────────────────────────────────

export async function fetchMyMemo(userId: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await sb().from('user').select('memo').eq('user_id', userId).single();
  if (error) return null;
  return (data as any)?.memo ?? null;
}

export async function updateMyMemo(userId: string, memo: string): Promise<string | null> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');
  const { data, error } = await sb()
    .from('user')
    .update({ memo })
    .eq('user_id', userId)
    .select('memo')
    .single();
  if (error) throw error;
  return (data as any)?.memo ?? null;
}

// ─── 내담자 검색 ───────────────────────────────────────────────────────────────

export async function searchDashboardClients(counselorId: string, query: string): Promise<ClientRow[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await sb()
    .from('client')
    .select(CLIENT_SELECT_FIELDS)
    .eq('counselor_id', counselorId)
    .ilike('client_name', `%${query}%`)
    .limit(20);

  if (error) throw error;
  return ((data ?? []) as LiveClientRecord[]).map(row => liveClientToRow(row));
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function liveClientToRow(row: LiveClientRecord): ClientRow {
  const createdAt = row.created_at ?? new Date().toISOString();
  const updatedAt = row.update_at
    ? new Date(`${row.update_at}T00:00:00`).toISOString()
    : createdAt;

  return {
    id: String(row.client_id),
    seq_no: row.client_id ?? null,
    year: createdAt ? new Date(createdAt).getFullYear() : null,
    assignment_type: null,
    name: row.client_name,
    resident_id_masked: null,
    phone: row.phone_encrypted ?? null,
    last_counsel_date: null,
    age: row.age ?? null,
    gender: row.gender_code === 'M' ? '남' : row.gender_code === 'F' ? '여' : null,
    business_type: row.business_type_code != null ? String(row.business_type_code) : null,
    participation_type: row.participation_type ?? null,
    participation_stage: row.participation_stage ?? null,
    competency_grade: null,
    recognition_date: null,
    desired_job: row.desired_job_1 ?? null,
    counsel_notes: null,
    address: null,
    school: row.school_name ?? null,
    major: row.major ?? null,
    education_level: row.education_level ?? null,
    initial_counsel_date: createdAt ? createdAt.split('T')[0] : null,
    iap_date: null,
    iap_duration: null,
    allowance_apply_date: null,
    rediagnosis_date: null,
    rediagnosis_yn: null,
    work_exp_type: null,
    work_exp_intent: null,
    work_exp_company: null,
    work_exp_period: null,
    work_exp_completed: null,
    training_name: null,
    training_start: null,
    training_end: row.job_place_end ?? null,
    training_allowance: null,
    intensive_start: null,
    intensive_end: null,
    support_end_date: null,
    employment_type: row.hire_type ?? null,
    employment_date: row.job_place_start ?? null,
    employer: null,
    job_title: null,
    salary: null,
    employment_duration: null,
    resignation_date: null,
    retention_1m_date: null,
    retention_1m_yn: null,
    retention_6m_date: null,
    retention_6m_yn: null,
    retention_12m_date: null,
    retention_12m_yn: null,
    retention_18m_date: null,
    retention_18m_yn: null,
    counselor_name: null,
    counselor_id: row.counselor_id ?? null,
    branch: null,
    follow_up: false,
    score: null,
    iap_to: row.iap_to ?? null,
    retest_stat: row.retest_stat ?? null,
    continue_serv_1_stat: row.continue_serv_1_stat ?? null,
    driving_yn: null,
    own_car_yn: null,
    memo: row.memo ?? null,
    participate_type: Array.isArray(row.business_code)
      ? row.business_code[0]?.participate_type ?? null
      : null,
    created_at: createdAt,
    update_at: updatedAt,
  };
}

function liveCounselHistoryToSessionRow(row: LiveCounselHistoryRecord): SessionRow {
  const decoded = decodeSessionPayload(row.counselor_opinion, '일반상담');

  return {
    id: String(row.counsel_id),
    client_id: String(row.client_id),
    date: row.counsel_date,
    type: row.counsel_type || decoded.type,
    content: row.counsel_type ? row.counselor_opinion : decoded.content,
    counselor_name: null,
    counselor_id: row.user_id ?? null,
    next_action: decoded.nextAction,
    session_number: row.session_number ?? null,
    start_time: row.start_time ?? null,
    end_time: row.end_time ?? null,
    document_link: row.document_link ?? null,
    economic_situation: row.economic_situation ?? null,
    social_situation_family: row.social_situation_family ?? null,
    social_situation_society: row.social_situation_society ?? null,
    self_esteem: row.self_esteem ?? null,
    self_efficacy: row.self_efficacy ?? null,
    holland_code: row.holland_code ?? null,
    career_fluidity: row.career_fluidity ?? null,
    info_gathering: row.info_gathering ?? null,
    personality_test_result: row.personality_test_result ?? null,
    life_history_result: row.life_history_result ?? null,
    profiling_grade: row.profiling_grade ?? null,
    memo: row.memo ?? null,
    created_at: row.create_at ?? row.counsel_date,
  };
}

// encodeSessionPayload 외부 노출 (ClientDetail 등에서 사용 가능)
export { encodeSessionPayload };
