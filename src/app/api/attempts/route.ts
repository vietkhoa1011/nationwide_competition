import type { NextResponse } from "next/server";

import { startAttemptBodySchema } from "@/features/attempts/schemas/attempt.schemas";
import { startAttempt } from "@/features/attempts/services/attempts-service";
import { handleRouteError, jsonOk } from "@/lib/http";
import { getOrCreateSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Bắt đầu (hoặc khôi phục) một lượt làm bài cho phiên ẩn danh hiện tại. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = await request.json().catch(() => null);
    const body = startAttemptBodySchema.parse(payload);
    const sessionId = await getOrCreateSessionId();
    const result = await startAttempt(sessionId, body.examId);
    return jsonOk(result, { status: result.resumed ? 200 : 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
