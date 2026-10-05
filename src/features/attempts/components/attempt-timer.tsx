import { cn, formatClock } from "@/lib/utils";

/** Đồng hồ đếm ngược. Giá trị đếm dựa trên mốc hết giờ mà server đã trả về. */
export function AttemptTimer({ remainingMs }: { remainingMs: number }) {
  const seconds = Math.floor(Math.max(0, remainingMs) / 1000);
  const isUrgent = seconds <= 300;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold tabular-nums",
        isUrgent ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700",
      )}
      title="Thời gian còn lại (do máy chủ tính)"
    >
      <span aria-hidden="true">⏱</span>
      <span aria-live="polite">{formatClock(seconds)}</span>
    </div>
  );
}
