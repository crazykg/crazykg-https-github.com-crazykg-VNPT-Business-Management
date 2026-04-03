import React, { useEffect, useState } from 'react';
import { createDirective } from '../../services/api/customerRequestApi';

type Props = {
  onSave: () => void;
  onClose: () => void;
  defaultEscalationId?: number;
};

const DIRECTIVE_TYPES = [
  { value: 'resource_transfer',  label: 'Chuyển nguồn lực' },
  { value: 'deadline_extension', label: 'Gia hạn deadline' },
  { value: 'priority_change',    label: 'Thay đổi ưu tiên' },
  { value: 'contact_customer',   label: 'Liên hệ khách hàng' },
  { value: 'training',           label: 'Đào tạo' },
  { value: 'other',              label: 'Khác' },
];

const PRIORITIES = [
  { value: 'high',   label: 'Cao' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'low',    label: 'Thấp' },
];

const SOURCE_TYPES = [
  { value: 'escalation',  label: 'Escalation' },
  { value: 'pain_point',  label: 'Điểm đau' },
  { value: 'manual',      label: 'Thủ công' },
];

export function DirectiveCreateModal({ onSave, onClose, defaultEscalationId }: Props) {
  const [form, setForm] = useState({
    assigned_to_user_id:  '',
    directive_type:       '',
    content:              '',
    priority:             'high',
    deadline:             '',
    source_type:          '',
    source_escalation_id: defaultEscalationId !== undefined ? String(defaultEscalationId) : '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await createDirective({
        assigned_to_user_id:  form.assigned_to_user_id !== '' ? Number(form.assigned_to_user_id) : undefined,
        directive_type:       form.directive_type       || undefined,
        content:              form.content              || undefined,
        priority:             (form.priority as 'low' | 'medium' | 'high') || undefined,
        deadline:             form.deadline             || null,
        source_type:          form.source_type          || null,
        source_escalation_id: form.source_escalation_id !== '' ? Number(form.source_escalation_id) : null,
      });
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-2xl">edit_document</span>
            <h2 className="text-lg font-bold text-slate-900">Tạo chỉ đạo</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-2 text-sm text-rose-700 mb-4">{error}</div>
          )}

          <form id="directive-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Người nhận <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  value={form.assigned_to_user_id}
                  onChange={(e) => set('assigned_to_user_id', e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="User ID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Loại chỉ đạo <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.directive_type}
                  onChange={(e) => set('directive_type', e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                >
                  <option value="">-- Chọn loại --</option>
                  {DIRECTIVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Độ ưu tiên</label>
                <select
                  value={form.priority}
                  onChange={(e) => set('priority', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Deadline</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => set('deadline', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nguồn gốc</label>
                <select
                  value={form.source_type}
                  onChange={(e) => set('source_type', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                >
                  <option value="">-- Không xác định --</option>
                  {SOURCE_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mã Escalation liên kết</label>
                <input
                  type="number"
                  value={form.source_escalation_id}
                  onChange={(e) => set('source_escalation_id', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="ID escalation (tuỳ chọn)"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nội dung chỉ đạo <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={form.content}
                onChange={(e) => set('content', e.target.value)}
                required
                rows={4}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                placeholder="Nội dung chỉ đạo chi tiết..."
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
            Huỷ
          </button>
          <button
            type="submit"
            form="directive-form"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting && <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>}
            Tạo chỉ đạo
          </button>
        </div>
      </div>
    </div>
  );
}
