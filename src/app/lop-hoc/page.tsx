import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { StudentClassroomList } from "@/features/authoring/components/student-classroom-list";
import { listStudentClassrooms } from "@/features/classroom/services/classroom-service";
import { readSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Lớp học của tôi — Luyện Thi 2027",
  description: "Các đề giáo viên đã giao cho lớp của bạn.",
};

const LOGIN_HREF = "/dang-nhap?next=%2Flop-hoc";

/**
 * Lớp học của học sinh. Đây là lối vào để làm đề của lớp: đề thuộc lớp không xuất hiện trong
 * kho đề công khai, và chỉ thành viên lớp mới thấy (máy chủ kiểm tra lại khi bắt đầu làm bài).
 */
export default async function StudentClassroomsPage() {
  const session = await readSession();

  if (session.status !== "authenticated") {
    redirect(LOGIN_HREF);
  }

  const items = await listStudentClassrooms(session.user.id).catch(() => []);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Lớp học của tôi</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          Những đề giáo viên đã giao cho lớp. Thời gian mở/đóng đề, số lượt làm bài và mốc xem
          đáp án do giáo viên thiết lập khi giao đề.
        </p>
      </div>

      <StudentClassroomList initialItems={items} />

      <p className="text-sm text-slate-500">
        Muốn luyện thêm?{" "}
        <Link href="/de-thi" className="font-semibold text-sky-700 hover:underline">
          Xem kho đề công khai
        </Link>
        .
      </p>
    </div>
  );
}
