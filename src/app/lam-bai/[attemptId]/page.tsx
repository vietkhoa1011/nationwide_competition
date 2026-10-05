import type { Metadata } from "next";
import Link from "next/link";

import { AttemptRunner } from "@/features/attempts/components/attempt-runner";

export const metadata: Metadata = {
  title: "Làm bài — Luyện Thi 2027",
};

interface AttemptPageProps {
  params: Promise<{ attemptId: string }>;
}

export default async function AttemptPage({ params }: AttemptPageProps) {
  const { attemptId } = await params;

  return (
    <div className="space-y-4">
      <Link
        href="/de-thi"
        className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
      >
        ← Kho đề thi
      </Link>
      <AttemptRunner attemptId={attemptId} />
    </div>
  );
}
