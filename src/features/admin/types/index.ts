import type { UserRole } from "@/generated/prisma/enums";

import type { TeacherApplicationDto } from "@/features/teacher-applications/types";

/**
 * DTO cho khu vực quản trị. Mọi trường ở đây đều được lọc an toàn: không có token
 * phiên, băm mật khẩu hay khoá kỹ thuật (`pendingKey`) nào lọt ra ngoài.
 */

export interface AdminUserSummaryDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  banned: boolean;
  banReason: string | null;
  bannedAt: string | null;
  createdAt: string;
  /** Số lượt làm bài (kể cả bài của khách đã gắn vào tài khoản này). */
  attemptCount: number;
  /** Số đơn xin quyền giáo viên đang chờ duyệt. */
  pendingApplicationCount: number;
}

export interface AdminUserListDto {
  items: AdminUserSummaryDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Đơn xin quyền giáo viên kèm hồ sơ người nộp để quản trị viên duyệt. */
export interface AdminTeacherApplicationDto extends TeacherApplicationDto {
  applicant: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
}

export interface AdminTeacherApplicationListDto {
  items: AdminTeacherApplicationDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
