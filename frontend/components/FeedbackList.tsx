
import React, { useState, useMemo, useCallback } from 'react';
import { FeedbackRequest, FeedbackPriority, FeedbackStatus, PaginationMeta, PaginatedQuery, Employee } from '../types';
import { PaginationControls } from './PaginationControls';
import { formatDateDdMmYyyy } from '../utils/dateDisplay';
import { exportCsv, exportPdfTable, isoDateStamp } from '../utils/exportUtils';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<FeedbackPriority, string> = {
  UNRATED: 'Chưa đánh giá',
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  OPEN: 'Mở',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã giải quyết',
  CLOSED: 'Đã đóng',
  CANCELLED: 'Đã huỷ',
};

const PRIORITY_COLORS: Record<FeedbackPriority, string> = {
  UNRATED: 'bg-slate-100 text-slate-600',
  LOW: 'bg-sky-100 text-sky-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-red-100 text-red-700',
};

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-slate-100 text-slate-500',
  CANCELLED: 'bg-red-50 text-red-500',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface FeedbackListProps {
  feedbacks: FeedbackRequest[];
  employees?: Employee[];
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
  paginationMeta?: PaginationMeta;
  isLoading?: boolean;
  onQueryChange?: (query: PaginatedQuery & { filters?: { q?: string; status?: string; priority?: string } }) => void;
  canWrite?: boolean;
  canDelete?: boolean;
  onAdd?: () => void;
  onEdit?: (item: FeedbackRequest) => void;
  onDelete?: (item: FeedbackRequest) => void;
  onView?: (item: FeedbackRequest) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const FeedbackList: React.FC<FeedbackListProps> = ({
  feedbacks = [],
  employees = [],
  onNotify,
  paginationMeta,
  isLoading = false,
  onQueryChange,
  canWrite = false,
  canDelete = false,
  onAdd,
  onEdit,
  onDelete,
  onView,
}: FeedbackListProps) => {
  // ── Local state ──────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<FeedbackPriority | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // ── Employee lookup ──────────────────────────────────────────────────────
  const employeeMap = useMemo(() => {
    const map = new Map<number, string>();
    employees.forEach((e) => {
      if (e.id != null) map.set(Number(e.id), e.full_name ?? e.username ?? `#${e.id}`);
    });
    return map;
  }, [employees]);

  const resolveCreator = (id: number | null | undefined): string => {
    if (id == null) return '—';
    return employeeMap.get(Number(id)) ?? `#${id}`;
  };

  // ── Remote pagination mode ───────────────────────────────────────────────
  const isRemotePaginated = Boolean(paginationMeta && onQueryChange);

  const applyRemoteQuery = useCallback(
    (overrides: Partial<{ page: number; per_page: number; q: string; status: string; priority: string }> = {}) => {
      if (!onQueryChange) return;
      const q = overrides.q ?? searchTerm;
      const status = overrides.status ?? statusFilter;
      const priority = overrides.priority ?? priorityFilter;
      onQueryChange({
        page: overrides.page ?? currentPage,
        per_page: overrides.per_page ?? rowsPerPage,
        filters: {
          ...(q ? { q } : {}),
          ...(status ? { status } : {}),
          ...(priority ? { priority } : {}),
        },
      });
    },
    [onQueryChange, searchTerm, statusFilter, priorityFilter, currentPage, rowsPerPage]
  );

  // ── Local filter (non-remote) ────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (isRemotePaginated) return feedbacks;
    const q = searchTerm.toLowerCase();
    return feedbacks.filter((fb) => {
      const matchQ =
        !q ||
        fb.title.toLowerCase().includes(q) ||
        (fb.description ?? '').toLowerCase().includes(q);
      const matchStatus = !statusFilter || fb.status === statusFilter;
      const matchPriority = !priorityFilter || fb.priority === priorityFilter;
      return matchQ && matchStatus && matchPriority;
    });
  }, [feedbacks, searchTerm, statusFilter, priorityFilter, isRemotePaginated]);

  const totalLocal = filtered.length;
  const totalPages = isRemotePaginated
    ? paginationMeta?.total_pages ?? 1
    : Math.max(1, Math.ceil(totalLocal / rowsPerPage));

  const pageSlice = useMemo(() => {
    if (isRemotePaginated) return filtered;
    const start = (currentPage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, currentPage, rowsPerPage, isRemotePaginated]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setCurrentPage(1);
    if (isRemotePaginated) applyRemoteQuery({ q: value, page: 1 });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as FeedbackStatus | '';
    setStatusFilter(value);
    setCurrentPage(1);
    if (isRemotePaginated) applyRemoteQuery({ status: value, page: 1 });
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as FeedbackPriority | '';
    setPriorityFilter(value);
    setCurrentPage(1);
    if (isRemotePaginated) applyRemoteQuery({ priority: value, page: 1 });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    if (isRemotePaginated) applyRemoteQuery({ page });
  };

  const handleRowsPerPageChange = (rpp: number) => {
    setRowsPerPage(rpp);
    setCurrentPage(1);
    if (isRemotePaginated) applyRemoteQuery({ per_page: rpp, page: 1 });
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const exportHeaders = ['ID', 'Tiêu đề', 'Mô tả', 'Người tạo', 'Ưu tiên', 'Trạng thái', 'Ngày tạo'];
  const exportRows = filtered.map((fb) => [
    String(fb.id),
    fb.title,
    fb.description ?? '',
    resolveCreator(fb.created_by),
    PRIORITY_LABELS[fb.priority] ?? fb.priority,
    STATUS_LABELS[fb.status] ?? fb.status,
    fb.created_at ? formatDateDdMmYyyy(fb.created_at) : '',
  ]);

  const handleExportCsv = () => {
    exportCsv(`gop-y-nguoi-dung-${isoDateStamp()}.csv`, exportHeaders, exportRows);
    setShowExportMenu(false);
  };

  const handleExportPdf = () => {
    exportPdfTable({
      fileName: `gop-y-nguoi-dung-${isoDateStamp()}.pdf`,
      title: 'Danh sách góp ý người dùng',
      headers: exportHeaders,
      rows: exportRows,
    });
    setShowExportMenu(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 md:px-8 py-4 md:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Góp ý người dùng</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Quản lý và theo dõi các góp ý từ người dùng hệ thống
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Xuất
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-100 z-10 overflow-hidden">
                <button onClick={handleExportCsv} className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                  <span className="material-symbols-outlined text-[18px] text-green-600">table_view</span>
                  Xuất CSV
                </button>
                <button onClick={handleExportPdf} className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                  <span className="material-symbols-outlined text-[18px] text-red-600">picture_as_pdf</span>
                  Xuất PDF
                </button>
              </div>
            )}
          </div>

          {/* Add button */}
          {canWrite && onAdd && (
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Thêm góp ý
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Tìm theo tiêu đề, nội dung..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={handleStatusChange}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-w-[160px]"
        >
          <option value="">Tất cả trạng thái</option>
          {(Object.keys(STATUS_LABELS) as FeedbackStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={handlePriorityChange}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-w-[160px]"
        >
          <option value="">Tất cả mức độ</option>
          {(Object.keys(PRIORITY_LABELS) as FeedbackPriority[]).map((p) => (
            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <span className="material-symbols-outlined animate-spin text-4xl mr-3">progress_activity</span>
            <span className="text-sm">Đang tải...</span>
          </div>
        ) : pageSlice.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="material-symbols-outlined text-5xl mb-3">feedback</span>
            <p className="text-sm font-medium">Không có góp ý nào</p>
            {canWrite && onAdd && (
              <button onClick={onAdd} className="mt-4 flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors">
                <span className="material-symbols-outlined text-[18px]">add</span>
                Thêm góp ý đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 w-14">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Tiêu đề</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 w-36">Mức độ ưu tiên</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 w-36">Trạng thái</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 w-36">Người tạo</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 w-32">Ngày tạo</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 w-28">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageSlice.map((fb, idx) => (
                  <tr key={fb.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {isRemotePaginated
                        ? ((paginationMeta?.page ?? 1) - 1) * (paginationMeta?.per_page ?? rowsPerPage) + idx + 1
                        : (currentPage - 1) * rowsPerPage + idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onView?.(fb)}
                        className="font-medium text-primary hover:underline text-left line-clamp-2"
                        title={fb.title}
                      >
                        {fb.title}
                      </button>
                      {fb.description && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{fb.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${PRIORITY_COLORS[fb.priority]}`}>
                        {PRIORITY_LABELS[fb.priority]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[fb.status]}`}>
                        {STATUS_LABELS[fb.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px] text-slate-400">person</span>
                        <span className="text-xs text-slate-600 truncate max-w-[120px]" title={resolveCreator(fb.created_by)}>
                          {resolveCreator(fb.created_by)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {fb.created_at ? formatDateDdMmYyyy(fb.created_at) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onView?.(fb)}
                          title="Xem chi tiết"
                          className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        {canWrite && (
                          <button
                            onClick={() => onEdit?.(fb)}
                            title="Chỉnh sửa"
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => onDelete?.(fb)}
                            title="Xóa"
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && (isRemotePaginated ? (paginationMeta?.total ?? 0) > 0 : totalLocal > 0) && (
        <div className="mt-4">
          <PaginationControls
            currentPage={isRemotePaginated ? (paginationMeta?.page ?? currentPage) : currentPage}
            totalPages={totalPages}
            totalItems={isRemotePaginated ? (paginationMeta?.total ?? 0) : totalLocal}
            rowsPerPage={isRemotePaginated ? (paginationMeta?.per_page ?? rowsPerPage) : rowsPerPage}
            onPageChange={handlePageChange}
            onRowsPerPageChange={handleRowsPerPageChange}
          />
        </div>
      )}
    </div>
  );
};
