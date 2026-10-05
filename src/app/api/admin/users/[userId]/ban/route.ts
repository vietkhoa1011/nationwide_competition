import {
  adminBanUserBodySchema,
  adminUserIdParamSchema,
} from "@/features/admin/schemas/admin.schemas";
import { setUserBanState } from "@/features/admin/services/admin-service";
import { requireRole } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Khoá một tài khoản. Tài khoản bị khoá sẽ không đăng nhập được (kể cả phiên đang mở). */
export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const actor = await requireRole("ADMIN");
    const { userId } = adminUserIdParamSchema.parse(await context.params);
    const payload = await request.json().catch(() => null);
    const body = adminBanUserBodySchema.parse(payload);
    const user = await setUserBanState(actor, userId, true, body.reason);
    return jsonOk(user);
  } catch (error) {
    return handleRouteError(error);
  }
}
