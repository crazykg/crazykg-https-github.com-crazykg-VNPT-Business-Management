import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './components/LoginPage';
import { ToastContainer } from './components/Toast';
import type { InternalUserSubTab } from './components/InternalUserModuleTabs';
import type { ImportPayload } from './components/Modals';
import { AuditLog, BulkMutationResult, Department, Employee, Business, Vendor, Product, Customer, CustomerPersonnel, Opportunity, Project, ProjectItemMaster, Contract, Document, Reminder, UserDeptHistory, ModalType, Toast, DashboardStats, OpportunityStage, ProjectStatus, PaymentSchedule, HRStatistics, SupportRequest, SupportRequestReceiverResult, SupportServiceGroup, SupportRequestStatus, SupportRequestHistory, SupportRequestStatusOption, AuthUser, Role, Permission, UserAccessRecord, GoogleDriveIntegrationSettings, GoogleDriveIntegrationSettingsUpdatePayload, PaginatedQuery, PaginationMeta } from './types';
import { buildHrStatistics } from './utils/hrAnalytics';
import { buildAgeRangeValidationMessage, isAgeInAllowedRange } from './utils/ageValidation';
import { canAccessTab, canOpenModal, hasPermission, resolveImportPermission } from './utils/authorization';
import { downloadExcelWorkbook } from './utils/excelTemplate';
import {
  DEFAULT_PAGINATION_META,
  createContract,
  createCustomer,
  createDepartment,
  createDocument,
  createEmployee,
  createEmployeesBulk,
  createOpportunity,
  createProject,
  createSupportServiceGroup,
  createSupportServiceGroupsBulk,
  createSupportRequestStatus,
  createSupportRequestStatusesBulk,
  createSupportRequest,
  createSupportRequestsBulk,
  createVendor,
  deleteContract,
  deleteCustomer,
  deleteDepartment,
  deleteDocument,
  deleteEmployee,
  deleteOpportunity,
  deleteProject,
  deleteSupportRequest,
  deleteVendor,
  fetchAuditLogs,
  fetchAuditLogsPage,
  fetchAuthBootstrap,
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
  fetchGoogleDriveIntegrationSettings,
  fetchOpportunities,
  fetchProducts,
  fetchProjectItems,
  fetchProjects,
  fetchProjectsPage,
  fetchPermissions,
  fetchReminders,
  fetchRoles,
  fetchSupportRequests,
  fetchSupportRequestsPage,
  fetchSupportRequestStatuses,
  fetchSupportServiceGroups,
  fetchUserAccess,
  fetchUserDeptHistory,
  fetchVendors,
  fetchSupportRequestHistories,
  fetchSupportRequestHistory,
  fetchSupportRequestReceivers,
  fetchPaymentSchedules,
  generateContractPayments,
  login,
  logout,
  updateContract,
  updateCustomer,
  updateDepartment,
  updateDocument,
  updateEmployee,
  updatePaymentSchedule,
  updateOpportunity,
  updateProject,
  updateSupportRequest,
  updateSupportRequestStatus,
  updateGoogleDriveIntegrationSettings,
  testGoogleDriveIntegrationSettings,
  updateUserAccessDeptScopes,
  updateUserAccessPermissions,
  updateUserAccessRoles,
  updateVendor,
  isRequestCanceledError,
} from './services/v5Api';

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
const ContractList = lazy(() => import('./components/ContractList').then((module) => ({ default: module.ContractList })));
const DocumentList = lazy(() => import('./components/DocumentList').then((module) => ({ default: module.DocumentList })));
const ReminderList = lazy(() => import('./components/ReminderList').then((module) => ({ default: module.ReminderList })));
const SupportRequestList = lazy(() =>
  import('./components/SupportRequestList').then((module) => ({ default: module.SupportRequestList }))
);
const AuditLogList = lazy(() => import('./components/AuditLogList').then((module) => ({ default: module.AuditLogList })));
const IntegrationSettingsPanel = lazy(() =>
  import('./components/IntegrationSettingsPanel').then((module) => ({ default: module.IntegrationSettingsPanel }))
);
const AccessControlList = lazy(() =>
  import('./components/AccessControlList').then((module) => ({ default: module.AccessControlList }))
);
const ContractModal = lazy(() =>
  import('./components/ContractModal').then((module) => ({ default: module.ContractModal }))
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

const buildSupportRequestsDefaultQuery = (): PaginatedQuery => {
  const now = new Date();

  return {
    page: 1,
    per_page: 10,
    sort_by: 'requested_date',
    sort_dir: 'desc',
    q: '',
    filters: {
      requested_from: `${now.getFullYear()}-01-01`,
      requested_to: now.toISOString().slice(0, 10),
    },
  };
};

const App: React.FC = () => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

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
  const [supportServiceGroups, setSupportServiceGroups] = useState<SupportServiceGroup[]>([]);
  const [supportRequestStatuses, setSupportRequestStatuses] = useState<SupportRequestStatusOption[]>([]);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [supportRequestHistories, setSupportRequestHistories] = useState<SupportRequestHistory[]>([]);
  const [employeesPageRows, setEmployeesPageRows] = useState<Employee[]>([]);
  const [customersPageRows, setCustomersPageRows] = useState<Customer[]>([]);
  const [projectsPageRows, setProjectsPageRows] = useState<Project[]>([]);
  const [contractsPageRows, setContractsPageRows] = useState<Contract[]>([]);
  const [documentsPageRows, setDocumentsPageRows] = useState<Document[]>([]);
  const [supportRequestsPageRows, setSupportRequestsPageRows] = useState<SupportRequest[]>([]);
  const [auditLogsPageRows, setAuditLogsPageRows] = useState<AuditLog[]>([]);
  const [employeesPageMeta, setEmployeesPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [customersPageMeta, setCustomersPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [projectsPageMeta, setProjectsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [contractsPageMeta, setContractsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [documentsPageMeta, setDocumentsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [supportRequestsPageMeta, setSupportRequestsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [auditLogsPageMeta, setAuditLogsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [employeesPageLoading, setEmployeesPageLoading] = useState(false);
  const [customersPageLoading, setCustomersPageLoading] = useState(false);
  const [projectsPageLoading, setProjectsPageLoading] = useState(false);
  const [contractsPageLoading, setContractsPageLoading] = useState(false);
  const [documentsPageLoading, setDocumentsPageLoading] = useState(false);
  const [supportRequestsPageLoading, setSupportRequestsPageLoading] = useState(false);
  const [auditLogsPageLoading, setAuditLogsPageLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userAccessRecords, setUserAccessRecords] = useState<UserAccessRecord[]>([]);
  const [googleDriveSettings, setGoogleDriveSettings] = useState<GoogleDriveIntegrationSettings | null>(null);
  const [isGoogleDriveSettingsLoading, setIsGoogleDriveSettingsLoading] = useState(false);
  const [isGoogleDriveSettingsSaving, setIsGoogleDriveSettingsSaving] = useState(false);
  const [isGoogleDriveSettingsTesting, setIsGoogleDriveSettingsTesting] = useState(false);
  
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCusPersonnel, setSelectedCusPersonnel] = useState<CustomerPersonnel | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [selectedUserDeptHistory, setSelectedUserDeptHistory] = useState<UserDeptHistory | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [importLoadingText, setImportLoadingText] = useState('');
  const [isPaymentScheduleLoading, setIsPaymentScheduleLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const importInFlightRef = useRef(false);
  const prefetchedTabsRef = useRef<Set<string>>(new Set());
  const loadedModulesRef = useRef<Set<string>>(new Set());
  const recentToastByKeyRef = useRef<Map<string, number>>(new Map());
  const pageLoadVersionRef = useRef<Record<string, number>>({});
  const pageQueryDebounceRef = useRef<Record<string, number>>({});
  const employeesPageQueryRef = useRef<PaginatedQuery>({ page: 1, per_page: 7, sort_by: 'user_code', sort_dir: 'asc', q: '', filters: {} });
  const customersPageQueryRef = useRef<PaginatedQuery>({ page: 1, per_page: 10, sort_by: 'customer_code', sort_dir: 'asc', q: '', filters: {} });
  const projectsPageQueryRef = useRef<PaginatedQuery>({ page: 1, per_page: 10, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} });
  const contractsPageQueryRef = useRef<PaginatedQuery>({ page: 1, per_page: 10, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} });
  const documentsPageQueryRef = useRef<PaginatedQuery>({ page: 1, per_page: 7, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} });
  const supportRequestsPageQueryRef = useRef<PaginatedQuery>(buildSupportRequestsDefaultQuery());
  const auditLogsPageQueryRef = useRef<PaginatedQuery>({ page: 1, per_page: 10, sort_by: 'created_at', sort_dir: 'desc', q: '', filters: {} });

  const resetModuleData = () => {
    Object.keys(pageQueryDebounceRef.current).forEach((key) => {
      const timerId = pageQueryDebounceRef.current[key];
      if (typeof timerId === 'number') {
        window.clearTimeout(timerId);
      }
    });
    pageQueryDebounceRef.current = {};
    loadedModulesRef.current = new Set();
    pageLoadVersionRef.current = {};
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
    setSupportServiceGroups([]);
    setSupportRequestStatuses([]);
    setSupportRequests([]);
    setSupportRequestHistories([]);
    setEmployeesPageRows([]);
    setCustomersPageRows([]);
    setProjectsPageRows([]);
    setContractsPageRows([]);
    setDocumentsPageRows([]);
    setSupportRequestsPageRows([]);
    setAuditLogsPageRows([]);
    setEmployeesPageMeta(DEFAULT_PAGINATION_META);
    setCustomersPageMeta(DEFAULT_PAGINATION_META);
    setProjectsPageMeta(DEFAULT_PAGINATION_META);
    setContractsPageMeta(DEFAULT_PAGINATION_META);
    setDocumentsPageMeta(DEFAULT_PAGINATION_META);
    setSupportRequestsPageMeta(DEFAULT_PAGINATION_META);
    setAuditLogsPageMeta(DEFAULT_PAGINATION_META);
    setEmployeesPageLoading(false);
    setCustomersPageLoading(false);
    setProjectsPageLoading(false);
    setContractsPageLoading(false);
    setDocumentsPageLoading(false);
    setSupportRequestsPageLoading(false);
    setAuditLogsPageLoading(false);
    employeesPageQueryRef.current = { page: 1, per_page: 7, sort_by: 'user_code', sort_dir: 'asc', q: '', filters: {} };
    customersPageQueryRef.current = { page: 1, per_page: 10, sort_by: 'customer_code', sort_dir: 'asc', q: '', filters: {} };
    projectsPageQueryRef.current = { page: 1, per_page: 10, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} };
    contractsPageQueryRef.current = { page: 1, per_page: 10, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} };
    documentsPageQueryRef.current = { page: 1, per_page: 7, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} };
    supportRequestsPageQueryRef.current = buildSupportRequestsDefaultQuery();
    auditLogsPageQueryRef.current = { page: 1, per_page: 10, sort_by: 'created_at', sort_dir: 'desc', q: '', filters: {} };
    setRoles([]);
    setPermissions([]);
    setUserAccessRecords([]);
    setGoogleDriveSettings(null);
    setIsGoogleDriveSettingsLoading(false);
    setIsGoogleDriveSettingsSaving(false);
    setIsGoogleDriveSettingsTesting(false);
    recentToastByKeyRef.current.clear();
  };

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const bootstrap = await fetchAuthBootstrap();
        setAuthUser(bootstrap.user);
        setLoginError('');
      } catch {
        setAuthUser(null);
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

    const ensureDatasetLoaded = async (datasetKey: string): Promise<void> => {
      if (loadedModulesRef.current.has(datasetKey)) {
        return;
      }

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
          setProducts(
            (rows || []).map((product) => ({
              ...product,
              unit: normalizeProductUnit(product.unit),
            }))
          );
          break;
        }
        case 'customers': {
          const rows = await fetchCustomers();
          setCustomers(rows || []);
          break;
        }
        case 'customerPersonnel': {
          const rows = await fetchCustomerPersonnel();
          setCusPersonnel(rows || []);
          break;
        }
        case 'opportunities': {
          const rows = await fetchOpportunities();
          setOpportunities(rows || []);
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
          const rows = await fetchSupportServiceGroups();
          setSupportServiceGroups(rows || []);
          break;
        }
        case 'supportRequestStatuses': {
          const rows = await fetchSupportRequestStatuses();
          setSupportRequestStatuses(rows || []);
          break;
        }
        case 'supportRequests': {
          const rows = await fetchSupportRequests();
          setSupportRequests(rows || []);
          break;
        }
        case 'supportRequestHistories': {
          const rows = await fetchSupportRequestHistories(undefined, 60);
          setSupportRequestHistories(rows || []);
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
        case 'googleDriveSettings': {
          const settings = await fetchGoogleDriveIntegrationSettings().catch(() => null);
          setGoogleDriveSettings(settings);
          break;
        }
        default:
          return;
      }

      loadedModulesRef.current.add(datasetKey);
    };

    const loadByActiveTab = async () => {
      const activeModule =
        activeTab === 'internal_user_dashboard'
          ? (internalUserSubTab === 'list' ? 'internal_user_list' : 'internal_user_dashboard')
          : activeTab;

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
        cus_personnel: ['customerPersonnel', 'customers'],
        opportunities: ['opportunities', 'customers', 'customerPersonnel', 'products', 'employees'],
        projects: ['customers'],
        contracts: ['projects', 'customers', 'paymentSchedules'],
        documents: ['customers', 'products'],
        reminders: ['reminders', 'employees'],
        support_requests: [
          'supportServiceGroups',
          'supportRequestStatuses',
          'supportRequestHistories',
          'projectItems',
          'customers',
          'customerPersonnel',
          'employees',
        ],
        audit_logs: ['employees'],
        integration_settings: ['googleDriveSettings'],
        access_control: ['roles', 'permissions', 'userAccess', 'departments'],
      };

      const targets = datasetByTab[activeModule] || [];
      if (targets.length === 0) {
        return;
      }

      for (const datasetKey of targets) {
        try {
          await ensureDatasetLoaded(datasetKey);
        } catch {
          // Ignore auxiliary dataset failures here; paginated primary lists remain functional.
        }
      }

      const prefetchCandidates: Record<string, string[]> = {
        dashboard: ['internal_user_dashboard', 'projects', 'support_requests'],
        internal_user_dashboard: ['internal_user_list', 'departments'],
        internal_user_list: ['internal_user_dashboard', 'departments'],
        projects: ['contracts', 'documents'],
        contracts: ['documents', 'projects'],
        support_requests: ['audit_logs', 'clients'],
      };

      (prefetchCandidates[activeModule] || []).forEach((tabId) => {
        prefetchTabModules(tabId);
      });
    };

    void loadByActiveTab();
  }, [authUser, activeTab, internalUserSubTab]);

  // Helper to add toast
  const addToast = (type: 'success' | 'error', title: string, message: string) => {
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
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => (prev || []).filter(t => t.id !== id));
  };

  const prefetchTabModules = (tab: string) => {
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
      case 'support_requests':
        prefetchTasks.push(import('./components/SupportRequestList'));
        break;
      case 'audit_logs':
        prefetchTasks.push(import('./components/AuditLogList'));
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
  };

  const beginPageLoad = (key: string): number => {
    const nextVersion = (pageLoadVersionRef.current[key] || 0) + 1;
    pageLoadVersionRef.current[key] = nextVersion;
    return nextVersion;
  };

  const isLatestPageLoad = (key: string, version: number): boolean =>
    pageLoadVersionRef.current[key] === version;

  const schedulePageQueryLoad = (
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
  };

  const loadEmployeesPage = async (query?: PaginatedQuery) => {
    const requestKey = 'employeesPage';
    const requestVersion = beginPageLoad(requestKey);
    const effectiveQuery = query ?? employeesPageQueryRef.current;
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
    }
  };

  const loadCustomersPage = async (query?: PaginatedQuery) => {
    const requestKey = 'customersPage';
    const requestVersion = beginPageLoad(requestKey);
    const effectiveQuery = query ?? customersPageQueryRef.current;
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
    }
  };

  const loadProjectsPage = async (query?: PaginatedQuery) => {
    const requestKey = 'projectsPage';
    const requestVersion = beginPageLoad(requestKey);
    const effectiveQuery = query ?? projectsPageQueryRef.current;
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
    }
  };

  const loadContractsPage = async (query?: PaginatedQuery) => {
    const requestKey = 'contractsPage';
    const requestVersion = beginPageLoad(requestKey);
    const effectiveQuery = query ?? contractsPageQueryRef.current;
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
    }
  };

  const loadDocumentsPage = async (query?: PaginatedQuery) => {
    const requestKey = 'documentsPage';
    const requestVersion = beginPageLoad(requestKey);
    const effectiveQuery = query ?? documentsPageQueryRef.current;
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
    }
  };

  const loadSupportRequestsPage = async (query?: PaginatedQuery) => {
    const requestKey = 'supportRequestsPage';
    const requestVersion = beginPageLoad(requestKey);
    const effectiveQuery = query ?? supportRequestsPageQueryRef.current;
    supportRequestsPageQueryRef.current = effectiveQuery;
    setSupportRequestsPageLoading(true);
    try {
      const result = await fetchSupportRequestsPage(effectiveQuery);
      if (!isLatestPageLoad(requestKey, requestVersion)) {
        return;
      }
      setSupportRequestsPageRows(result.data || []);
      setSupportRequestsPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (error) {
      if (!isLatestPageLoad(requestKey, requestVersion) || isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách yêu cầu hỗ trợ.';
      addToast('error', 'Tải dữ liệu thất bại', message);
    } finally {
      if (isLatestPageLoad(requestKey, requestVersion)) {
        setSupportRequestsPageLoading(false);
      }
    }
  };

  const loadAuditLogsPage = async (query?: PaginatedQuery) => {
    const requestKey = 'auditLogsPage';
    const requestVersion = beginPageLoad(requestKey);
    const effectiveQuery = query ?? auditLogsPageQueryRef.current;
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
    }
  };

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
      'support_requests',
      'audit_logs',
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
    try {
      const session = await login(payload);
      setAuthUser(session.user);
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
      setActiveTab('dashboard');
      setInternalUserSubTab('dashboard');
      setModalType(null);
      setToasts([]);
      recentToastByKeyRef.current.clear();
      setLoginError('');
      resetModuleData();
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
      const columnIndex = headerIndex.get(alias);
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

  const normalizeSupportPriorityImport = (value: string): SupportRequest['priority'] => {
    const token = normalizeImportToken(value);
    if (['urgent', 'khan', 'khancap'].includes(token)) return 'URGENT';
    if (['high', 'cao'].includes(token)) return 'HIGH';
    if (['medium', 'trungbinh', 'tb'].includes(token)) return 'MEDIUM';
    if (['low', 'thap'].includes(token)) return 'LOW';
    return 'MEDIUM';
  };

  const normalizeSupportStatusImport = (value: string): SupportRequest['status'] => {
    const token = normalizeImportToken(value);
    if (['new', 'open', 'mo', 'moitiepnhan', 'vuatao'].includes(token)) return 'NEW';
    if (['inprogress', 'dangxuly', 'xuly', 'in_progress'].includes(token)) return 'IN_PROGRESS';
    if (['waitingcustomer', 'waiting_customer', 'chophanhoikh', 'chophanhoikhachhang'].includes(token)) return 'WAITING_CUSTOMER';
    if (['completed', 'resolved', 'deployed', 'hoanthanh', 'daxuly', 'datrienkhai', 'trienkhai'].includes(token)) return 'COMPLETED';
    if (['paused', 'tamdung'].includes(token)) return 'PAUSED';
    if (['transferdev', 'transfer_dev', 'chuyendev', 'hotfixing', 'hotfix', 'danghotfix'].includes(token)) return 'TRANSFER_DEV';
    if (['transferdms', 'transfer_dms', 'chuyendms'].includes(token)) return 'TRANSFER_DMS';
    if (['unabletoexecute', 'unable_to_execute', 'khongthuchienduoc', 'khongthuchiendc', 'cancelled', 'cancel', 'huy'].includes(token)) {
      return 'UNABLE_TO_EXECUTE';
    }
    return 'NEW';
  };

  const normalizeImportDate = (value: string): string | null => {
    const text = String(value || '').trim();
    if (!text) return null;

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
        const existingCodes = new Set((businesses || []).map((item) => normalizeImportToken(item.domain_code)));
        const today = new Date().toISOString().split('T')[0];

        rows.forEach((row, rowIndex) => {
          const rowNumber = rowIndex + 2;
          const domainCode = getImportCell(row, headerIndex, ['malinhvuc', 'domaincode', 'businesscode', 'code']);
          const domainName = getImportCell(row, headerIndex, ['tenlinhvuc', 'domainname', 'businessname', 'name']);

          if (!domainCode && !domainName) {
            return;
          }

          if (!domainCode || !domainName) {
            failures.push(`Dòng ${rowNumber}: thiếu Mã lĩnh vực hoặc Tên lĩnh vực.`);
            return;
          }

          const codeToken = normalizeImportToken(domainCode);
          if (!codeToken || existingCodes.has(codeToken)) {
            failures.push(`Dòng ${rowNumber}: Mã lĩnh vực "${domainCode}" đã tồn tại.`);
            return;
          }

          existingCodes.add(codeToken);
          createdItems.push({
            id: domainCode,
            domain_code: domainCode,
            domain_name: domainName,
            created_at: today,
          });
        });

        if (createdItems.length > 0) {
          setBusinesses((prev) => [...createdItems, ...(prev || [])]);
        }

        summarizeImportResult('Lĩnh vực', createdItems.length, failures);
        exportImportFailureFile(payload, 'Lĩnh vực', failures);
        if (createdItems.length > 0 && failures.length === 0) {
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
        const today = new Date().toISOString().split('T')[0];

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

          existingCodes.add(productCodeToken);
          createdItems.push({
            id: productCode,
            product_code: productCode,
            product_name: productName,
            domain_id: business.id,
            vendor_id: vendor.id,
            standard_price: parsedStandardPrice ?? 0,
            unit: normalizeProductUnit(unitRaw),
            created_at: today,
          });
        });

        if (createdItems.length > 0) {
          setProducts((prev) => [...createdItems, ...(prev || [])]);
        }

        summarizeImportResult('Sản phẩm', createdItems.length, failures);
        exportImportFailureFile(payload, 'Sản phẩm', failures);
        if (createdItems.length > 0 && failures.length === 0) {
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
      } else if (moduleToken === 'supportrequests') {
        const failures: string[] = [];
        const importEntries: Array<{ rowNumber: number; payload: Partial<SupportRequest> }> = [];
        const createdItems: SupportRequest[] = [];
        let abortedByInfraIssue = false;
        setImportProgress('Yêu cầu hỗ trợ', 0, rows.length);

        const customerByToken = new Map<string, Customer>();
        const customerById = new Map<string, Customer>();
        (customers || []).forEach((customer) => {
          customerById.set(String(customer.id), customer);
          customerByToken.set(normalizeImportToken(customer.customer_code), customer);
          customerByToken.set(normalizeImportToken(customer.customer_name), customer);
          customerByToken.set(normalizeImportToken(customer.id), customer);
        });

        const projectByToken = new Map<string, Project>();
        (projects || []).forEach((project) => {
          projectByToken.set(normalizeImportToken(project.project_code), project);
          projectByToken.set(normalizeImportToken(project.project_name), project);
          projectByToken.set(normalizeImportToken(project.id), project);
        });

        const productByToken = new Map<string, Product>();
        (products || []).forEach((product) => {
          productByToken.set(normalizeImportToken(product.product_code), product);
          productByToken.set(normalizeImportToken(product.product_name), product);
          productByToken.set(normalizeImportToken(product.id), product);
        });

        const groupByToken = new Map<string, SupportServiceGroup>();
        (supportServiceGroups || []).forEach((group) => {
          groupByToken.set(normalizeImportToken(group.group_name), group);
          groupByToken.set(normalizeImportToken(group.id), group);
        });

        const employeeByToken = new Map<string, Employee>();
        (employees || []).forEach((employee) => {
          const code = employee.employee_code || employee.user_code || employee.username;
          employeeByToken.set(normalizeImportToken(code), employee);
          employeeByToken.set(normalizeImportToken(employee.username), employee);
          employeeByToken.set(normalizeImportToken(employee.full_name), employee);
          employeeByToken.set(normalizeImportToken(employee.id), employee);
        });

        const projectItemByToken = new Map<string, ProjectItemMaster>();
        const projectItemByProjectProduct = new Map<string, ProjectItemMaster>();
        const setProjectItemToken = (rawValue: unknown, item: ProjectItemMaster): void => {
          const token = normalizeImportToken(rawValue);
          if (!token || projectItemByToken.has(token)) {
            return;
          }
          projectItemByToken.set(token, item);
        };

        (projectItems || []).forEach((item) => {
          setProjectItemToken(item.id, item);
          setProjectItemToken(item.display_name, item);
          setProjectItemToken(item.project_code, item);
          setProjectItemToken(item.project_name, item);
          setProjectItemToken(item.product_code, item);
          setProjectItemToken(item.product_name, item);
          setProjectItemToken(item.customer_code, item);
          setProjectItemToken(item.customer_name, item);
          setProjectItemToken(
            `${item.project_code || ''} - ${item.project_name || ''} | ${item.product_code || ''} - ${item.product_name || ''} | ${item.customer_code || ''} - ${item.customer_name || ''}`,
            item
          );
          setProjectItemToken(
            `${item.project_name || ''} | ${item.product_name || ''} | ${item.customer_name || ''}`,
            item
          );

          const byProjectProductKey = `${String(item.project_id || '')}|${String(item.product_id || '')}`;
          if (!projectItemByProjectProduct.has(byProjectProductKey)) {
            projectItemByProjectProduct.set(byProjectProductKey, item);
          }
        });

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          const row = rows[rowIndex];
          const rowNumber = rowIndex + 2;
          const ticketCode = getImportCell(row, headerIndex, ['ticket', 'matask', 'maticket', 'ticketcode', 'jiracode']);
          const summary = getImportCell(row, headerIndex, ['noidungyeucau', 'summary', 'noidung', 'yeucau']);
          const projectItemRaw = getImportCell(row, headerIndex, [
            'phanmemtrienkhai',
            'hangmucduan',
            'hangmuc',
            'projectitem',
            'projectitems',
            'projectitemid',
            'projectitemcode',
            'projectitemname',
            'projectitemdisplay',
            'projectitemlabel',
            'projectitemmaster',
          ]);
          const customerRaw = getImportCell(row, headerIndex, ['donviyeucau', 'khachhang', 'makhachhang', 'customercode', 'customer']);
          const serviceGroupRaw = getImportCell(row, headerIndex, ['nhomzalotelegramyeucau', 'nhomzalotelegram', 'nhomhotro', 'servicegroup', 'supportgroup', 'group']);
          const assigneeRaw = getImportCell(row, headerIndex, ['nguoixuly', 'assignee', 'assigneecode', 'assigneeid', 'manv', 'usercode']);
          const projectRaw = getImportCell(row, headerIndex, ['duan', 'project', 'projectcode', 'maduan']);
          const productRaw = getImportCell(row, headerIndex, ['sanpham', 'product', 'productcode', 'masanpham']);
          const reporterName = getImportCell(row, headerIndex, ['nguoibao', 'reporter', 'reportername']);
          const priorityRaw = getImportCell(row, headerIndex, ['uutien', 'priority']);
          const statusRaw = getImportCell(row, headerIndex, ['trangthai', 'status']);
          const requestedDateRaw = getImportCell(row, headerIndex, ['ngaynhanyeucau', 'requesteddate', 'ngaynhan']);
          const dueDateRaw = getImportCell(row, headerIndex, ['hanhoanthanh', 'duedate', 'hanxuly']);
          const resolvedDateRaw = getImportCell(row, headerIndex, ['ngayhoanthanh', 'resolveddate']);
          const hotfixDateRaw = getImportCell(row, headerIndex, ['ngaydayhotfix', 'hotfixdate']);
          const notiDateRaw = getImportCell(row, headerIndex, ['ngaythongbaokh', 'notidate', 'notificationdate']);
          const taskLink = getImportCell(row, headerIndex, ['tasklink', 'linkjira', 'link']);
          const notes = getImportCell(row, headerIndex, ['ghichu', 'notes']);

          if (!ticketCode && !summary && !projectItemRaw && !customerRaw && !serviceGroupRaw && !assigneeRaw && !projectRaw && !productRaw && !reporterName && !priorityRaw && !statusRaw && !requestedDateRaw && !dueDateRaw && !resolvedDateRaw && !hotfixDateRaw && !notiDateRaw && !taskLink && !notes) {
            continue;
          }

          if (!summary) {
            failures.push(`Dòng ${rowNumber}: thiếu Nội dung yêu cầu.`);
            continue;
          }

          const projectItem = projectItemRaw ? projectItemByToken.get(normalizeImportToken(projectItemRaw)) : undefined;
          if (projectItemRaw && !projectItem) {
            failures.push(`Dòng ${rowNumber}: không tìm thấy hạng mục dự án "${projectItemRaw}".`);
            continue;
          }

          const project = projectRaw ? projectByToken.get(normalizeImportToken(projectRaw)) : undefined;
          if (projectRaw && !project) {
            failures.push(`Dòng ${rowNumber}: không tìm thấy dự án "${projectRaw}".`);
            continue;
          }

          const product = productRaw ? productByToken.get(normalizeImportToken(productRaw)) : undefined;
          if (productRaw && !product) {
            failures.push(`Dòng ${rowNumber}: không tìm thấy sản phẩm "${productRaw}".`);
            continue;
          }

          let resolvedProjectItem = projectItem;
          if (!resolvedProjectItem && project && product) {
            const projectProductKey = `${String(project.id)}|${String(product.id)}`;
            resolvedProjectItem = projectItemByProjectProduct.get(projectProductKey);
          }

          const resolvedCustomer = (() => {
            if (resolvedProjectItem) {
              const itemCustomerId = resolvedProjectItem.customer_id;
              if (itemCustomerId !== null && itemCustomerId !== undefined && String(itemCustomerId).trim() !== '') {
                return (
                  customerById.get(String(itemCustomerId)) ||
                  customerByToken.get(normalizeImportToken(itemCustomerId)) ||
                  customerByToken.get(normalizeImportToken(resolvedProjectItem.customer_code || '')) ||
                  customerByToken.get(normalizeImportToken(resolvedProjectItem.customer_name || ''))
                );
              }
            }

            if (!customerRaw) {
              return undefined;
            }

            return customerByToken.get(normalizeImportToken(customerRaw));
          })();

          if (!resolvedCustomer) {
            failures.push(
              `Dòng ${rowNumber}: không xác định được khách hàng. Vui lòng nhập "Phần mềm triển khai" hợp lệ hoặc mã/tên khách hàng.`
            );
            continue;
          }

          const serviceGroup = serviceGroupRaw ? groupByToken.get(normalizeImportToken(serviceGroupRaw)) : undefined;
          if (serviceGroupRaw && !serviceGroup) {
            failures.push(`Dòng ${rowNumber}: không tìm thấy nhóm Zalo/Telegram yêu cầu "${serviceGroupRaw}".`);
            continue;
          }

          const assignee = assigneeRaw ? employeeByToken.get(normalizeImportToken(assigneeRaw)) : undefined;
          if (assigneeRaw && !assignee) {
            failures.push(`Dòng ${rowNumber}: không tìm thấy người xử lý "${assigneeRaw}".`);
            continue;
          }

          const requestedDate = normalizeImportDate(requestedDateRaw) || new Date().toISOString().slice(0, 10);
          const dueDate = dueDateRaw ? normalizeImportDate(dueDateRaw) : null;
          const resolvedDate = resolvedDateRaw ? normalizeImportDate(resolvedDateRaw) : null;
          const hotfixDate = hotfixDateRaw ? normalizeImportDate(hotfixDateRaw) : null;
          const notiDate = notiDateRaw ? normalizeImportDate(notiDateRaw) : null;

          if ((dueDateRaw && !dueDate) || (resolvedDateRaw && !resolvedDate) || (hotfixDateRaw && !hotfixDate) || (notiDateRaw && !notiDate)) {
            failures.push(`Dòng ${rowNumber}: có ngày tháng không hợp lệ.`);
            continue;
          }

          const resolvedProjectId = resolvedProjectItem?.project_id || project?.id || null;
          const resolvedProductId = resolvedProjectItem?.product_id || product?.id || null;

          importEntries.push({
            rowNumber,
            payload: {
              ticket_code: ticketCode || null,
              summary,
              project_item_id: resolvedProjectItem?.id || null,
              customer_id: resolvedCustomer.id,
              service_group_id: serviceGroup?.id || null,
              assignee_id: assignee?.id || null,
              project_id: resolvedProjectId,
              product_id: resolvedProductId,
              reporter_name: reporterName || null,
              priority: normalizeSupportPriorityImport(priorityRaw),
              status: normalizeSupportStatusImport(statusRaw),
              requested_date: requestedDate,
              due_date: dueDate,
              resolved_date: resolvedDate,
              hotfix_date: hotfixDate,
              noti_date: notiDate,
              task_link: taskLink || null,
              notes: notes || null,
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
              const bulkResult = await createSupportRequestsBulk(chunk.map((entry) => entry.payload));
              const rowResults = bulkResult.results || [];

              if (rowResults.length === 0) {
                chunk.forEach((entry) => {
                  failures.push(`Dòng ${entry.rowNumber}: backend không trả kết quả chi tiết.`);
                });
                processed += chunk.length;
                setImportProgress('Yêu cầu hỗ trợ', processed, totalImportEntries);
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
                failures.push(`Batch yêu cầu hỗ trợ: ${message}`);
                failures.push('Đã dừng import do lỗi kết nối mạng hoặc máy chủ. Vui lòng thử lại sau khi hệ thống ổn định.');
                abortedByInfraIssue = true;
                break;
              }

              chunk.forEach((entry) => {
                failures.push(`Dòng ${entry.rowNumber}: ${message}`);
              });
            }

            processed += chunk.length;
            setImportProgress('Yêu cầu hỗ trợ', processed, totalImportEntries);
          }
        }

        if (!abortedByInfraIssue) {
          setImportProgress('Yêu cầu hỗ trợ', totalImportEntries, totalImportEntries);
        }

        if (abortedByInfraIssue) {
          await rollbackImportedRows('Yêu cầu hỗ trợ', createdItems, deleteSupportRequest);
        } else if (createdItems.length > 0) {
          setSupportRequests((prev) => [...createdItems, ...(prev || [])]);
          await refreshSupportRequestHistories();
          void loadSupportRequestsPage();
        }

        const importedSupportRequestCount = abortedByInfraIssue ? 0 : createdItems.length;
        summarizeImportResult('Yêu cầu hỗ trợ', importedSupportRequestCount, failures);
        exportImportFailureFile(payload, 'Yêu cầu hỗ trợ', failures);
        if (importedSupportRequestCount > 0 && failures.length === 0 && !abortedByInfraIssue) {
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
    setSelectedContract(null);
    setSelectedDocument(null);
    setSelectedReminder(null);

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
       setSelectedCusPersonnel(item as CustomerPersonnel);
    } else if (type?.includes('OPPORTUNITY')) {
       setSelectedOpportunity(item as Opportunity);
    } else if (type?.includes('PROJECT')) {
       setSelectedProject(item as Project);
    } else if (type?.includes('CONTRACT')) {
       setSelectedContract(item as Contract);
    } else if (type?.includes('DOCUMENT')) {
       setSelectedDocument(item as Document);
    } else if (type?.includes('REMINDER')) {
       setSelectedReminder(item as Reminder);
    } else if (type?.includes('USER_DEPT_HISTORY')) {
       setSelectedUserDeptHistory((item as UserDeptHistory) || null);
    } else if (item && 'dept_code' in item) {
       setSelectedDept(item as Department);
    }
  };

  const handleCloseModal = () => {
    setModalType(null);
    setSelectedDept(null);
    setSelectedEmployee(null);
    setSelectedBusiness(null);
    setSelectedVendor(null);
    setSelectedProduct(null);
    setSelectedCustomer(null);
    setSelectedCusPersonnel(null);
    setSelectedOpportunity(null);
    setSelectedProject(null);
    setSelectedContract(null);
    setSelectedDocument(null);
    setSelectedReminder(null);
    setSelectedUserDeptHistory(null);
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
          const created = await createEmployee(data);
          setEmployees([created, ...employees]);
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
    await new Promise(resolve => setTimeout(resolve, 1000));

    const businessData: Business = {
       id: data.domain_code!,
       domain_code: data.domain_code!,
       domain_name: data.domain_name!,
       created_at: data.created_at || new Date().toISOString().split('T')[0]
    };

    if (modalType === 'ADD_BUSINESS') {
      setBusinesses([businessData, ...businesses]);
      addToast('success', 'Thành công', 'Thêm mới lĩnh vực kinh doanh thành công!');
    } else if (modalType === 'EDIT_BUSINESS') {
      setBusinesses(businesses.map(b => b.id === businessData.id ? businessData : b));
      addToast('success', 'Thành công', 'Cập nhật lĩnh vực thành công!');
    }
    setIsSaving(false);
    handleCloseModal();
  };

  const handleDeleteBusiness = async () => {
    if (!selectedBusiness) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
    setBusinesses((businesses || []).filter(b => b.id !== selectedBusiness.id));
    addToast('success', 'Thành công', 'Đã xóa lĩnh vực kinh doanh.');
    handleCloseModal();
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

  // --- Product Handlers ---
  const handleSaveProduct = async (data: Partial<Product>) => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const editingTarget = modalType === 'EDIT_PRODUCT' ? selectedProduct : null;
    const resolvedId = editingTarget?.id ?? data.id ?? data.product_code!;
    const productData: Product = {
      id: resolvedId,
      product_code: data.product_code!,
      product_name: data.product_name!,
      domain_id: data.domain_id!,
      vendor_id: data.vendor_id!,
      standard_price: data.standard_price || 0,
      unit: normalizeProductUnit(data.unit),
      created_at: editingTarget?.created_at || data.created_at || new Date().toISOString().split('T')[0]
    };

    if (modalType === 'ADD_PRODUCT') {
      setProducts([productData, ...products]);
      addToast('success', 'Thành công', 'Thêm mới sản phẩm thành công!');
    } else if (modalType === 'EDIT_PRODUCT' && editingTarget) {
      setProducts(
        products.map((product) => {
          const sameId = String(product.id) === String(editingTarget.id);
          const sameCode = String(product.product_code) === String(editingTarget.product_code);
          return sameId || sameCode ? productData : product;
        })
      );
      addToast('success', 'Thành công', 'Cập nhật sản phẩm thành công!');
    }
    setIsSaving(false);
    handleCloseModal();
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
    setProducts((products || []).filter(p => p.id !== selectedProduct.id));
    addToast('success', 'Thành công', 'Đã xóa sản phẩm.');
    handleCloseModal();
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
    await new Promise(resolve => setTimeout(resolve, 1000));

    const newItem: CustomerPersonnel = {
      id: data.id || `CP${Date.now()}`, 
      fullName: data.fullName!,
      birthday: data.birthday!,
      positionType: data.positionType!,
      phoneNumber: data.phoneNumber!,
      email: data.email!,
      customerId: data.customerId!,
      status: data.status || 'Active',
    };

    if (modalType === 'ADD_CUS_PERSONNEL') {
      setCusPersonnel([newItem, ...cusPersonnel]);
      addToast('success', 'Thành công', 'Thêm mới nhân sự liên hệ thành công!');
    } else if (modalType === 'EDIT_CUS_PERSONNEL') {
      setCusPersonnel(cusPersonnel.map(p => p.id === selectedCusPersonnel?.id ? { ...newItem, id: selectedCusPersonnel.id } : p));
      addToast('success', 'Thành công', 'Cập nhật nhân sự liên hệ thành công!');
    }
    setIsSaving(false);
    handleCloseModal();
  };

  const handleDeleteCusPersonnel = async () => {
    if (!selectedCusPersonnel) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
    setCusPersonnel((cusPersonnel || []).filter(p => p.id !== selectedCusPersonnel.id));
    addToast('success', 'Thành công', 'Đã xóa nhân sự liên hệ.');
    handleCloseModal();
  };

  // --- Opportunity Handlers ---
  const handleSaveOpportunity = async (data: Partial<Opportunity>) => {
    setIsSaving(true);
    try {
      if (modalType === 'ADD_OPPORTUNITY') {
        const created = await createOpportunity(data);
        setOpportunities([created, ...opportunities]);
        addToast('success', 'Thành công', 'Thêm mới cơ hội thành công!');
      } else if (modalType === 'EDIT_OPPORTUNITY' && selectedOpportunity) {
        const updated = await updateOpportunity(selectedOpportunity.id, data);
        setOpportunities(
          (opportunities || []).map(o =>
            String(o.id) === String(updated.id)
              ? updated
              : o
          )
        );
        addToast('success', 'Thành công', 'Cập nhật cơ hội thành công!');
      }
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
      const payload = data as Partial<Project> & Record<string, unknown>;
      if (modalType === 'ADD_PROJECT') {
        const created = await createProject(payload);
        setProjects([created, ...projects]);
        setActiveTab('projects');
        addToast('success', 'Thành công', 'Thêm mới dự án thành công!');
      } else if (modalType === 'EDIT_PROJECT' && selectedProject) {
        const updated = await updateProject(selectedProject.id, payload);
        setProjects(
          (projects || []).map(p =>
            String(p.id) === String(updated.id)
              ? updated
              : p
          )
        );
        addToast('success', 'Thành công', 'Cập nhật dự án thành công!');
      }
      handleCloseModal();
      void loadProjectsPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu thất bại', `Không thể lưu dự án vào cơ sở dữ liệu. ${message}`);
      setIsSaving(false);
    }
  };

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

  // --- Contract Handlers ---
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

  const handleGenerateSchedules = async (contractId: string | number, options?: { silent?: boolean }) => {
    if (!hasPermission(authUser, 'contracts.payments')) {
      throw new Error('Bạn không có quyền sinh kế hoạch thanh toán.');
    }

    setIsPaymentScheduleLoading(true);
    try {
      const generated = await generateContractPayments(contractId);
      replaceSchedulesByContract(contractId, generated);
      if (!options?.silent) {
        addToast('success', 'Thành công', `Đã đồng bộ ${generated.length} kỳ thanh toán.`);
      }
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
    payload: Pick<PaymentSchedule, 'actual_paid_date' | 'actual_paid_amount' | 'status' | 'notes'>
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

  const refreshSupportRequestHistories = async () => {
    try {
      const rows = await fetchSupportRequestHistories();
      setSupportRequestHistories(rows);
    } catch {
      // Ignore refresh error, toast handled by caller.
    }
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

  const handleCreateSupportRequest = async (data: Partial<SupportRequest>) => {
    if (!hasPermission(authUser, 'support_requests.write')) {
      const error = new Error('Bạn không có quyền thêm yêu cầu hỗ trợ.');
      addToast('error', 'Không đủ quyền', error.message);
      throw error;
    }

    try {
      const created = await createSupportRequest(data);
      setSupportRequests((prev) => [created, ...(prev || [])]);
      await refreshSupportRequestHistories();
      addToast('success', 'Thành công', 'Đã thêm yêu cầu hỗ trợ.');
      void loadSupportRequestsPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Lưu thất bại', `Không thể thêm yêu cầu hỗ trợ. ${message}`);
      throw error;
    }
  };

  const handleUpdateSupportRequest = async (id: string | number, data: Partial<SupportRequest>) => {
    if (!hasPermission(authUser, 'support_requests.write')) {
      const error = new Error('Bạn không có quyền cập nhật yêu cầu hỗ trợ.');
      addToast('error', 'Không đủ quyền', error.message);
      throw error;
    }

    try {
      const updated = await updateSupportRequest(id, data);
      setSupportRequests((prev) =>
        (prev || []).map((item) =>
          String(item.id) === String(updated.id)
            ? updated
            : item
        )
      );
      await refreshSupportRequestHistories();
      addToast('success', 'Thành công', 'Đã cập nhật yêu cầu hỗ trợ.');
      void loadSupportRequestsPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Cập nhật thất bại', `Không thể cập nhật yêu cầu hỗ trợ. ${message}`);
      throw error;
    }
  };

  const handleDeleteSupportRequest = async (id: string | number) => {
    if (!hasPermission(authUser, 'support_requests.delete')) {
      const error = new Error('Bạn không có quyền xóa yêu cầu hỗ trợ.');
      addToast('error', 'Không đủ quyền', error.message);
      throw error;
    }

    try {
      await deleteSupportRequest(id);
      setSupportRequests((prev) => (prev || []).filter((item) => String(item.id) !== String(id)));
      await refreshSupportRequestHistories();
      addToast('success', 'Thành công', 'Đã xóa yêu cầu hỗ trợ.');
      void loadSupportRequestsPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Xóa thất bại', `Không thể xóa yêu cầu hỗ trợ. ${message}`);
      throw error;
    }
  };

  const handleUpdateSupportRequestStatus = async (
    id: string | number,
    status: SupportRequestStatus,
    comment?: string | null
  ) => {
    if (!hasPermission(authUser, 'support_requests.status')) {
      const error = new Error('Bạn không có quyền đổi trạng thái yêu cầu.');
      addToast('error', 'Không đủ quyền', error.message);
      throw error;
    }

    try {
      const updated = await updateSupportRequestStatus(id, {
        new_status: status,
        comment: comment || null,
      });
      setSupportRequests((prev) =>
        (prev || []).map((item) =>
          String(item.id) === String(updated.id)
            ? updated
            : item
        )
      );
      await refreshSupportRequestHistories();
      addToast('success', 'Thành công', 'Đã cập nhật trạng thái yêu cầu.');
      void loadSupportRequestsPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Cập nhật thất bại', `Không thể cập nhật trạng thái. ${message}`);
      throw error;
    }
  };

  const handleLoadSupportRequestHistory = async (id: string | number): Promise<SupportRequestHistory[]> => {
    if (!hasPermission(authUser, 'support_requests.history')) {
      const error = new Error('Bạn không có quyền xem lịch sử yêu cầu hỗ trợ.');
      addToast('error', 'Không đủ quyền', error.message);
      throw error;
    }

    try {
      return await fetchSupportRequestHistory(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Tải lịch sử thất bại', `Không thể tải lịch sử trạng thái. ${message}`);
      throw error;
    }
  };

  const handleLoadSupportRequestReceivers = async (params?: {
    project_id?: string | number | null;
    project_item_id?: string | number | null;
  }): Promise<SupportRequestReceiverResult> => {
    if (!hasPermission(authUser, 'support_requests.read')) {
      const error = new Error('Bạn không có quyền xem danh sách người tiếp nhận.');
      addToast('error', 'Không đủ quyền', error.message);
      throw error;
    }

    try {
      return await fetchSupportRequestReceivers(params);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Tải dữ liệu thất bại', `Không thể tải danh sách người tiếp nhận. ${message}`);
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

  const handleTestGoogleDriveIntegration = async () => {
    setIsGoogleDriveSettingsTesting(true);
    try {
      const result = await testGoogleDriveIntegrationSettings();
      await refreshGoogleDriveSettings();
      addToast('success', 'Kết nối Google Drive', result.message || 'Kết nối thành công.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      addToast('error', 'Kiểm tra kết nối thất bại', message);
    } finally {
      setIsGoogleDriveSettingsTesting(false);
    }
  };

  // --- Dashboard Stats ---
  const OPPORTUNITY_STAGE_ORDER: OpportunityStage[] = ['NEW', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
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

  const pipelineByStage = OPPORTUNITY_STAGE_ORDER.map((stage) => ({
    stage,
    value: (opportunities || [])
      .filter((opp) => opp.stage === stage)
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
        onSubmit={handleLogin}
      />
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
            <Dashboard stats={dashboardStats} />
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
            onListQueryChange={(query) => {
              schedulePageQueryLoad('employeesPage', query, loadEmployeesPage);
            }}
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
            onQueryChange={(query) => {
              schedulePageQueryLoad('customersPage', query, loadCustomersPage);
            }}
          />
        )}

        {activeTab === 'cus_personnel' && (
          <CusPersonnelList 
            personnel={cusPersonnel}
            customers={customers}
            onOpenModal={handleOpenModal} 
          />
        )}

        {activeTab === 'opportunities' && (
          <OpportunityList 
             opportunities={opportunities}
             customers={customers}
             personnel={cusPersonnel}
             products={products}
             employees={employees}
             onOpenModal={handleOpenModal}
             onConvert={handleConvertOpportunity}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectList 
             projects={projectsPageRows}
             customers={customers}
             onOpenModal={handleOpenModal}
             paginationMeta={projectsPageMeta}
             isLoading={projectsPageLoading}
             onQueryChange={(query) => {
               schedulePageQueryLoad('projectsPage', query, loadProjectsPage);
             }}
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
             onQueryChange={(query) => {
               schedulePageQueryLoad('contractsPage', query, loadContractsPage);
             }}
          />
        )}

        {activeTab === 'documents' && (
          <DocumentList 
             documents={documentsPageRows}
             customers={customers}
             onOpenModal={handleOpenModal}
             paginationMeta={documentsPageMeta}
             isLoading={documentsPageLoading}
             onQueryChange={(query) => {
               schedulePageQueryLoad('documentsPage', query, loadDocumentsPage);
             }}
          />
        )}

        {activeTab === 'reminders' && (
          <ReminderList 
             reminders={reminders}
             employees={employees}
             onOpenModal={handleOpenModal}
          />
        )}

        {activeTab === 'support_requests' && (
          <SupportRequestList
            supportRequests={supportRequestsPageRows}
            supportServiceGroups={supportServiceGroups}
            supportRequestStatuses={supportRequestStatuses}
            supportRequestHistories={supportRequestHistories}
            projectItems={projectItems}
            customers={customers}
            customerPersonnel={cusPersonnel}
            projects={projects}
            products={products}
            employees={employees}
            onCreateSupportServiceGroup={handleCreateSupportServiceGroup}
            onCreateSupportServiceGroupBulk={handleCreateSupportServiceGroupsBulk}
            onCreateSupportRequestStatus={handleCreateSupportRequestStatus}
            onCreateSupportRequestStatusesBulk={handleCreateSupportRequestStatusesBulk}
            onCreateSupportRequest={handleCreateSupportRequest}
            onUpdateSupportRequest={handleUpdateSupportRequest}
            onDeleteSupportRequest={handleDeleteSupportRequest}
            onLoadSupportRequestHistory={handleLoadSupportRequestHistory}
            onLoadSupportRequestReceivers={handleLoadSupportRequestReceivers}
            onOpenImportModal={() => handleOpenModal('IMPORT_DATA')}
            paginationMeta={supportRequestsPageMeta}
            isLoading={supportRequestsPageLoading}
            onQueryChange={(query) => {
              schedulePageQueryLoad('supportRequestsPage', query, loadSupportRequestsPage);
            }}
          />
        )}

        {activeTab === 'audit_logs' && (
          <AuditLogList
            auditLogs={auditLogsPageRows}
            employees={employees}
            paginationMeta={auditLogsPageMeta}
            isLoading={auditLogsPageLoading}
            onQueryChange={(query) => {
              schedulePageQueryLoad('auditLogsPage', query, loadAuditLogsPage);
            }}
          />
        )}

        {activeTab === 'integration_settings' && (
          <IntegrationSettingsPanel
            settings={googleDriveSettings}
            isLoading={isGoogleDriveSettingsLoading}
            isSaving={isGoogleDriveSettingsSaving}
            isTesting={isGoogleDriveSettingsTesting}
            onRefresh={refreshGoogleDriveSettings}
            onSave={handleSaveGoogleDriveSettings}
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
            onUpdatePermissions={handleUpdateAccessPermissions}
            onUpdateScopes={handleUpdateAccessScopes}
          />
        )}

          {/* Placeholder for other tabs */}
          {['dashboard', 'internal_user_dashboard', 'internal_user_list', 'departments', 'businesses', 'vendors', 'products', 'clients', 'cus_personnel', 'opportunities', 'projects', 'contracts', 'documents', 'reminders', 'support_requests', 'user_dept_history', 'audit_logs', 'integration_settings', 'access_control'].indexOf(activeTab) === -1 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4 text-center">
                <span className="material-symbols-outlined text-6xl mb-4">construction</span>
                <p className="text-lg font-medium">Chức năng đang phát triển...</p>
              </div>
          )}
        </Suspense>
      </main>

      <ToastContainer toasts={toasts} removeToast={removeToast} />

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
             activeModuleKey === 'departments' ? "Nhập dữ liệu phòng ban" : 
             activeModuleKey === 'internal_user_list' ? "Nhập dữ liệu nhân sự" :
             activeModuleKey === 'businesses' ? "Nhập dữ liệu lĩnh vực" :
             activeModuleKey === 'vendors' ? "Nhập dữ liệu đối tác" :
             activeModuleKey === 'products' ? "Nhập dữ liệu sản phẩm" :
             activeModuleKey === 'clients' ? "Nhập dữ liệu khách hàng" :
             activeModuleKey === 'support_requests' ? "Nhập dữ liệu yêu cầu hỗ trợ" :
             activeModuleKey === 'opportunities' ? "Nhập dữ liệu cơ hội" :
             activeModuleKey === 'projects' ? "Nhập dữ liệu dự án" :
             "Nhập dữ liệu nhân sự liên hệ"
           }
           moduleKey={activeModuleKey}
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
          type={modalType === 'ADD_PROJECT' ? 'ADD' : 'EDIT'}
          data={selectedProject}
          customers={customers}
          opportunities={opportunities}
          products={products}
          employees={employees}
          departments={departments}
          onClose={handleCloseModal}
          onSave={handleSaveProject}
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
          data={selectedContract}
          projects={projects}
          customers={customers}
          paymentSchedules={paymentSchedules}
          isPaymentLoading={isPaymentScheduleLoading}
          onClose={handleCloseModal}
          onSave={handleSaveContract}
          onGenerateSchedules={handleGenerateSchedules}
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
