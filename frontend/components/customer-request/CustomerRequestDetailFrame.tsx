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
  onTogglePinned: () => void;
  onClose: () => void;
  children: React.ReactNode;
};

export const CustomerRequestDetailFrame: React.FC<CustomerRequestDetailFrameProps> = ({
  mode,
  showOnWide = false,
  request,
  isPinned,
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

  const shell = (
    <div
      role={mode === 'inline' ? undefined : 'dialog'}
      aria-modal={mode === 'inline' ? undefined : true}
      aria-label={
        mode === 'inline'
          ? undefined
          : request?.tieu_de || request?.summary || request?.ma_yc || 'Chi tiết yêu cầu'
      }
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden bg-white ${
        mode === 'inline'
          ? 'rounded-3xl border border-slate-200 shadow-sm'
          : mode === 'modal'
          ? 'max-h-[calc(100dvh-16px)] w-full max-w-[1560px] rounded-[28px] border border-slate-200 shadow-2xl sm:max-h-[calc(100dvh-48px)]'
          : 'h-full w-full max-w-[920px] shadow-2xl'
      }`}
    >
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                {request?.ma_yc || request?.request_code || 'Chi tiết YC'}
              </span>
              {request?.current_status_name_vi ? (
                <span className="text-[11px] font-medium text-slate-400">
                  {request.current_status_name_vi}
                </span>
              ) : null}
            </div>
            <h3 className="mt-2 line-clamp-2 text-lg font-black text-slate-900 sm:text-xl">
              {request?.tieu_de || request?.summary || 'Chi tiết yêu cầu'}
            </h3>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
              {[
                request?.khach_hang_name || request?.customer_name,
                request?.project_name,
                request?.product_name,
              ]
                .filter(Boolean)
                .join(' · ') || 'Mở detail, xử lý và đóng vòng yêu cầu trong cùng một khung.'}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {request ? (
              <button
                type="button"
                onClick={onTogglePinned}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  isPinned
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isPinned ? 'star' : 'star_outline'}
                </span>
                {isPinned ? 'Đã ghim' : 'Ghim'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
              Đóng
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">{children}</div>
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
      <div className="fixed inset-0 z-[70] overflow-y-auto p-2 sm:p-6">
        <div
          className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
          onClick={onClose}
        />
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
    <div className={`fixed inset-0 z-[70] ${showOnWide ? '' : '2xl:hidden'}`}>
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
