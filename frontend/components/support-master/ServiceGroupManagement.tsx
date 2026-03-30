import React from 'react';
import type { SupportServiceGroup } from '../../types/support';
import { SearchableSelect, SearchableSelectOption } from '../SearchableSelect';

interface ServiceGroupManagementProps {
  items: SupportServiceGroup[];
  canWriteServiceGroups: boolean;
  onEdit: (group: SupportServiceGroup) => void;
}

interface ServiceGroupFormFieldsProps {
  customerId: string;
  groupCode: string;
  groupName: string;
  workflowStatusCatalogId: string;
  workflowFormKey: string;
  description: string;
  isActive: boolean;
  customerOptions: SearchableSelectOption[];
  customerSelectDisabled: boolean;
  customerSelectError: string;
  workflowStatusCatalogOptions: SearchableSelectOption[];
  workflowFormKeyOptions: SearchableSelectOption[];
  onCustomerChange: (value: string) => void;
  onGroupCodeChange: (value: string) => void;
  onGroupNameChange: (value: string) => void;
  onWorkflowStatusCatalogChange: (value: string) => void;
  onWorkflowFormKeyChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onIsActiveChange: (checked: boolean) => void;
}

export const ServiceGroupManagement: React.FC<ServiceGroupManagementProps> = ({
  items,
  canWriteServiceGroups,
  onEdit,
}) => (
  <table className="w-full min-w-[1320px]">
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mã nhóm</th>
        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Tên nhóm</th>
        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Khách hàng</th>
        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Workflow mặc định</th>
        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Form key</th>
        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mô tả</th>
        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Đang dùng</th>
        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái</th>
        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-200">
      {items.map((item) => (
        <tr key={String(item.id)} className="odd:bg-white even:bg-slate-50/30">
          <td className="px-6 py-4 text-sm font-mono font-semibold text-slate-800">{item.group_code || '--'}</td>
          <td className="px-6 py-4 text-sm font-semibold text-slate-800">{item.group_name || '--'}</td>
          <td className="px-6 py-4 text-sm text-slate-600">
            {[item.customer_code, item.customer_name].filter((part) => String(part || '').trim() !== '').join(' - ') || '--'}
          </td>
          <td className="px-6 py-4 text-sm text-slate-600">{item.workflow_status_name || '--'}</td>
          <td className="px-6 py-4 text-sm font-mono text-slate-600">
            {item.workflow_form_key || item.workflow_status_form_key || '--'}
          </td>
          <td className="px-6 py-4 text-sm text-slate-600">{item.description || '--'}</td>
          <td className="px-6 py-4 text-center text-sm text-slate-600">{Number(item.used_in_customer_requests || 0)}</td>
          <td className="px-6 py-4 text-sm">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                item.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {item.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động'}
            </span>
          </td>
          <td className="px-6 py-4 text-right">
            <button
              type="button"
              disabled={!canWriteServiceGroups}
              onClick={() => onEdit(item)}
              className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Cập nhật"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
            </button>
          </td>
        </tr>
      ))}
      {items.length === 0 && (
        <tr>
          <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
            Không có dữ liệu nhóm phù hợp.
          </td>
        </tr>
      )}
    </tbody>
  </table>
);

export const ServiceGroupFormFields: React.FC<ServiceGroupFormFieldsProps> = ({
  customerId,
  groupCode,
  groupName,
  workflowStatusCatalogId,
  workflowFormKey,
  description,
  isActive,
  customerOptions,
  customerSelectDisabled,
  customerSelectError,
  workflowStatusCatalogOptions,
  workflowFormKeyOptions,
  onCustomerChange,
  onGroupCodeChange,
  onGroupNameChange,
  onWorkflowStatusCatalogChange,
  onWorkflowFormKeyChange,
  onDescriptionChange,
  onIsActiveChange,
}) => (
  <>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">
          Khách hàng <span className="text-red-500">*</span>
        </label>
        <SearchableSelect
          value={customerId}
          onChange={onCustomerChange}
          options={customerOptions}
          placeholder="Chọn khách hàng"
          searchPlaceholder="Tìm khách hàng..."
          noOptionsText="Không tìm thấy khách hàng"
          disabled={customerSelectDisabled}
          error={customerSelectError}
          usePortal
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">Mã nhóm</label>
        <input
          value={groupCode}
          onChange={(event) => onGroupCodeChange(event.target.value)}
          placeholder="VD: HIS_L2"
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
        />
        <p className="text-xs text-slate-500">Để trống hệ thống tự sinh theo Tên nhóm.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">
          Tên nhóm <span className="text-red-500">*</span>
        </label>
        <input
          value={groupName}
          onChange={(event) => onGroupNameChange(event.target.value)}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">Workflow mặc định</label>
        <SearchableSelect
          value={workflowStatusCatalogId}
          onChange={onWorkflowStatusCatalogChange}
          options={workflowStatusCatalogOptions}
          placeholder="Chọn workflow mặc định"
          searchPlaceholder="Tìm workflow..."
          noOptionsText="Không tìm thấy workflow"
          usePortal
        />
        <p className="text-xs text-slate-500">
          Dùng để bind danh mục hỗ trợ với trạng thái workflow khởi đầu ở Phase 5 runtime.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">Form key override</label>
        <SearchableSelect
          value={workflowFormKey}
          onChange={onWorkflowFormKeyChange}
          options={workflowFormKeyOptions}
          placeholder="Chọn form key"
          searchPlaceholder="Tìm form key..."
          noOptionsText="Không tìm thấy form key"
          usePortal
        />
        <p className="text-xs text-slate-500">Để trống để dùng `form_key` mặc định của workflow đã chọn.</p>
      </div>
    </div>
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-slate-700">Mô tả</label>
      <textarea
        value={description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        rows={3}
        className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
      />
    </div>
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={isActive}
        onChange={(event) => onIsActiveChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
      />
      Hoạt động
    </label>
  </>
);
