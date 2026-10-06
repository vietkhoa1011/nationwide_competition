import type { NextResponse } from "next/server";

import { requireClassroomActor } from "@/features/authoring/services/authoring-guard";
import {
  assignmentCreateBodySchema,
  classroomIdParamSchema,
} from "@/features/classroom/schemas/classroom.schemas";
import {
  createAssignment,
  listClassroomAssignments,
} from "@/features/classroom/services/classroom-service";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Danh sách lần giao đề của lớp (mọi thành viên của lớp xem được). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ classroomId: string }> },
): Promise<NextResponse> {
  try {
    const actor = await requireClassroomActor();
    const { classroomId } = classroomIdParamSchema.parse(await context.params);
    const items = await listClassroomAssignments(actor, classroomId);
    return jsonOk({ items });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Giao đề cho lớp: đề phải đã xuất bản nội dung, thuộc đúng lớp này, và người gọi phải là
 * chủ lớp/quản trị viên. Lịch mở/đóng, thời lượng, số lượt và mốc xem đáp án đặt ở đây.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ classroomId: string }> },
): Promise<NextResponse> {
  try {
    const actor = await requireClassroomActor();
    const { classroomId } = classroomIdParamSchema.parse(await context.params);
    const payload = await request.json().catch(() => null);
    const body = assignmentCreateBodySchema.parse(payload);
    const assignment = await createAssignment(actor, classroomId, body);
    return jsonOk(assignment, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
