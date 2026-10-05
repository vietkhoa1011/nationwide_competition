"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiClientError, apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type {
  AttemptResultDto,
  SaveAnswerResultDto,
  SetProgressResultDto,
  StartAttemptResultDto,
  StudentAttemptDto,
  StudentQuestionDto,
  ToggleFlagResultDto,
} from "@/features/attempts/types";

function recalcCounts(
  questions: StudentQuestionDto[],
): StudentAttemptDto["counts"] {
  return {
    total: questions.length,
    answered: questions.filter((question) => question.selectedOptionId !== null).length,
    flagged: questions.filter((question) => question.isFlagged).length,
  };
}

function patchQuestion(
  attempt: StudentAttemptDto,
  questionId: string,
  patch: Partial<Pick<StudentQuestionDto, "selectedOptionId" | "isFlagged">>,
): StudentAttemptDto {
  const questions = attempt.questions.map((question) =>
    question.questionId === questionId ? { ...question, ...patch } : question,
  );
  return { ...attempt, questions, counts: recalcCounts(questions) };
}

interface OptimisticContext {
  previous?: StudentAttemptDto;
}

export function useStartAttempt() {
  return useMutation<StartAttemptResultDto, ApiClientError, string>({
    mutationFn: (examId) => apiClient.post<StartAttemptResultDto>("/api/attempts", { examId }),
  });
}

export function useCurrentAttempt(attemptId: string) {
  return useQuery<StudentAttemptDto, ApiClientError>({
    queryKey: queryKeys.attempt(attemptId),
    queryFn: () => apiClient.get<StudentAttemptDto>(`/api/attempts/${attemptId}`),
    enabled: attemptId.length > 0,
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
}

export function useSaveAnswer(attemptId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.attempt(attemptId);

  return useMutation<
    SaveAnswerResultDto,
    ApiClientError,
    { questionId: string; optionId: string | null },
    OptimisticContext
  >({
    mutationFn: (variables) =>
      apiClient.put<SaveAnswerResultDto>(`/api/attempts/${attemptId}/answers`, variables),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<StudentAttemptDto>(key);
      if (previous) {
        queryClient.setQueryData<StudentAttemptDto>(
          key,
          patchQuestion(previous, variables.questionId, {
            selectedOptionId: variables.optionId,
          }),
        );
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
      // Trạng thái phía server đã đổi (hết hạn hoặc đã nộp): đồng bộ lại từ server.
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useToggleFlag(attemptId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.attempt(attemptId);

  return useMutation<
    ToggleFlagResultDto,
    ApiClientError,
    { questionId: string; isFlagged: boolean },
    OptimisticContext
  >({
    mutationFn: (variables) =>
      apiClient.post<ToggleFlagResultDto>(`/api/attempts/${attemptId}/flag`, variables),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<StudentAttemptDto>(key);
      if (previous) {
        queryClient.setQueryData<StudentAttemptDto>(
          key,
          patchQuestion(previous, variables.questionId, { isFlagged: variables.isFlagged }),
        );
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
    },
  });
}

export function useSetProgress(attemptId: string) {
  return useMutation<SetProgressResultDto, ApiClientError, number>({
    mutationFn: (lastQuestionPosition) =>
      apiClient.post<SetProgressResultDto>(`/api/attempts/${attemptId}/progress`, {
        lastQuestionPosition,
      }),
  });
}

export function useSubmitAttempt(attemptId: string) {
  const queryClient = useQueryClient();

  return useMutation<AttemptResultDto, ApiClientError, void>({
    mutationFn: () => apiClient.post<AttemptResultDto>(`/api/attempts/${attemptId}/submit`),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.result(attemptId), result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.attempt(attemptId) });
    },
  });
}

export function useAttemptResult(attemptId: string) {
  return useQuery<AttemptResultDto, ApiClientError>({
    queryKey: queryKeys.result(attemptId),
    queryFn: () => apiClient.get<AttemptResultDto>(`/api/attempts/${attemptId}/result`),
    enabled: attemptId.length > 0,
    retry: false,
  });
}
