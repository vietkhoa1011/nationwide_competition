import type { ReactNode } from "react";

import { ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "error" | "warning" | "success";
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    error: "border-rose-200 bg-rose-50 text-rose-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-2xl border px-4 py-3 text-sm", tones[tone], className)}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn(title && "mt-1")}>{children}</div> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

export function LoadingBlock({ message = "Đang tải dữ liệu…" }: { message?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-sm text-slate-500">
      <Spinner />
      {message}
    </div>
  );
}

/**
 * Hiển thị lỗi từ API bằng tiếng Việt. Riêng trường hợp chưa cấu hình / chưa chạy
 * được PostgreSQL sẽ kèm hướng dẫn cụ thể để người phát triển biết cần làm gì.
 */
export function ErrorBlock({
  error,
  onRetry,
  title = "Không tải được dữ liệu",
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const apiError = error instanceof ApiClientError ? error : null;
  const isDatabaseUnavailable = apiError?.code === "DATABASE_UNAVAILABLE";

  return (
    <Alert tone="error" title={title}>
      <p>
        {apiError?.message ??
          "Đã xảy ra lỗi không xác định. Vui lòng thử tải lại trang."}
      </p>
      {isDatabaseUnavailable ? (
        <div className="mt-2 space-y-1 text-xs leading-relaxed">
          <p className="font-semibold">Cách khắc phục:</p>
          <ol className="list-decimal space-y-0.5 pl-4">
            <li>
              Sao chép <code className="rounded bg-white px-1">.env.example</code> thành{" "}
              <code className="rounded bg-white px-1">.env</code> và đặt đúng{" "}
              <code className="rounded bg-white px-1">DATABASE_URL</code>.
            </li>
            <li>
              Khởi động PostgreSQL bằng <code className="rounded bg-white px-1">docker compose up -d</code>{" "}
              (hoặc dùng máy chủ PostgreSQL sẵn có).
            </li>
            <li>
              Chạy <code className="rounded bg-white px-1">npm run db:migrate</code> rồi{" "}
              <code className="rounded bg-white px-1">npm run db:seed</code>.
            </li>
          </ol>
        </div>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
        >
          Thử lại
        </button>
      ) : null}
    </Alert>
  );
}
