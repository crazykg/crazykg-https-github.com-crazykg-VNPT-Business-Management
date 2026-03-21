import React from 'react';
import type { CustomerRequestQuickAction } from './presentation';
import { STATUS_COLOR_MAP } from './presentation';

type CustomerRequestQuickActionModalProps = {
  open: boolean;
  title: string;
  eyebrow: string;
  requestCode?: string | null;
  requestSummary?: string | null;
  actions: CustomerRequestQuickAction[];
  onClose: () => void;
  onSelectAction: (action: CustomerRequestQuickAction) => void;
};

export const CustomerRequestQuickActionModal: React.FC<CustomerRequestQuickActionModalProps> = ({
  open,
  title,
  eyebrow,
  requestCode,
  requestSummary,
  actions,
  onClose,
  onSelectAction,
}) => {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{eyebrow}</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {requestCode ? `${requestCode} · ` : ''}
              {requestSummary || 'Yêu cầu hiện tại'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng popup quick action"
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="grid gap-4 px-6 py-6 md:grid-cols-2 xl:grid-cols-3">
          {actions.map((action) => {
            const statusMeta = STATUS_COLOR_MAP[action.targetStatusCode];
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => onSelectAction(action)}
                className={`group rounded-3xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${action.accentCls}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="material-symbols-outlined rounded-2xl bg-white/80 p-2 text-[22px] text-slate-700 shadow-sm">
                    {action.icon}
                  </span>
                  {statusMeta ? (
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusMeta.cls}`}>
                      {statusMeta.label}
                    </span>
                  ) : null}
                </div>
                <h4 className="mt-4 text-lg font-black text-slate-900">{action.label}</h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">{action.description}</p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  Mở form xử lý
                  <span className="material-symbols-outlined text-[18px] transition group-hover:translate-x-0.5">
                    arrow_forward
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
