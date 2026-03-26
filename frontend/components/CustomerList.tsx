import React, { useEffect, useMemo, useState } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import { Customer, CustomerAggregateKpis, ModalType, PaginatedQuery, PaginationMeta } from '../types';
import { PaginationControls } from './PaginationControls';
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
  { value: 'tax_code:asc', label: 'Mã số thuế tăng dần' },
  { value: 'tax_code:desc', label: 'Mã số thuế giảm dần' },
  { value: 'created_at:asc', label: 'Ngày tạo cũ nhất' },
  { value: 'created_at:desc', label: 'Ngày tạo mới nhất' },
];

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
}) => {
  const serverMode = Boolean(onQueryChange && paginationMeta);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<CustomerSortConfig | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);

  useEscKey(() => {
    setShowImportMenu(false);
    setShowExportMenu(false);
  }, showImportMenu || showExportMenu);

  const showActionColumn = canEdit || canDelete;
  const hasActiveFilters = searchTerm.trim() !== '';

  const filteredCustomers = useMemo(() => {
    if (serverMode) {
      return customers || [];
    }

    let result = (customers || []).filter((customer) => {
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
        let aValue: unknown = a[sortConfig.key];
        let bValue: unknown = b[sortConfig.key];

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
  }, [serverMode, customers, searchTerm, sortConfig]);

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
    });
  }, [serverMode, onQueryChange, currentPage, rowsPerPage, searchTerm, sortConfig]);

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
    const headers = ['Mã khách hàng', 'Tên khách hàng', 'Mã số thuế', 'Địa chỉ'];
    const sampleRows = [
      ['KH001', 'Công ty A', '0101234567', 'Hà Nội'],
      ['KH002', 'Công ty B', '0109876543', 'TP. Hồ Chí Minh'],
    ];
    downloadExcelTemplate('mau_nhap_khach_hang', 'KhachHang', headers, sampleRows);
  };

  const handleExport = (type: 'excel' | 'csv' | 'pdf') => {
    setShowExportMenu(false);
    const headers = ['Mã KH', 'Tên Khách Hàng', 'Mã số thuế', 'Địa chỉ', 'Ngày tạo'];
    const rows = filteredCustomers.map((row) => [
      row.customer_code,
      row.customer_name,
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

  return (
    <div className="px-4 pt-0 space-y-3 pb-20 md:pb-8">
      <section className="bg-white rounded-b-lg border border-gray-200 border-t-0 px-4 py-4 space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Khách hàng</h2>
            <p className="text-sm text-slate-500">Quản lý thông tin khách hàng và đối tác kinh doanh theo cùng ngôn ngữ giao diện Quản trị Doanh thu.</p>
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

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Tìm kiếm mã khách hàng, tên khách hàng, mã số thuế..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:flex xl:w-auto xl:flex-wrap xl:items-center">
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
            <p className="text-xs text-slate-500">Từ khóa: "{searchTerm.trim()}"</p>
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Tổng khách hàng</p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">
                {(serverMode ? (paginationMeta?.total ?? 0) : customers.length).toLocaleString('vi-VN')}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {(aggregateKpis?.newThisMonth ?? 0) > 0
                  ? `+${aggregateKpis!.newThisMonth} tháng này`
                  : 'khách hàng đang quản lý'}
              </p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <span className="material-symbols-outlined">groups_2</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Đang có HĐ</p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">
                {(aggregateKpis?.customersWithActiveContracts ?? 0).toLocaleString('vi-VN')}
              </p>
              <p className="mt-1 text-xs text-slate-400">HĐ ký kết + gia hạn</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <span className="material-symbols-outlined">description</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">GT HĐ đang TH</p>
              <p className="mt-4 text-2xl font-semibold leading-tight text-slate-900">
                {((aggregateKpis?.totalActiveContractValue ?? 0) / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ đ
              </p>
              <p className="mt-1 text-xs text-slate-400">Tổng giá trị HĐ active</p>
            </div>
            <div className="rounded-2xl bg-sky-50 p-3 text-sky-600">
              <span className="material-symbols-outlined">payments</span>
            </div>
          </div>
        </div>

        {(() => {
          const count = aggregateKpis?.customersWithOpenOpportunities ?? 0;
          const val = aggregateKpis?.openOppValue ?? 0;

          return (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Cơ hội mở</p>
                  <p className="mt-4 text-3xl font-semibold text-slate-900">{count.toLocaleString('vi-VN')}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {val > 0
                      ? `${(val / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} tr pipeline`
                      : 'đang theo dõi'}
                  </p>
                </div>
                <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
                  <span className="material-symbols-outlined">trending_up</span>
                </div>
              </div>
            </div>
          );
        })()}

        {(() => {
          const count = aggregateKpis?.customersWithOpenCrc ?? 0;

          return (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Có YC đang XL</p>
                  <p className="mt-4 text-3xl font-semibold text-slate-900">{count.toLocaleString('vi-VN')}</p>
                  <p className="mt-1 text-xs text-slate-400">{count > 0 ? 'case chưa đóng' : 'không có case mở'}</p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                  <span className="material-symbols-outlined">support_agent</span>
                </div>
              </div>
            </div>
          );
        })()}

        {(() => {
          const count = aggregateKpis?.customersWithoutContracts ?? 0;

          return (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Chưa có HĐ</p>
                  <p className="mt-4 text-3xl font-semibold text-slate-900">{count.toLocaleString('vi-VN')}</p>
                  <p className="mt-1 text-xs text-slate-400">{count > 0 ? 'tiềm năng phát triển' : 'tất cả đang có HĐ'}</p>
                </div>
                <div className="rounded-2xl bg-rose-50 p-3 text-rose-600">
                  <span className="material-symbols-outlined">person_add</span>
                </div>
              </div>
            </div>
          );
        })()}
      </section>

      <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-gray-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Danh sách khách hàng</h3>
            <p className="text-sm text-slate-500">
              {serverMode ? (paginationMeta?.total || currentData.length) : filteredCustomers.length} kết quả
              {hasActiveFilters ? ' theo bộ lọc hiện tại' : ' trong toàn bộ danh sách'}
            </p>
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
                      <p className="mt-1 font-mono text-sm font-bold text-slate-600">{item.customer_code}</p>
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

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                className={`w-full table-fixed border-collapse text-left ${showActionColumn ? 'min-w-[1240px]' : 'min-w-[1120px]'}`}
              >
                <thead className="border-y border-gray-200 bg-gray-50">
                  <tr>
                    {[
                      { label: 'Mã khách hàng', key: 'customer_code', widthClassName: 'w-[180px] min-w-[180px]' },
                      { label: 'Tên khách hàng', key: 'customer_name', widthClassName: 'w-[320px] min-w-[320px]' },
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
                      <td className="px-4 py-3 align-top text-sm font-mono font-bold text-slate-500">{item.customer_code}</td>
                      <td className="px-4 py-3 align-top text-sm font-semibold text-slate-900">
                        <div className="max-w-[288px] whitespace-normal break-words leading-6">{item.customer_name}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm font-mono text-slate-600">{item.tax_code || '--'}</td>
                      <td className="px-4 py-3 align-top text-sm text-slate-600" title={item.address || ''}>
                        <div className="max-w-[270px] whitespace-normal break-words leading-6">{item.address || '--'}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-slate-600">{formatDateDdMmYyyy(item.created_at)}</td>
                      {showActionColumn ? (
                        <td className="sticky right-[72px] bg-white px-4 py-3 text-right align-top shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.08)]">
                          {renderActionButtons(item)}
                        </td>
                      ) : null}
                      <td className="sticky right-0 bg-white px-4 py-3 text-center align-top shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.08)]">
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
