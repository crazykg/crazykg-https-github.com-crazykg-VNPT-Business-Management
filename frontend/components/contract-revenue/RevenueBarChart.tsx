import React, { useMemo, useState } from 'react';
import { RevenueByPeriod } from '../../types';

interface RevenueBarChartProps {
  data: RevenueByPeriod[];
}

const formatCompactCurrency = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1)}B`;
  }
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  }
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value || 0);
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0);

export const RevenueBarChart: React.FC<RevenueBarChartProps> = ({ data }) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: number; series: string } | null>(null);

  const width = Math.max(560, data.length * 132);
  const height = 320;
  const margin = { top: 22, right: 20, bottom: 60, left: 64 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxValue = useMemo(() => Math.max(1, ...data.flatMap((item) => [item.expected, item.actual])), [data]);
  const ticks = 4;

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold text-slate-700">Doanh thu dự kiến vs thực thu</p>
        <p className="mt-2 text-xs text-slate-500">Chưa có dữ liệu doanh thu trong kỳ đã chọn.</p>
      </div>
    );
  }

  const groupWidth = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.min(26, Math.max(12, groupWidth / 4));
  const barGap = Math.min(12, Math.max(6, groupWidth / 8));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-700">Dự kiến vs thực thu</p>
          <p className="text-[11px] text-slate-400">So sánh theo từng kỳ tháng/quý đã chọn.</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-primary shrink-0" />
            Dự kiến
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-success shrink-0" />
            Thực thu
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] min-w-full">
          {Array.from({ length: ticks + 1 }).map((_, index) => {
            const ratio = index / ticks;
            const y = margin.top + plotHeight - ratio * plotHeight;
            const value = Math.round(maxValue * ratio);

            return (
              <g key={`tick-${index}`}>
                <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
                <text x={margin.left - 10} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px] font-medium">
                  {formatCompactCurrency(value)}
                </text>
              </g>
            );
          })}

          {data.map((item, index) => {
            const xCenter = margin.left + groupWidth * index + groupWidth / 2;
            const expectedHeight = (item.expected / maxValue) * plotHeight;
            const actualHeight = (item.actual / maxValue) * plotHeight;
            const expectedX = xCenter - barGap / 2 - barWidth;
            const actualX = xCenter + barGap / 2;
            const expectedY = margin.top + plotHeight - expectedHeight;
            const actualY = margin.top + plotHeight - actualHeight;

            return (
              <g key={item.period_key}>
                <rect
                  x={expectedX}
                  y={expectedY}
                  width={barWidth}
                  height={Math.max(expectedHeight, 1)}
                  rx={8}
                  fill="#005BAA"
                  opacity={0.92}
                  onMouseEnter={() =>
                    setTooltip({
                      x: expectedX + barWidth / 2,
                      y: expectedY,
                      label: item.period_label,
                      value: item.expected,
                      series: 'Doanh thu dự kiến',
                    })
                  }
                  onMouseLeave={() => setTooltip(null)}
                />
                <rect
                  x={actualX}
                  y={actualY}
                  width={barWidth}
                  height={Math.max(actualHeight, 1)}
                  rx={8}
                  fill="#10B981"
                  opacity={0.94}
                  onMouseEnter={() =>
                    setTooltip({
                      x: actualX + barWidth / 2,
                      y: actualY,
                      label: item.period_label,
                      value: item.actual,
                      series: 'Doanh thu thực thu',
                    })
                  }
                  onMouseLeave={() => setTooltip(null)}
                />
                <text
                  x={xCenter}
                  y={height - 24}
                  textAnchor="middle"
                  className="fill-slate-500 text-[11px] font-medium"
                >
                  {item.period_label}
                </text>
              </g>
            );
          })}

          {tooltip && (
            <g transform={`translate(${Math.min(width - 220, Math.max(20, tooltip.x - 96))} ${Math.max(18, tooltip.y - 64)})`}>
              <rect width="192" height="56" rx="10" fill="#0f172a" opacity="0.96" />
              <text x="12" y="18" className="fill-slate-200 text-[11px] font-medium">
                {tooltip.label}
              </text>
              <text x="12" y="34" className="fill-white text-[12px] font-semibold">
                {tooltip.series}
              </text>
              <text x="12" y="50" fill="#6ee7b7" fontSize={12} fontWeight="bold">
                {formatCurrency(tooltip.value)}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
