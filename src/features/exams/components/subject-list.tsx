"use client";

import Link from "next/link";

import { Badge, Card, CardBody } from "@/components/ui/card";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { useSubjects } from "@/features/exams/hooks/use-exams";

export function SubjectList() {
  const subjectsQuery = useSubjects();

  if (subjectsQuery.isPending) {
    return <LoadingBlock message="Đang tải danh sách môn học…" />;
  }

  if (subjectsQuery.isError) {
    return (
      <ErrorBlock
        error={subjectsQuery.error}
        title="Không tải được danh sách môn học"
        onRetry={() => void subjectsQuery.refetch()}
      />
    );
  }

  const subjects = subjectsQuery.data ?? [];

  if (subjects.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
        Cơ sở dữ liệu chưa có môn học nào. Hãy chạy <code>npm run db:seed</code> để nạp dữ liệu mẫu.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {subjects.map((subject) => (
        <Card key={subject.id} className="flex flex-col">
          <CardBody className="flex flex-1 flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">{subject.name}</h3>
              <Badge tone="emerald">{`${subject.examCount} đề`}</Badge>
            </div>
            {subject.description ? (
              <p className="text-sm text-slate-600">{subject.description}</p>
            ) : null}
            <Link
              href={`/de-thi?subjectId=${encodeURIComponent(subject.id)}`}
              className="mt-auto text-sm font-semibold text-sky-700 hover:text-sky-800"
            >
              Xem đề của môn này →
            </Link>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
