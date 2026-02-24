import React, { useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  Mars,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  Venus,
} from 'lucide-react';
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
}

const percentLabel = (value: number): string => `${value.toFixed(1)}%`;

const ageLabel = (value: number | null): string => (value === null ? '--' : `${value.toFixed(1)} tuổi`);

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

const findCount = (segments: Segment[], label: string): number =>
  segments.find((segment) => segment.label === label)?.count || 0;

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
    { label: 'Nam', count: stats.maleCount, color: '#2563eb' },
    { label: 'Nữ', count: stats.femaleCount, color: '#ec4899' },
    {
      label: 'Khác',
      count: Math.max(0, stats.totalEmployees - stats.maleCount - stats.femaleCount),
      color: '#94a3b8',
    },
  ];

  const typeSegments: Segment[] = [
    { label: 'Chính thức', count: stats.officialEmployees, color: '#2563eb' },
    { label: 'CTV', count: stats.ctvEmployees, color: '#f59e0b' },
  ];

  const genderPie = buildConicGradient(genderSegments);
  const typeDonut = buildConicGradient(typeSegments);
  const topPositions = stats.positionBreakdown.slice(0, 8);
  const topDepartments = stats.departmentTypeBreakdown.slice(0, 8);
  const maxPositionCount = Math.max(1, ...topPositions.map((item) => item.count));

  const activeCount = stats.statusBreakdown.find((item) => item.status === 'ACTIVE')?.count || 0;
  const inactiveCount = stats.statusBreakdown.find((item) => item.status === 'INACTIVE')?.count || 0;
  const bannedCount = stats.statusBreakdown.find((item) => item.status === 'BANNED')?.count || 0;
  const suspendedCount = stats.statusBreakdown.find((item) => item.status === 'SUSPENDED')?.count || 0;

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8 space-y-6 animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Dashboard Nhân sự Nội bộ</h2>
          <p className="text-slate-500 text-sm mt-1">
            Phân tích chuyên sâu theo dữ liệu `internal_users`, `positions` và `departments`.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold">
          <Users className="w-4 h-4" />
          Tổng nhân sự: {stats.totalEmployees}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Tuổi TB Nam</p>
            <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
              <Mars className="w-5 h-5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{ageLabel(stats.avgAgeMale)}</p>
          <p className="mt-1 text-xs text-slate-500">
            <Calendar className="w-3 h-3 inline mr-1" />
            {findCount(genderSegments, 'Nam')} nhân sự nam
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Tuổi TB Nữ</p>
            <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-pink-50 text-pink-600">
              <Venus className="w-5 h-5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{ageLabel(stats.avgAgeFemale)}</p>
          <p className="mt-1 text-xs text-slate-500">
            <Calendar className="w-3 h-3 inline mr-1" />
            {findCount(genderSegments, 'Nữ')} nhân sự nữ
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Tỷ lệ kích hoạt VPN</p>
            <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{percentLabel(stats.vpnEnabledPercentage)}</p>
          <p className="mt-1 text-xs text-slate-500">{stats.vpnEnabledCount}/{stats.totalEmployees} nhân sự</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Trạng thái tài khoản</p>
            <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-100 text-slate-600">
              <BarChart3 className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-2 text-xs space-y-1.5 text-slate-600">
            <p className="flex items-center justify-between">
              <span>Hoạt động</span>
              <span className="font-semibold">{activeCount}</span>
            </p>
            <p className="flex items-center justify-between">
              <span>Không hoạt động</span>
              <span className="font-semibold">{inactiveCount}</span>
            </p>
            <p className="flex items-center justify-between">
              <span>Bị khóa</span>
              <span className="font-semibold">{bannedCount}</span>
            </p>
            {suspendedCount > 0 && (
              <p className="flex items-center justify-between">
                <span>Luân chuyển</span>
                <span className="font-semibold">{suspendedCount}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">Tỷ lệ giới tính</h3>
            <Users className="w-5 h-5 text-slate-500" />
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-5">
            <div className="w-36 h-36 rounded-full border border-slate-200 shrink-0" style={{ background: `conic-gradient(${genderPie})` }} />
            <div className="space-y-2 flex-1">
              {genderSegments.map((segment) => (
                <p key={segment.label} className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                    {segment.label}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {segment.count} ({percentLabel(percentageFromCount(segment.count, stats.totalEmployees))})
                  </span>
                </p>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">Tỷ lệ loại hình nhân sự</h3>
            <UserCheck className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-5">
            <div className="relative w-36 h-36 shrink-0">
              <div className="absolute inset-0 rounded-full border border-slate-200" style={{ background: `conic-gradient(${typeDonut})` }} />
              <div className="absolute inset-[22%] rounded-full bg-white border border-slate-100" />
            </div>
            <div className="space-y-2 flex-1">
              <p className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  Chính thức
                </span>
                <span className="font-semibold text-slate-900">
                  {stats.officialEmployees} ({percentLabel(stats.officialPercentage)})
                </span>
              </p>
              <p className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  CTV
                </span>
                <span className="font-semibold text-slate-900">
                  {stats.ctvEmployees} ({percentLabel(stats.ctvPercentage)})
                </span>
              </p>
              <div className="pt-2">
                <p className="text-xs text-slate-500 inline-flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  Màu xanh Blue-600: Nhân sự chính thức
                </p>
                <p className="text-xs text-slate-500 inline-flex items-center gap-2">
                  <UserPlus className="w-3.5 h-3.5 text-amber-600" />
                  Màu Amber/Gray: Cộng tác viên
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">Phân bổ nhân sự theo chức danh</h3>
            <BarChart3 className="w-5 h-5 text-slate-500" />
          </div>
          <div className="space-y-3">
            {topPositions.length > 0 ? (
              topPositions.map((item) => (
                <div key={`${item.position_code ?? 'NA'}-${item.position_name}`} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <p className="text-slate-700">{item.position_name}</p>
                    <p className="text-slate-900 font-semibold">{item.count}</p>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(item.count / maxPositionCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Chưa có dữ liệu chức danh để hiển thị.</p>
            )}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">Cơ cấu Chính thức/CTV theo phòng ban</h3>
            <Users className="w-5 h-5 text-slate-500" />
          </div>
          <div className="space-y-3">
            {topDepartments.length > 0 ? (
              topDepartments.map((department) => (
                <div key={`${department.department_id ?? '--'}-${department.dept_code}`} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <p className="text-slate-700">
                      {department.dept_code} - {department.dept_name}
                    </p>
                    <p className="text-slate-900 font-semibold">{department.total}</p>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-blue-600"
                      style={{ width: `${department.total ? (department.official_count / department.total) * 100 : 0}%` }}
                    />
                    <div
                      className="h-full bg-amber-500"
                      style={{ width: `${department.total ? (department.ctv_count / department.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Chưa có dữ liệu phòng ban để hiển thị.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const percentageFromCount = (count: number, total: number): number => {
  if (total <= 0) return 0;
  return (count / total) * 100;
};
