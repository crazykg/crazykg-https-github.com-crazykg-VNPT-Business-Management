import React from 'react';
import type {
  PaginationMeta,
  SupportServiceGroup,
  YeuCau,
} from '../../types';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';
import { PaginationControls } from '../PaginationControls';
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect';
import {
  buildRequestContextCaption,
  buildHoursCaption,
  formatPercentValue,
  LIST_PRIORITY_META,
  resolveDecisionNextAction,
  resolveDecisionOwner,
  resolveSlaMeta,
  resolveStatusMeta,
  resolveWarningMeta,
  type CustomerRequestRoleFilter,
} from './presentation';

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
  const totalPages = Math.max(1, listMeta.total_pages || 1);
  const safePage = Math.min(listPage, totalPages);
  const showCardList = presentation === 'cards' || presentation === 'responsive';
  const showTable = presentation === 'table' || presentation === 'responsive';

  return (
    <div className="space-y-3">
      <div className="rounded-[28px] border border-slate-200 bg-white/90 px-4 py-4 shadow-sm backdrop-blur-sm">
        <div className="space-y-4">
          <div className="grid gap-2.5 md:grid-cols-2 2xl:grid-cols-[220px_minmax(0,1.3fr)_160px_160px_150px]">
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

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleMissingEstimate}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${requestMissingEstimateFilter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Thiếu ước lượng ({alertCounts.missing_estimate})
            </button>
            <button
              type="button"
              onClick={onToggleOverEstimate}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${requestOverEstimateFilter ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'}`}
            >
              Vượt ước lượng ({alertCounts.over_estimate})
            </button>
            <button
              type="button"
              onClick={onToggleSlaRisk}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${requestSlaRiskFilter ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
            >
              Nguy cơ SLA ({alertCounts.sla_risk})
            </button>
            {isDashboardLoading ? <span className="ml-auto text-xs text-slate-400">Đang cập nhật dashboard...</span> : null}
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Hiển thị <span className="font-semibold text-slate-700">{rows.length}</span> / <span className="font-semibold">{listMeta.total}</span> yêu cầu
              <span className="ml-1 text-slate-400">· Trang {safePage}/{totalPages}</span>
            </p>
            {hasListFilters ? (
              <button type="button" onClick={onClearFilters} className="text-xs font-semibold text-primary hover:underline">
                ✕ Xóa bộ lọc
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {showCardList ? (
        <div className="space-y-3 lg:hidden">
          {isListLoading ? (
            <div className="rounded-2xl border border-slate-200 px-4 py-12 text-center text-sm text-slate-400">
              Đang tải danh sách yêu cầu...
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 px-4 py-12 text-center text-sm text-slate-400">
              Không có yêu cầu nào phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            rows.map((row) => {
              const isActive = String(row.id) === String(selectedRequestId);
              const statusMeta = resolveStatusMeta(row.trang_thai, row.current_status_name_vi);
              const warningMeta = resolveWarningMeta(row.warning_level);
              const slaMeta = resolveSlaMeta(row.sla_status);
              const priMeta = LIST_PRIORITY_META[String(row.do_uu_tien ?? '')];
              const ownerMeta = resolveDecisionOwner(row);
              const nextActionMeta = resolveDecisionNextAction(row, requestRoleFilter);
              const isPinned = pinnedRequestIds.has(String(row.id));

              return (
                <div
                  key={String(row.id)}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectRow(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectRow(row);
                    }
                  }}
                  className={`w-full cursor-pointer rounded-2xl border px-4 py-3 text-left transition ${
                    isActive
                      ? 'border-primary/45 bg-primary/[0.10] shadow-sm shadow-primary/5 ring-1 ring-primary/10'
                      : 'border-slate-200 bg-white hover:border-primary/30 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${
                        isActive
                          ? 'bg-primary/15 text-deep-teal'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {row.ma_yc ?? row.request_code ?? '--'}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onTogglePinRequest?.(row);
                      }}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        isPinned
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-white/80 text-slate-500'
                      }`}
                      aria-label={isPinned ? 'Bỏ ghim yêu cầu' : 'Ghim yêu cầu'}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {isPinned ? 'star' : 'star_outline'}
                      </span>
                      {isPinned ? 'Đã ghim' : 'Ghim'}
                    </button>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.cls}`}>
                      ● {statusMeta.label}
                    </span>
                    {warningMeta ? (
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${warningMeta.cls}`}>
                        {warningMeta.label}
                      </span>
                    ) : null}
                    {slaMeta ? (
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${slaMeta.cls}`}>
                        {slaMeta.label}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm font-bold leading-snug text-slate-900">
                    {row.tieu_de ?? row.summary ?? '--'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {buildRequestContextCaption(row) || 'Chưa có khách hàng / dự án / sản phẩm'}
                  </p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Phụ trách</p>
                      <p className="mt-1 text-xs font-semibold text-slate-700">
                        {ownerMeta.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{ownerMeta.hint}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Ước lượng</p>
                      <p className="mt-1 text-xs font-semibold text-slate-700">{buildHoursCaption(row)}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {row.hours_usage_pct != null ? `Mức dùng ${formatPercentValue(row.hours_usage_pct)}` : 'Chưa có ước lượng'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2 sm:col-span-2 xl:col-span-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Next action</p>
                      <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${nextActionMeta.cls}`}>
                        {nextActionMeta.label}
                      </span>
                      <p className="mt-1 text-[11px] text-slate-400">{nextActionMeta.hint}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{row.updated_at ? `Cập nhật ${formatDateTimeDdMmYyyy(row.updated_at)?.slice(0, 16)}` : '--'}</span>
                    {priMeta ? (
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${priMeta.cls}`}>
                        ⚡ {priMeta.label}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : null}

      {showTable ? (
        <div className="relative hidden rounded-[28px] border border-slate-200 bg-white/95 shadow-sm lg:block">
          <div className="overflow-x-auto">
            <table className="min-w-[1320px] w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/90 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  <th className="w-[118px] px-3 py-3">Mã YC</th>
                  <th className="w-[92px] px-2 py-3 text-center">Độ ưu tiên</th>
                  <th className="w-[31%] min-w-[420px] px-4 py-3">Tiêu đề / KH / Dự án / SP</th>
                  <th className="w-[168px] px-3 py-3">Phụ trách</th>
                  <th className="w-[178px] px-3 py-3">Trạng thái / Risk</th>
                  <th className="w-[136px] px-3 py-3">Ước lượng / Thực tế</th>
                  <th className="w-[176px] px-3 py-3">Hành động tiếp theo</th>
                  <th className="w-[142px] px-3 py-3">Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {isListLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                      Đang tải danh sách yêu cầu...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                      Không có yêu cầu nào phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const isActive = String(row.id) === String(selectedRequestId);
                    const statusMeta = resolveStatusMeta(row.trang_thai, row.current_status_name_vi);
                    const warningMeta = resolveWarningMeta(row.warning_level);
                    const slaMeta = resolveSlaMeta(row.sla_status);
                    const priMeta = LIST_PRIORITY_META[String(row.do_uu_tien ?? '')];
                    const ownerMeta = resolveDecisionOwner(row);
                    const nextActionMeta = resolveDecisionNextAction(row, requestRoleFilter);
                    const isPinned = pinnedRequestIds.has(String(row.id));
                    const updatedAtLabel =
                      formatDateTimeDdMmYyyy(row.updated_at ?? row.received_at ?? null)?.slice(0, 16) ??
                      '--';
                    const slaDueLabel = row.sla_due_at
                      ? formatDateTimeDdMmYyyy(row.sla_due_at)?.slice(0, 16) ?? '--'
                      : null;

                    return (
                      <tr
                        key={String(row.id)}
                        tabIndex={0}
                        onClick={() => onSelectRow(row)}
                        className={`cursor-pointer border-b border-slate-100 outline-none transition last:border-b-0 ${
                          isActive
                            ? 'bg-primary/[0.10]'
                            : 'hover:bg-slate-50 focus:bg-slate-50'
                        }`}
                      >
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onTogglePinRequest?.(row);
                            }}
                            className={`mt-0.5 inline-flex rounded-full p-1 transition ${
                              isPinned
                                ? 'bg-amber-100 text-amber-700'
                                : 'text-slate-300 hover:bg-slate-100 hover:text-slate-600'
                            }`}
                            aria-label={isPinned ? 'Bỏ ghim yêu cầu' : 'Ghim yêu cầu'}
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {isPinned ? 'star' : 'star_outline'}
                            </span>
                          </button>
                          <div>
                            <span
                              className={`rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${
                                isActive
                                  ? 'bg-primary/15 text-deep-teal'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {row.ma_yc ?? row.request_code ?? '--'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 align-top text-center">
                        {priMeta ? (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${priMeta.cls}`}
                          >
                            ⚡ {priMeta.label}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                            --
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="line-clamp-1 font-semibold leading-snug text-slate-900">
                          {row.tieu_de ?? row.summary ?? '--'}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-slate-400">
                          {buildRequestContextCaption(row) || 'Chưa có khách hàng / dự án / sản phẩm'}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">
                          {[
                            row.requester_name ? `YC: ${row.requester_name}` : null,
                            row.dispatcher_name
                              ? `Điều phối: ${row.dispatcher_name}`
                              : null,
                            row.performer_name ? `Thực hiện: ${row.performer_name}` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="text-sm font-semibold text-slate-800">{ownerMeta.label}</p>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-400">{ownerMeta.hint}</p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.cls}`}>
                            ● {statusMeta.label}
                          </span>
                          {warningMeta ? (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${warningMeta.cls}`}>
                              {warningMeta.label}
                            </span>
                          ) : null}
                          {slaMeta ? (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${slaMeta.cls}`}>
                              {slaMeta.label}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="text-sm font-semibold text-slate-800">{buildHoursCaption(row)}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {row.hours_usage_pct != null ? `Mức dùng ${formatPercentValue(row.hours_usage_pct)}` : 'Chưa có ước lượng'}
                        </p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${nextActionMeta.cls}`}>
                          {nextActionMeta.label}
                        </span>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-400">{nextActionMeta.hint}</p>
                      </td>
                      <td className="px-3 py-3 align-top text-xs text-slate-500">
                        <div className="space-y-2.5">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                              Mới nhất
                            </p>
                            <p className="mt-0.5 text-[13px] font-semibold text-slate-700">
                              {updatedAtLabel}
                            </p>
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                  slaMeta?.cls ?? 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {slaMeta?.label ?? 'Chưa có SLA'}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {slaDueLabel ? `Hạn: ${slaDueLabel}` : 'Hạn: --'}
                            </p>
                          </div>
                        </div>
                      </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {totalPages > 1 ? (
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/95 shadow-sm">
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
