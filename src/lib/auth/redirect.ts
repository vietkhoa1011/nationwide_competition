/**
 * Chuẩn hoá tham số chuyển hướng sau khi đăng nhập.
 *
 * Chỉ chấp nhận đường dẫn nội bộ để tránh lỗi chuyển hướng mở (open redirect):
 * phải bắt đầu bằng "/" nhưng không phải "//" (URL tương đối theo giao thức, ví dụ
 * `//evil.example`) và không chứa dấu "\" (một số trình duyệt đổi "\" thành "/").
 */
export function resolveRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const path = value.trim();

  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return fallback;
  }

  return path;
}
