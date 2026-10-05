import { attemptIdParamSchema } from "@/features/attempts/schemas/attempt.schemas";
import { submitAttempt } from "@/features/attempts/services/attempts-service";
import { resolveAttemptOwner } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/http";

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
    const owner = await resolveAttemptOwner();
    const result = await submitAttempt(owner, attemptId);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
