import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { YeuCau } from '../../types/customerRequest';
import {
  customerRequestDenseSecondaryButtonClass,
  customerRequestIconButtonClass,
  customerRequestModalPanelClass,
  customerRequestSurfaceClass,
} from './uiClasses';

type CustomerRequestDetailFrameProps = {
  mode: 'inline' | 'drawer' | 'modal';
  /**
   * Chỉ áp dụng cho mode="drawer".
   * - false (default): ẩn drawer ở màn ≥ 1536px (dùng khi list surface có inline detail).
   * - true: luôn hiển thị drawer bất kể độ rộng màn (dùng khi mở từ inbox surface).
   */
  showOnWide?: boolean;
  request: YeuCau | null;
  isPinned: boolean;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: string;
  footer?: React.ReactNode;
  onTogglePinned: () => void;
  onClose: () => void;
  children: React.ReactNode;
};

export const CustomerRequestDetailFrame: React.FC<CustomerRequestDetailFrameProps> = ({
  mode,
  showOnWide = false,
  request,
  isPinned,
  title,
  subtitle,
  icon = 'edit_note',
  footer,
  onTogglePinned,
  onClose,
  children,
}) => {
  useEffect(() => {
    if (mode === 'inline' || typeof document === 'undefined') {
      return undefined;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [mode]);

  const isModalMode = mode === 'modal';
  const shellClassName =
    mode === 'inline'
      ? customerRequestSurfaceClass
      : mode === 'modal'
      ? `h-[100dvh] w-full max-w-none border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] shadow-xl sm:h-[90dvh] ${customerRequestModalPanelClass}`
      : 'h-full w-full max-w-[920px] border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] shadow-[0_28px_72px_rgba(15,23,42,0.18)] sm:rounded-l-[var(--ui-modal-radius)]';
  const shell = (
    <div
      role={mode === 'inline' ? undefined : 'dialog'}
      aria-modal={mode === 'inline' ? undefined : true}
      aria-label={
        mode === 'inline'
          ? undefined
          : request?.tieu_de || request?.summary || request?.ma_yc || 'Chi tiết yêu cầu'
      }
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden ${shellClassName}`}
      >
      <div className={`sticky top-0 z-10 border-b border-slate-100 bg-white ${isModalMode ? 'px-3 py-2 sm:px-4 lg:px-4 xl:px-5' : 'px-4 py-2.5 sm:px-5'}`}>
        <div className="flex items-center justify-between gap-2.5">
          {isModalMode ? (
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--ui-control-radius)] bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[18px]">{icon}</span>
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold leading-tight text-deep-teal">
                  {title || 'Chi tiết yêu cầu'}
                </div>
                <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {request?.ma_yc || request?.request_code || 'Chi tiết YC'}
                  </span>
                  {subtitle ? (
                    <span className="min-w-0 truncate">
                      {subtitle}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                {request?.ma_yc || request?.request_code || 'Chi tiết YC'}
              </span>
            </div>
          )}

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {request ? (
              <button
                type="button"
                onClick={onTogglePinned}
                className={`${customerRequestDenseSecondaryButtonClass} ${
                  isPinned
                    ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                    : ''
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {isPinned ? 'star' : 'star_outline'}
                </span>
                {isPinned ? 'Đã ghim' : 'Ghim'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className={isModalMode
                ? `${customerRequestIconButtonClass} border-transparent`
                : customerRequestDenseSecondaryButtonClass}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              {isModalMode ? null : 'Đóng'}
            </button>
          </div>
        </div>
      </div>

      <div className={isModalMode ? 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-3 sm:px-5 sm:py-4' : 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4'}>{children}</div>
      {isModalMode && footer ? (
        <div className="sticky bottom-0 z-10 shrink-0 border-t border-slate-100 bg-white">
          {footer}
        </div>
      ) : null}
    </div>
  );

  if (mode === 'inline') {
    return shell;
  }

  const portalRoot = typeof document !== 'undefined' ? document.body : null;

  if (mode === 'modal') {
    if (!portalRoot) {
      return null;
    }

    return createPortal(
      <div className="fixed inset-0 z-[120] overflow-y-auto overscroll-none p-0 sm:p-6">
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" />
        <div className="relative flex min-h-full items-start justify-center overscroll-none sm:items-center">
          {shell}
        </div>
      </div>,
      portalRoot
    );
  }

  if (!portalRoot) {
    return null;
  }

  return createPortal(
    <div className={`fixed inset-0 z-[120] ${showOnWide ? '' : '2xl:hidden'}`}>
      <div
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className="absolute inset-0 flex justify-end">
        <div className="flex h-full w-full justify-end">{shell}</div>
      </div>
    </div>,
    portalRoot
  );
};
