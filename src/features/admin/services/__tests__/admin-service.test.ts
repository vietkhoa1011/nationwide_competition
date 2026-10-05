import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createFakeAdminFixtures,
  createFakeAdminPrisma,
  type FakeAdminState,
} from "@/features/admin/services/__tests__/fake-admin-prisma";
import type { AdminActorRef } from "@/features/admin/services/admin-core";
import {
  listAdminTeacherApplications,
  listAdminUsers,
  reviewTeacherApplication,
  setUserBanState,
} from "@/features/admin/services/admin-service";

/**
 * Các bài kiểm thử này chạy trên Prisma giả trong bộ nhớ để kiểm chứng luật nghiệp vụ
 * của khu vực quản trị: lọc/phân trang, khoá tài khoản kèm xoá phiên, và duyệt đơn
 * theo kiểu kiểm tra lạc quan (không cần PostgreSQL).
 */
const ADMIN_ACTOR: AdminActorRef = { id: "user-admin", role: "ADMIN" };

const mocks = vi.hoisted(() => ({ prisma: undefined as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  getPrisma: () => mocks.prisma,
}));

let state: FakeAdminState;

beforeEach(() => {
  const fake = createFakeAdminPrisma();
  state = fake.state;
  mocks.prisma = fake.prisma;
});

describe("listAdminUsers", () => {
  it("trả về tất cả tài khoản, mới nhất lên đầu, kèm số liệu tổng hợp", async () => {
    const result = await listAdminUsers({ search: "", page: 1, pageSize: 20 });

    expect(result.total).toBe(4);
    expect(result.totalPages).toBe(1);
    expect(result.items.map((item) => item.id)).toEqual([
      "user-student-1",
      "user-student-2",
      "user-teacher",
      "user-admin",
    ]);
    expect(result.items[0]).toMatchObject({
      name: "Nguyễn Văn An",
      role: "STUDENT",
      banned: false,
      attemptCount: 2,
      pendingApplicationCount: 1,
    });
  });

  it("lọc theo vai trò và theo trạng thái khoá", async () => {
    const students = await listAdminUsers({ search: "", role: "STUDENT", page: 1, pageSize: 20 });
    expect(students.total).toBe(2);

    const banned = await listAdminUsers({ search: "", status: "banned", page: 1, pageSize: 20 });
    expect(banned.items).toHaveLength(1);
    expect(banned.items[0].id).toBe("user-student-2");
    expect(banned.items[0].banReason).toBe("Gian lận trong phòng thi");
    expect(banned.items[0].bannedAt).toBe("2026-10-03T09:00:00.000Z");

    const active = await listAdminUsers({ search: "", status: "active", page: 1, pageSize: 20 });
    expect(active.total).toBe(3);
  });

  it("tìm theo tên/email không phân biệt hoa thường", async () => {
    const byName = await listAdminUsers({ search: "NGUYỄN", page: 1, pageSize: 20 });
    expect(byName.items.map((item) => item.id)).toEqual(["user-student-1"]);

    const byEmail = await listAdminUsers({ search: "BINH@", page: 1, pageSize: 20 });
    expect(byEmail.items.map((item) => item.id)).toEqual(["user-student-2"]);

    const noMatch = await listAdminUsers({ search: "khong-ton-tai", page: 1, pageSize: 20 });
    expect(noMatch.items).toHaveLength(0);
    expect(noMatch.total).toBe(0);
    expect(noMatch.totalPages).toBe(0);
  });

  it("phân trang bằng skip/take và tính totalPages theo tổng số bản ghi", async () => {
    const pageTwo = await listAdminUsers({ search: "", page: 2, pageSize: 2 });

    expect(pageTwo.total).toBe(4);
    expect(pageTwo.totalPages).toBe(2);
    expect(pageTwo.page).toBe(2);
    expect(pageTwo.items.map((item) => item.id)).toEqual(["user-teacher", "user-admin"]);
  });
});

describe("setUserBanState", () => {
  it("khoá tài khoản, lưu lý do đã cắt khoảng trắng và đăng xuất mọi phiên", async () => {
    const result = await setUserBanState(ADMIN_ACTOR, "user-student-1", true, "  Spam đề thi  ");

    expect(result).toMatchObject({
      id: "user-student-1",
      banned: true,
      banReason: "Spam đề thi",
    });
    expect(result.bannedAt).not.toBeNull();
    expect(state.sessions.map((session) => session.id)).toEqual([
      "session-admin",
      "session-student-2",
    ]);
  });

  it("lý do khoá để trống thì lưu null", async () => {
    const result = await setUserBanState(ADMIN_ACTOR, "user-student-1", true, "   ");

    expect(result.banned).toBe(true);
    expect(result.banReason).toBeNull();
  });

  it("mở khoá thì xoá lý do và mốc thời gian, không đụng tới phiên đang mở", async () => {
    const result = await setUserBanState(ADMIN_ACTOR, "user-student-2", false);

    expect(result.banned).toBe(false);
    expect(result.banReason).toBeNull();
    expect(result.bannedAt).toBeNull();
    expect(state.sessions).toHaveLength(3);
  });

  it("chặn quản trị viên tự khoá chính mình", async () => {
    await expect(
      setUserBanState(ADMIN_ACTOR, "user-admin", true, "Tự khoá"),
    ).rejects.toMatchObject({ code: "USER_ACTION_NOT_ALLOWED", status: 409 });

    expect(state.users.find((user) => user.id === "user-admin")?.banned).toBe(false);
  });

  it("chặn khoá tài khoản của quản trị viên khác", async () => {
    const otherAdmin: AdminActorRef = { id: "user-admin-2", role: "ADMIN" };

    await expect(setUserBanState(otherAdmin, "user-admin", true)).rejects.toMatchObject({
      code: "USER_ACTION_NOT_ALLOWED",
      status: 409,
    });
  });

  it("báo 404 khi mã tài khoản không tồn tại", async () => {
    await expect(
      setUserBanState(ADMIN_ACTOR, "user-khong-ton-tai", true),
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND", status: 404 });
  });
});

describe("listAdminTeacherApplications", () => {
  it("mặc định là hàng đợi đơn đang chờ, cũ nhất lên đầu, kèm hồ sơ người nộp", async () => {
    const result = await listAdminTeacherApplications({ status: "PENDING", page: 1, pageSize: 20 });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: "application-pending",
      subjectName: "Toán",
      school: "THPT Nguyễn Huệ",
      reviewNote: null,
      applicant: { id: "user-student-1", role: "STUDENT" },
    });
    expect(result.items[0]).not.toHaveProperty("pendingKey");
  });

  it("xem được cả đơn đã duyệt và đã từ chối", async () => {
    const approved = await listAdminTeacherApplications({
      status: "APPROVED",
      page: 1,
      pageSize: 20,
    });
    expect(approved.items[0].applicant.role).toBe("TEACHER");
    expect(approved.items[0].reviewedAt).toBe("2026-09-18T08:00:00.000Z");

    const rejected = await listAdminTeacherApplications({
      status: "REJECTED",
      page: 1,
      pageSize: 20,
    });
    expect(rejected.items[0].reviewNote).toBe("Chưa đủ thông tin xác minh.");
    expect(rejected.items[0].subjectName).toBeNull();
  });

  it("phân trang hàng đợi theo thứ tự gửi đơn", async () => {
    const fixtures = createFakeAdminFixtures();
    const older = fixtures.applications[0];
    const newer = {
      ...older,
      id: "application-pending-2",
      createdAt: new Date("2026-10-05T08:00:00.000Z"),
      updatedAt: new Date("2026-10-05T08:00:00.000Z"),
    };
    const fake = createFakeAdminPrisma({ applications: [...fixtures.applications, newer] });
    mocks.prisma = fake.prisma;

    const firstPage = await listAdminTeacherApplications({ status: "PENDING", page: 1, pageSize: 1 });
    const secondPage = await listAdminTeacherApplications({
      status: "PENDING",
      page: 2,
      pageSize: 1,
    });

    expect(firstPage.total).toBe(2);
    expect(firstPage.totalPages).toBe(2);
    expect(firstPage.items.map((item) => item.id)).toEqual(["application-pending"]);
    expect(secondPage.items.map((item) => item.id)).toEqual(["application-pending-2"]);
  });
});

describe("reviewTeacherApplication", () => {
  it("duyệt đơn thì nâng vai trò tài khoản lên TEACHER và giải phóng khoá chống trùng", async () => {
    const result = await reviewTeacherApplication(
      ADMIN_ACTOR,
      "application-pending",
      "APPROVED",
      "  Hồ sơ đầy đủ.  ",
    );

    expect(result.status).toBe("APPROVED");
    expect(result.reviewNote).toBe("Hồ sơ đầy đủ.");
    expect(result.reviewedAt).not.toBeNull();
    expect(result.applicant.role).toBe("TEACHER");
    expect(state.users.find((user) => user.id === "user-student-1")?.role).toBe("TEACHER");

    const application = state.applications.find((item) => item.id === "application-pending");
    expect(application?.pendingKey).toBeNull();
    expect(application?.reviewedById).toBe("user-admin");
  });

  it("từ chối đơn thì giữ nguyên vai trò nhưng vẫn ghi nhận lý do", async () => {
    const result = await reviewTeacherApplication(
      ADMIN_ACTOR,
      "application-pending",
      "REJECTED",
      "Chưa xác minh được thông tin.",
    );

    expect(result.status).toBe("REJECTED");
    expect(result.reviewNote).toBe("Chưa xác minh được thông tin.");
    expect(result.applicant.role).toBe("STUDENT");
    expect(state.users.find((user) => user.id === "user-student-1")?.role).toBe("STUDENT");
    expect(state.applications.find((item) => item.id === "application-pending")?.pendingKey).toBeNull();
  });

  it("không xử lý lại đơn đã được duyệt hoặc từ chối", async () => {
    await expect(
      reviewTeacherApplication(ADMIN_ACTOR, "application-approved", "APPROVED"),
    ).rejects.toMatchObject({ code: "TEACHER_APPLICATION_ALREADY_REVIEWED", status: 409 });
  });

  it("huỷ giao dịch khi quản trị viên khác vừa xử lý xong (updateMany trả count 0)", async () => {
    const fake = createFakeAdminPrisma();
    const client = fake.prisma as {
      teacherApplication: { updateMany: () => Promise<{ count: number }> };
    };
    // Giả lập Prisma thật trả count = 0 khi đơn không còn ở trạng thái PENDING.
    client.teacherApplication.updateMany = async () => ({ count: 0 });
    mocks.prisma = fake.prisma;

    await expect(
      reviewTeacherApplication(ADMIN_ACTOR, "application-pending", "APPROVED"),
    ).rejects.toMatchObject({ code: "TEACHER_APPLICATION_ALREADY_REVIEWED", status: 409 });
  });

  it("báo 404 khi đơn không tồn tại", async () => {
    await expect(
      reviewTeacherApplication(ADMIN_ACTOR, "application-khong-ton-tai", "APPROVED"),
    ).rejects.toMatchObject({ code: "TEACHER_APPLICATION_NOT_FOUND", status: 404 });
  });
});
