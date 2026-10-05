export type AttemptStatusValue = "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";

export interface StudentOptionDto {
  id: string;
  label: string;
  content: string;
  order: number;
}

export interface StudentQuestionDto {
  questionId: string;
  position: number;
  type: string;
  level: string;
  points: number;
  content: string;
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

export interface ResultQuestionDto {
  questionId: string;
  position: number;
  type: string;
  level: string;
  content: string;
  points: number;
  earnedPoints: number;
  options: StudentOptionDto[];
  selectedOptionId: string | null;
  correctOptionIds: string[];
  isCorrect: boolean;
  explanation: string | null;
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
  questions: ResultQuestionDto[];
}
