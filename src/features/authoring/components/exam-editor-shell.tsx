"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Alert } from "@/components/ui/feedback";
import { Badge, Card, CardBody } from "@/components/ui/card";
import { AssignmentPanel } from "@/features/authoring/components/assignment-panel";
import { ExamInfoForm, type ExamInfoDraft } from "@/features/authoring/components/exam-info-form";
import { ExamPreviewPanel } from "@/features/authoring/components/exam-preview-panel";
import {
  QuestionEditorForm,
  type QuestionSaveState,
} from "@/features/authoring/components/question-editor-form";
import { QuestionOutline } from "@/features/authoring/components/question-outline";
import { ValidationReportPanel } from "@/features/authoring/components/validation-report-panel";
import {
  useAddQuestion,
  useAuthoringExam,
  useDeleteQuestion,
  useDuplicateExam,
  useDuplicateQuestion,
  useExamLifecycle,
  useReorderQuestions,
  useUpdateExamInfo,
  useValidateExam,
} from "@/features/authoring/hooks/use-authoring";
import { emptyRichDoc } from "@/features/authoring/services/rich-content-core";
import type { AuthoringExamDetailDto, ClassroomDto } from "@/features/authoring/types";
import type { SubjectDto } from "@/features/exams/types";
import { ApiClientError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

const AUTOSAVE_DELAY_MS = 1200;

type InfoSaveState = "idle" | "saving" | "saved" | "error";

interface ValidationIssueShape {
  code: string;
  message: string;
  severity: "error" | "warning";
  questionId: string | null;
  field: string;
}

function buildInfoDraft(exam: AuthoringExamDetailDto): ExamInfoDraft {
  return {
    title: exam.title,
    subjectId: exam.subjectId,
    durationMinutes: String(exam.durationMinutes),
    description: exam.description ?? "",
    gradeLevel: exam.gradeLevel ? String(exam.gradeLevel) : "",
    year: exam.year ? String(exam.year) : "",
    scope: exam.scope,
    classroomId: exam.classroomId ?? "",
    instructionsDoc: exam.instructionsDoc ?? emptyRichDoc(),
  };
}

function buildInfoPayload(draft: ExamInfoDraft, canChooseScope: boolean): Record<string, unknown> {
  return {
    title: draft.title.trim(),
    subjectId: draft.subjectId || undefined,
    durationMinutes: draft.durationMinutes ? Number(draft.durationMinutes) : undefined,
    description: draft.description.trim() ? draft.description.trim() : null,
    gradeLevel: draft.gradeLevel ? Number(draft.gradeLevel) : null,
    year: draft.year ? Number(draft.year) : null,
    instructionsDoc: draft.instructionsDoc,
    ...(canChooseScope
      ? {
          scope: draft.scope,
          classroomId: draft.scope === "CLASS" ? draft.classroomId || null : null,
        }
      : {}),
  };
}

function extractValidationIssues(error: ApiClientError): ValidationIssueShape[] {
  const details = error.details as { issues?: ValidationIssueShape[] } | undefined;
  return details?.issues ?? [];
}

/**
 * Không gian làm việc 3 bước của trình soạn đề.
 *
 * Bước 2 dùng bố cục desktop hai cột: mục lục câu hỏi bên trái, khu soạn chiếm phần còn lại —
 * rộng hết mức để nhìn trọn câu hỏi, phương án và công thức. Trên màn hình nhỏ, mục lục chuyển
 * thành drawer. Bản xem trước như học sinh chỉ nằm ở bước 3 (và bản xem trước này là bản duy
 * nhất của người soạn) nên bước 2 không còn cột xem trước.
 *
 * Thanh hành động (lưu nháp, trạng thái lưu, kiểm tra đề, xuất bản) được ghim ở đầu khung
 * soạn nên luôn trong tầm tay.
 */
export function ExamEditorShell({
  exam: initialExam,
  subjects,
  classrooms,
  isAdmin,
  questionsOnly = false,
}: {
  exam: AuthoringExamDetailDto;
  subjects: SubjectDto[];
  classrooms: ClassroomDto[];
  isAdmin: boolean;
  /** Mở thẳng bước 2 khi người dùng bấm "Soạn câu hỏi". */
  questionsOnly?: boolean;
}) {
  const examId = initialExam.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const examQuery = useAuthoringExam(examId, initialExam);
  const exam = examQuery.data ?? initialExam;

  const updateInfo = useUpdateExamInfo(examId);
  const addQuestion = useAddQuestion(examId);
  const duplicateQuestion = useDuplicateQuestion(examId);
  const deleteQuestion = useDeleteQuestion(examId);
  const reorderQuestions = useReorderQuestions(examId);
  const validateExam = useValidateExam(examId);
  const lifecycle = useExamLifecycle(examId);
  const duplicateExam = useDuplicateExam();

  const [step, setStep] = useState<1 | 2 | 3>(questionsOnly ? 2 : 1);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    initialExam.questions[0]?.id ?? null,
  );
  const [focusQuestionId, setFocusQuestionId] = useState<string | null>(null);

  const [draft, setDraft] = useState<ExamInfoDraft>(() => buildInfoDraft(initialExam));
  const [infoState, setInfoState] = useState<InfoSaveState>("idle");
  const [infoError, setInfoError] = useState<string | null>(null);
  const [questionSaveState, setQuestionSaveState] = useState<QuestionSaveState>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [report, setReport] = useState<Awaited<
    ReturnType<typeof validateExam.mutateAsync>
  > | null>(null);

  const infoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const infoSequenceRef = useRef(0);
  const infoDirtyRef = useRef(false);

  const contentLocked = exam.contentLocked;

  const saveInfo = async (values: ExamInfoDraft) => {
    const sequence = (infoSequenceRef.current += 1);
    setInfoState("saving");
    setInfoError(null);

    try {
      // Số phiên bản được đọc từ cache ở thời điểm lưu (không lưu trong ref khi render).
      const currentRevision =
        queryClient.getQueryData<AuthoringExamDetailDto>(queryKeys.authoringExam(examId))?.revision ??
        exam.revision;

      await updateInfo.mutateAsync({
        revision: currentRevision,
        ...buildInfoPayload(values, isAdmin),
      });

      if (sequence === infoSequenceRef.current) {
        infoDirtyRef.current = false;
        setInfoState("saved");
      }
    } catch (error) {
      if (sequence === infoSequenceRef.current) {
        setInfoError(
          error instanceof ApiClientError ? error.message : "Không lưu được thông tin đề.",
        );
        setInfoState("error");
      }
    }
  };

  const handleDraftChange = (patch: Partial<ExamInfoDraft>) => {
    if (contentLocked) {
      setActionError(
        "Đề đã có lượt làm bài nên nội dung và thông tin đáp án không thể sửa. Hãy dùng “Tạo bản sao để chỉnh sửa”.",
      );
      return;
    }

    // Giá trị mới được tính ngay tại đây để autosave không phụ thuộc state cũ.
    const nextDraft: ExamInfoDraft = { ...draft, ...patch };
    setDraft(nextDraft);
    infoDirtyRef.current = true;
    setInfoState("idle");

    if (infoTimerRef.current) {
      clearTimeout(infoTimerRef.current);
    }
    infoTimerRef.current = setTimeout(() => {
      infoTimerRef.current = null;
      if (infoDirtyRef.current) {
        void saveInfo(nextDraft);
      }
    }, AUTOSAVE_DELAY_MS);
  };

  // Cảnh báo trình duyệt khi rời trang mà còn thay đổi chưa lưu thành công.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (
        !infoDirtyRef.current &&
        questionSaveState !== "dirty" &&
        questionSaveState !== "saving"
      ) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [questionSaveState]);

  useEffect(
    () => () => {
      if (infoTimerRef.current) {
        clearTimeout(infoTimerRef.current);
      }
    },
    [],
  );

  const selectedQuestion =
    exam.questions.find((question) => question.id === selectedQuestionId) ??
    exam.questions[0] ??
    null;

  const runValidate = async () => {
    setActionError(null);
    try {
      const result = await validateExam.mutateAsync();
      setReport(result);
      setStep(3);
    } catch (error) {
      setActionError(
        error instanceof ApiClientError ? error.message : "Không kiểm tra được đề thi.",
      );
    }
  };

  const runLifecycle = async (action: "publish" | "unpublish" | "archive") => {
    setActionError(null);
    setNotice(null);
    try {
      await lifecycle.mutateAsync({ action, revision: exam.revision });
      setNotice(
        action === "publish"
          ? "Đã xuất bản nội dung đề."
          : action === "unpublish"
            ? "Đã thu hồi đề về bản nháp."
            : "Đã lưu trữ đề.",
      );
    } catch (error) {
      // Xuất bản bị chặn vì đề còn lỗi: chuyển sang bước 3 và hiển thị danh sách lỗi.
      if (error instanceof ApiClientError && error.code === "EXAM_PUBLISH_INVALID") {
        const issues = extractValidationIssues(error);
        setReport({
          issues,
          errorCount: issues.filter((issue) => issue.severity === "error").length,
          warningCount: issues.filter((issue) => issue.severity === "warning").length,
          canPublish: false,
          totalPoints: exam.totalPoints,
          questionCount: exam.questionCount,
        });
        setStep(3);
      }
      setActionError(
        error instanceof ApiClientError ? error.message : "Thao tác không thành công.",
      );
    }
  };

  const createQuestion = async () => {
    setActionError(null);
    try {
      const created = await addQuestion.mutateAsync({
        question: {
          type: "SINGLE_CHOICE",
          level: "MEDIUM",
          points: 1,
          contentDoc: emptyRichDoc(),
          explanationDoc: emptyRichDoc(),
          options: [0, 1, 2, 3].map((index) => ({
            contentDoc: emptyRichDoc(),
            isCorrect: index === 0,
          })),
        },
      });
      setSelectedQuestionId(created.id);
      setStep(2);
    } catch (error) {
      setActionError(
        error instanceof ApiClientError ? error.message : "Không thêm được câu hỏi.",
      );
    }
  };

  const handleDuplicateQuestion = async (questionId: string) => {
    setActionError(null);
    try {
      const created = await duplicateQuestion.mutateAsync({ questionId });
      setSelectedQuestionId(created.id);
    } catch (error) {
      setActionError(
        error instanceof ApiClientError ? error.message : "Không nhân bản được câu hỏi.",
      );
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    setActionError(null);
    const index = exam.questions.findIndex((question) => question.id === questionId);
    if (!window.confirm("Xoá câu hỏi này khỏi đề?")) {
      return;
    }
    try {
      await deleteQuestion.mutateAsync({ questionId });
      const neighbour = exam.questions[index + 1] ?? exam.questions[index - 1] ?? null;
      setSelectedQuestionId(neighbour ? neighbour.id : null);
    } catch (error) {
      setActionError(error instanceof ApiClientError ? error.message : "Không xoá được câu hỏi.");
    }
  };

  const handleMoveQuestion = async (questionId: string, direction: -1 | 1) => {
    const ids = exam.questions.map((question) => question.id);
    const index = ids.indexOf(questionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) {
      return;
    }
    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];

    setActionError(null);
    try {
      await reorderQuestions.mutateAsync(next);
    } catch (error) {
      setActionError(
        error instanceof ApiClientError ? error.message : "Không đổi được thứ tự câu hỏi.",
      );
    }
  };

  const handleDuplicateExam = async () => {
    setActionError(null);
    try {
      const copy = await duplicateExam.mutateAsync({ examId });
      router.push(`/giao-vien/de-thi/${copy.id}/soan`);
    } catch (error) {
      setActionError(error instanceof ApiClientError ? error.message : "Không tạo được bản sao.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="sticky top-16 z-30 -mx-4 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={exam.status === "PUBLISHED" ? "emerald" : "amber"}>
            {exam.status === "PUBLISHED"
              ? "Đã xuất bản"
              : exam.status === "ARCHIVED"
                ? "Đã lưu trữ"
                : "Bản nháp"}
          </Badge>
          <Badge>{exam.scope === "CLASS" ? "Đề của lớp" : "Đề công khai"}</Badge>
          <Badge>{`${exam.questionCount} câu · ${exam.totalPoints} điểm`}</Badge>
          <span className="text-xs text-slate-500">{`Phiên bản nội dung: ${exam.revision}`}</span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "text-xs font-semibold",
              infoState === "saved"
                ? "text-emerald-600"
                : infoState === "error"
                  ? "text-rose-600"
                  : infoState === "saving"
                    ? "text-sky-600"
                    : "text-slate-500",
            )}
          >
            {infoState === "saving"
              ? "Đang lưu…"
              : infoState === "saved"
                ? "Đã lưu"
                : infoState === "error"
                  ? "Lưu thất bại"
                  : questionSaveState === "dirty"
                    ? "Có thay đổi chưa lưu"
                    : "Đã đồng bộ"}
          </span>

          <button
            type="button"
            onClick={() => void saveInfo(draft)}
            disabled={contentLocked || infoState === "saving"}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            Lưu nháp
          </button>

          <button
            type="button"
            onClick={() => void runValidate()}
            disabled={validateExam.isPending}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            {validateExam.isPending ? "Đang kiểm tra…" : "Kiểm tra đề"}
          </button>

          <button
            type="button"
            onClick={() => void runLifecycle("publish")}
            disabled={lifecycle.isPending}
            className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Xuất bản
          </button>

          {exam.status === "PUBLISHED" ? (
            <button
              type="button"
              onClick={() => void runLifecycle("unpublish")}
              disabled={lifecycle.isPending || contentLocked}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              Thu hồi
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void runLifecycle("archive")}
            disabled={lifecycle.isPending || exam.status === "ARCHIVED"}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            Lưu trữ
          </button>
        </div>
      </div>

      {contentLocked ? (
        <Alert tone="warning" title="Đề đã có lượt làm bài">
          Nội dung và đáp án bị khoá để không làm thay đổi điểm lịch sử của các lượt đã làm.{" "}
          <button
            type="button"
            onClick={() => void handleDuplicateExam()}
            className="font-semibold underline"
          >
            Tạo bản sao để chỉnh sửa
          </button>
        </Alert>
      ) : null}

      {actionError ? <Alert tone="error">{actionError}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {infoError ? (
        <Alert tone="error" title="Không lưu được thông tin đề">
          <p>{infoError}</p>
          <button
            type="button"
            onClick={() => void saveInfo(draft)}
            className="mt-2 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Thử lưu lại
          </button>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 1 as const, label: "1. Thông tin đề" },
          { id: 2 as const, label: "2. Soạn câu hỏi" },
          { id: 3 as const, label: "3. Kiểm tra & xuất bản" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setStep(item.id)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
              step === item.id
                ? "bg-sky-600 text-white"
                : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-100",
            )}
          >
            {item.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setOutlineOpen(true)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 lg:hidden"
        >
          Mục lục câu hỏi
        </button>
      </div>
      {step === 1 ? (
        <div className="space-y-4">
          <ExamInfoForm
            examId={examId}
            draft={draft}
            onChange={handleDraftChange}
            subjects={subjects}
            classrooms={classrooms}
            canChooseScope={isAdmin}
            disabled={contentLocked}
          />
          <Card>
            <CardBody className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-600">
                Thông tin đề được lưu tự động. Bấm sang bước 2 để soạn câu hỏi.
              </p>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Sang bước 2
              </button>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <Card>
              <CardBody>
                <QuestionOutline
                  questions={exam.questions}
                  selectedQuestionId={selectedQuestion?.id ?? null}
                  disabled={contentLocked}
                  busy={
                    addQuestion.isPending ||
                    duplicateQuestion.isPending ||
                    deleteQuestion.isPending ||
                    reorderQuestions.isPending
                  }
                  onSelect={(id) => setSelectedQuestionId(id)}
                  onAdd={() => void createQuestion()}
                  onDuplicate={(id) => void handleDuplicateQuestion(id)}
                  onDelete={(id) => void handleDeleteQuestion(id)}
                  onMove={(id, direction) => void handleMoveQuestion(id, direction)}
                />
              </CardBody>
            </Card>
          </aside>

          <section className="space-y-4">
            {selectedQuestion ? (
              <Card>
                <CardBody>
                  <QuestionEditorForm
                    key={`${selectedQuestion.id}-${selectedQuestion.position}`}
                    examId={examId}
                    question={selectedQuestion}
                    disabled={contentLocked}
                    onSaved={() => setQuestionSaveState("saved")}
                    onSaveStateChange={setQuestionSaveState}
                  />
                </CardBody>
              </Card>
            ) : (
              <Card>
                <CardBody className="space-y-3 text-center">
                  <p className="text-sm text-slate-600">Đề chưa có câu hỏi nào.</p>
                  <button
                    type="button"
                    onClick={() => void createQuestion()}
                    disabled={contentLocked}
                    className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    + Thêm câu hỏi đầu tiên
                  </button>
                </CardBody>
              </Card>
            )}
          </section>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="space-y-4">
            <ValidationReportPanel
              report={report}
              onJumpToQuestion={(questionId) => {
                setSelectedQuestionId(questionId);
                setFocusQuestionId(questionId);
                setStep(2);
              }}
            />

            <Card>
              <CardBody className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-600">
                  Đã kiểm tra xong? Xuất bản nội dung để học sinh có thể làm bài.
                </p>
                <button
                  type="button"
                  onClick={() => void runLifecycle("publish")}
                  disabled={lifecycle.isPending}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Xuất bản đề
                </button>
              </CardBody>
            </Card>

            <AssignmentPanel exam={exam} canManage={isAdmin || exam.scope === "CLASS"} />
          </div>

          <div className="hidden lg:block">
            <ExamPreviewPanel exam={exam} focusQuestionId={focusQuestionId} />
          </div>
        </div>
      ) : null}

      {outlineOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true">
          <div
            className="flex-1 bg-slate-900/40"
            onClick={() => setOutlineOpen(false)}
            aria-hidden="true"
          />
          <div className="w-80 max-w-[85%] overflow-y-auto bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800">Mục lục câu hỏi</p>
              <button
                type="button"
                onClick={() => setOutlineOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-slate-500"
                aria-label="Đóng mục lục"
              >
                ✕
              </button>
            </div>
            <QuestionOutline
              questions={exam.questions}
              selectedQuestionId={selectedQuestion?.id ?? null}
              disabled={contentLocked}
              busy={addQuestion.isPending || reorderQuestions.isPending}
              onSelect={(id) => {
                setSelectedQuestionId(id);
                setStep(2);
                setOutlineOpen(false);
              }}
              onAdd={() => {
                void createQuestion();
                setOutlineOpen(false);
              }}
              onDuplicate={(id) => void handleDuplicateQuestion(id)}
              onDelete={(id) => void handleDeleteQuestion(id)}
              onMove={(id, direction) => void handleMoveQuestion(id, direction)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}


