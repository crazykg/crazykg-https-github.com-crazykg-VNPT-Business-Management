import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import { useModuleShortcuts } from '../hooks/useModuleShortcuts';
import { AuthUser, Project, Customer, Department, ModalType, PaginatedQuery, PaginationMeta, ProjectItemMaster, ProjectRaciRow, ProjectTypeOption } from '../types';
import { PHASE_LABELS, PROJECT_SPECIAL_STATUSES, getProjectStatusLabel as getPhaseStatusLabel, getProjectStatusColor } from '../constants';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect } from './SearchableSelect';
import { downloadExcelWorkbook } from '../utils/excelTemplate';
import { exportCsv, exportPdfTable, isoDateStamp } from '../utils/exportUtils';
import { formatDateDdMmYyyy } from '../utils/dateDisplay';
import { formatCurrencyVnd } from '../utils/revenueDisplay';
import { FILTER_DEFAULTS, useFilterStore } from '../shared/stores/filterStore';
import { resolveProjectDefaultDepartmentFilterId } from '../utils/projectDepartmentOwnership';

interface ProjectListQuery extends PaginatedQuery {
  filters?: {
    status?: string;
    department_id?: string;
    start_date_from?: string;
    start_date_to?: string;
  };
}

interface ProjectListProps {
  projects: Project[];
  customers: Customer[];
  departments?: Department[];
  authUser?: AuthUser | null;
  projectTypes?: ProjectTypeOption[];
  onOpenModal: (type: ModalType, item?: Project) => void;
  onCreateContract?: (project: Project) => void;
  onOpenProcedure?: (project: Project) => void;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
  onExportProjects?: () => Promise<Project[]>;
  onExportProjectRaci?: (projectIds: Array<string | number>) => Promise<ProjectRaciRow[]>;
  projectItems?: ProjectItemMaster[];
  canImport?: boolean;
  paginationMeta?: PaginationMeta;
  isLoading?: boolean;
  onQueryChange?: (query: ProjectListQuery) => void;
}

const getDefaultProjectDateFilter = (
  key: 'start_date_from' | 'start_date_to'
): string => String(FILTER_DEFAULTS.projectsPage.filters?.[key] ?? '').trim();

const resolveInitialProjectDateFilter = (
  key: 'start_date_from' | 'start_date_to'
): string => {
  const storedQuery = useFilterStore.getState().getTabFilter('projectsPage') as ProjectListQuery;
  const storedValue = String(storedQuery.filters?.[key] ?? '').trim();
  return storedValue || getDefaultProjectDateFilter(key);
};

const normalizeDepartmentToken = (value: unknown): string =>
  String(value ?? '')
    .replace(/[Đđ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .trim()
    .toUpperCase();

const getProjectDepartmentFilterSource = (departments: Department[]): Department[] => {
  const rootDepartment = (departments || []).find((department) => {
    const codeToken = normalizeDepartmentToken(department.dept_code);
    const nameToken = normalizeDepartmentToken(department.dept_name);
    return codeToken === 'BGDVT' || nameToken === 'BANGIAMDOCVIENTHONG';
  });

  if (!rootDepartment) {
    return [];
  }

  return (departments || [])
    .filter((department) => String(department.parent_id ?? '') === String(rootDepartment.id))
    .filter((department) => normalizeDepartmentToken(department.dept_code) !== 'PKT')
    .sort((left, right) =>
      `${left.dept_code} ${left.dept_name}`.localeCompare(`${right.dept_code} ${right.dept_name}`, 'vi')
    );
};

const getStoredProjectDepartmentFilter = (): string => {
  const storedQuery = useFilterStore.getState().getTabFilter('projectsPage') as ProjectListQuery;
  return String(storedQuery.filters?.department_id ?? '').trim();
};

const resolveInitialProjectDepartmentFilter = (
  authUser: AuthUser | null | undefined,
  departments: Department[],
  availableDepartments: Department[]
): string => {
  const availableDepartmentIds = new Set(availableDepartments.map((department) => String(department.id)));
  const storedDepartmentFilter = getStoredProjectDepartmentFilter();

  if (storedDepartmentFilter && availableDepartmentIds.has(storedDepartmentFilter)) {
    return storedDepartmentFilter;
  }

  return resolveProjectDefaultDepartmentFilterId(authUser, departments, availableDepartmentIds);
};

export const ProjectList: React.FC<ProjectListProps> = ({
  projects = [],
  customers = [],
  departments = [],
  authUser = null,
  projectTypes = [],
  onOpenModal,
  onCreateContract,
  onOpenProcedure,
  onNotify,
  onExportProjects,
  onExportProjectRaci,
  projectItems = [],
  canImport = false,
  paginationMeta,
  isLoading = false,
  onQueryChange,
}: ProjectListProps) => {
  const serverMode = Boolean(onQueryChange && paginationMeta);
  const bodyCellClassName = 'px-3 py-2.5 align-middle text-xs text-slate-600';
  const bodyCellContentClassName = 'flex min-h-5 w-full items-center';
  const projectDepartmentFilterSource = useMemo(
    () => getProjectDepartmentFilterSource(departments),
    [departments]
  );
  const initialDepartmentFilter = useMemo(
    () => resolveInitialProjectDepartmentFilter(authUser, departments, projectDepartmentFilterSource),
    [authUser, departments, projectDepartmentFilterSource]
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState(() => initialDepartmentFilter);
  const [startDateFrom, setStartDateFrom] = useState(() => resolveInitialProjectDateFilter('start_date_from'));
  const [startDateTo, setStartDateTo] = useState(() => resolveInitialProjectDateFilter('start_date_to'));
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Project; direction: 'asc' | 'desc' } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Pending filters for manual search mode
  const [pendingSearchTerm, setPendingSearchTerm] = useState('');
  const [pendingStatusFilter, setPendingStatusFilter] = useState('');
  const [pendingDepartmentFilter, setPendingDepartmentFilter] = useState(() => initialDepartmentFilter);
  const [pendingStartDateFrom, setPendingStartDateFrom] = useState(() => resolveInitialProjectDateFilter('start_date_from'));
  const [pendingStartDateTo, setPendingStartDateTo] = useState(() => resolveInitialProjectDateFilter('start_date_to'));
  const [searchTrigger, setSearchTrigger] = useState(0);

  const [showImportMenu, setShowImportMenu] = useState(false);
  useEscKey(() => { setShowImportMenu(false); setShowExportMenu(false); }, showImportMenu || showExportMenu);
  const [isExporting, setIsExporting] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | number | null>(null);
  const hasUserAdjustedDepartmentFilterRef = useRef(false);
  const hasInitializedFiltersRef = useRef(false);

  useModuleShortcuts({
    onNew: () => onOpenModal('ADD_PROJECT'),
    onUpdate: () => {
      if (selectedRowId) {
        const item = (projects ?? []).find((p) => String(p.id) === String(selectedRowId));
        if (item) onOpenModal('EDIT_PROJECT', item);
      }
    },
    onDelete: () => {
      if (selectedRowId) {
        const item = (projects ?? []).find((p) => String(p.id) === String(selectedRowId));
        if (item) onOpenModal('DELETE_PROJECT', item);
      }
    },
    onFocusSearch: () => searchInputRef.current?.focus(),
  });

  const normalizeCompactText = (value: unknown): string =>
    String(value ?? '').replace(/\s+/g, ' ').trim();

  const escapeRegex = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const getCustomerById = (id: string | number | null | undefined): Customer | undefined =>
    (customers || []).find((item) => String(item.id) === String(id));

  const getCustomerDisplayName = (id: string | number | null | undefined): string => {
    const customer = getCustomerById(id);
    if (!customer) {
      return String(id ?? '');
    }

    const customerName = normalizeCompactText(customer.customer_name);
    return customerName || String(id ?? '');
  };

  const getCustomerSearchText = (id: string | number | null | undefined): string => {
    const customer = getCustomerById(id);
    if (!customer) {
      return String(id ?? '');
    }

    return [
      normalizeCompactText(customer.customer_code),
      normalizeCompactText(customer.customer_name),
    ].filter(Boolean).join(' - ');
  };

  const getProjectDisplayName = (project: Project): string => {
    const projectName = normalizeCompactText(project.project_name);
    const customerName = normalizeCompactText(getCustomerDisplayName(project.customer_id));

    if (!projectName || !customerName) {
      return projectName;
    }

    const repeatedSuffixPattern = new RegExp(`\\s*[-–—]\\s*${escapeRegex(customerName)}$`, 'i');
    if (!repeatedSuffixPattern.test(projectName)) {
      return projectName;
    }

    return projectName.replace(repeatedSuffixPattern, '').trim();
  };

  const getStatusLabel = (status: string) => getPhaseStatusLabel(status);
  const getStatusColor = (status: string) => getProjectStatusColor(status);

  const projectItemsTotalByProjectId = useMemo(() => {
    const totals = new Map<string, number>();

    (projectItems || []).forEach((item) => {
      const projectId = String(item.project_id ?? '').trim();
      if (!projectId) {
        return;
      }

      const quantity = Number(item.quantity ?? 0);
      const unitPrice = Number(item.unit_price ?? 0);
      const lineTotal = quantity * unitPrice;
      if (!Number.isFinite(lineTotal)) {
        return;
      }

      totals.set(projectId, (totals.get(projectId) ?? 0) + lineTotal);
    });

    return totals;
  }, [projectItems]);

  const getProjectItemsDisplayTotal = (project: Project): number | null => {
    const projectTotal = projectItemsTotalByProjectId.get(String(project.id));
    if (projectTotal !== undefined) {
      return projectTotal;
    }

    if (typeof project.estimated_value === 'number') {
      return Number.isFinite(project.estimated_value) ? project.estimated_value : null;
    }

    if (project.estimated_value == null || String(project.estimated_value).trim() === '') {
      return null;
    }

    const parsed = Number(project.estimated_value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const filteredProjects = useMemo(() => {
    if (serverMode) {
      return projects || [];
    }

    let result = (projects || []).filter((proj) => {
      const customerSearchText = getCustomerSearchText(proj.customer_id).toLowerCase();
      const projName = `${proj.project_name || ''} ${getProjectDisplayName(proj)}`.toLowerCase();
      const searchLower = searchTerm.toLowerCase();

      const matchesSearch =
        projName.includes(searchLower) ||
        customerSearchText.includes(searchLower) ||
        (proj.project_code || '').toLowerCase().includes(searchLower);
      const matchesStatus = statusFilter ? proj.status === statusFilter : true;
      const matchesDepartment = departmentFilter
        ? String(proj.department_id ?? '') === departmentFilter
        : true;

      return matchesSearch && matchesStatus && matchesDepartment;
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        if (sortConfig.key === 'customer_id') {
          aValue = getCustomerDisplayName(a.customer_id);
          bValue = getCustomerDisplayName(b.customer_id);
        }

        if (sortConfig.key === 'project_name') {
          aValue = getProjectDisplayName(a);
          bValue = getProjectDisplayName(b);
        }

        if (sortConfig.key === 'estimated_value') {
          aValue = getProjectItemsDisplayTotal(a) ?? 0;
          bValue = getProjectItemsDisplayTotal(b) ?? 0;
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
  }, [serverMode, projects, searchTerm, statusFilter, departmentFilter, sortConfig, customers, projectItemsTotalByProjectId]);

  const statusFilterOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả trạng thái' },
      ...Object.entries(PHASE_LABELS).map(([value, label]) => ({ value, label })),
      ...PROJECT_SPECIAL_STATUSES.map(({ value, label }) => ({ value, label })),
    ],
    []
  );

  const departmentFilterOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả phòng ban' },
      ...projectDepartmentFilterSource.map((dept) => ({
        value: String(dept.id),
        label: dept.dept_name || dept.dept_code,
        searchText: `${dept.dept_code || ''} ${dept.dept_name || ''}`.trim(),
      })),
    ],
    [projectDepartmentFilterSource]
  );

  // Track the last synced initialDepartmentFilter value
  const lastSyncedInitialFilterRef = useRef<string>('');

  // Apply initial department filter - sync whenever initialDepartmentFilter changes (if user hasn't adjusted)
  useEffect(() => {
    if (hasUserAdjustedDepartmentFilterRef.current) {
      hasInitializedFiltersRef.current = true;
      return;
    }

    const normalizedInitial = String(initialDepartmentFilter || '').trim();

    if (!normalizedInitial) {
      hasInitializedFiltersRef.current = true;
      return;
    }

    // Skip if already synced to this value
    if (lastSyncedInitialFilterRef.current === normalizedInitial) {
      hasInitializedFiltersRef.current = true;
      return;
    }

    setDepartmentFilter((currentValue) => {
      const normalizedCurrent = String(currentValue || '').trim();

      // If current value already matches initial, no need to update
      if (normalizedCurrent === normalizedInitial) {
        lastSyncedInitialFilterRef.current = normalizedInitial;
        return currentValue;
      }

      // If user has a different non-empty value, don't override
      if (normalizedCurrent !== '' && normalizedCurrent !== normalizedInitial) {
        return currentValue;
      }

      lastSyncedInitialFilterRef.current = normalizedInitial;
      return initialDepartmentFilter;
    });

    setPendingDepartmentFilter((currentValue) => {
      const normalizedCurrent = String(currentValue || '').trim();
      if (normalizedCurrent === normalizedInitial) {
        return currentValue;
      }
      if (normalizedCurrent !== '' && normalizedCurrent !== normalizedInitial) {
        return currentValue;
      }
      return initialDepartmentFilter;
    });

    // Mark as initialized after applying initial filter
    hasInitializedFiltersRef.current = true;
  }, [initialDepartmentFilter]);

  const totalItems = serverMode ? (paginationMeta?.total || 0) : filteredProjects.length;
  const totalPages = serverMode
    ? Math.max(1, paginationMeta?.total_pages || 1)
    : Math.max(1, Math.ceil(totalItems / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Manual search mode: call API only after user triggers search
  useEffect(() => {
    if (!serverMode || !onQueryChange) {
      return;
    }

    if (!hasInitializedFiltersRef.current) {
      return;
    }

    // Do not auto-load while user is still preparing filters
    if (searchTrigger === 0) {
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
        department_id: departmentFilter,
        start_date_from: startDateFrom,
        start_date_to: startDateTo,
      },
    });
  }, [serverMode, onQueryChange, searchTrigger, currentPage, rowsPerPage, searchTerm, statusFilter, departmentFilter, startDateFrom, startDateTo, sortConfig]);

  const currentData = serverMode
    ? (projects || [])
    : filteredProjects.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const overallProjectsDisplayTotal = useMemo(() => {
    const serverReportedTotal = Number(paginationMeta?.kpis?.total_estimated_value);
    if (serverMode && Number.isFinite(serverReportedTotal) && serverReportedTotal >= 0) {
      return serverReportedTotal;
    }

    const source = serverMode ? (projects || []) : filteredProjects;

    return source.reduce((sum, project) => {
      const projectTotal = getProjectItemsDisplayTotal(project);
      if (projectTotal === null || !Number.isFinite(projectTotal)) {
        return sum;
      }

      return sum + projectTotal;
    }, 0);
  }, [serverMode, paginationMeta, projects, filteredProjects, projectItemsTotalByProjectId]);

  const kpiSource = serverMode ? (projects || []) : filteredProjects;
  const statusKpis = useMemo(
    () => [
      {
        label: 'Cơ hội',
        status: 'CO_HOI',
        count: kpiSource.filter((item) => item.status === 'CO_HOI').length,
        icon: 'lightbulb',
        iconClassName: 'bg-secondary/15 text-secondary',
      },
      {
        label: 'Chuẩn bị',
        status: 'CHUAN_BI',
        count: kpiSource.filter((item) => item.status === 'CHUAN_BI').length,
        icon: 'pending_actions',
        iconClassName: 'bg-slate-100 text-neutral',
      },
      {
        label: 'Chuẩn bị đầu tư',
        status: 'CHUAN_BI_DAU_TU',
        count: kpiSource.filter((item) => item.status === 'CHUAN_BI_DAU_TU').length,
        icon: 'inventory_2',
        iconClassName: 'bg-primary/10 text-primary',
      },
      {
        label: 'Thực hiện đầu tư',
        status: 'THUC_HIEN_DAU_TU',
        count: kpiSource.filter((item) => item.status === 'THUC_HIEN_DAU_TU').length,
        icon: 'rocket_launch',
        iconClassName: 'bg-tertiary/10 text-tertiary',
      },
      {
        label: 'Kết thúc đầu tư',
        status: 'KET_THUC_DAU_TU',
        count: kpiSource.filter((item) => item.status === 'KET_THUC_DAU_TU').length,
        icon: 'task_alt',
        iconClassName: 'bg-success/10 text-success',
      },
      {
        label: 'Chuẩn bị KH thuê',
        status: 'CHUAN_BI_KH_THUE',
        count: kpiSource.filter((item) => item.status === 'CHUAN_BI_KH_THUE').length,
        icon: 'assignment',
        iconClassName: 'bg-secondary/10 text-secondary',
      },
      {
        label: 'Tạm ngưng',
        status: 'TAM_NGUNG',
        count: kpiSource.filter((item) => item.status === 'TAM_NGUNG').length,
        icon: 'pause_circle',
        iconClassName: 'bg-tertiary/10 text-tertiary',
      },
      {
        label: 'Huỷ',
        status: 'HUY',
        count: kpiSource.filter((item) => item.status === 'HUY').length,
        icon: 'cancel',
        iconClassName: 'bg-error/10 text-error',
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

  const handleManualSearch = () => {
    setSearchTerm(pendingSearchTerm);
    setStatusFilter(pendingStatusFilter);
    setDepartmentFilter(pendingDepartmentFilter);
    setStartDateFrom(pendingStartDateFrom);
    setStartDateTo(pendingStartDateTo);
    setCurrentPage(1);
    setSearchTrigger((prev) => prev + 1);
  };

  const handleResetFilters = () => {
    setPendingSearchTerm('');
    setPendingStatusFilter('');
    setPendingDepartmentFilter(initialDepartmentFilter);
    setPendingStartDateFrom('');
    setPendingStartDateTo('');
    setSearchTerm('');
    setStatusFilter('');
    setDepartmentFilter(initialDepartmentFilter);
    setStartDateFrom('');
    setStartDateTo('');
    setCurrentPage(1);
    setSearchTrigger((prev) => prev + 1);
  };

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
    if (token === 'THUE_DICH_VU_COSAN') return 'Thuê dịch vụ CNTT có sẵn';
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
          'Mã DA',
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
        'Mã DA',
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
            headers: ['Mã DA', 'Tên dự án', 'Mã sản phẩm', 'Tên sản phẩm', 'Số lượng', 'Đơn giá', 'Thành tiền'],
            rows: itemSheetRows,
          },
          {
            name: 'RACI',
            headers: ['Mã DA', 'Tên dự án', 'Vai trò', 'Mã NS', 'Username', 'Họ tên', 'Ngày phân công'],
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
    <div className="p-3 pb-6">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>account_tree</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal leading-tight">Quản lý Dự án</h2>
            <p className="text-[11px] text-slate-400 leading-tight">Theo dõi tiến độ và thông tin các dự án đang triển khai.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Import */}
          {canImport ? (
            <div className="relative">
              <button
                onClick={() => { setShowImportMenu((prev) => !prev); setShowExportMenu(false); }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>upload</span>
                Nhập
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
              </button>
              {showImportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowImportMenu(false)} />
                  <div className="absolute top-full left-0 mt-1.5 w-44 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden">
                    <button
                      onClick={() => { setShowImportMenu(false); onOpenModal('IMPORT_DATA'); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>upload_file</span> Nhập dữ liệu
                    </button>
                    <button
                      onClick={handleDownloadTemplate}
                      className="w-full flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>download</span> Tải file mẫu
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {/* Export */}
          <div className="relative">
            <button
              onClick={() => { setShowExportMenu((prev) => !prev); setShowImportMenu(false); }}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>download</span>
              {isExporting ? 'Đang xuất...' : 'Xuất'}
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute top-full right-0 mt-1.5 w-36 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden">
                  <button onClick={() => void handleExport('excel')} className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>table_view</span> Excel
                  </button>
                  <button onClick={() => void handleExport('csv')} className="w-full flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>csv</span> CSV
                  </button>
                  <button onClick={() => void handleExport('pdf')} className="w-full flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>picture_as_pdf</span> PDF
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Add */}
          <button
            onClick={() => onOpenModal('ADD_PROJECT')}
            title="Thêm dự án (Ctrl+N / ⌘N)"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors bg-primary text-white hover:bg-deep-teal shadow-sm"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
            Thêm mới
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="mb-3 grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {statusKpis.map((item) => {
          const isActive = statusFilter === item.status;
          return (
            <button
              key={item.status}
              type="button"
              onClick={() => { setStatusFilter(isActive ? '' : item.status); setCurrentPage(1); }}
              aria-pressed={isActive}
              className={`rounded-lg border p-3 text-left shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                isActive
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-slate-200 bg-white hover:border-primary/30 hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[11px] font-semibold leading-tight ${isActive ? 'text-primary' : 'text-neutral'}`}>
                  {item.label}
                </span>
                <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${item.iconClassName}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{item.icon}</span>
                </div>
              </div>
              <p className={`text-xl font-black leading-tight ${isActive ? 'text-primary' : 'text-deep-teal'}`}>
                {item.count}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">dự án</p>
            </button>
          );
        })}
      </div>

      {/* ── Table section ── */}
      <div>
        <div className="bg-white px-3 py-2 rounded-t-lg border border-slate-200 border-b-0 flex flex-col gap-2">
          <div className="flex flex-col md:flex-row gap-2 items-center">
            <div className="w-full md:flex-1 flex items-center gap-1.5">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>search</span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={pendingSearchTerm}
                  onChange={(e) => setPendingSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleManualSearch();
                    }
                  }}
                  placeholder="Tìm theo tên dự án, mã DA..."
                  className="w-full h-8 pl-8 pr-8 bg-slate-50 border border-slate-200 rounded focus:ring-1 focus:ring-primary/30 focus:border-primary text-xs placeholder:text-slate-400 outline-none"
                />
                {pendingSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setPendingSearchTerm('')}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
                    title="Xóa tìm kiếm"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleManualSearch}
                className="inline-flex items-center gap-1 rounded border border-primary bg-primary text-white px-3 py-1.5 text-xs font-semibold hover:bg-deep-teal transition-colors shrink-0"
                title="Tìm kiếm (Enter)"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>search</span>
                Tìm kiếm
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-primary transition-colors shrink-0"
                title="Làm mới / Xóa tất cả bộ lọc"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>refresh</span>
                Làm mới
              </button>
            </div>
            <SearchableSelect
              className="w-full md:w-44"
              value={pendingStatusFilter}
              onChange={(val) => setPendingStatusFilter(val)}
              options={statusFilterOptions}
              placeholder="Tất cả trạng thái"
              triggerClassName="w-full h-8 text-xs text-slate-600"
            />
            <SearchableSelect
              className="w-full md:w-52"
              value={pendingDepartmentFilter}
              onChange={(val) => {
                hasUserAdjustedDepartmentFilterRef.current = true;
                setPendingDepartmentFilter(val);
              }}
              options={departmentFilterOptions}
              placeholder="Tất cả phòng ban"
              triggerClassName="w-full h-8 text-xs text-slate-600"
            />
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>calendar_today</span>
                Ngày bắt đầu:
              </div>
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <input
                  type="date"
                  lang="vi-VN"
                  value={pendingStartDateFrom}
                  onChange={(e) => setPendingStartDateFrom(e.target.value)}
                  className="h-8 w-full sm:w-36 rounded border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none"
                  title="Từ ngày"
                />
                <span className="text-slate-400 text-xs shrink-0">→</span>
                <input
                  type="date"
                  lang="vi-VN"
                  value={pendingStartDateTo}
                  onChange={(e) => setPendingStartDateTo(e.target.value)}
                  className="h-8 w-full sm:w-36 rounded border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none"
                  title="Đến ngày"
                />
                {(pendingStartDateFrom || pendingStartDateTo) && (
                  <button
                    type="button"
                    onClick={() => { setPendingStartDateFrom(''); setPendingStartDateTo(''); }}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50 transition-colors shrink-0"
                    title="Xóa lọc ngày"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
                  </button>
                )}
              </div>
            </div>
            <div className="flex justify-end lg:justify-self-end">
              <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-primary/10 bg-primary/5 px-3 py-2 sm:w-auto sm:min-w-[320px]">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Tổng cộng
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-black leading-none text-primary">
                    {formatCurrencyVnd(overallProjectsDisplayTotal)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-b-lg border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left border-collapse min-w-[1160px]">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  {[
                    { label: 'Mã DA', sortKey: 'project_code', widthClassName: 'w-[96px]', responsiveClassName: 'hidden sm:table-cell', headerClassName: '', headerContentClassName: '' },
                    { label: 'Tên dự án', sortKey: 'project_name', widthClassName: 'w-[240px]', responsiveClassName: '', headerClassName: '', headerContentClassName: '' },
                    { label: 'Khách hàng', sortKey: 'customer_id', widthClassName: 'w-[200px]', responsiveClassName: 'hidden md:table-cell', headerClassName: '', headerContentClassName: '' },
                    { label: 'Ngày BĐ', sortKey: 'start_date', widthClassName: 'w-[104px]', responsiveClassName: '', headerClassName: '', headerContentClassName: '' },
                    { label: 'Ngày KT', sortKey: 'expected_end_date', widthClassName: 'w-[104px]', responsiveClassName: 'hidden xl:table-cell', headerClassName: '', headerContentClassName: '' },
                    { label: 'Thành tiền', sortKey: 'estimated_value', widthClassName: 'w-[148px]', responsiveClassName: '', headerClassName: 'text-right', headerContentClassName: 'justify-end' },
                    { label: 'Trạng thái', sortKey: 'status', widthClassName: 'w-[168px]', responsiveClassName: '', headerClassName: '', headerContentClassName: '' },
                  ].map((col) => (
                    <th
                      key={col.label}
                      className={`px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider transition-colors select-none ${col.sortKey ? 'cursor-pointer hover:bg-slate-100' : ''} ${col.widthClassName} ${col.responsiveClassName} ${col.headerClassName}`}
                      onClick={col.sortKey ? () => handleSort(col.sortKey as keyof Project) : undefined}
                    >
                      <div className={`flex items-center gap-1 ${col.headerContentClassName}`}>
                        <span className="text-deep-teal">{col.label}</span>
                        {col.sortKey ? renderSortIcon(col.sortKey as keyof Project) : null}
                      </div>
                    </th>
                  ))}
                  <th className="sticky right-0 w-[96px] min-w-[96px] whitespace-nowrap bg-slate-50 px-2.5 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentData.length > 0 ? (
                  currentData.map((item) => {
                    const displayProjectName = getProjectDisplayName(item);
                    const displayCustomerName = getCustomerDisplayName(item.customer_id);

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedRowId((prev) => (String(prev) === String(item.id) ? null : item.id))}
                        className={`cursor-pointer transition-colors ${
                          String(selectedRowId) === String(item.id)
                            ? 'bg-secondary/10 ring-1 ring-inset ring-primary/30'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className={`hidden sm:table-cell ${bodyCellClassName} font-mono font-bold whitespace-nowrap`}>
                          <div className={`${bodyCellContentClassName} whitespace-nowrap`}>{item.project_code}</div>
                        </td>
                        <td className={`${bodyCellClassName} font-semibold text-slate-900`} title={displayProjectName}>
                          <div className={`${bodyCellContentClassName} whitespace-normal break-words leading-5`}>{displayProjectName}</div>
                        </td>
                        <td className={`hidden md:table-cell ${bodyCellClassName}`} title={displayCustomerName}>
                          <div className={`${bodyCellContentClassName} whitespace-normal break-words leading-5`}>{displayCustomerName}</div>
                        </td>
                        <td className={`${bodyCellClassName} whitespace-nowrap`}>
                          <div className={`${bodyCellContentClassName} whitespace-nowrap`}>{formatDateDdMmYyyy(item.start_date || '')}</div>
                        </td>
                        <td className={`hidden xl:table-cell ${bodyCellClassName} whitespace-nowrap`}>
                          <div className={`${bodyCellContentClassName} whitespace-nowrap`}>{formatDateDdMmYyyy(item.expected_end_date || '')}</div>
                        </td>
                        <td className={`${bodyCellClassName} text-right font-semibold text-slate-900 whitespace-nowrap`}>
                          <div className={`${bodyCellContentClassName} justify-end whitespace-nowrap`}>
                            {formatCurrencyVnd(getProjectItemsDisplayTotal(item))}
                          </div>
                        </td>
                        <td className={`${bodyCellClassName} overflow-hidden`}>
                          <div className={`${bodyCellContentClassName} max-w-full overflow-hidden`}>
                            <span
                              className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${getStatusColor(item.status)}`}
                              title={getStatusLabel(item.status)}
                            >
                              <span className="truncate whitespace-nowrap">{getStatusLabel(item.status)}</span>
                            </span>
                          </div>
                        </td>
                        <td className="sticky right-0 z-[1] w-[96px] min-w-[96px] bg-white px-2.5 py-2.5 align-middle text-center shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]">
                          <div className="flex items-center justify-center gap-0.5">
                            {onCreateContract && (
                              <button
                                onClick={() => onCreateContract(item)}
                                className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary"
                                title="Tạo hợp đồng"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>description</span>
                              </button>
                            )}
                            {onOpenProcedure && (
                              <button
                                onClick={() => onOpenProcedure(item)}
                                data-testid={`project-open-procedure-${item.id}`}
                                className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-deep-teal"
                                title="Thủ tục dự án"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>checklist</span>
                              </button>
                            )}
                            <button onClick={() => onOpenModal('EDIT_PROJECT', item)} className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary" title="Chỉnh sửa">
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                            </button>
                            <button onClick={() => onOpenModal('DELETE_PROJECT', item)} className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-error" title="Xóa">
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-xs text-slate-500">
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
