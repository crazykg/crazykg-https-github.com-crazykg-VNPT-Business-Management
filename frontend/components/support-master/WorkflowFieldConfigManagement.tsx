import React from 'react';
import type { WorkflowFormFieldConfig } from '../../types/support';
import { SearchableSelect, SearchableSelectOption } from '../SearchableSelect';

interface WorkflowFieldConfigManagementProps {
  items: WorkflowFormFieldConfig[];
  isLoading: boolean;
  canWriteStatuses: boolean;
  onEdit: (item: WorkflowFormFieldConfig) => void;
}

interface WorkflowFieldConfigFormFieldsProps {
  statusCatalogId: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  excelColumn: string;
  sortOrder: number;
  optionsJsonText: string;
  required: boolean;
  isActive: boolean;
  statusOptions: SearchableSelectOption[];
  onStatusCatalogChange: (value: string) => void;
  onFieldKeyChange: (value: string) => void;
  onFieldLabelChange: (value: string) => void;
  onFieldTypeChange: (value: string) => void;
  onExcelColumnChange: (value: string) => void;
  onSortOrderChange: (value: number) => void;
  onOptionsJsonChange: (value: string) => void;
  onRequiredChange: (checked: boolean) => void;
  onIsActiveChange: (checked: boolean) => void;
}

const fieldTypeOptions: SearchableSelectOption[] = [
  { value: 'text', label: 'text' },
  { value: 'textarea', label: 'textarea' },
  { value: 'date', label: 'date' },
  { value: 'number', label: 'number' },
  { value: 'boolean', label: 'boolean' },
  { value: 'user', label: 'user' },
  { value: 'customer', label: 'customer' },
  { value: 'service_group', label: 'service_group' },
  { value: 'task_ref', label: 'task_ref' },
  { value: 'task_list', label: 'task_list' },
  { value: 'worklog', label: 'worklog' },
  { value: 'select', label: 'select' },
];

export const WorkflowFieldConfigManagement: React.FC<WorkflowFieldConfigManagementProps> = ({
  items,
  isLoading,
  canWriteStatuses,
  onEdit,
}) => (
  <table className="w-full min-w-[1380px]">
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái workflow</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Field key</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Field label</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Field type</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Bắt buộc</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Excel cột</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sắp xếp</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-200">
      {isLoading ? (
        <tr>
          <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
            Đang tải schema field workflow...
          </td>
        </tr>
      ) : null}
      {items.map((item) => {
        const canEditRow = canWriteStatuses && item.id !== null && item.id !== undefined;

        return (
          <tr key={String(item.id)} className="odd:bg-white even:bg-slate-50/30">
            <td className="px-4 py-4 text-sm text-slate-700">{item.status_name || `#${String(item.status_catalog_id || '--')}`}</td>
            <td className="px-4 py-4 text-sm font-mono font-semibold text-slate-800">{item.field_key || '--'}</td>
            <td className="px-4 py-4 text-sm text-slate-700">{item.field_label || '--'}</td>
            <td className="px-4 py-4 text-sm text-slate-700">{item.field_type || '--'}</td>
            <td className="px-4 py-4 text-center text-sm text-slate-600">{item.required === true ? 'Có' : 'Không'}</td>
            <td className="px-4 py-4 text-center text-sm font-mono text-slate-600">{item.excel_column || '--'}</td>
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
          <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
            Không có dữ liệu schema field workflow phù hợp.
          </td>
        </tr>
      ) : null}
    </tbody>
  </table>
);

export const WorkflowFieldConfigFormFields: React.FC<WorkflowFieldConfigFormFieldsProps> = ({
  statusCatalogId,
  fieldKey,
  fieldLabel,
  fieldType,
  excelColumn,
  sortOrder,
  optionsJsonText,
  required,
  isActive,
  statusOptions,
  onStatusCatalogChange,
  onFieldKeyChange,
  onFieldLabelChange,
  onFieldTypeChange,
  onExcelColumnChange,
  onSortOrderChange,
  onOptionsJsonChange,
  onRequiredChange,
  onIsActiveChange,
}) => (
  <>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">
          Trạng thái workflow <span className="text-red-500">*</span>
        </label>
        <SearchableSelect
          value={statusCatalogId}
          onChange={onStatusCatalogChange}
          options={statusOptions}
          placeholder="Chọn trạng thái workflow"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">
          Field key <span className="text-red-500">*</span>
        </label>
        <input
          value={fieldKey}
          onChange={(event) => onFieldKeyChange(event.target.value)}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
        />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">
          Field label <span className="text-red-500">*</span>
        </label>
        <input
          value={fieldLabel}
          onChange={(event) => onFieldLabelChange(event.target.value)}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">Field type</label>
        <SearchableSelect
          value={fieldType}
          onChange={onFieldTypeChange}
          options={fieldTypeOptions}
          placeholder="Chọn field type"
        />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">Excel column</label>
        <input
          value={excelColumn}
          onChange={(event) => onExcelColumnChange(event.target.value)}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
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
      <label className="text-sm font-semibold text-slate-700">Options JSON (cho kiểu select)</label>
      <textarea
        rows={5}
        value={optionsJsonText}
        onChange={(event) => onOptionsJsonChange(event.target.value)}
        placeholder='Ví dụ: [{"value":"SUCCESS","label":"SUCCESS"}]'
        className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y font-mono text-xs"
      />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={required}
          onChange={(event) => onRequiredChange(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
        />
        Bắt buộc nhập
      </label>
      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => onIsActiveChange(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
        />
        Hoạt động
      </label>
    </div>
  </>
);
