/**
 * Tính "Đến ngày" dựa vào "Từ ngày" + số ngày thực hiện.
 * Công thức: Đến ngày = Từ ngày + duration_days − 1
 *
 * - Tránh timezone-shift bằng cách parse local (thêm 'T00:00:00').
 * - Trả về null nếu bất kỳ tham số nào không hợp lệ.
 *
 * @param startDate    ISO date string "YYYY-MM-DD" (hoặc null/undefined)
 * @param durationDays Số ngày thực hiện (> 0 mới tính, ngược lại trả null)
 * @returns            ISO date string "YYYY-MM-DD" hoặc null
 */
export function computeEndDate(
  startDate: string | null | undefined,
  durationDays: number | null | undefined,
): string | null {
  if (!startDate || !durationDays || durationDays <= 0) return null;

  const start = new Date(startDate + 'T00:00:00');
  if (isNaN(start.getTime())) return null;

  const end = new Date(start);
  end.setDate(end.getDate() + durationDays - 1);

  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, '0');
  const d = String(end.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
