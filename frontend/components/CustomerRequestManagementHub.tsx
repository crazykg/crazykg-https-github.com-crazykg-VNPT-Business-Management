import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createYeuCauEstimate,
  deleteYeuCau,
  fetchCustomerRequestProjectItems,
  fetchYeuCau,
  fetchYeuCauProcessCatalog,
  isRequestCanceledError,
  storeYeuCauWorklog,
  uploadDocumentAttachment,
} from '../services/v5Api';
import { useCreateCRC } from '../shared/hooks/useCustomerRequests';
import type {
  Attachment,
  Customer,
  CustomerPersonnel,
  Employee,
  ProjectItemMaster,
  ProjectRaciRow,
  SupportServiceGroup,
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
import { CustomerRequestPmMissingInfoDecisionModal } from './customer-request/CustomerRequestPmMissingInfoDecisionModal';
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
  buildXmlAlignedTransitionOptionsForRequest,
  filterXmlVisibleProcesses,
  isPmMissingCustomerInfoDecisionProcessCode,
  isXmlVisibleProcessCode,
  resolveRequestProcessCode,
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
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmittingWorklog, setIsSubmittingWorklog] = useState(false);
  const [isSubmittingEstimate, setIsSubmittingEstimate] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [attachmentNotice, setAttachmentNotice] = useState('');
  const [scopedProjectItems, setScopedProjectItems] = useState<ProjectItemMaster[]>([]);
  const [showWorklogModal, setShowWorklogModal] = useState(false);
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [showPmMissingInfoDecisionModal, setShowPmMissingInfoDecisionModal] = useState(false);
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
    () => transitionProcessMeta?.form_fields ?? [],
    [transitionProcessMeta]
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

  // Task reference options (from searchResults)
  const taskReferenceOptions = useMemo<SearchableSelectOption[]>(
    () =>
      searchResults.map((r) => ({
        value: r.request_code ?? String(r.id),
        label: r.request_code
          ? `${r.request_code} — ${r.summary ?? r.label ?? ''}`
          : String(r.id),
        searchText: `${r.request_code ?? ''} ${r.summary ?? ''} ${r.customer_name ?? ''} ${r.project_name ?? ''}`,
      })),
    [searchResults]
  );

  // Task reference lookup for transition hook
  const taskReferenceLookup = useMemo(() => {
    const map = new Map<string, { id?: string | number | null; task_code: string }>();
    searchResults.forEach((r) => {
      const code = r.request_code ?? String(r.id);
      map.set(code, { id: r.id, task_code: code });
    });
    return map;
  }, [searchResults]);

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
      include_project_item_id: masterDraft.project_item_id ?? null,
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

  const transitionOptions = useMemo<YeuCauProcessMeta[]>(
    () =>
      buildXmlAlignedTransitionOptionsForRequest(
        processDetail?.allowed_next_processes ?? [],
        processDetail?.yeu_cau ?? null
      ),
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
    !isCreateMode && !!selectedRequestId && transitionOptions.length > 0;

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
    return [
      { label: 'Mã yêu cầu', value: (yc.ma_yc ?? yc.request_code) as string | null | undefined },
      { label: 'Khách hàng', value: (yc.customer_name ?? yc.khach_hang_name) as string | null | undefined },
      { label: 'Dự án', value: raw.project_name as string | null | undefined },
      { label: 'Người tiếp nhận', value: yc.received_by_name },
      { label: 'Người điều phối', value: yc.dispatcher_name },
      { label: 'Người xử lý', value: yc.performer_name },
    ].filter((item): item is { label: string; value: string } => !!item.value);
  }, [processDetail]);

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
      setActiveEditorProcessCode(statusCode);
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
    setShowPmMissingInfoDecisionModal(false);
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
    setIsCreateMode(true);
    setActiveEditorProcessCode('new_intake');
    setTransitionStatusCode('');
    setShowPmMissingInfoDecisionModal(false);
    setCreateFlowDraft(buildInitialCreateFlowDraft(currentUserId));
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
    setShowPmMissingInfoDecisionModal(false);
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
      setFormReferenceTasks((prev) =>
        prev.map((r) => (r.local_id === localId ? { ...r, task_code: value } : r))
      );
    },
    [setFormReferenceTasks]
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
    async (id: string) => {
      setFormAttachments((prev) => prev.filter((a) => String(a.id) !== id));
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
      };

      const created = await createCRCHook.mutateAsync(payload);
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

      setIsCreateMode(false);
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

  const handleOpenTransitionModal = useCallback(() => {
    if (!transitionStatusCode) return;
    if (isPmMissingCustomerInfoDecisionProcessCode(transitionStatusCode)) {
      setShowPmMissingInfoDecisionModal(true);
      return;
    }
    transitionHook.openTransitionModal({
      targetProcessMeta: processMap.get(transitionStatusCode) ?? null,
    });
  }, [transitionStatusCode, transitionHook, processMap]);

  const handleRunDispatcherAction = useCallback(
    (action: DispatcherQuickAction) => {
      setTransitionStatusCode(action.targetStatusCode);
      if (isPmMissingCustomerInfoDecisionProcessCode(action.targetStatusCode)) {
        setShowPmMissingInfoDecisionModal(true);
        return;
      }
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

  const handleChoosePmMissingInfoTarget = useCallback(
    (targetStatusCode: 'waiting_customer_feedback' | 'not_executed') => {
      setShowPmMissingInfoDecisionModal(false);
      setTransitionStatusCode(targetStatusCode);
      const sourceStatusCode = resolveRequestProcessCode(processDetail?.yeu_cau ?? {}) || 'new_intake';
      transitionHook.openTransitionModal({
        targetProcessMeta: processMap.get(targetStatusCode) ?? null,
        payloadOverrides: {
          decision_context_code: 'pm_missing_customer_info_review',
          decision_outcome_code:
            targetStatusCode === 'waiting_customer_feedback'
              ? 'customer_missing_info'
              : 'other_reason',
          decision_source_status_code: sourceStatusCode,
        },
        notes:
          targetStatusCode === 'waiting_customer_feedback'
            ? 'PM xác nhận yêu cầu đang thiếu thông tin từ khách hàng.'
            : 'PM xác nhận yêu cầu không thực hiện vì lý do khác, không phải thiếu thông tin từ khách hàng.',
      });
    },
    [processDetail?.yeu_cau, processMap, transitionHook]
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

  const dashboardRoleFilter = useMemo(
    () => workspaceTabToRoleFilter(activeWorkspaceTab),
    [activeWorkspaceTab]
  );

  const hasListFilters = useMemo(
    () =>
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
      ),
    [
      activeProcessCode,
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
    ]
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

  const handleProcessCodeChange = useCallback((value: string) => {
    setActiveProcessCode(value);
    setListPage(1);
  }, []);

  const handleRequestKeywordChange = useCallback((value: string) => {
    setRequestKeyword(value);
    setListPage(1);
  }, []);

  const handleRequestCustomerFilterChange = useCallback((value: string) => {
    setRequestCustomerFilter(value);
    setListPage(1);
  }, []);

  const handleRequestSupportGroupFilterChange = useCallback((value: string) => {
    setRequestSupportGroupFilter(value);
    setListPage(1);
  }, []);

  const handleRequestPriorityFilterChange = useCallback((value: string) => {
    setRequestPriorityFilter(value);
    setListPage(1);
  }, []);

  const handleToggleMissingEstimate = useCallback(() => {
    setRequestMissingEstimateFilter((value) => !value);
    setListPage(1);
  }, []);

  const handleToggleOverEstimate = useCallback(() => {
    setRequestOverEstimateFilter((value) => !value);
    setListPage(1);
  }, []);

  const handleToggleSlaRisk = useCallback(() => {
    setRequestSlaRiskFilter((value) => !value);
    setListPage(1);
  }, []);

  const handleListPageChange = useCallback((page: number) => {
    setListPage(page);
  }, []);

  const handleRowsPerPageChange = useCallback((rows: number) => {
    setListPageSize(rows);
    setListPage(1);
  }, []);

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

  const handleClosePmMissingInfoDecisionModal = useCallback(() => {
    setShowPmMissingInfoDecisionModal(false);
  }, []);

  const handleChooseWaitingCustomerFeedback = useCallback(() => {
    handleChoosePmMissingInfoTarget('waiting_customer_feedback');
  }, [handleChoosePmMissingInfoTarget]);

  const handleChooseNotExecuted = useCallback(() => {
    handleChoosePmMissingInfoTarget('not_executed');
  }, [handleChoosePmMissingInfoTarget]);

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
  const listPaneProps = useMemo(
    () =>
      ({
        activeProcessCode,
        processOptions,
        onProcessCodeChange: handleProcessCodeChange,
        requestKeyword,
        onRequestKeywordChange: handleRequestKeywordChange,
        requestCustomerFilter,
        onRequestCustomerFilterChange: handleRequestCustomerFilterChange,
        requestSupportGroupFilter,
        onRequestSupportGroupFilterChange: handleRequestSupportGroupFilterChange,
        requestPriorityFilter,
        onRequestPriorityFilterChange: handleRequestPriorityFilterChange,
        customerOptions,
        supportServiceGroups,
        requestMissingEstimateFilter,
        onToggleMissingEstimate: handleToggleMissingEstimate,
        requestOverEstimateFilter,
        onToggleOverEstimate: handleToggleOverEstimate,
        requestSlaRiskFilter,
        onToggleSlaRisk: handleToggleSlaRisk,
        alertCounts,
        isDashboardLoading,
        rows: patchedListRows,
        isListLoading,
        selectedRequestId,
        onSelectRow: handleSelectRow,
        listPage,
        rowsPerPage: listPageSize,
        listMeta,
        onListPageChange: handleListPageChange,
        onRowsPerPageChange: handleRowsPerPageChange,
        hasListFilters,
        onClearFilters: handleClearFilters,
        requestRoleFilter,
        presentation: 'responsive' as const,
        pinnedRequestIds,
        onTogglePinRequest: handleTogglePinnedRequest,
        onPrimaryAction: handleRunListPrimaryAction,
      }) as const,
    [
      activeProcessCode,
      alertCounts,
      customerOptions,
      handleClearFilters,
      handleListPageChange,
      handleProcessCodeChange,
      handleRequestCustomerFilterChange,
      handleRequestKeywordChange,
      handleRequestPriorityFilterChange,
      handleRequestSupportGroupFilterChange,
      handleRowsPerPageChange,
      handleRunListPrimaryAction,
      handleSelectRow,
      handleToggleMissingEstimate,
      handleToggleOverEstimate,
      handleTogglePinnedRequest,
      handleToggleSlaRisk,
      hasListFilters,
      isDashboardLoading,
      isListLoading,
      listMeta,
      listPage,
      listPageSize,
      patchedListRows,
      pinnedRequestIds,
      processOptions,
      requestCustomerFilter,
      requestKeyword,
      requestMissingEstimateFilter,
      requestOverEstimateFilter,
      requestPriorityFilter,
      requestRoleFilter,
      requestSlaRiskFilter,
      requestSupportGroupFilter,
      selectedRequestId,
      supportServiceGroups,
    ]
  );

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
      onTransitionStatusCodeChange={handleTransitionStatusCodeChange}
      onOpenTransitionModal={handleOpenTransitionModal}
      isSaving={isSaving}
      canEditActiveForm={canEditActiveForm}
      masterFields={masterFields}
      masterDraft={masterDraft}
      onMasterFieldChange={handleMasterFieldChange}
      editorProcessMeta={activeEditorMeta}
      processDraft={processDraft}
      onProcessDraftChange={handleProcessDraftChange}
      customers={customers}
      employees={employees}
      customerPersonnel={customerPersonnel}
      supportServiceGroups={supportServiceGroups}
      availableProjectItems={effectiveProjectItems}
      selectedProjectItem={selectedProjectItem}
      selectedCustomerId={selectedCustomerId}
      currentUserName={currentUserName}
      createFlowDraft={createFlowDraft}
      onCreateFlowDraftChange={handleCreateFlowDraftChange}
      activeTaskTab={activeTaskTab}
      onActiveTaskTabChange={setActiveTaskTab}
      onAddTaskRow={handleAddTaskRow}
      formIt360Tasks={formIt360Tasks}
      onUpdateIt360TaskRow={handleUpdateIt360Row}
      onRemoveIt360TaskRow={handleRemoveIt360Row}
      formReferenceTasks={formReferenceTasks}
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
      onOpenCreatorFeedbackModal={noopOpenCreatorFeedbackModal}
      canOpenNotifyCustomerModal={false}
      onOpenNotifyCustomerModal={noopOpenNotifyCustomerModal}
      canOpenWorklogModal={canOpenWorklogModal}
      onOpenWorklogModal={handleOpenWorklogModal}
      isSubmittingWorklog={isSubmittingWorklog}
      canOpenEstimateModal={canOpenEstimateModal}
      onOpenEstimateModal={handleOpenEstimateModal}
      isSubmittingEstimate={isSubmittingEstimate}
      dispatcherQuickActions={dispatcherQuickActions}
      onRunDispatcherAction={handleRunDispatcherAction}
      performerQuickActions={performerQuickActions}
      onRunPerformerAction={handleRunPerformerAction}
    />
  );

  const showDetailModal = selectedRequestId !== null;

  return (
    <div className="space-y-3 px-3 py-3 md:space-y-5 md:px-5 md:py-5 xl:px-6 xl:py-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 md:items-center">
        <div>
          <h2 className="text-[1.7rem] font-semibold leading-tight tracking-tight text-slate-900 md:text-[2rem]">
            Quản lý yêu cầu khách hàng
          </h2>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          {isAdminViewer && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
              Chế độ xem quản trị
            </span>
          )}
          {canWriteRequests && (
            <button
              type="button"
              onClick={handleCreateRequest}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,118,110,0.18)] transition hover:bg-deep-teal md:gap-2 md:px-4"
            >
              <span className="material-symbols-outlined text-[16px] md:text-[18px]">add</span>
              Thêm yêu cầu
            </button>
          )}
        </div>
      </div>

      <CustomerRequestWorkspaceTabs
        activeTab={activeWorkspaceTab}
        onTabChange={handleWorkspaceTabChange}
        overviewActionCount={patchedOverviewDashboard?.attention_cases.length ?? 0}
        creatorActionCount={patchedCreatorBuckets.reviewRows.length + patchedCreatorBuckets.notifyRows.length}
        dispatcherActionCount={patchedDispatcherBuckets.queueRows.length + patchedDispatcherBuckets.returnedRows.length}
        performerActionCount={patchedPerformerBuckets.pendingRows.length}
        showPanels={activeSurface === 'inbox' && !isCreateMode}
        toolbar={
          <CustomerRequestSurfaceSwitch
            activeSurface={activeSurface}
            onSurfaceChange={handleSurfaceChange}
          />
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

      <div ref={quickAccessAnchorRef}>
        {shouldCollapseQuickAccessOnMobile ? (
          <div className="sticky top-[72px] z-20 mb-3 sm:hidden">
            <button
              type="button"
              onClick={handleRevealQuickAccess}
              aria-label="Lối tắt"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-[13px] font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
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
        <CustomerRequestDashboardCards
          activeRoleFilter={dashboardRoleFilter}
          onRoleFilterChange={handleDashboardRoleFilterChange}
          overviewDashboard={patchedOverviewDashboard}
          roleDashboards={patchedRoleDashboards}
          isDashboardLoading={isDashboardLoading}
          activeProcessCode={activeProcessCode}
          onProcessCodeChange={handleProcessCodeChange}
          getStatusCount={getStatusCount}
          onSelectAttentionCase={handleOpenRequest}
        />
      ) : activeSurface === 'list' ? (
        <div className="min-h-0">
          <div className="min-w-0">
            <CustomerRequestListPane {...listPaneProps} />
          </div>
        </div>
      ) : null}

      {/* Detail modal — dùng một bề mặt duy nhất để hiển thị đủ thông tin
          cho mọi case đã chọn, thay cho inline pane / drawer cũ. */}
      {showDetailModal ? (
        <CustomerRequestDetailFrame
          mode="modal"
          request={selectedRequestSummary}
          isPinned={isPinnedRequest(selectedRequestSummary?.id)}
          onTogglePinned={handleToggleSelectedRequestPin}
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
        onClose={handleCloseWorklogModal}
        onSubmit={handleSubmitWorklog}
      />

      <CustomerRequestEstimateModal
        open={showEstimateModal}
        isSubmitting={isSubmittingEstimate}
        requestCode={selectedRequestSummary?.ma_yc ?? selectedRequestSummary?.request_code}
        requestSummary={selectedRequestSummary?.tieu_de ?? selectedRequestSummary?.summary}
        hoursReport={currentHoursReport}
        latestEstimate={estimateHistory[0] ?? currentHoursReport?.latest_estimate ?? null}
        onClose={handleCloseEstimateModal}
        onSubmit={handleSubmitEstimate}
      />

      <CustomerRequestPmMissingInfoDecisionModal
        show={showPmMissingInfoDecisionModal}
        currentStatusCode={processDetail?.yeu_cau?.trang_thai ?? processDetail?.yeu_cau?.current_status_code}
        currentStatusLabel={processDetail?.yeu_cau?.current_status_name_vi}
        onClose={handleClosePmMissingInfoDecisionModal}
        onChooseWaitingCustomerFeedback={handleChooseWaitingCustomerFeedback}
        onChooseNotExecuted={handleChooseNotExecuted}
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
        onRemoveModalIt360Task={handleRemoveModalIt360Task}
        modalRefTasks={transitionHook.modalRefTasks}
        onAddModalReferenceTask={transitionHook.addModalReferenceTask}
        onUpdateModalReferenceTask={transitionHook.updateModalReferenceTask}
        onRemoveModalReferenceTask={handleRemoveModalReferenceTask}
        modalAttachments={transitionHook.modalAttachments}
        onUploadModalAttachment={transitionHook.handleModalUpload}
        onDeleteModalAttachment={handleDeleteModalAttachment}
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
        projectRaciRows={[]}
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
          createFlowDraft={createFlowDraft}
          onCreateFlowDraftChange={handleCreateFlowDraftChange}
          customers={customers}
          employees={employees}
          customerPersonnel={customerPersonnel}
          supportServiceGroups={supportServiceGroups}
          projectItems={effectiveProjectItems}
          currentUserName={currentUserName}
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
          isSaving={isSaving}
          onSave={handleSaveCase}
          onClose={handleCloseCreateMode}
        />
      )}
    </div>
  );
};
