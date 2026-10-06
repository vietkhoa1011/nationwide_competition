import { z } from "zod";

export const classroomMemberRoleSchema = z.enum(["STUDENT", "TEACHER"]);

export const classroomIdParamSchema = z.object({
  classroomId: z.string().trim().min(1, "Thiếu mã lớp học."),
});

export const classroomMemberParamSchema = z.object({
  classroomId: z.string().trim().min(1, "Thiếu mã lớp học."),
  memberId: z.string().trim().min(1, "Thiếu mã thành viên."),
});

export const assignmentIdParamSchema = z.object({
  assignmentId: z.string().trim().min(1, "Thiếu mã lần giao đề."),
});

export const classroomCreateBodySchema = z.object({
  name: z.string().trim().min(2, "Tên lớp cần ít nhất 2 ký tự.").max(120),
  description: z.string().trim().max(1_000).nullable().optional(),
  subjectId: z.string().trim().min(1).max(64).nullable().optional(),
  gradeLevel: z.number().int().min(1).max(12).nullable().optional(),
});

export const classroomUpdateBodySchema = classroomCreateBodySchema.partial();

export const classroomMemberBodySchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập email.")
    .max(180, "Email tối đa 180 ký tự.")
    .pipe(z.email("Email không hợp lệ.")),
  role: classroomMemberRoleSchema.default("STUDENT"),
});

export const classroomListQuerySchema = z.object({
  /** `all=1` chỉ có tác dụng với quản trị viên: xem mọi lớp trong hệ thống. */
  all: z.enum(["0", "1"]).optional(),
  search: z.string().trim().max(120).optional(),
});

/**
 * Mốc thời gian do client gửi lên (chuỗi ISO hoặc giá trị của `datetime-local`).
 * Việc phân tích thành `Date` nằm ở `parseOptionalDateInput` (thuần, kiểm thử được).
 */
export const dateTimeInputSchema = z.string().trim().min(1).max(40).nullable().optional();

export const assignmentCreateBodySchema = z.object({
  examId: z.string().trim().min(1, "Hãy chọn đề thi để giao.").max(64),
  title: z.string().trim().max(200).nullable().optional(),
  opensAt: dateTimeInputSchema,
  closesAt: dateTimeInputSchema,
  durationMinutes: z.number().int().min(1).max(600).nullable().optional(),
  allowedAttempts: z.number().int().min(1).max(20).nullable().optional(),
  revealAnswersAt: dateTimeInputSchema,
});

export const assignmentUpdateBodySchema = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  opensAt: dateTimeInputSchema,
  closesAt: dateTimeInputSchema,
  durationMinutes: z.number().int().min(1).max(600).nullable().optional(),
  allowedAttempts: z.number().int().min(1).max(20).nullable().optional(),
  revealAnswersAt: dateTimeInputSchema,
});

export const mediaUploadFieldsSchema = z.object({
  examId: z.string().trim().min(1).max(64).optional(),
  classroomId: z.string().trim().min(1).max(64).optional(),
  alt: z.string().trim().max(200).optional(),
});

export type ClassroomCreateBody = z.infer<typeof classroomCreateBodySchema>;
export type ClassroomUpdateBody = z.infer<typeof classroomUpdateBodySchema>;
export type ClassroomMemberBody = z.infer<typeof classroomMemberBodySchema>;
export type AssignmentCreateBody = z.infer<typeof assignmentCreateBodySchema>;
export type AssignmentUpdateBody = z.infer<typeof assignmentUpdateBodySchema>;
export type MediaUploadFields = z.infer<typeof mediaUploadFieldsSchema>;
