import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { getPrisma } from "@/lib/prisma";

import { roundScore } from "@/features/attempts/services/grading";
import { parseRichDoc } from "@/features/authoring/services/rich-content-core";
import type { ExamListQuery } from "@/features/exams/schemas/exam.schemas";
import type {
  ExamDetailDto,
  ExamSummaryDto,
  PaginatedResult,
  SubjectDto,
} from "@/features/exams/types";

/** Các trường dùng chung cho danh sách và chi tiết đề thi (không lộ đáp án). */
const examSummarySelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  year: true,
  durationMinutes: true,
  isFeatured: true,
  subject: { select: { id: true, name: true, slug: true, accentColor: true } },
  questions: { select: { points: true } },
} as const;

/** Chi tiết đề thi bổ sung hướng dẫn làm bài (bản chữ thuần + bản có cấu trúc). */
const examDetailSelect = {
  ...examSummarySelect,
  instructions: true,
  instructionsDoc: true,
} as const;

type ExamSummaryRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  year: number | null;
  durationMinutes: number;
  isFeatured: boolean;
  subject: { id: string; name: string; slug: string; accentColor: string | null };
  questions: { points: number }[];
};

type ExamDetailRow = ExamSummaryRow & {
  instructions: string | null;
  instructionsDoc: unknown;
};

function toExamSummary(exam: ExamSummaryRow): ExamSummaryDto {
  return {
    id: exam.id,
    title: exam.title,
    slug: exam.slug,
    description: exam.description,
    year: exam.year,
    durationMinutes: exam.durationMinutes,
    isFeatured: exam.isFeatured,
    questionCount: exam.questions.length,
    totalPoints: roundScore(exam.questions.reduce((sum, item) => sum + item.points, 0)),
    subject: exam.subject,
  };
}

function toExamDetail(exam: ExamDetailRow): ExamDetailDto {
  return {
    ...toExamSummary(exam),
    instructions: exam.instructions,
    instructionsDoc: exam.instructionsDoc ? parseRichDoc(exam.instructionsDoc) : null,
  };
}

export async function listSubjects(): Promise<SubjectDto[]> {
  const prisma = getPrisma();
  const subjects = await prisma.subject.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      accentColor: true,
      position: true,
      _count: { select: { exams: { where: { status: "PUBLISHED" } } } },
    },
  });

  return subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    slug: subject.slug,
    description: subject.description,
    accentColor: subject.accentColor,
    position: subject.position,
    examCount: subject._count.exams,
  }));
}

export async function listExams(
  query: ExamListQuery,
): Promise<PaginatedResult<ExamSummaryDto>> {
  const prisma = getPrisma();
  const { page, pageSize } = query;

  const where: Prisma.ExamWhereInput = { status: "PUBLISHED", scope: "PUBLIC" };
  if (query.subjectId) {
    where.subjectId = query.subjectId;
  }
  if (query.featured === "true") {
    where.isFeatured = true;
  }
  if (query.featured === "false") {
    where.isFeatured = false;
  }
  const search = query.search?.trim();
  if (search) {
    where.title = { contains: search, mode: "insensitive" };
  }

  const [total, exams] = await prisma.$transaction([
    prisma.exam.count({ where }),
    prisma.exam.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { year: "desc" }, { title: "asc" }],
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

export async function getExamById(examId: string): Promise<ExamDetailDto> {
  const prisma = getPrisma();
  // Kho đề công khai chỉ trả về đề PUBLIC đã xuất bản. Đề của lớp không xuất hiện ở đây:
  // học sinh truy cập qua mục lớp học của mình, nơi máy chủ kiểm tra tư cách thành viên.
  const exam = await prisma.exam.findFirst({
    where: { id: examId, status: "PUBLISHED", scope: "PUBLIC" },
    select: examDetailSelect,
  });

  if (!exam) {
    throw new AppError("EXAM_NOT_FOUND", "Không tìm thấy đề thi.", 404);
  }

  return toExamDetail(exam);
}
