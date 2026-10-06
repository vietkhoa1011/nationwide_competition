"use client";

import { Badge, Card, CardBody } from "@/components/ui/card";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { useMyClassrooms } from "@/features/authoring/hooks/use-classrooms";
import type { StudentClassExamDto, StudentClassroomDto } from "@/features/authoring/types";
import { StartAttemptButton } from "@/features/exams/components/start-attempt-button";
import { formatDateTime, formatDurationMinutes, formatScore } from "@/lib/utils";

const WINDOW_LABELS: Record<StudentClassExamDto["window"], { text: string; tone: "amber" | "emerald" | "rose" }> = {
  NOT_OPEN: { text: "Chưa mở", tone: "amber" },
  OPEN: { text: "Đang mở", tone: "emerald" },
  CLOSED: { text: "Đã đóng", tone: "rose" },
};

/**
 * Trang lớp học của học sinh: những đề giáo viên đã giao cho lớp mình. Trạng thái cửa sổ làm
 * bài, số lượt còn lại và lý do chưa làm được đều do máy chủ tính — giao diện chỉ hiển thị.
 */
export function StudentClassroomList({
  initialItems,
}: {
  initialItems?: StudentClassroomDto[];
}) {
  const classroomsQuery = useMyClassrooms(initialItems ? { items: initialItems } : undefined);

  if (classroomsQuery.isPending) {
    return <LoadingBlock message="Đang tải lớp học…" />;
  }

  if (classroomsQuery.isError) {
    return (
      <ErrorBlock
        error={classroomsQuery.error}
        title="Không tải được lớp học"
        onRetry={() => void classroomsQuery.refetch()}
      />
    );
  }

  const classrooms = classroomsQuery.data?.items ?? [];

  if (classrooms.length === 0) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-slate-600">
            Bạn chưa tham gia lớp học nào. Hãy liên hệ giáo viên để được thêm vào lớp bằng email
            tài khoản này.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {classrooms.map((classroom) => (
        <section key={classroom.id} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">{classroom.name}</h2>
            {classroom.subjectName ? <Badge tone="sky">{classroom.subjectName}</Badge> : null}
            {classroom.gradeLevel ? <Badge>{`Khối ${classroom.gradeLevel}`}</Badge> : null}
            <span className="text-xs text-slate-500">{`GV: ${classroom.teacherName}`}</span>
          </div>

          {classroom.exams.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
              Lớp chưa có đề nào được giao.
            </p>
          ) : (
            <ul className="space-y-3">
              {classroom.exams.map((exam) => {
                const window = WINDOW_LABELS[exam.window];
                return (
                  <li key={exam.assignmentId}>
                    <Card>
                      <CardBody className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-800">{exam.title}</p>
                            <p className="text-xs text-slate-500">
                              {`${exam.subjectName} · ${exam.questionCount} câu · ${formatScore(
                                exam.totalPoints,
                              )} điểm · ${formatDurationMinutes(exam.durationMinutes)}`}
                            </p>
                          </div>
                          <Badge tone={window.tone}>{window.text}</Badge>
                        </div>

                        <p className="text-xs text-slate-500">
                          {`${exam.opensAt ? `Mở ${formatDateTime(exam.opensAt)}` : "Mở ngay"} · ${
                            exam.closesAt ? `Đóng ${formatDateTime(exam.closesAt)}` : "Không đặt giờ đóng"
                          } · ${
                            exam.allowedAttempts
                              ? `Đã làm ${exam.attemptsUsed}/${exam.allowedAttempts} lượt`
                              : `Đã làm ${exam.attemptsUsed} lượt`
                          }`}
                        </p>

                        {exam.canStart ? (
                          <StartAttemptButton examId={exam.examId} label="Bắt đầu làm bài" />
                        ) : (
                          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                            {exam.canStartBlockedReason ?? "Chưa thể làm bài."}
                          </p>
                        )}
                      </CardBody>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
