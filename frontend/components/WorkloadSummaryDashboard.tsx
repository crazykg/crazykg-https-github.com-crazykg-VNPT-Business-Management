import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, RefreshCw } from 'lucide-react';
import type { Department, Employee, Project } from '../types';
import type { WorkloadQueryParams, WorkloadSource } from '../types/workload';
import {
  exportWorkloadCsv,
  fetchWorkloadDailyComparison,
  fetchWorkloadDailySeries,
  fetchWorkloadEntries,
  fetchWorkloadPlannedActual,
  fetchWorkloadProjectSummary,
  fetchWorkloadSummary,
  fetchWorkloadWeeklyAlerts,
} from '../services/api/workloadApi';

interface Props {
  departments: Department[];
  employees: Employee[];
  projects: Project[];
  canExport: boolean;
  onNotify: (type: 'success' | 'error', title: string, message?: string) => void;
}

const formatDate = (date: Date): string => date.toISOString().slice(0, 10);

const defaultFrom = (): string => {
  const now = new Date();
  return formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
};

const defaultTo = (): string => {
  const now = new Date();
  return formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
};

const formatHours = (value: unknown): string => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? `${number.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}h` : '0h';
};

const severityClass = (severity: string): string => {
  if (severity === 'CRITICAL') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (severity === 'WARNING') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-primary/20 bg-primary-container-soft text-deep-teal';
};

export const WorkloadSummaryDashboard: React.FC<Props> = ({ departments, employees, projects, canExport, onNotify }) => {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [source, setSource] = useState<WorkloadSource>('all');
  const [userId, setUserId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const params = useMemo<WorkloadQueryParams>(() => ({
    from,
    to,
    source,
    user_id: userId || undefined,
    department_id: departmentId || undefined,
    project_id: projectId || undefined,
  }), [departmentId, from, projectId, source, to, userId]);

  const summaryQuery = useQuery({ queryKey: ['workload', 'summary', params], queryFn: () => fetchWorkloadSummary(params) });
  const dailyQuery = useQuery({ queryKey: ['workload', 'daily', params], queryFn: () => fetchWorkloadDailySeries(params) });
  const comparisonQuery = useQuery({ queryKey: ['workload', 'comparison', params], queryFn: () => fetchWorkloadDailyComparison(params) });
  const projectQuery = useQuery({ queryKey: ['workload', 'projects', params], queryFn: () => fetchWorkloadProjectSummary(params) });
  const plannedQuery = useQuery({ queryKey: ['workload', 'planned', params], queryFn: () => fetchWorkloadPlannedActual(params) });
  const alertsQuery = useQuery({ queryKey: ['workload', 'alerts', params], queryFn: () => fetchWorkloadWeeklyAlerts(params) });
  const entriesQuery = useQuery({
    queryKey: ['workload', 'entries', params],
    queryFn: () => fetchWorkloadEntries({ ...params, per_page: 12 }),
  });

  const isLoading = summaryQuery.isLoading || dailyQuery.isLoading || projectQuery.isLoading;
  const kpis = summaryQuery.data?.data.kpis;
  const comparisonUsers = comparisonQuery.data?.data.users ?? [];
  const comparisonSeries = comparisonQuery.data?.data.series ?? [];
  const projectRows = projectQuery.data?.data ?? [];
  const alerts = alertsQuery.data?.data ?? [];
  const planned = plannedQuery.data?.data ?? null;
  const entries = entriesQuery.data?.data ?? [];

  const refetchAll = () => {
    void summaryQuery.refetch();
    void dailyQuery.refetch();
    void comparisonQuery.refetch();
    void projectQuery.refetch();
    void plannedQuery.refetch();
    void alertsQuery.refetch();
    void entriesQuery.refetch();
  };

  const handleExport = async () => {
    if (!canExport) {
      onNotify('error', 'Không có quyền', 'Bạn chưa có quyền xuất tổng hợp giờ công.');
      return;
    }
    setIsExporting(true);
    try {
      await exportWorkloadCsv(params);
      onNotify('success', 'Đã xuất dữ liệu', 'File CSV tổng hợp giờ công đã được tải xuống.');
    } catch (error) {
      onNotify('error', 'Xuất dữ liệu thất bại', error instanceof Error ? error.message : 'Không thể xuất dữ liệu.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="min-h-[calc(100dvh-32px)] bg-slate-50 px-3 py-3 text-slate-800 sm:px-4 lg:px-5">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-3">
        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase text-primary">Tổng hợp giờ công</p>
              <h1 className="text-base font-bold text-slate-900">Cá nhân, phòng ban và dự án</h1>
              <p className="mt-1 text-xs text-slate-500">Nguồn dữ liệu từ CRC và bảng thủ tục dự án, chuẩn hóa theo người thực hiện.</p>
            </div>
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-[128px_128px_132px_180px_180px_180px_auto_auto]">
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                Từ ngày
                <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-8 rounded border border-slate-300 px-2 text-sm focus:border-primary/70 focus:outline-none focus:ring-1 focus:ring-primary/15" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                Đến ngày
                <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-8 rounded border border-slate-300 px-2 text-sm focus:border-primary/70 focus:outline-none focus:ring-1 focus:ring-primary/15" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                Nguồn
                <select value={source} onChange={(event) => setSource(event.target.value as WorkloadSource)} className="h-8 rounded border border-slate-300 px-2 text-sm focus:border-primary/70 focus:outline-none focus:ring-1 focus:ring-primary/15">
                  <option value="all">Tất cả</option>
                  <option value="crc">CRC</option>
                  <option value="project">Projects</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                Nhân sự
                <select value={userId} onChange={(event) => setUserId(event.target.value)} className="h-8 rounded border border-slate-300 px-2 text-sm focus:border-primary/70 focus:outline-none focus:ring-1 focus:ring-primary/15">
                  <option value="">Tất cả trong quyền</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.full_name || employee.username || `#${employee.id}`}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                Phòng ban
                <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} className="h-8 rounded border border-slate-300 px-2 text-sm focus:border-primary/70 focus:outline-none focus:ring-1 focus:ring-primary/15">
                  <option value="">Tất cả</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.dept_name || department.dept_code || `#${department.id}`}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                Dự án
                <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="h-8 rounded border border-slate-300 px-2 text-sm focus:border-primary/70 focus:outline-none focus:ring-1 focus:ring-primary/15">
                  <option value="">Tất cả</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.project_name || `#${project.id}`}</option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={refetchAll} className="inline-flex h-8 items-center justify-center gap-1 rounded border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Tải lại
              </button>
              <button type="button" onClick={handleExport} disabled={!canExport || isExporting} className="inline-flex h-8 items-center justify-center gap-1 rounded bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                <Download className="h-4 w-4" aria-hidden="true" />
                Xuất CSV
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2 xl:grid-cols-6">
          {[
            ['Tổng giờ', formatHours(kpis?.total_hours)],
            ['Chuẩn giờ', formatHours(kpis?.capacity_hours)],
            ['Mức sử dụng', `${kpis?.utilization_percent ?? 0}%`],
            ['Kế hoạch', formatHours(kpis?.planned_hours)],
            ['Dự án', String(kpis?.project_count ?? 0)],
            ['Cảnh báo', String(kpis?.alert_count ?? 0)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[11px] font-bold uppercase text-slate-500">{label}</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(420px,0.9fr)]">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Giờ công theo ngày</h2>
              {isLoading ? <span className="text-xs text-slate-500">Đang tải...</span> : null}
            </div>
            <div className="h-[280px] min-w-[520px]" aria-label="Biểu đồ giờ công theo ngày">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyQuery.data?.data ?? []} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => formatHours(value)} />
                  <Line type="monotone" dataKey="hours" name="Giờ công" stroke="#005A9C" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 max-h-48 overflow-auto rounded border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <caption className="sr-only">Bảng dữ liệu giờ công theo ngày</caption>
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                  <tr><th className="px-2 py-2">Ngày</th><th className="px-2 py-2 text-right">Giờ</th></tr>
                </thead>
                <tbody>
                  {(dailyQuery.data?.data ?? []).map((row) => (
                    <tr key={row.date} className="border-t border-slate-100"><td className="px-2 py-1.5">{row.date}</td><td className="px-2 py-1.5 text-right font-semibold">{formatHours(row.hours)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="mb-2 text-sm font-bold text-slate-900">Cảnh báo tuần</h2>
            <div className="max-h-[420px] space-y-2 overflow-auto">
              {alerts.length === 0 ? (
                <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">Chưa có cảnh báo trong khoảng thời gian này.</p>
              ) : alerts.slice(0, 12).map((alert) => (
                <div key={`${alert.week_start}-${alert.user_id}-${alert.label}`} className={`rounded border px-3 py-2 text-xs ${severityClass(alert.severity)}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">{alert.label}</p>
                      <p className="mt-0.5 text-slate-700">{alert.user_name || `User #${alert.user_id}`} • {alert.department_name || 'Chưa có phòng ban'}</p>
                    </div>
                    <span className="font-bold">{alert.utilization_percent}%</span>
                  </div>
                  <p className="mt-1 text-[11px]">Tuần {alert.week_start}: {formatHours(alert.actual_hours)} / {formatHours(alert.capacity_hours)}. Thiếu {alert.missing_day_count} ngày, vượt {alert.overload_day_count} ngày.</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="mb-2 text-sm font-bold text-slate-900">So sánh cá nhân theo ngày</h2>
            <div className="h-[260px] min-w-[560px]" aria-label="Biểu đồ so sánh giờ công cá nhân">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparisonSeries} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => formatHours(value)} />
                  <Legend />
                  {comparisonUsers.slice(0, 6).map((user, index) => (
                    <Line key={user.user_id} type="monotone" dataKey={String(user.user_id)} name={user.user_name || `User #${user.user_id}`} stroke={['#005A9C', '#00856F', '#C07039', '#7C3AED', '#BE123C', '#475569'][index % 6]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="mb-2 text-sm font-bold text-slate-900">Kế hoạch / thực tế</h2>
            <div className="h-[260px] min-w-[480px]" aria-label="Biểu đồ kế hoạch thực tế">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planned?.by_user.slice(0, 8) ?? []} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="user_name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => formatHours(value)} />
                  <Legend />
                  <Bar dataKey="planned_hours" name="Kế hoạch" fill="#64748b" />
                  <Bar dataKey="actual_hours" name="Thực tế" fill="#005A9C" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {planned?.notes?.projects_without_planned_hours ? <p className="mt-2 text-[11px] text-slate-500">{planned.notes.projects_without_planned_hours}</p> : null}
          </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="mb-2 text-sm font-bold text-slate-900">Giờ công theo dự án</h2>
            <div className="max-h-[360px] overflow-auto rounded border border-slate-200">
              <table className="min-w-[640px] w-full text-left text-xs">
                <caption className="sr-only">Bảng giờ công theo dự án</caption>
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Dự án</th>
                    <th className="px-2 py-2 text-right">Tổng</th>
                    <th className="px-2 py-2 text-right">CRC</th>
                    <th className="px-2 py-2 text-right">Projects</th>
                    <th className="px-2 py-2 text-right">Người</th>
                  </tr>
                </thead>
                <tbody>
                  {projectRows.map((row) => (
                    <tr key={row.project_id ?? 'none'} className="border-t border-slate-100">
                      <td className="px-2 py-2 font-semibold text-slate-800">{row.project_name || 'Chưa gắn dự án'}</td>
                      <td className="px-2 py-2 text-right font-bold">{formatHours(row.total_hours)}</td>
                      <td className="px-2 py-2 text-right">{formatHours(row.crc_hours)}</td>
                      <td className="px-2 py-2 text-right">{formatHours(row.project_hours)}</td>
                      <td className="px-2 py-2 text-right">{row.user_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="mb-2 text-sm font-bold text-slate-900">Dòng công gần nhất</h2>
            <div className="max-h-[360px] overflow-auto rounded border border-slate-200">
              <table className="min-w-[780px] w-full text-left text-xs">
                <caption className="sr-only">Bảng dòng công chi tiết</caption>
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Ngày</th>
                    <th className="px-2 py-2">Nguồn</th>
                    <th className="px-2 py-2">Người</th>
                    <th className="px-2 py-2">Dự án</th>
                    <th className="px-2 py-2">Nội dung</th>
                    <th className="px-2 py-2 text-right">Giờ</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((row) => (
                    <tr key={`${row.source}-${row.worklog_id}`} className="border-t border-slate-100">
                      <td className="px-2 py-2 whitespace-nowrap">{row.work_date}</td>
                      <td className="px-2 py-2 font-semibold">{row.source_label}</td>
                      <td className="px-2 py-2">{row.user_name || 'Chưa rõ'}<div className="text-[10px] text-slate-500">{row.department_name || 'Chưa có phòng ban'}</div></td>
                      <td className="px-2 py-2">{row.project_name || '-'}</td>
                      <td className="px-2 py-2">{row.description || row.reference_code || '-'}</td>
                      <td className="px-2 py-2 text-right font-bold">{formatHours(row.hours_spent)}</td>
                    </tr>
                  ))}
                  {entries.length === 0 ? (
                    <tr><td colSpan={6} className="px-2 py-8 text-center text-slate-500">Chưa có dòng công trong khoảng lọc.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default WorkloadSummaryDashboard;
