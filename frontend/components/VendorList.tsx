
import React, { useState, useMemo, useEffect } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import type { ModalType } from '../types';
import type { Vendor } from '../types/businessVendor';
import { PaginationControls } from './PaginationControls';
import { downloadExcelTemplate } from '../utils/excelTemplate';
import { formatDateDdMmYyyy } from '../utils/dateDisplay';
import { exportCsv, exportExcel, exportPdfTable, isoDateStamp } from '../utils/exportUtils';

interface VendorListProps {
  vendors: Vendor[];
  onOpenModal: (type: ModalType, item?: Vendor) => void;
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

export const VendorList: React.FC<VendorListProps> = ({ vendors = [], onOpenModal }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: VendorSortKey; direction: VendorSortDirection } | null>(null);
  
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
    <div className={`flex ${className} gap-2`}>
      <button
        onClick={() => onOpenModal('EDIT_VENDOR', item)}
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:text-primary"
        title="Chỉnh sửa"
      >
        <span className="material-symbols-outlined text-lg">edit</span>
      </button>
      <button
        onClick={() => onOpenModal('DELETE_VENDOR', item)}
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:text-error"
        title="Xóa"
      >
        <span className="material-symbols-outlined text-lg">delete</span>
      </button>
    </div>
  );

  const secondaryToolbarButtonClassName =
    'inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 lg:w-auto';
  const primaryToolbarButtonClassName =
    'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 lg:w-auto';

  return (
    <div className="px-4 pt-0 space-y-3 pb-20 md:pb-8">
      <section className="bg-white rounded-b-lg border border-gray-200 border-t-0 px-4 py-4 space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Đối tác / Nhà cung cấp</h2>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end">
            <div className="relative w-full lg:w-auto">
              <button onClick={() => setShowImportMenu(!showImportMenu)} className={secondaryToolbarButtonClassName}>
                <span className="material-symbols-outlined text-lg">upload</span>
                <span>Nhập</span>
                <span className="material-symbols-outlined text-sm ml-1">expand_more</span>
              </button>
              {showImportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowImportMenu(false)} />
                  <div className="absolute top-full left-0 z-20 mt-2 flex w-48 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
                    <button
                      onClick={() => { setShowImportMenu(false); onOpenModal('IMPORT_DATA'); }}
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

            <div className="relative w-full lg:w-auto">
              <button onClick={() => setShowExportMenu(!showExportMenu)} className={secondaryToolbarButtonClassName}>
                <span className="material-symbols-outlined text-lg">download</span>
                <span>Xuất</span>
                <span className="material-symbols-outlined text-sm ml-1">expand_more</span>
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute top-full right-0 z-20 mt-2 flex w-40 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
                    <button onClick={() => handleExport('excel')} className="flex items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-green-600">
                      <span className="material-symbols-outlined text-lg">table_view</span>
                      Excel
                    </button>
                    <button onClick={() => handleExport('csv')} className="flex items-center gap-3 border-t border-gray-100 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-600">
                      <span className="material-symbols-outlined text-lg">csv</span>
                      CSV
                    </button>
                    <button onClick={() => handleExport('pdf')} className="flex items-center gap-3 border-t border-gray-100 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-red-600">
                      <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                      PDF
                    </button>
                  </div>
                </>
              )}
            </div>

            <button onClick={() => onOpenModal('ADD_VENDOR')} className={primaryToolbarButtonClassName}>
              <span className="material-symbols-outlined">add</span>
              <span>Thêm đối tác</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm theo mã hoặc tên đối tác..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:flex xl:w-auto xl:flex-wrap xl:items-center">
            <div className="relative lg:hidden">
              <label htmlFor="vendor-list-sort" className="sr-only">Sắp xếp danh sách đối tác</label>
              <select
                id="vendor-list-sort"
                value={sortSelectValue}
                onChange={(e) => handleResponsiveSortChange(e.target.value)}
                className="h-10 w-full appearance-none rounded-lg border border-gray-300 bg-white pl-3 pr-9 text-sm text-slate-700 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                aria-label="Sắp xếp danh sách đối tác"
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
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
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

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Tổng đối tác</p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">{vendors.length}</p>
              <p className="mt-1 text-xs text-slate-400">Danh sách đang quản lý</p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <span className="material-symbols-outlined">storefront</span>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Sau lọc</p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">{filteredVendors.length}</p>
              <p className="mt-1 text-xs text-slate-400">{hasActiveFilters ? 'Kết quả theo từ khóa' : 'Trùng tổng hiện tại'}</p>
            </div>
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
              <span className="material-symbols-outlined">filter_list</span>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Hiển thị trang</p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">{currentData.length}</p>
              <p className="mt-1 text-xs text-slate-400">Bản ghi trên trang hiện tại</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <span className="material-symbols-outlined">view_agenda</span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-gray-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Danh sách đối tác / nhà cung cấp</h3>
          {hasActiveFilters ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <span className="material-symbols-outlined text-sm">filter_alt</span>
              Bộ lọc đang bật
            </div>
          ) : null}
        </div>

        {currentData.length > 0 ? (
          <>
            <div data-testid="vendor-responsive-list" className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 md:p-5 lg:hidden">
              {currentData.map((item) => (
                <article key={`vendor-card-${String(item.id ?? item.vendor_code)}`} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Mã đối tác</p>
                      <p className="mt-1 font-mono text-sm font-bold text-slate-600">{item.vendor_code}</p>
                    </div>
                    <div className="shrink-0">{renderActionButtons(item)}</div>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Tên đối tác</p>
                      <p className="mt-1 break-words text-base font-bold leading-6 text-slate-900">{item.vendor_name}</p>
                    </div>

                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Ngày tạo</p>
                      <p className="mt-1 text-sm font-medium text-slate-700">{formatDateDdMmYyyy(item.created_at)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table data-testid="vendor-desktop-table" className="w-full min-w-[920px] table-fixed border-collapse text-left">
                <thead className="border-y border-gray-200 bg-gray-50">
                  <tr>
                    {[
                      { label: 'Mã đối tác', key: 'vendor_code', widthClassName: 'w-[220px] min-w-[220px]' },
                      { label: 'Tên đối tác', key: 'vendor_name', widthClassName: 'w-[420px] min-w-[420px]' },
                      { label: 'Ngày tạo', key: 'created_at', widthClassName: 'w-[180px] min-w-[180px]' },
                    ].map((col) => (
                      <th
                        key={col.key}
                        className={`cursor-pointer select-none px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-100 ${col.widthClassName}`}
                        onClick={() => handleSort(col.key as keyof Vendor)}
                      >
                        <div className="flex items-center gap-1">
                          <span className="text-deep-teal">{col.label}</span>
                          {renderSortIcon(col.key as keyof Vendor)}
                        </div>
                      </th>
                    ))}
                    <th className="sticky right-0 w-[120px] min-w-[120px] bg-gray-50 px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {currentData.map((item) => (
                    <tr key={String(item.id ?? item.vendor_code)} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3 align-top text-sm font-mono font-bold text-slate-500">{item.vendor_code}</td>
                      <td className="px-4 py-3 align-top text-sm font-semibold text-slate-900">
                        <div className="max-w-[380px] whitespace-normal break-words leading-6">{item.vendor_name}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-slate-600">{formatDateDdMmYyyy(item.created_at)}</td>
                      <td className="sticky right-0 bg-white px-4 py-3 text-right align-top shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.08)]">
                        {renderActionButtons(item)}
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
                {showNoDataState ? 'storefront' : 'search_off'}
              </span>
              <div className="space-y-1">
                <p className="text-base font-semibold text-slate-700">
                  {showNoDataState ? 'Chưa có đối tác / nhà cung cấp nào.' : 'Không tìm thấy đối tác phù hợp.'}
                </p>
                <p className="text-sm text-slate-500">
                  {showNoDataState
                    ? 'Nhấn "Thêm đối tác" để bắt đầu tạo dữ liệu đầu tiên.'
                    : 'Thử điều chỉnh từ khóa tìm kiếm hoặc xóa bộ lọc để xem lại danh sách.'}
                </p>
              </div>
              {showNoDataState ? (
                <button
                  onClick={() => onOpenModal('ADD_VENDOR')}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <span className="material-symbols-outlined text-lg">add</span>
                  Thêm đối tác
                </button>
              ) : null}
              {showNoMatchState && hasActiveFilters ? (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
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
