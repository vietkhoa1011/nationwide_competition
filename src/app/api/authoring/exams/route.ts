import type { NextRequest, NextResponse } from "next/server";

import {
  authoringExamListQuerySchema,
  createExamBodySchema,
} from "@/features/authoring/schemas/authoring.schemas";
import { requireAuthoringActor } from "@/features/authoring/services/authoring-guard";
import { createExamDraft, listAuthoringExams } from "@/features/authoring/services/authoring-service";
import { handleRouteError, jsonOk, toQueryObject } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Danh sách đề người đang đăng nhập được quản lý (giáo viên: đề lớp mình phụ trách;
 * quản trị viên: mọi đề).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireAuthoringActor();
    const query = authoringExamListQuerySchema.parse(toQueryObject(request.nextUrl.searchParams));
    const result = await listAuthoringExams(actor, query);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Tạo đề nháp. Phạm vi do máy chủ kiểm tra: giáo viên chỉ tạo được đề của lớp mình phụ
 * trách, đề công khai chỉ quản trị viên tạo được.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireAuthoringActor();
    const payload = await request.json().catch(() => null);
    const body = createExamBodySchema.parse(payload);
    const exam = await createExamDraft(actor, body);
    return jsonOk(exam, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
