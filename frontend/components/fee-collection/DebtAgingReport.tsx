import React, { useCallback, useEffect, useState } from 'react';
import { DebtAgingReport as DebtAgingReportData, DebtTrendPoint } from '../../types';
import { fetchDebtAgingReport, fetchDebtTrend } from '../../services/v5Api';

function fmtVnd(v: number): string {
  if (!v) return '—';
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + ' tỷ';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' tr';
  return v.toLocaleString('vi-VN') + ' đ';
}

const BUCKET_COLS = [
  { key: 'current_bucket', label: 'Hiện tại', color: 'text-gray-700', headerColor: 'bg-gray-100' },
  { key: 'bucket_1_30', label: '1-30 ngày', color: 'text-yellow-700', headerColor: 'bg-yellow-50' },
  { key: 'bucket_31_60', label: '31-60 ngày', color: 'text-orange-700', headerColor: 'bg-orange-50' },
  { key: 'bucket_61_90', label: '61-90 ngày', color: 'text-red-600', headerColor: 'bg-red-50' },
  { key: 'bucket_over_90', label: '>90 ngày', color: 'text-red-800 font-bold', headerColor: 'bg-red-100' },
] as const;

interface DebtAgingReportProps {
  onNotify: (type: 'success' | 'error', title: string, message: string) => void;
}

export const DebtAgingReport: React.FC<DebtAgingReportProps> = ({ onNotify }) => {
  const [aging, setAging] = useState<DebtAgingReportData | null>(null);
  const [trend, setTrend] = useState<DebtTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [agingRes, trendRes] = await Promise.all([
        fetchDebtAgingReport(),
        fetchDebtTrend({ months: 6 }),
      ]);
      setAging(agingRes.data);
      setTrend(trendRes.data ?? []);
    } catch (err) {
      onNotify('error', 'Lỗi', err instanceof Error ? err.message : 'Không tải được báo cáo công nợ');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { void load(); }, [load]);

  const toggleRow = (customerId: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(customerId) ? next.delete(customerId) : next.add(customerId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
        Đang tải báo cáo công nợ...
      </div>
    );
  }

  if (!aging) return null;

  const { rows, totals } = aging;

  // Simple SVG trend chart
  const TrendChart: React.FC = () => {
    if (trend.length === 0) return null;
    const W = 600, H = 160, PAD = 32;
    const maxVal = Math.max(...trend.map((t) => Math.max(t.total_outstanding, t.total_overdue)), 1);
    const xScale = (i: number) => PAD + (i / (trend.length - 1 || 1)) * (W - PAD * 2);
    const yScale = (v: number) => H - PAD - (v / maxVal) * (H - PAD * 2);

    const buildPath = (vals: number[]) =>
      vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`).join(' ');

    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Xu hướng công nợ 6 tháng gần nhất</h2>
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl" style={{ minWidth: 320, height: H }}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const y = yScale(maxVal * t);
              return (
                <g key={t}>
                  <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                  <text x={PAD - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
                    {fmtVnd(maxVal * t)}
                  </text>
                </g>
              );
            })}
            {/* X labels */}
            {trend.map((t, i) => (
              <text key={i} x={xScale(i)} y={H - 6} textAnchor="middle" fontSize={9} fill="#6b7280">
                {t.month_label}
              </text>
            ))}
            {/* Total outstanding line (blue) */}
            <path d={buildPath(trend.map((t) => t.total_outstanding))} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" />
            {/* Overdue line (red) */}
            <path d={buildPath(trend.map((t) => t.total_overdue))} fill="none" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 2" strokeLinejoin="round" />
            {/* Dots */}
            {trend.map((t, i) => (
              <g key={i}>
                <circle cx={xScale(i)} cy={yScale(t.total_outstanding)} r={3} fill="#3b82f6" />
                <circle cx={xScale(i)} cy={yScale(t.total_overdue)} r={3} fill="#ef4444" />
              </g>
            ))}
          </svg>
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="inline-block w-6 h-0.5 bg-blue-500" />Tổng còn nợ</span>
          <span className="flex items-center gap-1"><span className="inline-block w-6 border-t-2 border-dashed border-red-500" />Quá hạn</span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-4">
      <TrendChart />

      {/* Aging summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { label: 'Hiện tại', v: totals.current, cls: 'bg-gray-50 border-gray-200 text-gray-700' },
          { label: '1-30 ngày', v: totals.d1_30, cls: 'bg-yellow-50 border-yellow-100 text-yellow-700' },
          { label: '31-60 ngày', v: totals.d31_60, cls: 'bg-orange-50 border-orange-100 text-orange-700' },
          { label: '61-90 ngày', v: totals.d61_90, cls: 'bg-red-50 border-red-100 text-red-600' },
          { label: '>90 ngày', v: totals.over_90, cls: 'bg-red-100 border-red-200 text-red-800' },
          { label: 'Tổng cộng', v: totals.total, cls: 'bg-gray-800 border-gray-800 text-white' },
        ].map((b) => (
          <div key={b.label} className={`rounded-lg border p-3 shadow-sm ${b.cls}`}>
            <div className="text-xs font-medium opacity-80 mb-1">{b.label}</div>
            <div className="text-base font-bold">{fmtVnd(b.v)}</div>
          </div>
        ))}
      </div>

      {/* Aging table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-8" />
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Khách hàng</th>
              {BUCKET_COLS.map((col) => (
                <th key={col.key} className={`px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide w-32 ${col.headerColor}`}>
                  {col.label}
                </th>
              ))}
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide w-32 bg-gray-100">
                Tổng nợ
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400 text-sm">
                  Không có công nợ tồn đọng
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const isExpanded = expandedRows.has(row.customer_id);
              return (
                <React.Fragment key={row.customer_id}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => toggleRow(row.customer_id)}>
                    <td className="px-3 py-2.5 text-center">
                      <span className="material-symbols-outlined text-sm text-gray-400">
                        {isExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{row.customer_name}</td>
                    {BUCKET_COLS.map((col) => (
                      <td key={col.key} className={`px-3 py-2.5 text-right ${col.color}`}>
                        {(row[col.key] as number) > 0 ? fmtVnd(row[col.key] as number) : '—'}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right font-bold text-gray-800">{fmtVnd(row.total_outstanding)}</td>
                  </tr>
                  {isExpanded && row.invoices && row.invoices.map((inv) => (
                    <tr key={inv.id} className="bg-blue-50 border-b border-blue-100 text-xs">
                      <td />
                      <td className="px-3 py-1.5 pl-8 text-blue-700 font-mono">{inv.invoice_code}</td>
                      <td colSpan={5} className="px-3 py-1.5 text-gray-600">
                        Ngày {inv.invoice_date} · Hạn {inv.due_date} · Còn nợ: <span className="font-semibold text-red-600">{fmtVnd(inv.outstanding)}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium text-gray-700">{fmtVnd(inv.outstanding)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr className="font-semibold">
                <td />
                <td className="px-3 py-2.5 text-gray-700">Tổng cộng</td>
                {BUCKET_COLS.map((col) => {
                  const key = col.key.replace('bucket_', 'd').replace('current_bucket', 'current').replace('over_90', 'over_90') as keyof typeof totals;
                  const val = col.key === 'current_bucket' ? totals.current
                    : col.key === 'bucket_1_30' ? totals.d1_30
                      : col.key === 'bucket_31_60' ? totals.d31_60
                        : col.key === 'bucket_61_90' ? totals.d61_90
                          : totals.over_90;
                  return (
                    <td key={col.key} className={`px-3 py-2.5 text-right ${col.color}`}>{fmtVnd(val)}</td>
                  );
                })}
                <td className="px-3 py-2.5 text-right text-gray-800 font-bold">{fmtVnd(totals.total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
