import React from 'react';
import type { SupportSlaConfigOption } from '../../types/support';
import { SearchableSelect, SearchableSelectOption } from '../SearchableSelect';

interface SlaConfigManagementProps {
  items: SupportSlaConfigOption[];
  canWriteSlaConfigs: boolean;
  onEdit: (item: SupportSlaConfigOption) => void;
}

interface SlaConfigFormFieldsProps {
  status: string;
  subStatus: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  slaHours: number;
  requestTypePrefix: string;
  serviceGroupId: string;
  workflowActionCode: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  isStatusEditable: boolean;
  serviceGroupOptions: SearchableSelectOption[];
  workflowActionOptions: SearchableSelectOption[];
  onStatusChange: (value: string) => void;
  onSubStatusChange: (value: string) => void;
  onPriorityChange: (value: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT') => void;
  onSlaHoursChange: (value: number) => void;
  onRequestTypePrefixChange: (value: string) => void;
  onServiceGroupChange: (value: string) => void;
  onWorkflowActionCodeChange: (value: string) => void;
  onSortOrderChange: (value: number) => void;
  onDescriptionChange: (value: string) => void;
  onIsActiveChange: (checked: boolean) => void;
}

const priorityOptions: SearchableSelectOption[] = [
  { value: 'LOW', label: 'LOW' },
  { value: 'MEDIUM', label: 'MEDIUM' },
  { value: 'HIGH', label: 'HIGH' },
  { value: 'URGENT', label: 'URGENT' },
];

export const SlaConfigManagement: React.FC<SlaConfigManagementProps> = ({
  items,
  canWriteSlaConfigs,
  onEdit,
}) => (
  <table className="w-full min-w-[1320px]">
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái phụ</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Ưu tiên</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">SLA (giờ)</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Prefix</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Nhóm hỗ trợ</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Action</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sắp xếp</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mô tả</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-200">
      {items.map((item) => {
        const canEditRow = canWriteSlaConfigs && item.id !== null && item.id !== undefined;

        return (
          <tr key={String(item.id)} className="odd:bg-white even:bg-slate-50/30">
            <td className="px-4 py-4 text-sm font-mono font-semibold text-slate-800">{item.status || '--'}</td>
            <td className="px-4 py-4 text-sm text-slate-700">{item.sub_status || '--'}</td>
            <td className="px-4 py-4 text-sm text-slate-700">{item.priority || '--'}</td>
            <td className="px-4 py-4 text-center text-sm text-slate-600">{Number(item.sla_hours ?? 0)}</td>
            <td className="px-4 py-4 text-sm text-slate-700">{item.request_type_prefix || '--'}</td>
            <td className="px-4 py-4 text-sm text-slate-700">{item.service_group_name || '--'}</td>
            <td className="px-4 py-4 text-sm font-mono text-slate-700">{item.workflow_action_code || '--'}</td>
            <td className="px-4 py-4 text-center text-sm text-slate-600">{Number(item.sort_order ?? 0)}</td>
            <td className="px-4 py-4 text-sm text-slate-600">{item.description || '--'}</td>
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
      {items.length === 0 && (
        <tr>
          <td colSpan={11} className="px-6 py-8 text-center text-slate-500">
            Không có dữ liệu cấu hình SLA phù hợp.
          </td>
        </tr>
      )}
    </tbody>
  </table>
);

export const SlaConfigFormFields: React.FC<SlaConfigFormFieldsProps> = ({
  status,
  subStatus,
  priority,
  slaHours,
  requestTypePrefix,
  serviceGroupId,
  workflowActionCode,
  description,
  sortOrder,
  isActive,
  isStatusEditable,
  serviceGroupOptions,
  workflowActionOptions,
  onStatusChange,
  onSubStatusChange,
  onPriorityChange,
  onSlaHoursChange,
  onRequestTypePrefixChange,
  onServiceGroupChange,
  onWorkflowActionCodeChange,
  onSortOrderChange,
  onDescriptionChange,
  onIsActiveChange,
}) => (
  <>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">
          Trạng thái <span className="text-red-500">*</span>
        </label>
        <input
          value={status}
          disabled={!isStatusEditable}
          onChange={(event) => onStatusChange(event.target.value)}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">Trạng thái phụ</label>
        <input
          value={subStatus}
          disabled={!isStatusEditable}
          onChange={(event) => onSubStatusChange(event.target.value)}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono"
        />
      </div>
    </div>
    {!isStatusEditable && (
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Rule này đã phát sinh sử dụng, không cho đổi cặp trạng thái.
      </p>
    )}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">Mức ưu tiên</label>
        <SearchableSelect
          value={priority}
          onChange={(value) => onPriorityChange(String(value || 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT')}
          options={priorityOptions}
          placeholder="Chọn mức ưu tiên"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">SLA (giờ)</label>
        <input
          type="number"
          min={0}
          step="0.5"
          value={slaHours}
          onChange={(event) => onSlaHoursChange(Number(event.target.value || 0))}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">Prefix yêu cầu (tùy chọn)</label>
        <input
          value={requestTypePrefix}
          onChange={(event) => onRequestTypePrefixChange(event.target.value)}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">Nhóm hỗ trợ (tùy chọn)</label>
        <SearchableSelect
          value={serviceGroupId}
          onChange={onServiceGroupChange}
          options={serviceGroupOptions}
          placeholder="Chọn nhóm hỗ trợ"
        />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">Workflow action code (tùy chọn)</label>
        <SearchableSelect
          value={workflowActionCode}
          onChange={onWorkflowActionCodeChange}
          options={workflowActionOptions}
          placeholder="Chọn action workflow"
        />
      </div>
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
