import {
  attemptIdParamSchema,
  setProgressBodySchema,
} from "@/features/attempts/schemas/attempt.schemas";
import { setProgress } from "@/features/attempts/services/attempts-service";
import { resolveAttemptOwner } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Ghi nhớ vị trí câu đang xem để khôi phục sau khi tải lại. */
export async function POST(
  request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const { attemptId } = attemptIdParamSchema.parse(await context.params);
    const payload = await request.json().catch(() => null);
    const body = setProgressBodySchema.parse(payload);
    const owner = await resolveAttemptOwner();
    const result = await setProgress(owner, attemptId, body.lastQuestionPosition);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
