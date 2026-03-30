import React from 'react';
import type { SupportContactPosition } from '../../types/support';

interface ContactPositionManagementProps {
  items: SupportContactPosition[];
  safePage: number;
  rowsPerPage: number;
  canWriteContactPositions: boolean;
  onEdit: (position: SupportContactPosition) => void;
  resolveAuditActorLabel: (
    actorName?: string | null,
    actorId?: string | number | null
  ) => string;
  resolveAuditDateTimeLabel: (value?: string | null) => string;
}

interface ContactPositionFormFieldsProps {
  positionCode: string;
  positionName: string;
  description: string;
  isActive: boolean;
  isCodeEditable: boolean;
  onPositionCodeChange: (value: string) => void;
  onPositionNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onIsActiveChange: (checked: boolean) => void;
}

export const ContactPositionManagement: React.FC<ContactPositionManagementProps> = ({
  items,
  safePage,
  rowsPerPage,
  canWriteContactPositions,
  onEdit,
  resolveAuditActorLabel,
  resolveAuditDateTimeLabel,
}) => (
  <table className="w-full min-w-[1260px]">
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">STT</th>
        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mã chức vụ</th>
        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Tên chức vụ</th>
        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mô tả</th>
        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Đang dùng</th>
        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái</th>
        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Audit</th>
        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-200">
      {items.map((item, index) => {
        const canEditRow = canWriteContactPositions && item.id !== null && item.id !== undefined;
        const rowNumber = (safePage - 1) * rowsPerPage + index + 1;
        const hasUpdatedAudit = Boolean(
          String(item.updated_at || '').trim() !== ''
            || String(item.updated_by_name || '').trim() !== ''
            || String(item.updated_by ?? '').trim() !== ''
        );

        return (
          <tr key={String(item.id)} className="odd:bg-white even:bg-slate-50/30">
            <td className="px-6 py-4 text-center text-sm font-semibold text-slate-600">{rowNumber}</td>
            <td className="px-6 py-4 text-sm font-mono font-semibold text-slate-800">{item.position_code || '--'}</td>
            <td className="px-6 py-4 text-sm font-semibold text-slate-800">{item.position_name || '--'}</td>
            <td className="px-6 py-4 text-sm text-slate-600">{item.description || '--'}</td>
            <td className="px-6 py-4 text-center text-sm text-slate-600">
              {Number(item.used_in_customer_personnel || 0)}
            </td>
            <td className="px-6 py-4 text-sm">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  item.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {item.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động'}
              </span>
            </td>
            <td className="px-6 py-4 text-sm text-slate-600">
              <div className="space-y-1.5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tạo</p>
                  <p className="font-medium text-slate-700">
                    {resolveAuditActorLabel(item.created_by_name, item.created_by)}
                  </p>
                  <p className="text-xs text-slate-500">{resolveAuditDateTimeLabel(item.created_at)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cập nhật</p>
                  <p className="font-medium text-slate-700">
                    {hasUpdatedAudit
                      ? resolveAuditActorLabel(item.updated_by_name, item.updated_by)
                      : 'Chưa cập nhật'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {hasUpdatedAudit ? resolveAuditDateTimeLabel(item.updated_at) : 'Chưa ghi nhận'}
                  </p>
                </div>
              </div>
            </td>
            <td className="px-6 py-4 text-right">
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
            Không có dữ liệu danh mục chức vụ phù hợp.
          </td>
        </tr>
      )}
    </tbody>
  </table>
);

export const ContactPositionFormFields: React.FC<ContactPositionFormFieldsProps> = ({
  positionCode,
  positionName,
  description,
  isActive,
  isCodeEditable,
  onPositionCodeChange,
  onPositionNameChange,
  onDescriptionChange,
  onIsActiveChange,
}) => (
  <>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">
          Mã chức vụ <span className="text-red-500">*</span>
        </label>
        <input
          value={positionCode}
          disabled={!isCodeEditable}
          onChange={(event) => onPositionCodeChange(event.target.value)}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono"
        />
        <p className="text-xs text-slate-500">Chỉ cho phép chữ và số, không dùng dấu `_`.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">
          Tên chức vụ <span className="text-red-500">*</span>
        </label>
        <input
          value={positionName}
          onChange={(event) => onPositionNameChange(event.target.value)}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
      </div>
    </div>
    {!isCodeEditable && (
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Đã phát sinh dữ liệu, không cho đổi mã chức vụ.
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
