import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { TeacherApplicationPanel } from "@/features/teacher-applications/components/teacher-application-panel";
import { getMyTeacherApplicationState } from "@/features/teacher-applications/services/teacher-applications-service";
import { listSubjects } from "@/features/exams/services/exams-service";
import { readSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Xin quyền giáo viên — Luyện Thi 2027",
  description:
    "Gửi đơn đăng ký quyền giáo viên để đóng góp đề thi và theo dõi trạng thái duyệt đơn của bạn.",
};

const LOGIN_HREF = "/dang-nhap?next=%2Fxin-quyen-giao-vien";

export default async function TeacherApplicationPage() {
  const session = await readSession();

  // Chỉ tài khoản đã đăng nhập mới có đơn để nộp; khách được đưa sang trang đăng nhập
  // kèm đường dẫn quay lại để không mất ngữ cảnh.
  if (session.status !== "authenticated") {
    redirect(LOGIN_HREF);
  }

  const [state, subjects] = await Promise.allSettled([
    getMyTeacherApplicationState(session.user),
    listSubjects(),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/tai-khoan"
          className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
        >
          ← Tài khoản của tôi
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Xin quyền giáo viên</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
          Quyền giáo viên cho phép bạn đóng góp đề thi và ngân hàng câu hỏi cho cộng đồng. Hãy mô tả
          ngắn gọn kinh nghiệm giảng dạy của bạn — quản trị viên sẽ duyệt trong thời gian sớm nhất.
        </p>
      </div>

      {/* DB chưa sẵn sàng thì trang vẫn trả 200 và client tự gọi API rồi hiển thị lỗi. */}
      <TeacherApplicationPanel
        initialState={state.status === "fulfilled" ? state.value : undefined}
        subjects={subjects.status === "fulfilled" ? subjects.value : undefined}
      />
    </div>
  );
}
