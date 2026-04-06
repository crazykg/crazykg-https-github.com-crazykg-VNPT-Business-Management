import React, { useState, useMemo } from 'react';
import { UserDeptHistory, Employee, Department, ModalType } from '../types';
import { getEmployeeCode, getEmployeeLabel as formatEmployeeLabel, normalizeEmployeeCode } from '../utils/employeeDisplay';
import { formatDateDdMmYyyy } from '../utils/dateDisplay';
import { findUserDeptHistoryDepartment, getUserDeptHistoryDepartmentLabel } from '../utils/userDeptHistoryDepartmentDisplay';

interface UserDeptHistoryListProps {
  history: UserDeptHistory[];
  employees: Employee[];
  departments: Department[];
  onOpenModal: (type: ModalType, item?: UserDeptHistory) => void;
}

export const UserDeptHistoryList: React.FC<UserDeptHistoryListProps> = ({ 
  history = [], employees = [], departments = [], onOpenModal 
}: UserDeptHistoryListProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const normalizeTransferCode = (value: unknown): string => {
    const raw = String(value ?? '').trim().toUpperCase();
    if (!raw) return '';

    if (/^LC\d+$/.test(raw)) {
      const digits = raw.replace(/\D+/g, '');
      return `LC${digits.padStart(3, '0')}`;
    }

    const digits = raw.replace(/\D+/g, '');
    if (!digits) return raw;

    return `LC${digits.padStart(3, '0')}`;
  };

  // Helper to get labels
  const getEmployeeLabel = (item: UserDeptHistory) => {
    const userId = String(item.userId || '');
    const emp = employees.find(
      (e) =>
        String(e.id) === userId ||
        String(e.user_code || '') === userId ||
        String(e.employee_code || '') === userId
    );

    const employeeCode = emp
      ? getEmployeeCode(emp)
      : normalizeEmployeeCode(item.employeeCode || userId, userId);
    const employeeName = String(
      item.employeeName ||
      emp?.full_name ||
      emp?.username ||
      ''
    );

    return employeeName ? `${employeeCode} - ${employeeName}` : (emp ? formatEmployeeLabel(emp) : employeeCode);
  };

  const getDeptLabel = (id: string, deptCode?: string | null, deptName?: string | null) => {
    const department = findUserDeptHistoryDepartment(departments, id, deptCode, deptName);
    const resolvedLabel = getUserDeptHistoryDepartmentLabel(departments, id, { deptCode, deptName });
    const resolvedCode = String(department?.dept_code ?? deptCode ?? '').trim();
    const resolvedName = String(department?.dept_name ?? deptName ?? '').trim();

    if (resolvedCode && resolvedName && resolvedLabel === `${resolvedCode} - ${resolvedName}`) {
      return resolvedName;
    }

    return resolvedLabel;
  };

  // Filter Data
  const filteredHistory = useMemo(() => {
    return (history || []).filter(item => {
      const transferCode = normalizeTransferCode(item.id).toLowerCase();
      const empName = getEmployeeLabel(item).toLowerCase();
      const matchesSearch = 
        transferCode.includes(searchTerm.toLowerCase()) || 
        empName.includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [history, searchTerm, employees]);

  // Pagination
  const totalItems = filteredHistory.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const currentData = filteredHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="p-3 pb-6 space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between md:gap-2">
        <div>
          <h2 className="text-sm font-bold text-deep-teal">Lịch sử luân chuyển</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Quản lý lịch sử điều chuyển nhân sự giữa các đơn vị</p>
        </div>
        <button
          onClick={() => onOpenModal('ADD_USER_DEPT_HISTORY')}
          className="inline-flex items-center gap-1.5 bg-primary hover:bg-deep-teal text-white px-2.5 py-1.5 rounded text-xs font-semibold shadow-sm transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
          Thêm mới
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>search</span>
          <input
            type="text"
            placeholder="Tìm kiếm theo mã LC, tên nhân viên..."
            className="w-full h-8 pl-8 pr-3 rounded border border-slate-300 focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none transition-all text-xs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mã LC</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nhân sự</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Từ đơn vị</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Đến đơn vị</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ngày luân chuyển</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Lý do</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentData.length > 0 ? (
                currentData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-medium text-primary text-xs">{normalizeTransferCode(item.id)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 text-xs">{getEmployeeLabel(item)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {getDeptLabel(item.fromDeptId, item.fromDeptCode, item.fromDeptName)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                        {getDeptLabel(item.toDeptId, item.toDeptCode, item.toDeptName)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {formatDateDdMmYyyy(item.transferDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs max-w-xs truncate" title={item.reason}>
                      {item.reason}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onOpenModal('EDIT_USER_DEPT_HISTORY', item)}
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded transition-all"
                          title="Chỉnh sửa"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                        </button>
                        <button
                          onClick={() => onOpenModal('DELETE_USER_DEPT_HISTORY', item)}
                          className="p-1.5 text-slate-400 hover:text-error hover:bg-error/10 rounded transition-all"
                          title="Xóa"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 32 }}>history_edu</span>
                      <p className="text-xs">Không tìm thấy dữ liệu luân chuyển nào.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Hiển thị <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalItems)}</span> trong tổng số <span className="font-bold text-slate-900">{totalItems}</span> bản ghi
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-slate-200 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_left</span>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1))
                .map((page, idx, arr) => (
                  <React.Fragment key={page}>
                    {idx > 0 && page > arr[idx - 1] + 1 && <span className="px-1.5 text-slate-400 text-xs">...</span>}
                    <button
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded text-xs font-medium transition-colors ${currentPage === page ? 'bg-primary text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      {page}
                    </button>
                  </React.Fragment>
              ))}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-slate-200 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
