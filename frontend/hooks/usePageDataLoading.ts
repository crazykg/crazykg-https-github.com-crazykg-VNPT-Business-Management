import { useState, useCallback, useRef, useEffect } from 'react';
import type { PaginatedQuery, PaginationMeta, Employee, Customer, Project, Contract, Document, AuditLog, FeedbackRequest, AuthUser } from '../types';
import {
  fetchEmployeesPage,
  fetchCustomersPage,
  fetchProjectsPage,
  fetchContractsPage,
  fetchDocumentsPage,
  fetchAuditLogsPage,
  fetchFeedbacksPage,
  DEFAULT_PAGINATION_META,
} from '../services/v5Api';
import { normalizeQuerySignature } from '../utils/queryUtils';
import { isRequestCanceledError } from '../services/v5Api';
import { hasPermission } from '../utils/authorization';

interface PageLoadResult<T> {
  data: T[];
  meta: PaginationMeta;
}

interface UsePageDataLoadingReturn {
  // Employees
  employeesPageRows: Employee[];
  employeesPageMeta: PaginationMeta;
  employeesPageLoading: boolean;
  loadEmployeesPage: (query?: PaginatedQuery) => Promise<void>;
  handleEmployeesPageQueryChange: (query: PaginatedQuery) => void;
  
  // Customers
  customersPageRows: Customer[];
  customersPageMeta: PaginationMeta;
  customersPageLoading: boolean;
  loadCustomersPage: (query?: PaginatedQuery) => Promise<void>;
  handleCustomersPageQueryChange: (query: PaginatedQuery) => void;
  
  // Projects
  projectsPageRows: Project[];
  projectsPageMeta: PaginationMeta;
  projectsPageLoading: boolean;
  loadProjectsPage: (query?: PaginatedQuery) => Promise<void>;
  handleProjectsPageQueryChange: (query: PaginatedQuery) => void;
  
  // Contracts
  contractsPageRows: Contract[];
  contractsPageMeta: PaginationMeta;
  contractsPageLoading: boolean;
  loadContractsPage: (query?: PaginatedQuery) => Promise<void>;
  handleContractsPageQueryChange: (query: PaginatedQuery) => void;
  
  // Documents
  documentsPageRows: Document[];
  documentsPageMeta: PaginationMeta;
  documentsPageLoading: boolean;
  loadDocumentsPage: (query?: PaginatedQuery) => Promise<void>;
  handleDocumentsPageQueryChange: (query: PaginatedQuery) => void;
  
  // Audit Logs
  auditLogsPageRows: AuditLog[];
  auditLogsPageMeta: PaginationMeta;
  auditLogsPageLoading: boolean;
  loadAuditLogsPage: (query?: PaginatedQuery) => Promise<void>;
  handleAuditLogsPageQueryChange: (query: PaginatedQuery) => void;
  
  // Feedbacks
  feedbacksPageRows: FeedbackRequest[];
  feedbacksPageMeta: PaginationMeta | undefined;
  feedbacksPageLoading: boolean;
  loadFeedbacksPage: (query?: PaginatedQuery) => Promise<void>;
  handleFeedbacksPageQueryChange: (query: PaginatedQuery) => void;
  
  // Setters
  setEmployeesPageRows: (rows: Employee[]) => void;
  setEmployeesPageMeta: (meta: PaginationMeta) => void;
  setCustomersPageRows: (rows: Customer[]) => void;
  setCustomersPageMeta: (meta: PaginationMeta) => void;
  setProjectsPageRows: (rows: Project[]) => void;
  setProjectsPageMeta: (meta: PaginationMeta) => void;
  setContractsPageRows: (rows: Contract[]) => void;
  setContractsPageMeta: (meta: PaginationMeta) => void;
  setDocumentsPageRows: (rows: Document[]) => void;
  setDocumentsPageMeta: (meta: PaginationMeta) => void;
  setAuditLogsPageRows: (rows: AuditLog[]) => void;
  setAuditLogsPageMeta: (meta: PaginationMeta) => void;
  setFeedbacksPageRows: (rows: FeedbackRequest[]) => void;
  setFeedbacksPageMeta: (meta: PaginationMeta | undefined) => void;
}

export function usePageDataLoading(
  addToast?: (type: 'success' | 'error', title: string, message: string) => void
): UsePageDataLoadingReturn {
  // State
  const [employeesPageRows, setEmployeesPageRows] = useState<Employee[]>([]);
  const [employeesPageMeta, setEmployeesPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [employeesPageLoading, setEmployeesPageLoading] = useState(false);
  
  const [customersPageRows, setCustomersPageRows] = useState<Customer[]>([]);
  const [customersPageMeta, setCustomersPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [customersPageLoading, setCustomersPageLoading] = useState(false);
  
  const [projectsPageRows, setProjectsPageRows] = useState<Project[]>([]);
  const [projectsPageMeta, setProjectsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [projectsPageLoading, setProjectsPageLoading] = useState(false);
  
  const [contractsPageRows, setContractsPageRows] = useState<Contract[]>([]);
  const [contractsPageMeta, setContractsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [contractsPageLoading, setContractsPageLoading] = useState(false);
  
  const [documentsPageRows, setDocumentsPageRows] = useState<Document[]>([]);
  const [documentsPageMeta, setDocumentsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [documentsPageLoading, setDocumentsPageLoading] = useState(false);
  
  const [auditLogsPageRows, setAuditLogsPageRows] = useState<AuditLog[]>([]);
  const [auditLogsPageMeta, setAuditLogsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [auditLogsPageLoading, setAuditLogsPageLoading] = useState(false);
  
  const [feedbacksPageRows, setFeedbacksPageRows] = useState<FeedbackRequest[]>([]);
  const [feedbacksPageMeta, setFeedbacksPageMeta] = useState<PaginationMeta | undefined>(undefined);
  const [feedbacksPageLoading, setFeedbacksPageLoading] = useState(false);

  // Refs
  const pageLoadVersionRef = useRef<Record<string, number>>({});
  const pageQueryInFlightSignatureRef = useRef<Record<string, string>>({});
  const pageQueryDebounceRef = useRef<Record<string, number>>({});
  
  // Query refs
  const employeesPageQueryRef = useRef<PaginatedQuery>({ page: 1, per_page: 7, sort_by: 'user_code', sort_dir: 'asc', q: '', filters: {} });
  const customersPageQueryRef = useRef<PaginatedQuery>({ page: 1, per_page: 10, sort_by: 'customer_code', sort_dir: 'asc', q: '', filters: {} });
  const projectsPageQueryRef = useRef<PaginatedQuery>({ page: 1, per_page: 10, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} });
  const contractsPageQueryRef = useRef<PaginatedQuery>({ page: 1, per_page: 10, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} });
  const documentsPageQueryRef = useRef<PaginatedQuery>({ page: 1, per_page: 7, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} });
  const auditLogsPageQueryRef = useRef<PaginatedQuery>({ page: 1, per_page: 10, sort_by: 'created_at', sort_dir: 'desc', q: '', filters: {} });
  const feedbacksPageQueryRef = useRef<PaginatedQuery>({ page: 1, per_page: 20, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.keys(pageQueryDebounceRef.current).forEach((key) => {
        const timerId = pageQueryDebounceRef.current[key];
        if (typeof timerId === 'number') {
          window.clearTimeout(timerId);
        }
      });
    };
  }, []);

  // Helper functions
  const beginPageLoad = useCallback((key: string): number => {
    const nextVersion = (pageLoadVersionRef.current[key] || 0) + 1;
    pageLoadVersionRef.current[key] = nextVersion;
    return nextVersion;
  }, []);

  const isLatestPageLoad = useCallback((key: string, version: number): boolean =>
    pageLoadVersionRef.current[key] === version, []);

  const schedulePageQueryLoad = useCallback((
    key: string,
    query: PaginatedQuery,
    loader: (nextQuery: PaginatedQuery) => Promise<void>
  ) => {
    const currentTimer = pageQueryDebounceRef.current[key];
    if (typeof currentTimer === 'number') {
      window.clearTimeout(currentTimer);
    }

    pageQueryDebounceRef.current[key] = window.setTimeout(() => {
      delete pageQueryDebounceRef.current[key];
      void loader(query);
    }, 250);
  }, []);

  // Load functions
  const loadEmployeesPage = useCallback(async (query?: PaginatedQuery) => {
    const requestKey = 'employeesPage';
    const effectiveQuery = query ?? employeesPageQueryRef.current;
    const querySignature = normalizeQuerySignature(effectiveQuery);
    if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
      return;
    }
    pageQueryInFlightSignatureRef.current[requestKey] = querySignature;

    const requestVersion = beginPageLoad(requestKey);
    employeesPageQueryRef.current = effectiveQuery;
    setEmployeesPageLoading(true);
    try {
      const result = await fetchEmployeesPage(effectiveQuery);
      if (!isLatestPageLoad(requestKey, requestVersion)) {
        return;
      }
      setEmployeesPageRows(result.data || []);
      setEmployeesPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (error) {
      if (!isLatestPageLoad(requestKey, requestVersion) || isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách nhân sự.';
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) {
        setEmployeesPageLoading(false);
      }
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
        delete pageQueryInFlightSignatureRef.current[requestKey];
      }
    }
  }, [addToast, beginPageLoad, isLatestPageLoad]);

  const loadCustomersPage = useCallback(async (query?: PaginatedQuery) => {
    const requestKey = 'customersPage';
    const effectiveQuery = query ?? customersPageQueryRef.current;
    const querySignature = normalizeQuerySignature(effectiveQuery);
    if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
      return;
    }
    pageQueryInFlightSignatureRef.current[requestKey] = querySignature;

    const requestVersion = beginPageLoad(requestKey);
    customersPageQueryRef.current = effectiveQuery;
    setCustomersPageLoading(true);
    try {
      const result = await fetchCustomersPage(effectiveQuery);
      if (!isLatestPageLoad(requestKey, requestVersion)) {
        return;
      }
      setCustomersPageRows(result.data || []);
      setCustomersPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (error) {
      if (!isLatestPageLoad(requestKey, requestVersion) || isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách khách hàng.';
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) {
        setCustomersPageLoading(false);
      }
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
        delete pageQueryInFlightSignatureRef.current[requestKey];
      }
    }
  }, [addToast, beginPageLoad, isLatestPageLoad]);

  const loadProjectsPage = useCallback(async (query?: PaginatedQuery) => {
    const requestKey = 'projectsPage';
    const effectiveQuery = query ?? projectsPageQueryRef.current;
    const querySignature = normalizeQuerySignature(effectiveQuery);
    if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
      return;
    }
    pageQueryInFlightSignatureRef.current[requestKey] = querySignature;

    const requestVersion = beginPageLoad(requestKey);
    projectsPageQueryRef.current = effectiveQuery;
    setProjectsPageLoading(true);
    try {
      const result = await fetchProjectsPage(effectiveQuery);
      if (!isLatestPageLoad(requestKey, requestVersion)) {
        return;
      }
      setProjectsPageRows(result.data || []);
      setProjectsPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (error) {
      if (!isLatestPageLoad(requestKey, requestVersion) || isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách dự án.';
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) {
        setProjectsPageLoading(false);
      }
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
        delete pageQueryInFlightSignatureRef.current[requestKey];
      }
    }
  }, [addToast, beginPageLoad, isLatestPageLoad]);

  const loadContractsPage = useCallback(async (query?: PaginatedQuery) => {
    const requestKey = 'contractsPage';
    const effectiveQuery = query ?? contractsPageQueryRef.current;
    const querySignature = normalizeQuerySignature(effectiveQuery);
    if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
      return;
    }
    pageQueryInFlightSignatureRef.current[requestKey] = querySignature;

    const requestVersion = beginPageLoad(requestKey);
    contractsPageQueryRef.current = effectiveQuery;
    setContractsPageLoading(true);
    try {
      const result = await fetchContractsPage(effectiveQuery);
      if (!isLatestPageLoad(requestKey, requestVersion)) {
        return;
      }
      setContractsPageRows(result.data || []);
      setContractsPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (error) {
      if (!isLatestPageLoad(requestKey, requestVersion) || isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách hợp đồng.';
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) {
        setContractsPageLoading(false);
      }
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
        delete pageQueryInFlightSignatureRef.current[requestKey];
      }
    }
  }, [addToast, beginPageLoad, isLatestPageLoad]);

  const loadDocumentsPage = useCallback(async (query?: PaginatedQuery) => {
    const requestKey = 'documentsPage';
    const effectiveQuery = query ?? documentsPageQueryRef.current;
    const querySignature = normalizeQuerySignature(effectiveQuery);
    if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
      return;
    }
    pageQueryInFlightSignatureRef.current[requestKey] = querySignature;

    const requestVersion = beginPageLoad(requestKey);
    documentsPageQueryRef.current = effectiveQuery;
    setDocumentsPageLoading(true);
    try {
      const result = await fetchDocumentsPage(effectiveQuery);
      if (!isLatestPageLoad(requestKey, requestVersion)) {
        return;
      }
      setDocumentsPageRows(result.data || []);
      setDocumentsPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (error) {
      if (!isLatestPageLoad(requestKey, requestVersion) || isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách tài liệu.';
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) {
        setDocumentsPageLoading(false);
      }
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
        delete pageQueryInFlightSignatureRef.current[requestKey];
      }
    }
  }, [addToast, beginPageLoad, isLatestPageLoad]);

  const loadAuditLogsPage = useCallback(async (query?: PaginatedQuery) => {
    const requestKey = 'auditLogsPage';
    const effectiveQuery = query ?? auditLogsPageQueryRef.current;
    const querySignature = normalizeQuerySignature(effectiveQuery);
    if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
      return;
    }
    pageQueryInFlightSignatureRef.current[requestKey] = querySignature;

    const requestVersion = beginPageLoad(requestKey);
    auditLogsPageQueryRef.current = effectiveQuery;
    setAuditLogsPageLoading(true);
    try {
      const result = await fetchAuditLogsPage(effectiveQuery);
      if (!isLatestPageLoad(requestKey, requestVersion)) {
        return;
      }
      setAuditLogsPageRows(result.data || []);
      setAuditLogsPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (error) {
      if (!isLatestPageLoad(requestKey, requestVersion) || isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể tải audit log.';
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) {
        setAuditLogsPageLoading(false);
      }
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
        delete pageQueryInFlightSignatureRef.current[requestKey];
      }
    }
  }, [addToast, beginPageLoad, isLatestPageLoad]);

  const loadFeedbacksPage = useCallback(async (query?: PaginatedQuery) => {
    const requestKey = 'feedbacksPage';
    const effectiveQuery = query ?? feedbacksPageQueryRef.current;
    const querySignature = normalizeQuerySignature(effectiveQuery);
    if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
      return;
    }
    pageQueryInFlightSignatureRef.current[requestKey] = querySignature;

    const requestVersion = beginPageLoad(requestKey);
    feedbacksPageQueryRef.current = effectiveQuery;
    setFeedbacksPageLoading(true);
    try {
      const result = await fetchFeedbacksPage(effectiveQuery);
      if (!isLatestPageLoad(requestKey, requestVersion)) {
        return;
      }
      setFeedbacksPageRows(result.data || []);
      setFeedbacksPageMeta(result.meta || undefined);
    } catch (error) {
      if (!isLatestPageLoad(requestKey, requestVersion) || isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách góp ý.';
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) {
        setFeedbacksPageLoading(false);
      }
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
        delete pageQueryInFlightSignatureRef.current[requestKey];
      }
    }
  }, [addToast, beginPageLoad, isLatestPageLoad]);

  // Query change handlers
  const handleEmployeesPageQueryChange = useCallback((query: PaginatedQuery) => {
    schedulePageQueryLoad('employeesPage', query, loadEmployeesPage);
  }, [loadEmployeesPage, schedulePageQueryLoad]);

  const handleCustomersPageQueryChange = useCallback((query: PaginatedQuery) => {
    schedulePageQueryLoad('customersPage', query, loadCustomersPage);
  }, [loadCustomersPage, schedulePageQueryLoad]);

  const handleProjectsPageQueryChange = useCallback((query: PaginatedQuery) => {
    schedulePageQueryLoad('projectsPage', query, loadProjectsPage);
  }, [loadProjectsPage, schedulePageQueryLoad]);

  const handleContractsPageQueryChange = useCallback((query: PaginatedQuery) => {
    schedulePageQueryLoad('contractsPage', query, loadContractsPage);
  }, [loadContractsPage, schedulePageQueryLoad]);

  const handleDocumentsPageQueryChange = useCallback((query: PaginatedQuery) => {
    schedulePageQueryLoad('documentsPage', query, loadDocumentsPage);
  }, [loadDocumentsPage, schedulePageQueryLoad]);

  const handleAuditLogsPageQueryChange = useCallback((query: PaginatedQuery) => {
    schedulePageQueryLoad('auditLogsPage', query, loadAuditLogsPage);
  }, [loadAuditLogsPage, schedulePageQueryLoad]);

  const handleFeedbacksPageQueryChange = useCallback((query: PaginatedQuery) => {
    schedulePageQueryLoad('feedbacksPage', query, loadFeedbacksPage);
  }, [loadFeedbacksPage, schedulePageQueryLoad]);

  return {
    // Employees
    employeesPageRows,
    employeesPageMeta,
    employeesPageLoading,
    loadEmployeesPage,
    handleEmployeesPageQueryChange,
    
    // Customers
    customersPageRows,
    customersPageMeta,
    customersPageLoading,
    loadCustomersPage,
    handleCustomersPageQueryChange,
    
    // Projects
    projectsPageRows,
    projectsPageMeta,
    projectsPageLoading,
    loadProjectsPage,
    handleProjectsPageQueryChange,
    
    // Contracts
    contractsPageRows,
    contractsPageMeta,
    contractsPageLoading,
    loadContractsPage,
    handleContractsPageQueryChange,
    
    // Documents
    documentsPageRows,
    documentsPageMeta,
    documentsPageLoading,
    loadDocumentsPage,
    handleDocumentsPageQueryChange,
    
    // Audit Logs
    auditLogsPageRows,
    auditLogsPageMeta,
    auditLogsPageLoading,
    loadAuditLogsPage,
    handleAuditLogsPageQueryChange,
    
    // Feedbacks
    feedbacksPageRows,
    feedbacksPageMeta,
    feedbacksPageLoading,
    loadFeedbacksPage,
    handleFeedbacksPageQueryChange,
    
    // Setters
    setEmployeesPageRows,
    setEmployeesPageMeta,
    setCustomersPageRows,
    setCustomersPageMeta,
    setProjectsPageRows,
    setProjectsPageMeta,
    setContractsPageRows,
    setContractsPageMeta,
    setDocumentsPageRows,
    setDocumentsPageMeta,
    setAuditLogsPageRows,
    setAuditLogsPageMeta,
    setFeedbacksPageRows,
    setFeedbacksPageMeta,
  };
}