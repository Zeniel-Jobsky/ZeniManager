import { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Brain,
  FilePlus2,
  FileText,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ClientRow } from '@/lib/supabase';
import {
  analyzeDocumentFile,
  buildMergedSummary,
  mergeFocusFields,
  stringifyFocusValue,
  type DocumentAnalysisResult,
  type FocusFieldKey,
  type FocusFieldValue,
} from '@/lib/summaryAnalysis';

const PRIMARY = '#009C64';
const ACCEPTED_EXTENSIONS = '.pdf,.xls,.xlsx,.hwp,.hwpx,.txt,.csv';

type UploadItem = {
  id: string;
  file: File;
  status: 'queued' | 'analyzing' | 'done' | 'error';
  analysis: DocumentAnalysisResult | null;
  error: string | null;
};

const focusFieldLabels: Record<FocusFieldKey, string> = {
  desiredJob: '희망직업',
  gender: '성별',
  competencyGrade: '역량 등급',
  certifications: '자격증',
  extraSpecs: '부가 스펙',
};

export function ClientSummaryAnalysisTab({ client }: { client: ClientRow }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const completedAnalyses = useMemo(
    () => items.map(item => item.analysis).filter(Boolean) as DocumentAnalysisResult[],
    [items],
  );

  const mergedSummary = useMemo(
    () => buildMergedSummary(completedAnalyses),
    [completedAnalyses],
  );

  const mergedFocusFields = useMemo(
    () => mergeFocusFields(completedAnalyses),
    [completedAnalyses],
  );

  const focusCoverage = useMemo(() => {
    if (completedAnalyses.length === 0) return 0;
    return Math.round(
      completedAnalyses.reduce((sum, item) => sum + item.focusCoverageScore, 0) / completedAnalyses.length,
    );
  }, [completedAnalyses]);

  const addFiles = async (incoming: FileList | File[]) => {
    const nextFiles = Array.from(incoming).filter(file => isSupportedFile(file.name));

    if (nextFiles.length === 0) {
      toast.error('지원 형식(pdf, xls, xlsx, hwpx, txt, csv) 파일을 선택해 주세요.');
      return;
    }

    const deduped = nextFiles.filter(file => {
      const signature = buildFileSignature(file);
      return !items.some(item => buildFileSignature(item.file) === signature);
    });

    if (deduped.length === 0) {
      toast.info('같은 파일은 한 번만 추가됩니다.');
      return;
    }

    const queuedItems = deduped.map(file => ({
      id: buildFileSignature(file),
      file,
      status: 'queued' as const,
      analysis: null,
      error: null,
    }));

    setItems(prev => [...prev, ...queuedItems]);
    await analyzeQueuedItems(queuedItems);
  };

  const analyzeQueuedItems = async (queuedItems: UploadItem[]) => {
    setIsAnalyzing(true);

    for (const queuedItem of queuedItems) {
      setItems(prev =>
        prev.map(item => item.id === queuedItem.id ? { ...item, status: 'analyzing', error: null } : item),
      );

      try {
        const analysis = await analyzeDocumentFile(queuedItem.file, client);
        setItems(prev =>
          prev.map(item => item.id === queuedItem.id ? { ...item, status: 'done', analysis } : item),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : '문서 분석에 실패했습니다.';
        setItems(prev =>
          prev.map(item => item.id === queuedItem.id ? { ...item, status: 'error', error: message } : item),
        );
      }
    }

    setIsAnalyzing(false);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div
          onDragOver={event => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={event => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDrop={async event => {
            event.preventDefault();
            setIsDragging(false);
            await addFiles(event.dataTransfer.files);
          }}
          className={`rounded-xl border border-dashed p-6 transition-colors ${
            isDragging ? 'border-[color:#009C64] bg-[#009C64]/5' : 'border-border bg-muted/10'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                <Upload size={12} />
                문서 업로드
              </div>
              <h3 className="text-base font-semibold text-foreground">요약 및 분석 자료 추가</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                상담사가 문서를 끌어다 놓거나 직접 선택하면 텍스트를 추출해 요약합니다.
                AI는 희망직업, 성별, 역량 등급, 자격증, 부가 스펙을 우선적으로 파악합니다.
              </p>
            </div>
            <div className="hidden rounded-2xl bg-white p-3 text-[#009C64] shadow-sm sm:block">
              <FilePlus2 size={22} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: PRIMARY }}
            >
              <Upload size={14} />
              파일 선택
            </button>
            <span className="text-xs text-muted-foreground">
              지원 형식: PDF, XLS, XLSX, HWPX, TXT, CSV
            </span>
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS}
            className="hidden"
            onChange={async event => {
              const { files } = event.target;
              if (files && files.length > 0) {
                await addFiles(files);
                event.target.value = '';
              }
            }}
          />
        </div>

        <div className="rounded-xl border border-border bg-muted/10 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BarChart3 size={16} style={{ color: PRIMARY }} />
            분석 상태
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <InfoRow label="분석 문서" value={`${completedAnalyses.length}건`} />
            <InfoRow label="핵심 항목 포착률" value={`${focusCoverage}%`} />
            <InfoRow label="비교 점수" value={completedAnalyses.length > 0 ? 'Supabase 연동 대기' : '-'} />
          </div>
          <div className="mt-4 rounded-lg bg-white/80 p-3 text-xs leading-5 text-muted-foreground">
            같은 사람에게 같은 자료를 다시 넣으면 문서 해시 기반 캐시를 우선 사용해서 결과를 안정적으로 유지합니다.
          </div>
        </div>
      </section>

      {items.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText size={16} style={{ color: PRIMARY }} />
              업로드된 문서
            </div>
            {isAnalyzing && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                문서 분석 중
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-3">
            {items.map(item => (
              <div key={item.id} className="rounded-lg border border-border bg-muted/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{item.file.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatFileSize(item.file.size)} · {item.analysis?.extractionMethod ?? '추출 대기'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.status} />
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {item.error && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    <span>{item.error}</span>
                  </div>
                )}

                {item.analysis && (
                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="space-y-3">
                      <section className="rounded-lg bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Sparkles size={14} style={{ color: PRIMARY }} />
                          AI 요약
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                          {item.analysis.summary}
                        </p>
                        {item.analysis.keyPoints.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.analysis.keyPoints.map(point => (
                              <span key={point} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                                {point}
                              </span>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>

                    <div className="space-y-3">
                      <section className="rounded-lg bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Brain size={14} style={{ color: PRIMARY }} />
                          중점 파악 항목
                        </div>
                        <div className="mt-3 space-y-3">
                          {Object.entries(item.analysis.focusFields).map(([key, value]) => (
                            <FocusFieldCard
                              key={key}
                              label={focusFieldLabels[key as FocusFieldKey]}
                              value={value}
                            />
                          ))}
                        </div>
                      </section>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {completedAnalyses.length > 0 && (
        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles size={16} style={{ color: PRIMARY }} />
              통합 요약
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">
              {mergedSummary}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <BarChart3 size={16} style={{ color: PRIMARY }} />
              통합 핵심 정보
            </div>
            <div className="mt-4 space-y-3">
              {Object.entries(mergedFocusFields).map(([key, value]) => (
                <FocusFieldCard
                  key={key}
                  label={focusFieldLabels[key as FocusFieldKey]}
                  value={value}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-muted/10 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <AlertCircle size={15} style={{ color: PRIMARY }} />
          비교 점수 연결 포인트
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          비교 점수는 추후 Supabase에 저장될 상담 이력 데이터를 기준으로 산출되도록 비워 두었습니다.
          현재 탭은 그 연결 지점을 유지한 채 문서 추출, 요약, 핵심 항목 구조화까지만 담당합니다.
        </p>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: UploadItem['status'] }) {
  const labelMap = {
    queued: '대기',
    analyzing: '분석 중',
    done: '완료',
    error: '실패',
  } satisfies Record<UploadItem['status'], string>;

  const classNameMap = {
    queued: 'bg-muted text-muted-foreground',
    analyzing: 'bg-[#009C64]/10 text-[#009C64]',
    done: 'bg-green-100 text-green-700',
    error: 'bg-destructive/10 text-destructive',
  } satisfies Record<UploadItem['status'], string>;

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${classNameMap[status]}`}>
      {labelMap[status]}
    </span>
  );
}

function FocusFieldCard({ label, value }: { label: string; value: FocusFieldValue }) {
  const displayValue = value.value
    ? stringifyFocusValue(value.value)
    : '확인되지 않음';

  return (
    <div className="rounded-lg border border-border bg-muted/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-foreground">
          {value.confidence}
        </span>
      </div>
      <div className="mt-2 text-sm font-medium text-foreground">{displayValue}</div>
      {value.evidence && (
        <div className="mt-1 text-xs leading-5 text-muted-foreground">
          근거: {value.evidence}
        </div>
      )}
    </div>
  );
}

function buildFileSignature(file: File): string {
  return [file.name, file.size, file.lastModified].join(':');
}

function isSupportedFile(name: string): boolean {
  return ['pdf', 'xls', 'xlsx', 'hwp', 'hwpx', 'txt', 'csv'].includes(
    name.toLowerCase().split('.').at(-1) ?? '',
  );
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
