import React from 'react';
import { useCustomerRequestResponsiveLayout } from './hooks/useCustomerRequestResponsiveLayout';

export type CustomerRequestSurfaceKey = 'inbox' | 'list' | 'analytics';

type CustomerRequestSurfaceSwitchProps = {
  activeSurface: CustomerRequestSurfaceKey;
  onSurfaceChange: (surface: CustomerRequestSurfaceKey) => void;
  iconOnlyOnCompact?: boolean;
};

const SURFACE_META: Array<{
  key: CustomerRequestSurfaceKey;
  label: string;
  icon: string;
  activeClass: string;
  activeIconClass: string;
}> = [
  {
    key: 'inbox',
    label: 'Bảng theo dõi',
    icon: 'notifications_active',
    activeClass:
      'border-[var(--ui-primary)] bg-[var(--ui-accent-soft)] text-[color:var(--ui-primary)] shadow-[var(--ui-shadow-shell)]',
    activeIconClass: 'bg-[var(--ui-primary)] text-white',
  },
  {
    key: 'list',
    label: 'Danh sách',
    icon: 'table_rows',
    activeClass:
      'border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] text-[color:var(--ui-text-default)] shadow-[var(--ui-shadow-shell)]',
    activeIconClass: 'bg-slate-700 text-white',
  },
  {
    key: 'analytics',
    label: 'Phân tích',
    icon: 'monitoring',
    activeClass:
      'border-[var(--ui-accent)] bg-[var(--ui-accent-soft)] text-[color:var(--ui-primary)] shadow-[var(--ui-shadow-shell)]',
    activeIconClass: 'bg-[var(--ui-accent)] text-white',
  },
];

export const CustomerRequestSurfaceSwitch: React.FC<CustomerRequestSurfaceSwitchProps> = ({
  activeSurface,
  onSurfaceChange,
  iconOnlyOnCompact = false,
}) => {
  const layoutMode = useCustomerRequestResponsiveLayout();
  const isCompact = layoutMode === 'mobile' || layoutMode === 'tablet';
  const useIconOnly = iconOnlyOnCompact && isCompact;

  return (
    <div className="grid w-full grid-cols-3 items-stretch gap-2">
      {SURFACE_META.map((surface) => {
        const isActive = activeSurface === surface.key;
        const compactButtonClass = useIconOnly
          ? 'h-11 w-full justify-center rounded-[var(--ui-control-radius)] border'
          : 'min-h-11 w-full flex-col justify-center rounded-[var(--ui-control-radius)] border px-2 py-2 text-center';
        const desktopButtonClass =
          'h-10 min-w-0 w-full gap-2 rounded-[var(--ui-control-radius)] border px-3 py-2 text-left';

        return (
          <button
            key={surface.key}
            type="button"
            aria-label={surface.label}
            aria-pressed={isActive}
            onClick={() => onSurfaceChange(surface.key)}
            className={`group inline-flex shrink-0 items-center transition-all duration-200 ${
              isCompact ? compactButtonClass : desktopButtonClass
            } ${
              isActive
                ? surface.activeClass
                : 'border-[var(--ui-border)] bg-[var(--ui-surface-bg)] text-[color:var(--ui-text-muted)] hover:border-slate-300 hover:bg-[var(--ui-surface-subtle)]'
            }`}
          >
            <span
              className={`flex shrink-0 items-center justify-center transition-colors ${
                useIconOnly ? 'h-8 w-8 rounded-[var(--ui-control-radius)]' : 'h-8 w-8 rounded-[var(--ui-control-radius)]'
              } ${
                isActive
                  ? surface.activeIconClass
                  : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {surface.icon}
              </span>
            </span>

            {useIconOnly ? (
              <span className="sr-only">{surface.label}</span>
            ) : (
              <span className={`min-w-0 flex-1 ${isCompact ? 'text-center' : ''}`}>
                <span
                  className={`block font-semibold leading-4 ${
                    isCompact ? 'text-[10px] md:text-[11px]' : 'truncate text-xs'
                  }`}
                >
                  {surface.label}
                </span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
