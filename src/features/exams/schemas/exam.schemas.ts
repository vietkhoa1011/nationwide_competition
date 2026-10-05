import { z } from "zod";

export const DEFAULT_PAGE_SIZE = 9;
export const MAX_PAGE_SIZE = 48;

export const examListQuerySchema = z.object({
  search: z.string().trim().max(120, "Từ khoá tìm kiếm quá dài.").optional(),
  subjectId: z.string().trim().min(1).max(64).optional(),
  featured: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
});

export type ExamListQuery = z.infer<typeof examListQuerySchema>;

export const examIdParamSchema = z.object({
  examId: z.string().trim().min(1, "Thiếu mã đề thi."),
});
