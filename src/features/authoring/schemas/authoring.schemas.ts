import { z } from "zod";

import {
  MAX_BLOCKS,
  RICH_DOC_SCHEMA_VERSION,
} from "@/features/authoring/services/rich-content-core";
import {
  MAX_EXAM_DURATION_MINUTES,
  MAX_OPTIONS_PER_QUESTION,
  MAX_POINTS_PER_QUESTION,
  MAX_QUESTIONS_PER_EXAM,
  MIN_EXAM_DURATION_MINUTES,
  MIN_OPTIONS_PER_QUESTION,
} from "@/features/authoring/services/exam-authoring-core";

/**
 * Schema Zod cho các endpoint soạn đề. Những schema này chỉ kiểm tra HÌNH DẠNG và
 * giới hạn đầu vào; luật nghiệp vụ (quyền, phạm vi, điều kiện xuất bản) nằm ở
 * `exam-authoring-core.ts` và `authoring-service.ts`.
 */

export const questionTypeSchema = z.enum(["SINGLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"]);
export const questionLevelSchema = z.enum(["EASY", "MEDIUM", "HARD"]);
export const examScopeSchema = z.enum(["PUBLIC", "CLASS"]);
export const examStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

/** RichDoc nhận từ client: đã có `doc.content` dạng mảng; máy chủ chuẩn hoá lại từng nút. */
export const richDocInputSchema = z.object({
  schemaVersion: z.number().int().min(1).max(RICH_DOC_SCHEMA_VERSION).optional(),
  doc: z
    .object({
      type: z.literal("doc"),
      content: z.array(z.unknown()).max(MAX_BLOCKS),
    })
    .passthrough(),
});

export const richDocOrNullSchema = richDocInputSchema.nullable();

export const optionInputSchema = z.object({
  /** Có ID nghĩa là phương án đã tồn tại; thiếu ID nghĩa là phương án mới. */
  id: z.string().trim().min(1).max(64).optional(),
  contentDoc: richDocInputSchema,
  isCorrect: z.boolean().default(false),
});

export type OptionInput = z.infer<typeof optionInputSchema>;

export const questionInputSchema = z.object({
  type: questionTypeSchema.default("SINGLE_CHOICE"),
  level: questionLevelSchema.default("MEDIUM"),
  points: z.number().positive().max(MAX_POINTS_PER_QUESTION),
  contentDoc: richDocInputSchema,
  explanationDoc: richDocOrNullSchema.optional(),
  /** Quy tắc chấm điểm riêng của loại câu (chỉ dùng cho loại chưa hỗ trợ). */
  rule: z.unknown().optional(),
  options: z
    .array(optionInputSchema)
    .min(MIN_OPTIONS_PER_QUESTION)
    .max(MAX_OPTIONS_PER_QUESTION),
});

export type QuestionInput = z.infer<typeof questionInputSchema>;

export const createExamBodySchema = z.object({
  title: z.string().trim().min(3, "Tên đề thi cần ít nhất 3 ký tự.").max(200),
  subjectId: z.string().trim().min(1, "Hãy chọn môn học.").max(64),
  scope: examScopeSchema.default("PUBLIC"),
  classroomId: z.string().trim().min(1).max(64).nullable().optional(),
  durationMinutes: z
    .number()
    .int()
    .min(MIN_EXAM_DURATION_MINUTES)
    .max(MAX_EXAM_DURATION_MINUTES)
    .default(45),
  gradeLevel: z.number().int().min(1).max(12).nullable().optional(),
  year: z.number().int().min(2000).max(2100).nullable().optional(),
  description: z.string().trim().max(2_000).nullable().optional(),
  instructionsDoc: richDocOrNullSchema.optional(),
});

export type CreateExamBody = z.infer<typeof createExamBodySchema>;

/**
 * Lưu nháp: mọi trường đều tuỳ chọn (thanh toán theo từng bước của trình soạn thảo).
 * `revision` là số phiên bản client đang giữ — thiếu thì bỏ qua kiểm tra xung đột.
 */
export const updateExamBodySchema = z.object({
  revision: z.number().int().min(1).optional(),
  title: z.string().trim().min(3, "Tên đề thi cần ít nhất 3 ký tự.").max(200).optional(),
  subjectId: z.string().trim().min(1).max(64).optional(),
  scope: examScopeSchema.optional(),
  classroomId: z.string().trim().min(1).max(64).nullable().optional(),
  durationMinutes: z
    .number()
    .int()
    .min(MIN_EXAM_DURATION_MINUTES)
    .max(MAX_EXAM_DURATION_MINUTES)
    .optional(),
  gradeLevel: z.number().int().min(1).max(12).nullable().optional(),
  year: z.number().int().min(2000).max(2100).nullable().optional(),
  description: z.string().trim().max(2_000).nullable().optional(),
  instructionsDoc: richDocOrNullSchema.optional(),
});

export type UpdateExamBody = z.infer<typeof updateExamBodySchema>;

export const lifecycleBodySchema = z.object({
  action: z.enum(["publish", "unpublish", "archive"]),
  revision: z.number().int().min(1).optional(),
});

export type LifecycleBody = z.infer<typeof lifecycleBodySchema>;

export const questionOrderBodySchema = z.object({
  questionIds: z.array(z.string().trim().min(1).max(64)).min(1).max(MAX_QUESTIONS_PER_EXAM),
});

export const cloneExamBodySchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
});

export const DEFAULT_AUTHORING_PAGE_SIZE = 10;
export const MAX_AUTHORING_PAGE_SIZE = 50;

export const authoringExamListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: examStatusSchema.optional(),
  scope: examScopeSchema.optional(),
  classroomId: z.string().trim().min(1).max(64).optional(),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_AUTHORING_PAGE_SIZE)
    .catch(DEFAULT_AUTHORING_PAGE_SIZE),
});

export type AuthoringExamListQuery = z.infer<typeof authoringExamListQuerySchema>;

export const examIdParamSchema = z.object({
  examId: z.string().trim().min(1, "Thiếu mã đề thi."),
});

export const examQuestionParamSchema = z.object({
  examId: z.string().trim().min(1, "Thiếu mã đề thi."),
  questionId: z.string().trim().min(1, "Thiếu mã câu hỏi."),
});

export const mediaAssetIdParamSchema = z.object({
  assetId: z.string().trim().min(1, "Thiếu mã tệp media."),
});
