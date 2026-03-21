import { useEffect, useState } from 'react';
import { fetchYeuCauDashboard } from '../../../services/v5Api';
import type { YeuCauDashboardPayload } from '../../../types';

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
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [overviewDashboard, setOverviewDashboard] = useState<YeuCauDashboardPayload | null>(null);
  const [roleDashboards, setRoleDashboards] = useState<
    Record<'creator' | 'dispatcher' | 'performer', YeuCauDashboardPayload | null>
  >({
    creator: null,
    dispatcher: null,
    performer: null,
  });

  useEffect(() => {
    if (!canReadRequests) {
      return;
    }

    let cancelled = false;
    setIsDashboardLoading(true);

    void Promise.allSettled([
      fetchYeuCauDashboard('overview'),
      fetchYeuCauDashboard('creator'),
      fetchYeuCauDashboard('dispatcher'),
      fetchYeuCauDashboard('performer'),
    ])
      .then(([overviewResult, creatorResult, dispatcherResult, performerResult]) => {
        if (cancelled) {
          return;
        }

        setOverviewDashboard(overviewResult.status === 'fulfilled' ? overviewResult.value : null);
        setRoleDashboards({
          creator: creatorResult.status === 'fulfilled' ? creatorResult.value : null,
          dispatcher: dispatcherResult.status === 'fulfilled' ? dispatcherResult.value : null,
          performer: performerResult.status === 'fulfilled' ? performerResult.value : null,
        });

        const firstRejected = [overviewResult, creatorResult, dispatcherResult, performerResult].find(
          (result): result is PromiseRejectedResult => result.status === 'rejected'
        );
        if (firstRejected) {
          onError(firstRejected.reason instanceof Error ? firstRejected.reason.message : 'Đã xảy ra lỗi.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsDashboardLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canReadRequests, dataVersion, onError]);

  return {
    isDashboardLoading,
    overviewDashboard,
    roleDashboards,
  };
};
