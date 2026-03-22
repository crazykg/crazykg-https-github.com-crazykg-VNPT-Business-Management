import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createYeuCau,
  deleteYeuCau,
  fetchCustomerRequestProjectItems,
  fetchYeuCau,
  fetchYeuCauProcessCatalog,
  isRequestCanceledError,
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
import { useCustomerRequestPerformerWorkspace } from './customer-request/hooks/useCustomerRequestPerformerWorkspace';
import { useCustomerRequestTransition } from './customer-request/hooks/useCustomerRequestTransition';
import { useCustomerRequestSearch } from './customer-request/hooks/useCustomerRequestSearch';
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
import type { CustomerRequestCreateFlowDraft } from './customer-request/createFlow';
import { resolveCreateRequestPlan } from './customer-request/createFlow';
import type {
  CustomerRequestRoleFilter,
  CustomerRequestTaskSource,
  DispatcherQuickAction,
  It360TaskFormRow,
  PerformerQuickAction,
  ReferenceTaskFormRow,
} from './customer-request/presentation';
import { resolveRequestProcessCode } from './customer-request/presentation';
import { buildPayloadFromDraft } from './customer-request/helpers';
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

const DEFAULT_CREATE_FLOW_DRAFT: CustomerRequestCreateFlowDraft = {
  initialEstimatedHours: '',
  estimateNote: '',
  handlingMode: 'assign_dispatcher',
  performerUserId: '',
  dispatcherUserId: '',
};

const workspaceTabToRoleFilter = (
  tab: WorkspaceTabKey
): CustomerRequestRoleFilter => (tab === 'overview' ? '' : tab);

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
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [attachmentNotice, setAttachmentNotice] = useState('');
  const [scopedProjectItems, setScopedProjectItems] = useState<ProjectItemMaster[]>([]);

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

  // Transition state
  const [transitionStatusCode, setTransitionStatusCode] = useState('');

  // Task tab state (detail pane)
  const [activeTaskTab, setActiveTaskTab] = useState<CustomerRequestTaskSource>('IT360');

  // Create flow draft
  const [createFlowDraft, setCreateFlowDraft] =
    useState<CustomerRequestCreateFlowDraft>(DEFAULT_CREATE_FLOW_DRAFT);

  const {
    pinnedItems,
    recentItems,
    pushRecentRequest,
    togglePinnedRequest,
    removePinnedRequest,
    isPinnedRequest,
  } = useCustomerRequestQuickAccess(currentUserId);

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

  const processMap = useMemo<Map<string, YeuCauProcessMeta>>(() => {
    const map = new Map<string, YeuCauProcessMeta>();
    allProcesses.forEach((p) => map.set(p.process_code, p));
    return map;
  }, [allProcesses]);

  const processOptions = useMemo<SearchableSelectOption[]>(() => {
    const opts: SearchableSelectOption[] = [{ value: '', label: 'Tất cả' }];
    allProcesses.forEach((p) =>
      opts.push({ value: p.process_code, label: p.process_label })
    );
    return opts;
  }, [allProcesses]);

  const effectiveProjectItems = useMemo(() => {
    const merged = new Map<string, ProjectItemMaster>();
    [...projectItems, ...scopedProjectItems].forEach((item) => {
      merged.set(String(item.id), item);
    });
    return Array.from(merged.values());
  }, [projectItems, scopedProjectItems]);

  const newIntakeFields = useMemo<YeuCauProcessField[]>(
    () => processMap.get('new_intake')?.form_fields ?? [],
    [processMap]
  );

  const activeEditorMeta = useMemo<YeuCauProcessMeta | null>(
    () => processMap.get(activeEditorProcessCode) ?? null,
    [processMap, activeEditorProcessCode]
  );

  const transitionProcessMeta = useMemo<YeuCauProcessMeta | null>(
    () => (transitionStatusCode ? (processMap.get(transitionStatusCode) ?? null) : null),
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
    isDetailLoading,
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
    () => processDetail?.allowed_next_processes ?? [],
    [processDetail]
  );

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

  useEffect(() => {
    if (isCreateMode || !processDetail?.yeu_cau?.id) {
      return;
    }
    pushRecentRequest(processDetail.yeu_cau);
  }, [isCreateMode, processDetail?.yeu_cau, pushRecentRequest]);

  // Quick actions for dispatcher
  const DISPATCHER_ACTION_IDS: ReadonlyArray<DispatcherQuickAction['id']> = [
    'assign_performer',
    'request_feedback',
    'reject',
  ];

  const dispatcherQuickActions = useMemo<DispatcherQuickAction[]>(() => {
    if (!processDetail) return [];
    return processDetail.allowed_next_processes.slice(0, 3).map((process, idx) => ({
      id: DISPATCHER_ACTION_IDS[idx] ?? 'assign_performer',
      label: process.process_label,
      description: '',
      targetStatusCode: process.process_code,
      icon: 'arrow_forward',
      accentCls: 'bg-blue-100 text-blue-700',
    }));
  }, [processDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  // Quick actions for performer
  const PERFORMER_ACTION_IDS: ReadonlyArray<PerformerQuickAction['id']> = [
    'take_task',
    'complete_task',
    'return_to_manager',
  ];

  const performerQuickActions = useMemo<PerformerQuickAction[]>(() => {
    if (!processDetail) return [];
    return processDetail.allowed_next_processes.slice(0, 3).map((process, idx) => ({
      id: PERFORMER_ACTION_IDS[idx] ?? 'take_task',
      label: process.process_label,
      description: '',
      targetStatusCode: process.process_code,
      icon: 'check',
      accentCls: 'bg-green-100 text-green-700',
    }));
  }, [processDetail]); // eslint-disable-line react-hooks/exhaustive-deps

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

    appendRows(listRows);
    appendRows(creatorWS.creatorRows);
    appendRows(dispatcherWS.dispatcherRows);
    appendRows(performerWS.performerRows);
    appendAttentionCases(overviewDashboard);
    appendAttentionCases(roleDashboards.creator);
    appendAttentionCases(roleDashboards.dispatcher);
    appendAttentionCases(roleDashboards.performer);

    return map;
  }, [
    creatorWS.creatorRows,
    dispatcherWS.dispatcherRows,
    listRows,
    overviewDashboard,
    performerWS.performerRows,
    roleDashboards.creator,
    roleDashboards.dispatcher,
    roleDashboards.performer,
  ]);

  const handleOpenRequest = useCallback(
    async (requestId: string | number, statusCode?: string | null) => {
      const lookupKey = String(requestId);
      const knownRow = requestLookup.get(lookupKey) ?? null;
      const listRow = listRows.find((r) => String(r.id) === lookupKey) ?? null;

      if (listRow) {
        handleSelectRow(listRow);
        return;
      }

      setSelectedRequestId(requestId);
      setSelectedRequestPreview(knownRow);
      setIsCreateMode(false);
      setActiveSurface('list');
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
      listRows,
      notify,
      pushRecentRequest,
      requestLookup,
      setProcessDetail,
    ]
  );

  const handleCreateRequest = useCallback(() => {
    setSelectedRequestId(null);
    setSelectedRequestPreview(null);
    setIsCreateMode(true);
    setActiveEditorProcessCode('new_intake');
    setTransitionStatusCode('');
    setCreateFlowDraft({ ...DEFAULT_CREATE_FLOW_DRAFT });
    setActiveSavedViewId(null);
  }, []);

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
    setTransitionStatusCode('');
  }, []);

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

      const created = await createYeuCau(payload);
      const createdRaw = created as unknown as Record<string, unknown>;
      setIsCreateMode(false);
      setSelectedRequestId(created.id);
      setSelectedRequestPreview(created);
      setActiveEditorProcessCode(
        resolveRequestProcessCode(createdRaw) || 'new_intake'
      );
      // bumpDataVersion triggers useCustomerRequestDetail to reload detail
      // (GET rehydrate) and populate formAttachments/formIt360Tasks/formReferenceTasks
      // with persisted data from server — see §4.5 frontend create-flow complete.
      bumpDataVersion();
      notify(
        'success',
        'Tạo yêu cầu',
        `Đã tạo yêu cầu ${created.ma_yc ?? created.request_code ?? ''}`
      );
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
    const row = listRows.find((r) => String(r.id) === String(selectedRequestId));
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
  }, [canDeleteRequests, selectedRequestId, listRows, bumpDataVersion, notify]);

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

  const handleModalStatusPayloadChange = useCallback(
    (fieldName: string, value: unknown) => {
      transitionHook.setModalStatusPayload((prev) => ({ ...prev, [fieldName]: value }));
    },
    [transitionHook]
  );

  // Status count helper for dashboard cards
  const getStatusCount = useCallback(
    (statusCode: string): number => {
      if (!overviewDashboard) return 0;
      const found = overviewDashboard.summary.status_counts.find(
        (s) => s.status_code === statusCode
      );
      return found?.count ?? 0;
    },
    [overviewDashboard]
  );

  // Alert counts
  const alertCounts = useMemo(
    () => ({
      missing_estimate:
        overviewDashboard?.summary?.alert_counts?.missing_estimate ?? 0,
      over_estimate:
        overviewDashboard?.summary?.alert_counts?.over_estimate ?? 0,
      sla_risk: overviewDashboard?.summary?.alert_counts?.sla_risk ?? 0,
    }),
    [overviewDashboard]
  );

  // Customer options for list pane filter
  const customerOptions = useMemo<SearchableSelectOption[]>(
    () =>
      customers.map((c) => {
        const raw = c as unknown as Record<string, unknown>;
        return {
          value: String(c.id),
          label: String(raw.name ?? raw.company_name ?? c.id),
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
      listRows.find((row) => String(row.id) === String(selectedRequestId)) ??
      matchedDetailRequest ??
      previewRequest ??
      null
    );
  }, [listRows, processDetail?.yeu_cau, selectedRequestId, selectedRequestPreview]);

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
    rows: listRows,
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
      onCreateFlowDraftChange={(patch) =>
        setCreateFlowDraft((prev) => ({ ...prev, ...patch }))
      }
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
      onOpenCreatorFeedbackModal={() => undefined}
      canOpenNotifyCustomerModal={false}
      onOpenNotifyCustomerModal={() => undefined}
      dispatcherQuickActions={dispatcherQuickActions}
      onRunDispatcherAction={handleRunDispatcherAction}
      performerQuickActions={performerQuickActions}
      onRunPerformerAction={handleRunPerformerAction}
    />
  );

  const showDetailModal = selectedRequestId !== null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900">
            Quản lý yêu cầu khách hàng
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {isAdminViewer && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              Chế độ xem quản trị
            </span>
          )}
          {canWriteRequests && (
            <button
              type="button"
              onClick={handleCreateRequest}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm shadow-primary/20 transition hover:bg-deep-teal"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Thêm yêu cầu
            </button>
          )}
        </div>
      </div>

      <CustomerRequestWorkspaceTabs
        activeTab={activeWorkspaceTab}
        onTabChange={handleWorkspaceTabChange}
        overviewActionCount={overviewDashboard?.attention_cases.length ?? 0}
        creatorActionCount={creatorWS.reviewRows.length + creatorWS.notifyRows.length}
        dispatcherActionCount={dispatcherWS.queueRows.length + dispatcherWS.returnedRows.length}
        performerActionCount={performerWS.pendingRows.length}
        showPanels={activeSurface === 'inbox' && !isCreateMode}
        toolbar={
          <CustomerRequestSurfaceSwitch
            activeSurface={activeSurface}
            onSurfaceChange={(surface) => {
              setActiveSurface(surface);
              setActiveSavedViewId(null);
            }}
          />
        }
        overviewWorkspace={
          <CustomerRequestOverviewWorkspace
            loading={isDashboardLoading}
            overviewDashboard={overviewDashboard}
            roleDashboards={roleDashboards}
            onOpenRequest={handleOpenRequest}
            onOpenWorkspace={handleOpenOverviewRoleWorkspace}
            onOpenAnalytics={() => setActiveSurface('analytics')}
          />
        }
        creatorWorkspace={
          <CustomerRequestCreatorWorkspace
            loading={creatorWS.isLoading}
            creatorName={creatorName}
            totalRows={creatorWS.creatorRows.length}
            reviewRows={creatorWS.reviewRows}
            notifyRows={creatorWS.notifyRows}
            followUpRows={creatorWS.followUpRows}
            closedRows={creatorWS.closedRows}
            dashboard={roleDashboards.creator}
            onOpenRequest={handleOpenRequest}
            onCreateRequest={handleCreateRequest}
          />
        }
        dispatcherWorkspace={
          <CustomerRequestDispatcherWorkspace
            loading={dispatcherWS.isLoading}
            dispatcherName={currentUserName}
            totalRows={dispatcherWS.dispatcherRows.length}
            queueRows={dispatcherWS.queueRows}
            returnedRows={dispatcherWS.returnedRows}
            feedbackRows={dispatcherWS.feedbackRows}
            approvalRows={dispatcherWS.approvalRows}
            activeRows={dispatcherWS.activeRows}
            teamLoadRows={dispatcherWS.teamLoadRows}
            pmWatchRows={dispatcherWS.pmWatchRows}
            dashboard={roleDashboards.dispatcher}
            onOpenRequest={handleOpenRequest}
          />
        }
        performerWorkspace={
          <CustomerRequestPerformerWorkspace
            loading={performerWS.isLoading}
            performerName={currentUserName}
            totalRows={performerWS.performerRows.length}
            pendingRows={performerWS.pendingRows}
            activeRows={performerWS.activeRows}
            timesheet={performerWS.timesheet}
            onOpenRequest={handleOpenRequest}
          />
        }
      />

      <CustomerRequestQuickAccessBar
        savedViews={DEFAULT_CUSTOMER_REQUEST_SAVED_VIEWS}
        activeSavedViewId={activeSavedViewId}
        onApplySavedView={handleApplySavedView}
        onClearSavedView={handleClearSavedView}
        pinnedItems={pinnedItems}
        recentItems={recentItems}
        onOpenRequest={handleOpenQuickAccessItem}
        onRemovePinned={removePinnedRequest}
      />

      {/* ── Main area ──────────────────────────────────────────────────── */}
      {activeSurface === 'analytics' ? (
        <CustomerRequestDashboardCards
          activeRoleFilter={dashboardRoleFilter}
          onRoleFilterChange={handleDashboardRoleFilterChange}
          overviewDashboard={overviewDashboard}
          roleDashboards={roleDashboards}
          isDashboardLoading={isDashboardLoading}
          activeProcessCode={activeProcessCode}
          onProcessCodeChange={(statusCode) => { setActiveProcessCode(statusCode); setListPage(1); }}
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
          onCreateFlowDraftChange={(patch) =>
            setCreateFlowDraft((prev) => ({ ...prev, ...patch }))
          }
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
          onClose={() => {
            setIsCreateMode(false);
            setSelectedRequestId(null);
          }}
        />
      )}
    </div>
  );
};
