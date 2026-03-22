import { useEffect, useMemo, useState } from 'react';
import { fetchYeuCauPage } from '../../../services/v5Api';
import type { YeuCau } from '../../../types';
import { splitCreatorWorkspaceRows } from '../creatorWorkspace';

type UseCustomerRequestCreatorWorkspaceOptions = {
  active: boolean;
  canReadRequests: boolean;
  dataVersion: number;
  onError: (message: string) => void;
};

export const useCustomerRequestCreatorWorkspace = ({
  active,
  canReadRequests,
  dataVersion,
  onError,
}: UseCustomerRequestCreatorWorkspaceOptions) => {
  const [isLoading, setIsLoading] = useState(false);
  const [creatorRows, setCreatorRows] = useState<YeuCau[]>([]);

  useEffect(() => {
    if (!active || !canReadRequests) {
      setCreatorRows([]);
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
        my_role: 'creator',
      },
    }, { cancelKey: 'workspace:creator' })
      .then((result) => {
        if (!cancelled) {
          setCreatorRows(result.data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCreatorRows([]);
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

  const buckets = useMemo(() => splitCreatorWorkspaceRows(creatorRows), [creatorRows]);

  return {
    isLoading,
    creatorRows,
    reviewRows: buckets.reviewRows,
    notifyRows: buckets.notifyRows,
    followUpRows: buckets.followUpRows,
    closedRows: buckets.closedRows,
  };
};
