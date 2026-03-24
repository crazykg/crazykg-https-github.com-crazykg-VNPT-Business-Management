import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchWorklogActivityTypes } from '../../services/v5Api';
import type { WorklogActivityTypeOption, YeuCauHoursReport } from '../../types';
import { formatCurrentDateTimeForInput, normalizeText } from './helpers';
import { formatHoursValue } from './presentation';

export type CustomerRequestWorklogSubmission = {
  work_content: string;
  work_date: string;
  activity_type_code?: string | null;
  hours_spent: string;
  is_billable: boolean;
};

type CustomerRequestWorklogModalProps = {
  open: boolean;
  isSubmitting: boolean;
  requestCode?: string | null;
  requestSummary?: string | null;
  hoursReport?: YeuCauHoursReport | null;
  onClose: () => void;
  onSubmit: (payload: CustomerRequestWorklogSubmission) => void;
};

const todayForDateInput = (): string => formatCurrentDateTimeForInput().slice(0, 10);

export const CustomerRequestWorklogModal: React.FC<CustomerRequestWorklogModalProps> = ({
  open,
  isSubmitting,
  requestCode,
  requestSummary,
  hoursReport,
  onClose,
  onSubmit,
}) => {
  const [workContent, setWorkContent] = useState('');
  const [workDate, setWorkDate] = useState(todayForDateInput());
  const [activityTypeCode, setActivityTypeCode] = useState('');
  const [hoursSpent, setHoursSpent] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [activityTypes, setActivityTypes] = useState<WorklogActivityTypeOption[]>([]);
  const [isActivityTypesLoading, setIsActivityTypesLoading] = useState(false);
  const [activityTypesError, setActivityTypesError] = useState('');
  const [validationMessage, setValidationMessage] = useState('');

  const summaryCaption = useMemo(() => {
    if (!hoursReport) {
      return '--';
    }

    const total = formatHoursValue(hoursReport.total_hours_spent);
    const estimated = hoursReport.estimated_hours == null ? '--' : formatHoursValue(hoursReport.estimated_hours);
    const remaining = hoursReport.remaining_hours == null ? '--' : formatHoursValue(hoursReport.remaining_hours);
    return `${total} đã dùng / ${estimated} ước lượng / còn ${remaining}`;
  }, [hoursReport]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setWorkContent('');
    setWorkDate(todayForDateInput());
    setActivityTypeCode('');
    setHoursSpent('');
    setIsBillable(true);
    setValidationMessage('');
  }, [open, requestCode]);

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
          setActivityTypesError(error instanceof Error ? error.message : 'Không thể tải activity worklog.');
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

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const selectedActivity = activityTypes.find((item) => item.code === activityTypeCode);

  const handleSubmit = () => {
    if (normalizeText(workContent) === '') {
      setValidationMessage('Nhập nội dung công việc.');
      return;
    }

    const numericHours = Number(hoursSpent);
    if (!Number.isFinite(numericHours) || numericHours <= 0) {
      setValidationMessage('Giờ công phải là số lớn hơn 0.');
      return;
    }

    setValidationMessage('');
    onSubmit({
      work_content: workContent.trim(),
      work_date: workDate.trim(),
      activity_type_code: activityTypeCode.trim() || null,
      hours_spent: hoursSpent.trim(),
      is_billable: isBillable,
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Giờ công</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Ghi giờ công</h3>
            <p className="mt-1 text-sm text-slate-500">
              {requestCode ? `${requestCode} · ` : ''}
              {requestSummary || 'Yêu cầu hiện tại'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Tóm tắt giờ công</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{summaryCaption}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-[160px_180px_minmax(0,1fr)]">
            <div>
              <label htmlFor="crc-worklog-hours" className="mb-1.5 block text-sm font-semibold text-slate-700">Giờ công</label>
              <input
                id="crc-worklog-hours"
                type="number"
                min="0.25"
                step="0.25"
                value={hoursSpent}
                onChange={(event) => setHoursSpent(event.target.value)}
                disabled={isSubmitting}
                placeholder="1.0"
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label htmlFor="crc-worklog-date" className="mb-1.5 block text-sm font-semibold text-slate-700">Ngày làm việc</label>
              <input
                id="crc-worklog-date"
                type="date"
                value={workDate}
                onChange={(event) => setWorkDate(event.target.value)}
                disabled={isSubmitting}
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label htmlFor="crc-worklog-activity" className="mb-1.5 block text-sm font-semibold text-slate-700">Activity</label>
              <select
                id="crc-worklog-activity"
                value={activityTypeCode}
                onChange={(event) => {
                  const nextCode = event.target.value;
                  setActivityTypeCode(nextCode);
                  const nextActivity = activityTypes.find((item) => item.code === nextCode);
                  if (nextActivity) {
                    setIsBillable(Boolean(nextActivity.default_is_billable));
                  }
                }}
                disabled={isSubmitting || isActivityTypesLoading}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-slate-50"
              >
                <option value="">{isActivityTypesLoading ? 'Đang tải activity...' : 'Chọn activity (tuỳ chọn)'}</option>
                {activityTypes.map((item) => (
                  <option key={item.id} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
              {activityTypesError ? <p className="mt-1 text-xs text-rose-600">{activityTypesError}</p> : null}
            </div>
          </div>

          <div>
            <label htmlFor="crc-worklog-content" className="mb-1.5 block text-sm font-semibold text-slate-700">Nội dung công việc</label>
            <textarea
              id="crc-worklog-content"
              rows={5}
              value={workContent}
              onChange={(event) => setWorkContent(event.target.value)}
              disabled={isSubmitting}
              placeholder="Mô tả ngắn gọn phần việc đã thực hiện."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-slate-50"
            />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              checked={isBillable}
              onChange={(event) => setIsBillable(event.target.checked)}
              disabled={isSubmitting}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span className="text-sm font-semibold text-slate-700">
              Tính giờ billable
              {selectedActivity ? ` · ${selectedActivity.name}` : ''}
            </span>
          </label>

          {validationMessage ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {validationMessage}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">
              {isSubmitting ? 'progress_activity' : 'history'}
            </span>
            Lưu giờ công
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
