import type { NextResponse } from "next/server";

import { loginBodySchema } from "@/features/auth/schemas/auth.schemas";
import { loginUser } from "@/features/auth/services/auth-service";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Đăng nhập bằng email + mật khẩu. Giới hạn tần suất do Better Auth áp dụng
 * (5 lần mỗi phút cho một IP) để chống dò mật khẩu.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = await request.json().catch(() => null);
    const body = loginBodySchema.parse(payload);
    const result = await loginUser(request, body);

    const response = jsonOk(result.body);
    for (const cookie of result.setCookies) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
