import React, { useMemo, useState } from 'react';
import type { PaginationMeta } from '../../types/common';
import type { YeuCau } from '../../types/customerRequest';
import { PaginationControls } from '../PaginationControls';
import { type SearchableSelectOption } from '../SearchableSelect';
import { SearchableMultiSelect } from '../SearchableMultiSelect';
import {
  buildRequestContextCaption,
  formatHoursValue,
  formatPercentValue,
  resolveHealthSummaryMeta,
  resolveHoursSummaryMeta,
  resolvePrimaryActionMeta,
  resolveRequestStatusMeta,
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

type CustomerRequestListViewPreset = 'standard' | 'ar' | 'pm' | 'operations';
type CustomerRequestListColumnKey =
  | 'code'
  | 'title'
  | 'context'
  | 'creator'
  | 'handler'
  | 'accountable'
  | 'status'
  | 'executionDate'
  | 'completedDate'
  | 'dates'
  | 'meta'
  | 'estimate'
  | 'lastLog'
  | 'nextAction'
  | 'pmOwner';

const LIST_VIEW_PRESETS: Array<{ key: CustomerRequestListViewPreset; label: string; icon: string }> = [
  { key: 'standard', label: 'Chuẩn', icon: 'view_week' },
  { key: 'ar', label: 'A/R', icon: 'supervisor_account' },
  { key: 'pm', label: 'PM dự án', icon: 'account_tree' },
  { key: 'operations', label: 'Vận hành', icon: 'settings_suggest' },
];

const LIST_COLUMN_OPTIONS: Array<{ key: CustomerRequestListColumnKey; label: string }> = [
  { key: 'code', label: 'Mã yêu cầu' },
  { key: 'title', label: 'Tên yêu cầu' },
  { key: 'context', label: 'Khách hàng / Dự án / Sản phẩm' },
  { key: 'creator', label: 'Người nhập' },
  { key: 'handler', label: 'Người xử lý' },
  { key: 'accountable', label: 'Người quản lý (A)' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'dates', label: 'Ngày thực hiện / kết thúc' },
  { key: 'meta', label: 'Tags / File / Task' },
  { key: 'estimate', label: 'Estimate / Actual' },
  { key: 'lastLog', label: 'Last worklog' },
  { key: 'nextAction', label: 'Next action' },
  { key: 'pmOwner', label: 'PM / Owner' },
];

const STANDARD_LIST_COLUMN_OPTIONS: Array<{ key: CustomerRequestListColumnKey; label: string }> = [
  { key: 'code', label: 'Mã yêu cầu' },
  { key: 'title', label: 'Tên yêu cầu' },
  { key: 'creator', label: 'Người nhập yêu cầu' },
  { key: 'handler', label: 'Người xử lý' },
  { key: 'accountable', label: 'Người quản lý (A)' },
  { key: 'status', label: 'Trạng thái XL' },
  { key: 'executionDate', label: 'Ngày thực hiện' },
  { key: 'completedDate', label: 'Ngày kết thúc' },
];

const DEFAULT_VISIBLE_LIST_COLUMNS: CustomerRequestListColumnKey[] = [
  'code',
  'title',
  'context',
  'creator',
  'handler',
  'status',
  'executionDate',
  'completedDate',
  'dates',
  'meta',
  'estimate',
  'lastLog',
  'nextAction',
  'pmOwner',
];

type CustomerRequestListTableColumn = {
  key: string;
  label: string;
  widthClass: string;
};

const STANDARD_LIST_TABLE_COLUMNS = {
  code: { key: 'requestCode', label: 'Mã yêu cầu', widthClass: 'w-[168px]' },
  title: { key: 'requestTitle', label: 'Tên yêu cầu', widthClass: 'w-[336px]' },
  creator: { key: 'requestCreator', label: 'Người nhập yêu cầu', widthClass: 'w-[210px]' },
  handler: { key: 'requestHandler', label: 'Người xử lý', widthClass: 'w-[196px]' },
  accountable: { key: 'requestAccountable', label: 'Người quản lý (A)', widthClass: 'w-[196px]' },
  status: { key: 'requestStatus', label: 'Trạng thái XL', widthClass: 'w-[188px]' },
  executionDate: { key: 'requestExecutionDate', label: 'Ngày thực hiện', widthClass: 'w-[176px]' },
  completedDate: { key: 'requestCompletedDate', label: 'Ngày kết thúc', widthClass: 'w-[176px]' },
} satisfies Record<
  'code' | 'title' | 'creator' | 'handler' | 'accountable' | 'status' | 'executionDate' | 'completedDate',
  CustomerRequestListTableColumn
>;

const LIST_TABLE_COLUMNS_BY_PRESET: Record<Exclude<CustomerRequestListViewPreset, 'standard'>, CustomerRequestListTableColumn[]> = {
  ar: [
    { key: 'request', label: 'Yêu cầu', widthClass: 'w-[360px]' },
    { key: 'creator', label: 'Người nhập', widthClass: 'w-[220px]' },
    { key: 'handler', label: 'Người xử lý', widthClass: 'w-[220px]' },
    { key: 'status', label: 'Trạng thái / ngày', widthClass: 'w-[305px]' },
  ],
  pm: [
    { key: 'request', label: 'Yêu cầu / dự án', widthClass: 'w-[360px]' },
    { key: 'owner', label: 'PM control', widthClass: 'w-[245px]' },
    { key: 'estimate', label: 'Estimate / Log', widthClass: 'w-[260px]' },
    { key: 'next', label: 'Next / SLA', widthClass: 'w-[250px]' },
  ],
  operations: [
    { key: 'request', label: 'Yêu cầu', widthClass: 'w-[360px]' },
    { key: 'sla', label: 'Trạng thái / SLA', widthClass: 'w-[245px]' },
    { key: 'age', label: 'Tuổi bước', widthClass: 'w-[205px]' },
    { key: 'next', label: 'Blocker / Next', widthClass: 'w-[305px]' },
  ],
};

const resolveListTableColumns = (
  viewPreset: CustomerRequestListViewPreset,
  visibleColumns: Set<CustomerRequestListColumnKey>
): CustomerRequestListTableColumn[] => {
  if (viewPreset === 'standard') {
    return [
      STANDARD_LIST_TABLE_COLUMNS.code,
      STANDARD_LIST_TABLE_COLUMNS.title,
      ...(visibleColumns.has('creator') ? [STANDARD_LIST_TABLE_COLUMNS.creator] : []),
      ...(visibleColumns.has('handler') ? [STANDARD_LIST_TABLE_COLUMNS.handler] : []),
      ...(visibleColumns.has('accountable') ? [STANDARD_LIST_TABLE_COLUMNS.accountable] : []),
      ...(visibleColumns.has('status') ? [STANDARD_LIST_TABLE_COLUMNS.status] : []),
      ...(visibleColumns.has('executionDate') ? [STANDARD_LIST_TABLE_COLUMNS.executionDate] : []),
      ...(visibleColumns.has('completedDate') ? [STANDARD_LIST_TABLE_COLUMNS.completedDate] : []),
    ];
  }

  return LIST_TABLE_COLUMNS_BY_PRESET[viewPreset];
};

const LIST_ROW_CLASS = {
  cell: 'px-2.5 py-2',
  primary: 'text-[13px] leading-4',
  secondary: 'text-[11px] leading-4',
  stack: 'gap-1',
  row: 'h-[56px]',
};

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

const readFirstValue = (row: YeuCau, keys: string[]): unknown => {
  const record = row as unknown as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value;
    }
  }
  return null;
};

const readNumberValue = (row: YeuCau, keys: string[]): number | null => {
  const value = readFirstValue(row, keys);
  if (value === null) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const resolveSmallCountLabel = (row: YeuCau, label: string, keys: string[]): string => {
  const numeric = readNumberValue(row, keys);
  return `${label} ${numeric ?? 0}`;
};

const resolveTagFileTaskSummary = (row: YeuCau): string =>
  [
    resolveSmallCountLabel(row, 'tag', ['tag_count', 'tags_count', 'yeu_cau_tags_count']),
    resolveSmallCountLabel(row, 'file', ['attachment_count', 'attachments_count', 'file_count']),
    resolveSmallCountLabel(row, 'task', ['task_count', 'tasks_count', 'ref_task_count', 'ref_tasks_count']),
  ].join(' · ');

const resolveProjectManagerLabel = (row: YeuCau): string =>
  row.accountable_name ||
  row.pm_name ||
  row.dispatcher_name ||
  '--';

const resolveAccountableLabel = (row: YeuCau): string =>
  row.accountable_name ||
  '--';

const resolveCurrentOwnerLabel = (row: YeuCau): string =>
  row.current_owner_name ||
  row.nguoi_xu_ly_name ||
  row.performer_name ||
  row.receiver_name ||
  '--';

const resolveLastWorklogLabel = (row: YeuCau): string => {
  const value = readFirstValue(row, [
    'last_worklog_at',
    'latest_worklog_at',
    'last_worklog_date',
    'latest_activity_at',
    'last_activity_at',
  ]);
  return value ? formatDateTimeDdMmYyyy(String(value)).slice(0, 16) : '--';
};

const resolveDaysSinceLabel = (value: string | null | undefined): string => {
  if (!value) {
    return '--';
  }

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return '--';
  }

  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  return days === 0 ? 'hôm nay' : `${days}d`;
};

const resolveBlockerLabel = (row: YeuCau): string => {
  if (row.missing_estimate || row.warning_level === 'missing') return 'Thiếu estimate';
  if (row.over_estimate || row.warning_level === 'hard') return 'Vượt estimate';
  if (row.sla_status === 'at_risk') return 'SLA risk';
  if (row.sla_status === 'overdue') return 'Quá hạn SLA';
  if (resolveLastWorklogLabel(row) === '--') return 'Chưa worklog';
  return '--';
};

const resolveActionLabel = (row: YeuCau, roleFilter: CustomerRequestRoleFilter): string => {
  const actionMeta = resolvePrimaryActionMeta(row, roleFilter);
  if (row.missing_estimate || row.warning_level === 'missing') return 'Bổ sung est';
  if (actionMeta.kind === 'worklog') return 'Ghi log';
  if (actionMeta.kind === 'estimate') return 'Bổ sung est';
  if (actionMeta.kind === 'transition') return actionMeta.label || 'Chuyển bước';
  return actionMeta.label || 'Xem chi tiết';
};

const resolveEstimateLine = (row: YeuCau): string => {
  const estimate = formatHoursValue(row.estimated_hours);
  const actual = formatHoursValue(row.total_hours_spent ?? row.tong_gio_xu_ly);
  const usage = row.hours_usage_pct != null ? ` · ${formatPercentValue(row.hours_usage_pct)}` : '';
  return `Est ${estimate} / Act ${actual}${usage}`;
};

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
            <span className="rounded-[var(--ui-control-radius)] bg-gradient-to-br from-slate-100 to-slate-200 px-3 py-1.5 font-sans text-xs font-bold text-slate-700 shadow-sm">
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
  viewPreset: CustomerRequestListViewPreset;
  visibleColumns: Set<CustomerRequestListColumnKey>;
  requestRoleFilter: CustomerRequestRoleFilter;
  onSelectRow: (row: YeuCau) => void;
  onTogglePinRequest?: (row: YeuCau) => void;
}> = ({
  row,
  isActive,
  isPinned,
  layoutMode,
  viewPreset,
  visibleColumns,
  requestRoleFilter,
  onSelectRow,
  onTogglePinRequest,
}) => {
  const handlerMeta = resolveHandlerSummaryMeta(row);
  const hoursMeta = resolveHoursSummaryMeta(row);
  const statusMeta = resolveRequestStatusMeta(row);
  const rowClass = LIST_ROW_CLASS;
  const tableColumns = resolveListTableColumns(viewPreset, visibleColumns);
  const rowTitle = row.tieu_de ?? row.summary ?? '--';
  const requestCode = row.ma_yc ?? row.request_code ?? '--';
  const contextCaption =
    buildRequestContextCaption(row) || 'Chưa có khách hàng / dự án / sản phẩm';
  const creatorName = resolveCreatorName(row);
  const statusLabel = resolveStatusLabel(row);
  const projectManagerLabel = resolveProjectManagerLabel(row);
  const accountableName = resolveAccountableLabel(row);
  const currentOwnerLabel = resolveCurrentOwnerLabel(row);
  const tagFileTaskSummary = resolveTagFileTaskSummary(row);
  const estimateLine = resolveEstimateLine(row);
  const nextActionLabel = resolveActionLabel(row, requestRoleFilter);
  const blockerLabel = resolveBlockerLabel(row);
  const createdDateLabel = resolveCreatedLabel(row);
  const executionDateLabel = resolveExecutionLabel(row);
  const completedDateLabel = resolveCompletedLabel(row);
  const lastWorklogLabel = resolveLastWorklogLabel(row);
  const openedAgeLabel = resolveDaysSinceLabel(row.created_at);
  const stepAgeLabel = resolveDaysSinceLabel(row.current_entered_at);
  const secondaryTextCls = `${rowClass.secondary} font-medium text-[color:var(--ui-text-muted)]`;
  const labelTextCls = `${rowClass.secondary} font-bold uppercase text-[color:var(--ui-text-subtle)]`;
  const hasColumn = (key: CustomerRequestListColumnKey): boolean =>
    key === 'code' || key === 'title' || visibleColumns.has(key);
  const renderRequestCell = (
    <div className={`flex min-w-0 flex-col ${rowClass.stack}`}>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {hasColumn('code') ? (
          <span className="inline-flex max-w-full items-center rounded-[var(--ui-control-radius)] bg-primary/10 px-2 py-0.5 font-sans text-[11px] font-bold text-primary">
            {requestCode}
          </span>
        ) : null}
        {hasColumn('status') ? (
          <span className="inline-flex min-w-0 items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
            <span className="truncate">{statusLabel}</span>
          </span>
        ) : null}
      </div>
      {hasColumn('title') ? (
        <p className={`line-clamp-1 font-bold text-slate-950 ${rowClass.primary}`}>{rowTitle}</p>
      ) : null}
      {hasColumn('context') ? (
        <p className={`line-clamp-1 ${secondaryTextCls}`}>{contextCaption}</p>
      ) : null}
      {hasColumn('meta') ? (
        <p className={`line-clamp-1 ${secondaryTextCls}`}>{tagFileTaskSummary}</p>
      ) : null}
    </div>
  );
  const renderPeopleCell = (
    <div className={`flex min-w-0 flex-col ${rowClass.stack}`}>
      {hasColumn('creator') ? (
        <p className={secondaryTextCls}>
          <span className={labelTextCls}>Người nhập</span> <span className="font-semibold text-slate-800">{creatorName}</span>
        </p>
      ) : null}
      {hasColumn('handler') ? (
        <p className={secondaryTextCls}>
          <span className={labelTextCls}>Người xử lý</span> <span className="font-semibold text-slate-800">{handlerMeta.label}</span>
        </p>
      ) : null}
      {hasColumn('pmOwner') ? (
        <p className={secondaryTextCls}>
          <span className={labelTextCls}>PM</span> <span className="font-semibold text-slate-800">{projectManagerLabel}</span>
        </p>
      ) : null}
    </div>
  );
  const renderProgressCell = (
    <div className={`flex min-w-0 flex-col ${rowClass.stack}`}>
      {hasColumn('status') ? <div>{renderHealthChips(layoutMode, row)}</div> : null}
      {hasColumn('estimate') ? (
        <p className={secondaryTextCls}>
          <span className={labelTextCls}>Giờ</span> <span className={hoursMeta.valueCls}>{estimateLine}</span>
        </p>
      ) : null}
      {hasColumn('nextAction') ? (
        <p className={secondaryTextCls}>
          <span className={labelTextCls}>Next</span> <span className="font-semibold text-slate-800">{nextActionLabel}</span>
        </p>
      ) : null}
    </div>
  );
  const renderTimeCell = (
    <div className={`grid min-w-0 grid-cols-2 gap-x-3 gap-y-1 ${secondaryTextCls}`}>
      {hasColumn('dates') ? (
        <>
          <span className="min-w-0 truncate"><span className={labelTextCls}>TH</span> {executionDateLabel}</span>
          <span className="min-w-0 truncate"><span className={labelTextCls}>KT</span> {completedDateLabel}</span>
          <span className="min-w-0 truncate"><span className={labelTextCls}>Tạo</span> {createdDateLabel}</span>
        </>
      ) : null}
      {hasColumn('lastLog') ? (
        <span className="min-w-0 truncate"><span className={labelTextCls}>Log</span> {lastWorklogLabel}</span>
      ) : null}
    </div>
  );
  const renderPresetCell = (key: string): React.ReactNode => {
    if (key === 'requestCode') {
      return (
        <div className={`flex min-w-0 items-center ${rowClass.stack}`}>
          <span
            title={requestCode}
            className={`line-clamp-1 whitespace-nowrap font-sans font-semibold text-primary ${rowClass.primary}`}
          >
            {requestCode}
          </span>
        </div>
      );
    }
    if (key === 'requestTitle') {
      return (
        <div className={`flex min-w-0 flex-col ${rowClass.stack}`}>
          <p title={rowTitle} className={`line-clamp-1 font-bold text-slate-950 ${rowClass.primary}`}>{rowTitle}</p>
          <p title={contextCaption} className={`line-clamp-1 ${secondaryTextCls}`}>{contextCaption}</p>
        </div>
      );
    }
    if (key === 'requestCreator') {
      return (
        <div className={`flex min-w-0 items-center ${rowClass.stack}`}>
          <p title={creatorName} className={`line-clamp-1 font-semibold text-slate-900 ${rowClass.primary}`}>{creatorName}</p>
        </div>
      );
    }
    if (key === 'requestHandler') {
      return (
        <div className={`flex min-w-0 items-center ${rowClass.stack}`}>
          <p title={handlerMeta.label} className={`line-clamp-1 font-semibold text-slate-900 ${rowClass.primary}`}>{handlerMeta.label}</p>
        </div>
      );
    }
    if (key === 'requestAccountable') {
      return (
        <div className={`flex min-w-0 items-center ${rowClass.stack}`}>
          <p title={accountableName} className={`line-clamp-1 font-semibold text-slate-900 ${rowClass.primary}`}>{accountableName}</p>
        </div>
      );
    }
    if (key === 'requestStatus') {
      return (
        <div className={`flex min-w-0 items-center ${rowClass.stack}`}>
          <span
            title={statusMeta.label}
            className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${statusMeta.cls}`}
          >
            <span className="truncate">{statusMeta.label}</span>
          </span>
        </div>
      );
    }
    if (key === 'requestExecutionDate') {
      return (
        <div className={`flex min-w-0 items-center ${rowClass.stack}`}>
          <p
            title={executionDateLabel}
            className={`line-clamp-1 whitespace-nowrap tabular-nums font-semibold text-slate-900 ${rowClass.primary}`}
          >
            {executionDateLabel}
          </p>
        </div>
      );
    }
    if (key === 'requestCompletedDate') {
      return (
        <div className={`flex min-w-0 items-center ${rowClass.stack}`}>
          <p
            title={completedDateLabel}
            className={`line-clamp-1 whitespace-nowrap tabular-nums font-semibold text-slate-900 ${rowClass.primary}`}
          >
            {completedDateLabel}
          </p>
        </div>
      );
    }
    if (key === 'request') return renderRequestCell;
    if (key === 'people') return renderPeopleCell;
    if (key === 'progress') return renderProgressCell;
    if (key === 'time') return renderTimeCell;
    if (key === 'creator') {
      return (
        <div className={`flex min-w-0 flex-col ${rowClass.stack}`}>
          <p className={`line-clamp-1 font-semibold text-slate-900 ${rowClass.primary}`}>{creatorName}</p>
          <p className={`line-clamp-1 ${secondaryTextCls}`}>{contextCaption}</p>
          <p className={`line-clamp-1 ${secondaryTextCls}`}><span className={labelTextCls}>Tạo</span> {createdDateLabel}</p>
        </div>
      );
    }
    if (key === 'handler') {
      return (
        <div className={`flex min-w-0 flex-col ${rowClass.stack}`}>
          <p className={`line-clamp-1 font-semibold text-slate-900 ${rowClass.primary}`}>{handlerMeta.label}</p>
          <p className={`line-clamp-1 ${secondaryTextCls}`}><span className={labelTextCls}>PM</span> {projectManagerLabel}</p>
          <p className={`line-clamp-1 ${secondaryTextCls}`}><span className={labelTextCls}>Next</span> {nextActionLabel}</p>
        </div>
      );
    }
    if (key === 'status') {
      return (
        <div className={`flex min-w-0 flex-col ${rowClass.stack}`}>
          <div>{renderHealthChips(layoutMode, row)}</div>
          <p className={`line-clamp-1 ${secondaryTextCls}`}><span className={labelTextCls}>TH</span> {executionDateLabel}</p>
          <p className={`line-clamp-1 ${secondaryTextCls}`}><span className={labelTextCls}>KT</span> {completedDateLabel}</p>
        </div>
      );
    }
    if (key === 'task') {
      return (
        <div className={`flex min-w-0 flex-col ${rowClass.stack}`}>
          <p className={`line-clamp-1 font-semibold text-slate-900 ${rowClass.primary}`}>{tagFileTaskSummary}</p>
          <p className={`line-clamp-1 ${secondaryTextCls}`}><span className={labelTextCls}>Owner</span> {currentOwnerLabel}</p>
          <p className={`line-clamp-1 ${secondaryTextCls}`}><span className={labelTextCls}>Next</span> {nextActionLabel}</p>
        </div>
      );
    }
    if (key === 'estimate') {
      return (
        <div className={`flex min-w-0 flex-col ${rowClass.stack}`}>
          <p className={`line-clamp-1 font-semibold ${hoursMeta.valueCls} ${rowClass.primary}`}>{estimateLine}</p>
          <p className={`line-clamp-1 ${secondaryTextCls}`}><span className={labelTextCls}>Log</span> {lastWorklogLabel}</p>
          <div>{renderHealthChips(layoutMode, row, { includePrimary: false })}</div>
        </div>
      );
    }
    if (key === 'owner') {
      return (
        <div className={`flex min-w-0 flex-col ${rowClass.stack}`}>
          <p className={`line-clamp-1 font-semibold text-slate-900 ${rowClass.primary}`}><span className={labelTextCls}>PM</span> {projectManagerLabel}</p>
          <p className={`line-clamp-1 ${secondaryTextCls}`}><span className={labelTextCls}>Owner</span> {currentOwnerLabel}</p>
          <p className={`line-clamp-1 ${secondaryTextCls}`}><span className={labelTextCls}>Người nhập</span> {creatorName}</p>
        </div>
      );
    }
    if (key === 'sla') {
      return (
        <div className={`flex min-w-0 flex-col ${rowClass.stack}`}>
          <div>{renderHealthChips(layoutMode, row)}</div>
          <p className={`line-clamp-1 ${secondaryTextCls}`}><span className={labelTextCls}>Trạng thái</span> {statusLabel}</p>
          <p className={`line-clamp-1 ${secondaryTextCls}`}><span className={labelTextCls}>SLA</span> {row.sla_due_at ? formatDateTimeDdMmYyyy(row.sla_due_at).slice(0, 16) : '--'}</p>
        </div>
      );
    }
    if (key === 'age') {
      return (
        <div className={`grid min-w-0 grid-cols-2 gap-x-3 gap-y-1 ${secondaryTextCls}`}>
          <span className="min-w-0 truncate"><span className={labelTextCls}>Mở</span> {openedAgeLabel}</span>
          <span className="min-w-0 truncate"><span className={labelTextCls}>Bước</span> {stepAgeLabel}</span>
          <span className="min-w-0 truncate"><span className={labelTextCls}>TH</span> {executionDateLabel}</span>
          <span className="min-w-0 truncate"><span className={labelTextCls}>KT</span> {completedDateLabel}</span>
        </div>
      );
    }
    if (key === 'next') {
      return (
        <div className={`flex min-w-0 flex-col ${rowClass.stack}`}>
          <p className={`line-clamp-1 font-semibold ${blockerLabel === '--' ? 'text-slate-700' : 'text-rose-700'} ${rowClass.primary}`}>
            {blockerLabel}
          </p>
          <p className={`line-clamp-1 ${secondaryTextCls}`}><span className={labelTextCls}>Next</span> {nextActionLabel}</p>
          <p className={`line-clamp-1 ${secondaryTextCls}`}><span className={labelTextCls}>Xử lý</span> {handlerMeta.label}</p>
        </div>
      );
    }
    return '--';
  };

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
      className={`group cursor-pointer border-b border-slate-100 align-middle outline-none transition-all last:border-b-0 ${
        isActive
          ? 'bg-gradient-to-r from-primary/[0.08] to-primary/[0.04]'
          : 'hover:bg-gradient-to-r hover:from-slate-50/80 hover:to-slate-100/40 focus:bg-slate-50'
      }`}
    >
      <td className={`${rowClass.cell} w-[52px] align-middle text-center`}>
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
      {tableColumns.map((column) => (
        <td key={column.key} className={`${rowClass.cell} ${rowClass.row} align-middle`}>
          {renderPresetCell(column.key)}
        </td>
      ))}
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
  showFilterToolbar = true,
  pinnedRequestIds = new Set<string>(),
  onTogglePinRequest,
}) => {
  const layoutMode = useCustomerRequestResponsiveLayout();
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [listViewPreset, setListViewPreset] = useState<CustomerRequestListViewPreset>('standard');
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<CustomerRequestListColumnKey>>(
    () => new Set(DEFAULT_VISIBLE_LIST_COLUMNS)
  );
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
    isMobile ? 'h-11' : 'h-8'
  } w-full rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] px-3 text-sm font-medium text-[color:var(--ui-text-default)] shadow-[var(--ui-shadow-shell)] outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/12`;
  const toolbarSearchClass = `${
    isMobile ? 'h-11' : 'h-8'
  } w-full rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] pl-9 pr-3.5 text-sm font-medium text-[color:var(--ui-text-default)] shadow-[var(--ui-shadow-shell)] outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/12`;
  const toolbarSelectTriggerClass = `${
    isMobile ? 'h-11' : 'h-8'
  } rounded-[var(--ui-control-radius)] border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] px-3.5 text-sm font-medium text-[color:var(--ui-text-default)] shadow-[var(--ui-shadow-shell)] focus:bg-white`;
  const toolbarButtonClass = `${
    isMobile ? 'h-11' : 'h-8'
  } inline-flex items-center justify-center rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] px-3 text-xs font-semibold text-[color:var(--ui-text-default)] transition hover:bg-[var(--ui-surface-subtle)]`;
  const quickFilterButtonBaseClass =
    'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold transition-colors';
  const tableColumns = resolveListTableColumns(listViewPreset, visibleColumns);
  const tableColumnCount = tableColumns.length + 1;
  const tableMinWidthClass = listViewPreset === 'standard'
    ? (visibleColumns.has('accountable') ? 'min-w-[1698px]' : 'min-w-[1502px]')
    : 'min-w-[1168px]';
  const columnOptions = listViewPreset === 'standard' ? STANDARD_LIST_COLUMN_OPTIONS : LIST_COLUMN_OPTIONS;
  const handleToggleListColumn = (key: CustomerRequestListColumnKey) => {
    if (key === 'code' || key === 'title') {
      return;
    }

    setVisibleColumns((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };
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
  const desktopListControlsNode = (
    <div className="flex flex-wrap items-center gap-2 rounded-[var(--ui-control-radius)] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-subtle)] px-2 py-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--ui-text-subtle)]">
          View
        </span>
        {LIST_VIEW_PRESETS.map((preset) => {
          const isActivePreset = preset.key === listViewPreset;
          return (
            <button
              key={preset.key}
              type="button"
              aria-pressed={isActivePreset}
              onClick={() => setListViewPreset(preset.key)}
              className={`inline-flex h-7 items-center gap-1.5 rounded-[var(--ui-control-radius)] px-2.5 text-xs font-bold transition-colors ${
                isActivePreset
                  ? 'bg-primary text-white shadow-[var(--ui-shadow-shell)]'
                  : 'border border-[var(--ui-border)] bg-white text-[color:var(--ui-text-default)] hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">{preset.icon}</span>
              <span>{preset.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-pressed={requestMissingEstimateFilter}
          onClick={onToggleMissingEstimate}
          className={`${quickFilterButtonBaseClass} ${
            requestMissingEstimateFilter
              ? 'border-amber-300 bg-amber-100 text-amber-800'
              : 'border-[var(--ui-border)] bg-white text-[color:var(--ui-text-muted)] hover:bg-slate-50'
          }`}
        >
          Thiếu est
          <span className="rounded-full bg-white/70 px-1.5 text-[10px]">
            {isDashboardLoading ? '...' : alertCounts.missing_estimate.toLocaleString('vi-VN')}
          </span>
        </button>
        <button
          type="button"
          aria-pressed={requestOverEstimateFilter}
          onClick={onToggleOverEstimate}
          className={`${quickFilterButtonBaseClass} ${
            requestOverEstimateFilter
              ? 'border-rose-300 bg-rose-100 text-rose-800'
              : 'border-[var(--ui-border)] bg-white text-[color:var(--ui-text-muted)] hover:bg-slate-50'
          }`}
        >
          Vượt est
          <span className="rounded-full bg-white/70 px-1.5 text-[10px]">
            {isDashboardLoading ? '...' : alertCounts.over_estimate.toLocaleString('vi-VN')}
          </span>
        </button>
        <button
          type="button"
          aria-pressed={requestSlaRiskFilter}
          onClick={onToggleSlaRisk}
          className={`${quickFilterButtonBaseClass} ${
            requestSlaRiskFilter
              ? 'border-sky-300 bg-sky-100 text-sky-800'
              : 'border-[var(--ui-border)] bg-white text-[color:var(--ui-text-muted)] hover:bg-slate-50'
          }`}
        >
          SLA risk
          <span className="rounded-full bg-white/70 px-1.5 text-[10px]">
            {isDashboardLoading ? '...' : alertCounts.sla_risk.toLocaleString('vi-VN')}
          </span>
        </button>
      </div>

      <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5">
        <div className="relative">
          <button
            type="button"
            aria-expanded={showColumnMenu}
            onClick={() => setShowColumnMenu((value) => !value)}
            className={`${toolbarButtonClass} gap-1.5 bg-white px-2.5`}
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">view_column</span>
            <span>Cột</span>
            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">expand_more</span>
          </button>
          {showColumnMenu ? (
            <div className="absolute right-0 top-[calc(100%+6px)] z-[70] w-[300px] rounded-[var(--ui-shell-radius)] border border-[var(--ui-border)] bg-white p-2 shadow-xl">
              <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--ui-text-subtle)]">
                Cột hiển thị
              </p>
              <div className="max-h-64 overflow-y-auto pr-1">
                {columnOptions.map((option) => {
                  const isLocked = option.key === 'code' || option.key === 'title';
                  const isChecked = isLocked || visibleColumns.has(option.key);
                  return (
                    <label
                      key={option.key}
                      className={`flex items-center gap-2 rounded-[var(--ui-control-radius)] px-2 py-1.5 text-xs font-semibold ${
                        isLocked ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isLocked}
                        onChange={() => handleToggleListColumn(option.key)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary/20"
                      />
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {isLocked ? <span className="text-[10px] text-slate-400">bắt buộc</span> : null}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

      </div>
    </div>
  );

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

                  {desktopListControlsNode}

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

      {!showFilterToolbar && showTable && !isMobile ? (
        <div className="shrink-0 rounded-[var(--ui-shell-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] p-2 shadow-[var(--ui-shadow-shell)]">
          {desktopListControlsNode}
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
                <table className={`${tableMinWidthClass} w-full table-fixed text-sm`}>
                  <colgroup>
                    <col className="w-[52px]" />
                    {tableColumns.map((column) => (
                      <col key={column.key} className={column.widthClass} />
                    ))}
                  </colgroup>
                  <thead className="sticky top-0 z-10 border-b border-slate-100 bg-gradient-to-r from-slate-50/95 to-slate-100/90 backdrop-blur-sm">
                    <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="px-2 py-2 text-center">
                        <span
                          aria-hidden="true"
                          className="mx-auto inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-300"
                        >
                          <span className="material-symbols-outlined text-[16px]">star_outline</span>
                        </span>
                      </th>
                      {tableColumns.map((column) => (
                        <th key={column.key} className="px-3 py-2">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {isListLoading ? (
                      <tr>
                        <td colSpan={tableColumnCount} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <span className="material-symbols-outlined animate-spin text-[32px] text-slate-300">progress_activity</span>
                            <p className="text-sm font-medium text-slate-500">Đang tải danh sách yêu cầu...</p>
                          </div>
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={tableColumnCount} className="px-4 py-12 text-center">
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
                          viewPreset={listViewPreset}
                          visibleColumns={visibleColumns}
                          requestRoleFilter={requestRoleFilter}
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
