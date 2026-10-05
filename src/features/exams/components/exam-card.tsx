import Link from "next/link";

import { Badge, Card, CardBody } from "@/components/ui/card";
import { formatDurationMinutes } from "@/lib/utils";

import type { ExamSummaryDto } from "@/features/exams/types";

export function ExamCard({ exam }: { exam: ExamSummaryDto }) {
  const examHref = `/de-thi/${exam.id}`;

  return (
    <Card className="flex h-full flex-col">
      <CardBody className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="sky">{exam.subject.name}</Badge>
          {exam.year ? <Badge>{`Năm ${exam.year}`}</Badge> : null}
          {exam.isFeatured ? <Badge tone="amber">Nổi bật</Badge> : null}
        </div>

        <h3 className="text-base font-semibold leading-snug text-slate-900">
          <Link href={examHref} className="hover:text-sky-700">
            {exam.title}
          </Link>
        </h3>

        {exam.description ? (
          <p className="line-clamp-2 text-sm text-slate-600">{exam.description}</p>
        ) : null}

        <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <div>
            <dt>Số câu hỏi</dt>
            <dd className="text-sm font-semibold text-slate-700">{exam.questionCount} câu</dd>
          </div>
          <div>
            <dt>Thời gian</dt>
            <dd className="text-sm font-semibold text-slate-700">
              {formatDurationMinutes(exam.durationMinutes)}
            </dd>
          </div>
        </dl>

        <Link
          href={examHref}
          className="text-sm font-semibold text-sky-700 hover:text-sky-800"
        >
          Xem đề và làm bài →
        </Link>
      </CardBody>
    </Card>
  );
}
