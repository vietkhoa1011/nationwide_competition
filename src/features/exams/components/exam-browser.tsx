"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { ExamCard } from "@/features/exams/components/exam-card";
import {
  buildExamQueryString,
  useExams,
  useSubjects,
  type ExamListFilters,
} from "@/features/exams/hooks/use-exams";
import type {
  ExamSummaryDto,
  PaginatedResult,
  SubjectDto,
} from "@/features/exams/types";

/**
 * Ô tìm kiếm giữ state cục bộ. Component được remount qua `key` khi từ khoá
 * trên URL đổi, nhờ vậy không cần đồng bộ state bằng useEffect.
 */
function ExamSearchForm({
  initialSearch,
  onSubmit,
}: {
  initialSearch: string;
  onSubmit: (value: string) => void;
}) {
  const [searchInput, setSearchInput] = useState(initialSearch);

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(searchInput.trim());
      }}
    >
      <label className="sr-only" htmlFor="exam-search">
        Tìm kiếm đề thi
      </label>
      <input
        id="exam-search"
        type="search"
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        placeholder="Tìm theo tên đề thi…"
        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-sky-500"
      />
      <Button type="submit">Tìm kiếm</Button>
    </form>
  );
}

export function ExamBrowser({
  filters,
  initialSubjects,
  initialExams,
}: {
  filters: ExamListFilters;
  /** Dữ liệu trang đầu do Server Component nạp sẵn (không có khi truy vấn phía server lỗi). */
  initialSubjects?: SubjectDto[];
  initialExams?: PaginatedResult<ExamSummaryDto>;
}) {
  const router = useRouter();
  const subjectsQuery = useSubjects(initialSubjects);
  const examsQuery = useExams(filters, initialExams);

  function navigate(next: ExamListFilters) {
    const query = buildExamQueryString({ ...filters, ...next, page: next.page ?? 1 });
    router.push(`/de-thi?${query}`);
  }

  const subjects = subjectsQuery.data ?? [];
  const result = examsQuery.data;
  const currentPage = result?.page ?? filters.page ?? 1;
  const totalPages = result?.totalPages ?? 0;
  const hasFilters = Boolean(filters.search || filters.subjectId || filters.featured);

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="space-y-4">
          <ExamSearchForm
            key={filters.search ?? ""}
            initialSearch={filters.search ?? ""}
            onSubmit={(value) => navigate({ search: value || undefined })}
          />

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Lọc theo môn học"
              value={filters.subjectId ?? ""}
              onChange={(event) =>
                navigate({ subjectId: event.target.value || undefined })
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
            >
              <option value="">Tất cả môn học</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>

            <Button
              variant={filters.featured === "true" ? "primary" : "secondary"}
              size="sm"
              onClick={() =>
                navigate({ featured: filters.featured === "true" ? undefined : "true" })
              }
            >
              Đề nổi bật
            </Button>

            {hasFilters ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/de-thi")}
              >
                Xoá bộ lọc
              </Button>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {examsQuery.isPending ? (
        <LoadingBlock message="Đang tải danh sách đề thi…" />
      ) : examsQuery.isError ? (
        <ErrorBlock
          error={examsQuery.error}
          title="Không tải được danh sách đề thi"
          onRetry={() => void examsQuery.refetch()}
        />
      ) : !result || result.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Không tìm thấy đề thi nào phù hợp với bộ lọc hiện tại.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-500">{`Tìm thấy ${result.total} đề thi.`}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((exam) => (
              <ExamCard key={exam.id} exam={exam} />
            ))}
          </div>

          {totalPages > 1 ? (
            <nav className="flex items-center justify-between gap-3" aria-label="Phân trang">
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => navigate({ page: currentPage - 1 })}
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
                onClick={() => navigate({ page: currentPage + 1 })}
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
