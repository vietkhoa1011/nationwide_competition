import type { NextResponse } from "next/server";

import { examQuestionParamSchema } from "@/features/authoring/schemas/authoring.schemas";
import { requireAuthoringActor } from "@/features/authoring/services/authoring-guard";
import { duplicateQuestion } from "@/features/authoring/services/authoring-service";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Nhân bản một câu hỏi: ID mới cho câu và phương án, đáp án đúng được ánh xạ lại. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ examId: string; questionId: string }> },
): Promise<NextResponse> {
  try {
    const actor = await requireAuthoringActor();
    const { examId, questionId } = examQuestionParamSchema.parse(await context.params);
    const question = await duplicateQuestion(actor, examId, questionId);
    return jsonOk(question, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
