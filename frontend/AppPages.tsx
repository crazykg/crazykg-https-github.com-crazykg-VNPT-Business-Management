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
  Customer,
  CustomerPersonnel,
  Project,
  ProjectItemMaster,
  ProjectRaciRow,
  Contract,
  PaymentSchedule,
  Document,
  Reminder,
  SupportServiceGroup,
  SupportContactPosition,
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
  ContractAggregateKpis,
  CustomerAggregateKpis,
  PaginationMeta,
  PaginatedQuery,
  ModalType,
  BackblazeB2IntegrationSettingsUpdatePayload,
  GoogleDriveIntegrationSettingsUpdatePayload,
  ContractExpiryAlertSettingsUpdatePayload,
  BulkMutationResult,
} from './types';
import { hasPermission } from './utils/authorization';
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
const AuditLogList = lazy(() => import('./components/AuditLogList').then((module) => ({ default: module.AuditLogList })));
const FeedbackList = lazy(() => import('./components/FeedbackList').then((module) => ({ default: module.FeedbackList })));
const IntegrationSettingsPanel = lazy(() =>
  import('./components/IntegrationSettingsPanel').then((module) => ({ default: module.IntegrationSettingsPanel }))
);
const AccessControlList = lazy(() =>
  import('./components/AccessControlList').then((module) => ({ default: module.AccessControlList }))
);

export interface AppPagesProps {
  activeTab: string;
  authUser: AuthUser | null;
  activeInternalUserSubTab: InternalUserSubTab;
  setInternalUserSubTab: (tab: InternalUserSubTab) => void;

  // Handlers
  handleOpenModal: (type: ModalType, item?: any) => void;
  addToast: (type: 'success' | 'error', title: string, message?: string) => void;

  // Datasets
  departments: Department[];
  employees: Employee[];
  businesses: Business[];
  vendors: Vendor[];
  products: Product[];
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
  exportProjectsByCurrentQuery: () => Promise<Project[]>;
  exportProjectRaciByProjectIds: (projectIds: Array<string | number>) => Promise<ProjectRaciRow[]>;

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
  handleCreateSupportContactPositionsBulk: (
    items: Array<Partial<SupportContactPosition>>,
    options?: { silent?: boolean }
  ) => Promise<BulkMutationResult<SupportContactPosition>>;
  handleUpdateSupportContactPosition: (
    id: string | number,
    payload: Partial<SupportContactPosition>,
    options?: { silent?: boolean }
  ) => Promise<SupportContactPosition>;
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
  contractExpiryAlertSettings: ContractExpiryAlertSettings | null;
  contractPaymentAlertSettings: ContractPaymentAlertSettings | null;
  isBackblazeB2SettingsLoading: boolean;
  isGoogleDriveSettingsLoading: boolean;
  isContractExpiryAlertSettingsLoading: boolean;
  isContractPaymentAlertSettingsLoading: boolean;
  isGoogleDriveSettingsSaving: boolean;
  isGoogleDriveSettingsTesting: boolean;
  isBackblazeB2SettingsSaving: boolean;
  isBackblazeB2SettingsTesting: boolean;
  isContractExpiryAlertSettingsSaving: boolean;
  isContractPaymentAlertSettingsSaving: boolean;
  refreshIntegrationSettings: () => Promise<void>;
  handleSaveBackblazeB2Settings: (payload: BackblazeB2IntegrationSettingsUpdatePayload) => Promise<void>;
  handleSaveGoogleDriveSettings: (payload: GoogleDriveIntegrationSettingsUpdatePayload) => Promise<void>;
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
}

export const AppPages: React.FC<AppPagesProps> = ({
  activeTab,
  authUser,
  activeInternalUserSubTab,
  setInternalUserSubTab,
  handleOpenModal,
  addToast,
  departments,
  employees,
  businesses,
  vendors,
  products,
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
  exportProjectsByCurrentQuery,
  exportProjectRaciByProjectIds,
  handleCreateSupportServiceGroup,
  handleUpdateSupportServiceGroup,
  handleCreateSupportContactPosition,
  handleCreateSupportContactPositionsBulk,
  handleUpdateSupportContactPosition,
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
  contractExpiryAlertSettings,
  contractPaymentAlertSettings,
  isBackblazeB2SettingsLoading,
  isGoogleDriveSettingsLoading,
  isContractExpiryAlertSettingsLoading,
  isContractPaymentAlertSettingsLoading,
  isGoogleDriveSettingsSaving,
  isGoogleDriveSettingsTesting,
  isBackblazeB2SettingsSaving,
  isBackblazeB2SettingsTesting,
  isContractExpiryAlertSettingsSaving,
  isContractPaymentAlertSettingsSaving,
  refreshIntegrationSettings,
  handleSaveBackblazeB2Settings,
  handleSaveGoogleDriveSettings,
  handleSaveContractExpiryAlertSettings,
  handleSaveContractPaymentAlertSettings,
  handleTestBackblazeB2Integration,
  handleTestGoogleDriveIntegration,
}) => {
  return (
    <>
      {activeTab === 'dashboard' && (
        <Dashboard stats={dashboardStats} />
      )}

      {(activeTab === 'internal_user_dashboard' || activeTab === 'internal_user_list' || activeTab === 'internal_user_party_members') && (
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
          partyProfiles={partyProfilesPageRows}
          partyMeta={partyProfilesPageMeta}
          partyLoading={partyProfilesPageLoading}
          onPartyQueryChange={handlePartyProfilesPageQueryChange}
          canViewPartyTab={hasPermission(authUser, 'employee_party.read')}
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
        <BusinessList businesses={businesses} products={products} onOpenModal={handleOpenModal} />
      )}

      {activeTab === 'vendors' && (
        <VendorList vendors={vendors} onOpenModal={handleOpenModal} />
      )}

      {activeTab === 'products' && (
        <ProductList
          products={products}
          businesses={businesses}
          vendors={vendors}
          customers={customers}
          currentUserId={authUser?.id ?? null}
          onOpenModal={handleOpenModal}
          canEdit={hasPermission(authUser, 'products.write')}
          canDelete={hasPermission(authUser, 'products.delete')}
          canImport={hasPermission(authUser, 'products.import')}
          canUploadDocument={hasPermission(authUser, 'documents.write')}
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
          canImport={hasPermission(authUser, 'customers.import')}
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
          canImport={hasPermission(authUser, 'customer_personnel.write')}
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
          projects={projects}
          customers={customers}
          onOpenModal={handleOpenModal}
          canAdd={hasPermission(authUser, 'contracts.write')}
          canEdit={hasPermission(authUser, 'contracts.write')}
          canDelete={hasPermission(authUser, 'contracts.delete')}
          onNotify={addToast}
          aggregateKpis={contractAggregateKpis}
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

      {activeTab === 'support_master_management' && (
        <SupportMasterManagement
          customers={customers}
          supportServiceGroups={supportServiceGroups}
          supportContactPositions={supportContactPositions}
          supportRequestStatuses={supportRequestStatuses}
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
    </>
  );
};
