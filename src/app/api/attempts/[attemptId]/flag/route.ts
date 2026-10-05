import {
  attemptIdParamSchema,
  toggleFlagBodySchema,
} from "@/features/attempts/schemas/attempt.schemas";
import { toggleFlag } from "@/features/attempts/services/attempts-service";
import { handleRouteError, jsonOk } from "@/lib/http";
import { requireSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Đánh dấu / bỏ đánh dấu câu hỏi để xem lại. */
export async function POST(
  request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const { attemptId } = attemptIdParamSchema.parse(await context.params);
    const payload = await request.json().catch(() => null);
    const body = toggleFlagBodySchema.parse(payload);
    const sessionId = await requireSessionId();
    const result = await toggleFlag(sessionId, attemptId, body);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
