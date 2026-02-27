import React from 'react';
import { SearchableSelect } from './SearchableSelect';

interface PaginationControlsProps {
  currentPage: number;
  totalItems: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
  rowsPerPageOptions?: number[];
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalItems,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  rowsPerPageOptions = [5, 10, 20, 50],
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const from = totalItems === 0 ? 0 : (safePage - 1) * rowsPerPage + 1;
  const to = Math.min(safePage * rowsPerPage, totalItems);
  const visiblePages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (page) => page === 1 || page === totalPages || (page >= safePage - 1 && page <= safePage + 1)
  );

  return (
    <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3 text-sm text-slate-600 order-3 md:order-1">
        <label className="font-medium">Số dòng/trang</label>
        <SearchableSelect
          className="w-[88px]"
          compact
          value={rowsPerPage}
          onChange={(value) => onRowsPerPageChange(Number(value))}
          options={rowsPerPageOptions.map((value) => ({ value, label: String(value) }))}
          triggerClassName="h-8 px-2 rounded border border-slate-300 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 text-sm"
        />
      </div>

      <p className="text-sm text-slate-500 order-2 md:order-2">
        <span className="font-medium">{from}</span>-<span className="font-medium">{to}</span> of <span className="font-medium">{totalItems}</span>
      </p>

      <div className="flex items-center gap-2 order-1 md:order-3">
        <button
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="p-1 rounded border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-sm">chevron_left</span>
        </button>

        <div className="flex gap-1">
          {visiblePages.map((page, index) => (
            <React.Fragment key={page}>
              {index > 0 && visiblePages[index - 1] !== page - 1 && (
                <span className="px-1 text-slate-400">...</span>
              )}
              <button
                onClick={() => onPageChange(page)}
                className={`flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                  safePage === page
                    ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {page}
              </button>
            </React.Fragment>
          ))}
        </div>

        <button
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          className="p-1 rounded border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-sm">chevron_right</span>
        </button>
      </div>
    </div>
  );
};
