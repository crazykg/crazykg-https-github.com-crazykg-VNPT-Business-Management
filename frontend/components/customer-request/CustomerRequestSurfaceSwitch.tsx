import React from 'react';
import { useCustomerRequestResponsiveLayout } from './hooks/useCustomerRequestResponsiveLayout';

export type CustomerRequestSurfaceKey = 'inbox' | 'list' | 'analytics';

type CustomerRequestSurfaceSwitchProps = {
  activeSurface: CustomerRequestSurfaceKey;
  onSurfaceChange: (surface: CustomerRequestSurfaceKey) => void;
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
      'border-primary/25 bg-[linear-gradient(135deg,rgba(0,68,129,0.08),rgba(0,91,170,0.16))] text-primary shadow-sm shadow-primary/10',
    activeIconClass: 'bg-primary text-white',
  },
  {
    key: 'list',
    label: 'Danh sách',
    icon: 'table_rows',
    activeClass:
      'border-slate-300 bg-[linear-gradient(135deg,rgba(241,245,249,0.96),rgba(255,255,255,1))] text-slate-800 shadow-sm',
    activeIconClass: 'bg-slate-700 text-white',
  },
  {
    key: 'analytics',
    label: 'Phân tích',
    icon: 'monitoring',
    activeClass:
      'border-violet-200 bg-[linear-gradient(135deg,rgba(245,243,255,1),rgba(237,233,254,0.72))] text-violet-700 shadow-sm shadow-violet-100',
    activeIconClass: 'bg-violet-600 text-white',
  },
];

export const CustomerRequestSurfaceSwitch: React.FC<CustomerRequestSurfaceSwitchProps> = ({
  activeSurface,
  onSurfaceChange,
}) => {
  const layoutMode = useCustomerRequestResponsiveLayout();
  const isMobile = layoutMode === 'mobile';

  return (
    <div className={`grid gap-2 ${isMobile ? 'grid-cols-3' : 'grid-cols-3'}`}>
      {SURFACE_META.map((surface) => {
        const isActive = activeSurface === surface.key;

        return (
          <button
            key={surface.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSurfaceChange(surface.key)}
            className={`group flex min-w-0 items-center text-left transition-all duration-200 ${
              isMobile
                ? 'justify-center rounded-2xl border px-2 py-2'
                : 'rounded-2xl border px-2.5 py-2.5'
            } ${
              isActive
                ? surface.activeClass
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span
              className={`flex shrink-0 items-center justify-center rounded-xl transition-colors ${
                isMobile ? 'h-8 w-8' : 'mr-2.5 h-8 w-8'
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

            {!isMobile ? (
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold leading-4">
                  {surface.label}
                </span>
              </span>
            ) : (
              <span className="sr-only">{surface.label}</span>
            )}

            {isMobile ? (
              <span className="ml-1 min-w-0 truncate text-[11px] font-semibold leading-4">
                {surface.label}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};
