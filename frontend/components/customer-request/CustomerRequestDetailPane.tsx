import React, { useEffect, useMemo, useState } from 'react';
import type {
  Attachment,
  YeuCauEstimate,
  YeuCauHoursReport,
  YeuCauProcessDetail,
  YeuCauProcessField,
  YeuCauProcessMeta,
  YeuCauTag,
  YeuCauTimelineEntry,
  YeuCauWorklog,
} from '../../types/customerRequest';
import type { Customer, CustomerPersonnel } from '../../types/customer';
import type { Employee } from '../../types/employee';
import type { ProjectItemMaster } from '../../types/project';
import type { SupportServiceGroup } from '../../types/support';
import { formatDateDdMmYyyy, formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';
import { AttachmentManager } from '../AttachmentManager';
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect';
import { CustomerRequestQuickActionModal } from './CustomerRequestQuickActionModal';
import { TagInput } from './TagInput';
import { ProcessFieldInput } from './CustomerRequestFieldRenderer';
import { CustomerRequestEstimatePanel } from './CustomerRequestEstimatePanel';
import { CustomerRequestHoursPanel } from './CustomerRequestHoursPanel';
import {
  type DispatcherQuickAction,
  type PerformerQuickAction,
  SUPPORT_TASK_STATUS_OPTIONS,
  formatHoursValue,
  humanizeKetQua,
  resolveRequestProcessCode,
  resolveRequestStatusMeta,
  resolveStatusMeta,
  resolveTransitionStatusMeta,
  type CustomerRequestTaskSource,
  type It360TaskFormRow,
  type ReferenceTaskFormRow,
} from './presentation';
import { normalizeText } from './helpers';

type RelatedSummaryItem = {
  label: string;
  value?: string | null;
  hint?: string | null;
};

type DetailTabKey = 'chi_tiet' | 'hours' | 'estimate' | 'files' | 'tasks' | 'timeline';

type CustomerRequestDetailPaneProps = {
  isDetailLoading: boolean;
  isListLoading: boolean;
  isCreateMode: boolean;
  presentation?: 'embedded' | 'full_modal';
  /** true khi user đã click chọn một yêu cầu nhưng detail chưa/không load được */
  isRequestSelected?: boolean;
  processDetail: YeuCauProcessDetail | null;
  canTransitionActiveRequest: boolean;
  transitionOptions: YeuCauProcessMeta[];
  transitionStatusCode: string;
  onTransitionStatusCodeChange: (value: string) => void;
  onOpenTransitionModal: () => void;
  isSaving: boolean;
  canEditActiveForm: boolean;
  onSaveRequest?: () => Promise<void> | void;
  onSaveAttachmentsOnly?: () => Promise<void> | void;
  masterFields: YeuCauProcessField[];
  masterDraft: Record<string, unknown>;
  onMasterFieldChange: (fieldName: string, value: unknown) => void;
  editorProcessMeta: YeuCauProcessMeta | null | undefined;
  processDraft: Record<string, unknown>;
  onProcessDraftChange: (fieldName: string, value: unknown) => void;
  onSaveStatusDetail: () => void;
  onSaveTaskReference?: () => void;
  customers: Customer[];
  employees: Employee[];
  customerPersonnel: CustomerPersonnel[];
  supportServiceGroups: SupportServiceGroup[];
  availableProjectItems: ProjectItemMaster[];
  selectedProjectItem: ProjectItemMaster | null;
  selectedCustomerId: string;
  activeTaskTab: CustomerRequestTaskSource;
  onActiveTaskTabChange: (tab: CustomerRequestTaskSource) => void;
  onAddTaskRow: () => void;
  formIt360Tasks: It360TaskFormRow[];
  onUpdateIt360TaskRow: (localId: string, fieldName: keyof Omit<It360TaskFormRow, 'local_id'>, value: unknown) => void;
  onRemoveIt360TaskRow: (localId: string) => void;
  formReferenceTasks: ReferenceTaskFormRow[];
  formTags: YeuCauTag[];
  onFormTagsChange: (tags: YeuCauTag[]) => void;
  taskReferenceOptions: SearchableSelectOption[];
  onUpdateReferenceTaskRow: (localId: string, value: string) => void;
  onTaskReferenceSearchTermChange: (value: string) => void;
  taskReferenceSearchTerm: string;
  taskReferenceSearchError: string;
  isTaskReferenceSearchLoading: boolean;
  onRemoveReferenceTaskRow: (localId: string) => void;
  formAttachments: Attachment[];
  onUploadAttachment: (file: File) => Promise<void>;
  onDeleteAttachment: (id: string | number) => Promise<void>;
  isUploadingAttachment: boolean;
  attachmentError: string;
  attachmentNotice: string;
  relatedSummaryItems: RelatedSummaryItem[];
  currentHoursReport: YeuCauHoursReport | null | undefined;
  estimateHistory: YeuCauEstimate[];
  timeline: YeuCauTimelineEntry[];
  caseWorklogs: YeuCauWorklog[];
  canOpenCreatorFeedbackModal: boolean;
  onOpenCreatorFeedbackModal: () => void;
  canOpenNotifyCustomerModal: boolean;
  onOpenNotifyCustomerModal: () => void;
  canOpenWorklogModal: boolean;
  onOpenWorklogModal: () => void;
  onOpenDetailStatusWorklogModal: (action: 'in_progress' | 'paused' | 'completed') => void;
  onEditWorklog: (worklog: YeuCauWorklog) => void;
  isSubmittingWorklog: boolean;
  canOpenEstimateModal: boolean;
  onOpenEstimateModal: () => void;
  isSubmittingEstimate: boolean;
  dispatcherQuickActions: DispatcherQuickAction[];
  onRunDispatcherAction: (action: DispatcherQuickAction) => void;
  performerQuickActions: PerformerQuickAction[];
  onRunPerformerAction: (action: PerformerQuickAction) => void;
};

const DETAIL_TABS: Array<{ key: DetailTabKey; label: string; icon: string }> = [
  { key: 'hours', label: 'Giờ công', icon: 'schedule' },
  { key: 'estimate', label: 'Ước lượng', icon: 'rule' },
  { key: 'files', label: 'Tệp', icon: 'attach_file' },
  { key: 'tasks', label: 'Task/Ref', icon: 'deployed_code' },
  { key: 'timeline', label: 'Dòng thời gian', icon: 'timeline' },
];

const EmptyTabState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50/50 to-white px-4 py-12 text-center">
    <span className="material-symbols-outlined mb-3 text-[32px] text-slate-300">inbox</span>
    <p className="text-sm font-medium text-slate-500">{message}</p>
  </div>
);

const resolveWorklogDetailStatusLabel = (detailStatusAction: string | null | undefined): string | null => {
  const normalized = normalizeText(detailStatusAction).toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === 'in_progress') {
    return 'Đang thực hiện';
  }
  if (normalized === 'paused') {
    return 'Tạm ngưng';
  }
  if (normalized === 'completed') {
    return 'Hoàn thành';
  }
  if (normalized === 'open') {
    return 'Mở';
  }
  return normalized;
};

const resolveWorklogMainStatusLabel = (worklog: YeuCauWorklog): string | null => (
  normalizeText(worklog.status_name_vi)
  || normalizeText(worklog.status_code)
  || null
);

export const CustomerRequestDetailPane: React.FC<CustomerRequestDetailPaneProps> = ({
  isDetailLoading,
  isListLoading,
  isCreateMode,
  presentation = 'embedded',
  isRequestSelected = false,
  processDetail,
  canTransitionActiveRequest,
  transitionOptions,
  transitionStatusCode,
  onTransitionStatusCodeChange,
  onOpenTransitionModal,
  isSaving,
  canEditActiveForm,
  onSaveRequest,
  onSaveAttachmentsOnly,
  masterFields,
  masterDraft,
  onMasterFieldChange,
  editorProcessMeta,
  processDraft,
  onProcessDraftChange,
  onSaveStatusDetail,
  onSaveTaskReference,
  customers,
  employees,
  customerPersonnel,
  supportServiceGroups,
  availableProjectItems,
  selectedProjectItem,
  selectedCustomerId,
  activeTaskTab,
  onActiveTaskTabChange,
  onAddTaskRow,
  formIt360Tasks,
  onUpdateIt360TaskRow,
  onRemoveIt360TaskRow,
  formReferenceTasks,
  formTags,
  onFormTagsChange,
  taskReferenceOptions,
  onUpdateReferenceTaskRow,
  onTaskReferenceSearchTermChange,
  taskReferenceSearchTerm,
  taskReferenceSearchError,
  isTaskReferenceSearchLoading,
  onRemoveReferenceTaskRow,
  formAttachments,
  onUploadAttachment,
  onDeleteAttachment,
  isUploadingAttachment,
  attachmentError,
  attachmentNotice,
  relatedSummaryItems,
  currentHoursReport,
  estimateHistory,
  timeline,
  caseWorklogs,
  canOpenCreatorFeedbackModal,
  onOpenCreatorFeedbackModal,
  canOpenNotifyCustomerModal,
  onOpenNotifyCustomerModal,
  canOpenWorklogModal,
  onOpenWorklogModal,
  onOpenDetailStatusWorklogModal,
  onEditWorklog,
  isSubmittingWorklog,
  canOpenEstimateModal,
  onOpenEstimateModal,
  isSubmittingEstimate,
  dispatcherQuickActions,
  onRunDispatcherAction,
  performerQuickActions,
  onRunPerformerAction,
}) => {
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTabKey>('hours');
  const [showDispatcherActionModal, setShowDispatcherActionModal] = useState(false);
  const [showPerformerActionModal, setShowPerformerActionModal] = useState(false);
  const isFullModalPresentation = presentation === 'full_modal';
  const visibleDetailTabs = useMemo(
    () => (isCreateMode ? DETAIL_TABS.filter((tab) => tab.key === 'tasks') : DETAIL_TABS),
    [isCreateMode]
  );

  useEffect(() => {
    setActiveDetailTab('hours');
    setShowDispatcherActionModal(false);
    setShowPerformerActionModal(false);
  }, [isCreateMode, processDetail?.yeu_cau?.id]);

  useEffect(() => {
    if (visibleDetailTabs.some((tab) => tab.key === activeDetailTab)) {
      return;
    }
    setActiveDetailTab(visibleDetailTabs[0]?.key ?? 'hours');
  }, [activeDetailTab, visibleDetailTabs]);

  if (isDetailLoading) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-400">
        Đang tải chi tiết yêu cầu...
      </div>
    );
  }

  if (!isCreateMode && !processDetail) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-400">
        {isDetailLoading
          ? 'Đang tải chi tiết yêu cầu...'
          : isListLoading
          ? 'Đang tải yêu cầu trong tiến trình này.'
          : isRequestSelected
          ? 'Không tải được chi tiết yêu cầu. Vui lòng thử chọn lại từ danh sách hoặc tải lại trang.'
          : 'Chọn một yêu cầu ở tab Danh sách YC hoặc tạo yêu cầu mới.'}
      </div>
    );
  }

  const actionFlags = processDetail?.available_actions ?? {};
  const latestWorklogs = caseWorklogs.slice(0, 5);
  const transitionCtaLabel = 'Chuyển →';
  const rawDetailStatus = processDetail?.current_detail_status;
  // Map Vietnamese status values to English equivalents
  const mapVietnameseToEnglishStatus = (status: string | null | undefined): string => {
    if (!status) return '';
    const normalized = normalizeText(status).toLowerCase();
    switch (normalized) {
      case 'mở':
        return 'open';
      case 'đang thực hiện':
        return 'in_progress';
      case 'tạm ngưng':
        return 'paused';
      case 'hoàn thành':
        return 'completed';
      default:
        return normalized; // Return as-is if not a known Vietnamese term
    }
  };
  const currentDetailStatus = mapVietnameseToEnglishStatus(rawDetailStatus);
  const isDetailInProgress = currentDetailStatus === 'in_progress';
  const isDetailPaused = currentDetailStatus === 'paused';
  const isDetailOpen = currentDetailStatus === 'open';
  const isDetailCompleted = currentDetailStatus === 'completed';
  const quickStats = [
    { label: 'Tác vụ/YC', value: formIt360Tasks.length + formReferenceTasks.length },
    { label: 'Tệp', value: formAttachments.length },
    { label: 'Dòng thời gian', value: timeline.length },
    { label: 'Nhật ký', value: caseWorklogs.length },
  ];

  const visibleRelatedSummaryItems = relatedSummaryItems.filter((item) => item.label !== 'Người xử lý');
  const shouldHideInitialIntakeSection = !isCreateMode
    && resolveRequestProcessCode(processDetail?.yeu_cau ?? {}) === 'new_intake';
  const selectedCustomerName =
    customers.find((customer) => String(customer.id) === selectedCustomerId)?.customer_name
    || selectedProjectItem?.customer_name
    || '';

  const actionFlagItems = [
    { key: 'can_write', label: 'Có thể cập nhật', active: Boolean(actionFlags.can_write) },
    { key: 'can_transition', label: 'Có thể chuyển bước', active: Boolean(actionFlags.can_transition) },
    { key: 'can_add_worklog', label: 'Có thể ghi nhật ký', active: Boolean(actionFlags.can_add_worklog) },
    { key: 'can_add_estimate', label: 'Có thể thêm ước lượng', active: Boolean(actionFlags.can_add_estimate) },
  ];
  const inlineRelatedSummaryItems = visibleRelatedSummaryItems.filter(
    (item) => item.label !== 'Mã yêu cầu' && item.label !== 'Khách hàng'
  );
  const showSummaryBar = !isFullModalPresentation || isCreateMode;
  const summaryBarItems = isCreateMode
    ? [
        {
          label: 'Ngữ cảnh',
          value: selectedProjectItem?.project_name || selectedCustomerName || 'Chưa chọn khách hàng / dự án',
        },
        {
          label: 'Workflow',
          value: editorProcessMeta?.process_label || 'Mới tiếp nhận',
        },
        {
          label: 'Task/Ref',
          value: String(formIt360Tasks.length + formReferenceTasks.length),
        },
        {
          label: 'Tệp',
          value: String(formAttachments.length),
        },
        {
          label: 'Tag',
          value: String(formTags.length),
        },
      ]
    : [
        {
          label: 'Kết quả',
          value: humanizeKetQua(processDetail?.yeu_cau?.ket_qua ?? '') || '--',
        },
        ...inlineRelatedSummaryItems.slice(0, 2).map((item) => ({
          label: item.label,
          value: item.value || '--',
        })),
        {
          label: 'Tác vụ/YC',
          value: String(formIt360Tasks.length + formReferenceTasks.length),
        },
        {
          label: 'Tệp',
          value: String(formAttachments.length),
        },
        {
          label: 'Nhật ký',
          value: String(caseWorklogs.length),
    },
  ];

  const compactSectionTitleClass = 'text-xs font-bold uppercase tracking-[0.12em] text-slate-500';
  const compactSectionIconBoxClass = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-md';

  const renderTaskManager = () => (
    <div className="space-y-4">
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-slate-400">deployed_code</span>
          <h4 className={compactSectionTitleClass}>Task liên quan</h4>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onActiveTaskTabChange('IT360')}
            className={`group inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
              activeTaskTab === 'IT360'
                ? 'bg-gradient-to-r from-primary to-primary/80 text-white shadow-md shadow-primary/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:shadow-sm'
            }`}
          >
            <span className="material-symbols-outlined text-base transition-transform group-hover:scale-110">deployed_code</span>
            Task IT360
          </button>
          <button
            type="button"
            onClick={() => onActiveTaskTabChange('REFERENCE')}
            className={`group inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
              activeTaskTab === 'REFERENCE'
                ? 'bg-gradient-to-r from-primary to-primary/80 text-white shadow-md shadow-primary/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:shadow-sm'
            }`}
          >
            <span className="material-symbols-outlined text-base transition-transform group-hover:scale-110">dataset_linked</span>
            Task tham chiếu
          </button>
          {/* {canEditActiveForm && !isCreateMode && onSaveRequest ? (
            <button
              type="button"
              onClick={() => void onSaveRequest()}
              disabled={isSaving}
              className="group inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-primary/90 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-md"
            >
              <span className="material-symbols-outlined text-sm transition-transform group-hover:scale-110">save</span>
              {isSaving ? 'Đang cập nhật…' : 'Cập nhật'}
            </button>
          ) : null} */}
          {canEditActiveForm ? (
            <>
              {/* <button
                type="button"
                onClick={onSaveStatusDetail}
                disabled={isSaving}
                className="inline-flex items-center rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSaving ? 'Đang cập nhật...' : 'Cập nhật'}
              </button> */}
              {onSaveTaskReference ? (
                <button
                  type="button"
                  onClick={onSaveTaskReference}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <span className="material-symbols-outlined text-[15px]">link</span>
                  {isSaving ? 'Đang cập nhật...' : 'Cập nhật Task/Ref'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onAddTaskRow}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                {activeTaskTab === 'IT360' ? 'Thêm Task IT360' : 'Thêm task tham chiếu'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50/80 to-white/80 p-3 shadow-inner">
        {activeTaskTab === 'IT360' ? (
          <div className="space-y-2">
            {formIt360Tasks.map((task, index) => (
              <div
                key={task.local_id}
                className="group grid gap-2.5 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-3 shadow-sm transition-shadow hover:shadow-md md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_220px_auto]"
              >
                <div className="space-y-1.5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Task IT360 #{index + 1}</p>
                  <input
                    type="text"
                    value={task.task_code}
                    onChange={(event) => onUpdateIt360TaskRow(task.local_id, 'task_code', event.target.value)}
                    placeholder={`Nhập mã task IT360 #${index + 1}`}
                    disabled={!canEditActiveForm || isSaving}
                    className="h-10 w-full rounded border border-slate-200 bg-white/80 px-3 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Link task</p>
                  <input
                    type="text"
                    value={task.task_link}
                    onChange={(event) => onUpdateIt360TaskRow(task.local_id, 'task_link', event.target.value)}
                    placeholder="Link task IT360"
                    disabled={!canEditActiveForm || isSaving}
                    className="h-10 w-full rounded border border-slate-200 bg-white/80 px-3 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Trạng thái</p>
                  <SearchableSelect
                    value={task.status}
                    options={SUPPORT_TASK_STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
                    onChange={(value) => onUpdateIt360TaskRow(task.local_id, 'status', value)}
                    disabled={!canEditActiveForm || isSaving}
                    compact
                  />
                </div>

                <div className="flex items-end justify-end">
                  {canEditActiveForm ? (
                    <button
                      type="button"
                      onClick={() => onRemoveIt360TaskRow(task.local_id)}
                      className="group/btn material-symbols-outlined rounded border border-transparent p-2 text-slate-400 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 hover:shadow-sm"
                      title="Xoá task IT360"
                    >
                      delete
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {formReferenceTasks.map((task, index) => (
              <div
                key={task.local_id}
                className="grid gap-2 rounded-xl border border-slate-200 bg-white p-2.5 md:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Task tham chiếu #{index + 1}
                  </p>
                  <SearchableSelect
                    value={task.task_code}
                    options={taskReferenceOptions}
                    onChange={(value) => onUpdateReferenceTaskRow(task.local_id, value)}
                    onSearchTermChange={onTaskReferenceSearchTermChange}
                    placeholder={`Chọn task tham chiếu #${index + 1}`}
                    searchPlaceholder="Tìm theo mã task hoặc mã yêu cầu..."
                    noOptionsText={
                      taskReferenceSearchError ||
                      (taskReferenceSearchTerm.trim() === ''
                        ? 'Nhập mã task hoặc mã yêu cầu để lọc thêm, hoặc chọn từ danh sách gợi ý.'
                        : 'Không tìm thấy task tham chiếu')
                    }
                    searching={isTaskReferenceSearchLoading}
                    disabled={!canEditActiveForm || isSaving}
                    compact
                  />
                  {taskReferenceSearchError ? (
                    <p className="text-xs text-rose-600">{taskReferenceSearchError}</p>
                  ) : null}
                </div>

                <div className="flex items-end justify-end">
                  {canEditActiveForm ? (
                    <button
                      type="button"
                      onClick={() => onRemoveReferenceTaskRow(task.local_id)}
                      className="material-symbols-outlined rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                      title="Xoá task tham chiếu"
                    >
                      delete
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderFileManager = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className={compactSectionTitleClass}>Tệp đính kèm</h4>
        {canEditActiveForm && onSaveAttachmentsOnly ? (
          <button
            type="button"
            onClick={() => void onSaveAttachmentsOnly()}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[15px]">save</span>
            {isSaving ? 'Đang cập nhật…' : 'Cập nhật'}
          </button>
        ) : null}
      </div>
      <AttachmentManager
        attachments={formAttachments}
        onUpload={onUploadAttachment}
        onDelete={onDeleteAttachment}
        isUploading={isUploadingAttachment}
        disabled={!canEditActiveForm || isSaving}
        emptyStateDescription="Chưa có file đính kèm nào. Kéo thả hoặc Ctrl+V để dán ảnh."
        enableClipboardPaste
        clipboardPasteHint="Click vào khung rồi Ctrl/Cmd+V để dán ảnh chụp."
      />

      {attachmentError ? <p className="text-sm text-rose-600">{attachmentError}</p> : null}
      {!attachmentError && attachmentNotice ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          {attachmentNotice}
        </div>
      ) : null}
    </div>
  );

  const renderTimelineTab = () => {
    if (isCreateMode) {
      return <EmptyTabState message="Timeline sẽ có sau khi yêu cầu được lưu và bắt đầu luân chuyển trạng thái." />;
    }

    if (timeline.length === 0) {
      return <EmptyTabState message="Chưa có timeline cho yêu cầu này." />;
    }

    return (
      <div className="space-y-3">
        {timeline.map((entry, index) => {
          const meta = resolveStatusMeta(entry.tien_trinh, entry.decision_reason_label || entry.trang_thai_moi);
          return (
            <div key={String(entry.id ?? index)} className="group flex gap-3 rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/60 p-3.5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex flex-col items-center">
                <span className={`mt-1 h-3 w-3 rounded-full ring-2 ring-white ${meta.cls}`} />
                {index < timeline.length - 1 ? <div className="mt-2 w-px flex-1 bg-gradient-to-b from-slate-200 to-slate-100" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}>
                    {meta.label}
                  </span>
                  {entry.trang_thai_cu ? (
                    <span className="text-xs text-slate-400">từ {entry.trang_thai_cu}</span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {[
                    entry.nguoi_thay_doi_name,
                    entry.nguoi_thay_doi_code,
                    entry.created_at ? formatDateTimeDdMmYyyy(entry.created_at)?.slice(0, 16) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {entry.ly_do ? (
                  <p className="mt-2 rounded-xl border border-slate-100 bg-white/60 px-2.5 py-1.5 text-sm text-slate-700">
                    {entry.ly_do}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderHoursTab = () => {
    if (isCreateMode || !processDetail) {
      return <EmptyTabState message="Giờ công sẽ hiển thị sau khi yêu cầu được lưu và bắt đầu phát sinh nhật ký công việc." />;
    }

    return (
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
        <div className="space-y-3">
          <CustomerRequestHoursPanel
            request={processDetail.yeu_cau}
            hoursReport={currentHoursReport}
            canAddWorklog={canOpenWorklogModal}
            onAddWorklog={onOpenWorklogModal}
            isActionDisabled={isSaving || isSubmittingWorklog}
          />

          <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-3.5 shadow-md shadow-slate-200/40">
            <div className="mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-slate-400">history</span>
              <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Nhật ký công việc gần nhất</h4>
            </div>
            <div className="space-y-2.5">
              {latestWorklogs.length === 0 ? (
                <EmptyTabState message="Chưa có nhật ký công việc nào cho yêu cầu này." />
              ) : (
                latestWorklogs.map((worklog) => {
                  const mainStatusLabel = resolveWorklogMainStatusLabel(worklog);
                  const detailStatusLabel = resolveWorklogDetailStatusLabel(worklog.detail_status_action);

                  return (
                    <button
                      key={worklog.id}
                      type="button"
                      onClick={() => onEditWorklog(worklog)}
                      disabled={isSaving || isSubmittingWorklog}
                      className="group w-full rounded-xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/60 px-3 py-2.5 text-left shadow-sm transition-shadow hover:shadow-md disabled:opacity-50"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {worklog.performed_by_name || 'Chưa xác định'}
                        </p>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          {formatHoursValue(worklog.hours_spent)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500">
                        {[
                          worklog.activity_type_code,
                          mainStatusLabel ? `Trạng thái: ${mainStatusLabel}` : null,
                          detailStatusLabel ? `Chi tiết: ${detailStatusLabel}` : null,
                          formatDateDdMmYyyy(worklog.work_date || worklog.work_started_at),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {worklog.work_content ? <p className="mt-2 rounded-lg border border-slate-100 bg-white/60 px-2.5 py-1.5 text-sm text-slate-700">{worklog.work_content}</p> : null}
                      {worklog.difficulty_note ? <p className="mt-2 rounded-lg border border-red-100 bg-red-50/60 px-2.5 py-1.5 text-sm font-medium text-red-700"><span className="font-semibold">Khó khăn:</span> {worklog.difficulty_note}</p> : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {(currentHoursReport?.by_activity ?? []).length > 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-3.5 shadow-md shadow-slate-200/40">
              <div className="mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-slate-400">category</span>
                <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Theo hoạt động</h4>
              </div>
              <div className="space-y-2">
                {(currentHoursReport?.by_activity ?? []).map((activity) => (
                  <div key={activity.activity_type_code || 'unknown'} className="group rounded-xl border border-slate-100 bg-white/80 px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-800">
                        {activity.activity_type_code || 'Chưa phân loại'}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                        {formatHoursValue(activity.hours_spent)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{activity.worklog_count ?? 0} nhật ký</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {(currentHoursReport?.by_performer ?? []).length > 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-3.5 shadow-md shadow-slate-200/40">
              <div className="mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-slate-400">people</span>
                <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Theo người thực hiện</h4>
              </div>
              <div className="space-y-2">
                {(currentHoursReport?.by_performer ?? []).map((person) => (
                  <div key={`${person.performed_by_user_id ?? 'unknown'}-${person.performed_by_name ?? ''}`} className="group rounded-xl border border-slate-100 bg-white/80 px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-800">{person.performed_by_name || 'Chưa xác định'}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                        {formatHoursValue(person.hours_spent)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{person.worklog_count ?? 0} nhật ký</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderEstimateTab = () => {
    if (isCreateMode || !processDetail) {
      return <EmptyTabState message="Ước lượng sẽ hiển thị sau khi yêu cầu được lưu và có dữ liệu tương ứng." />;
    }

    return (
      <CustomerRequestEstimatePanel
        request={processDetail.yeu_cau}
        hoursReport={currentHoursReport}
        estimateHistory={estimateHistory}
        canAddEstimate={canOpenEstimateModal}
        onAddEstimate={onOpenEstimateModal}
        isActionDisabled={isSaving || isSubmittingEstimate}
      />
    );
  };

  const renderDetailOverviewTab = () => (
    <div className="grid min-w-0 gap-4">
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Mã YC</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{processDetail?.yeu_cau?.ma_yc || '--'}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Kết quả</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{humanizeKetQua(processDetail?.yeu_cau?.ket_qua ?? '')}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Ước lượng hiện hành</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatHoursValue(currentHoursReport?.estimated_hours ?? processDetail?.yeu_cau?.estimated_hours)}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Giờ thực tế</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatHoursValue(currentHoursReport?.total_hours_spent ?? processDetail?.yeu_cau?.total_hours_spent)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-3.5">
          <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Quyền thao tác hiện tại</h4>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {actionFlagItems.map((item) => (
              <span
                key={item.key}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  item.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-3.5">
          <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Hoạt động gần đây</h4>
          <div className="mt-3 space-y-2.5">
            {latestWorklogs.length === 0 ? (
              <EmptyTabState message="Chưa có nhật ký công việc gần đây." />
            ) : (
              latestWorklogs.map((worklog) => {
                const mainStatusLabel = resolveWorklogMainStatusLabel(worklog);
                const detailStatusLabel = resolveWorklogDetailStatusLabel(worklog.detail_status_action);

                return (
                  <button
                    key={worklog.id}
                    type="button"
                    onClick={() => onEditWorklog(worklog)}
                    disabled={isSaving || isSubmittingWorklog}
                    className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-left transition hover:bg-slate-100 disabled:opacity-50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{worklog.performed_by_name || 'Chưa xác định'}</p>
                      <span className="text-xs text-slate-500">{formatHoursValue(worklog.hours_spent)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {[
                        worklog.activity_type_code,
                        mainStatusLabel ? `Trạng thái: ${mainStatusLabel}` : null,
                        detailStatusLabel ? `Chi tiết: ${detailStatusLabel}` : null,
                        formatDateDdMmYyyy(worklog.work_date || worklog.work_started_at),
                      ].filter(Boolean).join(' · ')}
                    </p>
                    {worklog.work_content ? <p className="mt-2 text-sm text-slate-700">{worklog.work_content}</p> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderActiveTab = () => {
    switch (activeDetailTab) {
      case 'hours':
        return renderHoursTab();
      case 'estimate':
        return renderEstimateTab();
      case 'files':
        return renderFileManager();
      case 'tasks':
        return renderTaskManager();
      case 'timeline':
        return renderTimelineTab();
      default:
        return renderDetailOverviewTab();
    }
  };

  return (
    <div className={`min-w-0 ${isFullModalPresentation ? 'space-y-3' : 'space-y-5'}`}>
      {showSummaryBar ? (
        <section className={`rounded-[28px] border border-slate-200 bg-white shadow-sm ${isFullModalPresentation ? 'p-3.5 sm:p-4' : 'p-4'}`}>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-6">
            {summaryBarItems.map((item) => (
              <div key={item.label} className={`rounded-2xl border border-slate-100 px-2.5 py-2.5 ${item.label === 'Ngữ cảnh' ? 'sm:col-span-2 xl:col-span-2 bg-slate-50' : 'bg-slate-50/80'}`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!isCreateMode ? (
        <section className={`rounded-[28px] border border-slate-200 bg-white shadow-sm ${isFullModalPresentation ? 'p-3.5 sm:p-4' : 'p-4'}`}>
          <div className="flex flex-col gap-2 border-b border-slate-100 pb-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <div className={`${compactSectionIconBoxClass} bg-primary/10 text-primary`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>sync_alt</span>
                </div>
                <h4 className={compactSectionTitleClass}>Trạng thái xử lý</h4>
                {(() => {
                  const meta = resolveRequestStatusMeta(processDetail?.yeu_cau ?? {});
                  return (
                    <span className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold ${meta.cls}`}>
                      <span className="text-[10px] leading-none">●</span>
                      {meta.label}
                    </span>
                  );
                })()}
              </div>

              {canEditActiveForm && !isCreateMode && onSaveRequest ? (
                <button
                  type="button"
                  onClick={() => void onSaveRequest()}
                  disabled={isSaving}
                  className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded bg-primary px-3 text-xs font-semibold text-white transition hover:brightness-105 disabled:opacity-50 sm:w-auto"
                >
                  <span className="material-symbols-outlined text-[15px]">save</span>
                  {isSaving ? 'Đang cập nhật…' : 'Cập nhật'}
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
            {canOpenWorklogModal ? (
              <>
                <button
                  type="button"
                  onClick={() => onOpenDetailStatusWorklogModal('in_progress')}
                  disabled={isSaving || isSubmittingWorklog}
                  className={`inline-flex h-8 items-center gap-1.5 rounded border px-3 text-xs font-semibold transition disabled:opacity-50 ${
                    isDetailInProgress
                      ? 'border-blue-200 bg-blue-600 text-white hover:bg-blue-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">play_circle</span>
                  Đang thực hiện
                </button>
                <button
                  type="button"
                  onClick={() => onOpenDetailStatusWorklogModal('paused')}
                  disabled={isSaving || isSubmittingWorklog}
                  className={`inline-flex h-8 items-center gap-1.5 rounded border px-3 text-xs font-semibold transition disabled:opacity-50 ${
                    isDetailPaused
                      ? 'border-blue-200 bg-blue-600 text-white hover:bg-blue-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">pause_circle</span>
                  Tạm ngưng
                </button>
              </>
            ) : null}

            {canTransitionActiveRequest ? (
              <>
                {!isDetailOpen && (
                  <button
                    type="button"
                    onClick={onOpenTransitionModal}
                    disabled={isSaving || !canTransitionActiveRequest || !transitionStatusCode}
                    className="inline-flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-xs font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[15px]">arrow_right_alt</span>
                    Hoàn thành
                  </button>
                )}
                {!isDetailOpen && (
                  <select
                    value={transitionStatusCode}
                    onChange={(event) => onTransitionStatusCodeChange(event.target.value)}
                    disabled={isSaving || !canTransitionActiveRequest}
                    className="h-8 min-w-[168px] rounded border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                  >
                    {transitionOptions.length > 0 ? (
                      transitionOptions.map((option) => {
                        const meta = resolveTransitionStatusMeta(option);
                        return (
                          <option key={option.process_code} value={option.process_code}>
                            {meta.label}
                          </option>
                        );
                      })
                    ) : (
                      <option value="">-- Không có bước tiếp theo --</option>
                    )}
                  </select>
                )}
              </>
            ) : null}

            {canTransitionActiveRequest && transitionOptions.length === 0 ? (
              <span className="text-xs font-medium text-slate-400">Không có trạng thái đích hợp lệ từ bước hiện tại.</span>
            ) : null}
          </div>
          </div>
        </section>
      ) : null}

      <section className={`rounded-[28px] border border-slate-200 bg-white shadow-sm ${isFullModalPresentation ? 'p-3.5 sm:p-4' : 'p-4'}`}>
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <div className={`${compactSectionIconBoxClass} bg-emerald-50 text-emerald-700`}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>description</span>
          </div>
          <h4 className={compactSectionTitleClass}>Thông tin yêu cầu</h4>
        </div>

        <div className="mt-2 grid gap-3 lg:grid-cols-2">
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
                  field.name === 'project_item_id' || field.name === 'summary' || field.name === 'description'
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
                  projectItems={availableProjectItems}
                  selectedCustomerId={selectedCustomerId}
                  disabled={!canEditActiveForm || isSaving}
                  density="compact"
                  onChange={onMasterFieldChange}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className={`rounded-[28px] border border-slate-200 bg-white shadow-sm ${isFullModalPresentation ? 'p-3.5 sm:p-4' : 'p-4'}`}>
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <div className={`${compactSectionIconBoxClass} bg-violet-50 text-violet-700`}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>sell</span>
          </div>
          <h4 className={compactSectionTitleClass}>Thẻ</h4>
        </div>
        <div className="mt-2">
          <TagInput
            value={formTags}
            onChange={onFormTagsChange}
            disabled={!canEditActiveForm || isSaving}
            placeholder="Thêm tag cho yêu cầu..."
          />
        </div>
      </section>

      {!shouldHideInitialIntakeSection && editorProcessMeta && editorProcessMeta.form_fields.length > 0 ? (
        <section className={`rounded-[28px] border border-slate-200 bg-white shadow-sm ${isFullModalPresentation ? 'p-3.5 sm:p-4' : 'p-4'}`}>
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className={`${compactSectionIconBoxClass} bg-sky-50 text-sky-700`}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>flowchart</span>
              </div>
              <h4 className={compactSectionTitleClass}>{editorProcessMeta.process_label}</h4>
            </div>
            <button
              type="button"
              onClick={onSaveStatusDetail}
              disabled={!canEditActiveForm || isSaving}
              className="inline-flex w-full items-center justify-center rounded bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
            >
              {isSaving ? 'Đang cập nhật...' : 'Cập nhật'}
            </button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {([
              { name: 'received_at', label: 'Ngày bắt đầu', type: 'datetime', required: false },
              { name: 'completed_at', label: 'Ngày kết thúc', type: 'datetime', required: false },
              { name: 'extended_at', label: 'Ngày gia hạn', type: 'datetime', required: false },
              { name: 'progress_percent', label: 'Tiến độ phần trăm', type: 'number', required: false },
              { name: 'from_user_id', label: 'Người chuyển', type: 'user_select', required: false },
              { name: 'to_user_id', label: 'Người nhận', type: 'user_select', required: false },
              { name: 'notes', label: 'Ghi chú', type: 'textarea', required: false },
            ] satisfies YeuCauProcessField[]).map((field) => (
              <ProcessFieldInput
                key={field.name}
                field={field}
                value={processDraft[field.name]}
                customers={customers}
                employees={employees}
                customerPersonnel={customerPersonnel}
                supportServiceGroups={supportServiceGroups}
                projectItems={availableProjectItems}
                selectedCustomerId={normalizeText(masterDraft.customer_id)}
                disabled={!canEditActiveForm || isSaving || field.name === 'from_user_id' || field.name === 'to_user_id'}
                density="compact"
                onChange={onProcessDraftChange}
              />
            ))}
          </div>
        </section>
      ) : null}

      {isCreateMode ? (
        <section className={`rounded-[28px] border border-slate-200 bg-white shadow-sm ${isFullModalPresentation ? 'p-3.5 sm:p-4' : 'p-4'}`}>
          {renderFileManager()}
        </section>
      ) : null}

      <div className={`rounded-[28px] border border-slate-200 bg-white shadow-sm ${isFullModalPresentation ? 'p-3.5 sm:p-4' : 'p-4'}`}>
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <div className={`${compactSectionIconBoxClass} bg-primary/10 text-primary`}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>tune</span>
            </div>
            <h4 className={compactSectionTitleClass}>Vận hành yêu cầu</h4>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {visibleDetailTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveDetailTab(tab.key)}
                className={`group inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                  activeDetailTab === tab.key
                    ? 'bg-gradient-to-r from-primary to-primary/80 text-white shadow-md shadow-primary/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:shadow-sm'
                }`}
              >
                <span className="material-symbols-outlined text-[17px] transition-transform group-hover:scale-110">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2">{renderActiveTab()}</div>
      </div>

      <CustomerRequestQuickActionModal
        open={showDispatcherActionModal}
        eyebrow="Popup điều phối"
        title="Chọn nhánh xử lý"
        requestCode={processDetail?.yeu_cau?.ma_yc}
        requestSummary={processDetail?.yeu_cau?.tieu_de || processDetail?.yeu_cau?.summary}
        actions={dispatcherQuickActions}
        onClose={() => setShowDispatcherActionModal(false)}
        onSelectAction={(action) => {
          setShowDispatcherActionModal(false);
          onRunDispatcherAction(action);
        }}
      />

      <CustomerRequestQuickActionModal
        open={showPerformerActionModal}
        eyebrow="Popup performer"
        title="Chọn thao tác thực hiện"
        requestCode={processDetail?.yeu_cau?.ma_yc}
        requestSummary={processDetail?.yeu_cau?.tieu_de || processDetail?.yeu_cau?.summary}
        actions={performerQuickActions}
        onClose={() => setShowPerformerActionModal(false)}
        onSelectAction={(action) => {
          setShowPerformerActionModal(false);
          onRunPerformerAction(action);
        }}
      />
    </div>
  );
};
