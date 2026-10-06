"use client";

import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody } from "@/components/ui/card";
import { ErrorBlock, LoadingBlock, Alert } from "@/components/ui/feedback";
import { useAttemptResult } from "@/features/attempts/hooks/use-attempt";
import type { AttemptResultDto, ResultQuestionDto } from "@/features/attempts/types";
import { RichContent } from "@/features/content/components/rich-content";
import { cn, formatDateTime, formatPercent, formatScore } from "@/lib/utils";

const statusLabels: Record<string, string> = {
  SUBMITTED: "Đã nộp bài",
  EXPIRED: "Hết giờ làm bài",
  IN_PROGRESS: "Đang làm bài",
};

export function ResultView({ attemptId }: { attemptId: string }) {
  const resultQuery = useAttemptResult(attemptId);

  if (resultQuery.isPending) {
    return <LoadingBlock message="Đang tải kết quả…" />;
  }

  if (resultQuery.isError) {
    // Bài chưa nộp và chưa hết giờ: đưa người dùng quay lại phòng thi.
    if (resultQuery.error.code === "RESULT_NOT_READY") {
      return (
        <Card>
          <CardBody className="space-y-3">
            <p className="text-sm text-slate-600">
              Bài làm vẫn đang diễn ra nên chưa có kết quả.
            </p>
            <ButtonLink href={`/lam-bai/${attemptId}`} size="sm">
              Quay lại làm bài
            </ButtonLink>
          </CardBody>
        </Card>
      );
    }

    return (
      <ErrorBlock
        error={resultQuery.error}
        title="Không tải được kết quả"
        onRetry={() => void resultQuery.refetch()}
      />
    );
  }

  const result = resultQuery.data;
  if (!result) {
    return null;
  }

  return <ResultContent result={result} />;
}

function ResultContent({ result }: { result: AttemptResultDto }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Kết quả bài làm</p>
              <h1 className="text-2xl font-bold text-slate-900">{result.examTitle}</h1>
              <p className="mt-1 text-xs text-slate-500">
                {`Bắt đầu ${formatDateTime(result.startedAt)} · Nộp lúc ${
                  result.submittedAt ? formatDateTime(result.submittedAt) : "—"
                }`}
              </p>
            </div>
            <Badge tone={result.status === "EXPIRED" ? "amber" : "emerald"}>
              {statusLabels[result.status] ?? result.status}
            </Badge>
          </div>

          <div className="rounded-2xl bg-slate-900 px-6 py-5 text-white">
            <p className="text-sm text-slate-300">Tổng điểm</p>
            <p className="mt-1 text-4xl font-bold tabular-nums">
              {formatScore(result.score)}
              <span className="ml-2 text-lg font-medium text-slate-400">
                {`/ ${formatScore(result.maxScore)}`}
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {`Đạt ${formatPercent(result.score, result.maxScore)} điểm tối đa`}
            </p>
          </div>

          {result.answersHidden ? (
            <Alert tone="info">
              {result.answersRevealAt
                ? `Giáo viên chưa mở đáp án và lời giải cho lớp. Bạn xem được từ ${formatDateTime(
                    result.answersRevealAt,
                  )}.`
                : "Đáp án và lời giải chưa được mở cho lớp này."}
            </Alert>
          ) : null}

          <dl className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-emerald-50 px-3 py-3">
              <dt className="text-xs text-emerald-700">Đúng</dt>
              <dd className="text-xl font-bold text-emerald-700">{result.correctCount}</dd>
            </div>
            <div className="rounded-xl bg-rose-50 px-3 py-3">
              <dt className="text-xs text-rose-700">Sai</dt>
              <dd className="text-xl font-bold text-rose-700">{result.incorrectCount}</dd>
            </div>
            <div className="rounded-xl bg-slate-100 px-3 py-3">
              <dt className="text-xs text-slate-600">Bỏ trống</dt>
              <dd className="text-xl font-bold text-slate-700">{result.unansweredCount}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/de-thi/${result.examId}`} size="sm">
              Xem lại đề thi
            </ButtonLink>
            <ButtonLink href="/de-thi" variant="secondary" size="sm">
              Luyện đề khác
            </ButtonLink>
          </div>
        </CardBody>
      </Card>

      <h2 className="text-lg font-bold text-slate-900">Chi tiết từng câu</h2>

      <ol className="space-y-4">
        {result.questions.map((question, index) => (
          <li key={question.questionId}>
            <QuestionReview question={question} index={index} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function QuestionReview({ question, index }: { question: ResultQuestionDto; index: number }) {
  const status = question.isCorrect
    ? { text: "Đúng", tone: "emerald" as const }
    : question.selectedOptionId === null
      ? { text: "Bỏ trống", tone: "slate" as const }
      : { text: "Sai", tone: "rose" as const };

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-500">{`Câu ${index + 1}`}</span>
            <Badge tone={status.tone}>{status.text}</Badge>
          </div>
          <span className="text-xs font-semibold tabular-nums text-slate-500">
            {`${formatScore(question.earnedPoints)} / ${formatScore(question.points)} điểm`}
          </span>
        </div>

        <RichContent
          doc={question.contentDoc}
          text={question.content}
          compact
          className="text-slate-900"
        />

        <ul className="space-y-2">
          {question.options.map((option) => {
            const isCorrectOption = question.correctOptionIds.includes(option.id);
            const isSelected = question.selectedOptionId === option.id;

            return (
              <li
                key={option.id}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border px-4 py-3",
                  isCorrectOption
                    ? "border-emerald-400 bg-emerald-50"
                    : isSelected
                      ? "border-rose-400 bg-rose-50"
                      : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                    isCorrectOption
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : isSelected
                        ? "border-rose-500 bg-rose-500 text-white"
                        : "border-slate-300 text-slate-500",
                  )}
                >
                  {option.label}
                </span>
                <RichContent
                  doc={option.contentDoc}
                  text={option.content}
                  compact
                  className="text-slate-800"
                />
                <span className="ml-auto shrink-0 text-xs font-semibold">
                  {isSelected ? (
                    <span className={isCorrectOption ? "text-emerald-700" : "text-rose-600"}>
                      Bạn chọn
                    </span>
                  ) : isCorrectOption ? (
                    <span className="text-emerald-700">Đáp án đúng</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>

        {question.explanation ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Lời giải</p>
            <RichContent
              doc={question.explanationDoc}
              text={question.explanation}
              compact
              className="mt-1 text-sky-900"
            />
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
