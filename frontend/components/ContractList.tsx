import React, { useEffect, useMemo, useState } from 'react';
import {
  Contract,
  ContractAggregateKpis,
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

interface ContractListQuery extends PaginatedQuery {
  filters?: {
    status?: string;
  };
}

interface ContractListProps {
  contracts: Contract[];
  projects: Project[];
  customers: Customer[];
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

export const ContractList: React.FC<ContractListProps> = ({
  contracts = [],
  projects = [],
  customers = [],
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
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Contract; direction: 'asc' | 'desc' } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEscKey(() => setShowExportMenu(false), showExportMenu);

  const showActionColumn = canEdit || canDelete;
  const tableColSpan = showActionColumn ? 10 : 9;
  const hasActiveFilter = searchInput.trim() !== '' || statusFilter !== '';

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

      return matchesSearch && matchesStatus;
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

  const signedContractsKpi = (() => {
    const value = Number(paginationMeta?.kpis?.signed);
    if (Number.isFinite(value) && value >= 0) return Math.floor(value);
    return (contracts || []).filter((contract) => contract.status === 'SIGNED').length;
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

  const upcomingPaymentCustomersKpi = (() => {
    const value = Number(paginationMeta?.kpis?.upcoming_payment_customers);
    if (Number.isFinite(value) && value >= 0) return Math.floor(value);
    return 0;
  })();

  const paymentWarningDays = (() => {
    const value = Number(paginationMeta?.kpis?.payment_warning_days);
    if (Number.isFinite(value) && value > 0) return Math.floor(value);
    return 30;
  })();

  const draftCount = aggregateKpis?.draftCount ?? (contracts || []).filter((contract) => contract.status === 'DRAFT').length;
  const renewedCount = aggregateKpis?.renewedCount ?? (contracts || []).filter((contract) => contract.status === 'RENEWED').length;
  const signedTotalValue = aggregateKpis?.signedTotalValue
    ?? (contracts || [])
      .filter((contract) => contract.status === 'SIGNED')
      .reduce((sum, contract) => sum + resolveContractValue(contract), 0);
  const collectionRate = clampPercent(aggregateKpis?.collectionRate ?? 0);
  const signedPercent = safePercent(signedContractsKpi, totalContractsKpi);

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
  }, [statusFilter]);

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
      q: debouncedSearchTerm.trim(),
      sort_by: sortConfig?.key ? String(sortConfig.key) : 'id',
      sort_dir: sortConfig?.direction || 'desc',
      filters: {
        status: statusFilter,
      },
    });
  }, [serverMode, onQueryChange, currentPage, rowsPerPage, debouncedSearchTerm, statusFilter, sortConfig]);

  const currentData = serverMode
    ? (contracts || [])
    : filteredContracts.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const isEmptyData = !isLoading && totalContractsKpi === 0 && !hasActiveFilter;
  const isFilterNoMatch = !isLoading && !isEmptyData && currentData.length === 0;

  const resetFilters = () => {
    setSearchInput('');
    setDebouncedSearchTerm('');
    setStatusFilter('');
    setCurrentPage(1);
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
        'Chu kỳ TT',
        'Giá trị HĐ',
        'Ngày ký',
        'Ngày hiệu lực',
        'Trạng thái',
      ];
      const rows = dataToExport.map((item) => [
        item.contract_code,
        item.contract_name,
        getCustomerName(item.customer_id),
        getProjectName(item.project_id),
        getPaymentCycleLabel(item.payment_cycle),
        formatCurrency(resolveContractValue(item)),
        formatDate(item.sign_date || null),
        formatDate(item.effective_date || null),
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
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={`contract-kpi-large-${index}`} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="h-4 w-36 rounded bg-slate-200 animate-pulse" />
            <div className="mt-4 h-8 w-40 rounded bg-slate-200 animate-pulse" />
            <div className="mt-4 h-2 w-full rounded bg-slate-200 animate-pulse" />
            <div className="mt-3 h-3 w-48 rounded bg-slate-200 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8 animate-fade-in" style={{ animationDelay: '0.15s' }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`contract-kpi-small-${index}`} className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="h-4 w-28 rounded bg-slate-200 animate-pulse" />
              <div className="h-10 w-10 rounded-lg bg-slate-200 animate-pulse" />
            </div>
            <div className="h-8 w-16 rounded bg-slate-200 animate-pulse" />
            <div className="mt-3 h-2 w-full rounded bg-slate-200 animate-pulse" />
            <div className="mt-2 h-3 w-24 rounded bg-slate-200 animate-pulse" />
          </div>
        ))}
      </div>
    </>
  );

  const renderLoadingRows = () =>
    Array.from({ length: 5 }).map((_, index) => (
      <tr key={`contract-skeleton-${index}`}>
        {Array.from({ length: tableColSpan }).map((__, cellIndex) => (
          <td key={`contract-skeleton-${index}-${cellIndex}`} className="px-6 py-4">
            <div className={`h-4 rounded bg-slate-200 animate-pulse ${
              cellIndex === 1 ? 'w-40' : cellIndex === tableColSpan - 1 ? 'w-16 ml-auto' : 'w-24'
            }`} />
          </td>
        ))}
      </tr>
    ));

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8">
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8 animate-fade-in">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Quản lý Hợp đồng</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý và theo dõi các hợp đồng kinh tế của dự án.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
        </div>
      </header>

      {isLoading ? renderLoadingKpis() : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-[0.18em]">Tổng giá trị HĐ đã ký</p>
                  <p className="text-2xl md:text-3xl font-black text-slate-900 mt-2">{formatCurrency(signedTotalValue)}</p>
                </div>
                <span className="p-3 bg-emerald-50 text-emerald-600 rounded-xl material-symbols-outlined">contract_edit</span>
              </div>
              <p className="text-xs text-slate-500 mt-4">Tổng giá trị của các hợp đồng đang ở trạng thái đã ký kết.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 shrink-0">
                  <svg viewBox="0 0 100 100" className="h-20 w-20 -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#16a34a"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${collectionRate * 2.51} 251`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-black text-slate-900">{collectionRate}%</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-[0.18em]">Tỷ lệ thu tiền</p>
                  <p className="text-xl font-black text-slate-900 mt-2">Đã thu theo kế hoạch dòng tiền</p>
                  <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${collectionRate}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Tỷ lệ tổng tiền đã thu đủ trên tổng giá trị các kỳ thanh toán dự kiến.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8 animate-fade-in" style={{ animationDelay: '0.15s' }}>
            <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-500">Tổng số hợp đồng</p>
                <span className="p-2 bg-blue-50 text-blue-600 rounded-lg material-symbols-outlined">description</span>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-slate-900">{totalContractsKpi}</p>
              <p className="text-xs text-slate-400 mt-2">{draftCount} đang soạn · {renewedCount} đã gia hạn</p>
            </div>

            <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-500">Đã ký kết</p>
                <span className="p-2 bg-green-50 text-green-600 rounded-lg material-symbols-outlined">verified</span>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-slate-900">{signedContractsKpi}</p>
              <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${signedPercent}%` }} />
              </div>
              <p className="text-xs text-slate-400 mt-2">{signedPercent}% tổng HĐ</p>
            </div>

            <div className={`p-5 md:p-6 rounded-xl border shadow-sm ${
              expiringSoonContractsKpi > 0
                ? 'bg-orange-50 border-orange-200'
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-500">Sắp hết hiệu lực ({expiryWarningDays} ngày)</p>
                <span className={`p-2 rounded-lg material-symbols-outlined ${
                  expiringSoonContractsKpi > 0 ? 'bg-white text-orange-600' : 'bg-orange-50 text-orange-600'
                }`}>
                  warning
                </span>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-slate-900">{expiringSoonContractsKpi}</p>
              <p className="text-xs text-slate-400 mt-2">
                {expiringSoonContractsKpi > 0 ? 'Cần rà soát gia hạn hoặc tái ký sớm.' : 'Không có hợp đồng nào cần lưu ý ngay.'}
              </p>
            </div>

            <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-500">Khách hàng sắp thanh toán ({paymentWarningDays} ngày)</p>
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg material-symbols-outlined">payments</span>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-slate-900">{upcomingPaymentCustomersKpi}</p>
              <p className="text-xs text-slate-400 mt-2">Số khách hàng có kỳ thanh toán dự kiến đến hạn sớm.</p>
            </div>
          </div>
        </>
      )}

      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-col md:flex-row gap-4 items-center">
          <div className="w-full md:flex-1 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tìm theo mã/tên hợp đồng, khách hàng, dự án..."
              className="w-full pl-10 pr-10 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none"
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
          {hasActiveFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="w-full md:w-auto flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-red-600 bg-slate-100 hover:bg-red-50 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-sm">filter_list_off</span>
              Xóa lọc
            </button>
          )}
        </div>

        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className={`w-full text-left border-collapse ${showActionColumn ? 'min-w-[1460px]' : 'min-w-[1320px]'}`}>
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  {[
                    { label: 'Mã hợp đồng', key: 'contract_code' },
                    { label: 'Tên hợp đồng', key: 'contract_name' },
                    { label: 'Khách hàng', key: 'customer_id' },
                    { label: 'Dự án', key: 'project_id' },
                    { label: 'Chu kỳ TT', key: 'payment_cycle' },
                    { label: 'Giá trị HĐ', key: 'value' },
                    { label: 'Ngày ký', key: 'sign_date' },
                    { label: 'Ngày hiệu lực', key: 'effective_date' },
                    { label: 'Trạng thái', key: 'status' },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
                      onClick={() => handleSort(col.key as keyof Contract)}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-deep-teal">{col.label}</span>
                        {renderSortIcon(col.key as keyof Contract)}
                      </div>
                    </th>
                  ))}
                  {showActionColumn && (
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right bg-slate-50 sticky right-0">
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
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono font-bold text-slate-600">{item.contract_code}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900 truncate max-w-[250px]" title={item.contract_name}>
                        {item.contract_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[220px]" title={getCustomerName(item.customer_id)}>
                        {getCustomerName(item.customer_id)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[220px]" title={getProjectName(item.project_id)}>
                        {getProjectName(item.project_id)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{getPaymentCycleLabel(item.payment_cycle)}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{formatCurrency(resolveContractValue(item))}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatDate(item.sign_date || null)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatDate(item.effective_date || null)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(item.status)}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{getStatusIcon(item.status)}</span>
                          {getStatusLabel(item.status)}
                        </span>
                      </td>
                      {showActionColumn && (
                        <td className="px-6 py-4 text-right sticky right-0 bg-white shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
                          <div className="flex justify-end gap-2">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => onOpenModal('EDIT_CONTRACT', item)}
                                className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                                title="Chỉnh sửa"
                              >
                                <span className="material-symbols-outlined text-lg">edit</span>
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => onOpenModal('DELETE_CONTRACT', item)}
                                className="p-1.5 text-slate-400 hover:text-error transition-colors"
                                title="Xóa"
                              >
                                <span className="material-symbols-outlined text-lg">delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : isEmptyData ? (
                  <tr>
                    <td colSpan={tableColSpan} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-500">
                        <span className="material-symbols-outlined text-4xl text-slate-300">description</span>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Chưa có hợp đồng nào.</p>
                          <p className="text-sm text-slate-500 mt-1">Bắt đầu bằng cách thêm mới hợp đồng đầu tiên.</p>
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
                    <td colSpan={tableColSpan} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-500">
                        <span className="material-symbols-outlined text-4xl text-slate-300">filter_list_off</span>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Không tìm thấy hợp đồng phù hợp.</p>
                          <p className="text-sm text-slate-500 mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
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
