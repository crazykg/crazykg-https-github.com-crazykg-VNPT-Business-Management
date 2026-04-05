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
  created_by_name?: string | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
  updated_by_name?: string | null;
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
