import React, { lazy } from 'react';
import {
  AuthUser,
  DashboardStats,
  HRStatistics,
  Department,
  Employee,
  EmployeePartyListItem,
  UserDeptHistory,
  Business,
  Vendor,
  Product,
  ProductPackage,
  Customer,
  CustomerPersonnel,
  Project,
  ProjectItemMaster,
  ProjectRaciRow,
  Contract,
  PaymentSchedule,
  Document,
  Reminder,
  SendReminderEmailResult,
  SendReminderTelegramResult,
  SupportServiceGroup,
  SupportContactPosition,
  ProductUnitMaster,
  ContractSignerMaster,
  SupportRequestStatusOption,
  ProjectTypeOption,
  WorklogActivityTypeOption,
  SupportSlaConfigOption,
  AuditLog,
  FeedbackRequest,
  Role,
  Permission,
  UserAccessRecord,
  DeptScopeType,
  BackblazeB2IntegrationSettings,
  GoogleDriveIntegrationSettings,
  ContractExpiryAlertSettings,
  ContractPaymentAlertSettings,
  ContractPaymentAlertSettingsUpdatePayload,
  TelegramIntegrationSettings,
  TelegramIntegrationSettingsTestPayload,
  TelegramIntegrationSettingsTestResult,
  TelegramIntegrationSettingsUpdatePayload,
  ContractAggregateKpis,
  CustomerAggregateKpis,
  PaginationMeta,
  PaginatedQuery,
  ModalType,
  BackblazeB2IntegrationSettingsUpdatePayload,
  GoogleDriveIntegrationSettingsUpdatePayload,
  EmailSmtpIntegrationSettings,
  EmailSmtpIntegrationSettingsUpdatePayload,
  ContractExpiryAlertSettingsUpdatePayload,
  BulkMutationResult,
} from './types';
import { canImportModule, hasPermission } from './utils/authorization';
import type { InternalUserSubTab } from './components/InternalUserModuleTabs';

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
const ProductPackageList = lazy(() =>
  import('./components/ProductPackageList').then((module) => ({ default: module.ProductPackageList }))
);
const CustomerList = lazy(() => import('./components/CustomerList').then((module) => ({ default: module.CustomerList })));
const CusPersonnelList = lazy(() =>
  import('./components/CusPersonnelList').then((module) => ({ default: module.CusPersonnelList }))
);
const ProjectList = lazy(() => import('./components/ProjectList').then((module) => ({ default: module.ProjectList })));
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
  import('./components/CustomerRequestManagementHub').then((module) => ({ default: module.CustomerRequestManagementHub }))
);
const RevenueManagementHub = lazy(() =>
  import('./components/RevenueManagementHub').then((module) => ({ default: module.RevenueManagementHub }))
);
const FeeCollectionHub = lazy(() =>
  import('./components/FeeCollectionHub').then((module) => ({ default: module.FeeCollectionHub }))
);
const WorkflowManagementHub = lazy(() =>
  import('./components/workflow/WorkflowManagementHub')
);
const AuditLogList = lazy(() => import('./components/AuditLogList').then((module) => ({ default: module.AuditLogList })));
const FeedbackList = lazy(() => import('./components/FeedbackList').then((module) => ({ default: module.FeedbackList })));
const IntegrationSettingsPanel = lazy(() =>
  import('./components/IntegrationSettingsPanel').then((module) => ({ default: module.IntegrationSettingsPanel }))
);
const AccessControlList = lazy(() =>
  import('./components/AccessControlList').then((module) => ({ default: module.AccessControlList }))
);

const isProjectLinkedContract = (contract: Contract): boolean =>
  String(contract.project_id ?? '').trim() !== '';

type CustomerRequestHubContext = {
  customers: Customer[];
  customerPersonnel: CustomerPersonnel[];
  projectItems: ProjectItemMaster[];
  employees: Employee[];
  supportServiceGroups: SupportServiceGroup[];
  currentUserId: string | number | null;
  isAdminViewer: boolean;
  canImportRequests: boolean;
  canExportRequests: boolean;
  canReadRequests: boolean;
  canWriteRequests: boolean;
  canDeleteRequests: boolean;
};

export interface AppPagesProps {
  activeTab: string;
  authUser: AuthUser | null;
  activeInternalUserSubTab: InternalUserSubTab;
  setInternalUserSubTab: (tab: InternalUserSubTab) => void;
  customerRequestHubContext: CustomerRequestHubContext;

  // Handlers
  handleOpenModal: (type: ModalType, item?: any) => void;
  addToast: (type: 'success' | 'error', title: string, message?: string) => void;

  // Datasets
  departments: Department[];
  employees: Employee[];
  businesses: Business[];
  vendors: Vendor[];
  products: Product[];
  productPackages: ProductPackage[];
  customers: Customer[];
  cusPersonnel: CustomerPersonnel[];
  projects: Project[];
  projectItems: ProjectItemMaster[];
  contracts: Contract[];
  paymentSchedules: PaymentSchedule[];
  reminders: Reminder[];
  userDeptHistory: UserDeptHistory[];

  // Support Master Datasets
  supportServiceGroups: SupportServiceGroup[];
  supportContactPositions: SupportContactPosition[];
  productUnitMasters?: ProductUnitMaster[];
  contractSignerMasters?: ContractSignerMaster[];
  supportRequestStatuses: SupportRequestStatusOption[];
  projectTypes: ProjectTypeOption[];
  worklogActivityTypes: WorklogActivityTypeOption[];
  supportSlaConfigs: SupportSlaConfigOption[];

  // Access Control
  userAccessRecords: UserAccessRecord[];
  roles: Role[];
  permissions: Permission[];

  // Derived / Precomputed
  dashboardStats: DashboardStats;
  hrStatistics: HRStatistics;
  contractAggregateKpis: ContractAggregateKpis;
  passContractAggregateKpis: ContractAggregateKpis;
  customerAggregateKpis: CustomerAggregateKpis;

  // Paginated Rows & Meta
  employeesPageRows: Employee[];
  employeesPageMeta?: PaginationMeta;
  employeesPageLoading: boolean;
  handleEmployeesPageQueryChange: (query: PaginatedQuery) => void;
  partyProfilesPageRows: EmployeePartyListItem[];
  partyProfilesPageMeta?: PaginationMeta;
  partyProfilesPageLoading: boolean;
  handlePartyProfilesPageQueryChange: (query: PaginatedQuery) => void;

  customersPageRows: Customer[];
  customersPageMeta?: PaginationMeta;
  customersPageLoading: boolean;
  handleCustomersPageQueryChange: (query: PaginatedQuery) => void;

  projectsPageRows: Project[];
  projectsPageMeta?: PaginationMeta;
  projectsPageLoading: boolean;
  handleProjectsPageQueryChange: (query: PaginatedQuery) => void;

  contractsPageRows: Contract[];
  contractsPageMeta?: PaginationMeta;
  contractsPageLoading: boolean;
  handleContractsPageQueryChange: (query: PaginatedQuery) => void;

  passContractsPageRows: Contract[];
  passContractsPageMeta?: PaginationMeta;
  passContractsPageLoading: boolean;
  handlePassContractsPageQueryChange: (query: PaginatedQuery) => void;

  documentsPageRows: Document[];
  documentsPageMeta?: PaginationMeta;
  documentsPageLoading: boolean;
  handleDocumentsPageQueryChange: (query: PaginatedQuery) => void;

  auditLogsPageRows: AuditLog[];
  auditLogsPageMeta?: PaginationMeta;
  auditLogsPageLoading: boolean;
  handleAuditLogsPageQueryChange: (query: PaginatedQuery) => void;

  feedbacksPageRows: FeedbackRequest[];
  feedbacksPageMeta?: PaginationMeta;
  feedbacksPageLoading: boolean;
  handleFeedbacksPageQueryChange: (query: PaginatedQuery) => void;

  // Specific Callbacks
  handleCreateContractFromProject: (project: Project) => void;
  handleOpenProcedure: (project: Project) => void;
  onSendReminderEmail: (reminderId: string, recipientEmail: string) => Promise<SendReminderEmailResult>;
  onSendReminderTelegram: (
    reminderId: string,
    recipientUserId: string | number
  ) => Promise<SendReminderTelegramResult>;
  exportProjectsByCurrentQuery: () => Promise<Project[]>;
  exportProjectRaciByProjectIds: (projectIds: Array<string | number>) => Promise<ProjectRaciRow[]>;
  exportContractsByCurrentQuery: () => Promise<Contract[]>;
  exportPassContractsByCurrentQuery: () => Promise<Contract[]>;

  // Support Master Handlers
  handleCreateSupportServiceGroup: (
    payload: Partial<SupportServiceGroup>,
    options?: { silent?: boolean }
  ) => Promise<SupportServiceGroup>;
  handleUpdateSupportServiceGroup: (
    id: string | number,
    payload: Partial<SupportServiceGroup>,
    options?: { silent?: boolean }
  ) => Promise<SupportServiceGroup>;
  handleCreateSupportContactPosition: (
    payload: Partial<SupportContactPosition>,
    options?: { silent?: boolean }
  ) => Promise<SupportContactPosition>;
  handleCreateProductUnitMaster?: (
    payload: Partial<ProductUnitMaster>,
    options?: { silent?: boolean }
  ) => Promise<ProductUnitMaster>;
  handleCreateContractSignerMaster?: (
    payload: Partial<ContractSignerMaster>,
    options?: { silent?: boolean }
  ) => Promise<ContractSignerMaster>;
  handleCreateSupportContactPositionsBulk: (
    items: Array<Partial<SupportContactPosition>>,
    options?: { silent?: boolean }
  ) => Promise<BulkMutationResult<SupportContactPosition>>;
  handleUpdateSupportContactPosition: (
    id: string | number,
    payload: Partial<SupportContactPosition>,
    options?: { silent?: boolean }
  ) => Promise<SupportContactPosition>;
  handleUpdateProductUnitMaster?: (
    id: string | number,
    payload: Partial<ProductUnitMaster>,
    options?: { silent?: boolean }
  ) => Promise<ProductUnitMaster>;
  handleUpdateContractSignerMaster?: (
    id: string | number,
    payload: Partial<ContractSignerMaster>,
    options?: { silent?: boolean }
  ) => Promise<ContractSignerMaster>;
  handleCreateSupportRequestStatus: (
    payload: Partial<SupportRequestStatusOption>,
    options?: { silent?: boolean }
  ) => Promise<SupportRequestStatusOption>;
  handleUpdateSupportRequestStatusDefinition: (
    id: string | number,
    payload: Partial<SupportRequestStatusOption>,
    options?: { silent?: boolean }
  ) => Promise<SupportRequestStatusOption>;
  handleCreateProjectType: (
    payload: Partial<ProjectTypeOption>,
    options?: { silent?: boolean }
  ) => Promise<ProjectTypeOption>;
  handleUpdateProjectType: (
    id: string | number,
    payload: Partial<ProjectTypeOption>,
    options?: { silent?: boolean }
  ) => Promise<ProjectTypeOption>;
  handleCreateWorklogActivityType: (
    payload: Partial<WorklogActivityTypeOption>,
    options?: { silent?: boolean }
  ) => Promise<WorklogActivityTypeOption>;
  handleUpdateWorklogActivityType: (
    id: string | number,
    payload: Partial<WorklogActivityTypeOption>,
    options?: { silent?: boolean }
  ) => Promise<WorklogActivityTypeOption>;
  handleCreateSupportSlaConfig: (
    payload: Partial<SupportSlaConfigOption>,
    options?: { silent?: boolean }
  ) => Promise<SupportSlaConfigOption>;
  handleUpdateSupportSlaConfig: (
    id: string | number,
    payload: Partial<SupportSlaConfigOption>,
    options?: { silent?: boolean }
  ) => Promise<SupportSlaConfigOption>;

  // Access Control Handlers
  refreshAccessControlData: () => Promise<void>;
  handleUpdateAccessRoles: (userId: number, roleIds: number[]) => Promise<void>;
  handleBulkUpdateAccessRoles: (updates: Array<{ userId: number; roleIds: number[] }>) => Promise<void>;
  handleBulkUpdateAccessPermissions: (
    updates: Array<{
      userId: number;
      overrides: Array<{
        permission_id: number;
        type: 'GRANT' | 'DENY';
        reason?: string | null;
      }>;
    }>
  ) => Promise<void>;
  handleBulkUpdateAccessScopes: (
    updates: Array<{
      userId: number;
      scopes: Array<{
        dept_id: number;
        scope_type: DeptScopeType;
      }>;
    }>
  ) => Promise<void>;
  handleUpdateAccessPermissions: (
    userId: number,
    overrides: Array<{
      permission_id: number;
      type: 'GRANT' | 'DENY';
      reason?: string | null;
      expires_at?: string | null;
    }>
  ) => Promise<void>;
  handleUpdateAccessScopes: (
    userId: number,
    scopes: Array<{
      dept_id: number;
      scope_type: DeptScopeType;
    }>
  ) => Promise<void>;

  // Integration Settings
  backblazeB2Settings: BackblazeB2IntegrationSettings | null;
  googleDriveSettings: GoogleDriveIntegrationSettings | null;
  emailSmtpSettings: EmailSmtpIntegrationSettings | null;
  telegramSettings: TelegramIntegrationSettings | null;
  contractExpiryAlertSettings: ContractExpiryAlertSettings | null;
  contractPaymentAlertSettings: ContractPaymentAlertSettings | null;
  isBackblazeB2SettingsLoading: boolean;
  isGoogleDriveSettingsLoading: boolean;
  isEmailSmtpSettingsLoading: boolean;
  isTelegramSettingsLoading: boolean;
  isContractExpiryAlertSettingsLoading: boolean;
  isContractPaymentAlertSettingsLoading: boolean;
  isGoogleDriveSettingsSaving: boolean;
  isGoogleDriveSettingsTesting: boolean;
  isBackblazeB2SettingsSaving: boolean;
  isBackblazeB2SettingsTesting: boolean;
  isEmailSmtpSettingsSaving: boolean;
  isEmailSmtpSettingsTesting: boolean;
  isTelegramSettingsSaving: boolean;
  isTelegramSettingsTesting: boolean;
  isContractExpiryAlertSettingsSaving: boolean;
  isContractPaymentAlertSettingsSaving: boolean;
  refreshIntegrationSettings: () => Promise<void>;
  handleSaveBackblazeB2Settings: (payload: BackblazeB2IntegrationSettingsUpdatePayload) => Promise<void>;
  handleSaveGoogleDriveSettings: (payload: GoogleDriveIntegrationSettingsUpdatePayload) => Promise<void>;
  handleSaveEmailSmtpSettings: (payload: EmailSmtpIntegrationSettingsUpdatePayload) => Promise<void>;
  handleSaveTelegramSettings: (payload: TelegramIntegrationSettingsUpdatePayload) => Promise<void>;
  handleSaveContractExpiryAlertSettings: (payload: ContractExpiryAlertSettingsUpdatePayload) => Promise<void>;
  handleSaveContractPaymentAlertSettings: (payload: ContractPaymentAlertSettingsUpdatePayload) => Promise<void>;
  handleTestBackblazeB2Integration: (
    payload: BackblazeB2IntegrationSettingsUpdatePayload
  ) => Promise<{
    message?: string;
    status?: 'SUCCESS' | 'FAILED';
    tested_at?: string | null;
    persisted?: boolean;
  }>;
  handleTestGoogleDriveIntegration: (
    payload: GoogleDriveIntegrationSettingsUpdatePayload
  ) => Promise<{
    message?: string;
    user_email?: string | null;
    status?: 'SUCCESS' | 'FAILED';
    tested_at?: string | null;
    persisted?: boolean;
  }>;
  handleTestEmailSmtpIntegration: (
    payload: EmailSmtpIntegrationSettingsUpdatePayload
  ) => Promise<{
    message?: string;
    status?: 'SUCCESS' | 'FAILED';
    tested_at?: string | null;
    persisted?: boolean;
  }>;
  handleTestTelegramIntegration: (
    payload?: TelegramIntegrationSettingsTestPayload
  ) => Promise<TelegramIntegrationSettingsTestResult>;
  onSaveEmployeeTelegramChatId: (employee: Employee, telechatbot: string | null) => Promise<void>;
}

export const AppPages: React.FC<AppPagesProps> = ({
  activeTab,
  authUser,
  activeInternalUserSubTab,
  setInternalUserSubTab,
  customerRequestHubContext,
  handleOpenModal,
  addToast,
  departments,
  employees,
  businesses,
  vendors,
  products,
  productPackages,
  customers,
  cusPersonnel,
  projects,
  projectItems,
  contracts,
  paymentSchedules,
  reminders,
  userDeptHistory,
  supportServiceGroups,
  supportContactPositions,
  productUnitMasters = [],
  contractSignerMasters = [],
  supportRequestStatuses,
  projectTypes,
  worklogActivityTypes,
  supportSlaConfigs,
  userAccessRecords,
  roles,
  permissions,
  dashboardStats,
  hrStatistics,
  contractAggregateKpis,
  passContractAggregateKpis,
  customerAggregateKpis,
  employeesPageRows,
  employeesPageMeta,
  employeesPageLoading,
  handleEmployeesPageQueryChange,
  partyProfilesPageRows,
  partyProfilesPageMeta,
  partyProfilesPageLoading,
  handlePartyProfilesPageQueryChange,
  customersPageRows,
  customersPageMeta,
  customersPageLoading,
  handleCustomersPageQueryChange,
  projectsPageRows,
  projectsPageMeta,
  projectsPageLoading,
  handleProjectsPageQueryChange,
  contractsPageRows,
  contractsPageMeta,
  contractsPageLoading,
  handleContractsPageQueryChange,
  passContractsPageRows,
  passContractsPageMeta,
  passContractsPageLoading,
  handlePassContractsPageQueryChange,
  documentsPageRows,
  documentsPageMeta,
  documentsPageLoading,
  handleDocumentsPageQueryChange,
  auditLogsPageRows,
  auditLogsPageMeta,
  auditLogsPageLoading,
  handleAuditLogsPageQueryChange,
  feedbacksPageRows,
  feedbacksPageMeta,
  feedbacksPageLoading,
  handleFeedbacksPageQueryChange,
  handleCreateContractFromProject,
  handleOpenProcedure,
  onSendReminderEmail,
  onSendReminderTelegram,
  exportProjectsByCurrentQuery,
  exportProjectRaciByProjectIds,
  exportContractsByCurrentQuery,
  exportPassContractsByCurrentQuery,
  handleCreateSupportServiceGroup,
  handleUpdateSupportServiceGroup,
  handleCreateSupportContactPosition,
  handleCreateProductUnitMaster,
  handleCreateContractSignerMaster,
  handleCreateSupportContactPositionsBulk,
  handleUpdateSupportContactPosition,
  handleUpdateProductUnitMaster,
  handleUpdateContractSignerMaster,
  handleCreateSupportRequestStatus,
  handleUpdateSupportRequestStatusDefinition,
  handleCreateProjectType,
  handleUpdateProjectType,
  handleCreateWorklogActivityType,
  handleUpdateWorklogActivityType,
  handleCreateSupportSlaConfig,
  handleUpdateSupportSlaConfig,
  refreshAccessControlData,
  handleUpdateAccessRoles,
  handleBulkUpdateAccessRoles,
  handleBulkUpdateAccessPermissions,
  handleBulkUpdateAccessScopes,
  handleUpdateAccessPermissions,
  handleUpdateAccessScopes,
  backblazeB2Settings,
  googleDriveSettings,
  emailSmtpSettings,
  telegramSettings,
  contractExpiryAlertSettings,
  contractPaymentAlertSettings,
  isBackblazeB2SettingsLoading,
  isGoogleDriveSettingsLoading,
  isEmailSmtpSettingsLoading,
  isTelegramSettingsLoading,
  isContractExpiryAlertSettingsLoading,
  isContractPaymentAlertSettingsLoading,
  isGoogleDriveSettingsSaving,
  isGoogleDriveSettingsTesting,
  isBackblazeB2SettingsSaving,
  isBackblazeB2SettingsTesting,
  isEmailSmtpSettingsSaving,
  isEmailSmtpSettingsTesting,
  isTelegramSettingsSaving,
  isTelegramSettingsTesting,
  isContractExpiryAlertSettingsSaving,
  isContractPaymentAlertSettingsSaving,
  refreshIntegrationSettings,
  handleSaveBackblazeB2Settings,
  handleSaveGoogleDriveSettings,
  handleSaveEmailSmtpSettings,
  handleSaveTelegramSettings,
  handleSaveContractExpiryAlertSettings,
  handleSaveContractPaymentAlertSettings,
  handleTestBackblazeB2Integration,
  handleTestGoogleDriveIntegration,
  handleTestEmailSmtpIntegration,
  handleTestTelegramIntegration,
  onSaveEmployeeTelegramChatId,
}) => {
  const projectLinkedContracts = React.useMemo(
    () => (contracts || []).filter((contract) => isProjectLinkedContract(contract)),
    [contracts]
  );
  const initialContracts = React.useMemo(
    () => (contracts || []).filter((contract) => !isProjectLinkedContract(contract)),
    [contracts]
  );

  return (
    <>
      {activeTab === 'dashboard' && (
        <Dashboard
          contracts={contracts}
          paymentSchedules={paymentSchedules}
          projects={projects}
          customers={customers}
          departments={departments}
          employees={employees}
        />
      )}

      {(activeTab === 'internal_user_dashboard' || activeTab === 'internal_user_list' || activeTab === 'internal_user_party_members') && (
        <InternalUserModuleTabs
          authUser={authUser}
          employees={employees}
          departments={departments}
          hrStatistics={hrStatistics}
          onOpenModal={handleOpenModal}
          onNotify={addToast}
          listEmployees={employeesPageRows}
          listMeta={employeesPageMeta}
          listLoading={employeesPageLoading}
          onListQueryChange={handleEmployeesPageQueryChange}
          partyProfiles={partyProfilesPageRows}
          partyMeta={partyProfilesPageMeta}
          partyLoading={partyProfilesPageLoading}
          onPartyQueryChange={handlePartyProfilesPageQueryChange}
          canViewPartyTab={hasPermission(authUser, 'employee_party.read')}
          canImportList={canImportModule(authUser, 'internal_user_list')}
          canImportParty={canImportModule(authUser, 'internal_user_party_members')}
          activeSubTab={activeInternalUserSubTab}
          onSubTabChange={setInternalUserSubTab}
        />
      )}

      {activeTab === 'departments' && (
        <DepartmentList departments={departments} employees={employees} onOpenModal={handleOpenModal} canImport={canImportModule(authUser, 'departments')} />
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
        <BusinessList businesses={businesses} products={products} onOpenModal={handleOpenModal} canImport={canImportModule(authUser, 'businesses')} />
      )}

      {activeTab === 'vendors' && (
        <VendorList vendors={vendors} onOpenModal={handleOpenModal} canImport={canImportModule(authUser, 'vendors')} />
      )}

      {(activeTab === 'products' || activeTab === 'product_quotes') && (
        <ProductList
          products={products}
          productPackages={productPackages}
          businesses={businesses}
          vendors={vendors}
          customers={customers}
          currentUserId={authUser?.id ?? null}
          onOpenModal={handleOpenModal}
          canEdit={hasPermission(authUser, 'products.write')}
          canDelete={hasPermission(authUser, 'products.delete')}
          canImport={canImportModule(authUser, 'products')}
          canUploadDocument={hasPermission(authUser, 'documents.write')}
          onNotify={addToast}
        />
      )}

      {activeTab === 'product_packages' && (
        <ProductPackageList
          productPackages={productPackages}
          products={products}
          businesses={businesses}
          vendors={vendors}
          onOpenModal={handleOpenModal}
          canEdit={hasPermission(authUser, 'products.write')}
          canDelete={hasPermission(authUser, 'products.delete')}
          canImport={canImportModule(authUser, 'product_packages')}
          onNotify={addToast}
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
          canEdit={hasPermission(authUser, 'customers.write')}
          canDelete={hasPermission(authUser, 'customers.delete')}
          canImport={canImportModule(authUser, 'clients')}
          aggregateKpis={customerAggregateKpis}
        />
      )}

      {activeTab === 'cus_personnel' && (
        <CusPersonnelList
          personnel={cusPersonnel}
          customers={customers}
          supportContactPositions={supportContactPositions}
          onNotify={addToast}
          onOpenModal={handleOpenModal}
          canEdit={hasPermission(authUser, 'customer_personnel.write')}
          canDelete={hasPermission(authUser, 'customer_personnel.delete')}
          canImport={canImportModule(authUser, 'cus_personnel')}
        />
      )}

      {activeTab === 'projects' && (
        <ProjectList
          projects={projectsPageRows}
          customers={customers}
          departments={departments}
          authUser={authUser}
          projectTypes={projectTypes}
          onOpenModal={handleOpenModal}
          onCreateContract={handleCreateContractFromProject}
          onOpenProcedure={handleOpenProcedure}
          onNotify={addToast}
          onExportProjects={exportProjectsByCurrentQuery}
          onExportProjectRaci={exportProjectRaciByProjectIds}
          projectItems={projectItems}
          canImport={canImportModule(authUser, 'projects')}
          paginationMeta={projectsPageMeta}
          isLoading={projectsPageLoading}
          onQueryChange={handleProjectsPageQueryChange}
        />
      )}

      {activeTab === 'contracts' && (
        <ContractList
          contracts={projectLinkedContracts}
          contractsPageRows={contractsPageRows}
          paginationMeta={contractsPageMeta}
          isLoading={contractsPageLoading}
          onQueryChange={handleContractsPageQueryChange}
          onExportContracts={exportContractsByCurrentQuery}
          projects={projects}
          customers={customers}
          onOpenModal={handleOpenModal}
          canAdd={hasPermission(authUser, 'contracts.write')}
          canEdit={hasPermission(authUser, 'contracts.write')}
          canDelete={hasPermission(authUser, 'contracts.delete')}
          onNotify={addToast}
          aggregateKpis={contractAggregateKpis}
          fixedSourceMode="PROJECT"
        />
      )}

      {activeTab === 'pass_contract' && (
        <ContractList
          contracts={initialContracts}
          contractsPageRows={passContractsPageRows}
          paginationMeta={passContractsPageMeta}
          isLoading={passContractsPageLoading}
          onQueryChange={handlePassContractsPageQueryChange}
          onExportContracts={exportPassContractsByCurrentQuery}
          projects={projects}
          customers={customers}
          onOpenModal={handleOpenModal}
          canAdd={hasPermission(authUser, 'contracts.write')}
          canEdit={hasPermission(authUser, 'contracts.write')}
          canDelete={hasPermission(authUser, 'contracts.delete')}
          onNotify={addToast}
          aggregateKpis={passContractAggregateKpis}
          fixedSourceMode="INITIAL"
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
          canSendReminderEmail={hasPermission(authUser, 'reminders.write')}
          canSendReminderTelegram={hasPermission(authUser, 'reminders.write')}
          onSendReminderEmail={async (item, recipientEmail) => {
            const result = await onSendReminderEmail(item.id, recipientEmail);
            addToast('success', 'Gửi mail nhắc việc', result.message || 'Đã gửi email thành công.');
          }}
          onSendReminderTelegram={async (item, recipientUserId) => {
            const result = await onSendReminderTelegram(item.id, recipientUserId);
            addToast('success', 'Gửi Telegram nhắc việc', result.message || 'Đã gửi Telegram thành công.');
          }}
        />
      )}

      {activeTab === 'customer_request_management' && (
        <CustomerRequestManagementHub
          customers={customerRequestHubContext.customers}
          customerPersonnel={customerRequestHubContext.customerPersonnel}
          projectItems={customerRequestHubContext.projectItems}
          employees={customerRequestHubContext.employees}
          supportServiceGroups={customerRequestHubContext.supportServiceGroups}
          currentUserId={customerRequestHubContext.currentUserId}
          isAdminViewer={customerRequestHubContext.isAdminViewer}
          canImportRequests={customerRequestHubContext.canImportRequests}
          canExportRequests={customerRequestHubContext.canExportRequests}
          canReadRequests={customerRequestHubContext.canReadRequests}
          canWriteRequests={customerRequestHubContext.canWriteRequests}
          canDeleteRequests={customerRequestHubContext.canDeleteRequests}
          onNotify={addToast}
        />
      )}

      {activeTab === 'revenue_mgmt' && (
        <RevenueManagementHub
          canRead={hasPermission(authUser, 'revenue.read')}
          canManageTargets={hasPermission(authUser, 'revenue.targets')}
          departments={departments}
        />
      )}

      {activeTab === 'fee_collection' && (
        <FeeCollectionHub
          contracts={contracts}
          customers={customers}
          currentUser={authUser}
          canAdd={hasPermission(authUser, 'fee_collection.write')}
          canEdit={hasPermission(authUser, 'fee_collection.write')}
          canDelete={hasPermission(authUser, 'fee_collection.delete')}
        />
      )}

      {activeTab === 'workflow_mgmt' && (
        <WorkflowManagementHub />
      )}

      {activeTab === 'support_master_management' && (
        <SupportMasterManagement
          customers={customers}
          supportServiceGroups={supportServiceGroups}
          supportContactPositions={supportContactPositions}
          products={products}
          productPackages={productPackages}
          departments={departments}
          employees={employees}
          productUnitMasters={productUnitMasters}
          contractSignerMasters={contractSignerMasters}
          supportRequestStatuses={supportRequestStatuses}
          projectTypes={projectTypes}
          worklogActivityTypes={worklogActivityTypes}
          supportSlaConfigs={supportSlaConfigs}
          onCreateSupportServiceGroup={handleCreateSupportServiceGroup}
          onUpdateSupportServiceGroup={handleUpdateSupportServiceGroup}
          onCreateSupportContactPosition={handleCreateSupportContactPosition}
          onCreateProductUnitMaster={handleCreateProductUnitMaster}
          onCreateContractSignerMaster={handleCreateContractSignerMaster}
          onCreateSupportContactPositionsBulk={handleCreateSupportContactPositionsBulk}
          onUpdateSupportContactPosition={handleUpdateSupportContactPosition}
          onUpdateProductUnitMaster={handleUpdateProductUnitMaster}
          onUpdateContractSignerMaster={handleUpdateContractSignerMaster}
          onCreateSupportRequestStatus={handleCreateSupportRequestStatus}
          onUpdateSupportRequestStatus={handleUpdateSupportRequestStatusDefinition}
          onCreateProjectType={handleCreateProjectType}
          onUpdateProjectType={handleUpdateProjectType}
          onCreateWorklogActivityType={handleCreateWorklogActivityType}
          onUpdateWorklogActivityType={handleUpdateWorklogActivityType}
          onCreateSupportSlaConfig={handleCreateSupportSlaConfig}
          onUpdateSupportSlaConfig={handleUpdateSupportSlaConfig}
          canReadCustomers={hasPermission(authUser, 'customers.read')}
          canReadServiceGroups={hasPermission(authUser, 'support_service_groups.read')}
          canReadContactPositions={hasPermission(authUser, 'support_contact_positions.read')}
          canReadProducts={hasPermission(authUser, 'products.read')}
          canReadProductUnitMasters={hasPermission(authUser, 'support_requests.read') || hasPermission(authUser, 'products.read')}
          canReadContractSigners={hasPermission(authUser, 'contracts.read') && hasPermission(authUser, 'support_requests.read')}
          canReadStatuses={hasPermission(authUser, 'support_requests.read')}
          canReadWorklogActivityTypes={hasPermission(authUser, 'support_requests.read')}
          canReadSlaConfigs={hasPermission(authUser, 'support_requests.read')}
          canWriteServiceGroups={hasPermission(authUser, 'support_service_groups.write')}
          canWriteContactPositions={hasPermission(authUser, 'support_contact_positions.write')}
          canWriteProducts={hasPermission(authUser, 'products.write')}
          canWriteProductUnitMasters={hasPermission(authUser, 'support_requests.write') || hasPermission(authUser, 'products.write')}
          canWriteContractSigners={hasPermission(authUser, 'contracts.write') && hasPermission(authUser, 'support_requests.write')}
          canWriteStatuses={hasPermission(authUser, 'support_requests.write')}
          canWriteWorklogActivityTypes={hasPermission(authUser, 'support_requests.write')}
          canWriteSlaConfigs={hasPermission(authUser, 'support_requests.write')}
          canWriteProjectTypes={hasPermission(authUser, 'projects.write')}
          canReadProjectTypes={hasPermission(authUser, 'projects.read')}
          canWriteWorkCalendar={hasPermission(authUser, 'support_requests.write')}
          canReadWorkCalendar={hasPermission(authUser, 'support_requests.read')}
          onNotify={addToast}
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
          emailSmtpSettings={emailSmtpSettings}
          telegramSettings={telegramSettings}
          contractExpiryAlertSettings={contractExpiryAlertSettings}
          contractPaymentAlertSettings={contractPaymentAlertSettings}
          employees={employees}
          isLoading={isBackblazeB2SettingsLoading || isGoogleDriveSettingsLoading || isEmailSmtpSettingsLoading || isTelegramSettingsLoading || isContractExpiryAlertSettingsLoading || isContractPaymentAlertSettingsLoading}
          isSaving={isGoogleDriveSettingsSaving}
          isTesting={isGoogleDriveSettingsTesting}
          isSavingBackblazeB2={isBackblazeB2SettingsSaving}
          isTestingBackblazeB2={isBackblazeB2SettingsTesting}
          isSavingEmailSmtp={isEmailSmtpSettingsSaving}
          isTestingEmailSmtp={isEmailSmtpSettingsTesting}
          isSavingTelegram={isTelegramSettingsSaving}
          isTestingTelegram={isTelegramSettingsTesting}
          isSavingContractExpiryAlert={isContractExpiryAlertSettingsSaving}
          isSavingContractPaymentAlert={isContractPaymentAlertSettingsSaving}
          onRefresh={refreshIntegrationSettings}
          onSaveBackblazeB2={handleSaveBackblazeB2Settings}
          onSave={handleSaveGoogleDriveSettings}
          onSaveEmailSmtp={handleSaveEmailSmtpSettings}
          onSaveTelegram={handleSaveTelegramSettings}
          onSaveContractExpiryAlert={handleSaveContractExpiryAlertSettings}
          onSaveContractPaymentAlert={handleSaveContractPaymentAlertSettings}
          onTestBackblazeB2={handleTestBackblazeB2Integration}
          onTest={handleTestGoogleDriveIntegration}
          onTestEmailSmtp={handleTestEmailSmtpIntegration}
          onTestTelegram={handleTestTelegramIntegration}
          onSaveEmployeeTelegramChatId={onSaveEmployeeTelegramChatId}
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
    </>
  );
};
