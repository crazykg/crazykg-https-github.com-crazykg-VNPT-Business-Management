import React, { useEffect, useMemo, useState } from 'react';
import { fetchWorklogActivityTypes, uploadDocumentAttachment } from '../../services/v5Api';
import type { Attachment, WorklogActivityTypeOption, YeuCauHoursReport } from '../../types';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';
import { AttachmentManager } from '../AttachmentManager';
import { formatCurrentDateTimeForInput, normalizeText } from './helpers';
import { formatHoursValue } from './presentation';
import type { It360TaskFormRow, ReferenceTaskFormRow } from './presentation';

export type NotifyCustomerSubmission = {
  notificationChannel: string;
  notificationContent: string;
  customerFeedback: string;
  note: string;
  attachments: Attachment[];
  worklog: {
    activityTypeCode: string;
    hoursSpent: string;
    workDate: string;
    workContent: string;
    isBillable: boolean;
  } | null;
};

type CustomerRequestNotifyCustomerModalProps = {
  open: boolean;
  isSubmitting: boolean;
  requestCode?: string | null;
  requestSummary?: string | null;
  customerName?: string | null;
  requesterName?: string | null;
  completedAt?: string | null;
  resultContent?: string | null;
  hoursReport?: YeuCauHoursReport | null;
  onClose: () => void;
  onSubmit: (payload: NotifyCustomerSubmission) => void;
  /** Ngữ cảnh đã có trên yêu cầu — read-only, tham chiếu khi báo kết quả */
  caseContextAttachments?: Attachment[];
  caseContextIt360Tasks?: It360TaskFormRow[];
  caseContextReferenceTasks?: ReferenceTaskFormRow[];
};

const NOTIFICATION_CHANNEL_OPTIONS = [
  'Điện thoại',
  'Email',
  'Zalo',
  'Teams',
  'Trực tiếp',
  'Khác',
];

const todayForDateInput = (): string => formatCurrentDateTimeForInput().slice(0, 10);

export const CustomerRequestNotifyCustomerModal: React.FC<CustomerRequestNotifyCustomerModalProps> = ({
  open,
  isSubmitting,
  requestCode,
  requestSummary,
  customerName,
  requesterName,
  completedAt,
  resultContent,
  hoursReport,
  onClose,
  onSubmit,
  caseContextAttachments,
  caseContextIt360Tasks,
  caseContextReferenceTasks,
}) => {
  const [notificationChannel, setNotificationChannel] = useState('Điện thoại');
  const [notificationContent, setNotificationContent] = useState('');
  const [customerFeedback, setCustomerFeedback] = useState('');
  const [note, setNote] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [worklogContent, setWorklogContent] = useState('');
  const [worklogHoursSpent, setWorklogHoursSpent] = useState('');
  const [worklogDate, setWorklogDate] = useState(todayForDateInput());
  const [worklogActivityTypeCode, setWorklogActivityTypeCode] = useState('');
  const [worklogIsBillable, setWorklogIsBillable] = useState(true);
  const [activityTypes, setActivityTypes] = useState<WorklogActivityTypeOption[]>([]);
  const [isActivityTypesLoading, setIsActivityTypesLoading] = useState(false);
  const [activityTypesError, setActivityTypesError] = useState('');
  const [validationMessage, setValidationMessage] = useState('');

  const hoursCaption = useMemo(() => {
    if (!hoursReport) {
      return '--';
    }

    const total = formatHoursValue(hoursReport.total_hours_spent);
    const estimated = hoursReport.estimated_hours == null ? '--' : formatHoursValue(hoursReport.estimated_hours);
    const pct = hoursReport.hours_usage_pct == null ? null : `${Math.round(Number(hoursReport.hours_usage_pct))}%`;
    return pct ? `${total} / ${estimated} (${pct})` : `${total} / ${estimated}`;
  }, [hoursReport]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const normalizedResult = normalizeText(resultContent);
    setNotificationChannel('Điện thoại');
    setNotificationContent(
      normalizedResult !== ''
        ? `Yêu cầu đã hoàn tất. Kết quả chính: ${normalizedResult}`
        : 'Yêu cầu đã được xử lý xong. Anh/chị vui lòng kiểm tra giúp.'
    );
    setCustomerFeedback('');
    setNote('');
    setAttachments([]);
    setAttachmentError('');
    setWorklogContent('');
    setWorklogHoursSpent('');
    setWorklogDate(todayForDateInput());
    setWorklogActivityTypeCode('');
    setWorklogIsBillable(true);
    setValidationMessage('');
  }, [open, requestCode, resultContent]);

  useEffect(() => {
    if (!open || activityTypes.length > 0) {
      return;
    }

    let cancelled = false;
    setIsActivityTypesLoading(true);
    setActivityTypesError('');

    void fetchWorklogActivityTypes(false)
      .then((rows) => {
        if (!cancelled) {
          setActivityTypes(Array.isArray(rows) ? rows : []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setActivityTypesError(error instanceof Error ? error.message : 'Không thể tải danh mục activity worklog.');
        }
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

  const handleUploadAttachment = async (file: File) => {
    setIsUploadingAttachment(true);
    setAttachmentError('');
    try {
      const uploaded = await uploadDocumentAttachment(file);
      setAttachments((current) => [...current, uploaded]);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'Không thể tải file lên.');
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleSubmit = () => {
    if (normalizeText(notificationChannel) === '') {
      setValidationMessage('Chọn kênh báo khách hàng.');
      return;
    }

    if (normalizeText(notificationContent) === '') {
      setValidationMessage('Nhập nội dung đã báo cho khách hàng.');
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
      notificationChannel: notificationChannel.trim(),
      notificationContent: notificationContent.trim(),
      customerFeedback: customerFeedback.trim(),
      note: note.trim(),
      attachments,
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
      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Popup báo khách hàng</p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">
                {requestCode ? `${requestCode} · ` : ''}Thông báo kết quả cho khách hàng
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

        <div className="grid flex-1 overflow-hidden xl:grid-cols-[minmax(0,1.15fr)_360px]">
          <div className="space-y-6 overflow-y-auto px-6 py-5">
            <section className="space-y-4 rounded-3xl border border-teal-100 bg-teal-50/50 p-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Khách hàng</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{normalizeText(customerName) || '--'}</p>
                  {normalizeText(requesterName) ? (
                    <p className="mt-1 text-xs text-slate-500">{requesterName}</p>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Kết quả</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-700">Hoàn thành</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateTimeDdMmYyyy(completedAt || null) || 'Chưa ghi thời điểm hoàn thành'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Giờ công</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{hoursCaption}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Kết quả thực hiện</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {normalizeText(resultContent) || 'Chưa có nội dung kết quả được ghi ở bước hoàn thành.'}
                </p>
              </div>
            </section>

            <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="notify-customer-channel" className="mb-2 block text-sm font-semibold text-slate-700">
                    Kênh báo
                  </label>
                  <select
                    id="notify-customer-channel"
                    value={notificationChannel}
                    onChange={(event) => setNotificationChannel(event.target.value)}
                    disabled={isSubmitting}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                  >
                    {NOTIFICATION_CHANNEL_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="notify-customer-feedback" className="mb-2 block text-sm font-semibold text-slate-700">
                    Phản hồi của KH
                  </label>
                  <input
                    id="notify-customer-feedback"
                    type="text"
                    value={customerFeedback}
                    onChange={(event) => setCustomerFeedback(event.target.value)}
                    disabled={isSubmitting}
                    placeholder="Tóm tắt phản hồi ngay sau khi thông báo"
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="notify-customer-content" className="mb-2 block text-sm font-semibold text-slate-700">
                  Nội dung đã báo khách hàng
                </label>
                <textarea
                  id="notify-customer-content"
                  rows={4}
                  value={notificationContent}
                  onChange={(event) => setNotificationContent(event.target.value)}
                  disabled={isSubmitting}
                  placeholder="Ví dụ: YC đã xử lý xong, anh/chị vui lòng kiểm tra lại kết quả và phản hồi nếu cần chỉnh thêm."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">Đính kèm</p>
                <AttachmentManager
                  attachments={attachments}
                  onUpload={handleUploadAttachment}
                  onDelete={async (id) => {
                    setAttachments((current) => current.filter((attachment) => String(attachment.id) !== String(id)));
                  }}
                  isUploading={isUploadingAttachment}
                  disabled={isSubmitting}
                  helperText="File đính kèm sẽ được gắn với bước báo khách hàng sau khi xác nhận."
                  emptyStateDescription="Tải thêm biên bản, email xác nhận hoặc file kết quả đã gửi cho khách hàng."
                  uploadButtonLabel="Tải file đính kèm"
                />
                {attachmentError ? <p className="mt-2 text-xs text-rose-600">{attachmentError}</p> : null}
              </div>
            </section>

            <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Worklog ngay trên popup</h4>
                <p className="mt-1 text-sm text-slate-500">
                  Có thể bỏ trống. Nếu nhập activity/giờ công/nội dung, hệ thống sẽ ghi thêm worklog cho lần báo khách hàng này.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="notify-customer-activity" className="mb-2 block text-sm font-semibold text-slate-700">
                    Activity
                  </label>
                  <select
                    id="notify-customer-activity"
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
                  <label htmlFor="notify-customer-hours-spent" className="mb-2 block text-sm font-semibold text-slate-700">
                    Giờ công
                  </label>
                  <input
                    id="notify-customer-hours-spent"
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
                  <label htmlFor="notify-customer-work-date" className="mb-2 block text-sm font-semibold text-slate-700">
                    Ngày làm việc
                  </label>
                  <input
                    id="notify-customer-work-date"
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
                <label htmlFor="notify-customer-worklog-content" className="mb-2 block text-sm font-semibold text-slate-700">
                  Nội dung worklog
                </label>
                <textarea
                  id="notify-customer-worklog-content"
                  rows={4}
                  value={worklogContent}
                  onChange={(event) => setWorklogContent(event.target.value)}
                  disabled={isSubmitting}
                  placeholder="Ví dụ: Gọi điện thông báo kết quả và hướng dẫn khách hàng kiểm tra lại."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                />
              </div>
            </section>
          </div>

          <aside className="border-l border-slate-100 bg-slate-50/80 px-5 py-5">
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Ghi chú nội bộ</p>
                <textarea
                  aria-label="Ghi chú nội bộ"
                  rows={7}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={isSubmitting}
                  placeholder="Ghi chú ngắn về cách báo, lưu ý sau trao đổi, hoặc hẹn follow-up nếu có."
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Khi xác nhận</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <li>Yêu cầu sẽ chuyển sang trạng thái `Báo khách hàng`.</li>
                  <li>File đính kèm sẽ gắn vào bước này.</li>
                  <li>Nếu có nhập giờ công, hệ thống sẽ ghi thêm worklog.</li>
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
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">campaign</span>
                  {isSubmitting ? 'Đang báo khách hàng...' : 'Xác nhận - Kết thúc YC'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Hủy
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
