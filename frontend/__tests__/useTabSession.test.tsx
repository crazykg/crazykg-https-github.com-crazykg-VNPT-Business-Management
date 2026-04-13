// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTabSession } from '../hooks/useTabSession';

class BroadcastChannelMock {
  static channels = new Map<string, Set<BroadcastChannelMock>>();

  readonly name: string;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;

  constructor(name: string) {
    this.name = name;
    const peers = BroadcastChannelMock.channels.get(name) ?? new Set<BroadcastChannelMock>();
    peers.add(this);
    BroadcastChannelMock.channels.set(name, peers);
  }

  postMessage(data: unknown): void {
    const peers = BroadcastChannelMock.channels.get(this.name) ?? new Set<BroadcastChannelMock>();
    peers.forEach((peer) => {
      if (peer === this) {
        return;
      }

      peer.onmessage?.(new MessageEvent('message', { data }));
    });
  }

  close(): void {
    const peers = BroadcastChannelMock.channels.get(this.name);
    if (!peers) {
      return;
    }

    peers.delete(this);
    if (peers.size === 0) {
      BroadcastChannelMock.channels.delete(this.name);
    }
  }

  static getInstances(name: string): BroadcastChannelMock[] {
    return Array.from(BroadcastChannelMock.channels.get(name) ?? []);
  }

  static reset(): void {
    BroadcastChannelMock.channels.clear();
  }
}

describe('useTabSession', () => {
  let visibilityState: DocumentVisibilityState;

  beforeEach(() => {
    visibilityState = 'hidden';
    BroadcastChannelMock.reset();
    vi.useFakeTimers();
    vi.stubGlobal('BroadcastChannel', BroadcastChannelMock as unknown as typeof BroadcastChannel);
    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('tab-1')
        .mockReturnValueOnce('tab-2')
        .mockReturnValue('tab-3'),
    } as Crypto);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    BroadcastChannelMock.reset();
  });

  it('does not poll auth/me in the background anymore', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = renderHook(() =>
      useTabSession({
        isAuthenticated: true,
        onEvicted: vi.fn(),
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    unmount();
  });

  it('claims the tab session when the tab becomes visible', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { tab_token: 'claim-token' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = renderHook(() =>
      useTabSession({
        isAuthenticated: true,
        onEvicted: vi.fn(),
      }),
    );

    await act(async () => {
      visibilityState = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/v5/auth/tab/claim', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    unmount();
  });

  it('evicts the current tab immediately when another tab broadcasts TAB_ALIVE', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const onEvictedFirstTab = vi.fn();
    const onEvictedSecondTab = vi.fn();

    const firstHook = renderHook(() =>
      useTabSession({
        isAuthenticated: true,
        onEvicted: onEvictedFirstTab,
      }),
    );
    const secondHook = renderHook(() =>
      useTabSession({
        isAuthenticated: true,
        onEvicted: onEvictedSecondTab,
      }),
    );

    const channels = BroadcastChannelMock.getInstances('vnpt_tab_session');
    expect(channels).toHaveLength(2);

    await act(async () => {
      channels[1]?.postMessage({ type: 'TAB_ALIVE', tabId: 'tab-2' });
      await Promise.resolve();
    });

    expect(onEvictedFirstTab).toHaveBeenCalledTimes(1);
    expect(onEvictedSecondTab).not.toHaveBeenCalled();

    firstHook.unmount();
    secondHook.unmount();
  });
});
