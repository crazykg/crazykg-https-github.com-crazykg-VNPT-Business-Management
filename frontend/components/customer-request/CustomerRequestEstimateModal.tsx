import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { YeuCauEstimate, YeuCauHoursReport } from '../../types/customerRequest';
import { formatCurrentDateTimeForInput, normalizeText } from './helpers';
import { formatHoursValue } from './presentation';
import {
  customerRequestCheckboxRowClass,
  customerRequestFieldClass,
  customerRequestFieldLabelClass,
  customerRequestPrimaryButtonClass,
  customerRequestSecondaryButtonClass,
  customerRequestTextareaClass,
} from './uiClasses';

export type CustomerRequestEstimateSubmission = {
  estimated_hours: string;
  estimate_scope: 'total' | 'remaining' | 'phase';
  estimated_at: string;
  phase_label?: string | null;
  note?: string | null;
  sync_master: boolean;
};

type CustomerRequestEstimateModalProps = {
  open: boolean;
  isSubmitting: boolean;
  requestCode?: string | null;
  requestSummary?: string | null;
  hoursReport?: YeuCauHoursReport | null;
  latestEstimate?: YeuCauEstimate | null;
  onClose: () => void;
  onSubmit: (payload: CustomerRequestEstimateSubmission) => void;
};

export const CustomerRequestEstimateModal: React.FC<CustomerRequestEstimateModalProps> = ({
  open,
  isSubmitting,
  requestCode,
  requestSummary,
  hoursReport,
  latestEstimate,
  onClose,
  onSubmit,
}) => {
  const [estimatedHours, setEstimatedHours] = useState('');
  const [estimateScope, setEstimateScope] = useState<'total' | 'remaining' | 'phase'>('total');
  const [estimatedAt, setEstimatedAt] = useState(formatCurrentDateTimeForInput());
  const [phaseLabel, setPhaseLabel] = useState('');
  const [note, setNote] = useState('');
  const [syncMaster, setSyncMaster] = useState(true);
  const [validationMessage, setValidationMessage] = useState('');

  const currentEstimate = hoursReport?.estimated_hours ?? latestEstimate?.estimated_hours ?? null;
  const actualHours = hoursReport?.total_hours_spent ?? null;
  const headerCaption = useMemo(() => {
    const current = currentEstimate == null ? '--' : formatHoursValue(currentEstimate);
    const actual = actualHours == null ? '--' : formatHoursValue(actualHours);
    return `${current} hiện hành · ${actual} thực tế`;
  }, [actualHours, currentEstimate]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setEstimatedHours(
      currentEstimate != null && Number.isFinite(Number(currentEstimate))
        ? String(Number(currentEstimate))
        : ''
    );
    setEstimateScope('total');
    setEstimatedAt(formatCurrentDateTimeForInput());
    setPhaseLabel('');
    setNote('');
    setSyncMaster(true);
    setValidationMessage('');
  }, [currentEstimate, open, requestCode]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const handleSubmit = () => {
    const numericHours = Number(estimatedHours);
    if (!Number.isFinite(numericHours) || numericHours <= 0) {
      setValidationMessage('Giờ ước lượng phải lớn hơn 0.');
      return;
    }

    if (estimateScope === 'phase' && normalizeText(phaseLabel) === '') {
      setValidationMessage('Nhập tên giai đoạn khi dùng estimate theo phase.');
      return;
    }

    setValidationMessage('');
    onSubmit({
      estimated_hours: estimatedHours.trim(),
      estimate_scope: estimateScope,
      estimated_at: estimatedAt,
      phase_label: estimateScope === 'phase' ? phaseLabel.trim() : null,
      note: note.trim() || null,
      sync_master: estimateScope === 'phase' ? false : syncMaster,
    });
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cập nhật ước lượng"
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Ước lượng</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Cập nhật ước lượng</h3>
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
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Tóm tắt estimate</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{headerCaption}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-[170px_180px_minmax(0,1fr)]">
            <div>
              <label htmlFor="crc-estimate-hours" className={`mb-1.5 ${customerRequestFieldLabelClass}`}>Giờ ước lượng</label>
              <input
                id="crc-estimate-hours"
                type="number"
                min="0.5"
                step="0.5"
                value={estimatedHours}
                onChange={(event) => setEstimatedHours(event.target.value)}
                disabled={isSubmitting}
                placeholder="4.0"
                className={customerRequestFieldClass}
              />
            </div>

            <div>
              <label htmlFor="crc-estimate-scope" className={`mb-1.5 ${customerRequestFieldLabelClass}`}>Phạm vi</label>
              <select
                id="crc-estimate-scope"
                value={estimateScope}
                onChange={(event) => {
                  const nextScope = event.target.value as 'total' | 'remaining' | 'phase';
                  setEstimateScope(nextScope);
                  if (nextScope === 'phase') {
                    setSyncMaster(false);
                  }
                }}
                disabled={isSubmitting}
                className={customerRequestFieldClass}
              >
                <option value="total">Total</option>
                <option value="remaining">Remaining</option>
                <option value="phase">Phase</option>
              </select>
            </div>

            <div>
              <label htmlFor="crc-estimate-at" className={`mb-1.5 ${customerRequestFieldLabelClass}`}>Thời điểm estimate</label>
              <input
                id="crc-estimate-at"
                type="datetime-local"
                value={estimatedAt}
                onChange={(event) => setEstimatedAt(event.target.value)}
                disabled={isSubmitting}
                className={customerRequestFieldClass}
              />
            </div>
          </div>

          {estimateScope === 'phase' ? (
            <div>
              <label htmlFor="crc-estimate-phase" className={`mb-1.5 ${customerRequestFieldLabelClass}`}>Tên giai đoạn</label>
              <input
                id="crc-estimate-phase"
                type="text"
                value={phaseLabel}
                onChange={(event) => setPhaseLabel(event.target.value)}
                disabled={isSubmitting}
                placeholder="Ví dụ: Phân tích, coding, kiểm thử..."
                className={customerRequestFieldClass}
              />
            </div>
          ) : null}

          <div>
            <label htmlFor="crc-estimate-note" className={`mb-1.5 ${customerRequestFieldLabelClass}`}>Ghi chú</label>
            <textarea
              id="crc-estimate-note"
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={isSubmitting}
              placeholder="Mô tả lý do điều chỉnh estimate hoặc giả định chính."
              className={customerRequestTextareaClass}
            />
          </div>

          <label className={customerRequestCheckboxRowClass}>
            <input
              type="checkbox"
              checked={syncMaster}
              onChange={(event) => setSyncMaster(event.target.checked)}
              disabled={isSubmitting || estimateScope === 'phase'}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span className="text-sm font-semibold text-slate-700">
              Đồng bộ estimate hiện hành trên yêu cầu
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
            className={customerRequestSecondaryButtonClass}
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={customerRequestPrimaryButtonClass}
          >
            <span className="material-symbols-outlined text-[18px]">
              {isSubmitting ? 'progress_activity' : 'rule'}
            </span>
            Lưu ước lượng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
