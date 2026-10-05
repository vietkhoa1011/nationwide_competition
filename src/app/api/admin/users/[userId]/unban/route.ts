import { adminUserIdParamSchema } from "@/features/admin/schemas/admin.schemas";
import { setUserBanState } from "@/features/admin/services/admin-service";
import { requireRole } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Mở khoá một tài khoản để người dùng có thể đăng nhập và làm bài trở lại. */
export async function POST(_request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const actor = await requireRole("ADMIN");
    const { userId } = adminUserIdParamSchema.parse(await context.params);
    const user = await setUserBanState(actor, userId, false);
    return jsonOk(user);
  } catch (error) {
    return handleRouteError(error);
  }
}
