"use client";

import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { normalizeLatexSource } from "@/features/authoring/services/rich-content-core";
import { MathContent } from "@/features/content/components/math-content";
import { checkLatex } from "@/features/math/services/latex-core";
import {
  insertMathTemplate,
  MATH_TEMPLATE_GROUPS,
  type MathTemplate,
} from "@/features/math/services/math-templates";
import { cn } from "@/lib/utils";

export interface MathFormula {
  latex: string;
  display: boolean;
}

/**
 * Hộp thoại "Chèn công thức".
 *
 * Phần lớn giáo viên không viết mã LaTeX, nên phần chính của hộp thoại là BẢNG CÔNG THỨC
 * BẤM-CHÈN: mỗi nút đã vẽ sẵn công thức bằng KaTeX kèm tên tiếng Việt, bấm là công thức được
 * chèn vào đúng vị trí con trỏ và chỗ trống của mẫu được bôi đen để gõ thay ngay. Ô nguồn
 * LaTeX vẫn được giữ cho người quen mã; nội dung đang bôi đen trong ô đó sẽ được đưa vào chỗ
 * trống của mẫu.
 */
export function MathDialog({
  open,
  initial,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  /** null = chèn công thức mới; có giá trị = đang sửa công thức đã chèn. */
  initial: MathFormula | null;
  onCancel: () => void;
  onConfirm: (formula: MathFormula) => void;
}) {
  const [state, setState] = useState<{
    key: string;
    latex: string;
    display: boolean;
    groupId: string;
  }>({
    key: open ? "init" : "closed",
    latex: initial?.latex ?? "",
    display: initial?.display ?? false,
    groupId: MATH_TEMPLATE_GROUPS[0].id,
  });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Trạng thái được suy ra theo "khoá nguồn" (công thức đang sửa) nên mở hộp thoại cho công
  // thức khác là tự nạp giá trị mới, không cần setState trong useEffect.
  const sourceKey = open ? `${initial?.latex ?? ""}|${String(initial?.display ?? false)}` : "closed";
  const active =
    state.key === sourceKey
      ? state
      : {
          key: sourceKey,
          latex: initial?.latex ?? "",
          display: initial?.display ?? false,
          groupId: state.groupId,
        };
  const latex = active.latex;
  const display = active.display;
  const setLatex = (value: string) => setState({ ...active, latex: value });
  const setDisplay = (value: boolean) => setState({ ...active, display: value });

  const normalized = normalizeLatexSource(latex);
  const check = useMemo(() => (normalized ? checkLatex(normalized) : null), [normalized]);
  const group =
    MATH_TEMPLATE_GROUPS.find((item) => item.id === active.groupId) ?? MATH_TEMPLATE_GROUPS[0];

  /**
   * Bấm một nút trong bảng công thức: chèn mẫu vào đúng chỗ con trỏ trong ô nguồn rồi bôi đen
   * chỗ trống để giáo viên gõ thay ngay. Con trỏ được đặt lại sau khi React vẽ xong giá trị mới.
   */
  const applyTemplate = (template: MathTemplate) => {
    const element = textareaRef.current;
    const result = insertMathTemplate(template, {
      value: latex,
      selectionStart: element?.selectionStart ?? latex.length,
      selectionEnd: element?.selectionEnd ?? latex.length,
    });

    setState({ ...active, latex: result.value, display: template.block ?? active.display });

    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) {
        return;
      }
      node.focus();
      node.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  };

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chèn công thức"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-2 sm:p-4"
    >
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {initial ? "Sửa công thức" : "Chèn công thức"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Bấm vào công thức có sẵn để chèn — không cần biết viết mã. Sau đó thay các chữ a, b,
              x… trong công thức bằng số hoặc ký hiệu của bạn.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Bảng công thức (bấm để chèn)
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Nhóm công thức">
              {MATH_TEMPLATE_GROUPS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={item.id === group.id}
                  onClick={() => setState({ ...active, groupId: item.id })}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    item.id === group.id
                      ? "bg-sky-600 text-white"
                      : "border border-slate-300 text-slate-600 hover:bg-slate-100",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-2 grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 sm:grid-cols-3 xl:grid-cols-4">
              {group.templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  title={`Chèn ${template.label}`}
                  onClick={() => applyTemplate(template)}
                  className="flex min-h-[3.75rem] flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center hover:border-sky-400 hover:bg-sky-50"
                >
                  <div
                    className="flex max-w-full items-center justify-center overflow-hidden text-xs text-slate-800"
                    aria-hidden="true"
                  >
                    <MathContent latex={template.latex} display={template.block ?? false} />
                  </div>
                  <span className="text-[11px] leading-tight text-slate-500">{template.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Công thức của bạn
            </p>

            <div
              className={cn(
                "rounded-xl border px-3 py-2",
                check && !check.ok ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-slate-50",
              )}
            >
              {normalized ? (
                <MathContent latex={normalized} display={display} />
              ) : (
                <p className="text-xs text-slate-400">
                  Chưa có công thức — hãy bấm một công thức ở bảng phía trên.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="math-display"
                  checked={!display}
                  onChange={() => setDisplay(false)}
                />
                Công thức nằm trong dòng
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="math-display"
                  checked={display}
                  onChange={() => setDisplay(true)}
                />
                Công thức riêng một dòng
              </label>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="math-source">
                Chi tiết công thức (thay a, b, x… bằng giá trị của bạn)
              </label>
              <textarea
                id="math-source"
                ref={textareaRef}
                value={latex}
                onChange={(event) => setLatex(event.target.value)}
                rows={2}
                spellCheck={false}
                placeholder="Ví dụ: x^{2} + 3x - 4"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-sky-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                Công thức từ bảng phía trên được chèn vào ô này tại vị trí con trỏ. Nếu đang bôi đen
                một đoạn thì đoạn đó được đưa vào trong công thức: bôi đen{" "}
                <code className="rounded bg-slate-100 px-1">x^2</code> rồi bấm “Căn bậc hai” sẽ được
                căn bậc hai của x². Người đã quen mã LaTeX có thể gõ trực tiếp vào ô này.
              </p>
            </div>

            {check && !check.ok ? (
              <p role="alert" className="text-sm text-rose-700">
                {check.error}
              </p>
            ) : null}
          </section>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button variant="secondary" onClick={onCancel}>
            Huỷ
          </Button>
          <Button
            disabled={!normalized || !check?.ok}
            onClick={() => onConfirm({ latex: normalized, display })}
          >
            {initial ? "Cập nhật công thức" : "Chèn công thức"}
          </Button>
        </div>
      </div>
    </div>
  );
}
