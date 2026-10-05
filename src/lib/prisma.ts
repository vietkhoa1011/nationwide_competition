import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "@/lib/env";

/**
 * Prisma Client chỉ được dùng phía server (API routes / server services).
 * Khởi tạo theo kiểu lười (lazy) để việc import module không tạo kết nối
 * và không làm hỏng bước `next build`.
 */
const globalForPrisma = globalThis as unknown as {
  __luyenthiPrisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const { DATABASE_URL } = getServerEnv();
  const adapter = new PrismaPg({ connectionString: DATABASE_URL });
  return new PrismaClient({ adapter });
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.__luyenthiPrisma) {
    globalForPrisma.__luyenthiPrisma = createPrismaClient();
  }
  return globalForPrisma.__luyenthiPrisma;
}
