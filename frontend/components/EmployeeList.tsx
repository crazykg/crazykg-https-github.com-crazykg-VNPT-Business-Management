import React, { useState, useMemo, useEffect } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import type { ModalType, PaginatedQuery, PaginationMeta } from '../types';
import type { Department } from '../types/department';
import type { Employee, HRStatistics } from '../types/employee';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect } from './SearchableSelect';
import { getEmployeeCode, resolveJobTitleVi, resolvePositionName } from '../utils/employeeDisplay';
import { downloadExcelWorkbook } from '../utils/excelTemplate';
import { exportCsv, exportExcel, exportEmployeesByCurrentQuery, exportPdfTable, isoDateStamp } from '../utils/exportUtils';
import { formatDateDdMmYyyy } from '../utils/dateDisplay';

interface EmployeeListQuery extends PaginatedQuery {
  filters?: {
    email?: string;
    department_id?: string;
    status?: string;
  };
}

interface EmployeeListProps {
  employees: Employee[];
  departments?: Department[];
  onOpenModal: (type: ModalType, item?: Employee) => void;
  hrStatistics?: HRStatistics;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
  paginationMeta?: PaginationMeta;
  isLoading?: boolean;
  onQueryChange?: (query: EmployeeListQuery) => void;
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

const getEmployeePhone = (employee: Employee): string => {
  const candidate = [
    employee.phone,
    employee.phone_number,
    employee.mobile,
    (employee as Employee & { phoneNumber?: string | null }).phoneNumber,
  ]
    .map((value) => String(value ?? '').trim())
    .find((value) => value !== '');

  return candidate || '';
};

const secondaryButtonClass =
  'inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60';

const primaryButtonClass =
  'inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-deep-teal disabled:cursor-not-allowed disabled:opacity-60';

const compactInputClass =
  'h-8 w-full rounded border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/30';

const compactSelectTriggerClass =
  'h-8 w-full rounded border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30';

const menuPanelClass = 'absolute top-full z-20 mt-2 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl animate-fade-in';
const menuItemClass =
  'flex items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60';
const tableActionButtonClass =
  'inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition-colors';

const renderContactLink = ({
  href,
  value,
  icon,
  ariaLabel,
}: {
  href: string;
  value: string;
  icon: 'mail' | 'call';
  ariaLabel: string;
}) => (
  <div className="relative group">
    <a
      href={href}
      className="flex h-7 w-7 items-center justify-center rounded border border-primary/20 bg-white text-primary transition-colors hover:bg-primary/5 hover:text-deep-teal"
      title={value}
      aria-label={ariaLabel}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{icon}</span>
    </a>
    <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-deep-teal px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
      {value}
    </span>
  </div>
);

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
  onNotify,
  paginationMeta,
  isLoading = false,
  onQueryChange,
}: EmployeeListProps) => {
  const serverMode = Boolean(onQueryChange && paginationMeta);
  const [searchTerm, setSearchTerm] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(7);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Employee; direction: 'asc' | 'desc' } | null>(null);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [showImportMenu, setShowImportMenu] = useState(false);
  useEscKey(() => { setShowImportMenu(false); setShowExportMenu(false); }, showImportMenu || showExportMenu);

  const getPositionName = (emp: Employee) => resolvePositionName(emp);
  const getJobTitleVi = (emp: Employee) => resolveJobTitleVi(emp);
  const sortedDepartments = useMemo(
    () =>
      [...(departments || [])].sort((a, b) =>
        `${a.dept_code} ${a.dept_name}`.localeCompare(`${b.dept_code} ${b.dept_name}`, 'vi')
      ),
    [departments]
  );

  const departmentFilterOptions = useMemo(
    () => [
      { value: '', label: 'Phòng ban' },
      ...sortedDepartments.map((department) => ({
        value: String(department.id),
        label: `${department.dept_code} - ${department.dept_name}`,
        searchText: `${department.dept_code} ${department.dept_name}`,
      })),
    ],
    [sortedDepartments]
  );

  const statusFilterOptions = useMemo(
    () => [
      { value: '', label: 'Trạng thái' },
      { value: 'ACTIVE', label: 'Hoạt động' },
      { value: 'INACTIVE', label: 'Không hoạt động' },
      { value: 'SUSPENDED', label: 'Luân chuyển' },
    ],
    []
  );

  const findDepartment = (value: unknown): Department | undefined => {
    const normalized = String(value ?? '').trim();
    if (!normalized) return undefined;

    return sortedDepartments.find(
      (department) => String(department.id) === normalized || department.dept_code === normalized
    );
  };

  const resolvedDepartmentFilter = useMemo(() => findDepartment(departmentFilter), [departmentFilter, sortedDepartments]);
  const resolvedDepartmentFilterId = resolvedDepartmentFilter ? String(resolvedDepartmentFilter.id) : String(departmentFilter || '').trim();
  const resolvedDepartmentFilterCode = resolvedDepartmentFilter?.dept_code || String(departmentFilter || '').trim();

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
    if (serverMode) {
      return employees || [];
    }

    let result = (employees || []).filter((emp) => {
      const searchLower = searchTerm.toLowerCase();
      const departmentLabel = getDepartmentLabel(emp).toLowerCase();
      const matchesSearch =
        getEmployeeCode(emp).toLowerCase().includes(searchLower) ||
        String(emp.id).toLowerCase().includes(searchLower) ||
        (emp.username || '').toLowerCase().includes(searchLower) ||
        (emp.full_name || '').toLowerCase().includes(searchLower) ||
        getEmployeePhone(emp).toLowerCase().includes(searchLower) ||
        departmentLabel.includes(searchLower) ||
        (getPositionName(emp) || '').toLowerCase().includes(searchLower) ||
        (getJobTitleVi(emp) || '').toLowerCase().includes(searchLower) ||
        (emp.job_title_raw || '').toLowerCase().includes(searchLower) ||
        (emp.ip_address || '').toLowerCase().includes(searchLower);
      const matchesEmail = (emp.email || '').toLowerCase().includes(emailFilter.toLowerCase());
      const departmentValue = String(emp.department_id ?? emp.department ?? '').trim();
      const matchesDepartment = resolvedDepartmentFilterId
        ? departmentValue === resolvedDepartmentFilterId || getDepartmentCode(emp) === resolvedDepartmentFilterCode
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
  }, [serverMode, employees, searchTerm, emailFilter, resolvedDepartmentFilterId, resolvedDepartmentFilterCode, statusFilter, sortConfig, departments]);

  const resolveSortBy = (key: keyof Employee): string => {
    if (key === 'employee_code') return 'user_code';
    if (key === 'position_name') return 'position_id';
    if (key === 'job_title_vi') return 'job_title_raw';
    return String(key);
  };

  const totalItems = serverMode ? (paginationMeta?.total || 0) : filteredEmployees.length;
  const totalPages = serverMode
    ? Math.max(1, paginationMeta?.total_pages || 1)
    : Math.max(1, Math.ceil(totalItems / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!serverMode || !onQueryChange) {
      return;
    }

    onQueryChange({
      page: currentPage,
      per_page: rowsPerPage,
      q: searchTerm.trim(),
      sort_by: sortConfig ? resolveSortBy(sortConfig.key) : 'user_code',
      sort_dir: sortConfig?.direction || 'asc',
      filters: {
        email: emailFilter.trim(),
        department_id: resolvedDepartmentFilterId,
        status: statusFilter,
      },
    });
  }, [
    serverMode,
    onQueryChange,
    currentPage,
    rowsPerPage,
    searchTerm,
    emailFilter,
    resolvedDepartmentFilterId,
    statusFilter,
    sortConfig,
  ]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleEmailFilterChange = (value: string) => {
    setEmailFilter(value);
    setCurrentPage(1);
  };

  const handleDepartmentFilterChange = (value: string) => {
    setDepartmentFilter(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const currentData = serverMode
    ? (employees || [])
    : filteredEmployees.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const visibleEmployees = serverMode ? currentData : filteredEmployees;
  const activeVisibleCount = visibleEmployees.filter((employee) => normalizeEmployeeStatus(employee.status) === 'ACTIVE').length;
  const vpnVisibleCount = visibleEmployees.filter((employee) => getVpnLabel(employee.vpn_status) === 'Có').length;
  const departmentCoverageCount = new Set(
    visibleEmployees
      .map((employee) => getDepartmentCode(employee))
      .filter((value) => value && value !== '--')
  ).size;
  const summaryCards = [
    {
      label: 'Nhân sự theo bộ lọc',
      value: totalItems,
      caption: 'Tổng số hồ sơ khớp với truy vấn hiện tại.',
      tone: 'border-transparent bg-gradient-to-r from-primary to-primary-container text-white',
      iconName: 'group',
    },
    {
      label: 'Đang hoạt động',
      value: activeVisibleCount,
      caption: serverMode ? 'Đếm trên tập dữ liệu đang tải của trang hiện tại.' : 'Sẵn sàng vận hành trong tập kết quả hiện tại.',
      tone: 'border-secondary/20 bg-secondary-fixed text-deep-teal',
      iconName: 'verified_user',
    },
    {
      label: 'Đã bật VPN',
      value: vpnVisibleCount,
      caption: 'Số hồ sơ có trạng thái VPN khả dụng trên dữ liệu đang hiển thị.',
      tone: 'border-primary/10 bg-primary-container-soft text-deep-teal',
      iconName: 'lan',
    },
    {
      label: 'Phòng ban hiện diện',
      value: departmentCoverageCount,
      caption: 'Số đơn vị xuất hiện trong tập dữ liệu đang hiển thị.',
      tone: 'border-tertiary/10 bg-tertiary-fixed text-tertiary',
      iconName: 'apartment',
    },
  ];

  const buildRemoteExportQuery = (): EmployeeListQuery => ({
    page: 1,
    per_page: rowsPerPage,
    q: searchTerm.trim(),
    sort_by: sortConfig ? resolveSortBy(sortConfig.key) : 'user_code',
    sort_dir: sortConfig?.direction || 'asc',
    filters: {
      email: emailFilter.trim(),
      department_id: resolvedDepartmentFilterId,
      status: statusFilter,
    },
  });

  const handleSort = (key: keyof Employee) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
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
    if (normalizedStatus === 'ACTIVE') return 'bg-secondary-fixed text-deep-teal';
    if (normalizedStatus === 'SUSPENDED') return 'bg-tertiary-fixed text-tertiary';
    return 'bg-surface-container text-neutral';
  };

  const getStatusLabel = (status: string) => {
    const normalizedStatus = normalizeEmployeeStatus(status);
    if (normalizedStatus === 'ACTIVE') return 'Hoạt động';
    if (normalizedStatus === 'SUSPENDED') return 'Luân chuyển';
    return 'Không hoạt động';
  };

  const handleDownloadTemplate = () => {
    setShowImportMenu(false);
    const headers = ['Mã NV', 'Tên đăng nhập', 'Họ và tên', 'Số điện thoại', 'Email', 'Mã phòng ban', 'Mã chức vụ', 'Chức danh (TV)', 'Ngày sinh', 'Giới tính', 'VPN', 'Địa chỉ IP', 'Trạng thái'];
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
      ['VNPT022327', 'nguyenvana', 'Nguyễn Văn A', '0912345678', 'nguyenvana@vnpt.vn', firstDepartmentCode, 'POS003', 'Chuyên viên kinh doanh', '10/08/1995', 'MALE', 'YES', '10.10.1.15', 'ACTIVE'],
      ['CTV091020', 'tranthib', 'Trần Thị B', '0987654321', 'tranthib@vnpt.vn', secondDepartmentCode, 'POS005', 'Nhân viên chăm sóc khách hàng', '22/11/1993', 'FEMALE', 'NO', '10.10.1.28', 'INACTIVE'],
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

  const handleExport = async (type: 'excel' | 'csv' | 'pdf') => {
    if (isExporting) {
      return;
    }

    setShowExportMenu(false);
    setIsExporting(true);

    try {
      const dataToExport = serverMode
        ? await exportEmployeesByCurrentQuery(buildRemoteExportQuery())
        : filteredEmployees;
      const headers = ['Mã NV', 'Tên đăng nhập', 'Họ tên', 'Số điện thoại', 'Email', 'Mã PB', 'Chức vụ', 'Chức danh', 'Ngày sinh', 'Giới tính', 'VPN', 'Địa chỉ IP', 'Trạng thái'];
      const rows = dataToExport.map((row) => [
        getEmployeeCode(row),
        row.username || '',
        row.full_name || '',
        getEmployeePhone(row),
        row.email || '',
        getDepartmentCode(row),
        getPositionName(row),
        getJobTitleVi(row),
        formatDateDdMmYyyy(row.date_of_birth || null),
        getGenderLabel(row.gender),
        getVpnLabel(row.vpn_status),
        row.ip_address || '',
        normalizeEmployeeStatus(row.status),
      ]);
      const fileName = `ds_nhan_su_${isoDateStamp()}`;

      if (type === 'excel') {
        exportExcel(fileName, 'NhanSu', headers, rows);
        return;
      }

      if (type === 'csv') {
        exportCsv(fileName, headers, rows);
        return;
      }

      const canPrint = exportPdfTable({
        fileName,
        title: 'Danh sach nhan su',
        headers,
        rows,
        subtitle: `Ngay xuat: ${new Date().toLocaleString('vi-VN')}`,
        landscape: true,
      });

      if (!canPrint) {
        onNotify?.('error', 'Xuất dữ liệu', 'Trình duyệt đang chặn popup. Vui lòng cho phép popup để xuất PDF.');
      }
    } catch (error) {
      const message = error instanceof Error && error.message.trim() !== ''
        ? error.message
        : 'Không thể xuất dữ liệu nhân sự.';
      onNotify?.('error', 'Xuất dữ liệu', message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-3 p-3 pb-6">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-secondary/15">
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>
                  group
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral">People Directory</p>
                <h2 className="text-sm font-bold leading-tight text-deep-teal">Quản lý danh sách nhân sự</h2>
                <p className="text-[11px] leading-tight text-slate-400">
                  Tập trung quản trị hồ sơ nhân sự, trạng thái vận hành tài khoản và các thao tác nhập xuất dữ liệu.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {serverMode ? `Trang ${paginationMeta?.page || currentPage}/${totalPages}` : `${new Intl.NumberFormat('vi-VN').format(totalItems)} hồ sơ`}
              </span>

              <div className="relative">
                <button
                  onClick={() => setShowImportMenu(!showImportMenu)}
                  className={`${secondaryButtonClass} min-w-[92px] justify-center`}
                >
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>upload</span>
                  Nhập
                  <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 14 }}>expand_more</span>
                </button>

                {showImportMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowImportMenu(false)}></div>
                    <div className={`${menuPanelClass} left-0 w-44`}>
                      <button
                        onClick={() => {
                          setShowImportMenu(false);
                          onOpenModal('IMPORT_DATA');
                        }}
                        className={menuItemClass}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>upload_file</span>
                        Nhập dữ liệu
                      </button>
                      <button
                        onClick={handleDownloadTemplate}
                        className={`${menuItemClass} border-t border-slate-100`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>
                        Tải file mẫu
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={isExporting}
                  className={`${secondaryButtonClass} min-w-[92px] justify-center`}
                >
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>download</span>
                  {isExporting ? 'Đang xuất' : 'Xuất'}
                  <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 14 }}>expand_more</span>
                </button>

                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>
                    <div className={`${menuPanelClass} right-0 w-40`}>
                      <button
                        disabled={isExporting}
                        onClick={() => handleExport('excel')}
                        className={menuItemClass}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>table_view</span>
                        Excel
                      </button>
                      <button
                        disabled={isExporting}
                        onClick={() => handleExport('csv')}
                        className={`${menuItemClass} border-t border-slate-100`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>csv</span>
                        CSV
                      </button>
                      <button
                        disabled={isExporting}
                        onClick={() => handleExport('pdf')}
                        className={`${menuItemClass} border-t border-slate-100`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>picture_as_pdf</span>
                        PDF
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={() => onOpenModal('ADD_EMPLOYEE')}
                className={primaryButtonClass}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                Thêm nhân sự
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-lg border p-3 shadow-sm ${card.tone}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] opacity-80">{card.label}</p>
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded ${card.label === 'Nhân sự theo bộ lọc' ? 'bg-white/15 text-white' : 'bg-white/80 text-current'}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{card.iconName}</span>
                </span>
              </div>
              <p className="mt-2 text-xl font-black leading-none">{new Intl.NumberFormat('vi-VN').format(card.value)}</p>
              <p className="mt-1 text-[11px] leading-5 opacity-80">{card.caption}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 bg-slate-50/70 p-3">
          <div className="mb-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-secondary/15">
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>filter_alt</span>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700">Bộ lọc và tra cứu</p>
                <p className="text-[10px] text-slate-400">Tìm nhanh theo mã, tài khoản, email, phòng ban và trạng thái vận hành.</p>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral ring-1 ring-slate-200">
              Hiển thị {new Intl.NumberFormat('vi-VN').format(currentData.length)} / {new Intl.NumberFormat('vi-VN').format(totalItems)}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.2fr)_220px_220px_180px] xl:items-center">
            <div className="relative min-w-[200px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral" style={{ fontSize: 16 }}>
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className={`pl-9 ${compactInputClass}`}
                placeholder="Tìm kiếm theo mã, tên đăng nhập, họ tên"
              />
            </div>
            <SearchableSelect
              className="col-span-1"
              value={departmentFilter}
              onChange={handleDepartmentFilterChange}
              options={departmentFilterOptions}
              placeholder="Phòng ban"
              triggerClassName={compactSelectTriggerClass}
            />
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral" style={{ fontSize: 16 }}>
                mail
              </span>
              <input
                type="text"
                value={emailFilter}
                onChange={(e) => handleEmailFilterChange(e.target.value)}
                className={`pl-9 ${compactInputClass}`}
                placeholder="Email"
              />
            </div>
            <SearchableSelect
              className="col-span-1"
              value={statusFilter}
              onChange={handleStatusFilterChange}
              options={statusFilterOptions}
              placeholder="Trạng thái"
              triggerClassName={compactSelectTriggerClass}
            />
          </div>
        </div>

        <div className="flex flex-col bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[1240px] w-full text-left">
              <thead className="border-b border-slate-200 bg-slate-50/90">
                <tr>
                  {[
                    { label: 'MÃ NV', width: 'min-w-[170px]', key: 'user_code' },
                    { label: 'TÊN ĐĂNG NHẬP', width: 'min-w-[170px]', key: 'username' },
                    { label: 'HỌ TÊN', width: 'min-w-[210px]', key: 'full_name' },
                    { label: 'PHÒNG BAN', width: 'min-w-[220px]', key: 'department_id' },
                    { label: 'LIÊN HỆ', width: 'min-w-[150px]', key: 'email' },
                    { label: 'CHỨC VỤ', width: 'min-w-[170px]', key: 'position_name' },
                    { label: 'CHỨC DANH', width: 'min-w-[220px]', key: 'job_title_vi' },
                    { label: 'NGÀY SINH', width: 'min-w-[130px]', key: 'date_of_birth' },
                    { label: 'GIỚI TÍNH', width: 'min-w-[110px]', key: 'gender' },
                    { label: 'VPN', width: 'min-w-[100px]', key: 'vpn_status' },
                    { label: 'ĐỊA CHỈ IP', width: 'min-w-[140px]', key: 'ip_address' },
                    { label: 'TRẠNG THÁI', width: 'min-w-[150px]', key: 'status' },
                  ].map((col) => (
                    <th
                      key={col.label}
                      className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-neutral ${col.width} cursor-pointer select-none transition-colors hover:bg-slate-100`}
                      onClick={() => handleSort(col.key as keyof Employee)}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-deep-teal">{col.label}</span>
                        {renderSortIcon(col.key as keyof Employee)}
                      </div>
                    </th>
                  ))}
                  <th className="sticky right-0 z-10 bg-slate-50/95 px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-neutral shadow-[-10px_0_12px_-12px_rgba(15,23,42,0.18)]">
                    THAO TÁC
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentData.length > 0 ? (
                  currentData.map((emp) => (
                    <tr key={emp.id} className="group transition-colors hover:bg-slate-50/90">
                      <td className="min-w-[170px] px-4 py-3">
                        <div className="space-y-0.5">
                          <p className="font-mono text-xs font-bold text-deep-teal">{getEmployeeCode(emp)}</p>
                          <p className="text-[10px] text-slate-400">ID: {emp.id}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700">{emp.username}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{emp.full_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{getDepartmentLabel(emp)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {(() => {
                          const phone = getEmployeePhone(emp);
                          const email = String(emp.email || '').trim();

                          if (!phone && !email) {
                            return <span>--</span>;
                          }

                          return (
                            <div className="flex items-center gap-1.5">
                              {email ? (
                                renderContactLink({
                                  href: `mailto:${email}`,
                                  value: email,
                                  icon: 'mail',
                                  ariaLabel: `Gửi email ${email}`,
                                })
                              ) : null}
                              {phone ? (
                                renderContactLink({
                                  href: `tel:${phone.replace(/[^\d+]/g, '')}`,
                                  value: phone,
                                  icon: 'call',
                                  ariaLabel: `Gọi ${phone}`,
                                })
                              ) : null}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{getPositionName(emp)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{getJobTitleVi(emp)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDateDdMmYyyy(emp.date_of_birth || null)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{getGenderLabel(emp.gender)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            getVpnLabel(emp.vpn_status) === 'Có'
                              ? 'bg-primary/10 text-primary'
                              : getVpnLabel(emp.vpn_status) === 'Không'
                                ? 'bg-slate-100 text-slate-500'
                                : 'bg-surface-container text-neutral'
                          }`}
                        >
                          {getVpnLabel(emp.vpn_status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-600">{emp.ip_address || '--'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${getStatusBadgeClass(emp.status)}`}>
                          {getStatusLabel(emp.status)}
                        </span>
                      </td>
                      <td className="sticky right-0 bg-white px-4 py-3 text-right shadow-[-10px_0_12px_-12px_rgba(15,23,42,0.18)] transition-colors group-hover:bg-slate-50/90">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => onOpenModal('ADD_USER_DEPT_HISTORY', emp)}
                            className={`${tableActionButtonClass} hover:border-primary/20 hover:bg-primary/5 hover:text-primary`}
                            title="Luân chuyển"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>sync_alt</span>
                          </button>
                          <button
                            onClick={() => onOpenModal('EDIT_EMPLOYEE', emp)}
                            className={`${tableActionButtonClass} hover:border-secondary/30 hover:bg-secondary-fixed hover:text-deep-teal`}
                            title="Chỉnh sửa"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                          </button>
                          <button
                            onClick={() => onOpenModal('DELETE_EMPLOYEE', emp)}
                            className={`${tableActionButtonClass} hover:border-error/20 hover:bg-error/10 hover:text-error`}
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
                    <td colSpan={13} className="px-6 py-10 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3 py-6">
                        <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 34 }}>
                          {isLoading ? 'hourglass_top' : 'search_off'}
                        </span>
                        <p className="text-sm font-semibold text-slate-700">
                          {isLoading ? 'Đang tải dữ liệu...' : 'Không tìm thấy nhân sự nào.'}
                        </p>
                        {!isLoading ? (
                          <p className="max-w-lg text-[11px] leading-5 text-slate-400">
                            Hãy điều chỉnh bộ lọc hoặc thêm hồ sơ mới để mở rộng danh sách nhân sự đang theo dõi.
                          </p>
                        ) : null}
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
