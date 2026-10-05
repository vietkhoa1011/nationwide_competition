import type { Metadata } from "next";

import { LoginForm } from "@/features/auth/components/login-form";
import { resolveRedirectPath } from "@/lib/auth/redirect";

export const metadata: Metadata = {
  title: "Đăng nhập — Luyện Thi 2027",
  description:
    "Đăng nhập để lưu lịch sử làm bài, đồng bộ tiến độ trên mọi thiết bị và xem lại kết quả các lần luyện đề.",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  // `?next=/de-thi/abc` được kiểm tra là đường dẫn nội bộ trước khi dùng để chuyển hướng.
  const nextPath = resolveRedirectPath(Array.isArray(next) ? next[0] : next);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Đăng nhập</h1>
        <p className="text-sm text-slate-600">
          Tiếp tục luyện đề và xem lại toàn bộ lịch sử làm bài của bạn.
        </p>
      </div>

      <LoginForm nextPath={nextPath} />
    </div>
  );
}
