/**
 * api.ts — Supabase data access layer
 * All functions read credentials from localStorage at call time.
 * Falls back to mock data when Supabase is not configured.
 */
import { ROLE_COUNSELOR } from '@shared/const';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import type {
  ClientRow, ClientInsert,
  SessionRow, SessionInsert,
  CounselorRow, CounselorInsert,
  SurveyRow, SurveyInsert,
  MemoCardRow, MemoCardInsert,
} from './supabase';
import {
  MOCK_CLIENTS, MOCK_COUNSELORS, INITIAL_KANBAN,
  type Client, type Counselor, type Session,
} from './mockData';

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
  create_at: string | null;
};

function normalizeMockCounselorId(counselorId?: string): string | undefined {
  if (!counselorId) return undefined;
  const demoMatch = counselorId.match(/^demo-(c\d+)$/);
  return demoMatch?.[1] ?? counselorId;
}

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

function isMissingSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const code = 'code' in error ? error.code : undefined;
  return code === 'PGRST202' || code === 'PGRST205';
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export async function fetchClients(counselorId?: string): Promise<ClientRow[]> {
  if (!isSupabaseConfigured()) {
    const normalizedCounselorId = normalizeMockCounselorId(counselorId);
    return MOCK_CLIENTS
      .filter(c => !normalizedCounselorId || c.counselorId === normalizedCounselorId)
      .map(c => mockClientToRow(c));
  }

  let q = sb()
    .from('client')
    .select(`
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
      created_at,
      update_at
    `)
    .order('created_at', { ascending: false });

  if (counselorId) q = q.eq('counselor_id', counselorId);

  const { data, error } = await q;
  if (error) {
    if (isMissingSchemaError(error)) {
      const mockClients = MOCK_CLIENTS.map(c => mockClientToRow(c));
      return counselorId
        ? mockClients.filter(client => client.counselor_id === counselorId)
        : mockClients;
    }
    throw error;
  }
  return ((data ?? []) as LiveClientRecord[]).map(row => liveClientToRow(row));
}

export async function fetchClientById(id: string): Promise<ClientRow | null> {
  if (!isSupabaseConfigured()) {
    const c = MOCK_CLIENTS.find(c => c.id === id);
    return c ? mockClientToRow(c) : null;
  }

  const numericId = Number(id);
  if (Number.isNaN(numericId)) return null;

  const { data, error } = await sb()
    .from('client')
    .select(`
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
      created_at,
      update_at
    `)
    .eq('client_id', numericId)
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      const c = MOCK_CLIENTS.find(client => client.id === id);
      return c ? mockClientToRow(c) : null;
    }
    throw error;
  }
  return liveClientToRow(data as LiveClientRecord);
}

export async function createClient(input: ClientInsert): Promise<ClientRow> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');
  const { data, error } = await sb().from('clients').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateClient(id: string, input: Partial<ClientInsert>): Promise<ClientRow> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');
  const { data, error } = await sb()
    .from('clients')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteClient(id: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');
  const { error } = await sb().from('clients').delete().eq('id', id);
  if (error) throw error;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function fetchSessions(clientId: string): Promise<SessionRow[]> {
  if (!isSupabaseConfigured()) {
    const c = MOCK_CLIENTS.find(c => c.id === clientId);
    return (c?.sessions ?? []).map(s => mockSessionToRow(s, clientId));
  }

  const numericClientId = Number(clientId);
  if (Number.isNaN(numericClientId)) return [];

  const { data, error } = await sb()
    .from('counsel_history')
    .select('counsel_id, client_id, user_id, counsel_date, start_time, end_time, session_number, counselor_opinion, create_at')
    .eq('client_id', numericClientId)
    .order('counsel_date', { ascending: false })
    .order('start_time', { ascending: false });

  if (error) {
    if (isMissingSchemaError(error)) {
      const c = MOCK_CLIENTS.find(client => client.id === clientId);
      return (c?.sessions ?? []).map(s => mockSessionToRow(s, clientId));
    }
    throw error;
  }
  return ((data ?? []) as LiveCounselHistoryRecord[]).map(row => liveCounselHistoryToSessionRow(row));
}

export async function createSession(input: SessionInsert): Promise<SessionRow> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');

  const numericClientId = Number(input.client_id);
  if (Number.isNaN(numericClientId)) throw new Error('유효한 상담자 ID가 아닙니다.');
  if (!input.counselor_id) throw new Error('로그인한 상담사 정보가 없습니다.');

  const payload = {
    client_id: numericClientId,
    user_id: input.counselor_id,
    counsel_date: input.date,
    create_at: input.date,
    counselor_opinion: encodeSessionPayload(input.type, input.content || '', input.next_action),
  };

  const { data, error } = await sb()
    .from('counsel_history')
    .insert(payload)
    .select('counsel_id, client_id, user_id, counsel_date, start_time, end_time, session_number, counselor_opinion, create_at')
    .single();

  if (error) throw error;
  return liveCounselHistoryToSessionRow(data as LiveCounselHistoryRecord);
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
  if (!isSupabaseConfigured()) {
    return MOCK_COUNSELORS.map(c => mockCounselorToRow(c));
  }
  const { data, error } = await sb().from('counselors').select('*').order('name');
  if (error) {
    if (isMissingSchemaError(error)) {
      return MOCK_COUNSELORS.map(c => mockCounselorToRow(c));
    }
    throw error;
  }
  return data ?? [];
}

export async function createCounselor(input: CounselorInsert): Promise<CounselorRow> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');
  const { data, error } = await sb().from('counselors').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateCounselor(id: string, input: Partial<CounselorInsert>): Promise<CounselorRow> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');
  const { data, error } = await sb()
    .from('counselors')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCounselor(id: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');
  const { error } = await sb().from('counselors').delete().eq('id', id);
  if (error) throw error;
}

// ─── Survey Responses ─────────────────────────────────────────────────────────

export async function fetchSurveys(clientId: string): Promise<SurveyRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await sb()
    .from('survey_responses')
    .select('*')
    .eq('client_id', clientId)
    .order('survey_date', { ascending: false });
  if (error) {
    if (isMissingSchemaError(error)) {
      return [];
    }
    throw error;
  }
  return data ?? [];
}

export async function createSurvey(input: SurveyInsert): Promise<SurveyRow> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');
  const { data, error } = await sb().from('survey_responses').insert(input).select().single();
  if (error) throw error;
  return data;
}

// ─── Memo Cards (Kanban) ──────────────────────────────────────────────────────

export async function fetchMemoCards(counselorId: string): Promise<MemoCardRow[]> {
  if (!isSupabaseConfigured()) {
    const all: MemoCardRow[] = [];
    INITIAL_KANBAN.forEach(col => {
      col.cards.forEach((card, idx) => {
        all.push({
          id: card.id,
          counselor_id: counselorId,
          column_id: col.id,
          title: card.title,
          content: card.content,
          priority: card.priority,
          due_date: card.dueDate ?? null,
          client_name: card.clientName ?? null,
          sort_order: idx,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });
    });
    return all;
  }

  const { data, error } = await sb()
    .from('memo_cards')
    .select('*')
    .eq('counselor_id', counselorId)
    .order('sort_order');
  if (error) {
    if (isMissingSchemaError(error)) {
      const all: MemoCardRow[] = [];
      INITIAL_KANBAN.forEach(col => {
        col.cards.forEach((card, idx) => {
          all.push({
            id: card.id,
            counselor_id: counselorId,
            column_id: col.id,
            title: card.title,
            content: card.content,
            priority: card.priority,
            due_date: card.dueDate ?? null,
            client_name: card.clientName ?? null,
            sort_order: idx,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        });
      });
      return all;
    }
    throw error;
  }
  return data ?? [];
}

export async function upsertMemoCard(input: MemoCardInsert): Promise<MemoCardRow> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 설정이 필요합니다.');
  const { data, error } = await sb()
    .from('memo_cards')
    .upsert({ ...input, updated_at: new Date().toISOString() })
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

export async function fetchDashboardStats(counselorId?: string): Promise<DashboardStats> {
  if (!isSupabaseConfigured()) {
    const normalizedCounselorId = normalizeMockCounselorId(counselorId);
    const clients = normalizedCounselorId
      ? MOCK_CLIENTS.filter(c => c.counselorId === normalizedCounselorId)
      : MOCK_CLIENTS;
    const stages = ['초기상담', '심층상담', '취업지원', '취업완료', '사후관리'];
    return {
      totalClients: clients.length,
      inProgress: clients.filter(c => c.processStage !== '취업완료').length,
      employed: clients.filter(c => c.processStage === '취업완료').length,
      followUpNeeded: clients.filter(c => c.followUp).length,
      stageBreakdown: stages.map(s => ({ stage: s, count: clients.filter(c => c.processStage === s).length })),
    };
  }

  let q = sb().from('client').select('participation_stage, hire_type');
  if (counselorId) q = q.eq('counselor_id', counselorId);
  const { data, error } = await q;
  if (error) {
    if (isMissingSchemaError(error)) {
      const clients = counselorId
        ? MOCK_CLIENTS.filter(c => c.counselorId === counselorId)
        : MOCK_CLIENTS;
      const stages = ['초기상담', '심층상담', '취업지원', '취업완료', '사후관리'];
      return {
        totalClients: clients.length,
        inProgress: clients.filter(c => c.processStage !== '취업완료').length,
        employed: clients.filter(c => c.processStage === '취업완료').length,
        followUpNeeded: clients.filter(c => c.followUp).length,
        stageBreakdown: stages.map(s => ({ stage: s, count: clients.filter(c => c.processStage === s).length })),
      };
    }
    throw error;
  }

  const rows = data ?? [];
  const stages = ['초기상담', '심층상담', '취업지원', '취업완료', '사후관리'];
  return {
    totalClients: rows.length,
    inProgress: rows.filter(r => r.participation_stage !== '취업완료').length,
    employed: rows.filter(r => r.hire_type != null).length,
    followUpNeeded: 0,
    stageBreakdown: stages.map(s => ({
      stage: s,
      count: rows.filter(r => r.participation_stage === s).length,
    })),
  };
}

export async function fetchDashboardCalendarMonthCounts(
  authUserId: string,
  monthStart: string,
  monthEnd: string,
): Promise<Record<string, number>> {
  if (!isSupabaseConfigured()) {
    const normalizedCounselorId = normalizeMockCounselorId(authUserId);
    return MOCK_CLIENTS
      .filter(c => !normalizedCounselorId || c.counselorId === normalizedCounselorId)
      .flatMap(c => c.sessions.map(s => ({ date: s.date })))
      .filter(s => s.date >= monthStart && s.date <= monthEnd)
      .reduce<Record<string, number>>((acc, row) => {
        acc[row.date] = (acc[row.date] ?? 0) + 1;
        return acc;
      }, {});
  }

  const { data: histories, error } = await sb()
    .from('counsel_history')
    .select('client_id, counsel_date')
    .eq('user_id', authUserId)
    .gte('counsel_date', monthStart)
    .lte('counsel_date', monthEnd);

  if (error) throw error;

  const clientIds = Array.from(
    new Set((histories ?? []).map(row => row.client_id).filter((id): id is number => typeof id === 'number')),
  );
  if (clientIds.length === 0) return {};

  const { data: clients, error: clientError } = await sb()
    .from('client')
    .select('client_id')
    .eq('counselor_id', authUserId)
    .in('client_id', clientIds);

  if (clientError) throw clientError;

  const allowedClientIds = new Set((clients ?? []).map(row => row.client_id));

  return (histories ?? []).reduce<Record<string, number>>((acc, row) => {
    if (!row.counsel_date || !allowedClientIds.has(row.client_id)) return acc;
    acc[row.counsel_date] = (acc[row.counsel_date] ?? 0) + 1;
    return acc;
  }, {});
}

export async function fetchDashboardCalendarEntries(
  authUserId: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<DashboardCalendarEntry[]> {
  if (!isSupabaseConfigured()) {
    const normalizedCounselorId = normalizeMockCounselorId(authUserId);
    return MOCK_CLIENTS
      .filter(c => !normalizedCounselorId || c.counselorId === normalizedCounselorId)
      .flatMap(c => c.sessions
        .filter(s => s.date >= rangeStart && s.date <= rangeEnd)
        .map(s => ({
          counselId: s.id,
          clientId: c.id,
          clientName: c.name,
          counselDate: s.date,
          startTime: null,
          endTime: null,
          participationStage: c.processStage,
        })))
      .sort((a, b) => `${b.counselDate}${b.startTime ?? ''}`.localeCompare(`${a.counselDate}${a.startTime ?? ''}`));
  }

  const { data: histories, error } = await sb()
    .from('counsel_history')
    .select('counsel_id, client_id, counsel_date, start_time, end_time')
    .eq('user_id', authUserId)
    .gte('counsel_date', rangeStart)
    .lte('counsel_date', rangeEnd)
    .order('counsel_date', { ascending: false })
    .order('start_time', { ascending: false });

  if (error) throw error;

  const clientIds = Array.from(
    new Set((histories ?? []).map(row => row.client_id).filter((id): id is number => typeof id === 'number')),
  );
  if (clientIds.length === 0) return [];

  const { data: clients, error: clientError } = await sb()
    .from('client')
    .select('client_id, client_name, counselor_id, participation_stage')
    .eq('counselor_id', authUserId)
    .in('client_id', clientIds);

  if (clientError) throw clientError;

  const clientMap = new Map((clients ?? []).map(client => [client.client_id, client]));

  return (histories ?? [])
    .map(row => {
      const client = row.client_id != null ? clientMap.get(row.client_id) : undefined;
      if (!client || !row.counsel_date) return null;
      return {
        counselId: String(row.counsel_id),
        clientId: String(client.client_id),
        clientName: client.client_name,
        counselDate: row.counsel_date,
        startTime: row.start_time,
        endTime: row.end_time,
        participationStage: client.participation_stage,
      } satisfies DashboardCalendarEntry;
    })
    .filter((row): row is DashboardCalendarEntry => row !== null);
}

// ─── Mock → Row converters ────────────────────────────────────────────────────

function mockClientToRow(c: Client): ClientRow {
  return {
    id: c.id,
    seq_no: null,
    year: new Date(c.registeredAt).getFullYear(),
    assignment_type: null,
    name: c.name,
    resident_id_masked: null,
    phone: c.phone,
    last_counsel_date: c.sessions.at(-1)?.date ?? null,
    age: c.age,
    gender: c.gender,
    business_type: null,
    participation_type: null,
    participation_stage: c.processStage,
    competency_grade: null,
    recognition_date: null,
    desired_job: null,
    counsel_notes: c.notes ?? null,
    address: null,
    school: null,
    major: null,
    education_level: null,
    initial_counsel_date: c.registeredAt,
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
    training_end: null,
    training_allowance: null,
    intensive_start: null,
    intensive_end: null,
    support_end_date: null,
    employment_type: c.employmentStatus === '취업완료' ? '본인' : null,
    employment_date: null,
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
    counselor_name: c.counselorName,
    counselor_id: c.counselorId,
    branch: c.branch,
    follow_up: c.followUp,
    score: c.score ?? null,
    created_at: c.registeredAt,
    updated_at: c.registeredAt,
  };
}

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
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function mockSessionToRow(s: Session, clientId: string): SessionRow {
  return {
    id: s.id,
    client_id: clientId,
    date: s.date,
    type: s.type,
    content: s.content,
    counselor_name: s.counselorName,
    counselor_id: null,
    next_action: s.nextAction ?? null,
    created_at: s.date,
  };
}

function liveCounselHistoryToSessionRow(row: LiveCounselHistoryRecord): SessionRow {
  const decoded = decodeSessionPayload(
    row.counselor_opinion,
    row.session_number != null ? `${row.session_number}회차` : '상담기록',
  );

  return {
    id: String(row.counsel_id),
    client_id: String(row.client_id),
    date: row.counsel_date,
    type: decoded.type,
    content: decoded.content,
    counselor_name: null,
    counselor_id: row.user_id ?? null,
    next_action: decoded.nextAction,
    created_at: row.create_at ?? row.counsel_date,
  };
}

function mockCounselorToRow(c: Counselor): CounselorRow {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    branch: c.branch,
    client_count: c.clientCount,
    completed_count: c.completedCount,
    joined_at: c.joinedAt,
    status: c.status,
    role: ROLE_COUNSELOR,
    auth_user_id: null,
    created_at: c.joinedAt,
    updated_at: c.joinedAt,
  };
}
