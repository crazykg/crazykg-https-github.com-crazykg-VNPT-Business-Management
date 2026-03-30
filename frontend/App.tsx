import React, { Suspense, lazy, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './components/LoginPage';
import { ToastContainer } from './components/Toast';
import { AppPages } from './AppPages';
import { useToastQueue } from './hooks/useToastQueue';
import { useImportDepartments } from './hooks/useImportDepartments';
import { useImportEmployees } from './hooks/useImportEmployees';
import { useImportCustomers } from './hooks/useImportCustomers';
import { useImportEmployeePartyProfiles } from './hooks/useImportEmployeePartyProfiles';
import { useAccessControl } from './hooks/useAccessControl';
import { useContracts } from './hooks/useContracts';
import { useCustomers } from './hooks/useCustomers';
import { useDepartments } from './hooks/useDepartments';
import { useDocuments } from './hooks/useDocuments';
import { useEmployees } from './hooks/useEmployees';
import { useIntegrationSettings } from './hooks/useIntegrationSettings';
import { useModalManagement } from './hooks/useModalManagement';
import { usePageDataLoading } from './hooks/usePageDataLoading';
import { useProjects } from './hooks/useProjects';
import { useSupportConfig } from './hooks/useSupportConfig';
import { useAuthStore } from './shared/stores';
import type { InternalUserSubTab } from './components/InternalUserModuleTabs';
import type {
  ImportPayload,
  ProjectItemImportBatchGroup,
  ProjectItemImportBatchResult,
  ProjectRaciImportBatchGroup,
  ProjectRaciImportBatchResult,
} from './components/modals/index';
import {
  AuditLog, Department, Employee, Business, Vendor, Product, Customer, CustomerPersonnel,
  Project, ProjectItemMaster, ProjectRaciRow, Contract, Document, Reminder, UserDeptHistory,
  DashboardStats, ContractAggregateKpis, CustomerAggregateKpis, PaymentSchedule,
  PaymentScheduleConfirmationPayload, HRStatistics,
  PaginatedQuery, FeedbackRequest, FeedbackPriority, FeedbackStatus, Attachment, ExpiringContractSummary,
} from './types';
import { buildHrStatistics } from './utils/hrAnalytics';
import { canAccessTab } from './utils/authorization';
import { DEFAULT_PRODUCT_SERVICE_GROUP, normalizeProductServiceGroup } from './utils/productServiceGroup';
import { normalizeProductUnitForSave } from './utils/productUnit';
import { calculateDashboardStats, calculateContractKpis, calculateCustomerKpis } from './utils/dashboardCalculations';
import {
  changePasswordFirstLogin,
  fetchBusinesses, fetchVendors, fetchProducts,
  fetchCustomerPersonnel, fetchReminders, fetchUserDeptHistory, fetchAuditLogs,
  fetchProjectsPage, fetchContractsPage, createFeedback, updateFeedback, deleteFeedback,
  createContract, updateContract, deleteContract,
  createEmployeeWithProvisioning, updateEmployee,
  upsertEmployeePartyProfile,
  deleteEmployee, resetEmployeePassword, createBusiness, updateBusiness, deleteBusiness,
  createVendor, updateVendor, deleteVendor, createProduct, updateProduct, deleteProduct,
  createCustomer, updateCustomer, deleteCustomer, createCustomerPersonnel, updateCustomerPersonnel,
  deleteCustomerPersonnel, createProject, updateProject, deleteProject,
  fetchProjectRaciAssignments, createDocument, updateDocument, deleteDocument,
  isRequestCanceledError, isTabEvictedMessage, registerTabEvictedHandler, unregisterTabEvictedHandler,
} from './services/v5Api';
import type { GenerateContractPaymentsPayload } from './services/v5Api';
import { normalizeImportToken, normalizeImportDate, isProductDeleteDependencyError, isCustomerDeleteDependencyError } from './utils/importUtils';
import { prependContractInCollection, replaceContractInCollection } from './utils/contractCollections';
import { hasPermission } from './utils/authorization';

// Lazy components
const ProjectProcedureModal = lazy(() => import('./components/ProjectProcedureModal').then((m) => ({ default: m.ProjectProcedureModal })));
const ContractModal = lazy(() => import('./components/ContractModal').then((m) => ({ default: m.ContractModal })));
const FeedbackFormModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.FeedbackFormModal })));
const FeedbackViewModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.FeedbackViewModal })));
const DeleteFeedbackModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.DeleteFeedbackModal })));
const DepartmentFormModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.DepartmentFormModal })));
const ViewDepartmentModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.ViewDepartmentModal })));
const DeleteWarningModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.DeleteWarningModal })));
const CannotDeleteModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.CannotDeleteModal })));
const ImportModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.ImportModal })));
const EmployeeFormModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.EmployeeFormModal })));
const EmployeePartyProfileModal = lazy(() => import('./components/EmployeePartyProfileModal').then((m) => ({ default: m.EmployeePartyProfileModal })));
const DeleteEmployeeModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.DeleteEmployeeModal })));
const BusinessFormModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.BusinessFormModal })));
const DeleteBusinessModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.DeleteBusinessModal })));
const VendorFormModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.VendorFormModal })));
const DeleteVendorModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.DeleteVendorModal })));
const ProductFormModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.ProductFormModal })));
const DeleteProductModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.DeleteProductModal })));
const CannotDeleteProductModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.CannotDeleteProductModal })));
const ProductFeatureCatalogModal = lazy(() => import('./components/ProductFeatureCatalogModal').then((m) => ({ default: m.ProductFeatureCatalogModal })));
const ProductTargetSegmentModal = lazy(() => import('./components/ProductTargetSegmentModal').then((m) => ({ default: m.ProductTargetSegmentModal })));
const CannotDeleteCustomerModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.CannotDeleteCustomerModal })));
const CustomerInsightPanel = lazy(() => import('./components/CustomerInsightPanel'));
const CustomerFormModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.CustomerFormModal })));
const DeleteCustomerModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.DeleteCustomerModal })));
const CusPersonnelFormModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.CusPersonnelFormModal })));
const DeleteCusPersonnelModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.DeleteCusPersonnelModal })));
const ProjectFormModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.ProjectFormModal })));
const DeleteProjectModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.DeleteProjectModal })));
const DeleteContractModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.DeleteContractModal })));
const DocumentFormModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.DocumentFormModal })));
const DeleteDocumentModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.DeleteDocumentModal })));
const ReminderFormModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.ReminderFormModal })));
const DeleteReminderModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.DeleteReminderModal })));
const UserDeptHistoryFormModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.UserDeptHistoryFormModal })));
const DeleteUserDeptHistoryModal = lazy(() => import('./components/modals/index').then((m) => ({ default: m.DeleteUserDeptHistoryModal })));

const LazyModuleFallback: React.FC = () => (
  <div className="min-h-[300px] flex items-center justify-center py-16 text-slate-500">
    <div className="flex items-center gap-2">
      <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
      <span className="font-medium">Đang tải module...</span>
    </div>
  </div>
);

const AVAILABLE_TABS = ['dashboard', 'internal_user_dashboard', 'internal_user_list', 'internal_user_party_members', 'departments', 'user_dept_history', 'businesses', 'vendors', 'products', 'clients', 'cus_personnel', 'projects', 'contracts', 'documents', 'reminders', 'customer_request_management', 'revenue_mgmt', 'fee_collection', 'support_master_management', 'procedure_template_config', 'department_weekly_schedule_management', 'audit_logs', 'user_feedback', 'integration_settings', 'access_control'] as const;
const PROJECT_SAVE_TIMEOUT_MS = 20000;

const withAsyncTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  return await new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise.then(
      (value) => {
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
};

const App: React.FC = () => {
  // Auth state
  const authUser = useAuthStore((state) => state.user);
  const isAuthLoading = useAuthStore((state) => state.isAuthLoading);
  const isLoginLoading = useAuthStore((state) => state.isLoginLoading);
  const passwordChangeRequired = useAuthStore(
    (state) => state.passwordChangeRequired
  );
  const bootstrapAuth = useAuthStore((state) => state.bootstrapAuth);
  const loginAuth = useAuthStore((state) => state.login);
  const logoutAuth = useAuthStore((state) => state.logout);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const setAuthUser = useAuthStore((state) => state.setUser);
  const setPasswordChangeRequired = useAuthStore(
    (state) => state.setPasswordChangeRequired
  );
  const [loginError, setLoginError] = useState('');
  const [loginInfoMessage, setLoginInfoMessage] = useState('');
  const [passwordChangeForm, setPasswordChangeForm] = useState({ current_password: '', new_password: '', new_password_confirmation: '' });
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);

  // Navigation state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [internalUserSubTab, setInternalUserSubTab] = useState<InternalUserSubTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Entity state
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cusPersonnel, setCusPersonnel] = useState<CustomerPersonnel[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [userDeptHistory, setUserDeptHistory] = useState<UserDeptHistory[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackRequest[]>([]);

  // Loading state
  const [isSaving, setIsSaving] = useState(false);
  const [importLoadingText, setImportLoadingText] = useState('');

  // Refs
  const prefetchedTabsRef = React.useRef<Set<string>>(new Set());
  const recentToastByKeyRef = React.useRef<Map<string, number>>(new Map());
  const recentTabDataLoadRef = React.useRef<Map<string, number>>(new Map());
  const { toasts, addToast: enqueueToast, removeToast, clearToasts } = useToastQueue();
  const location = useLocation();
  const navigate = useNavigate();
  const { handleImportDepartments } = useImportDepartments();
  const { handleImportEmployees } = useImportEmployees();
  const { handleImportCustomers } = useImportCustomers();
  const { handleImportEmployeePartyProfiles } = useImportEmployeePartyProfiles();

  // Helper to add toast with deduplication
  const addToast = React.useCallback((type: 'success' | 'error', title: string, message: string) => {
    if (type === 'error' && isTabEvictedMessage(message)) {
      return;
    }

    const toastKey = `${type}|${title}|${message}`;
    const now = Date.now();
    const lastShownAt = recentToastByKeyRef.current.get(toastKey) ?? 0;
    if (now - lastShownAt < 2500) return;
    recentToastByKeyRef.current.set(toastKey, now);
    recentToastByKeyRef.current.forEach((timestamp, key) => { if (now - timestamp > 30000) recentToastByKeyRef.current.delete(key); });
    enqueueToast(type, title, message);
  }, [enqueueToast]);

  const {
    employeesPageRows,
    employeesPageMeta,
    employeesPageLoading,
    partyProfilesPageRows,
    partyProfilesPageMeta,
    partyProfilesPageLoading,
    customersPageRows,
    customersPageMeta,
    customersPageLoading,
    projectsPageRows,
    projectsPageMeta,
    projectsPageLoading,
    contractsPageRows,
    contractsPageMeta,
    contractsPageLoading,
    documentsPageRows,
    documentsPageMeta,
    documentsPageLoading,
    auditLogsPageRows,
    auditLogsPageMeta,
    auditLogsPageLoading,
    feedbacksPageRows,
    feedbacksPageMeta,
    feedbacksPageLoading,
    loadEmployeesPage,
    loadPartyProfilesPage,
    loadCustomersPage,
    loadProjectsPage,
    loadContractsPage,
    loadDocumentsPage,
    loadAuditLogsPage,
    loadFeedbacksPage,
    handleEmployeesPageQueryChange,
    handlePartyProfilesPageQueryChange,
    handleCustomersPageQueryChange,
    handleProjectsPageQueryChange,
    handleContractsPageQueryChange,
    handleDocumentsPageQueryChange,
    handleAuditLogsPageQueryChange,
    handleFeedbacksPageQueryChange,
    setPartyProfilesPageRows,
    setCustomersPageRows,
    setProjectsPageRows,
    setContractsPageRows,
    getStoredFilter,
  } = usePageDataLoading(addToast);

  const {
    modalType,
    importModuleOverride,
    selectedDept,
    selectedEmployee,
    selectedPartyProfile,
    selectedBusiness,
    selectedVendor,
    selectedProduct,
    productDeleteDependencyMessage,
    selectedCustomer,
    selectedCusPersonnel,
    selectedProject,
    projectModalInitialTab,
    selectedContract,
    contractAddPrefill,
    selectedDocument,
    selectedReminder,
    selectedUserDeptHistory,
    selectedFeedback,
    procedureProject,
    isContractDetailLoading,
    isFeedbackDetailLoading,
    employeeProvisioning,
    isEmployeePasswordResetting,
    setModalType,
    setSelectedCustomer,
    setSelectedFeedback,
    setSelectedProduct,
    setSelectedProject,
    setSelectedContract,
    setProcedureProject,
    setEmployeeProvisioning,
    setIsEmployeePasswordResetting,
    setProductDeleteDependencyMessage,
    handleOpenModal,
    handleCloseModal,
  } = useModalManagement(addToast);

  const handleCreateProductSave = React.useCallback(async (data: Partial<Product>) => {
    setIsSaving(true);
    try {
      const created = await createProduct({
        ...data,
        service_group: normalizeProductServiceGroup(data.service_group || DEFAULT_PRODUCT_SERVICE_GROUP),
        unit: normalizeProductUnitForSave(data.unit),
      });
      setProducts((previous) => [created, ...(previous || [])]);
      setModalType(null);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleEditProductSave = React.useCallback(async (data: Partial<Product>) => {
    if (!selectedProduct) {
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateProduct(selectedProduct.id, {
        ...data,
        service_group: normalizeProductServiceGroup(data.service_group || DEFAULT_PRODUCT_SERVICE_GROUP),
        unit: normalizeProductUnitForSave(data.unit),
      });
      setProducts((previous) =>
        previous.map((product) => (String(product.id) === String(updated.id) ? updated : product))
      );
      setSelectedProduct(updated);
      setModalType(null);
    } finally {
      setIsSaving(false);
    }
  }, [selectedProduct]);

  const handleDeleteProductConfirm = React.useCallback(async () => {
    if (!selectedProduct) {
      return;
    }

    try {
      await deleteProduct(selectedProduct.id);
      setProducts((previous) =>
        previous.filter((product) => String(product.id) !== String(selectedProduct.id))
      );
      setModalType(null);
    } catch (error) {
      if (isProductDeleteDependencyError(error)) {
        setProductDeleteDependencyMessage(error instanceof Error ? error.message : null);
        setModalType('CANNOT_DELETE_PRODUCT');
        return;
      }
      throw error;
    }
  }, [selectedProduct]);

  // Navigation helpers
  const getRoutePathFromTabId = React.useCallback((tabId: string): string => {
    if (tabId === 'dashboard') return '/';
    if (tabId === 'user_dept_history') return '/user-dept-history';
    if (tabId === 'customer_request_management') return '/customer-request-management';
    if (tabId === 'internal_user_dashboard') return '/internal-user-dashboard';
    if (tabId === 'internal_user_list') return '/internal-user-list';
    if (tabId === 'internal_user_party_members') return '/internal-user-party-members';
    return `/${tabId.replace(/_/g, '-')}`;
  }, []);

  const getTabIdFromPath = React.useCallback((pathname: string): string | null => {
    const path = pathname.replace(/^\//, '') || 'dashboard';
    if (path === '') return 'dashboard';
    const specialCases: Record<string, string> = {
      'user-dept-history': 'user_dept_history',
      'customer-request-management': 'customer_request_management',
      'internal-user-party-members': 'internal_user_party_members',
    };
    if (specialCases[path]) return specialCases[path];
    const tabId = path.replace(/-/g, '_');
    return AVAILABLE_TABS.includes(tabId as any) ? tabId : 'dashboard';
  }, []);

  const getRequestedTabId = React.useCallback((pathname: string, search: string): string | null => {
    const normalizedPath = pathname.replace(/\/+$/, '') || '/';
    if (normalizedPath === '/') {
      const queryTab = new URLSearchParams(search).get('tab');
      if (queryTab && AVAILABLE_TABS.includes(queryTab as any)) {
        return queryTab;
      }
    }

    return getTabIdFromPath(pathname);
  }, [getTabIdFromPath]);

  const handleNavigateTab = React.useCallback((tabId: string) => {
    setActiveTab(tabId);
    if (tabId === 'internal_user_dashboard') {
      setInternalUserSubTab('dashboard');
    } else if (tabId === 'internal_user_list') {
      setInternalUserSubTab('list');
    } else if (tabId === 'internal_user_party_members') {
      setInternalUserSubTab('party');
    }
    navigate(getRoutePathFromTabId(tabId));
  }, [navigate, getRoutePathFromTabId]);

  const visibleTabIds = useMemo(() => new Set(AVAILABLE_TABS.filter((tabId) => canAccessTab(authUser, tabId))), [authUser]);
  const activeInternalUserSubTab: InternalUserSubTab = activeTab === 'internal_user_list'
    ? 'list'
    : activeTab === 'internal_user_party_members'
      ? 'party'
      : internalUserSubTab;
  const activeModuleKey = activeTab === 'internal_user_dashboard'
    ? activeInternalUserSubTab === 'list'
      ? 'internal_user_list'
      : activeInternalUserSubTab === 'party'
        ? 'internal_user_party_members'
        : 'internal_user_dashboard'
    : activeTab;
  const importModalModuleKey = importModuleOverride || activeModuleKey;
  const importModalTitle = importModalModuleKey === 'internal_user_party_members'
    ? 'Nhập danh sách Đảng viên'
    : 'Nhập dữ liệu';
  const shouldLoadSupportConfig = Boolean(
    authUser
      && !passwordChangeRequired
      && (
        activeModuleKey === 'cus_personnel'
        || activeModuleKey === 'customer_request_management'
        || activeModuleKey === 'projects'
        || activeModuleKey === 'contracts'
        || activeModuleKey === 'support_master_management'
      ),
  );
  const shouldLoadAccessControl = Boolean(
    authUser && !passwordChangeRequired && activeModuleKey === 'access_control',
  );
  const shouldLoadIntegrationSettings = Boolean(
    authUser && !passwordChangeRequired && activeModuleKey === 'integration_settings',
  );
  const shouldLoadDepartments = Boolean(
    authUser
      && !passwordChangeRequired
      && (
        activeModuleKey === 'internal_user_dashboard'
        || activeModuleKey === 'internal_user_list'
        || activeModuleKey === 'internal_user_party_members'
        || activeModuleKey === 'departments'
        || activeModuleKey === 'user_dept_history'
        || activeModuleKey === 'projects'
        || activeModuleKey === 'department_weekly_schedule_management'
        || activeModuleKey === 'revenue_mgmt'
        || activeModuleKey === 'access_control'
      ),
  );
  const shouldLoadEmployees = Boolean(
    authUser
      && !passwordChangeRequired
      && (
        activeModuleKey === 'internal_user_dashboard'
        || activeModuleKey === 'internal_user_list'
        || activeModuleKey === 'internal_user_party_members'
        || activeModuleKey === 'departments'
        || activeModuleKey === 'user_dept_history'
        || activeModuleKey === 'projects'
        || activeModuleKey === 'reminders'
        || activeModuleKey === 'customer_request_management'
        || activeModuleKey === 'department_weekly_schedule_management'
        || activeModuleKey === 'audit_logs'
        || activeModuleKey === 'user_feedback'
      ),
  );
  const shouldLoadCustomers = Boolean(
    authUser
      && !passwordChangeRequired
      && (
        activeModuleKey === 'dashboard'
        || activeModuleKey === 'products'
        || activeModuleKey === 'clients'
        || activeModuleKey === 'cus_personnel'
        || activeModuleKey === 'projects'
        || activeModuleKey === 'contracts'
        || activeModuleKey === 'documents'
        || activeModuleKey === 'customer_request_management'
        || activeModuleKey === 'fee_collection'
        || activeModuleKey === 'support_master_management'
      ),
  );
  const shouldLoadProjects = Boolean(
    authUser
      && !passwordChangeRequired
      && (
        activeModuleKey === 'dashboard'
        || activeModuleKey === 'projects'
        || activeModuleKey === 'contracts'
        || activeModuleKey === 'documents'
        || activeModuleKey === 'fee_collection'
        || activeModuleKey === 'customer_request_management'
      ),
  );
  const shouldLoadContracts = Boolean(
    authUser
      && !passwordChangeRequired
      && (
        activeModuleKey === 'dashboard'
        || activeModuleKey === 'contracts'
        || activeModuleKey === 'fee_collection'
      ),
  );
  const shouldLoadDocuments = Boolean(
    authUser && !passwordChangeRequired && activeModuleKey === 'documents',
  );

  const {
    departments,
    isSaving: isDepartmentSaving,
    isLoading: isDepartmentsLoading,
    loadDepartments,
    handleSaveDepartment,
    handleDeleteDepartment,
    setDepartments,
  } = useDepartments(addToast, { enabled: shouldLoadDepartments });

  const {
    employees,
    isLoading: isEmployeesLoading,
    loadEmployees,
    setEmployees,
  } = useEmployees(addToast, { enabled: shouldLoadEmployees });

  const {
    customers,
    isLoading: isCustomersLoading,
    loadCustomers,
    setCustomers,
  } = useCustomers(addToast, { enabled: shouldLoadCustomers });

  const {
    projects,
    projectItems,
    isLoading: isProjectsLoading,
    loadProjects,
    loadProjectItems,
    setProjects,
    setProjectItems,
  } = useProjects(addToast, { enabled: shouldLoadProjects });

  const {
    contracts,
    paymentSchedules,
    isLoading: isContractsLoading,
    isPaymentScheduleLoading,
    loadContracts,
    loadPaymentSchedules,
    handleGenerateSchedules,
    handleConfirmPaymentSchedule,
    setContracts,
    setPaymentSchedules,
  } = useContracts(addToast, { enabled: shouldLoadContracts });

  const { setDocuments } = useDocuments(addToast, { enabled: shouldLoadDocuments });

  const {
    supportServiceGroups,
    supportContactPositions,
    supportRequestStatuses,
    projectTypes,
    worklogActivityTypes,
    supportSlaConfigs,
    handleCreateSupportServiceGroup,
    handleUpdateSupportServiceGroup,
    handleCreateSupportContactPosition,
    handleCreateSupportContactPositionsBulk,
    handleUpdateSupportContactPosition,
    handleCreateSupportRequestStatus,
    handleUpdateSupportRequestStatus,
    handleCreateProjectType,
    handleUpdateProjectType,
    handleCreateWorklogActivityType,
    handleUpdateWorklogActivityType,
    handleCreateSupportSlaConfig,
    handleUpdateSupportSlaConfig,
  } = useSupportConfig(addToast, { enabled: shouldLoadSupportConfig });

  const {
    roles,
    permissions,
    userAccessRecords,
    refreshAccessControlData,
    handleUpdateAccessRoles,
    handleBulkUpdateAccessRoles,
    handleBulkUpdateAccessPermissions,
    handleBulkUpdateAccessScopes,
    handleUpdateAccessPermissions,
    handleUpdateAccessScopes,
  } = useAccessControl(addToast, { enabled: shouldLoadAccessControl });

  const {
    backblazeB2Settings,
    googleDriveSettings,
    contractExpiryAlertSettings,
    contractPaymentAlertSettings,
    loadingStates: {
      isBackblazeB2SettingsLoading,
      isBackblazeB2SettingsSaving,
      isBackblazeB2SettingsTesting,
      isGoogleDriveSettingsLoading,
      isGoogleDriveSettingsSaving,
      isGoogleDriveSettingsTesting,
      isContractExpiryAlertSettingsLoading,
      isContractExpiryAlertSettingsSaving,
      isContractPaymentAlertSettingsLoading,
      isContractPaymentAlertSettingsSaving,
    },
    refreshIntegrationSettings,
    handleSaveBackblazeB2Settings,
    handleSaveGoogleDriveSettings,
    handleSaveContractExpiryAlertSettings: saveContractExpiryAlertSettings,
    handleSaveContractPaymentAlertSettings: saveContractPaymentAlertSettings,
    handleTestBackblazeB2Integration,
    handleTestGoogleDriveIntegration,
  } = useIntegrationSettings(addToast, { enabled: shouldLoadIntegrationSettings });

  // Sync from URL to activeTab
  React.useEffect(() => {
    const requestedTab = getRequestedTabId(location.pathname, location.search);
    if (!requestedTab) {
      return;
    }

    if (requestedTab !== activeTab) {
      setActiveTab(requestedTab);
    }

    if (requestedTab === 'internal_user_dashboard' && internalUserSubTab !== 'dashboard') {
      setInternalUserSubTab('dashboard');
    } else if (requestedTab === 'internal_user_list' && internalUserSubTab !== 'list') {
      setInternalUserSubTab('list');
    } else if (requestedTab === 'internal_user_party_members' && internalUserSubTab !== 'party') {
      setInternalUserSubTab('party');
    }
  }, [location.pathname, location.search, getRequestedTabId, activeTab, internalUserSubTab]);

  const handleInternalUserSubTabChange = React.useCallback((tab: InternalUserSubTab) => {
    handleNavigateTab(
      tab === 'list'
        ? 'internal_user_list'
        : tab === 'party'
          ? 'internal_user_party_members'
          : 'internal_user_dashboard'
    );
  }, [handleNavigateTab]);

  // Fallback tab if no permission
  React.useEffect(() => {
    if (!authUser) return;
    if (visibleTabIds.has(activeTab)) return;
    const fallbackTab = AVAILABLE_TABS.find((tabId) => visibleTabIds.has(tabId)) || 'dashboard';
    if (fallbackTab !== activeTab) handleNavigateTab(fallbackTab);
  }, [authUser, activeTab, visibleTabIds, handleNavigateTab]);

  // Auth bootstrap
  React.useEffect(() => {
    void bootstrapAuth().then(
      () => setLoginError(''),
      () => setLoginError('')
    );
  }, [bootstrapAuth]);

  // Tab eviction handler
  const handleTabEvicted = React.useCallback(() => {
    clearAuth();
    handleCloseModal();
    setProcedureProject(null);
    clearToasts();
    recentToastByKeyRef.current.clear();
    setLoginError('');
    setLoginInfoMessage('Tài khoản đã được đăng nhập trên một cửa sổ/tab khác. Vui lòng đăng nhập lại để tiếp tục.');
  }, [clearAuth, clearToasts, handleCloseModal, setProcedureProject]);

  React.useEffect(() => {
    registerTabEvictedHandler(handleTabEvicted);
    return () => unregisterTabEvictedHandler();
  }, [handleTabEvicted]);

  // Auth handlers
  const handleLogin = async (payload: { username: string; password: string }) => {
    setLoginError('');
    setPasswordChangeError('');
    setLoginInfoMessage('');
    try {
      const session = await loginAuth(payload);
      setPasswordChangeForm({ current_password: '', new_password: '', new_password_confirmation: '' });
      const requestedTab = typeof window !== 'undefined'
        ? getRequestedTabId(window.location.pathname, window.location.search)
        : null;
      if (requestedTab && canAccessTab(session.user, requestedTab)) {
        handleNavigateTab(requestedTab);
      } else {
        handleNavigateTab(canAccessTab(session.user, 'dashboard') ? 'dashboard' : 'internal_user_dashboard');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Đăng nhập thất bại.';
      setLoginError(message);
    }
  };

  const handleLogout = async () => {
    try { await logoutAuth(); } finally {
      setPasswordChangeError('');
      setPasswordChangeForm({ current_password: '', new_password: '', new_password_confirmation: '' });
      setEmployeeProvisioning(null);
      setIsEmployeePasswordResetting(false);
      handleNavigateTab('dashboard');
      setInternalUserSubTab('dashboard');
      handleCloseModal();
      setProcedureProject(null);
      clearToasts();
      recentToastByKeyRef.current.clear();
      setLoginError('');
    }
  };

  const handleChangePasswordRequired = async () => {
    if (isPasswordChanging) return;
    setPasswordChangeError('');
    if (!passwordChangeForm.current_password || !passwordChangeForm.new_password || !passwordChangeForm.new_password_confirmation) {
      setPasswordChangeError('Vui lòng nhập đầy đủ thông tin đổi mật khẩu.');
      return;
    }
    if (passwordChangeForm.new_password !== passwordChangeForm.new_password_confirmation) {
      setPasswordChangeError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setIsPasswordChanging(true);
    try {
      const result = await changePasswordFirstLogin(passwordChangeForm);
      setAuthUser(result.user);
      setPasswordChangeRequired(false);
      setPasswordChangeForm({ current_password: '', new_password: '', new_password_confirmation: '' });
      addToast('success', 'Bảo mật tài khoản', 'Đổi mật khẩu thành công.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể đổi mật khẩu.';
      setPasswordChangeError(message);
    } finally {
      setIsPasswordChanging(false);
    }
  };

  // Prefetch tabs
  const prefetchTabModules = React.useCallback((tab: string) => {
    const normalizedTab = String(tab || '').trim();
    if (!normalizedTab || prefetchedTabsRef.current.has(normalizedTab)) return;
    const prefetchTasks: Array<Promise<unknown>> = [];
    switch (normalizedTab) {
      case 'dashboard': prefetchTasks.push(import('./components/Dashboard')); break;
      case 'internal_user_dashboard': case 'internal_user_list': case 'internal_user_party_members': prefetchTasks.push(import('./components/InternalUserModuleTabs')); break;
      case 'departments': prefetchTasks.push(import('./components/DepartmentList')); break;
      case 'user_dept_history': prefetchTasks.push(import('./components/UserDeptHistoryList')); break;
      case 'businesses': prefetchTasks.push(import('./components/BusinessList')); break;
      case 'vendors': prefetchTasks.push(import('./components/VendorList')); break;
      case 'products': prefetchTasks.push(import('./components/ProductList')); break;
      case 'clients': prefetchTasks.push(import('./components/CustomerList')); break;
      case 'cus_personnel': prefetchTasks.push(import('./components/CusPersonnelList')); break;
      case 'projects': prefetchTasks.push(import('./components/ProjectList')); break;
      case 'contracts': prefetchTasks.push(import('./components/ContractList')); break;
      case 'documents': prefetchTasks.push(import('./components/DocumentList')); break;
      case 'reminders': prefetchTasks.push(import('./components/ReminderList')); break;
      case 'customer_request_management': prefetchTasks.push(import('./components/CustomerRequestManagementHub')); break;
      case 'revenue_mgmt': prefetchTasks.push(import('./components/RevenueManagementHub')); break;
      case 'fee_collection': prefetchTasks.push(import('./components/FeeCollectionHub')); break;
      case 'support_master_management': prefetchTasks.push(import('./components/SupportMasterManagement')); break;
      case 'procedure_template_config': prefetchTasks.push(import('./components/ProcedureTemplateManagement')); break;
      case 'department_weekly_schedule_management': prefetchTasks.push(import('./components/DepartmentWeeklyScheduleManagement')); break;
      case 'audit_logs': prefetchTasks.push(import('./components/AuditLogList')); break;
      case 'user_feedback': prefetchTasks.push(import('./components/FeedbackList')); break;
      case 'integration_settings': prefetchTasks.push(import('./components/IntegrationSettingsPanel')); break;
      case 'access_control': prefetchTasks.push(import('./components/AccessControlList')); break;
      default: return;
    }
    prefetchedTabsRef.current.add(normalizedTab);
    void Promise.allSettled(prefetchTasks);
  }, []);

  const handleImportData = React.useCallback(async (payload: ImportPayload) => {
    const moduleToken = normalizeImportToken(payload.moduleKey);
    const closeImportModal = () => setModalType(null);

    setImportLoadingText('');
    try {
      switch (moduleToken) {
        case 'departments':
          await handleImportDepartments(
            payload,
            departments,
            setDepartments,
            addToast,
            setImportLoadingText,
            setIsSaving,
            closeImportModal,
          );
          return;
        case 'employees':
        case 'internaluserlist':
          await handleImportEmployees(
            payload,
            departments,
            addToast,
            setImportLoadingText,
            setIsSaving,
            setEmployees,
            loadEmployeesPage,
            closeImportModal,
          );
          return;
        case 'internaluserpartymembers':
          await handleImportEmployeePartyProfiles(
            payload,
            addToast,
            setImportLoadingText,
            setIsSaving,
            setPartyProfilesPageRows,
            loadPartyProfilesPage,
            closeImportModal,
          );
          return;
        case 'clients':
          await handleImportCustomers(
            payload,
            setCustomers,
            addToast,
            setImportLoadingText,
            () => loadCustomersPage(),
            closeImportModal,
          );
          return;
        default:
          addToast('error', 'Nhập dữ liệu', 'Module này chưa hỗ trợ import từ màn hình hiện tại.');
      }
    } finally {
      setImportLoadingText('');
    }
  }, [
    addToast,
    departments,
    handleImportCustomers,
    handleImportDepartments,
    handleImportEmployees,
    handleImportEmployeePartyProfiles,
    loadCustomersPage,
    loadEmployeesPage,
    loadPartyProfilesPage,
  ]);

  const syncUpdatedContractState = React.useCallback((updatedContract: Contract) => {
    setSelectedContract(updatedContract);
    setContracts((previous) => replaceContractInCollection(previous, updatedContract));
    setContractsPageRows((previous) => replaceContractInCollection(previous, updatedContract));
  }, []);

  const syncCreatedContractState = React.useCallback((createdContract: Contract) => {
    setContracts((previous) => prependContractInCollection(previous, createdContract));
    setContractsPageRows((previous) => prependContractInCollection(previous, createdContract));
  }, []);

  const syncUpdatedCustomerState = React.useCallback((updatedCustomer: Customer) => {
    setSelectedCustomer(updatedCustomer);
    setCustomers((previous) =>
      previous.map((item) => (String(item.id) === String(updatedCustomer.id) ? updatedCustomer : item))
    );
    setCustomersPageRows((previous) =>
      previous.map((item) => (String(item.id) === String(updatedCustomer.id) ? updatedCustomer : item))
    );
  }, []);

  const syncCreatedCustomerState = React.useCallback((createdCustomer: Customer) => {
    setCustomers((previous) => [
      createdCustomer,
      ...previous.filter((item) => String(item.id) !== String(createdCustomer.id)),
    ]);
    setCustomersPageRows((previous) => [
      createdCustomer,
      ...previous.filter((item) => String(item.id) !== String(createdCustomer.id)),
    ]);
  }, []);

  const handleCreateContractSave = React.useCallback(async (payload: Partial<Contract>) => {
    setIsSaving(true);
    try {
      const created = await createContract(payload);
      syncCreatedContractState(created);
      await loadContractsPage();
      addToast('success', 'Thành công', 'Thêm mới hợp đồng thành công.');
      setModalType(null);
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể tạo hợp đồng.';
      addToast('error', 'Lưu thất bại', message);
    } finally {
      setIsSaving(false);
    }
  }, [addToast, loadContractsPage, syncCreatedContractState]);

  const handleUpdateContractSave = React.useCallback(async (payload: Partial<Contract>) => {
    if (!selectedContract) {
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateContract(selectedContract.id, payload);
      syncUpdatedContractState(updated);
      await loadContractsPage();
      addToast('success', 'Thành công', 'Cập nhật hợp đồng thành công.');
      setModalType(null);
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể cập nhật hợp đồng.';
      addToast('error', 'Lưu thất bại', message);
    } finally {
      setIsSaving(false);
    }
  }, [addToast, loadContractsPage, selectedContract, syncUpdatedContractState]);

  const handleCreateCustomerSave = React.useCallback(async (payload: Partial<Customer>) => {
    setIsSaving(true);
    try {
      const created = await createCustomer(payload);
      syncCreatedCustomerState(created);
      await loadCustomersPage();
      addToast('success', 'Thành công', 'Thêm mới khách hàng thành công.');
      setModalType(null);
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể tạo khách hàng.';
      addToast('error', 'Lưu thất bại', message);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [addToast, loadCustomersPage, syncCreatedCustomerState]);

  const handleUpdateCustomerSave = React.useCallback(async (payload: Partial<Customer>) => {
    if (!selectedCustomer) {
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateCustomer(selectedCustomer.id, payload);
      syncUpdatedCustomerState(updated);
      await loadCustomersPage();
      addToast('success', 'Thành công', 'Cập nhật khách hàng thành công.');
      setModalType(null);
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể cập nhật khách hàng.';
      addToast('error', 'Lưu thất bại', message);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [addToast, loadCustomersPage, selectedCustomer, syncUpdatedCustomerState]);

  const buildProjectMutationPayload = React.useCallback((data: Partial<Project>) => ({
    ...data,
    sync_items: Array.isArray(data.items),
    sync_raci: Array.isArray(data.raci),
  }), []);

  const handleCreateProjectSave = React.useCallback(async (data: Partial<Project>) => {
    setIsSaving(true);
    try {
      const created = await withAsyncTimeout(
        createProject(buildProjectMutationPayload(data)),
        PROJECT_SAVE_TIMEOUT_MS,
        'Không thể tạo dự án (quá thời gian phản hồi). Vui lòng thử lại.'
      );
      setProjects((previous) => [
        created,
        ...previous.filter((project) => String(project.id) !== String(created.id)),
      ]);
      setModalType(null);
      addToast('success', 'Thành công', 'Tạo dự án thành công.');
      void loadProjectItems();
      void loadProjectsPage();
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể tạo dự án.';
      addToast('error', 'Lưu thất bại', message);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [addToast, buildProjectMutationPayload, loadProjectItems, loadProjectsPage]);

  const handleEditProjectSave = React.useCallback(async (data: Partial<Project>) => {
    if (!selectedProject) {
      return;
    }

    setIsSaving(true);
    try {
      const updated = await withAsyncTimeout(
        updateProject(selectedProject.id, buildProjectMutationPayload(data)),
        PROJECT_SAVE_TIMEOUT_MS,
        'Không thể cập nhật dự án (quá thời gian phản hồi). Vui lòng thử lại.'
      );
      setProjects((previous) => {
        const exists = previous.some((project) => String(project.id) === String(updated.id));
        if (!exists) {
          return [updated, ...previous];
        }

        return previous.map((project) =>
          String(project.id) === String(updated.id) ? updated : project
        );
      });
      setProjectsPageRows((previous) =>
        previous.map((project) => (String(project.id) === String(updated.id) ? updated : project))
      );
      setSelectedProject(updated);
      addToast('success', 'Thành công', 'Cập nhật dự án thành công.');
      void loadProjectItems();
      void loadProjectsPage();
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể cập nhật dự án.';
      addToast('error', 'Lưu thất bại', message);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [addToast, buildProjectMutationPayload, loadProjectItems, loadProjectsPage, selectedProject]);

  const handleSaveContractExpiryAlertSettings = React.useCallback(async (payload: { warning_days: number }) => {
    await saveContractExpiryAlertSettings(payload);
    await loadContractsPage();
  }, [loadContractsPage, saveContractExpiryAlertSettings]);

  const handleSaveContractPaymentAlertSettings = React.useCallback(async (payload: { warning_days: number }) => {
    await saveContractPaymentAlertSettings(payload);
    await loadContractsPage();
  }, [loadContractsPage, saveContractPaymentAlertSettings]);

  const handleGenerateContractSchedules = React.useCallback(async (
    contractId: string | number,
    options?: GenerateContractPaymentsPayload,
  ) => {
    await handleGenerateSchedules(contractId, { generateOptions: options });
  }, [handleGenerateSchedules]);

  const handleRefreshContractSchedules = React.useCallback(async (contractId: string | number) => {
    await loadPaymentSchedules(contractId);
  }, [loadPaymentSchedules]);

  const handleConfirmContractPayment = React.useCallback(async (
    scheduleId: string | number,
    payload: PaymentScheduleConfirmationPayload,
  ) => {
    await handleConfirmPaymentSchedule(scheduleId, payload);
  }, [handleConfirmPaymentSchedule]);

  // Load data by activeTab - MUST be after load*Page functions
  React.useEffect(() => {
    if (!authUser || passwordChangeRequired) return;

    const loadByActiveTab = async () => {
      const throttledTabLoadKey = `${activeModuleKey}::${activeModuleKey === 'internal_user_dashboard' || activeModuleKey === 'internal_user_list' || activeModuleKey === 'internal_user_party_members' ? activeInternalUserSubTab : '-'}`;
      const now = Date.now();
      const lastLoadedAt = recentTabDataLoadRef.current.get(throttledTabLoadKey) ?? 0;
      if (now - lastLoadedAt < 600) return;
      recentTabDataLoadRef.current.set(throttledTabLoadKey, now);

      switch (activeModuleKey) {
        case 'dashboard':
          await Promise.all([
            loadContracts(),
            loadPaymentSchedules(),
            loadProjects(),
            loadCustomers(),
          ]);
          break;
        case 'internal_user_dashboard':
        case 'internal_user_list':
        case 'internal_user_party_members':
          await loadDepartments();
          if (activeInternalUserSubTab === 'list') {
            loadEmployeesPage();
          } else if (activeInternalUserSubTab === 'party') {
            await Promise.all([
              loadEmployees(),
              loadPartyProfilesPage(),
            ]);
          } else {
            await loadEmployees();
          }
          break;
        case 'departments':
          await Promise.all([
            loadDepartments(),
            loadEmployees(),
          ]);
          break;
        case 'user_dept_history':
          await Promise.all([
            fetchUserDeptHistory().then((rows) => setUserDeptHistory(rows || [])).catch(() => {}),
            loadEmployees(),
            loadDepartments(),
          ]);
          break;
        case 'businesses':
          await Promise.all([
            fetchBusinesses().then((rows) => setBusinesses(rows || [])).catch(() => {}),
            fetchProducts().then((rows) => setProducts(rows || [])).catch(() => {}),
          ]);
          break;
        case 'vendors':
          await fetchVendors().then((rows) => setVendors(rows || [])).catch(() => {});
          break;
        case 'products':
          await Promise.all([
            fetchProducts().then((rows) => setProducts(rows || [])).catch(() => {}),
            fetchBusinesses().then((rows) => setBusinesses(rows || [])).catch(() => {}),
            fetchVendors().then((rows) => setVendors(rows || [])).catch(() => {}),
            loadCustomers(),
          ]);
          break;
        case 'clients':
          void loadCustomers();
          loadCustomersPage();
          break;
        case 'cus_personnel':
          await Promise.all([
            fetchCustomerPersonnel().then((rows) => setCusPersonnel(rows || [])).catch(() => {}),
            loadCustomers(),
          ]);
          break;
        case 'projects':
          loadProjectsPage();
          setTimeout(() => {
            void Promise.all([
              loadCustomers(),
              fetchProducts().then((rows) => setProducts(rows || [])).catch(() => {}),
              loadProjectItems(),
              loadEmployees(),
              loadDepartments(),
            ]);
          }, 120);
          break;
        case 'contracts':
          loadContractsPage();
          setTimeout(() => {
            void Promise.all([
              loadProjects(),
              loadCustomers(),
              fetchProducts().then((rows) => setProducts(rows || [])).catch(() => {}),
              loadProjectItems(),
              fetchBusinesses().then((rows) => setBusinesses(rows || [])).catch(() => {}),
            ]);
          }, 120);
          break;
        case 'documents':
          loadDocumentsPage();
          setTimeout(() => {
            void Promise.all([
              loadCustomers(),
              loadProjects(),
              fetchProducts().then((rows) => setProducts(rows || [])).catch(() => {}),
            ]);
          }, 120);
          break;
        case 'reminders':
          await Promise.all([
            fetchReminders().then((rows) => setReminders(rows || [])).catch(() => {}),
            loadEmployees(),
          ]);
          break;
        case 'customer_request_management':
          setTimeout(() => {
            void Promise.all([
              loadCustomers(),
              fetchCustomerPersonnel().then((rows) => setCusPersonnel(rows || [])).catch(() => {}),
              loadEmployees(),
            ]);
          }, 120);
          break;
        case 'support_master_management':
          setTimeout(() => {
            void loadCustomers();
          }, 120);
          break;
        case 'procedure_template_config':
          break;
        case 'department_weekly_schedule_management':
          await Promise.all([
            loadDepartments(),
            loadEmployees(),
          ]);
          break;
        case 'audit_logs':
          loadAuditLogsPage();
          setTimeout(() => {
            void loadEmployees();
          }, 120);
          break;
        case 'user_feedback':
          loadFeedbacksPage();
          setTimeout(() => {
            void loadEmployees();
          }, 120);
          break;
        case 'access_control':
          await loadDepartments();
          break;
        default:
          break;
      }
    };

    void loadByActiveTab();
  }, [
    authUser,
    passwordChangeRequired,
    activeModuleKey,
    activeInternalUserSubTab,
    loadContracts,
    loadPaymentSchedules,
    loadProjects,
    loadCustomers,
    loadDepartments,
    loadEmployees,
    loadProjectItems,
    loadEmployeesPage,
    loadPartyProfilesPage,
    loadCustomersPage,
    loadProjectsPage,
    loadContractsPage,
    loadDocumentsPage,
    loadAuditLogsPage,
    loadFeedbacksPage,
  ]);

  // Export functions
  const exportProjectsByCurrentQuery = async (): Promise<Project[]> => {
    if (!hasPermission(authUser, 'projects.read')) throw new Error('Bạn không có quyền xuất dữ liệu dự án.');
    const seedQuery = { ...getStoredFilter('projectsPage'), page: 1, per_page: 200 } as PaginatedQuery;
    const rows: Project[] = [];
    let page = 1, totalPages = 1;
    do {
      const result = await fetchProjectsPage({ ...seedQuery, page });
      rows.push(...(result.data || []));
      totalPages = Math.max(1, result.meta?.total_pages || 1);
      page += 1;
    } while (page <= totalPages);
    const seen = new Set<string>();
    return rows.filter((item) => { const key = String(item.id ?? ''); if (!key || seen.has(key)) return false; seen.add(key); return true; });
  };

  const exportContractsByCurrentQuery = async (): Promise<Contract[]> => {
    if (!hasPermission(authUser, 'contracts.read')) throw new Error('Bạn không có quyền xuất dữ liệu hợp đồng.');
    const seedQuery = { ...getStoredFilter('contractsPage'), page: 1, per_page: 200 } as PaginatedQuery;
    const rows: Contract[] = [];
    let page = 1, totalPages = 1;
    do {
      const result = await fetchContractsPage({ ...seedQuery, page });
      rows.push(...(result.data || []));
      totalPages = Math.max(1, result.meta?.total_pages || 1);
      page += 1;
    } while (page <= totalPages);
    const seen = new Set<string>();
    return rows.filter((item) => { const key = String(item.id ?? ''); if (!key || seen.has(key)) return false; seen.add(key); return true; });
  };

  const exportProjectRaciByProjectIds = async (projectIds: Array<string | number>): Promise<ProjectRaciRow[]> => {
    if (!hasPermission(authUser, 'projects.read')) throw new Error('Bạn không có quyền xuất phân công RACI dự án.');
    const normalizedProjectIds = (projectIds || []).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0);
    if (normalizedProjectIds.length === 0) return [];
    const chunkSize = 200;
    const chunks: number[][] = [];
    for (let index = 0; index < normalizedProjectIds.length; index += chunkSize) chunks.push(normalizedProjectIds.slice(index, index + chunkSize));
    const result: ProjectRaciRow[] = [];
    for (const chunk of chunks) { const rows = await fetchProjectRaciAssignments(chunk); result.push(...rows); }
    return result;
  };

  // Dashboard calculations
  const EMPTY_CONTRACT_AGGREGATE_KPIS: ContractAggregateKpis = { draftCount: 0, renewedCount: 0, signedTotalValue: 0, collectionRate: 0, newSignedCount: 0, newSignedValue: 0, totalPipelineValue: 0, overduePaymentAmount: 0, actualCollectedValue: 0 };
  const EMPTY_CUSTOMER_AGGREGATE_KPIS: CustomerAggregateKpis = {
    totalCustomers: 0,
    healthcareCustomers: 0,
    governmentCustomers: 0,
    individualCustomers: 0,
    healthcareBreakdown: {
      publicHospital: 0,
      privateHospital: 0,
      medicalCenter: 0,
      privateClinic: 0,
      tytPkdk: 0,
      other: 0,
    },
  };
  const EMPTY_DASHBOARD_STATS: DashboardStats = { totalRevenue: 0, actualRevenue: 0, forecastRevenueMonth: 0, forecastRevenueQuarter: 0, monthlyRevenueComparison: [], projectStatusCounts: [], contractStatusCounts: [], collectionRate: 0, overduePaymentCount: 0, overduePaymentAmount: 0, expiringContracts: [] };

  const contractAggregateKpis = useMemo<ContractAggregateKpis>(() => {
    if (activeTab !== 'contracts' && activeTab !== 'dashboard') return EMPTY_CONTRACT_AGGREGATE_KPIS;
    return calculateContractKpis(contracts, contractsPageMeta, paymentSchedules);
  }, [activeTab, contracts, contractsPageMeta, paymentSchedules]);

  const customerAggregateKpis = useMemo<CustomerAggregateKpis>(() => {
    if (activeTab !== 'clients') return EMPTY_CUSTOMER_AGGREGATE_KPIS;
    return calculateCustomerKpis(customersPageMeta);
  }, [activeTab, customersPageMeta]);

  const dashboardStats = useMemo<DashboardStats>(() => {
    if (activeTab !== 'dashboard') return EMPTY_DASHBOARD_STATS;
    return calculateDashboardStats(contracts, paymentSchedules, projects, customers);
  }, [activeTab, contracts, customers, paymentSchedules, projects]);

  const hrStatistics: HRStatistics = useMemo(() => buildHrStatistics(employees, departments), [employees, departments]);

  // Loading states
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-bg-light flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          <span className="font-semibold">Đang kiểm tra phiên đăng nhập...</span>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <LoginPage isLoading={isLoginLoading} errorMessage={loginError} infoMessage={loginInfoMessage} onSubmit={handleLogin} />;
  }

  if (passwordChangeRequired) {
    return (
      <div className="min-h-screen bg-bg-light flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center"><span className="material-symbols-outlined">lock_reset</span></div>
            <div><h2 className="text-xl font-bold text-slate-900">Đổi mật khẩu bắt buộc</h2><p className="text-sm text-slate-600">Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng hệ thống.</p></div>
          </div>
          <div className="space-y-4">
            <label className="block"><span className="text-sm font-medium text-slate-700">Mật khẩu hiện tại</span><input type="password" autoComplete="current-password" value={passwordChangeForm.current_password} onChange={(e) => setPasswordChangeForm((c) => ({ ...c, current_password: e.target.value }))} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" /></label>
            <label className="block"><span className="text-sm font-medium text-slate-700">Mật khẩu mới</span><input type="password" autoComplete="new-password" value={passwordChangeForm.new_password} onChange={(e) => setPasswordChangeForm((c) => ({ ...c, new_password: e.target.value }))} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" /></label>
            <label className="block"><span className="text-sm font-medium text-slate-700">Xác nhận mật khẩu mới</span><input type="password" autoComplete="new-password" value={passwordChangeForm.new_password_confirmation} onChange={(e) => setPasswordChangeForm((c) => ({ ...c, new_password_confirmation: e.target.value }))} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" /></label>
            {passwordChangeError ? <p className="text-sm text-red-600">{passwordChangeError}</p> : <p className="text-xs text-slate-500">Mật khẩu mới cần tối thiểu 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.</p>}
          </div>
          <div className="mt-6 flex items-center justify-end gap-3">
            <button type="button" onClick={handleLogout} className="h-11 px-4 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50" disabled={isPasswordChanging}>Đăng xuất</button>
            <button type="button" onClick={handleChangePasswordRequired} disabled={isPasswordChanging} className="h-11 px-5 rounded-lg bg-primary text-white font-semibold hover:bg-deep-teal disabled:opacity-60">{isPasswordChanging ? 'Đang lưu...' : 'Đổi mật khẩu'}</button>
          </div>
        </div>
      </div>
    );
  }

  if (visibleTabIds.size === 0) {
    return (
      <div className="min-h-screen bg-bg-light flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl p-6 md:p-8">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><span className="material-symbols-outlined">lock</span></div>
            <div><h2 className="text-lg font-bold text-slate-900">Tài khoản chưa có menu khả dụng</h2><p className="mt-2 text-sm text-slate-600">Phiên đăng nhập hiện tại không có tab nào hợp lệ để hiển thị.</p></div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={handleLogout} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">Đăng xuất</button>
            <button type="button" onClick={() => window.location.reload()} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">Tải lại</button>
          </div>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="flex h-screen bg-bg-light overflow-hidden flex-col lg:flex-row">
      <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600 p-1"><span className="material-symbols-outlined">menu</span></button>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-primary"><span className="material-symbols-outlined text-lg">business</span></div>
          <h1 className="text-sm font-bold text-slate-900">VNPT Business</h1>
        </div>
      </div>
      <Sidebar activeTab={activeTab} setActiveTab={handleNavigateTab} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} currentUser={authUser} visibleTabIds={visibleTabIds} onLogout={handleLogout} onPrefetchTab={prefetchTabModules} />
      <main className="flex-1 overflow-y-auto bg-bg-light w-full">
        <Suspense fallback={<LazyModuleFallback />}>
          <AppPages
            activeTab={activeTab} authUser={authUser} activeInternalUserSubTab={activeInternalUserSubTab} setInternalUserSubTab={handleInternalUserSubTabChange}
            handleOpenModal={handleOpenModal} addToast={addToast}
            departments={departments} employees={employees} businesses={businesses} vendors={vendors} products={products} customers={customers} cusPersonnel={cusPersonnel}
            projects={projects} projectItems={projectItems} contracts={contracts} paymentSchedules={paymentSchedules} reminders={reminders} userDeptHistory={userDeptHistory}
            supportServiceGroups={supportServiceGroups} supportContactPositions={supportContactPositions} supportRequestStatuses={supportRequestStatuses} projectTypes={projectTypes}
            worklogActivityTypes={worklogActivityTypes} supportSlaConfigs={supportSlaConfigs} userAccessRecords={userAccessRecords} roles={roles} permissions={permissions}
            dashboardStats={dashboardStats} hrStatistics={hrStatistics} contractAggregateKpis={contractAggregateKpis} customerAggregateKpis={customerAggregateKpis}
            employeesPageRows={employeesPageRows} employeesPageMeta={employeesPageMeta} employeesPageLoading={employeesPageLoading} handleEmployeesPageQueryChange={handleEmployeesPageQueryChange}
            partyProfilesPageRows={partyProfilesPageRows} partyProfilesPageMeta={partyProfilesPageMeta} partyProfilesPageLoading={partyProfilesPageLoading} handlePartyProfilesPageQueryChange={handlePartyProfilesPageQueryChange}
            customersPageRows={customersPageRows} customersPageMeta={customersPageMeta} customersPageLoading={customersPageLoading} handleCustomersPageQueryChange={handleCustomersPageQueryChange}
            projectsPageRows={projectsPageRows} projectsPageMeta={projectsPageMeta} projectsPageLoading={projectsPageLoading} handleProjectsPageQueryChange={handleProjectsPageQueryChange}
            contractsPageRows={contractsPageRows} contractsPageMeta={contractsPageMeta} contractsPageLoading={contractsPageLoading} handleContractsPageQueryChange={handleContractsPageQueryChange}
            documentsPageRows={documentsPageRows} documentsPageMeta={documentsPageMeta} documentsPageLoading={documentsPageLoading} handleDocumentsPageQueryChange={handleDocumentsPageQueryChange}
            auditLogsPageRows={auditLogsPageRows} auditLogsPageMeta={auditLogsPageMeta} auditLogsPageLoading={auditLogsPageLoading} handleAuditLogsPageQueryChange={handleAuditLogsPageQueryChange}
            feedbacksPageRows={feedbacksPageRows} feedbacksPageMeta={feedbacksPageMeta} feedbacksPageLoading={feedbacksPageLoading} handleFeedbacksPageQueryChange={handleFeedbacksPageQueryChange}
            handleCreateContractFromProject={(project) => setModalType('ADD_CONTRACT')} handleOpenProcedure={(project) => setProcedureProject(project)}
            exportProjectsByCurrentQuery={exportProjectsByCurrentQuery} exportProjectRaciByProjectIds={exportProjectRaciByProjectIds} exportContractsByCurrentQuery={exportContractsByCurrentQuery}
            handleCreateSupportServiceGroup={handleCreateSupportServiceGroup}
            handleUpdateSupportServiceGroup={handleUpdateSupportServiceGroup}
            handleCreateSupportContactPosition={handleCreateSupportContactPosition}
            handleCreateSupportContactPositionsBulk={handleCreateSupportContactPositionsBulk}
            handleUpdateSupportContactPosition={handleUpdateSupportContactPosition}
            handleCreateSupportRequestStatus={handleCreateSupportRequestStatus}
            handleUpdateSupportRequestStatusDefinition={handleUpdateSupportRequestStatus}
            handleCreateProjectType={handleCreateProjectType}
            handleUpdateProjectType={handleUpdateProjectType}
            handleCreateWorklogActivityType={handleCreateWorklogActivityType}
            handleUpdateWorklogActivityType={handleUpdateWorklogActivityType}
            handleCreateSupportSlaConfig={handleCreateSupportSlaConfig}
            handleUpdateSupportSlaConfig={handleUpdateSupportSlaConfig}
            refreshAccessControlData={refreshAccessControlData}
            handleUpdateAccessRoles={handleUpdateAccessRoles}
            handleBulkUpdateAccessRoles={handleBulkUpdateAccessRoles}
            handleBulkUpdateAccessPermissions={handleBulkUpdateAccessPermissions}
            handleBulkUpdateAccessScopes={handleBulkUpdateAccessScopes}
            handleUpdateAccessPermissions={handleUpdateAccessPermissions}
            handleUpdateAccessScopes={handleUpdateAccessScopes}
            backblazeB2Settings={backblazeB2Settings} googleDriveSettings={googleDriveSettings} contractExpiryAlertSettings={contractExpiryAlertSettings} contractPaymentAlertSettings={contractPaymentAlertSettings}
            isBackblazeB2SettingsLoading={isBackblazeB2SettingsLoading} isGoogleDriveSettingsLoading={isGoogleDriveSettingsLoading} isContractExpiryAlertSettingsLoading={isContractExpiryAlertSettingsLoading}
            isContractPaymentAlertSettingsLoading={isContractPaymentAlertSettingsLoading} isGoogleDriveSettingsSaving={isGoogleDriveSettingsSaving} isGoogleDriveSettingsTesting={isGoogleDriveSettingsTesting}
            isBackblazeB2SettingsSaving={isBackblazeB2SettingsSaving} isBackblazeB2SettingsTesting={isBackblazeB2SettingsTesting} isContractExpiryAlertSettingsSaving={isContractExpiryAlertSettingsSaving}
            isContractPaymentAlertSettingsSaving={isContractPaymentAlertSettingsSaving}
            refreshIntegrationSettings={refreshIntegrationSettings}
            handleSaveBackblazeB2Settings={handleSaveBackblazeB2Settings}
            handleSaveGoogleDriveSettings={handleSaveGoogleDriveSettings}
            handleSaveContractExpiryAlertSettings={handleSaveContractExpiryAlertSettings}
            handleSaveContractPaymentAlertSettings={handleSaveContractPaymentAlertSettings}
            handleTestBackblazeB2Integration={handleTestBackblazeB2Integration}
            handleTestGoogleDriveIntegration={handleTestGoogleDriveIntegration}
          />
        </Suspense>
      </main>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {employeeProvisioning && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div><h3 className="text-lg font-bold text-slate-900">Mật khẩu tạm thời</h3><p className="text-sm text-slate-600 mt-1">Tài khoản: <span className="font-semibold text-slate-800">{employeeProvisioning.employeeLabel}</span></p></div>
              <button type="button" onClick={() => setEmployeeProvisioning(null)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Mật khẩu chỉ hiển thị một lần. Vui lòng bàn giao an toàn cho người dùng và yêu cầu đổi mật khẩu ngay sau đăng nhập.</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Temporary password</p><p className="font-mono text-base text-slate-900 break-all">{employeeProvisioning.provisioning.temporary_password}</p></div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(employeeProvisioning.provisioning.temporary_password); addToast('success', 'Sao chép thành công', 'Đã sao chép mật khẩu tạm vào clipboard.'); } catch { addToast('error', 'Không thể sao chép', 'Trình duyệt không cho phép sao chép tự động.'); } }} className="h-10 px-4 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100">Sao chép</button>
              <button type="button" onClick={() => setEmployeeProvisioning(null)} className="h-10 px-4 rounded-lg bg-primary text-white font-semibold hover:bg-deep-teal">Đã hiểu</button>
            </div>
          </div>
        </div>
      )}
      {/* Modals */}
      <Suspense fallback={null}>
        {modalType === 'ADD_DEPARTMENT' && <DepartmentFormModal type="ADD" data={selectedDept} departments={departments} onClose={() => setModalType(null)} onSave={async (d) => { const saved = await handleSaveDepartment(d, 'ADD_DEPARTMENT', null); if (saved) { setModalType(null); } }} isLoading={isDepartmentSaving} />}
        {modalType === 'EDIT_DEPARTMENT' && <DepartmentFormModal type="EDIT" data={selectedDept} departments={departments} onClose={() => setModalType(null)} onSave={async (d) => { const saved = await handleSaveDepartment(d, 'EDIT_DEPARTMENT', selectedDept); if (saved) { setModalType(null); } }} isLoading={isDepartmentSaving} />}
        {modalType === 'VIEW_DEPARTMENT' && selectedDept && <ViewDepartmentModal data={selectedDept} departments={departments} onClose={() => setModalType(null)} onEdit={() => { setModalType('EDIT_DEPARTMENT'); }} />}
        {modalType === 'DELETE_DEPARTMENT' && selectedDept && <DeleteWarningModal data={selectedDept} onClose={() => setModalType(null)} onConfirm={async () => { const deleted = await handleDeleteDepartment(selectedDept); if (deleted) { setModalType(null); } }} />}
        {modalType === 'IMPORT_DATA' && <ImportModal title={importModalTitle} moduleKey={importModalModuleKey} onClose={() => setModalType(null)} onSave={handleImportData} isLoading={isSaving} loadingText={importLoadingText} />}
        {modalType === 'ADD_EMPLOYEE' && <EmployeeFormModal type="ADD" data={selectedEmployee} departments={departments} onClose={() => setModalType(null)} onSave={async (d) => { setIsSaving(true); try { const result = await createEmployeeWithProvisioning(d); setEmployees((previous) => [result.employee, ...(previous || []).filter((item) => String(item.id) !== String(result.employee.id))]); await loadEmployeesPage(); if (result.provisioning?.temporary_password) { setEmployeeProvisioning({ employeeLabel: result.employee.user_code || `#${result.employee.id}`, provisioning: result.provisioning }); } setModalType(null); } finally { setIsSaving(false); } }} isLoading={isSaving} onResetPassword={undefined} isResettingPassword={false} />}
        {modalType === 'EDIT_EMPLOYEE' && <EmployeeFormModal type="EDIT" data={selectedEmployee} departments={departments} onClose={() => setModalType(null)} onSave={async (d) => { if (!selectedEmployee) { return; } setIsSaving(true); try { const updated = await updateEmployee(selectedEmployee.id, d); setEmployees((previous) => previous.map((item) => (String(item.id) === String(updated.id) ? updated : item))); await loadEmployeesPage(); setModalType(null); } finally { setIsSaving(false); } }} isLoading={isSaving} onResetPassword={async () => { if (!selectedEmployee) return; setIsEmployeePasswordResetting(true); try { const result = await resetEmployeePassword(selectedEmployee.id); setEmployees((previous) => previous.map((emp) => String(emp.id) === String(result.employee.id) ? result.employee : emp)); await loadEmployeesPage(); if (result.provisioning?.temporary_password) { setEmployeeProvisioning({ employeeLabel: result.employee.user_code || `#${result.employee.id}`, provisioning: result.provisioning }); } } finally { setIsEmployeePasswordResetting(false); } }} isResettingPassword={isEmployeePasswordResetting} />}
        {modalType === 'DELETE_EMPLOYEE' && selectedEmployee && <DeleteEmployeeModal data={selectedEmployee} onClose={() => setModalType(null)} onConfirm={async () => { await deleteEmployee(selectedEmployee.id); setEmployees((previous) => previous.filter((item) => String(item.id) !== String(selectedEmployee.id))); await loadEmployeesPage(); setModalType(null); }} />}
        {modalType === 'ADD_PARTY_PROFILE' && (
          <EmployeePartyProfileModal
            type="ADD"
            data={selectedPartyProfile}
            employees={employees}
            departments={departments}
            existingProfiles={partyProfilesPageRows}
            onClose={() => setModalType(null)}
            onSave={async (payload) => {
              if (!payload.employee_id) return;
              setIsSaving(true);
              try {
                await upsertEmployeePartyProfile(payload.employee_id, payload);
                await loadPartyProfilesPage();
                setModalType(null);
                addToast('success', 'Hồ sơ Đảng viên', 'Đã lưu hồ sơ đảng viên.');
              } finally {
                setIsSaving(false);
              }
            }}
          />
        )}
        {modalType === 'EDIT_PARTY_PROFILE' && (
          <EmployeePartyProfileModal
            type="EDIT"
            data={selectedPartyProfile}
            employees={employees}
            departments={departments}
            existingProfiles={partyProfilesPageRows}
            onClose={() => setModalType(null)}
            onSave={async (payload) => {
              const employeeId = payload.employee_id || selectedPartyProfile?.employee_id;
              if (!employeeId) return;
              setIsSaving(true);
              try {
                await upsertEmployeePartyProfile(employeeId, payload);
                await loadPartyProfilesPage();
                setModalType(null);
                addToast('success', 'Hồ sơ Đảng viên', 'Đã cập nhật hồ sơ đảng viên.');
              } finally {
                setIsSaving(false);
              }
            }}
          />
        )}
        {modalType === 'ADD_BUSINESS' && <BusinessFormModal type="ADD" data={selectedBusiness} onClose={() => setModalType(null)} onSave={async (d) => { setIsSaving(true); try { const created = await createBusiness(d); setBusinesses((prev) => [created, ...prev.filter((item) => String(item.id) !== String(created.id))]); setModalType(null); } finally { setIsSaving(false); } }} />}
        {modalType === 'EDIT_BUSINESS' && <BusinessFormModal type="EDIT" data={selectedBusiness} onClose={() => setModalType(null)} onSave={async (d) => { setIsSaving(true); try { if (selectedBusiness) { const updated = await updateBusiness(selectedBusiness.id, d); setBusinesses((prev) => prev.map((item) => (String(item.id) === String(updated.id) ? updated : item))); } setModalType(null); } finally { setIsSaving(false); } }} />}
        {modalType === 'DELETE_BUSINESS' && selectedBusiness && <DeleteBusinessModal data={selectedBusiness} onClose={() => setModalType(null)} onConfirm={async () => { await deleteBusiness(selectedBusiness.id); setBusinesses((prev) => prev.filter((item) => String(item.id) !== String(selectedBusiness.id))); setModalType(null); }} />}
        {modalType === 'ADD_VENDOR' && <VendorFormModal type="ADD" data={selectedVendor} onClose={() => setModalType(null)} onSave={async (d) => { setIsSaving(true); await createVendor(d); setModalType(null); setIsSaving(false); }} />}
        {modalType === 'EDIT_VENDOR' && <VendorFormModal type="EDIT" data={selectedVendor} onClose={() => setModalType(null)} onSave={async (d) => { setIsSaving(true); if (selectedVendor) { await updateVendor(selectedVendor.id, d); } setModalType(null); setIsSaving(false); }} />}
        {modalType === 'DELETE_VENDOR' && selectedVendor && <DeleteVendorModal data={selectedVendor} onClose={() => setModalType(null)} onConfirm={async () => { await deleteVendor(selectedVendor.id); setModalType(null); }} />}
        {modalType === 'ADD_FEEDBACK' && <FeedbackFormModal type="ADD" data={selectedFeedback} isSaving={isSaving} onClose={() => setModalType(null)} onSave={async (d) => { setIsSaving(true); await createFeedback({ title: d.title, description: d.description || null, priority: d.priority }); setModalType(null); setIsSaving(false); }} />}
        {modalType === 'EDIT_FEEDBACK' && <FeedbackFormModal type="EDIT" data={selectedFeedback} isSaving={isSaving || isFeedbackDetailLoading} onClose={() => setModalType(null)} onSave={async (d) => { setIsSaving(true); if (selectedFeedback) { await updateFeedback(selectedFeedback.id, { title: d.title, description: d.description || null, priority: d.priority }); } setModalType(null); setIsSaving(false); }} />}
        {modalType === 'VIEW_FEEDBACK' && <FeedbackViewModal data={selectedFeedback} employees={employees} onClose={() => setModalType(null)} onEdit={() => { if (hasPermission(authUser, 'feedback_requests.write') && selectedFeedback) { setSelectedFeedback(selectedFeedback); setModalType('EDIT_FEEDBACK'); } }} />}
        {modalType === 'DELETE_FEEDBACK' && selectedFeedback && <DeleteFeedbackModal data={selectedFeedback} onClose={() => setModalType(null)} onConfirm={async () => { await deleteFeedback(selectedFeedback.id); setModalType(null); }} />}
        {modalType === 'ADD_PRODUCT' && <ProductFormModal type="ADD" data={null} businesses={businesses} vendors={vendors} onClose={() => setModalType(null)} onSave={handleCreateProductSave} />}
        {modalType === 'EDIT_PRODUCT' && <ProductFormModal type="EDIT" data={selectedProduct} businesses={businesses} vendors={vendors} onClose={() => setModalType(null)} onSave={handleEditProductSave} />}
        {modalType === 'DELETE_PRODUCT' && selectedProduct && <DeleteProductModal data={selectedProduct} onClose={() => setModalType(null)} onConfirm={handleDeleteProductConfirm} />}
        {modalType === 'CANNOT_DELETE_PRODUCT' && selectedProduct && <CannotDeleteProductModal data={selectedProduct} reason={productDeleteDependencyMessage} onClose={() => setModalType(null)} />}
        {modalType === 'PRODUCT_FEATURE_CATALOG' && selectedProduct && <ProductFeatureCatalogModal product={selectedProduct} canManage={hasPermission(authUser, 'products.write')} onClose={() => setModalType(null)} onNotify={addToast} />}
        {modalType === 'PRODUCT_TARGET_SEGMENT' && selectedProduct && <ProductTargetSegmentModal product={selectedProduct} canManage={hasPermission(authUser, 'products.write')} onClose={() => setModalType(null)} onNotify={addToast} />}
        {modalType === 'ADD_CUSTOMER' && <CustomerFormModal type="ADD" data={selectedCustomer} onClose={() => setModalType(null)} onSave={handleCreateCustomerSave} />}
        {modalType === 'EDIT_CUSTOMER' && <CustomerFormModal type="EDIT" data={selectedCustomer} onClose={() => setModalType(null)} onSave={handleUpdateCustomerSave} />}
        {modalType === 'DELETE_CUSTOMER' && selectedCustomer && <DeleteCustomerModal data={selectedCustomer} onClose={() => setModalType(null)} onConfirm={async () => { try { await deleteCustomer(selectedCustomer.id); setCustomers((previous) => previous.filter((item) => String(item.id) !== String(selectedCustomer.id))); setCustomersPageRows((previous) => previous.filter((item) => String(item.id) !== String(selectedCustomer.id))); await loadCustomersPage(); setModalType(null); } catch (error) { if (isCustomerDeleteDependencyError(error)) { setModalType('CANNOT_DELETE_CUSTOMER'); } } }} />}
        {modalType === 'CANNOT_DELETE_CUSTOMER' && selectedCustomer && <CannotDeleteCustomerModal data={selectedCustomer} onClose={() => setModalType(null)} />}
        {modalType === 'CUSTOMER_INSIGHT' && selectedCustomer && <CustomerInsightPanel customer={selectedCustomer} onClose={() => setModalType(null)} />}
        {modalType === 'ADD_CUS_PERSONNEL' && <CusPersonnelFormModal type="ADD" data={selectedCusPersonnel} customers={customers} supportContactPositions={supportContactPositions} isCustomersLoading={isCustomersLoading} isSupportContactPositionsLoading={false} onClose={() => setModalType(null)} onSave={async (d) => { setIsSaving(true); const normalizedBirthday = normalizeImportDate(String(d.birthday || '')) || String(d.birthday || ''); await createCustomerPersonnel({ ...d, birthday: normalizedBirthday }); setModalType(null); setIsSaving(false); }} />}
        {modalType === 'EDIT_CUS_PERSONNEL' && <CusPersonnelFormModal type="EDIT" data={selectedCusPersonnel} customers={customers} supportContactPositions={supportContactPositions} isCustomersLoading={isCustomersLoading} isSupportContactPositionsLoading={false} onClose={() => setModalType(null)} onSave={async (d) => { setIsSaving(true); if (selectedCusPersonnel) { const normalizedBirthday = normalizeImportDate(String(d.birthday || '')) || String(d.birthday || ''); await updateCustomerPersonnel(selectedCusPersonnel.id, { ...d, birthday: normalizedBirthday }); } setModalType(null); setIsSaving(false); }} />}
        {modalType === 'DELETE_CUS_PERSONNEL' && selectedCusPersonnel && <DeleteCusPersonnelModal data={selectedCusPersonnel} onClose={() => setModalType(null)} onConfirm={async () => { await deleteCustomerPersonnel(selectedCusPersonnel.id); setModalType(null); }} />}
        {modalType === 'ADD_PROJECT' && <ProjectFormModal type="ADD" data={selectedProject} initialTab={projectModalInitialTab} customers={customers} products={products} projectItems={projectItems} projectTypes={projectTypes} employees={employees} departments={departments} isCustomersLoading={isCustomersLoading} isProductsLoading={false} isEmployeesLoading={isEmployeesLoading} isDepartmentsLoading={isDepartmentsLoading} isProjectTypesLoading={false} onClose={() => setModalType(null)} onSave={handleCreateProjectSave} onNotify={addToast} onImportProjectItemsBatch={async () => ({ success_projects: [], failed_projects: [] })} onImportProjectRaciBatch={async () => ({ success_projects: [], failed_projects: [] })} onViewProcedure={(project) => { setModalType(null); setProcedureProject(project); }} />}
        {modalType === 'EDIT_PROJECT' && <ProjectFormModal type="EDIT" data={selectedProject} initialTab={projectModalInitialTab} customers={customers} products={products} projectItems={projectItems} projectTypes={projectTypes} employees={employees} departments={departments} isCustomersLoading={isCustomersLoading} isProductsLoading={false} isEmployeesLoading={isEmployeesLoading} isDepartmentsLoading={isDepartmentsLoading} isProjectTypesLoading={false} onClose={() => setModalType(null)} onSave={handleEditProjectSave} onNotify={addToast} onImportProjectItemsBatch={async () => ({ success_projects: [], failed_projects: [] })} onImportProjectRaciBatch={async () => ({ success_projects: [], failed_projects: [] })} onViewProcedure={(project) => { setModalType(null); setProcedureProject(project); }} />}
        {modalType === 'DELETE_PROJECT' && selectedProject && <DeleteProjectModal data={selectedProject} onClose={() => setModalType(null)} onConfirm={async () => { await deleteProject(selectedProject.id); setProjects((previous) => previous.filter((item) => String(item.id) !== String(selectedProject.id))); setProjectsPageRows((previous) => previous.filter((item) => String(item.id) !== String(selectedProject.id))); await loadProjectsPage(); await loadProjectItems(); setModalType(null); }} />}
        {modalType === 'ADD_CONTRACT' && <ContractModal type="ADD" data={null} prefill={contractAddPrefill} projects={projects} projectTypes={projectTypes} businesses={businesses} products={products} projectItems={projectItems} customers={customers} paymentSchedules={paymentSchedules} isCustomersLoading={isCustomersLoading} isProjectsLoading={isProjectsLoading} isProductsLoading={false} isProjectItemsLoading={isProjectsLoading} isDetailLoading={false} isPaymentLoading={isPaymentScheduleLoading} isSaving={isSaving || isContractsLoading} onClose={() => setModalType(null)} onSave={handleCreateContractSave} onGenerateSchedules={handleGenerateContractSchedules} onRefreshSchedules={handleRefreshContractSchedules} onConfirmPayment={handleConfirmContractPayment} />}
        {modalType === 'EDIT_CONTRACT' && <ContractModal type="EDIT" data={selectedContract} prefill={null} projects={projects} projectTypes={projectTypes} businesses={businesses} products={products} projectItems={projectItems} customers={customers} paymentSchedules={paymentSchedules} isCustomersLoading={isCustomersLoading} isProjectsLoading={isProjectsLoading} isProductsLoading={false} isProjectItemsLoading={isProjectsLoading} isDetailLoading={isContractDetailLoading} isPaymentLoading={isPaymentScheduleLoading} isSaving={isSaving || isContractsLoading} onClose={() => setModalType(null)} onSave={handleUpdateContractSave} onGenerateSchedules={handleGenerateContractSchedules} onRefreshSchedules={handleRefreshContractSchedules} onConfirmPayment={handleConfirmContractPayment} />}
        {modalType === 'DELETE_CONTRACT' && selectedContract && <DeleteContractModal data={selectedContract} onClose={() => setModalType(null)} onConfirm={async () => { await deleteContract(selectedContract.id); setContracts((previous) => previous.filter((item) => String(item.id) !== String(selectedContract.id))); setContractsPageRows((previous) => previous.filter((item) => String(item.id) !== String(selectedContract.id))); setPaymentSchedules((previous) => previous.filter((item) => String(item.contract_id) !== String(selectedContract.id))); await loadContractsPage(); setModalType(null); }} />}
        {procedureProject && <ProjectProcedureModal project={procedureProject} isOpen={true} onClose={() => setProcedureProject(null)} onNotify={addToast} projectTypes={projectTypes} authUser={authUser} />}
        {modalType === 'ADD_DOCUMENT' && <DocumentFormModal type="ADD" data={selectedDocument} customers={customers} projects={projects} products={products} preselectedProduct={null} mode="default" isCustomersLoading={isCustomersLoading} isProjectsLoading={isProjectsLoading} isProductsLoading={false} onClose={() => setModalType(null)} onSave={async (d) => { setIsSaving(true); try { const created = await createDocument({ ...d, scope: 'DEFAULT' }); setDocuments((previous) => [created, ...(previous || []).filter((item) => String(item.id) !== String(created.id))]); await loadDocumentsPage(); setModalType(null); } finally { setIsSaving(false); } }} />}
        {modalType === 'EDIT_DOCUMENT' && <DocumentFormModal type="EDIT" data={selectedDocument} customers={customers} projects={projects} products={products} preselectedProduct={null} mode="default" isCustomersLoading={isCustomersLoading} isProjectsLoading={isProjectsLoading} isProductsLoading={false} onClose={() => setModalType(null)} onSave={async (d) => { if (!selectedDocument) { return; } setIsSaving(true); try { const updated = await updateDocument(selectedDocument.id, { ...d, scope: 'DEFAULT' }); setDocuments((previous) => previous.map((item) => (String(item.id) === String(updated.id) ? updated : item))); await loadDocumentsPage(); setModalType(null); } finally { setIsSaving(false); } }} />}
        {modalType === 'DELETE_DOCUMENT' && selectedDocument && <DeleteDocumentModal data={selectedDocument} onClose={() => setModalType(null)} onConfirm={async () => { await deleteDocument(selectedDocument.id); setDocuments((previous) => previous.filter((item) => String(item.id) !== String(selectedDocument.id))); await loadDocumentsPage(); setModalType(null); }} />}
        {modalType === 'ADD_REMINDER' && <ReminderFormModal type="ADD" data={selectedReminder} employees={employees} onClose={() => setModalType(null)} onSave={async (d) => { setIsSaving(true); setReminders([{ ...d, id: `REM${Date.now()}`, createdDate: new Date().toLocaleDateString('vi-VN') } as Reminder, ...reminders]); setModalType(null); setIsSaving(false); }} />}
        {modalType === 'EDIT_REMINDER' && <ReminderFormModal type="EDIT" data={selectedReminder} employees={employees} onClose={() => setModalType(null)} onSave={async (d) => { setIsSaving(true); setReminders(reminders.map(r => r.id === selectedReminder?.id ? { ...d, id: selectedReminder.id } : r)); setModalType(null); setIsSaving(false); }} />}
        {modalType === 'DELETE_REMINDER' && selectedReminder && <DeleteReminderModal data={selectedReminder} onClose={() => setModalType(null)} onConfirm={async () => { setReminders(reminders.filter(r => r.id !== selectedReminder.id)); setModalType(null); }} />}
        {modalType === 'ADD_USER_DEPT_HISTORY' && <UserDeptHistoryFormModal type="ADD" data={selectedUserDeptHistory} employees={employees} departments={departments} onClose={() => setModalType(null)} onSave={async (d) => { setIsSaving(true); setUserDeptHistory([{ ...d, id: `TRANSFER${Date.now()}`, createdDate: new Date().toLocaleDateString('vi-VN') } as UserDeptHistory, ...userDeptHistory]); setModalType(null); setIsSaving(false); }} />}
        {modalType === 'EDIT_USER_DEPT_HISTORY' && <UserDeptHistoryFormModal type="EDIT" data={selectedUserDeptHistory} employees={employees} departments={departments} onClose={() => setModalType(null)} onSave={async (d) => { setIsSaving(true); setUserDeptHistory(userDeptHistory.map(h => h.id === selectedUserDeptHistory?.id ? { ...d, id: selectedUserDeptHistory.id } : h)); setModalType(null); setIsSaving(false); }} />}
        {modalType === 'DELETE_USER_DEPT_HISTORY' && selectedUserDeptHistory && <DeleteUserDeptHistoryModal data={selectedUserDeptHistory} onClose={() => setModalType(null)} onConfirm={async () => { setUserDeptHistory(userDeptHistory.filter(h => h.id !== selectedUserDeptHistory.id)); setModalType(null); }} />}
      </Suspense>
    </div>
  );
};

export default App;
