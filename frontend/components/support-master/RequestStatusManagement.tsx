import React from 'react';
import type { SupportRequestStatusOption } from '../../types/support';

interface RequestStatusManagementProps {
  items: SupportRequestStatusOption[];
  canWriteStatuses: boolean;
  onEdit: (status: SupportRequestStatusOption) => void;
}

interface RequestStatusFormFieldsProps {
  statusCode: string;
  statusName: string;
  description: string;
  requiresCompletionDates: boolean;
  isTransferDev: boolean;
  isTerminal: boolean;
  isActive: boolean;
  sortOrder: number;
  isCodeEditable: boolean;
  onStatusCodeChange: (value: string) => void;
  onStatusNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onRequiresCompletionDatesChange: (checked: boolean) => void;
  onIsTransferDevChange: (checked: boolean) => void;
  onIsTerminalChange: (checked: boolean) => void;
  onIsActiveChange: (checked: boolean) => void;
  onSortOrderChange: (value: number) => void;
}

export const RequestStatusManagement: React.FC<RequestStatusManagementProps> = ({
  items,
  canWriteStatuses,
  onEdit,
}) => (
  <table className="w-full min-w-[1240px]">
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mã</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Tên trạng thái</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Bắt buộc hạn</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Chuyển Dev</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Kết thúc</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sắp xếp</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Đang dùng</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái</th>
        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-200">
      {items.map((item) => {
        const usedInRequests = Number(item.used_in_requests || 0);
        const usedInHistory = Number(item.used_in_history || 0);
        const canEditRow = canWriteStatuses && item.id !== null && item.id !== undefined;

        return (
          <tr key={String(item.id ?? item.status_code)} className="odd:bg-white even:bg-slate-50/30">
            <td className="px-4 py-4 text-sm font-mono font-semibold text-slate-800">{item.status_code || '--'}</td>
            <td className="px-4 py-4 text-sm text-slate-700">{item.status_name || '--'}</td>
            <td className="px-4 py-4 text-center text-sm text-slate-600">
              {item.requires_completion_dates !== false ? 'Có' : 'Không'}
            </td>
            <td className="px-4 py-4 text-center text-sm text-slate-600">{item.is_transfer_dev === true ? 'Có' : 'Không'}</td>
            <td className="px-4 py-4 text-center text-sm text-slate-600">{item.is_terminal === true ? 'Có' : 'Không'}</td>
            <td className="px-4 py-4 text-center text-sm text-slate-600">{Number(item.sort_order ?? 0)}</td>
            <td className="px-4 py-4 text-center text-sm text-slate-600">
              {usedInRequests} / {usedInHistory}
            </td>
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
                title={canEditRow ? 'Cập nhật' : 'Không thể cập nhật trạng thái chưa đồng bộ DB'}
              >
                <span className="material-symbols-outlined text-lg">edit</span>
              </button>
            </td>
          </tr>
        );
      })}
      {items.length === 0 && (
        <tr>
          <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
            Không có dữ liệu trạng thái phù hợp.
          </td>
        </tr>
      )}
    </tbody>
  </table>
);

export const RequestStatusFormFields: React.FC<RequestStatusFormFieldsProps> = ({
  statusCode,
  statusName,
  description,
  requiresCompletionDates,
  isTransferDev,
  isTerminal,
  isActive,
  sortOrder,
  isCodeEditable,
  onStatusCodeChange,
  onStatusNameChange,
  onDescriptionChange,
  onRequiresCompletionDatesChange,
  onIsTransferDevChange,
  onIsTerminalChange,
  onIsActiveChange,
  onSortOrderChange,
}) => (
  <>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">
          Mã trạng thái <span className="text-red-500">*</span>
        </label>
        <input
          value={statusCode}
          disabled={!isCodeEditable}
          onChange={(event) => onStatusCodeChange(event.target.value)}
          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-500"
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
    {!isCodeEditable && (
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Đã phát sinh dữ liệu, không cho đổi mã trạng thái.
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
          checked={requiresCompletionDates}
          onChange={(event) => onRequiresCompletionDatesChange(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
        />
        Bắt buộc nhập hạn/ngày hoàn thành
      </label>
      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={isTransferDev}
          onChange={(event) => onIsTransferDevChange(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
        />
        Chuyển Dev
      </label>
      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={isTerminal}
          onChange={(event) => onIsTerminalChange(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
        />
        Trạng thái kết thúc
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
