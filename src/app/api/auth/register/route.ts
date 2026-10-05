import type { NextResponse } from "next/server";

import { registerBodySchema } from "@/features/auth/schemas/auth.schemas";
import { registerUser } from "@/features/auth/services/auth-service";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Đăng ký tài khoản mới (mặc định là học sinh).
 * Chỉ trả về hồ sơ người dùng; token phiên nằm trong cookie httpOnly.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = await request.json().catch(() => null);
    const body = registerBodySchema.parse(payload);
    const result = await registerUser(request, body);

    const response = jsonOk(result.body, { status: 201 });
    for (const cookie of result.setCookies) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
