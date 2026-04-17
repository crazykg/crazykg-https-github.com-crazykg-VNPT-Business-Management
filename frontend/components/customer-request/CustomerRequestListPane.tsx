import React, { useMemo, useState } from 'react';
import type { PaginationMeta } from '../../types/common';
import type { SupportServiceGroup } from '../../types/support';
import type { YeuCau } from '../../types/customerRequest';
import { PaginationControls } from '../PaginationControls';
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect';
import {
  buildRequestContextCaption,
  resolveHealthSummaryMeta,
  resolveHoursSummaryMeta,
  resolveOwnerSummaryMeta,
  resolveUpdatedSummaryMeta,
  type CustomerRequestPrimaryActionMeta,
  type CustomerRequestRoleFilter,
} from './presentation';
import {
  useCustomerRequestResponsiveLayout,
  type CustomerRequestResponsiveLayoutMode,
} from './hooks/useCustomerRequestResponsiveLayout';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';

type CustomerRequestListPaneProps = {
  activeProcessCode: string;
  processOptions: SearchableSelectOption[];
  onProcessCodeChange: (value: string) => void;
  requestKeyword: string;
  onRequestKeywordChange: (value: string) => void;
  requestCustomerFilter: string;
  onRequestCustomerFilterChange: (value: string) => void;
  requestSupportGroupFilter: string;
  onRequestSupportGroupFilterChange: (value: string) => void;
  requestPriorityFilter: string;
  onRequestPriorityFilterChange: (value: string) => void;
  requestCreatedFrom: string;
  onRequestCreatedFromChange: (value: string) => void;
  requestCreatedTo: string;
  onRequestCreatedToChange: (value: string) => void;
  customerOptions: SearchableSelectOption[];
  supportServiceGroups: SupportServiceGroup[];
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
  pinnedRequestIds?: Set<string>;
  onTogglePinRequest?: (row: YeuCau) => void;
};

const PRIORITY_OPTIONS: SearchableSelectOption[] = [
  { value: '', label: 'Tất cả ưu tiên' },
  { value: 1, label: 'Thấp' },
  { value: 2, label: 'Trung bình' },
  { value: 3, label: 'Cao' },
  { value: 4, label: 'Khẩn' },
];

const resolveCreatedLabel = (row: YeuCau): string =>
  row.created_at ? formatDateTimeDdMmYyyy(row.created_at).slice(0, 16) : '--';

const resolveHandlerSummaryMeta = (row: YeuCau): { label: string; hint: string } => {
  const handler =
    row.nguoi_xu_ly_name ||
    row.performer_name ||
    row.receiver_name ||
    row.received_by_name ||
    '--';

  return {
    label: handler,
    hint: handler === '--' ? 'Chưa giao người xử lý' : 'Người xử lý hiện tại',
  };
};

const resolveStatusLabel = (row: YeuCau): string =>
  row.current_status_name_vi ||
  row.current_process_label ||
  row.tien_trinh_hien_tai ||
  row.trang_thai ||
  '--';

const SummaryCell: React.FC<{
  label: string;
  value: string;
  hint: string;
  valueCls?: string;
}> = ({ label, value, hint, valueCls = 'text-slate-800' }) => (
  <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-50/80 to-slate-100/80 px-3 py-2 shadow-sm transition-shadow hover:shadow-md">
    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    <p className="relative text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
    <p className={`relative mt-1 line-clamp-1 text-[13px] font-semibold leading-4 ${valueCls}`}>{value}</p>
    <p className="relative mt-0.5 line-clamp-1 text-[10px] leading-4 text-slate-400">{hint}</p>
  </div>
);

const renderHealthChips = (
  layoutMode: CustomerRequestResponsiveLayoutMode,
  request: YeuCau
): React.ReactNode => {
  const healthMeta = resolveHealthSummaryMeta(request);
  const maxSecondary = layoutMode === 'desktopWide' ? 2 : 1;
  const chipCls =
    layoutMode === 'desktopCompact'
      ? 'px-2 py-0.5 text-[10px]'
      : 'px-2.5 py-1 text-[11px]';

  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${chipCls} ${healthMeta.primary.cls}`}>
        ● {healthMeta.primary.label}
      </span>
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
  const ownerMeta = resolveOwnerSummaryMeta(row);
  const handlerMeta = resolveHandlerSummaryMeta(row);
  const hoursMeta = resolveHoursSummaryMeta(row);
  const updatedMeta = resolveUpdatedSummaryMeta(row);
  const contextCaption =
    buildRequestContextCaption(row) || 'Chưa có khách hàng / dự án / sản phẩm';
  const createdLabel = resolveCreatedLabel(row);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectRow(row)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelectRow(row);
        }
      }}
      className={`group w-full cursor-pointer rounded-[24px] border px-4 py-3.5 text-left shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
        isActive
          ? 'border-primary/40 bg-gradient-to-br from-primary/[0.10] to-primary/[0.06] ring-1 ring-primary/10'
          : 'border-slate-200 bg-gradient-to-br from-white to-slate-50/50 hover:border-primary/30 hover:from-white hover:to-slate-100/50'
      }`}
    >
      <div className="space-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onTogglePinRequest?.(row);
              }}
              className={`inline-flex rounded-full p-1.5 transition-all duration-200 ${
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
            <span className="rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 px-3 py-1.5 text-xs font-bold tracking-wide text-slate-700 shadow-sm">
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
          <SummaryCell label="Phụ trách" value={ownerMeta.label} hint={ownerMeta.hint} />
          <SummaryCell label="Người xử lý" value={handlerMeta.label} hint={handlerMeta.hint} />
          <SummaryCell label="Trạng thái xử lý" value={resolveStatusLabel(row)} hint="Trạng thái hiện tại" />
          <SummaryCell
            label="Giờ"
            value={hoursMeta.value}
            hint={hoursMeta.hint}
            valueCls={hoursMeta.valueCls}
          />
          <SummaryCell label="Ngày tạo" value={createdLabel} hint="Ngày tạo yêu cầu" />
          <SummaryCell
            label="Cập nhật"
            value={updatedMeta.updatedLabel}
            hint={updatedMeta.dueLabel}
          />
        </div>

        <div>{renderHealthChips(layoutMode, row)}</div>
      </div>
    </div>
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
  const ownerMeta = resolveOwnerSummaryMeta(row);
  const handlerMeta = resolveHandlerSummaryMeta(row);
  const hoursMeta = resolveHoursSummaryMeta(row);
  const updatedMeta = resolveUpdatedSummaryMeta(row);
  const isWide = layoutMode === 'desktopWide';
  const isCompact = layoutMode === 'desktopCompact';
  const cellPaddingCls = isCompact ? 'px-3 py-3' : 'px-3 py-3.5';
  const compactTextCls = isCompact ? 'text-[13px]' : 'text-sm';

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
      <td className={`${cellPaddingCls} w-[44px] align-top`}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onTogglePinRequest?.(row);
          }}
          className={`inline-flex rounded-full p-1.5 transition-all duration-200 ${
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
        <p className={`font-semibold text-slate-800 ${compactTextCls}`}>{ownerMeta.label}</p>
        <p className={`mt-1 text-[11px] leading-5 text-slate-400 ${isWide ? 'line-clamp-2' : 'line-clamp-1'}`}>
          {ownerMeta.hint}
        </p>
      </td>
      <td className={`${cellPaddingCls} align-top`}>
        <p className={`font-semibold text-slate-800 ${compactTextCls}`}>{handlerMeta.label}</p>
        <p className={`mt-1 text-[11px] leading-5 text-slate-400 ${isWide ? 'line-clamp-2' : 'line-clamp-1'}`}>
          {handlerMeta.hint}
        </p>
      </td>
      <td className={`${cellPaddingCls} align-top`}>
        <p className={`font-semibold text-slate-800 ${compactTextCls}`}>{resolveStatusLabel(row)}</p>
        <div className="mt-1">{renderHealthChips(layoutMode, row)}</div>
      </td>
      <td className={`${cellPaddingCls} align-top`}>
        <p className={`font-semibold ${hoursMeta.valueCls} ${compactTextCls}`}>{hoursMeta.value}</p>
        <p className={`mt-1 text-[11px] leading-5 text-slate-400 ${isWide ? 'line-clamp-2' : 'line-clamp-1'}`}>
          {hoursMeta.hint}
        </p>
      </td>
      <td className={`${cellPaddingCls} align-top`}>
        <p className={`font-semibold text-slate-700 ${compactTextCls}`}>
          {resolveCreatedLabel(row)}
        </p>
        <p className="mt-1 text-[11px] text-slate-400">Ngày tạo yêu cầu</p>
      </td>
      <td className={`${cellPaddingCls} align-top`}>
        <div className="space-y-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              {updatedMeta.updatedHint}
            </p>
            <p className={`mt-0.5 font-semibold text-slate-700 ${isCompact ? 'text-xs' : 'text-[13px]'}`}>
              {updatedMeta.updatedLabel}
            </p>
          </div>
          <div>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold shadow-sm ${updatedMeta.slaCls}`}>
              {updatedMeta.slaLabel}
            </span>
            <p className="mt-1 text-[11px] text-slate-400">{updatedMeta.dueLabel}</p>
          </div>
        </div>
      </td>
    </tr>
  );
};

export const CustomerRequestListPane: React.FC<CustomerRequestListPaneProps> = ({
  activeProcessCode,
  processOptions,
  onProcessCodeChange,
  requestKeyword,
  onRequestKeywordChange,
  requestCustomerFilter,
  onRequestCustomerFilterChange,
  requestSupportGroupFilter,
  onRequestSupportGroupFilterChange,
  requestPriorityFilter,
  onRequestPriorityFilterChange,
  requestCreatedFrom,
  onRequestCreatedFromChange,
  requestCreatedTo,
  onRequestCreatedToChange,
  customerOptions,
  supportServiceGroups,
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
  pinnedRequestIds = new Set<string>(),
  onTogglePinRequest,
}) => {
  const layoutMode = useCustomerRequestResponsiveLayout();
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const totalPages = Math.max(1, listMeta.total_pages || 1);
  const safePage = Math.min(listPage, totalPages);
  const isMobile = layoutMode === 'mobile';
  const showCardList =
    presentation === 'cards' ||
    (presentation === 'responsive' && (layoutMode === 'mobile' || layoutMode === 'tablet'));
  const showTable =
    presentation === 'table' ||
    (presentation === 'responsive' &&
      (layoutMode === 'desktopCompact' || layoutMode === 'desktopWide'));
  const activeFilterCount = useMemo(
    () =>
      [
        Boolean(activeProcessCode),
        Boolean(requestCustomerFilter),
        Boolean(requestSupportGroupFilter),
        Boolean(requestPriorityFilter),
        requestMissingEstimateFilter,
        requestOverEstimateFilter,
        requestSlaRiskFilter,
      ].filter(Boolean).length,
    [
      activeProcessCode,
      requestCustomerFilter,
      requestMissingEstimateFilter,
      requestOverEstimateFilter,
      requestPriorityFilter,
      requestSlaRiskFilter,
      requestSupportGroupFilter,
    ]
  );
  const visibleRangeStart = listMeta.total === 0 ? 0 : (safePage - 1) * rowsPerPage + 1;
  const visibleRangeEnd =
    listMeta.total === 0
      ? 0
      : Math.min(listMeta.total, visibleRangeStart + Math.max(rows.length - 1, 0));
  const visibleRangeLabel = `${visibleRangeStart} – ${visibleRangeEnd} / ${listMeta.total} bản ghi`;

  const filterControlsNode = (
    <div
      className={`grid gap-2.5 ${
        isMobile
          ? 'grid-cols-1'
          : layoutMode === 'tablet'
          ? 'md:grid-cols-2'
          : layoutMode === 'desktopCompact'
          ? 'xl:grid-cols-3'
          : '2xl:grid-cols-[190px_minmax(0,1fr)_190px_150px]'
      }`}
    >
      <SearchableSelect
        value={activeProcessCode}
        options={processOptions}
        onChange={onProcessCodeChange}
        label=""
        placeholder="Tiến trình"
        searchPlaceholder="Tìm tiến trình..."
        compact
        usePortal
        portalZIndex={60}
      />
      <SearchableSelect
        value={requestCustomerFilter}
        options={[{ value: '', label: 'Tất cả khách hàng' }, ...customerOptions]}
        onChange={onRequestCustomerFilterChange}
        label=""
        placeholder="Khách hàng"
        searchPlaceholder="Tìm khách hàng..."
        compact
        usePortal
        portalZIndex={60}
      />
      <SearchableSelect
        value={requestSupportGroupFilter}
        options={[
          { value: '', label: 'Tất cả kênh' },
          ...supportServiceGroups.map((group) => ({
            value: String(group.id),
            label: group.group_name,
            searchText: `${group.group_name} ${group.group_code ?? ''} ${group.customer_name ?? ''}`,
          })),
        ]}
        onChange={onRequestSupportGroupFilterChange}
        label=""
        placeholder="Kênh tiếp nhận"
        searchPlaceholder="Tìm kênh..."
        compact
        usePortal
        portalZIndex={60}
      />
      <SearchableSelect
        value={requestPriorityFilter}
        options={PRIORITY_OPTIONS}
        onChange={onRequestPriorityFilterChange}
        label=""
        placeholder="Ưu tiên"
        searchPlaceholder="Tìm ưu tiên..."
        compact
        usePortal
        portalZIndex={60}
      />
    </div>
  );

  const desktopExpandedFiltersNode = (
    <div
      className={`grid gap-2.5 ${
        layoutMode === 'desktopCompact'
          ? 'xl:grid-cols-3'
          : '2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px]'
      }`}
    >
      <SearchableSelect
        value={requestCustomerFilter}
        options={[{ value: '', label: 'Tất cả khách hàng' }, ...customerOptions]}
        onChange={onRequestCustomerFilterChange}
        label=""
        placeholder="Khách hàng"
        searchPlaceholder="Tìm khách hàng..."
        compact
        usePortal
        portalZIndex={60}
      />
      <SearchableSelect
        value={requestSupportGroupFilter}
        options={[
          { value: '', label: 'Tất cả kênh' },
          ...supportServiceGroups.map((group) => ({
            value: String(group.id),
            label: group.group_name,
            searchText: `${group.group_name} ${group.group_code ?? ''} ${group.customer_name ?? ''}`,
          })),
        ]}
        onChange={onRequestSupportGroupFilterChange}
        label=""
        placeholder="Kênh tiếp nhận"
        searchPlaceholder="Tìm kênh..."
        compact
        usePortal
        portalZIndex={60}
      />
      <SearchableSelect
        value={requestPriorityFilter}
        options={PRIORITY_OPTIONS}
        onChange={onRequestPriorityFilterChange}
        label=""
        placeholder="Ưu tiên"
        searchPlaceholder="Tìm ưu tiên..."
        compact
        usePortal
        portalZIndex={60}
      />
    </div>
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="shrink-0">
        <div className="sticky top-0 z-[60] rounded-2xl border border-slate-200/80 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-xl">
          <div className="space-y-2">
            {isMobile ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
                      search
                    </span>
                    <input
                      type="text"
                      value={requestKeyword}
                      onChange={(event) => onRequestKeywordChange(event.target.value)}
                      placeholder="Tìm mã YC, tên yêu cầu..."
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white/80 pl-9 pr-4 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15 focus:shadow-md"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMobileFilters((value) => !value)}
                    className="group inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                  >
                    <span className="material-symbols-outlined text-[18px] transition-transform group-hover:rotate-12">tune</span>
                    <span className="hidden lg:inline">Bộ lọc</span>
                    {activeFilterCount > 0 ? (
                      <span className="rounded-full bg-gradient-to-br from-slate-900 to-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                        {activeFilterCount}
                      </span>
                    ) : null}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="min-w-0">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Từ ngày
                    </span>
                    <input
                      type="date"
                      value={requestCreatedFrom}
                      onChange={(event) => onRequestCreatedFromChange(event.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
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
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </label>
                </div>

                {showMobileFilters ? (
                  <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50/90 to-white/80 p-3 shadow-inner">
                    {filterControlsNode}
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                  <div className="grid min-w-0 flex-1 gap-2 xl:grid-cols-[minmax(0,1.3fr)_220px]">
                    <div className="relative">
                      <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
                        search
                      </span>
                      <input
                        type="text"
                        value={requestKeyword}
                        onChange={(event) => onRequestKeywordChange(event.target.value)}
                        placeholder={
                          requestRoleFilter === 'creator'
                            ? 'Tìm YC tôi tạo...'
                            : requestRoleFilter === 'dispatcher'
                            ? 'Tìm YC tôi điều phối...'
                            : requestRoleFilter === 'performer'
                            ? 'Tìm việc tôi xử lý...'
                            : 'Tìm mã YC, tên yêu cầu, khách hàng...'
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                    </div>
                    <SearchableSelect
                      value={activeProcessCode}
                      options={processOptions}
                      onChange={onProcessCodeChange}
                      label=""
                      placeholder="Tiến trình"
                      searchPlaceholder="Tìm tiến trình..."
                      compact
                      usePortal
                      portalZIndex={60}
                    />
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                      {visibleRangeLabel}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      Trang {safePage}/{totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsFilterExpanded((value) => !value)}
                      className="group inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                    >
                      <span className="material-symbols-outlined text-[18px]">tune</span>
                      <span>Bộ lọc</span>
                      {activeFilterCount > 0 ? (
                        <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {activeFilterCount}
                        </span>
                      ) : null}
                    </button>
                  </div>
                </div>

                <div className="grid gap-2 xl:grid-cols-[150px_150px_minmax(0,1fr)_auto] xl:items-center">
                  <label className="min-w-0">
                    <span className="sr-only">Từ ngày tạo</span>
                    <input
                      type="date"
                      value={requestCreatedFrom}
                      onChange={(event) => onRequestCreatedFromChange(event.target.value)}
                      className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="sr-only">Đến ngày tạo</span>
                    <input
                      type="date"
                      value={requestCreatedTo}
                      onChange={(event) => onRequestCreatedToChange(event.target.value)}
                      className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </label>
                  <div className="hidden xl:block" aria-hidden="true" />
                  {hasListFilters ? (
                    <button
                      type="button"
                      onClick={onClearFilters}
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-primary transition hover:bg-primary/5"
                    >
                      Xóa lọc
                    </button>
                  ) : null}
                </div>

                {isFilterExpanded ? (
                  <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50/90 to-white/80 p-3 shadow-inner">
                    {desktopExpandedFiltersNode}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <div className="min-h-0 flex flex-1 flex-col">
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
              <div className="h-full overflow-auto rounded-[24px] border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 shadow-xl shadow-slate-200/50">
                <table className="min-w-[1240px] w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[44px]" />
                    <col className="w-[132px]" />
                    <col className="w-[260px]" />
                    <col className="w-[150px]" />
                    <col className="w-[150px]" />
                    <col className="w-[180px]" />
                    <col className="w-[90px]" />
                    <col className="w-[140px]" />
                    <col className="w-[140px]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 border-b border-slate-100 bg-gradient-to-r from-slate-50/95 to-slate-100/90 backdrop-blur-sm">
                    <tr className="text-left text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      <th className="px-3 py-3">☆</th>
                      <th className="px-3 py-3">Mã yêu cầu</th>
                      <th className="px-3 py-3">Tên yêu cầu</th>
                      <th className="px-3 py-3">Phụ trách</th>
                      <th className="px-3 py-3">Người xử lý</th>
                      <th className="px-3 py-3">Trạng thái XL</th>
                      <th className="px-3 py-3">Giờ</th>
                      <th className="px-3 py-3">Ngày tạo</th>
                      <th className="px-3 py-3">Cập nhật</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isListLoading ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <span className="material-symbols-outlined animate-spin text-[32px] text-slate-300">progress_activity</span>
                            <p className="text-sm font-medium text-slate-500">Đang tải danh sách yêu cầu...</p>
                          </div>
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center">
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

      {totalPages > 1 ? (
        <div className="shrink-0 overflow-hidden rounded-[24px] border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 shadow-xl shadow-slate-200/50">
          <PaginationControls
            currentPage={safePage}
            totalItems={listMeta.total}
            rowsPerPage={rowsPerPage}
            onPageChange={onListPageChange}
            onRowsPerPageChange={onRowsPerPageChange}
          />
        </div>
      ) : null}
    </div>
  );
};
