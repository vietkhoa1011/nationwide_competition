import { z } from "zod";

export const MIN_MOTIVATION_LENGTH = 40;
export const MAX_MOTIVATION_LENGTH = 2000;

/**
 * Ô nhập tuỳ chọn: chuỗi rỗng (người dùng bỏ trống) được coi như không gửi lên.
 * Nhờ vậy cùng một schema dùng được cho cả `<form>` (mọi giá trị là chuỗi) và JSON API.
 */
function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const optionalText = (max: number, message: string) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max, message).optional());

export const teacherApplicationBodySchema = z.object({
  school: optionalText(160, "Tên trường tối đa 160 ký tự."),
  subjectId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  experienceYears: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .int("Số năm kinh nghiệm phải là số nguyên.")
      .min(0, "Số năm kinh nghiệm không được âm.")
      .max(60, "Số năm kinh nghiệm tối đa 60.")
      .optional(),
  ),
  contactPhone: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .regex(
        /^[0-9+\s().-]{8,20}$/,
        "Số điện thoại chỉ gồm chữ số và ký tự + ( ) . - (8–20 ký tự).",
      )
      .optional(),
  ),
  motivation: z
    .string()
    .trim()
    .min(MIN_MOTIVATION_LENGTH, `Vui lòng giới thiệu ít nhất ${MIN_MOTIVATION_LENGTH} ký tự.`)
    .max(MAX_MOTIVATION_LENGTH, `Phần giới thiệu tối đa ${MAX_MOTIVATION_LENGTH} ký tự.`),
});

export type TeacherApplicationBody = z.infer<typeof teacherApplicationBodySchema>;
