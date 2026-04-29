export type Status = 'Active' | 'Inactive';
export type DeptScopeType = 'SELF_ONLY' | 'DEPT_ONLY' | 'DEPT_AND_CHILDREN' | 'ALL';

export type { EmployeePartyProfile, EmployeePartyProfileQuality, EmployeePartyListItem } from './types/employee';
export type { ProductFeatureCatalogListPage } from './types/product';
export type { RevenueSuggestionResponse, RevenueSuggestionPreview, RevenueSuggestionPreviewContractSource } from './types/revenue';
export type { UpsellProductDetail } from './types/customer';
export type {
  EmailSmtpIntegrationSettings,
  EmailSmtpIntegrationSettingsUpdatePayload,
  TelegramIntegrationSettings,
  TelegramIntegrationSettingsUpdatePayload,
  TelegramIntegrationSettingsTestPayload,
  TelegramIntegrationSettingsTestResult,
} from './types/admin';
export type { ContractSignerOption } from './types/contract';

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
    sign_period_total_value?: number;
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
  source?: 'DB' | 'DEFAULT';
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
  source?: 'DB' | 'DEFAULT';
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
  focal_point_name?: string | null;
  focal_point_phone?: string | null;
  focal_point_email?: string | null;
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
  service_group?: string | null;
  product_code: string;
  product_name: string;
  product_short_name?: string | null;
  package_name?: string | null;
  has_product_packages?: boolean;
  domain_id: string | number;
  vendor_id: string | number;
  standard_price: number;
  unit?: string | null;
  description?: string | null;
  attachments?: Attachment[];
  is_active?: boolean;
  standard_price_locked?: boolean;
  standard_price_lock_message?: string | null;
  standard_price_lock_references?: Array<{ table: string; label: string; count: number }>;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}

export interface ProductPackage {
  id: string | number;
  uuid?: string | null;
  product_id: string | number;
  package_code: string;
  package_name: string;
  product_name?: string | null;
  parent_product_code?: string | null;
  service_group?: string | null;
  domain_id?: string | number | null;
  vendor_id?: string | number | null;
  standard_price: number;
  unit?: string | null;
  description?: string | null;
  attachments?: Attachment[];
  is_active?: boolean;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
}

export type ProductFeatureStatus = 'ACTIVE' | 'INACTIVE';

export interface ProductFeature {
  id: string | number;
  uuid?: string | null;
  product_id: string | number;
  group_id: string | number;
  feature_name: string;
  detail_description?: string | null;
  status: ProductFeatureStatus;
  display_order: number;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
  created_by_actor?: Pick<Employee, 'id' | 'full_name' | 'username'> | null;
  updated_by_actor?: Pick<Employee, 'id' | 'full_name' | 'username'> | null;
}

export interface ProductFeatureGroup {
  id: string | number;
  uuid?: string | null;
  product_id: string | number;
  group_name: string;
  display_order: number;
  notes?: string | null;
  features: ProductFeature[];
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
  created_by_actor?: Pick<Employee, 'id' | 'full_name' | 'username'> | null;
  updated_by_actor?: Pick<Employee, 'id' | 'full_name' | 'username'> | null;
}

export interface ProductFeatureCatalog {
  product: Pick<Product, 'id' | 'uuid' | 'service_group' | 'product_code' | 'product_name' | 'package_name' | 'description' | 'is_active'> & {
    catalog_package_count?: number;
  };
  catalog_scope?: {
    catalog_product_id: string | number;
    product_ids: Array<string | number>;
    package_count: number;
    product_codes: string[];
  };
  groups: ProductFeatureGroup[];
  audit_logs: AuditLog[];
}

export interface Customer {
  id: string | number;
  uuid: string;
  customer_code: string | null;
  customer_code_auto_generated?: boolean | null;
  customer_name: string;
  company_name?: string | null;
  tax_code: string;
  address: string;
  customer_sector?: 'HEALTHCARE' | 'GOVERNMENT' | 'INDIVIDUAL' | 'OTHER' | null;
  healthcare_facility_type?:
    | 'PUBLIC_HOSPITAL'
    | 'PRIVATE_HOSPITAL'
    | 'MEDICAL_CENTER'
    | 'PRIVATE_CLINIC'
    | 'TYT_PKDK'
    | 'HOSPITAL_TTYT'
    | 'TYT_CLINIC'
    | 'OTHER'
    | null;
  bed_capacity?: number | null;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}

// ── Customer 360 Insight ──────────────────────────────────────────────────────

export interface CustomerInsightServiceUsed {
  product_id: string | number;
  product_name: string;
  unit?: string | null;
  service_group?: string | null;
  contract_count: number;
  total_value: number;
}

export interface CustomerInsightUpsellCandidate {
  product_id: string | number;
  product_name: string;
  standard_price: number;
  unit?: string | null;
  service_group?: string | null;
  /** Label tiếng Việt của nhóm dịch vụ, vd: "Dịch vụ lõi" */
  service_group_label: string;
  reason: string;
  popularity: number;
  /** true nếu thuộc GROUP_A — hiển thị badge ưu tiên tư vấn */
  is_priority: boolean;
  /** ≤3 tên khách hàng đang dùng sản phẩm này (minh chứng thực tế) */
  reference_customers: string[];
}

export interface CustomerInsight {
  customer: Customer;
  contracts_summary: {
    total_count: number;
    total_value: number;
    active_value: number;
    by_status: Record<string, number>;
  };
  services_used: CustomerInsightServiceUsed[];
  crc_summary: {
    total_cases: number;
    open_cases: number;
    by_status: Record<string, number>;
  };
  upsell_candidates: CustomerInsightUpsellCandidate[];
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
  gmail?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  mobile?: string | null;
  telechatbot?: string | null;
  status: EmployeeStatus;
  position_code?: string | null;
  position_name?: string | null;
  job_title_raw?: string | null;
  job_title_vi?: string | null;
  date_of_birth?: string | null;
  leave_date?: string | null;
  gender?: Gender | null;
  ip_address?: string | null;
  vpn_status?: VpnStatus | null;
  department_id: string | number | null;
  position_id: string | number | null;
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

export interface HRJobTitleBreakdown {
  job_title_name: string;
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
  jobTitleBreakdown: HRJobTitleBreakdown[];
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

export interface ProductUnitMaster {
  id: string | number;
  unit_code: string;
  unit_name: string;
  description?: string | null;
  is_active: boolean;
  used_in_products?: number;
  is_name_editable?: boolean;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
}

export interface ContractSignerMaster {
  id: string | number;
  internal_user_id: string | number;
  user_code?: string | null;
  full_name?: string | null;
  department_id?: string | number | null;
  dept_code?: string | null;
  dept_name?: string | null;
  used_in_contracts?: number;
  is_active: boolean;
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

export interface WorkflowDefinition {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  process_type: string;
  is_active: boolean;
  is_default: boolean;
  version?: number | null;
  activated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
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
  product_package_id?: string | number | null;
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

export type ProjectStatus = string; // phase codes + special statuses: 'CO_HOI' | 'CHUAN_BI' | ... | 'TAM_NGUNG' | 'HUY'
export type InvestmentMode = 'DAU_TU' | 'THUE_DICH_VU_DACTHU' | 'THUE_DICH_VU_COSAN';
export type PaymentCycle = 'ONCE' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';

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
  status_code?: string | null;
  process_label: string;
  group_code: string;
  group_label: string;
  table_name: string;
  default_status: string;
  read_roles: string[];
  write_roles: string[];
  allowed_next_processes: string[];
  allowed_previous_processes?: string[];
  form_fields: YeuCauProcessField[];
  list_columns: YeuCauProcessListColumn[];
  active_count?: number;
  decision_context_code?: string | null;
  decision_outcome_code?: string | null;
  decision_source_status_code?: string | null;
  handler_field?: string | null;
  ui_meta?: Record<string, unknown> | null;
  transition_meta?: Record<string, unknown> | null;
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
  process?: YeuCauProcessMeta | null;
  allowed_next_processes?: YeuCauProcessMeta[];
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
  dispatcher_user_id?: string | number | null;
  dispatcher_name?: string | null;
  performer_user_id?: string | number | null;
  performer_name?: string | null;
  receiver_user_id?: string | number | null;
  receiver_name?: string | null;
  receiver_username?: string | null;
  receiver_code?: string | null;
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
  accountable_user_id?: string | number | null;
  accountable_name?: string | null;
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
  estimated_hours?: number | null;
  estimated_by_user_id?: string | number | null;
  estimated_at?: string | null;
  total_hours_spent?: number | null;
  hours_usage_pct?: number | null;
  warning_level?: string | null;
  over_estimate?: boolean;
  missing_estimate?: boolean;
  project_name?: string | null;
  product_name?: string | null;
  customer_personnel_name?: string | null;
  sla_due_at?: string | null;
  sla_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  current_process_label?: string | null;
  current_process_group_label?: string | null;
  current_status_code?: string | null;
  current_status_name_vi?: string | null;
  current_status_instance_id?: string | number | null;
  current_entered_at?: string | null;
  nguoi_xu_ly_id?: string | number | null;
  nguoi_xu_ly_name?: string | null;
  current_owner_user_id?: string | number | null;
  current_owner_name?: string | null;
  current_owner_field?: string | null;
  dispatch_route?: string | null;
  dispatched_at?: string | null;
  performer_accepted_at?: string | null;
  completed_at?: string | null;
  process_row?: YeuCauProcessRow | null;
  status_row?: YeuCauProcessRow | null;
}

export type CRCStatusCode =
  | 'new_intake'
  | 'assigned_to_dispatcher'
  | 'dispatched'
  | 'assigned_to_performer'
  | 'assigned_to_receiver'
  | 'in_progress'
  | 'completed'
  | 'waiting_notification'
  | 'customer_notified'
  | 'closed'
  | 'not_executed'
  | 'waiting_customer_feedback'
  | 'analysis'
  | 'analysis_completed'
  | 'analysis_suspended'
  | 'returned_to_dispatcher'
  | 'returned_to_manager'
  | 'pending_dispatch'
  | 'coding'
  | 'coding_in_progress'
  | 'coding_suspended'
  | 'dms_transfer'
  | 'dms_task_created'
  | 'dms_in_progress'
  | 'dms_suspended';

export type CodingPhase = 'coding' | 'coding_done' | 'upcode_pending' | 'upcode_deployed' | 'suspended';
export type DmsPhase = 'exchange' | 'task_created' | 'in_progress' | 'completed' | 'suspended';
export type DispatchRoute = 'self_handle' | 'assign_pm' | 'assign_direct';

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
  status_code?: string | null;
  tien_trinh_id?: string | number | null;
  trang_thai_cu?: string | null;
  trang_thai_moi?: string | null;
  nguoi_thay_doi_id?: string | number | null;
  nguoi_thay_doi_name?: string | null;
  nguoi_thay_doi_code?: string | null;
  ly_do?: string | null;
  decision_context_code?: string | null;
  decision_outcome_code?: string | null;
  decision_source_status_code?: string | null;
  decision_reason_label?: string | null;
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

export interface YeuCauEstimate {
  id: string | number;
  request_case_id?: string | number | null;
  status_instance_id?: string | number | null;
  status_code?: string | null;
  estimated_hours?: number | null;
  estimate_type?: string | null;
  estimate_scope?: string | null;
  phase_label?: string | null;
  note?: string | null;
  estimated_by_user_id?: string | number | null;
  estimated_by_name?: string | null;
  estimated_by_code?: string | null;
  estimated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface YeuCauHoursByPerformer {
  performed_by_user_id?: string | number | null;
  performed_by_name?: string | null;
  hours_spent?: number | null;
  worklog_count?: number;
}

export interface YeuCauHoursByActivity {
  activity_type_code: string;
  hours_spent?: number | null;
  worklog_count?: number;
}

export interface YeuCauHoursReport {
  request_case_id: string | number;
  estimated_hours?: number | null;
  total_hours_spent?: number | null;
  remaining_hours?: number | null;
  hours_usage_pct?: number | null;
  warning_level?: string | null;
  over_estimate?: boolean;
  missing_estimate?: boolean;
  latest_estimate?: YeuCauEstimate | null;
  worklog_count?: number;
  billable_hours?: number | null;
  non_billable_hours?: number | null;
  by_performer?: YeuCauHoursByPerformer[];
  by_activity?: YeuCauHoursByActivity[];
}

export interface YeuCauSearchItem {
  id: number;
  request_case_id?: number;
  request_code?: string | null;
  label?: string | null;
  summary?: string | null;
  customer_name?: string | null;
  project_name?: string | null;
  dispatcher_name?: string | null;
  performer_name?: string | null;
  current_status_code?: string | null;
  current_status_name_vi?: string | null;
  updated_at?: string | null;
}

export interface YeuCauWorklog {
  id: number;
  request_case_id?: number | null;
  status_instance_id?: number | null;
  status_code?: string | null;
  performed_by_user_id?: number | null;
  performed_by_name?: string | null;
  performed_by_code?: string | null;
  work_content?: string | null;
  work_date?: string | null;
  activity_type_code?: string | null;
  is_billable?: boolean | null;
  is_auto_transition?: boolean | null;
  transition_id?: number | null;
  work_started_at?: string | null;
  work_ended_at?: string | null;
  hours_spent?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface YeuCauAvailableActions {
  can_write?: boolean;
  can_transition?: boolean;
  can_transition_backward?: boolean;
  can_transition_forward?: boolean;
  can_add_worklog?: boolean;
  can_add_estimate?: boolean;
  can_delete?: boolean;
  pm_missing_customer_info_decision?: {
    enabled?: boolean;
    context_code: string;
    source_status_code?: string | null;
    target_status_codes: string[];
  } | null;
}

export interface YeuCauDashboardStatusCount {
  status_code: string;
  count: number;
}

export interface YeuCauDashboardAlertCounts {
  over_estimate: number;
  missing_estimate: number;
  sla_risk: number;
}

export interface YeuCauDashboardOperationalCounts {
  total_cases: number;
  active_cases: number;
  completed_cases: number;
  waiting_customer_feedback_cases: number;
  completion_rate: number;
}

export interface YeuCauDashboardOperationalSummary extends YeuCauDashboardOperationalCounts {
  by_type: {
    support: YeuCauDashboardOperationalCounts;
    programming: YeuCauDashboardOperationalCounts;
  };
}

export interface YeuCauDashboardSummary {
  total_cases: number;
  status_counts: YeuCauDashboardStatusCount[];
  alert_counts: YeuCauDashboardAlertCounts;
  operational?: YeuCauDashboardOperationalSummary;
}

export interface YeuCauDashboardTopCustomer {
  customer_id: string | number;
  customer_name?: string | null;
  count: number;
}

export interface YeuCauDashboardTopProject {
  project_id: string | number;
  project_name?: string | null;
  count: number;
}

export interface YeuCauDashboardTopPerformer {
  performer_user_id: string | number;
  performer_name?: string | null;
  count: number;
  department_id?: string | number | null;
  department_name?: string | null;
  total_cases?: number;
  active_cases?: number;
  completed_cases?: number;
  waiting_customer_feedback_cases?: number;
  completion_rate?: number;
  support_cases?: number;
  programming_cases?: number;
}

export interface YeuCauDashboardAttentionCase {
  request_case: YeuCau;
  reasons: string[];
}

export interface YeuCauDashboardUnitMetric {
  unit_key: string;
  customer_id?: string | number | null;
  customer_code?: string | null;
  customer_name: string;
  total_cases: number;
  active_cases: number;
  completed_cases: number;
  waiting_customer_feedback_cases: number;
  completion_rate: number;
  backlog_cases?: number;
  support_cases: number;
  programming_cases: number;
}

export interface YeuCauDashboardPayload {
  role: string;
  summary: YeuCauDashboardSummary;
  top_customers: YeuCauDashboardTopCustomer[];
  top_projects?: YeuCauDashboardTopProject[];
  top_performers: YeuCauDashboardTopPerformer[];
  unit_chart?: YeuCauDashboardUnitMetric[];
  top_backlog_units?: YeuCauDashboardUnitMetric[];
  attention_cases: YeuCauDashboardAttentionCase[];
}

export interface YeuCauPerformerTimesheetDay {
  date: string;
  hours_spent: number;
  billable_hours: number;
  non_billable_hours: number;
  entry_count: number;
}

export interface YeuCauPerformerTimesheetCase {
  request_case_id: string | number;
  request_code?: string | null;
  summary?: string | null;
  customer_name?: string | null;
  project_name?: string | null;
  status_code?: string | null;
  status_name_vi?: string | null;
  hours_spent: number;
  entry_count: number;
  last_worked_at?: string | null;
}

export interface YeuCauPerformerTimesheetEntry extends YeuCauWorklog {
  request_code?: string | null;
  summary?: string | null;
  customer_name?: string | null;
  project_name?: string | null;
  current_status_code?: string | null;
  current_status_name_vi?: string | null;
  worked_on?: string | null;
}

export interface YeuCauPerformerWeeklyTimesheet {
  start_date: string;
  end_date: string;
  performer_user_id?: string | number | null;
  total_hours: number;
  billable_hours: number;
  non_billable_hours: number;
  worklog_count: number;
  days: YeuCauPerformerTimesheetDay[];
  top_cases: YeuCauPerformerTimesheetCase[];
  recent_entries: YeuCauPerformerTimesheetEntry[];
}

export interface YeuCauProcessDetail {
  yeu_cau: YeuCau;
  current_status?: YeuCauProcessMeta | null;
  current_process?: YeuCauProcessMeta | null;
  process: YeuCauProcessMeta;
  process_row?: YeuCauProcessRow | null;
  status_row?: YeuCauProcessRow | null;
  allowed_next_processes: YeuCauProcessMeta[];
  allowed_previous_processes?: YeuCauProcessMeta[];
  transition_allowed: boolean;
  can_write: boolean;
  available_actions?: YeuCauAvailableActions;
  people?: YeuCauRelatedUser[];
  estimates?: YeuCauEstimate[];
  hours_report?: YeuCauHoursReport | null;
  attachments?: Attachment[];
  ref_tasks?: YeuCauRefTaskRow[];
  worklogs?: YeuCauWorklog[];
}

export interface ProjectItem {
  id: string;
  productId: string | number;
  productPackageId?: string | number | null;
  catalogValue?: string;
  unit?: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent: number | string;
  discountAmount: number | string;
  lineTotal?: number;
  product_id?: string | number | null;
  product_package_id?: string | number | null;
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
  department_id?: string | number | null;
  department_name?: string | null;
  department_code?: string | null;
  opportunity_id?: string | number | null;
  implementation_user_id?: string | number | null;
  implementation_user_code?: string | null;
  implementation_full_name?: string | null;
  implementation_unit_code?: string | null;
  implementation_unit_name?: string | null;
  start_date?: string | null;
  expected_end_date?: string | null;
  actual_end_date?: string | null;
  opportunity_score?: string | number | null;
  status: ProjectStatus;
  status_reason?: string | null;
  investment_mode?: InvestmentMode | string | null;
  payment_cycle?: PaymentCycle | string | null;
  estimated_value?: number | null;
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
  duration_days?: number | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  step_notes?: string | null;
}

export type ProcedureExportFormat = 'word' | 'excel';

export type ProcedurePublicShareTtlDays = 10 | 30 | 90;

export interface CreateProcedurePublicSharePayload {
  ttl_days: ProcedurePublicShareTtlDays;
  access_key: string;
}

export interface ProcedurePublicShareResult {
  token: string;
  public_url?: string | null;
  expires_at: string;
  ttl_days: ProcedurePublicShareTtlDays;
  email?: {
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    recipients: string[];
    message?: string | null;
  };
}

export interface PublicProcedureStep {
  display_number: string;
  level: number;
  step_name: string;
  step_detail?: string | null;
  lead_unit?: string | null;
  support_unit?: string | null;
  expected_result?: string | null;
  duration_days?: number | null;
  progress_status: ProcedureStepStatus | string;
  progress_status_label: string;
  document_number?: string | null;
  document_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
}

export interface PublicProcedurePhase {
  phase_label: string;
  summary: {
    total_steps: number;
    completed_steps: number;
  };
  steps: PublicProcedureStep[];
}

export interface PublicProcedurePayload {
  project: {
    project_code?: string | null;
    project_name?: string | null;
  };
  procedure: {
    procedure_name: string;
    overall_progress: number;
  };
  summary: {
    total_steps: number;
    completed_steps: number;
    in_progress_steps: number;
    not_started_steps: number;
    overall_percent: number;
  };
  phases: PublicProcedurePhase[];
  share?: {
    expires_at?: string | null;
  };
}

export type WorklogType = 'STATUS_CHANGE' | 'DOCUMENT_ADDED' | 'NOTE' | 'CUSTOM';

export type IssueStatus = 'JUST_ENCOUNTERED' | 'IN_PROGRESS' | 'RESOLVED';

export interface SharedTimesheet {
  id: string | number;
  procedure_step_worklog_id: string | number;
  hours_spent: string | number;
  work_date: string;
  work_started_at?: string | null;
  work_ended_at?: string | null;
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
  work_started_at?: string | null;
  work_ended_at?: string | null;
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
  department_id?: string | number | null;
  department_name?: string | null;
  department_code?: string | null;
  created_at?: string | null;
}

export interface MonthlyRevenueComparison {
  month: string;
  planned: number;
  actual: number;
}

export interface ContractStatusBreakdown {
  status: ContractStatus;
  count: number;
  totalValue: number;
}

export interface ExpiringContractSummary {
  id: string | number;
  contract_code: string;
  contract_name: string;
  customer_name: string;
  expiry_date: string;
  daysRemaining: number;
  value: number;
}

export interface ContractAggregateKpis {
  draftCount: number;
  renewedCount: number;
  signedTotalValue: number;
  collectionRate: number;
  newSignedCount: number;
  newSignedValue: number;
  totalPipelineValue: number;
  overduePaymentAmount: number;
  actualCollectedValue: number;
}

export interface CustomerHealthcareBreakdownKpis {
  publicHospital: number;
  privateHospital: number;
  medicalCenter: number;
  privateClinic: number;
  tytPkdk: number;
  other: number;
}

export interface CustomerAggregateKpis {
  totalCustomers: number;
  healthcareCustomers: number;
  governmentCustomers: number;
  individualCustomers: number;
  healthcareBreakdown: CustomerHealthcareBreakdownKpis;
  newThisMonth?: number;
  customersWithActiveContracts?: number;
  totalActiveContractValue?: number;
  customersWithoutContracts?: number;
  customersWithOpenOpportunities?: number;
  openOppValue?: number;
  customersWithOpenCrc?: number;
}

export interface DashboardStats {
  totalRevenue: number;
  actualRevenue: number;
  forecastRevenueMonth: number;
  forecastRevenueQuarter: number;
  monthlyRevenueComparison: MonthlyRevenueComparison[];
  projectStatusCounts: ProjectStatusBreakdown[];
  contractStatusCounts: ContractStatusBreakdown[];
  collectionRate: number;
  overduePaymentCount: number;
  overduePaymentAmount: number;
  expiringContracts: ExpiringContractSummary[];
}

export type ContractStatus = 'DRAFT' | 'SIGNED' | 'RENEWED';
export type ContractTermUnit = 'MONTH' | 'DAY';
export type PaymentScheduleStatus = 'PENDING' | 'INVOICED' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type AddendumType = 'EXTENSION' | 'AMENDMENT' | 'LIQUIDATION';
export type ContinuityStatus = 'STANDALONE' | 'EARLY' | 'CONTINUOUS' | 'GAP';

export interface ContractItem {
  id: string | number;
  contract_id: string | number;
  product_id: string | number;
  product_package_id?: string | number | null;
  productPackageId?: string | number | null;
  product_code?: string | null;
  product_name?: string | null;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  vat_rate?: number | null;
  vat_amount?: number | null;
}

export interface Contract {
  id: string | number;
  contract_code: string;
  contract_number?: string;
  contract_name: string;
  customer_id: string | number | null;
  project_id: string | number | null;
  signer_user_id?: string | number | null;
  signer_user_code?: string | null;
  signer_full_name?: string | null;
  dept_id?: string | number | null;
  dept_code?: string | null;
  dept_name?: string | null;
  project_type_code?: InvestmentMode | string | null;
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
  attachments?: Attachment[];
  items?: ContractItem[];
  // Renewal / addendum fields
  parent_contract_id?: string | number | null;
  addendum_type?: AddendumType | null;
  gap_days?: number | null;
  continuity_status?: ContinuityStatus | null;
  penalty_rate?: number | null;          // e.g. 0.05 = 5%
  payment_schedule_count?: number;
  has_generated_payment_schedules?: boolean;
  can_edit_schedule_source_fields?: boolean;
  can_delete_unpaid_schedules?: boolean;
  parent_contract?: {
    id: number;
    contract_code: string;
    contract_name: string;
    expiry_date?: string | null;
    deleted_at?: string | null;          // null = active; ISO string = soft-deleted
  } | null;
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
  expected_start_date?: string | null;
  expected_end_date?: string | null;
  expected_amount: number;
  actual_paid_date?: string | null;
  actual_paid_amount: number;
  status: PaymentScheduleStatus;
  notes?: string | null;
  confirmed_by?: string | number | null;
  confirmed_by_name?: string | null;
  confirmed_at?: string | null;
  attachments?: Attachment[];
  // Penalty audit columns (populated when parent contract has penalty_rate)
  original_amount?: number | null;
  penalty_rate?: number | null;
  penalty_amount?: number | null;
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

export interface RevenueAnalyticsKpis {
  expected_revenue: number;
  actual_collected: number;
  outstanding: number;
  overdue_amount: number;
  overdue_count: number;
  carry_over_from_previous: number;
  cumulative_collected: number;
  collection_rate: number;
  avg_days_to_collect: number;
  on_time_rate: number;
}

export interface RevenueByPeriod {
  period_key: string;
  period_label: string;
  expected: number;
  actual: number;
  overdue: number;
  cumulative_expected: number;
  cumulative_actual: number;
  carry_over: number;
  schedule_count: number;
  paid_count: number;
}

export interface RevenueByCycle {
  cycle: PaymentCycle;
  cycle_label: string;
  contract_count: number;
  expected: number;
  actual: number;
  percentage_of_total: number;
}

export interface RevenueByItem {
  product_id: number;
  product_code: string;
  product_name: string;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  proportion: number;
  allocated_expected: number;
  allocated_actual: number;
  allocated_outstanding: number;
}

export interface RevenueByContract {
  contract_id: number;
  contract_code: string;
  contract_name: string;
  customer_name: string;
  payment_cycle: PaymentCycle | string;
  contract_value: number;
  expected_in_period: number;
  actual_in_period: number;
  outstanding: number;
  items: RevenueByItem[] | null;
  /** Có mặt khi hợp đồng bị chấm dứt trước hạn (status=TERMINATED) */
  is_terminated?: boolean;
  /** Phí phạt chấm dứt sớm (nếu có) */
  penalty_amount?: number | null;
}

export interface OverdueDetail {
  schedule_id: number;
  contract_id: number;
  contract_code: string;
  customer_name: string;
  milestone_name: string;
  expected_date: string;
  expected_amount: number;
  days_overdue: number;
}

export interface ContractRevenueAnalytics {
  kpis: RevenueAnalyticsKpis;
  by_period: RevenueByPeriod[];
  by_cycle: RevenueByCycle[];
  by_contract: RevenueByContract[];
  by_item: RevenueByItem[] | null;
  overdue_details: OverdueDetail[];
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

export interface Tag {
  id: number;
  name: string;
  color: string;
  usage_count?: number;
}

export interface Document {
  id: string;
  name: string;
  typeId?: string;
  customerId?: string | null;
  projectId?: string | null;
  productId?: string;
  productIds?: string[];
  commissionPolicyText?: string | null;
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

export interface SendReminderEmailPayload {
  recipient_email: string;
}

export interface SendReminderEmailResult {
  status: 'SENT';
  message?: string;
  recipient_email: string;
  sent_at?: string | null;
  reminder?: {
    id: string;
    title: string;
    remindDate: string;
  };
}

export interface SendReminderTelegramPayload {
  recipient_user_id: string | number;
}

export interface SendReminderTelegramResult {
  status: 'SENT';
  message?: string;
  recipient_user_id: string;
  recipient_name?: string;
  sent_at?: string | null;
  reminder?: {
    id: string;
    title: string;
    remindDate: string;
  };
}

export type UserDeptHistoryTransferType = 'LUAN_CHUYEN' | 'BIET_PHAI';

export interface UserDeptHistory {
  id: string;
  userId: string;
  fromDeptId: string;
  toDeptId: string;
  transferDate: string;
  reason: string;
  createdDate?: string;
  decisionNumber?: string;
  transferType?: UserDeptHistoryTransferType;
  employeeCode?: string;
  employeeName?: string;
  fromDeptCode?: string | null;
  fromDeptName?: string | null;
  toDeptCode?: string | null;
  toDeptName?: string | null;
  canDelete?: boolean;
  deleteRestrictionMessage?: string | null;
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
  | 'ADD_PRODUCT_PACKAGE'
  | 'EDIT_PRODUCT_PACKAGE'
  | 'DELETE_PRODUCT_PACKAGE'
  | 'PRODUCT_PACKAGE_FEATURE_CATALOG'
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

// ── Customer Request Plans (§8 Kế hoạch giao việc) ──────────────────────────

export interface CustomerRequestPlan {
  id: number;
  plan_code: string;
  plan_type: 'weekly' | 'monthly';
  period_start: string;
  period_end: string;
  dispatcher_user_id: number | null;
  dispatcher_name: string | null;
  dispatcher_code?: string | null;
  status: 'draft' | 'submitted' | 'approved';
  note: string | null;
  total_planned_hours: number;
  item_count?: number;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CustomerRequestPlanItem {
  id: number;
  plan_id: number;
  request_case_id: number;
  request_code?: string | null;
  summary?: string | null;
  current_status_code?: string | null;
  performer_user_id: number | null;
  performer_name?: string | null;
  performer_code?: string | null;
  planned_hours: number;
  planned_start_date: string | null;
  planned_end_date: string | null;
  priority_order: number;
  note: string | null;
  actual_hours: number;
  actual_status: 'pending' | 'in_progress' | 'completed' | 'carried_over' | 'cancelled';
  carried_to_plan_id: number | null;
  created_by?: number | null;
  updated_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CRCFullDetail {
  request_case: Record<string, unknown>;
  people: unknown[];
  timeline: unknown[];
  worklog_summary: unknown[];
  estimates: unknown[];
  ref_tasks: unknown[];
  attachments: unknown[];
  hours: Record<string, unknown>;
}

// ── Phase 6: Report ──────────────────────────────────────────────────────────
export interface MonthlyHoursRow {
  user_id?: number | null;
  user_name?: string | null;
  project_id?: number | null;
  project_name?: string | null;
  customer_id?: number | null;
  customer_name?: string | null;
  activity_type_code?: string | null;
  total_hours: number;
  billable_hours: number;
  non_billable_hours: number;
  estimated_hours: number;
  request_count: number;
  completed_count: number;
  billable_percent?: number;
  hours_by_activity?: Record<string, number> | null;
}

export interface PainPointsData {
  overloaded_users: unknown[];
  low_billable_users: unknown[];
  estimate_variance: unknown[];
  long_running_cases: unknown[];
  status_stuck: unknown[];
  meeting_heavy: unknown[];
  top_customer_load: unknown[];
}

// ── Phase 6: Escalation ──────────────────────────────────────────────────────
export interface CustomerRequestEscalation {
  id: number;
  escalation_code: string;
  request_case_id: number;
  request_code?: string | null;
  summary?: string | null;
  raised_by_user_id: number;
  raiser_name?: string | null;
  raiser_code?: string | null;
  raised_at: string;
  difficulty_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact_description: string | null;
  blocked_since: string | null;
  proposed_action: string | null;
  proposed_handler_user_id: number | null;
  proposed_additional_hours: number | null;
  proposed_deadline_extension: string | null;
  status: 'pending' | 'reviewing' | 'resolved' | 'rejected' | 'closed';
  reviewed_by_user_id: number | null;
  reviewer_name?: string | null;
  reviewed_at: string | null;
  resolution_decision: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// ── Phase 6: Leadership ──────────────────────────────────────────────────────
export interface LeadershipDirective {
  id: number;
  directive_code: string;
  issued_by_user_id: number;
  issuer_name?: string | null;
  assigned_to_user_id: number;
  assignee_name?: string | null;
  cc_user_ids: number[] | null;
  directive_type: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  source_type: string | null;
  source_escalation_id: number | null;
  linked_case_ids: number[] | null;
  deadline: string | null;
  status: 'pending' | 'acknowledged' | 'completed';
  acknowledged_at: string | null;
  completed_at: string | null;
  completion_note: string | null;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: string | null;
  updated_at?: string | null;
}

// ── Revenue Management ──────────────────────────────────────────────────────

export type RevenuePeriodType = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type RevenueTargetType = 'TOTAL' | 'NEW_CONTRACT' | 'RENEWAL' | 'RECURRING';
export type RevenueComparisonMode = 'MoM' | 'QoQ' | 'YoY';
export type RevenueAlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type RevenueAlertType = 'UNDER_TARGET' | 'HIGH_OVERDUE' | 'CONTRACT_EXPIRING' | 'COLLECTION_DROP';
export type RevenueSubView = 'OVERVIEW' | 'BY_CONTRACT' | 'BY_COLLECTION' | 'FORECAST' | 'REPORT';

export interface RevenueOverviewKpis {
  target_amount: number;
  expected_revenue: number;
  actual_collected: number;
  outstanding: number;
  achievement_pct: number;
  collection_rate: number;
  growth_pct: number;
  overdue_amount: number;
}

export interface RevenueOverviewPeriod {
  period_key: string;
  period_label: string;
  target: number;
  contract_expected: number;
  contract_actual: number;
  invoice_expected: number;
  invoice_actual: number;
  total_expected: number;
  total_actual: number;
  cumulative_target: number;
  cumulative_expected: number;
  cumulative_actual: number;
  achievement_pct: number;
}

export interface RevenueBySource {
  source: string;
  label: string;
  amount: number;
  pct: number;
}

export interface RevenueAlert {
  type: RevenueAlertType;
  severity: RevenueAlertSeverity;
  message: string;
  context: Record<string, unknown>;
}

export interface RevenueOverviewData {
  kpis: RevenueOverviewKpis;
  by_period: RevenueOverviewPeriod[];
  by_source: RevenueBySource[];
  alerts: RevenueAlert[];
}

export interface RevenueOverviewResponse {
  meta: {
    fee_collection_available: boolean;
    data_sources: string[];
  };
  data: RevenueOverviewData;
}

export interface RevenueTarget {
  id: number;
  period_type: RevenuePeriodType;
  period_key: string;
  period_start: string;
  period_end: string;
  dept_id: number;
  target_type: RevenueTargetType;
  target_amount: number;
  actual_amount: number;
  achievement_pct: number;
  notes: string | null;
  approved_by: number | null;
  approved_at: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface RevenueTargetBulkInput {
  year: number;
  period_type: RevenuePeriodType;
  target_type: RevenueTargetType;
  dept_ids: number[];
  targets: Array<{ period_key: string; amount: number }>;
}

export interface RevenueSuggestion {
  period_key: string;
  contract_amount: number;
  opportunity_amount: number;
  suggested_total: number;
  contract_count: number;
  opportunity_count: number;
}

export interface ProjectRevenueSchedule {
  id: number;
  project_id: number;
  cycle_number: number;
  expected_date: string | null;
  expected_amount: number;
  notes: string | null;
  created_by?: number | null;
  updated_by?: number | null;
  created_by_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// ─── Fee Collection (Thu Cước) ───────────────────────────────────────────────

// NOTE: OVERDUE is NOT a persisted DB status — overdue state is computed via `is_overdue: boolean`.
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'PAID' | 'CANCELLED' | 'VOID';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'ONLINE' | 'OFFSET' | 'OTHER';
export type ReceiptStatus = 'CONFIRMED' | 'PENDING_CONFIRM' | 'REJECTED';

export interface InvoiceItem {
  id?: string | number;
  invoice_id?: string | number;
  product_id?: string | number | null;
  description: string;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  vat_rate?: number | null;
  line_total?: number;
  vat_amount?: number;
  payment_schedule_id?: string | number | null;
  sort_order?: number;
}

export interface Invoice {
  id: string | number;
  invoice_code: string;
  invoice_series?: string | null;
  contract_id: string | number;
  customer_id: string | number;
  project_id?: string | number | null;
  invoice_date: string;
  due_date: string;
  period_from?: string | null;
  period_to?: string | null;
  subtotal: number;
  vat_rate?: number | null;
  vat_amount: number;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  is_overdue: boolean;            // computed: due_date < today && outstanding > 0 && status ∉ terminal
  status: InvoiceStatus;
  notes?: string | null;
  items?: InvoiceItem[];
  dunning_logs?: DunningLog[];
  contract_code?: string | null;
  customer_name?: string | null;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
}

export interface DunningLog {
  id: string | number;
  invoice_id: string | number;
  customer_id: string | number;
  dunning_level: number;
  sent_at: string;
  sent_via: string;
  message?: string | null;
  response_note?: string | null;
  created_by?: string | number | null;
  created_at?: string | null;
}

export interface Receipt {
  id: string | number;
  receipt_code: string;
  invoice_id?: string | number | null;
  contract_id: string | number;
  customer_id: string | number;
  receipt_date: string;
  amount: number;
  payment_method: PaymentMethod;
  bank_name?: string | null;
  bank_account?: string | null;
  transaction_ref?: string | null;
  status: ReceiptStatus;
  is_reversed?: boolean;
  is_reversal_offset?: boolean;
  original_receipt_id?: string | number | null;
  notes?: string | null;
  confirmed_by?: string | number | null;
  confirmed_by_name?: string | null;
  confirmed_at?: string | null;
  invoice_code?: string | null;
  contract_code?: string | null;
  customer_name?: string | null;
  created_at?: string | null;
  created_by?: string | number | null;
}

// Fee Collection Dashboard
export interface FeeCollectionKpis {
  expected_revenue: number;    // total invoiced in period
  actual_collected: number;    // total receipts confirmed in period
  collection_rate: number;     // percentage 0-100
  avg_days_to_collect: number;
  outstanding: number;         // total outstanding across all open invoices
  overdue_amount: number;      // outstanding on past-due invoices
  overdue_count: number;
}

export interface FeeCollectionByMonth {
  month_key: string;
  month_label: string;
  invoiced: number;
  collected: number;
  outstanding_eom: number;
  cumulative_invoiced: number;
  cumulative_collected: number;
}

export interface TopDebtor {
  customer_id: number;
  customer_name: string;
  total_outstanding: number;
  overdue_amount: number;
  invoice_count: number;
  oldest_overdue_days: number;
}

export interface UrgentOverdueItem {
  invoice_id: number;
  invoice_code: string;
  customer_id: number;
  customer_name: string;
  contract_id: number;
  due_date: string;
  outstanding: number;
  days_overdue: number;
}

export interface FeeCollectionDashboard {
  kpis: FeeCollectionKpis;
  by_month: FeeCollectionByMonth[];
  top_debtors: TopDebtor[];
  urgent_overdue: UrgentOverdueItem[];
}

// Debt Aging Report
export interface DebtAgingRow {
  customer_id: number;
  customer_name: string;
  current_bucket: number;
  bucket_1_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_over_90: number;
  total_outstanding: number;
  invoices?: Invoice[];
}

export interface DebtAgingTotals {
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  over_90: number;
  total: number;
}

export interface DebtAgingReport {
  rows: DebtAgingRow[];
  totals: DebtAgingTotals;
}

export interface DebtTrendPoint {
  month_key: string;
  month_label: string;
  total_outstanding: number;
  total_overdue: number;
}

// ─── Revenue Sub-views (By Contract, Forecast, Report) ───────────────────────

export interface RevenueByContractRow {
  contract_id: number;
  contract_code: string;
  contract_name: string;
  contract_status: string;
  customer_id: number;
  customer_name: string;
  schedule_count: number;
  expected_revenue: number;
  actual_collected: number;
  outstanding: number;
  collection_rate: number;
}

export interface RevenueByContractKpis {
  contract_count: number;
  total_expected: number;
  total_collected: number;
  total_outstanding: number;
  collection_rate: number;
}

export interface RevenueByContractResponse {
  data: RevenueByContractRow[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    kpis: RevenueByContractKpis;
  };
}

export interface RevenueContractSchedule {
  schedule_id: number;
  milestone_name: string | null;
  cycle_number: number | null;
  expected_date: string;
  expected_amount: number;
  actual_amount: number;
  actual_paid_date: string | null;
  schedule_status: string;
  invoice_id: number | null;
  invoice_code: string | null;
  invoice_status: string | null;
  invoice_total: number | null;
  invoice_paid: number | null;
}

export interface RevenueForecastKpis {
  total_expected: number;
  total_confirmed: number;
  total_pending: number;
  confirmation_rate: number;
  expiring_contracts: number;
  expiring_value: number;
  horizon_months: number;
}

export interface RevenueForecastMonth {
  month_key: string;
  month_label: string;
  expected: number;
  confirmed: number;
  pending: number;
  schedule_count: number;
  contract_count: number;
}

export interface RevenueForecastByStatus {
  contract_status: string;
  expected: number;
  contract_count: number;
  percentage: number;
}

export interface RevenueForecastData {
  kpis: RevenueForecastKpis;
  by_month: RevenueForecastMonth[];
  by_contract_status: RevenueForecastByStatus[];
}

export interface RevenueReportRow {
  // Department dimension
  department_id?: number;
  department_name?: string;
  // Customer dimension
  customer_id?: number;
  customer_name?: string;
  // Product dimension
  product_id?: number;
  product_name?: string;
  contract_value?: number;
  // Time dimension
  month_key?: string;
  month_label?: string;
  cumulative_expected?: number;
  cumulative_collected?: number;
  // Common fields
  expected?: number;
  collected?: number;
  outstanding?: number;
  collection_rate?: number;
  contract_count?: number;
  share_pct?: number;
}

export type RevenueReportDimension = 'department' | 'customer' | 'product' | 'time';

export interface RevenueReportData {
  dimension: RevenueReportDimension;
  rows: RevenueReportRow[];
  totals: Record<string, number>;
}
