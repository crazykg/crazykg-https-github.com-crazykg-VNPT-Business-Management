import React, { useState, useMemo, useEffect } from 'react';
import { Employee, ModalType } from '../types';
import { PaginationControls } from './PaginationControls';

interface EmployeeListProps {
  employees: Employee[];
  onOpenModal: (type: ModalType, item?: Employee) => void;
}

export const EmployeeList: React.FC<EmployeeListProps> = ({ employees = [], onOpenModal }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(7);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Employee; direction: 'asc' | 'desc' } | null>(null);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);

  const activeCount = (employees || []).filter((e) => e.status === 'ACTIVE').length;
  const bannedCount = (employees || []).filter((e) => e.status === 'BANNED').length;

  const filteredEmployees = useMemo(() => {
    let result = (employees || []).filter((emp) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        String(emp.id).toLowerCase().includes(searchLower) ||
        (emp.username || '').toLowerCase().includes(searchLower) ||
        (emp.full_name || '').toLowerCase().includes(searchLower);
      const matchesEmail = (emp.email || '').toLowerCase().includes(emailFilter.toLowerCase());
      const matchesStatus = statusFilter ? emp.status === statusFilter : true;

      return matchesSearch && matchesEmail && matchesStatus;
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        if (aValue === undefined || aValue === null) aValue = '';
        if (bValue === undefined || bValue === null) bValue = '';

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc'
            ? aValue.localeCompare(bValue, 'vi')
            : bValue.localeCompare(aValue, 'vi');
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [employees, searchTerm, emailFilter, statusFilter, sortConfig]);

  const totalItems = filteredEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentData = filteredEmployees.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleSort = (key: keyof Employee) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: keyof Employee) => {
    if (sortConfig?.key === key) {
      return (
        <span
          className="material-symbols-outlined text-sm ml-1 transition-transform duration-200"
          style={{ transform: sortConfig.direction === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          arrow_upward
        </span>
      );
    }
    return <span className="material-symbols-outlined text-sm text-slate-300 ml-1">unfold_more</span>;
  };

  const getStatusBadgeClass = (status: string) => {
    if (status === 'ACTIVE') return 'bg-secondary/30 text-deep-teal';
    if (status === 'INACTIVE') return 'bg-slate-100 text-slate-600';
    return 'bg-red-100 text-red-700';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'ACTIVE') return 'Hoạt động';
    if (status === 'INACTIVE') return 'Ngừng hoạt động';
    return 'Bị khóa';
  };

  const handleDownloadTemplate = () => {
    setShowImportMenu(false);
    const headers = ['Mã NV', 'Username', 'Họ và tên', 'Email', 'Mã phòng ban', 'Mã chức danh', 'Trạng thái'];
    const sampleRows = [
      ['NV001', 'nguyenvana', 'Nguyễn Văn A', 'nguyenvana@vnpt.vn', '6', 'POS001', 'ACTIVE'],
      ['NV002', 'tranthib', 'Trần Thị B', 'tranthib@vnpt.vn', '2', 'POS002', 'INACTIVE'],
    ];

    const csvContent = [
      headers.join(','),
      ...sampleRows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'mau_nhap_nhan_su.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = (type: 'excel' | 'csv' | 'pdf') => {
    setShowExportMenu(false);

    if (type === 'csv') {
      const headers = ['Mã NV', 'Username', 'Họ tên', 'Email', 'Mã PB', 'Mã chức danh', 'Trạng thái'];
      const csvContent = [
        headers.join(','),
        ...filteredEmployees.map((row) =>
          [
            row.id,
            row.username,
            `"${row.full_name}"`,
            row.email,
            row.department_id,
            row.position_id,
            row.status,
          ].join(',')
        ),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ds_nhan_su_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert(`Chức năng xuất ra ${type.toUpperCase()} đang được phát triển. Dữ liệu đã sẵn sàng để tích hợp thư viện.`);
    }
  };

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8">
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8 animate-fade-in">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Nhân sự Nội bộ</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý danh sách nhân sự.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
            onClick={() => onOpenModal('ADD_EMPLOYEE')}
            className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md shadow-primary/20"
          >
            <span className="material-symbols-outlined">add</span>
            <span>Thêm nhân sự</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Tổng số</p>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg material-symbols-outlined">groups</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{employees.length}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Hoạt động</p>
            <span className="p-2 bg-green-50 text-green-600 rounded-lg material-symbols-outlined">person_check</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{activeCount}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Bị khóa</p>
            <span className="p-2 bg-red-50 text-red-600 rounded-lg material-symbols-outlined">person_off</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{bannedCount}</p>
        </div>
      </div>

      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:flex lg:flex-wrap gap-4 items-center">
            <div className="col-span-1 lg:flex-1 min-w-[200px] relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none"
                placeholder="Tìm kiếm theo mã, username, họ tên"
              />
            </div>
            <div className="col-span-1 lg:w-48 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">mail</span>
              <input
                type="text"
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none"
                placeholder="Email"
              />
            </div>
            <div className="col-span-1 md:w-full lg:w-40 relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm appearance-none text-slate-600 outline-none cursor-pointer"
              >
                <option value="">Trạng thái</option>
                <option value="ACTIVE">Hoạt động</option>
                <option value="INACTIVE">Ngừng</option>
                <option value="BANNED">Bị khóa</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  {[
                    { label: 'MÃ NV', width: 'w-[100px]', key: 'id' },
                    { label: 'USERNAME', width: 'min-w-[180px]', key: 'username' },
                    { label: 'HỌ TÊN', width: 'min-w-[220px]', key: 'full_name' },
                    { label: 'EMAIL', width: 'min-w-[220px]', key: 'email' },
                    { label: 'CHỨC DANH', width: 'min-w-[140px]', key: 'position_id' },
                    { label: 'TRẠNG THÁI', width: 'min-w-[160px]', key: 'status' },
                  ].map((col) => (
                    <th
                      key={col.label}
                      className={`px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider ${col.width} cursor-pointer hover:bg-slate-100 transition-colors select-none`}
                      onClick={() => handleSort(col.key as keyof Employee)}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-deep-teal">{col.label}</span>
                        {renderSortIcon(col.key as keyof Employee)}
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right sticky right-0 bg-slate-50 z-10 shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
                    THAO TÁC
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {currentData.length > 0 ? (
                  currentData.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-slate-500 font-bold truncate max-w-[100px]" title={String(emp.id)}>{emp.id}</td>
                      <td className="px-6 py-4 text-sm text-slate-700 font-semibold">{emp.username}</td>
                      <td className="px-6 py-4 text-sm text-slate-900 font-semibold">{emp.full_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{emp.email}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-mono">{emp.position_id}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(emp.status)}`}>
                          {getStatusLabel(emp.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right sticky right-0 bg-white shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => onOpenModal('EDIT_EMPLOYEE', emp)}
                            className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                            title="Chỉnh sửa"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button
                            onClick={() => onOpenModal('DELETE_EMPLOYEE', emp)}
                            className="p-1.5 text-slate-400 hover:text-error transition-colors"
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
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-4xl text-slate-300">search_off</span>
                        <p>Không tìm thấy nhân sự nào.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalItems={totalItems}
            rowsPerPage={rowsPerPage}
            onPageChange={(page) => setCurrentPage(page)}
            onRowsPerPageChange={(rows) => {
              setRowsPerPage(rows);
              setCurrentPage(1);
            }}
            rowsPerPageOptions={[7, 10, 20, 50]}
          />
        </div>
      </div>
    </div>
  );
};
