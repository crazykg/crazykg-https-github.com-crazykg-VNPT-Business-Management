import React from 'react';
import type {
  PaginationMeta,
  SupportServiceGroup,
  YeuCau,
} from '../../types';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect';
import {
  buildHoursCaption,
  formatPercentValue,
  LIST_PRIORITY_META,
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
  listMeta: PaginationMeta;
  onListPageChange: (page: number) => void;
  hasListFilters: boolean;
  onClearFilters: () => void;
  requestRoleFilter: CustomerRequestRoleFilter;
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
  listMeta,
  onListPageChange,
  hasListFilters,
  onClearFilters,
  requestRoleFilter,
}) => {
  const totalPages = Math.max(1, listMeta.total_pages || 1);
  const safePage = Math.min(listPage, totalPages);

  return (
    <div className="space-y-4">
      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-[220px_minmax(0,1.3fr)_160px_160px_150px]">
        <SearchableSelect
          value={activeProcessCode}
          options={processOptions}
          onChange={onProcessCodeChange}
          label=""
          placeholder="Tiến trình"
          searchPlaceholder="Tìm tiến trình..."
          compact
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
        />
        <SearchableSelect
          value={requestPriorityFilter}
          options={PRIORITY_OPTIONS}
          onChange={onRequestPriorityFilterChange}
          label=""
          placeholder="Ưu tiên"
          searchPlaceholder="Tìm ưu tiên..."
          compact
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleMissingEstimate}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${requestMissingEstimateFilter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          Thiếu estimate ({alertCounts.missing_estimate})
        </button>
        <button
          type="button"
          onClick={onToggleOverEstimate}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${requestOverEstimateFilter ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'}`}
        >
          Vượt estimate ({alertCounts.over_estimate})
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

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
              <th className="w-[120px] px-4 py-3">Mã YC</th>
              <th className="px-4 py-3">Tiêu đề / Điều phối</th>
              <th className="w-[180px] px-4 py-3">Trạng thái / Cảnh báo</th>
              <th className="w-[130px] px-4 py-3">Ước lượng</th>
              <th className="w-[120px] px-4 py-3">Ngày TN</th>
            </tr>
          </thead>
          <tbody>
            {isListLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                  Đang tải danh sách yêu cầu...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
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

                return (
                  <tr
                    key={String(row.id)}
                    onClick={() => onSelectRow(row)}
                    className={`cursor-pointer border-b border-slate-100 transition last:border-b-0 ${isActive ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-4 py-3 align-top">
                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                        {row.ma_yc ?? row.request_code ?? '--'}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="line-clamp-1 font-semibold leading-snug text-slate-900">
                        {row.tieu_de ?? row.summary ?? '--'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {[row.khach_hang_name ?? row.customer_name, row.support_service_group_name, row.requester_name ? `YC: ${row.requester_name}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {[row.dispatcher_name ? `Điều phối: ${row.dispatcher_name}` : null, row.performer_name ? `Thực hiện: ${row.performer_name}` : null, row.project_name ? `Dự án: ${row.project_name}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top">
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
                    <td className="px-4 py-3 align-top">
                      {priMeta ? (
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${priMeta.cls}`}>
                          ⚡ {priMeta.label}
                        </span>
                      ) : null}
                      <p className="mt-2 text-sm font-semibold text-slate-800">{buildHoursCaption(row)}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {row.hours_usage_pct != null ? `Mức dùng ${formatPercentValue(row.hours_usage_pct)}` : 'Chưa có estimate'}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-slate-500">
                      <p>{formatDateTimeDdMmYyyy(row.received_at ?? null)?.slice(0, 16) ?? '--'}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {row.sla_due_at ? `SLA: ${formatDateTimeDdMmYyyy(row.sla_due_at)?.slice(0, 16)}` : 'SLA: --'}
                      </p>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => onListPageChange(Math.max(1, safePage - 1))}
            disabled={safePage <= 1}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            Trước
          </button>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            {Array.from({ length: totalPages }, (_, index) => index + 1)
              .filter((page) => page === 1 || page === totalPages || Math.abs(page - safePage) <= 1)
              .reduce<(number | '...')[]>((acc, page, index, arr) => {
                if (index > 0 && typeof arr[index - 1] === 'number' && page - (arr[index - 1] as number) > 1) {
                  acc.push('...');
                }
                acc.push(page);
                return acc;
              }, [])
              .map((page, index) =>
                page === '...' ? (
                  <span key={`ellipsis-${index}`} className="px-1">
                    …
                  </span>
                ) : (
                  <button
                    key={page}
                    type="button"
                    onClick={() => onListPageChange(page as number)}
                    className={`h-8 min-w-[32px] rounded-lg px-2 text-xs font-semibold transition ${page === safePage ? 'bg-primary text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}
                  >
                    {page}
                  </button>
                )
              )}
            <span className="ml-1 text-slate-400">· {listMeta.total} yêu cầu</span>
          </div>

          <button
            type="button"
            onClick={() => onListPageChange(Math.min(totalPages, safePage + 1))}
            disabled={safePage >= totalPages}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sau
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      ) : null}
    </div>
  );
};
