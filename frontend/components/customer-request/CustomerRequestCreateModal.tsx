/**
 * CustomerRequestCreateModal
 *
 * Modal tạo mới yêu cầu khách hàng.
 * Bố cục hiện tại ưu tiên form chính bên trái và rail phụ trợ bên phải:
 *   Left (~62%): Thông tin yêu cầu
 *   Right (~38%): Thẻ · Task liên quan · Đính kèm
 */
import React, { useEffect, useRef, useState } from 'react';
import { ModalWrapper } from '../modals';
import { ProcessFieldInput } from './CustomerRequestFieldRenderer';
import { TagInput } from './TagInput';
import { AttachmentManager, type AttachmentManagerHandle } from '../AttachmentManager';
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect';
import { InlineRemoveConfirmButton } from './InlineRemoveConfirmButton';
import { SUPPORT_TASK_STATUS_OPTIONS, type It360TaskFormRow, type ReferenceTaskFormRow } from './presentation';
import { fetchWorkflowDefinitions, type WorkflowDefinition } from '../../services/api/customerRequestApi';
import {
  customerRequestDensePrimaryButtonClass,
  customerRequestFieldClass,
  customerRequestModalPanelClass,
  customerRequestPrimaryButtonClass,
  customerRequestSecondaryButtonClass,
  customerRequestSelectTriggerClass,
  customerRequestSurfaceClass,
} from './uiClasses';
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
  onOpenAddCustomerPersonnelModal?: () => void;
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
  onOpenAddCustomerPersonnelModal,
}) => {
  const [activeTaskTab, setActiveTaskTab] = useState<TaskTab>('IT360');
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);
  const attachmentManagerRef = useRef<AttachmentManagerHandle | null>(null);

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

  const compactSectionTitleClass = 'text-xs font-bold uppercase tracking-[0.12em] text-slate-500';
  const compactSectionIconBoxClass =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--ui-control-radius)]';
  const compactSectionCardClass = `${customerRequestSurfaceClass} p-3.5 sm:p-4`;
  const taskTabButtonBaseClass =
    'inline-flex h-8 items-center gap-1.5 rounded-[var(--ui-control-radius)] px-3 text-[13px] font-semibold leading-5 transition';
  const taskSectionTitleClass = 'text-sm font-semibold leading-5 text-[color:var(--ui-text-default)]';
  const taskHeaderClass = 'mb-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3';
  const taskSegmentedControlClass =
    'inline-flex items-center rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] p-1';
  const taskActionGroupClass = 'ml-auto flex flex-wrap items-center gap-2';
  const taskListScrollClass = 'max-h-[min(280px,40dvh)] overflow-y-auto pr-1 custom-scrollbar';
  const attachmentListScrollClass = 'max-h-[min(240px,36dvh)] custom-scrollbar';
  const itemCardClass =
    'rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-bg)]';
  const visibleMasterFields = masterFields.filter(
    (field) =>
      field.type !== 'hidden'
      && field.type !== 'customer_select'
      && field.name !== 'customer_id'
  );
  const descriptionField = visibleMasterFields.find((field) => field.name === 'description') ?? null;
  const primaryMasterFields = visibleMasterFields.filter((field) => field.name !== 'description');

  /* ── Task section ─────────────────────────────────────────────── */
  const renderTaskSection = () => (
    <div className={compactSectionCardClass}>
      <div className={taskHeaderClass}>
        <div className="flex min-w-0 items-center gap-2 pr-2">
          <div className={`${compactSectionIconBoxClass} bg-sky-50 text-sky-700`}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>deployed_code</span>
          </div>
          <h4 className={taskSectionTitleClass}>Task liên quan</h4>
        </div>

        <div className={taskSegmentedControlClass}>
          {(['IT360', 'REFERENCE'] as TaskTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTaskTab(tab)}
              className={`${taskTabButtonBaseClass} ${
                activeTaskTab === tab
                  ? 'bg-primary text-white shadow-[var(--ui-shadow-shell)]'
                  : 'bg-transparent text-slate-600 hover:bg-white'
              }`}
            >
              {tab === 'IT360' ? 'IT360' : 'Ref'}
              {tab === 'IT360' && formIt360Tasks.length > 0 ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    activeTaskTab === tab ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {formIt360Tasks.length}
                </span>
              ) : null}
              {tab === 'REFERENCE' && formReferenceTasks.length > 0 ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    activeTaskTab === tab ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {formReferenceTasks.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className={taskActionGroupClass}>
          <button
            type="button"
            disabled={isSaving}
            onClick={activeTaskTab === 'IT360' ? onAddIt360Task : onAddReferenceTask}
            className={customerRequestDensePrimaryButtonClass}
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            Thêm
          </button>
        </div>
      </div>

      {activeTaskTab === 'IT360' ? (
        <div className={`space-y-2 ${taskListScrollClass}`}>
          {formIt360Tasks.length === 0 ? (
            <div className="rounded-[var(--ui-control-radius)] border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface-bg)] px-3 py-4 text-center text-xs text-slate-400">
              Chưa có IT360 nào. Bấm Thêm để gắn task.
            </div>
          ) : (
            formIt360Tasks.map((task, idx) => (
              <div
                key={task.local_id}
                className={`${itemCardClass} p-3`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">IT360 #{idx + 1}</p>
                  <InlineRemoveConfirmButton
                    triggerLabel={`Bỏ IT360 #${idx + 1}`}
                    confirmTitle="Bỏ IT360 này?"
                    confirmDescription="Dòng IT360 này sẽ bị gỡ khỏi yêu cầu hiện tại. Task gốc không bị xoá."
                    confirmActionLabel="Bỏ IT360"
                    disabled={isSaving}
                    onConfirm={() => onRemoveIt360TaskRow(task.local_id)}
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <input
                    type="text"
                    value={task.task_code}
                    onChange={(e) => onUpdateIt360TaskRow(task.local_id, 'task_code', e.target.value)}
                    placeholder={`Mã IT360 #${idx + 1}`}
                    disabled={isSaving}
                    className={customerRequestFieldClass}
                  />
                  <SearchableSelect
                    value={task.status}
                    options={SUPPORT_TASK_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    onChange={(v) => onUpdateIt360TaskRow(task.local_id, 'status', v)}
                    disabled={isSaving}
                    compact
                    triggerClassName={customerRequestSelectTriggerClass}
                  />
                </div>

                <div className="mt-2">
                  <input
                    type="text"
                    value={task.task_link}
                    onChange={(e) => onUpdateIt360TaskRow(task.local_id, 'task_link', e.target.value)}
                    placeholder="Link task"
                    disabled={isSaving}
                    className={customerRequestFieldClass}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className={`space-y-2 ${taskListScrollClass}`}>
          {formReferenceTasks.length === 0 ? (
            <div className="rounded-[var(--ui-control-radius)] border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface-bg)] px-3 py-4 text-center text-xs text-slate-400">
              Chưa có Ref nào. Bấm Thêm để gắn liên kết.
            </div>
          ) : (
            formReferenceTasks.map((task, idx) => (
              <div
                key={task.local_id}
                className={`${itemCardClass} p-3`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Ref #{idx + 1}</p>
                  <InlineRemoveConfirmButton
                    triggerLabel={`Bỏ Ref #${idx + 1}`}
                    confirmTitle="Bỏ Ref này?"
                    confirmDescription="Liên kết này sẽ bị gỡ khỏi yêu cầu hiện tại. Yêu cầu gốc không bị xoá."
                    confirmActionLabel="Bỏ Ref"
                    disabled={isSaving}
                    onConfirm={() => onRemoveReferenceTaskRow(task.local_id)}
                  />
                </div>

                <SearchableSelect
                  value={task.task_code}
                  options={taskReferenceOptions}
                  onChange={(v) => onUpdateReferenceTaskRow(task.local_id, v)}
                  searchTerm={taskReferenceSearchTerm}
                  onSearchTermChange={onTaskReferenceSearchTermChange}
                  placeholder={`Chọn task/YC tham chiếu #${idx + 1}`}
                  noOptionsText={
                    taskReferenceSearchError ||
                    (taskReferenceSearchTerm.trim() === ''
                      ? 'Nhập mã task hoặc mã yêu cầu để tìm.'
                      : 'Không tìm thấy task tham chiếu')
                  }
                  searching={isTaskReferenceSearchLoading}
                  disabled={isSaving}
                  compact
                  triggerClassName={customerRequestSelectTriggerClass}
                />
                {taskReferenceSearchError ? (
                  <p className="mt-2 text-xs text-rose-600">{taskReferenceSearchError}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  /* ── Attachment section ───────────────────────────────────────── */
  const renderAttachmentSection = () => (
    <div className={compactSectionCardClass}>
      <div
        data-testid="customer-request-create-attachment-header"
        className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-2"
      >
        <div className="flex min-w-0 items-start gap-2">
          <div className={`${compactSectionIconBoxClass} bg-amber-50 text-amber-700`}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>attach_file</span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className={compactSectionTitleClass}>
                Tệp đính kèm
              </h4>
              {formAttachments.length > 0 ? (
                <span className="inline-flex h-6 items-center rounded-full bg-[var(--ui-surface-subtle)] px-2 text-xs font-semibold text-[color:var(--ui-text-muted)]">
                  {formAttachments.length} file
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs leading-5 text-[color:var(--ui-text-muted)]">Ctrl/Cmd+V để dán ảnh chụp.</p>
          </div>
        </div>
        <button
          data-testid="customer-request-create-attachment-upload"
          type="button"
          onClick={() => attachmentManagerRef.current?.openFilePicker()}
          disabled={isUploadingAttachment || isSaving}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--ui-control-radius)] bg-primary/10 px-3 text-sm font-semibold text-primary transition-all hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50 min-w-[116px] sm:h-10 sm:min-h-0"
        >
          {isUploadingAttachment ? (
            <span className="mr-1 h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          ) : (
            <span className="material-symbols-outlined text-base">upload</span>
          )}
          Tải file
        </button>
      </div>
      <AttachmentManager
        ref={attachmentManagerRef}
        attachments={formAttachments}
        onUpload={onUploadAttachment}
        onDelete={onDeleteAttachment}
        isUploading={isUploadingAttachment}
        disabled={isSaving}
        compact
        emptyStateDescription="Kéo thả hoặc dán ảnh chụp màn hình."
        enableClipboardPaste
        clipboardPasteHint="Click vào khung rồi Ctrl/Cmd+V để dán ảnh."
        showClipboardPasteHint={false}
        showSummaryMeta={false}
        showUploadButton={false}
        showListTitle={false}
        listVariant="compact-row"
        listMaxHeightClassName={attachmentListScrollClass}
      />
      {attachmentError ? (
        <p className="mt-1.5 text-sm text-rose-600">{attachmentError}</p>
      ) : null}
      {!attachmentError && attachmentNotice ? (
        <div className="mt-1.5 rounded-[var(--ui-control-radius)] border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          {attachmentNotice}
        </div>
      ) : null}
    </div>
  );

  const renderTagSection = () => (
    <section className={compactSectionCardClass}>
      <div className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-2">
        <div className={`${compactSectionIconBoxClass} bg-violet-50 text-violet-700`}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>sell</span>
        </div>
        <h4 className={compactSectionTitleClass}>
          Thẻ
        </h4>
      </div>

      <TagInput
        value={formTags}
        onChange={onTagsChange}
        placeholder="Nhập tag và nhấn Enter..."
        disabled={isSaving}
      />
    </section>
  );

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <ModalWrapper
      title={(
        <div className="min-w-0">
          <div className="truncate text-sm font-bold leading-tight text-deep-teal">Tạo yêu cầu mới</div>
        </div>
      )}
      icon="add_circle"
      zIndexClassName="z-[120]"
      contentClassName="min-h-0 flex flex-1 flex-col bg-white"
      width="max-w-none"
      heightClass="h-[calc(100dvh-32px)] sm:h-[calc(100dvh-48px)]"
      maxHeightClass=""
      panelClassName={customerRequestModalPanelClass}
      disableClose={isSaving}
      disableBackdropClose={true}
      headerClassName="bg-white px-3 py-2 sm:px-4 lg:px-4 xl:px-5"
      onClose={onClose}
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto custom-scrollbar">
          <div className="min-w-0 w-full space-y-4 px-3 py-2 sm:px-5 sm:py-4">
            {masterFields.length === 0 ? (
              <div className="rounded-[var(--ui-shell-radius)] border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
                <span className="material-symbols-outlined mb-2 block text-3xl text-slate-300">
                  hourglass_empty
                </span>
                Đang tải biểu mẫu…
              </div>
            ) : (
              <div
                data-testid="customer-request-create-layout"
                className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)] xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,1fr)]"
              >
                <div className="min-w-0">
                  <section className={compactSectionCardClass}>
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <div className={`${compactSectionIconBoxClass} bg-primary/10 text-primary`}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>description</span>
                      </div>
                      <h4 className={compactSectionTitleClass}>
                        Thông tin yêu cầu
                      </h4>
                    </div>

                    <div className="mt-2 grid gap-2.5 lg:grid-cols-2">
                      {primaryMasterFields.map((field) => {
                        return (
                          <div
                            key={field.name}
                            className={
                              field.name === 'project_item_id' ||
                              field.name === 'summary'
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
                              onOpenAddCustomerPersonnelModal={onOpenAddCustomerPersonnelModal}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {descriptionField ? (
                      <div
                        data-testid="customer-request-create-description"
                        className="mt-2 [&_textarea]:min-h-[150px] lg:[&_textarea]:min-h-[210px]"
                      >
                        <ProcessFieldInput
                          field={descriptionField}
                          value={masterDraft[descriptionField.name]}
                          customers={customers}
                          employees={employees}
                          customerPersonnel={customerPersonnel}
                          supportServiceGroups={supportServiceGroups}
                          projectItems={projectItems}
                          selectedCustomerId={selectedCustomerId}
                          disabled={isSaving}
                          density="compact"
                          onChange={onMasterFieldChange}
                          onOpenAddCustomerPersonnelModal={onOpenAddCustomerPersonnelModal}
                        />
                      </div>
                    ) : null}
                  </section>
                </div>

                <aside
                  data-testid="customer-request-create-rail"
                  className="min-w-0 space-y-4 lg:sticky lg:top-0 lg:self-start"
                >
                  {renderTagSection()}
                  {renderTaskSection()}
                  {renderAttachmentSection()}
                </aside>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div
        data-testid="customer-request-create-footer"
        className="sticky bottom-0 z-10 flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4 lg:px-4 xl:px-5"
      >
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 sm:text-[11px]">
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

        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className={`${customerRequestSecondaryButtonClass} w-full sm:w-auto`}
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={isSaving || masterFields.length === 0}
            className={`${customerRequestPrimaryButtonClass} w-full sm:w-auto`}
          >
            {isSaving ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[16px]">
                  progress_activity
                </span>
                Đang lưu…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">save</span>
                Tạo yêu cầu
              </>
            )}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};
