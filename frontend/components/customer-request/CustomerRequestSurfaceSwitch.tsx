import React from 'react';

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
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {SURFACE_META.map((surface) => {
        const isActive = activeSurface === surface.key;

        return (
          <button
            key={surface.key}
            type="button"
            onClick={() => onSurfaceChange(surface.key)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-left text-sm font-semibold transition ${
              isActive
                ? surface.activeClass
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{surface.icon}</span>
            <span className="flex flex-col leading-tight">
              <span>{surface.label}</span>
              <span className={`text-[10px] font-medium ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                {surface.subtitle}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};
