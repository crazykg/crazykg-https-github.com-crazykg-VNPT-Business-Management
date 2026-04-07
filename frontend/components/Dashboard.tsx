import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Briefcase,
  CalendarClock,
  CircleDollarSign,
  FileText,
  TrendingUp,
} from 'lucide-react';
import {
  ContractStatus,
  ContractStatusBreakdown,
  ExpiringContractSummary,
  ProjectStatusBreakdown,
  ProcedureTemplate,
  Contract,
  PaymentSchedule,
  Project,
  Customer,
  Department,
  Employee,
} from '../types';
import type { DashboardStats } from '../types/dashboard';
import { calculateDashboardStats, DEFAULT_PROJECT_STATUS_ORDER } from '../utils/dashboardCalculations';
import { getProjectStatusLabel } from '../constants';
import { fetchProcedureTemplates } from '../services/api/projectApi';

const resolveProjectStatusColor = (status: string): string => {
  const normalized = String(status || '').trim().toUpperCase();

  switch (normalized) {
    case 'CHUAN_BI':
      return '#64748b';
    case 'CHUAN_BI_DAU_TU':
    case 'CHUAN_BI_KH_THUE':
      return '#2563eb';
    case 'THUC_HIEN_DAU_TU':
      return '#d97706';
    case 'KET_THUC_DAU_TU':
      return '#059669';
    case 'TAM_NGUNG':
      return '#d97706';
    case 'HUY':
    case 'CANCELLED':
      return '#dc2626';
    case 'TRIAL':
      return '#f59e0b';
    case 'ONGOING':
      return '#22c55e';
    case 'WARRANTY':
      return '#06b6d4';
    case 'COMPLETED':
      return '#0ea5e9';
    case 'CO_HOI':
      return '#a855f7';
    default:
      return '#94a3b8';
  }
};

const DASHBOARD_SPECIAL_PROJECT_STATUSES = ['TAM_NGUNG', 'HUY'] as const;

const normalizeProjectStatusToken = (value: unknown): string =>
  String(value ?? '').trim().toUpperCase();

const collectConfiguredProjectStatuses = (templates: ProcedureTemplate[]): string[] => {
  const orderedStatuses: string[] = [];
  const seenStatuses = new Set<string>();

  const pushStatus = (value: unknown): void => {
    const normalized = normalizeProjectStatusToken(value);
    if (!normalized || seenStatuses.has(normalized)) {
      return;
    }

    seenStatuses.add(normalized);
    orderedStatuses.push(normalized);
  };

  (templates || [])
    .filter((template) => template.is_active !== false)
    .forEach((template) => {
      (template.phases || []).forEach(pushStatus);
    });

  return orderedStatuses;
};

const buildDashboardProjectStatusOrder = (
  configuredStatuses: string[],
  projects: Project[]
): string[] => {
  const orderedStatuses: string[] = [];
  const seenStatuses = new Set<string>();

  const pushStatus = (value: unknown): void => {
    const normalized = normalizeProjectStatusToken(value);
    if (!normalized || seenStatuses.has(normalized)) {
      return;
    }

    seenStatuses.add(normalized);
    orderedStatuses.push(normalized);
  };

  (configuredStatuses.length > 0 ? configuredStatuses : DEFAULT_PROJECT_STATUS_ORDER).forEach(pushStatus);
  DASHBOARD_SPECIAL_PROJECT_STATUSES.forEach(pushStatus);
  (projects || []).forEach((project) => pushStatus(project.status));

  return orderedStatuses;
};

const contractStatusColors: Record<ContractStatus, string> = {
  DRAFT: '#f59e0b',
  SIGNED: '#22c55e',
  RENEWED: '#3b82f6',
};

const contractStatusLabels: Record<ContractStatus, string> = {
  DRAFT: 'Đang soạn',
  SIGNED: 'Đã ký',
  RENEWED: 'Đã gia hạn',
};

const formatCurrency = (value: number): string => {
  const formatted = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value || 0);
  return formatted.replace('₫', 'đ');
};

const formatDate = (value?: string | null): string => {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('vi-VN');
};

interface DashboardProps {
  contracts?: Contract[];
  paymentSchedules?: PaymentSchedule[];
  projects?: Project[];
  customers?: Customer[];
  departments?: Department[];
  employees?: Employee[];
  /** @deprecated pass raw data instead; kept for compatibility */
  stats?: DashboardStats;
}

// ── period helpers ──────────────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();
type PeriodKey = 'all' | 'this_year' | 'this_quarter' | 'this_month' | string;

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: 'all', label: 'Tất cả thời gian' },
  { value: 'this_year', label: `Năm ${CURRENT_YEAR}` },
  { value: 'this_quarter', label: 'Quý này' },
  { value: 'this_month', label: 'Tháng này' },
  ...Array.from({ length: 4 }, (_, i) => {
    const y = CURRENT_YEAR - i;
    return { value: String(y), label: `Năm ${y}` };
  }).slice(1),
];

function periodBounds(period: PeriodKey): { from: Date; to: Date } | null {
  const now = new Date();
  if (period === 'all') return null;
  if (period === 'this_month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { from, to };
  }
  if (period === 'this_quarter') {
    const qStart = Math.floor(now.getMonth() / 3) * 3;
    const from = new Date(now.getFullYear(), qStart, 1);
    const to = new Date(now.getFullYear(), qStart + 3, 0, 23, 59, 59);
    return { from, to };
  }
  if (period === 'this_year') {
    return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear(), 11, 31, 23, 59, 59) };
  }
  const y = parseInt(period, 10);
  if (!Number.isNaN(y)) {
    return { from: new Date(y, 0, 1), to: new Date(y, 11, 31, 23, 59, 59) };
  }
  return null;
}

export const Dashboard: React.FC<DashboardProps> = ({
  contracts: allContracts = [],
  paymentSchedules: allSchedules = [],
  projects: allProjects = [],
  customers = [],
  departments = [],
  employees = [],
  stats: providedStats,
}) => {
  // ── filter state ────────────────────────────────────────────────────────
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [deptId, setDeptId] = useState<string>('all');
  const [employeeId, setEmployeeId] = useState<string>('all');
  const [configuredProjectStatuses, setConfiguredProjectStatuses] = useState<string[]>([]);

  useEffect(() => {
    if (providedStats) {
      return undefined;
    }

    let isMounted = true;

    void fetchProcedureTemplates()
      .then((templates) => {
        if (!isMounted) {
          return;
        }

        setConfiguredProjectStatuses(
          collectConfiguredProjectStatuses(Array.isArray(templates) ? templates : [])
        );
      })
      .catch(() => {
        if (isMounted) {
          setConfiguredProjectStatuses([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [providedStats]);

  // ── derived: employees of selected dept ────────────────────────────────
  const deptEmployees = useMemo(() => {
    if (deptId === 'all') return employees;
    return employees.filter((e) => String(e.department_id) === deptId);
  }, [employees, deptId]);

  // ── filtered raw data ───────────────────────────────────────────────────
  const contracts = useMemo(() => {
    let list = allContracts;
    // dept filter
    if (deptId !== 'all') {
      list = list.filter((c) => String(c.dept_id) === deptId);
    }
    // signer/employee filter
    if (employeeId !== 'all') {
      list = list.filter((c) => String(c.signer_user_id) === employeeId);
    }
    // period filter: by sign_date
    const bounds = periodBounds(period);
    if (bounds) {
      list = list.filter((c) => {
        const d = c.sign_date ? new Date(c.sign_date) : null;
        return d && d >= bounds.from && d <= bounds.to;
      });
    }
    return list;
  }, [allContracts, deptId, employeeId, period]);

  const contractIds = useMemo(() => new Set(contracts.map((c) => String(c.id))), [contracts]);

  const paymentSchedules = useMemo(() => {
    if (deptId === 'all' && employeeId === 'all' && period === 'all') return allSchedules;
    return allSchedules.filter((s) => contractIds.has(String(s.contract_id)));
  }, [allSchedules, contractIds, deptId, employeeId, period]);

  const projects = useMemo(() => {
    let list = allProjects;
    if (deptId !== 'all' || employeeId !== 'all') {
      // filter projects linked to filtered contracts
      const projectIdsFromContracts = new Set(
        contracts.map((c) => c.project_id).filter(Boolean).map(String)
      );
      list = list.filter((p) => projectIdsFromContracts.has(String(p.id)));
    }
    return list;
  }, [allProjects, contracts, deptId, employeeId]);

  const projectStatusOrder = useMemo(
    () => buildDashboardProjectStatusOrder(configuredProjectStatuses, projects),
    [configuredProjectStatuses, projects]
  );

  // ── computed stats ──────────────────────────────────────────────────────
  const stats = useMemo<DashboardStats>(
    () => providedStats || calculateDashboardStats(contracts, paymentSchedules, projects, customers, projectStatusOrder),
    [providedStats, contracts, paymentSchedules, projects, customers, projectStatusOrder]
  );

  const projectStatusCounts = stats.projectStatusCounts || [];
  const contractStatusCounts = stats.contractStatusCounts || [];
  const monthlyRevenueComparison = stats.monthlyRevenueComparison || [];
  const expiringContracts = stats.expiringContracts || [];

  const maxProjectValue = useMemo(
    () => Math.max(1, ...projectStatusCounts.map((item) => item.count)),
    [projectStatusCounts]
  );

  const maxMonthlyValue = useMemo(() => {
    const values = monthlyRevenueComparison.flatMap((item) => [item.planned, item.actual]);
    return Math.max(1, ...values);
  }, [monthlyRevenueComparison]);

  const achievementRate = stats.totalRevenue > 0
    ? Math.round((stats.actualRevenue / stats.totalRevenue) * 100)
    : 0;

  const forecastVsActualGap = stats.forecastRevenueMonth - stats.actualRevenue;
  const forecastGapPositive = forecastVsActualGap >= 0;

  const activeProjects = projectStatusCounts
    .filter((p) => !['HUY', 'CANCELLED', 'KET_THUC_DAU_TU', 'COMPLETED'].includes(p.status.toUpperCase()))
    .reduce((s, p) => s + p.count, 0);
  const totalProjects = projectStatusCounts.reduce((s, p) => s + p.count, 0);

  return (
    <div className="p-3 pb-6 space-y-3">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>dashboard</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal">Bảng điều khiển KPI chiến lược</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Doanh thu · Kế hoạch · Dự báo · Rủi ro · Tổng thể thi công</p>
          </div>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Period */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm min-w-0">
          <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 14 }}>calendar_month</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodKey)}
            className="text-xs font-medium text-slate-700 bg-transparent border-none outline-none cursor-pointer pr-1 max-w-[140px]"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Department */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm min-w-0">
          <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 14 }}>corporate_fare</span>
          <select
            value={deptId}
            onChange={(e) => { setDeptId(e.target.value); setEmployeeId('all'); }}
            className="text-xs font-medium text-slate-700 bg-transparent border-none outline-none cursor-pointer pr-1 max-w-[160px]"
          >
            <option value="all">Tất cả phòng ban</option>
            {departments.filter((d) => d.is_active).map((d) => (
              <option key={String(d.id)} value={String(d.id)}>{d.dept_name}</option>
            ))}
          </select>
        </div>

        {/* Employee — filtered by dept */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm min-w-0">
          <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: 14 }}>person</span>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="text-xs font-medium text-slate-700 bg-transparent border-none outline-none cursor-pointer pr-1 max-w-[160px]"
          >
            <option value="all">Tất cả nhân sự</option>
            {deptEmployees.filter((e) => e.status === 'ACTIVE').map((e) => (
              <option key={String(e.id)} value={String(e.id)}>{e.full_name}</option>
            ))}
          </select>
        </div>

        {/* Active filter chips + Reset */}
        {(period !== 'all' || deptId !== 'all' || employeeId !== 'all') && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {period !== 'all' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-primary/10 text-primary rounded-full px-2 py-0.5">
                {PERIOD_OPTIONS.find((o) => o.value === period)?.label}
                <button onClick={() => setPeriod('all')} className="hover:text-red-500 ml-0.5">×</button>
              </span>
            )}
            {deptId !== 'all' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-secondary/10 text-secondary rounded-full px-2 py-0.5">
                {departments.find((d) => String(d.id) === deptId)?.dept_name}
                <button onClick={() => { setDeptId('all'); setEmployeeId('all'); }} className="hover:text-red-500 ml-0.5">×</button>
              </span>
            )}
            {employeeId !== 'all' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                {employees.find((e) => String(e.id) === employeeId)?.full_name}
                <button onClick={() => setEmployeeId('all')} className="hover:text-red-500 ml-0.5">×</button>
              </span>
            )}
            <button
              onClick={() => { setPeriod('all'); setDeptId('all'); setEmployeeId('all'); }}
              className="text-[11px] text-slate-400 hover:text-red-500 underline underline-offset-2"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}

        {/* Summary badge: showing N/total contracts */}
        <div className="w-full text-[11px] text-slate-400 sm:ml-auto sm:w-auto">
          {contracts.length} / {allContracts.length} hợp đồng
          {projects.length !== allProjects.length && <span className="ml-2">{projects.length} / {allProjects.length} dự án</span>}
        </div>
      </div>

      {/* ── Hàng 1: 4 KPI thẻ tóm tắt ── */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
      >

        {/* KPI 1 – Doanh thu thực tế + tỉ lệ hoàn thành */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="w-7 h-7 rounded bg-emerald-50 flex items-center justify-center shrink-0">
              <CircleDollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${achievementRate >= 80 ? 'bg-emerald-100 text-emerald-700' : achievementRate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
              {achievementRate}% HT
            </span>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Doanh thu thực tế</p>
            <p className="text-lg font-black text-slate-900 mt-0.5 leading-tight">{formatCurrency(stats.actualRevenue)}</p>
          </div>
          <div className="mt-auto">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span>KH ký: {formatCurrency(stats.totalRevenue)}</span>
              <span>{achievementRate}%</span>
            </div>
            <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(achievementRate, 100)}%` }} />
            </div>
          </div>
        </motion.div>

        {/* KPI 2 – Forecast tháng + gap */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="w-7 h-7 rounded bg-blue-50 flex items-center justify-center shrink-0">
              <CalendarClock className="w-4 h-4 text-primary" />
            </div>
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${forecastGapPositive ? 'bg-blue-50 text-primary' : 'bg-red-100 text-red-600'}`}>
              {forecastGapPositive ? '▲' : '▼'} Tháng
            </span>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Forecast tháng hiện tại</p>
            <p className="text-lg font-black text-slate-900 mt-0.5 leading-tight">{formatCurrency(stats.forecastRevenueMonth)}</p>
          </div>
          <p className={`text-[11px] mt-auto ${forecastGapPositive ? 'text-primary' : 'text-red-500'}`}>
            {forecastGapPositive ? '+' : ''}{formatCurrency(forecastVsActualGap)} so với thực tế
          </p>
        </motion.div>

        {/* KPI 3 – Forecast quý */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="w-7 h-7 rounded bg-amber-50 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Quý</span>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Forecast quý hiện tại</p>
            <p className="text-lg font-black text-slate-900 mt-0.5 leading-tight">{formatCurrency(stats.forecastRevenueQuarter)}</p>
          </div>
          <p className="text-[11px] text-slate-400 mt-auto">Dự kiến thu trong quý theo kỳ thanh toán</p>
        </motion.div>

        {/* KPI 4 – Rủi ro thu nợ */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className={`rounded-lg border p-3 shadow-sm flex flex-col gap-2 ${stats.overduePaymentCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between gap-2">
            <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${stats.overduePaymentCount > 0 ? 'bg-red-100' : 'bg-emerald-50'}`}>
              <AlertTriangle className={`w-4 h-4 ${stats.overduePaymentCount > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
            </div>
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${stats.overduePaymentCount > 0 ? 'bg-red-200 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {stats.overduePaymentCount > 0 ? 'Rủi ro' : 'An toàn'}
            </span>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Nợ quá hạn</p>
            <p className={`text-lg font-black mt-0.5 leading-tight ${stats.overduePaymentCount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              {stats.overduePaymentCount > 0 ? formatCurrency(stats.overduePaymentAmount) : '0 đ'}
            </p>
          </div>
          <p className={`text-[11px] mt-auto ${stats.overduePaymentCount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            {stats.overduePaymentCount > 0 ? `${stats.overduePaymentCount} kỳ chưa thu` : 'Không có kỳ nào quá hạn'}
          </p>
        </motion.div>
      </div>

      {/* ── Hàng 2: Biểu đồ doanh thu + Tỷ lệ thu tiền ── */}
      <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_320px]">

        {/* Biểu đồ cột Thực tế vs KH */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Kế hoạch vs Thực tế</p>
                <h3 className="text-xs font-bold text-slate-800">Doanh thu 6 tháng gần nhất</h3>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-200" />KH</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary" />TT</span>
            </div>
          </div>

          {monthlyRevenueComparison.length === 0 ? (
            <div className="h-28 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
              Chưa có dữ liệu tháng
            </div>
          ) : (
            <div className="flex items-end gap-2 h-28 pt-2">
              {monthlyRevenueComparison.map((item) => {
                const plannedH = maxMonthlyValue > 0 ? (item.planned / maxMonthlyValue) * 100 : 0;
                const actualH = maxMonthlyValue > 0 ? (item.actual / maxMonthlyValue) * 100 : 0;
                const over = item.actual > item.planned;
                return (
                  <div key={item.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div className="w-full flex items-end justify-center gap-0.5 h-20">
                      <div className="w-[45%] rounded-t bg-slate-200" style={{ height: `${plannedH}%`, minHeight: 2 }} title={`KH: ${formatCurrency(item.planned)}`} />
                      <div className={`w-[45%] rounded-t transition-all ${over ? 'bg-emerald-500' : 'bg-primary'}`} style={{ height: `${actualH}%`, minHeight: 2 }} title={`TT: ${formatCurrency(item.actual)}`} />
                    </div>
                    <p className="text-[10px] font-semibold text-slate-600 truncate w-full text-center">{item.month}</p>
                    {over && <span className="text-[9px] text-emerald-600 font-bold">▲</span>}
                    {!over && item.actual < item.planned && <span className="text-[9px] text-red-500 font-bold">▼</span>}
                    {item.actual === item.planned && <span className="text-[9px] text-slate-300">—</span>}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Tỷ lệ thu tiền – donut */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded bg-emerald-50 flex items-center justify-center">
              <CircleDollarSign className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Thu nợ</p>
              <h3 className="text-xs font-bold text-slate-800">Tỷ lệ thu tiền</h3>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-1">
            <CollectionDonut rate={Math.max(0, Math.min(100, Math.round(stats.collectionRate || 0)))} />
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Đã thu</span>
                <span className="font-bold text-emerald-700">{Math.max(0, Math.min(100, Math.round(stats.collectionRate || 0)))}%</span>
              </div>
              <div className="h-1 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, Math.round(stats.collectionRate || 0)))}%` }} /></div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Còn lại</span>
                <span className="font-bold text-slate-600">{100 - Math.max(0, Math.min(100, Math.round(stats.collectionRate || 0)))}%</span>
              </div>
              <div className="h-1 rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-300" style={{ width: `${100 - Math.max(0, Math.min(100, Math.round(stats.collectionRate || 0)))}%` }} /></div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Hàng 3: Tổng thể HĐ + Tiến độ DA ── */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ContractStatusCard data={contractStatusCounts} />
        <ProjectStatusCard data={projectStatusCounts} maxValue={maxProjectValue} activeCount={activeProjects} totalCount={totalProjects} />
      </div>

      {/* ── Hàng 4: Cảnh báo HĐ hết hạn (full width) ── */}
      <ExpiringContractsCard data={expiringContracts} />

    </div>
  );
};

// CollectionDonut — mini SVG donut used inside the collection card
const CollectionDonut: React.FC<{ rate: number }> = ({ rate }) => {
  const strokeDasharray = `${rate * 2.51} 251`;
  const color = rate >= 80 ? '#16a34a' : rate >= 50 ? '#d97706' : '#dc2626';
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 100 100" className="h-20 w-20 -rotate-90">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={strokeDasharray} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-black text-slate-900">{rate}%</span>
        <span className="text-[9px] uppercase tracking-[0.1em] text-slate-400">thu</span>
      </div>
    </div>
  );
};

interface ProjectStatusCardProps {
  data: ProjectStatusBreakdown[];
  maxValue: number;
  activeCount: number;
  totalCount: number;
}

const ProjectStatusCard: React.FC<ProjectStatusCardProps> = ({ data, maxValue, activeCount, totalCount }) => (
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
    className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
          <Briefcase className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Tổng thể thi công</p>
          <h3 className="text-xs font-bold text-slate-800">Tiến độ dự án</h3>
        </div>
      </div>
      <div className="text-right">
        <p className="text-base font-black text-slate-900">{activeCount}<span className="text-slate-400 text-xs font-normal">/{totalCount}</span></p>
        <p className="text-[10px] text-slate-400">đang thực hiện</p>
      </div>
    </div>

    {data.length === 0 ? (
      <div className="h-20 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">Chưa có dữ liệu dự án</div>
    ) : (
      <div className="space-y-2">
        {data.map((item) => (
          <div key={item.status}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: resolveProjectStatusColor(item.status) }} />
                {getProjectStatusLabel(item.status)}
              </span>
              <span className="text-slate-400">{item.count}</span>
            </div>
            <div className="h-1 rounded-full bg-slate-100">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(item.count / maxValue) * 100}%`, backgroundColor: resolveProjectStatusColor(item.status) }} />
            </div>
          </div>
        ))}
      </div>
    )}
  </motion.div>
);

interface ContractStatusCardProps {
  data: ContractStatusBreakdown[];
}

const ContractStatusCard: React.FC<ContractStatusCardProps> = ({ data }) => {
  const totalContracts = data.reduce((sum, item) => sum + item.count, 0);
  const totalValue = data.reduce((sum, item) => sum + item.totalValue, 0);
  const gradient = buildContractStatusGradient(data, totalContracts);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Phân bổ hợp đồng</p>
            <h3 className="text-xs font-bold text-slate-800">Danh mục hợp đồng</h3>
          </div>
        </div>
        <div className="text-right">
          <p className="text-base font-black text-slate-900">{totalContracts}</p>
          <p className="text-[10px] text-slate-400">{formatCurrency(totalValue)}</p>
        </div>
      </div>

      {totalContracts === 0 ? (
        <div className="h-20 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">Chưa có dữ liệu hợp đồng</div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <div className="w-20 h-20 rounded-full" style={{ background: gradient }} />
          </div>
          <div className="flex-1 space-y-1.5 min-w-0">
            {data.map((item) => {
              const percent = totalContracts > 0 ? Math.round((item.count / totalContracts) * 100) : 0;
              return (
                <div key={item.status}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: contractStatusColors[item.status] }} />
                      {contractStatusLabels[item.status]}
                    </span>
                    <span className="text-slate-400">{item.count} · {percent}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: contractStatusColors[item.status] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
};

interface ExpiringContractsCardProps {
  data: ExpiringContractSummary[];
}

const ExpiringContractsCard: React.FC<ExpiringContractsCardProps> = ({ data }) => (
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
    className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-amber-50 flex items-center justify-center">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Cảnh báo rủi ro</p>
          <h3 className="text-xs font-bold text-slate-800">Hợp đồng sắp hết hiệu lực</h3>
        </div>
      </div>
      {data.length > 0 && (
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
          {data.length} HĐ · {data.filter((d: ExpiringContractSummary) => d.daysRemaining <= 7).length} khẩn
        </span>
      )}
    </div>

    {data.length === 0 ? (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
        <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <span className="text-emerald-600 text-[11px] font-black">✓</span>
        </span>
        <p className="text-xs text-emerald-700 font-medium">Không có hợp đồng nào sắp hết hạn trong 30 ngày tới.</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {data.map((item: ExpiringContractSummary) => (
          <div key={String(item.id)} className={`rounded-lg border p-2.5 flex items-start justify-between gap-2 ${item.daysRemaining <= 7 ? 'border-red-200 bg-red-50' : 'border-amber-100 bg-amber-50/40'}`}>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-900 truncate">{item.contract_code}</p>
              <p className="text-[11px] text-slate-600 truncate">{item.contract_name}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{item.customer_name}</p>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{formatCurrency(item.value)} · hạn {formatDate(item.expiry_date)}</p>
            </div>
            <span className={`shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded-full ${item.daysRemaining <= 7 ? 'bg-red-200 text-red-700' : 'bg-amber-200 text-amber-800'}`}>
              {item.daysRemaining}d
            </span>
          </div>
        ))}
      </div>
    )}
  </motion.div>
);

const buildContractStatusGradient = (items: ContractStatusBreakdown[], total: number): string => {
  if (!total) {
    return 'conic-gradient(#e5e7eb 0deg, #e5e7eb 360deg)';
  }

  let offset = 0;
  const segments = items
    .filter((item) => item.count > 0)
    .map((item) => {
      const share = (item.count / total) * 100;
      const segment = `${contractStatusColors[item.status]} ${offset}% ${offset + share}%`;
      offset += share;
      return segment;
    });

  if (!segments.length) {
    return 'conic-gradient(#e5e7eb 0deg, #e5e7eb 360deg)';
  }

  return `conic-gradient(${segments.join(', ')})`;
};
