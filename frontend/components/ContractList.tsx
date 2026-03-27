import React, { useEffect, useMemo, useState } from 'react';
import {
  Contract,
  ContractAggregateKpis,
  PaymentSchedule,
  Customer,
  ModalType,
  PaginatedQuery,
  PaginationMeta,
  PaymentCycle,
  Project,
} from '../types';
import { CONTRACT_STATUSES } from '../constants';
import { useEscKey } from '../hooks/useEscKey';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect } from './SearchableSelect';
import { exportCsv, exportExcel, exportPdfTable, isoDateStamp } from '../utils/exportUtils';
import { ContractRevenueView } from './contract-revenue/ContractRevenueView';

type PeriodPreset = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';
type ContractViewMode = 'CONTRACTS' | 'REVENUE';

interface ContractListQuery extends PaginatedQuery {
  filters?: {
    status?: string;
    sign_date_from?: string;
    sign_date_to?: string;
  };
}

interface ContractListProps {
  contracts: Contract[];
  projects: Project[];
  customers: Customer[];
  paymentSchedules?: PaymentSchedule[];
  onOpenModal: (type: ModalType, item?: Contract) => void;
  paginationMeta?: PaginationMeta;
  isLoading?: boolean;
  onQueryChange?: (query: ContractListQuery) => void;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
  onExportContracts?: () => Promise<Contract[]>;
  aggregateKpis?: ContractAggregateKpis;
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

const safePercent = (part: number, total: number): number => {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }
  return clampPercent((part / total) * 100);
};

const resolveContractValue = (contract: Contract): number => {
  const numeric = Number(contract.value ?? contract.total_value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

function resolvePresetDates(
  preset: PeriodPreset,
  customFrom: string,
  customTo: string
): { dateFrom: string | null; dateTo: string | null; label: string } {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-indexed

  if (preset === 'this_month') {
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    return { dateFrom: start, dateTo: end, label: `Tháng ${m + 1}/${y}` };
  }

  if (preset === 'last_month') {
    const d = new Date(y, m - 1, 1);
    const ly = d.getFullYear();
    const lm = d.getMonth();
    const start = `${ly}-${String(lm + 1).padStart(2, '0')}-01`;
    const end = new Date(ly, lm + 1, 0).toISOString().slice(0, 10);
    return { dateFrom: start, dateTo: end, label: `Tháng ${lm + 1}/${ly}` };
  }

  if (preset === 'this_quarter') {
    const q = Math.floor(m / 3);
    const startMonth = q * 3;
    const start = `${y}-${String(startMonth + 1).padStart(2, '0')}-01`;
    const end = new Date(y, startMonth + 3, 0).toISOString().slice(0, 10);
    return { dateFrom: start, dateTo: end, label: `Quý ${q + 1}/${y}` };
  }

  if (preset === 'this_year') {
    return { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31`, label: `Năm ${y}` };
  }

  // custom
  const label =
    customFrom && customTo
      ? `${customFrom} → ${customTo}`
      : customFrom
        ? `Từ ${customFrom}`
        : customTo
          ? `Đến ${customTo}`
          : 'Tùy chọn';
  return { dateFrom: customFrom || null, dateTo: customTo || null, label };
}

export const ContractList: React.FC<ContractListProps> = ({
  contracts = [],
  projects = [],
  customers = [],
  paymentSchedules = [],
  onOpenModal,
  paginationMeta,
  isLoading = false,
  onQueryChange,
  canAdd = true,
  canEdit = false,
  canDelete = false,
  onNotify,
  onExportContracts,
  aggregateKpis,
}) => {
  const serverMode = Boolean(onQueryChange && paginationMeta);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | 'STANDALONE' | 'ADDENDUM'>('');
  const [viewMode, setViewMode] = useState<ContractViewMode>('CONTRACTS');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('this_year');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Contract; direction: 'asc' | 'desc' } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEscKey(() => setShowExportMenu(false), showExportMenu);

  const showActionColumn = canEdit || canDelete;
  const tableColSpan = showActionColumn ? 10 : 9;
  const hasActiveFilter =
    searchInput.trim() !== '' ||
    statusFilter !== '' ||
    typeFilter !== '' ||
    (periodPreset === 'custom' && (customDateFrom !== '' || customDateTo !== ''));

  const { dateFrom, dateTo, label: periodLabel } = resolvePresetDates(periodPreset, customDateFrom, customDateTo);

  const getProjectName = (id: string | number) => {
    const project = (projects || []).find((item) => String(item.id) === String(id));
    return project ? `${project.project_code} - ${project.project_name}` : String(id);
  };

  const getCustomerName = (id: string | number) => {
    const customer = (customers || []).find((item) => String(item.id) === String(id));
    return customer ? `${customer.customer_code} - ${customer.customer_name}` : String(id);
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
    let result = (contracts || []).filter((contract) => {
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
      const matchesStatus = statusFilter ? contract.status === statusFilter : true;
      const matchesType =
        typeFilter === ''
          ? true
          : typeFilter === 'ADDENDUM'
            ? contract.parent_contract_id != null
            : contract.parent_contract_id == null;

      return matchesSearch && matchesStatus && matchesType;
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
  }, [serverMode, contracts, debouncedSearchTerm, statusFilter, sortConfig, projects, customers]);

  const statusFilterOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả trạng thái' },
      ...CONTRACT_STATUSES.map((status) => ({ value: status.value, label: status.label })),
    ],
    []
  );

  const totalItems = serverMode ? (paginationMeta?.total || 0) : filteredContracts.length;
  const totalPages = serverMode
    ? Math.max(1, paginationMeta?.total_pages || 1)
    : Math.max(1, Math.ceil(totalItems / rowsPerPage));

  const totalContractsKpi = (() => {
    const value = Number(paginationMeta?.kpis?.total_contracts);
    if (Number.isFinite(value) && value >= 0) return Math.floor(value);
    return totalItems;
  })();

  const expiringSoonContractsKpi = (() => {
    const value = Number(paginationMeta?.kpis?.expiring_soon);
    if (Number.isFinite(value) && value >= 0) return Math.floor(value);
    return 0;
  })();

  const expiryWarningDays = (() => {
    const value = Number(paginationMeta?.kpis?.expiry_warning_days);
    if (Number.isFinite(value) && value > 0) return Math.floor(value);
    return 30;
  })();

  const draftCount = aggregateKpis?.draftCount ?? (contracts || []).filter((contract) => contract.status === 'DRAFT').length;
  const renewedCount = aggregateKpis?.renewedCount ?? (contracts || []).filter((contract) => contract.status === 'RENEWED').length;
  const collectionRate = clampPercent(aggregateKpis?.collectionRate ?? 0);
  const newSignedCount = aggregateKpis?.newSignedCount ?? 0;
  const newSignedValue = aggregateKpis?.newSignedValue ?? 0;
  const actualCollectedValue = aggregateKpis?.actualCollectedValue ?? 0;
  const overduePaymentAmount = aggregateKpis?.overduePaymentAmount ?? 0;
  const newSignedPercent = safePercent(newSignedCount, totalContractsKpi);

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
  }, [statusFilter, periodPreset, customDateFrom, customDateTo]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (viewMode !== 'CONTRACTS' || !serverMode || !onQueryChange) {
      return;
    }

    onQueryChange({
      page: currentPage,
      per_page: rowsPerPage,
      q: debouncedSearchTerm.trim(),
      sort_by: sortConfig?.key ? String(sortConfig.key) : 'id',
      sort_dir: sortConfig?.direction || 'desc',
      filters: {
        status: statusFilter,
        type: typeFilter || undefined,
        sign_date_from: dateFrom ?? undefined,
        sign_date_to: dateTo ?? undefined,
      },
    });
  }, [viewMode, serverMode, onQueryChange, currentPage, rowsPerPage, debouncedSearchTerm, statusFilter, typeFilter, sortConfig, dateFrom, dateTo]);

  const currentData = serverMode
    ? (contracts || [])
    : filteredContracts.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const isEmptyData = !isLoading && totalContractsKpi === 0 && !hasActiveFilter;
  const isFilterNoMatch = !isLoading && !isEmptyData && currentData.length === 0;

  const resetFilters = () => {
    setSearchInput('');
    setDebouncedSearchTerm('');
    setStatusFilter('');
    setTypeFilter('');
    setCurrentPage(1);
    setPeriodPreset('this_year');
    setCustomDateFrom('');
    setCustomDateTo('');
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
      const dataToExport = serverMode && onExportContracts
        ? await onExportContracts()
        : filteredContracts;
      const headers = [
        'Mã HĐ',
        'Tên HĐ',
        'Khách hàng',
        'Dự án',
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
        title: 'Danh sách Hợp đồng',
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
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={`contract-kpi-skel-${index}`} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <div className="h-3 w-20 rounded bg-slate-200 animate-pulse" />
          <div className="mt-2 h-6 w-16 rounded bg-slate-200 animate-pulse" />
          <div className="mt-1.5 h-2 w-full rounded bg-slate-200 animate-pulse" />
        </div>
      ))}
    </div>
  );

  const renderLoadingRows = () =>
    Array.from({ length: 8 }).map((_, index) => (
      <tr key={`contract-skeleton-${index}`}>
        {Array.from({ length: tableColSpan }).map((__, cellIndex) => (
          <td key={`contract-skeleton-${index}-${cellIndex}`} className="px-3 py-2">
            <div className={`h-3.5 rounded bg-slate-200 animate-pulse ${
              cellIndex === 1 ? 'w-32' : cellIndex === tableColSpan - 1 ? 'w-12 ml-auto' : 'w-20'
            }`} />
          </td>
        ))}
      </tr>
    ));

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8">
      <header className="mb-6 flex flex-col gap-4 md:mb-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Hợp đồng &amp; Doanh thu</h2>
          <p className="mt-1 text-sm text-slate-500">Quản lý hợp đồng, theo dõi doanh thu dự kiến và thực thu theo kỳ chọn.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('CONTRACTS')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                viewMode === 'CONTRACTS'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-base">description</span>
              Hợp đồng
            </button>
            <button
              type="button"
              onClick={() => setViewMode('REVENUE')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                viewMode === 'REVENUE'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-base">bar_chart</span>
              Doanh thu
            </button>
          </div>

          {viewMode === 'CONTRACTS' && (
            <>
              <div className="relative flex-auto lg:flex-none">
                <button
                  type="button"
                  onClick={() => setShowExportMenu((current) => !current)}
                  disabled={isExporting}
                  className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm disabled:opacity-60"
                >
                  <span className={`material-symbols-outlined text-lg ${isExporting ? 'animate-spin' : ''}`}>
                    {isExporting ? 'progress_activity' : 'download'}
                  </span>
                  <span>{isExporting ? 'Đang xuất...' : 'Xuất dữ liệu'}</span>
                  <span className="material-symbols-outlined text-sm">expand_more</span>
                </button>
                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in flex flex-col">
                      <button
                        type="button"
                        onClick={() => void handleExport('excel')}
                        className="px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Xuất Excel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleExport('csv')}
                        className="px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Xuất CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleExport('pdf')}
                        className="px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Xuất PDF
                      </button>
                    </div>
                  </>
                )}
              </div>
              {canAdd && (
                <button
                  type="button"
                  onClick={() => onOpenModal('ADD_CONTRACT')}
                  className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20"
                >
                  <span className="material-symbols-outlined">add</span>
                  <span>Thêm mới</span>
                </button>
              )}
            </>
          )}
        </div>
      </header>

      <div className="mb-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-3">
            {viewMode === 'CONTRACTS' && (
              <div className="flex flex-col items-center gap-3 md:flex-row">
                <div className="relative w-full md:flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Tìm theo mã/tên hợp đồng, khách hàng, dự án..."
                    className="w-full rounded-lg border-none bg-slate-50 py-2 pl-10 pr-10 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput('');
                        setDebouncedSearchTerm('');
                        setCurrentPage(1);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  )}
                </div>
                <SearchableSelect
                  className="w-full md:w-52"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={statusFilterOptions}
                  placeholder="Tất cả trạng thái"
                  triggerClassName="w-full pl-3 pr-8 py-2 h-10 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm text-slate-600 outline-none"
                />
                <SearchableSelect
                  className="w-full md:w-44"
                  value={typeFilter}
                  onChange={(v) => setTypeFilter(v as '' | 'STANDALONE' | 'ADDENDUM')}
                  options={[
                    { value: '', label: 'Tất cả loại' },
                    { value: 'STANDALONE', label: 'HĐ gốc' },
                    { value: 'ADDENDUM', label: 'Phụ lục / Gia hạn' },
                  ]}
                  placeholder="Tất cả loại"
                  triggerClassName="w-full pl-3 pr-8 py-2 h-10 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm text-slate-600 outline-none"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="shrink-0 text-xs font-medium text-slate-500">
                {viewMode === 'CONTRACTS' ? 'Kỳ ngày ký:' : 'Kỳ doanh thu:'}
              </span>
              <div className="flex shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                {([
                  { value: 'this_month', label: 'T.này' },
                  { value: 'last_month', label: 'T.trước' },
                  { value: 'this_quarter', label: 'Quý này' },
                  { value: 'this_year', label: 'Năm này' },
                  { value: 'custom', label: 'Tùy chọn' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPeriodPreset(opt.value)}
                    className={`whitespace-nowrap border-r border-slate-200 px-3 py-1.5 text-xs font-semibold transition-colors last:border-r-0 ${
                      periodPreset === opt.value
                        ? 'bg-primary text-white'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {periodPreset === 'custom' && (
                <>
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(event) => setCustomDateFrom(event.target.value)}
                    className="h-9 w-36 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="text-xs text-slate-400">→</span>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(event) => setCustomDateTo(event.target.value)}
                    className="h-9 w-36 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </>
              )}
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="flex items-center justify-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <span className="material-symbols-outlined text-sm">filter_list_off</span>
                  Xóa lọc
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'CONTRACTS' && (isLoading ? renderLoadingKpis() : (
        <div className="mb-4">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-primary">date_range</span>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Kỳ: {periodLabel}
            </span>
            <span className="hidden text-xs text-slate-400 sm:inline">· lọc theo ngày ký</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">

            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="truncate text-xs font-medium text-slate-500">Tổng hợp đồng</p>
              <p className="mt-1 text-xl font-black text-slate-900">{totalContractsKpi.toLocaleString('vi-VN')}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-400">
                {draftCount} nháp · {renewedCount} gia hạn
                {(() => {
                  const rate = paginationMeta?.kpis?.continuity_rate;
                  if (rate == null) return null;
                  return (
                    <span className="ml-1.5 font-medium text-emerald-600" title="Tỷ lệ tiếp tục (HĐ có phụ lục / tổng HĐ hết hạn)">
                      · {rate}% tiếp tục
                    </span>
                  );
                })()}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
              <p className="truncate text-xs font-medium text-emerald-700">Ký kết trong kỳ</p>
              <p className="mt-1 text-xl font-black text-emerald-800">{newSignedCount.toLocaleString('vi-VN')}</p>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-emerald-200">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${newSignedPercent}%` }} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:col-span-2 xl:col-span-1">
              <p className="truncate text-xs font-medium text-slate-500">Giá trị HĐ ký trong kỳ</p>
              <p className="mt-1 text-base font-black text-slate-900 leading-tight">{formatCurrency(newSignedValue)}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-400">{periodLabel}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:col-span-2 xl:col-span-1">
              <p className="truncate text-xs font-medium text-slate-500">Tổng GT HĐ đang ký</p>
              <p className="mt-1 text-base font-black text-slate-900 leading-tight">{formatCurrency(aggregateKpis?.signedTotalValue ?? 0)}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-400">toàn bộ HĐ có trạng thái Đã ký</p>
            </div>

            {(() => {
              const upcomingCount = paginationMeta?.kpis?.upcoming_payment_contracts ?? 0;
              const warningDays = paginationMeta?.kpis?.payment_warning_days ?? 30;
              const hasUpcoming = upcomingCount > 0;
              return (
                <div className={`rounded-xl border px-4 py-3 shadow-sm ${hasUpcoming ? 'border-violet-200 bg-violet-50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center justify-between">
                    <p className={`truncate text-xs font-medium ${hasUpcoming ? 'text-violet-700' : 'text-slate-500'}`}>
                      Sắp đến kỳ TT
                    </p>
                    <span className={`material-symbols-outlined text-base ${hasUpcoming ? 'text-violet-500' : 'text-slate-300'}`}>payments</span>
                  </div>
                  <p className={`mt-1 text-xl font-black ${hasUpcoming ? 'text-violet-800' : 'text-slate-900'}`}>
                    {upcomingCount}
                  </p>
                  <p className={`mt-0.5 truncate text-[11px] ${hasUpcoming ? 'text-violet-600' : 'text-slate-400'}`}>
                    trong {warningDays} ngày tới
                  </p>
                </div>
              );
            })()}

            <div className={`rounded-xl border px-4 py-3 shadow-sm ${expiringSoonContractsKpi > 0 ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center justify-between">
                <p className={`truncate text-xs font-medium ${expiringSoonContractsKpi > 0 ? 'text-orange-700' : 'text-slate-500'}`}>
                  Sắp hết hiệu lực
                </p>
                <span className={`material-symbols-outlined text-base ${expiringSoonContractsKpi > 0 ? 'text-orange-500' : 'text-slate-300'}`}>schedule</span>
              </div>
              <p className={`mt-1 text-xl font-black ${expiringSoonContractsKpi > 0 ? 'text-orange-800' : 'text-slate-900'}`}>
                {expiringSoonContractsKpi}
              </p>
              <p className={`mt-0.5 truncate text-[11px] ${expiringSoonContractsKpi > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                trong {expiryWarningDays} ngày tới
              </p>
            </div>

            <div className={`rounded-xl border px-4 py-3 shadow-sm ${overduePaymentAmount > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center justify-between">
                <p className={`truncate text-xs font-medium ${overduePaymentAmount > 0 ? 'text-red-700' : 'text-slate-500'}`}>
                  Quá hạn TT
                </p>
                <span className={`material-symbols-outlined text-base ${overduePaymentAmount > 0 ? 'text-red-500' : 'text-slate-300'}`}>money_off</span>
              </div>
              <p className={`mt-1 text-sm font-black leading-tight ${overduePaymentAmount > 0 ? 'text-red-800' : 'text-slate-900'}`}>
                {formatCurrency(overduePaymentAmount)}
              </p>
              <p className={`mt-0.5 truncate text-[11px] ${overduePaymentAmount > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                {overduePaymentAmount > 0 ? 'cần đôn đốc thu' : 'không có quá hạn'}
              </p>
            </div>
          </div>
        </div>
      ))}

      <div>

        {viewMode === 'CONTRACTS' ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.12)]">
            <div className="overflow-x-auto">
              <table className={`w-full border-collapse text-left ${showActionColumn ? 'min-w-[1060px]' : 'min-w-[960px]'}`}>
                <thead className="border-y border-slate-200 bg-slate-50">
                  <tr>
                    {[
                      { label: 'Mã HĐ', key: 'contract_code' },
                      { label: 'Tên hợp đồng', key: 'contract_name' },
                      { label: 'Khách hàng', key: 'customer_id' },
                      { label: 'Dự án', key: 'project_id' },
                      { label: 'Chu kỳ', key: 'payment_cycle' },
                      { label: 'Giá trị HĐ', key: 'value' },
                      { label: 'Hiệu lực', key: 'effective_date' },
                      { label: 'Hết hạn', key: 'expiry_date' },
                      { label: 'Trạng thái', key: 'status' },
                    ].map((col) => (
                      <th
                        key={col.key}
                        className="cursor-pointer select-none px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-100"
                        onClick={() => handleSort(col.key as keyof Contract)}
                      >
                        <div className="flex items-center gap-0.5">
                          <span className="text-deep-teal">{col.label}</span>
                          {renderSortIcon(col.key as keyof Contract)}
                        </div>
                      </th>
                    ))}
                    {showActionColumn && (
                      <th className="sticky right-0 bg-slate-50 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                        Thao tác
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {isLoading ? (
                    renderLoadingRows()
                  ) : currentData.length > 0 ? (
                    currentData.map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="whitespace-nowrap px-3 py-2 text-xs font-mono font-bold text-slate-600">
                          {item.contract_code}
                          {item.parent_contract_id != null && (
                            <span
                              className="ml-1.5 inline-flex items-center rounded-sm bg-violet-100 px-1 py-0.5 text-[10px] font-semibold leading-none text-violet-700"
                              title="Phụ lục / Gia hạn"
                            >
                              PL
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm font-semibold text-slate-900">
                          <div className="max-w-[200px] truncate" title={item.contract_name}>{item.contract_name}</div>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">
                          <div className="max-w-[180px] truncate" title={getCustomerName(item.customer_id)}>{getCustomerName(item.customer_id)}</div>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">
                          <div className="max-w-[180px] truncate" title={getProjectName(item.project_id)}>{getProjectName(item.project_id)}</div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">{getPaymentCycleLabel(item.payment_cycle)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-sm font-bold text-slate-900">{formatCurrency(resolveContractValue(item))}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{formatDate(item.effective_date || null)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{formatDate(item.expiry_date || null)}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(item.status)}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{getStatusIcon(item.status)}</span>
                            {getStatusLabel(item.status)}
                          </span>
                        </td>
                        {showActionColumn && (
                          <td className="sticky right-0 bg-white px-3 py-2 text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                            <div className="flex justify-end gap-1">
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => onOpenModal('EDIT_CONTRACT', item)}
                                  className="rounded p-1 text-slate-400 transition-colors hover:text-primary hover:bg-primary/5"
                                  title="Chỉnh sửa"
                                >
                                  <span className="material-symbols-outlined text-base">edit</span>
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => onOpenModal('DELETE_CONTRACT', item)}
                                  className="rounded p-1 text-slate-400 transition-colors hover:text-error hover:bg-error/5"
                                  title="Xóa"
                                >
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : isEmptyData ? (
                    <tr>
                      <td colSpan={tableColSpan} className="px-6 py-10 text-center">
                        <div className="flex flex-col items-center gap-3 text-slate-500">
                          <span className="material-symbols-outlined text-4xl text-slate-300">description</span>
                          <div>
                            <p className="text-sm font-semibold text-slate-700">Chưa có hợp đồng nào.</p>
                            <p className="mt-1 text-sm text-slate-500">Bắt đầu bằng cách thêm mới hợp đồng đầu tiên.</p>
                          </div>
                          {canAdd && (
                            <button
                              type="button"
                              onClick={() => onOpenModal('ADD_CONTRACT')}
                              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-deep-teal"
                            >
                              <span className="material-symbols-outlined text-base">add</span>
                              Thêm mới
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : isFilterNoMatch ? (
                    <tr>
                      <td colSpan={tableColSpan} className="px-6 py-10 text-center">
                        <div className="flex flex-col items-center gap-3 text-slate-500">
                          <span className="material-symbols-outlined text-4xl text-slate-300">filter_list_off</span>
                          <div>
                            <p className="text-sm font-semibold text-slate-700">Không tìm thấy hợp đồng phù hợp.</p>
                            <p className="mt-1 text-sm text-slate-500">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
                          </div>
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <span className="material-symbols-outlined text-base">filter_list_off</span>
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
          <div className="mt-4">
            <ContractRevenueView
              periodFrom={dateFrom}
              periodTo={dateTo}
              periodLabel={periodLabel}
              paymentSchedules={paymentSchedules}
              contracts={contracts}
              customers={customers}
              projects={projects}
              onNotify={onNotify}
            />
          </div>
        )}
      </div>
    </div>
  );
};
