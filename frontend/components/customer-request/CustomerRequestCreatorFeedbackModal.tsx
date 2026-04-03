import React, { useEffect, useMemo, useState } from 'react';
import { fetchWorklogActivityTypes } from '../../services/api/supportConfigApi';
import type { WorklogActivityTypeOption } from '../../types/support';
import type { Attachment } from '../../types/customerRequest';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';
import { formatCurrentDateTimeForInput, normalizeText } from './helpers';
import type { It360TaskFormRow, ReferenceTaskFormRow } from './presentation';

export type CreatorFeedbackDecision = 'continue_processing' | 'request_more_info' | 'reject_request';

export type CreatorFeedbackReviewSubmission = {
  decision: CreatorFeedbackDecision;
  note: string;
  feedbackRequestContent: string;
  customerDueAt: string;
  rejectReason: string;
  worklog: {
    activityTypeCode: string;
    hoursSpent: string;
    workDate: string;
    workContent: string;
    isBillable: boolean;
  } | null;
};

type CustomerRequestCreatorFeedbackModalProps = {
  open: boolean;
  isSubmitting: boolean;
  requestCode?: string | null;
  requestSummary?: string | null;
  lastFeedbackRequestContent?: string | null;
  lastFeedbackRequestedAt?: string | null;
  customerDueAt?: string | null;
  customerFeedbackAt?: string | null;
  customerFeedbackContent?: string | null;
  canContinueProcessing: boolean;
  canRequestMoreInfo: boolean;
  canRejectRequest: boolean;
  onClose: () => void;
  onSubmit: (payload: CreatorFeedbackReviewSubmission) => void;
  /** Ngữ cảnh đã có trên yêu cầu — read-only, tham chiếu khi đánh giá */
  caseContextAttachments?: Attachment[];
  caseContextIt360Tasks?: It360TaskFormRow[];
  caseContextReferenceTasks?: ReferenceTaskFormRow[];
};

type DecisionOption = {
  value: CreatorFeedbackDecision;
  label: string;
  description: string;
  accentCls: string;
};

const resolveDefaultDecision = (
  canContinueProcessing: boolean,
  canRequestMoreInfo: boolean,
  canRejectRequest: boolean
): CreatorFeedbackDecision | '' => {
  if (canContinueProcessing) {
    return 'continue_processing';
  }
  if (canRequestMoreInfo) {
    return 'request_more_info';
  }
  if (canRejectRequest) {
    return 'reject_request';
  }

  return '';
};

const todayForDateInput = (): string => formatCurrentDateTimeForInput().slice(0, 10);

export const CustomerRequestCreatorFeedbackModal: React.FC<CustomerRequestCreatorFeedbackModalProps> = ({
  open,
  isSubmitting,
  requestCode,
  requestSummary,
  lastFeedbackRequestContent,
  lastFeedbackRequestedAt,
  customerDueAt,
  customerFeedbackAt,
  customerFeedbackContent,
  canContinueProcessing,
  canRequestMoreInfo,
  canRejectRequest,
  onClose,
  onSubmit,
  caseContextAttachments,
  caseContextIt360Tasks,
  caseContextReferenceTasks,
}) => {
  const [decision, setDecision] = useState<CreatorFeedbackDecision | ''>('');
  const [note, setNote] = useState('');
  const [feedbackRequestContent, setFeedbackRequestContent] = useState('');
  const [nextCustomerDueAt, setNextCustomerDueAt] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [worklogContent, setWorklogContent] = useState('');
  const [worklogHoursSpent, setWorklogHoursSpent] = useState('');
  const [worklogDate, setWorklogDate] = useState(todayForDateInput());
  const [worklogActivityTypeCode, setWorklogActivityTypeCode] = useState('');
  const [worklogIsBillable, setWorklogIsBillable] = useState(true);
  const [activityTypes, setActivityTypes] = useState<WorklogActivityTypeOption[]>([]);
  const [isActivityTypesLoading, setIsActivityTypesLoading] = useState(false);
  const [activityTypesError, setActivityTypesError] = useState('');
  const [validationMessage, setValidationMessage] = useState('');

  const decisionOptions = useMemo<DecisionOption[]>(
    () =>
      [
        canContinueProcessing
          ? {
              value: 'continue_processing',
              label: 'Đủ thông tin',
              description: 'Chuyển yêu cầu sang bước xử lý để tiếp tục thực hiện.',
              accentCls: 'border-emerald-200 bg-emerald-50 text-emerald-700',
            }
          : null,
        canRequestMoreInfo
          ? {
              value: 'request_more_info',
              label: 'Yêu cầu KH bổ sung',
              description: 'Giữ ở trạng thái chờ phản hồi và gửi lại nội dung cần khách hàng cung cấp.',
              accentCls: 'border-amber-200 bg-amber-50 text-amber-800',
            }
          : null,
        canRejectRequest
          ? {
              value: 'reject_request',
              label: 'Không thực hiện',
              description: 'Đóng yêu cầu với lý do không thực hiện.',
              accentCls: 'border-rose-200 bg-rose-50 text-rose-700',
            }
          : null,
      ].filter((item): item is DecisionOption => item !== null),
    [canContinueProcessing, canRejectRequest, canRequestMoreInfo]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setDecision(resolveDefaultDecision(canContinueProcessing, canRequestMoreInfo, canRejectRequest));
    setNote('');
    setFeedbackRequestContent(normalizeText(lastFeedbackRequestContent));
    setNextCustomerDueAt('');
    setRejectReason('');
    setWorklogContent('');
    setWorklogHoursSpent('');
    setWorklogDate(todayForDateInput());
    setWorklogActivityTypeCode('');
    setWorklogIsBillable(true);
    setValidationMessage('');
  }, [
    open,
    canContinueProcessing,
    canRejectRequest,
    canRequestMoreInfo,
    lastFeedbackRequestContent,
    requestCode,
  ]);

  useEffect(() => {
    if (!open || activityTypes.length > 0) {
      return;
    }

    let cancelled = false;
    setIsActivityTypesLoading(true);
    setActivityTypesError('');

    void fetchWorklogActivityTypes(false)
      .then((rows) => {
        if (cancelled) {
          return;
        }
        setActivityTypes(Array.isArray(rows) ? rows : []);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setActivityTypesError(error instanceof Error ? error.message : 'Không thể tải danh mục activity worklog.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsActivityTypesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activityTypes.length, open]);

  if (!open) {
    return null;
  }

  const hasAnyWorklogInput = Boolean(
    normalizeText(worklogContent)
      || normalizeText(worklogHoursSpent)
      || normalizeText(worklogActivityTypeCode)
  );

  const handleSubmit = () => {
    if (!decision) {
      setValidationMessage('Chọn một kết quả đánh giá trước khi lưu.');
      return;
    }

    if (decision === 'request_more_info' && normalizeText(feedbackRequestContent) === '') {
      setValidationMessage('Nhập nội dung cần khách hàng bổ sung.');
      return;
    }

    if (decision === 'reject_request' && normalizeText(rejectReason) === '') {
      setValidationMessage('Nhập lý do không thực hiện.');
      return;
    }

    if (hasAnyWorklogInput) {
      const numericHours = Number(worklogHoursSpent);
      if (normalizeText(worklogContent) === '') {
        setValidationMessage('Nếu ghi worklog trong popup này, cần nhập nội dung worklog.');
        return;
      }
      if (normalizeText(worklogHoursSpent) !== '' && (!Number.isFinite(numericHours) || numericHours <= 0)) {
        setValidationMessage('Giờ công phải là số lớn hơn 0.');
        return;
      }
    }

    setValidationMessage('');
    onSubmit({
      decision,
      note: note.trim(),
      feedbackRequestContent: feedbackRequestContent.trim(),
      customerDueAt: nextCustomerDueAt.trim(),
      rejectReason: rejectReason.trim(),
      worklog: hasAnyWorklogInput
        ? {
            activityTypeCode: worklogActivityTypeCode.trim(),
            hoursSpent: worklogHoursSpent.trim(),
            workDate: worklogDate.trim(),
            workContent: worklogContent.trim(),
            isBillable: worklogIsBillable,
          }
        : null,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-600">Popup đánh giá khách hàng</p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">
                {requestCode ? `${requestCode} · ` : ''}Đánh giá phản hồi khách hàng
              </h3>
              {requestSummary ? <p className="mt-1 text-sm text-slate-500">{requestSummary}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        <div className="grid flex-1 gap-0 overflow-hidden xl:grid-cols-[minmax(0,1.1fr)_360px]">
          <div className="space-y-6 overflow-y-auto px-6 py-5">
            <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">KH phản hồi lúc</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDateTimeDdMmYyyy(customerFeedbackAt || null) || '--'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Đã yêu cầu lúc</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDateTimeDdMmYyyy(lastFeedbackRequestedAt || null) || '--'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Hạn phản hồi</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDateTimeDdMmYyyy(customerDueAt || null) || '--'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Nội dung yêu cầu phản hồi gần nhất</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {normalizeText(lastFeedbackRequestContent) || 'Chưa có nội dung yêu cầu phản hồi được lưu.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Nội dung khách hàng phản hồi</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {normalizeText(customerFeedbackContent) || 'Khách hàng chưa phản hồi nội dung chi tiết.'}
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Kết quả đánh giá</h4>
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                {decisionOptions.map((option) => {
                  const active = decision === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`cursor-pointer rounded-2xl border px-4 py-4 transition ${
                        active ? option.accentCls : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="creator-feedback-decision"
                          value={option.value}
                          checked={active}
                          disabled={isSubmitting}
                          onChange={() => setDecision(option.value)}
                          className="mt-1 h-4 w-4 border-slate-300 text-primary focus:ring-primary"
                        />
                        <div>
                          <p className="text-sm font-bold">{option.label}</p>
                          <p className="mt-1 text-xs leading-5 opacity-90">{option.description}</p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>

            {decision === 'request_more_info' ? (
              <section className="space-y-4 rounded-3xl border border-amber-200 bg-amber-50/70 p-5">
                <div>
                  <label htmlFor="creator-feedback-request-content" className="mb-2 block text-sm font-semibold text-slate-700">
                    Nội dung cần khách hàng bổ sung
                  </label>
                  <textarea
                    id="creator-feedback-request-content"
                    rows={5}
                    value={feedbackRequestContent}
                    onChange={(event) => setFeedbackRequestContent(event.target.value)}
                    disabled={isSubmitting}
                    placeholder="Mô tả rõ phần thông tin còn thiếu hoặc nội dung cần khách hàng xác nhận thêm."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label htmlFor="creator-feedback-due-at" className="mb-2 block text-sm font-semibold text-slate-700">
                    Hạn khách hàng phản hồi mới
                  </label>
                  <input
                    id="creator-feedback-due-at"
                    type="datetime-local"
                    value={nextCustomerDueAt}
                    onChange={(event) => setNextCustomerDueAt(event.target.value)}
                    disabled={isSubmitting}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                  />
                </div>
              </section>
            ) : null}

            {decision === 'reject_request' ? (
              <section className="space-y-4 rounded-3xl border border-rose-200 bg-rose-50/70 p-5">
                <div>
                  <label htmlFor="creator-feedback-reject-reason" className="mb-2 block text-sm font-semibold text-slate-700">
                    Lý do không thực hiện
                  </label>
                  <textarea
                    id="creator-feedback-reject-reason"
                    rows={4}
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    disabled={isSubmitting}
                    placeholder="Nêu rõ lý do từ chối hoặc điều kiện khiến yêu cầu không thể thực hiện."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                  />
                </div>
              </section>
            ) : null}

            <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Worklog ngay trên popup</h4>
                <p className="mt-1 text-sm text-slate-500">
                  Có thể bỏ trống nếu chưa muốn ghi worklog ở bước này. Chỉ khi nhập nội dung/giờ công/activity thì hệ thống mới lưu worklog.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="creator-feedback-activity" className="mb-2 block text-sm font-semibold text-slate-700">
                    Activity
                  </label>
                  <select
                    id="creator-feedback-activity"
                    value={worklogActivityTypeCode}
                    onChange={(event) => setWorklogActivityTypeCode(event.target.value)}
                    disabled={isSubmitting || isActivityTypesLoading}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                  >
                    <option value="">Chọn activity</option>
                    {activityTypes.map((item) => (
                      <option key={item.id} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {activityTypesError ? <p className="mt-1 text-xs text-rose-600">{activityTypesError}</p> : null}
                </div>
                <div>
                  <label htmlFor="creator-feedback-hours-spent" className="mb-2 block text-sm font-semibold text-slate-700">
                    Giờ công
                  </label>
                  <input
                    id="creator-feedback-hours-spent"
                    type="number"
                    min="0"
                    step="0.25"
                    value={worklogHoursSpent}
                    onChange={(event) => setWorklogHoursSpent(event.target.value)}
                    disabled={isSubmitting}
                    placeholder="VD: 0.5"
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label htmlFor="creator-feedback-work-date" className="mb-2 block text-sm font-semibold text-slate-700">
                    Ngày làm việc
                  </label>
                  <input
                    id="creator-feedback-work-date"
                    type="date"
                    value={worklogDate}
                    onChange={(event) => setWorklogDate(event.target.value)}
                    disabled={isSubmitting}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                  />
                </div>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={worklogIsBillable}
                    onChange={(event) => setWorklogIsBillable(event.target.checked)}
                    disabled={isSubmitting}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-semibold text-slate-700">Tính giờ billable</span>
                </label>
              </div>

              <div>
                <label htmlFor="creator-feedback-worklog-content" className="mb-2 block text-sm font-semibold text-slate-700">
                  Nội dung worklog
                </label>
                <textarea
                  id="creator-feedback-worklog-content"
                  rows={4}
                  value={worklogContent}
                  onChange={(event) => setWorklogContent(event.target.value)}
                  disabled={isSubmitting}
                  placeholder="VD: Đọc phản hồi khách hàng, phân loại thiếu dữ liệu, cập nhật hướng xử lý."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                />
              </div>
            </section>
          </div>

          <aside className="border-l border-slate-100 bg-slate-50/80 px-5 py-5">
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Ghi chú đánh giá</p>
                <textarea
                  aria-label="Ghi chú đánh giá"
                  rows={7}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={isSubmitting}
                  placeholder="Ghi nhận nhận định ngắn gọn của creator để người xử lý theo dõi tiếp."
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Tác động sau khi lưu</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <li>Đủ thông tin: chuyển sang bước xử lý.</li>
                  <li>Yêu cầu KH bổ sung: giữ ở trạng thái chờ phản hồi và cập nhật yêu cầu mới.</li>
                  <li>Không thực hiện: đóng ca với lý do rõ ràng.</li>
                </ul>
              </div>

              {/* ── Ngữ cảnh file/task đã có trên yêu cầu ────── */}
              {((caseContextAttachments && caseContextAttachments.length > 0) ||
                (caseContextIt360Tasks && caseContextIt360Tasks.filter((t) => t.task_code.trim()).length > 0) ||
                (caseContextReferenceTasks && caseContextReferenceTasks.filter((t) => t.task_code.trim() || t.id != null).length > 0)) ? (
                <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
                  <div className="mb-3 flex items-center gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">File &amp; Task đã có</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      Read-only
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    {caseContextAttachments && caseContextAttachments.length > 0 ? (
                      <div>
                        <p className="mb-1 flex items-center gap-1 font-semibold text-slate-500">
                          <span className="material-symbols-outlined text-[13px]">attach_file</span>
                          File ({caseContextAttachments.length})
                        </p>
                        <div className="space-y-1 pl-4">
                          {caseContextAttachments.map((a) => (
                            <div key={a.id} className="truncate text-slate-700">{a.fileName || `File #${a.id}`}</div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {caseContextIt360Tasks && caseContextIt360Tasks.filter((t) => t.task_code.trim()).length > 0 ? (
                      <div>
                        <p className="mb-1 flex items-center gap-1 font-semibold text-slate-500">
                          <span className="material-symbols-outlined text-[13px]">task_alt</span>
                          IT360 ({caseContextIt360Tasks.filter((t) => t.task_code.trim()).length})
                        </p>
                        <div className="space-y-1 pl-4">
                          {caseContextIt360Tasks.filter((t) => t.task_code.trim()).map((t) => (
                            <div key={t.local_id} className="font-mono text-slate-700">{t.task_code}</div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {caseContextReferenceTasks && caseContextReferenceTasks.filter((t) => t.task_code.trim() || t.id != null).length > 0 ? (
                      <div>
                        <p className="mb-1 flex items-center gap-1 font-semibold text-slate-500">
                          <span className="material-symbols-outlined text-[13px]">link</span>
                          Tham chiếu ({caseContextReferenceTasks.filter((t) => t.task_code.trim() || t.id != null).length})
                        </p>
                        <div className="space-y-1 pl-4">
                          {caseContextReferenceTasks.filter((t) => t.task_code.trim() || t.id != null).map((t) => (
                            <div key={t.local_id} className="text-slate-700">{t.task_code || `#${String(t.id)}`}</div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {validationMessage ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {validationMessage}
                </div>
              ) : null}

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || decisionOptions.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                  {isSubmitting ? 'Đang lưu đánh giá...' : 'Lưu đánh giá KH'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Đóng
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
