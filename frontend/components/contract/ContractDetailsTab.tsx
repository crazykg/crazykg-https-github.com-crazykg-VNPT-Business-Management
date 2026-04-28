import React from 'react';
import type { Attachment, Contract, ContractItem, Product, Project, ProjectItemMaster } from '../../types';
import { AttachmentManager, type AttachmentManagerHandle } from '../AttachmentManager';
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect';
import { resolveContractItemCatalogValue } from './contractItemCatalogUtils';

type ContractSourceMode = 'PROJECT' | 'INITIAL';

export interface ContractDraftItemComputedRow {
  product: Product | null;
  vatRate: number | null;
  vatLabel: string;
  amountBeforeVat: number;
  vatAmount: number;
  amountWithVat: number;
}

export interface ContractPackageSelectMeta {
  packageCode: string;
  packageName: string;
  unit: string;
  standardPrice: number | null;
  description: string;
}

interface ContractDetailsTabProps {
  modalType: 'ADD' | 'EDIT';
  formData: Partial<Contract>;
  errors: Record<string, string>;
  sourceMode: ContractSourceMode;
  sourceSelection: {
    fixedSourceMode?: ContractSourceMode | null;
    areScheduleSourceFieldsLocked: boolean;
    projectTypeLockMessage: string;
    isProjectSelectionLoading: boolean;
    isInitialCustomerSelectionLoading: boolean;
    isProjectSelectionDisabled: boolean;
    isInitialCustomerSelectionDisabled: boolean;
    isInitialProjectTypeSelectionDisabled: boolean;
    customerOptions: SearchableSelectOption[];
    projectOptions: SearchableSelectOption[];
    projectTypeOptions: SearchableSelectOption[];
    onSourceModeChange: (nextMode: ContractSourceMode) => void;
  };
  projectReference: {
    selectedProject: Project | null;
    selectedProjectCustomerName: string;
    selectedProjectValue: number;
    selectedProjectItems: ProjectItemMaster[];
    selectedProjectInvestmentModeLabel: string;
    isProjectItemsReferenceOpen: boolean;
    isContractProjectReferenceLoading: boolean;
    onToggleProjectItemsReference: () => void;
  };
  contractItems: {
    draftItems: ContractItem[];
    computedRows: ContractDraftItemComputedRow[];
    draftItemsTotal: number;
    draftItemsVatTotal: number;
    draftItemsGrandTotal: number;
    projectFallbackComputedRows: ContractDraftItemComputedRow[];
    projectFallbackTotal: number;
    projectFallbackVatTotal: number;
    projectFallbackGrandTotal: number;
    isItemsEditable: boolean;
    isContractProductOptionsLoading: boolean;
    productSelectOptions: SearchableSelectOption[];
    productOptionMetaByValue: ReadonlyMap<string, ContractPackageSelectMeta>;
    onAddDraftItem: () => void;
    onImportProjectItems: () => void;
    onRemoveDraftItem: (index: number) => void;
    onDraftProductChange: (index: number, nextProductId: string) => void;
    onDraftItemChange: (index: number, field: keyof ContractItem, value: unknown) => void;
    onDraftVatAmountChange: (index: number, rawValue: string) => void;
  };
  signerSelection: {
    signerOptions: SearchableSelectOption[];
    isSignerOptionsLoading: boolean;
    signerOptionsError: string;
    selectedSignerDepartmentLabel: string;
  };
  contractAttachments: {
    attachments: Attachment[];
    isUploading: boolean;
    error: string;
    notice: string;
    accept: string;
    onUpload: (file: File) => Promise<void> | void;
    onDelete: (id: string) => Promise<void> | void;
  };
  contractMeta: {
    inlineNotice: string;
    scheduleSourceLockMessage: string;
    isStatusDraft: boolean;
    showZeroValueWarning: boolean;
    valueInWords: string;
    expiryDateManualOverride: boolean;
    statusOptions: SearchableSelectOption[];
    cycleSelectOptions: SearchableSelectOption[];
    onRecalculateExpiryDate: () => void;
  };
  callbacks: {
    onFieldChange: (field: keyof Contract, value: unknown) => void;
    onFieldBlur: (field: keyof Contract) => void;
    onExpiryDateChange: (value: string) => void;
  };
  formatters: {
    formatCurrency: (value: number | string) => string;
    formatQuantity: (value: unknown) => string;
    parseCurrency: (value: string | number) => number;
  };
}

const fieldLabelClass = 'text-xs font-semibold leading-4 text-neutral';
const fieldInputClass = 'w-full h-8 rounded-md border border-slate-300 bg-white px-3 text-[13px] leading-5 text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';
const fieldInputErrorClass = 'border-error ring-1 ring-error/20';
const cardClass = 'rounded-lg border border-slate-200 bg-white shadow-sm';
const compactTriggerClass = '!h-8 rounded-md border border-slate-300 px-3 text-[13px] leading-5 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30';
const sourceModeButtonClass = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold leading-5 transition-colors focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60';
const sectionActionButtonClass = 'inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold leading-4 text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-400';
const compactSectionHeaderClass = 'flex w-full flex-col gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2 text-left md:flex-row md:items-center md:justify-between';
const compactTableHeaderClass = 'px-2 py-1.5 text-xs font-bold uppercase tracking-wide leading-4 text-slate-500';
const compactTableCellClass = 'px-2 py-2 text-[13px] leading-4';

const parseFormattedQuantityInput = (value: string): number => {
  const normalized = String(value || '').trim().replace(/\s+/g, '');
  if (!normalized) {
    return 0;
  }

  const hasCommaDecimal = normalized.includes(',');
  const thousandsDotPattern = /^\d{1,3}(\.\d{3})+$/;
  const decimalDotPattern = /^\d+\.\d+$/;

  let sanitized = normalized;

  if (hasCommaDecimal) {
    sanitized = normalized.replace(/\./g, '').replace(/,/g, '.');
  } else if (thousandsDotPattern.test(normalized)) {
    sanitized = normalized.replace(/\./g, '');
  } else if (!decimalDotPattern.test(normalized)) {
    sanitized = normalized.replace(/[^\d.-]/g, '');
  }

  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export const ContractDetailsTab: React.FC<ContractDetailsTabProps> = ({
  modalType,
  formData,
  errors,
  sourceMode,
  sourceSelection,
  projectReference,
  contractItems,
  signerSelection,
  contractAttachments,
  contractMeta,
  callbacks,
  formatters,
}) => {
  const {
    fixedSourceMode,
    areScheduleSourceFieldsLocked,
    projectTypeLockMessage,
    isProjectSelectionLoading,
    isInitialCustomerSelectionLoading,
    isProjectSelectionDisabled,
    isInitialCustomerSelectionDisabled,
    isInitialProjectTypeSelectionDisabled,
    customerOptions,
    projectOptions,
    projectTypeOptions,
    onSourceModeChange,
  } = sourceSelection;
  const {
    selectedProject,
    selectedProjectCustomerName,
    selectedProjectValue,
    selectedProjectItems,
    selectedProjectInvestmentModeLabel,
    isProjectItemsReferenceOpen,
    isContractProjectReferenceLoading,
    onToggleProjectItemsReference,
  } = projectReference;
  const {
    draftItems,
    computedRows,
    draftItemsTotal,
    draftItemsVatTotal,
    draftItemsGrandTotal,
    projectFallbackComputedRows,
    projectFallbackTotal,
    projectFallbackVatTotal,
    projectFallbackGrandTotal,
    isItemsEditable,
    isContractProductOptionsLoading,
    productSelectOptions,
    productOptionMetaByValue,
    onAddDraftItem,
    onImportProjectItems,
    onRemoveDraftItem,
    onDraftProductChange,
    onDraftItemChange,
    onDraftVatAmountChange,
  } = contractItems;
  const {
    signerOptions,
    isSignerOptionsLoading,
    signerOptionsError,
    selectedSignerDepartmentLabel,
  } = signerSelection;
  const {
    attachments,
    isUploading,
    error: attachmentError,
    notice: attachmentNotice,
    accept: attachmentAccept,
    onUpload,
    onDelete,
  } = contractAttachments;
  const {
    inlineNotice,
    scheduleSourceLockMessage,
    isStatusDraft,
    showZeroValueWarning,
    valueInWords,
    expiryDateManualOverride,
    statusOptions,
    cycleSelectOptions,
    onRecalculateExpiryDate,
  } = contractMeta;
  const { onFieldChange, onFieldBlur, onExpiryDateChange } = callbacks;
  const { formatCurrency, formatQuantity, parseCurrency } = formatters;
  const attachmentManagerRef = React.useRef<AttachmentManagerHandle | null>(null);
  const shouldUseProjectItemsFallback = !isItemsEditable
    && sourceMode === 'PROJECT'
    && draftItems.length === 0
    && selectedProjectItems.length > 0
    && Math.abs(Number(selectedProjectValue || 0) - Number(formData.value || 0)) <= 0.01;
  const visibleContractItems: ContractItem[] = shouldUseProjectItemsFallback
    ? selectedProjectItems.map((item, index) => ({
        id: `project-fallback-${item.id || index}`,
        contract_id: String(formData.id || 'project-fallback'),
        product_id: String(item.product_id || ''),
        product_package_id: item.product_package_id ?? null,
        productPackageId: item.product_package_id ?? null,
        product_code: item.product_code || null,
        product_name: item.product_name || null,
        unit: item.unit || null,
        quantity: Number(item.quantity || 0) || 0,
        unit_price: Number(item.unit_price || 0) || 0,
        vat_rate: null,
        vat_amount: null,
      }))
    : draftItems;
  const visibleComputedRows: ContractDraftItemComputedRow[] = shouldUseProjectItemsFallback
    ? projectFallbackComputedRows
    : computedRows;
  const visibleDraftItemsTotal = shouldUseProjectItemsFallback ? projectFallbackTotal : draftItemsTotal;
  const visibleDraftItemsVatTotal = shouldUseProjectItemsFallback ? projectFallbackVatTotal : draftItemsVatTotal;
  const visibleDraftItemsGrandTotal = shouldUseProjectItemsFallback ? projectFallbackGrandTotal : draftItemsGrandTotal;
  const shouldCollapseContractItems = !isItemsEditable;
  const contractItemsDisclosureId = `contract-items-panel-${String(formData.id || 'draft')}`;
  const [isContractItemsOpen, setIsContractItemsOpen] = React.useState<boolean>(isItemsEditable);

  React.useEffect(() => {
    setIsContractItemsOpen(isItemsEditable);
  }, [formData.id, isItemsEditable, modalType]);

  return (
    <div className="space-y-2 px-3 py-2">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className={fieldLabelClass}>
            Mã hợp đồng <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={formData.contract_code || ''}
            onChange={(event) => onFieldChange('contract_code', event.target.value)}
            onBlur={() => onFieldBlur('contract_code')}
            placeholder="HD-2026-001"
            className={`${fieldInputClass} ${errors.contract_code ? fieldInputErrorClass : ''}`}
          />
          {errors.contract_code && (
            <p className="inline-flex items-center gap-1 text-xs text-error">
              <span className="material-symbols-outlined text-error" style={{ fontSize: 14 }}>
                error
              </span>
              {errors.contract_code}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1 xl:col-span-3">
          <label className={fieldLabelClass}>
            Tên hợp đồng <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={formData.contract_name || ''}
            onChange={(event) => onFieldChange('contract_name', event.target.value)}
            onBlur={() => onFieldBlur('contract_name')}
            placeholder="Hợp đồng triển khai giải pháp..."
            className={`${fieldInputClass} ${errors.contract_name ? fieldInputErrorClass : ''}`}
          />
          {errors.contract_name && (
            <p className="inline-flex items-center gap-1 text-xs text-error">
              <span className="material-symbols-outlined text-error" style={{ fontSize: 14 }}>
                error
              </span>
              {errors.contract_name}
            </p>
          )}
        </div>

        {modalType !== 'EDIT' && !fixedSourceMode && (
          <div className="md:col-span-2 xl:col-span-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onSourceModeChange('PROJECT')}
              disabled={areScheduleSourceFieldsLocked}
              className={`${sourceModeButtonClass} ${
                sourceMode === 'PROJECT'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
              }`}
              title={areScheduleSourceFieldsLocked ? projectTypeLockMessage : undefined}
            >
              Theo dự án
            </button>
            <button
              type="button"
              onClick={() => onSourceModeChange('INITIAL')}
              disabled={areScheduleSourceFieldsLocked}
              className={`${sourceModeButtonClass} ${
                sourceMode === 'INITIAL'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
              }`}
              title={areScheduleSourceFieldsLocked ? projectTypeLockMessage : undefined}
            >
              Đầu kỳ
            </button>
          </div>
        )}

        {sourceMode === 'PROJECT' ? (
          <div
            className="md:col-span-2 xl:col-span-4 flex flex-col gap-1"
            title={areScheduleSourceFieldsLocked ? projectTypeLockMessage : undefined}
          >
            <SearchableSelect
              compact
              label="Dự án"
              required
              value={formData.project_id ? String(formData.project_id) : ''}
              onChange={(value) => onFieldChange('project_id', value)}
              options={projectOptions}
              placeholder={isProjectSelectionLoading ? 'Đang tải danh mục dự án...' : 'Chọn dự án'}
              error={errors.project_id}
              disabled={isProjectSelectionDisabled}
              triggerClassName={compactTriggerClass}
              denseLabel
            />
          </div>
        ) : (
          <>
            <div
              className="flex flex-col gap-1"
              title={areScheduleSourceFieldsLocked ? projectTypeLockMessage : undefined}
            >
              <SearchableSelect
                compact
                label="Khách hàng"
                required
                value={formData.customer_id ? String(formData.customer_id) : ''}
                onChange={(value) => onFieldChange('customer_id', value)}
                options={customerOptions}
                placeholder={isInitialCustomerSelectionLoading ? 'Đang tải khách hàng...' : 'Chọn khách hàng'}
                error={errors.customer_id}
                disabled={isInitialCustomerSelectionDisabled}
                triggerClassName={compactTriggerClass}
                denseLabel
              />
            </div>

            <div
              className="flex flex-col gap-1"
              title={areScheduleSourceFieldsLocked ? projectTypeLockMessage : undefined}
            >
              <SearchableSelect
                compact
                label="Loại dự án"
                required
                value={formData.project_type_code ? String(formData.project_type_code) : ''}
                onChange={(value) => onFieldChange('project_type_code', value)}
                options={projectTypeOptions}
                placeholder="Chọn loại dự án"
                error={errors.project_type_code}
                disabled={isInitialProjectTypeSelectionDisabled}
                triggerClassName={compactTriggerClass}
                denseLabel
              />
            </div>
          </>
        )}

        {isProjectSelectionLoading && sourceMode === 'PROJECT' && (
          <div className="md:col-span-2 xl:col-span-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
            Đang tải dữ liệu dự án để liên kết hợp đồng.
          </div>
        )}

        {isInitialCustomerSelectionLoading && sourceMode === 'INITIAL' && (
          <div className="md:col-span-2 xl:col-span-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
            Đang tải dữ liệu khách hàng cho hợp đồng đầu kỳ.
          </div>
        )}

        {sourceMode === 'PROJECT' && selectedProject && (
          <div className="md:col-span-2 xl:col-span-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
            Dự án: <span className="font-semibold text-slate-800">{selectedProject.project_code} - {selectedProject.project_name}</span>
            {' | '}KH: <span className="font-semibold text-slate-800">{selectedProjectCustomerName || '--'}</span>
            {' | '}Giá trị hạng mục DA: <span className="font-semibold text-slate-800">{formatCurrency(selectedProjectValue)} VNĐ ({selectedProjectItems.length} HM)</span>
            {' | '}Hình thức: <span className="font-semibold text-slate-800">{selectedProjectInvestmentModeLabel}</span>
            {areScheduleSourceFieldsLocked && (
              <>
                {' | '}
                <span
                  className="inline-flex items-center gap-1 font-semibold text-warning"
                  title={projectTypeLockMessage}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>
                  Đã khóa loại dự án
                </span>
              </>
            )}
          </div>
        )}

        {sourceMode === 'INITIAL' && (formData.customer_id || formData.project_type_code) && (
          <div className="md:col-span-2 xl:col-span-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
            Khách hàng:{' '}
            <span className="font-semibold text-slate-800">
              {customerOptions.find((item) => String(item.value) === String(formData.customer_id || ''))?.label || '--'}
            </span>
            {' | '}Loại dự án: <span className="font-semibold text-slate-800">{selectedProjectInvestmentModeLabel}</span>
            {' | '}Nguồn dữ liệu: <span className="font-semibold text-slate-800">Hợp đồng đầu kỳ không gắn dự án cụ thể</span>
          </div>
        )}

        {sourceMode === 'PROJECT' && selectedProject && (
          <div className="md:col-span-2 xl:col-span-4 space-y-2">
            <div className={cardClass}>
              <button
                type="button"
                onClick={onToggleProjectItemsReference}
                className={compactSectionHeaderClass}
              >
                <div>
                  <h4 className="text-sm font-bold leading-5 text-slate-700">
                    Hạng mục dự án gốc ({selectedProjectItems.length} hạng mục)
                  </h4>
                </div>
                <span className="inline-flex items-center gap-1 text-[13px] font-semibold leading-[18px] text-slate-600">
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                    {isProjectItemsReferenceOpen ? 'expand_less' : 'expand_more'}
                  </span>
                  {isProjectItemsReferenceOpen ? 'Thu gọn' : 'Xem chi tiết'}
                </span>
              </button>

              {isProjectItemsReferenceOpen && (
                <div className="max-h-[34dvh] overflow-auto">
                  {isContractProjectReferenceLoading && (
                    <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      Đang tải hạng mục gốc của dự án liên kết...
                    </div>
                  )}
                  <table className="w-full min-w-[720px] border-collapse">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className={`w-12 text-center ${compactTableHeaderClass}`}>#</th>
                        <th className={`text-left ${compactTableHeaderClass}`}>Sản phẩm/Dịch vụ</th>
                        <th className={`w-28 text-center ${compactTableHeaderClass}`}>Số lượng</th>
                        <th className={`w-36 text-right ${compactTableHeaderClass}`}>Đơn giá</th>
                        <th className={`w-40 text-right ${compactTableHeaderClass}`}>Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedProjectItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-sm text-slate-500">
                            Dự án này chưa có hạng mục nào để đối chiếu.
                          </td>
                        </tr>
                      ) : (
                        selectedProjectItems.map((item, index) => {
                          const quantity = Number(item.quantity || 0);
                          const unitPrice = Number(item.unit_price || 0);
                          const amount = Math.max(
                            0,
                            (Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0)
                          );
                          const itemLabel = String(
                            item.product_name
                              || item.product_code
                              || item.display_name
                              || item.project_name
                              || `Hạng mục #${index + 1}`
                          ).trim();

                          return (
                            <tr key={`project-item-${item.id}-${index}`} className="hover:bg-slate-50">
                              <td className={`w-12 text-center font-medium text-slate-600 ${compactTableCellClass}`}>{index + 1}</td>
                              <td className={`${compactTableCellClass} text-on-surface`}>{itemLabel}</td>
                              <td className={`w-28 text-center text-slate-600 ${compactTableCellClass}`}>{formatQuantity(quantity)}</td>
                              <td className={`w-36 text-right text-slate-600 ${compactTableCellClass}`}>{formatCurrency(unitPrice)} đ</td>
                              <td className={`w-40 text-right font-semibold text-on-surface ${compactTableCellClass}`}>{formatCurrency(amount)} đ</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot className="border-t border-slate-200 bg-slate-50">
                      <tr>
                        <td colSpan={4} className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Tổng hạng mục dự án
                        </td>
                        <td className="w-40 px-2 py-2 text-right text-[13px] font-bold text-on-surface">
                          {formatCurrency(selectedProjectValue)} đ
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className={cardClass}>
              {shouldCollapseContractItems ? (
                <button
                  type="button"
                  onClick={() => setIsContractItemsOpen((prev) => !prev)}
                  aria-expanded={isContractItemsOpen}
                  aria-controls={contractItemsDisclosureId}
                  className={compactSectionHeaderClass}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <h4 className="text-sm font-bold leading-5 text-slate-700">
                      Hạng mục hợp đồng ({visibleContractItems.length} hạng mục)
                    </h4>
                    <span className="text-xs font-semibold leading-4 text-slate-500">
                      Trước VAT: <span className="text-slate-800">{formatCurrency(visibleDraftItemsTotal)} đ</span>
                    </span>
                    <span className="text-xs font-semibold leading-4 text-slate-500">
                      VAT: <span className="text-slate-800">{formatCurrency(visibleDraftItemsVatTotal)} đ</span>
                    </span>
                    <span className="text-xs font-semibold leading-4 text-slate-500">
                      Tổng VAT: <span className="text-slate-900">{formatCurrency(visibleDraftItemsGrandTotal)} đ</span>
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-bold text-warning">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>
                      Không thể sửa - đã có kỳ thanh toán
                    </span>
                    <span className="inline-flex items-center gap-1 text-[13px] font-semibold leading-[18px] text-slate-600">
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                        {isContractItemsOpen ? 'expand_less' : 'expand_more'}
                      </span>
                      {isContractItemsOpen ? 'Thu gọn' : 'Xem chi tiết'}
                    </span>
                  </div>
                </button>
              ) : (
                <div className={`${compactSectionHeaderClass} text-left`}>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <h4 className="text-sm font-bold leading-5 text-slate-700">
                      Hạng mục hợp đồng ({visibleContractItems.length} hạng mục)
                    </h4>
                    <span className="text-xs font-semibold leading-4 text-slate-500">
                      Trước VAT: <span className="text-slate-800">{formatCurrency(visibleDraftItemsTotal)} đ</span>
                    </span>
                    <span className="text-xs font-semibold leading-4 text-slate-500">
                      VAT: <span className="text-slate-800">{formatCurrency(visibleDraftItemsVatTotal)} đ</span>
                    </span>
                    <span className="text-xs font-semibold leading-4 text-slate-500">
                      Tổng VAT: <span className="text-slate-900">{formatCurrency(visibleDraftItemsGrandTotal)} đ</span>
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {sourceMode === 'PROJECT' && (
                      <button
                        type="button"
                        onClick={onImportProjectItems}
                        disabled={isContractProjectReferenceLoading || selectedProjectItems.length === 0}
                        className={sectionActionButtonClass}
                      >
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>
                          playlist_add
                        </span>
                        Lấy hạng mục từ dự án
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onAddDraftItem}
                      className={sectionActionButtonClass}
                    >
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>
                        add
                      </span>
                      Thêm hạng mục
                    </button>
                  </div>
                </div>
              )}

              {(!shouldCollapseContractItems || isContractItemsOpen) && (
                <div id={contractItemsDisclosureId} className="max-h-[40dvh] overflow-auto">
                  {shouldUseProjectItemsFallback && (
                    <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Hợp đồng này chưa có snapshot riêng cho hạng mục. Hệ thống đang hiển thị tạm từ hạng mục dự án liên kết để bạn đối chiếu.
                    </div>
                  )}
                  <table className="w-full min-w-[1180px] border-collapse">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className={`w-12 text-center ${compactTableHeaderClass}`}>#</th>
                        <th className={`text-left ${compactTableHeaderClass}`}>Sản phẩm/DV</th>
                        <th className={`w-28 text-left ${compactTableHeaderClass}`}>ĐVT</th>
                        <th className={`w-28 text-center ${compactTableHeaderClass}`}>Số lượng</th>
                        <th className={`w-36 text-right ${compactTableHeaderClass}`}>Đơn giá</th>
                        <th className={`w-40 text-right ${compactTableHeaderClass}`}>Thành tiền trước VAT</th>
                        <th className={`w-20 text-center ${compactTableHeaderClass}`}>VAT</th>
                        <th className={`w-32 text-right ${compactTableHeaderClass}`}>Tiền VAT</th>
                        <th className={`w-40 text-right ${compactTableHeaderClass}`}>Thành tiền VAT</th>
                        {isItemsEditable && (
                          <th className={`w-24 text-center ${compactTableHeaderClass}`}>Thao tác</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {visibleContractItems.length === 0 ? (
                        <tr>
                          <td colSpan={isItemsEditable ? 10 : 9} className="px-3 py-4 text-center text-sm text-slate-500">
                            Chưa có hạng mục hợp đồng.
                          </td>
                        </tr>
                      ) : (
                        visibleContractItems.map((item, index) => {
                          const quantity = Number(item.quantity || 0);
                          const unitPrice = Number(item.unit_price || 0);
                          const computedRow = visibleComputedRows[index];
                          const product = computedRow?.product || null;
                          const amountBeforeVat = computedRow?.amountBeforeVat ?? 0;
                          const vatLabel = computedRow?.vatLabel ?? '--';
                          const vatAmount = computedRow?.vatAmount ?? 0;
                          const amountWithVat = computedRow?.amountWithVat ?? amountBeforeVat;
                          const hasStoredVatAmount = Number.isFinite(Number(item.vat_amount));
                          const rowCatalogValue = resolveContractItemCatalogValue(item);
                          const rowOptionMeta = productOptionMetaByValue.get(rowCatalogValue);
                          const displayUnit = String(item.unit || product?.unit || rowOptionMeta?.unit || '').trim() || 'Gói';

                          return (
                            <tr key={`contract-item-${String(item.id)}`} className="hover:bg-slate-50">
                              <td className={`w-12 text-center font-medium text-slate-600 ${compactTableCellClass}`}>{index + 1}</td>
                              <td className={`${compactTableCellClass} min-w-[320px] text-on-surface`}>
                                {isItemsEditable ? (
                                  <SearchableSelect
                                    value={rowCatalogValue}
                                    onChange={(value) => onDraftProductChange(index, value)}
                                    options={productSelectOptions}
                                    placeholder={isContractProductOptionsLoading ? 'Đang tải sản phẩm/DV...' : 'Chọn sản phẩm/DV'}
                                    compact
                                    usePortal
                                    disabled={isContractProductOptionsLoading}
                                    triggerClassName={compactTriggerClass}
                                    optionEstimateSize={52}
                                    dropdownClassName="min-w-[980px] max-w-[1180px]"
                                    portalMinWidth={980}
                                    portalMaxWidth={1180}
                                    renderDropdownHeader={(
                                      <div className="grid grid-cols-[112px_minmax(0,1.45fr)_minmax(0,1.35fr)_136px_136px] items-center gap-4 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        <span>Mã gói</span>
                                        <span>Tên hạng mục</span>
                                        <span>Mô tả gói</span>
                                        <span className="text-left">ĐVT</span>
                                        <span className="text-right">Đơn giá</span>
                                      </div>
                                    )}
                                    renderOptionContent={(option, state) => {
                                      const optionMeta = productOptionMetaByValue.get(String(option.value));
                                      const packageCode = String(optionMeta?.packageCode || '').trim() || '--';
                                      const packageName = String(optionMeta?.packageName || '').trim() || option.label;
                                      const description = String(optionMeta?.description || '').trim() || '—';
                                      const hasDescription = description !== '—';
                                      const unitLabel = String(optionMeta?.unit || '').trim() || '—';
                                      const standardPrice = optionMeta?.standardPrice;
                                      const formattedStandardPrice = Number.isFinite(standardPrice)
                                        ? formatCurrency(Number(standardPrice))
                                        : '—';

                                      return (
                                        <div className="grid min-h-[40px] grid-cols-[112px_minmax(0,1.45fr)_minmax(0,1.35fr)_136px_136px] items-center gap-4 py-0.5">
                                          <p className={`truncate text-left font-mono text-xs font-semibold ${state.isSelected ? 'text-primary' : 'text-slate-500'}`}>
                                            {packageCode}
                                          </p>
                                          <p className={`${hasDescription ? 'truncate' : 'col-span-2 truncate'} text-left text-sm font-semibold ${state.isSelected ? 'text-primary' : 'text-slate-900'}`}>
                                            {packageName}
                                          </p>
                                          {hasDescription ? (
                                            <p className="truncate text-left text-xs text-slate-500">
                                              {description}
                                            </p>
                                          ) : null}
                                          <p className="truncate text-left text-sm text-slate-600">
                                            {unitLabel}
                                          </p>
                                          <p className="truncate text-right text-sm font-medium text-slate-700">
                                            {formattedStandardPrice}
                                          </p>
                                        </div>
                                      );
                                    }}
                                  />
                                ) : (
                                  item.product_name || item.product_code || '--'
                                )}
                              </td>
                              <td className={`w-28 text-left text-slate-600 whitespace-nowrap ${compactTableCellClass}`}>
                                {displayUnit}
                              </td>
                              <td className={`w-28 text-center text-slate-600 ${compactTableCellClass}`}>
                                {isItemsEditable ? (
                                  <div className="flex justify-center">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={quantity > 0 ? formatQuantity(quantity) : ''}
                                      onChange={(event) => {
                                        const parsed = parseFormattedQuantityInput(event.target.value);
                                        onDraftItemChange(index, 'quantity', Number.isFinite(parsed) ? parsed : 0);
                                      }}
                                      className="h-8 w-24 rounded-md border border-slate-300 bg-white px-3 text-center text-[13px] leading-5 text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                                    />
                                  </div>
                                ) : (
                                  formatQuantity(quantity)
                                )}
                              </td>
                              <td className={`w-36 text-right text-slate-600 ${compactTableCellClass}`}>
                                {isItemsEditable ? (
                                  <div className="flex justify-end">
                                    <input
                                      type="text"
                                      value={formatCurrency(unitPrice)}
                                      onChange={(event) => onDraftItemChange(index, 'unit_price', parseCurrency(event.target.value))}
                                      className="h-8 w-36 rounded-md border border-slate-300 bg-white px-3 text-right text-[13px] leading-5 text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                                    />
                                  </div>
                                ) : (
                                  `${formatCurrency(unitPrice)} đ`
                                )}
                              </td>
                              <td className={`w-40 text-right font-semibold text-on-surface whitespace-nowrap ${compactTableCellClass}`}>
                                {formatCurrency(amountBeforeVat)} đ
                              </td>
                              <td className={`w-20 text-center ${compactTableCellClass}`}>
                                {vatLabel !== '--' ? (
                                  <span className="inline-flex items-center rounded-full bg-tertiary/10 px-2 py-0.5 text-xs font-bold leading-4 text-tertiary">
                                    {vatLabel}
                                  </span>
                                ) : (
                                  <span className="text-sm text-slate-400">--</span>
                                )}
                              </td>
                              <td className={`w-32 text-right whitespace-nowrap ${compactTableCellClass}`}>
                                {isItemsEditable ? (
                                  <div className="flex justify-end">
                                    <input
                                      type="text"
                                      value={vatAmount > 0 ? formatCurrency(vatAmount) : ''}
                                      onChange={(event) => onDraftVatAmountChange(index, event.target.value)}
                                      placeholder="0"
                                      className="h-8 w-32 rounded-md border border-slate-300 bg-white px-3 text-right text-[13px] leading-5 text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                                    />
                                  </div>
                                ) : (
                                  <span className="font-semibold text-on-surface">
                                    {vatAmount > 0 || hasStoredVatAmount
                                      ? `${formatCurrency(vatAmount)} đ`
                                      : '--'}
                                  </span>
                                )}
                              </td>
                              <td className={`w-40 text-right font-semibold text-on-surface whitespace-nowrap ${compactTableCellClass}`}>
                                {formatCurrency(amountWithVat)} đ
                              </td>
                              {isItemsEditable && (
                                <td className={`w-24 text-center ${compactTableCellClass}`}>
                                  <button
                                    type="button"
                                    onClick={() => onRemoveDraftItem(index)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-error/20 text-error hover:bg-error/10"
                                    aria-label={`Xóa hạng mục ${index + 1}`}
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                                      delete
                                    </span>
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot className="border-t border-slate-200 bg-slate-50">
                      <tr>
                        <td colSpan={5} className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                          Tổng cộng
                        </td>
                        <td className="w-40 px-2 py-2 text-right text-[13px] font-bold text-on-surface whitespace-nowrap">
                          {formatCurrency(visibleDraftItemsTotal)} đ
                        </td>
                        <td className="w-20 px-2 py-2" />
                        <td className="w-32 px-2 py-2 text-right text-[13px] font-bold text-on-surface whitespace-nowrap">
                          {formatCurrency(visibleDraftItemsVatTotal)} đ
                        </td>
                        <td className="w-40 px-2 py-2 text-right text-[13px] font-bold text-on-surface whitespace-nowrap">
                          {formatCurrency(visibleDraftItemsGrandTotal)} đ
                        </td>
                        {isItemsEditable && <td className="w-24 px-2 py-2" />}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {!!inlineNotice && (
          <div className="md:col-span-2 xl:col-span-4 inline-flex items-center gap-1.5 rounded-lg border border-warning/20 bg-warning/10 px-3 py-1.5 text-xs text-warning">
            <span className="material-symbols-outlined text-warning" style={{ fontSize: 14 }}>
              info
            </span>
            <span>{inlineNotice}</span>
          </div>
        )}

        {areScheduleSourceFieldsLocked && (
          <div className="md:col-span-2 xl:col-span-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 14 }}>lock</span>
            <span>{scheduleSourceLockMessage}</span>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <SearchableSelect
            compact
            label="Trạng thái"
            value={formData.status || 'DRAFT'}
            onChange={(value) => onFieldChange('status', value)}
            options={statusOptions}
            triggerClassName={compactTriggerClass}
            denseLabel
          />
        </div>

        <div className="flex flex-col gap-1">
          <SearchableSelect
            compact
            label="Người ký hợp đồng"
            required
            value={formData.signer_user_id ? String(formData.signer_user_id) : ''}
            onChange={(value) => onFieldChange('signer_user_id', value)}
            options={signerOptions}
            placeholder={isSignerOptionsLoading ? 'Đang tải người ký hợp đồng...' : 'Chọn người ký hợp đồng'}
            searchPlaceholder="Tìm theo mã, họ tên, phòng ban..."
            error={errors.signer_user_id}
            searching={isSignerOptionsLoading}
            triggerClassName={compactTriggerClass}
            denseLabel
          />
          {signerOptionsError ? (
            <p className="inline-flex items-center gap-1 text-xs text-warning">
              <span className="material-symbols-outlined text-warning" style={{ fontSize: 14 }}>
                warning
              </span>
              {signerOptionsError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <SearchableSelect
            compact
            label="Chu kỳ thanh toán"
            required
            value={formData.payment_cycle || ''}
            onChange={(value) => onFieldChange('payment_cycle', value)}
            options={cycleSelectOptions}
            error={errors.payment_cycle}
            disabled={areScheduleSourceFieldsLocked}
            triggerClassName={compactTriggerClass}
            denseLabel
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={fieldLabelClass}>Ngày ký</label>
          <input
            type="date"
            value={formData.sign_date || ''}
            onChange={(event) => onFieldChange('sign_date', event.target.value)}
            onBlur={() => onFieldBlur('sign_date')}
            disabled={areScheduleSourceFieldsLocked}
            className={`${fieldInputClass} ${errors.sign_date ? fieldInputErrorClass : ''}`}
          />
          {errors.sign_date && (
            <p className="inline-flex items-center gap-1 text-xs text-error">
              <span className="material-symbols-outlined text-error" style={{ fontSize: 14 }}>
                error
              </span>
              {errors.sign_date}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1 md:col-span-2 xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <label className={fieldLabelClass}>Giá trị hợp đồng (VNĐ)</label>
          </div>
          <div className="relative">
            <input
              type="text"
              value={formatCurrency(formData.value || 0)}
              onChange={(event) => onFieldChange('value', event.target.value)}
              onBlur={() => onFieldBlur('value')}
              disabled={areScheduleSourceFieldsLocked}
              placeholder="0"
              className={`w-full ${fieldInputClass} pr-10 font-semibold ${errors.value ? fieldInputErrorClass : ''}`}
            />
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">₫</div>
          </div>
          {errors.value ? (
            <p className="inline-flex items-center gap-1 text-xs text-error">
              <span className="material-symbols-outlined text-error" style={{ fontSize: 14 }}>
                error
              </span>
              {errors.value}
            </p>
          ) : showZeroValueWarning ? (
            <p className="inline-flex items-center gap-1 text-xs text-warning">
              <span className="material-symbols-outlined text-warning" style={{ fontSize: 14 }}>
                warning
              </span>
              Giá trị hợp đồng đang bằng 0 VNĐ. Vui lòng kiểm tra trước khi lưu.
            </p>
          ) : null}
          {!errors.value && (
            <div className="mt-0.5 rounded border border-primary/20 bg-primary/5 px-2.5 py-1">
              <p className="truncate text-xs leading-4 text-deep-teal" title={`Số tiền bằng chữ: ${valueInWords}`}>
                <span className="font-bold uppercase tracking-wide">Số tiền bằng chữ:</span>{' '}
                <span className="font-bold text-on-surface">{valueInWords}</span>
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <SearchableSelect
            compact
            label="Đơn vị thời hạn"
            value={formData.term_unit || ''}
            onChange={(value) => onFieldChange('term_unit', value)}
            options={[
              { value: 'MONTH', label: 'Theo tháng' },
              { value: 'DAY', label: 'Theo ngày' },
            ]}
            placeholder="Chọn đơn vị thời hạn"
            error={errors.term_unit}
            disabled={areScheduleSourceFieldsLocked}
            triggerClassName={compactTriggerClass}
            denseLabel
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={fieldLabelClass}>Thời hạn hợp đồng</label>
          <input
            type="number"
            min={0}
            step={String(formData.term_unit || '').toUpperCase() === 'DAY' ? 1 : 0.1}
            value={formData.term_value ?? ''}
            onChange={(event) => {
              const raw = event.target.value;
              if (raw === '') {
                onFieldChange('term_value', null);
                return;
              }

              const parsed = Number(raw);
              onFieldChange('term_value', Number.isFinite(parsed) ? parsed : null);
            }}
            onBlur={() => onFieldBlur('term_value')}
            disabled={areScheduleSourceFieldsLocked}
            placeholder={String(formData.term_unit || '').toUpperCase() === 'DAY' ? 'Ví dụ: 30' : 'Ví dụ: 1.5'}
            className={`${fieldInputClass} ${errors.term_value ? fieldInputErrorClass : ''}`}
          />
          {errors.term_value ? (
            <p className="inline-flex items-center gap-1 text-xs text-error">
              <span className="material-symbols-outlined text-error" style={{ fontSize: 14 }}>
                error
              </span>
              {errors.term_value}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label className={fieldLabelClass}>
            Ngày hiệu lực
            {!isStatusDraft && <span className="text-error"> *</span>}
          </label>
          <input
            type="date"
            value={formData.effective_date || ''}
            onChange={(event) => onFieldChange('effective_date', event.target.value)}
            onBlur={() => onFieldBlur('effective_date')}
            disabled={areScheduleSourceFieldsLocked}
            className={`w-full ${fieldInputClass} ${
              errors.effective_date
                ? fieldInputErrorClass
                : !isStatusDraft
                  ? 'border-warning/30 bg-warning/10 focus:border-warning focus:ring-1 focus:ring-warning/20'
                  : ''
            }`}
          />
          {errors.effective_date && (
            <p className="inline-flex items-center gap-1 text-xs text-error">
              <span className="material-symbols-outlined text-error" style={{ fontSize: 14 }}>
                error
              </span>
              {errors.effective_date}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <label className={fieldLabelClass}>
              Ngày hết hiệu lực
              {!isStatusDraft && <span className="text-error"> *</span>}
            </label>
            {expiryDateManualOverride && (
              <button
                type="button"
                onClick={onRecalculateExpiryDate}
                disabled={areScheduleSourceFieldsLocked}
                className="text-xs font-semibold text-primary hover:text-deep-teal"
              >
                Tính lại theo thời hạn
              </button>
            )}
          </div>
          <input
            type="date"
            value={formData.expiry_date || ''}
            onChange={(event) => onExpiryDateChange(event.target.value)}
            onBlur={() => onFieldBlur('expiry_date')}
            disabled={areScheduleSourceFieldsLocked}
            className={`w-full ${fieldInputClass} ${
              errors.expiry_date
                ? fieldInputErrorClass
                : !isStatusDraft
                  ? 'border-warning/30 bg-warning/10 focus:border-warning focus:ring-1 focus:ring-warning/20'
                  : ''
            }`}
          />
          {errors.expiry_date && (
            <p className="inline-flex items-center gap-1 text-xs text-error">
              <span className="material-symbols-outlined text-error" style={{ fontSize: 14 }}>
                error
              </span>
              {errors.expiry_date}
            </p>
          )}
          {!errors.expiry_date && expiryDateManualOverride && (
            <p className="text-[11px] text-slate-500">Đang dùng ngày hết hiệu lực chỉnh tay.</p>
          )}
        </div>

        <div className="md:col-span-2 xl:col-span-4 rounded-lg border border-slate-200 bg-slate-50/70 p-2">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-xs font-bold text-slate-700">Tệp hợp đồng</p>
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold leading-4 text-slate-600">
                {attachments.length} file
              </span>
              <span className="text-xs font-medium leading-4 text-slate-500">PDF/Word</span>
            </div>
            <button
              type="button"
              onClick={() => attachmentManagerRef.current?.openFilePicker()}
              disabled={isUploading}
              className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary/10 px-3 text-[13px] font-bold leading-5 text-primary transition-colors hover:bg-primary/20 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? (
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/20 border-t-primary"
                />
              ) : (
                <span aria-hidden="true" className="material-symbols-outlined text-base">upload</span>
              )}
              Tải PDF/Word
            </button>
          </div>

          <AttachmentManager
            ref={attachmentManagerRef}
            attachments={attachments}
            onUpload={onUpload}
            onDelete={onDelete}
            isUploading={isUploading}
            compact
            accept={attachmentAccept}
            helperText="Chỉ nhận file PDF hoặc Word cho hợp đồng đầu kỳ hoặc hợp đồng theo dự án."
            emptyStateDescription="Tải lên file PDF hoặc Word để lưu kèm hồ sơ hợp đồng."
            uploadButtonLabel="Tải PDF/Word"
            showSummaryMeta={false}
            showListTitle={false}
            showUploadButton={false}
            listVariant="compact-row"
            listMaxHeightClassName="max-h-[34dvh]"
            emptyStateVariant="compact-line"
            uploadButtonClassName="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary/10 px-3 text-[13px] font-bold leading-5 text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
          />

          {attachmentError ? (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-error">
              <span className="material-symbols-outlined text-error" style={{ fontSize: 14 }}>
                error
              </span>
              {attachmentError}
            </p>
          ) : null}

          {!attachmentError && attachmentNotice ? (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-warning">
              <span className="material-symbols-outlined text-warning" style={{ fontSize: 14 }}>
                warning
              </span>
              {attachmentNotice}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};
