import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Contract,
  ContractAggregateKpis,
  Customer,
  Department,
  ModalType,
  PaginatedQuery,
  PaginationMeta,
  PaymentCycle,
  Project,
} from '../types';
import { CONTRACT_STATUSES } from '../constants';
import { useEscKey } from '../hooks/useEscKey';
import { useModuleShortcuts } from '../hooks/useModuleShortcuts';
import { useAuthStore, useContractStore } from '../shared/stores';
import { useFilterStore } from '../shared/stores/filterStore';
import { hasPermission } from '../utils/authorization';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect } from './SearchableSelect';
import { exportCsv, exportExcel, exportPdfTable, isoDateStamp } from '../utils/exportUtils';
import { ContractRevenueView } from './contract-revenue/ContractRevenueView';
import { fetchContractDetail } from '../services/api/contractApi';
import { formatVietnameseCurrencyValue } from '../utils/vietnameseCurrency';
import {
  DateRangePresetPicker,
  getDefaultCustomDateRange,
  resolveDateRangePresetLabel,
  resolveDateRangePresetRange,
  type DateRangePresetValue,
} from './DateRangePresetPicker';

type ContractViewMode = 'CONTRACTS' | 'REVENUE';
type ContractSourceMode = 'PROJECT' | 'INITIAL';
type ContractContextMenuState = {
  item: Contract;
  x: number;
  y: number;
};

const CONTRACT_VIEW_TITLES: Record<ContractViewMode, string> = {
  CONTRACTS: 'Hợp đồng',
  REVENUE: 'Doanh thu theo Hợp đồng',
};

const resolveContractSourceMode = (contract: Partial<Contract>): ContractSourceMode =>
  String(contract.project_id ?? '').trim() !== '' ? 'PROJECT' : 'INITIAL';

const matchesContractSourceMode = (
  contract: Partial<Contract>,
  sourceMode?: ContractSourceMode
): boolean => !sourceMode || resolveContractSourceMode(contract) === sourceMode;

interface ContractListQuery extends PaginatedQuery {
  filters?: {
    dept_id?: string;
    status?: string;
    type?: string;
    sign_date_from?: string;
    sign_date_to?: string;
    source_mode?: ContractSourceMode;
  };
}

interface ContractListProps {
  contracts?: Contract[];
  contractsPageRows?: Contract[];
  paginationMeta?: PaginationMeta;
  isLoading?: boolean;
  departments?: Department[];
  projects: Project[];
  customers: Customer[];
  onOpenModal: (type: ModalType, item?: Contract) => void;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onQueryChange?: (query: ContractListQuery) => void;
  onExportContracts?: () => Promise<Contract[]>;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
  aggregateKpis?: ContractAggregateKpis;
  fixedSourceMode?: ContractSourceMode;
}

const SEARCH_DEBOUNCE_MS = 150;
const STATUS_ICON_MAP: Record<string, string> = {
  DRAFT: 'edit_note',
  SIGNED: 'verified',
  RENEWED: 'autorenew',
};

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
};

const resolveContractValue = (contract: Contract): number => {
  const numeric = Number(contract.value ?? contract.total_value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const ContractList: React.FC<ContractListProps> = ({
  contracts: contractsProp,
  contractsPageRows: contractsPageRowsProp,
  paginationMeta,
  isLoading,
  departments = [],
  projects = [],
  customers = [],
  onOpenModal,
  canAdd = true,
  canEdit = false,
  canDelete = false,
  onQueryChange,
  onExportContracts,
  onNotify,
  aggregateKpis,
  fixedSourceMode,
}: ContractListProps) => {
  const authUser = useAuthStore((state) => state.user);
  const storeContracts = useContractStore((state) => state.contracts);
  const storeContractsPageRows = useContractStore((state) => state.contractsPageRows);
  const storeContractsPageMeta = useContractStore((state) => state.contractsPageMeta);
  const storeIsContractsPageLoading = useContractStore((state) => state.isContractsPageLoading);
  const storeHandleContractsPageQueryChange = useContractStore((state) => state.handleContractsPageQueryChange);
  const storeExportContractsByCurrentQuery = useContractStore((state) => state.exportContractsByCurrentQuery);
  const contracts = contractsProp ?? storeContracts;
  const contractsPageRows = contractsPageRowsProp ?? storeContractsPageRows;
  const contractsPageMeta = paginationMeta ?? storeContractsPageMeta;
  const isContractsPageLoading = isLoading ?? storeIsContractsPageLoading;
  const handleContractsPageQueryChange = onQueryChange ?? storeHandleContractsPageQueryChange;
  const exportContractsByCurrentQuery = onExportContracts ?? storeExportContractsByCurrentQuery;
  const serverMode = Boolean(contractsPageMeta);
  const filterTabKey = fixedSourceMode === 'INITIAL' ? 'passContractsPage' : 'contractsPage';
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | 'STANDALONE' | 'ADDENDUM'>('');
  const [viewMode, setViewMode] = useState<ContractViewMode>('CONTRACTS');
  const defaultCustomDateRange = useMemo(() => getDefaultCustomDateRange(), []);
  const [periodPreset, setPeriodPreset] = useState<DateRangePresetValue>('this_year');
  const [customDateFrom, setCustomDateFrom] = useState(defaultCustomDateRange.from);
  const [customDateTo, setCustomDateTo] = useState(defaultCustomDateRange.to);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Contract; direction: 'asc' | 'desc' } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContractContextMenuState | null>(null);
  const [detailDrawerContractId, setDetailDrawerContractId] = useState<string | number | null>(null);
  const [detailDrawerData, setDetailDrawerData] = useState<Contract | null>(null);
  const [isDetailDrawerLoading, setIsDetailDrawerLoading] = useState(false);
  const [detailCache, setDetailCache] = useState<Record<string, Contract>>({});

  useEscKey(() => setShowExportMenu(false), showExportMenu);
  useEscKey(() => setContextMenu(null), Boolean(contextMenu));
  useEscKey(() => {
    setDetailDrawerContractId(null);
    setDetailDrawerData(null);
  }, detailDrawerContractId !== null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | number | null>(null);
  const detailRequestVersionRef = useRef(0);
  const hasUserAdjustedDepartmentFilterRef = useRef(false);

  useModuleShortcuts({
    onNew: () => onOpenModal('ADD_CONTRACT'),
    onUpdate: () => {
      if (selectedRowId) {
        const item = (contracts ?? contractsPageRows ?? []).find((c) => String(c.id) === String(selectedRowId));
        if (item) onOpenModal('EDIT_CONTRACT', item);
      }
    },
    onDelete: () => {
      if (selectedRowId) {
        const item = (contracts ?? contractsPageRows ?? []).find((c) => String(c.id) === String(selectedRowId));
        if (item) onOpenModal('DELETE_CONTRACT', item);
      }
    },
    onFocusSearch: () => searchInputRef.current?.focus(),
  });

  const showActionColumn = canEdit || canDelete;
  const showProjectColumn = fixedSourceMode !== 'PROJECT';
  const denseFilterTriggerClassName = 'h-8 rounded-md border-slate-200 bg-slate-50 text-sm focus:border-primary';
  const tableColSpan = 6 + (showActionColumn ? 1 : 0);
  const sourceColumnLabel = fixedSourceMode === 'INITIAL' ? 'Nguồn' : 'Dự án';
  const contractTitle = fixedSourceMode === 'PROJECT'
    ? 'Hợp đồng theo dự án'
    : fixedSourceMode === 'INITIAL'
      ? 'Hợp đồng đầu kỳ'
      : CONTRACT_VIEW_TITLES.CONTRACTS;
  const revenueTitle = fixedSourceMode === 'PROJECT'
    ? 'Doanh thu HĐ theo dự án'
    : fixedSourceMode === 'INITIAL'
      ? 'Doanh thu HĐ đầu kỳ'
      : CONTRACT_VIEW_TITLES.REVENUE;
  const currentPageTitle = viewMode === 'CONTRACTS' ? contractTitle : revenueTitle;
  const pageDescription = fixedSourceMode === 'PROJECT'
    ? 'Quản lý hợp đồng gắn dự án và theo dõi doanh thu dự kiến, thực thu theo nguồn dự án.'
    : fixedSourceMode === 'INITIAL'
      ? 'Quản lý hợp đồng đầu kỳ tách riêng khỏi dự án để theo dõi doanh thu độc lập.'
      : 'Quản lý hợp đồng, theo dõi doanh thu dự kiến và thực thu.';
  const addButtonLabel = fixedSourceMode === 'INITIAL' ? 'Thêm HĐ đầu kỳ' : 'Thêm mới';
  const emptyStateTitle = fixedSourceMode === 'INITIAL' ? 'Chưa có hợp đồng đầu kỳ nào.' : 'Chưa có hợp đồng nào.';
  const emptyStateHint = fixedSourceMode === 'INITIAL'
    ? 'Bắt đầu bằng cách thêm mới hợp đồng đầu kỳ đầu tiên.'
    : 'Bắt đầu bằng cách thêm mới hợp đồng đầu tiên.';
  const contractDepartmentOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả đơn vị ký' },
      ...[...departments]
        .sort((left, right) =>
          `${left.dept_code || ''} ${left.dept_name || ''}`.localeCompare(
            `${right.dept_code || ''} ${right.dept_name || ''}`,
            'vi'
          )
        )
        .map((department) => ({
          value: String(department.id),
          label: department.dept_name || department.dept_code || `Đơn vị #${department.id}`,
          searchText: `${department.dept_code || ''} ${department.dept_name || ''}`.trim(),
        })),
    ],
    [departments]
  );
  const initialDepartmentFilter = useMemo(() => {
    const availableDepartmentIds = new Set(
      contractDepartmentOptions.map((option) => String(option.value)).filter((value) => value !== '')
    );
    const storedQuery = useFilterStore.getState().getTabFilter(filterTabKey) as ContractListQuery;
    const storedDepartmentId = String(storedQuery.filters?.dept_id ?? '').trim();
    if (storedDepartmentId && availableDepartmentIds.has(storedDepartmentId)) {
      return storedDepartmentId;
    }

    const authDepartmentId = String(authUser?.department_id ?? '').trim();
    return authDepartmentId && availableDepartmentIds.has(authDepartmentId) ? authDepartmentId : '';
  }, [authUser, contractDepartmentOptions, filterTabKey]);
  const normalizedInitialDepartmentFilter = String(initialDepartmentFilter || '').trim();
  const normalizedDepartmentFilter = String(departmentFilter || '').trim();
  const hasActiveFilter =
    searchInput.trim() !== '' ||
    normalizedDepartmentFilter !== normalizedInitialDepartmentFilter ||
    statusFilter !== '' ||
    typeFilter !== '' ||
    (periodPreset === 'custom' && (customDateFrom !== '' || customDateTo !== ''));
  const tableColumns: Array<{ label: string; key: keyof Contract; align?: 'left' | 'right' }> = [
    { label: 'Hợp đồng', key: 'contract_code' },
    { label: showProjectColumn ? 'Khách hàng / dự án' : 'Khách hàng', key: 'customer_id' },
    { label: 'Chu kỳ', key: 'payment_cycle' },
    { label: 'Giá trị', key: 'value', align: 'right' },
    { label: 'Thời hạn', key: 'effective_date' },
    { label: 'Trạng thái', key: 'status' },
  ];

  const resolvedPeriodRange = resolveDateRangePresetRange(periodPreset, customDateFrom, customDateTo);
  const dateFrom = resolvedPeriodRange.from || null;
  const dateTo = resolvedPeriodRange.to || null;
  const periodLabel = resolveDateRangePresetLabel(periodPreset, customDateFrom, customDateTo);

  const getProjectName = (id: string | number | null | undefined) => {
    const normalizedId = String(id ?? '').trim();
    if (!normalizedId) {
      return fixedSourceMode === 'INITIAL' ? 'Hợp đồng đầu kỳ' : 'Chưa gắn dự án';
    }
    const project = (projects || []).find((item) => String(item.id) === String(id));
    return project ? `${project.project_code} - ${project.project_name}` : normalizedId;
  };

  const getCustomerName = (id: string | number | null | undefined) => {
    const normalizedId = String(id ?? '').trim();
    if (!normalizedId) {
      return '--';
    }
    const customer = (customers || []).find((item) => String(item.id) === String(id));
    return customer ? `${customer.customer_code} - ${customer.customer_name}` : normalizedId;
  };

  const getStatusLabel = (status: string) => CONTRACT_STATUSES.find((item) => item.value === status)?.label || status;
  const getStatusColor = (status: string) =>
    CONTRACT_STATUSES.find((item) => item.value === status)?.color || 'bg-slate-100 text-slate-700';
  const getStatusIcon = (status: string) => STATUS_ICON_MAP[String(status).toUpperCase()] || 'description';

  const getPaymentCycleLabel = (cycle: PaymentCycle | string | undefined) => {
    const normalized = String(cycle || 'ONCE').toUpperCase();
    if (normalized === 'MONTHLY') return 'Hàng tháng';
    if (normalized === 'QUARTERLY') return 'Hàng quý';
    if (normalized === 'HALF_YEARLY') return '6 tháng/lần';
    if (normalized === 'YEARLY') return 'Hàng năm';
    return 'Một lần';
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0);
  const formatCurrencyLabel = (value: number) => formatVietnameseCurrencyValue(value, { fallback: '0 đ' });

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return value;
    return new Intl.DateTimeFormat('vi-VN').format(new Date(timestamp));
  };

  const filteredContracts = useMemo(() => {
    if (serverMode) {
      return contracts || [];
    }

    const searchLower = debouncedSearchTerm.trim().toLowerCase();
    let result = (contracts || [])
      .filter((contract) => matchesContractSourceMode(contract, fixedSourceMode))
      .filter((contract) => {
        const projectName = getProjectName(contract.project_id).toLowerCase();
        const customerName = getCustomerName(contract.customer_id).toLowerCase();
        const contractCode = String(contract.contract_code || '').toLowerCase();
        const contractName = String(contract.contract_name || '').toLowerCase();
        const paymentCycle = getPaymentCycleLabel(contract.payment_cycle).toLowerCase();

        const matchesSearch =
          searchLower === '' ||
          contractCode.includes(searchLower) ||
          contractName.includes(searchLower) ||
          customerName.includes(searchLower) ||
          projectName.includes(searchLower) ||
          paymentCycle.includes(searchLower);
        const matchesDepartment = normalizedDepartmentFilter
          ? String(contract.dept_id ?? '').trim() === normalizedDepartmentFilter
          : true;
        const matchesStatus = statusFilter ? contract.status === statusFilter : true;
        const matchesType =
          typeFilter === ''
            ? true
            : typeFilter === 'ADDENDUM'
              ? contract.parent_contract_id != null
              : contract.parent_contract_id == null;

        return matchesSearch && matchesDepartment && matchesStatus && matchesType;
      });

    if (sortConfig !== null) {
      result = [...result].sort((left, right) => {
        let leftValue: string | number | boolean | null | undefined = left[sortConfig.key] as
          | string
          | number
          | boolean
          | null
          | undefined;
        let rightValue: string | number | boolean | null | undefined = right[sortConfig.key] as
          | string
          | number
          | boolean
          | null
          | undefined;

        if (sortConfig.key === 'project_id') {
          leftValue = getProjectName(left.project_id);
          rightValue = getProjectName(right.project_id);
        } else if (sortConfig.key === 'customer_id') {
          leftValue = getCustomerName(left.customer_id);
          rightValue = getCustomerName(right.customer_id);
        } else if (sortConfig.key === 'payment_cycle') {
          leftValue = getPaymentCycleLabel(left.payment_cycle);
          rightValue = getPaymentCycleLabel(right.payment_cycle);
        } else if (sortConfig.key === 'status') {
          leftValue = getStatusLabel(left.status);
          rightValue = getStatusLabel(right.status);
        } else if (sortConfig.key === 'value') {
          leftValue = resolveContractValue(left);
          rightValue = resolveContractValue(right);
        }

        if (leftValue === null || leftValue === undefined) leftValue = '';
        if (rightValue === null || rightValue === undefined) rightValue = '';

        if (typeof leftValue === 'string' && typeof rightValue === 'string') {
          return sortConfig.direction === 'asc'
            ? leftValue.localeCompare(rightValue, 'vi')
            : rightValue.localeCompare(leftValue, 'vi');
        }

        if (leftValue < rightValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (leftValue > rightValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [serverMode, contracts, debouncedSearchTerm, normalizedDepartmentFilter, statusFilter, sortConfig, projects, customers, typeFilter, fixedSourceMode]);

  const statusFilterOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả trạng thái' },
      ...CONTRACT_STATUSES.map((status) => ({ value: status.value, label: status.label })),
    ],
    []
  );

  const totalItems = serverMode ? (contractsPageMeta?.total || 0) : filteredContracts.length;
  const totalPages = serverMode
    ? Math.max(1, contractsPageMeta?.total_pages || 1)
    : Math.max(1, Math.ceil(totalItems / rowsPerPage));

  const totalContractsKpi = (() => {
    const value = Number(contractsPageMeta?.kpis?.total_contracts);
    if (Number.isFinite(value) && value >= 0) return Math.floor(value);
    return totalItems;
  })();

  const expiringSoonContractsKpi = (() => {
    const value = Number(contractsPageMeta?.kpis?.expiring_soon);
    if (Number.isFinite(value) && value >= 0) return Math.floor(value);
    return 0;
  })();

  const draftCount = aggregateKpis?.draftCount ?? (contracts || []).filter((contract) => contract.status === 'DRAFT').length;
  const renewedCount = aggregateKpis?.renewedCount ?? (contracts || []).filter((contract) => contract.status === 'RENEWED').length;
  const collectionRate = clampPercent(aggregateKpis?.collectionRate ?? 0);
  const newSignedCount = aggregateKpis?.newSignedCount ?? 0;
  const newSignedValue = aggregateKpis?.newSignedValue ?? 0;
  const actualCollectedValue = aggregateKpis?.actualCollectedValue ?? 0;
  const overduePaymentAmount = aggregateKpis?.overduePaymentAmount ?? 0;
  const signPeriodTotalValue = (() => {
    if (serverMode) {
      const value = Number(contractsPageMeta?.kpis?.sign_period_total_value);
      return Number.isFinite(value) && value >= 0 ? value : 0;
    }

    return (contracts || [])
      .filter((contract) => matchesContractSourceMode(contract, fixedSourceMode))
      .filter((contract) => {
        const projectName = getProjectName(contract.project_id).toLowerCase();
        const customerName = getCustomerName(contract.customer_id).toLowerCase();
        const contractCode = String(contract.contract_code || '').toLowerCase();
        const contractName = String(contract.contract_name || '').toLowerCase();
        const paymentCycle = getPaymentCycleLabel(contract.payment_cycle).toLowerCase();
        const signDate = String(contract.sign_date || '').slice(0, 10);

        const matchesSearch =
          debouncedSearchTerm.trim() === '' ||
          contractCode.includes(debouncedSearchTerm.trim().toLowerCase()) ||
          contractName.includes(debouncedSearchTerm.trim().toLowerCase()) ||
          customerName.includes(debouncedSearchTerm.trim().toLowerCase()) ||
          projectName.includes(debouncedSearchTerm.trim().toLowerCase()) ||
          paymentCycle.includes(debouncedSearchTerm.trim().toLowerCase());
        const matchesDepartment = normalizedDepartmentFilter
          ? String(contract.dept_id ?? '').trim() === normalizedDepartmentFilter
          : true;
        const matchesStatus = statusFilter ? contract.status === statusFilter : true;
        const matchesType =
          typeFilter === ''
            ? true
            : typeFilter === 'ADDENDUM'
              ? contract.parent_contract_id != null
              : contract.parent_contract_id == null;
        const matchesDateFrom = !dateFrom || (signDate !== '' && signDate >= dateFrom);
        const matchesDateTo = !dateTo || (signDate !== '' && signDate <= dateTo);

        return matchesSearch && matchesDepartment && matchesStatus && matchesType && matchesDateFrom && matchesDateTo;
      })
      .reduce((sum, contract) => sum + resolveContractValue(contract), 0);
  })();

  useEffect(() => {
    if (hasUserAdjustedDepartmentFilterRef.current) {
      return;
    }

    setDepartmentFilter((currentValue) => {
      const normalizedCurrent = String(currentValue || '').trim();
      if (normalizedCurrent === normalizedInitialDepartmentFilter) {
        return currentValue;
      }
      if (normalizedCurrent !== '' && normalizedCurrent !== normalizedInitialDepartmentFilter) {
        return currentValue;
      }
      return normalizedInitialDepartmentFilter;
    });
  }, [normalizedInitialDepartmentFilter]);

  useEffect(() => {
    if (searchInput === debouncedSearchTerm) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchInput);
      setCurrentPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [searchInput, debouncedSearchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [normalizedDepartmentFilter, statusFilter, typeFilter, periodPreset, customDateFrom, customDateTo]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (viewMode !== 'CONTRACTS' || !serverMode) {
      return;
    }

    void handleContractsPageQueryChange({
      page: currentPage,
      per_page: rowsPerPage,
      q: debouncedSearchTerm.trim(),
      sort_by: sortConfig?.key ? String(sortConfig.key) : 'id',
      sort_dir: sortConfig?.direction || 'desc',
      filters: {
        source_mode: fixedSourceMode,
        dept_id: normalizedDepartmentFilter || undefined,
        status: statusFilter,
        type: typeFilter || undefined,
        sign_date_from: dateFrom ?? undefined,
        sign_date_to: dateTo ?? undefined,
      },
    });
  }, [viewMode, serverMode, handleContractsPageQueryChange, currentPage, rowsPerPage, debouncedSearchTerm, normalizedDepartmentFilter, statusFilter, typeFilter, sortConfig, dateFrom, dateTo, fixedSourceMode]);

  const currentData = serverMode
    ? (contractsPageRows || [])
    : filteredContracts.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const isEmptyData = !isContractsPageLoading && totalContractsKpi === 0 && !hasActiveFilter;
  const isFilterNoMatch = !isContractsPageLoading && !isEmptyData && currentData.length === 0;

  const resetFilters = () => {
    hasUserAdjustedDepartmentFilterRef.current = false;
    setSearchInput('');
    setDebouncedSearchTerm('');
    setDepartmentFilter(normalizedInitialDepartmentFilter);
    setStatusFilter('');
    setTypeFilter('');
    setCurrentPage(1);
    setPeriodPreset('this_year');
    setCustomDateFrom(defaultCustomDateRange.from);
    setCustomDateTo(defaultCustomDateRange.to);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleSort = (key: keyof Contract) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const renderSortIcon = (key: keyof Contract) => {
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

  const handleExport = async (type: 'excel' | 'csv' | 'pdf') => {
    setShowExportMenu(false);
    setIsExporting(true);

    try {
      if (serverMode && !hasPermission(authUser, 'contracts.read')) {
        throw new Error('Bạn không có quyền xuất dữ liệu hợp đồng.');
      }

      const dataToExport = serverMode
        ? await exportContractsByCurrentQuery()
        : filteredContracts;
      const headers = [
        'Mã HĐ',
        'Tên HĐ',
        'Khách hàng',
        sourceColumnLabel,
        'Chu kỳ',
        'Giá trị HĐ',
        'Ngày hiệu lực',
        'Ngày hết hạn',
        'Trạng thái',
      ];
      const rows = dataToExport.map((item) => [
        item.contract_code,
        item.contract_name,
        getCustomerName(item.customer_id),
        getProjectName(item.project_id),
        getPaymentCycleLabel(item.payment_cycle),
        formatCurrency(resolveContractValue(item)),
        formatDate(item.effective_date || null),
        formatDate(item.expiry_date || null),
        getStatusLabel(item.status),
      ]);
      const fileName = `HopDong_${isoDateStamp()}`;

      if (type === 'excel') {
        exportExcel(fileName, 'HopDong', headers, rows);
        return;
      }

      if (type === 'csv') {
        exportCsv(fileName, headers, rows);
        return;
      }

      const canPrint = exportPdfTable({
        fileName,
        title: currentPageTitle,
        headers,
        rows,
        subtitle: `Ngày xuất: ${new Date().toLocaleString('vi-VN')}`,
        landscape: true,
      });

      if (!canPrint) {
        onNotify?.('error', 'Xuất PDF', 'Trình duyệt đang chặn popup. Vui lòng cho phép popup để xuất PDF.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể xuất danh sách hợp đồng.';
      onNotify?.('error', 'Xuất dữ liệu thất bại', message);
    } finally {
      setIsExporting(false);
    }
  };

  const renderLoadingKpis = () => (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={`contract-kpi-skel-${index}`} className="h-7 w-28 rounded-md bg-slate-200 animate-pulse" />
      ))}
    </div>
  );

  const renderLoadingRows = () =>
    Array.from({ length: 8 }).map((_, index) => (
      <tr key={`contract-skeleton-${index}`}>
        {Array.from({ length: tableColSpan }).map((__, cellIndex) => (
          <td key={`contract-skeleton-${index}-${cellIndex}`} className="px-3 py-2">
            <div className={`h-3.5 rounded bg-slate-200 animate-pulse ${
              cellIndex === 0
                ? 'w-40'
                : cellIndex === 1
                  ? 'w-36'
                  : cellIndex === tableColSpan - 1 && showActionColumn
                    ? 'ml-auto w-12'
                    : 'w-20'
            }`} />
          </td>
        ))}
      </tr>
    ));

  return (
    <div className="p-3 pb-6">
      <div className="mb-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-secondary/15">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>description</span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="text-sm font-bold leading-tight text-deep-teal">{currentPageTitle}</h2>
                {viewMode === 'CONTRACTS' && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {totalItems.toLocaleString('vi-VN')} HĐ
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] leading-tight text-slate-400">{pageDescription}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('CONTRACTS')}
                className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                  viewMode === 'CONTRACTS' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>description</span>
                Hợp đồng
              </button>
              <button
                type="button"
                onClick={() => setViewMode('REVENUE')}
                className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                  viewMode === 'REVENUE' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>bar_chart</span>
                Doanh thu
              </button>
            </div>

            {viewMode === 'CONTRACTS' && (
              <>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowExportMenu((current) => !current)}
                    disabled={isExporting}
                    className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>
                      {isExporting ? 'progress_activity' : 'download'}
                    </span>
                    {isExporting ? 'Đang xuất...' : 'Xuất dữ liệu'}
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>expand_more</span>
                  </button>
                  {showExportMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                      <div className="absolute right-0 top-full z-20 mt-1.5 flex w-40 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                        <button type="button" onClick={() => void handleExport('excel')} className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 hover:text-primary">Xuất Excel</button>
                        <button type="button" onClick={() => void handleExport('csv')} className="w-full border-t border-slate-100 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 hover:text-primary">Xuất CSV</button>
                        <button type="button" onClick={() => void handleExport('pdf')} className="w-full border-t border-slate-100 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 hover:text-primary">Xuất PDF</button>
                      </div>
                    </>
                  )}
                </div>
                {canAdd && (
                  <button
                    type="button"
                    onClick={() => onOpenModal('ADD_CONTRACT')}
                    title="Thêm hợp đồng (Ctrl+N / ⌘N)"
                    className="inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-deep-teal"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                    {addButtonLabel}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mb-3 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="flex flex-col gap-2">
          {viewMode === 'CONTRACTS' && (
            <div
              data-testid="contract-filter-toolbar"
              className="grid gap-2 md:grid-cols-2 lg:grid-cols-[minmax(220px,1.7fr)_minmax(180px,1fr)_minmax(150px,0.85fr)_minmax(140px,0.8fr)] lg:items-stretch"
            >
              <div className="relative min-w-0 w-full">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>search</span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={showProjectColumn ? 'Tìm mã/tên HĐ, khách hàng, dự án...' : 'Tìm mã/tên HĐ, khách hàng...'}
                  className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-8 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => { setSearchInput(''); setDebouncedSearchTerm(''); setCurrentPage(1); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                  </button>
                )}
              </div>
              <SearchableSelect
                compact
                className="w-full"
                value={normalizedDepartmentFilter}
                onChange={(value) => {
                  hasUserAdjustedDepartmentFilterRef.current = true;
                  setDepartmentFilter(value);
                }}
                options={contractDepartmentOptions}
                placeholder="Đơn vị ký hợp đồng"
                triggerClassName={denseFilterTriggerClassName}
              />
              <SearchableSelect
                compact
                className="w-full"
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusFilterOptions}
                placeholder="Tất cả trạng thái"
                triggerClassName={denseFilterTriggerClassName}
              />
              <SearchableSelect
                compact
                className="w-full"
                value={typeFilter}
                onChange={(v) => setTypeFilter(v as '' | 'STANDALONE' | 'ADDENDUM')}
                options={[
                  { value: '', label: 'Tất cả loại' },
                  { value: 'STANDALONE', label: 'HĐ độc lập' },
                  { value: 'ADDENDUM', label: 'Phụ lục / Gia hạn' },
                ]}
                placeholder="Tất cả loại"
                triggerClassName={denseFilterTriggerClassName}
              />
            </div>
          )}

          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <DateRangePresetPicker
              size="dense"
              label={viewMode === 'CONTRACTS' ? 'Kỳ ngày ký:' : 'Kỳ doanh thu:'}
              value={periodPreset}
              onPresetChange={setPeriodPreset}
              dateFrom={customDateFrom}
              dateTo={customDateTo}
              onDateFromChange={setCustomDateFrom}
              onDateToChange={setCustomDateTo}
              dateFromLabel={viewMode === 'CONTRACTS' ? 'Ngày ký từ' : 'Ngày doanh thu từ'}
              dateToLabel={viewMode === 'CONTRACTS' ? 'Ngày ký đến' : 'Ngày doanh thu đến'}
            />

            {hasActiveFilter && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-red-50 hover:text-error"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>filter_list_off</span>
                  Xóa lọc
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {viewMode === 'CONTRACTS' && (isContractsPageLoading ? renderLoadingKpis() : (
        <div
          data-testid="contract-management-summary"
          className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
        >
          <span className="inline-flex h-7 items-center rounded-full bg-primary/10 px-2.5 text-[10px] font-bold text-primary">
            Kỳ: {periodLabel}
          </span>
          <div className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-[11px] text-slate-600">
            <span className="font-semibold text-slate-500">Tổng</span>
            <span className="font-bold text-deep-teal">{totalContractsKpi.toLocaleString('vi-VN')}</span>
          </div>
          <div className="inline-flex h-7 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] text-emerald-700">
            <span className="font-semibold">Ký mới</span>
            <span className="font-bold text-emerald-800">{newSignedCount.toLocaleString('vi-VN')}</span>
          </div>
          <div className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-[11px] text-slate-600">
            <span className="font-semibold text-slate-500">GT ký</span>
            <span className="font-bold text-deep-teal">{formatCurrencyLabel(newSignedValue)}</span>
          </div>
          <div className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-[11px] text-slate-600">
            <span className="font-semibold text-slate-500">Thực thu</span>
            <span className="font-bold text-deep-teal">{formatCurrencyLabel(actualCollectedValue)}</span>
            <span className="text-[10px] text-slate-400">({collectionRate}%)</span>
          </div>
          <div className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] ${expiringSoonContractsKpi > 0 ? 'border-warning/30 bg-warning/5 text-tertiary' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
            <span className="font-semibold">Sắp hết hạn</span>
            <span className="font-bold">{expiringSoonContractsKpi.toLocaleString('vi-VN')}</span>
          </div>
          <div className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] ${overduePaymentAmount > 0 ? 'border-error/20 bg-error/5 text-error' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
            <span className="font-semibold">Quá hạn TT</span>
            <span className="font-bold">{formatCurrencyLabel(overduePaymentAmount)}</span>
          </div>
          <div className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-[11px] text-slate-600">
            <span className="font-semibold text-slate-500">Nháp / gia hạn</span>
            <span className="font-bold text-deep-teal">{draftCount}</span>
            <span className="text-slate-300">/</span>
            <span className="font-bold text-deep-teal">{renewedCount}</span>
          </div>
        </div>
      ))}

      <div>
        {viewMode === 'CONTRACTS' ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-deep-teal">Danh sách hợp đồng</span>
                <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-inset ring-slate-200">
                  {totalItems.toLocaleString('vi-VN')} hợp đồng
                </span>
                {showProjectColumn && (
                  <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
                    Gom theo khách hàng / dự án
                  </span>
                )}
                {hasActiveFilter && (
                  <span className="inline-flex items-center rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold text-secondary">
                    Đang lọc
                  </span>
                )}
              </div>
              <div className="flex flex-col items-start gap-0.5 text-left sm:items-end sm:text-right">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Tổng giá trị trong kỳ
                </span>
                <span
                  data-testid="contract-period-total-value"
                  className="text-sm font-semibold text-deep-teal"
                >
                  {formatCurrencyLabel(signPeriodTotalValue)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className={`w-full min-w-[860px] border-collapse text-left ${showActionColumn ? 'xl:min-w-[940px]' : ''}`}>
                <thead className="border-y border-slate-200 bg-slate-50">
                  <tr>
                    {tableColumns.map((col) => (
                      <th
                        key={col.key}
                        className={`cursor-pointer select-none px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-100 ${
                          col.align === 'right' ? 'text-right' : ''
                        }`}
                        onClick={() => handleSort(col.key)}
                      >
                        <div className={`flex items-center gap-0.5 ${col.align === 'right' ? 'justify-end' : ''}`}>
                          <span className="text-deep-teal">{col.label}</span>
                          {renderSortIcon(col.key)}
                        </div>
                      </th>
                    ))}
                    {showActionColumn && (
                      <th className="sticky right-0 w-[72px] min-w-[72px] bg-slate-50 px-2.5 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Thao tác
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isContractsPageLoading ? (
                    renderLoadingRows()
                  ) : currentData.length > 0 ? (
                    currentData.map((item) => (
                      <tr
                        key={item.id}
                        data-testid={`contract-row-${item.id}`}
                        onClick={() => setSelectedRowId((prev) => (String(prev) === String(item.id) ? null : item.id))}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setSelectedRowId(item.id);
                          setContextMenu({
                            item,
                            x: Math.min(event.clientX, Math.max(12, window.innerWidth - 248)),
                            y: Math.min(event.clientY, Math.max(12, window.innerHeight - 84)),
                          });
                        }}
                        className={`cursor-pointer transition-colors ${
                          String(selectedRowId) === String(item.id)
                            ? 'bg-secondary/10 ring-1 ring-inset ring-primary/30'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="px-3 py-2 align-top">
                          <div className={`${showProjectColumn ? 'min-w-[260px] max-w-[380px]' : 'min-w-[300px] max-w-[440px]'}`}>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="whitespace-nowrap text-[11px] font-mono font-bold text-slate-600">
                                {item.contract_code}
                              </span>
                              {item.parent_contract_id != null && (
                                <span
                                  className="inline-flex items-center rounded bg-deep-teal/10 px-1 py-0.5 text-[10px] font-bold leading-none text-deep-teal"
                                  title="Phụ lục / Gia hạn"
                                >
                                  PL
                                </span>
                              )}
                            </div>
                            <div
                              className="mt-0.5 whitespace-normal break-words text-xs font-semibold leading-snug text-slate-900"
                              title={item.contract_name}
                              data-testid={`contract-name-cell-${item.id}`}
                            >
                              {item.contract_name}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 align-middle text-xs text-slate-600">
                          <div className="min-w-[220px] max-w-[320px]">
                            <div className="whitespace-normal break-words font-medium leading-snug text-slate-700" title={getCustomerName(item.customer_id)}>
                              {getCustomerName(item.customer_id)}
                            </div>
                            {showProjectColumn && (
                              <div
                                className="mt-0.5 whitespace-normal break-words text-[11px] leading-snug text-slate-500"
                                title={getProjectName(item.project_id)}
                                data-testid={`contract-project-cell-${item.id}`}
                              >
                                {getProjectName(item.project_id)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 align-top text-xs text-slate-600">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-slate-700">{getPaymentCycleLabel(item.payment_cycle)}</span>
                            <span className="text-[11px] text-slate-400">
                              {item.parent_contract_id != null ? 'Phụ lục / Gia hạn' : 'HĐ độc lập'}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 align-middle text-right text-xs">
                          <div className="font-bold text-slate-900" data-testid={`contract-value-cell-${item.id}`}>
                            {formatCurrencyLabel(resolveContractValue(item))}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-slate-500">
                          <div className="min-w-[180px] whitespace-nowrap">
                            <div>
                              <span className="font-medium text-slate-400">Ký:</span>{' '}
                              {formatDate(item.sign_date || null)}
                            </div>
                            <div className="mt-0.5">
                              <span className="font-medium text-slate-400">HL:</span>{' '}
                              {formatDate(item.effective_date || null)} → {formatDate(item.expiry_date || null)}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-col items-start gap-1">
                            <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${getStatusColor(item.status)}`}>
                              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{getStatusIcon(item.status)}</span>
                              {getStatusLabel(item.status)}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {item.parent_contract_id != null ? 'Phụ lục đang theo HĐ cha' : 'Hợp đồng độc lập'}
                            </span>
                          </div>
                        </td>
                        {showActionColumn && (
                          <td className="sticky right-0 w-[72px] min-w-[72px] bg-white px-2.5 py-2 text-right shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]">
                            <div className="flex justify-end gap-0.5">
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => onOpenModal('EDIT_CONTRACT', item)}
                                  className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary"
                                  title="Chỉnh sửa"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => onOpenModal('DELETE_CONTRACT', item)}
                                  className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-error"
                                  title="Xóa"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : isEmptyData ? (
                    <tr>
                      <td colSpan={tableColSpan} className="px-4 py-8 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-500">
                          <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 36 }}>description</span>
                          <div>
                            <p className="text-xs font-semibold text-slate-700">{emptyStateTitle}</p>
                            <p className="mt-0.5 text-[11px] text-slate-400">{emptyStateHint}</p>
                          </div>
                          {canAdd && (
                            <button
                              type="button"
                              onClick={() => onOpenModal('ADD_CONTRACT')}
                              className="inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-deep-teal"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                              {addButtonLabel}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : isFilterNoMatch ? (
                    <tr>
                      <td colSpan={tableColSpan} className="px-4 py-8 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-500">
                          <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 36 }}>filter_list_off</span>
                          <div>
                            <p className="text-xs font-semibold text-slate-700">Không tìm thấy hợp đồng phù hợp.</p>
                            <p className="mt-0.5 text-[11px] text-slate-400">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
                          </div>
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>filter_list_off</span>
                            Xóa bộ lọc
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <PaginationControls
              currentPage={currentPage}
              totalItems={totalItems}
              rowsPerPage={rowsPerPage}
              onPageChange={goToPage}
              rowsPerPageOptions={[20, 50, 100, 200]}
              onRowsPerPageChange={(rows) => {
                setRowsPerPage(rows);
                setCurrentPage(1);
              }}
            />
          </div>
        ) : (
          <div className="mt-3">
            <ContractRevenueView
              periodFrom={dateFrom}
              periodTo={dateTo}
              periodLabel={periodLabel}
              fixedSourceMode={fixedSourceMode}
              onNotify={onNotify}
            />
          </div>
        )}
      </div>

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setContextMenu(null)} />
          <div
            role="menu"
            data-testid="contract-row-context-menu"
            className="fixed z-40 min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-slate-500">Tác vụ nhanh</p>
              <p className="mt-0.5 text-xs font-bold text-slate-700">{contextMenu.item.contract_code}</p>
            </div>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary"
              onClick={() => {
                const cachedDetail = detailCache[String(contextMenu.item.id)];
                setContextMenu(null);
                setDetailDrawerContractId(contextMenu.item.id);
                setDetailDrawerData(cachedDetail ?? contextMenu.item);

                const requestVersion = detailRequestVersionRef.current + 1;
                detailRequestVersionRef.current = requestVersion;
                setIsDetailDrawerLoading(true);
                void fetchContractDetail(contextMenu.item.id)
                  .then((detail) => {
                    if (detailRequestVersionRef.current !== requestVersion) {
                      return;
                    }
                    setDetailDrawerData(detail);
                    setDetailCache((previous) => ({
                      ...previous,
                      [String(contextMenu.item.id)]: detail,
                    }));
                  })
                  .catch((error) => {
                    if (detailRequestVersionRef.current !== requestVersion) {
                      return;
                    }
                    const message = error instanceof Error ? error.message : 'Không thể tải chi tiết hợp đồng.';
                    onNotify?.('error', 'Tải dữ liệu thất bại', message);
                  })
                  .finally(() => {
                    if (detailRequestVersionRef.current === requestVersion) {
                      setIsDetailDrawerLoading(false);
                    }
                  });
              }}
            >
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>page_info</span>
              Xem chi tiết tất cả thông tin
            </button>
          </div>
        </>
      )}

      {detailDrawerContractId !== null && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/35 backdrop-blur-[1px]"
            onClick={() => {
              setDetailDrawerContractId(null);
              setDetailDrawerData(null);
            }}
          />
          <aside
            data-testid="contract-detail-drawer"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[840px] flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Chi tiết hợp đồng</p>
                <h3 className="mt-1 break-words text-lg font-bold text-deep-teal">
                  {detailDrawerData?.contract_name || 'Đang tải hợp đồng'}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {detailDrawerData?.contract_code || detailDrawerContractId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailDrawerContractId(null);
                  setDetailDrawerData(null);
                }}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng chi tiết hợp đồng"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {isDetailDrawerLoading && (
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Đang tải đầy đủ thông tin hợp đồng...
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { label: 'Mã hợp đồng', value: detailDrawerData?.contract_code || '--' },
                  { label: 'Khách hàng', value: getCustomerName(detailDrawerData?.customer_id) },
                  { label: 'Dự án', value: getProjectName(detailDrawerData?.project_id) },
                  { label: 'Phòng ban', value: [detailDrawerData?.dept_code, detailDrawerData?.dept_name].filter(Boolean).join(' - ') || '--' },
                  { label: 'Người ký', value: [detailDrawerData?.signer_user_code, detailDrawerData?.signer_full_name].filter(Boolean).join(' - ') || '--' },
                  { label: 'Chu kỳ thanh toán', value: getPaymentCycleLabel(detailDrawerData?.payment_cycle) },
                  { label: 'Giá trị hợp đồng', value: formatCurrencyLabel(resolveContractValue(detailDrawerData || ({} as Contract))) },
                  { label: 'Trạng thái', value: detailDrawerData ? getStatusLabel(detailDrawerData.status) : '--' },
                  { label: 'Loại dữ liệu', value: resolveContractSourceMode(detailDrawerData || {}) === 'INITIAL' ? 'Hợp đồng đầu kỳ' : 'Hợp đồng theo dự án' },
                  { label: 'Ngày ký', value: formatDate(detailDrawerData?.sign_date || null) },
                  { label: 'Hiệu lực', value: formatDate(detailDrawerData?.effective_date || null) },
                  { label: 'Hết hạn', value: formatDate(detailDrawerData?.expiry_date || null) },
                  { label: 'Kỳ hạn', value: detailDrawerData?.term_value ? `${detailDrawerData.term_value} ${detailDrawerData.term_unit === 'DAY' ? 'ngày' : 'tháng'}` : '--' },
                  { label: 'Loại phụ lục', value: detailDrawerData?.addendum_type || '--' },
                  { label: 'HĐ cha', value: detailDrawerData?.parent_contract ? `${detailDrawerData.parent_contract.contract_code} - ${detailDrawerData.parent_contract.contract_name}` : '--' },
                  { label: 'Đầu tư', value: detailDrawerData?.project_type_code || '--' },
                  { label: 'Phí phạt', value: detailDrawerData?.penalty_rate != null ? `${detailDrawerData.penalty_rate}%` : '--' },
                  { label: 'Ngày tạo', value: formatDate(detailDrawerData?.created_at || null) },
                  { label: 'Ngày cập nhật', value: formatDate(detailDrawerData?.updated_at || null) },
                ].map((field) => (
                  <div key={field.label} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <p className="break-words text-sm leading-6 text-slate-800">
                      <span className="font-semibold text-slate-500">{field.label}:</span>{' '}
                      <span className="font-semibold text-slate-900">{field.value}</span>
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h4 className="text-sm font-bold text-slate-700">
                    Hạng mục hợp đồng ({detailDrawerData?.items?.length ?? 0})
                  </h4>
                </div>
                {detailDrawerData?.items && detailDrawerData.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] border-collapse">
                      <thead className="bg-slate-50 text-left">
                        <tr>
                          <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Hạng mục</th>
                          <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Đơn vị</th>
                          <th className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">SL</th>
                          <th className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Đơn giá</th>
                          <th className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailDrawerData.items.map((contractItem, index) => {
                          const quantity = Number(contractItem.quantity || 0);
                          const unitPrice = Number(contractItem.unit_price || 0);
                          const lineTotal = Math.max(0, quantity * unitPrice);
                          return (
                            <tr key={`${contractItem.id}-${index}`}>
                              <td className="px-4 py-3 text-sm text-slate-800">
                                {contractItem.product_name || contractItem.product_code || contractItem.product_id}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600">{contractItem.unit || '--'}</td>
                              <td className="px-4 py-3 text-right text-sm text-slate-600">{quantity.toLocaleString('vi-VN')}</td>
                              <td className="px-4 py-3 text-right text-sm text-slate-600">{formatCurrencyLabel(unitPrice)}</td>
                              <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">{formatCurrencyLabel(lineTotal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-4 py-5 text-sm text-slate-500">Hợp đồng này chưa có hạng mục chi tiết để hiển thị.</div>
                )}
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                <h4 className="text-sm font-bold text-slate-700">Tệp đính kèm</h4>
                <p className="mt-1 text-sm text-slate-600">
                  {detailDrawerData?.attachments?.length
                    ? `${detailDrawerData.attachments.length} tệp đính kèm`
                    : 'Chưa có tệp đính kèm'}
                </p>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
};
