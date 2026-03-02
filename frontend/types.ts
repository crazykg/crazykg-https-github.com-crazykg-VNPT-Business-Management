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
  status: EmployeeStatus | string;
  department_id?: string | number | null;
  position_id?: string | number | null;
  roles: string[];
  permissions: string[];
  dept_scopes: UserDeptScope[];
}

export interface AuthLoginPayload {
  username: string;
  password: string;
}

export interface AuthLoginResult {
  user: AuthUser;
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
  };
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
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
  filters?: Record<string, string | number | boolean | null | undefined>;
}

export interface Role {
  id: number;
  role_code: string;
  role_name: string;
  description?: string | null;
  is_system?: boolean;
}

export interface Permission {
  id: number;
  perm_key: string;
  perm_name: string;
  perm_group: string;
  is_active?: boolean;
}

export interface UserRoleAssignment {
  role_id: number;
  role_code: string;
  role_name: string;
}

export interface UserPermissionOverride {
  permission_id: number;
  perm_key: string;
  perm_name: string;
  perm_group: string;
  type: 'GRANT' | 'DENY';
  reason?: string | null;
  expires_at?: string | null;
}

export interface UserDeptScopeAssignment {
  id?: number;
  dept_id: number;
  dept_code?: string | null;
  dept_name?: string | null;
  scope_type: DeptScopeType;
}

export interface UserAccessRecord {
  user: {
    id: number;
    user_code?: string;
    username: string;
    full_name: string;
    email: string;
    status?: string;
    department_id?: number | null;
    department_code?: string | null;
    department_name?: string | null;
  };
  roles: UserRoleAssignment[];
  permissions: UserPermissionOverride[];
  dept_scopes: UserDeptScopeAssignment[];
}

export interface GoogleDriveIntegrationSettings {
  provider: 'GOOGLE_DRIVE';
  is_enabled: boolean;
  account_email?: string | null;
  folder_id?: string | null;
  scopes?: string | null;
  impersonate_user?: string | null;
  file_prefix?: string | null;
  has_service_account_json: boolean;
  source?: 'DB' | 'ENV';
  last_tested_at?: string | null;
  last_test_status?: 'SUCCESS' | 'FAILED' | null;
  last_test_message?: string | null;
  updated_at?: string | null;
}

export interface GoogleDriveIntegrationSettingsUpdatePayload {
  is_enabled: boolean;
  account_email?: string | null;
  folder_id?: string | null;
  scopes?: string | null;
  impersonate_user?: string | null;
  file_prefix?: string | null;
  service_account_json?: string | null;
  clear_service_account_json?: boolean;
}

export interface ContractExpiryAlertSettings {
  provider: 'CONTRACT_ALERT';
  warning_days: number;
  source?: 'DB' | 'DEFAULT';
  updated_at?: string | null;
}

export interface ContractExpiryAlertSettingsUpdatePayload {
  warning_days: number;
}

export interface ContractPaymentAlertSettings {
  provider: 'CONTRACT_PAYMENT_ALERT';
  warning_days: number;
  source?: 'DB' | 'DEFAULT';
  updated_at?: string | null;
}

export interface ContractPaymentAlertSettingsUpdatePayload {
  warning_days: number;
}

export interface Department {
  id: string | number;
  dept_code: string;
  dept_name: string;
  parent_id: string | number | null;
  dept_path: string;
  is_active: boolean;
  employeeCount?: number;
}

export interface Business {
  id: string | number;
  uuid?: string;
  domain_code: string;
  domain_name: string;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}

export interface Vendor {
  id: string | number;
  uuid: string;
  vendor_code: string;
  vendor_name: string;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}

export interface Product {
  id: string | number;
  uuid?: string;
  product_code: string;
  product_name: string;
  domain_id: string | number;
  vendor_id: string | number;
  standard_price: number;
  unit?: string | null;
  description?: string | null;
  is_active?: boolean;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}

export interface Customer {
  id: string | number;
  uuid: string;
  customer_code: string;
  customer_name: string;
  tax_code: string;
  address: string;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}

export type PositionType = string;

export interface CustomerPersonnel {
  id: string;
  fullName: string;
  birthday: string;
  positionType: PositionType;
  positionId?: string | number | null;
  positionLabel?: string | null;
  phoneNumber: string;
  email: string;
  customerId: string;
  status: Status;
}

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'BANNED';
export type EmployeeType = 'Official' | 'Collaborator';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type VpnStatus = 'YES' | 'NO';
export type HRPersonnelType = 'OFFICIAL' | 'CTV';

export interface Employee {
  id: string | number;
  uuid: string;
  user_code?: string;
  employee_code?: string;
  username: string;
  full_name: string;
  email: string;
  phone?: string | null;
  phone_number?: string | null;
  mobile?: string | null;
  status: EmployeeStatus;
  position_code?: string | null;
  position_name?: string | null;
  job_title_raw?: string | null;
  job_title_vi?: string | null;
  date_of_birth?: string | null;
  gender?: Gender | null;
  ip_address?: string | null;
  vpn_status?: VpnStatus | null;
  department_id: string | number | null;
  position_id: string | number | null;
  // Backward-compatible aliases used by a few legacy views.
  name?: string;
  department?: string | number | null;
}

export type InternalUser = Employee;

export interface HRPersonnelTypeBreakdown {
  type: HRPersonnelType;
  label: string;
  count: number;
  percentage: number;
}

export interface HRGenderBreakdown {
  gender: Gender | 'UNKNOWN';
  label: string;
  count: number;
  percentage: number;
  avgAge: number | null;
}

export interface HRStatusBreakdown {
  status: EmployeeStatus | 'UNKNOWN';
  label: string;
  count: number;
  percentage: number;
}

export interface HRPositionBreakdown {
  position_code: string | null;
  position_name: string;
  count: number;
}

export interface HRDepartmentTypeBreakdown {
  department_id: string | number | null;
  dept_code: string;
  dept_name: string;
  official_count: number;
  ctv_count: number;
  total: number;
}

export interface HRStatistics {
  totalEmployees: number;
  officialEmployees: number;
  ctvEmployees: number;
  officialPercentage: number;
  ctvPercentage: number;
  maleCount: number;
  femaleCount: number;
  malePercentage: number;
  femalePercentage: number;
  avgAgeMale: number | null;
  avgAgeFemale: number | null;
  vpnEnabledCount: number;
  vpnEnabledPercentage: number;
  statusBreakdown: HRStatusBreakdown[];
  genderBreakdown: HRGenderBreakdown[];
  personnelTypeBreakdown: HRPersonnelTypeBreakdown[];
  positionBreakdown: HRPositionBreakdown[];
  departmentTypeBreakdown: HRDepartmentTypeBreakdown[];
}

export type AuditEvent = 'INSERT' | 'UPDATE' | 'DELETE' | 'RESTORE';

export interface AuditLog {
  id: string | number;
  uuid?: string;
  event: AuditEvent | string;
  auditable_type: string;
  auditable_id: string | number;
  old_values?: Record<string, unknown> | string | null;
  new_values?: Record<string, unknown> | string | null;
  url?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
  created_by?: string | number | null;
  actor?: Pick<Employee, 'id' | 'full_name' | 'username'> | null;
}

export const KNOWN_SUPPORT_REQUEST_STATUS_CODES = [
  'NEW',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'COMPLETED',
  'PAUSED',
  'TRANSFER_DEV',
  'TRANSFER_DMS',
  'UNABLE_TO_EXECUTE',
] as const;

export type KnownSupportRequestStatusCode = (typeof KNOWN_SUPPORT_REQUEST_STATUS_CODES)[number];
export type SupportRequestStatus = KnownSupportRequestStatusCode | (string & {});

const KNOWN_SUPPORT_REQUEST_STATUS_CODE_SET = new Set<string>(KNOWN_SUPPORT_REQUEST_STATUS_CODES);

export const isKnownSupportRequestStatusCode = (value: unknown): value is KnownSupportRequestStatusCode =>
  KNOWN_SUPPORT_REQUEST_STATUS_CODE_SET.has(String(value || '').trim().toUpperCase());

export const normalizeSupportRequestStatusCode = (
  value: unknown,
  fallback: KnownSupportRequestStatusCode = 'NEW'
): SupportRequestStatus => {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === '' ? fallback : normalized;
};
export type SupportRequestPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface SupportServiceGroup {
  id: string | number;
  group_code?: string | null;
  group_name: string;
  description?: string | null;
  is_active: boolean;
  used_in_support_requests?: number;
  used_in_programming_requests?: number;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
}

export interface SupportContactPosition {
  id: string | number;
  position_code: string;
  position_name: string;
  description?: string | null;
  is_active: boolean;
  used_in_customer_personnel?: number;
  is_code_editable?: boolean;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
}

export interface SupportRequestStatusOption {
  id: string | number | null;
  status_code: string;
  status_name: string;
  description?: string | null;
  requires_completion_dates?: boolean;
  is_terminal?: boolean;
  is_transfer_dev?: boolean;
  is_active?: boolean;
  sort_order?: number | null;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
  used_in_requests?: number;
  used_in_history?: number;
  is_code_editable?: boolean;
}

export interface SupportRequestReceiverOption {
  user_id: string | number;
  user_code?: string | null;
  username?: string | null;
  full_name?: string | null;
  raci_role?: 'R' | 'A' | 'C' | 'I' | null;
  is_default?: boolean;
}

export interface SupportRequestReceiverResult {
  project_id?: string | number | null;
  project_item_id?: string | number | null;
  default_receiver_user_id?: string | number | null;
  options: SupportRequestReceiverOption[];
}

export type SupportRequestTaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'CANCELLED';

export interface SupportRequestTask {
  id?: string | number;
  request_id?: string | number;
  task_code?: string | null;
  task_link?: string | null;
  status?: SupportRequestTaskStatus | null;
  sort_order?: number | null;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
}

export interface SupportRequest {
  id: string | number;
  request_code?: string | null;
  ticket_code?: string | null;
  reference_request_code?: string | null;
  reference_ticket_code?: string | null;
  reference_request_id?: string | number | null;
  reference_summary?: string | null;
  reference_status?: SupportRequestStatus | null;
  can_transfer_dev?: boolean;
  is_transferred_dev?: boolean;
  transfer_programming_request_id?: string | number | null;
  summary: string;
  service_group_id?: string | number | null;
  service_group_name?: string | null;
  project_item_id?: string | number | null;
  customer_id: string | number;
  customer_code?: string | null;
  customer_name?: string | null;
  project_id?: string | number | null;
  project_code?: string | null;
  project_name?: string | null;
  product_id?: string | number | null;
  product_code?: string | null;
  product_name?: string | null;
  reporter_name?: string | null;
  reporter_contact_id?: string | number | null;
  reporter_contact_name?: string | null;
  reporter_contact_phone?: string | null;
  reporter_contact_email?: string | null;
  assignee_id?: string | number | null;
  assignee_name?: string | null;
  assignee_username?: string | null;
  assignee_code?: string | null;
  receiver_user_id?: string | number | null;
  receiver_name?: string | null;
  receiver_username?: string | null;
  receiver_code?: string | null;
  status: SupportRequestStatus;
  priority: SupportRequestPriority;
  requested_date: string;
  due_date?: string | null;
  resolved_date?: string | null;
  hotfix_date?: string | null;
  noti_date?: string | null;
  task_link?: string | null;
  tasks?: SupportRequestTask[];
  task_count?: number;
  notes?: string | null;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
  deleted_at?: string | null;
}

export interface SupportRequestHistory {
  id: string | number;
  request_id: string | number;
  old_status?: SupportRequestStatus | null;
  new_status: SupportRequestStatus;
  comment?: string | null;
  created_at?: string | null;
  created_by?: string | number | null;
  created_by_name?: string | null;
  created_by_username?: string | null;
  ticket_code?: string | null;
  request_summary?: string | null;
}

export interface ProjectItemMaster {
  id: string | number;
  project_id: string | number;
  project_code?: string | null;
  project_name?: string | null;
  customer_id?: string | number | null;
  customer_code?: string | null;
  customer_name?: string | null;
  product_id: string | number;
  product_code?: string | null;
  product_name?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  display_name?: string | null;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
  deleted_at?: string | null;
}

export const KNOWN_OPPORTUNITY_STAGE_CODES = ['NEW', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as const;
export type KnownOpportunityStageCode = (typeof KNOWN_OPPORTUNITY_STAGE_CODES)[number];
export type OpportunityStage = KnownOpportunityStageCode | (string & {});
export type OpportunityStatus = OpportunityStage;

export interface OpportunityStageOption {
  id: string | number | null;
  stage_code: string;
  stage_name: string;
  description?: string | null;
  is_terminal?: boolean;
  is_active?: boolean;
  sort_order?: number | null;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
  used_in_opportunities?: number;
  is_code_editable?: boolean;
}

export interface Opportunity {
  id: string | number;
  opp_name: string;
  customer_id: string | number;
  amount: number;
  stage: OpportunityStage;
}

export interface PipelineStageBreakdown {
  stage: OpportunityStage;
  value: number;
}

export type ProjectStatus = 'TRIAL' | 'ONGOING' | 'WARRANTY' | 'COMPLETED' | 'CANCELLED';
export type InvestmentMode = 'DAU_TU' | 'THUE_DICH_VU';

export interface ProjectItem {
  id: string;
  productId: string | number;
  quantity: number;
  unitPrice: number;
  discountPercent: number | string;
  discountAmount: number | string;
  lineTotal?: number;
  product_id?: string | number | null;
  unit_price?: number | null;
  line_total?: number | null;
  discountMode?: 'PERCENT' | 'AMOUNT';
}

export type RACIRole = 'A' | 'R' | 'C' | 'I';

export interface ProjectRACI {
  id: string;
  userId: string | number;
  roleType: RACIRole;
  assignedDate: string;
  user_id?: string | number | null;
  raci_role?: RACIRole | null;
  user_code?: string | null;
  username?: string | null;
  full_name?: string | null;
}

export interface ProjectRaciRow {
  id?: string | number | null;
  project_id: string | number;
  user_id: string | number;
  raci_role: RACIRole;
  user_code?: string | null;
  username?: string | null;
  full_name?: string | null;
  assigned_date?: string | null;
}

export interface Project {
  id: string | number;
  project_code: string;
  project_name: string;
  customer_id: string | number | null;
  opportunity_id?: string | number | null;
  start_date?: string | null;
  expected_end_date?: string | null;
  actual_end_date?: string | null;
  status: ProjectStatus;
  investment_mode?: InvestmentMode | string | null;
  data_scope?: string | null;
  items?: ProjectItem[];
  raci?: ProjectRACI[];
}

export interface ProjectStatusBreakdown {
  status: ProjectStatus;
  count: number;
}

export interface MonthlyRevenueComparison {
  month: string;
  planned: number;
  actual: number;
}

export interface DashboardStats {
  totalRevenue: number;
  actualRevenue: number;
  forecastRevenueMonth: number;
  forecastRevenueQuarter: number;
  monthlyRevenueComparison: MonthlyRevenueComparison[];
  pipelineByStage: PipelineStageBreakdown[];
  projectStatusCounts: ProjectStatusBreakdown[];
}

export type ContractStatus = 'DRAFT' | 'SIGNED' | 'RENEWED';
export type ContractTermUnit = 'MONTH' | 'DAY';
export type PaymentCycle = 'ONCE' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';
export type PaymentScheduleStatus = 'PENDING' | 'INVOICED' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface Contract {
  id: string | number;
  contract_code: string;
  contract_number?: string;
  contract_name: string;
  customer_id: string | number;
  project_id: string | number;
  value: number;
  total_value?: number;
  payment_cycle?: PaymentCycle;
  status: ContractStatus;
  sign_date?: string | null;
  effective_date?: string | null;
  expiry_date?: string | null;
  expiry_date_manual_override?: boolean;
  term_unit?: ContractTermUnit | null;
  term_value?: number | null;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}

export interface PaymentSchedule {
  id: string | number;
  contract_id: string | number;
  project_id?: string | number | null;
  milestone_name: string;
  cycle_number: number;
  expected_date: string;
  expected_amount: number;
  actual_paid_date?: string | null;
  actual_paid_amount: number;
  status: PaymentScheduleStatus;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type DocumentStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';

export interface DocumentType {
  id: string;
  name: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  driveFileId: string;
  createdAt: string;
  storageProvider?: 'LOCAL' | 'GOOGLE_DRIVE';
}

export interface Document {
  id: string;
  name: string;
  typeId?: string;
  customerId?: string | null;
  projectId?: string | null;
  productId?: string;
  productIds?: string[];
  expiryDate?: string;
  releaseDate?: string;
  scope?: 'DEFAULT' | 'PRODUCT_PRICING';
  status: DocumentStatus;
  attachments: Attachment[];
  createdDate?: string;
}

export interface Reminder {
  id: string;
  title: string;
  content: string;
  remindDate: string;
  assignedToUserId: string;
  createdDate?: string;
}

export interface UserDeptHistory {
  id: string;
  userId: string;
  fromDeptId: string;
  toDeptId: string;
  transferDate: string;
  reason: string;
  createdDate?: string;
  decisionNumber?: string;
  userCode?: string;
  userName?: string;
  fromDeptCode?: string | null;
  fromDeptName?: string | null;
  toDeptCode?: string | null;
  toDeptName?: string | null;
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
  | 'ADD_BUSINESS'
  | 'EDIT_BUSINESS'
  | 'DELETE_BUSINESS'
  | 'ADD_VENDOR'
  | 'EDIT_VENDOR'
  | 'DELETE_VENDOR'
  | 'ADD_PRODUCT'
  | 'EDIT_PRODUCT'
  | 'DELETE_PRODUCT'
  | 'ADD_CUSTOMER'
  | 'EDIT_CUSTOMER'
  | 'DELETE_CUSTOMER'
  | 'ADD_CUS_PERSONNEL'
  | 'EDIT_CUS_PERSONNEL'
  | 'DELETE_CUS_PERSONNEL'
  | 'ADD_OPPORTUNITY'
  | 'EDIT_OPPORTUNITY'
  | 'DELETE_OPPORTUNITY'
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
  | null;

export interface Toast {
  id: number;
  type: 'success' | 'error';
  title: string;
  message: string;
}

export * from './types/programmingRequest';
