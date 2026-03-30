import React from 'react';
import type { ProjectTypeOption } from '../../types/project';

interface ProjectTypeManagementProps {
  items: ProjectTypeOption[];
  canWriteProjectTypes: boolean;
  onEdit: (item: ProjectTypeOption) => void;
}

interface ProjectTypeFormFieldsProps {
  typeCode: string;
  typeName: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  isCodeEditable: boolean;
  onTypeCodeChange: (value: string) => void;
  onTypeCodeBlur: () => void;
  onTypeNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onIsActiveChange: (checked: boolean) => void;
  onSortOrderChange: (value: number) => void;
}

export const ProjectTypeManagement: React.FC<ProjectTypeManagementProps> = ({
  items,
  canWriteProjectTypes,
  onEdit,
}) => {
  return (
    <table className="w-full min-w-[1040px]">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr>
          <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mã</th>
          <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Tên loại dự án</th>
          <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mô tả</th>
          <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sắp xếp</th>
          <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Đang dùng</th>
          <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái</th>
          <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200">
        {items.map((item) => {
          const canEditRow = canWriteProjectTypes && item.id !== null && item.id !== undefined;
          const usedInProjects = Number(item.used_in_projects || 0);

          return (
            <tr key={String(item.id ?? item.type_code)} className="odd:bg-white even:bg-slate-50/30">
              <td className="px-4 py-4 text-sm font-mono font-semibold text-slate-800">{item.type_code || '--'}</td>
              <td className="px-4 py-4 text-sm text-slate-700">{item.type_name || '--'}</td>
              <td className="px-4 py-4 text-sm text-slate-600">{item.description || '--'}</td>
              <td className="px-4 py-4 text-center text-sm text-slate-600">{Number(item.sort_order ?? 0)}</td>
              <td className="px-4 py-4 text-center text-sm text-slate-600">{usedInProjects}</td>
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
                  title={canEditRow ? 'Cập nhật' : 'Không thể cập nhật loại dự án chưa đồng bộ DB'}
                >
                  <span className="material-symbols-outlined text-lg">edit</span>
                </button>
              </td>
            </tr>
          );
        })}
        {items.length === 0 && (
          <tr>
            <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
              Không có loại dự án phù hợp.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

export const ProjectTypeFormFields: React.FC<ProjectTypeFormFieldsProps> = ({
  typeCode,
  typeName,
  description,
  isActive,
  sortOrder,
  isCodeEditable,
  onTypeCodeChange,
  onTypeCodeBlur,
  onTypeNameChange,
  onDescriptionChange,
  onIsActiveChange,
  onSortOrderChange,
}) => {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">
            Mã loại dự án <span className="text-red-500">*</span>
          </label>
          <input
            value={typeCode}
            disabled={!isCodeEditable}
            onChange={(event) => onTypeCodeChange(event.target.value)}
            onBlur={onTypeCodeBlur}
            className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">
            Tên loại dự án <span className="text-red-500">*</span>
          </label>
          <input
            value={typeName}
            onChange={(event) => onTypeNameChange(event.target.value)}
            className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>
      </div>
      {!isCodeEditable && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Đã phát sinh dữ liệu, không cho đổi mã.
        </p>
      )}
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
            checked={isActive}
            onChange={(event) => onIsActiveChange(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
          />
          Hoạt động
        </label>
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
    </>
  );
};
