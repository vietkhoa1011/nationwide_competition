"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/card";
import { Spinner } from "@/components/ui/feedback";
import { useAuth, useLogout } from "@/features/auth/hooks/use-auth";
import { USER_ROLE_LABELS } from "@/features/auth/types";
import type { UserRole } from "@/generated/prisma/enums";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ROLE_TONES: Record<UserRole, "sky" | "violet" | "amber"> = {
  STUDENT: "sky",
  TEACHER: "violet",
  ADMIN: "amber",
};

const menuItemClassName =
  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900";

/**
 * Đóng menu khi bấm ra ngoài hoặc nhấn Escape. Trả về ref gắn vào phần tử bao quanh
 * để biết cú pháp bấm có nằm trong menu hay không.
 */
function useDismissableMenu(open: boolean, onDismiss: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        onDismiss();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onDismiss();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onDismiss]);

  return containerRef;
}

/** Chữ cái đầu của tên dùng làm ảnh đại diện, tránh phải tải ảnh từ dịch vụ ngoài. */
function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function UserMenu() {
  const router = useRouter();
  const auth = useAuth();
  const logout = useLogout();

  // Menu được remount qua `key` theo `pathname` ở SiteHeader, nhờ vậy nó tự đóng
  // sau khi điều hướng mà không cần đồng bộ state bằng useEffect.
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const containerRef = useDismissableMenu(open, close);

  function handleLogout() {
    close();
    logout.mutate(undefined, {
      onSettled: () => {
        router.push("/");
        router.refresh();
      },
    });
  }

  if (auth.isLoading) {
    return (
      <span className="flex items-center px-3 py-2 text-slate-400" aria-hidden="true">
        <Spinner className="size-4" />
      </span>
    );
  }

  if (!auth.user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/dang-nhap" className={buttonClassName("ghost", "sm")}>
          Đăng nhập
        </Link>
        <Link href="/dang-ky" className={buttonClassName("primary", "sm")}>
          Đăng ký
        </Link>
      </div>
    );
  }

  const user = auth.user;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
          {initialOf(user.name)}
        </span>
        <span className="hidden max-w-[9rem] truncate sm:inline">{user.name}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={cn("size-4 text-slate-400 transition-transform", open && "rotate-180")}
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60"
        >
          <div className="space-y-1 border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-bold text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            <Badge tone={ROLE_TONES[user.role]} className="mt-1">
              {USER_ROLE_LABELS[user.role]}
            </Badge>
          </div>

          <div className="p-1">
            <Link role="menuitem" href="/tai-khoan" className={menuItemClassName}>
              Tài khoản của tôi
            </Link>
            <Link role="menuitem" href="/lich-su" className={menuItemClassName}>
              Lịch sử làm bài
            </Link>
            <Link role="menuitem" href="/de-thi" className={menuItemClassName}>
              Kho đề thi
            </Link>
            {user.role === "STUDENT" ? (
              <Link role="menuitem" href="/xin-quyen-giao-vien" className={menuItemClassName}>
                Xin quyền giáo viên
              </Link>
            ) : null}
            {user.role === "ADMIN" ? (
              <Link role="menuitem" href="/quan-tri" className={menuItemClassName}>
                Bảng điều khiển quản trị
              </Link>
            ) : null}
          </div>

          <div className="border-t border-slate-100 p-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              disabled={logout.isPending}
              className={cn(menuItemClassName, "text-rose-600 hover:bg-rose-50 hover:text-rose-700")}
            >
              {logout.isPending ? "Đang đăng xuất…" : "Đăng xuất"}
            </button>
          </div>

          {logout.isError ? (
            <p className="border-t border-slate-100 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700">
              {logout.error.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
