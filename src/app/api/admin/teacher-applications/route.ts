import type { NextRequest, NextResponse } from "next/server";

import { adminTeacherApplicationListQuerySchema } from "@/features/admin/schemas/admin.schemas";
import { listAdminTeacherApplications } from "@/features/admin/services/admin-service";
import { requireRole } from "@/lib/auth/session";
import { handleRouteError, jsonOk, toQueryObject } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Hàng đợi đơn xin quyền giáo viên (mặc định là các đơn đang chờ duyệt). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireRole("ADMIN");
    const query = adminTeacherApplicationListQuerySchema.parse(
      toQueryObject(request.nextUrl.searchParams),
    );
    const result = await listAdminTeacherApplications(query);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
