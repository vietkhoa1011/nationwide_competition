import type { NextResponse } from "next/server";

import { requireClassroomActor } from "@/features/authoring/services/authoring-guard";
import {
  classroomIdParamSchema,
  classroomUpdateBodySchema,
} from "@/features/classroom/schemas/classroom.schemas";
import { getClassroom, updateClassroom } from "@/features/classroom/services/classroom-service";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Chi tiết lớp kèm danh sách thành viên (chủ lớp, thành viên và quản trị viên xem được). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ classroomId: string }> },
): Promise<NextResponse> {
  try {
    const actor = await requireClassroomActor();
    const { classroomId } = classroomIdParamSchema.parse(await context.params);
    const classroom = await getClassroom(actor, classroomId);
    return jsonOk(classroom);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Đổi thông tin lớp (chỉ chủ lớp hoặc quản trị viên). */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ classroomId: string }> },
): Promise<NextResponse> {
  try {
    const actor = await requireClassroomActor();
    const { classroomId } = classroomIdParamSchema.parse(await context.params);
    const payload = await request.json().catch(() => null);
    const body = classroomUpdateBodySchema.parse(payload);
    const classroom = await updateClassroom(actor, classroomId, body);
    return jsonOk(classroom);
  } catch (error) {
    return handleRouteError(error);
  }
}
