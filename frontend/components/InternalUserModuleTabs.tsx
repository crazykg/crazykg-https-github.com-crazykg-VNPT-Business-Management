import React from 'react';
import { Department, Employee, EmployeePartyListItem, HRStatistics, ModalType, PaginatedQuery, PaginationMeta } from '../types';
import { EmployeeList } from './EmployeeList';
import { EmployeePartyList } from './EmployeePartyList';
import { InternalUserDashboard } from './InternalUserDashboard';

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

const TABS: Array<{ id: InternalUserSubTab; label: string }> = [
  { id: 'dashboard', label: 'Dashboard nhân sự' },
  { id: 'list', label: 'Danh sách nhân sự' },
  { id: 'party', label: 'Đảng viên' },
];

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

  return (
    <div>
      <div className="px-4 md:px-8 pt-4 md:pt-8">
        <div className="bg-white border border-slate-200 rounded-xl px-4">
          <div className="flex items-center gap-4 overflow-x-auto">
            {visibleTabs.map((tab) => {
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSubTabChange(tab.id)}
                  className={`py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? 'font-bold text-blue-600 border-blue-600'
                      : 'font-medium text-slate-500 border-transparent hover:text-slate-700'
                  }`}
                >
                  {tab.label}
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
