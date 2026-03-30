import { buildAgeRangeValidationMessage } from '../../utils/ageValidation';

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_DATE_REGEX = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/;

export const AGE_RANGE_ERROR_MESSAGE = buildAgeRangeValidationMessage();

const isValidIsoDate = (value: string): boolean => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return false;
  }

  const matched = normalized.match(ISO_DATE_REGEX);
  if (!matched) {
    return false;
  }

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (!Number.isFinite(year) || year < 1900 || year > 9999) {
    return false;
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return false;
  }
  if (!Number.isFinite(day) || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
};

export const normalizeDateInputToIso = (value: string): string | null => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }

  const isoPrefixMatched = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefixMatched && isValidIsoDate(isoPrefixMatched[1])) {
    return isoPrefixMatched[1];
  }

  if (isValidIsoDate(normalized)) {
    return normalized;
  }

  const dmyMatched = normalized.match(DMY_DATE_REGEX);
  if (!dmyMatched) {
    return null;
  }

  const day = Number(dmyMatched[1]);
  const month = Number(dmyMatched[2]);
  const year = Number(dmyMatched[3]);
  const isoValue = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return isValidIsoDate(isoValue) ? isoValue : null;
};
