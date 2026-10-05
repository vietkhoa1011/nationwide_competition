"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Alert, ErrorBlock, LoadingBlock, Spinner } from "@/components/ui/feedback";
import { AttemptTimer } from "@/features/attempts/components/attempt-timer";
import { QuestionNavigator } from "@/features/attempts/components/question-navigator";
import { QuestionPanel, type SaveState } from "@/features/attempts/components/question-panel";
import {
  useCurrentAttempt,
  useSaveAnswer,
  useSetProgress,
  useSubmitAttempt,
  useToggleFlag,
} from "@/features/attempts/hooks/use-attempt";
import type { StudentAttemptDto } from "@/features/attempts/types";

/**
 * Trang làm bài. Server là nguồn quyết định duy nhất về thời gian và đáp án đúng;
 * phía client chỉ hiển thị đồng hồ đếm ngược và gửi lựa chọn lên.
 */
export function AttemptRunner({ attemptId }: { attemptId: string }) {
  const attemptQuery = useCurrentAttempt(attemptId);

  if (attemptQuery.isPending) {
    return <LoadingBlock message="Đang tải bài làm…" />;
  }

  if (attemptQuery.isError) {
    return (
      <ErrorBlock
        error={attemptQuery.error}
        title="Không tải được bài làm"
        onRetry={() => void attemptQuery.refetch()}
      />
    );
  }

  const attempt = attemptQuery.data;
  if (!attempt) {
    return null;
  }

  if (attempt.status !== "IN_PROGRESS") {
    return <AttemptFinishedNotice attemptId={attemptId} />;
  }

  return <AttemptSession attempt={attempt} />;
}

function AttemptFinishedNotice({ attemptId }: { attemptId: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/ket-qua/${attemptId}`);
  }, [attemptId, router]);

  return (
    <Alert tone="info" title="Bài làm đã kết thúc">
      Đang chuyển tới trang kết quả…
    </Alert>
  );
}

function SubmitConfirmDialog({
  answeredCount,
  totalCount,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  answeredCount: number;
  totalCount: number;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const unanswered = totalCount - answeredCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-dialog-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 id="submit-dialog-title" className="text-lg font-bold text-slate-900">
          Nộp bài?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {`Bạn đã trả lời ${answeredCount}/${totalCount} câu.`}
          {unanswered > 0 ? ` Còn ${unanswered} câu chưa trả lời.` : ""}
          {" Sau khi nộp, bạn không thể sửa đáp án nữa."}
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Tiếp tục làm bài
          </Button>
          <Button variant="success" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : null}
            Nộp bài
          </Button>
        </div>
      </div>
    </div>
  );
}

function AttemptSession({ attempt }: { attempt: StudentAttemptDto }) {
  const router = useRouter();
  const saveAnswerMutation = useSaveAnswer(attempt.id);
  const toggleFlagMutation = useToggleFlag(attempt.id);
  const setProgressMutation = useSetProgress(attempt.id);
  const submitMutation = useSubmitAttempt(attempt.id);

  const { questions } = attempt;
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.min(Math.max(0, questions.length - 1), Math.max(0, attempt.lastQuestionPosition - 1)),
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Mốc hết giờ lấy theo chênh lệch expiresAt - serverTime nên đồng hồ máy khách
  // có lệch giờ cũng không ảnh hưởng tới thời gian làm bài thực tế.
  const [deadline] = useState(
    () => Date.now() + Math.max(0, Date.parse(attempt.expiresAt) - Date.parse(attempt.serverTime)),
  );
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, deadline - Date.now()));

  useEffect(() => {
    const tick = () => setRemainingMs(Math.max(0, deadline - Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  const goToResult = useCallback(() => {
    router.replace(`/ket-qua/${attempt.id}`);
  }, [attempt.id, router]);

  const submitMutationRef = useRef(submitMutation.mutate);
  useEffect(() => {
    submitMutationRef.current = submitMutation.mutate;
  }, [submitMutation.mutate]);

  // Hết giờ: tự động nộp (chỉ chạy một lần; việc chấm điểm vẫn do server quyết định).
  const hasAutoSubmitted = useRef(false);
  useEffect(() => {
    if (remainingMs > 0 || hasAutoSubmitted.current) return;
    hasAutoSubmitted.current = true;
    setErrorMessage(null);
    submitMutationRef.current(undefined, {
      onSuccess: goToResult,
      onError: () => goToResult(),
    });
  }, [remainingMs, goToResult]);

  if (questions.length === 0) {
    return (
      <Alert tone="warning" title="Đề thi chưa có câu hỏi">
        Không thể làm bài với đề thi này.
      </Alert>
    );
  }

  const currentQuestion = questions[currentIndex];

  function goToIndex(nextIndex: number) {
    const safeIndex = Math.min(questions.length - 1, Math.max(0, nextIndex));
    setCurrentIndex(safeIndex);
    const question = questions[safeIndex];
    if (question && question.position !== attempt.lastQuestionPosition) {
      setProgressMutation.mutate(question.position);
    }
  }

  function handleSelectOption(optionId: string | null) {
    if (!currentQuestion) return;
    setErrorMessage(null);
    setSaveState("saving");
    saveAnswerMutation.mutate(
      { questionId: currentQuestion.questionId, optionId },
      {
        onSuccess: () => setSaveState("saved"),
        onError: (error) => {
          setSaveState("error");
          setErrorMessage(error.message);
        },
      },
    );
  }

  function handleToggleFlag() {
    if (!currentQuestion) return;
    toggleFlagMutation.mutate(
      { questionId: currentQuestion.questionId, isFlagged: !currentQuestion.isFlagged },
      { onError: (error) => setErrorMessage(error.message) },
    );
  }

  function handleSubmit() {
    setIsConfirming(false);
    setErrorMessage(null);
    submitMutation.mutate(undefined, {
      onSuccess: goToResult,
      onError: (error) => setErrorMessage(error.message),
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-400">Đang làm bài</p>
            <h1 className="truncate text-lg font-bold text-slate-900">{attempt.examTitle}</h1>
            <p className="mt-1 text-xs text-slate-500">
              {`Đã trả lời ${attempt.counts.answered}/${attempt.counts.total} câu · Đánh dấu ${attempt.counts.flagged} câu`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <AttemptTimer remainingMs={remainingMs} />
            <Button
              variant="success"
              onClick={() => setIsConfirming(true)}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? <Spinner /> : null}
              Nộp bài
            </Button>
          </div>
        </CardBody>
      </Card>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      {isConfirming ? (
        <SubmitConfirmDialog
          answeredCount={attempt.counts.answered}
          totalCount={attempt.counts.total}
          isSubmitting={submitMutation.isPending}
          onCancel={() => setIsConfirming(false)}
          onConfirm={handleSubmit}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card>
          <CardBody className="space-y-5">
            {currentQuestion ? (
              <QuestionPanel
                question={currentQuestion}
                index={currentIndex}
                total={questions.length}
                saveState={saveState}
                onSelectOption={handleSelectOption}
                onToggleFlag={handleToggleFlag}
              />
            ) : null}

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <Button
                variant="secondary"
                disabled={currentIndex === 0}
                onClick={() => goToIndex(currentIndex - 1)}
              >
                ← Câu trước
              </Button>
              <Button
                disabled={currentIndex >= questions.length - 1}
                onClick={() => goToIndex(currentIndex + 1)}
              >
                Câu sau →
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card className="h-fit lg:sticky lg:top-4">
          <CardBody className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Danh sách câu hỏi</h2>
            <QuestionNavigator
              questions={questions}
              currentIndex={currentIndex}
              onSelect={goToIndex}
            />
            <ul className="space-y-1 pt-1 text-xs text-slate-500">
              <li>
                <span className="mr-2 inline-block size-3 rounded bg-emerald-200 align-middle" />
                Đã trả lời
              </li>
              <li>
                <span className="mr-2 inline-block size-3 rounded border border-slate-300 bg-white align-middle" />
                Chưa trả lời
              </li>
              <li>
                <span className="mr-2 inline-block size-3 rounded bg-amber-500 align-middle" />
                Đã đánh dấu xem lại
              </li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

