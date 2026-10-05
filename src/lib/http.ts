import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { isAppError } from "@/lib/errors";

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function jsonError(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): NextResponse {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

/**
 * Các mã lỗi cho biết máy chủ PostgreSQL không dùng được (không phải lỗi logic nghiệp vụ).
 * Prisma 7 dùng driver adapter (`@prisma/adapter-pg`) nên khi không kết nối được, lỗi ném ra là
 * `PrismaClientKnownRequestError` mang mã gốc của `pg` (ví dụ `ECONNREFUSED`), chứ không phải `P1001`.
 */
const CONNECTION_ERROR_CODES = new Set([
  // Nhóm lỗi kết nối của driver node-postgres
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  // Mã lỗi Prisma
  "P1000",
  "P1001",
  "P1017",
  // SQLSTATE nhóm 08 — connection exception
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "08P01",
  // Máy chủ đang tắt / từ chối / quá tải, sai mật khẩu, role hoặc database chưa tồn tại
  "57P01",
  "57P02",
  "57P03",
  "53300",
  "28000",
  "28P01",
  "3D000",
]);

function isPrismaConnectionError(error: unknown, depth = 0): boolean {
  if (depth > 4) return false;
  if (typeof error !== "object" || error === null) return false;
  const name = (error as { name?: unknown }).name;
  if (typeof name === "string" && name.startsWith("PrismaClientInitialization")) {
    return true;
  }
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && (CONNECTION_ERROR_CODES.has(code) || code.startsWith("08"))) {
    return true;
  }
  // Driver adapter có thể bọc lỗi gốc của `pg` bên trong `cause`.
  const cause = (error as { cause?: unknown }).cause;
  return cause !== undefined && cause !== error && isPrismaConnectionError(cause, depth + 1);
}

export function handleRouteError(error: unknown): NextResponse {
  if (isAppError(error)) {
    return jsonError(error.code, error.message, error.status, error.details);
  }
  if (error instanceof ZodError) {
    return jsonError("VALIDATION_ERROR", "Dữ liệu gửi lên không hợp lệ.", 422, error.issues);
  }
  if (isPrismaConnectionError(error)) {
    return jsonError(
      "DATABASE_UNAVAILABLE",
      "Không kết nối được cơ sở dữ liệu PostgreSQL. Hãy kiểm tra DATABASE_URL và trạng thái máy chủ.",
      503,
    );
  }
  console.error("[api] Lỗi không mong đợi:", error);
  return jsonError("INTERNAL_ERROR", "Đã xảy ra lỗi hệ thống. Vui lòng thử lại.", 500);
}

/** Bỏ các tham số query rỗng để Zod chỉ nhận giá trị thực sự được gửi lên. */
export function toQueryObject(searchParams: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (value.trim() !== "") {
      result[key] = value;
    }
  }
  return result;
}
