import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  assertAssignmentWindowOrder,
  assertCanManageClassroom,
  assertStudentMayStartExam,
  canViewClassroom,
  effectiveDurationMinutes,
  parseOptionalDateInput,
  resolveAssignmentWindow,
  type ClassroomActor,
} from "@/features/classroom/services/classroom-core";
import type {
  AssignmentCreateBody,
  AssignmentUpdateBody,
  ClassroomCreateBody,
  ClassroomMemberBody,
  ClassroomUpdateBody,
} from "@/features/classroom/schemas/classroom.schemas";
import type {
  ClassroomDetailDto,
  ClassroomDto,
  ClassroomMemberDto,
  ExamAssignmentDto,
  StudentClassExamDto,
  StudentClassroomDto,
} from "@/features/authoring/types";
import { AppError } from "@/lib/errors";
import { getPrisma } from "@/lib/prisma";

/**
 * Truy vấn lớp học, thành viên và các lần giao đề. Quyền được kiểm tra trên dữ liệu đọc
 * từ database: chủ lớp (hoặc ADMIN) mới được quản lý lớp và giao đề, còn học sinh chỉ
 * thấy lớp mà mình là thành viên.
 */

const classroomSelect = {
  id: true,
  name: true,
  description: true,
  subjectId: true,
  gradeLevel: true,
  ownerId: true,
  createdAt: true,
  subject: { select: { name: true } },
  owner: { select: { name: true } },
  _count: { select: { members: true, exams: true, assignments: true } },
} as const;

const memberSelect = {
  id: true,
  userId: true,
  role: true,
  createdAt: true,
  user: { select: { name: true, email: true } },
} as const;

const assignmentSelect = {
  id: true,
  examId: true,
  classroomId: true,
  title: true,
  opensAt: true,
  closesAt: true,
  durationMinutes: true,
  allowedAttempts: true,
  revealAnswersAt: true,
  createdAt: true,
  exam: { select: { title: true, status: true } },
  classroom: { select: { name: true } },
} as const;

type ClassroomRow = Prisma.ClassroomGetPayload<{ select: typeof classroomSelect }>;
type MemberRow = Prisma.ClassroomMemberGetPayload<{ select: typeof memberSelect }>;
export type AssignmentRow = Prisma.ExamAssignmentGetPayload<{ select: typeof assignmentSelect }>;

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toClassroomDto(actor: ClassroomActor, row: ClassroomRow): ClassroomDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    subjectId: row.subjectId,
    subjectName: row.subject?.name ?? null,
    gradeLevel: row.gradeLevel,
    ownerId: row.ownerId,
    ownerName: row.owner.name,
    isOwner: row.ownerId === actor.id,
    studentCount: row._count.members,
    examCount: row._count.exams,
    assignmentCount: row._count.assignments,
    createdAt: row.createdAt.toISOString(),
  };
}

function toMemberDto(row: MemberRow): ClassroomMemberDto {
  return {
    id: row.id,
    userId: row.userId,
    name: row.user.name,
    email: row.user.email,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  };
}

function toAssignmentDto(row: AssignmentRow): ExamAssignmentDto {
  return {
    id: row.id,
    examId: row.examId,
    examTitle: row.exam.title,
    examStatus: row.exam.status,
    classroomId: row.classroomId,
    classroomName: row.classroom.name,
    title: row.title,
    opensAt: toIso(row.opensAt),
    closesAt: toIso(row.closesAt),
    durationMinutes: row.durationMinutes,
    allowedAttempts: row.allowedAttempts,
    revealAnswersAt: toIso(row.revealAnswersAt),
    createdAt: row.createdAt.toISOString(),
  };
}

async function requireClassroomForView(
  actor: ClassroomActor,
  classroomId: string,
): Promise<ClassroomRow> {
  const row = await getPrisma().classroom.findUnique({
    where: { id: classroomId },
    select: {
      ...classroomSelect,
      members: { select: { userId: true }, take: 500 },
    },
  });

  if (!row) {
    throw new AppError("CLASSROOM_NOT_FOUND", "Không tìm thấy lớp học.", 404);
  }

  const allowed = canViewClassroom(actor, {
    ownerId: row.ownerId,
    memberUserIds: row.members.map((member) => member.userId),
  });

  if (!allowed) {
    throw new AppError("FORBIDDEN", "Bạn không có quyền truy cập lớp học này.", 403);
  }

  return row;
}

export async function listClassrooms(
  actor: ClassroomActor,
  query: { all?: "0" | "1"; search?: string },
): Promise<{ items: ClassroomDto[] }> {
  const prisma = getPrisma();
  const where: Prisma.ClassroomWhereInput = {};

  const seeAll = actor.role === "ADMIN" && query.all === "1";
  if (!seeAll) {
    where.OR = [{ ownerId: actor.id }, { members: { some: { userId: actor.id } } }];
  }
  if (query.search) {
    where.name = { contains: query.search, mode: "insensitive" };
  }

  const rows = await prisma.classroom.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: 100,
    select: classroomSelect,
  });

  return { items: rows.map((row) => toClassroomDto(actor, row)) };
}

export async function createClassroom(
  actor: ClassroomActor,
  body: ClassroomCreateBody,
): Promise<ClassroomDetailDto> {
  const prisma = getPrisma();

  if (actor.role === "STUDENT") {
    throw new AppError("FORBIDDEN", "Học sinh không thể tạo lớp học.", 403);
  }
  if (body.subjectId) {
    const subject = await prisma.subject.findUnique({
      where: { id: body.subjectId },
      select: { id: true },
    });
    if (!subject) {
      throw new AppError("VALIDATION_ERROR", "Môn học không tồn tại.", 422);
    }
  }

  const duplicated = await prisma.classroom.findFirst({
    where: { ownerId: actor.id, name: body.name },
    select: { id: true },
  });
  if (duplicated) {
    throw new AppError("VALIDATION_ERROR", "Bạn đã có lớp trùng tên này.", 409);
  }

  const created = await prisma.classroom.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      subjectId: body.subjectId ?? null,
      gradeLevel: body.gradeLevel ?? null,
      ownerId: actor.id,
      // Chủ lớp cũng là thành viên (vai trò TEACHER) để dùng chung một bảng thành viên.
      members: { create: { userId: actor.id, role: "TEACHER", addedById: actor.id } },
    },
    select: { id: true },
  });

  return getClassroom(actor, created.id);
}

export async function getClassroom(
  actor: ClassroomActor,
  classroomId: string,
): Promise<ClassroomDetailDto> {
  const row = await requireClassroomForView(actor, classroomId);
  const members = await getPrisma().classroomMember.findMany({
    where: { classroomId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: memberSelect,
  });

  return {
    ...toClassroomDto(actor, row),
    members: members.map(toMemberDto),
  };
}

export async function updateClassroom(
  actor: ClassroomActor,
  classroomId: string,
  body: ClassroomUpdateBody,
): Promise<ClassroomDetailDto> {
  const prisma = getPrisma();
  const row = await requireClassroomForView(actor, classroomId);
  assertCanManageClassroom(actor, row.ownerId);

  await prisma.classroom.update({
    where: { id: classroomId },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.subjectId !== undefined ? { subjectId: body.subjectId } : {}),
      ...(body.gradeLevel !== undefined ? { gradeLevel: body.gradeLevel } : {}),
    },
  });

  return getClassroom(actor, classroomId);
}

/**
 * Thêm thành viên theo email. Chỉ chủ lớp/quản trị viên thêm được, và người được thêm
 * phải là tài khoản đã tồn tại (giáo viên hoặc học sinh).
 */
export async function addClassroomMember(
  actor: ClassroomActor,
  classroomId: string,
  body: ClassroomMemberBody,
): Promise<ClassroomMemberDto> {
  const prisma = getPrisma();
  const row = await requireClassroomForView(actor, classroomId);
  assertCanManageClassroom(actor, row.ownerId);

  const user = await prisma.user.findFirst({
    where: { email: body.email },
    select: { id: true, name: true, email: true, role: true, banned: true },
  });

  if (!user) {
    throw new AppError(
      "USER_NOT_FOUND",
      "Không tìm thấy tài khoản với email này. Hãy yêu cầu người học đăng ký trước.",
      404,
    );
  }
  if (user.banned) {
    throw new AppError("USER_ACTION_NOT_ALLOWED", "Tài khoản này đang bị khoá.", 409);
  }
  if (body.role === "STUDENT" && user.role === "ADMIN") {
    throw new AppError("USER_ACTION_NOT_ALLOWED", "Không thể thêm quản trị viên làm học sinh.", 409);
  }

  const existing = await prisma.classroomMember.findUnique({
    where: { classroomId_userId: { classroomId, userId: user.id } },
    select: { id: true },
  });
  if (existing) {
    throw new AppError("VALIDATION_ERROR", "Người này đã là thành viên của lớp.", 409);
  }

  const created = await prisma.classroomMember.create({
    data: {
      classroomId,
      userId: user.id,
      role: body.role,
      addedById: actor.id,
    },
    select: memberSelect,
  });

  return toMemberDto(created);
}

export async function removeClassroomMember(
  actor: ClassroomActor,
  classroomId: string,
  memberId: string,
): Promise<{ removedMemberId: string }> {
  const prisma = getPrisma();
  const row = await requireClassroomForView(actor, classroomId);
  assertCanManageClassroom(actor, row.ownerId);

  const member = await prisma.classroomMember.findFirst({
    where: { id: memberId, classroomId },
    select: { id: true, userId: true, role: true },
  });

  if (!member) {
    throw new AppError("CLASSROOM_MEMBER_NOT_FOUND", "Không tìm thấy thành viên trong lớp.", 404);
  }
  if (member.userId === row.ownerId) {
    throw new AppError(
      "USER_ACTION_NOT_ALLOWED",
      "Không thể xoá giáo viên phụ trách khỏi lớp của chính họ.",
      409,
    );
  }

  await prisma.classroomMember.delete({ where: { id: member.id } });
  return { removedMemberId: member.id };
}

async function requireManagedClassroom(
  actor: ClassroomActor,
  classroomId: string,
): Promise<ClassroomRow> {
  const row = await requireClassroomForView(actor, classroomId);
  assertCanManageClassroom(actor, row.ownerId);
  return row;
}

export async function listClassroomAssignments(
  actor: ClassroomActor,
  classroomId: string,
): Promise<ExamAssignmentDto[]> {
  await requireClassroomForView(actor, classroomId);

  const rows = await getPrisma().examAssignment.findMany({
    where: { classroomId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: assignmentSelect,
  });

  return rows.map(toAssignmentDto);
}

/**
 * Giao đề cho lớp. Đây là thao tác RIÊNG với việc xuất bản nội dung: đề phải đã xuất bản
 * và phải thuộc đúng lớp này. Mỗi đề chỉ giao một lần cho một lớp nên thao tác này là
 * "tạo hoặc cập nhật" cấu hình giao đề.
 */
export async function createAssignment(
  actor: ClassroomActor,
  classroomId: string,
  body: AssignmentCreateBody,
): Promise<ExamAssignmentDto> {
  const prisma = getPrisma();
  await requireManagedClassroom(actor, classroomId);

  const exam = await prisma.exam.findUnique({
    where: { id: body.examId },
    select: { id: true, status: true, scope: true, classroomId: true },
  });

  if (!exam) {
    throw new AppError("EXAM_NOT_FOUND", "Không tìm thấy đề thi.", 404);
  }
  if (exam.scope !== "CLASS" || exam.classroomId !== classroomId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Chỉ có thể giao đề thuộc chính lớp này cho lớp.",
      422,
    );
  }
  if (exam.status !== "PUBLISHED") {
    throw new AppError(
      "EXAM_PUBLISH_INVALID",
      "Đề phải được xuất bản nội dung trước khi giao cho lớp.",
      409,
    );
  }

  const opensAt = parseOptionalDateInput(body.opensAt, "Thời điểm mở đề");
  const closesAt = parseOptionalDateInput(body.closesAt, "Thời điểm đóng đề");
  const revealAnswersAt = parseOptionalDateInput(body.revealAnswersAt, "Thời điểm xem đáp án");
  assertAssignmentWindowOrder(opensAt, closesAt);

  const data = {
    title: body.title ?? null,
    opensAt,
    closesAt,
    durationMinutes: body.durationMinutes ?? null,
    allowedAttempts: body.allowedAttempts ?? null,
    revealAnswersAt,
  };

  await prisma.examAssignment.upsert({
    where: { examId_classroomId: { examId: exam.id, classroomId } },
    create: {
      examId: exam.id,
      classroomId,
      createdById: actor.id,
      ...data,
    },
    update: data,
    select: { id: true },
  });

  const rows = await prisma.examAssignment.findMany({
    where: { examId: exam.id, classroomId },
    select: assignmentSelect,
  });

  return toAssignmentDto(rows[0]);
}

export async function updateAssignment(
  actor: ClassroomActor,
  assignmentId: string,
  body: AssignmentUpdateBody,
): Promise<ExamAssignmentDto> {
  const prisma = getPrisma();
  const existing = await prisma.examAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, classroomId: true, opensAt: true, closesAt: true },
  });

  if (!existing) {
    throw new AppError("ASSIGNMENT_NOT_FOUND", "Không tìm thấy lần giao đề.", 404);
  }

  await requireManagedClassroom(actor, existing.classroomId);

  const opensAt =
    body.opensAt === undefined
      ? existing.opensAt
      : parseOptionalDateInput(body.opensAt, "Thời điểm mở đề");
  const closesAt =
    body.closesAt === undefined
      ? existing.closesAt
      : parseOptionalDateInput(body.closesAt, "Thời điểm đóng đề");
  assertAssignmentWindowOrder(opensAt, closesAt);

  const updated = await prisma.examAssignment.update({
    where: { id: assignmentId },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.durationMinutes !== undefined ? { durationMinutes: body.durationMinutes } : {}),
      ...(body.allowedAttempts !== undefined ? { allowedAttempts: body.allowedAttempts } : {}),
      ...(body.opensAt !== undefined ? { opensAt } : {}),
      ...(body.closesAt !== undefined ? { closesAt } : {}),
      ...(body.revealAnswersAt !== undefined
        ? {
            revealAnswersAt: parseOptionalDateInput(body.revealAnswersAt, "Thời điểm xem đáp án"),
          }
        : {}),
    },
    select: assignmentSelect,
  });

  return toAssignmentDto(updated);
}

export async function deleteAssignment(
  actor: ClassroomActor,
  assignmentId: string,
): Promise<{ removedAssignmentId: string }> {
  const prisma = getPrisma();
  const existing = await prisma.examAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, classroomId: true },
  });

  if (!existing) {
    throw new AppError("ASSIGNMENT_NOT_FOUND", "Không tìm thấy lần giao đề.", 404);
  }

  await requireManagedClassroom(actor, existing.classroomId);
  await prisma.examAssignment.delete({ where: { id: assignmentId } });

  return { removedAssignmentId: assignmentId };
}

const studentAssignmentSelect = {
  id: true,
  examId: true,
  classroomId: true,
  title: true,
  opensAt: true,
  closesAt: true,
  durationMinutes: true,
  allowedAttempts: true,
  revealAnswersAt: true,
  exam: {
    select: {
      title: true,
      status: true,
      durationMinutes: true,
      subject: { select: { name: true } },
      questions: { select: { points: true } },
    },
  },
} as const;

/** Lần giao đề của một đề lớp (nếu có) — dùng cho luồng làm bài của học sinh. */
export async function findAssignmentForExam(
  examId: string,
  classroomId: string | null,
): Promise<AssignmentRow | null> {
  if (!classroomId) {
    return null;
  }

  return getPrisma().examAssignment.findUnique({
    where: { examId_classroomId: { examId, classroomId } },
    select: assignmentSelect,
  });
}

/**
 * Thông tin truy cập của một học sinh với một đề: có phải thành viên lớp không, lần giao
 * đề (nếu là đề lớp) và thời lượng làm bài hiệu lực. Được luồng bắt đầu làm bài sử dụng.
 */
export async function loadExamAccessForStudent(
  userId: string | null,
  exam: {
    id: string;
    scope: "PUBLIC" | "CLASS";
    classroomId: string | null;
    durationMinutes: number;
  },
): Promise<{
  isClassMember: boolean;
  assignment: AssignmentRow | null;
  durationMinutes: number;
}> {
  if (exam.scope !== "CLASS" || !exam.classroomId) {
    return { isClassMember: false, assignment: null, durationMinutes: exam.durationMinutes };
  }

  const [membership, assignment] = await Promise.all([
    userId
      ? getPrisma().classroomMember.findFirst({
          where: { classroomId: exam.classroomId, userId, role: "STUDENT" },
          select: { id: true },
        })
      : Promise.resolve(null),
    findAssignmentForExam(exam.id, exam.classroomId),
  ]);

  return {
    isClassMember: Boolean(membership),
    assignment,
    durationMinutes: effectiveDurationMinutes(exam.durationMinutes, assignment),
  };
}

/** Số lượt làm bài đã chốt (đã nộp hoặc hết giờ) của một người cho một đề. */
export async function countFinishedAttempts(userId: string, examId: string): Promise<number> {
  return getPrisma().attempt.count({
    where: { userId, examId, status: { in: ["SUBMITTED", "EXPIRED"] } },
  });
}

/**
 * Góc nhìn của học sinh: các lớp mình tham gia và những đề đã được giao cho lớp đó.
 * Trạng thái cửa sổ làm bài và lý do chưa làm được đều do máy chủ tính.
 */
export async function listStudentClassrooms(userId: string): Promise<StudentClassroomDto[]> {
  const prisma = getPrisma();

  const memberships = await prisma.classroomMember.findMany({
    where: { userId, role: "STUDENT" },
    orderBy: { createdAt: "asc" },
    select: {
      classroom: {
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          subject: { select: { name: true } },
          owner: { select: { name: true } },
        },
      },
    },
  });

  if (memberships.length === 0) {
    return [];
  }

  const classroomIds = memberships.map((membership) => membership.classroom.id);
  const assignments = await prisma.examAssignment.findMany({
    where: { classroomId: { in: classroomIds }, exam: { status: "PUBLISHED" } },
    orderBy: [{ opensAt: "asc" }, { createdAt: "desc" }],
    select: studentAssignmentSelect,
  });

  const examIds = assignments.map((assignment) => assignment.examId);
  const finished = examIds.length
    ? await prisma.attempt.findMany({
        where: { userId, examId: { in: examIds }, status: { in: ["SUBMITTED", "EXPIRED"] } },
        select: { examId: true },
      })
    : [];

  const attemptsByExam = new Map<string, number>();
  for (const row of finished) {
    attemptsByExam.set(row.examId, (attemptsByExam.get(row.examId) ?? 0) + 1);
  }

  const now = new Date();

  return memberships.map((membership) => {
    const classroom = membership.classroom;
    const classroomAssignments = assignments.filter(
      (assignment) => assignment.classroomId === classroom.id,
    );

    const exams: StudentClassExamDto[] = classroomAssignments.map((assignment) => {
      const attemptsUsed = attemptsByExam.get(assignment.examId) ?? 0;
      const window = resolveAssignmentWindow(assignment, now);

      let canStart = true;
      let blockedReason: string | null = null;

      try {
        assertStudentMayStartExam({
          scope: "CLASS",
          isClassMember: true,
          assignment,
          attemptsUsed,
          now,
        });
      } catch (error) {
        canStart = false;
        blockedReason = error instanceof Error ? error.message : "Chưa thể làm bài.";
      }

      return {
        examId: assignment.examId,
        title: assignment.title ?? assignment.exam.title,
        subjectName: assignment.exam.subject?.name ?? "—",
        assignmentId: assignment.id,
        durationMinutes: effectiveDurationMinutes(
          assignment.exam.durationMinutes,
          assignment,
        ),
        questionCount: assignment.exam.questions.length,
        totalPoints: assignment.exam.questions.reduce((sum, item) => sum + item.points, 0),
        opensAt: toIso(assignment.opensAt),
        closesAt: toIso(assignment.closesAt),
        window,
        attemptsUsed,
        allowedAttempts: assignment.allowedAttempts,
        canStart: canStart && assignment.exam.questions.length > 0,
        canStartBlockedReason:
          assignment.exam.questions.length === 0
            ? "Đề chưa có câu hỏi nào."
            : blockedReason,
      };
    });

    return {
      id: classroom.id,
      name: classroom.name,
      subjectName: classroom.subject?.name ?? null,
      gradeLevel: classroom.gradeLevel,
      teacherName: classroom.owner.name,
      exams,
    };
  });
}



