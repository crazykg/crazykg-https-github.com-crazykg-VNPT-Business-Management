import React, { useState } from 'react';
import type {
  CustomerRequestQuickRequestItem,
  CustomerRequestSavedView,
} from './customerRequestQuickAccess';
import type { CustomerRequestSurfaceKey } from './CustomerRequestSurfaceSwitch';
import { useCustomerRequestResponsiveLayout } from './hooks/useCustomerRequestResponsiveLayout';

type CustomerRequestQuickAccessBarProps = {
  activeSurface?: CustomerRequestSurfaceKey;
  savedViews: CustomerRequestSavedView[];
  activeSavedViewId: string | null;
  onApplySavedView: (view: CustomerRequestSavedView) => void;
  onClearSavedView: () => void;
  pinnedItems: CustomerRequestQuickRequestItem[];
  recentItems: CustomerRequestQuickRequestItem[];
  onOpenRequest: (item: CustomerRequestQuickRequestItem) => void;
  onRemovePinned: (requestId: string | number) => void;
};

const SURFACE_LABEL: Record<CustomerRequestSurfaceKey, string> = {
  inbox: 'Bảng theo dõi',
  list: 'Danh sách',
  analytics: 'Phân tích',
};

export const CustomerRequestQuickAccessBar: React.FC<
  CustomerRequestQuickAccessBarProps
> = ({
  activeSurface = 'inbox',
  savedViews,
  activeSavedViewId,
  onApplySavedView,
  onClearSavedView,
  pinnedItems,
  recentItems,
  onOpenRequest,
  onRemovePinned,
}) => (
  <ResponsiveQuickAccessBar
    activeSurface={activeSurface}
    savedViews={savedViews}
    activeSavedViewId={activeSavedViewId}
    onApplySavedView={onApplySavedView}
    onClearSavedView={onClearSavedView}
    pinnedItems={pinnedItems}
    recentItems={recentItems}
    onOpenRequest={onOpenRequest}
    onRemovePinned={onRemovePinned}
  />
);

const ResponsiveQuickAccessBar: React.FC<CustomerRequestQuickAccessBarProps> = ({
  activeSurface,
  savedViews,
  activeSavedViewId,
  onApplySavedView,
  onClearSavedView,
  pinnedItems,
  recentItems,
  onOpenRequest,
  onRemovePinned,
}) => {
  const layoutMode = useCustomerRequestResponsiveLayout();
  const isMobile = layoutMode === 'mobile';
  const surfaceLabel = SURFACE_LABEL[activeSurface ?? 'inbox'];
  const [isQuickAccessExpanded, setIsQuickAccessExpanded] = useState(true);
  const compactEmptySecondary = isMobile && pinnedItems.length === 0 && recentItems.length === 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral">
              Truy cập nhanh
            </p>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {surfaceLabel}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <InlineStatChip label="Đã ghim" value={pinnedItems.length} />
            <InlineStatChip label="Gần đây" value={recentItems.length} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsQuickAccessExpanded((value) => !value)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          <span
            aria-hidden="true"
            className={`material-symbols-outlined transition-transform ${
              isQuickAccessExpanded ? 'rotate-180' : ''
            }`}
            style={{ fontSize: 16 }}
          >
            expand_more
          </span>
          <span>{isQuickAccessExpanded ? 'Thu gọn' : 'Mở rộng'}</span>
        </button>
      </div>

      {isQuickAccessExpanded ? (
        <div
          className={`mt-3 grid gap-3 ${
            layoutMode === 'mobile'
              ? 'grid-cols-1'
              : layoutMode === 'tablet'
              ? 'md:grid-cols-2'
              : layoutMode === 'desktopCompact'
              ? 'xl:grid-cols-2'
              : '2xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)]'
          }`}
        >
          {compactEmptySecondary ? (
            <div className="grid grid-cols-2 gap-2">
              <CompactQuickStatus
                label="Đã ghim"
                message="Chưa có ghim."
              />
              <CompactQuickStatus
                label="Gần đây"
                message="Chưa có lịch sử."
              />
            </div>
          ) : (
            <>
              <QuickSection
                label="Đã ghim"
              >
                {pinnedItems.length === 0 ? (
                  isMobile ? (
                    <EmptyQuickInline message="Chưa có ghim." />
                  ) : (
                    <EmptyQuickState message="Chưa có yêu cầu nào được ghim." />
                  )
                ) : (
                  <div className="space-y-2">
                    {pinnedItems.slice(0, isMobile ? 2 : 4).map((item) => (
                      <QuickRequestPill
                        key={`pinned-${item.requestId}`}
                        item={item}
                        tone="amber"
                        compact={isMobile}
                        onOpen={() => onOpenRequest(item)}
                        trailingAction={
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onRemovePinned(item.requestId);
                            }}
                            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                            aria-label={`Bỏ ghim ${item.code}`}
                          >
                            <span className="material-symbols-outlined text-[15px]">close</span>
                          </button>
                        }
                      />
                    ))}
                  </div>
                )}
              </QuickSection>

              <QuickSection
                label="Gần đây"
              >
                {recentItems.length === 0 ? (
                  isMobile ? (
                    <EmptyQuickInline message="Chưa có lịch sử." />
                  ) : (
                    <EmptyQuickState message="Chưa có lịch sử mở yêu cầu gần đây." />
                  )
                ) : (
                  <div className="space-y-2">
                    {recentItems.slice(0, isMobile ? 2 : 4).map((item) => (
                      <QuickRequestPill
                        key={`recent-${item.requestId}`}
                        item={item}
                        tone="sky"
                        compact={isMobile}
                        onOpen={() => onOpenRequest(item)}
                      />
                    ))}
                  </div>
                )}
              </QuickSection>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
};

const QuickSection: React.FC<{
  label: string;
  trailing?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({
  label,
  trailing,
  className = '',
  children,
}) => (
  <div className={`rounded-2xl border border-slate-200 bg-slate-50/55 p-3 ${className}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral">
          {label}
        </p>
      </div>
      {trailing}
    </div>
    <div className="mt-3">{children}</div>
  </div>
);

const QuickRequestPill: React.FC<{
  item: CustomerRequestQuickRequestItem;
  tone: 'sky' | 'amber';
  onOpen: () => void;
  trailingAction?: React.ReactNode;
  compact?: boolean;
}> = ({ item, tone, onOpen, trailingAction, compact = false }) => {
  const surfaceClass =
    tone === 'amber'
      ? 'border-tertiary-fixed/50 bg-tertiary-fixed/16 hover:bg-tertiary-fixed/24'
      : 'border-secondary-fixed/40 bg-secondary-fixed/14 hover:bg-secondary-fixed/24';

  return (
    <div className="flex items-start gap-2">
      <button
        type="button"
        onClick={onOpen}
        className={`min-w-0 flex-1 rounded-2xl border text-left transition ${
          compact ? 'px-3 py-2' : 'px-3 py-2.5'
        } ${surfaceClass}`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-lg bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700">
              {item.code}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-4 text-slate-900">
            {item.title}
          </p>
          <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">
            {item.subtitle || 'Không có mô tả bổ sung'}
          </p>
        </div>
      </button>
      {trailingAction ? <div className="shrink-0">{trailingAction}</div> : null}
    </div>
  );
};

const CompactQuickStatus: React.FC<{
  label: string;
  message: string;
}> = ({ label, message }) => (
  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral">{label}</p>
    <p className="mt-2 text-[12px] font-semibold leading-4 text-slate-500">{message}</p>
  </div>
);

const EmptyQuickInline: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2 text-[11px] leading-4 text-slate-400">
    {message}
  </div>
);

const EmptyQuickState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-5 text-center text-[12px] leading-5 text-slate-400">
    {message}
  </div>
);

const InlineStatChip: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
    <span className="uppercase tracking-[0.12em] text-slate-400">{label}</span>
    <span className="text-slate-800">{value}</span>
  </span>
);
