import React, { useMemo } from 'react';
import type { YeuCau, YeuCauPerformerWeeklyTimesheet } from '../../types';
import { formatDateDdMmYyyy, formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';
import { formatHoursValue, resolveStatusMeta } from './presentation';

type CustomerRequestPerformerWorkspaceProps = {
  loading: boolean;
  performerName?: string | null;
  totalRows: number;
  pendingRows: YeuCau[];
  activeRows: YeuCau[];
  timesheet: YeuCauPerformerWeeklyTimesheet | null;
  onOpenRequest: (requestId: string | number, statusCode?: string | null) => void;
};

export const CustomerRequestPerformerWorkspace: React.FC<CustomerRequestPerformerWorkspaceProps> = ({
  loading,
  performerName,
  totalRows,
  pendingRows,
  activeRows,
  timesheet,
  onOpenRequest,
}) => {
  const maxDayHours = useMemo(
    () => Math.max(1, ...(timesheet?.days ?? []).map((day) => Number(day.hours_spent ?? 0))),
    [timesheet]
  );

  return (
    <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-5">
      <div className="flex flex-col gap-3 border-b border-emerald-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">Workspace performer</p>
          <h3 className="mt-1 text-xl font-black text-slate-900">
            {performerName ? `${performerName} · ` : ''}{totalRows} yêu cầu trong phạm vi xử lý
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Gom nhanh việc mới, việc đang làm và giờ công tuần hiện tại để performer bám nhịp xử lý.
          </p>
        </div>
        {loading ? <span className="text-xs text-slate-400">Đang cập nhật workspace performer...</span> : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MetricCard label="Việc chờ xử lý" value={pendingRows.length} tone="bg-white" />
        <MetricCard label="Đang thực hiện" value={activeRows.length} tone="bg-white" />
        <MetricCard label="Giờ tuần này" value={formatHoursValue(timesheet?.total_hours ?? 0)} tone="bg-white" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-4 lg:grid-cols-2">
          <WorkspaceCaseList
            title="Việc mới / chờ xử lý"
            subtitle="Các ca performer nên mở đầu tiên để nhận việc hoặc phản hồi tiếp."
            rows={pendingRows.slice(0, 6)}
            emptyText="Chưa có yêu cầu nào đang chờ performer xử lý."
            onOpenRequest={onOpenRequest}
          />
          <WorkspaceCaseList
            title="Đang thực hiện"
            subtitle="Các ca đang ở nhánh xử lý để theo dõi tiến độ và estimate."
            rows={activeRows.slice(0, 6)}
            emptyText="Hiện chưa có yêu cầu nào ở trạng thái đang xử lý."
            onOpenRequest={onOpenRequest}
          />
        </div>

        <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Timesheet tuần</p>
              <p className="mt-1 text-xs text-slate-500">
                {(timesheet?.start_date && timesheet?.end_date)
                  ? `${formatDateDdMmYyyy(timesheet.start_date)} - ${formatDateDdMmYyyy(timesheet.end_date)}`
                  : 'Tuần hiện tại'}
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {timesheet?.worklog_count ?? 0} worklogs
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <MetricCard label="Tổng giờ" value={formatHoursValue(timesheet?.total_hours ?? 0)} tone="bg-emerald-50" compact />
            <MetricCard label="Billable" value={formatHoursValue(timesheet?.billable_hours ?? 0)} tone="bg-sky-50" compact />
            <MetricCard label="Non-bill" value={formatHoursValue(timesheet?.non_billable_hours ?? 0)} tone="bg-slate-50" compact />
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2">
            {(timesheet?.days ?? []).map((day) => {
              const ratio = Math.max(0.12, Number(day.hours_spent ?? 0) / maxDayHours);
              return (
                <div key={day.date} className="rounded-2xl border border-slate-100 bg-slate-50 px-2 py-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {formatDateDdMmYyyy(day.date).slice(0, 5)}
                  </p>
                  <div className="mx-auto mt-3 flex h-16 w-7 items-end rounded-full bg-white px-1 py-1 shadow-inner">
                    <div
                      className="w-full rounded-full bg-gradient-to-t from-emerald-500 to-cyan-400"
                      style={{ height: `${ratio * 100}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs font-bold text-slate-800">{formatHoursValue(day.hours_spent)}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Top yêu cầu tuần này</p>
            <div className="mt-2 space-y-2">
              {(timesheet?.top_cases ?? []).map((item) => {
                const statusMeta = resolveStatusMeta(item.status_code, item.status_name_vi);
                return (
                  <button
                    key={String(item.request_case_id)}
                    type="button"
                    onClick={() => onOpenRequest(item.request_case_id, item.status_code)}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-slate-900">{item.request_code || '--'}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.cls}`}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{item.summary || '--'}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {[item.customer_name, item.project_name].filter(Boolean).join(' · ')}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-600">
                      {formatHoursValue(item.hours_spent)} · {item.entry_count} worklogs
                    </p>
                  </button>
                );
              })}
              {(timesheet?.top_cases ?? []).length === 0 ? (
                <EmptySmallState message="Chưa có worklog nào trong tuần để tổng hợp theo yêu cầu." />
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Cập nhật gần đây</p>
            <div className="mt-2 space-y-2">
              {(timesheet?.recent_entries ?? []).slice(0, 4).map((entry) => (
                <button
                  key={String(entry.id)}
                  type="button"
                  onClick={() => onOpenRequest(entry.request_case_id ?? entry.id, entry.current_status_code)}
                  className="w-full rounded-2xl border border-slate-100 bg-white px-3 py-3 text-left transition hover:border-slate-200 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900">{entry.request_code || '--'}</span>
                    <span className="text-xs font-bold text-slate-600">{formatHoursValue(entry.hours_spent)}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-slate-600">{entry.work_content || 'Không có nội dung worklog.'}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {[entry.project_name, entry.worked_on ? formatDateDdMmYyyy(entry.worked_on) : null, entry.created_at ? formatDateTimeDdMmYyyy(entry.created_at).slice(11, 16) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </button>
              ))}
              {(timesheet?.recent_entries ?? []).length === 0 ? (
                <EmptySmallState message="Tuần này chưa có cập nhật worklog nào của performer." />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const WorkspaceCaseList: React.FC<{
  title: string;
  subtitle: string;
  rows: YeuCau[];
  emptyText: string;
  onOpenRequest: (requestId: string | number, statusCode?: string | null) => void;
}> = ({ title, subtitle, rows, emptyText, onOpenRequest }) => (
  <div className="rounded-3xl border border-white bg-white p-4 shadow-sm">
    <div>
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>

    <div className="mt-3 space-y-2">
      {rows.map((row) => {
        const statusMeta = resolveStatusMeta(row.trang_thai, row.current_status_name_vi);
        return (
          <button
            key={String(row.id)}
            type="button"
            onClick={() => onOpenRequest(row.id, row.tien_trinh_hien_tai || row.trang_thai)}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50/30"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-slate-900">{row.ma_yc || row.request_code || '--'}</span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.cls}`}>
                {statusMeta.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-700">{row.tieu_de || row.summary || '--'}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {[row.khach_hang_name || row.customer_name, row.project_name].filter(Boolean).join(' · ')}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {row.updated_at ? `Cập nhật ${formatDateTimeDdMmYyyy(row.updated_at).slice(0, 16)}` : 'Chưa có thời gian cập nhật'}
            </p>
          </button>
        );
      })}
      {rows.length === 0 ? <EmptySmallState message={emptyText} /> : null}
    </div>
  </div>
);

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  tone: string;
  compact?: boolean;
}> = ({ label, value, tone, compact = false }) => (
  <div className={`rounded-2xl border border-slate-100 px-3 py-3 ${tone}`}>
    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
    <p className={`mt-1 font-black text-slate-900 ${compact ? 'text-lg' : 'text-2xl'}`}>{value}</p>
  </div>
);

const EmptySmallState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
    {message}
  </div>
);
