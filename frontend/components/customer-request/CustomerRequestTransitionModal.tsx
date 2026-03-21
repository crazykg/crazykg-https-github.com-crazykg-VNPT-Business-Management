import React from 'react';
import type {
  Attachment,
  Customer,
  CustomerPersonnel,
  CustomerRequestReferenceSearchItem,
  Employee,
  ProjectItemMaster,
  ProjectRaciRow,
  SupportServiceGroup,
  YeuCauProcessDetail,
  YeuCauProcessField,
  YeuCauTimelineEntry,
} from '../../types';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';
import { AttachmentManager } from '../AttachmentManager';
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect';
import { ProcessFieldInput } from './CustomerRequestFieldRenderer';
import {
  STATUS_COLOR_MAP,
  SUPPORT_TASK_STATUS_OPTIONS,
  type CustomerRequestTaskSource,
  type It360TaskFormRow,
  type ReferenceTaskFormRow,
  resolveStatusMeta,
} from './presentation';

type CustomerRequestTransitionModalProps = {
  show: boolean;
  processDetail: YeuCauProcessDetail | null;
  transitionStatusCode: string;
  transitionRenderableFields: YeuCauProcessField[];
  modalStatusPayload: Record<string, unknown>;
  onModalStatusPayloadChange: (fieldName: string, value: unknown) => void;
  modalIt360Tasks: It360TaskFormRow[];
  onAddModalIt360Task: () => void;
  onUpdateModalIt360Task: (localId: string, fieldName: keyof Omit<It360TaskFormRow, 'local_id'>, value: unknown) => void;
  onRemoveModalIt360Task: (localId: string) => void;
  modalRefTasks: ReferenceTaskFormRow[];
  onAddModalReferenceTask: () => void;
  onUpdateModalReferenceTask: (localId: string, value: string) => void;
  onRemoveModalReferenceTask: (localId: string) => void;
  modalAttachments: Attachment[];
  onUploadModalAttachment: (file: File) => Promise<void>;
  onDeleteModalAttachment: (id: string | number) => void;
  isModalUploading: boolean;
  modalNotes: string;
  onModalNotesChange: (value: string) => void;
  modalActiveTaskTab: CustomerRequestTaskSource;
  onModalActiveTaskTabChange: (tab: CustomerRequestTaskSource) => void;
  isTransitioning: boolean;
  onClose: () => void;
  onConfirm: () => void;
  modalTimeline: YeuCauTimelineEntry[];
  modalHandlerUserId: string;
  onModalHandlerUserIdChange: (value: string) => void;
  projectRaciRows: ProjectRaciRow[];
  employees: Employee[];
  customers: Customer[];
  customerPersonnel: CustomerPersonnel[];
  supportServiceGroups: SupportServiceGroup[];
  projectItems: ProjectItemMaster[];
  selectedCustomerId: string;
  taskReferenceOptions: SearchableSelectOption[];
  taskReferenceSearchError: string;
  taskReferenceSearchTerm: string;
  onTaskReferenceSearchTermChange: (value: string) => void;
  isTaskReferenceSearchLoading: boolean;
};

const handlerOptionsFromRaci = (projectRaciRows: ProjectRaciRow[]): SearchableSelectOption[] =>
  Array.from(new Map<string, ProjectRaciRow>(projectRaciRows.map((row) => [String(row.user_id), row])).values()).map((row) => ({
    value: String(row.user_id),
    label: row.user_code
      ? `${row.full_name || row.username || String(row.user_id)} · ${row.user_code}`
      : row.full_name || row.username || String(row.user_id),
    searchText: `${row.full_name ?? ''} ${row.username ?? ''} ${row.user_code ?? ''}`,
  }));

const handlerOptionsFromEmployees = (employees: Employee[]): SearchableSelectOption[] =>
  employees.map((employee) => ({
    value: String(employee.id),
    label: employee.user_code
      ? `${employee.full_name || employee.username} · ${employee.user_code}`
      : employee.full_name || employee.username,
    searchText: `${employee.full_name} ${employee.username} ${employee.user_code ?? ''}`,
  }));

export const CustomerRequestTransitionModal: React.FC<CustomerRequestTransitionModalProps> = ({
  show,
  processDetail,
  transitionStatusCode,
  transitionRenderableFields,
  modalStatusPayload,
  onModalStatusPayloadChange,
  modalIt360Tasks,
  onAddModalIt360Task,
  onUpdateModalIt360Task,
  onRemoveModalIt360Task,
  modalRefTasks,
  onAddModalReferenceTask,
  onUpdateModalReferenceTask,
  onRemoveModalReferenceTask,
  modalAttachments,
  onUploadModalAttachment,
  onDeleteModalAttachment,
  isModalUploading,
  modalNotes,
  onModalNotesChange,
  modalActiveTaskTab,
  onModalActiveTaskTabChange,
  isTransitioning,
  onClose,
  onConfirm,
  modalTimeline,
  modalHandlerUserId,
  onModalHandlerUserIdChange,
  projectRaciRows,
  employees,
  customers,
  customerPersonnel,
  supportServiceGroups,
  projectItems,
  selectedCustomerId,
  taskReferenceOptions,
  taskReferenceSearchError,
  taskReferenceSearchTerm,
  onTaskReferenceSearchTermChange,
  isTaskReferenceSearchLoading,
}) => {
  if (!show) {
    return null;
  }

  const currentStatusMeta = resolveStatusMeta(
    processDetail?.yeu_cau?.trang_thai,
    processDetail?.yeu_cau?.current_status_name_vi
  );
  const targetStatusMeta = STATUS_COLOR_MAP[transitionStatusCode] ?? resolveStatusMeta(transitionStatusCode);
  const handlerOptions =
    projectRaciRows.length > 0 ? handlerOptionsFromRaci(projectRaciRows) : handlerOptionsFromEmployees(employees);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isTransitioning) {
          onClose();
        }
      }}
    >
      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${currentStatusMeta.cls}`}>
              {currentStatusMeta.label}
            </span>
            <span className="material-symbols-outlined text-[18px] text-slate-400">arrow_forward</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${targetStatusMeta.cls}`}>
              {targetStatusMeta.label}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isTransitioning}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {transitionRenderableFields.length > 0 ? (
              <div>
                <h5 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Thông tin cho trạng thái mới
                </h5>
                <div className="grid gap-4 md:grid-cols-2">
                  {transitionRenderableFields.map((field) => (
                    <ProcessFieldInput
                      key={field.name}
                      field={field}
                      value={modalStatusPayload[field.name]}
                      customers={customers}
                      employees={employees}
                      customerPersonnel={customerPersonnel}
                      supportServiceGroups={supportServiceGroups}
                      projectItems={projectItems}
                      selectedCustomerId={selectedCustomerId}
                      disabled={isTransitioning}
                      onChange={onModalStatusPayloadChange}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h5 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Task đính kèm bước này
                </h5>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onModalActiveTaskTabChange('IT360')}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${modalActiveTaskTab === 'IT360' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Task IT360
                  </button>
                  <button
                    type="button"
                    onClick={() => onModalActiveTaskTabChange('REFERENCE')}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${modalActiveTaskTab === 'REFERENCE' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Tham chiếu
                  </button>
                  <button
                    type="button"
                    disabled={isTransitioning}
                    onClick={() => {
                      if (modalActiveTaskTab === 'IT360') {
                        onAddModalIt360Task();
                      } else {
                        onAddModalReferenceTask();
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span>Thêm
                  </button>
                </div>
              </div>

              <div className="min-h-[60px] space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
                {modalActiveTaskTab === 'IT360' ? (
                  modalIt360Tasks.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-400">Chưa có task IT360. Bấm "+ Thêm" để thêm.</p>
                  ) : (
                    modalIt360Tasks.map((task, index) => (
                      <div
                        key={task.local_id}
                        className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2.5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_180px_auto]"
                      >
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">Mã task #{index + 1}</p>
                          <input
                            type="text"
                            value={task.task_code}
                            onChange={(event) => onUpdateModalIt360Task(task.local_id, 'task_code', event.target.value)}
                            disabled={isTransitioning}
                            placeholder="VD: IT360-0001"
                            className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">Link task</p>
                          <input
                            type="text"
                            value={task.task_link}
                            onChange={(event) => onUpdateModalIt360Task(task.local_id, 'task_link', event.target.value)}
                            disabled={isTransitioning}
                            placeholder="https://..."
                            className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">Trạng thái</p>
                          <SearchableSelect
                            value={task.status}
                            options={SUPPORT_TASK_STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                            onChange={(value) => onUpdateModalIt360Task(task.local_id, 'status', value)}
                            disabled={isTransitioning}
                            compact
                          />
                        </div>
                        <div className="flex items-end justify-end">
                          <button
                            type="button"
                            onClick={() => onRemoveModalIt360Task(task.local_id)}
                            disabled={isTransitioning}
                            className="material-symbols-outlined rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                          >
                            delete
                          </button>
                        </div>
                      </div>
                    ))
                  )
                ) : modalRefTasks.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-400">Chưa có task tham chiếu. Bấm "+ Thêm" để thêm.</p>
                ) : (
                  modalRefTasks.map((task, index) => (
                    <div
                      key={task.local_id}
                      className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2.5 md:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">Task tham chiếu #{index + 1}</p>
                        <SearchableSelect
                          value={task.id != null ? String(task.id) : task.task_code}
                          options={taskReferenceOptions}
                          onChange={(value) => onUpdateModalReferenceTask(task.local_id, value)}
                          onSearchTermChange={onTaskReferenceSearchTermChange}
                          placeholder="Chọn hoặc tìm task tham chiếu"
                          searchPlaceholder="Tìm theo mã task hoặc mã yêu cầu..."
                          noOptionsText={
                            taskReferenceSearchError ||
                            (taskReferenceSearchTerm.trim() === '' ? 'Nhập để tìm kiếm...' : 'Không tìm thấy')
                          }
                          searching={isTaskReferenceSearchLoading}
                          disabled={isTransitioning}
                          compact
                        />
                      </div>
                      <div className="flex items-end justify-end">
                        <button
                          type="button"
                          onClick={() => onRemoveModalReferenceTask(task.local_id)}
                          disabled={isTransitioning}
                          className="material-symbols-outlined rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        >
                          delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h5 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                File đính kèm bước này
              </h5>
              <AttachmentManager
                attachments={modalAttachments}
                onUpload={onUploadModalAttachment}
                onDelete={(id) => onDeleteModalAttachment(id)}
                isUploading={isModalUploading}
                disabled={isTransitioning}
                helperText="File đính kèm sẽ được gắn với bước chuyển trạng thái này."
                emptyStateDescription="Chưa có file đính kèm cho bước này."
                enableClipboardPaste
                clipboardPasteHint="Ctrl/Cmd+V để dán ảnh chụp màn hình."
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Ghi chú
              </label>
              <textarea
                rows={2}
                value={modalNotes}
                onChange={(event) => onModalNotesChange(event.target.value)}
                disabled={isTransitioning}
                placeholder="Ghi chú thêm cho lần chuyển trạng thái này..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="w-72 shrink-0 space-y-4 overflow-y-auto border-l border-slate-100 bg-slate-50 px-4 py-5">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">📋 Thông tin yêu cầu</p>
              <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-white p-3 text-xs">
                {[
                  { label: 'Mã YC', value: processDetail?.yeu_cau?.ma_yc },
                  { label: 'Tiêu đề', value: processDetail?.yeu_cau?.tieu_de || processDetail?.yeu_cau?.summary },
                  { label: 'Khách hàng', value: processDetail?.yeu_cau?.khach_hang_name || processDetail?.yeu_cau?.customer_name },
                  { label: 'Kênh tiếp nhận', value: processDetail?.yeu_cau?.support_service_group_name },
                ].map((item) => (
                  <div key={item.label}>
                    <span className="font-semibold text-slate-500">{item.label}: </span>
                    <span className="text-slate-800">{item.value || '--'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">👤 Vai trò</p>
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 text-xs">
                {[
                  {
                    icon: '📝',
                    label: 'Người nhập',
                    name: processDetail?.yeu_cau?.created_by_name || processDetail?.yeu_cau?.nguoi_tao_name,
                    time: null,
                  },
                  {
                    icon: '📥',
                    label: 'Người tiếp nhận',
                    name: processDetail?.yeu_cau?.received_by_name,
                    time: processDetail?.yeu_cau?.received_at ? formatDateTimeDdMmYyyy(processDetail.yeu_cau.received_at) : null,
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-1.5">
                    <span className="mt-0.5 text-sm">{item.icon}</span>
                    <div>
                      <p className="font-semibold text-slate-500">{item.label}</p>
                      <p className="text-slate-800">{item.name || '--'}</p>
                      {item.time ? <p className="text-slate-400">{item.time}</p> : null}
                    </div>
                  </div>
                ))}

                <div className="flex items-start gap-1.5 pt-1">
                  <span className="mt-0.5 text-sm">⚙️</span>
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 font-semibold text-slate-500">
                      Người xử lý
                      {projectRaciRows.length === 0 ? (
                        <span className="ml-1 text-[10px] font-normal text-slate-400">(tất cả nhân viên)</span>
                      ) : null}
                    </p>
                    <SearchableSelect
                      value={modalHandlerUserId}
                      options={handlerOptions}
                      onChange={onModalHandlerUserIdChange}
                      placeholder="Chọn người xử lý..."
                      searchPlaceholder="Tìm theo tên..."
                      compact
                      disabled={isTransitioning}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">🕒 Lịch sử</p>
              <div className="space-y-2">
                {modalTimeline.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                    Đang tải...
                  </p>
                ) : (
                  modalTimeline.map((entry, index) => {
                    const meta = resolveStatusMeta(entry.tien_trinh, entry.trang_thai_moi);

                    return (
                      <div key={String(entry.id ?? index)} className="flex gap-2">
                        <div className="flex flex-col items-center">
                          <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-current bg-white text-slate-400" />
                          {index < modalTimeline.length - 1 ? <div className="mt-1 w-px flex-1 bg-slate-200" /> : null}
                        </div>
                        <div className="min-w-0 pb-2">
                          <p className="text-[11px] font-semibold text-slate-700">{meta.label}</p>
                          <p className="truncate text-[10px] text-slate-500">
                            {entry.nguoi_thay_doi_name || '--'}
                            {entry.thay_doi_luc ? ` · ${formatDateTimeDdMmYyyy(entry.thay_doi_luc)}` : ''}
                          </p>
                          {entry.ly_do ? (
                            <p className="mt-0.5 line-clamp-2 text-[10px] italic text-slate-400">"{entry.ly_do}"</p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isTransitioning}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isTransitioning}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isTransitioning ? 'progress_activity' : 'swap_horiz'}
            </span>
            {isTransitioning ? 'Đang xử lý...' : 'Xác nhận chuyển trạng thái'}
          </button>
        </div>
      </div>
    </div>
  );
};
