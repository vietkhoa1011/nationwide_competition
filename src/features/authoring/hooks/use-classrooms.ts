"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiClientError, apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type {
  ClassroomDetailDto,
  ClassroomDto,
  ClassroomMemberDto,
  ExamAssignmentDto,
  StudentClassroomDto,
} from "@/features/authoring/types";

const SERVER_DATA_STALE_TIME_MS = 30_000;

export function useClassrooms(
  params: { all?: "1"; search?: string } = {},
  initialData?: { items: ClassroomDto[] },
) {
  const search = new URLSearchParams();
  if (params.all) search.set("all", params.all);
  if (params.search?.trim()) search.set("search", params.search.trim());

  return useQuery<{ items: ClassroomDto[] }, ApiClientError>({
    queryKey: queryKeys.classrooms({ ...params }),
    queryFn: () => apiClient.get<{ items: ClassroomDto[] }>(`/api/classrooms?${search.toString()}`),
    initialData,
    placeholderData: (previous) => previous,
    staleTime: SERVER_DATA_STALE_TIME_MS,
  });
}

export function useClassroom(classroomId: string, initialData?: ClassroomDetailDto) {
  return useQuery<ClassroomDetailDto, ApiClientError>({
    queryKey: queryKeys.classroom(classroomId),
    queryFn: () => apiClient.get<ClassroomDetailDto>(`/api/classrooms/${classroomId}`),
    initialData,
    enabled: classroomId.length > 0,
    staleTime: SERVER_DATA_STALE_TIME_MS,
  });
}

export function useCreateClassroom() {
  const queryClient = useQueryClient();

  return useMutation<ClassroomDetailDto, ApiClientError, Record<string, unknown>>({
    mutationFn: (payload) => apiClient.post<ClassroomDetailDto>("/api/classrooms", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["classrooms"] });
    },
  });
}

export function useAddClassroomMember(classroomId: string) {
  const queryClient = useQueryClient();

  return useMutation<ClassroomMemberDto, ApiClientError, { email: string; role: "STUDENT" | "TEACHER" }>(
    {
      mutationFn: (payload) =>
        apiClient.post<ClassroomMemberDto>(`/api/classrooms/${classroomId}/members`, payload),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.classroom(classroomId) });
        void queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      },
    },
  );
}

export function useRemoveClassroomMember(classroomId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ removedMemberId: string }, ApiClientError, { memberId: string }>({
    mutationFn: ({ memberId }) =>
      apiClient.delete<{ removedMemberId: string }>(
        `/api/classrooms/${classroomId}/members/${memberId}`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.classroom(classroomId) });
    },
  });
}

export function useClassroomAssignments(classroomId: string, initialData?: ExamAssignmentDto[]) {
  return useQuery<ExamAssignmentDto[], ApiClientError>({
    queryKey: queryKeys.classroomAssignments(classroomId),
    queryFn: async () => {
      const response = await apiClient.get<{ items: ExamAssignmentDto[] }>(
        `/api/classrooms/${classroomId}/assignments`,
      );
      return response.items;
    },
    initialData,
    enabled: classroomId.length > 0,
    staleTime: SERVER_DATA_STALE_TIME_MS,
  });
}

export interface AssignmentPayload {
  examId: string;
  title?: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
  durationMinutes?: number | null;
  allowedAttempts?: number | null;
  revealAnswersAt?: string | null;
}

/** Giao đề cho lớp (tạo mới hoặc cập nhật cấu hình giao đề đã có). */
export function useSaveAssignment(classroomId: string) {
  const queryClient = useQueryClient();

  return useMutation<ExamAssignmentDto, ApiClientError, AssignmentPayload>({
    mutationFn: (payload) =>
      apiClient.post<ExamAssignmentDto>(`/api/classrooms/${classroomId}/assignments`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.classroomAssignments(classroomId) });
    },
  });
}

export function useDeleteAssignment(classroomId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ removedAssignmentId: string }, ApiClientError, { assignmentId: string }>({
    mutationFn: ({ assignmentId }) =>
      apiClient.delete<{ removedAssignmentId: string }>(`/api/assignments/${assignmentId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.classroomAssignments(classroomId) });
    },
  });
}

/** Lớp học và đề đã giao nhìn từ phía học sinh. */
export function useMyClassrooms(initialData?: { items: StudentClassroomDto[] }) {
  return useQuery<{ items: StudentClassroomDto[] }, ApiClientError>({
    queryKey: queryKeys.myClassrooms,
    queryFn: () => apiClient.get<{ items: StudentClassroomDto[] }>("/api/my/classrooms"),
    initialData,
    staleTime: SERVER_DATA_STALE_TIME_MS,
  });
}
