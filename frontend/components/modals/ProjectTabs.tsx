import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RACI_ROLES } from '../../constants';
import { useEscKey } from '../../hooks/useEscKey';
import type { Department, Employee, Project, ProjectItem, ProjectRACI } from '../../types';
import { SearchableSelect, type SearchableSelectOption } from './selectPrimitives';
import { resolveProjectItemCatalogValue } from './projectImportUtils';

const PROJECT_ITEM_SELECT_TRIGGER_CLASS_NAME =
  'border-slate-300 bg-white text-slate-900 text-xs leading-5 shadow-sm focus:ring-1 focus:ring-primary/30';
const PROJECT_ITEM_INPUT_CLASS_NAME =
  'h-8 w-full rounded-md border border-slate-300 bg-white px-3 text-xs leading-5 text-slate-900 shadow-sm transition-all focus:border-primary focus:ring-1 focus:ring-primary/30';
const PROJECT_ITEM_CENTER_INPUT_CLASS_NAME = `${PROJECT_ITEM_INPUT_CLASS_NAME} text-center`;
const PROJECT_ITEM_RIGHT_INPUT_CLASS_NAME = `${PROJECT_ITEM_INPUT_CLASS_NAME} text-right`;
const PROJECT_ITEM_READONLY_BOX_CLASS_NAME =
  'flex h-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-center text-xs font-medium leading-5 text-slate-600';
const PROJECT_RACI_CONTROL_TRIGGER_CLASS_NAME =
  'border-slate-300 bg-white text-slate-900 shadow-sm focus:ring-1 focus:ring-primary/30';
const PROJECT_RACI_DATE_INPUT_CLASS_NAME =
  'h-8 w-full rounded border border-slate-300 bg-white px-3 text-center text-xs leading-5 text-slate-900 shadow-sm outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30';
const PROJECT_RACI_READONLY_BOX_CLASS_NAME =
  'flex h-8 w-full items-center rounded border border-slate-200 bg-slate-50 px-3 text-xs font-medium leading-5 text-slate-700';
const PROJECT_ITEM_FIELD_ORDER = [
  'catalog',
  'quantity',
  'unitPrice',
] as const;

type ProjectItemField = (typeof PROJECT_ITEM_FIELD_ORDER)[number];

export interface ProjectImportSummary {
  success: number;
  failed: number;
  warnings: string[];
  errors: string[];
}

interface ProjectItemsTabProps {
  duplicateItemIds: Set<string>;
  errors: Record<string, string>;
  formData: Partial<Project>;
  formatCurrency: (value: number) => string;
  formatNumber: (num: number | string | undefined | null) => string;
  handleAddItem: () => string | null;
  handleCopyItem: (itemId: string) => string | null;
  handleDownloadProjectItemTemplate: () => void;
  handleItemBlur: (itemId: string, field: keyof ProjectItem) => void;
  handleRemoveItem: (itemId: string) => void;
  handleUpdateItem: (itemId: string, field: keyof ProjectItem, value: any) => void;
  isEditingLocked: boolean;
  isItemImportSaving: boolean;
  isProjectProductOptionsLoading: boolean;
  itemImportMenuRef: React.RefObject<HTMLDivElement | null>;
  itemImportSummary: ProjectImportSummary | null;
  itemSummary: {
    baseTotal: number;
    discountTotal: number;
    lineTotal: number;
  };
  parseNumber: (str: string | number) => number;
  projectItemCatalogMetaByValue: Map<
    string,
    {
      code: string;
      name: string;
      description?: string | null;
      unit?: string | null;
      standardPrice: number;
    }
  >;
  projectProductDropdownHeader: React.ReactNode;
  projectProductSelectOptions: SearchableSelectOption[];
  renderProjectProductOption: (
    option: SearchableSelectOption,
    state: { isSelected: boolean; isHighlighted: boolean }
  ) => React.ReactNode;
  lockMessage?: string | null;
  showItemImportMenu: boolean;
  toggleItemImportMenu: () => void;
  triggerProjectItemImport: () => void;
  onOpenQuotationPicker: () => void;
}

export const ProjectItemsTab: React.FC<ProjectItemsTabProps> = ({
  duplicateItemIds,
  errors,
  formData,
  formatCurrency,
  formatNumber,
  handleAddItem,
  handleCopyItem,
  handleDownloadProjectItemTemplate,
  handleItemBlur,
  handleRemoveItem,
  handleUpdateItem,
  isEditingLocked,
  isItemImportSaving,
  isProjectProductOptionsLoading,
  itemImportMenuRef,
  itemImportSummary,
  itemSummary,
  parseNumber,
  projectItemCatalogMetaByValue,
  projectProductDropdownHeader,
  projectProductSelectOptions,
  renderProjectProductOption,
  lockMessage,
  showItemImportMenu,
  toggleItemImportMenu,
  triggerProjectItemImport,
  onOpenQuotationPicker,
}) => {
  const itemFieldRefs = useRef<Record<string, HTMLElement | null>>({});
  const [pendingFocusTarget, setPendingFocusTarget] = useState<{
    rowId: string;
    field: ProjectItemField;
  } | null>(null);

  const buildItemFieldRefKey = useCallback(
    (rowId: string, field: ProjectItemField): string => `${rowId}:${field}`,
    []
  );
  const setItemFieldRef = useCallback(
    (rowId: string, field: ProjectItemField) => (node: HTMLElement | null) => {
      const key = buildItemFieldRefKey(rowId, field);
      if (node) {
        itemFieldRefs.current[key] = node;
        return;
      }

      delete itemFieldRefs.current[key];
    },
    [buildItemFieldRefKey]
  );
  const focusItemField = useCallback(
    (rowId: string, field: ProjectItemField) => {
      const key = buildItemFieldRefKey(rowId, field);
      itemFieldRefs.current[key]?.focus();
      window.requestAnimationFrame(() => {
        itemFieldRefs.current[key]?.focus();
        window.requestAnimationFrame(() => {
          itemFieldRefs.current[key]?.focus();
        });
      });
    },
    [buildItemFieldRefKey]
  );

  useEffect(() => {
    if (!pendingFocusTarget) {
      return;
    }

    const key = buildItemFieldRefKey(pendingFocusTarget.rowId, pendingFocusTarget.field);
    if (!itemFieldRefs.current[key]) {
      return;
    }

    focusItemField(pendingFocusTarget.rowId, pendingFocusTarget.field);
    setPendingFocusTarget(null);
  }, [buildItemFieldRefKey, focusItemField, formData.items, pendingFocusTarget]);

  const focusNextItemCatalogField = useCallback(
    (rowIndex: number) => {
      const nextRow = formData.items?.[rowIndex + 1];
      if (nextRow) {
        focusItemField(nextRow.id, 'catalog');
        return;
      }

      const nextRowId = handleAddItem();
      if (nextRowId) {
        setPendingFocusTarget({ rowId: nextRowId, field: 'catalog' });
      }
    },
    [focusItemField, formData.items, handleAddItem]
  );
  const focusNextItemField = useCallback(
    (rowIndex: number, field: ProjectItemField) => {
      const currentFieldIndex = PROJECT_ITEM_FIELD_ORDER.indexOf(field);
      if (currentFieldIndex < 0) {
        return;
      }

      if (currentFieldIndex === PROJECT_ITEM_FIELD_ORDER.length - 1) {
        focusNextItemCatalogField(rowIndex);
        return;
      }

      const currentRow = formData.items?.[rowIndex];
      const nextField = PROJECT_ITEM_FIELD_ORDER[currentFieldIndex + 1];
      if (!currentRow || !nextField) {
        return;
      }

      focusItemField(currentRow.id, nextField);
    },
    [focusItemField, focusNextItemCatalogField, formData.items]
  );
  const handleItemFieldEnter = useCallback(
    (
      event: React.KeyboardEvent<HTMLElement>,
      rowIndex: number,
      field: ProjectItemField
    ) => {
      if (
        event.key !== 'Enter' ||
        event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      const nativeEvent = event.nativeEvent as KeyboardEvent | undefined;
      if (nativeEvent?.isComposing) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      focusNextItemField(rowIndex, field);
    },
    [focusNextItemField]
  );
  const handleAddItemAndFocus = useCallback(() => {
    if (isEditingLocked) {
      return;
    }
    const newItemId = handleAddItem();
    if (newItemId) {
      setPendingFocusTarget({ rowId: newItemId, field: 'catalog' });
    }
  }, [handleAddItem, isEditingLocked]);
  const handleCopyItemAndFocus = useCallback(
    (itemId: string) => {
      if (isEditingLocked) {
        return;
      }
      const newItemId = handleCopyItem(itemId);
      if (newItemId) {
        setPendingFocusTarget({ rowId: newItemId, field: 'catalog' });
      }
    },
    [handleCopyItem, isEditingLocked]
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-bold text-slate-700">Danh sách hạng mục dự án</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenQuotationPicker}
            disabled={isEditingLocked}
            className="text-xs flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-50 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-sm text-primary">receipt_long</span>
            Lấy từ Báo giá
          </button>
          <div className="relative" ref={itemImportMenuRef}>
            <button
              type="button"
              onClick={toggleItemImportMenu}
              disabled={isItemImportSaving || isEditingLocked}
              className="text-xs flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-50 font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">upload</span>
              {isItemImportSaving ? 'Đang nhập...' : 'Nhập'}
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>
            {showItemImportMenu && !isEditingLocked && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-slate-200 rounded-lg shadow-xl z-[120] overflow-hidden">
                <button
                  type="button"
                  onClick={triggerProjectItemImport}
                  disabled={isItemImportSaving}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-sm">upload_file</span>
                  Nhập dữ liệu
                </button>
                <button
                  type="button"
                  onClick={handleDownloadProjectItemTemplate}
                  disabled={isItemImportSaving}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors border-t border-slate-100 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Tải file mẫu
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleAddItemAndFocus}
            disabled={isEditingLocked}
            className="text-xs flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-100 font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-sm">add</span> Thêm hạng mục
          </button>
        </div>
      </div>

      {isEditingLocked && lockMessage ? (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          {lockMessage}
        </div>
      ) : null}

      {itemImportSummary && (
        <div className="space-y-2">
          <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
            Đã nhập {itemImportSummary.success} dòng, lỗi {itemImportSummary.failed} dòng.
          </div>
          {itemImportSummary.warnings.length > 0 && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {itemImportSummary.warnings.slice(0, 3).map((warning, index) => (
                <p key={`${warning}-${index}`}>{warning}</p>
              ))}
              {itemImportSummary.warnings.length > 3 && (
                <p>... còn {itemImportSummary.warnings.length - 3} cảnh báo.</p>
              )}
            </div>
          )}
          {itemImportSummary.errors.length > 0 && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {itemImportSummary.errors.slice(0, 5).map((error, index) => (
                <p key={`${error}-${index}`}>{error}</p>
              ))}
              {itemImportSummary.errors.length > 5 && (
                <p>... còn {itemImportSummary.errors.length - 5} lỗi.</p>
              )}
            </div>
          )}
        </div>
      )}

      {errors.items && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {errors.items}
        </div>
      )}
      {duplicateItemIds.size > 0 && !errors.items && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Có hạng mục đang bị trùng trong cùng dự án. Hệ thống chỉ cảnh báo để bạn kiểm tra lại,
          nhưng vẫn cho phép cập nhật dự án.
        </div>
      )}

      <div className="border border-slate-200 rounded-lg bg-slate-50 p-4 overflow-visible">
        <table className="w-full table-fixed text-left bg-white rounded-lg shadow-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[44%]">Hạng mục</th>
              <th className="px-2 py-3 text-xs font-bold text-slate-500 uppercase w-[12%] text-center whitespace-nowrap">Đơn vị tính</th>
              <th className="px-2 py-3 text-xs font-bold text-slate-500 uppercase w-[8%] text-center whitespace-nowrap">SL</th>
              <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[16%] text-right whitespace-nowrap">Đơn giá</th>
              <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[12%] text-right whitespace-nowrap">Thành tiền</th>
              <th className="px-2 py-3 text-xs font-bold text-slate-500 uppercase w-[8%] text-center whitespace-nowrap">Tác vụ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {formData.items && formData.items.length > 0 ? (
              formData.items.map((item, index) => {
                const selectedCatalogItem = projectItemCatalogMetaByValue.get(
                  resolveProjectItemCatalogValue(item)
                );
                const isDuplicateItem = duplicateItemIds.has(item.id);
                const duplicateFieldClassName = isDuplicateItem
                  ? 'border-rose-300 ring-1 ring-rose-200'
                  : '';

                return (
                  <tr
                    key={item.id}
                    className={`align-middle hover:bg-slate-50 ${isDuplicateItem ? 'bg-rose-50/70' : ''}`}
                  >
                    <td className="px-2 py-1.5">
                      <SearchableSelect
                        size="sm"
                        value={resolveProjectItemCatalogValue(item)}
                        options={projectProductSelectOptions}
                        placeholder="Chọn hạng mục"
                        onChange={(value) => handleUpdateItem(item.id, 'catalogValue', value)}
                        disabled={isProjectProductOptionsLoading || isEditingLocked}
                        triggerButtonRef={setItemFieldRef(item.id, 'catalog')}
                        onTriggerKeyDown={(event) => handleItemFieldEnter(event, index, 'catalog')}
                        triggerClassName={`w-full ${PROJECT_ITEM_SELECT_TRIGGER_CLASS_NAME} ${duplicateFieldClassName}`}
                        dropdownClassName="min-w-[760px] max-w-[920px]"
                        renderOptionContent={renderProjectProductOption}
                        renderDropdownHeader={projectProductDropdownHeader}
                        usePortal
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className={PROJECT_ITEM_READONLY_BOX_CLASS_NAME}>
                        <span className="line-clamp-2">{selectedCatalogItem?.unit || '—'}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        ref={setItemFieldRef(item.id, 'quantity')}
                        aria-label={`Số lượng hạng mục dòng ${index + 1}`}
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={isEditingLocked}
                        className={`${PROJECT_ITEM_CENTER_INPUT_CLASS_NAME} ${duplicateFieldClassName}`}
                        value={item.quantity === 0 ? '' : item.quantity}
                        onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        onKeyDown={(event) => handleItemFieldEnter(event, index, 'quantity')}
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        ref={setItemFieldRef(item.id, 'unitPrice')}
                        aria-label={`Đơn giá hạng mục dòng ${index + 1}`}
                        type="text"
                        disabled={isEditingLocked}
                        className={`${PROJECT_ITEM_RIGHT_INPUT_CLASS_NAME} pr-4 ${duplicateFieldClassName}`}
                        value={formatNumber(item.unitPrice)}
                        onChange={(e) => handleUpdateItem(item.id, 'unitPrice', parseNumber(e.target.value))}
                        onKeyDown={(event) => handleItemFieldEnter(event, index, 'unitPrice')}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right text-sm font-bold text-slate-900 whitespace-nowrap align-middle">
                      {formatCurrency(item.lineTotal || 0)}
                    </td>
                    <td className="px-2 py-1.5 text-center align-middle">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleCopyItemAndFocus(item.id)}
                          disabled={isEditingLocked}
                          className="text-slate-400 hover:text-primary transition-colors p-1 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Sao chép hạng mục"
                          aria-label={`Sao chép hạng mục dòng ${index + 1}`}
                        >
                          <span className="material-symbols-outlined text-lg">content_copy</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={isEditingLocked}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Xóa hạng mục"
                          aria-label={`Xóa hạng mục dòng ${index + 1}`}
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">Chưa có hạng mục nào.</td>
              </tr>
            )}
          </tbody>
          {formData.items && formData.items.length > 0 && (
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-sm font-bold text-slate-700 text-right">Tổng cộng:</td>
                <td className="px-4 py-3 text-sm font-bold text-primary text-right whitespace-nowrap">
                  {formatCurrency(itemSummary.lineTotal)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

interface ProjectRaciTabProps {
  employees: Employee[];
  employeeOptions: SearchableSelectOption[];
  formData: Partial<Project>;
  existingAccountableLabel: string;
  handleAddRACI: () => void;
  handleCopyRACI: (raciId: string) => void;
  handleDownloadProjectRaciTemplate: () => void;
  handleRaciAssignedDateBlur: (raciId: string) => void;
  handleRemoveRACI: (raciId: string) => void;
  handleUpdateRACI: (raciId: string, field: keyof ProjectRACI, value: any) => void;
  duplicateRaciIds: Set<string>;
  isDepartmentsLoading: boolean;
  isProjectEmployeeOptionsLoading: boolean;
  isRaciImportSaving: boolean;
  onCancelAccountableReplacement: () => void;
  onConfirmAccountableReplacement: () => void;
  raciImportMenuRef: React.RefObject<HTMLDivElement | null>;
  raciImportSummary: ProjectImportSummary | null;
  resolveEmployeeDepartment: (employee: Partial<Employee> | null | undefined) => Department | null;
  showAccountableConfirm: boolean;
  showRaciImportMenu: boolean;
  toggleRaciImportMenu: () => void;
  triggerProjectRaciImport: () => void;
}

export const ProjectRaciTab: React.FC<ProjectRaciTabProps> = ({
  employees,
  employeeOptions,
  formData,
  existingAccountableLabel,
  handleAddRACI,
  handleCopyRACI,
  handleDownloadProjectRaciTemplate,
  handleRaciAssignedDateBlur,
  handleRemoveRACI,
  handleUpdateRACI,
  duplicateRaciIds,
  isDepartmentsLoading,
  isProjectEmployeeOptionsLoading,
  isRaciImportSaving,
  onCancelAccountableReplacement,
  onConfirmAccountableReplacement,
  raciImportMenuRef,
  raciImportSummary,
  resolveEmployeeDepartment,
  showAccountableConfirm,
  showRaciImportMenu,
  toggleRaciImportMenu,
  triggerProjectRaciImport,
}) => {
  const dismissAccountableConfirm = useCallback(() => {
    onCancelAccountableReplacement();
  }, [onCancelAccountableReplacement]);

  useEscKey(() => {
    if (showAccountableConfirm) {
      dismissAccountableConfirm();
    }
  }, showAccountableConfirm);

  return (
    <div className="space-y-3">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Đội ngũ dự án (RACI)
          {formData.raci && formData.raci.length > 0 && (
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 normal-case tracking-normal">
              {formData.raci.length} thành viên
            </span>
          )}
        </h3>
        <div className="flex items-center gap-1.5">
          {/* Import dropdown */}
          <div className="relative" ref={raciImportMenuRef}>
            <button
              type="button"
              onClick={toggleRaciImportMenu}
              disabled={isRaciImportSaving}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>upload</span>
              {isRaciImportSaving ? 'Đang nhập...' : 'Nhập'}
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>expand_more</span>
            </button>
            {showRaciImportMenu && (
              <div className="absolute right-0 top-full z-[120] mt-1.5 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                <button
                  type="button"
                  onClick={triggerProjectRaciImport}
                  disabled={isRaciImportSaving}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>upload_file</span>
                  Nhập dữ liệu
                </button>
                <button
                  type="button"
                  onClick={handleDownloadProjectRaciTemplate}
                  disabled={isRaciImportSaving}
                  className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span>
                  Tải file mẫu
                </button>
              </div>
            )}
          </div>
          {/* Add button — primary CTA */}
          <button
            type="button"
            onClick={handleAddRACI}
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded bg-primary text-white hover:bg-deep-teal shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>person_add</span>
            Thêm nhân sự
          </button>
        </div>
      </div>

      {/* ── Import summary ── */}
      {raciImportSummary && (
        <div className="space-y-1.5">
          <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
            Đã nhập {raciImportSummary.success} dòng, lỗi {raciImportSummary.failed} dòng.
          </div>
          {raciImportSummary.warnings.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
              {raciImportSummary.warnings.slice(0, 3).map((warning, index) => (
                <p key={`${warning}-${index}`}>{warning}</p>
              ))}
              {raciImportSummary.warnings.length > 3 && (
                <p>... còn {raciImportSummary.warnings.length - 3} cảnh báo.</p>
              )}
            </div>
          )}
          {raciImportSummary.errors.length > 0 && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
              {raciImportSummary.errors.slice(0, 5).map((error, index) => (
                <p key={`${error}-${index}`}>{error}</p>
              ))}
              {raciImportSummary.errors.length > 5 && (
                <p>... còn {raciImportSummary.errors.length - 5} lỗi.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Loading notice ── */}
      {(isProjectEmployeeOptionsLoading || employees.length === 0) && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {isProjectEmployeeOptionsLoading
            ? 'Đang tải danh sách nhân sự. Các lựa chọn RACI sẽ xuất hiện sau khi dữ liệu nạp xong.'
            : 'Chưa tải được danh sách nhân sự. Dữ liệu sẽ xuất hiện sau khi màn Dự án nạp xong hoặc khi tài khoản có quyền xem nhân sự.'}
          {isDepartmentsLoading && ' Thông tin phòng ban sẽ cập nhật ngay sau đó.'}
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="min-h-[200px] max-h-[52vh] overflow-auto">
          <table className="min-w-[820px] w-full table-fixed text-left">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="sticky top-0 z-10 bg-slate-50/95 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur-sm w-[36%]">Nhân sự</th>
                <th className="sticky top-0 z-10 bg-slate-50/95 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur-sm w-[20%]">Phòng ban</th>
                <th className="sticky top-0 z-10 bg-slate-50/95 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur-sm w-[22%]">Vai trò</th>
                <th className="sticky top-0 z-10 bg-slate-50/95 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur-sm w-[14%] text-center">Ngày phân công</th>
                <th className="sticky top-0 z-10 bg-slate-50/95 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur-sm w-[8%] text-center">Tác vụ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {formData.raci && formData.raci.length > 0 ? (
                formData.raci.map((raci) => {
                  const employee = employees.find((candidate) => String(candidate.id) === String(raci.userId));
                  const department = resolveEmployeeDepartment(employee);
                  const departmentLabel = department?.dept_name || '---';
                  const departmentTitle = department
                    ? `${department.dept_code ? `${department.dept_code} - ` : ''}${department.dept_name}`
                    : String(employee?.department_id ?? employee?.department ?? '---');

                  return (
                    <tr key={raci.id} className={duplicateRaciIds.has(raci.id) ? 'bg-red-50 ring-1 ring-inset ring-red-300' : 'align-middle hover:bg-slate-50'}>
                      <td className="px-2 py-1.5 align-middle">
                        <SearchableSelect
                          size="sm"
                          value={raci.userId}
                          options={employeeOptions}
                          onChange={(value) => handleUpdateRACI(raci.id, 'userId', value)}
                          disabled={isProjectEmployeeOptionsLoading || employees.length === 0}
                          className="w-full"
                          triggerClassName={PROJECT_RACI_CONTROL_TRIGGER_CLASS_NAME}
                          dropdownClassName="min-w-[380px] max-w-[680px]"
                          usePortal
                        />
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <div className={PROJECT_RACI_READONLY_BOX_CLASS_NAME} title={departmentTitle}>
                          <span className="block w-full truncate">{departmentLabel}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <div className="flex items-center gap-1.5">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded font-bold text-[10px] ${RACI_ROLES.find((role) => role.value === raci.roleType)?.color || 'bg-slate-100 text-slate-700'}`}>
                            {raci.roleType}
                          </div>
                          <SearchableSelect
                            size="sm"
                            className="min-w-0 flex-1"
                            value={raci.roleType}
                            options={RACI_ROLES.map((role) => ({ value: role.value, label: role.label }))}
                            onChange={(value) => handleUpdateRACI(raci.id, 'roleType', value)}
                            triggerClassName={PROJECT_RACI_CONTROL_TRIGGER_CLASS_NAME}
                            dropdownClassName="min-w-[200px] max-w-[320px]"
                            usePortal
                          />
                        </div>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <input
                          type="text"
                          className={PROJECT_RACI_DATE_INPUT_CLASS_NAME}
                          value={raci.assignedDate}
                          onChange={(e) => handleUpdateRACI(raci.id, 'assignedDate', e.target.value)}
                          onBlur={() => handleRaciAssignedDateBlur(raci.id)}
                          placeholder="dd/mm/yyyy"
                        />
                      </td>
                      <td className="px-2 py-1.5 align-middle text-center">
                        <div className="flex h-8 items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyRACI(raci.id)}
                            title="Sao chép dòng này"
                            className="rounded p-1 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>content_copy</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveRACI(raci.id)}
                            title="Xóa"
                            className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-error"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-400">
                    Chưa có nhân sự nào được phân công. Bấm <strong>Thêm nhân sự</strong> để bắt đầu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAccountableConfirm && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={dismissAccountableConfirm}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-accountable-confirm-title"
            className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/10">
                <span className="material-symbols-outlined text-warning" style={{ fontSize: 20 }}>
                  warning
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h4
                  id="project-accountable-confirm-title"
                  className="text-sm font-bold text-slate-800"
                >
                  Đã tồn tại người chịu trách nhiệm (A)
                </h4>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {existingAccountableLabel
                    ? `Hiện tại ${existingAccountableLabel} đang giữ vai trò A trong dự án này.`
                    : 'Dự án này đã có một người đang giữ vai trò A.'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng cảnh báo thay người chịu trách nhiệm A"
                onClick={dismissAccountableConfirm}
                className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  close
                </span>
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs leading-5 text-slate-500">
                Bạn muốn tiếp tục thay đổi vai trò hay huỷ thao tác để giữ nguyên phân công hiện tại?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={dismissAccountableConfirm}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Huỷ thao tác
              </button>
              <button
                type="button"
                onClick={onConfirmAccountableReplacement}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-deep-teal"
              >
                Tiếp tục
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
