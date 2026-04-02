import { useEffect, useMemo } from 'react';
import { useCRCList } from '../../../shared/hooks/useCustomerRequests';
import { isRequestCanceledError } from '../../../services/v5Api';
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
  const enabled = active && canReadRequests;
  const dispatcherQuery = useCRCList({
    page: 1,
    per_page: 24,
    sort_by: 'updated_at',
    sort_dir: 'desc',
    filters: {
      my_role: 'dispatcher',
    },
  }, { enabled });

  useEffect(() => {
    if (dataVersion > 0 && enabled) {
      void dispatcherQuery.refetch();
    }
  }, [dataVersion, dispatcherQuery.refetch, enabled]);

  useEffect(() => {
    if (!dispatcherQuery.error) {
      return;
    }

    // Don't show error for canceled requests (user navigated away)
    if (isRequestCanceledError(dispatcherQuery.error)) {
      return;
    }

    onError(dispatcherQuery.error instanceof Error ? dispatcherQuery.error.message : 'Đã xảy ra lỗi.');
  }, [dispatcherQuery.error, onError]);

  const dispatcherRows = enabled ? (dispatcherQuery.data?.data ?? []) : [];
  const buckets = useMemo(() => splitDispatcherWorkspaceRows(dispatcherRows), [dispatcherRows]);

  return {
    isLoading: enabled ? (dispatcherQuery.isLoading || dispatcherQuery.isFetching) : false,
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
