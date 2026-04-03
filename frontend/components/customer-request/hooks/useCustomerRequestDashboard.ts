import { useEffect } from 'react';
import { useCRCDashboard } from '../../../shared/hooks/useCustomerRequests';
import { isRequestCanceledError } from '../../../services/api/customerRequestApi';

type UseCustomerRequestDashboardOptions = {
  canReadRequests: boolean;
  dataVersion: number;
  onError: (message: string) => void;
};

export const useCustomerRequestDashboard = ({
  canReadRequests,
  dataVersion,
  onError,
}: UseCustomerRequestDashboardOptions) => {
  const overviewQuery = useCRCDashboard('overview', undefined, { enabled: canReadRequests });
  const creatorQuery = useCRCDashboard('creator', undefined, { enabled: canReadRequests });
  const dispatcherQuery = useCRCDashboard('dispatcher', undefined, { enabled: canReadRequests });
  const performerQuery = useCRCDashboard('performer', undefined, { enabled: canReadRequests });

  useEffect(() => {
    if (dataVersion <= 0 || !canReadRequests) {
      return;
    }

    void Promise.all([
      overviewQuery.refetch(),
      creatorQuery.refetch(),
      dispatcherQuery.refetch(),
      performerQuery.refetch(),
    ]);
  }, [
    canReadRequests,
    dataVersion,
    creatorQuery.refetch,
    dispatcherQuery.refetch,
    overviewQuery.refetch,
    performerQuery.refetch,
  ]);

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
