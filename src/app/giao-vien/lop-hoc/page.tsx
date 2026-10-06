import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ClassroomManager } from "@/features/authoring/components/classroom-manager";
import { listClassrooms } from "@/features/classroom/services/classroom-service";
import { listSubjects } from "@/features/exams/services/exams-service";
import { readSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Lớp học — Luyện Thi 2027",
  description: "Quản lý lớp học: thêm học sinh và theo dõi các đề đã giao.",
};

const LOGIN_HREF = "/dang-nhap?next=%2Fgiao-vien%2Flop-hoc";

/** Quản lý lớp học của giáo viên: tạo lớp, thêm thành viên, xem các đề đã giao. */
export default async function TeacherClassroomsPage() {
  const session = await readSession();

  if (session.status !== "authenticated") {
    redirect(LOGIN_HREF);
  }

  if (session.user.role === "STUDENT") {
    redirect("/lop-hoc");
  }

  const actor = { id: session.user.id, role: session.user.role };
  const [classrooms, subjects] = await Promise.all([
    listClassrooms(actor, {})
      .then((result) => result.items)
      .catch(() => []),
    listSubjects().catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Lớp học</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          Mỗi lớp thuộc một giáo viên phụ trách. Giáo viên phụ trách (hoặc quản trị viên) tạo
          được đề cho lớp, thêm học sinh bằng email và giao đề cho lớp.
        </p>
      </div>

      <ClassroomManager
        initialClassrooms={classrooms}
        subjects={subjects}
        isAdmin={session.user.role === "ADMIN"}
      />
    </div>
  );
}
