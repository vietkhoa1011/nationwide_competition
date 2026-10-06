"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Card, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { useCreateExam } from "@/features/authoring/hooks/use-authoring";
import type { ClassroomDto } from "@/features/authoring/types";
import type { SubjectDto } from "@/features/exams/types";
import { ApiClientError } from "@/lib/api-client";

/**
 * Biểu mẫu tạo đề nhanh. Sau khi tạo, người dùng được đưa thẳng vào trình soạn thảo để hoàn
 * thiện thông tin, câu hỏi rồi xuất bản.
 *
 * Giáo viên chỉ tạo được đề của lớp mình phụ trách; ô "đề công khai" chỉ hiện với quản trị
 * viên, và máy chủ vẫn kiểm tra lại phạm vi.
 */
export function CreateExamForm({
  subjects,
  classrooms,
  isAdmin,
  defaultClassroomId,
}: {
  subjects: SubjectDto[];
  classrooms: ClassroomDto[];
  isAdmin: boolean;
  defaultClassroomId?: string;
}) {
  const router = useRouter();
  const createExam = useCreateExam();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [scope, setScope] = useState<"PUBLIC" | "CLASS">(isAdmin ? "PUBLIC" : "CLASS");
  const [classroomId, setClassroomId] = useState(defaultClassroomId ?? classrooms[0]?.id ?? "");
  const [durationMinutes, setDurationMinutes] = useState("45");
  const [gradeLevel, setGradeLevel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (title.trim().length < 3) {
      setError("Tên đề thi cần ít nhất 3 ký tự.");
      return;
    }
    if (!subjectId) {
      setError("Hãy chọn môn học.");
      return;
    }
    if (scope === "CLASS" && !classroomId) {
      setError("Hãy chọn lớp sở hữu đề.");
      return;
    }

    try {
      const exam = await createExam.mutateAsync({
        title: title.trim(),
        subjectId,
        scope,
        classroomId: scope === "CLASS" ? classroomId : null,
        durationMinutes: Number(durationMinutes) || 45,
        gradeLevel: gradeLevel ? Number(gradeLevel) : null,
      });
      router.push(`/giao-vien/de-thi/${exam.id}/soan`);
    } catch (submitError) {
      setError(
        submitError instanceof ApiClientError
          ? submitError.message
          : "Không tạo được đề thi. Vui lòng thử lại.",
      );
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
      >
        + Tạo đề thi mới
      </button>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">Tạo đề thi mới (bản nháp)</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tên đề thi
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ví dụ: Kiểm tra giữa kỳ I — Giải tích 12"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Môn học
            </span>
            <select
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— Chọn môn —</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Thời gian làm bài (phút)
            </span>
            <input
              type="number"
              min={1}
              max={600}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Phạm vi
            </span>
            <select
              value={scope}
              disabled={!isAdmin}
              onChange={(event) => setScope(event.target.value as "PUBLIC" | "CLASS")}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            >
              <option value="CLASS">Đề của lớp</option>
              <option value="PUBLIC">Đề công khai (chỉ quản trị viên)</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Lớp sở hữu
            </span>
            <select
              value={classroomId}
              disabled={scope === "PUBLIC"}
              onChange={(event) => setClassroomId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            >
              <option value="">— Chọn lớp —</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Khối / lớp
            </span>
            <input
              type="number"
              min={1}
              max={12}
              value={gradeLevel}
              onChange={(event) => setGradeLevel(event.target.value)}
              placeholder="10, 11, 12…"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={createExam.isPending}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {createExam.isPending ? "Đang tạo…" : "Tạo và soạn đề"}
          </button>
        </div>
      </CardBody>
    </Card>
  );
}
