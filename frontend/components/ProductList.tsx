import React, { useEffect, useMemo, useRef, useState } from 'react';
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
type ProductStatusFilter = 'ACTIVE' | 'INACTIVE';

const DEFAULT_PAGE = 1;
const DEFAULT_ROWS_PER_PAGE = 10;
const PRODUCT_TABLE_MIN_WIDTH = 1636;
const PRODUCT_DESKTOP_VIEWPORT_BREAKPOINT = 1280;
const PRODUCT_HEADER_LAYOUT_BREAKPOINT = 1280;
const PRODUCT_FILTER_LAYOUT_BREAKPOINT = 1040;
const PRODUCT_TABLE_LAYOUT_BREAKPOINT = 1200;
const PRODUCT_QUERY_KEYS = {
  search: 'products_q',
  status: 'products_status',
  domain: 'products_domain_id',
  serviceGroup: 'products_service_group',
  sortKey: 'products_sort_key',
  sortDirection: 'products_sort_dir',
  page: 'products_page',
  rows: 'products_rows',
} as const;

const toLookupKey = (value: unknown): string => String(value ?? '').trim();
const normalizeProductStatusFilter = (value: string | null): ProductStatusFilter =>
  value === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

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

const getProductPackageSearchLabel = (product: Product): string => {
  const packageName = String(product?.package_name ?? '').trim();
  if (packageName) {
    return packageName;
  }

  const productName = String(product?.product_name ?? '').trim();
  return productName || '—';
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
    colStyle: { width: 48, minWidth: 48 },
    headerClassName: 'w-[48px] min-w-[48px] whitespace-nowrap px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[48px] min-w-[48px] whitespace-nowrap px-2.5 py-1.5 align-middle text-xs font-semibold text-slate-500',
  },
  {
    key: 'product_code',
    label: 'Mã SP',
    sortable: true,
    colStyle: { width: 112, minWidth: 112 },
    headerClassName: 'w-[112px] min-w-[112px] whitespace-nowrap px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[112px] min-w-[112px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-3 py-1.5 align-middle text-xs font-semibold leading-5 text-slate-700',
  },
  {
    key: 'package_name',
    label: 'Gói cước',
    sortable: true,
    colStyle: { width: 144, minWidth: 144 },
    headerClassName: 'w-[144px] min-w-[144px] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[144px] min-w-[144px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-3 py-1.5 align-middle text-xs leading-5 text-slate-600',
  },
  {
    key: 'description',
    label: 'Mô tả gói cước',
    sortable: true,
    colStyle: { width: 200, minWidth: 200 },
    headerClassName: 'w-[200px] min-w-[200px] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[200px] min-w-[200px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-3 py-1.5 align-middle text-xs leading-5 text-slate-600',
  },
  {
    key: 'standard_price',
    label: 'Đơn giá',
    sortable: true,
    colStyle: { width: 136, minWidth: 136 },
    headerClassName: 'w-[136px] min-w-[136px] whitespace-nowrap pl-3 pr-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[136px] min-w-[136px] whitespace-nowrap pl-3 pr-4 py-1.5 text-right align-middle text-xs font-bold text-slate-900',
  },
  {
    key: 'product_name',
    label: 'Tên sản phẩm',
    sortable: true,
    colStyle: { width: 240, minWidth: 240 },
    headerClassName: 'w-[240px] min-w-[240px] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[240px] min-w-[240px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-3 py-1.5 align-middle text-xs font-semibold leading-5 text-slate-900',
  },
  {
    key: 'service_group',
    label: 'Nhóm dịch vụ',
    sortable: true,
    colStyle: { width: 112, minWidth: 112 },
    headerClassName: 'w-[112px] min-w-[112px] whitespace-nowrap pl-4 pr-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[112px] min-w-[112px] whitespace-nowrap pl-4 pr-3 py-1.5 align-middle text-xs',
  },
  {
    key: 'domain_id',
    label: 'Lĩnh vực KD',
    sortable: true,
    colStyle: { width: 144, minWidth: 144 },
    headerClassName: 'w-[144px] min-w-[144px] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[144px] min-w-[144px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-3 py-1.5 align-middle text-xs leading-5 text-slate-600',
  },
  {
    key: 'vendor_id',
    label: 'Nhà cung cấp',
    sortable: true,
    colStyle: { width: 168, minWidth: 168 },
    headerClassName: 'w-[168px] min-w-[168px] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[168px] min-w-[168px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-3 py-1.5 align-middle text-xs leading-5 text-slate-600',
  },
  {
    key: 'unit',
    label: 'Đơn vị tính',
    sortable: true,
    colStyle: { width: 96, minWidth: 96 },
    headerClassName: 'w-[96px] min-w-[96px] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[96px] min-w-[96px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-3 py-1.5 align-middle text-xs leading-5 text-slate-600',
  },
  {
    key: 'is_active',
    label: 'Trạng thái',
    sortable: true,
    colStyle: { width: 116, minWidth: 116 },
    headerClassName: 'w-[116px] min-w-[116px] whitespace-nowrap px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[116px] min-w-[116px] whitespace-nowrap px-3 py-1.5 align-middle text-xs',
  },
  {
    key: 'actions',
    label: 'Thao tác',
    sortable: false,
    colStyle: { width: 120, minWidth: 120 },
    headerClassName: 'w-[120px] min-w-[120px] whitespace-nowrap px-2.5 py-1.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[120px] min-w-[120px] whitespace-nowrap px-2.5 py-1.5 align-middle text-right',
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
        statusFilter: 'ACTIVE' as ProductStatusFilter,
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
      statusFilter: normalizeProductStatusFilter(params.get(PRODUCT_QUERY_KEYS.status)),
      domainFilterId: params.get(PRODUCT_QUERY_KEYS.domain) ?? '',
      serviceGroupFilterId: isProductServiceGroupCode(serviceGroupFromQuery) ? serviceGroupFromQuery : '',
      currentPage: parsePositiveNumber(params.get(PRODUCT_QUERY_KEYS.page), DEFAULT_PAGE),
      rowsPerPage: parsePositiveNumber(params.get(PRODUCT_QUERY_KEYS.rows), DEFAULT_ROWS_PER_PAGE),
      sortConfig: isProductSortableKey(sortKey) ? { key: sortKey, direction: sortDirection } : null,
    };
  }, []);

  const [searchTerm, setSearchTerm] = useState(initialQueryState.searchTerm);
  const [searchInput, setSearchInput] = useState(initialQueryState.searchTerm);
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>(initialQueryState.statusFilter);
  const [domainFilterId, setDomainFilterId] = useState(initialQueryState.domainFilterId);
  const [serviceGroupFilterId, setServiceGroupFilterId] = useState(initialQueryState.serviceGroupFilterId);
  const [currentPage, setCurrentPage] = useState(initialQueryState.currentPage);
  const [rowsPerPage, setRowsPerPage] = useState(initialQueryState.rowsPerPage);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product; direction: 'asc' | 'desc' } | null>(
    initialQueryState.sortConfig
  );
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? PRODUCT_DESKTOP_VIEWPORT_BREAKPOINT : window.innerWidth
  );
  const [contentWidth, setContentWidth] = useState(() =>
    typeof window === 'undefined' ? PRODUCT_TABLE_LAYOUT_BREAKPOINT : window.innerWidth
  );
  const activeView = useMemo(() => getProductModuleViewFromPathname(location.pathname), [location.pathname]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showCompactKpiPanel, setShowCompactKpiPanel] = useState(false);
  const [expandedCompactCardIds, setExpandedCompactCardIds] = useState<string[]>([]);
  const layoutHostRef = useRef<HTMLDivElement | null>(null);
  // Swipe-to-action: track which card is swiped open
  const [swipedCardId, setSwipedCardId] = useState<string | null>(null);
  const swipeTouchStartX = React.useRef<number>(0);
  const swipeTouchStartY = React.useRef<number>(0);
  // Scroll-to-top: show button after scrolling 300px
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEscKey(() => {
    setShowImportMenu(false);
    setShowExportMenu(false);
    setShowCompactKpiPanel(false);
    setSwipedCardId(null);
  }, showImportMenu || showExportMenu || showCompactKpiPanel || swipedCardId !== null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      if (layoutHostRef.current) {
        setContentWidth(Math.round(layoutHostRef.current.getBoundingClientRect().width));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !layoutHostRef.current) {
      return;
    }

    const node = layoutHostRef.current;
    const syncContentWidth = () => {
      setContentWidth(Math.round(node.getBoundingClientRect().width));
    };

    syncContentWidth();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      syncContentWidth();
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Scroll-to-top listener
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const showActionColumn = true;
  const isDesktopViewport = viewportWidth >= PRODUCT_DESKTOP_VIEWPORT_BREAKPOINT;
  const isDesktopCatalogLayout = isDesktopViewport && contentWidth >= PRODUCT_TABLE_LAYOUT_BREAKPOINT;
  const isWideDesktopHeaderLayout = isDesktopViewport && contentWidth >= PRODUCT_HEADER_LAYOUT_BREAKPOINT;
  const isWideDesktopFilterLayout = isDesktopViewport && contentWidth >= PRODUCT_FILTER_LAYOUT_BREAKPOINT;
  const isCompactKpiLayout = viewportWidth < 1024;
  const isPhoneWidth = viewportWidth < 640;
  const hasActiveFilters = searchTerm.trim() !== '' || statusFilter !== 'ACTIVE' || domainFilterId !== '' || serviceGroupFilterId !== '';

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

  const formatVndFull = (value: unknown): string => formatVnd(value).replace(/ đ$/, ' đồng');

  const visibleTableColumns = useMemo(
    () => BASE_PRODUCT_TABLE_COLUMNS.filter((column) => showActionColumn || column.key !== 'actions'),
    [showActionColumn]
  );

  const renderDesktopTableCell = (column: ProductTableColumn, item: Product, stt: number) => {
    const isActive = item.is_active !== false;
    const serviceGroupMeta = getProductServiceGroupMeta(item.service_group);

    switch (column.key) {
      case 'stt':
        return <td className={column.cellClassName}>{stt}</td>;
      case 'product_code':
        return <td className={column.cellClassName}>{item.product_code}</td>;
      case 'product_name':
        return <td className={column.cellClassName}>{item.product_name}</td>;
      case 'service_group':
        return (
          <td className={column.cellClassName}>
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${serviceGroupMeta.badgeClassName}`}>
              {getProductServiceGroupShortLabel(item.service_group)}
            </span>
          </td>
        );
      case 'package_name':
        return <td className={column.cellClassName}>{getProductPackageSearchLabel(item)}</td>;
      case 'description':
        return <td className={column.cellClassName}>{String(item.description || '').trim() || '—'}</td>;
      case 'standard_price':
        return <td className={column.cellClassName}>{formatVnd(item.standard_price, { suffix: false })}</td>;
      case 'domain_id':
        return <td className={column.cellClassName}>{getDomainName(item.domain_id)}</td>;
      case 'vendor_id':
        return (
          <td className={column.cellClassName}>
            <div className="whitespace-normal break-words" title={getVendorName(item.vendor_id)}>
              {getVendorName(item.vendor_id)}
            </div>
          </td>
        );
      case 'unit':
        return <td className={column.cellClassName}>{formatProductUnitForDisplay(item.unit)}</td>;
      case 'is_active':
        return (
          <td className={column.cellClassName}>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
            }`}>
              {isActive ? 'Hoạt động' : 'Ngưng hoạt động'}
            </span>
          </td>
        );
      case 'actions':
        return (
          <td className={`${column.cellClassName} sticky right-0 bg-white shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.06)]`}>
            <div className="flex justify-end gap-0.5">
              {renderProductActionButtons(item)}
            </div>
          </td>
        );
      default:
        return <td className={column.cellClassName}>—</td>;
    }
  };

  const activeCount = useMemo(
    () => (products || []).filter((product) => product.is_active !== false).length,
    [products]
  );
  const summaryCards = useMemo(
    () => [
      {
        id: 'total',
        label: 'Tổng số',
        value: products.length,
        helper: 'sản phẩm',
        iconName: 'inventory_2',
        iconToneClassName: 'bg-secondary/15',
        iconTextClassName: 'text-secondary',
      },
      {
        id: 'active',
        label: 'Hoạt động',
        value: activeCount,
        helper: 'đang áp dụng',
        iconName: 'check_circle',
        iconToneClassName: 'bg-secondary/15',
        iconTextClassName: 'text-success',
      },
    ],
    [activeCount, products.length]
  );

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

  useEffect(() => {
    if (!isCompactKpiLayout && showCompactKpiPanel) {
      setShowCompactKpiPanel(false);
    }
  }, [isCompactKpiLayout, showCompactKpiPanel]);

  useEffect(() => {
    if (isDesktopCatalogLayout) {
      setExpandedCompactCardIds([]);
    }
  }, [isDesktopCatalogLayout]);

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

  const statusFilterOptions = useMemo(
    () => [
      { value: 'ACTIVE', label: 'Hoạt động', searchText: 'hoat dong active' },
      { value: 'INACTIVE', label: 'Ngưng hoạt động', searchText: 'ngung hoat dong inactive' },
    ],
    []
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    let result = (products || []).filter((product) => {
      const packageSearchLabel = getProductPackageSearchLabel(product).toLowerCase();
      const matchesSearch =
        normalizedSearch === '' ||
        packageSearchLabel.includes(normalizedSearch) ||
        String(product.product_code || '').toLowerCase().includes(normalizedSearch);
      const matchesStatus =
        statusFilter === 'ACTIVE'
          ? product.is_active !== false
          : product.is_active === false;
      const matchesDomain = domainFilterId === '' || toLookupKey(product.domain_id) === domainFilterId;
      const matchesServiceGroup =
        serviceGroupFilterId === ''
        || normalizeProductServiceGroup(product.service_group) === serviceGroupFilterId;
      return matchesSearch && matchesStatus && matchesDomain && matchesServiceGroup;
    });

    if (sortConfig !== null) {
      result = [...result].sort((a, b) => {
        const normalizeSortableValue = (
          value: string | number | boolean | Attachment[] | { table: string; label: string; count: number }[] | null | undefined
        ): string | number | boolean | null | undefined => (
          Array.isArray(value) ? value.length : value
        );

        let aValue = normalizeSortableValue(a[sortConfig.key]);
        let bValue = normalizeSortableValue(b[sortConfig.key]);

        if (sortConfig.key === 'service_group') {
          aValue = getProductServiceGroupLabel(a.service_group);
          bValue = getProductServiceGroupLabel(b.service_group);
        } else if (sortConfig.key === 'package_name') {
          aValue = getProductPackageSearchLabel(a);
          bValue = getProductPackageSearchLabel(b);
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
  }, [products, searchTerm, statusFilter, domainFilterId, serviceGroupFilterId, sortConfig, businessById, vendorById]);

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
    syncQueryValue(PRODUCT_QUERY_KEYS.status, statusFilter, 'ACTIVE');
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
  }, [searchTerm, statusFilter, domainFilterId, serviceGroupFilterId, currentPage, rowsPerPage, sortConfig, location.pathname, location.search, location.hash, navigate]);

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
          className="material-symbols-outlined transition-transform duration-200"
          style={{ fontSize: 14, transform: sortConfig.direction === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          arrow_upward
        </span>
      );
    }
    return <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 14 }}>unfold_more</span>;
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
    setStatusFilter('ACTIVE');
    setDomainFilterId('');
    setServiceGroupFilterId('');
    setCurrentPage(DEFAULT_PAGE);
  };

  const handleServiceGroupKpiClick = (serviceGroupCode: string) => {
    setServiceGroupFilterId((previous) => (previous === serviceGroupCode ? '' : serviceGroupCode));
    setCurrentPage(DEFAULT_PAGE);
  };

  const getCompactCardId = (item: Product) => String(item.id || item.product_code);

  const toggleCompactCardDetails = (cardId: string) => {
    setExpandedCompactCardIds((previous) =>
      previous.includes(cardId) ? previous.filter((id) => id !== cardId) : [...previous, cardId]
    );
  };

  const isEmptyData = products.length === 0;
  const isEmptyFiltered = products.length > 0 && filteredProducts.length === 0;

  // ── Skeleton card (loading state) ──
  const renderSkeletonCards = () => (
    <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-3 w-16 rounded bg-slate-200" />
            <div className="h-4 w-14 rounded-full bg-slate-200" />
          </div>
          <div className="h-4 w-3/4 rounded bg-slate-200 mb-3" />
          <div className="rounded-lg bg-slate-100 p-3 space-y-2">
            <div className="flex justify-between">
              <div className="h-3 w-1/3 rounded bg-slate-200" />
              <div className="h-3 w-1/4 rounded bg-slate-200" />
            </div>
            <div className="h-3 w-2/3 rounded bg-slate-200" />
            <div className="h-3 w-1/2 rounded bg-slate-200" />
          </div>
          <div className="mt-2.5 h-8 w-full rounded bg-slate-100" />
          <div className="mt-2.5 flex gap-2 border-t border-slate-100 pt-2.5">
            <div className="h-8 flex-1 rounded bg-slate-100" />
            <div className="h-8 flex-1 rounded bg-slate-100" />
            <div className="h-8 w-8 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );

  // ── Swipe-to-action touch handlers ──
  const handleSwipeTouchStart = (e: React.TouchEvent, cardId: string) => {
    swipeTouchStartX.current = e.touches[0].clientX;
    swipeTouchStartY.current = e.touches[0].clientY;
  };

  const handleSwipeTouchEnd = (e: React.TouchEvent, cardId: string) => {
    const deltaX = swipeTouchStartX.current - e.changedTouches[0].clientX;
    const deltaY = Math.abs(swipeTouchStartY.current - e.changedTouches[0].clientY);
    // Chỉ trigger swipe ngang — bỏ qua nếu scroll dọc chiếm ưu thế
    if (deltaY > 30) return;
    if (deltaX > 52) {
      // Swipe trái → mở action
      setSwipedCardId(cardId);
    } else if (deltaX < -32) {
      // Swipe phải → đóng
      if (swipedCardId === cardId) setSwipedCardId(null);
    }
  };

  const renderProductActionButtons = (item: Product) => (
    <>
      <button
        onClick={() => onOpenModal('PRODUCT_FEATURE_CATALOG', item)}
        className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition-colors hover:border-secondary/30 hover:bg-slate-100 hover:text-secondary"
        title="Danh mục chức năng"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>fact_check</span>
      </button>
      {canEdit && (
        <button
          onClick={() => onOpenModal('PRODUCT_TARGET_SEGMENT', item)}
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition-colors hover:border-tertiary/30 hover:bg-slate-100 hover:text-tertiary"
          title="Cấu hình đề xuất bán hàng"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>target</span>
        </button>
      )}
      {canEdit && (
        <button
          onClick={() => onOpenModal('EDIT_PRODUCT', item)}
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition-colors hover:border-primary/30 hover:bg-slate-100 hover:text-primary"
          title="Chỉnh sửa"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
        </button>
      )}
      {canDelete && (
        <button
          onClick={() => onOpenModal('DELETE_PRODUCT', item)}
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition-colors hover:border-error/20 hover:bg-red-50 hover:text-error"
          title="Xóa"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
        </button>
      )}
    </>
  );

  const catalogEmptyState = (
    <div className="px-4 py-10">
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
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-deep-teal"
            style={{ background: 'linear-gradient(135deg,#004481,#005BAA)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
            Thêm sản phẩm
          </button>
        )}
        {isEmptyFiltered && (
          <button
            onClick={resetFilters}
            className="mt-2 inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>filter_alt_off</span>
            Xóa bộ lọc
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div ref={layoutHostRef} className="min-w-0 p-3 pb-6">

      {/* ── Page header with tabs ── */}
      <div
        data-testid="products-toolbar"
        className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between"
      >
        {/* Title row */}
        <div className="flex items-center gap-2 xl:shrink-0">
          <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>inventory_2</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal leading-tight">Sản phẩm / Dịch vụ</h2>
            {!isCompactKpiLayout && (
              <p className="text-[11px] text-slate-400 leading-tight">Danh mục sản phẩm và báo giá</p>
            )}
          </div>
        </div>
        {/* Tab switcher + toolbar — single row on xl: */}
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:gap-2">
          {/* View tabs */}
          <div className="grid w-full grid-cols-2 items-center gap-0.5 rounded border border-slate-200 bg-slate-50 p-0.5 sm:inline-flex sm:w-auto">
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
                  className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                    isActive ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeView === 'catalog' && !isCompactKpiLayout && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Secondary actions */}
              <div
                data-testid="products-primary-actions"
                className="flex flex-wrap items-center gap-2"
              >
                {canImport && (
                  <div className="relative">
                    <button
                      onClick={() => setShowImportMenu(!showImportMenu)}
                      className="inline-flex items-center justify-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
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
                    className="inline-flex items-center justify-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
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
                    className="inline-flex items-center justify-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>upload_file</span>
                    Upload tài liệu
                  </button>
                )}

              </div>

              {canEdit && (
                <button
                  onClick={() => onOpenModal('ADD_PRODUCT')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-50 hover:bg-deep-teal"
                  style={{ background: 'linear-gradient(135deg,#004481,#005BAA)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                  Thêm sản phẩm
                </button>
              )}
            </div>
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
      {!isCompactKpiLayout && (
        <div data-testid="products-kpi-grid" className="mb-3 grid grid-cols-2 gap-3 xl:grid-cols-5">
          {summaryCards.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral">{item.label}</span>
                <div className={`flex h-7 w-7 items-center justify-center rounded ${item.iconToneClassName}`}>
                  <span className={`material-symbols-outlined ${item.iconTextClassName}`} style={{ fontSize: 15 }}>
                    {item.iconName}
                  </span>
                </div>
              </div>
              <p className="text-xl font-black leading-tight text-deep-teal">{item.value}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{item.helper}</p>
            </div>
          ))}
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
                <div className="mb-2 flex items-center justify-between">
                  <span className={`text-[11px] font-semibold ${isSelected ? 'text-primary' : 'text-neutral'}`}>{item.label}</span>
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
      )}

      {/* ── Filter toolbar + Table ── */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/90 px-3 py-2 backdrop-blur-sm xl:static xl:bg-slate-50/70 xl:backdrop-blur-none">
          <div
            data-testid="products-filter-toolbar"
            className={`grid grid-cols-1 gap-2 md:grid-cols-2 ${isWideDesktopFilterLayout ? 'xl:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.4fr)]' : ''}`}
          >
            <div className={`min-w-0 md:col-span-2 ${isWideDesktopFilterLayout ? 'xl:col-span-1' : ''}`}>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>search</span>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => { setSearchInput(event.target.value); }}
                  placeholder="Tìm mã sản phẩm hoặc tên gói cước..."
                  className="h-8 w-full rounded border border-slate-300 bg-white pl-7 pr-3 text-xs text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className={`md:col-span-2 ${isWideDesktopFilterLayout ? 'xl:col-span-1' : ''}`}>
              <div
                className={`grid grid-cols-1 items-start gap-2 sm:grid-cols-2 ${isWideDesktopFilterLayout ? 'xl:grid-cols-[160px_190px_190px_auto]' : ''}`}
              >
                <div className="w-full">
                  <SearchableSelect
                    label=""
                    value={statusFilter}
                    options={statusFilterOptions}
                    onChange={(value) => {
                      setStatusFilter(normalizeProductStatusFilter(value));
                      setCurrentPage(DEFAULT_PAGE);
                    }}
                    placeholder="Hoạt động"
                    compact
                  />
                </div>

                <div className="w-full">
                  <SearchableSelect
                    label=""
                    value={serviceGroupFilterId}
                    options={serviceGroupFilterOptions}
                    onChange={(value) => { setServiceGroupFilterId(value); setCurrentPage(DEFAULT_PAGE); }}
                    placeholder="Tất cả nhóm dịch vụ"
                    compact
                  />
                </div>

                <div className="w-full">
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
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 xl:w-auto xl:justify-self-start"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>filter_alt_off</span>
                    Xóa lọc
                  </button>
                )}
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Đang lọc</span>
              {searchTerm.trim() !== '' && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white text-slate-600 ring-1 ring-slate-200">
                  Từ khóa: {searchTerm.trim()}
                  <button type="button" onClick={() => { setSearchInput(''); setSearchTerm(''); }} aria-label="Xóa từ khóa" className="ml-0.5 rounded-full hover:text-error">
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                  </button>
                </span>
              )}
              {statusFilter !== 'ACTIVE' && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white text-slate-600 ring-1 ring-slate-200">
                  Trạng thái: Ngưng hoạt động
                </span>
              )}
              {serviceGroupFilterId !== '' && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white text-slate-600 ring-1 ring-slate-200">
                  Nhóm: {getProductServiceGroupLabel(serviceGroupFilterId)}
                  <button type="button" onClick={() => { setServiceGroupFilterId(''); setCurrentPage(DEFAULT_PAGE); }} aria-label="Xóa lọc nhóm" className="ml-0.5 rounded-full hover:text-error">
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                  </button>
                </span>
              )}
              {domainFilterId !== '' && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white text-slate-600 ring-1 ring-slate-200">
                  Lĩnh vực: {getDomainName(domainFilterId)}
                  <button type="button" onClick={() => { setDomainFilterId(''); setCurrentPage(DEFAULT_PAGE); }} aria-label="Xóa lọc lĩnh vực" className="ml-0.5 rounded-full hover:text-error">
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {filteredProducts.length === 0 ? (
          catalogEmptyState
        ) : isDesktopCatalogLayout ? (
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
                        <div className={`flex items-center gap-1 ${column.key === 'standard_price' ? 'justify-end' : ''}`}>
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
                {currentData.map((item, index) => {
                  const stt = (effectiveCurrentPage - 1) * rowsPerPage + index + 1;

                  return (
                    <tr key={String(item.id || item.product_code)} className="transition-colors hover:bg-slate-50/80">
                      {visibleTableColumns.map((column) => (
                        <React.Fragment key={`${String(item.id || item.product_code)}-${column.key}`}>
                          {renderDesktopTableCell(column, item, stt)}
                        </React.Fragment>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          // isLoading prop không có trực tiếp ở đây, dùng products.length === 0 && !isEmptyData làm proxy
          // → skeleton render khi chuyển filter và currentData tạm trống
          currentData.length === 0 && !isEmptyFiltered && !isEmptyData ? (
            renderSkeletonCards()
          ) : (
          <div data-testid="product-catalog-card-list" className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2">
            {currentData.map((item) => {
              const isActive = item.is_active !== false;
              const serviceGroupMeta = getProductServiceGroupMeta(item.service_group);
              const productDescription = String(item.description || '').trim() || '—';
              const packageName = getProductPackageSearchLabel(item);
              const cardId = getCompactCardId(item);
              const isDetailsExpanded = expandedCompactCardIds.includes(cardId);
              const isSwipeOpen = swipedCardId === cardId;
              const domainName = getDomainName(item.domain_id);
              const vendorName = getVendorName(item.vendor_id);
              const unitLabel = formatProductUnitForDisplay(item.unit);

              return (
                <article
                  key={String(item.id || item.product_code)}
                  data-testid="product-catalog-card"
                  className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                  onTouchStart={(e) => isPhoneWidth && handleSwipeTouchStart(e, cardId)}
                  onTouchEnd={(e) => isPhoneWidth && handleSwipeTouchEnd(e, cardId)}
                >
                  {/* Swipe-to-action backdrop (phone only) */}
                  {isSwipeOpen && isPhoneWidth && (
                    <div
                      className="absolute inset-0 z-10"
                      onClick={() => setSwipedCardId(null)}
                    />
                  )}

                  {/* Swipe action strip — revealed when swiped left on phone */}
                  {isPhoneWidth && (canEdit || canDelete) && (
                    <div
                      aria-hidden={!isSwipeOpen}
                      className={`absolute right-0 top-0 z-20 flex h-full flex-col items-center justify-center gap-2 bg-white px-3 shadow-[-8px_0_16px_-8px_rgba(0,0,0,0.08)] transition-transform duration-200 ${
                        isSwipeOpen ? 'translate-x-0' : 'translate-x-full'
                      }`}
                    >
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => { setSwipedCardId(null); onOpenModal('EDIT_PRODUCT', item); }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition-colors hover:border-primary/30 hover:text-primary"
                          aria-label="Chỉnh sửa"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => { setSwipedCardId(null); onOpenModal('DELETE_PRODUCT', item); }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded border border-red-100 bg-red-50/60 text-error transition-colors hover:bg-red-50 hover:border-error/30"
                          aria-label="Xóa"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Card nội dung chính */}
                  <div className={`p-3 transition-transform duration-200 ${isSwipeOpen && isPhoneWidth ? '-translate-x-16' : ''}`}>
                    {/* Header — mã + badge, gói cước + status dot */}
                    <div className="flex flex-col gap-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-xs font-medium leading-5 text-on-surface-variant">
                            <span className="text-[10px] font-semibold text-neutral">Mã:</span>{' '}
                            <span className="text-[13px] font-semibold text-deep-teal">{item.product_code}</span>
                          </p>
                          <span className={`inline-flex shrink-0 rounded-full border px-1.5 py-px text-[10px] font-bold ${serviceGroupMeta.badgeClassName}`}>
                            {getProductServiceGroupShortLabel(item.service_group)}
                          </span>
                        </div>
                        <div className="mt-1">
                          <p className="text-xs leading-5 text-on-surface-variant line-clamp-2">
                            <span className="text-[10px] font-semibold text-neutral">Gói cước:</span>{' '}
                            <span className="text-[13px] font-semibold text-primary">{packageName}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Thông tin chính */}
                    <div className="mt-2.5 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                      <h3 className="mb-2 min-w-0 break-words text-[13px] font-bold leading-5 text-on-surface">
                        {item.product_name}
                      </h3>
                      {isPhoneWidth ? (
                        <div className="space-y-1 text-[11px] leading-5 text-on-surface-variant">
                          <p className="min-w-0">
                            <span className="font-semibold">ĐVT:</span>{' '}
                            <span className="font-medium text-on-surface">{unitLabel}</span>
                          </p>
                          <p className="min-w-0">
                            <span className="font-semibold">Đơn giá:</span>{' '}
                            <span className="font-semibold text-deep-teal">{formatVndFull(item.standard_price)}</span>
                          </p>
                          <p className="min-w-0 break-words">
                            <span className="font-semibold">Lĩnh vực KD:</span>{' '}
                            <span className="font-medium text-on-surface">{domainName}</span>
                          </p>
                          <p className="min-w-0 break-words">
                            <span className="font-semibold">Mô tả gói cước:</span>{' '}
                            <span className="font-medium text-on-surface">{productDescription}</span>
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 text-[11px] leading-5 text-on-surface-variant">
                          <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0">
                              <span className="font-semibold">ĐVT:</span>{' '}
                              <span className="font-medium text-on-surface">{unitLabel}</span>
                            </p>
                            <p className="min-w-0 shrink-0 text-right">
                              <span className="font-semibold">Đơn giá:</span>{' '}
                              <span className="font-semibold text-deep-teal">{formatVndFull(item.standard_price)}</span>
                            </p>
                          </div>
                          <p className="min-w-0 break-words">
                            <span className="font-semibold">Lĩnh vực KD:</span>{' '}
                            <span className="font-medium text-on-surface">{domainName}</span>
                          </p>
                          <p className="min-w-0 break-words">
                            <span className="font-semibold">Mô tả gói cước:</span>{' '}
                            <span className="font-medium text-on-surface">{productDescription}</span>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Toggle chi tiết */}
                    <button
                      type="button"
                      data-testid={`product-catalog-card-toggle-${cardId}`}
                      onClick={() => toggleCompactCardDetails(cardId)}
                      aria-expanded={isDetailsExpanded}
                      className="mt-2.5 inline-flex h-8 w-full items-center justify-between rounded border border-slate-200 bg-white px-3 text-left text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      <span>{isDetailsExpanded ? 'Thu gọn chi tiết' : 'Xem chi tiết'}</span>
                      <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 15 }}>
                        {isDetailsExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>

                    {/* Chi tiết mở rộng */}
                    {isDetailsExpanded && (
                      <div
                        data-testid={`product-catalog-card-details-${cardId}`}
                        className="mt-2.5 rounded-lg border border-slate-100 bg-slate-50/70 p-3"
                      >
                        <p className="break-words text-xs leading-5 text-on-surface-variant">
                          <span className="font-semibold text-neutral">Nhà cung cấp:</span>{' '}
                          <span className="font-medium text-on-surface">{vendorName}</span>
                        </p>
                        <button
                          type="button"
                          data-testid={`product-catalog-card-feature-link-${cardId}`}
                          onClick={() => onOpenModal('PRODUCT_FEATURE_CATALOG', item)}
                          className="mt-2 flex w-full items-center justify-between gap-3 border-t border-slate-200 pt-2 text-left text-xs text-on-surface-variant transition-colors hover:text-primary"
                        >
                          <span className="min-w-0 break-words">
                            <span className="font-semibold text-neutral">Chức năng:</span>{' '}
                            <span className="font-medium text-on-surface">Xem danh mục chức năng</span>
                          </span>
                          <span className="material-symbols-outlined shrink-0 text-slate-400" style={{ fontSize: 15 }}>chevron_right</span>
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          )
        )}

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

      {/* ── Scroll-to-top (mobile/tablet only, hiện sau 300px) ── */}
      {showScrollTop && isCompactKpiLayout && (
        <button
          type="button"
          aria-label="Cuộn lên đầu trang"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-5 right-4 z-50 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white shadow-lg transition-all hover:bg-slate-50 xl:hidden"
        >
          <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 18 }}>arrow_upward</span>
        </button>
      )}
    </div>
  );
};
