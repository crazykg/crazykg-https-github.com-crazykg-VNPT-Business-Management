import React from 'react';
import type { YeuCau, YeuCauDashboardPayload } from '../../types';
import { CustomerRequestAttentionCard } from './CustomerRequestAttentionCard';
import { CustomerRequestWorkspaceCaseList } from './CustomerRequestWorkspaceCaseList';

type CustomerRequestCreatorWorkspaceProps = {
  loading: boolean;
  creatorName?: string | null;
  totalRows: number;
  reviewRows: YeuCau[];
  notifyRows: YeuCau[];
  followUpRows: YeuCau[];
  closedRows: YeuCau[];
  dashboard: YeuCauDashboardPayload | null;
  onOpenRequest: (requestId: string | number, statusCode?: string | null) => void;
  onCreateRequest: () => void;
};

export const CustomerRequestCreatorWorkspace: React.FC<CustomerRequestCreatorWorkspaceProps> = ({
  loading,
  creatorName,
  totalRows,
  reviewRows,
  notifyRows,
  followUpRows,
  closedRows,
  dashboard,
  onOpenRequest,
  onCreateRequest,
}) => {
  return (
    <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-5">
      <div className="flex flex-col gap-3 border-b border-sky-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="mt-1 text-xl font-black text-slate-900">
            {creatorName ? `${creatorName} · ` : ''}{totalRows} yêu cầu do bạn tạo
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {loading ? <span className="text-xs text-slate-400">Đang cập nhật khu vực người tạo...</span> : null}
          <button
            type="button"
            onClick={onCreateRequest}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            Tạo YC mới
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MetricCard label="Chờ đánh giá KH" value={reviewRows.length} tone="bg-white" />
        <MetricCard label="Chờ báo KH" value={notifyRows.length} tone="bg-white" />
        <MetricCard label="Cần theo dõi" value={followUpRows.length} tone="bg-white" />
        <MetricCard label="Đã đóng gần đây" value={closedRows.length} tone="bg-white" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="grid gap-4 lg:grid-cols-3">
          <CustomerRequestWorkspaceCaseList
            title="KH đã phản hồi"
            subtitle="Các ca đang chờ người tạo đánh giá phản hồi để tiếp tục xử lý."
            rows={reviewRows.slice(0, 6)}
            emptyText="Chưa có yêu cầu nào đang chờ đánh giá phản hồi KH."
            onOpenRequest={onOpenRequest}
            requestRoleFilter="creator"
            hoverToneCls="hover:border-sky-200 hover:bg-sky-50/40"
          />
          <CustomerRequestWorkspaceCaseList
            title="Chờ báo khách hàng"
            subtitle="Các yêu cầu đã hoàn thành nghiệp vụ nhưng chưa khép vòng thông báo."
            rows={notifyRows.slice(0, 6)}
            emptyText="Không có yêu cầu nào đang chờ báo khách hàng."
            onOpenRequest={onOpenRequest}
            requestRoleFilter="creator"
            hoverToneCls="hover:border-sky-200 hover:bg-sky-50/40"
          />
          <CustomerRequestWorkspaceCaseList
            title="YC mới tạo cần theo dõi"
            subtitle="Các ca mới tạo hoặc đang chạy cần người tạo bám tình hình tiếp."
            rows={followUpRows.slice(0, 6)}
            emptyText="Không có yêu cầu mới nào cần theo dõi thêm."
            onOpenRequest={onOpenRequest}
            requestRoleFilter="creator"
            hoverToneCls="hover:border-sky-200 hover:bg-sky-50/40"
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">Cần hành động</p>
                <p className="mt-1 text-xs text-slate-500">Tổng hợp từ dashboard creator để mở nhanh đúng ca cần chú ý.</p>
              </div>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                {dashboard?.attention_cases.length ?? 0} ca
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {(dashboard?.attention_cases ?? []).slice(0, 5).map((item) => {
                const requestCase = item.request_case;

                return (
                  <CustomerRequestAttentionCard
                    key={String(requestCase.id)}
                    request={requestCase}
                    reasons={item.reasons}
                    onOpenRequest={onOpenRequest}
                    requestRoleFilter="creator"
                    layout="stacked"
                    hoverToneCls="hover:border-sky-200 hover:bg-sky-50/40"
                  />
                );
              })}
              {(dashboard?.attention_cases ?? []).length === 0 ? (
                <EmptySmallState message="Hiện chưa có yêu cầu nào do bạn tạo cần hành động ngay." />
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-900">Top khách hàng của tôi</p>
            <div className="mt-4 space-y-2">
              {(dashboard?.top_customers ?? []).slice(0, 5).map((customer) => (
                <div
                  key={`${customer.customer_id}-${customer.customer_name ?? ''}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
                >
                  <span className="text-sm font-semibold text-slate-800">{customer.customer_name || 'Chưa xác định'}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700">{customer.count}</span>
                </div>
              ))}
              {(dashboard?.top_customers ?? []).length === 0 ? (
                <EmptySmallState message="Chưa có dữ liệu khách hàng nổi bật trong nhóm YC bạn tạo." />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  tone: string;
}> = ({ label, value, tone }) => (
  <div className={`rounded-2xl border border-slate-100 px-3 py-3 ${tone}`}>
    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
    <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
  </div>
);

const EmptySmallState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
    {message}
  </div>
);
