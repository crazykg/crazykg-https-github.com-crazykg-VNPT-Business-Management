const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export const MIN_ALLOWED_AGE_EXCLUSIVE = 20;
export const MAX_ALLOWED_AGE_EXCLUSIVE = 66;

const parseIsoDate = (isoDate: string): Date | null => {
  const normalized = String(isoDate || '').trim();
  if (!normalized) {
    return null;
  }

  const matched = normalized.match(ISO_DATE_REGEX);
  if (!matched) {
    return null;
  }

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

export const calculateAgeByDate = (isoDate: string, now: Date = new Date()): number | null => {
  const birthDate = parseIsoDate(isoDate);
  if (!birthDate) {
    return null;
  }

  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
};

export const isAgeInAllowedRange = (
  isoDate: string,
  now: Date = new Date(),
  minExclusive: number = MIN_ALLOWED_AGE_EXCLUSIVE,
  maxExclusive: number = MAX_ALLOWED_AGE_EXCLUSIVE
): boolean => {
  const age = calculateAgeByDate(isoDate, now);
  if (age === null) {
    return false;
  }

  return age > minExclusive && age < maxExclusive;
};

export const buildAgeRangeValidationMessage = (
  minExclusive: number = MIN_ALLOWED_AGE_EXCLUSIVE,
  maxExclusive: number = MAX_ALLOWED_AGE_EXCLUSIVE
): string => `Ngày sinh phải cho số tuổi > ${minExclusive} và < ${maxExclusive}.`;
