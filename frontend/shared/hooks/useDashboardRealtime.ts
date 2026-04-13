import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { subscribeDashboardSignals } from '../realtime/dashboardSignalBus';
import { realtimeConfig, type DashboardRealtimeDomain } from '../realtime/realtimeConfig';

const INVALIDATION_DEBOUNCE_MS = 250;

interface UseDashboardRealtimeOptions {
  allowPollingFallback?: boolean;
}

const invalidateDashboardDomains = async (
  queryClient: ReturnType<typeof useQueryClient>,
  domains: DashboardRealtimeDomain[],
): Promise<void> => {
  if (domains.includes('fee_collection')) {
    await queryClient.invalidateQueries({ queryKey: ['invoices', 'dashboard'], refetchType: 'active' });
    await queryClient.invalidateQueries({ queryKey: queryKeys.revenue.all, refetchType: 'active' });
  }

  if (domains.includes('revenue')) {
    await queryClient.invalidateQueries({ queryKey: queryKeys.revenue.all, refetchType: 'active' });
  }
};

export const useDashboardRealtime = (
  domains: DashboardRealtimeDomain[],
  enabled = true,
  options?: UseDashboardRealtimeOptions,
): { pollingEnabled: boolean } => {
  const queryClient = useQueryClient();
  const [pollingEnabled, setPollingEnabled] = useState(false);
  const pendingDomainsRef = useRef<Set<DashboardRealtimeDomain>>(new Set());
  const flushTimeoutRef = useRef<number | null>(null);
  const domainsRef = useRef(domains);
  const allowPollingFallback = options?.allowPollingFallback ?? true;

  domainsRef.current = domains;

  useEffect(() => {
    const flushInvalidation = () => {
      if (pendingDomainsRef.current.size === 0) {
        return;
      }

      const nextDomains = Array.from(pendingDomainsRef.current);
      pendingDomainsRef.current.clear();
      void invalidateDashboardDomains(queryClient, nextDomains);
    };

    const queueInvalidation = (nextDomains: DashboardRealtimeDomain[]) => {
      nextDomains.forEach((domain) => pendingDomainsRef.current.add(domain));
      if (flushTimeoutRef.current !== null) {
        return;
      }

      flushTimeoutRef.current = window.setTimeout(() => {
        flushTimeoutRef.current = null;
        flushInvalidation();
      }, INVALIDATION_DEBOUNCE_MS);
    };

    if (!enabled) {
      setPollingEnabled(false);
      return () => {
        if (flushTimeoutRef.current !== null) {
          window.clearTimeout(flushTimeoutRef.current);
          flushTimeoutRef.current = null;
        }
        pendingDomainsRef.current.clear();
      };
    }

    const unsubscribe = subscribeDashboardSignals(
      domainsRef.current,
      queueInvalidation,
      (polling) => {
        setPollingEnabled(allowPollingFallback ? polling : false);
      },
    );

    return () => {
      unsubscribe();
      if (flushTimeoutRef.current !== null) {
        window.clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      pendingDomainsRef.current.clear();
    };
  }, [allowPollingFallback, enabled, queryClient]);

  useEffect(() => {
    if (!enabled || !allowPollingFallback || !pollingEnabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void invalidateDashboardDomains(queryClient, domainsRef.current);
    }, realtimeConfig.fallbackPollMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [allowPollingFallback, enabled, pollingEnabled, queryClient]);

  return { pollingEnabled };
};
