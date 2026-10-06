import type { QuestionLevelValue, QuestionTypeValue, UserRoleValue } from "@/features/authoring/types";
import {
  collectAssetIds,
  collectLatex,
  type RichDoc,
} from "@/features/authoring/services/rich-content-core";
import { checkLatex } from "@/features/math/services/latex-core";
import { AppError } from "@/lib/errors";

/**
 * Luật nghiệp vụ thuần của tính năng tạo & quản lý đề thi: quyền theo phạm vi đề,
 * kiểm tra trước khi xuất bản, nhân bản câu hỏi, sắp xếp lại và lọc đáp án khỏi
 * payload dành cho học sinh.
 *
 * Mô-đun này KHÔNG import Prisma/Next.js (chỉ dùng `AppError` thuần) nên kiểm thử
 * được bằng Vitest, và là nơi duy nhất quyết định luật chơi của phạm vi đề.
 */

/**
 * Những loại câu hỏi đã hoàn chỉnh từ soạn thảo → lưu → làm bài → chấm điểm.
 * `TRUE_FALSE` và `SHORT_ANSWER` đã có chỗ chứa dữ liệu trong schema nhưng chưa có
 * luồng làm bài/chấm điểm, nên bị CHẶN ở máy chủ khi xuất bản (không chỉ ẩn trên UI).
 */
export const SUPPORTED_QUESTION_TYPES: readonly QuestionTypeValue[] = ["SINGLE_CHOICE"];

export const QUESTION_TYPE_LABELS: Record<QuestionTypeValue, string> = {
  SINGLE_CHOICE: "Trắc nghiệm một đáp án đúng",
  TRUE_FALSE: "Đúng/sai theo từng ý (chưa hỗ trợ làm bài)",
  SHORT_ANSWER: "Trả lời ngắn (chưa hỗ trợ chấm điểm)",
};

export const MAX_OPTIONS_PER_QUESTION = 8;
export const MIN_OPTIONS_PER_QUESTION = 2;
export const MAX_POINTS_PER_QUESTION = 100;
export const MIN_EXAM_DURATION_MINUTES = 1;
export const MAX_EXAM_DURATION_MINUTES = 600;
export const MAX_QUESTIONS_PER_EXAM = 200;

export function isSupportedQuestionType(type: string): type is QuestionTypeValue {
  return SUPPORTED_QUESTION_TYPES.includes(type as QuestionTypeValue);
}

// ---------------------------------------------------------------------------
// Quyền theo phạm vi đề
// ---------------------------------------------------------------------------

export interface ExamActor {
  id: string;
  role: UserRoleValue;
}

export interface ExamOwnership {
  /** Phạm vi đề: PUBLIC (chỉ ADMIN quản lý) hoặc CLASS (thuộc một lớp). */
  scope: "PUBLIC" | "CLASS";
  classroomId: string | null;
  createdById: string | null;
  /** Giáo viên phụ trách lớp sở hữu đề (null khi đề công khai hoặc lớp không còn). */
  classroomOwnerId: string | null;
}

/**
 * Người đang gọi có quyền quản lý đề này không.
 * - ADMIN: mọi đề.
 * - TEACHER: chỉ đề phạm vi CLASS thuộc lớp mình phụ trách (hoặc do mình tạo trong lớp đó).
 * - STUDENT: không bao giờ (client gửi `role` lên cũng không thay đổi được kết quả).
 */
export function canManageExam(actor: ExamActor, exam: ExamOwnership): boolean {
  if (actor.role === "ADMIN") {
    return true;
  }
  if (actor.role !== "TEACHER") {
    return false;
  }
  if (exam.scope !== "CLASS" || !exam.classroomId) {
    return false;
  }
  return exam.classroomOwnerId === actor.id || exam.createdById === actor.id;
}

export function assertCanManageExam(actor: ExamActor, exam: ExamOwnership): void {
  if (!canManageExam(actor, exam)) {
    throw new AppError(
      "FORBIDDEN",
      "Bạn không có quyền quản lý đề thi này. Chỉ giáo viên phụ trách lớp sở hữu đề hoặc quản trị viên mới được thao tác.",
      403,
    );
  }
}

/**
 * Kiểm tra quyền tạo đề theo phạm vi mong muốn. Giáo viên không thể tạo đề PUBLIC và
 * không thể tạo đề cho lớp mình không phụ trách — quyết định dựa trên dữ liệu lớp đọc
 * từ database, không dựa vào tham số client gửi lên.
 */
export function assertExamScopeAllowedForCreate(
  actor: ExamActor,
  scope: "PUBLIC" | "CLASS",
  classroomOwnerId: string | null,
): void {
  if (actor.role === "ADMIN") {
    return;
  }
  if (actor.role !== "TEACHER") {
    throw new AppError("FORBIDDEN", "Chỉ giáo viên hoặc quản trị viên mới được tạo đề thi.", 403);
  }
  if (scope === "PUBLIC") {
    throw new AppError(
      "FORBIDDEN",
      "Giáo viên không thể tạo đề công khai. Hãy tạo đề cho lớp do mình phụ trách.",
      403,
    );
  }
  if (!classroomOwnerId || classroomOwnerId !== actor.id) {
    throw new AppError("FORBIDDEN", "Bạn chỉ có thể tạo đề cho lớp do mình phụ trách.", 403);
  }
}

/**
 * Phạm vi đề chỉ được đặt lúc tạo và chỉ ADMIN được đổi. Giáo viên không thể chuyển đề
 * sang PUBLIC hoặc sang lớp khác, kể cả khi tự gửi `scope`/`classroomId` trong payload.
 */
export function assertScopeChangeAllowed(
  actor: ExamActor,
  current: ExamOwnership,
  next: { scope: "PUBLIC" | "CLASS"; classroomId: string | null; classroomOwnerId: string | null },
): void {
  const unchanged = current.scope === next.scope && current.classroomId === next.classroomId;
  if (unchanged) {
    return;
  }
  if (actor.role !== "ADMIN") {
    throw new AppError(
      "FORBIDDEN",
      "Chỉ quản trị viên mới được đổi phạm vi công khai hoặc chuyển đề sang lớp khác.",
      403,
    );
  }
  if (next.scope === "CLASS" && !next.classroomId) {
    throw new AppError("VALIDATION_ERROR", "Đề thuộc lớp phải chọn lớp sở hữu.", 422);
  }
}

// ---------------------------------------------------------------------------
// Vòng đời nội dung
// ---------------------------------------------------------------------------

/**
 * Đề đã phát sinh lượt làm bài thì nội dung/đáp án bị khoá: người soạn phải dùng
 * "Tạo bản sao để chỉnh sửa" thay vì sửa đè lên đề đã có bài làm.
 */
export function assertContentEditable(attemptCount: number): void {
  if (attemptCount > 0) {
    throw new AppError(
      "EXAM_CONTENT_LOCKED",
      "Đề thi đã có lượt làm bài nên nội dung và đáp án không thể sửa. Hãy dùng “Tạo bản sao để chỉnh sửa”.",
      409,
    );
  }
}

/**
 * Chống ghi đè giữa nhiều tab/người soạn: mỗi lần lưu phải kèm số phiên bản đang giữ.
 * Phiên bản lệch nghĩa là có người khác (hoặc tab khác) đã lưu sau đó.
 */
export function assertRevisionMatches(expected: number | undefined, current: number): void {
  if (expected === undefined) {
    return;
  }
  if (expected !== current) {
    throw new AppError(
      "EXAM_REVISION_CONFLICT",
      "Đề thi đã được thay đổi ở nơi khác (tab khác hoặc người khác). Hãy tải lại để xem bản mới nhất trước khi lưu tiếp.",
      409,
      { currentRevision: current },
    );
  }
}

/** Thứ tự mới phải là hoán vị đúng của danh sách câu hỏi hiện có. */
export function buildQuestionOrder(
  currentQuestionIds: readonly string[],
  desiredQuestionIds: readonly string[],
): Array<{ id: string; position: number }> {
  const desired = new Set(desiredQuestionIds);

  if (
    desiredQuestionIds.length !== currentQuestionIds.length ||
    desired.size !== desiredQuestionIds.length ||
    currentQuestionIds.some((id) => !desired.has(id))
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Danh sách thứ tự câu hỏi không khớp với đề hiện tại. Hãy tải lại đề rồi thử lại.",
      422,
    );
  }

  return desiredQuestionIds.map((id, index) => ({ id, position: index + 1 }));
}

/** Nhãn A/B/C/D… sinh theo THỨ TỰ HIỂN THỊ (đáp án đúng luôn tham chiếu theo ID). */
export function optionLabelAt(index: number): string {
  return String.fromCharCode("A".charCodeAt(0) + (index % 26));
}

export function normalizePoints(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isValidPoints(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_POINTS_PER_QUESTION &&
    Math.abs(normalizePoints(value) - value) < 0.000001
  );
}

// ---------------------------------------------------------------------------
// Kiểm tra trước khi xuất bản (máy chủ là nơi quyết định cuối cùng)
// ---------------------------------------------------------------------------

export type PublishIssueSeverity = "error" | "warning";

export interface PublishIssue {
  code: string;
  message: string;
  severity: PublishIssueSeverity;
  /** Câu hỏi liên quan để giao diện nhảy tới đúng chỗ cần sửa (null nếu là lỗi của đề). */
  questionId: string | null;
  /** Trường liên quan: title, durationMinutes, classroomId, content, options, formula, image… */
  field: string;
}

export interface PublishCandidateOption {
  id: string;
  label: string;
  content: string;
  contentDoc: RichDoc | null;
  isCorrect: boolean;
}

export interface PublishCandidateQuestion {
  id: string;
  type: string;
  points: number;
  content: string;
  contentDoc: RichDoc | null;
  explanation: string | null;
  explanationDoc: RichDoc | null;
  options: PublishCandidateOption[];
}

export interface PublishCandidateExam {
  title: string;
  durationMinutes: number;
  scope: "PUBLIC" | "CLASS";
  classroomId: string | null;
  instructionsDoc: RichDoc | null;
}

function checkFormulas(
  doc: RichDoc | null,
  target: { questionId: string | null; field: string },
  issues: PublishIssue[],
): void {
  if (!doc) {
    return;
  }
  for (const { latex } of collectLatex(doc)) {
    const result = checkLatex(latex);
    if (!result.ok) {
      issues.push({
        code: "FORMULA_INVALID",
        message: `${result.error} (nguồn: ${latex.slice(0, 60)})`,
        severity: "error",
        questionId: target.questionId,
        field: "formula",
      });
    }
  }
}

function checkAssets(
  doc: RichDoc | null,
  knownAssetIds: ReadonlySet<string>,
  target: { questionId: string | null; field: string },
  issues: PublishIssue[],
): void {
  if (!doc) {
    return;
  }
  for (const assetId of collectAssetIds(doc)) {
    if (!knownAssetIds.has(assetId)) {
      issues.push({
        code: "IMAGE_MISSING",
        message: "Có ảnh chưa tải lên xong hoặc đã bị xoá. Hãy chèn lại ảnh trước khi xuất bản.",
        severity: "error",
        questionId: target.questionId,
        field: "image",
      });
    }
  }
}

/**
 * Kiểm tra toàn bộ đề trước khi xuất bản. Trả về danh sách vấn đề (lỗi + cảnh báo) để
 * giao diện liệt kê và nhảy tới đúng câu; chỉ những vấn đề `severity: "error"` mới chặn
 * xuất bản. Cùng hàm này được cả route `/validate` và thao tác `/publish` sử dụng.
 */
export function validateExamForPublish(input: {
  exam: PublishCandidateExam;
  questions: readonly PublishCandidateQuestion[];
  /** Mã các ảnh đã upload thành công và thuộc quyền của người soạn. */
  knownAssetIds: ReadonlySet<string>;
}): PublishIssue[] {
  const issues: PublishIssue[] = [];
  const { exam, questions, knownAssetIds } = input;

  if (exam.title.trim().length < 3) {
    issues.push({
      code: "EXAM_TITLE_REQUIRED",
      message: "Tên đề thi cần ít nhất 3 ký tự.",
      severity: "error",
      questionId: null,
      field: "title",
    });
  }

  if (
    !Number.isInteger(exam.durationMinutes) ||
    exam.durationMinutes < MIN_EXAM_DURATION_MINUTES ||
    exam.durationMinutes > MAX_EXAM_DURATION_MINUTES
  ) {
    issues.push({
      code: "EXAM_DURATION_INVALID",
      message: `Thời gian làm bài phải từ ${MIN_EXAM_DURATION_MINUTES} đến ${MAX_EXAM_DURATION_MINUTES} phút.`,
      severity: "error",
      questionId: null,
      field: "durationMinutes",
    });
  }

  if (exam.scope === "CLASS" && !exam.classroomId) {
    issues.push({
      code: "EXAM_CLASSROOM_REQUIRED",
      message: "Đề thuộc lớp phải chọn lớp sở hữu trước khi xuất bản.",
      severity: "error",
      questionId: null,
      field: "classroomId",
    });
  }

  checkFormulas(exam.instructionsDoc, { questionId: null, field: "instructions" }, issues);

  if (questions.length === 0) {
    issues.push({
      code: "EXAM_EMPTY",
      message: "Đề thi chưa có câu hỏi nào.",
      severity: "error",
      questionId: null,
      field: "questions",
    });
  }

  if (questions.length > MAX_QUESTIONS_PER_EXAM) {
    issues.push({
      code: "EXAM_TOO_MANY_QUESTIONS",
      message: `Một đề chỉ nên có tối đa ${MAX_QUESTIONS_PER_EXAM} câu hỏi.`,
      severity: "warning",
      questionId: null,
      field: "questions",
    });
  }

  for (const question of questions) {
    const target = { questionId: question.id, field: "question" };

    if (!isSupportedQuestionType(question.type)) {
      issues.push({
        code: "QUESTION_TYPE_UNSUPPORTED",
        message: `Loại câu “${
          QUESTION_TYPE_LABELS[question.type as QuestionTypeValue] ?? question.type
        }” chưa được hệ thống làm bài/chấm điểm hỗ trợ nên không thể xuất bản. Hãy đổi sang trắc nghiệm một đáp án đúng.`,
        severity: "error",
        questionId: question.id,
        field: "type",
      });
    }

    if (!isValidPoints(question.points)) {
      issues.push({
        code: "QUESTION_POINTS_INVALID",
        message: `Điểm của câu phải lớn hơn 0, tối đa ${MAX_POINTS_PER_QUESTION} và có tối đa 2 chữ số thập phân.`,
        severity: "error",
        questionId: question.id,
        field: "points",
      });
    }

    if (question.content.trim().length === 0) {
      issues.push({
        code: "QUESTION_CONTENT_REQUIRED",
        message: "Nội dung câu hỏi đang để trống.",
        severity: "error",
        questionId: question.id,
        field: "content",
      });
    }

    if (question.options.length < MIN_OPTIONS_PER_QUESTION) {
      issues.push({
        code: "QUESTION_OPTIONS_MISSING",
        message: `Câu hỏi cần ít nhất ${MIN_OPTIONS_PER_QUESTION} phương án trả lời.`,
        severity: "error",
        questionId: question.id,
        field: "options",
      });
    }

    if (question.options.length > MAX_OPTIONS_PER_QUESTION) {
      issues.push({
        code: "QUESTION_OPTIONS_TOO_MANY",
        message: `Mỗi câu chỉ nên có tối đa ${MAX_OPTIONS_PER_QUESTION} phương án.`,
        severity: "warning",
        questionId: question.id,
        field: "options",
      });
    }

    const correctCount = question.options.filter((option) => option.isCorrect).length;
    if (question.type === "SINGLE_CHOICE" && question.options.length > 0 && correctCount !== 1) {
      issues.push({
        code: "QUESTION_CORRECT_ANSWER_INVALID",
        message:
          correctCount === 0
            ? "Câu hỏi chưa có đáp án đúng."
            : "Câu hỏi trắc nghiệm một đáp án chỉ được có đúng một đáp án đúng.",
        severity: "error",
        questionId: question.id,
        field: "options",
      });
    }

    checkFormulas(question.contentDoc, target, issues);
    checkFormulas(question.explanationDoc, target, issues);
    checkAssets(question.contentDoc, knownAssetIds, target, issues);
    checkAssets(question.explanationDoc, knownAssetIds, target, issues);

    if (!question.explanationDoc || (question.explanation ?? "").trim().length === 0) {
      issues.push({
        code: "QUESTION_EXPLANATION_MISSING",
        message: "Câu hỏi chưa có lời giải/giải thích.",
        severity: "warning",
        questionId: question.id,
        field: "explanation",
      });
    }

    // --- kiểm tra từng phương án trả lời ---
    const labels = new Set<string>();

    for (const option of question.options) {
      if (option.content.trim().length === 0) {
        issues.push({
          code: "OPTION_CONTENT_REQUIRED",
          message: `Phương án ${option.label} đang để trống.`,
          severity: "error",
          questionId: question.id,
          field: "options",
        });
      }
      if (labels.has(option.label)) {
        issues.push({
          code: "OPTION_LABEL_DUPLICATED",
          message: `Nhãn phương án ${option.label} bị lặp.`,
          severity: "error",
          questionId: question.id,
          field: "options",
        });
      }
      labels.add(option.label);
      checkFormulas(option.contentDoc, target, issues);
      checkAssets(option.contentDoc, knownAssetIds, target, issues);
    }
  }

  return issues;
}

/** Chặn xuất bản nếu còn lỗi; ném `EXAM_PUBLISH_INVALID` kèm danh sách lỗi cho giao diện. */
export function assertExamPublishable(issues: readonly PublishIssue[]): void {
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    throw new AppError(
      "EXAM_PUBLISH_INVALID",
      `Đề thi còn ${errors.length} lỗi cần sửa trước khi xuất bản.`,
      409,
      { issues: errors },
    );
  }
}

// ---------------------------------------------------------------------------
// Nhân bản & lọc đáp án
// ---------------------------------------------------------------------------

export interface QuestionDraftOption {
  label: string;
  content: string;
  contentDoc: RichDoc;
  isCorrect: boolean;
  position: number;
}

export interface QuestionDraft {
  type: QuestionTypeValue;
  level: QuestionLevelValue;
  content: string;
  contentDoc: RichDoc;
  explanation: string | null;
  explanationDoc: RichDoc | null;
  rule: unknown;
  options: QuestionDraftOption[];
}

/**
 * Tạo bản nháp câu hỏi mới KHÔNG kèm ID (máy chủ sinh ID mới khi ghi), nhưng giữ nguyên
 * nội dung, công thức, ảnh và vị trí đáp án đúng. Nhờ vậy nhân bản câu hỏi không làm
 * lệch đáp án và có thể dùng lại cho "Tạo bản sao để chỉnh sửa" của cả đề.
 */
export function buildDuplicatedQuestion(source: QuestionDraft): QuestionDraft {
  return {
    type: source.type,
    level: source.level,
    content: source.content,
    contentDoc: structuredClone(source.contentDoc),
    explanation: source.explanation,
    explanationDoc: source.explanationDoc ? structuredClone(source.explanationDoc) : null,
    rule: source.rule ? structuredClone(source.rule) : null,
    options: source.options.map((option, index) => ({
      label: optionLabelAt(index),
      content: option.content,
      contentDoc: structuredClone(option.contentDoc),
      isCorrect: option.isCorrect,
      position: index + 1,
    })),
  };
}

export interface StudentOptionPayload {
  id: string;
  label: string;
  content: string;
  contentDoc: RichDoc | null;
  order: number;
}

export interface StudentQuestionPayload {
  questionId: string;
  position: number;
  type: string;
  points: number;
  content: string;
  contentDoc: RichDoc | null;
  options: StudentOptionPayload[];
}

/**
 * Payload xem trước dành cho học sinh: CHỈ liệt kê những trường được phép công khai —
 * không có `isCorrect`, không có lời giải, không có quy tắc chấm điểm. Việc ẩn đáp án
 * diễn ra ở máy chủ (không gửi dữ liệu rồi ẩn bằng CSS/state ở trình duyệt).
 */
export function toStudentQuestionPayload(
  question: PublishCandidateQuestion,
  position: number,
): StudentQuestionPayload {
  return {
    questionId: question.id,
    position,
    type: question.type,
    points: question.points,
    content: question.content,
    contentDoc: question.contentDoc,
    options: question.options.map((option, index) => ({
      id: option.id,
      label: option.label,
      content: option.content,
      contentDoc: option.contentDoc,
      order: index + 1,
    })),
  };
}



