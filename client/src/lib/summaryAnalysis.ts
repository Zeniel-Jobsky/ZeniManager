import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import * as XLSX from 'xlsx';
import { getOpenAIKey } from './supabase';
import type { ClientRow } from './supabase';

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const ANALYSIS_CACHE_PREFIX = 'summary-analysis-cache:v1:';
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
});

export type FocusFieldKey =
  | 'desiredJob'
  | 'gender'
  | 'competencyGrade'
  | 'certifications'
  | 'extraSpecs';

export type FocusFieldValue = {
  value: string | string[] | null;
  evidence: string | null;
  confidence: 'high' | 'medium' | 'low';
};

export interface FileAnalysisResult {
  sourceHash: string;
  generatedAt: string;
  summary: string;
  keyPoints: string[];
  keywordTags: string[];
  reliability: 'high' | 'medium' | 'low';
  focusFields: Record<FocusFieldKey, FocusFieldValue>;
  extractionMethod: string;
  extractedText: string;
  extractedCharCount: number;
}

export interface DocumentAnalysisResult extends FileAnalysisResult {
  fileName: string;
  fileType: string;
  fileSize: number;
  comparisonScore: number | null;
  comparisonStatus: 'pending_benchmark';
  comparisonLabel: string;
  focusCoverageScore: number;
}

export async function analyzeDocumentFile(
  file: File,
  client: ClientRow,
): Promise<DocumentAnalysisResult> {
  const extracted = await extractTextFromFile(file);
  const normalizedText = normalizeText(extracted.text);

  if (!normalizedText) {
    throw new Error('문서에서 읽을 수 있는 텍스트를 찾지 못했습니다.');
  }

  const sourceHash = await sha256(
    JSON.stringify({
      clientId: client.id,
      fileName: file.name,
      size: file.size,
      text: normalizedText,
    }),
  );

  const cached = readCachedAnalysis(sourceHash);
  if (cached) {
    return {
      ...cached,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      comparisonScore: null,
      comparisonStatus: 'pending_benchmark',
      comparisonLabel: 'Supabase 비교 데이터 연결 대기',
      focusCoverageScore: calculateFocusCoverageScore(cached.focusFields),
    };
  }

  const analysis = await summarizeWithDeterministicFallback(normalizedText, client);
  const payload: FileAnalysisResult = {
    ...analysis,
    sourceHash,
    generatedAt: new Date().toISOString(),
    extractionMethod: extracted.method,
    extractedText: normalizedText,
    extractedCharCount: normalizedText.length,
  };

  writeCachedAnalysis(sourceHash, payload);

  return {
    ...payload,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    comparisonScore: null,
    comparisonStatus: 'pending_benchmark',
    comparisonLabel: 'Supabase 비교 데이터 연결 대기',
    focusCoverageScore: calculateFocusCoverageScore(payload.focusFields),
  };
}

export async function extractTextFromFile(file: File): Promise<{ text: string; method: string }> {
  const extension = getFileExtension(file.name);

  if (['txt', 'md', 'csv', 'json'].includes(extension)) {
    return {
      text: await file.text(),
      method: 'plain-text',
    };
  }

  if (extension === 'pdf') {
    return {
      text: await extractPdfText(file),
      method: 'pdfjs',
    };
  }

  if (extension === 'xlsx' || extension === 'xls') {
    return {
      text: await extractSpreadsheetText(file),
      method: 'xlsx',
    };
  }

  if (extension === 'hwpx') {
    return {
      text: await extractHwpxText(file),
      method: 'hwpx-xml',
    };
  }

  if (extension === 'hwp') {
    throw new Error('HWP 본문 추출은 아직 연결되지 않았습니다. HWPX 또는 PDF로 변환 후 업로드해 주세요.');
  }

  return {
    text: await file.text(),
    method: 'fallback-text',
  };
}

export function buildMergedSummary(analyses: DocumentAnalysisResult[]): string {
  if (analyses.length === 0) return '';

  const focusSummary = mergeFocusFields(analyses);
  const parts = [
    `총 ${analyses.length}개 문서를 분석했습니다.`,
    focusSummary.desiredJob.value
      ? `희망직업은 ${stringifyFocusValue(focusSummary.desiredJob.value)}로 파악됩니다.`
      : '희망직업은 문서 간 확인이 더 필요합니다.',
    focusSummary.competencyGrade.value
      ? `역량 등급은 ${stringifyFocusValue(focusSummary.competencyGrade.value)}로 확인됩니다.`
      : '역량 등급은 추가 문서 또는 확인이 필요합니다.',
    focusSummary.certifications.value && Array.isArray(focusSummary.certifications.value) && focusSummary.certifications.value.length > 0
      ? `자격증은 ${focusSummary.certifications.value.slice(0, 5).join(', ')} 중심으로 확인되었습니다.`
      : '자격증 정보는 문서에서 뚜렷하게 확인되지 않았습니다.',
  ];

  return parts.join(' ');
}

export function mergeFocusFields(
  analyses: DocumentAnalysisResult[],
): Record<FocusFieldKey, FocusFieldValue> {
  const merged = {
    desiredJob: pickBestFocusField(analyses, 'desiredJob'),
    gender: pickBestFocusField(analyses, 'gender'),
    competencyGrade: pickBestFocusField(analyses, 'competencyGrade'),
    certifications: mergeArrayFocusField(analyses, 'certifications'),
    extraSpecs: mergeArrayFocusField(analyses, 'extraSpecs'),
  } satisfies Record<FocusFieldKey, FocusFieldValue>;

  return merged;
}

function pickBestFocusField(
  analyses: DocumentAnalysisResult[],
  key: Exclude<FocusFieldKey, 'certifications' | 'extraSpecs'>,
): FocusFieldValue {
  const ranked = analyses
    .map(item => item.focusFields[key])
    .filter(item => item.value)
    .sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence));

  return ranked[0] ?? { value: null, evidence: null, confidence: 'low' };
}

function mergeArrayFocusField(
  analyses: DocumentAnalysisResult[],
  key: Extract<FocusFieldKey, 'certifications' | 'extraSpecs'>,
): FocusFieldValue {
  const values = analyses
    .flatMap(item => {
      const raw = item.focusFields[key].value;
      return Array.isArray(raw) ? raw : raw ? [raw] : [];
    })
    .map(item => item.trim())
    .filter(Boolean);

  const unique = Array.from(new Set(values));

  return {
    value: unique.length > 0 ? unique : null,
    evidence: unique.length > 0 ? `${unique.length}개 문서 항목에서 통합 추출` : null,
    confidence: unique.length > 0 ? 'medium' : 'low',
  };
}

function confidenceRank(value: FocusFieldValue['confidence']): number {
  if (value === 'high') return 3;
  if (value === 'medium') return 2;
  return 1;
}

async function summarizeWithDeterministicFallback(
  extractedText: string,
  client: ClientRow,
): Promise<Omit<FileAnalysisResult, 'sourceHash' | 'generatedAt' | 'extractionMethod' | 'extractedText' | 'extractedCharCount'>> {
  const fallback = buildRuleBasedAnalysis(extractedText, client);
  const openAIKey = getOpenAIKey();

  if (!openAIKey) {
    return fallback;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAIKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        top_p: 1,
        seed: 42,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              '당신은 취업 상담 문서를 일관되게 판독하는 분석기다. 같은 입력에는 같은 JSON 결과를 반환한다. 추측을 최소화하고 문서 근거가 없으면 null 또는 빈 배열을 사용한다. 반드시 JSON만 반환한다.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              task: '문서를 요약하고 핵심 필드만 구조화',
              clientContext: {
                id: client.id,
                name: client.name,
                desiredJob: client.desired_job,
                gender: client.gender,
                competencyGrade: client.competency_grade,
              },
              priorities: [
                '희망직업',
                '성별',
                '역량 등급',
                '자격증',
                '부가 스펙',
              ],
              outputSchema: {
                summary: 'string',
                keyPoints: ['string'],
                keywordTags: ['string'],
                reliability: 'high | medium | low',
                focusFields: {
                  desiredJob: { value: 'string|null', evidence: 'string|null', confidence: 'high|medium|low' },
                  gender: { value: 'string|null', evidence: 'string|null', confidence: 'high|medium|low' },
                  competencyGrade: { value: 'string|null', evidence: 'string|null', confidence: 'high|medium|low' },
                  certifications: { value: ['string'], evidence: 'string|null', confidence: 'high|medium|low' },
                  extraSpecs: { value: ['string'], evidence: 'string|null', confidence: 'high|medium|low' },
                },
              },
              text: extractedText.slice(0, 18000),
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI 응답 실패 (${response.status})`);
    }

    const data = await response.json();
    const rawContent = data?.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error('OpenAI 응답 내용이 비어 있습니다.');
    }

    const parsed = JSON.parse(rawContent);

    return {
      summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : fallback.summary,
      keyPoints: sanitizeStringArray(parsed.keyPoints, fallback.keyPoints),
      keywordTags: sanitizeStringArray(parsed.keywordTags, fallback.keywordTags),
      reliability: parsed.reliability === 'high' || parsed.reliability === 'medium' || parsed.reliability === 'low'
        ? parsed.reliability
        : fallback.reliability,
      focusFields: normalizeFocusFields(parsed.focusFields, fallback.focusFields),
    };
  } catch {
    return fallback;
  }
}

function buildRuleBasedAnalysis(
  extractedText: string,
  client: ClientRow,
): Omit<FileAnalysisResult, 'sourceHash' | 'generatedAt' | 'extractionMethod' | 'extractedText' | 'extractedCharCount'> {
  const lines = extractedText
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);

  const desiredJob = pickFirstMatch(lines, [
    /희망\s*직업[:：]?\s*(.+)/i,
    /희망\s*직무[:：]?\s*(.+)/i,
    /희망\s*직종[:：]?\s*(.+)/i,
    /지원\s*직무[:：]?\s*(.+)/i,
  ]) ?? client.desired_job ?? null;

  const gender = pickFirstMatch(lines, [
    /성별[:：]?\s*(남성|여성|남|여)/i,
  ]) ?? client.gender ?? null;

  const competencyGrade = pickFirstMatch(lines, [
    /역량\s*등급[:：]?\s*([A-D][+]?)/i,
    /프로파일링\s*등급[:：]?\s*([A-D][+]?)/i,
    /등급[:：]?\s*([A-D][+]?)/i,
  ]) ?? client.competency_grade ?? null;

  const certifications = collectKeywordValues(lines, [
    '자격증',
    '보유자격',
    '취득자격',
    '자격 사항',
  ]);

  const extraSpecs = collectKeywordValues(lines, [
    '어학',
    '수상',
    '교육',
    '훈련',
    '경력',
    '포트폴리오',
    '활동',
    '스펙',
  ]);

  const keyPoints = [
    desiredJob ? `희망직업: ${desiredJob}` : '희망직업 확인 필요',
    competencyGrade ? `역량등급: ${competencyGrade}` : '역량등급 확인 필요',
    certifications.length > 0 ? `자격증 ${certifications.slice(0, 3).join(', ')}` : '자격증 정보 부족',
  ];

  return {
    summary: buildLocalSummary({
      desiredJob,
      gender,
      competencyGrade,
      certifications,
      extraSpecs,
      lines,
    }),
    keyPoints,
    keywordTags: [
      ...(desiredJob ? [String(desiredJob)] : []),
      ...(competencyGrade ? [String(competencyGrade)] : []),
      ...certifications.slice(0, 2),
      ...extraSpecs.slice(0, 2),
    ].filter(Boolean),
    reliability: lines.length > 20 ? 'medium' : 'low',
    focusFields: {
      desiredJob: {
        value: desiredJob,
        evidence: findEvidenceLine(lines, '희망') ?? findEvidenceLine(lines, '직무'),
        confidence: desiredJob ? 'medium' : 'low',
      },
      gender: {
        value: gender,
        evidence: findEvidenceLine(lines, '성별'),
        confidence: gender ? 'medium' : 'low',
      },
      competencyGrade: {
        value: competencyGrade,
        evidence: findEvidenceLine(lines, '등급') ?? findEvidenceLine(lines, '역량'),
        confidence: competencyGrade ? 'medium' : 'low',
      },
      certifications: {
        value: certifications.length > 0 ? certifications : null,
        evidence: findEvidenceLine(lines, '자격'),
        confidence: certifications.length > 0 ? 'medium' : 'low',
      },
      extraSpecs: {
        value: extraSpecs.length > 0 ? extraSpecs : null,
        evidence: findEvidenceLine(lines, '경력') ?? findEvidenceLine(lines, '교육'),
        confidence: extraSpecs.length > 0 ? 'medium' : 'low',
      },
    },
  };
}

function buildLocalSummary(input: {
  desiredJob: string | null;
  gender: string | null;
  competencyGrade: string | null;
  certifications: string[];
  extraSpecs: string[];
  lines: string[];
}): string {
  const snippets = input.lines.filter(line => line.length >= 12).slice(0, 3);

  const parts = [
    input.desiredJob ? `희망직업은 ${input.desiredJob}로 보입니다.` : '희망직업은 추가 확인이 필요합니다.',
    input.gender ? `성별 정보는 ${input.gender}로 확인됩니다.` : '성별 정보는 문서에서 뚜렷하지 않습니다.',
    input.competencyGrade ? `역량 등급은 ${input.competencyGrade}입니다.` : '역량 등급은 확인되지 않았습니다.',
    input.certifications.length > 0
      ? `자격증은 ${input.certifications.slice(0, 4).join(', ')} 중심입니다.`
      : '자격증 정보는 제한적입니다.',
    input.extraSpecs.length > 0
      ? `부가 스펙은 ${input.extraSpecs.slice(0, 4).join(', ')}가 확인됩니다.`
      : '부가 스펙 정보는 제한적입니다.',
  ];

  if (snippets.length > 0) {
    parts.push(`문서 주요 문장: ${snippets.join(' / ')}`);
  }

  return parts.join(' ');
}

function sanitizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const sanitized = value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);

  return sanitized.length > 0 ? sanitized.slice(0, 8) : fallback;
}

function normalizeFocusFields(
  value: unknown,
  fallback: Record<FocusFieldKey, FocusFieldValue>,
): Record<FocusFieldKey, FocusFieldValue> {
  const raw = typeof value === 'object' && value ? value as Record<string, any> : {};

  return {
    desiredJob: normalizeSingleFocusField(raw.desiredJob, fallback.desiredJob),
    gender: normalizeSingleFocusField(raw.gender, fallback.gender),
    competencyGrade: normalizeSingleFocusField(raw.competencyGrade, fallback.competencyGrade),
    certifications: normalizeArrayFocusField(raw.certifications, fallback.certifications),
    extraSpecs: normalizeArrayFocusField(raw.extraSpecs, fallback.extraSpecs),
  };
}

function normalizeSingleFocusField(input: unknown, fallback: FocusFieldValue): FocusFieldValue {
  if (!input || typeof input !== 'object') return fallback;
  const raw = input as Record<string, unknown>;

  return {
    value: typeof raw.value === 'string' && raw.value.trim() ? raw.value.trim() : fallback.value,
    evidence: typeof raw.evidence === 'string' && raw.evidence.trim() ? raw.evidence.trim() : fallback.evidence,
    confidence: raw.confidence === 'high' || raw.confidence === 'medium' || raw.confidence === 'low'
      ? raw.confidence
      : fallback.confidence,
  };
}

function normalizeArrayFocusField(input: unknown, fallback: FocusFieldValue): FocusFieldValue {
  if (!input || typeof input !== 'object') return fallback;
  const raw = input as Record<string, unknown>;
  const values = Array.isArray(raw.value)
    ? raw.value.map(item => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
    : [];

  return {
    value: values.length > 0 ? values : fallback.value,
    evidence: typeof raw.evidence === 'string' && raw.evidence.trim() ? raw.evidence.trim() : fallback.evidence,
    confidence: raw.confidence === 'high' || raw.confidence === 'medium' || raw.confidence === 'low'
      ? raw.confidence
      : fallback.confidence,
  };
}

function collectKeywordValues(lines: string[], keywords: string[]): string[] {
  const collected = lines
    .filter(line => keywords.some(keyword => line.includes(keyword)))
    .flatMap(line => splitCandidateValues(line))
    .map(item => item.replace(/^[\-\d.\s]+/, '').trim())
    .filter(item => item.length > 1 && item.length < 60);

  return Array.from(new Set(collected)).slice(0, 8);
}

function splitCandidateValues(line: string): string[] {
  return line
    .split(/[,:/|]|·|•|;|，/g)
    .map(item => item.trim())
    .filter(Boolean);
}

function pickFirstMatch(lines: string[], patterns: RegExp[]): string | null {
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      const value = match?.[1]?.trim();
      if (value) return value;
    }
  }
  return null;
}

function findEvidenceLine(lines: string[], keyword: string): string | null {
  return lines.find(line => line.includes(keyword)) ?? null;
}

async function extractPdfText(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map(item => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(text);
  }

  return pages.join('\n');
}

async function extractSpreadsheetText(file: File): Promise<string> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sections = workbook.SheetNames.map(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: '',
    }) as Array<Array<string | number>>;

    const textRows = rows
      .map(row => row.map(cell => String(cell).trim()).filter(Boolean).join(' | '))
      .filter(Boolean);

    return [`[시트] ${sheetName}`, ...textRows].join('\n');
  });

  return sections.join('\n\n');
}

async function extractHwpxText(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xmlEntries = Object.keys(zip.files).filter(name =>
    /contents\/section\d+\.xml$/i.test(name) || /header\d*\.xml$/i.test(name),
  );

  if (xmlEntries.length === 0) {
    throw new Error('HWPX 본문 XML을 찾지 못했습니다.');
  }

  const texts = await Promise.all(
    xmlEntries.map(async entry => {
      const xml = await zip.file(entry)?.async('text');
      if (!xml) return '';
      return extractXmlText(xml);
    }),
  );

  return texts.join('\n');
}

function extractXmlText(xml: string): string {
  try {
    const parsed = xmlParser.parse(xml);
    return normalizeText(collectTextNodes(parsed).join(' '));
  } catch {
    const dom = new DOMParser().parseFromString(xml, 'application/xml');
    return normalizeText(dom.documentElement?.textContent ?? '');
  }
}

function collectTextNodes(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(item => collectTextNodes(item));
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(item => collectTextNodes(item));
  }
  return [];
}

function normalizeText(input: string): string {
  return input
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function sha256(value: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function readCachedAnalysis(hash: string): FileAnalysisResult | null {
  try {
    const raw = localStorage.getItem(`${ANALYSIS_CACHE_PREFIX}${hash}`);
    if (!raw) return null;
    return JSON.parse(raw) as FileAnalysisResult;
  } catch {
    return null;
  }
}

function writeCachedAnalysis(hash: string, payload: FileAnalysisResult): void {
  try {
    localStorage.setItem(`${ANALYSIS_CACHE_PREFIX}${hash}`, JSON.stringify(payload));
  } catch {
    // Ignore cache write failures.
  }
}

function calculateFocusCoverageScore(focusFields: Record<FocusFieldKey, FocusFieldValue>): number {
  const total = Object.values(focusFields).length;
  const filled = Object.values(focusFields).filter(field => {
    if (Array.isArray(field.value)) return field.value.length > 0;
    return Boolean(field.value);
  }).length;

  return Math.round((filled / total) * 100);
}

function getFileExtension(name: string): string {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? parts.at(-1) ?? '' : '';
}

export function stringifyFocusValue(value: string | string[]): string {
  return Array.isArray(value) ? value.join(', ') : value;
}
