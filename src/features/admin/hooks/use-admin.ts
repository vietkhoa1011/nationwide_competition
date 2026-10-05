"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiClientError, apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import { DEFAULT_ADMIN_PAGE_SIZE } from "@/features/admin/schemas/admin.schemas";
import type {
  AdminTeacherApplicationDto,
  AdminTeacherApplicationListDto,
  AdminUserListDto,
  AdminUserSummaryDto,
} from "@/features/admin/types";

/** Dữ liệu do Server Component nạp sẵn được coi là "mới" trong 30 giây. */
const SERVER_DATA_STALE_TIME_MS = 30_000;

/** Khoá cache gốc của khu vực quản trị, dùng để làm mới mọi bảng sau một thao tác. */
const ADMIN_QUERY_ROOT = "admin";

export interface AdminUserFilters {
  search?: string;
  role?: "STUDENT" | "TEACHER" | "ADMIN";
  status?: "active" | "banned";
  page?: number;
  pageSize?: number;
}

export function buildAdminUserQueryString(filters: AdminUserFilters): string {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  params.set("page", String(filters.page ?? 1));
  params.set("pageSize", String(filters.pageSize ?? DEFAULT_ADMIN_PAGE_SIZE));
  return params.toString();
}

export function useAdminUsers(filters: AdminUserFilters, initialData?: AdminUserListDto) {
  return useQuery<AdminUserListDto, ApiClientError>({
    queryKey: queryKeys.adminUsers({ ...filters }),
    queryFn: () =>
      apiClient.get<AdminUserListDto>(`/api/admin/users?${buildAdminUserQueryString(filters)}`),
    initialData,
    placeholderData: (previous) => previous,
    staleTime: SERVER_DATA_STALE_TIME_MS,
  });
}

export interface AdminApplicationFilters {
  status: "PENDING" | "APPROVED" | "REJECTED";
  page?: number;
  pageSize?: number;
}

export function buildAdminApplicationQueryString(filters: AdminApplicationFilters): string {
  const params = new URLSearchParams();
  params.set("status", filters.status);
  params.set("page", String(filters.page ?? 1));
  params.set("pageSize", String(filters.pageSize ?? DEFAULT_ADMIN_PAGE_SIZE));
  return params.toString();
}

export function useAdminTeacherApplications(
  filters: AdminApplicationFilters,
  initialData?: AdminTeacherApplicationListDto,
) {
  return useQuery<AdminTeacherApplicationListDto, ApiClientError>({
    queryKey: queryKeys.adminTeacherApplications({ ...filters }),
    queryFn: () =>
      apiClient.get<AdminTeacherApplicationListDto>(
        `/api/admin/teacher-applications?${buildAdminApplicationQueryString(filters)}`,
      ),
    initialData,
    placeholderData: (previous) => previous,
    staleTime: SERVER_DATA_STALE_TIME_MS,
  });
}

interface BanUserVariables {
  userId: string;
  banned: boolean;
  reason?: string;
}

/** Khoá/mở khoá tài khoản rồi làm mới mọi bảng quản trị (số liệu liên quan đều đổi). */
export function useSetUserBanState() {
  const queryClient = useQueryClient();

  return useMutation<AdminUserSummaryDto, ApiClientError, BanUserVariables>({
    mutationFn: ({ userId, banned, reason }) =>
      apiClient.post<AdminUserSummaryDto>(
        `/api/admin/users/${userId}/${banned ? "ban" : "unban"}`,
        banned ? { reason } : undefined,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ADMIN_QUERY_ROOT] });
    },
  });
}

interface ReviewApplicationVariables {
  applicationId: string;
  decision: "APPROVED" | "REJECTED";
  note?: string;
}

export function useReviewTeacherApplication() {
  const queryClient = useQueryClient();

  return useMutation<AdminTeacherApplicationDto, ApiClientError, ReviewApplicationVariables>({
    mutationFn: ({ applicationId, decision, note }) =>
      apiClient.post<AdminTeacherApplicationDto>(
        `/api/admin/teacher-applications/${applicationId}/${decision === "APPROVED" ? "approve" : "reject"}`,
        { note },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ADMIN_QUERY_ROOT] });
    },
  });
}
