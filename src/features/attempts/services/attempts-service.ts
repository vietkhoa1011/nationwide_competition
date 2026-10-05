import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { getPrisma } from "@/lib/prisma";

import type {
  AttemptHistoryQuery,
  SaveAnswerBody,
  ToggleFlagBody,
} from "@/features/attempts/schemas/attempt.schemas";
import {
  assertAnswersEditable,
  assertAttemptOwnership,
  assertResultReady,
  computeExpiresAt,
  isDeadlinePassed,
  resolveEffectiveStatus,
  serializeAttemptResult,
  serializeStudentAttempt,
  toCorrectOptionIds,
  toStudentOptions,
  type AttemptOwnerRef,
  type AttemptTimingRow,
  type SerializableAttemptRow,
} from "@/features/attempts/services/attempt-core";
import { gradeAttempt, roundScore } from "@/features/attempts/services/grading";
import type {
  AttemptHistoryDto,
  AttemptResultDto,
  AttemptStatusValue,
  SaveAnswerResultDto,
  SetProgressResultDto,
  StartAttemptResultDto,
  StudentAttemptDto,
  ToggleFlagResultDto,
} from "@/features/attempts/types";

/**
 * Toàn bộ truy vấn dữ liệu lượt làm bài. Mọi thao tác sửa đáp án đều kiểm tra
 * quyền sở hữu (theo `userId` khi đã đăng nhập, theo cookie phiên khi ẩn danh) và
 * trạng thái thời gian ngay trên server — client không được tin tưởng về giờ giấc
 * hay đáp án đúng.
 */

const attemptRowSelect = {
  id: true,
  sessionId: true,
  userId: true,
  examId: true,
  status: true,
  startedAt: true,
  expiresAt: true,
  submittedAt: true,
  score: true,
  maxScore: true,
  correctCount: true,
  incorrectCount: true,
  unansweredCount: true,
  lastQuestionPosition: true,
  exam: { select: { id: true, title: true, durationMinutes: true } },
  answers: {
    orderBy: { snapshotPosition: "asc" },
    select: {
      questionId: true,
      snapshotPosition: true,
      snapshotType: true,
      snapshotLevel: true,
      snapshotPoints: true,
      snapshotContent: true,
      snapshotExplanation: true,
      snapshotOptions: true,
      snapshotCorrectOptionIds: true,
      selectedOptionId: true,
      isFlagged: true,
      isCorrect: true,
    },
  },
} as const;

type AttemptRow = SerializableAttemptRow;

async function findAttemptRow(attemptId: string): Promise<AttemptRow | null> {
  const row = await getPrisma().attempt.findUnique({
    where: { id: attemptId },
    select: attemptRowSelect,
  });
  return row as AttemptRow | null;
}

async function requireAttemptRow(attemptId: string): Promise<AttemptRow> {
  const row = await findAttemptRow(attemptId);
  if (!row) {
    throw new AppError("ATTEMPT_NOT_FOUND", "Không tìm thấy lượt làm bài.", 404);
  }
  return row;
}

/**
 * Chốt lượt làm bài (nộp bài hoặc hết hạn) theo cách **idempotent**:
 * câu lệnh UPDATE chỉ thành công khi trạng thái vẫn là IN_PROGRESS, nên dù
 * người dùng bấm nộp nhiều lần hay nhiều tab cùng lúc thì điểm chỉ được ghi một lần.
 */
async function finalizeAttempt(
  tx: Prisma.TransactionClient,
  attempt: AttemptRow,
  now: Date,
): Promise<AttemptStatusValue> {
  if (attempt.status !== "IN_PROGRESS") {
    return attempt.status;
  }

  const targetStatus: AttemptStatusValue = isDeadlinePassed(attempt.expiresAt, now)
    ? "EXPIRED"
    : "SUBMITTED";

  const outcome = gradeAttempt(
    attempt.answers.map((answer) => ({
      questionId: answer.questionId,
      position: answer.snapshotPosition,
      points: answer.snapshotPoints,
      correctOptionIds: toCorrectOptionIds(answer.snapshotCorrectOptionIds),
      selectedOptionId: answer.selectedOptionId,
    })),
  );

  const updated = await tx.attempt.updateMany({
    where: { id: attempt.id, status: "IN_PROGRESS" },
    data: {
      status: targetStatus,
      submittedAt: now,
      score: outcome.score,
      maxScore: outcome.maxScore,
      correctCount: outcome.correctCount,
      incorrectCount: outcome.incorrectCount,
      unansweredCount: outcome.unansweredCount,
    },
  });

  if (updated.count === 0) {
    const latest = await tx.attempt.findUnique({
      where: { id: attempt.id },
      select: { status: true },
    });
    return latest?.status ?? "SUBMITTED";
  }

  await Promise.all(
    outcome.questions.map((question) =>
      tx.attemptAnswer.updateMany({
        where: { attemptId: attempt.id, questionId: question.questionId },
        data: { isCorrect: question.isCorrect },
      }),
    ),
  );

  return targetStatus;
}

/**
 * Bắt đầu làm bài. Nếu người gọi đang có lượt làm bài chưa nộp và còn hạn
 * thì trả về chính lượt đó (`resumed: true`) thay vì tạo lượt mới, nhờ vậy thao
 * tác này an toàn khi người dùng bấm nhiều lần hoặc tải lại trang.
 *
 * Lượt đang dở được tìm theo `userId` khi đã đăng nhập, theo cookie phiên khi ẩn danh.
 */
export async function startAttempt(
  owner: AttemptOwnerRef,
  examId: string,
): Promise<StartAttemptResultDto> {
  const prisma = getPrisma();

  const exam = await prisma.exam.findFirst({
    where: { id: examId, status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      durationMinutes: true,
      questions: {
        orderBy: { position: "asc" },
        select: {
          questionId: true,
          position: true,
          points: true,
          question: {
            select: {
              id: true,
              content: true,
              explanation: true,
              type: true,
              level: true,
              options: {
                orderBy: { position: "asc" },
                select: { id: true, label: true, content: true, position: true, isCorrect: true },
              },
            },
          },
        },
      },
    },
  });

  if (!exam) {
    throw new AppError("EXAM_NOT_FOUND", "Không tìm thấy đề thi.", 404);
  }
  if (exam.questions.length === 0) {
    throw new AppError(
      "EXAM_NOT_FOUND",
      "Đề thi này chưa có câu hỏi nào nên chưa thể làm bài.",
      409,
    );
  }

  const now = new Date();

  const existing = await prisma.attempt.findFirst({
    where: {
      examId: exam.id,
      status: "IN_PROGRESS",
      // Khách ẩn danh chỉ tiếp tục lượt của chính mình: lượt của tài khoản (userId khác null)
      // không được "nhận" nhầm sau khi đăng xuất khỏi trình duyệt dùng chung.
      ...(owner.userId !== null
        ? { userId: owner.userId }
        : { sessionId: owner.sessionId, userId: null }),
    },
    orderBy: { startedAt: "desc" },
    select: { id: true, startedAt: true, expiresAt: true },
  });

  if (existing && !isDeadlinePassed(existing.expiresAt, now)) {
    return {
      attemptId: existing.id,
      examId: exam.id,
      examTitle: exam.title,
      status: "IN_PROGRESS",
      startedAt: existing.startedAt.toISOString(),
      expiresAt: existing.expiresAt.toISOString(),
      durationMinutes: exam.durationMinutes,
      resumed: true,
    };
  }

  if (existing) {
    // Lượt cũ đã quá hạn nhưng chưa được chốt: chấm và đóng lại trước khi tạo lượt mới.
    const stale = await requireAttemptRow(existing.id);
    await prisma.$transaction((tx) => finalizeAttempt(tx, stale, now));
  }

  const startedAt = new Date();
  const expiresAt = computeExpiresAt(startedAt, exam.durationMinutes);

  const attemptId = await prisma.$transaction(async (tx) => {
    const attempt = await tx.attempt.create({
      data: {
        sessionId: owner.sessionId,
        userId: owner.userId,
        examId: exam.id,
        status: "IN_PROGRESS",
        startedAt,
        expiresAt,
        lastQuestionPosition: exam.questions[0]?.position ?? 1,
      },
      select: { id: true },
    });

    await tx.attemptAnswer.createMany({
      data: exam.questions.map((examQuestion) => {
        const options = examQuestion.question.options.map((option) => ({
          id: option.id,
          label: option.label,
          content: option.content,
          order: option.position,
        }));
        const correctOptionIds = examQuestion.question.options
          .filter((option) => option.isCorrect)
          .map((option) => option.id);

        return {
          attemptId: attempt.id,
          questionId: examQuestion.questionId,
          selectedOptionId: null,
          snapshotPosition: examQuestion.position,
          snapshotType: examQuestion.question.type,
          snapshotLevel: examQuestion.question.level,
          snapshotPoints: examQuestion.points,
          snapshotContent: examQuestion.question.content,
          snapshotExplanation: examQuestion.question.explanation,
          snapshotOptions: options,
          snapshotCorrectOptionIds: correctOptionIds,
          snapshotRule: {
            scoring: "SINGLE_CHOICE_EXACT",
            pointsPerCorrect: examQuestion.points,
            allowMultipleCorrect: correctOptionIds.length > 1,
          },
        };
      }),
    });

    return attempt.id;
  });

  return {
    attemptId,
    examId: exam.id,
    examTitle: exam.title,
    status: "IN_PROGRESS",
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    durationMinutes: exam.durationMinutes,
    resumed: false,
  };
}

/** Trường dùng cho một dòng lịch sử: không kèm đáp án đúng hay lời giải. */
const attemptHistorySelect = {
  id: true,
  examId: true,
  status: true,
  startedAt: true,
  expiresAt: true,
  submittedAt: true,
  score: true,
  maxScore: true,
  correctCount: true,
  incorrectCount: true,
  unansweredCount: true,
  lastQuestionPosition: true,
  exam: { select: { title: true, subject: { select: { name: true } } } },
  _count: { select: { answers: true } },
} as const;

/**
 * Lịch sử làm bài của người đang gọi, mới nhất trước.
 *
 * Cùng quy tắc cô lập như mọi thao tác khác: đã đăng nhập thì lấy theo `userId`
 * (thấy được bài làm trên mọi thiết bị), khách ẩn danh chỉ lấy lượt có
 * `sessionId` trùng cookie và chưa gắn tài khoản nào.
 *
 * `owner` là `null` khi người truy cập chưa từng có cookie phiên (Server Component
 * không được ghi cookie): khi đó chắc chắn chưa có lượt làm bài nào nên trả trang rỗng
 * thay vì chạm vào database.
 */
export async function listAttemptHistory(
  owner: AttemptOwnerRef | null,
  query: AttemptHistoryQuery,
): Promise<AttemptHistoryDto> {
  const { page, pageSize } = query;

  if (!owner) {
    return { items: [], page, pageSize, total: 0, totalPages: 0 };
  }

  const prisma = getPrisma();
  const now = new Date();

  const where: Prisma.AttemptWhereInput =
    owner.userId !== null
      ? { userId: owner.userId }
      : { sessionId: owner.sessionId, userId: null };

  const [total, attempts] = await prisma.$transaction([
    prisma.attempt.count({ where }),
    prisma.attempt.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: attemptHistorySelect,
    }),
  ]);

  return {
    items: attempts.map((attempt) => ({
      attemptId: attempt.id,
      examId: attempt.examId,
      examTitle: attempt.exam.title,
      subjectName: attempt.exam.subject.name,
      status: resolveEffectiveStatus(attempt.status, attempt.expiresAt, now),
      startedAt: attempt.startedAt.toISOString(),
      expiresAt: attempt.expiresAt.toISOString(),
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
      questionCount: attempt._count.answers,
      lastQuestionPosition: attempt.lastQuestionPosition,
      score: attempt.score === null ? null : roundScore(attempt.score),
      maxScore: attempt.maxScore === null ? null : roundScore(attempt.maxScore),
      correctCount: attempt.correctCount,
      incorrectCount: attempt.incorrectCount,
      unansweredCount: attempt.unansweredCount,
      canResume: attempt.status === "IN_PROGRESS" && !isDeadlinePassed(attempt.expiresAt, now),
    })),
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

/**
 * Khôi phục lượt làm bài đang dang dở sau khi tải lại trang.
 * Payload KHÔNG chứa đáp án đúng hay lời giải.
 */
export async function getCurrentAttempt(
  owner: AttemptOwnerRef,
  attemptId: string,
): Promise<StudentAttemptDto> {
  const prisma = getPrisma();
  const now = new Date();

  let attempt = await requireAttemptRow(attemptId);
  assertAttemptOwnership(attempt, owner);

  if (attempt.status === "IN_PROGRESS" && isDeadlinePassed(attempt.expiresAt, now)) {
    // Hết giờ trong lúc người dùng không thao tác: chốt bài và chấm điểm ngay.
    const expired = attempt;
    await prisma.$transaction((tx) => finalizeAttempt(tx, expired, now));
    attempt = await requireAttemptRow(attemptId);
  }

  return serializeStudentAttempt(attempt, {
    status: resolveEffectiveStatus(attempt.status, attempt.expiresAt, now),
    now,
  });
}

/** Đọc lượt làm bài trong transaction và chặn mọi thay đổi khi đã nộp / hết hạn. */
async function loadEditableAttempt(
  tx: Prisma.TransactionClient,
  attemptId: string,
  owner: AttemptOwnerRef,
  now: Date,
): Promise<AttemptTimingRow> {
  const attempt = await tx.attempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      sessionId: true,
      userId: true,
      status: true,
      startedAt: true,
      expiresAt: true,
      submittedAt: true,
    },
  });

  if (!attempt) {
    throw new AppError("ATTEMPT_NOT_FOUND", "Không tìm thấy lượt làm bài.", 404);
  }

  assertAttemptOwnership(attempt, owner);
  assertAnswersEditable(attempt, now);
  return attempt;
}

/** Lưu đáp án chọn cho một câu hỏi (optionId = null nghĩa là xoá đáp án). */
export async function saveAnswer(
  owner: AttemptOwnerRef,
  attemptId: string,
  input: SaveAnswerBody,
): Promise<SaveAnswerResultDto> {
  const prisma = getPrisma();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await loadEditableAttempt(tx, attemptId, owner, now);

    const answer = await tx.attemptAnswer.findFirst({
      where: { attemptId, questionId: input.questionId },
      select: { id: true, snapshotOptions: true },
    });

    if (!answer) {
      throw new AppError(
        "QUESTION_NOT_IN_ATTEMPT",
        "Câu hỏi không thuộc lượt làm bài này.",
        404,
      );
    }

    if (input.optionId !== null) {
      const options = toStudentOptions(answer.snapshotOptions);
      if (!options.some((option) => option.id === input.optionId)) {
        throw new AppError("OPTION_NOT_IN_QUESTION", "Đáp án không thuộc câu hỏi này.", 422);
      }
    }

    const saved = await tx.attemptAnswer.update({
      where: { id: answer.id },
      data: {
        selectedOptionId: input.optionId,
        answeredAt: input.optionId === null ? null : now,
      },
      select: { questionId: true, selectedOptionId: true, answeredAt: true },
    });

    return {
      questionId: saved.questionId,
      selectedOptionId: saved.selectedOptionId,
      savedAt: (saved.answeredAt ?? now).toISOString(),
    };
  });
}

export function deleteAnswer(
  owner: AttemptOwnerRef,
  attemptId: string,
  questionId: string,
): Promise<SaveAnswerResultDto> {
  return saveAnswer(owner, attemptId, { questionId, optionId: null });
}

/** Đánh dấu / bỏ đánh dấu một câu hỏi để xem lại. */
export async function toggleFlag(
  owner: AttemptOwnerRef,
  attemptId: string,
  input: ToggleFlagBody,
): Promise<ToggleFlagResultDto> {
  const prisma = getPrisma();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await loadEditableAttempt(tx, attemptId, owner, now);

    const answer = await tx.attemptAnswer.findFirst({
      where: { attemptId, questionId: input.questionId },
      select: { id: true },
    });

    if (!answer) {
      throw new AppError(
        "QUESTION_NOT_IN_ATTEMPT",
        "Câu hỏi không thuộc lượt làm bài này.",
        404,
      );
    }

    const updated = await tx.attemptAnswer.update({
      where: { id: answer.id },
      data: { isFlagged: input.isFlagged },
      select: { questionId: true, isFlagged: true },
    });

    return { questionId: updated.questionId, isFlagged: updated.isFlagged };
  });
}

/** Ghi nhớ "câu đang xem" để khôi phục sau khi tải lại (chỉ là tiện ích giao diện). */
export async function setProgress(
  owner: AttemptOwnerRef,
  attemptId: string,
  lastQuestionPosition: number,
): Promise<SetProgressResultDto> {
  const prisma = getPrisma();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const attempt = await tx.attempt.findUnique({
      where: { id: attemptId },
      select: { id: true, sessionId: true, userId: true, status: true },
    });

    if (!attempt) {
      throw new AppError("ATTEMPT_NOT_FOUND", "Không tìm thấy lượt làm bài.", 404);
    }

    assertAttemptOwnership(attempt, owner);

    if (attempt.status !== "IN_PROGRESS") {
      return { lastQuestionPosition, savedAt: now.toISOString() };
    }

    const updated = await tx.attempt.update({
      where: { id: attempt.id },
      data: { lastQuestionPosition },
      select: { lastQuestionPosition: true },
    });

    return {
      lastQuestionPosition: updated.lastQuestionPosition,
      savedAt: now.toISOString(),
    };
  });
}

/**
 * Nộp bài. Có thể gọi nhiều lần an toàn: câu lệnh UPDATE bên trong chỉ thành công
 * khi trạng thái vẫn là IN_PROGRESS, nên điểm chỉ được ghi một lần duy nhất.
 */
export async function submitAttempt(
  owner: AttemptOwnerRef,
  attemptId: string,
): Promise<AttemptResultDto> {
  const prisma = getPrisma();
  const now = new Date();

  const attempt = await requireAttemptRow(attemptId);
  assertAttemptOwnership(attempt, owner);

  await prisma.$transaction((tx) => finalizeAttempt(tx, attempt, now));

  return getAttemptResult(owner, attemptId);
}

export async function getAttemptResult(
  owner: AttemptOwnerRef,
  attemptId: string,
): Promise<AttemptResultDto> {
  const prisma = getPrisma();
  const now = new Date();

  let attempt = await requireAttemptRow(attemptId);
  assertAttemptOwnership(attempt, owner);

  if (attempt.status === "IN_PROGRESS") {
    if (!isDeadlinePassed(attempt.expiresAt, now)) {
      assertResultReady(attempt.status);
    }
    // Hết giờ nhưng chưa nộp: chấm ngay để người dùng vẫn xem được kết quả.
    const expired = attempt;
    await prisma.$transaction((tx) => finalizeAttempt(tx, expired, now));
    attempt = await requireAttemptRow(attemptId);
  }

  return serializeAttemptResult(attempt, {
    status: resolveEffectiveStatus(attempt.status, attempt.expiresAt, now),
    now,
  });
}
