import type { Attachment, ContractSignerOption } from '../../types';
import type { PaginatedQuery, PaginatedResult } from '../../types/common';
import type {
  AddWorklogPayload,
  IssueStatus,
  PaymentCycle,
  ProcedureRaciEntry,
  ProcedureStepBatchUpdate,
  ProcedureStepRaciEntry,
  ProcedureStepWorklog,
  ProcedureTemplate,
  ProcedureTemplateStep,
  Project,
  ProjectItemMaster,
  ProjectProcedure,
  ProjectProcedureStep,
  ProjectRaciRow,
  ProjectTypeOption,
  SharedIssue,
} from '../../types/project';
import { normalizeImportDate } from '../../utils/importUtils';
import {
  apiFetch,
  fetchList,
  fetchPaginatedList,
  isRequestCanceledError,
  JSON_ACCEPT_HEADER,
  JSON_HEADERS,
  normalizeNumber,
  normalizeNullableNumber,
  normalizeNullableText,
  parseErrorMessage,
  parseItemJson,
} from './_infra';

type ApiListResponse<T> = {
  data?: T[];
};

type ProjectProcedureBatchUpdateResponse = {
  data?: {
    updated_count?: number;
    overall_progress?: Record<number, number>;
  };
};

const PROJECT_MUTATION_REQUEST_TIMEOUT_MS = 12000;

const projectMutationRequest = async (
  input: RequestInfo | URL,
  init: RequestInit & { cancelKey?: string },
  timeoutMessage: string
): Promise<Response> => {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, PROJECT_MUTATION_REQUEST_TIMEOUT_MS);

  try {
    return await apiFetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut && isRequestCanceledError(error)) {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

const buildProjectOptionsPageQuery = (q: string, page = 1, perPage = 30): PaginatedQuery => ({
  page: Math.max(1, Math.floor(Number(page) || 1)),
  per_page: Math.max(1, Math.min(200, Math.floor(Number(perPage) || 30))),
  q: String(q || '').trim(),
  simple: false,
  sort_by: 'id',
  sort_dir: 'asc',
});

const normalizeNullablePaymentCycle = (value: unknown): PaymentCycle | null => {
  const token = String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();

  if (!token) {
    return null;
  }

  if (token === 'ONCE' || token === '1LAN' || token === 'MOTLAN') {
    return 'ONCE';
  }

  if (token === 'MONTHLY' || token === 'HANGTHANG') {
    return 'MONTHLY';
  }

  if (token === 'QUARTERLY' || token === 'HANGQUY') {
    return 'QUARTERLY';
  }

  if (token === 'HALFYEARLY' || token === 'HALF_YEARLY' || token === '6THANG' || token === 'SAUTHANG') {
    return 'HALF_YEARLY';
  }

  if (token === 'YEARLY' || token === 'HANGNAM') {
    return 'YEARLY';
  }

  return null;
};

const normalizeNullableProjectInvestmentMode = (value: unknown): string | null => {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }

  const token = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');

  if (!token) {
    return null;
  }

  if (token === 'DAUTU') {
    return 'DAU_TU';
  }

  if (
    token === 'THUEDICHVUDACTHU'
    || token === 'THUEDICHVUCNTTDACTHU'
    || token === 'THUEDICHVU'
    || token === 'THUE'
  ) {
    return 'THUE_DICH_VU_DACTHU';
  }

  if (token === 'THUEDICHVUCOSAN' || token === 'THUEDICHVUCNTTCOSAN') {
    return 'THUE_DICH_VU_COSAN';
  }

  return raw.toUpperCase();
};

const normalizeProjectItems = (
  items: Partial<Project>['items']
): Array<{ product_id: number; product_package_id?: number; quantity: number; unit_price: number }> | undefined => {
  if (!Array.isArray(items)) {
    return undefined;
  }

  return items
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const source = item as unknown as Record<string, unknown>;
      const productId = normalizeNullableNumber(source.productId ?? source.product_id);
      if (productId === null || productId <= 0) {
        return null;
      }

      const productPackageId = normalizeNullableNumber(
        source.productPackageId ?? source.product_package_id
      );

      return {
        product_id: productId,
        ...(productPackageId !== null && productPackageId > 0
          ? { product_package_id: productPackageId }
          : {}),
        quantity: normalizeNumber(source.quantity, 1),
        unit_price: normalizeNumber(source.unitPrice ?? source.unit_price, 0),
      };
    })
    .filter((
      item
    ): item is { product_id: number; product_package_id?: number; quantity: number; unit_price: number } => item !== null);
};

const normalizeProjectRaci = (
  raci: Partial<Project>['raci']
): Array<{ user_id: number; raci_role: string; assigned_date?: string }> | undefined => {
  if (!Array.isArray(raci)) {
    return undefined;
  }

  return raci
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const source = item as unknown as Record<string, unknown>;
      const userId = normalizeNullableNumber(source.userId ?? source.user_id);
      if (userId === null || userId <= 0) {
        return null;
      }

      const role = String(source.roleType ?? source.raci_role ?? '').trim().toUpperCase();
      if (!role) {
        return null;
      }

      const assignedDateInput = normalizeNullableText(source.assignedDate ?? source.assigned_date);
      const assignedDate = assignedDateInput ? normalizeImportDate(assignedDateInput) ?? assignedDateInput : null;

      return {
        user_id: userId,
        raci_role: role,
        ...(assignedDate ? { assigned_date: assignedDate } : {}),
      };
    })
    .filter((item): item is { user_id: number; raci_role: string; assigned_date?: string } => item !== null);
};

const parseListJson = async <T>(res: Response): Promise<T[]> => {
  const payload = (await res.json()) as ApiListResponse<T>;
  return payload.data ?? [];
};

const toAttachment = (
  attachment: ProcedureStepAttachment,
  fallback?: Partial<ProcedureStepAttachment>
): Attachment => ({
  id: String(attachment.id),
  fileName: attachment.fileName ?? fallback?.fileName ?? '',
  fileUrl: attachment.fileUrl ?? fallback?.fileUrl ?? '',
  fileSize: attachment.fileSize ?? fallback?.fileSize ?? 0,
  mimeType: attachment.mimeType ?? fallback?.mimeType ?? '',
  driveFileId: attachment.driveFileId ?? fallback?.driveFileId ?? '',
  createdAt: attachment.createdAt ?? new Date().toISOString(),
  storageProvider:
    attachment.storageDisk === 'backblaze_b2' || attachment.storageDisk === 'b2'
      ? 'BACKBLAZE_B2'
      : attachment.driveFileId
        ? 'GOOGLE_DRIVE'
        : 'LOCAL',
  storageDisk: attachment.storageDisk ?? fallback?.storageDisk ?? null,
  storagePath: attachment.storagePath ?? fallback?.storagePath ?? null,
  storageVisibility: attachment.storageVisibility ?? fallback?.storageVisibility ?? null,
});

export interface ProcedureStepAttachment {
  id: number;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string | null;
  driveFileId: string | null;
  storageDisk: string | null;
  storagePath: string | null;
  storageVisibility: string | null;
  createdAt: string;
  createdBy: number | null;
  createdByName: string | null;
}

export const fetchProjects = async (): Promise<Project[]> => fetchList<Project>('/api/v5/projects');

export const fetchProjectsPage = async (query: PaginatedQuery): Promise<PaginatedResult<Project>> =>
  fetchPaginatedList<Project>('/api/v5/projects', { ...query, simple: false });

export const fetchProjectDetail = async (id: string | number): Promise<Project> => {
  const res = await apiFetch(`/api/v5/projects/${id}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PROJECT_DETAIL_FAILED'));
  }

  return parseItemJson<Project>(res);
};

export const fetchProjectRaciAssignments = async (
  projectIds: Array<string | number>
): Promise<ProjectRaciRow[]> => {
  const normalizedIds = (projectIds || [])
    .map((value) => normalizeNullableNumber(value))
    .filter((value): value is number => value !== null && value > 0);

  if (normalizedIds.length === 0) {
    return [];
  }

  const query = new URLSearchParams();
  query.set('project_ids', normalizedIds.join(','));
  const res = await apiFetch(`/api/v5/projects/raci-assignments?${query.toString()}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PROJECT_RACI_ASSIGNMENTS_FAILED'));
  }

  return parseListJson<ProjectRaciRow>(res);
};

export const fetchProjectItems = async (): Promise<ProjectItemMaster[]> =>
  fetchList<ProjectItemMaster>('/api/v5/project-items');

export const fetchProjectItemsPage = async (
  query: PaginatedQuery
): Promise<PaginatedResult<ProjectItemMaster>> =>
  fetchPaginatedList<ProjectItemMaster>('/api/v5/project-items', query);

export const fetchProjectItemsOptionsPage = async (
  q: string,
  page = 1,
  perPage = 30
): Promise<PaginatedResult<ProjectItemMaster>> =>
  fetchProjectItemsPage(buildProjectOptionsPageQuery(q, page, perPage));

export const fetchProjectTypes = async (includeInactive = false): Promise<ProjectTypeOption[]> => {
  const query = includeInactive ? '?include_inactive=1' : '';
  return fetchList<ProjectTypeOption>(`/api/v5/project-types${query}`);
};

export const fetchProjectImplementationUnitOptions = async (): Promise<ContractSignerOption[]> =>
  fetchList<ContractSignerOption>('/api/v5/projects/implementation-unit-options');

export const createProject = async (payload: Partial<Project> & Record<string, unknown>): Promise<Project> => {
  const res = await projectMutationRequest('/api/v5/projects', {
    method: 'POST',
    headers: JSON_HEADERS,
    cancelKey: 'project:save:new',
    body: JSON.stringify({
      project_code: payload.project_code,
      project_name: payload.project_name,
      customer_id: normalizeNullableNumber(payload.customer_id),
      status: payload.status,
      status_reason: normalizeNullableText(payload.status_reason),
      opportunity_id: normalizeNullableNumber(payload.opportunity_id),
      opportunity_score: normalizeNullableNumber(payload.opportunity_score),
      investment_mode: normalizeNullableProjectInvestmentMode(payload.investment_mode),
      payment_cycle: normalizeNullablePaymentCycle(payload.payment_cycle),
      implementation_user_id: Object.prototype.hasOwnProperty.call(payload, 'implementation_user_id')
        ? normalizeNullableNumber(payload.implementation_user_id)
        : undefined,
      start_date: payload.start_date,
      expected_end_date: payload.expected_end_date,
      actual_end_date: payload.actual_end_date,
      sync_items: typeof payload.sync_items === 'boolean' ? payload.sync_items : undefined,
      sync_raci: typeof payload.sync_raci === 'boolean' ? payload.sync_raci : undefined,
      items: normalizeProjectItems(payload.items),
      raci: normalizeProjectRaci(payload.raci),
    }),
  }, 'Không thể tạo dự án lúc này (quá thời gian phản hồi). Vui lòng thử lại.');

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_PROJECT_FAILED'));
  }

  return parseItemJson<Project>(res);
};

export const updateProject = async (
  id: string | number,
  payload: Partial<Project> & Record<string, unknown>
): Promise<Project> => {
  const res = await projectMutationRequest(`/api/v5/projects/${id}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    cancelKey: `project:save:${id}`,
    body: JSON.stringify({
      project_code: payload.project_code,
      project_name: payload.project_name,
      customer_id: normalizeNullableNumber(payload.customer_id),
      status: payload.status,
      status_reason: normalizeNullableText(payload.status_reason),
      opportunity_id: normalizeNullableNumber(payload.opportunity_id),
      opportunity_score: normalizeNullableNumber(payload.opportunity_score),
      investment_mode: normalizeNullableProjectInvestmentMode(payload.investment_mode),
      payment_cycle: normalizeNullablePaymentCycle(payload.payment_cycle),
      implementation_user_id: Object.prototype.hasOwnProperty.call(payload, 'implementation_user_id')
        ? normalizeNullableNumber(payload.implementation_user_id)
        : undefined,
      start_date: payload.start_date,
      expected_end_date: payload.expected_end_date,
      actual_end_date: payload.actual_end_date,
      sync_items: typeof payload.sync_items === 'boolean' ? payload.sync_items : undefined,
      sync_raci: typeof payload.sync_raci === 'boolean' ? payload.sync_raci : undefined,
      items: normalizeProjectItems(payload.items),
      raci: normalizeProjectRaci(payload.raci),
    }),
  }, 'Không thể cập nhật dự án lúc này (quá thời gian phản hồi). Vui lòng thử lại.');

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_PROJECT_FAILED'));
  }

  return parseItemJson<Project>(res);
};

export const deleteProject = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/projects/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_PROJECT_FAILED'));
  }
};

export const createProjectType = async (
  payload: Partial<ProjectTypeOption>
): Promise<ProjectTypeOption> => {
  const res = await apiFetch('/api/v5/project-types', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      type_code: normalizeNullableText(payload.type_code),
      type_name: normalizeNullableText(payload.type_name),
      description: normalizeNullableText(payload.description),
      is_active: typeof payload.is_active === 'boolean' ? payload.is_active : undefined,
      sort_order:
        payload.sort_order === null || payload.sort_order === undefined
          ? undefined
          : normalizeNumber(payload.sort_order, 0),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_PROJECT_TYPE_FAILED'));
  }

  return parseItemJson<ProjectTypeOption>(res);
};

export const updateProjectType = async (
  id: string | number,
  payload: Partial<ProjectTypeOption>
): Promise<ProjectTypeOption> => {
  const res = await apiFetch(`/api/v5/project-types/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      type_code: normalizeNullableText(payload.type_code),
      type_name: normalizeNullableText(payload.type_name),
      description: normalizeNullableText(payload.description),
      is_active: typeof payload.is_active === 'boolean' ? payload.is_active : undefined,
      sort_order:
        payload.sort_order === null || payload.sort_order === undefined
          ? undefined
          : normalizeNumber(payload.sort_order, 0),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_PROJECT_TYPE_FAILED'));
  }

  return parseItemJson<ProjectTypeOption>(res);
};

export const fetchProcedureTemplates = async (): Promise<ProcedureTemplate[]> =>
  fetchList<ProcedureTemplate>('/api/v5/project-procedure-templates');

export const createProcedureTemplate = async (
  payload: Partial<ProcedureTemplate>
): Promise<ProcedureTemplate> => {
  const res = await apiFetch('/api/v5/project-procedure-templates', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      template_code: normalizeNullableText(payload.template_code),
      template_name: normalizeNullableText(payload.template_name),
      description: normalizeNullableText(payload.description),
      is_active: typeof payload.is_active === 'boolean' ? payload.is_active : true,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_TEMPLATE_FAILED'));
  }

  return parseItemJson<ProcedureTemplate>(res);
};

export const updateProcedureTemplate = async (
  id: string | number,
  payload: Partial<ProcedureTemplate>
): Promise<ProcedureTemplate> => {
  const res = await apiFetch(`/api/v5/project-procedure-templates/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      template_code: normalizeNullableText(payload.template_code),
      template_name: normalizeNullableText(payload.template_name),
      description: normalizeNullableText(payload.description),
      is_active: typeof payload.is_active === 'boolean' ? payload.is_active : undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_TEMPLATE_FAILED'));
  }

  return parseItemJson<ProcedureTemplate>(res);
};

export const deleteProcedureTemplate = async (
  id: string | number
): Promise<void> => {
  const res = await apiFetch(`/api/v5/project-procedure-templates/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_TEMPLATE_FAILED'));
  }
};

export const fetchProcedureTemplateSteps = async (
  templateId: string | number
): Promise<ProcedureTemplateStep[]> =>
  fetchList<ProcedureTemplateStep>(`/api/v5/project-procedure-templates/${templateId}/steps`);

export const createProcedureTemplateStep = async (
  templateId: string | number,
  payload: Partial<ProcedureTemplateStep>
): Promise<ProcedureTemplateStep> => {
  const res = await apiFetch(`/api/v5/project-procedure-templates/${templateId}/steps`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      step_number: payload.step_number,
      parent_step_id: payload.parent_step_id ?? null,
      phase: normalizeNullableText(payload.phase),
      step_name: normalizeNullableText(payload.step_name),
      step_detail: normalizeNullableText(payload.step_detail),
      lead_unit: normalizeNullableText(payload.lead_unit),
      support_unit: normalizeNullableText(payload.support_unit),
      expected_result: normalizeNullableText(payload.expected_result),
      default_duration_days: payload.default_duration_days ?? null,
      sort_order: payload.sort_order ?? null,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_TEMPLATE_STEP_FAILED'));
  }

  return parseItemJson<ProcedureTemplateStep>(res);
};

export const updateProcedureTemplateStep = async (
  templateId: string | number,
  stepId: string | number,
  payload: Partial<ProcedureTemplateStep>
): Promise<ProcedureTemplateStep> => {
  const res = await apiFetch(`/api/v5/project-procedure-templates/${templateId}/steps/${stepId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      step_number: payload.step_number,
      parent_step_id: payload.parent_step_id,
      phase: normalizeNullableText(payload.phase),
      step_name: normalizeNullableText(payload.step_name),
      step_detail: normalizeNullableText(payload.step_detail),
      lead_unit: normalizeNullableText(payload.lead_unit),
      support_unit: normalizeNullableText(payload.support_unit),
      expected_result: normalizeNullableText(payload.expected_result),
      default_duration_days: payload.default_duration_days,
      sort_order: payload.sort_order,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_TEMPLATE_STEP_FAILED'));
  }

  return parseItemJson<ProcedureTemplateStep>(res);
};

export const deleteProcedureTemplateStep = async (
  templateId: string | number,
  stepId: string | number
): Promise<void> => {
  const res = await apiFetch(`/api/v5/project-procedure-templates/${templateId}/steps/${stepId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_TEMPLATE_STEP_FAILED'));
  }
};

export const deleteProcedureTemplateSteps = async (
  templateId: string | number,
  stepIds: Array<string | number>
): Promise<void> => {
  const res = await projectMutationRequest(
    `/api/v5/project-procedure-templates/${templateId}/steps`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        step_ids: stepIds.map((stepId) => Number(stepId)).filter((stepId) => Number.isFinite(stepId) && stepId > 0),
      }),
    },
    'Xóa nhiều bước quá lâu, vui lòng thử lại.'
  );

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_TEMPLATE_STEPS_FAILED'));
  }
};

export const importProcedureTemplateSteps = async (
  templateId: string | number,
  steps: Array<{
    step_key: string;
    parent_key?: string | null;
    step_number: number;
    phase?: string | null;
    step_name: string;
    step_detail?: string | null;
    lead_unit?: string | null;
    support_unit?: string | null;
    expected_result?: string | null;
    default_duration_days?: number | null;
    sort_order: number;
  }>
): Promise<{ imported_count?: number; root_count?: number }> => {
  const res = await projectMutationRequest(
    `/api/v5/project-procedure-templates/${templateId}/steps/import`,
    {
      method: 'POST',
      credentials: 'include',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        steps: (steps || []).map((step) => ({
          step_key: normalizeNullableText(step.step_key),
          parent_key: normalizeNullableText(step.parent_key),
          step_number: step.step_number,
          phase: normalizeNullableText(step.phase),
          step_name: normalizeNullableText(step.step_name),
          step_detail: normalizeNullableText(step.step_detail),
          lead_unit: normalizeNullableText(step.lead_unit),
          support_unit: normalizeNullableText(step.support_unit),
          expected_result: normalizeNullableText(step.expected_result),
          default_duration_days: step.default_duration_days ?? null,
          sort_order: step.sort_order,
        })),
      }),
    },
    'Nhập bước thủ tục quá lâu, vui lòng thử lại.'
  );

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'IMPORT_TEMPLATE_STEPS_FAILED'));
  }

  return parseItemJson<{ imported_count?: number; root_count?: number }>(res);
};

export const fetchProjectProcedures = async (projectId: string | number): Promise<ProjectProcedure[]> => {
  const res = await apiFetch(`/api/v5/projects/${projectId}/procedures`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PROCEDURES_FAILED'));
  }

  return parseListJson<ProjectProcedure>(res);
};

export const createProjectProcedure = async (
  projectId: string | number,
  templateId: string | number
): Promise<ProjectProcedure> => {
  const res = await apiFetch(`/api/v5/projects/${projectId}/procedures`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({ template_id: templateId }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_PROCEDURE_FAILED'));
  }

  return parseItemJson<ProjectProcedure>(res);
};

export const fetchProcedureSteps = async (procedureId: string | number): Promise<ProjectProcedureStep[]> => {
  const res = await apiFetch(`/api/v5/project-procedures/${procedureId}/steps`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PROCEDURE_STEPS_FAILED'));
  }

  return parseListJson<ProjectProcedureStep>(res);
};

export const resyncProcedure = async (procedureId: string | number): Promise<ProjectProcedure> => {
  const res = await apiFetch(`/api/v5/project-procedures/${procedureId}/resync`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'RESYNC_PROCEDURE_FAILED'));
  }

  return parseItemJson<ProjectProcedure>(res);
};

export const updateProcedureStep = async (
  stepId: string | number,
  payload: Partial<ProjectProcedureStep>
): Promise<ProjectProcedureStep> => {
  const res = await apiFetch(`/api/v5/project-procedure-steps/${stepId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_PROCEDURE_STEP_FAILED'));
  }

  return parseItemJson<ProjectProcedureStep>(res);
};

export const batchUpdateProcedureSteps = async (
  steps: ProcedureStepBatchUpdate[]
): Promise<{ updated_count: number; overall_progress: Record<number, number> }> => {
  const res = await apiFetch('/api/v5/project-procedure-steps/batch', {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({ steps }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'BATCH_UPDATE_STEPS_FAILED'));
  }

  const payload = (await res.json()) as ProjectProcedureBatchUpdateResponse;
  return {
    updated_count: Number(payload.data?.updated_count ?? 0),
    overall_progress: payload.data?.overall_progress ?? {},
  };
};

export const addCustomProcedureStep = async (
  procedureId: string | number,
  payload: {
    step_name: string;
    phase?: string | null;
    lead_unit?: string | null;
    expected_result?: string | null;
    duration_days?: number;
    parent_step_id?: string | number | null;
    actual_start_date?: string | null;
    actual_end_date?: string | null;
    progress_status?: string | null;
  }
): Promise<ProjectProcedureStep> => {
  const res = await apiFetch(`/api/v5/project-procedures/${procedureId}/steps`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'ADD_CUSTOM_STEP_FAILED'));
  }

  return parseItemJson<ProjectProcedureStep>(res);
};

export const reorderProcedureSteps = async (
  steps: { id: string | number; sort_order: number }[]
): Promise<void> => {
  const res = await apiFetch('/api/v5/project-procedure-steps/reorder', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({ steps }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'REORDER_STEPS_FAILED'));
  }
};

export const deleteProcedureStep = async (stepId: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/project-procedure-steps/${stepId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_PROCEDURE_STEP_FAILED'));
  }
};

export const renameProcedureStep = async (
  stepId: string | number,
  payload: Partial<Pick<ProjectProcedureStep, 'step_name' | 'lead_unit' | 'expected_result' | 'duration_days'>>
): Promise<ProjectProcedureStep> => {
  const res = await apiFetch(`/api/v5/project-procedure-steps/${stepId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_PROCEDURE_STEP_FAILED'));
  }

  return parseItemJson<ProjectProcedureStep>(res);
};

export const updateProcedurePhaseLabel = async (
  procedureId: string | number,
  phase: string,
  phaseLabel: string
): Promise<{ phase: string; phase_label: string }> => {
  const res = await apiFetch(`/api/v5/project-procedures/${procedureId}/phase-label`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({ phase, phase_label: phaseLabel }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_PHASE_LABEL_FAILED'));
  }

  return res.json() as Promise<{ phase: string; phase_label: string }>;
};

export const fetchStepWorklogs = async (stepId: string | number): Promise<ProcedureStepWorklog[]> => {
  const res = await apiFetch(`/api/v5/project-procedure-steps/${stepId}/worklogs`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_WORKLOGS_FAILED'));
  }

  return parseListJson<ProcedureStepWorklog>(res);
};

export const addStepWorklog = async (
  stepId: string | number,
  payload: AddWorklogPayload
): Promise<ProcedureStepWorklog> => {
  const res = await apiFetch(`/api/v5/project-procedure-steps/${stepId}/worklogs`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'ADD_WORKLOG_FAILED'));
  }

  return parseItemJson<ProcedureStepWorklog>(res);
};

export const updateStepWorklog = async (
  logId: string | number,
  payload: AddWorklogPayload
): Promise<ProcedureStepWorklog> => {
  const res = await apiFetch(`/api/v5/project-procedure-worklogs/${logId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_WORKLOG_FAILED'));
  }

  return parseItemJson<ProcedureStepWorklog>(res);
};

export const updateIssueStatus = async (
  issueId: string | number,
  status: IssueStatus
): Promise<SharedIssue> => {
  const res = await apiFetch(`/api/v5/shared-issues/${issueId}/status`, {
    method: 'PATCH',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({ issue_status: status }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_ISSUE_STATUS_FAILED'));
  }

  return parseItemJson<SharedIssue>(res);
};

export const fetchProcedureWorklogs = async (
  procedureId: string | number
): Promise<ProcedureStepWorklog[]> => {
  const res = await apiFetch(`/api/v5/project-procedures/${procedureId}/worklogs`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PROC_WORKLOGS_FAILED'));
  }

  return parseListJson<ProcedureStepWorklog>(res);
};

export const fetchProcedureRaci = async (procedureId: string | number): Promise<ProcedureRaciEntry[]> => {
  const res = await apiFetch(`/api/v5/project-procedures/${procedureId}/raci`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_RACI_FAILED'));
  }

  return parseListJson<ProcedureRaciEntry>(res);
};

export const addProcedureRaci = async (
  procedureId: string | number,
  payload: { user_id: string | number; raci_role: string; note?: string }
): Promise<ProcedureRaciEntry> => {
  const res = await apiFetch(`/api/v5/project-procedures/${procedureId}/raci`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'ADD_RACI_FAILED'));
  }

  return parseItemJson<ProcedureRaciEntry>(res);
};

export const removeProcedureRaci = async (raciId: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/project-procedure-raci/${raciId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'REMOVE_RACI_FAILED'));
  }
};

export const fetchStepRaciBulk = async (
  procedureId: string | number
): Promise<ProcedureStepRaciEntry[]> => {
  const res = await apiFetch(`/api/v5/project-procedures/${procedureId}/step-raci`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_STEP_RACI_FAILED'));
  }

  return parseListJson<ProcedureStepRaciEntry>(res);
};

export const addStepRaci = async (
  stepId: string | number,
  payload: { user_id: string | number; raci_role: string }
): Promise<ProcedureStepRaciEntry> => {
  const res = await apiFetch(`/api/v5/project-procedure-steps/${stepId}/raci`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'ADD_STEP_RACI_FAILED'));
  }

  return parseItemJson<ProcedureStepRaciEntry>(res);
};

export const removeStepRaci = async (raciId: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/project-procedure-step-raci/${raciId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'REMOVE_STEP_RACI_FAILED'));
  }
};

export const batchSetStepRaci = async (
  procedureId: string | number,
  payload: {
    assignments: Array<{ step_id: string | number; user_id: string | number; raci_role: string }>;
    mode: 'overwrite' | 'merge';
  }
): Promise<ProcedureStepRaciEntry[]> => {
  const res = await apiFetch(`/api/v5/project-procedures/${procedureId}/step-raci/batch`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'BATCH_STEP_RACI_FAILED'));
  }

  return parseListJson<ProcedureStepRaciEntry>(res);
};

export const getStepAttachments = async (stepId: string | number): Promise<Attachment[]> => {
  const res = await apiFetch(`/api/v5/project-procedure-steps/${stepId}/attachments`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GET_STEP_ATTACHMENTS_FAILED'));
  }

  const attachments = await parseListJson<ProcedureStepAttachment>(res);
  return attachments.map((item) => toAttachment(item));
};

export const linkStepAttachment = async (
  stepId: string | number,
  payload: {
    fileName: string;
    fileUrl: string;
    fileSize?: number;
    mimeType?: string | null;
    driveFileId?: string | null;
    storageDisk?: string | null;
    storagePath?: string | null;
    storageVisibility?: string | null;
  }
): Promise<Attachment> => {
  const res = await apiFetch(`/api/v5/project-procedure-steps/${stepId}/attachments`, {
    method: 'POST',
    credentials: 'include',
    headers: { ...JSON_ACCEPT_HEADER, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'LINK_STEP_ATTACHMENT_FAILED'));
  }

  const attachment = await parseItemJson<ProcedureStepAttachment>(res);
  return toAttachment(attachment, payload);
};

export const deleteStepAttachment = async (
  stepId: string | number,
  attachmentId: string | number
): Promise<void> => {
  const res = await apiFetch(`/api/v5/project-procedure-steps/${stepId}/attachments/${attachmentId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_STEP_ATTACHMENT_FAILED'));
  }
};

export const fetchTemplateSteps = fetchProcedureTemplateSteps;
export const createTemplateStep = createProcedureTemplateStep;
export const updateTemplateStep = updateProcedureTemplateStep;
export const deleteTemplateStep = deleteProcedureTemplateStep;
export const deleteTemplateSteps = deleteProcedureTemplateSteps;
export const createProcedureStep = addCustomProcedureStep;
export const batchAssignStepRaci = batchSetStepRaci;
export const linkExistingAttachmentToStep = linkStepAttachment;
export const unlinkExistingAttachmentFromStep = deleteStepAttachment;
