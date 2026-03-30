import React from 'react';
import type { WorkflowStatusTransition } from '../../types/support';
import { SearchableSelect, SearchableSelectOption } from '../SearchableSelect';

interface WorkflowTransitionManagementProps {
  items: WorkflowStatusTransition[];
  isLoading: boolean;
  canWriteStatuses: boolean;
  onEdit: (item: WorkflowStatusTransition) => void;
}

interface WorkflowTransitionFormFieldsProps {
  fromStatusCatalogId: string;
  toStatusCatalogId: string;
  actionCode: string;
  actionName: string;
  requiredRole: string;
  notifyTargetsText: string;
  sortOrder: number;
  isActive: boolean;
  conditionJsonText: string;
  fromStatusOptions: SearchableSelectOption[];
  toStatusOptions: SearchableSelectOption[];
  onFromStatusChange: (value: string) => void;
  onToStatusChange: (value: string) => void;
  onActionCodeChange: (value: string) => void;
  onActionNameChange: (value: string) => void;
  onRequiredRoleChange: (value: string) => void;
  onNotifyTargetsChange: (value: string) => void;
  onSortOrderChange: (value: number) => void;
  onIsActiveChange: (checked: boolean) => void;
  onConditionJsonChange: (value: string) => void;
}

const roleOptions: SearchableSelectOption[] = [
  { value: '', label: 'Không giới hạn' },
  { value: 'ANY', label: 'ANY' },
  { value: 'ADMIN', label: 'ADMIN' },
  { value: 'PM', label: 'PM' },
  { value: 'EXECUTOR', label: 'EXECUTOR' },
  { value: 'CREATOR', label: 'CREATOR' },
  { value: 'CUSTOMER', label: 'CUSTOMER' },
  { value: 'OTHER', label: 'OTHER' },
];

export const WorkflowTransitionManagement: React.FC<WorkflowTransitionManagementProps> = ({
  items,
  isLoading,
  canWriteStatuses,
  onEdit,
}) => (
  <table className="w-full min-w-[1480px]">
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái nguồn</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái đích</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Action</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Vai trò</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Notify targets</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sắp xếp</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-200">
      {isLoading ? (
        <tr>
          <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
            Đang tải cấu hình transition workflow...
          </td>
        </tr>
      ) : null}
      {items.map((item) => {
        const canEditRow = canWriteStatuses && item.id !== null && item.id !== undefined;

        return (
          <tr key={String(item.id)} className="odd:bg-white even:bg-slate-50/30">
            <td className="px-4 py-4 text-sm text-slate-700">{item.from_status_name || `#${String(item.from_status_catalog_id || '--')}`}</td>
            <td className="px-4 py-4 text-sm text-slate-700">{item.to_status_name || `#${String(item.to_status_catalog_id || '--')}`}</td>
            <td className="px-4 py-4 text-xs text-slate-600">
              <div className="font-mono font-semibold text-slate-800">{item.action_code || '--'}</div>
              <div>{item.action_name || '--'}</div>
            </td>
            <td className="px-4 py-4 text-sm text-slate-700">{item.required_role || 'ANY'}</td>
            <td className="px-4 py-4 text-sm text-slate-600">
              {Array.isArray(item.notify_targets_json) && item.notify_targets_json.length > 0
                ? item.notify_targets_json.join(', ')
                : '--'}
            </td>
            <td className="px-4 py-4 text-center text-sm text-slate-600">{Number(item.sort_order ?? 0)}</td>
            <td className="px-4 py-4 text-center text-sm">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  item.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {item.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động'}
              </span>
            </td>
            <td className="px-4 py-4 text-right">
              <button
                type="button"
                disabled={!canEditRow}
                onClick={() => onEdit(item)}
                className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Cập nhật"
              >
                <span className="material-symbols-outlined text-lg">edit</span>
              </button>
            </td>
          </tr>
        );
      })}
      {!isLoading && items.length === 0 ? (
        <tr>
          <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
            Không có dữ liệu transition workflow phù hợp.
          </td>
        </tr>
      ) : null}
    </tbody>
  </table>
);

export const WorkflowTransitionFormFields: React.FC<WorkflowTransitionFormFieldsProps> = ({
  fromStatusCatalogId,
  toStatusCatalogId,
  actionCode,
  actionName,
  requiredRole,
  notifyTargetsText,
  sortOrder,
  isActive,
  conditionJsonText,
  fromStatusOptions,
  toStatusOptions,
  onFromStatusChange,
  onToStatusChange,
  onActionCodeChange,
  onActionNameChange,
  onRequiredRoleChange,
  onNotifyTargetsChange,
  onSortOrderChange,
  onIsActiveChange,
  onConditionJsonChange,
}) => (
  <>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">
          Trạng thái nguồn <span className="text-red-500">*</span>
        </label>
        <SearchableSelect
          value={fromStatusCatalogId}
          onChange={onFromStatusChange}
          options={fromStatusOptions}
          placeholder="Chọn trạng thái nguồn"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">
          Trạng thái đích <span className="text-red-500">*</span>
        </label>
        <SearchableSelect
          value={toStatusCatalogId}
          onChange={onToStatusChange}
          options={toStatusOptions}
          placeholder="Chọn trạng thái đích"
        />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">
          Action code <span className="text-red-500">*</span>
        </label>
        <input
          value={actionCode}
          onChange={(event) => onActionCodeChange(event.target.value)}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">
          Tên hành động <span className="text-red-500">*</span>
        </label>
        <input
          value={actionName}
          onChange={(event) => onActionNameChange(event.target.value)}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">Vai trò được phép</label>
        <SearchableSelect
          value={requiredRole}
          onChange={onRequiredRoleChange}
          options={roleOptions}
          placeholder="Chọn vai trò"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">Notify targets</label>
        <input
          value={notifyTargetsText}
          onChange={(event) => onNotifyTargetsChange(event.target.value)}
          placeholder="VD: PM, CREATOR, EXECUTOR"
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">Thứ tự sắp xếp</label>
        <input
          type="number"
          min={0}
          value={sortOrder}
          onChange={(event) => onSortOrderChange(Number(event.target.value || 0))}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-slate-700 mt-8">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => onIsActiveChange(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
        />
        Hoạt động
      </label>
    </div>
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-slate-700">Condition JSON (tùy chọn)</label>
      <textarea
        value={conditionJsonText}
        onChange={(event) => onConditionJsonChange(event.target.value)}
        rows={5}
        placeholder='VD: {"requires_assignment": true}'
        className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y font-mono text-sm"
      />
    </div>
  </>
);
