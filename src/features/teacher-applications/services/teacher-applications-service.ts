import "server-only";

import type { CurrentUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { getPrisma } from "@/lib/prisma";

import type { TeacherApplicationBody } from "@/features/teacher-applications/schemas/teacher-application.schemas";
import {
  assertCanSubmitTeacherApplication,
  assertNoPendingApplication,
  canSubmitTeacherApplication,
  isUniqueConstraintError,
  toTeacherApplicationDto,
} from "@/features/teacher-applications/services/teacher-application-core";
import type {
  MyTeacherApplicationDto,
  TeacherApplicationDto,
} from "@/features/teacher-applications/types";

/** Các trường trả ra ngoài — cố ý không lấy `pendingKey` hay người duyệt. */
const teacherApplicationSelect = {
  id: true,
  status: true,
  school: true,
  subjectId: true,
  experienceYears: true,
  contactPhone: true,
  motivation: true,
  reviewNote: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  subject: { select: { name: true } },
} as const;

/** Đơn mới nhất của một người, lọc theo trạng thái nếu cần. */
async function findLatestApplication(
  where: { userId: string; status?: "PENDING" },
): Promise<TeacherApplicationDto | null> {
  const prisma = getPrisma();
  const application = await prisma.teacherApplication.findFirst({
    where,
    orderBy: { createdAt: "desc" },
    select: teacherApplicationSelect,
  });

  return application ? toTeacherApplicationDto(application) : null;
}

/**
 * Trạng thái đơn của người đang đăng nhập: ưu tiên đơn đang chờ duyệt, nếu không có
 * thì lấy đơn mới nhất đã xử lý để người dùng còn thấy lý do bị từ chối.
 */
export async function getMyTeacherApplicationState(
  user: CurrentUser,
): Promise<MyTeacherApplicationDto> {
  const pending = await findLatestApplication({ userId: user.id, status: "PENDING" });
  const application = pending ?? (await findLatestApplication({ userId: user.id }));

  return {
    application,
    role: user.role,
    canSubmit: canSubmitTeacherApplication(user.role) && application?.status !== "PENDING",
  };
}

export async function submitTeacherApplication(
  user: CurrentUser,
  input: TeacherApplicationBody,
): Promise<TeacherApplicationDto> {
  assertCanSubmitTeacherApplication(user.role);

  const prisma = getPrisma();
  const pending = await prisma.teacherApplication.findFirst({
    where: { userId: user.id, status: "PENDING" },
    select: { id: true },
  });
  assertNoPendingApplication(pending !== null);

  /** Chọn môn học không tồn tại sẽ bị khoá ngoại từ chối bằng lỗi thô, nên kiểm tra trước. */
  if (input.subjectId) {
    const subject = await prisma.subject.findUnique({
      where: { id: input.subjectId },
      select: { id: true },
    });
    if (!subject) {
      throw new AppError("VALIDATION_ERROR", "Môn học đã chọn không tồn tại.", 422);
    }
  }

  try {
    const created = await prisma.teacherApplication.create({
      data: {
        userId: user.id,
        /** Khi đơn còn PENDING, `pendingKey` = userId để UNIQUE chặn việc nộp trùng. */
        pendingKey: user.id,
        school: input.school ?? null,
        subjectId: input.subjectId ?? null,
        experienceYears: input.experienceYears ?? null,
        contactPhone: input.contactPhone ?? null,
        motivation: input.motivation,
      },
      select: teacherApplicationSelect,
    });

    return toTeacherApplicationDto(created);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(
        "TEACHER_APPLICATION_EXISTS",
        "Bạn đã có một đơn đang chờ duyệt. Vui lòng chờ quản trị viên xử lý.",
        409,
      );
    }
    throw error;
  }
}
