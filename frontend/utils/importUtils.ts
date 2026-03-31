/**
 * Utility functions for data import normalization
 * 
 * This module contains functions for normalizing and validating imported data
 * from Excel/CSV files.
 */

import type { Employee, Product } from '../types';
import { DEFAULT_PRODUCT_SERVICE_GROUP, normalizeProductServiceGroup } from './productServiceGroup';
import { normalizeProductUnitForSave } from './productUnit';

/**
 * Normalize a string token for comparison during import
 * - Removes diacritics (Vietnamese accents)
 * - Converts to lowercase
 * - Replaces non-alphanumeric characters with empty string
 */
export const normalizeImportToken = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

/**
 * Normalize a date string to ISO format (YYYY-MM-DD)
 * Supports multiple formats:
 * - ISO: YYYY-MM-DD
 * - Vietnamese: DD/MM/YYYY or DD-MM-YYYY
 * - Excel numeric date
 */
export const normalizeImportDate = (value: string): string | null => {
  const text = String(value || '').trim();
  if (!text) return null;

  // Check ISO prefix (YYYY-MM-DD...)
  const isoPrefixMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoPrefixMatch) {
    const year = Number(isoPrefixMatch[1]);
    const month = Number(isoPrefixMatch[2]);
    const day = Number(isoPrefixMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() + 1 === month &&
      date.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Check exact ISO format
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() + 1 === month &&
      date.getUTCDate() === day
    ) {
      return text;
    }
    return null;
  }

  // Check DD/MM/YYYY or DD-MM-YYYY format
  const dmyMatch = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() + 1 === month &&
      date.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Check Excel numeric date
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 0) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + numeric * 86400000);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    if (year >= 1900 && year <= 9999) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
};

/**
 * Normalize a number string to numeric value
 * Supports:
 * - Currency symbols (₫, đ, vnđ, vnd)
 * - Thousand separators (comma or dot)
 * - Scientific notation
 */
export const normalizeImportNumber = (value: string): number | null => {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }

  const compact = text
    .replace(/\s+/g, '')
    .replace(/[₫đĐ]/g, '')
    .replace(/vnđ/gi, '')
    .replace(/vnd/gi, '');
  if (!compact) {
    return null;
  }

  const normalizeMantissa = (input: string): string | null => {
    let token = String(input || '').replace(/[^0-9.,+-]/g, '');
    if (!token) {
      return null;
    }

    const sign = token.startsWith('-') ? '-' : token.startsWith('+') ? '+' : '';
    token = token.replace(/[+-]/g, '');
    if (!token) {
      return null;
    }

    const dotCount = (token.match(/\./g) || []).length;
    const commaCount = (token.match(/,/g) || []).length;

    if (dotCount > 0 && commaCount > 0) {
      const lastDot = token.lastIndexOf('.');
      const lastComma = token.lastIndexOf(',');
      const decimalSeparator = lastDot > lastComma ? '.' : ',';
      const thousandSeparator = decimalSeparator === '.' ? ',' : '.';
      token = token.replace(new RegExp(`\\${thousandSeparator}`, 'g'), '');
      if (decimalSeparator === ',') {
        token = token.replace(/,/g, '.');
      }
    } else if (dotCount > 1) {
      token = token.replace(/\./g, '');
    } else if (commaCount > 1) {
      token = token.replace(/,/g, '');
    } else if (dotCount === 1) {
      const [integerPart = '', fractionPart = ''] = token.split('.');
      if (fractionPart.length === 3 && integerPart.length > 0) {
        token = `${integerPart}${fractionPart}`;
      }
    } else if (commaCount === 1) {
      const [integerPart = '', fractionPart = ''] = token.split(',');
      if (fractionPart.length === 3 && integerPart.length > 0) {
        token = `${integerPart}${fractionPart}`;
      } else {
        token = `${integerPart}.${fractionPart}`;
      }
    }

    if (!/^\d+(\.\d+)?$/.test(token)) {
      return null;
    }

    return `${sign}${token}`;
  };

  // Handle scientific notation
  const scientificMatch = compact.match(/^([+-]?[0-9.,]+)([eE][+-]?\d+)$/);
  if (scientificMatch) {
    const mantissa = normalizeMantissa(scientificMatch[1]);
    if (!mantissa) {
      return null;
    }
    const parsed = Number(`${mantissa}${scientificMatch[2]}`);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const normalizedValue = normalizeMantissa(compact);
  if (!normalizedValue) {
    return null;
  }

  const parsed = Number(normalizedValue);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Normalize status active field from import
 */
export const normalizeStatusActive = (value: string): boolean => {
  const token = normalizeImportToken(value);
  if (!token) return true;
  if (['active', 'hoatdong', '1', 'true', 'yes', 'co'].includes(token)) return true;
  if (['inactive', 'khonghoatdong', 'ngunghoatdong', '0', 'false', 'no', 'khong'].includes(token)) return false;
  return true;
};

/**
 * Normalize employee status from import
 */
export const normalizeEmployeeStatusImport = (value: string): Employee['status'] => {
  const token = normalizeImportToken(value);
  if (['active', 'hoatdong', '1', 'true', 'yes', 'co'].includes(token)) return 'ACTIVE';
  if (['suspended', 'transferred', 'luanchuyen'].includes(token)) return 'SUSPENDED';
  if (['inactive', 'khonghoatdong', 'ngunghoatdong', 'banned', '0', 'false', 'no', 'khong'].includes(token)) return 'INACTIVE';
  return 'ACTIVE';
};

/**
 * Normalize gender from import
 */
export const normalizeGenderImport = (value: string): Employee['gender'] => {
  const token = normalizeImportToken(value);
  if (['male', 'nam', 'm'].includes(token)) return 'MALE';
  if (['female', 'nu', 'f'].includes(token)) return 'FEMALE';
  if (['other', 'khac', 'o'].includes(token)) return 'OTHER';
  return null;
};

/**
 * Normalize VPN status from import
 */
export const normalizeVpnImport = (value: string): Employee['vpn_status'] => {
  const token = normalizeImportToken(value);
  if (['yes', 'co', '1', 'true'].includes(token)) return 'YES';
  return 'NO';
};

/**
 * Normalize a product record from import
 */
export const normalizeProductRecord = (product: Product): Product => ({
  ...product,
  service_group: normalizeProductServiceGroup(product.service_group),
  package_name: typeof product.package_name === 'string'
    ? product.package_name
    : (product.package_name ?? null),
  unit: normalizeProductUnitForSave(product.unit),
  description: typeof product.description === 'string'
    ? product.description
    : (product.description ?? null),
  attachments: Array.isArray(product.attachments)
    ? product.attachments.map((attachment) => ({
      ...attachment,
      id: String(attachment.id ?? ''),
      fileName: String(attachment.fileName ?? ''),
      mimeType: String(attachment.mimeType ?? 'application/octet-stream'),
      fileSize: Number.isFinite(Number(attachment.fileSize)) ? Number(attachment.fileSize) : 0,
      fileUrl: String(attachment.fileUrl ?? ''),
      driveFileId: String(attachment.driveFileId ?? ''),
      createdAt: String(attachment.createdAt ?? ''),
      storagePath: typeof attachment.storagePath === 'string' ? attachment.storagePath : (attachment.storagePath ?? null),
      storageDisk: typeof attachment.storageDisk === 'string' ? attachment.storageDisk : (attachment.storageDisk ?? null),
      storageVisibility: typeof attachment.storageVisibility === 'string' ? attachment.storageVisibility : (attachment.storageVisibility ?? null),
      warningMessage: typeof attachment.warningMessage === 'string' ? attachment.warningMessage : (attachment.warningMessage ?? null),
    }))
    : [],
  is_active: product.is_active !== false,
});

/**
 * Check if error is a product delete dependency error
 */
export const isProductDeleteDependencyError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return normalizedMessage.includes('san pham dang duoc su dung va khong the xoa')
    || normalizedMessage.includes('san pham dang phat sinh o du lieu khac')
    || normalizedMessage.includes('xoa ban ghi tham chieu truoc khi xoa san pham');
};

/**
 * Check if error is a customer delete dependency error
 */
export const isCustomerDeleteDependencyError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return Number((error as { status?: number }).status) === 422;
};

/**
 * Check if error is an infrastructure/network error during import
 */
export const isImportInfrastructureError = (error: unknown, message: string): boolean => {
  const token = normalizeImportToken(message);

  if (
    token.includes('khongtheketnoimaychu') ||
    token.includes('failedtofetch') ||
    token.includes('networkerror') ||
    token.includes('loadfailed') ||
    token.includes('timeout') ||
    token.includes('hethongdangban') ||
    token.includes('econnrefused')
  ) {
    return true;
  }

  return error instanceof TypeError;
};
