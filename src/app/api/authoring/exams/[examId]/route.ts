import type { NextResponse } from "next/server";

import {
  examIdParamSchema,
  updateExamBodySchema,
} from "@/features/authoring/schemas/authoring.schemas";
import { requireAuthoringActor } from "@/features/authoring/services/authoring-guard";
import { getAuthoringExam, updateExamDraft } from "@/features/authoring/services/authoring-service";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Chi tiết đề dành cho người soạn (kèm đáp án đúng và lời giải). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ examId: string }> },
): Promise<NextResponse> {
  try {
    const actor = await requireAuthoringActor();
    const { examId } = examIdParamSchema.parse(await context.params);
    const exam = await getAuthoringExam(actor, examId);
    return jsonOk(exam);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Lưu nháp thông tin đề (bước 1 và thiết lập giao đề) kèm kiểm tra phiên bản. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ examId: string }> },
): Promise<NextResponse> {
  try {
    const actor = await requireAuthoringActor();
    const { examId } = examIdParamSchema.parse(await context.params);
    const payload = await request.json().catch(() => null);
    const body = updateExamBodySchema.parse(payload);
    const exam = await updateExamDraft(actor, examId, body);
    return jsonOk(exam);
  } catch (error) {
    return handleRouteError(error);
  }
}
