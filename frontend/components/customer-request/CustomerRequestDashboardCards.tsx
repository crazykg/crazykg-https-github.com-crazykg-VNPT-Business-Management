import React, { useMemo } from 'react';
import type { YeuCauDashboardPayload } from '../../types';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';
import {
  LIST_KPI_STATUSES,
  ROLE_DASHBOARD_META,
  type CustomerRequestRoleFilter,
  resolveStatusMeta,
} from './presentation';

type CustomerRequestDashboardCardsProps = {
  activeRoleFilter: CustomerRequestRoleFilter;
  onRoleFilterChange: (role: CustomerRequestRoleFilter) => void;
  overviewDashboard: YeuCauDashboardPayload | null;
  roleDashboards: Record<'creator' | 'dispatcher' | 'performer', YeuCauDashboardPayload | null>;
  isDashboardLoading: boolean;
  activeProcessCode: string;
  onProcessCodeChange: (statusCode: string) => void;
  getStatusCount: (statusCode: string) => number;
  onSelectAttentionCase: (requestId: string | number, statusCode?: string | null) => void;
};

const ROLE_WORKSPACE_META: Record<
  'overview' | 'creator' | 'dispatcher' | 'performer',
  { title: string; subtitle: string; emptyText: string }
> = {
  overview: {
    title: 'Toàn cảnh vận hành',
    subtitle: 'Theo dõi nhanh các ca cần chú ý và phân bổ theo khách hàng, người thực hiện.',
    emptyText: 'Chưa có ca nào cần chú ý trong toàn hệ thống.',
  },
  creator: {
    title: 'YC của tôi',
    subtitle: 'Các yêu cầu do bạn tạo đang cần theo dõi hoặc phản hồi thêm.',
    emptyText: 'Hiện không có yêu cầu nào do bạn tạo đang cần hành động.',
  },
  dispatcher: {
    title: 'Điều phối',
    subtitle: 'Ưu tiên các ca cần phân công lại, đang rủi ro estimate hoặc SLA.',
    emptyText: 'Hiện chưa có ca điều phối nào cần chú ý.',
  },
  performer: {
    title: 'Việc của tôi',
    subtitle: 'Các yêu cầu bạn đang trực tiếp xử lý và cần hoàn tất sớm.',
    emptyText: 'Hiện chưa có việc nào của bạn đang ở trạng thái cần chú ý.',
  },
};

export const CustomerRequestDashboardCards: React.FC<CustomerRequestDashboardCardsProps> = ({
  activeRoleFilter,
  onRoleFilterChange,
  overviewDashboard,
  roleDashboards,
  isDashboardLoading,
  activeProcessCode,
  onProcessCodeChange,
  getStatusCount,
  onSelectAttentionCase,
}) => {
  const dashboardLookup: Record<string, YeuCauDashboardPayload | null> = {
    overview: overviewDashboard,
    creator: roleDashboards.creator,
    dispatcher: roleDashboards.dispatcher,
    performer: roleDashboards.performer,
  };
  const activeWorkspaceRole = activeRoleFilter || 'overview';
  const activeWorkspaceDashboard = dashboardLookup[activeWorkspaceRole];
  const workspaceMeta = ROLE_WORKSPACE_META[activeWorkspaceRole];
  const projectHotspots = useMemo(() => {
    const aggregatedProjects = (activeWorkspaceDashboard?.top_projects ?? [])
      .map((project) => ({
        label: requestProjectLabel(project.project_name),
        count: Number(project.count ?? 0),
      }))
      .filter((project) => project.count > 0);

    if (aggregatedProjects.length > 0) {
      return aggregatedProjects.slice(0, 5);
    }

    const counts = new Map<string, { label: string; count: number }>();

    (activeWorkspaceDashboard?.attention_cases ?? []).forEach((attentionCase) => {
      const projectName = requestProjectLabel(attentionCase.request_case.project_name);
      const existing = counts.get(projectName);
      counts.set(projectName, {
        label: projectName,
        count: (existing?.count ?? 0) + 1,
      });
    });

    return Array.from(counts.values())
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'vi'))
      .slice(0, 5);
  }, [activeWorkspaceDashboard]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ROLE_DASHBOARD_META.map((item) => {
          const dashboard = dashboardLookup[item.role];
          const isActiveRole = item.role !== 'overview' && activeRoleFilter === item.role;

          return (
            <button
              key={item.role}
              type="button"
              onClick={() => {
                if (item.role === 'overview') {
                  onRoleFilterChange('');
                } else {
                  onRoleFilterChange(activeRoleFilter === item.role ? '' : item.role);
                }
              }}
              className={`overflow-hidden rounded-3xl border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md ${isActiveRole ? 'ring-2 ring-primary/40' : ''}`}
            >
              <div className={`bg-gradient-to-r px-4 py-3 text-white ${item.tone}`}>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-80">{item.label}</p>
                <p className="mt-2 text-3xl font-black">{dashboard?.summary.total_cases ?? 0}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 px-4 py-3 text-[11px] text-slate-500">
                <div>
                  <p className="font-semibold text-slate-400">Thiếu est</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{dashboard?.summary.alert_counts.missing_estimate ?? 0}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-400">Vượt est</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{dashboard?.summary.alert_counts.over_estimate ?? 0}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-400">SLA risk</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{dashboard?.summary.alert_counts.sla_risk ?? 0}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {LIST_KPI_STATUSES.map((kpi) => {
          const count = getStatusCount(kpi.code);
          const isActive = activeProcessCode === kpi.code;

          return (
            <button
              key={kpi.code}
              type="button"
              onClick={() => onProcessCodeChange(kpi.code)}
              className={`rounded-2xl border p-4 text-left transition hover:shadow-md ${kpi.cls} ${isActive ? kpi.activeCls : ''}`}
            >
              <p className="text-2xl font-black">{count}</p>
              <p className="mt-1 text-xs font-semibold leading-snug">{kpi.label}</p>
              {isActive ? <p className="mt-1.5 text-[10px] font-semibold opacity-70">▼ Đang lọc</p> : null}
            </button>
          );
        })}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{workspaceMeta.title}</p>
            <h4 className="mt-1 text-lg font-black text-slate-900">
              {activeWorkspaceDashboard?.summary.total_cases ?? 0} yêu cầu trong phạm vi hiện tại
            </h4>
            <p className="mt-1 text-sm text-slate-500">{workspaceMeta.subtitle}</p>
          </div>
          {isDashboardLoading ? (
            <span className="text-xs text-slate-400">Đang cập nhật dashboard...</span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_320px]">
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white bg-white px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Tổng ca</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{activeWorkspaceDashboard?.summary.total_cases ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-white bg-white px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Thiếu estimate</p>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  {activeWorkspaceDashboard?.summary.alert_counts.missing_estimate ?? 0}
                </p>
              </div>
              <div className="rounded-2xl border border-white bg-white px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">SLA risk</p>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  {activeWorkspaceDashboard?.summary.alert_counts.sla_risk ?? 0}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">Ca cần chú ý</p>
                  <p className="text-xs text-slate-500">Bấm để mở nhanh chi tiết yêu cầu.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {activeWorkspaceDashboard?.attention_cases.length ?? 0} ca
                </span>
              </div>
              {(activeWorkspaceDashboard?.attention_cases ?? []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                  {workspaceMeta.emptyText}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {(activeWorkspaceDashboard?.attention_cases ?? []).slice(0, 5).map((attentionCase) => {
                    const requestCase = attentionCase.request_case;
                    const statusMeta = resolveStatusMeta(
                      requestCase.trang_thai || requestCase.current_status_code,
                      requestCase.current_status_name_vi
                    );

                    return (
                      <button
                        key={String(requestCase.id)}
                        type="button"
                        onClick={() =>
                          onSelectAttentionCase(
                            requestCase.id,
                            requestCase.tien_trinh_hien_tai || requestCase.trang_thai || requestCase.current_status_code
                          )
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-primary/30 hover:bg-primary/5"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {requestCase.ma_yc || requestCase.request_code || '--'}
                          </span>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.cls}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-700">
                          {requestCase.tieu_de || requestCase.summary || '--'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {[requestCase.customer_name || requestCase.khach_hang_name, requestCase.project_name]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        {attentionCase.reasons.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {attentionCase.reasons.map((reason) => (
                              <span
                                key={reason}
                                className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <p className="mt-2 text-[11px] text-slate-400">
                          {requestCase.updated_at ? `Cập nhật: ${formatDateTimeDdMmYyyy(requestCase.updated_at)?.slice(0, 16)}` : '--'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-white bg-white p-4">
              <p className="text-sm font-bold text-slate-900">
                {activeWorkspaceRole === 'creator' ? 'Top khách hàng của tôi' : 'Top khách hàng'}
              </p>
              <div className="mt-3 space-y-2">
                {(activeWorkspaceDashboard?.top_customers ?? []).slice(0, 5).map((customer) => (
                  <div key={`${customer.customer_id}-${customer.customer_name ?? ''}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                    <span className="text-sm font-semibold text-slate-700">{customer.customer_name || 'Chưa xác định'}</span>
                    <span className="text-xs font-bold text-slate-500">{customer.count}</span>
                  </div>
                ))}
                {(activeWorkspaceDashboard?.top_customers ?? []).length === 0 ? (
                  <p className="text-sm text-slate-400">Chưa có dữ liệu khách hàng nổi bật.</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white bg-white p-4">
              <p className="text-sm font-bold text-slate-900">Dự án cần chú ý</p>
              <div className="mt-3 space-y-2">
                {projectHotspots.map((project) => (
                  <div key={project.label} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                    <span className="text-sm font-semibold text-slate-700">{project.label}</span>
                    <span className="text-xs font-bold text-slate-500">{project.count}</span>
                  </div>
                ))}
                {projectHotspots.length === 0 ? (
                  <p className="text-sm text-slate-400">Chưa có dự án nào nổi bật trong nhóm cần chú ý.</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white bg-white p-4">
              <p className="text-sm font-bold text-slate-900">
                {activeWorkspaceRole === 'performer' ? 'Khối lượng theo performer' : 'Top performer'}
              </p>
              <div className="mt-3 space-y-2">
                {(activeWorkspaceDashboard?.top_performers ?? []).slice(0, 5).map((performer) => (
                  <div
                    key={`${performer.performer_user_id}-${performer.performer_name ?? ''}`}
                    className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"
                  >
                    <span className="text-sm font-semibold text-slate-700">
                      {performer.performer_name || 'Chưa xác định'}
                    </span>
                    <span className="text-xs font-bold text-slate-500">{performer.count}</span>
                  </div>
                ))}
                {(activeWorkspaceDashboard?.top_performers ?? []).length === 0 ? (
                  <p className="text-sm text-slate-400">Chưa có dữ liệu performer nổi bật.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const requestProjectLabel = (projectName: string | null | undefined): string => {
  const normalized = String(projectName ?? '').trim();
  return normalized || 'Chưa gắn dự án';
};
