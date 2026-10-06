import katex from "katex";

import { MAX_LATEX_LENGTH, normalizeLatexSource } from "@/features/authoring/services/rich-content-core";

/**
 * Cấu hình chung cho mọi nơi render công thức (editor, trang xem trước, trang làm bài,
 * trang kết quả). KaTeX chạy với `trust: false` nên không thể sinh URL/HTML tuỳ ý, và
 * `maxExpand` chặn macro nở vô hạn — hai điều kiện bắt buộc để render nội dung do
 * người dùng nhập.
 */
export const MATH_RENDER_OPTIONS = {
  throwOnError: false,
  trust: false,
  strict: "ignore",
  output: "htmlAndMathml",
  maxExpand: 1_000,
  maxSize: 40,
} as const;

/** Giới hạn số macro được nở khi kiểm tra cú pháp (chống treo máy chủ). */
const VALIDATION_MAX_EXPAND = 200;

export function localizeKatexError(katexMessage: string): string {
  const message = katexMessage.replace(/^KaTeX parse error:\s*/i, "").trim();
  return `Công thức LaTeX không hợp lệ: ${message}`;
}

/**
 * Kiểm tra cú pháp một công thức. Dùng ở máy chủ trước khi xuất bản đề: lệnh không
 * được hỗ trợ (`\foo`), thiếu ngoặc hoặc môi trường sai đều ném `ParseError` khi
 * `throwOnError: true` — không chỉ dựa vào chế độ render "không ném lỗi" của giao diện.
 */
export function checkLatex(source: string): { ok: true } | { ok: false; error: string } {
  const latex = normalizeLatexSource(source);

  if (latex.length === 0) {
    return { ok: false, error: "Công thức đang để trống." };
  }
  if (latex.length > MAX_LATEX_LENGTH) {
    return {
      ok: false,
      error: `Công thức quá dài (tối đa ${MAX_LATEX_LENGTH} ký tự).`,
    };
  }

  try {
    katex.renderToString(latex, {
      ...MATH_RENDER_OPTIONS,
      throwOnError: true,
      maxExpand: VALIDATION_MAX_EXPAND,
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: localizeKatexError(message) };
  }
}

export interface RenderedMath {
  /** HTML do KaTeX sinh ra (kèm MathML) — an toàn vì `trust: false`. */
  html: string;
  /** Thông báo tiếng Việt khi công thức lỗi (giao diện hiển thị thay vì làm sập trang). */
  error: string | null;
}

/**
 * Render công thức thành HTML + MathML. Không bao giờ ném lỗi: công thức hỏng trả về
 * `error` để giao diện hiển thị hộp cảnh báo nhỏ thay vì làm sập cả trang.
 */
export function renderLatexToHtml(source: string, displayMode: boolean): RenderedMath {
  const latex = normalizeLatexSource(source);

  if (latex.length === 0) {
    return { html: "", error: "Công thức đang để trống." };
  }
  if (latex.length > MAX_LATEX_LENGTH) {
    return { html: "", error: `Công thức quá dài (tối đa ${MAX_LATEX_LENGTH} ký tự).` };
  }

  try {
    return {
      html: katex.renderToString(latex, {
        ...MATH_RENDER_OPTIONS,
        displayMode,
        throwOnError: true,
      }),
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { html: "", error: localizeKatexError(message) };
  }
}
