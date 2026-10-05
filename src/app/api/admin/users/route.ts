import type { NextRequest, NextResponse } from "next/server";

import { adminUserListQuerySchema } from "@/features/admin/schemas/admin.schemas";
import { listAdminUsers } from "@/features/admin/services/admin-service";
import { requireRole } from "@/lib/auth/session";
import { handleRouteError, jsonOk, toQueryObject } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Danh sách người dùng kèm số lượt làm bài (chỉ quản trị viên). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireRole("ADMIN");
    const query = adminUserListQuerySchema.parse(toQueryObject(request.nextUrl.searchParams));
    const result = await listAdminUsers(query);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
