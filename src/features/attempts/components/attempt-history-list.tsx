"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button, buttonClassName } from "@/components/ui/button";
import { Badge, Card, CardBody } from "@/components/ui/card";
import { Alert, ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import {
  buildAttemptHistoryQueryString,
  useAttemptHistory,
  type AttemptHistoryFilters,
} from "@/features/attempts/hooks/use-attempt";
import type {
  AttemptHistoryDto,
  AttemptHistoryItemDto,
  AttemptStatusValue,
} from "@/features/attempts/types";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { formatDateTime, formatScore } from "@/lib/utils";

const STATUS_META: Record<
  AttemptStatusValue,
  { label: string; tone: "sky" | "emerald" | "amber" }
> = {
  IN_PROGRESS: { label: "Đang làm", tone: "sky" },
  SUBMITTED: { label: "Đã nộp", tone: "emerald" },
  EXPIRED: { label: "Hết giờ", tone: "amber" },
};

function AttemptHistoryRow({ item }: { item: AttemptHistoryItemDto }) {
  const status = STATUS_META[item.status];
  const isGraded = item.score !== null && item.maxScore !== null;

  return (
    <Card>
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <Badge>{item.subjectName}</Badge>
            <span className="text-xs text-slate-500">{`Bắt đầu ${formatDateTime(item.startedAt)}`}</span>
          </div>

          <h3 className="text-base font-bold text-slate-900">{item.examTitle}</h3>

          <p className="text-sm text-slate-600">
            {isGraded
              ? `Điểm ${formatScore(item.score)}/${formatScore(item.maxScore)} · đúng ${item.correctCount ?? 0} · sai ${item.incorrectCount ?? 0} · bỏ trống ${item.unansweredCount ?? 0}`
              : `${item.questionCount} câu hỏi · đang ở câu ${item.lastQuestionPosition}`}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {item.canResume ? (
            <Link
              href={`/lam-bai/${item.attemptId}`}
              className={buttonClassName("primary", "sm")}
            >
              Tiếp tục làm bài
            </Link>
          ) : null}

          {item.status === "IN_PROGRESS" ? null : (
            <Link
              href={`/ket-qua/${item.attemptId}`}
              className={buttonClassName("secondary", "sm")}
            >
              Xem kết quả
            </Link>
          )}

          <Link href={`/de-thi/${item.examId}`} className={buttonClassName("ghost", "sm")}>
            Đề thi
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}

export function AttemptHistoryList({
  filters,
  initialData,
}: {
  filters: AttemptHistoryFilters;
  /** Trang đầu do Server Component nạp sẵn (không có khi truy vấn phía server lỗi). */
  initialData?: AttemptHistoryDto;
}) {
  const router = useRouter();
  const auth = useAuth();
  const historyQuery = useAttemptHistory(filters, initialData);

  const result = historyQuery.data;
  const currentPage = result?.page ?? filters.page ?? 1;
  const totalPages = result?.totalPages ?? 0;

  function goToPage(page: number) {
    router.push(`/lich-su?${buildAttemptHistoryQueryString({ ...filters, page })}`);
  }

  return (
    <div className="space-y-4">
      {auth.user === null && !auth.isLoading ? (
        <Alert tone="info" title="Lịch sử này gắn với trình duyệt hiện tại">
          <p>
            Bạn đang luyện đề với tư cách khách.{" "}
            <Link
              href="/dang-nhap?next=%2Flich-su"
              className="font-semibold underline underline-offset-4"
            >
              Đăng nhập
            </Link>{" "}
            hoặc{" "}
            <Link
              href="/dang-ky"
              className="font-semibold underline underline-offset-4"
            >
              đăng ký
            </Link>{" "}
            để giữ lịch sử và xem lại trên mọi thiết bị.
          </p>
        </Alert>
      ) : null}

      {historyQuery.isPending && !result ? (
        <LoadingBlock message="Đang tải lịch sử làm bài…" />
      ) : historyQuery.isError ? (
        <ErrorBlock
          error={historyQuery.error}
          title="Không tải được lịch sử làm bài"
          onRetry={() => void historyQuery.refetch()}
        />
      ) : !result || result.items.length === 0 ? (
        <div className="space-y-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            Chưa có lượt làm bài nào. Hãy chọn một đề và bắt đầu luyện tập.
          </p>
          <Link href="/de-thi" className={buttonClassName("primary", "sm")}>
            Khám phá kho đề thi
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500">{`Tổng cộng ${result.total} lượt làm bài.`}</p>

          <div className="space-y-3">
            {result.items.map((item) => (
              <AttemptHistoryRow key={item.attemptId} item={item} />
            ))}
          </div>

          {totalPages > 1 ? (
            <nav className="flex items-center justify-between gap-3" aria-label="Phân trang">
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => goToPage(currentPage - 1)}
              >
                ← Trang trước
              </Button>
              <span className="text-sm text-slate-600">
                {`Trang ${currentPage} / ${totalPages}`}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => goToPage(currentPage + 1)}
              >
                Trang sau →
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
