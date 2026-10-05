import type { TeacherApplicationStatus, UserRole } from "@/generated/prisma/enums";
import { AppError } from "@/lib/errors";

import type { AdminTeacherApplicationDto, AdminUserSummaryDto } from "@/features/admin/types";

/**
 * Luật nghiệp vụ thuần của khu vực quản trị (không import Prisma/Next) để kiểm thử
 * bằng Vitest mà không cần database.
 */

export interface AdminActorRef {
  id: string;
  role: UserRole;
}

export interface AdminUserTargetRef {
  id: string;
  name: string;
  role: UserRole;
}

/** Trạng thái khoá hiển thị trên bảng quản trị. */
export const ADMIN_USER_STATUS_LABELS = {
  active: "Đang hoạt động",
  banned: "Đã khoá",
} as const;

/**
 * Chặn hai thao tác nguy hiểm: tự khoá chính mình (có thể khiến hệ thống mất hết
 * quản trị viên) và khoá một quản trị viên khác (tài khoản quản trị chỉ bị đổi vai
 * trò qua script bootstrap, không qua giao diện).
 */
export function assertCanModerateUser(actor: AdminActorRef, target: AdminUserTargetRef): void {
  if (actor.id === target.id) {
    throw new AppError(
      "USER_ACTION_NOT_ALLOWED",
      "Bạn không thể tự khoá tài khoản của chính mình.",
      409,
    );
  }

  if (target.role === "ADMIN") {
    throw new AppError(
      "USER_ACTION_NOT_ALLOWED",
      "Không thể thay đổi trạng thái khoá của tài khoản quản trị viên.",
      409,
    );
  }
}

/** Lý do khoá để trống được lưu là NULL thay vì chuỗi rỗng. */
export function normalizeBanReason(reason: string | undefined): string | null {
  const trimmed = reason?.trim();
  return trimmed ? trimmed : null;
}

/** Ghi chú khi duyệt/từ chối: để trống nghĩa là không có ghi chú. */
export function normalizeReviewNote(note: string | undefined): string | null {
  const trimmed = note?.trim();
  return trimmed ? trimmed : null;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  banned: boolean;
  banReason: string | null;
  bannedAt: Date | null;
  createdAt: Date;
  _count: { attempts: number; teacherApplications: number };
}

export function toAdminUserSummaryDto(row: AdminUserRow): AdminUserSummaryDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    banned: row.banned,
    banReason: row.banReason,
    bannedAt: row.bannedAt ? row.bannedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    attemptCount: row._count.attempts,
    pendingApplicationCount: row._count.teacherApplications,
  };
}

export interface AdminTeacherApplicationRow {
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
  user: { id: string; name: string; email: string; role: UserRole };
}

export function toAdminTeacherApplicationDto(
  row: AdminTeacherApplicationRow,
): AdminTeacherApplicationDto {
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
    applicant: {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      role: row.user.role,
    },
  };
}
