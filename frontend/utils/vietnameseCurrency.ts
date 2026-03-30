export const parseVietnameseCurrencyInput = (value: string): number => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return 0;
  }

  const sanitized = normalized
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatVietnameseCurrencyInput = (value: unknown): string => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '';
  }

  const sign = numeric < 0 ? '-' : '';
  const absoluteText = Math.abs(numeric).toString();
  const [integerPart, decimalPartRaw] = absoluteText.split('.');
  const integerFormatted = Number(integerPart || '0').toLocaleString('vi-VN');
  const decimalPart = (decimalPartRaw || '').replace(/0+$/, '');

  if (!decimalPart) {
    return `${sign}${integerFormatted}`;
  }

  return `${sign}${integerFormatted},${decimalPart}`;
};

export const formatVietnameseCurrencyValue = (
  value: unknown,
  options?: { suffix?: boolean; fallback?: string }
): string => {
  const formatted = formatVietnameseCurrencyInput(value);
  if (!formatted) {
    return options?.fallback ?? '--';
  }

  if (options?.suffix === false) {
    return formatted;
  }

  return `${formatted} đ`;
};

export const formatSignedVietnameseCurrencyValue = (
  value: unknown,
  options?: { suffix?: boolean; fallback?: string }
): string => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return options?.fallback ?? '--';
  }

  const formatted = formatVietnameseCurrencyValue(Math.abs(numeric), options);
  if (numeric > 0) {
    return `+${formatted}`;
  }
  if (numeric < 0) {
    return `-${formatted}`;
  }
  return formatted;
};

export const formatVietnameseIntegerWithThousands = (digits: string): string => {
  const normalized = String(digits || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!normalized) {
    return '';
  }

  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const sanitizeVietnameseCurrencyDraft = (value: string): string => {
  const normalized = String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/\./g, '');
  if (!normalized) {
    return '';
  }

  const cleaned = normalized.replace(/[^0-9,]/g, '');
  const firstCommaIndex = cleaned.indexOf(',');
  const hasComma = firstCommaIndex >= 0;

  const integerRaw = hasComma ? cleaned.slice(0, firstCommaIndex) : cleaned;
  const decimalRaw = hasComma ? cleaned.slice(firstCommaIndex + 1).replace(/,/g, '') : '';
  const integerDigits = integerRaw.replace(/^0+(?=\d)/, '');
  const integerFormatted = formatVietnameseIntegerWithThousands(integerDigits);
  const decimalDigits = decimalRaw.slice(0, 2);

  if (!hasComma) {
    return integerFormatted;
  }

  const integerPart = integerFormatted || '0';
  return `${integerPart},${decimalDigits}`;
};
