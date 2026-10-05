import { listSubjects } from "@/features/exams/services/exams-service";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listSubjects();
    return jsonOk({ items });
  } catch (error) {
    return handleRouteError(error);
  }
}
