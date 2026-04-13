import type { BulkMutationResult } from '../../types/common';
import type { DepartmentWeekOption, DepartmentWeeklySchedule, WorkCalendarDay } from '../../types/scheduling';
import type {
  ContractSignerMaster,
  ProductUnitMaster,
  SupportContactPosition,
  SupportRequestStatusOption,
  SupportServiceGroup,
  SupportSlaConfigOption,
  WorklogActivityTypeOption,
} from '../../types/support';
import {
  apiFetch,
  fetchList,
  JSON_ACCEPT_HEADER,
  JSON_HEADERS,
  normalizeNullableNumber,
  normalizeNullableText,
  normalizeNumber,
  parseBulkMutationJson,
  parseErrorMessage,
  parseItemJson,
} from './_infra';

export const fetchSupportServiceGroups = async (includeInactive = false): Promise<SupportServiceGroup[]> => {
  const query = includeInactive ? '?include_inactive=1' : '';
  return fetchList<SupportServiceGroup>(`/api/v5/support-service-groups${query}`);
};

export const fetchAvailableSupportServiceGroups = async (params: {
  customer_id: string | number;
  include_group_id?: string | number | null;
  include_inactive?: boolean;
}): Promise<SupportServiceGroup[]> => {
  const searchParams = new URLSearchParams();
  searchParams.set('customer_id', String(params.customer_id));
  if (params.include_group_id !== null && params.include_group_id !== undefined && params.include_group_id !== '') {
    searchParams.set('include_group_id', String(params.include_group_id));
  }
  if (params.include_inactive) {
    searchParams.set('include_inactive', '1');
  }

  return fetchList<SupportServiceGroup>(`/api/v5/support-service-groups/available?${searchParams.toString()}`);
};

export const fetchSupportContactPositions = async (includeInactive = false): Promise<SupportContactPosition[]> => {
  const query = includeInactive ? '?include_inactive=1' : '';
  return fetchList<SupportContactPosition>(`/api/v5/support-contact-positions${query}`);
};

export const fetchProductUnitMasters = async (includeInactive = false): Promise<ProductUnitMaster[]> => {
  const query = includeInactive ? '?include_inactive=1' : '';
  return fetchList<ProductUnitMaster>(`/api/v5/product-unit-masters${query}`);
};

export const fetchContractSignerMasters = async (includeInactive = false): Promise<ContractSignerMaster[]> => {
  const query = includeInactive ? '?include_inactive=1' : '';
  return fetchList<ContractSignerMaster>(`/api/v5/contract-signer-masters${query}`);
};

export const fetchSupportRequestStatuses = async (includeInactive = false): Promise<SupportRequestStatusOption[]> => {
  const query = includeInactive ? '?include_inactive=1' : '';
  return fetchList<SupportRequestStatusOption>(`/api/v5/support-request-statuses${query}`);
};

export const fetchWorklogActivityTypes = async (includeInactive = false): Promise<WorklogActivityTypeOption[]> => {
  const query = includeInactive ? '?include_inactive=1' : '';
  return fetchList<WorklogActivityTypeOption>(`/api/v5/worklog-activity-types${query}`);
};

export const fetchSupportSlaConfigs = async (includeInactive = false): Promise<SupportSlaConfigOption[]> => {
  const query = includeInactive ? '?include_inactive=1' : '';
  return fetchList<SupportSlaConfigOption>(`/api/v5/support-sla-configs${query}`);
};

export const createSupportServiceGroup = async (
  payload: Partial<SupportServiceGroup>
): Promise<SupportServiceGroup> => {
  const res = await apiFetch('/api/v5/support-service-groups', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      customer_id: normalizeNullableNumber(payload.customer_id),
      group_code: normalizeNullableText(payload.group_code),
      group_name: payload.group_name,
      description: normalizeNullableText(payload.description),
      workflow_status_catalog_id: normalizeNullableNumber(payload.workflow_status_catalog_id),
      workflow_form_key: normalizeNullableText(payload.workflow_form_key),
      is_active: payload.is_active ?? true,
      created_by: normalizeNullableNumber(payload.created_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_SUPPORT_SERVICE_GROUP_FAILED'));
  }

  return parseItemJson<SupportServiceGroup>(res);
};

export const updateSupportServiceGroup = async (
  id: string | number,
  payload: Partial<SupportServiceGroup>
): Promise<SupportServiceGroup> => {
  const res = await apiFetch(`/api/v5/support-service-groups/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      customer_id: normalizeNullableNumber(payload.customer_id),
      group_code: normalizeNullableText(payload.group_code),
      group_name: normalizeNullableText(payload.group_name),
      description: normalizeNullableText(payload.description),
      workflow_status_catalog_id: normalizeNullableNumber(payload.workflow_status_catalog_id),
      workflow_form_key: normalizeNullableText(payload.workflow_form_key),
      is_active: payload.is_active,
      updated_by: normalizeNullableNumber(payload.updated_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_SUPPORT_SERVICE_GROUP_FAILED'));
  }

  return parseItemJson<SupportServiceGroup>(res);
};

export const createSupportServiceGroupsBulk = async (
  items: Array<Partial<SupportServiceGroup>>
): Promise<BulkMutationResult<SupportServiceGroup>> => {
  if (!Array.isArray(items) || items.length === 0) {
    return { results: [], created: [], created_count: 0, failed_count: 0 };
  }

  const res = await apiFetch('/api/v5/support-service-groups/bulk', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      items: items.map((item) => ({
        customer_id: normalizeNullableNumber(item.customer_id),
        group_code: normalizeNullableText(item.group_code),
        group_name: item.group_name,
        description: normalizeNullableText(item.description),
        is_active: item.is_active ?? true,
        created_by: normalizeNullableNumber(item.created_by),
      })),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_SUPPORT_SERVICE_GROUPS_BULK_FAILED'));
  }

  return parseBulkMutationJson<SupportServiceGroup>(res);
};

export const createSupportContactPosition = async (
  payload: Partial<SupportContactPosition>
): Promise<SupportContactPosition> => {
  const res = await apiFetch('/api/v5/support-contact-positions', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      position_code: normalizeNullableText(payload.position_code),
      position_name: normalizeNullableText(payload.position_name),
      description: normalizeNullableText(payload.description),
      is_active: payload.is_active ?? true,
      created_by: normalizeNullableNumber(payload.created_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_SUPPORT_CONTACT_POSITION_FAILED'));
  }

  return parseItemJson<SupportContactPosition>(res);
};

export const createProductUnitMaster = async (
  payload: Partial<ProductUnitMaster>
): Promise<ProductUnitMaster> => {
  const res = await apiFetch('/api/v5/product-unit-masters', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      unit_code: normalizeNullableText(payload.unit_code),
      unit_name: normalizeNullableText(payload.unit_name),
      description: normalizeNullableText(payload.description),
      is_active: payload.is_active ?? true,
      created_by: normalizeNullableNumber(payload.created_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_PRODUCT_UNIT_MASTER_FAILED'));
  }

  return parseItemJson<ProductUnitMaster>(res);
};

export const createContractSignerMaster = async (
  payload: Partial<ContractSignerMaster>
): Promise<ContractSignerMaster> => {
  const res = await apiFetch('/api/v5/contract-signer-masters', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      internal_user_id: normalizeNullableNumber(payload.internal_user_id),
      is_active: payload.is_active ?? true,
      created_by: normalizeNullableNumber(payload.created_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_CONTRACT_SIGNER_MASTER_FAILED'));
  }

  return parseItemJson<ContractSignerMaster>(res);
};

export const updateSupportContactPosition = async (
  id: string | number,
  payload: Partial<SupportContactPosition>
): Promise<SupportContactPosition> => {
  const res = await apiFetch(`/api/v5/support-contact-positions/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      position_code: normalizeNullableText(payload.position_code),
      position_name: normalizeNullableText(payload.position_name),
      description: normalizeNullableText(payload.description),
      is_active: payload.is_active,
      updated_by: normalizeNullableNumber(payload.updated_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_SUPPORT_CONTACT_POSITION_FAILED'));
  }

  return parseItemJson<SupportContactPosition>(res);
};

export const updateProductUnitMaster = async (
  id: string | number,
  payload: Partial<ProductUnitMaster>
): Promise<ProductUnitMaster> => {
  const res = await apiFetch(`/api/v5/product-unit-masters/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      unit_code: normalizeNullableText(payload.unit_code),
      unit_name: normalizeNullableText(payload.unit_name),
      description: normalizeNullableText(payload.description),
      is_active: payload.is_active,
      updated_by: normalizeNullableNumber(payload.updated_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_PRODUCT_UNIT_MASTER_FAILED'));
  }

  return parseItemJson<ProductUnitMaster>(res);
};

export const updateContractSignerMaster = async (
  id: string | number,
  payload: Partial<ContractSignerMaster>
): Promise<ContractSignerMaster> => {
  const res = await apiFetch(`/api/v5/contract-signer-masters/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      internal_user_id: normalizeNullableNumber(payload.internal_user_id),
      is_active: payload.is_active,
      updated_by: normalizeNullableNumber(payload.updated_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_CONTRACT_SIGNER_MASTER_FAILED'));
  }

  return parseItemJson<ContractSignerMaster>(res);
};

export const createSupportContactPositionsBulk = async (
  items: Array<Partial<SupportContactPosition>>
): Promise<BulkMutationResult<SupportContactPosition>> => {
  if (!Array.isArray(items) || items.length === 0) {
    return { results: [], created: [], created_count: 0, failed_count: 0 };
  }

  const res = await apiFetch('/api/v5/support-contact-positions/bulk', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      items: items.map((item) => ({
        position_code: normalizeNullableText(item.position_code),
        position_name: normalizeNullableText(item.position_name),
        description: normalizeNullableText(item.description),
        is_active: item.is_active ?? true,
        created_by: normalizeNullableNumber(item.created_by),
      })),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_SUPPORT_CONTACT_POSITIONS_BULK_FAILED'));
  }

  return parseBulkMutationJson<SupportContactPosition>(res);
};

export const createSupportRequestStatus = async (
  payload: Partial<SupportRequestStatusOption>
): Promise<SupportRequestStatusOption> => {
  const res = await apiFetch('/api/v5/support-request-statuses', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      status_code: normalizeNullableText(payload.status_code),
      status_name: normalizeNullableText(payload.status_name),
      description: normalizeNullableText(payload.description),
      requires_completion_dates:
        payload.requires_completion_dates === undefined ? true : Boolean(payload.requires_completion_dates),
      is_terminal: payload.is_terminal === undefined ? false : Boolean(payload.is_terminal),
      is_transfer_dev: payload.is_transfer_dev === undefined ? false : Boolean(payload.is_transfer_dev),
      is_active: payload.is_active === undefined ? true : Boolean(payload.is_active),
      sort_order: normalizeNumber(payload.sort_order, 0),
      created_by: normalizeNullableNumber(payload.created_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_SUPPORT_REQUEST_STATUS_FAILED'));
  }

  return parseItemJson<SupportRequestStatusOption>(res);
};

export const createSupportRequestStatusesBulk = async (
  items: Array<Partial<SupportRequestStatusOption>>
): Promise<BulkMutationResult<SupportRequestStatusOption>> => {
  if (!Array.isArray(items) || items.length === 0) {
    return { results: [], created: [], created_count: 0, failed_count: 0 };
  }

  const res = await apiFetch('/api/v5/support-request-statuses/bulk', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      items: items.map((item, index) => ({
        status_code: normalizeNullableText(item.status_code),
        status_name: normalizeNullableText(item.status_name),
        description: normalizeNullableText(item.description),
        requires_completion_dates:
          item.requires_completion_dates === undefined ? true : Boolean(item.requires_completion_dates),
        is_terminal: item.is_terminal === undefined ? false : Boolean(item.is_terminal),
        is_transfer_dev: item.is_transfer_dev === undefined ? false : Boolean(item.is_transfer_dev),
        is_active: item.is_active === undefined ? true : Boolean(item.is_active),
        sort_order: normalizeNumber(item.sort_order, index),
        created_by: normalizeNullableNumber(item.created_by),
      })),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_SUPPORT_REQUEST_STATUSES_BULK_FAILED'));
  }

  return parseBulkMutationJson<SupportRequestStatusOption>(res);
};

export const updateSupportRequestStatusDefinition = async (
  id: string | number,
  payload: Partial<SupportRequestStatusOption>
): Promise<SupportRequestStatusOption> => {
  const res = await apiFetch(`/api/v5/support-request-statuses/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      status_code: normalizeNullableText(payload.status_code),
      status_name: normalizeNullableText(payload.status_name),
      description: normalizeNullableText(payload.description),
      requires_completion_dates:
        payload.requires_completion_dates === undefined ? undefined : Boolean(payload.requires_completion_dates),
      is_terminal: payload.is_terminal === undefined ? undefined : Boolean(payload.is_terminal),
      is_transfer_dev: payload.is_transfer_dev === undefined ? undefined : Boolean(payload.is_transfer_dev),
      is_active: payload.is_active === undefined ? undefined : Boolean(payload.is_active),
      sort_order: payload.sort_order === undefined ? undefined : normalizeNumber(payload.sort_order, 0),
      updated_by: normalizeNullableNumber(payload.updated_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_SUPPORT_REQUEST_STATUS_DEFINITION_FAILED'));
  }

  return parseItemJson<SupportRequestStatusOption>(res);
};

export const createWorklogActivityType = async (
  payload: Partial<WorklogActivityTypeOption>
): Promise<WorklogActivityTypeOption> => {
  const res = await apiFetch('/api/v5/worklog-activity-types', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      code: normalizeNullableText(payload.code),
      name: normalizeNullableText(payload.name),
      description: normalizeNullableText(payload.description),
      default_is_billable:
        payload.default_is_billable === undefined ? true : Boolean(payload.default_is_billable),
      phase_hint: normalizeNullableText(payload.phase_hint),
      sort_order: payload.sort_order === undefined ? 0 : normalizeNumber(payload.sort_order, 0),
      is_active: payload.is_active === undefined ? true : Boolean(payload.is_active),
      created_by: normalizeNullableNumber(payload.created_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_WORKLOG_ACTIVITY_TYPE_FAILED'));
  }

  return parseItemJson<WorklogActivityTypeOption>(res);
};

export const updateWorklogActivityType = async (
  id: string | number,
  payload: Partial<WorklogActivityTypeOption>
): Promise<WorklogActivityTypeOption> => {
  const res = await apiFetch(`/api/v5/worklog-activity-types/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      code: normalizeNullableText(payload.code),
      name: normalizeNullableText(payload.name),
      description: normalizeNullableText(payload.description),
      default_is_billable:
        payload.default_is_billable === undefined ? undefined : Boolean(payload.default_is_billable),
      phase_hint: normalizeNullableText(payload.phase_hint),
      sort_order: payload.sort_order === undefined ? undefined : normalizeNumber(payload.sort_order, 0),
      is_active: payload.is_active === undefined ? undefined : Boolean(payload.is_active),
      updated_by: normalizeNullableNumber(payload.updated_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_WORKLOG_ACTIVITY_TYPE_FAILED'));
  }

  return parseItemJson<WorklogActivityTypeOption>(res);
};

export const createSupportSlaConfig = async (
  payload: Partial<SupportSlaConfigOption>
): Promise<SupportSlaConfigOption> => {
  const res = await apiFetch('/api/v5/support-sla-configs', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      status: normalizeNullableText(payload.status),
      sub_status: normalizeNullableText(payload.sub_status),
      priority: normalizeNullableText(payload.priority),
      sla_hours: normalizeNumber(payload.sla_hours, 0),
      request_type_prefix: normalizeNullableText(payload.request_type_prefix),
      service_group_id: normalizeNullableNumber(payload.service_group_id),
      workflow_action_code: normalizeNullableText(payload.workflow_action_code),
      description: normalizeNullableText(payload.description),
      is_active: payload.is_active === undefined ? true : Boolean(payload.is_active),
      sort_order: payload.sort_order === undefined ? 0 : normalizeNumber(payload.sort_order, 0),
      created_by: normalizeNullableNumber(payload.created_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_SUPPORT_SLA_CONFIG_FAILED'));
  }

  return parseItemJson<SupportSlaConfigOption>(res);
};

export const updateSupportSlaConfig = async (
  id: string | number,
  payload: Partial<SupportSlaConfigOption>
): Promise<SupportSlaConfigOption> => {
  const res = await apiFetch(`/api/v5/support-sla-configs/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      status: normalizeNullableText(payload.status),
      sub_status: normalizeNullableText(payload.sub_status),
      priority: normalizeNullableText(payload.priority),
      sla_hours: payload.sla_hours === undefined ? undefined : normalizeNumber(payload.sla_hours, 0),
      request_type_prefix: normalizeNullableText(payload.request_type_prefix),
      service_group_id: payload.service_group_id === undefined ? undefined : normalizeNullableNumber(payload.service_group_id),
      workflow_action_code: payload.workflow_action_code === undefined ? undefined : normalizeNullableText(payload.workflow_action_code),
      description: normalizeNullableText(payload.description),
      is_active: payload.is_active === undefined ? undefined : Boolean(payload.is_active),
      sort_order: payload.sort_order === undefined ? undefined : normalizeNumber(payload.sort_order, 0),
      updated_by: normalizeNullableNumber(payload.updated_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_SUPPORT_SLA_CONFIG_FAILED'));
  }

  return parseItemJson<SupportSlaConfigOption>(res);
};

export const fetchMonthlyCalendars = async (
  params: { year?: number; month?: number; include_inactive?: boolean } = {}
): Promise<WorkCalendarDay[]> => {
  const query = new URLSearchParams();
  if (params.year !== undefined) query.set('year', String(params.year));
  if (params.month !== undefined) query.set('month', String(params.month));
  if (params.include_inactive) query.set('include_inactive', 'true');

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return fetchList<WorkCalendarDay>(`/api/v5/monthly-calendars${suffix}`);
};

export const updateCalendarDay = async (
  date: string,
  payload: Partial<Pick<WorkCalendarDay, 'is_working_day' | 'is_holiday' | 'holiday_name' | 'note'>> & {
    updated_by?: number | null;
  }
): Promise<WorkCalendarDay> => {
  const res = await apiFetch(`/api/v5/monthly-calendars/${date}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      is_working_day: typeof payload.is_working_day === 'boolean' ? payload.is_working_day : undefined,
      is_holiday: typeof payload.is_holiday === 'boolean' ? payload.is_holiday : undefined,
      holiday_name: normalizeNullableText(payload.holiday_name),
      note: normalizeNullableText(payload.note),
      updated_by: payload.updated_by ?? undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_CALENDAR_DAY_FAILED'));
  }

  return parseItemJson<WorkCalendarDay>(res);
};

export const generateCalendarYear = async (
  year: number,
  options: { overwrite?: boolean; created_by?: number | null } = {}
): Promise<{ message: string; year: number; inserted: number; skipped: number }> => {
  const res = await apiFetch('/api/v5/monthly-calendars/generate', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      year,
      overwrite: options.overwrite ?? false,
      created_by: options.created_by ?? undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GENERATE_CALENDAR_YEAR_FAILED'));
  }

  return res.json() as Promise<{ message: string; year: number; inserted: number; skipped: number }>;
};

export const fetchDepartmentWeeklySchedules = async (
  params: { department_id?: string | number | null; week_start_date?: string | null } = {}
): Promise<DepartmentWeeklySchedule[]> => {
  const query = new URLSearchParams();
  if (params.department_id !== undefined && params.department_id !== null && String(params.department_id).trim() !== '') {
    query.set('department_id', String(params.department_id));
  }
  if (params.week_start_date) {
    query.set('week_start_date', params.week_start_date);
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return fetchList<DepartmentWeeklySchedule>(`/api/v5/department-weekly-schedules${suffix}`);
};

export const fetchDepartmentWeeklySchedule = async (id: string | number): Promise<DepartmentWeeklySchedule> => {
  const res = await apiFetch(`/api/v5/department-weekly-schedules/${id}`, {
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_DEPARTMENT_WEEKLY_SCHEDULE_FAILED'));
  }

  return parseItemJson<DepartmentWeeklySchedule>(res);
};

export const createDepartmentWeeklySchedule = async (
  payload: DepartmentWeeklySchedule & { created_by?: string | number | null }
): Promise<DepartmentWeeklySchedule> => {
  const res = await apiFetch('/api/v5/department-weekly-schedules', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_DEPARTMENT_WEEKLY_SCHEDULE_FAILED'));
  }

  return parseItemJson<DepartmentWeeklySchedule>(res);
};

export const updateDepartmentWeeklySchedule = async (
  id: string | number,
  payload: DepartmentWeeklySchedule & { updated_by?: string | number | null }
): Promise<DepartmentWeeklySchedule> => {
  const res = await apiFetch(`/api/v5/department-weekly-schedules/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_DEPARTMENT_WEEKLY_SCHEDULE_FAILED'));
  }

  return parseItemJson<DepartmentWeeklySchedule>(res);
};

export const deleteDepartmentWeeklySchedule = async (
  id: string | number,
  actorId?: string | number | null
): Promise<void> => {
  const body =
    actorId !== undefined && actorId !== null && String(actorId).trim() !== ''
      ? JSON.stringify({ actor_id: actorId })
      : undefined;

  const res = await apiFetch(`/api/v5/department-weekly-schedules/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: body ? JSON_HEADERS : JSON_ACCEPT_HEADER,
    body,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_DEPARTMENT_WEEKLY_SCHEDULE_FAILED'));
  }
};

export const deleteDepartmentWeeklyScheduleEntry = async (
  scheduleId: string | number,
  entryId: string | number,
  actorId?: string | number | null
): Promise<void> => {
  const body =
    actorId !== undefined && actorId !== null && String(actorId).trim() !== ''
      ? JSON.stringify({ actor_id: actorId })
      : undefined;

  const res = await apiFetch(`/api/v5/department-weekly-schedules/${scheduleId}/entries/${entryId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: body ? JSON_HEADERS : JSON_ACCEPT_HEADER,
    body,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_DEPARTMENT_WEEKLY_SCHEDULE_ENTRY_FAILED'));
  }
};

export const buildDepartmentWeekOptions = (calendarDays: WorkCalendarDay[]): DepartmentWeekOption[] => {
  const weekStarts = (calendarDays || [])
    .filter((day) => Number(day.day_of_week) === 2)
    .sort((left, right) => String(left.date).localeCompare(String(right.date)));

  const options = weekStarts.map((day) => {
    const start = new Date(`${day.date}T00:00:00`);
    const end = new Date(start.getTime());
    end.setDate(end.getDate() + 6);
    const endDate = end.toISOString().slice(0, 10);

    return {
      week_start_date: day.date,
      week_end_date: endDate,
      week_number: Number(day.week_number ?? 0),
      year: Number(day.year ?? start.getFullYear()),
      label: `Tuần ${String(day.week_number ?? '').padStart(2, '0')}-${day.year} (${String(day.day).padStart(2, '0')}/${String(day.month).padStart(2, '0')} - ${String(end.getDate()).padStart(2, '0')}/${String(end.getMonth() + 1).padStart(2, '0')})`,
    };
  });

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const currentAndFuture = options
    .filter((option) => option.week_end_date >= todayKey)
    .sort((left, right) => left.week_start_date.localeCompare(right.week_start_date));
  const past = options
    .filter((option) => option.week_end_date < todayKey)
    .sort((left, right) => right.week_start_date.localeCompare(left.week_start_date));

  return [...currentAndFuture, ...past];
};
