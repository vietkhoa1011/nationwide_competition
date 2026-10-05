import { attemptIdParamSchema } from "@/features/attempts/schemas/attempt.schemas";
import { getAttemptResult } from "@/features/attempts/services/attempts-service";
import { resolveAttemptOwner } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Kết quả bài làm (kèm đáp án đúng và lời giải) — chỉ chủ lượt làm bài mới xem được. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const { attemptId } = attemptIdParamSchema.parse(await context.params);
    const owner = await resolveAttemptOwner();
    const result = await getAttemptResult(owner, attemptId);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
