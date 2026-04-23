import React, { useMemo, useState } from 'react';
import type { PaginationMeta } from '../../types/common';
import type { YeuCau } from '../../types/customerRequest';
import { PaginationControls } from '../PaginationControls';
import { type SearchableSelectOption } from '../SearchableSelect';
import { SearchableMultiSelect } from '../SearchableMultiSelect';
import {
  buildRequestContextCaption,
  resolveHealthSummaryMeta,
  resolveHoursSummaryMeta,
  type CustomerRequestPrimaryActionMeta,
  type CustomerRequestRoleFilter,
} from './presentation';
import {
  useCustomerRequestResponsiveLayout,
  type CustomerRequestResponsiveLayoutMode,
} from './hooks/useCustomerRequestResponsiveLayout';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';

type CustomerRequestListPaneProps = {
  activeProcessCodes: string[];
  processOptions: SearchableSelectOption[];
  onProcessCodesChange: (values: string[]) => void;
  requestKeyword: string;
  onRequestKeywordChange: (value: string) => void;
  onSubmitKeywordSearch: () => void;
  showHandlerSearch?: boolean;
  requestHandlerKeyword?: string;
  onRequestHandlerKeywordChange?: (value: string) => void;
  requestEntityFilter: string[];
  onRequestEntityFilterChange: (values: string[]) => void;
  requestPriorityFilter: string[];
  onRequestPriorityFilterChange: (values: string[]) => void;
  requestCreatedFrom: string;
  onRequestCreatedFromChange: (value: string) => void;
  requestCreatedTo: string;
  onRequestCreatedToChange: (value: string) => void;
  customerOptions: SearchableSelectOption[];
  projectItemOptions: SearchableSelectOption[];
  tagFilterOptions: SearchableSelectOption[];
  requestTagFilter: string[];
  onRequestTagFilterChange: (values: string[]) => void;
  requestMissingEstimateFilter: boolean;
  onToggleMissingEstimate: () => void;
  requestOverEstimateFilter: boolean;
  onToggleOverEstimate: () => void;
  requestSlaRiskFilter: boolean;
  onToggleSlaRisk: () => void;
  alertCounts: {
    missing_estimate: number;
    over_estimate: number;
    sla_risk: number;
  };
  isDashboardLoading: boolean;
  rows: YeuCau[];
  isListLoading: boolean;
  selectedRequestId: string | number | null;
  onSelectRow: (row: YeuCau) => void;
  onPrimaryAction?: (row: YeuCau, actionMeta: CustomerRequestPrimaryActionMeta) => void;
  listPage: number;
  rowsPerPage: number;
  listMeta: PaginationMeta;
  onListPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
  hasListFilters: boolean;
  onClearFilters: () => void;
  requestRoleFilter: CustomerRequestRoleFilter;
  presentation?: 'responsive' | 'table' | 'cards';
  showFilterToolbar?: boolean;
  pinnedRequestIds?: Set<string>;
  onTogglePinRequest?: (row: YeuCau) => void;
};

const PRIORITY_OPTIONS: SearchableSelectOption[] = [
  { value: '1', label: 'Thấp' },
  { value: '2', label: 'Trung bình' },
  { value: '3', label: 'Cao' },
  { value: '4', label: 'Khẩn' },
];

const resolveCreatedLabel = (row: YeuCau): string =>
  row.created_at ? formatDateTimeDdMmYyyy(row.created_at).slice(0, 16) : '--';

const resolveExecutionLabel = (row: YeuCau): string =>
  row.current_entered_at ? formatDateTimeDdMmYyyy(row.current_entered_at).slice(0, 16) : '--';

const resolveCompletedLabel = (row: YeuCau): string =>
  row.completed_at ? formatDateTimeDdMmYyyy(row.completed_at).slice(0, 16) : '--';

const resolveHandlerSummaryMeta = (row: YeuCau): { label: string; hint: string } => {
  const handler = row.nguoi_xu_ly_name || '--';

  return {
    label: handler,
    hint: handler === '--' ? 'Chưa giao người xử lý' : 'Người xử lý hiện tại',
  };
};

const resolveCreatorName = (row: YeuCau): string =>
  (row as unknown as Record<string, unknown>).created_by_name as string ||
  '--';

const resolveStatusLabel = (row: YeuCau): string =>
  row.current_status_name_vi ||
  row.current_process_label ||
  row.tien_trinh_hien_tai ||
  row.trang_thai ||
  '--';

const SummaryCell: React.FC<{
  label: string;
  value: string;
  hint?: string;
  valueCls?: string;
}> = ({ label, value, hint, valueCls = 'text-slate-800' }) => (
  <div className="group relative overflow-hidden rounded-[var(--ui-control-radius)] bg-[linear-gradient(135deg,var(--ui-surface-subtle),rgba(255,255,255,0.96))] px-3 py-2 shadow-[var(--ui-shadow-shell)] transition-shadow hover:shadow-md">
    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    <p className="relative text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--ui-text-subtle)]">{label}</p>
    <p className={`relative mt-1 line-clamp-1 text-[13px] font-semibold leading-4 ${valueCls}`}>{value}</p>
    {hint ? (
      <p className="relative mt-0.5 line-clamp-1 text-[10px] leading-4 text-[color:var(--ui-text-subtle)]">{hint}</p>
    ) : null}
  </div>
);

const renderHealthChips = (
  layoutMode: CustomerRequestResponsiveLayoutMode,
  request: YeuCau,
  options?: { includePrimary?: boolean }
): React.ReactNode => {
  const healthMeta = resolveHealthSummaryMeta(request);
  const maxSecondary = layoutMode === 'desktopWide' ? 2 : 1;
  const chipCls =
    layoutMode === 'desktopCompact'
      ? 'px-2 py-0.5 text-[10px]'
      : 'px-2.5 py-1 text-[11px]';
  const includePrimary = options?.includePrimary ?? true;

  return (
    <div className="flex flex-wrap gap-1.5">
      {includePrimary ? (
        <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${chipCls} ${healthMeta.primary.cls}`}>
          ● {healthMeta.primary.label}
        </span>
      ) : null}
      {healthMeta.secondary.slice(0, maxSecondary).map((item) => (
        <span
          key={`${item.code}-${item.label}`}
          className={`rounded-full font-semibold ${chipCls} ${item.cls}`}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
};

const RequestCardRow: React.FC<{
  row: YeuCau;
  isActive: boolean;
  isPinned: boolean;
  layoutMode: CustomerRequestResponsiveLayoutMode;
  onSelectRow: (row: YeuCau) => void;
  onTogglePinRequest?: (row: YeuCau) => void;
}> = ({
  row,
  isActive,
  isPinned,
  layoutMode,
  onSelectRow,
  onTogglePinRequest,
}) => {
  const handlerMeta = resolveHandlerSummaryMeta(row);
  const hoursMeta = resolveHoursSummaryMeta(row);
  const contextCaption =
    buildRequestContextCaption(row) || 'Chưa có khách hàng / dự án / sản phẩm';
  const createdLabel = resolveCreatedLabel(row);
  const executionLabel = resolveExecutionLabel(row);
  const completedLabel = resolveCompletedLabel(row);

  return (
    <article
      className={`group relative w-full overflow-hidden rounded-[var(--ui-shell-radius)] border px-4 py-3.5 text-left shadow-[var(--ui-shadow-shell)] transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
        isActive
          ? 'border-primary/40 bg-gradient-to-br from-primary/[0.10] to-primary/[0.06] ring-1 ring-primary/10'
          : 'border-[var(--ui-border)] bg-gradient-to-br from-white to-slate-50/50 hover:border-primary/30 hover:from-white hover:to-slate-100/50'
      }`}
    >
      <button
        type="button"
        onClick={() => onSelectRow(row)}
        className="absolute inset-0 z-10 rounded-[var(--ui-shell-radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        aria-label={`Mở chi tiết ${row.ma_yc ?? row.request_code ?? 'yêu cầu'}`}
      />
      <div className="space-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onTogglePinRequest?.(row);
              }}
              className={`relative z-20 inline-flex rounded-full p-1.5 transition-all duration-200 ${
                isPinned
                  ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-100 hover:text-slate-600'
              }`}
              aria-label={isPinned ? 'Bỏ ghim yêu cầu' : 'Ghim yêu cầu'}
            >
              <span className="material-symbols-outlined text-[16px]">
                {isPinned ? 'star' : 'star_outline'}
              </span>
            </button>
            <span className="rounded-[var(--ui-control-radius)] bg-gradient-to-br from-slate-100 to-slate-200 px-3 py-1.5 text-xs font-bold tracking-wide text-slate-700 shadow-sm">
              {row.ma_yc ?? row.request_code ?? '--'}
            </span>
          </div>

          <p className="mt-2.5 line-clamp-2 text-[15px] font-bold leading-5 text-slate-900">
            {row.tieu_de ?? row.summary ?? '--'}
          </p>
          <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-500">
            {contextCaption}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <SummaryCell label="Người nhập yêu cầu" value={resolveCreatorName(row)} />
          <SummaryCell label="Người xử lý" value={handlerMeta.label} />
          <SummaryCell label="Trạng thái xử lý" value={resolveStatusLabel(row)} hint="Trạng thái hiện tại" />
          <SummaryCell
            label="Giờ"
            value={hoursMeta.value}
            valueCls={hoursMeta.valueCls}
          />
          <SummaryCell label="Ngày tạo" value={createdLabel} />
          <SummaryCell label="Ngày thực hiện" value={executionLabel} />
          <SummaryCell label="Ngày kết thúc" value={completedLabel} />
        </div>

        <div>{renderHealthChips(layoutMode, row, { includePrimary: false })}</div>
      </div>
    </article>
  );
};

const RequestTableRow: React.FC<{
  row: YeuCau;
  isActive: boolean;
  isPinned: boolean;
  layoutMode: CustomerRequestResponsiveLayoutMode;
  onSelectRow: (row: YeuCau) => void;
  onTogglePinRequest?: (row: YeuCau) => void;
}> = ({
  row,
  isActive,
  isPinned,
  layoutMode,
  onSelectRow,
  onTogglePinRequest,
}) => {
  const handlerMeta = resolveHandlerSummaryMeta(row);
  const hoursMeta = resolveHoursSummaryMeta(row);
  const isWide = layoutMode === 'desktopWide';
  const isCompact = layoutMode === 'desktopCompact';
  const cellPaddingCls = isCompact ? 'px-3 py-3' : 'px-3 py-3.5';
  const compactTextCls = isCompact ? 'text-[13px]' : 'text-sm';
  const executionDateLabel = resolveExecutionLabel(row);
  const completedDateLabel = resolveCompletedLabel(row);

  return (
    <tr
      tabIndex={0}
      onClick={() => onSelectRow(row)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelectRow(row);
        }
      }}
      className={`group cursor-pointer border-b border-slate-100 align-top outline-none transition-all last:border-b-0 ${
        isActive
          ? 'bg-gradient-to-r from-primary/[0.08] to-primary/[0.04]'
          : 'hover:bg-gradient-to-r hover:from-slate-50/80 hover:to-slate-100/40 focus:bg-slate-50'
      }`}
    >
      <td className={`${cellPaddingCls} w-[56px] align-middle text-center`}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onTogglePinRequest?.(row);
          }}
          className={`mx-auto inline-flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ${
            isPinned
              ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-md'
              : 'text-slate-300 hover:bg-slate-100 hover:text-slate-600'
          }`}
          aria-label={isPinned ? 'Bỏ ghim yêu cầu' : 'Ghim yêu cầu'}
        >
          <span className="material-symbols-outlined text-[16px]">
            {isPinned ? 'star' : 'star_outline'}
          </span>
        </button>
      </td>
      <td className={`${cellPaddingCls} align-top`}>
        <p className={`font-bold text-primary ${compactTextCls}`}>
          {row.ma_yc ?? row.request_code ?? '--'}
        </p>
      </td>
      <td className={`${cellPaddingCls} align-top`}>
        <p className={`line-clamp-1 font-bold text-slate-900 ${isCompact ? 'text-[13px] leading-4' : 'text-sm leading-5'}`}>
          {row.tieu_de ?? row.summary ?? '--'}
        </p>
        <p className={`mt-1 text-[11px] leading-5 text-slate-400 ${isWide ? 'line-clamp-2' : 'line-clamp-1'}`}>
          {buildRequestContextCaption(row) || 'Chưa có khách hàng / dự án / sản phẩm'}
        </p>
      </td>
      <td className={`${cellPaddingCls} align-top`}>
        <p className={`font-semibold text-slate-800 ${compactTextCls}`}>
          {resolveCreatorName(row)}
        </p>
      </td>
      <td className={`${cellPaddingCls} align-top`}>
        <p className={`font-semibold text-slate-800 ${compactTextCls}`}>{handlerMeta.label}</p>
      </td>
      <td className={`${cellPaddingCls} align-top`}>
        <div>{renderHealthChips(layoutMode, row)}</div>
      </td>
      <td className={`${cellPaddingCls} align-top`}>
        <p className={`font-semibold text-slate-700 ${compactTextCls}`}>
          {executionDateLabel}
        </p>
      </td>
      <td className={`${cellPaddingCls} align-top`}>
        <p className={`font-semibold text-slate-700 ${compactTextCls}`}>{completedDateLabel}</p>
      </td>
    </tr>
  );
};

export const CustomerRequestListPane: React.FC<CustomerRequestListPaneProps> = ({
  activeProcessCodes,
  processOptions,
  onProcessCodesChange,
  requestKeyword,
  onRequestKeywordChange,
  onSubmitKeywordSearch,
  showHandlerSearch = false,
  requestHandlerKeyword = '',
  onRequestHandlerKeywordChange,
  requestEntityFilter,
  onRequestEntityFilterChange,
  requestPriorityFilter,
  onRequestPriorityFilterChange,
  requestCreatedFrom,
  onRequestCreatedFromChange,
  requestCreatedTo,
  onRequestCreatedToChange,
  customerOptions,
  projectItemOptions,
  tagFilterOptions,
  requestTagFilter,
  onRequestTagFilterChange,
  requestMissingEstimateFilter,
  requestOverEstimateFilter,
  requestSlaRiskFilter,
  rows,
  isListLoading,
  selectedRequestId,
  onSelectRow,
  listPage,
  rowsPerPage,
  listMeta,
  onListPageChange,
  onRowsPerPageChange,
  hasListFilters,
  onClearFilters,
  requestRoleFilter,
  presentation = 'table',
  showFilterToolbar = true,
  pinnedRequestIds = new Set<string>(),
  onTogglePinRequest,
}) => {
  const layoutMode = useCustomerRequestResponsiveLayout();
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const totalPages = Math.max(1, listMeta.total_pages || 1);
  const safePage = Math.min(listPage, totalPages);
  const isMobile = layoutMode === 'mobile';
  const safeRowsPerPage = Number.isFinite(rowsPerPage) && rowsPerPage > 0 ? rowsPerPage : 20;
  const totalItems = Math.max(0, Number(listMeta.total ?? rows.length));
  const pageFrom = totalItems === 0 ? 0 : (safePage - 1) * safeRowsPerPage + 1;
  const pageTo = totalItems === 0 ? 0 : Math.min(safePage * safeRowsPerPage, totalItems);
  const showCardList =
    presentation === 'cards' ||
    (presentation === 'responsive' && (layoutMode === 'mobile' || layoutMode === 'tablet'));
  const showTable =
    presentation === 'table' ||
    (presentation === 'responsive' &&
      (layoutMode === 'desktopCompact' || layoutMode === 'desktopWide'));
  const toolbarFieldClass = `${
    isMobile ? 'h-11' : 'h-10'
  } w-full rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] px-3 text-sm font-medium text-[color:var(--ui-text-default)] shadow-[var(--ui-shadow-shell)] outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/12`;
  const toolbarSearchClass = `${
    isMobile ? 'h-11' : 'h-10'
  } w-full rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] pl-9 pr-3.5 text-sm font-medium text-[color:var(--ui-text-default)] shadow-[var(--ui-shadow-shell)] outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/12`;
  const toolbarSelectTriggerClass = `${
    isMobile ? 'h-11' : 'h-10'
  } rounded-[var(--ui-control-radius)] border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] px-3.5 text-sm font-medium text-[color:var(--ui-text-default)] shadow-[var(--ui-shadow-shell)] focus:bg-white`;
  const toolbarButtonClass = `${
    isMobile ? 'h-11' : 'h-10'
  } inline-flex items-center justify-center rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] px-3 text-xs font-semibold text-[color:var(--ui-text-default)] transition hover:bg-[var(--ui-surface-subtle)]`;
  const activeFilterCount = useMemo(
    () =>
      [
        activeProcessCodes.length > 0,
        requestEntityFilter.length > 0,
        requestTagFilter.length > 0,
        requestPriorityFilter.length > 0,
        requestMissingEstimateFilter,
        requestOverEstimateFilter,
        requestSlaRiskFilter,
      ].filter(Boolean).length,
    [
      activeProcessCodes,
      requestEntityFilter,
      requestTagFilter,
      requestMissingEstimateFilter,
      requestOverEstimateFilter,
      requestPriorityFilter,
      requestSlaRiskFilter,
    ]
  );
  const entityFilterOptions = useMemo<SearchableSelectOption[]>(
    () => [
      ...customerOptions,
      ...projectItemOptions,
    ],
    [customerOptions, projectItemOptions]
  );

  const filterControlsNode = (
    <div
      className={`grid gap-2.5 ${
        isMobile
          ? 'grid-cols-1'
          : layoutMode === 'tablet'
          ? 'md:grid-cols-2'
          : layoutMode === 'desktopCompact'
          ? 'xl:grid-cols-2'
          : '2xl:grid-cols-[minmax(0,1fr)_190px]'
      }`}
    >
      <SearchableMultiSelect
        values={requestEntityFilter}
        options={entityFilterOptions}
        onChange={onRequestEntityFilterChange}
        label=""
        placeholder="Khách hàng | Dự án | Sản phẩm"
        searchPlaceholder="Tìm khách hàng, dự án, sản phẩm..."
        usePortal
        portalZIndex={60}
        triggerClassName={toolbarSelectTriggerClass}
        showSelectedChips={false}
      />
      <SearchableMultiSelect
        values={requestTagFilter}
        options={tagFilterOptions}
        onChange={onRequestTagFilterChange}
        label=""
        placeholder="Tags"
        searchPlaceholder="Tìm tags..."
        usePortal
        portalZIndex={60}
        triggerClassName={toolbarSelectTriggerClass}
        showSelectedChips={false}
      />
      <SearchableMultiSelect
        values={activeProcessCodes}
        options={processOptions.filter((option) => String(option.value ?? '').trim() !== '')}
        onChange={onProcessCodesChange}
        label=""
        placeholder="Tiến trình"
        searchPlaceholder="Tìm tiến trình..."
        usePortal
        portalZIndex={60}
        triggerClassName={toolbarSelectTriggerClass}
        showSelectedChips={false}
      />
      <SearchableMultiSelect
        values={requestPriorityFilter}
        options={PRIORITY_OPTIONS}
        onChange={onRequestPriorityFilterChange}
        label=""
        placeholder="Ưu tiên"
        searchPlaceholder="Tìm ưu tiên..."
        usePortal
        portalZIndex={60}
        triggerClassName={toolbarSelectTriggerClass}
        showSelectedChips={false}
      />
    </div>
  );

  const desktopExpandedFiltersNode = filterControlsNode;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {showFilterToolbar ? (
        <div className="shrink-0">
          <div className="sticky top-0 z-[60] rounded-[var(--ui-shell-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] px-3 py-2 shadow-[var(--ui-shadow-shell)] backdrop-blur-xl">
            <div className="space-y-2">
              {isMobile ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="min-w-0">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Từ ngày
                      </span>
                      <input
                        type="date"
                        value={requestCreatedFrom}
                        onChange={(event) => onRequestCreatedFromChange(event.target.value)}
                        className={toolbarFieldClass}
                      />
                    </label>
                    <label className="min-w-0">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Đến ngày
                      </span>
                      <input
                        type="date"
                        value={requestCreatedTo}
                        onChange={(event) => onRequestCreatedToChange(event.target.value)}
                        className={toolbarFieldClass}
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    {showHandlerSearch && onRequestHandlerKeywordChange ? (
                      <div className="relative w-[180px] shrink-0">
                        <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
                          person
                        </span>
                        <input
                          type="text"
                          value={requestHandlerKeyword}
                          onChange={(event) => onRequestHandlerKeywordChange(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              onSubmitKeywordSearch();
                            }
                          }}
                          placeholder="Người xử lý..."
                          className={toolbarSearchClass}
                        />
                      </div>
                    ) : null}
                    <div className="relative min-w-0 flex-1">
                      <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
                        search
                      </span>
                      <input
                        type="text"
                        value={requestKeyword}
                        onChange={(event) => onRequestKeywordChange(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            onSubmitKeywordSearch();
                          }
                        }}
                        placeholder="Tìm mã YC, tên yêu cầu..."
                        className={toolbarSearchClass}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={onSubmitKeywordSearch}
                      className={`${toolbarButtonClass} gap-1.5 px-2.5 text-primary hover:bg-primary/5`}
                    >
                      <span className="material-symbols-outlined text-[17px]">search</span>
                      <span>Tìm kiếm</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMobileFilters((value) => !value)}
                      className={`${toolbarButtonClass} group shrink-0 gap-1.5 px-2.5 shadow-[var(--ui-shadow-shell)]`}
                    >
                      <span className="material-symbols-outlined text-[17px] transition-transform group-hover:rotate-12">tune</span>
                      <span className="hidden lg:inline">Bộ lọc</span>
                      {activeFilterCount > 0 ? (
                        <span className="rounded-full bg-gradient-to-br from-slate-900 to-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                          {activeFilterCount}
                        </span>
                      ) : null}
                    </button>
                  </div>

                  {showMobileFilters ? (
                    <div className="rounded-[var(--ui-shell-radius)] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-subtle)] p-3 shadow-inner">
                      {filterControlsNode}
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 lg:grid-cols-[150px_150px_minmax(0,1fr)_auto]">
                    <label className="min-w-0">
                      <span className="sr-only">Từ ngày tạo</span>
                      <input
                        type="date"
                        value={requestCreatedFrom}
                        onChange={(event) => onRequestCreatedFromChange(event.target.value)}
                        className={toolbarFieldClass}
                      />
                    </label>
                    <label className="min-w-0">
                      <span className="sr-only">Đến ngày tạo</span>
                      <input
                        type="date"
                        value={requestCreatedTo}
                        onChange={(event) => onRequestCreatedToChange(event.target.value)}
                        className={toolbarFieldClass}
                      />
                    </label>
                    <div className="hidden lg:block" aria-hidden="true" />
                    {hasListFilters ? (
                      <button
                        type="button"
                        onClick={onClearFilters}
                        className={`${toolbarButtonClass} text-primary hover:bg-primary/5 hover:text-primary`}
                      >
                        Xóa lọc
                      </button>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                    <div className="grid min-w-0 flex-1 gap-2 lg:grid-cols-[minmax(0,1fr)_180px_200px] xl:grid-cols-[minmax(0,1fr)_180px_220px]">
                      {showHandlerSearch && onRequestHandlerKeywordChange ? (
                        <>
                          <div className="relative">
                            <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
                              person
                            </span>
                            <input
                              type="text"
                              value={requestHandlerKeyword}
                              onChange={(event) => onRequestHandlerKeywordChange(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  onSubmitKeywordSearch();
                                }
                              }}
                              placeholder="Người xử lý..."
                              className={toolbarSearchClass}
                            />
                          </div>
                          <div className="relative">
                            <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
                              search
                            </span>
                            <input
                              type="text"
                              value={requestKeyword}
                              onChange={(event) => onRequestKeywordChange(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  onSubmitKeywordSearch();
                                }
                              }}
                              placeholder="Tìm mã YC, tên yêu cầu..."
                              className={toolbarSearchClass}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="relative">
                          <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
                            search
                          </span>
                          <input
                            type="text"
                            value={requestKeyword}
                            onChange={(event) => onRequestKeywordChange(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                onSubmitKeywordSearch();
                              }
                            }}
                            placeholder="Tìm mã YC, tên yêu cầu..."
                            className={toolbarSearchClass}
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={onSubmitKeywordSearch}
                        className={`${toolbarButtonClass} gap-1.5 px-2.5 text-primary hover:bg-primary/5`}
                      >
                        <span className="material-symbols-outlined text-[17px]">search</span>
                        <span>Tìm kiếm</span>
                      </button>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 lg:justify-end">
                      <button
                        type="button"
                        onClick={() => setIsFilterExpanded((value) => !value)}
                        className={`${toolbarButtonClass} group gap-1.5 shadow-[var(--ui-shadow-shell)]`}
                      >
                        <span className="material-symbols-outlined text-[17px]">tune</span>
                        <span>Bộ lọc</span>
                        {activeFilterCount > 0 ? (
                          <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {activeFilterCount}
                          </span>
                        ) : null}
                      </button>
                    </div>
                  </div>

                  {isFilterExpanded ? (
                    <div className="rounded-[var(--ui-shell-radius)] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-subtle)] p-3 shadow-inner">
                      {desktopExpandedFiltersNode}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 flex h-full flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {showCardList ? (
              <div className="space-y-2 py-1">
                {isListLoading ? (
                  <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/80 px-4 py-16 text-center shadow-sm">
                    <span className="material-symbols-outlined mb-3 animate-spin text-[32px] text-slate-300">progress_activity</span>
                    <p className="text-sm font-medium text-slate-500">Đang tải danh sách yêu cầu...</p>
                  </div>
                ) : rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/80 px-4 py-16 text-center shadow-sm">
                    <span className="material-symbols-outlined mb-3 text-[32px] text-slate-300">inbox</span>
                    <p className="text-sm font-medium text-slate-500">Không có yêu cầu nào phù hợp với bộ lọc hiện tại.</p>
                  </div>
                ) : (
                  rows.map((row) => (
                    <RequestCardRow
                      key={String(row.id)}
                      row={row}
                      isActive={String(row.id) === String(selectedRequestId)}
                      isPinned={pinnedRequestIds.has(String(row.id))}
                      layoutMode={layoutMode}
                      onSelectRow={onSelectRow}
                      onTogglePinRequest={onTogglePinRequest}
                    />
                  ))
                )}
              </div>
            ) : null}

            {showTable ? (
              <div className="h-full overflow-auto rounded-[var(--ui-shell-radius)] border border-[var(--ui-border)] bg-gradient-to-br from-white to-slate-50/50 shadow-xl shadow-slate-200/50">
                <table className="min-w-[1120px] w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[56px]" />
                    <col className="w-[132px]" />
                    <col className="w-[292px]" />
                    <col className="w-[160px]" />
                    <col className="w-[160px]" />
                    <col className="w-[176px]" />
                    <col className="w-[158px]" />
                    <col className="w-[158px]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 border-b border-slate-100 bg-gradient-to-r from-slate-50/95 to-slate-100/90 backdrop-blur-sm">
                    <tr className="text-left text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      <th className="px-2 py-3 text-center">
                        <span
                          aria-hidden="true"
                          className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-300"
                        >
                          <span className="material-symbols-outlined text-[16px]">star_outline</span>
                        </span>
                      </th>
                      <th className="px-3 py-3">Mã yêu cầu</th>
                      <th className="px-3 py-3">Tên yêu cầu</th>
                      <th className="px-3 py-3">Người nhập yêu cầu</th>
                      <th className="px-3 py-3">Người xử lý</th>
                      <th className="px-3 py-3">Trạng thái XL</th>
                      <th className="px-3 py-3">Ngày thực hiện</th>
                      <th className="px-3 py-3">Ngày kết thúc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isListLoading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <span className="material-symbols-outlined animate-spin text-[32px] text-slate-300">progress_activity</span>
                            <p className="text-sm font-medium text-slate-500">Đang tải danh sách yêu cầu...</p>
                          </div>
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <span className="material-symbols-outlined text-[32px] text-slate-300">inbox</span>
                            <p className="text-sm font-medium text-slate-500">Không có yêu cầu nào phù hợp với bộ lọc hiện tại.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <RequestTableRow
                          key={String(row.id)}
                          row={row}
                          isActive={String(row.id) === String(selectedRequestId)}
                          isPinned={pinnedRequestIds.has(String(row.id))}
                          layoutMode={layoutMode}
                          onSelectRow={onSelectRow}
                          onTogglePinRequest={onTogglePinRequest}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="shrink-0 overflow-hidden rounded-[24px] border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 shadow-xl shadow-slate-200/50">
        {isMobile ? (
          <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2.5">
            <button
              type="button"
              onClick={() => onListPageChange(Math.max(1, safePage - 1))}
              disabled={safePage <= 1}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              Trước
            </button>

            <div className="min-w-0 text-center">
              <p className="text-[11px] font-semibold text-slate-700">Trang {safePage}/{totalPages}</p>
              <p className="text-[10px] text-slate-500">{pageFrom.toLocaleString('vi-VN')}–{pageTo.toLocaleString('vi-VN')} / {totalItems.toLocaleString('vi-VN')}</p>
            </div>

            <button
              type="button"
              onClick={() => onListPageChange(Math.min(totalPages, safePage + 1))}
              disabled={safePage >= totalPages}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
            >
              Sau
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        ) : (
          <PaginationControls
            currentPage={safePage}
            totalItems={listMeta.total}
            rowsPerPage={rowsPerPage}
            onPageChange={onListPageChange}
            onRowsPerPageChange={onRowsPerPageChange}
          />
        )}
      </div>
    </div>
  );
};
