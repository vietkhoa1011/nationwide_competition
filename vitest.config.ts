import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Cấu hình Vitest cho các bài kiểm thử logic thuần (chấm điểm, quy tắc lượt làm bài).
 * Không cần database: `@/lib/prisma` được thay bằng fake trong từng tệp test.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
  },
});
