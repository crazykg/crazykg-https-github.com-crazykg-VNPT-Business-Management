import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './components/LoginPage';
import { ToastContainer } from './components/Toast';
import type { InternalUserSubTab } from './components/InternalUserModuleTabs';
import type {
  ImportPayload,
  ProjectItemImportBatchGroup,
  ProjectItemImportBatchResult,
  ProjectRaciImportBatchGroup,
  ProjectRaciImportBatchResult,
} from './components/Modals';
import {
  AuditLog,
  BulkMutationResult,
  Department,
  Employee,
  Business,
  Vendor,
  Product,
  Customer,
  CustomerPersonnel,
  Opportunity,
  OpportunityRaciRow,
  OpportunityStageOption,
  Project,
  ProjectItemMaster,
  ProjectRaciRow,
  Contract,
  Document,
  Reminder,
  UserDeptHistory,
  ModalType,
  Toast,
  DashboardStats,
  OpportunityStage,
  ProjectStatus,
  PaymentSchedule,
  PaymentScheduleConfirmationPayload,
  HRStatistics,
  SupportServiceGroup,
  SupportContactPosition,
  SupportRequestStatusOption,
  SupportSlaConfigOption,
  AuthUser,
  EmployeeProvisioning,
  Role,
  Permission,
  UserAccessRecord,
  BackblazeB2IntegrationSettings,
  BackblazeB2IntegrationSettingsUpdatePayload,
  GoogleDriveIntegrationSettings,
  GoogleDriveIntegrationSettingsUpdatePayload,
  ContractExpiryAlertSettings,
  ContractExpiryAlertSettingsUpdatePayload,
  ContractPaymentAlertSettings,
  ContractPaymentAlertSettingsUpdatePayload,
  PaginatedQuery,
  PaginationMeta,
  WorklogActivityTypeOption,
  ProjectTypeOption,
  FeedbackRequest,
  FeedbackPriority,
  FeedbackStatus,
  Attachment,
} from './types';
import { buildHrStatistics } from './utils/hrAnalytics';
import { buildAgeRangeValidationMessage, isAgeInAllowedRange } from './utils/ageValidation';
import { canAccessTab, canOpenModal, hasPermission, resolveImportPermission } from './utils/authorization';
import { downloadExcelWorkbook } from './utils/excelTemplate';
import {
  DEFAULT_PAGINATION_META,
  createContract,
  createBusiness,
  createCustomer,
  createCustomerPersonnel,
  createDepartment,
  createDocument,
  createEmployeeWithProvisioning,
  createEmployeesBulk,
  createOpportunity,
  createProduct,
  createProject,
  createSupportServiceGroup,
  createSupportServiceGroupsBulk,
  createSupportContactPosition,
  createSupportContactPositionsBulk,
  createSupportSlaConfig,
  createSupportRequestStatus,
  createSupportRequestStatusesBulk,
  createWorklogActivityType,
  createOpportunityStage,
  createProjectType,
  updateSupportServiceGroup,
  updateSupportContactPosition,
  updateSupportSlaConfig,
  updateSupportRequestStatusDefinition,
  updateWorklogActivityType,
  updateOpportunityStage,
  updateProjectType,
  createVendor,
  deleteContract,
  deleteBusiness,
  deleteCustomer,
  deleteCustomerPersonnel,
  deleteDepartment,
  deleteDocument,
  deleteEmployee,
  deleteOpportunity,
  deleteProduct,
  deleteProject,
  deleteVendor,
  fetchAuditLogs,
  fetchAuditLogsPage,
  fetchAuthBootstrap,
  fetchCurrentUser,
  fetchBusinesses,
  fetchContracts,
  fetchContractsPage,
  fetchCustomerPersonnel,
  fetchCustomers,
  fetchCustomersPage,
  fetchDepartments,
  fetchDocuments,
  fetchDocumentsPage,
  fetchEmployees,
  fetchEmployeesPage,
  fetchBackblazeB2IntegrationSettings,
  fetchGoogleDriveIntegrationSettings,
  fetchContractExpiryAlertSettings,
  fetchContractPaymentAlertSettings,
  fetchOpportunityRaciAssignments,
  fetchOpportunities,
  fetchContractDetail,
  fetchProducts,
  fetchProjectDetail,
  fetchProjectRaciAssignments,
  fetchProjectItems,
  fetchProjects,
  fetchProjectsPage,
  fetchPermissions,
  fetchReminders,
  fetchRoles,
  fetchAsyncExportJob,
  downloadAsyncExportFile,
  fetchSupportSlaConfigs,
  fetchSupportRequestStatuses,
  fetchSupportServiceGroups,
  fetchSupportContactPositions,
  fetchWorklogActivityTypes,
  fetchOpportunityStages,
  fetchProjectTypes,
  fetchUserAccess,
  fetchUserDeptHistory,
  fetchVendors,
  fetchPaymentSchedules,
  generateContractPayments,
  createFeedback,
  updateFeedback,
  deleteFeedback,
  fetchFeedbacksPage,
  login,
  logout,
  changePasswordFirstLogin,
  resetEmployeePassword,
  updateContract,
  updateBusiness,
  updateCustomer,
  updateCustomerPersonnel,
  updateDepartment,
  updateDocument,
  updateEmployee,
  updatePaymentSchedule,
  updateOpportunity,
  updateProduct,
  updateProject,
  updateBackblazeB2IntegrationSettings,
  updateGoogleDriveIntegrationSettings,
  updateContractExpiryAlertSettings,
  updateContractPaymentAlertSettings,
  testBackblazeB2IntegrationSettings,
  testGoogleDriveIntegrationSettings,
  updateUserAccessDeptScopes,
  updateUserAccessPermissions,
  updateUserAccessRoles,
  updateVendor,
  isRequestCanceledError,
  registerTabEvictedHandler,
  unregisterTabEvictedHandler,
} from './services/v5Api';
import type { GenerateContractPaymentsPayload } from './services/v5Api';
import { useTabSession } from './hooks/useTabSession';

const Dashboard = lazy(() => import('./components/Dashboard').then((module) => ({ default: module.Dashboard })));
const InternalUserModuleTabs = lazy(() =>
  import('./components/InternalUserModuleTabs').then((module) => ({ default: module.InternalUserModuleTabs }))
);
const DepartmentList = lazy(() =>
  import('./components/DepartmentList').then((module) => ({ default: module.DepartmentList }))
);
const UserDeptHistoryList = lazy(() =>
  import('./components/UserDeptHistoryList').then((module) => ({ default: module.UserDeptHistoryList }))
);
const BusinessList = lazy(() => import('./components/BusinessList').then((module) => ({ default: module.BusinessList })));
const VendorList = lazy(() => import('./components/VendorList').then((module) => ({ default: module.VendorList })));
const ProductList = lazy(() => import('./components/ProductList').then((module) => ({ default: module.ProductList })));
const CustomerList = lazy(() => import('./components/CustomerList').then((module) => ({ default: module.CustomerList })));
const CusPersonnelList = lazy(() =>
  import('./components/CusPersonnelList').then((module) => ({ default: module.CusPersonnelList }))
);
const OpportunityList = lazy(() =>
  import('./components/OpportunityList').then((module) => ({ default: module.OpportunityList }))
);
const ProjectList = lazy(() => import('./components/ProjectList').then((module) => ({ default: module.ProjectList })));
const ProjectProcedureModal = lazy(() =>
  import('./components/ProjectProcedureModal').then((module) => ({ default: module.ProjectProcedureModal }))
);
const ContractList = lazy(() => import('./components/ContractList').then((module) => ({ default: module.ContractList })));
const DocumentList = lazy(() => import('./components/DocumentList').then((module) => ({ default: module.DocumentList })));
const ReminderList = lazy(() => import('./components/ReminderList').then((module) => ({ default: module.ReminderList })));
const SupportMasterManagement = lazy(() =>
  import('./components/SupportMasterManagement').then((module) => ({ default: module.SupportMasterManagement }))
);
const ProcedureTemplateManagement = lazy(() =>
  import('./components/ProcedureTemplateManagement').then((module) => ({ default: module.ProcedureTemplateManagement }))
);
const DepartmentWeeklyScheduleManagement = lazy(() =>
  import('./components/DepartmentWeeklyScheduleManagement').then((module) => ({ default: module.DepartmentWeeklyScheduleManagement }))
);
const CustomerRequestManagementHub = lazy(() =>
  import('./components/YeuCauManagementHub').then((module) => ({ default: module.YeuCauManagementHub }))
);
const AuditLogList = lazy(() => import('./components/AuditLogList').then((module) => ({ default: module.AuditLogList })));
const FeedbackList = lazy(() => import('./components/FeedbackList').then((module) => ({ default: module.FeedbackList })));
const IntegrationSettingsPanel = lazy(() =>
  import('./components/IntegrationSettingsPanel').then((module) => ({ default: module.IntegrationSettingsPanel }))
);
const AccessControlList = lazy(() =>
  import('./components/AccessControlList').then((module) => ({ default: module.AccessControlList }))
);
const ContractModal = lazy(() =>
  import('./components/ContractModal').then((module) => ({ default: module.ContractModal }))
);

const FeedbackFormModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.FeedbackFormModal }))
);
const FeedbackViewModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.FeedbackViewModal }))
);
const DeleteFeedbackModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.DeleteFeedbackModal }))
);

const DepartmentFormModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.DepartmentFormModal }))
);
const ViewDepartmentModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.ViewDepartmentModal }))
);
const DeleteWarningModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.DeleteWarningModal }))
);
const CannotDeleteModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.CannotDeleteModal }))
);
const ImportModal = lazy(() => import('./components/Modals').then((module) => ({ default: module.ImportModal })));
const EmployeeFormModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.EmployeeFormModal }))
);
const DeleteEmployeeModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.DeleteEmployeeModal }))
);
const BusinessFormModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.BusinessFormModal }))
);
const DeleteBusinessModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.DeleteBusinessModal }))
);
const VendorFormModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.VendorFormModal }))
);
const DeleteVendorModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.DeleteVendorModal }))
);
const ProductFormModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.ProductFormModal }))
);
const DeleteProductModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.DeleteProductModal }))
);
const CustomerFormModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.CustomerFormModal }))
);
const DeleteCustomerModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.DeleteCustomerModal }))
);
const CusPersonnelFormModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.CusPersonnelFormModal }))
);
const DeleteCusPersonnelModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.DeleteCusPersonnelModal }))
);
const OpportunityFormModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.OpportunityFormModal }))
);
const DeleteOpportunityModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.DeleteOpportunityModal }))
);
const ProjectFormModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.ProjectFormModal }))
);
const DeleteProjectModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.DeleteProjectModal }))
);
const DeleteContractModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.DeleteContractModal }))
);
const DocumentFormModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.DocumentFormModal }))
);
const DeleteDocumentModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.DeleteDocumentModal }))
);
const ReminderFormModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.ReminderFormModal }))
);
const DeleteReminderModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.DeleteReminderModal }))
);
const UserDeptHistoryFormModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.UserDeptHistoryFormModal }))
);
const DeleteUserDeptHistoryModal = lazy(() =>
  import('./components/Modals').then((module) => ({ default: module.DeleteUserDeptHistoryModal }))
);

const LazyModuleFallback: React.FC = () => (
  <div className="min-h-[300px] flex items-center justify-center py-16 text-slate-500">
    <div className="flex items-center gap-2">
      <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
      <span className="font-medium">Đang tải module...</span>
    </div>
  </div>
);

const App: React.FC = () => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  // ★ Thông báo thân thiện khi bị evict hoặc session timed out
  const [loginInfoMessage, setLoginInfoMessage] = useState('');
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [passwordChangeForm, setPasswordChangeForm] = useState({
    current_password: '',
    new_password: '',
    new_password_confirmation: '',
  });
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [internalUserSubTab, setInternalUserSubTab] = useState<InternalUserSubTab>('dashboard');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cusPersonnel, setCusPersonnel] = useState<CustomerPersonnel[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectItems, setProjectItems] = useState<ProjectItemMaster[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [paymentSchedules, setPaymentSchedules] = useState<PaymentSchedule[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [userDeptHistory, setUserDeptHistory] = useState<UserDeptHistory[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackRequest[]>([]);
  const [feedbacksPageRows, setFeedbacksPageRows] = useState<FeedbackRequest[]>([]);
  const [feedbacksPageMeta, setFeedbacksPageMeta] = useState<PaginationMeta | undefined>(undefined);
  const [feedbacksPageLoading, setFeedbacksPageLoading] = useState(false);
  const [supportServiceGroups, setSupportServiceGroups] = useState<SupportServiceGroup[]>([]);
  const [supportContactPositions, setSupportContactPositions] = useState<SupportContactPosition[]>([]);
  const [supportRequestStatuses, setSupportRequestStatuses] = useState<SupportRequestStatusOption[]>([]);
  const [opportunityStages, setOpportunityStages] = useState<OpportunityStageOption[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeOption[]>([]);
  const [worklogActivityTypes, setWorklogActivityTypes] = useState<WorklogActivityTypeOption[]>([]);
  const [supportSlaConfigs, setSupportSlaConfigs] = useState<SupportSlaConfigOption[]>([]);
  const [employeesPageRows, setEmployeesPageRows] = useState<Employee[]>([]);
  const [customersPageRows, setCustomersPageRows] = useState<Customer[]>([]);
  const [projectsPageRows, setProjectsPageRows] = useState<Project[]>([]);
  const [contractsPageRows, setContractsPageRows] = useState<Contract[]>([]);
  const [documentsPageRows, setDocumentsPageRows] = useState<Document[]>([]);
  const [auditLogsPageRows, setAuditLogsPageRows] = useState<AuditLog[]>([]);
  const [employeesPageMeta, setEmployeesPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [customersPageMeta, setCustomersPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [projectsPageMeta, setProjectsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [contractsPageMeta, setContractsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [documentsPageMeta, setDocumentsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [auditLogsPageMeta, setAuditLogsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [employeesPageLoading, setEmployeesPageLoading] = useState(false);
  const [customersPageLoading, setCustomersPageLoading] = useState(false);
  const [projectsPageLoading, setProjectsPageLoading] = useState(false);
  const [contractsPageLoading, setContractsPageLoading] = useState(false);
  const [documentsPageLoading, setDocumentsPageLoading] = useState(false);
  const [auditLogsPageLoading, setAuditLogsPageLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userAccessRecords, setUserAccessRecords] = useState<UserAccessRecord[]>([]);
  const [backblazeB2Settings, setBackblazeB2Settings] = useState<BackblazeB2IntegrationSettings | null>(null);
  const [googleDriveSettings, setGoogleDriveSettings] = useState<GoogleDriveIntegrationSettings | null>(null);
  const [contractExpiryAlertSettings, setContractExpiryAlertSettings] = useState<ContractExpiryAlertSettings | null>(null);
  const [contractPaymentAlertSettings, setContractPaymentAlertSettings] = useState<ContractPaymentAlertSettings | null>(null);
  const [isBackblazeB2SettingsLoading, setIsBackblazeB2SettingsLoading] = useState(false);
  const [isBackblazeB2SettingsSaving, setIsBackblazeB2SettingsSaving] = useState(false);
  const [isBackblazeB2SettingsTesting, setIsBackblazeB2SettingsTesting] = useState(false);
  const [isGoogleDriveSettingsLoading, setIsGoogleDriveSettingsLoading] = useState(false);
  const [isGoogleDriveSettingsSaving, setIsGoogleDriveSettingsSaving] = useState(false);
  const [isGoogleDriveSettingsTesting, setIsGoogleDriveSettingsTesting] = useState(false);
  const [isContractExpiryAlertSettingsLoading, setIsContractExpiryAlertSettingsLoading] = useState(false);
  const [isContractExpiryAlertSettingsSaving, setIsContractExpiryAlertSettingsSaving] = useState(false);
  const [isContractPaymentAlertSettingsLoading, setIsContractPaymentAlertSettingsLoading] = useState(false);
  const [isContractPaymentAlertSettingsSaving, setIsContractPaymentAlertSettingsSaving] = useState(false);
  
  const [modalType, setModalType] = useState<ModalType>(null);
  const [importModuleOverride, setImportModuleOverride] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCusPersonnel, setSelectedCusPersonnel] = useState<CustomerPersonnel | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectModalInitialTab, setProjectModalInitialTab] = useState<'info' | 'items' | 'raci'>('info');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [contractAddPrefill, setContractAddPrefill] = useState<Partial<Contract> | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [selectedUserDeptHistory, setSelectedUserDeptHistory] = useState<UserDeptHistory | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackRequest | null>(null);
  const [employeeProvisioning, setEmployeeProvisioning] = useState<{
    employeeLabel: string;
    provisioning: EmployeeProvisioning;
  } | null>(null);
  const [isEmployeePasswordResetting, setIsEmployeePasswordResetting] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [importLoadingText, setImportLoadingText] = useState('');
  const [isPaymentScheduleLoading, setIsPaymentScheduleLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const importInFlightRef = useRef(false);
  const prefetchedTabsRef = useRef<Set<string>>(new Set());
  const loadedModulesRef = useRef<Set<string>>(new Set());
  const datasetLoadInFlightRef = useRef<Record<string, Promise<void>>>({});
  const recentToastByKeyRef = useRef<Map<string, number>>(new Map());
  const pageLoadVersionRef = useRef<Record<string, number>>({});
  const pageQueryInFlightSignatureRef = useRef<Record<string, string>>({});
  const pageQueryDebounceRef = useRef<Record<string, number>>({});
  const recentTabDataLoadRef = useRef<Map<string, number>>(new Map());
  const projectDetailLoadVersionRef = useRef(0);
  const contractDetailLoadVersionRef = useRef(0);
  const employeesPageQueryRef = useRef<PaginatedQuery>({ page: 1, per_page: 7, sort_by: 'user_code', sort_dir: 'asc', q: '', filters: {} });
  const customersPageQueryRef = useRef<PaginatedQuery>({ page: 1, per_page: 10, sort_by: 'customer_code', sort_dir: 'asc', q: '', filters: {} });
  const projectsPageQueryRef = useRef<PaginatedQuery>({ page: 1, per_page: 10, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} });
  const contractsPageQueryRef = useRef<PaginatedQuery>({ page: 1, per_page: 10, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} });
  const documentsPageQueryRef = useRef<PaginatedQuery>({ page: 1, per_page: 7, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} });
  const auditLogsPageQueryRef = useRef<PaginatedQuery>({ page: 1, per_page: 10, sort_by: 'created_at', sort_dir: 'desc', q: '', filters: {} });
  const feedbacksPageQueryRef = useRef<PaginatedQuery>({ page: 1, per_page: 20, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} });

  const resetModuleData = () => {
    Object.keys(pageQueryDebounceRef.current).forEach((key) => {
      const timerId = pageQueryDebounceRef.current[key];
      if (typeof timerId === 'number') {
        window.clearTimeout(timerId);
      }
    });
    pageQueryDebounceRef.current = {};
    loadedModulesRef.current = new Set();
    datasetLoadInFlightRef.current = {};
    pageLoadVersionRef.current = {};
    pageQueryInFlightSignatureRef.current = {};
    recentTabDataLoadRef.current.clear();
    setDepartments([]);
    setEmployees([]);
    setBusinesses([]);
    setVendors([]);
    setProducts([]);
    setCustomers([]);
    setCusPersonnel([]);
    setOpportunities([]);
    setProjects([]);
    setProjectItems([]);
    setContracts([]);
    setPaymentSchedules([]);
    setDocuments([]);
    setReminders([]);
    setUserDeptHistory([]);
    setAuditLogs([]);
    setFeedbacks([]);
    setSelectedFeedback(null);
    setSupportServiceGroups([]);
    setSupportContactPositions([]);
    setSupportRequestStatuses([]);
    setOpportunityStages([]);
    setProjectTypes([]);
    setWorklogActivityTypes([]);
    setSupportSlaConfigs([]);
    setEmployeesPageRows([]);
    setCustomersPageRows([]);
    setProjectsPageRows([]);
    setContractsPageRows([]);
    setDocumentsPageRows([]);
    setAuditLogsPageRows([]);
    setFeedbacksPageRows([]);
    setEmployeesPageMeta(DEFAULT_PAGINATION_META);
    setCustomersPageMeta(DEFAULT_PAGINATION_META);
    setProjectsPageMeta(DEFAULT_PAGINATION_META);
    setContractsPageMeta(DEFAULT_PAGINATION_META);
    setDocumentsPageMeta(DEFAULT_PAGINATION_META);
    setAuditLogsPageMeta(DEFAULT_PAGINATION_META);
    setFeedbacksPageMeta(undefined);
    setEmployeesPageLoading(false);
    setCustomersPageLoading(false);
    setProjectsPageLoading(false);
    setContractsPageLoading(false);
    setDocumentsPageLoading(false);
    setAuditLogsPageLoading(false);
    setFeedbacksPageLoading(false);
    employeesPageQueryRef.current = { page: 1, per_page: 7, sort_by: 'user_code', sort_dir: 'asc', q: '', filters: {} };
    customersPageQueryRef.current = { page: 1, per_page: 10, sort_by: 'customer_code', sort_dir: 'asc', q: '', filters: {} };
    projectsPageQueryRef.current = { page: 1, per_page: 10, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} };
    contractsPageQueryRef.current = { page: 1, per_page: 10, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} };
    documentsPageQueryRef.current = { page: 1, per_page: 7, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} };
    auditLogsPageQueryRef.current = { page: 1, per_page: 10, sort_by: 'created_at', sort_dir: 'desc', q: '', filters: {} };
    feedbacksPageQueryRef.current = { page: 1, per_page: 20, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} };
    setRoles([]);
    setPermissions([]);
    setUserAccessRecords([]);
    setBackblazeB2Settings(null);
    setGoogleDriveSettings(null);
    setContractExpiryAlertSettings(null);
    setContractPaymentAlertSettings(null);
    setIsBackblazeB2SettingsLoading(false);
    setIsBackblazeB2SettingsSaving(false);
    setIsBackblazeB2SettingsTesting(false);
    setIsGoogleDriveSettingsLoading(false);
    setIsGoogleDriveSettingsSaving(false);
    setIsGoogleDriveSettingsTesting(false);
    setIsContractExpiryAlertSettingsLoading(false);
    setIsContractExpiryAlertSettingsSaving(false);
    setIsContractPaymentAlertSettingsLoading(false);
    setIsContractPaymentAlertSettingsSaving(false);
    setImportModuleOverride(null);
    recentToastByKeyRef.current.clear();
  };

  useEffect(() => {
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
          } catch {
            // fall through to unauthenticated state.
          }
        }

        setAuthUser(null);
        setPasswordChangeRequired(false);
      } finally {
        setIsAuthLoading(false);
      }
    };

    bootstrapAuth();
  }, []);

  useEffect(() => () => {
    Object.keys(pageQueryDebounceRef.current).forEach((key) => {
      const timerId = pageQueryDebounceRef.current[key];
      if (typeof timerId === 'number') {
        window.clearTimeout(timerId);
      }
    });
    pageQueryDebounceRef.current = {};
  }, []);

  useEffect(() => {
    if (!authUser) {
      resetModuleData();
      return;
    }
    if (passwordChangeRequired) {
      resetModuleData();
      return;
    }

    const ensureDatasetLoaded = async (datasetKey: string, forceReload = false): Promise<void> => {
      if (!forceReload && loadedModulesRef.current.has(datasetKey)) {
        return;
      }

      const inFlightPromise = datasetLoadInFlightRef.current[datasetKey];
      if (inFlightPromise) {
        return inFlightPromise;
      }

      const loaderPromise = (async () => {
        if (!forceReload) {
          loadedModulesRef.current.add(datasetKey);
        }
        try {
        switch (datasetKey) {
        case 'departments': {
          const rows = await fetchDepartments();
          setDepartments(rows || []);
          break;
        }
        case 'employees': {
          const rows = await fetchEmployees();
          setEmployees(rows || []);
          break;
        }
        case 'businesses': {
          const rows = await fetchBusinesses();
          setBusinesses(rows || []);
          break;
        }
        case 'vendors': {
          const rows = await fetchVendors();
          setVendors(rows || []);
          break;
        }
        case 'products': {
          const rows = await fetchProducts();
          setProducts((rows || []).map(normalizeProductRecord));
          break;
        }
        case 'customers': {
          const rows = await fetchCustomers();
          setCustomers(rows || []);
          break;
        }
        case 'customerPersonnel': {
          const rows = await fetchCustomerPersonnel();
          setCusPersonnel(
            (rows || []).map((item) => ({
              ...item,
              birthday: normalizeImportDate(String(item?.birthday || '')) || String(item?.birthday || '').trim(),
            }))
          );
          break;
        }
        case 'opportunities': {
          const rows = await fetchOpportunities();
          const withRaci = await attachOpportunityRaciRows(rows || []);
          setOpportunities(withRaci);
          break;
        }
        case 'projects': {
          const rows = await fetchProjects();
          setProjects(rows || []);
          break;
        }
        case 'projectItems': {
          const rows = await fetchProjectItems();
          setProjectItems(rows || []);
          break;
        }
        case 'contracts': {
          const rows = await fetchContracts();
          setContracts(rows || []);
          break;
        }
        case 'paymentSchedules': {
          const rows = await fetchPaymentSchedules();
          setPaymentSchedules(rows || []);
          break;
        }
        case 'documents': {
          const rows = await fetchDocuments();
          setDocuments(rows || []);
          break;
        }
        case 'reminders': {
          const rows = await fetchReminders();
          setReminders(rows || []);
          break;
        }
        case 'userDeptHistory': {
          const rows = await fetchUserDeptHistory();
          setUserDeptHistory(rows || []);
          break;
        }
        case 'auditLogs': {
          const rows = await fetchAuditLogs();
          setAuditLogs(rows || []);
          break;
        }
        case 'supportServiceGroups': {
          const rows = await fetchSupportServiceGroups(true);
          setSupportServiceGroups(rows || []);
          break;
        }
        case 'supportContactPositions': {
          const rows = await fetchSupportContactPositions(true);
          setSupportContactPositions(rows || []);
          break;
        }
        case 'supportRequestStatuses': {
          const rows = await fetchSupportRequestStatuses(true);
          setSupportRequestStatuses(rows || []);
          break;
        }
        case 'opportunityStages': {
          const rows = await fetchOpportunityStages(true);
          setOpportunityStages(rows || []);
          break;
        }
        case 'projectTypes': {
          const rows = await fetchProjectTypes(true);
          setProjectTypes(rows || []);
          break;
        }
        case 'worklogActivityTypes': {
          const rows = await fetchWorklogActivityTypes(true);
          setWorklogActivityTypes(rows || []);
          break;
        }
        case 'supportSlaConfigs': {
          const rows = await fetchSupportSlaConfigs(true);
          setSupportSlaConfigs(rows || []);
          break;
        }
        case 'roles': {
          const rows = await fetchRoles();
          setRoles(rows || []);
          break;
        }
        case 'permissions': {
          const rows = await fetchPermissions();
          setPermissions(rows || []);
          break;
        }
        case 'userAccess': {
          const rows = await fetchUserAccess();
          setUserAccessRecords(rows || []);
          break;
        }
        case 'backblazeB2Settings': {
          const settings = await fetchBackblazeB2IntegrationSettings().catch(() => null);
          setBackblazeB2Settings(settings);
          break;
        }
        case 'googleDriveSettings': {
          const settings = await fetchGoogleDriveIntegrationSettings().catch(() => null);
          setGoogleDriveSettings(settings);
          break;
        }
        case 'contractExpiryAlertSettings': {
          const settings = await fetchContractExpiryAlertSettings().catch(() => null);
          setContractExpiryAlertSettings(settings);
          break;
        }
        case 'contractPaymentAlertSettings': {
          const settings = await fetchContractPaymentAlertSettings().catch(() => null);
          setContractPaymentAlertSettings(settings);
          break;
        }
          default:
            return;
        }
        } catch (err) {
          if (!forceReload) {
            loadedModulesRef.current.delete(datasetKey);
          }
          throw err;
        }
      })();

      datasetLoadInFlightRef.current[datasetKey] = loaderPromise;
      try {
        await loaderPromise;
      } finally {
        if (datasetLoadInFlightRef.current[datasetKey] === loaderPromise) {
          delete datasetLoadInFlightRef.current[datasetKey];
        }
      }
    };

    const loadByActiveTab = async () => {
      const activeModule =
        activeTab === 'internal_user_dashboard'
          ? (internalUserSubTab === 'list' ? 'internal_user_list' : 'internal_user_dashboard')
          : activeTab;

      const throttledTabLoadKey = `${activeModule}::${activeModule === 'internal_user_dashboard' || activeModule === 'internal_user_list' ? internalUserSubTab : '-'}`;
      const now = Date.now();
      const lastLoadedAt = recentTabDataLoadRef.current.get(throttledTabLoadKey) ?? 0;
      if (now - lastLoadedAt < 600) {
        return;
      }
      recentTabDataLoadRef.current.set(throttledTabLoadKey, now);
      recentTabDataLoadRef.current.forEach((timestamp, key) => {
        if (now - timestamp > 30000) {
          recentTabDataLoadRef.current.delete(key);
        }
      });

      if (activeModule === 'internal_user_list') {
        await loadEmployeesPage();
      }
      if (activeModule === 'clients') {
        await loadCustomersPage();
      }
      if (activeModule === 'projects') {
        await loadProjectsPage();
      }
      if (activeModule === 'contracts') {
        await loadContractsPage();
      }
      if (activeModule === 'documents') {
        await loadDocumentsPage();
      }
      if (activeModule === 'audit_logs') {
        await loadAuditLogsPage();
      }
      if (activeModule === 'user_feedback') {
        await loadFeedbacksPage();
      }

      const datasetByTab: Record<string, string[]> = {
        dashboard: ['contracts', 'projects', 'opportunities', 'paymentSchedules'],
        internal_user_dashboard: ['employees', 'departments'],
        internal_user_list: ['departments'],
        departments: ['departments', 'employees'],
        user_dept_history: ['userDeptHistory', 'employees', 'departments'],
        businesses: ['businesses'],
        vendors: ['vendors'],
        products: ['products', 'businesses', 'vendors'],
        clients: [],
        cus_personnel: ['customerPersonnel', 'customers', 'supportContactPositions'],
        opportunities: ['opportunities', 'opportunityStages', 'customers', 'customerPersonnel', 'products', 'employees'],
        projects: [
          ...(hasPermission(authUser, 'customers.read') ? ['customers'] : []),
          ...(hasPermission(authUser, 'opportunities.read') ? ['opportunities'] : []),
          ...(hasPermission(authUser, 'products.read') ? ['products'] : []),
          ...(hasPermission(authUser, 'projects.read') ? ['projectItems'] : []),
          ...(hasPermission(authUser, 'projects.read') ? ['projectTypes'] : []),
          ...(hasPermission(authUser, 'employees.read') ? ['employees'] : []),
          ...(hasPermission(authUser, 'departments.read') ? ['departments'] : []),
        ],
        contracts: ['projects', 'customers', 'paymentSchedules', 'products', 'projectItems'],
        documents: ['customers', 'products'],
        reminders: ['reminders', 'employees'],
        customer_request_management: [
          'supportServiceGroups',
          'customers',
          'customerPersonnel',
          'employees',
        ],
        support_master_management: [
          ...(hasPermission(authUser, 'customers.read') ? ['customers'] : []),
          ...(hasPermission(authUser, 'support_service_groups.read') ? ['supportServiceGroups'] : []),
          ...(hasPermission(authUser, 'support_contact_positions.read') ? ['supportContactPositions'] : []),
          ...(hasPermission(authUser, 'support_requests.read') ? ['supportRequestStatuses'] : []),
          ...(hasPermission(authUser, 'support_requests.read') ? ['worklogActivityTypes'] : []),
          ...(hasPermission(authUser, 'support_requests.read') ? ['supportSlaConfigs'] : []),
          ...(hasPermission(authUser, 'opportunities.read') ? ['opportunityStages'] : []),
          ...(hasPermission(authUser, 'projects.read') ? ['projectTypes'] : []),
        ],
        procedure_template_config: [],
        department_weekly_schedule_management: ['departments', 'employees'],
        audit_logs: ['employees'],
        user_feedback: ['employees'],
        integration_settings: ['backblazeB2Settings', 'googleDriveSettings', 'contractExpiryAlertSettings', 'contractPaymentAlertSettings'],
        access_control: ['roles', 'permissions', 'userAccess', 'departments'],
      };

      const targets = datasetByTab[activeModule] || [];
      if (targets.length === 0) {
        return;
      }

      const forceReloadTargets = new Set<string>();
      if (activeModule === 'internal_user_dashboard' || activeModule === 'internal_user_list' || activeModule === 'departments') {
        forceReloadTargets.add('employees');
        forceReloadTargets.add('departments');
      }

      await Promise.allSettled(targets.map((key) => ensureDatasetLoaded(key, forceReloadTargets.has(key))));

      const prefetchCandidates: Record<string, string[]> = {
        dashboard: ['internal_user_dashboard', 'projects', 'customer_request_management'],
        internal_user_dashboard: ['internal_user_list', 'departments'],
        internal_user_list: ['internal_user_dashboard', 'departments'],
        projects: ['contracts', 'documents'],
        contracts: ['documents', 'projects'],
        customer_request_management: ['support_master_management'],
        support_master_management: ['customer_request_management'],
        procedure_template_config: ['projects', 'support_master_management'],
      };

      (prefetchCandidates[activeModule] || []).forEach((tabId) => {
        prefetchTabModules(tabId);
      });
    };

    void loadByActiveTab();
  }, [authUser, activeTab, internalUserSubTab, passwordChangeRequired]);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => (prev || []).filter(t => t.id !== id));
  }, []);

  // Helper to add toast
  const addToast = useCallback((type: 'success' | 'error', title: string, message: string) => {
    const toastKey = `${type}|${title}|${message}`;
    const now = Date.now();
    const lastShownAt = recentToastByKeyRef.current.get(toastKey) ?? 0;
    if (now - lastShownAt < 2500) {
      return;
    }
    recentToastByKeyRef.current.set(toastKey, now);
    recentToastByKeyRef.current.forEach((timestamp, key) => {
      if (now - timestamp > 30000) {
        recentToastByKeyRef.current.delete(key);
      }
    });

    const id = Date.now();
    setToasts(prev => [...prev, { id, type, title, message }]);
    window.setTimeout(() => removeToast(id), 5000);
  }, [removeToast]);

  const prefetchTabModules = useCallback((tab: string) => {
    const normalizedTab = String(tab || '').trim();
    if (!normalizedTab || prefetchedTabsRef.current.has(normalizedTab)) {
      return;
    }

    const prefetchTasks: Array<Promise<unknown>> = [];
    switch (normalizedTab) {
      case 'dashboard':
        prefetchTasks.push(import('./components/Dashboard'));
        break;
      case 'internal_user_dashboard':
      case 'internal_user_list':
        prefetchTasks.push(import('./components/InternalUserModuleTabs'));
        break;
      case 'departments':
        prefetchTasks.push(import('./components/DepartmentList'));
        break;
      case 'user_dept_history':
        prefetchTasks.push(import('./components/UserDeptHistoryList'));
        break;
      case 'businesses':
        prefetchTasks.push(import('./components/BusinessList'));
        break;
      case 'vendors':
        prefetchTasks.push(import('./components/VendorList'));
        break;
      case 'products':
        prefetchTasks.push(import('./components/ProductList'));
        break;
      case 'clients':
        prefetchTasks.push(import('./components/CustomerList'));
        break;
      case 'cus_personnel':
        prefetchTasks.push(import('./components/CusPersonnelList'));
        break;
      case 'opportunities':
        prefetchTasks.push(import('./components/OpportunityList'));
        break;
      case 'projects':
        prefetchTasks.push(import('./components/ProjectList'));
        break;
      case 'contracts':
        prefetchTasks.push(import('./components/ContractList'));
        break;
      case 'documents':
        prefetchTasks.push(import('./components/DocumentList'));
        break;
      case 'reminders':
        prefetchTasks.push(import('./components/ReminderList'));
        break;
      case 'customer_request_management':
        prefetchTasks.push(import('./components/YeuCauManagementHub'));
        break;
      case 'support_master_management':
        prefetchTasks.push(import('./components/SupportMasterManagement'));
        break;
      case 'procedure_template_config':
        prefetchTasks.push(import('./components/ProcedureTemplateManagement'));
        break;
      case 'department_weekly_schedule_management':
        prefetchTasks.push(import('./components/DepartmentWeeklyScheduleManagement'));
        break;
      case 'audit_logs':
        prefetchTasks.push(import('./components/AuditLogList'));
        break;
      case 'user_feedback':
        prefetchTasks.push(import('./components/FeedbackList'));
        break;
      case 'integration_settings':
        prefetchTasks.push(import('./components/IntegrationSettingsPanel'));
        break;
      case 'access_control':
        prefetchTasks.push(import('./components/AccessControlList'));
        break;
      default:
        return;
    }

    prefetchedTabsRef.current.add(normalizedTab);
    void Promise.allSettled(prefetchTasks);
  }, []);

  const beginPageLoad = useCallback((key: string): number => {
    const nextVersion = (pageLoadVersionRef.current[key] || 0) + 1;
    pageLoadVersionRef.current[key] = nextVersion;
    return nextVersion;
  }, []);

  const isLatestPageLoad = useCallback((key: string, version: number): boolean =>
    pageLoadVersionRef.current[key] === version, []);

  const normalizeQuerySignature = useCallback((query: PaginatedQuery): string => {
    const normalizedFilters = Object.entries(query.filters || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, value ?? '']);

    return JSON.stringify({
      page: Number(query.page || 1),
      per_page: Number(query.per_page || 10),
      q: String(query.q || ''),
      sort_by: String(query.sort_by || ''),
      sort_dir: String(query.sort_dir || ''),
      filters: normalizedFilters,
    });
  }, []);

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
      addToast('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) {
        setEmployeesPageLoading(false);
      }
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
        delete pageQueryInFlightSignatureRef.current[requestKey];
      }
    }
  }, [addToast, beginPageLoad, isLatestPageLoad, normalizeQuerySignature]);

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
      addToast('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) {
        setCustomersPageLoading(false);
      }
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
        delete pageQueryInFlightSignatureRef.current[requestKey];
      }
    }
  }, [addToast, beginPageLoad, isLatestPageLoad, normalizeQuerySignature]);

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
      addToast('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) {
        setProjectsPageLoading(false);
      }
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
        delete pageQueryInFlightSignatureRef.current[requestKey];
      }
    }
  }, [addToast, beginPageLoad, isLatestPageLoad, normalizeQuerySignature]);

  const exportProjectsByCurrentQuery = async (): Promise<Project[]> => {
    if (!hasPermission(authUser, 'projects.read')) {
      throw new Error('Bạn không có quyền xuất dữ liệu dự án.');
    }

    const seedQuery = {
      ...(projectsPageQueryRef.current || {}),
      page: 1,
      per_page: 200,
    } as PaginatedQuery;

    const rows: Project[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const result = await fetchProjectsPage({
        ...seedQuery,
        page,
      });
      rows.push(...(result.data || []));
      totalPages = Math.max(1, result.meta?.total_pages || 1);
      page += 1;
    } while (page <= totalPages);

    const seen = new Set<string>();
    return rows.filter((item) => {
      const key = String(item.id ?? '');
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  };

  const exportProjectRaciByProjectIds = async (
    projectIds: Array<string | number>
  ): Promise<ProjectRaciRow[]> => {
    if (!hasPermission(authUser, 'projects.read')) {
      throw new Error('Bạn không có quyền xuất phân công RACI dự án.');
    }

    const normalizedProjectIds = (projectIds || [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (normalizedProjectIds.length === 0) {
      return [];
    }

    const chunkSize = 200;
    const chunks: number[][] = [];
    for (let index = 0; index < normalizedProjectIds.length; index += chunkSize) {
      chunks.push(normalizedProjectIds.slice(index, index + chunkSize));
    }

    const result: ProjectRaciRow[] = [];
    for (const chunk of chunks) {
      const rows = await fetchProjectRaciAssignments(chunk);
      result.push(...rows);
    }

    return result;
  };

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
      addToast('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) {
        setContractsPageLoading(false);
      }
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
        delete pageQueryInFlightSignatureRef.current[requestKey];
      }
    }
  }, [addToast, beginPageLoad, isLatestPageLoad, normalizeQuerySignature]);

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
      addToast('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) {
        setDocumentsPageLoading(false);
      }
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
        delete pageQueryInFlightSignatureRef.current[requestKey];
      }
    }
  }, [addToast, beginPageLoad, isLatestPageLoad, normalizeQuerySignature]);

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
      addToast('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) {
        setAuditLogsPageLoading(false);
      }
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
        delete pageQueryInFlightSignatureRef.current[requestKey];
      }
    }
  }, [addToast, beginPageLoad, isLatestPageLoad, normalizeQuerySignature]);

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
      addToast('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) {
        setFeedbacksPageLoading(false);
      }
      if (pageQueryInFlightSignatureRef.current[requestKey] === querySignature) {
        delete pageQueryInFlightSignatureRef.current[requestKey];
      }
    }
  }, [addToast, beginPageLoad, isLatestPageLoad, normalizeQuerySignature]);

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

  const availableTabs = useMemo(
    () => [
      'dashboard',
      'internal_user_dashboard',
      'internal_user_list',
      'departments',
      'user_dept_history',
      'businesses',
      'vendors',
      'products',
      'clients',
      'cus_personnel',
      'opportunities',
      'projects',
      'contracts',
      'documents',
      'reminders',
      'customer_request_management',
      'support_master_management',
      'procedure_template_config',
      'department_weekly_schedule_management',
      'audit_logs',
      'user_feedback',
      'integration_settings',
      'access_control',
    ],
    []
  );

  useEffect(() => {
    const syncTabFromUrl = () => {
      if (typeof window === 'undefined') {
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && availableTabs.includes(tab)) {
        setActiveTab(tab);
      }
    };

    syncTabFromUrl();
    window.addEventListener('popstate', syncTabFromUrl);
    return () => window.removeEventListener('popstate', syncTabFromUrl);
  }, [availableTabs]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    if (!activeTab || activeTab === 'dashboard') {
      url.searchParams.delete('tab');
    } else {
      url.searchParams.set('tab', activeTab);
    }

    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, [activeTab]);

  const visibleTabIds = useMemo(
    () =>
      new Set(
        availableTabs.filter((tabId) => canAccessTab(authUser, tabId))
      ),
    [authUser, availableTabs]
  );

  const handleLogin = async (payload: { username: string; password: string }) => {
    setIsLoginLoading(true);
    setLoginError('');
    setPasswordChangeError('');
    setLoginInfoMessage(''); // ★ Xóa banner khi user chủ động login lại
    try {
      const session = await login(payload);
      setAuthUser(session.user);
      setPasswordChangeRequired(Boolean(session.password_change_required || session.user.password_change_required));
      setPasswordChangeForm({
        current_password: '',
        new_password: '',
        new_password_confirmation: '',
      });
      const requestedTab = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('tab')
        : null;
      if (requestedTab && canAccessTab(session.user, requestedTab)) {
        setActiveTab(requestedTab);
      } else {
        setActiveTab(canAccessTab(session.user, 'dashboard') ? 'dashboard' : 'internal_user_dashboard');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Đăng nhập thất bại.';
      setLoginError(message);
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setAuthUser(null);
      setPasswordChangeRequired(false);
      setPasswordChangeError('');
      setPasswordChangeForm({
        current_password: '',
        new_password: '',
        new_password_confirmation: '',
      });
      setEmployeeProvisioning(null);
      setIsEmployeePasswordResetting(false);
      setActiveTab('dashboard');
      setInternalUserSubTab('dashboard');
      setModalType(null);
      setToasts([]);
      recentToastByKeyRef.current.clear();
      setLoginError('');
      resetModuleData();
    }
  };

  // ★ Khi tab bị evict — logout local + hiện banner thông báo
  const handleTabEvicted = useCallback(() => {
    setAuthUser(null);
    setPasswordChangeRequired(false);
    setModalType(null);
    setToasts([]);
    recentToastByKeyRef.current.clear();
    setLoginError('');
    resetModuleData();
    setLoginInfoMessage(
      'Tài khoản đã được đăng nhập trên một cửa sổ/tab khác. Vui lòng đăng nhập lại để tiếp tục.'
    );
  }, [resetModuleData]);

  // ★ Đăng ký interceptor eviction vào v5Api
  useEffect(() => {
    registerTabEvictedHandler(handleTabEvicted);
    return () => unregisterTabEvictedHandler();
  }, [handleTabEvicted]);

  // ★ Mount useTabSession
  useTabSession({
    isAuthenticated: authUser !== null,
    onEvicted: handleTabEvicted,
  });

  const handleChangePasswordRequired = async () => {
    if (isPasswordChanging) {
      return;
    }

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
      setPasswordChangeForm({
        current_password: '',
        new_password: '',
        new_password_confirmation: '',
      });
      addToast('success', 'Bảo mật tài khoản', 'Đổi mật khẩu thành công.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể đổi mật khẩu.';
      setPasswordChangeError(message);
    } finally {
      setIsPasswordChanging(false);
    }
  };

  useEffect(() => {
    if (!authUser) {
      return;
    }

    if (visibleTabIds.has(activeTab)) {
      return;
    }

    const fallbackTab = availableTabs.find((tabId) => visibleTabIds.has(tabId)) || 'dashboard';
    if (fallbackTab !== activeTab) {
      setActiveTab(fallbackTab);
    }
  }, [authUser, activeTab, availableTabs, visibleTabIds]);

  const normalizeImportToken = (value: unknown): string =>
    String(value ?? '')
      .trim()
      .replace(/[đĐ]/g, 'd')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');

  const normalizeProductUnit = (value: unknown): string => {
    const text = String(value ?? '').trim();
    if (!text || text === '--' || text === '---') {
      return 'Cái/Gói';
    }
    return text;
  };

  const normalizeProductRecord = (product: Product): Product => ({
    ...product,
    unit: normalizeProductUnit(product.unit),
    description: typeof product.description === 'string'
      ? product.description
      : (product.description ?? null),
    is_active: product.is_active !== false,
  });

  const buildHeaderIndex = (headers: string[]): Map<string, number> => {
    const indexMap = new Map<string, number>();
    (headers || []).forEach((header, index) => {
      const normalized = normalizeImportToken(header);
      if (normalized && !indexMap.has(normalized)) {
        indexMap.set(normalized, index);
      }
    });
    return indexMap;
  };

  const getImportCell = (
    row: string[],
    headerIndex: Map<string, number>,
    aliases: string[]
  ): string => {
    for (const alias of aliases) {
      const columnIndex = headerIndex.get(normalizeImportToken(alias));
      if (columnIndex !== undefined) {
        return String(row[columnIndex] ?? '').trim();
      }
    }
    return '';
  };

  const normalizeStatusActive = (value: string): boolean => {
    const token = normalizeImportToken(value);
    if (!token) return true;
    if (['active', 'hoatdong', '1', 'true', 'yes', 'co'].includes(token)) return true;
    if (['inactive', 'khonghoatdong', 'ngunghoatdong', '0', 'false', 'no', 'khong'].includes(token)) return false;
    return true;
  };

  const normalizeEmployeeStatusImport = (value: string): Employee['status'] => {
    const token = normalizeImportToken(value);
    if (['active', 'hoatdong'].includes(token)) return 'ACTIVE';
    if (['suspended', 'transferred', 'luanchuyen'].includes(token)) return 'SUSPENDED';
    if (['inactive', 'khonghoatdong', '0', 'khong'].includes(token)) return 'INACTIVE';
    return 'ACTIVE';
  };

  const normalizeGenderImport = (value: string): Employee['gender'] => {
    const token = normalizeImportToken(value);
    if (['male', 'nam', 'm'].includes(token)) return 'MALE';
    if (['female', 'nu', 'f'].includes(token)) return 'FEMALE';
    if (['other', 'khac', 'o'].includes(token)) return 'OTHER';
    return null;
  };

  const normalizeVpnImport = (value: string): Employee['vpn_status'] => {
    const token = normalizeImportToken(value);
    if (['yes', 'co', '1', 'true'].includes(token)) return 'YES';
    return 'NO';
  };

  const normalizeImportDate = (value: string): string | null => {
    const text = String(value || '').trim();
    if (!text) return null;

    const isoPrefixMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoPrefixMatch) {
      const year = Number(isoPrefixMatch[1]);
      const month = Number(isoPrefixMatch[2]);
      const day = Number(isoPrefixMatch[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() + 1 === month &&
        date.getUTCDate() === day
      ) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      const day = Number(isoMatch[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() + 1 === month &&
        date.getUTCDate() === day
      ) {
        return text;
      }
      return null;
    }

    const dmyMatch = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (dmyMatch) {
      const day = Number(dmyMatch[1]);
      const month = Number(dmyMatch[2]);
      const year = Number(dmyMatch[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() + 1 === month &&
        date.getUTCDate() === day
      ) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    const numeric = Number(text);
    if (Number.isFinite(numeric) && numeric > 0) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + numeric * 86400000);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1;
      const day = date.getUTCDate();
      if (year >= 1900 && year <= 9999) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    return null;
  };

  const ageRangeValidationMessage = buildAgeRangeValidationMessage();

  const validateImportedBirthDate = (isoDate: string | null): boolean => {
    if (!isoDate) {
      return true;
    }
    return isAgeInAllowedRange(isoDate);
  };

  const normalizeImportNumber = (value: string): number | null => {
    const text = String(value || '').trim();
    if (!text) {
      return null;
    }

    const compact = text
      .replace(/\s+/g, '')
      .replace(/[₫đĐ]/g, '')
      .replace(/vnđ/gi, '')
      .replace(/vnd/gi, '');
    if (!compact) {
      return null;
    }

    const normalizeMantissa = (input: string): string | null => {
      let token = String(input || '').replace(/[^0-9.,+-]/g, '');
      if (!token) {
        return null;
      }

      const sign = token.startsWith('-') ? '-' : token.startsWith('+') ? '+' : '';
      token = token.replace(/[+-]/g, '');
      if (!token) {
        return null;
      }

      const dotCount = (token.match(/\./g) || []).length;
      const commaCount = (token.match(/,/g) || []).length;

      if (dotCount > 0 && commaCount > 0) {
        const lastDot = token.lastIndexOf('.');
        const lastComma = token.lastIndexOf(',');
        const decimalSeparator = lastDot > lastComma ? '.' : ',';
        const thousandSeparator = decimalSeparator === '.' ? ',' : '.';
        token = token.replace(new RegExp(`\\${thousandSeparator}`, 'g'), '');
        if (decimalSeparator === ',') {
          token = token.replace(/,/g, '.');
        }
      } else if (dotCount > 1) {
        token = token.replace(/\./g, '');
      } else if (commaCount > 1) {
        token = token.replace(/,/g, '');
      } else if (dotCount === 1) {
        const [integerPart = '', fractionPart = ''] = token.split('.');
        if (fractionPart.length === 3 && integerPart.length > 0) {
          token = `${integerPart}${fractionPart}`;
        }
      } else if (commaCount === 1) {
        const [integerPart = '', fractionPart = ''] = token.split(',');
        if (fractionPart.length === 3 && integerPart.length > 0) {
          token = `${integerPart}${fractionPart}`;
        } else {
          token = `${integerPart}.${fractionPart}`;
        }
      }

      if (!/^\d+(\.\d+)?$/.test(token)) {
        return null;
      }

      return `${sign}${token}`;
    };

    const scientificMatch = compact.match(/^([+-]?[0-9.,]+)([eE][+-]?\d+)$/);
    if (scientificMatch) {
      const mantissa = normalizeMantissa(scientificMatch[1]);
      if (!mantissa) {
        return null;
      }
      const parsed = Number(`${mantissa}${scientificMatch[2]}`);
      return Number.isFinite(parsed) ? parsed : null;
    }

    const normalizedValue = normalizeMantissa(compact);
    if (!normalizedValue) {
      return null;
    }

    const parsed = Number(normalizedValue);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const isImportInfrastructureError = (error: unknown, message: string): boolean => {
    const token = normalizeImportToken(message);

    if (
      token.includes('khongtheketnoimaychu') ||
      token.includes('failedtofetch') ||
      token.includes('networkerror') ||
      token.includes('loadfailed') ||
      token.includes('timeout') ||
      token.includes('hethongdangban') ||
      token.includes('econnrefused')
    ) {
      return true;
    }

    return error instanceof TypeError;
  };

  const summarizeImportResult = (
    moduleLabel: string,
    successCount: number,
    failures: string[]
  ) => {
    if (successCount > 0) {
      addToast('success', 'Nhập dữ liệu', `${moduleLabel}: đã lưu ${successCount} dòng.`);
    }

    if (failures.length > 0) {
      const preview = failures.slice(0, 2).join(' | ');
      const suffix = failures.length > 2 ? ` (+${failures.length - 2} lỗi khác)` : '';
      addToast('error', 'Nhập dữ liệu', `${moduleLabel}: ${preview}${suffix}`);
    }
  };

  interface ImportFailureRow {
    rowNumber: number;
    row: string[];
    reasons: string[];
  }

  const buildImportFailureRows = (rows: string[][], failures: string[]): ImportFailureRow[] => {
    const map = new Map<number, ImportFailureRow>();

    failures.forEach((failure) => {
      const matched = failure.match(/Dòng\s+(\d+)\s*:\s*(.+)$/i);
      if (!matched) {
        return;
      }

      const rowNumber = Number(matched[1]);
      const reason = String(matched[2] || '').trim();
      const rowIndex = rowNumber - 2;
      if (!Number.isFinite(rowNumber) || rowIndex < 0 || rowIndex >= rows.length) {
        return;
      }

      const existing = map.get(rowNumber);
      if (existing) {
        if (reason && !existing.reasons.includes(reason)) {
          existing.reasons.push(reason);
        }
        return;
      }

      map.set(rowNumber, {
        rowNumber,
        row: rows[rowIndex] || [],
        reasons: reason ? [reason] : ['Lỗi dữ liệu'],
      });
    });

    return Array.from(map.values()).sort((left, right) => left.rowNumber - right.rowNumber);
  };

  const exportImportFailureFile = (
    payload: ImportPayload,
    moduleLabel: string,
    failures: string[]
  ): void => {
    const failureRows = buildImportFailureRows(payload.rows || [], failures);
    if (failureRows.length === 0) {
      return;
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+/, '')
      .replace('T', '_');
    const baseName = String(payload.fileName || 'import')
      .replace(/\.[^.]+$/, '')
      .trim() || 'import';

    downloadExcelWorkbook(`${baseName}_error_${timestamp}`, [
      {
        name: 'ImportErrors',
        headers: ['Dòng', ...(payload.headers || []), 'Lý do lỗi'],
        rows: failureRows.map((item) => [
          item.rowNumber,
          ...(payload.headers || []).map((_, index) => item.row[index] || ''),
          item.reasons.join(' | '),
        ]),
      },
    ]);

    addToast(
      'error',
      'Nhập dữ liệu',
      `${moduleLabel}: đã xuất file lỗi (${failureRows.length} dòng thất bại).`
    );
  };

  const rollbackImportedRows = async <T extends { id: string | number }>(
    moduleLabel: string,
    items: T[],
    removeFn: (id: string | number) => Promise<unknown>
  ): Promise<void> => {
    if (!items.length) {
      return;
    }

    let rollbackSuccess = 0;
    for (let index = items.length - 1; index >= 0; index -= 1) {
      try {
        await removeFn(items[index].id);
        rollbackSuccess += 1;
      } catch {
        // Keep going to rollback as much as possible.
      }
    }

    if (rollbackSuccess === items.length) {
      addToast(
        'error',
        'Nhập dữ liệu',
        `${moduleLabel}: đã rollback ${rollbackSuccess}/${items.length} dòng do lỗi kết nối máy chủ.`
      );
      return;
    }

    addToast(
      'error',
      'Nhập dữ liệu',
      `${moduleLabel}: rollback được ${rollbackSuccess}/${items.length} dòng. Vui lòng tải lại trang để đồng bộ dữ liệu.`
    );
  };

  const handleImportData = async (payload: ImportPayload) => {
    if (importInFlightRef.current || isSaving) {
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      addToast('error', 'Nhập dữ liệu', 'Mất kết nối mạng. Vui lòng kiểm tra kết nối và thử lại.');
      return;
    }

    importInFlightRef.current = true;
    setIsSaving(true);
    setImportLoadingText('Đang chuẩn bị import...');
    try {
      const moduleToken = normalizeImportToken(payload.moduleKey);
      const headerIndex = buildHeaderIndex(payload.headers || []);
      const rows = payload.rows || [];

      if (rows.length === 0) {
        addToast('error', 'Nhập dữ liệu', 'File không có dòng dữ liệu hợp lệ để lưu.');
        return;
      }

      const setImportProgress = (label: string, current: number, total: number): void => {
        if (total <= 0) {
          setImportLoadingText(`Đang nhập ${label}...`);
          return;
        }

        setImportLoadingText(`Đang nhập ${label}: ${Math.min(current, total)}/${total}`);
      };

      const chunkArray = <T,>(items: T[], size: number): T[][] => {
        if (size <= 0 || items.length === 0) {
          return [items];
        }

        const chunks: T[][] = [];
        for (let start = 0; start < items.length; start += size) {
          chunks.push(items.slice(start, start + size));
        }
        return chunks;
      };
      const importBatchSize = 100;

      if (moduleToken === 'departments') {
        const deptByCode = new Map<string, Department>();
        (departments || []).forEach((department) => {
          const codeToken = normalizeImportToken(department.dept_code);
          if (codeToken) {
            deptByCode.set(codeToken, department);
          }
        });

        const entries: Array<{
          rowNumber: number;
          deptCode: string;
          deptCodeToken: string;
          deptName: string;
          parentCodeToken: string;
          parentCodeRaw: string;
          isActive: boolean;
        }> = [];
        const failures: string[] = [];

        rows.forEach((row, rowIndex) => {
          const rowNumber = rowIndex + 2;
          const deptCode = getImportCell(row, headerIndex, ['maphongban', 'mapb', 'deptcode', 'departmentcode', 'code']);
          const deptName = getImportCell(row, headerIndex, ['tenphongban', 'departmentname', 'deptname', 'name']);
          const parentCodeRaw = getImportCell(row, headerIndex, ['maphongbancha', 'mapbcha', 'parentcode', 'parentdeptcode', 'parent']);
          const statusRaw = getImportCell(row, headerIndex, ['trangthai', 'status', 'isactive']);

          if (!(deptCode || deptName || parentCodeRaw || statusRaw)) {
            return;
          }

          if (!deptCode || !deptName) {
            failures.push(`Dòng ${rowNumber}: thiếu Mã phòng ban hoặc Tên phòng ban.`);
            return;
          }

          entries.push({
            rowNumber,
            deptCode,
            deptCodeToken: normalizeImportToken(deptCode),
            deptName,
            parentCodeToken: normalizeImportToken(parentCodeRaw),
            parentCodeRaw,
            isActive: normalizeStatusActive(statusRaw),
          });
        });

        const createdItems: Department[] = [];
        const pending = [...entries];
        let guard = pending.length + 5;
        let abortedByInfraIssue = false;

        while (pending.length > 0 && guard > 0 && !abortedByInfraIssue) {
          let hasProgress = false;

          for (let i = 0; i < pending.length; i += 1) {
            const entry = pending[i];

            if (!entry.deptCodeToken) {
              failures.push(`Dòng ${entry.rowNumber}: Mã phòng ban không hợp lệ.`);
              pending.splice(i, 1);
              i -= 1;
              hasProgress = true;
              continue;
            }

            if (deptByCode.has(entry.deptCodeToken)) {
              failures.push(`Dòng ${entry.rowNumber}: Mã phòng ban "${entry.deptCode}" đã tồn tại.`);
              pending.splice(i, 1);
              i -= 1;
              hasProgress = true;
              continue;
            }

            const parentDept = entry.parentCodeToken ? deptByCode.get(entry.parentCodeToken) : null;
            if (entry.parentCodeToken && !parentDept) {
              continue;
            }

            try {
              const created = await createDepartment({
                dept_code: entry.deptCode,
                dept_name: entry.deptName,
                parent_id: parentDept ? parentDept.id : null,
                is_active: entry.isActive,
              });
              createdItems.push(created);
              deptByCode.set(entry.deptCodeToken, created);
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Lỗi không xác định';
              if (isImportInfrastructureError(error, message)) {
                failures.push(`Dòng ${entry.rowNumber}: ${message}`);
                failures.push('Đã dừng import do lỗi kết nối mạng hoặc máy chủ. Vui lòng thử lại sau khi hệ thống ổn định.');
                abortedByInfraIssue = true;
                break;
              }
              failures.push(`Dòng ${entry.rowNumber}: ${message}`);
            }

            if (abortedByInfraIssue) {
              break;
            }

            pending.splice(i, 1);
            i -= 1;
            hasProgress = true;
          }

          if (!hasProgress) {
            pending.forEach((entry) => {
              failures.push(`Dòng ${entry.rowNumber}: không tìm thấy phòng ban cha "${entry.parentCodeRaw}".`);
            });
            break;
          }

          guard -= 1;
        }

        if (abortedByInfraIssue) {
          await rollbackImportedRows('Phòng ban', createdItems, deleteDepartment);
        } else if (createdItems.length > 0) {
          setDepartments((prev) => [...createdItems, ...(prev || [])]);
        }

        const importedDepartmentCount = abortedByInfraIssue ? 0 : createdItems.length;
        summarizeImportResult('Phòng ban', importedDepartmentCount, failures);
        exportImportFailureFile(payload, 'Phòng ban', failures);
        if (importedDepartmentCount > 0 && failures.length === 0 && !abortedByInfraIssue) {
          handleCloseModal();
          return;
        }
      } else if (moduleToken === 'employees' || moduleToken === 'internaluserlist') {
        const deptByCode = new Map<string, Department>();
        (departments || []).forEach((department) => {
          const codeToken = normalizeImportToken(department.dept_code);
          if (codeToken) {
            deptByCode.set(codeToken, department);
          }
        });

        const importEntries: Array<{ rowNumber: number; payload: Partial<Employee> }> = [];
        const createdItems: Employee[] = [];
        const failures: string[] = [];
        let abortedByInfraIssue = false;

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          const row = rows[rowIndex];
          const rowNumber = rowIndex + 2;

          const employeeCode = getImportCell(row, headerIndex, ['manv', 'manhanvien', 'usercode', 'employeecode', 'code']);
          const username = getImportCell(row, headerIndex, ['tendangnhap', 'username', 'login']);
          const fullName = getImportCell(row, headerIndex, ['hovaten', 'hoten', 'fullname', 'name']);
          const phoneRaw = getImportCell(row, headerIndex, [
            'sodienthoai',
            'sdt',
            'sodt',
            'dienthoai',
            'phone',
            'phonenumber',
            'phone_number',
            'mobile',
            'tel',
          ]);
          const email = getImportCell(row, headerIndex, ['email']);
          const departmentCodeRaw = getImportCell(row, headerIndex, ['maphongban', 'mapb', 'departmentcode', 'deptcode']);
          const positionCode = getImportCell(row, headerIndex, ['machucvu', 'positioncode', 'positionid', 'chucvu']);
          const jobTitle = getImportCell(row, headerIndex, ['chucdanhtv', 'chucdanh', 'jobtitle', 'jobtitletv']);
          const dateOfBirthRaw = getImportCell(row, headerIndex, ['ngaysinh', 'dateofbirth', 'dob']);
          const genderRaw = getImportCell(row, headerIndex, ['gioitinh', 'gender']);
          const vpnRaw = getImportCell(row, headerIndex, ['vpn', 'vpnstatus']);
          const ipAddress = getImportCell(row, headerIndex, ['diachiip', 'ipaddress', 'ip']);
          const statusRaw = getImportCell(row, headerIndex, ['trangthai', 'status']);

          if (
            !employeeCode &&
            !username &&
            !fullName &&
            !phoneRaw &&
            !email &&
            !departmentCodeRaw &&
            !positionCode &&
            !jobTitle &&
            !dateOfBirthRaw &&
            !genderRaw &&
            !vpnRaw &&
            !ipAddress &&
            !statusRaw
          ) {
            continue;
          }

          if (!employeeCode || !fullName || !email) {
            failures.push(`Dòng ${rowNumber}: thiếu Mã NV, Họ và tên hoặc Email.`);
            continue;
          }

          const departmentCode = normalizeImportToken(departmentCodeRaw);
          const department = departmentCode ? deptByCode.get(departmentCode) : null;
          if (!department) {
            failures.push(`Dòng ${rowNumber}: không tìm thấy phòng ban "${departmentCodeRaw}".`);
            continue;
          }

          const normalizedDate = normalizeImportDate(dateOfBirthRaw);
          if (dateOfBirthRaw && !normalizedDate) {
            failures.push(`Dòng ${rowNumber}: ngày sinh "${dateOfBirthRaw}" không đúng định dạng.`);
            continue;
          }
          if (dateOfBirthRaw && !validateImportedBirthDate(normalizedDate)) {
            failures.push(`Dòng ${rowNumber}: ${ageRangeValidationMessage}`);
            continue;
          }

          importEntries.push({
            rowNumber,
            payload: {
              user_code: employeeCode,
              username: username || employeeCode.toLowerCase(),
              full_name: fullName,
              phone_number: phoneRaw || null,
              phone: phoneRaw || null,
              email,
              department_id: department.id,
              position_id: positionCode || null,
              job_title_raw: jobTitle || null,
              date_of_birth: normalizedDate,
              gender: normalizeGenderImport(genderRaw),
              vpn_status: normalizeVpnImport(vpnRaw),
              ip_address: ipAddress || null,
              status: normalizeEmployeeStatusImport(statusRaw),
            },
          });
        }

        const totalImportEntries = importEntries.length;
        if (totalImportEntries > 0) {
          const chunks = chunkArray(importEntries, importBatchSize);
          let processed = 0;

          for (const chunk of chunks) {
            if (abortedByInfraIssue) {
              break;
            }

            try {
              const bulkResult = await createEmployeesBulk(chunk.map((entry) => entry.payload));
              const rowResults = bulkResult.results || [];

              if (rowResults.length === 0) {
                chunk.forEach((entry) => {
                  failures.push(`Dòng ${entry.rowNumber}: backend không trả kết quả chi tiết.`);
                });
                processed += chunk.length;
                setImportProgress('Nhân sự', processed, totalImportEntries);
                continue;
              }

              const handledIndices = new Set<number>();
              rowResults.forEach((result) => {
                const itemIndex = Number(result.index);
                if (!Number.isFinite(itemIndex) || itemIndex < 0 || itemIndex >= chunk.length) {
                  return;
                }

                handledIndices.add(itemIndex);
                const entry = chunk[itemIndex];
                if (result.success && result.data) {
                  createdItems.push(result.data);
                  return;
                }

                failures.push(`Dòng ${entry.rowNumber}: ${result.message || 'Dữ liệu không hợp lệ.'}`);
              });

              for (let itemIndex = 0; itemIndex < chunk.length; itemIndex += 1) {
                if (!handledIndices.has(itemIndex)) {
                  failures.push(`Dòng ${chunk[itemIndex].rowNumber}: backend không phản hồi trạng thái.`);
                }
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Lỗi không xác định';
              if (isImportInfrastructureError(error, message)) {
                failures.push(`Batch nhân sự: ${message}`);
                failures.push('Đã dừng import do lỗi kết nối mạng hoặc máy chủ. Vui lòng thử lại sau khi hệ thống ổn định.');
                abortedByInfraIssue = true;
                break;
              }

              chunk.forEach((entry) => {
                failures.push(`Dòng ${entry.rowNumber}: ${message}`);
              });
            }

            processed += chunk.length;
            setImportProgress('Nhân sự', processed, totalImportEntries);
          }
        }

        if (abortedByInfraIssue) {
          await rollbackImportedRows('Nhân sự', createdItems, deleteEmployee);
        } else if (createdItems.length > 0) {
          setEmployees((prev) => [...createdItems, ...(prev || [])]);
          void loadEmployeesPage();
        }

        const importedEmployeeCount = abortedByInfraIssue ? 0 : createdItems.length;
        summarizeImportResult('Nhân sự', importedEmployeeCount, failures);
        exportImportFailureFile(payload, 'Nhân sự', failures);
        if (importedEmployeeCount > 0 && failures.length === 0 && !abortedByInfraIssue) {
          handleCloseModal();
          return;
        }
      } else if (moduleToken === 'businesses') {
        const failures: string[] = [];
        const createdItems: Business[] = [];
        let abortedByInfraIssue = false;
        const existingCodes = new Set((businesses || []).map((item) => normalizeImportToken(item.domain_code)));

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          if (abortedByInfraIssue) {
            break;
          }

          const row = rows[rowIndex];
          const rowNumber = rowIndex + 2;
          const domainCode = getImportCell(row, headerIndex, ['malinhvuc', 'domaincode', 'businesscode', 'code']);
          const domainName = getImportCell(row, headerIndex, ['tenlinhvuc', 'domainname', 'businessname', 'name']);

          if (!domainCode && !domainName) {
            continue;
          }

          if (!domainCode || !domainName) {
            failures.push(`Dòng ${rowNumber}: thiếu Mã lĩnh vực hoặc Tên lĩnh vực.`);
            continue;
          }

          const codeToken = normalizeImportToken(domainCode);
          if (!codeToken || existingCodes.has(codeToken)) {
            failures.push(`Dòng ${rowNumber}: Mã lĩnh vực "${domainCode}" đã tồn tại.`);
            continue;
          }

          try {
            const created = await createBusiness({
              domain_code: domainCode,
              domain_name: domainName,
            });
            existingCodes.add(codeToken);
            createdItems.push(created);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi không xác định';
            if (isImportInfrastructureError(error, message)) {
              failures.push(`Dòng ${rowNumber}: ${message}`);
              failures.push('Đã dừng import do lỗi kết nối mạng hoặc máy chủ. Vui lòng thử lại sau khi hệ thống ổn định.');
              abortedByInfraIssue = true;
              break;
            }
            failures.push(`Dòng ${rowNumber}: ${message}`);
          }
        }

        if (abortedByInfraIssue) {
          await rollbackImportedRows('Lĩnh vực', createdItems, deleteBusiness);
        } else if (createdItems.length > 0) {
          setBusinesses((prev) => [...createdItems, ...(prev || [])]);
        }

        const importedBusinessCount = abortedByInfraIssue ? 0 : createdItems.length;
        summarizeImportResult('Lĩnh vực', importedBusinessCount, failures);
        exportImportFailureFile(payload, 'Lĩnh vực', failures);
        if (importedBusinessCount > 0 && failures.length === 0 && !abortedByInfraIssue) {
          handleCloseModal();
          return;
        }
      } else if (moduleToken === 'vendors') {
        const failures: string[] = [];
        const createdItems: Vendor[] = [];
        let abortedByInfraIssue = false;

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          const row = rows[rowIndex];
          const rowNumber = rowIndex + 2;
          const vendorCode = getImportCell(row, headerIndex, ['madoitac', 'vendorcode', 'code']);
          const vendorName = getImportCell(row, headerIndex, ['tendoitac', 'vendorname', 'name']);

          if (!vendorCode && !vendorName) {
            continue;
          }
          if (!vendorCode || !vendorName) {
            failures.push(`Dòng ${rowNumber}: thiếu Mã đối tác hoặc Tên đối tác.`);
            continue;
          }

          try {
            const created = await createVendor({
              vendor_code: vendorCode,
              vendor_name: vendorName,
            });
            createdItems.push(created);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi không xác định';
            if (isImportInfrastructureError(error, message)) {
              failures.push(`Dòng ${rowNumber}: ${message}`);
              failures.push('Đã dừng import do lỗi kết nối mạng hoặc máy chủ. Vui lòng thử lại sau khi hệ thống ổn định.');
              abortedByInfraIssue = true;
              break;
            }
            failures.push(`Dòng ${rowNumber}: ${message}`);
          }
        }

        if (abortedByInfraIssue) {
          await rollbackImportedRows('Đối tác', createdItems, deleteVendor);
        } else if (createdItems.length > 0) {
          setVendors((prev) => [...createdItems, ...(prev || [])]);
        }

        const importedVendorCount = abortedByInfraIssue ? 0 : createdItems.length;
        summarizeImportResult('Đối tác', importedVendorCount, failures);
        exportImportFailureFile(payload, 'Đối tác', failures);
        if (importedVendorCount > 0 && failures.length === 0 && !abortedByInfraIssue) {
          handleCloseModal();
          return;
        }
      } else if (moduleToken === 'products') {
        const failures: string[] = [];
        const createdItems: Product[] = [];
        const existingCodes = new Set((products || []).map((item) => normalizeImportToken(item.product_code)));
        const businessByCode = new Map<string, Business>();
        const vendorByCode = new Map<string, Vendor>();
        const importEntries: Array<{ rowNumber: number; payload: Partial<Product>; productCodeToken: string }> = [];
        let abortedByInfraIssue = false;

        (businesses || []).forEach((business) => {
          const key = normalizeImportToken(business.domain_code);
          if (key) businessByCode.set(key, business);
        });

        (vendors || []).forEach((vendor) => {
          const key = normalizeImportToken(vendor.vendor_code);
          if (key) vendorByCode.set(key, vendor);
        });

        rows.forEach((row, rowIndex) => {
          const rowNumber = rowIndex + 2;
          const productCode = getImportCell(row, headerIndex, ['masanpham', 'productcode', 'code']);
          const productName = getImportCell(row, headerIndex, ['tensanpham', 'productname', 'name']);
          const domainCodeRaw = getImportCell(row, headerIndex, ['malinhvuc', 'madomain', 'domaincode']);
          const vendorCodeRaw = getImportCell(row, headerIndex, ['manhacungcap', 'madoitac', 'vendorcode']);
          const standardPriceRaw = getImportCell(row, headerIndex, [
            'dongiachuan',
            'dongiachuanvnd',
            'giatieuchuan',
            'standardprice',
            'price',
          ]);
          const unitRaw = getImportCell(row, headerIndex, ['donvitinh', 'donvi', 'unit']);

          if (!productCode && !productName && !domainCodeRaw && !vendorCodeRaw) {
            return;
          }

          if (!productCode || !productName || !domainCodeRaw || !vendorCodeRaw) {
            failures.push(`Dòng ${rowNumber}: thiếu thông tin bắt buộc (Mã/Tên sản phẩm, Mã lĩnh vực, Mã nhà cung cấp).`);
            return;
          }

          const productCodeToken = normalizeImportToken(productCode);
          if (!productCodeToken || existingCodes.has(productCodeToken)) {
            failures.push(`Dòng ${rowNumber}: Mã sản phẩm "${productCode}" đã tồn tại.`);
            return;
          }

          const business = businessByCode.get(normalizeImportToken(domainCodeRaw));
          if (!business) {
            failures.push(`Dòng ${rowNumber}: không tìm thấy lĩnh vực "${domainCodeRaw}".`);
            return;
          }

          const vendor = vendorByCode.get(normalizeImportToken(vendorCodeRaw));
          if (!vendor) {
            failures.push(`Dòng ${rowNumber}: không tìm thấy nhà cung cấp "${vendorCodeRaw}".`);
            return;
          }

          const parsedStandardPrice = normalizeImportNumber(standardPriceRaw);
          if (standardPriceRaw && parsedStandardPrice === null) {
            failures.push(`Dòng ${rowNumber}: đơn giá chuẩn "${standardPriceRaw}" không hợp lệ.`);
            return;
          }

          importEntries.push({
            rowNumber,
            productCodeToken,
            payload: {
              product_code: productCode,
              product_name: productName,
              domain_id: business.id,
              vendor_id: vendor.id,
              standard_price: parsedStandardPrice ?? 0,
              unit: normalizeProductUnit(unitRaw),
            },
          });
        });

        const totalImportEntries = importEntries.length;
        for (let index = 0; index < importEntries.length; index += 1) {
          if (abortedByInfraIssue) {
            break;
          }

          const entry = importEntries[index];
          try {
            const created = await createProduct(entry.payload);
            createdItems.push(created);
            existingCodes.add(entry.productCodeToken);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi không xác định';
            if (isImportInfrastructureError(error, message)) {
              failures.push(`Dòng ${entry.rowNumber}: ${message}`);
              failures.push('Đã dừng import do lỗi kết nối mạng hoặc máy chủ. Vui lòng thử lại sau khi hệ thống ổn định.');
              abortedByInfraIssue = true;
              break;
            }
            failures.push(`Dòng ${entry.rowNumber}: ${message}`);
          }

          setImportProgress('Sản phẩm', index + 1, totalImportEntries);
        }

        if (abortedByInfraIssue) {
          await rollbackImportedRows('Sản phẩm', createdItems, deleteProduct);
        } else if (createdItems.length > 0) {
          setProducts((prev) => [...createdItems, ...(prev || [])]);
        }

        const importedProductCount = abortedByInfraIssue ? 0 : createdItems.length;
        summarizeImportResult('Sản phẩm', importedProductCount, failures);
        exportImportFailureFile(payload, 'Sản phẩm', failures);
        if (importedProductCount > 0 && failures.length === 0 && !abortedByInfraIssue) {
          handleCloseModal();
          return;
        }
      } else if (moduleToken === 'clients') {
        const failures: string[] = [];
        const createdItems: Customer[] = [];
        let abortedByInfraIssue = false;

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          const row = rows[rowIndex];
          const rowNumber = rowIndex + 2;
          const customerCode = getImportCell(row, headerIndex, ['makhachhang', 'customercode', 'code']);
          const customerName = getImportCell(row, headerIndex, ['tenkhachhang', 'customername', 'name']);
          const taxCode = getImportCell(row, headerIndex, ['masothue', 'taxcode']);
          const address = getImportCell(row, headerIndex, ['diachi', 'address']);

          if (!customerCode && !customerName && !taxCode && !address) {
            continue;
          }
          if (!customerCode || !customerName) {
            failures.push(`Dòng ${rowNumber}: thiếu Mã khách hàng hoặc Tên khách hàng.`);
            continue;
          }

          try {
            const created = await createCustomer({
              customer_code: customerCode,
              customer_name: customerName,
              tax_code: taxCode,
              address,
            });
            createdItems.push(created);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi không xác định';
            if (isImportInfrastructureError(error, message)) {
              failures.push(`Dòng ${rowNumber}: ${message}`);
              failures.push('Đã dừng import do lỗi kết nối mạng hoặc máy chủ. Vui lòng thử lại sau khi hệ thống ổn định.');
              abortedByInfraIssue = true;
              break;
            }
            failures.push(`Dòng ${rowNumber}: ${message}`);
          }
        }

        if (abortedByInfraIssue) {
          await rollbackImportedRows('Khách hàng', createdItems, deleteCustomer);
        } else if (createdItems.length > 0) {
          setCustomers((prev) => [...createdItems, ...(prev || [])]);
        }

        const importedCustomerCount = abortedByInfraIssue ? 0 : createdItems.length;
        summarizeImportResult('Khách hàng', importedCustomerCount, failures);
        exportImportFailureFile(payload, 'Khách hàng', failures);
        if (importedCustomerCount > 0 && failures.length === 0 && !abortedByInfraIssue) {
          handleCloseModal();
          return;
        }
      } else if (moduleToken === 'cuspersonnel' || moduleToken === 'customerpersonnel') {
        const failures: string[] = [];
        const createdItems: CustomerPersonnel[] = [];
        let abortedByInfraIssue = false;
        const customerByToken = new Map<string, Customer>();
        const positionByCodeToken = new Map<string, SupportContactPosition>();
        const positionByNameToken = new Map<string, SupportContactPosition>();
        const existingKeys = new Set(
          (cusPersonnel || []).map((item) =>
            normalizeImportToken(`${String(item.customerId)}|${item.fullName}|${item.email || ''}`)
          )
        );

        (customers || []).forEach((customer) => {
          customerByToken.set(normalizeImportToken(customer.id), customer);
          customerByToken.set(normalizeImportToken(customer.customer_code), customer);
          customerByToken.set(normalizeImportToken(customer.customer_name), customer);
        });

        (supportContactPositions || []).forEach((position) => {
          const codeToken = normalizeImportToken(String(position.position_code || ''));
          if (codeToken) {
            positionByCodeToken.set(codeToken, position);
          }
          const idToken = normalizeImportToken(String(position.id || ''));
          if (idToken) {
            positionByCodeToken.set(idToken, position);
          }
          const nameToken = normalizeImportToken(String(position.position_name || ''));
          if (nameToken) {
            positionByNameToken.set(nameToken, position);
          }
        });

        if (positionByCodeToken.size === 0 && positionByNameToken.size === 0) {
          failures.push('Danh mục Chức vụ liên hệ đang trống, không thể nhập Nhân sự liên hệ.');
          summarizeImportResult('Nhân sự liên hệ', 0, failures);
          exportImportFailureFile(payload, 'Nhân sự liên hệ', failures);
          return;
        }

        const normalizeCusPersonnelStatusImport = (value: string): CustomerPersonnel['status'] => {
          const token = normalizeImportToken(value);
          if (token === 'inactive' || token === 'khonghoatdong' || token === '0') {
            return 'Inactive';
          }
          return 'Active';
        };

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          const row = rows[rowIndex];
          const rowNumber = rowIndex + 2;

          const customerRaw = getImportCell(row, headerIndex, [
            'makhachhang',
            'customercode',
            'customerid',
            'customer',
            'khachhang',
            'donvi',
          ]);
          const fullName = getImportCell(row, headerIndex, ['hovaten', 'hoten', 'fullname', 'name']);
          const birthdayRaw = getImportCell(row, headerIndex, ['ngaysinh', 'birthday', 'dateofbirth', 'dob']);
          const positionRaw = getImportCell(row, headerIndex, [
            'machucvu',
            'positioncode',
            'positionid',
            'chucvu',
            'positiontype',
            'position',
          ]);
          const phoneNumber = getImportCell(row, headerIndex, ['sodienthoai', 'phone', 'phonenumber', 'mobile']);
          const email = getImportCell(row, headerIndex, ['email']);
          const statusRaw = getImportCell(row, headerIndex, ['trangthai', 'status']);

          if (!customerRaw && !fullName && !birthdayRaw && !positionRaw && !phoneNumber && !email && !statusRaw) {
            continue;
          }

          if (!fullName) {
            failures.push(`Dòng ${rowNumber}: thiếu Họ và tên.`);
            continue;
          }
          if (!customerRaw) {
            failures.push(`Dòng ${rowNumber}: thiếu Khách hàng (Mã KH/ID KH).`);
            continue;
          }
          if (!positionRaw) {
            failures.push(`Dòng ${rowNumber}: thiếu Mã chức vụ.`);
            continue;
          }

          const customer = customerByToken.get(normalizeImportToken(customerRaw));
          if (!customer) {
            failures.push(`Dòng ${rowNumber}: không tìm thấy khách hàng "${customerRaw}".`);
            continue;
          }

          const positionToken = normalizeImportToken(positionRaw);
          const resolvedPosition =
            positionByCodeToken.get(positionToken) ||
            positionByNameToken.get(positionToken) ||
            null;
          if (!resolvedPosition) {
            failures.push(`Dòng ${rowNumber}: mã chức vụ "${positionRaw}" không tồn tại trong danh mục Chức vụ.`);
            continue;
          }

          const normalizedBirthday = normalizeImportDate(birthdayRaw);
          if (birthdayRaw && !normalizedBirthday) {
            failures.push(`Dòng ${rowNumber}: ngày sinh "${birthdayRaw}" không đúng định dạng.`);
            continue;
          }
          if (birthdayRaw && !validateImportedBirthDate(normalizedBirthday)) {
            failures.push(`Dòng ${rowNumber}: ${ageRangeValidationMessage}`);
            continue;
          }

          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            failures.push(`Dòng ${rowNumber}: email "${email}" không hợp lệ.`);
            continue;
          }

          const uniqueKey = normalizeImportToken(`${String(customer.id)}|${fullName}|${email || ''}`);
          if (existingKeys.has(uniqueKey)) {
            failures.push(`Dòng ${rowNumber}: nhân sự "${fullName}" đã tồn tại cho khách hàng "${customer.customer_code}".`);
            continue;
          }

          try {
            const created = await createCustomerPersonnel({
              fullName,
              birthday: normalizedBirthday || '',
              positionType: String(resolvedPosition.position_code || ''),
              positionId: String(resolvedPosition.id),
              positionLabel: String(resolvedPosition.position_name || ''),
              phoneNumber,
              email,
              customerId: String(customer.id),
              status: normalizeCusPersonnelStatusImport(statusRaw),
            });

            createdItems.push({
              ...created,
              birthday: normalizeImportDate(String(created?.birthday || '')) || String(created?.birthday || '').trim(),
            });
            existingKeys.add(uniqueKey);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi không xác định';
            if (isImportInfrastructureError(error, message)) {
              failures.push(`Dòng ${rowNumber}: ${message}`);
              failures.push('Đã dừng import do lỗi kết nối mạng hoặc máy chủ. Vui lòng thử lại sau khi hệ thống ổn định.');
              abortedByInfraIssue = true;
              break;
            }
            failures.push(`Dòng ${rowNumber}: ${message}`);
          }
        }

        if (abortedByInfraIssue) {
          await rollbackImportedRows('Nhân sự liên hệ', createdItems, deleteCustomerPersonnel);
        } else if (createdItems.length > 0) {
          setCusPersonnel((prev) => [...createdItems, ...(prev || [])]);
        }

        const importedCustomerPersonnelCount = abortedByInfraIssue ? 0 : createdItems.length;
        summarizeImportResult('Nhân sự liên hệ', importedCustomerPersonnelCount, failures);
        exportImportFailureFile(payload, 'Nhân sự liên hệ', failures);
        if (importedCustomerPersonnelCount > 0 && failures.length === 0 && !abortedByInfraIssue) {
          const rows = await fetchCustomerPersonnel();
          setCusPersonnel(
            (rows || []).map((item) => ({
              ...item,
              birthday: normalizeImportDate(String(item?.birthday || '')) || String(item?.birthday || '').trim(),
            }))
          );
          handleCloseModal();
          return;
        }
      } else if (moduleToken === 'projects' || moduleToken === 'project') {
        const failures: string[] = [];
        const successItems: Project[] = [];
        const allSheets = (payload.sheets && payload.sheets.length > 0)
          ? payload.sheets
          : [{
            name: payload.sheetName || 'Sheet1',
            headers: payload.headers || [],
            rows: payload.rows || [],
          }];

        const findSheet = (
          keywords: string[],
          fallbackToFirst = false
        ): { name: string; headers: string[]; rows: string[][] } | undefined => {
          const byName = allSheets.find((sheet) => {
            const token = normalizeImportToken(sheet.name || '');
            return keywords.some((keyword) => token.includes(keyword));
          });
          if (byName) {
            return byName;
          }
          if (!fallbackToFirst) {
            return undefined;
          }

          return allSheets.find((sheet) => (sheet.headers || []).length > 0);
        };

        const projectSheet = findSheet(['duan', 'project'], true);
        if (!projectSheet || (projectSheet.headers || []).length === 0) {
          addToast('error', 'Nhập dữ liệu', 'Không tìm thấy sheet Dự án hợp lệ trong file import.');
          return;
        }

        const itemSheet = findSheet(['hangmuc', 'projectitem', 'item']);
        const raciSheet = findSheet(['raci']);
        const projectHeaderIndex = buildHeaderIndex(projectSheet.headers || []);

        const customerByToken = new Map<string, Customer>();
        (customers || []).forEach((customer) => {
          customerByToken.set(normalizeImportToken(customer.id), customer);
          customerByToken.set(normalizeImportToken(customer.customer_code), customer);
          customerByToken.set(normalizeImportToken(customer.customer_name), customer);
        });

        const opportunityByToken = new Map<string, Opportunity>();
        (opportunities || []).forEach((opportunity) => {
          opportunityByToken.set(normalizeImportToken(opportunity.id), opportunity);
          opportunityByToken.set(normalizeImportToken(opportunity.opp_name), opportunity);
        });

        const productByToken = new Map<string, Product>();
        (products || []).forEach((product) => {
          productByToken.set(normalizeImportToken(product.id), product);
          productByToken.set(normalizeImportToken(product.product_code), product);
          productByToken.set(normalizeImportToken(product.product_name), product);
        });

        const employeeByToken = new Map<string, Employee>();
        (employees || []).forEach((employee) => {
          employeeByToken.set(normalizeImportToken(employee.id), employee);
          employeeByToken.set(normalizeImportToken(employee.user_code), employee);
          employeeByToken.set(normalizeImportToken(employee.employee_code), employee);
          employeeByToken.set(normalizeImportToken(employee.username), employee);
          employeeByToken.set(normalizeImportToken(employee.full_name), employee);
        });

        const existingProjectByCode = new Map<string, Project>();
        (projects || []).forEach((project) => {
          const token = normalizeImportToken(project.project_code);
          if (!token) {
            return;
          }
          existingProjectByCode.set(token, project);
        });

        const normalizeProjectStatusImport = (value: string): Project['status'] => {
          const token = normalizeImportToken(value);
          if (['dungthu', 'trial', 'thu', 'planning', 'plan'].includes(token)) return 'TRIAL';
          if (['dangtrienkhai', 'ongoing', 'active', 'thuchien'].includes(token)) return 'ONGOING';
          if (['baohanh', 'warranty'].includes(token)) return 'WARRANTY';
          if (['hoanthanh', 'completed', 'ketthuc', 'dakethuc'].includes(token)) return 'COMPLETED';
          if (['huy', 'dahuy', 'cancelled', 'terminated', 'suspended', 'ngung'].includes(token)) return 'CANCELLED';
          return 'TRIAL';
        };

        const normalizeInvestmentModeImport = (value: string): Project['investment_mode'] => {
          const token = normalizeImportToken(value);
          if (['dautu', 'investment'].includes(token)) return 'DAU_TU';
          return 'THUE_DICH_VU_DACTHU';
        };

        const normalizeRaciRoleImport = (value: string): 'R' | 'A' | 'C' | 'I' | null => {
          const raw = String(value || '').trim().toUpperCase();
          if (['R', 'A', 'C', 'I'].includes(raw)) {
            return raw as 'R' | 'A' | 'C' | 'I';
          }

          const token = normalizeImportToken(value);
          if (token === 'responsible' || token === 'thuchien' || token === 'r') return 'R';
          if (token === 'accountable' || token === 'chiutrachnhiem' || token === 'a') return 'A';
          if (token === 'consulted' || token === 'thamkhao' || token === 'c') return 'C';
          if (token === 'informed' || token === 'duocthongbao' || token === 'i') return 'I';
          return null;
        };

        const projectEntries = new Map<string, {
          rowNumber: number;
          project_code: string;
          project_name: string;
          customer_id: string | number | null;
          opportunity_id: string | number | null;
          investment_mode: Project['investment_mode'];
          status: Project['status'];
          start_date: string;
          expected_end_date: string | null;
          actual_end_date: string | null;
        }>();

        const projectRowNumberByCode = new Map<string, number>();

        (projectSheet.rows || []).forEach((row, rowIndex) => {
          const rowNumber = rowIndex + 2;
          const projectCode = getImportCell(row, projectHeaderIndex, ['maduan', 'projectcode', 'code']);
          const projectName = getImportCell(row, projectHeaderIndex, ['tenduan', 'projectname', 'name']);
          const customerRaw = getImportCell(row, projectHeaderIndex, ['makhachhang', 'customercode', 'customerid', 'khachhang', 'customer']);
          const opportunityRaw = getImportCell(row, projectHeaderIndex, ['macohoi', 'cohoi', 'opportunityid', 'opportunityname', 'opportunity', 'oppname']);
          const investmentRaw = getImportCell(row, projectHeaderIndex, ['hinhthuc', 'hinhthucdautu', 'investmentmode', 'investment']);
          const statusRaw = getImportCell(row, projectHeaderIndex, ['trangthai', 'status']);
          const startDateRaw = getImportCell(row, projectHeaderIndex, ['ngaybatdau', 'startdate']);
          const expectedEndRaw = getImportCell(row, projectHeaderIndex, ['ngayketthucdukien', 'expectedenddate', 'ngayketthuc']);
          const actualEndRaw = getImportCell(row, projectHeaderIndex, ['ngayketthucthucte', 'actualenddate']);

          if (!projectCode && !projectName && !customerRaw && !opportunityRaw && !investmentRaw && !statusRaw && !startDateRaw && !expectedEndRaw && !actualEndRaw) {
            return;
          }

          if (!projectCode || !projectName) {
            failures.push(`Dòng ${rowNumber}: thiếu Mã dự án hoặc Tên dự án.`);
            return;
          }

          const projectCodeToken = normalizeImportToken(projectCode);
          if (!projectCodeToken) {
            failures.push(`Dòng ${rowNumber}: mã dự án "${projectCode}" không hợp lệ.`);
            return;
          }
          if (projectEntries.has(projectCodeToken)) {
            failures.push(`Dòng ${rowNumber}: mã dự án "${projectCode}" bị trùng trong sheet Dự án.`);
            return;
          }

          const existingProject = existingProjectByCode.get(projectCodeToken);

          const customer = customerRaw
            ? customerByToken.get(normalizeImportToken(customerRaw))
            : (existingProject
              ? customerByToken.get(normalizeImportToken(existingProject.customer_id))
              : undefined);
          if (!customer) {
            failures.push(`Dòng ${rowNumber}: không tìm thấy khách hàng "${customerRaw}".`);
            return;
          }

          const opportunity = opportunityRaw
            ? opportunityByToken.get(normalizeImportToken(opportunityRaw))
            : undefined;
          if (opportunityRaw && !opportunity) {
            failures.push(`Dòng ${rowNumber}: không tìm thấy cơ hội "${opportunityRaw}".`);
            return;
          }

          const startDate = normalizeImportDate(startDateRaw) || existingProject?.start_date || new Date().toISOString().slice(0, 10);
          const expectedEndDate = expectedEndRaw
            ? normalizeImportDate(expectedEndRaw)
            : (existingProject?.expected_end_date || null);
          const actualEndDate = actualEndRaw
            ? normalizeImportDate(actualEndRaw)
            : (existingProject?.actual_end_date || null);

          if (startDateRaw && !normalizeImportDate(startDateRaw)) {
            failures.push(`Dòng ${rowNumber}: ngày bắt đầu "${startDateRaw}" không hợp lệ.`);
            return;
          }
          if (expectedEndRaw && !expectedEndDate) {
            failures.push(`Dòng ${rowNumber}: ngày kết thúc dự kiến "${expectedEndRaw}" không hợp lệ.`);
            return;
          }
          if (actualEndRaw && !actualEndDate) {
            failures.push(`Dòng ${rowNumber}: ngày kết thúc thực tế "${actualEndRaw}" không hợp lệ.`);
            return;
          }
          if (startDate && expectedEndDate && startDate > expectedEndDate) {
            failures.push(`Dòng ${rowNumber}: ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc dự kiến.`);
            return;
          }

          projectEntries.set(projectCodeToken, {
            rowNumber,
            project_code: projectCode,
            project_name: projectName,
            customer_id: customer.id,
            opportunity_id: opportunity?.id || null,
            investment_mode: normalizeInvestmentModeImport(investmentRaw || existingProject?.investment_mode || ''),
            status: normalizeProjectStatusImport(statusRaw || existingProject?.status || 'TRIAL'),
            start_date: startDate,
            expected_end_date: expectedEndDate,
            actual_end_date: actualEndDate,
          });
          projectRowNumberByCode.set(projectCodeToken, rowNumber);
        });

        if (projectEntries.size === 0) {
          addToast('error', 'Nhập dữ liệu', 'Sheet Dự án không có dòng hợp lệ để import.');
          return;
        }

        const itemRowsByProject = new Map<string, Array<{ product_id: number; quantity: number; unit_price: number }>>();
        const itemIdentityByProject = new Map<string, Set<string>>();
        if (itemSheet && (itemSheet.headers || []).length > 0) {
          const itemHeaderIndex = buildHeaderIndex(itemSheet.headers || []);
          (itemSheet.rows || []).forEach((row, rowIndex) => {
            const sheetRowNumber = rowIndex + 2;
            const projectCodeRaw = getImportCell(row, itemHeaderIndex, ['maduan', 'projectcode', 'duan']);
            const productRaw = getImportCell(row, itemHeaderIndex, ['masanpham', 'productcode', 'productid', 'sanpham', 'product']);
            const quantityRaw = getImportCell(row, itemHeaderIndex, ['soluong', 'quantity', 'sl']);
            const unitPriceRaw = getImportCell(row, itemHeaderIndex, ['dongia', 'unitprice', 'gia']);

            if (!projectCodeRaw && !productRaw && !quantityRaw && !unitPriceRaw) {
              return;
            }

            const projectCodeToken = normalizeImportToken(projectCodeRaw);
            if (!projectCodeToken || !projectEntries.has(projectCodeToken)) {
              failures.push(`Sheet HangMuc dòng ${sheetRowNumber}: không tìm thấy project_code "${projectCodeRaw}" trong sheet Dự án.`);
              return;
            }

            if (!productRaw) {
              const projectRowNumber = projectRowNumberByCode.get(projectCodeToken) || sheetRowNumber;
              failures.push(`Dòng ${projectRowNumber}: thiếu sản phẩm ở sheet HangMuc.`);
              return;
            }

            const product = productByToken.get(normalizeImportToken(productRaw));
            if (!product) {
              const projectRowNumber = projectRowNumberByCode.get(projectCodeToken) || sheetRowNumber;
              failures.push(`Dòng ${projectRowNumber}: không tìm thấy sản phẩm "${productRaw}" trong sheet HangMuc.`);
              return;
            }

            const quantity = normalizeImportNumber(quantityRaw) ?? 0;
            const unitPrice = normalizeImportNumber(unitPriceRaw) ?? 0;
            if (quantity <= 0) {
              const projectRowNumber = projectRowNumberByCode.get(projectCodeToken) || sheetRowNumber;
              failures.push(`Dòng ${projectRowNumber}: số lượng hạng mục phải lớn hơn 0.`);
              return;
            }
            if (unitPrice < 0) {
              const projectRowNumber = projectRowNumberByCode.get(projectCodeToken) || sheetRowNumber;
              failures.push(`Dòng ${projectRowNumber}: đơn giá hạng mục phải lớn hơn hoặc bằng 0.`);
              return;
            }

            const identity = `${product.id}`;
            const identitySet = itemIdentityByProject.get(projectCodeToken) || new Set<string>();
            if (identitySet.has(identity)) {
              const projectRowNumber = projectRowNumberByCode.get(projectCodeToken) || sheetRowNumber;
              failures.push(`Dòng ${projectRowNumber}: sản phẩm "${productRaw}" bị trùng trong sheet HangMuc.`);
              return;
            }
            identitySet.add(identity);
            itemIdentityByProject.set(projectCodeToken, identitySet);

            const itemRows = itemRowsByProject.get(projectCodeToken) || [];
            itemRows.push({
              product_id: Number(product.id),
              quantity,
              unit_price: unitPrice,
            });
            itemRowsByProject.set(projectCodeToken, itemRows);
          });
        }

        const raciRowsByProject = new Map<string, Array<{ user_id: number; raci_role: 'R' | 'A' | 'C' | 'I' }>>();
        const raciIdentityByProject = new Map<string, Set<string>>();
        if (raciSheet && (raciSheet.headers || []).length > 0) {
          const raciHeaderIndex = buildHeaderIndex(raciSheet.headers || []);
          (raciSheet.rows || []).forEach((row, rowIndex) => {
            const sheetRowNumber = rowIndex + 2;
            const projectCodeRaw = getImportCell(row, raciHeaderIndex, ['maduan', 'projectcode', 'duan']);
            const userRaw = getImportCell(row, raciHeaderIndex, ['manhansu', 'usercode', 'userid', 'nhansu', 'employee', 'user']);
            const roleRaw = getImportCell(row, raciHeaderIndex, ['vaitro', 'racirole', 'role']);

            if (!projectCodeRaw && !userRaw && !roleRaw) {
              return;
            }

            const projectCodeToken = normalizeImportToken(projectCodeRaw);
            if (!projectCodeToken || !projectEntries.has(projectCodeToken)) {
              failures.push(`Sheet RACI dòng ${sheetRowNumber}: không tìm thấy project_code "${projectCodeRaw}" trong sheet Dự án.`);
              return;
            }

            if (!userRaw) {
              const projectRowNumber = projectRowNumberByCode.get(projectCodeToken) || sheetRowNumber;
              failures.push(`Dòng ${projectRowNumber}: thiếu nhân sự ở sheet RACI.`);
              return;
            }

            const employee = employeeByToken.get(normalizeImportToken(userRaw));
            if (!employee) {
              const projectRowNumber = projectRowNumberByCode.get(projectCodeToken) || sheetRowNumber;
              failures.push(`Dòng ${projectRowNumber}: không tìm thấy nhân sự "${userRaw}" trong sheet RACI.`);
              return;
            }

            const raciRole = normalizeRaciRoleImport(roleRaw);
            if (!raciRole) {
              const projectRowNumber = projectRowNumberByCode.get(projectCodeToken) || sheetRowNumber;
              failures.push(`Dòng ${projectRowNumber}: vai trò RACI "${roleRaw}" không hợp lệ (chỉ nhận R/A/C/I).`);
              return;
            }

            const identity = `${employee.id}|${raciRole}`;
            const identitySet = raciIdentityByProject.get(projectCodeToken) || new Set<string>();
            if (identitySet.has(identity)) {
              const projectRowNumber = projectRowNumberByCode.get(projectCodeToken) || sheetRowNumber;
              failures.push(`Dòng ${projectRowNumber}: nhân sự "${userRaw}" bị trùng vai trò "${raciRole}" trong sheet RACI.`);
              return;
            }
            identitySet.add(identity);
            raciIdentityByProject.set(projectCodeToken, identitySet);

            const raciRows = raciRowsByProject.get(projectCodeToken) || [];
            raciRows.push({
              user_id: Number(employee.id),
              raci_role: raciRole,
            });
            raciRowsByProject.set(projectCodeToken, raciRows);
          });
        }

        const projectEntriesList = Array.from(projectEntries.entries());
        setImportProgress('Dự án', 0, projectEntriesList.length);
        let processed = 0;

        for (const [projectCodeToken, entry] of projectEntriesList) {
          const existing = existingProjectByCode.get(projectCodeToken);
          const requestPayload: Record<string, unknown> = {
            project_code: entry.project_code,
            project_name: entry.project_name,
            customer_id: entry.customer_id,
            opportunity_id: entry.opportunity_id,
            investment_mode: entry.investment_mode,
            status: entry.status,
            start_date: entry.start_date,
            expected_end_date: entry.expected_end_date,
            actual_end_date: entry.actual_end_date,
            items: itemRowsByProject.get(projectCodeToken) || [],
            raci: raciRowsByProject.get(projectCodeToken) || [],
            sync_items: true,
            sync_raci: true,
          };

          try {
            const saved = existing
              ? await updateProject(existing.id, requestPayload as Partial<Project> & Record<string, unknown>)
              : await createProject(requestPayload as Partial<Project> & Record<string, unknown>);
            successItems.push(saved);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi không xác định';
            failures.push(`Dòng ${entry.rowNumber}: ${message}`);
          }

          processed += 1;
          setImportProgress('Dự án', processed, projectEntriesList.length);
        }

        if (successItems.length > 0) {
          const [projectRows, itemRows] = await Promise.all([fetchProjects(), fetchProjectItems()]);
          setProjects(projectRows || []);
          setProjectItems(itemRows || []);
          void loadProjectsPage();
        }

        summarizeImportResult('Dự án', successItems.length, failures);
        exportImportFailureFile(
          {
            moduleKey: payload.moduleKey,
            fileName: payload.fileName,
            sheetName: projectSheet.name,
            headers: projectSheet.headers || [],
            rows: projectSheet.rows || [],
          },
          'Dự án',
          failures
        );
        if (successItems.length > 0 && failures.length === 0) {
          handleCloseModal();
          return;
        }
      } else if (moduleToken === 'opportunities' || moduleToken === 'opportunity') {
        const failures: string[] = [];
        const importEntries: Array<{ rowNumber: number; payload: Partial<Opportunity> }> = [];
        const createdItems: Opportunity[] = [];
        let abortedByInfraIssue = false;
        setImportProgress('Cơ hội', 0, rows.length);

        const customerByToken = new Map<string, Customer>();
        (customers || []).forEach((customer) => {
          customerByToken.set(normalizeImportToken(customer.id), customer);
          customerByToken.set(normalizeImportToken(customer.customer_code), customer);
          customerByToken.set(normalizeImportToken(customer.customer_name), customer);
        });

        const stageCodeByLookupToken = new Map<string, OpportunityStage>();
        const activeStageCodes = new Set<string>();
        const addStageLookupToken = (token: string, stageCode: OpportunityStage) => {
          if (!token) {
            return;
          }
          stageCodeByLookupToken.set(token, stageCode);
        };

        (opportunityStages || []).forEach((stage) => {
          const stageCode = String(stage.stage_code || '').trim().toUpperCase() as OpportunityStage;
          if (!stageCode) {
            return;
          }
          if (stage.is_active !== false) {
            activeStageCodes.add(stageCode);
          }
          addStageLookupToken(normalizeImportToken(stageCode), stageCode);
          addStageLookupToken(normalizeImportToken(stage.stage_name || ''), stageCode);
        });

        const knownStageAliases: Array<[string, OpportunityStage]> = [
          ['moi', 'NEW'],
          ['new', 'NEW'],
          ['dexuat', 'PROPOSAL'],
          ['proposal', 'PROPOSAL'],
          ['damphan', 'NEGOTIATION'],
          ['negotiation', 'NEGOTIATION'],
          ['thang', 'WON'],
          ['won', 'WON'],
          ['win', 'WON'],
          ['thatbai', 'LOST'],
          ['lost', 'LOST'],
          ['lose', 'LOST'],
        ];

        knownStageAliases.forEach(([alias, stageCode]) => {
          if (activeStageCodes.size === 0 || activeStageCodes.has(stageCode)) {
            addStageLookupToken(alias, stageCode);
          }
        });

        const firstActiveStage = (opportunityStages || []).find((stage) => stage.is_active !== false);
        const defaultStage = (activeStageCodes.has('NEW')
          ? 'NEW'
          : String(firstActiveStage?.stage_code || 'NEW').trim().toUpperCase() || 'NEW') as OpportunityStage;

        const normalizeOpportunityStageImport = (value: string): OpportunityStage | null => {
          const token = normalizeImportToken(value);
          if (!token) {
            return defaultStage;
          }

          const resolvedStage = stageCodeByLookupToken.get(token);
          if (!resolvedStage) {
            return null;
          }

          if (activeStageCodes.size > 0 && !activeStageCodes.has(String(resolvedStage).toUpperCase())) {
            return null;
          }

          return resolvedStage;
        };

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          if (abortedByInfraIssue) {
            break;
          }

          const row = rows[rowIndex];
          const rowNumber = rowIndex + 2;
          const opportunityName = getImportCell(row, headerIndex, ['tencohoi', 'cohoi', 'opportunityname', 'oppname', 'name']);
          const customerRaw = getImportCell(row, headerIndex, ['khachhang', 'makhachhang', 'customercode', 'customerid', 'customername', 'customer']);
          const amountRaw = getImportCell(row, headerIndex, ['giatridukien', 'giatri', 'amount', 'value', 'pipelinevalue']);
          const stageRaw = getImportCell(row, headerIndex, ['giaidoan', 'stage', 'status']);

          if (!opportunityName && !customerRaw && !amountRaw && !stageRaw) {
            continue;
          }

          if (!opportunityName) {
            failures.push(`Dòng ${rowNumber}: thiếu Tên cơ hội.`);
            continue;
          }

          if (!customerRaw) {
            failures.push(`Dòng ${rowNumber}: thiếu Khách hàng (Mã KH/ID/Tên KH).`);
            continue;
          }

          const customer = customerByToken.get(normalizeImportToken(customerRaw));
          if (!customer) {
            failures.push(`Dòng ${rowNumber}: không tìm thấy khách hàng "${customerRaw}".`);
            continue;
          }

          const parsedAmount = normalizeImportNumber(amountRaw);
          if (amountRaw && parsedAmount === null) {
            failures.push(`Dòng ${rowNumber}: Giá trị dự kiến "${amountRaw}" không hợp lệ.`);
            continue;
          }

          const normalizedStage = normalizeOpportunityStageImport(stageRaw);
          if (!normalizedStage) {
            failures.push(`Dòng ${rowNumber}: Giai đoạn "${stageRaw}" không hợp lệ.`);
            continue;
          }

          importEntries.push({
            rowNumber,
            payload: {
              opp_name: opportunityName,
              customer_id: customer.id,
              amount: parsedAmount ?? 0,
              stage: normalizedStage,
            },
          });
        }

        const totalImportEntries = importEntries.length;
        for (let index = 0; index < importEntries.length; index += 1) {
          const entry = importEntries[index];
          try {
            const created = await createOpportunity(entry.payload);
            createdItems.push(created);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi không xác định';
            if (isImportInfrastructureError(error, message)) {
              failures.push(`Dòng ${entry.rowNumber}: ${message}`);
              failures.push('Đã dừng import do lỗi kết nối mạng hoặc máy chủ. Vui lòng thử lại sau khi hệ thống ổn định.');
              abortedByInfraIssue = true;
              break;
            }
            failures.push(`Dòng ${entry.rowNumber}: ${message}`);
          }
          setImportProgress('Cơ hội', index + 1, totalImportEntries);
        }

        if (abortedByInfraIssue) {
          await rollbackImportedRows('Cơ hội', createdItems, deleteOpportunity);
        } else if (createdItems.length > 0) {
          setOpportunities((prev) => [...createdItems, ...(prev || [])]);
        }
        if (!abortedByInfraIssue) {
          setImportProgress('Cơ hội', rows.length, rows.length);
        }

        const importedOpportunityCount = abortedByInfraIssue ? 0 : createdItems.length;
        summarizeImportResult('Cơ hội', importedOpportunityCount, failures);
        exportImportFailureFile(payload, 'Cơ hội', failures);
        if (importedOpportunityCount > 0 && failures.length === 0 && !abortedByInfraIssue) {
          handleCloseModal();
          return;
        }
      } else {
        addToast('error', 'Nhập dữ liệu', 'Module này chưa hỗ trợ import.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Nhập dữ liệu thất bại', message);
      throw error;
    } finally {
      setIsSaving(false);
      setImportLoadingText('');
      importInFlightRef.current = false;
    }
  };

  // Modal Handlers
  const handleOpenModal = (type: ModalType, item?: any) => {
    if (!canOpenModal(authUser, type, activeModuleKey)) {
      const permission = type === 'IMPORT_DATA' ? resolveImportPermission(activeModuleKey) : null;
      const hint = permission ? ` (${permission})` : '';
      addToast('error', 'Không đủ quyền', `Bạn không có quyền thực hiện thao tác này${hint}.`);
      return;
    }

    setModalType(type);
    if (type !== 'IMPORT_DATA') {
      setImportModuleOverride(null);
    }
    // Reset selections
    setSelectedDept(null);
    setSelectedEmployee(null);
    setSelectedBusiness(null);
    setSelectedVendor(null);
    setSelectedProduct(null);
    setSelectedCustomer(null);
    setSelectedCusPersonnel(null);
    setSelectedOpportunity(null);
    setSelectedProject(null);
    setProjectModalInitialTab('info');
    setSelectedContract(null);
    setContractAddPrefill(null);
    setSelectedDocument(null);
    setSelectedReminder(null);
    projectDetailLoadVersionRef.current += 1;
    contractDetailLoadVersionRef.current += 1;

    if (type === 'ADD_USER_DEPT_HISTORY' && item && 'username' in item) {
      const employee = item as Employee;
      setSelectedEmployee(employee);
      setSelectedUserDeptHistory({
        id: '',
        userId: String(employee.id ?? ''),
        fromDeptId: String(employee.department_id ?? ''),
        toDeptId: '',
        transferDate: new Date().toISOString().split('T')[0],
        reason: '',
      });
      return;
    }

    if (type?.includes('EMPLOYEE')) {
       setSelectedEmployee(item as Employee);
    } else if (type?.includes('BUSINESS')) {
       setSelectedBusiness(item as Business);
    } else if (type?.includes('VENDOR')) {
       setSelectedVendor(item as Vendor);
    } else if (type?.includes('PRODUCT')) {
       setSelectedProduct(item as Product);
    } else if (type?.includes('CUSTOMER')) {
       setSelectedCustomer(item as Customer);
    } else if (type?.includes('CUS_PERSONNEL')) {
       const personnel = item as CustomerPersonnel;
       setSelectedCusPersonnel({
         ...personnel,
         birthday: normalizeImportDate(String(personnel?.birthday || '')) || String(personnel?.birthday || '').trim(),
       });
    } else if (type?.includes('OPPORTUNITY')) {
       setSelectedOpportunity(item as Opportunity);
    } else if (type?.includes('PROJECT')) {
       const project = item as Project;
       setSelectedProject(project);
       if (type === 'EDIT_PROJECT' && project?.id) {
         const requestVersion = projectDetailLoadVersionRef.current;
         void fetchProjectDetail(project.id)
           .then((detail) => {
             if (projectDetailLoadVersionRef.current !== requestVersion) {
               return;
             }
             setSelectedProject(detail);
           })
           .catch((error) => {
             if (projectDetailLoadVersionRef.current !== requestVersion) {
               return;
             }
             const message = error instanceof Error ? error.message : 'Không thể tải chi tiết dự án.';
             addToast('error', 'Tải dữ liệu thất bại', message);
           });
       }
    } else if (type?.includes('CONTRACT')) {
       const contract = item ? (item as Contract) : null;
       setSelectedContract(contract);
       if (type === 'EDIT_CONTRACT' && contract?.id) {
         const requestVersion = contractDetailLoadVersionRef.current;
         void fetchContractDetail(contract.id)
           .then((detail) => {
             if (contractDetailLoadVersionRef.current !== requestVersion) {
               return;
             }
             setSelectedContract(detail);
           })
           .catch((error) => {
             if (contractDetailLoadVersionRef.current !== requestVersion) {
               return;
             }
             const message = error instanceof Error ? error.message : 'Không thể tải chi tiết hợp đồng.';
             addToast('error', 'Tải dữ liệu thất bại', message);
           });
       }
    } else if (type?.includes('DOCUMENT')) {
       setSelectedDocument(item as Document);
    } else if (type?.includes('REMINDER')) {
       setSelectedReminder(item as Reminder);
    } else if (type?.includes('USER_DEPT_HISTORY')) {
       setSelectedUserDeptHistory((item as UserDeptHistory) || null);
    } else if (type?.includes('FEEDBACK')) {
       setSelectedFeedback((item as FeedbackRequest) || null);
    } else if (item && 'dept_code' in item) {
       setSelectedDept(item as Department);
    }
  };

  const handleOpenImportModalForModule = (moduleKey: string) => {
    if (!canOpenModal(authUser, 'IMPORT_DATA', moduleKey)) {
      const permission = resolveImportPermission(moduleKey);
      const hint = permission ? ` (${permission})` : '';
      addToast('error', 'Không đủ quyền', `Bạn không có quyền thực hiện thao tác này${hint}.`);
      return;
    }

    setImportModuleOverride(moduleKey);
    setModalType('IMPORT_DATA');
  };

  const handleCloseModal = () => {
    projectDetailLoadVersionRef.current += 1;
    contractDetailLoadVersionRef.current += 1;
    setModalType(null);
    setImportModuleOverride(null);
    setIsEmployeePasswordResetting(false);
    setSelectedDept(null);
    setSelectedEmployee(null);
    setSelectedBusiness(null);
    setSelectedVendor(null);
    setSelectedProduct(null);
    setSelectedCustomer(null);
    setSelectedCusPersonnel(null);
    setSelectedOpportunity(null);
    setSelectedProject(null);
    setProjectModalInitialTab('info');
    setSelectedContract(null);
    setContractAddPrefill(null);
    setSelectedDocument(null);
    setSelectedReminder(null);
    setSelectedUserDeptHistory(null);
    setSelectedFeedback(null);
    setIsSaving(false);
    setImportLoadingText('');
  };

  // --- Department Handlers ---
  const handleSaveDepartment = async (data: Partial<Department>) => {
    setIsSaving(true);
    try {
      if (modalType === 'ADD_DEPARTMENT') {
        const created = await createDepartment(data);
        setDepartments([created, ...departments]);
        addToast('success', 'Thành công', 'Thêm mới phòng ban thành công!');
      } else if (modalType === 'EDIT_DEPARTMENT' && selectedDept) {
        const updated = await updateDepartment(selectedDept.id, data);
        setDepartments(
          departments.map(d =>
            String(d.id) === String(updated.id)
              ? updated
              : d
          )
        );
        addToast('success', 'Thành công', 'Cập nhật phòng ban thành công!');
      }
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu thất bại', `Không thể lưu phòng ban vào cơ sở dữ liệu. ${message}`);
      setIsSaving(false);
    }
  };

  const handleDeleteDepartment = async () => {
    if (!selectedDept) return;
    try {
      await deleteDepartment(selectedDept.id);
      setDepartments((departments || []).filter(d => String(d.id) !== String(selectedDept.id)));
      addToast('success', 'Thành công', 'Đã xóa phòng ban khỏi hệ thống.');
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa phòng ban trên cơ sở dữ liệu. ${message}`);
    }
  };

  // --- Employee Handlers ---
  const handleSaveEmployee = async (data: Partial<Employee>) => {
      setIsSaving(true);
      try {
        if (modalType === 'ADD_EMPLOYEE') {
          const result = await createEmployeeWithProvisioning(data);
          const created = result.employee;
          setEmployees([created, ...employees]);
          if (result.provisioning?.temporary_password) {
            setEmployeeProvisioning({
              employeeLabel: created.full_name || created.name || created.user_code || created.username || `#${created.id}`,
              provisioning: result.provisioning,
            });
          }
          addToast('success', 'Thành công', 'Thêm mới nhân sự thành công!');
        } else if (modalType === 'EDIT_EMPLOYEE' && selectedEmployee) {
          const updated = await updateEmployee(selectedEmployee.id, data);
          setEmployees(
            (employees || []).map(e =>
              String(e.id) === String(updated.id)
                ? updated
                : e
            )
          );
          addToast('success', 'Thành công', 'Cập nhật thông tin nhân sự thành công!');
        }
        handleCloseModal();
        void loadEmployeesPage();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Lỗi không xác định';
        addToast('error', 'Lưu thất bại', `Không thể lưu nhân sự vào cơ sở dữ liệu. ${message}`);
        setIsSaving(false);
      }
  };

  const handleResetEmployeePassword = async () => {
    if (!selectedEmployee) {
      return;
    }

    setIsEmployeePasswordResetting(true);
    try {
      const result = await resetEmployeePassword(selectedEmployee.id);
      const updatedEmployee = result.employee;

      setEmployees((current) =>
        (current || []).map((employee) =>
          String(employee.id) === String(updatedEmployee.id) ? updatedEmployee : employee
        )
      );
      setSelectedEmployee(updatedEmployee);

      if (result.provisioning?.temporary_password) {
        setEmployeeProvisioning({
          employeeLabel:
            updatedEmployee.full_name ||
            updatedEmployee.name ||
            updatedEmployee.user_code ||
            updatedEmployee.username ||
            `#${updatedEmployee.id}`,
          provisioning: result.provisioning,
        });
      }

      addToast('success', 'Bảo mật tài khoản', 'Đã reset mật khẩu tạm thời cho nhân sự.');
      void loadEmployeesPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Reset mật khẩu thất bại', message);
    } finally {
      setIsEmployeePasswordResetting(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;
    try {
      await deleteEmployee(selectedEmployee.id);
      setEmployees((employees || []).filter(e => String(e.id) !== String(selectedEmployee.id)));
      addToast('success', 'Thành công', 'Đã xóa nhân sự thành công.');
      handleCloseModal();
      void loadEmployeesPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa nhân sự trên cơ sở dữ liệu. ${message}`);
    }
  };

  // --- Business Handlers ---
  const handleSaveBusiness = async (data: Partial<Business>) => {
    setIsSaving(true);
    const normalizeBusinessCode = (value: unknown): string => String(value ?? '').trim().toUpperCase();
    const normalizeBusinessName = (value: unknown): string => String(value ?? '').trim();
    const payload: Partial<Business> = {
      domain_code: normalizeBusinessCode(data.domain_code),
      domain_name: normalizeBusinessName(data.domain_name),
    };

    try {
      if (modalType === 'ADD_BUSINESS') {
        const created = await createBusiness(payload);
        setBusinesses((prev) => [created, ...(prev || []).filter((item) => String(item.id) !== String(created.id))]);
        addToast('success', 'Thành công', 'Thêm mới lĩnh vực kinh doanh thành công!');
        handleCloseModal();
      } else if (modalType === 'EDIT_BUSINESS' && selectedBusiness) {
        const currentCode = normalizeBusinessCode(selectedBusiness.domain_code);
        const currentName = normalizeBusinessName(selectedBusiness.domain_name);
        if (payload.domain_code === currentCode && payload.domain_name === currentName) {
          addToast('success', 'Thông báo', 'Không có thay đổi để cập nhật.');
          setIsSaving(false);
          return;
        }

        const updated = await updateBusiness(selectedBusiness.id, payload);
        setBusinesses((prev) =>
          (prev || []).map((item) => (String(item.id) === String(updated.id) ? updated : item))
        );
        addToast('success', 'Thành công', 'Cập nhật lĩnh vực thành công!');
        handleCloseModal();
      } else {
        setIsSaving(false);
        return;
      }

      try {
        const rows = await fetchBusinesses();
        setBusinesses(rows || []);
      } catch {
        // Keep current state if refresh fails; update already persisted on server.
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu thất bại', `Không thể lưu lĩnh vực vào cơ sở dữ liệu. ${message}`);
      setIsSaving(false);
    }
  };

  const handleDeleteBusiness = async () => {
    if (!selectedBusiness) return;
    setIsSaving(true);
    try {
      await deleteBusiness(selectedBusiness.id);
      setBusinesses((prev) => (prev || []).filter((item) => String(item.id) !== String(selectedBusiness.id)));
      addToast('success', 'Thành công', 'Đã xóa lĩnh vực kinh doanh.');
      handleCloseModal();

      try {
        const rows = await fetchBusinesses();
        setBusinesses(rows || []);
      } catch {
        // Keep current state if refresh fails; deletion already persisted on server.
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa lĩnh vực trên cơ sở dữ liệu. ${message}`);
      setIsSaving(false);
    }
  };

  // --- Vendor Handlers ---
  const handleSaveVendor = async (data: Partial<Vendor>) => {
    setIsSaving(true);
    try {
      if (modalType === 'ADD_VENDOR') {
        const created = await createVendor(data);
        setVendors([created, ...vendors]);
        addToast('success', 'Thành công', 'Thêm mới đối tác thành công!');
      } else if (modalType === 'EDIT_VENDOR' && selectedVendor) {
        const updated = await updateVendor(selectedVendor.id, data);
        setVendors(
          (vendors || []).map(v =>
            String(v.id) === String(updated.id)
              ? updated
              : v
          )
        );
        addToast('success', 'Thành công', 'Cập nhật đối tác thành công!');
      }
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu thất bại', `Không thể lưu đối tác vào cơ sở dữ liệu. ${message}`);
      setIsSaving(false);
    }
  };

  const handleDeleteVendor = async () => {
    if (!selectedVendor) return;
    try {
      await deleteVendor(selectedVendor.id);
      setVendors((vendors || []).filter(v => String(v.id) !== String(selectedVendor.id)));
      addToast('success', 'Thành công', 'Đã xóa đối tác.');
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa đối tác trên cơ sở dữ liệu. ${message}`);
    }
  };

  // --- Feedback Handlers ---
  const handleSaveFeedback = async (data: {
    title: string;
    description: string | null;
    priority: FeedbackPriority;
    status?: FeedbackStatus;
    attachments: Attachment[];
  }) => {
    setIsSaving(true);
    try {
      const attachmentIds = (data.attachments ?? [])
        .map((a) => Number(a.id))
        .filter((id) => Number.isFinite(id) && id > 0);

      const payload = {
        title: data.title,
        description: data.description,
        priority: data.priority,
        ...(data.status ? { status: data.status } : {}),
        ...(attachmentIds.length > 0 ? { attachment_ids: attachmentIds } : {}),
      };

      if (modalType === 'ADD_FEEDBACK') {
        const created = await createFeedback(payload);
        setFeedbacksPageRows((prev) => [created, ...(prev || [])]);
        setFeedbacks((prev) => [created, ...(prev || [])]);
        addToast('success', 'Thành công', 'Thêm góp ý thành công!');
        handleCloseModal();
      } else if (modalType === 'EDIT_FEEDBACK' && selectedFeedback) {
        const updated = await updateFeedback(selectedFeedback.id, payload);
        setFeedbacksPageRows((prev) =>
          (prev || []).map((fb) => String(fb.id) === String(updated.id) ? updated : fb)
        );
        setFeedbacks((prev) =>
          (prev || []).map((fb) => String(fb.id) === String(updated.id) ? updated : fb)
        );
        addToast('success', 'Thành công', 'Cập nhật góp ý thành công!');
        handleCloseModal();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu thất bại', `Không thể lưu góp ý. ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFeedback = async () => {
    if (!selectedFeedback) return;
    try {
      await deleteFeedback(selectedFeedback.id);
      setFeedbacksPageRows((prev) => (prev || []).filter((fb) => String(fb.id) !== String(selectedFeedback.id)));
      setFeedbacks((prev) => (prev || []).filter((fb) => String(fb.id) !== String(selectedFeedback.id)));
      addToast('success', 'Thành công', 'Đã xóa góp ý.');
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa góp ý. ${message}`);
    }
  };

  // --- Product Handlers ---
  const handleSaveProduct = async (data: Partial<Product>) => {
    setIsSaving(true);
    try {
      const payload: Partial<Product> = {
        ...data,
        unit: normalizeProductUnit(data.unit),
        description: typeof data.description === 'string' ? data.description : null,
        is_active: data.is_active !== false,
        standard_price: Number.isFinite(Number(data.standard_price)) ? Number(data.standard_price) : 0,
      };

      if (modalType === 'ADD_PRODUCT') {
        const created = normalizeProductRecord(await createProduct(payload));
        setProducts((previous) => [created, ...(previous || [])]);
        addToast('success', 'Thành công', 'Thêm mới sản phẩm thành công!');
      } else if (modalType === 'EDIT_PRODUCT' && selectedProduct) {
        const updated = normalizeProductRecord(await updateProduct(selectedProduct.id, payload));
        setProducts(
          (previous) => (previous || []).map((product) =>
            String(product.id) === String(updated.id)
              ? updated
              : product
          )
        );
        addToast('success', 'Thành công', 'Cập nhật sản phẩm thành công!');
      }

      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu thất bại', `Không thể lưu sản phẩm vào cơ sở dữ liệu. ${message}`);
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    try {
      await deleteProduct(selectedProduct.id);
      setProducts((products || []).filter((product) => String(product.id) !== String(selectedProduct.id)));
      addToast('success', 'Thành công', 'Đã xóa sản phẩm.');
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa sản phẩm trên cơ sở dữ liệu. ${message}`);
    }
  };

  // --- Customer Handlers ---
  const handleSaveCustomer = async (data: Partial<Customer>) => {
    setIsSaving(true);
    try {
      if (modalType === 'ADD_CUSTOMER') {
        const created = await createCustomer(data);
        setCustomers([created, ...customers]);
        addToast('success', 'Thành công', 'Thêm mới khách hàng thành công!');
      } else if (modalType === 'EDIT_CUSTOMER' && selectedCustomer) {
        const updated = await updateCustomer(selectedCustomer.id, data);
        setCustomers(
          (customers || []).map(c =>
            String(c.id) === String(updated.id)
              ? updated
              : c
          )
        );
        addToast('success', 'Thành công', 'Cập nhật khách hàng thành công!');
      }
      handleCloseModal();
      void loadCustomersPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu thất bại', `Không thể lưu khách hàng vào cơ sở dữ liệu. ${message}`);
      setIsSaving(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    try {
      await deleteCustomer(selectedCustomer.id);
      setCustomers((customers || []).filter(c => String(c.id) !== String(selectedCustomer.id)));
      addToast('success', 'Thành công', 'Đã xóa khách hàng.');
      handleCloseModal();
      void loadCustomersPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa khách hàng trên cơ sở dữ liệu. ${message}`);
    }
  };

  // --- Customer Personnel Handlers ---
  const handleSaveCusPersonnel = async (data: Partial<CustomerPersonnel>) => {
    setIsSaving(true);
    try {
      const normalizedBirthday = normalizeImportDate(String(data.birthday || '')) || String(data.birthday || '').trim();
      const payload: Partial<CustomerPersonnel> = {
        ...data,
        birthday: normalizedBirthday,
      };

      if (modalType === 'ADD_CUS_PERSONNEL') {
        const created = await createCustomerPersonnel(payload);
        setCusPersonnel([created, ...cusPersonnel]);
        addToast('success', 'Thành công', 'Thêm mới nhân sự liên hệ thành công!');
      } else if (modalType === 'EDIT_CUS_PERSONNEL' && selectedCusPersonnel) {
        const updated = await updateCustomerPersonnel(selectedCusPersonnel.id, payload);
        setCusPersonnel(cusPersonnel.map((p) => (p.id === selectedCusPersonnel.id ? updated : p)));
        addToast('success', 'Thành công', 'Cập nhật nhân sự liên hệ thành công!');
      }

      handleCloseModal();
      const rows = await fetchCustomerPersonnel();
      setCusPersonnel(
        (rows || []).map((item) => ({
          ...item,
          birthday: normalizeImportDate(String(item?.birthday || '')) || String(item?.birthday || '').trim(),
        }))
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu thất bại', `Không thể lưu nhân sự liên hệ vào cơ sở dữ liệu. ${message}`);
      setIsSaving(false);
    }
  };

  const handleDeleteCusPersonnel = async () => {
    if (!selectedCusPersonnel) return;
    setIsSaving(true);
    try {
      await deleteCustomerPersonnel(selectedCusPersonnel.id);
      setCusPersonnel((cusPersonnel || []).filter(p => p.id !== selectedCusPersonnel.id));
      addToast('success', 'Thành công', 'Đã xóa nhân sự liên hệ.');
      handleCloseModal();
      const rows = await fetchCustomerPersonnel();
      setCusPersonnel(
        (rows || []).map((item) => ({
          ...item,
          birthday: normalizeImportDate(String(item?.birthday || '')) || String(item?.birthday || '').trim(),
        }))
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa nhân sự liên hệ trên cơ sở dữ liệu. ${message}`);
      setIsSaving(false);
    }
  };

  const attachOpportunityRaciRows = async (rows: Opportunity[]): Promise<Opportunity[]> => {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    if (normalizedRows.length === 0) {
      return [];
    }

    const ids = normalizedRows
      .map((opportunity) => Number(opportunity?.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (ids.length === 0) {
      return normalizedRows.map((opportunity) => ({
        ...opportunity,
        raci: Array.isArray(opportunity?.raci) ? opportunity.raci : [],
      }));
    }

    const raciRows = await fetchOpportunityRaciAssignments(ids).catch(() => [] as OpportunityRaciRow[]);
    if (raciRows.length === 0) {
      return normalizedRows.map((opportunity) => ({
        ...opportunity,
        raci: Array.isArray(opportunity?.raci) ? opportunity.raci : [],
      }));
    }

    const raciByOpportunityId = new Map<string, OpportunityRaciRow[]>();
    raciRows.forEach((row) => {
      const opportunityId = String(row?.opportunity_id ?? '').trim();
      if (!opportunityId) {
        return;
      }
      const current = raciByOpportunityId.get(opportunityId) || [];
      current.push(row);
      raciByOpportunityId.set(opportunityId, current);
    });

    return normalizedRows.map((opportunity) => {
      const rowsByOpportunity = raciByOpportunityId.get(String(opportunity.id)) || [];
      return {
        ...opportunity,
        raci: rowsByOpportunity.map((row, index) => {
          const role = String(row.raci_role || '').trim().toUpperCase();
          const userId = String(row.user_id ?? '').trim();
          const fallbackId = `OPP_RACI_${opportunity.id}_${userId || '0'}_${role || 'R'}_${index}`;

          return {
            id: String(row.id ?? fallbackId),
            userId: userId,
            user_id: userId,
            roleType: (role || 'R') as 'R' | 'A' | 'C' | 'I',
            raci_role: (role || 'R') as 'R' | 'A' | 'C' | 'I',
            assignedDate: String(row.assigned_date || ''),
            assigned_date: row.assigned_date || null,
            user_code: row.user_code || null,
            username: row.username || null,
            full_name: row.full_name || null,
          };
        }),
      };
    });
  };

  // --- Opportunity Handlers ---
  const handleSaveOpportunity = async (data: Partial<Opportunity>) => {
    setIsSaving(true);
    try {
      if (modalType === 'ADD_OPPORTUNITY') {
        await createOpportunity(data);
        addToast('success', 'Thành công', 'Thêm mới cơ hội thành công!');
      } else if (modalType === 'EDIT_OPPORTUNITY' && selectedOpportunity) {
        await updateOpportunity(selectedOpportunity.id, data);
        addToast('success', 'Thành công', 'Cập nhật cơ hội thành công!');
      }
      const rows = await fetchOpportunities();
      const withRaci = await attachOpportunityRaciRows(rows || []);
      setOpportunities(withRaci);
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu thất bại', `Không thể lưu cơ hội vào cơ sở dữ liệu. ${message}`);
      setIsSaving(false);
    }
  };

  const handleDeleteOpportunity = async () => {
    if (!selectedOpportunity) return;
    try {
      await deleteOpportunity(selectedOpportunity.id);
      setOpportunities((opportunities || []).filter(o => String(o.id) !== String(selectedOpportunity.id)));
      addToast('success', 'Thành công', 'Đã xóa cơ hội kinh doanh.');
      handleCloseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa cơ hội trên cơ sở dữ liệu. ${message}`);
    }
  };

  // --- Project Handlers ---
  const handleSaveProject = async (data: Partial<Project>) => {
    setIsSaving(true);
    try {
      const normalizeProjectNullableId = (value: unknown): number | null => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      };
      const normalizeProjectNullableText = (value: unknown): string | null => {
        const normalized = String(value ?? '').trim();
        return normalized ? normalized : null;
      };
      const shouldSyncItems = Array.isArray(data.items);
      const shouldSyncRaci = Array.isArray(data.raci);

      const normalizedItems = shouldSyncItems
        ? (data.items || [])
            .map((item) => {
              const source = (item || {}) as Record<string, unknown>;
              const productIdRaw = source.productId ?? source.product_id;
              const productId = Number(productIdRaw);
              if (!Number.isFinite(productId) || productId <= 0) {
                return null;
              }

              const quantityRaw = Number(source.quantity ?? 1);
              const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
              const unitPriceRaw = Number(source.unitPrice ?? source.unit_price ?? 0);
              const unitPrice = Number.isFinite(unitPriceRaw) && unitPriceRaw >= 0 ? unitPriceRaw : 0;

              return {
                product_id: productId,
                quantity,
                unit_price: unitPrice,
              };
            })
            .filter((item): item is { product_id: number; quantity: number; unit_price: number } => item !== null)
        : undefined;

      const normalizedRaci = shouldSyncRaci
        ? (data.raci || [])
            .map((item) => {
              const source = (item || {}) as Record<string, unknown>;
              const userIdRaw = source.userId ?? source.user_id;
              const userId = Number(userIdRaw);
              if (!Number.isFinite(userId) || userId <= 0) {
                return null;
              }

              const role = String(source.roleType ?? source.raci_role ?? '')
                .trim()
                .toUpperCase();
              if (!['R', 'A', 'C', 'I'].includes(role)) {
                return null;
              }

              const assignedDateRaw = String(source.assignedDate ?? source.assigned_date ?? '').trim();
              const assignedDate = assignedDateRaw ? normalizeImportDate(assignedDateRaw) : null;

              return {
                user_id: userId,
                raci_role: role,
                ...(assignedDate ? { assigned_date: assignedDate } : {}),
              };
            })
            .filter((item): item is { user_id: number; raci_role: string } => item !== null)
        : undefined;

      const normalizeProjectSnapshot = (
        source: Partial<Project> | null | undefined,
        items: Array<{ product_id: number; quantity: number; unit_price: number }>,
        raci: Array<{ user_id: number; raci_role: string; assigned_date?: string }>
      ) => ({
        project_code: String(source?.project_code ?? '').trim(),
        project_name: String(source?.project_name ?? '').trim(),
        customer_id: normalizeProjectNullableId(source?.customer_id),
        opportunity_id: normalizeProjectNullableId(source?.opportunity_id),
        investment_mode: normalizeProjectNullableText(source?.investment_mode),
        start_date: normalizeProjectNullableText(source?.start_date),
        expected_end_date: normalizeProjectNullableText(source?.expected_end_date),
        actual_end_date: normalizeProjectNullableText(source?.actual_end_date),
        status: normalizeProjectNullableText(source?.status),
        items,
        raci,
      });

      const payload: Record<string, unknown> = {
        ...data,
        sync_items: shouldSyncItems,
        sync_raci: shouldSyncRaci,
        items: normalizedItems,
        raci: normalizedRaci,
      };

      if (modalType === 'ADD_PROJECT') {
        const created = await createProject(payload as Partial<Project> & Record<string, unknown>);
        setProjects([created, ...projects]);
        setActiveTab('projects');
        addToast('success', 'Thành công', 'Thêm mới dự án thành công!');
        setSelectedProject(created);
        setProjectModalInitialTab('items');
        setModalType('EDIT_PROJECT');
        setIsSaving(false);
      } else if (modalType === 'EDIT_PROJECT' && selectedProject) {
        const currentItems = Array.isArray(selectedProject.items)
          ? selectedProject.items
              .map((item) => {
                const source = (item || {}) as Record<string, unknown>;
                const productId = Number(source.productId ?? source.product_id);
                if (!Number.isFinite(productId) || productId <= 0) {
                  return null;
                }

                const quantityRaw = Number(source.quantity ?? 1);
                const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
                const unitPriceRaw = Number(source.unitPrice ?? source.unit_price ?? 0);
                const unitPrice = Number.isFinite(unitPriceRaw) && unitPriceRaw >= 0 ? unitPriceRaw : 0;

                return {
                  product_id: productId,
                  quantity,
                  unit_price: unitPrice,
                };
              })
              .filter((item): item is { product_id: number; quantity: number; unit_price: number } => item !== null)
          : [];

        const currentRaci = Array.isArray(selectedProject.raci)
          ? selectedProject.raci
              .map((item) => {
                const source = (item || {}) as Record<string, unknown>;
                const userId = Number(source.userId ?? source.user_id);
                if (!Number.isFinite(userId) || userId <= 0) {
                  return null;
                }

                const role = String(source.roleType ?? source.raci_role ?? '')
                  .trim()
                  .toUpperCase();
                if (!['R', 'A', 'C', 'I'].includes(role)) {
                  return null;
                }

                const assignedDateRaw = String(source.assignedDate ?? source.assigned_date ?? '').trim();
                const assignedDate = assignedDateRaw ? normalizeImportDate(assignedDateRaw) : null;

                return {
                  user_id: userId,
                  raci_role: role,
                  ...(assignedDate ? { assigned_date: assignedDate } : {}),
                };
              })
              .filter((item): item is { user_id: number; raci_role: string; assigned_date?: string } => item !== null)
          : [];

        const nextSnapshot = normalizeProjectSnapshot(
          {
            ...selectedProject,
            ...data,
            project_code: String(data.project_code ?? selectedProject.project_code ?? '').trim(),
            project_name: String(data.project_name ?? selectedProject.project_name ?? '').trim(),
            customer_id: data.customer_id ?? selectedProject.customer_id ?? null,
            opportunity_id: data.opportunity_id ?? selectedProject.opportunity_id ?? null,
            investment_mode: data.investment_mode ?? selectedProject.investment_mode ?? null,
            start_date: data.start_date ?? selectedProject.start_date ?? null,
            expected_end_date: data.expected_end_date ?? selectedProject.expected_end_date ?? null,
            actual_end_date: data.actual_end_date ?? selectedProject.actual_end_date ?? null,
            status: data.status ?? selectedProject.status ?? null,
          },
          normalizedItems ?? currentItems,
          normalizedRaci ?? currentRaci
        );

        const currentSnapshot = normalizeProjectSnapshot(selectedProject, currentItems, currentRaci);

        if (JSON.stringify(nextSnapshot) === JSON.stringify(currentSnapshot)) {
          addToast('success', 'Thông báo', 'Không có thay đổi để cập nhật.');
          setIsSaving(false);
          return;
        }

        const updated = await updateProject(selectedProject.id, payload as Partial<Project> & Record<string, unknown>);
        setProjects(
          (projects || []).map(p =>
            String(p.id) === String(updated.id)
              ? updated
              : p
          )
        );
        addToast('success', 'Thành công', 'Cập nhật dự án thành công!');
        handleCloseModal();
      }
      void loadProjectsPage();
      const [projectRows, itemRows] = await Promise.all([fetchProjects(), fetchProjectItems()]);
      setProjects(projectRows || []);
      setProjectItems(itemRows || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu thất bại', `Không thể lưu dự án vào cơ sở dữ liệu. ${message}`);
      setIsSaving(false);
    }
  };

  const handleImportProjectItemsBatch = useCallback(async (
    groups: ProjectItemImportBatchGroup[]
  ): Promise<ProjectItemImportBatchResult> => {
    const result: ProjectItemImportBatchResult = {
      success_projects: [],
      failed_projects: [],
    };

    if (!Array.isArray(groups) || groups.length === 0) {
      return result;
    }

    const projectByCode = new Map<string, Project>();
    (projects || []).forEach((project) => {
      const token = normalizeImportToken(project.project_code);
      if (!token || projectByCode.has(token)) {
        return;
      }
      projectByCode.set(token, project);
    });

    const existingItemsByProject = new Map<string, Map<string, { product_id: number; quantity: number; unit_price: number }>>();
    (projectItems || []).forEach((item) => {
      const projectId = String(item.project_id || '');
      const productId = Number(item.product_id);
      if (!projectId || !Number.isFinite(productId) || productId <= 0) {
        return;
      }

      const quantityRaw = Number(item.quantity ?? 0);
      const unitPriceRaw = Number(item.unit_price ?? 0);
      const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
      const unitPrice = Number.isFinite(unitPriceRaw) && unitPriceRaw >= 0 ? unitPriceRaw : 0;

      const byProduct = existingItemsByProject.get(projectId) || new Map<string, { product_id: number; quantity: number; unit_price: number }>();
      byProduct.set(String(productId), {
        product_id: productId,
        quantity,
        unit_price: unitPrice,
      });
      existingItemsByProject.set(projectId, byProduct);
    });

    let hasSuccess = false;

    for (const group of groups) {
      const projectCode = String(group?.project_code || '').trim();
      const projectToken = normalizeImportToken(projectCode);

      if (!projectToken) {
        result.failed_projects.push({
          project_code: projectCode || '(trống)',
          message: 'Thiếu Mã dự án trong dữ liệu import.',
        });
        continue;
      }

      const project = projectByCode.get(projectToken);
      if (!project) {
        result.failed_projects.push({
          project_code: projectCode,
          message: 'Không tìm thấy dự án theo Mã dự án trong hệ thống.',
        });
        continue;
      }

      const sourceItems = Array.isArray(group.items) ? group.items : [];
      const groupErrors: string[] = [];
      const incomingByProduct = new Map<string, { product_id: number; quantity: number; unit_price: number }>();
      sourceItems.forEach((item, index) => {
        const productId = Number(item?.product_id);
        const quantity = Number(item?.quantity);
        const unitPrice = Number(item?.unit_price);

        if (!Number.isFinite(productId) || productId <= 0) {
          groupErrors.push(`Dòng ${index + 1}: sản phẩm không hợp lệ.`);
          return;
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
          groupErrors.push(`Dòng ${index + 1}: số lượng phải lớn hơn 0.`);
          return;
        }
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          groupErrors.push(`Dòng ${index + 1}: đơn giá phải lớn hơn hoặc bằng 0.`);
          return;
        }

        incomingByProduct.set(String(productId), {
          product_id: productId,
          quantity,
          unit_price: unitPrice,
        });
      });

      if (groupErrors.length > 0) {
        result.failed_projects.push({
          project_code: project.project_code || projectCode,
          message: groupErrors.slice(0, 2).join(' | '),
        });
        continue;
      }

      const projectIdKey = String(project.id);
      const mergedByProduct = new Map<string, { product_id: number; quantity: number; unit_price: number }>(
        existingItemsByProject.get(projectIdKey) || new Map()
      );
      incomingByProduct.forEach((value, key) => {
        mergedByProduct.set(key, value);
      });

      try {
        await updateProject(project.id, {
          sync_items: true,
          items: Array.from(mergedByProduct.values()),
        } as unknown as Partial<Project> & Record<string, unknown>);

        existingItemsByProject.set(projectIdKey, mergedByProduct);
        result.success_projects.push({
          project_code: project.project_code || projectCode,
          applied_count: incomingByProduct.size,
        });
        hasSuccess = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không thể cập nhật hạng mục dự án.';
        result.failed_projects.push({
          project_code: project.project_code || projectCode,
          message,
        });
      }
    }

    if (hasSuccess) {
      const [projectRows, itemRows] = await Promise.all([fetchProjects(), fetchProjectItems()]);
      setProjects(projectRows || []);
      setProjectItems(itemRows || []);
      void loadProjectsPage();
    }

    return result;
  }, [projects, projectItems, loadProjectsPage]);

  const handleImportProjectRaciBatch = useCallback(async (
    groups: ProjectRaciImportBatchGroup[]
  ): Promise<ProjectRaciImportBatchResult> => {
    const result: ProjectRaciImportBatchResult = {
      success_projects: [],
      failed_projects: [],
    };

    if (!Array.isArray(groups) || groups.length === 0) {
      return result;
    }

    const projectByCode = new Map<string, Project>();
    (projects || []).forEach((project) => {
      const token = normalizeImportToken(project.project_code);
      if (!token || projectByCode.has(token)) {
        return;
      }
      projectByCode.set(token, project);
    });

    const projectItemById = new Map<string, ProjectItemMaster>();
    (projectItems || []).forEach((item) => {
      const key = String(item.id ?? '').trim();
      if (!key || projectItemById.has(key)) {
        return;
      }
      projectItemById.set(key, item);
    });

    const candidateProjectIds = groups
      .map((group) => {
        const codeToken = normalizeImportToken(group?.project_code);
        if (!codeToken) {
          return null;
        }
        return projectByCode.get(codeToken)?.id || null;
      })
      .filter((value): value is string | number => value !== null);

    const existingRaciRows = candidateProjectIds.length > 0
      ? await fetchProjectRaciAssignments(candidateProjectIds)
      : [];
    const existingRaciByProject = new Map<string, Map<string, { user_id: number; raci_role: 'R' | 'A' | 'C' | 'I' }>>();
    (existingRaciRows || []).forEach((row) => {
      const projectId = String(row.project_id || '');
      const userId = Number(row.user_id);
      const role = String(row.raci_role || '').trim().toUpperCase() as 'R' | 'A' | 'C' | 'I';
      if (!projectId || !Number.isFinite(userId) || userId <= 0 || !['R', 'A', 'C', 'I'].includes(role)) {
        return;
      }
      const identity = `${userId}|${role}`;
      const byIdentity = existingRaciByProject.get(projectId) || new Map<string, { user_id: number; raci_role: 'R' | 'A' | 'C' | 'I' }>();
      if (!byIdentity.has(identity)) {
        byIdentity.set(identity, { user_id: userId, raci_role: role });
      }
      existingRaciByProject.set(projectId, byIdentity);
    });

    let hasSuccess = false;
    for (const group of groups) {
      const projectCode = String(group?.project_code || '').trim();
      const projectToken = normalizeImportToken(projectCode);
      if (!projectToken) {
        result.failed_projects.push({
          project_code: projectCode || '(trống)',
          message: 'Thiếu Mã dự án trong dữ liệu import.',
        });
        continue;
      }

      const project = projectByCode.get(projectToken);
      if (!project) {
        result.failed_projects.push({
          project_code: projectCode,
          message: 'Không tìm thấy dự án theo Mã dự án trong hệ thống.',
        });
        continue;
      }

      const incomingByIdentity = new Map<string, { user_id: number; raci_role: 'R' | 'A' | 'C' | 'I' }>();
      const sourceRows = Array.isArray(group.raci) ? group.raci : [];
      const groupErrors: string[] = [];
      sourceRows.forEach((entry, index) => {
        const projectItemId = String(entry?.project_item_id ?? '').trim();
        const userId = Number(entry?.user_id);
        const role = String(entry?.raci_role || '').trim().toUpperCase() as 'R' | 'A' | 'C' | 'I';
        if (!projectItemId) {
          groupErrors.push(`Dòng ${index + 1}: thiếu Mã hạng mục dự án.`);
          return;
        }
        const projectItem = projectItemById.get(projectItemId);
        if (!projectItem) {
          groupErrors.push(`Dòng ${index + 1}: không tìm thấy Mã hạng mục dự án "${projectItemId}" trong hệ thống.`);
          return;
        }
        const importedItemProjectId = String(projectItem.project_id ?? '').trim();
        const importedItemProjectCodeToken = normalizeImportToken(projectItem.project_code);
        const targetProjectId = String(project.id ?? '').trim();
        const targetProjectCodeToken = normalizeImportToken(project.project_code);
        const belongsToProject =
          (importedItemProjectId && targetProjectId && importedItemProjectId === targetProjectId) ||
          (importedItemProjectCodeToken && targetProjectCodeToken && importedItemProjectCodeToken === targetProjectCodeToken);
        if (!belongsToProject) {
          groupErrors.push(
            `Dòng ${index + 1}: Mã hạng mục dự án "${projectItemId}" không thuộc dự án "${project.project_code}".`
          );
          return;
        }
        if (!Number.isFinite(userId) || userId <= 0) {
          groupErrors.push(`Dòng ${index + 1}: nhân sự không hợp lệ.`);
          return;
        }
        if (!['R', 'A', 'C', 'I'].includes(role)) {
          groupErrors.push(`Dòng ${index + 1}: vai trò RACI không hợp lệ.`);
          return;
        }
        incomingByIdentity.set(`${userId}|${role}`, { user_id: userId, raci_role: role });
      });

      if (groupErrors.length > 0) {
        result.failed_projects.push({
          project_code: project.project_code || projectCode,
          message: groupErrors.slice(0, 2).join(' | '),
        });
        continue;
      }

      const projectIdKey = String(project.id);
      const mergedByIdentity = new Map<string, { user_id: number; raci_role: 'R' | 'A' | 'C' | 'I' }>(
        existingRaciByProject.get(projectIdKey) || new Map()
      );
      incomingByIdentity.forEach((value, key) => {
        mergedByIdentity.set(key, value);
      });

      try {
        await updateProject(project.id, {
          sync_raci: true,
          raci: Array.from(mergedByIdentity.values()),
        } as unknown as Partial<Project> & Record<string, unknown>);

        existingRaciByProject.set(projectIdKey, mergedByIdentity);
        result.success_projects.push({
          project_code: project.project_code || projectCode,
          applied_count: incomingByIdentity.size,
        });
        hasSuccess = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không thể cập nhật đội ngũ dự án.';
        result.failed_projects.push({
          project_code: project.project_code || projectCode,
          message,
        });
      }
    }

    if (hasSuccess) {
      const [projectRows, itemRows] = await Promise.all([fetchProjects(), fetchProjectItems()]);
      setProjects(projectRows || []);
      setProjectItems(itemRows || []);
      void loadProjectsPage();
    }

    return result;
  }, [projects, projectItems, loadProjectsPage]);

  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    try {
      await deleteProject(selectedProject.id);
      setProjects((projects || []).filter(p => String(p.id) !== String(selectedProject.id)));
      addToast('success', 'Thành công', 'Đã xóa dự án.');
      handleCloseModal();
      void loadProjectsPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa dự án trên cơ sở dữ liệu. ${message}`);
    }
  };

  const handleCreateContractFromProject = (project: Project) => {
    if (!hasPermission(authUser, 'contracts.write')) {
      addToast('error', 'Không đủ quyền', 'Bạn không có quyền tạo hợp đồng mới.');
      return;
    }

    const projectValue = (projectItems || [])
      .filter((item) => String(item.project_id) === String(project.id))
      .reduce((sum, item) => {
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.unit_price || 0);
        return sum + (Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0);
      }, 0);

    const prefillContract: Partial<Contract> = {
      customer_id: project.customer_id,
      project_id: project.id,
      contract_name: `HĐ - ${project.project_name}`,
      value: Math.max(0, projectValue),
      status: 'DRAFT',
      payment_cycle: 'ONCE',
    };

    setSelectedContract(null);
    setContractAddPrefill(prefillContract);
    setModalType('ADD_CONTRACT');
  };

  // --- Project Procedure (Checklist) ---
  const [procedureProject, setProcedureProject] = useState<Project | null>(null);

  const handleOpenProcedure = (project: Project) => {
    setProcedureProject(project);
  };

  // --- Contract Handlers ---
  type GeneratePaymentOptions = GenerateContractPaymentsPayload;

  type GeneratePaymentResult = Awaited<ReturnType<typeof generateContractPayments>>;

  const replaceSchedulesByContract = (contractId: string | number, schedules: PaymentSchedule[]) => {
    setPaymentSchedules((prev) => [
      ...(prev || []).filter((item) => String(item.contract_id) !== String(contractId)),
      ...(schedules || []),
    ]);
  };

  const handleRefreshSchedules = async (contractId: string | number) => {
    if (!hasPermission(authUser, 'contracts.read')) {
      throw new Error('Bạn không có quyền xem kế hoạch thanh toán.');
    }

    setIsPaymentScheduleLoading(true);
    try {
      const rows = await fetchPaymentSchedules(contractId);
      replaceSchedulesByContract(contractId, rows);
    } finally {
      setIsPaymentScheduleLoading(false);
    }
  };

  const handleGenerateSchedules = async (
    contractId: string | number,
    options?: { silent?: boolean; generateOptions?: GeneratePaymentOptions }
  ): Promise<GeneratePaymentResult> => {
    if (!hasPermission(authUser, 'contracts.payments')) {
      throw new Error('Bạn không có quyền sinh kế hoạch thanh toán.');
    }

    setIsPaymentScheduleLoading(true);
    try {
      const generatedResult = await generateContractPayments(contractId, options?.generateOptions);
      replaceSchedulesByContract(contractId, generatedResult.data);
      if (!options?.silent) {
        const metadata = generatedResult.meta;
        const generatedCount = metadata?.generated_count ?? generatedResult.data.length;
        const allocationModeLabel = metadata?.allocation_mode === 'MILESTONE'
          ? 'Mốc nghiệm thu'
          : 'Chia đều';
        addToast('success', 'Thành công', `Đã đồng bộ ${generatedCount} kỳ thanh toán (${allocationModeLabel}).`);
      }
      return generatedResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      if (!options?.silent) {
        addToast('error', 'Sinh dòng tiền thất bại', `Không thể sinh kỳ thanh toán tự động. ${message}`);
      }
      throw error;
    } finally {
      setIsPaymentScheduleLoading(false);
    }
  };

  const handleConfirmPaymentSchedule = async (
    scheduleId: string | number,
    payload: PaymentScheduleConfirmationPayload
  ) => {
    if (!hasPermission(authUser, 'contracts.payments')) {
      const error = new Error('Bạn không có quyền cập nhật thanh toán.');
      addToast('error', 'Không đủ quyền', error.message);
      throw error;
    }

    try {
      const updated = await updatePaymentSchedule(scheduleId, payload);
      setPaymentSchedules((prev) =>
        (prev || []).map((item) =>
          String(item.id) === String(updated.id)
            ? updated
            : item
        )
      );
      addToast('success', 'Thành công', 'Đã xác nhận thu tiền cho kỳ thanh toán.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Cập nhật thất bại', `Không thể xác nhận thu tiền. ${message}`);
      throw error;
    }
  };

  const handleSaveContract = async (data: Partial<Contract>) => {
    setIsSaving(true);
    try {
      const payload = data as Partial<Contract> & Record<string, unknown>;
      if (modalType === 'ADD_CONTRACT') {
        const created = await createContract(payload);
        setContracts([created, ...contracts]);
        if (created.status === 'SIGNED') {
          try {
            await handleGenerateSchedules(created.id, { silent: true });
            addToast('success', 'Dòng tiền', 'Đã tự động sinh kỳ thanh toán sau khi hợp đồng chuyển Đã ký.');
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi không xác định';
            addToast('error', 'Dòng tiền', `Hợp đồng đã lưu nhưng chưa sinh được kỳ thanh toán tự động. ${message}`);
          }
        }
        addToast('success', 'Thành công', 'Thêm mới hợp đồng thành công!');
      } else if (modalType === 'EDIT_CONTRACT' && selectedContract) {
        const previousStatus = selectedContract.status;
        const updated = await updateContract(selectedContract.id, payload);
        setContracts(
          (contracts || []).map(c =>
            String(c.id) === String(updated.id)
              ? updated
              : c
          )
        );
        if (updated.status === 'SIGNED' && previousStatus !== 'SIGNED') {
          try {
            await handleGenerateSchedules(updated.id, { silent: true });
            addToast('success', 'Dòng tiền', 'Đã tự động sinh kỳ thanh toán sau khi hợp đồng chuyển Đã ký.');
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi không xác định';
            addToast('error', 'Dòng tiền', `Hợp đồng đã cập nhật nhưng chưa sinh được kỳ thanh toán tự động. ${message}`);
          }
        }
        addToast('success', 'Thành công', 'Cập nhật hợp đồng thành công!');
      }
      handleCloseModal();
      void loadContractsPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu thất bại', `Không thể lưu hợp đồng vào cơ sở dữ liệu. ${message}`);
      setIsSaving(false);
    }
  };

  const handleDeleteContract = async () => {
    if (!selectedContract) return;
    try {
      await deleteContract(selectedContract.id);
      setContracts((contracts || []).filter(c => String(c.id) !== String(selectedContract.id)));
      addToast('success', 'Thành công', 'Đã xóa hợp đồng.');
      handleCloseModal();
      void loadContractsPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa hợp đồng trên cơ sở dữ liệu. ${message}`);
    }
  };

  // --- Document Handlers ---
  const handleSaveDocument = async (data: Partial<Document>) => {
    setIsSaving(true);
    try {
      if (modalType === 'ADD_DOCUMENT') {
        const created = await createDocument({ ...data, scope: 'DEFAULT' });
        setDocuments((prev) => [created, ...(prev || [])]);
        addToast('success', 'Thành công', 'Thêm mới hồ sơ tài liệu thành công!');
      } else if (modalType === 'UPLOAD_PRODUCT_DOCUMENT') {
        const created = await createDocument({ ...data, scope: 'PRODUCT_PRICING' });
        setDocuments((prev) => [created, ...(prev || [])]);
        addToast('success', 'Thành công', 'Đã lưu tài liệu minh chứng giá sản phẩm.');
      } else if (modalType === 'EDIT_DOCUMENT' && selectedDocument) {
        const updated = await updateDocument(selectedDocument.id, { ...data, scope: 'DEFAULT' });
        setDocuments((prev) =>
          (prev || []).map((document) =>
            String(document.id) === String(selectedDocument.id) ? updated : document
          )
        );
        addToast('success', 'Thành công', 'Cập nhật hồ sơ tài liệu thành công!');
      }
      handleCloseModal();
      void loadDocumentsPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu thất bại', `Không thể lưu hồ sơ tài liệu vào cơ sở dữ liệu. ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!selectedDocument) return;
    setIsSaving(true);
    try {
      await deleteDocument(selectedDocument.id);
      setDocuments((prev) =>
        (prev || []).filter((document) => String(document.id) !== String(selectedDocument.id))
      );
      addToast('success', 'Thành công', 'Đã xóa hồ sơ tài liệu.');
      handleCloseModal();
      void loadDocumentsPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa hồ sơ tài liệu. ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Reminder Handlers ---
  const handleSaveReminder = async (data: Partial<Reminder>) => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const newItem: Reminder = {
        id: data.id || `REM${Date.now()}`,
        title: data.title!,
        content: data.content || '',
        remindDate: data.remindDate!,
        assignedToUserId: data.assignedToUserId!,
        createdDate: data.createdDate || new Date().toLocaleDateString('vi-VN'),
    };

    if (modalType === 'ADD_REMINDER') {
        setReminders([newItem, ...reminders]);
        addToast('success', 'Thành công', 'Thêm mới nhắc việc thành công!');
    } else if (modalType === 'EDIT_REMINDER') {
        setReminders(reminders.map(r => r.id === selectedReminder?.id ? { ...newItem, id: selectedReminder.id } : r));
        addToast('success', 'Thành công', 'Cập nhật nhắc việc thành công!');
    }
    setIsSaving(false);
    handleCloseModal();
  };

  const handleDeleteReminder = async () => {
    if (!selectedReminder) return;
    await new Promise(resolve => setTimeout(resolve, 800));
    setReminders((reminders || []).filter(r => r.id !== selectedReminder.id));
    addToast('success', 'Thành công', 'Đã xóa nhắc việc.');
    handleCloseModal();
  };

  // --- User Dept History Handlers ---
  const handleSaveUserDeptHistory = async (data: Partial<UserDeptHistory>) => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const nextTransferNumericId = (() => {
      const currentMax = (userDeptHistory || []).reduce((max, item) => {
        const parsed = Number(String(item.id ?? '').replace(/\D+/g, ''));
        return Number.isFinite(parsed) && parsed > max ? parsed : max;
      }, 0);
      return String(currentMax + 1);
    })();

    const newItem: UserDeptHistory = {
        id: modalType === 'ADD_USER_DEPT_HISTORY'
          ? nextTransferNumericId
          : String(data.id || selectedUserDeptHistory?.id || ''),
        userId: String(data.userId || ''),
        fromDeptId: String(data.fromDeptId || ''),
        toDeptId: String(data.toDeptId || ''),
        transferDate: data.transferDate!,
        reason: data.reason || '',
        createdDate: data.createdDate || new Date().toLocaleDateString('vi-VN'),
    };

    if (modalType === 'ADD_USER_DEPT_HISTORY') {
        setUserDeptHistory([newItem, ...userDeptHistory]);
        
        // --- LOGIC NGHIỆP VỤ QUAN TRỌNG ---
        // Cập nhật phòng ban mới cho nhân sự
        setEmployees(prev => prev.map(emp => {
            if (String(emp.id) === String(newItem.userId)) {
                const targetDept = departments.find(d => d.dept_name === newItem.toDeptId || String(d.id) === String(newItem.toDeptId));
                return { ...emp, department_id: targetDept?.id || emp.department_id };
            }
            return emp;
        }));
        
        addToast('success', 'Thành công', 'Thêm mới luân chuyển và cập nhật nhân sự thành công!');
    } else if (modalType === 'EDIT_USER_DEPT_HISTORY') {
        setUserDeptHistory(userDeptHistory.map(h => h.id === selectedUserDeptHistory?.id ? { ...newItem, id: selectedUserDeptHistory.id } : h));
        addToast('success', 'Thành công', 'Cập nhật lịch sử luân chuyển thành công!');
    }
    setIsSaving(false);
    handleCloseModal();
  };

  const handleDeleteUserDeptHistory = async () => {
    if (!selectedUserDeptHistory) return;
    await new Promise(resolve => setTimeout(resolve, 800));
    setUserDeptHistory((userDeptHistory || []).filter(h => h.id !== selectedUserDeptHistory.id));
    addToast('success', 'Thành công', 'Đã xóa lịch sử luân chuyển.');
    handleCloseModal();
  };

  const handleCreateSupportServiceGroup = async (
    data: Partial<SupportServiceGroup>,
    options?: { silent?: boolean }
  ): Promise<SupportServiceGroup> => {
    if (!hasPermission(authUser, 'support_service_groups.write')) {
      const error = new Error('Bạn không có quyền tạo nhóm Zalo/Telegram yêu cầu.');
      if (!options?.silent) {
        addToast('error', 'Không đủ quyền', error.message);
      }
      throw error;
    }

    try {
      const created = await createSupportServiceGroup(data);
      setSupportServiceGroups((prev) => [created, ...(prev || [])]);
      if (!options?.silent) {
        addToast('success', 'Thành công', 'Đã tạo nhóm Zalo/Telegram yêu cầu.');
      }
      return created;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      if (!options?.silent) {
        addToast('error', 'Tạo nhóm thất bại', `Không thể tạo nhóm Zalo/Telegram yêu cầu. ${message}`);
      }
      throw error;
    }
  };

  const handleCreateSupportServiceGroupsBulk = async (
    items: Array<Partial<SupportServiceGroup>>,
    options?: { silent?: boolean }
  ): Promise<BulkMutationResult<SupportServiceGroup>> => {
    if (!hasPermission(authUser, 'support_service_groups.write')) {
      const error = new Error('Bạn không có quyền tạo nhóm Zalo/Telegram yêu cầu.');
      if (!options?.silent) {
        addToast('error', 'Không đủ quyền', error.message);
      }
      throw error;
    }

    try {
      const result = await createSupportServiceGroupsBulk(items);
      const createdItems = result.created || [];
      if (createdItems.length > 0) {
        setSupportServiceGroups((prev) => {
          const current = prev || [];
          const existingIds = new Set(current.map((group) => String(group.id)));
          const nextCreated = createdItems.filter((group) => !existingIds.has(String(group.id)));
          return [...nextCreated, ...current];
        });
      }

      if (!options?.silent) {
        if ((result.failed_count || 0) === 0) {
          addToast('success', 'Thành công', `Đã tạo ${result.created_count || createdItems.length} nhóm Zalo/Telegram yêu cầu.`);
        } else {
          addToast(
            'error',
            'Tạo nhóm một phần',
            `Đã tạo ${result.created_count || createdItems.length} nhóm, lỗi ${result.failed_count || 0} dòng.`
          );
        }
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      if (!options?.silent) {
        addToast('error', 'Tạo nhóm thất bại', `Không thể tạo nhóm Zalo/Telegram yêu cầu. ${message}`);
      }
      throw error;
    }
  };

  const handleUpdateSupportServiceGroup = async (
    id: string | number,
    data: Partial<SupportServiceGroup>,
    options?: { silent?: boolean }
  ): Promise<SupportServiceGroup> => {
    if (!hasPermission(authUser, 'support_service_groups.write')) {
      const error = new Error('Bạn không có quyền cập nhật nhóm Zalo/Telegram yêu cầu.');
      if (!options?.silent) {
        addToast('error', 'Không đủ quyền', error.message);
      }
      throw error;
    }

    try {
      const updated = await updateSupportServiceGroup(id, data);
      setSupportServiceGroups((prev) =>
        (prev || []).map((item) => (String(item.id) === String(updated.id) ? { ...item, ...updated } : item))
      );
      if (!options?.silent) {
        addToast('success', 'Thành công', 'Đã cập nhật nhóm Zalo/Telegram yêu cầu.');
      }
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      if (!options?.silent) {
        addToast('error', 'Cập nhật nhóm thất bại', `Không thể cập nhật nhóm Zalo/Telegram yêu cầu. ${message}`);
      }
      throw error;
    }
  };

  const handleCreateSupportContactPosition = async (
    data: Partial<SupportContactPosition>,
    options?: { silent?: boolean }
  ): Promise<SupportContactPosition> => {
    if (!hasPermission(authUser, 'support_contact_positions.write')) {
      const error = new Error('Bạn không có quyền tạo chức vụ liên hệ.');
      if (!options?.silent) {
        addToast('error', 'Không đủ quyền', error.message);
      }
      throw error;
    }

    try {
      const created = await createSupportContactPosition(data);
      setSupportContactPositions((prev) => [created, ...(prev || [])]);
      if (!options?.silent) {
        addToast('success', 'Thành công', 'Đã tạo chức vụ liên hệ.');
      }
      return created;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      if (!options?.silent) {
        addToast('error', 'Tạo chức vụ thất bại', `Không thể tạo chức vụ liên hệ. ${message}`);
      }
      throw error;
    }
  };

  const handleCreateSupportContactPositionsBulk = async (
    items: Array<Partial<SupportContactPosition>>,
    options?: { silent?: boolean }
  ): Promise<BulkMutationResult<SupportContactPosition>> => {
    if (!hasPermission(authUser, 'support_contact_positions.write')) {
      const error = new Error('Bạn không có quyền tạo chức vụ liên hệ.');
      if (!options?.silent) {
        addToast('error', 'Không đủ quyền', error.message);
      }
      throw error;
    }

    try {
      const result = await createSupportContactPositionsBulk(items);
      const createdItems = result.created || [];
      if (createdItems.length > 0) {
        setSupportContactPositions((prev) => {
          const current = prev || [];
          const existingIds = new Set(current.map((position) => String(position.id)));
          const nextCreated = createdItems.filter((position) => !existingIds.has(String(position.id)));
          return [...nextCreated, ...current];
        });
      }

      if (!options?.silent) {
        if ((result.failed_count || 0) === 0) {
          addToast('success', 'Thành công', `Đã tạo ${result.created_count || createdItems.length} chức vụ liên hệ.`);
        } else {
          addToast(
            'error',
            'Tạo chức vụ một phần',
            `Đã tạo ${result.created_count || createdItems.length} chức vụ, lỗi ${result.failed_count || 0} dòng.`
          );
        }
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      if (!options?.silent) {
        addToast('error', 'Tạo chức vụ thất bại', `Không thể tạo chức vụ liên hệ. ${message}`);
      }
      throw error;
    }
  };

  const handleUpdateSupportContactPosition = async (
    id: string | number,
    data: Partial<SupportContactPosition>,
    options?: { silent?: boolean }
  ): Promise<SupportContactPosition> => {
    if (!hasPermission(authUser, 'support_contact_positions.write')) {
      const error = new Error('Bạn không có quyền cập nhật chức vụ liên hệ.');
      if (!options?.silent) {
        addToast('error', 'Không đủ quyền', error.message);
      }
      throw error;
    }

    try {
      const updated = await updateSupportContactPosition(id, data);
      setSupportContactPositions((prev) =>
        (prev || []).map((item) => (String(item.id) === String(updated.id) ? { ...item, ...updated } : item))
      );
      if (!options?.silent) {
        addToast('success', 'Thành công', 'Đã cập nhật chức vụ liên hệ.');
      }
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      if (!options?.silent) {
        addToast('error', 'Cập nhật chức vụ thất bại', `Không thể cập nhật chức vụ liên hệ. ${message}`);
      }
      throw error;
    }
  };

  const handleCreateSupportRequestStatus = async (
    data: Partial<SupportRequestStatusOption>,
    options?: { silent?: boolean }
  ): Promise<SupportRequestStatusOption> => {
    if (!hasPermission(authUser, 'support_requests.write')) {
      const error = new Error('Bạn không có quyền tạo trạng thái yêu cầu hỗ trợ.');
      if (!options?.silent) {
        addToast('error', 'Không đủ quyền', error.message);
      }
      throw error;
    }

    try {
      const created = await createSupportRequestStatus(data);
      setSupportRequestStatuses((prev) => [created, ...(prev || [])]);
      if (!options?.silent) {
        addToast('success', 'Thành công', 'Đã tạo trạng thái yêu cầu hỗ trợ.');
      }
      return created;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      if (!options?.silent) {
        addToast('error', 'Tạo trạng thái thất bại', `Không thể tạo trạng thái yêu cầu hỗ trợ. ${message}`);
      }
      throw error;
    }
  };

  const handleCreateSupportRequestStatusesBulk = async (
    items: Array<Partial<SupportRequestStatusOption>>,
    options?: { silent?: boolean }
  ): Promise<BulkMutationResult<SupportRequestStatusOption>> => {
    if (!hasPermission(authUser, 'support_requests.write')) {
      const error = new Error('Bạn không có quyền tạo trạng thái yêu cầu hỗ trợ.');
      if (!options?.silent) {
        addToast('error', 'Không đủ quyền', error.message);
      }
      throw error;
    }

    try {
      const result = await createSupportRequestStatusesBulk(items);
      const createdItems = result.created || [];
      if (createdItems.length > 0) {
        setSupportRequestStatuses((prev) => {
          const current = prev || [];
          const existingCodes = new Set(current.map((status) => String(status.status_code || '').toUpperCase()));
          const nextCreated = createdItems.filter((status) => !existingCodes.has(String(status.status_code || '').toUpperCase()));
          return [...nextCreated, ...current];
        });
      }

      if (!options?.silent) {
        if ((result.failed_count || 0) === 0) {
          addToast('success', 'Thành công', `Đã tạo ${result.created_count || createdItems.length} trạng thái yêu cầu hỗ trợ.`);
        } else {
          addToast(
            'error',
            'Tạo trạng thái một phần',
            `Đã tạo ${result.created_count || createdItems.length} trạng thái, lỗi ${result.failed_count || 0} dòng.`
          );
        }
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      if (!options?.silent) {
        addToast('error', 'Tạo trạng thái thất bại', `Không thể tạo trạng thái yêu cầu hỗ trợ. ${message}`);
      }
      throw error;
    }
  };

  const handleUpdateSupportRequestStatusDefinition = async (
    id: string | number,
    data: Partial<SupportRequestStatusOption>,
    options?: { silent?: boolean }
  ): Promise<SupportRequestStatusOption> => {
    if (!hasPermission(authUser, 'support_requests.write')) {
      const error = new Error('Bạn không có quyền cập nhật trạng thái yêu cầu hỗ trợ.');
      if (!options?.silent) {
        addToast('error', 'Không đủ quyền', error.message);
      }
      throw error;
    }

    try {
      const updated = await updateSupportRequestStatusDefinition(id, data);
      setSupportRequestStatuses((prev) =>
        (prev || []).map((item) => (String(item.id) === String(updated.id) ? { ...item, ...updated } : item))
      );
      if (!options?.silent) {
        addToast('success', 'Thành công', 'Đã cập nhật trạng thái yêu cầu hỗ trợ.');
      }
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      if (!options?.silent) {
        addToast('error', 'Cập nhật trạng thái thất bại', `Không thể cập nhật trạng thái yêu cầu hỗ trợ. ${message}`);
      }
      throw error;
    }
  };

  const handleCreateOpportunityStage = async (
    data: Partial<OpportunityStageOption>,
    options?: { silent?: boolean }
  ): Promise<OpportunityStageOption> => {
    if (!hasPermission(authUser, 'opportunities.write')) {
      const error = new Error('Bạn không có quyền tạo giai đoạn cơ hội.');
      if (!options?.silent) {
        addToast('error', 'Không đủ quyền', error.message);
      }
      throw error;
    }

    try {
      const created = await createOpportunityStage(data);
      setOpportunityStages((prev) => [created, ...(prev || [])]);
      if (!options?.silent) {
        addToast('success', 'Thành công', 'Đã tạo giai đoạn cơ hội.');
      }
      return created;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      if (!options?.silent) {
        addToast('error', 'Tạo giai đoạn thất bại', `Không thể tạo giai đoạn cơ hội. ${message}`);
      }
      throw error;
    }
  };

  const handleUpdateOpportunityStage = async (
    id: string | number,
    data: Partial<OpportunityStageOption>,
    options?: { silent?: boolean }
  ): Promise<OpportunityStageOption> => {
    if (!hasPermission(authUser, 'opportunities.write')) {
      const error = new Error('Bạn không có quyền cập nhật giai đoạn cơ hội.');
      if (!options?.silent) {
        addToast('error', 'Không đủ quyền', error.message);
      }
      throw error;
    }

    try {
      const updated = await updateOpportunityStage(id, data);
      setOpportunityStages((prev) =>
        (prev || []).map((item) => (String(item.id) === String(updated.id) ? { ...item, ...updated } : item))
      );
      if (!options?.silent) {
        addToast('success', 'Thành công', 'Đã cập nhật giai đoạn cơ hội.');
      }
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      if (!options?.silent) {
        addToast('error', 'Cập nhật giai đoạn thất bại', `Không thể cập nhật giai đoạn cơ hội. ${message}`);
      }
      throw error;
    }
  };

  const handleCreateProjectType = async (
    data: Partial<ProjectTypeOption>,
    options?: { silent?: boolean }
  ): Promise<ProjectTypeOption> => {
    if (!hasPermission(authUser, 'projects.write')) {
      const error = new Error('Bạn không có quyền tạo loại dự án.');
      if (!options?.silent) {
        addToast('error', 'Không đủ quyền', error.message);
      }
      throw error;
    }

    try {
      const created = await createProjectType(data);
      setProjectTypes((prev) => [created, ...(prev || [])]);
      if (!options?.silent) {
        addToast('success', 'Thành công', 'Đã tạo loại dự án.');
      }
      return created;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      if (!options?.silent) {
        addToast('error', 'Tạo loại dự án thất bại', `Không thể tạo loại dự án. ${message}`);
      }
      throw error;
    }
  };

  const handleUpdateProjectType = async (
    id: string | number,
    data: Partial<ProjectTypeOption>,
    options?: { silent?: boolean }
  ): Promise<ProjectTypeOption> => {
    if (!hasPermission(authUser, 'projects.write')) {
      const error = new Error('Bạn không có quyền cập nhật loại dự án.');
      if (!options?.silent) {
        addToast('error', 'Không đủ quyền', error.message);
      }
      throw error;
    }

    try {
      const updated = await updateProjectType(id, data);
      setProjectTypes((prev) =>
        (prev || []).map((item) => (String(item.id) === String(updated.id) ? { ...item, ...updated } : item))
      );
      if (!options?.silent) {
        addToast('success', 'Thành công', 'Đã cập nhật loại dự án.');
      }
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      if (!options?.silent) {
        addToast('error', 'Cập nhật loại dự án thất bại', `Không thể cập nhật loại dự án. ${message}`);
      }
      throw error;
    }
  };

  const handleCreateWorklogActivityType = async (
    data: Partial<WorklogActivityTypeOption>,
    options?: { silent?: boolean }
  ): Promise<WorklogActivityTypeOption> => {
    if (!hasPermission(authUser, 'support_requests.write')) {
      const error = new Error('Bạn không có quyền tạo loại công việc worklog.');
      if (!options?.silent) {
        addToast('error', 'Không đủ quyền', error.message);
      }
      throw error;
    }

    try {
      const created = await createWorklogActivityType(data);
      setWorklogActivityTypes((prev) => [created, ...(prev || [])]);
      if (!options?.silent) {
        addToast('success', 'Thành công', 'Đã tạo loại công việc worklog.');
      }
      return created;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      if (!options?.silent) {
        addToast('error', 'Tạo loại công việc thất bại', `Không thể tạo loại công việc worklog. ${message}`);
      }
      throw error;
    }
  };

  const handleUpdateWorklogActivityType = async (
    id: string | number,
    data: Partial<WorklogActivityTypeOption>,
    options?: { silent?: boolean }
  ): Promise<WorklogActivityTypeOption> => {
    if (!hasPermission(authUser, 'support_requests.write')) {
      const error = new Error('Bạn không có quyền cập nhật loại công việc worklog.');
      if (!options?.silent) {
        addToast('error', 'Không đủ quyền', error.message);
      }
      throw error;
    }

    try {
      const updated = await updateWorklogActivityType(id, data);
      setWorklogActivityTypes((prev) =>
        (prev || []).map((item) => (String(item.id) === String(updated.id) ? { ...item, ...updated } : item))
      );
      if (!options?.silent) {
        addToast('success', 'Thành công', 'Đã cập nhật loại công việc worklog.');
      }
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      if (!options?.silent) {
        addToast('error', 'Cập nhật loại công việc thất bại', `Không thể cập nhật loại công việc worklog. ${message}`);
      }
      throw error;
    }
  };

  const handleCreateSupportSlaConfig = async (
    data: Partial<SupportSlaConfigOption>,
    options?: { silent?: boolean }
  ): Promise<SupportSlaConfigOption> => {
    if (!hasPermission(authUser, 'support_requests.write')) {
      const error = new Error('Bạn không có quyền tạo cấu hình SLA.');
      if (!options?.silent) {
        addToast('error', 'Không đủ quyền', error.message);
      }
      throw error;
    }

    try {
      const created = await createSupportSlaConfig(data);
      setSupportSlaConfigs((prev) => [created, ...(prev || [])]);
      if (!options?.silent) {
        addToast('success', 'Thành công', 'Đã tạo cấu hình SLA.');
      }
      return created;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      if (!options?.silent) {
        addToast('error', 'Tạo cấu hình SLA thất bại', `Không thể tạo cấu hình SLA. ${message}`);
      }
      throw error;
    }
  };

  const handleUpdateSupportSlaConfig = async (
    id: string | number,
    data: Partial<SupportSlaConfigOption>,
    options?: { silent?: boolean }
  ): Promise<SupportSlaConfigOption> => {
    if (!hasPermission(authUser, 'support_requests.write')) {
      const error = new Error('Bạn không có quyền cập nhật cấu hình SLA.');
      if (!options?.silent) {
        addToast('error', 'Không đủ quyền', error.message);
      }
      throw error;
    }

    try {
      const updated = await updateSupportSlaConfig(id, data);
      setSupportSlaConfigs((prev) =>
        (prev || []).map((item) => (String(item.id) === String(updated.id) ? { ...item, ...updated } : item))
      );
      if (!options?.silent) {
        addToast('success', 'Thành công', 'Đã cập nhật cấu hình SLA.');
      }
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      if (!options?.silent) {
        addToast('error', 'Cập nhật cấu hình SLA thất bại', `Không thể cập nhật cấu hình SLA. ${message}`);
      }
      throw error;
    }
  };

  const refreshAccessControlData = async () => {
    try {
      const [nextRoles, nextPermissions, nextUserAccess] = await Promise.all([
        fetchRoles(),
        fetchPermissions(),
        fetchUserAccess(),
      ]);
      setRoles(nextRoles || []);
      setPermissions(nextPermissions || []);
      setUserAccessRecords(nextUserAccess || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Tải dữ liệu phân quyền thất bại', message);
      throw error;
    }
  };

  const replaceUserAccessRecord = (updatedRecord: UserAccessRecord) => {
    setUserAccessRecords((prev) => {
      const next = (prev || []).map((item) =>
        Number(item.user.id) === Number(updatedRecord.user.id)
          ? updatedRecord
          : item
      );
      return next;
    });
  };

  const handleUpdateAccessRoles = async (userId: number, roleIds: number[]) => {
    try {
      const updated = await updateUserAccessRoles(userId, roleIds);
      replaceUserAccessRecord(updated);
      addToast('success', 'Thành công', 'Đã cập nhật vai trò người dùng.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Cập nhật vai trò thất bại', message);
      throw error;
    }
  };

  const handleBulkUpdateAccessRoles = async (
    updates: Array<{
      userId: number;
      roleIds: number[];
    }>
  ) => {
    const normalizedUpdates = updates
      .map((item) => ({
        userId: Number(item.userId || 0),
        roleIds: Array.from(
          new Set(
            (item.roleIds || [])
              .map((roleId) => Number(roleId || 0))
              .filter((roleId) => Number.isFinite(roleId) && roleId > 0)
          )
        ),
      }))
      .filter((item) => item.userId > 0 && item.roleIds.length > 0);

    if (normalizedUpdates.length === 0) {
      return;
    }

    const settled = await Promise.allSettled(
      normalizedUpdates.map(async (item) => {
        const updated = await updateUserAccessRoles(item.userId, item.roleIds);
        return {
          userId: item.userId,
          updated,
        };
      })
    );

    const updatedMap = new Map<number, UserAccessRecord>();
    const failedMessages: string[] = [];
    settled.forEach((result) => {
      if (result.status === 'fulfilled') {
        updatedMap.set(result.value.userId, result.value.updated);
        return;
      }
      const message = result.reason instanceof Error ? result.reason.message : 'Lỗi không xác định';
      failedMessages.push(message);
    });

    if (updatedMap.size > 0) {
      setUserAccessRecords((prev) =>
        (prev || []).map((record) => updatedMap.get(Number(record.user.id)) ?? record)
      );
    }

    if (updatedMap.size > 0) {
      addToast(
        'success',
        'Cập nhật vai trò hàng loạt thành công',
        failedMessages.length > 0
          ? `Đã cập nhật ${updatedMap.size}/${normalizedUpdates.length} người dùng.`
          : `Đã cập nhật ${updatedMap.size} người dùng.`
      );
    }

    if (failedMessages.length > 0) {
      const failedCount = failedMessages.length;
      addToast('error', 'Một phần cập nhật thất bại', `${failedCount} người dùng chưa cập nhật được.`);
    }

    if (updatedMap.size === 0) {
      throw new Error(failedMessages[0] || 'Cập nhật vai trò hàng loạt thất bại.');
    }
  };

  const handleBulkUpdateAccessPermissions = async (
    updates: Array<{
      userId: number;
      overrides: Array<{
        permission_id: number;
        type: 'GRANT' | 'DENY';
        reason?: string | null;
      }>;
    }>
  ) => {
    const normalizedUpdates = updates
      .map((item) => ({
        userId: Number(item.userId || 0),
        overrides: Array.from(
          new Map(
            (item.overrides || [])
              .map((override) => ({
                permission_id: Number(override.permission_id || 0),
                type: (override.type === 'DENY' ? 'DENY' : 'GRANT') as 'GRANT' | 'DENY',
                reason: override.reason || null,
              }))
              .filter((override) => Number.isFinite(override.permission_id) && override.permission_id > 0)
              .map((override) => [override.permission_id, override])
          ).values()
        ),
      }))
      .filter((item) => item.userId > 0 && item.overrides.length > 0);

    if (normalizedUpdates.length === 0) {
      return;
    }

    const settled = await Promise.allSettled(
      normalizedUpdates.map(async (item) => {
        const updated = await updateUserAccessPermissions(item.userId, item.overrides);
        return {
          userId: item.userId,
          updated,
        };
      })
    );

    const updatedMap = new Map<number, UserAccessRecord>();
    const failedMessages: string[] = [];
    settled.forEach((result) => {
      if (result.status === 'fulfilled') {
        updatedMap.set(result.value.userId, result.value.updated);
        return;
      }
      const message = result.reason instanceof Error ? result.reason.message : 'Lỗi không xác định';
      failedMessages.push(message);
    });

    if (updatedMap.size > 0) {
      setUserAccessRecords((prev) =>
        (prev || []).map((record) => updatedMap.get(Number(record.user.id)) ?? record)
      );
    }

    if (updatedMap.size > 0) {
      addToast(
        'success',
        'Cập nhật quyền hàng loạt thành công',
        failedMessages.length > 0
          ? `Đã cập nhật ${updatedMap.size}/${normalizedUpdates.length} người dùng.`
          : `Đã cập nhật ${updatedMap.size} người dùng.`
      );
    }

    if (failedMessages.length > 0) {
      addToast('error', 'Một phần cập nhật quyền thất bại', `${failedMessages.length} người dùng chưa cập nhật được.`);
    }

    if (updatedMap.size === 0) {
      throw new Error(failedMessages[0] || 'Cập nhật quyền hàng loạt thất bại.');
    }
  };

  const handleBulkUpdateAccessScopes = async (
    updates: Array<{
      userId: number;
      scopes: Array<{
        dept_id: number;
        scope_type: 'SELF_ONLY' | 'DEPT_ONLY' | 'DEPT_AND_CHILDREN' | 'ALL';
      }>;
    }>
  ) => {
    const normalizedUpdates = updates
      .map((item) => ({
        userId: Number(item.userId || 0),
        scopes: Array.from(
          new Map(
            (item.scopes || [])
              .map((scope) => ({
                dept_id: Number(scope.dept_id || 0),
                scope_type: scope.scope_type,
              }))
              .filter((scope) => Number.isFinite(scope.dept_id) && scope.dept_id > 0)
              .map((scope) => [scope.dept_id, scope])
          ).values()
        ),
      }))
      .filter((item) => item.userId > 0 && item.scopes.length > 0);

    if (normalizedUpdates.length === 0) {
      return;
    }

    const settled = await Promise.allSettled(
      normalizedUpdates.map(async (item) => {
        const updated = await updateUserAccessDeptScopes(item.userId, item.scopes);
        return {
          userId: item.userId,
          updated,
        };
      })
    );

    const updatedMap = new Map<number, UserAccessRecord>();
    const failedMessages: string[] = [];
    settled.forEach((result) => {
      if (result.status === 'fulfilled') {
        updatedMap.set(result.value.userId, result.value.updated);
        return;
      }
      const message = result.reason instanceof Error ? result.reason.message : 'Lỗi không xác định';
      failedMessages.push(message);
    });

    if (updatedMap.size > 0) {
      setUserAccessRecords((prev) =>
        (prev || []).map((record) => updatedMap.get(Number(record.user.id)) ?? record)
      );
    }

    if (updatedMap.size > 0) {
      addToast(
        'success',
        'Cập nhật scope hàng loạt thành công',
        failedMessages.length > 0
          ? `Đã cập nhật ${updatedMap.size}/${normalizedUpdates.length} người dùng.`
          : `Đã cập nhật ${updatedMap.size} người dùng.`
      );
    }

    if (failedMessages.length > 0) {
      addToast('error', 'Một phần cập nhật scope thất bại', `${failedMessages.length} người dùng chưa cập nhật được.`);
    }

    if (updatedMap.size === 0) {
      throw new Error(failedMessages[0] || 'Cập nhật scope hàng loạt thất bại.');
    }
  };

  const handleUpdateAccessPermissions = async (
    userId: number,
    overrides: Array<{
      permission_id: number;
      type: 'GRANT' | 'DENY';
      reason?: string | null;
      expires_at?: string | null;
    }>
  ) => {
    try {
      const updated = await updateUserAccessPermissions(userId, overrides);
      replaceUserAccessRecord(updated);
      addToast('success', 'Thành công', 'Đã cập nhật quyền override.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Cập nhật quyền thất bại', message);
      throw error;
    }
  };

  const handleUpdateAccessScopes = async (
    userId: number,
    scopes: Array<{
      dept_id: number;
      scope_type: 'SELF_ONLY' | 'DEPT_ONLY' | 'DEPT_AND_CHILDREN' | 'ALL';
    }>
  ) => {
    try {
      const updated = await updateUserAccessDeptScopes(userId, scopes);
      replaceUserAccessRecord(updated);
      addToast('success', 'Thành công', 'Đã cập nhật phạm vi dữ liệu.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Cập nhật phạm vi thất bại', message);
      throw error;
    }
  };

  const refreshBackblazeB2Settings = async () => {
    setIsBackblazeB2SettingsLoading(true);
    try {
      const data = await fetchBackblazeB2IntegrationSettings();
      setBackblazeB2Settings(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Tải cấu hình Backblaze thất bại', message);
    } finally {
      setIsBackblazeB2SettingsLoading(false);
    }
  };

  const refreshGoogleDriveSettings = async () => {
    setIsGoogleDriveSettingsLoading(true);
    try {
      const data = await fetchGoogleDriveIntegrationSettings();
      setGoogleDriveSettings(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Tải cấu hình thất bại', message);
    } finally {
      setIsGoogleDriveSettingsLoading(false);
    }
  };

  const refreshContractExpiryAlertSettings = async () => {
    setIsContractExpiryAlertSettingsLoading(true);
    try {
      const data = await fetchContractExpiryAlertSettings();
      setContractExpiryAlertSettings(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Tải cấu hình cảnh báo thất bại', message);
    } finally {
      setIsContractExpiryAlertSettingsLoading(false);
    }
  };

  const refreshContractPaymentAlertSettings = async () => {
    setIsContractPaymentAlertSettingsLoading(true);
    try {
      const data = await fetchContractPaymentAlertSettings();
      setContractPaymentAlertSettings(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Tải cấu hình cảnh báo thanh toán thất bại', message);
    } finally {
      setIsContractPaymentAlertSettingsLoading(false);
    }
  };

  const refreshIntegrationSettings = async () => {
    await Promise.all([
      refreshBackblazeB2Settings(),
      refreshGoogleDriveSettings(),
      refreshContractExpiryAlertSettings(),
      refreshContractPaymentAlertSettings(),
    ]);
  };

  const handleSaveBackblazeB2Settings = async (payload: BackblazeB2IntegrationSettingsUpdatePayload) => {
    setIsBackblazeB2SettingsSaving(true);
    try {
      const updated = await updateBackblazeB2IntegrationSettings(payload);
      setBackblazeB2Settings(updated);
      addToast('success', 'Thành công', 'Đã lưu cấu hình Backblaze B2.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu cấu hình thất bại', message);
    } finally {
      setIsBackblazeB2SettingsSaving(false);
    }
  };

  const handleSaveGoogleDriveSettings = async (payload: GoogleDriveIntegrationSettingsUpdatePayload) => {
    setIsGoogleDriveSettingsSaving(true);
    try {
      const updated = await updateGoogleDriveIntegrationSettings(payload);
      setGoogleDriveSettings(updated);
      addToast('success', 'Thành công', 'Đã lưu cấu hình Google Drive.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu cấu hình thất bại', message);
    } finally {
      setIsGoogleDriveSettingsSaving(false);
    }
  };

  const handleSaveContractExpiryAlertSettings = async (payload: ContractExpiryAlertSettingsUpdatePayload) => {
    setIsContractExpiryAlertSettingsSaving(true);
    try {
      const updated = await updateContractExpiryAlertSettings(payload);
      setContractExpiryAlertSettings(updated);
      addToast('success', 'Thành công', 'Đã lưu cấu hình cảnh báo hợp đồng sắp hết hiệu lực.');
      void loadContractsPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu cấu hình cảnh báo thất bại', message);
    } finally {
      setIsContractExpiryAlertSettingsSaving(false);
    }
  };

  const handleSaveContractPaymentAlertSettings = async (payload: ContractPaymentAlertSettingsUpdatePayload) => {
    setIsContractPaymentAlertSettingsSaving(true);
    try {
      const updated = await updateContractPaymentAlertSettings(payload);
      setContractPaymentAlertSettings(updated);
      addToast('success', 'Thành công', 'Đã lưu cấu hình cảnh báo hợp đồng sắp thanh toán.');
      void loadContractsPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu cấu hình cảnh báo thanh toán thất bại', message);
    } finally {
      setIsContractPaymentAlertSettingsSaving(false);
    }
  };

  const handleTestBackblazeB2Integration = async (payload: BackblazeB2IntegrationSettingsUpdatePayload) => {
    setIsBackblazeB2SettingsTesting(true);
    try {
      const result = await testBackblazeB2IntegrationSettings(payload);
      addToast('success', 'Kết nối Backblaze B2', result.message || 'Kết nối thành công.');
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Kiểm tra kết nối thất bại', message);
      throw error;
    } finally {
      setIsBackblazeB2SettingsTesting(false);
    }
  };

  const handleTestGoogleDriveIntegration = async (payload: GoogleDriveIntegrationSettingsUpdatePayload) => {
    setIsGoogleDriveSettingsTesting(true);
    try {
      const result = await testGoogleDriveIntegrationSettings(payload);
      addToast('success', 'Kết nối Google Drive', result.message || 'Kết nối thành công.');
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Kiểm tra kết nối thất bại', message);
      throw error;
    } finally {
      setIsGoogleDriveSettingsTesting(false);
    }
  };

  // --- Dashboard Stats ---
  const OPPORTUNITY_STAGE_ORDER_FALLBACK: OpportunityStage[] = ['NEW', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
  const PROJECT_STATUS_ORDER: ProjectStatus[] = ['TRIAL', 'ONGOING', 'WARRANTY', 'COMPLETED', 'CANCELLED'];

  const totalRevenue = (contracts || [])
    .filter((contract) => contract.status === 'SIGNED')
    .reduce((sum, contract) => sum + (contract.value || 0), 0);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
  const quarterEndMonth = quarterStartMonth + 2;

  const actualRevenue = (paymentSchedules || [])
    .filter((schedule) => schedule.status === 'PAID')
    .reduce((sum, schedule) => sum + Number(schedule.actual_paid_amount || 0), 0);

  const forecastRevenueMonth = (paymentSchedules || [])
    .filter((schedule) => schedule.status === 'PENDING')
    .filter((schedule) => {
      const expected = new Date(schedule.expected_date);
      return expected.getFullYear() === currentYear && expected.getMonth() === currentMonth;
    })
    .reduce((sum, schedule) => sum + Number(schedule.expected_amount || 0), 0);

  const forecastRevenueQuarter = (paymentSchedules || [])
    .filter((schedule) => schedule.status === 'PENDING')
    .filter((schedule) => {
      const expected = new Date(schedule.expected_date);
      return (
        expected.getFullYear() === currentYear &&
        expected.getMonth() >= quarterStartMonth &&
        expected.getMonth() <= quarterEndMonth
      );
    })
    .reduce((sum, schedule) => sum + Number(schedule.expected_amount || 0), 0);

  const monthlyRevenueComparison = (() => {
    const monthLabels: Array<{ month: string; year: number; monthIndex: number }> = [];
    for (let i = 5; i >= 0; i -= 1) {
      const point = new Date(currentYear, currentMonth - i, 1);
      monthLabels.push({
        month: point.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }),
        year: point.getFullYear(),
        monthIndex: point.getMonth(),
      });
    }

    return monthLabels.map((point) => {
      const planned = (paymentSchedules || [])
        .filter((schedule) => {
          const expected = new Date(schedule.expected_date);
          return expected.getFullYear() === point.year && expected.getMonth() === point.monthIndex;
        })
        .reduce((sum, schedule) => sum + Number(schedule.expected_amount || 0), 0);

      const actual = (paymentSchedules || [])
        .filter((schedule) => schedule.status === 'PAID')
        .filter((schedule) => {
          const paidDate = schedule.actual_paid_date ? new Date(schedule.actual_paid_date) : null;
          return paidDate !== null && paidDate.getFullYear() === point.year && paidDate.getMonth() === point.monthIndex;
        })
        .reduce((sum, schedule) => sum + Number(schedule.actual_paid_amount || 0), 0);

      return {
        month: point.month,
        planned,
        actual,
      };
    });
  })();

  const pipelineStageOrder = (() => {
    const seen = new Set<string>();
    const ordered: OpportunityStage[] = [];

    (opportunityStages || [])
      .slice()
      .sort((left, right) => {
        const sortCompare = Number(left.sort_order || 0) - Number(right.sort_order || 0);
        if (sortCompare !== 0) {
          return sortCompare;
        }
        return String(left.stage_code || '').localeCompare(String(right.stage_code || ''), 'vi');
      })
      .forEach((stage) => {
        const stageCode = String(stage.stage_code || '').trim().toUpperCase();
        if (!stageCode || seen.has(stageCode)) {
          return;
        }
        seen.add(stageCode);
        ordered.push(stageCode as OpportunityStage);
      });

    (opportunities || []).forEach((opp) => {
      const stageCode = String(opp.stage || '').trim().toUpperCase();
      if (!stageCode || seen.has(stageCode)) {
        return;
      }
      seen.add(stageCode);
      ordered.push(stageCode as OpportunityStage);
    });

    if (ordered.length === 0) {
      return OPPORTUNITY_STAGE_ORDER_FALLBACK;
    }

    return ordered;
  })();

  const pipelineByStage = pipelineStageOrder.map((stage) => ({
    stage,
    value: (opportunities || [])
      .filter((opp) => String(opp.stage || '').trim().toUpperCase() === String(stage))
      .reduce((sum, opp) => sum + (opp.amount || 0), 0),
  }));

  const projectStatusCounts = PROJECT_STATUS_ORDER.map((status) => ({
    status,
    count: (projects || []).filter((project) => project.status === status).length,
  }));

  const dashboardStats: DashboardStats = {
    totalRevenue,
    actualRevenue,
    forecastRevenueMonth,
    forecastRevenueQuarter,
    monthlyRevenueComparison,
    pipelineByStage,
    projectStatusCounts,
  };

  const hrStatistics: HRStatistics = useMemo(
    () => buildHrStatistics(employees, departments),
    [employees, departments]
  );

  const activeInternalUserSubTab: InternalUserSubTab =
    activeTab === 'internal_user_list' ? 'list' : internalUserSubTab;

  const activeModuleKey =
    activeTab === 'internal_user_dashboard'
      ? activeInternalUserSubTab === 'list'
        ? 'internal_user_list'
        : 'internal_user_dashboard'
      : activeTab;
  const importModalModuleKey = importModuleOverride || activeModuleKey;

  const handleConvertOpportunity = (opp: Opportunity) => {
    if (!hasPermission(authUser, 'projects.write')) {
      addToast('error', 'Không đủ quyền', 'Bạn không có quyền chuyển cơ hội thành dự án.');
      return;
    }

    const initialProjectData: Partial<Project> = {
        project_name: `Dự án: ${opp.opp_name}`,
        customer_id: opp.customer_id,
        status: 'TRIAL',
    };
    
    // We treat this as "ADD" mode but pre-fill data
    setSelectedProject(initialProjectData as Project);
    setModalType('ADD_PROJECT');
  };

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
    return (
      <LoginPage
        isLoading={isLoginLoading}
        errorMessage={loginError}
        infoMessage={loginInfoMessage}
        onSubmit={handleLogin}
      />
    );
  }

  if (passwordChangeRequired) {
    return (
      <div className="min-h-screen bg-bg-light flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
              <span className="material-symbols-outlined">lock_reset</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Đổi mật khẩu bắt buộc</h2>
              <p className="text-sm text-slate-600">Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng hệ thống.</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Mật khẩu hiện tại</span>
              <input
                type="password"
                autoComplete="current-password"
                value={passwordChangeForm.current_password}
                onChange={(event) => setPasswordChangeForm((current) => ({ ...current, current_password: event.target.value }))}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Mật khẩu mới</span>
              <input
                type="password"
                autoComplete="new-password"
                value={passwordChangeForm.new_password}
                onChange={(event) => setPasswordChangeForm((current) => ({ ...current, new_password: event.target.value }))}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Xác nhận mật khẩu mới</span>
              <input
                type="password"
                autoComplete="new-password"
                value={passwordChangeForm.new_password_confirmation}
                onChange={(event) =>
                  setPasswordChangeForm((current) => ({ ...current, new_password_confirmation: event.target.value }))
                }
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </label>
            {passwordChangeError ? (
              <p className="text-sm text-red-600">{passwordChangeError}</p>
            ) : (
              <p className="text-xs text-slate-500">Mật khẩu mới cần tối thiểu 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.</p>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleLogout}
              className="h-11 px-4 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
              disabled={isPasswordChanging}
            >
              Đăng xuất
            </button>
            <button
              type="button"
              onClick={handleChangePasswordRequired}
              disabled={isPasswordChanging}
              className="h-11 px-5 rounded-lg bg-primary text-white font-semibold hover:bg-deep-teal disabled:opacity-60"
            >
              {isPasswordChanging ? 'Đang lưu...' : 'Đổi mật khẩu'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-bg-light overflow-hidden flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm z-30">
         <div className="flex items-center gap-3">
             <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600 p-1">
                 <span className="material-symbols-outlined">menu</span>
             </button>
             <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-primary">
                 <span className="material-symbols-outlined text-lg">business</span>
             </div>
             <h1 className="text-sm font-bold text-slate-900">VNPT Business</h1>
         </div>
      </div>

      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentUser={authUser}
        visibleTabIds={visibleTabIds}
        onLogout={handleLogout}
        onPrefetchTab={prefetchTabModules}
      />
      
      <main className="flex-1 overflow-y-auto bg-bg-light w-full">
        <Suspense fallback={<LazyModuleFallback />}>
          {activeTab === 'dashboard' && (
            <Dashboard stats={dashboardStats} opportunityStageOptions={opportunityStages} />
          )}

        {(activeTab === 'internal_user_dashboard' || activeTab === 'internal_user_list') && (
          <InternalUserModuleTabs
            employees={employees}
            departments={departments}
            hrStatistics={hrStatistics}
            onOpenModal={handleOpenModal}
            onNotify={addToast}
            listEmployees={employeesPageRows}
            listMeta={employeesPageMeta}
            listLoading={employeesPageLoading}
            onListQueryChange={handleEmployeesPageQueryChange}
            activeSubTab={activeInternalUserSubTab}
            onSubTabChange={setInternalUserSubTab}
          />
        )}

        {activeTab === 'departments' && (
          <DepartmentList departments={departments} employees={employees} onOpenModal={handleOpenModal} />
        )}

        {activeTab === 'user_dept_history' && (
          <UserDeptHistoryList 
            history={userDeptHistory}
            employees={employees}
            departments={departments}
            onOpenModal={handleOpenModal} 
          />
        )}

        {activeTab === 'businesses' && (
          <BusinessList businesses={businesses} onOpenModal={handleOpenModal} />
        )}

        {activeTab === 'vendors' && (
          <VendorList vendors={vendors} onOpenModal={handleOpenModal} />
        )}

        {activeTab === 'products' && (
          <ProductList 
            products={products} 
            businesses={businesses} 
            vendors={vendors} 
            onOpenModal={handleOpenModal} 
          />
        )}

        {activeTab === 'clients' && (
          <CustomerList 
            customers={customersPageRows}
            onOpenModal={handleOpenModal}
            onNotify={addToast}
            paginationMeta={customersPageMeta}
            isLoading={customersPageLoading}
            onQueryChange={handleCustomersPageQueryChange}
          />
        )}

        {activeTab === 'cus_personnel' && (
          <CusPersonnelList 
            personnel={cusPersonnel}
            customers={customers}
            supportContactPositions={supportContactPositions}
            onNotify={addToast}
            onOpenModal={handleOpenModal} 
          />
        )}

        {activeTab === 'opportunities' && (
          <OpportunityList 
             opportunities={opportunities}
             opportunityStageOptions={opportunityStages}
             customers={customers}
             personnel={cusPersonnel}
             products={products}
             employees={employees}
             onOpenModal={handleOpenModal}
             onConvert={handleConvertOpportunity}
             onNotify={(type, title, message) => addToast(type === 'error' ? 'error' : 'success', title, message)}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectList
             projects={projectsPageRows}
             customers={customers}
             projectTypes={projectTypes}
             onOpenModal={handleOpenModal}
             onCreateContract={handleCreateContractFromProject}
             onOpenProcedure={handleOpenProcedure}
             onNotify={addToast}
             onExportProjects={exportProjectsByCurrentQuery}
             onExportProjectRaci={exportProjectRaciByProjectIds}
             projectItems={projectItems}
             paginationMeta={projectsPageMeta}
             isLoading={projectsPageLoading}
             onQueryChange={handleProjectsPageQueryChange}
          />
        )}

        {activeTab === 'contracts' && (
          <ContractList 
             contracts={contractsPageRows}
             projects={projects}
             customers={customers}
             onOpenModal={handleOpenModal}
             paginationMeta={contractsPageMeta}
             isLoading={contractsPageLoading}
             onQueryChange={handleContractsPageQueryChange}
          />
        )}

        {activeTab === 'documents' && (
          <DocumentList 
             documents={documentsPageRows}
             customers={customers}
             onOpenModal={handleOpenModal}
             paginationMeta={documentsPageMeta}
             isLoading={documentsPageLoading}
             onQueryChange={handleDocumentsPageQueryChange}
          />
        )}

        {activeTab === 'reminders' && (
          <ReminderList 
             reminders={reminders}
             employees={employees}
             onOpenModal={handleOpenModal}
          />
        )}

        {activeTab === 'customer_request_management' && (
          <CustomerRequestManagementHub
            customers={customers}
            customerPersonnel={cusPersonnel}
            projectItems={projectItems}
            employees={employees}
            supportServiceGroups={supportServiceGroups}
            currentUserId={authUser?.id ?? null}
            isAdminViewer={Boolean(
              authUser
              && (
                (authUser.roles || []).map((role) => String(role).toUpperCase()).includes('ADMIN')
                || (authUser.permissions || []).includes('*')
              )
            )}
            canImportRequests={hasPermission(authUser, 'support_requests.import')}
            canExportRequests={hasPermission(authUser, 'support_requests.export')}
            canReadRequests={hasPermission(authUser, 'support_requests.read')}
            canWriteRequests={hasPermission(authUser, 'support_requests.write')}
            canDeleteRequests={hasPermission(authUser, 'support_requests.delete')}
            onNotify={addToast}
          />
        )}

        {activeTab === 'support_master_management' && (
          <SupportMasterManagement
            customers={customers}
            supportServiceGroups={supportServiceGroups}
            supportContactPositions={supportContactPositions}
            supportRequestStatuses={supportRequestStatuses}
            opportunityStages={opportunityStages}
            projectTypes={projectTypes}
            worklogActivityTypes={worklogActivityTypes}
            supportSlaConfigs={supportSlaConfigs}
            onCreateSupportServiceGroup={handleCreateSupportServiceGroup}
            onUpdateSupportServiceGroup={handleUpdateSupportServiceGroup}
            onCreateSupportContactPosition={handleCreateSupportContactPosition}
            onCreateSupportContactPositionsBulk={handleCreateSupportContactPositionsBulk}
            onUpdateSupportContactPosition={handleUpdateSupportContactPosition}
            onCreateSupportRequestStatus={handleCreateSupportRequestStatus}
            onUpdateSupportRequestStatus={handleUpdateSupportRequestStatusDefinition}
            onCreateOpportunityStage={handleCreateOpportunityStage}
            onUpdateOpportunityStage={handleUpdateOpportunityStage}
            onCreateProjectType={handleCreateProjectType}
            onUpdateProjectType={handleUpdateProjectType}
            onCreateWorklogActivityType={handleCreateWorklogActivityType}
            onUpdateWorklogActivityType={handleUpdateWorklogActivityType}
            onCreateSupportSlaConfig={handleCreateSupportSlaConfig}
            onUpdateSupportSlaConfig={handleUpdateSupportSlaConfig}
            canReadCustomers={hasPermission(authUser, 'customers.read')}
            canReadServiceGroups={hasPermission(authUser, 'support_service_groups.read')}
            canReadContactPositions={hasPermission(authUser, 'support_contact_positions.read')}
            canReadStatuses={hasPermission(authUser, 'support_requests.read')}
            canReadWorklogActivityTypes={hasPermission(authUser, 'support_requests.read')}
            canReadSlaConfigs={hasPermission(authUser, 'support_requests.read')}
            canWriteServiceGroups={hasPermission(authUser, 'support_service_groups.write')}
            canWriteContactPositions={hasPermission(authUser, 'support_contact_positions.write')}
            canWriteStatuses={hasPermission(authUser, 'support_requests.write')}
            canWriteWorklogActivityTypes={hasPermission(authUser, 'support_requests.write')}
            canWriteSlaConfigs={hasPermission(authUser, 'support_requests.write')}
            canWriteOpportunityStages={hasPermission(authUser, 'opportunities.write')}
            canReadOpportunityStages={hasPermission(authUser, 'opportunities.read')}
            canWriteProjectTypes={hasPermission(authUser, 'projects.write')}
            canReadProjectTypes={hasPermission(authUser, 'projects.read')}
            canWriteWorkCalendar={hasPermission(authUser, 'support_requests.write')}
            canReadWorkCalendar={hasPermission(authUser, 'support_requests.read')}
          />
        )}

        {activeTab === 'procedure_template_config' && (
          <ProcedureTemplateManagement
            canWrite={hasPermission(authUser, 'projects.write')}
            canRead={hasPermission(authUser, 'projects.read')}
          />
        )}

        {activeTab === 'department_weekly_schedule_management' && (
          <DepartmentWeeklyScheduleManagement
            departments={departments}
            employees={employees}
            currentUserId={authUser?.id ?? null}
            currentUserDepartmentId={authUser?.department_id ?? null}
            isAdminViewer={Boolean(
              authUser
              && (
                (authUser.roles || []).map((role) => String(role).toUpperCase()).includes('ADMIN')
                || (authUser.permissions || []).includes('*')
              )
            )}
            canReadSchedules={hasPermission(authUser, 'support_requests.read')}
            canWriteSchedules={hasPermission(authUser, 'support_requests.write')}
            onNotify={addToast}
          />
        )}

        {activeTab === 'audit_logs' && (
          <AuditLogList
            auditLogs={auditLogsPageRows}
            employees={employees}
            paginationMeta={auditLogsPageMeta}
            isLoading={auditLogsPageLoading}
            onQueryChange={handleAuditLogsPageQueryChange}
          />
        )}

        {activeTab === 'user_feedback' && (
          <FeedbackList
            feedbacks={feedbacksPageRows}
            employees={employees}
            paginationMeta={feedbacksPageMeta}
            isLoading={feedbacksPageLoading}
            onQueryChange={handleFeedbacksPageQueryChange}
            canWrite={hasPermission(authUser, 'feedback_requests.write')}
            canDelete={hasPermission(authUser, 'feedback_requests.delete')}
            onNotify={addToast}
            onAdd={() => handleOpenModal('ADD_FEEDBACK')}
            onEdit={(item) => handleOpenModal('EDIT_FEEDBACK', item as any)}
            onView={(item) => handleOpenModal('VIEW_FEEDBACK', item as any)}
            onDelete={(item) => handleOpenModal('DELETE_FEEDBACK', item as any)}
          />
        )}

        {activeTab === 'integration_settings' && (
          <IntegrationSettingsPanel
            backblazeB2Settings={backblazeB2Settings}
            settings={googleDriveSettings}
            contractExpiryAlertSettings={contractExpiryAlertSettings}
            contractPaymentAlertSettings={contractPaymentAlertSettings}
            isLoading={isBackblazeB2SettingsLoading || isGoogleDriveSettingsLoading || isContractExpiryAlertSettingsLoading || isContractPaymentAlertSettingsLoading}
            isSaving={isGoogleDriveSettingsSaving}
            isTesting={isGoogleDriveSettingsTesting}
            isSavingBackblazeB2={isBackblazeB2SettingsSaving}
            isTestingBackblazeB2={isBackblazeB2SettingsTesting}
            isSavingContractExpiryAlert={isContractExpiryAlertSettingsSaving}
            isSavingContractPaymentAlert={isContractPaymentAlertSettingsSaving}
            onRefresh={refreshIntegrationSettings}
            onSaveBackblazeB2={handleSaveBackblazeB2Settings}
            onSave={handleSaveGoogleDriveSettings}
            onSaveContractExpiryAlert={handleSaveContractExpiryAlertSettings}
            onSaveContractPaymentAlert={handleSaveContractPaymentAlertSettings}
            onTestBackblazeB2={handleTestBackblazeB2Integration}
            onTest={handleTestGoogleDriveIntegration}
          />
        )}

        {activeTab === 'access_control' && (
          <AccessControlList
            records={userAccessRecords}
            roles={roles}
            permissions={permissions}
            departments={departments}
            onRefresh={refreshAccessControlData}
            onUpdateRoles={handleUpdateAccessRoles}
            onBulkUpdateRoles={handleBulkUpdateAccessRoles}
            onBulkUpdatePermissions={handleBulkUpdateAccessPermissions}
            onBulkUpdateScopes={handleBulkUpdateAccessScopes}
            onUpdatePermissions={handleUpdateAccessPermissions}
            onUpdateScopes={handleUpdateAccessScopes}
          />
        )}

        </Suspense>
      </main>

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {employeeProvisioning ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Mật khẩu tạm thời</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Tài khoản: <span className="font-semibold text-slate-800">{employeeProvisioning.employeeLabel}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEmployeeProvisioning(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Mật khẩu chỉ hiển thị một lần. Vui lòng bàn giao an toàn cho người dùng và yêu cầu đổi mật khẩu ngay sau đăng nhập.
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Temporary password</p>
                <p className="font-mono text-base text-slate-900 break-all">{employeeProvisioning.provisioning.temporary_password}</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(employeeProvisioning.provisioning.temporary_password);
                    addToast('success', 'Sao chép thành công', 'Đã sao chép mật khẩu tạm vào clipboard.');
                  } catch {
                    addToast('error', 'Không thể sao chép', 'Trình duyệt không cho phép sao chép tự động.');
                  }
                }}
                className="h-10 px-4 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100"
              >
                Sao chép
              </button>
              <button
                type="button"
                onClick={() => setEmployeeProvisioning(null)}
                className="h-10 px-4 rounded-lg bg-primary text-white font-semibold hover:bg-deep-teal"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modals */}
      <Suspense fallback={null}>
        {(modalType === 'ADD_DEPARTMENT' || modalType === 'EDIT_DEPARTMENT') && (
          <DepartmentFormModal 
            type={modalType === 'ADD_DEPARTMENT' ? 'ADD' : 'EDIT'}
            data={selectedDept}
            departments={departments}
            onClose={handleCloseModal}
            onSave={handleSaveDepartment}
            isLoading={isSaving}
          />
        )}

        {modalType === 'VIEW_DEPARTMENT' && selectedDept && (
          <ViewDepartmentModal 
            data={selectedDept}
            departments={departments}
            onClose={handleCloseModal}
            onEdit={() => handleOpenModal('EDIT_DEPARTMENT', selectedDept)}
          />
        )}

        {modalType === 'DELETE_DEPARTMENT' && selectedDept && (
          <DeleteWarningModal 
            data={selectedDept}
            onClose={handleCloseModal}
            onConfirm={handleDeleteDepartment}
          />
        )}

        {modalType === 'CANNOT_DELETE' && selectedDept && (
          <CannotDeleteModal 
            data={selectedDept}
            onClose={handleCloseModal}
          />
        )}

        {modalType === 'IMPORT_DATA' && (
        <ImportModal 
           title={
             importModalModuleKey === 'departments' ? "Nhập dữ liệu phòng ban" : 
             importModalModuleKey === 'internal_user_list' ? "Nhập dữ liệu nhân sự" :
             importModalModuleKey === 'businesses' ? "Nhập dữ liệu lĩnh vực" :
             importModalModuleKey === 'vendors' ? "Nhập dữ liệu đối tác" :
             importModalModuleKey === 'products' ? "Nhập dữ liệu sản phẩm" :
             importModalModuleKey === 'clients' ? "Nhập dữ liệu khách hàng" :
             importModalModuleKey === 'customer_request_management' ? "Nhập dữ liệu quản lý yêu cầu KH" :
             importModalModuleKey === 'opportunities' ? "Nhập dữ liệu cơ hội" :
             importModalModuleKey === 'projects' ? "Nhập dữ liệu dự án" :
             "Nhập dữ liệu nhân sự liên hệ"
           }
           moduleKey={importModalModuleKey}
           onClose={handleCloseModal}
           onSave={handleImportData}
           isLoading={isSaving}
           loadingText={importLoadingText}
        />
      )}

      {(modalType === 'ADD_EMPLOYEE' || modalType === 'EDIT_EMPLOYEE') && (
        <EmployeeFormModal 
          type={modalType === 'ADD_EMPLOYEE' ? 'ADD' : 'EDIT'}
          data={selectedEmployee}
          departments={departments}
          onClose={handleCloseModal} 
          onSave={handleSaveEmployee}
          onResetPassword={modalType === 'EDIT_EMPLOYEE' ? handleResetEmployeePassword : undefined}
          isResettingPassword={isEmployeePasswordResetting}
        />
      )}

      {modalType === 'DELETE_EMPLOYEE' && selectedEmployee && (
        <DeleteEmployeeModal 
          data={selectedEmployee}
          onClose={handleCloseModal}
          onConfirm={handleDeleteEmployee}
        />
      )}

      {(modalType === 'ADD_BUSINESS' || modalType === 'EDIT_BUSINESS') && (
        <BusinessFormModal 
          type={modalType === 'ADD_BUSINESS' ? 'ADD' : 'EDIT'}
          data={selectedBusiness}
          onClose={handleCloseModal} 
          onSave={handleSaveBusiness} 
        />
      )}

      {modalType === 'DELETE_BUSINESS' && selectedBusiness && (
         <DeleteBusinessModal 
           data={selectedBusiness}
           onClose={handleCloseModal}
           onConfirm={handleDeleteBusiness}
         />
      )}

      {(modalType === 'ADD_VENDOR' || modalType === 'EDIT_VENDOR') && (
        <VendorFormModal 
          type={modalType === 'ADD_VENDOR' ? 'ADD' : 'EDIT'}
          data={selectedVendor}
          onClose={handleCloseModal} 
          onSave={handleSaveVendor} 
        />
      )}

      {modalType === 'DELETE_VENDOR' && selectedVendor && (
         <DeleteVendorModal
           data={selectedVendor}
           onClose={handleCloseModal}
           onConfirm={handleDeleteVendor}
         />
      )}

      {(modalType === 'ADD_FEEDBACK' || modalType === 'EDIT_FEEDBACK') && (
        <FeedbackFormModal
          type={modalType === 'ADD_FEEDBACK' ? 'ADD' : 'EDIT'}
          data={selectedFeedback}
          isSaving={isSaving}
          onClose={handleCloseModal}
          onSave={handleSaveFeedback}
        />
      )}

      {modalType === 'VIEW_FEEDBACK' && selectedFeedback && (
        <FeedbackViewModal
          data={selectedFeedback}
          employees={employees}
          onClose={handleCloseModal}
          onEdit={
            hasPermission(authUser, 'feedback_requests.write')
              ? () => { setSelectedFeedback(selectedFeedback); setModalType('EDIT_FEEDBACK'); }
              : undefined
          }
        />
      )}

      {modalType === 'DELETE_FEEDBACK' && selectedFeedback && (
        <DeleteFeedbackModal
          data={selectedFeedback}
          onClose={handleCloseModal}
          onConfirm={handleDeleteFeedback}
        />
      )}

      {(modalType === 'ADD_PRODUCT' || modalType === 'EDIT_PRODUCT') && (
        <ProductFormModal 
          type={modalType === 'ADD_PRODUCT' ? 'ADD' : 'EDIT'}
          data={selectedProduct}
          businesses={businesses}
          vendors={vendors}
          onClose={handleCloseModal}
          onSave={handleSaveProduct}
        />
      )}

      {modalType === 'DELETE_PRODUCT' && selectedProduct && (
        <DeleteProductModal 
          data={selectedProduct}
          onClose={handleCloseModal}
          onConfirm={handleDeleteProduct}
        />
      )}

      {(modalType === 'ADD_CUSTOMER' || modalType === 'EDIT_CUSTOMER') && (
        <CustomerFormModal 
          type={modalType === 'ADD_CUSTOMER' ? 'ADD' : 'EDIT'}
          data={selectedCustomer}
          onClose={handleCloseModal}
          onSave={handleSaveCustomer}
        />
      )}

      {modalType === 'DELETE_CUSTOMER' && selectedCustomer && (
        <DeleteCustomerModal 
          data={selectedCustomer}
          onClose={handleCloseModal}
          onConfirm={handleDeleteCustomer}
        />
      )}

      {(modalType === 'ADD_CUS_PERSONNEL' || modalType === 'EDIT_CUS_PERSONNEL') && (
        <CusPersonnelFormModal 
          type={modalType === 'ADD_CUS_PERSONNEL' ? 'ADD' : 'EDIT'}
          data={selectedCusPersonnel}
          customers={customers}
          supportContactPositions={supportContactPositions}
          onClose={handleCloseModal}
          onSave={handleSaveCusPersonnel}
        />
      )}

      {modalType === 'DELETE_CUS_PERSONNEL' && selectedCusPersonnel && (
        <DeleteCusPersonnelModal 
          data={selectedCusPersonnel}
          onClose={handleCloseModal}
          onConfirm={handleDeleteCusPersonnel}
        />
      )}

      {(modalType === 'ADD_OPPORTUNITY' || modalType === 'EDIT_OPPORTUNITY') && (
        <OpportunityFormModal 
          type={modalType === 'ADD_OPPORTUNITY' ? 'ADD' : 'EDIT'}
          data={selectedOpportunity}
          opportunityStageOptions={opportunityStages}
          customers={customers}
          personnel={cusPersonnel}
          products={products}
          employees={employees}
          onClose={handleCloseModal}
          onSave={handleSaveOpportunity}
        />
      )}

      {modalType === 'DELETE_OPPORTUNITY' && selectedOpportunity && (
        <DeleteOpportunityModal 
          data={selectedOpportunity}
          onClose={handleCloseModal}
          onConfirm={handleDeleteOpportunity}
        />
      )}

      {(modalType === 'ADD_PROJECT' || modalType === 'EDIT_PROJECT') && (
        <ProjectFormModal
          key={`project-modal-${modalType || 'none'}-${selectedProject?.id ?? 'new'}-${projectModalInitialTab}`}
          type={modalType === 'ADD_PROJECT' ? 'ADD' : 'EDIT'}
          data={selectedProject}
          initialTab={projectModalInitialTab}
          customers={customers}
          opportunities={opportunities}
          products={products}
          projectItems={projectItems}
          projectTypes={projectTypes}
          employees={employees}
          departments={departments}
          onClose={handleCloseModal}
          onSave={handleSaveProject}
          onNotify={addToast}
          onImportProjectItemsBatch={handleImportProjectItemsBatch}
          onImportProjectRaciBatch={handleImportProjectRaciBatch}
          onViewProcedure={(project) => {
            handleCloseModal();
            handleOpenProcedure(project);
          }}
        />
      )}

      {modalType === 'DELETE_PROJECT' && selectedProject && (
        <DeleteProjectModal 
          data={selectedProject}
          onClose={handleCloseModal}
          onConfirm={handleDeleteProject}
        />
      )}

      {(modalType === 'ADD_CONTRACT' || modalType === 'EDIT_CONTRACT') && (
        <ContractModal
          type={modalType === 'ADD_CONTRACT' ? 'ADD' : 'EDIT'}
          data={modalType === 'EDIT_CONTRACT' ? selectedContract : null}
          prefill={modalType === 'ADD_CONTRACT' ? contractAddPrefill : null}
          projects={projects}
          products={products}
          projectItems={projectItems}
          customers={customers}
          paymentSchedules={paymentSchedules}
          isPaymentLoading={isPaymentScheduleLoading}
          onClose={handleCloseModal}
          onSave={handleSaveContract}
          onGenerateSchedules={(contractId, generateOptions) => handleGenerateSchedules(contractId, { generateOptions })}
          onRefreshSchedules={handleRefreshSchedules}
          onConfirmPayment={handleConfirmPaymentSchedule}
        />
      )}

      {modalType === 'DELETE_CONTRACT' && selectedContract && (
        <DeleteContractModal
          data={selectedContract}
          onClose={handleCloseModal}
          onConfirm={handleDeleteContract}
        />
      )}

      {procedureProject && (
        <ProjectProcedureModal
          project={procedureProject}
          isOpen={true}
          onClose={() => setProcedureProject(null)}
          onNotify={addToast}
          projectTypes={projectTypes}
          authUser={authUser}
        />
      )}

      {(modalType === 'ADD_DOCUMENT' || modalType === 'EDIT_DOCUMENT' || modalType === 'UPLOAD_PRODUCT_DOCUMENT') && (
        <DocumentFormModal 
          type={modalType === 'EDIT_DOCUMENT' ? 'EDIT' : 'ADD'}
          data={selectedDocument}
          customers={customers}
          projects={projects}
          products={products}
          preselectedProduct={modalType === 'UPLOAD_PRODUCT_DOCUMENT' ? selectedProduct : null}
          mode={modalType === 'UPLOAD_PRODUCT_DOCUMENT' ? 'product_upload' : 'default'}
          onClose={handleCloseModal}
          onSave={handleSaveDocument}
        />
      )}

      {modalType === 'DELETE_DOCUMENT' && selectedDocument && (
        <DeleteDocumentModal 
          data={selectedDocument}
          onClose={handleCloseModal}
          onConfirm={handleDeleteDocument}
        />
      )}

      {(modalType === 'ADD_REMINDER' || modalType === 'EDIT_REMINDER') && (
        <ReminderFormModal 
          type={modalType === 'ADD_REMINDER' ? 'ADD' : 'EDIT'}
          data={selectedReminder}
          employees={employees}
          onClose={handleCloseModal}
          onSave={handleSaveReminder}
        />
      )}

      {modalType === 'DELETE_REMINDER' && selectedReminder && (
        <DeleteReminderModal 
          data={selectedReminder}
          onClose={handleCloseModal}
          onConfirm={handleDeleteReminder}
        />
      )}

        {(modalType === 'ADD_USER_DEPT_HISTORY' || modalType === 'EDIT_USER_DEPT_HISTORY') && (
          <UserDeptHistoryFormModal 
            type={modalType === 'ADD_USER_DEPT_HISTORY' ? 'ADD' : 'EDIT'}
            data={selectedUserDeptHistory}
            employees={employees}
            departments={departments}
            onClose={handleCloseModal}
            onSave={handleSaveUserDeptHistory}
          />
        )}

        {modalType === 'DELETE_USER_DEPT_HISTORY' && selectedUserDeptHistory && (
          <DeleteUserDeptHistoryModal 
            data={selectedUserDeptHistory}
            onClose={handleCloseModal}
            onConfirm={handleDeleteUserDeptHistory}
          />
        )}
      </Suspense>

    </div>
  );
};

export default App;
