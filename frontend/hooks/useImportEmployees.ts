/**
 * Hook for importing employees data
 */

import { useCallback } from 'react';
import type * as React from 'react';
import type { Employee, Department } from '../types';
import {
  normalizeImportToken,
  normalizeGenderImport,
  normalizeVpnImport,
  normalizeEmployeeStatusImport,
  normalizeImportDate,
  isImportInfrastructureError,
} from '../utils/importUtils';
import {
  buildHeaderIndex,
  getImportCell,
  buildAgeRangeValidationMessage,
  validateImportedBirthDate,
  summarizeImportResult,
  exportImportFailureFile,
  rollbackImportedRows,
} from '../utils/importValidation';
import type { ImportPayload } from '../components/modals/projectImportTypes';
import { createEmployeesBulk, deleteEmployee } from '../services/v5Api';

interface UseImportEmployeesResult {
  handleImportEmployees: (
    payload: ImportPayload,
    departments: Department[],
    addToast: (type: 'success' | 'error', title: string, message: string) => void,
    setImportLoadingText: (text: string) => void,
    setIsSaving: (saving: boolean) => void,
    setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>,
    loadEmployeesPage: () => Promise<void>,
    handleCloseModal: () => void
  ) => Promise<void>;
}

const EMPLOYEE_IMPORT_STATUS_TOKENS = [
  'active',
  'hoatdong',
  'inactive',
  'khonghoatdong',
  'ngunghoatdong',
  'suspended',
  'transferred',
  'luanchuyen',
  'banned',
  '0',
  '1',
  'khong',
];

const EMPLOYEE_IMPORT_GENDER_TOKENS = ['male', 'nam', 'm', 'female', 'nu', 'f', 'other', 'khac', 'o'];
const EMPLOYEE_IMPORT_VPN_TOKENS = ['yes', 'co', '1', 'true', 'no', 'khong', '0', 'false'];

const hasRecognizedImportToken = (rawValue: string, supportedTokens: string[]): boolean => {
  const token = normalizeImportToken(rawValue);
  return token === '' || supportedTokens.includes(token);
};

export function useImportEmployees(): UseImportEmployeesResult {
  const ageRangeValidationMessage = buildAgeRangeValidationMessage();

  const handleImportEmployees = useCallback(async (
    payload: ImportPayload,
    departments: Department[],
    addToast: (type: 'success' | 'error', title: string, message: string) => void,
    setImportLoadingText: (text: string) => void,
    setIsSaving: (saving: boolean) => void,
    setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>,
    loadEmployeesPage: () => Promise<void>,
    handleCloseModal: () => void
  ) => {
    const headerIndex = buildHeaderIndex(payload.headers || []);
    const rows = payload.rows || [];

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
    let successfulItemCount = 0;
    let abortedByInfraIssue = false;

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const rowNumber = rowIndex + 2;

      const employeeCode = getImportCell(row, headerIndex, ['manv', 'manhanvien', 'usercode', 'employeecode', 'code']);
      const username = getImportCell(row, headerIndex, ['tendangnhap', 'username', 'login']);
      const fullName = getImportCell(row, headerIndex, ['hovaten', 'hoten', 'fullname', 'name']);
      const phoneRaw = getImportCell(row, headerIndex, [
        'sodienthoai',
        'sdt',
        'sodt',
        'dienthoai',
        'phone',
        'phonenumber',
        'phone_number',
        'mobile',
        'tel',
      ]);
      const email = getImportCell(row, headerIndex, ['email', 'vnptmail', 'vnptemail']);
      const gmail = getImportCell(row, headerIndex, ['gmail', 'googlemail']);
      const departmentCodeRaw = getImportCell(row, headerIndex, ['maphongban', 'mapb', 'departmentcode', 'deptcode']);
      const positionCode = getImportCell(row, headerIndex, ['machucvu', 'positioncode', 'positionid', 'chucvu']);
      const jobTitle = getImportCell(row, headerIndex, ['chucdanhtv', 'chucdanh', 'jobtitle', 'jobtitletv']);
      const dateOfBirthRaw = getImportCell(row, headerIndex, ['ngaysinh', 'dateofbirth', 'dob']);
      const genderRaw = getImportCell(row, headerIndex, ['gioitinh', 'gender']);
      const vpnRaw = getImportCell(row, headerIndex, ['vpn', 'vpnstatus']);
      const ipAddress = getImportCell(row, headerIndex, ['diachiip', 'ipaddress', 'ip']);
      const statusRaw = getImportCell(row, headerIndex, ['trangthai', 'status']);

      if (
        !employeeCode &&
        !username &&
        !fullName &&
        !phoneRaw &&
        !email &&
        !gmail &&
        !departmentCodeRaw &&
        !positionCode &&
        !jobTitle &&
        !dateOfBirthRaw &&
        !genderRaw &&
        !vpnRaw &&
        !ipAddress &&
        !statusRaw
      ) {
        continue;
      }

      if (!employeeCode) {
        failures.push(`Dòng ${rowNumber}: thiếu Mã NV.`);
        continue;
      }

      const departmentCode = normalizeImportToken(departmentCodeRaw);
      const department = departmentCode ? deptByCode.get(departmentCode) : null;
      if (departmentCodeRaw && !department) {
        failures.push(`Dòng ${rowNumber}: không tìm thấy phòng ban "${departmentCodeRaw}".`);
        continue;
      }

      if (!hasRecognizedImportToken(statusRaw, EMPLOYEE_IMPORT_STATUS_TOKENS)) {
        failures.push(`Dòng ${rowNumber}: trạng thái "${statusRaw}" không hợp lệ.`);
        continue;
      }

      if (!hasRecognizedImportToken(genderRaw, EMPLOYEE_IMPORT_GENDER_TOKENS)) {
        failures.push(`Dòng ${rowNumber}: giới tính "${genderRaw}" không hợp lệ.`);
        continue;
      }

      if (!hasRecognizedImportToken(vpnRaw, EMPLOYEE_IMPORT_VPN_TOKENS)) {
        failures.push(`Dòng ${rowNumber}: trạng thái VPN "${vpnRaw}" không hợp lệ.`);
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
        payload: (() => {
          const employeePayload: Partial<Employee> = {
            user_code: employeeCode,
          };

          if (username) {
            employeePayload.username = username;
          }
          if (fullName) {
            employeePayload.full_name = fullName;
          }
          if (phoneRaw) {
            employeePayload.phone_number = phoneRaw;
            employeePayload.phone = phoneRaw;
          }
          if (email) {
            employeePayload.email = email;
          }
          if (gmail) {
            employeePayload.gmail = gmail;
          }
          if (department) {
            employeePayload.department_id = department.id;
          }
          if (positionCode) {
            employeePayload.position_id = positionCode;
          }
          if (jobTitle) {
            employeePayload.job_title_raw = jobTitle;
          }
          if (normalizedDate) {
            employeePayload.date_of_birth = normalizedDate;
          }

          const normalizedGender = normalizeGenderImport(genderRaw);
          if (normalizedGender) {
            employeePayload.gender = normalizedGender;
          }

          const normalizedVpn = vpnRaw ? normalizeVpnImport(vpnRaw) : null;
          if (normalizedVpn) {
            employeePayload.vpn_status = normalizedVpn;
          }

          if (ipAddress) {
            employeePayload.ip_address = ipAddress;
          }

          const normalizedStatus = statusRaw ? normalizeEmployeeStatusImport(statusRaw) : null;
          if (normalizedStatus) {
            employeePayload.status = normalizedStatus;
          }

          return employeePayload;
        })(),
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
              successfulItemCount += 1;
              return;
            }

            failures.push(`Dòng ${entry.rowNumber}: ${result.message || 'Dữ liệu không hợp lệ.'}`);
          });

          createdItems.push(...(bulkResult.created || []));

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
    } else if (successfulItemCount > 0) {
      await loadEmployeesPage();
    }

    const importedEmployeeCount = abortedByInfraIssue ? 0 : successfulItemCount;
    summarizeImportResult('Nhân sự', importedEmployeeCount, failures, addToast);
    exportImportFailureFile(payload, 'Nhân sự', failures, addToast);
    if (importedEmployeeCount > 0 && failures.length === 0 && !abortedByInfraIssue) {
      handleCloseModal();
    }
  }, [ageRangeValidationMessage]);

  return { handleImportEmployees };
}
