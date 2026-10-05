import { requireUser } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/http";

import { teacherApplicationBodySchema } from "@/features/teacher-applications/schemas/teacher-application.schemas";
import {
  getMyTeacherApplicationState,
  submitTeacherApplication,
} from "@/features/teacher-applications/services/teacher-applications-service";

export const dynamic = "force-dynamic";

/** Trạng thái đơn xin quyền giáo viên của người đang gọi. */
export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk(await getMyTeacherApplicationState(user));
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Nộp đơn xin quyền giáo viên (chỉ tài khoản học sinh, mỗi lúc một đơn chờ duyệt). */
export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    const body = teacherApplicationBodySchema.parse(payload);
    const user = await requireUser();
    const application = await submitTeacherApplication(user, body);
    return jsonOk(application, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
