"use client";

import { Card, CardBody } from "@/components/ui/card";
import type { RichDoc } from "@/features/authoring/services/rich-content-core";
import type { ClassroomDto } from "@/features/authoring/types";
import { RichTextEditor } from "@/features/content/components/rich-text-editor";
import type { SubjectDto } from "@/features/exams/types";

export interface ExamInfoDraft {
  title: string;
  subjectId: string;
  durationMinutes: string;
  description: string;
  gradeLevel: string;
  year: string;
  scope: "PUBLIC" | "CLASS";
  classroomId: string;
  instructionsDoc: RichDoc;
}

/**
 * Bước 1 — Thông tin đề: tên, môn, khối, mô tả, hướng dẫn làm bài và phạm vi (công khai hay
 * thuộc lớp). Phần "thiết lập giao đề" (lịch mở/đóng, số lượt…) nằm ở bước 3 vì đó là thao
 * tác riêng với nội dung đề.
 *
 * Giáo viên không đổi được phạm vi (ô chọn chỉ hiện với quản trị viên), và máy chủ luôn
 * kiểm tra lại yêu cầu thay vì tin vào giao diện.
 */
export function ExamInfoForm({
  examId,
  draft,
  onChange,
  subjects,
  classrooms,
  canChooseScope,
  disabled,
}: {
  examId: string;
  draft: ExamInfoDraft;
  onChange: (patch: Partial<ExamInfoDraft>) => void;
  subjects: SubjectDto[];
  classrooms: ClassroomDto[];
  canChooseScope: boolean;
  disabled: boolean;
}) {
  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tên đề thi
            </span>
            <input
              value={draft.title}
              disabled={disabled}
              onChange={(event) => onChange({ title: event.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
              placeholder="Ví dụ: Kiểm tra 45 phút — Hàm số và đồ thị"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Môn học
            </span>
            <select
              value={draft.subjectId}
              disabled={disabled}
              onChange={(event) => onChange({ subjectId: event.target.value })}
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
              value={draft.durationMinutes}
              disabled={disabled}
              onChange={(event) => onChange({ durationMinutes: event.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Khối / lớp
            </span>
            <input
              type="number"
              min={1}
              max={12}
              value={draft.gradeLevel}
              disabled={disabled}
              onChange={(event) => onChange({ gradeLevel: event.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="10, 11, 12…"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Năm học
            </span>
            <input
              type="number"
              min={2000}
              max={2100}
              value={draft.year}
              disabled={disabled}
              onChange={(event) => onChange({ year: event.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Phạm vi đề
            </span>
            <select
              value={draft.scope}
              disabled={disabled || !canChooseScope}
              onChange={(event) =>
                onChange({ scope: event.target.value as ExamInfoDraft["scope"] })
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            >
              <option value="CLASS">Đề của lớp</option>
              <option value="PUBLIC">Đề công khai (chỉ quản trị viên)</option>
            </select>
            {!canChooseScope ? (
              <span className="block text-xs text-slate-500">
                Giáo viên chỉ tạo được đề thuộc lớp mình phụ trách.
              </span>
            ) : null}
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Lớp sở hữu
            </span>
            <select
              value={draft.classroomId}
              disabled={disabled || !canChooseScope || draft.scope === "PUBLIC"}
              onChange={(event) => onChange({ classroomId: event.target.value })}
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

          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Mô tả ngắn
            </span>
            <textarea
              value={draft.description}
              disabled={disabled}
              rows={2}
              onChange={(event) => onChange({ description: event.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
          </label>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Hướng dẫn làm bài (hỗ trợ công thức và ảnh)
          </span>
          <RichTextEditor
            key={`instructions-${examId}`}
            examId={examId}
            value={draft.instructionsDoc}
            disabled={disabled}
            ariaLabel="Hướng dẫn làm bài"
            onChange={(doc) => onChange({ instructionsDoc: doc })}
          />
        </div>
      </CardBody>
    </Card>
  );
}
