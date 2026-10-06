import type { NextResponse } from "next/server";

import { requireClassroomActor } from "@/features/authoring/services/authoring-guard";
import {
  assignmentIdParamSchema,
  assignmentUpdateBodySchema,
} from "@/features/classroom/schemas/classroom.schemas";
import {
  deleteAssignment,
  updateAssignment,
} from "@/features/classroom/services/classroom-service";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Sửa cấu hình một lần giao đề (chủ lớp/quản trị viên). */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> },
): Promise<NextResponse> {
  try {
    const actor = await requireClassroomActor();
    const { assignmentId } = assignmentIdParamSchema.parse(await context.params);
    const payload = await request.json().catch(() => null);
    const body = assignmentUpdateBodySchema.parse(payload);
    const assignment = await updateAssignment(actor, assignmentId, body);
    return jsonOk(assignment);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Thu hồi một lần giao đề (bài làm đã có vẫn được giữ nguyên). */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ assignmentId: string }> },
): Promise<NextResponse> {
  try {
    const actor = await requireClassroomActor();
    const { assignmentId } = assignmentIdParamSchema.parse(await context.params);
    const result = await deleteAssignment(actor, assignmentId);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
