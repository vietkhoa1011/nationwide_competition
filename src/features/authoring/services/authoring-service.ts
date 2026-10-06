import "server-only";

import { randomBytes } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import {
  assertCanManageExam,
  assertContentEditable,
  assertExamPublishable,
  assertExamScopeAllowedForCreate,
  assertRevisionMatches,
  assertScopeChangeAllowed,
  buildDuplicatedQuestion,
  buildQuestionOrder,
  normalizePoints,
  optionLabelAt,
  validateExamForPublish,
  type ExamActor,
  type PublishCandidateQuestion,
  type QuestionDraft,
} from "@/features/authoring/services/exam-authoring-core";
import {
  collectAssetIds,
  emptyRichDoc,
  parseRichDoc,
  plainTextFromRichDoc,
  type RichDoc,
} from "@/features/authoring/services/rich-content-core";
import { buildExamSlug } from "@/features/authoring/services/slug-core";
import type {
  AuthoringExamDetailDto,
  AuthoringExamListDto,
  AuthoringExamSummaryDto,
  AuthoringOptionDto,
  AuthoringQuestionDto,
  ValidationReportDto,
} from "@/features/authoring/types";
import type {
  AuthoringExamListQuery,
  CreateExamBody,
  QuestionInput,
  UpdateExamBody,
} from "@/features/authoring/schemas/authoring.schemas";
import { roundScore } from "@/features/attempts/services/grading";
import { AppError } from "@/lib/errors";
import { getPrisma } from "@/lib/prisma";

/**
 * Truy vấn và ghi dữ liệu cho tính năng tạo & quản lý đề thi.
 *
 * Mọi hàm ở đây nhận `actor` (đọc từ phiên đăng nhập ở tầng route) và tự kiểm tra quyền
 * trên dữ liệu đọc từ database: quyền không bao giờ dựa vào `role`, `createdById` hay
 * `classroomId` do client gửi lên.
 */

const examSummarySelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  status: true,
  scope: true,
  classroomId: true,
  createdById: true,
  gradeLevel: true,
  year: true,
  durationMinutes: true,
  instructions: true,
  instructionsDoc: true,
  revision: true,
  publishedRevision: true,
  publishedAt: true,
  updatedAt: true,
  subjectId: true,
  subject: { select: { name: true } },
  classroom: { select: { name: true, ownerId: true } },
  questions: { select: { points: true } },
  _count: { select: { attempts: true, assignments: true } },
} as const;

const questionSelect = {
  select: {
    id: true,
    type: true,
    level: true,
    content: true,
    contentDoc: true,
    explanation: true,
    explanationDoc: true,
    rule: true,
    options: {
      orderBy: { position: "asc" },
      select: {
        id: true,
        label: true,
        content: true,
        contentDoc: true,
        isCorrect: true,
        position: true,
      },
    },
  },
} as const;

const examDetailSelect = {
  ...examSummarySelect,
  questions: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      position: true,
      points: true,
      question: questionSelect,
    },
  },
} as const;

type ExamSummaryRow = Prisma.ExamGetPayload<{ select: typeof examSummarySelect }>;
type ExamDetailRow = Prisma.ExamGetPayload<{ select: typeof examDetailSelect }>;
type ExamQuestionRow = ExamDetailRow["questions"][number];

function toRichDocOrNull(value: unknown): RichDoc | null {
  return value === null || value === undefined ? null : parseRichDoc(value);
}

/**
 * Chuyển dữ liệu có cấu trúc thành giá trị JSON thuần cho Prisma. Đi qua
 * `JSON.stringify` để loại bỏ `undefined` — nhờ vậy hợp đồng dữ liệu lưu trong database
 * luôn là JSON hợp lệ, không phụ thuộc cách Prisma định kiểu `InputJsonValue`.
 */
function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toOptionDto(option: ExamQuestionRow["question"]["options"][number]): AuthoringOptionDto {
  return {
    id: option.id,
    label: option.label,
    content: option.content,
    contentDoc: toRichDocOrNull(option.contentDoc),
    isCorrect: option.isCorrect,
    position: option.position,
  };
}

function toQuestionDto(row: ExamQuestionRow): AuthoringQuestionDto {
  return {
    id: row.question.id,
    examQuestionId: row.id,
    position: row.position,
    type: row.question.type as AuthoringQuestionDto["type"],
    level: row.question.level as AuthoringQuestionDto["level"],
    points: row.points,
    content: row.question.content,
    contentDoc: toRichDocOrNull(row.question.contentDoc),
    explanation: row.question.explanation,
    explanationDoc: toRichDocOrNull(row.question.explanationDoc),
    rule: row.question.rule ?? null,
    options: row.question.options.map(toOptionDto),
  };
}

function toExamSummary(row: ExamSummaryRow): AuthoringExamSummaryDto {
  const attemptCount = row._count.attempts;

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    scope: row.scope,
    classroomId: row.classroomId,
    classroomName: row.classroom?.name ?? null,
    subjectId: row.subjectId,
    subjectName: row.subject.name,
    gradeLevel: row.gradeLevel,
    durationMinutes: row.durationMinutes,
    questionCount: row.questions.length,
    totalPoints: roundScore(row.questions.reduce((sum, item) => sum + item.points, 0)),
    attemptCount,
    contentLocked: attemptCount > 0,
    revision: row.revision,
    publishedRevision: row.publishedRevision,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
    assignmentCount: row._count.assignments,
  };
}

function toExamDetail(row: ExamDetailRow): AuthoringExamDetailDto {
  return {
    ...toExamSummary(row),
    description: row.description,
    year: row.year,
    instructions: row.instructions,
    instructionsDoc: toRichDocOrNull(row.instructionsDoc),
    createdById: row.createdById,
    questions: row.questions.map(toQuestionDto),
  };
}

interface ManagedExamRow {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  scope: "PUBLIC" | "CLASS";
  classroomId: string | null;
  createdById: string | null;
  classroomOwnerId: string | null;
  revision: number;
  subjectId: string;
}

function toExamOwnership(row: ManagedExamRow) {
  return {
    scope: row.scope,
    classroomId: row.classroomId,
    createdById: row.createdById,
    classroomOwnerId: row.classroomOwnerId,
  };
}

/** Đọc đề và kiểm tra quyền quản lý; ném 404 nếu không tồn tại, 403 nếu không có quyền. */
async function requireManagedExam(actor: ExamActor, examId: string): Promise<ManagedExamRow> {
  const row = await getPrisma().exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      status: true,
      scope: true,
      classroomId: true,
      createdById: true,
      revision: true,
      subjectId: true,
      classroom: { select: { ownerId: true } },
    },
  });

  if (!row) {
    throw new AppError("EXAM_NOT_FOUND", "Không tìm thấy đề thi.", 404);
  }

  const managed: ManagedExamRow = {
    id: row.id,
    title: row.title,
    status: row.status,
    scope: row.scope,
    classroomId: row.classroomId,
    createdById: row.createdById,
    classroomOwnerId: row.classroom?.ownerId ?? null,
    revision: row.revision,
    subjectId: row.subjectId,
  };

  assertCanManageExam(actor, toExamOwnership(managed));
  return managed;
}

async function loadExamDetailOrThrow(examId: string): Promise<ExamDetailRow> {
  const row = await getPrisma().exam.findUnique({
    where: { id: examId },
    select: examDetailSelect,
  });

  if (!row) {
    throw new AppError("EXAM_NOT_FOUND", "Không tìm thấy đề thi.", 404);
  }

  return row;
}

async function countAttempts(examId: string): Promise<number> {
  return getPrisma().attempt.count({ where: { examId } });
}

export async function listAuthoringExams(
  actor: ExamActor,
  query: AuthoringExamListQuery,
): Promise<AuthoringExamListDto> {
  const prisma = getPrisma();
  const where: Prisma.ExamWhereInput = {};

  // Giáo viên chỉ thấy đề trong lớp mình phụ trách; quản trị viên thấy toàn bộ.
  if (actor.role !== "ADMIN") {
    if (actor.role !== "TEACHER") {
      throw new AppError("FORBIDDEN", "Bạn không có quyền truy cập khu vực soạn đề.", 403);
    }
    where.scope = "CLASS";
    where.OR = [{ createdById: actor.id }, { classroom: { ownerId: actor.id } }];
  }

  if (query.status) {
    where.status = query.status;
  }
  if (query.scope) {
    where.scope = query.scope;
  }
  if (query.classroomId) {
    where.classroomId = query.classroomId;
  }
  if (query.search) {
    where.title = { contains: query.search, mode: "insensitive" };
  }

  const { page, pageSize } = query;
  const [total, exams] = await Promise.all([
    prisma.exam.count({ where }),
    prisma.exam.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: examSummarySelect,
    }),
  ]);

  return {
    items: exams.map(toExamSummary),
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

export async function createExamDraft(
  actor: ExamActor,
  body: CreateExamBody,
): Promise<AuthoringExamDetailDto> {
  const prisma = getPrisma();
  const scope = body.scope;
  const classroomId = body.classroomId ?? null;

  let classroomOwnerId: string | null = null;
  if (scope === "CLASS") {
    if (!classroomId) {
      throw new AppError("VALIDATION_ERROR", "Đề thuộc lớp phải chọn lớp sở hữu.", 422);
    }
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { id: true, ownerId: true },
    });
    if (!classroom) {
      throw new AppError("CLASSROOM_NOT_FOUND", "Không tìm thấy lớp học.", 404);
    }
    classroomOwnerId = classroom.ownerId;
  }

  assertExamScopeAllowedForCreate(actor, scope, classroomOwnerId);

  const subject = await prisma.subject.findUnique({
    where: { id: body.subjectId },
    select: { id: true },
  });
  if (!subject) {
    throw new AppError("VALIDATION_ERROR", "Môn học không tồn tại.", 422);
  }

  const instructionsDoc = body.instructionsDoc
    ? parseRichDoc(body.instructionsDoc, "Hướng dẫn làm bài")
    : null;

  const exam = await prisma.exam.create({
    data: {
      title: body.title,
      slug: buildExamSlug(body.title, randomBytes(4).toString("hex")),
      description: body.description ?? null,
      subjectId: body.subjectId,
      durationMinutes: body.durationMinutes,
      status: "DRAFT",
      scope,
      classroomId: scope === "CLASS" ? classroomId : null,
      createdById: actor.id,
      gradeLevel: body.gradeLevel ?? null,
      year: body.year ?? null,
      instructions: instructionsDoc ? plainTextFromRichDoc(instructionsDoc) : null,
      instructionsDoc: instructionsDoc ? toJsonValue(instructionsDoc) : Prisma.DbNull,
    },
    select: { id: true },
  });

  return getAuthoringExam(actor, exam.id);
}

export async function getAuthoringExam(
  actor: ExamActor,
  examId: string,
): Promise<AuthoringExamDetailDto> {
  await requireManagedExam(actor, examId);
  return toExamDetail(await loadExamDetailOrThrow(examId));
}

/**
 * Lưu nháp thông tin đề (bước 1 và thiết lập giao đề). Nội dung câu hỏi có endpoint
 * riêng nên thao tác này không đụng tới bảng câu hỏi.
 *
 * Mỗi lần lưu đều tăng `revision`; client gửi kèm số phiên bản đang giữ để phát hiện
 * trường hợp tab khác đã lưu trước đó.
 */
export async function updateExamDraft(
  actor: ExamActor,
  examId: string,
  body: UpdateExamBody,
): Promise<AuthoringExamDetailDto> {
  const prisma = getPrisma();
  const exam = await requireManagedExam(actor, examId);
  assertRevisionMatches(body.revision, exam.revision);
  // Đề đã phát sinh lượt làm bài thì khoá toàn bộ chỉnh sửa (nội dung, đáp án và cả thông tin
  // đề) — người soạn dùng "Tạo bản sao để chỉnh sửa" rồi làm việc trên bản sao.
  assertContentEditable(await countAttempts(examId));

  const nextScope = body.scope ?? exam.scope;
  const nextClassroomId = body.classroomId === undefined ? exam.classroomId : body.classroomId;

  let nextClassroomOwnerId = exam.classroomOwnerId;
  if (nextClassroomId !== exam.classroomId) {
    if (nextClassroomId) {
      const classroom = await prisma.classroom.findUnique({
        where: { id: nextClassroomId },
        select: { ownerId: true },
      });
      if (!classroom) {
        throw new AppError("CLASSROOM_NOT_FOUND", "Không tìm thấy lớp học.", 404);
      }
      nextClassroomOwnerId = classroom.ownerId;
    } else {
      nextClassroomOwnerId = null;
    }
  }

  assertScopeChangeAllowed(actor, toExamOwnership(exam), {
    scope: nextScope,
    classroomId: nextClassroomId,
    classroomOwnerId: nextClassroomOwnerId,
  });

  if (body.subjectId !== undefined) {
    const subject = await prisma.subject.findUnique({
      where: { id: body.subjectId },
      select: { id: true },
    });
    if (!subject) {
      throw new AppError("VALIDATION_ERROR", "Môn học không tồn tại.", 422);
    }
  }

  const data: Prisma.ExamUncheckedUpdateInput = {
    revision: { increment: 1 },
  };

  if (body.title !== undefined) data.title = body.title;
  if (body.subjectId !== undefined) data.subjectId = body.subjectId;
  if (body.durationMinutes !== undefined) data.durationMinutes = body.durationMinutes;
  if (body.description !== undefined) data.description = body.description;
  if (body.gradeLevel !== undefined) data.gradeLevel = body.gradeLevel;
  if (body.year !== undefined) data.year = body.year;

  if (body.scope !== undefined || body.classroomId !== undefined) {
    data.scope = nextScope;
    data.classroomId = nextScope === "CLASS" ? nextClassroomId : null;
  }

  if (body.instructionsDoc !== undefined) {
    const doc = body.instructionsDoc
      ? parseRichDoc(body.instructionsDoc, "Hướng dẫn làm bài")
      : null;
    data.instructionsDoc = doc ? toJsonValue(doc) : Prisma.DbNull;
    data.instructions = doc ? plainTextFromRichDoc(doc) : null;
  }

  await prisma.exam.update({ where: { id: examId }, data });

  return getAuthoringExam(actor, examId);
}

/**
 * Đọc một câu hỏi trong đề kèm nội dung có cấu trúc. Dùng cho các thao tác ghi để trả
 * về đúng dữ liệu sau khi lưu (client không cần tải lại cả đề).
 */
async function loadExamQuestionOrThrow(
  examId: string,
  questionId: string,
): Promise<ExamQuestionRow> {
  const row = await getPrisma().examQuestion.findFirst({
    where: { examId, questionId },
    select: { id: true, position: true, points: true, question: questionSelect },
  });

  if (!row) {
    throw new AppError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi trong đề thi.", 404);
  }

  return row;
}

function toQuestionDraft(row: ExamQuestionRow): QuestionDraft {
  return {
    type: row.question.type as QuestionDraft["type"],
    level: row.question.level as QuestionDraft["level"],
    content: row.question.content,
    contentDoc: toRichDocOrNull(row.question.contentDoc) ?? emptyRichDoc(),
    explanation: row.question.explanation,
    explanationDoc: toRichDocOrNull(row.question.explanationDoc),
    rule: row.question.rule ?? null,
    options: row.question.options.map((option, index) => ({
      label: optionLabelAt(index),
      content: option.content,
      contentDoc: toRichDocOrNull(option.contentDoc) ?? emptyRichDoc(),
      isCorrect: option.isCorrect,
      position: index + 1,
    })),
  };
}

function toPublishCandidate(row: ExamQuestionRow): PublishCandidateQuestion {
  return {
    id: row.question.id,
    type: row.question.type,
    points: row.points,
    content: row.question.content,
    contentDoc: toRichDocOrNull(row.question.contentDoc),
    explanation: row.question.explanation,
    explanationDoc: toRichDocOrNull(row.question.explanationDoc),
    options: row.question.options.map((option, index) => ({
      id: option.id,
      label: option.label || optionLabelAt(index),
      content: option.content,
      contentDoc: toRichDocOrNull(option.contentDoc),
      isCorrect: option.isCorrect,
    })),
  };
}

/** Dựng bản nháp câu hỏi từ dữ liệu client gửi lên (đã qua Zod ở tầng route). */
function toQuestionDraftFromInput(input: QuestionInput): QuestionDraft {
  const contentDoc = parseRichDoc(input.contentDoc, "Nội dung câu hỏi");
  const explanationDoc = input.explanationDoc
    ? parseRichDoc(input.explanationDoc, "Lời giải")
    : null;

  const options = input.options.map((option, index) => ({
    label: optionLabelAt(index),
    content: plainTextFromRichDoc(parseRichDoc(option.contentDoc, `Phương án ${optionLabelAt(index)}`)),
    contentDoc: parseRichDoc(option.contentDoc, `Phương án ${optionLabelAt(index)}`),
    isCorrect: option.isCorrect,
    position: index + 1,
  }));

  return {
    type: input.type,
    level: input.level,
    content: plainTextFromRichDoc(contentDoc),
    contentDoc,
    explanation: explanationDoc ? plainTextFromRichDoc(explanationDoc) : null,
    explanationDoc,
    rule: input.rule ?? null,
    options,
  };
}

/** Ghi câu hỏi mới (kèm phương án) vào database và gắn vào đề ở vị trí chỉ định. */
async function createQuestionRecords(
  tx: Prisma.TransactionClient,
  params: {
    examId: string;
    subjectId: string;
    position: number;
    points: number;
    draft: QuestionDraft;
  },
): Promise<string> {
  const question = await tx.question.create({
    data: {
      subjectId: params.subjectId,
      type: params.draft.type,
      level: params.draft.level,
      content: params.draft.content || "(chưa có nội dung)",
      contentDoc: toJsonValue(params.draft.contentDoc),
      explanation: params.draft.explanation,
      explanationDoc: params.draft.explanationDoc
        ? toJsonValue(params.draft.explanationDoc)
        : Prisma.DbNull,
      rule: params.draft.rule === null ? Prisma.DbNull : toJsonValue(params.draft.rule),
      options: {
        create: params.draft.options.map((option) => ({
          label: option.label,
          content: option.content || "(chưa có nội dung)",
          contentDoc: toJsonValue(option.contentDoc),
          isCorrect: option.isCorrect,
          position: option.position,
        })),
      },
    },
    select: { id: true },
  });

  await tx.examQuestion.create({
    data: {
      examId: params.examId,
      questionId: question.id,
      position: params.position,
      points: normalizePoints(params.points),
    },
  });

  return question.id;
}

async function nextQuestionPosition(examId: string): Promise<number> {
  const last = await getPrisma().examQuestion.findFirst({
    where: { examId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (last?.position ?? 0) + 1;
}

/** Thêm một câu hỏi mới vào cuối đề (chỉ khi đề chưa phát sinh lượt làm bài). */
export async function addQuestion(
  actor: ExamActor,
  examId: string,
  input: QuestionInput,
): Promise<AuthoringQuestionDto> {
  const prisma = getPrisma();
  const exam = await requireManagedExam(actor, examId);
  assertContentEditable(await countAttempts(examId));

  const draft = toQuestionDraftFromInput(input);
  const position = await nextQuestionPosition(examId);

  const questionId = await prisma.$transaction(async (tx) => {
    const created = await createQuestionRecords(tx, {
      examId,
      subjectId: exam.subjectId,
      position,
      points: input.points,
      draft,
    });
    await tx.exam.update({ where: { id: examId }, data: { revision: { increment: 1 } } });
    return created;
  });

  return toQuestionDto(await loadExamQuestionOrThrow(examId, questionId));
}

/**
 * Ghi đè nội dung một câu hỏi cùng các phương án của nó.
 *
 * Phương án giữ NGUYÊN ID khi client gửi kèm `id`, nên đổi thứ tự phương án không làm
 * sai đáp án đúng (đáp án luôn tham chiếu theo ID, không theo vị trí A/B/C/D). Nhãn
 * A/B/C/D được sinh lại theo thứ tự hiển thị.
 */
export async function updateQuestion(
  actor: ExamActor,
  examId: string,
  questionId: string,
  input: QuestionInput,
): Promise<AuthoringQuestionDto> {
  const prisma = getPrisma();
  await requireManagedExam(actor, examId);
  assertContentEditable(await countAttempts(examId));

  const examQuestion = await loadExamQuestionOrThrow(examId, questionId);
  const existing = examQuestion.question.options;
  const existingIds = new Set(existing.map((option) => option.id));

  const keepIds = new Set<string>();
  for (const option of input.options) {
    if (!option.id) {
      continue;
    }
    if (!existingIds.has(option.id)) {
      throw new AppError(
        "OPTION_NOT_IN_QUESTION",
        "Phương án gửi lên không thuộc câu hỏi này. Hãy tải lại đề rồi thử lại.",
        422,
      );
    }
    keepIds.add(option.id);
  }

  const contentDoc = parseRichDoc(input.contentDoc, "Nội dung câu hỏi");
  const explanationDoc = input.explanationDoc
    ? parseRichDoc(input.explanationDoc, "Lời giải")
    : null;
  const optionDocs = input.options.map((option, index) => {
    const doc = parseRichDoc(option.contentDoc, `Phương án ${optionLabelAt(index)}`);
    return { doc, text: plainTextFromRichDoc(doc) || "(chưa có nội dung)" };
  });

  await prisma.$transaction(async (tx) => {
    await tx.question.update({
      where: { id: questionId },
      data: {
        type: input.type,
        level: input.level,
        content: plainTextFromRichDoc(contentDoc) || "(chưa có nội dung)",
        contentDoc: toJsonValue(contentDoc),
        explanation: explanationDoc ? plainTextFromRichDoc(explanationDoc) : null,
        explanationDoc: explanationDoc ? toJsonValue(explanationDoc) : Prisma.DbNull,
        rule:
          input.rule === undefined || input.rule === null
            ? Prisma.DbNull
            : toJsonValue(input.rule),
      },
    });

    // Xoá phương án bị bỏ TRƯỚC để nhãn A/B/C/D của các phương án còn lại không vướng
    // ràng buộc duy nhất [questionId, label].
    const removed = existing.filter((option) => !keepIds.has(option.id)).map((option) => option.id);
    if (removed.length > 0) {
      await tx.questionOption.deleteMany({ where: { id: { in: removed } } });
    }

    // Hai lượt cập nhật nhãn: dọn sang nhãn tạm rồi gán nhãn cuối, nhờ vậy việc hoán vị
    // nhãn giữa hai phương án không vi phạm ràng buộc duy nhất.
    for (const option of input.options) {
      if (option.id) {
        await tx.questionOption.update({
          where: { id: option.id },
          data: { label: `tmp-${option.id}` },
        });
      }
    }

    for (const [index, option] of input.options.entries()) {
      const label = optionLabelAt(index);
      const data = {
        label,
        content: optionDocs[index].text,
        contentDoc: toJsonValue(optionDocs[index].doc),
        isCorrect: option.isCorrect,
        position: index + 1,
      };

      if (option.id) {
        await tx.questionOption.update({ where: { id: option.id }, data });
      } else {
        await tx.questionOption.create({ data: { ...data, questionId } });
      }
    }

    await tx.examQuestion.update({
      where: { id: examQuestion.id },
      data: { points: normalizePoints(input.points) },
    });
    await tx.exam.update({ where: { id: examId }, data: { revision: { increment: 1 } } });
  });

  return toQuestionDto(await loadExamQuestionOrThrow(examId, questionId));
}

/** Xoá câu hỏi khỏi đề và dồn lại thứ tự các câu còn lại (1..n). */
export async function deleteQuestion(
  actor: ExamActor,
  examId: string,
  questionId: string,
): Promise<{ removedQuestionId: string; questionCount: number }> {
  const prisma = getPrisma();
  await requireManagedExam(actor, examId);
  assertContentEditable(await countAttempts(examId));

  const examQuestion = await loadExamQuestionOrThrow(examId, questionId);

  const questionCount = await prisma.$transaction(async (tx) => {
    await tx.examQuestion.delete({ where: { id: examQuestion.id } });

    const remaining = await tx.examQuestion.findMany({
      where: { examId },
      orderBy: { position: "asc" },
      select: { id: true },
    });

    for (const [index, row] of remaining.entries()) {
      await tx.examQuestion.update({ where: { id: row.id }, data: { position: index + 1 } });
    }

    // Chỉ xoá bản ghi câu hỏi khi không còn đề nào dùng và chưa từng có câu trả lời nào
    // tham chiếu — nhờ vậy dữ liệu của các lượt làm bài cũ luôn được bảo toàn.
    const [links, answers] = await Promise.all([
      tx.examQuestion.count({ where: { questionId } }),
      tx.attemptAnswer.count({ where: { questionId } }),
    ]);
    if (links === 0 && answers === 0) {
      await tx.question.delete({ where: { id: questionId } });
    }

    await tx.exam.update({ where: { id: examId }, data: { revision: { increment: 1 } } });
    return remaining.length;
  });

  return { removedQuestionId: questionId, questionCount };
}

/**
 * Nhân bản một câu hỏi: bản sao nhận ID mới cho câu và mọi phương án, nhưng giữ nguyên
 * nội dung, công thức, ảnh và đáp án đúng; bản sao được thêm vào cuối đề.
 */
export async function duplicateQuestion(
  actor: ExamActor,
  examId: string,
  questionId: string,
): Promise<AuthoringQuestionDto> {
  const prisma = getPrisma();
  const exam = await requireManagedExam(actor, examId);
  assertContentEditable(await countAttempts(examId));

  const source = await loadExamQuestionOrThrow(examId, questionId);
  const draft = buildDuplicatedQuestion(toQuestionDraft(source));
  const position = await nextQuestionPosition(examId);

  const newQuestionId = await prisma.$transaction(async (tx) => {
    const created = await createQuestionRecords(tx, {
      examId,
      subjectId: exam.subjectId,
      position,
      points: source.points,
      draft,
    });
    await tx.exam.update({ where: { id: examId }, data: { revision: { increment: 1 } } });
    return created;
  });

  return toQuestionDto(await loadExamQuestionOrThrow(examId, newQuestionId));
}

/**
 * Sắp xếp lại thứ tự câu hỏi. Toàn bộ vị trí được dồn tạm sang một khoảng trống rồi mới
 * gán giá trị cuối, nên không vi phạm ràng buộc duy nhất [examId, position]. Thứ tự câu
 * chỉ ảnh hưởng các lượt làm bài MỚI (lượt cũ giữ nguyên thứ tự đã chụp lúc bắt đầu).
 */
export async function reorderQuestions(
  actor: ExamActor,
  examId: string,
  questionIds: readonly string[],
): Promise<AuthoringQuestionDto[]> {
  const prisma = getPrisma();
  await requireManagedExam(actor, examId);

  const rows = await prisma.examQuestion.findMany({
    where: { examId },
    orderBy: { position: "asc" },
    select: { id: true, questionId: true },
  });

  const order = buildQuestionOrder(
    rows.map((row) => row.questionId),
    questionIds,
  );
  const examQuestionIdByQuestionId = new Map(rows.map((row) => [row.questionId, row.id]));

  await prisma.$transaction(async (tx) => {
    await tx.examQuestion.updateMany({
      where: { examId },
      data: { position: { increment: 100_000 } },
    });

    for (const item of order) {
      const examQuestionId = examQuestionIdByQuestionId.get(item.id);
      if (!examQuestionId) {
        throw new AppError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi trong đề thi.", 404);
      }
      await tx.examQuestion.update({
        where: { id: examQuestionId },
        data: { position: item.position },
      });
    }

    await tx.exam.update({ where: { id: examId }, data: { revision: { increment: 1 } } });
  });

  const detail = await loadExamDetailOrThrow(examId);
  return detail.questions.map(toQuestionDto);
}

async function buildValidationInput(examId: string) {
  const detail = await loadExamDetailOrThrow(examId);
  const candidates = detail.questions.map(toPublishCandidate);

  const assetIds = new Set<string>();
  const collectFromDoc = (doc: RichDoc | null) => {
    if (doc) {
      for (const id of collectAssetIds(doc)) {
        assetIds.add(id);
      }
    }
  };

  collectFromDoc(toRichDocOrNull(detail.instructionsDoc));
  for (const question of candidates) {
    collectFromDoc(question.contentDoc);
    collectFromDoc(question.explanationDoc);
    for (const option of question.options) {
      collectFromDoc(option.contentDoc);
    }
  }

  const existing =
    assetIds.size > 0
      ? await getPrisma().mediaAsset.findMany({
          where: { id: { in: [...assetIds] } },
          select: { id: true },
        })
      : [];

  return {
    detail,
    candidates,
    knownAssetIds: new Set(existing.map((asset) => asset.id)),
  };
}

/**
 * Kiểm tra đề trước khi xuất bản. Cùng hàm này được gọi bên trong `publish` nên không thể
 * xuất bản một đề còn lỗi chỉ vì client bỏ qua bước kiểm tra.
 */
export async function validateExam(actor: ExamActor, examId: string): Promise<ValidationReportDto> {
  await requireManagedExam(actor, examId);
  const { detail, candidates, knownAssetIds } = await buildValidationInput(examId);

  const issues = validateExamForPublish({
    exam: {
      title: detail.title,
      durationMinutes: detail.durationMinutes,
      scope: detail.scope,
      classroomId: detail.classroomId,
      instructionsDoc: toRichDocOrNull(detail.instructionsDoc),
    },
    questions: candidates,
    knownAssetIds,
  });

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.length - errorCount;

  return {
    issues,
    errorCount,
    warningCount,
    canPublish: errorCount === 0,
    totalPoints: roundScore(candidates.reduce((sum, question) => sum + question.points, 0)),
    questionCount: candidates.length,
  };
}

async function loadExamSummaryOrThrow(examId: string): Promise<AuthoringExamSummaryDto> {
  const row = await getPrisma().exam.findUnique({
    where: { id: examId },
    select: examSummarySelect,
  });
  if (!row) {
    throw new AppError("EXAM_NOT_FOUND", "Không tìm thấy đề thi.", 404);
  }
  return toExamSummary(row);
}

/**
 * Vòng đời đề thi.
 * - `publish`: kiểm tra toàn bộ đề rồi mới chuyển sang PUBLISHED (đề lớp: xuất bản nội dung
 *   KHÔNG tự giao đề — giao đề là thao tác riêng của `assignment-service`).
 * - `unpublish`: thu hồi về DRAFT, chỉ khi chưa có lượt làm bài nào.
 * - `archive`: lưu trữ đề đã dùng; điểm và bài làm cũ vẫn nguyên vì mỗi lượt làm bài giữ
 *   snapshot nội dung của riêng nó.
 */
export async function changeExamLifecycle(
  actor: ExamActor,
  examId: string,
  action: "publish" | "unpublish" | "archive",
  revision?: number,
): Promise<AuthoringExamSummaryDto> {
  const prisma = getPrisma();
  const exam = await requireManagedExam(actor, examId);

  if (action === "publish") {
    assertRevisionMatches(revision, exam.revision);
    const { detail, candidates, knownAssetIds } = await buildValidationInput(examId);
    const issues = validateExamForPublish({
      exam: {
        title: detail.title,
        durationMinutes: detail.durationMinutes,
        scope: detail.scope,
        classroomId: detail.classroomId,
        instructionsDoc: toRichDocOrNull(detail.instructionsDoc),
      },
      questions: candidates,
      knownAssetIds,
    });
    assertExamPublishable(issues);

    await prisma.exam.update({
      where: { id: examId },
      data: {
        status: "PUBLISHED",
        publishedRevision: detail.revision,
        publishedAt: detail.publishedAt ? new Date(detail.publishedAt) : new Date(),
      },
    });

    return loadExamSummaryOrThrow(examId);
  }

  if (action === "unpublish") {
    if ((await countAttempts(examId)) > 0) {
      throw new AppError(
        "EXAM_CONTENT_LOCKED",
        "Đề đã có lượt làm bài nên không thể thu hồi về bản nháp. Hãy lưu trữ đề hoặc tạo bản sao để chỉnh sửa.",
        409,
      );
    }
    assertRevisionMatches(revision, exam.revision);
    await prisma.exam.update({ where: { id: examId }, data: { status: "DRAFT" } });
    return loadExamSummaryOrThrow(examId);
  }

  await prisma.exam.update({ where: { id: examId }, data: { status: "ARCHIVED" } });
  return loadExamSummaryOrThrow(examId);
}

/**
 * "Tạo bản sao để chỉnh sửa": đề đã có lượt làm bài bị khoá nội dung, nên người soạn tạo
 * một bản nháp mới sao chép toàn bộ câu hỏi/phương án (ID mới) rồi sửa tiếp trên bản sao.
 */
export async function duplicateExam(
  actor: ExamActor,
  examId: string,
  title?: string,
): Promise<AuthoringExamDetailDto> {
  const prisma = getPrisma();
  const source = await requireManagedExam(actor, examId);
  assertExamScopeAllowedForCreate(actor, source.scope, source.classroomOwnerId);

  const detail = await loadExamDetailOrThrow(examId);
  const copiedTitle = title?.trim() || `${detail.title} (bản sao)`;

  const created = await prisma.exam.create({
    data: {
      title: copiedTitle,
      slug: buildExamSlug(copiedTitle, randomBytes(4).toString("hex")),
      description: detail.description,
      subjectId: detail.subjectId,
      durationMinutes: detail.durationMinutes,
      status: "DRAFT",
      scope: detail.scope,
      classroomId: detail.classroomId,
      createdById: actor.id,
      gradeLevel: detail.gradeLevel,
      year: detail.year,
      instructions: detail.instructions,
      instructionsDoc: detail.instructionsDoc ? toJsonValue(detail.instructionsDoc) : Prisma.DbNull,
    },
    select: { id: true, subjectId: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const [index, row] of detail.questions.entries()) {
      await createQuestionRecords(tx, {
        examId: created.id,
        subjectId: created.subjectId,
        position: index + 1,
        points: row.points,
        draft: buildDuplicatedQuestion(toQuestionDraft(row)),
      });
    }
  });

  return getAuthoringExam(actor, created.id);
}






