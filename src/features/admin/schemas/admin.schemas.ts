import { z } from "zod";

export const DEFAULT_ADMIN_PAGE_SIZE = 20;
export const MAX_ADMIN_PAGE_SIZE = 100;

const pageField = z.coerce.number().int().min(1).max(10_000).catch(1);
const pageSizeField = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_ADMIN_PAGE_SIZE)
  .catch(DEFAULT_ADMIN_PAGE_SIZE);

/**
 * Tham số tuỳ chọn của biểu mẫu: chuỗi rỗng (người dùng bỏ trống) coi như không gửi lên.
 */
function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

/**
 * Bộ lọc danh sách người dùng. Dùng `.catch()` để một tham số sai trên URL
 * (ví dụ `?role=SUPERADMIN`) chỉ bị bỏ qua thay vì làm hỏng cả trang.
 */
export const adminUserListQuerySchema = z.object({
  search: z.string().trim().max(120).catch(""),
  role: z.enum(["STUDENT", "TEACHER", "ADMIN"]).optional().catch(undefined),
  status: z.enum(["active", "banned"]).optional().catch(undefined),
  page: pageField,
  pageSize: pageSizeField,
});

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;

export const adminUserIdParamSchema = z.object({
  userId: z.string().trim().min(1, "Thiếu mã người dùng."),
});

export const adminBanUserBodySchema = z.object({
  reason: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(300, "Lý do khoá tối đa 300 ký tự.").optional(),
  ),
});

export type AdminBanUserBody = z.infer<typeof adminBanUserBodySchema>;

export const ADMIN_APPLICATION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

/** Mặc định chỉ xem đơn đang chờ vì đó là hàng đợi cần xử lý. */
export const adminTeacherApplicationListQuerySchema = z.object({
  status: z.enum(ADMIN_APPLICATION_STATUSES).catch("PENDING"),
  page: pageField,
  pageSize: pageSizeField,
});

export type AdminTeacherApplicationListQuery = z.infer<
  typeof adminTeacherApplicationListQuerySchema
>;

export const adminTeacherApplicationIdParamSchema = z.object({
  applicationId: z.string().trim().min(1, "Thiếu mã đơn."),
});

export const adminReviewTeacherApplicationBodySchema = z.object({
  note: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(500, "Ghi chú tối đa 500 ký tự.").optional(),
  ),
});

export type AdminReviewTeacherApplicationBody = z.infer<
  typeof adminReviewTeacherApplicationBodySchema
>;
