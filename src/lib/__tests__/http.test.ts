import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { AppError } from "@/lib/errors";
import { handleRouteError } from "@/lib/http";

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

async function bodyOf(response: Response): Promise<ErrorBody> {
  return (await response.json()) as ErrorBody;
}

/**
 * Dựng lỗi giống thứ Prisma 7 + `@prisma/adapter-pg` ném ra.
 * `pg` trả mã gốc của nó (`ECONNREFUSED`, …) trong thuộc tính `code` của
 * `PrismaClientKnownRequestError`, không phải mã `P1xxx` như engine cũ.
 */
function prismaError(props: {
  name?: string;
  code?: string;
  cause?: unknown;
}): Error & { name: string; code?: string; cause?: unknown } {
  const error = new Error("Invalid `prisma.exam.count()` invocation:") as Error & {
    name: string;
    code?: string;
    cause?: unknown;
  };
  if (props.name) error.name = props.name;
  if (props.code) error.code = props.code;
  if (props.cause !== undefined) error.cause = props.cause;
  return error;
}

describe("handleRouteError", () => {
  it("giữ nguyên mã và trạng thái của AppError", async () => {
    const response = handleRouteError(new AppError("EXAM_NOT_FOUND", "Không tìm thấy đề thi.", 404));

    expect(response.status).toBe(404);
    expect((await bodyOf(response)).error).toEqual({
      code: "EXAM_NOT_FOUND",
      message: "Không tìm thấy đề thi.",
    });
  });

  it("chuyển ZodError thành 422 VALIDATION_ERROR kèm chi tiết", async () => {
    const zodError = new ZodError([
      { code: "custom", message: "Số trang không hợp lệ", path: ["page"] },
    ]);

    const response = handleRouteError(zodError);
    const body = await bodyOf(response);

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual([
      expect.objectContaining({ path: ["page"], message: "Số trang không hợp lệ" }),
    ]);
  });

  it("coi ECONNREFUSED của driver pg là DATABASE_UNAVAILABLE (503)", async () => {
    const response = handleRouteError(
      prismaError({ name: "PrismaClientKnownRequestError", code: "ECONNREFUSED" }),
    );
    const body = await bodyOf(response);

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("DATABASE_UNAVAILABLE");
    expect(body.error.message).toContain("PostgreSQL");
  });

  it("coi PrismaClientInitializationError là DATABASE_UNAVAILABLE (503)", async () => {
    const response = handleRouteError(
      prismaError({ name: "PrismaClientInitializationError", code: "P1001" }),
    );

    expect(response.status).toBe(503);
    expect((await bodyOf(response)).error.code).toBe("DATABASE_UNAVAILABLE");
  });

  it.each(["08006", "08001", "3D000", "28P01", "57P03", "ETIMEDOUT"])(
    "coi mã lỗi hạ tầng %s là DATABASE_UNAVAILABLE (503)",
    async (code) => {
      const response = handleRouteError(prismaError({ code }));

      expect(response.status).toBe(503);
      expect((await bodyOf(response)).error.code).toBe("DATABASE_UNAVAILABLE");
    },
  );

  it("đi theo `cause` lồng nhau để tìm mã lỗi kết nối", async () => {
    const response = handleRouteError(
      prismaError({
        name: "PrismaClientKnownRequestError",
        cause: prismaError({ code: "ECONNREFUSED" }),
      }),
    );

    expect(response.status).toBe(503);
    expect((await bodyOf(response)).error.code).toBe("DATABASE_UNAVAILABLE");
  });

  it("không coi lỗi ràng buộc dữ liệu (P2002) là lỗi kết nối", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = handleRouteError(prismaError({ code: "P2002" }));

    expect(response.status).toBe(500);
    expect((await bodyOf(response)).error.code).toBe("INTERNAL_ERROR");
    expect(spy).toHaveBeenCalled();
  });

  it("trả 500 INTERNAL_ERROR cho lỗi không xác định", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = handleRouteError("lỗi lạ");
    const body = await bodyOf(response);

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toContain("Vui lòng thử lại");
    expect(spy).toHaveBeenCalled();
  });
});
