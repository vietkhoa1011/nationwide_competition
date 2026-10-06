import { randomBytes } from "node:crypto";

import { AppError } from "@/lib/errors";

/**
 * Kiểm tra tệp media thuần (không dùng Prisma/Next): nhận dạng loại ảnh theo chữ ký
 * nhị phân thực tế của tệp (magic bytes) chứ không tin `Content-Type` do client khai,
 * đọc kích thước ảnh và sinh tên tệp ngẫu nhiên để lưu trên đĩa.
 *
 * Bản đầu chỉ nhận ảnh raster; SVG bị từ chối vì nội dung SVG có thể chứa script.
 */

export const ALLOWED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const IMAGE_EXTENSIONS: Record<AllowedImageMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export const MAX_ALT_LENGTH = 200;

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) {
    return false;
  }
  return signature.every((value, index) => bytes[offset + index] === value);
}

function matchesAscii(bytes: Uint8Array, text: string, offset = 0): boolean {
  if (bytes.length < offset + text.length) {
    return false;
  }
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) {
      return false;
    }
  }
  return true;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Nhận dạng loại ảnh thật của tệp; trả `null` nếu không thuộc danh sách cho phép. */
export function detectImageMime(bytes: Uint8Array): AllowedImageMime | null {
  if (startsWith(bytes, PNG_SIGNATURE)) {
    return "image/png";
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (matchesAscii(bytes, "GIF87a") || matchesAscii(bytes, "GIF89a")) {
    return "image/gif";
  }
  if (matchesAscii(bytes, "RIFF") && matchesAscii(bytes, "WEBP", 8)) {
    return "image/webp";
  }
  return null;
}

export function formatMegabytes(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

/**
 * Kiểm tra kích thước và loại tệp trước khi ghi lên đĩa. Lỗi trả về là `AppError` với
 * mã ổn định để giao diện hiển thị đúng thông báo tiếng Việt.
 */
export function assertUploadAllowed(input: {
  byteSize: number;
  detectedMime: AllowedImageMime | null;
  maxBytes: number;
}): AllowedImageMime {
  if (input.byteSize <= 0) {
    throw new AppError("VALIDATION_ERROR", "Tệp tải lên đang rỗng.", 422);
  }
  if (input.byteSize > input.maxBytes) {
    throw new AppError(
      "MEDIA_TOO_LARGE",
      `Ảnh vượt quá giới hạn ${formatMegabytes(input.maxBytes)}.`,
      413,
    );
  }
  if (!input.detectedMime) {
    throw new AppError(
      "MEDIA_TYPE_UNSUPPORTED",
      "Chỉ hỗ trợ ảnh PNG, JPEG, GIF hoặc WEBP. (SVG không được chấp nhận vì lý do an toàn.)",
      415,
    );
  }
  return input.detectedMime;
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    // Các marker khởi tạo (SOF0…SOF15, trừ DHT/DNL) chứa kích thước ảnh.
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    const segmentLength = readUint16BE(bytes, offset + 2);
    if (isStartOfFrame) {
      return {
        height: readUint16BE(bytes, offset + 5),
        width: readUint16BE(bytes, offset + 7),
      };
    }
    if (segmentLength <= 0) {
      return null;
    }
    offset += 2 + segmentLength;
  }
  return null;
}

/** Đọc kích thước ảnh để giao diện đặt sẵn tỉ lệ khung (tránh nhảy bố cục). */
export function readImageDimensions(
  mime: AllowedImageMime,
  bytes: Uint8Array,
): { width: number; height: number } | null {
  try {
    if (mime === "image/png" && bytes.length >= 24) {
      return {
        width: readUint16BE(bytes, 16) * 65_536 + readUint16BE(bytes, 18),
        height: readUint16BE(bytes, 20) * 65_536 + readUint16BE(bytes, 22),
      };
    }
    if (mime === "image/gif" && bytes.length >= 10) {
      return { width: readUint16LE(bytes, 6), height: readUint16LE(bytes, 8) };
    }
    if (mime === "image/webp" && bytes.length >= 30) {
      const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
      if (chunk === "VP8X") {
        return { width: readUint24LE(bytes, 24) + 1, height: readUint24LE(bytes, 27) + 1 };
      }
      if (chunk === "VP8 ") {
        return {
          width: readUint16LE(bytes, 26) & 0x3fff,
          height: readUint16LE(bytes, 28) & 0x3fff,
        };
      }
      if (chunk === "VP8L" && bytes.length >= 25) {
        const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
    }
    if (mime === "image/jpeg") {
      return readJpegDimensions(bytes);
    }
  } catch {
    return null;
  }
  return null;
}

/** Bỏ ký tự điều khiển khỏi mô tả thay thế (alt) để tránh dữ liệu rác trong HTML. */
export function sanitizeAltText(alt: string | null | undefined): string | null {
  if (!alt) {
    return null;
  }
  const cleaned = alt
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, MAX_ALT_LENGTH) : null;
}

/** Tên tệp ngẫu nhiên trên đĩa — không dùng tên do người dùng gửi lên. */
export function createStorageKey(mime: AllowedImageMime): string {
  return `${randomBytes(16).toString("hex")}.${IMAGE_EXTENSIONS[mime]}`;
}
