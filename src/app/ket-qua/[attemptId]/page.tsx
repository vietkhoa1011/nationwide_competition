import type { Metadata } from "next";
import Link from "next/link";

import { ResultView } from "@/features/attempts/components/result-view";

export const metadata: Metadata = {
  title: "Kết quả bài làm — Luyện Thi 2027",
};

interface ResultPageProps {
  params: Promise<{ attemptId: string }>;
}

export default async function ResultPage({ params }: ResultPageProps) {
  const { attemptId } = await params;

  return (
    <div className="space-y-4">
      <Link
        href="/de-thi"
        className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
      >
        ← Kho đề thi
      </Link>
      <ResultView attemptId={attemptId} />
    </div>
  );
}
