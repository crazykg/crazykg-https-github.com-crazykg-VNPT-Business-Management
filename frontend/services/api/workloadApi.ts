import type {
  WorkloadApiResponse,
  WorkloadCapacityRow,
  WorkloadDailyComparisonPayload,
  WorkloadDailySeriesRow,
  WorkloadEntry,
  WorkloadPlannedActualPayload,
  WorkloadProjectSummaryRow,
  WorkloadQueryParams,
  WorkloadSummaryPayload,
  WorkloadWeeklyAlert,
} from '../../types/workload';
import {
  apiFetch,
  JSON_ACCEPT_HEADER,
  parseErrorMessage,
  resolveDownloadFilename,
} from './_infra';

const buildQuerySuffix = (params?: WorkloadQueryParams): string => {
  if (!params) {
    return '';
  }

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    query.set(key, String(value));
  });

  const text = query.toString();
  return text ? `?${text}` : '';
};

const getJson = async <T>(path: string, cancelKey: string): Promise<WorkloadApiResponse<T>> => {
  const res = await apiFetch(path, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'WORKLOAD_REQUEST_FAILED'));
  }

  return res.json();
};

export const fetchWorkloadSummary = (params?: WorkloadQueryParams) =>
  getJson<WorkloadSummaryPayload>(`/api/v5/workload/summary${buildQuerySuffix(params)}`, 'workload:summary');

export const fetchWorkloadDailySeries = (params?: WorkloadQueryParams) =>
  getJson<WorkloadDailySeriesRow[]>(`/api/v5/workload/daily-series${buildQuerySuffix(params)}`, 'workload:daily-series');

export const fetchWorkloadDailyComparison = (params?: WorkloadQueryParams) =>
  getJson<WorkloadDailyComparisonPayload>(`/api/v5/workload/daily-comparison${buildQuerySuffix(params)}`, 'workload:daily-comparison');

export const fetchWorkloadProjectSummary = (params?: WorkloadQueryParams) =>
  getJson<WorkloadProjectSummaryRow[]>(`/api/v5/workload/project-summary${buildQuerySuffix(params)}`, 'workload:project-summary');

export const fetchWorkloadCapacity = (params?: WorkloadQueryParams) =>
  getJson<WorkloadCapacityRow[]>(`/api/v5/workload/capacity${buildQuerySuffix(params)}`, 'workload:capacity');

export const fetchWorkloadWeeklyAlerts = (params?: WorkloadQueryParams) =>
  getJson<WorkloadWeeklyAlert[]>(`/api/v5/workload/weekly-alerts${buildQuerySuffix(params)}`, 'workload:weekly-alerts');

export const fetchWorkloadPlannedActual = (params?: WorkloadQueryParams) =>
  getJson<WorkloadPlannedActualPayload>(`/api/v5/workload/planned-actual${buildQuerySuffix(params)}`, 'workload:planned-actual');

export const fetchWorkloadEntries = (params?: WorkloadQueryParams) =>
  getJson<WorkloadEntry[]>(`/api/v5/workload/entries${buildQuerySuffix(params)}`, 'workload:entries');

export const exportWorkloadCsv = async (params?: WorkloadQueryParams): Promise<void> => {
  const res = await apiFetch(`/api/v5/workload/export${buildQuerySuffix(params)}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'workload:export',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'WORKLOAD_EXPORT_FAILED'));
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = resolveDownloadFilename(res, `workload_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
