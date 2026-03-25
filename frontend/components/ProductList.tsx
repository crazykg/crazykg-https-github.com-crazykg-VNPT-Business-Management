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
  'Mô tả',
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
  'Mô tả',
];

const PRODUCT_PDF_EXPORT_HEADERS = [
  'Nhóm dịch vụ',
  'Mã SP',
  'Tên SP',
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
    colStyle: { width: 72, minWidth: 72 },
    headerClassName: 'w-[72px] min-w-[72px] whitespace-nowrap px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[72px] min-w-[72px] whitespace-nowrap px-5 py-4 align-top text-sm font-semibold text-slate-500',
  },
  {
    key: 'product_code',
    label: 'Mã SP',
    sortable: true,
    colStyle: { width: 160, minWidth: 160 },
    headerClassName: 'w-[160px] min-w-[160px] whitespace-nowrap px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[160px] min-w-[160px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-5 py-4 align-top text-sm font-semibold leading-6 text-slate-700',
  },
  {
    key: 'package_name',
    label: 'Gói cước',
    sortable: true,
    colStyle: { width: 220, minWidth: 220 },
    headerClassName: 'w-[220px] min-w-[220px] px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[220px] min-w-[220px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-5 py-4 align-top text-sm leading-6 text-slate-600',
  },
  {
    key: 'description',
    label: 'Mô tả',
    sortable: true,
    colStyle: { width: 280, minWidth: 280 },
    headerClassName: 'w-[280px] min-w-[280px] px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[280px] min-w-[280px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-5 py-4 align-top text-sm leading-6 text-slate-600',
  },
  {
    key: 'standard_price',
    label: 'Đơn giá',
    sortable: true,
    colStyle: { width: 220, minWidth: 220 },
    headerClassName: 'w-[220px] min-w-[220px] whitespace-nowrap px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[220px] min-w-[220px] whitespace-nowrap px-5 py-4 align-top text-sm font-bold text-slate-900',
  },
  {
    key: 'service_group',
    label: 'Nhóm dịch vụ',
    sortable: true,
    colStyle: { width: 180, minWidth: 180 },
    headerClassName: 'w-[180px] min-w-[180px] whitespace-nowrap px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[180px] min-w-[180px] whitespace-nowrap px-5 py-4 align-top text-sm',
  },
  {
    key: 'product_name',
    label: 'Tên SP',
    sortable: true,
    colStyle: { width: 300, minWidth: 300 },
    headerClassName: 'w-[300px] min-w-[300px] px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[300px] min-w-[300px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-5 py-4 align-top text-sm font-semibold leading-6 text-slate-900',
  },
  {
    key: 'domain_id',
    label: 'Lĩnh vực KD',
    sortable: true,
    colStyle: { width: 220, minWidth: 220 },
    headerClassName: 'w-[220px] min-w-[220px] px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[220px] min-w-[220px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-5 py-4 align-top text-sm leading-6 text-slate-600',
  },
  {
    key: 'vendor_id',
    label: 'Nhà cung cấp',
    sortable: true,
    colStyle: { width: 260, minWidth: 260 },
    headerClassName: 'w-[260px] min-w-[260px] px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[260px] min-w-[260px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-5 py-4 align-top text-sm leading-6 text-slate-600',
  },
  {
    key: 'unit',
    label: 'Đơn vị tính',
    sortable: true,
    colStyle: { width: 160, minWidth: 160 },
    headerClassName: 'w-[160px] min-w-[160px] px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[160px] min-w-[160px] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] px-5 py-4 align-top text-sm leading-6 text-slate-600',
  },
  {
    key: 'is_active',
    label: 'Trạng thái',
    sortable: true,
    colStyle: { width: 180, minWidth: 180 },
    headerClassName: 'w-[180px] min-w-[180px] whitespace-nowrap px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[180px] min-w-[180px] whitespace-nowrap px-5 py-4 align-top text-sm',
  },
  {
    key: 'actions',
    label: 'Thao tác',
    sortable: false,
    colStyle: { width: 120, minWidth: 120 },
    headerClassName: 'w-[120px] min-w-[120px] whitespace-nowrap px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500',
    cellClassName: 'w-[120px] min-w-[120px] whitespace-nowrap px-5 py-4 text-right',
  },
];

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
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);

  useEscKey(() => {
    setShowImportMenu(false);
    setShowExportMenu(false);
  }, showImportMenu || showExportMenu);

  const showActionColumn = canEdit || canDelete;
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
        let aValue: string | number | boolean | null | undefined = a[sortConfig.key];
        let bValue: string | number | boolean | null | undefined = b[sortConfig.key];

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
    syncQueryValue(PRODUCT_QUERY_KEYS.serviceGroup, serviceGroupFilterId);
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
  }, [searchTerm, domainFilterId, serviceGroupFilterId, currentPage, rowsPerPage, sortConfig]);

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
    <div className="p-4 pb-16 md:px-6 md:pb-6 md:pt-5">
      <header className="mb-4 flex flex-col gap-3 xl:mb-5 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-semibold text-primary">
              <span className="material-symbols-outlined text-sm">inventory_2</span>
              Danh mục sản phẩm dịch vụ
            </div>
            <h2 className="text-2xl font-black tracking-tight text-deep-teal md:text-[2.2rem]">Sản phẩm</h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 xl:flex-nowrap xl:justify-end">
          {canImport && (
            <div className="relative flex-1 xl:flex-none">
              <button
                onClick={() => setShowImportMenu(!showImportMenu)}
                className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 md:px-5 md:py-2.5"
              >
                <span className="material-symbols-outlined text-lg">upload</span>
                <span className="hidden sm:inline">Nhập</span>
                <span className="material-symbols-outlined text-sm">expand_more</span>
              </button>
              {showImportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowImportMenu(false)}></div>
                  <div className="absolute left-0 top-full z-20 mt-2 flex w-52 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                    <button
                      onClick={() => {
                        setShowImportMenu(false);
                        onOpenModal('IMPORT_DATA');
                      }}
                      className="flex items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-lg">upload_file</span>
                      Nhập dữ liệu
                    </button>
                    <button
                      onClick={handleDownloadTemplate}
                      className="flex items-center gap-3 border-t border-slate-100 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-emerald-600"
                    >
                      <span className="material-symbols-outlined text-lg">download</span>
                      Tải file mẫu
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="relative flex-1 xl:flex-none">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 md:px-5 md:py-2.5"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              <span className="hidden sm:inline">Xuất</span>
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>
                <div className="absolute right-0 top-full z-20 mt-2 flex w-44 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                  <button onClick={() => handleExport('excel')} className="flex items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-emerald-600"><span className="material-symbols-outlined text-lg">table_view</span>Excel</button>
                  <button onClick={() => handleExport('csv')} className="flex items-center gap-3 border-t border-slate-100 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-600"><span className="material-symbols-outlined text-lg">csv</span>CSV</button>
                  <button onClick={() => handleExport('pdf')} className="flex items-center gap-3 border-t border-slate-100 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-red-600"><span className="material-symbols-outlined text-lg">picture_as_pdf</span>PDF</button>
                </div>
              </>
            )}
          </div>

          {canUploadDocument && (
            <button
              onClick={() => onOpenModal('UPLOAD_PRODUCT_DOCUMENT')}
              className="flex flex-auto items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 xl:flex-none md:px-5 md:py-2.5"
            >
              <span className="material-symbols-outlined text-lg">upload_file</span>
              <span className="hidden sm:inline">Upload tài liệu</span>
              <span className="sm:hidden">Upload</span>
            </button>
          )}

          {canEdit && (
            <button
              onClick={() => onOpenModal('ADD_PRODUCT')}
              className="flex flex-auto shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-deep-teal xl:flex-none md:px-5 md:py-2.5"
            >
              <span className="material-symbols-outlined">add</span>
              <span>Thêm mới sản phẩm</span>
            </button>
          )}
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tổng số</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{products.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Hoạt động</p>
          <p className="mt-2 text-2xl font-black text-emerald-800">{activeCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ngưng hoạt động</p>
          <p className="mt-2 text-2xl font-black text-slate-800">{inactiveCount}</p>
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
              className={`group cursor-pointer rounded-2xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${isSelected ? 'text-primary' : 'text-slate-400'}`}>
                    {item.label}
                  </p>
                  <span
                    className={`mt-2 inline-flex min-w-[3rem] items-center justify-center rounded-full px-3 py-1.5 text-2xl font-black leading-none transition-all ${
                      isSelected
                        ? 'bg-primary/10 text-primary shadow-sm'
                        : 'text-slate-900 group-hover:bg-slate-100 group-hover:text-primary group-hover:shadow-sm'
                    }`}
                  >
                    {item.count}
                  </span>
                </div>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${item.badgeClassName}`}>
                  {item.code.replace('GROUP_', '')}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-4 md:px-6">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_280px_280px]">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tìm kiếm nhanh
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => {
                    setSearchInput(event.target.value);
                  }}
                  placeholder="Tìm kiếm mã hoặc tên sản phẩm..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </div>

            <SearchableSelect
              label="Nhóm dịch vụ"
              value={serviceGroupFilterId}
              options={serviceGroupFilterOptions}
              onChange={(value) => {
                setServiceGroupFilterId(value);
                setCurrentPage(DEFAULT_PAGE);
              }}
              placeholder="Tất cả nhóm dịch vụ"
              compact
            />

            <SearchableSelect
              label="Lĩnh vực kinh doanh"
              value={domainFilterId}
              options={domainFilterOptions}
              onChange={(value) => {
                setDomainFilterId(value);
                setCurrentPage(DEFAULT_PAGE);
              }}
              placeholder="Tất cả lĩnh vực KD"
              compact
            />
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                Đang lọc
              </span>
              {searchTerm.trim() !== '' && (
                <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
                  Từ khóa: {searchTerm.trim()}
                </span>
              )}
              {serviceGroupFilterId !== '' && (
                <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
                  Nhóm dịch vụ: {getProductServiceGroupLabel(serviceGroupFilterId)}
                </span>
              )}
              {domainFilterId !== '' && (
                <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
                  Lĩnh vực: {getDomainName(domainFilterId)}
                </span>
              )}
              <button
                onClick={resetFilters}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Xóa bộ lọc
              </button>
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
                      <td className={getColumnConfig('standard_price').cellClassName}>{formatVnd(item.standard_price)}</td>
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
                        <td className={`${getColumnConfig('actions').cellClassName} sticky right-0 bg-white shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]`}>
                          <div className="flex justify-end gap-2">
                            {canEdit && (
                              <button onClick={() => onOpenModal('EDIT_PRODUCT', item)} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary" title="Chỉnh sửa"><span className="material-symbols-outlined text-lg">edit</span></button>
                            )}
                            {canDelete && (
                              <button onClick={() => onOpenModal('DELETE_PRODUCT', item)} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500" title="Xóa"><span className="material-symbols-outlined text-lg">delete</span></button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={tableColSpan} className="px-6 py-12">
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
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-deep-teal"
                        >
                          <span className="material-symbols-outlined text-base">add</span>
                          Thêm mới sản phẩm
                        </button>
                      )}
                      {isEmptyFiltered && (
                        <button
                          onClick={resetFilters}
                          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
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
  );
};
