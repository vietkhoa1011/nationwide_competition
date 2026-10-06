import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

// CSS của KaTeX được nạp một lần cho toàn ứng dụng: công thức hiển thị giống nhau ở trình
// soạn thảo, trang xem trước, trang làm bài và trang kết quả. Font của KaTeX đi kèm gói npm
// và được Next xử lý như tài nguyên tĩnh khi build.
import "katex/dist/katex.min.css";

import { SiteHeader } from "@/components/layout/site-header";

import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Luyện Thi 2027 — Ôn luyện tốt nghiệp THPT",
  description:
    "Luyện đề thi thử tốt nghiệp THPT theo từng môn, chấm điểm tự động, xem lời giải chi tiết ngay sau khi nộp bài.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        <Providers>
          <SiteHeader />
          {/*
            Khung giao diện dùng hết bề ngang màn hình: site-header, main và footer đều `w-full`,
            không còn khung căn giữa (trước đây bị giới hạn bề rộng 72rem), nên nội dung không bị
            dồn vào giữa với hai dải trống hai bên. Chỉ giữ một khoảng đệm nhỏ (`px-4 sm:px-6`) để
            chữ không dính mép màn hình; các cột chữ dài vẫn tự giới hạn bề rộng riêng cho dễ đọc.
          */}
          <main className="w-full flex-1 px-4 py-8 sm:px-6">{children}</main>
          <footer className="border-t border-slate-200 bg-white py-6">
            <div className="w-full px-4 text-xs text-slate-500 sm:px-6">
              Luyện Thi 2027 · Dự án luyện đề tốt nghiệp THPT. Nội dung đề thi trong bản thử
              nghiệm chỉ mang tính minh hoạ.
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
