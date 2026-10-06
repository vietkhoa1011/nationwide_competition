"use client";

import { useState } from "react";

import { Card, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import {
  useClassroomAssignments,
  useDeleteAssignment,
  useSaveAssignment,
} from "@/features/authoring/hooks/use-classrooms";
import type { AuthoringExamDetailDto } from "@/features/authoring/types";
import { ApiClientError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";

/** `datetime-local` cần chuỗi giờ địa phương không kèm hậu tố Z. */
function toLocalInputValue(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** Chuỗi giờ địa phương → ISO (UTC) để máy chủ lưu đúng thời điểm. */
function toIsoOrNull(value: string): string | null {
  if (!value.trim()) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

interface AssignmentFormState {
  title: string;
  opensAt: string;
  closesAt: string;
  durationMinutes: string;
  allowedAttempts: string;
  revealAnswersAt: string;
}

const EMPTY_FORM: AssignmentFormState = {
  title: "",
  opensAt: "",
  closesAt: "",
  durationMinutes: "",
  allowedAttempts: "",
  revealAnswersAt: "",
};

/**
 * Bước 3 — Giao đề cho lớp. Đây là thao tác RIÊNG với việc xuất bản nội dung: đề phải đã
 * xuất bản thì mới giao được. Lịch mở/đóng, thời lượng, số lượt và mốc xem đáp án thuộc
 * lần giao đề chứ không nằm trong nội dung đề.
 */
export function AssignmentPanel({
  exam,
  canManage,
}: {
  exam: AuthoringExamDetailDto;
  canManage: boolean;
}) {
  const classroomId = exam.classroomId ?? "";
  const assignmentsQuery = useClassroomAssignments(classroomId);
  const saveAssignment = useSaveAssignment(classroomId);
  const deleteAssignment = useDeleteAssignment(classroomId);

  const [formDraft, setFormDraft] = useState<{
    sourceId: string;
    values: AssignmentFormState;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existing = (assignmentsQuery.data ?? []).find((item) => item.examId === exam.id) ?? null;

  // Trạng thái form được suy ra từ lần giao đề hiện có (không đồng bộ bằng effect), nên khi
  // dữ liệu từ server đổi thì form tự cập nhật mà không cần setState trong useEffect.
  const sourceId = existing?.id ?? "new";
  const form: AssignmentFormState =
    formDraft && formDraft.sourceId === sourceId
      ? formDraft.values
      : existing
        ? {
            title: existing.title ?? "",
            opensAt: toLocalInputValue(existing.opensAt),
            closesAt: toLocalInputValue(existing.closesAt),
            durationMinutes: existing.durationMinutes ? String(existing.durationMinutes) : "",
            allowedAttempts: existing.allowedAttempts ? String(existing.allowedAttempts) : "",
            revealAnswersAt: toLocalInputValue(existing.revealAnswersAt),
          }
        : EMPTY_FORM;
  const setForm = (values: AssignmentFormState) => setFormDraft({ sourceId, values });

  if (exam.scope !== "CLASS" || !classroomId) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-slate-600">
            Đề công khai không cần giao cho lớp: học sinh đăng nhập sẽ thấy đề trong kho đề sau
            khi đề được xuất bản.
          </p>
        </CardBody>
      </Card>
    );
  }

  if (!canManage) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-slate-600">
            Chỉ giáo viên phụ trách lớp hoặc quản trị viên mới giao đề cho lớp này.
          </p>
        </CardBody>
      </Card>
    );
  }

  const handleSubmit = async () => {
    setError(null);
    setNotice(null);

    if (exam.status !== "PUBLISHED") {
      setError("Đề phải được xuất bản nội dung trước khi giao cho lớp.");
      return;
    }

    try {
      await saveAssignment.mutateAsync({
        examId: exam.id,
        title: form.title.trim() ? form.title.trim() : null,
        opensAt: toIsoOrNull(form.opensAt),
        closesAt: toIsoOrNull(form.closesAt),
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
        allowedAttempts: form.allowedAttempts ? Number(form.allowedAttempts) : null,
        revealAnswersAt: toIsoOrNull(form.revealAnswersAt),
      });
      setNotice(existing ? "Đã cập nhật lần giao đề." : "Đã giao đề cho lớp.");
    } catch (submitError) {
      setError(
        submitError instanceof ApiClientError
          ? submitError.message
          : "Không giao được đề. Vui lòng thử lại.",
      );
    }
  };

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900">
            {`Giao đề cho lớp ${exam.classroomName ?? ""}`.trim()}
          </h2>
          <p className="text-sm text-slate-600">
            Học sinh chỉ thấy đề trong mục lớp học của mình và chỉ làm được trong khoảng thời
            gian mở đề.
          </p>
        </div>

        {exam.status !== "PUBLISHED" ? (
          <Alert tone="warning">
            Đề chưa được xuất bản nội dung. Hãy bấm “Xuất bản đề” trước khi giao bài.
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tiêu đề hiển thị cho học sinh
            </span>
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Ví dụ: Kiểm tra 45 phút — tuần 8"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Mở đề lúc
            </span>
            <input
              type="datetime-local"
              value={form.opensAt}
              onChange={(event) => setForm({ ...form, opensAt: event.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Đóng đề lúc
            </span>
            <input
              type="datetime-local"
              value={form.closesAt}
              onChange={(event) => setForm({ ...form, closesAt: event.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Thời lượng làm bài (phút)
            </span>
            <input
              type="number"
              min={1}
              max={600}
              value={form.durationMinutes}
              onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })}
              placeholder={`Mặc định ${exam.durationMinutes}`}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Số lượt làm tối đa
            </span>
            <input
              type="number"
              min={1}
              max={20}
              value={form.allowedAttempts}
              onChange={(event) => setForm({ ...form, allowedAttempts: event.target.value })}
              placeholder="Bỏ trống = không giới hạn"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cho xem đáp án và lời giải từ lúc
            </span>
            <input
              type="datetime-local"
              value={form.revealAnswersAt}
              onChange={(event) => setForm({ ...form, revealAnswersAt: event.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <span className="block text-xs text-slate-500">
              Bỏ trống: học sinh xem được đáp án ngay sau khi nộp bài. Nếu đặt mốc trong tương
              lai, máy chủ sẽ loại đáp án và lời giải khỏi dữ liệu trả về.
            </span>
          </label>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        {existing ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {`Đã giao lúc ${formatDateTime(existing.createdAt)}${
              existing.allowedAttempts ? ` · tối đa ${existing.allowedAttempts} lượt` : ""
            }`}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          {existing ? (
            <button
              type="button"
              onClick={() => void deleteAssignment.mutateAsync({ assignmentId: existing.id })}
              disabled={deleteAssignment.isPending}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              Thu hồi giao đề
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saveAssignment.isPending}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {saveAssignment.isPending
              ? "Đang lưu…"
              : existing
                ? "Cập nhật lần giao đề"
                : "Giao đề cho lớp"}
          </button>
        </div>
      </CardBody>
    </Card>
  );
}
