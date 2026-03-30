import React from 'react';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import type { Contract, ContractItem, Product, Project, ProjectItemMaster } from '../../types';
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect';

type ContractSourceMode = 'PROJECT' | 'INITIAL';

interface ContractDraftItemComputedRow {
  product: Product | null;
  vatRate: number | null;
  vatLabel: string;
  amountBeforeVat: number;
  vatAmount: number;
  amountWithVat: number;
}

interface ContractDetailsTabProps {
  formData: Partial<Contract>;
  errors: Record<string, string>;
  sourceMode: ContractSourceMode;
  sourceSelection: {
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
    isItemsEditable: boolean;
    isContractProductOptionsLoading: boolean;
    productSelectOptions: SearchableSelectOption[];
    onAddDraftItem: () => void;
    onRemoveDraftItem: (index: number) => void;
    onDraftProductChange: (index: number, nextProductId: string) => void;
    onDraftItemChange: (index: number, field: keyof ContractItem, value: unknown) => void;
    onDraftVatAmountChange: (index: number, rawValue: string) => void;
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

export const ContractDetailsTab: React.FC<ContractDetailsTabProps> = ({
  formData,
  errors,
  sourceMode,
  sourceSelection,
  projectReference,
  contractItems,
  contractMeta,
  callbacks,
  formatters,
}) => {
  const {
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
    isItemsEditable,
    isContractProductOptionsLoading,
    productSelectOptions,
    onAddDraftItem,
    onRemoveDraftItem,
    onDraftProductChange,
    onDraftItemChange,
    onDraftVatAmountChange,
  } = contractItems;
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

  return (
    <div className="p-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">
            Mã hợp đồng <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.contract_code || ''}
            onChange={(event) => onFieldChange('contract_code', event.target.value)}
            onBlur={() => onFieldBlur('contract_code')}
            placeholder="HD-2026-001"
            className={`w-full h-11 px-4 rounded-lg border bg-white text-slate-900 outline-none transition-all ${
              errors.contract_code
                ? 'border-red-500 ring-1 ring-red-500'
                : 'border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary'
            }`}
          />
          {errors.contract_code && (
            <p className="text-xs text-red-600 inline-flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {errors.contract_code}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">
            Tên hợp đồng <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.contract_name || ''}
            onChange={(event) => onFieldChange('contract_name', event.target.value)}
            onBlur={() => onFieldBlur('contract_name')}
            placeholder="Hợp đồng triển khai giải pháp..."
            className={`w-full h-11 px-4 rounded-lg border bg-white text-slate-900 outline-none transition-all ${
              errors.contract_name
                ? 'border-red-500 ring-1 ring-red-500'
                : 'border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary'
            }`}
          />
          {errors.contract_name && (
            <p className="text-xs text-red-600 inline-flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {errors.contract_name}
            </p>
          )}
        </div>

        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-slate-800">Nguồn hợp đồng</p>
            <p className="text-xs text-slate-500">
              Chọn hợp đồng theo dự án để lấy khách hàng từ dự án, hoặc chuyển sang đầu kỳ khi hợp đồng chưa gắn dự án cụ thể.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSourceModeChange('PROJECT')}
              disabled={areScheduleSourceFieldsLocked}
              className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
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
              className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                sourceMode === 'INITIAL'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
              } disabled:cursor-not-allowed disabled:opacity-60`}
              title={areScheduleSourceFieldsLocked ? projectTypeLockMessage : undefined}
            >
              Đầu kỳ
            </button>
          </div>
        </div>

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
              />
            </div>
          </>
        )}

        {isProjectSelectionLoading && sourceMode === 'PROJECT' && (
          <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Đang tải dữ liệu dự án để liên kết hợp đồng.
          </div>
        )}

        {isInitialCustomerSelectionLoading && sourceMode === 'INITIAL' && (
          <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Đang tải dữ liệu khách hàng cho hợp đồng đầu kỳ.
          </div>
        )}

        {sourceMode === 'PROJECT' && selectedProject && (
          <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Dự án: <span className="font-semibold text-slate-800">{selectedProject.project_code} - {selectedProject.project_name}</span>
            {' | '}KH: <span className="font-semibold text-slate-800">{selectedProjectCustomerName || '--'}</span>
            {' | '}Giá trị hạng mục DA: <span className="font-semibold text-slate-800">{formatCurrency(selectedProjectValue)} VNĐ ({selectedProjectItems.length} HM)</span>
            {' | '}Hình thức: <span className="font-semibold text-slate-800">{selectedProjectInvestmentModeLabel}</span>
            {areScheduleSourceFieldsLocked && (
              <>
                {' | '}
                <span
                  className="inline-flex items-center gap-1 font-semibold text-amber-700"
                  title={projectTypeLockMessage}
                >
                  <span className="material-symbols-outlined text-sm">lock</span>
                  Đã khóa loại dự án
                </span>
              </>
            )}
          </div>
        )}

        {sourceMode === 'INITIAL' && (formData.customer_id || formData.project_type_code) && (
          <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
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
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={onToggleProjectItemsReference}
                className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-left"
              >
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Hạng mục dự án gốc ({selectedProjectItems.length} hạng mục)
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chỉ để tham chiếu read-only từ dự án liên kết, không ràng buộc logic hợp đồng.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                  <span className="material-symbols-outlined text-base">
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
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">#</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Sản phẩm/Dịch vụ</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">SL</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Đơn giá</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Thành tiền</th>
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
                              <td className="px-4 py-3 text-sm font-medium text-slate-600">{index + 1}</td>
                              <td className="px-4 py-3 text-sm text-slate-900">{itemLabel}</td>
                              <td className="px-4 py-3 text-sm text-right text-slate-600">{formatQuantity(quantity)}</td>
                              <td className="px-4 py-3 text-sm text-right text-slate-600">{formatCurrency(unitPrice)} đ</td>
                              <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">{formatCurrency(amount)} đ</td>
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
                        <td className="px-4 py-2.5 text-right text-sm font-bold text-slate-900">
                          {formatCurrency(selectedProjectValue)} đ
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Hạng mục hợp đồng ({draftItems.length} hạng mục)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Snapshot thương mại riêng của hợp đồng, không ghi ngược về dự án.
                    </p>
                  </div>
                  {isItemsEditable ? (
                    <button
                      type="button"
                      onClick={onAddDraftItem}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Thêm hạng mục
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      <span className="material-symbols-outlined text-sm">lock</span>
                      Không thể sửa - đã có kỳ thanh toán
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-auto">
                <table className="w-full min-w-[1180px] border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">#</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Sản phẩm/DV</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">ĐVT</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">SL</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Đơn giá</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Thành tiền trước VAT</th>
                      <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">VAT</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Tiền VAT</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Thành tiền VAT</th>
                      {isItemsEditable && (
                        <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Thao tác</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {draftItems.length === 0 ? (
                      <tr>
                        <td colSpan={isItemsEditable ? 10 : 9} className="px-4 py-5 text-center text-sm text-slate-500">
                          Chưa có hạng mục hợp đồng.
                        </td>
                      </tr>
                    ) : (
                      draftItems.map((item, index) => {
                        const quantity = Number(item.quantity || 0);
                        const unitPrice = Number(item.unit_price || 0);
                        const computedRow = computedRows[index];
                        const product = computedRow?.product || null;
                        const amountBeforeVat = computedRow?.amountBeforeVat ?? 0;
                        const vatLabel = computedRow?.vatLabel ?? '--';
                        const vatAmount = computedRow?.vatAmount ?? 0;
                        const amountWithVat = computedRow?.amountWithVat ?? amountBeforeVat;
                        const hasStoredVatAmount = Number.isFinite(Number(item.vat_amount));
                        const takenProductIds = new Set(
                          draftItems
                            .filter((_, itemIndex) => itemIndex !== index)
                            .map((draftItem) => String(draftItem.product_id || ''))
                            .filter(Boolean)
                        );
                        const rowProductOptions = productSelectOptions.map((option) => ({
                          ...option,
                          disabled: takenProductIds.has(String(option.value)),
                        }));

                        return (
                          <tr key={`contract-item-${String(item.id)}`} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm font-medium text-slate-600">{index + 1}</td>
                            <td className="px-4 py-3 text-sm text-slate-900 min-w-[260px]">
                              {isItemsEditable ? (
                                <SearchableSelect
                                  value={String(item.product_id || '')}
                                  onChange={(value) => onDraftProductChange(index, value)}
                                  options={rowProductOptions}
                                  placeholder={isContractProductOptionsLoading ? 'Đang tải sản phẩm...' : 'Chọn sản phẩm'}
                                  compact
                                  usePortal
                                  disabled={isContractProductOptionsLoading}
                                />
                              ) : (
                                item.product_name || item.product_code || '--'
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                              {item.unit || product?.unit || '--'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-slate-600">
                              {isItemsEditable ? (
                                <input
                                  type="number"
                                  min={0.01}
                                  step={0.01}
                                  value={quantity || ''}
                                  onChange={(event) => {
                                    const parsed = Number(event.target.value);
                                    onDraftItemChange(index, 'quantity', Number.isFinite(parsed) ? parsed : 0);
                                  }}
                                  className="w-24 h-10 rounded-lg border border-slate-300 bg-white px-3 text-right text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
                              ) : (
                                formatQuantity(quantity)
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-slate-600">
                              {isItemsEditable ? (
                                <input
                                  type="text"
                                  value={formatCurrency(unitPrice)}
                                  onChange={(event) => onDraftItemChange(index, 'unit_price', parseCurrency(event.target.value))}
                                  className="w-36 h-10 rounded-lg border border-slate-300 bg-white px-3 text-right text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
                              ) : (
                                `${formatCurrency(unitPrice)} đ`
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900 whitespace-nowrap">
                              {formatCurrency(amountBeforeVat)} đ
                            </td>
                            <td className="px-4 py-3 text-center">
                              {vatLabel !== '--' ? (
                                <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                                  {vatLabel}
                                </span>
                              ) : (
                                <span className="text-sm text-slate-400">--</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                              {isItemsEditable ? (
                                <input
                                  type="text"
                                  value={vatAmount > 0 ? formatCurrency(vatAmount) : ''}
                                  onChange={(event) => onDraftVatAmountChange(index, event.target.value)}
                                  placeholder="0"
                                  className="w-36 h-10 rounded-lg border border-slate-300 bg-white px-3 text-right text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
                              ) : (
                                <span className="font-semibold text-slate-900">
                                  {vatAmount > 0 || hasStoredVatAmount
                                    ? `${formatCurrency(vatAmount)} đ`
                                    : '--'}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900 whitespace-nowrap">
                              {formatCurrency(amountWithVat)} đ
                            </td>
                            {isItemsEditable && (
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => onRemoveDraftItem(index)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                                  aria-label={`Xóa hạng mục ${index + 1}`}
                                >
                                  <Trash2 className="w-4 h-4" />
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
                      <td className="px-4 py-2.5 text-right text-sm font-bold text-slate-900">
                        {formatCurrency(draftItemsTotal)} đ
                      </td>
                      <td className="px-4 py-2.5" />
                      <td className="px-4 py-2.5 text-right text-sm font-bold text-slate-900">
                        {formatCurrency(draftItemsVatTotal)} đ
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm font-bold text-slate-900">
                        {formatCurrency(draftItemsGrandTotal)} đ
                      </td>
                      {isItemsEditable && <td className="px-4 py-2.5" />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {!!inlineNotice && (
          <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 inline-flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{inlineNotice}</span>
          </div>
        )}

        {areScheduleSourceFieldsLocked && (
          <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-slate-500">lock</span>
            <span>{scheduleSourceLockMessage}</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <SearchableSelect
            label="Trạng thái"
            value={formData.status || 'DRAFT'}
            onChange={(value) => onFieldChange('status', value)}
            options={statusOptions}
            disabled={areScheduleSourceFieldsLocked}
          />
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
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">Ngày ký</label>
          <input
            type="date"
            value={formData.sign_date || ''}
            onChange={(event) => onFieldChange('sign_date', event.target.value)}
            onBlur={() => onFieldBlur('sign_date')}
            disabled={areScheduleSourceFieldsLocked}
            className={`w-full h-11 px-4 rounded-lg border bg-white text-slate-900 outline-none transition-all ${
              errors.sign_date
                ? 'border-red-500 ring-1 ring-red-500'
                : 'border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary'
            }`}
          />
          {errors.sign_date && (
            <p className="text-xs text-red-600 inline-flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {errors.sign_date}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-semibold text-slate-700">Giá trị hợp đồng (VNĐ)</label>
          </div>
          <div className="relative">
            <input
              type="text"
              value={formatCurrency(formData.value || 0)}
              onChange={(event) => onFieldChange('value', event.target.value)}
              onBlur={() => onFieldBlur('value')}
              disabled={areScheduleSourceFieldsLocked}
              placeholder="0"
              className={`w-full h-11 pl-4 pr-10 rounded-lg border bg-white text-slate-900 outline-none transition-all font-bold ${
                errors.value
                  ? 'border-red-500 ring-1 ring-red-500'
                  : 'border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary'
              }`}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400 font-bold">₫</div>
          </div>
          {errors.value ? (
            <p className="text-xs text-red-600 inline-flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {errors.value}
            </p>
          ) : showZeroValueWarning ? (
            <p className="text-xs text-amber-700 inline-flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Giá trị hợp đồng đang bằng 0 VNĐ. Vui lòng kiểm tra trước khi lưu.
            </p>
          ) : null}
          {!errors.value && (
            <div className="mt-1 rounded-md border border-primary/20 bg-primary/5 px-3 py-1.5">
              <p className="text-xs leading-relaxed text-deep-teal">
                <span className="font-bold uppercase tracking-wide">Số tiền bằng chữ:</span>{' '}
                <span className="font-bold text-slate-900 break-words">{valueInWords}</span>
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
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">Thời hạn hợp đồng</label>
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
            className={`w-full h-11 px-4 rounded-lg border bg-white text-slate-900 outline-none transition-all ${
              errors.term_value
                ? 'border-red-500 ring-1 ring-red-500'
                : 'border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary'
            }`}
          />
          {errors.term_value ? (
            <p className="text-xs text-red-600 inline-flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {errors.term_value}
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Mốc tính hạn: Ngày hiệu lực {'->'} Ngày ký {'->'} hôm qua. Công thức: hạn = mốc bắt đầu + N - 1.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">
            Ngày hiệu lực
            {!isStatusDraft && <span className="text-red-500"> *</span>}
          </label>
          <input
            type="date"
            value={formData.effective_date || ''}
            onChange={(event) => onFieldChange('effective_date', event.target.value)}
            onBlur={() => onFieldBlur('effective_date')}
            disabled={areScheduleSourceFieldsLocked}
            className={`w-full h-11 px-4 rounded-lg border text-slate-900 outline-none transition-all ${
              errors.effective_date
                ? 'border-red-500 ring-1 ring-red-500 bg-white'
                : !isStatusDraft
                  ? 'border-amber-300 bg-amber-50/50 focus:ring-2 focus:ring-amber-200 focus:border-amber-400'
                  : 'border-slate-300 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary'
            }`}
          />
          {errors.effective_date && (
            <p className="text-xs text-red-600 inline-flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {errors.effective_date}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-semibold text-slate-700">
              Ngày hết hiệu lực
              {!isStatusDraft && <span className="text-red-500"> *</span>}
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
            className={`w-full h-11 px-4 rounded-lg border text-slate-900 outline-none transition-all ${
              errors.expiry_date
                ? 'border-red-500 ring-1 ring-red-500 bg-white'
                : !isStatusDraft
                  ? 'border-amber-300 bg-amber-50/50 focus:ring-2 focus:ring-amber-200 focus:border-amber-400'
                  : 'border-slate-300 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary'
            }`}
          />
          {errors.expiry_date && (
            <p className="text-xs text-red-600 inline-flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {errors.expiry_date}
            </p>
          )}
          {!errors.expiry_date && expiryDateManualOverride && (
            <p className="text-xs text-slate-500">Đang dùng ngày hết hiệu lực chỉnh tay.</p>
          )}
        </div>
      </div>
    </div>
  );
};
