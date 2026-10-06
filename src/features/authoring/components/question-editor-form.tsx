"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { emptyRichDoc, type RichDoc } from "@/features/authoring/services/rich-content-core";
import { useUpdateQuestion } from "@/features/authoring/hooks/use-authoring";
import type { AuthoringQuestionDto } from "@/features/authoring/types";
import { RichTextEditor } from "@/features/content/components/rich-text-editor";
import { ApiClientError } from "@/lib/api-client";

/** Trạng thái lưu của câu hỏi đang soạn (hiển thị trên thanh hành động). */
export type QuestionSaveState = "idle" | "dirty" | "saving" | "saved" | "error";

interface OptionDraft {
  id?: string;
  contentDoc: RichDoc;
  isCorrect: boolean;
}

const AUTOSAVE_DELAY_MS = 1200;

/**
 * Khối soạn một câu hỏi: nội dung, phương án (nhãn A/B/C/D theo thứ tự hiển thị), đáp án
 * đúng tham chiếu theo ID phương án, điểm và lời giải.
 *
 * Autosave chạy 1,2 giây sau lần thay đổi cuối. Khi request lỗi, bản đang nhập được giữ
 * nguyên và có nút thử lại; kết quả của request cũ không bao giờ ghi đè bản mới hơn (mỗi
 * lần lưu mang một số thứ tự riêng).
 */
export function QuestionEditorForm({
  examId,
  question,
  disabled,
  onSaved,
  onSaveStateChange,
}: {
  examId: string;
  question: AuthoringQuestionDto;
  disabled: boolean;
  onSaved: (question: AuthoringQuestionDto) => void;
  onSaveStateChange: (state: QuestionSaveState) => void;
}) {
  const updateQuestion = useUpdateQuestion(examId);

  const [contentDoc, setContentDoc] = useState<RichDoc>(question.contentDoc ?? emptyRichDoc());
  const [explanationDoc, setExplanationDoc] = useState<RichDoc>(
    question.explanationDoc ?? emptyRichDoc(),
  );
  const [options, setOptions] = useState<OptionDraft[]>(() =>
    question.options.map((option) => ({
      id: option.id,
      contentDoc: option.contentDoc ?? emptyRichDoc(),
      isCorrect: option.isCorrect,
    })),
  );
  const [points, setPoints] = useState(String(question.points));
  const [level, setLevel] = useState(question.level);
  const [type, setType] = useState(question.type);
  const [saveState, setSaveState] = useState<QuestionSaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dirtyRef = useRef(false);
  const sequenceRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reportState = useCallback(
    (state: QuestionSaveState) => {
      setSaveState(state);
      onSaveStateChange(state);
    },
    [onSaveStateChange],
  );

  const save = useCallback(async () => {
    const sequence = (sequenceRef.current += 1);
    reportState("saving");
    setErrorMessage(null);

    try {
      const saved = await updateQuestion.mutateAsync({
        questionId: question.id,
        question: {
          type,
          level,
          points: Number(points),
          contentDoc,
          explanationDoc,
          options: options.map((option) => ({
            ...(option.id ? { id: option.id } : {}),
            contentDoc: option.contentDoc,
            isCorrect: option.isCorrect,
          })),
        },
      });

      // Chỉ báo "đã lưu" khi không có thay đổi mới hơn trong lúc chờ máy chủ.
      if (sequence === sequenceRef.current) {
        dirtyRef.current = false;
        onSaved(saved);
        reportState("saved");
      }
    } catch (error) {
      if (sequence === sequenceRef.current) {
        setErrorMessage(
          error instanceof ApiClientError
            ? error.message
            : "Không lưu được câu hỏi. Vui lòng thử lại.",
        );
        reportState("error");
      }
    }
  }, [
    contentDoc,
    explanationDoc,
    level,
    onSaved,
    options,
    points,
    question.id,
    reportState,
    type,
    updateQuestion,
  ]);

  /** Ghi nhận thay đổi rồi hẹn autosave sau khi người dùng ngừng nhập. */
  const markDirty = useCallback(() => {
    if (disabled) {
      return;
    }
    dirtyRef.current = true;
    reportState("dirty");
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (dirtyRef.current) {
        void save();
      }
    }, AUTOSAVE_DELAY_MS);
  }, [disabled, reportState, save]);

  // Cảnh báo trình duyệt khi rời trang lúc còn thay đổi chưa lưu thành công.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const updateOption = (index: number, patch: Partial<OptionDraft>) => {
    setOptions((previous) =>
      previous.map((option, position) => (position === index ? { ...option, ...patch } : option)),
    );
    markDirty();
  };

  const moveOption = (index: number, direction: -1 | 1) => {
    setOptions((previous) => {
      const target = index + direction;
      if (target < 0 || target >= previous.length) {
        return previous;
      }
      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    markDirty();
  };

  const saveStateLabel: Record<QuestionSaveState, string> = {
    idle: "Chưa có thay đổi",
    dirty: "Đang chờ lưu…",
    saving: "Đang lưu…",
    saved: "Đã lưu",
    error: "Lưu thất bại",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold text-slate-700">{`Câu ${question.position}`}</span>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          Loại câu
          <select
            value={type}
            disabled={disabled}
            onChange={(event) => {
              setType(event.target.value as typeof type);
              markDirty();
            }}
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="SINGLE_CHOICE">Trắc nghiệm một đáp án đúng</option>
            <option value="TRUE_FALSE" disabled>
              Đúng/sai theo từng ý (chưa hỗ trợ làm bài)
            </option>
            <option value="SHORT_ANSWER" disabled>
              Trả lời ngắn (chưa hỗ trợ chấm điểm)
            </option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          Độ khó
          <select
            value={level}
            disabled={disabled}
            onChange={(event) => {
              setLevel(event.target.value as typeof level);
              markDirty();
            }}
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="EASY">Dễ</option>
            <option value="MEDIUM">Trung bình</option>
            <option value="HARD">Khó</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          Điểm
          <input
            type="number"
            min={0.25}
            max={100}
            step={0.25}
            value={points}
            disabled={disabled}
            onChange={(event) => {
              setPoints(event.target.value);
              markDirty();
            }}
            className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs"
          />
        </label>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Nội dung câu hỏi
        </label>
        {/* Ô soạn câu hỏi cao hơn các ô khác: đây là vùng giáo viên làm việc nhiều nhất. */}
        <RichTextEditor
          key={`content-${question.id}`}
          examId={examId}
          value={contentDoc}
          disabled={disabled}
          ariaLabel={`Nội dung câu ${question.position}`}
          className="[&_.rich-editor]:min-h-[13rem]"
          onChange={(doc) => {
            setContentDoc(doc);
            markDirty();
          }}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Phương án trả lời (nhãn A/B/C/D theo thứ tự hiển thị)
          </p>
          <button
            type="button"
            disabled={disabled || options.length >= 8}
            onClick={() => {
              setOptions((previous) => [
                ...previous,
                { contentDoc: emptyRichDoc(), isCorrect: false },
              ]);
              markDirty();
            }}
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          >
            + Thêm phương án
          </button>
        </div>

        {options.map((option, index) => (
          <div
            key={option.id ?? `new-${index}`}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5"
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-3">
              <span className="flex size-6 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-600 ring-1 ring-slate-300">
                {String.fromCharCode("A".charCodeAt(0) + index)}
              </span>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <input
                  type="radio"
                  name={`correct-${question.id}`}
                  checked={option.isCorrect}
                  disabled={disabled}
                  // Đáp án đúng tham chiếu theo ID phương án, không theo vị trí A/B/C/D.
                  onChange={() => {
                    setOptions((previous) =>
                      previous.map((item, position) => ({
                        ...item,
                        isCorrect: position === index,
                      })),
                    );
                    markDirty();
                  }}
                />
                Đáp án đúng
              </label>
              <div className="ml-auto flex gap-1">
                <button
                  type="button"
                  title="Đưa phương án lên"
                  disabled={disabled || index === 0}
                  onClick={() => moveOption(index, -1)}
                  className="rounded-md px-1.5 py-0.5 text-xs text-slate-500 hover:bg-white disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  title="Đưa phương án xuống"
                  disabled={disabled || index === options.length - 1}
                  onClick={() => moveOption(index, 1)}
                  className="rounded-md px-1.5 py-0.5 text-xs text-slate-500 hover:bg-white disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={disabled || options.length <= 2}
                  onClick={() => {
                    setOptions((previous) => previous.filter((_, position) => position !== index));
                    markDirty();
                  }}
                  className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-rose-600 hover:bg-white disabled:opacity-40"
                >
                  Xoá
                </button>
              </div>
            </div>

            <RichTextEditor
              key={`option-${option.id ?? index}`}
              examId={examId}
              value={option.contentDoc}
              disabled={disabled}
              ariaLabel={`Phương án ${String.fromCharCode("A".charCodeAt(0) + index)}`}
              className="border-slate-300 bg-white"
              onChange={(doc) => updateOption(index, { contentDoc: doc })}
            />
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Lời giải / giải thích
        </label>
        <RichTextEditor
          key={`explanation-${question.id}`}
          examId={examId}
          value={explanationDoc}
          disabled={disabled}
          ariaLabel={`Lời giải câu ${question.position}`}
          className="[&_.rich-editor]:min-h-[9rem]"
          onChange={(doc) => {
            setExplanationDoc(doc);
            markDirty();
          }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
        <p
          className={
            saveState === "error"
              ? "text-xs font-semibold text-rose-600"
              : saveState === "saved"
                ? "text-xs font-semibold text-emerald-600"
                : "text-xs text-slate-500"
          }
        >
          {saveState === "saving" ? "Đang lưu câu hỏi… " : ""}
          {errorMessage ?? saveStateLabel[saveState]}
        </p>

        <div className="flex items-center gap-2">
          {saveState === "error" ? (
            <button
              type="button"
              onClick={() => void save()}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
            >
              Thử lưu lại
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled || saveState === "saving"}
            onClick={() => void save()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            Lưu câu này
          </button>
        </div>
      </div>
    </div>
  );
}
