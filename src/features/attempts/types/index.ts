import type { RichDoc } from "@/features/authoring/services/rich-content-core";

export type AttemptStatusValue = "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";

export interface StudentOptionDto {
  id: string;
  label: string;
  content: string;
  order: number;
  /** Bản có cấu trúc của phương án (null với dữ liệu cũ chưa có RichDoc). */
  contentDoc?: RichDoc | null;
}

export interface StudentQuestionDto {
  questionId: string;
  position: number;
  type: string;
  level: string;
  points: number;
  content: string;
  /** Bản có cấu trúc của nội dung (công thức, danh sách, ảnh) — null với dữ liệu cũ. */
  contentDoc?: RichDoc | null;
  options: StudentOptionDto[];
  selectedOptionId: string | null;
  isFlagged: boolean;
}

export interface StudentAttemptDto {
  id: string;
  examId: string;
  examTitle: string;
  status: AttemptStatusValue;
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  serverTime: string;
  durationMinutes: number;
  lastQuestionPosition: number;
  counts: {
    total: number;
    answered: number;
    flagged: number;
  };
  questions: StudentQuestionDto[];
}

export interface StartAttemptResultDto {
  attemptId: string;
  examId: string;
  examTitle: string;
  status: AttemptStatusValue;
  startedAt: string;
  expiresAt: string;
  durationMinutes: number;
  /** true nếu server trả về lượt làm bài đang dang dở thay vì tạo lượt mới. */
  resumed: boolean;
}

export interface SaveAnswerResultDto {
  questionId: string;
  selectedOptionId: string | null;
  savedAt: string;
}

export interface ToggleFlagResultDto {
  questionId: string;
  isFlagged: boolean;
}

export interface SetProgressResultDto {
  lastQuestionPosition: number;
  savedAt: string;
}

/**
 * Một dòng trong lịch sử làm bài. Điểm và số câu đúng/sai chỉ có sau khi bài
 * được chốt (đã nộp hoặc hết giờ) nên đều là `null` khi còn đang làm.
 */
export interface AttemptHistoryItemDto {
  attemptId: string;
  examId: string;
  examTitle: string;
  subjectName: string;
  status: AttemptStatusValue;
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  questionCount: number;
  lastQuestionPosition: number;
  score: number | null;
  maxScore: number | null;
  correctCount: number | null;
  incorrectCount: number | null;
  unansweredCount: number | null;
  /** Server quyết định còn làm tiếp được hay không (chưa nộp và chưa hết giờ). */
  canResume: boolean;
}

export interface AttemptHistoryDto {
  items: AttemptHistoryItemDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ResultQuestionDto {
  questionId: string;
  position: number;
  type: string;
  level: string;
  content: string;
  contentDoc?: RichDoc | null;
  points: number;
  earnedPoints: number;
  options: StudentOptionDto[];
  selectedOptionId: string | null;
  correctOptionIds: string[];
  isCorrect: boolean;
  explanation: string | null;
  explanationDoc?: RichDoc | null;
}

export interface AttemptResultDto {
  id: string;
  examId: string;
  examTitle: string;
  status: AttemptStatusValue;
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  serverTime: string;
  score: number;
  maxScore: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  /**
   * true khi lần giao đề của lớp chưa tới mốc được xem đáp án: máy chủ đã loại đáp án
   * đúng và lời giải khỏi payload (không phải ẩn bằng CSS ở trình duyệt).
   */
  answersHidden: boolean;
  /** Mốc được phép xem đáp án của lần giao đề (null nếu xem ngay sau khi nộp). */
  answersRevealAt: string | null;
  questions: ResultQuestionDto[];
}
