import {
  adminReviewTeacherApplicationBodySchema,
  adminTeacherApplicationIdParamSchema,
} from "@/features/admin/schemas/admin.schemas";
import { reviewTeacherApplication } from "@/features/admin/services/admin-service";
import { requireRole } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Từ chối một đơn xin quyền giáo viên; ghi chú được hiển thị lại cho người nộp đơn. */
export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  try {
    const actor = await requireRole("ADMIN");
    const { applicationId } = adminTeacherApplicationIdParamSchema.parse(await context.params);
    const payload = await request.json().catch(() => null);
    const body = adminReviewTeacherApplicationBodySchema.parse(payload);
    const application = await reviewTeacherApplication(
      actor,
      applicationId,
      "REJECTED",
      body.note,
    );
    return jsonOk(application);
  } catch (error) {
    return handleRouteError(error);
  }
}
