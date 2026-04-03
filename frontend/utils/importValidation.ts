/**
 * Utility functions for import validation and error handling
 * 
 * This module contains functions for validating imported data,
 * building failure reports, and handling import errors.
 */

import type { ImportPayload } from '../components/modals/projectImportTypes';
import { downloadExcelWorkbook } from './excelTemplate';
import { normalizeImportToken } from './importUtils';

/**
 * Build header index map for import processing
 */
export const buildHeaderIndex = (headers: string[]): Map<string, number> => {
  const indexMap = new Map<string, number>();
  (headers || []).forEach((header, index) => {
    const normalized = normalizeImportToken(header);
    if (normalized && !indexMap.has(normalized)) {
      indexMap.set(normalized, index);
    }
  });
  return indexMap;
};

/**
 * Get cell value from row using header aliases
 */
export const getImportCell = (
  row: string[],
  headerIndex: Map<string, number>,
  aliases: string[]
): string => {
  for (const alias of aliases) {
    const columnIndex = headerIndex.get(normalizeImportToken(alias));
    if (columnIndex !== undefined) {
      return String(row[columnIndex] ?? '').trim();
    }
  }
  return '';
};

/**
 * Build age range validation message
 */
export const buildAgeRangeValidationMessage = (): string => {
  return 'Ngày sinh phải nằm trong khoảng từ 18 đến 100 tuổi.';
};

/**
 * Check if age is in allowed range (18-100 years)
 */
export const isAgeInAllowedRange = (isoDate: string | null): boolean => {
  if (!isoDate) {
    return true;
  }
  
  const birthDate = new Date(isoDate);
  const now = new Date();
  const minAgeDate = new Date();
  minAgeDate.setFullYear(now.getFullYear() - 100);
  const maxAgeDate = new Date();
  maxAgeDate.setFullYear(now.getFullYear() - 18);
  
  return birthDate >= minAgeDate && birthDate <= maxAgeDate;
};

/**
 * Validate imported birth date is in allowed range
 */
export const validateImportedBirthDate = (isoDate: string | null): boolean => {
  if (!isoDate) {
    return true;
  }
  return isAgeInAllowedRange(isoDate);
};

/**
 * Interface for import failure row
 */
export interface ImportFailureRow {
  rowNumber: number;
  row: string[];
  reasons: string[];
}

/**
 * Build import failure rows from failures array
 */
export const buildImportFailureRows = (rows: string[][], failures: string[]): ImportFailureRow[] => {
  const map = new Map<number, ImportFailureRow>();

  failures.forEach((failure) => {
    const matched = failure.match(/Dòng\s+(\d+)\s*:\s*(.+)$/i);
    if (!matched) {
      return;
    }

    const rowNumber = Number(matched[1]);
    const reason = String(matched[2] || '').trim();
    const rowIndex = rowNumber - 2;
    if (!Number.isFinite(rowNumber) || rowIndex < 0 || rowIndex >= rows.length) {
      return;
    }

    const existing = map.get(rowNumber);
    if (existing) {
      if (reason && !existing.reasons.includes(reason)) {
        existing.reasons.push(reason);
      }
      return;
    }

    map.set(rowNumber, {
      rowNumber,
      row: rows[rowIndex] || [],
      reasons: reason ? [reason] : ['Lỗi dữ liệu'],
    });
  });

  return Array.from(map.values()).sort((left, right) => left.rowNumber - right.rowNumber);
};

/**
 * Summarize import result and show toast
 */
export const summarizeImportResult = (
  moduleLabel: string,
  successCount: number,
  failures: string[],
  addToast: (type: 'success' | 'error', title: string, message: string) => void
) => {
  if (successCount > 0) {
    addToast('success', 'Nhập dữ liệu', `${moduleLabel}: đã lưu ${successCount} dòng.`);
  }

  if (failures.length > 0) {
    const preview = failures.slice(0, 2).join(' | ');
    const suffix = failures.length > 2 ? ` (+${failures.length - 2} lỗi khác)` : '';
    addToast('error', 'Nhập dữ liệu', `${moduleLabel}: ${preview}${suffix}`);
  }
};

/**
 * Export import failure file to Excel
 */
export const exportImportFailureFile = (
  payload: ImportPayload,
  moduleLabel: string,
  failures: string[],
  addToast: (type: 'success' | 'error', title: string, message: string) => void
): void => {
  const failureRows = buildImportFailureRows(payload.rows || [], failures);
  if (failureRows.length === 0) {
    return;
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '_');
  const baseName = String(payload.fileName || 'import')
    .replace(/\.[^.]+$/, '')
    .trim() || 'import';

  downloadExcelWorkbook(`${baseName}_error_${timestamp}`, [
    {
      name: 'ImportErrors',
      headers: ['Dòng', ...(payload.headers || []), 'Lý do lỗi'],
      rows: failureRows.map((item) => [
        item.rowNumber,
        ...(payload.headers || []).map((_, index) => item.row[index] || ''),
        item.reasons.join(' | '),
      ]),
    },
  ]);

  addToast(
    'error',
    'Nhập dữ liệu',
    `${moduleLabel}: đã xuất file lỗi (${failureRows.length} dòng thất bại).`
  );
};

/**
 * Rollback imported rows on error
 */
export const rollbackImportedRows = async <T extends { id: string | number }>(
  moduleLabel: string,
  items: T[],
  removeFn: (id: string | number) => Promise<unknown>,
  addToast: (type: 'success' | 'error', title: string, message: string) => void
): Promise<void> => {
  if (!items.length) {
    return;
  }

  let rollbackSuccess = 0;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    try {
      await removeFn(items[index].id);
      rollbackSuccess += 1;
    } catch {
      // Keep going to rollback as much as possible.
    }
  }

  if (rollbackSuccess === items.length) {
    addToast(
      'error',
      'Nhập dữ liệu',
      `${moduleLabel}: đã rollback ${rollbackSuccess}/${items.length} dòng do lỗi kết nối máy chủ.`
    );
    return;
  }

  addToast(
    'error',
    'Nhập dữ liệu',
    `${moduleLabel}: rollback được ${rollbackSuccess}/${items.length} dòng. Vui lòng tải lại trang để đồng bộ dữ liệu.`
  );
};