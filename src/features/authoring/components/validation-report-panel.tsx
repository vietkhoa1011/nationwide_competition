"use client";

import { Badge, Card, CardBody } from "@/components/ui/card";
import type { ValidationReportDto } from "@/features/authoring/types";
import { cn } from "@/lib/utils";

/**
 * Kết quả "Kiểm tra đề": liệt kê lỗi (chặn xuất bản) và cảnh báo (không chặn), mỗi mục có
 * nút nhảy tới đúng câu cần sửa. Báo cáo này do máy chủ sinh ra nên giống hệt điều kiện mà
 * thao tác xuất bản sẽ kiểm tra lại.
 */
export function ValidationReportPanel({
  report,
  onJumpToQuestion,
}: {
  report: ValidationReportDto | null;
  onJumpToQuestion: (questionId: string) => void;
}) {
  if (!report) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-slate-600">
            Bấm “Kiểm tra đề” để rà soát thông tin bắt buộc, đáp án đúng, công thức và ảnh
            trước khi xuất bản.
          </p>
        </CardBody>
      </Card>
    );
  }

  const isOk = report.errorCount === 0;

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={isOk ? "emerald" : "rose"}>
            {isOk ? "Đề đủ điều kiện xuất bản" : `${report.errorCount} lỗi cần sửa`}
          </Badge>
          {report.warningCount > 0 ? (
            <Badge tone="amber">{`${report.warningCount} cảnh báo`}</Badge>
          ) : null}
          <span className="text-xs text-slate-500">
            {`${report.questionCount} câu · ${report.totalPoints} điểm`}
          </span>
        </div>

        {report.issues.length === 0 ? (
          <p className="text-sm text-emerald-700">Không phát hiện vấn đề nào.</p>
        ) : (
          <ul className="space-y-2">
            {report.issues.map((issue, index) => (
              <li
                key={`${issue.code}-${issue.questionId ?? "exam"}-${index}`}
                className={cn(
                  "flex flex-wrap items-start justify-between gap-3 rounded-xl border px-3 py-2 text-sm",
                  issue.severity === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-900"
                    : "border-amber-200 bg-amber-50 text-amber-900",
                )}
              >
                <div className="space-y-0.5">
                  <p className="font-semibold">
                    {issue.severity === "error" ? "Lỗi" : "Cảnh báo"}
                    {issue.questionId ? "" : " (toàn đề)"}
                  </p>
                  <p className="leading-relaxed">{issue.message}</p>
                </div>
                {issue.questionId ? (
                  <button
                    type="button"
                    onClick={() => onJumpToQuestion(issue.questionId as string)}
                    className="rounded-lg border border-current px-2 py-1 text-xs font-semibold"
                  >
                    Tới câu này
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
