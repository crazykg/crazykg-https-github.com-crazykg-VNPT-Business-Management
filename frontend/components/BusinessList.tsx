import React, { useEffect, useMemo, useState } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import type { ModalType } from '../types';
import type { Business } from '../types/businessVendor';
import type { Product } from '../types/product';
import { PaginationControls } from './PaginationControls';
import { downloadExcelTemplate } from '../utils/excelTemplate';
import { formatDateDdMmYyyy } from '../utils/dateDisplay';
import { exportCsv, exportExcel, exportPdfTable, isoDateStamp } from '../utils/exportUtils';

interface BusinessListProps {
  businesses: Business[];
  products: Product[];
  onOpenModal: (type: ModalType, item?: Business) => void;
  canImport?: boolean;
}

type BusinessSortDirection = 'asc' | 'desc';
type BusinessSortKey = keyof Business | 'product_count';
type BusinessSortConfig = { key: BusinessSortKey; direction: BusinessSortDirection };

const RESPONSIVE_SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Mặc định' },
  { value: 'domain_code:asc', label: 'Mã lĩnh vực A-Z' },
  { value: 'domain_code:desc', label: 'Mã lĩnh vực Z-A' },
  { value: 'domain_name:asc', label: 'Tên lĩnh vực A-Z' },
  { value: 'domain_name:desc', label: 'Tên lĩnh vực Z-A' },
  { value: 'product_count:desc', label: 'Nhiều sản phẩm nhất' },
  { value: 'product_count:asc', label: 'Ít sản phẩm nhất' },
  { value: 'created_at:desc', label: 'Ngày tạo mới nhất' },
  { value: 'created_at:asc', label: 'Ngày tạo cũ nhất' },
];

export const BusinessList: React.FC<BusinessListProps> = ({
  businesses = [],
  products = [],
  onOpenModal,
  canImport = false,
}: BusinessListProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<BusinessSortConfig | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);

  useEscKey(() => {
    setShowImportMenu(false);
    setShowExportMenu(false);
  }, showImportMenu || showExportMenu);

  const productCountByBusiness = useMemo(() => {
    const counts = new Map<string, number>();
    (products || []).forEach((product) => {
      const businessId = String(product.domain_id ?? '').trim();
      if (!businessId) {
        return;
      }

      counts.set(businessId, (counts.get(businessId) ?? 0) + 1);
    });
    return counts;
  }, [products]);

  const businessesWithoutProducts = useMemo(
    () => (businesses || []).filter((business) => (productCountByBusiness.get(String(business.id)) ?? 0) === 0).length,
    [businesses, productCountByBusiness]
  );

  const businessesWithProducts = businesses.length - businessesWithoutProducts;
  const hasActiveFilters = searchTerm.trim() !== '';

  const filteredBusinesses = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    let result = (businesses || []).filter((business) => {
      if (!normalizedSearch) {
        return true;
      }

      return (
        String(business.domain_name || '').toLowerCase().includes(normalizedSearch)
        || String(business.domain_code || '').toLowerCase().includes(normalizedSearch)
        || String(business.focal_point_name || '').toLowerCase().includes(normalizedSearch)
        || String(business.focal_point_phone || '').toLowerCase().includes(normalizedSearch)
        || String(business.focal_point_email || '').toLowerCase().includes(normalizedSearch)
      );
    });

    if (sortConfig !== null) {
      result = [...result].sort((a, b) => {
        let aValue: string | number | null | undefined =
          sortConfig.key === 'product_count'
            ? (productCountByBusiness.get(String(a.id)) ?? 0)
            : a[sortConfig.key];
        let bValue: string | number | null | undefined =
          sortConfig.key === 'product_count'
            ? (productCountByBusiness.get(String(b.id)) ?? 0)
            : b[sortConfig.key];

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
  }, [businesses, productCountByBusiness, searchTerm, sortConfig]);

  const totalItems = filteredBusinesses.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentData = filteredBusinesses.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const showNoDataState = businesses.length === 0;
  const showNoMatchState = businesses.length > 0 && currentData.length === 0;

  const resetFilters = () => {
    setSearchTerm('');
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleSort = (key: BusinessSortKey) => {
    let direction: BusinessSortDirection = 'asc';
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
      key: key as BusinessSortKey,
      direction: direction === 'desc' ? 'desc' : 'asc',
    });
    setCurrentPage(1);
  };

  const renderSortIcon = (key: BusinessSortKey) => {
    if (sortConfig?.key === key) {
      return (
        <span
          className="material-symbols-outlined ml-1 text-sm transition-transform duration-200"
          style={{ transform: sortConfig.direction === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          arrow_upward
        </span>
      );
    }

    return <span className="material-symbols-outlined ml-1 text-sm text-slate-300">unfold_more</span>;
  };

  const handleDownloadTemplate = () => {
    setShowImportMenu(false);
    const headers = ['Mã lĩnh vực', 'Tên lĩnh vực', 'Đầu mối chuyên quản', 'Số điện thoại đầu mối', 'Email đầu mối'];
    const sampleRows = [
      ['KD001', 'Phần mềm Y tế số', 'Nguyễn Việt Hưng (TT.DAS)', '0889773979', 'ndvhung@vnpt.vn'],
      ['KD002', 'Phần cứng Giáo dục số', 'Trần Minh Anh (TT.DAS)', '0909123456', 'tmanh@vnpt.vn'],
    ];
    downloadExcelTemplate('mau_nhap_linh_vuc', 'LinhVuc', headers, sampleRows);
  };

  const handleExport = (type: 'excel' | 'csv' | 'pdf') => {
    setShowExportMenu(false);
    const headers = ['Mã lĩnh vực', 'Tên lĩnh vực', 'Số sản phẩm', 'Đầu mối chuyên quản', 'Số điện thoại', 'Email', 'Ngày tạo'];
    const rows = filteredBusinesses.map((row) => [
      row.domain_code,
      row.domain_name,
      productCountByBusiness.get(String(row.id)) ?? 0,
      row.focal_point_name || '',
      row.focal_point_phone || '',
      row.focal_point_email || '',
      row.created_at || '',
    ]);
    const fileName = `ds_linh_vuc_${isoDateStamp()}`;

    if (type === 'excel') {
      exportExcel(fileName, 'LinhVuc', headers, rows);
      return;
    }

    if (type === 'csv') {
      exportCsv(fileName, headers, rows);
      return;
    }

    const canPrint = exportPdfTable({
      fileName,
      title: 'Danh sách lĩnh vực kinh doanh',
      headers,
      rows,
      subtitle: `Ngày xuất: ${new Date().toLocaleString('vi-VN')}`,
      landscape: true,
    });

    if (!canPrint) {
      window.alert('Trình duyệt đang chặn popup. Vui lòng cho phép popup để xuất PDF.');
    }
  };

  const renderActionButtons = (item: Business, className = 'justify-end') => (
    <div className={`flex ${className} gap-1`}>
      <button
        onClick={() => onOpenModal('EDIT_BUSINESS', item)}
        className="p-1 text-slate-400 transition-colors hover:text-primary rounded hover:bg-slate-100"
        title="Chỉnh sửa"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
      </button>
      <button
        onClick={() => onOpenModal('DELETE_BUSINESS', item)}
        className="p-1 text-slate-400 transition-colors hover:text-error rounded hover:bg-red-50"
        title="Xóa"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
      </button>
    </div>
  );

  return (
    <div className="p-3 pb-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>category</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal leading-tight">Lĩnh vực kinh doanh</h2>
            <p className="text-[11px] text-slate-400 leading-tight">Danh mục lĩnh vực và đầu mối chuyên quản</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Import dropdown */}
          {canImport ? (
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
                  <div className="absolute top-full left-0 z-20 mt-1.5 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
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
          ) : null}

          {/* Export dropdown */}
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
                <div className="absolute top-full right-0 z-20 mt-1.5 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                  <button onClick={() => handleExport('excel')}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary">
                    <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>table_view</span> Excel
                  </button>
                  <button onClick={() => handleExport('csv')}
                    className="w-full flex items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary">
                    <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>csv</span> CSV
                  </button>
                  <button onClick={() => handleExport('pdf')}
                    className="w-full flex items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary">
                    <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>picture_as_pdf</span> PDF
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => onOpenModal('ADD_BUSINESS')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors disabled:opacity-50 bg-primary text-white hover:bg-deep-teal shadow-sm"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
            Thêm lĩnh vực
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral">Tổng lĩnh vực</span>
            <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>category</span>
            </div>
          </div>
          <p className="text-xl font-black text-deep-teal leading-tight">{businesses.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">danh mục đang quản lý</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral">Đã có sản phẩm</span>
            <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-success" style={{ fontSize: 15 }}>inventory_2</span>
            </div>
          </div>
          <p className="text-xl font-black text-deep-teal leading-tight">{businessesWithProducts}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">đã liên kết danh mục</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral">Chưa có sản phẩm</span>
            <div className="w-7 h-7 rounded bg-tertiary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 15 }}>inventory</span>
            </div>
          </div>
          <p className="text-xl font-black text-deep-teal leading-tight">{businessesWithoutProducts}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">cần rà soát cấu hình</p>
        </div>
      </div>

      {/* ── Filter toolbar + Table ── */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Tìm mã, tên lĩnh vực hoặc đầu mối..."
              className="w-full h-8 pl-7 pr-3 text-xs rounded border border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none bg-white placeholder:text-slate-400"
            />
          </div>
          <div className="relative lg:hidden">
            <label htmlFor="business-list-sort" className="sr-only">Sắp xếp danh sách lĩnh vực</label>
            <select
              id="business-list-sort"
              value={sortSelectValue}
              onChange={(e) => handleResponsiveSortChange(e.target.value)}
              className="h-8 w-full appearance-none rounded border border-slate-300 bg-white pl-2 pr-7 text-xs text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              aria-label="Sắp xếp danh sách lĩnh vực"
            >
              {RESPONSIVE_SORT_OPTIONS.map((option) => (
                <option key={option.value || 'default'} value={option.value}>{option.label}</option>
              ))}
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 14 }}>
              swap_vert
            </span>
          </div>
          {hasActiveFilters && (
            <>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/15 text-secondary">
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>filter_alt</span>
                &ldquo;{searchTerm.trim()}&rdquo;
              </span>
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>filter_alt_off</span>
                Xóa bộ lọc
              </button>
            </>
          )}
        </div>

        {/* Responsive cards (mobile/tablet) */}
        {currentData.length > 0 ? (
          <>
            <div data-testid="business-responsive-list" className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 lg:hidden">
              {currentData.map((item) => {
                const productCount = productCountByBusiness.get(String(item.id)) ?? 0;
                return (
                  <article key={`business-card-${String(item.id ?? item.domain_code)}`} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mã lĩnh vực</p>
                        <p className="mt-0.5 font-mono text-xs font-bold text-slate-600">{item.domain_code}</p>
                      </div>
                      <div className="shrink-0">{renderActionButtons(item)}</div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tên lĩnh vực</p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-800">{item.domain_name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Số sản phẩm</p>
                        <span className="mt-1 inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          {productCount}
                        </span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Đầu mối chuyên quản</p>
                        {item.focal_point_name || item.focal_point_phone || item.focal_point_email ? (
                          <div className="mt-0.5 space-y-0.5">
                            {item.focal_point_name && <p className="text-xs font-semibold text-slate-800">{item.focal_point_name}</p>}
                            {item.focal_point_phone && <p className="text-xs text-slate-600">{item.focal_point_phone}</p>}
                            {item.focal_point_email && <p className="text-xs text-secondary">{item.focal_point_email}</p>}
                          </div>
                        ) : (
                          <p className="mt-0.5 text-xs text-slate-400">Chưa cập nhật</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ngày tạo</p>
                        <p className="mt-0.5 text-xs text-slate-600">{formatDateDdMmYyyy(item.created_at)}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table data-testid="business-desktop-table" className="w-full min-w-[1100px] table-fixed border-collapse text-left">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    {[
                      { label: 'Mã lĩnh vực', key: 'domain_code', widthClassName: 'w-[160px] min-w-[160px]' },
                      { label: 'Tên lĩnh vực', key: 'domain_name', widthClassName: 'w-[280px] min-w-[280px]' },
                      { label: 'Số sản phẩm', key: 'product_count', widthClassName: 'w-[120px] min-w-[120px]' },
                      { label: 'Đầu mối chuyên quản', key: 'focal_point_name', widthClassName: 'w-[320px] min-w-[320px]' },
                      { label: 'Ngày tạo', key: 'created_at', widthClassName: 'w-[130px] min-w-[130px]' },
                    ].map((col) => (
                      <th
                        key={col.key}
                        className={`cursor-pointer select-none px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-100 ${col.widthClassName}`}
                        onClick={() => handleSort(col.key as BusinessSortKey)}
                      >
                        <div className="flex items-center gap-1">
                          <span>{col.label}</span>
                          {renderSortIcon(col.key as BusinessSortKey)}
                        </div>
                      </th>
                    ))}
                    <th className="sticky right-0 w-[100px] min-w-[100px] bg-slate-50 px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentData.map((item) => {
                    const productCount = productCountByBusiness.get(String(item.id)) ?? 0;
                    return (
                      <tr key={String(item.id ?? item.domain_code)} className="transition-colors hover:bg-slate-50/60">
                        <td className="px-4 py-2 align-middle text-xs font-mono font-bold text-slate-500">{item.domain_code}</td>
                        <td className="px-4 py-2 align-middle text-xs font-semibold text-slate-800">
                          <div className="max-w-[250px] whitespace-normal break-words leading-5">{item.domain_name}</div>
                        </td>
                        <td className="px-4 py-2 align-middle">
                          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            {productCount}
                          </span>
                        </td>
                        <td className="px-4 py-2 align-middle text-xs text-slate-600">
                          {item.focal_point_name || item.focal_point_phone || item.focal_point_email ? (
                            <div className="space-y-0.5">
                              {item.focal_point_name && <p className="font-semibold text-slate-800 leading-5">{item.focal_point_name}</p>}
                              {item.focal_point_phone && <p className="leading-5">{item.focal_point_phone}</p>}
                              {item.focal_point_email && <p className="leading-5 text-secondary">{item.focal_point_email}</p>}
                            </div>
                          ) : (
                            <span className="text-slate-400">Chưa cập nhật</span>
                          )}
                        </td>
                        <td className="px-4 py-2 align-middle text-xs text-slate-600">{formatDateDdMmYyyy(item.created_at)}</td>
                        <td className="sticky right-0 bg-white px-4 py-2 text-right align-middle shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.06)]">
                          {renderActionButtons(item)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="px-4 py-10 text-center">
            <div className="flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 32 }}>
                {showNoDataState ? 'category' : 'search_off'}
              </span>
              <p className="text-xs font-semibold text-slate-700">
                {showNoDataState ? 'Chưa có lĩnh vực kinh doanh nào.' : 'Không tìm thấy lĩnh vực phù hợp.'}
              </p>
              <p className="text-[11px] text-slate-500">
                {showNoDataState
                  ? 'Nhấn "Thêm lĩnh vực" để bắt đầu tạo danh mục đầu tiên.'
                  : 'Thử điều chỉnh từ khóa hoặc xóa bộ lọc.'}
              </p>
              {showNoDataState && (
                <button
                  onClick={() => onOpenModal('ADD_BUSINESS')}
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors bg-primary text-white hover:bg-deep-teal shadow-sm"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                  Thêm lĩnh vực
                </button>
              )}
              {showNoMatchState && hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>filter_alt_off</span>
                  Xóa bộ lọc
                </button>
              )}
            </div>
          </div>
        )}

        <PaginationControls
          currentPage={currentPage}
          totalItems={totalItems}
          rowsPerPage={rowsPerPage}
          onPageChange={goToPage}
          onRowsPerPageChange={(rows) => { setRowsPerPage(rows); setCurrentPage(1); }}
        />
      </div>
    </div>
  );
};
