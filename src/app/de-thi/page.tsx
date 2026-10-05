import type { Metadata } from "next";
import Link from "next/link";

import { ExamBrowser } from "@/features/exams/components/exam-browser";
import type { ExamListFilters } from "@/features/exams/hooks/use-exams";

export const metadata: Metadata = {
  title: "Kho đề thi — Luyện Thi 2027",
  description: "Tìm kiếm và luyện đề thi thử tốt nghiệp THPT theo môn học.",
};

const PAGE_SIZE = 9;

interface ExamListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export default async function ExamListPage({ searchParams }: ExamListPageProps) {
  const params = await searchParams;

  const filters: ExamListFilters = {
    search: firstValue(params.search),
    subjectId: firstValue(params.subjectId),
    featured: firstValue(params.featured) === "true" ? "true" : undefined,
    page: toPositiveInt(firstValue(params.page), 1),
    pageSize: PAGE_SIZE,
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/"
          className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
        >
          ← Trang chủ
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Kho đề thi</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
          Chọn đề phù hợp với mục tiêu ôn tập của bạn. Mỗi lượt làm bài được lưu riêng và có thể
          tiếp tục nếu bạn chưa nộp.
        </p>
      </div>

      <ExamBrowser filters={filters} />
    </div>
  );
}
