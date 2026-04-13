import React, { useEffect, useMemo, useState } from 'react';
import { AuthUser, Department, Employee, EmployeePartyListItem, HRStatistics, ModalType, PaginatedQuery, PaginationMeta } from '../types';
import { EmployeeList } from './EmployeeList';
import { EmployeePartyList } from './EmployeePartyList';
import { InternalUserDashboard } from './InternalUserDashboard';
import { SearchableSelect } from './SearchableSelect';
import { buildHrStatistics } from '../utils/hrAnalytics';
import { resolveInternalUserDepartmentScope } from '../utils/internalUserDepartmentScope';

export type InternalUserSubTab = 'dashboard' | 'list' | 'party';

interface InternalUserModuleTabsProps {
  authUser?: AuthUser | null;
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
const moduleSignalCardClass = 'min-w-0 rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-2 shadow-sm sm:px-2.5';
const tabButtonBaseClass =
  'group inline-flex min-w-0 w-full flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-center transition-colors sm:flex-row sm:items-center sm:justify-start sm:gap-2 sm:px-2.5 sm:py-2.5 sm:text-left';

const matchesDepartmentId = (value: unknown, departmentId: string): boolean =>
  String(value ?? '').trim() === departmentId;

const filterEmployeesByDepartment = (employees: Employee[], departmentId: string): Employee[] => {
  const normalizedDepartmentId = String(departmentId || '').trim();
  if (!normalizedDepartmentId) {
    return employees;
  }

  return employees.filter((employee) => (
    matchesDepartmentId(employee.department_id, normalizedDepartmentId)
    || matchesDepartmentId(employee.department, normalizedDepartmentId)
  ));
};

const filterPartyProfilesByDepartment = (
  partyProfiles: EmployeePartyListItem[],
  departmentId: string
): EmployeePartyListItem[] => {
  const normalizedDepartmentId = String(departmentId || '').trim();
  if (!normalizedDepartmentId) {
    return partyProfiles;
  }

  return partyProfiles.filter((profile) => matchesDepartmentId(profile.employee?.department_id, normalizedDepartmentId));
};

export const InternalUserModuleTabs: React.FC<InternalUserModuleTabsProps> = ({
  authUser = null,
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
  const visibleTabs = canViewPartyTab ? TABS : TABS.filter((tab) => tab.id !== 'party');
  const stats = useMemo(() => hrStatistics ?? buildHrStatistics(employees, departments), [hrStatistics, employees, departments]);
  const departmentScope = useMemo(
    () => resolveInternalUserDepartmentScope(authUser, departments),
    [authUser, departments]
  );
  const scopedDepartments = departmentScope.availableDepartments.length > 0
    ? departmentScope.availableDepartments
    : departments;
  const moduleDepartmentOptions = useMemo(() => {
    const scopedOptions = scopedDepartments.map((department) => ({
      value: String(department.id),
      label: `${department.dept_code} - ${department.dept_name}`,
      searchText: `${department.dept_code} ${department.dept_name}`,
    }));

    if (departmentScope.canBrowseSubDepartments && scopedOptions.length > 1) {
      return [{ value: '', label: 'Tất cả phòng ban', searchText: 'Tất cả phòng ban' }, ...scopedOptions];
    }

    return scopedOptions;
  }, [departmentScope.canBrowseSubDepartments, scopedDepartments]);
  const activeTabMeta = visibleTabs.find((tab) => tab.id === activeSubTab) || visibleTabs[0];
  const [moduleDepartmentFilter, setModuleDepartmentFilter] = useState<string>(() => departmentScope.defaultDepartmentId);
  const handleTabSelect = React.useCallback((tab: InternalUserSubTab) => {
    onSubTabChange(tab);
    window.requestAnimationFrame(() => {
      moduleTopRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }, [onSubTabChange]);

  useEffect(() => {
    const availableValues = new Set(moduleDepartmentOptions.map((option) => String(option.value)));
    setModuleDepartmentFilter((currentValue) => {
      const normalizedCurrent = String(currentValue || '').trim();
      if (normalizedCurrent && availableValues.has(normalizedCurrent)) {
        return normalizedCurrent;
      }

      if (!departmentScope.canBrowseSubDepartments && departmentScope.defaultDepartmentId) {
        return departmentScope.defaultDepartmentId;
      }

      return '';
    });
  }, [departmentScope.canBrowseSubDepartments, departmentScope.defaultDepartmentId, moduleDepartmentOptions]);

  const effectiveDepartmentFilter = departmentScope.canBrowseSubDepartments
    ? moduleDepartmentFilter
    : departmentScope.defaultDepartmentId;
  const filteredDashboardEmployees = useMemo(
    () => filterEmployeesByDepartment(employees, effectiveDepartmentFilter),
    [employees, effectiveDepartmentFilter]
  );
  const filteredDashboardStatistics = useMemo(
    () => buildHrStatistics(filteredDashboardEmployees, scopedDepartments),
    [filteredDashboardEmployees, scopedDepartments]
  );
  const filteredListEmployees = useMemo(
    () => filterEmployeesByDepartment(listEmployees || employees, effectiveDepartmentFilter),
    [listEmployees, employees, effectiveDepartmentFilter]
  );
  const filteredPartyProfiles = useMemo(
    () => filterPartyProfilesByDepartment(partyProfiles || [], effectiveDepartmentFilter),
    [partyProfiles, effectiveDepartmentFilter]
  );
  const isDepartmentFilterLocked = !departmentScope.canBrowseSubDepartments && moduleDepartmentOptions.length <= 1;
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

              <div
                data-testid="internal-user-module-signals"
                className="grid min-w-0 grid-cols-3 gap-1.5 xl:min-w-[360px]"
              >
                {moduleSignals.map((item) => (
                  <div
                    key={item.label}
                    className={moduleSignalCardClass}
                  >
                    <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white shadow-sm ring-1 ring-slate-200">
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>
                    <p className="mt-1 text-sm font-black leading-none text-deep-teal sm:text-base">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            data-testid="internal-user-module-tabs-grid"
            className="grid grid-cols-3 gap-1.5 bg-slate-50/50 px-3 py-2 md:px-4"
          >
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
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[11px] font-bold leading-4 text-deep-teal sm:text-[15px] sm:leading-5`}>
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

          {moduleDepartmentOptions.length > 0 ? (
            <div className="border-t border-slate-100 bg-slate-50/40 px-3 py-2 md:px-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-white shadow-sm ring-1 ring-slate-200">
                    <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>apartment</span>
                  </span>
                  <span>{departmentScope.canBrowseSubDepartments ? 'Lọc phòng ban' : 'Phạm vi phòng ban'}</span>
                </div>

                <div data-testid="internal-user-module-department-filter" className="w-full lg:max-w-[320px]">
                  <SearchableSelect
                    value={effectiveDepartmentFilter}
                    onChange={setModuleDepartmentFilter}
                    options={moduleDepartmentOptions}
                    placeholder={departmentScope.canBrowseSubDepartments ? 'Tất cả phòng ban' : 'Phòng ban hiện tại'}
                    triggerClassName="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm leading-6 text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 md:h-8 md:text-xs md:leading-5"
                    disabled={isDepartmentFilterLocked}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {activeSubTab === 'dashboard' ? (
        <InternalUserDashboard
          employees={filteredDashboardEmployees}
          departments={scopedDepartments}
          hrStatistics={filteredDashboardStatistics}
        />
      ) : activeSubTab === 'party' ? (
        <EmployeePartyList
          partyProfiles={filteredPartyProfiles}
          employees={employees}
          departments={scopedDepartments}
          onOpenModal={onOpenModal}
          onNotify={onNotify}
          canImport={canImportParty}
          paginationMeta={partyMeta}
          isLoading={partyLoading}
          onQueryChange={onPartyQueryChange}
          forcedDepartmentFilter={effectiveDepartmentFilter}
          hideDepartmentFilter
        />
      ) : (
        <EmployeeList
          employees={filteredListEmployees}
          departments={scopedDepartments}
          hrStatistics={hrStatistics}
          onOpenModal={onOpenModal}
          onNotify={onNotify}
          canImport={canImportList}
          paginationMeta={listMeta}
          isLoading={listLoading}
          onQueryChange={onListQueryChange}
          forcedDepartmentFilter={effectiveDepartmentFilter}
          hideDepartmentFilter
        />
      )}
    </div>
  );
};
