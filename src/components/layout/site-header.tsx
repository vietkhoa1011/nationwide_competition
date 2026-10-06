"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Trang chủ" },
  { href: "/de-thi", label: "Kho đề thi" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      {/* Thanh đầu trang dùng hết bề ngang màn hình, khớp với `main` (xem `src/app/layout.tsx`). */}
      <div className="flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-sky-600 text-sm font-bold text-white">
            27
          </span>
          <span className="text-base font-bold text-slate-900">
            Luyện Thi <span className="text-sky-700">2027</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="flex items-center gap-1" aria-label="Điều hướng chính">
            {navItems.map((item) => {
              const isActive =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                    isActive
                      ? "bg-sky-50 text-sky-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* `key` theo pathname: menu tự đóng khi điều hướng (component được remount). */}
          <UserMenu key={pathname} />
        </div>
      </div>
    </header>
  );
}
