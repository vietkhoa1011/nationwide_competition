/**
 * Tạo (hoặc nâng quyền) một tài khoản quản trị viên.
 *
 * Chạy:
 *   npm run db:admin -- admin@luyenthi.vn MatKhau123 "Quản trị viên"
 *   npm run db:admin -- --email admin@luyenthi.vn --password MatKhau123 --name "Quản trị viên"
 *
 * Có thể bỏ qua tham số và dùng biến môi trường ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME.
 *
 * Vì sao cần script này: trường `role` được khai báo `input: false` trong Better Auth nên
 * KHÔNG ai có thể tự nâng quyền qua API. Quản trị viên đầu tiên vì vậy phải được tạo bằng
 * một tiến trình chạy trực tiếp trên máy chủ như script này.
 *
 * Script chạy lại nhiều lần vẫn an toàn:
 * - Email đã tồn tại: nâng vai trò lên ADMIN, mở khoá tài khoản và đăng xuất mọi phiên cũ.
 * - Email chưa tồn tại: tạo tài khoản mới kèm tài khoản đăng nhập email/mật khẩu.
 * - Nếu có truyền mật khẩu, mật khẩu đăng nhập cũng được đặt lại (dùng khi quên mật khẩu).
 */
import "dotenv/config";

import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { MIN_PASSWORD_LENGTH } from "../src/features/auth/schemas/auth.schemas";

/** Trùng với `providerId` mà Better Auth dùng cho đăng nhập email/mật khẩu. */
const CREDENTIAL_PROVIDER_ID = "credential";

const USAGE = `
Cách dùng:
  npm run db:admin -- <email> [mật-khẩu] [họ-tên]
  npm run db:admin -- --email <email> [--password <mật-khẩu>] [--name <họ-tên>]

Ví dụ:
  npm run db:admin -- admin@luyenthi.vn MatKhau123 "Quản trị viên"
  npm run db:admin -- --email admin@luyenthi.vn        # chỉ nâng quyền tài khoản đã có

Hoặc đặt biến môi trường: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME.
`.trim();

interface AdminInput {
  email: string;
  /** Bỏ trống nghĩa là giữ nguyên mật khẩu hiện có của tài khoản. */
  password: string | null;
  name: string;
}

/** Tên hiển thị mặc định lấy từ phần trước dấu @ của email. */
function defaultNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? email;
  const words = localPart
    .split(/[._-]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.length > 0 ? words.join(" ") : "Quản trị viên";
}

/**
 * Đọc tham số dòng lệnh. Hỗ trợ cả dạng `--key value` / `--key=value` và tham số
 * theo vị trí, đồng thời cho phép lấy giá trị thiếu từ biến môi trường.
 */
function parseArgs(argv: string[]): AdminInput {
  const flags = new Map<string, string>();
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const withoutDashes = arg.slice(2);
    const equalsIndex = withoutDashes.indexOf("=");

    if (equalsIndex >= 0) {
      flags.set(withoutDashes.slice(0, equalsIndex), withoutDashes.slice(equalsIndex + 1));
      continue;
    }

    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags.set(withoutDashes, next);
      index += 1;
    } else {
      flags.set(withoutDashes, "");
    }
  }

  const emailRaw = flags.get("email") || positional[0] || process.env.ADMIN_EMAIL || "";
  const passwordRaw =
    flags.get("password") ||
    positional[1] ||
    process.env.ADMIN_PASSWORD ||
    "";
  const nameRaw = flags.get("name") || positional[2] || process.env.ADMIN_NAME || "";

  const email = emailRaw.trim().toLowerCase();

  if (email === "") {
    throw new Error(`Thiếu email quản trị viên.\n\n${USAGE}`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`Email không hợp lệ: ${email}`);
  }

  const password = passwordRaw === "" ? null : passwordRaw;

  if (password !== null && password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
  }

  const name = nameRaw.trim() || defaultNameFromEmail(email);

  if (name.length < 2) {
    throw new Error("Họ tên phải có ít nhất 2 ký tự.");
  }

  return { email, password, name };
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error(
      "Thiếu DATABASE_URL. Hãy sao chép .env.example thành .env và cấu hình chuỗi kết nối PostgreSQL.",
    );
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Tạo mới hoặc đặt lại mật khẩu của tài khoản đăng nhập email (Better Auth). */
async function setCredentialPassword(
  tx: Prisma.TransactionClient,
  userId: string,
  password: string,
): Promise<void> {
  const passwordHash = await hashPassword(password);
  const existing = await tx.account.findUnique({
    where: {
      providerId_accountId: { providerId: CREDENTIAL_PROVIDER_ID, accountId: userId },
    },
    select: { id: true },
  });

  if (existing) {
    await tx.account.update({ where: { id: existing.id }, data: { password: passwordHash } });
    return;
  }

  await tx.account.create({
    data: {
      id: randomUUID(),
      userId,
      providerId: CREDENTIAL_PROVIDER_ID,
      accountId: userId,
      password: passwordHash,
    },
  });
}

interface AdminAccountResult {
  id: string;
  email: string;
  created: boolean;
}

async function upsertAdmin(
  prisma: PrismaClient,
  input: AdminInput,
): Promise<AdminAccountResult> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existing) {
    await prisma.$transaction(async (tx) => {
      // Mở khoá luôn: quản trị viên bị khoá trước đó cần vào được để gỡ tình trạng đó.
      await tx.user.update({
        where: { id: existing.id },
        data: { role: "ADMIN", banned: false, banReason: null, bannedAt: null },
      });

      /**
       * Xoá mọi phiên đang mở vì phiên cũ có thể được tạo khi tài khoản còn vai trò
       * thấp hơn; buộc đăng nhập lại để phiên mới mang đúng quyền ADMIN.
       */
      await tx.session.deleteMany({ where: { userId: existing.id } });

      if (input.password) {
        await setCredentialPassword(tx, existing.id, input.password);
      }
    });

    return { id: existing.id, email: input.email, created: false };
  }

  if (!input.password) {
    throw new Error(
      `Tài khoản ${input.email} chưa tồn tại nên cần mật khẩu. Hãy thêm tham số mật khẩu hoặc đặt ADMIN_PASSWORD.`,
    );
  }

  const password = input.password;
  const id = randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id,
        name: input.name,
        email: input.email,
        role: "ADMIN",
      },
    });
    await setCredentialPassword(tx, id, password);
  });

  return { id, email: input.email, created: true };
}

async function main(): Promise<void> {
  const input = parseArgs(process.argv.slice(2));
  const prisma = createPrismaClient();

  try {
    const result = await upsertAdmin(prisma, input);

    console.log("Đã thiết lập tài khoản quản trị viên:");
    console.log(`  - Email:   ${result.email}`);
    console.log(`  - Vai trò: ADMIN`);
    console.log(`  - Trạng thái: ${result.created ? "tạo mới" : "cập nhật tài khoản đã có"}`);
    console.log(`  - Mật khẩu: ${input.password ? "đã đặt theo tham số" : "giữ nguyên"}`);
    console.log("");
    console.log("Bước tiếp theo: đăng nhập tại /dang-nhap rồi mở /quan-tri để duyệt đơn và quản lý người dùng.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Không thiết lập được tài khoản quản trị viên:");
  console.error(message);
  process.exitCode = 1;
});
