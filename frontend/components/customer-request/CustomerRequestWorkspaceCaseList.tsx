import React from 'react';
import type { YeuCau } from '../../types/customerRequest';
import type { CustomerRequestRoleFilter } from './presentation';
import { CustomerRequestWorkspaceCaseCard } from './CustomerRequestWorkspaceCaseCard';

type CustomerRequestWorkspaceCaseListProps = {
  title: string;
  subtitle: string;
  rows: YeuCau[];
  emptyText: string;
  onOpenRequest: (requestId: string | number, statusCode?: string | null) => void;
  requestRoleFilter?: CustomerRequestRoleFilter;
  hoverToneCls?: string;
};

const EmptySmallState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-5 text-center text-[12px] leading-5 text-slate-400">
    {message}
  </div>
);

export const CustomerRequestWorkspaceCaseList: React.FC<CustomerRequestWorkspaceCaseListProps> = ({
  title,
  subtitle,
  rows,
  emptyText,
  onOpenRequest,
  requestRoleFilter = '' as CustomerRequestRoleFilter,
  hoverToneCls,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[12px] font-semibold leading-4 text-slate-900">{title}</p>
        <p className="mt-1 text-[11px] leading-4 text-slate-500">{subtitle}</p>
      </div>
      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600">
        {rows.length}
      </span>
    </div>

    <div className="mt-3 space-y-2">
      {rows.map((row) => (
        <CustomerRequestWorkspaceCaseCard
          key={String(row.id)}
          request={row}
          onOpenRequest={onOpenRequest}
          requestRoleFilter={requestRoleFilter}
          hoverToneCls={hoverToneCls}
        />
      ))}
      {rows.length === 0 ? <EmptySmallState message={emptyText} /> : null}
    </div>
  </div>
);
