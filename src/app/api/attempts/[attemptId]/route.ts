import { attemptIdParamSchema } from "@/features/attempts/schemas/attempt.schemas";
import { getCurrentAttempt } from "@/features/attempts/services/attempts-service";
import { resolveAttemptOwner } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Khôi phục lượt làm bài đang dang dở (không kèm đáp án đúng). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const { attemptId } = attemptIdParamSchema.parse(await context.params);
    const owner = await resolveAttemptOwner();
    const attempt = await getCurrentAttempt(owner, attemptId);
    return jsonOk(attempt);
  } catch (error) {
    return handleRouteError(error);
  }
}
