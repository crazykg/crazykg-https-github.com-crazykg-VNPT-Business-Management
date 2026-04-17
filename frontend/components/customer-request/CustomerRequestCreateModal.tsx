/**
 * CustomerRequestCreateModal
 *
 * Modal rộng tạo mới yêu cầu khách hàng.
 * Bố cục 2 cột theo wireframe Phac_thao_giao_dien_yeu_cau_KH.md §2.2:
 *   Left (flex-[3]): Thông tin yêu cầu · Task IT360 / Tham chiếu · Đính kèm
 *   Right (flex-[2]): Hướng xử lý + Estimate + Workflow selection
 */
import React, { useEffect, useState } from 'react';
import { ModalWrapper } from '../modals';
import { ProcessFieldInput } from './CustomerRequestFieldRenderer';
import { TagInput } from './TagInput';
import { AttachmentManager } from '../AttachmentManager';
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect';
import { SUPPORT_TASK_STATUS_OPTIONS, type It360TaskFormRow, type ReferenceTaskFormRow } from './presentation';
import { fetchWorkflowDefinitions, type WorkflowDefinition } from '../../services/api/customerRequestApi';
import type {
  Attachment,
  Customer,
  CustomerPersonnel,
  Employee,
  ProjectItemMaster,
  SupportServiceGroup,
  YeuCauProcessField,
  Tag,
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
  onUpdateIt360TaskRow: (
    localId: string,
    field: keyof Omit<It360TaskFormRow, 'local_id'>,
    value: unknown
  ) => void;
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
  /* tags */
  formTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  /* state + callbacks */
  isSaving: boolean;
  onSave: () => Promise<void> | void;
  onClose: () => void;
  workflowDefinitionId?: string | number | null;
  onWorkflowDefinitionIdChange?: (workflowId: string | number | null) => void;
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
  formTags,
  onTagsChange,
  isSaving,
  onSave,
  onClose,
  workflowDefinitionId,
  onWorkflowDefinitionIdChange,
}) => {
  const [activeTaskTab, setActiveTaskTab] = useState<TaskTab>('IT360');
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);

  /* Load workflows on mount */
  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        setIsLoadingWorkflows(true);
        const workflowRows = await fetchWorkflowDefinitions('customer_request', false);
        setWorkflows(workflowRows || []);

        // Set default workflow if not selected
        if (workflowDefinitionId === undefined || workflowDefinitionId === null) {
          // Prefer default workflow, fallback to first active workflow
          const defaultWorkflow = workflowRows?.find((w) => w.is_default);
          const activeWorkflow = workflowRows?.find((w) => w.is_active);
          const workflowToSelect = defaultWorkflow ?? activeWorkflow;
          if (workflowToSelect && onWorkflowDefinitionIdChange) {
            onWorkflowDefinitionIdChange(workflowToSelect.id);
          }
        }
      } catch (error) {
        console.error('Failed to load workflows:', error);
      } finally {
        setIsLoadingWorkflows(false);
      }
    };
    
    loadWorkflows();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Khóa scroll trang nền khi modal mở */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const selectedCustomerId = String(masterDraft.customer_id ?? '');
  const selectedProjectItem =
    projectItems.find((p) => String(p.id) === String(masterDraft.project_item_id ?? '')) ?? null;
  const selectedWorkflowName =
    workflows.find((workflow) => String(workflow.id) === String(workflowDefinitionId ?? ''))?.name ?? '';
  const selectedContextTitle =
    selectedProjectItem?.project_name
    || selectedProjectItem?.customer_name
    || customers.find((customer) => String(customer.id) === selectedCustomerId)?.customer_name
    || 'Chưa chọn khách hàng | dự án | sản phẩm';
  const selectedContextMeta = [
    selectedProjectItem?.product_name,
    selectedProjectItem?.display_name,
    selectedWorkflowName ? `Workflow: ${selectedWorkflowName}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const createOverviewStats = [
    { label: 'Task', value: formIt360Tasks.length + formReferenceTasks.length, icon: 'task' },
    { label: 'File', value: formAttachments.length, icon: 'attach_file' },
    { label: 'Tag', value: formTags.length, icon: 'label' },
    { label: 'Field', value: masterFields.filter((field) => field.type !== 'hidden' && field.type !== 'customer_select' && field.name !== 'customer_id').length, icon: 'inventory_2' },
  ];

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
    <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>deployed_code</span>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
              Task liên quan
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              Gắn task IT360 hoặc task tham chiếu ngay trong lúc tạo để người nhận việc có đủ ngữ cảnh.
            </p>
          </div>
        </div>
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
          className="inline-flex items-center gap-1 rounded-xl border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50"
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
    <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-3 border-b border-slate-100 pb-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>attach_file</span>
        </div>
        <div>
          <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
            Đính kèm
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Tải tài liệu, hình chụp hoặc bằng chứng để PM và người xử lý nhận đủ thông tin ngay từ đầu.
          </p>
        </div>
      </div>
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
      zIndexClassName="z-[120]"
      contentClassName="min-h-0 flex flex-1 flex-col bg-slate-50/40"
      width="max-w-[1560px]"
      heightClass="h-[calc(100dvh-16px)] sm:h-[calc(100dvh-48px)]"
      maxHeightClass=""
      disableClose={isSaving}
      headerClassName="bg-white/90 px-4 py-3.5 backdrop-blur-sm sm:px-6"
      onClose={onClose}
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto custom-scrollbar">
          <div className="min-w-0 w-full p-3 sm:p-4 sm:px-6">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-4">
                {masterFields.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
                    <span className="material-symbols-outlined mb-2 block text-3xl text-slate-300">
                      hourglass_empty
                    </span>
                    Đang tải biểu mẫu…
                  </div>
                ) : (
                  <section className="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>description</span>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
                            Thông tin yêu cầu
                          </h4>
                          <p className="mt-1 text-xs text-slate-500">
                            Điền thông tin intake, người liên hệ và mức ưu tiên. Modal giữ action cố định ở đáy để không phải kéo xuống cuối form.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedWorkflowName ? (
                          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                            {selectedWorkflowName}
                          </span>
                        ) : null}
                        {selectedProjectItem?.project_name ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            {selectedProjectItem.project_name}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {masterFields.map((field) => {
                        if (
                          field.type === 'hidden'
                          || field.type === 'customer_select'
                          || field.name === 'customer_id'
                        ) {
                          return null;
                        }
                        return (
                          <div
                            key={field.name}
                            className={
                              field.name === 'project_item_id' ||
                              field.name === 'summary' ||
                              field.name === 'description'
                                ? 'lg:col-span-2'
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
                  </section>
                )}

                {renderTaskSection()}
                {renderAttachmentSection()}
              </div>

              <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
                <section className="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>monitoring</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
                        Tóm tắt tạo mới
                      </h4>
                      <p className="mt-1 text-xs text-slate-500">
                        Theo dõi nhanh ngữ cảnh đã chọn trước khi bấm tạo yêu cầu.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/80 px-3.5 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Ngữ cảnh hiện tại</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{selectedContextTitle}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedContextMeta || 'Chưa khóa đúng phạm vi. Chọn Khách hàng | Dự án | Sản phẩm để case đi đúng luồng.'}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {createOverviewStats.map((item) => (
                      <div key={item.label} className="rounded-2xl border border-slate-100 bg-white px-3 py-3">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{item.icon}</span>
                          <span className="text-[11px] font-bold uppercase tracking-[0.14em]">{item.label}</span>
                        </div>
                        <p className="mt-2 text-lg font-black text-slate-900">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>sell</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
                        Thẻ (Tags)
                      </h4>
                      <p className="mt-1 text-xs text-slate-500">
                        Gắn thẻ để tìm kiếm, nhóm yêu cầu hoặc lọc nhanh theo bối cảnh làm việc.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <TagInput
                      value={formTags}
                      onChange={onTagsChange}
                      placeholder="Nhập tag và nhấn Enter..."
                      disabled={isSaving}
                    />
                    <p className="mt-2 text-xs text-slate-400">
                      Ví dụ: `zalo`, `khẩn`, `đang triển khai`, `báo cáo`.
                    </p>
                  </div>
                </section>
              </aside>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 z-10 flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          {formTags.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">label</span>
              {formTags.length} tag
            </span>
          )}
          {formAttachments.length > 0 && (
            <span className="inline-flex items-center gap-1">
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

        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={isSaving || masterFields.length === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-sm font-bold text-white shadow-sm shadow-primary/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
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
