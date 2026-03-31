import React, { useEffect, useMemo, useState } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import { Customer, CustomerAggregateKpis, ModalType, PaginatedQuery, PaginationMeta } from '../types';
import { PaginationControls } from './PaginationControls';
import { SearchableMultiSelect } from './SearchableMultiSelect';
import {
  CUSTOMER_SECTOR_OPTIONS,
  getCustomerGroupDisplay,
  resolveCustomerSector,
  resolveHealthcareFacilityType,
} from '../utils/customerClassification';
import { downloadExcelTemplate } from '../utils/excelTemplate';
import { formatDateDdMmYyyy } from '../utils/dateDisplay';
import { exportCsv, exportExcel, exportPdfTable, isoDateStamp } from '../utils/exportUtils';

interface CustomerListQuery extends PaginatedQuery {}

interface CustomerListProps {
  customers: Customer[];
  onOpenModal: (type: ModalType, item?: Customer) => void;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
  paginationMeta?: PaginationMeta;
  isLoading?: boolean;
  onQueryChange?: (query: CustomerListQuery) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canImport?: boolean;
  aggregateKpis?: CustomerAggregateKpis;
}

type CustomerSortDirection = 'asc' | 'desc';
type CustomerSortKey = keyof Customer;
type CustomerSortConfig = { key: CustomerSortKey; direction: CustomerSortDirection };

const RESPONSIVE_SORT_OPTIONS: Array<{
  value: string;
  label: string;
}> = [
  { value: '', label: 'Mặc định' },
  { value: 'customer_code:asc', label: 'Mã khách hàng A-Z' },
  { value: 'customer_code:desc', label: 'Mã khách hàng Z-A' },
  { value: 'customer_name:asc', label: 'Tên khách hàng A-Z' },
  { value: 'customer_name:desc', label: 'Tên khách hàng Z-A' },
  { value: 'customer_sector:asc', label: 'Nhóm khách hàng A-Z' },
  { value: 'customer_sector:desc', label: 'Nhóm khách hàng Z-A' },
  { value: 'tax_code:asc', label: 'Mã số thuế tăng dần' },
  { value: 'tax_code:desc', label: 'Mã số thuế giảm dần' },
  { value: 'created_at:asc', label: 'Ngày tạo cũ nhất' },
  { value: 'created_at:desc', label: 'Ngày tạo mới nhất' },
];

const CUSTOMER_GROUP_BADGE_CLASS_BY_SECTOR: Record<string, string> = {
  HEALTHCARE: 'bg-sky-100 text-sky-700',
  GOVERNMENT: 'bg-indigo-100 text-indigo-700',
  INDIVIDUAL: 'bg-emerald-100 text-emerald-700',
  OTHER: 'bg-slate-100 text-slate-700',
};

const EMPTY_HEALTHCARE_BREAKDOWN: CustomerAggregateKpis['healthcareBreakdown'] = {
  publicHospital: 0,
  privateHospital: 0,
  medicalCenter: 0,
  privateClinic: 0,
  tytPkdk: 0,
  other: 0,
};

const HEALTHCARE_BREAKDOWN_LABELS: Array<{
  key: keyof CustomerAggregateKpis['healthcareBreakdown'];
  label: string;
  accentClassName: string;
}> = [
  { key: 'publicHospital', label: 'Bệnh viện công lập', accentClassName: 'text-blue-700 bg-blue-50 border-blue-100' },
  { key: 'privateHospital', label: 'Bệnh viện tư nhân', accentClassName: 'text-cyan-700 bg-cyan-50 border-cyan-100' },
  { key: 'medicalCenter', label: 'Trung tâm Y tế', accentClassName: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
  { key: 'privateClinic', label: 'Phòng khám tư nhân', accentClassName: 'text-violet-700 bg-violet-50 border-violet-100' },
  { key: 'tytPkdk', label: 'TYT và PKĐK', accentClassName: 'text-amber-700 bg-amber-50 border-amber-100' },
  { key: 'other', label: 'Khác', accentClassName: 'text-slate-700 bg-slate-50 border-slate-200' },
] as const;

export const CustomerList: React.FC<CustomerListProps> = ({
  customers = [],
  onOpenModal,
  onNotify,
  paginationMeta,
  isLoading = false,
  onQueryChange,
  canEdit = false,
  canDelete = false,
  canImport = false,
  aggregateKpis,
}: CustomerListProps) => {
  const serverMode = Boolean(onQueryChange && paginationMeta);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerSectors, setSelectedCustomerSectors] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<CustomerSortConfig | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showHealthcareBreakdown, setShowHealthcareBreakdown] = useState(false);

  useEscKey(() => {
    setShowImportMenu(false);
    setShowExportMenu(false);
  }, showImportMenu || showExportMenu);

  const showActionColumn = canEdit || canDelete;
  const hasActiveFilters = searchTerm.trim() !== '' || selectedCustomerSectors.length > 0;
  const customerSectorFilterOptions = useMemo(
    () => CUSTOMER_SECTOR_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      searchText: `${option.label} ${option.description}`,
    })),
    [],
  );

  const fallbackAggregateKpis = useMemo<CustomerAggregateKpis>(() => {
    const next: CustomerAggregateKpis = {
      totalCustomers: 0,
      healthcareCustomers: 0,
      governmentCustomers: 0,
      individualCustomers: 0,
      healthcareBreakdown: { ...EMPTY_HEALTHCARE_BREAKDOWN },
    };

    for (const customer of customers) {
      const sector = resolveCustomerSector(customer);

      if (sector === 'HEALTHCARE') {
        next.healthcareCustomers += 1;

        const facilityType = resolveHealthcareFacilityType(customer) || 'OTHER';
        if (facilityType === 'PUBLIC_HOSPITAL') next.healthcareBreakdown.publicHospital += 1;
        else if (facilityType === 'PRIVATE_HOSPITAL') next.healthcareBreakdown.privateHospital += 1;
        else if (facilityType === 'MEDICAL_CENTER') next.healthcareBreakdown.medicalCenter += 1;
        else if (facilityType === 'PRIVATE_CLINIC') next.healthcareBreakdown.privateClinic += 1;
        else if (facilityType === 'TYT_PKDK') next.healthcareBreakdown.tytPkdk += 1;
        else next.healthcareBreakdown.other += 1;

        continue;
      }

      if (sector === 'GOVERNMENT') {
        next.governmentCustomers += 1;
        continue;
      }

      if (sector === 'INDIVIDUAL') {
        next.individualCustomers += 1;
      }
    }

    next.totalCustomers = next.healthcareCustomers + next.governmentCustomers + next.individualCustomers;

    return next;
  }, [customers]);

  const effectiveAggregateKpis = useMemo<CustomerAggregateKpis>(() => ({
    totalCustomers: aggregateKpis?.totalCustomers ?? fallbackAggregateKpis.totalCustomers,
    healthcareCustomers: aggregateKpis?.healthcareCustomers ?? fallbackAggregateKpis.healthcareCustomers,
    governmentCustomers: aggregateKpis?.governmentCustomers ?? fallbackAggregateKpis.governmentCustomers,
    individualCustomers: aggregateKpis?.individualCustomers ?? fallbackAggregateKpis.individualCustomers,
    healthcareBreakdown: {
      ...fallbackAggregateKpis.healthcareBreakdown,
      ...(aggregateKpis?.healthcareBreakdown || {}),
    },
  }), [aggregateKpis, fallbackAggregateKpis]);

  const healthcareBreakdownItems = useMemo(
    () => HEALTHCARE_BREAKDOWN_LABELS.filter(
      (item) => item.key !== 'other' || effectiveAggregateKpis.healthcareBreakdown.other > 0,
    ),
    [effectiveAggregateKpis.healthcareBreakdown.other],
  );

  useEffect(() => {
    if (effectiveAggregateKpis.healthcareCustomers === 0 && showHealthcareBreakdown) {
      setShowHealthcareBreakdown(false);
    }
  }, [effectiveAggregateKpis.healthcareCustomers, showHealthcareBreakdown]);

  const filteredCustomers = useMemo(() => {
    if (serverMode) {
      return customers || [];
    }

    let result = (customers || []).filter((customer) => {
      if (selectedCustomerSectors.length > 0) {
        const sector = resolveCustomerSector(customer);
        if (!selectedCustomerSectors.includes(sector)) {
          return false;
        }
      }

      const normalizedSearch = searchTerm.trim().toLowerCase();
      if (!normalizedSearch) {
        return true;
      }

      return (
        String(customer.customer_name || '').toLowerCase().includes(normalizedSearch)
        || String(customer.customer_code || '').toLowerCase().includes(normalizedSearch)
        || String(customer.tax_code || '').toLowerCase().includes(normalizedSearch)
      );
    });

    if (sortConfig !== null) {
      result = [...result].sort((a, b) => {
        let aValue: string | number | null | undefined = a[sortConfig.key] as string | number | null | undefined;
        let bValue: string | number | null | undefined = b[sortConfig.key] as string | number | null | undefined;

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
  }, [serverMode, customers, searchTerm, selectedCustomerSectors, sortConfig]);

  const totalItems = serverMode ? (paginationMeta?.total || 0) : filteredCustomers.length;
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
      sort_by: sortConfig?.key ? String(sortConfig.key) : 'customer_code',
      sort_dir: sortConfig?.direction || 'asc',
      filters: selectedCustomerSectors.length > 0
        ? { customer_sector: selectedCustomerSectors.join(',') }
        : {},
    });
  }, [serverMode, onQueryChange, currentPage, rowsPerPage, searchTerm, sortConfig, selectedCustomerSectors]);

  const currentData = serverMode
    ? (customers || [])
    : filteredCustomers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const showNoDataState = !isLoading && (
    serverMode
      ? totalItems === 0 && !hasActiveFilters
      : customers.length === 0
  );
  const showNoMatchState = !isLoading && !showNoDataState && currentData.length === 0;

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCustomerSectors([]);
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleCustomerSectorFilterChange = (values: string[]) => {
    setSelectedCustomerSectors(values);
    setCurrentPage(1);
  };

  const handleSort = (key: keyof Customer) => {
    let direction: CustomerSortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const sortSelectValue = sortConfig ? `${sortConfig.key}:${sortConfig.direction}` : '';

  const handleResponsiveSortChange = (value: string) => {
    if (!value) {
      setSortConfig(null);
      setCurrentPage(1);
      return;
    }

    const [key, direction] = value.split(':');
    if (!key) {
      setSortConfig(null);
      setCurrentPage(1);
      return;
    }

    setSortConfig({
      key: key as CustomerSortKey,
      direction: direction === 'desc' ? 'desc' : 'asc',
    });
    setCurrentPage(1);
  };

  const renderSortIcon = (key: keyof Customer) => {
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

  const handleDownloadTemplate = () => {
    setShowImportMenu(false);
    const headers = ['Mã khách hàng', 'Tên khách hàng', 'Nhóm khách hàng', 'Loại hình cơ sở y tế', 'Quy mô giường bệnh', 'Mã số thuế', 'Địa chỉ'];
    const sampleRows = [
      ['', 'Bệnh viện Đa khoa Tỉnh', 'Y tế', 'Bệnh viện (Công lập)', '500', '0101234567', 'Cần Thơ'],
      ['', 'Trạm y tế Phường 1', 'Y tế', 'TYT và PKĐK', '', '0109876543', 'Hậu Giang'],
      ['KH003', 'UBND Phường Vị Thanh', 'Chính quyền', '', '', '1800123456', 'TP. Hồ Chí Minh'],
    ];
    downloadExcelTemplate('mau_nhap_khach_hang', 'KhachHang', headers, sampleRows);
  };

  const handleExport = (type: 'excel' | 'csv' | 'pdf') => {
    setShowExportMenu(false);
    const headers = ['Mã KH', 'Tên Khách Hàng', 'Nhóm khách hàng', 'Mã số thuế', 'Địa chỉ', 'Ngày tạo'];
    const rows = filteredCustomers.map((row) => [
      row.customer_code || '',
      row.customer_name,
      getCustomerGroupDisplay(row).label,
      row.tax_code || '',
      row.address || '',
      row.created_at || '',
    ]);
    const fileName = `ds_khach_hang_${isoDateStamp()}`;

    if (type === 'excel') {
      exportExcel(fileName, 'KhachHang', headers, rows);
      return;
    }

    if (type === 'csv') {
      exportCsv(fileName, headers, rows);
      return;
    }

    const canPrint = exportPdfTable({
      fileName,
      title: 'Danh sách khách hàng',
      headers,
      rows,
      subtitle: `Ngày xuất: ${new Date().toLocaleString('vi-VN')}`,
      landscape: true,
    });

    if (!canPrint) {
      onNotify?.('error', 'Xuất dữ liệu', 'Trình duyệt đang chặn popup. Vui lòng cho phép popup để xuất PDF.');
    }
  };

  const renderActionButtons = (item: Customer, className = 'justify-end') => {
    if (!showActionColumn) {
      return null;
    }

    return (
      <div className={`flex ${className} gap-2`}>
        {canEdit ? (
          <button
            onClick={() => onOpenModal('EDIT_CUSTOMER', item)}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:text-primary"
            title="Chỉnh sửa"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
          </button>
        ) : null}
        {canDelete ? (
          <button
            onClick={() => onOpenModal('DELETE_CUSTOMER', item)}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:text-error"
            title="Xóa"
          >
            <span className="material-symbols-outlined text-lg">delete</span>
          </button>
        ) : null}
      </div>
    );
  };

  const renderDetailButton = (item: Customer, iconOnly = false) => (
    <button
      onClick={() => onOpenModal('CUSTOMER_INSIGHT', item)}
      className={`rounded-lg text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-600 ${iconOnly ? 'p-1.5' : 'inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold'}`}
      title="Xem chi tiết khách hàng 360"
    >
      <span className="material-symbols-outlined text-lg">person_search</span>
      {iconOnly ? null : <span>Khách hàng 360</span>}
    </button>
  );

  const secondaryToolbarButtonClassName =
    'inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 lg:w-auto';
  const primaryToolbarButtonClassName =
    'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 lg:w-auto';

  const renderCustomerGroup = (item: Customer, compact = false) => {
    const group = getCustomerGroupDisplay(item);
    const badgeClassName = CUSTOMER_GROUP_BADGE_CLASS_BY_SECTOR[group.sector] || CUSTOMER_GROUP_BADGE_CLASS_BY_SECTOR.OTHER;

    return (
      <div className={compact ? '' : 'min-w-0'}>
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClassName}`}>
          {group.label}
        </span>
      </div>
    );
  };

  const renderCustomerCode = (item: Customer, compact = false) => {
    const customerCode = item.customer_code || '--';

    return (
      <div className={`min-w-0 ${compact ? 'space-y-1' : 'space-y-1.5'}`}>
        <p className={`font-mono font-bold text-slate-600 ${compact ? 'text-sm' : 'text-sm'}`}>{customerCode}</p>
        {item.customer_code_auto_generated ? (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
            Tự sinh
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="px-4 pt-0 space-y-3 pb-20 md:pb-8">
      <section className="bg-white rounded-b-lg border border-gray-200 border-t-0 px-4 py-4 space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Khách hàng</h2>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end">
            {canImport && (
              <div className="relative w-full lg:w-auto">
                <button
                  onClick={() => setShowImportMenu(!showImportMenu)}
                  className={secondaryToolbarButtonClassName}
                >
                  <span className="material-symbols-outlined text-lg">upload</span>
                  <span>Nhập</span>
                  <span className="material-symbols-outlined text-sm ml-1">expand_more</span>
                </button>
                {showImportMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowImportMenu(false)} />
                    <div className="absolute top-full left-0 z-20 mt-2 flex w-48 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
                      <button
                        onClick={() => {
                          setShowImportMenu(false);
                          onOpenModal('IMPORT_DATA');
                        }}
                        className="flex items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-700"
                      >
                        <span className="material-symbols-outlined text-lg">upload_file</span>
                        Nhập dữ liệu
                      </button>
                      <button
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-3 border-t border-gray-100 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-green-600"
                      >
                        <span className="material-symbols-outlined text-lg">download</span>
                        Tải file mẫu
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="relative w-full lg:w-auto">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className={secondaryToolbarButtonClassName}
              >
                <span className="material-symbols-outlined text-lg">download</span>
                <span>Xuất</span>
                <span className="material-symbols-outlined text-sm ml-1">expand_more</span>
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute top-full right-0 z-20 mt-2 flex w-40 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
                    <button
                      onClick={() => handleExport('excel')}
                      className="flex items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-green-600"
                    >
                      <span className="material-symbols-outlined text-lg">table_view</span>
                      Excel
                    </button>
                    <button
                      onClick={() => handleExport('csv')}
                      className="flex items-center gap-3 border-t border-gray-100 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-600"
                    >
                      <span className="material-symbols-outlined text-lg">csv</span>
                      CSV
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="flex items-center gap-3 border-t border-gray-100 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-red-600"
                    >
                      <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                      PDF
                    </button>
                  </div>
                </>
              )}
            </div>

            {canEdit ? (
              <button
                onClick={() => onOpenModal('ADD_CUSTOMER')}
                className={primaryToolbarButtonClassName}
              >
                <span className="material-symbols-outlined">add</span>
                <span>Thêm khách hàng</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)_auto] xl:items-center">
          <SearchableMultiSelect
            values={selectedCustomerSectors}
            options={customerSectorFilterOptions}
            onChange={handleCustomerSectorFilterChange}
            placeholder="Nhóm khách hàng"
            searchPlaceholder="Tìm nhóm khách hàng..."
            className="min-w-0"
            triggerClassName="min-h-[42px]"
          />

          <div className="relative min-w-0">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Tìm kiếm mã khách hàng, tên khách hàng, mã số thuế..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:flex xl:w-auto xl:flex-wrap xl:items-center xl:justify-end">
            <div className="relative lg:hidden">
              <label htmlFor="customer-list-sort" className="sr-only">Sắp xếp danh sách khách hàng</label>
              <select
                id="customer-list-sort"
                value={sortSelectValue}
                onChange={(e) => handleResponsiveSortChange(e.target.value)}
                className="h-10 w-full appearance-none rounded-lg border border-gray-300 bg-white pl-3 pr-9 text-sm text-slate-700 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                aria-label="Sắp xếp danh sách khách hàng"
              >
                {RESPONSIVE_SORT_OPTIONS.map((option) => (
                  <option key={option.value || 'default'} value={option.value}>{option.label}</option>
                ))}
              </select>
              <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">
                swap_vert
              </span>
            </div>
            {hasActiveFilters ? (
              <button
                onClick={resetFilters}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-lg">filter_alt_off</span>
                Xóa bộ lọc
              </button>
            ) : null}
          </div>
        </div>

        {hasActiveFilters ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <span className="material-symbols-outlined text-sm">filter_alt</span>
              Đang lọc
            </span>
            {selectedCustomerSectors.length > 0 ? (
              <p className="text-xs text-slate-500">
                Nhóm: {customerSectorFilterOptions
                  .filter((option) => selectedCustomerSectors.includes(String(option.value)))
                  .map((option) => option.label)
                  .join(', ')}
              </p>
            ) : null}
            {searchTerm.trim() ? <p className="text-xs text-slate-500">Từ khóa: "{searchTerm.trim()}"</p> : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Tổng số khách hàng</p>
                <p className="mt-4 text-3xl font-semibold text-slate-900">
                  {effectiveAggregateKpis.totalCustomers.toLocaleString('vi-VN')}
                </p>
              </div>
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                <span className="material-symbols-outlined">groups_2</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-expanded={showHealthcareBreakdown}
            onClick={() => {
              if (effectiveAggregateKpis.healthcareCustomers === 0) {
                return;
              }
              setShowHealthcareBreakdown((previous) => !previous);
            }}
            className={`rounded-lg border bg-white p-4 text-left transition-colors ${
              effectiveAggregateKpis.healthcareCustomers > 0
                ? showHealthcareBreakdown
                  ? 'border-sky-200 bg-sky-50/60'
                  : 'border-gray-200 hover:border-sky-200 hover:bg-sky-50/40'
                : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Khách hàng Y tế</p>
                <p className="mt-4 text-3xl font-semibold text-slate-900">
                  {effectiveAggregateKpis.healthcareCustomers.toLocaleString('vi-VN')}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {effectiveAggregateKpis.healthcareCustomers > 0
                    ? (showHealthcareBreakdown ? 'Ẩn chi tiết loại hình y tế' : 'Nhấn để xem chi tiết loại hình y tế')
                    : 'Chưa có khách hàng y tế'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-2xl bg-sky-50 p-3 text-sky-600">
                  <span className="material-symbols-outlined">local_hospital</span>
                </div>
                {effectiveAggregateKpis.healthcareCustomers > 0 ? (
                  <span
                    className="material-symbols-outlined text-slate-400 transition-transform duration-200"
                    style={{ transform: showHealthcareBreakdown ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  >
                    expand_more
                  </span>
                ) : null}
              </div>
            </div>
          </button>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Chính quyền</p>
                <p className="mt-4 text-3xl font-semibold text-slate-900">
                  {effectiveAggregateKpis.governmentCustomers.toLocaleString('vi-VN')}
                </p>
              </div>
              <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
                <span className="material-symbols-outlined">account_balance</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Cá nhân</p>
                <p className="mt-4 text-3xl font-semibold text-slate-900">
                  {effectiveAggregateKpis.individualCustomers.toLocaleString('vi-VN')}
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                <span className="material-symbols-outlined">person</span>
              </div>
            </div>
          </div>
        </div>

        {showHealthcareBreakdown ? (
          <div className="rounded-lg border border-sky-100 bg-sky-50/50 p-4" data-testid="customer-healthcare-kpi-breakdown">
            <div>
              <p className="text-sm font-semibold text-slate-800">Chi tiết KPI khách hàng Y tế</p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              {healthcareBreakdownItems.map((item) => (
                <div key={item.key} className={`rounded-lg border p-3 ${item.accentClassName}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em]">{item.label}</p>
                  <p className="mt-3 text-2xl font-semibold">
                    {effectiveAggregateKpis.healthcareBreakdown[item.key].toLocaleString('vi-VN')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-gray-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Danh sách khách hàng</h3>
          </div>
          {hasActiveFilters ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <span className="material-symbols-outlined text-sm">filter_alt</span>
              Bộ lọc đang bật
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <div className="px-6 py-12 text-center text-slate-500">Đang tải dữ liệu...</div>
        ) : currentData.length > 0 ? (
          <>
            <div data-testid="customer-responsive-list" className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 md:p-5 lg:hidden">
              {currentData.map((item) => (
                <article key={`customer-card-${String(item.id)}`} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Mã khách hàng</p>
                      <div className="mt-1">{renderCustomerCode(item, true)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {renderDetailButton(item, true)}
                      {renderActionButtons(item)}
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Tên khách hàng</p>
                      <p className="mt-1 break-words text-base font-bold leading-6 text-slate-900">{item.customer_name}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Nhóm khách hàng</p>
                        <div className="mt-1">{renderCustomerGroup(item, true)}</div>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Mã số thuế</p>
                        <p className="mt-1 font-mono text-sm font-medium text-slate-700">{item.tax_code || '--'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Ngày tạo</p>
                        <p className="mt-1 text-sm font-medium text-slate-700">{formatDateDdMmYyyy(item.created_at)}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Địa chỉ</p>
                      <p className="mt-1 break-words text-sm leading-6 text-slate-600">{item.address || '--'}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table
                data-testid="customer-desktop-table"
                className={`w-full table-fixed border-collapse text-left ${showActionColumn ? 'min-w-[1490px]' : 'min-w-[1370px]'}`}
              >
                <thead className="border-y border-gray-200 bg-gray-50">
                  <tr>
                    {[
                      { label: 'Mã khách hàng', key: 'customer_code', widthClassName: 'w-[180px] min-w-[180px]' },
                      { label: 'Tên khách hàng', key: 'customer_name', widthClassName: 'w-[320px] min-w-[320px]' },
                      { label: 'Nhóm khách hàng', key: 'customer_sector', widthClassName: 'w-[240px] min-w-[240px]' },
                      { label: 'Mã số thuế', key: 'tax_code', widthClassName: 'w-[180px] min-w-[180px]' },
                      { label: 'Địa chỉ', key: 'address', widthClassName: 'w-[300px] min-w-[300px]' },
                      { label: 'Ngày tạo', key: 'created_at', widthClassName: 'w-[150px] min-w-[150px]' },
                    ].map((col) => (
                      <th
                        key={col.key}
                        className={`cursor-pointer select-none px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-100 ${col.widthClassName}`}
                        onClick={() => handleSort(col.key as keyof Customer)}
                      >
                        <div className="flex items-center gap-1">
                          <span className="text-deep-teal">{col.label}</span>
                          {renderSortIcon(col.key as keyof Customer)}
                        </div>
                      </th>
                    ))}
                    {showActionColumn ? (
                      <th className="sticky right-[72px] w-[110px] min-w-[110px] bg-gray-50 px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                        Thao tác
                      </th>
                    ) : null}
                    <th className="sticky right-0 w-[72px] min-w-[72px] bg-gray-50 px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                      Chi tiết
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {currentData.map((item) => (
                    <tr key={String(item.id)} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3 align-middle text-sm font-mono font-bold text-slate-500">
                        {renderCustomerCode(item)}
                      </td>
                      <td className="px-4 py-3 align-middle text-sm font-semibold text-slate-900">
                        <div className="max-w-[288px] whitespace-normal break-words leading-6">{item.customer_name}</div>
                      </td>
                      <td className="px-4 py-3 align-middle text-sm text-slate-600">
                        {renderCustomerGroup(item)}
                      </td>
                      <td className="px-4 py-3 align-middle text-sm font-mono text-slate-600">{item.tax_code || '--'}</td>
                      <td className="px-4 py-3 align-middle text-sm text-slate-600" title={item.address || ''}>
                        <div className="max-w-[270px] whitespace-normal break-words leading-6">{item.address || '--'}</div>
                      </td>
                      <td className="px-4 py-3 align-middle text-sm text-slate-600">{formatDateDdMmYyyy(item.created_at)}</td>
                      {showActionColumn ? (
                        <td className="sticky right-[72px] bg-white px-4 py-3 text-right align-middle shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.08)]">
                          {renderActionButtons(item)}
                        </td>
                      ) : null}
                      <td className="sticky right-0 bg-white px-4 py-3 text-center align-middle shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.08)]">
                        {renderDetailButton(item, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="px-6 py-12 text-center text-slate-500">
            <div className="flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-4xl text-slate-300">
                {showNoDataState ? 'groups_2' : 'search_off'}
              </span>
              <div className="space-y-1">
                <p className="text-base font-semibold text-slate-700">
                  {showNoDataState ? 'Chưa có khách hàng nào.' : 'Không tìm thấy khách hàng phù hợp.'}
                </p>
                <p className="text-sm text-slate-500">
                  {showNoDataState
                    ? (canEdit ? 'Nhấn "Thêm khách hàng" để bắt đầu tạo dữ liệu đầu tiên.' : 'Dữ liệu khách hàng sẽ hiển thị tại đây khi có phát sinh.')
                    : 'Thử điều chỉnh từ khóa tìm kiếm hoặc xóa bộ lọc để xem lại dữ liệu.'}
                </p>
              </div>
              {showNoDataState && canEdit ? (
                <button
                  onClick={() => onOpenModal('ADD_CUSTOMER')}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <span className="material-symbols-outlined text-lg">add</span>
                  Thêm khách hàng
                </button>
              ) : null}
              {showNoMatchState && hasActiveFilters ? (
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <span className="material-symbols-outlined text-lg">filter_alt_off</span>
                  Xóa bộ lọc
                </button>
              ) : null}
            </div>
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
      </section>
    </div>
  );
};
