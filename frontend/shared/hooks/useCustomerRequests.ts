import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createYeuCau,
  fetchYeuCau,
  fetchYeuCauDashboard,
  fetchYeuCauPage,
  fetchYeuCauPerformerWeeklyTimesheet,
  fetchYeuCauProcessDetail,
  fetchYeuCauTimeline,
  fetchYeuCauWorklogs,
  transitionCustomerRequestCase,
} from '../../services/api/customerRequestApi';
import type {
  YeuCau,
  YeuCauDashboardPayload,
  YeuCauPerformerWeeklyTimesheet,
  YeuCauProcessDetail,
  YeuCauTimelineEntry,
  YeuCauWorklog,
} from '../../types/customerRequest';
import type { PaginationMeta, PaginatedQuery } from '../../types/common';
import {
  queryKeys,
  type CustomerRequestTimesheetQuery,
  type ListQuery,
} from '../queryKeys';

export interface CRCListParams extends Omit<PaginatedQuery, 'filters'>, ListQuery {
  process_code?: string | null;
  filters?: PaginatedQuery['filters'];
}

export interface CRCListResponse {
  data: YeuCau[];
  meta: PaginationMeta;
}

export interface CRCQueryOptions {
  enabled?: boolean;
}

export interface CRCProcessDetailOptions extends CRCQueryOptions {
  processCode?: string | null;
}

export interface CRCTransitionPayload {
  id: string | number;
  toStatusCode: string;
  statusPayload?: Record<string, unknown>;
}

const compactParams = <T extends Record<string, unknown>>(params: T): T =>
  Object.entries(params).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
    if (value === undefined || value === null || value === '') {
      return accumulator;
    }

    accumulator[key] = value;
    return accumulator;
  }, {}) as T;

export function useCRCList(params: CRCListParams, options: CRCQueryOptions = {}) {
  const compactedParams = compactParams(params);

  return useQuery<CRCListResponse>({
    queryKey: queryKeys.customerRequests.list(compactedParams),
    queryFn: () => fetchYeuCauPage(compactedParams),
    enabled: options.enabled ?? true,
  });
}

export function useCRCDetail(id: string | number | null, options: CRCQueryOptions = {}) {
  return useQuery<YeuCau>({
    queryKey: queryKeys.customerRequests.detail(id ?? 'pending'),
    queryFn: () => fetchYeuCau(id as string | number),
    enabled: (options.enabled ?? true) && id !== null && id !== undefined && String(id) !== '',
  });
}

export function useCRCProcessDetail(id: string | number | null, options: CRCProcessDetailOptions = {}) {
  const processCode = options.processCode ?? null;

  return useQuery<YeuCauProcessDetail>({
    queryKey: queryKeys.customerRequests.processDetail(id ?? 'pending', processCode ?? 'pending'),
    queryFn: () => fetchYeuCauProcessDetail(id as string | number, processCode as string),
    enabled:
      (options.enabled ?? true)
      && id !== null
      && id !== undefined
      && String(id) !== ''
      && processCode !== null
      && processCode !== undefined
      && processCode !== '',
  });
}

export function useCRCTimeline(id: string | number | null, options: CRCQueryOptions = {}) {
  return useQuery<YeuCauTimelineEntry[]>({
    queryKey: queryKeys.customerRequests.timeline(id ?? 'pending'),
    queryFn: () => fetchYeuCauTimeline(id as string | number),
    enabled: (options.enabled ?? true) && id !== null && id !== undefined && String(id) !== '',
  });
}

export function useCRCWorklogs(id: string | number | null, options: CRCQueryOptions = {}) {
  return useQuery<YeuCauWorklog[]>({
    queryKey: queryKeys.customerRequests.worklogs(id ?? 'pending'),
    queryFn: () => fetchYeuCauWorklogs(id as string | number),
    enabled: (options.enabled ?? true) && id !== null && id !== undefined && String(id) !== '',
  });
}

export function useCRCDashboard(
  role: 'creator' | 'dispatcher' | 'performer' | 'overview',
  params?: CRCListParams,
  options: CRCQueryOptions = {},
) {
  const compactedParams = compactParams(params ?? {});

  return useQuery<YeuCauDashboardPayload>({
    queryKey: queryKeys.customerRequests.dashboard(role, compactedParams),
    queryFn: () => fetchYeuCauDashboard(role, compactedParams),
    enabled: options.enabled ?? true,
  });
}

export function useCRCPerformerWeeklyTimesheet(
  params: CustomerRequestTimesheetQuery = {},
  options: CRCQueryOptions = {},
) {
  const compactedParams = compactParams(params);

  return useQuery<YeuCauPerformerWeeklyTimesheet>({
    queryKey: queryKeys.customerRequests.timesheet(compactedParams),
    queryFn: () => fetchYeuCauPerformerWeeklyTimesheet(compactedParams),
    enabled: options.enabled ?? true,
  });
}

export function useCreateCRC() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => createYeuCau(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.customerRequests.all });
    },
  });
}

export function useTransitionCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, toStatusCode, statusPayload }: CRCTransitionPayload) =>
      transitionCustomerRequestCase(id, toStatusCode, statusPayload ?? {}),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.customerRequests.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.customerRequests.detail(variables.id) });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.customerRequests.timeline(variables.id),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.customerRequests.worklogs(variables.id),
      });
    },
  });
}
