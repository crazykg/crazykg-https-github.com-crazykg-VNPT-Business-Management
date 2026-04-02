
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
  UNRATED: 'bg-slate-200 text-slate-500',
  LOW: 'bg-secondary/15 text-secondary',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-red-100 text-red-700',
};

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  OPEN: 'bg-secondary/15 text-secondary',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-slate-200 text-slate-500',
  CANCELLED: 'bg-red-100 text-red-700',
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
    <div className="p-3 pb-6">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>feedback</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal leading-tight">Góp ý người dùng</h2>
            <p className="text-[11px] text-slate-400 leading-tight">Quản lý và theo dõi các góp ý từ người dùng hệ thống</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Export */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>
              Xuất
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-slate-200 z-10 overflow-hidden">
                <button onClick={handleExportCsv} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>table_view</span>
                  Xuất CSV
                </button>
                <button onClick={handleExportPdf} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 border-t border-slate-100">
                  <span className="material-symbols-outlined text-error" style={{ fontSize: 15 }}>picture_as_pdf</span>
                  Xuất PDF
                </button>
              </div>
            )}
          </div>

          {/* Add button */}
          {canWrite && onAdd && (
            <button
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors bg-primary text-white hover:bg-deep-teal shadow-sm"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
              Thêm góp ý
            </button>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        {/* Search */}
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Tìm theo tiêu đề, nội dung..."
            className="w-full h-8 pl-8 pr-3 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={handleStatusChange}
          className="h-8 px-3 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary min-w-[150px]"
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
          className="h-8 px-3 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary min-w-[150px]"
        >
          <option value="">Tất cả mức độ</option>
          {(Object.keys(PRIORITY_LABELS) as FeedbackPriority[]).map((p) => (
            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
          ))}
        </select>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <span className="material-symbols-outlined animate-spin mr-2" style={{ fontSize: 32 }}>progress_activity</span>
            <span className="text-xs">Đang tải...</span>
          </div>
        ) : pageSlice.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <span className="material-symbols-outlined" style={{ fontSize: 36 }}>feedback</span>
            <p className="text-xs font-semibold text-slate-700 mt-2">Không có góp ý nào</p>
            {canWrite && onAdd && (
              <button
                onClick={onAdd}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors bg-primary text-white hover:bg-deep-teal shadow-sm"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                Thêm góp ý đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 w-12">#</th>
                  <th className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Tiêu đề</th>
                  <th className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 w-32">Mức độ</th>
                  <th className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 w-32">Trạng thái</th>
                  <th className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 w-32">Người tạo</th>
                  <th className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 w-28">Ngày tạo</th>
                  <th className="text-right px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 w-24">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageSlice.map((fb, idx) => (
                  <tr key={fb.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-3 py-2 text-slate-400 text-[11px]">
                      {isRemotePaginated
                        ? ((paginationMeta?.page ?? 1) - 1) * (paginationMeta?.per_page ?? rowsPerPage) + idx + 1
                        : (currentPage - 1) * rowsPerPage + idx + 1}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => onView?.(fb)}
                        className="text-xs font-semibold text-primary hover:underline text-left line-clamp-2"
                        title={fb.title}
                      >
                        {fb.title}
                      </button>
                      {fb.description && (
                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{fb.description}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${PRIORITY_COLORS[fb.priority]}`}>
                        {PRIORITY_LABELS[fb.priority]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[fb.status]}`}>
                        {STATUS_LABELS[fb.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 14 }}>person</span>
                        <span className="text-[11px] text-slate-600 truncate max-w-[110px]" title={resolveCreator(fb.created_by)}>
                          {resolveCreator(fb.created_by)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-500 text-[11px] whitespace-nowrap">
                      {fb.created_at ? formatDateDdMmYyyy(fb.created_at) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onView?.(fb)}
                          title="Xem chi tiết"
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded transition-colors"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span>
                        </button>
                        {canWrite && (
                          <button
                            onClick={() => onEdit?.(fb)}
                            title="Chỉnh sửa"
                            className="p-1.5 text-slate-400 hover:text-warning hover:bg-warning/10 rounded transition-colors"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => onDelete?.(fb)}
                            title="Xóa"
                            className="p-1.5 text-slate-400 hover:text-error hover:bg-error/10 rounded transition-colors"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
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

      {/* ── Pagination ── */}
      {!isLoading && (isRemotePaginated ? (paginationMeta?.total ?? 0) > 0 : totalLocal > 0) && (
        <div className="mt-3">
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
