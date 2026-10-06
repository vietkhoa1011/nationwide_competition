import type { NextResponse } from "next/server";

import {
  examIdParamSchema,
  lifecycleBodySchema,
} from "@/features/authoring/schemas/authoring.schemas";
import { requireAuthoringActor } from "@/features/authoring/services/authoring-guard";
import { changeExamLifecycle } from "@/features/authoring/services/authoring-service";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Vòng đời đề thi: `publish` (kiểm tra rồi xuất bản), `unpublish` (chỉ khi chưa có lượt làm
 * bài) và `archive` (lưu trữ đề đã dùng). Với đề của lớp, xuất bản nội dung KHÔNG giao đề —
 * việc giao đề nằm ở `POST /api/classrooms/[classroomId]/assignments`.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ examId: string }> },
): Promise<NextResponse> {
  try {
    const actor = await requireAuthoringActor();
    const { examId } = examIdParamSchema.parse(await context.params);
    const payload = await request.json().catch(() => null);
    const body = lifecycleBodySchema.parse(payload);
    const exam = await changeExamLifecycle(actor, examId, body.action, body.revision);
    return jsonOk(exam);
  } catch (error) {
    return handleRouteError(error);
  }
}
