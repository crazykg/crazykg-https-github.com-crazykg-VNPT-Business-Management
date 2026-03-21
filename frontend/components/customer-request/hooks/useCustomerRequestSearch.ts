import { useDeferredValue, useEffect, useState } from 'react';
import { fetchYeuCauSearch, isRequestCanceledError } from '../../../services/v5Api';
import type { YeuCauSearchItem } from '../../../types';

type UseCustomerRequestSearchOptions = {
  canReadRequests: boolean;
};

export const useCustomerRequestSearch = ({
  canReadRequests,
}: UseCustomerRequestSearchOptions) => {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<YeuCauSearchItem[]>([]);
  const [searchError, setSearchError] = useState('');
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const deferredSearchKeyword = useDeferredValue(searchKeyword);

  useEffect(() => {
    if (!canReadRequests) {
      return;
    }

    const keyword = deferredSearchKeyword.trim();
    if (keyword.length < 2) {
      setSearchResults([]);
      setSearchError('');
      setIsSearchLoading(false);
      return;
    }

    let cancelled = false;
    setIsSearchLoading(true);

    void fetchYeuCauSearch({ q: keyword, limit: 8 })
      .then((items) => {
        if (cancelled) {
          return;
        }
        setSearchResults(Array.isArray(items) ? items : []);
        setSearchError('');
      })
      .catch((error) => {
        if (cancelled || isRequestCanceledError(error)) {
          return;
        }
        setSearchResults([]);
        setSearchError(error instanceof Error ? error.message : 'Không tải được kết quả tra cứu.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsSearchLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canReadRequests, deferredSearchKeyword]);

  return {
    searchKeyword,
    setSearchKeyword,
    searchResults,
    searchError,
    isSearchLoading,
    isSearchOpen,
    setIsSearchOpen,
  };
};
