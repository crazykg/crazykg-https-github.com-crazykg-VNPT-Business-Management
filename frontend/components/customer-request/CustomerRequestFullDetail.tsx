import React from 'react';
import type { CRCFullDetail } from '../../types';
import { STATUS_COLOR_MAP } from './presentation';

type CustomerRequestFullDetailProps = {
  detail: CRCFullDetail | null;
  isLoading?: boolean;
  onClose?: () => void;
};

const SkeletonLine: React.FC<{ width?: string }> = ({ width = 'w-full' }) => (
  <div className={`h-4 animate-pulse rounded bg-slate-200 ${width}`} />
);

export const CustomerRequestFullDetail: React.FC<CustomerRequestFullDetailProps> = ({
  detail,
  isLoading = false,
  onClose,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <SkeletonLine width="w-1/3" />
        <SkeletonLine width="w-2/3" />
        <SkeletonLine />
        <SkeletonLine width="w-3/4" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-slate-400">
        Không có dữ liệu chi tiết.
      </div>
    );
  }

  const rc = detail.request_case as Record<string, unknown>;
  const requestCode = String(rc.request_code ?? '');
  const summary = String(rc.summary ?? '');
  const priority = rc.priority != null ? Number(rc.priority) : null;
  const currentStatusCode = String(rc.current_status_code ?? '');
  const statusMeta = STATUS_COLOR_MAP[currentStatusCode] ?? { label: currentStatusCode, cls: 'bg-slate-100 text-slate-600' };

  const people = (detail.people as unknown[]) ?? [];
  const timeline = (detail.timeline as unknown[]) ?? [];
  const worklogs = (detail.worklog_summary as unknown[]) ?? [];
  const estimates = (detail.estimates as unknown[]) ?? [];
  const refTasks = (detail.ref_tasks as unknown[]) ?? [];
  const attachments = (detail.attachments as unknown[]) ?? [];

  const priorityMeta: Record<number, { label: string; cls: string }> = {
    4: { label: 'Khẩn', cls: 'bg-red-100 text-red-700' },
    3: { label: 'Cao', cls: 'bg-orange-100 text-orange-700' },
    2: { label: 'Trung bình', cls: 'bg-blue-100 text-blue-700' },
    1: { label: 'Thấp', cls: 'bg-slate-100 text-slate-500' },
  };

  const resolveRole = (roleKey: string) => {
    const found = people.find((p) => {
      const pr = p as Record<string, unknown>;
      return pr.role_key === roleKey || pr.role === roleKey;
    }) as Record<string, unknown> | undefined;
    return found ?? null;
  };

  const creator = resolveRole('creator') ?? resolveRole('receiver');
  const dispatcher = resolveRole('dispatcher');
  const performer = resolveRole('performer');

  const renderPersonCard = (label: string, person: Record<string, unknown> | null) => (
    <div className="flex flex-1 flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      {person ? (
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {String(person.full_name ?? person.name ?? '?')[0]?.toUpperCase() ?? '?'}
          </span>
          <div>
            <p className="text-sm font-medium text-slate-800">
              {String(person.full_name ?? person.name ?? '—')}
            </p>
            <p className="text-xs text-slate-400">
              {String(person.employee_code ?? person.code ?? '')}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400">Chưa có</p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
            {requestCode}
          </span>
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusMeta.cls}`}>
            {statusMeta.label}
          </span>
          {priority !== null && priorityMeta[priority] && (
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${priorityMeta[priority].cls}`}>
              {priorityMeta[priority].label}
            </span>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        )}
      </div>

      {summary && <p className="text-sm font-medium text-slate-800">{summary}</p>}

      {/* Customer + Project */}
      <div className="flex flex-wrap gap-3 text-sm text-slate-600">
        {rc.customer_name && (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-slate-400">business</span>
            {String(rc.customer_name)}
          </span>
        )}
        {rc.project_name && (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-slate-400">folder</span>
            {String(rc.project_name)}
          </span>
        )}
      </div>

      {/* Role cards */}
      <div className="flex gap-2">
        {renderPersonCard('Tiếp nhận', creator)}
        {renderPersonCard('Điều phối', dispatcher)}
        {renderPersonCard('Thực hiện', performer)}
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Lịch sử xử lý
          </p>
          <ol className="space-y-2 border-l border-slate-200 pl-4">
            {timeline.map((entry, idx) => {
              const e = entry as Record<string, unknown>;
              const code = String(e.to_status_code ?? e.status_code ?? '');
              const meta = STATUS_COLOR_MAP[code] ?? { label: code, cls: 'bg-slate-100 text-slate-600' };
              return (
                <li key={idx} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-300" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${meta.cls}`}>
                      {meta.label}
                    </span>
                    <span className="text-xs text-slate-400">
                      {String(e.entered_at ?? e.created_at ?? '')}
                    </span>
                    {e.changed_by_name && (
                      <span className="text-xs text-slate-500">{String(e.changed_by_name)}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Hours breakdown */}
      {worklogs.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Giờ công theo người thực hiện
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-400">
                <th className="pb-1 text-left font-medium">Người thực hiện</th>
                <th className="pb-1 text-right font-medium">Tổng giờ</th>
                <th className="pb-1 text-right font-medium">Số lần ghi</th>
              </tr>
            </thead>
            <tbody>
              {worklogs.map((wl, idx) => {
                const w = wl as Record<string, unknown>;
                return (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-1 text-slate-700">{String(w.performer_name ?? w.name ?? '—')}</td>
                    <td className="py-1 text-right text-slate-700">{String(w.total_hours ?? 0)}h</td>
                    <td className="py-1 text-right text-slate-400">{String(w.entry_count ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Estimates */}
      {estimates.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Ước tính
          </p>
          <ul className="space-y-1">
            {estimates.map((est, idx) => {
              const e = est as Record<string, unknown>;
              return (
                <li key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    {String(e.estimator_name ?? e.estimated_by_name ?? '—')}
                  </span>
                  <span className="font-medium text-slate-800">{String(e.estimated_hours ?? 0)}h</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Ref tasks */}
      {refTasks.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Tác vụ liên quan
          </p>
          <ul className="space-y-1">
            {refTasks.map((t, idx) => {
              const task = t as Record<string, unknown>;
              const link = task.task_link ? String(task.task_link) : null;
              return (
                <li key={idx} className="flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-[15px] text-slate-400">task</span>
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {String(task.task_code ?? link)}
                    </a>
                  ) : (
                    <span className="text-slate-700">{String(task.task_code ?? '—')}</span>
                  )}
                  {task.task_status && (
                    <span className="text-xs text-slate-400">{String(task.task_status)}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Tệp đính kèm ({attachments.length})
          </p>
          <ul className="space-y-1">
            {attachments.map((a, idx) => {
              const att = a as Record<string, unknown>;
              return (
                <li key={idx} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="material-symbols-outlined text-[15px] text-slate-400">
                    attach_file
                  </span>
                  {String(att.file_name ?? att.name ?? `Tệp ${idx + 1}`)}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
