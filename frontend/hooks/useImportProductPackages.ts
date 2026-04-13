import { useCallback } from 'react';
import type { Product, ProductPackage } from '../types';
import type { ImportPayload } from '../components/modals/projectImportTypes';
import { createProductPackagesBulk, deleteProductPackage } from '../services/v5Api';
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
  normalizeStatusActive,
} from '../utils/importUtils';
import { normalizeProductUnitForSave } from '../utils/productUnit';

interface UseImportProductPackagesResult {
  handleImportProductPackages: (
    payload: ImportPayload,
    productPackages: ProductPackage[],
    products: Product[],
    addToast: (type: 'success' | 'error', title: string, message: string) => void,
    setImportLoadingText: (text: string) => void,
    refreshProductPackagesData: () => Promise<void>,
    refreshProductsData: () => Promise<void>,
    handleCloseModal: () => void
  ) => Promise<void>;
}

const PRODUCT_PACKAGE_IMPORT_ACTIVE_TOKENS = ['active', 'hoatdong', '1', 'true', 'yes', 'co'];
const PRODUCT_PACKAGE_IMPORT_INACTIVE_TOKENS = ['inactive', 'khonghoatdong', 'ngunghoatdong', '0', 'false', 'no', 'khong'];

const hasRecognizedProductPackageStatus = (rawValue: string): boolean => {
  const token = normalizeImportToken(rawValue);
  return token === '' || PRODUCT_PACKAGE_IMPORT_ACTIVE_TOKENS.includes(token) || PRODUCT_PACKAGE_IMPORT_INACTIVE_TOKENS.includes(token);
};

const normalizeImportedProductPackage = (item: Partial<ProductPackage>): ProductPackage => ({
  id: item.id ?? '',
  product_id: item.product_id ?? '',
  package_code: String(item.package_code ?? ''),
  package_name: String(item.package_name ?? ''),
  product_name: typeof item.product_name === 'string' ? item.product_name : null,
  parent_product_code: typeof item.parent_product_code === 'string' ? item.parent_product_code : null,
  service_group: typeof item.service_group === 'string' ? item.service_group : null,
  domain_id: item.domain_id ?? null,
  vendor_id: item.vendor_id ?? null,
  standard_price: Number(item.standard_price ?? 0),
  unit: normalizeProductUnitForSave(item.unit),
  description: typeof item.description === 'string' ? item.description : null,
  attachments: Array.isArray(item.attachments) ? item.attachments : [],
  is_active: item.is_active !== false,
  created_at: typeof item.created_at === 'string' ? item.created_at : null,
  created_by: item.created_by ?? null,
  updated_at: typeof item.updated_at === 'string' ? item.updated_at : null,
  updated_by: item.updated_by ?? null,
});

export function useImportProductPackages(): UseImportProductPackagesResult {
  const handleImportProductPackages = useCallback(async (
    payload: ImportPayload,
    productPackages: ProductPackage[],
    products: Product[],
    addToast: (type: 'success' | 'error', title: string, message: string) => void,
    setImportLoadingText: (text: string) => void,
    refreshProductPackagesData: () => Promise<void>,
    refreshProductsData: () => Promise<void>,
    handleCloseModal: () => void
  ) => {
    const headerIndex = buildHeaderIndex(payload.headers || []);
    const rows = payload.rows || [];

    if (rows.length === 0) {
      addToast('error', 'Nhập dữ liệu', 'File không có dòng dữ liệu hợp lệ để lưu.');
      return;
    }

    const existingPackageCodeTokens = new Set<string>();
    (productPackages || []).forEach((item) => {
      const codeToken = normalizeImportToken(item.package_code);
      if (codeToken) {
        existingPackageCodeTokens.add(codeToken);
      }
    });

    const productByLookup = new Map<string, Product>();
    (products || []).forEach((product) => {
      [product.id, product.product_code, product.product_name].forEach((candidate) => {
        const token = normalizeImportToken(candidate);
        if (token) {
          productByLookup.set(token, product);
        }
      });
    });

    const importEntries: Array<{ rowNumber: number; payload: Partial<ProductPackage> }> = [];
    const failures: string[] = [];
    const seenPackageCodeTokens = new Set<string>();

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const rowNumber = rowIndex + 2;

      const packageCode = getImportCell(row, headerIndex, [
        'magoicuoc',
        'madinhdanh',
        'mapackage',
        'packagecode',
        'packageid',
      ]);
      const packageName = getImportCell(row, headerIndex, [
        'tengoicuoc',
        'tengoidichvu',
        'packagename',
        'name',
      ]);
      const description = getImportCell(row, headerIndex, ['mota', 'motagoicuoc', 'description', 'ghichu']);
      const productCodeRaw = getImportCell(row, headerIndex, [
        'madinhdanhsanphamcha',
        'madinhdanhsanpham',
        'madinhdanh',
        'masanphamcha',
        'masanpham',
        'maproduct',
        'productcode',
        'parentproductcode',
        'productid',
      ]);
      const productNameRaw = getImportCell(row, headerIndex, [
        'tensanphamdichvu',
        'tensanpham',
        'productname',
        'parentproductname',
      ]);
      const standardPriceRaw = getImportCell(row, headerIndex, [
        'dongiatruocvat',
        'dongiatruocvatvnd',
        'dongiachuanvnd',
        'dongiachuan',
        'dongia',
        'giatieuchuan',
        'giatieuchuanvnd',
        'standardprice',
        'price',
      ]);
      const unitRaw = getImportCell(row, headerIndex, ['donvitinh', 'dvt', 'unit']);
      const statusRaw = getImportCell(row, headerIndex, ['trangthai', 'status', 'isactive']);

      if (!(packageCode || packageName || description || productCodeRaw || productNameRaw || standardPriceRaw || unitRaw || statusRaw)) {
        continue;
      }

      if (!packageCode) {
        failures.push(`Dòng ${rowNumber}: thiếu Mã gói cước.`);
        continue;
      }

      const packageCodeToken = normalizeImportToken(packageCode);
      if (!packageCodeToken) {
        failures.push(`Dòng ${rowNumber}: Mã gói cước không hợp lệ.`);
        continue;
      }
      if (existingPackageCodeTokens.has(packageCodeToken)) {
        failures.push(`Dòng ${rowNumber}: Mã gói cước "${packageCode}" đã tồn tại.`);
        continue;
      }
      if (seenPackageCodeTokens.has(packageCodeToken)) {
        failures.push(`Dòng ${rowNumber}: Mã gói cước "${packageCode}" bị trùng trong file import.`);
        continue;
      }
      seenPackageCodeTokens.add(packageCodeToken);

      if (!packageName) {
        failures.push(`Dòng ${rowNumber}: thiếu Tên gói cước.`);
        continue;
      }

      const productLookupValue = productCodeRaw || productNameRaw;
      if (!productLookupValue) {
        failures.push(`Dòng ${rowNumber}: thiếu Mã định danh sản phẩm cha hoặc Tên sản phẩm/Dịch vụ.`);
        continue;
      }

      const product = productByLookup.get(normalizeImportToken(productCodeRaw))
        ?? productByLookup.get(normalizeImportToken(productNameRaw));
      if (!product) {
        failures.push(`Dòng ${rowNumber}: không tìm thấy sản phẩm cha "${productCodeRaw || productNameRaw}".`);
        continue;
      }

      if (!hasRecognizedProductPackageStatus(statusRaw)) {
        failures.push(`Dòng ${rowNumber}: trạng thái "${statusRaw}" không hợp lệ.`);
        continue;
      }

      const standardPrice = standardPriceRaw ? normalizeImportNumber(standardPriceRaw) : 0;
      if (standardPriceRaw && standardPrice === null) {
        failures.push(`Dòng ${rowNumber}: đơn giá (trước VAT) "${standardPriceRaw}" không hợp lệ.`);
        continue;
      }

      if ((standardPrice ?? 0) < 0) {
        failures.push(`Dòng ${rowNumber}: đơn giá (trước VAT) phải lớn hơn hoặc bằng 0.`);
        continue;
      }

      importEntries.push({
        rowNumber,
        payload: {
          product_id: product.id,
          package_code: packageCode.trim(),
          package_name: packageName.trim(),
          standard_price: standardPrice ?? 0,
          unit: normalizeProductUnitForSave(unitRaw),
          description: description || '',
          is_active: normalizeStatusActive(statusRaw),
        },
      });
    }

    const createdItems: ProductPackage[] = [];
    let abortedByInfraIssue = false;
    const totalImportEntries = importEntries.length;
    let successfulItemCount = 0;

    if (totalImportEntries > 0) {
      const importBatchSize = 1000;
      const chunks: Array<{ rowNumber: number; payload: Partial<ProductPackage> }[]> = [];
      for (let start = 0; start < importEntries.length; start += importBatchSize) {
        chunks.push(importEntries.slice(start, start + importBatchSize));
      }

      let processed = 0;

      for (const chunk of chunks) {
        if (abortedByInfraIssue) {
          break;
        }

        try {
          const bulkResult = await createProductPackagesBulk(chunk.map((entry) => entry.payload));
          const rowResults = bulkResult.results || [];

          if (rowResults.length === 0) {
            chunk.forEach((entry) => {
              failures.push(`Dòng ${entry.rowNumber}: backend không trả kết quả chi tiết.`);
            });
            processed += chunk.length;
            setImportLoadingText(`Đang nhập Gói cước: ${Math.min(processed, totalImportEntries)}/${totalImportEntries}`);
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
              createdItems.push(normalizeImportedProductPackage(result.data));
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
            failures.push(`Batch gói cước: ${message}`);
            failures.push('Đã dừng import do lỗi kết nối mạng hoặc máy chủ. Vui lòng thử lại sau khi hệ thống ổn định.');
            abortedByInfraIssue = true;
            break;
          }

          chunk.forEach((entry) => {
            failures.push(`Dòng ${entry.rowNumber}: ${message}`);
          });
        }

        processed += chunk.length;
        setImportLoadingText(`Đang nhập Gói cước: ${Math.min(processed, totalImportEntries)}/${totalImportEntries}`);
      }
    }

    if (abortedByInfraIssue) {
      await rollbackImportedRows('Gói cước', createdItems, deleteProductPackage, addToast);
    } else if (successfulItemCount > 0) {
      await Promise.all([refreshProductPackagesData(), refreshProductsData()]);
    }

    const importedCount = abortedByInfraIssue ? 0 : successfulItemCount;
    summarizeImportResult('Gói cước', importedCount, failures, addToast);
    exportImportFailureFile(payload, 'Gói cước', failures, addToast);
    if (importedCount > 0 && failures.length === 0 && !abortedByInfraIssue) {
      handleCloseModal();
    }
  }, []);

  return { handleImportProductPackages };
}
