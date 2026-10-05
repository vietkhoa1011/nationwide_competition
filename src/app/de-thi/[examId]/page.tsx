import type { Metadata } from "next";
import Link from "next/link";

import { ExamDetailView } from "@/features/exams/components/exam-detail-view";

export const metadata: Metadata = {
  title: "Chi tiết đề thi — Luyện Thi 2027",
};

interface ExamDetailPageProps {
  params: Promise<{ examId: string }>;
}

export default async function ExamDetailPage({ params }: ExamDetailPageProps) {
  const { examId } = await params;

  return (
    <div className="space-y-4">
      <Link
        href="/de-thi"
        className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
      >
        ← Về kho đề thi
      </Link>
      <ExamDetailView examId={examId} />
    </div>
  );
}
