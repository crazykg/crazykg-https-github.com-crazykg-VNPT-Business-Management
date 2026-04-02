import React, { useMemo } from 'react';
import { Department, Employee, EmployeePartyListItem, HRStatistics, ModalType, PaginatedQuery, PaginationMeta } from '../types';
import { EmployeeList } from './EmployeeList';
import { EmployeePartyList } from './EmployeePartyList';
import { InternalUserDashboard } from './InternalUserDashboard';
import { buildHrStatistics } from '../utils/hrAnalytics';

export type InternalUserSubTab = 'dashboard' | 'list' | 'party';

interface InternalUserModuleTabsProps {
  employees: Employee[];
  departments: Department[];
  hrStatistics?: HRStatistics;
  onOpenModal: (type: ModalType, item?: Employee | EmployeePartyListItem) => void;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
  listEmployees?: Employee[];
  listMeta?: PaginationMeta;
  listLoading?: boolean;
  onListQueryChange?: (query: PaginatedQuery & { filters?: { email?: string; department_id?: string; status?: string } }) => void;
  partyProfiles?: EmployeePartyListItem[];
  partyMeta?: PaginationMeta;
  partyLoading?: boolean;
  onPartyQueryChange?: (query: PaginatedQuery & { filters?: { department_id?: string; missing_info?: string } }) => void;
  canViewPartyTab?: boolean;
  activeSubTab: InternalUserSubTab;
  onSubTabChange: (tab: InternalUserSubTab) => void;
}

const TABS: Array<{ id: InternalUserSubTab; label: string; iconName: string; caption?: string }> = [
  {
    id: 'dashboard',
    label: 'Dashboard nhân sự',
    iconName: 'dashboard',
    caption: 'Theo dõi nhanh biến động nhân sự, cơ cấu phòng ban và các chỉ số vận hành.',
  },
  {
    id: 'list',
    label: 'Danh sách nhân sự',
    iconName: 'group',
    caption: 'Quản lý hồ sơ nhân sự, tra cứu trạng thái và thao tác nhập xuất dữ liệu tập trung.',
  },
  {
    id: 'party',
    label: 'Đảng viên',
    iconName: 'shield',
    caption: 'Theo dõi hồ sơ đảng viên, mức độ đầy đủ thông tin và tiến độ cập nhật.',
  },
];

const moduleShellClass = 'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl';
const moduleSignalCardClass = 'rounded-lg border border-slate-200 bg-slate-50/60 p-3 shadow-sm';
const tabButtonBaseClass =
  'group inline-flex w-full items-start gap-2.5 rounded-lg border px-3 py-3 text-left transition-colors';

export const InternalUserModuleTabs: React.FC<InternalUserModuleTabsProps> = ({
  employees,
  departments,
  hrStatistics,
  onOpenModal,
  onNotify,
  listEmployees,
  listMeta,
  listLoading,
  onListQueryChange,
  partyProfiles,
  partyMeta,
  partyLoading,
  onPartyQueryChange,
  canViewPartyTab = true,
  activeSubTab,
  onSubTabChange,
}) => {
  const visibleTabs = canViewPartyTab ? TABS : TABS.filter((tab) => tab.id !== 'party');
  const stats = useMemo(() => hrStatistics ?? buildHrStatistics(employees, departments), [hrStatistics, employees, departments]);
  const activeTabMeta = visibleTabs.find((tab) => tab.id === activeSubTab) || visibleTabs[0];
  const moduleSignals = [
    {
      label: 'Nhân sự',
      value: new Intl.NumberFormat('vi-VN').format(stats.totalEmployees || 0),
      icon: <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>group</span>,
    },
    {
      label: 'Phòng ban',
      value: new Intl.NumberFormat('vi-VN').format(departments.length || 0),
      icon: <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>apartment</span>,
    },
    {
      label: 'Đảng viên',
      value: canViewPartyTab ? new Intl.NumberFormat('vi-VN').format(partyMeta?.total || partyProfiles?.length || 0) : '--',
      icon: <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>shield</span>,
    },
  ];

  return (
    <div>
      <div className="p-3 pb-6">
        <div className={moduleShellClass}>
          <div className="border-b border-slate-100 px-3 py-3 md:px-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded bg-secondary/15">
                  <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>
                    {activeTabMeta.iconName}
                  </span>
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral">Module nhân sự nội bộ</p>
                  <h2 className="text-sm font-bold leading-tight text-deep-teal">{activeTabMeta.label}</h2>
                  {activeTabMeta.caption ? (
                    <p className="text-[11px] leading-tight text-slate-400">{activeTabMeta.caption}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:min-w-[420px]">
                {moduleSignals.map((item) => (
                  <div
                    key={item.label}
                    className={moduleSignalCardClass}
                  >
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white shadow-sm ring-1 ring-slate-200">
                        {item.icon}
                      </span>
                      {item.label}
                    </div>
                    <p className="mt-2 text-xl font-black leading-none text-deep-teal">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 bg-slate-50/50 px-3 py-3 md:grid-cols-3 md:px-4">
            {visibleTabs.map((tab) => {
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSubTabChange(tab.id)}
                  className={`${tabButtonBaseClass} ${
                    isActive
                      ? 'border-primary bg-primary-container-soft text-deep-teal shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded ${
                      isActive ? 'bg-primary text-white' : 'bg-primary/10'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined ${isActive ? 'text-white' : 'text-primary'}`}
                      style={{ fontSize: 16 }}
                    >
                      {tab.iconName}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm font-bold ${isActive ? 'text-deep-teal' : 'text-deep-teal'}`}>
                      {tab.label}
                    </span>
                    {tab.caption ? (
                      <span className={`mt-0.5 block text-[11px] leading-tight ${isActive ? 'text-neutral' : 'text-slate-400'}`}>
                        {tab.caption}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeSubTab === 'dashboard' ? (
        <InternalUserDashboard employees={employees} departments={departments} hrStatistics={hrStatistics} />
      ) : activeSubTab === 'party' ? (
        <EmployeePartyList
          partyProfiles={partyProfiles || []}
          employees={employees}
          departments={departments}
          onOpenModal={onOpenModal}
          onNotify={onNotify}
          paginationMeta={partyMeta}
          isLoading={partyLoading}
          onQueryChange={onPartyQueryChange}
        />
      ) : (
        <EmployeeList
          employees={listEmployees || employees}
          departments={departments}
          hrStatistics={hrStatistics}
          onOpenModal={onOpenModal}
          onNotify={onNotify}
          paginationMeta={listMeta}
          isLoading={listLoading}
          onQueryChange={onListQueryChange}
        />
      )}
    </div>
  );
};
