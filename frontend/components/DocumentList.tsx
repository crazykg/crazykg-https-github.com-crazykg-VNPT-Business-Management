
import React, { useState, useMemo, useEffect } from 'react';
import type { ModalType, PaginatedQuery, PaginationMeta } from '../types';
import type { Customer } from '../types/customer';
import type { Document } from '../types/document';
import { DOCUMENT_STATUSES, DOCUMENT_TYPES } from '../constants';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect } from './SearchableSelect';

interface DocumentListQuery extends PaginatedQuery {
  filters?: {
    status?: string;
  };
}

interface DocumentListProps {
  documents: Document[];
  customers: Customer[];
  onOpenModal: (type: ModalType, item?: Document) => void;
  paginationMeta?: PaginationMeta;
  isLoading?: boolean;
  onQueryChange?: (query: DocumentListQuery) => void;
}

const ITEMS_PER_PAGE = 7;

export const DocumentList: React.FC<DocumentListProps> = ({
  documents = [],
  customers = [],
  onOpenModal,
  paginationMeta,
  isLoading = false,
  onQueryChange,
}: DocumentListProps) => {
  const serverMode = Boolean(onQueryChange && paginationMeta);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Document; direction: 'asc' | 'desc' } | null>(null);

  const getCustomerName = (id?: string | number | null) => {
    const customer = (customers || []).find(c => String(c.id) === String(id));
    return customer ? `${customer.customer_code} - ${customer.customer_name}` : String(id ?? '');
  };
  const getDocumentTypeName = (id?: string | null) => DOCUMENT_TYPES.find(t => t.id === id)?.name || String(id ?? '');
  const getStatusLabel = (status: string) => DOCUMENT_STATUSES.find(s => s.value === status)?.label || status;
  const getStatusColor = (status: string) => DOCUMENT_STATUSES.find(s => s.value === status)?.color || 'bg-slate-100 text-slate-700';

  const filteredDocuments = useMemo(() => {
    if (serverMode) {
      return documents || [];
    }

    let result = (documents || []).filter(doc => {
      const customerName = getCustomerName(doc.customerId).toLowerCase();
      const docName = doc.name.toLowerCase();
      const docCode = doc.id.toLowerCase();
      const searchLower = searchTerm.toLowerCase();

      const matchesSearch = docName.includes(searchLower) || docCode.includes(searchLower) || customerName.includes(searchLower);
      const matchesStatus = statusFilter ? doc.status === statusFilter : true;

      return matchesSearch && matchesStatus;
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        if (sortConfig.key === 'customerId') {
            aValue = getCustomerName(a.customerId);
            bValue = getCustomerName(b.customerId);
        } else if (sortConfig.key === 'typeId') {
            aValue = getDocumentTypeName(a.typeId);
            bValue = getDocumentTypeName(b.typeId);
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
  }, [serverMode, documents, searchTerm, statusFilter, sortConfig, customers]);

  const statusFilterOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả trạng thái' },
      ...DOCUMENT_STATUSES.map((status) => ({ value: status.value, label: status.label })),
    ],
    []
  );

  // Pagination
  const totalItems = serverMode ? (paginationMeta?.total || 0) : filteredDocuments.length;
  const totalPages = serverMode
    ? Math.max(1, paginationMeta?.total_pages || 1)
    : Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!serverMode || !onQueryChange) {
      return;
    }

    onQueryChange({
      page: currentPage,
      per_page: ITEMS_PER_PAGE,
      q: searchTerm.trim(),
      sort_by: sortConfig?.key ? String(sortConfig.key) : 'id',
      sort_dir: sortConfig?.direction || 'desc',
      filters: {
        status: statusFilter,
      },
    });
  }, [serverMode, onQueryChange, currentPage, searchTerm, statusFilter, sortConfig]);

  const currentData = serverMode
    ? (documents || [])
    : filteredDocuments.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );

  const visibleDocuments = currentData || [];
  const activeVisibleCount = visibleDocuments.filter((item) => item.status === 'ACTIVE').length;
  const linkedCustomerCount = new Set(
    visibleDocuments
      .map((item) => item.customerId)
      .filter((value): value is Exclude<typeof value, null | undefined | ''> => value !== null && value !== undefined && value !== '')
      .map((value) => String(value))
  ).size;
  const currentStatusOption = statusFilterOptions.find((option) => option.value === statusFilter);
  const activeFilterBadges = [
    searchTerm.trim() ? `Từ khóa: ${searchTerm.trim()}` : null,
    statusFilter ? `Trạng thái: ${currentStatusOption?.label || statusFilter}` : null,
  ].filter(Boolean) as string[];

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleSort = (key: keyof Document) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: keyof Document) => {
    if (sortConfig?.key === key) {
      return (
        <span className="material-symbols-outlined ml-1 transition-transform duration-200" style={{ fontSize: 14, transform: sortConfig.direction === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          arrow_upward
        </span>
      );
    }
    return <span className="material-symbols-outlined text-slate-300 ml-1" style={{ fontSize: 14 }}>unfold_more</span>;
  };

  const getDateCaption = (item: Document) => {
    if (item.expiryDate) {
      return `HSD ${item.expiryDate}`;
    }

    if (item.releaseDate) {
      return `Ban hành ${item.releaseDate}`;
    }

    if (item.createdDate) {
      return `Tạo ngày ${item.createdDate}`;
    }

    return 'Chưa gắn mốc thời gian';
  };

  const getAttachmentCaption = (item: Document) => {
    const attachmentCount = item.attachments?.length || 0;
    if (attachmentCount > 0) {
      return `${attachmentCount} tệp đính kèm`;
    }

    return 'Chưa có tệp đính kèm';
  };

  return (
    <div className="p-3 pb-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>folder_open</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal leading-tight">Hồ sơ tài liệu</h2>
            <p className="text-[11px] text-slate-400 leading-tight">Quản lý hợp đồng, biên bản, chứng chỉ và tài liệu vận hành</p>
          </div>
        </div>
        <button
          onClick={() => onOpenModal('ADD_DOCUMENT')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-colors text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg,#004481,#005BAA)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
          Thêm tài liệu
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
        {[
          {
            label: 'Tổng hồ sơ',
            value: serverMode ? (paginationMeta?.total || 0) : documents.length,
            note: serverMode ? 'Toàn bộ dữ liệu theo phân trang máy chủ' : 'Toàn bộ tài liệu đang có',
            icon: 'folder_managed',
          },
          {
            label: 'Đang hiển thị',
            value: visibleDocuments.length,
            note: 'Bản ghi trên trang hiện tại',
            icon: 'table_rows',
          },
          {
            label: 'Hiệu lực trên trang',
            value: activeVisibleCount,
            note: 'Đếm theo dữ liệu sau khi lọc',
            icon: 'verified',
          },
          {
            label: 'Khách hàng liên kết',
            value: linkedCustomerCount,
            note: 'Số KH khác nhau trong danh sách',
            icon: 'handshake',
          },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-neutral">{card.label}</span>
              <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>{card.icon}</span>
              </div>
            </div>
            <p className="text-xl font-black text-deep-teal leading-tight">{card.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{card.note}</p>
          </div>
        ))}
      </div>

      {/* Filter + table section */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Filter bar */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-bold text-slate-700">Tra cứu và rà soát tài liệu</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Tìm nhanh theo mã, tên tài liệu hoặc khách hàng</p>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-500">
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isLoading ? 'animate-pulse bg-warning' : 'bg-success'}`} />
              {isLoading ? 'Đang đồng bộ...' : `${visibleDocuments.length} dòng`}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_240px]">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={{ fontSize: 15 }}>search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo mã, tên tài liệu, khách hàng..."
                className="h-8 w-full rounded border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <SearchableSelect
              className="w-full"
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusFilterOptions}
              placeholder="Tất cả trạng thái"
              triggerClassName="h-8 w-full rounded border border-slate-200 bg-slate-50 px-3 pr-8 text-xs text-slate-700 outline-none transition focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {activeFilterBadges.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {activeFilterBadges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-medium text-on-surface-variant"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="p-3">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    {[
                      { label: 'Mã tài liệu', key: 'id' },
                      { label: 'Tên tài liệu', key: 'name' },
                      { label: 'Loại tài liệu', key: 'typeId' },
                      { label: 'Khách hàng', key: 'customerId' },
                      { label: 'Trạng thái', key: 'status' },
                    ].map((col) => (
                      <th
                        key={col.key}
                        className="cursor-pointer px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 transition-colors hover:bg-slate-100 select-none"
                        onClick={() => handleSort(col.key as keyof Document)}
                      >
                        <div className="flex items-center gap-1">
                          <span>{col.label}</span>
                          {renderSortIcon(col.key as keyof Document)}
                        </div>
                      </th>
                    ))}
                    <th className="sticky right-0 bg-slate-50/95 px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 backdrop-blur">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleDocuments.length > 0 ? (
                    visibleDocuments.map((item) => (
                      <tr key={item.id} className="align-middle transition-colors hover:bg-surface-variant">
                        <td className="px-3 py-2.5">
                          <span className="inline-flex rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                            {item.id}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="max-w-[280px]">
                            <p className="text-xs font-semibold text-slate-900 leading-snug" title={item.name}>
                              {item.name}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{getDateCaption(item)}</p>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            {getDocumentTypeName(item.typeId)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="max-w-[240px]">
                            <p className="truncate text-xs font-medium text-slate-700" title={getCustomerName(item.customerId)}>
                              {getCustomerName(item.customerId)}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{getAttachmentCaption(item)}</p>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${getStatusColor(item.status)}`}>
                            {getStatusLabel(item.status)}
                          </span>
                        </td>
                        <td className="sticky right-0 bg-white px-3 py-2.5 text-right shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.1)]">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => onOpenModal('EDIT_DOCUMENT', item)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-on-surface-variant transition hover:bg-slate-50"
                              title="Chỉnh sửa"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                            </button>
                            <button
                              onClick={() => onOpenModal('DELETE_DOCUMENT', item)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded bg-error/10 text-error border border-error/20 transition hover:bg-error/20"
                              title="Xóa"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8">
                        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
                          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                            <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 18 }}>folder_off</span>
                          </div>
                          <p className="mt-3 text-xs font-semibold text-slate-700">
                            {isLoading ? 'Đang tải dữ liệu...' : 'Không tìm thấy tài liệu phù hợp'}
                          </p>
                          <p className="mt-1 max-w-xs text-[11px] text-slate-400">
                            {isLoading
                              ? 'Hệ thống đang đồng bộ danh sách tài liệu từ máy chủ.'
                              : 'Thử thay đổi từ khóa hoặc bỏ bớt bộ lọc để mở rộng kết quả.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 bg-slate-50/70">
              <PaginationControls
                currentPage={currentPage}
                totalItems={totalItems}
                rowsPerPage={ITEMS_PER_PAGE}
                onPageChange={goToPage}
                onRowsPerPageChange={() => undefined}
                rowsPerPageOptions={[ITEMS_PER_PAGE]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
