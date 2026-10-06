import type { NextResponse } from "next/server";

import {
  examIdParamSchema,
  questionOrderBodySchema,
} from "@/features/authoring/schemas/authoring.schemas";
import { requireAuthoringActor } from "@/features/authoring/services/authoring-guard";
import { reorderQuestions } from "@/features/authoring/services/authoring-service";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Sắp xếp lại thứ tự câu hỏi. Danh sách gửi lên phải là hoán vị đúng của các câu hiện có,
 * nhờ vậy thao tác kéo–thả không thể làm mất câu hay làm lệch đáp án.
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ examId: string }> },
): Promise<NextResponse> {
  try {
    const actor = await requireAuthoringActor();
    const { examId } = examIdParamSchema.parse(await context.params);
    const payload = await request.json().catch(() => null);
    const body = questionOrderBodySchema.parse(payload);
    const questions = await reorderQuestions(actor, examId, body.questionIds);
    return jsonOk({ questions });
  } catch (error) {
    return handleRouteError(error);
  }
}
