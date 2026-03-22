import React from 'react';
import type { YeuCauDashboardPayload } from '../../types';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';
import type { WorkspaceTabKey } from './CustomerRequestWorkspaceTabs';
import { resolveRequestProcessCode, resolveStatusMeta } from './presentation';

const handleCardKeyDown = (
  event: React.KeyboardEvent<HTMLElement>,
  onActivate: () => void
) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onActivate();
  }
};

type CustomerRequestOverviewWorkspaceProps = {
  loading: boolean;
  overviewDashboard: YeuCauDashboardPayload | null;
  roleDashboards: Record<'creator' | 'dispatcher' | 'performer', YeuCauDashboardPayload | null>;
  onOpenRequest: (requestId: string | number, statusCode?: string | null) => void;
  onOpenWorkspace: (workspace: Extract<WorkspaceTabKey, 'creator' | 'dispatcher' | 'performer'>) => void;
  onOpenAnalytics: () => void;
};

const ROLE_CARD_META: Array<{
  key: Extract<WorkspaceTabKey, 'creator' | 'dispatcher' | 'performer'>;
  label: string;
  helper: string;
  tone: string;
}> = [
  {
    key: 'creator',
    label: 'Người tạo',
    helper: 'Rà soát, thông báo KH, theo dõi',
    tone: 'from-sky-600 to-cyan-500',
  },
  {
    key: 'dispatcher',
    label: 'Điều phối',
    helper: 'Hàng chờ điều phối, chờ duyệt, PM theo dõi',
    tone: 'from-amber-500 to-orange-500',
  },
  {
    key: 'performer',
    label: 'Người xử lý',
    helper: 'Việc mới, đang làm, bảng giờ công',
    tone: 'from-emerald-600 to-teal-500',
  },
];

export const CustomerRequestOverviewWorkspace: React.FC<
  CustomerRequestOverviewWorkspaceProps
> = ({
  loading,
  overviewDashboard,
  roleDashboards,
  onOpenRequest,
  onOpenWorkspace,
  onOpenAnalytics,
}) => (
  <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-5">
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          Tổng quan điều hành
        </p>
      </div>
      <div className="flex items-center gap-3">
        {loading ? (
          <span className="text-xs text-slate-400">Đang cập nhật tổng quan...</span>
        ) : null}
        <button
          type="button"
          onClick={onOpenAnalytics}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <span className="material-symbols-outlined text-[16px]">monitoring</span>
          Mở Phân tích
        </button>
      </div>
    </div>

    <div className="mt-4 grid gap-3 md:grid-cols-4">
      <MetricCard
        label="Tổng yêu cầu"
        value={overviewDashboard?.summary.total_cases ?? 0}
      />
      <MetricCard
        label="Thiếu ước lượng"
        value={overviewDashboard?.summary.alert_counts.missing_estimate ?? 0}
      />
      <MetricCard
        label="Vượt ước lượng"
        value={overviewDashboard?.summary.alert_counts.over_estimate ?? 0}
      />
      <MetricCard
        label="Nguy cơ SLA"
        value={overviewDashboard?.summary.alert_counts.sla_risk ?? 0}
      />
    </div>

    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
      <div className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-3">
          {ROLE_CARD_META.map((role) => {
            const dashboard = roleDashboards[role.key];
            return (
              <div
                key={role.key}
                role="button"
                tabIndex={0}
                onClick={() => onOpenWorkspace(role.key)}
                onKeyDown={(event) =>
                  handleCardKeyDown(event, () => onOpenWorkspace(role.key))
                }
                className="cursor-pointer overflow-hidden rounded-3xl border border-white bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className={`bg-gradient-to-r px-4 py-4 text-white ${role.tone}`}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-80">
                    {role.label}
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {dashboard?.summary.total_cases ?? 0}
                  </p>
                </div>
                <div className="space-y-2 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-800">{role.helper}</p>
                  <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-500">
                    <div>
                      <p>Thiếu ước lượng</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {dashboard?.summary.alert_counts.missing_estimate ?? 0}
                      </p>
                    </div>
                    <div>
                      <p>Vượt ước lượng</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {dashboard?.summary.alert_counts.over_estimate ?? 0}
                      </p>
                    </div>
                    <div>
                      <p>Nguy cơ SLA</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {dashboard?.summary.alert_counts.sla_risk ?? 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Ca cần chú ý ngay</p>
              <p className="mt-1 text-xs text-slate-500">
                Nhóm ca cần PM hoặc lead mở vào xử lý trước.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {overviewDashboard?.attention_cases.length ?? 0} ca
            </span>
          </div>

          <div className="mt-4 space-y-2.5">
            {(overviewDashboard?.attention_cases ?? []).slice(0, 6).map((item) => {
              const requestCase = item.request_case;
              const statusMeta = resolveStatusMeta(
                requestCase.trang_thai || requestCase.current_status_code,
                requestCase.current_status_name_vi
              );

              return (
                <div
                  key={String(requestCase.id)}
                  className="relative isolate w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition hover:border-primary/25 hover:bg-primary/5"
                >
                  <button
                    type="button"
                    onClick={() =>
                      onOpenRequest(
                        requestCase.id,
                        resolveRequestProcessCode(requestCase)
                      )
                    }
                    className="absolute inset-0 z-10 cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    aria-label={`Mở chi tiết ${requestCase.ma_yc || requestCase.request_code || 'yêu cầu'}`}
                  />
                  <div className="pointer-events-none relative z-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {requestCase.ma_yc || requestCase.request_code || '--'}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.cls}`}
                    >
                      {statusMeta.label}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-slate-700">
                    {requestCase.tieu_de || requestCase.summary || '--'}
                  </span>
                  <span className="mt-1 block text-[11px] text-slate-500">
                    {[
                      requestCase.customer_name || requestCase.khach_hang_name,
                      requestCase.project_name,
                      requestCase.performer_name
                        ? `TH: ${requestCase.performer_name}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {item.reasons.length > 0 ? (
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {item.reasons.map((reason) => (
                        <span
                          key={reason}
                          className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700"
                        >
                          {reason}
                        </span>
                      ))}
                    </span>
                  ) : null}
                  <span className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-400">
                    {requestCase.updated_at
                      ? `Cập nhật: ${formatDateTimeDdMmYyyy(requestCase.updated_at).slice(0, 16)}`
                      : '--'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      Xem chi tiết
                      <span className="material-symbols-outlined text-[14px]">
                        arrow_forward
                      </span>
                    </span>
                  </span>
                  </div>
                </div>
              );
            })}

            {(overviewDashboard?.attention_cases ?? []).length === 0 ? (
              <EmptySmallState message="Chưa có ca nào cần chú ý trong overview." />
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <SimpleRankPanel
          title="Top khách hàng"
          items={(overviewDashboard?.top_customers ?? []).slice(0, 5).map((customer) => ({
            key: `${customer.customer_id}-${customer.customer_name ?? ''}`,
            label: customer.customer_name || 'Chưa xác định',
            value: customer.count,
          }))}
          emptyText="Chưa có khách hàng nổi bật."
        />
        <SimpleRankPanel
          title="Top dự án"
          items={(overviewDashboard?.top_projects ?? []).slice(0, 5).map((project) => ({
            key: `${project.project_id}-${project.project_name ?? ''}`,
            label: project.project_name || 'Chưa gắn dự án',
            value: project.count,
          }))}
          emptyText="Chưa có dự án nổi bật."
        />
        <SimpleRankPanel
          title="Top người xử lý"
          items={(overviewDashboard?.top_performers ?? []).slice(0, 5).map((performer) => ({
            key: `${performer.performer_user_id}-${performer.performer_name ?? ''}`,
            label: performer.performer_name || 'Chưa xác định',
            value: performer.count,
          }))}
          emptyText="Chưa có performer nổi bật."
        />
      </div>
    </div>
  </div>
);

const MetricCard: React.FC<{ label: string; value: string | number }> = ({
  label,
  value,
}) => (
  <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
      {label}
    </p>
    <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
  </div>
);

const SimpleRankPanel: React.FC<{
  title: string;
  items: Array<{ key: string; label: string; value: number }>;
  emptyText: string;
}> = ({ title, items, emptyText }) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-sm font-bold text-slate-900">{title}</p>
    <div className="mt-4 space-y-2">
      {items.map((item) => (
        <div
          key={item.key}
          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
        >
          <span className="text-sm font-semibold text-slate-800">{item.label}</span>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700">
            {item.value}
          </span>
        </div>
      ))}
      {items.length === 0 ? <EmptySmallState message={emptyText} /> : null}
    </div>
  </div>
);

const EmptySmallState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
    {message}
  </div>
);
