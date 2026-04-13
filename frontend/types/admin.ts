import type { Attachment } from './customerRequest';
import type { Employee } from './employee';

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
  scope_type: 'SELF_ONLY' | 'DEPT_ONLY' | 'DEPT_AND_CHILDREN' | 'ALL';
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

export interface EmailSmtpIntegrationSettings {
  provider: 'EMAIL_SMTP';
  is_enabled: boolean;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_encryption?: 'tls' | 'ssl' | 'none' | null;
  smtp_username?: string | null;
  smtp_recipient_emails?: string | null;
  has_smtp_password: boolean;
  smtp_from_address?: string | null;
  smtp_from_name?: string | null;
  source?: 'DB' | 'DEFAULT';
  last_tested_at?: string | null;
  last_test_status?: 'SUCCESS' | 'FAILED' | null;
  last_test_message?: string | null;
  updated_at?: string | null;
}

export interface EmailSmtpIntegrationSettingsUpdatePayload {
  is_enabled: boolean;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_encryption?: 'tls' | 'ssl' | 'none' | null;
  smtp_username?: string | null;
  smtp_recipient_emails?: string | null;
  smtp_password?: string | null;
  clear_smtp_password?: boolean;
  smtp_from_address?: string | null;
  smtp_from_name?: string | null;
  test_recipient_email?: string | null;
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
