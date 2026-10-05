import type { TeacherApplicationStatus, UserRole } from "@/generated/prisma/enums";

/**
 * Một đơn xin quyền giáo viên đã được lọc trường an toàn để trả ra ngoài.
 * Không chứa `pendingKey` (khoá kỹ thuật chống nộp trùng) hay thông tin người duyệt.
 */
export interface TeacherApplicationDto {
  id: string;
  status: TeacherApplicationStatus;
  school: string | null;
  subjectId: string | null;
  subjectName: string | null;
  experienceYears: number | null;
  contactPhone: string | null;
  motivation: string;
  /** Ghi chú của quản trị viên khi duyệt/từ chối (lý do từ chối). */
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Trạng thái đơn của người đang đăng nhập. `role` và `canSubmit` do server tính sẵn
 * nên giao diện chỉ hiển thị lại, không tự suy đoán quyền.
 */
export interface MyTeacherApplicationDto {
  application: TeacherApplicationDto | null;
  role: UserRole;
  canSubmit: boolean;
}
