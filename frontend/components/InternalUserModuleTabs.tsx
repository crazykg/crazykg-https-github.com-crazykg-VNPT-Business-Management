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
  canImportList?: boolean;
  canImportParty?: boolean;
  activeSubTab: InternalUserSubTab;
  onSubTabChange: (tab: InternalUserSubTab) => void;
}

const TABS: Array<{ id: InternalUserSubTab; label: string; iconName: string; caption?: string }> = [
  {
    id: 'dashboard',
    label: 'Dashboard nhân sự',
    iconName: 'dashboard',
  },
  {
    id: 'list',
    label: 'Danh sách nhân sự',
    iconName: 'group',
  },
  {
    id: 'party',
    label: 'Đảng viên',
    iconName: 'shield',
  },
];

const moduleShellClass = 'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl';
const moduleSignalCardClass = 'rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-2 shadow-sm';
const tabButtonBaseClass =
  'group inline-flex w-full items-center gap-2 rounded-lg border px-2.5 py-2.5 text-left transition-colors';

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
  canImportList = false,
  canImportParty = false,
  activeSubTab,
  onSubTabChange,
}) => {
  const moduleTopRef = React.useRef<HTMLDivElement | null>(null);
  const isPartyTabActive = activeSubTab === 'party';
  const visibleTabs = canViewPartyTab ? TABS : TABS.filter((tab) => tab.id !== 'party');
  const stats = useMemo(() => hrStatistics ?? buildHrStatistics(employees, departments), [hrStatistics, employees, departments]);
  const activeTabMeta = visibleTabs.find((tab) => tab.id === activeSubTab) || visibleTabs[0];
  const handleTabSelect = React.useCallback((tab: InternalUserSubTab) => {
    onSubTabChange(tab);
    window.requestAnimationFrame(() => {
      moduleTopRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }, [onSubTabChange]);
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
    <div ref={moduleTopRef}>
      <div className="p-2.5 pb-3">
        <div className={moduleShellClass}>
          <div className="border-b border-slate-100 px-3 py-2 md:px-4">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-secondary/15">
                  <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>
                    {activeTabMeta.iconName}
                  </span>
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold leading-tight text-deep-teal">{activeTabMeta.label}</h2>
                  {activeTabMeta.caption ? (
                    <p className="text-[10px] leading-4 text-slate-400">{activeTabMeta.caption}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 xl:min-w-[360px]">
                {moduleSignals.map((item) => (
                  <div
                    key={item.label}
                    className={moduleSignalCardClass}
                  >
                    <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white shadow-sm ring-1 ring-slate-200">
                        {item.icon}
                      </span>
                      {item.label}
                    </div>
                    <p className="mt-1 text-base font-black leading-none text-deep-teal">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-1.5 bg-slate-50/50 px-3 py-2 md:grid-cols-3 md:px-4">
            {visibleTabs.map((tab) => {
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabSelect(tab.id)}
                  className={`${tabButtonBaseClass} ${
                    isActive
                      ? 'border-primary bg-primary-container-soft text-deep-teal shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded ${
                      isActive ? 'bg-primary text-white' : 'bg-primary/10'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined ${isActive ? 'text-white' : 'text-primary'}`}
                      style={{ fontSize: 15 }}
                    >
                      {tab.iconName}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[15px] font-bold leading-5 ${isActive ? 'text-deep-teal' : 'text-deep-teal'}`}>
                      {tab.label}
                    </span>
                    {tab.caption ? (
                      <span className={`mt-0.5 block text-[10px] leading-4 ${isActive ? 'text-neutral' : 'text-slate-400'}`}>
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
          canImport={canImportParty}
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
          canImport={canImportList}
          paginationMeta={listMeta}
          isLoading={listLoading}
          onQueryChange={onListQueryChange}
        />
      )}
    </div>
  );
};
