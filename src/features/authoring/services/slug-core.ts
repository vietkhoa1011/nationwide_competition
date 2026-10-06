/**
 * Sinh `slug` cho đề thi do giáo viên/quản trị viên tạo. Hàm thuần, không phụ thuộc
 * database nên kiểm thử được trực tiếp.
 */
export function slugifyVietnamese(value: string): string {
  const withoutDiacritics = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");

  return withoutDiacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/**
 * `slug` của đề phải là duy nhất trong toàn hệ thống, nên luôn kèm hậu tố ngẫu nhiên
 * ngắn (không dựa vào việc đếm số bản ghi để tránh đua giữa hai người tạo cùng lúc).
 */
export function buildExamSlug(title: string, randomSuffix: string): string {
  const base = slugifyVietnamese(title) || "de-thi";
  const suffix = randomSuffix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  return suffix ? `${base}-${suffix}` : base;
}
