import type { UserRoleValue } from "@/features/authoring/types";
import { AppError } from "@/lib/errors";

/**
 * Luật nghiệp vụ thuần của lớp học và việc giao đề: cửa sổ làm bài, số lượt được phép,
 * thời lượng ghi đè và quyền truy cập lớp. Không import Prisma/Next.js.
 */

export type AssignmentWindow = "NOT_OPEN" | "OPEN" | "CLOSED";

export interface AssignmentWindowInput {
  opensAt: Date | null;
  closesAt: Date | null;
}

export interface ClassroomActor {
  id: string;
  role: UserRoleValue;
}

/** Cửa sổ làm bài do máy chủ quyết định: chưa mở, đang mở, hoặc đã đóng. */
export function resolveAssignmentWindow(
  assignment: AssignmentWindowInput | null,
  now: Date,
): AssignmentWindow {
  if (!assignment) {
    return "OPEN";
  }
  if (assignment.opensAt && now.getTime() < assignment.opensAt.getTime()) {
    return "NOT_OPEN";
  }
  if (assignment.closesAt && now.getTime() > assignment.closesAt.getTime()) {
    return "CLOSED";
  }
  return "OPEN";
}

/** Thời lượng làm bài: ưu tiên thời lượng của lần giao đề, nếu không có thì dùng của đề. */
export function effectiveDurationMinutes(baseDurationMinutes: number, assignment: AssignmentWindowInput & { durationMinutes?: number | null } | null): number {
  const override = assignment?.durationMinutes;
  if (typeof override === "number" && Number.isFinite(override) && override > 0) {
    return Math.round(override);
  }
  return baseDurationMinutes;
}

export interface StudentStartContext {
  scope: "PUBLIC" | "CLASS";
  /** Học sinh có phải thành viên của lớp sở hữu đề (hoặc giáo viên/quản trị của lớp). */
  isClassMember: boolean;
  assignment: (AssignmentWindowInput & { allowedAttempts?: number | null }) | null;
  attemptsUsed: number;
  now: Date;
}

/**
 * Điều kiện để một học sinh bắt đầu làm đề:
 * - lớp: phải là thành viên của lớp sở hữu đề, phải có lần giao đề và cửa sổ phải đang mở;
 * - số lượt đã làm không được vượt giới hạn của lần giao đề.
 * Toàn bộ kiểm tra nằm ở máy chủ; giao diện chỉ hiển thị lại kết quả.
 */
export function assertStudentMayStartExam(context: StudentStartContext): void {
  if (context.scope === "CLASS") {
    if (!context.isClassMember) {
      throw new AppError(
        "FORBIDDEN",
        "Bạn không phải thành viên của lớp sở hữu đề thi này.",
        403,
      );
    }
    if (!context.assignment) {
      throw new AppError(
        "ASSIGNMENT_NOT_FOUND",
        "Đề thi này chưa được giáo viên giao cho lớp.",
        404,
      );
    }
    const window = resolveAssignmentWindow(context.assignment, context.now);
    if (window === "NOT_OPEN") {
      throw new AppError("ASSIGNMENT_NOT_OPEN", "Đề thi chưa mở. Hãy quay lại khi đến giờ làm bài.", 409);
    }
    if (window === "CLOSED") {
      throw new AppError("ASSIGNMENT_CLOSED", "Đã hết thời gian làm bài của đề này.", 409);
    }
  }

  const allowed = context.assignment?.allowedAttempts ?? null;
  if (typeof allowed === "number" && context.attemptsUsed >= allowed) {
    throw new AppError(
      "ATTEMPTS_EXHAUSTED",
      `Bạn đã dùng hết ${allowed} lượt làm bài cho đề này.`,
      409,
    );
  }
}

export function canViewClassroom(
  actor: ClassroomActor,
  view: { ownerId: string; memberUserIds: readonly string[] },
): boolean {
  if (actor.role === "ADMIN") {
    return true;
  }
  return view.ownerId === actor.id || view.memberUserIds.includes(actor.id);
}

/**
 * Quản trị viên hoặc giáo viên phụ trách lớp (chủ lớp) mới được đổi thông tin lớp và
 * thêm/xoá thành viên. Giáo viên cùng dạy lớp (role TEACHER) chỉ xem được dữ liệu.
 */
export function assertCanManageClassroom(actor: ClassroomActor, ownerId: string): void {
  if (actor.role === "ADMIN" || actor.id === ownerId) {
    return;
  }
  throw new AppError(
    "FORBIDDEN",
    "Chỉ giáo viên phụ trách lớp hoặc quản trị viên mới được quản lý lớp này.",
    403,
  );
}

/** Chỉ chủ lớp hoặc quản trị viên được tạo/giao đề cho lớp. */
export function assertCanAuthorForClassroom(actor: ClassroomActor, ownerId: string): void {
  assertCanManageClassroom(actor, ownerId);
}

/**
 * Học sinh xem được đáp án/lời giải khi bài đã được chốt. Nếu lần giao đề có mốc
 * `revealAnswersAt` trong tương lai thì máy chủ ẩn đáp án khỏi payload trả về.
 */
export function canRevealAnswers(
  assignment: { revealAnswersAt: Date | null } | null,
  options: { now: Date; submitted: boolean },
): boolean {
  if (!options.submitted) {
    return false;
  }
  if (!assignment?.revealAnswersAt) {
    return true;
  }
  return options.now.getTime() >= assignment.revealAnswersAt.getTime();
}

/** Phân tích mốc thời gian do client gửi lên thành `Date` (hoặc null khi bỏ trống). */
export function parseOptionalDateInput(value: string | null | undefined, label: string): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError("VALIDATION_ERROR", `${label} không phải mốc thời gian hợp lệ.`, 422);
  }
  return parsed;
}

/** Mốc đóng phải sau mốc mở (nếu cả hai đều được khai báo). */
export function assertAssignmentWindowOrder(opensAt: Date | null, closesAt: Date | null): void {
  if (opensAt && closesAt && closesAt.getTime() <= opensAt.getTime()) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Thời điểm đóng đề phải sau thời điểm mở đề.",
      422,
    );
  }
}
