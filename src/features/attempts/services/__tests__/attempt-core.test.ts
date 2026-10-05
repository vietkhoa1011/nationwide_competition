import { describe, expect, it } from "vitest";

import { AppError, type AppErrorCode } from "@/lib/errors";

import {
  assertAnswersEditable,
  assertAttemptOwnership,
  assertResultReady,
  computeExpiresAt,
  isDeadlinePassed,
  resolveEffectiveStatus,
  secondsUntilDeadline,
  serializeAttemptResult,
  serializeStudentAttempt,
  toCorrectOptionIds,
  toStudentOptions,
  type SerializableAttemptAnswerRow,
  type SerializableAttemptRow,
} from "@/features/attempts/services/attempt-core";

const STARTED_AT = new Date("2027-06-01T00:00:00.000Z");
const EXPIRES_AT = new Date("2027-06-01T00:50:00.000Z");

function answerRow(
  overrides: Partial<SerializableAttemptAnswerRow> = {},
): SerializableAttemptAnswerRow {
  return {
    questionId: "question-1",
    snapshotPosition: 1,
    snapshotType: "SINGLE_CHOICE",
    snapshotLevel: "MEDIUM",
    snapshotPoints: 1,
    snapshotContent: "Nội dung câu hỏi 1?",
    snapshotExplanation: "Lời giải chi tiết câu 1.",
    snapshotOptions: [
      { id: "opt-a", label: "A", content: "Đáp án A", order: 1 },
      { id: "opt-b", label: "B", content: "Đáp án B", order: 2 },
    ],
    snapshotCorrectOptionIds: ["opt-b"],
    selectedOptionId: null,
    isFlagged: false,
    isCorrect: null,
    ...overrides,
  };
}

function attemptRow(overrides: Partial<SerializableAttemptRow> = {}): SerializableAttemptRow {
  return {
    id: "attempt-1",
    sessionId: "session-1",
    examId: "exam-1",
    status: "IN_PROGRESS",
    startedAt: STARTED_AT,
    expiresAt: EXPIRES_AT,
    submittedAt: null,
    score: null,
    maxScore: null,
    correctCount: null,
    incorrectCount: null,
    unansweredCount: null,
    lastQuestionPosition: 1,
    exam: { id: "exam-1", title: "Đề thi thử môn Toán — số 1", durationMinutes: 50 },
    answers: [answerRow()],
    ...overrides,
  };
}

function expectAppError(fn: () => void, code: AppErrorCode, status: number): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    expect((error as AppError).status).toBe(status);
    return;
  }
  throw new Error(`Mong đợi lỗi ${code} nhưng không có lỗi nào được ném ra.`);
}

describe("computeExpiresAt", () => {
  it("cộng đúng số phút vào thời điểm bắt đầu", () => {
    expect(computeExpiresAt(STARTED_AT, 50).toISOString()).toBe("2027-06-01T00:50:00.000Z");
  });

  it("dùng 1 phút khi thời lượng không hợp lệ để không tạo bài không hạn", () => {
    expect(computeExpiresAt(STARTED_AT, 0).toISOString()).toBe("2027-06-01T00:01:00.000Z");
    expect(computeExpiresAt(STARTED_AT, -5).toISOString()).toBe("2027-06-01T00:01:00.000Z");
    expect(computeExpiresAt(STARTED_AT, Number.NaN).toISOString()).toBe(
      "2027-06-01T00:01:00.000Z",
    );
  });
});

describe("isDeadlinePassed / secondsUntilDeadline", () => {
  it("coi thời điểm bằng đúng hạn là đã hết giờ", () => {
    expect(isDeadlinePassed(EXPIRES_AT, new Date(EXPIRES_AT))).toBe(true);
    expect(isDeadlinePassed(EXPIRES_AT, new Date("2027-06-01T00:49:59.999Z"))).toBe(false);
  });

  it("trả về số giây còn lại, không bao giờ âm", () => {
    expect(secondsUntilDeadline(EXPIRES_AT, STARTED_AT)).toBe(3000);
    expect(secondsUntilDeadline(EXPIRES_AT, new Date("2027-06-01T00:50:30.000Z"))).toBe(0);
  });
});

describe("resolveEffectiveStatus", () => {
  it("chuyển IN_PROGRESS quá hạn thành EXPIRED dù chưa có thao tác nào", () => {
    expect(resolveEffectiveStatus("IN_PROGRESS", EXPIRES_AT, new Date(EXPIRES_AT))).toBe("EXPIRED");
  });

  it("giữ nguyên IN_PROGRESS khi còn hạn", () => {
    expect(
      resolveEffectiveStatus("IN_PROGRESS", EXPIRES_AT, new Date("2027-06-01T00:10:00.000Z")),
    ).toBe("IN_PROGRESS");
  });

  it("không đổi trạng thái đã chốt", () => {
    expect(resolveEffectiveStatus("SUBMITTED", EXPIRES_AT, new Date(EXPIRES_AT))).toBe("SUBMITTED");
  });
});

describe("assertAttemptOwnership", () => {
  const guest = { sessionId: "session-1", userId: null };

  it("cho qua khi chủ là khách và phiên cookie trùng khớp", () => {
    expect(() =>
      assertAttemptOwnership({ sessionId: "session-1", userId: null }, guest),
    ).not.toThrow();
  });

  it("cho qua khi chủ đã đăng nhập và userId trùng khớp", () => {
    expect(() =>
      assertAttemptOwnership(
        { sessionId: "session-1", userId: "user-1" },
        { sessionId: "auth-session-1", userId: "user-1" },
      ),
    ).not.toThrow();
  });

  it("cho qua khi đăng nhập ở thiết bị khác (cookie khác, cùng tài khoản)", () => {
    expect(() =>
      assertAttemptOwnership(
        { sessionId: "session-1", userId: "user-1" },
        { sessionId: "cookie-cua-thiet-bi-2", userId: "user-1" },
      ),
    ).not.toThrow();
  });

  it("trả 404 khi người dùng khác mở lượt làm bài của tài khoản khác", () => {
    expectAppError(
      () =>
        assertAttemptOwnership(
          { sessionId: "session-1", userId: "user-1" },
          { sessionId: "auth-session-2", userId: "user-2" },
        ),
      "ATTEMPT_NOT_FOUND",
      404,
    );
  });

  it("trả 404 khi khách ẩn danh mở lượt làm bài của tài khoản", () => {
    expectAppError(
      () => assertAttemptOwnership({ sessionId: "session-1", userId: "user-1" }, guest),
      "ATTEMPT_NOT_FOUND",
      404,
    );
  });

  it("trả 404 khi tài khoản mở lượt làm bài ẩn danh của cùng trình duyệt", () => {
    expectAppError(
      () =>
        assertAttemptOwnership(
          { sessionId: "session-1", userId: null },
          { sessionId: "session-1", userId: "user-1" },
        ),
      "ATTEMPT_NOT_FOUND",
      404,
    );
  });

  it("trả 404 khi phiên khác để không lộ sự tồn tại của lượt làm bài", () => {
    expectAppError(
      () =>
        assertAttemptOwnership(
          { sessionId: "session-1", userId: null },
          { sessionId: "session-2", userId: null },
        ),
      "ATTEMPT_NOT_FOUND",
      404,
    );
  });

  it("trả 404 khi thiếu chủ sở hữu", () => {
    expectAppError(
      () => assertAttemptOwnership({ sessionId: "session-1", userId: null }, null),
      "ATTEMPT_NOT_FOUND",
      404,
    );
  });
});
describe("assertAnswersEditable", () => {
  it("cho sửa khi bài đang làm và còn hạn", () => {
    expect(() =>
      assertAnswersEditable({ status: "IN_PROGRESS", expiresAt: EXPIRES_AT }, STARTED_AT),
    ).not.toThrow();
  });

  it("chặn sửa khi bài đã nộp", () => {
    expectAppError(
      () => assertAnswersEditable({ status: "SUBMITTED", expiresAt: EXPIRES_AT }, STARTED_AT),
      "ATTEMPT_SUBMITTED",
      409,
    );
  });

  it("chặn sửa khi bài đã hết hạn (kể cả khi còn IN_PROGRESS trong database)", () => {
    expectAppError(
      () => assertAnswersEditable({ status: "IN_PROGRESS", expiresAt: EXPIRES_AT }, EXPIRES_AT),
      "ATTEMPT_EXPIRED",
      409,
    );
    expectAppError(
      () => assertAnswersEditable({ status: "EXPIRED", expiresAt: EXPIRES_AT }, STARTED_AT),
      "ATTEMPT_EXPIRED",
      409,
    );
  });
});

describe("assertResultReady", () => {
  it("chặn xem kết quả khi bài chưa nộp", () => {
    expectAppError(() => assertResultReady("IN_PROGRESS"), "RESULT_NOT_READY", 409);
  });

  it("cho xem kết quả khi bài đã nộp hoặc đã hết hạn", () => {
    expect(() => assertResultReady("SUBMITTED")).not.toThrow();
    expect(() => assertResultReady("EXPIRED")).not.toThrow();
  });
});

describe("toStudentOptions / toCorrectOptionIds", () => {
  it("sắp xếp lựa chọn theo thứ tự hiển thị", () => {
    const options = toStudentOptions([
      { id: "opt-b", label: "B", content: "Đáp án B", order: 2 },
      { id: "opt-a", label: "A", content: "Đáp án A", order: 1 },
    ]);
    expect(options.map((option) => option.id)).toEqual(["opt-a", "opt-b"]);
    expect(Object.keys(options[0])).toEqual(["id", "label", "content", "order"]);
  });

  it("trả mảng rỗng khi dữ liệu snapshot không hợp lệ", () => {
    expect(toStudentOptions(null)).toEqual([]);
    expect(toStudentOptions([{ id: 1 }])).toEqual([]);
  });

  it("đọc danh sách đáp án đúng và chịu được dữ liệu hỏng", () => {
    expect(toCorrectOptionIds(["opt-b"])).toEqual(["opt-b"]);
    expect(toCorrectOptionIds(null)).toEqual([]);
    expect(toCorrectOptionIds("opt-b")).toEqual([]);
  });
});

describe("serializeStudentAttempt", () => {
  it("không lộ đáp án đúng hay lời giải trước khi nộp bài", () => {
    const dto = serializeStudentAttempt(
      attemptRow({
        answers: [
          answerRow({ snapshotPosition: 2, questionId: "question-2", selectedOptionId: "opt-a" }),
          answerRow({
            snapshotPosition: 1,
            questionId: "question-1",
            selectedOptionId: "opt-b",
            isFlagged: true,
          }),
        ],
      }),
      { status: "IN_PROGRESS", now: STARTED_AT },
    );

    const serialized = JSON.stringify(dto);
    expect(serialized).not.toContain("snapshot");
    expect(serialized).not.toContain("Lời giải chi tiết");
    expect(serialized).not.toContain("correctOptionIds");
    expect(serialized).not.toContain("isCorrect");

    expect(Object.keys(dto.questions[0]).sort()).toEqual([
      "content",
      "isFlagged",
      "level",
      "options",
      "points",
      "position",
      "questionId",
      "selectedOptionId",
      "type",
    ]);
    expect(Object.keys(dto.questions[0].options[0]).sort()).toEqual([
      "content",
      "id",
      "label",
      "order",
    ]);
  });

  it("sắp xếp câu hỏi theo vị trí và đếm số câu đã làm / đã đánh dấu", () => {
    const dto = serializeStudentAttempt(
      attemptRow({
        answers: [
          answerRow({ snapshotPosition: 2, questionId: "question-2", selectedOptionId: "opt-a" }),
          answerRow({ snapshotPosition: 1, questionId: "question-1", isFlagged: true }),
          answerRow({ snapshotPosition: 3, questionId: "question-3" }),
        ],
      }),
      { status: "IN_PROGRESS", now: STARTED_AT },
    );

    expect(dto.questions.map((question) => question.position)).toEqual([1, 2, 3]);
    expect(dto.counts).toEqual({ total: 3, answered: 1, flagged: 1 });
    expect(dto.serverTime).toBe(STARTED_AT.toISOString());
    expect(dto.submittedAt).toBeNull();
    expect(dto.durationMinutes).toBe(50);
  });
});

describe("serializeAttemptResult", () => {
  it("trả kèm đáp án đúng, lời giải và điểm từng câu sau khi chốt bài", () => {
    const dto = serializeAttemptResult(
      attemptRow({
        status: "SUBMITTED",
        submittedAt: EXPIRES_AT,
        score: 1,
        maxScore: 1,
        correctCount: 1,
        incorrectCount: 0,
        unansweredCount: 0,
        answers: [answerRow({ selectedOptionId: "opt-b", isCorrect: true })],
      }),
      { status: "SUBMITTED", now: EXPIRES_AT },
    );

    expect(dto.status).toBe("SUBMITTED");
    expect(dto.score).toBe(1);
    expect(dto.maxScore).toBe(1);
    expect(dto.questions[0].correctOptionIds).toEqual(["opt-b"]);
    expect(dto.questions[0].explanation).toBe("Lời giải chi tiết câu 1.");
    expect(dto.questions[0].earnedPoints).toBe(1);
    expect(dto.questions[0].isCorrect).toBe(true);
  });

  it("dùng 0 cho điểm chưa được chấm và tính điểm từng câu theo điểm snapshot", () => {
    const dto = serializeAttemptResult(
      attemptRow({
        answers: [
          answerRow({ snapshotPoints: 2, isCorrect: null }),
          answerRow({ snapshotPoints: 2, isCorrect: true }),
        ],
      }),
      { status: "EXPIRED", now: EXPIRES_AT },
    );

    expect(dto.score).toBe(0);
    expect(dto.maxScore).toBe(0);
    expect(dto.questions.map((question) => question.earnedPoints)).toEqual([0, 2]);
    expect(dto.questions.map((question) => question.isCorrect)).toEqual([false, true]);
  });
});
