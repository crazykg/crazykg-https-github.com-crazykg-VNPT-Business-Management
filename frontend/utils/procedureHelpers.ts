const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

export function parseProcedureDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || !DATE_ONLY_PATTERN.test(dateStr)) return null;

  const [year, month, day] = dateStr.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime())
    || parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function formatProcedureDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatProcedureDatePlaceholder(): string {
  return 'dd/mm/yyyy';
}

function normalizeDuration(durationDays: number | null | undefined): number | null {
  const normalized = Number(durationDays);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

/**
 * Tính "Đến ngày" dựa vào "Từ ngày" + số ngày thực hiện.
 * Công thức: Đến ngày = Từ ngày + duration_days - 1
 */
export function computeEndDate(
  startDate: string | null | undefined,
  durationDays: number | null | undefined,
): string | null {
  const normalizedDuration = normalizeDuration(durationDays);
  if (!normalizedDuration) return null;

  const start = parseProcedureDate(startDate);
  if (!start) return null;

  const end = new Date(start);
  end.setDate(end.getDate() + normalizedDuration - 1);

  return formatProcedureDate(end);
}

/**
 * Tính "Từ ngày" dựa vào "Ngày" + "Đến ngày".
 * Công thức: Từ ngày = Đến ngày - duration_days + 1
 */
export function computeStartDate(
  endDate: string | null | undefined,
  durationDays: number | null | undefined,
): string | null {
  const normalizedDuration = normalizeDuration(durationDays);
  if (!normalizedDuration) return null;

  const end = parseProcedureDate(endDate);
  if (!end) return null;

  const start = new Date(end);
  start.setDate(start.getDate() - normalizedDuration + 1);

  return formatProcedureDate(start);
}

/**
 * Tính số ngày thực hiện khi đã có đủ "Từ ngày" và "Đến ngày".
 * Trả null nếu thiếu ngày, sai định dạng hoặc Đến ngày trước Từ ngày.
 */
export function computeDurationDays(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): number | null {
  const start = parseProcedureDate(startDate);
  const end = parseProcedureDate(endDate);
  if (!start || !end) return null;

  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  if (endUtc < startUtc) return null;

  return Math.round((endUtc - startUtc) / MS_PER_DAY) + 1;
}
