import "server-only";

import type { ExamActor } from "@/features/authoring/services/exam-authoring-core";
import type { ClassroomActor } from "@/features/classroom/services/classroom-core";
import { requireRole, requireUser } from "@/lib/auth/session";

/**
 * Cầu nối giữa tầng xác thực (`@/lib/auth/session`) và tầng nghiệp vụ thuần: các route
 * soạn đề gọi hai hàm dưới đây để lấy "người đang thao tác" với vai trò đọc từ database.
 *
 * Nhờ vậy mọi service đều nhận cùng một cấu trúc actor, và không route nào phải tự diễn
 * giải `role` do client gửi lên.
 */

/** Giáo viên hoặc quản trị viên mới vào được khu vực soạn đề. */
export async function requireAuthoringActor(): Promise<ExamActor> {
  const user = await requireRole("TEACHER", "ADMIN");
  return { id: user.id, role: user.role };
}

/** Khu vực lớp học: học sinh cũng xem được lớp của mình nên chỉ cần đăng nhập. */
export async function requireClassroomActor(): Promise<ClassroomActor> {
  const user = await requireUser();
  return { id: user.id, role: user.role };
}
