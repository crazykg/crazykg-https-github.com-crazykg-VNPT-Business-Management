import { useEffect, useRef } from 'react';
import {
  useCRCDashboard,
  type CRCListParams,
} from '../../../shared/hooks/useCustomerRequests';
import { isRequestCanceledError } from '../../../services/api/customerRequestApi';

type UseCustomerRequestDashboardOptions = {
  canReadRequests: boolean;
  dataVersion: number;
  params?: CRCListParams;
  onError: (message: string) => void;
};

export const useCustomerRequestDashboard = ({
  canReadRequests,
  dataVersion,
  params,
  onError,
}: UseCustomerRequestDashboardOptions) => {
  const lastRefetchedVersionRef = useRef(0);
  const overviewRefetchRef = useRef<() => Promise<unknown>>(async () => undefined);
  const creatorRefetchRef = useRef<() => Promise<unknown>>(async () => undefined);
  const dispatcherRefetchRef = useRef<() => Promise<unknown>>(async () => undefined);
  const performerRefetchRef = useRef<() => Promise<unknown>>(async () => undefined);
  const overviewQuery = useCRCDashboard('overview', params, { enabled: canReadRequests });
  const creatorQuery = useCRCDashboard('creator', params, { enabled: canReadRequests });
  const dispatcherQuery = useCRCDashboard('dispatcher', params, { enabled: canReadRequests });
  const performerQuery = useCRCDashboard('performer', params, { enabled: canReadRequests });

  useEffect(() => {
    overviewRefetchRef.current = overviewQuery.refetch;
    creatorRefetchRef.current = creatorQuery.refetch;
    dispatcherRefetchRef.current = dispatcherQuery.refetch;
    performerRefetchRef.current = performerQuery.refetch;
  }, [
    creatorQuery.refetch,
    dispatcherQuery.refetch,
    overviewQuery.refetch,
    performerQuery.refetch,
  ]);

  useEffect(() => {
    if (!canReadRequests) {
      lastRefetchedVersionRef.current = 0;
      return;
    }

    if (dataVersion <= 0 || lastRefetchedVersionRef.current === dataVersion) {
      return;
    }

    lastRefetchedVersionRef.current = dataVersion;

    void Promise.all([
      overviewRefetchRef.current(),
      creatorRefetchRef.current(),
      dispatcherRefetchRef.current(),
      performerRefetchRef.current(),
    ]);
  }, [canReadRequests, dataVersion]);

  useEffect(() => {
    const firstError = [
      overviewQuery.error,
      creatorQuery.error,
      dispatcherQuery.error,
      performerQuery.error,
    ].find(Boolean);

    if (!firstError) {
      return;
    }

    // Don't show error for canceled requests (user navigated away)
    if (isRequestCanceledError(firstError)) {
      return;
    }

    onError(firstError instanceof Error ? firstError.message : 'Đã xảy ra lỗi.');
  }, [
    creatorQuery.error,
    dispatcherQuery.error,
    onError,
    overviewQuery.error,
    performerQuery.error,
  ]);

  return {
    isDashboardLoading: canReadRequests
      ? [
          overviewQuery,
          creatorQuery,
          dispatcherQuery,
          performerQuery,
        ].some((query) => query.isLoading || query.isFetching)
      : false,
    overviewDashboard: canReadRequests ? (overviewQuery.data ?? null) : null,
    roleDashboards: {
      creator: canReadRequests ? (creatorQuery.data ?? null) : null,
      dispatcher: canReadRequests ? (dispatcherQuery.data ?? null) : null,
      performer: canReadRequests ? (performerQuery.data ?? null) : null,
    },
  };
};
