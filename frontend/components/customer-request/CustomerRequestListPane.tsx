import React, { useMemo, useState } from 'react';
import type { PaginationMeta } from '../../types/common';
import type { SupportServiceGroup } from '../../types/support';
import type { YeuCau } from '../../types/customerRequest';
import { PaginationControls } from '../PaginationControls';
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect';
import {
  buildRequestContextCaption,
  LIST_PRIORITY_META,
  resolveHealthSummaryMeta,
  resolveHoursSummaryMeta,
  resolveOwnerSummaryMeta,
  resolvePrimaryActionMeta,
  resolveUpdatedSummaryMeta,
  type CustomerRequestPrimaryActionMeta,
  type CustomerRequestRoleFilter,
} from './presentation';
import {
  useCustomerRequestResponsiveLayout,
  type CustomerRequestResponsiveLayoutMode,
} from './hooks/useCustomerRequestResponsiveLayout';

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

const buildParticipantTrail = (row: YeuCau): string =>
  [
    row.requester_name ? `YC: ${row.requester_name}` : null,
    row.dispatcher_name ? `Điều phối: ${row.dispatcher_name}` : null,
    (row.nguoi_xu_ly_name ?? row.performer_name) ? `Thực hiện: ${row.nguoi_xu_ly_name ?? row.performer_name}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

const SummaryCell: React.FC<{
  label: string;
  value: string;
  hint: string;
  valueCls?: string;
}> = ({ label, value, hint, valueCls = 'text-slate-800' }) => (
  <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-50/80 to-slate-100/80 px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md">
    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    <p className="relative text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
    <p className={`relative mt-1 line-clamp-1 text-sm font-semibold ${valueCls}`}>{value}</p>
    <p className="relative mt-0.5 line-clamp-1 text-[11px] text-slate-400">{hint}</p>
  </div>
);

const FilterChip: React.FC<{
  active: boolean;
  tone: 'neutral' | 'rose' | 'amber';
  label: string;
  onClick: () => void;
}> = ({ active, tone, label, onClick }) => {
  const toneCls =
    tone === 'rose'
      ? active
        ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-md shadow-rose-200'
        : 'bg-rose-50 text-rose-700 hover:bg-rose-100 hover:shadow-sm'
      : tone === 'amber'
      ? active
        ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-white shadow-md shadow-amber-200'
        : 'bg-amber-50 text-amber-700 hover:bg-amber-100 hover:shadow-sm'
      : active
      ? 'bg-gradient-to-r from-slate-900 to-slate-700 text-white shadow-md shadow-slate-200'
      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:shadow-sm';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${toneCls}`}
    >
      {label}
    </button>
  );
};

const PrimaryActionButton: React.FC<{
  actionMeta: CustomerRequestPrimaryActionMeta;
  onClick?: () => void;
  fullWidth?: boolean;
  size?: 'default' | 'compact';
}> = ({ actionMeta, onClick, fullWidth = false, size = 'default' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group relative inline-flex items-center justify-center rounded-xl border font-semibold shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
      size === 'compact' ? 'gap-1.5 px-3 py-2 text-[13px]' : 'gap-2 px-3.5 py-2.5 text-sm'
    } ${fullWidth ? 'w-full' : ''} ${actionMeta.cls}`}
  >
    <span className={`material-symbols-outlined transition-transform group-hover:scale-110 ${size === 'compact' ? 'text-[16px]' : 'text-[18px]'}`}>
      {actionMeta.icon}
    </span>
    <span>{actionMeta.label}</span>
  </button>
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
  requestRoleFilter: CustomerRequestRoleFilter;
  onSelectRow: (row: YeuCau) => void;
  onPrimaryAction?: (row: YeuCau, actionMeta: CustomerRequestPrimaryActionMeta) => void;
  onTogglePinRequest?: (row: YeuCau) => void;
}> = ({
  row,
  isActive,
  isPinned,
  layoutMode,
  requestRoleFilter,
  onSelectRow,
  onPrimaryAction,
  onTogglePinRequest,
}) => {
  const priorityMeta = LIST_PRIORITY_META[String(row.do_uu_tien ?? '')] ?? null;
  const ownerMeta = resolveOwnerSummaryMeta(row);
  const hoursMeta = resolveHoursSummaryMeta(row);
  const primaryActionMeta = resolvePrimaryActionMeta(row, requestRoleFilter);
  const updatedMeta = resolveUpdatedSummaryMeta(row);
  const participantTrail = buildParticipantTrail(row);
  const contextCaption =
    buildRequestContextCaption(row) || 'Chưa có khách hàng / dự án / sản phẩm';
  const isTablet = layoutMode === 'tablet';

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
      className={`group w-full cursor-pointer rounded-[26px] border px-5 py-4 text-left shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
        isActive
          ? 'border-primary/40 bg-gradient-to-br from-primary/[0.10] to-primary/[0.06] ring-1 ring-primary/10'
          : 'border-slate-200 bg-gradient-to-br from-white to-slate-50/50 hover:border-primary/30 hover:from-white hover:to-slate-100/50'
      }`}
    >
      <div className={`grid gap-4 ${isTablet ? 'md:grid-cols-[minmax(0,1fr)_280px]' : ''}`}>
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
            {priorityMeta ? (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${priorityMeta.cls}`}>
                <span className="material-symbols-outlined text-[12px]">bolt</span> {priorityMeta.label}
              </span>
            ) : null}
          </div>

          <p className="mt-3 line-clamp-2 text-base font-bold leading-snug text-slate-900">
            {row.tieu_de ?? row.summary ?? '--'}
          </p>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
            {contextCaption}
          </p>
          {participantTrail ? (
            <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-500">
              {participantTrail}
            </p>
          ) : null}

          <div className="mt-3">{renderHealthChips(layoutMode, row)}</div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <SummaryCell label="Phụ trách" value={ownerMeta.label} hint={ownerMeta.hint} />
            <SummaryCell
              label="Giờ"
              value={hoursMeta.value}
              hint={hoursMeta.hint}
              valueCls={hoursMeta.valueCls}
            />
            <SummaryCell
              label="Cập nhật"
              value={updatedMeta.updatedLabel}
              hint={updatedMeta.dueLabel}
            />
            <SummaryCell
              label="Tiếp theo"
              value={primaryActionMeta.label}
              hint={primaryActionMeta.hint}
              valueCls={
                primaryActionMeta.cls.split(' ').find((token) => token.startsWith('text-')) ||
                'text-slate-800'
              }
            />
          </div>

          <PrimaryActionButton
            actionMeta={primaryActionMeta}
            fullWidth
            onClick={() => onPrimaryAction?.(row, primaryActionMeta)}
          />
        </div>
      </div>
    </div>
  );
};

const RequestTableRow: React.FC<{
  row: YeuCau;
  isActive: boolean;
  isPinned: boolean;
  layoutMode: CustomerRequestResponsiveLayoutMode;
  requestRoleFilter: CustomerRequestRoleFilter;
  onSelectRow: (row: YeuCau) => void;
  onPrimaryAction?: (row: YeuCau, actionMeta: CustomerRequestPrimaryActionMeta) => void;
  onTogglePinRequest?: (row: YeuCau) => void;
}> = ({
  row,
  isActive,
  isPinned,
  layoutMode,
  requestRoleFilter,
  onSelectRow,
  onPrimaryAction,
  onTogglePinRequest,
}) => {
  const priorityMeta = LIST_PRIORITY_META[String(row.do_uu_tien ?? '')] ?? null;
  const ownerMeta = resolveOwnerSummaryMeta(row);
  const hoursMeta = resolveHoursSummaryMeta(row);
  const updatedMeta = resolveUpdatedSummaryMeta(row);
  const primaryActionMeta = resolvePrimaryActionMeta(row, requestRoleFilter);
  const participantTrail = buildParticipantTrail(row);
  const isWide = layoutMode === 'desktopWide';
  const isCompact = layoutMode === 'desktopCompact';
  const cellPaddingCls = isCompact ? 'px-3 py-3.5' : 'px-3 py-4';
  const requestCellPaddingCls = isCompact ? 'px-3 py-3.5' : 'px-4 py-4';

  return (
    <tr
      tabIndex={0}
      onClick={() => onSelectRow(row)}
      className={`group cursor-pointer border-b border-slate-100 align-top outline-none transition-all last:border-b-0 ${
        isActive
          ? 'bg-gradient-to-r from-primary/[0.08] to-primary/[0.04]'
          : 'hover:bg-gradient-to-r hover:from-slate-50/80 hover:to-slate-100/40 focus:bg-slate-50'
      }`}
    >
      <td className={`${requestCellPaddingCls} align-top`}>
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onTogglePinRequest?.(row);
            }}
            className={`mt-0.5 inline-flex rounded-full p-1.5 transition-all duration-200 ${
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

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm">
                {row.ma_yc ?? row.request_code ?? '--'}
              </span>
              {priorityMeta ? (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${priorityMeta.cls}`}>
                  <span className="material-symbols-outlined text-[12px]">bolt</span> {priorityMeta.label}
                </span>
              ) : null}
            </div>
            <p className={`mt-2 line-clamp-1 font-bold text-slate-900 ${isCompact ? 'text-[13px]' : 'text-sm'}`}>
              {row.tieu_de ?? row.summary ?? '--'}
            </p>
            <p className={`mt-1 text-[11px] leading-5 text-slate-500 ${isWide ? 'line-clamp-2' : 'line-clamp-1'}`}>
              {buildRequestContextCaption(row) || 'Chưa có khách hàng / dự án / sản phẩm'}
            </p>
            {participantTrail ? (
              <p className={`mt-1 text-[11px] leading-5 text-slate-400 ${isWide ? 'line-clamp-2' : 'line-clamp-1'}`}>
                {participantTrail}
              </p>
            ) : null}
          </div>
        </div>
      </td>
      <td className={`${cellPaddingCls} align-top`}>
        <p className={`font-semibold text-slate-800 ${isCompact ? 'text-[13px]' : 'text-sm'}`}>{ownerMeta.label}</p>
        <p className={`mt-1 text-[11px] leading-5 text-slate-400 ${isWide ? 'line-clamp-2' : 'line-clamp-1'}`}>
          {ownerMeta.hint}
        </p>
      </td>
      <td className={`${cellPaddingCls} align-top`}>{renderHealthChips(layoutMode, row)}</td>
      <td className={`${cellPaddingCls} align-top`}>
        <p className={`font-semibold ${hoursMeta.valueCls} ${isCompact ? 'text-[13px]' : 'text-sm'}`}>{hoursMeta.value}</p>
        <p className={`mt-1 text-[11px] leading-5 text-slate-400 ${isWide ? 'line-clamp-2' : 'line-clamp-1'}`}>
          {hoursMeta.hint}
        </p>
      </td>
      <td className={`${cellPaddingCls} align-top`}>
        <div className="space-y-2">
          <PrimaryActionButton
            actionMeta={primaryActionMeta}
            fullWidth
            size={isCompact ? 'compact' : 'default'}
            onClick={() => onPrimaryAction?.(row, primaryActionMeta)}
          />
          <p className={`text-[11px] leading-5 text-slate-400 ${isWide ? 'line-clamp-2' : 'line-clamp-1'}`}>
            {primaryActionMeta.hint}
          </p>
        </div>
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
  customerOptions,
  supportServiceGroups,
  requestMissingEstimateFilter,
  onToggleMissingEstimate,
  requestOverEstimateFilter,
  onToggleOverEstimate,
  requestSlaRiskFilter,
  onToggleSlaRisk,
  alertCounts,
  isDashboardLoading,
  rows,
  isListLoading,
  selectedRequestId,
  onSelectRow,
  onPrimaryAction,
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
  const [showSavedViews, setShowSavedViews] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const isDesktop = layoutMode === 'desktopCompact' || layoutMode === 'desktopWide';
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

  const filterControlsNode = (
    <div
      className={`grid gap-2.5 ${
        isMobile
          ? 'grid-cols-1'
          : layoutMode === 'tablet'
          ? 'md:grid-cols-2'
          : layoutMode === 'desktopCompact'
          ? 'xl:grid-cols-3'
          : '2xl:grid-cols-[220px_minmax(0,1.3fr)_160px_160px_150px]'
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
              : 'Tìm mã YC, nội dung, khách hàng...'
          }
          className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-4 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </div>
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
    <div className="flex h-full flex-col">
      {/* Filter card - sticky để luôn hiển thị khi scroll */}
      <div className="shrink-0 space-y-1.5">
        <div className="sticky top-0 z-[60] rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white/95 to-slate-50/80 px-5 py-3 shadow-lg shadow-slate-200/50 backdrop-blur-xl">
          <div className="space-y-3">
          {/* Header với nút toggle expansion */}
          {isDesktop ? (
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-slate-400">filter_list</span>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  Bộ lọc
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterExpanded((value) => !value)}
                className="group inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:shadow-md hover:border-slate-300"
              >
                <span className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${isFilterExpanded ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
                <span className="hidden sm:inline">{isFilterExpanded ? 'Thu gọn' : 'Mở rộng'}</span>
              </button>
            </div>
          ) : null}

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
                    placeholder="Tìm mã YC, nội dung, khách hàng..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white/80 pl-9 pr-4 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15 focus:shadow-md"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowMobileFilters((value) => !value)}
                  className="group inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:shadow-md hover:border-slate-300"
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

              {showMobileFilters ? (
                <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50/90 to-white/80 p-3 shadow-inner">
                  {filterControlsNode}
                </div>
              ) : null}
            </div>
          ) : isFilterExpanded ? (
            <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50/90 to-white/80 p-3 shadow-inner">
              {filterControlsNode}
            </div>
          ) : null}

          {(isMobile || isFilterExpanded) ? (
          <>
          <div
            className={`flex gap-2 ${isMobile ? 'overflow-x-auto pb-1' : 'flex-wrap items-center'}`}
          >
            <FilterChip
              active={requestMissingEstimateFilter}
              tone="neutral"
              label={`Thiếu ước lượng (${alertCounts.missing_estimate})`}
              onClick={onToggleMissingEstimate}
            />
            <FilterChip
              active={requestOverEstimateFilter}
              tone="rose"
              label={`Vượt ước lượng (${alertCounts.over_estimate})`}
              onClick={onToggleOverEstimate}
            />
            <FilterChip
              active={requestSlaRiskFilter}
              tone="amber"
              label={`Nguy cơ SLA (${alertCounts.sla_risk})`}
              onClick={onToggleSlaRisk}
            />
            {isDashboardLoading ? (
              <span className={`${isMobile ? 'hidden' : 'ml-auto'} text-xs text-slate-400`}>
                Đang cập nhật dashboard...
              </span>
            ) : null}
          </div>

          <div className={`flex gap-3 ${isMobile ? 'flex-col' : 'items-center justify-between'}`}>
            <p className="text-xs text-slate-500">
              Hiển thị <span className="font-semibold text-slate-700">{rows.length}</span> /{' '}
              <span className="font-semibold">{listMeta.total}</span> yêu cầu
              <span className="ml-1 text-slate-400">· Trang {safePage}/{totalPages}</span>
            </p>
            {hasListFilters ? (
              <button
                type="button"
                onClick={onClearFilters}
                className="text-left text-xs font-semibold text-primary hover:underline"
              >
                ✕ Xóa bộ lọc
              </button>
            ) : null}
          </div>
          </>
          ) : null}
          </div>
        </div>
      </div>

      {/* Danh sách yêu cầu - chiếm phần còn lại, scroll riêng */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {showCardList ? (
          <div className="space-y-2.5 py-2">
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
                  requestRoleFilter={requestRoleFilter}
                  onSelectRow={onSelectRow}
                  onPrimaryAction={onPrimaryAction}
                  onTogglePinRequest={onTogglePinRequest}
                />
              ))
            )}
          </div>
        ) : null}

        {showTable ? (
          <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 shadow-xl shadow-slate-200/50">
            {/* Header cố định */}
            <div className="shrink-0 overflow-hidden rounded-t-[28px] border-b border-slate-100 bg-gradient-to-r from-slate-50/90 to-slate-100/80 backdrop-blur-sm">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    <th className={`${layoutMode === 'desktopCompact' ? 'w-[33%] px-3 py-3' : 'w-[34%] px-4 py-3.5'}`}>Yêu cầu</th>
                    <th className={`${layoutMode === 'desktopCompact' ? 'w-[14%] px-3 py-3' : 'w-[15%] px-3 py-3.5'}`}>Phụ trách</th>
                    <th className={`${layoutMode === 'desktopCompact' ? 'w-[16%] px-3 py-3' : 'w-[17%] px-3 py-3.5'}`}>Trạng thái xử lý</th>
                    <th className={`${layoutMode === 'desktopCompact' ? 'w-[11%] px-3 py-3' : 'w-[12%] px-3 py-3.5'}`}>Giờ</th>
                    <th className={`${layoutMode === 'desktopCompact' ? 'w-[14%] px-3 py-3' : 'w-[12%] px-3 py-3.5'}`}>CTA</th>
                    <th className={`${layoutMode === 'desktopCompact' ? 'w-[12%] px-3 py-3' : 'w-[10%] px-3 py-3.5'}`}>Cập nhật</th>
                  </tr>
                </thead>
              </table>
            </div>
            {/* Body scroll */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full table-fixed text-sm">
                <tbody>
                  {isListLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <span className="material-symbols-outlined animate-spin text-[32px] text-slate-300">progress_activity</span>
                          <p className="text-sm font-medium text-slate-500">Đang tải danh sách yêu cầu...</p>
                        </div>
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
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
                        requestRoleFilter={requestRoleFilter}
                        onSelectRow={onSelectRow}
                        onPrimaryAction={onPrimaryAction}
                        onTogglePinRequest={onTogglePinRequest}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      {/* Pagination - luôn hiển thị, không scroll */}
      {totalPages > 1 ? (
        <div className="shrink-0 overflow-hidden rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 shadow-xl shadow-slate-200/50">
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
