import React, { useState, useMemo, useEffect } from 'react';
import { Department, Employee, HRStatistics, ModalType } from '../types';
import { PaginationControls } from './PaginationControls';
import { getEmployeeCode, resolveJobTitleVi, resolvePositionName } from '../utils/employeeDisplay';
import { downloadExcelWorkbook } from '../utils/excelTemplate';

interface EmployeeListProps {
  employees: Employee[];
  departments?: Department[];
  onOpenModal: (type: ModalType, item?: Employee) => void;
  hrStatistics?: HRStatistics;
}

const normalizeEmployeeStatus = (status: string | null | undefined): 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' => {
  const normalized = String(status || '').trim().toUpperCase();
  if (normalized === 'ACTIVE') return 'ACTIVE';
  if (normalized === 'SUSPENDED' || normalized === 'TRANSFERRED') return 'SUSPENDED';
  if (normalized === 'INACTIVE' || normalized === 'BANNED') return 'INACTIVE';
  return 'INACTIVE';
};

const getGenderLabel = (gender: string | null | undefined): string => {
  const normalized = String(gender || '').trim().toUpperCase();
  if (normalized === 'MALE') return 'Nam';
  if (normalized === 'FEMALE') return 'Nữ';
  if (normalized === 'OTHER') return 'Khác';
  return '--';
};

const getVpnLabel = (vpnStatus: string | null | undefined): string => {
  const normalized = String(vpnStatus || '').trim().toUpperCase();
  if (normalized === 'YES') return 'Có';
  if (normalized === 'NO') return 'Không';
  return '--';
};

const normalizePositionCode = (value: unknown): string => {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return '';

  const posMatch = raw.match(/^POS(\d{1,3})$/);
  if (posMatch) {
    return `POS${posMatch[1].padStart(3, '0')}`;
  }

  const pMatch = raw.match(/^P(\d{1,3})$/);
  if (pMatch) {
    return `POS${pMatch[1].padStart(3, '0')}`;
  }

  if (/^\d+$/.test(raw)) {
    return `POS${raw.padStart(3, '0')}`;
  }

  return raw;
};

export const EmployeeList: React.FC<EmployeeListProps> = ({
  employees = [],
  departments = [],
  onOpenModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(7);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Employee; direction: 'asc' | 'desc' } | null>(null);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);

  const getPositionName = (emp: Employee) => resolvePositionName(emp);
  const getJobTitleVi = (emp: Employee) => resolveJobTitleVi(emp);
  const sortedDepartments = useMemo(
    () =>
      [...(departments || [])].sort((a, b) =>
        `${a.dept_code} ${a.dept_name}`.localeCompare(`${b.dept_code} ${b.dept_name}`, 'vi')
      ),
    [departments]
  );

  const findDepartment = (value: unknown): Department | undefined => {
    const normalized = String(value ?? '').trim();
    if (!normalized) return undefined;

    return sortedDepartments.find(
      (department) => String(department.id) === normalized || department.dept_code === normalized
    );
  };

  const getDepartmentCode = (emp: Employee): string => {
    const department = findDepartment(emp.department_id ?? emp.department ?? null);
    if (department) return department.dept_code;

    const fallback = String(emp.department_id ?? emp.department ?? '').trim();
    return fallback || '--';
  };

  const getDepartmentLabel = (emp: Employee): string => {
    const department = findDepartment(emp.department_id ?? emp.department ?? null);
    if (department) return `${department.dept_code} - ${department.dept_name}`;

    const fallback = String(emp.department_id ?? emp.department ?? '').trim();
    return fallback || '--';
  };

  const filteredEmployees = useMemo(() => {
    let result = (employees || []).filter((emp) => {
      const searchLower = searchTerm.toLowerCase();
      const departmentLabel = getDepartmentLabel(emp).toLowerCase();
      const matchesSearch =
        getEmployeeCode(emp).toLowerCase().includes(searchLower) ||
        String(emp.id).toLowerCase().includes(searchLower) ||
        (emp.username || '').toLowerCase().includes(searchLower) ||
        (emp.full_name || '').toLowerCase().includes(searchLower) ||
        departmentLabel.includes(searchLower) ||
        (getPositionName(emp) || '').toLowerCase().includes(searchLower) ||
        (getJobTitleVi(emp) || '').toLowerCase().includes(searchLower) ||
        (emp.job_title_raw || '').toLowerCase().includes(searchLower) ||
        (emp.ip_address || '').toLowerCase().includes(searchLower);
      const matchesEmail = (emp.email || '').toLowerCase().includes(emailFilter.toLowerCase());
      const departmentValue = String(emp.department_id ?? emp.department ?? '').trim();
      const matchesDepartment = departmentFilter
        ? departmentValue === departmentFilter || getDepartmentCode(emp) === departmentFilter
        : true;
      const matchesStatus = statusFilter ? normalizeEmployeeStatus(emp.status) === statusFilter : true;

      return matchesSearch && matchesEmail && matchesDepartment && matchesStatus;
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        if (sortConfig.key === 'user_code' || sortConfig.key === 'employee_code') {
          aValue = getEmployeeCode(a);
          bValue = getEmployeeCode(b);
        } else if (sortConfig.key === 'position_name') {
          aValue = getPositionName(a);
          bValue = getPositionName(b);
        } else if (sortConfig.key === 'job_title_vi') {
          aValue = getJobTitleVi(a);
          bValue = getJobTitleVi(b);
        } else if (sortConfig.key === 'department_id') {
          aValue = getDepartmentLabel(a);
          bValue = getDepartmentLabel(b);
        }

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
  }, [employees, searchTerm, emailFilter, departmentFilter, statusFilter, sortConfig, departments]);

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
    const normalizedStatus = normalizeEmployeeStatus(status);
    if (normalizedStatus === 'ACTIVE') return 'bg-secondary/30 text-deep-teal';
    if (normalizedStatus === 'SUSPENDED') return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-600';
  };

  const getStatusLabel = (status: string) => {
    const normalizedStatus = normalizeEmployeeStatus(status);
    if (normalizedStatus === 'ACTIVE') return 'Hoạt động';
    if (normalizedStatus === 'SUSPENDED') return 'Luân chuyển';
    return 'Không hoạt động';
  };

  const handleDownloadTemplate = () => {
    setShowImportMenu(false);
    const headers = ['Mã NV', 'Tên đăng nhập', 'Họ và tên', 'Email', 'Mã phòng ban', 'Mã chức vụ', 'Chức danh (TV)', 'Ngày sinh', 'Giới tính', 'VPN', 'Địa chỉ IP', 'Trạng thái'];
    const rootDepartmentCode =
      sortedDepartments.find((department) => {
        const normalized = String(department.dept_code || '')
          .trim()
          .toUpperCase()
          .replace(/[\s_-]+/g, '');
        return normalized === 'BGĐVT' || normalized === 'BGDVT';
      })?.dept_code || 'BGĐVT';
    const firstDepartmentCode = rootDepartmentCode;
    const secondDepartmentCode = sortedDepartments[1]?.dept_code || 'PB002';
    const sampleRows = [
      ['VNPT022327', 'nguyenvana', 'Nguyễn Văn A', 'nguyenvana@vnpt.vn', firstDepartmentCode, 'POS003', 'Chuyên viên kinh doanh', '1995-08-10', 'MALE', 'YES', '10.10.1.15', 'ACTIVE'],
      ['CTV091020', 'tranthib', 'Trần Thị B', 'tranthib@vnpt.vn', secondDepartmentCode, 'POS005', 'Nhân viên chăm sóc khách hàng', '1993-11-22', 'FEMALE', 'NO', '10.10.1.28', 'INACTIVE'],
    ];

    const departmentSheetHeaders = ['Mã phòng ban', 'Tên phòng ban'];
    const departmentSheetRows =
      sortedDepartments.length > 0
        ? sortedDepartments.map((department) => [department.dept_code, department.dept_name])
        : [
            ['BGĐVT', 'Ban giám đốc Viễn Thông'],
            ['PB002', 'Phòng Kinh doanh'],
          ];

    const positionMap = new Map<string, string>([
      ['POS001', 'Giám đốc'],
      ['POS002', 'Phó giám đốc'],
      ['POS003', 'Trưởng phòng'],
      ['POS004', 'Phó phòng'],
      ['POS005', 'Chuyên viên'],
    ]);

    (employees || []).forEach((employee) => {
      const positionCode = normalizePositionCode(employee.position_code ?? employee.position_id);
      const positionName = resolvePositionName(employee);
      if (!positionCode || !positionName || positionName === 'Chưa cập nhật') {
        return;
      }
      positionMap.set(positionCode, positionName);
    });

    const positionSheetHeaders = ['Mã chức vụ', 'Tên chức vụ'];
    const positionSheetRows = Array.from(positionMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'vi'))
      .map(([code, name]) => [code, name]);

    downloadExcelWorkbook('mau_nhap_nhan_su', [
      { name: 'NhanSu', headers, rows: sampleRows },
      { name: 'PhongBan', headers: departmentSheetHeaders, rows: departmentSheetRows },
      { name: 'ChucVu', headers: positionSheetHeaders, rows: positionSheetRows },
    ]);
  };

  const handleExport = (type: 'excel' | 'csv' | 'pdf') => {
    setShowExportMenu(false);

    if (type === 'csv') {
      const headers = ['Mã NV', 'Tên đăng nhập', 'Họ tên', 'Email', 'Mã PB', 'Chức vụ', 'Chức danh', 'Ngày sinh', 'Giới tính', 'VPN', 'Địa chỉ IP', 'Trạng thái'];
      const csvContent = [
        headers.join(','),
        ...filteredEmployees.map((row) =>
          [
            getEmployeeCode(row),
            row.username,
            `"${row.full_name}"`,
            row.email,
            getDepartmentCode(row),
            `"${getPositionName(row)}"`,
            `"${getJobTitleVi(row)}"`,
            row.date_of_birth || '',
            getGenderLabel(row.gender),
            getVpnLabel(row.vpn_status),
            row.ip_address || '',
            normalizeEmployeeStatus(row.status),
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
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Quản lý danh sách nhân sự</h2>
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

      <div className="animate-fade-in">
        <div className="bg-white p-4 border-x border-slate-200 border-b-0 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:flex lg:flex-wrap gap-4 items-center">
            <div className="col-span-1 lg:flex-1 min-w-[200px] relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none"
                placeholder="Tìm kiếm theo mã, tên đăng nhập, họ tên"
              />
            </div>
            <div className="col-span-1 lg:w-48 relative">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm appearance-none text-slate-600 outline-none cursor-pointer"
              >
                <option value="">Phòng ban</option>
                {sortedDepartments.map((department) => (
                  <option key={department.id} value={department.dept_code}>
                    {department.dept_code} - {department.dept_name}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
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
                <option value="INACTIVE">Không hoạt động</option>
                <option value="SUSPENDED">Luân chuyển</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1920px]">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  {[
                    { label: 'MÃ NV', width: 'min-w-[190px]', key: 'user_code' },
                    { label: 'TÊN ĐĂNG NHẬP', width: 'min-w-[180px]', key: 'username' },
                    { label: 'HỌ TÊN', width: 'min-w-[220px]', key: 'full_name' },
                    { label: 'PHÒNG BAN', width: 'min-w-[220px]', key: 'department_id' },
                    { label: 'EMAIL', width: 'min-w-[220px]', key: 'email' },
                    { label: 'CHỨC VỤ', width: 'min-w-[170px]', key: 'position_name' },
                    { label: 'CHỨC DANH', width: 'min-w-[220px]', key: 'job_title_vi' },
                    { label: 'NGÀY SINH', width: 'min-w-[140px]', key: 'date_of_birth' },
                    { label: 'GIỚI TÍNH', width: 'min-w-[120px]', key: 'gender' },
                    { label: 'VPN', width: 'min-w-[100px]', key: 'vpn_status' },
                    { label: 'ĐỊA CHỈ IP', width: 'min-w-[150px]', key: 'ip_address' },
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
                      <td className="px-6 py-4 text-sm font-mono text-slate-500 font-bold whitespace-nowrap min-w-[190px]">{getEmployeeCode(emp)}</td>
                      <td className="px-6 py-4 text-sm text-slate-700 font-semibold">{emp.username}</td>
                      <td className="px-6 py-4 text-sm text-slate-900 font-semibold">{emp.full_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{getDepartmentLabel(emp)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{emp.email}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{getPositionName(emp)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{getJobTitleVi(emp)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{emp.date_of_birth || '--'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{getGenderLabel(emp.gender)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{getVpnLabel(emp.vpn_status)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-mono">{emp.ip_address || '--'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(emp.status)}`}>
                          {getStatusLabel(emp.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right sticky right-0 bg-white shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => onOpenModal('ADD_USER_DEPT_HISTORY', emp)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Luân chuyển"
                          >
                            <span className="material-symbols-outlined text-lg">sync_alt</span>
                          </button>
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
                    <td colSpan={13} className="px-6 py-8 text-center text-slate-500">
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
