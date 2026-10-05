import { z } from "zod";

export const startAttemptBodySchema = z.object({
  examId: z.string().trim().min(1, "Thiếu mã đề thi."),
});

export const attemptIdParamSchema = z.object({
  attemptId: z.string().trim().min(1, "Thiếu mã lượt làm bài."),
});

export const saveAnswerBodySchema = z.object({
  questionId: z.string().trim().min(1, "Thiếu mã câu hỏi."),
  /** null nghĩa là xoá đáp án đã chọn của câu hỏi. */
  optionId: z.string().trim().min(1, "Mã lựa chọn không hợp lệ.").nullable(),
});

export type SaveAnswerBody = z.infer<typeof saveAnswerBodySchema>;

export const deleteAnswerQuerySchema = z.object({
  questionId: z.string().trim().min(1, "Thiếu mã câu hỏi."),
});

export const toggleFlagBodySchema = z.object({
  questionId: z.string().trim().min(1, "Thiếu mã câu hỏi."),
  isFlagged: z.boolean(),
});

export type ToggleFlagBody = z.infer<typeof toggleFlagBodySchema>;

export const setProgressBodySchema = z.object({
  lastQuestionPosition: z.coerce.number().int().min(1).max(1000),
});

/** Snapshot lựa chọn an toàn để trả về client (không chứa đáp án đúng). */
export const snapshotOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  content: z.string(),
  order: z.number().int(),
});

export const snapshotOptionsSchema = z.array(snapshotOptionSchema);

export const snapshotCorrectOptionIdsSchema = z.array(z.string());
