import type { Employee, EmployeeStatus } from './employee';

export type {
  Business,
  Vendor,
} from './businessVendor';
export type {
  Customer,
  CustomerInsight,
  CustomerInsightServiceUsed,
  CustomerInsightUpsellCandidate,
  CustomerPersonnel,
  PositionType,
  UpsellFeatureGroup,
  UpsellProductDetail,
  UpsellSectorCustomer,
  UpsellSimilarCustomer,
} from './customer';
export type {
  Product,
  ProductFeature,
  ProductFeatureCatalog,
  ProductFeatureCatalogListPage,
  ProductFeatureCatalogListRow,
  ProductFeatureGroup,
  ProductFeatureStatus,
  ProductTargetSegment,
  ProductTargetSegmentCustomerSector,
  ProductTargetSegmentFacilityType,
} from './product';
export type {
  Contract,
  ContractAggregateKpis,
  ContractItem,
  ContractRevenueAnalytics,
  ContractSignerOption,
  ContractStatus,
  ContractStatusBreakdown,
  ContractTermUnit,
  ContinuityStatus,
  ExpiringContractSummary,
  MonthlyRevenueComparison,
  OverdueDetail,
  PaymentSchedule,
  PaymentScheduleConfirmationPayload,
  PaymentScheduleStatus,
  RevenueAnalyticsKpis,
  RevenueByContract,
  RevenueByCycle,
  RevenueByItem,
  RevenueByPeriod,
  AddendumType,
} from './contract';
export type {
  DashboardStats,
} from './dashboard';
export type {
  Department,
} from './department';
export type {
  Document,
  DocumentStatus,
  DocumentType,
  Reminder,
} from './document';
export type {
  DepartmentWeeklySchedule,
  DepartmentWeeklyScheduleDay,
  DepartmentWeeklyScheduleEntry,
  DepartmentWeeklyScheduleParticipant,
  DepartmentWeeklyScheduleSession,
  DepartmentWeekOption,
  WorkCalendarDay,
} from './scheduling';
export {
  KNOWN_SUPPORT_REQUEST_STATUS_CODES,
  isKnownSupportRequestStatusCode,
  normalizeSupportRequestStatusCode,
} from './support';
export type {
  ContractSignerMaster,
  KnownSupportRequestStatusCode,
  SupportContactPosition,
  SupportRequest,
  SupportRequestHistory,
  SupportRequestPriority,
  SupportRequestReceiverOption,
  SupportRequestReceiverResult,
  SupportRequestStatus,
  SupportRequestStatusOption,
  SupportRequestTask,
  SupportRequestTaskStatus,
  SupportServiceGroup,
  SupportSlaConfigOption,
  WorkflowFormFieldConfig,
  WorkflowStatusCatalog,
  WorkflowStatusTransition,
  WorklogActivityTypeOption,
} from './support';
export type {
  Employee,
  EmployeePartyListItem,
  EmployeePartyProfile,
  EmployeePartyProfileQuality,
  EmployeeStatus,
  EmployeeType,
  Gender,
  HRDepartmentTypeBreakdown,
  HRGenderBreakdown,
  HRPersonnelType,
  HRPersonnelTypeBreakdown,
  HRPositionBreakdown,
  HRStatistics,
  HRStatusBreakdown,
  InternalUser,
  VpnStatus,
} from './employee';
export type {
  AddWorklogPayload,
  InvestmentMode,
  IssueStatus,
  PaymentCycle,
  ProcedureRaciEntry,
  ProcedureRaciRole,
  ProcedureStepBatchUpdate,
  ProcedureStepRaciEntry,
  ProcedureStepStatus,
  ProcedureStepWorklog,
  ProcedureTemplate,
  ProcedureTemplateStep,
  Project,
  ProjectItem,
  ProjectItemMaster,
  ProjectProcedure,
  ProjectProcedureStep,
  ProjectRACI,
  ProjectRaciRow,
  ProjectStatus,
  ProjectStatusBreakdown,
  ProjectTypeOption,
  RACIRole,
  SharedIssue,
  SharedTimesheet,
  WorklogType,
} from './project';
export type {
  Attachment,
  CRCFullDetail,
  CRCStatusCode,
  CodingPhase,
  CustomerAggregateKpis,
  CustomerHealthcareBreakdownKpis,
  CustomerRequest,
  CustomerRequestAvailableAction,
  CustomerRequestChangeLogEntry,
  CustomerRequestDashboardDatasetRow,
  CustomerRequestDashboardMetricTotals,
  CustomerRequestDashboardSummaryFilters,
  CustomerRequestDashboardSummaryPayload,
  CustomerRequestEscalation,
  CustomerRequestImportRowResult,
  CustomerRequestPlan,
  CustomerRequestPlanItem,
  CustomerRequestReferenceSearchItem,
  CustomerRequestViewerRoleContext,
  DispatchRoute,
  DmsPhase,
  LeadershipDirective,
  MonthlyHoursRow,
  PainPointsData,
  YeuCau,
  YeuCauAvailableActions,
  YeuCauDashboardAlertCounts,
  YeuCauDashboardAttentionCase,
  YeuCauDashboardPayload,
  YeuCauDashboardStatusCount,
  YeuCauDashboardSummary,
  YeuCauDashboardTopCustomer,
  YeuCauDashboardTopPerformer,
  YeuCauDashboardTopProject,
  YeuCauEstimate,
  YeuCauHoursByActivity,
  YeuCauHoursByPerformer,
  YeuCauHoursReport,
  YeuCauPerformerTimesheetCase,
  YeuCauPerformerTimesheetDay,
  YeuCauPerformerTimesheetEntry,
  YeuCauPerformerWeeklyTimesheet,
  YeuCauProcessCatalog,
  YeuCauProcessDetail,
  YeuCauProcessField,
  YeuCauProcessGroup,
  YeuCauProcessListColumn,
  YeuCauProcessMeta,
  YeuCauProcessRow,
  YeuCauRefTaskRow,
  YeuCauRelatedUser,
  YeuCauSearchItem,
  YeuCauTimelineEntry,
  YeuCauWorklog,
} from './customerRequest';
export type {
  AuditEvent,
  AuditLog,
  BackblazeB2IntegrationSettings,
  BackblazeB2IntegrationSettingsUpdatePayload,
  ContractExpiryAlertSettings,
  ContractExpiryAlertSettingsUpdatePayload,
  ContractPaymentAlertSettings,
  ContractPaymentAlertSettingsUpdatePayload,
  FeedbackPriority,
  FeedbackRequest,
  FeedbackResponse,
  FeedbackStatus,
  GoogleDriveIntegrationSettings,
  GoogleDriveIntegrationSettingsUpdatePayload,
  Permission,
  Role,
  UserAccessRecord,
  UserDeptHistory,
  UserDeptScopeAssignment,
  UserPermissionOverride,
  UserRoleAssignment,
} from './admin';
export type {
  ProjectRevenueSchedule,
  RevenueAlert,
  RevenueAlertSeverity,
  RevenueAlertType,
  RevenueByCollectionResponse,
  RevenueByContractKpis,
  RevenueByContractResponse,
  RevenueByContractRow,
  RevenueBySource,
  RevenueComparisonMode,
  RevenueContractSchedule,
  RevenueForecastByStatus,
  RevenueForecastData,
  RevenueForecastKpis,
  RevenueForecastMonth,
  RevenueOverviewData,
  RevenueOverviewKpis,
  RevenueOverviewPeriod,
  RevenueOverviewResponse,
  RevenuePeriodType,
  RevenueReportData,
  RevenueReportDimension,
  RevenueReportRow,
  RevenueSubView,
  RevenueSuggestion,
  RevenueSuggestionPreview,
  RevenueSuggestionPreviewContractSource,
  RevenueSuggestionPreviewProjectPeriod,
  RevenueSuggestionPreviewProjectSource,
  RevenueSuggestionResponse,
  RevenueTarget,
  RevenueTargetBulkInput,
  RevenueTargetType,
} from './revenue';
export type {
  DebtAgingReport,
  DebtAgingRow,
  DebtAgingTotals,
  DebtTrendPoint,
  DunningLog,
  FeeCollectionByMonth,
  FeeCollectionDashboard,
  FeeCollectionKpis,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  PaymentMethod,
  Receipt,
  ReceiptStatus,
  TopDebtor,
  UrgentOverdueItem,
} from './feeCollection';

export type Status = 'Active' | 'Inactive';
export type DeptScopeType = 'SELF_ONLY' | 'DEPT_ONLY' | 'DEPT_AND_CHILDREN' | 'ALL';

export interface UserDeptScope {
  dept_id: number;
  scope_type: DeptScopeType;
}

export interface AuthUser {
  id: string | number;
  uuid?: string | null;
  user_code?: string | null;
  username: string;
  full_name: string;
  email: string;
  avatar_data_url?: string | null;
  avatar_updated_at?: string | null;
  status: EmployeeStatus | string;
  department_id?: string | number | null;
  position_id?: string | number | null;
  roles: string[];
  permissions: string[];
  dept_scopes: UserDeptScope[];
  password_change_required?: boolean;
}

export interface AuthLoginPayload {
  username: string;
  password: string;
}

export interface AuthLoginResult {
  user: AuthUser;
  password_change_required?: boolean;
}

export interface EmployeeProvisioning {
  temporary_password: string;
  must_change_password: boolean;
  delivery: 'one_time' | string;
}

export interface EmployeeSaveResult {
  employee: Employee;
  provisioning?: EmployeeProvisioning | null;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  kpis?: {
    total_requests?: number;
    new_count?: number;
    analyzing_count?: number;
    coding_count?: number;
    pending_upcode_count?: number;
    completed_count?: number;
    in_progress_count?: number;
    waiting_customer_count?: number;
    approaching_due_count?: number;
    overdue_count?: number;
    status_counts?: Record<string, number>;
    in_progress?: number;
    completed?: number;
    overdue?: number;
    total_contracts?: number;
    signed?: number;
    draft?: number;
    renewed?: number;
    expiring_soon?: number;
    expiry_warning_days?: number;
    upcoming_payment_customers?: number;
    upcoming_payment_contracts?: number;
    payment_warning_days?: number;
    new_signed_count?: number;
    new_signed_value?: number;
    total_pipeline_value?: number;
    total_estimated_value?: number;
    overdue_payment_amount?: number;
    collection_rate?: number;
    actual_collected_value?: number;
    // Renewal / addendum KPIs
    addendum_count?: number;
    gap_count?: number;
    continuity_rate?: number | null;    // 0-100, null = no addenda yet
    // Customer KPIs
    total_customers?: number;
    healthcare_customers?: number;
    government_customers?: number;
    individual_customers?: number;
    healthcare_breakdown?: {
      public_hospital?: number;
      private_hospital?: number;
      medical_center?: number;
      private_clinic?: number;
      tyt_pkdk?: number;
      other?: number;
    };
    new_this_month?: number;
    customers_with_active_contracts?: number;
    total_active_contract_value?: number;
    customers_without_contracts?: number;
    customers_with_open_opportunities?: number;
    open_opp_value?: number;
    customers_with_open_crc?: number;
    total_party_members?: number;
    missing_party_card_number_count?: number;
  };
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export type AsyncExportStatus = 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED' | 'EXPIRED';

export interface AsyncExportJob {
  uuid: string;
  module: string;
  format: 'csv' | string;
  status: AsyncExportStatus | string;
  file_name?: string | null;
  error_message?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  download_url?: string | null;
  is_ready?: boolean;
}

export interface BulkMutationItemResult<T> {
  index: number;
  success: boolean;
  data?: T;
  message?: string;
}

export interface BulkMutationResult<T> {
  results: BulkMutationItemResult<T>[];
  created: T[];
  created_count: number;
  failed_count: number;
}

export interface PaginatedQuery {
  page?: number;
  per_page?: number;
  q?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  simple?: boolean;
  filters?: Record<string, string | number | boolean | Array<string | number> | null | undefined>;
  [key: string]: unknown;
}

export type ModalType =
  | 'ADD_DEPARTMENT'
  | 'EDIT_DEPARTMENT'
  | 'VIEW_DEPARTMENT'
  | 'DELETE_DEPARTMENT'
  | 'CANNOT_DELETE'
  | 'IMPORT_DATA'
  | 'ADD_EMPLOYEE'
  | 'EDIT_EMPLOYEE'
  | 'DELETE_EMPLOYEE'
  | 'ADD_PARTY_PROFILE'
  | 'EDIT_PARTY_PROFILE'
  | 'ADD_BUSINESS'
  | 'EDIT_BUSINESS'
  | 'DELETE_BUSINESS'
  | 'ADD_VENDOR'
  | 'EDIT_VENDOR'
  | 'DELETE_VENDOR'
  | 'ADD_PRODUCT'
  | 'EDIT_PRODUCT'
  | 'DELETE_PRODUCT'
  | 'CANNOT_DELETE_PRODUCT'
  | 'PRODUCT_FEATURE_CATALOG'
  | 'PRODUCT_TARGET_SEGMENT'
  | 'ADD_CUSTOMER'
  | 'EDIT_CUSTOMER'
  | 'DELETE_CUSTOMER'
  | 'CANNOT_DELETE_CUSTOMER'
  | 'CUSTOMER_INSIGHT'
  | 'ADD_CUS_PERSONNEL'
  | 'EDIT_CUS_PERSONNEL'
  | 'DELETE_CUS_PERSONNEL'
  | 'ADD_PROJECT'
  | 'EDIT_PROJECT'
  | 'DELETE_PROJECT'
  | 'ADD_CONTRACT'
  | 'EDIT_CONTRACT'
  | 'DELETE_CONTRACT'
  | 'ADD_DOCUMENT'
  | 'EDIT_DOCUMENT'
  | 'UPLOAD_PRODUCT_DOCUMENT'
  | 'DELETE_DOCUMENT'
  | 'ADD_REMINDER'
  | 'EDIT_REMINDER'
  | 'DELETE_REMINDER'
  | 'ADD_USER_DEPT_HISTORY'
  | 'EDIT_USER_DEPT_HISTORY'
  | 'DELETE_USER_DEPT_HISTORY'
  | 'ADD_FEEDBACK'
  | 'EDIT_FEEDBACK'
  | 'VIEW_FEEDBACK'
  | 'DELETE_FEEDBACK'
  | null;

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}
