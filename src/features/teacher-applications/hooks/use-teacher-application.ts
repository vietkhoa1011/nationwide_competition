"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiClientError, apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type { TeacherApplicationBody } from "@/features/teacher-applications/schemas/teacher-application.schemas";
import type {
  MyTeacherApplicationDto,
  TeacherApplicationDto,
} from "@/features/teacher-applications/types";

/** Dữ liệu do Server Component nạp sẵn được coi là "mới" trong 30 giây. */
const SERVER_DATA_STALE_TIME_MS = 30_000;

export function useMyTeacherApplication(initialData?: MyTeacherApplicationDto) {
  return useQuery<MyTeacherApplicationDto, ApiClientError>({
    queryKey: queryKeys.myTeacherApplication,
    queryFn: () => apiClient.get<MyTeacherApplicationDto>("/api/teacher-applications"),
    initialData,
    staleTime: SERVER_DATA_STALE_TIME_MS,
  });
}

export function useSubmitTeacherApplication() {
  const queryClient = useQueryClient();

  return useMutation<TeacherApplicationDto, ApiClientError, TeacherApplicationBody>({
    mutationFn: (body) =>
      apiClient.post<TeacherApplicationDto>("/api/teacher-applications", body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.myTeacherApplication });
    },
  });
}
