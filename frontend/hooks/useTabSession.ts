/**
 * useTabSession — Đảm bảo chỉ 1 tab active tại một thời điểm.
 *
 * Cơ chế (sau fix race-condition):
 * 1. Bootstrap tự renew tab token → KHÔNG cần initial claim từ đây nữa.
 *    Frontend nhận token hợp lệ ngay khi auth xong.
 *
 * 2. visibilitychange → khi tab trở lại foreground → claim lại session
 *    (trường hợp user quay lại tab cũ sau khi đã mở tab mới)
 *
 * 3. BroadcastChannel 'vnpt_tab_session':
 *    → Khi tab mới claim xong → broadcast TAB_ALIVE
 *    → Các tab khác biết mình sẽ bị evict khi request tiếp theo
 *
 * 4. Heartbeat 30s → phát hiện TAB_EVICTED sớm (user không thao tác)
 *
 * 5. onEvicted callback → gọi từ App.tsx để logout + redirect
 */

import { useEffect, useRef } from 'react';

const CHANNEL_NAME          = 'vnpt_tab_session';
const CLAIM_ENDPOINT        = '/api/v5/auth/tab/claim';
const HEARTBEAT_INTERVAL_MS = 30_000;

type TabMessage =
  | { type: 'TAB_ALIVE'; tabId: string }
  | { type: 'TAB_EVICTED' };

interface UseTabSessionOptions {
  /** Có đang đăng nhập không */
  isAuthenticated: boolean;
  /** Gọi khi tab bị evict (từ interceptor hoặc heartbeat) */
  onEvicted: () => void;
}

export const useTabSession = ({ isAuthenticated, onEvicted }: UseTabSessionOptions): void => {
  const tabId        = useRef<string>(crypto.randomUUID());
  const channelRef   = useRef<BroadcastChannel | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onEvictedRef = useRef(onEvicted);
  const isClaiming   = useRef(false);

  // Luôn dùng ref mới nhất của callback để tránh stale closure
  useEffect(() => {
    onEvictedRef.current = onEvicted;
  }, [onEvicted]);

  // ─── Claim session lên server ────────────────────────────────────────────
  // Chỉ gọi khi cần (visibility change) — KHÔNG gọi on mount nữa
  // vì bootstrap đã claim token rồi.
  const claimSession = async (): Promise<void> => {
    if (isClaiming.current || !isAuthenticated) return;
    isClaiming.current = true;

    try {
      const res = await fetch(CLAIM_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (res.status === 401) {
        // Token thực sự không còn hợp lệ → evict
        const body = await res.json().catch(() => ({})) as { code?: string };
        // Chỉ evict khi server nói rõ TAB_EVICTED, không evict vì các lỗi 401 khác
        if (body?.code === 'TAB_EVICTED' || body?.code === 'UNAUTHENTICATED') {
          onEvictedRef.current();
        }
        return;
      }

      if (res.ok) {
        // Claim thành công → báo cho các tab khác
        channelRef.current?.postMessage({
          type:  'TAB_ALIVE',
          tabId: tabId.current,
        } satisfies TabMessage);
      }
    } catch {
      // Network error — bỏ qua, heartbeat sẽ thử lại
    } finally {
      isClaiming.current = false;
    }
  };

  // ─── Heartbeat: mỗi 30s kiểm tra session còn hợp lệ không ───────────────
  const startHeartbeat = (): void => {
    stopHeartbeat();
    heartbeatRef.current = setInterval(async () => {
      if (!isAuthenticated) return;
      try {
        const res = await fetch('/api/v5/auth/me', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (res.status === 401) {
          const body = await res.json().catch(() => ({})) as { code?: string };
          // Chỉ evict khi server trả đúng code TAB_EVICTED
          if (body?.code === 'TAB_EVICTED') {
            onEvictedRef.current();
          }
          // 401 thông thường (token expire tự nhiên) → bỏ qua,
          // v5Api interceptor sẽ thử refresh tự động
        }
      } catch {
        // Network error — bỏ qua
      }
    }, HEARTBEAT_INTERVAL_MS);
  };

  const stopHeartbeat = (): void => {
    if (heartbeatRef.current !== null) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  // ─── Mount / isAuthenticated thay đổi ───────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      stopHeartbeat();
      channelRef.current?.close();
      channelRef.current = null;
      return;
    }

    // Khởi tạo BroadcastChannel để lắng nghe tab khác claim
    if (!channelRef.current) {
      const ch = new BroadcastChannel(CHANNEL_NAME);

      ch.onmessage = (event: MessageEvent<TabMessage>) => {
        const msg = event.data;
        if (msg.type === 'TAB_ALIVE' && msg.tabId !== tabId.current) {
          // Tab khác vừa claim visibility → heartbeat sẽ phát hiện evict sau
        }
        if (msg.type === 'TAB_EVICTED') {
          onEvictedRef.current();
        }
      };

      channelRef.current = ch;
    }

    // ★ KHÔNG gọi claimSession() on mount — bootstrap đã renew tab token
    // → loại bỏ race condition giữa bootstrap xong và claim

    // Bắt đầu heartbeat để phát hiện evict
    startHeartbeat();

    // Visibility change: tab quay lại foreground → claim để "chiếm" session lại
    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        void claimSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopHeartbeat();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Cleanup khi component unmount hoàn toàn
  useEffect(() => {
    return () => {
      stopHeartbeat();
      channelRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
