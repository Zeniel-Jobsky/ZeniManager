import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import type {
  CompetencyScoring,
  RecommendationResult,
  StructuredSummaryJson,
} from './summaryAnalysisPipeline';

export interface StoredSummaryAnalysis {
  client_id: number;
  structured_json: StructuredSummaryJson;
  competency_scoring: CompetencyScoring;
  recommendation: RecommendationResult;
  prompt_snapshot: Record<string, unknown>;
  file_refs?: Array<{
    name: string;
    path: string;
    url: string;
    uploaded_at: string;
  }> | null;
  updated_at: string;
}

function isMissingSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? error.code : undefined;
  return code === 'PGRST202' || code === 'PGRST205';
}

export async function fetchClientSummaryAnalysis(clientId: string): Promise<StoredSummaryAnalysis | null> {
  if (!isSupabaseConfigured()) return null;
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('client_summary_analysis')
    .select('client_id, structured_json, competency_scoring, recommendation, prompt_snapshot, file_refs, updated_at')
    .eq('client_id', Number(clientId))
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error)) return null;
    throw error;
  }

  return data as StoredSummaryAnalysis | null;
}

export async function upsertClientSummaryAnalysis(input: {
  clientId: string;
  structuredJson?: StructuredSummaryJson;
  competencyScoring?: CompetencyScoring;
  recommendation?: RecommendationResult;
  promptSnapshot?: Record<string, unknown>;
  fileRefs?: Array<{
    name: string;
    path: string;
    url: string;
    uploaded_at: string;
  }>;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase가 설정되지 않아 저장할 수 없습니다.');
  }

  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client를 초기화할 수 없습니다.');
  }

  const payload: Record<string, unknown> = {
    client_id: Number(input.clientId),
    updated_at: new Date().toISOString(),
  };

  if (input.structuredJson) payload.structured_json = input.structuredJson;
  if (input.competencyScoring) payload.competency_scoring = input.competencyScoring;
  if (input.recommendation) payload.recommendation = input.recommendation;
  if (input.promptSnapshot) payload.prompt_snapshot = input.promptSnapshot;
  if (input.fileRefs) payload.file_refs = input.fileRefs;

  const { error } = await client
    .from('client_summary_analysis')
    .upsert(payload, { onConflict: 'client_id' });

  if (error) {
    if (isMissingSchemaError(error)) {
      throw new Error('client_summary_analysis 테이블이 없어 저장할 수 없습니다. SQL 스키마를 먼저 적용해 주세요.');
    }
    throw error;
  }
}

export async function uploadSummaryAnalysisFiles(input: {
  clientId: string;
  files: File[];
}): Promise<Array<{ name: string; path: string; url: string; uploaded_at: string }>> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase가 설정되지 않아 파일을 업로드할 수 없습니다.');
  }

  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client를 초기화할 수 없습니다.');
  }

  const bucket = 'summary-analysis-files';
  const uploadedAt = new Date().toISOString();
  const refs: Array<{ name: string; path: string; url: string; uploaded_at: string }> = [];

  for (const file of input.files) {
    const safeName = file.name.replace(/[^\w.\-가-힣]/g, '_');
    const path = `${input.clientId}/${Date.now()}-${safeName}`;
    const { error } = await client.storage.from(bucket).upload(path, file, {
      upsert: true,
    });

    if (error) {
      throw error;
    }

    const { data } = client.storage.from(bucket).getPublicUrl(path);
    refs.push({
      name: file.name,
      path,
      url: data.publicUrl,
      uploaded_at: uploadedAt,
    });
  }

  return refs;
}
