import React from 'react';
import { Department, Employee, HRStatistics, ModalType, PaginatedQuery, PaginationMeta } from '../types';
import { EmployeeList } from './EmployeeList';
import { InternalUserDashboard } from './InternalUserDashboard';

export type InternalUserSubTab = 'dashboard' | 'list';

interface InternalUserModuleTabsProps {
  employees: Employee[];
  departments: Department[];
  hrStatistics?: HRStatistics;
  onOpenModal: (type: ModalType, item?: Employee) => void;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
  listEmployees?: Employee[];
  listMeta?: PaginationMeta;
  listLoading?: boolean;
  onListQueryChange?: (query: PaginatedQuery & { filters?: { email?: string; department_id?: string; status?: string } }) => void;
  activeSubTab: InternalUserSubTab;
  onSubTabChange: (tab: InternalUserSubTab) => void;
}

const TABS: Array<{ id: InternalUserSubTab; label: string }> = [
  { id: 'dashboard', label: 'Dashboard nhân sự' },
  { id: 'list', label: 'Danh sách nhân sự' },
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
  activeSubTab,
  onSubTabChange,
}) => {
  return (
    <div>
      <div className="px-4 md:px-8 pt-4 md:pt-8">
        <div className="bg-white border border-slate-200 rounded-xl px-4">
          <div className="flex items-center gap-4 overflow-x-auto">
            {TABS.map((tab) => {
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
