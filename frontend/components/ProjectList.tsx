import React, { useState, useMemo, useEffect } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import { Project, Customer, ModalType, PaginatedQuery, PaginationMeta, ProjectItemMaster, ProjectRaciRow, ProjectTypeOption } from '../types';
import { PROJECT_STATUSES, PHASE_LABELS, getProjectStatusLabel as getPhaseStatusLabel, getProjectStatusColor } from '../constants';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect } from './SearchableSelect';
import { downloadExcelWorkbook } from '../utils/excelTemplate';
import { exportCsv, exportPdfTable, isoDateStamp } from '../utils/exportUtils';
import { formatDateDdMmYyyy } from '../utils/dateDisplay';

interface ProjectListQuery extends PaginatedQuery {
  filters?: {
    status?: string;
  };
}

interface ProjectListProps {
  projects: Project[];
  customers: Customer[];
  projectTypes?: ProjectTypeOption[];
  onOpenModal: (type: ModalType, item?: Project) => void;
  onCreateContract?: (project: Project) => void;
  onOpenProcedure?: (project: Project) => void;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
  onExportProjects?: () => Promise<Project[]>;
  onExportProjectRaci?: (projectIds: Array<string | number>) => Promise<ProjectRaciRow[]>;
  projectItems?: ProjectItemMaster[];
  paginationMeta?: PaginationMeta;
  isLoading?: boolean;
  onQueryChange?: (query: ProjectListQuery) => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({
  projects = [],
  customers = [],
  projectTypes = [],
  onOpenModal,
  onCreateContract,
  onOpenProcedure,
  onNotify,
  onExportProjects,
  onExportProjectRaci,
  projectItems = [],
  paginationMeta,
  isLoading = false,
  onQueryChange,
}) => {
  const serverMode = Boolean(onQueryChange && paginationMeta);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Project; direction: 'asc' | 'desc' } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [showImportMenu, setShowImportMenu] = useState(false);
  useEscKey(() => { setShowImportMenu(false); setShowExportMenu(false); }, showImportMenu || showExportMenu);
  const [isExporting, setIsExporting] = useState(false);

  const getCustomerName = (id: string | number) => {
    const customer = (customers || []).find((c) => String(c.id) === String(id));
    return customer ? `${customer.customer_code} - ${customer.customer_name}` : String(id);
  };
  const getStatusLabel = (status: string) => getPhaseStatusLabel(status);
  const getStatusColor = (status: string) => getProjectStatusColor(status);

  const filteredProjects = useMemo(() => {
    if (serverMode) {
      return projects || [];
    }

    let result = (projects || []).filter((proj) => {
      const customerName = getCustomerName(proj.customer_id).toLowerCase();
      const projName = (proj.project_name || '').toLowerCase();
      const searchLower = searchTerm.toLowerCase();

      const matchesSearch =
        projName.includes(searchLower) ||
        customerName.includes(searchLower) ||
        (proj.project_code || '').toLowerCase().includes(searchLower);
      const matchesStatus = statusFilter ? proj.status === statusFilter : true;

      return matchesSearch && matchesStatus;
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        if (sortConfig.key === 'customer_id') {
          aValue = getCustomerName(a.customer_id);
          bValue = getCustomerName(b.customer_id);
        }

        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';

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
  }, [serverMode, projects, searchTerm, statusFilter, sortConfig, customers]);

  const statusFilterOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả trạng thái' },
      // Phase codes từ template
      ...Object.entries(PHASE_LABELS).map(([value, label]) => ({ value, label })),
    ],
    []
  );

  const totalItems = serverMode ? (paginationMeta?.total || 0) : filteredProjects.length;
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
      sort_by: sortConfig?.key ? String(sortConfig.key) : 'id',
      sort_dir: sortConfig?.direction || 'desc',
      filters: {
        status: statusFilter,
      },
    });
  }, [serverMode, onQueryChange, currentPage, rowsPerPage, searchTerm, statusFilter, sortConfig]);

  const currentData = serverMode
    ? (projects || [])
    : filteredProjects.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const kpiSource = serverMode ? (projects || []) : filteredProjects;
  const statusKpis = useMemo(
    () => [
      {
        label: 'Chuẩn bị',
        status: 'CHUAN_BI',
        count: kpiSource.filter((item) => item.status === 'CHUAN_BI').length,
        icon: 'pending_actions',
        iconClassName: 'bg-slate-50 text-slate-600',
      },
      {
        label: 'Chuẩn bị đầu tư',
        status: 'CHUAN_BI_DAU_TU',
        count: kpiSource.filter((item) => item.status === 'CHUAN_BI_DAU_TU').length,
        icon: 'inventory_2',
        iconClassName: 'bg-blue-50 text-blue-600',
      },
      {
        label: 'Thực hiện đầu tư',
        status: 'THUC_HIEN_DAU_TU',
        count: kpiSource.filter((item) => item.status === 'THUC_HIEN_DAU_TU').length,
        icon: 'rocket_launch',
        iconClassName: 'bg-amber-50 text-amber-600',
      },
      {
        label: 'Kết thúc đầu tư',
        status: 'KET_THUC_DAU_TU',
        count: kpiSource.filter((item) => item.status === 'KET_THUC_DAU_TU').length,
        icon: 'task_alt',
        iconClassName: 'bg-emerald-50 text-emerald-600',
      },
      {
        label: 'Chuẩn bị KH thuê',
        status: 'CHUAN_BI_KH_THUE',
        count: kpiSource.filter((item) => item.status === 'CHUAN_BI_KH_THUE').length,
        icon: 'assignment',
        iconClassName: 'bg-indigo-50 text-indigo-600',
      },
    ],
    [kpiSource]
  );

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleSort = (key: keyof Project) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: keyof Project) => {
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

  const getCustomerById = (id: string | number | null | undefined): Customer | undefined =>
    (customers || []).find((item) => String(item.id) === String(id));

  const getProjectStatusLabel = (status: unknown): string =>
    getPhaseStatusLabel(String(status || ''));

  const getInvestmentModeLabel = (value: unknown): string => {
    const token = String(value || '').trim().toUpperCase();
    if (!token) return '';

    // Try dynamic project types first
    if (projectTypes.length > 0) {
      const match = projectTypes.find(
        (pt) => String(pt.type_code || '').trim().toUpperCase() === token
      );
      if (match) return match.type_name;
    }

    // Fallback to hardcoded
    if (token === 'DAU_TU') return 'Đầu tư';
    if (token === 'THUE_DICH_VU_DACTHU') return 'Thuê dịch vụ CNTT đặc thù';
    return token;
  };

  const handleDownloadTemplate = () => {
    setShowImportMenu(false);
    const firstCustomerCode = String(customers?.[0]?.customer_code || '').trim();
    const customerRows = (customers || []).map((customer) => ([
      String(customer?.id ?? ''),
      String(customer?.customer_code ?? ''),
      String(customer?.customer_name ?? ''),
    ]));

    downloadExcelWorkbook('mau_nhap_quan_ly_du_an', [
      {
        name: 'DuAn',
        headers: [
          'Mã dự án',
          'Tên dự án',
          'Mã khách hàng',
        ],
        rows: [
          ['DA001', 'Triển khai bệnh án điện tử', firstCustomerCode],
        ],
      },
      {
        name: 'KhachHang',
        headers: [
          'ID',
          'Mã khách hàng',
          'Tên khách hàng',
        ],
        rows: customerRows,
      },
    ]);
  };

  const handleExport = async (type: 'excel' | 'csv' | 'pdf') => {
    if (isExporting) {
      return;
    }

    setShowExportMenu(false);
    setIsExporting(true);
    try {
      const projectRows = onExportProjects
        ? await onExportProjects()
        : (serverMode ? (projects || []) : filteredProjects);

      if (!projectRows || projectRows.length === 0) {
        onNotify?.('error', 'Xuất dữ liệu', 'Không có dữ liệu dự án để xuất.');
        return;
      }

      const projectHeaders = [
        'Mã dự án',
        'Tên dự án',
        'Mã KH',
        'Tên khách hàng',
        'Trạng thái',
        'Loại dự án',
        'Ngày bắt đầu',
        'Ngày kết thúc dự kiến',
        'Ngày kết thúc thực tế',
      ];
      const projectSheetRows = projectRows.map((project) => {
        const customer = getCustomerById(project.customer_id);
        return [
          project.project_code || '',
          project.project_name || '',
          customer?.customer_code || '',
          customer?.customer_name || '',
          getProjectStatusLabel(project.status),
          getInvestmentModeLabel(project.investment_mode),
          formatDateDdMmYyyy(project.start_date || ''),
          formatDateDdMmYyyy(project.expected_end_date || ''),
          formatDateDdMmYyyy(project.actual_end_date || ''),
        ];
      });

      const fileName = `DuAn_${isoDateStamp()}`;
      if (type === 'excel') {
        const projectIdSet = new Set(projectRows.map((project) => String(project.id)));
        const itemRows = (projectItems || []).filter((item) => projectIdSet.has(String(item.project_id)));
        const itemSheetRows = itemRows.map((item) => {
          const quantity = Number(item.quantity || 0);
          const unitPrice = Number(item.unit_price || 0);
          const lineTotal = quantity * unitPrice;
          return [
            item.project_code || '',
            item.project_name || '',
            item.product_code || '',
            item.product_name || '',
            quantity,
            unitPrice,
            lineTotal,
          ];
        });

        const raciRows = onExportProjectRaci
          ? await onExportProjectRaci(projectRows.map((project) => project.id))
          : [];
        const projectById = new Map<string, Project>(
          projectRows.map((project): [string, Project] => [String(project.id), project])
        );
        const raciSheetRows = (raciRows || []).map((row) => {
          const project = projectById.get(String(row.project_id));
          return [
            project?.project_code || '',
            project?.project_name || '',
            row.raci_role || '',
            row.user_code || '',
            row.username || '',
            row.full_name || '',
            formatDateDdMmYyyy(row.assigned_date || ''),
          ];
        });

        downloadExcelWorkbook(fileName, [
          {
            name: 'DuAn',
            headers: projectHeaders,
            rows: projectSheetRows,
          },
          {
            name: 'HangMuc',
            headers: ['Mã dự án', 'Tên dự án', 'Mã sản phẩm', 'Tên sản phẩm', 'Số lượng', 'Đơn giá', 'Thành tiền'],
            rows: itemSheetRows,
          },
          {
            name: 'RACI',
            headers: ['Mã dự án', 'Tên dự án', 'Vai trò', 'Mã NS', 'Username', 'Họ tên', 'Ngày phân công'],
            rows: raciSheetRows,
          },
        ]);
        return;
      }

      if (type === 'csv') {
        exportCsv(fileName, projectHeaders, projectSheetRows);
        return;
      }

      const canPrint = exportPdfTable({
        fileName,
        title: 'Danh sach du an',
        headers: projectHeaders,
        rows: projectSheetRows,
        subtitle: `Ngay xuat: ${new Date().toLocaleString('vi-VN')}`,
        landscape: true,
      });

      if (!canPrint) {
        onNotify?.('error', 'Xuất dữ liệu', 'Trình duyệt đang chặn popup. Vui lòng cho phép popup để xuất PDF.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      onNotify?.('error', 'Xuất dữ liệu', `Không thể xuất dữ liệu dự án. ${message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8">
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8 animate-fade-in">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Quản lý Dự án</h2>
          <p className="text-slate-500 text-sm mt-1">Theo dõi tiến độ và thông tin các dự án đang triển khai.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 lg:flex-none">
            <button
              onClick={() => {
                setShowImportMenu((prev) => !prev);
                setShowExportMenu(false);
              }}
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
              onClick={() => {
                setShowExportMenu((prev) => !prev);
                setShowImportMenu(false);
              }}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              <span className="hidden sm:inline">{isExporting ? 'Đang xuất...' : 'Xuất'}</span>
              <span className="material-symbols-outlined text-sm ml-1">expand_more</span>
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>
                <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in flex flex-col">
                  <button
                    onClick={() => void handleExport('excel')}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-lg">table_view</span> Excel
                  </button>
                  <button
                    onClick={() => void handleExport('csv')}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors text-left border-t border-slate-100"
                  >
                    <span className="material-symbols-outlined text-lg">csv</span> CSV
                  </button>
                  <button
                    onClick={() => void handleExport('pdf')}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-colors text-left border-t border-slate-100"
                  >
                    <span className="material-symbols-outlined text-lg">picture_as_pdf</span> PDF
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => onOpenModal('ADD_PROJECT')}
            className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20"
          >
            <span className="material-symbols-outlined">add</span>
            <span>Thêm mới</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 md:gap-6 mb-6 md:mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        {statusKpis.map((item) => (
          <div key={item.status} className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-500">{item.label}</p>
              <span className={`p-2 rounded-lg material-symbols-outlined ${item.iconClassName}`}>{item.icon}</span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-slate-900">{item.count}</p>
          </div>
        ))}
      </div>

      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-col md:flex-row gap-4 items-center">
          <div className="w-full md:flex-1 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên dự án, mã dự án..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none"
            />
          </div>
          <SearchableSelect
            className="w-full md:w-48"
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusFilterOptions}
            placeholder="Tất cả trạng thái"
            triggerClassName="w-full pl-3 pr-8 py-2 h-10 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm text-slate-600 outline-none"
          />
        </div>

        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left border-collapse min-w-[1400px]">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  {[
                    { label: 'Mã dự án', key: 'project_code', widthClassName: 'w-[120px]' },
                    { label: 'Tên dự án', key: 'project_name', widthClassName: 'w-[340px]' },
                    { label: 'Khách hàng', key: 'customer_id', widthClassName: 'w-[300px]' },
                    { label: 'Ngày BĐ', key: 'start_date', widthClassName: 'w-[140px]' },
                    { label: 'Ngày KT', key: 'expected_end_date', widthClassName: 'w-[140px]' },
                    { label: 'Trạng thái', key: 'status', widthClassName: 'w-[320px]' },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className={`px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none ${col.widthClassName}`}
                      onClick={() => handleSort(col.key as keyof Project)}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-deep-teal">{col.label}</span>
                        {renderSortIcon(col.key as keyof Project)}
                      </div>
                    </th>
                  ))}
                  <th className="sticky right-0 w-[148px] min-w-[148px] whitespace-nowrap bg-slate-50 px-4 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {currentData.length > 0 ? (
                  currentData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono font-bold text-slate-600 whitespace-nowrap">{item.project_code}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900 truncate" title={item.project_name}>{item.project_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 truncate" title={getCustomerName(item.customer_id)}>
                        {getCustomerName(item.customer_id)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{formatDateDdMmYyyy(item.start_date || '')}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{formatDateDdMmYyyy(item.expected_end_date || '')}</td>
                      <td className="px-6 py-4 overflow-hidden">
                        <div className="max-w-full overflow-hidden">
                          <span
                            className={`inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(item.status)}`}
                            title={getStatusLabel(item.status)}
                          >
                            <span className="truncate whitespace-nowrap">{getStatusLabel(item.status)}</span>
                          </span>
                        </div>
                      </td>
                      <td className="sticky right-0 z-[1] w-[148px] min-w-[148px] bg-white px-4 py-4 text-center shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center justify-center gap-2">
                          {onCreateContract && (
                            <button
                              onClick={() => onCreateContract(item)}
                              className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                              title="Tạo hợp đồng"
                            >
                              <span className="material-symbols-outlined text-lg">description</span>
                            </button>
                          )}
                          {onOpenProcedure && (
                            <button
                              onClick={() => onOpenProcedure(item)}
                              className="p-1.5 text-slate-400 hover:text-deep-teal transition-colors"
                              title="Thủ tục dự án"
                            >
                              <span className="material-symbols-outlined text-lg">checklist</span>
                            </button>
                          )}
                          <button onClick={() => onOpenModal('EDIT_PROJECT', item)} className="p-1.5 text-slate-400 hover:text-primary transition-colors" title="Chỉnh sửa"><span className="material-symbols-outlined text-lg">edit</span></button>
                          <button onClick={() => onOpenModal('DELETE_PROJECT', item)} className="p-1.5 text-slate-400 hover:text-error transition-colors" title="Xóa"><span className="material-symbols-outlined text-lg">delete</span></button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      {isLoading ? 'Đang tải dữ liệu...' : 'Không tìm thấy dự án.'}
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
            onPageChange={goToPage}
            onRowsPerPageChange={(rows) => {
              setRowsPerPage(rows);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>
    </div>
  );
};
