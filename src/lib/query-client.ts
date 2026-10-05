import { QueryClient } from "@tanstack/react-query";

/**
 * Cấu hình QueryClient theo hướng dẫn chính thức của TanStack Query cho
 * Next.js App Router: mỗi request phía server có client riêng, phía trình
 * duyệt dùng duy nhất một client.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: luôn tạo client mới cho mỗi request.
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
