import { useEffect, useState } from 'react';
import { DEFAULT_PAGINATION_META, fetchYeuCauPage } from '../../../services/v5Api';
import type { PaginationMeta, YeuCau } from '../../../types';

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
  const [listRows, setListRows] = useState<YeuCau[]>([]);
  const [isListLoading, setIsListLoading] = useState(false);
  const [listMeta, setListMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);

  useEffect(() => {
    // Allow empty activeProcessCode — means load all statuses
    if (!canReadRequests || isCreateMode) {
      return;
    }

    let cancelled = false;
    setIsListLoading(true);

    void fetchYeuCauPage({
      page: listPage,
      per_page: pageSize,
      // Empty string → undefined so the API param is omitted (= no filter)
      process_code: activeProcessCode || undefined,
      q: requestKeyword,
      filters,
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        setListMeta(result.meta);
        if (result.meta.total_pages > 0 && listPage > result.meta.total_pages) {
          onPageOverflow(result.meta.total_pages);
          return;
        }

        setListRows(result.data);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setListRows([]);
        setListMeta(DEFAULT_PAGINATION_META);
        onError(error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsListLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeProcessCode,
    canReadRequests,
    dataVersion,
    filters,
    isCreateMode,
    listPage,
    onError,
    onPageOverflow,
    pageSize,
    requestKeyword,
  ]);

  return {
    listRows,
    isListLoading,
    listMeta,
  };
};
