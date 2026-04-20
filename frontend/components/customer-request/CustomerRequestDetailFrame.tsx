import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { YeuCau } from '../../types/customerRequest';

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
  const shell = (
    <div
      role={mode === 'inline' ? undefined : 'dialog'}
      aria-modal={mode === 'inline' ? undefined : true}
      aria-label={
        mode === 'inline'
          ? undefined
          : request?.tieu_de || request?.summary || request?.ma_yc || 'Chi tiết yêu cầu'
      }
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden ${
          mode === 'inline'
            ? 'rounded-3xl border border-slate-200/80 bg-white shadow-sm'
            : mode === 'modal'
            ? 'h-[90dvh] w-full max-w-none rounded-none border border-slate-200 bg-white shadow-xl'
            : 'h-full w-full max-w-[920px] border border-slate-200/90 bg-white shadow-[0_28px_72px_rgba(15,23,42,0.18)]'
        }`}
      >
      <div className={`sticky top-0 z-10 border-b border-slate-100 bg-white ${isModalMode ? 'px-3 py-2 sm:px-4 lg:px-4 xl:px-5' : 'px-4 py-2.5 sm:px-5'}`}>
        <div className="flex items-center justify-between gap-2.5">
          {isModalMode ? (
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
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
                className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-semibold transition ${
                  isPinned
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
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
                ? 'inline-flex rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600'
                : 'inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              {isModalMode ? null : 'Đóng'}
            </button>
          </div>
        </div>
      </div>

      <div className={isModalMode ? 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:px-5 sm:py-4' : 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4'}>{children}</div>
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
      <div className="fixed inset-0 z-[120] overflow-y-auto p-0 sm:p-6">
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" />
        <div className="relative flex min-h-full items-start justify-center sm:items-center">
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
