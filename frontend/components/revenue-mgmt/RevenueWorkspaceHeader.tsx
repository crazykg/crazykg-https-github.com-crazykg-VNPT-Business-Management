import type { ReactNode } from 'react';

type RevenueWorkspaceTone = 'primary' | 'neutral' | 'success' | 'warning';

export interface RevenueWorkspaceBadge {
  label: string;
  icon?: string;
  tone?: RevenueWorkspaceTone;
}

export interface RevenueWorkspaceMetric {
  label: string;
  value: string;
  detail?: string;
  tone?: RevenueWorkspaceTone;
}

interface Props {
  icon: string;
  title: string;
  description?: string;
  badges?: RevenueWorkspaceBadge[];
  metrics?: RevenueWorkspaceMetric[];
  actions?: ReactNode;
  children?: ReactNode;
}

function badgeToneClass(tone: RevenueWorkspaceTone): string {
  if (tone === 'primary') return 'bg-primary/10 text-primary';
  if (tone === 'success') return 'bg-secondary-fixed text-deep-teal';
  if (tone === 'warning') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
  return 'bg-white text-neutral ring-1 ring-slate-200';
}

function metricToneClass(tone: RevenueWorkspaceTone): string {
  if (tone === 'primary') return 'border-primary/15 bg-primary/5';
  if (tone === 'success') return 'border-secondary/20 bg-secondary-fixed';
  if (tone === 'warning') return 'border-amber-200 bg-amber-50/80';
  return 'border-slate-200 bg-white';
}

export function RevenueWorkspaceHeader({
  icon,
  title,
  description,
  badges = [],
  metrics = [],
  actions,
  children,
}: Props) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
      <div className="border-b border-slate-100 px-4 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/15">
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>
                  {icon}
                </span>
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold leading-tight text-deep-teal">{title}</h2>
                {description ? (
                  <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-500">{description}</p>
                ) : null}
              </div>
            </div>

            {badges.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {badges.map((badge) => (
                  <span
                    key={`${badge.label}-${badge.icon ?? 'none'}`}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${badgeToneClass(badge.tone ?? 'neutral')}`}
                  >
                    {badge.icon ? (
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                        {badge.icon}
                      </span>
                    ) : null}
                    {badge.label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {actions ? (
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              {actions}
            </div>
          ) : null}
        </div>

        {metrics.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {metrics.map((metric) => (
              <div
                key={`${metric.label}-${metric.value}`}
                className={`rounded-lg border p-3 ${metricToneClass(metric.tone ?? 'neutral')}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral">{metric.label}</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{metric.value}</p>
                {metric.detail ? (
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">{metric.detail}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {children ? (
        <div className="bg-slate-50/70 px-4 py-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}
