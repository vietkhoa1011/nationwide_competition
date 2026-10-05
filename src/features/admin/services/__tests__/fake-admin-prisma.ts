/**
 * Prisma giả lập trong bộ nhớ cho các bài kiểm thử service của khu vực quản trị.
 *
 * Chỉ hỗ trợ đúng những truy vấn mà `admin-service.ts` sử dụng (`user`, `session`,
 * `teacherApplication`, `$transaction`) nhưng giữ nguyên các điểm cốt lõi cần kiểm
 * chứng: `updateMany` trả `count` để mô phỏng kiểm tra lạc quan, và vai trò người
 * dùng được đọc lại SAU khi cập nhật trong cùng transaction.
 */
import type { TeacherApplicationStatus, UserRole } from "@/generated/prisma/enums";

import type {
  AdminTeacherApplicationRow,
  AdminUserRow,
} from "@/features/admin/services/admin-core";

export interface FakeUserStoreRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  banned: boolean;
  banReason: string | null;
  bannedAt: Date | null;
  createdAt: Date;
  /** Tổng số lượt làm bài (không thay đổi trong các bài kiểm thử này). */
  attempts: number;
  /** Số đơn xin quyền giáo viên ĐANG CHỜ của tài khoản. */
  pendingApplications: number;
}

export interface FakeApplicationStoreRow {
  id: string;
  userId: string;
  status: TeacherApplicationStatus;
  school: string | null;
  subjectId: string | null;
  subjectName: string | null;
  experienceYears: number | null;
  contactPhone: string | null;
  motivation: string;
  reviewNote: string | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Khoá chống nộp trùng; NULL khi đơn không còn ở trạng thái PENDING. */
  pendingKey: string | null;
}

export interface FakeSessionStoreRow {
  id: string;
  userId: string;
  token: string;
}

interface FakeUserWhere {
  role?: UserRole;
  banned?: boolean;
  OR?: Array<{
    name?: { contains: string; mode?: string };
    email?: { contains: string; mode?: string };
  }>;
}

interface FakeUserUpdateData {
  role?: UserRole;
  banned?: boolean;
  banReason?: string | null;
  bannedAt?: Date | null;
}

interface FakeUserSelect {
  _count?: unknown;
}

interface FakeApplicationUpdateData {
  status?: TeacherApplicationStatus;
  reviewNote?: string | null;
  reviewedById?: string | null;
  reviewedAt?: Date | null;
  pendingKey?: string | null;
}

interface OrderByClause {
  [field: string]: "asc" | "desc";
}

function matchesContains(actual: string, filter: { contains: string; mode?: string }): boolean {
  const needle = filter.contains.toLowerCase();
  return filter.mode === "insensitive"
    ? actual.toLowerCase().includes(needle)
    : actual.includes(filter.contains);
}

/** Bộ lọc của `listAdminUsers`: vai trò, trạng thái khoá và tìm theo tên/email. */
function matchesUserWhere(row: FakeUserStoreRow, where?: FakeUserWhere): boolean {
  if (!where) {
    return true;
  }
  if (where.role !== undefined && row.role !== where.role) {
    return false;
  }
  if (where.banned !== undefined && row.banned !== where.banned) {
    return false;
  }
  if (where.OR && where.OR.length > 0) {
    const matched = where.OR.some((clause) => {
      const byName = clause.name ? matchesContains(row.name, clause.name) : false;
      const byEmail = clause.email ? matchesContains(row.email, clause.email) : false;
      return byName || byEmail;
    });

    if (!matched) {
      return false;
    }
  }

  return true;
}

/**
 * Sắp xếp theo mệnh đề đầu tiên rồi tới `id` — đúng cách service dùng trong
 * `orderBy: [{ createdAt: ... }, { id: "asc" }]`.
 */
function sortRows<T extends { id: string; createdAt: Date }>(
  rows: T[],
  orderBy?: OrderByClause[],
): T[] {
  const clauses = orderBy ?? [];
  const sorted = [...rows];

  sorted.sort((left, right) => {
    for (const clause of clauses) {
      for (const [field, direction] of Object.entries(clause)) {
        const factor = direction === "desc" ? -1 : 1;

        if (field === "createdAt") {
          const diff = left.createdAt.getTime() - right.createdAt.getTime();
          if (diff !== 0) {
            return diff * factor;
          }
        } else if (field === "id") {
          if (left.id !== right.id) {
            return left.id.localeCompare(right.id) * factor;
          }
        }
      }
    }

    return 0;
  });

  return sorted;
}

export interface FakeAdminState {
  users: FakeUserStoreRow[];
  applications: FakeApplicationStoreRow[];
  sessions: FakeSessionStoreRow[];
}

function isoDate(value: string): Date {
  return new Date(value);
}

/** Dữ liệu mẫu cho mọi bài kiểm thử: 4 tài khoản (1 ADMIN, 1 TEACHER, 2 STUDENT) và 3 đơn. */
export function createFakeAdminFixtures(): FakeAdminState {
  return {
    users: [
      {
        id: "user-admin",
        name: "Quản trị viên",
        email: "admin@luyenthi.vn",
        role: "ADMIN",
        banned: false,
        banReason: null,
        bannedAt: null,
        createdAt: isoDate("2026-09-01T07:00:00.000Z"),
        attempts: 0,
        pendingApplications: 0,
      },
      {
        id: "user-student-1",
        name: "Nguyễn Văn An",
        email: "an@luyenthi.vn",
        role: "STUDENT",
        banned: false,
        banReason: null,
        bannedAt: null,
        createdAt: isoDate("2026-10-02T08:00:00.000Z"),
        attempts: 2,
        pendingApplications: 1,
      },
      {
        id: "user-student-2",
        name: "Trần Thị Bình",
        email: "binh@luyenthi.vn",
        role: "STUDENT",
        banned: true,
        banReason: "Gian lận trong phòng thi",
        bannedAt: isoDate("2026-10-03T09:00:00.000Z"),
        createdAt: isoDate("2026-09-20T08:00:00.000Z"),
        attempts: 1,
        pendingApplications: 0,
      },
      {
        id: "user-teacher",
        name: "Lê Văn Cường",
        email: "cuong@luyenthi.vn",
        role: "TEACHER",
        banned: false,
        banReason: null,
        bannedAt: null,
        createdAt: isoDate("2026-09-15T08:00:00.000Z"),
        attempts: 0,
        pendingApplications: 0,
      },
    ],
    applications: [
      {
        id: "application-pending",
        userId: "user-student-1",
        status: "PENDING",
        school: "THPT Nguyễn Huệ",
        subjectId: "seed-subject-toan",
        subjectName: "Toán",
        experienceYears: 3,
        contactPhone: "0901234567",
        motivation: "Tôi muốn đóng góp đề thi cho học sinh khối 12.",
        reviewNote: null,
        reviewedById: null,
        reviewedAt: null,
        createdAt: isoDate("2026-10-04T08:00:00.000Z"),
        updatedAt: isoDate("2026-10-04T08:00:00.000Z"),
        pendingKey: "user-student-1",
      },
      {
        id: "application-approved",
        userId: "user-teacher",
        status: "APPROVED",
        school: "THPT Lê Quý Đôn",
        subjectId: "seed-subject-vat-li",
        subjectName: "Vật lí",
        experienceYears: 8,
        contactPhone: "0907654321",
        motivation: "Đã dạy Vật lí 8 năm.",
        reviewNote: "Hồ sơ đầy đủ.",
        reviewedById: "user-admin",
        reviewedAt: isoDate("2026-09-18T08:00:00.000Z"),
        createdAt: isoDate("2026-09-16T08:00:00.000Z"),
        updatedAt: isoDate("2026-09-18T08:00:00.000Z"),
        pendingKey: null,
      },
      {
        id: "application-rejected",
        userId: "user-student-2",
        status: "REJECTED",
        school: null,
        subjectId: null,
        subjectName: null,
        experienceYears: null,
        contactPhone: null,
        motivation: "Em muốn thử sức.",
        reviewNote: "Chưa đủ thông tin xác minh.",
        reviewedById: "user-admin",
        reviewedAt: isoDate("2026-10-01T08:00:00.000Z"),
        createdAt: isoDate("2026-09-30T08:00:00.000Z"),
        updatedAt: isoDate("2026-10-01T08:00:00.000Z"),
        pendingKey: null,
      },
    ],
    sessions: [
      { id: "session-admin", userId: "user-admin", token: "token-admin" },
      { id: "session-student-1", userId: "user-student-1", token: "token-student-1" },
      { id: "session-student-2", userId: "user-student-2", token: "token-student-2" },
    ],
  };
}

function toUserSummaryRow(row: FakeUserStoreRow): AdminUserRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    banned: row.banned,
    banReason: row.banReason,
    bannedAt: row.bannedAt,
    createdAt: row.createdAt,
    _count: { attempts: row.attempts, teacherApplications: row.pendingApplications },
  };
}

function toApplicationRow(
  row: FakeApplicationStoreRow,
  users: FakeUserStoreRow[],
): AdminTeacherApplicationRow {
  const applicant = users.find((user) => user.id === row.userId);

  if (!applicant) {
    throw new Error(`Fake prisma: không tìm thấy người nộp đơn ${row.userId}.`);
  }

  return {
    id: row.id,
    status: row.status,
    school: row.school,
    subjectId: row.subjectId,
    subject: row.subjectName ? { name: row.subjectName } : null,
    experienceYears: row.experienceYears,
    contactPhone: row.contactPhone,
    motivation: row.motivation,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    user: {
      id: applicant.id,
      name: applicant.name,
      email: applicant.email,
      role: applicant.role,
    },
  };
}

export interface FakeAdminPrisma {
  prisma: unknown;
  state: FakeAdminState;
}

/**
 * `$transaction` của bộ giả chạy callback ngay trên cùng đối tượng nên thay đổi bên trong
 * transaction vẫn quan sát được qua `state` (dùng để khẳng định "khoá tài khoản thì xoá phiên").
 */
export function createFakeAdminPrisma(overrides: Partial<FakeAdminState> = {}): FakeAdminPrisma {
  const state: FakeAdminState = { ...createFakeAdminFixtures(), ...overrides };

  const prisma = {
    user: {
      count: async ({ where }: { where?: FakeUserWhere } = {}) =>
        state.users.filter((row) => matchesUserWhere(row, where)).length,
      findUnique: async ({ where }: { where: { id?: string; email?: string } }) => {
        const row = state.users.find((item) => item.id === where.id || item.email === where.email);

        if (!row) {
          return null;
        }

        return {
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.role,
          banned: row.banned,
          banReason: row.banReason,
          bannedAt: row.bannedAt,
          createdAt: row.createdAt,
        };
      },
      findMany: async (
        {
          where,
          orderBy,
          skip,
          take,
        }: {
          where?: FakeUserWhere;
          orderBy?: OrderByClause[];
          skip?: number;
          take?: number;
        } = {},
      ) => {
        const rows = sortRows(
          state.users.filter((row) => matchesUserWhere(row, where)),
          orderBy,
        );
        const start = skip ?? 0;
        const end = take === undefined ? undefined : start + take;

        return rows.slice(start, end).map(toUserSummaryRow);
      },
      update: async ({
        where,
        data,
        select,
      }: {
        where: { id: string };
        data: FakeUserUpdateData;
        select?: FakeUserSelect;
      }) => {
        const row = state.users.find((item) => item.id === where.id);

        if (!row) {
          throw new Error(`Fake prisma: không tìm thấy tài khoản ${where.id}.`);
        }

        Object.assign(row, data);

        return select?._count ? toUserSummaryRow(row) : { ...row };
      },
    },
    session: {
      deleteMany: async ({ where }: { where?: { userId?: string } } = {}) => {
        const before = state.sessions.length;
        const remaining = state.sessions.filter((session) => session.userId !== where?.userId);
        state.sessions.length = 0;
        state.sessions.push(...remaining);

        return { count: before - remaining.length };
      },
    },
    teacherApplication: {
      count: async ({ where }: { where?: { status?: TeacherApplicationStatus } } = {}) =>
        state.applications.filter(
          (row) => where?.status === undefined || row.status === where.status,
        ).length,
      findMany: async (
        {
          where,
          orderBy,
          skip,
          take,
        }: {
          where?: { status?: TeacherApplicationStatus };
          orderBy?: OrderByClause[];
          skip?: number;
          take?: number;
        } = {},
      ) => {
        const rows = sortRows(
          state.applications.filter(
            (row) => where?.status === undefined || row.status === where.status,
          ),
          orderBy,
        );
        const start = skip ?? 0;
        const end = take === undefined ? undefined : start + take;

        return rows.slice(start, end).map((row) => toApplicationRow(row, state.users));
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = state.applications.find((item) => item.id === where.id);

        if (!row) {
          return null;
        }

        return { id: row.id, status: row.status, userId: row.userId, pendingKey: row.pendingKey };
      },
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const row = state.applications.find((item) => item.id === where.id);

        if (!row) {
          throw new Error(`Fake prisma: không tìm thấy đơn ${where.id}.`);
        }

        return toApplicationRow(row, state.users);
      },
      /**
       * Trả `count` giống Prisma: 0 nghĩa là đơn không còn PENDING (đã bị xử lý ở nơi khác).
       */
      updateMany: async ({
        where,
        data,
      }: {
        where: { id?: string; status?: TeacherApplicationStatus };
        data: FakeApplicationUpdateData;
      }) => {
        const targets = state.applications.filter(
          (row) =>
            (where.id === undefined || row.id === where.id) &&
            (where.status === undefined || row.status === where.status),
        );

        for (const row of targets) {
          Object.assign(row, data, { updatedAt: new Date() });
        }

        return { count: targets.length };
      },
    },
    $transaction: async (input: unknown) => {
      if (typeof input === "function") {
        return (input as (client: unknown) => Promise<unknown>)(prisma);
      }

      return Promise.all(input as Array<Promise<unknown>>);
    },
  };

  return { prisma, state };
}
