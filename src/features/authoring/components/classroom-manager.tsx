"use client";

import { useState } from "react";

import { Badge, Card, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import {
  useAddClassroomMember,
  useClassroom,
  useClassroomAssignments,
  useClassrooms,
  useCreateClassroom,
  useRemoveClassroomMember,
} from "@/features/authoring/hooks/use-classrooms";
import type { ClassroomDto } from "@/features/authoring/types";
import type { SubjectDto } from "@/features/exams/types";
import { ApiClientError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";

/**
 * Quản lý lớp học của giáo viên: tạo lớp, xem thành viên và các đề đã giao. Lớp là "gốc" của
 * quyền soạn đề — giáo viên chỉ tạo được đề cho lớp do mình phụ trách.
 */
export function ClassroomManager({
  initialClassrooms,
  subjects,
  isAdmin,
}: {
  initialClassrooms: ClassroomDto[];
  subjects: SubjectDto[];
  isAdmin: boolean;
}) {
  const classroomsQuery = useClassrooms({}, { items: initialClassrooms });
  const createClassroom = useCreateClassroom();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [gradeLevel, setGradeLevel] = useState("12");
  const [error, setError] = useState<string | null>(null);

  const classrooms = classroomsQuery.data?.items ?? [];

  const handleCreate = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError("Tên lớp cần ít nhất 2 ký tự.");
      return;
    }
    try {
      const created = await createClassroom.mutateAsync({
        name: name.trim(),
        subjectId: subjectId || null,
        gradeLevel: gradeLevel ? Number(gradeLevel) : null,
      });
      setName("");
      setSelectedId(created.id);
    } catch (createError) {
      setError(
        createError instanceof ApiClientError ? createError.message : "Không tạo được lớp học.",
      );
    }
  };

  return (
    <div className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card>
        <CardBody className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">Tạo lớp học</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Tên lớp, ví dụ: 12A1 — Toán"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
            />
            <select
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— Môn (tuỳ chọn) —</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={12}
              value={gradeLevel}
              onChange={(event) => setGradeLevel(event.target.value)}
              placeholder="Khối"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={createClassroom.isPending}
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {createClassroom.isPending ? "Đang tạo…" : "Tạo lớp"}
            </button>
          </div>
        </CardBody>
      </Card>

      {classrooms.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-slate-600">
              Chưa có lớp học nào. Hãy tạo lớp trước khi soạn đề cho lớp.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {classrooms.map((classroom) => (
            <Card key={classroom.id}>
              <CardBody className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-800">{classroom.name}</p>
                  {classroom.subjectName ? <Badge tone="sky">{classroom.subjectName}</Badge> : null}
                  {classroom.gradeLevel ? <Badge>{`Khối ${classroom.gradeLevel}`}</Badge> : null}
                  {classroom.isOwner ? <Badge tone="violet">Lớp tôi phụ trách</Badge> : null}
                </div>
                <p className="text-xs text-slate-500">
                  {`${classroom.studentCount} thành viên · ${classroom.examCount} đề · ${classroom.assignmentCount} lần giao đề`}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedId(selectedId === classroom.id ? null : classroom.id)
                    }
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    {selectedId === classroom.id ? "Đóng" : "Thành viên & giao đề"}
                  </button>
                  {classroom.isOwner || isAdmin ? (
                    <a
                      href={`/giao-vien?classroomId=${classroom.id}`}
                      className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                    >
                      Soạn đề cho lớp
                    </a>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {selectedId ? (
        <ClassroomDetailPanel
          classroomId={selectedId}
          canManage={
            isAdmin || Boolean(classrooms.find((item) => item.id === selectedId)?.isOwner)
          }
        />
      ) : null}
    </div>
  );
}

/**
 * Chi tiết một lớp: danh sách thành viên (thêm theo email) và các lần giao đề. Chỉ chủ lớp
 * hoặc quản trị viên thấy được các nút thay đổi; máy chủ vẫn kiểm tra lại từng thao tác.
 */
export function ClassroomDetailPanel({
  classroomId,
  canManage,
}: {
  classroomId: string;
  canManage: boolean;
}) {
  const detailQuery = useClassroom(classroomId);
  const assignmentsQuery = useClassroomAssignments(classroomId);
  const addMember = useAddClassroomMember(classroomId);
  const removeMember = useRemoveClassroomMember(classroomId);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [error, setError] = useState<string | null>(null);

  const detail = detailQuery.data;

  if (detailQuery.isPending) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-slate-500">Đang tải thông tin lớp…</p>
        </CardBody>
      </Card>
    );
  }

  if (detailQuery.isError || !detail) {
    return <Alert tone="error">Không tải được thông tin lớp học.</Alert>;
  }

  const handleAddMember = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Hãy nhập email của người cần thêm.");
      return;
    }
    try {
      await addMember.mutateAsync({ email: email.trim(), role });
      setEmail("");
    } catch (addError) {
      setError(
        addError instanceof ApiClientError ? addError.message : "Không thêm được thành viên.",
      );
    }
  };

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">{`Lớp ${detail.name}`}</h2>
          <p className="text-xs text-slate-500">{`Giáo viên phụ trách: ${detail.ownerName}`}</p>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}

        {canManage ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Thêm thành viên theo email
              </span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="hocsinh@example.com"
                className="w-64 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Vai trò
              </span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as "STUDENT" | "TEACHER")}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="STUDENT">Học sinh</option>
                <option value="TEACHER">Giáo viên cùng lớp</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => void handleAddMember()}
              disabled={addMember.isPending}
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {addMember.isPending ? "Đang thêm…" : "Thêm vào lớp"}
            </button>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Thành viên</th>
                <th className="px-3 py-2">Vai trò</th>
                <th className="px-3 py-2">Tham gia</th>
                {canManage ? <th className="px-3 py-2">Thao tác</th> : null}
              </tr>
            </thead>
            <tbody>
              {detail.members.map((member) => (
                <tr key={member.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2">
                    <p className="font-semibold text-slate-700">{member.name}</p>
                    <p className="text-xs text-slate-500">{member.email}</p>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {member.role === "TEACHER" ? "Giáo viên" : "Học sinh"}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {formatDateTime(member.createdAt)}
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2">
                      {member.userId === detail.ownerId ? (
                        <span className="text-xs text-slate-400">Chủ lớp</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void removeMember.mutateAsync({ memberId: member.id })}
                          disabled={removeMember.isPending}
                          className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                        >
                          Xoá khỏi lớp
                        </button>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {`Đề đã giao cho lớp (${assignmentsQuery.data?.length ?? 0})`}
          </p>
          {(assignmentsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">
              Chưa giao đề nào. Mở đề của lớp trong trình soạn thảo để giao bài ở bước 3.
            </p>
          ) : (
            <ul className="space-y-2">
              {(assignmentsQuery.data ?? []).map((assignment) => (
                <li
                  key={assignment.id}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <p className="font-semibold text-slate-700">{assignment.examTitle}</p>
                  <p className="text-xs text-slate-500">
                    {`${assignment.examStatus === "PUBLISHED" ? "Đã xuất bản" : "Chưa xuất bản"} · ${
                      assignment.opensAt ? `mở ${formatDateTime(assignment.opensAt)}` : "mở"
                    } → ${assignment.closesAt ? formatDateTime(assignment.closesAt) : "không đóng"}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}