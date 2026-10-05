import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

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
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
          <footer className="border-t border-slate-200 bg-white py-6">
            <div className="mx-auto w-full max-w-6xl px-4 text-xs text-slate-500 sm:px-6">
              Luyện Thi 2027 · Dự án luyện đề tốt nghiệp THPT. Nội dung đề thi trong bản thử
              nghiệm chỉ mang tính minh hoạ.
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}


