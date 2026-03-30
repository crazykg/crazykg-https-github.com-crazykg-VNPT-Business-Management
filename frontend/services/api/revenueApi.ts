import type {
  ProjectRevenueSchedule,
  RevenueByCollectionResponse,
  RevenueByContractResponse,
  RevenueContractSchedule,
  RevenueForecastData,
  RevenueOverviewResponse,
  RevenueReportData,
  RevenueSuggestionResponse,
  RevenueTarget,
  RevenueTargetBulkInput,
} from '../../types/revenue';
import {
  apiFetch,
  JSON_ACCEPT_HEADER,
  JSON_HEADERS,
  parseErrorMessage,
} from './_infra';

export const fetchRevenueOverview = async (params: {
  period_from: string;
  period_to: string;
  grouping?: 'month' | 'quarter';
  dept_id?: number;
}): Promise<RevenueOverviewResponse> => {
  const query = new URLSearchParams();
  query.set('period_from', params.period_from);
  query.set('period_to', params.period_to);
  if (params.grouping) {
    query.set('grouping', params.grouping);
  }
  if (typeof params.dept_id === 'number' && Number.isFinite(params.dept_id) && params.dept_id >= 0) {
    query.set('dept_id', String(params.dept_id));
  }

  const res = await apiFetch(`/api/v5/revenue/overview?${query.toString()}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_REVENUE_OVERVIEW_FAILED'));
  }

  return res.json();
};

export const fetchRevenueTargets = async (params?: {
  period_type?: string;
  year?: number;
  dept_id?: number;
}): Promise<{ data: RevenueTarget[] }> => {
  const query = new URLSearchParams();
  if (params?.period_type) {
    query.set('period_type', params.period_type);
  }
  if (typeof params?.year === 'number' && Number.isFinite(params.year)) {
    query.set('year', String(params.year));
  }
  if (typeof params?.dept_id === 'number' && Number.isFinite(params.dept_id)) {
    query.set('dept_id', String(params.dept_id));
  }

  const res = await apiFetch(`/api/v5/revenue/targets?${query.toString()}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_REVENUE_TARGETS_FAILED'));
  }

  return res.json();
};

export const createRevenueTarget = async (data: {
  period_type: string;
  period_key: string;
  target_amount: number;
  dept_id?: number;
  target_type?: string;
  notes?: string | null;
}): Promise<{ data: RevenueTarget }> => {
  const res = await apiFetch('/api/v5/revenue/targets', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_REVENUE_TARGET_FAILED'));
  }

  return res.json();
};

export const updateRevenueTarget = async (
  id: number,
  data: { target_amount?: number; notes?: string | null }
): Promise<{ data: RevenueTarget }> => {
  const res = await apiFetch(`/api/v5/revenue/targets/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_REVENUE_TARGET_FAILED'));
  }

  return res.json();
};

export const deleteRevenueTarget = async (id: number): Promise<void> => {
  const res = await apiFetch(`/api/v5/revenue/targets/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_REVENUE_TARGET_FAILED'));
  }
};

export const bulkCreateRevenueTargets = async (data: RevenueTargetBulkInput): Promise<{
  data: { created: number; updated: number };
}> => {
  const res = await apiFetch('/api/v5/revenue/targets/bulk', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'BULK_CREATE_REVENUE_TARGETS_FAILED'));
  }

  return res.json();
};

export const fetchRevenueTargetSuggestion = async (params: {
  year: number;
  period_type: string;
  dept_id?: number;
  include_breakdown?: boolean;
}): Promise<RevenueSuggestionResponse> => {
  const qs = new URLSearchParams({
    year: String(params.year),
    period_type: params.period_type,
    ...(params.dept_id !== undefined ? { dept_id: String(params.dept_id) } : {}),
    ...(params.include_breakdown ? { include_breakdown: '1' } : {}),
  }).toString();

  const res = await apiFetch(`/api/v5/revenue/targets/suggest?${qs}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_REVENUE_SUGGESTION_FAILED'));
  }

  return res.json();
};

export const fetchProjectRevenueSchedules = async (
  projectId: number | string,
): Promise<{ data: ProjectRevenueSchedule[] }> => {
  const res = await apiFetch(`/api/v5/projects/${projectId}/revenue-schedules`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PROJECT_REVENUE_SCHEDULES_FAILED'));
  }

  return res.json();
};

export const generateProjectRevenueSchedules = async (
  projectId: number | string,
): Promise<{ data: ProjectRevenueSchedule[] }> => {
  const res = await apiFetch(`/api/v5/projects/${projectId}/revenue-schedules/generate`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GENERATE_PROJECT_REVENUE_SCHEDULES_FAILED'));
  }

  return res.json();
};

export const syncProjectRevenueSchedules = async (
  projectId: number | string,
  schedules: Array<{ expected_date: string; expected_amount: number; notes?: string | null }>,
): Promise<{ data: ProjectRevenueSchedule[] }> => {
  const res = await apiFetch(`/api/v5/projects/${projectId}/revenue-schedules/sync`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({ schedules }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'SYNC_PROJECT_REVENUE_SCHEDULES_FAILED'));
  }

  return res.json();
};

export const fetchRevenueByContract = async (params: {
  period_from: string;
  period_to: string;
  dept_id?: number;
  status?: string;
  q?: string;
  page?: number;
  per_page?: number;
  sort_key?: string;
  sort_dir?: string;
}): Promise<RevenueByContractResponse> => {
  const query = new URLSearchParams();
  query.set('period_from', params.period_from);
  query.set('period_to', params.period_to);
  if (typeof params.dept_id === 'number' && Number.isFinite(params.dept_id) && params.dept_id >= 0) {
    query.set('dept_id', String(params.dept_id));
  }
  if (params.status) query.set('status', params.status);
  if (params.q) query.set('q', params.q);
  if (params.page) query.set('page', String(params.page));
  if (params.per_page) query.set('per_page', String(params.per_page));
  if (params.sort_key) query.set('sort_key', params.sort_key);
  if (params.sort_dir) query.set('sort_dir', params.sort_dir);

  const res = await apiFetch(`/api/v5/revenue/by-contract?${query.toString()}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_REVENUE_BY_CONTRACT_FAILED'));
  }

  return res.json();
};

export const fetchRevenueByContractDetail = async (
  contractId: number,
  params: { period_from: string; period_to: string }
): Promise<{ data: RevenueContractSchedule[] }> => {
  const query = new URLSearchParams();
  query.set('period_from', params.period_from);
  query.set('period_to', params.period_to);

  const res = await apiFetch(`/api/v5/revenue/by-contract/${contractId}?${query.toString()}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_REVENUE_CONTRACT_DETAIL_FAILED'));
  }

  return res.json();
};

export const fetchRevenueByCollection = async (params: {
  period_from: string;
  period_to: string;
}): Promise<RevenueByCollectionResponse> => {
  const query = new URLSearchParams();
  query.set('period_from', params.period_from);
  query.set('period_to', params.period_to);

  const res = await apiFetch(`/api/v5/revenue/by-collection?${query.toString()}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_REVENUE_BY_COLLECTION_FAILED'));
  }

  return res.json();
};

export const fetchRevenueForecast = async (params?: {
  horizon_months?: number;
  dept_id?: number;
}): Promise<{ data: RevenueForecastData }> => {
  const query = new URLSearchParams();
  if (params?.horizon_months) {
    query.set('horizon_months', String(params.horizon_months));
  }
  if (typeof params?.dept_id === 'number' && Number.isFinite(params.dept_id) && params.dept_id >= 0) {
    query.set('dept_id', String(params.dept_id));
  }
  const qs = query.toString();

  const res = await apiFetch(`/api/v5/revenue/forecast${qs ? `?${qs}` : ''}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_REVENUE_FORECAST_FAILED'));
  }

  return res.json();
};

export const fetchRevenueReport = async (params: {
  period_from: string;
  period_to: string;
  dimension: string;
  dept_id?: number;
}): Promise<{ data: RevenueReportData }> => {
  const query = new URLSearchParams();
  query.set('period_from', params.period_from);
  query.set('period_to', params.period_to);
  query.set('dimension', params.dimension);
  if (typeof params.dept_id === 'number' && Number.isFinite(params.dept_id) && params.dept_id >= 0) {
    query.set('dept_id', String(params.dept_id));
  }

  const res = await apiFetch(`/api/v5/revenue/report?${query.toString()}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_REVENUE_REPORT_FAILED'));
  }

  return res.json();
};
