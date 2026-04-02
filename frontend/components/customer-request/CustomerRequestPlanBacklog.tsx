import React from 'react';
import { resolveStaticStatusMeta } from './presentation';

type BacklogCase = {
  id: number;
  request_code: string;
  summary: string | null;
  current_status_code: string | null;
  priority?: number | null;
  customer_name?: string | null;
};

const PRIORITY_META: Record<number, { label: string; cls: string }> = {
  4: { label: 'Khẩn', cls: 'bg-red-100 text-red-700' },
  3: { label: 'Cao', cls: 'bg-orange-100 text-orange-700' },
  2: { label: 'TB', cls: 'bg-blue-100 text-blue-700' },
  1: { label: 'Thấp', cls: 'bg-slate-100 text-slate-500' },
};

type CustomerRequestPlanBacklogProps = {
  items: unknown[];
  onAddToPlan: (caseId: number) => void;
  isLoading?: boolean;
};

export const CustomerRequestPlanBacklog: React.FC<CustomerRequestPlanBacklogProps> = ({
  items,
  onAddToPlan,
  isLoading = false,
}) => {
  const cases = items as BacklogCase[];

  return (
    <div className="flex flex-col gap-2">
      {/* Count header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Chưa có kế hoạch
        </p>
        {!isLoading && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            {cases.length} yêu cầu
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-8">
          <span className="material-symbols-outlined text-[32px] text-slate-300">
            task_alt
          </span>
          <p className="text-sm text-slate-400">Tất cả yêu cầu đã có kế hoạch.</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {cases.map((item) => {
            const statusCode = item.current_status_code ?? '';
            const statusMeta = resolveStaticStatusMeta(statusCode);
            const priorityMeta =
              item.priority != null ? PRIORITY_META[item.priority] : null;

            return (
              <li
                key={item.id}
                className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs font-semibold text-slate-600">
                      {item.request_code}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusMeta.cls}`}>
                      {statusMeta.label}
                    </span>
                    {priorityMeta && (
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${priorityMeta.cls}`}>
                        {priorityMeta.label}
                      </span>
                    )}
                  </div>
                  {item.summary && (
                    <p className="line-clamp-1 text-sm text-slate-700">{item.summary}</p>
                  )}
                  {item.customer_name && (
                    <p className="mt-0.5 text-xs text-slate-400">{item.customer_name}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onAddToPlan(item.id)}
                  className="flex-shrink-0 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary hover:text-white"
                  title="Thêm vào kế hoạch"
                >
                  Thêm
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
