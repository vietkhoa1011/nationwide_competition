"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type {
  ExamDetailDto,
  ExamSummaryDto,
  PaginatedResult,
  SubjectDto,
} from "@/features/exams/types";

/**
 * Dữ liệu của lần render đầu do Server Component nạp sẵn bằng service
 * (`listSubjects`, `listExams`, `getExamById`) rồi truyền xuống qua `initialData`.
 * `staleTime` giữ dữ liệu đó ở trạng thái "mới" trong 30 giây nên lần mount đầu
 * không gọi API lặp lại ngay; khi người dùng đổi bộ lọc, query key đổi nên vẫn
 * fetch bình thường.
 */
const SERVER_DATA_STALE_TIME_MS = 30_000;

export function useSubjects(initialData?: SubjectDto[]) {
  return useQuery({
    queryKey: queryKeys.subjects,
    queryFn: async () => {
      const response = await apiClient.get<{ items: SubjectDto[] }>("/api/subjects");
      return response.items;
    },
    initialData,
    staleTime: SERVER_DATA_STALE_TIME_MS,
  });
}

export interface ExamListFilters {
  search?: string;
  subjectId?: string;
  featured?: "true" | "false";
  page?: number;
  pageSize?: number;
}

export function buildExamQueryString(filters: ExamListFilters): string {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.subjectId) params.set("subjectId", filters.subjectId);
  if (filters.featured) params.set("featured", filters.featured);
  params.set("page", String(filters.page ?? 1));
  params.set("pageSize", String(filters.pageSize ?? 9));
  return params.toString();
}

export function useExams(
  filters: ExamListFilters,
  initialData?: PaginatedResult<ExamSummaryDto>,
) {
  return useQuery({
    queryKey: queryKeys.exams({ ...filters }),
    queryFn: () =>
      apiClient.get<PaginatedResult<ExamSummaryDto>>(
        `/api/exams?${buildExamQueryString(filters)}`,
      ),
    initialData,
    placeholderData: (previous) => previous,
    staleTime: SERVER_DATA_STALE_TIME_MS,
  });
}

export function useExam(examId: string, initialData?: ExamDetailDto) {
  return useQuery({
    queryKey: queryKeys.exam(examId),
    queryFn: () => apiClient.get<ExamDetailDto>(`/api/exams/${examId}`),
    initialData,
    enabled: examId.length > 0,
    staleTime: SERVER_DATA_STALE_TIME_MS,
  });
}
