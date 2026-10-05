import type { Metadata } from "next";
import Link from "next/link";

import { AttemptHistoryList } from "@/features/attempts/components/attempt-history-list";
import type { AttemptHistoryFilters } from "@/features/attempts/hooks/use-attempt";
import { attemptHistoryQuerySchema } from "@/features/attempts/schemas/attempt.schemas";
import { listAttemptHistory } from "@/features/attempts/services/attempts-service";
import type { AttemptOwnerRef } from "@/features/attempts/services/attempt-core";
import { readSession } from "@/lib/auth/session";
import { readSessionId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Lịch sử làm bài — Luyện Thi 2027",
  description:
    "Xem lại toàn bộ lượt luyện đề: bài đang làm dở, điểm số và các câu đã chốt theo từng đề thi.",
};

interface HistoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Chủ sở hữu lịch sử khi chỉ ĐỌC.
 *
 * Server Component không được ghi cookie, nên tuyệt đối không gọi `resolveAttemptOwner`
 * (hàm đó tạo cookie phiên mới cho khách). Ở đây chỉ đọc phiên sẵn có:
 * - đã đăng nhập: lấy theo `userId`, thấy được bài làm trên mọi thiết bị;
 * - khách đã có cookie phiên: chỉ lượt chưa gắn tài khoản của chính cookie này;
 * - chưa có cookie hoặc tài khoản bị khoá: không dựng sẵn dữ liệu, để client gọi API
 *   (`GET /api/attempts`) — nơi việc ghi cookie và kiểm tra quyền là hợp lệ.
 */
async function resolveReadOnlyOwner(): Promise<AttemptOwnerRef | null> {
  const session = await readSession();

  if (session.status === "authenticated") {
    return { sessionId: session.sessionId, userId: session.user.id };
  }

  if (session.status === "anonymous") {
    const sessionId = await readSessionId();
    return sessionId ? { sessionId, userId: null } : null;
  }

  return null;
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams;

  // Tái dùng đúng schema của route handler nên tham số sai (ví dụ `?page=abc`) được
  // xử lý giống nhau ở cả hai phía: rơi về trang đầu thay vì báo lỗi.
  const query = attemptHistoryQuerySchema.parse({
    page: firstValue(params.page),
    pageSize: firstValue(params.pageSize),
  });

  const filters: AttemptHistoryFilters = { page: query.page, pageSize: query.pageSize };

  const owner = await resolveReadOnlyOwner();

  // DB chưa sẵn sàng thì trang vẫn trả 200 và client tự thử lại rồi hiển thị ErrorBlock.
  const initialData = owner
    ? await listAttemptHistory(owner, query).catch(() => undefined)
    : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/de-thi"
          className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
        >
          ← Kho đề thi
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Lịch sử làm bài</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
          Mỗi lượt luyện đề đều được lưu lại. Bạn có thể tiếp tục bài đang làm dở, xem lại điểm số
          và lời giải của các lượt đã nộp.
        </p>
      </div>

      <AttemptHistoryList filters={filters} initialData={initialData} />
    </div>
  );
}
