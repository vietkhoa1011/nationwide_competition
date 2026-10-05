import { z, type ZodError } from "zod";

/** Độ dài mật khẩu tối thiểu — phải khớp `MIN_PASSWORD_LENGTH` trong `@/lib/auth/server`. */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Vui lòng nhập email.")
  .max(180, "Email tối đa 180 ký tự.")
  .pipe(z.email("Email không hợp lệ."));

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Họ tên phải có ít nhất 2 ký tự.")
  .max(80, "Họ tên tối đa 80 ký tự.");

export const registerBodySchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`)
    .max(MAX_PASSWORD_LENGTH, `Mật khẩu tối đa ${MAX_PASSWORD_LENGTH} ký tự.`),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;

/**
 * Lược đồ riêng cho biểu mẫu đăng ký ở trình duyệt: thêm ô nhập lại mật khẩu và kiểm tra
 * khớp nhau trước khi gọi API, để người dùng thấy lỗi ngay mà không tốn một vòng mạng.
 */
export const registerFormSchema = registerBodySchema
  .extend({
    confirmPassword: z.string().min(1, "Vui lòng nhập lại mật khẩu."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu nhập lại không khớp.",
  });

export type RegisterFormValues = z.infer<typeof registerFormSchema>;

/**
 * Gom lỗi của Zod thành map `tên trường → thông báo` để hiển thị ngay dưới ô nhập.
 * Lỗi không thuộc trường nào (ví dụ do `refine` trên cả đối tượng) được gán khoá `""`.
 */
export function collectFieldErrors(error: ZodError): Record<string, string> {
  const result: Record<string, string> = {};

  for (const issue of error.issues) {
    const [key] = issue.path;
    const field = typeof key === "string" ? key : "";

    if (!(field in result)) {
      result[field] = issue.message;
    }
  }

  return result;
}

/**
 * Đăng nhập cố tình chỉ kiểm tra "có nhập hay chưa": không áp quy tắc độ mạnh mật khẩu
 * để tránh tiết lộ thông tin về mật khẩu đã lưu.
 */
export const loginBodySchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Vui lòng nhập email."),
  password: z.string().min(1, "Vui lòng nhập mật khẩu."),
});

export type LoginBody = z.infer<typeof loginBodySchema>;

/**
 * Hồ sơ người dùng do Better Auth trả về. Chỉ khai báo các trường cần dùng nên
 * token phiên hay băm mật khẩu không thể lọt ra DTO.
 */
export const authUserPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string(),
  role: z.string().nullish(),
  banned: z.boolean().nullish(),
  createdAt: z.union([z.string(), z.date()]).nullish(),
});

export type AuthUserPayload = z.infer<typeof authUserPayloadSchema>;
