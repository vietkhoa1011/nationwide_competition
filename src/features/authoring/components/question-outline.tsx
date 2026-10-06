"use client";

import { Badge } from "@/components/ui/card";
import { QUESTION_TYPE_LABELS } from "@/features/authoring/services/exam-authoring-core";
import { isRichDocEmpty } from "@/features/authoring/services/rich-content-core";
import type { AuthoringQuestionDto } from "@/features/authoring/types";
import { cn } from "@/lib/utils";

/** Nhắc nhanh những gì câu hỏi còn thiếu (máy chủ vẫn là nơi quyết định khi xuất bản). */
function describeCompleteness(question: AuthoringQuestionDto): string[] {
  const issues: string[] = [];

  if (!question.contentDoc || isRichDocEmpty(question.contentDoc)) {
    issues.push("Chưa có nội dung");
  }
  if (question.options.some((option) => !option.contentDoc || isRichDocEmpty(option.contentDoc))) {
    issues.push("Có phương án để trống");
  }
  if (!question.options.some((option) => option.isCorrect)) {
    issues.push("Chưa chọn đáp án đúng");
  }
  if (!question.explanationDoc && !question.explanation) {
    issues.push("Chưa có lời giải");
  }

  return issues;
}

/**
 * Mục lục câu hỏi: số thứ tự, loại câu, điểm và trạng thái hoàn thiện. Có nút thêm, nhân
 * bản, xoá và đổi thứ tự — mọi thao tác đều gọi API ở máy chủ, nơi kiểm tra lại quyền và
 * tính hợp lệ của thứ tự gửi lên.
 */
export function QuestionOutline({
  questions,
  selectedQuestionId,
  disabled,
  busy,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onMove,
}: {
  questions: AuthoringQuestionDto[];
  selectedQuestionId: string | null;
  /** Đề đã có lượt làm bài → nội dung bị khoá, chỉ xem được. */
  disabled: boolean;
  busy: boolean;
  onSelect: (questionId: string) => void;
  onAdd: () => void;
  onDuplicate: (questionId: string) => void;
  onDelete: (questionId: string) => void;
  onMove: (questionId: string, direction: -1 | 1) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {`Mục lục câu hỏi (${questions.length})`}
        </p>
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled || busy}
          className="rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          + Thêm câu
        </button>
      </div>

      {questions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-xs text-slate-500">
          Chưa có câu hỏi. Bấm “Thêm câu” để bắt đầu soạn.
        </p>
      ) : (
        <ol className="max-h-[32rem] space-y-1.5 overflow-y-auto pr-1">
          {questions.map((question, index) => {
            const issues = describeCompleteness(question);
            const isSelected = question.id === selectedQuestionId;

            return (
              <li key={question.id}>
                <div
                  className={cn(
                    "rounded-xl border px-2.5 py-2 text-sm transition-colors",
                    isSelected ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-white",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(question.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700">{`Câu ${index + 1}`}</span>
                      <span className="text-xs text-slate-500">{`${question.points} đ`}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                      {question.content || "(chưa có nội dung)"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge tone="violet">{QUESTION_TYPE_LABELS[question.type]}</Badge>
                      {issues.length > 0 ? (
                        <Badge tone="amber">{`Thiếu: ${issues.length}`}</Badge>
                      ) : (
                        <Badge tone="emerald">Đã đủ</Badge>
                      )}
                    </div>
                  </button>

                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <button
                      type="button"
                      title="Đưa câu lên trước"
                      disabled={disabled || busy || index === 0}
                      onClick={() => onMove(question.id, -1)}
                      className="rounded-md px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      title="Đưa câu xuống sau"
                      disabled={disabled || busy || index === questions.length - 1}
                      onClick={() => onMove(question.id, 1)}
                      className="rounded-md px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      disabled={disabled || busy}
                      onClick={() => onDuplicate(question.id)}
                      className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                    >
                      Nhân bản
                    </button>
                    <button
                      type="button"
                      disabled={disabled || busy}
                      onClick={() => onDelete(question.id)}
                      className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                    >
                      Xoá
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}