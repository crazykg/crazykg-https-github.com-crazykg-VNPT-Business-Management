import React from 'react';
import type { WorklogActivityTypeOption } from '../../types/support';
import { SearchableSelect, SearchableSelectOption } from '../SearchableSelect';

interface WorklogActivityManagementProps {
  items: WorklogActivityTypeOption[];
  canWriteWorklogActivityTypes: boolean;
  onEdit: (item: WorklogActivityTypeOption) => void;
}

interface WorklogActivityFormFieldsProps {
  code: string;
  name: string;
  phaseHint: string;
  sortOrder: number;
  description: string;
  defaultIsBillable: boolean;
  isActive: boolean;
  isCodeEditable: boolean;
  onCodeChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onPhaseHintChange: (value: string) => void;
  onSortOrderChange: (value: number) => void;
  onDescriptionChange: (value: string) => void;
  onDefaultIsBillableChange: (checked: boolean) => void;
  onIsActiveChange: (checked: boolean) => void;
}

const phaseHintOptions: SearchableSelectOption[] = [
  { value: '', label: 'Khong gioi han' },
  { value: 'SUPPORT_HANDLE', label: 'SUPPORT_HANDLE' },
  { value: 'ANALYZE', label: 'ANALYZE' },
  { value: 'CODE', label: 'CODE' },
  { value: 'UPCODE', label: 'UPCODE' },
  { value: 'OTHER', label: 'OTHER' },
];

export const WorklogActivityManagement: React.FC<WorklogActivityManagementProps> = ({
  items,
  canWriteWorklogActivityTypes,
  onEdit,
}) => (
  <table className="w-full min-w-[1240px]">
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mã</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Tên loại công việc</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Phase hint</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Mặc định tính phí</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sắp xếp</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Đang dùng</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-200">
      {items.map((item) => {
        const canEditRow = canWriteWorklogActivityTypes && item.id !== null && item.id !== undefined;

        return (
          <tr key={String(item.id ?? item.code)} className="odd:bg-white even:bg-slate-50/30">
            <td className="px-4 py-4 text-sm font-mono font-semibold text-slate-800">{item.code || '--'}</td>
            <td className="px-4 py-4 text-sm text-slate-700">{item.name || '--'}</td>
            <td className="px-4 py-4 text-sm text-slate-600">{item.phase_hint || '--'}</td>
            <td className="px-4 py-4 text-center text-sm text-slate-600">
              {item.default_is_billable !== false ? 'Có' : 'Không'}
            </td>
            <td className="px-4 py-4 text-center text-sm text-slate-600">{Number(item.sort_order ?? 0)}</td>
            <td className="px-4 py-4 text-center text-sm text-slate-600">{Number(item.used_in_worklogs || 0)}</td>
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
          <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
            Không có dữ liệu loại công việc phù hợp.
          </td>
        </tr>
      )}
    </tbody>
  </table>
);

export const WorklogActivityFormFields: React.FC<WorklogActivityFormFieldsProps> = ({
  code,
  name,
  phaseHint,
  sortOrder,
  description,
  defaultIsBillable,
  isActive,
  isCodeEditable,
  onCodeChange,
  onNameChange,
  onPhaseHintChange,
  onSortOrderChange,
  onDescriptionChange,
  onDefaultIsBillableChange,
  onIsActiveChange,
}) => (
  <>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">
          Mã loại công việc <span className="text-red-500">*</span>
        </label>
        <input
          value={code}
          disabled={!isCodeEditable}
          onChange={(event) => onCodeChange(event.target.value)}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">
          Tên loại công việc <span className="text-red-500">*</span>
        </label>
        <input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
      </div>
    </div>
    {!isCodeEditable && (
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Đã phát sinh dữ liệu, không cho đổi mã loại công việc.
      </p>
    )}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">Phase hint</label>
        <SearchableSelect
          value={phaseHint}
          onChange={onPhaseHintChange}
          options={phaseHintOptions}
          placeholder="Chọn phase"
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={defaultIsBillable}
          onChange={(event) => onDefaultIsBillableChange(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
        />
        Mặc định tính phí
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
