import React, { useEffect } from 'react';
import { useFeeCollectionDashboard } from '../../shared/hooks/useFeeCollection';
import { useDashboardRealtime } from '../../shared/hooks/useDashboardRealtime';
import { FeeCollectionDashboard as DashboardData, FeeCollectionKpis } from '../../types';

function fmtVnd(v: number | undefined | null): string {
  if (v === null || v === undefined) return '—';
  if (Math.abs(v) >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + ' tỷ đ';
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' tr đ';
  return v.toLocaleString('vi-VN') + ' đ';
}

interface KpiCardProps {
  icon: string;
  label: string;
  value: string | number;
  subText?: string;
  accent?: 'default' | 'green' | 'red' | 'orange' | 'blue';
}

const KpiCard: React.FC<KpiCardProps> = ({ icon, label, value, subText, accent = 'default' }) => {
  const accentClasses: Record<string, string> = {
    default: 'bg-surface-container text-neutral',
    green: 'bg-secondary-fixed text-deep-teal',
    red: 'bg-rose-50 text-rose-600',
    orange: 'bg-amber-50 text-amber-700',
    blue: 'bg-primary-container-soft text-primary',
  };
  const valueClasses: Record<string, string> = {
    default: 'text-deep-teal',
    green: 'text-deep-teal',
    red: 'text-rose-700',
    orange: 'text-amber-700',
    blue: 'text-deep-teal',
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className={`shrink-0 rounded-lg p-2 ${accentClasses[accent]}`}>
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold text-neutral">{label}</p>
        <p className={`mt-0.5 text-lg font-black leading-tight ${valueClasses[accent]}`}>{value}</p>
        {subText ? <p className="mt-1 text-[11px] leading-5 text-slate-500">{subText}</p> : null}
      </div>
    </div>
  );
};

interface Props {
  periodFrom: string;
  periodTo: string;
  onNotify: (type: 'success' | 'error', title: string, message: string) => void;
  onNavigateToInvoices?: (filter?: { customer_id?: number; status?: string }) => void;
}

export const FeeCollectionDashboard: React.FC<Props> = React.memo(function FeeCollectionDashboardComponent({
  periodFrom,
  periodTo,
  onNotify,
  onNavigateToInvoices,
}) {
  useDashboardRealtime(['fee_collection'], Boolean(periodFrom) && Boolean(periodTo));

  const {
    data: dashboardResponse,
    isLoading: loading,
    error,
  } = useFeeCollectionDashboard({
    period_from: periodFrom,
    period_to: periodTo,
  });

  useEffect(() => {
    if (!error) {
      return;
    }

    onNotify('error', 'Lỗi', error instanceof Error ? error.message : 'Không tải được dashboard');
  }, [error, onNotify]);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <span className="material-symbols-outlined animate-spin text-primary" style={{ fontSize: 16 }}>
            progress_activity
          </span>
          Đang tải dashboard...
        </div>
      </div>
    );
  }

  const data: DashboardData | null = dashboardResponse?.data ?? null;
  if (!data) return null;

  const kpis: FeeCollectionKpis = data.kpis ?? {
    expected_revenue: 0,
    actual_collected: 0,
    outstanding: 0,
    overdue_amount: 0,
    overdue_count: 0,
    collection_rate: 0,
    avg_days_to_collect: 0,
  };
  const byMonth = data.by_month ?? [];

  const BarChart: React.FC = () => {
    if (byMonth.length === 0) {
      return <div className="py-6 text-center text-xs text-slate-400">Không có dữ liệu</div>;
    }

    const W = 580;
    const H = 160;
    const PAD_L = 56;
    const PAD_R = 16;
    const PAD_T = 12;
    const PAD_B = 36;
    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;
    const maxVal = Math.max(...byMonth.flatMap((m) => [m.invoiced, m.collected]), 1);
    const BAR_GROUP = innerW / byMonth.length;
    const BAR_W = Math.max(8, BAR_GROUP * 0.35);
    const yScale = (v: number) => innerH - (v / maxVal) * innerH;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 280, height: H }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD_T + yScale(maxVal * t);
          return (
            <g key={t}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={PAD_L - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#94a3b8">
                {fmtVnd(maxVal * t)}
              </text>
            </g>
          );
        })}

        {byMonth.map((m, i) => {
          const cx = PAD_L + i * BAR_GROUP + BAR_GROUP / 2;
          const hExp = ((m.invoiced / maxVal) * innerH) || 0;
          const hAct = ((m.collected / maxVal) * innerH) || 0;
          return (
            <g key={m.month_key}>
              <rect x={cx - BAR_W - 1} y={PAD_T + yScale(m.invoiced)} width={BAR_W} height={hExp} fill="#dbeafe" rx={2} />
              <rect x={cx + 1} y={PAD_T + yScale(m.collected)} width={BAR_W} height={hAct} fill="#10b981" rx={2} />
              <text x={cx} y={H - 4} textAnchor="middle" fontSize={9} fill="#64748b">{m.month_label}</text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="space-y-3 p-3 pb-6">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-secondary/15">
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>dashboard</span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral">Collection Dashboard</p>
                <h2 className="text-sm font-bold leading-tight text-deep-teal">Toàn cảnh thu cước</h2>
                <p className="text-[11px] leading-tight text-slate-400">
                  Tập trung các chỉ số thu tiền, công nợ trọng điểm và các khoản quá hạn cần xử lý ngay.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {periodFrom} {'->'} {periodTo}
              </span>
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral ring-1 ring-slate-200">
                {byMonth.length} kỳ theo dõi
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 bg-slate-50/70 p-3 sm:grid-cols-3 xl:grid-cols-6">
          <KpiCard icon="monetization_on" label="Doanh thu kỳ" value={fmtVnd(kpis.expected_revenue)} accent="blue" />
          <KpiCard icon="payments" label="Đã thu" value={fmtVnd(kpis.actual_collected)} accent="green" />
          <KpiCard icon="account_balance_wallet" label="Còn nợ" value={fmtVnd(kpis.outstanding)} accent={kpis.outstanding > 0 ? 'orange' : 'default'} />
          <KpiCard icon="warning" label="Quá hạn" value={fmtVnd(kpis.overdue_amount)} subText={`${kpis.overdue_count} hóa đơn`} accent={kpis.overdue_count > 0 ? 'red' : 'default'} />
          <KpiCard icon="percent" label="Tỷ lệ thu" value={`${kpis.collection_rate}%`} accent={kpis.collection_rate >= 90 ? 'green' : kpis.collection_rate >= 70 ? 'orange' : 'red'} />
          <KpiCard icon="schedule" label="TB ngày thu" value={`${kpis.avg_days_to_collect} ngày`} accent="default" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <div className="rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-deep-teal">Doanh thu dự kiến vs Thực thu</h2>
              <p className="mt-0.5 text-[11px] text-slate-400">Đối chiếu nhịp phát hành hóa đơn và tiền thu thực tế theo từng tháng.</p>
            </div>
            <div className="flex flex-wrap gap-3 text-[10px] font-semibold text-slate-500">
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-primary/20" />Dự kiến</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-emerald-500" />Thực thu</span>
            </div>
          </div>
          <div className="p-4">
            <BarChart />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-deep-teal">Top 5 khách hàng nợ nhiều nhất</h2>
              <p className="mt-0.5 text-[11px] text-slate-400">Ưu tiên các hồ sơ đang chiếm tỷ trọng công nợ lớn.</p>
            </div>
            {onNavigateToInvoices ? (
              <button onClick={() => onNavigateToInvoices()} className="text-xs font-semibold text-primary transition-colors hover:text-deep-teal">
                Xem tất cả
              </button>
            ) : null}
          </div>
          {(data.top_debtors ?? []).length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-400">Không có công nợ</div>
          ) : (
            <div className="space-y-2 p-3">
              {(data.top_debtors ?? []).slice(0, 5).map((d, i) => (
                <button
                  key={d.customer_id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:bg-slate-50"
                  onClick={() => onNavigateToInvoices?.({ customer_id: d.customer_id })}
                >
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-container-soft text-[11px] font-bold text-deep-teal">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{d.customer_name}</p>
                    <p className="text-[11px] text-slate-400">{d.invoice_count} hóa đơn</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-rose-600">{fmtVnd(d.total_outstanding)}</p>
                    {d.overdue_amount > 0 ? <p className="text-[10px] font-semibold text-rose-400">QH: {fmtVnd(d.overdue_amount)}</p> : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {(data.urgent_overdue ?? []).length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-rose-100 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-rose-100 px-4 py-3">
            <div>
              <h2 className="flex items-center gap-1 text-sm font-bold text-rose-700">
                <span className="material-symbols-outlined text-base">warning</span>
                Hóa đơn quá hạn cần xử lý
              </h2>
              <p className="mt-0.5 text-[11px] text-rose-400">Danh sách ưu tiên cho nhắc nợ hoặc xử lý thu hồi ngay trong ngày.</p>
            </div>
            {onNavigateToInvoices ? (
              <button onClick={() => onNavigateToInvoices({ status: 'OVERDUE' })} className="text-xs font-semibold text-rose-600 transition-colors hover:text-rose-700">
                Xem tất cả quá hạn
              </button>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-rose-50/60 text-left">
                  <th className="px-4 py-3 font-bold uppercase tracking-[0.08em] text-rose-500">Hóa đơn</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-[0.08em] text-rose-500">Khách hàng</th>
                  <th className="px-4 py-3 text-right font-bold uppercase tracking-[0.08em] text-rose-500">Số tiền</th>
                  <th className="px-4 py-3 text-right font-bold uppercase tracking-[0.08em] text-rose-500">Quá hạn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-50">
                {(data.urgent_overdue ?? []).slice(0, 5).map((inv) => (
                  <tr key={inv.invoice_id} className="transition-colors hover:bg-rose-50/40">
                    <td className="px-4 py-3 font-mono font-semibold text-primary">{inv.invoice_code}</td>
                    <td className="px-4 py-3 text-slate-700">{inv.customer_name}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmtVnd(inv.outstanding)}</td>
                    <td className="px-4 py-3 text-right font-black text-rose-600">{inv.days_overdue} ngày</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
});
