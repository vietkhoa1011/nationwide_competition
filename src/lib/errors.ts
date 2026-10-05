/**
 * Lỗi nghiệp vụ dùng chung cho cả phía server (API routes, services) và phía
 * domain thuần (attempt-core). Không import bất cứ thứ gì của Next.js để có
 * thể chạy trong môi trường test thuần Node.
 */
export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "EXAM_NOT_FOUND"
  | "ATTEMPT_NOT_FOUND"
  | "ATTEMPT_EXPIRED"
  | "ATTEMPT_SUBMITTED"
  | "ATTEMPT_LOCKED"
  | "RESULT_NOT_READY"
  | "SESSION_MISSING"
  | "QUESTION_NOT_IN_ATTEMPT"
  | "OPTION_NOT_IN_QUESTION"
  | "DATABASE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: AppErrorCode,
    message: string,
    status = 400,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
