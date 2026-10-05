/**
 * Logic chấm điểm thuần (pure) — không phụ thuộc database, không phụ thuộc Next.js.
 * Toàn bộ việc chấm điểm diễn ra trên server dựa trên snapshot đã lưu khi bắt đầu bài.
 */
export interface GradableQuestion {
  questionId: string;
  position: number;
  points: number;
  correctOptionIds: string[];
  selectedOptionId: string | null;
}

export interface GradedQuestion {
  questionId: string;
  position: number;
  points: number;
  selectedOptionId: string | null;
  correctOptionIds: string[];
  isCorrect: boolean;
  earnedPoints: number;
}

export interface GradingOutcome {
  score: number;
  maxScore: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  questions: GradedQuestion[];
}

export function roundScore(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isAnswered(selectedOptionId: string | null | undefined): boolean {
  return typeof selectedOptionId === "string" && selectedOptionId.length > 0;
}

export function isAnswerCorrect(
  selectedOptionId: string | null | undefined,
  correctOptionIds: readonly string[],
): boolean {
  if (!isAnswered(selectedOptionId)) {
    return false;
  }
  return correctOptionIds.includes(selectedOptionId as string);
}

/** Chấm một câu hỏi chọn một đáp án đúng. */
export function gradeQuestion(question: GradableQuestion): GradedQuestion {
  const correct = isAnswerCorrect(question.selectedOptionId, question.correctOptionIds);
  return {
    questionId: question.questionId,
    position: question.position,
    points: question.points,
    selectedOptionId: question.selectedOptionId,
    correctOptionIds: [...question.correctOptionIds],
    isCorrect: correct,
    earnedPoints: correct ? question.points : 0,
  };
}

export function gradeAttempt(questions: readonly GradableQuestion[]): GradingOutcome {
  const graded = questions.map(gradeQuestion);

  let score = 0;
  let maxScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  for (const question of graded) {
    maxScore += question.points;
    score += question.earnedPoints;
    if (!isAnswered(question.selectedOptionId)) {
      unansweredCount += 1;
    } else if (question.isCorrect) {
      correctCount += 1;
    } else {
      incorrectCount += 1;
    }
  }

  return {
    score: roundScore(score),
    maxScore: roundScore(maxScore),
    correctCount,
    incorrectCount,
    unansweredCount,
    questions: graded,
  };
}
