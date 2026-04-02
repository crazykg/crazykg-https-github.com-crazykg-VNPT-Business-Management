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
}> = [
  {
    key: 'inbox',
    label: 'Hộp việc',
    icon: 'notifications_active',
    activeClass: 'border-primary/20 bg-primary/10 text-primary shadow-sm',
  },
  {
    key: 'list',
    label: 'Danh sách',
    icon: 'table_rows',
    activeClass: 'border-slate-300 bg-slate-100 text-slate-800 shadow-sm',
  },
  {
    key: 'analytics',
    label: 'Phân tích',
    icon: 'monitoring',
    activeClass: 'border-violet-200 bg-violet-50 text-violet-700 shadow-sm',
  },
];

export const CustomerRequestSurfaceSwitch: React.FC<CustomerRequestSurfaceSwitchProps> = ({
  activeSurface,
  onSurfaceChange,
}) => {
  const layoutMode = useCustomerRequestResponsiveLayout();
  const isMobile = layoutMode === 'mobile';

  return (
    <div className={`flex items-center gap-2 overflow-x-auto ${isMobile ? 'pb-0' : 'pb-1'}`}>
      {SURFACE_META.map((surface) => {
        const isActive = activeSurface === surface.key;

        return (
          <button
            key={surface.key}
            type="button"
            onClick={() => onSurfaceChange(surface.key)}
            className={`inline-flex shrink-0 items-center rounded-xl border text-left font-semibold transition ${
              isMobile ? 'gap-1.5 px-3 py-1.5 text-[13px]' : 'gap-2 px-3.5 py-2 text-sm'
            } ${
              isActive
                ? surface.activeClass
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span className={`material-symbols-outlined ${isMobile ? 'text-[16px]' : 'text-[18px]'}`}>
              {surface.icon}
            </span>
            <span>{surface.label}</span>
          </button>
        );
      })}
    </div>
  );
};
