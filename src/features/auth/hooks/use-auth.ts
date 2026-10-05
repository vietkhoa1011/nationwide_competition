"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { ApiClientError, apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type { LoginBody, RegisterBody } from "@/features/auth/schemas/auth.schemas";
import type { AuthResultDto, AuthSessionDto } from "@/features/auth/types";

/** Trạng thái khách ẩn danh: dùng khi đăng xuất để giao diện cập nhật ngay lập tức. */
const ANONYMOUS_SESSION: AuthSessionDto = { user: null };

/**
 * Xoá mọi dữ liệu phụ thuộc danh tính (lượt làm bài, kết quả, đề thi…) khi phiên đổi chủ.
 * Nếu không dọn, người dùng kế tiếp trên cùng trình duyệt có thể thấy dữ liệu của tài khoản trước
 * cho tới khi cache hết hạn.
 */
function clearIdentityScopedCache(queryClient: QueryClient): void {
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== queryKeys.session[0],
  });
}

/** Phiên đăng nhập hiện tại. Server là nguồn sự thật duy nhất, client chỉ hiển thị lại. */
export function useSession() {
  return useQuery<AuthSessionDto, ApiClientError>({
    queryKey: queryKeys.session,
    queryFn: () => apiClient.get<AuthSessionDto>("/api/me"),
    staleTime: 60_000,
  });
}

/**
 * Góc nhìn tiện dụng cho giao diện: người dùng hiện tại (null nếu là khách) và cờ
 * cho biết tài khoản có đang bị khoá hay không (server trả 403 `ACCOUNT_LOCKED`).
 */
export function useAuth() {
  const sessionQuery = useSession();
  const locked = sessionQuery.error?.code === "ACCOUNT_LOCKED";

  return {
    user: sessionQuery.data?.user ?? null,
    isLoading: sessionQuery.isPending,
    locked,
    error: sessionQuery.error ?? null,
  };
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation<AuthResultDto, ApiClientError, LoginBody>({
    mutationFn: (body) => apiClient.post<AuthResultDto>("/api/auth/login", body),
    onSuccess: (result) => {
      queryClient.setQueryData<AuthSessionDto>(queryKeys.session, { user: result.user });
      clearIdentityScopedCache(queryClient);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation<AuthResultDto, ApiClientError, RegisterBody>({
    mutationFn: (body) => apiClient.post<AuthResultDto>("/api/auth/register", body),
    onSuccess: (result) => {
      queryClient.setQueryData<AuthSessionDto>(queryKeys.session, { user: result.user });
      clearIdentityScopedCache(queryClient);
    },
  });
}

/** Đăng xuất. Server xoá phiên trong database và cookie, client dọn sạch cache. */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiClientError, void>({
    mutationFn: () => apiClient.post<void>("/api/auth/logout"),
    onSuccess: () => {
      clearIdentityScopedCache(queryClient);
      queryClient.setQueryData<AuthSessionDto>(queryKeys.session, ANONYMOUS_SESSION);
    },
  });
}
