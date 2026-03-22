import { useCallback, useEffect, useMemo, useState } from 'react';
import type { YeuCau } from '../../../types';
import {
  buildCustomerRequestQuickItem,
  CUSTOMER_REQUEST_PINNED_LIMIT,
  CUSTOMER_REQUEST_RECENT_LIMIT,
  type CustomerRequestQuickRequestItem,
} from '../customerRequestQuickAccess';

const readQuickAccessItems = (storageKey: string): CustomerRequestQuickRequestItem[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => item && item.requestId != null && item.code);
  } catch {
    return [];
  }
};

const writeQuickAccessItems = (
  storageKey: string,
  items: CustomerRequestQuickRequestItem[]
) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  } catch {
    // Ignore localStorage quota / private mode errors.
  }
};

const upsertRequestItem = (
  prev: CustomerRequestQuickRequestItem[],
  item: CustomerRequestQuickRequestItem,
  limit: number
) => [item, ...prev.filter((entry) => String(entry.requestId) !== String(item.requestId))].slice(0, limit);

export const useCustomerRequestQuickAccess = (
  currentUserId?: string | number | null
) => {
  const storagePrefix = useMemo(
    () => `crc-v7-quick-access:${currentUserId ?? 'anonymous'}`,
    [currentUserId]
  );
  const pinnedStorageKey = `${storagePrefix}:pinned`;
  const recentStorageKey = `${storagePrefix}:recent`;
  const [pinnedItems, setPinnedItems] = useState<CustomerRequestQuickRequestItem[]>([]);
  const [recentItems, setRecentItems] = useState<CustomerRequestQuickRequestItem[]>([]);

  useEffect(() => {
    setPinnedItems(readQuickAccessItems(pinnedStorageKey));
  }, [pinnedStorageKey]);

  useEffect(() => {
    setRecentItems(readQuickAccessItems(recentStorageKey));
  }, [recentStorageKey]);

  useEffect(() => {
    writeQuickAccessItems(pinnedStorageKey, pinnedItems);
  }, [pinnedItems, pinnedStorageKey]);

  useEffect(() => {
    writeQuickAccessItems(recentStorageKey, recentItems);
  }, [recentItems, recentStorageKey]);

  const pushRecentRequest = useCallback((request: YeuCau) => {
    setRecentItems((prev) =>
      upsertRequestItem(prev, buildCustomerRequestQuickItem(request), CUSTOMER_REQUEST_RECENT_LIMIT)
    );
  }, []);

  const togglePinnedRequest = useCallback((request: YeuCau) => {
    const item = buildCustomerRequestQuickItem(request);
    setPinnedItems((prev) => {
      const exists = prev.some((entry) => String(entry.requestId) === String(item.requestId));
      if (exists) {
        return prev.filter((entry) => String(entry.requestId) !== String(item.requestId));
      }

      return upsertRequestItem(prev, item, CUSTOMER_REQUEST_PINNED_LIMIT);
    });
  }, []);

  const removePinnedRequest = useCallback((requestId: string | number) => {
    setPinnedItems((prev) =>
      prev.filter((entry) => String(entry.requestId) !== String(requestId))
    );
  }, []);

  const isPinnedRequest = useCallback(
    (requestId: string | number | null | undefined) =>
      pinnedItems.some((entry) => String(entry.requestId) === String(requestId ?? '')),
    [pinnedItems]
  );

  return {
    pinnedItems,
    recentItems,
    pushRecentRequest,
    togglePinnedRequest,
    removePinnedRequest,
    isPinnedRequest,
  };
};
