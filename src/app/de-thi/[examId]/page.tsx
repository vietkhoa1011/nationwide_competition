import type { Metadata } from "next";
import Link from "next/link";

import { ExamDetailView } from "@/features/exams/components/exam-detail-view";
import { getExamById } from "@/features/exams/services/exams-service";

export const metadata: Metadata = {
  title: "Chi tiết đề thi — Luyện Thi 2027",
};

interface ExamDetailPageProps {
  params: Promise<{ examId: string }>;
}

export default async function ExamDetailPage({ params }: ExamDetailPageProps) {
  const { examId } = await params;

  // Server Component đọc thẳng service. Lỗi (đề không tồn tại / DB tắt) được bỏ qua ở đây để
  // client tự thử lại và hiển thị ErrorBlock tiếng Việt như trước, thay vì trang lỗi 500.
  const initialExam = await getExamById(examId).catch(() => undefined);

  return (
    <div className="space-y-4">
      <Link
        href="/de-thi"
        className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
      >
        ← Về kho đề thi
      </Link>
      <ExamDetailView examId={examId} initialExam={initialExam} />
    </div>
  );
}
