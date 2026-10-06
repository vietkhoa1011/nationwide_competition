import type { NextResponse } from "next/server";

import { requireClassroomActor } from "@/features/authoring/services/authoring-guard";
import {
  classroomIdParamSchema,
  classroomMemberBodySchema,
} from "@/features/classroom/schemas/classroom.schemas";
import { addClassroomMember } from "@/features/classroom/services/classroom-service";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Thêm thành viên vào lớp theo email (chỉ chủ lớp hoặc quản trị viên). */
export async function POST(
  request: Request,
  context: { params: Promise<{ classroomId: string }> },
): Promise<NextResponse> {
  try {
    const actor = await requireClassroomActor();
    const { classroomId } = classroomIdParamSchema.parse(await context.params);
    const payload = await request.json().catch(() => null);
    const body = classroomMemberBodySchema.parse(payload);
    const member = await addClassroomMember(actor, classroomId, body);
    return jsonOk(member, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
