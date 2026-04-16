import React, { useMemo } from 'react';
import { Department, Employee, HRStatistics } from '../types';
import { buildHrStatistics } from '../utils/hrAnalytics';

interface InternalUserDashboardProps {
  employees: Employee[];
  departments: Department[];
  hrStatistics?: HRStatistics;
}

interface Segment {
  label: string;
  count: number;
  color: string;
  hint?: string;
}

const percentLabel = (value: number): string => `${value.toFixed(1)}%`;
const ageLabel = (value: number | null): string => (value === null ? '--' : `${value.toFixed(1)} tuổi`);
const formatCount = (value: number): string => new Intl.NumberFormat('vi-VN').format(value || 0);

const percentageFromCount = (count: number, total: number): number => {
  if (total <= 0) return 0;
  return (count / total) * 100;
};

const buildConicGradient = (segments: Segment[]): string => {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  if (total <= 0) return '#e2e8f0 0deg 360deg';
  let deg = 0;
  return segments
    .map((s) => {
      const start = deg;
      deg += (s.count / total) * 360;
      return `${s.color} ${start}deg ${deg}deg`;
    })
    .join(', ');
};

const formatDepartmentLabel = (dept?: { dept_code?: string; dept_name?: string } | null): string => {
  if (!dept) return 'Chưa có dữ liệu';
  const parts = [dept.dept_code, dept.dept_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' – ') : 'Chưa có dữ liệu';
};

// ── Primitives ────────────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ eyebrow?: string; title?: string; iconName: string }> = ({
  eyebrow, title, iconName,
}) => (
  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
    <div>
      {eyebrow ? (
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{eyebrow}</p>
      ) : null}
      {title ? <h3 className="text-xs font-bold leading-tight text-slate-700">{title}</h3> : null}
    </div>
    <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>{iconName}</span>
  </div>
);

const MiniPieChart: React.FC<{ gradient: string; size?: number; children?: React.ReactNode }> = ({
  gradient, size = 96, children,
}) => (
  <div className="relative shrink-0" style={{ width: size, height: size }}>
    <div
      className="absolute inset-0 rounded-full"
      style={{ background: `conic-gradient(${gradient})` }}
    />
    {children ? (
      <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-white">
        {children}
      </div>
    ) : null}
  </div>
);

const SegmentRow: React.FC<{
  color: string;
  label: string;
  count: number;
  secondary?: string;
  tertiary?: string;
}> = ({ color, label, count, secondary, tertiary }) => (
  <div className="flex items-center gap-2.5 py-1.5">
    <span className="mt-px h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
    <span className="min-w-0 flex-1 text-xs font-semibold text-slate-700 truncate">{label}</span>
    {secondary ? <span className="shrink-0 text-[11px] text-slate-400">{secondary}</span> : null}
    <span className="shrink-0 text-sm font-black text-deep-teal">{formatCount(count)}</span>
    {tertiary ? <span className="shrink-0 text-[11px] font-semibold text-slate-400 w-10 text-right">{tertiary}</span> : null}
  </div>
);

const FlatBar: React.FC<{ pct: number; color?: string }> = ({ pct, color = 'bg-primary' }) => (
  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
    <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }} />
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────

export const InternalUserDashboard: React.FC<InternalUserDashboardProps> = ({
  employees = [],
  departments = [],
  hrStatistics,
}) => {
  const stats = useMemo(
    () => hrStatistics ?? buildHrStatistics(employees, departments),
    [hrStatistics, employees, departments]
  );

  // ── Segments ────────────────────────────────────────────────────────────────
  const genderSegments: Segment[] = [
    { label: 'Nam', count: stats.maleCount, color: '#005BAA', hint: ageLabel(stats.avgAgeMale) },
    { label: 'Nữ', count: stats.femaleCount, color: '#00AEEF', hint: ageLabel(stats.avgAgeFemale) },
    {
      label: 'Khác',
      count: Math.max(0, stats.totalEmployees - stats.maleCount - stats.femaleCount),
      color: '#75777D',
    },
  ].filter((s) => s.count > 0);

  const typeSegments: Segment[] = [
    { label: 'Chính thức', count: stats.officialEmployees, color: '#005BAA', hint: percentLabel(stats.officialPercentage) },
    { label: 'CTV', count: stats.ctvEmployees, color: '#964201', hint: percentLabel(stats.ctvPercentage) },
  ];

  const statusMeta: Record<string, { color: string; barClass: string; hint: string }> = {
    ACTIVE:    { color: '#10B981', barClass: 'bg-success',   hint: 'Vận hành ổn định' },
    INACTIVE:  { color: '#F59E0B', barClass: 'bg-warning',   hint: 'Nghỉ việc' },
    BANNED:    { color: '#EF4444', barClass: 'bg-error',     hint: 'Tài khoản bị khóa' },
    SUSPENDED: { color: '#00AEEF', barClass: 'bg-secondary', hint: 'Điều chuyển' },
    UNKNOWN:   { color: '#75777D', barClass: 'bg-neutral',   hint: 'Chưa chuẩn hóa' },
  };

  const genderPie = buildConicGradient(genderSegments);
  const typeDonut = buildConicGradient(typeSegments);

  const topJobTitles = stats.jobTitleBreakdown.slice(0, 8);
  const topDepartments = stats.departmentTypeBreakdown.slice(0, 8);
  const maxJobCount = Math.max(1, ...topJobTitles.map((t) => t.count));
  const maxDeptCount = Math.max(1, ...topDepartments.map((d) => d.total));

  const largestDept = topDepartments[0];
  const dominantTitle = topJobTitles[0];
  const genderGap = Math.abs(stats.malePercentage - stats.femalePercentage);
  const knownGender = stats.maleCount + stats.femaleCount;

  // ── Signal cards ─────────────────────────────────────────────────────────────
  const signals = [
    {
      label: 'Chức danh',
      value: formatCount(stats.jobTitleBreakdown.length),
      hint: dominantTitle
        ? `${dominantTitle.job_title_name} · ${formatCount(dominantTitle.count)} người`
        : 'Chưa có dữ liệu',
      icon: 'work_history',
      iconColor: 'text-primary',
      bg: 'bg-primary/8',
    },
    {
      label: 'VPN kích hoạt',
      value: percentLabel(stats.vpnEnabledPercentage),
      hint: `${formatCount(stats.vpnEnabledCount)} / ${formatCount(stats.totalEmployees)} tài khoản`,
      icon: 'verified_user',
      iconColor: 'text-success',
      bg: 'bg-success/8',
    },
    {
      label: 'Khoảng lệch giới',
      value: percentLabel(genderGap),
      hint: knownGender > 0 ? `Nam / Nữ trên ${formatCount(knownGender)} hồ sơ` : 'Chưa đủ dữ liệu',
      icon: 'male',
      iconColor: 'text-secondary',
      bg: 'bg-secondary/8',
    },
    {
      label: 'ĐV lớn nhất',
      value: largestDept ? formatCount(largestDept.total) : '--',
      hint: largestDept ? formatDepartmentLabel(largestDept) : 'Chưa có dữ liệu',
      icon: 'business',
      iconColor: 'text-tertiary',
      bg: 'bg-tertiary/8',
    },
  ];

  return (
    <div className="space-y-3 p-3 pb-6">

      {/* ── Row 1: Signal KPI cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {signals.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-2.5 flex items-start justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-tight">{s.label}</span>
              <span className={`material-symbols-outlined ${s.iconColor} shrink-0`} style={{ fontSize: 17 }}>{s.icon}</span>
            </div>
            <p className="text-xl font-black leading-tight text-deep-teal">{s.value}</p>
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">{s.hint}</p>
          </div>
        ))}
      </div>

      {/* ── Row 2: Cơ cấu + Trạng thái ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">

        {/* Cơ cấu nhân sự */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionHeader eyebrow="Cơ cấu nhân sự" iconName="group" />
          <div className="divide-y divide-slate-50 px-4 py-3 space-y-4">

            {/* Giới tính */}
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Giới tính — tuổi trung bình
              </p>
              <div className="flex items-center gap-4">
                <MiniPieChart gradient={genderPie} size={88} />
                <div className="min-w-0 flex-1 divide-y divide-slate-50">
                  {genderSegments.map((s) => (
                    <SegmentRow
                      key={s.label}
                      color={s.color}
                      label={s.label}
                      count={s.count}
                      secondary={s.hint}
                      tertiary={percentLabel(percentageFromCount(s.count, stats.totalEmployees))}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Loại hình */}
            <div className="pt-3">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Loại hình — Chính thức vs CTV
              </p>
              <div className="flex items-center gap-4">
                <MiniPieChart gradient={typeDonut} size={88}>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">CT</span>
                  <span className="text-sm font-black text-deep-teal leading-tight">{percentLabel(stats.officialPercentage)}</span>
                </MiniPieChart>
                <div className="min-w-0 flex-1 divide-y divide-slate-50">
                  {typeSegments.map((s) => (
                    <SegmentRow
                      key={s.label}
                      color={s.color}
                      label={s.label}
                      count={s.count}
                      tertiary={s.hint}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trạng thái nhân sự */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionHeader eyebrow="Trạng thái nhân sự" iconName="speed" />
          <div className="px-4 py-3">
            {stats.statusBreakdown.length > 0 ? (
              <div className="space-y-3">
                {stats.statusBreakdown.map((item) => {
                  const meta = statusMeta[item.status] ?? statusMeta['UNKNOWN'];
                  return (
                    <div key={item.status}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                            <span className="ml-1.5 text-[10px] text-slate-400">{meta.hint}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-sm font-black text-deep-teal">{formatCount(item.count)}</span>
                          <span className="ml-1.5 text-[11px] font-semibold text-slate-400">{percentLabel(item.percentage)}</span>
                        </div>
                      </div>
                      <FlatBar pct={item.percentage} color={meta.barClass} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Chưa có dữ liệu trạng thái.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 3: Chức danh + Phòng ban ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">

        {/* Chức danh */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionHeader title="Phân bổ chức danh" iconName="work" />
          <div className="px-4 py-3">
            {topJobTitles.length > 0 ? (
              <div className="space-y-2.5">
                {topJobTitles.map((item, i) => (
                  <div key={`${item.job_title_name}-${i}`}>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 text-[10px] font-bold text-slate-300 w-4 text-right">#{i + 1}</span>
                        <span className="truncate text-xs font-semibold text-slate-700">{item.job_title_name}</span>
                      </div>
                      <span className="shrink-0 text-sm font-black text-deep-teal">{formatCount(item.count)}</span>
                    </div>
                    <FlatBar pct={(item.count / maxJobCount) * 100} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Chưa có dữ liệu chức danh.</p>
            )}
          </div>
        </div>

        {/* Phòng ban */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionHeader title="Cơ cấu nhân sự theo đơn vị" iconName="business" />
          <div className="px-4 py-3">
            {topDepartments.length > 0 ? (
              <div className="space-y-3">
                {topDepartments.map((dept) => (
                  <div key={`${dept.department_id ?? '--'}-${dept.dept_code}`}>
                    {/* Name + count */}
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {dept.dept_code ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{dept.dept_code}</span>
                        ) : null}
                        <p className="truncate text-xs font-semibold leading-tight text-slate-700">{dept.dept_name}</p>
                      </div>
                      <span className="shrink-0 text-sm font-black text-deep-teal">{formatCount(dept.total)}</span>
                    </div>
                    {/* Stacked bar */}
                    <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${dept.total ? (dept.official_count / dept.total) * 100 : 0}%` }}
                      />
                      <div
                        className="h-full bg-tertiary"
                        style={{ width: `${dept.total ? (dept.ctv_count / dept.total) * 100 : 0}%` }}
                      />
                    </div>
                    {/* Mini legend */}
                    <div className="mt-1 flex items-center gap-3">
                      <span className="text-[10px] text-slate-400">
                        <span className="font-semibold text-slate-600">{formatCount(dept.official_count)}</span> CT
                      </span>
                      <span className="text-[10px] text-slate-400">
                        <span className="font-semibold text-slate-600">{formatCount(dept.ctv_count)}</span> CTV
                      </span>
                      <span className="ml-auto text-[10px] text-slate-400">
                        {percentLabel(percentageFromCount(dept.total, stats.totalEmployees))} tổng lực lượng
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Chưa có dữ liệu phòng ban.</p>
            )}

            {/* Legend */}
            <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className="h-2 w-4 rounded-sm bg-primary" />
                Chính thức
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className="h-2 w-4 rounded-sm bg-tertiary" />
                CTV
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
