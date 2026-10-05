import { z } from "zod";

import { AppError } from "@/lib/errors";

/**
 * Biến môi trường phía server. Được kiểm tra bằng Zod một cách lười biếng
 * (lazy) để việc `next build` không thất bại khi máy build chưa có DATABASE_URL.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .trim()
    .min(1, "DATABASE_URL chưa được cấu hình. Hãy tạo tệp .env từ .env.example."),
  NODE_ENV: z.enum(["development", "test", "production"]).catch("development"),
  /**
   * Khoá bí mật dùng để ký cookie phiên của Better Auth (tối thiểu 32 ký tự).
   * Sinh khoá mới bằng:
   * `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
   */
  BETTER_AUTH_SECRET: z
    .string()
    .trim()
    .min(
      32,
      "BETTER_AUTH_SECRET phải dài tối thiểu 32 ký tự. Hãy sinh khoá mới và thêm vào tệp .env.",
    ),
  /**
   * Địa chỉ công khai của ứng dụng (dùng làm baseURL của Better Auth và origin
   * mặc định được tin cậy). Để trống thì mặc định là http://localhost:3000.
   */
  BETTER_AUTH_URL: z
    .string()
    .trim()
    .min(1, "BETTER_AUTH_URL không được để trống.")
    .optional(),
  /**
   * Danh sách origin bổ sung (phân tách bằng dấu phẩy) được phép gọi API xác thực.
   * Dùng khi chạy nhiều cổng/cổng kiểm thử, ví dụ http://localhost:3123.
   */
  AUTH_TRUSTED_ORIGINS: z.string().trim().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = serverEnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    AUTH_TRUSTED_ORIGINS: process.env.AUTH_TRUSTED_ORIGINS,
  });

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new AppError(
      "INTERNAL_ERROR",
      `Cấu hình môi trường không hợp lệ (${detail})`,
      500,
    );
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
