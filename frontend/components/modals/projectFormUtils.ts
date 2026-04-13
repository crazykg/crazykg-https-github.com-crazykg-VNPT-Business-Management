import type { InvestmentMode, PaymentCycle } from '../../types';
import { formatDateDdMmYyyy } from '../../utils/dateDisplay';

export const DATE_INPUT_MIN = '1900-01-01';
export const DATE_INPUT_MAX = '9999-12-31';
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_DATE_REGEX = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/;

const isValidIsoDate = (value: string): boolean => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;

  const matched = normalized.match(ISO_DATE_REGEX);
  if (!matched) return false;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (!Number.isFinite(year) || year < 1900 || year > 9999) return false;
  if (!Number.isFinite(month) || month < 1 || month > 12) return false;
  if (!Number.isFinite(day) || day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
};

export const normalizeDateInputToIso = (value: string): string | null => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;

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

export const shiftIsoDateByDays = (value: string, days: number): string | null => {
  const isoValue = normalizeDateInputToIso(value);
  if (!isoValue) {
    return null;
  }

  const [yearText, monthText, dayText] = isoValue.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const nextDate = new Date(Date.UTC(year, month - 1, day + days));
  const nextYear = nextDate.getUTCFullYear();
  const nextMonth = String(nextDate.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(nextDate.getUTCDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
};

export const normalizeProjectPaymentCycle = (value: unknown): PaymentCycle | null => {
  const token = String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();

  if (!token) {
    return null;
  }

  if (token === 'ONCE' || token === '1LAN' || token === 'MOTLAN') {
    return 'ONCE';
  }

  if (token === 'MONTHLY' || token === 'HANGTHANG') {
    return 'MONTHLY';
  }

  if (token === 'QUARTERLY' || token === 'HANGQUY') {
    return 'QUARTERLY';
  }

  if (token === 'HALFYEARLY' || token === 'HALF_YEARLY' || token === '6THANG' || token === 'SAUTHANG') {
    return 'HALF_YEARLY';
  }

  if (token === 'YEARLY' || token === 'HANGNAM') {
    return 'YEARLY';
  }

  return null;
};

export const normalizeProjectInvestmentMode = (value: unknown): InvestmentMode | 'THUE_DICH_VU' | null => {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }

  const token = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');

  if (!token) {
    return null;
  }

  if (token === 'DAUTU') {
    return 'DAU_TU';
  }

  if (
    token === 'THUEDICHVUDACTHU'
    || token === 'THUEDICHVUCNTTDACTHU'
    || token === 'THUEDICHVU'
    || token === 'THUE'
  ) {
    return 'THUE_DICH_VU_DACTHU';
  }

  if (
    token === 'THUEDICHVUCOSAN'
    || token === 'THUEDICHVUCO SAN'
    || token === 'THUEDICHVUCNTTCOSAN'
  ) {
    return 'THUE_DICH_VU_COSAN';
  }

  return raw.toUpperCase() as InvestmentMode | 'THUE_DICH_VU';
};

export const requiresProjectPaymentCycle = (investmentMode: unknown): boolean => {
  const normalizedMode = normalizeProjectInvestmentMode(investmentMode);

  return normalizedMode === 'DAU_TU'
    || normalizedMode === 'THUE_DICH_VU_DACTHU'
    || normalizedMode === 'THUE_DICH_VU_COSAN';
};

export const PROJECT_FORM_SUBMIT_TIMEOUT_MS = 16000;
export const PROJECT_FORM_SUBMIT_TIMEOUT_MESSAGE =
  'Không thể cập nhật dự án (quá thời gian phản hồi). Vui lòng thử lại.';

export const withProjectFormSubmitTimeout = async <T,>(
  operation: Promise<T> | T
): Promise<T> => {
  return await new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new Error(PROJECT_FORM_SUBMIT_TIMEOUT_MESSAGE));
    }, PROJECT_FORM_SUBMIT_TIMEOUT_MS);

    Promise.resolve(operation).then(
      (value) => {
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
};

export const formatProjectAssignedDate = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return '';
  }

  const normalizedIso = normalizeDateInputToIso(raw);
  if (normalizedIso) {
    const formatted = formatDateDdMmYyyy(normalizedIso);
    return formatted === '--' ? raw : formatted;
  }

  const dmyMatched = raw.match(DMY_DATE_REGEX);
  if (!dmyMatched) {
    return raw;
  }

  return `${String(Number(dmyMatched[1])).padStart(2, '0')}/${String(Number(dmyMatched[2])).padStart(2, '0')}/${dmyMatched[3]}`;
};

export const formatNumber = (num: number | string | undefined | null): string => {
  if (num === undefined || num === null || num === '') return '';
  if (typeof num === 'string') return num;
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(num);
};

export const parseNumber = (str: string | number): number => {
  if (typeof str === 'number') return str;
  const normalized = str.replace(/\./g, '').replace(/,/g, '.');
  return parseFloat(normalized) || 0;
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

export const formatPercent = (value: number): string => {
  return `${new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;
};
