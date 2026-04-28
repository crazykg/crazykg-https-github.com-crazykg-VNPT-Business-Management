import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { AttachmentManager, type AttachmentManagerHandle } from '../AttachmentManager';
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect';
import { CustomerRequestQuickActionModal } from './CustomerRequestQuickActionModal';
import { InlineRemoveConfirmButton } from './InlineRemoveConfirmButton';
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
import {
  customerRequestDensePrimaryButtonClass,
  customerRequestDenseSecondaryButtonClass,
  customerRequestDenseSelectClass,
  customerRequestFieldClass,
  customerRequestNestedSurfaceClass,
  customerRequestSelectTriggerClass,
  customerRequestSurfaceClass,
} from './uiClasses';

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

const resolveWorklogAssigneeName = (worklog: YeuCauWorklog): string | null => (
  normalizeText(worklog.assigned_user_name)
  || normalizeText(worklog.to_user_id_name)
  || null
);

const buildWorklogPerformerLabel = (worklog: YeuCauWorklog): string => {
  const performerName = normalizeText(worklog.performed_by_name);
  const performerCode = normalizeText(worklog.performed_by_code);

  if (performerName && performerCode) {
    return `${performerName} · ${performerCode}`;
  }

  return performerName || performerCode || 'Chưa xác định';
};

const buildTimelinePersonLabel = (
  code: string | null | undefined,
  name: string | null | undefined
): string | null => {
  const personCode = normalizeText(code);
  const personName = normalizeText(name);

  if (personCode && personName) {
    return `${personCode} - ${personName}`;
  }

  return personCode || personName || null;
};

const lowerFirstTimelineLabel = (label: string | null | undefined): string | null => {
  const value = normalizeText(label);
  if (!value) {
    return null;
  }

  return value.charAt(0).toLocaleLowerCase('vi-VN') + value.slice(1);
};

const shouldShowTimelineAssignee = (entry: YeuCauTimelineEntry): boolean => {
  const statusCode = normalizeText(entry.status_code || entry.tien_trinh).toLowerCase();

  return statusCode !== 'new_intake'
    && Boolean(normalizeText(entry.nguoi_xu_ly_code) || normalizeText(entry.nguoi_xu_ly_name));
};

const buildTimelineSentence = (entry: YeuCauTimelineEntry, fallbackStatusLabel: string): string => {
  const actorLabel = buildTimelinePersonLabel(entry.nguoi_thay_doi_code, entry.nguoi_thay_doi_name) || 'Chưa xác định';
  const actionLabel = lowerFirstTimelineLabel(entry.trang_thai_moi || fallbackStatusLabel || entry.tien_trinh) || 'cập nhật';
  const assigneeLabel = shouldShowTimelineAssignee(entry)
    ? buildTimelinePersonLabel(entry.nguoi_xu_ly_code, entry.nguoi_xu_ly_name)
    : null;
  const timeSource = normalizeText(entry.created_at)
    || normalizeText(entry.thay_doi_luc)
    || normalizeText(entry.entered_at);
  const timeLabel = timeSource ? formatDateTimeDdMmYyyy(timeSource)?.slice(0, 16) : null;

  return [
    actorLabel,
    actionLabel,
    assigneeLabel,
    timeLabel,
  ]
    .filter(Boolean)
    .join(' ');
};

const resolveCurrentRequestAssigneeName = (request: YeuCauProcessDetail['yeu_cau'] | null | undefined): string | null => {
  const source = request as Record<string, unknown> | null | undefined;

  return (
    normalizeText(source?.receiver_name)
    || normalizeText(source?.nguoi_xu_ly_name)
    || normalizeText(source?.current_owner_name)
    || normalizeText(source?.performer_name)
    || normalizeText(source?.dispatcher_name)
    || null
  );
};

const shouldUseCurrentRequestStatusForWorklog = (
  worklog: YeuCauWorklog,
  request: YeuCauProcessDetail['yeu_cau'] | null | undefined
): boolean => {
  const currentStatusName = normalizeText(request?.current_status_name_vi);
  if (!normalizeText(worklog.detail_status_action) || !currentStatusName) {
    return false;
  }

  const worklogStatusCode = normalizeText(worklog.status_code).toLowerCase();
  const worklogStatusName = normalizeText(worklog.status_name_vi).toLowerCase();

  return currentStatusName.toLowerCase() !== 'tiếp nhận'
    && (worklogStatusCode === 'new_intake' || worklogStatusName === 'tiếp nhận');
};

const buildWorklogStatusSummary = (
  worklog: YeuCauWorklog,
  request?: YeuCauProcessDetail['yeu_cau'] | null
): string | null => {
  const useCurrentRequestStatus = shouldUseCurrentRequestStatusForWorklog(worklog, request);
  const mainStatusLabel = useCurrentRequestStatus
    ? normalizeText(request?.current_status_name_vi) || resolveWorklogMainStatusLabel(worklog)
    : resolveWorklogMainStatusLabel(worklog);
  const assigneeName = resolveWorklogAssigneeName(worklog)
    || (useCurrentRequestStatus ? resolveCurrentRequestAssigneeName(request) : null);

  if (!mainStatusLabel) {
    return assigneeName ? `Người nhận: ${assigneeName}` : null;
  }

  return assigneeName ? `${mainStatusLabel} - ${assigneeName}` : mainStatusLabel;
};

const resolveWorklogTimeLabel = (worklog: YeuCauWorklog): string | null => {
  const value = normalizeText(worklog.work_started_at)
    || normalizeText(worklog.created_at)
    || normalizeText(worklog.work_ended_at)
    || normalizeText(worklog.updated_at)
    || normalizeText(worklog.work_date);

  if (!value) {
    return null;
  }

  return /\d{1,2}:\d{2}/.test(value)
    ? formatDateTimeDdMmYyyy(value)
    : formatDateDdMmYyyy(value);
};

const resolveDifficultyStatusLabel = (difficultyStatus: string | null | undefined): string | null => {
  const normalized = normalizeText(difficultyStatus).toLowerCase();
  if (!normalized || normalized === 'none') {
    return null;
  }
  if (normalized === 'has_issue') {
    return 'Có';
  }
  if (normalized === 'resolved') {
    return 'Đã giải quyết';
  }
  return normalized;
};

const buildDifficultySummaryLine = (worklog: YeuCauWorklog, difficultyStatusLabel: string | null): string | null => {
  const parts: string[] = [];

  const difficultyNote = normalizeText(worklog.difficulty_note);
  const proposalNote = normalizeText(worklog.proposal_note);

  if (difficultyNote) {
    parts.push(`Khó khăn: ${difficultyNote}`);
  }
  if (proposalNote) {
    parts.push(`Đề xuất: ${proposalNote}`);
  }
  if (difficultyStatusLabel) {
    parts.push(`Trạng thái xử lý khó khăn: ${difficultyStatusLabel}`);
  }

  return parts.length > 0 ? parts.join(' - ') : null;
};

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
  const attachmentManagerRef = useRef<AttachmentManagerHandle | null>(null);
  const isFullModalPresentation = presentation === 'full_modal';
  const isFullModalUpdateLayout = isFullModalPresentation && !isCreateMode;
  const visibleDetailTabs = useMemo(
    () => {
      if (isCreateMode) {
        return DETAIL_TABS.filter((tab) => tab.key === 'tasks');
      }

      if (isFullModalUpdateLayout) {
        return DETAIL_TABS.filter((tab) => tab.key !== 'files' && tab.key !== 'tasks');
      }

      return DETAIL_TABS;
    },
    [isCreateMode, isFullModalUpdateLayout]
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
  const hoursByActivity = currentHoursReport?.by_activity ?? [];
  const hoursByPerformer = currentHoursReport?.by_performer ?? [];
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
  const formRailClassName = isFullModalPresentation ? 'w-full' : 'w-full';
  const operationRailClassName = isFullModalPresentation ? 'w-full' : 'w-full';
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

  const compactSectionCardClass = `${customerRequestSurfaceClass} p-3 sm:p-3.5`;
  const compactSectionTitleClass = 'text-xs font-bold uppercase tracking-[0.12em] text-slate-500';
  const compactSectionIconBoxClass =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--ui-control-radius)]';
  const compactSectionHeaderClass = 'mb-2 flex items-center gap-2 border-b border-slate-100 pb-2';
  const denseTabButtonBaseClass =
    'group inline-flex h-8 items-center gap-1.5 rounded-[var(--ui-control-radius)] px-3 text-[13px] font-semibold leading-5 transition';
  const taskSectionTitleClass = 'text-sm font-semibold leading-5 text-[color:var(--ui-text-default)]';
  const taskHeaderClass = 'mb-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3';
  const taskSegmentedControlClass =
    'inline-flex items-center rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] p-1';
  const taskActionGroupClass = 'ml-auto flex flex-wrap items-center gap-2';
  const taskListScrollClass = 'max-h-[min(280px,40dvh)] overflow-y-auto pr-1 custom-scrollbar';
  const railTaskListScrollClass = 'max-h-[min(240px,36dvh)] overflow-y-auto pr-1 custom-scrollbar';
  const attachmentListScrollClass = 'max-h-[min(260px,38dvh)] custom-scrollbar';
  const railAttachmentListScrollClass = 'max-h-[min(220px,34dvh)] custom-scrollbar';
  const worklogListScrollClass = 'max-h-[min(280px,40dvh)] overflow-y-auto pr-1 custom-scrollbar';
  const itemCardClass =
    'rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-bg)]';

  const renderTaskManager = (layout: 'tab' | 'rail' = 'tab') => {
    const isRailLayout = layout === 'rail';

    return (
      <section
        className={isRailLayout
          ? compactSectionCardClass
          : 'space-y-4'}
      >
        <div className={taskHeaderClass}>
          <div className="flex min-w-0 items-center gap-2 pr-2">
            <div className={`${compactSectionIconBoxClass} bg-sky-50 text-sky-700`}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>deployed_code</span>
            </div>
            <h4 className={taskSectionTitleClass}>Task liên quan</h4>
          </div>

          <div className={taskSegmentedControlClass}>
          <button
            type="button"
            onClick={() => onActiveTaskTabChange('IT360')}
            className={`${denseTabButtonBaseClass} ${
              activeTaskTab === 'IT360'
                ? 'bg-primary text-white shadow-[var(--ui-shadow-shell)]'
                : 'bg-transparent text-slate-600 hover:bg-white'
            }`}
          >
            IT360
            {formIt360Tasks.length > 0 ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeTaskTab === 'IT360' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {formIt360Tasks.length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => onActiveTaskTabChange('REFERENCE')}
            className={`${denseTabButtonBaseClass} ${
              activeTaskTab === 'REFERENCE'
                ? 'bg-primary text-white shadow-[var(--ui-shadow-shell)]'
                : 'bg-transparent text-slate-600 hover:bg-white'
            }`}
          >
            Ref
            {formReferenceTasks.length > 0 ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeTaskTab === 'REFERENCE' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {formReferenceTasks.length}
              </span>
            ) : null}
          </button>
          </div>

          {canEditActiveForm ? (
            <div className={taskActionGroupClass}>
              {onSaveTaskReference ? (
                <button
                  type="button"
                  onClick={onSaveTaskReference}
                  disabled={isSaving}
                  className={customerRequestDenseSecondaryButtonClass}
                >
                  <span className="material-symbols-outlined text-[15px]">save</span>
                  {isSaving ? 'Đang lưu...' : 'Lưu'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onAddTaskRow}
                disabled={isSaving}
                className={customerRequestDensePrimaryButtonClass}
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                Thêm
              </button>
            </div>
          ) : null}
        </div>

        <div className={`${customerRequestNestedSurfaceClass} ${isRailLayout ? 'mt-0 p-2.5' : 'p-3'}`}>
        {activeTaskTab === 'IT360' ? (
          <div className={`space-y-2 ${isRailLayout ? railTaskListScrollClass : taskListScrollClass}`}>
            {formIt360Tasks.length === 0 ? (
              <div className="rounded-[var(--ui-control-radius)] border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface-bg)] px-3 py-4 text-center text-xs text-slate-400">
                Chưa có IT360 nào. Bấm Thêm để gắn task.
              </div>
            ) : (
              formIt360Tasks.map((task, index) => (
                <div
                  key={task.local_id}
                  className={`group ${itemCardClass} p-3 ${isRailLayout ? '' : ''}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">IT360 #{index + 1}</p>
                    {canEditActiveForm ? (
                      <InlineRemoveConfirmButton
                        triggerLabel={`Bỏ IT360 #${index + 1}`}
                        confirmTitle="Bỏ IT360 này?"
                        confirmDescription="Dòng IT360 này sẽ bị gỡ khỏi yêu cầu hiện tại. Task gốc không bị xoá."
                        confirmActionLabel="Bỏ IT360"
                        disabled={!canEditActiveForm || isSaving}
                        onConfirm={() => onRemoveIt360TaskRow(task.local_id)}
                      />
                    ) : null}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
                    <input
                      type="text"
                      value={task.task_code}
                      onChange={(event) => onUpdateIt360TaskRow(task.local_id, 'task_code', event.target.value)}
                      placeholder={`Mã IT360 #${index + 1}`}
                      disabled={!canEditActiveForm || isSaving}
                      className={customerRequestFieldClass}
                    />
                    <SearchableSelect
                      value={task.status}
                      options={SUPPORT_TASK_STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
                      onChange={(value) => onUpdateIt360TaskRow(task.local_id, 'status', value)}
                      disabled={!canEditActiveForm || isSaving}
                      compact
                      triggerClassName={customerRequestSelectTriggerClass}
                    />
                  </div>

                  <div className="mt-2">
                    <input
                      type="text"
                      value={task.task_link}
                      onChange={(event) => onUpdateIt360TaskRow(task.local_id, 'task_link', event.target.value)}
                      placeholder="Link task"
                      disabled={!canEditActiveForm || isSaving}
                      className={customerRequestFieldClass}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className={`space-y-2 ${isRailLayout ? railTaskListScrollClass : taskListScrollClass}`}>
            {formReferenceTasks.length === 0 ? (
              <div className="rounded-[var(--ui-control-radius)] border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface-bg)] px-3 py-4 text-center text-xs text-slate-400">
                Chưa có Ref nào. Bấm Thêm để gắn liên kết.
              </div>
            ) : (
              formReferenceTasks.map((task, index) => (
                <div
                  key={task.local_id}
                  className={`${itemCardClass} p-3`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Ref #{index + 1}</p>
                    {canEditActiveForm ? (
                      <InlineRemoveConfirmButton
                        triggerLabel={`Bỏ Ref #${index + 1}`}
                        confirmTitle="Bỏ Ref này?"
                        confirmDescription="Liên kết này sẽ bị gỡ khỏi yêu cầu hiện tại. Yêu cầu gốc không bị xoá."
                        confirmActionLabel="Bỏ Ref"
                        disabled={!canEditActiveForm || isSaving}
                        onConfirm={() => onRemoveReferenceTaskRow(task.local_id)}
                      />
                    ) : null}
                  </div>

                  <SearchableSelect
                    value={task.task_code}
                    options={taskReferenceOptions}
                    onChange={(value) => onUpdateReferenceTaskRow(task.local_id, value)}
                    onSearchTermChange={onTaskReferenceSearchTermChange}
                    placeholder={`Chọn task/YC tham chiếu #${index + 1}`}
                    searchPlaceholder="Tìm theo mã task hoặc mã yêu cầu..."
                    noOptionsText={
                      taskReferenceSearchError ||
                      (taskReferenceSearchTerm.trim() === ''
                        ? 'Nhập mã task hoặc mã yêu cầu để lọc thêm.'
                        : 'Không tìm thấy task tham chiếu')
                    }
                    searching={isTaskReferenceSearchLoading}
                    disabled={!canEditActiveForm || isSaving}
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
      </section>
    );
  };

  const renderFileManager = (layout: 'tab' | 'rail' = 'tab') => {
    const isRailLayout = layout === 'rail';

    return (
      <section
        className={isRailLayout
          ? compactSectionCardClass
          : 'space-y-3'}
      >
        <div className={isRailLayout ? `${compactSectionHeaderClass} items-start justify-between` : 'flex flex-col gap-2 border-b border-slate-100 pb-2 sm:flex-row sm:items-start sm:justify-between'}>
          <div className="flex min-w-0 items-start gap-2">
            <div className={`${compactSectionIconBoxClass} bg-amber-50 text-amber-700`}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>attach_file</span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className={compactSectionTitleClass}>Tệp đính kèm</h4>
                {formAttachments.length > 0 ? (
                  <span className="inline-flex h-6 items-center rounded-full bg-[var(--ui-surface-subtle)] px-2 text-xs font-semibold text-[color:var(--ui-text-muted)]">
                    {formAttachments.length} file
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs leading-5 text-[color:var(--ui-text-muted)]">Ctrl/Cmd+V để dán ảnh chụp.</p>
            </div>
          </div>
          {canEditActiveForm ? (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => attachmentManagerRef.current?.openFilePicker()}
                disabled={isUploadingAttachment || isSaving}
                className={customerRequestDenseSecondaryButtonClass}
              >
                <span className="material-symbols-outlined text-[15px]">upload</span>
                Tải file
              </button>
              {onSaveAttachmentsOnly ? (
                <button
                  type="button"
                  onClick={() => void onSaveAttachmentsOnly()}
                  disabled={isSaving}
                  className={customerRequestDensePrimaryButtonClass}
                >
                  <span className="material-symbols-outlined text-[15px]">save</span>
                  {isSaving ? 'Đang cập nhật…' : 'Lưu'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className={isRailLayout ? 'mt-2' : ''}>
          <AttachmentManager
            ref={attachmentManagerRef}
            attachments={formAttachments}
            onUpload={onUploadAttachment}
            onDelete={onDeleteAttachment}
            isUploading={isUploadingAttachment}
            disabled={!canEditActiveForm || isSaving}
            emptyStateDescription="Chưa có file đính kèm nào. Kéo thả hoặc Ctrl+V để dán ảnh."
            enableClipboardPaste
            clipboardPasteHint="Click vào khung rồi Ctrl/Cmd+V để dán ảnh chụp."
            showClipboardPasteHint={false}
            compact
            showListTitle={false}
            showSummaryMeta={false}
            showUploadButton={false}
            listVariant="compact-row"
            listMaxHeightClassName={isRailLayout ? railAttachmentListScrollClass : attachmentListScrollClass}
          />
        </div>

        {attachmentError ? <p className="text-sm text-rose-600">{attachmentError}</p> : null}
        {!attachmentError && attachmentNotice ? (
          <div className="rounded-[var(--ui-control-radius)] border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
            {attachmentNotice}
          </div>
        ) : null}
      </section>
    );
  };

  const renderTimelineContent = () => {
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
          const timelineSentence = buildTimelineSentence(entry, meta.label);
          return (
            <div
              key={String(entry.id ?? index)}
              className={`group flex gap-3 p-3.5 ${isFullModalPresentation ? `${customerRequestSurfaceClass}` : 'rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/60 shadow-sm transition-shadow hover:shadow-md'}`}
            >
              <div className="flex flex-col items-center">
                <span className={`mt-1 h-3 w-3 rounded-full ring-2 ring-white ${meta.cls}`} />
                {index < timeline.length - 1 ? <div className="mt-2 w-px flex-1 bg-gradient-to-b from-slate-200 to-slate-100" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-6 text-slate-800">
                  {timelineSentence}
                </p>
                {entry.ly_do ? (
                  <p className={`mt-2 px-2.5 py-1.5 text-sm text-slate-700 ${isFullModalPresentation ? `${customerRequestNestedSurfaceClass} rounded-[var(--ui-control-radius)]` : 'rounded-xl border border-slate-100 bg-white/60'}`}>
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

  const renderTimelineTab = () => renderTimelineContent();

  const renderRecentWorklogList = (worklogs: YeuCauWorklog[]) => {
    if (worklogs.length === 0) {
      return <EmptyTabState message="Chưa có nhật ký công việc gần đây." />;
    }

    return (
      <div className="space-y-2.5">
        {worklogs.map((worklog) => {
          const statusSummary = buildWorklogStatusSummary(worklog, processDetail?.yeu_cau);
          const detailStatusLabel = resolveWorklogDetailStatusLabel(worklog.detail_status_action);
          const timeLabel = resolveWorklogTimeLabel(worklog);
          const difficultyStatusLabel = resolveDifficultyStatusLabel(worklog.difficulty_status);
          const difficultySummaryLine = buildDifficultySummaryLine(worklog, difficultyStatusLabel);
          const performerLabel = buildWorklogPerformerLabel(worklog);

          return (
            <button
              key={worklog.id}
              type="button"
              onClick={() => onEditWorklog(worklog)}
              disabled={isSaving || isSubmittingWorklog}
              className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-left transition hover:bg-slate-100 disabled:opacity-50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{performerLabel}</p>
                <span className="text-xs text-slate-500">{formatHoursValue(worklog.hours_spent)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {[
                  worklog.activity_type_code,
                  statusSummary ? `Trạng thái: ${statusSummary}` : null,
                  detailStatusLabel ? `Chi tiết: ${detailStatusLabel}` : null,
                  timeLabel,
                ].filter(Boolean).join(' · ')}
              </p>
              {worklog.work_content ? <p className="mt-2 text-sm text-slate-700">{worklog.work_content}</p> : null}
              {difficultySummaryLine ? (
                <p className="mt-2 rounded-lg border border-amber-100 bg-amber-50/60 px-2.5 py-1.5 text-sm font-medium text-amber-700">
                  {difficultySummaryLine}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  };
  const renderHoursTab = () => {
    if (isCreateMode || !processDetail) {
      return <EmptyTabState message="Giờ công sẽ hiển thị sau khi yêu cầu được lưu và bắt đầu phát sinh nhật ký công việc." />;
    }

    const isCompactHoursTab = isFullModalPresentation;
    const hoursPanelNode = (
      <CustomerRequestHoursPanel
        request={processDetail.yeu_cau}
        hoursReport={currentHoursReport}
        canAddWorklog={canOpenWorklogModal}
        onAddWorklog={onOpenWorklogModal}
        isActionDisabled={isSaving || isSubmittingWorklog}
        compact={isCompactHoursTab}
      />
    );

    return (
      <div className={`grid min-w-0 ${isCompactHoursTab ? 'gap-3' : 'gap-4'} lg:grid-cols-[minmax(0,1fr)_336px]`}>
        <div className={isCompactHoursTab ? 'space-y-2.5' : 'space-y-3'}>
          <div className={`${isCompactHoursTab ? `${customerRequestSurfaceClass} p-3` : 'rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-3.5 shadow-md shadow-slate-200/40'}`}>
            <div className={`flex flex-wrap items-center justify-between gap-2 ${isCompactHoursTab ? 'mb-2.5' : 'mb-3'}`}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-slate-400">history</span>
                <h4 className={`${isCompactHoursTab ? 'text-xs tracking-[0.14em]' : 'text-sm tracking-[0.18em]'} font-bold uppercase text-slate-500`}>Nhật ký công việc</h4>
              </div>
              {caseWorklogs.length > 0 ? (
                <span className="inline-flex h-6 items-center rounded-full bg-[var(--ui-surface-subtle)] px-2 text-xs font-semibold text-[color:var(--ui-text-muted)]">
                  {caseWorklogs.length} dòng
                </span>
              ) : null}
            </div>
            <div className={latestWorklogs.length > 0 ? worklogListScrollClass : ''}>
              {renderRecentWorklogList(latestWorklogs)}
            </div>
          </div>
        </div>

        <div className={isCompactHoursTab ? 'space-y-2.5' : 'space-y-3'}>
          {hoursPanelNode}

          {!isCompactHoursTab && hoursByActivity.length > 0 ? (
            <div className={`${isCompactHoursTab ? `${customerRequestSurfaceClass} p-3.5` : 'rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-3.5 shadow-md shadow-slate-200/40'}`}>
              <div className="mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-slate-400">category</span>
                <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Theo hoạt động</h4>
              </div>
              <div className="space-y-2">
                {hoursByActivity.map((activity) => (
                  <div key={activity.activity_type_code || 'unknown'} className={`${isCompactHoursTab ? `${customerRequestNestedSurfaceClass}` : 'group rounded-xl border border-slate-100 bg-white/80 shadow-sm transition-shadow hover:shadow-md'} px-3 py-2.5`}>
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

          {!isCompactHoursTab && hoursByPerformer.length > 0 ? (
            <div className={`${isCompactHoursTab ? `${customerRequestSurfaceClass} p-3.5` : 'rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-3.5 shadow-md shadow-slate-200/40'}`}>
              <div className="mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-slate-400">people</span>
                <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Theo người thực hiện</h4>
              </div>
              <div className="space-y-2">
                {hoursByPerformer.map((person) => (
                  <div key={`${person.performed_by_user_id ?? 'unknown'}-${person.performed_by_name ?? ''}`} className={`${isCompactHoursTab ? `${customerRequestNestedSurfaceClass}` : 'group rounded-xl border border-slate-100 bg-white/80 shadow-sm transition-shadow hover:shadow-md'} px-3 py-2.5`}>
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
          <div className="mt-3">
            {renderRecentWorklogList(latestWorklogs)}
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

const renderStatusSection = () => (
    <section className={compactSectionCardClass}>
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
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {canOpenWorklogModal ? (
            <>
              <button
                type="button"
                onClick={() => onOpenDetailStatusWorklogModal('in_progress')}
                disabled={isSaving || isSubmittingWorklog}
                className={`${customerRequestDenseSecondaryButtonClass} ${
                  isDetailInProgress
                    ? 'border-blue-200 bg-blue-600 text-white hover:bg-blue-700'
                    : ''
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">play_circle</span>
                Đang thực hiện
              </button>
              <button
                type="button"
                onClick={() => onOpenDetailStatusWorklogModal('paused')}
                disabled={isSaving || isSubmittingWorklog}
                className={`${customerRequestDenseSecondaryButtonClass} ${
                  isDetailPaused
                    ? 'border-blue-200 bg-blue-600 text-white hover:bg-blue-700'
                    : ''
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
                  className={customerRequestDensePrimaryButtonClass}
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
                  className={customerRequestDenseSelectClass}
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
  );

const renderInfoSection = () => (
    <section className={compactSectionCardClass}>
      <div className={compactSectionHeaderClass}>
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
                  ? 'min-w-0 lg:col-span-2'
                  : 'min-w-0'
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
  );

const renderTagSection = () => (
    <section className={compactSectionCardClass}>
      <div className={compactSectionHeaderClass}>
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
  );

  const renderProcessDetailSection = () => {
    if (shouldHideInitialIntakeSection || !editorProcessMeta || editorProcessMeta.form_fields.length === 0) {
      return null;
    }

    return (
      <section className={compactSectionCardClass}>
        <div className={compactSectionHeaderClass}>
          <div className={`${compactSectionIconBoxClass} bg-sky-50 text-sky-700`}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>flowchart</span>
          </div>
          <h4 className={compactSectionTitleClass}>{editorProcessMeta.process_label}</h4>
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
            <div key={field.name} className="min-w-0">
              <ProcessFieldInput
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
            </div>
          ))}
        </div>
      </section>
    );
  };

const renderOperationSection = () => (
    <div className={compactSectionCardClass}>
      <div className="mb-2 flex flex-col gap-2 border-b border-slate-100 pb-2 lg:flex-row lg:items-center lg:justify-between">
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
              className={`${denseTabButtonBaseClass} ${
                activeDetailTab === tab.key
                  ? 'bg-primary text-white shadow-[var(--ui-shadow-shell)]'
                  : 'border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] text-slate-600 hover:bg-slate-100'
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
  );

  if (isFullModalUpdateLayout) {
    return (
      <div className="space-y-4">
        <div className="w-full">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
            <div className="min-w-0 space-y-3">
              {renderStatusSection()}
              {renderInfoSection()}
              {renderProcessDetailSection()}
            </div>

            <aside className="min-w-0 space-y-3 xl:sticky xl:top-0 xl:self-start">
              {renderTagSection()}
              {renderTaskManager('rail')}
              {renderFileManager('rail')}
            </aside>
          </div>
        </div>

        <div className="w-full">
          {renderOperationSection()}
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
  }

  return (
    <div className={`min-w-0 ${isFullModalPresentation ? 'space-y-3' : 'space-y-5'}`}>
      {showSummaryBar ? (
        <div className={formRailClassName}>
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
        </div>
      ) : null}

      {!isCreateMode ? (
        <div className={formRailClassName}>
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
        </div>
      ) : null}

      <div className={formRailClassName}>
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
                      ? 'min-w-0 lg:col-span-2'
                      : 'min-w-0'
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
      </div>

      <div className={formRailClassName}>
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
      </div>

      {!shouldHideInitialIntakeSection && editorProcessMeta && editorProcessMeta.form_fields.length > 0 ? (
        <div className={formRailClassName}>
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
                <div key={field.name} className="min-w-0">
                  <ProcessFieldInput
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
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {isCreateMode ? (
        <div className={formRailClassName}>
          <section className={`rounded-[28px] border border-slate-200 bg-white shadow-sm ${isFullModalPresentation ? 'p-3.5 sm:p-4' : 'p-4'}`}>
            {renderFileManager()}
          </section>
        </div>
      ) : null}

      <div className={operationRailClassName}>
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
