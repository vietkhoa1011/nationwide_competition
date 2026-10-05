"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody } from "@/components/ui/card";
import { Alert, ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { FormField, TextAreaField } from "@/features/auth/components/form-field";
import { collectFieldErrors } from "@/features/auth/schemas/auth.schemas";
import { USER_ROLE_LABELS } from "@/features/auth/types";
import { useSubjects } from "@/features/exams/hooks/use-exams";
import type { SubjectDto } from "@/features/exams/types";
import {
  useMyTeacherApplication,
  useSubmitTeacherApplication,
} from "@/features/teacher-applications/hooks/use-teacher-application";
import {
  MIN_MOTIVATION_LENGTH,
  teacherApplicationBodySchema,
} from "@/features/teacher-applications/schemas/teacher-application.schemas";
import { TEACHER_APPLICATION_STATUS_LABELS } from "@/features/teacher-applications/services/teacher-application-core";
import type {
  MyTeacherApplicationDto,
  TeacherApplicationDto,
} from "@/features/teacher-applications/types";
import { formatDateTime } from "@/lib/utils";

const STATUS_TONES: Record<TeacherApplicationDto["status"], "amber" | "emerald" | "rose"> = {
  PENDING: "amber",
  APPROVED: "emerald",
  REJECTED: "rose",
};

interface FormValues {
  school: string;
  subjectId: string;
  experienceYears: string;
  contactPhone: string;
  motivation: string;
}

const EMPTY_FORM: FormValues = {
  school: "",
  subjectId: "",
  experienceYears: "",
  contactPhone: "",
  motivation: "",
};

/** Tóm tắt các trường tuỳ chọn người dùng đã điền. */
function describeApplication(application: TeacherApplicationDto): string {
  const parts: string[] = [];
  if (application.school) parts.push(application.school);
  if (application.subjectName) parts.push(`Môn ${application.subjectName}`);
  if (application.experienceYears !== null) {
    parts.push(`${application.experienceYears} năm kinh nghiệm`);
  }
  if (application.contactPhone) parts.push(application.contactPhone);
  return parts.join(" · ");
}

/** Thẻ tóm tắt đơn gần nhất kèm badge trạng thái và ghi chú của quản trị viên. */
function ApplicationSummary({ application }: { application: TeacherApplicationDto }) {
  const summary = describeApplication(application);

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONES[application.status]}>
            {TEACHER_APPLICATION_STATUS_LABELS[application.status]}
          </Badge>
          <span className="text-xs text-slate-500">
            {`Gửi lúc ${formatDateTime(application.createdAt)}`}
          </span>
          {application.reviewedAt ? (
            <span className="text-xs text-slate-500">
              {`· Xử lý lúc ${formatDateTime(application.reviewedAt)}`}
            </span>
          ) : null}
        </div>

        {summary ? <p className="text-sm text-slate-600">{summary}</p> : null}

        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
          {application.motivation}
        </p>

        {application.reviewNote ? (
          <Alert
            tone={application.status === "REJECTED" ? "warning" : "info"}
            title="Phản hồi từ quản trị viên"
          >
            <p className="whitespace-pre-line">{application.reviewNote}</p>
          </Alert>
        ) : null}
      </CardBody>
    </Card>
  );
}

/** Biểu mẫu nộp đơn: kiểm tra dữ liệu bằng đúng schema API dùng trước khi gửi lên. */
function ApplicationForm({
  subjects,
  defaultValues,
}: {
  subjects: SubjectDto[];
  defaultValues?: FormValues;
}) {
  const submit = useSubmitTeacherApplication();
  const [values, setValues] = useState<FormValues>(defaultValues ?? EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function update<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Kiểm tra ngay ở trình duyệt bằng ĐÚNG schema mà API dùng, để lỗi hiện dưới ô nhập.
    const parsed = teacherApplicationBodySchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(collectFieldErrors(parsed.error));
      return;
    }

    setFieldErrors({});
    submit.mutate(parsed.data, {
      onSuccess: () => {
        setValues(EMPTY_FORM);
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="application-school"
          label="Trường/Cơ sở đang công tác"
          placeholder="Ví dụ: THCS Nguyễn Du, Hà Nội"
          value={values.school}
          error={fieldErrors.school}
          onChange={(event) => update("school", event.target.value)}
        />

        <div className="space-y-1.5">
          <label
            htmlFor="application-subject"
            className="block text-sm font-semibold text-slate-700"
          >
            Môn học giảng dạy
          </label>
          <select
            id="application-subject"
            value={values.subjectId}
            onChange={(event) => update("subjectId", event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-sky-500"
          >
            <option value="">— Chưa chọn —</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          {fieldErrors.subjectId ? (
            <p className="text-xs font-semibold text-rose-600">{fieldErrors.subjectId}</p>
          ) : (
            <p className="text-xs text-slate-500">Có thể bổ sung sau khi đơn được duyệt.</p>
          )}
        </div>

        <FormField
          id="application-experience"
          label="Số năm kinh nghiệm giảng dạy"
          type="number"
          min={0}
          max={60}
          inputMode="numeric"
          value={values.experienceYears}
          error={fieldErrors.experienceYears}
          onChange={(event) => update("experienceYears", event.target.value)}
        />

        <FormField
          id="application-phone"
          label="Số điện thoại liên hệ"
          type="tel"
          placeholder="0987 654 321"
          value={values.contactPhone}
          error={fieldErrors.contactPhone}
          onChange={(event) => update("contactPhone", event.target.value)}
        />
      </div>

      <TextAreaField
        id="application-motivation"
        label="Giới thiệu bản thân và lý do muốn trở thành giáo viên"
        rows={6}
        placeholder="Kinh nghiệm giảng dạy, các lớp đã phụ trách, dự định đóng góp nội dung cho kho đề…"
        value={values.motivation}
        error={fieldErrors.motivation}
        hint={`Tối thiểu ${MIN_MOTIVATION_LENGTH} ký tự. Quản trị viên dựa vào phần này để duyệt đơn.`}
        onChange={(event) => update("motivation", event.target.value)}
      />

      {submit.isError ? (
        <Alert tone="error" title="Không gửi được đơn">
          <p>{submit.error.message}</p>
        </Alert>
      ) : null}

      <Button type="submit" disabled={submit.isPending}>
        {submit.isPending ? "Đang gửi đơn…" : "Gửi đơn xin quyền giáo viên"}
      </Button>
    </form>
  );
}

export function TeacherApplicationPanel({
  initialState,
  subjects: initialSubjects,
}: {
  /** Trạng thái nạp sẵn từ Server Component (không có khi truy vấn phía server lỗi). */
  initialState?: MyTeacherApplicationDto;
  subjects?: SubjectDto[];
}) {
  const stateQuery = useMyTeacherApplication(initialState);
  const subjectsQuery = useSubjects(initialSubjects);

  const state = stateQuery.data;

  if (!state && stateQuery.isPending) {
    return <LoadingBlock message="Đang kiểm tra đơn của bạn…" />;
  }

  if (!state) {
    return (
      <ErrorBlock
        error={stateQuery.error}
        title="Không tải được thông tin đơn"
        onRetry={() => void stateQuery.refetch()}
      />
    );
  }

  if (state.role !== "STUDENT") {
    return (
      <Alert tone="success" title={`Tài khoản đang ở vai trò ${USER_ROLE_LABELS[state.role]}`}>
        <p>
          Bạn đã có quyền đăng nội dung nên không cần nộp đơn.{" "}
          <Link href="/de-thi" className="font-semibold underline underline-offset-4">
            Vào kho đề thi
          </Link>{" "}
          để bắt đầu.
        </p>
      </Alert>
    );
  }

  const application = state.application;

  if (application?.status === "PENDING") {
    return (
      <div className="space-y-4">
        <Alert tone="info" title="Đơn của bạn đang chờ duyệt">
          <p>
            Bạn sẽ được cấp quyền giáo viên ngay khi quản trị viên duyệt đơn. Trong lúc chờ, bạn vẫn
            có thể luyện tập bình thường.
          </p>
        </Alert>
        <ApplicationSummary application={application} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {application?.status === "REJECTED" ? (
        <Alert tone="warning" title="Đơn trước đây đã bị từ chối">
          <p>
            Bạn có thể chỉnh sửa thông tin và gửi lại đơn mới. Hãy bổ sung phần giới thiệu để quản
            trị viên có thêm căn cứ duyệt.
          </p>
        </Alert>
      ) : null}

      {application?.status === "APPROVED" ? (
        <Alert tone="success" title="Đơn đã được duyệt">
          <p>
            Tài khoản của bạn đã được cấp quyền giáo viên.{" "}
            <Link href="/tai-khoan" className="font-semibold underline underline-offset-4">
              Xem bảng điều khiển
            </Link>{" "}
            để biết các bước tiếp theo.
          </p>
        </Alert>
      ) : null}

      {application ? <ApplicationSummary application={application} /> : null}

      {subjectsQuery.isError ? (
        <Alert tone="warning" title="Không tải được danh sách môn học">
          <p>Bạn vẫn có thể nộp đơn; phần chọn môn học tạm thời để trống.</p>
        </Alert>
      ) : null}

      <ApplicationForm
        subjects={subjectsQuery.data ?? []}
        defaultValues={
          application
            ? {
                school: application.school ?? "",
                subjectId: application.subjectId ?? "",
                experienceYears:
                  application.experienceYears === null ? "" : String(application.experienceYears),
                contactPhone: application.contactPhone ?? "",
                motivation: application.motivation,
              }
            : undefined
        }
      />

      {application?.status === "REJECTED" ? (
        <p className="text-xs text-slate-500">
          Bấm <span className="font-semibold">Gửi đơn xin quyền giáo viên</span> để nộp lại đơn với
          nội dung đã chỉnh sửa.
        </p>
      ) : null}
    </div>
  );
}
