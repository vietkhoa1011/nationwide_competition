import { cn } from "@/lib/utils";

import type { StudentQuestionDto } from "@/features/attempts/types";

export function QuestionNavigator({
  questions,
  currentIndex,
  onSelect,
}: {
  questions: StudentQuestionDto[];
  currentIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-5">
      {questions.map((question, index) => {
        const isCurrent = index === currentIndex;
        const isAnswered = question.selectedOptionId !== null;

        return (
          <button
            key={question.questionId}
            type="button"
            onClick={() => onSelect(index)}
            aria-current={isCurrent ? "true" : undefined}
            aria-label={`Câu ${index + 1}${isAnswered ? " (đã trả lời)" : ""}${question.isFlagged ? " (đã đánh dấu)" : ""}`}
            className={cn(
              "relative flex size-10 items-center justify-center rounded-xl border text-sm font-semibold transition-colors",
              isAnswered
                ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                : "border-slate-300 bg-white text-slate-600",
              isCurrent && "ring-2 ring-sky-500 ring-offset-1",
            )}
          >
            {index + 1}
            {question.isFlagged ? (
              <span className="absolute right-1 top-1 size-2 rounded-full bg-amber-500" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
