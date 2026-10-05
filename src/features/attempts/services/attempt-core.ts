import { AppError } from "@/lib/errors";

import {
  snapshotCorrectOptionIdsSchema,
  snapshotOptionsSchema,
} from "@/features/attempts/schemas/attempt.schemas";
import type {
  AttemptResultDto,
  AttemptStatusValue,
  ResultQuestionDto,
  StudentAttemptDto,
  StudentOptionDto,
  StudentQuestionDto,
} from "@/features/attempts/types";

import { roundScore } from "./grading";

/**
 * Quy tắc nghiệp vụ thuần cho lượt làm bài: quyền sở hữu, thời hạn, khả năng
 * sửa đáp án và chuyển đổi dữ liệu sang payload an toàn cho client.
 *
 * Module này KHÔNG import Prisma hay Next.js nên có thể kiểm thử trực tiếp.
 */

export interface AttemptTimingRow {
  id: string;
  sessionId: string;
  status: AttemptStatusValue;
  startedAt: Date;
  expiresAt: Date;
  submittedAt: Date | null;
}

export interface SerializableAttemptAnswerRow {
  questionId: string;
  snapshotPosition: number;
  snapshotType: string;
  snapshotLevel: string;
  snapshotPoints: number;
  snapshotContent: string;
  snapshotExplanation: string | null;
  snapshotOptions: unknown;
  snapshotCorrectOptionIds: unknown;
  selectedOptionId: string | null;
  isFlagged: boolean;
  isCorrect: boolean | null;
}

export interface SerializableAttemptRow extends AttemptTimingRow {
  examId: string;
  lastQuestionPosition: number;
  score: number | null;
  maxScore: number | null;
  correctCount: number | null;
  incorrectCount: number | null;
  unansweredCount: number | null;
  exam: {
    id: string;
    title: string;
    durationMinutes: number;
  };
  answers: SerializableAttemptAnswerRow[];
}

export function computeExpiresAt(startedAt: Date, durationMinutes: number): Date {
  const safeMinutes =
    Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 1;
  return new Date(startedAt.getTime() + safeMinutes * 60_000);
}

export function isDeadlinePassed(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function secondsUntilDeadline(expiresAt: Date, now: Date): number {
  return Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
}

/**
 * Trạng thái hiệu lực: một lượt IN_PROGRESS đã quá hạn được coi là EXPIRED
 * ngay cả khi chưa có thao tác nào từ client (trường hợp đóng trình duyệt).
 */
export function resolveEffectiveStatus(
  status: AttemptStatusValue,
  expiresAt: Date,
  now: Date,
): AttemptStatusValue {
  if (status === "IN_PROGRESS" && isDeadlinePassed(expiresAt, now)) {
    return "EXPIRED";
  }
  return status;
}

/**
 * Kiểm tra lượt làm bài thuộc phiên hiện tại.
 * Trả về 404 (thay vì 403) để không tiết lộ sự tồn tại của lượt làm bài của phiên khác.
 */
export function assertAttemptOwnership(
  attempt: { sessionId: string },
  sessionId: string | null | undefined,
): void {
  if (!sessionId || attempt.sessionId !== sessionId) {
    throw new AppError("ATTEMPT_NOT_FOUND", "Không tìm thấy lượt làm bài.", 404);
  }
}

/** Không cho sửa đáp án sau khi đã nộp hoặc đã hết hạn. */
export function assertAnswersEditable(
  attempt: Pick<AttemptTimingRow, "status" | "expiresAt">,
  now: Date,
): void {
  if (attempt.status === "SUBMITTED") {
    throw new AppError(
      "ATTEMPT_SUBMITTED",
      "Bài đã được nộp nên không thể thay đổi đáp án.",
      409,
    );
  }
  if (attempt.status === "EXPIRED" || isDeadlinePassed(attempt.expiresAt, now)) {
    throw new AppError(
      "ATTEMPT_EXPIRED",
      "Bài đã hết thời gian làm bài nên không thể thay đổi đáp án.",
      409,
    );
  }
}

export function assertResultReady(status: AttemptStatusValue): void {
  if (status === "IN_PROGRESS") {
    throw new AppError(
      "RESULT_NOT_READY",
      "Bài chưa được nộp nên chưa có kết quả.",
      409,
    );
  }
}

/** Lọc bỏ đáp án đúng/lời giải: chỉ lấy phần an toàn để trả về client. */
export function toStudentOptions(raw: unknown): StudentOptionDto[] {
  const parsed = snapshotOptionsSchema.safeParse(raw);
  if (!parsed.success) {
    return [];
  }
  return [...parsed.data].sort((a, b) => a.order - b.order);
}

export function toCorrectOptionIds(raw: unknown): string[] {
  const parsed = snapshotCorrectOptionIdsSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

function sortAnswers(answers: SerializableAttemptAnswerRow[]): SerializableAttemptAnswerRow[] {
  return [...answers].sort((a, b) => a.snapshotPosition - b.snapshotPosition);
}

function toStudentQuestion(answer: SerializableAttemptAnswerRow): StudentQuestionDto {
  return {
    questionId: answer.questionId,
    position: answer.snapshotPosition,
    type: answer.snapshotType,
    level: answer.snapshotLevel,
    points: answer.snapshotPoints,
    content: answer.snapshotContent,
    options: toStudentOptions(answer.snapshotOptions),
    selectedOptionId: answer.selectedOptionId,
    isFlagged: answer.isFlagged,
  };
}

/**
 * Payload trả cho client trong lúc làm bài.
 * Liệt kê từng trường một (không dùng spread) nên không thể vô tình lộ
 * snapshotCorrectOptionIds hay snapshotExplanation.
 */
export function serializeStudentAttempt(
  attempt: SerializableAttemptRow,
  options: { status: AttemptStatusValue; now: Date },
): StudentAttemptDto {
  const questions = sortAnswers(attempt.answers).map(toStudentQuestion);

  return {
    id: attempt.id,
    examId: attempt.examId,
    examTitle: attempt.exam.title,
    status: options.status,
    startedAt: attempt.startedAt.toISOString(),
    expiresAt: attempt.expiresAt.toISOString(),
    submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
    serverTime: options.now.toISOString(),
    durationMinutes: attempt.exam.durationMinutes,
    lastQuestionPosition: attempt.lastQuestionPosition,
    counts: {
      total: questions.length,
      answered: questions.filter((question) => question.selectedOptionId !== null).length,
      flagged: questions.filter((question) => question.isFlagged).length,
    },
    questions,
  };
}

function toResultQuestion(answer: SerializableAttemptAnswerRow): ResultQuestionDto {
  return {
    questionId: answer.questionId,
    position: answer.snapshotPosition,
    type: answer.snapshotType,
    level: answer.snapshotLevel,
    content: answer.snapshotContent,
    points: answer.snapshotPoints,
    earnedPoints: answer.isCorrect ? answer.snapshotPoints : 0,
    options: toStudentOptions(answer.snapshotOptions),
    selectedOptionId: answer.selectedOptionId,
    correctOptionIds: toCorrectOptionIds(answer.snapshotCorrectOptionIds),
    isCorrect: Boolean(answer.isCorrect),
    explanation: answer.snapshotExplanation,
  };
}

export function serializeAttemptResult(
  attempt: SerializableAttemptRow,
  options: { status: AttemptStatusValue; now: Date },
): AttemptResultDto {
  const questions = sortAnswers(attempt.answers).map(toResultQuestion);

  return {
    id: attempt.id,
    examId: attempt.examId,
    examTitle: attempt.exam.title,
    status: options.status,
    startedAt: attempt.startedAt.toISOString(),
    expiresAt: attempt.expiresAt.toISOString(),
    submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
    serverTime: options.now.toISOString(),
    score: roundScore(attempt.score ?? 0),
    maxScore: roundScore(attempt.maxScore ?? 0),
    correctCount: attempt.correctCount ?? 0,
    incorrectCount: attempt.incorrectCount ?? 0,
    unansweredCount: attempt.unansweredCount ?? 0,
    questions,
  };
}
