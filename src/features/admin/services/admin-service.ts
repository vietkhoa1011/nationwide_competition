import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { getPrisma } from "@/lib/prisma";

import type {
  AdminTeacherApplicationListQuery,
  AdminUserListQuery,
} from "@/features/admin/schemas/admin.schemas";
import {
  assertCanModerateUser,
  normalizeBanReason,
  normalizeReviewNote,
  toAdminTeacherApplicationDto,
  toAdminUserSummaryDto,
  type AdminActorRef,
} from "@/features/admin/services/admin-core";
import type {
  AdminTeacherApplicationDto,
  AdminTeacherApplicationListDto,
  AdminUserListDto,
  AdminUserSummaryDto,
} from "@/features/admin/types";
import { assertApplicationPending } from "@/features/teacher-applications/services/teacher-application-core";

/**
 * Truy vấn cho khu vực quản trị. Mọi hàm ở đây chỉ được gọi từ route đã qua
 * `requireRole("ADMIN")`; service không tự kiểm tra lại vai trò người gọi.
 */

/** `_count.teacherApplications` chỉ đếm đơn đang chờ để bảng hiện đúng hàng đợi cần xử lý. */
const adminUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  banned: true,
  banReason: true,
  bannedAt: true,
  createdAt: true,
  _count: {
    select: {
      attempts: true,
      teacherApplications: { where: { status: "PENDING" } },
    },
  },
} as const;

/** Tương đương lựa chọn của tính năng đơn, thêm hồ sơ người nộp. */
const adminApplicationSelect = {
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
  user: { select: { id: true, name: true, email: true, role: true } },
} as const;

function buildUserWhere(query: AdminUserListQuery): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (query.role) {
    where.role = query.role;
  }
  if (query.status === "banned") {
    where.banned = true;
  } else if (query.status === "active") {
    where.banned = false;
  }
  if (query.search) {
    // `mode: "insensitive"` để tìm email không phân biệt hoa/thường.
    const search = query.search;
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
}

function toTotalPages(total: number, pageSize: number): number {
  return Math.ceil(total / pageSize);
}

export async function listAdminUsers(query: AdminUserListQuery): Promise<AdminUserListDto> {
  const prisma = getPrisma();
  const where = buildUserWhere(query);
  const { page, pageSize } = query;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      /** Người mới nhất lên đầu; `id` làm khoá phụ để phân trang luôn ổn định. */
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: adminUserSelect,
    }),
  ]);

  return {
    items: users.map(toAdminUserSummaryDto),
    page,
    pageSize,
    total,
    totalPages: toTotalPages(total, pageSize),
  };
}

/**
 * Khoá hoặc mở khoá một tài khoản. Khi khoá, toàn bộ phiên đang mở của tài khoản đó
 * cũng bị xoá để trình duyệt của họ bị đăng xuất ngay, không phải chờ phiên hết hạn.
 */
export async function setUserBanState(
  actor: AdminActorRef,
  userId: string,
  banned: boolean,
  reason?: string,
): Promise<AdminUserSummaryDto> {
  const prisma = getPrisma();

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true },
  });

  if (!target) {
    throw new AppError("USER_NOT_FOUND", "Không tìm thấy tài khoản cần xử lý.", 404);
  }

  assertCanModerateUser(actor, target);

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: banned
        ? { banned: true, banReason: normalizeBanReason(reason), bannedAt: new Date() }
        : { banned: false, banReason: null, bannedAt: null },
      select: adminUserSelect,
    });

    if (banned) {
      await tx.session.deleteMany({ where: { userId } });
    }

    return user;
  });

  return toAdminUserSummaryDto(updated);
}

export async function listAdminTeacherApplications(
  query: AdminTeacherApplicationListQuery,
): Promise<AdminTeacherApplicationListDto> {
  const prisma = getPrisma();
  const where: Prisma.TeacherApplicationWhereInput = { status: query.status };
  const { page, pageSize } = query;

  const [total, applications] = await Promise.all([
    prisma.teacherApplication.count({ where }),
    prisma.teacherApplication.findMany({
      where,
      /** Đơn cũ nhất lên đầu: hàng đợi duyệt xử lý theo thứ tự gửi. */
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: adminApplicationSelect,
    }),
  ]);

  return {
    items: applications.map(toAdminTeacherApplicationDto),
    page,
    pageSize,
    total,
    totalPages: toTotalPages(total, pageSize),
  };
}

/**
 * Duyệt hoặc từ chối một đơn. Hai việc nằm trong CÙNG một transaction:
 * duyệt đơn thì đồng thời nâng vai trò tài khoản lên TEACHER.
 *
 * `updateMany` kèm điều kiện `status: "PENDING"` đóng vai trò kiểm tra lạc quan:
 * nếu một quản trị viên khác vừa xử lý xong thì `count = 0` và transaction bị huỷ,
 * nhờ vậy không có chuyện hai người cùng ghi đè lên nhau.
 */
export async function reviewTeacherApplication(
  actor: AdminActorRef,
  applicationId: string,
  decision: "APPROVED" | "REJECTED",
  note?: string,
): Promise<AdminTeacherApplicationDto> {
  const prisma = getPrisma();

  const application = await prisma.teacherApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, status: true, userId: true },
  });

  if (!application) {
    throw new AppError("TEACHER_APPLICATION_NOT_FOUND", "Không tìm thấy đơn cần xử lý.", 404);
  }

  assertApplicationPending(application.status);

  const reviewed = await prisma.$transaction(async (tx) => {
    // Nâng vai trò TRƯỚC để bản ghi đọc lại bên dưới đã phản ánh vai trò mới.
    if (decision === "APPROVED") {
      await tx.user.update({
        where: { id: application.userId },
        data: { role: "TEACHER" },
      });
    }

    const changed = await tx.teacherApplication.updateMany({
      where: { id: applicationId, status: "PENDING" },
      data: {
        status: decision,
        reviewNote: normalizeReviewNote(note),
        reviewedById: actor.id,
        reviewedAt: new Date(),
        /** Trả khoá UNIQUE về NULL để người bị từ chối có thể nộp đơn mới. */
        pendingKey: null,
      },
    });

    if (changed.count === 0) {
      throw new AppError(
        "TEACHER_APPLICATION_ALREADY_REVIEWED",
        "Đơn này đã được xử lý trước đó. Hãy tải lại danh sách để xem trạng thái mới nhất.",
        409,
      );
    }

    return tx.teacherApplication.findUniqueOrThrow({
      where: { id: applicationId },
      select: adminApplicationSelect,
    });
  });

  return toAdminTeacherApplicationDto(reviewed);
}
