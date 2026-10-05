import "server-only";

import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

import { getServerEnv } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";

import { MIN_PASSWORD_LENGTH } from "@/features/auth/schemas/auth.schemas";

/**
 * Cấu hình Better Auth phía server.
 *
 * Nguyên tắc bảo mật:
 * - Xác thực email/mật khẩu do Better Auth đảm nhiệm (băm scrypt nằm trong bảng Account,
 *   không bao giờ trả ra API).
 * - `role`, `banned`, `banReason`, `bannedAt` được khai báo `input: false` nên client
 *   KHÔNG thể tự gửi lên để tự nâng quyền (chống leo thang đặc quyền).
 * - Giới hạn tần suất lưu trong database (bảng RateLimit) nên đếm chung cho mọi tiến
 *   trình Node, không bị mất khi khởi động lại.
 */

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 ngày
const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 12; // gia hạn tối đa hai lần mỗi ngày

/** baseURL của Better Auth: dùng cho kiểm tra origin và thông tin phiên. */
export function resolveAuthBaseUrl(): string {
  return getServerEnv().BETTER_AUTH_URL ?? "http://localhost:3000";
}

function createAuth() {
  const env = getServerEnv();
  const baseURL = resolveAuthBaseUrl();
  const extraOrigins = (env.AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return betterAuth({
    appName: "Luyện Thi 2027",
    baseURL,
    secret: env.BETTER_AUTH_SECRET,
    /**
     * Chỉ nhận yêu cầu xác thực từ chính ứng dụng. Nhờ vậy một trang khác không thể
     * mượn cookie phiên của người dùng để gọi API xác thực (chống CSRF).
     */
    trustedOrigins: [baseURL, ...extraOrigins],
    database: prismaAdapter(getPrisma(), { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: 128,
      /** Đăng ký xong là đăng nhập luôn. */
      autoSignIn: true,
      /** Chưa có dịch vụ gửi email nên không yêu cầu xác thực email. */
      requireEmailVerification: false,
    },
    session: {
      expiresIn: SESSION_MAX_AGE_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
      /**
       * Không bật cookieCache: mỗi yêu cầu phải đọc lại vai trò và trạng thái khoá
       * trong database, để việc đổi quyền hoặc khoá tài khoản có hiệu lực ngay.
       */
      cookieCache: { enabled: false },
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "STUDENT",
          input: false,
        },
        banned: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
        banReason: { type: "string", required: false, input: false },
        bannedAt: { type: "date", required: false, input: false },
      },
      changeEmail: { enabled: false },
      deleteUser: { enabled: false },
    },
    rateLimit: {
      /** Bật cả ở môi trường phát triển để hành vi giống production. */
      enabled: true,
      window: 60,
      max: 120,
      /** Đếm trong bảng RateLimit (dùng chung cho mọi tiến trình Node). */
      storage: "database",
      modelName: "rateLimit",
      customRules: {
        /** Chống dò mật khẩu: 5 lần đăng nhập mỗi phút cho một địa chỉ IP. */
        "/sign-in/email": { window: 60, max: 5 },
        /** Chống tạo tài khoản hàng loạt: 10 lượt đăng ký mỗi 10 phút. */
        "/sign-up/email": { window: 600, max: 10 },
      },
    },
    advanced: {
      cookiePrefix: "luyenthi",
    },
    databaseHooks: {
      session: {
        create: {
          /**
           * Tài khoản đang bị khoá thì không được tạo phiên mới, kể cả khi mật khẩu đúng.
           * Dùng Prisma trực tiếp để đọc trạng thái khoá mới nhất.
           */
          before: async (session) => {
            const user = await getPrisma().user.findUnique({
              where: { id: session.userId },
              select: { banned: true, banReason: true },
            });

            if (user?.banned) {
              throw APIError.from("FORBIDDEN", {
                message: user.banReason
                  ? `Tài khoản đã bị khoá: ${user.banReason}`
                  : "Tài khoản đã bị khoá. Hãy liên hệ quản trị viên.",
                code: "BANNED_USER",
              });
            }
          },
        },
      },
    },
    /** Phải là plugin cuối cùng để cookie do tiến trình server tạo được ghi vào phản hồi Next.js. */
    plugins: [nextCookies()],
  });
}

let cachedAuth: ReturnType<typeof createAuth> | null = null;

/** Khởi tạo lười: không đọc biến môi trường ở thời điểm import module. */
export function getAuth(): ReturnType<typeof createAuth> {
  if (!cachedAuth) {
    cachedAuth = createAuth();
  }
  return cachedAuth;
}
