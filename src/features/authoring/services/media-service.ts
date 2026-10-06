import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Prisma } from "@/generated/prisma/client";
import {
  assertUploadAllowed,
  createStorageKey,
  detectImageMime,
  readImageDimensions,
  sanitizeAltText,
} from "@/features/authoring/services/media-core";
import { collectAssetIds, normalizeRichDoc } from "@/features/authoring/services/rich-content-core";
import type { ExamActor } from "@/features/authoring/services/exam-authoring-core";
import { canManageExam } from "@/features/authoring/services/exam-authoring-core";
import type { MediaAssetDto } from "@/features/authoring/types";
import { AppError } from "@/lib/errors";
import { getServerEnv } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";

/**
 * Lưu trữ ảnh cho nội dung đề thi.
 *
 * - Tệp nằm trên đĩa trong `MEDIA_STORAGE_DIR` (mặc định `storage/uploads`, KHÔNG nằm trong
 *   `public/`), database chỉ giữ metadata. Nội dung đề tham chiếu ảnh bằng `assetId` nên
 *   không bao giờ nhúng base64 vào câu hỏi.
 * - Loại tệp được xác định bằng chữ ký nhị phân thật, kích thước bị giới hạn, và SVG bị
 *   từ chối (xem `media-core`).
 * - Ảnh của đề lớp/kín chỉ đọc được qua `/api/media/[assetId]` sau khi máy chủ kiểm tra
 *   quyền — ẩn đường dẫn trên giao diện là chưa đủ.
 */

const assetSelect = {
  id: true,
  uploaderId: true,
  kind: true,
  mimeType: true,
  byteSize: true,
  width: true,
  height: true,
  alt: true,
  storageKey: true,
  examId: true,
  classroomId: true,
  createdAt: true,
} as const;

type AssetRow = Prisma.MediaAssetGetPayload<{ select: typeof assetSelect }>;

function storageRoot(): string {
  return path.resolve(process.cwd(), getServerEnv().MEDIA_STORAGE_DIR);
}

function storagePathFor(storageKey: string): string {
  // `storageKey` do máy chủ sinh (hex + phần mở rộng) nên không thể thoát khỏi thư mục.
  return path.join(storageRoot(), path.basename(storageKey));
}

export function toMediaAssetDto(row: AssetRow): MediaAssetDto {
  return {
    id: row.id,
    url: `/api/media/${row.id}`,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    width: row.width,
    height: row.height,
    alt: row.alt,
    examId: row.examId,
    createdAt: row.createdAt.toISOString(),
  };
}

async function assertUploadScope(
  actor: ExamActor,
  fields: { examId?: string; classroomId?: string },
): Promise<{ examId: string | null; classroomId: string | null }> {
  const prisma = getPrisma();

  if (fields.examId) {
    const exam = await prisma.exam.findUnique({
      where: { id: fields.examId },
      select: {
        scope: true,
        classroomId: true,
        createdById: true,
        classroom: { select: { ownerId: true } },
      },
    });

    if (!exam) {
      throw new AppError("EXAM_NOT_FOUND", "Không tìm thấy đề thi.", 404);
    }

    if (
      !canManageExam(actor, {
        scope: exam.scope,
        classroomId: exam.classroomId,
        createdById: exam.createdById,
        classroomOwnerId: exam.classroom?.ownerId ?? null,
      })
    ) {
      throw new AppError("FORBIDDEN", "Bạn không có quyền tải ảnh cho đề thi này.", 403);
    }
  }

  if (fields.classroomId) {
    const classroom = await prisma.classroom.findUnique({
      where: { id: fields.classroomId },
      select: { ownerId: true },
    });

    if (!classroom) {
      throw new AppError("CLASSROOM_NOT_FOUND", "Không tìm thấy lớp học.", 404);
    }
    if (actor.role !== "ADMIN" && classroom.ownerId !== actor.id) {
      throw new AppError("FORBIDDEN", "Bạn không có quyền tải ảnh cho lớp này.", 403);
    }
  }

  return { examId: fields.examId ?? null, classroomId: fields.classroomId ?? null };
}

/** Nhận tệp ảnh do giáo viên/quản trị viên tải lên và ghi xuống đĩa. */
export async function uploadExamImage(
  actor: ExamActor,
  file: File,
  fields: { examId?: string; classroomId?: string; alt?: string },
): Promise<MediaAssetDto> {
  if (actor.role === "STUDENT") {
    throw new AppError("FORBIDDEN", "Học sinh không có quyền tải ảnh lên.", 403);
  }

  const scope = await assertUploadScope(actor, fields);
  const { MEDIA_MAX_UPLOAD_BYTES } = getServerEnv();

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedMime = detectImageMime(bytes);
  const mime = assertUploadAllowed({
    byteSize: bytes.byteLength,
    detectedMime,
    maxBytes: MEDIA_MAX_UPLOAD_BYTES,
  });

  const dimensions = readImageDimensions(mime, bytes);
  const storageKey = createStorageKey(mime);

  await mkdir(storageRoot(), { recursive: true });
  await writeFile(storagePathFor(storageKey), bytes);

  const created = await getPrisma().mediaAsset.create({
    data: {
      uploaderId: actor.id,
      kind: "IMAGE",
      mimeType: mime,
      byteSize: bytes.byteLength,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      alt: sanitizeAltText(fields.alt),
      storageKey,
      examId: scope.examId,
      classroomId: scope.classroomId,
    },
    select: assetSelect,
  });

  return toMediaAssetDto(created);
}

async function loadAssetOrThrow(assetId: string): Promise<AssetRow> {
  const row = await getPrisma().mediaAsset.findUnique({
    where: { id: assetId },
    select: assetSelect,
  });

  if (!row) {
    throw new AppError("MEDIA_NOT_FOUND", "Không tìm thấy tệp media.", 404);
  }

  return row;
}

/**
 * Ai được đọc tệp ảnh: người tải lên, quản trị viên, thành viên lớp sở hữu đề (khi đề đã
 * xuất bản) và — với đề công khai đã xuất bản — mọi người dùng đã đăng nhập. Ảnh của đề
 * còn là nháp chỉ người soạn được xem.
 */
async function assertCanReadAsset(actor: ExamActor, asset: AssetRow): Promise<void> {
  if (actor.role === "ADMIN" || asset.uploaderId === actor.id) {
    return;
  }

  const prisma = getPrisma();

  if (asset.examId) {
    const exam = await prisma.exam.findUnique({
      where: { id: asset.examId },
      select: {
        status: true,
        scope: true,
        classroomId: true,
        createdById: true,
        classroom: { select: { ownerId: true } },
      },
    });

    if (!exam || exam.status !== "PUBLISHED") {
      throw new AppError("FORBIDDEN", "Bạn không có quyền xem ảnh này.", 403);
    }

    if (canManageExam(actor, {
      scope: exam.scope,
      classroomId: exam.classroomId,
      createdById: exam.createdById,
      classroomOwnerId: exam.classroom?.ownerId ?? null,
    })) {
      return;
    }

    if (exam.scope === "PUBLIC") {
      return;
    }

    if (exam.classroomId) {
      const membership = await prisma.classroomMember.findFirst({
        where: { classroomId: exam.classroomId, userId: actor.id },
        select: { id: true },
      });
      if (membership) {
        return;
      }
    }
  }

  if (asset.classroomId) {
    const membership = await prisma.classroomMember.findFirst({
      where: { classroomId: asset.classroomId, userId: actor.id },
      select: { id: true },
    });
    if (membership) {
      return;
    }
  }

  throw new AppError("FORBIDDEN", "Bạn không có quyền xem ảnh này.", 403);
}

export interface StoredAsset {
  bytes: Buffer;
  mimeType: string;
  byteSize: number;
  alt: string | null;
}

/** Đọc nội dung tệp ảnh sau khi đã kiểm tra quyền của người gọi. */
export async function readAssetBytes(actor: ExamActor, assetId: string): Promise<StoredAsset> {
  const asset = await loadAssetOrThrow(assetId);
  await assertCanReadAsset(actor, asset);

  try {
    const bytes = await readFile(storagePathFor(asset.storageKey));
    return { bytes, mimeType: asset.mimeType, byteSize: asset.byteSize, alt: asset.alt };
  } catch {
    throw new AppError(
      "MEDIA_NOT_FOUND",
      "Tệp ảnh không còn trên máy chủ. Hãy tải lại ảnh cho câu hỏi.",
      404,
    );
  }
}

/**
 * Kiểm tra ảnh có đang được dùng trong nội dung câu hỏi hay không. Xét đề chứa ảnh (nếu
 * có) và các đề nháp do người gọi tạo, nhờ vậy việc xoá ảnh khỏi một câu không làm hỏng
 * đề/phiên bản khác đang dùng cùng tệp.
 */
async function isAssetReferenced(asset: AssetRow, actor: ExamActor): Promise<boolean> {
  const prisma = getPrisma();

  const examIds = asset.examId
    ? [asset.examId]
    : (
        await prisma.exam.findMany({
          where: { createdById: actor.id, status: "DRAFT" },
          take: 50,
          select: { id: true },
        })
      ).map((exam) => exam.id);

  if (examIds.length === 0) {
    return false;
  }

  const rows = await prisma.examQuestion.findMany({
    where: { examId: { in: examIds } },
    select: {
      question: {
        select: {
          contentDoc: true,
          explanationDoc: true,
          options: { select: { contentDoc: true } },
        },
      },
    },
  });

  for (const row of rows) {
    const docs = [
      row.question.contentDoc,
      row.question.explanationDoc,
      ...row.question.options.map((option) => option.contentDoc),
    ];

    for (const doc of docs) {
      if (doc === null || doc === undefined) {
        continue;
      }
      if (collectAssetIds(normalizeRichDoc(doc)).includes(asset.id)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Xoá một ảnh khỏi kho. Chỉ người tải lên (hoặc quản trị viên) xoá được, và ảnh đang được
 * nội dung đề tham chiếu — hoặc thuộc đề đã xuất bản/lưu trữ — sẽ bị từ chối.
 */
export async function deleteAsset(
  actor: ExamActor,
  assetId: string,
): Promise<{ removedAssetId: string }> {
  const prisma = getPrisma();
  const asset = await loadAssetOrThrow(assetId);

  if (actor.role !== "ADMIN" && asset.uploaderId !== actor.id) {
    throw new AppError("FORBIDDEN", "Bạn không có quyền xoá ảnh này.", 403);
  }

  if (asset.examId) {
    const exam = await prisma.exam.findUnique({
      where: { id: asset.examId },
      select: { status: true },
    });
    if (exam && exam.status !== "DRAFT") {
      throw new AppError(
        "MEDIA_IN_USE",
        "Ảnh thuộc đề đã xuất bản/lưu trữ nên không thể xoá khỏi kho.",
        409,
      );
    }
  }

  if (await isAssetReferenced(asset, actor)) {
    throw new AppError(
      "MEDIA_IN_USE",
      "Ảnh đang được dùng trong nội dung đề. Hãy xoá ảnh khỏi câu hỏi trước.",
      409,
    );
  }

  await prisma.mediaAsset.delete({ where: { id: asset.id } });
  await unlink(storagePathFor(asset.storageKey)).catch(() => undefined);

  return { removedAssetId: asset.id };
}

