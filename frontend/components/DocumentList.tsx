
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
        <span className="material-symbols-outlined text-sm ml-1 transition-transform duration-200" style={{ transform: sortConfig.direction === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          arrow_upward
        </span>
      );
    }
    return <span className="material-symbols-outlined text-sm text-slate-300 ml-1">unfold_more</span>;
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
    <div className="px-4 pb-20 pt-4 md:px-8 md:pb-10 md:pt-8">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_50px_-32px_rgba(15,23,42,0.28)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.09),_transparent_30%)]" />
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.38em] text-teal-600">Document Center</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-[2.15rem]">
                Hồ sơ tài liệu
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-[15px]">
                Quản lý hợp đồng, biên bản, chứng chỉ và các tài liệu đang vận hành cùng khách hàng trong một workspace dễ tra cứu và thao tác.
              </p>
            </div>

            <button
              onClick={() => onOpenModal('ADD_DOCUMENT')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0f766e] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-20px_rgba(15,118,110,0.95)] transition hover:-translate-y-0.5 hover:bg-[#115e59]"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span>Thêm tài liệu</span>
            </button>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Tổng hồ sơ',
                value: serverMode ? (paginationMeta?.total || 0) : documents.length,
                note: serverMode ? 'Toàn bộ dữ liệu theo phân trang máy chủ' : 'Toàn bộ tài liệu đang có trong bộ nhớ',
                icon: 'folder_managed',
                accent: 'from-sky-500/15 via-white to-white text-sky-600',
              },
              {
                label: 'Đang hiển thị',
                value: visibleDocuments.length,
                note: 'Số bản ghi đang xuất hiện trên trang hiện tại',
                icon: 'table_rows',
                accent: 'from-violet-500/15 via-white to-white text-violet-600',
              },
              {
                label: 'Hiệu lực trên trang',
                value: activeVisibleCount,
                note: 'Đếm theo dữ liệu đang hiển thị sau khi lọc',
                icon: 'verified',
                accent: 'from-emerald-500/15 via-white to-white text-emerald-600',
              },
              {
                label: 'Khách hàng liên kết',
                value: linkedCustomerCount,
                note: 'Số khách hàng khác nhau trong danh sách đang xem',
                icon: 'handshake',
                accent: 'from-amber-500/15 via-white to-white text-amber-600',
              },
            ].map((card) => (
              <article
                key={card.label}
                className={`rounded-[24px] border border-slate-200 bg-gradient-to-br p-5 shadow-sm ${card.accent}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.26em] text-slate-500">{card.label}</p>
                    <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{card.value}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-500">{card.note}</p>
                  </div>
                  <span className="material-symbols-outlined rounded-2xl bg-white/85 p-3 text-[24px] shadow-sm">
                    {card.icon}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_50px_-32px_rgba(15,23,42,0.22)]">
        <div className="border-b border-slate-200 px-5 py-5 md:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.34em] text-slate-400">Bộ lọc</p>
              <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">Tra cứu và rà soát tài liệu</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Tìm nhanh theo mã, tên tài liệu hoặc khách hàng, sau đó sắp xếp và xử lý từng hồ sơ ngay trên bảng.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
              <span className={`h-2 w-2 rounded-full ${isLoading ? 'animate-pulse bg-amber-400' : 'bg-emerald-400'}`} />
              {isLoading ? 'Đang đồng bộ dữ liệu...' : `${visibleDocuments.length} dòng đang hiển thị`}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
            <label className="relative block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Từ khóa</span>
              <span className="material-symbols-outlined absolute left-4 top-[calc(50%+14px)] -translate-y-1/2 text-slate-400">search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo mã, tên tài liệu, khách hàng..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
              />
            </label>

            <div>
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Trạng thái</span>
              <SearchableSelect
                className="w-full"
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusFilterOptions}
                placeholder="Tất cả trạng thái"
                triggerClassName="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
              />
            </div>
          </div>

          {activeFilterBadges.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {activeFilterBadges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-5 md:px-6">
          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left">
                <thead className="bg-slate-50/90">
                  <tr className="border-b border-slate-200">
                    {[
                      { label: 'Mã tài liệu', key: 'id' },
                      { label: 'Tên tài liệu', key: 'name' },
                      { label: 'Loại tài liệu', key: 'typeId' },
                      { label: 'Khách hàng', key: 'customerId' },
                      { label: 'Trạng thái', key: 'status' }
                    ].map((col) => (
                      <th
                        key={col.key}
                        className="cursor-pointer px-5 py-4 text-xs font-black uppercase tracking-[0.24em] text-slate-500 transition-colors hover:bg-slate-100 select-none"
                        onClick={() => handleSort(col.key as keyof Document)}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{col.label}</span>
                          {renderSortIcon(col.key as keyof Document)}
                        </div>
                      </th>
                    ))}
                    <th className="sticky right-0 bg-slate-50/95 px-5 py-4 text-right text-xs font-black uppercase tracking-[0.24em] text-slate-500 backdrop-blur">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {visibleDocuments.length > 0 ? (
                    visibleDocuments.map((item) => (
                      <tr key={item.id} className="align-top transition-colors hover:bg-slate-50/80">
                        <td className="px-5 py-4">
                          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm font-bold text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                            {item.id}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="max-w-[300px]">
                            <p className="text-sm font-semibold leading-6 text-slate-900" title={item.name}>
                              {item.name}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{getDateCaption(item)}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="max-w-[220px]">
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                              {getDocumentTypeName(item.typeId)}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="max-w-[260px]">
                            <p className="truncate text-sm font-medium text-slate-700" title={getCustomerName(item.customerId)}>
                              {getCustomerName(item.customerId)}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{getAttachmentCaption(item)}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${getStatusColor(item.status)}`}>
                            {getStatusLabel(item.status)}
                          </span>
                        </td>
                        <td className="sticky right-0 bg-white px-5 py-4 text-right shadow-[-16px_0_20px_-16px_rgba(15,23,42,0.18)]">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => onOpenModal('EDIT_DOCUMENT', item)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-teal-200 hover:text-teal-700"
                              title="Chỉnh sửa"
                            >
                              <span className="material-symbols-outlined text-[20px]">edit</span>
                            </button>
                            <button
                              onClick={() => onOpenModal('DELETE_DOCUMENT', item)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-100 bg-red-50/40 text-red-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                              title="Xóa"
                            >
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-14">
                        <div className="flex flex-col items-center justify-center rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center">
                          <span className="material-symbols-outlined rounded-2xl bg-white p-4 text-[28px] text-slate-400 shadow-sm">
                            folder_off
                          </span>
                          <p className="mt-4 text-base font-semibold text-slate-700">
                            {isLoading ? 'Đang tải dữ liệu...' : 'Không tìm thấy tài liệu phù hợp'}
                          </p>
                          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                            {isLoading
                              ? 'Hệ thống đang đồng bộ danh sách tài liệu từ máy chủ.'
                              : 'Thử thay đổi từ khóa hoặc bỏ bớt bộ lọc để mở rộng kết quả hiển thị.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 bg-slate-50/70">
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
      </section>
    </div>
  );
};
