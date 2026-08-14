/**
 * supabase.ts
 * 
 * SECURITY: No API keys are hardcoded here.
 * All credentials are read at runtime from localStorage (set by user in Settings).
 * This file is safe to commit to a public GitHub repository.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AppRole } from '@shared/const';

export const STORAGE_KEYS = {
  SUPABASE_URL: 'counsel_supabase_url',
  SUPABASE_ANON_KEY: 'counsel_supabase_anon_key',
  OPENAI_API_KEY: 'counsel_openai_api_key',
  USER: 'counsel_user',
} as const;

export const SUPABASE_SESSION_STORAGE_KEY = 'counsel_sb_session';
const APP_SETTING_KEYS = [
  STORAGE_KEYS.SUPABASE_URL,
  STORAGE_KEYS.SUPABASE_ANON_KEY,
  STORAGE_KEYS.OPENAI_API_KEY,
] as const;

function getElectronApi() {
  if (typeof window === 'undefined') return undefined;
  return window.electronAPI;
}

/** Returns the Supabase URL stored by the user in Settings, or null if not set. */
export function getSupabaseUrl(): string | null {
  return localStorage.getItem(STORAGE_KEYS.SUPABASE_URL) || null;
}

/** Returns the Supabase anon key stored by the user in Settings, or null if not set. */
export function getSupabaseAnonKey(): string | null {
  return localStorage.getItem(STORAGE_KEYS.SUPABASE_ANON_KEY) || null;
}

/** Returns the OpenAI API key stored by the user in Settings, or null if not set. */
export function getOpenAIKey(): string | null {
  return localStorage.getItem(STORAGE_KEYS.OPENAI_API_KEY) || null;
}

/** Returns true if both Supabase URL and anon key are configured. */
export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return !!(url && key && url.startsWith('https://') && key.length > 20);
}

let _client: SupabaseClient | null = null;
let _clientUrl: string | null = null;
let _clientKey: string | null = null;

/**
 * Returns a Supabase client using the credentials stored in localStorage.
 * Returns null if credentials are not configured.
 * The client is cached and re-created only when credentials change.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) return null;

  // Re-create client if credentials changed
  if (_client && _clientUrl === url && _clientKey === key) {
    return _client;
  }

  try {
    _client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: SUPABASE_SESSION_STORAGE_KEY,
      },
    });
    _clientUrl = url;
    _clientKey = key;
    return _client;
  } catch {
    return null;
  }
}

/** Clears the cached Supabase client (call after credentials change). */
export function resetSupabaseClient(): void {
  _client = null;
  _clientUrl = null;
  _clientKey = null;
}

export async function bootstrapStoredAppSettings(): Promise<void> {
  const electronAPI = getElectronApi();
  if (!electronAPI?.getAppSettings) return;

  try {
    const persisted = await electronAPI.getAppSettings();
    for (const key of APP_SETTING_KEYS) {
      const value = persisted[key];
      if (typeof value === 'string' && value.length > 0) {
        localStorage.setItem(key, value);
      }
    }
  } catch {
    // Ignore native storage bootstrap failures and fall back to localStorage only.
  }
}

/**
 * Clears transient auth/session state on Electron launch.
 * Persistent app settings remain in the shared app-settings store and are
 * bootstrapped back into localStorage afterwards.
 */
export function resetTransientSessionOnLaunch(): void {
  const electronAPI = getElectronApi();
  if (!electronAPI?.isElectron) return;

  [
    STORAGE_KEYS.USER,
    SUPABASE_SESSION_STORAGE_KEY,
  ].forEach(key => localStorage.removeItem(key));

  resetSupabaseClient();
}

export async function setStoredAppSetting(key: string, value: string): Promise<void> {
  const trimmed = value.trim();
  if (trimmed) {
    localStorage.setItem(key, trimmed);
  } else {
    localStorage.removeItem(key);
  }

  const electronAPI = getElectronApi();
  if (!electronAPI?.setAppSetting) return;

  if (trimmed) {
    await electronAPI.setAppSetting(key, trimmed);
  } else {
    await electronAPI.removeAppSetting(key);
  }
}

export async function removeStoredAppSetting(key: string): Promise<void> {
  localStorage.removeItem(key);
  const electronAPI = getElectronApi();
  if (electronAPI?.removeAppSetting) {
    await electronAPI.removeAppSetting(key);
  }
}

/** Clears locally stored app settings and cached auth/session state. */
export async function resetStoredAppSettings(): Promise<void> {
  [
    STORAGE_KEYS.SUPABASE_URL,
    STORAGE_KEYS.SUPABASE_ANON_KEY,
    STORAGE_KEYS.OPENAI_API_KEY,
    STORAGE_KEYS.USER,
    SUPABASE_SESSION_STORAGE_KEY,
  ].forEach(key => localStorage.removeItem(key));

  const electronAPI = getElectronApi();
  if (electronAPI?.clearAppSettings) {
    await electronAPI.clearAppSettings([...APP_SETTING_KEYS]);
  }

  resetSupabaseClient();
}

export type Database = {
  public: {
    Tables: {
      clients: { Row: ClientRow; Insert: ClientInsert; Update: Partial<ClientInsert> };
      sessions: { Row: SessionRow; Insert: SessionInsert; Update: Partial<SessionInsert> };
      counselors: { Row: CounselorRow; Insert: CounselorInsert; Update: Partial<CounselorInsert> };
      survey_responses: { Row: SurveyRow; Insert: SurveyInsert; Update: Partial<SurveyInsert> };
      memo_cards: { Row: MemoCardRow; Insert: MemoCardInsert; Update: Partial<MemoCardInsert> };
    };
  };
};

// ─── Row types matching the Supabase schema ───────────────────────────────────

export interface ClientRow {
  id: string;
  seq_no: number | null;
  year: number | null;
  assignment_type: string | null; // 배정구분: 이관/모집/배정
  name: string;
  resident_id_masked: string | null; // 주민번호 앞 6자리만 저장
  phone: string | null;
  last_counsel_date: string | null;
  age: number | null;
  gender: '남' | '여' | null;
  business_type: string | null; // 사업유형: Ⅰ/Ⅱ
  participation_type: string | null; // 참여유형
  participation_stage: string | null; // 참여단계
  competency_grade: string | null; // 역량등급: A/B/C/D
  recognition_date: string | null; // 인정통지일
  desired_job: string | null; // 희망직종
  counsel_notes: string | null; // 상담내역
  address: string | null;
  school: string | null;
  major: string | null;
  education_level: string | null; // 최종학력
  initial_counsel_date: string | null; // 초기상담(1차)
  iap_date: string | null; // IAP수립일
  iap_duration: string | null; // IAP운영기간
  allowance_apply_date: string | null; // 참여수당신청일
  rediagnosis_date: string | null; // 재진단날짜
  rediagnosis_yn: string | null; // 재진단여부
  work_exp_type: string | null; // 일경험유형
  work_exp_intent: string | null; // 참여의사
  work_exp_company: string | null; // 참여기업
  work_exp_period: string | null; // 참여기간
  work_exp_completed: string | null; // 수료여부
  training_name: string | null; // 훈련과정명
  training_start: string | null; // 훈련개강일
  training_end: string | null; // 훈련종료일
  training_allowance: string | null; // 훈련수당
  intensive_start: string | null; // 집중취업알선시작일
  intensive_end: string | null; // 집중취업알선종료일
  support_end_date: string | null; // 취업지원종료일
  employment_type: string | null; // 취업구분
  employment_date: string | null; // 취업일자
  employer: string | null; // 취업처
  job_title: string | null; // 취업직무
  salary: string | null; // 급여
  employment_duration: string | null; // 취업소요기간
  resignation_date: string | null; // 퇴사일
  retention_1m_date: string | null;
  retention_1m_yn: string | null;
  retention_6m_date: string | null;
  retention_6m_yn: string | null;
  retention_12m_date: string | null;
  retention_12m_yn: string | null;
  retention_18m_date: string | null;
  retention_18m_yn: string | null;
  counselor_name: string | null; // 담당자
  counselor_id: string | null;
  branch: string | null;
  follow_up: boolean;
  score: number | null;
  created_at: string;
  updated_at: string;
}

export type ClientInsert = Omit<ClientRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export interface SessionRow {
  id: string;
  client_id: string;
  date: string;
  type: string; // 초기상담/심층상담/취업지원/사후관리
  content: string | null;
  counselor_name: string | null;
  counselor_id: string | null;
  next_action: string | null;
  created_at: string;
}

export type SessionInsert = Omit<SessionRow, 'id' | 'created_at'> & { id?: string };

export interface CounselorRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  branch: string | null;
  client_count: number;
  completed_count: number;
  joined_at: string | null;
  status: '재직' | '휴직' | '퇴직' | null;
  role: AppRole | null;
  auth_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export type CounselorInsert = Omit<CounselorRow, 'id' | 'created_at' | 'updated_at'> & { id?: string };

export interface SurveyRow {
  id: string;
  client_id: string;
  survey_date: string;
  q1_job_goal: number | null; // 구직목표수립
  q2_employment_will: number | null; // 구직의지
  q3_employment_plan: number | null; // 희망직종 계획
  q4_job_skill_need: number | null; // 구직기술 필요도
  q5_job_info_need: number | null; // 구직정보 필요도
  q6_competency_up: number | null; // 취업역량 향상도
  q7_barrier: number | null; // 취업장애요인
  q7_barrier_detail: string | null; // 장애요인 내용
  q8_health: number | null; // 건강상태
  total_score: number | null;
  created_at: string;
}

export type SurveyInsert = Omit<SurveyRow, 'id' | 'created_at'> & { id?: string };

export interface MemoCardRow {
  id: string;
  counselor_id: string;
  column_id: string; // todo / inprogress / done
  title: string;
  content: string | null;
  priority: 'high' | 'medium' | 'low';
  due_date: string | null;
  client_name: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type MemoCardInsert = Omit<MemoCardRow, 'id' | 'created_at' | 'updated_at'> & { id?: string };
