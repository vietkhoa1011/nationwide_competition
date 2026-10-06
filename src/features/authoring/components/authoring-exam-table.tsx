"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge, Card, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { useDuplicateExam, useExamLifecycle } from "@/features/authoring/hooks/use-authoring";
import type { AuthoringExamSummaryDto } from "@/features/authoring/types";
import { ApiClientError } from "@/lib/api-client";
import { formatDateTime, formatScore } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã xuất bản",
  ARCHIVED: "Đã lưu trữ",
};

/**
 * Bảng đề thi dành cho người soạn: trạng thái, phạm vi, số câu/điểm, số lượt làm và các thao
 * tác nhanh (soạn, xuất bản, tạo bản sao). Mọi nút đều gọi API — máy chủ mới là nơi quyết
 * định quyền và điều kiện.
 */
export function AuthoringExamTable({
  exams,
  emptyMessage = "Chưa có đề thi nào.",
}: {
  exams: AuthoringExamSummaryDto[];
  emptyMessage?: string;
}) {
  const router = useRouter();
  const duplicateExam = useDuplicateExam();
  const [actionExamId, setActionExamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (exams.length === 0) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-slate-600">{emptyMessage}</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Đề thi</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Nội dung</th>
                <th className="px-4 py-3">Lượt làm</th>
                <th className="px-4 py-3">Cập nhật</th>
                <th className="px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <ExamRow
                  key={exam.id}
                  exam={exam}
                  busy={actionExamId === exam.id}
                  onDuplicate={async () => {
                    setActionExamId(exam.id);
                    setError(null);
                    try {
                      const copy = await duplicateExam.mutateAsync({ examId: exam.id });
                      router.push(`/giao-vien/de-thi/${copy.id}/soan`);
                    } catch (duplicateError) {
                      setError(
                        duplicateError instanceof ApiClientError
                          ? duplicateError.message
                          : "Không tạo được bản sao.",
                      );
                    } finally {
                      setActionExamId(null);
                    }
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ExamRow({
  exam,
  busy,
  onDuplicate,
}: {
  exam: AuthoringExamSummaryDto;
  busy: boolean;
  onDuplicate: () => Promise<void>;
}) {
  const lifecycle = useExamLifecycle(exam.id);

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3">
        <p className="font-semibold text-slate-800">{exam.title}</p>
        <p className="text-xs text-slate-500">
          {exam.scope === "CLASS"
            ? `Lớp ${exam.classroomName ?? "—"} · ${exam.subjectName}`
            : `Đề công khai · ${exam.subjectName}`}
        </p>
      </td>
      <td className="px-4 py-3">
        <Badge
          tone={
            exam.status === "PUBLISHED" ? "emerald" : exam.status === "ARCHIVED" ? "slate" : "amber"
          }
        >
          {STATUS_LABELS[exam.status] ?? exam.status}
        </Badge>
        {exam.contentLocked ? (
          <span className="mt-1 block text-xs text-amber-700">Nội dung đã khoá</span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">
        {`${exam.questionCount} câu · ${formatScore(exam.totalPoints)} điểm`}
        <span className="mt-1 block text-slate-400">{`v${exam.revision}`}</span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">{exam.attemptCount}</td>
      <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(exam.updatedAt)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/giao-vien/de-thi/${exam.id}/soan`}
            className="rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
          >
            Soạn đề
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onDuplicate()}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          >
            Tạo bản sao
          </button>
          {exam.status === "PUBLISHED" ? (
            <button
              type="button"
              disabled={lifecycle.isPending || exam.contentLocked}
              onClick={() => void lifecycle.mutateAsync({ action: "unpublish", revision: exam.revision })}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              Thu hồi
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
