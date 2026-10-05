import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";

import {
  assertCanModerateUser,
  normalizeBanReason,
  normalizeReviewNote,
  toAdminTeacherApplicationDto,
  toAdminUserSummaryDto,
  type AdminActorRef,
  type AdminTeacherApplicationRow,
  type AdminUserRow,
} from "@/features/admin/services/admin-core";

const ADMIN_ACTOR: AdminActorRef = { id: "user-admin", role: "ADMIN" };

/** Gọi hàm mong đợi sẽ ném `AppError` rồi trả lỗi đó ra để khẳng định mã và HTTP status. */
function captureAppError(run: () => void): AppError {
  try {
    run();
  } catch (error) {
    if (error instanceof AppError) {
      return error;
    }
    throw error;
  }

  throw new Error("Đáng lẽ phải ném AppError nhưng không có lỗi nào được ném.");
}

describe("assertCanModerateUser", () => {
  it("cho phép quản trị viên xử lý tài khoản học sinh và giáo viên", () => {
    expect(() =>
      assertCanModerateUser(ADMIN_ACTOR, { id: "user-student", name: "An", role: "STUDENT" }),
    ).not.toThrow();
    expect(() =>
      assertCanModerateUser(ADMIN_ACTOR, { id: "user-teacher", name: "Cường", role: "TEACHER" }),
    ).not.toThrow();
  });

  it("chặn quản trị viên tự khoá tài khoản của chính mình", () => {
    const error = captureAppError(() =>
      assertCanModerateUser(ADMIN_ACTOR, {
        id: "user-admin",
        name: "Quản trị viên",
        role: "ADMIN",
      }),
    );

    expect(error.code).toBe("USER_ACTION_NOT_ALLOWED");
    expect(error.status).toBe(409);
    expect(error.message).toContain("chính mình");
  });

  it("chặn thay đổi trạng thái khoá của một quản trị viên khác", () => {
    const error = captureAppError(() =>
      assertCanModerateUser(ADMIN_ACTOR, {
        id: "user-admin-2",
        name: "Quản trị 2",
        role: "ADMIN",
      }),
    );

    expect(error.code).toBe("USER_ACTION_NOT_ALLOWED");
    expect(error.status).toBe(409);
    expect(error.message).toContain("quản trị viên");
  });
});

describe("normalizeBanReason / normalizeReviewNote", () => {
  it("đưa chuỗi rỗng hoặc chỉ có khoảng trắng về null", () => {
    expect(normalizeBanReason(undefined)).toBeNull();
    expect(normalizeBanReason("")).toBeNull();
    expect(normalizeBanReason("   ")).toBeNull();
    expect(normalizeReviewNote(undefined)).toBeNull();
    expect(normalizeReviewNote("  ")).toBeNull();
  });

  it("cắt khoảng trắng thừa ở hai đầu", () => {
    expect(normalizeBanReason("  Gian lận  ")).toBe("Gian lận");
    expect(normalizeReviewNote("  Hồ sơ đầy đủ  ")).toBe("Hồ sơ đầy đủ");
  });
});

describe("toAdminUserSummaryDto", () => {
  it("chuyển ngày sang ISO và lấy số lượt làm bài / số đơn đang chờ từ _count", () => {
    const row: AdminUserRow = {
      id: "user-1",
      name: "Nguyễn Văn An",
      email: "an@luyenthi.vn",
      role: "STUDENT",
      banned: true,
      banReason: "Gian lận",
      bannedAt: new Date("2026-10-03T09:00:00.000Z"),
      createdAt: new Date("2026-10-02T08:00:00.000Z"),
      _count: { attempts: 2, teacherApplications: 1 },
    };

    expect(toAdminUserSummaryDto(row)).toEqual({
      id: "user-1",
      name: "Nguyễn Văn An",
      email: "an@luyenthi.vn",
      role: "STUDENT",
      banned: true,
      banReason: "Gian lận",
      bannedAt: "2026-10-03T09:00:00.000Z",
      createdAt: "2026-10-02T08:00:00.000Z",
      attemptCount: 2,
      pendingApplicationCount: 1,
    });
  });

  it("giữ null cho tài khoản chưa từng bị khoá", () => {
    const dto = toAdminUserSummaryDto({
      id: "user-2",
      name: "Trần Thị Bình",
      email: "binh@luyenthi.vn",
      role: "TEACHER",
      banned: false,
      banReason: null,
      bannedAt: null,
      createdAt: new Date("2026-09-20T08:00:00.000Z"),
      _count: { attempts: 0, teacherApplications: 0 },
    });

    expect(dto.bannedAt).toBeNull();
    expect(dto.banReason).toBeNull();
    expect(dto.attemptCount).toBe(0);
  });
});

describe("toAdminTeacherApplicationDto", () => {
  it("gộp tên môn và hồ sơ người nộp, không trả khoá kỹ thuật", () => {
    const row: AdminTeacherApplicationRow = {
      id: "application-1",
      status: "PENDING",
      school: "THPT Nguyễn Huệ",
      subjectId: "seed-subject-toan",
      subject: { name: "Toán" },
      experienceYears: 3,
      contactPhone: "0901234567",
      motivation: "Tôi muốn đóng góp đề thi.",
      reviewNote: null,
      reviewedAt: null,
      createdAt: new Date("2026-10-04T08:00:00.000Z"),
      updatedAt: new Date("2026-10-04T08:00:00.000Z"),
      user: { id: "user-1", name: "Nguyễn Văn An", email: "an@luyenthi.vn", role: "STUDENT" },
    };

    const dto = toAdminTeacherApplicationDto(row);

    expect(dto).toEqual({
      id: "application-1",
      status: "PENDING",
      school: "THPT Nguyễn Huệ",
      subjectId: "seed-subject-toan",
      subjectName: "Toán",
      experienceYears: 3,
      contactPhone: "0901234567",
      motivation: "Tôi muốn đóng góp đề thi.",
      reviewNote: null,
      reviewedAt: null,
      createdAt: "2026-10-04T08:00:00.000Z",
      updatedAt: "2026-10-04T08:00:00.000Z",
      applicant: {
        id: "user-1",
        name: "Nguyễn Văn An",
        email: "an@luyenthi.vn",
        role: "STUDENT",
      },
    });
    expect(Object.keys(dto)).not.toContain("pendingKey");
  });

  it("trả null khi đơn không gắn môn học hoặc thiếu trường tuỳ chọn", () => {
    const dto = toAdminTeacherApplicationDto({
      id: "application-2",
      status: "REJECTED",
      school: null,
      subjectId: null,
      subject: null,
      experienceYears: null,
      contactPhone: null,
      motivation: "Em muốn thử sức.",
      reviewNote: "Chưa đủ thông tin xác minh.",
      reviewedAt: new Date("2026-10-01T08:00:00.000Z"),
      createdAt: new Date("2026-09-30T08:00:00.000Z"),
      updatedAt: new Date("2026-10-01T08:00:00.000Z"),
      user: { id: "user-2", name: "Trần Thị Bình", email: "binh@luyenthi.vn", role: "STUDENT" },
    });

    expect(dto.subjectName).toBeNull();
    expect(dto.subjectId).toBeNull();
    expect(dto.school).toBeNull();
    expect(dto.reviewedAt).toBe("2026-10-01T08:00:00.000Z");
    expect(dto.reviewNote).toBe("Chưa đủ thông tin xác minh.");
  });
});
