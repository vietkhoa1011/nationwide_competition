import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ExamEditorShell } from "@/features/authoring/components/exam-editor-shell";
import { examIdParamSchema } from "@/features/authoring/schemas/authoring.schemas";
import { getAuthoringExam } from "@/features/authoring/services/authoring-service";
import { listClassrooms } from "@/features/classroom/services/classroom-service";
import { listSubjects } from "@/features/exams/services/exams-service";
import { isAppError } from "@/lib/errors";
import { readSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Soạn đề thi — Luyện Thi 2027",
};

const LOGIN_HREF = "/dang-nhap?next=%2Fgiao-vien";

/**
 * Trình soạn đề (3 bước). Trang nạp sẵn dữ liệu đề trên server — bao gồm cả đáp án đúng vì
 * đây là khu vực của người soạn — rồi bàn giao cho `ExamEditorShell` phía client.
 *
 * Giáo viên không phụ trách lớp sở hữu đề sẽ nhận 404 qua `getAuthoringExam` (service kiểm
 * tra quyền trên dữ liệu đọc từ database).
 */
export default async function ExamAuthoringPage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const session = await readSession();

  if (session.status !== "authenticated") {
    redirect(LOGIN_HREF);
  }

  if (session.user.role === "STUDENT") {
    redirect("/lop-hoc");
  }

  const { examId } = examIdParamSchema.parse(await params);
  const query = await searchParams;
  const actor = { id: session.user.id, role: session.user.role };

  const exam = await getAuthoringExam(actor, examId).catch((error: unknown) => {
    if (isAppError(error) && (error.code === "EXAM_NOT_FOUND" || error.code === "FORBIDDEN")) {
      return null;
    }
    throw error;
  });

  if (!exam) {
    notFound();
  }

  const [subjects, classrooms] = await Promise.all([
    listSubjects().catch(() => []),
    listClassrooms(actor, {})
      .then((result) => result.items)
      .catch(() => []),
  ]);

  return (
    <div className="space-y-4">
      <Link
        href="/giao-vien"
        className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
      >
        ← Khu vực giáo viên
      </Link>

      <ExamEditorShell
        exam={exam}
        subjects={subjects}
        classrooms={classrooms}
        isAdmin={session.user.role === "ADMIN"}
        questionsOnly={query.step === "questions"}
      />
    </div>
  );
}
