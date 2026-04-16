import { useEffect, useRef } from 'react';

export interface ModalShortcutHandlers {
  /** Ctrl/Cmd+S — submit form modal */
  onSave?: () => void;
  /**
   * Bật/tắt shortcut.
   * Truyền `isOpen && !isSubmitting` để tự động disable khi modal đóng hoặc đang submit.
   */
  enabled?: boolean;
}

const isMacPlatform = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);

/**
 * Lắng nghe Ctrl/Cmd+S trong form modal để kích hoạt submit.
 *
 * Dùng bên trong form modal component (không phải List component).
 * Kết hợp với useModuleShortcuts ở List — hai hook này không conflict.
 *
 * @example
 * useModalShortcuts({
 *   onSave: handleSubmit,
 *   enabled: isOpen && !isSubmitting,
 * });
 */
export function useModalShortcuts(handlers: ModalShortcutHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const listener = (e: KeyboardEvent): void => {
      const { enabled = true, onSave } = handlersRef.current;
      if (!enabled || !onSave) return;

      const isMac = isMacPlatform();
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (!modifier) return;

      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSave();
      }
    };

    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []); // handlers được đọc qua ref
}
