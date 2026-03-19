const SQL_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/;

const pad2 = (value: number): string => String(value).padStart(2, '0');

/**
 * Parse chuỗi datetime từ MySQL (lưu UTC, format "YYYY-MM-DD HH:mm:ss")
 * thành đối tượng Date JavaScript (đúng UTC).
 *
 * Lý do không dùng new Date(year, month-1, day, h, m, s):
 *   → Constructor đó tạo Date theo local timezone của browser,
 *     dẫn đến sai lệch ±7h với máy chủ UTC khi browser ở Asia/Ho_Chi_Minh.
 *
 * Giải pháp: append 'Z' để browser hiểu đây là UTC, rồi JS tự chuyển sang local khi render.
 */
const parseSqlDateTime = (value: string): Date | null => {
  if (!SQL_DATETIME_REGEX.test(value)) {
    return null;
  }

  // Chuẩn hóa: "YYYY-MM-DD HH:mm:ss" → "YYYY-MM-DDTHH:mm:ssZ" (ISO 8601 UTC)
  const iso = value.slice(0, 19).replace(' ', 'T') + 'Z';
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

export const formatDateDdMmYyyy = (value?: string | null): string => {
  if (!value) {
    return '--';
  }

  const parsed = parseSqlDateTime(value) || new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return `${pad2(parsed.getDate())}/${pad2(parsed.getMonth() + 1)}/${parsed.getFullYear()}`;
};

export const formatDateTimeDdMmYyyy = (value?: string | null): string => {
  if (!value) {
    return '--';
  }

  const parsed = parseSqlDateTime(value) || new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return `${pad2(parsed.getDate())}/${pad2(parsed.getMonth() + 1)}/${parsed.getFullYear()} ${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
};
