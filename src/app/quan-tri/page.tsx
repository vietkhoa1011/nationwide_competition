import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminApplicationsTable } from "@/features/admin/components/admin-applications-table";
import { AdminUsersTable } from "@/features/admin/components/admin-users-table";
import {
  DEFAULT_ADMIN_PAGE_SIZE,
  adminTeacherApplicationListQuerySchema,
  adminUserListQuerySchema,
} from "@/features/admin/schemas/admin.schemas";
import {
  listAdminTeacherApplications,
  listAdminUsers,
} from "@/features/admin/services/admin-service";
import { readSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Bảng điều khiển quản trị — Luyện Thi 2027",
  description: "Quản lý tài khoản, xử lý đơn xin quyền giáo viên và theo dõi hoạt động luyện đề.",
};

const LOGIN_HREF = "/dang-nhap?next=%2Fquan-tri";

/**
 * Bảng điều khiển quản trị. Quyền được kiểm tra ngay trên server: khách ẩn danh bị
 * đưa sang trang đăng nhập, còn người dùng đã đăng nhập nhưng không phải quản trị
 * viên nhận 404 để không lộ sự tồn tại của trang (khác với 403 của API).
 */
export default async function AdminDashboardPage() {
  const session = await readSession();

  if (session.status !== "authenticated") {
    redirect(LOGIN_HREF);
  }

  if (session.user.role !== "ADMIN") {
    notFound();
  }

  // Dùng lại đúng schema của route handler nên trang đầu khi tải server luôn trùng
  // với dữ liệu mà client sẽ tải lại sau đó.
  const userQuery = adminUserListQuerySchema.parse({
    search: "",
    page: "1",
    pageSize: String(DEFAULT_ADMIN_PAGE_SIZE),
  });
  const applicationQuery = adminTeacherApplicationListQuerySchema.parse({
    status: "PENDING",
    page: "1",
    pageSize: String(DEFAULT_ADMIN_PAGE_SIZE),
  });

  // DB chưa sẵn sàng thì trang vẫn trả 200; client tự gọi API và hiển thị ErrorBlock.
  const [applications, users] = await Promise.allSettled([
    listAdminTeacherApplications(applicationQuery),
    listAdminUsers(userQuery),
  ]);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/tai-khoan"
          className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
        >
          ← Tài khoản của tôi
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Bảng điều khiển quản trị</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
          Duyệt đơn xin quyền giáo viên và quản lý trạng thái tài khoản người dùng. Mọi thao tác đều
          được máy chủ kiểm tra quyền lại một lần nữa trước khi ghi vào cơ sở dữ liệu.
        </p>
      </div>

      <section className="space-y-4" aria-labelledby="admin-applications-heading">
        <div className="space-y-1">
          <h2 id="admin-applications-heading" className="text-lg font-bold text-slate-900">
            Đơn xin quyền giáo viên
          </h2>
          <p className="text-sm text-slate-600">
            Duyệt đơn sẽ nâng vai trò tài khoản lên giáo viên; từ chối kèm lý do để người nộp chỉnh
            sửa và gửi lại.
          </p>
        </div>

        <AdminApplicationsTable
          initialData={applications.status === "fulfilled" ? applications.value : undefined}
        />
      </section>

      <section className="space-y-4" aria-labelledby="admin-users-heading">
        <div className="space-y-1">
          <h2 id="admin-users-heading" className="text-lg font-bold text-slate-900">
            Người dùng
          </h2>
          <p className="text-sm text-slate-600">
            Khoá tài khoản sẽ đăng xuất mọi phiên đang mở của người đó. Tài khoản quản trị viên không
            thể bị khoá từ giao diện này.
          </p>
        </div>

        <AdminUsersTable
          initialData={users.status === "fulfilled" ? users.value : undefined}
          currentUserId={session.user.id}
        />
      </section>
    </div>
  );
}
