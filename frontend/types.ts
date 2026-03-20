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

export interface BackblazeB2IntegrationSettings {
  provider: 'BACKBLAZE_B2';
  is_enabled: boolean;
  access_key_id?: string | null;
  bucket_id?: string | null;
  bucket_name?: string | null;
  region?: string | null;
  endpoint?: string | null;
  file_prefix?: string | null;
  has_secret_access_key: boolean;
  secret_access_key_preview?: string | null;
  source?: 'DB' | 'ENV';
  last_tested_at?: string | null;
  last_test_status?: 'SUCCESS' | 'FAILED' | null;
  last_test_message?: string | null;
  updated_at?: string | null;
}

export interface BackblazeB2IntegrationSettingsUpdatePayload {
  is_enabled: boolean;
  access_key_id?: string | null;
  bucket_id?: string | null;
  bucket_name?: string | null;
  region?: string | null;
  endpoint?: string | null;
  file_prefix?: string | null;
  secret_access_key?: string | null;
  clear_secret_access_key?: boolean;
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
  customer_id?: string | number | null;
  customer_code?: string | null;
  customer_name?: string | null;
  workflow_status_catalog_id?: string | number | null;
  workflow_status_code?: string | null;
  workflow_status_name?: string | null;
  workflow_status_form_key?: string | null;
  workflow_form_key?: string | null;
  used_in_customer_requests?: number;
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

export interface WorklogActivityTypeOption {
  id: string | number;
  code: string;
  name: string;
  description?: string | null;
  default_is_billable: boolean;
  phase_hint?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
  used_in_worklogs?: number;
  is_code_editable?: boolean;
}

export interface SupportSlaConfigOption {
  id: string | number;
  status: string;
  sub_status?: string | null;
  priority: string;
  sla_hours: number;
  request_type_prefix?: string | null;
  service_group_id?: string | number | null;
  service_group_name?: string | null;
  workflow_action_code?: string | null;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number | null;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
  is_status_editable?: boolean;
}

export interface WorkflowStatusCatalog {
  id: string | number;
  level: number;
  status_code: string;
  status_name: string;
  parent_id?: string | number | null;
  parent_name?: string | null;
  canonical_status?: string | null;
  canonical_sub_status?: string | null;
  flow_step?: string | null;
  form_key?: string | null;
  is_leaf?: boolean;
  allow_pending_selection?: boolean;
  sort_order?: number | null;
  is_active?: boolean;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
}

export interface WorkflowFormFieldConfig {
  id: string | number;
  status_catalog_id: string | number;
  status_name?: string | null;
  field_key: string;
  field_label: string;
  field_type: string;
  required?: boolean;
  sort_order?: number | null;
  excel_column?: string | null;
  options_json?: Array<{ value: string; label: string }> | null;
  is_active?: boolean;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
}

export interface WorkflowStatusTransition {
  id: string | number;
  from_status_catalog_id: string | number;
  from_status_name?: string | null;
  to_status_catalog_id: string | number;
  to_status_name?: string | null;
  action_code: string;
  action_name: string;
  required_role?: string | null;
  condition_json?: Record<string, unknown> | null;
  notify_targets_json?: string[] | null;
  sort_order?: number | null;
  is_active?: boolean;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
}

export interface CustomerRequestAvailableAction {
  id?: string | number;
  from_status_catalog_id?: string | number | null;
  from_status_name?: string | null;
  to_status_catalog_id?: string | number | null;
  to_status_name?: string | null;
  action_code: string;
  action_name: string;
  required_role?: string | null;
  condition_json?: Record<string, unknown> | null;
  notify_targets_json?: string[] | null;
  sort_order?: number | null;
  is_active?: boolean;
}

export interface CustomerRequestViewerRoleContext {
  primary_role?: 'ADMIN' | 'PM' | 'EXECUTOR' | 'CREATOR' | 'OTHER' | null;
  roles?: string[];
  can_view?: boolean;
  is_admin?: boolean;
  is_creator?: boolean;
  is_pm?: boolean;
  is_executor?: boolean;
}

export interface CustomerRequest {
  id: string | number;
  uuid?: string | null;
  request_code: string;
  status_catalog_id?: string | number | null;
  summary: string;
  project_item_id?: string | number | null;
  customer_id?: string | number | null;
  project_id?: string | number | null;
  product_id?: string | number | null;
  customer_name?: string | null;
  requester_name?: string | null;
  reporter_contact_id?: string | number | null;
  reporter_contact_name?: string | null;
  reporter_contact_phone?: string | null;
  reporter_contact_email?: string | null;
  service_group_id?: string | number | null;
  service_group_name?: string | null;
  service_group_workflow_status_catalog_id?: string | number | null;
  service_group_workflow_status_code?: string | null;
  service_group_workflow_status_name?: string | null;
  service_group_workflow_form_key?: string | null;
  receiver_user_id?: string | number | null;
  receiver_name?: string | null;
  assignee_id?: string | number | null;
  assignee_name?: string | null;
  viewer_execution_role?: 'WORKER' | 'ASSIGNER' | 'INITIAL_RECEIVER' | 'OTHER' | null;
  viewer_is_assignee?: boolean;
  viewer_is_receiver?: boolean;
  viewer_is_assigner?: boolean;
  viewer_is_initial_receiver_stage?: boolean;
  viewer_can_view?: boolean;
  viewer_role_context?: CustomerRequestViewerRoleContext | null;
  has_configured_transitions?: boolean;
  available_actions?: CustomerRequestAvailableAction[];
  reference_ticket_code?: string | null;
  reference_request_id?: string | number | null;
  status: string;
  sub_status?: string | null;
  status_name?: string | null;
  priority: SupportRequestPriority | string;
  requested_date?: string | null;
  assigned_date?: string | null;
  latest_transition_id?: string | number | null;
  hours_estimated?: number | string | null;
  notes?: string | null;
  attachments?: Attachment[];
  transition_metadata?: Record<string, unknown> | null;
  tasks?: SupportRequestTask[];
  flow_step?: string | null;
  form_key?: string | null;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
}

export interface CustomerRequestImportRowResult {
  index: number;
  success: boolean;
  action?: 'created' | 'updated';
  message?: string;
  data?: CustomerRequest;
}

export interface CustomerRequestChangeLogEntry {
  source_type: 'TRANSITION' | 'WORKLOG' | 'REF_TASK' | string;
  request_id: string | number;
  request_code?: string | null;
  request_summary?: string | null;
  task_code?: string | null;
  old_status?: string | null;
  new_status?: string | null;
  sub_status?: string | null;
  note?: string | null;
  transition_metadata?: Record<string, unknown> | null;
  hours_estimated?: number | string | null;
  pause_reason?: string | null;
  upcode_status?: string | null;
  progress?: number | string | null;
  actor_name?: string | null;
  occurred_at?: string | null;
}

export interface CustomerRequestDashboardDatasetRow {
  workflow_action_code: string;
  action_name?: string | null;
  service_group_id?: string | number | null;
  service_group_name?: string | null;
  to_status_catalog_id?: string | number | null;
  to_status_name?: string | null;
  transition_count: number;
  sla_tracked_count: number;
  sla_breached_count: number;
  sla_on_time_count: number;
  notification_total: number;
  notification_resolved: number;
  notification_skipped: number;
}

export interface CustomerRequestDashboardSummaryFilters {
  q?: string;
  status?: string | null;
  sub_status?: string | null;
  service_group_id?: string | number | null;
  workflow_action_code?: string | null;
  to_status_catalog_id?: string | number | null;
  date_from?: string | null;
  date_to?: string | null;
}

export interface CustomerRequestDashboardMetricTotals {
  transition_count: number;
  sla_tracked_count: number;
  sla_breached_count: number;
  sla_on_time_count: number;
  notification_total: number;
  notification_resolved: number;
  notification_skipped: number;
}

export interface CustomerRequestDashboardSummaryPayload {
  generated_at?: string | null;
  filters?: CustomerRequestDashboardSummaryFilters;
  summary: {
    totals: CustomerRequestDashboardMetricTotals;
    by_action: Array<CustomerRequestDashboardMetricTotals & {
      workflow_action_code: string;
      action_name?: string | null;
    }>;
    by_service_group: Array<CustomerRequestDashboardMetricTotals & {
      service_group_id?: string | number | null;
      service_group_name?: string | null;
    }>;
    by_target_status: Array<CustomerRequestDashboardMetricTotals & {
      to_status_catalog_id?: string | number | null;
      to_status_name?: string | null;
    }>;
    notifications: {
      total_logs: number;
      resolved_count: number;
      skipped_count: number;
    };
    sla: {
      tracked_count: number;
      breached_count: number;
      on_time_count: number;
    };
  };
  dataset: CustomerRequestDashboardDatasetRow[];
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
  task_source?: string | null;
  task_code?: string | null;
  task_link?: string | null;
  task_status?: SupportRequestTaskStatus | null;
  status?: SupportRequestTaskStatus | null;
  sort_order?: number | null;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
}

export interface CustomerRequestReferenceSearchItem {
  id: string | number;
  task_code?: string | null;
  request_code?: string | null;
  ticket_code?: string | null;
  summary?: string | null;
  status?: string | null;
  requested_date?: string | null;
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
  unit?: string | null;
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
  raci?: OpportunityRACI[];
  sync_raci?: boolean;
}

export interface PipelineStageBreakdown {
  stage: OpportunityStage;
  value: number;
}

export type ProjectStatus = string; // phase codes: 'CHUAN_BI' | 'CHUAN_BI_DAU_TU' | 'THUC_HIEN_DAU_TU' | 'KET_THUC_DAU_TU' | 'CHUAN_BI_KH_THUE' | ...
export type InvestmentMode = 'DAU_TU' | 'THUE_DICH_VU_DACTHU';

export interface ProjectTypeOption {
  id: string | number | null;
  type_code: string;
  type_name: string;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number | null;
  used_in_projects?: number;
  is_code_editable?: boolean;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
}

/**
 * Một ngày trong lịch làm việc (bảng monthly_calendars).
 * Primary key = date (DATE string "YYYY-MM-DD").
 */
export interface WorkCalendarDay {
  date: string;                  // "YYYY-MM-DD"
  year: number;
  month: number;
  day: number;
  week_number: number;
  day_of_week: number;           // 1=Chủ Nhật, 2=Thứ Hai … 7=Thứ Bảy
  is_weekend: boolean;
  is_working_day: boolean;
  is_holiday: boolean;
  holiday_name?: string | null;
  note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | number | null;
  updated_by?: string | number | null;
}

export type DepartmentWeeklyScheduleSession = 'MORNING' | 'AFTERNOON';

export interface DepartmentWeeklyScheduleParticipant {
  id?: string | number | null;
  user_id?: string | number | null;
  user_code?: string | null;
  full_name?: string | null;
  participant_name_snapshot?: string | null;
  sort_order?: number | null;
  display_name?: string | null;
}

export interface DepartmentWeeklyScheduleEntry {
  id?: string | number | null;
  calendar_date: string;
  session: DepartmentWeeklyScheduleSession;
  session_label?: string | null;
  sort_order?: number | null;
  work_content: string;
  location?: string | null;
  participant_text?: string | null;
  participants: DepartmentWeeklyScheduleParticipant[];
  participant_display?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | number | null;
  created_by_name?: string | null;
  updated_by?: string | number | null;
  updated_by_name?: string | null;
  can_delete?: boolean;
}

export interface DepartmentWeeklyScheduleDay {
  date: string;
  day: number;
  month: number;
  year: number;
  day_of_week: number;
  day_name: string;
  is_weekend: boolean;
  is_working_day: boolean;
  is_holiday: boolean;
  holiday_name?: string | null;
  sessions: Record<DepartmentWeeklyScheduleSession, DepartmentWeeklyScheduleEntry[]>;
}

export interface DepartmentWeeklySchedule {
  id?: string | number | null;
  department_id: string | number;
  department_code?: string | null;
  department_name?: string | null;
  week_start_date: string;
  week_end_date?: string | null;
  week_number?: number | null;
  year?: number | null;
  week_label?: string | null;
  date_range_label?: string | null;
  entries: DepartmentWeeklyScheduleEntry[];
  days?: DepartmentWeeklyScheduleDay[];
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | number | null;
  created_by_name?: string | null;
  created_by_username?: string | null;
  updated_by?: string | number | null;
  updated_by_name?: string | null;
  updated_by_username?: string | null;
}

export interface DepartmentWeekOption {
  week_start_date: string;
  week_end_date: string;
  week_number: number;
  year: number;
  label: string;
}

export interface YeuCauProcessField {
  name: string;
  label: string;
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'datetime'
    | 'boolean_nullable'
    | 'enum'
    | 'priority'
    | 'customer_select'
    | 'customer_personnel_select'
    | 'support_group_select'
    | 'project_item_select'
    | 'user_select'
    | 'hidden'
    | 'json_textarea';
  required?: boolean;
  options?: string[];
}

export interface YeuCauProcessListColumn {
  key: string;
  label: string;
}

export interface YeuCauProcessMeta {
  process_code: string;
  process_label: string;
  group_code: string;
  group_label: string;
  table_name: string;
  default_status: string;
  read_roles: string[];
  write_roles: string[];
  allowed_next_processes: string[];
  form_fields: YeuCauProcessField[];
  list_columns: YeuCauProcessListColumn[];
  active_count?: number;
}

export interface YeuCauProcessGroup {
  group_code: string;
  group_label: string;
  processes: YeuCauProcessMeta[];
}

export interface YeuCauProcessCatalog {
  master_fields: YeuCauProcessField[];
  groups: YeuCauProcessGroup[];
}

export interface YeuCau {
  id: string | number;
  don_vi_id?: string | number | null;
  ma_yc: string;
  request_code?: string;
  nguoi_tao_id?: string | number | null;
  nguoi_tao_name?: string | null;
  created_by?: string | number | null;
  created_by_name?: string | null;
  updated_by?: string | number | null;
  updated_by_name?: string | null;
  khach_hang_id?: string | number | null;
  khach_hang_name?: string | null;
  customer_id?: string | number | null;
  customer_name?: string | null;
  project_id?: string | number | null;
  project_item_id?: string | number | null;
  product_id?: string | number | null;
  customer_personnel_id?: string | number | null;
  requester_name?: string | null;
  support_service_group_id?: string | number | null;
  support_service_group_name?: string | null;
  received_by_user_id?: string | number | null;
  received_by_name?: string | null;
  received_at?: string | null;
  summary?: string | null;
  tieu_de: string;
  mo_ta?: string | null;
  do_uu_tien: number;
  loai_yc?: string | null;
  kenh_tiep_nhan?: string | null;
  kenh_khac?: string | null;
  source_channel?: string | null;
  pm_id?: string | number | null;
  pm_name?: string | null;
  ba_id?: string | number | null;
  ba_name?: string | null;
  r_id?: string | number | null;
  r_name?: string | null;
  dev_id?: string | number | null;
  dev_name?: string | null;
  nguoi_trao_doi_id?: string | number | null;
  nguoi_trao_doi_name?: string | null;
  trang_thai: string;
  tien_trinh_hien_tai?: string | null;
  tt_id_hien_tai?: string | number | null;
  ket_qua: 'dang_xu_ly' | 'hoan_thanh' | 'khong_tiep_nhan' | 'ket_thuc' | string;
  hoan_thanh_luc?: string | null;
  tong_gio_xu_ly?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  current_process_label?: string | null;
  current_process_group_label?: string | null;
  current_status_code?: string | null;
  current_status_name_vi?: string | null;
  current_status_instance_id?: string | number | null;
}

export interface YeuCauRelatedUser {
  id: string | number;
  yeu_cau_id: string | number;
  user_id: string | number;
  user_name?: string | null;
  user_code?: string | null;
  vai_tro: string;
  trang_thai_bat_dau?: string | null;
  cap_quyen_luc?: string | null;
  thu_hoi_luc?: string | null;
  cap_boi_id?: string | number | null;
  cap_boi_name?: string | null;
  is_active?: boolean;
}

export interface YeuCauTimelineEntry {
  id: string | number;
  yeu_cau_id: string | number;
  tien_trinh: string;
  tien_trinh_id?: string | number | null;
  trang_thai_cu?: string | null;
  trang_thai_moi?: string | null;
  nguoi_thay_doi_id?: string | number | null;
  nguoi_thay_doi_name?: string | null;
  nguoi_thay_doi_code?: string | null;
  ly_do?: string | null;
  thoi_gian_o_trang_thai_cu_gio?: number | null;
  thay_doi_luc?: string | null;
}

export interface YeuCauProcessRow {
  process_code: string;
  process_label: string;
  table_name: string;
  data: Record<string, unknown>;
}

export interface YeuCauRefTaskRow {
  id?: string | number | null;
  ref_task_id?: string | number | null;
  task_code?: string | null;
  task_link?: string | null;
  task_source?: string | null;
  task_status?: string | null;
  task_note?: string | null;
  sort_order?: number | null;
}

export interface YeuCauProcessDetail {
  yeu_cau: YeuCau;
  current_process?: YeuCauProcessMeta | null;
  process: YeuCauProcessMeta;
  process_row?: YeuCauProcessRow | null;
  allowed_next_processes: YeuCauProcessMeta[];
  transition_allowed: boolean;
  can_write: boolean;
  attachments?: Attachment[];
  ref_tasks?: YeuCauRefTaskRow[];
  worklogs?: Array<Record<string, unknown>>;
}

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

export interface OpportunityRACI {
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

export interface OpportunityRaciRow {
  id?: string | number | null;
  opportunity_id: string | number;
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

// ─── Project Procedure (Checklist) Types ───

export interface ProcedureTemplate {
  id: string | number;
  template_code: string;
  template_name: string;
  description?: string | null;
  is_active: boolean;
  phases?: string[];  // distinct phase codes từ backend (vd: ['CHUAN_BI','THUC_HIEN_DAU_TU',...])
}

export interface ProcedureTemplateStep {
  id: string | number;
  template_id: string | number;
  step_number: number;
  parent_step_id?: string | number | null;
  phase?: string | null;
  step_name: string;
  step_detail?: string | null;
  lead_unit?: string | null;
  support_unit?: string | null;
  expected_result?: string | null;
  default_duration_days?: number | null;
  sort_order: number;
  children?: ProcedureTemplateStep[];
}

export type ProcedureStepStatus = 'CHUA_THUC_HIEN' | 'DANG_THUC_HIEN' | 'HOAN_THANH';

export interface ProjectProcedure {
  id: string | number;
  project_id: string | number;
  template_id: string | number;
  procedure_name: string;
  overall_progress: number;
  notes?: string | null;
  steps?: ProjectProcedureStep[];
  template?: ProcedureTemplate;
}

export interface ProjectProcedureStep {
  id: string | number;
  procedure_id: string | number;
  template_step_id?: string | number | null;
  step_number: number;
  parent_step_id?: string | number | null;
  phase?: string | null;
  phase_label?: string | null;
  step_name: string;
  step_detail?: string | null;
  lead_unit?: string | null;
  support_unit?: string | null;
  expected_result?: string | null;
  duration_days?: number | null;
  progress_status: ProcedureStepStatus;
  document_number?: string | null;
  document_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  step_notes?: string | null;
  sort_order: number;
  worklogs_count?: number;
  blocking_worklogs_count?: number;
  created_by?: string | number | null;
  children?: ProjectProcedureStep[];
}

export interface ProcedureStepBatchUpdate {
  id: string | number;
  progress_status?: ProcedureStepStatus;
  document_number?: string | null;
  document_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  step_notes?: string | null;
}

export type WorklogType = 'STATUS_CHANGE' | 'DOCUMENT_ADDED' | 'NOTE' | 'CUSTOM';

export type IssueStatus = 'JUST_ENCOUNTERED' | 'IN_PROGRESS' | 'RESOLVED';

export interface SharedTimesheet {
  id: string | number;
  procedure_step_worklog_id: string | number;
  hours_spent: string | number;
  work_date: string;
  activity_description?: string | null;
  created_by?: string | number | null;
  updated_by?: string | number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SharedIssue {
  id: string | number;
  procedure_step_worklog_id: string | number;
  issue_content: string;
  proposal_content?: string | null;
  issue_status: IssueStatus;
  created_by?: string | number | null;
  updated_by?: string | number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AddWorklogPayload {
  content: string;
  hours_spent?: number | null;
  work_date?: string | null;
  activity_description?: string | null;
  difficulty?: string | null;
  proposal?: string | null;
  issue_status?: IssueStatus | null;
}

export interface ProcedureStepWorklog {
  id: string | number;
  step_id: string | number;
  procedure_id: string | number;
  log_type: WorklogType;
  content: string;
  old_value?: string | null;
  new_value?: string | null;
  created_by?: string | number | null;
  created_at: string;
  creator?: { id: string | number; full_name?: string | null; user_code?: string | null } | null;
  step?:    { id: string | number; step_name: string; step_number: number } | null;
  timesheet?: SharedTimesheet | null;
  issue?: SharedIssue | null;
}

export type ProcedureRaciRole = 'R' | 'A' | 'C' | 'I';

export interface ProcedureRaciEntry {
  id: string | number;
  procedure_id: string | number;
  user_id: string | number;
  raci_role: ProcedureRaciRole;
  note?: string | null;
  full_name?: string | null;
  user_code?: string | null;
  username?: string | null;
  created_at?: string | null;
}

export interface ProcedureStepRaciEntry {
  id: string | number;
  step_id: string | number;
  user_id: string | number;
  raci_role: ProcedureRaciRole;
  full_name?: string | null;
  user_code?: string | null;
  username?: string | null;
  created_at?: string | null;
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

export interface ContractItem {
  id: string | number;
  contract_id: string | number;
  product_id: string | number;
  product_code?: string | null;
  product_name?: string | null;
  unit?: string | null;
  quantity: number;
  unit_price: number;
}

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
  items?: ContractItem[];
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
  confirmed_by?: string | number | null;
  confirmed_by_name?: string | null;
  confirmed_at?: string | null;
  attachments?: Attachment[];
  created_at?: string;
  updated_at?: string;
}

export interface PaymentScheduleConfirmationPayload {
  actual_paid_date?: string | null;
  actual_paid_amount?: number | null;
  status?: PaymentScheduleStatus;
  notes?: string | null;
  attachments?: Attachment[];
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
  storageProvider?: 'LOCAL' | 'GOOGLE_DRIVE' | 'BACKBLAZE_B2';
  storagePath?: string | null;
  storageDisk?: string | null;
  storageVisibility?: string | null;
  warningMessage?: string | null;
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

// ── Feedback (Góp ý người dùng) ──────────────────────────────────────────────
export type FeedbackPriority = 'UNRATED' | 'LOW' | 'MEDIUM' | 'HIGH';
export type FeedbackStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';

export interface FeedbackResponse {
  id: number;
  feedback_id: number;
  content: string;
  is_admin_response: boolean;
  created_by: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface FeedbackRequest {
  id: number;
  uuid: string | null;
  title: string;
  description: string | null;
  priority: FeedbackPriority;
  status: FeedbackStatus;
  created_by: number | null;
  updated_by: number | null;
  status_changed_by: number | null;
  status_changed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  responses?: FeedbackResponse[];
  attachments?: Attachment[];
}
// ─────────────────────────────────────────────────────────────────────────────

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
  | 'ADD_FEEDBACK'
  | 'EDIT_FEEDBACK'
  | 'VIEW_FEEDBACK'
  | 'DELETE_FEEDBACK'
  | null;

export interface Toast {
  id: number;
  type: 'success' | 'error';
  title: string;
  message: string;
}
