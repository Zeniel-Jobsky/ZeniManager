import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Award,
  Briefcase,
  FilePlus2,
  FileText,
  GraduationCap,
  Loader2,
  Sparkles,
  Target,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import type { ClientRow } from "@/lib/supabase";
import {
  analyzeDocumentFile,
  mergeDocumentAnalyses,
  prepareAnalysisFile,
  type DocumentAnalysisResult,
} from "@/lib/summaryAnalysis";
import {
  buildRecommendation,
  buildStructuredSummaryJson,
  calculateCompetencyScoring,
  getRecommendationSystemPrompt,
  getSummaryExtractionPromptPreview,
  type CompetencyScoring,
  type RecommendationResult,
  type StructuredSummaryJson,
} from "@/lib/summaryAnalysisPipeline";
import {
  fetchClientSummaryAnalysis,
  uploadSummaryAnalysisFiles,
  upsertClientSummaryAnalysis,
} from "@/lib/summaryAnalysisStore";

const PRIMARY = "#009C64";
const ACCEPTED_EXTENSIONS =
  ".pdf,.xls,.xlsx,.hwp,.hwpx,.txt,.csv,.png,.jpg,.jpeg,.webp";

type UploadItem = {
  id: string;
  file: File;
  sourceName: string;
  status: "queued" | "analyzing" | "done" | "error";
  analysis: DocumentAnalysisResult | null;
  error: string | null;
};

export function ClientSummaryAnalysisTab({ client }: { client: ClientRow }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [structuredJson, setStructuredJson] =
    useState<StructuredSummaryJson | null>(null);
  const [competencyScoring, setCompetencyScoring] =
    useState<CompetencyScoring | null>(null);
  const [recommendation, setRecommendation] =
    useState<RecommendationResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const completedAnalyses = useMemo(
    () =>
      items
        .map(item => item.analysis)
        .filter(Boolean) as DocumentAnalysisResult[],
    [items]
  );

  const mergedProfile = useMemo(
    () =>
      completedAnalyses.length > 0
        ? mergeDocumentAnalyses(completedAnalyses)
        : null,
    [completedAnalyses]
  );

  useEffect(() => {
    let cancelled = false;

    fetchClientSummaryAnalysis(client.id)
      .then(saved => {
        if (cancelled || !saved || completedAnalyses.length > 0) return;
        setStructuredJson(saved.structured_json);
        setCompetencyScoring(saved.competency_scoring);
        setRecommendation(saved.recommendation);
      })
      .catch(() => {
        // Keep the tab usable even if the saved snapshot cannot be loaded.
      });

    return () => {
      cancelled = true;
    };
  }, [client.id, completedAnalyses.length]);

  useEffect(() => {
    if (!mergedProfile) return;

    const nextJson = buildStructuredSummaryJson(client, mergedProfile);
    const nextScoring = calculateCompetencyScoring(nextJson);
    setStructuredJson(nextJson);
    setCompetencyScoring(nextScoring);

    let cancelled = false;
    buildRecommendation(nextJson)
      .then(result => {
        if (!cancelled) setRecommendation(result);
      })
      .catch(() => {
        if (!cancelled) {
          setRecommendation({
            recommendedJobs: nextJson.desiredJobs,
            industries: [],
            reasons: ["추천 분석을 생성하지 못했습니다."],
            requiredCapabilities: [],
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, mergedProfile]);

  const addFiles = async (incoming: FileList | File[]) => {
    const nextFiles = Array.from(incoming).filter(file =>
      isSupportedFile(file.name)
    );

    if (nextFiles.length === 0) {
      toast.error(
        "지원 형식(pdf, xls, xlsx, hwpx, txt, csv, png, jpg, webp) 파일을 선택해 주세요."
      );
      return;
    }

    const preparedResults = await Promise.allSettled(
      nextFiles.map(file => prepareAnalysisFile(file))
    );
    const preparedFiles = preparedResults.flatMap(result =>
      result.status === "fulfilled" ? [result.value] : []
    );
    const failedItems = preparedResults.flatMap((result, index) => {
      if (result.status === "fulfilled") return [];

      const sourceFile = nextFiles[index];
      return [
        {
          id: buildFileSignature(sourceFile, sourceFile.name),
          file: sourceFile,
          sourceName: sourceFile.name,
          status: "error" as const,
          analysis: null,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : "문서 변환에 실패했습니다.",
        },
      ];
    });

    if (failedItems.length > 0) {
      setItems(prev => [...prev, ...failedItems]);
    }

    if (preparedFiles.length === 0) {
      return;
    }

    const deduped = preparedFiles.filter(({ file, sourceFileName }) => {
      const signature = buildFileSignature(file, sourceFileName);
      return !items.some(
        item => buildFileSignature(item.file, item.sourceName) === signature
      );
    });

    if (deduped.length === 0) {
      toast.info("같은 파일은 한 번만 추가됩니다.");
      return;
    }

    const queuedItems = deduped.map(({ file, sourceFileName }) => ({
      id: buildFileSignature(file, sourceFileName),
      file,
      sourceName: sourceFileName,
      status: "queued" as const,
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
        prev.map(item =>
          item.id === queuedItem.id
            ? { ...item, status: "analyzing", error: null }
            : item
        )
      );

      try {
        const analysis = await analyzeDocumentFile(queuedItem.file, client);
        setItems(prev =>
          prev.map(item =>
            item.id === queuedItem.id
              ? { ...item, status: "done", analysis }
              : item
          )
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "문서 분석에 실패했습니다.";
        setItems(prev =>
          prev.map(item =>
            item.id === queuedItem.id
              ? { ...item, status: "error", error: message }
              : item
          )
        );
      }
    }

    setIsAnalyzing(false);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSave = async () => {
    if (!structuredJson || !competencyScoring || !recommendation) {
      toast.error("저장할 분석 데이터가 아직 준비되지 않았습니다.");
      return;
    }

    setIsSaving(true);
    try {
      const completedFiles = items.filter(
        (item): item is UploadItem & { file: File } => item.status === "done"
      );
      const uploadedFileRefs =
        completedFiles.length > 0
          ? await uploadSummaryAnalysisFiles({
              clientId: client.id,
              files: completedFiles.map(item => item.file),
            })
          : undefined;

      await upsertClientSummaryAnalysis({
        clientId: client.id,
        structuredJson,
        competencyScoring,
        recommendation,
        promptSnapshot: {
          summaryExtraction: getSummaryExtractionPromptPreview(),
          recommendationSystemPrompt: getRecommendationSystemPrompt(),
        },
        fileRefs: uploadedFileRefs,
      });

      toast.success("요약 및 분석 데이터를 저장했습니다.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "저장에 실패했습니다.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
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
            isDragging
              ? "border-[color:#009C64] bg-[#009C64]/5"
              : "border-border bg-muted/10"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                <Upload size={12} />
                문서 업로드
              </div>
              <h3 className="text-base font-semibold text-foreground">
                요약 및 분석 자료 추가
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                드래그 앤 드롭 또는 직접 선택으로 문서를 추가하면 텍스트를
                추출해 AI 요약, 희망 직업, 자격증, 부가 스펙, 추천 직종을
                정리합니다.
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
              지원 형식: PDF, XLS, XLSX, HWPX, TXT, CSV, PNG, JPG, WEBP
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
                event.target.value = "";
              }
            }}
          />
        </div>

        <div className="rounded-xl border border-border bg-muted/10 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Target size={16} style={{ color: PRIMARY }} />
            분석 상태
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <InfoRow
              label="분석 문서"
              value={`${completedAnalyses.length}건`}
            />
            <InfoRow
              label="추출 항목"
              value={
                mergedProfile
                  ? `${countCapturedFields(mergedProfile)} / 4`
                  : "-"
              }
            />
          </div>
          <div className="mt-4 rounded-lg bg-white/80 p-3 text-xs leading-5 text-muted-foreground">
            같은 사람과 같은 문서를 다시 넣으면 문서 해시 캐시를 우선 사용해
            결과를 최대한 일관되게 유지합니다.
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={
              isSaving ||
              !structuredJson ||
              !competencyScoring ||
              !recommendation
            }
            className="mt-4 inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: PRIMARY }}
          >
            {isSaving ? "저장 중..." : "분석 결과 저장"}
          </button>
        </div>
      </section>

      {items.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText size={16} style={{ color: PRIMARY }} />
              업로드한 문서
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
              <div
                key={item.id}
                className="rounded-lg border border-border bg-muted/10 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {item.sourceName}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatFileSize(item.file.size)} ·{" "}
                      {item.analysis?.extractionMethod ?? "추출 대기"}
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
              </div>
            ))}
          </div>
        </section>
      )}

      {mergedProfile && (
        <section className="grid gap-4 xl:grid-cols-2">
          <AnalysisCard
            title="AI 요약"
            icon={<Sparkles size={16} style={{ color: PRIMARY }} />}
            value={mergedProfile.aiSummary}
            multiline
          />
          <AnalysisCard
            title="희망 직업"
            icon={<Briefcase size={16} style={{ color: PRIMARY }} />}
            value={renderList(
              structuredJson?.desiredJobs ?? mergedProfile.desiredJobs
            )}
          />
          <AnalysisCard
            title="자격증"
            icon={<Award size={16} style={{ color: PRIMARY }} />}
            value={renderQualifications(structuredJson)}
          />
          <AnalysisCard
            title="부가 스펙"
            icon={<GraduationCap size={16} style={{ color: PRIMARY }} />}
            value={renderStructuredExtraSpecs(structuredJson)}
            multiline
          />
        </section>
      )}

      {competencyScoring && (
        <section className="grid gap-4 xl:grid-cols-2">
          <ScoreCard
            title="평가 점수"
            value={`${competencyScoring.score}점`}
            detail="기본 50점 + 최종 학력 1개 + 자격증/어학 가산"
          />
          <ScoreCard
            title="최종 역량 등급"
            value={competencyScoring.finalGrade}
            detail={`평가 점수 ${competencyScoring.score}점 기준`}
          />
        </section>
      )}

      {recommendation && (
        <section className="grid gap-4">
          <AnalysisCard
            title="추천 직종 및 산업"
            icon={<Target size={16} style={{ color: PRIMARY }} />}
            value={[
              `추천 직종: ${renderList(recommendation.recommendedJobs)}`,
              `산업 분야: ${renderList(recommendation.industries)}`,
              `추천 사유: ${renderList(recommendation.reasons)}`,
              `필요 역량: ${renderList(recommendation.requiredCapabilities)}`,
            ].join("\n\n")}
            multiline
          />
        </section>
      )}
    </div>
  );
}

function AnalysisCard({
  title,
  icon,
  value,
  multiline,
}: {
  title: string;
  icon: ReactNode;
  value: string;
  multiline?: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {title}
      </div>
      <div
        className={`mt-4 text-sm leading-6 text-foreground ${multiline ? "whitespace-pre-wrap" : ""}`}
      >
        {value}
      </div>
    </section>
  );
}

function ScoreCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="mt-4 text-3xl font-bold text-foreground">{value}</div>
      <div className="mt-2 text-sm text-muted-foreground">{detail}</div>
    </section>
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

function StatusBadge({ status }: { status: UploadItem["status"] }) {
  const labels: Record<UploadItem["status"], string> = {
    queued: "대기",
    analyzing: "분석 중",
    done: "완료",
    error: "실패",
  };

  const classNames: Record<UploadItem["status"], string> = {
    queued: "bg-muted text-muted-foreground",
    analyzing: "bg-[#009C64]/10 text-[#009C64]",
    done: "bg-green-100 text-green-700",
    error: "bg-destructive/10 text-destructive",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${classNames[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function renderList(values: string[]): string {
  return values.length > 0 ? values.join("\n") : "정보 없음";
}

function renderQualifications(
  structuredJson: StructuredSummaryJson | null
): string {
  if (!structuredJson) return "정보 없음";

  const values = [
    ...structuredJson.qualifications,
    ...structuredJson.languageScores,
  ];

  return values.length > 0 ? values.join("\n") : "정보 없음";
}

function renderStructuredExtraSpecs(
  structuredJson: StructuredSummaryJson | null
): string {
  if (!structuredJson) return "정보 없음";

  const rows = [
    ...(structuredJson.education ? [structuredJson.education] : []),
    ...structuredJson.experience.map(item => {
      if (item.company && item.task) return `${item.company} - ${item.task}`;
      return item.company || item.task || "";
    }),
    ...structuredJson.additionalSpecs.completedEducation,
  ].filter(Boolean);

  return rows.length > 0 ? Array.from(new Set(rows)).join("\n") : "정보 없음";
}

function countCapturedFields(profile: {
  desiredJobs: string[];
  certifications: string[];
  extraSpecs: string[];
  aiSummary: string;
}): number {
  return [
    profile.aiSummary.trim().length > 0,
    profile.desiredJobs.length > 0,
    profile.certifications.length > 0,
    profile.extraSpecs.length > 0,
  ].filter(Boolean).length;
}

function buildFileSignature(file: File, sourceName?: string): string {
  return [sourceName ?? file.name, file.size, file.lastModified].join(":");
}

function isSupportedFile(name: string): boolean {
  const extension = name.toLowerCase().split(".").at(-1) ?? "";
  return [
    "pdf",
    "xls",
    "xlsx",
    "hwp",
    "hwpx",
    "txt",
    "csv",
    "png",
    "jpg",
    "jpeg",
    "webp",
  ].includes(extension);
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
