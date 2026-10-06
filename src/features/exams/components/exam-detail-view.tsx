"use client";

import { Badge, Card, CardBody } from "@/components/ui/card";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { RichContent } from "@/features/content/components/rich-content";
import { StartAttemptButton } from "@/features/exams/components/start-attempt-button";
import { useExam } from "@/features/exams/hooks/use-exams";
import type { ExamDetailDto } from "@/features/exams/types";
import { formatDurationMinutes, formatScore } from "@/lib/utils";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-lg font-semibold text-slate-800">{value}</p>
      </CardBody>
    </Card>
  );
}

export function ExamDetailView({
  examId,
  initialExam,
}: {
  examId: string;
  /** Chi tiết đề do Server Component nạp sẵn (không có khi đề không tồn tại hoặc DB tắt). */
  initialExam?: ExamDetailDto;
}) {
  const examQuery = useExam(examId, initialExam);

  if (examQuery.isPending) {
    return <LoadingBlock message="Đang tải đề thi…" />;
  }

  if (examQuery.isError) {
    return (
      <ErrorBlock
        error={examQuery.error}
        title="Không tải được đề thi"
        onRetry={() => void examQuery.refetch()}
      />
    );
  }

  const exam = examQuery.data;
  if (!exam) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge tone="sky">{exam.subject.name}</Badge>
          {exam.year ? <Badge>{`Năm ${exam.year}`}</Badge> : null}
          {exam.isFeatured ? <Badge tone="amber">Nổi bật</Badge> : null}
        </div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{exam.title}</h1>
        {exam.description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
            {exam.description}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Số câu hỏi" value={`${exam.questionCount} câu`} />
        <StatCard
          label="Thời gian làm bài"
          value={formatDurationMinutes(exam.durationMinutes)}
        />
        <StatCard label="Tổng điểm" value={formatScore(exam.totalPoints)} />
      </div>

      <Card>
        <CardBody className="space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Hướng dẫn làm bài</h2>
          {exam.instructionsDoc ? (
            <RichContent
              doc={exam.instructionsDoc}
              text={exam.instructions}
              className="text-sm text-slate-600"
            />
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-600">
              <li>Thời gian đếm ngược do máy chủ quyết định — hết giờ hệ thống tự chấm bài.</li>
              <li>Đáp án được lưu ngay khi bạn chọn, không cần bấm nút lưu.</li>
              <li>Bạn có thể đánh dấu câu hỏi để xem lại và chuyển nhanh bằng bảng điều hướng.</li>
              <li>Đáp án đúng và lời giải chỉ hiện ra sau khi nộp bài.</li>
            </ul>
          )}
          <StartAttemptButton
            examId={exam.id}
            disabled={exam.questionCount === 0}
            disabledLabel="Đề thi chưa có câu hỏi"
          />
        </CardBody>
      </Card>
    </div>
  );
}
