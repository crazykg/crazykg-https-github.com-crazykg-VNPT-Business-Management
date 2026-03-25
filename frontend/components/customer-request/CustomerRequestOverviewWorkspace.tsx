import React from 'react';
import type { YeuCauDashboardPayload } from '../../types';
import type { WorkspaceTabKey } from './CustomerRequestWorkspaceTabs';
import { CustomerRequestAttentionCard } from './CustomerRequestAttentionCard';
import { useCustomerRequestResponsiveLayout } from './hooks/useCustomerRequestResponsiveLayout';

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
};

const ROLE_CARD_META: Array<{
  key: Extract<WorkspaceTabKey, 'creator' | 'dispatcher' | 'performer'>;
  label: string;
  helper: string;
  accentSurfaceCls: string;
  accentTextCls: string;
  accentBorderCls: string;
}> = [
  {
    key: 'creator',
    label: 'Người tạo',
    helper: 'Rà soát, thông báo KH, theo dõi',
    accentSurfaceCls: 'bg-sky-50',
    accentTextCls: 'text-sky-700',
    accentBorderCls: 'border-sky-100',
  },
  {
    key: 'dispatcher',
    label: 'Điều phối',
    helper: 'Hàng chờ điều phối, chờ duyệt, PM theo dõi',
    accentSurfaceCls: 'bg-amber-50',
    accentTextCls: 'text-amber-700',
    accentBorderCls: 'border-amber-100',
  },
  {
    key: 'performer',
    label: 'Người xử lý',
    helper: 'Việc mới, đang làm, bảng giờ công',
    accentSurfaceCls: 'bg-emerald-50',
    accentTextCls: 'text-emerald-700',
    accentBorderCls: 'border-emerald-100',
  },
];

export const CustomerRequestOverviewWorkspace: React.FC<
  CustomerRequestOverviewWorkspaceProps
> = ({
  overviewDashboard,
  roleDashboards,
  onOpenRequest,
  onOpenWorkspace,
}) => (
  <ResponsiveOverviewWorkspace
    overviewDashboard={overviewDashboard}
    roleDashboards={roleDashboards}
    onOpenRequest={onOpenRequest}
    onOpenWorkspace={onOpenWorkspace}
  />
);

const ResponsiveOverviewWorkspace: React.FC<{
  overviewDashboard: YeuCauDashboardPayload | null;
  roleDashboards: Record<'creator' | 'dispatcher' | 'performer', YeuCauDashboardPayload | null>;
  onOpenRequest: (requestId: string | number, statusCode?: string | null) => void;
  onOpenWorkspace: (workspace: Extract<WorkspaceTabKey, 'creator' | 'dispatcher' | 'performer'>) => void;
}> = ({ overviewDashboard, roleDashboards, onOpenRequest, onOpenWorkspace }) => {
  const layoutMode = useCustomerRequestResponsiveLayout();
  const isDesktopWide = layoutMode === 'desktopWide';
  const isDesktopCompact = layoutMode === 'desktopCompact';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-5">
      <div
        className={`grid gap-3 ${
          layoutMode === 'mobile' || layoutMode === 'tablet' || isDesktopCompact
            ? 'grid-cols-2'
            : 'md:grid-cols-4'
        }`}
      >
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

      <div
        className={`mt-4 grid gap-4 ${
          isDesktopWide ? 'xl:grid-cols-[minmax(0,1.15fr)_360px]' : ''
        }`}
      >
        <div className="space-y-4">
          <div
            className={`grid gap-3 ${
              layoutMode === 'mobile'
                ? 'grid-cols-1'
                : layoutMode === 'tablet' || isDesktopCompact
                ? 'md:grid-cols-2'
                : 'lg:grid-cols-3'
            }`}
          >
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
                  className="cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className={`border-b px-4 py-4 ${role.accentSurfaceCls} ${role.accentBorderCls}`}>
                    <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${role.accentTextCls}`}>
                      {role.label}
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                      {dashboard?.summary.total_cases ?? 0}
                    </p>
                  </div>
                  <div className="space-y-3 px-4 py-4">
                    <p className="text-sm leading-6 text-slate-700">{role.helper}</p>
                    <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                      <div>
                        <p className="font-medium text-slate-400">Thiếu ước lượng</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {dashboard?.summary.alert_counts.missing_estimate ?? 0}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-400">Vượt ước lượng</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {dashboard?.summary.alert_counts.over_estimate ?? 0}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-400">Nguy cơ SLA</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {dashboard?.summary.alert_counts.sla_risk ?? 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-900">Ca cần chú ý ngay</p>
                <p className="mt-1 text-sm text-slate-500">
                  Nhóm ca cần PM hoặc lead mở vào xử lý trước.
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                {overviewDashboard?.attention_cases.length ?? 0} ca
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              {(overviewDashboard?.attention_cases ?? []).slice(0, 6).map((item) => {
                const requestCase = item.request_case;

                return (
                  <CustomerRequestAttentionCard
                    key={String(requestCase.id)}
                    request={requestCase}
                    reasons={item.reasons}
                    onOpenRequest={onOpenRequest}
                    layout={isDesktopWide ? 'wide' : 'stacked'}
                  />
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
};

const MetricCard: React.FC<{ label: string; value: string | number }> = ({
  label,
  value,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
      {label}
    </p>
    <p className="mt-2 text-[2rem] font-semibold leading-none tracking-tight text-slate-900">{value}</p>
  </div>
);

const SimpleRankPanel: React.FC<{
  title: string;
  items: Array<{ key: string; label: string; value: number }>;
  emptyText: string;
}> = ({ title, items, emptyText }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-5">
    <p className="text-base font-semibold text-slate-900">{title}</p>
    <div className="mt-4 space-y-2">
      {items.map((item) => (
        <div
          key={item.key}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5"
        >
          <span className="text-sm font-medium text-slate-800">{item.label}</span>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
            {item.value}
          </span>
        </div>
      ))}
      {items.length === 0 ? <EmptySmallState message={emptyText} /> : null}
    </div>
  </div>
);

const EmptySmallState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-6 text-center text-sm text-slate-400">
    {message}
  </div>
);
