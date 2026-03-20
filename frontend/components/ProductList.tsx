
import React, { useEffect, useMemo, useState } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import { Product, Business, Vendor, ModalType } from '../types';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect } from './SearchableSelect';
import { downloadExcelWorkbook } from '../utils/excelTemplate';
import { exportCsv, exportExcel, exportPdfTable, isoDateStamp } from '../utils/exportUtils';
import {
  formatProductUnitForDisplay,
  formatProductUnitForExport,
} from '../utils/productUnit';

interface ProductListProps {
  products: Product[];
  businesses: Business[];
  vendors: Vendor[];
  onOpenModal: (type: ModalType, item?: Product) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canImport?: boolean;
  canUploadDocument?: boolean;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
}

const DEFAULT_PAGE = 1;
const DEFAULT_ROWS_PER_PAGE = 10;
const PRODUCT_QUERY_KEYS = {
  search: 'products_q',
  domain: 'products_domain_id',
  sortKey: 'products_sort_key',
  sortDirection: 'products_sort_dir',
  page: 'products_page',
  rows: 'products_rows',
} as const;

const toLookupKey = (value: unknown): string => String(value ?? '').trim();

const PRODUCT_SORTABLE_KEYS: Array<keyof Product> = [
  'product_code',
  'product_name',
  'domain_id',
  'vendor_id',
  'unit',
  'standard_price',
  'is_active',
];

const isProductSortableKey = (value: string | null): value is keyof Product =>
  value !== null && PRODUCT_SORTABLE_KEYS.includes(value as keyof Product);

const parsePositiveNumber = (value: string | null, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const getBusinessDisplayName = (business: Business): string => {
  const domainName = String(business?.domain_name ?? '').trim();
  if (domainName) {
    return domainName;
  }
  const domainCode = String(business?.domain_code ?? '').trim();
  return domainCode || '-';
};

export const ProductList: React.FC<ProductListProps> = ({
  products = [],
  businesses = [],
  vendors = [],
  onOpenModal,
  canEdit = false,
  canDelete = false,
  canImport = false,
  canUploadDocument = false,
  onNotify,
}) => {
  const initialQueryState = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        searchTerm: '',
        domainFilterId: '',
        currentPage: DEFAULT_PAGE,
        rowsPerPage: DEFAULT_ROWS_PER_PAGE,
        sortConfig: null as { key: keyof Product; direction: 'asc' | 'desc' } | null,
      };
    }

    const params = new URLSearchParams(window.location.search);
    const sortKey = params.get(PRODUCT_QUERY_KEYS.sortKey);
    const sortDirectionRaw = params.get(PRODUCT_QUERY_KEYS.sortDirection);
    const sortDirection: 'asc' | 'desc' = sortDirectionRaw === 'desc' ? 'desc' : 'asc';

    return {
      searchTerm: params.get(PRODUCT_QUERY_KEYS.search) ?? '',
      domainFilterId: params.get(PRODUCT_QUERY_KEYS.domain) ?? '',
      currentPage: parsePositiveNumber(params.get(PRODUCT_QUERY_KEYS.page), DEFAULT_PAGE),
      rowsPerPage: parsePositiveNumber(params.get(PRODUCT_QUERY_KEYS.rows), DEFAULT_ROWS_PER_PAGE),
      sortConfig: isProductSortableKey(sortKey) ? { key: sortKey, direction: sortDirection } : null,
    };
  }, []);

  const [searchTerm, setSearchTerm] = useState(initialQueryState.searchTerm);
  const [searchInput, setSearchInput] = useState(initialQueryState.searchTerm);
  const [domainFilterId, setDomainFilterId] = useState(initialQueryState.domainFilterId);
  const [currentPage, setCurrentPage] = useState(initialQueryState.currentPage);
  const [rowsPerPage, setRowsPerPage] = useState(initialQueryState.rowsPerPage);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product; direction: 'asc' | 'desc' } | null>(
    initialQueryState.sortConfig
  );
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [showImportMenu, setShowImportMenu] = useState(false);
  useEscKey(() => { setShowImportMenu(false); setShowExportMenu(false); }, showImportMenu || showExportMenu);
  const showActionColumn = canEdit || canDelete;
  const tableColSpan = showActionColumn ? 9 : 8;
  const hasActiveFilters = searchTerm.trim() !== '' || domainFilterId !== '';

  const domainMap = useMemo(
    () =>
      new Map(
        (businesses || []).map((business) => [
          toLookupKey(business.id),
          getBusinessDisplayName(business),
        ])
      ),
    [businesses]
  );

  const vendorMap = useMemo(
    () =>
      new Map(
        (vendors || []).map((vendor) => [
          toLookupKey(vendor.id),
          `${vendor.vendor_code} - ${vendor.vendor_name}`,
        ])
      ),
    [vendors]
  );

  const getDomainName = (id: string | number | null | undefined): string => {
    const key = toLookupKey(id);
    if (!key) {
      return '-';
    }
    return domainMap.get(key) || '-';
  };

  const getVendorName = (id: string | number | null | undefined): string => {
    const key = toLookupKey(id);
    if (!key) {
      return '-';
    }
    return vendorMap.get(key) || '-';
  };

  const formatVnd = (value: unknown): string => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return '0 đ';
    }

    const hasDecimal = Math.abs(numeric % 1) > 0;
    return `${numeric.toLocaleString('vi-VN', {
      minimumFractionDigits: hasDecimal ? 2 : 0,
      maximumFractionDigits: 2,
    })} đ`;
  };

  const productCountByDomain = useMemo(() => {
    const counts = new Map<string, { key: string; label: string; count: number }>();

    (businesses || []).forEach((business) => {
      const key = toLookupKey(business.id);
      counts.set(key, {
        key,
        label: getBusinessDisplayName(business),
        count: 0,
      });
    });

    (products || []).forEach((product) => {
      const key = toLookupKey(product.domain_id);
      if (!key) {
        return;
      }

      const current = counts.get(key);
      if (current) {
        current.count += 1;
        return;
      }

      counts.set(key, {
        key,
        label: 'Không xác định',
        count: 1,
      });
    });

    return Array.from(counts.values()).sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.label.localeCompare(b.label, 'vi');
    });
  }, [products, businesses]);

  const activeCount = useMemo(
    () => (products || []).filter((product) => product.is_active !== false).length,
    [products]
  );
  const inactiveCount = products.length - activeCount;

  const domainFilterOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả lĩnh vực KD' },
      ...(businesses || []).map((business) => ({
        value: toLookupKey(business.id),
        label: getBusinessDisplayName(business),
      })),
    ],
    [businesses]
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    let result = (products || []).filter((product) => {
      const matchesSearch =
        normalizedSearch === '' ||
        String(product.product_name || '').toLowerCase().includes(normalizedSearch) ||
        String(product.product_code || '').toLowerCase().includes(normalizedSearch);
      const matchesDomain = domainFilterId === '' || toLookupKey(product.domain_id) === domainFilterId;
      return matchesSearch && matchesDomain;
    });

    if (sortConfig !== null) {
      result = [...result].sort((a, b) => {
        let aValue: string | number | boolean | null | undefined = a[sortConfig.key];
        let bValue: string | number | boolean | null | undefined = b[sortConfig.key];

        if (sortConfig.key === 'domain_id') {
          aValue = getDomainName(a.domain_id);
          bValue = getDomainName(b.domain_id);
        } else if (sortConfig.key === 'vendor_id') {
          aValue = getVendorName(a.vendor_id);
          bValue = getVendorName(b.vendor_id);
        } else if (sortConfig.key === 'unit') {
          aValue = formatProductUnitForDisplay(a.unit);
          bValue = formatProductUnitForDisplay(b.unit);
        } else if (sortConfig.key === 'is_active') {
          aValue = a.is_active !== false ? 1 : 0;
          bValue = b.is_active !== false ? 1 : 0;
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
  }, [products, searchTerm, domainFilterId, sortConfig, domainMap, vendorMap]);

  const totalItems = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const effectiveCurrentPage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (searchInput === searchTerm) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(DEFAULT_PAGE);
    }, 300);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [searchInput, searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const syncQueryValue = (key: string, value: string, fallbackValue = '') => {
      if (value === fallbackValue) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    };

    syncQueryValue(PRODUCT_QUERY_KEYS.search, searchTerm.trim());
    syncQueryValue(PRODUCT_QUERY_KEYS.domain, domainFilterId);
    syncQueryValue(PRODUCT_QUERY_KEYS.page, String(currentPage), String(DEFAULT_PAGE));
    syncQueryValue(PRODUCT_QUERY_KEYS.rows, String(rowsPerPage), String(DEFAULT_ROWS_PER_PAGE));
    syncQueryValue(PRODUCT_QUERY_KEYS.sortKey, sortConfig?.key ? String(sortConfig.key) : '');
    syncQueryValue(PRODUCT_QUERY_KEYS.sortDirection, sortConfig?.direction || '');

    const queryString = params.toString();
    const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, '', nextUrl);
    }
  }, [searchTerm, domainFilterId, currentPage, rowsPerPage, sortConfig]);

  const currentData = filteredProducts.slice((effectiveCurrentPage - 1) * rowsPerPage, effectiveCurrentPage * rowsPerPage);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleSort = (key: keyof Product) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(DEFAULT_PAGE);
  };

  const renderSortIcon = (key: keyof Product) => {
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
    const defaultDomainCode = businesses?.[0]?.domain_code || 'KD001';
    const defaultVendorCode = vendors?.[0]?.vendor_code || 'DT001';

    downloadExcelWorkbook('mau_nhap_san_pham', [
      {
        name: 'Products',
        headers: ['Mã sản phẩm', 'Tên sản phẩm', 'Mã lĩnh vực', 'Mã nhà cung cấp', 'Đơn giá chuẩn (VNĐ)', 'Đơn vị tính'],
        rows: [
          ['VNPT_HIS', 'Giải pháp VNPT HIS', defaultDomainCode, defaultVendorCode, '150000000', 'Gói'],
          ['SOC_MONITOR', 'Dịch vụ giám sát SOC', defaultDomainCode, defaultVendorCode, '80000000', 'Gói'],
        ],
      },
      {
        name: 'LinhVuc',
        headers: ['ID', 'Mã lĩnh vực', 'Tên lĩnh vực'],
        rows: (businesses || []).map((business) => [business.id, business.domain_code, business.domain_name]),
      },
      {
        name: 'NhaCungCap',
        headers: ['ID', 'Mã nhà cung cấp', 'Tên nhà cung cấp'],
        rows: (vendors || []).map((vendor) => [vendor.id, vendor.vendor_code, vendor.vendor_name]),
      },
    ]);
  };

  const handleExport = (type: 'excel' | 'csv' | 'pdf') => {
    setShowExportMenu(false);
    const headers = ['Mã SP', 'Tên SP', 'Lĩnh vực KD', 'Nhà cung cấp', 'Đơn vị tính', 'Đơn giá', 'Trạng thái'];
    const rows = filteredProducts.map((row) => [
      row.product_code,
      row.product_name,
      getDomainName(row.domain_id),
      getVendorName(row.vendor_id),
      formatProductUnitForExport(row.unit),
      formatVnd(row.standard_price),
      row.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động',
    ]);
    const fileName = `ds_san_pham_${isoDateStamp()}`;

    if (type === 'excel') {
      exportExcel(fileName, 'SanPham', headers, rows);
      return;
    }

    if (type === 'csv') {
      exportCsv(fileName, headers, rows);
      return;
    }

    const canPrint = exportPdfTable({
      fileName,
      title: 'Danh sach san pham',
      headers,
      rows,
      subtitle: `Ngay xuat: ${new Date().toLocaleString('vi-VN')}`,
      landscape: true,
    });

    if (!canPrint) {
      onNotify?.('error', 'Xuất PDF', 'Trình duyệt đang chặn popup. Vui lòng cho phép popup để xuất PDF.');
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setSearchTerm('');
    setDomainFilterId('');
    setCurrentPage(DEFAULT_PAGE);
  };

  const isEmptyData = products.length === 0;
  const isEmptyFiltered = products.length > 0 && filteredProducts.length === 0;

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8">
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8 animate-fade-in">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Sản phẩm</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý danh mục sản phẩm, dịch vụ.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canImport && (
            <div className="relative flex-1 lg:flex-none">
              <button
                onClick={() => setShowImportMenu(!showImportMenu)}
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
          )}
          <div className="relative flex-1 lg:flex-none">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              <span className="hidden sm:inline">Xuất</span>
              <span className="material-symbols-outlined text-sm ml-1">expand_more</span>
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>
                <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in flex flex-col">
                  <button onClick={() => handleExport('excel')} className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors text-left"><span className="material-symbols-outlined text-lg">table_view</span> Excel</button>
                  <button onClick={() => handleExport('csv')} className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors text-left border-t border-slate-100"><span className="material-symbols-outlined text-lg">csv</span> CSV</button>
                  <button onClick={() => handleExport('pdf')} className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-colors text-left border-t border-slate-100"><span className="material-symbols-outlined text-lg">picture_as_pdf</span> PDF</button>
                </div>
              </>
            )}
          </div>
          {canUploadDocument && (
            <button
              onClick={() => onOpenModal('UPLOAD_PRODUCT_DOCUMENT')}
              className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">upload_file</span>
              <span className="hidden sm:inline">Upload tài liệu</span>
              <span className="sm:hidden">Upload</span>
            </button>
          )}
          {canEdit && (
            <button onClick={() => onOpenModal('ADD_PRODUCT')} className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20">
              <span className="material-symbols-outlined">add</span>
              <span>Thêm mới sản phẩm</span>
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Tổng số</p>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg material-symbols-outlined">inventory_2</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{products.length}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              Hoạt động: {activeCount}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
              Ngưng hoạt động: {inactiveCount}
            </span>
          </div>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-500">Số lượng sản phẩm theo lĩnh vực</p>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg material-symbols-outlined">bar_chart</span>
          </div>
          {productCountByDomain.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {productCountByDomain.map((domain) => (
                <div key={domain.key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500 truncate" title={domain.label}>{domain.label}</p>
                  <p className="text-xl font-bold text-slate-900">{domain.count}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Chưa có dữ liệu lĩnh vực.</p>
          )}
        </div>
      </div>

      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-col md:flex-row gap-4 items-center">
          <div className="w-full md:flex-1 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input
              type="text"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
              }}
              placeholder="Tìm kiếm mã hoặc tên sản phẩm..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none"
            />
          </div>
          <div className="w-full md:max-w-xs">
            <SearchableSelect
              value={domainFilterId}
              options={domainFilterOptions}
              onChange={(value) => {
                setDomainFilterId(value);
                setCurrentPage(DEFAULT_PAGE);
              }}
              placeholder="Tất cả lĩnh vực KD"
            />
          </div>
        </div>
        {hasActiveFilters && (
          <div className="bg-white border-x border-slate-200 px-4 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Đang lọc
              </span>
              {searchTerm.trim() !== '' && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                  Từ khóa: {searchTerm.trim()}
                </span>
              )}
              {domainFilterId !== '' && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                  Lĩnh vực: {getDomainName(domainFilterId)}
                </span>
              )}
              <button
                onClick={resetFilters}
                className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Xóa bộ lọc
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1280px]">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <span className="text-deep-teal">STT</span>
                  </th>
                  {[
                    { label: 'Mã SP', key: 'product_code' },
                    { label: 'Tên SP', key: 'product_name' },
                    { label: 'Lĩnh vực KD', key: 'domain_id' },
                    { label: 'Nhà cung cấp', key: 'vendor_id' },
                    { label: 'Đơn vị tính', key: 'unit' },
                    { label: 'Đơn giá', key: 'standard_price' },
                    { label: 'Trạng thái', key: 'is_active' },
                  ].map((column) => (
                    <th
                      key={column.key}
                      className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
                      onClick={() => handleSort(column.key as keyof Product)}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-deep-teal">{column.label}</span>
                        {renderSortIcon(column.key as keyof Product)}
                      </div>
                    </th>
                  ))}
                  {showActionColumn && (
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right bg-slate-50 sticky right-0">Thao tác</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredProducts.length > 0 ? (
                  currentData.map((item, index) => {
                    const stt = (effectiveCurrentPage - 1) * rowsPerPage + index + 1;
                    const isActive = item.is_active !== false;
                    return (
                      <tr key={String(item.id || item.product_code)} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-semibold text-slate-500">{stt}</td>
                        <td className="px-6 py-4 text-sm font-mono text-slate-500 font-bold">{item.product_code}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-slate-900">{item.product_name}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{getDomainName(item.domain_id)}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <div className="max-w-[200px] truncate" title={getVendorName(item.vendor_id)}>
                            {getVendorName(item.vendor_id)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{formatProductUnitForDisplay(item.unit)}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900">{formatVnd(item.standard_price)}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {isActive ? 'Hoạt động' : 'Ngưng hoạt động'}
                          </span>
                        </td>
                        {showActionColumn && (
                          <td className="px-6 py-4 text-right sticky right-0 bg-white shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
                            <div className="flex justify-end gap-2">
                              {canEdit && (
                                <button onClick={() => onOpenModal('EDIT_PRODUCT', item)} className="p-1.5 text-slate-400 hover:text-primary transition-colors" title="Chỉnh sửa"><span className="material-symbols-outlined text-lg">edit</span></button>
                              )}
                              {canDelete && (
                                <button onClick={() => onOpenModal('DELETE_PRODUCT', item)} className="p-1.5 text-slate-400 hover:text-error transition-colors" title="Xóa"><span className="material-symbols-outlined text-lg">delete</span></button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={tableColSpan} className="px-6 py-10">
                      <div className="flex flex-col items-center justify-center text-center">
                        <span className={`material-symbols-outlined text-5xl ${isEmptyData ? 'text-slate-300' : 'text-blue-300'}`}>
                          {isEmptyData ? 'inventory_2' : 'search_off'}
                        </span>
                        <p className="mt-4 text-base font-semibold text-slate-700">
                          {isEmptyData ? 'Chưa có sản phẩm nào.' : 'Không tìm thấy sản phẩm phù hợp.'}
                        </p>
                        <p className="mt-2 max-w-md text-sm text-slate-500">
                          {isEmptyData
                            ? 'Danh mục sản phẩm hiện chưa có dữ liệu. Bạn có thể tạo mới để bắt đầu quản lý.'
                            : 'Thử đổi từ khóa tìm kiếm hoặc xóa bộ lọc để xem lại toàn bộ danh sách.'}
                        </p>
                        {isEmptyData && canEdit && (
                          <button
                            onClick={() => onOpenModal('ADD_PRODUCT')}
                            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-deep-teal"
                          >
                            <span className="material-symbols-outlined text-base">add</span>
                            Thêm mới sản phẩm
                          </button>
                        )}
                        {isEmptyFiltered && (
                          <button
                            onClick={resetFilters}
                            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            <span className="material-symbols-outlined text-base">filter_alt_off</span>
                            Xóa bộ lọc
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <PaginationControls
            currentPage={effectiveCurrentPage}
            totalItems={totalItems}
            rowsPerPage={rowsPerPage}
            onPageChange={goToPage}
            onRowsPerPageChange={(rows) => {
              setRowsPerPage(rows);
              setCurrentPage(DEFAULT_PAGE);
            }}
            rowsPerPageOptions={[10, 20, 50]}
          />
        </div>
      </div>
    </div>
  );
};
