import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { AppError } from "@/lib/errors";

/**
 * Phiên luyện thi ẩn danh: mỗi người truy cập có một mã phiên ngẫu nhiên 256-bit
 * được lưu trong cookie httpOnly. Không có tài khoản dùng chung.
 */
export const SESSION_COOKIE_NAME = "luyenthi_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export function createSessionId(): string {
  return randomBytes(32).toString("hex");
}

export async function readSessionId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE_NAME)?.value;
  return value && value.length >= 32 ? value : null;
}

export async function requireSessionId(): Promise<string> {
  const sessionId = await readSessionId();
  if (!sessionId) {
    throw new AppError(
      "SESSION_MISSING",
      "Không tìm thấy phiên làm bài. Hãy bắt đầu lại từ danh sách đề thi.",
      401,
    );
  }
  return sessionId;
}

/**
 * Đọc phiên hiện có, nếu chưa có thì tạo mới và ghi cookie.
 * Chỉ gọi được trong Route Handler / Server Action.
 */
export async function getOrCreateSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(SESSION_COOKIE_NAME)?.value;
  if (existing && existing.length >= 32) {
    return existing;
  }

  const sessionId = createSessionId();
  store.set({
    name: SESSION_COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return sessionId;
}
