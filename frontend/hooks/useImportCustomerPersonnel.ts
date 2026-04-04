import { useCallback } from 'react';
import type { Customer, CustomerPersonnel, SupportContactPosition } from '../types';
import type { ImportPayload } from '../components/modals/projectImportTypes';
import {
  buildAgeRangeValidationMessage,
  buildHeaderIndex,
  exportImportFailureFile,
  getImportCell,
  rollbackImportedRows,
  summarizeImportResult,
  validateImportedBirthDate,
} from '../utils/importValidation';
import {
  isImportInfrastructureError,
  normalizeImportDate,
  normalizeImportToken,
} from '../utils/importUtils';
import { createCustomerPersonnelBulk, deleteCustomerPersonnel } from '../services/v5Api';

interface UseImportCustomerPersonnelResult {
  handleImportCustomerPersonnel: (
    payload: ImportPayload,
    customers: Customer[],
    supportContactPositions: SupportContactPosition[],
    addToast: (type: 'success' | 'error', title: string, message: string) => void,
    setImportLoadingText: (text: string) => void,
    loadCustomerPersonnel: () => Promise<void>,
    handleCloseModal: () => void
  ) => Promise<void>;
}

const ACTIVE_STATUS_TOKENS = ['active', 'hoatdong', '1', 'true', 'yes', 'co'];
const INACTIVE_STATUS_TOKENS = ['inactive', 'khonghoatdong', 'ngunghoatdong', '0', 'false', 'no', 'khong'];

const hasRecognizedStatus = (rawValue: string): boolean => {
  const token = normalizeImportToken(rawValue);
  return token === '' || ACTIVE_STATUS_TOKENS.includes(token) || INACTIVE_STATUS_TOKENS.includes(token);
};

const normalizeImportedCustomerPersonnelStatus = (rawValue: string): 'Active' | 'Inactive' => {
  const token = normalizeImportToken(rawValue);
  if (INACTIVE_STATUS_TOKENS.includes(token)) {
    return 'Inactive';
  }

  return 'Active';
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const collapseImportWhitespace = (value: string): string => String(value || '').trim().replace(/\s+/g, ' ');
const compactImportWhitespace = (value: string): string => String(value || '').replace(/\s+/g, '').trim();
const normalizeBirthdayImportValue = (value: string): string =>
  collapseImportWhitespace(value).replace(/\s*([/-])\s*/g, '$1');

export function useImportCustomerPersonnel(): UseImportCustomerPersonnelResult {
  const ageRangeValidationMessage = buildAgeRangeValidationMessage();

  const handleImportCustomerPersonnel = useCallback(async (
    payload: ImportPayload,
    customers: Customer[],
    supportContactPositions: SupportContactPosition[],
    addToast: (type: 'success' | 'error', title: string, message: string) => void,
    setImportLoadingText: (text: string) => void,
    loadCustomerPersonnel: () => Promise<void>,
    handleCloseModal: () => void
  ) => {
    const headerIndex = buildHeaderIndex(payload.headers || []);
    const rows = payload.rows || [];

    if (rows.length === 0) {
      addToast('error', 'Nhập dữ liệu', 'File không có dòng dữ liệu hợp lệ để lưu.');
      return;
    }

    const customerByLookup = new Map<string, Customer>();
    (customers || []).forEach((customer) => {
      const idToken = normalizeImportToken(customer.id);
      const codeToken = normalizeImportToken(customer.customer_code);
      if (idToken) {
        customerByLookup.set(idToken, customer);
      }
      if (codeToken) {
        customerByLookup.set(codeToken, customer);
      }
    });

    const positionByLookup = new Map<string, SupportContactPosition>();
    (supportContactPositions || []).forEach((position) => {
      const idToken = normalizeImportToken(position.id);
      const codeToken = normalizeImportToken(position.position_code);
      const nameToken = normalizeImportToken(position.position_name);
      if (idToken) {
        positionByLookup.set(idToken, position);
      }
      if (codeToken) {
        positionByLookup.set(codeToken, position);
      }
      if (nameToken) {
        positionByLookup.set(nameToken, position);
      }
    });

    const importEntries: Array<{ rowNumber: number; payload: Partial<CustomerPersonnel> }> = [];
    const createdItems: CustomerPersonnel[] = [];
    const failures: string[] = [];
    let abortedByInfraIssue = false;

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const rowNumber = rowIndex + 2;

      const customerLookupRaw = compactImportWhitespace(getImportCell(row, headerIndex, [
        'makhachhang',
        'makh',
        'customercode',
        'customercode',
        'customerid',
        'idkhachhang',
      ]));
      const fullName = collapseImportWhitespace(getImportCell(row, headerIndex, ['hovaten', 'hoten', 'fullname', 'name']));
      const birthdayRaw = normalizeBirthdayImportValue(getImportCell(row, headerIndex, ['ngaysinh', 'dateofbirth', 'birthday', 'dob']));
      const positionLookupRaw = collapseImportWhitespace(getImportCell(row, headerIndex, [
        'machucvu',
        'chucvu',
        'positioncode',
        'positionid',
        'positionname',
        'tenchucvu',
        'role',
        'vaitro',
      ]));
      const phoneNumber = compactImportWhitespace(getImportCell(row, headerIndex, [
        'sodienthoai',
        'sdt',
        'sodt',
        'dienthoai',
        'phone',
        'phonenumber',
        'phone_number',
        'mobile',
        'tel',
      ]));
      const email = compactImportWhitespace(getImportCell(row, headerIndex, ['email']));
      const statusRaw = collapseImportWhitespace(getImportCell(row, headerIndex, ['trangthai', 'status']));

      if (!(customerLookupRaw || fullName || birthdayRaw || positionLookupRaw || phoneNumber || email || statusRaw)) {
        continue;
      }

      if (!customerLookupRaw) {
        failures.push(`Dòng ${rowNumber}: thiếu Mã khách hàng hoặc ID khách hàng.`);
        continue;
      }

      const customer = customerByLookup.get(normalizeImportToken(customerLookupRaw));
      if (!customer) {
        failures.push(`Dòng ${rowNumber}: không tìm thấy khách hàng "${customerLookupRaw}".`);
        continue;
      }

      if (!fullName) {
        failures.push(`Dòng ${rowNumber}: thiếu Họ và tên.`);
        continue;
      }

      if (!positionLookupRaw) {
        failures.push(`Dòng ${rowNumber}: thiếu Chức vụ.`);
        continue;
      }

      const position = positionByLookup.get(normalizeImportToken(positionLookupRaw));
      if (!position) {
        failures.push(`Dòng ${rowNumber}: không tìm thấy chức vụ "${positionLookupRaw}".`);
        continue;
      }

      const normalizedBirthday = normalizeImportDate(birthdayRaw);
      if (birthdayRaw && !normalizedBirthday) {
        failures.push(`Dòng ${rowNumber}: ngày sinh "${birthdayRaw}" không đúng định dạng.`);
        continue;
      }

      if (birthdayRaw && !validateImportedBirthDate(normalizedBirthday)) {
        failures.push(`Dòng ${rowNumber}: ${ageRangeValidationMessage}`);
        continue;
      }

      if (email && !EMAIL_REGEX.test(email)) {
        failures.push(`Dòng ${rowNumber}: email "${email}" không hợp lệ.`);
        continue;
      }

      if (!hasRecognizedStatus(statusRaw)) {
        failures.push(`Dòng ${rowNumber}: trạng thái "${statusRaw}" không hợp lệ.`);
        continue;
      }

      importEntries.push({
        rowNumber,
        payload: {
          customerId: String(customer.id),
          fullName,
          birthday: normalizedBirthday || '',
          positionId: position.id,
          positionType: position.position_code,
          positionLabel: position.position_name,
          phoneNumber: phoneNumber || '',
          email: email || '',
          status: normalizeImportedCustomerPersonnelStatus(statusRaw),
        },
      });
    }

    const totalImportEntries = importEntries.length;
    let processed = 0;

    if (totalImportEntries > 0) {
      const importBatchSize = 1000;
      const chunks: Array<{ rowNumber: number; payload: Partial<CustomerPersonnel> }[]> = [];
      for (let start = 0; start < importEntries.length; start += importBatchSize) {
        chunks.push(importEntries.slice(start, start + importBatchSize));
      }

      for (const chunk of chunks) {
        if (abortedByInfraIssue) {
          break;
        }

        try {
          const bulkResult = await createCustomerPersonnelBulk(chunk.map((entry) => entry.payload));
          const rowResults = bulkResult.results || [];

          if (rowResults.length === 0) {
            chunk.forEach((entry) => {
              failures.push(`Dòng ${entry.rowNumber}: backend không trả kết quả chi tiết.`);
            });
            processed += chunk.length;
            setImportLoadingText(`Đang nhập Đầu mối liên hệ: ${Math.min(processed, totalImportEntries)}/${totalImportEntries}`);
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
            failures.push(`Batch đầu mối liên hệ: ${message}`);
            failures.push('Đã dừng import do lỗi kết nối mạng hoặc máy chủ. Vui lòng thử lại sau khi hệ thống ổn định.');
            abortedByInfraIssue = true;
            break;
          }

          chunk.forEach((entry) => {
            failures.push(`Dòng ${entry.rowNumber}: ${message}`);
          });
        }

        processed += chunk.length;
        setImportLoadingText(`Đang nhập Đầu mối liên hệ: ${Math.min(processed, totalImportEntries)}/${totalImportEntries}`);
      }
    }

    if (abortedByInfraIssue) {
      await rollbackImportedRows('Đầu mối liên hệ', createdItems, deleteCustomerPersonnel, addToast);
    } else if (createdItems.length > 0) {
      await loadCustomerPersonnel();
    }

    const importedCount = abortedByInfraIssue ? 0 : createdItems.length;
    summarizeImportResult('Đầu mối liên hệ', importedCount, failures, addToast);
    exportImportFailureFile(payload, 'Đầu mối liên hệ', failures, addToast);
    if (importedCount > 0 && failures.length === 0 && !abortedByInfraIssue) {
      handleCloseModal();
    }
  }, [ageRangeValidationMessage]);

  return { handleImportCustomerPersonnel };
}
