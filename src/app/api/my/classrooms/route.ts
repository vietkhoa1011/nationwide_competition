import type { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { listStudentClassrooms } from "@/features/classroom/services/classroom-service";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Góc nhìn của học sinh: các lớp mình tham gia và những đề đã được giao kèm trạng thái cửa
 * sổ làm bài, số lượt đã dùng. Đây là lối vào duy nhất để học sinh làm đề của lớp — đề lớp
 * không xuất hiện trong kho đề công khai.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const items = await listStudentClassrooms(user.id);
    return jsonOk({ items });
  } catch (error) {
    return handleRouteError(error);
  }
}
