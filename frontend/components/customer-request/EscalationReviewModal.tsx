import React, { useEffect, useState } from 'react';
import { reviewEscalation } from '../../services/api/customerRequestApi';
import type { CustomerRequestEscalation } from '../../types/customerRequest';

type Props = {
  escalation: CustomerRequestEscalation | null;
  onSave: () => void;
  onClose: () => void;
};

const RESOLUTION_OPTIONS = [
  { value: 'approve_proposal',  label: 'Chấp thuận đề xuất' },
  { value: 'reassign',          label: 'Phân công lại' },
  { value: 'add_resource',      label: 'Bổ sung nguồn lực' },
  { value: 'extend_deadline',   label: 'Gia hạn deadline' },
  { value: 'cancel_request',    label: 'Huỷ YC' },
  { value: 'other',             label: 'Khác' },
];

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Nghiêm trọng', high: 'Cao', medium: 'Trung bình', low: 'Thấp',
};

const SEVERITY_CLS: Record<string, string> = {
  critical: 'text-rose-700 bg-rose-50 border-rose-200',
  high:     'text-orange-700 bg-orange-50 border-orange-200',
  medium:   'text-amber-700 bg-amber-50 border-amber-200',
  low:      'text-slate-600 bg-slate-50 border-slate-200',
};

export function EscalationReviewModal({ escalation, onSave, onClose }: Props) {
  const [decision, setDecision] = useState('');
  const [note,     setNote]     = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (escalation) {
      setDecision(escalation.resolution_decision ?? '');
      setNote(escalation.resolution_note ?? '');
      setError(null);
    }
  }, [escalation]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!escalation) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!decision) { setError('Vui lòng chọn quyết định.'); return; }
    setIsSubmitting(true);
    try {
      await reviewEscalation(escalation.id, { resolution_decision: decision, resolution_note: note || undefined });
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sevCls = SEVERITY_CLS[escalation.severity] ?? 'text-slate-600 bg-slate-50 border-slate-200';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3 text-slate-900">
            <span className="material-symbols-outlined text-primary text-2xl">rate_review</span>
            <h2 className="text-lg font-bold">Duyệt Escalation</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* Escalation info */}
          <div className={`rounded-lg border p-4 space-y-2 ${sevCls}`}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold">{escalation.escalation_code}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${sevCls}`}>
                {SEVERITY_LABEL[escalation.severity] ?? escalation.severity}
              </span>
            </div>
            <div className="text-xs">
              <span className="text-slate-500">YC:</span>{' '}
              <span className="font-medium">{escalation.request_code ?? escalation.request_case_id}</span>
            </div>
            <p className="text-sm">{escalation.description}</p>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-2 text-sm text-rose-700">{error}</div>
          )}

          <form id="review-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Quyết định <span className="text-rose-500">*</span>
              </label>
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              >
                <option value="">-- Chọn quyết định --</option>
                {RESOLUTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                placeholder="Ghi chú thêm về quyết định..."
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Đóng
          </button>
          <button
            type="submit"
            form="review-form"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting && <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>}
            Duyệt &amp; Giải quyết
          </button>
        </div>
      </div>
    </div>
  );
}
