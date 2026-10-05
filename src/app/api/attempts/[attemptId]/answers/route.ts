import {
  attemptIdParamSchema,
  deleteAnswerQuerySchema,
  saveAnswerBodySchema,
} from "@/features/attempts/schemas/attempt.schemas";
import { deleteAnswer, saveAnswer } from "@/features/attempts/services/attempts-service";
import { resolveAttemptOwner } from "@/lib/auth/session";
import { handleRouteError, jsonOk, toQueryObject } from "@/lib/http";

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
    const owner = await resolveAttemptOwner();
    const result = await saveAnswer(owner, attemptId, body);
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
    const owner = await resolveAttemptOwner();
    const result = await deleteAnswer(owner, attemptId, questionId);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
