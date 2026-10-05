import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { FeaturedExams } from "@/features/exams/components/featured-exams";
import { SubjectList } from "@/features/exams/components/subject-list";

const steps = [
  {
    title: "1. Chọn đề theo môn",
    description:
      "Lọc đề thi theo môn học, năm hoặc mức độ nổi bật để bám sát mục tiêu ôn tập.",
  },
  {
    title: "2. Làm bài như thi thật",
    description:
      "Đồng hồ đếm ngược do máy chủ quản lý, đáp án được lưu tự động sau mỗi lựa chọn.",
  },
  {
    title: "3. Nhận điểm và lời giải",
    description:
      "Nộp bài để xem điểm từng câu, đáp án đúng và lời giải chi tiết cho mọi câu hỏi.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="rounded-2xl bg-linear-to-br from-sky-600 to-indigo-700 px-6 py-10 text-white sm:px-10 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-100">
          Kỳ thi tốt nghiệp THPT 2027
        </p>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
          Luyện đề thử sức — chấm điểm ngay, xem lời giải chi tiết
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-sky-50 sm:text-base">
          Chọn môn, làm bài trong thời gian như thi thật, hệ thống tự động lưu đáp án và chấm điểm
          ngay khi bạn nộp.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink
            href="/de-thi"
            size="lg"
            className="bg-blue-600 text-sky-700 hover:bg-sky-50"
          >
            Vào kho đề thi
          </ButtonLink>
          <ButtonLink
            href="/de-thi?featured=true"
            size="lg"
            className="border-white/40 bg-blue-600 text-white hover:bg-white/10"
          >
            Đề nổi bật
          </ButtonLink>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Chọn môn học</h2>
          <p className="text-sm text-slate-500">
            Mỗi môn có nhiều đề thi thử theo cấu trúc mới của kỳ thi tốt nghiệp.
          </p>
        </div>
        <SubjectList />
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900">Đề thi nổi bật</h2>
            <p className="text-sm text-slate-500">Được chọn lọc cho giai đoạn ôn tập nước rút.</p>
          </div>
          <Link
            href="/de-thi"
            className="shrink-0 text-sm font-semibold text-sky-700 hover:text-sky-800"
          >
            Xem tất cả →
          </Link>
        </div>
        <FeaturedExams />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Cách hoạt động</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50"
            >
              <h3 className="text-base font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
