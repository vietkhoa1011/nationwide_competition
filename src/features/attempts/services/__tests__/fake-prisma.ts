/**
 * Prisma giả lập trong bộ nhớ cho các bài kiểm thử service của lượt làm bài.
 *
 * Chỉ hỗ trợ đúng những truy vấn mà `attempts-service.ts` sử dụng. Bộ nhớ này cho
 * phép kiểm thử các quy tắc nghiệp vụ (idempotent khi nộp nhiều lần, chốt bài khi
 * hết hạn, cô lập theo phiên) mà KHÔNG cần tới PostgreSQL thật.
 */
import type { AttemptStatusValue } from "@/features/attempts/types";

export interface FakeOptionSnapshot {
  id: string;
  label: string;
  content: string;
  order: number;
}

export interface FakeAnswerRow {
  id: string;
  attemptId: string;
  questionId: string;
  selectedOptionId: string | null;
  answeredAt: Date | null;
  isFlagged: boolean;
  isCorrect: boolean | null;
  snapshotPosition: number;
  snapshotType: string;
  snapshotLevel: string;
  snapshotPoints: number;
  snapshotContent: string;
  snapshotExplanation: string | null;
  snapshotOptions: FakeOptionSnapshot[];
  snapshotCorrectOptionIds: string[];
}

export interface FakeAttemptRow {
  id: string;
  sessionId: string;
  examId: string;
  status: AttemptStatusValue;
  startedAt: Date;
  expiresAt: Date;
  submittedAt: Date | null;
  score: number | null;
  maxScore: number | null;
  correctCount: number | null;
  incorrectCount: number | null;
  unansweredCount: number | null;
  lastQuestionPosition: number;
  exam: { id: string; title: string; durationMinutes: number };
  answers: FakeAnswerRow[];
}

export interface FakeExamQuestion {
  questionId: string;
  position: number;
  points: number;
  question: {
    id: string;
    content: string;
    explanation: string | null;
    type: string;
    level: string;
    options: Array<{
      id: string;
      label: string;
      content: string;
      position: number;
      isCorrect: boolean;
    }>;
  };
}

export interface FakeExamRow {
  id: string;
  title: string;
  status: string;
  durationMinutes: number;
  questions: FakeExamQuestion[];
}
interface AttemptWhere {
  id?: string;
  sessionId?: string;
  examId?: string;
  status?: AttemptStatusValue;
}

interface AnswerWhere {
  id?: string;
  attemptId?: string;
  questionId?: string;
}

interface FindArgs<Where> {
  where?: Where;
}

interface CreateAttemptArgs {
  data: {
    sessionId: string;
    examId: string;
    status: AttemptStatusValue;
    startedAt: Date;
    expiresAt: Date;
    lastQuestionPosition: number;
  };
}

interface CreateAnswerArgs {
  data: Array<{
    attemptId: string;
    questionId: string;
    snapshotPosition: number;
    snapshotType: string;
    snapshotLevel: string;
    snapshotPoints: number;
    snapshotContent: string;
    snapshotExplanation: string | null;
    snapshotOptions: FakeOptionSnapshot[];
    snapshotCorrectOptionIds: string[];
  }>;
}

interface UpdateManyAttemptArgs {
  where: AttemptWhere;
  data: Partial<FakeAttemptRow>;
}

interface UpdateAttemptArgs {
  where: { id: string };
  data: Partial<FakeAttemptRow>;
}

interface UpdateManyAnswerArgs {
  where: AnswerWhere;
  data: Partial<FakeAnswerRow>;
}

interface UpdateAnswerArgs {
  where: { id: string };
  data: Partial<FakeAnswerRow>;
}

export interface FakePrismaState {
  exam: FakeExamRow;
  attempts: FakeAttemptRow[];
  answers: FakeAnswerRow[];
  nextAttemptNumber: number;
}

export interface FakePrisma {
  exam: {
    findFirst: (args: { where: { id?: string; status?: string } }) => Promise<FakeExamRow | null>;
  };
  attempt: {
    findFirst: (args: FindArgs<AttemptWhere>) => Promise<FakeAttemptRow | null>;
    findUnique: (args: { where: { id: string } }) => Promise<FakeAttemptRow | null>;
    create: (args: CreateAttemptArgs) => Promise<FakeAttemptRow>;
    update: (args: UpdateAttemptArgs) => Promise<FakeAttemptRow>;
    updateMany: (args: UpdateManyAttemptArgs) => Promise<{ count: number }>;
  };
  attemptAnswer: {
    createMany: (args: CreateAnswerArgs) => Promise<{ count: number }>;
    findFirst: (args: FindArgs<AnswerWhere>) => Promise<FakeAnswerRow | null>;
    update: (args: UpdateAnswerArgs) => Promise<FakeAnswerRow>;
    updateMany: (args: UpdateManyAnswerArgs) => Promise<{ count: number }>;
  };
  $transaction: <T>(
    input: ((tx: FakePrisma) => Promise<T>) | Promise<unknown>[],
  ) => Promise<T | unknown[]>;
}
function matches(where: AttemptWhere | undefined, row: FakeAttemptRow): boolean {
  if (!where) {
    return true;
  }
  if (where.id !== undefined && row.id !== where.id) {
    return false;
  }
  if (where.sessionId !== undefined && row.sessionId !== where.sessionId) {
    return false;
  }
  if (where.examId !== undefined && row.examId !== where.examId) {
    return false;
  }
  if (where.status !== undefined && row.status !== where.status) {
    return false;
  }
  return true;
}

function matchesAnswer(where: AnswerWhere | undefined, row: FakeAnswerRow): boolean {
  if (!where) {
    return true;
  }
  if (where.id !== undefined && row.id !== where.id) {
    return false;
  }
  if (where.attemptId !== undefined && row.attemptId !== where.attemptId) {
    return false;
  }
  if (where.questionId !== undefined && row.questionId !== where.questionId) {
    return false;
  }
  return true;
}

/** Đề thi mẫu: 4 câu hỏi, mỗi câu 1 điểm, đáp án đúng luôn là lựa chọn "opt-b". */
export function createFakeExam(overrides: Partial<FakeExamRow> = {}): FakeExamRow {
  const options = [
    { id: "opt-a", label: "A", content: "Đáp án A", position: 1, isCorrect: false },
    { id: "opt-b", label: "B", content: "Đáp án B", position: 2, isCorrect: true },
    { id: "opt-c", label: "C", content: "Đáp án C", position: 3, isCorrect: false },
    { id: "opt-d", label: "D", content: "Đáp án D", position: 4, isCorrect: false },
  ];

  return {
    id: "exam-1",
    title: "Đề thi thử môn Toán — số 1",
    status: "PUBLISHED",
    durationMinutes: 50,
    questions: [1, 2, 3, 4].map((position) => ({
      questionId: `question-${position}`,
      position,
      points: 1,
      question: {
        id: `question-${position}`,
        content: `Nội dung câu hỏi ${position}?`,
        explanation: `Lời giải chi tiết câu ${position}.`,
        type: "SINGLE_CHOICE",
        level: "MEDIUM",
        options,
      },
    })),
    ...overrides,
  };
}
export function createFakePrisma(exam: FakeExamRow = createFakeExam()): {
  prisma: FakePrisma;
  state: FakePrismaState;
} {
  const state: FakePrismaState = {
    exam,
    attempts: [],
    answers: [],
    nextAttemptNumber: 1,
  };

  const prisma: FakePrisma = {
    exam: {
      findFirst: async ({ where }) => {
        if (where.id !== undefined && state.exam.id !== where.id) {
          return null;
        }
        if (where.status !== undefined && state.exam.status !== where.status) {
          return null;
        }
        return state.exam;
      },
    },
    attempt: {
      findFirst: async ({ where }) => state.attempts.find((row) => matches(where, row)) ?? null,
      findUnique: async ({ where }) => state.attempts.find((row) => row.id === where.id) ?? null,
      create: async ({ data }) => {
        const row: FakeAttemptRow = {
          id: `attempt-${state.nextAttemptNumber}`,
          sessionId: data.sessionId,
          examId: data.examId,
          status: data.status,
          startedAt: data.startedAt,
          expiresAt: data.expiresAt,
          submittedAt: null,
          score: null,
          maxScore: null,
          correctCount: null,
          incorrectCount: null,
          unansweredCount: null,
          lastQuestionPosition: data.lastQuestionPosition,
          exam: {
            id: state.exam.id,
            title: state.exam.title,
            durationMinutes: state.exam.durationMinutes,
          },
          answers: [],
        };
        state.nextAttemptNumber += 1;
        state.attempts.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = state.attempts.find((item) => item.id === where.id);
        if (!row) {
          throw new Error(`Fake prisma: không tìm thấy lượt làm bài ${where.id}.`);
        }
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }) => {
        const targets = state.attempts.filter((row) => matches(where, row));
        for (const row of targets) {
          Object.assign(row, data);
        }
        return { count: targets.length };
      },
    },
    attemptAnswer: {
      createMany: async ({ data }) => {
        for (const item of data) {
          const attempt = state.attempts.find((row) => row.id === item.attemptId);
          if (!attempt) {
            throw new Error(`Fake prisma: không tìm thấy lượt làm bài ${item.attemptId}.`);
          }
          const row: FakeAnswerRow = {
            id: `answer-${state.answers.length + 1}`,
            attemptId: item.attemptId,
            questionId: item.questionId,
            selectedOptionId: null,
            answeredAt: null,
            isFlagged: false,
            isCorrect: null,
            snapshotPosition: item.snapshotPosition,
            snapshotType: item.snapshotType,
            snapshotLevel: item.snapshotLevel,
            snapshotPoints: item.snapshotPoints,
            snapshotContent: item.snapshotContent,
            snapshotExplanation: item.snapshotExplanation,
            snapshotOptions: item.snapshotOptions,
            snapshotCorrectOptionIds: item.snapshotCorrectOptionIds,
          };
          state.answers.push(row);
          attempt.answers.push(row);
        }
        return { count: data.length };
      },
      findFirst: async ({ where }) => state.answers.find((row) => matchesAnswer(where, row)) ?? null,
      update: async ({ where, data }) => {
        const row = state.answers.find((item) => item.id === where.id);
        if (!row) {
          throw new Error(`Fake prisma: không tìm thấy đáp án ${where.id}.`);
        }
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }) => {
        const targets = state.answers.filter((row) => matchesAnswer(where, row));
        for (const row of targets) {
          Object.assign(row, data);
        }
        return { count: targets.length };
      },
    },
    $transaction: async (input) => {
      if (typeof input === "function") {
        return input(prisma);
      }
      return Promise.all(input);
    },
  };

  return { prisma, state };
}


