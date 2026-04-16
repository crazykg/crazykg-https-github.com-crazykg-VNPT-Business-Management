import React from 'react';
import type { Attachment, Contract, ContractItem, Product, Project, ProjectItemMaster } from '../../types';
import { AttachmentManager } from '../AttachmentManager';
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

const fieldLabelClass = 'text-sm font-semibold leading-5 text-neutral';
const fieldInputClass = 'w-full h-11 rounded-lg border border-slate-300 bg-white px-3.5 text-sm leading-5 text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';
const fieldInputErrorClass = 'border-error ring-1 ring-error/20';
const cardClass = 'rounded-lg border border-slate-200 bg-white shadow-sm';
const compactTriggerClass = 'h-11 rounded-lg border border-slate-300 px-3.5 text-sm leading-5 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30';

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

  return (
    <div className="space-y-3 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
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

        <div className="flex flex-col gap-1.5">
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
          <div className="md:col-span-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onSourceModeChange('PROJECT')}
              disabled={areScheduleSourceFieldsLocked}
              className={`inline-flex items-center justify-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                sourceMode === 'PROJECT'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
              } disabled:cursor-not-allowed disabled:opacity-60`}
              title={areScheduleSourceFieldsLocked ? projectTypeLockMessage : undefined}
            >
              Theo dự án
            </button>
            <button
              type="button"
              onClick={() => onSourceModeChange('INITIAL')}
              disabled={areScheduleSourceFieldsLocked}
              className={`inline-flex items-center justify-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                sourceMode === 'INITIAL'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
              } disabled:cursor-not-allowed disabled:opacity-60`}
              title={areScheduleSourceFieldsLocked ? projectTypeLockMessage : undefined}
            >
              Đầu kỳ
            </button>
          </div>
        )}

        {sourceMode === 'PROJECT' ? (
          <div
            className="md:col-span-2 flex flex-col gap-1.5"
            title={areScheduleSourceFieldsLocked ? projectTypeLockMessage : undefined}
          >
            <SearchableSelect
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
              className="flex flex-col gap-1.5"
              title={areScheduleSourceFieldsLocked ? projectTypeLockMessage : undefined}
            >
              <SearchableSelect
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
              className="flex flex-col gap-1.5"
              title={areScheduleSourceFieldsLocked ? projectTypeLockMessage : undefined}
            >
              <SearchableSelect
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
          <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Đang tải dữ liệu dự án để liên kết hợp đồng.
          </div>
        )}

        {isInitialCustomerSelectionLoading && sourceMode === 'INITIAL' && (
          <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Đang tải dữ liệu khách hàng cho hợp đồng đầu kỳ.
          </div>
        )}

        {sourceMode === 'PROJECT' && selectedProject && (
          <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
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
          <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            Khách hàng:{' '}
            <span className="font-semibold text-slate-800">
              {customerOptions.find((item) => String(item.value) === String(formData.customer_id || ''))?.label || '--'}
            </span>
            {' | '}Loại dự án: <span className="font-semibold text-slate-800">{selectedProjectInvestmentModeLabel}</span>
            {' | '}Nguồn dữ liệu: <span className="font-semibold text-slate-800">Hợp đồng đầu kỳ không gắn dự án cụ thể</span>
          </div>
        )}

        {sourceMode === 'PROJECT' && selectedProject && (
          <div className="md:col-span-2 space-y-3">
            <div className={cardClass}>
              <button
                type="button"
                onClick={onToggleProjectItemsReference}
                className="flex w-full flex-col gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between"
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
                <div className="overflow-auto">
                  {isContractProjectReferenceLoading && (
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                      Đang tải hạng mục gốc của dự án liên kết...
                    </div>
                  )}
                  <table className="w-full min-w-[720px] border-collapse">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="w-14 px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">#</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Sản phẩm/Dịch vụ</th>
                        <th className="w-32 px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">Số lượng</th>
                        <th className="w-40 px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Đơn giá</th>
                        <th className="w-44 px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedProjectItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-5 text-center text-sm text-slate-500">
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
                              <td className="w-14 px-4 py-3 text-center text-sm font-medium text-slate-600">{index + 1}</td>
                              <td className="px-4 py-3 text-sm leading-5 text-on-surface">{itemLabel}</td>
                              <td className="w-32 px-4 py-3 text-center text-sm text-slate-600">{formatQuantity(quantity)}</td>
                              <td className="w-40 px-4 py-3 text-right text-sm text-slate-600">{formatCurrency(unitPrice)} đ</td>
                              <td className="w-44 px-4 py-3 text-right text-sm font-semibold text-on-surface">{formatCurrency(amount)} đ</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot className="border-t border-slate-200 bg-slate-50">
                      <tr>
                        <td colSpan={4} className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Tổng hạng mục dự án
                        </td>
                        <td className="w-44 px-4 py-2.5 text-right text-sm font-bold text-on-surface">
                          {formatCurrency(selectedProjectValue)} đ
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className={cardClass}>
              <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold leading-5 text-slate-700">
                      Hạng mục hợp đồng ({visibleContractItems.length} hạng mục)
                    </h4>
                  </div>
                  {isItemsEditable ? (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {sourceMode === 'PROJECT' && (
                        <button
                          type="button"
                          onClick={onImportProjectItems}
                          disabled={isContractProjectReferenceLoading || selectedProjectItems.length === 0}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold leading-[18px] text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-400"
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
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold leading-[18px] text-slate-600 hover:bg-slate-50"
                      >
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>
                          add
                        </span>
                        Thêm hạng mục
                      </button>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-bold text-warning">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>
                      Không thể sửa - đã có kỳ thanh toán
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-auto">
                {shouldUseProjectItemsFallback && (
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                    Hợp đồng này chưa có snapshot riêng cho hạng mục. Hệ thống đang hiển thị tạm từ hạng mục dự án liên kết để bạn đối chiếu.
                  </div>
                )}
                <table className="w-full min-w-[1180px] border-collapse">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="w-14 px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">#</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Sản phẩm/DV</th>
                      <th className="w-52 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">ĐVT</th>
                      <th className="w-32 px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">Số lượng</th>
                      <th className="w-40 px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Đơn giá</th>
                      <th className="w-44 px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Thành tiền trước VAT</th>
                      <th className="w-24 px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">VAT</th>
                      <th className="w-40 px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Tiền VAT</th>
                      <th className="w-44 px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Thành tiền VAT</th>
                      {isItemsEditable && (
                        <th className="w-28 px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">Thao tác</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {visibleContractItems.length === 0 ? (
                      <tr>
                        <td colSpan={isItemsEditable ? 10 : 9} className="px-4 py-5 text-center text-sm text-slate-500">
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
                        const rowProductOptions = productSelectOptions.map((option) => ({
                          ...option,
                          label:
                            String(option.value) === String(rowCatalogValue)
                            && String(item.product_name || '').trim() !== ''
                              ? String(item.product_name || '').trim()
                              : option.label,
                          searchText:
                            String(option.value) === String(rowCatalogValue)
                            && String(item.product_name || '').trim() !== ''
                              ? `${String(item.product_name || '').trim()} ${option.searchText ?? option.label}`
                              : option.searchText,
                        }));

                        return (
                          <tr key={`contract-item-${String(item.id)}`} className="hover:bg-slate-50">
                            <td className="w-14 px-4 py-3 text-center text-sm font-medium text-slate-600">{index + 1}</td>
                            <td className="px-4 py-3 text-sm leading-5 text-on-surface min-w-[260px]">
                              {isItemsEditable ? (
                                <SearchableSelect
                                  value={rowCatalogValue}
                                  onChange={(value) => onDraftProductChange(index, value)}
                                  options={rowProductOptions}
                                  placeholder={isContractProductOptionsLoading ? 'Đang tải gói cước...' : 'Chọn gói cước'}
                                  compact
                                  usePortal
                                  disabled={isContractProductOptionsLoading}
                                  triggerClassName={compactTriggerClass}
                                />
                              ) : (
                                item.product_name || item.product_code || '--'
                              )}
                            </td>
                            <td className="w-52 px-4 py-3 text-left text-sm text-slate-600 whitespace-nowrap">
                              {item.unit || product?.unit || '--'}
                            </td>
                            <td className="w-32 px-4 py-3 text-center text-sm text-slate-600">
                              {isItemsEditable ? (
                                <div className="flex justify-center">
                                  <input
                                    type="number"
                                    min={0.01}
                                    step={0.01}
                                    value={quantity || ''}
                                    onChange={(event) => {
                                      const parsed = Number(event.target.value);
                                      onDraftItemChange(index, 'quantity', Number.isFinite(parsed) ? parsed : 0);
                                    }}
                                    className="h-10 w-24 rounded-lg border border-slate-300 bg-white px-3 text-center text-sm leading-5 text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                                  />
                                </div>
                              ) : (
                                formatQuantity(quantity)
                              )}
                            </td>
                            <td className="w-40 px-4 py-3 text-right text-sm text-slate-600">
                              {isItemsEditable ? (
                                <div className="flex justify-end">
                                  <input
                                    type="text"
                                    value={formatCurrency(unitPrice)}
                                    onChange={(event) => onDraftItemChange(index, 'unit_price', parseCurrency(event.target.value))}
                                    className="h-10 w-40 rounded-lg border border-slate-300 bg-white px-3 text-right text-sm leading-5 text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                                  />
                                </div>
                              ) : (
                                `${formatCurrency(unitPrice)} đ`
                              )}
                            </td>
                            <td className="w-44 px-4 py-3 text-right text-sm font-semibold text-on-surface whitespace-nowrap">
                              {formatCurrency(amountBeforeVat)} đ
                            </td>
                            <td className="w-24 px-4 py-3 text-center">
                              {vatLabel !== '--' ? (
                                <span className="inline-flex items-center rounded-full bg-tertiary/10 px-2 py-1 text-xs font-bold text-tertiary">
                                  {vatLabel}
                                </span>
                              ) : (
                                <span className="text-sm text-slate-400">--</span>
                              )}
                            </td>
                            <td className="w-40 px-4 py-3 text-right text-sm whitespace-nowrap">
                              {isItemsEditable ? (
                                <div className="flex justify-end">
                                  <input
                                    type="text"
                                    value={vatAmount > 0 ? formatCurrency(vatAmount) : ''}
                                    onChange={(event) => onDraftVatAmountChange(index, event.target.value)}
                                    placeholder="0"
                                    className="h-10 w-40 rounded-lg border border-slate-300 bg-white px-3 text-right text-sm leading-5 text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
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
                            <td className="w-44 px-4 py-3 text-right text-sm font-semibold text-on-surface whitespace-nowrap">
                              {formatCurrency(amountWithVat)} đ
                            </td>
                            {isItemsEditable && (
                              <td className="w-28 px-4 py-3 text-center">
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
                      <td colSpan={5} className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Tổng cộng
                      </td>
                      <td className="w-44 px-4 py-2.5 text-right text-sm font-bold text-on-surface">
                        {formatCurrency(visibleDraftItemsTotal)} đ
                      </td>
                      <td className="w-24 px-4 py-2.5" />
                      <td className="w-40 px-4 py-2.5 text-right text-sm font-bold text-on-surface">
                        {formatCurrency(visibleDraftItemsVatTotal)} đ
                      </td>
                      <td className="w-44 px-4 py-2.5 text-right text-sm font-bold text-on-surface">
                        {formatCurrency(visibleDraftItemsGrandTotal)} đ
                      </td>
                      {isItemsEditable && <td className="w-28 px-4 py-2.5" />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {!!inlineNotice && (
          <div className="md:col-span-2 inline-flex items-center gap-1.5 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning">
            <span className="material-symbols-outlined text-warning" style={{ fontSize: 14 }}>
              info
            </span>
            <span>{inlineNotice}</span>
          </div>
        )}

        {areScheduleSourceFieldsLocked && (
          <div className="md:col-span-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 14 }}>lock</span>
            <span>{scheduleSourceLockMessage}</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <SearchableSelect
            label="Trạng thái"
            value={formData.status || 'DRAFT'}
            onChange={(value) => onFieldChange('status', value)}
            options={statusOptions}
            triggerClassName={compactTriggerClass}
            denseLabel
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <SearchableSelect
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

        <div className="flex flex-col gap-1.5">
          <SearchableSelect
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

        <div className="flex flex-col gap-1.5">
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

        <div className="flex flex-col gap-1.5">
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
            <div className="mt-1 rounded border border-primary/20 bg-primary/5 px-3 py-1.5">
              <p className="text-xs leading-relaxed text-deep-teal">
                <span className="font-bold uppercase tracking-wide">Số tiền bằng chữ:</span>{' '}
                <span className="font-bold text-on-surface break-words">{valueInWords}</span>
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <SearchableSelect
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

        <div className="flex flex-col gap-1.5">
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

        <div className="flex flex-col gap-1.5">
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

        <div className="flex flex-col gap-1.5">
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

        <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <div className="mb-3">
            <p className="text-xs font-bold text-slate-700">Tệp hợp đồng</p>
          </div>

          <AttachmentManager
            attachments={attachments}
            onUpload={onUpload}
            onDelete={onDelete}
            isUploading={isUploading}
            compact
            accept={attachmentAccept}
            helperText="Chỉ nhận file PDF cho hợp đồng đầu kỳ hoặc hợp đồng theo dự án."
            emptyStateDescription="Tải lên file PDF để lưu kèm hồ sơ hợp đồng."
            uploadButtonLabel="Tải PDF"
            showSummaryMeta={false}
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
