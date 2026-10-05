import type { NextResponse } from "next/server";

import type { AuthSessionDto } from "@/features/auth/types";
import { readSession, toAuthUserDto } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Phiên hiện tại. Trả `{ user: null }` cho khách ẩn danh và 403 nếu tài khoản bị khoá,
 * nhờ vậy giao diện biết chính xác trạng thái mà không cần suy đoán từ phía client.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const state = await readSession();

    if (state.status === "locked") {
      throw new AppError(
        "ACCOUNT_LOCKED",
        "Tài khoản đã bị khoá. Hãy liên hệ quản trị viên.",
        403,
      );
    }

    const body: AuthSessionDto = {
      user: state.status === "authenticated" ? toAuthUserDto(state.user) : null,
    };

    return jsonOk(body);
  } catch (error) {
    return handleRouteError(error);
  }
}
