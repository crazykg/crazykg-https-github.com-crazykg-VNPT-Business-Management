import { useEffect, useMemo } from 'react';
import { DEFAULT_PAGINATION_META } from '../../../services/v5Api';
import { useCRCList } from '../../../shared/hooks/useCustomerRequests';

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
  const params = useMemo(() => ({
    page: listPage,
    per_page: pageSize,
    process_code: activeProcessCode || undefined,
    q: requestKeyword,
    filters,
  }), [activeProcessCode, filters, listPage, pageSize, requestKeyword]);

  const listQuery = useCRCList(params, { enabled });

  useEffect(() => {
    if (dataVersion > 0 && enabled) {
      void listQuery.refetch();
    }
  }, [dataVersion, enabled, listQuery.refetch]);

  useEffect(() => {
    if (!listQuery.error) {
      return;
    }

    onError(listQuery.error instanceof Error ? listQuery.error.message : 'Đã xảy ra lỗi.');
  }, [listQuery.error, onError]);

  useEffect(() => {
    const totalPages = listQuery.data?.meta?.total_pages ?? 0;
    if (totalPages > 0 && listPage > totalPages) {
      onPageOverflow(totalPages);
    }
  }, [listPage, listQuery.data?.meta?.total_pages, onPageOverflow]);

  return {
    listRows: enabled ? (listQuery.data?.data ?? []) : [],
    isListLoading: enabled ? (listQuery.isLoading || listQuery.isFetching) : false,
    listMeta: enabled ? (listQuery.data?.meta ?? DEFAULT_PAGINATION_META) : DEFAULT_PAGINATION_META,
  };
};
