import { useEffect, useMemo } from 'react';
import {
  useCRCList,
  useCRCPerformerWeeklyTimesheet,
} from '../../../shared/hooks/useCustomerRequests';
import { isRequestCanceledError } from '../../../services/v5Api';
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
  const enabled = active && canReadRequests;
  const performerQuery = useCRCList({
    page: 1,
    per_page: 24,
    sort_by: 'updated_at',
    sort_dir: 'desc',
    filters: {
      my_role: 'performer',
    },
  }, { enabled });
  const timesheetQuery = useCRCPerformerWeeklyTimesheet({}, { enabled });

  useEffect(() => {
    if (dataVersion > 0 && enabled) {
      void Promise.all([
        performerQuery.refetch(),
        timesheetQuery.refetch(),
      ]);
    }
  }, [dataVersion, enabled, performerQuery.refetch, timesheetQuery.refetch]);

  useEffect(() => {
    const firstError = [performerQuery.error, timesheetQuery.error].find(Boolean);
    if (!firstError) {
      return;
    }

    // Don't show error for canceled requests (user navigated away)
    if (isRequestCanceledError(firstError)) {
      return;
    }

    onError(firstError instanceof Error ? firstError.message : 'Đã xảy ra lỗi.');
  }, [onError, performerQuery.error, timesheetQuery.error]);

  const performerRows = enabled ? (performerQuery.data?.data ?? []) : [];
  const buckets = useMemo(() => splitPerformerWorkspaceRows(performerRows), [performerRows]);

  return {
    isLoading: enabled
      ? (performerQuery.isLoading || performerQuery.isFetching || timesheetQuery.isLoading || timesheetQuery.isFetching)
      : false,
    performerRows,
    timesheet: enabled ? (timesheetQuery.data ?? null) : null,
    pendingRows: buckets.pendingRows,
    activeRows: buckets.activeRows,
    closedRows: buckets.closedRows,
  };
};
