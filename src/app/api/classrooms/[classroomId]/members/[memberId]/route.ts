import type { NextResponse } from "next/server";

import { requireClassroomActor } from "@/features/authoring/services/authoring-guard";
import { classroomMemberParamSchema } from "@/features/classroom/schemas/classroom.schemas";
import { removeClassroomMember } from "@/features/classroom/services/classroom-service";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Xoá một thành viên khỏi lớp (không thể xoá giáo viên phụ trách). */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ classroomId: string; memberId: string }> },
): Promise<NextResponse> {
  try {
    const actor = await requireClassroomActor();
    const { classroomId, memberId } = classroomMemberParamSchema.parse(await context.params);
    const result = await removeClassroomMember(actor, classroomId, memberId);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
