import type { NextResponse } from "next/server";

import {
  examQuestionParamSchema,
  questionInputSchema,
} from "@/features/authoring/schemas/authoring.schemas";
import { requireAuthoringActor } from "@/features/authoring/services/authoring-guard";
import {
  deleteQuestion,
  updateQuestion,
} from "@/features/authoring/services/authoring-service";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Ghi đè nội dung một câu hỏi (giữ ID phương án để đáp án đúng không bị lệch). */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ examId: string; questionId: string }> },
): Promise<NextResponse> {
  try {
    const actor = await requireAuthoringActor();
    const { examId, questionId } = examQuestionParamSchema.parse(await context.params);
    const payload = await request.json().catch(() => null);
    const body = questionInputSchema.parse(payload);
    const question = await updateQuestion(actor, examId, questionId, body);
    return jsonOk(question);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Xoá câu hỏi khỏi đề (dữ liệu của các lượt làm bài cũ luôn được bảo toàn). */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ examId: string; questionId: string }> },
): Promise<NextResponse> {
  try {
    const actor = await requireAuthoringActor();
    const { examId, questionId } = examQuestionParamSchema.parse(await context.params);
    const result = await deleteQuestion(actor, examId, questionId);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
