"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiClientError, apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type {
  AuthoringExamDetailDto,
  AuthoringExamListDto,
  AuthoringExamSummaryDto,
  AuthoringQuestionDto,
  ValidationReportDto,
} from "@/features/authoring/types";

/** Dữ liệu Server Component nạp sẵn được coi là "mới" trong 30 giây. */
const SERVER_DATA_STALE_TIME_MS = 30_000;

const AUTHORING_ROOT = "authoring";

export interface AuthoringExamFilters {
  search?: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  scope?: "PUBLIC" | "CLASS";
  classroomId?: string;
  page?: number;
  pageSize?: number;
}

export function buildAuthoringExamQueryString(filters: AuthoringExamFilters): string {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.scope) params.set("scope", filters.scope);
  if (filters.classroomId) params.set("classroomId", filters.classroomId);
  params.set("page", String(filters.page ?? 1));
  params.set("pageSize", String(filters.pageSize ?? 10));
  return params.toString();
}

export function useAuthoringExams(
  filters: AuthoringExamFilters,
  initialData?: AuthoringExamListDto,
) {
  return useQuery<AuthoringExamListDto, ApiClientError>({
    queryKey: queryKeys.authoringExams({ ...filters }),
    queryFn: () =>
      apiClient.get<AuthoringExamListDto>(
        `/api/authoring/exams?${buildAuthoringExamQueryString(filters)}`,
      ),
    initialData,
    placeholderData: (previous) => previous,
    staleTime: SERVER_DATA_STALE_TIME_MS,
  });
}

export function useAuthoringExam(examId: string, initialData?: AuthoringExamDetailDto) {
  return useQuery<AuthoringExamDetailDto, ApiClientError>({
    queryKey: queryKeys.authoringExam(examId),
    queryFn: () => apiClient.get<AuthoringExamDetailDto>(`/api/authoring/exams/${examId}`),
    initialData,
    enabled: examId.length > 0,
    staleTime: SERVER_DATA_STALE_TIME_MS,
  });
}

export interface ExamInfoPayload {
  revision?: number;
  title?: string;
  subjectId?: string;
  durationMinutes?: number;
  description?: string | null;
  gradeLevel?: number | null;
  year?: number | null;
  scope?: "PUBLIC" | "CLASS";
  classroomId?: string | null;
  instructionsDoc?: unknown;
}

/** Lưu nháp thông tin đề (bước 1 và thiết lập giao đề). */
export function useUpdateExamInfo(examId: string) {
  const queryClient = useQueryClient();

  return useMutation<AuthoringExamDetailDto, ApiClientError, ExamInfoPayload>({
    mutationFn: (payload) =>
      apiClient.patch<AuthoringExamDetailDto>(`/api/authoring/exams/${examId}`, payload),
    onSuccess: (exam) => {
      queryClient.setQueryData(queryKeys.authoringExam(examId), exam);
      void queryClient.invalidateQueries({ queryKey: [AUTHORING_ROOT, "exams"] });
    },
  });
}

export function useAddQuestion(examId: string) {
  const queryClient = useQueryClient();

  return useMutation<AuthoringQuestionDto, ApiClientError, { question: Record<string, unknown> }>({
    mutationFn: ({ question }) =>
      apiClient.post<AuthoringQuestionDto>(`/api/authoring/exams/${examId}/questions`, question),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.authoringExam(examId) });
    },
  });
}

export function useUpdateQuestion(examId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    AuthoringQuestionDto,
    ApiClientError,
    { questionId: string; question: Record<string, unknown> }
  >({
    mutationFn: ({ questionId, question }) =>
      apiClient.patch<AuthoringQuestionDto>(
        `/api/authoring/exams/${examId}/questions/${questionId}`,
        question,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.authoringExam(examId) });
    },
  });
}

export function useDeleteQuestion(examId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ questionCount: number }, ApiClientError, { questionId: string }>({
    mutationFn: ({ questionId }) =>
      apiClient.delete<{ questionCount: number }>(
        `/api/authoring/exams/${examId}/questions/${questionId}`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.authoringExam(examId) });
    },
  });
}

export function useDuplicateQuestion(examId: string) {
  const queryClient = useQueryClient();

  return useMutation<AuthoringQuestionDto, ApiClientError, { questionId: string }>({
    mutationFn: ({ questionId }) =>
      apiClient.post<AuthoringQuestionDto>(
        `/api/authoring/exams/${examId}/questions/${questionId}/duplicate`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.authoringExam(examId) });
    },
  });
}

export function useReorderQuestions(examId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ questions: AuthoringQuestionDto[] }, ApiClientError, string[]>({
    mutationFn: (questionIds) =>
      apiClient.put<{ questions: AuthoringQuestionDto[] }>(
        `/api/authoring/exams/${examId}/questions/order`,
        { questionIds },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.authoringExam(examId) });
    },
  });
}

/** "Kiểm tra đề" — máy chủ chạy lại toàn bộ luật kiểm tra và trả danh sách lỗi/cảnh báo. */
export function useValidateExam(examId: string) {
  return useMutation<ValidationReportDto, ApiClientError, void>({
    mutationFn: () =>
      apiClient.post<ValidationReportDto>(`/api/authoring/exams/${examId}/validate`),
  });
}

export function useExamLifecycle(examId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    AuthoringExamSummaryDto,
    ApiClientError,
    { action: "publish" | "unpublish" | "archive"; revision?: number }
  >({
    mutationFn: (payload) =>
      apiClient.post<AuthoringExamSummaryDto>(`/api/authoring/exams/${examId}/lifecycle`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.authoringExam(examId) });
      void queryClient.invalidateQueries({ queryKey: [AUTHORING_ROOT, "exams"] });
    },
  });
}

/**
 * "Tạo bản sao để chỉnh sửa": đề đã phát sinh lượt làm bài bị khoá nội dung, nên thao tác
 * này sinh một bản nháp mới sao chép toàn bộ câu hỏi để sửa tiếp.
 */
export function useDuplicateExam() {
  const queryClient = useQueryClient();

  return useMutation<AuthoringExamDetailDto, ApiClientError, { examId: string; title?: string }>({
    mutationFn: ({ examId, title }) =>
      apiClient.post<AuthoringExamDetailDto>(`/api/authoring/exams/${examId}/duplicate`, { title }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [AUTHORING_ROOT, "exams"] });
    },
  });
}

/** Tạo đề nháp mới (bước 1 của luồng tạo đề). */
export function useCreateExam() {
  const queryClient = useQueryClient();

  return useMutation<AuthoringExamDetailDto, ApiClientError, Record<string, unknown>>({
    mutationFn: (payload) => apiClient.post<AuthoringExamDetailDto>("/api/authoring/exams", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [AUTHORING_ROOT, "exams"] });
    },
  });
}
