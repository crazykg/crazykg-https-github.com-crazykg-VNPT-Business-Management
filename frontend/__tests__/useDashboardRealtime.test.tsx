// @vitest-environment jsdom

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../shared/queryKeys';
import { useDashboardRealtime } from '../shared/hooks/useDashboardRealtime';

type SubscriptionRecord = {
  onSignal: (domains: Array<'fee_collection' | 'revenue'>) => void;
  onPollingChange?: (polling: boolean) => void;
};

const subscriptions: SubscriptionRecord[] = [];

vi.mock('../shared/realtime/dashboardSignalBus', () => ({
  subscribeDashboardSignals: vi.fn((_domains, onSignal, onPollingChange) => {
    const record = { onSignal, onPollingChange };
    subscriptions.push(record);

    return () => {
      const index = subscriptions.indexOf(record);
      if (index >= 0) {
        subscriptions.splice(index, 1);
      }
    };
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
};

describe('useDashboardRealtime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    subscriptions.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('invalidates fee collection and revenue queries when a fee collection signal arrives', async () => {
    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined as never);

    renderHook(() => useDashboardRealtime(['fee_collection']), { wrapper });

    expect(subscriptions).toHaveLength(1);

    await act(async () => {
      subscriptions[0]?.onSignal(['fee_collection']);
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['invoices', 'dashboard'], refetchType: 'active' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.revenue.all, refetchType: 'active' });
  });

  it('falls back to polling when realtime transport becomes unavailable', async () => {
    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useDashboardRealtime(['revenue']), { wrapper });

    await act(async () => {
      subscriptions[0]?.onPollingChange?.(true);
    });

    expect(result.current.pollingEnabled).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.revenue.all, refetchType: 'active' });
  });
});
