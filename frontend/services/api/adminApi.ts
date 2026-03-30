import type {
  AuditLog,
  BackblazeB2IntegrationSettings,
  BackblazeB2IntegrationSettingsUpdatePayload,
  ContractExpiryAlertSettings,
  ContractExpiryAlertSettingsUpdatePayload,
  ContractPaymentAlertSettings,
  ContractPaymentAlertSettingsUpdatePayload,
  FeedbackRequest,
  FeedbackResponse,
  GoogleDriveIntegrationSettings,
  GoogleDriveIntegrationSettingsUpdatePayload,
  Permission,
  Role,
  UserAccessRecord,
  UserDeptHistory,
} from '../../types/admin';
import type { Attachment } from '../../types/customerRequest';
import type { PaginatedQuery, PaginatedResult } from '../../types/common';
import {
  apiFetch,
  fetchList,
  fetchPaginatedList,
  JSON_ACCEPT_HEADER,
  JSON_HEADERS,
  normalizeNullableText,
  parseErrorMessage,
  parseItemJson,
} from './_infra';

const normalizeUserDeptHistoryRecord = (payload: Record<string, unknown>): UserDeptHistory => ({
  id: String(payload.id ?? ''),
  userId: String(payload.userId ?? ''),
  fromDeptId: String(payload.fromDeptId ?? ''),
  toDeptId: String(payload.toDeptId ?? ''),
  transferDate: String(payload.transferDate ?? ''),
  reason: String(payload.reason ?? ''),
  createdDate: normalizeNullableText(payload.createdDate) ?? undefined,
  decisionNumber: normalizeNullableText(payload.decisionNumber) ?? undefined,
  employeeCode: normalizeNullableText(payload.employeeCode ?? payload.userCode) ?? undefined,
  employeeName: normalizeNullableText(payload.employeeName ?? payload.userName) ?? undefined,
  fromDeptCode: normalizeNullableText(payload.fromDeptCode),
  fromDeptName: normalizeNullableText(payload.fromDeptName),
  toDeptCode: normalizeNullableText(payload.toDeptCode),
  toDeptName: normalizeNullableText(payload.toDeptName),
});

export const fetchUserDeptHistory = async (): Promise<UserDeptHistory[]> => {
  const rows = await fetchList<Record<string, unknown>>('/api/v5/user-dept-history');
  return rows.map((item) => normalizeUserDeptHistoryRecord(item));
};

export const fetchUserDeptHistoryPage = async (query: PaginatedQuery): Promise<PaginatedResult<UserDeptHistory>> => {
  const result = await fetchPaginatedList<Record<string, unknown>>('/api/v5/user-dept-history', query);
  return {
    ...result,
    data: result.data.map((item) => normalizeUserDeptHistoryRecord(item)),
  };
};

export const fetchAuditLogs = async (): Promise<AuditLog[]> => fetchList<AuditLog>('/api/v5/audit-logs');

export const fetchAuditLogsPage = async (query: PaginatedQuery): Promise<PaginatedResult<AuditLog>> =>
  fetchPaginatedList<AuditLog>('/api/v5/audit-logs', query);

export const uploadFeedbackAttachment = async (file: File): Promise<Attachment> => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await apiFetch('/api/v5/documents/upload-attachment', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPLOAD_FEEDBACK_ATTACHMENT_FAILED'));
  }

  return parseItemJson<Attachment>(res);
};

export const deleteUploadedFeedbackAttachment = async (payload: {
  attachmentId?: number | string | null;
  driveFileId?: string | null;
  fileUrl?: string | null;
  storagePath?: string | null;
  storageDisk?: string | null;
}): Promise<void> => {
  const query = new URLSearchParams();
  const attachmentId = payload.attachmentId != null ? String(Number(payload.attachmentId)) : null;

  if (attachmentId !== null && attachmentId !== 'NaN') {
    query.set('attachmentId', attachmentId);
  }
  if (payload.driveFileId) {
    query.set('driveFileId', payload.driveFileId);
  }
  if (payload.fileUrl) {
    query.set('fileUrl', payload.fileUrl);
  }
  if (payload.storagePath) {
    query.set('storagePath', payload.storagePath);
  }
  if (payload.storageDisk) {
    query.set('storageDisk', payload.storageDisk);
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch(`/api/v5/documents/upload-attachment${suffix}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_FEEDBACK_ATTACHMENT_FAILED'));
  }
};

export const fetchGoogleDriveIntegrationSettings = async (): Promise<GoogleDriveIntegrationSettings> => {
  const res = await apiFetch('/api/v5/integrations/google-drive', {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_GOOGLE_DRIVE_INTEGRATION_FAILED'));
  }

  return parseItemJson<GoogleDriveIntegrationSettings>(res);
};

export const updateGoogleDriveIntegrationSettings = async (
  payload: GoogleDriveIntegrationSettingsUpdatePayload
): Promise<GoogleDriveIntegrationSettings> => {
  const res = await apiFetch('/api/v5/integrations/google-drive', {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      is_enabled: payload.is_enabled,
      account_email: normalizeNullableText(payload.account_email),
      folder_id: normalizeNullableText(payload.folder_id),
      scopes: normalizeNullableText(payload.scopes),
      impersonate_user: normalizeNullableText(payload.impersonate_user),
      file_prefix: normalizeNullableText(payload.file_prefix),
      service_account_json: normalizeNullableText(payload.service_account_json),
      clear_service_account_json: Boolean(payload.clear_service_account_json),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_GOOGLE_DRIVE_INTEGRATION_FAILED'));
  }

  return parseItemJson<GoogleDriveIntegrationSettings>(res);
};

export const testGoogleDriveIntegrationSettings = async (
  payload?: GoogleDriveIntegrationSettingsUpdatePayload
): Promise<{
  message?: string;
  user_email?: string | null;
  status?: 'SUCCESS' | 'FAILED';
  tested_at?: string | null;
  persisted?: boolean;
}> => {
  const res = await apiFetch('/api/v5/integrations/google-drive/test', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: payload ? JSON.stringify({
      is_enabled: payload.is_enabled,
      account_email: normalizeNullableText(payload.account_email),
      folder_id: normalizeNullableText(payload.folder_id),
      scopes: normalizeNullableText(payload.scopes),
      impersonate_user: normalizeNullableText(payload.impersonate_user),
      file_prefix: normalizeNullableText(payload.file_prefix),
      service_account_json: normalizeNullableText(payload.service_account_json),
      clear_service_account_json: Boolean(payload.clear_service_account_json),
    }) : undefined,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'TEST_GOOGLE_DRIVE_INTEGRATION_FAILED'));
  }

  return parseItemJson<{
    message?: string;
    user_email?: string | null;
    status?: 'SUCCESS' | 'FAILED';
    tested_at?: string | null;
    persisted?: boolean;
  }>(res);
};

export const fetchBackblazeB2IntegrationSettings = async (): Promise<BackblazeB2IntegrationSettings> => {
  const res = await apiFetch('/api/v5/integrations/backblaze-b2', {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_BACKBLAZE_B2_INTEGRATION_FAILED'));
  }

  return parseItemJson<BackblazeB2IntegrationSettings>(res);
};

export const updateBackblazeB2IntegrationSettings = async (
  payload: BackblazeB2IntegrationSettingsUpdatePayload
): Promise<BackblazeB2IntegrationSettings> => {
  const res = await apiFetch('/api/v5/integrations/backblaze-b2', {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      is_enabled: payload.is_enabled,
      access_key_id: normalizeNullableText(payload.access_key_id),
      bucket_id: normalizeNullableText(payload.bucket_id),
      bucket_name: normalizeNullableText(payload.bucket_name),
      region: normalizeNullableText(payload.region),
      file_prefix: normalizeNullableText(payload.file_prefix),
      secret_access_key: normalizeNullableText(payload.secret_access_key),
      clear_secret_access_key: Boolean(payload.clear_secret_access_key),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_BACKBLAZE_B2_INTEGRATION_FAILED'));
  }

  return parseItemJson<BackblazeB2IntegrationSettings>(res);
};

export const testBackblazeB2IntegrationSettings = async (
  payload?: BackblazeB2IntegrationSettingsUpdatePayload
): Promise<{
  message?: string;
  status?: 'SUCCESS' | 'FAILED';
  tested_at?: string | null;
  persisted?: boolean;
}> => {
  const res = await apiFetch('/api/v5/integrations/backblaze-b2/test', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: payload ? JSON.stringify({
      is_enabled: payload.is_enabled,
      access_key_id: normalizeNullableText(payload.access_key_id),
      bucket_id: normalizeNullableText(payload.bucket_id),
      bucket_name: normalizeNullableText(payload.bucket_name),
      region: normalizeNullableText(payload.region),
      file_prefix: normalizeNullableText(payload.file_prefix),
      secret_access_key: normalizeNullableText(payload.secret_access_key),
      clear_secret_access_key: Boolean(payload.clear_secret_access_key),
    }) : undefined,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'TEST_BACKBLAZE_B2_INTEGRATION_FAILED'));
  }

  return parseItemJson<{
    message?: string;
    status?: 'SUCCESS' | 'FAILED';
    tested_at?: string | null;
    persisted?: boolean;
  }>(res);
};

export const fetchContractExpiryAlertSettings = async (): Promise<ContractExpiryAlertSettings> => {
  const res = await apiFetch('/api/v5/utilities/contract-expiry-alert', {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_CONTRACT_EXPIRY_ALERT_SETTINGS_FAILED'));
  }

  return parseItemJson<ContractExpiryAlertSettings>(res);
};

export const updateContractExpiryAlertSettings = async (
  payload: ContractExpiryAlertSettingsUpdatePayload
): Promise<ContractExpiryAlertSettings> => {
  const warningDays = Number(payload.warning_days);
  const res = await apiFetch('/api/v5/utilities/contract-expiry-alert', {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      warning_days: Number.isFinite(warningDays) ? Math.floor(warningDays) : 0,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_CONTRACT_EXPIRY_ALERT_SETTINGS_FAILED'));
  }

  return parseItemJson<ContractExpiryAlertSettings>(res);
};

export const fetchContractPaymentAlertSettings = async (): Promise<ContractPaymentAlertSettings> => {
  const res = await apiFetch('/api/v5/utilities/contract-payment-alert', {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_CONTRACT_PAYMENT_ALERT_SETTINGS_FAILED'));
  }

  return parseItemJson<ContractPaymentAlertSettings>(res);
};

export const updateContractPaymentAlertSettings = async (
  payload: ContractPaymentAlertSettingsUpdatePayload
): Promise<ContractPaymentAlertSettings> => {
  const warningDays = Number(payload.warning_days);
  const res = await apiFetch('/api/v5/utilities/contract-payment-alert', {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      warning_days: Number.isFinite(warningDays) ? Math.floor(warningDays) : 0,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_CONTRACT_PAYMENT_ALERT_SETTINGS_FAILED'));
  }

  return parseItemJson<ContractPaymentAlertSettings>(res);
};

export const fetchRoles = async (): Promise<Role[]> => fetchList<Role>('/api/v5/roles');

export const fetchPermissions = async (): Promise<Permission[]> => fetchList<Permission>('/api/v5/permissions');

export const fetchUserAccess = async (search?: string): Promise<UserAccessRecord[]> => {
  const query = search && search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  return fetchList<UserAccessRecord>(`/api/v5/user-access${query}`);
};

export const updateUserAccessRoles = async (
  userId: string | number,
  roleIds: number[]
): Promise<UserAccessRecord> => {
  const res = await apiFetch(`/api/v5/user-access/${userId}/roles`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ role_ids: roleIds }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_USER_ACCESS_ROLES_FAILED'));
  }

  return parseItemJson<UserAccessRecord>(res);
};

export const updateUserAccessPermissions = async (
  userId: string | number,
  overrides: Array<{
    permission_id: number;
    type: 'GRANT' | 'DENY';
    reason?: string | null;
    expires_at?: string | null;
  }>
): Promise<UserAccessRecord> => {
  const res = await apiFetch(`/api/v5/user-access/${userId}/permissions`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ overrides }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_USER_ACCESS_PERMISSIONS_FAILED'));
  }

  return parseItemJson<UserAccessRecord>(res);
};

export const updateUserAccessDeptScopes = async (
  userId: string | number,
  scopes: Array<{
    dept_id: number;
    scope_type: 'SELF_ONLY' | 'DEPT_ONLY' | 'DEPT_AND_CHILDREN' | 'ALL';
  }>
): Promise<UserAccessRecord> => {
  const res = await apiFetch(`/api/v5/user-access/${userId}/dept-scopes`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ scopes }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_USER_ACCESS_SCOPES_FAILED'));
  }

  return parseItemJson<UserAccessRecord>(res);
};

export const fetchFeedbacks = async (): Promise<FeedbackRequest[]> =>
  fetchList<FeedbackRequest>('/api/v5/feedback-requests');

export const fetchFeedbacksPage = async (
  query?: PaginatedQuery & { filters?: { q?: string; status?: string; priority?: string } }
): Promise<PaginatedResult<FeedbackRequest>> =>
  fetchPaginatedList<FeedbackRequest>('/api/v5/feedback-requests', query);

export const fetchFeedbackDetail = async (id: string | number): Promise<FeedbackRequest> => {
  const res = await apiFetch(`/api/v5/feedback-requests/${id}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_FEEDBACK_DETAIL_FAILED'));
  }

  return parseItemJson<FeedbackRequest>(res);
};

export const createFeedback = async (payload: {
  title: string;
  description?: string | null;
  priority?: string;
}): Promise<FeedbackRequest> => {
  const res = await apiFetch('/api/v5/feedback-requests', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_FEEDBACK_FAILED'));
  }

  return parseItemJson<FeedbackRequest>(res);
};

export const updateFeedback = async (
  id: string | number,
  payload: {
    title?: string;
    description?: string | null;
    priority?: string;
    status?: string;
  }
): Promise<FeedbackRequest> => {
  const res = await apiFetch(`/api/v5/feedback-requests/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_FEEDBACK_FAILED'));
  }

  return parseItemJson<FeedbackRequest>(res);
};

export const deleteFeedback = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/feedback-requests/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_FEEDBACK_FAILED'));
  }
};

export const createFeedbackResponse = async (
  feedbackId: string | number,
  payload: { content: string; is_admin_response?: boolean }
): Promise<FeedbackResponse> => {
  const res = await apiFetch(`/api/v5/feedback-requests/${feedbackId}/responses`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_FEEDBACK_RESPONSE_FAILED'));
  }

  return parseItemJson<FeedbackResponse>(res);
};

export const deleteFeedbackResponse = async (
  feedbackId: string | number,
  responseId: string | number
): Promise<void> => {
  const res = await apiFetch(`/api/v5/feedback-requests/${feedbackId}/responses/${responseId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_FEEDBACK_RESPONSE_FAILED'));
  }
};
