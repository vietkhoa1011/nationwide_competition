"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody } from "@/components/ui/card";
import { Alert, ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { TextAreaField } from "@/features/auth/components/form-field";
import { USER_ROLE_LABELS } from "@/features/auth/types";
import {
  useAdminTeacherApplications,
  useReviewTeacherApplication,
  type AdminApplicationFilters,
} from "@/features/admin/hooks/use-admin";
import { DEFAULT_ADMIN_PAGE_SIZE } from "@/features/admin/schemas/admin.schemas";
import { TEACHER_APPLICATION_STATUS_LABELS } from "@/features/teacher-applications/services/teacher-application-core";
import type { TeacherApplicationStatus } from "@/generated/prisma/enums";
import type {
  AdminTeacherApplicationDto,
  AdminTeacherApplicationListDto,
} from "@/features/admin/types";
import { cn, formatDateTime } from "@/lib/utils";

const STATUS_TONES: Record<TeacherApplicationStatus, "amber" | "emerald" | "rose"> = {
  PENDING: "amber",
  APPROVED: "emerald",
  REJECTED: "rose",
};

const STATUS_TABS: { status: AdminApplicationFilters["status"]; label: string }[] = [
  { status: "PENDING", label: "Chờ duyệt" },
  { status: "APPROVED", label: "Đã duyệt" },
  { status: "REJECTED", label: "Bị từ chối" },
];

interface ReviewState {
  application: AdminTeacherApplicationDto;
  decision: "APPROVED" | "REJECTED";
}

/** Tóm tắt hồ sơ người nộp để quản trị viên nắm nhanh thông tin trước khi duyệt. */
function describeProfile(application: AdminTeacherApplicationDto): string {
  const parts: string[] = [];
  if (application.school) parts.push(application.school);
  if (application.subjectName) parts.push(`Môn ${application.subjectName}`);
  if (application.experienceYears !== null) {
    parts.push(`${application.experienceYears} năm kinh nghiệm`);
  }
  if (application.contactPhone) parts.push(application.contactPhone);
  return parts.join(" · ");
}

/**
 * Hàng đợi đơn xin quyền giáo viên.
 *
 * Mặc định mở ở tab "Chờ duyệt" vì đó là việc cần làm; bộ lọc trạng thái giữ trong
 * state cục bộ để không tranh tham số URL với bảng người dùng cùng trang.
 */
export function AdminApplicationsTable({
  initialData,
}: {
  /** Trang đầu của tab mặc định (PENDING) do Server Component nạp sẵn. */
  initialData?: AdminTeacherApplicationListDto;
}) {
  const [status, setStatus] = useState<AdminApplicationFilters["status"]>("PENDING");
  const [page, setPage] = useState(1);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filters: AdminApplicationFilters = {
    status,
    page,
    pageSize: DEFAULT_ADMIN_PAGE_SIZE,
  };

  // Dữ liệu nạp sẵn chỉ đúng cho tab mặc định ở trang 1.
  const applicationsQuery = useAdminTeacherApplications(
    filters,
    status === "PENDING" && page === 1 ? initialData : undefined,
  );
  const reviewApplication = useReviewTeacherApplication();

  const result = applicationsQuery.data;
  const currentPage = result?.page ?? page;
  const totalPages = result?.totalPages ?? 0;

  function switchStatus(next: AdminApplicationFilters["status"]) {
    setStatus(next);
    setPage(1);
    setReview(null);
    setFeedback(null);
  }

  function openReview(application: AdminTeacherApplicationDto, decision: ReviewState["decision"]) {
    setReview({ application, decision });
    setNote("");
    setNoteError(null);
    setFeedback(null);
    reviewApplication.reset();
  }

  function handleConfirm() {
    if (!review) {
      return;
    }

    // Từ chối mà không nêu lý do thì người nộp đơn không biết cần sửa gì.
    if (review.decision === "REJECTED" && note.trim() === "") {
      setNoteError("Vui lòng nhập lý do từ chối để người nộp đơn biết cần bổ sung gì.");
      return;
    }

    const target = review;
    reviewApplication.mutate(
      {
        applicationId: target.application.id,
        decision: target.decision,
        note: note.trim() === "" ? undefined : note,
      },
      {
        onSuccess: (updated) => {
          setReview(null);
          setNote("");
          setFeedback(
            target.decision === "APPROVED"
              ? `Đã duyệt đơn của ${updated.applicant.email}. Tài khoản này đã được cấp quyền giáo viên.`
              : `Đã từ chối đơn của ${updated.applicant.email}. Người dùng có thể nộp đơn mới.`,
          );
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Trạng thái đơn">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.status}
            type="button"
            role="tab"
            aria-selected={status === tab.status}
            onClick={() => switchStatus(tab.status)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors",
              status === tab.status
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-100",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {feedback ? <Alert tone="success">{feedback}</Alert> : null}

      {review ? (
        <Card>
          <CardBody className="space-y-3">
            <p className="text-sm font-semibold text-slate-800">
              {review.decision === "APPROVED"
                ? `Duyệt đơn của ${review.application.applicant.name} (${review.application.applicant.email})?`
                : `Từ chối đơn của ${review.application.applicant.name} (${review.application.applicant.email})?`}
            </p>
            <p className="text-sm text-slate-600">
              {review.decision === "APPROVED"
                ? `Tài khoản sẽ được chuyển sang vai trò ${USER_ROLE_LABELS.TEACHER} và có thể đăng đề thi.`
                : "Người dùng vẫn giữ vai trò học sinh và có thể nộp đơn mới sau khi chỉnh sửa."}
            </p>

            <TextAreaField
              id="admin-review-note"
              label={
                review.decision === "APPROVED"
                  ? "Ghi chú cho người nộp (không bắt buộc)"
                  : "Lý do từ chối (bắt buộc)"
              }
              rows={3}
              value={note}
              error={noteError ?? undefined}
              onChange={(event) => {
                setNote(event.target.value);
                setNoteError(null);
              }}
            />

            {reviewApplication.isError ? (
              <Alert tone="error" title="Không xử lý được đơn">
                <p>{reviewApplication.error.message}</p>
              </Alert>
            ) : null}

            <div className="flex gap-2">
              <Button
                variant={review.decision === "APPROVED" ? "success" : "danger"}
                size="sm"
                disabled={reviewApplication.isPending}
                onClick={handleConfirm}
              >
                {reviewApplication.isPending
                  ? "Đang xử lý…"
                  : review.decision === "APPROVED"
                    ? "Xác nhận duyệt"
                    : "Xác nhận từ chối"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setReview(null)}>
                Huỷ
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {applicationsQuery.isPending && !result ? (
        <LoadingBlock message="Đang tải danh sách đơn…" />
      ) : applicationsQuery.isError ? (
        <ErrorBlock
          error={applicationsQuery.error}
          title="Không tải được danh sách đơn"
          onRetry={() => void applicationsQuery.refetch()}
        />
      ) : !result || result.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          {status === "PENDING"
            ? "Không còn đơn nào đang chờ duyệt. Bạn đã xử lý hết hàng đợi."
            : `Không có đơn nào ở trạng thái "${TEACHER_APPLICATION_STATUS_LABELS[status]}".`}
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-500">{`Tổng cộng ${result.total} đơn.`}</p>

          <ul className="space-y-3">
            {result.items.map((application) => {
              const profile = describeProfile(application);

              return (
                <li key={application.id}>
                  <Card>
                    <CardBody className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-800">
                          {application.applicant.name}
                        </span>
                        <span className="text-xs text-slate-500">
                          {application.applicant.email}
                        </span>
                        <Badge tone={application.applicant.role === "STUDENT" ? "sky" : "violet"}>
                          {USER_ROLE_LABELS[application.applicant.role]}
                        </Badge>
                        <Badge tone={STATUS_TONES[application.status]}>
                          {TEACHER_APPLICATION_STATUS_LABELS[application.status]}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {`Gửi lúc ${formatDateTime(application.createdAt)}`}
                        </span>
                      </div>

                      {profile ? <p className="text-sm text-slate-600">{profile}</p> : null}

                      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                        {application.motivation}
                      </p>

                      {application.status !== "PENDING" ? (
                        <p className="text-xs text-slate-500">
                          {application.reviewedAt
                            ? `Xử lý lúc ${formatDateTime(application.reviewedAt)}`
                            : "Đã xử lý"}
                          {application.reviewNote ? ` · Ghi chú: ${application.reviewNote}` : ""}
                        </p>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => openReview(application, "APPROVED")}
                          >
                            Duyệt
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => openReview(application, "REJECTED")}
                          >
                            Từ chối
                          </Button>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 ? (
            <nav
              className="flex items-center justify-between gap-3"
              aria-label="Phân trang đơn xin quyền giáo viên"
            >
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                ← Trang trước
              </Button>
              <span className="text-sm text-slate-600">
                {`Trang ${currentPage} / ${totalPages}`}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                Trang sau →
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}