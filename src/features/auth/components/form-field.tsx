import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/** Lớp CSS dùng chung cho mọi ô nhập của biểu mẫu (input, textarea). */
function controlClassName(hasError: boolean): string {
  return cn(
    "w-full rounded-xl border px-4 py-2.5 text-sm outline-none disabled:bg-slate-100",
    hasError ? "border-rose-400 focus:border-rose-500" : "border-slate-300 focus:border-sky-500",
  );
}

export interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  /** Thông báo lỗi của trường; khi có lỗi thì gợi ý (`hint`) bị ẩn để tránh nhiễu. */
  error?: string;
  hint?: string;
}

/**
 * Ô nhập dùng chung cho biểu mẫu xác thực: gắn nhãn, thông báo lỗi và thuộc tính
 * trợ năng (`aria-invalid`, `aria-describedby`) theo cùng một cách.
 */
export function FormField({ id, label, error, hint, className, ...inputProps }: FormFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn(controlClassName(Boolean(error)), className)}
        {...inputProps}
      />
      {error ? (
        <p id={errorId} className="text-xs font-semibold text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}

/**
 * Ô nhập nhiều dòng, dùng cùng cách gắn nhãn/lỗi như `FormField` để biểu mẫu dài
 * (ví dụ đơn xin quyền giáo viên) hiển thị thống nhất.
 */
export function TextAreaField({
  id,
  label,
  error,
  hint,
  className,
  ...textAreaProps
}: TextAreaFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn(controlClassName(Boolean(error)), className)}
        {...textAreaProps}
      />
      {error ? (
        <p id={errorId} className="text-xs font-semibold text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

