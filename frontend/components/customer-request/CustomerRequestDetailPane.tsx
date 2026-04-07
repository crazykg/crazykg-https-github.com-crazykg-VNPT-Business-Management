import React, { useEffect, useMemo, useState } from 'react';
import type {
  Attachment,
  YeuCauEstimate,
  YeuCauHoursReport,
  YeuCauProcessDetail,
  YeuCauProcessField,
  YeuCauProcessMeta,
  YeuCauTimelineEntry,
  YeuCauWorklog,
} from '../../types/customerRequest';
import type { Customer, CustomerPersonnel } from '../../types/customer';
import type { Employee } from '../../types/employee';
import type { ProjectItemMaster } from '../../types/project';
import type { SupportServiceGroup } from '../../types/support';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';
import { AttachmentManager } from '../AttachmentManager';
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect';
import { CustomerRequestQuickActionModal } from './CustomerRequestQuickActionModal';
import { ProcessFieldInput } from './CustomerRequestFieldRenderer';
import { CustomerRequestEstimatePanel } from './CustomerRequestEstimatePanel';
import { CustomerRequestHoursPanel } from './CustomerRequestHoursPanel';
import {
  type DispatcherQuickAction,
  type PerformerQuickAction,
  SUPPORT_TASK_STATUS_OPTIONS,
  formatHoursValue,
  humanizeKetQua,
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
  masterFields: YeuCauProcessField[];
  masterDraft: Record<string, unknown>;
  onMasterFieldChange: (fieldName: string, value: unknown) => void;
  editorProcessMeta: YeuCauProcessMeta | null | undefined;
  processDraft: Record<string, unknown>;
  onProcessDraftChange: (fieldName: string, value: unknown) => void;
  onSaveStatusDetail: () => void;
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
  taskReferenceOptions: SearchableSelectOption[];
  onUpdateReferenceTaskRow: (localId: string, value: string) => void;
  onTaskReferenceSearchTermChange: (value: string) => void;
  taskReferenceSearchTerm: string;
  taskReferenceSearchError: string;
  isTaskReferenceSearchLoading: boolean;
  onRemoveReferenceTaskRow: (localId: string) => void;
  formAttachments: Attachment[];
  onUploadAttachment: (file: File) => Promise<void>;
  onDeleteAttachment: (id: string) => Promise<void>;
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
  { key: 'chi_tiet', label: 'Chi tiết', icon: 'article' },
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

export const CustomerRequestDetailPane: React.FC<CustomerRequestDetailPaneProps> = ({
  isDetailLoading,
  isListLoading,
  isCreateMode,
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
  masterFields,
  masterDraft,
  onMasterFieldChange,
  editorProcessMeta,
  processDraft,
  onProcessDraftChange,
  onSaveStatusDetail,
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
  isSubmittingWorklog,
  canOpenEstimateModal,
  onOpenEstimateModal,
  isSubmittingEstimate,
  dispatcherQuickActions,
  onRunDispatcherAction,
  performerQuickActions,
  onRunPerformerAction,
}) => {
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTabKey>('chi_tiet');
  const [showDispatcherActionModal, setShowDispatcherActionModal] = useState(false);
  const [showPerformerActionModal, setShowPerformerActionModal] = useState(false);
  const visibleDetailTabs = useMemo(
    () => (isCreateMode ? DETAIL_TABS.filter((tab) => tab.key === 'tasks') : DETAIL_TABS),
    [isCreateMode]
  );

  useEffect(() => {
    setActiveDetailTab('chi_tiet');
    setShowDispatcherActionModal(false);
    setShowPerformerActionModal(false);
  }, [isCreateMode, processDetail?.yeu_cau?.id]);

  useEffect(() => {
    if (visibleDetailTabs.some((tab) => tab.key === activeDetailTab)) {
      return;
    }
    setActiveDetailTab(visibleDetailTabs[0]?.key ?? 'chi_tiet');
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
  const quickStats = [
    { label: 'Tác vụ/YC', value: formIt360Tasks.length + formReferenceTasks.length },
    { label: 'Tệp', value: formAttachments.length },
    { label: 'Dòng thời gian', value: timeline.length },
    { label: 'Nhật ký', value: caseWorklogs.length },
  ];

  const visibleRelatedSummaryItems = relatedSummaryItems.filter((item) => item.label !== 'Người xử lý');
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

  const renderTaskManager = () => (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-slate-400">deployed_code</span>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Task liên quan</h4>
            <p className="mt-1 text-sm text-slate-500">
              Tái sử dụng task IT360 và task tham chiếu để theo dõi công việc gắn với yêu cầu.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onActiveTaskTabChange('IT360')}
            className={`group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
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
            className={`group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
              activeTaskTab === 'REFERENCE'
                ? 'bg-gradient-to-r from-primary to-primary/80 text-white shadow-md shadow-primary/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:shadow-sm'
            }`}
          >
            <span className="material-symbols-outlined text-base transition-transform group-hover:scale-110">dataset_linked</span>
            Task tham chiếu
          </button>
          {canEditActiveForm && !isCreateMode && onSaveRequest ? (
            <button
              type="button"
              onClick={() => void onSaveRequest()}
              disabled={isSaving}
              className="group inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-primary/90 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-md"
            >
              <span className="material-symbols-outlined text-sm transition-transform group-hover:scale-110">save</span>
              {isSaving ? 'Đang cập nhật…' : 'Cập nhật'}
            </button>
          ) : null}
          {canEditActiveForm ? (
            <>
              <button
                type="button"
                onClick={onSaveStatusDetail}
                disabled={isSaving}
                className="inline-flex items-center rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSaving ? 'Đang cập nhật...' : 'Cập nhật'}
              </button>
              <button
                type="button"
                onClick={onAddTaskRow}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3.5 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                {activeTaskTab === 'IT360' ? 'Thêm Task IT360' : 'Thêm task tham chiếu'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50/80 to-white/80 p-4 shadow-inner">
        {activeTaskTab === 'IT360' ? (
          <div className="space-y-2">
            {formIt360Tasks.map((task, index) => (
              <div
                key={task.local_id}
                className="group grid gap-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-4 shadow-sm transition-shadow hover:shadow-md md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_220px_auto]"
              >
                <div className="space-y-1.5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Task IT360 #{index + 1}</p>
                  <input
                    type="text"
                    value={task.task_code}
                    onChange={(event) => onUpdateIt360TaskRow(task.local_id, 'task_code', event.target.value)}
                    placeholder={`Nhập mã task IT360 #${index + 1}`}
                    disabled={!canEditActiveForm || isSaving}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-4 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50"
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
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-4 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50"
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
                      className="group/btn material-symbols-outlined rounded-xl border border-transparent p-2.5 text-slate-400 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 hover:shadow-sm"
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
                className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_auto]"
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
    <div className="space-y-4">
      <AttachmentManager
        attachments={formAttachments}
        onUpload={onUploadAttachment}
        onDelete={onDeleteAttachment}
        isUploading={isUploadingAttachment}
        disabled={!canEditActiveForm || isSaving}
        helperText={formAttachments.length > 0 ? 'Gắn file đính kèm trực tiếp cho yêu cầu để theo dõi xuyên suốt các bước xử lý.' : undefined}
        emptyStateDescription="Chưa có file đính kèm nào. Kéo thả hoặc Ctrl+V để dán ảnh."
        enableClipboardPaste
        clipboardPasteHint="Click vào khung rồi Ctrl/Cmd+V để dán ảnh chụp."
      />

      {attachmentError ? <p className="text-sm text-rose-600">{attachmentError}</p> : null}
      {!attachmentError && attachmentNotice ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
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
      <div className="space-y-4">
        {timeline.map((entry, index) => {
          const meta = resolveStatusMeta(entry.tien_trinh, entry.decision_reason_label || entry.trang_thai_moi);
          return (
            <div key={String(entry.id ?? index)} className="group flex gap-4 rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/60 p-4 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex flex-col items-center">
                <span className={`mt-1 h-3 w-3 rounded-full ring-2 ring-white ${meta.cls}`} />
                {index < timeline.length - 1 ? <div className="mt-2 w-px flex-1 bg-gradient-to-b from-slate-200 to-slate-100" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${meta.cls}`}>
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
                    entry.thay_doi_luc ? formatDateTimeDdMmYyyy(entry.thay_doi_luc)?.slice(0, 16) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {entry.ly_do ? (
                  <p className="mt-2 rounded-xl border border-slate-100 bg-white/60 px-3 py-2 text-sm text-slate-700">
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
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <CustomerRequestHoursPanel
            request={processDetail.yeu_cau}
            hoursReport={currentHoursReport}
            canAddWorklog={canOpenWorklogModal}
            onAddWorklog={onOpenWorklogModal}
            isActionDisabled={isSaving || isSubmittingWorklog}
          />

          <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-4 shadow-lg shadow-slate-200/50">
            <div className="mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-slate-400">history</span>
              <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Nhật ký công việc gần nhất</h4>
            </div>
            <div className="space-y-3">
              {latestWorklogs.length === 0 ? (
                <EmptyTabState message="Chưa có nhật ký công việc nào cho yêu cầu này." />
              ) : (
                latestWorklogs.map((worklog) => (
                  <div key={worklog.id} className="group rounded-xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/60 px-4 py-3.5 shadow-sm transition-shadow hover:shadow-md">
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
                        worklog.work_date || worklog.work_started_at,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {worklog.work_content ? <p className="mt-2 rounded-lg border border-slate-100 bg-white/60 px-3 py-2 text-sm text-slate-700">{worklog.work_content}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {(currentHoursReport?.by_activity ?? []).length > 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-4 shadow-lg shadow-slate-200/50">
              <div className="mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-slate-400">category</span>
                <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Theo hoạt động</h4>
              </div>
              <div className="space-y-2">
                {(currentHoursReport?.by_activity ?? []).map((activity) => (
                  <div key={activity.activity_type_code || 'unknown'} className="group rounded-xl border border-slate-100 bg-white/80 px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
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
            <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-4 shadow-lg shadow-slate-200/50">
              <div className="mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-slate-400">people</span>
                <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Theo người thực hiện</h4>
              </div>
              <div className="space-y-2">
                {(currentHoursReport?.by_performer ?? []).map((person) => (
                  <div key={`${person.performed_by_user_id ?? 'unknown'}-${person.performed_by_name ?? ''}`} className="group rounded-xl border border-slate-100 bg-white/80 px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
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
    <div className="grid min-w-0 gap-5">
      <div className="space-y-4">
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

        <div className="rounded-2xl border border-slate-200 p-4">
          <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Quyền thao tác hiện tại</h4>
          <div className="mt-4 flex flex-wrap gap-2">
            {actionFlagItems.map((item) => (
              <span
                key={item.key}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  item.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Hoạt động gần đây</h4>
          <div className="mt-4 space-y-3">
            {latestWorklogs.length === 0 ? (
              <EmptyTabState message="Chưa có nhật ký công việc gần đây." />
            ) : (
              latestWorklogs.map((worklog) => (
                <div key={worklog.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{worklog.performed_by_name || 'Chưa xác định'}</p>
                    <span className="text-xs text-slate-500">{formatHoursValue(worklog.hours_spent)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {[worklog.activity_type_code, worklog.work_date || worklog.work_started_at].filter(Boolean).join(' · ')}
                  </p>
                  {worklog.work_content ? <p className="mt-2 text-sm text-slate-700">{worklog.work_content}</p> : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderActiveTab = () => {
    switch (activeDetailTab) {
      case 'chi_tiet':
        return renderDetailOverviewTab();
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
    <div className="min-w-0 space-y-6">
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="self-start rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          {!isCreateMode ? (
            <div className="mb-6 border-b border-slate-100 pb-6">
              <h4 className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Trạng thái xử lý</h4>
              <div className="flex flex-wrap items-center gap-3">
                {(() => {
                  const meta = resolveRequestStatusMeta(processDetail?.yeu_cau ?? {});
                  return (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${meta.cls}`}>
                      ● {meta.label}
                    </span>
                  );
                })()}

                {canTransitionActiveRequest ? (
                  <>
                    {canOpenCreatorFeedbackModal ? (
                      <button
                        type="button"
                        onClick={onOpenCreatorFeedbackModal}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">fact_check</span>
                        Đánh giá KH
                      </button>
                    ) : null}
                    {canOpenNotifyCustomerModal ? (
                      <button
                        type="button"
                        onClick={onOpenNotifyCustomerModal}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-100 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">campaign</span>
                        Báo KH
                      </button>
                    ) : null}
                    <span className="material-symbols-outlined text-[18px] text-slate-300">arrow_forward</span>
                    <select
                      value={transitionStatusCode}
                      onChange={(event) => onTransitionStatusCodeChange(event.target.value)}
                      disabled={isSaving || !canTransitionActiveRequest}
                      className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
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
                    <button
                      type="button"
                      onClick={onOpenTransitionModal}
                      disabled={isSaving || !canTransitionActiveRequest || !transitionStatusCode}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                      {transitionCtaLabel || 'Chuyển trạng thái'}
                    </button>
                  </>
                ) : null}

                {(!canTransitionActiveRequest || transitionOptions.length === 0) && canOpenCreatorFeedbackModal ? (
                  <button
                    type="button"
                    onClick={onOpenCreatorFeedbackModal}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">fact_check</span>
                    Đánh giá KH
                  </button>
                ) : null}
                {((!canTransitionActiveRequest || transitionOptions.length === 0) && canOpenNotifyCustomerModal) ? (
                  <button
                    type="button"
                    onClick={onOpenNotifyCustomerModal}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-100 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">campaign</span>
                    Báo KH
                  </button>
                ) : null}

                {canTransitionActiveRequest && transitionOptions.length === 0 ? (
                  <span className="text-xs font-medium text-slate-400">Không có trạng thái đích hợp lệ từ bước hiện tại.</span>
                ) : null}
              </div>
            </div>
          ) : null}

          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Thông tin yêu cầu</h4>
              {canEditActiveForm && !isCreateMode && onSaveRequest ? (
                <button
                  type="button"
                  onClick={() => void onSaveRequest()}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  {isSaving ? 'Đang cập nhật…' : 'Cập nhật'}
                </button>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {masterFields.map((field) => {
                if (field.type === 'hidden') {
                  return null;
                }

                return (
                  <div
                    key={field.name}
                    className={
                      field.name === 'project_item_id' || field.name === 'summary' || field.name === 'description'
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
                      projectItems={availableProjectItems}
                      selectedCustomerId={selectedCustomerId}
                      disabled={!canEditActiveForm || isSaving}
                      onChange={onMasterFieldChange}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {editorProcessMeta && editorProcessMeta.form_fields.length > 0 ? (
            <div className="mt-6 border-t border-slate-100 pt-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">{editorProcessMeta.process_label}</h4>
                <button
                  type="button"
                  onClick={onSaveStatusDetail}
                  disabled={!canEditActiveForm || isSaving}
                  className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSaving ? 'Đang cập nhật...' : 'Cập nhật'}
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { name: 'received_at', label: 'Ngày bắt đầu', type: 'datetime', required: false },
                  { name: 'completed_at', label: 'Ngày kết thúc', type: 'datetime', required: false },
                  { name: 'extended_at', label: 'Ngày gia hạn', type: 'datetime', required: false },
                  { name: 'progress_percent', label: 'Tiến độ phần trăm', type: 'number', required: false },
                  { name: 'from_user_id', label: 'Người chuyển', type: 'user_select', required: false },
                  { name: 'to_user_id', label: 'Người nhận', type: 'user_select', required: false },
                  { name: 'notes', label: 'Ghi chú', type: 'textarea', required: false },
                ].map((field) => (
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
                    onChange={onProcessDraftChange}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {isCreateMode ? (
            <>
              <div className="mt-6 border-t border-slate-100 pt-6">
                <div className="mb-4">
                  <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Đính kèm nhanh</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    Gắn file ngay khi tạo yêu cầu để PM hoặc performer có đủ ngữ cảnh khi nhận việc.
                  </p>
                </div>
                {renderFileManager()}
              </div>
            </>
          ) : null}
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 p-4">
            <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Người liên quan</h4>
            <div className="mt-4 space-y-3">
              {visibleRelatedSummaryItems.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{item.value || '--'}</p>
                  {item.hint ? <p className="mt-1 text-xs text-slate-500">{item.hint}</p> : null}
                </div>
              ))}
            </div>
          </div>

          {isCreateMode ? (
            <div className="rounded-2xl border border-slate-200 p-4">
              <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Kế hoạch khi tạo</h4>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Ngữ cảnh đã chọn</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedProjectItem?.project_name || selectedCustomerName || 'Chưa chọn khách hàng / dự án'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {[selectedProjectItem?.product_name, selectedProjectItem?.display_name].filter(Boolean).join(' · ') || 'Chọn Khách hàng | Dự án | Sản phẩm để khóa đúng phạm vi.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 p-4">
              <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Quick stats</h4>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {quickStats.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                    <p className="mt-1 text-lg font-black text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-xl shadow-slate-200/50">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-slate-400">tune</span>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Vận hành yêu cầu</h4>
              <p className="mt-1 text-sm text-slate-500">
                Dùng chung dữ liệu tổng hợp để xem nhanh nhật ký công việc, ước lượng, tệp, tác vụ và dòng thời gian của yêu cầu.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {visibleDetailTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveDetailTab(tab.key)}
                className={`group inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  activeDetailTab === tab.key
                    ? 'bg-gradient-to-r from-primary to-primary/80 text-white shadow-md shadow-primary/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:shadow-sm'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] transition-transform group-hover:scale-110">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

      <div className="mt-5">{renderActiveTab()}</div>

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
    </div>
  );
};
