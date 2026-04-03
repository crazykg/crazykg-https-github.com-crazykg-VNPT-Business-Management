import { useEffect, useMemo } from 'react';
import { useCRCList } from '../../../shared/hooks/useCustomerRequests';
import { isRequestCanceledError } from '../../../services/api/customerRequestApi';
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
  const enabled = active && canReadRequests;
  const creatorQuery = useCRCList({
    page: 1,
    per_page: 24,
    sort_by: 'updated_at',
    sort_dir: 'desc',
    filters: {
      my_role: 'creator',
    },
  }, { enabled });

  useEffect(() => {
    if (dataVersion > 0 && enabled) {
      void creatorQuery.refetch();
    }
  }, [creatorQuery.refetch, dataVersion, enabled]);

  useEffect(() => {
    if (!creatorQuery.error) {
      return;
    }

    // Don't show error for canceled requests (user navigated away)
    if (isRequestCanceledError(creatorQuery.error)) {
      return;
    }

    onError(creatorQuery.error instanceof Error ? creatorQuery.error.message : 'Đã xảy ra lỗi.');
  }, [creatorQuery.error, onError]);

  const creatorRows = enabled ? (creatorQuery.data?.data ?? []) : [];
  const buckets = useMemo(() => splitCreatorWorkspaceRows(creatorRows), [creatorRows]);

  return {
    isLoading: enabled ? (creatorQuery.isLoading || creatorQuery.isFetching) : false,
    creatorRows,
    reviewRows: buckets.reviewRows,
    notifyRows: buckets.notifyRows,
    followUpRows: buckets.followUpRows,
    closedRows: buckets.closedRows,
  };
};
