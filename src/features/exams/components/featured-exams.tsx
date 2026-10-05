"use client";

import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { ExamCard } from "@/features/exams/components/exam-card";
import { useExams } from "@/features/exams/hooks/use-exams";

export function FeaturedExams() {
  const examsQuery = useExams({ featured: "true", page: 1, pageSize: 3 });

  if (examsQuery.isPending) {
    return <LoadingBlock message="Đang tải đề thi nổi bật…" />;
  }

  if (examsQuery.isError) {
    return (
      <ErrorBlock
        error={examsQuery.error}
        title="Không tải được danh sách đề thi"
        onRetry={() => void examsQuery.refetch()}
      />
    );
  }

  const exams = examsQuery.data?.items ?? [];

  if (exams.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
        Chưa có đề thi nổi bật. Hãy chạy <code>npm run db:seed</code> để nạp dữ liệu mẫu.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {exams.map((exam) => (
        <ExamCard key={exam.id} exam={exam} />
      ))}
    </div>
  );
}
