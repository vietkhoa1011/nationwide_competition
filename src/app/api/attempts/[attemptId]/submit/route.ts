import { attemptIdParamSchema } from "@/features/attempts/schemas/attempt.schemas";
import { submitAttempt } from "@/features/attempts/services/attempts-service";
import { handleRouteError, jsonOk } from "@/lib/http";
import { requireSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Nộp bài. An toàn khi gọi lặp lại nhiều lần: server chỉ chấm và ghi điểm một lần.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const { attemptId } = attemptIdParamSchema.parse(await context.params);
    const sessionId = await requireSessionId();
    const result = await submitAttempt(sessionId, attemptId);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
