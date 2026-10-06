"use client";

import { useMemo } from "react";

import { renderLatexToHtml } from "@/features/math/services/latex-core";
import { cn } from "@/lib/utils";

/**
 * Render một công thức LaTeX bằng KaTeX. Đầu ra gồm cả HTML và MathML (`output:
 * htmlAndMathml`) nên trình đọc màn hình vẫn đọc được công thức.
 *
 * Công thức lỗi KHÔNG làm sập trang: component hiển thị hộp cảnh báo nhỏ và nút "Kiểm tra
 * đề" sẽ chặn xuất bản vì máy chủ kiểm tra lại công thức trước khi phát hành đề.
 */
export function MathContent({
  latex,
  display = false,
  className,
}: {
  latex: string;
  display?: boolean;
  className?: string;
}) {
  const rendered = useMemo(() => renderLatexToHtml(latex, display), [latex, display]);

  if (rendered.error) {
    return (
      <span
        className={cn(
          "inline-block rounded-lg border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700",
          className,
        )}
        title={latex}
      >
        {`⚠ ${rendered.error}`}
      </span>
    );
  }

  if (display) {
    return (
      <div
        className={cn("my-2 max-w-full overflow-x-auto py-1 text-center", className)}
        dangerouslySetInnerHTML={{ __html: rendered.html }}
      />
    );
  }

  return (
    <span
      className={cn("inline-block max-w-full align-middle", className)}
      dangerouslySetInnerHTML={{ __html: rendered.html }}
    />
  );
}
