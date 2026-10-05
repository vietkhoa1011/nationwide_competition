import type { Metadata } from "next";

import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = {
  title: "Đăng ký — Luyện Thi 2027",
  description:
    "Tạo tài khoản học sinh miễn phí để lưu lịch sử làm bài và theo dõi tiến bộ qua từng lần luyện đề.",
};

export default function RegisterPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Tạo tài khoản học sinh</h1>
        <p className="text-sm text-slate-600">
          Miễn phí, chỉ cần email. Kết quả làm bài sẽ được lưu lại để bạn xem lại bất cứ lúc nào.
        </p>
      </div>

      <RegisterForm />
    </div>
  );
}
