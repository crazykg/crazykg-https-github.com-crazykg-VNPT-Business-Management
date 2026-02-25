
import React, { useState, useMemo, useEffect } from 'react';
import { Product, Business, Vendor, ModalType } from '../types';
import { PaginationControls } from './PaginationControls';
import { downloadExcelWorkbook } from '../utils/excelTemplate';

interface ProductListProps {
  products: Product[];
  businesses: Business[];
  vendors: Vendor[];
  onOpenModal: (type: ModalType, item?: Product) => void;
}

export const ProductList: React.FC<ProductListProps> = ({ products = [], businesses = [], vendors = [], onOpenModal }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product; direction: 'asc' | 'desc' } | null>(null);
  
  // State for Menus
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);

  // Helpers for display names
  const getDomainName = (id: string | number) => {
    const business = (businesses || []).find(b => String(b.id) === String(id));
    return business ? `${business.domain_code} - ${business.domain_name}` : String(id);
  };

  const getVendorName = (id: string | number) => {
    const vendor = (vendors || []).find(v => String(v.id) === String(id));
    return vendor ? `${vendor.vendor_code} - ${vendor.vendor_name}` : String(id);
  };

  const formatVnd = (value: unknown): string => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return '0';
    }
    return numeric.toLocaleString('vi-VN');
  };

  const formatUnit = (value: unknown): string => {
    const text = String(value ?? '').trim();
    if (!text || text === '--' || text === '---') {
      return 'Cái/Gói';
    }
    return text;
  };

  const productCountByDomain = useMemo(() => {
    const counts = new Map<string, { key: string; label: string; count: number }>();

    (businesses || []).forEach((business) => {
      counts.set(String(business.id), {
        key: String(business.id),
        label: `${business.domain_code} - ${business.domain_name}`,
        count: 0,
      });
    });

    (products || []).forEach((product) => {
      const key = String(product.domain_id || '').trim();
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
        label: getDomainName(product.domain_id),
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

  // Filter & Sort
  const filteredProducts = useMemo(() => {
    let result = (products || []).filter(prod => {
      const matchesSearch = 
        prod.product_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        prod.product_code.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        // For sort by references (names instead of IDs)
        if (sortConfig.key === 'domain_id') {
            aValue = getDomainName(a.domain_id);
            bValue = getDomainName(b.domain_id);
        }
        if (sortConfig.key === 'vendor_id') {
            aValue = getVendorName(a.vendor_id);
            bValue = getVendorName(b.vendor_id);
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
  }, [products, searchTerm, sortConfig, businesses, vendors]);

  // Pagination
  const totalItems = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentData = filteredProducts.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleSort = (key: keyof Product) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: keyof Product) => {
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
    const defaultDomain = businesses[0];
    const defaultVendor = vendors[0];

    downloadExcelWorkbook('mau_nhap_san_pham', [
      {
        name: 'Products',
        headers: ['Mã sản phẩm', 'Tên sản phẩm', 'Mã lĩnh vực', 'Mã nhà cung cấp', 'Đơn giá chuẩn (VNĐ)', 'Đơn vị tính'],
        rows: [
          ['VNPT_HIS', 'Giải pháp VNPT HIS', defaultDomain?.domain_code || 'KD006', defaultVendor?.vendor_code || 'DT006', '150000000', 'Gói'],
          ['SOC_MONITOR', 'Dịch vụ giám sát SOC', defaultDomain?.domain_code || 'KD003', defaultVendor?.vendor_code || 'DT007', '80000000', 'Gói'],
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
    if (type === 'csv') {
      const headers = ['Mã SP', 'Tên SP', 'Lĩnh vực', 'Nhà cung cấp', 'Đơn vị tính', 'Đơn giá chuẩn (VNĐ)', 'Ngày tạo'];
      const csvContent = [
        headers.join(','),
        ...filteredProducts.map(row => [
          row.product_code,
          `"${row.product_name}"`,
          `"${getDomainName(row.domain_id)}"`,
          `"${getVendorName(row.vendor_id)}"`,
          `"${row.unit || ''}"`,
          row.standard_price,
          row.created_at
        ].join(','))
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ds_san_pham_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
        alert('Chức năng đang phát triển');
    }
  };

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8 animate-fade-in">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Sản phẩm</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý danh mục sản phẩm, dịch vụ.</p>
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
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => onOpenModal('UPLOAD_PRODUCT_DOCUMENT')}
            className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">upload_file</span>
            <span className="hidden sm:inline">Upload tài liệu</span>
            <span className="sm:hidden">Upload</span>
          </button>
          <button onClick={() => onOpenModal('ADD_PRODUCT')} className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20">
            <span className="material-symbols-outlined">add</span>
            <span>Thêm mới</span>
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
             <p className="text-sm font-medium text-slate-500">Tổng số</p>
             <span className="p-2 bg-blue-50 text-blue-600 rounded-lg material-symbols-outlined">inventory_2</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{products.length}</p>
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

      {/* Table */}
      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-col md:flex-row gap-4 items-center">
           <div className="w-full md:flex-1 relative">
             <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
             <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Tìm kiếm mã hoặc tên sản phẩm..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none" />
           </div>
        </div>

        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm">
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse min-w-[1100px]">
               <thead className="bg-slate-50 border-y border-slate-200">
                 <tr>
                   {[
                     { label: 'Mã Sản phẩm', key: 'product_code' },
                     { label: 'Tên Sản phẩm', key: 'product_name' },
                     { label: 'Lĩnh vực', key: 'domain_id' },
                     { label: 'Nhà cung cấp', key: 'vendor_id' },
                     { label: 'Đơn vị tính', key: 'unit' },
                     { label: 'Đơn giá chuẩn', key: 'standard_price' }
                   ].map((col) => (
                     <th key={col.key} className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none" onClick={() => handleSort(col.key as keyof Product)}>
                       <div className="flex items-center gap-1">
                         <span className="text-deep-teal">{col.label}</span>
                         {renderSortIcon(col.key as keyof Product)}
                       </div>
                     </th>
                   ))}
                   <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right bg-slate-50 sticky right-0">Thao tác</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-200">
                 {currentData.length > 0 ? (
                   currentData.map((item) => (
                     <tr key={item.product_code} className="hover:bg-slate-50 transition-colors">
                       <td className="px-6 py-4 text-sm font-mono text-slate-500 font-bold">{item.product_code}</td>
                       <td className="px-6 py-4 text-sm font-semibold text-slate-900">{item.product_name}</td>
                       <td className="px-6 py-4 text-sm text-slate-600">{getDomainName(item.domain_id)}</td>
                       <td className="px-6 py-4 text-sm text-slate-600">{getVendorName(item.vendor_id)}</td>
                       <td className="px-6 py-4 text-sm text-slate-600">{formatUnit(item.unit)}</td>
                       <td className="px-6 py-4 text-sm font-bold text-slate-900">{formatVnd(item.standard_price)}</td>
                       <td className="px-6 py-4 text-right sticky right-0 bg-white shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
                         <div className="flex justify-end gap-2">
                           <button onClick={() => onOpenModal('UPLOAD_PRODUCT_DOCUMENT', item)} className="p-1.5 text-slate-400 hover:text-primary transition-colors" title="Upload tài liệu">
                             <span className="material-symbols-outlined text-lg">upload_file</span>
                           </button>
                           <button onClick={() => onOpenModal('EDIT_PRODUCT', item)} className="p-1.5 text-slate-400 hover:text-primary transition-colors" title="Chỉnh sửa"><span className="material-symbols-outlined text-lg">edit</span></button>
                           <button onClick={() => onOpenModal('DELETE_PRODUCT', item)} className="p-1.5 text-slate-400 hover:text-error transition-colors" title="Xóa"><span className="material-symbols-outlined text-lg">delete</span></button>
                         </div>
                       </td>
                     </tr>
                   ))
                 ) : (
                   <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">Không tìm thấy dữ liệu.</td></tr>
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
