import { useCallback } from 'react';
import type { Business, Product, Vendor } from '../types';
import type { ImportPayload } from '../components/modals/projectImportTypes';
import { createProductsBulk, deleteProduct } from '../services/v5Api';
import {
  buildHeaderIndex,
  exportImportFailureFile,
  getImportCell,
  rollbackImportedRows,
  summarizeImportResult,
} from '../utils/importValidation';
import {
  isImportInfrastructureError,
  normalizeImportNumber,
  normalizeImportToken,
  normalizeProductRecord,
  normalizeStatusActive,
} from '../utils/importUtils';
import { normalizeProductUnitForSave } from '../utils/productUnit';
import {
  DEFAULT_PRODUCT_SERVICE_GROUP,
  resolveProductServiceGroupImportValue,
} from '../utils/productServiceGroup';

interface UseImportProductsResult {
  handleImportProducts: (
    payload: ImportPayload,
    products: Product[],
    businesses: Business[],
    vendors: Vendor[],
    addToast: (type: 'success' | 'error', title: string, message: string) => void,
    setImportLoadingText: (text: string) => void,
    refreshProductsData: () => Promise<void>,
    handleCloseModal: () => void
  ) => Promise<void>;
}

const PRODUCT_IMPORT_ACTIVE_TOKENS = ['active', 'hoatdong', '1', 'true', 'yes', 'co'];
const PRODUCT_IMPORT_INACTIVE_TOKENS = ['inactive', 'khonghoatdong', 'ngunghoatdong', '0', 'false', 'no', 'khong'];

const hasRecognizedProductStatus = (rawValue: string): boolean => {
  const token = normalizeImportToken(rawValue);
  return token === '' || PRODUCT_IMPORT_ACTIVE_TOKENS.includes(token) || PRODUCT_IMPORT_INACTIVE_TOKENS.includes(token);
};

export function useImportProducts(): UseImportProductsResult {
  const handleImportProducts = useCallback(async (
    payload: ImportPayload,
    products: Product[],
    businesses: Business[],
    vendors: Vendor[],
    addToast: (type: 'success' | 'error', title: string, message: string) => void,
    setImportLoadingText: (text: string) => void,
    refreshProductsData: () => Promise<void>,
    handleCloseModal: () => void
  ) => {
    const headerIndex = buildHeaderIndex(payload.headers || []);
    const rows = payload.rows || [];

    if (rows.length === 0) {
      addToast('error', 'Nhập dữ liệu', 'File không có dòng dữ liệu hợp lệ để lưu.');
      return;
    }

    const existingProductCodeTokens = new Set<string>();
    (products || []).forEach((product) => {
      const codeToken = normalizeImportToken(product.product_code);
      if (codeToken) {
        existingProductCodeTokens.add(codeToken);
      }
    });

    const businessByLookup = new Map<string, Business>();
    (businesses || []).forEach((business) => {
      const candidateTokens = [
        business.id,
        business.domain_code,
        business.domain_name,
      ];
      candidateTokens.forEach((candidate) => {
        const token = normalizeImportToken(candidate);
        if (token) {
          businessByLookup.set(token, business);
        }
      });
    });

    const vendorByLookup = new Map<string, Vendor>();
    (vendors || []).forEach((vendor) => {
      const candidateTokens = [
        vendor.id,
        vendor.vendor_code,
        vendor.vendor_name,
      ];
      candidateTokens.forEach((candidate) => {
        const token = normalizeImportToken(candidate);
        if (token) {
          vendorByLookup.set(token, vendor);
        }
      });
    });

    const importEntries: Array<{ rowNumber: number; payload: Partial<Product> }> = [];
    const failures: string[] = [];
    const seenProductCodeTokens = new Set<string>();

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const rowNumber = rowIndex + 2;

      const serviceGroupRaw = getImportCell(row, headerIndex, ['manhom', 'nhomdichvu', 'servicegroup', 'groupcode', 'magroup']);
      const productCode = getImportCell(row, headerIndex, ['masanpham', 'masp', 'productcode', 'code']);
      const productName = getImportCell(row, headerIndex, ['tensanpham', 'tensp', 'productname', 'name']);
      const packageName = getImportCell(row, headerIndex, ['goicuoc', 'package', 'packagename', 'goi']);
      const businessLookupRaw = getImportCell(row, headerIndex, ['malinhvuc', 'linhvuc', 'businesscode', 'domaincode', 'mald', 'domainid']);
      const vendorLookupRaw = getImportCell(row, headerIndex, ['manhacungcap', 'nhacungcap', 'vendorcode', 'suppliercode', 'mancc', 'vendorid']);
      const standardPriceRaw = getImportCell(row, headerIndex, ['dongiachuan', 'dongiachuanvnd', 'giatieuchuan', 'giatieuchuanvnd', 'standardprice', 'price']);
      const unitRaw = getImportCell(row, headerIndex, ['donvitinh', 'unit']);
      const statusRaw = getImportCell(row, headerIndex, ['trangthai', 'status', 'isactive']);
      const description = getImportCell(row, headerIndex, ['motagoicuoc', 'mota', 'description', 'ghichu']);

      if (!(serviceGroupRaw || productCode || productName || packageName || businessLookupRaw || vendorLookupRaw || standardPriceRaw || unitRaw || statusRaw || description)) {
        continue;
      }

      if (!productCode) {
        failures.push(`Dòng ${rowNumber}: thiếu Mã sản phẩm.`);
        continue;
      }

      const productCodeToken = normalizeImportToken(productCode);
      if (!productCodeToken) {
        failures.push(`Dòng ${rowNumber}: Mã sản phẩm không hợp lệ.`);
        continue;
      }

      if (existingProductCodeTokens.has(productCodeToken)) {
        failures.push(`Dòng ${rowNumber}: Mã sản phẩm "${productCode}" đã tồn tại.`);
        continue;
      }

      if (seenProductCodeTokens.has(productCodeToken)) {
        failures.push(`Dòng ${rowNumber}: Mã sản phẩm "${productCode}" bị trùng trong file import.`);
        continue;
      }
      seenProductCodeTokens.add(productCodeToken);

      if (!productName) {
        failures.push(`Dòng ${rowNumber}: thiếu Tên sản phẩm.`);
        continue;
      }

      const serviceGroup = resolveProductServiceGroupImportValue(serviceGroupRaw);
      if (serviceGroup === null) {
        failures.push(`Dòng ${rowNumber}: nhóm dịch vụ "${serviceGroupRaw}" không hợp lệ.`);
        continue;
      }

      const business = businessByLookup.get(normalizeImportToken(businessLookupRaw));
      if (!business) {
        failures.push(`Dòng ${rowNumber}: không tìm thấy lĩnh vực "${businessLookupRaw}".`);
        continue;
      }

      const vendor = vendorByLookup.get(normalizeImportToken(vendorLookupRaw));
      if (!vendor) {
        failures.push(`Dòng ${rowNumber}: không tìm thấy nhà cung cấp "${vendorLookupRaw}".`);
        continue;
      }

      if (!hasRecognizedProductStatus(statusRaw)) {
        failures.push(`Dòng ${rowNumber}: trạng thái "${statusRaw}" không hợp lệ.`);
        continue;
      }

      const standardPrice = standardPriceRaw ? normalizeImportNumber(standardPriceRaw) : 0;
      if (standardPriceRaw && standardPrice === null) {
        failures.push(`Dòng ${rowNumber}: đơn giá chuẩn "${standardPriceRaw}" không hợp lệ.`);
        continue;
      }

      if ((standardPrice ?? 0) < 0) {
        failures.push(`Dòng ${rowNumber}: đơn giá chuẩn phải lớn hơn hoặc bằng 0.`);
        continue;
      }

      importEntries.push({
        rowNumber,
        payload: {
          service_group: serviceGroup ?? DEFAULT_PRODUCT_SERVICE_GROUP,
          product_code: productCode.trim(),
          product_name: productName.trim(),
          package_name: packageName || '',
          domain_id: business.id,
          vendor_id: vendor.id,
          standard_price: standardPrice ?? 0,
          unit: normalizeProductUnitForSave(unitRaw),
          description: description || '',
          is_active: normalizeStatusActive(statusRaw),
        },
      });
    }

    const createdItems: Product[] = [];
    let abortedByInfraIssue = false;

    const totalImportEntries = importEntries.length;
    let successfulItemCount = 0;

    if (totalImportEntries > 0) {
      const importBatchSize = 1000;
      const chunks: Array<{ rowNumber: number; payload: Partial<Product> }[]> = [];
      for (let start = 0; start < importEntries.length; start += importBatchSize) {
        chunks.push(importEntries.slice(start, start + importBatchSize));
      }

      let processed = 0;

      for (const chunk of chunks) {
        if (abortedByInfraIssue) {
          break;
        }

        try {
          const bulkResult = await createProductsBulk(chunk.map((entry) => entry.payload));
          const rowResults = bulkResult.results || [];

          if (rowResults.length === 0) {
            chunk.forEach((entry) => {
              failures.push(`Dòng ${entry.rowNumber}: backend không trả kết quả chi tiết.`);
            });
            processed += chunk.length;
            setImportLoadingText(`Đang nhập Sản phẩm: ${Math.min(processed, totalImportEntries)}/${totalImportEntries}`);
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
              createdItems.push(normalizeProductRecord(result.data));
              successfulItemCount += 1;
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
            failures.push(`Batch sản phẩm: ${message}`);
            failures.push('Đã dừng import do lỗi kết nối mạng hoặc máy chủ. Vui lòng thử lại sau khi hệ thống ổn định.');
            abortedByInfraIssue = true;
            break;
          }

          chunk.forEach((entry) => {
            failures.push(`Dòng ${entry.rowNumber}: ${message}`);
          });
        }

        processed += chunk.length;
        setImportLoadingText(`Đang nhập Sản phẩm: ${Math.min(processed, totalImportEntries)}/${totalImportEntries}`);
      }
    }

    if (abortedByInfraIssue) {
      await rollbackImportedRows('Sản phẩm', createdItems, deleteProduct, addToast);
    } else if (successfulItemCount > 0) {
      await refreshProductsData();
    }

    const importedProductCount = abortedByInfraIssue ? 0 : successfulItemCount;
    summarizeImportResult('Sản phẩm', importedProductCount, failures, addToast);
    exportImportFailureFile(payload, 'Sản phẩm', failures, addToast);
    if (importedProductCount > 0 && failures.length === 0 && !abortedByInfraIssue) {
      handleCloseModal();
    }
  }, []);

  return { handleImportProducts };
}
