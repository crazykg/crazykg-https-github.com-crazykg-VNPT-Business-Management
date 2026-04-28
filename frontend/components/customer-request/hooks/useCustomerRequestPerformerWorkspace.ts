import { useEffect, useMemo, useRef } from 'react';
import {
  useCRCList,
  useCRCPerformerWeeklyTimesheet,
} from '../../../shared/hooks/useCustomerRequests';
import { isRequestCanceledError } from '../../../services/api/customerRequestApi';
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
  const lastRefetchedVersionRef = useRef(0);
  const performerRefetchRef = useRef<() => Promise<unknown>>(async () => undefined);
  const timesheetRefetchRef = useRef<() => Promise<unknown>>(async () => undefined);
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
    performerRefetchRef.current = performerQuery.refetch;
    timesheetRefetchRef.current = timesheetQuery.refetch;
  }, [performerQuery.refetch, timesheetQuery.refetch]);

  useEffect(() => {
    if (!enabled) {
      lastRefetchedVersionRef.current = 0;
      return;
    }

    if (dataVersion <= 0 || lastRefetchedVersionRef.current === dataVersion) {
      return;
    }

    lastRefetchedVersionRef.current = dataVersion;
    void Promise.all([
      performerRefetchRef.current(),
      timesheetRefetchRef.current(),
    ]);
  }, [dataVersion, enabled]);

  useEffect(() => {
    const firstError = [performerQuery.error, timesheetQuery.error]
      .find((error) => Boolean(error) && !isRequestCanceledError(error));
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
