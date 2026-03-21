import React, { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  createYeuCauEstimate,
  createYeuCau,
  deleteYeuCau,
  fetchCustomerRequestProjectItems,
  fetchCustomerRequestReferenceSearch,
  fetchProjectRaciAssignments,
  fetchYeuCauProcessCatalog,
  isRequestCanceledError,
  saveYeuCauProcess,
  storeYeuCauWorklog,
  transitionCustomerRequestCase,
} from '../services/v5Api';
import type {
  Customer,
  CustomerPersonnel,
  CustomerRequestReferenceSearchItem,
  Employee,
  ProjectRaciRow,
  ProjectItemMaster,
  SupportServiceGroup,
  YeuCauProcessCatalog,
  YeuCauProcessMeta,
  YeuCauRelatedUser,
  YeuCauSearchItem,
} from '../types';
import type { SearchableSelectOption } from './SearchableSelect';
import { formatDateTimeDdMmYyyy } from '../utils/dateDisplay';
import { CustomerRequestSearchBox } from './customer-request/CustomerRequestSearchBox';
import {
  buildInitialCreateFlowDraft,
  resolveCreateRequestPlan,
  type CustomerRequestCreateFlowDraft,
} from './customer-request/createFlow';
import {
  CustomerRequestCreatorFeedbackModal,
  type CreatorFeedbackReviewSubmission,
} from './customer-request/CustomerRequestCreatorFeedbackModal';
import { CustomerRequestDashboardCards } from './customer-request/CustomerRequestDashboardCards';
import { CustomerRequestCreatorWorkspace } from './customer-request/CustomerRequestCreatorWorkspace';
import { CustomerRequestDetailPane } from './customer-request/CustomerRequestDetailPane';
import { CustomerRequestDispatcherWorkspace } from './customer-request/CustomerRequestDispatcherWorkspace';
import { CustomerRequestListPane } from './customer-request/CustomerRequestListPane';
import {
  CustomerRequestNotifyCustomerModal,
  type NotifyCustomerSubmission,
} from './customer-request/CustomerRequestNotifyCustomerModal';
import { CustomerRequestPerformerWorkspace } from './customer-request/CustomerRequestPerformerWorkspace';
import { CustomerRequestTransitionModal } from './customer-request/CustomerRequestTransitionModal';
import { useCustomerRequestAttachments } from './customer-request/hooks/useCustomerRequestAttachments';
import { useCustomerRequestCreatorWorkspace } from './customer-request/hooks/useCustomerRequestCreatorWorkspace';
import { useCustomerRequestDashboard } from './customer-request/hooks/useCustomerRequestDashboard';
import { useCustomerRequestDetail } from './customer-request/hooks/useCustomerRequestDetail';
import { useCustomerRequestDispatcherWorkspace } from './customer-request/hooks/useCustomerRequestDispatcherWorkspace';
import { useCustomerRequestList } from './customer-request/hooks/useCustomerRequestList';
import { useCustomerRequestPerformerWorkspace } from './customer-request/hooks/useCustomerRequestPerformerWorkspace';
import { useCustomerRequestSearch } from './customer-request/hooks/useCustomerRequestSearch';
import { useCustomerRequestTransition } from './customer-request/hooks/useCustomerRequestTransition';
import {
  type DraftState,
  buildPayloadFromDraft,
  createEmptyIt360TaskRow,
  createEmptyReferenceTaskRow,
  dedupeIt360TaskRows,
  dedupeReferenceTaskRows,
  findProcessByCode,
  formatCurrentDateTimeForInput,
  normalizeSupportTaskStatus,
  normalizeText,
  toSqlDateTime,
} from './customer-request/helpers';
import {
  type DispatcherQuickAction,
  type PerformerQuickAction,
  humanizeKetQua,
  type CustomerRequestRoleFilter,
  type CustomerRequestTaskSource,
  type It360TaskFormRow,
  type ReferenceTaskFormRow,
} from './customer-request/presentation';
import { buildDispatcherQuickActions, buildPerformerQuickActions } from './customer-request/quickActions';

type YeuCauManagementHubProps = {
  customers: Customer[];
  customerPersonnel?: CustomerPersonnel[];
  projectItems?: ProjectItemMaster[];
  employees: Employee[];
  supportServiceGroups?: SupportServiceGroup[];
  currentUserId?: string | number | null;
  isAdminViewer?: boolean;
  canImportRequests?: boolean;
  canExportRequests?: boolean;
  canReadRequests: boolean;
  canWriteRequests: boolean;
  canDeleteRequests?: boolean;
  onNotify: (type: 'success' | 'error', title: string, message: string) => void;
};

type CustomerRequestViewTab = 'list' | 'form';

const findRoleDisplayName = (people: YeuCauRelatedUser[], role: string): string => {
  return normalizeText(people.find((person) => person.vai_tro === role)?.user_name);
};

const findSingleSupportGroupForCustomer = (
  supportServiceGroups: SupportServiceGroup[],
  customerId: string
): SupportServiceGroup | null => {
  const normalizedCustomerId = normalizeText(customerId);
  if (normalizedCustomerId === '') {
    return null;
  }

  const exactMatches = supportServiceGroups.filter(
    (group) => normalizeText(group.customer_id) === normalizedCustomerId
  );
  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  return null;
};

export const YeuCauManagementHub: React.FC<YeuCauManagementHubProps> = ({
  customers,
  customerPersonnel = [],
  projectItems = [],
  employees,
  supportServiceGroups = [],
  currentUserId,
  isAdminViewer,
  canReadRequests,
  canWriteRequests,
  canDeleteRequests,
  onNotify,
}) => {
  const [catalog, setCatalog] = useState<YeuCauProcessCatalog | null>(null);
  const [activeProcessCode, setActiveProcessCode] = useState<string>('');
  const [selectedRequestId, setSelectedRequestId] = useState<string | number | null>(null);
  const [activeEditorProcessCode, setActiveEditorProcessCode] = useState<string>('');
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<CustomerRequestViewTab>('list');
  const [requestKeyword, setRequestKeyword] = useState('');
  const [requestCustomerFilter, setRequestCustomerFilter] = useState('');
  const [requestSupportGroupFilter, setRequestSupportGroupFilter] = useState('');
  const [requestPriorityFilter, setRequestPriorityFilter] = useState('');
  const [requestRoleFilter, setRequestRoleFilter] = useState<CustomerRequestRoleFilter>('');
  const [requestMissingEstimateFilter, setRequestMissingEstimateFilter] = useState(false);
  const [requestOverEstimateFilter, setRequestOverEstimateFilter] = useState(false);
  const [requestSlaRiskFilter, setRequestSlaRiskFilter] = useState(false);
  const [transitionStatusCode, setTransitionStatusCode] = useState('');
  const [listPage, setListPage] = useState(1);
  const LIST_PAGE_SIZE = 20;
  const [dataVersion, setDataVersion] = useState(0);
  const [showCreatorFeedbackModal, setShowCreatorFeedbackModal] = useState(false);
  const [isCreatorFeedbackSubmitting, setIsCreatorFeedbackSubmitting] = useState(false);
  const [showNotifyCustomerModal, setShowNotifyCustomerModal] = useState(false);
  const [isNotifyCustomerSubmitting, setIsNotifyCustomerSubmitting] = useState(false);
  const [createFlowDraft, setCreateFlowDraft] = useState<CustomerRequestCreateFlowDraft>(
    () => buildInitialCreateFlowDraft(currentUserId)
  );
  const [requestScopedProjectItems, setRequestScopedProjectItems] = useState<ProjectItemMaster[]>([]);
  const [projectRaciRows, setProjectRaciRows] = useState<ProjectRaciRow[]>([]);
  const [activeTaskTab, setActiveTaskTab] = useState<CustomerRequestTaskSource>('IT360');
  const [taskReferenceSearchTerm, setTaskReferenceSearchTerm] = useState('');
  const [taskReferenceSearchResults, setTaskReferenceSearchResults] = useState<CustomerRequestReferenceSearchItem[]>([]);
  const [isTaskReferenceSearchLoading, setIsTaskReferenceSearchLoading] = useState(false);
  const [taskReferenceSearchError, setTaskReferenceSearchError] = useState('');
  const taskReferenceSearchRequestVersionRef = useRef(0);
  const deferredRequestKeyword = useDeferredValue(requestKeyword);

  const availableProjectItems = useMemo(() => {
    const next = new Map<string, ProjectItemMaster>();
    [...projectItems, ...requestScopedProjectItems].forEach((item) => {
      next.set(String(item.id), item);
    });
    return Array.from(next.values());
  }, [projectItems, requestScopedProjectItems]);

  const customerOptions = useMemo<SearchableSelectOption[]>(
    () =>
      customers.map((customer) => ({
        value: String(customer.id),
        label: customer.customer_name,
        searchText: `${customer.customer_name} ${customer.customer_code}`,
      })),
    [customers]
  );

  const customerPersonnelById = useMemo(() => {
    const next = new Map<string, CustomerPersonnel>();
    customerPersonnel.forEach((item) => {
      next.set(String(item.id), item);
    });
    return next;
  }, [customerPersonnel]);

  const supportServiceGroupById = useMemo(() => {
    const next = new Map<string, SupportServiceGroup>();
    supportServiceGroups.forEach((item) => {
      next.set(String(item.id), item);
    });
    return next;
  }, [supportServiceGroups]);

  const projectItemById = useMemo(() => {
    const next = new Map<string, ProjectItemMaster>();
    availableProjectItems.forEach((item) => {
      next.set(String(item.id), item);
    });
    return next;
  }, [availableProjectItems]);

  const employeeById = useMemo(() => {
    const next = new Map<string, Employee>();
    employees.forEach((employee) => {
      next.set(String(employee.id), employee);
    });
    return next;
  }, [employees]);

  const masterFields = catalog?.master_fields ?? [];
  const createInitialProcess = findProcessByCode(catalog, 'new_intake');
  const activeProcessMeta = useMemo(
    () => findProcessByCode(catalog, activeProcessCode),
    [activeProcessCode, catalog]
  );
  const processOptions = useMemo<SearchableSelectOption[]>(
    () =>
      (catalog?.groups ?? []).flatMap((group) =>
        group.processes.map((process) => ({
          value: process.process_code,
          label: process.process_label,
          searchText: `${group.group_label} ${process.process_label} ${process.process_code}`,
        }))
      ),
    [catalog]
  );
  const listFilters = useMemo(
    () => ({
      customer_id: requestCustomerFilter || undefined,
      support_service_group_id: requestSupportGroupFilter || undefined,
      priority: requestPriorityFilter || undefined,
      my_role: requestRoleFilter || undefined,
      missing_estimate: requestMissingEstimateFilter ? 1 : undefined,
      over_estimate: requestOverEstimateFilter ? 1 : undefined,
      sla_risk: requestSlaRiskFilter ? 1 : undefined,
    }),
    [
      requestCustomerFilter,
      requestMissingEstimateFilter,
      requestOverEstimateFilter,
      requestPriorityFilter,
      requestRoleFilter,
      requestSlaRiskFilter,
      requestSupportGroupFilter,
    ]
  );
  const notifyListError = useCallback(
    (message: string) => onNotify('error', 'Không thể tải danh sách yêu cầu', message),
    [onNotify]
  );
  const notifyDetailError = useCallback(
    (message: string) => onNotify('error', 'Không thể tải chi tiết yêu cầu', message),
    [onNotify]
  );
  const notifyDashboardError = useCallback(
    (message: string) => onNotify('error', 'Không thể tải dashboard yêu cầu', message),
    [onNotify]
  );
  const notifyCreatorWorkspaceError = useCallback(
    (message: string) => onNotify('error', 'Không thể tải workspace creator', message),
    [onNotify]
  );
  const notifyPerformerWorkspaceError = useCallback(
    (message: string) => onNotify('error', 'Không thể tải workspace performer', message),
    [onNotify]
  );
  const notifyDispatcherWorkspaceError = useCallback(
    (message: string) => onNotify('error', 'Không thể tải workspace dispatcher', message),
    [onNotify]
  );
  const {
    listRows,
    isListLoading,
    listMeta,
  } = useCustomerRequestList({
    canReadRequests,
    activeProcessCode,
    isCreateMode,
    listPage,
    pageSize: LIST_PAGE_SIZE,
    dataVersion,
    requestKeyword: deferredRequestKeyword,
    filters: listFilters,
    onError: notifyListError,
    onPageOverflow: setListPage,
  });
  const {
    processDetail,
    setProcessDetail,
    people,
    setPeople,
    masterDraft,
    setMasterDraft,
    processDraft,
    setProcessDraft,
    formAttachments,
    setFormAttachments,
    formIt360Tasks,
    setFormIt360Tasks,
    formReferenceTasks,
    setFormReferenceTasks,
    timeline,
    caseWorklogs,
    isDetailLoading,
  } = useCustomerRequestDetail({
    isCreateMode,
    selectedRequestId,
    activeEditorProcessCode,
    dataVersion,
    masterFields,
    createInitialFields: createInitialProcess?.form_fields ?? [],
    onError: notifyDetailError,
  });
  const selectedCustomerId = normalizeText(masterDraft.customer_id);
  const selectedProjectId = useMemo(
    () =>
      normalizeText(
        masterDraft.project_id ||
          processDetail?.yeu_cau?.project_id ||
          projectItemById.get(normalizeText(masterDraft.project_item_id))?.project_id
      ),
    [masterDraft.project_id, masterDraft.project_item_id, processDetail?.yeu_cau?.project_id, projectItemById]
  );
  const selectedProjectItem = useMemo(
    () => projectItemById.get(normalizeText(masterDraft.project_item_id)) ?? null,
    [masterDraft.project_item_id, projectItemById]
  );
  const taskReferenceOptions = useMemo<SearchableSelectOption[]>(() => {
    const next = new Map<string, SearchableSelectOption>();

    formReferenceTasks.forEach((task) => {
      const taskCode = normalizeText(task.task_code);
      if (taskCode === '') {
        return;
      }

      const value = task.id != null ? String(task.id) : taskCode;
      next.set(value, {
        value,
        label: taskCode,
        searchText: taskCode,
      });
    });

    taskReferenceSearchResults.forEach((task) => {
      const taskCode = normalizeText(task.task_code);
      if (taskCode === '') {
        return;
      }

      const value = task.id != null ? String(task.id) : taskCode;
      const label = [task.task_code, task.request_code, task.summary]
        .map((part) => normalizeText(part))
        .filter(Boolean)
        .join(' | ');
      next.set(value, {
        value,
        label: label || taskCode,
        searchText: [task.task_code, task.request_code, task.ticket_code, task.summary, task.status]
          .map((part) => String(part ?? ''))
          .join(' '),
      });
    });

    return Array.from(next.values());
  }, [formReferenceTasks, taskReferenceSearchResults]);
  const taskReferenceLookup = useMemo(() => {
    const next = new Map<string, { id?: string | number | null; task_code: string }>();

    formReferenceTasks.forEach((task) => {
      const taskCode = normalizeText(task.task_code);
      if (taskCode === '') {
        return;
      }

      const value = task.id != null ? String(task.id) : taskCode;
      next.set(value, {
        id: task.id ?? null,
        task_code: taskCode,
      });
    });

    taskReferenceSearchResults.forEach((task) => {
      const taskCode = normalizeText(task.task_code);
      if (taskCode === '') {
        return;
      }

      const value = task.id != null ? String(task.id) : taskCode;
      next.set(value, {
        id: task.id ?? null,
        task_code: taskCode,
      });
    });

    return next;
  }, [formReferenceTasks, taskReferenceSearchResults]);
  const currentHoursReport = processDetail?.hours_report ?? null;
  const estimateHistory = processDetail?.estimates ?? [];
  const bumpDataVersion = () => setDataVersion((current) => current + 1);
  const {
    searchKeyword: moduleSearchKeyword,
    setSearchKeyword: setModuleSearchKeyword,
    searchResults: moduleSearchResults,
    searchError: moduleSearchError,
    isSearchLoading: isModuleSearchLoading,
    isSearchOpen: isModuleSearchOpen,
    setIsSearchOpen: setIsModuleSearchOpen,
  } = useCustomerRequestSearch({ canReadRequests });
  const {
    isDashboardLoading,
    overviewDashboard,
    roleDashboards,
  } = useCustomerRequestDashboard({
    canReadRequests,
    dataVersion,
    onError: notifyDashboardError,
  });
  const {
    isLoading: isCreatorWorkspaceLoading,
    creatorRows,
    reviewRows: creatorReviewRows,
    notifyRows: creatorNotifyRows,
    followUpRows: creatorFollowUpRows,
    closedRows: creatorClosedRows,
  } = useCustomerRequestCreatorWorkspace({
    active: canReadRequests && !isCreateMode && activeViewTab === 'list' && requestRoleFilter === 'creator',
    canReadRequests,
    dataVersion,
    onError: notifyCreatorWorkspaceError,
  });
  const {
    isLoading: isPerformerWorkspaceLoading,
    performerRows,
    timesheet: performerTimesheet,
    pendingRows: performerPendingRows,
    activeRows: performerActiveRows,
  } = useCustomerRequestPerformerWorkspace({
    active: canReadRequests && !isCreateMode && activeViewTab === 'list' && requestRoleFilter === 'performer',
    canReadRequests,
    dataVersion,
    onError: notifyPerformerWorkspaceError,
  });
  const {
    isLoading: isDispatcherWorkspaceLoading,
    dispatcherRows,
    queueRows: dispatcherQueueRows,
    returnedRows: dispatcherReturnedRows,
    feedbackRows: dispatcherFeedbackRows,
    approvalRows: dispatcherApprovalRows,
    activeRows: dispatcherActiveRows,
    teamLoadRows: dispatcherTeamLoadRows,
    pmWatchRows: dispatcherPmWatchRows,
  } = useCustomerRequestDispatcherWorkspace({
    active: canReadRequests && !isCreateMode && activeViewTab === 'list' && requestRoleFilter === 'dispatcher',
    canReadRequests,
    dataVersion,
    onError: notifyDispatcherWorkspaceError,
  });
  const overviewStatusCountMap = useMemo(() => {
    const next = new Map<string, number>();
    (overviewDashboard?.summary?.status_counts ?? []).forEach((item) => {
      next.set(item.status_code, item.count);
    });
    return next;
  }, [overviewDashboard]);

  useEffect(() => {
    if (!canReadRequests) {
      return;
    }

    let cancelled = false;
    setIsCatalogLoading(true);
    void fetchYeuCauProcessCatalog()
      .then((nextCatalog) => {
        if (cancelled) {
          return;
        }
        setCatalog(nextCatalog);
        const firstProcess = nextCatalog.groups[0]?.processes[0]?.process_code ?? 'new_intake';
        setActiveProcessCode((current) => current || firstProcess);
        setActiveEditorProcessCode((current) => current || 'new_intake');
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        onNotify('error', 'Không thể tải tiến trình', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsCatalogLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canReadRequests, dataVersion, onNotify]);

  useEffect(() => {
    if (!canReadRequests) {
      return;
    }

    let cancelled = false;
    void fetchCustomerRequestProjectItems()
      .then((rows) => {
        if (!cancelled) {
          setRequestScopedProjectItems(rows || []);
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        if ((projectItems || []).length === 0) {
          onNotify('error', 'Không thể tải phần mềm triển khai', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canReadRequests, onNotify, projectItems]);

  useEffect(() => {
    if (!canReadRequests) {
      return;
    }

    if (!selectedProjectId) {
      setProjectRaciRows([]);
      return;
    }

    let cancelled = false;
    void fetchProjectRaciAssignments([selectedProjectId])
      .then((rows) => {
        if (!cancelled) {
          setProjectRaciRows(Array.isArray(rows) ? rows : []);
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setProjectRaciRows([]);
        onNotify('error', 'Không thể tải RACI dự án', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
      });

    return () => {
      cancelled = true;
    };
  }, [canReadRequests, onNotify, selectedProjectId]);

  useEffect(() => {
    if (isCreateMode || activeViewTab !== 'list') {
      return;
    }

    if (listRows.length === 0) {
      if (selectedRequestId !== null) {
        setSelectedRequestId(null);
      }
      return;
    }

    const stillExists = listRows.some((row) => String(row.id) === String(selectedRequestId));
    if (!stillExists) {
      const nextSelected = listRows[0];
      startTransition(() => {
        setSelectedRequestId(nextSelected.id);
        setActiveEditorProcessCode(nextSelected.tien_trinh_hien_tai || activeProcessCode);
      });
    }
  }, [activeProcessCode, activeViewTab, isCreateMode, listRows, selectedRequestId]);

  useEffect(() => {
    resetAttachmentFeedback();
    setActiveTaskTab('IT360');
    setTaskReferenceSearchTerm('');
    setTaskReferenceSearchResults([]);
    setTaskReferenceSearchError('');
    setIsTaskReferenceSearchLoading(false);
    taskReferenceSearchRequestVersionRef.current += 1;
  }, [activeEditorProcessCode, isCreateMode, processDetail?.yeu_cau?.id]);

  useEffect(() => {
    setShowCreatorFeedbackModal(false);
    setShowNotifyCustomerModal(false);
  }, [isCreateMode, processDetail?.yeu_cau?.id]);

  useEffect(() => {
    if (activeTaskTab !== 'REFERENCE') {
      return;
    }

    const searchTerm = taskReferenceSearchTerm.trim();
    taskReferenceSearchRequestVersionRef.current += 1;
    const requestVersion = taskReferenceSearchRequestVersionRef.current;

    setIsTaskReferenceSearchLoading(true);
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const items = await fetchCustomerRequestReferenceSearch({
            q: searchTerm,
            exclude_id: isCreateMode ? null : selectedRequestId,
            limit: 20,
          });
          if (taskReferenceSearchRequestVersionRef.current !== requestVersion) {
            return;
          }

          setTaskReferenceSearchResults(Array.isArray(items) ? items : []);
          setTaskReferenceSearchError('');
        } catch (error) {
          if (taskReferenceSearchRequestVersionRef.current !== requestVersion || isRequestCanceledError(error)) {
            return;
          }

          setTaskReferenceSearchResults([]);
          setTaskReferenceSearchError(error instanceof Error ? error.message : 'Không tải được danh sách task tham chiếu.');
        } finally {
          if (taskReferenceSearchRequestVersionRef.current === requestVersion) {
            setIsTaskReferenceSearchLoading(false);
          }
        }
      })();
    }, searchTerm === '' ? 0 : 250);

    return () => {
      window.clearTimeout(handle);
    };
  }, [activeTaskTab, isCreateMode, selectedRequestId, taskReferenceSearchTerm]);

  const editorProcessMeta = isCreateMode
    ? createInitialProcess
    : processDetail?.process ?? findProcessByCode(catalog, activeEditorProcessCode);
  const transitionProcessMeta = useMemo(
    () => findProcessByCode(catalog, transitionStatusCode),
    [catalog, transitionStatusCode]
  );

  const transitionOptions = useMemo(() => {
    if (isCreateMode || !processDetail) {
      return [];
    }

    const currentCode = processDetail.current_process?.process_code || processDetail.yeu_cau?.trang_thai || '';

    const options = (processDetail.allowed_next_processes || [])
      .filter((item): item is YeuCauProcessMeta => Boolean(item))
      .filter((item) => item.process_code !== currentCode)
      .filter((item, index, array) => array.findIndex((candidate) => candidate.process_code === item.process_code) === index);

    return options;
  }, [isCreateMode, processDetail]);
  const transitionRenderableFields = useMemo(
    () =>
      (transitionProcessMeta?.form_fields ?? []).filter(
        (field) => field.type !== 'hidden' && field.name !== 'notes'
      ),
    [transitionProcessMeta]
  );
  const currentStatusCode = processDetail?.current_process?.process_code || processDetail?.yeu_cau?.trang_thai || '';
  const creatorFeedbackRowData = useMemo(
    () => ((processDetail?.process_row?.data ?? {}) as Record<string, unknown>),
    [processDetail?.process_row?.data]
  );

  const canEditActiveForm = canWriteRequests && (isCreateMode || Boolean(processDetail?.can_write));
  const canTransitionActiveRequest =
    canEditActiveForm && !isCreateMode && Boolean(processDetail?.available_actions?.can_transition ?? true);
  const canOpenCreatorFeedbackModal =
    !isCreateMode && canEditActiveForm && currentStatusCode === 'waiting_customer_feedback';
  const canOpenNotifyCustomerModal =
    !isCreateMode
    && canEditActiveForm
    && currentStatusCode === 'completed'
    && transitionOptions.some((item) => item.process_code === 'customer_notified');
  const canDeleteActiveRequest =
    Boolean(canDeleteRequests || isAdminViewer) && !isCreateMode && selectedRequestId !== null && !isSaving && !isDeleting;
  const normalizedCurrentUserId = normalizeText(currentUserId);
  const canCreatorContinueProcessing = transitionOptions.some((item) => item.process_code === 'in_progress');
  const canCreatorRejectRequest = transitionOptions.some((item) => item.process_code === 'not_executed');
  const canCreatorRequestMoreInfo = canOpenCreatorFeedbackModal;
  const dispatcherQuickActions = useMemo<DispatcherQuickAction[]>(
    () =>
      buildDispatcherQuickActions({
        canTransitionActiveRequest,
        isCreateMode,
        transitionOptions,
        currentUserId: normalizedCurrentUserId,
      }),
    [canTransitionActiveRequest, isCreateMode, normalizedCurrentUserId, transitionOptions]
  );
  const performerQuickActions = useMemo<PerformerQuickAction[]>(
    () =>
      buildPerformerQuickActions({
        canTransitionActiveRequest,
        isCreateMode,
        transitionOptions,
        currentUserId: normalizedCurrentUserId,
      }),
    [canTransitionActiveRequest, isCreateMode, normalizedCurrentUserId, transitionOptions]
  );

  const defaultProcessor = useMemo(
    () => projectRaciRows.find((row) => row.raci_role === 'A') ?? null,
    [projectRaciRows]
  );

  const currentUserName = useMemo(() => {
    const user = employeeById.get(normalizeText(currentUserId));
    return normalizeText(user?.full_name || user?.username);
  }, [currentUserId, employeeById]);

  const relatedSummaryItems = useMemo(() => {
    const persistedCreatorName = normalizeText(processDetail?.yeu_cau?.created_by_name || processDetail?.yeu_cau?.nguoi_tao_name);
    const creatorName = isCreateMode ? currentUserName || 'Sẽ ghi theo tài khoản đang đăng nhập' : persistedCreatorName || '--';
    const createdAt = isCreateMode ? 'Ghi khi bấm Lưu' : formatDateTimeDdMmYyyy(processDetail?.yeu_cau?.created_at || null) || '--';
    const dispatcherName =
      normalizeText(processDetail?.yeu_cau?.dispatcher_name || findRoleDisplayName(people, 'nguoi_dieu_phoi')) || '--';
    const performerName =
      normalizeText(processDetail?.yeu_cau?.performer_name || findRoleDisplayName(people, 'nguoi_thuc_hien')) || '--';
    const processorName =
      normalizeText(findRoleDisplayName(people, 'nguoi_xu_ly') || defaultProcessor?.full_name || defaultProcessor?.username) ||
      (selectedProjectId ? 'Chưa có vai trò A trong RACI dự án' : 'Chọn Khách hàng | Dự án | Sản phẩm');

    return [
      { label: 'Người tạo yêu cầu', value: creatorName },
      { label: 'Người điều phối', value: dispatcherName },
      { label: 'Người thực hiện', value: performerName },
      { label: 'Người xử lý mặc định', value: processorName },
      { label: 'Thời gian tạo', value: createdAt },
    ];
  }, [
    currentUserName,
    defaultProcessor,
    isCreateMode,
    people,
    processDetail?.yeu_cau?.created_at,
    processDetail?.yeu_cau?.created_by_name,
    processDetail?.yeu_cau?.dispatcher_name,
    processDetail?.yeu_cau?.nguoi_tao_name,
    processDetail?.yeu_cau?.performer_name,
    selectedProjectId,
  ]);
  const {
    isUploadingAttachment,
    attachmentError,
    attachmentNotice,
    resetAttachmentFeedback,
    handleUploadAttachment,
    handleRemoveAttachment,
  } = useCustomerRequestAttachments({
    canEdit: canEditActiveForm,
    setAttachments: setFormAttachments,
  });
  const {
    showTransitionModal,
    closeTransitionModal,
    openTransitionModal,
    modalHandlerUserId,
    setModalHandlerUserId,
    modalTimeline,
    modalStatusPayload,
    setModalStatusPayload,
    modalIt360Tasks,
    setModalIt360Tasks,
    modalRefTasks,
    setModalRefTasks,
    modalAttachments,
    setModalAttachments,
    modalNotes,
    setModalNotes,
    modalActiveTaskTab,
    setModalActiveTaskTab,
    isTransitioning,
    isModalUploading,
    handleModalUpload,
    handleTransitionConfirm,
    updateModalReferenceTask,
    updateModalIt360Task,
    addModalIt360Task,
    addModalReferenceTask,
  } = useCustomerRequestTransition({
    currentUserId,
    selectedRequestId,
    transitionStatusCode,
    transitionProcessMeta,
    processDetail,
    people,
    defaultProcessor,
    taskReferenceLookup,
    onNotify,
    onTransitionSuccess: (requestId, statusCode) => {
      startTransition(() => {
        setListPage(1);
        setActiveProcessCode(statusCode);
        setActiveEditorProcessCode(statusCode);
        setSelectedRequestId(requestId);
      });
    },
    bumpDataVersion,
  });

  const applyCustomerScopeToDraft = (draft: DraftState, customerId: string): DraftState => {
    const next = { ...draft };
    const normalizedCustomerId = normalizeText(customerId);

    const selectedPersonnel = customerPersonnelById.get(normalizeText(next.customer_personnel_id));
    if (selectedPersonnel && normalizeText(selectedPersonnel.customerId) !== normalizedCustomerId) {
      next.customer_personnel_id = '';
    }

    const selectedSupportGroup = supportServiceGroupById.get(normalizeText(next.support_service_group_id));
    if (selectedSupportGroup) {
      const groupCustomerId = normalizeText(selectedSupportGroup.customer_id);
      if (groupCustomerId && groupCustomerId !== normalizedCustomerId) {
        next.support_service_group_id = '';
      }
    }

    const selectedProjectItem = projectItemById.get(normalizeText(next.project_item_id));
    if (selectedProjectItem) {
      const itemCustomerId = normalizeText(selectedProjectItem.customer_id);
      if (itemCustomerId && itemCustomerId !== normalizedCustomerId) {
        next.project_item_id = '';
        next.project_id = '';
        next.product_id = '';
      }
    }

    if (normalizedCustomerId !== '') {
      const singleSupportGroup = findSingleSupportGroupForCustomer(supportServiceGroups, normalizedCustomerId);
      if (singleSupportGroup) {
        next.support_service_group_id = String(singleSupportGroup.id);
      }
    }

    return next;
  };

  const handleMasterFieldChange = (fieldName: string, value: unknown) => {
    setMasterDraft((current) => {
      const next: DraftState = {
        ...current,
        [fieldName]: value,
      };

      if (fieldName === 'project_item_id') {
        const selectedProjectItem = projectItemById.get(normalizeText(value));
        if (!selectedProjectItem) {
          next.project_id = '';
          next.product_id = '';
          return next;
        }

        next.project_id = selectedProjectItem.project_id != null ? String(selectedProjectItem.project_id) : '';
        next.product_id = selectedProjectItem.product_id != null ? String(selectedProjectItem.product_id) : '';

        const linkedCustomerId = normalizeText(selectedProjectItem.customer_id);
        if (linkedCustomerId) {
          next.customer_id = linkedCustomerId;
          return applyCustomerScopeToDraft(next, linkedCustomerId);
        }

        return next;
      }

      if (fieldName === 'customer_id') {
        const nextCustomerId = normalizeText(value);
        if (!nextCustomerId) {
          next.customer_personnel_id = '';
          next.support_service_group_id = '';
          return applyCustomerScopeToDraft(next, nextCustomerId);
        }

        return applyCustomerScopeToDraft(next, nextCustomerId);
      }

      if (fieldName === 'customer_personnel_id') {
        const selectedPersonnel = customerPersonnelById.get(normalizeText(value));
        const linkedCustomerId = normalizeText(selectedPersonnel?.customerId);
        if (linkedCustomerId) {
          next.customer_id = linkedCustomerId;
          return applyCustomerScopeToDraft(next, linkedCustomerId);
        }
        return next;
      }

      if (fieldName === 'support_service_group_id') {
        const selectedSupportGroup = supportServiceGroupById.get(normalizeText(value));
        const linkedCustomerId = normalizeText(selectedSupportGroup?.customer_id);
        if (linkedCustomerId) {
          next.customer_id = linkedCustomerId;
          return applyCustomerScopeToDraft(next, linkedCustomerId);
        }
        return next;
      }

      return next;
    });
  };

  const addTaskRowByActiveTab = () => {
    if (activeTaskTab === 'REFERENCE') {
      setFormReferenceTasks((current) => [...current, createEmptyReferenceTaskRow()]);
      return;
    }

    setFormIt360Tasks((current) => [...current, createEmptyIt360TaskRow()]);
  };

  const updateIt360TaskRow = (localId: string, fieldName: keyof Omit<It360TaskFormRow, 'local_id'>, value: unknown) => {
    setFormIt360Tasks((current) =>
      current.map((task) =>
        task.local_id === localId
          ? {
              ...task,
              [fieldName]:
                fieldName === 'status'
                  ? normalizeSupportTaskStatus(value)
                  : normalizeText(value),
            }
          : task
      )
    );
  };

  const removeIt360TaskRow = (localId: string) => {
    setFormIt360Tasks((current) => {
      const next = current.filter((task) => task.local_id !== localId);
      return next.length > 0 ? next : [createEmptyIt360TaskRow()];
    });
  };

  const updateReferenceTaskRow = (localId: string, value: string) => {
    const selectedTask = taskReferenceLookup.get(String(value));
    const taskCode = normalizeText(selectedTask?.task_code ?? value);
    const taskId = selectedTask?.id ?? null;

    setFormReferenceTasks((current) =>
      current.map((task) =>
        task.local_id === localId
          ? {
              ...task,
              id: taskId,
              task_code: taskCode,
            }
          : task
      )
    );
  };

  const removeReferenceTaskRow = (localId: string) => {
    setFormReferenceTasks((current) => {
      const next = current.filter((task) => task.local_id !== localId);
      return next.length > 0 ? next : [createEmptyReferenceTaskRow()];
    });
  };

  const buildRefTaskPayload = (): Array<Record<string, unknown>> => {
    const it360Rows = dedupeIt360TaskRows(
      formIt360Tasks
        .map((task, index) =>
          createEmptyIt360TaskRow({
            ...task,
            task_code: normalizeText(task.task_code),
            task_link: normalizeText(task.task_link),
            status: normalizeSupportTaskStatus(task.status),
            id: task.id ?? null,
            local_id: task.local_id || `task-${index}`,
          })
        )
        .filter((task) => normalizeText(task.task_code) !== '')
    );

    const referenceRows = dedupeReferenceTaskRows(
      formReferenceTasks
        .map((task, index) =>
          createEmptyReferenceTaskRow({
            ...task,
            task_code: normalizeText(task.task_code),
            id: task.id ?? null,
            local_id: task.local_id || `reference-${index}`,
          })
        )
        .filter((task) => normalizeText(task.task_code) !== '')
    );

    return [
      ...it360Rows.map((task, index) => ({
        id: task.id ?? undefined,
        task_source: 'IT360',
        task_code: normalizeText(task.task_code) || null,
        task_link: normalizeText(task.task_link) || null,
        task_status: normalizeSupportTaskStatus(task.status),
        sort_order: index,
      })),
      ...referenceRows.map((task, index) => ({
        id: task.id ?? undefined,
        task_source: 'REFERENCE',
        task_code: normalizeText(task.task_code) || null,
        sort_order: it360Rows.length + index,
      })),
    ];
  };

  const openRequestFromSearch = (item: YeuCauSearchItem) => {
    const nextStatusCode = normalizeText(item.current_status_code) || 'new_intake';
    const nextRequestCode = normalizeText(item.request_code);

    setModuleSearchKeyword(nextRequestCode || normalizeText(item.label));
    setIsModuleSearchOpen(false);
    setRequestKeyword(nextRequestCode);
    setRequestCustomerFilter('');
    setRequestSupportGroupFilter('');
    setRequestPriorityFilter('');
    setRequestRoleFilter('');
    setRequestMissingEstimateFilter(false);
    setRequestOverEstimateFilter(false);
    setRequestSlaRiskFilter(false);

    startTransition(() => {
      setIsCreateMode(false);
      setListPage(1);
      setActiveViewTab('form');
      setActiveProcessCode(nextStatusCode);
      setSelectedRequestId(item.id);
      setActiveEditorProcessCode(nextStatusCode);
    });
  };

  const openRequestFromDashboard = (requestId: string | number, statusCode?: string | null) => {
    const nextStatusCode = normalizeText(statusCode) || activeProcessCode || 'new_intake';
    startTransition(() => {
      setIsCreateMode(false);
      setActiveViewTab('form');
      setActiveProcessCode(nextStatusCode);
      setSelectedRequestId(requestId);
      setActiveEditorProcessCode(nextStatusCode);
    });
  };

  const hasListFilters = Boolean(
    requestKeyword.trim()
      || requestCustomerFilter
      || requestSupportGroupFilter
      || requestPriorityFilter
      || requestRoleFilter
      || requestMissingEstimateFilter
      || requestOverEstimateFilter
      || requestSlaRiskFilter
  );

  const handleCreateMode = () => {
    startTransition(() => {
      setActiveViewTab('form');
      setIsCreateMode(true);
      setSelectedRequestId(null);
      setActiveEditorProcessCode('new_intake');
      setCreateFlowDraft(buildInitialCreateFlowDraft(currentUserId));
    });
  };

  const handleDispatcherQuickAction = (action: DispatcherQuickAction) => {
    const nextStatusCode = action.targetStatusCode;
    const nextProcessMeta = findProcessByCode(catalog, nextStatusCode);

    setTransitionStatusCode(nextStatusCode);
    openTransitionModal({
      targetProcessMeta: nextProcessMeta,
      payloadOverrides: action.payloadOverrides,
      handlerUserId: action.id === 'self_handle' && normalizedCurrentUserId !== '' ? normalizedCurrentUserId : undefined,
      notes: action.notePreset,
    });
  };

  const handlePerformerQuickAction = (action: PerformerQuickAction) => {
    if (action.id === 'notify_customer' && canOpenNotifyCustomerModal) {
      setShowNotifyCustomerModal(true);
      return;
    }

    const nextStatusCode = action.targetStatusCode;
    const nextProcessMeta = findProcessByCode(catalog, nextStatusCode);

    setTransitionStatusCode(nextStatusCode);
    openTransitionModal({
      targetProcessMeta: nextProcessMeta,
      payloadOverrides: action.payloadOverrides,
      handlerUserId: normalizedCurrentUserId !== '' ? normalizedCurrentUserId : undefined,
      notes: action.notePreset,
    });
  };

  const handleNotifyCustomerSubmit = async (payload: NotifyCustomerSubmission) => {
    if (!selectedRequestId || !processDetail || currentStatusCode !== 'completed') {
      return;
    }

    setIsNotifyCustomerSubmitting(true);
    try {
      const transitioned = await transitionCustomerRequestCase(selectedRequestId, 'customer_notified', {
        notified_by_user_id: normalizeText(currentUserId) || undefined,
        notified_at: toSqlDateTime(formatCurrentDateTimeForInput()),
        notification_channel: payload.notificationChannel,
        notification_content: payload.notificationContent,
        customer_feedback: payload.customerFeedback || undefined,
        notes: payload.note || undefined,
        attachments: payload.attachments.map((attachment) => ({ id: attachment.id })),
      });

      let worklogWarning = '';
      if (payload.worklog) {
        try {
          await storeYeuCauWorklog(selectedRequestId, {
            work_content: payload.worklog.workContent,
            work_date: payload.worklog.workDate || undefined,
            activity_type_code: payload.worklog.activityTypeCode || undefined,
            hours_spent: payload.worklog.hoursSpent || undefined,
            is_billable: payload.worklog.isBillable,
          });
        } catch (error) {
          worklogWarning = error instanceof Error ? error.message : 'Không thể lưu worklog từ popup báo khách hàng.';
        }
      }

      onNotify(
        'success',
        'Đã báo khách hàng',
        worklogWarning
          ? `Yêu cầu ${transitioned.ma_yc ?? transitioned.request_code ?? ''} đã chuyển sang bước báo khách hàng. Tuy nhiên worklog chưa được lưu: ${worklogWarning}`
          : `Yêu cầu ${transitioned.ma_yc ?? transitioned.request_code ?? ''} đã được ghi nhận báo khách hàng.`
      );

      setShowNotifyCustomerModal(false);
      startTransition(() => {
        setListPage(1);
        setActiveProcessCode(transitioned.tien_trinh_hien_tai || 'customer_notified');
        setActiveEditorProcessCode(transitioned.tien_trinh_hien_tai || 'customer_notified');
        setSelectedRequestId(selectedRequestId);
      });
      bumpDataVersion();
    } catch (error) {
      onNotify('error', 'Không thể báo khách hàng', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
    } finally {
      setIsNotifyCustomerSubmitting(false);
    }
  };

  const handleCreatorFeedbackSubmit = async (payload: CreatorFeedbackReviewSubmission) => {
    if (!selectedRequestId || !processDetail || currentStatusCode !== 'waiting_customer_feedback') {
      return;
    }

    setIsCreatorFeedbackSubmitting(true);
    try {
      let nextStatusCode = currentStatusCode;
      let successMessage = 'Đã cập nhật đánh giá phản hồi khách hàng.';

      if (payload.decision === 'request_more_info') {
        const saved = await saveYeuCauProcess(selectedRequestId, currentStatusCode, {
          updated_by: currentUserId,
          status_payload: {
            feedback_request_content: payload.feedbackRequestContent,
            feedback_requested_at: toSqlDateTime(formatCurrentDateTimeForInput()),
            customer_due_at: toSqlDateTime(payload.customerDueAt),
            customer_feedback_at: '',
            customer_feedback_content: '',
            notes: payload.note || undefined,
          },
        });

        nextStatusCode = saved.tien_trinh_hien_tai || currentStatusCode;
        successMessage = `Yêu cầu ${saved.ma_yc ?? saved.request_code ?? ''} tiếp tục chờ khách hàng bổ sung thông tin.`;
      } else if (payload.decision === 'continue_processing') {
        const performerUserId = normalizeText(
          processDetail.yeu_cau?.performer_user_id
            || people.find((person) => person.vai_tro === 'nguoi_thuc_hien')?.user_id
            || processDetail.yeu_cau?.received_by_user_id
        );

        const transitioned = await transitionCustomerRequestCase(selectedRequestId, 'in_progress', {
          performer_user_id: performerUserId || undefined,
          processing_content: payload.note || undefined,
          notes: payload.note || undefined,
        });

        nextStatusCode = transitioned.tien_trinh_hien_tai || 'in_progress';
        successMessage = `Yêu cầu ${transitioned.ma_yc ?? transitioned.request_code ?? ''} đã chuyển sang bước xử lý.`;
      } else {
        const transitioned = await transitionCustomerRequestCase(selectedRequestId, 'not_executed', {
          decision_reason: payload.rejectReason,
          notes: payload.note || undefined,
        });

        nextStatusCode = transitioned.tien_trinh_hien_tai || 'not_executed';
        successMessage = `Yêu cầu ${transitioned.ma_yc ?? transitioned.request_code ?? ''} đã được chốt không thực hiện.`;
      }

      let worklogWarning = '';
      if (payload.worklog) {
        try {
          await storeYeuCauWorklog(selectedRequestId, {
            work_content: payload.worklog.workContent,
            work_date: payload.worklog.workDate || undefined,
            activity_type_code: payload.worklog.activityTypeCode || undefined,
            hours_spent: payload.worklog.hoursSpent || undefined,
            is_billable: payload.worklog.isBillable,
          });
        } catch (error) {
          worklogWarning = error instanceof Error ? error.message : 'Không thể lưu worklog từ popup đánh giá.';
        }
      }

      onNotify(
        'success',
        'Đã lưu đánh giá KH',
        worklogWarning ? `${successMessage} Tuy nhiên worklog chưa được lưu: ${worklogWarning}` : successMessage
      );

      setShowCreatorFeedbackModal(false);
      startTransition(() => {
        setListPage(1);
        setActiveProcessCode(nextStatusCode);
        setActiveEditorProcessCode(nextStatusCode);
        setSelectedRequestId(selectedRequestId);
      });
      bumpDataVersion();
    } catch (error) {
      onNotify('error', 'Không thể lưu đánh giá KH', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
    } finally {
      setIsCreatorFeedbackSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!canDeleteActiveRequest || selectedRequestId === null) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteYeuCau(selectedRequestId);
      onNotify('success', 'Đã xóa yêu cầu', 'Yêu cầu đã được xóa thành công.');
      startTransition(() => {
        setSelectedRequestId(null);
        setProcessDetail(null);
        setPeople([]);
        setMasterDraft({});
        setProcessDraft({});
        setListPage(1);
      });
      bumpDataVersion();
    } catch (error) {
      onNotify('error', 'Không thể xóa yêu cầu', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!editorProcessMeta) {
      onNotify('error', 'Chưa xác định tiến trình', 'Vui lòng chọn một tiến trình hợp lệ để lưu.');
      return;
    }

    const createRequestPlan = isCreateMode
      ? resolveCreateRequestPlan(createFlowDraft, { actorUserId: currentUserId })
      : null;

    if (createRequestPlan && createRequestPlan.validationErrors.length > 0) {
      onNotify('error', 'Chưa thể tạo yêu cầu', createRequestPlan.validationErrors.join(' '));
      return;
    }

    setIsSaving(true);
    try {
      if (isCreateMode && createRequestPlan) {
        const created = await createYeuCau({
          ...buildPayloadFromDraft(masterFields, masterDraft),
          ...createRequestPlan.masterOverrides,
          created_by: currentUserId,
          nguoi_tao_id: currentUserId,
          status_payload: buildPayloadFromDraft(editorProcessMeta.form_fields, processDraft),
          attachments: formAttachments,
          ref_tasks: buildRefTaskPayload(),
        });

        let finalRequest = created;
        const warnings: string[] = [];

        if (createRequestPlan.estimatePayload) {
          try {
            const estimateResult = await createYeuCauEstimate(created.id, createRequestPlan.estimatePayload);
            finalRequest = estimateResult.request_case ?? finalRequest;
          } catch (error) {
            warnings.push(`Estimate ban đầu chưa được lưu: ${error instanceof Error ? error.message : 'Đã xảy ra lỗi.'}`);
          }
        }

        if (createRequestPlan.transitionPlan) {
          try {
            finalRequest = await transitionCustomerRequestCase(
              created.id,
              createRequestPlan.transitionPlan.toStatusCode,
              createRequestPlan.transitionPlan.statusPayload
            );
          } catch (error) {
            warnings.push(`Nhánh tự xử lý chưa được kích hoạt: ${error instanceof Error ? error.message : 'Đã xảy ra lỗi.'}`);
          }
        }

        const finalStatusCode =
          normalizeText(finalRequest.tien_trinh_hien_tai || finalRequest.current_status_code)
          || normalizeText(created.tien_trinh_hien_tai || created.current_status_code)
          || 'new_intake';
        const baseMessage =
          createFlowDraft.handlingMode === 'self_handle'
            ? `Yêu cầu ${finalRequest.ma_yc} đã được tạo và đưa sang luồng xử lý.`
            : `Yêu cầu ${finalRequest.ma_yc} đã được tạo và chuyển vào hàng chờ điều phối.`;
        onNotify(
          'success',
          warnings.length > 0 ? 'Đã tạo yêu cầu, nhưng còn lưu ý' : 'Đã tạo yêu cầu',
          warnings.length > 0 ? `${baseMessage} ${warnings.join(' ')}` : baseMessage
        );
        setCreateFlowDraft(buildInitialCreateFlowDraft(currentUserId));
        setIsCreateMode(false);
        startTransition(() => {
          setListPage(1);
          setActiveProcessCode(finalStatusCode);
          setSelectedRequestId(finalRequest.id);
          setActiveEditorProcessCode(finalStatusCode);
        });
      } else if (selectedRequestId !== null) {
        const saved = await saveYeuCauProcess(selectedRequestId, editorProcessMeta.process_code, {
          ...buildPayloadFromDraft(masterFields, masterDraft),
          updated_by: currentUserId,
          status_payload: buildPayloadFromDraft(editorProcessMeta.form_fields, processDraft),
          attachments: formAttachments,
          ref_tasks: buildRefTaskPayload(),
        });

        const nextProcessCode = saved.tien_trinh_hien_tai || editorProcessMeta.process_code;
        onNotify(
          'success',
          'Đã lưu yêu cầu',
          editorProcessMeta.process_code === processDetail?.current_process?.process_code
            ? `Yêu cầu ${saved.ma_yc} đã được cập nhật.`
            : `Yêu cầu ${saved.ma_yc} đã chuyển sang ${findProcessByCode(catalog, nextProcessCode)?.process_label || nextProcessCode}.`
        );

        startTransition(() => {
          setListPage(1);
          setActiveProcessCode(nextProcessCode);
          setSelectedRequestId(saved.id);
          setActiveEditorProcessCode(nextProcessCode);
        });
      }
      bumpDataVersion();
    } catch (error) {
      onNotify('error', 'Không thể lưu yêu cầu', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
    } finally {
      setIsSaving(false);
    }
  };

  // Sync transitionStatusCode → chỉ giữ trạng thái đích hợp lệ, không cho trùng trạng thái hiện tại.
  useEffect(() => {
    if (isCreateMode) {
      setTransitionStatusCode('');
      return;
    }

    const validCodes = transitionOptions.map((option) => option.process_code);
    setTransitionStatusCode((prev) => {
      const isValid = prev !== '' && validCodes.includes(prev);
      if (isValid) return prev;
      return validCodes[0] ?? '';
    });
  }, [isCreateMode, processDetail?.yeu_cau?.id, transitionOptions]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

      // F1 → Lưu / Cập nhật
      if (event.key === 'F1') {
        event.preventDefault();
        if (!canEditActiveForm || !editorProcessMeta || isSaving || isDeleting) return;
        void handleSave();
        return;
      }

      if (!ctrlOrCmd) return;

      // Ctrl/Cmd + N → Tạo yêu cầu mới
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        if (!canWriteRequests || isSaving) return;
        handleCreateMode();
        return;
      }

      // Ctrl/Cmd + U → Cập nhật yêu cầu
      if (event.key === 'u' || event.key === 'U') {
        event.preventDefault();
        if (!canEditActiveForm || !editorProcessMeta || isSaving || isDeleting) return;
        void handleSave();
        return;
      }

      // Ctrl/Cmd + D → Xóa yêu cầu
      if (event.key === 'd' || event.key === 'D') {
        event.preventDefault();
        if (!canDeleteActiveRequest || isDeleting || isSaving) return;
        void handleDelete();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canWriteRequests, canEditActiveForm, canDeleteActiveRequest, editorProcessMeta, handleSave, handleCreateMode, handleDelete, isDeleting, isSaving]);

  if (!canReadRequests) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Quản lý yêu cầu khách hàng</h2>
        <p className="mt-3 text-sm text-slate-500">Bạn chưa có quyền xem module này.</p>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-5">
      <div className="sticky top-0 z-30 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-3xl font-black tracking-tight text-slate-900">Quản lý yêu cầu khách hàng</h2>

          <div className="flex flex-wrap items-center gap-3">
            <CustomerRequestSearchBox
              value={moduleSearchKeyword}
              onChange={setModuleSearchKeyword}
              results={moduleSearchResults}
              error={moduleSearchError}
              loading={isModuleSearchLoading}
              open={isModuleSearchOpen}
              onOpenChange={setIsModuleSearchOpen}
              onSelect={openRequestFromSearch}
            />

            {/* Nút ← Danh sách — chỉ hiện khi đang ở form hoặc tạo mới */}
            {(activeViewTab === 'form' || isCreateMode) && (
              <button
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setCreateFlowDraft(buildInitialCreateFlowDraft(currentUserId));
                    setIsCreateMode(false);
                    setActiveViewTab('list');
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Danh sách
              </button>
            )}

            {/* Nút Xóa — chỉ hiện khi đang xem form chi tiết (không phải tạo mới) */}
            {activeViewTab === 'form' && !isCreateMode && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canDeleteActiveRequest || isDeleting || isSaving}
                title="Xóa yêu cầu (Ctrl+D / ⌘D)"
                className="inline-flex items-center gap-2 rounded-2xl border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">{isDeleting ? 'progress_activity' : 'delete'}</span>
                Xóa yêu cầu
              </button>
            )}

            {/* Nút Cập nhật / Lưu — chỉ hiện khi đang xem form */}
            {(activeViewTab === 'form' || isCreateMode) && (
              <button
                type="button"
                onClick={handleSave}
                disabled={!canEditActiveForm || !editorProcessMeta || isSaving || isDeleting}
                title={isCreateMode ? 'Lưu (F1)' : 'Cập nhật yêu cầu (Ctrl+U / ⌘U)'}
                className="inline-flex items-center gap-2 rounded-2xl border border-primary bg-white px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">{isSaving ? 'progress_activity' : 'save'}</span>
                {isCreateMode
                  ? 'Lưu (F1)'
                  : editorProcessMeta?.process_code !== processDetail?.current_process?.process_code
                  ? `Chuyển sang ${editorProcessMeta?.process_label || 'tiến trình mới'}`
                  : 'Cập nhật yêu cầu'}
              </button>
            )}

            {/* Nút Tạo mới — luôn hiển thị */}
            <button
              type="button"
              onClick={handleCreateMode}
              disabled={!canWriteRequests || isSaving || isCatalogLoading}
              title="Tạo yêu cầu mới (Ctrl+N / ⌘N)"
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isCatalogLoading ? 'progress_activity' : 'add_circle'}
              </span>
              Tạo yêu cầu mới
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              {(isCreateMode || activeViewTab === 'form') && (
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  {isCreateMode ? 'Tạo mới' : 'Nhập yêu cầu'}
                </p>
              )}
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                {isCreateMode
                  ? 'Yêu cầu mới'
                  : activeViewTab === 'list'
                  ? 'Danh sách yêu cầu'
                  : processDetail?.yeu_cau?.tieu_de || 'Chọn một yêu cầu để thao tác'}
              </h3>
              {!isCreateMode && activeViewTab === 'list' && activeProcessMeta ? (
                <p className="mt-2 text-sm text-slate-500">
                  Tiến trình đang xem: <span className="font-semibold text-slate-700">{activeProcessMeta.process_label}</span>
                </p>
              ) : null}
              {!isCreateMode && activeViewTab === 'form' && processDetail ? (
                <p className="mt-2 text-sm text-slate-500">
                  Tiến trình hiện tại: <span className="font-semibold text-slate-700">{processDetail.current_process?.process_label || '--'}</span>
                  {' · '}
                  Kết quả: <span className="font-semibold text-slate-700">{humanizeKetQua(processDetail.yeu_cau.ket_qua)}</span>
                </p>
              ) : null}
            </div>
          </div>

          {activeViewTab === 'list' && !isCreateMode ? (
            <div className="space-y-4">
              <CustomerRequestDashboardCards
                activeRoleFilter={requestRoleFilter}
                onRoleFilterChange={(role) => {
                  setRequestRoleFilter(role);
                  setListPage(1);
                }}
                overviewDashboard={overviewDashboard}
                roleDashboards={roleDashboards}
                isDashboardLoading={isDashboardLoading}
                activeProcessCode={activeProcessCode}
                onProcessCodeChange={(statusCode) => {
                  setActiveProcessCode(statusCode);
                  setListPage(1);
                }}
                getStatusCount={(statusCode) => overviewStatusCountMap.get(statusCode) ?? findProcessByCode(catalog, statusCode)?.active_count ?? 0}
                onSelectAttentionCase={openRequestFromDashboard}
              />

              {requestRoleFilter === 'creator' ? (
                <CustomerRequestCreatorWorkspace
                  loading={isCreatorWorkspaceLoading}
                  creatorName={currentUserName}
                  totalRows={creatorRows.length}
                  reviewRows={creatorReviewRows}
                  notifyRows={creatorNotifyRows}
                  followUpRows={creatorFollowUpRows}
                  closedRows={creatorClosedRows}
                  dashboard={roleDashboards.creator}
                  onOpenRequest={openRequestFromDashboard}
                  onCreateRequest={handleCreateMode}
                />
              ) : null}

              {requestRoleFilter === 'performer' ? (
                <CustomerRequestPerformerWorkspace
                  loading={isPerformerWorkspaceLoading}
                  performerName={currentUserName}
                  totalRows={performerRows.length}
                  pendingRows={performerPendingRows}
                  activeRows={performerActiveRows}
                  timesheet={performerTimesheet}
                  onOpenRequest={openRequestFromDashboard}
                />
              ) : null}

              {requestRoleFilter === 'dispatcher' ? (
                <CustomerRequestDispatcherWorkspace
                  loading={isDispatcherWorkspaceLoading}
                  dispatcherName={currentUserName}
                  totalRows={dispatcherRows.length}
                  queueRows={dispatcherQueueRows}
                  returnedRows={dispatcherReturnedRows}
                  feedbackRows={dispatcherFeedbackRows}
                  approvalRows={dispatcherApprovalRows}
                  activeRows={dispatcherActiveRows}
                  teamLoadRows={dispatcherTeamLoadRows}
                  pmWatchRows={dispatcherPmWatchRows}
                  dashboard={roleDashboards.dispatcher}
                  onOpenRequest={openRequestFromDashboard}
                />
              ) : null}

              <CustomerRequestListPane
                activeProcessCode={activeProcessCode}
                processOptions={processOptions}
                onProcessCodeChange={(value) => {
                  const nextProcessCode = normalizeText(value);
                  if (nextProcessCode === '' || nextProcessCode === activeProcessCode) {
                    return;
                  }
                  setActiveProcessCode(nextProcessCode);
                  setListPage(1);
                }}
                requestKeyword={requestKeyword}
                onRequestKeywordChange={(value) => {
                  setRequestKeyword(value);
                  setListPage(1);
                }}
                requestCustomerFilter={requestCustomerFilter}
                onRequestCustomerFilterChange={(value) => {
                  setRequestCustomerFilter(value);
                  setListPage(1);
                }}
                requestSupportGroupFilter={requestSupportGroupFilter}
                onRequestSupportGroupFilterChange={(value) => {
                  setRequestSupportGroupFilter(value);
                  setListPage(1);
                }}
                requestPriorityFilter={requestPriorityFilter}
                onRequestPriorityFilterChange={(value) => {
                  setRequestPriorityFilter(value);
                  setListPage(1);
                }}
                customerOptions={customerOptions}
                supportServiceGroups={supportServiceGroups}
                requestMissingEstimateFilter={requestMissingEstimateFilter}
                onToggleMissingEstimate={() => {
                  setRequestMissingEstimateFilter((current) => !current);
                  setListPage(1);
                }}
                requestOverEstimateFilter={requestOverEstimateFilter}
                onToggleOverEstimate={() => {
                  setRequestOverEstimateFilter((current) => !current);
                  setListPage(1);
                }}
                requestSlaRiskFilter={requestSlaRiskFilter}
                onToggleSlaRisk={() => {
                  setRequestSlaRiskFilter((current) => !current);
                  setListPage(1);
                }}
                alertCounts={
                  overviewDashboard?.summary.alert_counts ?? {
                    missing_estimate: 0,
                    over_estimate: 0,
                    sla_risk: 0,
                  }
                }
                isDashboardLoading={isDashboardLoading}
                rows={listRows}
                isListLoading={isListLoading}
                selectedRequestId={selectedRequestId}
                onSelectRow={(row) => openRequestFromDashboard(row.id, row.tien_trinh_hien_tai || activeProcessCode)}
                listPage={listPage}
                listMeta={listMeta}
                onListPageChange={setListPage}
                hasListFilters={hasListFilters}
                onClearFilters={() => {
                  setRequestKeyword('');
                  setRequestCustomerFilter('');
                  setRequestSupportGroupFilter('');
                  setRequestPriorityFilter('');
                  setRequestRoleFilter('');
                  setRequestMissingEstimateFilter(false);
                  setRequestOverEstimateFilter(false);
                  setRequestSlaRiskFilter(false);
                  setListPage(1);
                }}
                requestRoleFilter={requestRoleFilter}
              />
            </div>
          ) : null}

          {activeViewTab === 'form' ? (
            <CustomerRequestDetailPane
              isDetailLoading={isDetailLoading}
              isListLoading={isListLoading}
              isCreateMode={isCreateMode}
              processDetail={processDetail}
              canTransitionActiveRequest={canTransitionActiveRequest}
              transitionOptions={transitionOptions}
              transitionStatusCode={transitionStatusCode}
              onTransitionStatusCodeChange={(value) => {
                const chosen = normalizeText(value);
                if (chosen !== (processDetail?.yeu_cau?.trang_thai ?? '')) {
                  setTransitionStatusCode(chosen);
                }
              }}
              onOpenTransitionModal={openTransitionModal}
              isSaving={isSaving}
              canEditActiveForm={canEditActiveForm}
              masterFields={masterFields}
              masterDraft={masterDraft}
              onMasterFieldChange={handleMasterFieldChange}
              editorProcessMeta={editorProcessMeta}
              processDraft={processDraft}
              onProcessDraftChange={(fieldName, value) =>
                setProcessDraft((current) => ({
                  ...current,
                  [fieldName]: value,
                }))
              }
              customers={customers}
              employees={employees}
              customerPersonnel={customerPersonnel}
              supportServiceGroups={supportServiceGroups}
              availableProjectItems={availableProjectItems}
              selectedProjectItem={selectedProjectItem}
              selectedCustomerId={selectedCustomerId}
              currentUserName={currentUserName}
              createFlowDraft={createFlowDraft}
              onCreateFlowDraftChange={(patch) => setCreateFlowDraft((current) => ({ ...current, ...patch }))}
              activeTaskTab={activeTaskTab}
              onActiveTaskTabChange={setActiveTaskTab}
              onAddTaskRow={addTaskRowByActiveTab}
              formIt360Tasks={formIt360Tasks}
              onUpdateIt360TaskRow={updateIt360TaskRow}
              onRemoveIt360TaskRow={removeIt360TaskRow}
              formReferenceTasks={formReferenceTasks}
              taskReferenceOptions={taskReferenceOptions}
              onUpdateReferenceTaskRow={updateReferenceTaskRow}
              onTaskReferenceSearchTermChange={setTaskReferenceSearchTerm}
              taskReferenceSearchTerm={taskReferenceSearchTerm}
              taskReferenceSearchError={taskReferenceSearchError}
              isTaskReferenceSearchLoading={isTaskReferenceSearchLoading}
              onRemoveReferenceTaskRow={removeReferenceTaskRow}
              formAttachments={formAttachments}
              onUploadAttachment={handleUploadAttachment}
              onDeleteAttachment={handleRemoveAttachment}
              isUploadingAttachment={isUploadingAttachment}
              attachmentError={attachmentError}
              attachmentNotice={attachmentNotice}
              relatedSummaryItems={relatedSummaryItems}
              currentHoursReport={currentHoursReport}
              estimateHistory={estimateHistory}
              timeline={timeline}
              caseWorklogs={caseWorklogs}
              canOpenCreatorFeedbackModal={canOpenCreatorFeedbackModal}
              onOpenCreatorFeedbackModal={() => setShowCreatorFeedbackModal(true)}
              canOpenNotifyCustomerModal={canOpenNotifyCustomerModal}
              onOpenNotifyCustomerModal={() => setShowNotifyCustomerModal(true)}
              dispatcherQuickActions={dispatcherQuickActions}
              onRunDispatcherAction={handleDispatcherQuickAction}
              performerQuickActions={performerQuickActions}
              onRunPerformerAction={handlePerformerQuickAction}
            />
          ) : null}
        </section>
      </div>
    </div>

    <CustomerRequestTransitionModal
      show={showTransitionModal}
      processDetail={processDetail}
      transitionStatusCode={transitionStatusCode}
      transitionRenderableFields={transitionRenderableFields}
      modalStatusPayload={modalStatusPayload}
      onModalStatusPayloadChange={(fieldName, value) =>
        setModalStatusPayload((current) => ({
          ...current,
          [fieldName]: value,
        }))
      }
      modalIt360Tasks={modalIt360Tasks}
      onAddModalIt360Task={addModalIt360Task}
      onUpdateModalIt360Task={updateModalIt360Task}
      onRemoveModalIt360Task={(localId) =>
        setModalIt360Tasks((current) => current.filter((task) => task.local_id !== localId))
      }
      modalRefTasks={modalRefTasks}
      onAddModalReferenceTask={addModalReferenceTask}
      onUpdateModalReferenceTask={updateModalReferenceTask}
      onRemoveModalReferenceTask={(localId) =>
        setModalRefTasks((current) => current.filter((task) => task.local_id !== localId))
      }
      modalAttachments={modalAttachments}
      onUploadModalAttachment={handleModalUpload}
      onDeleteModalAttachment={(id) =>
        setModalAttachments((current) => current.filter((attachment) => String(attachment.id) !== String(id)))
      }
      isModalUploading={isModalUploading}
      modalNotes={modalNotes}
      onModalNotesChange={setModalNotes}
      modalActiveTaskTab={modalActiveTaskTab}
      onModalActiveTaskTabChange={setModalActiveTaskTab}
      isTransitioning={isTransitioning}
      onClose={closeTransitionModal}
      onConfirm={() => void handleTransitionConfirm()}
      modalTimeline={modalTimeline}
      modalHandlerUserId={modalHandlerUserId}
      onModalHandlerUserIdChange={setModalHandlerUserId}
      projectRaciRows={projectRaciRows}
      employees={employees}
      customers={customers}
      customerPersonnel={customerPersonnel}
      supportServiceGroups={supportServiceGroups}
      projectItems={availableProjectItems}
      selectedCustomerId={normalizeText(masterDraft.customer_id)}
      taskReferenceOptions={taskReferenceOptions}
      taskReferenceSearchError={taskReferenceSearchError}
      taskReferenceSearchTerm={taskReferenceSearchTerm}
      onTaskReferenceSearchTermChange={setTaskReferenceSearchTerm}
      isTaskReferenceSearchLoading={isTaskReferenceSearchLoading}
    />

    <CustomerRequestCreatorFeedbackModal
      open={showCreatorFeedbackModal}
      isSubmitting={isCreatorFeedbackSubmitting}
      requestCode={processDetail?.yeu_cau?.ma_yc ?? processDetail?.yeu_cau?.request_code}
      requestSummary={processDetail?.yeu_cau?.tieu_de || processDetail?.yeu_cau?.summary}
      lastFeedbackRequestContent={String(creatorFeedbackRowData.feedback_request_content ?? '')}
      lastFeedbackRequestedAt={String(creatorFeedbackRowData.feedback_requested_at ?? '')}
      customerDueAt={String(creatorFeedbackRowData.customer_due_at ?? '')}
      customerFeedbackAt={String(creatorFeedbackRowData.customer_feedback_at ?? '')}
      customerFeedbackContent={String(creatorFeedbackRowData.customer_feedback_content ?? '')}
      canContinueProcessing={canCreatorContinueProcessing}
      canRequestMoreInfo={canCreatorRequestMoreInfo}
      canRejectRequest={canCreatorRejectRequest}
      onClose={() => {
        if (!isCreatorFeedbackSubmitting) {
          setShowCreatorFeedbackModal(false);
        }
      }}
      onSubmit={(payload) => void handleCreatorFeedbackSubmit(payload)}
    />

    <CustomerRequestNotifyCustomerModal
      open={showNotifyCustomerModal}
      isSubmitting={isNotifyCustomerSubmitting}
      requestCode={processDetail?.yeu_cau?.ma_yc ?? processDetail?.yeu_cau?.request_code}
      requestSummary={processDetail?.yeu_cau?.tieu_de || processDetail?.yeu_cau?.summary}
      customerName={processDetail?.yeu_cau?.khach_hang_name || processDetail?.yeu_cau?.customer_name}
      requesterName={
        processDetail?.yeu_cau?.customer_personnel_name
          || processDetail?.yeu_cau?.requester_name
          || processDetail?.yeu_cau?.nguoi_trao_doi_name
      }
      completedAt={String(creatorFeedbackRowData.completed_at ?? processDetail?.yeu_cau?.hoan_thanh_luc ?? '')}
      resultContent={String(creatorFeedbackRowData.result_content ?? '')}
      hoursReport={currentHoursReport}
      onClose={() => {
        if (!isNotifyCustomerSubmitting) {
          setShowNotifyCustomerModal(false);
        }
      }}
      onSubmit={(payload) => void handleNotifyCustomerSubmit(payload)}
    />

    </>
  );
};
