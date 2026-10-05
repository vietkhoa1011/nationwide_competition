import {
  attemptIdParamSchema,
  setProgressBodySchema,
} from "@/features/attempts/schemas/attempt.schemas";
import { setProgress } from "@/features/attempts/services/attempts-service";
import { handleRouteError, jsonOk } from "@/lib/http";
import { requireSessionId } from "@/lib/session";

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
    const sessionId = await requireSessionId();
    const result = await setProgress(sessionId, attemptId, body.lastQuestionPosition);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
