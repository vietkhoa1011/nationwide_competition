import { attemptIdParamSchema } from "@/features/attempts/schemas/attempt.schemas";
import { getAttemptResult } from "@/features/attempts/services/attempts-service";
import { handleRouteError, jsonOk } from "@/lib/http";
import { requireSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Kết quả bài làm (kèm đáp án đúng và lời giải) — chỉ chủ phiên mới xem được. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const { attemptId } = attemptIdParamSchema.parse(await context.params);
    const sessionId = await requireSessionId();
    const result = await getAttemptResult(sessionId, attemptId);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
