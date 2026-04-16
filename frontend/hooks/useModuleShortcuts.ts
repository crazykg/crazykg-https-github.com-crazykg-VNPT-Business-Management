import { useEffect, useRef } from 'react';

export interface ModuleShortcutHandlers {
  /** Ctrl/Cmd+N — mở modal thêm mới */
  onNew?: () => void;
  /** Ctrl/Cmd+U — mở modal sửa row đang chọn */
  onUpdate?: () => void;
  /** Ctrl/Cmd+D — mở modal xoá row đang chọn */
  onDelete?: () => void;
  /** Ctrl/Cmd+F — focus ô tìm kiếm */
  onFocusSearch?: () => void;
  /** Tắt tất cả shortcuts khi false (mặc định: true) */
  enabled?: boolean;
}

const isMacPlatform = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);

/**
 * Lắng nghe phím tắt module: Ctrl/Cmd + N/U/D/F.
 *
 * Guard: không kích hoạt khi focus đang ở INPUT/TEXTAREA/SELECT
 * (ngoại trừ Ctrl+F — luôn override browser find).
 *
 * Đặt enabled=false khi module bị unmount hoặc modal khác đang mở.
 */
export function useModuleShortcuts(handlers: ModuleShortcutHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const listener = (e: KeyboardEvent): void => {
      const { enabled = true } = handlersRef.current;
      if (!enabled) return;

      const isMac = isMacPlatform();
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (!modifier) return;

      const tag = (e.target as HTMLElement)?.tagName ?? '';
      const isInputFocused = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      switch (e.key.toLowerCase()) {
        case 'n':
          if (isInputFocused) return;
          if (!handlersRef.current.onNew) return;
          e.preventDefault();
          handlersRef.current.onNew();
          break;

        case 'u':
          if (isInputFocused) return;
          if (!handlersRef.current.onUpdate) return;
          e.preventDefault();
          handlersRef.current.onUpdate();
          break;

        case 'd':
          if (isInputFocused) return;
          if (!handlersRef.current.onDelete) return;
          e.preventDefault();
          handlersRef.current.onDelete();
          break;

        case 'f':
          // Ctrl+F luôn override browser find khi có handler
          if (!handlersRef.current.onFocusSearch) return;
          e.preventDefault();
          handlersRef.current.onFocusSearch();
          break;

        default:
          break;
      }
    };

    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []); // handlers được đọc qua ref, không cần re-register
}
