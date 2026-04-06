import React, { useEffect, useMemo, useState } from 'react';
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
  const [showAllSavedViews, setShowAllSavedViews] = useState(false);
  const [isQuickAccessExpanded, setIsQuickAccessExpanded] = useState(false);
  const compactEmptySecondary = isMobile && pinnedItems.length === 0 && recentItems.length === 0;

  useEffect(() => {
    if (isMobile && activeSurface === 'list') {
      setShowAllSavedViews(false);
    }
  }, [activeSurface, isMobile]);

  // Mặc định đóng expansion cho saved views
  const visibleSavedViews = useMemo(() => {
    if (showAllSavedViews) {
      return savedViews;
    }
    
    // Collapse: chỉ hiển thị 4 items trên desktop, 2 items trên mobile
    const maxVisible = isMobile ? 2 : 4;
    return savedViews.slice(0, maxVisible);
  }, [isMobile, savedViews, showAllSavedViews]);
  
  const hiddenSavedViewsCount = Math.max(0, savedViews.length - visibleSavedViews.length);
  const canToggleSavedViews = hiddenSavedViewsCount > 0;
  const savedViewsTrailing = (
    <div className="flex items-center gap-2">
      {canToggleSavedViews ? (
        <button
          type="button"
          onClick={() => setShowAllSavedViews((value) => !value)}
          className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
        >
          {showAllSavedViews ? 'Thu gọn' : `Xem thêm ${hiddenSavedViewsCount}`}
        </button>
      ) : null}
      {activeSavedViewId ? (
        <button
          type="button"
          onClick={onClearSavedView}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Bỏ chọn
        </button>
      ) : null}
    </div>
  );

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white/90 shadow-sm backdrop-blur-sm ${
        isMobile ? 'px-3 py-2' : 'px-3 py-2'
      }`}
    >
      {/* Header với nút toggle expansion */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral">
            Lối tắt đã lưu
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsQuickAccessExpanded((value) => !value)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        >
          <span className={`material-symbols-outlined transition-transform ${isQuickAccessExpanded ? 'rotate-180' : ''}`} style={{ fontSize: 16 }}>
            expand_more
          </span>
          <span className="hidden sm:inline">{isQuickAccessExpanded ? 'Thu gọn' : 'Mở rộng'}</span>
        </button>
      </div>

      {/* Content - chỉ hiển thị khi expanded */}
      {isQuickAccessExpanded ? (
      <div
        className={`mt-2 grid ${
          isMobile ? 'gap-3' : 'gap-3'
        } ${
          layoutMode === 'mobile'
            ? 'grid-cols-1'
            : layoutMode === 'tablet'
            ? 'md:grid-cols-2'
            : layoutMode === 'desktopCompact'
            ? 'xl:grid-cols-2'
            : '2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]'
        }`}
      >
        <QuickSection
          label="Lối tắt đã lưu"
          helper=""
          helperMobile=""
          className={
            layoutMode === 'tablet'
              ? 'md:col-span-2'
              : layoutMode === 'desktopCompact'
              ? 'xl:col-span-2'
              : ''
          }
          compactMobile={isMobile}
          trailing={savedViewsTrailing}
        >
          <div
            className={
              isMobile
                ? 'grid grid-cols-2 gap-2'
                : 'flex flex-wrap gap-2'
            }
          >
            {visibleSavedViews.map((view) => {
              const isActive = activeSavedViewId === view.id;
              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => onApplySavedView(view)}
                  className={`inline-flex items-center gap-1.5 border text-left font-semibold transition ${
                    isMobile
                      ? 'min-w-0 rounded px-2.5 py-1.5 text-[11px]'
                      : 'rounded px-2.5 py-1.5 text-[11px]'
                  } ${
                    isActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    {isActive ? 'bookmark_added' : 'bookmark'}
                  </span>
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate">{view.label}</span>
                    {!isMobile ? (
                      <span className="text-[10px] font-medium text-slate-400">
                        {view.subtitle}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </QuickSection>

        {compactEmptySecondary ? (
          <div className="grid grid-cols-2 gap-2">
            <CompactQuickStatus
              label="Đã ghim"
              helper="Mở lại nhanh."
              message="Chưa có ghim."
            />
            <CompactQuickStatus
              label="Gần đây"
              helper="Quay lại nhanh."
              message="Chưa có lịch sử."
            />
          </div>
        ) : (
          <>
            <QuickSection
              label="Đã ghim"
              helper="Ca quan trọng bạn muốn mở lại trong 1 click."
              helperMobile="Mở lại ca quan trọng."
              compactMobile={isMobile}
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
              helper="Lịch sử mở gần đây để quay lại nhanh khi cần."
              helperMobile="Quay lại ca vừa mở."
              compactMobile={isMobile}
            >
              {recentItems.length === 0 ? (
                isMobile ? (
                  <EmptyQuickInline message="Chưa có lịch sử mở gần đây." />
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
  helper: string;
  helperMobile?: string;
  trailing?: React.ReactNode;
  className?: string;
  compactMobile?: boolean;
  children: React.ReactNode;
}> = ({
  label,
  helper,
  helperMobile,
  trailing,
  className = '',
  compactMobile = false,
  children,
}) => (
  <div className={`space-y-2 ${className}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral">
          {label}
        </p>
        <p className={`mt-0.5 text-[11px] text-slate-400`}>
          {compactMobile ? helperMobile ?? helper : helper}
        </p>
      </div>
      {trailing}
    </div>
    {children}
  </div>
);

const QuickRequestPill: React.FC<{
  item: CustomerRequestQuickRequestItem;
  tone: 'sky' | 'amber';
  onOpen: () => void;
  trailingAction?: React.ReactNode;
  compact?: boolean;
}> = ({ item, tone, onOpen, trailingAction, compact = false }) => (
  <button
    type="button"
    onClick={onOpen}
    className={`flex w-full items-start justify-between gap-3 rounded-lg border text-left transition ${
      compact ? 'px-3 py-2' : 'px-3 py-2'
    } ${
      tone === 'amber'
        ? 'border-tertiary-fixed/50 bg-tertiary-fixed/20 hover:bg-tertiary-fixed/30'
        : 'border-secondary-fixed/40 bg-secondary-fixed/15 hover:bg-secondary-fixed/25'
    }`}
  >
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="rounded bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700">
          {item.code}
        </span>
      </div>
      <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-900">
        {item.title}
      </p>
      <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
        {item.subtitle || 'Không có mô tả bổ sung'}
      </p>
    </div>
    {trailingAction ? <div className="shrink-0">{trailingAction}</div> : null}
  </button>
);

const CompactQuickStatus: React.FC<{
  label: string;
  helper: string;
  message: string;
}> = ({ label, helper, message }) => (
  <div className="rounded-lg border border-slate-100 bg-surface-low px-3 py-2">
    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral">{label}</p>
    <p className="mt-0.5 text-[11px] text-slate-400">{helper}</p>
    <p className="mt-1.5 text-xs font-semibold text-slate-500">{message}</p>
  </div>
);

const EmptyQuickInline: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded bg-surface-low px-3 py-1.5 text-[11px] text-slate-400">{message}</div>
);

const EmptyQuickState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
    {message}
  </div>
);
