"use client";

import { useState } from "react";

import { Badge, Card, CardBody } from "@/components/ui/card";
import { QUESTION_TYPE_LABELS } from "@/features/authoring/services/exam-authoring-core";
import type { AuthoringExamDetailDto } from "@/features/authoring/types";
import { RichContent } from "@/features/content/components/rich-content";
import { cn, formatDurationMinutes, formatScore } from "@/lib/utils";

/**
 * Xem trước đề bằng ĐÚNG renderer mà học sinh dùng (`RichContent`), kèm công tắc "Hiện đáp
 * án và lời giải" dành riêng cho người soạn.
 *
 * Bản xem trước cho học sinh và payload làm bài không chứa đáp án/lời giải: việc loại bỏ
 * được thực hiện ở máy chủ, còn công tắc ở đây chỉ phục vụ người soạn đề.
 */
export function ExamPreviewPanel({
  exam,
  focusQuestionId,
  className,
}: {
  exam: AuthoringExamDetailDto;
  /** Câu cần làm nổi bật (khi bấm "sửa câu này" từ báo cáo kiểm tra). */
  focusQuestionId?: string | null;
  className?: string;
}) {
  const [showAnswers, setShowAnswers] = useState(false);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Xem trước như học sinh
        </p>
        <label className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
          <input
            type="checkbox"
            checked={showAnswers}
            onChange={(event) => setShowAnswers(event.target.checked)}
          />
          Hiện đáp án và lời giải
        </label>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="sky">{exam.subjectName}</Badge>
            <Badge>
              {exam.scope === "CLASS" ? `Lớp: ${exam.classroomName ?? "—"}` : "Đề công khai"}
            </Badge>
            <Badge tone={exam.status === "PUBLISHED" ? "emerald" : "amber"}>
              {exam.status === "PUBLISHED"
                ? "Đã xuất bản"
                : exam.status === "ARCHIVED"
                  ? "Đã lưu trữ"
                  : "Bản nháp"}
            </Badge>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">{exam.title}</h2>
            {exam.description ? (
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{exam.description}</p>
            ) : null}
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">Số câu</dt>
              <dd className="font-semibold text-slate-800">{`${exam.questionCount} câu`}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">Thời gian</dt>
              <dd className="font-semibold text-slate-800">
                {formatDurationMinutes(exam.durationMinutes)}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">Tổng điểm</dt>
              <dd className="font-semibold text-slate-800">{formatScore(exam.totalPoints)}</dd>
            </div>
          </dl>

          {exam.instructionsDoc ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Hướng dẫn làm bài
              </p>
              <RichContent doc={exam.instructionsDoc} className="mt-1 text-sm text-slate-700" />
            </div>
          ) : null}
        </CardBody>
      </Card>

      {exam.questions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
          Đề chưa có câu hỏi nào.
        </p>
      ) : (
        <ol className="space-y-3">
          {exam.questions.map((question, index) => (
            <li key={question.id}>
              <Card
                className={cn(
                  focusQuestionId === question.id ? "border-sky-400 ring-2 ring-sky-100" : "",
                )}
              >
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-500">
                        {`Câu ${index + 1}`}
                      </span>
                      <Badge tone="violet">{QUESTION_TYPE_LABELS[question.type]}</Badge>
                      <Badge>{`${formatScore(question.points)} điểm`}</Badge>
                    </div>
                    <span className="text-xs text-slate-400">{`Vị trí ${question.position}`}</span>
                  </div>

                  <RichContent doc={question.contentDoc} text={question.content} />

                  <ul className="space-y-2">
                    {question.options.map((option) => {
                      const showCorrect = showAnswers && option.isCorrect;
                      return (
                        <li
                          key={option.id}
                          className={cn(
                            "flex items-start gap-3 rounded-2xl border px-3 py-2",
                            showCorrect
                              ? "border-emerald-400 bg-emerald-50"
                              : "border-slate-200 bg-white",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                              showCorrect
                                ? "border-emerald-600 bg-emerald-600 text-white"
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
                          {showCorrect ? (
                            <span className="ml-auto shrink-0 text-xs font-semibold text-emerald-700">
                              Đáp án đúng
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>

                  {showAnswers ? (
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                        Lời giải
                      </p>
                      {question.explanationDoc || question.explanation ? (
                        <RichContent
                          doc={question.explanationDoc}
                          text={question.explanation}
                          className="mt-1 text-sm text-sky-900"
                        />
                      ) : (
                        <p className="mt-1 text-sm text-sky-900">Chưa có lời giải.</p>
                      )}
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
