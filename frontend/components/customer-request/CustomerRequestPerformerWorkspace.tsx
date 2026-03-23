import React, { useMemo } from 'react';
import type { YeuCau, YeuCauPerformerWeeklyTimesheet } from '../../types';
import { formatDateDdMmYyyy, formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';
import { formatHoursValue } from './presentation';
import { CustomerRequestWorkspaceCaseList } from './CustomerRequestWorkspaceCaseList';
import { CustomerRequestWorkspaceCaseCard } from './CustomerRequestWorkspaceCaseCard';

const handleCardKeyDown = (
  event: React.KeyboardEvent<HTMLElement>,
  onActivate: () => void
) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onActivate();
  }
};

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
          <h3 className="mt-1 text-xl font-black text-slate-900">
            {performerName ? `${performerName} · ` : ''}{totalRows} yêu cầu trong phạm vi xử lý
          </h3>
        </div>
        {loading ? <span className="text-xs text-slate-400">Đang cập nhật khu vực người xử lý...</span> : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MetricCard label="Việc chờ xử lý" value={pendingRows.length} tone="bg-white" />
        <MetricCard label="Đang thực hiện" value={activeRows.length} tone="bg-white" />
        <MetricCard label="Giờ tuần này" value={formatHoursValue(timesheet?.total_hours ?? 0)} tone="bg-white" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-4 lg:grid-cols-2">
          <CustomerRequestWorkspaceCaseList
            title="Việc mới / chờ xử lý"
            subtitle="Các ca performer nên mở đầu tiên để nhận việc hoặc phản hồi tiếp."
            rows={pendingRows.slice(0, 6)}
            emptyText="Chưa có yêu cầu nào đang chờ performer xử lý."
            onOpenRequest={onOpenRequest}
            requestRoleFilter="performer"
            hoverToneCls="hover:border-emerald-200 hover:bg-emerald-50/40"
          />
          <CustomerRequestWorkspaceCaseList
            title="Đang thực hiện"
            subtitle="Các ca đang ở nhánh xử lý để theo dõi tiến độ và ước lượng."
            rows={activeRows.slice(0, 6)}
            emptyText="Hiện chưa có yêu cầu nào ở trạng thái đang xử lý."
            onOpenRequest={onOpenRequest}
            requestRoleFilter="performer"
            hoverToneCls="hover:border-emerald-200 hover:bg-emerald-50/40"
          />
        </div>

        <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Bảng giờ công tuần</p>
              <p className="mt-1 text-xs text-slate-500">
                {(timesheet?.start_date && timesheet?.end_date)
                  ? `${formatDateDdMmYyyy(timesheet.start_date)} - ${formatDateDdMmYyyy(timesheet.end_date)}`
                  : 'Tuần hiện tại'}
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {timesheet?.worklog_count ?? 0} nhật ký công việc
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
              {(timesheet?.top_cases ?? []).map((item) => (
                <CustomerRequestWorkspaceCaseCard
                  key={String(item.request_case_id)}
                  request={{
                    id: item.request_case_id,
                    ma_yc: item.request_code || undefined,
                    request_code: item.request_code || undefined,
                    tieu_de: item.summary || undefined,
                    summary: item.summary || undefined,
                    khach_hang_name: item.customer_name || undefined,
                    customer_name: item.customer_name || undefined,
                    project_name: item.project_name || undefined,
                    trang_thai: item.status_code || undefined,
                    current_status_code: item.status_code || undefined,
                    current_status_name_vi: item.status_name_vi || undefined,
                    performer_name: performerName || undefined,
                    total_hours_spent: item.hours_spent,
                    updated_at: item.last_worked_at || undefined,
                  } as YeuCau}
                  onOpenRequest={onOpenRequest}
                  requestRoleFilter="performer"
                  hoverToneCls="hover:border-emerald-200 hover:bg-emerald-50/40"
                  metaItems={[
                    {
                      label: 'Giờ tuần',
                      value: formatHoursValue(item.hours_spent),
                      hint: 'Tổng giờ performer ghi nhận cho yêu cầu trong tuần này',
                      valueCls: 'text-emerald-700',
                    },
                    {
                      label: 'Nhật ký',
                      value: `${item.entry_count} mục`,
                      hint: 'Số nhật ký công việc được ghi trong tuần này',
                    },
                    {
                      label: 'Phụ trách',
                      value: performerName || 'Bạn',
                      hint: 'Người xử lý đang bám ca này',
                    },
                    {
                      label: 'Tiếp theo',
                      value: 'Cập nhật tiến độ',
                      hint: 'Mở ca để ghi worklog và cập nhật xử lý',
                      valueCls: 'text-amber-700',
                    },
                  ]}
                  updatedLabel={
                    item.last_worked_at
                      ? formatDateTimeDdMmYyyy(item.last_worked_at).slice(0, 16)
                      : 'Chưa có lần làm gần nhất'
                  }
                />
              ))}
              {(timesheet?.top_cases ?? []).length === 0 ? (
                <EmptySmallState message="Chưa có worklog nào trong tuần để tổng hợp theo yêu cầu." />
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Cập nhật gần đây</p>
            <div className="mt-2 space-y-2">
              {(timesheet?.recent_entries ?? []).slice(0, 4).map((entry) => (
                <div
                  key={String(entry.id)}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenRequest(entry.request_case_id ?? entry.id, entry.current_status_code)}
                  onKeyDown={(event) =>
                    handleCardKeyDown(event, () =>
                      onOpenRequest(entry.request_case_id ?? entry.id, entry.current_status_code)
                    )
                  }
                  className="w-full cursor-pointer rounded-2xl border border-slate-100 bg-white px-3 py-3 text-left transition hover:border-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
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
                </div>
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
