import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors";

import { createFakePrisma, type FakePrismaState } from "@/features/attempts/services/__tests__/fake-prisma";
import {
  getAttemptResult,
  getCurrentAttempt,
  saveAnswer,
  startAttempt,
  submitAttempt,
} from "@/features/attempts/services/attempts-service";

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
    const result = await startAttempt("session-1", "exam-1");

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
    const first = await startAttempt("session-1", "exam-1");
    const second = await startAttempt("session-1", "exam-1");

    expect(second.resumed).toBe(true);
    expect(second.attemptId).toBe(first.attemptId);
    expect(state.attempts).toHaveLength(1);
  });

  it("chốt lượt cũ đã quá hạn rồi mới tạo lượt mới", async () => {
    const first = await startAttempt("session-1", "exam-1");
    state.attempts[0].expiresAt = new Date(Date.now() - 1_000);

    const second = await startAttempt("session-1", "exam-1");

    expect(second.resumed).toBe(false);
    expect(second.attemptId).not.toBe(first.attemptId);
    expect(state.attempts).toHaveLength(2);
    expect(state.attempts[0].status).toBe("EXPIRED");
  });

  it("báo 404 khi đề thi không tồn tại hoặc chưa xuất bản", async () => {
    await expect(startAttempt("session-1", "exam-khong-ton-tai")).rejects.toMatchObject({
      code: "EXAM_NOT_FOUND",
      status: 404,
    });
  });
});

describe("getCurrentAttempt", () => {
  it("payload khi đang làm bài không chứa đáp án đúng hay lời giải", async () => {
    const started = await startAttempt("session-1", "exam-1");
    const current = await getCurrentAttempt("session-1", started.attemptId);

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
    const started = await startAttempt("session-1", "exam-1");

    const saved = await saveAnswer("session-1", started.attemptId, {
      questionId: "question-1",
      optionId: "opt-b",
    });
    expect(saved.selectedOptionId).toBe("opt-b");
    expect(state.answers[0].selectedOptionId).toBe("opt-b");
    expect(state.answers[0].answeredAt).not.toBeNull();

    const cleared = await saveAnswer("session-1", started.attemptId, {
      questionId: "question-1",
      optionId: null,
    });
    expect(cleared.selectedOptionId).toBeNull();
    expect(state.answers[0].selectedOptionId).toBeNull();
    expect(state.answers[0].answeredAt).toBeNull();
  });

  it("chặn lựa chọn không thuộc câu hỏi và câu hỏi không thuộc đề", async () => {
    const started = await startAttempt("session-1", "exam-1");

    await expect(
      saveAnswer("session-1", started.attemptId, { questionId: "question-1", optionId: "opt-z" }),
    ).rejects.toMatchObject({ code: "OPTION_NOT_IN_QUESTION", status: 422 });

    await expect(
      saveAnswer("session-1", started.attemptId, { questionId: "question-999", optionId: "opt-b" }),
    ).rejects.toMatchObject({ code: "QUESTION_NOT_IN_ATTEMPT", status: 404 });

    expect(state.answers.every((answer) => answer.selectedOptionId === null)).toBe(true);
  });
});

describe("submitAttempt", () => {
  it("chấm điểm trên máy chủ và đánh dấu đúng/sai cho từng câu", async () => {
    const started = await startAttempt("session-1", "exam-1");
    await saveAnswer("session-1", started.attemptId, {
      questionId: "question-1",
      optionId: "opt-b",
    });
    await saveAnswer("session-1", started.attemptId, {
      questionId: "question-2",
      optionId: "opt-b",
    });
    await saveAnswer("session-1", started.attemptId, {
      questionId: "question-3",
      optionId: "opt-a",
    });

    const result = await submitAttempt("session-1", started.attemptId);

    expect(result.status).toBe("SUBMITTED");
    expect(result.score).toBe(2);
    expect(result.maxScore).toBe(4);
    expect(result.correctCount).toBe(2);
    expect(result.incorrectCount).toBe(1);
    expect(result.unansweredCount).toBe(1);
    expect(state.answers.map((answer) => answer.isCorrect)).toEqual([true, true, false, false]);
  });

  it("nộp bài nhiều lần chỉ ghi điểm một lần duy nhất (idempotent)", async () => {
    const started = await startAttempt("session-1", "exam-1");
    await saveAnswer("session-1", started.attemptId, {
      questionId: "question-1",
      optionId: "opt-b",
    });

    const first = await submitAttempt("session-1", started.attemptId);
    const submittedAt = state.attempts[0].submittedAt;

    const second = await submitAttempt("session-1", started.attemptId);
    const third = await submitAttempt("session-1", started.attemptId);

    expect(first.score).toBe(1);
    expect(second.score).toBe(1);
    expect(third.score).toBe(1);
    expect(second.submittedAt).toBe(first.submittedAt);
    expect(state.attempts[0].submittedAt).toEqual(submittedAt);
    expect(state.attempts[0].score).toBe(1);
  });

  it("không cho sửa đáp án sau khi đã nộp", async () => {
    const started = await startAttempt("session-1", "exam-1");
    await submitAttempt("session-1", started.attemptId);

    await expect(
      saveAnswer("session-1", started.attemptId, { questionId: "question-1", optionId: "opt-b" }),
    ).rejects.toMatchObject({ code: "ATTEMPT_SUBMITTED", status: 409 });
  });
});
describe("chốt bài khi hết giờ", () => {
  it("chấm điểm ngay lần đọc kế tiếp dù người dùng chưa bấm nộp", async () => {
    const started = await startAttempt("session-1", "exam-1");
    state.answers[0].selectedOptionId = "opt-b";

    // Giả lập người dùng đóng trình duyệt cho tới khi hết giờ.
    state.attempts[0].expiresAt = new Date(Date.now() - 60_000);

    const attempt = await getCurrentAttempt("session-1", started.attemptId);
    expect(attempt.status).toBe("EXPIRED");

    const result = await getAttemptResult("session-1", started.attemptId);
    expect(result.status).toBe("EXPIRED");
    expect(result.score).toBe(1);
    expect(result.correctCount).toBe(1);
    expect(state.attempts[0].status).toBe("EXPIRED");
    expect(state.attempts[0].submittedAt).not.toBeNull();
  });

  it("chặn xem kết quả khi bài còn trong thời gian làm", async () => {
    const started = await startAttempt("session-1", "exam-1");

    await expect(getAttemptResult("session-1", started.attemptId)).rejects.toMatchObject({
      code: "RESULT_NOT_READY",
      status: 409,
    });
  });
});

describe("cô lập theo phiên", () => {
  it("phiên khác nhận 404 khi đọc lượt làm bài", async () => {
    const started = await startAttempt("session-1", "exam-1");

    await expect(getCurrentAttempt("session-2", started.attemptId)).rejects.toBeInstanceOf(AppError);
    await expect(getCurrentAttempt("session-2", started.attemptId)).rejects.toMatchObject({
      code: "ATTEMPT_NOT_FOUND",
      status: 404,
    });
    await expect(getAttemptResult("session-2", started.attemptId)).rejects.toMatchObject({
      code: "ATTEMPT_NOT_FOUND",
      status: 404,
    });
  });

  it("phiên khác không thể nộp bài và không làm thay đổi trạng thái", async () => {
    const started = await startAttempt("session-1", "exam-1");

    await expect(submitAttempt("session-2", started.attemptId)).rejects.toMatchObject({
      code: "ATTEMPT_NOT_FOUND",
      status: 404,
    });
    expect(state.attempts[0].status).toBe("IN_PROGRESS");
    expect(state.attempts[0].score).toBeNull();
  });

  it("phiên khác không thể ghi đáp án vào lượt làm bài", async () => {
    const started = await startAttempt("session-1", "exam-1");

    await expect(
      saveAnswer("session-2", started.attemptId, {
        questionId: "question-1",
        optionId: "opt-b",
      }),
    ).rejects.toMatchObject({ code: "ATTEMPT_NOT_FOUND", status: 404 });
    expect(state.answers[0].selectedOptionId).toBeNull();
  });
});
