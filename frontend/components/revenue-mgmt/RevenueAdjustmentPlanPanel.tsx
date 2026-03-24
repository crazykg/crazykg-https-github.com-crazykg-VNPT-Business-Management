import type {
  RevenueAdjustmentItem,
  RevenueAdjustmentSummary,
} from '../../utils/revenuePlanning';
import { describeRevenueAdjustment } from '../../utils/revenuePlanning';
import {
  formatCompactCurrencyVnd,
  formatCurrencyVnd,
} from '../../utils/revenueDisplay';

interface Props {
  title: string;
  compareLabel: string;
  summary: RevenueAdjustmentSummary;
  items: RevenueAdjustmentItem[];
  emptyMessage?: string;
}

function statusTone(item: RevenueAdjustmentItem): string {
  if (item.status === 'healthy') {
    return 'bg-green-50 text-green-700 border-green-200';
  }

  if (item.status === 'closed_shortfall') {
    return 'bg-red-50 text-red-700 border-red-200';
  }

  return 'bg-yellow-50 text-yellow-700 border-yellow-200';
}

function statusLabel(item: RevenueAdjustmentItem): string {
  if (item.status === 'healthy') {
    return 'Đạt kế hoạch';
  }

  if (item.status === 'closed_shortfall') {
    return 'Đóng kỳ, còn thiếu';
  }

  return item.isCurrent ? 'Cần điều chỉnh ngay' : 'Cần bám kế hoạch';
}

export function RevenueAdjustmentPlanPanel({
  title,
  compareLabel,
  summary,
  items,
  emptyMessage = 'Không có kỳ cần điều chỉnh.',
}: Props) {
  const highlightedItems = items.filter((item) => item.gapAmount > 0);

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <SummaryCard
            label="Kỳ cần điều chỉnh"
            value={String(summary.periodsNeedingAdjustment)}
            tone={summary.periodsNeedingAdjustment > 0 ? 'amber' : 'green'}
          />
          <SummaryCard
            label="Tổng phần thiếu"
            value={formatCompactCurrencyVnd(summary.totalGapAmount)}
            tone={summary.totalGapAmount > 0 ? 'red' : 'green'}
          />
          <SummaryCard
            label="Bình quân/kỳ mở"
            value={formatCompactCurrencyVnd(summary.averageGapPerOpenPeriod)}
            tone={summary.averageGapPerOpenPeriod > 0 ? 'amber' : 'default'}
          />
          <SummaryCard
            label="Nhịp bù hiện tại"
            value={summary.currentRequiredPerDay > 0
              ? `${formatCompactCurrencyVnd(summary.currentRequiredPerDay)}/ngày`
              : 'Không cần'}
            tone={summary.currentRequiredPerDay > 0 ? 'blue' : 'green'}
          />
        </div>

        {highlightedItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-green-200 bg-green-50 px-4 py-5 text-sm text-green-700">
            {emptyMessage}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Kỳ</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Kế hoạch</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">{compareLabel}</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Phần thiếu</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Trạng thái</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {highlightedItems.map((item) => (
                  <tr key={`${item.periodKey}-${compareLabel}`}>
                    <td className="px-3 py-2 font-medium text-gray-800">{item.periodLabel}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{formatCurrencyVnd(item.targetAmount)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{formatCurrencyVnd(item.comparisonAmount)}</td>
                    <td className="px-3 py-2 text-right font-medium text-red-600">
                      {formatCurrencyVnd(item.gapAmount)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusTone(item)}`}>
                        {statusLabel(item)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {describeRevenueAdjustment(item, compareLabel)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'default' | 'green' | 'amber' | 'red' | 'blue';
}) {
  const toneClass = {
    default: 'bg-gray-50 text-gray-700 border-gray-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    amber: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  }[tone];

  return (
    <div className={`rounded-lg border px-3 py-3 ${toneClass}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
