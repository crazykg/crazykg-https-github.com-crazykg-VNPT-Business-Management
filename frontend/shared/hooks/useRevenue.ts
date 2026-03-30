import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  bulkCreateRevenueTargets,
  createRevenueTarget,
  deleteRevenueTarget,
  fetchRevenueForecast,
  fetchRevenueOverview,
  fetchRevenueReport,
  fetchRevenueTargets,
  updateRevenueTarget,
} from '../../services/api/revenueApi';
import type {
  RevenueForecastData,
  RevenueOverviewResponse,
  RevenueReportData,
  RevenueReportDimension,
  RevenueTarget,
  RevenueTargetBulkInput,
} from '../../types/revenue';
import {
  queryKeys,
  type PeriodRangeQuery,
  type RevenueForecastQuery,
  type RevenueReportQuery,
  type RevenueTargetsQuery,
} from '../queryKeys';

interface RevenueOverviewQuery extends PeriodRangeQuery {
  grouping?: 'month' | 'quarter';
  dept_id?: number;
}

interface RevenueTargetsByYearsQuery {
  years: number[];
  period_type?: string;
  dept_id?: number;
}

interface SetRevenueTargetVariables {
  id?: number;
  data: Parameters<typeof createRevenueTarget>[0] | Parameters<typeof updateRevenueTarget>[1];
}

const compactParams = <T extends Record<string, unknown>>(params: T): T =>
  Object.entries(params).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
    if (value === undefined || value === null || value === '') {
      return accumulator;
    }

    accumulator[key] = value;
    return accumulator;
  }, {}) as T;

export function useRevenueOverview(params: RevenueOverviewQuery) {
  const compactedParams = compactParams(params);

  return useQuery<RevenueOverviewResponse>({
    queryKey: queryKeys.revenue.overview(compactedParams),
    queryFn: () => fetchRevenueOverview(compactedParams),
    enabled: Boolean(compactedParams.period_from) && Boolean(compactedParams.period_to),
  });
}

export function useRevenueTargets(params: RevenueTargetsQuery) {
  const compactedParams = compactParams(params);

  return useQuery<{ data: RevenueTarget[] }>({
    queryKey: queryKeys.revenue.targets(compactedParams),
    queryFn: () => fetchRevenueTargets(compactedParams),
  });
}

export function useRevenueTargetsByYears(params: RevenueTargetsByYearsQuery) {
  const { years, period_type = 'MONTHLY', dept_id } = params;

  const queries = useQueries({
    queries: years.map((year) => {
      const filters = compactParams({
        period_type,
        year,
        dept_id,
      });

      return {
        queryKey: queryKeys.revenue.targets(filters),
        queryFn: () => fetchRevenueTargets(filters),
      };
    }),
  });

  return {
    queries,
    data: queries.flatMap((query) => query.data?.data ?? []),
    isLoading: queries.some((query) => query.isLoading),
    isFetching: queries.some((query) => query.isFetching),
    error: queries.find((query) => query.error)?.error ?? null,
  };
}

export function useRevenueForecast(params: RevenueForecastQuery) {
  const compactedParams = compactParams(params);

  return useQuery<{ data: RevenueForecastData }>({
    queryKey: queryKeys.revenue.forecast(compactedParams),
    queryFn: () => fetchRevenueForecast(compactedParams),
  });
}

export function useRevenueReport(params: RevenueReportQuery) {
  const compactedParams = compactParams(params);

  return useQuery<{ data: RevenueReportData }>({
    queryKey: queryKeys.revenue.report(compactedParams),
    queryFn: () => fetchRevenueReport({
      period_from: compactedParams.period_from as string,
      period_to: compactedParams.period_to as string,
      dimension: compactedParams.dimension as RevenueReportDimension,
      dept_id: compactedParams.dept_id as number | undefined,
    }),
    enabled: Boolean(compactedParams.period_from) && Boolean(compactedParams.period_to) && Boolean(compactedParams.dimension),
  });
}

export function useSetRevenueTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: SetRevenueTargetVariables) => {
      if (typeof variables.id === 'number') {
        return updateRevenueTarget(variables.id, variables.data as Parameters<typeof updateRevenueTarget>[1]);
      }

      return createRevenueTarget(variables.data as Parameters<typeof createRevenueTarget>[0]);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.revenue.all });
    },
  });
}

export function useDeleteRevenueTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteRevenueTarget(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.revenue.all });
    },
  });
}

export function useBulkSetRevenueTargets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RevenueTargetBulkInput) => bulkCreateRevenueTargets(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.revenue.all });
    },
  });
}
