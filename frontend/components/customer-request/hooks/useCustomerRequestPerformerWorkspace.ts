import { useEffect, useMemo, useState } from 'react';
import {
  fetchYeuCauPage,
  fetchYeuCauPerformerWeeklyTimesheet,
} from '../../../services/v5Api';
import type { YeuCau, YeuCauPerformerWeeklyTimesheet } from '../../../types';
import { splitPerformerWorkspaceRows } from '../performerWorkspace';

type UseCustomerRequestPerformerWorkspaceOptions = {
  active: boolean;
  canReadRequests: boolean;
  dataVersion: number;
  onError: (message: string) => void;
};

export const useCustomerRequestPerformerWorkspace = ({
  active,
  canReadRequests,
  dataVersion,
  onError,
}: UseCustomerRequestPerformerWorkspaceOptions) => {
  const [isLoading, setIsLoading] = useState(false);
  const [performerRows, setPerformerRows] = useState<YeuCau[]>([]);
  const [timesheet, setTimesheet] = useState<YeuCauPerformerWeeklyTimesheet | null>(null);

  useEffect(() => {
    if (!active || !canReadRequests) {
      setPerformerRows([]);
      setTimesheet(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void Promise.allSettled([
      fetchYeuCauPage({
        page: 1,
        per_page: 24,
        sort_by: 'updated_at',
        sort_dir: 'desc',
        filters: {
          my_role: 'performer',
        },
      }, { cancelKey: 'workspace:performer' }),
      fetchYeuCauPerformerWeeklyTimesheet(),
    ])
      .then(([listResult, timesheetResult]) => {
        if (cancelled) {
          return;
        }

        setPerformerRows(listResult.status === 'fulfilled' ? listResult.value.data : []);
        setTimesheet(timesheetResult.status === 'fulfilled' ? timesheetResult.value : null);

        const firstRejected = [listResult, timesheetResult].find(
          (result): result is PromiseRejectedResult => result.status === 'rejected'
        );
        if (firstRejected) {
          onError(firstRejected.reason instanceof Error ? firstRejected.reason.message : 'Đã xảy ra lỗi.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [active, canReadRequests, dataVersion, onError]);

  const buckets = useMemo(() => splitPerformerWorkspaceRows(performerRows), [performerRows]);

  return {
    isLoading,
    performerRows,
    timesheet,
    pendingRows: buckets.pendingRows,
    activeRows: buckets.activeRows,
    closedRows: buckets.closedRows,
  };
};
