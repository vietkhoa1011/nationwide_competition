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

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}
