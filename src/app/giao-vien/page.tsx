import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AuthoringExamTable } from "@/features/authoring/components/authoring-exam-table";
import { ClassroomManager } from "@/features/authoring/components/classroom-manager";
import { CreateExamForm } from "@/features/authoring/components/create-exam-form";
import { authoringExamListQuerySchema } from "@/features/authoring/schemas/authoring.schemas";
import { listAuthoringExams } from "@/features/authoring/services/authoring-service";
import { listClassrooms } from "@/features/classroom/services/classroom-service";
import { listSubjects } from "@/features/exams/services/exams-service";
import { readSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Khu vực giáo viên — Luyện Thi 2027",
  description: "Tạo đề thi, soạn câu hỏi có công thức và hình ảnh, quản lý lớp học và giao đề.",
};

const LOGIN_HREF = "/dang-nhap?next=%2Fgiao-vien";

/**
 * Trang làm việc của giáo viên: danh sách đề được quản lý, biểu mẫu tạo đề và các lớp học.
 *
 * Quyền được kiểm tra ngay trên server: khách ẩn danh sang trang đăng nhập, học sinh được
 * đưa về khu vực lớp học của mình (khu vực soạn đề không dành cho học sinh).
 */
export default async function TeacherWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ classroomId?: string }>;
}) {
  const session = await readSession();

  if (session.status !== "authenticated") {
    redirect(LOGIN_HREF);
  }

  if (session.user.role === "STUDENT") {
    redirect("/lop-hoc");
  }

  const actor = { id: session.user.id, role: session.user.role };
  const params = await searchParams;
  const query = authoringExamListQuerySchema.parse({ page: "1", pageSize: "10" });

  // DB chưa sẵn sàng thì trang vẫn trả 200; các bảng phía client tự hiển thị lỗi tiếng Việt.
  const [exams, classrooms, subjects] = await Promise.all([
    listAuthoringExams(actor, query).catch(() => null),
    listClassrooms(actor, {})
      .then((result) => result.items)
      .catch(() => []),
    listSubjects().catch(() => []),
  ]);

  if (!exams) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/tai-khoan"
          className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
        >
          ← Tài khoản của tôi
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Khu vực giáo viên</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          Soạn đề theo ba bước: thông tin đề, câu hỏi (hỗ trợ công thức KaTeX và ảnh tải lên),
          rồi kiểm tra và xuất bản. Đề của lớp do giáo viên phụ trách lớp quản lý; đề công khai
          do quản trị viên quản lý.
        </p>
      </div>

      <section className="space-y-4" aria-labelledby="teacher-exams-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 id="teacher-exams-heading" className="text-lg font-bold text-slate-900">
              Đề thi tôi quản lý
            </h2>
            <p className="text-sm text-slate-600">
              Đề đã có lượt làm bài sẽ bị khoá nội dung; dùng “Tạo bản sao” nếu cần chỉnh sửa.
            </p>
          </div>
          <CreateExamForm
            subjects={subjects}
            classrooms={classrooms}
            isAdmin={session.user.role === "ADMIN"}
            defaultClassroomId={params.classroomId}
          />
        </div>

        <AuthoringExamTable
          exams={exams.items}
          emptyMessage="Bạn chưa có đề thi nào. Bấm “Tạo đề thi mới” để bắt đầu."
        />
      </section>

      <section className="space-y-4" aria-labelledby="teacher-classrooms-heading">
        <div className="space-y-1">
          <h2 id="teacher-classrooms-heading" className="text-lg font-bold text-slate-900">
            Lớp học của tôi
          </h2>
          <p className="text-sm text-slate-600">
            Thêm học sinh vào lớp bằng email, rồi giao đề cho lớp ở bước 3 của trình soạn thảo.
          </p>
        </div>

        <ClassroomManager
          initialClassrooms={classrooms}
          subjects={subjects}
          isAdmin={session.user.role === "ADMIN"}
        />
      </section>
    </div>
  );
}
