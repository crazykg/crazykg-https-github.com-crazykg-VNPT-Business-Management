/**
 * Import handlers for all modules
 * 
 * This module contains the core import logic extracted from App.tsx
 * to reduce the size of the main App component.
 */

import type * as React from 'react';
import type { Department, Employee, Business, Vendor, Product, Customer, CustomerPersonnel, Project } from '../types';
import type { ImportPayload } from '../components/Modals';
import {
  normalizeImportToken,
  normalizeImportDate,
  normalizeImportNumber,
  normalizeStatusActive,
  normalizeEmployeeStatusImport,
  normalizeGenderImport,
  normalizeVpnImport,
  normalizeProductRecord,
  isProductDeleteDependencyError,
  isCustomerDeleteDependencyError,
  isImportInfrastructureError,
} from './importUtils';
import {
  buildHeaderIndex,
  getImportCell,
  buildAgeRangeValidationMessage,
  validateImportedBirthDate,
  summarizeImportResult,
  buildImportFailureRows,
  exportImportFailureFile,
  rollbackImportedRows,
} from './importValidation';
import {
  createDepartment,
  deleteDepartment,
  createEmployeesBulk,
  deleteEmployee,
} from '../services/v5Api';

/**
 * Import departments data
 */
export const importDepartments = async (
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
};

/**
 * Import employees data
 */
export const importEmployees = async (
  payload: ImportPayload,
  departments: Department[],
  addToast: (type: 'success' | 'error', title: string, message: string) => void,
  setImportLoadingText: (text: string) => void,
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>,
  loadEmployeesPage: () => Promise<void>,
  handleCloseModal: () => void
) => {
  const headerIndex = buildHeaderIndex(payload.headers || []);
  const rows = payload.rows || [];
  const ageRangeValidationMessage = buildAgeRangeValidationMessage();

  const deptByCode = new Map<string, Department>();
  (departments || []).forEach((department) => {
    const codeToken = normalizeImportToken(department.dept_code);
    if (codeToken) {
      deptByCode.set(codeToken, department);
    }
  });

  const importEntries: Array<{ rowNumber: number; payload: Partial<Employee> }> = [];
  const createdItems: Employee[] = [];
  const failures: string[] = [];
  let abortedByInfraIssue = false;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const rowNumber = rowIndex + 2;

    const employeeCode = getImportCell(row, headerIndex, ['manv', 'manhanvien', 'usercode', 'employeecode', 'code']);
    const username = getImportCell(row, headerIndex, ['tendangnhap', 'username', 'login']);
    const fullName = getImportCell(row, headerIndex, ['hovaten', 'hoten', 'fullname', 'name']);
    const phoneRaw = getImportCell(row, headerIndex, ['sodienthoai', 'sdt', 'sodt', 'dienthoai', 'phone', 'phonenumber', 'phone_number', 'mobile', 'tel']);
    const email = getImportCell(row, headerIndex, ['email']);
    const departmentCodeRaw = getImportCell(row, headerIndex, ['maphongban', 'mapb', 'departmentcode', 'deptcode']);
    const positionCode = getImportCell(row, headerIndex, ['machucvu', 'positioncode', 'positionid', 'chucvu']);
    const jobTitle = getImportCell(row, headerIndex, ['chucdanhtv', 'chucdanh', 'jobtitle', 'jobtitletv']);
    const dateOfBirthRaw = getImportCell(row, headerIndex, ['ngaysinh', 'dateofbirth', 'dob']);
    const genderRaw = getImportCell(row, headerIndex, ['gioitinh', 'gender']);
    const vpnRaw = getImportCell(row, headerIndex, ['vpn', 'vpnstatus']);
    const ipAddress = getImportCell(row, headerIndex, ['diachiip', 'ipaddress', 'ip']);
    const statusRaw = getImportCell(row, headerIndex, ['trangthai', 'status']);

    if (!employeeCode && !username && !fullName && !phoneRaw && !email && !departmentCodeRaw && !positionCode && !jobTitle && !dateOfBirthRaw && !genderRaw && !vpnRaw && !ipAddress && !statusRaw) {
      continue;
    }

    if (!employeeCode || !fullName || !email) {
      failures.push(`Dòng ${rowNumber}: thiếu Mã NV, Họ và tên hoặc Email.`);
      continue;
    }

    const departmentCode = normalizeImportToken(departmentCodeRaw);
    const department = departmentCode ? deptByCode.get(departmentCode) : null;
    if (!department) {
      failures.push(`Dòng ${rowNumber}: không tìm thấy phòng ban "${departmentCodeRaw}".`);
      continue;
    }

    const normalizedDate = normalizeImportDate(dateOfBirthRaw);
    if (dateOfBirthRaw && !normalizedDate) {
      failures.push(`Dòng ${rowNumber}: ngày sinh "${dateOfBirthRaw}" không đúng định dạng.`);
      continue;
    }
    if (dateOfBirthRaw && !validateImportedBirthDate(normalizedDate)) {
      failures.push(`Dòng ${rowNumber}: ${ageRangeValidationMessage}`);
      continue;
    }

    importEntries.push({
      rowNumber,
      payload: {
        user_code: employeeCode,
        username: username || employeeCode.toLowerCase(),
        full_name: fullName,
        phone_number: phoneRaw || null,
        phone: phoneRaw || null,
        email,
        department_id: department.id,
        position_id: positionCode || null,
        job_title_raw: jobTitle || null,
        date_of_birth: normalizedDate,
        gender: normalizeGenderImport(genderRaw),
        vpn_status: normalizeVpnImport(vpnRaw),
        ip_address: ipAddress || null,
        status: normalizeEmployeeStatusImport(statusRaw),
      },
    });
  }

  const totalImportEntries = importEntries.length;
  if (totalImportEntries > 0) {
    const importBatchSize = 100;
    const chunks: Array<{ rowNumber: number; payload: Partial<Employee> }[]> = [];
    for (let start = 0; start < importEntries.length; start += importBatchSize) {
      chunks.push(importEntries.slice(start, start + importBatchSize));
    }

    let processed = 0;

    for (const chunk of chunks) {
      if (abortedByInfraIssue) {
        break;
      }

      try {
        const bulkResult = await createEmployeesBulk(chunk.map((entry) => entry.payload));
        const rowResults = bulkResult.results || [];

        if (rowResults.length === 0) {
          chunk.forEach((entry) => {
            failures.push(`Dòng ${entry.rowNumber}: backend không trả kết quả chi tiết.`);
          });
          processed += chunk.length;
          setImportLoadingText(`Đang nhập Nhân sự: ${Math.min(processed, totalImportEntries)}/${totalImportEntries}`);
          continue;
        }

        const handledIndices = new Set<number>();
        rowResults.forEach((result) => {
          const itemIndex = Number(result.index);
          if (!Number.isFinite(itemIndex) || itemIndex < 0 || itemIndex >= chunk.length) {
            return;
          }

          handledIndices.add(itemIndex);
          const entry = chunk[itemIndex];
          if (result.success && result.data) {
            createdItems.push(result.data);
            return;
          }

          failures.push(`Dòng ${entry.rowNumber}: ${result.message || 'Dữ liệu không hợp lệ.'}`);
        });

        for (let itemIndex = 0; itemIndex < chunk.length; itemIndex += 1) {
          if (!handledIndices.has(itemIndex)) {
            failures.push(`Dòng ${chunk[itemIndex].rowNumber}: backend không phản hồi trạng thái.`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Lỗi không xác định';
        if (isImportInfrastructureError(error, message)) {
          failures.push(`Batch nhân sự: ${message}`);
          failures.push('Đã dừng import do lỗi kết nối mạng hoặc máy chủ. Vui lòng thử lại sau khi hệ thống ổn định.');
          abortedByInfraIssue = true;
          break;
        }

        chunk.forEach((entry) => {
          failures.push(`Dòng ${entry.rowNumber}: ${message}`);
        });
      }

      processed += chunk.length;
      setImportLoadingText(`Đang nhập Nhân sự: ${Math.min(processed, totalImportEntries)}/${totalImportEntries}`);
    }
  }

  if (abortedByInfraIssue) {
    await rollbackImportedRows('Nhân sự', createdItems, deleteEmployee, addToast);
  } else if (createdItems.length > 0) {
    setEmployees((prev) => [...createdItems, ...(prev || [])]);
    void loadEmployeesPage();
  }

  const importedEmployeeCount = abortedByInfraIssue ? 0 : createdItems.length;
  summarizeImportResult('Nhân sự', importedEmployeeCount, failures, addToast);
  exportImportFailureFile(payload, 'Nhân sự', failures, addToast);
  if (importedEmployeeCount > 0 && failures.length === 0 && !abortedByInfraIssue) {
    handleCloseModal();
  }
};

// Note: More import handlers will be added in subsequent phases
