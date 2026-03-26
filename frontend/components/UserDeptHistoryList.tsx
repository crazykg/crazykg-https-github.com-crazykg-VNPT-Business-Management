import React, { useState, useMemo } from 'react';
import { UserDeptHistory, Employee, Department, ModalType } from '../types';
import { getEmployeeCode, getEmployeeLabel as formatEmployeeLabel, normalizeEmployeeCode } from '../utils/employeeDisplay';

interface UserDeptHistoryListProps {
  history: UserDeptHistory[];
  employees: Employee[];
  departments: Department[];
  onOpenModal: (type: ModalType, item?: UserDeptHistory) => void;
}

export const UserDeptHistoryList: React.FC<UserDeptHistoryListProps> = ({ 
  history = [], employees = [], departments = [], onOpenModal 
}) => {
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
    // Check both department id and legacy code/name.
    const dept = departments.find(
      d => String(d.id) === String(id) || d.dept_code === id || d.dept_name === id
    );
    if (dept) return `${dept.dept_code} - ${dept.dept_name}`;
    if (deptCode || deptName) return `${deptCode || id}${deptName ? ` - ${deptName}` : ''}`;
    return id;
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
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lịch sử luân chuyển</h1>
          <p className="text-slate-500 mt-1">Quản lý lịch sử điều chuyển nhân sự giữa các phòng ban</p>
        </div>
        <button 
          onClick={() => onOpenModal('ADD_USER_DEPT_HISTORY')}
          className="flex items-center gap-2 bg-primary hover:bg-deep-teal text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg shadow-primary/20 transition-all transform hover:scale-105"
        >
          <span className="material-symbols-outlined">add</span>
          Thêm mới
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input 
            type="text" 
            placeholder="Tìm kiếm theo mã LC, tên nhân viên..." 
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Mã LC</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nhân sự</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Từ phòng ban</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Đến phòng ban</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ngày luân chuyển</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Lý do</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentData.length > 0 ? (
                currentData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono font-medium text-primary">{normalizeTransferCode(item.id)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{getEmployeeLabel(item)}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {getDeptLabel(item.fromDeptId, item.fromDeptCode, item.fromDeptName)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {getDeptLabel(item.toDeptId, item.toDeptCode, item.toDeptName)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {item.transferDate}
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={item.reason}>
                      {item.reason}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => onOpenModal('EDIT_USER_DEPT_HISTORY', item)}
                          className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                          title="Chỉnh sửa"
                        >
                          <span className="material-symbols-outlined text-xl">edit</span>
                        </button>
                        <button 
                          onClick={() => onOpenModal('DELETE_USER_DEPT_HISTORY', item)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Xóa"
                        >
                          <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-4xl">history_edu</span>
                      <p>Không tìm thấy dữ liệu luân chuyển nào.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Hiển thị <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalItems)}</span> trong tổng số <span className="font-bold text-slate-900">{totalItems}</span> bản ghi
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1))
                .map((page, idx, arr) => (
                  <React.Fragment key={page}>
                    {idx > 0 && page > arr[idx - 1] + 1 && <span className="px-2 text-slate-400">...</span>}
                    <button 
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === page ? 'bg-primary text-white shadow-md' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                    >
                      {page}
                    </button>
                  </React.Fragment>
              ))}
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
