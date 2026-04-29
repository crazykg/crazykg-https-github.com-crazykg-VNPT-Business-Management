import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkloadSummaryDashboard } from '../components/WorkloadSummaryDashboard';
import type { Department, Employee, Project } from '../types';

const workloadApiMocks = vi.hoisted(() => ({
  fetchWorkloadSummary: vi.fn(),
  fetchWorkloadDailySeries: vi.fn(),
  fetchWorkloadDailyComparison: vi.fn(),
  fetchWorkloadProjectSummary: vi.fn(),
  fetchWorkloadPlannedActual: vi.fn(),
  fetchWorkloadWeeklyAlerts: vi.fn(),
  fetchWorkloadEntries: vi.fn(),
  exportWorkloadCsv: vi.fn(),
}));

vi.mock('../services/api/workloadApi', () => workloadApiMocks);

vi.mock('recharts', () => {
  const Chart = ({ children, data }: { children?: React.ReactNode; data?: unknown[] }) => (
    <div data-testid="mock-chart" data-points={data?.length ?? 0}>{children}</div>
  );
  return {
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    LineChart: Chart,
    BarChart: Chart,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    Line: () => null,
    Bar: () => null,
  };
});

const departments: Department[] = [
  { id: 10, dept_code: 'PKT', dept_name: 'Phong Ky thuat', parent_id: null, is_active: true } as Department,
];

const employees: Employee[] = [
  { id: 1, uuid: 'u1', user_code: 'U001', username: 'nguyenvana', full_name: 'Nguyen Van A', email: 'a@example.test', status: 'ACTIVE', department_id: 10, position_id: null } as Employee,
];

const projects: Project[] = [
  { id: 20, project_code: 'DA001', project_name: 'Du an XYZ' } as Project,
];

const renderDashboard = (canExport = true) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <WorkloadSummaryDashboard
        departments={departments}
        employees={employees}
        projects={projects}
        canExport={canExport}
        onNotify={vi.fn()}
      />
    </QueryClientProvider>
  );
};

describe('WorkloadSummaryDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    workloadApiMocks.fetchWorkloadSummary.mockResolvedValue({
      data: {
        kpis: {
          total_hours: 8.5,
          capacity_hours: 40,
          utilization_percent: 21.25,
          planned_hours: 6,
          actual_hours: 8.5,
          variance_hours: 2.5,
          entry_count: 3,
          user_count: 2,
          project_count: 1,
          alert_count: 1,
        },
        by_source: [],
        by_day: [],
        by_user: [],
        alerts_preview: [],
      },
      meta: { from: '2026-04-01', to: '2026-04-30', source: 'all' },
    });
    workloadApiMocks.fetchWorkloadDailySeries.mockResolvedValue({
      data: [{ date: '2026-04-01', hours: 5.5 }],
      meta: { from: '2026-04-01', to: '2026-04-30', source: 'all' },
    });
    workloadApiMocks.fetchWorkloadDailyComparison.mockResolvedValue({
      data: {
        users: [{ user_id: 1, user_name: 'Nguyen Van A', department_name: 'Phong Ky thuat' }],
        series: [{ date: '2026-04-01', '1': 5.5 }],
      },
      meta: { from: '2026-04-01', to: '2026-04-30', source: 'all' },
    });
    workloadApiMocks.fetchWorkloadProjectSummary.mockResolvedValue({
      data: [{ project_id: 20, project_name: 'Du an XYZ', total_hours: 8.5, crc_hours: 5.5, project_hours: 3, entry_count: 3, user_count: 2 }],
      meta: { from: '2026-04-01', to: '2026-04-30', source: 'all' },
    });
    workloadApiMocks.fetchWorkloadPlannedActual.mockResolvedValue({
      data: {
        totals: { planned_hours: 6, actual_hours: 8.5, variance_hours: 2.5 },
        by_user: [{ user_id: 1, user_name: 'Nguyen Van A', planned_hours: 6, actual_hours: 8.5, variance_hours: 2.5, status: 'OVER_PLAN' }],
        by_project: [],
        notes: { projects_without_planned_hours: 'Project planned hours require explicit field.' },
      },
      meta: { from: '2026-04-01', to: '2026-04-30', source: 'all' },
    });
    workloadApiMocks.fetchWorkloadWeeklyAlerts.mockResolvedValue({
      data: [{ week_start: '2026-04-01', user_id: 1, user_name: 'Nguyen Van A', department_name: 'Phong Ky thuat', actual_hours: 10, capacity_hours: 8, utilization_percent: 125, missing_day_count: 0, overload_day_count: 1, severity: 'WARNING', label: 'Vuot chuan ngay' }],
      meta: { from: '2026-04-01', to: '2026-04-30', source: 'all' },
    });
    workloadApiMocks.fetchWorkloadEntries.mockResolvedValue({
      data: [{ source: 'crc', source_label: 'CRC', worklog_id: 1, work_date: '2026-04-01', user_id: 1, user_name: 'Nguyen Van A', user_code: 'U001', department_id: 10, department_name: 'Phong Ky thuat', department_code: 'PKT', project_id: 20, project_name: 'Du an XYZ', customer_id: null, customer_name: null, reference_id: 100, reference_code: 'CRC-100', activity_type_code: 'CODING', description: 'Xu ly yeu cau', hours_spent: 5.5, is_billable: true }],
      meta: { from: '2026-04-01', to: '2026-04-30', source: 'all' },
    });
    workloadApiMocks.exportWorkloadCsv.mockResolvedValue(undefined);
  });

  it('renders KPI, chart fallback data and workload entries', async () => {
    renderDashboard();

    expect(screen.getByRole('heading', { name: 'Cá nhân, phòng ban và dự án' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('8,5h').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Du an XYZ').length).toBeGreaterThan(0);
    expect(screen.getByText('Vuot chuan ngay')).toBeInTheDocument();
    expect(screen.getByText('Xu ly yeu cau')).toBeInTheDocument();
  });

  it('passes source filter to API and keeps export as a real button', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.selectOptions(screen.getByLabelText('Nguồn'), 'project');

    await waitFor(() => {
      expect(workloadApiMocks.fetchWorkloadSummary).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'project' }));
    });

    await user.click(screen.getByRole('button', { name: /Xuất CSV/i }));
    expect(workloadApiMocks.exportWorkloadCsv).toHaveBeenCalledWith(expect.objectContaining({ source: 'project' }));
  });
});
