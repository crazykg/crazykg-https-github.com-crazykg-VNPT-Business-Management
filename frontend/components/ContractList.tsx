import React, { useEffect, useMemo, useState } from 'react';
import {
  Contract,
  ContractAggregateKpis,
  Customer,
  ModalType,
  PaymentCycle,
  Project,
} from '../types';
import { CONTRACT_STATUSES } from '../constants';
import { useEscKey } from '../hooks/useEscKey';
import { useAuthStore, useContractStore } from '../shared/stores';
import { hasPermission } from '../utils/authorization';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect } from './SearchableSelect';
import { exportCsv, exportExcel, exportPdfTable, isoDateStamp } from '../utils/exportUtils';
import { ContractRevenueView } from './contract-revenue/ContractRevenueView';

type PeriodPreset = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';
type ContractViewMode = 'CONTRACTS' | 'REVENUE';

interface ContractListProps {
  projects: Project[];
  customers: Customer[];
  onOpenModal: (type: ModalType, item?: Contract) => void;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
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
  projects = [],
  customers = [],
  onOpenModal,
  canAdd = true,
  canEdit = false,
  canDelete = false,
  onNotify,
  aggregateKpis,
}: ContractListProps) => {
  const authUser = useAuthStore((state) => state.user);
  const contracts = useContractStore((state) => state.contracts);
  const contractsPageRows = useContractStore((state) => state.contractsPageRows);
  const contractsPageMeta = useContractStore((state) => state.contractsPageMeta);
  const isContractsPageLoading = useContractStore((state) => state.isContractsPageLoading);
  const handleContractsPageQueryChange = useContractStore((state) => state.handleContractsPageQueryChange);
  const exportContractsByCurrentQuery = useContractStore((state) => state.exportContractsByCurrentQuery);
  const serverMode = true;
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

  const getProjectName = (id: string | number | null | undefined) => {
    const project = (projects || []).find((item) => String(item.id) === String(id));
    return project ? `${project.project_code} - ${project.project_name}` : String(id);
  };

  const getCustomerName = (id: string | number | null | undefined) => {
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

  const expiryWarningDays = (() => {
    const value = Number(contractsPageMeta?.kpis?.expiry_warning_days);
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
        status: statusFilter,
        type: typeFilter || undefined,
        sign_date_from: dateFrom ?? undefined,
        sign_date_to: dateTo ?? undefined,
      },
    });
  }, [viewMode, serverMode, handleContractsPageQueryChange, currentPage, rowsPerPage, debouncedSearchTerm, statusFilter, typeFilter, sortConfig, dateFrom, dateTo]);

  const currentData = serverMode
    ? (contractsPageRows || [])
    : filteredContracts.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const isEmptyData = !isContractsPageLoading && totalContractsKpi === 0 && !hasActiveFilter;
  const isFilterNoMatch = !isContractsPageLoading && !isEmptyData && currentData.length === 0;

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
    <div className="p-3 pb-6">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>description</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal leading-tight">Hợp đồng &amp; Doanh thu</h2>
            <p className="text-[11px] text-slate-400 leading-tight">Quản lý hợp đồng, theo dõi doanh thu dự kiến và thực thu.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
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

          {/* Export + Add (contracts only) */}
          {viewMode === 'CONTRACTS' && (
            <>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowExportMenu((current) => !current)}
                  disabled={isExporting}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
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
                    <div className="absolute top-full right-0 mt-1.5 w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden flex flex-col">
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
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors bg-primary text-white hover:bg-deep-teal shadow-sm"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                  Thêm mới
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2">
          {viewMode === 'CONTRACTS' && (
            <div className="flex flex-col items-center gap-2 md:flex-row">
              <div className="relative w-full md:flex-1">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>search</span>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Tìm theo mã/tên hợp đồng, khách hàng, dự án..."
                  className="w-full h-8 rounded border border-slate-200 bg-slate-50 pl-8 pr-8 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary placeholder:text-slate-400"
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
                className="w-full md:w-48"
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusFilterOptions}
                placeholder="Tất cả trạng thái"
                triggerClassName="h-8 text-xs border-slate-200 bg-slate-50 focus:border-primary"
              />
              <SearchableSelect
                className="w-full md:w-40"
                value={typeFilter}
                onChange={(v) => setTypeFilter(v as '' | 'STANDALONE' | 'ADDENDUM')}
                options={[
                  { value: '', label: 'Tất cả loại' },
                  { value: 'STANDALONE', label: 'HĐ gốc' },
                  { value: 'ADDENDUM', label: 'Phụ lục / Gia hạn' },
                ]}
                placeholder="Tất cả loại"
                triggerClassName="h-8 text-xs border-slate-200 bg-slate-50 focus:border-primary"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="shrink-0 text-[11px] font-semibold text-neutral">
              {viewMode === 'CONTRACTS' ? 'Kỳ ngày ký:' : 'Kỳ doanh thu:'}
            </span>
            <div className="flex shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-50">
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
                  className={`whitespace-nowrap border-r border-slate-200 px-2.5 py-1 text-[11px] font-semibold transition-colors last:border-r-0 ${
                    periodPreset === opt.value ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
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
                  className="h-8 w-32 rounded border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-primary/30"
                />
                <span className="text-xs text-slate-400">→</span>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(event) => setCustomDateTo(event.target.value)}
                  className="h-8 w-32 rounded border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-primary/30"
                />
              </>
            )}
            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-red-50 hover:text-error"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>filter_list_off</span>
                Xóa lọc
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI cards ── */}
      {viewMode === 'CONTRACTS' && (isContractsPageLoading ? renderLoadingKpis() : (
        <div className="mb-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>date_range</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              Kỳ: {periodLabel}
            </span>
            <span className="hidden text-[10px] text-slate-400 sm:inline">· lọc theo ngày ký</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            {/* Tổng HĐ */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="truncate text-[11px] font-semibold text-neutral">Tổng hợp đồng</p>
              <p className="mt-1 text-xl font-black text-deep-teal">{totalContractsKpi.toLocaleString('vi-VN')}</p>
              <p className="mt-0.5 truncate text-[10px] text-slate-400">
                {draftCount} nháp · {renewedCount} gia hạn
                {(() => {
                  const rate = contractsPageMeta?.kpis?.continuity_rate;
                  if (rate == null) return null;
                  return (
                    <span className="ml-1 font-medium text-success" title="Tỷ lệ tiếp tục">
                      · {rate}% tiếp tục
                    </span>
                  );
                })()}
              </p>
            </div>

            {/* Ký kết trong kỳ */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
              <p className="truncate text-[11px] font-semibold text-emerald-700">Ký kết trong kỳ</p>
              <p className="mt-1 text-xl font-black text-emerald-800">{newSignedCount.toLocaleString('vi-VN')}</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-emerald-200">
                <div className="h-full rounded-full bg-success transition-all" style={{ width: `${newSignedPercent}%` }} />
              </div>
            </div>

            {/* Giá trị ký trong kỳ */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:col-span-2 xl:col-span-1">
              <p className="truncate text-[11px] font-semibold text-neutral">Giá trị HĐ ký trong kỳ</p>
              <p className="mt-1 text-sm font-black text-deep-teal leading-tight">{formatCurrency(newSignedValue)}</p>
              <p className="mt-0.5 truncate text-[10px] text-slate-400">{periodLabel}</p>
            </div>

            {/* Tổng GT HĐ đang ký */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:col-span-2 xl:col-span-1">
              <p className="truncate text-[11px] font-semibold text-neutral">Tổng GT HĐ đang ký</p>
              <p className="mt-1 text-sm font-black text-deep-teal leading-tight">{formatCurrency(aggregateKpis?.signedTotalValue ?? 0)}</p>
              <p className="mt-0.5 truncate text-[10px] text-slate-400">toàn bộ HĐ có trạng thái Đã ký</p>
            </div>

            {/* Sắp đến kỳ thanh toán */}
            {(() => {
              const upcomingCount = contractsPageMeta?.kpis?.upcoming_payment_contracts ?? 0;
              const warningDays = contractsPageMeta?.kpis?.payment_warning_days ?? 30;
              const hasUpcoming = upcomingCount > 0;
              return (
                <div className={`rounded-lg border p-3 shadow-sm ${hasUpcoming ? 'border-secondary/30 bg-secondary/5' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center justify-between">
                    <p className={`truncate text-[11px] font-semibold ${hasUpcoming ? 'text-secondary' : 'text-neutral'}`}>
                      Sắp đến kỳ TT
                    </p>
                    <span className={`material-symbols-outlined ${hasUpcoming ? 'text-secondary' : 'text-slate-300'}`} style={{ fontSize: 15 }}>payments</span>
                  </div>
                  <p className={`mt-1 text-xl font-black ${hasUpcoming ? 'text-deep-teal' : 'text-deep-teal'}`}>
                    {upcomingCount}
                  </p>
                  <p className={`mt-0.5 truncate text-[10px] ${hasUpcoming ? 'text-secondary' : 'text-slate-400'}`}>
                    trong {warningDays} ngày tới
                  </p>
                </div>
              );
            })()}

            {/* Sắp hết hiệu lực */}
            <div className={`rounded-lg border p-3 shadow-sm ${expiringSoonContractsKpi > 0 ? 'border-warning/30 bg-warning/5' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center justify-between">
                <p className={`truncate text-[11px] font-semibold ${expiringSoonContractsKpi > 0 ? 'text-tertiary' : 'text-neutral'}`}>
                  Sắp hết hiệu lực
                </p>
                <span className={`material-symbols-outlined ${expiringSoonContractsKpi > 0 ? 'text-warning' : 'text-slate-300'}`} style={{ fontSize: 15 }}>schedule</span>
              </div>
              <p className={`mt-1 text-xl font-black ${expiringSoonContractsKpi > 0 ? 'text-tertiary' : 'text-deep-teal'}`}>
                {expiringSoonContractsKpi}
              </p>
              <p className={`mt-0.5 truncate text-[10px] ${expiringSoonContractsKpi > 0 ? 'text-tertiary' : 'text-slate-400'}`}>
                trong {expiryWarningDays} ngày tới
              </p>
            </div>

            {/* Quá hạn TT */}
            <div className={`rounded-lg border p-3 shadow-sm ${overduePaymentAmount > 0 ? 'border-error/20 bg-error/5' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center justify-between">
                <p className={`truncate text-[11px] font-semibold ${overduePaymentAmount > 0 ? 'text-error' : 'text-neutral'}`}>
                  Quá hạn TT
                </p>
                <span className={`material-symbols-outlined ${overduePaymentAmount > 0 ? 'text-error' : 'text-slate-300'}`} style={{ fontSize: 15 }}>money_off</span>
              </div>
              <p className={`mt-1 text-sm font-black leading-tight ${overduePaymentAmount > 0 ? 'text-error' : 'text-deep-teal'}`}>
                {formatCurrency(overduePaymentAmount)}
              </p>
              <p className={`mt-0.5 truncate text-[10px] ${overduePaymentAmount > 0 ? 'text-error' : 'text-slate-400'}`}>
                {overduePaymentAmount > 0 ? 'cần đôn đốc thu' : 'không có quá hạn'}
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* ── Table / Revenue view ── */}
      <div>
        {viewMode === 'CONTRACTS' ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
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
                        className="cursor-pointer select-none px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-100"
                        onClick={() => handleSort(col.key as keyof Contract)}
                      >
                        <div className="flex items-center gap-0.5">
                          <span className="text-deep-teal">{col.label}</span>
                          {renderSortIcon(col.key as keyof Contract)}
                        </div>
                      </th>
                    ))}
                    {showActionColumn && (
                      <th className="sticky right-0 bg-slate-50 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
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
                      <tr key={item.id} className="transition-colors hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-3 py-2 text-xs font-mono font-bold text-slate-600">
                          {item.contract_code}
                          {item.parent_contract_id != null && (
                            <span
                              className="ml-1.5 inline-flex items-center rounded bg-deep-teal/10 px-1 py-0.5 text-[10px] font-bold leading-none text-deep-teal"
                              title="Phụ lục / Gia hạn"
                            >
                              PL
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold text-slate-900">
                          <div className="max-w-[200px] truncate" title={item.contract_name}>{item.contract_name}</div>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">
                          <div className="max-w-[180px] truncate" title={getCustomerName(item.customer_id)}>{getCustomerName(item.customer_id)}</div>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">
                          <div className="max-w-[180px] truncate" title={getProjectName(item.project_id)}>{getProjectName(item.project_id)}</div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">{getPaymentCycleLabel(item.payment_cycle)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs font-bold text-slate-900">{formatCurrency(resolveContractValue(item))}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{formatDate(item.effective_date || null)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{formatDate(item.expiry_date || null)}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${getStatusColor(item.status)}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{getStatusIcon(item.status)}</span>
                            {getStatusLabel(item.status)}
                          </span>
                        </td>
                        {showActionColumn && (
                          <td className="sticky right-0 bg-white px-3 py-2 text-right shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]">
                            <div className="flex justify-end gap-1">
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => onOpenModal('EDIT_CONTRACT', item)}
                                  className="rounded p-1 text-slate-400 transition-colors hover:text-primary hover:bg-slate-100"
                                  title="Chỉnh sửa"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => onOpenModal('DELETE_CONTRACT', item)}
                                  className="rounded p-1 text-slate-400 transition-colors hover:text-error hover:bg-slate-100"
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
                            <p className="text-xs font-semibold text-slate-700">Chưa có hợp đồng nào.</p>
                            <p className="mt-0.5 text-[11px] text-slate-400">Bắt đầu bằng cách thêm mới hợp đồng đầu tiên.</p>
                          </div>
                          {canAdd && (
                            <button
                              type="button"
                              onClick={() => onOpenModal('ADD_CONTRACT')}
                              className="inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-deep-teal shadow-sm"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                              Thêm mới
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
              onNotify={onNotify}
            />
          </div>
        )}
      </div>
    </div>
  );
};
