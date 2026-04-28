import React, { useMemo, useState } from 'react';
import type { Business, ModalType, Product, ProductPackage, Vendor } from '../types';
import { SearchableSelect } from './SearchableSelect';
import { downloadExcelWorkbook } from '../utils/excelTemplate';
import { exportCsv, exportPdfTable, isoDateStamp } from '../utils/exportUtils';
import {
  getProductServiceGroupLabel,
  getProductServiceGroupMeta,
  getProductServiceGroupShortLabel,
  PRODUCT_SERVICE_GROUP_OPTIONS,
} from '../utils/productServiceGroup';
import { formatProductUnitForDisplay } from '../utils/productUnit';

interface ProductPackageListProps {
  productPackages: ProductPackage[];
  products: Product[];
  businesses: Business[];
  vendors: Vendor[];
  onOpenModal: (type: ModalType, item?: ProductPackage) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canImport?: boolean;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
}

type ProductPackageStatusFilter = 'ACTIVE' | 'INACTIVE';

const PRODUCT_PACKAGE_PRICE_LABEL = 'Đơn giá (Trước VAT)';

const PRODUCT_PACKAGE_TEMPLATE_HEADERS = [
  'Mã gói cước',
  'Tên gói cước',
  'Mô tả',
  'Mã định danh sản phẩm cha',
  'Tên sản phẩm/Dịch vụ',
  PRODUCT_PACKAGE_PRICE_LABEL,
  'Đơn vị tính',
  'Trạng thái',
];

const PRODUCT_PACKAGE_PDF_EXPORT_HEADERS = [
  'Mã gói',
  'Tên gói cước',
  'Sản phẩm cha',
  PRODUCT_PACKAGE_PRICE_LABEL,
  'ĐVT',
  'Trạng thái',
];

const PRODUCT_PACKAGE_DENSE_TOOLBAR_INPUT_CLASSNAME =
  'h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-700 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary/30';
const PRODUCT_PACKAGE_DENSE_TOOLBAR_SELECT_TRIGGER_CLASSNAME =
  '!h-8 !min-h-0 !rounded-md !border !border-slate-200 !bg-slate-50 !px-3 !py-0 !text-xs !text-slate-700 shadow-sm hover:!bg-white';
const PRODUCT_PACKAGE_PAGE_SIZE_OPTIONS = [10, 15, 30] as const;

const formatVnd = (value: unknown): string => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '0 đ';
  }

  const hasDecimal = Math.abs(numeric % 1) > 0;
  const formatted = numeric.toLocaleString('vi-VN', {
    minimumFractionDigits: hasDecimal ? 2 : 0,
    maximumFractionDigits: 2,
  });

  return `${formatted} đ`;
};

const normalizeStatusFilter = (value: string | null): ProductPackageStatusFilter =>
  value === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

export const ProductPackageList: React.FC<ProductPackageListProps> = ({
  productPackages,
  products,
  businesses,
  vendors,
  onOpenModal,
  canEdit = true,
  canDelete = true,
  canImport = false,
  onNotify,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductPackageStatusFilter>('ACTIVE');
  const [serviceGroupFilter, setServiceGroupFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [pageSize, setPageSize] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState(1);

  const statusOptions = useMemo(
    () => [
      { value: 'ACTIVE', label: 'Hoạt động' },
      { value: 'INACTIVE', label: 'Ngưng hoạt động' },
    ],
    []
  );

  const productOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả sản phẩm' },
      ...(products || []).map((product) => ({
        value: String(product.id),
        label: `${product.product_code} - ${product.product_name}`,
      })),
    ],
    [products]
  );

  const serviceGroupOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả nhóm dịch vụ' },
      ...PRODUCT_SERVICE_GROUP_OPTIONS.map((option) => ({
        value: String(option.value),
        label: option.label,
      })),
    ],
    []
  );

  const filteredPackages = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return (productPackages || []).filter((item) => {
      const isActive = item.is_active !== false;
      if (statusFilter === 'ACTIVE' && !isActive) return false;
      if (statusFilter === 'INACTIVE' && isActive) return false;
      if (serviceGroupFilter !== '' && String(item.service_group || '') !== serviceGroupFilter) return false;
      if (productFilter !== '' && String(item.product_id || '') !== productFilter) return false;

      if (!normalizedSearch) return true;

      const haystack = [
        String(item.package_code || ''),
        String(item.package_name || ''),
        String(item.product_name || ''),
        String(item.parent_product_code || ''),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [productFilter, productPackages, searchTerm, serviceGroupFilter, statusFilter]);

  const activeCount = filteredPackages.filter((item) => item.is_active !== false).length;
  const linkedProductCount = new Set(filteredPackages.map((item) => String(item.product_id || ''))).size;
  const serviceGroupCount = new Set(
    filteredPackages.map((item) => String(item.service_group || '')).filter((value) => value !== '')
  ).size;
  const totalPages = Math.max(1, Math.ceil(filteredPackages.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = filteredPackages.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize;
  const paginatedPackages = filteredPackages.slice(pageStartIndex, pageStartIndex + pageSize);
  const pageEndIndex = Math.min(filteredPackages.length, pageStartIndex + pageSize);

  const businessById = useMemo(
    () => new Map((businesses || []).map((business) => [String(business.id), business])),
    [businesses]
  );

  const vendorById = useMemo(
    () => new Map((vendors || []).map((vendor) => [String(vendor.id), vendor])),
    [vendors]
  );

  const buildPackageSpreadsheetRow = (item: ProductPackage) => [
    item.package_code,
    item.package_name,
    String(item.description || '').trim(),
    String(item.parent_product_code || ''),
    String(item.product_name || ''),
    Number(item.standard_price ?? 0),
    String(item.unit || '').trim(),
    item.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động',
  ];

  const buildProductReferenceSheets = () => {
    const productRows = (products || []).map((product) => {
      const business = businessById.get(String(product.domain_id || ''));
      const vendor = vendorById.get(String(product.vendor_id || ''));

      return [
        product.product_code,
        product.product_name,
        getProductServiceGroupLabel(product.service_group),
        business?.domain_code || '',
        vendor?.vendor_code || '',
        product.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động',
      ];
    });

    return [
      {
        name: 'SanPham',
        headers: ['Mã định danh', 'Tên sản phẩm/Dịch vụ', 'Nhóm dịch vụ', 'Mã lĩnh vực', 'Mã nhà cung cấp', 'Trạng thái'],
        rows: productRows,
      },
      {
        name: 'TrangThai',
        headers: ['Giá trị hợp lệ', 'Ghi chú'],
        rows: [
          ['Hoạt động', 'Có thể nhập: Hoạt động, Active, 1, True'],
          ['Ngưng hoạt động', 'Có thể nhập: Ngưng hoạt động, Inactive, 0, False'],
        ],
      },
    ];
  };

  const handleDownloadTemplate = () => {
    setShowImportMenu(false);
    const defaultProduct = (products || []).find((product) => product.is_active !== false) || products?.[0];
    const fallbackUnit = String(defaultProduct?.unit || '').trim() || 'Gói';

    downloadExcelWorkbook('mau_nhap_goi_cuoc_san_pham', [
      {
        name: 'GoiCuoc',
        headers: PRODUCT_PACKAGE_TEMPLATE_HEADERS,
        rows: [
          [
            'PKG_HIS_01',
            'Gói HIS tuyến huyện',
            'Gói triển khai chuẩn cho bệnh viện tuyến huyện.',
            defaultProduct?.product_code || 'SP001',
            defaultProduct?.product_name || 'Sản phẩm cha mẫu',
            2500000,
            fallbackUnit,
            'Hoạt động',
          ],
          [
            'PKG_HIS_02',
            'Gói HIS mở rộng',
            'Gói triển khai có thêm cấu phần mở rộng.',
            defaultProduct?.product_code || 'SP001',
            defaultProduct?.product_name || 'Sản phẩm cha mẫu',
            3500000,
            fallbackUnit,
            'Ngưng hoạt động',
          ],
        ],
      },
      ...buildProductReferenceSheets(),
    ]);
  };

  const handleExport = (type: 'excel' | 'csv' | 'pdf') => {
    setShowExportMenu(false);
    const fileName = `ds_goi_cuoc_san_pham_${isoDateStamp()}`;
    const spreadsheetRows = filteredPackages.map(buildPackageSpreadsheetRow);

    if (type === 'excel') {
      downloadExcelWorkbook(fileName, [
        {
          name: 'GoiCuoc',
          headers: PRODUCT_PACKAGE_TEMPLATE_HEADERS,
          rows: spreadsheetRows,
        },
        ...buildProductReferenceSheets(),
      ]);
      return;
    }

    if (type === 'csv') {
      exportCsv(fileName, PRODUCT_PACKAGE_TEMPLATE_HEADERS, spreadsheetRows);
      return;
    }

    const pdfRows = filteredPackages.map((item) => [
      item.package_code,
      item.package_name,
      item.product_name || '—',
      formatVnd(item.standard_price),
      String(item.unit || '').trim() || '—',
      item.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động',
    ]);

    const canPrint = exportPdfTable({
      fileName,
      title: 'Danh sach goi cuoc san pham',
      headers: PRODUCT_PACKAGE_PDF_EXPORT_HEADERS,
      rows: pdfRows,
      subtitle: `Ngay xuat: ${new Date().toLocaleString('vi-VN')}`,
      landscape: true,
    });

    if (!canPrint) {
      onNotify?.('error', 'Xuất PDF', 'Trình duyệt đang chặn popup. Vui lòng cho phép popup để xuất PDF.');
    }
  };

  return (
    <div className="min-w-0 p-3 pb-6">
      <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-secondary/15">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>deployed_code</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal leading-tight">Gói cước Sản phẩm</h2>
            <p className="text-[11px] text-slate-400 leading-tight">Danh mục gói cước theo từng sản phẩm/dịch vụ</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canImport && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowExportMenu(false);
                  setShowImportMenu((previous) => !previous);
                }}
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
                      type="button"
                      onClick={() => {
                        setShowImportMenu(false);
                        onOpenModal('IMPORT_DATA');
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>upload_file</span>
                      Nhập dữ liệu
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary"
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
              type="button"
              onClick={() => {
                setShowImportMenu(false);
                setShowExportMenu((previous) => !previous);
              }}
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
                  <button
                    type="button"
                    onClick={() => handleExport('excel')}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>table_view</span>
                    Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('csv')}
                    className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>csv</span>
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('pdf')}
                    className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>picture_as_pdf</span>
                    PDF
                  </button>
                </div>
              </>
            )}
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => onOpenModal('ADD_PRODUCT_PACKAGE')}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-deep-teal"
              style={{ background: 'linear-gradient(135deg,#004481,#005BAA)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
              Thêm gói cước
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Tổng gói cước', value: filteredPackages.length, iconName: 'deployed_code', iconTone: 'bg-secondary/15', iconText: 'text-secondary', helper: 'gói cước' },
          { label: 'Đang hoạt động', value: activeCount, iconName: 'check_circle', iconTone: 'bg-secondary/15', iconText: 'text-success', helper: 'đang áp dụng' },
          { label: 'Sản phẩm có gói', value: linkedProductCount, iconName: 'inventory_2', iconTone: 'bg-secondary/15', iconText: 'text-secondary', helper: 'sản phẩm' },
          { label: 'Nhóm dịch vụ', value: serviceGroupCount, iconName: 'category', iconTone: 'bg-secondary/15', iconText: 'text-on-surface-variant', helper: 'nhóm' },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-neutral">{item.label}</span>
              <div className={`flex h-7 w-7 items-center justify-center rounded ${item.iconTone}`}>
                <span className={`material-symbols-outlined ${item.iconText}`} style={{ fontSize: 15 }}>{item.iconName}</span>
              </div>
            </div>
            <p className="text-xl font-black leading-tight text-deep-teal">{item.value}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">{item.helper}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-2">
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-[minmax(320px,1.45fr)_repeat(3,minmax(180px,0.85fr))_minmax(180px,0.78fr)]">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Tìm mã gói, tên gói hoặc sản phẩm..."
                className={PRODUCT_PACKAGE_DENSE_TOOLBAR_INPUT_CLASSNAME}
              />
            </div>
            <SearchableSelect
              label=""
              value={statusFilter}
              options={statusOptions}
              onChange={(value) => {
                setStatusFilter(normalizeStatusFilter(value));
                setCurrentPage(1);
              }}
              placeholder="Hoạt động"
              compact
              triggerClassName={PRODUCT_PACKAGE_DENSE_TOOLBAR_SELECT_TRIGGER_CLASSNAME}
              usePortal
              portalZIndex={2400}
            />
            <SearchableSelect
              label=""
              value={serviceGroupFilter}
              options={serviceGroupOptions}
              onChange={(value) => {
                setServiceGroupFilter(value);
                setCurrentPage(1);
              }}
              placeholder="Nhóm dịch vụ"
              compact
              triggerClassName={PRODUCT_PACKAGE_DENSE_TOOLBAR_SELECT_TRIGGER_CLASSNAME}
              usePortal
              portalZIndex={2400}
            />
            <SearchableSelect
              label=""
              value={productFilter}
              options={productOptions}
              onChange={(value) => {
                setProductFilter(value);
                setCurrentPage(1);
              }}
              placeholder="Sản phẩm cha"
              compact
              triggerClassName={PRODUCT_PACKAGE_DENSE_TOOLBAR_SELECT_TRIGGER_CLASSNAME}
              usePortal
              portalZIndex={2400}
              portalMinWidth={320}
              portalMaxWidth={520}
              optionEstimateSize={34}
              dropdownClassName="max-w-[520px]"
              renderOptionContent={(option, { isSelected }) => (
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-left text-xs leading-4" title={option.label}>
                    {option.label}
                  </span>
                  {isSelected ? (
                    <span className="material-symbols-outlined shrink-0 text-primary" style={{ fontSize: 14 }}>
                      check
                    </span>
                  ) : null}
                </div>
              )}
            />
            <div className="flex h-8 items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500">Dòng/trang</span>
              <div className="flex items-center gap-1">
                {PRODUCT_PACKAGE_PAGE_SIZE_OPTIONS.map((option) => {
                  const isSelected = pageSize === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setPageSize(option);
                        setCurrentPage(1);
                      }}
                      className={`inline-flex h-6 min-w-7 items-center justify-center rounded px-1.5 text-[11px] font-bold transition-colors ${
                        isSelected
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                      }`}
                      aria-pressed={isSelected}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {filteredPackages.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 32 }}>deployed_code</span>
            <p className="mt-2 text-xs font-semibold text-slate-700">Chưa có gói cước phù hợp.</p>
            <p className="mt-1 text-[11px] text-slate-500">Thử đổi bộ lọc hoặc thêm gói cước mới để bắt đầu.</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <div className="grid grid-cols-[minmax(240px,1.4fr)_minmax(190px,0.95fr)_minmax(118px,0.58fr)_126px_98px] items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <div>Gói cước</div>
                <div>Sản phẩm cha</div>
                <div className="text-right">Giá / ĐVT</div>
                <div className="text-center">Trạng thái</div>
                <div className="text-right">Thao tác</div>
              </div>
              <div className="divide-y divide-slate-100">
                {paginatedPackages.map((item) => {
                  const serviceGroupMeta = getProductServiceGroupMeta(item.service_group);
                  const isActive = item.is_active !== false;
                  return (
                    <div
                      key={String(item.id)}
                      className="grid min-h-[58px] grid-cols-[minmax(240px,1.4fr)_minmax(190px,0.95fr)_minmax(118px,0.58fr)_126px_98px] items-center gap-2 px-3 py-2 transition-colors hover:bg-slate-50/80"
                    >
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 text-xs font-bold text-deep-teal">{item.package_code}</span>
                          <span className="min-w-0 truncate text-xs font-semibold text-slate-900">{item.package_name}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] leading-4 text-slate-500">
                          {String(item.description || '').trim() || '—'}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-slate-800">{item.product_name || '—'}</div>
                        <span className={`mt-1 inline-flex max-w-full rounded-full border px-2 py-0.5 text-[10px] font-bold ${serviceGroupMeta.badgeClassName}`}>
                          {getProductServiceGroupShortLabel(item.service_group)}
                        </span>
                      </div>
                      <div className="min-w-0 text-right">
                        <div className="whitespace-nowrap text-right text-xs font-bold tabular-nums text-slate-900">{formatVnd(item.standard_price)}</div>
                        <div className="mt-0.5 truncate text-[11px] text-slate-500">{formatProductUnitForDisplay(item.unit)}</div>
                      </div>
                      <div className="flex justify-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {isActive ? 'Hoạt động' : 'Ngưng hoạt động'}
                        </span>
                      </div>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenModal('PRODUCT_PACKAGE_FEATURE_CATALOG', item)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition-colors hover:border-secondary/30 hover:bg-slate-100 hover:text-secondary"
                          title="Danh mục tính năng"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>fact_check</span>
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => onOpenModal('EDIT_PRODUCT_PACKAGE', item)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition-colors hover:border-primary/30 hover:bg-slate-100 hover:text-primary"
                            title="Chỉnh sửa"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => onOpenModal('DELETE_PRODUCT_PACKAGE', item)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition-colors hover:border-error/20 hover:bg-red-50 hover:text-error"
                            title="Xóa"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 p-3 lg:hidden">
              {paginatedPackages.map((item) => {
                const serviceGroupMeta = getProductServiceGroupMeta(item.service_group);
                const isActive = item.is_active !== false;
                return (
                  <article key={String(item.id)} className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{item.package_code}</p>
                        <h3 className="mt-0.5 truncate text-sm font-bold text-slate-900">{item.package_name}</h3>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-slate-500">{String(item.description || '').trim() || '—'}</p>
                      </div>
                      <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${serviceGroupMeta.badgeClassName}`}>
                        {getProductServiceGroupShortLabel(item.service_group)}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                      <p className="min-w-0 truncate"><span className="font-semibold text-slate-700">SP:</span> {item.product_name || '—'}</p>
                      <p className="text-right"><span className="font-semibold text-deep-teal">{formatVnd(item.standard_price)}</span></p>
                      <p><span className="font-semibold text-slate-700">ĐVT:</span> {formatProductUnitForDisplay(item.unit)}</p>
                      <p className="text-right">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {isActive ? 'Hoạt động' : 'Ngưng hoạt động'}
                        </span>
                      </p>
                    </div>

                    <div className="mt-2 flex justify-end gap-2 border-t border-slate-100 pt-2">
                        <button
                          type="button"
                          onClick={() => onOpenModal('PRODUCT_PACKAGE_FEATURE_CATALOG', item)}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>fact_check</span>
                          Tính năng
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => onOpenModal('EDIT_PRODUCT_PACKAGE', item)}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                            Sửa
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => onOpenModal('DELETE_PRODUCT_PACKAGE', item)}
                            className="inline-flex items-center gap-1 rounded border border-red-100 bg-red-50/60 px-2.5 py-1.5 text-xs font-semibold text-error hover:bg-red-50"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                            Xóa
                          </button>
                        )}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] font-medium text-slate-500">
                Hiển thị <span className="font-bold text-slate-700">{pageStartIndex + 1}-{pageEndIndex}</span> / {filteredPackages.length} gói
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Trang trước"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
                </button>
                <span className="min-w-[72px] text-center text-[11px] font-semibold text-slate-600">
                  Trang {safeCurrentPage}/{totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Trang sau"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
