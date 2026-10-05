import "server-only";

import { headers } from "next/headers";

import type { UserRole } from "@/generated/prisma/enums";
import { getAuth } from "@/lib/auth/server";
import { AppError } from "@/lib/errors";
import { getOrCreateSessionId } from "@/lib/session";

import type { AuthUserDto } from "@/features/auth/types";

/**
 * Đọc phiên đăng nhập phía server. Mọi quyết định về quyền đều dựa trên dữ liệu
 * đọc từ database qua cookie phiên — client không bao giờ được tin về vai trò.
 */

/** Người dùng hiện tại (nội bộ server, dùng `Date` thay vì chuỗi ISO). */
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

export type SessionState =
  | { status: "anonymous" }
  | { status: "authenticated"; sessionId: string; user: CurrentUser }
  | { status: "locked"; sessionId: string; user: CurrentUser };

/**
 * Chủ sở hữu một lượt làm bài: tài khoản đăng nhập (nếu có) và mã phiên dùng để
 * tạo lượt làm bài. Lượt làm bài của khách ẩn danh cũ vẫn dùng cookie phiên.
 */
export interface AttemptOwner {
  sessionId: string;
  userId: string | null;
}

const USER_ROLES: readonly string[] = ["STUDENT", "TEACHER", "ADMIN"];

/** Chuẩn hoá vai trò nhận từ database; giá trị lạ bị coi là học sinh (quyền thấp nhất). */
export function toUserRole(value: unknown): UserRole {
  return typeof value === "string" && USER_ROLES.includes(value)
    ? (value as UserRole)
    : "STUDENT";
}

export function toAuthUserDto(user: CurrentUser): AuthUserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function readSession(): Promise<SessionState> {
  const session = await getAuth().api.getSession({ headers: await headers() });

  if (!session?.user?.id || !session.session?.id) {
    return { status: "anonymous" };
  }

  const user: CurrentUser = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: toUserRole(session.user.role),
    createdAt: new Date(session.user.createdAt),
  };

  if (session.user.banned === true) {
    return { status: "locked", sessionId: session.session.id, user };
  }

  return { status: "authenticated", sessionId: session.session.id, user };
}

/** Người dùng đang đăng nhập (null nếu là khách hoặc tài khoản bị khoá). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const state = await readSession();
  return state.status === "authenticated" ? state.user : null;
}

/** Bắt buộc đã đăng nhập; ném 401 nếu chưa, 403 nếu tài khoản bị khoá. */
export async function requireUser(): Promise<CurrentUser> {
  const state = await readSession();

  if (state.status === "anonymous") {
    throw new AppError(
      "AUTH_REQUIRED",
      "Bạn cần đăng nhập để thực hiện thao tác này.",
      401,
    );
  }

  if (state.status === "locked") {
    throw new AppError(
      "ACCOUNT_LOCKED",
      "Tài khoản đã bị khoá. Hãy liên hệ quản trị viên.",
      403,
    );
  }

  return state.user;
}

/** Bắt buộc đã đăng nhập và có một trong các vai trò cho phép. */
export async function requireRole(...roles: UserRole[]): Promise<CurrentUser> {
  const user = await requireUser();

  if (!roles.includes(user.role)) {
    throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.", 403);
  }

  return user;
}

/**
 * Xác định chủ sở hữu lượt làm bài cho yêu cầu hiện tại.
 * Người đã đăng nhập làm bài dưới tài khoản của mình; khách ẩn danh dùng cookie phiên.
 */
export async function resolveAttemptOwner(): Promise<AttemptOwner> {
  const state = await readSession();

  if (state.status === "locked") {
    throw new AppError(
      "ACCOUNT_LOCKED",
      "Tài khoản đã bị khoá nên không thể tiếp tục làm bài.",
      403,
    );
  }

  if (state.status === "authenticated") {
    return { sessionId: state.sessionId, userId: state.user.id };
  }

  return { sessionId: await getOrCreateSessionId(), userId: null };
}
