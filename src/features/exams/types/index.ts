export interface SubjectDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  accentColor: string | null;
  position: number;
  examCount: number;
}

export interface ExamSubjectDto {
  id: string;
  name: string;
  slug: string;
  accentColor: string | null;
}

export interface ExamSummaryDto {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  year: number | null;
  durationMinutes: number;
  isFeatured: boolean;
  questionCount: number;
  totalPoints: number;
  subject: ExamSubjectDto;
}

export type ExamDetailDto = ExamSummaryDto;

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
