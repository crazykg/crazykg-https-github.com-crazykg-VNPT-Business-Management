import React from 'react';
import type {
  CustomerRequestQuickRequestItem,
  CustomerRequestSavedView,
} from './customerRequestQuickAccess';

type CustomerRequestQuickAccessBarProps = {
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
  savedViews,
  activeSavedViewId,
  onApplySavedView,
  onClearSavedView,
  pinnedItems,
  recentItems,
  onOpenRequest,
  onRemovePinned,
}) => (
  <div className="rounded-3xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm backdrop-blur-sm">
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <QuickSection
        label="Lối tắt đã lưu"
        helper="Nhảy nhanh vào đúng vai trò, màn hình và bộ lọc thường dùng."
        trailing={
          activeSavedViewId ? (
            <button
              type="button"
              onClick={onClearSavedView}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Bỏ chọn
            </button>
          ) : null
        }
      >
        <div className="flex flex-wrap gap-2">
          {savedViews.map((view) => {
            const isActive = activeSavedViewId === view.id;
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => onApplySavedView(view)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-left text-sm font-semibold transition ${
                  isActive
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isActive ? 'bookmark_added' : 'bookmark'}
                </span>
                <span className="flex flex-col leading-tight">
                  <span>{view.label}</span>
                  <span className="text-[10px] font-medium text-slate-400">
                    {view.subtitle}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </QuickSection>

      <QuickSection
        label="Đã ghim"
        helper="Ca quan trọng bạn muốn mở lại trong 1 click."
      >
        {pinnedItems.length === 0 ? (
          <EmptyQuickState message="Chưa có yêu cầu nào được ghim." />
        ) : (
          <div className="space-y-2">
            {pinnedItems.slice(0, 4).map((item) => (
              <QuickRequestPill
                key={`pinned-${item.requestId}`}
                item={item}
                tone="amber"
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
      >
        {recentItems.length === 0 ? (
          <EmptyQuickState message="Chưa có lịch sử mở yêu cầu gần đây." />
        ) : (
          <div className="space-y-2">
            {recentItems.slice(0, 4).map((item) => (
              <QuickRequestPill
                key={`recent-${item.requestId}`}
                item={item}
                tone="sky"
                onOpen={() => onOpenRequest(item)}
              />
            ))}
          </div>
        )}
      </QuickSection>
    </div>
  </div>
);

const QuickSection: React.FC<{
  label: string;
  helper: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, helper, trailing, children }) => (
  <div className="space-y-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
          {label}
        </p>
        <p className="mt-1 text-xs text-slate-500">{helper}</p>
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
}> = ({ item, tone, onOpen, trailingAction }) => (
  <button
    type="button"
    onClick={onOpen}
    className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition ${
      tone === 'amber'
        ? 'border-amber-100 bg-amber-50/60 hover:bg-amber-50'
        : 'border-sky-100 bg-sky-50/60 hover:bg-sky-50'
    }`}
  >
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700">
          {item.code}
        </span>
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-semibold text-slate-900">{item.title}</p>
      <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">
        {item.subtitle || 'Không có mô tả bổ sung'}
      </p>
    </div>
    {trailingAction ? <div className="shrink-0">{trailingAction}</div> : null}
  </button>
);

const EmptyQuickState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
    {message}
  </div>
);
