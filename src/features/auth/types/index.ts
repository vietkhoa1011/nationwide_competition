import type { UserRole } from "@/generated/prisma/enums";

/** Người dùng đã đăng nhập, đã lược bỏ mọi trường nhạy cảm (mật khẩu, token, phiên). */
export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

/** Trạng thái phiên trả về cho client. `user = null` nghĩa là khách ẩn danh. */
export interface AuthSessionDto {
  user: AuthUserDto | null;
}

/** Kết quả đăng ký/đăng nhập: chỉ trả về hồ sơ người dùng, không trả token phiên. */
export interface AuthResultDto {
  user: AuthUserDto;
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  STUDENT: "Học sinh",
  TEACHER: "Giáo viên",
  ADMIN: "Quản trị viên",
};
