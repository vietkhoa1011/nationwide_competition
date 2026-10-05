import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody } from "@/components/ui/card";
import { USER_ROLE_LABELS } from "@/features/auth/types";
import type { UserRole } from "@/generated/prisma/enums";
import { readSession } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Tài khoản của tôi — Luyện Thi 2027",
  description:
    "Xem vai trò tài khoản, tiến độ luyện đề và các thao tác dành riêng cho từng vai trò.",
};

const LOGIN_HREF = "/dang-nhap?next=%2Ftai-khoan";

const ROLE_TONES: Record<UserRole, "sky" | "violet" | "amber"> = {
  STUDENT: "sky",
  TEACHER: "violet",
  ADMIN: "amber",
};

/** Mô tả ngắn gọn quyền của từng vai trò để người dùng biết bước tiếp theo cần làm. */
const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  STUDENT:
    "Bạn có thể luyện mọi đề thi trong kho, lưu lịch sử làm bài và nộp đơn xin quyền giáo viên để đóng góp nội dung.",
  TEACHER:
    "Tài khoản đã được cấp quyền đăng nội dung. Giao diện soạn đề dành cho giáo viên đang được hoàn thiện, trong lúc đó bạn vẫn dùng được toàn bộ kho đề và lịch sử làm bài.",
  ADMIN:
    "Bạn quản lý tài khoản người dùng và duyệt đơn xin quyền giáo viên trong bảng điều khiển quản trị.",
};

/**
 * Trang tài khoản: điểm vào cho các thao tác phụ thuộc vai trò. Quyền được đọc từ
 * phiên trên server nên không cần gọi API ở phía client.
 */
export default async function AccountPage() {
  const session = await readSession();

  // Tài khoản bị khoá cũng bị đưa về trang đăng nhập: mọi thao tác ghi đều bị chặn ở API.
  if (session.status !== "authenticated") {
    redirect(LOGIN_HREF);
  }

  const { user } = session;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Tài khoản của tôi</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
          Quản lý tiến độ luyện đề và các quyền gắn với vai trò của bạn trong hệ thống.
        </p>
      </div>

      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-bold text-slate-900">{user.name}</p>
            <Badge tone={ROLE_TONES[user.role]}>{USER_ROLE_LABELS[user.role]}</Badge>
          </div>
          <p className="text-sm text-slate-600">{user.email}</p>
          <p className="text-xs text-slate-500">{`Tham gia từ ${formatDateTime(user.createdAt)}`}</p>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-700">
            {ROLE_DESCRIPTIONS[user.role]}
          </p>
        </CardBody>
      </Card>

      <section className="space-y-3" aria-labelledby="account-actions-heading">
        <h2 id="account-actions-heading" className="text-lg font-bold text-slate-900">
          Thao tác
        </h2>

        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/de-thi">Kho đề thi</ButtonLink>
          <ButtonLink href="/lich-su" variant="secondary">
            Lịch sử làm bài
          </ButtonLink>
          {user.role === "STUDENT" ? (
            <ButtonLink href="/xin-quyen-giao-vien" variant="secondary">
              Xin quyền giáo viên
            </ButtonLink>
          ) : null}
          {user.role === "ADMIN" ? (
            <ButtonLink href="/quan-tri" variant="secondary">
              Bảng điều khiển quản trị
            </ButtonLink>
          ) : null}
        </div>
      </section>
    </div>
  );
}
