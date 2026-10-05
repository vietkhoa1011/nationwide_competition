import { NextResponse } from "next/server";

import { logoutUser } from "@/features/auth/services/auth-service";
import { handleRouteError } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Đăng xuất: xoá phiên trong database và xoá cookie. Idempotent nên gọi lại
 * khi đã đăng xuất vẫn trả 204.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { setCookies } = await logoutUser(request);
    const response = new NextResponse(null, { status: 204 });

    for (const cookie of setCookies) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
