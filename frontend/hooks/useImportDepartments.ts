/**
 * Hook for importing departments data
 */

import { useCallback } from 'react';
import type * as React from 'react';
import type { Department } from '../types';
import {
  normalizeImportToken,
  normalizeStatusActive,
  isImportInfrastructureError,
} from '../utils/importUtils';
import {
  buildHeaderIndex,
  getImportCell,
  summarizeImportResult,
  exportImportFailureFile,
  rollbackImportedRows,
} from '../utils/importValidation';
import type { ImportPayload } from '../components/modals/projectImportTypes';
import { createDepartment, deleteDepartment } from '../services/v5Api';

interface UseImportDepartmentsResult {
  handleImportDepartments: (
    payload: ImportPayload,
    departments: Department[],
    setDepartments: React.Dispatch<React.SetStateAction<Department[]>>,
    addToast: (type: 'success' | 'error', title: string, message: string) => void,
    setImportLoadingText: (text: string) => void,
    setIsSaving: (saving: boolean) => void,
    handleCloseModal: () => void
  ) => Promise<void>;
}

export function useImportDepartments(): UseImportDepartmentsResult {
  const handleImportDepartments = useCallback(async (
    payload: ImportPayload,
    departments: Department[],
    setDepartments: React.Dispatch<React.SetStateAction<Department[]>>,
    addToast: (type: 'success' | 'error', title: string, message: string) => void,
    setImportLoadingText: (text: string) => void,
    setIsSaving: (saving: boolean) => void,
    handleCloseModal: () => void
  ) => {
    const headerIndex = buildHeaderIndex(payload.headers || []);
    const rows = payload.rows || [];

    if (rows.length === 0) {
      addToast('error', 'Nhập dữ liệu', 'File không có dòng dữ liệu hợp lệ để lưu.');
      return;
    }

    const deptByCode = new Map<string, Department>();
    (departments || []).forEach((department) => {
      const codeToken = normalizeImportToken(department.dept_code);
      if (codeToken) {
        deptByCode.set(codeToken, department);
      }
    });

    const entries: Array<{
      rowNumber: number;
      deptCode: string;
      deptCodeToken: string;
      deptName: string;
      parentCodeToken: string;
      parentCodeRaw: string;
      isActive: boolean;
    }> = [];
    const failures: string[] = [];

    rows.forEach((row, rowIndex) => {
      const rowNumber = rowIndex + 2;
      const deptCode = getImportCell(row, headerIndex, ['maphongban', 'mapb', 'deptcode', 'departmentcode', 'code']);
      const deptName = getImportCell(row, headerIndex, ['tenphongban', 'departmentname', 'deptname', 'name']);
      const parentCodeRaw = getImportCell(row, headerIndex, ['maphongbancha', 'mapbcha', 'parentcode', 'parentdeptcode', 'parent']);
      const statusRaw = getImportCell(row, headerIndex, ['trangthai', 'status', 'isactive']);

      if (!(deptCode || deptName || parentCodeRaw || statusRaw)) {
        return;
      }

      if (!deptCode || !deptName) {
        failures.push(`Dòng ${rowNumber}: thiếu Mã phòng ban hoặc Tên phòng ban.`);
        return;
      }

      entries.push({
        rowNumber,
        deptCode,
        deptCodeToken: normalizeImportToken(deptCode),
        deptName,
        parentCodeToken: normalizeImportToken(parentCodeRaw),
        parentCodeRaw,
        isActive: normalizeStatusActive(statusRaw),
      });
    });

    const createdItems: Department[] = [];
    const pending = [...entries];
    let guard = pending.length + 5;
    let abortedByInfraIssue = false;

    while (pending.length > 0 && guard > 0 && !abortedByInfraIssue) {
      let hasProgress = false;

      for (let i = 0; i < pending.length; i += 1) {
        const entry = pending[i];

        if (!entry.deptCodeToken) {
          failures.push(`Dòng ${entry.rowNumber}: Mã phòng ban không hợp lệ.`);
          pending.splice(i, 1);
          i -= 1;
          hasProgress = true;
          continue;
        }

        if (deptByCode.has(entry.deptCodeToken)) {
          failures.push(`Dòng ${entry.rowNumber}: Mã phòng ban "${entry.deptCode}" đã tồn tại.`);
          pending.splice(i, 1);
          i -= 1;
          hasProgress = true;
          continue;
        }

        const parentDept = entry.parentCodeToken ? deptByCode.get(entry.parentCodeToken) : null;
        if (entry.parentCodeToken && !parentDept) {
          continue;
        }

        try {
          const created = await createDepartment({
            dept_code: entry.deptCode,
            dept_name: entry.deptName,
            parent_id: parentDept ? parentDept.id : null,
            is_active: entry.isActive,
          });
          createdItems.push(created);
          deptByCode.set(entry.deptCodeToken, created);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Lỗi không xác định';
          if (isImportInfrastructureError(error, message)) {
            failures.push(`Dòng ${entry.rowNumber}: ${message}`);
            failures.push('Đã dừng import do lỗi kết nối mạng hoặc máy chủ. Vui lòng thử lại sau khi hệ thống ổn định.');
            abortedByInfraIssue = true;
            break;
          }
          failures.push(`Dòng ${entry.rowNumber}: ${message}`);
        }

        if (abortedByInfraIssue) {
          break;
        }

        pending.splice(i, 1);
        i -= 1;
        hasProgress = true;
      }

      if (!hasProgress) {
        pending.forEach((entry) => {
          failures.push(`Dòng ${entry.rowNumber}: không tìm thấy phòng ban cha "${entry.parentCodeRaw}".`);
        });
        break;
      }

      guard -= 1;
    }

    if (abortedByInfraIssue) {
      await rollbackImportedRows('Phòng ban', createdItems, deleteDepartment, addToast);
    } else if (createdItems.length > 0) {
      setDepartments((prev) => [...createdItems, ...(prev || [])]);
    }

    const importedDepartmentCount = abortedByInfraIssue ? 0 : createdItems.length;
    summarizeImportResult('Phòng ban', importedDepartmentCount, failures, addToast);
    exportImportFailureFile(payload, 'Phòng ban', failures, addToast);
    if (importedDepartmentCount > 0 && failures.length === 0 && !abortedByInfraIssue) {
      handleCloseModal();
    }
  }, []);

  return { handleImportDepartments };
}