import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Dispatch, SetStateAction } from 'react';
import type {
  AuditLog,
  Contract,
  Customer,
  Document,
  Employee,
  EmployeePartyListItem,
  FeedbackRequest,
  PaginatedQuery,
  PaginatedResult,
  PaginationMeta,
  Project,
} from '../types';
import {
  DEFAULT_PAGINATION_META,
  fetchAuditLogsPage,
  fetchContractsPage,
  fetchCustomersPage,
  fetchDocumentsPage,
  fetchEmployeesPage,
  fetchEmployeePartyProfilesPage,
  fetchFeedbacksPage,
  fetchProjectsPage,
  isRequestCanceledError,
} from '../services/v5Api';
import { queryKeys } from '../shared/queryKeys';
import { useFilterStore } from '../shared/stores';
import { FILTER_DEFAULTS } from '../shared/stores/filterStore';
import type { FilterTabKey } from '../shared/stores/filterStore';

type ToastFn = (type: 'success' | 'error', title: string, message: string) => void;

type PageCachePayload<Row, Meta extends PaginationMeta | undefined = PaginationMeta> = {
  data: Row[];
  meta: Meta;
};

type QueryKeyFactory = (query: PaginatedQuery) => readonly unknown[];

interface UsePageDataLoadingReturn {
  employeesPageRows: Employee[];
  employeesPageMeta: PaginationMeta;
  employeesPageLoading: boolean;
  partyProfilesPageRows: EmployeePartyListItem[];
  partyProfilesPageMeta: PaginationMeta;
  partyProfilesPageLoading: boolean;
  customersPageRows: Customer[];
  customersPageMeta: PaginationMeta;
  customersPageLoading: boolean;
  projectsPageRows: Project[];
  projectsPageMeta: PaginationMeta;
  projectsPageLoading: boolean;
  contractsPageRows: Contract[];
  contractsPageMeta: PaginationMeta;
  contractsPageLoading: boolean;
  documentsPageRows: Document[];
  documentsPageMeta: PaginationMeta;
  documentsPageLoading: boolean;
  auditLogsPageRows: AuditLog[];
  auditLogsPageMeta: PaginationMeta;
  auditLogsPageLoading: boolean;
  feedbacksPageRows: FeedbackRequest[];
  feedbacksPageMeta: PaginationMeta | undefined;
  feedbacksPageLoading: boolean;
  loadEmployeesPage: (query?: PaginatedQuery) => Promise<void>;
  loadPartyProfilesPage: (query?: PaginatedQuery) => Promise<void>;
  loadCustomersPage: (query?: PaginatedQuery) => Promise<void>;
  loadProjectsPage: (query?: PaginatedQuery) => Promise<void>;
  loadContractsPage: (query?: PaginatedQuery) => Promise<void>;
  loadDocumentsPage: (query?: PaginatedQuery) => Promise<void>;
  loadAuditLogsPage: (query?: PaginatedQuery) => Promise<void>;
  loadFeedbacksPage: (query?: PaginatedQuery) => Promise<void>;
  handleEmployeesPageQueryChange: (query: PaginatedQuery) => void;
  handlePartyProfilesPageQueryChange: (query: PaginatedQuery) => void;
  handleCustomersPageQueryChange: (query: PaginatedQuery) => void;
  handleProjectsPageQueryChange: (query: PaginatedQuery) => void;
  handleContractsPageQueryChange: (query: PaginatedQuery) => void;
  handleDocumentsPageQueryChange: (query: PaginatedQuery) => void;
  handleAuditLogsPageQueryChange: (query: PaginatedQuery) => void;
  handleFeedbacksPageQueryChange: (query: PaginatedQuery) => void;
  setEmployeesPageRows: Dispatch<SetStateAction<Employee[]>>;
  setEmployeesPageMeta: Dispatch<SetStateAction<PaginationMeta>>;
  setPartyProfilesPageRows: Dispatch<SetStateAction<EmployeePartyListItem[]>>;
  setPartyProfilesPageMeta: Dispatch<SetStateAction<PaginationMeta>>;
  setCustomersPageRows: Dispatch<SetStateAction<Customer[]>>;
  setCustomersPageMeta: Dispatch<SetStateAction<PaginationMeta>>;
  setProjectsPageRows: Dispatch<SetStateAction<Project[]>>;
  setProjectsPageMeta: Dispatch<SetStateAction<PaginationMeta>>;
  setContractsPageRows: Dispatch<SetStateAction<Contract[]>>;
  setContractsPageMeta: Dispatch<SetStateAction<PaginationMeta>>;
  setDocumentsPageRows: Dispatch<SetStateAction<Document[]>>;
  setDocumentsPageMeta: Dispatch<SetStateAction<PaginationMeta>>;
  setAuditLogsPageRows: Dispatch<SetStateAction<AuditLog[]>>;
  setAuditLogsPageMeta: Dispatch<SetStateAction<PaginationMeta>>;
  setFeedbacksPageRows: Dispatch<SetStateAction<FeedbackRequest[]>>;
  setFeedbacksPageMeta: Dispatch<SetStateAction<PaginationMeta | undefined>>;
  getStoredFilter: (tab: FilterTabKey) => PaginatedQuery;
}

interface PaginatedPageOptions<Row, Meta extends PaginationMeta | undefined = PaginationMeta> {
  tabKey: FilterTabKey;
  queryKeyFactory: QueryKeyFactory;
  fetchPage: (query: PaginatedQuery) => Promise<PaginatedResult<Row>>;
  defaultMeta: Meta;
  errorMessage: string;
  addToast?: ToastFn;
}

interface PaginatedPageController<Row, Meta extends PaginationMeta | undefined = PaginationMeta> {
  rows: Row[];
  meta: Meta;
  isLoading: boolean;
  loadPage: (query?: PaginatedQuery) => Promise<void>;
  setRows: Dispatch<SetStateAction<Row[]>>;
  setMeta: Dispatch<SetStateAction<Meta>>;
}

const resolveStateUpdate = <T,>(nextValue: SetStateAction<T>, previousValue: T): T => (
  typeof nextValue === 'function'
    ? (nextValue as (currentValue: T) => T)(previousValue)
    : nextValue
);

function usePaginatedPageCache<Row, Meta extends PaginationMeta | undefined = PaginationMeta>({
  tabKey,
  queryKeyFactory,
  fetchPage,
  defaultMeta,
  errorMessage,
  addToast,
}: PaginatedPageOptions<Row, Meta>): PaginatedPageController<Row, Meta> {
  const queryClient = useQueryClient();
  const currentQuery = useFilterStore((state) => state.tabFilters[tabKey]);
  const getTabFilter = useFilterStore((state) => state.getTabFilter);
  const replaceTabFilter = useFilterStore((state) => state.replaceTabFilter);
  const effectiveCurrentQuery = currentQuery ?? FILTER_DEFAULTS[tabKey];

  const currentQueryKey = useMemo(
    () => queryKeyFactory(effectiveCurrentQuery),
    [effectiveCurrentQuery, queryKeyFactory],
  );

  const toCachePayload = useCallback((result: PaginatedResult<Row>): PageCachePayload<Row, Meta> => ({
    data: result.data || [],
    meta: (result.meta ?? defaultMeta) as Meta,
  }), [defaultMeta]);

  const pageQuery = useQuery<PageCachePayload<Row, Meta>>({
    queryKey: currentQueryKey,
    queryFn: async () => toCachePayload(await fetchPage(effectiveCurrentQuery)),
    enabled: false,
    retry: false,
    placeholderData: (previousData) => previousData,
  });

  const loadPage = useCallback(async (query?: PaginatedQuery) => {
    const nextQuery = query ?? getTabFilter(tabKey);
    replaceTabFilter(tabKey, nextQuery);

    try {
      await queryClient.fetchQuery({
        queryKey: queryKeyFactory(nextQuery),
        queryFn: async () => toCachePayload(await fetchPage(nextQuery)),
        staleTime: 0,
      });
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }

      const message = error instanceof Error ? error.message : errorMessage;
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    }
  }, [addToast, errorMessage, fetchPage, getTabFilter, queryClient, queryKeyFactory, replaceTabFilter, tabKey, toCachePayload]);

  const setRows: Dispatch<SetStateAction<Row[]>> = useCallback((value) => {
    queryClient.setQueryData<PageCachePayload<Row, Meta>>(currentQueryKey, (previous) => ({
      data: resolveStateUpdate(value, previous?.data ?? []),
      meta: previous?.meta ?? defaultMeta,
    }));
  }, [currentQueryKey, defaultMeta, queryClient]);

  const setMeta: Dispatch<SetStateAction<Meta>> = useCallback((value) => {
    queryClient.setQueryData<PageCachePayload<Row, Meta>>(currentQueryKey, (previous) => ({
      data: previous?.data ?? [],
      meta: resolveStateUpdate(value, previous?.meta ?? defaultMeta),
    }));
  }, [currentQueryKey, defaultMeta, queryClient]);

  return {
    rows: pageQuery.data?.data ?? [],
    meta: pageQuery.data?.meta ?? defaultMeta,
    isLoading: pageQuery.isFetching,
    loadPage,
    setRows,
    setMeta,
  };
}

export function usePageDataLoading(addToast?: ToastFn): UsePageDataLoadingReturn {
  const pageQueryDebounceRef = useRef<Record<string, number>>({});

  const getTabFilter = useFilterStore((state) => state.getTabFilter);
  const setTabFilter = useFilterStore((state) => state.setTabFilter);

  useEffect(() => {
    return () => {
      Object.values(pageQueryDebounceRef.current).forEach((timerId) => {
        if (typeof timerId === 'number') {
          window.clearTimeout(timerId);
        }
      });
    };
  }, []);

  const scheduleStoredPageQueryLoad = useCallback((
    key: FilterTabKey,
    query: PaginatedQuery,
    loader: (nextQuery: PaginatedQuery) => Promise<void>,
  ) => {
    setTabFilter(key, query);

    const currentTimer = pageQueryDebounceRef.current[key];
    if (typeof currentTimer === 'number') {
      window.clearTimeout(currentTimer);
    }

    const storedQuery = getTabFilter(key);
    pageQueryDebounceRef.current[key] = window.setTimeout(() => {
      delete pageQueryDebounceRef.current[key];
      void loader(storedQuery);
    }, 250);
  }, [getTabFilter, setTabFilter]);

  const employeesPage = usePaginatedPageCache<Employee>({
    tabKey: 'employeesPage',
    queryKeyFactory: queryKeys.employees.list,
    fetchPage: fetchEmployeesPage,
    defaultMeta: DEFAULT_PAGINATION_META,
    errorMessage: 'Không thể tải danh sách nhân sự.',
    addToast,
  });

  const partyProfilesPage = usePaginatedPageCache<EmployeePartyListItem>({
    tabKey: 'partyProfilesPage',
    queryKeyFactory: queryKeys.employees.partyProfiles,
    fetchPage: fetchEmployeePartyProfilesPage,
    defaultMeta: DEFAULT_PAGINATION_META,
    errorMessage: 'Không thể tải danh sách đảng viên.',
    addToast,
  });

  const customersPage = usePaginatedPageCache<Customer>({
    tabKey: 'customersPage',
    queryKeyFactory: queryKeys.customers.list,
    fetchPage: fetchCustomersPage,
    defaultMeta: DEFAULT_PAGINATION_META,
    errorMessage: 'Không thể tải danh sách khách hàng.',
    addToast,
  });

  const projectsPage = usePaginatedPageCache<Project>({
    tabKey: 'projectsPage',
    queryKeyFactory: queryKeys.projects.list,
    fetchPage: fetchProjectsPage,
    defaultMeta: DEFAULT_PAGINATION_META,
    errorMessage: 'Không thể tải danh sách dự án.',
    addToast,
  });

  const contractsPage = usePaginatedPageCache<Contract>({
    tabKey: 'contractsPage',
    queryKeyFactory: queryKeys.contracts.list,
    fetchPage: fetchContractsPage,
    defaultMeta: DEFAULT_PAGINATION_META,
    errorMessage: 'Không thể tải danh sách hợp đồng.',
    addToast,
  });

  const documentsPage = usePaginatedPageCache<Document>({
    tabKey: 'documentsPage',
    queryKeyFactory: queryKeys.documents.list,
    fetchPage: fetchDocumentsPage,
    defaultMeta: DEFAULT_PAGINATION_META,
    errorMessage: 'Không thể tải danh sách tài liệu.',
    addToast,
  });

  const auditLogsPage = usePaginatedPageCache<AuditLog>({
    tabKey: 'auditLogsPage',
    queryKeyFactory: queryKeys.admin.auditLogs,
    fetchPage: fetchAuditLogsPage,
    defaultMeta: DEFAULT_PAGINATION_META,
    errorMessage: 'Không thể tải audit log.',
    addToast,
  });

  const feedbacksPage = usePaginatedPageCache<FeedbackRequest, PaginationMeta | undefined>({
    tabKey: 'feedbacksPage',
    queryKeyFactory: queryKeys.admin.feedbacks,
    fetchPage: fetchFeedbacksPage,
    defaultMeta: undefined,
    errorMessage: 'Không thể tải danh sách góp ý.',
    addToast,
  });

  const handleEmployeesPageQueryChange = useCallback((query: PaginatedQuery) => {
    scheduleStoredPageQueryLoad('employeesPage', query, employeesPage.loadPage);
  }, [employeesPage.loadPage, scheduleStoredPageQueryLoad]);

  const handlePartyProfilesPageQueryChange = useCallback((query: PaginatedQuery) => {
    scheduleStoredPageQueryLoad('partyProfilesPage', query, partyProfilesPage.loadPage);
  }, [partyProfilesPage.loadPage, scheduleStoredPageQueryLoad]);

  const handleCustomersPageQueryChange = useCallback((query: PaginatedQuery) => {
    scheduleStoredPageQueryLoad('customersPage', query, customersPage.loadPage);
  }, [customersPage.loadPage, scheduleStoredPageQueryLoad]);

  const handleProjectsPageQueryChange = useCallback((query: PaginatedQuery) => {
    scheduleStoredPageQueryLoad('projectsPage', query, projectsPage.loadPage);
  }, [projectsPage.loadPage, scheduleStoredPageQueryLoad]);

  const handleContractsPageQueryChange = useCallback((query: PaginatedQuery) => {
    scheduleStoredPageQueryLoad('contractsPage', query, contractsPage.loadPage);
  }, [contractsPage.loadPage, scheduleStoredPageQueryLoad]);

  const handleDocumentsPageQueryChange = useCallback((query: PaginatedQuery) => {
    scheduleStoredPageQueryLoad('documentsPage', query, documentsPage.loadPage);
  }, [documentsPage.loadPage, scheduleStoredPageQueryLoad]);

  const handleAuditLogsPageQueryChange = useCallback((query: PaginatedQuery) => {
    scheduleStoredPageQueryLoad('auditLogsPage', query, auditLogsPage.loadPage);
  }, [auditLogsPage.loadPage, scheduleStoredPageQueryLoad]);

  const handleFeedbacksPageQueryChange = useCallback((query: PaginatedQuery) => {
    scheduleStoredPageQueryLoad('feedbacksPage', query, feedbacksPage.loadPage);
  }, [feedbacksPage.loadPage, scheduleStoredPageQueryLoad]);

  return {
    employeesPageRows: employeesPage.rows,
    employeesPageMeta: employeesPage.meta,
    employeesPageLoading: employeesPage.isLoading,
    partyProfilesPageRows: partyProfilesPage.rows,
    partyProfilesPageMeta: partyProfilesPage.meta,
    partyProfilesPageLoading: partyProfilesPage.isLoading,
    customersPageRows: customersPage.rows,
    customersPageMeta: customersPage.meta,
    customersPageLoading: customersPage.isLoading,
    projectsPageRows: projectsPage.rows,
    projectsPageMeta: projectsPage.meta,
    projectsPageLoading: projectsPage.isLoading,
    contractsPageRows: contractsPage.rows,
    contractsPageMeta: contractsPage.meta,
    contractsPageLoading: contractsPage.isLoading,
    documentsPageRows: documentsPage.rows,
    documentsPageMeta: documentsPage.meta,
    documentsPageLoading: documentsPage.isLoading,
    auditLogsPageRows: auditLogsPage.rows,
    auditLogsPageMeta: auditLogsPage.meta,
    auditLogsPageLoading: auditLogsPage.isLoading,
    feedbacksPageRows: feedbacksPage.rows,
    feedbacksPageMeta: feedbacksPage.meta,
    feedbacksPageLoading: feedbacksPage.isLoading,
    loadEmployeesPage: employeesPage.loadPage,
    loadPartyProfilesPage: partyProfilesPage.loadPage,
    loadCustomersPage: customersPage.loadPage,
    loadProjectsPage: projectsPage.loadPage,
    loadContractsPage: contractsPage.loadPage,
    loadDocumentsPage: documentsPage.loadPage,
    loadAuditLogsPage: auditLogsPage.loadPage,
    loadFeedbacksPage: feedbacksPage.loadPage,
    handleEmployeesPageQueryChange,
    handlePartyProfilesPageQueryChange,
    handleCustomersPageQueryChange,
    handleProjectsPageQueryChange,
    handleContractsPageQueryChange,
    handleDocumentsPageQueryChange,
    handleAuditLogsPageQueryChange,
    handleFeedbacksPageQueryChange,
    setEmployeesPageRows: employeesPage.setRows,
    setEmployeesPageMeta: employeesPage.setMeta,
    setPartyProfilesPageRows: partyProfilesPage.setRows,
    setPartyProfilesPageMeta: partyProfilesPage.setMeta,
    setCustomersPageRows: customersPage.setRows,
    setCustomersPageMeta: customersPage.setMeta,
    setProjectsPageRows: projectsPage.setRows,
    setProjectsPageMeta: projectsPage.setMeta,
    setContractsPageRows: contractsPage.setRows,
    setContractsPageMeta: contractsPage.setMeta,
    setDocumentsPageRows: documentsPage.setRows,
    setDocumentsPageMeta: documentsPage.setMeta,
    setAuditLogsPageRows: auditLogsPage.setRows,
    setAuditLogsPageMeta: auditLogsPage.setMeta,
    setFeedbacksPageRows: feedbacksPage.setRows,
    setFeedbacksPageMeta: feedbacksPage.setMeta,
    getStoredFilter: getTabFilter,
  };
}
