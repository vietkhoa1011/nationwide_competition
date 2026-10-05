import { Badge } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { StudentQuestionDto } from "@/features/attempts/types";

export type SaveState = "idle" | "saving" | "saved" | "error";

const levelLabels: Record<string, string> = {
  EASY: "Dễ",
  MEDIUM: "Trung bình",
  HARD: "Khó",
};

const saveStateLabels: Record<SaveState, { text: string; className: string }> = {
  idle: { text: "Đáp án được lưu tự động", className: "text-slate-400" },
  saving: { text: "Đang lưu đáp án…", className: "text-sky-600" },
  saved: { text: "Đã lưu đáp án", className: "text-emerald-600" },
  error: { text: "Chưa lưu được đáp án", className: "text-rose-600" },
};

export function QuestionPanel({
  question,
  index,
  total,
  saveState,
  onSelectOption,
  onToggleFlag,
}: {
  question: StudentQuestionDto;
  index: number;
  total: number;
  saveState: SaveState;
  onSelectOption: (optionId: string | null) => void;
  onToggleFlag: () => void;
}) {
  const saveStateLabel = saveStateLabels[saveState];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-500">
            {`Câu ${index + 1}/${total}`}
          </span>
          <Badge tone="violet">{levelLabels[question.level] ?? question.level}</Badge>
          <Badge>{`${question.points} điểm`}</Badge>
        </div>
        <button
          type="button"
          onClick={onToggleFlag}
          className={cn(
            "rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
            question.isFlagged
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200",
          )}
        >
          {question.isFlagged ? "Bỏ đánh dấu xem lại" : "Đánh dấu xem lại"}
        </button>
      </div>

      <p className="whitespace-pre-line text-base leading-relaxed text-slate-900">
        {question.content}
      </p>

      <ul className="space-y-2">
        {question.options.map((option) => {
          const isSelected = question.selectedOptionId === option.id;

          return (
            <li key={option.id}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectOption(isSelected ? null : option.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                  isSelected
                    ? "border-sky-500 bg-sky-50"
                    : "border-slate-200 bg-white hover:border-sky-300 hover:bg-slate-50",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                    isSelected
                      ? "border-sky-600 bg-sky-600 text-white"
                      : "border-slate-300 text-slate-500",
                  )}
                >
                  {option.label}
                </span>
                <span className="text-sm leading-relaxed text-slate-800">{option.content}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3 text-xs">
        <span className={saveStateLabel.className}>{saveStateLabel.text}</span>
        <span className="text-slate-400">Bấm lại vào đáp án đang chọn để bỏ chọn.</span>
      </div>
    </div>
  );
}
