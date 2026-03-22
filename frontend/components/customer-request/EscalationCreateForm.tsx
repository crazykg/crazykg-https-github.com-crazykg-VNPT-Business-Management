import React, { useState } from 'react';
import { createEscalation } from '../../services/v5Api';

type Props = {
  onSave: () => void;
  onCancel: () => void;
  defaultCaseId?: number;
};

const DIFFICULTY_OPTIONS = [
  { value: 'technical',      label: 'Kỹ thuật' },
  { value: 'resource',       label: 'Nguồn lực' },
  { value: 'customer',       label: 'Khách hàng' },
  { value: 'scope_change',   label: 'Thay đổi phạm vi' },
  { value: 'dependency',     label: 'Phụ thuộc' },
  { value: 'sla_risk',       label: 'Nguy cơ SLA' },
];

const SEVERITY_OPTIONS = [
  { value: 'low',      label: 'Thấp' },
  { value: 'medium',   label: 'Trung bình' },
  { value: 'high',     label: 'Cao' },
  { value: 'critical', label: 'Nghiêm trọng' },
];

export function EscalationCreateForm({ onSave, onCancel, defaultCaseId }: Props) {
  const [form, setForm] = useState({
    request_case_id:           defaultCaseId ?? '',
    difficulty_type:           '',
    severity:                  'medium',
    description:               '',
    impact_description:        '',
    blocked_since:             '',
    proposed_action:           '',
    proposed_additional_hours: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await createEscalation({
        request_case_id:           form.request_case_id !== '' ? Number(form.request_case_id) : undefined,
        difficulty_type:           form.difficulty_type || undefined,
        severity:                  (form.severity as 'low' | 'medium' | 'high' | 'critical') || undefined,
        description:               form.description || undefined,
        impact_description:        form.impact_description || null,
        blocked_since:             form.blocked_since || null,
        proposed_action:           form.proposed_action || null,
        proposed_additional_hours: form.proposed_additional_hours !== '' ? Number(form.proposed_additional_hours) : null,
      });
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 md:p-6">
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-2 text-sm text-rose-700">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Mã YC <span className="text-rose-500">*</span>
          </label>
          <input
            type="number"
            value={form.request_case_id}
            onChange={(e) => set('request_case_id', e.target.value)}
            required
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="ID của YC"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Loại khó khăn <span className="text-rose-500">*</span>
          </label>
          <select
            value={form.difficulty_type}
            onChange={(e) => set('difficulty_type', e.target.value)}
            required
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
          >
            <option value="">-- Chọn loại --</option>
            {DIFFICULTY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Mức độ
          </label>
          <select
            value={form.severity}
            onChange={(e) => set('severity', e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
          >
            {SEVERITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Bị chặn từ ngày</label>
          <input
            type="date"
            value={form.blocked_since}
            onChange={(e) => set('blocked_since', e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Đề xuất thêm giờ</label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={form.proposed_additional_hours}
            onChange={(e) => set('proposed_additional_hours', e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="0"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Mô tả vấn đề <span className="text-rose-500">*</span>
        </label>
        <textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          required
          rows={3}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
          placeholder="Mô tả chi tiết vấn đề đang gặp..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Ảnh hưởng</label>
        <textarea
          value={form.impact_description}
          onChange={(e) => set('impact_description', e.target.value)}
          rows={2}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
          placeholder="Mô tả tác động nếu không giải quyết..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Đề xuất xử lý</label>
        <textarea
          value={form.proposed_action}
          onChange={(e) => set('proposed_action', e.target.value)}
          rows={2}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
          placeholder="Đề xuất cách giải quyết..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-2 flex-shrink-0">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
        >
          Huỷ
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting && <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>}
          Tạo escalation
        </button>
      </div>
    </form>
  );
}
