import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Briefcase,
  CalendarClock,
  CircleDollarSign,
  FileText,
  Target,
  TrendingUp,
} from 'lucide-react';
import {
  ContractStatus,
  ContractStatusBreakdown,
  DashboardStats,
  ExpiringContractSummary,
  OpportunityStage,
  OpportunityStageOption,
  PipelineStageBreakdown,
  ProjectStatus,
  ProjectStatusBreakdown,
} from '../types';

const KNOWN_PIPELINE_STAGE_META: Record<string, { label: string; color: string }> = {
  NEW: { label: 'Mới', color: '#0ea5e9' },
  PROPOSAL: { label: 'Đề xuất', color: '#a855f7' },
  NEGOTIATION: { label: 'Đàm phán', color: '#f97316' },
  WON: { label: 'Thắng', color: '#16a34a' },
  LOST: { label: 'Thất bại', color: '#ef4444' },
};

const CUSTOM_PIPELINE_STAGE_COLOR = '#94a3b8';

const projectStatusColors: Record<ProjectStatus, string> = {
  TRIAL: '#f59e0b',
  ONGOING: '#22c55e',
  WARRANTY: '#06b6d4',
  COMPLETED: '#0ea5e9',
  CANCELLED: '#ef4444',
};

const projectStatusLabels: Record<ProjectStatus, string> = {
  TRIAL: 'Dùng thử',
  ONGOING: 'Đang triển khai theo hợp đồng',
  WARRANTY: 'Đã kết thúc - còn Bảo hành, bảo trì',
  COMPLETED: 'Đã kết thúc',
  CANCELLED: 'Đã Huỷ',
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

const normalizeStageCode = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toUpperCase();

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
  stats: DashboardStats;
  opportunityStageOptions?: OpportunityStageOption[];
}

export const Dashboard: React.FC<DashboardProps> = ({ stats, opportunityStageOptions = [] }) => {
  const stageLabelByCode = useMemo(() => {
    const map = new Map<string, string>();

    Object.entries(KNOWN_PIPELINE_STAGE_META).forEach(([code, meta]) => {
      map.set(code, meta.label);
    });

    (opportunityStageOptions || []).forEach((stage) => {
      const code = normalizeStageCode(stage.stage_code);
      if (!code) {
        return;
      }

      const label = String(stage.stage_name || '').trim();
      map.set(code, label || map.get(code) || code);
    });

    return map;
  }, [opportunityStageOptions]);

  const resolvePipelineStageLabel = (stage: OpportunityStage): string => {
    const code = normalizeStageCode(stage);
    return stageLabelByCode.get(code) || code || String(stage || '--');
  };

  const resolvePipelineStageColor = (stage: OpportunityStage): string => {
    const code = normalizeStageCode(stage);
    return KNOWN_PIPELINE_STAGE_META[code]?.color || CUSTOM_PIPELINE_STAGE_COLOR;
  };

  const totalPipelineValue = stats.pipelineByStage.reduce((sum, stage) => sum + stage.value, 0);
  const pieGradient = buildPipelineGradient(stats.pipelineByStage, totalPipelineValue, resolvePipelineStageColor);

  const leadingStage =
    stats.pipelineByStage.length > 0
      ? stats.pipelineByStage.reduce(
          (prev, current) => (current.value > prev.value ? current : prev),
          stats.pipelineByStage[0]
        )
      : ({ stage: 'NEW', value: 0 } as PipelineStageBreakdown);

  const leadingPercent = totalPipelineValue > 0
    ? Math.round((leadingStage.value / totalPipelineValue) * 100)
    : 0;

  const maxProjectValue = useMemo(
    () => Math.max(1, ...stats.projectStatusCounts.map((item) => item.count)),
    [stats.projectStatusCounts]
  );

  const maxMonthlyValue = useMemo(() => {
    const values = (stats.monthlyRevenueComparison || []).flatMap((item) => [item.planned, item.actual]);
    return Math.max(1, ...values);
  }, [stats.monthlyRevenueComparison]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-deep-teal to-primary p-8 rounded-3xl text-white shadow-xl shadow-primary/25 relative overflow-hidden"
      >
        <div className="relative z-10 max-w-3xl">
          <h1 className="text-2xl md:text-4xl font-black mb-3 tracking-tight">Bảng điều khiển KPI chiến lược</h1>
          <p className="text-base md:text-lg font-medium opacity-90 leading-relaxed">
            Theo dõi doanh thu thực tế, forecast dòng tiền và pipeline kinh doanh theo dữ liệu hợp đồng và kỳ thanh toán.
          </p>
        </div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <FinanceCard
          title="Doanh thu thực tế"
          value={formatCurrency(stats.actualRevenue)}
          hint="SUM(actual_paid_amount) các kỳ đã thu"
          icon={<CircleDollarSign className="w-5 h-5" />}
          colorClass="text-emerald-600 bg-emerald-50"
        />
        <FinanceCard
          title="Forecast tháng hiện tại"
          value={formatCurrency(stats.forecastRevenueMonth)}
          hint="Tổng expected_amount của các kỳ chờ thu trong tháng"
          icon={<CalendarClock className="w-5 h-5" />}
          colorClass="text-primary bg-blue-50"
        />
        <FinanceCard
          title="Forecast quý hiện tại"
          value={formatCurrency(stats.forecastRevenueQuarter)}
          hint="Tổng expected_amount của các kỳ chờ thu trong quý"
          icon={<CalendarClock className="w-5 h-5" />}
          colorClass="text-amber-600 bg-amber-50"
        />
        <FinanceCard
          title="Hợp đồng đã ký"
          value={formatCurrency(stats.totalRevenue)}
          hint="Tổng giá trị các hợp đồng ở trạng thái Đã ký"
          icon={<CircleDollarSign className="w-5 h-5" />}
          colorClass="text-indigo-600 bg-indigo-50"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
      >
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Phân tích kinh doanh</p>
            <h3 className="text-2xl font-black text-slate-900 mt-2">Doanh thu thực tế vs Kế hoạch theo tháng</h3>
          </div>
          <TrendingUp className="w-6 h-6 text-primary" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          {(stats.monthlyRevenueComparison || []).map((item) => (
            <div key={item.month} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="h-28 flex items-end justify-center gap-2">
                <div className="w-4 rounded-t-md bg-slate-300" style={{ height: `${(item.planned / maxMonthlyValue) * 100}%` }} />
                <div className="w-4 rounded-t-md bg-primary" style={{ height: `${(item.actual / maxMonthlyValue) * 100}%` }} />
              </div>
              <p className="text-xs font-semibold text-slate-700 text-center mt-2">{item.month}</p>
              <p className="text-[11px] text-slate-500 text-center">KH: {formatCurrency(item.planned)}</p>
              <p className="text-[11px] text-primary text-center font-semibold">TT: {formatCurrency(item.actual)}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-4 mt-4 text-xs text-slate-500">
          <div className="inline-flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-slate-300" />
            Kế hoạch
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-primary" />
            Thực tế
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <PipelineCard
          pipelineByStage={stats.pipelineByStage}
          totalPipeline={totalPipelineValue}
          pieGradient={pieGradient}
          leadingStage={leadingStage}
          leadingPercent={leadingPercent}
          resolveStageLabel={resolvePipelineStageLabel}
          resolveStageColor={resolvePipelineStageColor}
        />
        <ProjectStatusCard data={stats.projectStatusCounts} maxValue={maxProjectValue} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <ContractStatusCard data={stats.contractStatusCounts} />
        <CollectionRateCard
          collectionRate={stats.collectionRate}
          overduePaymentCount={stats.overduePaymentCount}
          overduePaymentAmount={stats.overduePaymentAmount}
        />
      </div>

      <ExpiringContractsCard data={stats.expiringContracts} />
    </div>
  );
};

interface FinanceCardProps {
  title: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  colorClass: string;
}

const FinanceCard: React.FC<FinanceCardProps> = ({ title, value, hint, icon, colorClass }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
  >
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{title}</p>
        <p className="text-xl font-black text-slate-900 mt-2">{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass}`}>
        {icon}
      </div>
    </div>
    <p className="text-xs text-slate-500 mt-3">{hint}</p>
  </motion.div>
);

interface PipelineCardProps {
  pipelineByStage: PipelineStageBreakdown[];
  totalPipeline: number;
  pieGradient: string;
  leadingStage: PipelineStageBreakdown;
  leadingPercent: number;
  resolveStageLabel: (stage: OpportunityStage) => string;
  resolveStageColor: (stage: OpportunityStage) => string;
}

const PipelineCard: React.FC<PipelineCardProps> = ({
  pipelineByStage,
  totalPipeline,
  pieGradient,
  leadingStage,
  leadingPercent,
  resolveStageLabel,
  resolveStageColor,
}) => {
  const [activeStage, setActiveStage] = useState<OpportunityStage | null>(null);
  const highlightedStage = activeStage || leadingStage.stage;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
    >
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Pipeline cơ hội</p>
          <p className="text-3xl font-black text-slate-900 mt-2">{formatCurrency(totalPipeline)}</p>
        </div>
        <Target className="w-5 h-5 text-primary" />
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-none flex flex-col items-center gap-3">
          <div
            className="w-36 h-36 rounded-full border border-slate-100 shadow-inner"
            style={{ background: pieGradient }}
          />
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase tracking-[0.3em]">{resolveStageLabel(highlightedStage)}</p>
            <p className="text-sm font-semibold text-slate-900">{leadingPercent}%</p>
          </div>
        </div>

        <div className="flex-1 grid gap-2">
          {pipelineByStage.map((stage) => {
            const percent = totalPipeline ? Math.round((stage.value / totalPipeline) * 100) : 0;
            return (
              <button
                type="button"
                key={String(stage.stage)}
                onMouseEnter={() => setActiveStage(stage.stage)}
                onMouseLeave={() => setActiveStage(null)}
                className="w-full rounded-xl border border-slate-100 hover:border-slate-200 p-3 text-left transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full inline-flex" style={{ backgroundColor: resolveStageColor(stage.stage) }} />
                    <span className="text-sm font-semibold text-slate-800">{resolveStageLabel(stage.stage)}</span>
                  </div>
                  <span className="text-xs text-slate-500">{percent}%</span>
                </div>
                <p className="text-sm font-bold text-slate-900 mt-1">{formatCurrency(stage.value)}</p>
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

interface ProjectStatusCardProps {
  data: ProjectStatusBreakdown[];
  maxValue: number;
}

const ProjectStatusCard: React.FC<ProjectStatusCardProps> = ({ data, maxValue }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
  >
    <div className="flex items-center justify-between mb-5">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Tiến độ dự án</p>
        <h3 className="text-2xl font-black text-slate-900 mt-2">Project Execution</h3>
      </div>
      <Briefcase className="w-6 h-6 text-primary" />
    </div>

    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.status}>
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span className="inline-flex items-center gap-2 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: projectStatusColors[item.status] }} />
              {projectStatusLabels[item.status]}
            </span>
            <span>{item.count} dự án</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${(item.count / maxValue) * 100}%`,
                backgroundColor: projectStatusColors[item.status],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  </motion.div>
);

interface ContractStatusCardProps {
  data: ContractStatusBreakdown[];
}

const ContractStatusCard: React.FC<ContractStatusCardProps> = ({ data }) => {
  const totalContracts = data.reduce((sum, item) => sum + item.count, 0);
  const totalValue = data.reduce((sum, item) => sum + item.totalValue, 0);
  const gradient = buildContractStatusGradient(data, totalContracts);
  const leadingStatus = data.length > 0
    ? data.reduce((prev, current) => (current.count > prev.count ? current : prev), data[0])
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
    >
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Phân bổ hợp đồng</p>
          <h3 className="text-2xl font-black text-slate-900 mt-2">{totalContracts} hợp đồng</h3>
          <p className="text-xs text-slate-500 mt-2">Tổng giá trị: {formatCurrency(totalValue)}</p>
        </div>
        <FileText className="w-6 h-6 text-primary" />
      </div>

      {totalContracts === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          Chưa có dữ liệu hợp đồng để phân tích.
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex-none flex flex-col items-center gap-3">
            <div className="w-36 h-36 rounded-full border border-slate-100 shadow-inner" style={{ background: gradient }} />
            {leadingStatus && (
              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{contractStatusLabels[leadingStatus.status]}</p>
                <p className="text-sm font-semibold text-slate-900">
                  {Math.round((leadingStatus.count / totalContracts) * 100)}% danh mục
                </p>
              </div>
            )}
          </div>

          <div className="flex-1 grid gap-2">
            {data.map((item) => {
              const percent = totalContracts > 0 ? Math.round((item.count / totalContracts) * 100) : 0;
              return (
                <div key={item.status} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: contractStatusColors[item.status] }} />
                      {contractStatusLabels[item.status]}
                    </span>
                    <span className="text-xs text-slate-500">{percent}%</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 mt-1">{item.count} hợp đồng</p>
                  <p className="text-xs text-slate-500 mt-1">{formatCurrency(item.totalValue)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
};

interface CollectionRateCardProps {
  collectionRate: number;
  overduePaymentCount: number;
  overduePaymentAmount: number;
}

const CollectionRateCard: React.FC<CollectionRateCardProps> = ({
  collectionRate,
  overduePaymentCount,
  overduePaymentAmount,
}) => {
  const rate = Math.max(0, Math.min(100, Math.round(collectionRate || 0)));
  const strokeDasharray = `${rate * 2.51} 251`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
    >
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Dòng tiền hợp đồng</p>
          <h3 className="text-2xl font-black text-slate-900 mt-2">Tỷ lệ thu tiền</h3>
        </div>
        <CircleDollarSign className="w-6 h-6 text-emerald-600" />
      </div>

      <div className="flex items-center gap-5">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#16a34a"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={strokeDasharray}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-slate-900">{rate}%</span>
            <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">đã thu</span>
          </div>
        </div>

        <div className="flex-1">
          <p className="text-sm text-slate-600 leading-relaxed">
            Tỷ lệ tổng tiền đã thu đủ trên toàn bộ kế hoạch thanh toán dự kiến của các hợp đồng.
          </p>
          <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${rate}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-2">{rate}% kế hoạch đã được thu đủ.</p>
        </div>
      </div>

      <div className={`mt-6 rounded-2xl border p-4 ${
        overduePaymentCount > 0
          ? 'border-red-200 bg-gradient-to-r from-red-50 to-orange-50'
          : 'border-emerald-200 bg-emerald-50'
      }`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className={`w-5 h-5 mt-0.5 ${overduePaymentCount > 0 ? 'text-red-500' : 'text-emerald-600'}`} />
          <div>
            <p className={`text-sm font-bold ${overduePaymentCount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              {overduePaymentCount > 0 ? `${overduePaymentCount} kỳ thanh toán quá hạn` : 'Không có kỳ thanh toán quá hạn'}
            </p>
            <p className={`text-sm mt-1 ${overduePaymentCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {overduePaymentCount > 0
                ? `Tổng nợ quá hạn: ${formatCurrency(overduePaymentAmount)}`
                : 'Dòng tiền đang ở trạng thái an toàn.'}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface ExpiringContractsCardProps {
  data: ExpiringContractSummary[];
}

const ExpiringContractsCard: React.FC<ExpiringContractsCardProps> = ({ data }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
  >
    <div className="flex items-center justify-between gap-4 mb-5">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Cảnh báo hợp đồng</p>
        <h3 className="text-2xl font-black text-slate-900 mt-2">HĐ sắp hết hiệu lực</h3>
      </div>
      <AlertTriangle className="w-6 h-6 text-amber-500" />
    </div>

    {data.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        Không có hợp đồng nào sắp hết hạn trong 30 ngày tới.
      </div>
    ) : (
      <div className="space-y-3">
        {data.map((item) => (
          <div key={String(item.id)} className="rounded-2xl border border-slate-100 p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {item.contract_code} - {item.contract_name}
                </p>
                <p className="text-sm text-slate-600 mt-1">{item.customer_name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Hết hạn: {formatDate(item.expiry_date)} · Giá trị: {formatCurrency(item.value)}
                </p>
              </div>
              <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${
                item.daysRemaining <= 7
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {item.daysRemaining} ngày
              </span>
            </div>
          </div>
        ))}
      </div>
    )}
  </motion.div>
);

const buildPipelineGradient = (
  stages: PipelineStageBreakdown[],
  total: number,
  resolveStageColor: (stage: OpportunityStage) => string
): string => {
  if (!total) {
    return 'conic-gradient(#e5e7eb 0deg, #e5e7eb 360deg)';
  }

  let offset = 0;
  const segments = stages
    .filter((stage) => stage.value > 0)
    .map((stage) => {
      const share = (stage.value / total) * 100;
      const segment = `${resolveStageColor(stage.stage)} ${offset}% ${offset + share}%`;
      offset += share;
      return segment;
    });

  if (!segments.length) {
    return 'conic-gradient(#e5e7eb 0deg, #e5e7eb 360deg)';
  }

  return `conic-gradient(${segments.join(', ')})`;
};

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
