import React from 'react';
import type { YeuCauDashboardPayload } from '../../types/customerRequest';
import type { WorkspaceTabKey } from './CustomerRequestWorkspaceTabs';
import { CustomerRequestAttentionCard } from './CustomerRequestAttentionCard';
import { useCustomerRequestResponsiveLayout } from './hooks/useCustomerRequestResponsiveLayout';

type CustomerRequestOverviewWorkspaceProps = {
  loading: boolean;
  overviewDashboard: YeuCauDashboardPayload | null;
  roleDashboards: Record<'creator' | 'dispatcher' | 'performer', YeuCauDashboardPayload | null>;
  onOpenRequest: (requestId: string | number, statusCode?: string | null) => void;
  onOpenWorkspace: (workspace: Extract<WorkspaceTabKey, 'creator' | 'dispatcher' | 'performer'>) => void;
  onOpenListSurface: () => void;
};

const ROLE_CARD_META: Array<{
  key: Extract<WorkspaceTabKey, 'creator' | 'dispatcher' | 'performer'>;
  label: string;
  helper: string;
  icon: string;
  accentSurfaceCls: string;
  accentTextCls: string;
  accentBorderCls: string;
}> = [
  {
    key: 'creator',
    label: 'Người tạo',
    helper: 'Đánh giá phản hồi, báo khách hàng, bám follow-up.',
    icon: 'person_add',
    accentSurfaceCls: 'bg-sky-50',
    accentTextCls: 'text-sky-700',
    accentBorderCls: 'border-sky-100',
  },
  {
    key: 'dispatcher',
    label: 'Điều phối',
    helper: 'Phân công, duyệt kết quả, nhìn tải PM và performer.',
    icon: 'manage_accounts',
    accentSurfaceCls: 'bg-amber-50',
    accentTextCls: 'text-amber-700',
    accentBorderCls: 'border-amber-100',
  },
  {
    key: 'performer',
    label: 'Người xử lý',
    helper: 'Việc mới, tiến độ đang chạy, nhịp worklog trong tuần.',
    icon: 'engineering',
    accentSurfaceCls: 'bg-emerald-50',
    accentTextCls: 'text-emerald-700',
    accentBorderCls: 'border-emerald-100',
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
  onOpenListSurface,
}) => (
  <ResponsiveOverviewWorkspace
    loading={loading}
    overviewDashboard={overviewDashboard}
    roleDashboards={roleDashboards}
    onOpenRequest={onOpenRequest}
    onOpenWorkspace={onOpenWorkspace}
    onOpenListSurface={onOpenListSurface}
  />
);

const ResponsiveOverviewWorkspace: React.FC<{
  loading: boolean;
  overviewDashboard: YeuCauDashboardPayload | null;
  roleDashboards: Record<'creator' | 'dispatcher' | 'performer', YeuCauDashboardPayload | null>;
  onOpenRequest: (requestId: string | number, statusCode?: string | null) => void;
  onOpenWorkspace: (workspace: Extract<WorkspaceTabKey, 'creator' | 'dispatcher' | 'performer'>) => void;
  onOpenListSurface: () => void;
}> = ({
  loading,
  overviewDashboard,
  roleDashboards,
  onOpenRequest,
  onOpenWorkspace,
  onOpenListSurface,
}) => {
  const layoutMode = useCustomerRequestResponsiveLayout();
  const isDesktopWide = layoutMode === 'desktopWide';
  const alertCounts = overviewDashboard?.summary.alert_counts;
  const attentionCount = overviewDashboard?.attention_cases.length ?? 0;

  return (
    <div className="rounded-[var(--ui-shell-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] p-3 text-[color:var(--ui-text-default)] shadow-[var(--ui-shadow-shell)]">
      <div className="rounded-[var(--ui-shell-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-semibold text-[color:var(--ui-text-default)]">
          <InlineKpiChip
            label="Ca nóng"
            value={attentionCount}
            tone="border-amber-300 bg-amber-50 text-amber-900"
          />
          <InlineKpiChip
            label="Thiếu ước lượng"
            value={alertCounts?.missing_estimate ?? 0}
            tone="border-rose-300 bg-rose-50 text-rose-900"
          />
          <InlineKpiChip
            label="Vượt ước lượng"
            value={alertCounts?.over_estimate ?? 0}
            tone="border-slate-300 bg-slate-100 text-slate-800"
          />
          <InlineKpiChip
            label="Nguy cơ SLA"
            value={alertCounts?.sla_risk ?? 0}
            tone="border-sky-300 bg-sky-50 text-sky-900"
          />
          {loading ? (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
              Đang cập nhật...
            </span>
          ) : null}
        </div>
      </div>

      <div className={`mt-3 grid gap-3 ${isDesktopWide ? 'xl:grid-cols-[minmax(0,1.18fr)_320px]' : ''}`}>
        <div className="space-y-3">
          <div
            className={`grid gap-3 ${
              layoutMode === 'mobile'
                ? 'grid-cols-1'
                : layoutMode === 'tablet'
                ? 'md:grid-cols-2'
                : 'lg:grid-cols-3'
            }`}
          >
            {ROLE_CARD_META.map((role) => {
              const dashboard = roleDashboards[role.key];
              return (
                <button
                  key={role.key}
                  type="button"
                  onClick={() => onOpenWorkspace(role.key)}
                  aria-label={`Mở workspace ${role.label}`}
                  className="min-h-11 cursor-pointer overflow-hidden rounded-[var(--ui-shell-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] text-left shadow-[var(--ui-shadow-shell)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <div className={`border-b px-3 py-3 ${role.accentSurfaceCls} ${role.accentBorderCls}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--ui-control-radius)] bg-white ${role.accentTextCls}`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                            {role.icon}
                          </span>
                        </span>
                        <div className="min-w-0">
                          <p className={`text-[12px] font-semibold leading-4 ${role.accentTextCls}`}>
                            {role.label}
                          </p>
                          <p className="mt-1 text-[11px] leading-4 text-[color:var(--ui-text-muted)]">{role.helper}</p>
                        </div>
                      </div>
                      <span className="rounded-full border border-[var(--ui-border)] bg-white px-2 py-0.5 text-[10px] font-bold text-[color:var(--ui-text-default)]">
                        {dashboard?.summary.total_cases ?? 0}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 px-3 py-3">
                    <MetricTile
                      label="Thiếu ước lượng"
                      value={dashboard?.summary.alert_counts.missing_estimate ?? 0}
                    />
                    <MetricTile
                      label="Vượt estimate"
                      value={dashboard?.summary.alert_counts.over_estimate ?? 0}
                    />
                    <MetricTile
                      label="Nguy cơ SLA"
                      value={dashboard?.summary.alert_counts.sla_risk ?? 0}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-[var(--ui-border-soft)] px-3 py-2 text-[11px] font-semibold text-[color:var(--ui-text-muted)]">
                    <span>Mở workspace</span>
                    <span className="inline-flex items-center gap-1 text-primary">
                      Xem nhanh
                      <span className="material-symbols-outlined text-[14px]">arrow_outward</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-[var(--ui-shell-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] p-3 shadow-[var(--ui-shadow-shell)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold leading-4 text-[color:var(--ui-text-title)]">Ca cần chú ý ngay</p>
                <p className="mt-1 text-[11px] leading-4 text-[color:var(--ui-text-muted)]">
                  Nhóm ca cần PM hoặc lead mở trước để xử lý estimate, SLA hoặc nút thắt điều phối.
                </p>
              </div>
              <span className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--ui-text-muted)]">
                {attentionCount} ca
              </span>
            </div>

            <div className="mt-3 space-y-2">
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

        <div className="space-y-3">
          <SimpleRankPanel
            title="Top khách hàng"
            items={(overviewDashboard?.top_customers ?? []).slice(0, 5).map((customer) => ({
              key: `${customer.customer_id}-${customer.customer_name ?? ''}`,
              label: customer.customer_name || 'Chưa xác định',
              value: customer.count,
              onActivate: onOpenListSurface,
            }))}
            emptyText="Chưa có khách hàng nổi bật."
            actionLabel="Vào danh sách"
            onAction={onOpenListSurface}
          />
          <SimpleRankPanel
            title="Top dự án"
            items={(overviewDashboard?.top_projects ?? []).slice(0, 5).map((project) => ({
              key: `${project.project_id}-${project.project_name ?? ''}`,
              label: project.project_name || 'Chưa gắn dự án',
              value: project.count,
              onActivate: onOpenListSurface,
            }))}
            emptyText="Chưa có dự án nổi bật."
            actionLabel="Vào danh sách"
            onAction={onOpenListSurface}
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

const InlineKpiChip: React.FC<{
  label: string;
  value: number;
  tone: string;
}> = ({ label, value, tone }) => (
  <div
    className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 ${tone}`}
  >
    <span>{label}:</span>
    <span className="text-[12px] font-bold leading-none">{value}</span>
  </div>
);

const MetricTile: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-[var(--ui-control-radius)] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-subtle)] px-2.5 py-2">
    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--ui-text-subtle)]">{label}</p>
    <p className="mt-1 text-sm font-semibold leading-none text-[color:var(--ui-text-default)]">{value}</p>
  </div>
);

const SimpleRankPanel: React.FC<{
  title: string;
  items: Array<{ key: string; label: string; value: number; onActivate?: () => void }>;
  emptyText: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, items, emptyText, actionLabel, onAction }) => (
  <div className="rounded-[var(--ui-shell-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] p-3 shadow-[var(--ui-shadow-shell)]">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-bold leading-4 text-[color:var(--ui-text-title)]">{title}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="min-h-11 rounded-[var(--ui-control-radius)] px-2 text-[11px] font-semibold text-primary underline decoration-primary/40 underline-offset-4 transition hover:decoration-primary"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
    <div className="mt-3 space-y-2">
      {items.map((item) => (
        <div
          key={item.key}
          className="flex items-center justify-between gap-3 rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] px-3 py-2"
        >
          {item.onActivate ? (
            <button
              type="button"
              onClick={item.onActivate}
              className="min-h-11 text-left text-sm font-medium leading-5 text-[color:var(--ui-text-default)] underline decoration-slate-300 underline-offset-4 transition hover:text-primary hover:decoration-primary"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-sm font-medium leading-5 text-[color:var(--ui-text-default)]">{item.label}</span>
          )}
          <span className="rounded-full border border-[var(--ui-border)] bg-white px-2 py-0.5 text-[10px] font-bold text-[color:var(--ui-text-default)]">
            {item.value}
          </span>
        </div>
      ))}
      {items.length === 0 ? <EmptySmallState message={emptyText} /> : null}
    </div>
  </div>
);

const EmptySmallState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-[var(--ui-control-radius)] border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] px-3 py-5 text-center text-sm leading-5 text-[color:var(--ui-text-muted)]">
    {message}
  </div>
);
