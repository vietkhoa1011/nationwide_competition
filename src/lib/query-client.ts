import { QueryClient } from "@tanstack/react-query";

/**
 * Cấu hình QueryClient cho phía trình duyệt: `src/app/providers.tsx` tạo một
 * client cho mỗi lần tải trang và chia sẻ nó cho toàn bộ cây component.
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
