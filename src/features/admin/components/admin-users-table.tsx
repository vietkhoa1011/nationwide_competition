"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody } from "@/components/ui/card";
import { Alert, ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { TextAreaField } from "@/features/auth/components/form-field";
import { USER_ROLE_LABELS } from "@/features/auth/types";
import {
  useAdminUsers,
  useSetUserBanState,
  type AdminUserFilters,
} from "@/features/admin/hooks/use-admin";
import { DEFAULT_ADMIN_PAGE_SIZE } from "@/features/admin/schemas/admin.schemas";
import { ADMIN_USER_STATUS_LABELS } from "@/features/admin/services/admin-core";
import type { AdminUserListDto, AdminUserSummaryDto } from "@/features/admin/types";
import type { UserRole } from "@/generated/prisma/enums";
import { cn, formatDateTime } from "@/lib/utils";

const ROLE_TONES: Record<UserRole, "sky" | "violet" | "amber"> = {
  STUDENT: "sky",
  TEACHER: "violet",
  ADMIN: "amber",
};

const selectClassName =
  "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500";

interface BanDialogState {
  user: AdminUserSummaryDto;
  /** Khi mở khoá thì không cần lý do nên không hiện ô nhập. */
  mode: "ban" | "unban";
}

/**
 * Bảng người dùng cho quản trị viên.
 *
 * Bộ lọc được giữ trong state cục bộ (không đẩy lên URL) để trang quản trị có nhiều
 * bảng vẫn không tranh nhau các tham số `page`/`status` trên cùng một địa chỉ.
 */
export function AdminUsersTable({
  initialData,
  currentUserId,
}: {
  /** Trang đầu với bộ lọc mặc định do Server Component nạp sẵn. */
  initialData?: AdminUserListDto;
  /** Người đang đăng nhập: không cho tự khoá chính mình. */
  currentUserId: string;
}) {
  const [filters, setFilters] = useState<AdminUserFilters>({
    page: 1,
    pageSize: DEFAULT_ADMIN_PAGE_SIZE,
  });
  const [searchInput, setSearchInput] = useState("");
  const [dialog, setDialog] = useState<BanDialogState | null>(null);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  // Chỉ dùng dữ liệu nạp sẵn cho đúng trang đầu/bộ lọc mặc định.
  const usersQuery = useAdminUsers(filters, filters.page === 1 ? initialData : undefined);
  const banUser = useSetUserBanState();

  const result = usersQuery.data;
  const currentPage = result?.page ?? filters.page ?? 1;
  const totalPages = result?.totalPages ?? 0;

  function applyFilters(next: Partial<AdminUserFilters>) {
    setFilters((current) => ({ ...current, ...next, page: next.page ?? 1 }));
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters({ search: searchInput });
  }

  function openDialog(user: AdminUserSummaryDto) {
    setDialog({ user, mode: user.banned ? "unban" : "ban" });
    setReason("");
    setFeedback(null);
    banUser.reset();
  }

  function handleConfirm() {
    if (!dialog) {
      return;
    }

    const target = dialog;
    banUser.mutate(
      {
        userId: target.user.id,
        banned: target.mode === "ban",
        reason: target.mode === "ban" ? reason : undefined,
      },
      {
        onSuccess: (updated) => {
          setDialog(null);
          setFeedback(
            target.mode === "ban"
              ? `Đã khoá tài khoản ${updated.email}. Mọi phiên đang mở của tài khoản này cũng bị đăng xuất.`
              : `Đã mở khoá tài khoản ${updated.email}.`,
          );
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="admin-user-search" className="block text-xs font-semibold text-slate-600">
            Tìm theo tên hoặc email
          </label>
          <input
            id="admin-user-search"
            type="search"
            value={searchInput}
            placeholder="ví dụ: nguyen@example.com"
            onChange={(event) => setSearchInput(event.target.value)}
            className={cn(selectClassName, "w-64")}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="admin-user-role" className="block text-xs font-semibold text-slate-600">
            Vai trò
          </label>
          <select
            id="admin-user-role"
            value={filters.role ?? ""}
            onChange={(event) =>
              applyFilters({ role: (event.target.value || undefined) as AdminUserFilters["role"] })
            }
            className={selectClassName}
          >
            <option value="">Tất cả</option>
            <option value="STUDENT">Học sinh</option>
            <option value="TEACHER">Giáo viên</option>
            <option value="ADMIN">Quản trị viên</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="admin-user-status" className="block text-xs font-semibold text-slate-600">
            Trạng thái
          </label>
          <select
            id="admin-user-status"
            value={filters.status ?? ""}
            onChange={(event) =>
              applyFilters({
                status: (event.target.value || undefined) as AdminUserFilters["status"],
              })
            }
            className={selectClassName}
          >
            <option value="">Tất cả</option>
            <option value="active">Đang hoạt động</option>
            <option value="banned">Đã khoá</option>
          </select>
        </div>

        <Button type="submit" size="sm">
          Tìm kiếm
        </Button>
      </form>

      {feedback ? <Alert tone="success">{feedback}</Alert> : null}

      {dialog ? (
        <Card>
          <CardBody className="space-y-3">
            <p className="text-sm font-semibold text-slate-800">
              {dialog.mode === "ban"
                ? `Khoá tài khoản ${dialog.user.name} (${dialog.user.email})?`
                : `Mở khoá tài khoản ${dialog.user.name} (${dialog.user.email})?`}
            </p>

            {dialog.mode === "ban" ? (
              <TextAreaField
                id="admin-ban-reason"
                label="Lý do khoá (hiển thị cho người dùng khi họ đăng nhập)"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            ) : (
              <p className="text-sm text-slate-600">
                Người dùng sẽ đăng nhập và làm bài được trở lại ngay sau khi mở khoá.
              </p>
            )}

            {banUser.isError ? (
              <Alert tone="error" title="Không thực hiện được">
                <p>{banUser.error.message}</p>
              </Alert>
            ) : null}

            <div className="flex gap-2">
              <Button
                variant={dialog.mode === "ban" ? "danger" : "success"}
                size="sm"
                disabled={banUser.isPending}
                onClick={handleConfirm}
              >
                {banUser.isPending
                  ? "Đang xử lý…"
                  : dialog.mode === "ban"
                    ? "Xác nhận khoá"
                    : "Xác nhận mở khoá"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setDialog(null)}>
                Huỷ
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {usersQuery.isPending && !result ? (
        <LoadingBlock message="Đang tải danh sách người dùng…" />
      ) : usersQuery.isError ? (
        <ErrorBlock
          error={usersQuery.error}
          title="Không tải được danh sách người dùng"
          onRetry={() => void usersQuery.refetch()}
        />
      ) : !result || result.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          Không có tài khoản nào khớp bộ lọc hiện tại.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-500">{`Tổng cộng ${result.total} tài khoản.`}</p>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Tài khoản</th>
                  <th className="px-4 py-3 font-semibold">Vai trò</th>
                  <th className="px-4 py-3 font-semibold">Hoạt động</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={ROLE_TONES[user.role]}>{USER_ROLE_LABELS[user.role]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p>{`${user.attemptCount} lượt làm bài`}</p>
                      <p className="text-xs text-slate-500">
                        {user.pendingApplicationCount > 0
                          ? `${user.pendingApplicationCount} đơn chờ duyệt`
                          : `Tham gia ${formatDateTime(user.createdAt)}`}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={user.banned ? "rose" : "emerald"}>
                        {ADMIN_USER_STATUS_LABELS[user.banned ? "banned" : "active"]}
                      </Badge>
                      {user.banned && user.banReason ? (
                        <p className="mt-1 max-w-[16rem] text-xs text-slate-500">{user.banReason}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant={user.banned ? "success" : "danger"}
                        size="sm"
                        disabled={user.id === currentUserId || user.role === "ADMIN"}
                        title={
                          user.id === currentUserId
                            ? "Không thể tự khoá tài khoản của mình."
                            : user.role === "ADMIN"
                              ? "Không thể thay đổi trạng thái tài khoản quản trị viên."
                              : undefined
                        }
                        onClick={() => openDialog(user)}
                      >
                        {user.banned ? "Mở khoá" : "Khoá"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <nav className="flex items-center justify-between gap-3" aria-label="Phân trang người dùng">
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => applyFilters({ page: currentPage - 1 })}
              >
                ← Trang trước
              </Button>
              <span className="text-sm text-slate-600">
                {`Trang ${currentPage} / ${totalPages}`}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => applyFilters({ page: currentPage + 1 })}
              >
                Trang sau →
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}