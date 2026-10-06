import { describe, expect, it } from "vitest";

import { MAX_LATEX_LENGTH } from "@/features/authoring/services/rich-content-core";
import { checkLatex } from "@/features/math/services/latex-core";
import {
  findMathPlaceholder,
  insertMathTemplate,
  MATH_TEMPLATE_GROUPS,
  type MathTemplate,
} from "@/features/math/services/math-templates";

/**
 * Bảng công thức bấm-chèn là thứ giáo viên dùng thay cho việc viết mã LaTeX, nên mọi mẫu phải
 * render được bằng KaTeX. Bộ kiểm thử này chạy chính bộ kiểm tra cú pháp mà máy chủ dùng trước
 * khi xuất bản đề, nhờ vậy không thể thêm mẫu sai mà không bị phát hiện.
 */
const ALL_TEMPLATES: MathTemplate[] = MATH_TEMPLATE_GROUPS.flatMap((group) => [
  ...group.templates,
]);

function templateById(id: string): MathTemplate {
  const found = ALL_TEMPLATES.find((template) => template.id === id);
  if (!found) {
    throw new Error(`Không tìm thấy mẫu công thức "${id}"`);
  }
  return found;
}

describe("MATH_TEMPLATE_GROUPS", () => {
  it("mọi mẫu công thức đều render được bằng KaTeX", () => {
    for (const template of ALL_TEMPLATES) {
      const result = checkLatex(template.latex);
      expect(result, `mẫu "${template.id}" phải hợp lệ`).toEqual({ ok: true });
    }
  });

  it("mọi mẫu đều nằm trong giới hạn độ dài nguồn LaTeX", () => {
    for (const template of ALL_TEMPLATES) {
      expect(template.latex.length).toBeLessThanOrEqual(MAX_LATEX_LENGTH);
    }
  });

  it("mã mẫu không trùng nhau và nhãn đều có tiếng Việt", () => {
    const ids = ALL_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const template of ALL_TEMPLATES) {
      expect(template.label.trim().length).toBeGreaterThan(0);
    }

    const groupIds = MATH_TEMPLATE_GROUPS.map((group) => group.id);
    expect(new Set(groupIds).size).toBe(groupIds.length);
    expect(ALL_TEMPLATES.length).toBeGreaterThanOrEqual(20);
  });

  it("chỗ trống của mẫu (select) luôn được tìm thấy trong nguồn LaTeX", () => {
    for (const template of ALL_TEMPLATES) {
      if (!template.select) {
        continue;
      }
      const hole = findMathPlaceholder(template.latex, template.select);
      expect(hole, `mẫu "${template.id}" không tìm thấy chỗ trống`).toBeGreaterThanOrEqual(0);
      // Chỗ trống phải là một ký tự đứng riêng, không nằm trong tên lệnh (`\frac`, `\begin`…).
      const previous = hole > 0 ? template.latex[hole - 1] : undefined;
      expect(/[a-zA-Z\\]/.test(previous ?? ""), `mẫu "${template.id}" chọn nhầm tên lệnh`).toBe(
        false,
      );
    }
  });
});

describe("insertMathTemplate", () => {
  const fraction: MathTemplate = { id: "frac", label: "Phân số", latex: "\\frac{a}{b}", select: "a" };
  const lessOrEqual: MathTemplate = { id: "le", label: "Nhỏ hơn hoặc bằng", latex: "\\le" };

  it("chèn vào nguồn trống và bôi đen chỗ trống của mẫu", () => {
    const result = insertMathTemplate(fraction, {
      value: "",
      selectionStart: 0,
      selectionEnd: 0,
    });

    expect(result.value).toBe("\\frac{a}{b}");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe("a");
  });

  it("chèn ngay tại con trỏ giữa hai đoạn văn bản", () => {
    const result = insertMathTemplate(fraction, {
      value: "x +  = 0",
      selectionStart: 4,
      selectionEnd: 4,
    });

    expect(result.value).toBe("x + \\frac{a}{b} = 0");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe("a");
  });

  it("đưa đoạn đang bôi đen vào chỗ trống của mẫu", () => {
    const sqrt: MathTemplate = { id: "sqrt", label: "Căn bậc hai", latex: "\\sqrt{a}", select: "a" };
    const result = insertMathTemplate(sqrt, {
      value: "x^2 + 1",
      selectionStart: 0,
      selectionEnd: 3,
    });

    expect(result.value).toBe("\\sqrt{x^2} + 1");
    // Đoạn vừa đưa vào vẫn đang được bôi đen để gõ thay tiếp nếu cần.
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe("x^2");
  });

  it("mẫu không có chỗ trống thì đặt con trỏ ngay sau phần vừa chèn", () => {
    const result = insertMathTemplate(lessOrEqual, {
      value: "x",
      selectionStart: 1,
      selectionEnd: 1,
    });

    expect(result.value).toBe("x\\le");
    expect(result.selectionStart).toBe(4);
    expect(result.selectionEnd).toBe(4);
  });

  it("thay thế đoạn bôi đen khi mẫu không có chỗ trống", () => {
    const result = insertMathTemplate(lessOrEqual, {
      value: "a + b",
      selectionStart: 2,
      selectionEnd: 3,
    });

    expect(result.value).toBe("a \\le b");
  });

  it("ép vị trí con trỏ nằm trong phạm vi văn bản", () => {
    const result = insertMathTemplate(lessOrEqual, {
      value: "ab",
      selectionStart: 99,
      selectionEnd: 120,
    });

    expect(result.value).toBe("ab\\le");
  });
});

describe("findMathPlaceholder", () => {
  it("bỏ qua chữ cái nằm trong tên lệnh (\\frac)", () => {
    const template = templateById("triangle-area");
    const hole = findMathPlaceholder(template.latex, "a");

    expect(hole).toBe(template.latex.indexOf(" a ") + 1);
  });

  it("bỏ qua chữ cái nằm trong tên môi trường (pmatrix)", () => {
    const template = templateById("matrix");
    const hole = findMathPlaceholder(template.latex, "a");

    expect(hole).toBe(template.latex.indexOf(" a &") + 1);
    expect(template.latex.slice(hole, hole + 1)).toBe("a");
  });

  it("trả về -1 khi nguồn không còn chỗ trống và không nhận chỗ trống rỗng", () => {
    expect(findMathPlaceholder("\\frac{1}{2}", "a")).toBe(-1);
    expect(findMathPlaceholder("x^2", "")).toBe(-1);
  });

  it("chèn mẫu ma trận thì bôi đen ô đầu tiên, không phải chữ trong tên lệnh", () => {
    const template = templateById("matrix");
    const result = insertMathTemplate(template, {
      value: "",
      selectionStart: 0,
      selectionEnd: 0,
    });

    expect(result.value).toBe(template.latex);
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe("a");
    expect(result.selectionStart).toBeGreaterThan(result.value.indexOf("\\begin{pmatrix}"));
  });
});
