import React from 'react';
import type { WorkflowStatusCatalog } from '../../types/support';
import { SearchableSelect, SearchableSelectOption } from '../SearchableSelect';

interface WorkflowCatalogManagementProps {
  items: WorkflowStatusCatalog[];
  isLoading: boolean;
  canWriteStatuses: boolean;
  onEdit: (item: WorkflowStatusCatalog) => void;
}

interface WorkflowCatalogFormFieldsProps {
  level: number;
  parentId: string;
  statusCode: string;
  statusName: string;
  canonicalStatus: string;
  canonicalSubStatus: string;
  flowStep: string;
  formKey: string;
  sortOrder: number;
  isLeaf: boolean;
  isActive: boolean;
  parentOptions: SearchableSelectOption[];
  onLevelChange: (value: number) => void;
  onParentChange: (value: string) => void;
  onStatusCodeChange: (value: string) => void;
  onStatusNameChange: (value: string) => void;
  onCanonicalStatusChange: (value: string) => void;
  onCanonicalSubStatusChange: (value: string) => void;
  onFlowStepChange: (value: string) => void;
  onFormKeyChange: (value: string) => void;
  onSortOrderChange: (value: number) => void;
  onIsLeafChange: (checked: boolean) => void;
  onIsActiveChange: (checked: boolean) => void;
}

const levelOptions: SearchableSelectOption[] = [
  { value: '1', label: 'Cấp 1' },
  { value: '2', label: 'Cấp 2' },
  { value: '3', label: 'Cấp 3' },
];

export const WorkflowCatalogManagement: React.FC<WorkflowCatalogManagementProps> = ({
  items,
  isLoading,
  canWriteStatuses,
  onEdit,
}) => (
  <table className="w-full min-w-[1480px]">
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Cấp</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mã trạng thái</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Tên trạng thái</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái cha</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Canonical status</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Canonical sub_status</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Flow/Form</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Leaf</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sắp xếp</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-200">
      {isLoading ? (
        <tr>
          <td colSpan={11} className="px-6 py-8 text-center text-slate-500">
            Đang tải cấu hình workflow...
          </td>
        </tr>
      ) : null}
      {items.map((item) => {
        const canEditRow = canWriteStatuses && item.id !== null && item.id !== undefined;

        return (
          <tr key={String(item.id)} className="odd:bg-white even:bg-slate-50/30">
            <td className="px-4 py-4 text-center text-sm text-slate-700">{Number(item.level || 0)}</td>
            <td className="px-4 py-4 text-sm font-mono font-semibold text-slate-800">{item.status_code || '--'}</td>
            <td className="px-4 py-4 text-sm text-slate-700">{item.status_name || '--'}</td>
            <td className="px-4 py-4 text-sm text-slate-700">{item.parent_name || '--'}</td>
            <td className="px-4 py-4 text-sm text-slate-700">{item.canonical_status || '--'}</td>
            <td className="px-4 py-4 text-sm text-slate-700">{item.canonical_sub_status || '--'}</td>
            <td className="px-4 py-4 text-xs text-slate-600">
              <div>{item.flow_step || '--'}</div>
              <div className="text-[11px] text-slate-500">{item.form_key || '--'}</div>
            </td>
            <td className="px-4 py-4 text-center text-sm text-slate-600">{item.is_leaf !== false ? 'Có' : 'Không'}</td>
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
          <td colSpan={11} className="px-6 py-8 text-center text-slate-500">
            Không có dữ liệu cấu hình trạng thái workflow phù hợp.
          </td>
        </tr>
      ) : null}
    </tbody>
  </table>
);

export const WorkflowCatalogFormFields: React.FC<WorkflowCatalogFormFieldsProps> = ({
  level,
  parentId,
  statusCode,
  statusName,
  canonicalStatus,
  canonicalSubStatus,
  flowStep,
  formKey,
  sortOrder,
  isLeaf,
  isActive,
  parentOptions,
  onLevelChange,
  onParentChange,
  onStatusCodeChange,
  onStatusNameChange,
  onCanonicalStatusChange,
  onCanonicalSubStatusChange,
  onFlowStepChange,
  onFormKeyChange,
  onSortOrderChange,
  onIsLeafChange,
  onIsActiveChange,
}) => (
  <>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">Cấp trạng thái</label>
        <SearchableSelect
          value={String(level)}
          onChange={(value) => onLevelChange(Number(value || 1))}
          options={levelOptions}
          placeholder="Chọn cấp trạng thái"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">Trạng thái cha</label>
        <SearchableSelect
          value={parentId}
          onChange={onParentChange}
          disabled={level <= 1}
          options={parentOptions}
          placeholder="Chọn trạng thái cha"
        />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">
          Mã trạng thái <span className="text-red-500">*</span>
        </label>
        <input
          value={statusCode}
          onChange={(event) => onStatusCodeChange(event.target.value)}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">
          Tên trạng thái <span className="text-red-500">*</span>
        </label>
        <input
          value={statusName}
          onChange={(event) => onStatusNameChange(event.target.value)}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">Canonical status</label>
        <input
          value={canonicalStatus}
          onChange={(event) => onCanonicalStatusChange(event.target.value)}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">Canonical sub_status</label>
        <input
          value={canonicalSubStatus}
          onChange={(event) => onCanonicalSubStatusChange(event.target.value)}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
        />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">Flow step</label>
        <input
          value={flowStep}
          onChange={(event) => onFlowStepChange(event.target.value)}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">Form key</label>
        <input
          value={formKey}
          onChange={(event) => onFormKeyChange(event.target.value)}
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
      <div className="grid grid-cols-1 gap-2">
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isLeaf}
            onChange={(event) => onIsLeafChange(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
          />
          Là node lá (leaf)
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
    </div>
  </>
);
