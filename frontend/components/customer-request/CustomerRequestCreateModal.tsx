/**
 * CustomerRequestCreateModal
 *
 * Modal rộng tạo mới yêu cầu khách hàng.
 * Bố cục 2 cột theo wireframe Phac_thao_giao_dien_yeu_cau_KH.md §2.2:
 *   Left (flex-[3]): Thông tin yêu cầu · Task IT360 / Tham chiếu · Đính kèm
 *   Right (flex-[2]): Hướng xử lý + Estimate
 */
import React, { useEffect, useState } from 'react';
import { ModalWrapper } from '../Modals';
import { ProcessFieldInput } from './CustomerRequestFieldRenderer';
import { AttachmentManager } from '../AttachmentManager';
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect';
import { SUPPORT_TASK_STATUS_OPTIONS, type It360TaskFormRow, type ReferenceTaskFormRow } from './presentation';
import type {
  Attachment,
  Customer,
  CustomerPersonnel,
  Employee,
  ProjectItemMaster,
  SupportServiceGroup,
  YeuCauProcessField,
} from '../../types';

type CustomerRequestCreateModalProps = {
  /* master form fields */
  masterFields: YeuCauProcessField[];
  masterDraft: Record<string, unknown>;
  onMasterFieldChange: (field: string, value: unknown) => void;
  /* lookup data */
  customers: Customer[];
  employees: Employee[];
  customerPersonnel: CustomerPersonnel[];
  supportServiceGroups: SupportServiceGroup[];
  projectItems: ProjectItemMaster[];
  /* attachments */
  formAttachments: Attachment[];
  onUploadAttachment: (file: File) => Promise<void>;
  onDeleteAttachment: (id: string | number) => Promise<void>;
  isUploadingAttachment: boolean;
  attachmentError: string;
  attachmentNotice: string;
  /* IT360 tasks */
  formIt360Tasks: It360TaskFormRow[];
  onAddIt360Task: () => void;
  onUpdateIt360TaskRow: (localId: string, field: string, value: unknown) => void;
  onRemoveIt360TaskRow: (localId: string) => void;
  /* reference tasks */
  formReferenceTasks: ReferenceTaskFormRow[];
  onAddReferenceTask: () => void;
  onUpdateReferenceTaskRow: (localId: string, value: string) => void;
  onRemoveReferenceTaskRow: (localId: string) => void;
  taskReferenceOptions: SearchableSelectOption[];
  taskReferenceSearchTerm: string;
  onTaskReferenceSearchTermChange: (v: string) => void;
  taskReferenceSearchError: string;
  isTaskReferenceSearchLoading: boolean;
  /* state + callbacks */
  isSaving: boolean;
  onSave: () => Promise<void> | void;
  onClose: () => void;
};

type TaskTab = 'IT360' | 'REFERENCE';

export const CustomerRequestCreateModal: React.FC<CustomerRequestCreateModalProps> = ({
  masterFields,
  masterDraft,
  onMasterFieldChange,
  customers,
  employees,
  customerPersonnel,
  supportServiceGroups,
  projectItems,
  formAttachments,
  onUploadAttachment,
  onDeleteAttachment,
  isUploadingAttachment,
  attachmentError,
  attachmentNotice,
  formIt360Tasks,
  onAddIt360Task,
  onUpdateIt360TaskRow,
  onRemoveIt360TaskRow,
  formReferenceTasks,
  onAddReferenceTask,
  onUpdateReferenceTaskRow,
  onRemoveReferenceTaskRow,
  taskReferenceOptions,
  taskReferenceSearchTerm,
  onTaskReferenceSearchTermChange,
  taskReferenceSearchError,
  isTaskReferenceSearchLoading,
  isSaving,
  onSave,
  onClose,
}) => {
  const [activeTaskTab, setActiveTaskTab] = useState<TaskTab>('IT360');

  /* Khóa scroll trang nền khi modal mở */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const selectedCustomerId = String(masterDraft.customer_id ?? '');
  const selectedProjectItem =
    projectItems.find((p) => String(p.id) === String(masterDraft.project_item_id ?? '')) ?? null;

  /* ── Tên field động cho auto-select cascade ────────────────────── */
  const personnelFieldName = masterFields.find((f) => f.type === 'customer_personnel_select')?.name ?? null;
  const supportGroupFieldName = masterFields.find((f) => f.type === 'support_group_select')?.name ?? null;

  /**
   * Effect A: Khi chọn Dự án / Sản phẩm → tự động điền Khách hàng từ project item.
   * Chỉ trigger khi project_item_id thay đổi (không phụ thuộc selectedCustomerId
   * để tránh vòng lặp).
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const newCustomerId = String(selectedProjectItem?.customer_id ?? '');
    if (!newCustomerId) return;
    if (newCustomerId !== selectedCustomerId) {
      onMasterFieldChange('customer_id', newCustomerId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterDraft.project_item_id]);

  /**
   * Effect B: Khi Khách hàng thay đổi → tự động chọn các field phụ thuộc nếu
   * kết quả lọc chỉ còn đúng 1 option và field đó chưa có giá trị.
   *   - Người yêu cầu (customer_personnel_select)
   *   - Kênh tiếp nhận (support_group_select)
   *   - Dự án / Sản phẩm (project_item_select) — nếu chưa chọn
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selectedCustomerId) return;

    // Người yêu cầu: chỉ auto-select nếu field tồn tại và chưa có giá trị
    if (personnelFieldName && !masterDraft[personnelFieldName]) {
      const filtered = customerPersonnel.filter(
        (p) => String(p.customerId) === selectedCustomerId,
      );
      if (filtered.length === 1) {
        onMasterFieldChange(personnelFieldName, String(filtered[0].id));
      }
    }

    // Kênh tiếp nhận: áp dụng cùng logic lọc với fieldOptions()
    if (supportGroupFieldName && !masterDraft[supportGroupFieldName]) {
      const filtered = supportServiceGroups.filter((g) => {
        const gCustId = String(g.customer_id ?? '');
        return gCustId === '' || gCustId === selectedCustomerId;
      });
      if (filtered.length === 1) {
        onMasterFieldChange(supportGroupFieldName, String(filtered[0].id));
      }
    }

    // Dự án / Sản phẩm: chỉ auto-select nếu chưa có project_item_id
    if (!masterDraft.project_item_id) {
      const filtered = projectItems.filter(
        (p) => String(p.customer_id ?? '') === selectedCustomerId,
      );
      if (filtered.length === 1) {
        onMasterFieldChange('project_item_id', String(filtered[0].id));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId]);

  /* ── Task section ─────────────────────────────────────────────── */
  const renderTaskSection = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
          Task liên quan
        </h4>
        <div className="flex gap-1.5">
          {(['IT360', 'REFERENCE'] as TaskTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTaskTab(tab)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                activeTaskTab === tab
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab === 'IT360' ? 'IT360' : 'Tham chiếu'}
              {tab === 'IT360' && formIt360Tasks.length > 0 && (
                <span className="ml-1.5 rounded-full bg-white/30 px-1.5 py-0.5 text-[10px] font-bold">
                  {formIt360Tasks.length}
                </span>
              )}
              {tab === 'REFERENCE' && formReferenceTasks.length > 0 && (
                <span className="ml-1.5 rounded-full bg-white/30 px-1.5 py-0.5 text-[10px] font-bold">
                  {formReferenceTasks.length}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={isSaving}
          onClick={activeTaskTab === 'IT360' ? onAddIt360Task : onAddReferenceTask}
          className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[14px]">add</span>
          Thêm
        </button>
      </div>

      {activeTaskTab === 'IT360' ? (
        <div className="space-y-2">
          {formIt360Tasks.length === 0 ? (
            <p className="py-3 text-center text-sm text-slate-400">Chưa có task IT360 nào. Nhấn Thêm để gắn task.</p>
          ) : (
            formIt360Tasks.map((task, idx) => (
              <div
                key={task.local_id}
                className="grid gap-1.5 rounded-xl border border-slate-100 bg-slate-50 p-2.5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_200px_auto]"
              >
                <div className="space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Mã task #{idx + 1}</p>
                  <input
                    type="text"
                    value={task.task_code}
                    onChange={(e) => onUpdateIt360TaskRow(task.local_id, 'task_code', e.target.value)}
                    placeholder={`Mã task IT360 #${idx + 1}`}
                    disabled={isSaving}
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-slate-50"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Link task</p>
                  <input
                    type="text"
                    value={task.task_link}
                    onChange={(e) => onUpdateIt360TaskRow(task.local_id, 'task_link', e.target.value)}
                    placeholder="https://..."
                    disabled={isSaving}
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-slate-50"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Trạng thái</p>
                  <SearchableSelect
                    value={task.status}
                    options={SUPPORT_TASK_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    onChange={(v) => onUpdateIt360TaskRow(task.local_id, 'status', v)}
                    disabled={isSaving}
                    compact
                  />
                </div>
                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    onClick={() => onRemoveIt360TaskRow(task.local_id)}
                    disabled={isSaving}
                    className="material-symbols-outlined rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    title="Xoá task IT360"
                  >
                    delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {formReferenceTasks.length === 0 ? (
            <p className="py-3 text-center text-sm text-slate-400">Chưa có task tham chiếu. Nhấn Thêm để gắn.</p>
          ) : (
            formReferenceTasks.map((task, idx) => (
              <div
                key={task.local_id}
                className="grid gap-1.5 rounded-xl border border-slate-100 bg-slate-50 p-2.5 md:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Task tham chiếu #{idx + 1}
                  </p>
                  <SearchableSelect
                    value={task.task_code}
                    options={taskReferenceOptions}
                    onChange={(v) => onUpdateReferenceTaskRow(task.local_id, v)}
                    searchTerm={taskReferenceSearchTerm}
                    onSearchTermChange={onTaskReferenceSearchTermChange}
                    placeholder="Tìm mã YC / task tham chiếu…"
                    noOptionsText={
                      taskReferenceSearchError ||
                      (taskReferenceSearchTerm.trim() === ''
                        ? 'Nhập mã task hoặc mã yêu cầu để tìm kiếm.'
                        : 'Không tìm thấy task tham chiếu')
                    }
                    searching={isTaskReferenceSearchLoading}
                    disabled={isSaving}
                    compact
                  />
                  {taskReferenceSearchError ? (
                    <p className="text-xs text-rose-600">{taskReferenceSearchError}</p>
                  ) : null}
                </div>
                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    onClick={() => onRemoveReferenceTaskRow(task.local_id)}
                    disabled={isSaving}
                    className="material-symbols-outlined rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    title="Xoá task tham chiếu"
                  >
                    delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  /* ── Attachment section ───────────────────────────────────────── */
  const renderAttachmentSection = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
      <h4 className="mb-2.5 text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
        Đính kèm
      </h4>
      <AttachmentManager
        attachments={formAttachments}
        onUpload={onUploadAttachment}
        onDelete={onDeleteAttachment}
        isUploading={isUploadingAttachment}
        disabled={isSaving}
        compact
        helperText="Tải lên để gắn file cho yêu cầu."
        emptyStateDescription="Kéo thả hoặc dán ảnh chụp màn hình."
        enableClipboardPaste
        clipboardPasteHint="Click vào khung rồi Ctrl/Cmd+V để dán ảnh."
      />
      {attachmentError ? (
        <p className="mt-1.5 text-sm text-rose-600">{attachmentError}</p>
      ) : null}
      {!attachmentError && attachmentNotice ? (
        <div className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {attachmentNotice}
        </div>
      ) : null}
    </div>
  );

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <ModalWrapper
      title="Tạo yêu cầu mới"
      icon="add_circle"
      width="max-w-5xl"
      maxHeightClass="max-h-[92vh]"
      disableClose={isSaving}
      onClose={onClose}
    >
      {/* 2-column body */}
      <div className="flex min-h-0 overflow-y-auto">
        <div className="min-w-0 w-full space-y-4 px-6 py-4">
          {masterFields.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
              <span className="material-symbols-outlined mb-2 block text-3xl text-slate-300">
                hourglass_empty
              </span>
              Đang tải biểu mẫu…
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {masterFields.map((field) => {
                if (field.type === 'hidden') return null;
                return (
                  <div
                    key={field.name}
                    className={
                      field.name === 'project_item_id' ||
                      field.name === 'summary' ||
                      field.name === 'description'
                        ? 'md:col-span-2'
                        : undefined
                    }
                  >
                    <ProcessFieldInput
                      field={field}
                      value={masterDraft[field.name]}
                      customers={customers}
                      employees={employees}
                      customerPersonnel={customerPersonnel}
                      supportServiceGroups={supportServiceGroups}
                      projectItems={projectItems}
                      selectedCustomerId={selectedCustomerId}
                      disabled={isSaving}
                      density="compact"
                      onChange={onMasterFieldChange}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Task liên quan */}
          {renderTaskSection()}

          {/* Đính kèm — đặt ngay dưới Task liên quan để luồng nhập liệu liền mạch */}
          {renderAttachmentSection()}
        </div>

      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-3.5">
        <p className="text-xs text-slate-400">
          {formAttachments.length > 0 && (
            <span className="mr-3 inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">attach_file</span>
              {formAttachments.length} file
            </span>
          )}
          {(formIt360Tasks.length + formReferenceTasks.length) > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">task</span>
              {formIt360Tasks.length + formReferenceTasks.length} task
            </span>
          )}
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={isSaving || masterFields.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white shadow-sm shadow-primary/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">
                  progress_activity
                </span>
                Đang lưu…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">save</span>
                Tạo yêu cầu
              </>
            )}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};
