import React from 'react';
import type { YeuCau, YeuCauDashboardPayload } from '../../types';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';
import {
  formatHoursValue,
  resolveRequestProcessCode,
  resolveStatusMeta,
  resolveWarningMeta,
} from './presentation';
import type { DispatcherTeamLoadRow } from './dispatcherWorkspace';

const handleCardKeyDown = (
  event: React.KeyboardEvent<HTMLElement>,
  onActivate: () => void
) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onActivate();
  }
};

type CustomerRequestDispatcherWorkspaceProps = {
  loading: boolean;
  dispatcherName?: string | null;
  totalRows: number;
  queueRows: YeuCau[];
  returnedRows: YeuCau[];
  feedbackRows: YeuCau[];
  approvalRows: YeuCau[];
  activeRows: YeuCau[];
  teamLoadRows: DispatcherTeamLoadRow[];
  pmWatchRows: YeuCau[];
  dashboard: YeuCauDashboardPayload | null;
  onOpenRequest: (requestId: string | number, statusCode?: string | null) => void;
};

export const CustomerRequestDispatcherWorkspace: React.FC<CustomerRequestDispatcherWorkspaceProps> = ({
  loading,
  dispatcherName,
  totalRows,
  queueRows,
  returnedRows,
  feedbackRows,
  approvalRows,
  activeRows,
  teamLoadRows,
  pmWatchRows,
  dashboard,
  onOpenRequest,
}) => {
  return (
    <div className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5">
      <div className="flex flex-col gap-3 border-b border-amber-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Khu vực điều phối</p>
          <h3 className="mt-1 text-xl font-black text-slate-900">
            {dispatcherName ? `${dispatcherName} · ` : ''}{totalRows} yêu cầu trong phạm vi điều phối
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Tập trung các ca chờ phân công, ca trả lại và tình trạng tải của đội ngũ xử lý.
          </p>
        </div>
        {loading ? <span className="text-xs text-slate-400">Đang cập nhật khu vực điều phối...</span> : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <MetricCard label="Chờ phân công" value={queueRows.length} tone="bg-white" />
        <MetricCard label="Trả lại QL" value={returnedRows.length} tone="bg-white" />
        <MetricCard label="Chờ duyệt KQ" value={approvalRows.length} tone="bg-white" />
        <MetricCard label="Đợi phản hồi KH" value={feedbackRows.length} tone="bg-white" />
        <MetricCard label="Đang theo dõi" value={activeRows.length} tone="bg-white" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_380px]">
        <div className="grid gap-4 lg:grid-cols-2">
          <WorkspaceCaseList
            title="Hàng chờ phân công"
            subtitle="Ca chưa gán performer hoặc vừa quay lại nhánh cần điều phối."
            rows={queueRows.slice(0, 6)}
            emptyText="Không có ca nào đang chờ phân công."
            onOpenRequest={onOpenRequest}
          />
          <WorkspaceCaseList
            title="Ca chuyển trả"
            subtitle="Các yêu cầu performer trả lại cần rà lại hướng xử lý hoặc phân công mới."
            rows={returnedRows.slice(0, 6)}
            emptyText="Không có ca nào bị chuyển trả."
            onOpenRequest={onOpenRequest}
          />
          <WorkspaceCaseList
            title="Đợi phản hồi khách hàng"
            subtitle="Những ca cần theo dõi phản hồi KH để mở lại nhịp xử lý."
            rows={feedbackRows.slice(0, 6)}
            emptyText="Không có ca nào đang chờ phản hồi KH."
            onOpenRequest={onOpenRequest}
          />
          <WorkspaceCaseList
            title="Chờ duyệt kết quả"
            subtitle="Các ca đã hoàn thành nghiệp vụ và PM có thể mở vào để duyệt, rồi báo KH."
            rows={approvalRows.slice(0, 6)}
            emptyText="Không có ca nào đang chờ duyệt kết quả."
            onOpenRequest={onOpenRequest}
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-amber-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">Tải đội ngũ</p>
                <p className="mt-1 text-xs text-slate-500">Tính trực tiếp từ các ca dispatcher đang quản để PM thấy tải hiện hành.</p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                {teamLoadRows.length} performer
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {teamLoadRows.slice(0, 6).map((performer) => {
                const toneCls =
                  performer.load_pct >= 90
                    ? 'bg-rose-500'
                    : performer.load_pct >= 70
                    ? 'bg-amber-500'
                    : 'bg-emerald-500';

                return (
                  <div
                    key={`${performer.performer_user_id}-${performer.performer_name}`}
                    className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{performer.performer_name}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {performer.active_count} ca · {formatHoursValue(performer.total_hours_spent)}
                          {performer.estimated_hours != null ? ` / ${formatHoursValue(performer.estimated_hours)}` : ' / --'}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700">
                        {performer.load_pct}%
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full rounded-full ${toneCls}`} style={{ width: `${Math.max(8, performer.load_pct)}%` }} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {performer.missing_estimate_count > 0 ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                          Thiếu ước lượng {performer.missing_estimate_count}
                        </span>
                      ) : null}
                      {performer.over_estimate_count > 0 ? (
                        <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                          Vượt ước lượng {performer.over_estimate_count}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {teamLoadRows.length === 0 ? (
                <EmptySmallState message="Chưa có dữ liệu tải performer trong phạm vi điều phối." />
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-amber-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-900">Ca PM cần chốt ước lượng / nhật ký công việc</p>
            <p className="mt-1 text-xs text-slate-500">
              Ưu tiên những ca thiếu ước lượng, vượt ước lượng hoặc bị người xử lý trả lại để PM can thiệp sớm.
            </p>
            <div className="mt-4 space-y-2">
              {pmWatchRows.slice(0, 5).map((row) => {
                const warningMeta = resolveWarningMeta(row.warning_level);
                const statusMeta = resolveStatusMeta(row.trang_thai || row.current_status_code, row.current_status_name_vi);
                return (
                  <div
                    key={String(row.id)}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenRequest(row.id, resolveRequestProcessCode(row))}
                    onKeyDown={(event) =>
                      handleCardKeyDown(event, () =>
                        onOpenRequest(row.id, resolveRequestProcessCode(row))
                      )
                    }
                    className="w-full cursor-pointer rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-left transition hover:border-amber-200 hover:bg-amber-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-slate-900">{row.ma_yc || row.request_code || '--'}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.cls}`}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{row.tieu_de || row.summary || '--'}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {[row.performer_name ? `TH: ${row.performer_name}` : null, row.project_name].filter(Boolean).join(' · ')}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {row.missing_estimate ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                          Thiếu ước lượng
                        </span>
                      ) : null}
                      {row.over_estimate ? (
                        <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                          Vượt ước lượng
                        </span>
                      ) : null}
                      {warningMeta ? (
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${warningMeta.cls}`}>
                          {warningMeta.label}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {pmWatchRows.length === 0 ? (
                <EmptySmallState message="Hiện chưa có ca nào PM cần chốt ước lượng hoặc nhật ký công việc ngay." />
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-amber-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-900">Điểm nóng điều phối</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <MetricCard
                label="Thiếu ước lượng"
                value={dashboard?.summary.alert_counts.missing_estimate ?? 0}
                tone="bg-slate-50"
                compact
              />
              <MetricCard
                label="Vượt ước lượng"
                value={dashboard?.summary.alert_counts.over_estimate ?? 0}
                tone="bg-rose-50"
                compact
              />
              <MetricCard
                label="Nguy cơ SLA"
                value={dashboard?.summary.alert_counts.sla_risk ?? 0}
                tone="bg-amber-50"
                compact
              />
            </div>

            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Ca cần bám sát</p>
              <div className="mt-2 space-y-2">
                {(dashboard?.attention_cases ?? []).slice(0, 4).map((item) => {
                  const requestCase = item.request_case;
                  const statusMeta = resolveStatusMeta(
                    requestCase.trang_thai || requestCase.current_status_code,
                    requestCase.current_status_name_vi
                  );

                  return (
                    <div
                      key={String(requestCase.id)}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        onOpenRequest(
                          requestCase.id,
                          resolveRequestProcessCode(requestCase)
                        )
                      }
                      onKeyDown={(event) =>
                        handleCardKeyDown(event, () =>
                          onOpenRequest(
                            requestCase.id,
                            resolveRequestProcessCode(requestCase)
                          )
                        )
                      }
                      className="w-full cursor-pointer rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-left transition hover:border-amber-200 hover:bg-amber-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-slate-900">{requestCase.ma_yc || requestCase.request_code || '--'}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.cls}`}>
                          {statusMeta.label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">{requestCase.tieu_de || requestCase.summary || '--'}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {[requestCase.performer_name ? `TH: ${requestCase.performer_name}` : null, requestCase.project_name]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {item.reasons.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.reasons.map((reason) => (
                            <span key={reason} className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                              {reason}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {(dashboard?.attention_cases ?? []).length === 0 ? (
                  <EmptySmallState message="Hiện chưa có ca điều phối nào cần chú ý đặc biệt." />
                ) : null}
              </div>
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
          <div
            key={String(row.id)}
            role="button"
            tabIndex={0}
            onClick={() => onOpenRequest(row.id, resolveRequestProcessCode(row))}
            onKeyDown={(event) =>
              handleCardKeyDown(event, () =>
                onOpenRequest(row.id, resolveRequestProcessCode(row))
              )
            }
            className="w-full cursor-pointer rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-left transition hover:border-amber-200 hover:bg-amber-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-slate-900">{row.ma_yc || row.request_code || '--'}</span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.cls}`}>
                {statusMeta.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-700">{row.tieu_de || row.summary || '--'}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {[row.khach_hang_name || row.customer_name, row.performer_name ? `TH: ${row.performer_name}` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {row.updated_at ? `Cập nhật ${formatDateTimeDdMmYyyy(row.updated_at).slice(0, 16)}` : 'Chưa có thời gian cập nhật'}
            </p>
          </div>
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
