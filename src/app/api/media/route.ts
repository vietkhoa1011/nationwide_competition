import type { NextResponse } from "next/server";

import { requireAuthoringActor } from "@/features/authoring/services/authoring-guard";
import { uploadExamImage } from "@/features/authoring/services/media-service";
import { mediaUploadFieldsSchema } from "@/features/classroom/schemas/classroom.schemas";
import { AppError } from "@/lib/errors";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Tải ảnh lên cho nội dung đề (multipart/form-data, trường `file`).
 *
 * Máy chủ tự kiểm tra quyền theo `examId`/`classroomId`, nhận dạng loại ảnh bằng chữ ký
 * nhị phân thật và giới hạn kích thước; tệp được ghi vào `MEDIA_STORAGE_DIR` (không nằm
 * trong `public/`) và chỉ đọc được qua `GET /api/media/[assetId]`.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireAuthoringActor();

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Yêu cầu tải ảnh phải gửi dạng multipart/form-data.",
        422,
      );
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("VALIDATION_ERROR", "Thiếu tệp ảnh cần tải lên.", 422);
    }

    const fields = mediaUploadFieldsSchema.parse({
      examId: formData.get("examId") ?? undefined,
      classroomId: formData.get("classroomId") ?? undefined,
      alt: formData.get("alt") ?? undefined,
    });

    const asset = await uploadExamImage(actor, file, fields);
    return jsonOk(asset, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
