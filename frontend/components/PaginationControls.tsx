import React, { useMemo, useState } from 'react';

interface PaginationControlsProps {
  currentPage: number;
  totalItems?: number;
  total?: number;
  rowsPerPage?: number;
  perPage?: number;
  totalPages?: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange?: (rows: number) => void;
  rowsPerPageOptions?: number[];
}

export const PaginationControls: React.FC<PaginationControlsProps> = React.memo(function PaginationControlsComponent({
  currentPage,
  totalItems,
  total,
  rowsPerPage,
  perPage,
  totalPages,
  onPageChange,
  onRowsPerPageChange,
  rowsPerPageOptions = [20, 50, 100, 200],
}) {
  const [jumpInput, setJumpInput] = useState('');
  const resolvedTotalItems = Math.max(0, Number(totalItems ?? total ?? 0));

  const safeRowsPerPage = Number.isFinite(Number(rowsPerPage ?? perPage)) && Number(rowsPerPage ?? perPage) > 0
    ? Math.max(1, Math.floor(Number(rowsPerPage ?? perPage)))
    : 20;

  const normalizedRowsPerPageOptions = useMemo(() => {
    const optionSet = new Set<number>();
    (rowsPerPageOptions || []).forEach((value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) return;
      optionSet.add(Math.floor(parsed));
    });
    optionSet.add(safeRowsPerPage);
    return Array.from(optionSet).sort((a, b) => a - b);
  }, [rowsPerPageOptions, safeRowsPerPage]);

  const resolvedTotalPages = Math.max(
    1,
    Number.isFinite(Number(totalPages)) && Number(totalPages) > 0
      ? Math.floor(Number(totalPages))
      : Math.ceil(resolvedTotalItems / safeRowsPerPage),
  );
  const safePage = Math.min(Math.max(currentPage, 1), resolvedTotalPages);
  const from = resolvedTotalItems === 0 ? 0 : (safePage - 1) * safeRowsPerPage + 1;
  const to = Math.min(safePage * safeRowsPerPage, resolvedTotalItems);

  // Ellipsis pagination: show at most 7 buttons
  const visiblePages = useMemo(() => {
    if (resolvedTotalPages <= 7) return Array.from({ length: resolvedTotalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [];
    const delta = 1; // pages around current
    const range: number[] = [];
    for (
      let i = Math.max(2, safePage - delta);
      i <= Math.min(resolvedTotalPages - 1, safePage + delta);
      i++
    ) {
      range.push(i);
    }
    pages.push(1);
    if (range[0] > 2) pages.push('...');
    range.forEach((p) => pages.push(p));
    if (range[range.length - 1] < resolvedTotalPages - 1) pages.push('...');
    pages.push(resolvedTotalPages);
    return pages;
  }, [resolvedTotalPages, safePage]);

  const handleJump = () => {
    const val = parseInt(jumpInput, 10);
    if (Number.isFinite(val) && val >= 1 && val <= resolvedTotalPages) {
      onPageChange(val);
    }
    setJumpInput('');
  };

  return (
    <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4">

      {/* Left: rows per page + total info */}
      <div className="flex items-center gap-4 text-sm text-slate-600 order-3 md:order-1">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Dòng/trang</label>
          {normalizedRowsPerPageOptions.length > 1 && onRowsPerPageChange ? (
            <div className="relative">
              <select
                value={safeRowsPerPage}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  if (!Number.isFinite(parsed) || parsed <= 0) return;
                  onRowsPerPageChange(Math.floor(parsed));
                }}
                className="h-8 min-w-[72px] appearance-none rounded-md border border-slate-200 bg-white pl-2.5 pr-7 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/20"
                aria-label="Số dòng trên mỗi trang"
              >
                {normalizedRowsPerPageOptions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">
                expand_more
              </span>
            </div>
          ) : (
            <span className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
              {safeRowsPerPage}
            </span>
          )}
        </div>

        <span className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{from.toLocaleString('vi-VN')}</span>
          {' – '}
          <span className="font-semibold text-slate-700">{to.toLocaleString('vi-VN')}</span>
          {' / '}
          <span className="font-semibold text-slate-700">{resolvedTotalItems.toLocaleString('vi-VN')}</span>
          {' bản ghi'}
        </span>
      </div>

      {/* Center: page buttons */}
      <div className="flex items-center gap-1 order-1 md:order-2">
        <button
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
          className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition-colors hover:bg-slate-50 disabled:opacity-40"
          title="Trang đầu"
        >
          <span className="material-symbols-outlined text-[14px]">first_page</span>
        </button>
        <button
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition-colors hover:bg-slate-50 disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[14px]">chevron_left</span>
        </button>

        <div className="flex items-center gap-0.5">
          {visiblePages.map((page, idx) =>
            page === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-1 text-xs text-slate-400">…</span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page as number)}
                className={`flex h-7 min-w-[28px] items-center justify-center rounded px-1.5 text-xs font-bold transition-all ${
                  safePage === page
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {page}
              </button>
            )
          )}
        </div>

        <button
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= resolvedTotalPages}
          className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition-colors hover:bg-slate-50 disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        </button>
        <button
          onClick={() => onPageChange(resolvedTotalPages)}
          disabled={safePage >= resolvedTotalPages}
          className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition-colors hover:bg-slate-50 disabled:opacity-40"
          title="Trang cuối"
        >
          <span className="material-symbols-outlined text-[14px]">last_page</span>
        </button>
      </div>

      {/* Right: jump to page (only when > 10 pages) */}
      <div className="order-2 md:order-3">
        {resolvedTotalPages > 10 ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 whitespace-nowrap">Đến trang</span>
            <input
              type="number"
              min={1}
              max={resolvedTotalPages}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJump();
              }}
              placeholder={String(safePage)}
              className="h-8 w-16 rounded-md border border-slate-200 bg-white px-2 text-center text-xs font-semibold text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            />
            <button
              onClick={handleJump}
              className="flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">
            Trang {safePage}/{resolvedTotalPages}
          </span>
        )}
      </div>
    </div>
  );
});
