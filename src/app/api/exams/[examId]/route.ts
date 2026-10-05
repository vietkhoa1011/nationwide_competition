import { examIdParamSchema } from "@/features/exams/schemas/exam.schemas";
import { getExamById } from "@/features/exams/services/exams-service";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ examId: string }> },
) {
  try {
    const { examId } = examIdParamSchema.parse(await context.params);
    const exam = await getExamById(examId);
    return jsonOk(exam);
  } catch (error) {
    return handleRouteError(error);
  }
}
