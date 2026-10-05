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

export function useSubjects() {
  return useQuery({
    queryKey: queryKeys.subjects,
    queryFn: async () => {
      const response = await apiClient.get<{ items: SubjectDto[] }>("/api/subjects");
      return response.items;
    },
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

export function useExams(filters: ExamListFilters) {
  return useQuery({
    queryKey: queryKeys.exams({ ...filters }),
    queryFn: () =>
      apiClient.get<PaginatedResult<ExamSummaryDto>>(
        `/api/exams?${buildExamQueryString(filters)}`,
      ),
    placeholderData: (previous) => previous,
  });
}

export function useExam(examId: string) {
  return useQuery({
    queryKey: queryKeys.exam(examId),
    queryFn: () => apiClient.get<ExamDetailDto>(`/api/exams/${examId}`),
    enabled: examId.length > 0,
  });
}
