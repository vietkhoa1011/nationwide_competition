import type { NextResponse } from "next/server";

import { examIdParamSchema } from "@/features/authoring/schemas/authoring.schemas";
import { requireAuthoringActor } from "@/features/authoring/services/authoring-guard";
import { validateExam } from "@/features/authoring/services/authoring-service";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Kiểm tra đề trước khi xuất bản: liệt kê mọi lỗi/cảnh báo kèm `questionId` để giao diện
 * nhảy tới đúng câu. Thao tác xuất bản gọi lại chính hàm này nên kết quả kiểm tra và kết
 * quả xuất bản luôn nhất quán.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ examId: string }> },
): Promise<NextResponse> {
  try {
    const actor = await requireAuthoringActor();
    const { examId } = examIdParamSchema.parse(await context.params);
    const report = await validateExam(actor, examId);
    return jsonOk(report);
  } catch (error) {
    return handleRouteError(error);
  }
}
