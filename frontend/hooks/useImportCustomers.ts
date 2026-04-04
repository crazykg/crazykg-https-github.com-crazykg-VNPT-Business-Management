import { useCallback } from 'react';
import type * as React from 'react';
import type { Customer } from '../types';
import type { ImportPayload } from '../components/modals/projectImportTypes';
import { createCustomersBulk } from '../services/v5Api';
import { normalizeImportNumber, normalizeImportToken, isImportInfrastructureError } from '../utils/importUtils';
import {
  buildHeaderIndex,
  getImportCell,
  summarizeImportResult,
  exportImportFailureFile,
} from '../utils/importValidation';
import {
  facilityTypeSupportsBedCapacity,
  inferCustomerSector,
  inferHealthcareFacilityType,
  normalizeCustomerSectorValue,
  normalizeHealthcareFacilityTypeValue,
} from '../utils/customerClassification';

interface UseImportCustomersResult {
  handleImportCustomers: (
    payload: ImportPayload,
    setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>,
    addToast: (type: 'success' | 'error', title: string, message: string) => void,
    setImportLoadingText: (text: string) => void,
    loadCustomersPage: () => Promise<void>,
    handleCloseModal: () => void
  ) => Promise<void>;
}

export function useImportCustomers(): UseImportCustomersResult {
  const handleImportCustomers = useCallback(async (
    payload: ImportPayload,
    setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>,
    addToast: (type: 'success' | 'error', title: string, message: string) => void,
    setImportLoadingText: (text: string) => void,
    loadCustomersPage: () => Promise<void>,
    handleCloseModal: () => void
  ) => {
    const headerIndex = buildHeaderIndex(payload.headers || []);
    const rows = payload.rows || [];

    if (rows.length === 0) {
      addToast('error', 'Nhập dữ liệu', 'File không có dòng dữ liệu hợp lệ để lưu.');
      return;
    }

    const importEntries: Array<{ rowNumber: number; payload: Partial<Customer> }> = [];
    const createdItems: Customer[] = [];
    const failures: string[] = [];
    const seenCustomerCodes = new Set<string>();

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const rowNumber = rowIndex + 2;

      const customerCode = getImportCell(row, headerIndex, ['makhachhang', 'makh', 'customercode', 'code']);
      const customerName = getImportCell(row, headerIndex, ['tenkhachhang', 'tenkh', 'customername', 'name']);
      const customerSectorRaw = getImportCell(row, headerIndex, ['nhomkhachhang', 'nhomkh', 'customersector', 'customergroup', 'sector', 'group']);
      const facilityTypeRaw = getImportCell(row, headerIndex, ['loaihinhcosoyte', 'loaihinhyte', 'healthcarefacilitytype', 'facilitytype', 'loaihinh']);
      const bedCapacityRaw = getImportCell(row, headerIndex, ['quymogiuongbenh', 'giuongbenh', 'bedcapacity', 'bedcount', 'quymo']);
      const taxCode = getImportCell(row, headerIndex, ['masothue', 'mst', 'taxcode']);
      const address = getImportCell(row, headerIndex, ['diachi', 'address']);

      if (!customerCode && !customerName && !customerSectorRaw && !facilityTypeRaw && !bedCapacityRaw && !taxCode && !address) {
        continue;
      }

      if (!customerName) {
        failures.push(`Dòng ${rowNumber}: thiếu Tên khách hàng.`);
        continue;
      }

      const customerCodeToken = customerCode ? normalizeImportToken(customerCode) : '';
      if (customerCode) {
        if (!customerCodeToken) {
          failures.push(`Dòng ${rowNumber}: Mã khách hàng không hợp lệ.`);
          continue;
        }

        if (seenCustomerCodes.has(customerCodeToken)) {
          failures.push(`Dòng ${rowNumber}: Mã khách hàng "${customerCode}" bị trùng trong file import.`);
          continue;
        }

        seenCustomerCodes.add(customerCodeToken);
      }

      const inferredSector = inferCustomerSector(customerName);
      const customerSector = normalizeCustomerSectorValue(customerSectorRaw, inferredSector);
      const inferredFacilityType = customerSector === 'HEALTHCARE'
        ? inferHealthcareFacilityType(customerName)
        : null;
      const facilityType = customerSector === 'HEALTHCARE'
        ? normalizeHealthcareFacilityTypeValue(facilityTypeRaw, inferredFacilityType)
        : null;

      if (customerSector === 'HEALTHCARE' && !facilityType) {
        failures.push(`Dòng ${rowNumber}: khách hàng Y tế cần chọn một trong các loại hình: Bệnh viện (Công lập), Bệnh viện (Tư nhân), Trung tâm Y tế, Phòng khám (Tư nhân), TYT và PKĐK hoặc Khác.`);
        continue;
      }

      let bedCapacity: number | null = null;
      if (bedCapacityRaw) {
        const normalizedBedCapacity = normalizeImportNumber(bedCapacityRaw);
        if (
          normalizedBedCapacity === null
          || !Number.isInteger(normalizedBedCapacity)
          || normalizedBedCapacity < 0
          || normalizedBedCapacity > 1000000
        ) {
          failures.push(`Dòng ${rowNumber}: Quy mô giường bệnh phải là số nguyên không âm và không vượt quá 1.000.000.`);
          continue;
        }

        if (customerSector === 'HEALTHCARE' && facilityTypeSupportsBedCapacity(facilityType, customerName)) {
          bedCapacity = normalizedBedCapacity;
        }
      }

      importEntries.push({
        rowNumber,
        payload: {
          customer_code: customerCode ? customerCode.trim() : null,
          customer_name: customerName.trim(),
          tax_code: taxCode || '',
          address: address || '',
          customer_sector: customerSector,
          healthcare_facility_type: customerSector === 'HEALTHCARE' ? facilityType : null,
          bed_capacity: customerSector === 'HEALTHCARE' && facilityTypeSupportsBedCapacity(facilityType, customerName) ? bedCapacity : null,
        },
      });
    }

    const totalImportEntries = importEntries.length;
    let processed = 0;

    if (totalImportEntries > 0) {
      const importBatchSize = 1000;
      const chunks: Array<{ rowNumber: number; payload: Partial<Customer> }[]> = [];
      for (let start = 0; start < importEntries.length; start += importBatchSize) {
        chunks.push(importEntries.slice(start, start + importBatchSize));
      }

      for (const chunk of chunks) {
        try {
          const bulkResult = await createCustomersBulk(chunk.map((entry) => entry.payload));
          const rowResults = bulkResult.results || [];

          if (rowResults.length === 0) {
            chunk.forEach((entry) => {
              failures.push(`Dòng ${entry.rowNumber}: backend không trả kết quả chi tiết.`);
            });
            processed += chunk.length;
            setImportLoadingText(`Đang nhập Khách hàng: ${Math.min(processed, totalImportEntries)}/${totalImportEntries}`);
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
            failures.push(`Batch khách hàng: ${message}`);
            failures.push('Đã dừng import do lỗi kết nối mạng hoặc máy chủ. Vui lòng thử lại sau khi hệ thống ổn định.');
            break;
          }

          chunk.forEach((entry) => {
            failures.push(`Dòng ${entry.rowNumber}: ${message}`);
          });
        }

        processed += chunk.length;
        setImportLoadingText(`Đang nhập Khách hàng: ${Math.min(processed, totalImportEntries)}/${totalImportEntries}`);
      }
    }

    if (createdItems.length > 0) {
      setCustomers((previous) => {
        const existing = previous || [];
        const createdIds = new Set(createdItems.map((item) => String(item.id)));
        return [...createdItems, ...existing.filter((item) => !createdIds.has(String(item.id)))];
      });
      await loadCustomersPage();
    }

    const importedCustomerCount = createdItems.length;
    summarizeImportResult('Khách hàng', importedCustomerCount, failures, addToast);
    exportImportFailureFile(payload, 'Khách hàng', failures, addToast);
    if (importedCustomerCount > 0 && failures.length === 0) {
      handleCloseModal();
    }
  }, []);

  return { handleImportCustomers };
}
