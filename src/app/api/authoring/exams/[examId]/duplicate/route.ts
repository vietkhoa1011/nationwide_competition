import type { NextResponse } from "next/server";

import {
  cloneExamBodySchema,
  examIdParamSchema,
} from "@/features/authoring/schemas/authoring.schemas";
import { requireAuthoringActor } from "@/features/authoring/services/authoring-guard";
import { duplicateExam } from "@/features/authoring/services/authoring-service";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * "Tạo bản sao để chỉnh sửa": đề đã phát sinh lượt làm bài bị khoá nội dung, nên người
 * soạn sao chép đề sang một bản nháp mới (ID mới cho câu và phương án) rồi sửa tiếp.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ examId: string }> },
): Promise<NextResponse> {
  try {
    const actor = await requireAuthoringActor();
    const { examId } = examIdParamSchema.parse(await context.params);
    const payload = await request.json().catch(() => ({}));
    const body = cloneExamBodySchema.parse(payload ?? {});
    const exam = await duplicateExam(actor, examId, body.title);
    return jsonOk(exam, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
