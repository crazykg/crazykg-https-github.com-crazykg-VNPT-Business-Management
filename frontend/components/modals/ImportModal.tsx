import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useEscKey } from '../../hooks/useEscKey';
import { parseImportFile, pickImportSheetByModule, type ParsedImportSheet } from '../../utils/importParser';
import { formatDateDdMmYyyy } from '../../utils/dateDisplay';
import type { ImportPayload } from './projectImportTypes';
import { ModalWrapper } from './shared';

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_DATE_REGEX = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/;
const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;
const DEFAULT_IMPORT_PREVIEW_PAGE_SIZE = 20;

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

const normalizeDateInputToIso = (value: string): string | null => {
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

const normalizeImportTokenForPreview = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const normalizeImportDatePreviewToIso = (value: unknown): string | null => {
  const text = String(value ?? '').trim();
  if (!text) {
    return null;
  }

  const normalized = normalizeDateInputToIso(text);
  if (normalized) {
    return normalized;
  }

  const numeric = Number(text);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const date = new Date(excelEpoch.getTime() + numeric * 86400000);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

  if (year < 1900 || year > 9999) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const formatImportPreviewCurrencyValue = (value: unknown): string | null => {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return null;
  }

  const compactValue = rawValue.replace(/\s+/g, '').replace(/[₫đĐ]/g, '');
  if (!compactValue) {
    return null;
  }

  const separatorMatches = compactValue.match(/[.,]/g) || [];
  let normalizedNumericText = compactValue;

  if (separatorMatches.length === 0) {
    normalizedNumericText = compactValue;
  } else if (compactValue.includes('.') && compactValue.includes(',')) {
    const lastCommaIndex = compactValue.lastIndexOf(',');
    const lastDotIndex = compactValue.lastIndexOf('.');
    const decimalSeparatorIndex = Math.max(lastCommaIndex, lastDotIndex);
    const integerPart = compactValue.slice(0, decimalSeparatorIndex).replace(/[.,]/g, '');
    const decimalPart = compactValue.slice(decimalSeparatorIndex + 1).replace(/[.,]/g, '');
    normalizedNumericText = decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
  } else {
    const separator = compactValue.includes(',') ? ',' : '.';
    const separatorIndex = compactValue.lastIndexOf(separator);
    const hasRepeatedSeparator = compactValue.indexOf(separator) !== separatorIndex;

    if (hasRepeatedSeparator) {
      normalizedNumericText = compactValue.replace(/[.,]/g, '');
    } else {
      const integerPart = compactValue.slice(0, separatorIndex).replace(/[.,]/g, '');
      const decimalPart = compactValue.slice(separatorIndex + 1).replace(/[.,]/g, '');
      normalizedNumericText =
        decimalPart.length === 3
          ? `${integerPart}${decimalPart}`
          : `${integerPart}.${decimalPart}`;
    }
  }

  const numeric = Number(normalizedNumericText);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const hasDecimal = Math.abs(numeric % 1) > 0;
  return `${numeric.toLocaleString('vi-VN', {
    minimumFractionDigits: hasDecimal ? 2 : 0,
    maximumFractionDigits: 2,
  })} đ`;
};

const formatImportPreviewCellValue = (moduleKey: string, header: string, value: unknown): string => {
  const rawValue = String(value ?? '');
  const moduleToken = normalizeImportTokenForPreview(moduleKey);
  const headerToken = normalizeImportTokenForPreview(header);

  if (moduleToken === 'employees' || moduleToken === 'internaluserlist') {
    if (!['ngaysinh', 'dateofbirth', 'dob', 'birthday'].includes(headerToken)) {
      return rawValue;
    }

    const isoDate = normalizeImportDatePreviewToIso(rawValue);
    if (!isoDate) {
      return rawValue;
    }

    const formattedDate = formatDateDdMmYyyy(isoDate);
    return formattedDate === '--' ? rawValue : formattedDate;
  }

  if (moduleToken === 'products' || moduleToken === 'product') {
    if (!['dongiachuan', 'dongiachuanvnd', 'giatieuchuan', 'giatieuchuanvnd', 'standardprice'].includes(headerToken)) {
      return rawValue;
    }

    return formatImportPreviewCurrencyValue(value) ?? rawValue;
  }

  return rawValue;
};

export interface ImportModalProps {
  title: string;
  moduleKey: string;
  onClose: () => void;
  onSave: (payload: ImportPayload) => Promise<void> | void;
  isLoading?: boolean;
  loadingText?: string;
}

export function ImportModal({
  title,
  moduleKey,
  onClose,
  onSave,
  isLoading = false,
  loadingText = '',
}: ImportModalProps) {
  const submitLockRef = useRef(false);
  useEscKey(() => {
    if (!isLoading && !submitLockRef.current) onClose();
  }, true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [payload, setPayload] = useState<ImportPayload | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(DEFAULT_IMPORT_PREVIEW_PAGE_SIZE);
  const normalizedModuleKey = String(moduleKey || '').trim().toLowerCase();
  const isProjectItemsImport = normalizedModuleKey === 'project_items' || normalizedModuleKey === 'projectitems' || normalizedModuleKey === 'projectitem';
  const isProjectRaciImport = normalizedModuleKey === 'project_raci' || normalizedModuleKey === 'projectraci' || normalizedModuleKey === 'raci';
  const isEmployeePartyImport = normalizedModuleKey === 'internal_user_party_members' || normalizedModuleKey === 'internaluserpartymembers';
  const shouldIncludeAllSheets =
    isProjectItemsImport ||
    isProjectRaciImport ||
    isEmployeePartyImport ||
    normalizedModuleKey === 'projects' ||
    normalizedModuleKey === 'project';
  const excelOnlyImport = isProjectItemsImport || isProjectRaciImport || isEmployeePartyImport;
  const fileAccept = excelOnlyImport ? '.xlsx,.xls' : '.xlsx,.xls,.xml,.csv';
  const supportFormatText = excelOnlyImport
    ? 'Hỗ trợ định dạng .xlsx, .xls (Tối đa 5MB)'
    : 'Hỗ trợ định dạng .xlsx, .xls, .xml, .csv (Tối đa 5MB)';
  const isBusy = isLoading || isParsing || isSubmitting;
  const isFileInteractionDisabled = isBusy;
  const fileInputId = `import-file-input-${normalizedModuleKey || 'default'}`;

  const totalPreviewRows = payload?.rows.length || 0;
  const totalPreviewPages = Math.max(1, Math.ceil(totalPreviewRows / previewPageSize));
  const safePreviewPage = Math.min(previewPage, totalPreviewPages);
  const previewStartIndex = (safePreviewPage - 1) * previewPageSize;
  const previewRows = useMemo(
    () => (payload?.rows || []).slice(previewStartIndex, previewStartIndex + previewPageSize),
    [payload, previewPageSize, previewStartIndex]
  );

  useEffect(() => {
    setPreviewPage(1);
  }, [payload, moduleKey]);

  useEffect(() => {
    if (previewPage > totalPreviewPages) {
      setPreviewPage(totalPreviewPages);
    }
  }, [previewPage, totalPreviewPages]);

  const handleSelectFile = async (file: File) => {
    if (!file || isBusy) return;

    setErrorMessage('');
    setPayload(null);

    const lowerFileName = String(file.name || '').toLowerCase();
    if (excelOnlyImport && !lowerFileName.endsWith('.xlsx') && !lowerFileName.endsWith('.xls')) {
      setErrorMessage('File nhập chỉ hỗ trợ định dạng Excel (.xlsx, .xls).');
      return;
    }

    if (file.size > MAX_IMPORT_FILE_SIZE) {
      setErrorMessage('File vượt quá 5MB. Vui lòng chọn file nhỏ hơn.');
      return;
    }

    setIsParsing(true);
    try {
      const parsedFile = await parseImportFile(file);
      const selectedSheet = pickImportSheetByModule(moduleKey, parsedFile);

      if (!selectedSheet || selectedSheet.headers.length === 0) {
        setErrorMessage('Không tìm thấy dữ liệu hợp lệ trong file đã chọn.');
        return;
      }

      const normalizedRows = (selectedSheet.rows || []).filter((row) =>
        row.some((cell) => String(cell || '').trim().length > 0)
      );

      setPayload({
        moduleKey,
        fileName: parsedFile.fileName,
        sheetName: selectedSheet.name,
        headers: selectedSheet.headers,
        rows: normalizedRows,
        sheets: shouldIncludeAllSheets
          ? (parsedFile.sheets || []).map((sheet: ParsedImportSheet) => ({
              name: sheet.name,
              headers: sheet.headers || [],
              rows: (sheet.rows || []).filter((row) =>
                row.some((cell) => String(cell || '').trim().length > 0)
              ),
            }))
          : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể đọc file import.';
      setErrorMessage(message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await handleSelectFile(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      await handleSelectFile(file);
    }
  };

  const handleConfirmImport = async () => {
    if (!payload || isParsing || isLoading || submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      await onSave(payload);
    } catch {
      // Parent handles user-facing errors.
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const blockClose = isBusy;

  return (
    <ModalWrapper onClose={onClose} title={title} icon="upload_file" width="max-w-4xl" disableClose={blockClose}>
      <div className="p-6 space-y-4">
        <label
          htmlFor={fileInputId}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
            isDragOver ? 'border-primary bg-slate-50' : 'border-slate-300 hover:border-primary hover:bg-slate-50'
          }`}
          aria-disabled={isFileInteractionDisabled}
          onClick={(event) => {
            if (isFileInteractionDisabled) {
              event.preventDefault();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!isFileInteractionDisabled) {
              setIsDragOver(true);
            }
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!isFileInteractionDisabled) {
              setIsDragOver(true);
            }
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragOver(false);
          }}
          onDrop={handleDrop}
        >
          {isParsing ? (
            <>
              <span className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin mb-3"></span>
              <p className="text-sm font-semibold text-slate-900">Đang đọc file...</p>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">cloud_upload</span>
              <p className="text-sm font-medium text-slate-900">Kéo thả file vào đây hoặc click để chọn file</p>
              <p className="text-xs text-slate-500 mt-1">{supportFormatText}</p>
            </>
          )}
        </label>

        <input
          ref={fileInputRef}
          id={fileInputId}
          type="file"
          className="sr-only"
          accept={fileAccept}
          onChange={handleInputChange}
          disabled={isFileInteractionDisabled}
        />

        {errorMessage ? (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 p-3 rounded-lg border border-red-100">
            <span className="material-symbols-outlined text-red-600 text-base">error</span>
            <p>{errorMessage}</p>
          </div>
        ) : null}

        {payload ? (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{payload.fileName}</p>
                <p className="text-xs text-slate-500">
                  Sheet: {payload.sheetName} | Số dòng dữ liệu: {payload.rows.length}
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isFileInteractionDisabled}
                className="px-3 py-1.5 rounded-md border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-white transition-colors disabled:opacity-50"
              >
                Chọn file khác
              </button>
            </div>
            <div className="overflow-x-auto max-h-72 custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10">
                  <tr>
                    <th className="px-3 py-2 text-xs font-bold text-slate-600 uppercase w-16">#</th>
                    {payload.headers.map((header) => (
                      <th key={header} className="px-3 py-2 text-xs font-bold text-slate-600 uppercase whitespace-nowrap">
                        {header || '--'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rowIndex) => (
                    <tr key={`preview-row-${rowIndex}`} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-3 py-2 text-xs text-slate-400">{previewStartIndex + rowIndex + 2}</td>
                      {payload.headers.map((_, colIndex) => (
                        <td key={`preview-cell-${rowIndex}-${colIndex}`} className="px-3 py-2 text-sm text-slate-700 whitespace-nowrap">
                          {formatImportPreviewCellValue(moduleKey, payload.headers[colIndex] || '', row[colIndex] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 text-xs text-slate-500 bg-white border-t border-slate-100 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                {totalPreviewRows > 0 ? (
                  <>Đang xem {previewStartIndex + 1}-{previewStartIndex + previewRows.length}/{totalPreviewRows} dòng dữ liệu.</>
                ) : (
                  <>Không có dòng dữ liệu hợp lệ để xem trước.</>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-slate-500">
                  Hiển thị
                  <span className="relative ml-1 inline-block w-[108px] align-middle">
                    <select
                      value={previewPageSize}
                      disabled={isBusy || totalPreviewRows === 0}
                      onChange={(event) => {
                        setPreviewPageSize(Number(event.target.value) || DEFAULT_IMPORT_PREVIEW_PAGE_SIZE);
                        setPreviewPage(1);
                      }}
                      className="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-9 text-sm font-medium text-slate-700 outline-none transition-colors hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span className="pointer-events-none material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
                      expand_more
                    </span>
                  </span>
                </label>
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setPreviewPage((prev) => Math.max(1, prev - 1))}
                  disabled={isBusy || safePreviewPage <= 1 || totalPreviewRows === 0}
                >
                  Trước
                </button>
                <span className="min-w-20 text-center">Trang {safePreviewPage}/{totalPreviewPages}</span>
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setPreviewPage((prev) => Math.min(totalPreviewPages, prev + 1))}
                  disabled={isBusy || safePreviewPage >= totalPreviewPages || totalPreviewRows === 0}
                >
                  Sau
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2 text-sm text-slate-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
          <span className="material-symbols-outlined text-blue-600">info</span>
          <p>
            {isEmployeePartyImport
              ? 'Workbook nhập Đảng viên nên gồm sheet DangVien và sheet NhanSu tham chiếu; sheet DangVien bắt buộc có cột Mã NV.'
              : 'Vui lòng tải file mẫu để đảm bảo định dạng dữ liệu đúng trước khi import.'}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button
          onClick={() => !blockClose && onClose()}
          disabled={blockClose}
          className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Hủy
        </button>
        <button
          onClick={handleConfirmImport}
          disabled={!payload || isBusy}
          className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-deep-teal shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isBusy ? (loadingText || 'Đang nhập...') : 'Lưu dữ liệu'}
        </button>
      </div>
    </ModalWrapper>
  );
}
