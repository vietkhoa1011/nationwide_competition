import { describe, expect, it } from "vitest";

import {
  assertCanManageExam,
  assertContentEditable,
  assertExamPublishable,
  assertExamScopeAllowedForCreate,
  assertRevisionMatches,
  buildDuplicatedQuestion,
  buildQuestionOrder,
  canManageExam,
  isSupportedQuestionType,
  toStudentQuestionPayload,
  validateExamForPublish,
  type ExamActor,
  type PublishCandidateQuestion,
} from "@/features/authoring/services/exam-authoring-core";
import { normalizeRichDoc } from "@/features/authoring/services/rich-content-core";

/**
 * Luật nghiệp vụ thuần của tính năng soạn đề: quyền theo phạm vi, kiểm tra trước khi xuất
 * bản, nhân bản câu hỏi và lọc đáp án khỏi payload dành cho học sinh.
 */
const TEACHER_A: ExamActor = { id: "teacher-a", role: "TEACHER" };
const ADMIN: ExamActor = { id: "admin-1", role: "ADMIN" };
const STUDENT: ExamActor = { id: "student-1", role: "STUDENT" };

const classExamOfA = {
  scope: "CLASS" as const,
  classroomId: "class-a",
  createdById: "teacher-a",
  classroomOwnerId: "teacher-a",
};

const classExamOfB = {
  scope: "CLASS" as const,
  classroomId: "class-b",
  createdById: "teacher-b",
  classroomOwnerId: "teacher-b",
};

const publicExam = {
  scope: "PUBLIC" as const,
  classroomId: null,
  createdById: "admin-1",
  classroomOwnerId: null,
};

function paragraph(text: string) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function mathParagraph(latex: string) {
  return { type: "paragraph", content: [{ type: "mathInline", attrs: { latex } }] };
}

function candidate(overrides: Partial<PublishCandidateQuestion> = {}): PublishCandidateQuestion {
  return {
    id: "question-1",
    type: "SINGLE_CHOICE",
    points: 1,
    content: "Nội dung câu hỏi",
    contentDoc: normalizeRichDoc({
      doc: { type: "doc", content: [paragraph("Nội dung câu hỏi")] },
    }),
    explanation: "Lời giải",
    explanationDoc: normalizeRichDoc({ doc: { type: "doc", content: [paragraph("Lời giải")] } }),
    options: [
      { id: "opt-a", label: "A", content: "Đáp án A", contentDoc: null, isCorrect: true },
      { id: "opt-b", label: "B", content: "Đáp án B", contentDoc: null, isCorrect: false },
    ],
    ...overrides,
  };
}

describe("quyền theo phạm vi đề", () => {
  it("giáo viên quản lý được đề của lớp mình và bị chặn với lớp khác", () => {
    expect(canManageExam(TEACHER_A, classExamOfA)).toBe(true);
    expect(() => assertCanManageExam(TEACHER_A, classExamOfB)).toThrowError(
      /không có quyền quản lý đề thi này/,
    );
  });

  it("giáo viên không quản lý được đề công khai, quản trị viên thì được", () => {
    expect(canManageExam(TEACHER_A, publicExam)).toBe(false);
    expect(canManageExam(ADMIN, publicExam)).toBe(true);
    expect(canManageExam(ADMIN, classExamOfB)).toBe(true);
  });

  it("học sinh không bao giờ quản lý được đề", () => {
    expect(canManageExam(STUDENT, publicExam)).toBe(false);
    expect(canManageExam(STUDENT, classExamOfA)).toBe(false);
  });

  it("chặn giáo viên tạo đề công khai hoặc đề cho lớp không phụ trách", () => {
    expect(() => assertExamScopeAllowedForCreate(TEACHER_A, "PUBLIC", null)).toThrowError(
      /không thể tạo đề công khai/,
    );
    expect(() => assertExamScopeAllowedForCreate(TEACHER_A, "CLASS", "teacher-b")).toThrowError(
      /chỉ có thể tạo đề cho lớp do mình phụ trách/,
    );
    expect(() => assertExamScopeAllowedForCreate(TEACHER_A, "CLASS", "teacher-a")).not.toThrow();
    expect(() => assertExamScopeAllowedForCreate(ADMIN, "PUBLIC", null)).not.toThrow();
  });
});

describe("vòng đời nội dung", () => {
  it("khoá nội dung khi đề đã có lượt làm bài", () => {
    expect(() => assertContentEditable(0)).not.toThrow();
    expect(() => assertContentEditable(3)).toThrowError(/đã có lượt làm bài/);
  });

  it("phát hiện xung đột phiên bản khi nhiều tab cùng sửa", () => {
    expect(() => assertRevisionMatches(4, 4)).not.toThrow();
    expect(() => assertRevisionMatches(undefined, 9)).not.toThrow();
    expect(() => assertRevisionMatches(3, 4)).toThrowError(/đã được thay đổi ở nơi khác/);
  });
});

describe("buildQuestionOrder", () => {
  it("trả vị trí mới theo thứ tự gửi lên", () => {
    expect(buildQuestionOrder(["q1", "q2", "q3"], ["q3", "q1", "q2"])).toEqual([
      { id: "q3", position: 1 },
      { id: "q1", position: 2 },
      { id: "q2", position: 3 },
    ]);
  });

  it("chặn danh sách thiếu/thừa hoặc trùng câu hỏi", () => {
    expect(() => buildQuestionOrder(["q1", "q2"], ["q1"])).toThrowError(/không khớp/);
    expect(() => buildQuestionOrder(["q1", "q2"], ["q1", "q1"])).toThrowError(/không khớp/);
    expect(() => buildQuestionOrder(["q1", "q2"], ["q1", "q9"])).toThrowError(/không khớp/);
  });
});

describe("validateExamForPublish", () => {
  const exam = {
    title: "Đề kiểm tra 45 phút",
    durationMinutes: 45,
    scope: "CLASS" as const,
    classroomId: "class-a",
    instructionsDoc: null,
  };

  it("đề hợp lệ không có lỗi (chỉ có thể có cảnh báo)", () => {
    const issues = validateExamForPublish({
      exam,
      questions: [candidate()],
      knownAssetIds: new Set<string>(),
    });
    expect(issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
  });

  it("chặn loại câu chưa được làm bài/chấm điểm hỗ trợ", () => {
    expect(isSupportedQuestionType("TRUE_FALSE")).toBe(false);

    const issues = validateExamForPublish({
      exam,
      questions: [candidate({ type: "TRUE_FALSE" })],
      knownAssetIds: new Set<string>(),
    });
    const typeIssue = issues.find((issue) => issue.code === "QUESTION_TYPE_UNSUPPORTED");

    expect(typeIssue?.severity).toBe("error");
    expect(typeIssue?.questionId).toBe("question-1");
  });

  it("phát hiện công thức LaTeX lỗi bằng KaTeX (không dựa vào render không ném lỗi)", () => {
    const issues = validateExamForPublish({
      exam,
      questions: [
        candidate({
          contentDoc: normalizeRichDoc({
            doc: { type: "doc", content: [mathParagraph("\\frac{a}{")] },
          }),
        }),
      ],
      knownAssetIds: new Set<string>(),
    });

    const formulaIssue = issues.find((issue) => issue.code === "FORMULA_INVALID");
    expect(formulaIssue?.severity).toBe("error");
    expect(formulaIssue?.message).toMatch(/LaTeX không hợp lệ/);
  });

  it("chấp nhận công thức hợp lệ trong câu hỏi", () => {
    const issues = validateExamForPublish({
      exam,
      questions: [
        candidate({
          contentDoc: normalizeRichDoc({
            doc: { type: "doc", content: [mathParagraph("\\lim_{x \\to 0}\\frac{\\sin x}{x}")] },
          }),
        }),
      ],
      knownAssetIds: new Set<string>(),
    });

    expect(issues.some((issue) => issue.code === "FORMULA_INVALID")).toBe(false);
  });

  it("phát hiện ảnh chưa tải lên xong", () => {
    const issues = validateExamForPublish({
      exam,
      questions: [
        candidate({
          contentDoc: normalizeRichDoc({
            doc: {
              type: "doc",
              content: [{ type: "image", attrs: { assetId: "asset-missing", alt: "Hình" } }],
            },
          }),
        }),
      ],
      knownAssetIds: new Set(["asset-ok"]),
    });

    expect(issues.find((issue) => issue.code === "IMAGE_MISSING")?.severity).toBe("error");
  });

  it("chặn khi thiếu đáp án đúng, có nhiều đáp án đúng, hoặc thiếu phương án", () => {
    const noCorrect = validateExamForPublish({
      exam,
      questions: [
        candidate({
          options: [
            { id: "a", label: "A", content: "A", contentDoc: null, isCorrect: false },
            { id: "b", label: "B", content: "B", contentDoc: null, isCorrect: false },
          ],
        }),
      ],
      knownAssetIds: new Set<string>(),
    });
    expect(
      noCorrect.find((issue) => issue.code === "QUESTION_CORRECT_ANSWER_INVALID"),
    ).toBeTruthy();

    const twoCorrect = validateExamForPublish({
      exam,
      questions: [
        candidate({
          options: [
            { id: "a", label: "A", content: "A", contentDoc: null, isCorrect: true },
            { id: "b", label: "B", content: "B", contentDoc: null, isCorrect: true },
          ],
        }),
      ],
      knownAssetIds: new Set<string>(),
    });
    expect(twoCorrect.some((issue) => issue.code === "QUESTION_CORRECT_ANSWER_INVALID")).toBe(true);

    const noOptions = validateExamForPublish({
      exam,
      questions: [candidate({ options: [] })],
      knownAssetIds: new Set<string>(),
    });
    expect(noOptions.some((issue) => issue.code === "QUESTION_OPTIONS_MISSING")).toBe(true);
  });

  it("chặn đề rỗng hoặc thiếu lớp khi là đề của lớp", () => {
    const empty = validateExamForPublish({
      exam,
      questions: [],
      knownAssetIds: new Set<string>(),
    });
    expect(empty.some((issue) => issue.code === "EXAM_EMPTY")).toBe(true);

    const noClassroom = validateExamForPublish({
      exam: { ...exam, classroomId: null },
      questions: [candidate()],
      knownAssetIds: new Set<string>(),
    });
    expect(noClassroom.some((issue) => issue.code === "EXAM_CLASSROOM_REQUIRED")).toBe(true);
  });

  it("thiếu lời giải chỉ là cảnh báo, không chặn xuất bản", () => {
    const issues = validateExamForPublish({
      exam,
      questions: [candidate({ explanation: null, explanationDoc: null })],
      knownAssetIds: new Set<string>(),
    });

    expect(issues.find((issue) => issue.code === "QUESTION_EXPLANATION_MISSING")?.severity).toBe(
      "warning",
    );
    expect(() => assertExamPublishable(issues)).not.toThrow();
  });

  it("assertExamPublishable ném lỗi kèm danh sách lỗi", () => {
    const issues = validateExamForPublish({
      exam,
      questions: [],
      knownAssetIds: new Set<string>(),
    });

    expect(() => assertExamPublishable(issues)).toThrowError(/lỗi cần sửa/);
  });
});

describe("buildDuplicatedQuestion", () => {
  it("giữ nội dung và ánh xạ đáp án đúng sang bản sao không có ID", () => {
    const source = {
      type: "SINGLE_CHOICE" as const,
      level: "EASY" as const,
      content: "Câu hỏi gốc",
      contentDoc: normalizeRichDoc({ doc: { type: "doc", content: [paragraph("Câu hỏi gốc")] } }),
      explanation: "Lời giải gốc",
      explanationDoc: normalizeRichDoc({ doc: { type: "doc", content: [paragraph("Lời giải")] } }),
      rule: null,
      options: [
        {
          label: "A",
          content: "Sai",
          contentDoc: normalizeRichDoc({ doc: { type: "doc", content: [paragraph("Sai")] } }),
          isCorrect: false,
          position: 1,
        },
        {
          label: "B",
          content: "Đúng",
          contentDoc: normalizeRichDoc({ doc: { type: "doc", content: [paragraph("Đúng")] } }),
          isCorrect: true,
          position: 2,
        },
      ],
    };

    const copy = buildDuplicatedQuestion(source);

    // Nhãn được sinh lại theo thứ tự hiển thị, còn nội dung đáp án đúng không đổi.
    expect(copy.options.map((option) => option.label)).toEqual(["A", "B"]);
    expect(copy.options.map((option) => option.isCorrect)).toEqual([false, true]);
    expect(copy.options.find((option) => option.isCorrect)?.content).toBe("Đúng");
    // Bản sao là dữ liệu độc lập: sửa bản sao không ảnh hưởng câu gốc.
    copy.contentDoc.doc.content[0] = { type: "paragraph" };
    expect(source.contentDoc.doc.content[0].type).toBe("paragraph");
    expect(copy.explanation).toBe("Lời giải gốc");
  });
});

describe("toStudentQuestionPayload", () => {
  it("không chứa đáp án đúng, lời giải hay quy tắc chấm điểm", () => {
    const payload = toStudentQuestionPayload(candidate(), 3);

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("isCorrect");
    expect(serialized).not.toContain("Lời giải");
    expect(payload.position).toBe(3);
    expect(payload.options.map((option) => option.order)).toEqual([1, 2]);
    expect(Object.keys(payload.options[0]).sort()).toEqual([
      "content",
      "contentDoc",
      "id",
      "label",
      "order",
    ]);
  });
});
