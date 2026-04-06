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

const buildConicGradient = (segments: Segment[]): string => {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  if (total <= 0) {
    return '#e2e8f0 0deg 360deg';
  }

  let currentDegree = 0;
  const ranges = segments.map((segment) => {
    const segmentDegree = (segment.count / total) * 360;
    const start = currentDegree;
    const end = currentDegree + segmentDegree;
    currentDegree = end;
    return `${segment.color} ${start}deg ${end}deg`;
  });

  return ranges.join(', ');
};

const formatDepartmentLabel = (department?: { dept_code?: string; dept_name?: string } | null): string => {
  if (!department) return 'Chưa có dữ liệu';
  const parts = [department.dept_code, department.dept_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' - ') : 'Chưa có dữ liệu';
};

// ── Sub-components ────────────────────────────────────────────────────────────

interface SignalCardProps {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  toneClass: string;
}

const SignalCard: React.FC<SignalCardProps> = ({ label, value, hint, icon, toneClass }) => (
  <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-semibold text-neutral">{label}</span>
      <div className={`w-7 h-7 rounded flex items-center justify-center ${toneClass}`}>
        {icon}
      </div>
    </div>
    <p className="text-xl font-black text-deep-teal leading-tight">{value}</p>
    <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>
  </div>
);

interface SectionCardProps {
  eyebrow?: string;
  title?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const SectionCard: React.FC<SectionCardProps> = ({ eyebrow, title, icon, children }) => (
  <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
      <div>
        {eyebrow ? (
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{eyebrow}</p>
        ) : null}
        {title ? <h3 className="text-xs font-bold text-slate-700 leading-tight">{title}</h3> : null}
      </div>
      <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center">
        {icon}
      </div>
    </div>
    <div className="p-4">{children}</div>
  </section>
);

export const InternalUserDashboard: React.FC<InternalUserDashboardProps> = ({
  employees = [],
  departments = [],
  hrStatistics,
}) => {
  const stats = useMemo(
    () => hrStatistics ?? buildHrStatistics(employees, departments),
    [hrStatistics, employees, departments]
  );

  const genderSegments: Segment[] = [
    { label: 'Nam', count: stats.maleCount, color: '#005BAA', hint: ageLabel(stats.avgAgeMale) },
    { label: 'Nữ', count: stats.femaleCount, color: '#00AEEF', hint: ageLabel(stats.avgAgeFemale) },
    {
      label: 'Khác',
      count: Math.max(0, stats.totalEmployees - stats.maleCount - stats.femaleCount),
      color: '#75777D',
      hint: 'Thông tin chưa xác định',
    },
  ];
  const visibleGenderSegments = genderSegments.filter((segment) => segment.count > 0);

  const typeSegments: Segment[] = [
    { label: 'Chính thức', count: stats.officialEmployees, color: '#005BAA', hint: percentLabel(stats.officialPercentage) },
    { label: 'CTV', count: stats.ctvEmployees, color: '#964201', hint: percentLabel(stats.ctvPercentage) },
  ];
  const activeCount = stats.statusBreakdown.find((item) => item.status === 'ACTIVE')?.count || 0;
  const inactiveCount = stats.statusBreakdown.find((item) => item.status === 'INACTIVE')?.count || 0;
  const bannedCount = stats.statusBreakdown.find((item) => item.status === 'BANNED')?.count || 0;
  const suspendedCount = stats.statusBreakdown.find((item) => item.status === 'SUSPENDED')?.count || 0;
  const unknownCount = stats.statusBreakdown.find((item) => item.status === 'UNKNOWN')?.count || 0;
  const statusSegments: Segment[] = [
    { label: 'Hoạt động', count: activeCount, color: '#10B981', hint: 'Tài khoản đang sử dụng bình thường' },
    { label: 'Nghỉ việc', count: inactiveCount, color: '#F59E0B', hint: 'Nghỉ việc.' },
    { label: 'Bị khóa', count: bannedCount, color: '#EF4444', hint: 'Tài khoản đang bị vô hiệu hóa' },
    { label: 'Luân chuyển', count: suspendedCount, color: '#00AEEF', hint: 'Đang ở trạng thái điều chuyển' },
    { label: 'Khác', count: unknownCount, color: '#75777D', hint: 'Thiếu chuẩn hóa trạng thái' },
  ].filter((segment) => segment.count > 0);

  const genderPie = buildConicGradient(visibleGenderSegments);
  const typeDonut = buildConicGradient(typeSegments);
  const topJobTitles = stats.jobTitleBreakdown.slice(0, 8);
  const topDepartments = stats.departmentTypeBreakdown.slice(0, 8);
  const maxJobTitleCount = Math.max(1, ...topJobTitles.map((item) => item.count));
  const maxDepartmentCount = Math.max(1, ...topDepartments.map((item) => item.total));
  const largestDepartment = topDepartments[0];
  const dominantJobTitle = topJobTitles[0];
  const knownGenderCount = stats.maleCount + stats.femaleCount;
  const genderGap = Math.abs(stats.malePercentage - stats.femalePercentage);
  const jobTitleCoverageCount = stats.jobTitleBreakdown.length;

  const signalCards = [
    {
      label: 'Phân tích chức danh',
      value: formatCount(jobTitleCoverageCount),
      hint: dominantJobTitle
        ? `${dominantJobTitle.job_title_name} đang có ${formatCount(dominantJobTitle.count)} nhân sự.`
        : 'Chưa có dữ liệu chức danh để phân tích.',
      toneClass: 'bg-primary/10',
      icon: <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>work_history</span>,
    },
    {
      label: 'Cài đặt VPN',
      value: percentLabel(stats.vpnEnabledPercentage),
      hint: `${formatCount(stats.vpnEnabledCount)}/${formatCount(stats.totalEmployees)} tài khoản đã kích hoạt VPN.`,
      toneClass: 'bg-secondary/15',
      icon: <span className="material-symbols-outlined text-success" style={{ fontSize: 16 }}>verified_user</span>,
    },
    {
      label: 'Cân bằng giới',
      value: percentLabel(genderGap),
      hint: knownGenderCount > 0
        ? `Khoảng lệch Nam/Nữ là ${percentLabel(genderGap)} trên tổng hồ sơ đã khai báo.`
        : 'Chưa đủ hồ sơ giới tính để đánh giá.',
      toneClass: 'bg-secondary/15',
      icon: <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>male</span>,
    },
    {
      label: 'Phòng ban lớn nhất',
      value: largestDepartment ? formatCount(largestDepartment.total) : '--',
      hint: largestDepartment
        ? `${formatDepartmentLabel(largestDepartment)} đang có quy mô lớn nhất.`
        : 'Chưa có dữ liệu phòng ban.',
      toneClass: 'bg-tertiary/10',
      icon: <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 16 }}>business</span>,
    },
  ];

  return (
    <div className="p-3 pb-6 space-y-3">
      {/* ── KPI signal cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {signalCards.map((item) => (
          <SignalCard key={item.label} {...item} />
        ))}
      </div>

      {/* ── Gender + Type ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-4">
        <SectionCard
          eyebrow="Cơ cấu nhân sự"
          icon={<span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>group</span>}
        >
          <div className="space-y-3">
            {/* Gender pie */}
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Giới tính — nhịp tuổi Nam / Nữ</p>
              <div className="grid gap-4 lg:grid-cols-[9rem_minmax(0,1fr)] lg:items-center">
                <div
                  className="mx-auto h-32 w-32 shrink-0 rounded-full border border-slate-200"
                  style={{ background: `conic-gradient(${genderPie})` }}
                />
                <div className="min-w-0 space-y-2">
                  {visibleGenderSegments.map((segment) => (
                    <div key={segment.label} className="rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: segment.color }} />
                            <span className="truncate">{segment.label}</span>
                          </span>
                          {segment.hint && <p className="mt-1 text-[10px] leading-4 text-slate-400">{segment.hint}</p>}
                        </div>
                        <div className="min-w-[4.75rem] shrink-0 text-right leading-none">
                          <p className="text-lg font-black text-deep-teal">{formatCount(segment.count)}</p>
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">
                            {percentLabel(percentageFromCount(segment.count, stats.totalEmployees))}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Type donut */}
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Loại hình — Chính thức vs CTV</p>
              <div className="grid gap-4 lg:grid-cols-[9rem_minmax(0,1fr)] lg:items-center">
                <div className="relative mx-auto h-32 w-32 shrink-0">
                  <div
                    className="absolute inset-0 rounded-full border border-slate-200"
                    style={{ background: `conic-gradient(${typeDonut})` }}
                  />
                  <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-white border border-slate-100">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Nòng cốt</span>
                    <span className="text-sm font-black text-deep-teal">{percentLabel(stats.officialPercentage)}</span>
                  </div>
                </div>
                <div className="min-w-0 space-y-2">
                  {typeSegments.map((segment) => (
                    <div key={segment.label} className="rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: segment.color }} />
                            <span className="truncate">{segment.label}</span>
                          </span>
                          {segment.hint && <p className="mt-1 text-[10px] leading-4 text-slate-400">{segment.hint}</p>}
                        </div>
                        <div className="min-w-[4.75rem] shrink-0 text-right leading-none">
                          <p className="text-lg font-black text-deep-teal">{formatCount(segment.count)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Account health */}
        <SectionCard
          eyebrow="Trạng thái nhân sự"
          icon={<span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>speed</span>}
        >
          <div className="space-y-2">
            {stats.statusBreakdown.map((item) => (
              <div key={item.status} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{item.label}</p>
                    <p className="text-[10px] text-slate-400 leading-4">
                      {item.status === 'ACTIVE' ? 'Nhóm vận hành ổn định.'
                        : item.status === 'INACTIVE' ? 'Nghỉ việc.'
                        : item.status === 'BANNED' ? 'Cần đối chiếu với phân quyền.'
                        : item.status === 'SUSPENDED' ? 'Đồng bộ trạng thái điều chuyển.'
                        : 'Cần chuẩn hóa hồ sơ trạng thái.'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-deep-teal">{formatCount(item.count)}</p>
                    <p className="text-[10px] font-semibold text-slate-400">{percentLabel(item.percentage)}</p>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${
                      item.status === 'ACTIVE' ? 'bg-success'
                      : item.status === 'INACTIVE' ? 'bg-warning'
                      : item.status === 'BANNED' ? 'bg-error'
                      : item.status === 'SUSPENDED' ? 'bg-secondary'
                      : 'bg-neutral'
                    }`}
                    style={{ width: `${Math.max(item.percentage, item.count > 0 ? 6 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* ── Positions + Departments ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-4">
        <SectionCard
          title="Phân bổ chức danh theo độ phủ nhân sự"
          icon={<span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>work</span>}
        >
          <div className="space-y-2">
            {topJobTitles.length > 0 ? (
              topJobTitles.map((item, index) => (
                <div key={`${item.job_title_name}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold leading-5 text-slate-700">{item.job_title_name}</p>
                      <p className="text-[10px] text-slate-400">Chức danh #{index + 1}</p>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2.5 py-1 text-xs font-black text-deep-teal shadow-sm shrink-0">
                      {formatCount(item.count)}
                      <span className="material-symbols-outlined text-secondary" style={{ fontSize: 13 }}>arrow_upward</span>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(item.count / maxJobTitleCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-500">
                Chưa có dữ liệu chức danh để hiển thị.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Cơ cấu chính thức và CTV theo từng đơn vị"
          icon={<span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>business</span>}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {topDepartments.length > 0 ? (
              topDepartments.map((department) => (
                <div
                  key={`${department.department_id ?? '--'}-${department.dept_code}`}
                  className="rounded-lg border border-slate-100 bg-slate-50/60 p-3"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{department.dept_code || 'PHÒNG BAN'}</p>
                      <p className="text-xs font-semibold text-slate-700 leading-tight mt-0.5">{department.dept_name}</p>
                    </div>
                    <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-xs font-black text-deep-teal shadow-sm shrink-0">
                      {formatCount(department.total)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 mb-2 flex">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${department.total ? (department.official_count / department.total) * 100 : 0}%` }}
                    />
                    <div
                      className="h-full bg-tertiary"
                      style={{ width: `${department.total ? (department.ctv_count / department.total) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded bg-white border border-slate-100 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-wider text-slate-400">Chính thức</p>
                      <p className="text-sm font-black text-deep-teal">{formatCount(department.official_count)}</p>
                    </div>
                    <div className="rounded bg-white border border-slate-100 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-wider text-slate-400">CTV</p>
                      <p className="text-sm font-black text-deep-teal">{formatCount(department.ctv_count)}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-400 leading-4">
                    {percentLabel(percentageFromCount(department.total, stats.totalEmployees))} tổng lực lượng · {Math.round((department.total / maxDepartmentCount) * 100)}% so với đơn vị lớn nhất.
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-500">
                Chưa có dữ liệu phòng ban để hiển thị.
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
};

const percentageFromCount = (count: number, total: number): number => {
  if (total <= 0) return 0;
  return (count / total) * 100;
};
