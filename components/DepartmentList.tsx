
import React, { useState, useMemo } from 'react';
import { Department, ModalType } from '../types';

interface DepartmentListProps {
  departments: Department[];
  onOpenModal: (type: ModalType, item?: Department) => void;
}

const ITEMS_PER_PAGE = 6;

export const DepartmentList: React.FC<DepartmentListProps> = ({ departments, onOpenModal }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Department; direction: 'asc' | 'desc' } | null>(null);
  
  // State for Menus
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);

  // Stats calculation
  const activeCount = departments.filter(d => d.status === 'Active').length;
  const inactiveCount = departments.length - activeCount;

  // Filter & Sort Data
  const filteredDepartments = useMemo(() => {
    let result = departments.filter(dept => {
      const matchesSearch = 
        dept.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        dept.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter 
        ? (statusFilter === 'ACTIVE' ? dept.status === 'Active' : dept.status === 'Inactive')
        : true;
      
      return matchesSearch && matchesStatus;
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Handle null values (e.g., parent department)
        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';

        // String sorting with Vietnamese locale support
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc'
            ? aValue.localeCompare(bValue, 'vi')
            : bValue.localeCompare(aValue, 'vi');
        }

        // Default sorting for other types (numbers, etc.)
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [departments, searchTerm, statusFilter, sortConfig]);

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

  const handleSort = (key: keyof Department) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: keyof Department) => {
    if (sortConfig?.key === key) {
      return (
        <span className="material-symbols-outlined text-sm ml-1 transition-transform duration-200" style={{ transform: sortConfig.direction === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          arrow_upward
        </span>
      );
    }
    return <span className="material-symbols-outlined text-sm text-slate-300 ml-1">unfold_more</span>;
  };

  // --- IMPORT TEMPLATE LOGIC ---
  const handleDownloadTemplate = () => {
    setShowImportMenu(false);
    // Create a sample CSV structure for Departments
    const headers = ['Mã phòng ban (ID)', 'Tên phòng ban', 'Phòng ban cha', 'Ghi chú'];
    const sampleRows = [
      ['PB001', 'Phòng Hành chính', '', 'Phòng ban cấp cao'],
      ['PB002', 'Phòng IT', 'PB001', 'Bộ phận kỹ thuật'],
      ['PB003', 'Phòng Sales', 'PB001', 'Bộ phận kinh doanh']
    ];
    
    const csvContent = [
      headers.join(','),
      ...sampleRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `mau_nhap_phong_ban.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- EXPORT LOGIC ---
  const handleExport = (type: 'excel' | 'csv' | 'pdf') => {
    setShowExportMenu(false);
    
    if (type === 'csv') {
      const headers = ['Mã PB', 'Tên phòng ban', 'Phòng ban cha', 'Trạng thái', 'Số lượng NV', 'Ngày tạo'];
      const csvContent = [
        headers.join(','),
        ...filteredDepartments.map(row => [
          row.id,
          `"${row.name}"`, 
          `"${row.parent || ''}"`,
          row.status,
          row.employeeCount || 0,
          row.createdDate || ''
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ds_phong_ban_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert(`Chức năng xuất ra ${type.toUpperCase()} đang được phát triển. Dữ liệu đã sẵn sàng để tích hợp thư viện.`);
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
          
          {/* Import Dropdown */}
          <div className="relative flex-1 lg:flex-none">
            <button 
              onClick={() => setShowImportMenu(!showImportMenu)}
              className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">upload</span>
              <span className="hidden sm:inline">Nhập</span>
              <span className="material-symbols-outlined text-sm ml-1">expand_more</span>
            </button>
            
            {showImportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowImportMenu(false)}></div>
                <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in flex flex-col">
                   <button 
                      onClick={() => {
                        setShowImportMenu(false);
                        onOpenModal('IMPORT_DATA');
                      }}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors text-left"
                   >
                      <span className="material-symbols-outlined text-lg">upload_file</span> Nhập dữ liệu
                   </button>
                   <button 
                      onClick={handleDownloadTemplate}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors text-left border-t border-slate-100"
                   >
                      <span className="material-symbols-outlined text-lg">download</span> Tải file mẫu
                   </button>
                </div>
              </>
            )}
          </div>
          
          {/* Export Dropdown */}
          <div className="relative flex-1 lg:flex-none">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              <span className="hidden sm:inline">Xuất</span>
              <span className="material-symbols-outlined text-sm ml-1">expand_more</span>
            </button>
            
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>
                <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in flex flex-col">
                   <button 
                      onClick={() => handleExport('excel')}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors text-left"
                   >
                      <span className="material-symbols-outlined text-lg">table_view</span> Excel
                   </button>
                   <button 
                      onClick={() => handleExport('csv')}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors text-left border-t border-slate-100"
                   >
                      <span className="material-symbols-outlined text-lg">csv</span> CSV
                   </button>
                   <button 
                      onClick={() => handleExport('pdf')}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-colors text-left border-t border-slate-100"
                   >
                      <span className="material-symbols-outlined text-lg">picture_as_pdf</span> PDF
                   </button>
                </div>
              </>
            )}
          </div>

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
                  {[
                    { label: 'Mã phòng ban', key: 'id' },
                    { label: 'Tên phòng ban', key: 'name' },
                    { label: 'Phòng ban cha', key: 'parent' },
                    { label: 'Trạng thái', key: 'status' }
                  ].map((col) => (
                    <th 
                      key={col.key} 
                      className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors select-none"
                      onClick={() => handleSort(col.key as keyof Department)}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-deep-teal">{col.label}</span>
                        {renderSortIcon(col.key as keyof Department)}
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
