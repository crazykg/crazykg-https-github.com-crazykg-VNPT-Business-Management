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
const moduleSignalCardClass = 'inline-flex h-8 min-w-0 items-center gap-1.5 rounded border border-slate-200 bg-slate-50/70 px-2 shadow-sm';
const tabButtonBaseClass =
  'group inline-flex h-8 min-w-0 w-full items-center justify-center gap-1.5 rounded border px-2 text-center text-xs font-bold transition-colors sm:justify-start';

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
      <div className="p-2 pb-2.5">
        <div className={moduleShellClass}>
          <div className="flex flex-col gap-2 px-3 py-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded bg-secondary/15">
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>
                  {activeTabMeta.iconName}
                </span>
              </span>
              <h2 className="mr-1 text-sm font-bold leading-tight text-deep-teal">{activeTabMeta.label}</h2>

              <div
                data-testid="internal-user-module-signals"
                className="flex min-w-0 flex-wrap items-center gap-1.5"
              >
                {moduleSignals.map((item) => (
                  <div key={item.label} className={moduleSignalCardClass}>
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white shadow-sm ring-1 ring-slate-200">
                      {item.icon}
                    </span>
                    <span className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral">
                      {item.label}
                    </span>
                    <span className="font-black leading-none text-deep-teal">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-end">
              <div
                data-testid="internal-user-module-tabs-grid"
                className="grid min-w-0 grid-cols-3 gap-1.5 lg:w-[520px]"
              >
                {visibleTabs.map((tab) => {
                  const isActive = activeSubTab === tab.id;
                  const compactLabel = tab.id === 'dashboard' ? 'Dashboard' : tab.id === 'list' ? 'Danh sách' : tab.label;

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
                        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded ${
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
                      <span className="truncate">{compactLabel}</span>
                    </button>
                  );
                })}
              </div>

              {moduleDepartmentOptions.length > 0 ? (
                <div data-testid="internal-user-module-department-filter" className="w-full lg:w-[280px]">
                  <SearchableSelect
                    value={effectiveDepartmentFilter}
                    onChange={setModuleDepartmentFilter}
                    options={moduleDepartmentOptions}
                    placeholder={departmentScope.canBrowseSubDepartments ? 'Tất cả phòng ban' : 'Phòng ban hiện tại'}
                    triggerClassName="h-8 w-full rounded border border-slate-300 bg-white px-3 text-xs leading-5 text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                    disabled={isDepartmentFilterLocked}
                  />
                </div>
              ) : null}
            </div>
          </div>
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
