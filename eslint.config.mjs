import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    /**
     * Ảnh của đề được phục vụ qua `/api/media/[assetId]` — route này kiểm tra quyền ở từng yêu
     * cầu, nên `next/image` không dùng được: bộ tối ưu ảnh sẽ gọi URL từ phía server mà không
     * có cookie phiên của người xem. Vì vậy các component này chủ động dùng thẻ `<img>`.
     */
    files: [
      "src/features/content/components/rich-content.tsx",
      "src/features/content/components/image-dialog.tsx",
    ],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
