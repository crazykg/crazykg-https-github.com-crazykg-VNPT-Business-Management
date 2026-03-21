import React from 'react';
import type { YeuCauSearchItem } from '../../types';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';
import { resolveStatusMeta } from './presentation';

type CustomerRequestSearchBoxProps = {
  value: string;
  onChange: (value: string) => void;
  results: YeuCauSearchItem[];
  error: string;
  loading: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: YeuCauSearchItem) => void;
};

export const CustomerRequestSearchBox: React.FC<CustomerRequestSearchBoxProps> = ({
  value,
  onChange,
  results,
  error,
  loading,
  open,
  onOpenChange,
  onSelect,
}) => {
  return (
    <div className="relative w-full sm:w-[360px]">
      <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[18px] text-slate-400">
        travel_explore
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          onOpenChange(true);
        }}
        onFocus={() => onOpenChange(true)}
        onBlur={() => {
          window.setTimeout(() => onOpenChange(false), 120);
        }}
        placeholder="Mở nhanh theo mã YC, tiêu đề, KH..."
        className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {value.trim().length < 2 ? (
            <p className="px-4 py-3 text-sm text-slate-400">Nhập ít nhất 2 ký tự để tra cứu nhanh yêu cầu.</p>
          ) : loading ? (
            <p className="px-4 py-3 text-sm text-slate-400">Đang tìm yêu cầu...</p>
          ) : error ? (
            <p className="px-4 py-3 text-sm text-rose-600">{error}</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">Không tìm thấy yêu cầu phù hợp.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto py-2">
              {results.map((item) => {
                const statusMeta = resolveStatusMeta(item.current_status_code, item.current_status_name_vi);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onSelect(item)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {item.request_code || '--'}
                        <span className="ml-2 font-normal text-slate-500">{item.summary || item.label || '--'}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {[item.customer_name, item.project_name].filter(Boolean).join(' · ')}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {[
                          item.dispatcher_name ? `Điều phối: ${item.dispatcher_name}` : null,
                          item.performer_name ? `Thực hiện: ${item.performer_name}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.cls}`}>
                        {statusMeta.label}
                      </span>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {item.updated_at ? formatDateTimeDdMmYyyy(item.updated_at)?.slice(0, 16) : '--'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
