
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import { useModuleShortcuts } from '../hooks/useModuleShortcuts';
import type { ModalType } from '../types';
import type { Vendor } from '../types/businessVendor';
import { PaginationControls } from './PaginationControls';
import { downloadExcelTemplate } from '../utils/excelTemplate';
import { formatDateDdMmYyyy } from '../utils/dateDisplay';
import { exportCsv, exportExcel, exportPdfTable, isoDateStamp } from '../utils/exportUtils';

interface VendorListProps {
  vendors: Vendor[];
  onOpenModal: (type: ModalType, item?: Vendor) => void;
  canImport?: boolean;
}

type VendorSortDirection = 'asc' | 'desc';
type VendorSortKey = keyof Vendor;

const RESPONSIVE_SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Mặc định' },
  { value: 'vendor_code:asc', label: 'Mã đối tác A-Z' },
  { value: 'vendor_code:desc', label: 'Mã đối tác Z-A' },
  { value: 'vendor_name:asc', label: 'Tên đối tác A-Z' },
  { value: 'vendor_name:desc', label: 'Tên đối tác Z-A' },
  { value: 'created_at:asc', label: 'Ngày tạo cũ nhất' },
  { value: 'created_at:desc', label: 'Ngày tạo mới nhất' },
];

export const VendorList: React.FC<VendorListProps> = ({ vendors = [], onOpenModal, canImport = false }: VendorListProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: VendorSortKey; direction: VendorSortDirection } | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useModuleShortcuts({
    onNew: () => onOpenModal('ADD_VENDOR'),
    onUpdate: () => {
      if (!selectedRowId) return;
      const item = vendors.find((v) => String(v.id) === String(selectedRowId));
      if (item) onOpenModal('EDIT_VENDOR', item);
    },
    onDelete: () => {
      if (!selectedRowId) return;
      const item = vendors.find((v) => String(v.id) === String(selectedRowId));
      if (item) onOpenModal('DELETE_VENDOR', item);
    },
    onFocusSearch: () => searchInputRef.current?.focus(),
  });
  
  // State for Menus
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [showImportMenu, setShowImportMenu] = useState(false);
  useEscKey(() => { setShowImportMenu(false); setShowExportMenu(false); }, showImportMenu || showExportMenu);
  const hasActiveFilters = searchTerm.trim() !== '';

  // Filter & Sort
  const filteredVendors = useMemo(() => {
    let result = (vendors || []).filter(vendor => {
      const matchesSearch = 
        String(vendor.vendor_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        String(vendor.vendor_code || '').toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

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
  }, [vendors, searchTerm, sortConfig]);

  // Pagination
  const totalItems = filteredVendors.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentData = filteredVendors.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );
  const showNoDataState = vendors.length === 0;
  const showNoMatchState = vendors.length > 0 && currentData.length === 0;

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleSort = (key: keyof Vendor) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
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
      key: key as VendorSortKey,
      direction: direction === 'desc' ? 'desc' : 'asc',
    });
    setCurrentPage(1);
  };

  const renderSortIcon = (key: keyof Vendor) => {
    if (sortConfig?.key === key) {
      return (
        <span className="material-symbols-outlined text-sm ml-1 transition-transform duration-200" style={{ transform: sortConfig.direction === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          arrow_upward
        </span>
      );
    }
    return <span className="material-symbols-outlined text-sm text-slate-300 ml-1">unfold_more</span>;
  };

  // --- TEMPLATE & EXPORT ---
  const handleDownloadTemplate = () => {
    setShowImportMenu(false);
    const headers = ['Mã đối tác', 'Tên đối tác'];
    const sampleRows = [
      ['DT001', 'Công ty ABC'],
      ['DT002', 'Tập đoàn XYZ']
    ];
    downloadExcelTemplate('mau_nhap_doi_tac', 'DoiTac', headers, sampleRows);
  };

  const handleExport = (type: 'excel' | 'csv' | 'pdf') => {
    setShowExportMenu(false);
    const headers = ['Mã đối tác', 'Tên đối tác', 'Ngày tạo'];
    const rows = filteredVendors.map((row) => [row.vendor_code, row.vendor_name, row.created_at || '']);
    const fileName = `ds_doi_tac_${isoDateStamp()}`;

    if (type === 'excel') {
      exportExcel(fileName, 'DoiTac', headers, rows);
      return;
    }

    if (type === 'csv') {
      exportCsv(fileName, headers, rows);
      return;
    }

    const canPrint = exportPdfTable({
      fileName,
      title: 'Danh sach doi tac',
      headers,
      rows,
      subtitle: `Ngay xuat: ${new Date().toLocaleString('vi-VN')}`,
      landscape: false,
    });

    if (!canPrint) {
      window.alert('Trinh duyet dang chan popup. Vui long cho phep popup de xuat PDF.');
    }
  };

  const renderActionButtons = (item: Vendor, className = 'justify-end') => (
    <div className={`flex ${className} gap-1`}>
      <button
        onClick={() => onOpenModal('EDIT_VENDOR', item)}
        className="p-1 text-slate-400 transition-colors hover:text-primary rounded hover:bg-slate-100"
        title="Chỉnh sửa"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
      </button>
      <button
        onClick={() => onOpenModal('DELETE_VENDOR', item)}
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
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>storefront</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal leading-tight">Đối tác / Nhà cung cấp</h2>
            <p className="text-[11px] text-slate-400 leading-tight">Danh mục đối tác và nhà cung cấp dịch vụ</p>
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
            onClick={() => onOpenModal('ADD_VENDOR')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors disabled:opacity-50 bg-primary text-white hover:bg-deep-teal shadow-sm"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
            Thêm đối tác
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral">Tổng đối tác</span>
            <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>storefront</span>
            </div>
          </div>
          <p className="text-xl font-black text-deep-teal leading-tight">{vendors.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">danh sách đang quản lý</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral">Sau lọc</span>
            <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>filter_list</span>
            </div>
          </div>
          <p className="text-xl font-black text-deep-teal leading-tight">{filteredVendors.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{hasActiveFilters ? 'kết quả theo từ khóa' : 'trùng tổng hiện tại'}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral">Hiển thị trang</span>
            <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-success" style={{ fontSize: 15 }}>view_agenda</span>
            </div>
          </div>
          <p className="text-xl font-black text-deep-teal leading-tight">{currentData.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">bản ghi trang hiện tại</p>
        </div>
      </div>

      {/* ── Filter toolbar + Table ── */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>search</span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Tìm mã hoặc tên đối tác... (Ctrl+F)"
              className="w-full h-8 pl-7 pr-3 text-xs rounded border border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none bg-white placeholder:text-slate-400"
            />
          </div>
          <div className="relative lg:hidden">
            <label htmlFor="vendor-list-sort" className="sr-only">Sắp xếp danh sách đối tác</label>
            <select
              id="vendor-list-sort"
              value={sortSelectValue}
              onChange={(e) => handleResponsiveSortChange(e.target.value)}
              className="h-8 w-full appearance-none rounded border border-slate-300 bg-white pl-2 pr-7 text-xs text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              aria-label="Sắp xếp danh sách đối tác"
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
                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
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
            <div data-testid="vendor-responsive-list" className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 lg:hidden">
              {currentData.map((item) => (
                <article key={`vendor-card-${String(item.id ?? item.vendor_code)}`} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mã đối tác</p>
                      <p className="mt-0.5 font-mono text-xs font-bold text-slate-600">{item.vendor_code}</p>
                    </div>
                    <div className="shrink-0">{renderActionButtons(item)}</div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tên đối tác</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-800">{item.vendor_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ngày tạo</p>
                      <p className="mt-0.5 text-xs text-slate-600">{formatDateDdMmYyyy(item.created_at)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table data-testid="vendor-desktop-table" className="w-full min-w-[860px] table-fixed border-collapse text-left">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    {[
                      { label: 'Mã đối tác', key: 'vendor_code', widthClassName: 'w-[200px] min-w-[200px]' },
                      { label: 'Tên đối tác', key: 'vendor_name', widthClassName: 'w-[400px] min-w-[400px]' },
                      { label: 'Ngày tạo', key: 'created_at', widthClassName: 'w-[160px] min-w-[160px]' },
                    ].map((col) => (
                      <th
                        key={col.key}
                        className={`cursor-pointer select-none px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-100 ${col.widthClassName}`}
                        onClick={() => handleSort(col.key as keyof Vendor)}
                      >
                        <div className="flex items-center gap-1">
                          <span>{col.label}</span>
                          {renderSortIcon(col.key as keyof Vendor)}
                        </div>
                      </th>
                    ))}
                    <th className="sticky right-0 w-[100px] min-w-[100px] bg-slate-50 px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentData.map((item) => (
                    <tr key={String(item.id ?? item.vendor_code)} onClick={() => setSelectedRowId((prev) => String(prev) === String(item.id) ? null : (item.id ?? null))} className={`cursor-pointer transition-colors ${String(selectedRowId) === String(item.id) ? 'bg-secondary/10 ring-1 ring-inset ring-primary/30' : 'hover:bg-slate-50/60'}`}>
                      <td className="px-4 py-2 align-middle text-xs font-mono font-bold text-slate-500">{item.vendor_code}</td>
                      <td className="px-4 py-2 align-middle text-xs font-semibold text-slate-800">
                        <div className="max-w-[360px] whitespace-normal break-words leading-5">{item.vendor_name}</div>
                      </td>
                      <td className="px-4 py-2 align-middle text-xs text-slate-600">{formatDateDdMmYyyy(item.created_at)}</td>
                      <td className="sticky right-0 bg-white px-4 py-2 text-right align-middle shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.06)]">
                        {renderActionButtons(item)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="px-4 py-10 text-center">
            <div className="flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 32 }}>
                {showNoDataState ? 'storefront' : 'search_off'}
              </span>
              <p className="text-xs font-semibold text-slate-700">
                {showNoDataState ? 'Chưa có đối tác / nhà cung cấp nào.' : 'Không tìm thấy đối tác phù hợp.'}
              </p>
              <p className="text-[11px] text-slate-500">
                {showNoDataState
                  ? 'Nhấn "Thêm đối tác" để bắt đầu tạo dữ liệu đầu tiên.'
                  : 'Thử điều chỉnh từ khóa hoặc xóa bộ lọc.'}
              </p>
              {showNoDataState && (
                <button
                  onClick={() => onOpenModal('ADD_VENDOR')}
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors bg-primary text-white hover:bg-deep-teal shadow-sm"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                  Thêm đối tác
                </button>
              )}
              {showNoMatchState && hasActiveFilters && (
                <button
                  onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
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
