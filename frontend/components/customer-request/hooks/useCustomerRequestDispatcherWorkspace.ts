import { useEffect, useMemo, useState } from 'react';
import { fetchYeuCauPage } from '../../../services/v5Api';
import type { YeuCau } from '../../../types';
import {
  buildDispatcherPmWatchRows,
  buildDispatcherTeamLoadRows,
  splitDispatcherWorkspaceRows,
} from '../dispatcherWorkspace';

type UseCustomerRequestDispatcherWorkspaceOptions = {
  active: boolean;
  canReadRequests: boolean;
  dataVersion: number;
  onError: (message: string) => void;
};

export const useCustomerRequestDispatcherWorkspace = ({
  active,
  canReadRequests,
  dataVersion,
  onError,
}: UseCustomerRequestDispatcherWorkspaceOptions) => {
  const [isLoading, setIsLoading] = useState(false);
  const [dispatcherRows, setDispatcherRows] = useState<YeuCau[]>([]);

  useEffect(() => {
    if (!active || !canReadRequests) {
      setDispatcherRows([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void fetchYeuCauPage({
      page: 1,
      per_page: 24,
      sort_by: 'updated_at',
      sort_dir: 'desc',
      filters: {
        my_role: 'dispatcher',
      },
    }, { cancelKey: 'workspace:dispatcher' })
      .then((result) => {
        if (!cancelled) {
          setDispatcherRows(result.data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setDispatcherRows([]);
          onError(error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
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

  const buckets = useMemo(() => splitDispatcherWorkspaceRows(dispatcherRows), [dispatcherRows]);

  return {
    isLoading,
    dispatcherRows,
    queueRows: buckets.queueRows,
    returnedRows: buckets.returnedRows,
    feedbackRows: buckets.feedbackRows,
    approvalRows: buckets.approvalRows,
    activeRows: buckets.activeRows,
    teamLoadRows: buildDispatcherTeamLoadRows(dispatcherRows),
    pmWatchRows: buildDispatcherPmWatchRows(dispatcherRows),
  };
};
