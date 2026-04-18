import React, { useMemo } from 'react';
import type {
  YeuCauDashboardOperationalCounts,
  YeuCauDashboardOperationalSummary,
  YeuCauDashboardPayload,
  YeuCauDashboardTopPerformer,
  YeuCauDashboardUnitMetric,
} from '../../types/customerRequest';
import type { CustomerRequestRoleFilter } from './presentation';

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

type KpiTone = 'slate' | 'blue' | 'emerald';

const emptyOperationalCounts = (): YeuCauDashboardOperationalCounts => ({
  total_cases: 0,
  active_cases: 0,
  completed_cases: 0,
  waiting_customer_feedback_cases: 0,
  completion_rate: 0,
});

const resolveOperationalSummary = (
  dashboard: YeuCauDashboardPayload | null
): YeuCauDashboardOperationalSummary => {
  const operational = dashboard?.summary.operational;
  if (operational) {
    return operational;
  }

  const totalCases = toNumber(dashboard?.summary.total_cases);
  return {
    total_cases: totalCases,
    active_cases: totalCases,
    completed_cases: 0,
    waiting_customer_feedback_cases: 0,
    completion_rate: 0,
    by_type: {
      support: {
        ...emptyOperationalCounts(),
        total_cases: totalCases,
        active_cases: totalCases,
      },
      programming: emptyOperationalCounts(),
    },
  };
};

export const CustomerRequestDashboardCards: React.FC<CustomerRequestDashboardCardsProps> = ({
  overviewDashboard,
}) => {
  const operational = useMemo(
    () => resolveOperationalSummary(overviewDashboard),
    [overviewDashboard]
  );
  const unitChart = overviewDashboard?.unit_chart ?? [];
  const topBacklogUnits = overviewDashboard?.top_backlog_units ?? [];
  const topPerformers = (overviewDashboard?.top_performers ?? []).slice(0, 10);
  const maxUnitValue = Math.max(
    1,
    ...unitChart.flatMap((unit) => [toNumber(unit.total_cases), toNumber(unit.completed_cases)])
  );
  const hasOperationalData = operational.total_cases > 0;

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),rgba(255,255,255,0.98)_42%),linear-gradient(135deg,rgba(15,23,42,0.04),rgba(255,255,255,1))] p-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                monitoring
              </span>
            </span>
            <div>
              <h3 className="text-lg font-black leading-6 text-slate-950">
                Dashboard yêu cầu khách hàng
              </h3>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-3">
            <OperationalKpiCard
              className="col-span-2 xl:col-span-1"
              icon="all_inbox"
              title="Tổng số yêu cầu"
              value={operational.total_cases}
              tone="slate"
              supportValue={operational.by_type.support.total_cases}
              programmingValue={operational.by_type.programming.total_cases}
              totalValue={operational.total_cases}
            />
            <OperationalKpiCard
              icon="pending_actions"
              title="Đang thực hiện"
              value={operational.active_cases}
              tone="blue"
              supportValue={operational.by_type.support.active_cases}
              programmingValue={operational.by_type.programming.active_cases}
              totalValue={operational.active_cases}
              metaLabel="Chờ KH"
              metaValue={operational.waiting_customer_feedback_cases}
            />
            <OperationalKpiCard
              icon="task_alt"
              title="Đã hoàn thành"
              value={operational.completed_cases}
              tone="emerald"
              supportValue={operational.by_type.support.completed_cases}
              programmingValue={operational.by_type.programming.completed_cases}
              totalValue={operational.completed_cases}
              metaLabel="HT"
              metaValue={formatPercent(operational.completion_rate)}
            />
          </div>

          {!hasOperationalData ? (
            <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white/80 px-3 py-4 text-[12px] font-semibold text-slate-500">
              Chưa có dữ liệu
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.42fr)_420px]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
          <SectionHeader title="Số lượng yêu cầu theo từng khách hàng" />

          <div className="mt-3 overflow-x-auto">
            <div className="min-w-[720px] space-y-3">
              {unitChart.length === 0 ? (
                <EmptyDashboardState message="Chưa có dữ liệu" />
              ) : (
                unitChart.map((unit) => (
                  <UnitChartRow key={unit.unit_key} unit={unit} maxValue={maxUnitValue} />
                ))
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
          <SectionHeader title="Top 5 khách hàng có yêu cầu tồn nhiều nhất" />

          <div className="mt-3 space-y-2">
            {topBacklogUnits.length === 0 ? (
              <EmptyDashboardState message="Chưa có dữ liệu" />
            ) : (
              topBacklogUnits.map((unit, index) => (
                <BacklogUnitRow key={unit.unit_key} unit={unit} rank={index + 1} />
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
        <SectionHeader title="Top 10 người xử lý" />

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[820px] w-full border-separate border-spacing-y-2 text-left">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                <th className="px-3 py-1">Người xử lý</th>
                <th className="px-3 py-1 text-right">Tổng YC</th>
                <th className="px-3 py-1 text-right">Hoàn thành</th>
                <th className="px-3 py-1 text-right">Đang giữ</th>
                <th className="px-3 py-1 text-right">Chờ KH</th>
                <th className="px-3 py-1 text-right">Tỷ lệ HT</th>
                <th className="px-3 py-1">Phân loại</th>
              </tr>
            </thead>
            <tbody>
              {topPerformers.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyDashboardState message="Chưa có dữ liệu" />
                  </td>
                </tr>
              ) : (
                topPerformers.map((performer, index) => (
                  <PerformerRow
                    key={`${performer.performer_user_id}-${performer.performer_name ?? ''}`}
                    performer={performer}
                    rank={index + 1}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const OperationalKpiCard: React.FC<{
  className?: string;
  icon: string;
  title: string;
  value: number;
  tone: KpiTone;
  supportValue: number;
  programmingValue: number;
  totalValue: number;
  metaLabel?: string;
  metaValue?: string | number;
}> = ({
  className = '',
  icon,
  title,
  value,
  tone,
  supportValue,
  programmingValue,
  totalValue,
  metaLabel,
  metaValue,
}) => {
  const toneClass = {
    slate: 'border-slate-200 bg-white text-slate-950',
    blue: 'border-sky-200 bg-sky-50/90 text-sky-950',
    emerald: 'border-emerald-200 bg-emerald-50/90 text-emerald-950',
  }[tone];

  return (
    <article className={`rounded-[24px] border p-3 shadow-sm ${toneClass} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">{title}</p>
          <p className="mt-2 text-3xl font-black leading-none">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/90 text-slate-800 shadow-sm">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            {icon}
          </span>
        </span>
      </div>
      <SplitBreakdown
        supportValue={supportValue}
        programmingValue={programmingValue}
        totalValue={totalValue}
      />
      {metaLabel ? (
        <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-2 text-[10px] font-semibold opacity-75">
          <span>{metaLabel}</span>
          <span>{metaValue}</span>
        </div>
      ) : null}
    </article>
  );
};

const SplitBreakdown: React.FC<{
  supportValue: number;
  programmingValue: number;
  totalValue: number;
}> = ({ supportValue, programmingValue, totalValue }) => {
  const safeTotal = Math.max(totalValue, supportValue + programmingValue, 1);
  const supportPct = clampPercent((supportValue / safeTotal) * 100);
  const programmingPct = clampPercent((programmingValue / safeTotal) * 100);

  return (
    <div className="mt-3 space-y-2">
      <div className="h-2 overflow-hidden rounded bg-slate-100">
        <div className="flex h-full">
          <span className="bg-sky-500" style={{ width: `${supportPct}%` }} />
          <span className="bg-emerald-500" style={{ width: `${programmingPct}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-500">
        <span>Hỗ trợ: {supportValue}</span>
        <span className="text-right">Lập trình: {programmingValue}</span>
      </div>
    </div>
  );
};

const SectionHeader: React.FC<{
  title: string;
}> = ({ title }) => (
  <div>
    <h4 className="text-sm font-black leading-5 text-slate-950">{title}</h4>
  </div>
);

const UnitChartRow: React.FC<{
  unit: YeuCauDashboardUnitMetric;
  maxValue: number;
}> = ({ unit, maxValue }) => {
  const totalPct = clampPercent((toNumber(unit.total_cases) / maxValue) * 100);
  const completedPct = clampPercent((toNumber(unit.completed_cases) / maxValue) * 100);

  return (
    <div className="grid grid-cols-[220px_minmax(0,1fr)_96px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-[12px] font-bold text-slate-900">
          {unit.customer_name || 'Chưa xác định khách hàng'}
        </p>
      </div>
      <div className="space-y-2">
        <MetricBar label="Tổng" value={unit.total_cases} widthPct={totalPct} tone="bg-slate-800" />
        <MetricBar
          label="HT"
          value={unit.completed_cases}
          widthPct={completedPct}
          tone="bg-emerald-500"
        />
      </div>
      <div className="text-right">
        <p className="text-lg font-black leading-none text-slate-950">{unit.total_cases}</p>
        <p className="mt-1 text-[10px] font-semibold text-slate-400">
          HT {formatPercent(unit.completion_rate)}
        </p>
      </div>
    </div>
  );
};

const MetricBar: React.FC<{
  label: string;
  value: number;
  widthPct: number;
  tone: string;
}> = ({ label, value, widthPct, tone }) => (
  <div className="grid grid-cols-[108px_minmax(0,1fr)_34px] items-center gap-2">
    <span className="text-[10px] font-semibold text-slate-500">{label}</span>
    <span className="h-2 overflow-hidden rounded bg-white">
      <span className={`block h-full rounded ${tone}`} style={{ width: `${widthPct}%` }} />
    </span>
    <span className="text-right text-[10px] font-bold text-slate-600">{value}</span>
  </div>
);

const BacklogUnitRow: React.FC<{
  unit: YeuCauDashboardUnitMetric;
  rank: number;
}> = ({ unit, rank }) => (
  <article className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
    <div className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[12px] font-black text-slate-700 shadow-sm">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-bold text-slate-900">
              {unit.customer_name || 'Chưa xác định khách hàng'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Tồn</p>
            <p className="text-xl font-black leading-none text-slate-950">{unit.active_cases}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-[10px] font-semibold text-slate-500">
          <span>Tổng {unit.total_cases}</span>
          <span>HT {unit.completed_cases}</span>
          <span>Chờ KH {unit.waiting_customer_feedback_cases}</span>
          <span className="text-right">HT {formatPercent(unit.completion_rate)}</span>
        </div>
      </div>
    </div>
  </article>
);

const PerformerRow: React.FC<{
  performer: YeuCauDashboardTopPerformer;
  rank: number;
}> = ({ performer, rank }) => {
  const totalCases = toNumber(performer.total_cases ?? performer.count);
  const completedCases = toNumber(performer.completed_cases);
  const activeCases = toNumber(performer.active_cases);
  const waitingCases = toNumber(performer.waiting_customer_feedback_cases);

  return (
    <tr>
      <td className="rounded-l-2xl border-y border-l border-slate-200 bg-slate-50 px-3 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[12px] font-black text-slate-700 shadow-sm">
            {rank}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-bold text-slate-900">
              {performer.performer_name || 'Chưa xác định'}
            </p>
            <p className="mt-1 truncate text-[10px] font-semibold text-slate-400">
              {performer.department_name || 'Chưa xác định đơn vị'}
            </p>
          </div>
        </div>
      </td>
      <NumericCell value={totalCases} />
      <NumericCell value={completedCases} />
      <NumericCell value={activeCases} />
      <NumericCell value={waitingCases} />
      <td className="border-y border-slate-200 bg-slate-50 px-3 py-3 text-right text-[12px] font-black text-slate-900">
        {formatPercent(performer.completion_rate)}
      </td>
      <td className="rounded-r-2xl border-y border-r border-slate-200 bg-slate-50 px-3 py-3">
        <div className="space-y-1 text-[10px] font-semibold text-slate-500">
          <p>Hỗ trợ {toNumber(performer.support_cases)}</p>
          <p>Lập trình {toNumber(performer.programming_cases)}</p>
        </div>
      </td>
    </tr>
  );
};

const NumericCell: React.FC<{ value: number }> = ({ value }) => (
  <td className="border-y border-slate-200 bg-slate-50 px-3 py-3 text-right text-[12px] font-black text-slate-900">
    {value}
  </td>
);

const EmptyDashboardState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-[12px] font-semibold text-slate-500">
    {message}
  </div>
);

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clampPercent = (value: number): number => Math.max(0, Math.min(100, value));

const formatPercent = (value: unknown): string => `${toNumber(value).toFixed(1)}%`;
