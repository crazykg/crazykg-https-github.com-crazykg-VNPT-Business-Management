import React from 'react';
import { createPortal } from 'react-dom';
import { resolveStatusMeta, STATUS_COLOR_MAP } from './presentation';

type CustomerRequestPmMissingInfoDecisionModalProps = {
  show: boolean;
  currentStatusCode?: string | null;
  currentStatusLabel?: string | null;
  isBusy?: boolean;
  onClose: () => void;
  onChooseWaitingCustomerFeedback: () => void;
  onChooseNotExecuted: () => void;
};

export const CustomerRequestPmMissingInfoDecisionModal: React.FC<
  CustomerRequestPmMissingInfoDecisionModalProps
> = ({
  show,
  currentStatusCode,
  currentStatusLabel,
  isBusy = false,
  onClose,
  onChooseWaitingCustomerFeedback,
  onChooseNotExecuted,
}) => {
  if (!show || typeof document === 'undefined') {
    return null;
  }

  const currentStatusMeta = resolveStatusMeta(currentStatusCode, currentStatusLabel);
  const waitingMeta = STATUS_COLOR_MAP.waiting_customer_feedback;
  const rejectMeta = STATUS_COLOR_MAP.not_executed;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="PM đánh giá thiếu thông tin khách hàng"
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isBusy) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              PM Đánh Giá Thiếu Thông Tin KH
            </div>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">
              Chọn đúng nhánh theo XML mới
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${currentStatusMeta.cls}`}>
            {currentStatusMeta.label}
          </span>
          <span className="material-symbols-outlined text-[18px] text-slate-400">arrow_forward</span>
          <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">
            PM đánh giá thiếu TT KH
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-600">
          XML hiện có hai điểm PM cùng một ý nghĩa nghiệp vụ: xác nhận yêu cầu đang kẹt vì khách
          hàng thiếu thông tin hay vì lý do khác. Chọn đúng nhánh bên dưới để mở form trạng thái
          tương ứng.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={onChooseWaitingCustomerFeedback}
            disabled={isBusy}
            className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 text-left transition hover:border-yellow-300 hover:bg-yellow-100 disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${waitingMeta.cls}`}>
                {waitingMeta.label}
              </span>
            </div>
            <div className="mt-3 text-base font-semibold text-slate-900">
              Có, khách hàng đang thiếu thông tin
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Đi sang nhánh chờ khách hàng bổ sung thông tin và mở form yêu cầu phản hồi.
            </p>
          </button>

          <button
            type="button"
            onClick={onChooseNotExecuted}
            disabled={isBusy}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${rejectMeta.cls}`}>
                {rejectMeta.label}
              </span>
            </div>
            <div className="mt-3 text-base font-semibold text-slate-900">
              Không, lý do khác
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Đi sang nhánh không thực hiện và mở form xác nhận lý do không tiếp nhận.
            </p>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
