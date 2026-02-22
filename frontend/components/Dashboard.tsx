import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  DashboardStats,
  OpportunityStage,
  PipelineStageBreakdown,
  ProjectStatus,
  ProjectStatusBreakdown
} from '../types';
import { DollarSign, Target, Briefcase, TrendingUp } from 'lucide-react';

const pipelineStageColors: Record<OpportunityStage, string> = {
  LEAD: '#0ea5e9',
  QUALIFIED: '#22d3ee',
  PROPOSAL: '#a855f7',
  NEGOTIATION: '#f97316',
  CLOSED_WON: '#16a34a',
  CLOSED_LOST: '#ef4444',
};

const pipelineStageLabels: Record<OpportunityStage, string> = {
  LEAD: 'Lead',
  QUALIFIED: 'Đã xác định',
  PROPOSAL: 'Chào giá',
  NEGOTIATION: 'Thương thảo',
  CLOSED_WON: 'Trúng thầu',
  CLOSED_LOST: 'Thất bại',
};

const projectStatusColors: Record<ProjectStatus, string> = {
  ACTIVE: '#22c55e',
  COMPLETED: '#0ea5e9',
  SUSPENDED: '#f97316',
  TERMINATED: '#ef4444',
};

const projectStatusLabels: Record<ProjectStatus, string> = {
  ACTIVE: 'Đang chạy',
  COMPLETED: 'Hoàn thành',
  SUSPENDED: 'Tạm dừng',
  TERMINATED: 'Chấm dứt',
};

const formatCurrency = (value: number) => {
  const formatted = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
  return formatted.replace('₫', 'đ');
};

interface DashboardProps {
  stats: DashboardStats;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats }) => {
  const totalPipelineValue = stats.pipelineByStage.reduce((sum, stage) => sum + stage.value, 0);
  const pieGradient = buildPieGradient(stats.pipelineByStage, totalPipelineValue);
  const leadingStage =
    stats.pipelineByStage.length > 0
      ? stats.pipelineByStage.reduce(
          (prev, current) => (current.value > prev.value ? current : prev),
          stats.pipelineByStage[0]
        )
      : { stage: 'LEAD', value: 0 };
  const leadingPercent = totalPipelineValue
    ? Math.round((leadingStage.value / totalPipelineValue) * 100)
    : 0;
  const maxProjectValue = useMemo(
    () => Math.max(1, ...stats.projectStatusCounts.map((item) => item.count)),
    [stats.projectStatusCounts]
  );

  return (
    <div className="p-4 md:p-8 animate-fade-in space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-deep-teal to-primary p-8 rounded-3xl text-white shadow-xl shadow-primary/25 relative overflow-hidden mb-2"
      >
        <div className="relative z-10 max-w-3xl">
          <h1 className="text-2xl md:text-4xl font-black mb-3 tracking-tight">Dashboard KPI chiến lược</h1>
          <p className="text-base md:text-lg font-medium opacity-90 leading-relaxed">
            Tích hợp dữ liệu từ bảng contracts, opportunities và projects theo đúng cấu trúc SQL v210226 để
            đo lường doanh thu, pipeline và tiến độ dự án. Mọi chỉ số cập nhật dựa trên mock data hiện có.
          </p>
        </div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
      </motion.div>

      <div className="grid gap-6">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <RevenueCard totalRevenue={stats.totalRevenue} />
          <PipelineCard
            pipelineByStage={stats.pipelineByStage}
            totalPipeline={totalPipelineValue}
            pieGradient={pieGradient}
            leadingStage={leadingStage}
            leadingPercent={leadingPercent}
          />
        </div>
        <ProjectStatusCard data={stats.projectStatusCounts} maxValue={maxProjectValue} />
      </div>

      <div className="mt-2 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Hoạt động gần đây
          </h3>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                  <span className="material-symbols-outlined">person</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">Cập nhật trạng thái dự án HIS</p>
                  <p className="text-xs text-slate-500">Bởi Admin • 2 giờ trước</p>
                </div>
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">Dự án</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">calendar_today</span>
            Sắp tới
          </h3>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Ngày mai</p>
              <p className="text-sm font-bold text-slate-900">Họp giao ban tuần</p>
              <p className="text-xs text-slate-500">09:00 - 10:30</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">22/02/2026</p>
              <p className="text-sm font-bold text-slate-900">Hết hạn hợp đồng VNPT-01</p>
              <p className="text-xs text-slate-500">Cần liên hệ gia hạn</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface RevenueCardProps {
  totalRevenue: number;
}

const RevenueCard: React.FC<RevenueCardProps> = ({ totalRevenue }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-2xl transition-shadow duration-300 transform hover:-translate-y-1 group flex flex-col gap-4"
  >
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Doanh thu hợp đồng đã ký</p>
        <p className="text-4xl md:text-5xl font-black text-slate-900 mt-3">{formatCurrency(totalRevenue)}</p>
      </div>
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-deep-teal text-white shadow-lg shadow-primary/30">
        <DollarSign className="w-6 h-6" />
      </div>
    </div>
    <p className="text-sm text-slate-500">
      Tổng hợp từ bảng contracts, chỉ tính các phiên bản có trạng thái <span className="font-semibold">SIGNED</span>.
    </p>
  </motion.div>
);

interface PipelineCardProps {
  pipelineByStage: PipelineStageBreakdown[];
  totalPipeline: number;
  pieGradient: string;
  leadingStage: PipelineStageBreakdown;
  leadingPercent: number;
}

const PipelineCard: React.FC<PipelineCardProps> = ({
  pipelineByStage,
  totalPipeline,
  pieGradient,
  leadingStage,
  leadingPercent,
}) => {
  const [activeStage, setActiveStage] = useState<OpportunityStage | null>(null);
  const highlightedStage = activeStage || leadingStage.stage;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-2xl transition-shadow duration-300 transform hover:-translate-y-1 flex flex-col gap-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Pipeline tiềm năng</p>
          <p className="text-3xl font-black text-slate-900 mt-2">{formatCurrency(totalPipeline)}</p>
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-slate-400">
          <Target className="w-4 h-4 text-primary" />
          Pie chart
          <TrendingUp className="w-4 h-4 text-emerald-500" />
        </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-none flex flex-col items-center gap-3">
          <div
            className="w-36 h-36 rounded-full border border-slate-100 shadow-inner"
            style={{ background: pieGradient }}
          />
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase tracking-[0.3em]">{pipelineStageLabels[highlightedStage]}</p>
            <p className="text-sm font-semibold text-slate-900">{leadingPercent}%</p>
          </div>
        </div>
        <div className="flex-1 grid gap-3">
          {pipelineByStage.map((stage) => {
            const percent = totalPipeline ? Math.round((stage.value / totalPipeline) * 100) : 0;
            const isHighlighted = highlightedStage === stage.stage;
            return (
              <div
                key={stage.stage}
                className={`group relative flex items-center justify-between rounded-2xl px-3 py-2 transition-all duration-200 ${
                  isHighlighted
                    ? 'bg-slate-50 shadow-sm ring-1 ring-slate-200'
                    : 'bg-white border border-slate-100 hover:border-slate-200'
                }`}
                onMouseEnter={() => setActiveStage(stage.stage)}
                onMouseLeave={() => setActiveStage(null)}
              >
                <span
                  className={`absolute -top-8 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-semibold text-white bg-slate-900/90 opacity-0 transition-all duration-200 pointer-events-none ${
                    isHighlighted ? 'opacity-100 -translate-y-1' : 'group-hover:opacity-100 group-hover:-translate-y-1'
                  }`}
                >
                  {`${pipelineStageLabels[stage.stage]} · ${percent}% · ${formatCurrency(stage.value)}`}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-flex"
                    style={{ backgroundColor: pipelineStageColors[stage.stage] }}
                  />
                  <span className="font-semibold text-slate-800">{pipelineStageLabels[stage.stage]}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{formatCurrency(stage.value)}</p>
                  <p className="text-xs text-slate-400">{totalPipeline ? `${percent}% pipeline` : '0%'}</p>
                </div>
              </div>
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
    className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-shadow"
  >
    <div className="flex items-center justify-between mb-5">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Trạng thái dự án</p>
        <h3 className="text-2xl font-black text-slate-900">Project execution</h3>
      </div>
      <Briefcase className="w-6 h-6 text-primary" />
    </div>
    <div className="space-y-4">
      {data.map((item) => (
        <div
          key={item.status}
          className="group relative rounded-2xl px-3 py-2 border border-transparent hover:border-slate-200 transition-all duration-200"
        >
          <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/95 px-3 py-1 text-[10px] uppercase text-white tracking-wide opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {projectStatusLabels[item.status]} · {item.count} dự án
          </span>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full inline-flex"
                style={{ backgroundColor: projectStatusColors[item.status] }}
              />
              <span className="font-semibold text-slate-800">{projectStatusLabels[item.status]}</span>
            </div>
            <span className="font-semibold text-slate-900">{item.count} dự án</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${(item.count / maxValue) * 100}%`,
                backgroundColor: projectStatusColors[item.status],
                boxShadow: `0 0 12px ${projectStatusColors[item.status]}40`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  </motion.div>
);

const buildPieGradient = (stages: PipelineStageBreakdown[], total: number) => {
  if (!total) {
    return 'conic-gradient(#e5e7eb 0deg, #e5e7eb 360deg)';
  }

  let offset = 0;
  const segments = stages
    .filter((stage) => stage.value > 0)
    .map((stage) => {
      const share = (stage.value / total) * 100;
      const segment = `${pipelineStageColors[stage.stage]} ${offset}% ${offset + share}%`;
      offset += share;
      return segment;
    });

  if (!segments.length) {
    return 'conic-gradient(#e5e7eb 0deg, #e5e7eb 360deg)';
  }

  return `conic-gradient(${segments.join(', ')})`;
};
