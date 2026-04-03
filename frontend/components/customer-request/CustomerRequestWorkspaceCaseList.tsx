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
  <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
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
  <div className="rounded-3xl border border-white bg-white p-4 shadow-sm">
    <div>
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>

    <div className="mt-3 space-y-2.5">
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
