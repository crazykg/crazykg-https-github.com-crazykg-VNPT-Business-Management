import React from 'react';
import { INVESTMENT_MODES } from '../../constants';
import type { Customer, Project, ProjectTypeOption } from '../../types';
import { FormSelect, SearchableSelect, type SearchableSelectOption } from './selectPrimitives';
import { FormInput, ModalWrapper } from './shared';

export type ProjectFormActiveTab = 'info' | 'items' | 'raci' | 'revenue_schedules';

export type ProjectFormSaveNotice =
  | { status: 'idle' }
  | { status: 'success'; message: string; timestamp: number }
  | { status: 'error'; message: string; timestamp: number };

interface ProjectInfoTabProps {
  customers: Customer[];
  data?: Project | null;
  errors: Record<string, string>;
  expectedEndDateMax: string;
  expectedEndDateMin: string;
  formData: Partial<Project>;
  getStatusReasonLabel: (status: unknown) => string;
  handleChange: (field: string, value: any) => void;
  implementationUnitHelpText: string | null;
  implementationUnitOptions: SearchableSelectOption[];
  implementationUnitOptionsError: string;
  isCustomerOptionsLoading: boolean;
  isImplementationUnitOptionsLoading: boolean;
  isOpportunityStatusSelected: boolean;
  isPaymentCycleRequired: boolean;
  isProjectTypeOptionsLoading: boolean;
  isSpecialStatusSelected: boolean;
  onViewProcedure?: (project: Project) => void;
  projectTypes?: ProjectTypeOption[];
  startDateMax: string;
  statusOptions: SearchableSelectOption[];
  statusReasonFieldId: string;
  type: 'ADD' | 'EDIT';
}

const OPPORTUNITY_SCORE_OPTIONS = [
  { value: '0', label: '0 điểm - Thấp' },
  { value: '1', label: '1 điểm - Trung bình' },
  { value: '2', label: '2 điểm - Cao' },
];

export const ProjectInfoTab: React.FC<ProjectInfoTabProps> = ({
  customers,
  data,
  errors,
  expectedEndDateMax,
  expectedEndDateMin,
  formData,
  getStatusReasonLabel,
  handleChange,
  implementationUnitHelpText,
  implementationUnitOptions,
  implementationUnitOptionsError,
  isCustomerOptionsLoading,
  isImplementationUnitOptionsLoading,
  isOpportunityStatusSelected,
  isPaymentCycleRequired,
  isProjectTypeOptionsLoading,
  isSpecialStatusSelected,
  onViewProcedure,
  projectTypes = [],
  startDateMax,
  statusOptions,
  statusReasonFieldId,
  type,
}: ProjectInfoTabProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <FormInput
        label="Mã DA"
        value={formData.project_code}
        onChange={(event: any) => handleChange('project_code', event.target.value)}
        placeholder="DA001"
        required
        error={errors.project_code}
      />

      <FormInput
        label="Tên dự án"
        value={formData.project_name}
        onChange={(event: any) => handleChange('project_name', event.target.value)}
        placeholder="Dự án triển khai..."
        required
        error={errors.project_name}
      />

      <div className="col-span-1">
        <label className="block text-xs font-semibold text-neutral mb-1">Khách hàng</label>
        <SearchableSelect
          size="sm"
          options={[
            { value: '', label: 'Chọn khách hàng...' },
            ...customers.map((customer) => ({
              value: String(customer.id),
              label: `${customer.customer_code} - ${customer.customer_name}`,
            })),
          ]}
          value={String(formData.customer_id || '')}
          onChange={(value) => handleChange('customer_id', value)}
          placeholder={isCustomerOptionsLoading ? 'Đang tải khách hàng...' : 'Chọn khách hàng...'}
          disabled={isCustomerOptionsLoading}
        />
        {isCustomerOptionsLoading ? (
          <p className="mt-1 text-xs text-slate-500">Đang nạp khách hàng cho biểu mẫu dự án.</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <FormSelect
          label="Loại dự án"
          labelClassName="text-xs font-semibold text-neutral"
          size="sm"
          value={formData.investment_mode}
          onChange={(event: any) => handleChange('investment_mode', event.target.value)}
          options={
            projectTypes.length > 0
              ? projectTypes.map((projectType) => ({
                  value: projectType.type_code,
                  label: projectType.type_name,
                }))
              : INVESTMENT_MODES
          }
          disabled={isProjectTypeOptionsLoading}
        />
        {isProjectTypeOptionsLoading ? (
          <p className="mt-1 text-xs text-slate-500">Đang tải danh mục loại dự án.</p>
        ) : null}
      </div>

      <div className="col-span-1">
        <label className="block text-xs font-semibold text-neutral mb-1">
          Trạng thái
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <SearchableSelect
              size="sm"
              value={formData.status}
              onChange={(nextValue) => handleChange('status', nextValue)}
              options={statusOptions}
              placeholder="Chọn trạng thái"
              searchPlaceholder="Tìm trạng thái..."
              error={errors.status}
            />
          </div>
          {type === 'EDIT' && data?.id && onViewProcedure ? (
            <button
              type="button"
              onClick={() => onViewProcedure(data)}
              className="shrink-0 inline-flex items-center gap-1 h-8 px-2.5 rounded text-xs font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>format_list_numbered</span>
              Xem thủ tục
            </button>
          ) : null}
        </div>
        {isSpecialStatusSelected ? (
          <div className="mt-2 flex flex-col gap-1">
            <label htmlFor={statusReasonFieldId} className="text-xs font-semibold text-neutral">
              {getStatusReasonLabel(formData.status)} <span className="text-error">*</span>
            </label>
            <textarea
              id={statusReasonFieldId}
              value={String(formData.status_reason || '')}
              onChange={(event) => handleChange('status_reason', event.target.value)}
              placeholder={`Nhập ${getStatusReasonLabel(formData.status).toLowerCase()}...`}
              rows={3}
              maxLength={2000}
              aria-invalid={Boolean(errors.status_reason)}
              className={`w-full rounded border bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/30 ${errors.status_reason ? 'border-error ring-1 ring-error/30' : 'border-slate-300'}`}
            />
            {errors.status_reason ? (
              <p className="text-[11px] text-error mt-0.5">{errors.status_reason}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {isOpportunityStatusSelected ? (
        <div className="col-span-1">
          <FormSelect
            label="Điểm cơ hội"
            labelClassName="text-xs font-semibold text-neutral"
            size="sm"
            value={formData.opportunity_score ?? '0'}
            onChange={(event: any) => handleChange('opportunity_score', event.target.value)}
            options={OPPORTUNITY_SCORE_OPTIONS}
            required
            error={errors.opportunity_score}
          />
          <p className="mt-1 text-xs text-slate-500">
            Thang điểm cơ hội từ thấp đến cao để ưu tiên xử lý dự án.
          </p>
        </div>
      ) : null}

      {isPaymentCycleRequired ? (
        <div className="col-span-1">
          <SearchableSelect
            label="Chu kỳ thanh toán"
            labelClassName="text-xs font-semibold text-neutral"
            size="sm"
            value={formData.payment_cycle || ''}
            onChange={(value) => handleChange('payment_cycle', value || null)}
            required
            error={errors.payment_cycle}
            placeholder="--- Chọn ---"
            searchPlaceholder="Tìm chu kỳ thanh toán..."
            usePortal
            options={[
              { value: '', label: '--- Chọn ---' },
              { value: 'ONCE', label: '1 lần' },
              { value: 'MONTHLY', label: 'Hàng tháng' },
              { value: 'QUARTERLY', label: 'Hàng quý' },
              { value: 'HALF_YEARLY', label: '6 tháng' },
              { value: 'YEARLY', label: 'Hàng năm' },
            ]}
          />
        </div>
      ) : null}

      <FormInput
        label="Ngày bắt đầu"
        type="date"
        value={formData.start_date}
        onChange={(event: any) => handleChange('start_date', event.target.value)}
        required
        error={errors.start_date}
        max={startDateMax}
      />

      <FormInput
        label="Ngày kết thúc"
        type="date"
        value={formData.expected_end_date}
        onChange={(event: any) => handleChange('expected_end_date', event.target.value)}
        error={errors.expected_end_date}
        min={expectedEndDateMin}
        max={expectedEndDateMax}
      />

      <div className="col-span-1">
        <SearchableSelect
          label="Người phụ trách"
          labelClassName="text-xs font-semibold text-neutral"
          size="sm"
          value={formData.implementation_user_id || ''}
          onChange={(value) => handleChange('implementation_user_id', value || null)}
          placeholder={
            isImplementationUnitOptionsLoading
              ? 'Đang tải người phụ trách...'
              : 'Chọn người phụ trách'
          }
          searchPlaceholder="Tìm người phụ trách..."
          disabled={isImplementationUnitOptionsLoading}
          options={implementationUnitOptions}
          usePortal
        />
        {isImplementationUnitOptionsLoading ? (
          <p className="mt-1 text-xs text-slate-500">
            Đang tải danh sách người phụ trách.
          </p>
        ) : implementationUnitOptionsError ? (
          <p className="mt-1 text-xs text-red-500">
            {implementationUnitOptionsError}
          </p>
        ) : implementationUnitHelpText ? (
          <p className="mt-1 text-xs text-slate-500">
            {implementationUnitHelpText}
          </p>
        ) : null}
      </div>
    </div>
  );
};

interface ProjectFormLayoutProps {
  activeTab: ProjectFormActiveTab;
  content: React.ReactNode;
  disableClose: boolean;
  disableBackdropClose?: boolean;
  importDialogs?: React.ReactNode;
  isPersistedProject: boolean;
  isSubmitDisabled?: boolean;
  isSubmitting: boolean;
  itemCount: number;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  onTabSwitch: (tab: ProjectFormActiveTab) => void;
  raciCount: number;
  saveNotice: ProjectFormSaveNotice;
  submitDisabledMessage?: string | null;
  type: 'ADD' | 'EDIT';
}

export const ProjectFormLayout: React.FC<ProjectFormLayoutProps> = ({
  activeTab,
  content,
  disableClose,
  disableBackdropClose = false,
  importDialogs,
  isPersistedProject,
  isSubmitDisabled = false,
  isSubmitting,
  itemCount,
  onClose,
  onSubmit,
  onTabSwitch,
  raciCount,
  saveNotice,
  submitDisabledMessage,
  type,
}) => {
  return (
    <>
      <ModalWrapper
        onClose={onClose}
        title={type === 'ADD' ? 'Thêm mới Dự án' : 'Cập nhật Dự án'}
        icon="topic"
        width="max-w-7xl"
        maxHeightClass="max-h-[94vh]"
        disableClose={disableClose}
        disableBackdropClose={disableBackdropClose}
      >
        <div className="flex border-b border-slate-200">
          <button
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${activeTab === 'info' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => onTabSwitch('info')}
          >
            Thông tin chung
          </button>
          <button
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
              !isPersistedProject && activeTab !== 'items'
                ? 'border-transparent text-slate-400 cursor-not-allowed'
                : activeTab === 'items'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => onTabSwitch('items')}
            disabled={!isPersistedProject}
          >
            Hạng mục dự án ({itemCount})
          </button>
          <button
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
              !isPersistedProject && activeTab !== 'raci'
                ? 'border-transparent text-slate-400 cursor-not-allowed'
                : activeTab === 'raci'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => onTabSwitch('raci')}
            disabled={!isPersistedProject}
          >
            Đội ngũ dự án ({raciCount})
          </button>
          <button
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
              !isPersistedProject && activeTab !== 'revenue_schedules'
                ? 'border-transparent text-slate-400 cursor-not-allowed'
                : activeTab === 'revenue_schedules'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => onTabSwitch('revenue_schedules')}
            disabled={!isPersistedProject}
          >
            Phân kỳ doanh thu
          </button>
        </div>

        {!isPersistedProject ? (
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
            Lưu dự án thành công để mở tab Hạng mục dự án và Đội ngũ dự án.
          </div>
        ) : null}

        <div className="p-4">
          {content}
          <div className="pb-20"></div>
        </div>

        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 absolute bottom-0 left-0 right-0 z-[60]">
          <div className="min-h-[18px] flex-1 text-xs">
            {saveNotice.status === 'success' ? (
              <p className="text-emerald-700 font-medium">
                {saveNotice.message} Lần gần nhất: {new Date(saveNotice.timestamp).toLocaleTimeString('vi-VN')}.
              </p>
            ) : null}
            {saveNotice.status === 'error' ? (
              <p className="text-rose-600 font-medium">{saveNotice.message}</p>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              Hủy
            </button>
            <button
              onClick={() => void onSubmit()}
              disabled={isSubmitting || isSubmitDisabled}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#004481,#005BAA)' }}
              title={isSubmitDisabled ? submitDisabledMessage || undefined : undefined}
            >
              <span className={`material-symbols-outlined ${isSubmitting ? 'animate-spin' : ''}`} style={{ fontSize: 14 }}>
                {isSubmitting ? 'progress_activity' : 'check'}
              </span>
              {isSubmitting ? 'Đang lưu...' : type === 'ADD' ? 'Lưu' : 'Cập nhật'}
            </button>
          </div>
        </div>
      </ModalWrapper>
      {importDialogs}
    </>
  );
};
