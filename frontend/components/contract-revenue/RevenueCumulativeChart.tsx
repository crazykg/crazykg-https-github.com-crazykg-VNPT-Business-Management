import React, { useMemo, useState } from 'react';
import { RevenueByPeriod } from '../../types';

interface RevenueCumulativeChartProps {
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

export const RevenueCumulativeChart: React.FC<RevenueCumulativeChartProps> = ({ data }) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; expected: number; actual: number } | null>(null);

  const width = Math.max(560, data.length * 132);
  const height = 320;
  const margin = { top: 20, right: 20, bottom: 60, left: 64 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxValue = useMemo(
    () => Math.max(1, ...data.flatMap((item) => [item.cumulative_expected, item.cumulative_actual])),
    [data]
  );
  const ticks = 4;

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-700">Doanh thu lũy kế</p>
        <p className="mt-3 text-sm text-slate-500">Chưa có dữ liệu lũy kế trong kỳ đã chọn.</p>
      </div>
    );
  }

  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0;
  const actualPoints = data.map((item, index) => {
    const x = margin.left + stepX * index;
    const y = margin.top + plotHeight - (item.cumulative_actual / maxValue) * plotHeight;

    return { x, y, item };
  });
  const expectedPoints = data.map((item, index) => {
    const x = margin.left + stepX * index;
    const y = margin.top + plotHeight - (item.cumulative_expected / maxValue) * plotHeight;

    return { x, y, item };
  });

  const expectedPath = expectedPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const actualPath = actualPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const actualAreaPath = [
    `M ${actualPoints[0]?.x ?? margin.left} ${margin.top + plotHeight}`,
    ...actualPoints.map((point) => `L ${point.x} ${point.y}`),
    `L ${actualPoints[actualPoints.length - 1]?.x ?? margin.left} ${margin.top + plotHeight}`,
    'Z',
  ].join(' ');

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">Doanh thu lũy kế</p>
          <p className="text-xs text-slate-500">Theo dõi khoảng cách giữa kế hoạch và thực thu theo thời gian.</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-blue-500" />
            Lũy kế dự kiến
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Lũy kế thực thu
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[320px] min-w-full">
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

          <path d={actualAreaPath} fill="rgba(16, 185, 129, 0.12)" />
          <path d={expectedPath} fill="none" stroke="#3b82f6" strokeWidth={3} strokeDasharray="8 8" strokeLinecap="round" />
          <path d={actualPath} fill="none" stroke="#10b981" strokeWidth={3.5} strokeLinecap="round" />

          {expectedPoints.map((point) => (
            <circle key={`expected-${point.item.period_key}`} cx={point.x} cy={point.y} r={4.5} fill="#ffffff" stroke="#3b82f6" strokeWidth={2} />
          ))}
          {actualPoints.map((point) => (
            <g key={`actual-${point.item.period_key}`}>
              <circle cx={point.x} cy={point.y} r={5} fill="#10b981" />
              <circle
                cx={point.x}
                cy={point.y}
                r={14}
                fill="transparent"
                onMouseEnter={() =>
                  setTooltip({
                    x: point.x,
                    y: point.y,
                    label: point.item.period_label,
                    expected: point.item.cumulative_expected,
                    actual: point.item.cumulative_actual,
                  })
                }
                onMouseLeave={() => setTooltip(null)}
              />
              <text x={point.x} y={height - 24} textAnchor="middle" className="fill-slate-500 text-[11px] font-medium">
                {point.item.period_label}
              </text>
            </g>
          ))}

          {tooltip && (
            <g transform={`translate(${Math.min(width - 236, Math.max(20, tooltip.x - 110))} ${Math.max(18, tooltip.y - 80)})`}>
              <rect width="208" height="70" rx="12" fill="#0f172a" opacity="0.96" />
              <text x="12" y="18" className="fill-slate-200 text-[11px] font-medium">
                {tooltip.label}
              </text>
              <text x="12" y="36" className="fill-blue-200 text-[11px] font-semibold">
                Dự kiến: {formatCurrency(tooltip.expected)}
              </text>
              <text x="12" y="54" className="fill-emerald-200 text-[11px] font-semibold">
                Thực thu: {formatCurrency(tooltip.actual)}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
