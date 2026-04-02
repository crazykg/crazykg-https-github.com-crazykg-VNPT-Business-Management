import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEscKey } from '../hooks/useEscKey';
import { Product, Business, Vendor, ModalType, Customer, Attachment } from '../types';
import { PaginationControls } from './PaginationControls';
import { ProductQuotationTab } from './ProductQuotationTab';
import { SearchableSelect } from './SearchableSelect';
import { downloadExcelWorkbook } from '../utils/excelTemplate';
import { exportCsv, exportExcel, exportPdfTable, isoDateStamp } from '../utils/exportUtils';
import {
  formatProductUnitForDisplay,
  formatProductUnitForExport,
} from '../utils/productUnit';
import {
  getProductServiceGroupLabel,
  getProductServiceGroupMeta,
  getProductServiceGroupShortLabel,
  isProductServiceGroupCode,
  normalizeProductServiceGroup,
  PRODUCT_SERVICE_GROUP_OPTIONS,
  PRODUCT_SERVICE_GROUP_TEMPLATE_ROWS,
} from '../utils/productServiceGroup';

interface ProductListProps {
  products: Product[];
  businesses: Business[];
  vendors: Vendor[];
  customers?: Customer[];
  currentUserId?: string | number | null;
  onOpenModal: (type: ModalType, item?: Product) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canImport?: boolean;
  canUploadDocument?: boolean;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
}

type ProductTableColumnKey =
  | 'stt'
  | 'product_code'
  | 'package_name'
  | 'description'
  | 'standard_price'
  | 'service_group'
  | 'product_name'
  | 'domain_id'
  | 'vendor_id'
  | 'unit'
  | 'is_active'
  | 'actions';

interface ProductTableColumn {
  key: ProductTableColumnKey;
  label: string;
  sortable?: boolean;
  colStyle?: React.CSSProperties;
  headerClassName: string;
  cellClassName: string;
}

type ProductModuleView = 'catalog' | 'quote';

const DEFAULT_PAGE = 1;
const DEFAULT_ROWS_PER_PAGE = 10;
const PRODUCT_TABLE_MIN_WIDTH = 2372;
const PRODUCT_QUERY_KEYS = {
  search: 'products_q',
  domain: 'products_domain_id',
  serviceGroup: 'products_service_group',
  sortKey: 'products_sort_key',
  sortDirection: 'products_sort_dir',
  page: 'products_page',
  rows: 'products_rows',
} as const;

const toLookupKey = (value: unknown): string => String(value ?? '').trim();

const PRODUCT_SORTABLE_KEYS: Array<keyof Product> = [
  'product_code',
  'package_name',
  'description',
  'standard_price',
  'service_group',
  'product_name',
  'domain_id',
  'vendor_id',
  'unit',
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

const PRODUCT_ROUTE_PATHS: Record<ProductModuleView, string> = {
  catalog: '/products',
  quote: '/products/quote',
};

const getProductModuleViewFromPathname = (pathname: string): ProductModuleView => {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const pathSegments = normalizedPath.split('/').filter(Boolean);

  if (pathSegments[0] === 'products' && pathSegments[1] === 'quote') {
    return 'quote';
  }

  return 'catalog';
};

const getBusinessDisplayName = (business: Business): string => {
  const domainName = String(business?.domain_name ?? '').trim();
  if (domainName) {
    return domainName;
  }
  const domainCode = String(business?.domain_code ?? '').trim();
  return domainCode || '-';
};

const PRODUCT_TEMPLATE_HEADERS = [
  'Mã nhóm',
  'Mã sản phẩm',
  'Tên sản phẩm',
  'Gói cước',
  'Mã lĩnh vực',
  'Mã nhà cung cấp',
  'Đơn giá chuẩn (VNĐ)',
  'Đơn vị tính',
  'Trạng thái',
  'Mô tả gói cước',
];

const PRODUCT_SPREADSHEET_EXPORT_HEADERS = [
  'Mã nhóm',
  'Tên nhóm',
  'Mã sản phẩm',
  'Tên sản phẩm',
  'Gói cước',
  'Mã lĩnh vực',
  'Tên lĩnh vực',
  'Mã nhà cung cấp',
  'Tên nhà cung cấp',
  'Đơn giá chuẩn (VNĐ)',
  'Đơn vị tính',
  'Trạng thái',
  'Mô tả gói cước',
];

const PRODUCT_PDF_EXPORT_HEADERS = [
  'Nhóm dịch vụ',
  'Mã SP',
  'Tên sản phẩm',
  'Gói cước',
  'Lĩnh vực KD',
  'Nhà cung cấp',
  'Đơn vị tính',
  'Đơn giá',
  'Trạng thái',
];

const BASE_PRODUCT_TABLE_COLUMNS: ProductTableColumn[] = [
  {
    key: 'stt',
    label: 'STT',
    sortable: false,
    colStyle: { width: 56, minWidth: 56 },
    headerClassName: 'w-[56px] min-w-[56px] whitespace-nowrap px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[56px] min-w-[56px] whitespace-nowrap px-3 py-2 align-middle text-xs font-semibold text-slate-500',
  },
  {
    key: 'product_code',
    label: 'Mã SP',
    sortable: true,
    colStyle: { width: 140, minWidth: 140 },
    headerClassName: 'w-[140px] min-w-[140px] whitespace-nowrap px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[140px] min-w-[140px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-3 py-2 align-middle text-xs font-semibold leading-5 text-slate-700',
  },
  {
    key: 'package_name',
    label: 'Gói cước',
    sortable: true,
    colStyle: { width: 200, minWidth: 200 },
    headerClassName: 'w-[200px] min-w-[200px] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[200px] min-w-[200px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-3 py-2 align-middle text-xs leading-5 text-slate-600',
  },
  {
    key: 'description',
    label: 'Mô tả gói cước',
    sortable: true,
    colStyle: { width: 260, minWidth: 260 },
    headerClassName: 'w-[260px] min-w-[260px] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[260px] min-w-[260px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-3 py-2 align-middle text-xs leading-5 text-slate-600',
  },
  {
    key: 'standard_price',
    label: 'Đơn giá',
    sortable: true,
    colStyle: { width: 200, minWidth: 200 },
    headerClassName: 'w-[200px] min-w-[200px] whitespace-nowrap px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[200px] min-w-[200px] whitespace-nowrap px-3 py-2 align-middle text-xs font-bold text-slate-900',
  },
  {
    key: 'service_group',
    label: 'Nhóm dịch vụ',
    sortable: true,
    colStyle: { width: 160, minWidth: 160 },
    headerClassName: 'w-[160px] min-w-[160px] whitespace-nowrap px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[160px] min-w-[160px] whitespace-nowrap px-3 py-2 align-middle text-xs',
  },
  {
    key: 'product_name',
    label: 'Tên sản phẩm',
    sortable: true,
    colStyle: { width: 280, minWidth: 280 },
    headerClassName: 'w-[280px] min-w-[280px] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[280px] min-w-[280px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-3 py-2 align-middle text-xs font-semibold leading-5 text-slate-900',
  },
  {
    key: 'domain_id',
    label: 'Lĩnh vực KD',
    sortable: true,
    colStyle: { width: 200, minWidth: 200 },
    headerClassName: 'w-[200px] min-w-[200px] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[200px] min-w-[200px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-3 py-2 align-middle text-xs leading-5 text-slate-600',
  },
  {
    key: 'vendor_id',
    label: 'Nhà cung cấp',
    sortable: true,
    colStyle: { width: 240, minWidth: 240 },
    headerClassName: 'w-[240px] min-w-[240px] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[240px] min-w-[240px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-3 py-2 align-middle text-xs leading-5 text-slate-600',
  },
  {
    key: 'unit',
    label: 'Đơn vị tính',
    sortable: true,
    colStyle: { width: 140, minWidth: 140 },
    headerClassName: 'w-[140px] min-w-[140px] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[140px] min-w-[140px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-3 py-2 align-middle text-xs leading-5 text-slate-600',
  },
  {
    key: 'is_active',
    label: 'Trạng thái',
    sortable: true,
    colStyle: { width: 160, minWidth: 160 },
    headerClassName: 'w-[160px] min-w-[160px] whitespace-nowrap px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[160px] min-w-[160px] whitespace-nowrap px-3 py-2 align-middle text-xs',
  },
  {
    key: 'actions',
    label: 'Thao tác',
    sortable: false,
    colStyle: { width: 110, minWidth: 110 },
    headerClassName: 'w-[110px] min-w-[110px] whitespace-nowrap px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[110px] min-w-[110px] whitespace-nowrap px-3 py-2 align-middle text-right',
  },
];

export const ProductList: React.FC<ProductListProps> = ({
  products = [],
  businesses = [],
  vendors = [],
  customers = [],
  currentUserId,
  onOpenModal,
  canEdit = false,
  canDelete = false,
  canImport = false,
  canUploadDocument = false,
  onNotify,
}: ProductListProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialQueryState = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        searchTerm: '',
        domainFilterId: '',
        serviceGroupFilterId: '',
        currentPage: DEFAULT_PAGE,
        rowsPerPage: DEFAULT_ROWS_PER_PAGE,
        sortConfig: null as { key: keyof Product; direction: 'asc' | 'desc' } | null,
      };
    }

    const params = new URLSearchParams(window.location.search);
    const sortKey = params.get(PRODUCT_QUERY_KEYS.sortKey);
    const sortDirectionRaw = params.get(PRODUCT_QUERY_KEYS.sortDirection);
    const sortDirection: 'asc' | 'desc' = sortDirectionRaw === 'desc' ? 'desc' : 'asc';
    const serviceGroupFromQuery = params.get(PRODUCT_QUERY_KEYS.serviceGroup);

    return {
      searchTerm: params.get(PRODUCT_QUERY_KEYS.search) ?? '',
      domainFilterId: params.get(PRODUCT_QUERY_KEYS.domain) ?? '',
      serviceGroupFilterId: isProductServiceGroupCode(serviceGroupFromQuery) ? serviceGroupFromQuery : '',
      currentPage: parsePositiveNumber(params.get(PRODUCT_QUERY_KEYS.page), DEFAULT_PAGE),
      rowsPerPage: parsePositiveNumber(params.get(PRODUCT_QUERY_KEYS.rows), DEFAULT_ROWS_PER_PAGE),
      sortConfig: isProductSortableKey(sortKey) ? { key: sortKey, direction: sortDirection } : null,
    };
  }, []);

  const [searchTerm, setSearchTerm] = useState(initialQueryState.searchTerm);
  const [searchInput, setSearchInput] = useState(initialQueryState.searchTerm);
  const [domainFilterId, setDomainFilterId] = useState(initialQueryState.domainFilterId);
  const [serviceGroupFilterId, setServiceGroupFilterId] = useState(initialQueryState.serviceGroupFilterId);
  const [currentPage, setCurrentPage] = useState(initialQueryState.currentPage);
  const [rowsPerPage, setRowsPerPage] = useState(initialQueryState.rowsPerPage);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product; direction: 'asc' | 'desc' } | null>(
    initialQueryState.sortConfig
  );
  const activeView = useMemo(() => getProductModuleViewFromPathname(location.pathname), [location.pathname]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);

  useEscKey(() => {
    setShowImportMenu(false);
    setShowExportMenu(false);
  }, showImportMenu || showExportMenu);

  const showActionColumn = true;
  const hasActiveFilters = searchTerm.trim() !== '' || domainFilterId !== '' || serviceGroupFilterId !== '';

  const businessById = useMemo(
    () =>
      new Map(
        (businesses || []).map((business) => [
          toLookupKey(business.id),
          business,
        ])
      ),
    [businesses]
  );

  const vendorById = useMemo(
    () =>
      new Map(
        (vendors || []).map((vendor) => [
          toLookupKey(vendor.id),
          vendor,
        ])
      ),
    [vendors]
  );

  const getDomainName = (id: string | number | null | undefined): string => {
    const key = toLookupKey(id);
    if (!key) {
      return '-';
    }
    const business = businessById.get(key);
    if (!business) {
      return '-';
    }
    return getBusinessDisplayName(business);
  };

  const getVendorName = (id: string | number | null | undefined): string => {
    const key = toLookupKey(id);
    if (!key) {
      return '-';
    }
    const vendor = vendorById.get(key);
    if (!vendor) {
      return '-';
    }
    return `${vendor.vendor_code} - ${vendor.vendor_name}`;
  };

  const formatVnd = (value: unknown, options?: { suffix?: boolean }): string => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return options?.suffix === false ? '0' : '0 đ';
    }

    const hasDecimal = Math.abs(numeric % 1) > 0;
    const formatted = numeric.toLocaleString('vi-VN', {
      minimumFractionDigits: hasDecimal ? 2 : 0,
      maximumFractionDigits: 2,
    });

    return options?.suffix === false ? formatted : `${formatted} đ`;
  };

  const visibleTableColumns = useMemo(
    () => BASE_PRODUCT_TABLE_COLUMNS.filter((column) => showActionColumn || column.key !== 'actions'),
    [showActionColumn]
  );
  const tableColSpan = visibleTableColumns.length;

  const getColumnConfig = (key: ProductTableColumnKey): ProductTableColumn =>
    BASE_PRODUCT_TABLE_COLUMNS.find((column) => column.key === key) || BASE_PRODUCT_TABLE_COLUMNS[0];

  const activeCount = useMemo(
    () => (products || []).filter((product) => product.is_active !== false).length,
    [products]
  );
  const inactiveCount = products.length - activeCount;

  const serviceGroupStats = useMemo(
    () =>
      PRODUCT_SERVICE_GROUP_OPTIONS.map((option) => ({
        code: String(option.value),
        label: getProductServiceGroupShortLabel(option.value),
        count: (products || []).filter(
          (product) => normalizeProductServiceGroup(product.service_group) === option.value
        ).length,
        badgeClassName: getProductServiceGroupMeta(option.value).badgeClassName,
      })),
    [products]
  );

  const serviceGroupFilterOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả nhóm dịch vụ', searchText: 'tat ca nhom dich vu all service groups' },
      ...PRODUCT_SERVICE_GROUP_OPTIONS,
    ],
    []
  );

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
        String(product.package_name || '').toLowerCase().includes(normalizedSearch) ||
        String(product.product_code || '').toLowerCase().includes(normalizedSearch);
      const matchesDomain = domainFilterId === '' || toLookupKey(product.domain_id) === domainFilterId;
      const matchesServiceGroup =
        serviceGroupFilterId === ''
        || normalizeProductServiceGroup(product.service_group) === serviceGroupFilterId;
      return matchesSearch && matchesDomain && matchesServiceGroup;
    });

    if (sortConfig !== null) {
      result = [...result].sort((a, b) => {
        const normalizeSortableValue = (
          value: string | number | boolean | Attachment[] | null | undefined
        ): string | number | boolean | null | undefined => (
          Array.isArray(value) ? value.length : value
        );

        let aValue = normalizeSortableValue(a[sortConfig.key]);
        let bValue = normalizeSortableValue(b[sortConfig.key]);

        if (sortConfig.key === 'service_group') {
          aValue = getProductServiceGroupLabel(a.service_group);
          bValue = getProductServiceGroupLabel(b.service_group);
        } else if (sortConfig.key === 'package_name') {
          aValue = String(a.package_name || '');
          bValue = String(b.package_name || '');
        } else if (sortConfig.key === 'description') {
          aValue = String(a.description || '');
          bValue = String(b.description || '');
        } else if (sortConfig.key === 'domain_id') {
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
  }, [products, searchTerm, domainFilterId, serviceGroupFilterId, sortConfig, businessById, vendorById]);

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

    const params = new URLSearchParams(location.search);
    const syncQueryValue = (key: string, value: string, fallbackValue = '') => {
      if (value === fallbackValue) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    };

    params.delete('products_view');
    syncQueryValue(PRODUCT_QUERY_KEYS.search, searchTerm.trim());
    syncQueryValue(PRODUCT_QUERY_KEYS.domain, domainFilterId);
    syncQueryValue(PRODUCT_QUERY_KEYS.serviceGroup, serviceGroupFilterId);
    syncQueryValue(PRODUCT_QUERY_KEYS.page, String(currentPage), String(DEFAULT_PAGE));
    syncQueryValue(PRODUCT_QUERY_KEYS.rows, String(rowsPerPage), String(DEFAULT_ROWS_PER_PAGE));
    syncQueryValue(PRODUCT_QUERY_KEYS.sortKey, sortConfig?.key ? String(sortConfig.key) : '');
    syncQueryValue(PRODUCT_QUERY_KEYS.sortDirection, sortConfig?.direction || '');

    const queryString = params.toString();
    const nextSearch = queryString ? `?${queryString}` : '';
    if (nextSearch !== location.search) {
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch,
          hash: location.hash,
        },
        { replace: true }
      );
    }
  }, [searchTerm, domainFilterId, serviceGroupFilterId, currentPage, rowsPerPage, sortConfig, location.pathname, location.search, location.hash, navigate]);

  const currentData = filteredProducts.slice(
    (effectiveCurrentPage - 1) * rowsPerPage,
    effectiveCurrentPage * rowsPerPage
  );

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
          className="material-symbols-outlined text-sm transition-transform duration-200"
          style={{ transform: sortConfig.direction === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          arrow_upward
        </span>
      );
    }
    return <span className="material-symbols-outlined text-sm text-slate-300">unfold_more</span>;
  };

  const handleDownloadTemplate = () => {
    setShowImportMenu(false);
    const defaultDomainCode = businesses?.[0]?.domain_code || 'KD001';
    const defaultVendorCode = vendors?.[0]?.vendor_code || 'DT001';

    downloadExcelWorkbook('mau_nhap_san_pham', [
      {
        name: 'Products',
        headers: PRODUCT_TEMPLATE_HEADERS,
        rows: [
          [
            'GROUP_A',
            'VNPT_HIS',
            'Giải pháp VNPT HIS',
            'Gói VNPT HIS 1',
            defaultDomainCode,
            defaultVendorCode,
            '150000000',
            'Gói',
            'Hoạt động',
            'Nền tảng HIS phục vụ quản lý bệnh viện.',
          ],
          [
            'GROUP_B',
            'SOC_MONITOR',
            'Dịch vụ giám sát SOC',
            'Gói SOC Monitor Pro',
            defaultDomainCode,
            defaultVendorCode,
            '80000000',
            'Gói',
            'Ngưng hoạt động',
            'Gói giám sát an toàn thông tin chuyên sâu.',
          ],
        ],
      },
      {
        name: 'NhomDichVu',
        headers: ['Mã nhóm', 'Tên nhóm'],
        rows: PRODUCT_SERVICE_GROUP_TEMPLATE_ROWS,
      },
      {
        name: 'TrangThai',
        headers: ['Giá trị nhập', 'Ý nghĩa'],
        rows: [
          ['Hoạt động', 'Sản phẩm còn áp dụng'],
          ['Ngưng hoạt động', 'Sản phẩm tạm dừng hoặc ngừng kinh doanh'],
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
    const fileName = `ds_san_pham_${isoDateStamp()}`;
    const spreadsheetRows = filteredProducts.map((row) => {
      const business = businessById.get(toLookupKey(row.domain_id));
      const vendor = vendorById.get(toLookupKey(row.vendor_id));

      return [
        normalizeProductServiceGroup(row.service_group),
        getProductServiceGroupLabel(row.service_group),
        row.product_code,
        row.product_name,
        String(row.package_name ?? '').trim(),
        business?.domain_code || '',
        business ? getBusinessDisplayName(business) : '',
        vendor?.vendor_code || '',
        vendor?.vendor_name || '',
        Number.isFinite(Number(row.standard_price)) ? Number(row.standard_price) : 0,
        formatProductUnitForExport(row.unit),
        row.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động',
        String(row.description ?? '').trim(),
      ];
    });

    if (type === 'excel') {
      exportExcel(fileName, 'SanPham', PRODUCT_SPREADSHEET_EXPORT_HEADERS, spreadsheetRows);
      return;
    }

    if (type === 'csv') {
      exportCsv(fileName, PRODUCT_SPREADSHEET_EXPORT_HEADERS, spreadsheetRows);
      return;
    }

    const pdfRows = filteredProducts.map((row) => [
      getProductServiceGroupLabel(row.service_group),
      row.product_code,
      row.product_name,
      String(row.package_name ?? '').trim(),
      getDomainName(row.domain_id),
      getVendorName(row.vendor_id),
      formatProductUnitForExport(row.unit),
      formatVnd(row.standard_price),
      row.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động',
    ]);

    const canPrint = exportPdfTable({
      fileName,
      title: 'Danh sach san pham',
      headers: PRODUCT_PDF_EXPORT_HEADERS,
      rows: pdfRows,
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
    setServiceGroupFilterId('');
    setCurrentPage(DEFAULT_PAGE);
  };

  const handleServiceGroupKpiClick = (serviceGroupCode: string) => {
    setServiceGroupFilterId((previous) => (previous === serviceGroupCode ? '' : serviceGroupCode));
    setCurrentPage(DEFAULT_PAGE);
  };

  const isEmptyData = products.length === 0;
  const isEmptyFiltered = products.length > 0 && filteredProducts.length === 0;

  return (
    <div className="p-3 pb-6">

      {/* ── Page header with tabs ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>inventory_2</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal leading-tight">Sản phẩm / Dịch vụ</h2>
            <p className="text-[11px] text-slate-400 leading-tight">Danh mục sản phẩm và báo giá</p>
          </div>
        </div>
        {/* Tab switcher + toolbar */}
        <div className="flex items-center gap-2">
          {/* View tabs */}
          <div className="flex items-center rounded border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
            {[
              { key: 'catalog' as ProductModuleView, label: 'Danh mục', icon: 'inventory_2' },
              { key: 'quote' as ProductModuleView, label: 'Báo giá', icon: 'description' },
            ].map((tab) => {
              const isActive = activeView === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    setShowImportMenu(false);
                    navigate(
                      {
                        pathname: PRODUCT_ROUTE_PATHS[tab.key],
                        search: location.search,
                        hash: location.hash,
                      },
                      { replace: true }
                    );
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                    isActive ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeView === 'catalog' && (
            <>
              {canImport && (
                <div className="relative">
                  <button
                    onClick={() => setShowImportMenu(!showImportMenu)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary"
                        >
                          <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>upload_file</span>
                          Nhập dữ liệu
                        </button>
                        <button
                          onClick={handleDownloadTemplate}
                          className="w-full flex items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary"
                        >
                          <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>download</span>
                          Tải file mẫu
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                >
                  <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>download</span>
                  Xuất
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
                </button>
                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute right-0 top-full z-20 mt-1.5 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                      <button onClick={() => handleExport('excel')} className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary">
                        <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>table_view</span> Excel
                      </button>
                      <button onClick={() => handleExport('csv')} className="w-full flex items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary">
                        <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>csv</span> CSV
                      </button>
                      <button onClick={() => handleExport('pdf')} className="w-full flex items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary">
                        <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>picture_as_pdf</span> PDF
                      </button>
                    </div>
                  </>
                )}
              </div>

              {canUploadDocument && (
                <button
                  onClick={() => onOpenModal('UPLOAD_PRODUCT_DOCUMENT')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                >
                  <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>upload_file</span>
                  Upload tài liệu
                </button>
              )}

              {canEdit && (
                <button
                  onClick={() => onOpenModal('ADD_PRODUCT')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors disabled:opacity-50 bg-primary text-white hover:bg-deep-teal shadow-sm"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                  Thêm sản phẩm
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {activeView === 'quote' ? (
        <ProductQuotationTab
          currentUserId={currentUserId}
          customers={customers}
          products={products}
          onNotify={onNotify}
        />
      ) : (
        <>
      {/* ── KPI strip ── */}
      <div className="mb-3 grid grid-cols-3 gap-3 xl:grid-cols-6">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral">Tổng số</span>
            <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>inventory_2</span>
            </div>
          </div>
          <p className="text-xl font-black text-deep-teal leading-tight">{products.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">sản phẩm</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral">Hoạt động</span>
            <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-success" style={{ fontSize: 15 }}>check_circle</span>
            </div>
          </div>
          <p className="text-xl font-black text-deep-teal leading-tight">{activeCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">đang áp dụng</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral">Ngưng hoạt động</span>
            <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>cancel</span>
            </div>
          </div>
          <p className="text-xl font-black text-deep-teal leading-tight">{inactiveCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">tạm dừng</p>
        </div>
        {serviceGroupStats.map((item) => {
          const isSelected = serviceGroupFilterId === item.code;
          return (
            <button
              key={item.code}
              type="button"
              onClick={() => handleServiceGroupKpiClick(item.code)}
              aria-pressed={isSelected}
              aria-label={`Lọc theo ${item.label}`}
              className={`rounded-lg border p-3 text-left shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-slate-200 bg-white hover:border-primary/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold ${isSelected ? 'text-primary' : 'text-neutral'}`}>{item.label}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${item.badgeClassName}`}>
                  {item.code.replace('GROUP_', '')}
                </span>
              </div>
              <p className={`text-xl font-black leading-tight ${isSelected ? 'text-primary' : 'text-deep-teal'}`}>
                {item.count}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── Filter toolbar + Table ── */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-2">
          <div className="flex flex-wrap items-end gap-2 xl:flex-nowrap">
            <div className="flex-1 min-w-[180px]">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>search</span>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => { setSearchInput(event.target.value); }}
                  placeholder="Tìm mã hoặc tên sản phẩm..."
                  className="h-8 w-full rounded border border-slate-300 bg-white pl-7 pr-3 text-xs text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="w-[220px]">
              <SearchableSelect
                label=""
                value={serviceGroupFilterId}
                options={serviceGroupFilterOptions}
                onChange={(value) => { setServiceGroupFilterId(value); setCurrentPage(DEFAULT_PAGE); }}
                placeholder="Tất cả nhóm dịch vụ"
                compact
              />
            </div>

            <div className="w-[220px]">
              <SearchableSelect
                label=""
                value={domainFilterId}
                options={domainFilterOptions}
                onChange={(value) => { setDomainFilterId(value); setCurrentPage(DEFAULT_PAGE); }}
                placeholder="Tất cả lĩnh vực KD"
                compact
              />
            </div>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shrink-0"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>filter_alt_off</span>
                Xóa bộ lọc
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Đang lọc</span>
              {searchTerm.trim() !== '' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-slate-600 ring-1 ring-slate-200">
                  Từ khóa: {searchTerm.trim()}
                </span>
              )}
              {serviceGroupFilterId !== '' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-slate-600 ring-1 ring-slate-200">
                  Nhóm: {getProductServiceGroupLabel(serviceGroupFilterId)}
                </span>
              )}
              {domainFilterId !== '' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-slate-600 ring-1 ring-slate-200">
                  Lĩnh vực: {getDomainName(domainFilterId)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table
            className="w-full table-fixed border-collapse text-left"
            style={{ minWidth: PRODUCT_TABLE_MIN_WIDTH }}
          >
            <colgroup>
              {visibleTableColumns.map((column) => (
                <col key={column.key} style={column.colStyle} />
              ))}
            </colgroup>
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                {visibleTableColumns.map((column) => (
                  <th
                    key={column.key}
                    className={`${column.headerClassName} ${
                      column.sortable ? 'cursor-pointer transition-colors hover:bg-slate-100' : ''
                    } ${column.key === 'actions' ? 'sticky right-0 bg-slate-50' : ''}`}
                    onClick={() => {
                      if (column.sortable) {
                        handleSort(column.key as keyof Product);
                      }
                    }}
                  >
                    {column.sortable ? (
                      <div className="flex items-center gap-1">
                        <span className="text-deep-teal">{column.label}</span>
                        {renderSortIcon(column.key as keyof Product)}
                      </div>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredProducts.length > 0 ? (
                currentData.map((item, index) => {
                  const stt = (effectiveCurrentPage - 1) * rowsPerPage + index + 1;
                  const isActive = item.is_active !== false;
                  const serviceGroupMeta = getProductServiceGroupMeta(item.service_group);

                  return (
                    <tr key={String(item.id || item.product_code)} className="transition-colors hover:bg-slate-50/80">
                      <td className={getColumnConfig('stt').cellClassName}>{stt}</td>
                      <td className={getColumnConfig('product_code').cellClassName}>{item.product_code}</td>
                      <td className={getColumnConfig('package_name').cellClassName}>
                        {String(item.package_name || '').trim() || '—'}
                      </td>
                      <td className={getColumnConfig('description').cellClassName}>
                        {String(item.description || '').trim() || '—'}
                      </td>
                      <td className={getColumnConfig('standard_price').cellClassName}>{formatVnd(item.standard_price, { suffix: false })}</td>
                      <td className={getColumnConfig('service_group').cellClassName}>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${serviceGroupMeta.badgeClassName}`}>
                          {getProductServiceGroupShortLabel(item.service_group)}
                        </span>
                      </td>
                      <td className={getColumnConfig('product_name').cellClassName}>{item.product_name}</td>
                      <td className={getColumnConfig('domain_id').cellClassName}>{getDomainName(item.domain_id)}</td>
                      <td className={getColumnConfig('vendor_id').cellClassName}>
                        <div className="whitespace-normal break-words" title={getVendorName(item.vendor_id)}>
                          {getVendorName(item.vendor_id)}
                        </div>
                      </td>
                      <td className={getColumnConfig('unit').cellClassName}>{formatProductUnitForDisplay(item.unit)}</td>
                      <td className={getColumnConfig('is_active').cellClassName}>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {isActive ? 'Hoạt động' : 'Ngưng hoạt động'}
                        </span>
                      </td>
                      {showActionColumn && (
                        <td className={`${getColumnConfig('actions').cellClassName} sticky right-0 bg-white shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.06)]`}>
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => onOpenModal('PRODUCT_FEATURE_CATALOG', item)}
                              className="p-1 text-slate-400 transition-colors hover:text-secondary rounded hover:bg-slate-100"
                              title="Danh mục chức năng"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>fact_check</span>
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => onOpenModal('PRODUCT_TARGET_SEGMENT', item)}
                                className="p-1 text-slate-400 transition-colors hover:text-tertiary rounded hover:bg-slate-100"
                                title="Cấu hình đề xuất bán hàng"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>target</span>
                              </button>
                            )}
                            {canEdit && (
                              <button onClick={() => onOpenModal('EDIT_PRODUCT', item)} className="p-1 text-slate-400 transition-colors hover:text-primary rounded hover:bg-slate-100" title="Chỉnh sửa">
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                              </button>
                            )}
                            {canDelete && (
                              <button onClick={() => onOpenModal('DELETE_PRODUCT', item)} className="p-1 text-slate-400 transition-colors hover:text-error rounded hover:bg-red-50" title="Xóa">
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={tableColSpan} className="px-4 py-10">
                    <div className="flex flex-col items-center justify-center text-center">
                      <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 32 }}>
                        {isEmptyData ? 'inventory_2' : 'search_off'}
                      </span>
                      <p className="mt-2 text-xs font-semibold text-slate-700">
                        {isEmptyData ? 'Chưa có sản phẩm nào.' : 'Không tìm thấy sản phẩm phù hợp.'}
                      </p>
                      <p className="mt-1 max-w-md text-[11px] text-slate-500">
                        {isEmptyData
                          ? 'Danh mục sản phẩm hiện chưa có dữ liệu. Bạn có thể tạo mới để bắt đầu quản lý.'
                          : 'Thử đổi từ khóa hoặc xóa bộ lọc để xem lại toàn bộ danh sách.'}
                      </p>
                      {isEmptyData && canEdit && (
                        <button
                          onClick={() => onOpenModal('ADD_PRODUCT')}
                          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors bg-primary text-white hover:bg-deep-teal shadow-sm"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                          Thêm sản phẩm
                        </button>
                      )}
                      {isEmptyFiltered && (
                        <button
                          onClick={resetFilters}
                          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>filter_alt_off</span>
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
        </>
      )}
    </div>
  );
};
