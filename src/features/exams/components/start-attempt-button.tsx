"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert, Spinner } from "@/components/ui/feedback";
import { useStartAttempt } from "@/features/attempts/hooks/use-attempt";

export function StartAttemptButton({
  examId,
  disabled = false,
  disabledLabel = "Đề thi chưa có câu hỏi",
  label = "Bắt đầu làm bài",
}: {
  examId: string;
  disabled?: boolean;
  disabledLabel?: string;
  label?: string;
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const startMutation = useStartAttempt();

  return (
    <div className="space-y-3">
      <Button
        size="lg"
        disabled={disabled || startMutation.isPending}
        onClick={() => {
          setErrorMessage(null);
          startMutation.mutate(examId, {
            onSuccess: (result) => {
              router.push(`/lam-bai/${result.attemptId}`);
            },
            onError: (error) => {
              setErrorMessage(error.message);
            },
          });
        }}
      >
        {startMutation.isPending ? <Spinner /> : null}
        {disabled ? disabledLabel : label}
      </Button>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}
    </div>
  );
}
