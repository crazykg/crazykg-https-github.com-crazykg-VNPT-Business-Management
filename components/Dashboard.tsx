
import React, { useState, useMemo } from 'react';
import { Department, ModalType } from '../types';

interface DashboardProps {
  departments: Department[];
  onOpenModal: (type: ModalType, item?: Department) => void;
}

const ITEMS_PER_PAGE = 6;

export const Dashboard: React.FC<DashboardProps> = ({ departments, onOpenModal }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Stats calculation
  const activeCount = departments.filter(d => d.status === 'Active').length;
  const inactiveCount = departments.length - activeCount;

  // Filter Data
  const filteredDepartments = useMemo(() => {
    return departments.filter(dept => {
      const matchesSearch = 
        dept.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        dept.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter 
        ? (statusFilter === 'ACTIVE' ? dept.status === 'Active' : dept.status === 'Inactive')
        : true;
      
      return matchesSearch && matchesStatus;
    });
  }, [departments, searchTerm, statusFilter]);

  // Pagination Logic
  const totalItems = filteredDepartments.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  // Reset to page 1 if search/filter changes
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(totalPages);
  }

  const currentData = filteredDepartments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8 animate-fade-in">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Quản lý Phòng ban</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý cơ cấu tổ chức và các đơn vị.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => onOpenModal('IMPORT_DATA')}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">upload</span>
            <span className="hidden sm:inline">Nhập</span>
          </button>
          <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm">
            <span className="material-symbols-outlined text-lg">download</span>
            <span className="hidden sm:inline">Xuất</span>
          </button>
          <button 
            onClick={() => onOpenModal('ADD_DEPARTMENT')}
            className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20"
          >
            <span className="material-symbols-outlined">add</span>
            <span>Thêm mới</span>
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Tổng số</p>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg material-symbols-outlined">account_tree</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{departments.length}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Hoạt động</p>
            <span className="p-2 bg-green-50 text-green-600 rounded-lg material-symbols-outlined">check_circle</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{activeCount}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Ngừng hoạt động</p>
            <span className="p-2 bg-red-50 text-red-600 rounded-lg material-symbols-outlined">cancel</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{inactiveCount}</p>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-col md:flex-row gap-4 items-center">
          <div className="w-full md:flex-1 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input 
              type="text" 
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Tìm kiếm mã hoặc tên phòng ban..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none"
            />
          </div>
          <div className="w-full md:w-48 relative">
            <select 
              value={statusFilter}
              onChange={handleStatusChange}
              className="w-full pl-3 pr-8 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm appearance-none text-slate-600 outline-none cursor-pointer"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Ngừng hoạt động</option>
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
          </div>
        </div>

        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  {['Mã phòng ban', 'Tên phòng ban', 'Phòng ban cha', 'Trạng thái'].map((head) => (
                    <th key={head} className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      <div className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors">
                        <span className="text-deep-teal">{head}</span>
                        <span className="material-symbols-outlined text-sm text-deep-teal">unfold_more</span>
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right whitespace-nowrap sticky right-0 bg-slate-50 shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {currentData.length > 0 ? (
                  currentData.map((dept) => (
                    <tr key={dept.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 text-sm font-mono text-slate-500 group-hover:text-primary transition-colors cursor-pointer" onClick={() => onOpenModal('VIEW_DEPARTMENT', dept)}>{dept.id}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900 group-hover:text-primary transition-colors cursor-pointer" onClick={() => onOpenModal('VIEW_DEPARTMENT', dept)}>{dept.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{dept.parent || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${dept.status === 'Active' ? 'bg-secondary/30 text-deep-teal' : 'bg-slate-100 text-slate-500'}`}>
                          {dept.status === 'Active' ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right sticky right-0 bg-white group-hover:bg-slate-50 shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => onOpenModal('EDIT_DEPARTMENT', dept)}
                            className="p-1.5 text-slate-400 hover:text-primary transition-colors rounded hover:bg-slate-100"
                            title="Chỉnh sửa"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button 
                            onClick={() => onOpenModal(dept.employeeCount && dept.employeeCount > 0 ? 'CANNOT_DELETE' : 'DELETE_DEPARTMENT', dept)}
                            className="p-1.5 text-slate-400 hover:text-error transition-colors rounded hover:bg-red-50"
                            title="Xóa"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-4xl text-slate-300">search_off</span>
                        <p>Không tìm thấy kết quả nào phù hợp.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              Hiển thị <span className="font-medium">{totalItems > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</span>-
              <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, totalItems)}</span> / 
              <span className="font-medium"> {totalItems}</span>
            </p>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1 rounded border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              
              {/* Simplified Dynamic Page Numbers for Mobile */}
              <div className="flex gap-1">
                 {Array.from({ length: totalPages }, (_, i) => i + 1)
                   .filter(page => page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1))
                   .map((page, index, array) => (
                    <React.Fragment key={page}>
                        {index > 0 && array[index - 1] !== page - 1 && <span className="px-2 text-slate-400">...</span>}
                        <button
                          onClick={() => goToPage(page)}
                          className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold transition-all ${
                            currentPage === page 
                              ? 'bg-primary text-white shadow-md shadow-primary/20' 
                              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {page}
                        </button>
                    </React.Fragment>
                  ))}
              </div>

              <button 
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1 rounded border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
