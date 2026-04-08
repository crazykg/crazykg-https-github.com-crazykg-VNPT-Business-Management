import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createYeuCau,
  createYeuCauEstimate,
  deleteYeuCau,
  saveYeuCauCaseTags,
  saveYeuCauProcess,
  fetchCustomerRequestProjectItems,
  fetchProjectRaciAssignments,
  fetchYeuCau,
  fetchYeuCauProcessCatalog,
  isRequestCanceledError,
  storeYeuCauWorklog,
  uploadDocumentAttachment,
} from '../services/v5Api';
import type {
  Attachment,
  Customer,
  CustomerPersonnel,
  Employee,
  ProjectItemMaster,
  ProjectRaciRow,
  SupportServiceGroup,
  Tag,
  YeuCau,
  YeuCauEstimate,
  YeuCauHoursReport,
  YeuCauProcessCatalog,
  YeuCauProcessField,
  YeuCauProcessMeta,
  YeuCauRelatedUser,
} from '../types';
import { useCustomerRequestList } from './customer-request/hooks/useCustomerRequestList';
import { useCustomerRequestDashboard } from './customer-request/hooks/useCustomerRequestDashboard';
import { useCustomerRequestDetail } from './customer-request/hooks/useCustomerRequestDetail';
import { useCustomerRequestCreatorWorkspace } from './customer-request/hooks/useCustomerRequestCreatorWorkspace';
import { useCustomerRequestDispatcherWorkspace } from './customer-request/hooks/useCustomerRequestDispatcherWorkspace';
import { useCustomerRequestOptimisticState } from './customer-request/hooks/useCustomerRequestOptimisticState';
import { useCustomerRequestPerformerWorkspace } from './customer-request/hooks/useCustomerRequestPerformerWorkspace';
import { useCustomerRequestTransition } from './customer-request/hooks/useCustomerRequestTransition';
import { useCustomerRequestSearch } from './customer-request/hooks/useCustomerRequestSearch';
import { useCustomerRequestResponsiveLayout } from './customer-request/hooks/useCustomerRequestResponsiveLayout';
import { useWorkflowDefinitions } from './customer-request/hooks/useWorkflowDefinitions';
import { CustomerRequestListPane } from './customer-request/CustomerRequestListPane';
import { CustomerRequestDetailPane } from './customer-request/CustomerRequestDetailPane';
import { CustomerRequestCreatorWorkspace } from './customer-request/CustomerRequestCreatorWorkspace';
import { CustomerRequestDispatcherWorkspace } from './customer-request/CustomerRequestDispatcherWorkspace';
import { CustomerRequestPerformerWorkspace } from './customer-request/CustomerRequestPerformerWorkspace';
import { CustomerRequestOverviewWorkspace } from './customer-request/CustomerRequestOverviewWorkspace';
import { CustomerRequestWorkspaceTabs } from './customer-request/CustomerRequestWorkspaceTabs';
import type { WorkspaceTabKey } from './customer-request/CustomerRequestWorkspaceTabs';
import { CustomerRequestSurfaceSwitch, type CustomerRequestSurfaceKey } from './customer-request/CustomerRequestSurfaceSwitch';
import { CustomerRequestDashboardCards } from './customer-request/CustomerRequestDashboardCards';
import { CustomerRequestQuickAccessBar } from './customer-request/CustomerRequestQuickAccessBar';
import { CustomerRequestDetailFrame } from './customer-request/CustomerRequestDetailFrame';
import { CustomerRequestTransitionModal } from './customer-request/CustomerRequestTransitionModal';
import { CustomerRequestCreateModal } from './customer-request/CustomerRequestCreateModal';
import {
  CustomerRequestEstimateModal,
  type CustomerRequestEstimateSubmission,
} from './customer-request/CustomerRequestEstimateModal';
import type { CustomerRequestCreateFlowDraft } from './customer-request/createFlow';
import {
  CustomerRequestWorklogModal,
  type CustomerRequestWorklogSubmission,
} from './customer-request/CustomerRequestWorklogModal';
import {
  buildInitialCreateFlowDraft,
  resolveCreateRequestPlan,
} from './customer-request/createFlow';
import type {
  CustomerRequestPrimaryActionMeta,
  CustomerRequestRoleFilter,
  CustomerRequestTaskSource,
  DispatcherQuickAction,
  It360TaskFormRow,
  PerformerQuickAction,
  ReferenceTaskFormRow,
} from './customer-request/presentation';
import {
  filterXmlVisibleProcesses,
  isXmlVisibleProcessCode,
  resolveRequestProcessCode,
  resolveTransitionOptionsForRequest,
} from './customer-request/presentation';
import {
  applyHoursReportToRequest,
  buildOptimisticEstimateHoursReport,
  prependUniqueEstimate,
  prependUniqueWorklog,
} from './customer-request/hoursOptimistic';
import { buildPayloadFromDraft } from './customer-request/helpers';
import {
  buildDispatcherQuickActions,
  buildPerformerQuickActions,
} from './customer-request/quickActions';
import {
  DEFAULT_CUSTOMER_REQUEST_SAVED_VIEWS,
  type CustomerRequestQuickRequestItem,
  type CustomerRequestSavedView,
} from './customer-request/customerRequestQuickAccess';
import { useCustomerRequestQuickAccess } from './customer-request/hooks/useCustomerRequestQuickAccess';
import { useCreateCRC } from '../shared/hooks/useCustomerRequests';
import type { SearchableSelectOption } from './SearchableSelect';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface CustomerRequestManagementHubProps {
  customers: Customer[];
  customerPersonnel: CustomerPersonnel[];
  projectItems: ProjectItemMaster[];
  employees: Employee[];
  supportServiceGroups: SupportServiceGroup[];
  currentUserId?: string | number | null;
  isAdminViewer?: boolean;
  canReadRequests?: boolean;
  canWriteRequests?: boolean;
  canDeleteRequests?: boolean;
  canImportRequests?: boolean;
  canExportRequests?: boolean;
  onNotify?: (type: ToastType, title: string, message: string) => void;
}

const workspaceTabToRoleFilter = (
  tab: WorkspaceTabKey
): CustomerRequestRoleFilter => (tab === 'overview' ? '' : tab);

const readCustomerRequestWindowScrollY = (): number => {
  if (typeof window === 'undefined') {
    return 0;
  }

  return Math.max(
    window.scrollY ?? 0,
    window.pageYOffset ?? 0,
    document.documentElement?.scrollTop ?? 0,
    document.body?.scrollTop ?? 0
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CustomerRequestManagementHub: React.FC<CustomerRequestManagementHubProps> = ({
  customers,
  customerPersonnel,
  projectItems,
  employees,
  supportServiceGroups,
  currentUserId,
  isAdminViewer = false,
  canReadRequests = false,
  canWriteRequests = false,
  canDeleteRequests = false,
  canImportRequests: _canImportRequests = false,
  canExportRequests: _canExportRequests = false,
  onNotify,
}) => {
  // -------------------------------------------------------------------------
  // 1. Notify helper
  // -------------------------------------------------------------------------
  const notify = useCallback(
    (type: ToastType, title: string, message: string) => {
      onNotify?.(type, title, message);
    },
    [onNotify]
  );

  // -------------------------------------------------------------------------
  // 2. Hub state
  // -------------------------------------------------------------------------
  const [dataVersion, setDataVersion] = useState(0);
  const bumpDataVersion = useCallback(() => setDataVersion((v) => v + 1), []);

  const [selectedRequestId, setSelectedRequestId] = useState<string | number | null>(null);
  const [selectedRequestPreview, setSelectedRequestPreview] = useState<YeuCau | null>(null);
  const [activeEditorProcessCode, setActiveEditorProcessCode] = useState('');
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [createFormTags, setCreateFormTags] = useState<Tag[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmittingWorklog, setIsSubmittingWorklog] = useState(false);
  const [isSubmittingEstimate, setIsSubmittingEstimate] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [attachmentNotice, setAttachmentNotice] = useState('');
  const [scopedProjectItems, setScopedProjectItems] = useState<ProjectItemMaster[]>([]);
  const [projectRaciRows, setProjectRaciRows] = useState<ProjectRaciRow[]>([]);
  const [showWorklogModal, setShowWorklogModal] = useState(false);
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [pendingPrimaryAction, setPendingPrimaryAction] = useState<{
    requestId: string;
    action: CustomerRequestPrimaryActionMeta;
  } | null>(null);

  // List / filter state
  const [activeProcessCode, setActiveProcessCode] = useState('');
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(20);
  const [requestKeyword, setRequestKeyword] = useState('');
  const [requestCustomerFilter, setRequestCustomerFilter] = useState('');
  const [requestSupportGroupFilter, setRequestSupportGroupFilter] = useState('');
  const [requestPriorityFilter, setRequestPriorityFilter] = useState('');
  const [requestRoleFilter, setRequestRoleFilter] = useState<CustomerRequestRoleFilter>('');
  /** Kiểm soát workspace nào hiển thị — độc lập với requestRoleFilter (lọc list) */
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<WorkspaceTabKey>('overview');
  const [activeSurface, setActiveSurface] = useState<CustomerRequestSurfaceKey>('inbox');
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(null);
  const [requestMissingEstimateFilter, setRequestMissingEstimateFilter] = useState(false);
  const [requestOverEstimateFilter, setRequestOverEstimateFilter] = useState(false);
  const [requestSlaRiskFilter, setRequestSlaRiskFilter] = useState(false);
  const [isQuickAccessCollapsedOnMobile, setIsQuickAccessCollapsedOnMobile] = useState(false);
  const [isQuickAccessAutoHideArmed, setIsQuickAccessAutoHideArmed] = useState(true);

  // Transition state
  const [transitionStatusCode, setTransitionStatusCode] = useState('');

  // Task tab state (detail pane)
  const [activeTaskTab, setActiveTaskTab] = useState<CustomerRequestTaskSource>('IT360');

  // Create flow draft
  const [createFlowDraft, setCreateFlowDraft] =
    useState<CustomerRequestCreateFlowDraft>(() => buildInitialCreateFlowDraft(currentUserId));
  
  // Workflow selection for new request
  const { defaultWorkflowId, isLoading: isLoadingWorkflows } = useWorkflowDefinitions({ enabled: isCreateMode });
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);

  // Set default workflow when creating new request
  useEffect(() => {
    if (isCreateMode && defaultWorkflowId !== null && selectedWorkflowId === null) {
      setSelectedWorkflowId(defaultWorkflowId);
    }
  }, [isCreateMode, defaultWorkflowId, selectedWorkflowId]);
  
  const quickAccessAnchorRef = useRef<HTMLDivElement | null>(null);
  const quickAccessRestoreTimeoutRef = useRef<number | null>(null);
  const layoutMode = useCustomerRequestResponsiveLayout();
  const isMobileListSurface = layoutMode === 'mobile' && activeSurface === 'list' && !isCreateMode;
  const shouldCollapseQuickAccessOnMobile =
    isMobileListSurface &&
    (isQuickAccessCollapsedOnMobile ||
      (isQuickAccessAutoHideArmed && readCustomerRequestWindowScrollY() >= 280));

  const {
    pinnedItems,
    recentItems,
    pushRecentRequest,
    togglePinnedRequest,
    removePinnedRequest,
    isPinnedRequest,
  } = useCustomerRequestQuickAccess(currentUserId);

  useEffect(() => {
    if (quickAccessRestoreTimeoutRef.current !== null) {
      window.clearTimeout(quickAccessRestoreTimeoutRef.current);
      quickAccessRestoreTimeoutRef.current = null;
    }

    if (!isMobileListSurface) {
      setIsQuickAccessCollapsedOnMobile(false);
      setIsQuickAccessAutoHideArmed(true);
      return;
    }

    const handleScroll = () => {
      if (!isQuickAccessAutoHideArmed) {
        return;
      }

      if (readCustomerRequestWindowScrollY() >= 280) {
        setIsQuickAccessCollapsedOnMobile(true);
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll);
    document.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
    };
  }, [isMobileListSurface, isQuickAccessAutoHideArmed]);

  useEffect(() => {
    return () => {
      if (quickAccessRestoreTimeoutRef.current !== null) {
        window.clearTimeout(quickAccessRestoreTimeoutRef.current);
      }
    };
  }, []);

  const handleRevealQuickAccess = useCallback(() => {
    setIsQuickAccessCollapsedOnMobile(false);
    setIsQuickAccessAutoHideArmed(false);

    if (quickAccessRestoreTimeoutRef.current !== null) {
      window.clearTimeout(quickAccessRestoreTimeoutRef.current);
    }

    quickAccessRestoreTimeoutRef.current = window.setTimeout(() => {
      setIsQuickAccessAutoHideArmed(true);
      quickAccessRestoreTimeoutRef.current = null;
    }, 1200);

    window.requestAnimationFrame(() => {
      quickAccessAnchorRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, []);

  // -------------------------------------------------------------------------
  // 3. Process catalog
  // -------------------------------------------------------------------------
  const [processCatalog, setProcessCatalog] = useState<YeuCauProcessCatalog | null>(null);

  useEffect(() => {
    if (!canReadRequests) {
      return;
    }

    let cancelled = false;

    void fetchYeuCauProcessCatalog()
      .then((catalog) => {
        if (!cancelled) {
          setProcessCatalog(catalog);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled && !isRequestCanceledError(error)) {
          notify(
            'error',
            'Tải danh mục quy trình thất bại',
            error instanceof Error ? error.message : 'Không thể tải danh mục.'
          );
        }
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canReadRequests]);

  // Derived from catalog
  const masterFields = useMemo<YeuCauProcessField[]>(
    () => processCatalog?.master_fields ?? [],
    [processCatalog]
  );

  const allProcesses = useMemo<YeuCauProcessMeta[]>(() => {
    if (!processCatalog) return [];
    return processCatalog.groups.flatMap((g) => g.processes);
  }, [processCatalog]);

  const xmlVisibleProcesses = useMemo<YeuCauProcessMeta[]>(
    () => filterXmlVisibleProcesses(allProcesses),
    [allProcesses]
  );

  const processMap = useMemo<Map<string, YeuCauProcessMeta>>(() => {
    const map = new Map<string, YeuCauProcessMeta>();
    allProcesses.forEach((p) => map.set(p.process_code, p));
    return map;
  }, [allProcesses]);

  const processOptions = useMemo<SearchableSelectOption[]>(() => {
    const opts: SearchableSelectOption[] = [{ value: '', label: 'Tất cả' }];
    xmlVisibleProcesses.forEach((p) =>
      opts.push({ value: p.process_code, label: p.process_label })
    );
    return opts;
  }, [xmlVisibleProcesses]);

  const effectiveProjectItems = useMemo(() => {
    // CRC phải chỉ hiển thị project item đã được scope theo đội ngũ dự án
    // từ endpoint chuyên dụng; không union với bootstrap list chung của app
    // vì sẽ làm lộ các dự án/sản phẩm chưa được phân công RACI.
    return scopedProjectItems;
  }, [scopedProjectItems]);

  const newIntakeFields = useMemo<YeuCauProcessField[]>(
    () => processMap.get('new_intake')?.form_fields ?? [],
    [processMap]
  );

  const activeEditorMeta = useMemo<YeuCauProcessMeta | null>(
    () => (isXmlVisibleProcessCode(activeEditorProcessCode) ? (processMap.get(activeEditorProcessCode) ?? null) : null),
    [processMap, activeEditorProcessCode]
  );

  const transitionProcessMeta = useMemo<YeuCauProcessMeta | null>(
    () =>
      transitionStatusCode && isXmlVisibleProcessCode(transitionStatusCode)
        ? (processMap.get(transitionStatusCode) ?? null)
        : null,
    [processMap, transitionStatusCode]
  );

  const transitionRenderableFields = useMemo<YeuCauProcessField[]>(
    () => ([
      { name: 'received_at', label: 'Ngày bắt đầu', type: 'datetime' },
      { name: 'completed_at', label: 'Ngày kết thúc', type: 'datetime' },
      { name: 'extended_at', label: 'Ngày gia hạn', type: 'datetime' },
      { name: 'progress_percent', label: 'Tiến độ phần trăm', type: 'number' },
      { name: 'from_user_id', label: 'Người chuyển', type: 'user_select' },
      { name: 'to_user_id', label: 'Người nhận', type: 'user_select' },
      { name: 'notes', label: 'Ghi chú', type: 'textarea' },
    ]),
    []
  );

  // -------------------------------------------------------------------------
  // 4. Search hook
  // -------------------------------------------------------------------------
  const {
    searchKeyword,
    setSearchKeyword,
    searchResults,
    searchError,
    isSearchLoading,
    isSearchOpen,
    setIsSearchOpen,
  } = useCustomerRequestSearch({ canReadRequests });


  // -------------------------------------------------------------------------
  // 5. Stable error/callback refs — prevent hook useEffect re-firing on every
  //    render due to inline arrow functions changing reference each render.
  // -------------------------------------------------------------------------
  const handleListError = useCallback(
    (msg: string) => notify('error', 'Tải danh sách thất bại', msg),
    [notify]
  );
  const handlePageOverflow = useCallback((page: number) => setListPage(page), []);
  const handleDashboardError = useCallback(
    (msg: string) => notify('error', 'Tải dashboard thất bại', msg),
    [notify]
  );
  const handleCreatorError = useCallback(
    (msg: string) => notify('error', 'Khu vực người tạo', msg),
    [notify]
  );
  const handleDispatcherError = useCallback(
    (msg: string) => notify('error', 'Khu vực điều phối', msg),
    [notify]
  );
  const handlePerformerError = useCallback(
    (msg: string) => notify('error', 'Khu vực người xử lý', msg),
    [notify]
  );
  const handleDetailError = useCallback(
    (msg: string) => notify('error', 'Tải chi tiết yêu cầu thất bại', msg),
    [notify]
  );

  // -------------------------------------------------------------------------
  // 6. List hook
  // -------------------------------------------------------------------------
  const listFilters = useMemo(
    () => ({
      customer_id: requestCustomerFilter || undefined,
      support_service_group_id: requestSupportGroupFilter || undefined,
      priority: requestPriorityFilter || undefined,
      my_role: requestRoleFilter || undefined,
      missing_estimate: requestMissingEstimateFilter ? (1 as const) : undefined,
      over_estimate: requestOverEstimateFilter ? (1 as const) : undefined,
      sla_risk: requestSlaRiskFilter ? (1 as const) : undefined,
    }),
    [
      requestCustomerFilter,
      requestSupportGroupFilter,
      requestPriorityFilter,
      requestRoleFilter,
      requestMissingEstimateFilter,
      requestOverEstimateFilter,
      requestSlaRiskFilter,
    ]
  );

  const { listRows, isListLoading, listMeta } = useCustomerRequestList({
    canReadRequests,
    activeProcessCode,
    isCreateMode,
    listPage,
    pageSize: listPageSize,
    dataVersion,
    requestKeyword,
    filters: listFilters,
    onError: handleListError,
    onPageOverflow: handlePageOverflow,
  });

  const taskReferenceCatalog = useMemo(() => {
    const map = new Map<string, { id?: string | number | null; task_code: string; label: string; searchText: string }>();

    const addTaskReference = (raw: {
      id?: string | number | null;
      taskCode: string;
      summary?: string | null;
      customerName?: string | null;
      projectName?: string | null;
    }) => {
      const taskCode = String(raw.taskCode || '').trim();
      if (!taskCode) {
        return;
      }

      const normalizedCode = taskCode.toLowerCase();
      if (map.has(normalizedCode)) {
        return;
      }

      const summary = String(raw.summary || '').trim();
      map.set(normalizedCode, {
        id: raw.id ?? null,
        task_code: taskCode,
        label: summary ? `${taskCode} — ${summary}` : taskCode,
        searchText: `${taskCode} ${summary} ${String(raw.customerName || '')} ${String(raw.projectName || '')}`,
      });
    };

    listRows.forEach((row) => {
      addTaskReference({
        id: row.id,
        taskCode: row.request_code ?? row.ma_yc ?? String(row.id ?? ''),
        summary: row.summary ?? row.tieu_de,
        customerName: row.customer_name ?? row.khach_hang_name,
        projectName: (row as unknown as Record<string, unknown>).project_name as string | undefined,
      });
    });

    searchResults.forEach((r) => {
      addTaskReference({
        id: r.id,
        taskCode: r.request_code ?? String(r.id),
        summary: r.summary ?? r.label,
        customerName: r.customer_name,
        projectName: r.project_name,
      });
    });

    return map;
  }, [listRows, searchResults]);

  // Task reference options (default from current list + search results)
  const taskReferenceOptions = useMemo<SearchableSelectOption[]>(
    () =>
      Array.from(taskReferenceCatalog.values()).map((item) => ({
        value: item.task_code,
        label: item.label,
        searchText: item.searchText,
      })),
    [taskReferenceCatalog]
  );

  // Task reference lookup for transition/detail hooks
  const taskReferenceLookup = useMemo(() => {
    const map = new Map<string, { id?: string | number | null; task_code: string }>();
    taskReferenceCatalog.forEach((item, key) => {
      map.set(key, { id: item.id, task_code: item.task_code });
      map.set(item.task_code, { id: item.id, task_code: item.task_code });
    });
    return map;
  }, [taskReferenceCatalog]);

  const createCRCHook = useCreateCRC();

  // -------------------------------------------------------------------------
  // 7. Dashboard hook
  // -------------------------------------------------------------------------
  const { isDashboardLoading, overviewDashboard, roleDashboards } =
    useCustomerRequestDashboard({
      canReadRequests,
      dataVersion,
      onError: handleDashboardError,
    });

  // -------------------------------------------------------------------------
  // 8. Role workspace hooks
  // -------------------------------------------------------------------------
  const isWorkspaceActive = !isCreateMode && activeSurface === 'inbox';

  const creatorWS = useCustomerRequestCreatorWorkspace({
    active: isWorkspaceActive,
    canReadRequests,
    dataVersion,
    onError: handleCreatorError,
  });

  const dispatcherWS = useCustomerRequestDispatcherWorkspace({
    active: isWorkspaceActive,
    canReadRequests,
    dataVersion,
    onError: handleDispatcherError,
  });

  const performerWS = useCustomerRequestPerformerWorkspace({
    active: isWorkspaceActive,
    canReadRequests,
    dataVersion,
    onError: handlePerformerError,
  });

  // -------------------------------------------------------------------------
  // 8. Detail hook
  // -------------------------------------------------------------------------
  const {
    processDetail,
    setProcessDetail,
    people,
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
    formTags,
    setFormTags,
    timeline,
    caseWorklogs,
    setCaseWorklogs,
    isDetailLoading,
    refreshDetail,
  } = useCustomerRequestDetail({
    isCreateMode,
    selectedRequestId,
    activeEditorProcessCode,
    dataVersion,
    masterFields,
    createInitialFields: newIntakeFields,
    onError: handleDetailError,
  });

  // -------------------------------------------------------------------------
  // 9. Derived detail props
  // -------------------------------------------------------------------------
  const currentUserName = useMemo(() => {
    const user = employees.find((e) => String(e.id) === String(currentUserId ?? ''));
    return user?.full_name ?? '';
  }, [employees, currentUserId]);

  // Auto-fetch reference task data when formReferenceTasks is populated from API
  useEffect(() => {
    if (!canReadRequests || formReferenceTasks.length === 0) {
      return;
    }

    // Get task_codes that are not in searchResults
    const existingCodes = new Set(searchResults.map((r) => r.request_code).filter(Boolean));
    const missingTaskCodes = formReferenceTasks
      .map((t) => t.task_code)
      .filter((code): code is string => !!(code && !existingCodes.has(code)));

    if (missingTaskCodes.length > 0 && !isSearchLoading) {
      // Trigger search for the first missing task_code
      // User can then click dropdown to see the option, or type to search
      setSearchKeyword(missingTaskCodes[0]);
    }
  }, [canReadRequests, formReferenceTasks, searchResults, isSearchLoading, setSearchKeyword]);

  const {
    registerOptimisticRequestUpdate,
    getPatchedRequest,
    patchedListRows,
    patchedCreatorRows,
    patchedCreatorBuckets,
    patchedDispatcherRows,
    patchedDispatcherBuckets,
    patchedDispatcherTeamLoadRows,
    patchedDispatcherPmWatchRows,
    patchedPerformerRows,
    patchedPerformerBuckets,
    patchedOverviewDashboard,
    patchedRoleDashboards,
  } = useCustomerRequestOptimisticState({
    currentUserId,
    dataVersion,
    listRows,
    creatorRows: creatorWS.creatorRows,
    dispatcherRows: dispatcherWS.dispatcherRows,
    performerRows: performerWS.performerRows,
    overviewDashboard,
    roleDashboards,
  });

  const selectedCustomerId = String(masterDraft.customer_id ?? '');

  const selectedProjectItem = useMemo(
    () =>
      effectiveProjectItems.find(
        (p) => String(p.id) === String(masterDraft.project_item_id ?? '')
      ) ?? null,
    [effectiveProjectItems, masterDraft.project_item_id]
  );

  useEffect(() => {
    if (!canReadRequests) {
      return;
    }

    let cancelled = false;

    void fetchCustomerRequestProjectItems({
      include_project_item_id: (masterDraft.project_item_id as string | number | null | undefined) ?? null,
    })
      .then((items) => {
        if (!cancelled) {
          setScopedProjectItems(Array.isArray(items) ? items : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScopedProjectItems([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canReadRequests, masterDraft.project_item_id]);

  // Fetch project RACI assignments for the selected request's project
  useEffect(() => {
    const projectItemId = processDetail?.yeu_cau?.project_item_id;
    if (!projectItemId || !canReadRequests) {
      setProjectRaciRows([]);
      return;
    }

    let cancelled = false;

    void fetchProjectRaciAssignments([projectItemId])
      .then((rows) => {
        if (!cancelled) {
          // Lấy tất cả roles, không chỉ 'R'
          const rRows = Array.isArray(rows) ? rows : [];
          setProjectRaciRows(rRows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProjectRaciRows([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canReadRequests, processDetail?.yeu_cau?.project_item_id]);

  const transitionOptions = useMemo<YeuCauProcessMeta[]>(
    () => {
      const options = resolveTransitionOptionsForRequest(
        processDetail?.allowed_next_processes ?? [],
        processDetail?.yeu_cau ?? null
      );

      return options;
    },
    [processDetail]
  );

  useEffect(() => {
    if (isCreateMode || !selectedRequestId || transitionOptions.length === 0) {
      if (transitionStatusCode !== '') {
        setTransitionStatusCode('');
      }
      return;
    }

    const hasCurrentSelection = transitionOptions.some(
      (option) => option.process_code === transitionStatusCode
    );

    if (!hasCurrentSelection) {
      setTransitionStatusCode(transitionOptions[0]?.process_code ?? '');
    }
  }, [isCreateMode, selectedRequestId, transitionOptions, transitionStatusCode]);

  const canTransitionActiveRequest =
    !isCreateMode && !!selectedRequestId;

  const canEditActiveForm = useMemo(() => {
    if (!canWriteRequests) return false;
    if (isCreateMode) return true;
    if (!processDetail) return false;
    return processDetail.can_write;
  }, [canWriteRequests, isCreateMode, processDetail]);

  const defaultProcessor: ProjectRaciRow | null = null;

  const relatedSummaryItems = useMemo(() => {
    if (!processDetail?.yeu_cau) return [];
    const yc = processDetail.yeu_cau;
    const raw = yc as unknown as Record<string, unknown>;
    const people = processDetail.people ?? [];
    const statusRow = processDetail.status_row?.data as Record<string, unknown> | undefined;
    const processRow = processDetail.process_row?.data as Record<string, unknown> | undefined;
    const currentStatusCode = yc.current_status_code ?? yc.trang_thai;

    // Lấy assignee theo status hiện tại từ status_row/process_row trước
    const receiverUserIdFromStatusRow = statusRow?.receiver_user_id ?? processRow?.receiver_user_id;
    const dispatcherUserIdFromStatusRow = statusRow?.dispatcher_user_id ?? processRow?.dispatcher_user_id;

    // Tìm người thực hiện từ people array (vai_tro = "nguoi_thuc_hien")
    const nguoiThucHien = people.find((p) => p.vai_tro === 'nguoi_thuc_hien' && p.is_active);
    const performerUserIdFromPeople = nguoiThucHien?.user_id;

    // Với status "completed", lấy completed_by_user_id
    const completedByUserId = currentStatusCode === 'completed'
      ? statusRow?.completed_by_user_id ?? statusRow?.created_by
      : null;

    const handlerUserId = yc.nguoi_xu_ly_id
      ?? yc.current_owner_user_id
      ?? (currentStatusCode === 'pending_dispatch'
        ? dispatcherUserIdFromStatusRow ?? yc.dispatcher_user_id
        : receiverUserIdFromStatusRow ?? completedByUserId ?? performerUserIdFromPeople ?? yc.receiver_user_id ?? yc.performer_user_id ?? yc.performer_id);

    // Tìm trong RACI rows trước
    const performerFromRaci = handlerUserId
      ? projectRaciRows.find((row) => String(row.user_id) === String(handlerUserId))
      : null;

    // Nếu không tìm thấy trong RACI, tìm trong employees
    const performerFromEmployees = !performerFromRaci && handlerUserId
      ? employees.find((emp) => String(emp.id) === String(handlerUserId))
      : null;

    // Lấy tên từ status_row nếu có
    const receiverNameFromStatusRow = statusRow?.receiver_user_id_name as string | undefined;
    const dispatcherNameFromStatusRow = statusRow?.dispatcher_user_id_name as string | undefined;
    const completedByName = statusRow?.completed_by_user_id_name as string | undefined;

    // pending_dispatch phải ưu tiên PM/dispatcher hiện tại
    const performerName = yc.nguoi_xu_ly_name
      ?? yc.current_owner_name
      ?? (currentStatusCode === 'pending_dispatch'
        ? performerFromRaci?.full_name
          ?? performerFromRaci?.username
          ?? performerFromEmployees?.full_name
          ?? dispatcherNameFromStatusRow
          ?? yc.dispatcher_name
        : performerFromRaci?.full_name
          ?? performerFromRaci?.username
          ?? performerFromEmployees?.full_name
          ?? receiverNameFromStatusRow
          ?? completedByName
          ?? yc.performer_name
          ?? yc.receiver_name);

    return [
      { label: 'Mã yêu cầu', value: (yc.ma_yc ?? yc.request_code) as string | null | undefined },
      { label: 'Khách hàng', value: (yc.customer_name ?? yc.khach_hang_name) as string | null | undefined },
      { label: 'Dự án', value: raw.project_name as string | null | undefined },
      { label: 'Người tiếp nhận', value: yc.received_by_name },
      { label: 'Người điều phối', value: yc.dispatcher_name },
      { label: 'Người xử lý', value: performerName },
    ].filter((item): item is { label: string; value: string } => !!item.value);
  }, [processDetail, projectRaciRows, employees]);

  const currentHoursReport = useMemo<YeuCauHoursReport | null | undefined>(
    () => processDetail?.hours_report ?? null,
    [processDetail]
  );

  const estimateHistory = useMemo<YeuCauEstimate[]>(
    () => processDetail?.estimates ?? [],
    [processDetail]
  );

  const canOpenWorklogModal =
    !isCreateMode && !!selectedRequestId && Boolean(processDetail?.available_actions?.can_add_worklog);

  const canOpenEstimateModal =
    !isCreateMode && !!selectedRequestId && Boolean(processDetail?.available_actions?.can_add_estimate);

  const runPrimaryActionForLoadedRequest = useCallback(
    (action: CustomerRequestPrimaryActionMeta): boolean => {
      if (action.kind === 'estimate') {
        if (!processDetail?.available_actions?.can_add_estimate) {
          return false;
        }
        setShowEstimateModal(true);
        return true;
      }

      if (action.kind === 'worklog') {
        if (!processDetail?.available_actions?.can_add_worklog) {
          return false;
        }
        setShowWorklogModal(true);
        return true;
      }

      if (action.kind === 'transition' && action.targetStatusCode) {
        const nextTransitionCode = transitionOptions.some(
          (option) => option.process_code === action.targetStatusCode
        )
          ? action.targetStatusCode
          : transitionOptions[0]?.process_code ?? '';

        if (!nextTransitionCode) {
          return false;
        }

        setTransitionStatusCode(nextTransitionCode);
        return true;
      }

      return false;
    },
    [
      processDetail?.available_actions?.can_add_estimate,
      processDetail?.available_actions?.can_add_worklog,
      transitionOptions,
    ]
  );

  useEffect(() => {
    if (!pendingPrimaryAction || isCreateMode || !selectedRequestId) {
      return;
    }

    if (String(selectedRequestId) !== pendingPrimaryAction.requestId) {
      return;
    }

    const detailRequestId = String(processDetail?.yeu_cau?.id ?? '');
    if (!detailRequestId || detailRequestId !== pendingPrimaryAction.requestId) {
      return;
    }

    runPrimaryActionForLoadedRequest(pendingPrimaryAction.action);
    setPendingPrimaryAction(null);
  }, [
    isCreateMode,
    pendingPrimaryAction,
    processDetail?.yeu_cau?.id,
    runPrimaryActionForLoadedRequest,
    selectedRequestId,
  ]);

  useEffect(() => {
    if (isCreateMode || !processDetail?.yeu_cau?.id) {
      return;
    }
    pushRecentRequest(processDetail.yeu_cau);
  }, [isCreateMode, processDetail?.yeu_cau, pushRecentRequest]);

  const dispatcherQuickActions = useMemo<DispatcherQuickAction[]>(() => {
    return buildDispatcherQuickActions({
      canTransitionActiveRequest,
      isCreateMode,
      transitionOptions,
      currentUserId,
    });
  }, [canTransitionActiveRequest, currentUserId, isCreateMode, transitionOptions]);

  const performerQuickActions = useMemo<PerformerQuickAction[]>(() => {
    return buildPerformerQuickActions({
      canTransitionActiveRequest,
      isCreateMode,
      transitionOptions,
      currentUserId,
    });
  }, [canTransitionActiveRequest, currentUserId, isCreateMode, transitionOptions]);

  // -------------------------------------------------------------------------
  // 10. Transition hook
  // -------------------------------------------------------------------------
  const transitionHook = useCustomerRequestTransition({
    currentUserId,
    selectedRequestId,
    transitionStatusCode,
    transitionProcessMeta,
    processDetail,
    people: people as YeuCauRelatedUser[],
    defaultProcessor,
    taskReferenceLookup,
    onNotify: (type, title, msg) => notify(type, title, msg),
    onTransitionSuccess: (requestId, statusCode) => {
      setSelectedRequestId(requestId);
      setSelectedRequestPreview((prev) =>
        prev ? { ...prev, id: requestId, current_status_code: statusCode } : prev
      );
      setIsCreateMode(false);
      setActiveEditorProcessCode(statusCode || 'new_intake');
      setTransitionStatusCode('');
      setPendingPrimaryAction(null);
      bumpDataVersion();
    },
    bumpDataVersion,
  });

  // -------------------------------------------------------------------------
  // 11. Handlers
  // -------------------------------------------------------------------------
  const handleSelectRow = useCallback((row: YeuCau) => {
    pushRecentRequest(row);
    setSelectedRequestId(row.id);
    setSelectedRequestPreview(row);
    setIsCreateMode(false);
    setActiveSurface('list');
    setActiveEditorProcessCode(resolveRequestProcessCode(row));
    setTransitionStatusCode('');
    setPendingPrimaryAction(null);
    setActiveSavedViewId(null);
    setProcessDetail(null);
  }, [pushRecentRequest, setProcessDetail]);

  const requestLookup = useMemo(() => {
    const map = new Map<string, YeuCau>();

    const appendRows = (rows: Array<YeuCau | null | undefined>) => {
      rows.forEach((row) => {
        if (!row?.id) {
          return;
        }
        map.set(String(row.id), row);
      });
    };

    const appendAttentionCases = (
      dashboard: typeof overviewDashboard | null | undefined
    ) => {
      (dashboard?.attention_cases ?? []).forEach((item) => {
        const requestCase = item?.request_case as YeuCau | undefined;
        if (!requestCase?.id) {
          return;
        }
        map.set(String(requestCase.id), requestCase);
      });
    };

    appendRows(patchedListRows);
    appendRows(patchedCreatorRows);
    appendRows(patchedDispatcherRows);
    appendRows(patchedPerformerRows);
    appendAttentionCases(patchedOverviewDashboard);
    appendAttentionCases(patchedRoleDashboards.creator);
    appendAttentionCases(patchedRoleDashboards.dispatcher);
    appendAttentionCases(patchedRoleDashboards.performer);

    return map;
  }, [
    patchedCreatorRows,
    patchedDispatcherRows,
    patchedListRows,
    patchedOverviewDashboard,
    patchedPerformerRows,
    patchedRoleDashboards.creator,
    patchedRoleDashboards.dispatcher,
    patchedRoleDashboards.performer,
  ]);

  const handleOpenRequest = useCallback(
    async (requestId: string | number, statusCode?: string | null) => {
      const lookupKey = String(requestId);
      const knownRow = requestLookup.get(lookupKey) ?? null;
      const listRow = patchedListRows.find((r) => String(r.id) === lookupKey) ?? null;

      if (listRow) {
        handleSelectRow(listRow);
        return;
      }

      setSelectedRequestId(requestId);
      setSelectedRequestPreview(knownRow);
      setIsCreateMode(false);
      setActiveSurface('list');
      setPendingPrimaryAction(null);
      setTransitionStatusCode('');
      setActiveSavedViewId(null);
      setProcessDetail(null);

      let requestPreview = knownRow;
      let resolvedCode =
        String(statusCode ?? '').trim() ||
        (knownRow ? resolveRequestProcessCode(knownRow) : '');

      if (!requestPreview || !resolvedCode) {
        try {
          const fetched = await fetchYeuCau(requestId);
          requestPreview = fetched;
          resolvedCode = resolveRequestProcessCode(fetched) || resolvedCode;
          setSelectedRequestPreview(fetched);
          pushRecentRequest(fetched);
        } catch (error: unknown) {
          if (!isRequestCanceledError(error)) {
            notify(
              'error',
              'Mở chi tiết yêu cầu thất bại',
              error instanceof Error ? error.message : 'Không thể tải yêu cầu.'
            );
          }
          setSelectedRequestId(null);
          setSelectedRequestPreview(null);
          setActiveEditorProcessCode('');
          return;
        }
      } else {
        pushRecentRequest(requestPreview);
      }

      if (!resolvedCode) {
        notify(
          'error',
          'Mở chi tiết yêu cầu thất bại',
          'Không xác định được tiến trình hiện tại của yêu cầu.'
        );
        setSelectedRequestId(null);
        setSelectedRequestPreview(null);
        setActiveEditorProcessCode('');
        return;
      }

      setActiveEditorProcessCode(resolvedCode);
    },
    [
      handleSelectRow,
      isRequestCanceledError,
      patchedListRows,
      notify,
      pushRecentRequest,
      requestLookup,
      setProcessDetail,
    ]
  );

  const handleCreateRequest = useCallback(() => {
    setSelectedRequestId(null);
    setSelectedRequestPreview(null);
    setPendingPrimaryAction(null);
    setCreateFormTags([]);
    setIsCreateMode(true);
    setActiveEditorProcessCode('new_intake');
    setTransitionStatusCode('');
    setCreateFlowDraft(buildInitialCreateFlowDraft(currentUserId));
    setSelectedWorkflowId(null); // Reset workflow selection
    setActiveSavedViewId(null);
  }, [currentUserId]);

  const handleWorkspaceTabChange = useCallback((tab: WorkspaceTabKey) => {
    setActiveWorkspaceTab(tab);
    setRequestRoleFilter(workspaceTabToRoleFilter(tab));
    setListPage(1);
    setActiveSavedViewId(null);
  }, []);

  const handleDashboardRoleFilterChange = useCallback((role: CustomerRequestRoleFilter) => {
    setActiveWorkspaceTab(role || 'overview');
    setListPage(1);
    setActiveSavedViewId(null);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedRequestId(null);
    setSelectedRequestPreview(null);
    setPendingPrimaryAction(null);
    setTransitionStatusCode('');
    setShowWorklogModal(false);
    setShowEstimateModal(false);
  }, []);

  const handleSubmitWorklog = useCallback(
    async (payload: CustomerRequestWorklogSubmission) => {
      if (!selectedRequestId) {
        return;
      }

      setIsSubmittingWorklog(true);
      try {
        const result = await storeYeuCauWorklog(selectedRequestId, payload);
        const previousRequest = processDetail?.yeu_cau ?? selectedRequestPreview ?? null;
        const nextHoursReport = result.hours_report;
        const nextRequest = applyHoursReportToRequest({
          request: previousRequest,
          hoursReport: nextHoursReport,
        });

        if (result.worklog) {
          setCaseWorklogs((prev) => prependUniqueWorklog(prev, result.worklog));
        }
        registerOptimisticRequestUpdate(previousRequest, nextRequest);
        setProcessDetail((prev) => {
          if (!prev) {
            return prev;
          }

          return {
            ...prev,
            yeu_cau: nextRequest ?? prev.yeu_cau,
            hours_report: nextHoursReport ?? prev.hours_report ?? null,
            worklogs: prependUniqueWorklog(prev.worklogs ?? [], result.worklog),
          };
        });
        if (nextRequest) {
          setSelectedRequestPreview((prev) =>
            applyHoursReportToRequest({
              request: prev,
              hoursReport: nextHoursReport,
              requestPatch: nextRequest,
            })
          );
        }
        setShowWorklogModal(false);
        notify('success', 'Giờ công', 'Đã lưu giờ công cho yêu cầu.');
        void refreshDetail();
      } catch (error: unknown) {
        if (!isRequestCanceledError(error)) {
          notify(
            'error',
            'Lưu giờ công thất bại',
            error instanceof Error ? error.message : 'Không thể lưu giờ công.'
          );
        }
      } finally {
        setIsSubmittingWorklog(false);
      }
    },
    [
      isRequestCanceledError,
      notify,
      processDetail?.yeu_cau,
      registerOptimisticRequestUpdate,
      refreshDetail,
      selectedRequestId,
      selectedRequestPreview,
      setCaseWorklogs,
      setProcessDetail,
    ]
  );

  const handleSubmitEstimate = useCallback(
    async (payload: CustomerRequestEstimateSubmission) => {
      if (!selectedRequestId) {
        return;
      }

      setIsSubmittingEstimate(true);
      try {
        const result = await createYeuCauEstimate(selectedRequestId, {
          ...payload,
          estimate_type: 'manual',
          estimated_by_user_id: currentUserId ?? undefined,
        });
        const previousRequest = processDetail?.yeu_cau ?? selectedRequestPreview ?? null;
        const nextEstimateHistory = prependUniqueEstimate(estimateHistory, result.estimate);
        const nextHoursReport = buildOptimisticEstimateHoursReport({
          currentHoursReport,
          requestCase: result.request_case,
          estimate: result.estimate,
          fallbackRequestCaseId: selectedRequestId,
        });
        const nextRequest = applyHoursReportToRequest({
          request: previousRequest,
          hoursReport: nextHoursReport,
          requestPatch: result.request_case ?? undefined,
        });

        registerOptimisticRequestUpdate(previousRequest, nextRequest);
        setProcessDetail((prev) => {
          if (!prev) {
            return prev;
          }

          return {
            ...prev,
            yeu_cau: nextRequest ?? prev.yeu_cau,
            hours_report: nextHoursReport,
            estimates: nextEstimateHistory,
          };
        });
        if (nextRequest) {
          setSelectedRequestPreview(nextRequest);
        }
        setShowEstimateModal(false);
        notify('success', 'Ước lượng', 'Đã cập nhật ước lượng cho yêu cầu.');
        void refreshDetail();
      } catch (error: unknown) {
        if (!isRequestCanceledError(error)) {
          notify(
            'error',
            'Cập nhật ước lượng thất bại',
            error instanceof Error ? error.message : 'Không thể lưu ước lượng.'
          );
        }
      } finally {
        setIsSubmittingEstimate(false);
      }
    },
    [
      currentHoursReport,
      currentUserId,
      estimateHistory,
      isRequestCanceledError,
      notify,
      processDetail?.yeu_cau,
      registerOptimisticRequestUpdate,
      refreshDetail,
      selectedRequestId,
      selectedRequestPreview,
      setProcessDetail,
    ]
  );

  const handleOpenQuickAccessItem = useCallback(
    (item: CustomerRequestQuickRequestItem) => {
      handleOpenRequest(item.requestId, item.statusCode);
    },
    [handleOpenRequest]
  );

  const handleApplySavedView = useCallback((view: CustomerRequestSavedView) => {
    const filters = view.filters ?? {};

    setActiveWorkspaceTab(view.workspaceTab);
    setActiveSurface(view.surface);
    setSelectedRequestId(null);
    setIsCreateMode(false);
    setTransitionStatusCode('');
    setActiveSavedViewId(view.id);
    setActiveProcessCode(filters.processCode ?? '');
    setRequestKeyword(filters.keyword ?? '');
    setRequestCustomerFilter(filters.customerId ?? '');
    setRequestSupportGroupFilter(filters.supportGroupId ?? '');
    setRequestPriorityFilter(filters.priority ?? '');
    setRequestRoleFilter(
      filters.roleFilter ?? workspaceTabToRoleFilter(view.workspaceTab)
    );
    setRequestMissingEstimateFilter(Boolean(filters.missingEstimate));
    setRequestOverEstimateFilter(Boolean(filters.overEstimate));
    setRequestSlaRiskFilter(Boolean(filters.slaRisk));
    setListPage(1);
  }, []);

  const handleClearSavedView = useCallback(() => {
    setActiveSavedViewId(null);
  }, []);

  const handleTogglePinnedRequest = useCallback((row: YeuCau) => {
    togglePinnedRequest(row);
  }, [togglePinnedRequest]);

  const handleOpenOverviewRoleWorkspace = useCallback(
    (tab: Extract<WorkspaceTabKey, 'creator' | 'dispatcher' | 'performer'>) => {
      setActiveWorkspaceTab(tab);
      setRequestRoleFilter(workspaceTabToRoleFilter(tab));
      setActiveSurface('inbox');
      setListPage(1);
      setActiveSavedViewId(null);
    },
    []
  );

  const handleMasterFieldChange = useCallback(
    (field: string, value: unknown) => {
      setMasterDraft((prev) => ({ ...prev, [field]: value }));
    },
    [setMasterDraft]
  );

  const handleProcessDraftChange = useCallback(
    (field: string, value: unknown) => {
      setProcessDraft((prev) => ({ ...prev, [field]: value }));
    },
    [setProcessDraft]
  );

  const handleUpdateIt360Row = useCallback(
    (localId: string, field: keyof Omit<It360TaskFormRow, 'local_id'>, value: unknown) => {
      setFormIt360Tasks((prev) =>
        prev.map((r) => (r.local_id === localId ? { ...r, [field]: value } : r))
      );
    },
    [setFormIt360Tasks]
  );

  const handleRemoveIt360Row = useCallback(
    (localId: string) => {
      setFormIt360Tasks((prev) => prev.filter((r) => r.local_id !== localId));
    },
    [setFormIt360Tasks]
  );

  const handleUpdateRefRow = useCallback(
    (localId: string, value: string) => {
      const normalizedValue = String(value || '').trim();
      const found = taskReferenceLookup.get(normalizedValue.toLowerCase())
        ?? taskReferenceLookup.get(normalizedValue);

      setFormReferenceTasks((prev) =>
        prev.map((r) =>
          r.local_id === localId
            ? {
                ...r,
                id: found?.id ?? null,
                task_code: found?.task_code ?? normalizedValue,
              }
            : r
        )
      );
    },
    [setFormReferenceTasks, taskReferenceLookup]
  );

  const handleRemoveRefRow = useCallback(
    (localId: string) => {
      setFormReferenceTasks((prev) => prev.filter((r) => r.local_id !== localId));
    },
    [setFormReferenceTasks]
  );

  const handleAddTaskRow = useCallback(() => {
    if (activeTaskTab === 'IT360') {
      setFormIt360Tasks((prev) => [
        ...prev,
        { local_id: String(Date.now()), task_code: '', task_link: '', status: 'TODO' },
      ]);
    } else {
      setFormReferenceTasks((prev) => [
        ...prev,
        { local_id: String(Date.now()), task_code: '' },
      ]);
    }
  }, [activeTaskTab, setFormIt360Tasks, setFormReferenceTasks]);

  /** Dùng riêng cho modal tạo mới (tab nội bộ trong modal) */
  const handleAddIt360Task = useCallback(() => {
    setFormIt360Tasks((prev) => [
      ...prev,
      { local_id: String(Date.now()), task_code: '', task_link: '', status: 'TODO' as const },
    ]);
  }, [setFormIt360Tasks]);

  const handleAddReferenceTask = useCallback(() => {
    setFormReferenceTasks((prev) => [
      ...prev,
      { local_id: String(Date.now()), task_code: '' },
    ]);
  }, [setFormReferenceTasks]);

  const handleUploadAttachment = useCallback(
    async (file: File) => {
      setAttachmentError('');
      setAttachmentNotice('');
      setIsUploadingAttachment(true);
      try {
        const uploaded = await uploadDocumentAttachment(file);
        setFormAttachments((prev) => [...prev, uploaded]);
        setAttachmentNotice(`Đã tải lên ${file.name}`);
      } catch (e: unknown) {
        setAttachmentError(e instanceof Error ? e.message : 'Tải file thất bại.');
      } finally {
        setIsUploadingAttachment(false);
      }
    },
    [setFormAttachments]
  );

  const handleDeleteAttachment = useCallback(
    async (id: string | number) => {
      setFormAttachments((prev) => prev.filter((a) => String(a.id) !== String(id)));
    },
    [setFormAttachments]
  );

  const handleSaveCase = useCallback(async () => {
    if (!canWriteRequests) return;
    if (!isCreateMode) return;

    const plan = resolveCreateRequestPlan(createFlowDraft, { actorUserId: currentUserId });
    if (plan.validationErrors.length > 0) {
      notify('error', 'Tạo yêu cầu thất bại', plan.validationErrors.join(' '));
      return;
    }

    setIsSaving(true);
    try {
      const basePayload = buildPayloadFromDraft(masterFields, masterDraft);

      // --- Canonical persist: gửi attachments + ref_tasks cùng request tạo mới ---
      const attachmentsPayload = formAttachments
        .filter((a) => a.id)
        .map((a) => ({ id: a.id }));

      const refTasksPayload: Array<Record<string, unknown>> = [
        ...formIt360Tasks
          .filter((r) => r.task_code.trim())
          .map((r) => ({
            task_source: 'IT360',
            task_code: r.task_code.trim(),
            task_link: r.task_link || null,
            task_status: r.status,
            ...(r.id != null ? { id: r.id } : {}),
          })),
        ...formReferenceTasks
          .filter((r) => r.task_code.trim() || r.id != null)
          .map((r) => ({
            task_source: 'REFERENCE',
            ...(r.id != null ? { id: r.id } : { task_code: r.task_code.trim() }),
          })),
      ];

      const payload: Record<string, unknown> = {
        ...basePayload,
        ...plan.masterOverrides,
        ...(attachmentsPayload.length > 0 ? { attachments: attachmentsPayload } : {}),
        ...(refTasksPayload.length > 0 ? { ref_tasks: refTasksPayload } : {}),
        // Include workflow_definition_id if selected
        ...(selectedWorkflowId ? { workflow_definition_id: selectedWorkflowId } : {}),
      };

      const created = await createYeuCau(payload);
      let effectiveRequest = created;
      const followUpWarnings: string[] = [];

      if (plan.estimatePayload && created.id != null) {
        try {
          const estimateResult = await createYeuCauEstimate(created.id, plan.estimatePayload);
          effectiveRequest = estimateResult.request_case ?? effectiveRequest;
        } catch (error: unknown) {
          followUpWarnings.push(
            `Chưa lưu được ước lượng ban đầu: ${error instanceof Error ? error.message : 'Lỗi không xác định.'}`
          );
        }
      }

      // Save tags if any
      if (createFormTags.length > 0 && created.id != null) {
        try {
          const normalizedTags = createFormTags
            .map((tag) => ({
              name: String(tag.name ?? '').trim().toLowerCase(),
              color: String(tag.color ?? '').trim().toLowerCase() || 'blue',
            }))
            .filter((tag) => tag.name.length > 0);

          await saveYeuCauCaseTags(created.id, normalizedTags);
        } catch (error: unknown) {
          followUpWarnings.push(
            `Chưa lưu được tags: ${error instanceof Error ? error.message : 'Lỗi không xác định.'}`
          );
        }
      }

      setIsCreateMode(false);
      setCreateFormTags([]);
      setSelectedRequestId(effectiveRequest.id ?? created.id);
      setSelectedRequestPreview(effectiveRequest);
      setActiveEditorProcessCode(resolveRequestProcessCode(effectiveRequest) || 'new_intake');
      // bumpDataVersion triggers useCustomerRequestDetail to reload detail
      // (GET rehydrate) and populate formAttachments/formIt360Tasks/formReferenceTasks
      // with persisted data from server — see §4.5 frontend create-flow complete.
      bumpDataVersion();

      const requestCode =
        effectiveRequest.ma_yc ??
        effectiveRequest.request_code ??
        created.ma_yc ??
        created.request_code ??
        '';

      if (followUpWarnings.length > 0) {
        notify(
          'warning',
          'Tạo yêu cầu chưa hoàn tất toàn bộ',
          [`Đã tạo yêu cầu ${requestCode}.`, ...followUpWarnings].join(' ')
        );
      } else {
        notify('success', 'Tạo yêu cầu', `Đã tạo yêu cầu ${requestCode}`);
      }
    } catch (e: unknown) {
      if (!isRequestCanceledError(e)) {
        notify(
          'error',
          'Tạo yêu cầu thất bại',
          e instanceof Error ? e.message : 'Không thể tạo yêu cầu.'
        );
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    canWriteRequests,
    isCreateMode,
    createFlowDraft,
    currentUserId,
    masterFields,
    masterDraft,
    formAttachments,
    formIt360Tasks,
    formReferenceTasks,
    createFormTags,
    selectedWorkflowId,
    bumpDataVersion,
    notify,
  ]);

  const handleSaveStatusDetail = useCallback(async () => {
    if (!canWriteRequests || isCreateMode || !selectedRequestId || !activeEditorProcessCode) {
      return;
    }

    setIsSaving(true);
    try {
      const masterPayload = buildPayloadFromDraft(masterFields, masterDraft);
      const refTasksPayload: Array<Record<string, unknown>> = [
        ...formIt360Tasks
          .filter((r) => r.task_code.trim())
          .map((r) => ({
            task_source: 'IT360',
            task_code: r.task_code.trim(),
            task_link: r.task_link || null,
            task_status: r.status,
            ...(r.id != null ? { id: r.id } : {}),
          })),
        ...formReferenceTasks
          .filter((r) => r.task_code.trim() || r.id != null)
          .map((r) => ({
            task_source: 'REFERENCE',
            ...(r.id != null ? { id: r.id } : { task_code: r.task_code.trim() }),
          })),
      ];

      await saveYeuCauProcess(selectedRequestId, activeEditorProcessCode, {
        master_payload: masterPayload,
        status_payload: processDraft,
        ref_tasks: refTasksPayload,
      });
      bumpDataVersion();
      notify('success', 'Cập nhật trạng thái', 'Đã cập nhật thông tin trạng thái.');
    } catch (e: unknown) {
      if (!isRequestCanceledError(e)) {
        notify(
          'error',
          'Cập nhật trạng thái thất bại',
          e instanceof Error ? e.message : 'Không thể cập nhật trạng thái.'
        );
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    canWriteRequests,
    isCreateMode,
    selectedRequestId,
    activeEditorProcessCode,
    masterFields,
    masterDraft,
    processDraft,
    formIt360Tasks,
    formReferenceTasks,
    bumpDataVersion,
    notify,
  ]);

  const handleDeleteCase = useCallback(async () => {
    if (!canDeleteRequests || !selectedRequestId) return;
    const row = patchedListRows.find((r) => String(r.id) === String(selectedRequestId));
    const label = row?.ma_yc ?? row?.request_code ?? String(selectedRequestId);
    if (!window.confirm(`Xóa yêu cầu ${label}?`)) return;
    try {
      await deleteYeuCau(selectedRequestId);
      setSelectedRequestId(null);
      setSelectedRequestPreview(null);
      setIsCreateMode(false);
      bumpDataVersion();
      notify('success', 'Xóa yêu cầu', 'Đã xóa yêu cầu.');
    } catch (e: unknown) {
      notify(
        'error',
        'Xóa yêu cầu thất bại',
        e instanceof Error ? e.message : 'Không thể xóa.'
      );
    }
  }, [canDeleteRequests, selectedRequestId, patchedListRows, bumpDataVersion, notify]);

  const handleUpdateCase = useCallback(async () => {
    if (!canWriteRequests || !selectedRequestId || !activeEditorProcessCode) return;
    try {
      setIsSaving(true);

      const normalizedTags = formTags
        .map((tag) => ({
          name: String(tag.name ?? '').trim().toLowerCase(),
          color: String(tag.color ?? '').trim().toLowerCase() || 'blue',
        }))
        .filter((tag) => tag.name.length > 0);

      // Build attachments payload
      const attachmentsPayload = formAttachments
        .filter((a) => a.id)
        .map((a) => ({ id: a.id }));

      // Build ref_tasks payload (IT360 + Reference tasks)
      const refTasksPayload: Array<Record<string, unknown>> = [
        ...formIt360Tasks
          .filter((r) => r.task_code.trim())
          .map((r) => ({
            task_source: 'IT360',
            task_code: r.task_code.trim(),
            task_link: r.task_link || null,
            task_status: r.status,
            ...(r.id != null ? { id: r.id } : {}),
          })),
        ...formReferenceTasks
          .filter((r) => r.task_code.trim() || r.id != null)
          .map((r) => ({
            task_source: 'REFERENCE',
            task_code: r.task_code.trim(),
          })),
      ];

      const payload: Record<string, unknown> = {
        ...buildPayloadFromDraft(masterFields, masterDraft),
        ...processDraft,
        ...(attachmentsPayload.length > 0 ? { attachments: attachmentsPayload } : {}),
        ...(refTasksPayload.length > 0 ? { ref_tasks: refTasksPayload } : {}),
        ...(selectedWorkflowId ? { workflow_definition_id: selectedWorkflowId } : {}),
      };

      const updated = await saveYeuCauProcess(selectedRequestId, activeEditorProcessCode, payload);
      setSelectedRequestPreview(updated);

      if (selectedRequestId != null) {
        try {
          const savedTags = await saveYeuCauCaseTags(selectedRequestId, normalizedTags);
          setFormTags(savedTags);
        } catch (error: unknown) {
          notify(
            'warning',
            'Cập nhật tags chưa hoàn tất',
            error instanceof Error ? error.message : 'Không thể đồng bộ tags.'
          );
        }
      }

      bumpDataVersion();
      notify('success', 'Cập nhật yêu cầu', 'Đã cập nhật yêu cầu.');
    } catch (e: unknown) {
      notify(
        'error',
        'Cập nhật yêu cầu thất bại',
        e instanceof Error ? e.message : 'Không thể cập nhật.'
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    canWriteRequests,
    selectedRequestId,
    activeEditorProcessCode,
    masterFields,
    masterDraft,
    processDraft,
    formAttachments,
    formIt360Tasks,
    formReferenceTasks,
    formTags,
    selectedWorkflowId,
    bumpDataVersion,
    notify,
    setFormTags,
  ]);

  const handleOpenTransitionModal = useCallback(() => {
    if (!transitionStatusCode) return;
    transitionHook.openTransitionModal({
      targetProcessMeta: processMap.get(transitionStatusCode) ?? null,
    });
  }, [transitionStatusCode, transitionHook, processMap]);

  const handleRunDispatcherAction = useCallback(
    (action: DispatcherQuickAction) => {
      setTransitionStatusCode(action.targetStatusCode);
      transitionHook.openTransitionModal({
        targetProcessMeta: processMap.get(action.targetStatusCode) ?? null,
        payloadOverrides: action.payloadOverrides,
        notes: action.notePreset,
      });
    },
    [transitionHook, processMap]
  );

  const handleRunPerformerAction = useCallback(
    (action: PerformerQuickAction) => {
      setTransitionStatusCode(action.targetStatusCode);
      transitionHook.openTransitionModal({
        targetProcessMeta: processMap.get(action.targetStatusCode) ?? null,
        payloadOverrides: action.payloadOverrides,
        notes: action.notePreset,
      });
    },
    [transitionHook, processMap]
  );

  const handleRunListPrimaryAction = useCallback(
    (row: YeuCau, action: CustomerRequestPrimaryActionMeta) => {
      const isCurrentSelection =
        !isCreateMode &&
        selectedRequestId !== null &&
        String(selectedRequestId) === String(row.id) &&
        String(processDetail?.yeu_cau?.id ?? '') === String(row.id);

      if (action.kind === 'detail' && !action.targetStatusCode) {
        if (!isCurrentSelection) {
          handleSelectRow(row);
        }
        return;
      }

      if (isCurrentSelection && runPrimaryActionForLoadedRequest(action)) {
        return;
      }

      handleSelectRow(row);
      setPendingPrimaryAction({ requestId: String(row.id), action });
    },
    [
      handleSelectRow,
      isCreateMode,
      processDetail?.yeu_cau?.id,
      runPrimaryActionForLoadedRequest,
      selectedRequestId,
    ]
  );

  const handleModalStatusPayloadChange = useCallback(
    (fieldName: string, value: unknown) => {
      transitionHook.setModalStatusPayload((prev) => ({ ...prev, [fieldName]: value }));
    },
    [transitionHook]
  );

  // Status count helper for dashboard cards
  const getStatusCount = useCallback(
    (statusCode: string): number => {
      if (!patchedOverviewDashboard) return 0;
      const found = patchedOverviewDashboard.summary.status_counts.find(
        (s) => s.status_code === statusCode
      );
      return found?.count ?? 0;
    },
    [patchedOverviewDashboard]
  );

  // Alert counts
  const alertCounts = useMemo(
    () => ({
      missing_estimate:
        patchedOverviewDashboard?.summary?.alert_counts?.missing_estimate ?? 0,
      over_estimate:
        patchedOverviewDashboard?.summary?.alert_counts?.over_estimate ?? 0,
      sla_risk: patchedOverviewDashboard?.summary?.alert_counts?.sla_risk ?? 0,
    }),
    [patchedOverviewDashboard]
  );

  // Customer options for list pane filter
  const customerOptions = useMemo<SearchableSelectOption[]>(
    () =>
      customers.map((c) => {
        const raw = c as unknown as Record<string, unknown>;
        const displayLabel = String(
          c.customer_name ||
            raw.name ||
            raw.company_name ||
            `Khách hàng #${c.id}`
        );
        return {
          value: String(c.id),
          label: displayLabel,
          searchText: [
            c.customer_name,
            c.customer_code,
            c.tax_code,
            raw.name,
            raw.company_name,
            c.id,
          ]
            .filter(Boolean)
            .join(' '),
        };
      }),
    [customers]
  );

  const pinnedRequestIds = useMemo(
    () => new Set(pinnedItems.map((item) => String(item.requestId))),
    [pinnedItems]
  );

  const selectedRequestSummary = useMemo<YeuCau | null>(() => {
    if (!selectedRequestId) {
      return null;
    }

    const detailRequest = processDetail?.yeu_cau ?? null;
    const previewRequest =
      selectedRequestPreview && String(selectedRequestPreview.id) === String(selectedRequestId)
        ? selectedRequestPreview
        : null;
    const matchedDetailRequest =
      detailRequest && String(detailRequest.id) === String(selectedRequestId)
        ? detailRequest
        : null;

    return (
      patchedListRows.find((row) => String(row.id) === String(selectedRequestId)) ??
      matchedDetailRequest ??
      getPatchedRequest(previewRequest) ??
      null
    );
  }, [
    getPatchedRequest,
    patchedListRows,
    processDetail?.yeu_cau,
    selectedRequestId,
    selectedRequestPreview,
  ]);

  const dashboardRoleFilter = workspaceTabToRoleFilter(activeWorkspaceTab);

  const hasListFilters =
    !!(
      activeProcessCode ||
      requestKeyword ||
      requestCustomerFilter ||
      requestSupportGroupFilter ||
      requestPriorityFilter ||
      (requestRoleFilter &&
        requestRoleFilter !==
          (activeSurface === 'analytics'
            ? workspaceTabToRoleFilter(activeWorkspaceTab)
            : workspaceTabToRoleFilter(activeWorkspaceTab))) ||
      requestMissingEstimateFilter ||
      requestOverEstimateFilter ||
      requestSlaRiskFilter
    );

  const handleClearFilters = useCallback(() => {
    const defaultRoleFilter = workspaceTabToRoleFilter(activeWorkspaceTab);
    setActiveProcessCode('');
    setRequestKeyword('');
    setRequestCustomerFilter('');
    setRequestSupportGroupFilter('');
    setRequestPriorityFilter('');
    setRequestRoleFilter(defaultRoleFilter);
    setRequestMissingEstimateFilter(false);
    setRequestOverEstimateFilter(false);
    setRequestSlaRiskFilter(false);
    setListPage(1);
  }, [activeWorkspaceTab]);

  useEffect(() => {
    if (activeSurface === 'analytics') {
      return;
    }

    const defaultRoleFilter = workspaceTabToRoleFilter(activeWorkspaceTab);
    setRequestRoleFilter((prev) => (prev === defaultRoleFilter ? prev : defaultRoleFilter));
  }, [activeSurface, activeWorkspaceTab]);

  useEffect(() => {
    if (!activeSavedViewId) {
      return;
    }

    const activeView = DEFAULT_CUSTOMER_REQUEST_SAVED_VIEWS.find(
      (view) => view.id === activeSavedViewId
    );

    if (!activeView) {
      setActiveSavedViewId(null);
      return;
    }

    const filters = activeView.filters ?? {};
    const matches =
      activeWorkspaceTab === activeView.workspaceTab &&
      activeSurface === activeView.surface &&
      activeProcessCode === (filters.processCode ?? '') &&
      requestKeyword === (filters.keyword ?? '') &&
      requestCustomerFilter === (filters.customerId ?? '') &&
      requestSupportGroupFilter === (filters.supportGroupId ?? '') &&
      requestPriorityFilter === (filters.priority ?? '') &&
      requestRoleFilter ===
        (filters.roleFilter ?? workspaceTabToRoleFilter(activeView.workspaceTab)) &&
      requestMissingEstimateFilter === Boolean(filters.missingEstimate) &&
      requestOverEstimateFilter === Boolean(filters.overEstimate) &&
      requestSlaRiskFilter === Boolean(filters.slaRisk);

    if (!matches) {
      setActiveSavedViewId(null);
    }
  }, [
    activeProcessCode,
    activeSavedViewId,
    activeSurface,
    activeWorkspaceTab,
    requestCustomerFilter,
    requestKeyword,
    requestMissingEstimateFilter,
    requestOverEstimateFilter,
    requestPriorityFilter,
    requestRoleFilter,
    requestSlaRiskFilter,
    requestSupportGroupFilter,
  ]);

  // Creator workspace name
  const creatorName = useMemo(() => {
    if (!currentUserId) return null;
    const user = employees.find((e) => String(e.id) === String(currentUserId));
    return user?.full_name ?? null;
  }, [employees, currentUserId]);

  const handleTransitionStatusCodeChange = useCallback((value: string) => {
    setTransitionStatusCode(value);
  }, []);

  const handleCreateFlowDraftChange = useCallback(
    (patch: Partial<CustomerRequestCreateFlowDraft>) => {
      setCreateFlowDraft((prev) => ({ ...prev, ...patch }));
    },
    []
  );

  const handleOpenWorklogModal = useCallback(() => {
    setShowWorklogModal(true);
  }, []);

  const handleCloseWorklogModal = useCallback(() => {
    setShowWorklogModal(false);
  }, []);

  const handleOpenEstimateModal = useCallback(() => {
    setShowEstimateModal(true);
  }, []);

  const handleCloseEstimateModal = useCallback(() => {
    setShowEstimateModal(false);
  }, []);

  const handleSurfaceChange = useCallback((surface: CustomerRequestSurfaceKey) => {
    setActiveSurface(surface);
    setActiveSavedViewId(null);
  }, []);

  const handleToggleSelectedRequestPin = useCallback(() => {
    if (selectedRequestSummary) {
      handleTogglePinnedRequest(selectedRequestSummary);
    }
  }, [handleTogglePinnedRequest, selectedRequestSummary]);

  const noopOpenCreatorFeedbackModal = useCallback(() => undefined, []);
  const noopOpenNotifyCustomerModal = useCallback(() => undefined, []);

  const handleRemoveModalIt360Task = useCallback(
    (localId: string) => {
      transitionHook.setModalIt360Tasks((prev) =>
        prev.filter((task) => task.local_id !== localId)
      );
    },
    [transitionHook]
  );

  const handleRemoveModalReferenceTask = useCallback(
    (localId: string) => {
      transitionHook.setModalRefTasks((prev) =>
        prev.filter((task) => task.local_id !== localId)
      );
    },
    [transitionHook]
  );

  const handleDeleteModalAttachment = useCallback(
    (id: string) => {
      transitionHook.setModalAttachments((prev) =>
        prev.filter((attachment) => String(attachment.id) !== String(id))
      );
    },
    [transitionHook]
  );

  const handleCloseCreateMode = useCallback(() => {
    setIsCreateMode(false);
    setSelectedRequestId(null);
  }, []);

  // -------------------------------------------------------------------------
  // 12. Render
  // -------------------------------------------------------------------------

  /* Shared ListPane props */
  const listPaneProps = {
    activeProcessCode,
    processOptions,
    onProcessCodeChange: (v: string) => { setActiveProcessCode(v); setListPage(1); },
    requestKeyword,
    onRequestKeywordChange: (v: string) => { setRequestKeyword(v); setListPage(1); },
    requestCustomerFilter,
    onRequestCustomerFilterChange: (v: string) => { setRequestCustomerFilter(v); setListPage(1); },
    requestSupportGroupFilter,
    onRequestSupportGroupFilterChange: (v: string) => { setRequestSupportGroupFilter(v); setListPage(1); },
    requestPriorityFilter,
    onRequestPriorityFilterChange: (v: string) => { setRequestPriorityFilter(v); setListPage(1); },
    customerOptions,
    supportServiceGroups,
    requestMissingEstimateFilter,
    onToggleMissingEstimate: () => { setRequestMissingEstimateFilter((x) => !x); setListPage(1); },
    requestOverEstimateFilter,
    onToggleOverEstimate: () => { setRequestOverEstimateFilter((x) => !x); setListPage(1); },
    requestSlaRiskFilter,
    onToggleSlaRisk: () => { setRequestSlaRiskFilter((x) => !x); setListPage(1); },
    alertCounts,
    isDashboardLoading,
    rows: patchedListRows,
    isListLoading,
    selectedRequestId,
    onSelectRow: handleSelectRow,
    listPage,
    rowsPerPage: listPageSize,
    listMeta,
    onListPageChange: (page: number) => setListPage(page),
    onRowsPerPageChange: (rows: number) => {
      setListPageSize(rows);
      setListPage(1);
    },
    hasListFilters,
    onClearFilters: handleClearFilters,
    requestRoleFilter,
    presentation: 'responsive' as const,
    pinnedRequestIds,
    onTogglePinRequest: handleTogglePinnedRequest,
    onPrimaryAction: handleRunListPrimaryAction,
  } as const;

  const detailPaneNode = (
    <CustomerRequestDetailPane
      isDetailLoading={isDetailLoading}
      isListLoading={isListLoading}
      isCreateMode={false}
      isRequestSelected={selectedRequestId !== null}
      processDetail={processDetail}
      canTransitionActiveRequest={canTransitionActiveRequest}
      transitionOptions={transitionOptions}
      transitionStatusCode={transitionStatusCode}
      onTransitionStatusCodeChange={(v) => setTransitionStatusCode(v)}
      onOpenTransitionModal={handleOpenTransitionModal}
      isSaving={isSaving}
      canEditActiveForm={canEditActiveForm}
      onSaveRequest={handleUpdateCase}
      masterFields={masterFields}
      masterDraft={masterDraft}
      onMasterFieldChange={handleMasterFieldChange}
      editorProcessMeta={activeEditorMeta}
      processDraft={processDraft}
      onProcessDraftChange={handleProcessDraftChange}
      onSaveStatusDetail={handleSaveStatusDetail}
      customers={customers}
      employees={employees}
      customerPersonnel={customerPersonnel}
      supportServiceGroups={supportServiceGroups}
      availableProjectItems={effectiveProjectItems}
      selectedProjectItem={selectedProjectItem}
      selectedCustomerId={selectedCustomerId}
      activeTaskTab={activeTaskTab}
      onActiveTaskTabChange={setActiveTaskTab}
      onAddTaskRow={handleAddTaskRow}
      formIt360Tasks={formIt360Tasks}
      onUpdateIt360TaskRow={handleUpdateIt360Row}
      onRemoveIt360TaskRow={handleRemoveIt360Row}
      formReferenceTasks={formReferenceTasks}
      formTags={formTags}
      onFormTagsChange={setFormTags}
      taskReferenceOptions={taskReferenceOptions}
      onUpdateReferenceTaskRow={handleUpdateRefRow}
      onTaskReferenceSearchTermChange={setSearchKeyword}
      taskReferenceSearchTerm={searchKeyword}
      taskReferenceSearchError={searchError}
      isTaskReferenceSearchLoading={isSearchLoading}
      onRemoveReferenceTaskRow={handleRemoveRefRow}
      formAttachments={formAttachments}
      onUploadAttachment={handleUploadAttachment}
      onDeleteAttachment={handleDeleteAttachment}
      isUploadingAttachment={isUploadingAttachment}
      attachmentError={attachmentError}
      attachmentNotice={attachmentNotice}
      relatedSummaryItems={relatedSummaryItems}
      currentHoursReport={currentHoursReport}
      estimateHistory={estimateHistory}
      timeline={timeline}
      caseWorklogs={caseWorklogs}
      canOpenCreatorFeedbackModal={false}
      onOpenCreatorFeedbackModal={() => undefined}
      canOpenNotifyCustomerModal={false}
      onOpenNotifyCustomerModal={() => undefined}
      canOpenWorklogModal={canOpenWorklogModal}
      onOpenWorklogModal={() => setShowWorklogModal(true)}
      isSubmittingWorklog={isSubmittingWorklog}
      canOpenEstimateModal={canOpenEstimateModal}
      onOpenEstimateModal={() => setShowEstimateModal(true)}
      isSubmittingEstimate={isSubmittingEstimate}
      dispatcherQuickActions={dispatcherQuickActions}
      onRunDispatcherAction={handleRunDispatcherAction}
      performerQuickActions={performerQuickActions}
      onRunPerformerAction={handleRunPerformerAction}
    />
  );

  const showDetailModal = selectedRequestId !== null;

  return (
    <div className="p-3 pb-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>support_agent</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal leading-tight">Quản lý yêu cầu khách hàng</h2>
            <p className="text-[11px] text-slate-400 leading-tight">Theo dõi và xử lý các yêu cầu từ khách hàng</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdminViewer && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/15 text-tertiary">
              Chế độ xem quản trị
            </span>
          )}
          {canWriteRequests && (
            <button
              type="button"
              onClick={handleCreateRequest}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-colors text-white shadow-sm disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#004481,#005BAA)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              Thêm yêu cầu
            </button>
          )}
        </div>
      </div>

      {/* Sticky header: Workspace tabs + Surface switch + Refresh button */}
      <div className="sticky top-0 z-40 space-y-3 bg-white/95 backdrop-blur-sm">
        <CustomerRequestWorkspaceTabs
          activeTab={activeWorkspaceTab}
          onTabChange={handleWorkspaceTabChange}
          overviewActionCount={patchedOverviewDashboard?.attention_cases.length ?? 0}
          creatorActionCount={patchedCreatorBuckets.reviewRows.length + patchedCreatorBuckets.notifyRows.length}
          dispatcherActionCount={patchedDispatcherBuckets.queueRows.length + patchedDispatcherBuckets.returnedRows.length}
          performerActionCount={patchedPerformerBuckets.pendingRows.length}
          showPanels={activeSurface === 'inbox' && !isCreateMode}
          toolbar={
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
              <CustomerRequestSurfaceSwitch
                activeSurface={activeSurface}
                onSurfaceChange={(surface) => {
                  setActiveSurface(surface);
                  setActiveSavedViewId(null);
                }}
              />
              <button
                type="button"
                onClick={() => bumpDataVersion()}
                disabled={isDashboardLoading}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                title="Làm mới dữ liệu"
              >
                <span className={`material-symbols-outlined ${isDashboardLoading ? 'animate-spin' : ''}`} style={{ fontSize: 16 }}>
                  refresh
                </span>
                <span className="hidden sm:inline">Làm mới</span>
              </button>
            </div>
          }
        overviewWorkspace={
          <CustomerRequestOverviewWorkspace
            loading={isDashboardLoading}
            overviewDashboard={patchedOverviewDashboard}
            roleDashboards={patchedRoleDashboards}
            onOpenRequest={handleOpenRequest}
            onOpenWorkspace={handleOpenOverviewRoleWorkspace}
          />
        }
        creatorWorkspace={
          <CustomerRequestCreatorWorkspace
            loading={creatorWS.isLoading}
            creatorName={creatorName}
            totalRows={patchedCreatorRows.length}
            reviewRows={patchedCreatorBuckets.reviewRows}
            notifyRows={patchedCreatorBuckets.notifyRows}
            followUpRows={patchedCreatorBuckets.followUpRows}
            closedRows={patchedCreatorBuckets.closedRows}
            dashboard={patchedRoleDashboards.creator}
            onOpenRequest={handleOpenRequest}
            onCreateRequest={handleCreateRequest}
          />
        }
        dispatcherWorkspace={
          <CustomerRequestDispatcherWorkspace
            loading={dispatcherWS.isLoading}
            dispatcherName={currentUserName}
            totalRows={patchedDispatcherRows.length}
            queueRows={patchedDispatcherBuckets.queueRows}
            returnedRows={patchedDispatcherBuckets.returnedRows}
            feedbackRows={patchedDispatcherBuckets.feedbackRows}
            approvalRows={patchedDispatcherBuckets.approvalRows}
            activeRows={patchedDispatcherBuckets.activeRows}
            teamLoadRows={patchedDispatcherTeamLoadRows}
            pmWatchRows={patchedDispatcherPmWatchRows}
            dashboard={patchedRoleDashboards.dispatcher}
            onOpenRequest={handleOpenRequest}
          />
        }
        performerWorkspace={
          <CustomerRequestPerformerWorkspace
            loading={performerWS.isLoading}
            performerName={currentUserName}
            totalRows={patchedPerformerRows.length}
            pendingRows={patchedPerformerBuckets.pendingRows}
            activeRows={patchedPerformerBuckets.activeRows}
            timesheet={performerWS.timesheet}
            onOpenRequest={handleOpenRequest}
          />
        }
      />
      </div>

      <div ref={quickAccessAnchorRef} className={activeSurface === 'list' ? 'sticky top-[120px] z-30' : ''}>
        {shouldCollapseQuickAccessOnMobile ? (
          <div className="sticky top-[72px] z-20 mb-2 sm:hidden">
            <button
              type="button"
              onClick={handleRevealQuickAccess}
              aria-label="Lối tắt"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white/95 text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-slate-50"
            >
              <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: 15 }}>
                bookmark_manager
              </span>
              <span>Lối tắt</span>
            </button>
          </div>
        ) : (
          <CustomerRequestQuickAccessBar
            activeSurface={activeSurface}
            savedViews={DEFAULT_CUSTOMER_REQUEST_SAVED_VIEWS}
            activeSavedViewId={activeSavedViewId}
            onApplySavedView={handleApplySavedView}
            onClearSavedView={handleClearSavedView}
            pinnedItems={pinnedItems}
            recentItems={recentItems}
            onOpenRequest={handleOpenQuickAccessItem}
            onRemovePinned={removePinnedRequest}
          />
        )}
      </div>

      {/* ── Main area ──────────────────────────────────────────────────── */}
      {activeSurface === 'analytics' ? (
        <div>
        <CustomerRequestDashboardCards
          activeRoleFilter={dashboardRoleFilter}
          onRoleFilterChange={handleDashboardRoleFilterChange}
          overviewDashboard={patchedOverviewDashboard}
          roleDashboards={patchedRoleDashboards}
          isDashboardLoading={isDashboardLoading}
          activeProcessCode={activeProcessCode}
          onProcessCodeChange={(statusCode) => { setActiveProcessCode(statusCode); setListPage(1); }}
          getStatusCount={getStatusCount}
          onSelectAttentionCase={handleOpenRequest}
        />
        </div>
      ) : activeSurface === 'list' ? (
        <div className="h-[calc(100vh-240px)] flex-1 overflow-hidden">
          <CustomerRequestListPane {...listPaneProps} />
        </div>
      ) : null}

      {/* Detail modal — dùng một bề mặt duy nhất để hiển thị đủ thông tin
          cho mọi case đã chọn, thay cho inline pane / drawer cũ. */}
      {showDetailModal ? (
        <CustomerRequestDetailFrame
          mode="modal"
          request={selectedRequestSummary}
          isPinned={isPinnedRequest(selectedRequestSummary?.id)}
          onTogglePinned={() => {
            if (selectedRequestSummary) {
              handleTogglePinnedRequest(selectedRequestSummary);
            }
          }}
          onClose={handleCloseDetail}
        >
          {detailPaneNode}
        </CustomerRequestDetailFrame>
      ) : null}

      <CustomerRequestWorklogModal
        open={showWorklogModal}
        isSubmitting={isSubmittingWorklog}
        requestCode={selectedRequestSummary?.ma_yc ?? selectedRequestSummary?.request_code}
        requestSummary={selectedRequestSummary?.tieu_de ?? selectedRequestSummary?.summary}
        hoursReport={currentHoursReport}
        onClose={() => setShowWorklogModal(false)}
        onSubmit={handleSubmitWorklog}
      />

      <CustomerRequestEstimateModal
        open={showEstimateModal}
        isSubmitting={isSubmittingEstimate}
        requestCode={selectedRequestSummary?.ma_yc ?? selectedRequestSummary?.request_code}
        requestSummary={selectedRequestSummary?.tieu_de ?? selectedRequestSummary?.summary}
        hoursReport={currentHoursReport}
        latestEstimate={estimateHistory[0] ?? currentHoursReport?.latest_estimate ?? null}
        onClose={() => setShowEstimateModal(false)}
        onSubmit={handleSubmitEstimate}
      />

      {/* Transition modal */}
      <CustomerRequestTransitionModal
        show={transitionHook.showTransitionModal}
        processDetail={processDetail}
        transitionStatusCode={transitionStatusCode}
        transitionRenderableFields={transitionRenderableFields}
        modalStatusPayload={transitionHook.modalStatusPayload}
        onModalStatusPayloadChange={handleModalStatusPayloadChange}
        modalIt360Tasks={transitionHook.modalIt360Tasks}
        onAddModalIt360Task={transitionHook.addModalIt360Task}
        onUpdateModalIt360Task={transitionHook.updateModalIt360Task}
        onRemoveModalIt360Task={(localId) =>
          transitionHook.setModalIt360Tasks((prev) =>
            prev.filter((t) => t.local_id !== localId)
          )
        }
        modalRefTasks={transitionHook.modalRefTasks}
        onAddModalReferenceTask={transitionHook.addModalReferenceTask}
        onUpdateModalReferenceTask={transitionHook.updateModalReferenceTask}
        onRemoveModalReferenceTask={(localId) =>
          transitionHook.setModalRefTasks((prev) =>
            prev.filter((t) => t.local_id !== localId)
          )
        }
        modalAttachments={transitionHook.modalAttachments}
        onUploadModalAttachment={transitionHook.handleModalUpload}
        onDeleteModalAttachment={(id) =>
          transitionHook.setModalAttachments((prev) =>
            prev.filter((a) => String(a.id) !== String(id))
          )
        }
        isModalUploading={transitionHook.isModalUploading}
        modalNotes={transitionHook.modalNotes}
        onModalNotesChange={transitionHook.setModalNotes}
        modalActiveTaskTab={transitionHook.modalActiveTaskTab}
        onModalActiveTaskTabChange={transitionHook.setModalActiveTaskTab}
        isTransitioning={transitionHook.isTransitioning}
        onClose={transitionHook.closeTransitionModal}
        onConfirm={transitionHook.handleTransitionConfirm}
        modalTimeline={transitionHook.modalTimeline}
        modalHandlerUserId={transitionHook.modalHandlerUserId}
        onModalHandlerUserIdChange={transitionHook.setModalHandlerUserId}
        projectRaciRows={projectRaciRows}
        employees={employees}
        customers={customers}
        customerPersonnel={customerPersonnel}
        supportServiceGroups={supportServiceGroups}
        projectItems={effectiveProjectItems}
        selectedCustomerId={selectedCustomerId}
        taskReferenceOptions={taskReferenceOptions}
        taskReferenceSearchError={searchError}
        taskReferenceSearchTerm={searchKeyword}
        onTaskReferenceSearchTermChange={setSearchKeyword}
        isTaskReferenceSearchLoading={isSearchLoading}
        caseContextAttachments={formAttachments}
        caseContextIt360Tasks={formIt360Tasks}
        caseContextReferenceTasks={formReferenceTasks}
      />

      {/* ── Modal tạo mới yêu cầu ──────────────────────────────────── */}
      {isCreateMode && (
        <CustomerRequestCreateModal
          masterFields={masterFields}
          masterDraft={masterDraft}
          onMasterFieldChange={handleMasterFieldChange}
          customers={customers}
          employees={employees}
          customerPersonnel={customerPersonnel}
          supportServiceGroups={supportServiceGroups}
          projectItems={effectiveProjectItems}
          /* attachments */
          formAttachments={formAttachments}
          onUploadAttachment={handleUploadAttachment}
          onDeleteAttachment={handleDeleteAttachment}
          isUploadingAttachment={isUploadingAttachment}
          attachmentError={attachmentError}
          attachmentNotice={attachmentNotice}
          /* it360 tasks */
          formIt360Tasks={formIt360Tasks}
          onAddIt360Task={handleAddIt360Task}
          onUpdateIt360TaskRow={handleUpdateIt360Row}
          onRemoveIt360TaskRow={handleRemoveIt360Row}
          /* reference tasks */
          formReferenceTasks={formReferenceTasks}
          onAddReferenceTask={handleAddReferenceTask}
          onUpdateReferenceTaskRow={handleUpdateRefRow}
          onRemoveReferenceTaskRow={handleRemoveRefRow}
          taskReferenceOptions={taskReferenceOptions}
          taskReferenceSearchTerm={searchKeyword}
          onTaskReferenceSearchTermChange={setSearchKeyword}
          taskReferenceSearchError={searchError}
          isTaskReferenceSearchLoading={isSearchLoading}
          /* tags */
          formTags={createFormTags}
          onTagsChange={setCreateFormTags}
          isSaving={isSaving}
          onSave={handleSaveCase}
          onClose={() => {
            setIsCreateMode(false);
            setSelectedRequestId(null);
          }}
        />
      )}
    </div>
  );
};
