import type { TeacherApplicationStatus, UserRole } from "@/generated/prisma/enums";
import { AppError } from "@/lib/errors";

import type { TeacherApplicationDto } from "@/features/teacher-applications/types";

/**
 * Luật nghiệp vụ thuần của đơn xin quyền giáo viên: không import Prisma/Next nên có
 * thể kiểm thử bằng Vitest mà không cần database (giống `attempt-core.ts`).
 */

export const TEACHER_APPLICATION_STATUS_LABELS: Record<TeacherApplicationStatus, string> = {
  PENDING: "Đang chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Bị từ chối",
};

/** Chỉ học sinh mới cần xin quyền giáo viên; giáo viên/quản trị viên đã có quyền cao hơn. */
export function canSubmitTeacherApplication(role: UserRole): boolean {
  return role === "STUDENT";
}

export function assertCanSubmitTeacherApplication(role: UserRole): void {
  if (!canSubmitTeacherApplication(role)) {
    throw new AppError(
      "FORBIDDEN",
      "Tài khoản đã là giáo viên hoặc quản trị viên nên không cần nộp đơn.",
      403,
    );
  }
}

/** Mỗi người chỉ được có một đơn đang chờ duyệt (ràng buộc bổ sung bằng UNIQUE `pendingKey`). */
export function assertNoPendingApplication(hasPendingApplication: boolean): void {
  if (hasPendingApplication) {
    throw new AppError(
      "TEACHER_APPLICATION_EXISTS",
      "Bạn đã có một đơn đang chờ duyệt. Vui lòng chờ quản trị viên xử lý.",
      409,
    );
  }
}

/** Đơn đã được duyệt/từ chối thì không xử lý lại (chống hai quản trị viên bấm cùng lúc). */
export function assertApplicationPending(status: TeacherApplicationStatus): void {
  if (status !== "PENDING") {
    throw new AppError(
      "TEACHER_APPLICATION_ALREADY_REVIEWED",
      "Đơn này đã được xử lý trước đó. Hãy tải lại danh sách để xem trạng thái mới nhất.",
      409,
    );
  }
}

/**
 * Prisma mã hoá lỗi vi phạm ràng buộc duy nhất bằng `P2002`. Hai yêu cầu nộp đơn
 * song song của cùng một người sẽ va vào `pendingKey` và cái đến sau nhận lỗi này.
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** Bản ghi đã chọn từ database (kèm tên môn học) để chuyển thành DTO. */
export interface TeacherApplicationRow {
  id: string;
  status: TeacherApplicationStatus;
  school: string | null;
  subjectId: string | null;
  subject: { name: string } | null;
  experienceYears: number | null;
  contactPhone: string | null;
  motivation: string;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toTeacherApplicationDto(row: TeacherApplicationRow): TeacherApplicationDto {
  return {
    id: row.id,
    status: row.status,
    school: row.school,
    subjectId: row.subjectId,
    subjectName: row.subject?.name ?? null,
    experienceYears: row.experienceYears,
    contactPhone: row.contactPhone,
    motivation: row.motivation,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
