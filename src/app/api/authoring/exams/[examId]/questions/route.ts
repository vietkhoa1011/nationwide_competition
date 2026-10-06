import type { NextResponse } from "next/server";

import {
  examIdParamSchema,
  questionInputSchema,
} from "@/features/authoring/schemas/authoring.schemas";
import { requireAuthoringActor } from "@/features/authoring/services/authoring-guard";
import { addQuestion } from "@/features/authoring/services/authoring-service";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Thêm một câu hỏi vào cuối đề. Đề đã có lượt làm bài sẽ bị khoá nội dung (409). */
export async function POST(
  request: Request,
  context: { params: Promise<{ examId: string }> },
): Promise<NextResponse> {
  try {
    const actor = await requireAuthoringActor();
    const { examId } = examIdParamSchema.parse(await context.params);
    const payload = await request.json().catch(() => null);
    const body = questionInputSchema.parse(payload);
    const question = await addQuestion(actor, examId, body);
    return jsonOk(question, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
