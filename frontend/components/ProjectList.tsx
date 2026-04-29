import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEscKey } from '../hooks/useEscKey';
import { useModuleShortcuts } from '../hooks/useModuleShortcuts';
import { AuthUser, Project, Customer, Department, ModalType, PaginatedQuery, PaginationMeta, ProjectItemMaster, ProjectRaciRow, ProjectTypeOption } from '../types';
import { PHASE_LABELS, PROJECT_SPECIAL_STATUSES, getProjectStatusLabel as getPhaseStatusLabel, getProjectStatusColor } from '../constants';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect } from './SearchableSelect';
import { CascadingEntitySearchFilter, type CascadingEntitySearchValue } from './CascadingEntitySearchFilter';
import { downloadExcelWorkbook } from '../utils/excelTemplate';
import { exportCsv, exportPdfTable, isoDateStamp } from '../utils/exportUtils';
import { formatDateDdMmYyyy } from '../utils/dateDisplay';
import { formatCurrencyVnd } from '../utils/revenueDisplay';
import { getProjectsPageDefaultDateFilters, useFilterStore } from '../shared/stores/filterStore';
import { resolveProjectDefaultDepartmentFilterId } from '../utils/projectDepartmentOwnership';
import { DateRangePresetPicker, resolveDateRangePresetRange, type DateRangePresetValue } from './DateRangePresetPicker';
import { ModalWrapper } from './modals/shared';

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
): string => String(getProjectsPageDefaultDateFilters()[key] ?? '').trim();

const createEmptyCascadingEntitySearchValue = (): CascadingEntitySearchValue => ({
  customerIds: [],
  projectIds: [],
  productIds: [],
});

const hasCascadingEntitySelection = (value: CascadingEntitySearchValue): boolean =>
  value.customerIds.length > 0 || value.projectIds.length > 0 || value.productIds.length > 0;

const resolveInitialProjectDateFilter = (
  key: 'start_date_from' | 'start_date_to'
): string => {
  const storedQuery = useFilterStore.getState().getTabFilter('projectsPage') as ProjectListQuery;
  const storedValue = String(storedQuery.filters?.[key] ?? '').trim();
  return storedValue || getDefaultProjectDateFilter(key);
};

const normalizeProjectDateFilterValue = (value: unknown): string => {
  const normalized = String(value ?? '').trim();
  const matchedIsoDate = normalized.match(/^\d{4}-\d{2}-\d{2}/);

  return matchedIsoDate?.[0] ?? '';
};

const PROJECT_DATE_PRESET_VALUES: DateRangePresetValue[] = [
  'this_month',
  'last_month',
  'this_quarter',
  'this_year',
];

const resolveProjectDatePresetValue = (
  dateFrom: string,
  dateTo: string,
  referenceDate: Date = new Date()
): DateRangePresetValue => {
  const normalizedFrom = normalizeProjectDateFilterValue(dateFrom);
  const normalizedTo = normalizeProjectDateFilterValue(dateTo);

  for (const preset of PROJECT_DATE_PRESET_VALUES) {
    const presetRange = resolveDateRangePresetRange(preset, normalizedFrom, normalizedTo, referenceDate);
    if (
      normalizedFrom === normalizeProjectDateFilterValue(presetRange.from)
      && normalizedTo === normalizeProjectDateFilterValue(presetRange.to)
    ) {
      return preset;
    }
  }

  return 'custom';
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
  const bodyCellClassName = 'px-3 py-2 align-middle text-sm text-slate-700';
  const bodyCellContentClassName = 'flex min-h-5 w-full items-center';
  const denseToolbarSelectTriggerClassName = '!h-8 !rounded-md !border-slate-200 !bg-slate-50 !text-sm !text-slate-700';
  const denseToolbarButtonClassName = 'inline-flex h-8 items-center justify-center gap-1 rounded-md border text-xs font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-primary/30';
  const shellCardClassName = 'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm';
  const headerActionButtonClassName = 'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-primary/30';
  const tableActionButtonClassName = 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-slate-400 transition-colors hover:border-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary/20';
  const mobilePrimaryActionButtonClassName = 'group inline-flex h-11 min-w-[112px] items-center justify-center rounded-md px-1 transition-colors focus:outline-none focus:ring-1 focus:ring-primary/30';
  const mobilePrimaryActionVisualClassName = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-deep-teal/10 px-2.5 text-xs font-bold text-deep-teal ring-1 ring-inset ring-deep-teal/15 transition-colors group-hover:bg-deep-teal/15';
  const mobileIconActionButtonClassName = 'group inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-primary/30';
  const mobileIconActionVisualClassName = 'inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors group-hover:bg-slate-50 group-hover:text-primary';
  const mobileMenuItemButtonClassName = 'group flex h-11 w-full items-center gap-2 rounded px-2 text-left text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary/30';
  const mobileMenuDangerItemButtonClassName = 'group flex h-11 w-full items-center gap-2 rounded px-2 text-left text-xs font-semibold text-slate-600 transition-colors hover:bg-error/10 hover:text-error focus:outline-none focus:ring-1 focus:ring-error/30';
  const projectDepartmentFilterSource = useMemo(
    () => getProjectDepartmentFilterSource(departments),
    [departments]
  );
  const initialDepartmentFilter = useMemo(
    () => resolveInitialProjectDepartmentFilter(authUser, departments, projectDepartmentFilterSource),
    [authUser, departments, projectDepartmentFilterSource]
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [structuredSearchValue, setStructuredSearchValue] = useState<CascadingEntitySearchValue>(
    createEmptyCascadingEntitySearchValue
  );
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState(() => initialDepartmentFilter);
  const [startDateFrom, setStartDateFrom] = useState(() => resolveInitialProjectDateFilter('start_date_from'));
  const [startDateTo, setStartDateTo] = useState(() => resolveInitialProjectDateFilter('start_date_to'));
  const [startDatePreset, setStartDatePreset] = useState<DateRangePresetValue>(() =>
    resolveProjectDatePresetValue(
      resolveInitialProjectDateFilter('start_date_from'),
      resolveInitialProjectDateFilter('start_date_to')
    )
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Project; direction: 'asc' | 'desc' } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Pending filters for manual search mode
  const [pendingSearchTerm, setPendingSearchTerm] = useState('');
  const [pendingStructuredSearchValue, setPendingStructuredSearchValue] = useState<CascadingEntitySearchValue>(
    createEmptyCascadingEntitySearchValue
  );
  const [pendingStatusFilter, setPendingStatusFilter] = useState('');
  const [pendingDepartmentFilter, setPendingDepartmentFilter] = useState(() => initialDepartmentFilter);
  const [pendingStartDateFrom, setPendingStartDateFrom] = useState(() => resolveInitialProjectDateFilter('start_date_from'));
  const [pendingStartDateTo, setPendingStartDateTo] = useState(() => resolveInitialProjectDateFilter('start_date_to'));
  const [pendingStartDatePreset, setPendingStartDatePreset] = useState<DateRangePresetValue>(() =>
    resolveProjectDatePresetValue(
      resolveInitialProjectDateFilter('start_date_from'),
      resolveInitialProjectDateFilter('start_date_to')
    )
  );
  const [searchTrigger, setSearchTrigger] = useState(0);

  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showDesktopAdvancedFilters, setShowDesktopAdvancedFilters] = useState(false);
  const [showMobileHeaderActions, setShowMobileHeaderActions] = useState(false);
  const [showMobileFilterSheet, setShowMobileFilterSheet] = useState(false);
  useEscKey(
    () => {
      setShowImportMenu(false);
      setShowExportMenu(false);
      setShowMobileHeaderActions(false);
    },
    showImportMenu || showExportMenu || showMobileHeaderActions
  );
  const [isExporting, setIsExporting] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | number | null>(null);
  const [openMobileActionProjectId, setOpenMobileActionProjectId] = useState<string | number | null>(null);
  const [isMobileProjectList, setIsMobileProjectList] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia('(max-width: 767px)').matches;
  });
  const hasUserAdjustedDepartmentFilterRef = useRef(false);
  const hasInitializedFiltersRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleMediaChange = () => setIsMobileProjectList(mediaQuery.matches);

    handleMediaChange();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleMediaChange);
      return () => mediaQuery.removeEventListener('change', handleMediaChange);
    }

    mediaQuery.addListener(handleMediaChange);
    return () => mediaQuery.removeListener(handleMediaChange);
  }, []);

  useEffect(() => {
    if (!isMobileProjectList) {
      setOpenMobileActionProjectId(null);
      setShowMobileHeaderActions(false);
      setShowMobileFilterSheet(false);
    }
  }, [isMobileProjectList]);

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

  const projectItemsByProjectId = useMemo(() => {
    const groupedItems = new Map<string, ProjectItemMaster[]>();

    (projectItems || []).forEach((item) => {
      const projectId = String(item.project_id ?? '').trim();
      if (!projectId) {
        return;
      }
      const existingItems = groupedItems.get(projectId) ?? [];
      existingItems.push(item);
      groupedItems.set(projectId, existingItems);
    });

    return groupedItems;
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

    const selectedCustomerIds = new Set(structuredSearchValue.customerIds.map((value) => String(value)));
    const selectedProjectIds = new Set(structuredSearchValue.projectIds.map((value) => String(value)));
    const selectedProductIds = new Set(structuredSearchValue.productIds.map((value) => String(value)));
    const searchLower = searchTerm.toLowerCase().trim();

    let result = (projects || []).filter((proj) => {
      const projectId = String(proj.id ?? '').trim();
      const customerSearchText = getCustomerSearchText(proj.customer_id).toLowerCase();
      const projName = `${proj.project_name || ''} ${getProjectDisplayName(proj)}`.toLowerCase();
      const projectItemsForProject = projectItemsByProjectId.get(projectId) ?? [];
      const productSearchText = projectItemsForProject
        .map((item) => `${item.product_code || ''} ${item.product_name || ''} ${item.display_name || ''}`)
        .join(' ')
        .toLowerCase();

      const matchesCustomerSelection = selectedCustomerIds.size > 0
        ? selectedCustomerIds.has(String(proj.customer_id ?? '').trim())
        : true;
      const matchesProjectSelection = selectedProjectIds.size > 0
        ? selectedProjectIds.has(projectId)
        : true;
      const matchesProductSelection = selectedProductIds.size > 0
        ? projectItemsForProject.some((item) => {
          const productId = String(item.product_id || item.product_code || item.id || '').trim();
          return selectedProductIds.has(productId);
        })
        : true;
      const projectSearchText = `${projName} ${customerSearchText} ${proj.project_code || ''} ${productSearchText}`;
      const matchesSearch = searchLower ? projectSearchText.includes(searchLower) : true;
      const matchesStatus = statusFilter ? proj.status === statusFilter : true;
      const matchesDepartment = departmentFilter
        ? String(proj.department_id ?? '') === departmentFilter
        : true;
      const projectStartDate = normalizeProjectDateFilterValue(proj.start_date);
      const matchesStartDateFrom = startDateFrom
        ? projectStartDate !== '' && projectStartDate >= startDateFrom
        : true;
      const matchesStartDateTo = startDateTo
        ? projectStartDate !== '' && projectStartDate <= startDateTo
        : true;

      return matchesCustomerSelection
        && matchesProjectSelection
        && matchesProductSelection
        && matchesSearch
        && matchesStatus
        && matchesDepartment
        && matchesStartDateFrom
        && matchesStartDateTo;
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
  }, [
    serverMode,
    projects,
    structuredSearchValue,
    searchTerm,
    statusFilter,
    departmentFilter,
    startDateFrom,
    startDateTo,
    sortConfig,
    customers,
    projectItemsByProjectId,
    projectItemsTotalByProjectId,
  ]);

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
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      if (serverMode) {
        setSearchTrigger((previous) => (previous === 0 ? 1 : previous));
      }
    }
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

  const commitProjectFilters = (overrides?: {
    startDatePreset?: DateRangePresetValue;
    startDateFrom?: string;
    startDateTo?: string;
  }) => {
    const nextStartDatePreset = overrides?.startDatePreset ?? pendingStartDatePreset;
    const nextStartDateFrom = overrides?.startDateFrom ?? pendingStartDateFrom;
    const nextStartDateTo = overrides?.startDateTo ?? pendingStartDateTo;

    setSearchTerm(pendingSearchTerm);
    setStructuredSearchValue({
      customerIds: [...pendingStructuredSearchValue.customerIds],
      projectIds: [...pendingStructuredSearchValue.projectIds],
      productIds: [...pendingStructuredSearchValue.productIds],
    });
    setStatusFilter(pendingStatusFilter);
    setDepartmentFilter(pendingDepartmentFilter);
    setStartDateFrom(nextStartDateFrom);
    setStartDateTo(nextStartDateTo);
    setStartDatePreset(nextStartDatePreset);
    setCurrentPage(1);
    setSearchTrigger((prev) => prev + 1);
  };

  const handleManualSearch = () => {
    commitProjectFilters();
  };

  const handleResetFilters = () => {
    const defaultDateFilters = getProjectsPageDefaultDateFilters();
    const defaultDatePreset = resolveProjectDatePresetValue(
      defaultDateFilters.start_date_from,
      defaultDateFilters.start_date_to
    );

    setPendingSearchTerm('');
    setPendingStructuredSearchValue(createEmptyCascadingEntitySearchValue());
    setPendingStatusFilter('');
    setPendingDepartmentFilter(initialDepartmentFilter);
    setPendingStartDatePreset(defaultDatePreset);
    setPendingStartDateFrom(defaultDateFilters.start_date_from);
    setPendingStartDateTo(defaultDateFilters.start_date_to);
    setSearchTerm('');
    setStructuredSearchValue(createEmptyCascadingEntitySearchValue());
    setStatusFilter('');
    setDepartmentFilter(initialDepartmentFilter);
    setStartDatePreset(defaultDatePreset);
    setStartDateFrom(defaultDateFilters.start_date_from);
    setStartDateTo(defaultDateFilters.start_date_to);
    setCurrentPage(1);
    setSearchTrigger((prev) => prev + 1);
  };

  const syncPendingNonSearchFiltersFromApplied = () => {
    setPendingStatusFilter(statusFilter);
    setPendingDepartmentFilter(departmentFilter);
    setPendingStartDatePreset(startDatePreset);
    setPendingStartDateFrom(startDateFrom);
    setPendingStartDateTo(startDateTo);
  };

  const handleOpenMobileFilterSheet = () => {
    syncPendingNonSearchFiltersFromApplied();
    setShowMobileHeaderActions(false);
    setShowImportMenu(false);
    setShowExportMenu(false);
    setShowMobileFilterSheet(true);
  };

  const handleCloseMobileFilterSheet = () => {
    syncPendingNonSearchFiltersFromApplied();
    setShowMobileFilterSheet(false);
  };

  const handleApplyMobileFilters = () => {
    commitProjectFilters();
    setShowMobileFilterSheet(false);
  };

  const handleResetMobileFilters = () => {
    handleResetFilters();
    setShowMobileFilterSheet(false);
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

  const defaultDateFilters = getProjectsPageDefaultDateFilters();
  const shouldShowDateReset = pendingStartDateFrom !== defaultDateFilters.start_date_from
    || pendingStartDateTo !== defaultDateFilters.start_date_to;
  const pendingAdvancedFilterCount = [
    pendingStatusFilter,
    pendingDepartmentFilter !== initialDepartmentFilter,
    pendingStartDateFrom !== defaultDateFilters.start_date_from
      || pendingStartDateTo !== defaultDateFilters.start_date_to,
  ].filter(Boolean).length;
  const hasCustomDateWindow = startDateFrom !== defaultDateFilters.start_date_from
    || startDateTo !== defaultDateFilters.start_date_to;
  const activeDepartmentLabel = departmentFilterOptions.find((option) => option.value === departmentFilter)?.label
    ?? 'Tất cả phòng ban';
  const activeStatusLabel = statusFilterOptions.find((option) => option.value === statusFilter)?.label
    ?? 'Tất cả trạng thái';
  const hasDepartmentFilterOverride = departmentFilter !== initialDepartmentFilter;
  const hasStructuredEntityFilter = hasCascadingEntitySelection(structuredSearchValue);
  const hasActiveFilters = Boolean(
    searchTerm
    || hasStructuredEntityFilter
    || statusFilter
    || hasDepartmentFilterOverride
    || hasCustomDateWindow
  );
  const activeDateRangeLabel = `${formatDateDdMmYyyy(startDateFrom)} → ${formatDateDdMmYyyy(startDateTo)}`;
  const mobileAppliedFilterCount = [
    statusFilter,
    hasDepartmentFilterOverride,
    hasCustomDateWindow,
  ].filter(Boolean).length;
  const mobileAppliedFilterChips = [
    statusFilter ? { key: 'status', label: 'Trạng thái', value: activeStatusLabel } : null,
    hasDepartmentFilterOverride ? { key: 'department', label: 'Phòng ban', value: activeDepartmentLabel } : null,
    hasCustomDateWindow ? { key: 'date', label: 'Ngày BĐ', value: activeDateRangeLabel } : null,
  ].filter((chip): chip is { key: string; label: string; value: string } => Boolean(chip?.value));
  const visibleProjectCount = currentData.length;

  return (
    <div className="space-y-2 px-3 pb-6 pt-1.5 md:p-3 md:pb-6">
      {isMobileProjectList ? (
        <div
          data-testid="project-mobile-filter-header"
          className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div
              className="flex min-w-0 items-start gap-2"
              title="Theo dõi danh mục, giá trị và tiến độ triển khai."
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary/15">
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>account_tree</span>
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold leading-tight text-deep-teal">Quản lý Dự án</h2>
                <p
                  data-testid="project-mobile-summary"
                  className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-semibold leading-4 text-slate-500"
                >
                  <span>{totalItems.toLocaleString('vi-VN')} dự án</span>
                  <span className="text-slate-300">•</span>
                  <span>Tổng {formatCurrencyVnd(overallProjectsDisplayTotal)}</span>
                </p>
              </div>
            </div>

            <div className="relative flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onOpenModal('ADD_PROJECT')}
                data-testid="project-mobile-add"
                aria-label="Thêm dự án"
                title="Thêm mới"
                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-primary bg-primary text-white shadow-sm transition-colors hover:bg-deep-teal focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
              </button>
              <button
                type="button"
                onClick={() => setShowMobileHeaderActions((previous) => !previous)}
                data-testid="project-mobile-header-actions-toggle"
                aria-label="Mở thao tác trang"
                aria-haspopup="menu"
                aria-expanded={showMobileHeaderActions}
                title="Thao tác trang"
                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                  {showMobileHeaderActions ? 'expand_less' : 'more_horiz'}
                </span>
              </button>

              {showMobileHeaderActions && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMobileHeaderActions(false)} />
                  <div
                    role="menu"
                    data-testid="project-mobile-header-actions-menu"
                    className="absolute right-0 top-full z-20 mt-1.5 w-52 overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-xl"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      disabled={isExporting}
                      onClick={() => {
                        setShowMobileHeaderActions(false);
                        void handleExport('excel');
                      }}
                      className="flex h-10 w-full items-center gap-2 rounded px-2 text-left text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 16 }}>table_view</span>
                      Xuất Excel
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={isExporting}
                      onClick={() => {
                        setShowMobileHeaderActions(false);
                        void handleExport('csv');
                      }}
                      className="flex h-10 w-full items-center gap-2 rounded px-2 text-left text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 16 }}>csv</span>
                      Xuất CSV
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={isExporting}
                      onClick={() => {
                        setShowMobileHeaderActions(false);
                        void handleExport('pdf');
                      }}
                      className="flex h-10 w-full items-center gap-2 rounded px-2 text-left text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 16 }}>picture_as_pdf</span>
                      Xuất PDF
                    </button>
                    {canImport ? (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowMobileHeaderActions(false);
                            onOpenModal('IMPORT_DATA');
                          }}
                          className="flex h-10 w-full items-center gap-2 rounded border-t border-slate-100 px-2 text-left text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-primary"
                        >
                          <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 16 }}>upload_file</span>
                          Nhập dữ liệu
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowMobileHeaderActions(false);
                            handleDownloadTemplate();
                          }}
                          className="flex h-10 w-full items-center gap-2 rounded px-2 text-left text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-primary"
                        >
                          <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 16 }}>download</span>
                          Tải file mẫu
                        </button>
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>

          <form
            role="search"
            data-testid="project-mobile-search-form"
            onSubmit={(event) => {
              event.preventDefault();
              handleManualSearch();
            }}
            className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2"
          >
            <div className="relative min-w-0">
              <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 17 }}>search</span>
              <input
                type="search"
                enterKeyHint="search"
                value={pendingSearchTerm}
                onChange={(e) => setPendingSearchTerm(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleManualSearch();
                  }
                }}
                placeholder="Tìm dự án, mã, khách hàng..."
                className="h-11 w-full min-w-0 rounded-md border border-slate-200 bg-slate-50 pl-9 pr-16 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
              {pendingSearchTerm && (
                <button
                  type="button"
                  onClick={() => setPendingSearchTerm('')}
                  className="absolute right-8 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  title="Xóa tìm kiếm"
                  aria-label="Xóa tìm kiếm"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
                </button>
              )}
              <button
                type="submit"
                data-testid="project-mobile-search-submit"
                className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10 focus:outline-none focus:ring-1 focus:ring-primary/30"
                title="Tìm kiếm"
                aria-label="Tìm kiếm"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>arrow_forward</span>
              </button>
            </div>
            <button
              type="button"
              onClick={handleOpenMobileFilterSheet}
              data-testid="project-mobile-open-filters"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-deep-teal transition-colors hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              aria-haspopup="dialog"
              aria-expanded={showMobileFilterSheet}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>tune</span>
              <span>Bộ lọc</span>
              {mobileAppliedFilterCount > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                  {mobileAppliedFilterCount}
                </span>
              ) : null}
            </button>
          </form>

          {mobileAppliedFilterChips.length > 0 && (
            <div
              data-testid="project-mobile-applied-filters"
              className="mt-2 flex flex-wrap items-center gap-1.5"
            >
              {mobileAppliedFilterChips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600"
                >
                  <span className="font-semibold text-slate-500">{chip.label}:</span>
                  <span className="truncate font-semibold text-deep-teal">{chip.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="flex items-center gap-2"
            title="Theo dõi danh mục, giá trị và tiến độ triển khai."
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-secondary/15">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>account_tree</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold leading-tight text-deep-teal">Quản lý Dự án</h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {canImport ? (
              <div className="relative">
                <button
                  onClick={() => { setShowImportMenu((prev) => !prev); setShowExportMenu(false); }}
                  className={`${headerActionButtonClassName} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
                >
                  <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>upload</span>
                  Nhập
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
                </button>
                {showImportMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowImportMenu(false)} />
                    <div className="absolute left-0 top-full z-20 mt-1.5 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                      <button
                        onClick={() => { setShowImportMenu(false); onOpenModal('IMPORT_DATA'); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary"
                      >
                        <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>upload_file</span>
                        Nhập dữ liệu
                      </button>
                      <button
                        onClick={handleDownloadTemplate}
                        className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary"
                      >
                        <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>download</span>
                        Tải file mẫu
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            <div className="relative">
              <button
                onClick={() => { setShowExportMenu((prev) => !prev); setShowImportMenu(false); }}
                disabled={isExporting}
                className={`${headerActionButtonClassName} border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>download</span>
                {isExporting ? 'Đang xuất...' : 'Xuất'}
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full z-20 mt-1.5 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                    <button onClick={() => void handleExport('excel')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary">
                      <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>table_view</span>
                      Excel
                    </button>
                    <button onClick={() => void handleExport('csv')} className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary">
                      <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>csv</span>
                      CSV
                    </button>
                    <button onClick={() => void handleExport('pdf')} className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary">
                      <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>picture_as_pdf</span>
                      PDF
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => onOpenModal('ADD_PROJECT')}
              title="Thêm dự án (Ctrl+N / ⌘N)"
              className={`${headerActionButtonClassName} border-primary bg-primary text-white shadow-sm hover:bg-deep-teal`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
              Thêm mới
            </button>
          </div>
        </div>
      )}

      <div className={shellCardClassName}>
        {!isMobileProjectList && (
        <>
        <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-2 sm:px-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {statusKpis.map((item) => {
              const isActive = statusFilter === item.status;

              return (
                <button
                  key={item.status}
                  type="button"
                  onClick={() => { setStatusFilter(isActive ? '' : item.status); setCurrentPage(1); }}
                  aria-label={`Lọc trạng thái ${item.label}`}
                  aria-pressed={isActive}
                  title={`Lọc trạng thái ${item.label}`}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-primary/30 ${
                    isActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-primary/30 hover:text-primary'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-primary' : 'bg-slate-300'}`} />
                  <span className="max-w-[118px] truncate">{item.label}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-b border-slate-200 bg-white px-3 py-2 sm:px-4">
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              handleManualSearch();
            }}
            className="space-y-2"
          >
            <CascadingEntitySearchFilter
              customers={customers}
              projects={projects}
              projectItems={projectItems}
              value={pendingStructuredSearchValue}
              onChange={setPendingStructuredSearchValue}
              textValue={pendingSearchTerm}
              onTextChange={setPendingSearchTerm}
              showSearchRow={false}
              selectionActions={(
                <button
                  type="button"
                  data-testid="project-advanced-filter-toggle"
                  onClick={() => setShowDesktopAdvancedFilters((current) => !current)}
                  aria-expanded={showDesktopAdvancedFilters}
                  aria-controls="project-desktop-advanced-filters"
                  className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary/30 lg:w-auto lg:whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>tune</span>
                  {showDesktopAdvancedFilters ? 'Thu gọn' : 'Xem chi tiết'}
                  {pendingAdvancedFilterCount > 0 ? (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                      {pendingAdvancedFilterCount}
                    </span>
                  ) : null}
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                    {showDesktopAdvancedFilters ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
              )}
            />

            {showDesktopAdvancedFilters ? (
              <div
                id="project-desktop-advanced-filters"
                data-testid="project-desktop-advanced-filters"
                className="space-y-2"
              >
                <div
                  data-testid="project-secondary-filter-row"
                  className="grid gap-2 lg:grid-cols-[minmax(260px,360px)_minmax(170px,220px)] lg:items-center"
                >
                  <SearchableSelect
                    className="w-full"
                    value={pendingDepartmentFilter}
                    onChange={(val) => {
                      hasUserAdjustedDepartmentFilterRef.current = true;
                      setPendingDepartmentFilter(val);
                    }}
                    options={departmentFilterOptions}
                    placeholder="Tất cả phòng ban"
                    portalMinWidth={340}
                    portalMaxWidth={420}
                    triggerClassName={`w-full ${denseToolbarSelectTriggerClassName}`}
                  />
                  <SearchableSelect
                    className="w-full"
                    value={pendingStatusFilter}
                    onChange={(val) => setPendingStatusFilter(val)}
                    options={statusFilterOptions}
                    placeholder="Tất cả trạng thái"
                    triggerClassName={`w-full ${denseToolbarSelectTriggerClassName}`}
                  />
                </div>
                <div
                  data-testid="project-date-filter-row"
                  className="flex min-w-0 items-start gap-1.5 overflow-visible rounded-md border border-slate-200 bg-slate-50/60 px-2 py-2"
                >
                  <DateRangePresetPicker
                    size="dense"
                    label="Ngày bắt đầu:"
                    containerClassName="min-w-0"
                    value={pendingStartDatePreset}
                    onPresetChange={(nextPreset) => {
                      setPendingStartDatePreset(nextPreset);
                      if (nextPreset === 'custom') {
                        return;
                      }
                      const nextRange = resolveDateRangePresetRange(
                        nextPreset,
                        pendingStartDateFrom,
                        pendingStartDateTo
                      );
                      setPendingStartDateFrom(nextRange.from);
                      setPendingStartDateTo(nextRange.to);
                      commitProjectFilters({
                        startDatePreset: nextPreset,
                        startDateFrom: nextRange.from,
                        startDateTo: nextRange.to,
                      });
                    }}
                    dateFrom={pendingStartDateFrom}
                    dateTo={pendingStartDateTo}
                    onDateFromChange={(value) => {
                      setPendingStartDatePreset('custom');
                      setPendingStartDateFrom(value);
                    }}
                    onDateToChange={(value) => {
                      setPendingStartDatePreset('custom');
                      setPendingStartDateTo(value);
                    }}
                    dateFromLabel="Từ ngày"
                    dateToLabel="Đến ngày"
                  />
                  {shouldShowDateReset && (
                    <button
                      type="button"
                      onClick={() => {
                        const defaultDatePreset = resolveProjectDatePresetValue(
                          defaultDateFilters.start_date_from,
                          defaultDateFilters.start_date_to
                        );
                        setPendingStartDatePreset(defaultDatePreset);
                        setPendingStartDateFrom(defaultDateFilters.start_date_from);
                        setPendingStartDateTo(defaultDateFilters.start_date_to);
                        commitProjectFilters({
                          startDatePreset: defaultDatePreset,
                          startDateFrom: defaultDateFilters.start_date_from,
                          startDateTo: defaultDateFilters.start_date_to,
                        });
                      }}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      title="Xóa lọc ngày"
                      aria-label="Xóa lọc ngày"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
                    </button>
                  )}
                </div>
              </div>
            ) : null}
            <div
              data-testid="project-structured-search-row"
              className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]"
            >
              <label className="relative min-w-0">
                <span className="sr-only">Tìm tự do trong phạm vi đã chọn</span>
                <span aria-hidden="true" className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" style={{ fontSize: 15 }}>
                  search
                </span>
                <input
                  ref={searchInputRef}
                  type="search"
                  enterKeyHint="search"
                  aria-label="Tìm tự do trong phạm vi đã chọn"
                  value={pendingSearchTerm}
                  onChange={(event) => setPendingSearchTerm(event.target.value)}
                  className="h-8 w-full rounded-md border border-slate-300 bg-white pl-8 pr-8 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary/70 focus:outline-none focus:ring-2 focus:ring-primary/25"
                  placeholder="Tìm tự do trong phạm vi đã chọn..."
                  title="Tìm kiếm trong phạm vi đã chọn (Enter)"
                />
                {pendingSearchTerm ? (
                  <button
                    type="button"
                    aria-label="Xóa nội dung tìm tự do"
                    onClick={() => setPendingSearchTerm('')}
                    className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/25"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
                  </button>
                ) : null}
              </label>
              <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center">
                <button
                  type="submit"
                  className={`${denseToolbarButtonClassName} w-full shrink-0 whitespace-nowrap border-primary bg-primary px-3 text-white hover:bg-deep-teal lg:min-w-[108px] lg:w-auto`}
                  title="Tìm kiếm (Enter)"
                  aria-label="Tìm kiếm dự án trong phạm vi đã chọn"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>search</span>
                  Tìm kiếm
                </button>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className={`${denseToolbarButtonClassName} w-full shrink-0 whitespace-nowrap border-slate-200 bg-white px-2.5 text-slate-700 hover:bg-slate-50 hover:text-primary lg:min-w-[96px] lg:w-auto`}
                  title="Làm mới / Xóa tất cả bộ lọc"
                  aria-label="Làm mới và xóa tất cả bộ lọc"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>refresh</span>
                  Làm mới
                </button>
              </div>
            </div>
          </form>
        </div>
        </>
        )}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="hidden flex-col gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 md:flex md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-deep-teal">Danh sách dự án</span>
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-inset ring-slate-200">
                {totalItems.toLocaleString('vi-VN')} dự án
              </span>
              {hasActiveFilters && (
                <span className="inline-flex items-center rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold text-secondary">
                  Đang lọc
                </span>
              )}
            </div>
            <div
              className="flex flex-col items-start gap-0.5 text-left sm:items-end sm:text-right"
              title={`Hiển thị ${visibleProjectCount} trên ${totalItems} dự án`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Tổng giá trị trong kỳ
              </span>
              <span
                data-testid="project-period-total-value"
                className="text-sm font-semibold text-deep-teal"
              >
                {formatCurrencyVnd(overallProjectsDisplayTotal)}
              </span>
            </div>
          </div>

          {!isMobileProjectList && (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1168px] table-fixed border-collapse text-left xl:min-w-[1300px]">
              <thead className="border-y border-slate-200 bg-slate-50">
                <tr>
                  {[
                    { label: 'Dự án', sortKey: 'project_name', widthClassName: 'w-[360px] xl:w-[380px]', responsiveClassName: '', headerClassName: '', headerContentClassName: '' },
                    { label: 'Khách hàng', sortKey: 'customer_id', widthClassName: 'w-[240px] xl:w-[248px]', responsiveClassName: 'hidden md:table-cell', headerClassName: '', headerContentClassName: '' },
                    { label: 'Ngày BĐ', sortKey: 'start_date', widthClassName: 'w-[96px]', responsiveClassName: '', headerClassName: '', headerContentClassName: '' },
                    { label: 'Ngày KT', sortKey: 'expected_end_date', widthClassName: 'w-[96px]', responsiveClassName: 'hidden xl:table-cell', headerClassName: '', headerContentClassName: '' },
                    { label: 'Thành tiền', sortKey: 'estimated_value', widthClassName: 'w-[148px]', responsiveClassName: '', headerClassName: 'text-right tabular-nums', headerContentClassName: 'justify-end' },
                    { label: 'Trạng thái', sortKey: 'status', widthClassName: 'w-[136px] xl:w-[144px]', responsiveClassName: '', headerClassName: '', headerContentClassName: '' },
                  ].map((col) => (
                    <th
                      key={col.label}
                      className={`select-none px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 transition-colors ${col.sortKey ? 'cursor-pointer hover:bg-slate-100' : ''} ${col.widthClassName} ${col.responsiveClassName} ${col.headerClassName}`}
                      onClick={col.sortKey ? () => handleSort(col.sortKey as keyof Project) : undefined}
                    >
                      <div className={`flex items-center gap-1 ${col.headerContentClassName}`}>
                        <span className="whitespace-nowrap text-deep-teal">{col.label}</span>
                        {col.sortKey ? renderSortIcon(col.sortKey as keyof Project) : null}
                      </div>
                    </th>
                  ))}
                  <th className="sticky right-0 w-[184px] min-w-[184px] whitespace-nowrap bg-slate-50/95 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 backdrop-blur">
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
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className={`${bodyCellClassName} font-semibold text-slate-900`} title={`${item.project_code || ''} ${displayProjectName}`.trim()}>
                          <div className="flex min-h-5 w-full flex-col justify-center gap-1">
                            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                              {item.project_code || 'N/A'}
                            </div>
                            <div className="whitespace-normal break-words leading-5">{displayProjectName}</div>
                            <div className="hidden flex-wrap items-center gap-1.5 text-[11px] font-normal text-slate-500 md:flex xl:hidden">
                              <span>KT: {formatDateDdMmYyyy(item.expected_end_date || '')}</span>
                            </div>
                          </div>
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
                        <td className={`${bodyCellClassName} whitespace-nowrap text-right font-semibold text-slate-900`}>
                          <div
                            data-testid={`project-amount-${item.id}`}
                            className={`${bodyCellContentClassName} justify-end whitespace-nowrap tabular-nums`}
                          >
                            {formatCurrencyVnd(getProjectItemsDisplayTotal(item))}
                          </div>
                        </td>
                        <td className={`${bodyCellClassName} overflow-hidden align-middle`}>
                          <div className={`${bodyCellContentClassName} max-w-full overflow-hidden`}>
                            <span
                              className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${getStatusColor(item.status)}`}
                              title={getStatusLabel(item.status)}
                            >
                              <span className="truncate whitespace-nowrap">{getStatusLabel(item.status)}</span>
                            </span>
                          </div>
                        </td>
                        <td className="sticky right-0 z-[1] w-[184px] min-w-[184px] bg-white/95 px-2 py-2 align-middle text-center shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)] backdrop-blur">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => onOpenModal('ADD_PROJECT', item)}
                              data-testid={`project-copy-${item.id}`}
                              className={`${tableActionButtonClassName} hover:text-primary`}
                              title="Sao chép dự án"
                              aria-label="Sao chép dự án"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>content_copy</span>
                            </button>
                            {onCreateContract && (
                              <button
                                onClick={() => onCreateContract(item)}
                                className={`${tableActionButtonClassName} hover:text-primary`}
                                title="Tạo hợp đồng"
                                aria-label="Tạo hợp đồng"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>description</span>
                              </button>
                            )}
                            {onOpenProcedure && (
                              <button
                                onClick={() => onOpenProcedure(item)}
                                data-testid={`project-open-procedure-${item.id}`}
                                className={`${tableActionButtonClassName} hover:text-deep-teal`}
                                title="Thủ tục dự án"
                                aria-label="Thủ tục dự án"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>checklist</span>
                              </button>
                            )}
                            <button
                              onClick={() => onOpenModal('EDIT_PROJECT', item)}
                              className={`${tableActionButtonClassName} hover:text-primary`}
                              title="Chỉnh sửa"
                              aria-label="Chỉnh sửa"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>edit</span>
                            </button>
                            <button
                              onClick={() => onOpenModal('DELETE_PROJECT', item)}
                              className={`${tableActionButtonClassName} hover:text-error`}
                              title="Xóa"
                              aria-label="Xóa"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8">
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                            {isLoading ? 'hourglass_top' : 'search_off'}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-deep-teal">
                          {isLoading ? 'Đang tải dữ liệu dự án...' : 'Không tìm thấy dự án phù hợp'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}

          {isMobileProjectList && (
          <div className="md:hidden" data-testid="project-mobile-list">
            {currentData.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {currentData.map((item) => {
                  const displayProjectName = getProjectDisplayName(item);
                  const displayCustomerName = getCustomerDisplayName(item.customer_id);
                  const amountLabel = formatCurrencyVnd(getProjectItemsDisplayTotal(item));
                  const isMobileActionMenuOpen = String(openMobileActionProjectId ?? '') === String(item.id);

                  return (
                    <div
                      key={item.id}
                      data-testid={`project-mobile-row-${item.id}`}
                      className={`px-3 py-3 transition-colors ${
                        String(selectedRowId) === String(item.id) ? 'bg-secondary/10' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                            {item.project_code || 'N/A'}
                          </div>
                          <div
                            className="mt-1 break-words text-sm font-semibold leading-5 text-slate-900"
                            title={`${item.project_code || ''} ${displayProjectName}`.trim()}
                          >
                            {displayProjectName}
                          </div>
                        </div>
                        <span
                          className={`inline-flex max-w-[116px] shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${getStatusColor(item.status)}`}
                          title={getStatusLabel(item.status)}
                        >
                          <span className="truncate whitespace-nowrap">{getStatusLabel(item.status)}</span>
                        </span>
                      </div>

                      <div className="mt-1.5 space-y-1 text-[11px] font-normal leading-4 text-slate-500">
                        <div className="break-words">KH: {displayCustomerName}</div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span>BĐ: {formatDateDdMmYyyy(item.start_date || '')}</span>
                          <span className="text-slate-300">•</span>
                          <span>KT: {formatDateDdMmYyyy(item.expected_end_date || '')}</span>
                        </div>
                      </div>

                      <div
                        data-testid={`project-mobile-action-footer-${item.id}`}
                        className="mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 max-[360px]:grid-cols-[auto_1fr]"
                      >
                        {onOpenProcedure && (
                          <button
                            type="button"
                            onClick={() => onOpenProcedure(item)}
                            data-testid={`project-mobile-open-procedure-${item.id}`}
                            className={mobilePrimaryActionButtonClassName}
                            aria-label={`Thủ tục dự án ${item.project_code || displayProjectName}`}
                            title="Thủ tục"
                          >
                            <span className={mobilePrimaryActionVisualClassName}>
                              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>checklist</span>
                              <span>Thủ tục</span>
                            </span>
                          </button>
                        )}
                        <span
                          data-testid={`project-mobile-amount-${item.id}`}
                          className={`${onOpenProcedure ? '' : 'col-span-2'} min-w-0 justify-self-end whitespace-nowrap text-right text-sm font-semibold tabular-nums text-slate-900 max-[360px]:order-first max-[360px]:col-span-2 max-[360px]:w-full`}
                          aria-label={`Thành tiền ${amountLabel}`}
                        >
                          {amountLabel}
                        </span>
                        <div className="flex shrink-0 items-center gap-1 justify-self-end rounded-md bg-transparent">
                          <button
                            type="button"
                            onClick={() => onOpenModal('EDIT_PROJECT', item)}
                            className={mobileIconActionButtonClassName}
                            aria-label={`Sửa dự án ${item.project_code || displayProjectName}`}
                            title="Sửa"
                          >
                            <span className={mobileIconActionVisualClassName}>
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMobileActionProjectId((previous) =>
                                String(previous ?? '') === String(item.id) ? null : item.id
                            )
                          }
                            className={mobileIconActionButtonClassName}
                            aria-expanded={isMobileActionMenuOpen}
                            aria-controls={`project-mobile-actions-${item.id}`}
                            aria-haspopup="menu"
                            aria-label={`Mở thêm thao tác cho dự án ${item.project_code || displayProjectName}`}
                            title="Thao tác khác"
                          >
                            <span className={`${mobileIconActionVisualClassName} ${isMobileActionMenuOpen ? 'bg-slate-50 text-primary shadow-sm' : ''}`}>
                              <span className="material-symbols-outlined" style={{ fontSize: 19 }}>
                                {isMobileActionMenuOpen ? 'expand_less' : 'more_horiz'}
                              </span>
                            </span>
                          </button>
                        </div>
                      </div>

                      {isMobileActionMenuOpen && (
                        <div
                          id={`project-mobile-actions-${item.id}`}
                          data-testid={`project-mobile-actions-menu-${item.id}`}
                          role="menu"
                          className="ml-auto mt-1 w-[220px] max-w-full rounded-md border border-slate-200 bg-white p-1 shadow-sm"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setOpenMobileActionProjectId(null);
                              onOpenModal('ADD_PROJECT', item);
                            }}
                            data-testid={`project-mobile-copy-${item.id}`}
                            className={mobileMenuItemButtonClassName}
                          >
                            <span className="material-symbols-outlined shrink-0 text-slate-500 transition-colors group-hover:text-current" style={{ fontSize: 16 }}>content_copy</span>
                            <span>Sao chép</span>
                          </button>
                          {onCreateContract && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMobileActionProjectId(null);
                                onCreateContract(item);
                              }}
                              className={mobileMenuItemButtonClassName}
                            >
                              <span className="material-symbols-outlined shrink-0 text-slate-500 transition-colors group-hover:text-current" style={{ fontSize: 16 }}>description</span>
                              <span>Tạo HĐ</span>
                            </button>
                          )}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setOpenMobileActionProjectId(null);
                              onOpenModal('DELETE_PROJECT', item);
                            }}
                            className={mobileMenuDangerItemButtonClassName}
                          >
                            <span className="material-symbols-outlined shrink-0 text-slate-500 transition-colors group-hover:text-current" style={{ fontSize: 16 }}>delete</span>
                            <span>Xóa</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-8">
                <div className="flex flex-col items-center justify-center gap-2 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                      {isLoading ? 'hourglass_top' : 'search_off'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-deep-teal">
                    {isLoading ? 'Đang tải dữ liệu dự án...' : 'Không tìm thấy dự án phù hợp'}
                  </p>
                </div>
              </div>
            )}
          </div>
          )}

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

      {showMobileFilterSheet && typeof document !== 'undefined'
        ? createPortal(
          <ModalWrapper
            onClose={handleCloseMobileFilterSheet}
            title="Bộ lọc"
            icon="tune"
            containerClassName="fixed inset-0 ui-layer-modal flex h-[100dvh] min-h-[100dvh] items-end justify-center overflow-hidden overscroll-none bg-[var(--ui-modal-backdrop)] p-0 sm:items-center sm:p-4"
            backdropClassName="bg-transparent"
            width="max-w-lg"
            heightClass="h-[82dvh] sm:h-auto"
            maxHeightClass="max-h-[calc(100dvh-8px)] sm:max-h-[90vh]"
            panelClassName="rounded-t-[20px] sm:rounded-2xl"
            headerClassName="px-4 py-3"
            contentClassName="flex-1 overflow-y-auto bg-white custom-scrollbar"
            headerAside={(
              <>
                {mobileAppliedFilterCount > 0 ? (
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-[10px] font-bold text-white">
                    {mobileAppliedFilterCount}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={handleResetMobileFilters}
                  className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                >
                  Đặt lại
                </button>
              </>
            )}
          >
            <div
              data-testid="project-mobile-filter-sheet"
              className="space-y-4 p-4 pb-3"
            >
              <section className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">
                  Phòng ban
                </label>
                <SearchableSelect
                  className="w-full"
                  value={pendingDepartmentFilter}
                  onChange={(val) => {
                    hasUserAdjustedDepartmentFilterRef.current = true;
                    setPendingDepartmentFilter(val);
                  }}
                  options={departmentFilterOptions}
                  placeholder="Tất cả phòng ban"
                  portalMinWidth={320}
                  portalMaxWidth={420}
                  triggerClassName="w-full !h-11 !rounded-md !border-slate-200 !bg-slate-50 !text-sm !text-slate-700"
                />
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-600">Trạng thái</span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {pendingStatusFilter ? 'Đang chọn 1' : 'Tất cả'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {statusKpis.map((item) => {
                    const isPendingActive = pendingStatusFilter === item.status;

                    return (
                      <button
                        key={item.status}
                        type="button"
                        onClick={() => setPendingStatusFilter(isPendingActive ? '' : item.status)}
                        aria-label={`Lọc trạng thái ${item.label}`}
                        aria-pressed={isPendingActive}
                        className={`inline-flex h-11 min-w-0 items-center justify-between gap-2 rounded-md border px-2 text-left text-xs font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-primary/30 ${
                          isPendingActive
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-primary/30 hover:text-primary'
                        }`}
                      >
                        <span className="min-w-0 truncate">{item.label}</span>
                        <span className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                          isPendingActive ? 'bg-primary text-white' : 'bg-white text-slate-500 ring-1 ring-inset ring-slate-200'
                        }`}>
                          {item.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-2">
                <span className="text-xs font-semibold text-slate-600">Ngày bắt đầu</span>
                <DateRangePresetPicker
                  size="default"
                  value={pendingStartDatePreset}
                  onPresetChange={(nextPreset) => {
                    setPendingStartDatePreset(nextPreset);
                    if (nextPreset === 'custom') {
                      return;
                    }
                    const nextRange = resolveDateRangePresetRange(
                      nextPreset,
                      pendingStartDateFrom,
                      pendingStartDateTo
                    );
                    setPendingStartDateFrom(nextRange.from);
                    setPendingStartDateTo(nextRange.to);
                  }}
                  dateFrom={pendingStartDateFrom}
                  dateTo={pendingStartDateTo}
                  onDateFromChange={(value) => {
                    setPendingStartDatePreset('custom');
                    setPendingStartDateFrom(value);
                  }}
                  onDateToChange={(value) => {
                    setPendingStartDatePreset('custom');
                    setPendingStartDateTo(value);
                  }}
                  dateFromLabel="Từ ngày"
                  dateToLabel="Đến ngày"
                />
              </section>
            </div>

            <div className="sticky bottom-0 flex gap-2 border-t border-slate-200 bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
              <button
                type="button"
                onClick={handleCloseMobileFilterSheet}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleApplyMobileFilters}
                className="inline-flex h-11 flex-[1.4] items-center justify-center rounded-md border border-primary bg-primary px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-deep-teal focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                Áp dụng
              </button>
            </div>
          </ModalWrapper>,
          document.body
        )
        : null}
    </div>
  );
};
