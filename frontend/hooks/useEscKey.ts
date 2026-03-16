import { useEffect } from 'react';

/**
 * Lắng nghe phím Escape và gọi callback để đóng modal/overlay.
 *
 * @param onEsc   - Hàm được gọi khi nhấn Escape
 * @param enabled - Chỉ đăng ký listener khi true (mặc định: true).
 *                  Truyền `!!isOpen` để tránh conflict giữa nhiều modal.
 */
export function useEscKey(onEsc: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEsc();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onEsc, enabled]);
}
