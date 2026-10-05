import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors";

import { createFakePrisma, type FakePrismaState } from "@/features/attempts/services/__tests__/fake-prisma";
import type { AttemptHistoryQuery } from "@/features/attempts/schemas/attempt.schemas";
import type { AttemptOwnerRef } from "@/features/attempts/services/attempt-core";
import {
  getAttemptResult,
  getCurrentAttempt,
  listAttemptHistory,
  saveAnswer,
  startAttempt,
  submitAttempt,
} from "@/features/attempts/services/attempts-service";

/**
 * Chủ sở hữu lượt làm bài:
 * - `GUEST` / `OTHER_GUEST`: khách ẩn danh, định danh bằng cookie phiên.
 * - `STUDENT` / `OTHER_STUDENT`: tài khoản đã đăng nhập (cookie khác nhau tuỳ thiết bị).
 */
const GUEST: AttemptOwnerRef = { sessionId: "session-1", userId: null };
const OTHER_GUEST: AttemptOwnerRef = { sessionId: "session-2", userId: null };
const STUDENT: AttemptOwnerRef = { sessionId: "auth-session-1", userId: "user-1" };
const OTHER_STUDENT: AttemptOwnerRef = { sessionId: "auth-session-2", userId: "user-2" };

/** Prisma thật được thay bằng bộ nhớ giả để test không cần PostgreSQL. */
const mocks = vi.hoisted(() => ({ prisma: undefined as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  getPrisma: () => mocks.prisma,
}));

let state: FakePrismaState;

beforeEach(() => {
  const fake = createFakePrisma();
  state = fake.state;
  mocks.prisma = fake.prisma;
});

describe("startAttempt", () => {
  it("tạo lượt làm bài mới và chốt thời hạn theo thời lượng đề thi", async () => {
    const result = await startAttempt(GUEST, "exam-1");

    expect(result.resumed).toBe(false);
    expect(result.examTitle).toBe("Đề thi thử môn Toán — số 1");
    expect(result.durationMinutes).toBe(50);
    expect(new Date(result.expiresAt).getTime() - new Date(result.startedAt).getTime()).toBe(
      50 * 60_000,
    );
    expect(state.attempts).toHaveLength(1);
    expect(state.answers).toHaveLength(4);
  });

  it("bấm bắt đầu lần nữa thì tiếp tục lượt đang làm thay vì tạo lượt mới", async () => {
    const first = await startAttempt(GUEST, "exam-1");
    const second = await startAttempt(GUEST, "exam-1");

    expect(second.resumed).toBe(true);
    expect(second.attemptId).toBe(first.attemptId);
    expect(state.attempts).toHaveLength(1);
  });

  it("chốt lượt cũ đã quá hạn rồi mới tạo lượt mới", async () => {
    const first = await startAttempt(GUEST, "exam-1");
    state.attempts[0].expiresAt = new Date(Date.now() - 1_000);

    const second = await startAttempt(GUEST, "exam-1");

    expect(second.resumed).toBe(false);
    expect(second.attemptId).not.toBe(first.attemptId);
    expect(state.attempts).toHaveLength(2);
    expect(state.attempts[0].status).toBe("EXPIRED");
  });

  it("báo 404 khi đề thi không tồn tại hoặc chưa xuất bản", async () => {
    await expect(startAttempt(GUEST, "exam-khong-ton-tai")).rejects.toMatchObject({
      code: "EXAM_NOT_FOUND",
      status: 404,
    });
  });
});

describe("getCurrentAttempt", () => {
  it("payload khi đang làm bài không chứa đáp án đúng hay lời giải", async () => {
    const started = await startAttempt(GUEST, "exam-1");
    const current = await getCurrentAttempt(GUEST, started.attemptId);

    const serialized = JSON.stringify(current);
    expect(serialized).not.toContain("snapshot");
    expect(serialized).not.toContain("Lời giải chi tiết");
    expect(serialized).not.toContain("isCorrect");
    expect("correctOptionIds" in current.questions[0]).toBe(false);
    expect("explanation" in current.questions[0]).toBe(false);

    // Trong khi đó, phía máy chủ vẫn giữ đáp án đúng trong snapshot của lượt làm bài.
    expect(state.answers[0].snapshotCorrectOptionIds).toEqual(["opt-b"]);
    expect(state.answers[0].snapshotExplanation).not.toBeNull();
  });
});
describe("saveAnswer", () => {
  it("lưu và xoá đáp án của một câu hỏi", async () => {
    const started = await startAttempt(GUEST, "exam-1");

    const saved = await saveAnswer(GUEST, started.attemptId, {
      questionId: "question-1",
      optionId: "opt-b",
    });
    expect(saved.selectedOptionId).toBe("opt-b");
    expect(state.answers[0].selectedOptionId).toBe("opt-b");
    expect(state.answers[0].answeredAt).not.toBeNull();

    const cleared = await saveAnswer(GUEST, started.attemptId, {
      questionId: "question-1",
      optionId: null,
    });
    expect(cleared.selectedOptionId).toBeNull();
    expect(state.answers[0].selectedOptionId).toBeNull();
    expect(state.answers[0].answeredAt).toBeNull();
  });

  it("chặn lựa chọn không thuộc câu hỏi và câu hỏi không thuộc đề", async () => {
    const started = await startAttempt(GUEST, "exam-1");

    await expect(
      saveAnswer(GUEST, started.attemptId, { questionId: "question-1", optionId: "opt-z" }),
    ).rejects.toMatchObject({ code: "OPTION_NOT_IN_QUESTION", status: 422 });

    await expect(
      saveAnswer(GUEST, started.attemptId, { questionId: "question-999", optionId: "opt-b" }),
    ).rejects.toMatchObject({ code: "QUESTION_NOT_IN_ATTEMPT", status: 404 });

    expect(state.answers.every((answer) => answer.selectedOptionId === null)).toBe(true);
  });
});

describe("submitAttempt", () => {
  it("chấm điểm trên máy chủ và đánh dấu đúng/sai cho từng câu", async () => {
    const started = await startAttempt(GUEST, "exam-1");
    await saveAnswer(GUEST, started.attemptId, {
      questionId: "question-1",
      optionId: "opt-b",
    });
    await saveAnswer(GUEST, started.attemptId, {
      questionId: "question-2",
      optionId: "opt-b",
    });
    await saveAnswer(GUEST, started.attemptId, {
      questionId: "question-3",
      optionId: "opt-a",
    });

    const result = await submitAttempt(GUEST, started.attemptId);

    expect(result.status).toBe("SUBMITTED");
    expect(result.score).toBe(2);
    expect(result.maxScore).toBe(4);
    expect(result.correctCount).toBe(2);
    expect(result.incorrectCount).toBe(1);
    expect(result.unansweredCount).toBe(1);
    expect(state.answers.map((answer) => answer.isCorrect)).toEqual([true, true, false, false]);
  });

  it("nộp bài nhiều lần chỉ ghi điểm một lần duy nhất (idempotent)", async () => {
    const started = await startAttempt(GUEST, "exam-1");
    await saveAnswer(GUEST, started.attemptId, {
      questionId: "question-1",
      optionId: "opt-b",
    });

    const first = await submitAttempt(GUEST, started.attemptId);
    const submittedAt = state.attempts[0].submittedAt;

    const second = await submitAttempt(GUEST, started.attemptId);
    const third = await submitAttempt(GUEST, started.attemptId);

    expect(first.score).toBe(1);
    expect(second.score).toBe(1);
    expect(third.score).toBe(1);
    expect(second.submittedAt).toBe(first.submittedAt);
    expect(state.attempts[0].submittedAt).toEqual(submittedAt);
    expect(state.attempts[0].score).toBe(1);
  });

  it("không cho sửa đáp án sau khi đã nộp", async () => {
    const started = await startAttempt(GUEST, "exam-1");
    await submitAttempt(GUEST, started.attemptId);

    await expect(
      saveAnswer(GUEST, started.attemptId, { questionId: "question-1", optionId: "opt-b" }),
    ).rejects.toMatchObject({ code: "ATTEMPT_SUBMITTED", status: 409 });
  });
});

describe("chốt bài khi hết giờ", () => {
  it("chấm điểm ngay lần đọc kế tiếp dù người dùng chưa bấm nộp", async () => {
    const started = await startAttempt(GUEST, "exam-1");
    state.answers[0].selectedOptionId = "opt-b";

    // Giả lập người dùng đóng trình duyệt cho tới khi hết giờ.
    state.attempts[0].expiresAt = new Date(Date.now() - 60_000);

    const attempt = await getCurrentAttempt(GUEST, started.attemptId);
    expect(attempt.status).toBe("EXPIRED");

    const result = await getAttemptResult(GUEST, started.attemptId);
    expect(result.status).toBe("EXPIRED");
    expect(result.score).toBe(1);
    expect(result.correctCount).toBe(1);
    expect(state.attempts[0].status).toBe("EXPIRED");
    expect(state.attempts[0].submittedAt).not.toBeNull();
  });

  it("chặn xem kết quả khi bài còn trong thời gian làm", async () => {
    const started = await startAttempt(GUEST, "exam-1");

    await expect(getAttemptResult(GUEST, started.attemptId)).rejects.toMatchObject({
      code: "RESULT_NOT_READY",
      status: 409,
    });
  });
});

describe("cô lập theo phiên", () => {
  it("phiên khác nhận 404 khi đọc lượt làm bài", async () => {
    const started = await startAttempt(GUEST, "exam-1");

    await expect(getCurrentAttempt(OTHER_GUEST, started.attemptId)).rejects.toBeInstanceOf(AppError);
    await expect(getCurrentAttempt(OTHER_GUEST, started.attemptId)).rejects.toMatchObject({
      code: "ATTEMPT_NOT_FOUND",
      status: 404,
    });
    await expect(getAttemptResult(OTHER_GUEST, started.attemptId)).rejects.toMatchObject({
      code: "ATTEMPT_NOT_FOUND",
      status: 404,
    });
  });

  it("phiên khác không thể nộp bài và không làm thay đổi trạng thái", async () => {
    const started = await startAttempt(GUEST, "exam-1");

    await expect(submitAttempt(OTHER_GUEST, started.attemptId)).rejects.toMatchObject({
      code: "ATTEMPT_NOT_FOUND",
      status: 404,
    });
    expect(state.attempts[0].status).toBe("IN_PROGRESS");
    expect(state.attempts[0].score).toBeNull();
  });

  it("phiên khác không thể ghi đáp án vào lượt làm bài", async () => {
    const started = await startAttempt(GUEST, "exam-1");

    await expect(
      saveAnswer(OTHER_GUEST, started.attemptId, {
        questionId: "question-1",
        optionId: "opt-b",
      }),
    ).rejects.toMatchObject({ code: "ATTEMPT_NOT_FOUND", status: 404 });
    expect(state.answers[0].selectedOptionId).toBeNull();
  });
});

describe("cô lập theo tài khoản", () => {
  it("lượt làm bài của người đã đăng nhập được gắn userId", async () => {
    await startAttempt(STUDENT, "exam-1");

    expect(state.attempts).toHaveLength(1);
    expect(state.attempts[0].userId).toBe("user-1");
    expect(state.attempts[0].sessionId).toBe("auth-session-1");
  });

  it("tiếp tục lượt đang dở từ thiết bị khác khi cùng tài khoản", async () => {
    const first = await startAttempt(STUDENT, "exam-1");
    const otherDevice: AttemptOwnerRef = { sessionId: "cookie-thiet-bi-2", userId: "user-1" };

    const second = await startAttempt(otherDevice, "exam-1");

    expect(second.resumed).toBe(true);
    expect(second.attemptId).toBe(first.attemptId);
    expect(state.attempts).toHaveLength(1);
  });

  it("mỗi tài khoản có lượt làm bài riêng dù dùng chung trình duyệt", async () => {
    const first = await startAttempt(STUDENT, "exam-1");
    const second = await startAttempt(OTHER_STUDENT, "exam-1");

    expect(second.resumed).toBe(false);
    expect(second.attemptId).not.toBe(first.attemptId);
    expect(state.attempts.map((attempt) => attempt.userId)).toEqual(["user-1", "user-2"]);
  });

  it("khách ẩn danh nhận 404 khi đọc lượt làm bài của tài khoản", async () => {
    const started = await startAttempt(STUDENT, "exam-1");

    await expect(getCurrentAttempt(GUEST, started.attemptId)).rejects.toMatchObject({
      code: "ATTEMPT_NOT_FOUND",
      status: 404,
    });
    await expect(
      saveAnswer(GUEST, started.attemptId, { questionId: "question-1", optionId: "opt-b" }),
    ).rejects.toMatchObject({ code: "ATTEMPT_NOT_FOUND", status: 404 });
    await expect(submitAttempt(GUEST, started.attemptId)).rejects.toMatchObject({
      code: "ATTEMPT_NOT_FOUND",
      status: 404,
    });
    expect(state.answers[0].selectedOptionId).toBeNull();
    expect(state.attempts[0].status).toBe("IN_PROGRESS");
  });

  it("tài khoản không tiếp tục rồi chiếm lượt làm bài ẩn danh cũ", async () => {
    const anonymous = await startAttempt(GUEST, "exam-1");

    const loggedIn = await startAttempt(STUDENT, "exam-1");

    expect(loggedIn.resumed).toBe(false);
    expect(loggedIn.attemptId).not.toBe(anonymous.attemptId);
    await expect(getCurrentAttempt(STUDENT, anonymous.attemptId)).rejects.toMatchObject({
      code: "ATTEMPT_NOT_FOUND",
      status: 404,
    });
  });

  it("khách ẩn danh không tiếp tục lượt làm bài của tài khoản sau khi đăng xuất", async () => {
    await startAttempt(STUDENT, "exam-1");

    const anonymous = await startAttempt(OTHER_GUEST, "exam-1");

    expect(anonymous.resumed).toBe(false);
    expect(state.attempts).toHaveLength(2);
    expect(state.attempts[1].userId).toBeNull();
  });

  it("người dùng khác không xem được kết quả của tài khoản khác", async () => {
    const started = await startAttempt(STUDENT, "exam-1");
    await submitAttempt(STUDENT, started.attemptId);

    await expect(getAttemptResult(OTHER_STUDENT, started.attemptId)).rejects.toMatchObject({
      code: "ATTEMPT_NOT_FOUND",
      status: 404,
    });
  });
});

describe("lịch sử làm bài", () => {
  const FULL_PAGE: AttemptHistoryQuery = { page: 1, pageSize: 10 };

  it("khách ẩn danh chỉ thấy lượt làm bài của chính cookie phiên", async () => {
    const mine = await startAttempt(GUEST, "exam-1");
    const others = await startAttempt(OTHER_GUEST, "exam-1");

    const history = await listAttemptHistory(GUEST, FULL_PAGE);

    expect(history.total).toBe(1);
    expect(history.items.map((item) => item.attemptId)).toEqual([mine.attemptId]);
    expect(history.items.map((item) => item.attemptId)).not.toContain(others.attemptId);
    expect(history.items[0].status).toBe("IN_PROGRESS");
    expect(history.items[0].canResume).toBe(true);
    expect(history.items[0].score).toBeNull();
  });

  it("tài khoản thấy mọi lượt làm bài của mình, kể cả lượt làm từ thiết bị khác", async () => {
    const first = await startAttempt(STUDENT, "exam-1");
    await submitAttempt(STUDENT, first.attemptId);

    const otherDevice: AttemptOwnerRef = { sessionId: "cookie-thiet-bi-2", userId: "user-1" };
    const second = await startAttempt(otherDevice, "exam-1");

    const history = await listAttemptHistory(otherDevice, FULL_PAGE);

    expect(history.total).toBe(2);
    // Mới nhất lên đầu: lượt vừa tạo đứng trước lượt đã nộp.
    expect(history.items.map((item) => item.attemptId)).toEqual([
      second.attemptId,
      first.attemptId,
    ]);

    const submitted = history.items[1];
    expect(submitted.status).toBe("SUBMITTED");
    expect(submitted.canResume).toBe(false);
    expect(submitted.score).toBe(0);
    expect(submitted.maxScore).toBe(4);
    expect(submitted.correctCount).toBe(0);
    expect(submitted.unansweredCount).toBe(4);
    expect(submitted.questionCount).toBe(4);
    expect(submitted.examId).toBe("exam-1");
    expect(submitted.examTitle).toBe("Đề thi thử môn Toán — số 1");
    expect(submitted.subjectName).toBe("Toán");
  });

  it("lịch sử của tài khoản và của khách không lẫn vào nhau", async () => {
    await startAttempt(GUEST, "exam-1");
    const account = await startAttempt(STUDENT, "exam-1");

    const accountHistory = await listAttemptHistory(STUDENT, FULL_PAGE);
    const guestHistory = await listAttemptHistory(GUEST, FULL_PAGE);

    expect(accountHistory.total).toBe(1);
    expect(accountHistory.items[0].attemptId).toBe(account.attemptId);
    expect(guestHistory.total).toBe(1);
    expect(guestHistory.items[0].attemptId).not.toBe(account.attemptId);
  });

  it("lượt quá hạn hiện là EXPIRED và không thể tiếp tục", async () => {
    await startAttempt(GUEST, "exam-1");
    state.attempts[0].expiresAt = new Date(Date.now() - 60_000);

    const history = await listAttemptHistory(GUEST, FULL_PAGE);

    expect(history.items[0].status).toBe("EXPIRED");
    expect(history.items[0].canResume).toBe(false);
  });

  it("phân trang theo pageSize và trả về tổng số lượt", async () => {
    const attemptIds: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const started = await startAttempt(STUDENT, "exam-1");
      await submitAttempt(STUDENT, started.attemptId);
      attemptIds.push(started.attemptId);
    }

    const firstPage = await listAttemptHistory(STUDENT, { page: 1, pageSize: 2 });
    const secondPage = await listAttemptHistory(STUDENT, { page: 2, pageSize: 2 });

    expect(firstPage.total).toBe(3);
    expect(firstPage.totalPages).toBe(2);
    expect(firstPage.items.map((item) => item.attemptId)).toEqual([
      attemptIds[2],
      attemptIds[1],
    ]);
    expect(secondPage.totalPages).toBe(2);
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0].attemptId).toBe(attemptIds[0]);
  });

  it("chưa có cookie phiên thì trả trang rỗng mà không truy vấn dữ liệu", async () => {
    await startAttempt(GUEST, "exam-1");

    const history = await listAttemptHistory(null, FULL_PAGE);

    expect(history.items).toEqual([]);
    expect(history.total).toBe(0);
    expect(history.totalPages).toBe(0);
  });
});


