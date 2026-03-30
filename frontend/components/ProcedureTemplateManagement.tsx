import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProcedureTemplate, ProcedureTemplateStep } from '../types';
import {
  fetchProcedureTemplates,
  fetchProcedureTemplateSteps,
  createProcedureTemplate,
  updateProcedureTemplate,
  createProcedureTemplateStep,
  updateProcedureTemplateStep,
  deleteProcedureTemplateStep,
} from '../services/api/projectApi';

type FormMode = 'ADD' | 'EDIT';

interface ProcedureTemplateManagementProps {
  canWrite?: boolean;
  canRead?: boolean;
}

const defaultStepForm = () => ({
  step_number: 1,
  phase: '',
  step_name: '',
  step_detail: '',
  lead_unit: '',
  support_unit: '',
  expected_result: '',
  default_duration_days: '' as string,
  sort_order: '' as string,
  parent_step_id: '' as string,
});

export const ProcedureTemplateManagement: React.FC<ProcedureTemplateManagementProps> = ({
  canWrite = true,
  canRead = true,
}) => {
  // ─── State ────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<ProcedureTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ProcedureTemplate | null>(null);
  const [steps, setSteps] = useState<ProcedureTemplateStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Template form
  const [editingTemplate, setEditingTemplate] = useState<ProcedureTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ template_code: '', template_name: '', description: '', is_active: true });

  // Step form
  const [stepFormMode, setStepFormMode] = useState<FormMode | null>(null);
  const [editingStep, setEditingStep] = useState<ProcedureTemplateStep | null>(null);
  const [stepForm, setStepForm] = useState(defaultStepForm());

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  // ─── Load templates ───────────────────────────────────────────
  const loadTemplates = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError('');
    try {
      const tpls = await fetchProcedureTemplates();
      setTemplates(tpls || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi tải danh sách mẫu');
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  // ─── Load steps ───────────────────────────────────────────────
  const loadSteps = useCallback(async (templateId: string | number) => {
    setStepsLoading(true);
    setError('');
    try {
      const rows = await fetchProcedureTemplateSteps(templateId);
      setSteps(rows || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi tải bước');
    } finally {
      setStepsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      void loadSteps(selectedTemplate.id);
    } else {
      setSteps([]);
    }
  }, [selectedTemplate, loadSteps]);

  // ─── Build tree ───────────────────────────────────────────────
  const stepsTree = useMemo(() => {
    const roots = steps.filter((s) => !s.parent_step_id);
    const childMap = new Map<string | number, ProcedureTemplateStep[]>();
    steps.forEach((s) => {
      if (s.parent_step_id) {
        const arr = childMap.get(s.parent_step_id) || [];
        arr.push(s);
        childMap.set(s.parent_step_id, arr);
      }
    });
    return roots.map((r) => ({ ...r, children: childMap.get(r.id) || [] }));
  }, [steps]);

  // ─── Filter steps by search ───────────────────────────────────
  const filteredTree = useMemo(() => {
    if (!searchTerm.trim()) return stepsTree;
    const q = searchTerm.toLowerCase();
    return stepsTree.filter((s) => {
      const match = (s.step_name || '').toLowerCase().includes(q)
        || (s.phase || '').toLowerCase().includes(q)
        || (s.lead_unit || '').toLowerCase().includes(q)
        || (s.expected_result || '').toLowerCase().includes(q);
      const childMatch = (s.children || []).some((c) =>
        (c.step_name || '').toLowerCase().includes(q)
        || (c.phase || '').toLowerCase().includes(q)
      );
      return match || childMatch;
    });
  }, [stepsTree, searchTerm]);

  // ─── Phase stats ──────────────────────────────────────────────
  const phaseStats = useMemo(() => {
    const map = new Map<string, number>();
    steps.forEach((s) => {
      const p = s.phase || '(Không giai đoạn)';
      map.set(p, (map.get(p) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [steps]);

  // ─── Render ───────────────────────────────────────────────────
  if (!canRead) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
        <span className="material-symbols-outlined text-4xl text-slate-300">lock</span>
        <p className="text-sm">Bạn không có quyền xem cấu hình thủ tục dự án.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">checklist</span>
              Cấu hình danh mục thủ tục dự án
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Quản lý mẫu thủ tục và các bước cho từng loại dự án (Đầu tư, Thuê dịch vụ đặc thù, Thuê dịch vụ có sẵn...)
            </p>
          </div>
          {canWrite && (
            <button
              type="button"
              onClick={() => {
                setEditingTemplate({ id: 0, template_code: '', template_name: '', is_active: true } as ProcedureTemplate);
                setTemplateForm({ template_code: '', template_name: '', description: '', is_active: true });
              }}
              className="flex items-center gap-1.5 h-10 px-5 bg-primary hover:bg-deep-teal text-white text-sm font-semibold rounded-lg shadow-sm transition-all"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Thêm mẫu thủ tục
            </button>
          )}
        </div>

        {/* Template selector + actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[300px]">
            <label className="text-sm font-semibold text-slate-600 whitespace-nowrap">Chọn mẫu:</label>
            <select
              value={selectedTemplate?.id ?? ''}
              onChange={(e) => {
                const id = e.target.value;
                if (!id) { setSelectedTemplate(null); return; }
                const tpl = templates.find((t) => String(t.id) === id);
                setSelectedTemplate(tpl || null);
                setSearchTerm('');
              }}
              className="h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white flex-1 max-w-[400px]"
            >
              <option value="">-- Chọn mẫu thủ tục --</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.template_code} — {t.template_name} {t.is_active ? '' : '(Đã tắt)'}
                </option>
              ))}
            </select>
          </div>

          {selectedTemplate && canWrite && (
            <button
              type="button"
              onClick={() => {
                setEditingTemplate(selectedTemplate);
                setTemplateForm({
                  template_code: selectedTemplate.template_code,
                  template_name: selectedTemplate.template_name,
                  description: selectedTemplate.description || '',
                  is_active: selectedTemplate.is_active,
                });
              }}
              className="flex items-center gap-1 h-10 px-4 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <span className="material-symbols-outlined text-base">edit</span>
              Sửa mẫu
            </button>
          )}

          {selectedTemplate && (
            <div className="relative flex-1 max-w-[260px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm bước..."
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
            <span className="material-symbols-outlined animate-spin text-2xl">refresh</span>
            <span className="text-sm">Đang tải...</span>
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-4">{error}</p>
        )}

        {!loading && !selectedTemplate && (
          <div className="flex flex-col items-center py-20 text-slate-500 gap-3">
            <span className="material-symbols-outlined text-6xl text-slate-200">checklist</span>
            <p className="text-base font-medium">Chọn một mẫu thủ tục để xem và chỉnh sửa</p>
            <p className="text-sm text-slate-400">Hiện có {templates.length} mẫu thủ tục trong hệ thống</p>
          </div>
        )}

        {!loading && selectedTemplate && (
          <>
            {/* Template info + stats */}
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex-1 min-w-[280px] p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mẫu thủ tục</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${selectedTemplate.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {selectedTemplate.is_active ? 'Đang dùng' : 'Đã tắt'}
                  </span>
                </div>
                <p className="text-lg font-bold text-slate-800">{selectedTemplate.template_code}</p>
                <p className="text-sm text-slate-600">{selectedTemplate.template_name}</p>
                {selectedTemplate.description && <p className="text-xs text-slate-500 mt-1">{selectedTemplate.description}</p>}
              </div>

              <div className="flex gap-3">
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 min-w-[120px] text-center">
                  <p className="text-2xl font-bold text-blue-700">{steps.length}</p>
                  <p className="text-xs text-blue-600 font-medium">Tổng bước</p>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 min-w-[120px] text-center">
                  <p className="text-2xl font-bold text-amber-700">{phaseStats.length}</p>
                  <p className="text-xs text-amber-600 font-medium">Giai đoạn</p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 min-w-[120px] text-center">
                  <p className="text-2xl font-bold text-emerald-700">{steps.filter((s) => s.parent_step_id).length}</p>
                  <p className="text-xs text-emerald-600 font-medium">Bước con</p>
                </div>
              </div>
            </div>

            {/* Phase pills */}
            {phaseStats.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {phaseStats.map(([phase, count]) => (
                  <span key={phase} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                    {phase} <span className="text-blue-500">({count})</span>
                  </span>
                ))}
              </div>
            )}

            {/* Add step button */}
            {canWrite && (
              <div className="flex justify-end mb-3">
                <button
                  type="button"
                  onClick={() => {
                    const maxSort = steps.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0);
                    const maxNum  = steps.reduce((m, s) => Math.max(m, s.step_number ?? 0), 0);
                    setStepFormMode('ADD');
                    setEditingStep(null);
                    setStepForm({
                      ...defaultStepForm(),
                      step_number: maxNum + 1,
                      sort_order: String(maxSort + 10),
                    });
                  }}
                  className="flex items-center gap-1.5 h-9 px-4 text-sm font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">add_circle</span>
                  Thêm bước
                </button>
              </div>
            )}

            {/* Steps table */}
            {stepsLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
                <span className="material-symbols-outlined animate-spin text-xl">refresh</span>
                <span className="text-sm">Đang tải bước...</span>
              </div>
            ) : filteredTree.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-slate-500 gap-2">
                <span className="material-symbols-outlined text-4xl text-slate-300">playlist_add</span>
                <p className="text-sm">{searchTerm ? 'Không tìm thấy bước phù hợp.' : 'Chưa có bước nào. Nhấn "Thêm bước" để bắt đầu.'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar rounded-xl border border-slate-200">
                <table className="w-full min-w-[960px] border-separate border-spacing-0">
                  <thead className="bg-slate-50/80 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-3 text-xs font-bold text-slate-500 text-left w-12 border-b border-slate-200">TT</th>
                      <th className="px-3 py-3 text-xs font-bold text-slate-500 text-left w-32 border-b border-slate-200">Giai đoạn</th>
                      <th className="px-3 py-3 text-xs font-bold text-slate-500 text-left border-b border-slate-200">Trình tự công việc</th>
                      <th className="px-3 py-3 text-xs font-bold text-slate-500 text-left w-36 border-b border-slate-200">ĐV chủ trì</th>
                      <th className="px-3 py-3 text-xs font-bold text-slate-500 text-left w-44 border-b border-slate-200">Kết quả dự kiến</th>
                      <th className="px-3 py-3 text-xs font-bold text-slate-500 text-center w-16 border-b border-slate-200">Ngày</th>
                      <th className="px-3 py-3 text-xs font-bold text-slate-500 text-center w-14 border-b border-slate-200">Sort</th>
                      {canWrite && (
                        <th className="px-3 py-3 text-xs font-bold text-slate-500 text-center w-24 border-b border-slate-200">Thao tác</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTree.map((step) => {
                      const renderRow = (s: ProcedureTemplateStep & { children?: ProcedureTemplateStep[] }, isChild = false) => (
                        <tr
                          key={s.id}
                          className={`border-b border-slate-100 last:border-0 hover:bg-primary/[.03] transition-colors ${isChild ? 'bg-slate-50/40' : ''}`}
                        >
                          <td className="px-3 py-2.5 text-sm text-slate-700 font-mono font-bold">{s.step_number}</td>
                          <td className="px-3 py-2.5">
                            {s.phase ? (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 truncate max-w-[120px]">
                                {s.phase}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <p className={`text-sm ${isChild ? 'pl-6 text-slate-600' : 'font-semibold text-slate-800'}`}>
                              {isChild && <span className="text-slate-300 mr-1.5">└</span>}
                              {s.step_name}
                            </p>
                            {s.step_detail && <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[360px]">{isChild ? <span className="pl-6">{s.step_detail}</span> : s.step_detail}</p>}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">{s.lead_unit || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-600 truncate max-w-[160px]">{s.expected_result || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-600 text-center">{s.default_duration_days ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-400 text-center">{s.sort_order}</td>
                          {canWrite && (
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex items-center gap-0.5 justify-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStepFormMode('EDIT');
                                    setEditingStep(s);
                                    setStepForm({
                                      step_number: s.step_number,
                                      phase: s.phase || '',
                                      step_name: s.step_name,
                                      step_detail: s.step_detail || '',
                                      lead_unit: s.lead_unit || '',
                                      support_unit: s.support_unit || '',
                                      expected_result: s.expected_result || '',
                                      default_duration_days: s.default_duration_days != null ? String(s.default_duration_days) : '',
                                      sort_order: String(s.sort_order),
                                      parent_step_id: s.parent_step_id != null ? String(s.parent_step_id) : '',
                                    });
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                                  title="Sửa"
                                >
                                  <span className="material-symbols-outlined text-sm">edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!confirm(`Xoá bước "${s.step_name}"?`)) return;
                                    try {
                                      await deleteProcedureTemplateStep(selectedTemplate!.id, s.id);
                                      void loadSteps(selectedTemplate!.id);
                                    } catch (err: unknown) {
                                      setError(err instanceof Error ? err.message : 'Lỗi xoá');
                                    }
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  title="Xoá"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );

                      return (
                        <React.Fragment key={step.id}>
                          {renderRow(step)}
                          {(step.children || []).map((child) => renderRow(child, true))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Template edit modal ──────────────────────────────────────── */}
      {editingTemplate !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setEditingTemplate(null)} />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-6 flex flex-col gap-4">
            <h3 className="text-base font-bold text-slate-800">
              {editingTemplate.id ? 'Sửa mẫu thủ tục' : 'Thêm mẫu thủ tục'}
            </h3>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">Mã template <span className="text-red-500">*</span></label>
              <input
                value={templateForm.template_code}
                onChange={(e) => setTemplateForm((p) => ({ ...p, template_code: e.target.value.toUpperCase() }))}
                placeholder="VD: THUE_DICH_VU_DACTHU"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">Tên mẫu <span className="text-red-500">*</span></label>
              <input
                value={templateForm.template_name}
                onChange={(e) => setTemplateForm((p) => ({ ...p, template_name: e.target.value }))}
                placeholder="Thủ tục dự án thuê dịch vụ CNTT đặc thù"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">Mô tả</label>
              <textarea
                value={templateForm.description}
                onChange={(e) => setTemplateForm((p) => ({ ...p, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
              />
            </div>

            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={templateForm.is_active}
                onChange={(e) => setTemplateForm((p) => ({ ...p, is_active: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
              />
              <span className="text-sm font-medium text-slate-700">Đang sử dụng</span>
            </label>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingTemplate(null)}
                className="flex-1 h-10 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={saving || !templateForm.template_code.trim() || !templateForm.template_name.trim()}
                onClick={async () => {
                  setSaving(true);
                  setError('');
                  try {
                    if (editingTemplate.id) {
                      const updated = await updateProcedureTemplate(editingTemplate.id, templateForm);
                      setTemplates((prev) => prev.map((t) => String(t.id) === String(updated.id) ? { ...t, ...updated } : t));
                      if (selectedTemplate && String(selectedTemplate.id) === String(updated.id)) {
                        setSelectedTemplate({ ...selectedTemplate, ...updated });
                      }
                    } else {
                      const created = await createProcedureTemplate(templateForm);
                      setTemplates((prev) => [...prev, created]);
                      setSelectedTemplate(created);
                    }
                    setEditingTemplate(null);
                  } catch (err: unknown) {
                    setError(err instanceof Error ? err.message : 'Lỗi lưu template');
                  } finally {
                    setSaving(false);
                  }
                }}
                className="flex-1 h-10 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-deep-teal transition-all shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {saving ? 'Đang lưu...' : editingTemplate.id ? 'Cập nhật' : 'Tạo mới'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step add/edit slide-in panel ─────────────────────────────── */}
      {stepFormMode !== null && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setStepFormMode(null)} />
          <div className="relative ml-auto w-full max-w-md h-full bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-800">{stepFormMode === 'ADD' ? 'Thêm bước mới' : 'Sửa bước'}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedTemplate.template_code} — {selectedTemplate.template_name}</p>
              </div>
              <button type="button" onClick={() => setStepFormMode(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-700">Số TT <span className="text-red-500">*</span></label>
                  <input
                    type="number" min={1}
                    value={stepForm.step_number}
                    onChange={(e) => setStepForm((p) => ({ ...p, step_number: Number(e.target.value) }))}
                    className="h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-700">Sort order</label>
                  <input
                    type="number"
                    value={stepForm.sort_order}
                    onChange={(e) => setStepForm((p) => ({ ...p, sort_order: e.target.value }))}
                    className="h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700">Giai đoạn (phase)</label>
                <input
                  value={stepForm.phase}
                  onChange={(e) => setStepForm((p) => ({ ...p, phase: e.target.value }))}
                  placeholder="VD: CHUAN_BI, THUC_HIEN, NGHIEM_THU"
                  className="h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700">Tên bước <span className="text-red-500">*</span></label>
                <input
                  value={stepForm.step_name}
                  onChange={(e) => setStepForm((p) => ({ ...p, step_name: e.target.value }))}
                  className="h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700">Chi tiết</label>
                <textarea
                  value={stepForm.step_detail}
                  onChange={(e) => setStepForm((p) => ({ ...p, step_detail: e.target.value }))}
                  rows={2}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-700">ĐV chủ trì</label>
                  <input
                    value={stepForm.lead_unit}
                    onChange={(e) => setStepForm((p) => ({ ...p, lead_unit: e.target.value }))}
                    className="h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-700">ĐV hỗ trợ</label>
                  <input
                    value={stepForm.support_unit}
                    onChange={(e) => setStepForm((p) => ({ ...p, support_unit: e.target.value }))}
                    className="h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700">Kết quả dự kiến</label>
                <input
                  value={stepForm.expected_result}
                  onChange={(e) => setStepForm((p) => ({ ...p, expected_result: e.target.value }))}
                  className="h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-700">Thời gian (ngày)</label>
                  <input
                    type="number" min={0}
                    value={stepForm.default_duration_days}
                    onChange={(e) => setStepForm((p) => ({ ...p, default_duration_days: e.target.value }))}
                    className="h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-700">Bước cha</label>
                  <select
                    value={stepForm.parent_step_id}
                    onChange={(e) => setStepForm((p) => ({ ...p, parent_step_id: e.target.value }))}
                    className="h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                  >
                    <option value="">-- Không --</option>
                    {steps
                      .filter((s) => !s.parent_step_id && (editingStep ? String(s.id) !== String(editingStep.id) : true))
                      .map((s) => (
                        <option key={s.id} value={s.id}>{s.step_number}. {s.step_name}</option>
                      ))}
                  </select>
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex gap-3">
              <button
                type="button"
                onClick={() => setStepFormMode(null)}
                className="flex-1 h-10 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={saving || !stepForm.step_name.trim()}
                onClick={async () => {
                  setSaving(true);
                  setError('');
                  try {
                    const payload: Partial<ProcedureTemplateStep> = {
                      step_number: stepForm.step_number,
                      phase: stepForm.phase.trim() || undefined,
                      step_name: stepForm.step_name.trim(),
                      step_detail: stepForm.step_detail.trim() || undefined,
                      lead_unit: stepForm.lead_unit.trim() || undefined,
                      support_unit: stepForm.support_unit.trim() || undefined,
                      expected_result: stepForm.expected_result.trim() || undefined,
                      default_duration_days: stepForm.default_duration_days ? Number(stepForm.default_duration_days) : undefined,
                      sort_order: stepForm.sort_order ? Number(stepForm.sort_order) : undefined,
                      parent_step_id: stepForm.parent_step_id ? Number(stepForm.parent_step_id) : null,
                    };

                    if (stepFormMode === 'ADD') {
                      await createProcedureTemplateStep(selectedTemplate!.id, payload);
                    } else if (editingStep) {
                      await updateProcedureTemplateStep(selectedTemplate!.id, editingStep.id, payload);
                    }

                    void loadSteps(selectedTemplate!.id);
                    setStepFormMode(null);
                    setEditingStep(null);
                  } catch (err: unknown) {
                    setError(err instanceof Error ? err.message : 'Lỗi lưu bước');
                  } finally {
                    setSaving(false);
                  }
                }}
                className="flex-1 h-10 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-deep-teal transition-all shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {saving ? 'Đang lưu...' : stepFormMode === 'ADD' ? 'Thêm' : 'Cập nhật'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
