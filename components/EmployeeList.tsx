
import React, { useState, useMemo } from 'react';
import { Employee, ModalType } from '../types';

interface EmployeeListProps {
  employees: Employee[];
  onOpenModal: (type: ModalType, item?: Employee) => void;
}

const ITEMS_PER_PAGE = 7;

export const EmployeeList: React.FC<EmployeeListProps> = ({ employees = [], onOpenModal }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [ipFilter, setIpFilter] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Employee; direction: 'asc' | 'desc' } | null>(null);
  
  // State for Menus
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);

  // Stats - calculated on the full dataset
  const activeCount = (employees || []).filter(e => e.status === 'Active').length;
  const suspendedCount = (employees || []).filter(e => e.status === 'Suspended').length;

  // Sorting Helper
  const parseDate = (dateString: string) => {
    // Expects DD/MM/YYYY
    const parts = dateString.split('/');
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date(0);
  };

  // Filtering & Sorting
  const filteredEmployees = useMemo(() => {
    let result = (employees || []).filter(emp => {
      const matchesSearch = 
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        emp.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesEmail = emp.email.toLowerCase().includes(emailFilter.toLowerCase());
      const matchesGender = genderFilter ? emp.gender === (genderFilter === 'M' ? 'Male' : 'Female') : true;
      const matchesType = typeFilter ? (
        typeFilter === 'OFFICIAL' ? emp.type === 'Official' : 
        emp.type === 'Collaborator'
      ) : true;
      const matchesIp = ipFilter ? (emp.ipAddress?.includes(ipFilter)) : true;

      return matchesSearch && matchesEmail && matchesGender && matchesType && matchesIp;
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Special handling for date strings DD/MM/YYYY
        if (sortConfig.key === 'dob') {
            const dateA = parseDate(a.dob);
            const dateB = parseDate(b.dob);
            if (dateA < dateB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (dateA > dateB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        }

        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
             return sortConfig.direction === 'asc' 
                ? aValue.localeCompare(bValue, 'vi') 
                : bValue.localeCompare(aValue, 'vi');
        }

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
  }, [employees, searchTerm, emailFilter, genderFilter, typeFilter, ipFilter, sortConfig]);

  // Pagination
  const totalItems = filteredEmployees.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(totalPages);
  }

  const currentData = filteredEmployees.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

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
    // Create a sample CSV structure for Employees
    const headers = ['Mã NV', 'Họ và tên', 'Email', 'Ngày sinh (dd/mm/yyyy)', 'Giới tính (Nam/Nữ)', 'Phòng ban', 'Chức danh', 'Số điện thoại', 'Loại hình (Chính thức/CTV)'];
    const sampleRows = [
      ['NV001', 'Nguyễn Văn A', 'nguyenvana@vnpt.vn', '01/01/1990', 'Nam', 'Phòng Kỹ thuật', 'Kỹ sư', '0912345678', 'Chính thức'],
      ['NV002', 'Trần Thị B', 'tranthib@vnpt.vn', '15/05/1995', 'Nữ', 'Phòng Nhân sự', 'Chuyên viên', '0987654321', 'Chính thức']
    ];
    
    const csvContent = [
      headers.join(','),
      ...sampleRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `mau_nhap_nhan_su.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- EXPORT LOGIC ---
  const handleExport = (type: 'excel' | 'csv' | 'pdf') => {
    setShowExportMenu(false);
    
    if (type === 'csv') {
      const headers = ['Mã NV', 'Họ và tên', 'Email', 'Ngày sinh', 'Giới tính', 'Phòng ban', 'Chức danh', 'Loại hình', 'IP', 'Trạng thái'];
      const csvContent = [
        headers.join(','),
        ...filteredEmployees.map(row => [
          row.id,
          `"${row.name}"`,
          row.email,
          row.dob,
          row.gender,
          `"${row.department}"`,
          `"${row.position || ''}"`,
          row.type,
          row.ipAddress || '',
          row.status
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ds_nhan_su_${new Date().toISOString().slice(0,10)}.csv`);
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
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Nhân sự Nội bộ</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý danh sách nhân sự.</p>
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
            onClick={() => onOpenModal('ADD_EMPLOYEE')}
            className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md shadow-primary/20"
          >
            <span className="material-symbols-outlined">add</span>
            <span>Thêm nhân sự</span>
          </button>
        </div>
      </header>

      {/* Stats */}
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
            <p className="text-sm font-medium text-slate-500">Đình chỉ</p>
            <span className="p-2 bg-red-50 text-red-600 rounded-lg material-symbols-outlined">person_off</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{suspendedCount}</p>
        </div>
      </div>

      {/* Filters & Table */}
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
                placeholder="Tìm kiếm theo mã nhân viên, tên nhân viên" 
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
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm appearance-none text-slate-600 outline-none cursor-pointer"
              >
                <option value="">Giới tính</option>
                <option value="M">Nam</option>
                <option value="F">Nữ</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
            </div>
            <div className="col-span-1 md:w-full lg:w-40 relative">
              <select 
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm appearance-none text-slate-600 outline-none cursor-pointer"
              >
                <option value="">Loại NV</option>
                <option value="OFFICIAL">Chính thức</option>
                <option value="CTV">CTV</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
            </div>
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`col-span-1 md:col-span-2 lg:col-span-1 flex justify-center items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showAdvanced ? 'bg-secondary/20 text-deep-teal' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <span className="material-symbols-outlined text-xl">filter_list</span>
              Bộ lọc
            </button>
          </div>

          {/* Advanced Filters */}
          {showAdvanced && (
             <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-in">
               <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">lan</span>
                  <input 
                    type="text"
                    value={ipFilter}
                    onChange={(e) => setIpFilter(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none" 
                    placeholder="Lọc IP" 
                  />
               </div>
             </div>
          )}
        </div>

        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  {[
                    { label: 'MÃ NV', width: 'w-[100px]', key: 'id' },
                    { label: 'HỌ TÊN & EMAIL', width: 'min-w-[250px]', key: 'name' },
                    { label: 'NGÀY SINH', width: 'min-w-[120px]', key: 'dob' },
                    { label: 'TUỔI', width: 'w-[80px]', key: 'age' },
                    { label: 'GIỚI TÍNH', width: 'w-[100px]', key: 'gender' },
                    { label: 'PHÒNG BAN', width: 'min-w-[150px]', key: 'department' },
                    { label: 'LOẠI NV', width: 'min-w-[140px]', key: 'type' },
                    { label: 'IP / VPN', width: 'min-w-[150px]', key: 'ipAddress' },
                    { label: 'TRẠNG THÁI', width: 'min-w-[160px]', key: 'status' }
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
                      <td className="px-6 py-4 text-sm font-mono text-slate-500 font-bold truncate max-w-[100px]" title={emp.id}>{emp.id}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-900">{emp.name}</span>
                          <span className="text-xs text-slate-500">{emp.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{emp.dob}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{emp.age}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{emp.gender === 'Male' ? 'Nam' : (emp.gender === 'Female' ? 'Nữ' : 'Khác')}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{emp.department}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                          ${emp.type === 'Official' ? 'bg-blue-100 text-blue-700' : 
                            'bg-orange-100 text-orange-700'}`}>
                          {emp.type === 'Official' ? 'Chính thức' : 'Cộng tác viên'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex flex-col gap-1">
                           <span className="text-xs text-slate-600 font-mono">{emp.ipAddress || '---'}</span>
                           <span className={`text-[10px] font-medium uppercase ${emp.vpnStatus === 'Granted' ? 'text-green-600' : 'text-slate-400'}`}>
                              VPN: {emp.vpnStatus === 'Granted' ? 'Đã cấp' : 'Chưa cấp'}
                           </span>
                         </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${emp.status === 'Active' ? 'bg-secondary/30 text-deep-teal' : 'bg-red-100 text-red-700'}`}>
                          {emp.status === 'Active' ? 'Đang hoạt động' : 'Tạm đình chỉ'}
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
                    <td colSpan={10} className="px-6 py-8 text-center text-slate-500">
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
          
          {/* Pagination */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
             <p className="text-sm text-slate-500 order-2 sm:order-1">
               <span className="font-medium">{totalItems > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</span>-
               <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, totalItems)}</span> / <span className="font-medium">{totalItems}</span>
             </p>
             <div className="flex items-center gap-2 order-1 sm:order-2">
                <button 
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-1 rounded border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                
                {/* Simplified Pagination for Mobile */}
                <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1))
                    .map((page, index, array) => (
                        <React.Fragment key={page}>
                            {index > 0 && array[index - 1] !== page - 1 && <span className="px-1 text-slate-400">...</span>}
                            <button
                                onClick={() => goToPage(page)}
                                className={`flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                                currentPage === page 
                                    ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' 
                                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
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
                  className="p-1 rounded border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 disabled:opacity-50"
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
