import "server-only";

import { getAuth } from "@/lib/auth/server";
import { toUserRole } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";

import {
  authUserPayloadSchema,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  type LoginBody,
  type RegisterBody,
} from "@/features/auth/schemas/auth.schemas";
import type { AuthResultDto, AuthUserDto } from "@/features/auth/types";

/**
 * Nghiệp vụ xác thực: gọi endpoint của Better Auth **ngay trong tiến trình server**
 * rồi chỉ trả về DTO đã lọc trường.
 *
 * Vì sao không để trình duyệt gọi thẳng endpoint Better Auth?
 * - Endpoint gốc trả cả `token` phiên trong thân phản hồi; đi qua lớp này thì client
 *   chỉ nhận hồ sơ người dùng, token chỉ nằm trong cookie httpOnly.
 * - Việc kiểm tra dữ liệu vào (Zod) và thông báo lỗi tiếng Việt được thống nhất một chỗ.
 * Yêu cầu vẫn đi qua router HTTP của Better Auth nên giới hạn tần suất và kiểm tra
 * origin vẫn có hiệu lực.
 */

const AUTH_PATH_PREFIX = "/api/auth";

export interface AuthProxyResult {
  body: AuthResultDto;
  /** Cookie do Better Auth sinh ra (session token) cần gắn vào phản hồi. */
  setCookies: string[];
}

/** `Headers.getSetCookie()` có thể không tồn tại ở một số runtime; có đường lui an toàn. */
function collectSetCookies(headers: Headers): string[] {
  const getSetCookie = (headers as { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === "function") {
    return getSetCookie.call(headers);
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function extractUser(payload: unknown): AuthUserDto {
  const rawUser = (payload as { user?: unknown } | null)?.user;
  const parsed = authUserPayloadSchema.safeParse(rawUser);

  if (!parsed.success) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Không đọc được thông tin người dùng từ máy chủ xác thực.",
      500,
    );
  }

  return {
    id: parsed.data.id,
    name: parsed.data.name,
    email: parsed.data.email,
    role: toUserRole(parsed.data.role),
    createdAt: new Date(parsed.data.createdAt ?? Date.now()).toISOString(),
  };
}

/** Chuyển lỗi của Better Auth thành lỗi nghiệp vụ tiếng Việt, không lộ chi tiết nội bộ. */
function toAuthAppError(payload: unknown, status: number): AppError {
  const body = (payload ?? {}) as { code?: unknown; message?: unknown };
  const code = typeof body.code === "string" ? body.code : "";

  switch (code) {
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
    case "USER_ALREADY_EXISTS":
      return new AppError(
        "EMAIL_ALREADY_USED",
        "Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.",
        409,
      );
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_EMAIL":
    case "INVALID_PASSWORD":
    case "CREDENTIAL_ACCOUNT_NOT_FOUND":
    case "USER_NOT_FOUND":
      return new AppError("INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.", 401);
    case "BANNED_USER":
      return new AppError(
        "ACCOUNT_LOCKED",
        typeof body.message === "string" && body.message.trim().length > 0
          ? body.message
          : "Tài khoản đã bị khoá. Hãy liên hệ quản trị viên.",
        403,
      );
    case "PASSWORD_TOO_SHORT":
      return new AppError(
        "VALIDATION_ERROR",
        `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`,
        422,
      );
    case "PASSWORD_TOO_LONG":
      return new AppError(
        "VALIDATION_ERROR",
        `Mật khẩu tối đa ${MAX_PASSWORD_LENGTH} ký tự.`,
        422,
      );
    default:
      break;
  }

  if (status === 429) {
    return new AppError(
      "RATE_LIMITED",
      "Bạn đã thử quá nhiều lần. Vui lòng chờ một lát rồi thử lại.",
      429,
    );
  }
  if (status === 401) {
    return new AppError("INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.", 401);
  }
  if (status === 403) {
    return new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.", 403);
  }
  if (status === 400 || status === 422) {
    return new AppError("VALIDATION_ERROR", "Thông tin gửi lên không hợp lệ.", 422);
  }
  return new AppError(
    "INTERNAL_ERROR",
    "Không thể xử lý yêu cầu xác thực. Vui lòng thử lại.",
    500,
  );
}

async function callAuthEndpoint(
  request: Request,
  path: string,
  payload: unknown,
): Promise<{ headers: Headers; payload: unknown }> {
  const target = new URL(request.url);
  target.pathname = `${AUTH_PATH_PREFIX}${path}`;
  target.search = "";

  const authHeaders = new Headers(request.headers);
  authHeaders.set("content-type", "application/json");
  /** Better Auth chặn yêu cầu không cùng origin, nên phải giữ origin của trình duyệt. */
  if (!authHeaders.has("origin")) {
    authHeaders.set("origin", target.origin);
  }

  const authResponse = await getAuth().handler(
    new Request(target, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(payload),
    }),
  );

  const responsePayload = await authResponse.json().catch(() => null);

  if (!authResponse.ok) {
    throw toAuthAppError(responsePayload, authResponse.status);
  }

  return { headers: authResponse.headers, payload: responsePayload };
}

/** Đăng ký tài khoản học sinh (vai trò do server quyết định, client không gửi lên được). */
export async function registerUser(
  request: Request,
  input: RegisterBody,
): Promise<AuthProxyResult> {
  const { headers: responseHeaders, payload } = await callAuthEndpoint(
    request,
    "/sign-up/email",
    {
      name: input.name,
      email: input.email,
      password: input.password,
    },
  );

  return {
    body: { user: extractUser(payload) },
    setCookies: collectSetCookies(responseHeaders),
  };
}

export async function loginUser(
  request: Request,
  input: LoginBody,
): Promise<AuthProxyResult> {
  const { headers: responseHeaders, payload } = await callAuthEndpoint(
    request,
    "/sign-in/email",
    {
      email: input.email,
      password: input.password,
    },
  );

  return {
    body: { user: extractUser(payload) },
    setCookies: collectSetCookies(responseHeaders),
  };
}

/** Đăng xuất. Idempotent: gọi khi chưa đăng nhập vẫn thành công và cookie vẫn được xoá. */
export async function logoutUser(request: Request): Promise<{ setCookies: string[] }> {
  const { headers: responseHeaders } = await callAuthEndpoint(request, "/sign-out", {});
  return { setCookies: collectSetCookies(responseHeaders) };
}

