import type { NextRequest } from "next/server";

import { examListQuerySchema } from "@/features/exams/schemas/exam.schemas";
import { listExams } from "@/features/exams/services/exams-service";
import { handleRouteError, jsonOk, toQueryObject } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const query = examListQuerySchema.parse(toQueryObject(request.nextUrl.searchParams));
    const result = await listExams(query);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
