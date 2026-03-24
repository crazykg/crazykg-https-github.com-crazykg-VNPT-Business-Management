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
  subtitle: string;
  icon: string;
  activeClass: string;
}> = [
  {
    key: 'inbox',
    label: 'Hộp việc',
    subtitle: 'Xử lý nhanh',
    icon: 'notifications_active',
    activeClass: 'bg-primary text-white shadow-sm shadow-primary/20',
  },
  {
    key: 'list',
    label: 'Danh sách',
    subtitle: 'Tra cứu chi tiết',
    icon: 'table_rows',
    activeClass: 'bg-slate-900 text-white shadow-sm',
  },
  {
    key: 'analytics',
    label: 'Phân tích',
    subtitle: 'Số liệu & điểm nóng',
    icon: 'monitoring',
    activeClass: 'bg-violet-600 text-white shadow-sm shadow-violet-500/20',
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
            className={`inline-flex shrink-0 items-center rounded-full text-left font-semibold transition ${
              isMobile ? 'gap-1.5 px-3 py-1.5 text-[13px]' : 'gap-2 px-3.5 py-2 text-sm'
            } ${
              isActive
                ? surface.activeClass
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className={`material-symbols-outlined ${isMobile ? 'text-[16px]' : 'text-[18px]'}`}>
              {surface.icon}
            </span>
            <span className="flex flex-col leading-tight">
              <span>{surface.label}</span>
              {!isMobile ? (
                <span className={`text-[10px] font-medium ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                  {surface.subtitle}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
};
