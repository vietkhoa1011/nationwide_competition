import type { NextRequest, NextResponse } from "next/server";

import {
  classroomCreateBodySchema,
  classroomListQuerySchema,
} from "@/features/classroom/schemas/classroom.schemas";
import { requireClassroomActor } from "@/features/authoring/services/authoring-guard";
import { createClassroom, listClassrooms } from "@/features/classroom/services/classroom-service";
import { handleRouteError, jsonOk, toQueryObject } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Lớp của người đang đăng nhập (giáo viên: lớp phụ trách/tham gia; học sinh: lớp của mình). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireClassroomActor();
    const query = classroomListQuerySchema.parse(toQueryObject(request.nextUrl.searchParams));
    const result = await listClassrooms(actor, query);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Tạo lớp học mới (giáo viên/quản trị viên). */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireClassroomActor();
    const payload = await request.json().catch(() => null);
    const body = classroomCreateBodySchema.parse(payload);
    const classroom = await createClassroom(actor, body);
    return jsonOk(classroom, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
