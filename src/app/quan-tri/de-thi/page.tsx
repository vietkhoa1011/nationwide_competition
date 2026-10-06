import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AuthoringExamTable } from "@/features/authoring/components/authoring-exam-table";
import { CreateExamForm } from "@/features/authoring/components/create-exam-form";
import { authoringExamListQuerySchema } from "@/features/authoring/schemas/authoring.schemas";
import { listAuthoringExams } from "@/features/authoring/services/authoring-service";
import { listClassrooms } from "@/features/classroom/services/classroom-service";
import { listSubjects } from "@/features/exams/services/exams-service";
import { readSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Quản lý đề thi — Luyện Thi 2027",
  description: "Quản trị viên tạo đề công khai hoặc đề cho lớp và theo dõi tình trạng xuất bản.",
};

const LOGIN_HREF = "/dang-nhap?next=%2Fquan-tri%2Fde-thi";

/**
 * Quản lý đề thi dành cho quản trị viên: xem MỌI đề trong hệ thống (công khai và của lớp),
 * tạo đề công khai hoặc tạo đề cho một lớp bất kỳ.
 *
 * Người dùng đã đăng nhập nhưng không phải quản trị viên nhận 404 (không lộ sự tồn tại của
 * trang), đúng như quy ước của `/quan-tri`.
 */
export default async function AdminExamManagementPage() {
  const session = await readSession();

  if (session.status !== "authenticated") {
    redirect(LOGIN_HREF);
  }

  if (session.user.role !== "ADMIN") {
    notFound();
  }

  const actor = { id: session.user.id, role: session.user.role };
  const query = authoringExamListQuerySchema.parse({ page: "1", pageSize: "20" });

  const [exams, classrooms, subjects] = await Promise.all([
    listAuthoringExams(actor, query).catch(() => null),
    listClassrooms(actor, { all: "1" })
      .then((result) => result.items)
      .catch(() => []),
    listSubjects().catch(() => []),
  ]);

  if (!exams) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Quản lý đề thi</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          Đề công khai hiển thị cho mọi tài khoản đã đăng nhập sau khi xuất bản. Đề của lớp chỉ
          thành viên lớp truy cập được và phải được giáo viên phụ trách giao bài.
        </p>
      </div>

      <CreateExamForm subjects={subjects} classrooms={classrooms} isAdmin />

      <AuthoringExamTable
        exams={exams.items}
        emptyMessage="Hệ thống chưa có đề thi nào."
      />
    </div>
  );
}
