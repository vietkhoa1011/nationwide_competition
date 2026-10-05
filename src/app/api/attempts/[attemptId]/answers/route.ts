import {
  attemptIdParamSchema,
  deleteAnswerQuerySchema,
  saveAnswerBodySchema,
} from "@/features/attempts/schemas/attempt.schemas";
import { deleteAnswer, saveAnswer } from "@/features/attempts/services/attempts-service";
import { handleRouteError, jsonOk, toQueryObject } from "@/lib/http";
import { requireSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Lưu đáp án cho một câu hỏi. */
export async function PUT(
  request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const { attemptId } = attemptIdParamSchema.parse(await context.params);
    const payload = await request.json().catch(() => null);
    const body = saveAnswerBodySchema.parse(payload);
    const sessionId = await requireSessionId();
    const result = await saveAnswer(sessionId, attemptId, body);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Xoá đáp án đã chọn của một câu hỏi: DELETE /api/attempts/:id/answers?questionId=... */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const { attemptId } = attemptIdParamSchema.parse(await context.params);
    const { questionId } = deleteAnswerQuerySchema.parse(
      toQueryObject(new URL(request.url).searchParams),
    );
    const sessionId = await requireSessionId();
    const result = await deleteAnswer(sessionId, attemptId, questionId);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
