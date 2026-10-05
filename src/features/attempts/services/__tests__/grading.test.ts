import { describe, expect, it } from "vitest";

import {
  gradeAttempt,
  gradeQuestion,
  isAnswered,
  isAnswerCorrect,
  roundScore,
  type GradableQuestion,
} from "@/features/attempts/services/grading";

/** Câu hỏi mẫu: 1 điểm, đáp án đúng là "opt-b". */
function question(overrides: Partial<GradableQuestion> = {}): GradableQuestion {
  return {
    questionId: "question-1",
    position: 1,
    points: 1,
    correctOptionIds: ["opt-b"],
    selectedOptionId: null,
    ...overrides,
  };
}

describe("roundScore", () => {
  it("làm tròn tới 2 chữ số thập phân", () => {
    expect(roundScore(1 / 3)).toBe(0.33);
    expect(roundScore(2.666_666)).toBe(2.67);
    expect(roundScore(0.005)).toBe(0.01);
    expect(roundScore(0)).toBe(0);
  });
});

describe("isAnswered", () => {
  it("chỉ coi là đã trả lời khi có mã lựa chọn không rỗng", () => {
    expect(isAnswered("opt-b")).toBe(true);
    expect(isAnswered(null)).toBe(false);
    expect(isAnswered(undefined)).toBe(false);
    expect(isAnswered("")).toBe(false);
  });
});

describe("isAnswerCorrect", () => {
  it("đúng khi lựa chọn nằm trong danh sách đáp án đúng", () => {
    expect(isAnswerCorrect("opt-b", ["opt-b"])).toBe(true);
    expect(isAnswerCorrect("opt-b", ["opt-a", "opt-b"])).toBe(true);
  });

  it("sai khi chọn nhầm hoặc bỏ trống", () => {
    expect(isAnswerCorrect("opt-a", ["opt-b"])).toBe(false);
    expect(isAnswerCorrect(null, ["opt-b"])).toBe(false);
    expect(isAnswerCorrect("", ["opt-b"])).toBe(false);
  });
});

describe("gradeQuestion", () => {
  it("cộng điểm khi chọn đúng", () => {
    const result = gradeQuestion(question({ points: 2, selectedOptionId: "opt-b" }));
    expect(result.isCorrect).toBe(true);
    expect(result.earnedPoints).toBe(2);
  });

  it("không cộng điểm khi chọn sai", () => {
    const result = gradeQuestion(question({ selectedOptionId: "opt-c" }));
    expect(result.isCorrect).toBe(false);
    expect(result.earnedPoints).toBe(0);
  });

  it("không cộng điểm khi bỏ trống", () => {
    const result = gradeQuestion(question({ selectedOptionId: null }));
    expect(result.isCorrect).toBe(false);
    expect(result.earnedPoints).toBe(0);
  });

  it("sao chép danh sách đáp án đúng nên không bị ảnh hưởng khi sửa kết quả", () => {
    const input = question();
    const result = gradeQuestion(input);
    result.correctOptionIds.push("opt-x");
    expect(input.correctOptionIds).toEqual(["opt-b"]);
  });
});

describe("gradeAttempt", () => {
  it("cộng điểm, đếm số câu đúng/sai/bỏ trống và tổng điểm tối đa", () => {
    const outcome = gradeAttempt([
      question({ questionId: "q1", position: 1, selectedOptionId: "opt-b" }),
      question({ questionId: "q2", position: 2, selectedOptionId: "opt-a" }),
      question({ questionId: "q3", position: 3, selectedOptionId: null }),
      question({ questionId: "q4", position: 4, points: 2, selectedOptionId: "opt-b" }),
    ]);

    expect(outcome.score).toBe(3);
    expect(outcome.maxScore).toBe(5);
    expect(outcome.correctCount).toBe(2);
    expect(outcome.incorrectCount).toBe(1);
    expect(outcome.unansweredCount).toBe(1);
    expect(outcome.questions.map((item) => item.earnedPoints)).toEqual([1, 0, 0, 2]);
  });

  it("làm tròn tổng điểm khi câu hỏi có điểm lẻ", () => {
    const outcome = gradeAttempt([
      question({ questionId: "q1", points: 1 / 3, selectedOptionId: "opt-b" }),
      question({ questionId: "q2", points: 1 / 3, selectedOptionId: "opt-b" }),
      question({ questionId: "q3", points: 1 / 3, selectedOptionId: "opt-b" }),
    ]);

    expect(outcome.score).toBe(1);
    expect(outcome.maxScore).toBe(1);
  });

  it("trả về 0 điểm khi đề không có câu hỏi", () => {
    const outcome = gradeAttempt([]);
    expect(outcome).toEqual({
      score: 0,
      maxScore: 0,
      correctCount: 0,
      incorrectCount: 0,
      unansweredCount: 0,
      questions: [],
    });
  });
});
