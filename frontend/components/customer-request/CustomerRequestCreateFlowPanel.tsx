import React, { useMemo } from 'react';
import type { Employee } from '../../types/employee';
import type { ProjectItemMaster } from '../../types/project';
import { SearchableSelect } from '../SearchableSelect';
import type { CustomerRequestCreateFlowDraft, CreateRequestHandlingMode } from './createFlow';
import {
  customerRequestFieldClass,
  customerRequestFieldLabelClass,
  customerRequestSelectTriggerClass,
} from './uiClasses';

type CustomerRequestCreateFlowPanelProps = {
  draft: CustomerRequestCreateFlowDraft;
  employees: Employee[];
  currentUserName: string;
  selectedProjectItem: ProjectItemMaster | null;
  selectedCustomerName: string;
  onChange: (patch: Partial<CustomerRequestCreateFlowDraft>) => void;
  disabled: boolean;
  /**
   * `modal`  — compact single-column layout for use inside a narrow modal or sidebar.
   *             No viewport breakpoints; container owns all layout.
   * `detail` — full responsive layout for detail pane (default).
   */
  layoutVariant?: 'modal' | 'detail';
};

const handlingModeMeta: Array<{
  value: CreateRequestHandlingMode;
  title: string;
  description: string;
  descriptionCompact: string;
  accentCls: string;
}> = [
  // Chi map decision node dau tien trong XML vao create form.
  // Cac decision node sau create duoc xu ly o action/modal theo vai tro.
  {
    value: 'self_handle',
    title: 'Tự xử lý',
    description: 'Tạo xong sẽ giao yêu cầu cho R và giữ ở Mới tiếp nhận để R đánh giá khả năng thực hiện.',
    descriptionCompact: 'Giao R, chờ R đánh giá.',
    accentCls: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  },
  {
    value: 'assign_dispatcher',
    title: 'Chuyển PM',
    description: 'Giữ yêu cầu ở Mới tiếp nhận và đưa vào hàng chờ điều phối của PM.',
    descriptionCompact: 'PM điều phối phân công.',
    accentCls: 'border-amber-200 bg-amber-50 text-amber-900',
  },
];

export const CustomerRequestCreateFlowPanel: React.FC<CustomerRequestCreateFlowPanelProps> = ({
  draft,
  employees,
  currentUserName,
  selectedProjectItem,
  selectedCustomerName,
  onChange,
  disabled,
  layoutVariant = 'detail',
}) => {
  const isModal = layoutVariant === 'modal';
  const fieldLabelClass = `mb-1 ${customerRequestFieldLabelClass}`;
  const fieldInputClass = customerRequestFieldClass;

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        value: String(employee.id),
        label: employee.full_name || employee.username,
        searchText: [employee.full_name, employee.user_code, employee.username].filter(Boolean).join(' '),
      })),
    [employees]
  );

  const selectedTargetUserId = draft.handlingMode === 'self_handle' ? draft.performerUserId : draft.dispatcherUserId;
  const selectedTargetUserName =
    employeeOptions.find((option) => String(option.value) === String(selectedTargetUserId || ''))?.label
    || (draft.handlingMode === 'self_handle' ? currentUserName : '')
    || '--';

  const projectSummary = [
    selectedProjectItem?.project_name,
    selectedProjectItem?.product_name,
    selectedProjectItem?.display_name,
  ]
    .filter(Boolean)
    .join(' | ');

  /* ── MODAL VARIANT ──────────────────────────────────────────────── */
  if (isModal) {
    return (
      <div className="flex flex-col gap-4">
        {/* Estimate section — compact, single column */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">Estimate ban đầu</p>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">Tùy chọn</span>
          </div>
          <div className="flex flex-col gap-2.5">
            <div>
              <label className={fieldLabelClass}>Giờ ước lượng</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={draft.initialEstimatedHours}
                  disabled={disabled}
                  onChange={(event) => onChange({ initialEstimatedHours: event.target.value })}
                  className={`${fieldInputClass} pr-12`}
                  placeholder="4.0"
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 inline-flex items-center text-sm font-semibold text-slate-400">
                  giờ
                </span>
              </div>
            </div>
            <div>
              <label className={fieldLabelClass}>Ghi chú ước lượng</label>
              <input
                type="text"
                value={draft.estimateNote}
                disabled={disabled}
                onChange={(event) => onChange({ estimateNote: event.target.value })}
                className={fieldInputClass}
                placeholder="Ghi chú ước lượng ban đầu..."
              />
            </div>
          </div>
        </div>

        {/* Handling mode — compact, always 2 cards side-by-side */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">Hướng xử lý</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Đích: {draft.handlingMode === 'self_handle' ? 'Giao R' : 'Giao PM'}
            </span>
          </div>

          {/* 2 cards — fixed 2 columns, descriptions are short enough */}
          <div className="grid grid-cols-2 gap-2">
            {handlingModeMeta.map((item) => {
              const active = draft.handlingMode === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onChange({ handlingMode: item.value })}
                  disabled={disabled}
                  className={`min-w-0 rounded-2xl border px-3 py-2.5 text-left transition ${
                    active ? item.accentCls : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold">{item.title}</span>
                    <span className="material-symbols-outlined shrink-0 text-[18px]">
                      {active ? 'radio_button_checked' : 'radio_button_unchecked'}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 opacity-90">{item.descriptionCompact}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-3.5">
            {draft.handlingMode === 'self_handle' ? (
              <SearchableSelect
                value={draft.performerUserId}
                options={employeeOptions}
                onChange={(value) => onChange({ performerUserId: value })}
                label="Người xử lý"
                placeholder="Chọn người xử lý"
                searchPlaceholder="Tìm người xử lý..."
                disabled={disabled}
                compact
                denseLabel
                triggerClassName={customerRequestSelectTriggerClass}
              />
            ) : (
              <SearchableSelect
                value={draft.dispatcherUserId}
                options={employeeOptions}
                onChange={(value) => onChange({ dispatcherUserId: value })}
                label="PM điều phối"
                placeholder="Chọn PM điều phối"
                searchPlaceholder="Tìm PM điều phối..."
                disabled={disabled}
                compact
                denseLabel
                triggerClassName={customerRequestSelectTriggerClass}
              />
            )}

            <div className="mt-2.5 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">
                {draft.handlingMode === 'self_handle' ? 'R sẽ đánh giá khả năng thực hiện sau khi mở case.' : 'PM sẽ thấy trong hàng chờ.'}
              </span>
              {' '}Đang chọn:{' '}
              <span className="font-semibold text-slate-900">{selectedTargetUserName}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── DETAIL VARIANT (default) — giữ nguyên responsive layout ───── */
  return (
    <div className="mt-6 border-t border-slate-100 pt-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Khởi tạo xử lý</h4>
          <p className="mt-1 text-sm text-slate-500">
            Bổ sung ước lượng ban đầu và chọn nhánh đầu tiên của luồng ngay khi tạo yêu cầu.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedCustomerName ? (
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              KH: {selectedCustomerName}
            </span>
          ) : null}
          {projectSummary ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {projectSummary}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Ước lượng ban đầu</p>
              <p className="mt-1 text-sm text-slate-500">
                Nếu đã có ước lượng ban đầu, hệ thống sẽ lưu ngay vào lịch sử ước lượng sau khi tạo.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">Tùy chọn</span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
            <div>
              <label className={`mb-1.5 ${customerRequestFieldLabelClass}`}>Giờ ước lượng</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={draft.initialEstimatedHours}
                  disabled={disabled}
                  onChange={(event) => onChange({ initialEstimatedHours: event.target.value })}
                  className={`${customerRequestFieldClass} pr-12`}
                  placeholder="4.0"
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 inline-flex items-center text-sm font-semibold text-slate-400">
                  giờ
                </span>
              </div>
            </div>

            <div>
              <label className={`mb-1.5 ${customerRequestFieldLabelClass}`}>Ghi chú ước lượng</label>
              <input
                type="text"
                value={draft.estimateNote}
                disabled={disabled}
                onChange={(event) => onChange({ estimateNote: event.target.value })}
                className={customerRequestFieldClass}
                placeholder="Ví dụ: Phần import dữ liệu tương đối quen, chưa tính test UAT."
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Hướng xử lý</p>
              <p className="mt-1 text-sm text-slate-500">
                Chọn luồng đi tiếp cho yêu cầu ngay sau khi bấm Tạo yêu cầu.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Đích: {draft.handlingMode === 'self_handle' ? 'Giao R' : 'Giao PM'}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {handlingModeMeta.map((item) => {
              const active = draft.handlingMode === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onChange({ handlingMode: item.value })}
                  disabled={disabled}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    active ? item.accentCls : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold">{item.title}</span>
                    <span className="material-symbols-outlined text-[18px]">
                      {active ? 'radio_button_checked' : 'radio_button_unchecked'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 opacity-90">{item.description}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
            {draft.handlingMode === 'self_handle' ? (
              <SearchableSelect
                value={draft.performerUserId}
                options={employeeOptions}
                onChange={(value) => onChange({ performerUserId: value })}
                label="Người xử lý"
                placeholder="Chọn người xử lý"
                searchPlaceholder="Tìm người xử lý..."
                disabled={disabled}
                compact
                triggerClassName={customerRequestSelectTriggerClass}
              />
            ) : (
              <SearchableSelect
                value={draft.dispatcherUserId}
                options={employeeOptions}
                onChange={(value) => onChange({ dispatcherUserId: value })}
                label="PM điều phối"
                placeholder="Chọn PM điều phối"
                searchPlaceholder="Tìm PM điều phối..."
                disabled={disabled}
                compact
                triggerClassName={customerRequestSelectTriggerClass}
              />
            )}

            <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">
                {draft.handlingMode === 'self_handle' ? 'Người xử lý sẽ nhận ca ngay sau khi tạo.' : 'PM sẽ thấy ca này trong hàng chờ phân công.'}
              </p>
              <p className="mt-1">
                Đang chọn: <span className="font-semibold text-slate-900">{selectedTargetUserName}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
