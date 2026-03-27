
import React, { useState, useMemo, useEffect } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import { Business, ModalType, Product } from '../types';
import { PaginationControls } from './PaginationControls';
import { downloadExcelTemplate } from '../utils/excelTemplate';
import { formatDateDdMmYyyy } from '../utils/dateDisplay';
import { exportCsv, exportExcel, exportPdfTable, isoDateStamp } from '../utils/exportUtils';

interface BusinessListProps {
  businesses: Business[];
  products: Product[];
  onOpenModal: (type: ModalType, item?: Business) => void;
}

type BusinessSortKey = keyof Business | 'product_count';

export const BusinessList: React.FC<BusinessListProps> = ({ businesses = [], products = [], onOpenModal }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: BusinessSortKey; direction: 'asc' | 'desc' } | null>(null);
  
  // State for Menus
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [showImportMenu, setShowImportMenu] = useState(false);
  useEscKey(() => { setShowImportMenu(false); setShowExportMenu(false); }, showImportMenu || showExportMenu);

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
    () => (businesses || []).filter((biz) => (productCountByBusiness.get(String(biz.id)) ?? 0) === 0).length,
    [businesses, productCountByBusiness]
  );

  // Filter & Sort
  const filteredBusinesses = useMemo(() => {
    let result = (businesses || []).filter(biz => {
      const searchToken = searchTerm.toLowerCase();
      const matchesSearch = 
        biz.domain_name.toLowerCase().includes(searchToken) || 
        biz.domain_code.toLowerCase().includes(searchToken) ||
        (biz.focal_point_name || '').toLowerCase().includes(searchToken) ||
        (biz.focal_point_phone || '').toLowerCase().includes(searchToken) ||
        (biz.focal_point_email || '').toLowerCase().includes(searchToken);

      return matchesSearch;
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
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
  }, [businesses, searchTerm, sortConfig, productCountByBusiness]);

  // Pagination
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

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleSort = (key: BusinessSortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: BusinessSortKey) => {
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
    const headers = ['Mã lĩnh vực', 'Tên lĩnh vực', 'Đầu mối chuyên quản', 'Số điện thoại đầu mối', 'Email đầu mối'];
    const sampleRows = [
      ['KD001', 'Phần cứng', 'Nguyễn Việt Hưng (TT.DAS)', '0889773979', 'ndvhung@vnpt.vn'],
      ['KD002', 'Phần mềm', 'Trần Minh Anh (TT.DAS)', '0909123456', 'tmanh@vnpt.vn']
    ];
    downloadExcelTemplate('mau_nhap_linh_vuc', 'LinhVuc', headers, sampleRows);
  };

  const handleExport = (type: 'excel' | 'csv' | 'pdf') => {
    setShowExportMenu(false);
    const headers = ['Mã lĩnh vực', 'Tên lĩnh vực', 'Số sản phẩm', 'Đầu mối chuyên quản', 'Số điện thoại đầu mối', 'Email đầu mối', 'Ngày tạo'];
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
      title: 'Danh sach linh vuc kinh doanh',
      headers,
      rows,
      subtitle: `Ngay xuat: ${new Date().toLocaleString('vi-VN')}`,
      landscape: true,
    });

    if (!canPrint) {
      window.alert('Trinh duyet dang chan popup. Vui long cho phep popup de xuat PDF.');
    }
  };

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Lĩnh vực Kinh doanh</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý danh mục các mảng kinh doanh.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Import Dropdown */}
          <div className="relative flex-1 lg:flex-none">
            <button onClick={() => setShowImportMenu(!showImportMenu)} className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm">
              <span className="material-symbols-outlined text-lg">upload</span>
              <span className="hidden sm:inline">Nhập</span>
              <span className="material-symbols-outlined text-sm ml-1">expand_more</span>
            </button>
            {showImportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowImportMenu(false)}></div>
                <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in flex flex-col">
                   <button onClick={() => { setShowImportMenu(false); onOpenModal('IMPORT_DATA'); }} className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors text-left"><span className="material-symbols-outlined text-lg">upload_file</span> Nhập dữ liệu</button>
                   <button onClick={handleDownloadTemplate} className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors text-left border-t border-slate-100"><span className="material-symbols-outlined text-lg">download</span> Tải file mẫu</button>
                </div>
              </>
            )}
          </div>
          {/* Export Dropdown */}
          <div className="relative flex-1 lg:flex-none">
            <button onClick={() => setShowExportMenu(!showExportMenu)} className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm">
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
          <button onClick={() => onOpenModal('ADD_BUSINESS')} className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20">
            <span className="material-symbols-outlined">add</span>
            <span>Thêm mới</span>
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
             <p className="text-sm font-medium text-slate-500">Tổng lĩnh vực</p>
             <span className="p-2 bg-blue-50 text-blue-600 rounded-lg material-symbols-outlined">category</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{businesses.length}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
             <p className="text-sm font-medium text-slate-500">Tổng sản phẩm</p>
             <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg material-symbols-outlined">inventory_2</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{products.length}</p>
          <p className="text-xs text-slate-500 mt-2">Đếm theo danh mục sản phẩm đang gắn với lĩnh vực.</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
             <p className="text-sm font-medium text-slate-500">Lĩnh vực chưa có sản phẩm</p>
             <span className="p-2 bg-amber-50 text-amber-600 rounded-lg material-symbols-outlined">inventory</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{businessesWithoutProducts}</p>
          <p className="text-xs text-slate-500 mt-2">Giúp rà soát lĩnh vực chưa được cấu hình danh mục.</p>
        </div>
      </div>

      {/* Table */}
      <div>
        <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-col md:flex-row gap-4 items-center">
           <div className="w-full md:flex-1 relative">
             <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
             <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Tìm kiếm mã, tên hoặc đầu mối lĩnh vực..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none" />
           </div>
        </div>

        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm">
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse min-w-[1100px]">
               <thead className="bg-slate-50 border-y border-slate-200">
                 <tr>
                   {[
                     { label: 'Mã lĩnh vực', key: 'domain_code' },
                     { label: 'Tên lĩnh vực', key: 'domain_name' },
                     { label: 'Số sản phẩm', key: 'product_count' },
                     { label: 'Đầu mối chuyên quản', key: 'focal_point_name' },
                     { label: 'Ngày tạo', key: 'created_at' }
                   ].map((col) => (
                     <th key={col.key} className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none" onClick={() => handleSort(col.key as BusinessSortKey)}>
                       <div className="flex items-center gap-1">
                         <span className="text-deep-teal">{col.label}</span>
                         {renderSortIcon(col.key as BusinessSortKey)}
                       </div>
                     </th>
                   ))}
                   <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right bg-slate-50 sticky right-0">Thao tác</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-200">
                 {currentData.length > 0 ? (
                   currentData.map((item) => (
                     <tr key={item.domain_code} className="hover:bg-slate-50 transition-colors">
                       <td className="px-6 py-4 text-sm font-mono text-slate-500 font-bold">{item.domain_code}</td>
                       <td className="px-6 py-4 text-sm font-semibold text-slate-900">{item.domain_name}</td>
                       <td className="px-6 py-4">
                         <div className="inline-flex min-w-[56px] items-center justify-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
                           {productCountByBusiness.get(String(item.id)) ?? 0}
                         </div>
                       </td>
                       <td className="px-6 py-4 text-sm text-slate-600">
                         {item.focal_point_name || item.focal_point_phone || item.focal_point_email ? (
                           <div className="space-y-1">
                             {item.focal_point_name && <p className="font-semibold text-slate-900">{item.focal_point_name}</p>}
                             {item.focal_point_phone && <p>{item.focal_point_phone}</p>}
                             {item.focal_point_email && <p className="text-primary">{item.focal_point_email}</p>}
                           </div>
                         ) : (
                           <span className="text-slate-400">Chưa cập nhật</span>
                         )}
                       </td>
                       <td className="px-6 py-4 text-sm text-slate-600">{formatDateDdMmYyyy(item.created_at)}</td>
                       <td className="px-6 py-4 text-right sticky right-0 bg-white shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
                         <div className="flex justify-end gap-2">
                           <button onClick={() => onOpenModal('EDIT_BUSINESS', item)} className="p-1.5 text-slate-400 hover:text-primary transition-colors" title="Chỉnh sửa"><span className="material-symbols-outlined text-lg">edit</span></button>
                           <button onClick={() => onOpenModal('DELETE_BUSINESS', item)} className="p-1.5 text-slate-400 hover:text-error transition-colors" title="Xóa"><span className="material-symbols-outlined text-lg">delete</span></button>
                         </div>
                       </td>
                     </tr>
                   ))
                 ) : (
                   <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Không tìm thấy dữ liệu.</td></tr>
                 )}
               </tbody>
             </table>
           </div>

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
        </div>
      </div>
    </div>
  );
};
