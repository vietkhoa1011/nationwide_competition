import type { NextRequest, NextResponse } from "next/server";

import {
  attemptHistoryQuerySchema,
  startAttemptBodySchema,
} from "@/features/attempts/schemas/attempt.schemas";
import { listAttemptHistory, startAttempt } from "@/features/attempts/services/attempts-service";
import { resolveAttemptOwner } from "@/lib/auth/session";
import { handleRouteError, jsonOk, toQueryObject } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Bắt đầu (hoặc khôi phục) một lượt làm bài.
 * Người đã đăng nhập làm bài dưới tài khoản của mình; khách vẫn dùng cookie phiên.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = await request.json().catch(() => null);
    const body = startAttemptBodySchema.parse(payload);
    const owner = await resolveAttemptOwner();
    const result = await startAttempt(owner, body.examId);
    return jsonOk(result, { status: result.resumed ? 200 : 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Lịch sử làm bài của người đang gọi (theo tài khoản hoặc theo cookie phiên). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const query = attemptHistoryQuerySchema.parse(toQueryObject(request.nextUrl.searchParams));
    const owner = await resolveAttemptOwner();
    const result = await listAttemptHistory(owner, query);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
