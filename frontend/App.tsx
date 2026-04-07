import React, { Suspense, lazy, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './components/LoginPage';
import { ToastContainer } from './components/Toast';
import { AppPages } from './AppPages';
import { useImportCustomers } from './hooks/useImportCustomers';
import { useImportCustomerPersonnel } from './hooks/useImportCustomerPersonnel';
import { useImportDepartments } from './hooks/useImportDepartments';
import { useImportEmployees } from './hooks/useImportEmployees';
import { useImportEmployeePartyProfiles } from './hooks/useImportEmployeePartyProfiles';
import { useImportProducts } from './hooks/useImportProducts';
import { useCustomerPersonnel } from './hooks/useCustomerPersonnel';
import { useToastQueue } from './hooks/useToastQueue';
import { useTabSession } from './hooks/useTabSession';
import type { InternalUserSubTab } from './components/InternalUserModuleTabs';
import type {
  ImportPayload,
  ProjectItemImportBatchGroup,
  ProjectItemImportBatchResult,
  ProjectRaciImportBatchGroup,
  ProjectRaciImportBatchResult,
} from './components/modals/projectImportTypes';
import {
  AuditLog, Department, Employee, Business, Vendor, Product, Customer, CustomerPersonnel,
  Project, ProjectItem, ProjectItemMaster, ProjectRACI, ProjectRaciRow, Contract, Document, Reminder, UserDeptHistory,
  ModalType, DashboardStats, ContractAggregateKpis, CustomerAggregateKpis, PaymentSchedule,
  PaymentScheduleConfirmationPayload, HRStatistics, SupportServiceGroup, SupportContactPosition,
  ProductUnitMaster, SupportRequestStatusOption, SupportSlaConfigOption, AuthUser, EmployeeProvisioning, Role,
  Permission, UserAccessRecord, BackblazeB2IntegrationSettings, GoogleDriveIntegrationSettings,
  EmailSmtpIntegrationSettings, EmailSmtpIntegrationSettingsUpdatePayload,
  SendReminderEmailResult,
  ContractExpiryAlertSettings, ContractPaymentAlertSettings, BackblazeB2IntegrationSettingsUpdatePayload,
  GoogleDriveIntegrationSettingsUpdatePayload, ContractExpiryAlertSettingsUpdatePayload,
  ContractPaymentAlertSettingsUpdatePayload, PaginatedQuery, PaginationMeta, WorklogActivityTypeOption,
  ProjectTypeOption, FeedbackRequest, FeedbackPriority, FeedbackStatus, Attachment, ExpiringContractSummary,
  EmployeePartyProfile,
} from './types';
import { buildHrStatistics } from './utils/hrAnalytics';
import { canAccessTab } from './utils/authorization';
import { DEFAULT_PRODUCT_SERVICE_GROUP, normalizeProductServiceGroup } from './utils/productServiceGroup';
import { normalizeProductUnitForSave } from './utils/productUnit';
import { calculateDashboardStats, calculateContractKpis, calculateCustomerKpis } from './utils/dashboardCalculations';
import {
  DEFAULT_PAGINATION_META, fetchAuthBootstrap, fetchCurrentUser, login, logout, changePasswordFirstLogin,
  fetchDepartments, fetchEmployees, fetchBusinesses, fetchVendors, fetchProducts, fetchCustomers,
  fetchProjects, fetchProjectItems, fetchContracts, fetchContractDetail, fetchPaymentSchedules,
  fetchDocuments, fetchReminders, fetchUserDeptHistory, fetchAuditLogs, fetchSupportServiceGroups,
  createReminder, updateReminder, deleteReminder, sendReminderEmail,
  createUserDeptHistory, updateUserDeptHistory, deleteUserDeptHistory,
  fetchSupportContactPositions, fetchProductUnitMasters, fetchSupportRequestStatuses, fetchProjectTypes, fetchWorklogActivityTypes,
  fetchSupportSlaConfigs, fetchRoles, fetchPermissions, fetchUserAccess, fetchBackblazeB2IntegrationSettings,
  fetchGoogleDriveIntegrationSettings, fetchEmailSmtpIntegrationSettings, fetchContractExpiryAlertSettings, fetchContractPaymentAlertSettings,
  fetchFeedbacksPage, fetchEmployeesPage, fetchCustomersPage, fetchProjectsPage,
  fetchContractsPage, fetchDocumentsPage, fetchAuditLogsPage, createFeedback, updateFeedback, deleteFeedback,
  createSupportServiceGroup, createSupportServiceGroupsBulk, updateSupportServiceGroup,
  createSupportContactPosition, createProductUnitMaster, createSupportContactPositionsBulk, updateSupportContactPosition,
  updateProductUnitMaster,
  createSupportRequestStatus, updateSupportRequestStatusDefinition,
  createProjectType, updateProjectType, createWorklogActivityType, updateWorklogActivityType,
  createSupportSlaConfig, updateSupportSlaConfig, updateUserAccessRoles, updateUserAccessPermissions,
  updateUserAccessDeptScopes, updateBackblazeB2IntegrationSettings, updateGoogleDriveIntegrationSettings,
  updateEmailSmtpIntegrationSettings,
  updateContractExpiryAlertSettings, updateContractPaymentAlertSettings, testBackblazeB2IntegrationSettings,
  testGoogleDriveIntegrationSettings, testEmailSmtpIntegrationSettings, generateContractPayments, updatePaymentSchedule,
  createContract, updateContract, deleteContract,
  createDepartment, updateDepartment, deleteDepartment, createEmployeeWithProvisioning, updateEmployee,
  deleteEmployee, resetEmployeePassword, createBusiness, updateBusiness, deleteBusiness,
  createVendor, updateVendor, deleteVendor, createProduct, updateProduct, deleteProduct,
  createCustomer, updateCustomer, deleteCustomer, createProject, updateProject, deleteProject, fetchProjectDetail,
  fetchProjectRaciAssignments, createDocument, updateDocument, deleteDocument,
  isRequestCanceledError, isTabEvictedMessage, registerTabEvictedHandler, unregisterTabEvictedHandler,
} from './services/v5Api';
import { fetchFeedbackDetail } from './services/api/adminApi';
import type { GenerateContractPaymentsPayload } from './services/v5Api';
import { normalizeImportToken, normalizeImportDate, isProductDeleteDependencyError, isCustomerDeleteDependencyError } from './utils/importUtils';
import { normalizeQuerySignature } from './utils/queryUtils';
import { canOpenModal, hasPermission, isImportSupportedModule } from './utils/authorization';
import { fetchEmployeePartyProfilesPage, upsertEmployeePartyProfile } from './services/api/employeeApi';

// Lazy components
const ProjectProcedureModal = lazy(() => import('./components/ProjectProcedureModal').then((m) => ({ default: m.ProjectProcedureModal })));
const ContractModal = lazy(() => import('./components/ContractModal').then((m) => ({ default: m.ContractModal })));
const EmployeePartyProfileModal = lazy(() => import('./components/EmployeePartyProfileModal').then((m) => ({ default: m.EmployeePartyProfileModal })));
const FeedbackFormModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.FeedbackFormModal })));
const FeedbackViewModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.FeedbackViewModal })));
const DeleteFeedbackModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.DeleteFeedbackModal })));
const DepartmentFormModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.DepartmentFormModal })));
const ViewDepartmentModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.ViewDepartmentModal })));
const DeleteWarningModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.DeleteWarningModal })));
const CannotDeleteModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.CannotDeleteModal })));
const ImportModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.ImportModal })));
const EmployeeFormModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.EmployeeFormModal })));
const DeleteEmployeeModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.DeleteEmployeeModal })));
const BusinessFormModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.BusinessFormModal })));
const DeleteBusinessModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.DeleteBusinessModal })));
const VendorFormModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.VendorFormModal })));
const DeleteVendorModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.DeleteVendorModal })));
const ProductFormModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.ProductFormModal })));
const DeleteProductModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.DeleteProductModal })));
const CannotDeleteProductModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.CannotDeleteProductModal })));
const ProductFeatureCatalogModal = lazy(() => import('./components/ProductFeatureCatalogModal').then((m) => ({ default: m.ProductFeatureCatalogModal })));
const ProductTargetSegmentModal = lazy(() => import('./components/ProductTargetSegmentModal').then((m) => ({ default: m.ProductTargetSegmentModal })));
const CannotDeleteCustomerModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.CannotDeleteCustomerModal })));
const CustomerInsightPanel = lazy(() => import('./components/CustomerInsightPanel'));
const CustomerFormModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.CustomerFormModal })));
const DeleteCustomerModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.DeleteCustomerModal })));
const CusPersonnelFormModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.CusPersonnelFormModal })));
const DeleteCusPersonnelModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.DeleteCusPersonnelModal })));
const ProjectFormModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.ProjectFormModal })));
const DeleteProjectModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.DeleteProjectModal })));
const DeleteContractModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.DeleteContractModal })));
const DocumentFormModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.DocumentFormModal })));
const DeleteDocumentModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.DeleteDocumentModal })));
const ReminderFormModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.ReminderFormModal })));
const DeleteReminderModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.DeleteReminderModal })));
const UserDeptHistoryFormModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.UserDeptHistoryFormModal })));
const DeleteUserDeptHistoryModal = lazy(() => import('./components/Modals').then((m) => ({ default: m.DeleteUserDeptHistoryModal })));

const LazyModuleFallback: React.FC = () => (
  <div className="min-h-[300px] flex items-center justify-center py-16 text-slate-500">
    <div className="flex items-center gap-2">
      <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
      <span className="font-medium">Đang tải module...</span>
    </div>
  </div>
);

const AVAILABLE_TABS = ['dashboard', 'internal_user_dashboard', 'internal_user_list', 'departments', 'user_dept_history', 'businesses', 'vendors', 'products', 'clients', 'cus_personnel', 'projects', 'contracts', 'documents', 'reminders', 'customer_request_management', 'revenue_mgmt', 'fee_collection', 'workflow_mgmt', 'support_master_management', 'procedure_template_config', 'department_weekly_schedule_management', 'audit_logs', 'user_feedback', 'integration_settings', 'access_control'] as const;

const App: React.FC = () => {
  // Auth state
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginInfoMessage, setLoginInfoMessage] = useState('');
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [passwordChangeForm, setPasswordChangeForm] = useState({ current_password: '', new_password: '', new_password_confirmation: '' });
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);

  // Navigation state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [internalUserSubTab, setInternalUserSubTab] = useState<InternalUserSubTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Entity state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectItems, setProjectItems] = useState<ProjectItemMaster[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [paymentSchedules, setPaymentSchedules] = useState<PaymentSchedule[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [userDeptHistory, setUserDeptHistory] = useState<UserDeptHistory[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackRequest[]>([]);
  const [supportServiceGroups, setSupportServiceGroups] = useState<SupportServiceGroup[]>([]);
  const [supportContactPositions, setSupportContactPositions] = useState<SupportContactPosition[]>([]);
  const [productUnitMasters, setProductUnitMasters] = useState<ProductUnitMaster[]>([]);
  const [supportRequestStatuses, setSupportRequestStatuses] = useState<SupportRequestStatusOption[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeOption[]>([]);
  const [worklogActivityTypes, setWorklogActivityTypes] = useState<WorklogActivityTypeOption[]>([]);
  const [supportSlaConfigs, setSupportSlaConfigs] = useState<SupportSlaConfigOption[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userAccessRecords, setUserAccessRecords] = useState<UserAccessRecord[]>([]);
  const [backblazeB2Settings, setBackblazeB2Settings] = useState<BackblazeB2IntegrationSettings | null>(null);
  const [googleDriveSettings, setGoogleDriveSettings] = useState<GoogleDriveIntegrationSettings | null>(null);
  const [emailSmtpSettings, setEmailSmtpSettings] = useState<EmailSmtpIntegrationSettings | null>(null);
  const [contractExpiryAlertSettings, setContractExpiryAlertSettings] = useState<ContractExpiryAlertSettings | null>(null);
  const [contractPaymentAlertSettings, setContractPaymentAlertSettings] = useState<ContractPaymentAlertSettings | null>(null);

  // Page data state
  const [feedbacksPageRows, setFeedbacksPageRows] = useState<FeedbackRequest[]>([]);
  const [feedbacksPageMeta, setFeedbacksPageMeta] = useState<PaginationMeta | undefined>(undefined);
  const [employeesPageRows, setEmployeesPageRows] = useState<Employee[]>([]);
  const [partyProfilesPageRows, setPartyProfilesPageRows] = useState<EmployeePartyProfile[]>([]);
  const [customersPageRows, setCustomersPageRows] = useState<Customer[]>([]);
  const [projectsPageRows, setProjectsPageRows] = useState<Project[]>([]);
  const [contractsPageRows, setContractsPageRows] = useState<Contract[]>([]);
  const [documentsPageRows, setDocumentsPageRows] = useState<Document[]>([]);
  const [auditLogsPageRows, setAuditLogsPageRows] = useState<AuditLog[]>([]);
  const [employeesPageMeta, setEmployeesPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [partyProfilesPageMeta, setPartyProfilesPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [customersPageMeta, setCustomersPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [projectsPageMeta, setProjectsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [contractsPageMeta, setContractsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [documentsPageMeta, setDocumentsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [auditLogsPageMeta, setAuditLogsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [employeesPageLoading, setEmployeesPageLoading] = useState(false);
  const [partyProfilesPageLoading, setPartyProfilesPageLoading] = useState(false);
  const [customersPageLoading, setCustomersPageLoading] = useState(false);
  const [projectsPageLoading, setProjectsPageLoading] = useState(false);
  const [contractsPageLoading, setContractsPageLoading] = useState(false);
  const [documentsPageLoading, setDocumentsPageLoading] = useState(false);
  const [auditLogsPageLoading, setAuditLogsPageLoading] = useState(false);
  const [feedbacksPageLoading, setFeedbacksPageLoading] = useState(false);

  // Modal state
  const [modalType, setModalType] = useState<ModalType>(null);
  const [importModuleOverride, setImportModuleOverride] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedPartyProfile, setSelectedPartyProfile] = useState<EmployeePartyProfile | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productDeleteDependencyMessage, setProductDeleteDependencyMessage] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCusPersonnel, setSelectedCusPersonnel] = useState<CustomerPersonnel | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectModalInitialTab, setProjectModalInitialTab] = useState<'info' | 'items' | 'raci'>('info');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [isContractDetailLoading, setIsContractDetailLoading] = useState(false);
  const [contractAddPrefill, setContractAddPrefill] = useState<Partial<Contract> | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [selectedUserDeptHistory, setSelectedUserDeptHistory] = useState<UserDeptHistory | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackRequest | null>(null);
  const [isFeedbackDetailLoading, setIsFeedbackDetailLoading] = useState(false);
  const [employeeProvisioning, setEmployeeProvisioning] = useState<{ employeeLabel: string; provisioning: EmployeeProvisioning } | null>(null);
  const [isEmployeePasswordResetting, setIsEmployeePasswordResetting] = useState(false);
  const [procedureProject, setProcedureProject] = useState<Project | null>(null);

  // Loading state
  const [isSaving, setIsSaving] = useState(false);
  const [importLoadingText, setImportLoadingText] = useState('');
  const [isPaymentScheduleLoading, setIsPaymentScheduleLoading] = useState(false);

  // Integration settings loading state
  const [isBackblazeB2SettingsLoading, setIsBackblazeB2SettingsLoading] = useState(false);
  const [isBackblazeB2SettingsSaving, setIsBackblazeB2SettingsSaving] = useState(false);
  const [isBackblazeB2SettingsTesting, setIsBackblazeB2SettingsTesting] = useState(false);
  const [isGoogleDriveSettingsLoading, setIsGoogleDriveSettingsLoading] = useState(false);
  const [isGoogleDriveSettingsSaving, setIsGoogleDriveSettingsSaving] = useState(false);
  const [isGoogleDriveSettingsTesting, setIsGoogleDriveSettingsTesting] = useState(false);
  const [isEmailSmtpSettingsLoading, setIsEmailSmtpSettingsLoading] = useState(false);
  const [isEmailSmtpSettingsSaving, setIsEmailSmtpSettingsSaving] = useState(false);
  const [isEmailSmtpSettingsTesting, setIsEmailSmtpSettingsTesting] = useState(false);
  const [isContractExpiryAlertSettingsLoading, setIsContractExpiryAlertSettingsLoading] = useState(false);
  const [isContractExpiryAlertSettingsSaving, setIsContractExpiryAlertSettingsSaving] = useState(false);
  const [isContractPaymentAlertSettingsLoading, setIsContractPaymentAlertSettingsLoading] = useState(false);
  const [isContractPaymentAlertSettingsSaving, setIsContractPaymentAlertSettingsSaving] = useState(false);

  // Refs
  const prefetchedTabsRef = React.useRef<Set<string>>(new Set());
  const recentToastByKeyRef = React.useRef<Map<string, number>>(new Map());
  const pageLoadVersionRef = React.useRef<Record<string, number>>({});
  const pageQueryInFlightSignatureRef = React.useRef<Record<string, string>>({});
  const pageQueryDebounceRef = React.useRef<Record<string, number>>({});
  const recentTabDataLoadRef = React.useRef<Map<string, number>>(new Map());
  const employeesPageQueryRef = React.useRef<PaginatedQuery>({ page: 1, per_page: 7, sort_by: 'user_code', sort_dir: 'asc', q: '', filters: {} });
  const partyProfilesPageQueryRef = React.useRef<PaginatedQuery>({ page: 1, per_page: 10, sort_by: 'user_code', sort_dir: 'asc', q: '', filters: {} });
  const customersPageQueryRef = React.useRef<PaginatedQuery>({ page: 1, per_page: 10, sort_by: 'customer_code', sort_dir: 'asc', q: '', filters: {} });
  const projectsPageQueryRef = React.useRef<PaginatedQuery>({ page: 1, per_page: 10, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} });
  const contractsPageQueryRef = React.useRef<PaginatedQuery>({ page: 1, per_page: 10, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} });
  const documentsPageQueryRef = React.useRef<PaginatedQuery>({ page: 1, per_page: 7, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} });
  const auditLogsPageQueryRef = React.useRef<PaginatedQuery>({ page: 1, per_page: 10, sort_by: 'created_at', sort_dir: 'desc', q: '', filters: {} });
  const feedbacksPageQueryRef = React.useRef<PaginatedQuery>({ page: 1, per_page: 20, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} });

  const { toasts, addToast: enqueueToast, removeToast, clearToasts } = useToastQueue();
  const { handleImportDepartments } = useImportDepartments();
  const { handleImportEmployees } = useImportEmployees();
  const { handleImportCustomers } = useImportCustomers();
  const { handleImportEmployeePartyProfiles } = useImportEmployeePartyProfiles();
  const { handleImportProducts } = useImportProducts();
  const location = useLocation();
  const navigate = useNavigate();

  // Helper to add toast with deduplication
  const addToast = React.useCallback((type: 'success' | 'error', title: string, message: string) => {
    if (type === 'error' && isTabEvictedMessage(message)) return;
    const toastKey = `${type}|${title}|${message}`;
    const now = Date.now();
    const lastShownAt = recentToastByKeyRef.current.get(toastKey) ?? 0;
    if (now - lastShownAt < 2500) return;
    recentToastByKeyRef.current.set(toastKey, now);
    recentToastByKeyRef.current.forEach((timestamp, key) => { if (now - timestamp > 30000) recentToastByKeyRef.current.delete(key); });
    enqueueToast(type, title, message);
  }, [enqueueToast]);
  const {
    customerPersonnel: cusPersonnel,
    loadCustomerPersonnel,
    handleSaveCusPersonnel,
    handleDeleteCusPersonnel,
  } = useCustomerPersonnel(addToast);
  const { handleImportCustomerPersonnel } = useImportCustomerPersonnel();

  // Navigation helpers
  const getRoutePathFromTabId = React.useCallback((tabId: string): string => {
    if (tabId === 'dashboard') return '/';
    if (tabId === 'user_dept_history') return '/user-dept-history';
    if (tabId === 'customer_request_management') return '/customer-request-management';
    if (tabId === 'workflow_mgmt') return '/workflow-management';
    if (tabId === 'internal_user_dashboard') return '/internal-user-dashboard';
    if (tabId === 'internal_user_list') return '/internal-user-list';
    return `/${tabId.replace(/_/g, '-')}`;
  }, []);

  const getTabIdFromPath = React.useCallback((pathname: string): string | null => {
    const normalizedPath = pathname.replace(/^\/+|\/+$/g, '');
    if (normalizedPath === '') return 'dashboard';
    const specialCases: Record<string, string> = { 
      'user-dept-history': 'user_dept_history', 
      'customer-request-management': 'customer_request_management',
      'workflow-management': 'workflow_mgmt',
      'internal-user-party-members': 'internal_user_dashboard',
    };
    if (specialCases[normalizedPath]) return specialCases[normalizedPath];
    const [rootSegment] = normalizedPath.split('/');
    const tabId = (rootSegment || normalizedPath).replace(/-/g, '_');
    return AVAILABLE_TABS.includes(tabId as any) ? tabId : 'dashboard';
  }, []);

  const handleNavigateTab = React.useCallback((tabId: string) => {
    setActiveTab(tabId);
    navigate(getRoutePathFromTabId(tabId));
  }, [navigate, getRoutePathFromTabId]);

  const visibleTabIds = useMemo(() => new Set(AVAILABLE_TABS.filter((tabId) => canAccessTab(authUser, tabId))), [authUser]);
  const activeInternalUserSubTab: InternalUserSubTab = activeTab === 'internal_user_list' ? 'list' : internalUserSubTab;
  const activeModuleKey = activeTab === 'internal_user_dashboard'
    ? (
      activeInternalUserSubTab === 'list'
        ? 'internal_user_list'
        : activeInternalUserSubTab === 'party'
          ? 'internal_user_party_members'
          : 'internal_user_dashboard'
    )
    : activeTab;
  const importModalModuleKey = importModuleOverride || activeModuleKey;

  // Sync from URL to activeTab
  React.useEffect(() => {
    const tabFromPath = getTabIdFromPath(location.pathname);
    if (tabFromPath && tabFromPath !== activeTab) setActiveTab(tabFromPath);
  }, [location.pathname, getTabIdFromPath, activeTab]);

  React.useEffect(() => {
    const normalizedPath = location.pathname.replace(/^\//, '');
    if (normalizedPath === 'internal-user-party-members' && internalUserSubTab !== 'party') {
      setInternalUserSubTab('party');
    }
  }, [internalUserSubTab, location.pathname]);

  // Fallback tab if no permission
  React.useEffect(() => {
    if (!authUser) return;
    if (visibleTabIds.has(activeTab as typeof AVAILABLE_TABS[number])) return;
    const fallbackTab = AVAILABLE_TABS.find((tabId) => visibleTabIds.has(tabId)) || 'dashboard';
    if (fallbackTab !== activeTab) handleNavigateTab(fallbackTab);
  }, [authUser, activeTab, visibleTabIds, handleNavigateTab]);

  // Auth bootstrap
  React.useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const bootstrap = await fetchAuthBootstrap();
        setAuthUser(bootstrap.user);
        setPasswordChangeRequired(Boolean(bootstrap.user.password_change_required));
        setLoginError('');
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message === 'PASSWORD_CHANGE_REQUIRED') {
          try {
            const currentUser = await fetchCurrentUser();
            setAuthUser(currentUser);
            setPasswordChangeRequired(Boolean(currentUser.password_change_required ?? true));
            setLoginError('');
            return;
          } catch { /* fall through */ }
        }
        setAuthUser(null);
        setPasswordChangeRequired(false);
      } finally {
        setIsAuthLoading(false);
      }
    };
    bootstrapAuth();
  }, []);

  // Tab eviction handler
  const handleTabEvicted = React.useCallback(() => {
    setAuthUser(null);
    setPasswordChangeRequired(false);
    setModalType(null);
    clearToasts();
    recentToastByKeyRef.current.clear();
    setLoginError('');
    setLoginInfoMessage('Tài khoản đã được đăng nhập trên một cửa sổ/tab khác. Vui lòng đăng nhập lại để tiếp tục.');
  }, [clearToasts]);

  React.useEffect(() => {
    registerTabEvictedHandler(handleTabEvicted);
    return () => unregisterTabEvictedHandler();
  }, [handleTabEvicted]);

  useTabSession({ isAuthenticated: authUser !== null, onEvicted: handleTabEvicted });

  // Auth handlers
  const handleLogin = async (payload: { username: string; password: string }) => {
    setIsLoginLoading(true);
    setLoginError('');
    setPasswordChangeError('');
    setLoginInfoMessage('');
    try {
      const session = await login(payload);
      setAuthUser(session.user);
      setPasswordChangeRequired(Boolean(session.password_change_required || session.user.password_change_required));
      setPasswordChangeForm({ current_password: '', new_password: '', new_password_confirmation: '' });
      const requestedTab = typeof window !== 'undefined' ? getTabIdFromPath(window.location.pathname) || new URLSearchParams(window.location.search).get('tab') : null;
      if (requestedTab && canAccessTab(session.user, requestedTab)) {
        handleNavigateTab(requestedTab);
      } else {
        handleNavigateTab(canAccessTab(session.user, 'dashboard') ? 'dashboard' : 'internal_user_dashboard');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Đăng nhập thất bại.';
      setLoginError(message);
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try { await logout(); } finally {
      setAuthUser(null);
      setPasswordChangeRequired(false);
      setPasswordChangeError('');
      setPasswordChangeForm({ current_password: '', new_password: '', new_password_confirmation: '' });
      setEmployeeProvisioning(null);
      setIsEmployeePasswordResetting(false);
      handleNavigateTab('dashboard');
      setInternalUserSubTab('dashboard');
      setModalType(null);
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
      case 'internal_user_dashboard': case 'internal_user_list': prefetchTasks.push(import('./components/InternalUserModuleTabs')); break;
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
      case 'workflow_mgmt': prefetchTasks.push(import('./components/workflow/WorkflowManagementHub')); break;
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

  // Page load helpers
  const beginPageLoad = React.useCallback((key: string): number => {
    const nextVersion = (pageLoadVersionRef.current[key] || 0) + 1;
    pageLoadVersionRef.current[key] = nextVersion;
    return nextVersion;
  }, []);

  const isLatestPageLoad = React.useCallback((key: string, version: number): boolean => pageLoadVersionRef.current[key] === version, []);

  const schedulePageQueryLoad = React.useCallback((key: string, query: PaginatedQuery, loader: (nextQuery: PaginatedQuery) => Promise<void>) => {
    const currentTimer = pageQueryDebounceRef.current[key];
    if (typeof currentTimer === 'number') window.clearTimeout(currentTimer);
    pageQueryDebounceRef.current[key] = window.setTimeout(() => { delete pageQueryDebounceRef.current[key]; void loader(query); }, 250);
  }, []);

  // Load page functions
  const loadEmployeesPage = React.useCallback(async (query?: PaginatedQuery) => {
    const requestKey = 'employeesPage';
    const effectiveQuery = query ?? employeesPageQueryRef.current;
    const querySignature = normalizeQuerySignature(effectiveQuery);
    if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) return;
    pageQueryInFlightSignatureRef.current[requestKey] = querySignature;
    const requestVersion = beginPageLoad(requestKey);
    employeesPageQueryRef.current = effectiveQuery;
    setEmployeesPageLoading(true);
    try {
      const result = await fetchEmployeesPage(effectiveQuery);
      if (!isLatestPageLoad(requestKey, requestVersion)) return;
      setEmployeesPageRows(result.data || []);
      setEmployeesPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (error) {
      if (!isLatestPageLoad(requestKey, requestVersion) || isRequestCanceledError(error)) return;
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách nhân sự.';
      addToast('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) setEmployeesPageLoading(false);
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) delete pageQueryInFlightSignatureRef.current[requestKey];
    }
  }, [addToast, beginPageLoad, isLatestPageLoad, normalizeQuerySignature]);

  const loadPartyProfilesPage = React.useCallback(async (query?: PaginatedQuery) => {
    const requestKey = 'partyProfilesPage';
    const effectiveQuery = query ?? partyProfilesPageQueryRef.current;
    const querySignature = normalizeQuerySignature(effectiveQuery);
    if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) return;
    pageQueryInFlightSignatureRef.current[requestKey] = querySignature;
    const requestVersion = beginPageLoad(requestKey);
    partyProfilesPageQueryRef.current = effectiveQuery;
    setPartyProfilesPageLoading(true);
    try {
      const result = await fetchEmployeePartyProfilesPage(effectiveQuery);
      if (!isLatestPageLoad(requestKey, requestVersion)) return;
      setPartyProfilesPageRows(result.data || []);
      setPartyProfilesPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (error) {
      if (!isLatestPageLoad(requestKey, requestVersion) || isRequestCanceledError(error)) return;
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách đảng viên.';
      addToast('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) setPartyProfilesPageLoading(false);
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) delete pageQueryInFlightSignatureRef.current[requestKey];
    }
  }, [addToast, beginPageLoad, isLatestPageLoad, normalizeQuerySignature]);

  const loadCustomersPage = React.useCallback(async (query?: PaginatedQuery) => {
    const requestKey = 'customersPage';
    const effectiveQuery = query ?? customersPageQueryRef.current;
    const querySignature = normalizeQuerySignature(effectiveQuery);
    if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) return;
    pageQueryInFlightSignatureRef.current[requestKey] = querySignature;
    const requestVersion = beginPageLoad(requestKey);
    customersPageQueryRef.current = effectiveQuery;
    setCustomersPageLoading(true);
    try {
      const result = await fetchCustomersPage(effectiveQuery);
      if (!isLatestPageLoad(requestKey, requestVersion)) return;
      setCustomersPageRows(result.data || []);
      setCustomersPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (error) {
      if (!isLatestPageLoad(requestKey, requestVersion) || isRequestCanceledError(error)) return;
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách khách hàng.';
      addToast('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) setCustomersPageLoading(false);
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) delete pageQueryInFlightSignatureRef.current[requestKey];
    }
  }, [addToast, beginPageLoad, isLatestPageLoad, normalizeQuerySignature]);

  const loadProjectsPage = React.useCallback(async (query?: PaginatedQuery) => {
    const requestKey = 'projectsPage';
    const effectiveQuery = query ?? projectsPageQueryRef.current;
    const querySignature = normalizeQuerySignature(effectiveQuery);
    if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) return;
    pageQueryInFlightSignatureRef.current[requestKey] = querySignature;
    const requestVersion = beginPageLoad(requestKey);
    projectsPageQueryRef.current = effectiveQuery;
    setProjectsPageLoading(true);
    try {
      const result = await fetchProjectsPage(effectiveQuery);
      if (!isLatestPageLoad(requestKey, requestVersion)) return;
      setProjectsPageRows(result.data || []);
      setProjectsPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (error) {
      if (!isLatestPageLoad(requestKey, requestVersion) || isRequestCanceledError(error)) return;
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách dự án.';
      addToast('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) setProjectsPageLoading(false);
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) delete pageQueryInFlightSignatureRef.current[requestKey];
    }
  }, [addToast, beginPageLoad, isLatestPageLoad, normalizeQuerySignature]);

  const loadContractsPage = React.useCallback(async (query?: PaginatedQuery) => {
    const requestKey = 'contractsPage';
    const effectiveQuery = query ?? contractsPageQueryRef.current;
    const querySignature = normalizeQuerySignature(effectiveQuery);
    if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) return;
    pageQueryInFlightSignatureRef.current[requestKey] = querySignature;
    const requestVersion = beginPageLoad(requestKey);
    contractsPageQueryRef.current = effectiveQuery;
    setContractsPageLoading(true);
    try {
      const result = await fetchContractsPage(effectiveQuery);
      if (!isLatestPageLoad(requestKey, requestVersion)) return;
      setContractsPageRows(result.data || []);
      setContractsPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (error) {
      if (!isLatestPageLoad(requestKey, requestVersion) || isRequestCanceledError(error)) return;
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách hợp đồng.';
      addToast('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) setContractsPageLoading(false);
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) delete pageQueryInFlightSignatureRef.current[requestKey];
    }
  }, [addToast, beginPageLoad, isLatestPageLoad, normalizeQuerySignature]);

  const loadDocumentsPage = React.useCallback(async (query?: PaginatedQuery) => {
    const requestKey = 'documentsPage';
    const effectiveQuery = query ?? documentsPageQueryRef.current;
    const querySignature = normalizeQuerySignature(effectiveQuery);
    if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) return;
    pageQueryInFlightSignatureRef.current[requestKey] = querySignature;
    const requestVersion = beginPageLoad(requestKey);
    documentsPageQueryRef.current = effectiveQuery;
    setDocumentsPageLoading(true);
    try {
      const result = await fetchDocumentsPage(effectiveQuery);
      if (!isLatestPageLoad(requestKey, requestVersion)) return;
      setDocumentsPageRows(result.data || []);
      setDocumentsPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (error) {
      if (!isLatestPageLoad(requestKey, requestVersion) || isRequestCanceledError(error)) return;
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách tài liệu.';
      addToast('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) setDocumentsPageLoading(false);
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) delete pageQueryInFlightSignatureRef.current[requestKey];
    }
  }, [addToast, beginPageLoad, isLatestPageLoad, normalizeQuerySignature]);

  const loadAuditLogsPage = React.useCallback(async (query?: PaginatedQuery) => {
    const requestKey = 'auditLogsPage';
    const effectiveQuery = query ?? auditLogsPageQueryRef.current;
    const querySignature = normalizeQuerySignature(effectiveQuery);
    if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) return;
    pageQueryInFlightSignatureRef.current[requestKey] = querySignature;
    const requestVersion = beginPageLoad(requestKey);
    auditLogsPageQueryRef.current = effectiveQuery;
    setAuditLogsPageLoading(true);
    try {
      const result = await fetchAuditLogsPage(effectiveQuery);
      if (!isLatestPageLoad(requestKey, requestVersion)) return;
      setAuditLogsPageRows(result.data || []);
      setAuditLogsPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (error) {
      if (!isLatestPageLoad(requestKey, requestVersion) || isRequestCanceledError(error)) return;
      const message = error instanceof Error ? error.message : 'Không thể tải audit log.';
      addToast('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) setAuditLogsPageLoading(false);
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) delete pageQueryInFlightSignatureRef.current[requestKey];
    }
  }, [addToast, beginPageLoad, isLatestPageLoad, normalizeQuerySignature]);

  const loadFeedbacksPage = React.useCallback(async (query?: PaginatedQuery) => {
    const requestKey = 'feedbacksPage';
    const effectiveQuery = query ?? feedbacksPageQueryRef.current;
    const querySignature = normalizeQuerySignature(effectiveQuery);
    if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) return;
    pageQueryInFlightSignatureRef.current[requestKey] = querySignature;
    const requestVersion = beginPageLoad(requestKey);
    feedbacksPageQueryRef.current = effectiveQuery;
    setFeedbacksPageLoading(true);
    try {
      const result = await fetchFeedbacksPage(effectiveQuery);
      if (!isLatestPageLoad(requestKey, requestVersion)) return;
      setFeedbacksPageRows(result.data || []);
      setFeedbacksPageMeta(result.meta || undefined);
    } catch (error) {
      if (!isLatestPageLoad(requestKey, requestVersion) || isRequestCanceledError(error)) return;
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách góp ý.';
      addToast('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) setFeedbacksPageLoading(false);
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) delete pageQueryInFlightSignatureRef.current[requestKey];
    }
  }, [addToast, beginPageLoad, isLatestPageLoad, normalizeQuerySignature]);

  const handleEmployeesPageQueryChange = React.useCallback((query: PaginatedQuery) => schedulePageQueryLoad('employeesPage', query, loadEmployeesPage), [loadEmployeesPage, schedulePageQueryLoad]);
  const handlePartyProfilesPageQueryChange = React.useCallback((query: PaginatedQuery) => schedulePageQueryLoad('partyProfilesPage', query, loadPartyProfilesPage), [loadPartyProfilesPage, schedulePageQueryLoad]);
  const handleCustomersPageQueryChange = React.useCallback((query: PaginatedQuery) => schedulePageQueryLoad('customersPage', query, loadCustomersPage), [loadCustomersPage, schedulePageQueryLoad]);
  const handleProjectsPageQueryChange = React.useCallback((query: PaginatedQuery) => schedulePageQueryLoad('projectsPage', query, loadProjectsPage), [loadProjectsPage, schedulePageQueryLoad]);
  const handleContractsPageQueryChange = React.useCallback((query: PaginatedQuery) => schedulePageQueryLoad('contractsPage', query, loadContractsPage), [loadContractsPage, schedulePageQueryLoad]);
  const handleDocumentsPageQueryChange = React.useCallback((query: PaginatedQuery) => schedulePageQueryLoad('documentsPage', query, loadDocumentsPage), [loadDocumentsPage, schedulePageQueryLoad]);
  const handleAuditLogsPageQueryChange = React.useCallback((query: PaginatedQuery) => schedulePageQueryLoad('auditLogsPage', query, loadAuditLogsPage), [loadAuditLogsPage, schedulePageQueryLoad]);
  const handleFeedbacksPageQueryChange = React.useCallback((query: PaginatedQuery) => schedulePageQueryLoad('feedbacksPage', query, loadFeedbacksPage), [loadFeedbacksPage, schedulePageQueryLoad]);

  const closeImportModal = React.useCallback(() => {
    setModalType(null);
    setImportModuleOverride(null);
    setImportLoadingText('');
  }, []);

  const runSavingTask = React.useCallback(async (task: () => Promise<void>) => {
    setIsSaving(true);
    try {
      await task();
    } finally {
      setIsSaving(false);
    }
  }, []);

  const refreshDepartmentsData = React.useCallback(async () => {
    await Promise.all([
      fetchDepartments().then((rows) => setDepartments(rows || [])).catch(() => {}),
      fetchEmployees().then((rows) => setEmployees(rows || [])).catch(() => {}),
    ]);
  }, []);

  const refreshEmployeesData = React.useCallback(async () => {
    await Promise.all([
      loadEmployeesPage(),
      fetchEmployees().then((rows) => setEmployees(rows || [])).catch(() => {}),
    ]);
  }, [loadEmployeesPage]);

  const refreshPartyProfilesData = React.useCallback(async () => {
    await Promise.all([
      loadPartyProfilesPage(),
      fetchEmployees().then((rows) => setEmployees(rows || [])).catch(() => {}),
    ]);
  }, [loadPartyProfilesPage]);

  const refreshBusinessesData = React.useCallback(async () => {
    await fetchBusinesses().then((rows) => setBusinesses(rows || [])).catch(() => {});
  }, []);

  const refreshUserDeptHistoryData = React.useCallback(async () => {
    await Promise.all([
      fetchUserDeptHistory().then((rows) => setUserDeptHistory(rows || [])).catch(() => {}),
      fetchEmployees().then((rows) => setEmployees(rows || [])).catch(() => {}),
      fetchDepartments().then((rows) => setDepartments(rows || [])).catch(() => {}),
    ]);
  }, []);

  const refreshVendorsData = React.useCallback(async () => {
    await fetchVendors().then((rows) => setVendors(rows || [])).catch(() => {});
  }, []);

  const refreshProductsData = React.useCallback(async () => {
    await fetchProducts().then((rows) => setProducts(rows || [])).catch(() => {});
  }, []);

  const refreshCustomersData = React.useCallback(async () => {
    await loadCustomersPage();
    void fetchCustomers()
      .then((rows) => setCustomers(rows || []))
      .catch(() => {});
  }, [loadCustomersPage]);

  const refreshProjectsData = React.useCallback(async () => {
    await Promise.all([
      loadProjectsPage(),
      fetchProjects().then((rows) => setProjects(rows || [])).catch(() => {}),
      fetchProjectItems().then((rows) => setProjectItems(rows || [])).catch(() => {}),
    ]);
  }, [loadProjectsPage]);

  const refreshContractsData = React.useCallback(async () => {
    await Promise.all([
      loadContractsPage(),
      fetchContracts().then((rows) => setContracts(rows || [])).catch(() => {}),
      fetchPaymentSchedules().then((rows) => setPaymentSchedules(rows || [])).catch(() => {}),
    ]);
  }, [loadContractsPage]);

  const refreshDocumentsData = React.useCallback(async () => {
    await Promise.all([
      loadDocumentsPage(),
      fetchDocuments().then((rows) => setDocuments(rows || [])).catch(() => {}),
    ]);
  }, [loadDocumentsPage]);

  const refreshFeedbacksData = React.useCallback(async () => {
    await loadFeedbacksPage();
  }, [loadFeedbacksPage]);

  const resetModalSelections = React.useCallback(() => {
    setSelectedDept(null);
    setSelectedEmployee(null);
    setSelectedPartyProfile(null);
    setSelectedBusiness(null);
    setSelectedVendor(null);
    setSelectedProduct(null);
    setProductDeleteDependencyMessage(null);
    setSelectedCustomer(null);
    setSelectedCusPersonnel(null);
    setSelectedProject(null);
    setProjectModalInitialTab('info');
    setSelectedContract(null);
    setContractAddPrefill(null);
    setSelectedDocument(null);
    setSelectedReminder(null);
    setSelectedUserDeptHistory(null);
    setSelectedFeedback(null);
    setEmployeeProvisioning(null);
    setProcedureProject(null);
  }, []);

  const upsertCustomerCache = React.useCallback((customer: Customer) => {
    setCustomers((previous) => {
      const existing = previous || [];
      const nextItems = existing.filter((item) => String(item.id) !== String(customer.id));
      return [customer, ...nextItems];
    });
  }, []);

  const upsertCustomersPageRow = React.useCallback((customer: Customer) => {
    setCustomersPageRows((previous) => {
      const existing = previous || [];
      let hasMatch = false;
      const nextItems = existing.map((item) => {
        if (String(item.id) !== String(customer.id)) {
          return item;
        }

        hasMatch = true;
        return customer;
      });

      return hasMatch ? nextItems : existing;
    });
  }, []);

  const removeCustomerCache = React.useCallback((customerId: Customer['id']) => {
    setCustomers((previous) => (previous || []).filter((item) => String(item.id) !== String(customerId)));
  }, []);

  const removeCustomersPageRow = React.useCallback((customerId: Customer['id']) => {
    setCustomersPageRows((previous) => (previous || []).filter((item) => String(item.id) !== String(customerId)));
  }, []);

  const removeProductCache = React.useCallback((productId: Product['id']) => {
    setProducts((previous) => (previous || []).filter((item) => String(item.id) !== String(productId)));
  }, []);

  const handleSaveCustomer = React.useCallback(async (payload: Partial<Customer>, customerId?: Customer['id']) => {
    setIsSaving(true);
    try {
      const savedCustomer = customerId
        ? await updateCustomer(customerId, payload)
        : await createCustomer(payload);

      upsertCustomerCache(savedCustomer);
      upsertCustomersPageRow(savedCustomer);
      await refreshCustomersData();
      setSelectedCustomer(savedCustomer);
      setModalType(null);
    } finally {
      setIsSaving(false);
    }
  }, [refreshCustomersData, upsertCustomerCache, upsertCustomersPageRow]);

  const handleDeleteCustomer = React.useCallback(async (customer: Customer) => {
    setIsSaving(true);
    try {
      await deleteCustomer(customer.id);
      removeCustomerCache(customer.id);
      removeCustomersPageRow(customer.id);
      await refreshCustomersData();
      setSelectedCustomer(null);
      setModalType(null);
    } catch (error) {
      if (isCustomerDeleteDependencyError(error)) {
        setModalType('CANNOT_DELETE_CUSTOMER');
        return;
      }

      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [refreshCustomersData, removeCustomerCache, removeCustomersPageRow]);

  const handleDeleteProduct = React.useCallback(async (product: Product) => {
    setIsSaving(true);
    setProductDeleteDependencyMessage(null);
    try {
      await deleteProduct(product.id);
      removeProductCache(product.id);
      await refreshProductsData();
      setSelectedProduct(null);
      setModalType(null);
      addToast('success', 'Thành công', 'Đã xóa sản phẩm.');
    } catch (error) {
      if (isProductDeleteDependencyError(error)) {
        setProductDeleteDependencyMessage(error instanceof Error ? error.message : null);
        setModalType('CANNOT_DELETE_PRODUCT');
        return;
      }

      const message = error instanceof Error ? error.message : 'Không thể xóa sản phẩm.';
      addToast('error', 'Xóa thất bại', message);
    } finally {
      setIsSaving(false);
    }
  }, [addToast, refreshProductsData, removeProductCache]);

  const handleDeleteProject = React.useCallback(async (project: Project) => {
    setIsSaving(true);
    try {
      await deleteProject(project.id);
      await refreshProjectsData();
      setSelectedProject(null);
      setModalType(null);
      addToast('success', 'Thành công', 'Đã xóa dự án.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể xóa dự án.';
      addToast('error', 'Xóa thất bại', message);
    } finally {
      setIsSaving(false);
    }
  }, [addToast, refreshProjectsData]);

  const handleSavePartyProfile = React.useCallback(async (payload: Partial<EmployeePartyProfile>) => {
    setIsSaving(true);
    try {
      const employeeId = payload.employee_id ?? selectedPartyProfile?.employee_id;
      if (!employeeId) {
        throw new Error('Vui lòng chọn nhân sự nội bộ.');
      }

      await upsertEmployeePartyProfile(employeeId, payload);
      await refreshPartyProfilesData();
      setSelectedPartyProfile(null);
      setModalType(null);
      addToast('success', 'Thành công', 'Lưu hồ sơ Đảng viên thành công.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lưu hồ sơ Đảng viên.';
      addToast('error', 'Lưu dữ liệu thất bại', message);
    } finally {
      setIsSaving(false);
    }
  }, [addToast, refreshPartyProfilesData, selectedPartyProfile]);

  const handleSaveDocument = React.useCallback(async (
    payload: Partial<Document>,
    modal: 'ADD_DOCUMENT' | 'EDIT_DOCUMENT' | 'UPLOAD_PRODUCT_DOCUMENT',
  ) => {
    await runSavingTask(async () => {
      try {
        if (modal === 'ADD_DOCUMENT') {
          await createDocument({ ...payload, scope: 'DEFAULT' });
          await refreshDocumentsData();
          setModalType(null);
          addToast('success', 'Thành công', 'Thêm mới hồ sơ tài liệu thành công!');
          return;
        }

        if (modal === 'UPLOAD_PRODUCT_DOCUMENT') {
          await createDocument({ ...payload, scope: 'PRODUCT_PRICING' });
          await refreshDocumentsData();
          setSelectedProduct(null);
          setModalType(null);
          addToast('success', 'Thành công', 'Đã lưu tài liệu minh chứng giá sản phẩm.');
          return;
        }

        if (!selectedDocument) {
          return;
        }

        await updateDocument(selectedDocument.id, { ...payload, scope: 'DEFAULT' });
        await refreshDocumentsData();
        setModalType(null);
        addToast('success', 'Thành công', 'Cập nhật hồ sơ tài liệu thành công!');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Lỗi không xác định';
        addToast('error', 'Lưu thất bại', `Không thể lưu hồ sơ tài liệu vào cơ sở dữ liệu. ${message}`);
      }
    });
  }, [addToast, refreshDocumentsData, runSavingTask, selectedDocument]);

  const handleImportData = React.useCallback(async (payload: ImportPayload) => {
    switch (importModalModuleKey) {
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
      case 'internal_user_list':
        await handleImportEmployees(
          payload,
          departments,
          addToast,
          setImportLoadingText,
          setIsSaving,
          setEmployees,
          refreshEmployeesData,
          closeImportModal,
        );
        return;
      case 'internal_user_party_members':
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
        setIsSaving(true);
        try {
          await handleImportCustomers(
            payload,
            setCustomers,
            addToast,
            setImportLoadingText,
            refreshCustomersData,
            closeImportModal,
          );
        } finally {
          setIsSaving(false);
          setImportLoadingText('');
        }
        return;
      case 'products':
        setIsSaving(true);
        try {
          await handleImportProducts(
            payload,
            products,
            businesses,
            vendors,
            addToast,
            setImportLoadingText,
            refreshProductsData,
            closeImportModal,
          );
        } finally {
          setIsSaving(false);
          setImportLoadingText('');
        }
        return;
      case 'cus_personnel':
        setIsSaving(true);
        try {
          await handleImportCustomerPersonnel(
            payload,
            customers,
            supportContactPositions,
            addToast,
            setImportLoadingText,
            loadCustomerPersonnel,
            closeImportModal,
          );
        } finally {
          setIsSaving(false);
          setImportLoadingText('');
        }
        return;
      default:
        addToast('error', 'Nhập dữ liệu', 'Module này chưa được cấu hình luồng import.');
    }
  }, [
    importModalModuleKey,
    handleImportDepartments,
    departments,
    addToast,
    closeImportModal,
    handleImportEmployees,
    handleImportEmployeePartyProfiles,
    refreshEmployeesData,
    handleImportCustomers,
    handleImportProducts,
    handleImportCustomerPersonnel,
    products,
    businesses,
    vendors,
    customers,
    supportContactPositions,
    loadCustomerPersonnel,
    loadPartyProfilesPage,
    refreshCustomersData,
    refreshProductsData,
  ]);

  // Load data by activeTab - MUST be after load*Page functions
  React.useEffect(() => {
    if (!authUser || passwordChangeRequired) return;

    const loadByActiveTab = async () => {
      const throttledTabLoadKey = `${activeModuleKey}::${activeModuleKey === 'internal_user_dashboard' || activeModuleKey === 'internal_user_list' ? activeInternalUserSubTab : '-'}`;
      const now = Date.now();
      const lastLoadedAt = recentTabDataLoadRef.current.get(throttledTabLoadKey) ?? 0;
      if (now - lastLoadedAt < 600) return;
      recentTabDataLoadRef.current.set(throttledTabLoadKey, now);

      switch (activeModuleKey) {
        case 'dashboard':
          await Promise.all([
            fetchContracts().then((rows) => setContracts(rows || [])).catch(() => {}),
            fetchPaymentSchedules().then((rows) => setPaymentSchedules(rows || [])).catch(() => {}),
            fetchProjects().then((rows) => setProjects(rows || [])).catch(() => {}),
            fetchCustomers().then((rows) => setCustomers(rows || [])).catch(() => {}),
            fetchDepartments().then((rows) => setDepartments(rows || [])).catch(() => {}),
            fetchEmployees().then((rows) => setEmployees(rows || [])).catch(() => {}),
          ]);
          break;
        case 'internal_user_dashboard':
        case 'internal_user_list':
        case 'internal_user_party_members':
          await fetchDepartments().then((rows) => setDepartments(rows || [])).catch(() => {});
          if (activeInternalUserSubTab === 'list') {
            loadEmployeesPage();
          } else if (activeInternalUserSubTab === 'party') {
            await Promise.all([
              fetchEmployees().then((rows) => setEmployees(rows || [])).catch(() => {}),
              loadPartyProfilesPage(),
            ]);
          } else {
            await fetchEmployees().then((rows) => setEmployees(rows || [])).catch(() => {});
          }
          break;
        case 'departments':
          await Promise.all([
            fetchDepartments().then((rows) => setDepartments(rows || [])).catch(() => {}),
            fetchEmployees().then((rows) => setEmployees(rows || [])).catch(() => {}),
          ]);
          break;
        case 'user_dept_history':
          await refreshUserDeptHistoryData();
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
            fetchProductUnitMasters().then((rows) => setProductUnitMasters(rows || [])).catch(() => {}),
            fetchCustomers().then((rows) => setCustomers(rows || [])).catch(() => {}),
          ]);
          break;
        case 'clients':
          loadCustomersPage();
          break;
        case 'cus_personnel':
          await Promise.all([
            loadCustomerPersonnel(),
            fetchCustomers().then((rows) => setCustomers(rows || [])).catch(() => {}),
            fetchSupportContactPositions().then((rows) => setSupportContactPositions(rows || [])).catch(() => {}),
          ]);
          break;
        case 'projects':
          loadProjectsPage();
          setTimeout(() => {
            Promise.all([
              fetchCustomers().then((rows) => setCustomers(rows || [])).catch(() => {}),
              fetchProducts().then((rows) => setProducts(rows || [])).catch(() => {}),
              fetchProjectItems().then((rows) => setProjectItems(rows || [])).catch(() => {}),
              fetchProjectTypes().then((rows) => setProjectTypes(rows || [])).catch(() => {}),
              fetchEmployees().then((rows) => setEmployees(rows || [])).catch(() => {}),
              fetchDepartments().then((rows) => setDepartments(rows || [])).catch(() => {}),
            ]);
          }, 120);
          break;
        case 'contracts':
          loadContractsPage();
          setTimeout(() => {
            Promise.all([
              fetchProjects().then((rows) => setProjects(rows || [])).catch(() => {}),
              fetchCustomers().then((rows) => setCustomers(rows || [])).catch(() => {}),
              fetchProducts().then((rows) => setProducts(rows || [])).catch(() => {}),
              fetchProjectItems().then((rows) => setProjectItems(rows || [])).catch(() => {}),
              fetchBusinesses().then((rows) => setBusinesses(rows || [])).catch(() => {}),
            ]);
          }, 120);
          break;
        case 'documents':
          loadDocumentsPage();
          setTimeout(() => {
            Promise.all([
              fetchCustomers().then((rows) => setCustomers(rows || [])).catch(() => {}),
              fetchProducts().then((rows) => setProducts(rows || [])).catch(() => {}),
            ]);
          }, 120);
          break;
        case 'reminders':
          await Promise.all([
            fetchReminders().then((rows) => setReminders(rows || [])).catch(() => {}),
            fetchEmployees().then((rows) => setEmployees(rows || [])).catch(() => {}),
          ]);
          break;
        case 'customer_request_management':
          await Promise.all([
            fetchSupportServiceGroups().then((rows) => setSupportServiceGroups(rows || [])).catch(() => {}),
          ]);
          setTimeout(() => {
            Promise.all([
              fetchCustomers().then((rows) => setCustomers(rows || [])).catch(() => {}),
              loadCustomerPersonnel(),
              fetchEmployees().then((rows) => setEmployees(rows || [])).catch(() => {}),
            ]);
          }, 120);
          break;
        case 'support_master_management':
          await Promise.all([
            fetchSupportServiceGroups().then((rows) => setSupportServiceGroups(rows || [])).catch(() => {}),
            fetchSupportContactPositions().then((rows) => setSupportContactPositions(rows || [])).catch(() => {}),
            fetchProductUnitMasters(true).then((rows) => setProductUnitMasters(rows || [])).catch(() => {}),
            fetchSupportRequestStatuses().then((rows) => setSupportRequestStatuses(rows || [])).catch(() => {}),
            fetchWorklogActivityTypes().then((rows) => setWorklogActivityTypes(rows || [])).catch(() => {}),
            fetchSupportSlaConfigs().then((rows) => setSupportSlaConfigs(rows || [])).catch(() => {}),
            fetchProjectTypes().then((rows) => setProjectTypes(rows || [])).catch(() => {}),
          ]);
          setTimeout(() => {
            fetchCustomers().then((rows) => setCustomers(rows || [])).catch(() => {});
          }, 120);
          break;
        case 'procedure_template_config':
          break;
        case 'department_weekly_schedule_management':
          await Promise.all([
            fetchDepartments().then((rows) => setDepartments(rows || [])).catch(() => {}),
            fetchEmployees().then((rows) => setEmployees(rows || [])).catch(() => {}),
          ]);
          break;
        case 'audit_logs':
          loadAuditLogsPage();
          setTimeout(() => {
            fetchEmployees().then((rows) => setEmployees(rows || [])).catch(() => {});
          }, 120);
          break;
        case 'user_feedback':
          loadFeedbacksPage();
          setTimeout(() => {
            fetchEmployees().then((rows) => setEmployees(rows || [])).catch(() => {});
          }, 120);
          break;
        case 'integration_settings':
          await Promise.all([
            fetchBackblazeB2IntegrationSettings().then((data) => setBackblazeB2Settings(data)).catch(() => {}),
            fetchGoogleDriveIntegrationSettings().then((data) => setGoogleDriveSettings(data)).catch(() => {}),
            fetchEmailSmtpIntegrationSettings().then((data) => setEmailSmtpSettings(data)).catch(() => {}),
            fetchContractExpiryAlertSettings().then((data) => setContractExpiryAlertSettings(data)).catch(() => {}),
            fetchContractPaymentAlertSettings().then((data) => setContractPaymentAlertSettings(data)).catch(() => {}),
          ]);
          break;
        case 'access_control':
          await Promise.all([
            fetchRoles().then((rows) => setRoles(rows || [])).catch(() => {}),
            fetchPermissions().then((rows) => setPermissions(rows || [])).catch(() => {}),
            fetchUserAccess().then((rows) => setUserAccessRecords(rows || [])).catch(() => {}),
            fetchDepartments().then((rows) => setDepartments(rows || [])).catch(() => {}),
          ]);
          break;
        default:
          break;
      }
    };

    void loadByActiveTab();
  }, [authUser, passwordChangeRequired, activeModuleKey, activeInternalUserSubTab, loadEmployeesPage, loadPartyProfilesPage, loadCustomersPage, loadProjectsPage, loadContractsPage, loadDocumentsPage, loadAuditLogsPage, loadFeedbacksPage, loadCustomerPersonnel]);

  // Export functions
  const exportProjectsByCurrentQuery = async (): Promise<Project[]> => {
    if (!hasPermission(authUser, 'projects.read')) throw new Error('Bạn không có quyền xuất dữ liệu dự án.');
    const seedQuery = { ...(projectsPageQueryRef.current || {}), page: 1, per_page: 200 } as PaginatedQuery;
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
    const seedQuery = { ...(contractsPageQueryRef.current || {}), page: 1, per_page: 200 } as PaginatedQuery;
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
  const EMPTY_CUSTOMER_AGGREGATE_KPIS: CustomerAggregateKpis = { totalCustomers: 0, healthcareCustomers: 0, governmentCustomers: 0, individualCustomers: 0, healthcareBreakdown: { publicHospital: 0, privateHospital: 0, medicalCenter: 0, privateClinic: 0, tytPkdk: 0, other: 0 } };
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
      <main className="min-w-0 flex-1 overflow-y-auto bg-bg-light w-full">
        <Suspense fallback={<LazyModuleFallback />}>
          <AppPages
            activeTab={activeTab} authUser={authUser} activeInternalUserSubTab={activeInternalUserSubTab} setInternalUserSubTab={setInternalUserSubTab}
            customerRequestHubContext={{
              customers,
              customerPersonnel: cusPersonnel,
              projectItems,
              employees,
              supportServiceGroups,
              currentUserId: authUser?.id ?? null,
              isAdminViewer: Boolean(
                authUser
                && (
                  (authUser.roles || []).map((role) => String(role).toUpperCase()).includes('ADMIN')
                  || (authUser.permissions || []).includes('*')
                )
              ),
              canImportRequests: hasPermission(authUser, 'support_requests.import'),
              canExportRequests: hasPermission(authUser, 'support_requests.export'),
              canReadRequests: hasPermission(authUser, 'support_requests.read'),
              canWriteRequests: hasPermission(authUser, 'support_requests.write'),
              canDeleteRequests: hasPermission(authUser, 'support_requests.delete'),
            }}
            handleOpenModal={(type, item) => {
              resetModalSelections();
              setImportModuleOverride(null);
              setIsContractDetailLoading(false);
              setIsFeedbackDetailLoading(false);

              if (!type) {
                setModalType(type);
                return;
              }

              if (!canOpenModal(authUser, type, activeModuleKey)) {
                setModalType(null);
                if (type === 'IMPORT_DATA' && !isImportSupportedModule(activeModuleKey)) {
                  addToast('error', 'Nhập dữ liệu', 'Module này chưa được cấu hình luồng import.');
                } else {
                  addToast('error', 'Không có quyền', 'Bạn không có quyền thực hiện thao tác này.');
                }
                return;
              }

              setModalType(type);

              if (type === 'IMPORT_DATA') {
                setImportModuleOverride(activeModuleKey);
                return;
              }

              if (type === 'EDIT_PROJECT' && item && typeof item === 'object' && 'id' in item) {
                const project = item as Project;
                void (async () => {
                  try {
                    const detail = await fetchProjectDetail(project.id);
                    setSelectedProject(detail);
                  } catch (error) {
                    if (isRequestCanceledError(error)) {
                      return;
                    }
                    const message = error instanceof Error ? error.message : 'Không thể tải chi tiết dự án.';
                    addToast('error', 'Tải dữ liệu thất bại', message);
                  }
                })();
                return;
              }

              if (type.includes('DEPARTMENT')) {
                setSelectedDept((item as Department) ?? null);
                return;
              }

              if (type.includes('EMPLOYEE')) {
                setSelectedEmployee((item as Employee) ?? null);
                return;
              }

              if (type === 'ADD_PARTY_PROFILE' || type === 'EDIT_PARTY_PROFILE') {
                setSelectedPartyProfile((item as EmployeePartyProfile) ?? null);
                return;
              }

              if (type === 'ADD_USER_DEPT_HISTORY' && item && typeof item === 'object' && 'username' in item) {
                const employee = item as Employee;
                setSelectedEmployee(employee);
                setSelectedUserDeptHistory({
                  id: '',
                  userId: String(employee.id ?? ''),
                  fromDeptId: String(employee.department_id ?? ''),
                  toDeptId: '',
                  transferDate: new Date().toISOString().split('T')[0],
                  decisionNumber: '',
                  reason: '',
                  employeeCode: String(employee.user_code ?? employee.employee_code ?? ''),
                  employeeName: String(employee.full_name ?? employee.username ?? ''),
                });
                return;
              }

              if (type.includes('BUSINESS')) {
                setSelectedBusiness((item as Business) ?? null);
                return;
              }

              if (type.includes('VENDOR')) {
                setSelectedVendor((item as Vendor) ?? null);
                return;
              }

              if (type.includes('PRODUCT')) {
                setSelectedProduct((item as Product) ?? null);
                return;
              }

              if (type.includes('CUSTOMER')) {
                setSelectedCustomer((item as Customer) ?? null);
                return;
              }

              if (type.includes('CUS_PERSONNEL')) {
                setSelectedCusPersonnel((item as CustomerPersonnel) ?? null);
                return;
              }

              if (type.includes('PROJECT')) {
                setSelectedProject((item as Project) ?? null);
                return;
              }

              if (type.includes('CONTRACT')) {
                const contract = (item as Contract) ?? null;
                setSelectedContract(contract);
                if (type === 'EDIT_CONTRACT' && contract?.id) {
                  setIsContractDetailLoading(true);
                  void (async () => {
                    try {
                      const detail = await fetchContractDetail(contract.id);
                      setSelectedContract(detail);
                    } catch (error) {
                      if (!isRequestCanceledError(error)) {
                        const message = error instanceof Error ? error.message : 'Không thể tải chi tiết hợp đồng.';
                        addToast('error', 'Tải dữ liệu thất bại', message);
                      }
                    } finally {
                      setIsContractDetailLoading(false);
                    }
                  })();
                }
                return;
              }

              if (type.includes('DOCUMENT')) {
                setSelectedDocument((item as Document) ?? null);
                return;
              }

              if (type.includes('REMINDER')) {
                setSelectedReminder((item as Reminder) ?? null);
                return;
              }

              if (type.includes('USER_DEPT_HISTORY')) {
                setSelectedUserDeptHistory((item as UserDeptHistory) ?? null);
                return;
              }

              if (
                type === 'VIEW_FEEDBACK'
                || type === 'EDIT_FEEDBACK'
                || type === 'ADD_FEEDBACK'
                || type === 'DELETE_FEEDBACK'
              ) {
                const feedback = (item as FeedbackRequest) ?? null;
                setSelectedFeedback(feedback);
                if ((type === 'VIEW_FEEDBACK' || type === 'EDIT_FEEDBACK') && feedback?.id) {
                  setIsFeedbackDetailLoading(true);
                  void (async () => {
                    try {
                      const detail = await fetchFeedbackDetail(feedback.id);
                      setSelectedFeedback(detail);
                    } catch (error) {
                      if (!isRequestCanceledError(error)) {
                        const message = error instanceof Error ? error.message : 'Không thể tải chi tiết phản hồi.';
                        addToast('error', 'Tải dữ liệu thất bại', message);
                      }
                    } finally {
                      setIsFeedbackDetailLoading(false);
                    }
                  })();
                }
              }
            }} addToast={addToast}
            departments={departments} employees={employees} businesses={businesses} vendors={vendors} products={products} customers={customers} cusPersonnel={cusPersonnel}
            projects={projects} projectItems={projectItems} contracts={contracts} paymentSchedules={paymentSchedules} reminders={reminders} userDeptHistory={userDeptHistory}
            supportServiceGroups={supportServiceGroups} supportContactPositions={supportContactPositions} productUnitMasters={productUnitMasters} supportRequestStatuses={supportRequestStatuses} projectTypes={projectTypes}
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
            onSendReminderEmail={async (reminderId, recipientEmail): Promise<SendReminderEmailResult> => {
              const result = await sendReminderEmail(String(reminderId), { recipient_email: recipientEmail });
              return result;
            }}
            exportProjectsByCurrentQuery={exportProjectsByCurrentQuery} exportProjectRaciByProjectIds={exportProjectRaciByProjectIds} exportContractsByCurrentQuery={exportContractsByCurrentQuery}
            handleCreateSupportServiceGroup={async (d) => { const c = await createSupportServiceGroup(d); setSupportServiceGroups((p) => [c, ...p]); return c; }}
            handleUpdateSupportServiceGroup={async (id, d) => { const u = await updateSupportServiceGroup(id, d); setSupportServiceGroups((p) => p.map((i) => (String(i.id) === String(u.id) ? u : i))); return u; }}
            handleCreateSupportContactPosition={async (d) => { const c = await createSupportContactPosition(d); setSupportContactPositions((p) => [c, ...p]); return c; }}
            handleCreateProductUnitMaster={async (d) => { const c = await createProductUnitMaster(d); setProductUnitMasters((p) => [c, ...p]); return c; }}
            handleCreateSupportContactPositionsBulk={createSupportContactPositionsBulk}
            handleUpdateSupportContactPosition={async (id, d) => { const u = await updateSupportContactPosition(id, d); setSupportContactPositions((p) => p.map((i) => (String(i.id) === String(u.id) ? u : i))); return u; }}
            handleUpdateProductUnitMaster={async (id, d) => { const u = await updateProductUnitMaster(id, d); setProductUnitMasters((p) => p.map((i) => (String(i.id) === String(u.id) ? u : i))); return u; }}
            handleCreateSupportRequestStatus={async (d) => { const c = await createSupportRequestStatus(d); setSupportRequestStatuses((p) => [c, ...p]); return c; }}
            handleUpdateSupportRequestStatusDefinition={async (id, d) => { const u = await updateSupportRequestStatusDefinition(id, d); setSupportRequestStatuses((p) => p.map((i) => (String(i.id) === String(u.id) ? u : i))); return u; }}
            handleCreateProjectType={async (d) => { const c = await createProjectType(d); setProjectTypes((p) => [c, ...p]); return c; }}
            handleUpdateProjectType={async (id, d) => { const u = await updateProjectType(id, d); setProjectTypes((p) => p.map((i) => (String(i.id) === String(u.id) ? u : i))); return u; }}
            handleCreateWorklogActivityType={async (d) => { const c = await createWorklogActivityType(d); setWorklogActivityTypes((p) => [c, ...p]); return c; }}
            handleUpdateWorklogActivityType={async (id, d) => { const u = await updateWorklogActivityType(id, d); setWorklogActivityTypes((p) => p.map((i) => (String(i.id) === String(u.id) ? u : i))); return u; }}
            handleCreateSupportSlaConfig={async (d) => { const c = await createSupportSlaConfig(d); setSupportSlaConfigs((p) => [c, ...p]); return c; }}
            handleUpdateSupportSlaConfig={async (id, d) => { const u = await updateSupportSlaConfig(id, d); setSupportSlaConfigs((p) => p.map((i) => (String(i.id) === String(u.id) ? u : i))); return u; }}
            refreshAccessControlData={async () => { const [r, p, u] = await Promise.all([fetchRoles(), fetchPermissions(), fetchUserAccess()]); setRoles(r || []); setPermissions(p || []); setUserAccessRecords(u || []); }}
            handleUpdateAccessRoles={async (uid, rids) => { const u = await updateUserAccessRoles(uid, rids); setUserAccessRecords((p) => p.map((i) => (Number(i.user.id) === Number(u.user.id) ? u : i))); }}
            handleBulkUpdateAccessRoles={async () => {}}
            handleBulkUpdateAccessPermissions={async () => {}}
            handleBulkUpdateAccessScopes={async () => {}}
            handleUpdateAccessPermissions={async (uid, o) => { const u = await updateUserAccessPermissions(uid, o); setUserAccessRecords((p) => p.map((i) => (Number(i.user.id) === Number(u.user.id) ? u : i))); }}
            handleUpdateAccessScopes={async (uid, s) => { const u = await updateUserAccessDeptScopes(uid, s); setUserAccessRecords((p) => p.map((i) => (Number(i.user.id) === Number(u.user.id) ? u : i))); }}
            backblazeB2Settings={backblazeB2Settings} googleDriveSettings={googleDriveSettings} emailSmtpSettings={emailSmtpSettings} contractExpiryAlertSettings={contractExpiryAlertSettings} contractPaymentAlertSettings={contractPaymentAlertSettings}
            isBackblazeB2SettingsLoading={isBackblazeB2SettingsLoading} isGoogleDriveSettingsLoading={isGoogleDriveSettingsLoading} isEmailSmtpSettingsLoading={isEmailSmtpSettingsLoading} isContractExpiryAlertSettingsLoading={isContractExpiryAlertSettingsLoading}
            isContractPaymentAlertSettingsLoading={isContractPaymentAlertSettingsLoading} isGoogleDriveSettingsSaving={isGoogleDriveSettingsSaving} isGoogleDriveSettingsTesting={isGoogleDriveSettingsTesting}
            isBackblazeB2SettingsSaving={isBackblazeB2SettingsSaving} isBackblazeB2SettingsTesting={isBackblazeB2SettingsTesting} isEmailSmtpSettingsSaving={isEmailSmtpSettingsSaving} isEmailSmtpSettingsTesting={isEmailSmtpSettingsTesting}
            isContractExpiryAlertSettingsSaving={isContractExpiryAlertSettingsSaving}
            isContractPaymentAlertSettingsSaving={isContractPaymentAlertSettingsSaving}
            refreshIntegrationSettings={async () => { const [b, g, e, ce, cp] = await Promise.all([fetchBackblazeB2IntegrationSettings(), fetchGoogleDriveIntegrationSettings(), fetchEmailSmtpIntegrationSettings(), fetchContractExpiryAlertSettings(), fetchContractPaymentAlertSettings()]); setBackblazeB2Settings(b); setGoogleDriveSettings(g); setEmailSmtpSettings(e); setContractExpiryAlertSettings(ce); setContractPaymentAlertSettings(cp); }}
            handleSaveBackblazeB2Settings={async (p) => { const u = await updateBackblazeB2IntegrationSettings(p); setBackblazeB2Settings(u); }}
            handleSaveGoogleDriveSettings={async (p) => { const u = await updateGoogleDriveIntegrationSettings(p); setGoogleDriveSettings(u); }}
            handleSaveEmailSmtpSettings={async (p) => { const u = await updateEmailSmtpIntegrationSettings(p); setEmailSmtpSettings(u); }}
            handleSaveContractExpiryAlertSettings={async (p) => { const u = await updateContractExpiryAlertSettings(p); setContractExpiryAlertSettings(u); loadContractsPage(); }}
            handleSaveContractPaymentAlertSettings={async (p) => { const u = await updateContractPaymentAlertSettings(p); setContractPaymentAlertSettings(u); loadContractsPage(); }}
            handleTestBackblazeB2Integration={async (p) => { const r = await testBackblazeB2IntegrationSettings(p); addToast('success', 'Kết nối Backblaze B2', r.message || 'Kết nối thành công.'); return r; }}
            handleTestGoogleDriveIntegration={async (p) => { const r = await testGoogleDriveIntegrationSettings(p); addToast('success', 'Kết nối Google Drive', r.message || 'Kết nối thành công.'); return r; }}
            handleTestEmailSmtpIntegration={async (p) => { const r = await testEmailSmtpIntegrationSettings(p); addToast('success', 'Kết nối Email SMTP', r.message || 'Kết nối thành công.'); return r; }}
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
        {modalType === 'ADD_DEPARTMENT' && <DepartmentFormModal type="ADD" data={selectedDept} departments={departments} onClose={() => setModalType(null)} onSave={async (d) => { await runSavingTask(async () => { await createDepartment(d); await refreshDepartmentsData(); setModalType(null); }); }} isLoading={isSaving} />}
        {modalType === 'EDIT_DEPARTMENT' && <DepartmentFormModal type="EDIT" data={selectedDept} departments={departments} onClose={() => setModalType(null)} onSave={async (d) => { await runSavingTask(async () => { if (selectedDept) { await updateDepartment(selectedDept.id, d); await refreshDepartmentsData(); setModalType(null); } }); }} isLoading={isSaving} />}
        {modalType === 'VIEW_DEPARTMENT' && selectedDept && <ViewDepartmentModal data={selectedDept} departments={departments} onClose={() => setModalType(null)} onEdit={() => { setModalType('EDIT_DEPARTMENT'); }} />}
        {modalType === 'DELETE_DEPARTMENT' && selectedDept && <DeleteWarningModal data={selectedDept} onClose={() => setModalType(null)} onConfirm={async () => { await runSavingTask(async () => { await deleteDepartment(selectedDept.id); await refreshDepartmentsData(); setModalType(null); }); }} />}
        {modalType === 'IMPORT_DATA' && <ImportModal title="Nhập dữ liệu" moduleKey={importModalModuleKey} onClose={closeImportModal} onSave={handleImportData} isLoading={isSaving} loadingText={importLoadingText} />}
        {modalType === 'ADD_EMPLOYEE' && <EmployeeFormModal type="ADD" data={selectedEmployee} departments={departments} onClose={() => setModalType(null)} onSave={async (d) => { await runSavingTask(async () => { const result = await createEmployeeWithProvisioning(d); await refreshEmployeesData(); if (result.provisioning?.temporary_password) { setEmployeeProvisioning({ employeeLabel: result.employee.user_code || `#${result.employee.id}`, provisioning: result.provisioning }); } setModalType(null); }); }} isLoading={isSaving} onResetPassword={undefined} isResettingPassword={false} />}
        {modalType === 'EDIT_EMPLOYEE' && <EmployeeFormModal type="EDIT" data={selectedEmployee} departments={departments} onClose={() => setModalType(null)} onSave={async (d) => { await runSavingTask(async () => { if (selectedEmployee) { await updateEmployee(selectedEmployee.id, d); await refreshEmployeesData(); setModalType(null); } }); }} isLoading={isSaving} onResetPassword={async () => { if (!selectedEmployee) return; setIsEmployeePasswordResetting(true); try { const result = await resetEmployeePassword(selectedEmployee.id); setEmployees(employees.map(emp => String(emp.id) === String(result.employee.id) ? result.employee : emp)); if (result.provisioning?.temporary_password) { setEmployeeProvisioning({ employeeLabel: result.employee.user_code || `#${result.employee.id}`, provisioning: result.provisioning }); } } finally { setIsEmployeePasswordResetting(false); } }} isResettingPassword={isEmployeePasswordResetting} />}
        {modalType === 'DELETE_EMPLOYEE' && selectedEmployee && <DeleteEmployeeModal data={selectedEmployee} onClose={() => setModalType(null)} onConfirm={async () => { await runSavingTask(async () => { await deleteEmployee(selectedEmployee.id); await refreshEmployeesData(); setModalType(null); }); }} />}
        {(modalType === 'ADD_PARTY_PROFILE' || modalType === 'EDIT_PARTY_PROFILE') && <EmployeePartyProfileModal type={modalType === 'ADD_PARTY_PROFILE' ? 'ADD' : 'EDIT'} data={selectedPartyProfile} employees={employees} departments={departments} existingProfiles={partyProfilesPageRows} onClose={() => { setSelectedPartyProfile(null); setModalType(null); }} onSave={handleSavePartyProfile} />}
        {modalType === 'ADD_BUSINESS' && <BusinessFormModal type="ADD" data={selectedBusiness} onClose={() => setModalType(null)} onSave={async (d) => { await runSavingTask(async () => { await createBusiness(d); await refreshBusinessesData(); setModalType(null); }); }} />}
        {modalType === 'EDIT_BUSINESS' && <BusinessFormModal type="EDIT" data={selectedBusiness} onClose={() => setModalType(null)} onSave={async (d) => { await runSavingTask(async () => { if (selectedBusiness) { await updateBusiness(selectedBusiness.id, d); await refreshBusinessesData(); setModalType(null); } }); }} />}
        {modalType === 'DELETE_BUSINESS' && selectedBusiness && <DeleteBusinessModal data={selectedBusiness} onClose={() => setModalType(null)} onConfirm={async () => { await runSavingTask(async () => { await deleteBusiness(selectedBusiness.id); await refreshBusinessesData(); setModalType(null); }); }} />}
        {modalType === 'ADD_VENDOR' && <VendorFormModal type="ADD" data={selectedVendor} onClose={() => setModalType(null)} onSave={async (d) => { await runSavingTask(async () => { await createVendor(d); await refreshVendorsData(); setModalType(null); }); }} />}
        {modalType === 'EDIT_VENDOR' && <VendorFormModal type="EDIT" data={selectedVendor} onClose={() => setModalType(null)} onSave={async (d) => { await runSavingTask(async () => { if (selectedVendor) { await updateVendor(selectedVendor.id, d); await refreshVendorsData(); setModalType(null); } }); }} />}
        {modalType === 'DELETE_VENDOR' && selectedVendor && <DeleteVendorModal data={selectedVendor} onClose={() => setModalType(null)} onConfirm={async () => { await runSavingTask(async () => { await deleteVendor(selectedVendor.id); await refreshVendorsData(); setModalType(null); }); }} />}
        {modalType === 'ADD_FEEDBACK' && <FeedbackFormModal type="ADD" data={selectedFeedback} isSaving={isSaving} onClose={() => setModalType(null)} onSave={async (d) => { await runSavingTask(async () => { await createFeedback({ title: d.title, description: d.description || null, priority: d.priority }); await refreshFeedbacksData(); setModalType(null); }); }} />}
        {modalType === 'EDIT_FEEDBACK' && <FeedbackFormModal type="EDIT" data={selectedFeedback} isSaving={isSaving || isFeedbackDetailLoading} onClose={() => setModalType(null)} onSave={async (d) => { await runSavingTask(async () => { if (selectedFeedback) { await updateFeedback(selectedFeedback.id, { title: d.title, description: d.description || null, priority: d.priority }); await refreshFeedbacksData(); setModalType(null); } }); }} />}
        {modalType === 'VIEW_FEEDBACK' && <FeedbackViewModal data={selectedFeedback} employees={employees} onClose={() => setModalType(null)} onEdit={() => { if (hasPermission(authUser, 'feedback_requests.write') && selectedFeedback) { setSelectedFeedback(selectedFeedback); setModalType('EDIT_FEEDBACK'); } }} />}
        {modalType === 'DELETE_FEEDBACK' && selectedFeedback && <DeleteFeedbackModal data={selectedFeedback} onClose={() => setModalType(null)} onConfirm={async () => { await runSavingTask(async () => { await deleteFeedback(selectedFeedback.id); await refreshFeedbacksData(); setModalType(null); }); }} />}
        {modalType === 'ADD_PRODUCT' && <ProductFormModal type="ADD" data={selectedProduct} businesses={businesses} vendors={vendors} productUnitMasters={productUnitMasters} onClose={() => setModalType(null)} onSave={async (d) => { await runSavingTask(async () => { await createProduct({ ...d, service_group: normalizeProductServiceGroup(d.service_group || DEFAULT_PRODUCT_SERVICE_GROUP), unit: normalizeProductUnitForSave(d.unit) }); await refreshProductsData(); setModalType(null); }); }} />}
        {modalType === 'EDIT_PRODUCT' && <ProductFormModal type="EDIT" data={selectedProduct} businesses={businesses} vendors={vendors} productUnitMasters={productUnitMasters} onClose={() => setModalType(null)} onSave={async (d) => { await runSavingTask(async () => { if (selectedProduct) { await updateProduct(selectedProduct.id, { ...d, service_group: normalizeProductServiceGroup(d.service_group || DEFAULT_PRODUCT_SERVICE_GROUP), unit: normalizeProductUnitForSave(d.unit) }); await refreshProductsData(); setModalType(null); } }); }} />}
        {modalType === 'DELETE_PRODUCT' && selectedProduct && <DeleteProductModal data={selectedProduct} onClose={() => setModalType(null)} onConfirm={async () => { await handleDeleteProduct(selectedProduct); }} />}
        {modalType === 'CANNOT_DELETE_PRODUCT' && selectedProduct && <CannotDeleteProductModal data={selectedProduct} reason={productDeleteDependencyMessage} onClose={() => setModalType(null)} />}
        {modalType === 'PRODUCT_FEATURE_CATALOG' && selectedProduct && <ProductFeatureCatalogModal product={selectedProduct} canManage={hasPermission(authUser, 'products.write')} onClose={() => setModalType(null)} onNotify={addToast} />}
        {modalType === 'PRODUCT_TARGET_SEGMENT' && selectedProduct && <ProductTargetSegmentModal product={selectedProduct} canManage={hasPermission(authUser, 'products.write')} onClose={() => setModalType(null)} onNotify={addToast} />}
        {modalType === 'ADD_CUSTOMER' && <CustomerFormModal type="ADD" data={selectedCustomer} onClose={() => setModalType(null)} onSave={async (d) => { await handleSaveCustomer(d); }} />}
        {modalType === 'EDIT_CUSTOMER' && <CustomerFormModal type="EDIT" data={selectedCustomer} onClose={() => setModalType(null)} onSave={async (d) => { if (selectedCustomer) { await handleSaveCustomer(d, selectedCustomer.id); } }} />}
        {modalType === 'DELETE_CUSTOMER' && selectedCustomer && <DeleteCustomerModal data={selectedCustomer} onClose={() => setModalType(null)} onConfirm={async () => { await handleDeleteCustomer(selectedCustomer); }} />}
        {modalType === 'CANNOT_DELETE_CUSTOMER' && selectedCustomer && <CannotDeleteCustomerModal data={selectedCustomer} onClose={() => setModalType(null)} />}
        {modalType === 'CUSTOMER_INSIGHT' && selectedCustomer && <CustomerInsightPanel customer={selectedCustomer} onClose={() => setModalType(null)} />}
        {modalType === 'ADD_CUS_PERSONNEL' && <CusPersonnelFormModal type="ADD" data={selectedCusPersonnel} customers={customers} supportContactPositions={supportContactPositions} isCustomersLoading={false} isSupportContactPositionsLoading={false} onClose={() => setModalType(null)} onSave={async (d) => { const success = await handleSaveCusPersonnel(d, 'ADD_CUS_PERSONNEL', null); if (success) { setSelectedCusPersonnel(null); setModalType(null); } }} />}
        {modalType === 'EDIT_CUS_PERSONNEL' && <CusPersonnelFormModal type="EDIT" data={selectedCusPersonnel} customers={customers} supportContactPositions={supportContactPositions} isCustomersLoading={false} isSupportContactPositionsLoading={false} onClose={() => setModalType(null)} onSave={async (d) => { const success = await handleSaveCusPersonnel(d, 'EDIT_CUS_PERSONNEL', selectedCusPersonnel); if (success) { setSelectedCusPersonnel(null); setModalType(null); } }} />}
        {modalType === 'DELETE_CUS_PERSONNEL' && selectedCusPersonnel && <DeleteCusPersonnelModal data={selectedCusPersonnel} onClose={() => setModalType(null)} onConfirm={async () => { const success = await handleDeleteCusPersonnel(selectedCusPersonnel); if (success) { setSelectedCusPersonnel(null); setModalType(null); } }} />}
        {modalType === 'ADD_PROJECT' && <ProjectFormModal type="ADD" data={selectedProject} initialTab={projectModalInitialTab} customers={customers} products={products} projectItems={projectItems} projectTypes={projectTypes} employees={employees} departments={departments} isCustomersLoading={false} isProductsLoading={false} isEmployeesLoading={false} isDepartmentsLoading={false} isProjectTypesLoading={false} onClose={() => setModalType(null)} onSave={async (d) => { await runSavingTask(async () => { await createProject({ ...d, sync_items: Array.isArray(d.items), sync_raci: Array.isArray(d.raci), items: Array.isArray(d.items) ? d.items.map(i => ({ product_id: Number(i.productId), quantity: Number(i.quantity), unit_price: Number(i.unitPrice) })) as unknown as ProjectItem[] : undefined, raci: Array.isArray(d.raci) ? d.raci.map(r => ({ user_id: Number(r.userId), raci_role: r.roleType ?? r.raci_role })) as unknown as ProjectRACI[] : undefined }); await refreshProjectsData(); setModalType(null); }); }} onNotify={addToast} onImportProjectItemsBatch={async () => ({ success_projects: [], failed_projects: [] })} onImportProjectRaciBatch={async () => ({ success_projects: [], failed_projects: [] })} onViewProcedure={(project) => { setModalType(null); setProcedureProject(project); }} />}
        {modalType === 'EDIT_PROJECT' && <ProjectFormModal type="EDIT" data={selectedProject} initialTab={projectModalInitialTab} customers={customers} products={products} projectItems={projectItems} projectTypes={projectTypes} employees={employees} departments={departments} isCustomersLoading={false} isProductsLoading={false} isEmployeesLoading={false} isDepartmentsLoading={false} isProjectTypesLoading={false} onClose={() => setModalType(null)} onSave={async (d) => { await runSavingTask(async () => { if (selectedProject) { const updated = await updateProject(selectedProject.id, { ...d, sync_items: Array.isArray(d.items), sync_raci: Array.isArray(d.raci), items: Array.isArray(d.items) ? d.items.map(i => ({ product_id: Number(i.productId), quantity: Number(i.quantity), unit_price: Number(i.unitPrice) })) as unknown as ProjectItem[] : undefined, raci: Array.isArray(d.raci) ? d.raci.map(r => ({ user_id: Number(r.userId), raci_role: r.roleType ?? r.raci_role })) as unknown as ProjectRACI[] : undefined }); await refreshProjectsData(); setSelectedProject(updated); addToast('success', 'Thành công', 'Cập nhật dự án thành công.'); } }); }} onNotify={addToast} onImportProjectItemsBatch={async () => ({ success_projects: [], failed_projects: [] })} onImportProjectRaciBatch={async () => ({ success_projects: [], failed_projects: [] })} onViewProcedure={(project) => { setModalType(null); setProcedureProject(project); }} />}
        {modalType === 'DELETE_PROJECT' && selectedProject && <DeleteProjectModal data={selectedProject} onClose={() => setModalType(null)} onConfirm={async () => { await handleDeleteProject(selectedProject); }} />}
        {modalType === 'ADD_CONTRACT' && <ContractModal type="ADD" data={null} prefill={contractAddPrefill} projects={projects} businesses={businesses} products={products} projectItems={projectItems} customers={customers} paymentSchedules={paymentSchedules} isCustomersLoading={false} isProjectsLoading={false} isProductsLoading={false} isProjectItemsLoading={false} isDetailLoading={false} isPaymentLoading={isPaymentScheduleLoading} onClose={() => setModalType(null)} onSave={async (d) => { await runSavingTask(async () => { await createContract(d); await refreshContractsData(); setModalType(null); }); }} onGenerateSchedules={async (contractId) => { await generateContractPayments(contractId); }} onRefreshSchedules={async (contractId) => { const rows = await fetchPaymentSchedules(contractId); setPaymentSchedules(rows || []); }} onConfirmPayment={async (scheduleId, payload) => { await updatePaymentSchedule(scheduleId, payload); }} />}
        {modalType === 'EDIT_CONTRACT' && <ContractModal type="EDIT" data={selectedContract} prefill={null} projects={projects} businesses={businesses} products={products} projectItems={projectItems} customers={customers} paymentSchedules={paymentSchedules} isCustomersLoading={false} isProjectsLoading={false} isProductsLoading={false} isProjectItemsLoading={false} isDetailLoading={isContractDetailLoading} isPaymentLoading={isPaymentScheduleLoading} onClose={() => setModalType(null)} onSave={async (d) => { await runSavingTask(async () => { if (selectedContract) { await updateContract(selectedContract.id, d); await refreshContractsData(); setModalType(null); } }); }} onGenerateSchedules={async (contractId) => { await generateContractPayments(contractId); }} onRefreshSchedules={async (contractId) => { const rows = await fetchPaymentSchedules(contractId); setPaymentSchedules(rows || []); }} onConfirmPayment={async (scheduleId, payload) => { await updatePaymentSchedule(scheduleId, payload); }} />}
        {modalType === 'DELETE_CONTRACT' && selectedContract && <DeleteContractModal data={selectedContract} onClose={() => setModalType(null)} onConfirm={async () => { await runSavingTask(async () => { await deleteContract(selectedContract.id); await refreshContractsData(); setModalType(null); }); }} />}
        {procedureProject && <ProjectProcedureModal project={procedureProject} isOpen={true} onClose={() => setProcedureProject(null)} onNotify={addToast} projectTypes={projectTypes} authUser={authUser} />}
        {modalType === 'ADD_DOCUMENT' && <DocumentFormModal type="ADD" data={selectedDocument} customers={customers} projects={projects} products={products} preselectedProduct={null} mode="default" isCustomersLoading={false} isProjectsLoading={false} isProductsLoading={false} isSaving={isSaving} onClose={() => setModalType(null)} onSave={async (d) => { await handleSaveDocument(d, 'ADD_DOCUMENT'); }} />}
        {modalType === 'EDIT_DOCUMENT' && <DocumentFormModal type="EDIT" data={selectedDocument} customers={customers} projects={projects} products={products} preselectedProduct={null} mode="default" isCustomersLoading={false} isProjectsLoading={false} isProductsLoading={false} isSaving={isSaving} onClose={() => setModalType(null)} onSave={async (d) => { await handleSaveDocument(d, 'EDIT_DOCUMENT'); }} />}
        {modalType === 'UPLOAD_PRODUCT_DOCUMENT' && (
          <DocumentFormModal
            type="ADD"
            data={null}
            customers={customers}
            projects={projects}
            products={products}
            preselectedProduct={selectedProduct}
            mode="product_upload"
            isCustomersLoading={false}
            isProjectsLoading={false}
            isProductsLoading={false}
            isSaving={isSaving}
            onClose={() => {
              setSelectedProduct(null);
              setModalType(null);
            }}
            onSave={async (d) => {
              await handleSaveDocument(d, 'UPLOAD_PRODUCT_DOCUMENT');
            }}
          />
        )}
        {modalType === 'DELETE_DOCUMENT' && selectedDocument && <DeleteDocumentModal data={selectedDocument} onClose={() => setModalType(null)} onConfirm={async () => { await runSavingTask(async () => { await deleteDocument(selectedDocument.id); await refreshDocumentsData(); setModalType(null); }); }} />}
        {modalType === 'ADD_REMINDER' && <ReminderFormModal type="ADD" data={selectedReminder} employees={employees} onClose={() => setModalType(null)} onSave={async (d) => { setIsSaving(true); try { const created = await createReminder(d); setReminders((prev) => [created, ...prev]); setModalType(null); } finally { setIsSaving(false); } }} />}
        {modalType === 'EDIT_REMINDER' && <ReminderFormModal type="EDIT" data={selectedReminder} employees={employees} onClose={() => setModalType(null)} onSave={async (d) => { if (!selectedReminder?.id) return; setIsSaving(true); try { const updated = await updateReminder(selectedReminder.id, d); setReminders((prev) => prev.map((r) => (r.id === updated.id ? updated : r))); setModalType(null); } finally { setIsSaving(false); } }} />}
        {modalType === 'DELETE_REMINDER' && selectedReminder && <DeleteReminderModal data={selectedReminder} onClose={() => setModalType(null)} onConfirm={async () => { setIsSaving(true); try { await deleteReminder(selectedReminder.id); setReminders((prev) => prev.filter((r) => r.id !== selectedReminder.id)); setModalType(null); } finally { setIsSaving(false); } }} />}
        {modalType === 'ADD_USER_DEPT_HISTORY' && <UserDeptHistoryFormModal type="ADD" data={selectedUserDeptHistory} employees={employees} departments={departments} onClose={() => setModalType(null)} onSave={async (d) => { await runSavingTask(async () => { await createUserDeptHistory(d); await refreshUserDeptHistoryData(); setModalType(null); }); }} />}
        {modalType === 'EDIT_USER_DEPT_HISTORY' && <UserDeptHistoryFormModal type="EDIT" data={selectedUserDeptHistory} employees={employees} departments={departments} onClose={() => setModalType(null)} onSave={async (d) => { await runSavingTask(async () => { if (!selectedUserDeptHistory?.id) return; await updateUserDeptHistory(selectedUserDeptHistory.id, d); await refreshUserDeptHistoryData(); setModalType(null); }); }} />}
        {modalType === 'DELETE_USER_DEPT_HISTORY' && selectedUserDeptHistory && <DeleteUserDeptHistoryModal data={selectedUserDeptHistory} onClose={() => setModalType(null)} onConfirm={async () => { await runSavingTask(async () => { await deleteUserDeptHistory(selectedUserDeptHistory.id); await refreshUserDeptHistoryData(); setModalType(null); }); }} />}
      </Suspense>
    </div>
  );
};

export default App;
