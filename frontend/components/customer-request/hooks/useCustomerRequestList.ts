import { useEffect } from 'react';
import { DEFAULT_PAGINATION_META, isRequestCanceledError } from '../../../services/v5Api';
import { useCRCList } from '../../../shared/hooks/useCustomerRequests';
import type { PaginationMeta } from '../../../types';
import type { YeuCau } from '../../../types/customerRequest';

type UseCustomerRequestListOptions = {
  canReadRequests: boolean;
  activeProcessCode: string;
  isCreateMode: boolean;
  listPage: number;
  pageSize: number;
  dataVersion: number;
  requestKeyword: string;
  filters: {
    customer_id?: string;
    support_service_group_id?: string;
    priority?: string;
    my_role?: string;
    created_from?: string;
    created_to?: string;
    missing_estimate?: 1 | undefined;
    over_estimate?: 1 | undefined;
    sla_risk?: 1 | undefined;
  };
  onError: (message: string) => void;
  onPageOverflow: (page: number) => void;
};

export const useCustomerRequestList = ({
  canReadRequests,
  activeProcessCode,
  isCreateMode,
  listPage,
  pageSize,
  dataVersion,
  requestKeyword,
  filters,
  onError,
  onPageOverflow,
}: UseCustomerRequestListOptions) => {
  const enabled = canReadRequests && !isCreateMode;

  const listQuery = useCRCList(
    {
      page: listPage,
      per_page: pageSize,
      sort_by: 'updated_at',
      sort_dir: 'desc',
      process_code: activeProcessCode || undefined,
      q: requestKeyword,
      filters,
    },
    { enabled }
  );

  useEffect(() => {
    if (dataVersion > 0 && enabled) {
      void listQuery.refetch();
    }
  }, [dataVersion, enabled, listQuery.refetch]);

  useEffect(() => {
    if (!listQuery.error || isRequestCanceledError(listQuery.error)) {
      return;
    }

    onError(listQuery.error instanceof Error ? listQuery.error.message : 'Đã xảy ra lỗi.');
  }, [listQuery.error, onError]);

  const listRows: YeuCau[] = enabled ? (listQuery.data?.data ?? []) : [];
  const listMeta: PaginationMeta = enabled ? (listQuery.data?.meta ?? DEFAULT_PAGINATION_META) : DEFAULT_PAGINATION_META;
  const hasResolvedMeta = enabled && Boolean(listQuery.data?.meta);

  useEffect(() => {
    if (!hasResolvedMeta) {
      return;
    }

    if (listMeta.total_pages > 0 && listPage > listMeta.total_pages) {
      onPageOverflow(listMeta.total_pages);
    }
  }, [hasResolvedMeta, listMeta.total_pages, listPage, onPageOverflow]);

  return {
    listRows,
    isListLoading: enabled ? (listQuery.isLoading || listQuery.isFetching) : false,
    listMeta,
  };
};
