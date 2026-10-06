import type { RichDoc } from "@/features/authoring/services/rich-content-core";

/**
 * DTO dùng chung giữa server và client của tính năng tạo & quản lý đề thi.
 * Đây là nguồn sự thật cho hình dạng dữ liệu mà API trả về (không chứa kiểu của Prisma).
 */

export type UserRoleValue = "STUDENT" | "TEACHER" | "ADMIN";
export type QuestionTypeValue = "SINGLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
export type QuestionLevelValue = "EASY" | "MEDIUM" | "HARD";
export type ExamScopeValue = "PUBLIC" | "CLASS";
export type ExamStatusValue = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type ClassroomMemberRoleValue = "TEACHER" | "STUDENT";

export interface AuthoringClassroomRefDto {
  id: string;
  name: string;
  ownerId: string;
  gradeLevel: number | null;
}

export interface AuthoringExamSummaryDto {
  id: string;
  title: string;
  slug: string;
  status: ExamStatusValue;
  scope: ExamScopeValue;
  classroomId: string | null;
  classroomName: string | null;
  subjectId: string;
  subjectName: string;
  gradeLevel: number | null;
  durationMinutes: number;
  questionCount: number;
  totalPoints: number;
  attemptCount: number;
  /** true khi đề đã có lượt làm bài → nội dung/đáp án bị khoá. */
  contentLocked: boolean;
  revision: number;
  publishedRevision: number | null;
  publishedAt: string | null;
  updatedAt: string;
  /** Số lần giao đề hiện có (đề lớp). */
  assignmentCount: number;
}

export interface AuthoringExamListDto {
  items: AuthoringExamSummaryDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AuthoringOptionDto {
  id: string;
  label: string;
  content: string;
  contentDoc: RichDoc | null;
  isCorrect: boolean;
  position: number;
}

export interface AuthoringQuestionDto {
  id: string;
  examQuestionId: string;
  position: number;
  type: QuestionTypeValue;
  level: QuestionLevelValue;
  points: number;
  content: string;
  contentDoc: RichDoc | null;
  explanation: string | null;
  explanationDoc: RichDoc | null;
  rule: unknown;
  options: AuthoringOptionDto[];
}

export interface AuthoringExamDetailDto extends AuthoringExamSummaryDto {
  description: string | null;
  year: number | null;
  instructions: string | null;
  instructionsDoc: RichDoc | null;
  createdById: string | null;
  questions: AuthoringQuestionDto[];
}

export interface ValidationReportDto {
  issues: Array<{
    code: string;
    message: string;
    severity: "error" | "warning";
    questionId: string | null;
    field: string;
  }>;
  errorCount: number;
  warningCount: number;
  canPublish: boolean;
  totalPoints: number;
  questionCount: number;
}

export interface ClassroomMemberDto {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: ClassroomMemberRoleValue;
  createdAt: string;
}

export interface ClassroomDto {
  id: string;
  name: string;
  description: string | null;
  subjectId: string | null;
  subjectName: string | null;
  gradeLevel: number | null;
  ownerId: string;
  ownerName: string;
  isOwner: boolean;
  studentCount: number;
  examCount: number;
  assignmentCount: number;
  createdAt: string;
}

export interface ClassroomDetailDto extends ClassroomDto {
  members: ClassroomMemberDto[];
}

export interface ExamAssignmentDto {
  id: string;
  examId: string;
  examTitle: string;
  examStatus: ExamStatusValue;
  classroomId: string;
  classroomName: string;
  title: string | null;
  opensAt: string | null;
  closesAt: string | null;
  durationMinutes: number | null;
  allowedAttempts: number | null;
  revealAnswersAt: string | null;
  createdAt: string;
}

export interface MediaAssetDto {
  id: string;
  url: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  examId: string | null;
  createdAt: string;
}

/** Một đề đã giao cho lớp, nhìn từ phía học sinh. */
export interface StudentClassExamDto {
  examId: string;
  title: string;
  subjectName: string;
  assignmentId: string;
  durationMinutes: number;
  questionCount: number;
  totalPoints: number;
  opensAt: string | null;
  closesAt: string | null;
  /** Trạng thái cửa sổ làm bài do máy chủ quyết định. */
  window: "NOT_OPEN" | "OPEN" | "CLOSED";
  attemptsUsed: number;
  allowedAttempts: number | null;
  canStart: boolean;
  canStartBlockedReason: string | null;
}

export interface StudentClassroomDto {
  id: string;
  name: string;
  subjectName: string | null;
  gradeLevel: number | null;
  teacherName: string;
  exams: StudentClassExamDto[];
}
