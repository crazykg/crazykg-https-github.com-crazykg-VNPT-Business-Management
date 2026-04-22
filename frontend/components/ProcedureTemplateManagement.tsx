import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ProcedureTemplate, ProcedureTemplateStep } from '../types/project';
import {
  fetchProcedureTemplates,
  fetchProcedureTemplateSteps,
  createProcedureTemplate,
  updateProcedureTemplate,
  deleteProcedureTemplate,
  createProcedureTemplateStep,
  deleteProcedureTemplateSteps,
  updateProcedureTemplateStep,
  deleteProcedureTemplateStep,
  importProcedureTemplateSteps,
} from '../services/api/projectApi';
import { ImportModal, type ImportPayload } from './modals';
import { useEscKey } from '../hooks/useEscKey';
import { useToastStore } from '../shared/stores/toastStore';
import { downloadExcelWorkbook } from '../utils/excelTemplate';
import { normalizeImportNumber, normalizeImportToken } from '../utils/importUtils';

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

const PROCEDURE_TEMPLATE_IMPORT_MODULE_KEY = 'procedure_template_steps';
const PROCEDURE_TEMPLATE_IMPORT_HEADERS = [
  'STT',
  'Giai đoạn',
  'Trình tự công việc',
  'Chi tiết bước',
  'Đơn vị chủ trì',
  'Đơn vị phối hợp',
  'Kết quả mong đợi',
  'Số ngày mặc định',
];

type ProcedureTemplateImportStep = {
  step_key: string;
  parent_key?: string | null;
  step_number: number;
  phase?: string | null;
  step_name: string;
  step_detail?: string | null;
  lead_unit?: string | null;
  support_unit?: string | null;
  expected_result?: string | null;
  default_duration_days?: number | null;
  sort_order: number;
};

const normalizeProcedureTemplateCell = (value: unknown): string => String(value ?? '').trim();

const resolveProcedureTemplateImportColumns = (headers: string[]) => {
  const headerMap = new Map(headers.map((header, index) => [normalizeImportToken(header), index]));
  const pickColumn = (...tokens: string[]) => {
    for (const token of tokens) {
      const columnIndex = headerMap.get(token);
      if (columnIndex !== undefined) {
        return columnIndex;
      }
    }
    return -1;
  };

  return {
    stepOrder: pickColumn('stt', 'sothutu', 'stepnumber'),
    phase: pickColumn('giaidoan', 'phase'),
    stepName: pickColumn('trinhtucongviec', 'tenbuoc', 'congviec', 'stepname'),
    stepDetail: pickColumn('chitietbuoc', 'motabuoc', 'stepdetail', 'mota', 'ghichu'),
    leadUnit: pickColumn('donvichutri', 'leadunit', 'donvichinh'),
    supportUnit: pickColumn('donviphoihop', 'supportunit', 'donvihotro'),
    expectedResult: pickColumn('ketquamongdoi', 'expectedresult', 'ketqua'),
    defaultDurationDays: pickColumn('songaymacdinh', 'defaultdurationdays', 'thoigianmacdinh', 'songay'),
  };
};

const parseProcedureTemplateImportPayload = (payload: ImportPayload): ProcedureTemplateImportStep[] => {
  const headers = payload.headers || [];
  const rows = payload.rows || [];
  const columns = resolveProcedureTemplateImportColumns(headers);

  if (columns.stepOrder < 0) {
    throw new Error('Thiếu cột STT trong file import.');
  }

  const rootPhases = new Map<string, string | null>();
  const importedSteps: ProcedureTemplateImportStep[] = [];

  rows.forEach((row, rowIndex) => {
    const hasAnyContent = (row || []).some((cell) => normalizeProcedureTemplateCell(cell).length > 0);
    if (!hasAnyContent) {
      return;
    }

    const excelRowNumber = rowIndex + 2;
    const stepOrderText = normalizeProcedureTemplateCell(row[columns.stepOrder]);

    if (!stepOrderText) {
      throw new Error(`Dòng ${excelRowNumber} thiếu STT.`);
    }

    const stepOrderMatch = stepOrderText.replace(/,/g, '.').match(/^(\d+)(?:\.(\d+))?$/);
    if (!stepOrderMatch) {
      throw new Error(`Dòng ${excelRowNumber} có STT không hợp lệ: "${stepOrderText}".`);
    }

    const rootKey = String(Number(stepOrderMatch[1]));
    const childKey = stepOrderMatch[2] ? `${rootKey}.${String(Number(stepOrderMatch[2]))}` : rootKey;
    const isChildRow = Boolean(stepOrderMatch[2]);
    const phaseText = columns.phase >= 0 ? normalizeProcedureTemplateCell(row[columns.phase]) : '';
    const stepNameText = columns.stepName >= 0 ? normalizeProcedureTemplateCell(row[columns.stepName]) : '';
    const resolvedStepName = (stepNameText || phaseText).trim();

    if (!resolvedStepName) {
      throw new Error(`Dòng ${excelRowNumber} thiếu tên bước hoặc giai đoạn.`);
    }

    if (isChildRow && !rootPhases.has(rootKey)) {
      throw new Error(`Dòng ${excelRowNumber} tham chiếu bước cha ${rootKey} nhưng chưa có dòng cha phía trên.`);
    }

    const resolvedPhase = isChildRow
      ? (phaseText || rootPhases.get(rootKey) || null)
      : (phaseText || null);

    const durationText = columns.defaultDurationDays >= 0
      ? normalizeProcedureTemplateCell(row[columns.defaultDurationDays])
      : '';
    const normalizedDuration = durationText ? normalizeImportNumber(durationText) : null;

    if (durationText && (normalizedDuration === null || normalizedDuration < 0 || !Number.isInteger(normalizedDuration))) {
      throw new Error(`Dòng ${excelRowNumber} có Số ngày mặc định không hợp lệ.`);
    }

    if (!isChildRow) {
      if (rootPhases.has(rootKey)) {
        throw new Error(`Dòng ${excelRowNumber} bị trùng STT bước cha ${rootKey}.`);
      }
      rootPhases.set(rootKey, resolvedPhase);
    }

    importedSteps.push({
      step_key: childKey,
      parent_key: isChildRow ? rootKey : null,
      step_number: Number(rootKey),
      phase: resolvedPhase,
      step_name: resolvedStepName,
      step_detail: columns.stepDetail >= 0 ? normalizeProcedureTemplateCell(row[columns.stepDetail]) || null : null,
      lead_unit: columns.leadUnit >= 0 ? normalizeProcedureTemplateCell(row[columns.leadUnit]) || null : null,
      support_unit: columns.supportUnit >= 0 ? normalizeProcedureTemplateCell(row[columns.supportUnit]) || null : null,
      expected_result: columns.expectedResult >= 0 ? normalizeProcedureTemplateCell(row[columns.expectedResult]) || null : null,
      default_duration_days: normalizedDuration === null ? null : normalizedDuration,
      sort_order: (importedSteps.length + 1) * 10,
    });
  });

  if (importedSteps.length === 0) {
    throw new Error('File import không có dòng dữ liệu hợp lệ.');
  }

  return importedSteps;
};

const buildProcedureTemplateExportRows = (
  tree: Array<ProcedureTemplateStep & { children?: ProcedureTemplateStep[] }>
) =>
  tree.flatMap((step) => {
    const parentPhase = step.phase || step.step_name;
    const parentRow = [
      step.step_number,
      parentPhase,
      step.step_name,
      step.step_detail || '',
      step.lead_unit || '',
      step.support_unit || '',
      step.expected_result || '',
      step.default_duration_days ?? '',
    ];

    const childRows = (step.children || []).map((child, index) => [
      `${step.step_number}.${index + 1}`,
      '',
      child.step_name,
      child.step_detail || '',
      child.lead_unit || '',
      child.support_unit || '',
      child.expected_result || '',
      child.default_duration_days ?? '',
    ]);

    return [parentRow, ...childRows];
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
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [selectedStepIds, setSelectedStepIds] = useState<string[]>([]);
  const [deletingSelectedSteps, setDeletingSelectedSteps] = useState(false);
  const [deletingSingleStepId, setDeletingSingleStepId] = useState<string | null>(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [importMenuStyle, setImportMenuStyle] = useState<React.CSSProperties>({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const selectAllStepsRef = useRef<HTMLInputElement | null>(null);
  const importMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const addToast = useToastStore((state) => state.addToast);
  const canUsePortal = typeof document !== 'undefined';

  useEscKey(() => setShowImportMenu(false), showImportMenu);

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
      const nextTemplates = tpls || [];
      setTemplates(nextTemplates);
      setSelectedTemplate((current) => {
        if (!current) {
          return current;
        }

        return nextTemplates.find((template) => String(template.id) === String(current.id)) || null;
      });
      return nextTemplates;
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
      const nextRows = rows || [];
      setSteps(nextRows);
      setSelectedTemplate((current) => {
        if (!current || String(current.id) !== String(templateId)) {
          return current;
        }

        const proceduresCount = current.procedures_count ?? 0;
        return {
          ...current,
          steps_count: nextRows.length,
          can_delete: nextRows.length === 0 && proceduresCount === 0,
        };
      });
      return nextRows;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi tải bước');
    } finally {
      setStepsLoading(false);
    }
  }, []);

  const selectedTemplateId = selectedTemplate?.id ?? null;

  useEffect(() => {
    setSelectedStepIds([]);
  }, [selectedTemplateId]);

  useEffect(() => {
    setShowImportMenu(false);
  }, [selectedTemplateId]);

  const syncImportMenuPlacement = useCallback(() => {
    if (!showImportMenu || !importMenuButtonRef.current) {
      return;
    }

    const rect = importMenuButtonRef.current.getBoundingClientRect();
    const width = 240;
    const maxLeft = Math.max(12, window.innerWidth - width - 12);
    const left = Math.min(Math.max(12, rect.right - width), maxLeft);

    setImportMenuStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      left,
      width,
      zIndex: 40,
    });
  }, [showImportMenu]);

  useEffect(() => {
    if (!showImportMenu || !canUsePortal) {
      return;
    }

    syncImportMenuPlacement();
    window.addEventListener('resize', syncImportMenuPlacement);
    window.addEventListener('scroll', syncImportMenuPlacement, true);

    return () => {
      window.removeEventListener('resize', syncImportMenuPlacement);
      window.removeEventListener('scroll', syncImportMenuPlacement, true);
    };
  }, [canUsePortal, showImportMenu, syncImportMenuPlacement]);

  useEffect(() => {
    if (selectedTemplateId !== null) {
      void loadSteps(selectedTemplateId);
    } else {
      setSteps([]);
    }
  }, [selectedTemplateId, loadSteps]);

  useEffect(() => {
    const validIds = new Set(steps.map((step) => String(step.id)));
    setSelectedStepIds((current) => {
      const next = current.filter((stepId) => validIds.has(stepId));
      return next.length === current.length ? current : next;
    });
  }, [steps]);

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

  const visibleSteps = useMemo(
    () => filteredTree.flatMap((step) => [step, ...(step.children || [])]),
    [filteredTree],
  );
  const visibleStepIds = useMemo(
    () => visibleSteps.map((step) => String(step.id)),
    [visibleSteps],
  );
  const selectedStepIdSet = useMemo(() => new Set(selectedStepIds), [selectedStepIds]);
  const allVisibleStepsSelected = visibleStepIds.length > 0
    && visibleStepIds.every((stepId) => selectedStepIdSet.has(stepId));
  const someVisibleStepsSelected = visibleStepIds.some((stepId) => selectedStepIdSet.has(stepId));

  useEffect(() => {
    if (selectAllStepsRef.current) {
      selectAllStepsRef.current.indeterminate = someVisibleStepsSelected && !allVisibleStepsSelected;
    }
  }, [allVisibleStepsSelected, someVisibleStepsSelected]);

  const toggleStepSelection = useCallback((stepId: string | number, checked: boolean) => {
    const normalizedId = String(stepId);
    setSelectedStepIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(normalizedId);
      } else {
        next.delete(normalizedId);
      }
      return Array.from(next);
    });
  }, []);

  const toggleSelectAllVisibleSteps = useCallback((checked: boolean) => {
    setSelectedStepIds((current) => {
      const next = new Set(current);
      if (checked) {
        visibleStepIds.forEach((stepId) => next.add(stepId));
      } else {
        visibleStepIds.forEach((stepId) => next.delete(stepId));
      }
      return Array.from(next);
    });
  }, [visibleStepIds]);

  // ─── Phase stats ──────────────────────────────────────────────
  const phaseStats = useMemo(() => {
    const map = new Map<string, number>();
    const minStep = new Map<string, number>();
    steps.forEach((s) => {
      const p = s.phase || '(Không giai đoạn)';
      map.set(p, (map.get(p) || 0) + 1);
      const prev = minStep.get(p) ?? Infinity;
      minStep.set(p, Math.min(prev, s.step_number ?? Infinity));
    });
    return Array.from(map.entries()).sort((a, b) => (minStep.get(a[0]) ?? 0) - (minStep.get(b[0]) ?? 0));
  }, [steps]);

  const procedureTemplateExportRows = useMemo(
    () => buildProcedureTemplateExportRows(stepsTree),
    [stepsTree],
  );

  const templateStepsCount = selectedTemplate?.steps_count ?? steps.length;
  const templateProceduresCount = selectedTemplate?.procedures_count ?? 0;
  const canDeleteSelectedTemplate = Boolean(selectedTemplate)
    && (selectedTemplate?.can_delete ?? (templateStepsCount === 0 && templateProceduresCount === 0));
  const canImportSelectedTemplate = Boolean(selectedTemplate) && templateProceduresCount === 0;
  const deletingAnySteps = deletingSelectedSteps || deletingSingleStepId !== null;

  const handleDeleteSelectedSteps = useCallback(async () => {
    if (!selectedTemplate || selectedStepIds.length === 0 || deletingAnySteps) {
      return;
    }

    if (!confirm(`Xóa ${selectedStepIds.length} bước đã chọn?`)) {
      return;
    }

    setDeletingSelectedSteps(true);
    setError('');

    try {
      await deleteProcedureTemplateSteps(selectedTemplate.id, selectedStepIds);
      setSelectedStepIds([]);
      await loadSteps(selectedTemplate.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi xoá hàng loạt');
    } finally {
      setDeletingSelectedSteps(false);
    }
  }, [deletingAnySteps, loadSteps, selectedStepIds, selectedTemplate]);

  const handleOpenImportModal = useCallback(() => {
    if (!selectedTemplate) {
      const message = 'Chọn mẫu thủ tục trước khi nhập dữ liệu.';
      setError(message);
      addToast('warning', 'Nhập dữ liệu', message);
      return;
    }

    if (!canImportSelectedTemplate) {
      const message = 'Không thể import vì mẫu đã được áp dụng cho dự án. Hãy tạo mẫu mới hoặc đồng bộ lại thủ tục liên quan trước.';
      setError(message);
      addToast('warning', 'Nhập dữ liệu', message);
      return;
    }

    setError('');
    setShowImportModal(true);
  }, [addToast, canImportSelectedTemplate, selectedTemplate]);

  const handleDownloadTemplate = useCallback(() => {
    if (!selectedTemplate) {
      const message = 'Chọn mẫu thủ tục trước khi tải file mẫu.';
      setError(message);
      addToast('warning', 'Tải file mẫu', message);
      return;
    }

    const fileKey = String(selectedTemplate.template_code || 'thu_tuc_du_an')
      .trim()
      .toLowerCase();

    downloadExcelWorkbook(`mau_nhap_${fileKey}`, [
      {
        name: 'ThuTuc',
        headers: PROCEDURE_TEMPLATE_IMPORT_HEADERS,
        rows: procedureTemplateExportRows,
        columns: [72, 220, 320, 280, 220, 220, 260, 120],
      },
      {
        name: 'HuongDan',
        headers: ['Mục', 'Nội dung'],
        rows: [
          ['Template', `${selectedTemplate.template_code} - ${selectedTemplate.template_name}`],
          ['Mô tả', selectedTemplate.description || ''],
          ['Số bước hiện tại', templateStepsCount],
          ['Quy tắc 1', 'Dòng có STT nguyên là bước cha / giai đoạn của thủ tục.'],
          ['Quy tắc 2', 'Dòng có STT dạng 1.1, 1.2... là bước con của dòng cha cùng số nguyên phía trước.'],
          ['Quy tắc 3', 'Có thể chỉnh các cột Chi tiết bước, Đơn vị chủ trì, Đơn vị phối hợp, Kết quả mong đợi, Số ngày mặc định trước khi import lại.'],
          ['Lưu ý', 'Import sẽ ghi đè toàn bộ bước hiện có của mẫu đang chọn nếu mẫu chưa được áp dụng cho dự án.'],
        ],
        columns: [180, 780],
      },
    ]);
  }, [addToast, procedureTemplateExportRows, selectedTemplate, templateStepsCount]);

  const handleSaveImportedSteps = useCallback(async (payload: ImportPayload) => {
    if (!selectedTemplate) {
      const message = 'Chọn mẫu thủ tục trước khi nhập dữ liệu.';
      setError(message);
      addToast('warning', 'Nhập dữ liệu', message);
      return;
    }

    setIsImporting(true);
    setError('');

    try {
      const importedSteps = parseProcedureTemplateImportPayload(payload);

      if (
        steps.length > 0
        && !window.confirm(
          `Mẫu "${selectedTemplate.template_name}" hiện có ${steps.length} bước. Import sẽ ghi đè toàn bộ dữ liệu bước, bạn có muốn tiếp tục không?`
        )
      ) {
        return;
      }

      const result = await importProcedureTemplateSteps(selectedTemplate.id, importedSteps);
      await Promise.all([loadSteps(selectedTemplate.id), loadTemplates()]);
      setSearchTerm('');
      setSelectedStepIds([]);
      setShowImportModal(false);
      addToast(
        'success',
        'Nhập dữ liệu',
        `Đã nạp ${result.imported_count ?? importedSteps.length} bước vào mẫu ${selectedTemplate.template_name}.`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể nhập dữ liệu bước thủ tục.';
      setError(message);
      addToast('error', 'Import thất bại', message);
    } finally {
      setIsImporting(false);
    }
  }, [addToast, loadSteps, loadTemplates, selectedTemplate, steps.length]);

  const importMenuContent = showImportMenu ? (
    <>
      <div className="fixed inset-0 z-30" onClick={() => setShowImportMenu(false)} />
      <div
        role="menu"
        style={canUsePortal ? importMenuStyle : undefined}
        className={`flex min-w-[220px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ${
          canUsePortal ? '' : 'absolute right-0 top-full z-40 mt-2'
        }`}
      >
        <button
          type="button"
          role="menuitem"
          disabled={!canImportSelectedTemplate}
          onClick={() => {
            setShowImportMenu(false);
            handleOpenImportModal();
          }}
          className="flex items-center gap-3 px-5 py-4 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white disabled:hover:text-slate-300"
        >
          <span className="material-symbols-outlined text-[20px]">upload_file</span>
          Nhập dữ liệu
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setShowImportMenu(false);
            handleDownloadTemplate();
          }}
          className="flex items-center gap-3 border-t border-slate-100 px-5 py-4 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-700"
        >
          <span className="material-symbols-outlined text-[20px]">download</span>
          Tải file mẫu
        </button>
      </div>
    </>
  ) : null;

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
    <div className="p-3 pb-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-secondary/15">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>checklist</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal leading-tight">Cấu hình thủ tục dự án</h2>
            <p className="text-[11px] text-slate-400 leading-tight">Mẫu thủ tục và các bước cho từng loại dự án</p>
          </div>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => {
              setEditingTemplate({ id: 0, template_code: '', template_name: '', is_active: true } as ProcedureTemplate);
              setTemplateForm({ template_code: '', template_name: '', description: '', is_active: true });
            }}
            className="inline-flex items-center gap-1.5 h-8 px-3 bg-primary hover:bg-deep-teal text-white text-xs font-semibold rounded shadow-sm transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
            Thêm mẫu
          </button>
        )}
      </div>

        <div className="mb-3">
        {/* Template selector + actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <label htmlFor="procedure-template-select" className="text-xs font-semibold text-slate-600 whitespace-nowrap">Chọn mẫu:</label>
            <select
              id="procedure-template-select"
              value={selectedTemplate?.id ?? ''}
              onChange={(e) => {
                const id = e.target.value;
                setError('');
                if (!id) {
                  setSelectedTemplate(null);
                  setSearchTerm('');
                  return;
                }
                const tpl = templates.find((t) => String(t.id) === id);
                setSelectedTemplate(tpl || null);
                setSearchTerm('');
              }}
              className="h-8 px-3 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none bg-white flex-1 max-w-[380px]"
            >
              <option value="">-- Chọn mẫu thủ tục --</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.template_name} {t.is_active ? '' : '(Đã tắt)'}
                </option>
              ))}
            </select>
          </div>

          {selectedTemplate && canWrite && (
            <>
              <div className="relative">
                <button
                  ref={importMenuButtonRef}
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={showImportMenu}
                  onClick={() => setShowImportMenu((previous) => !previous)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>upload</span>
                  Nhập
                  <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 14 }}>expand_more</span>
                </button>
                {importMenuContent ? (canUsePortal ? createPortal(importMenuContent, document.body) : importMenuContent) : null}
              </div>
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
                className="inline-flex items-center gap-1 h-8 px-3 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined text-base">edit</span>
                Sửa mẫu
              </button>
              <button
                type="button"
                disabled={deletingTemplate}
                onClick={async () => {
                  if (!selectedTemplate) {
                    return;
                  }

                  if (!canDeleteSelectedTemplate) {
                    setError('Chỉ có thể xóa mẫu khi chưa có bước cấu hình và chưa được áp dụng cho dự án.');
                    return;
                  }

                  if (!confirm(`Xóa mẫu "${selectedTemplate.template_code} — ${selectedTemplate.template_name}"?`)) {
                    return;
                  }

                  setDeletingTemplate(true);
                  setError('');

                  try {
                    await deleteProcedureTemplate(selectedTemplate.id);
                    setSelectedTemplate(null);
                    setSteps([]);
                    setSearchTerm('');
                    await loadTemplates();
                  } catch (err: unknown) {
                    setError(err instanceof Error ? err.message : 'Lỗi xóa mẫu');
                  } finally {
                    setDeletingTemplate(false);
                  }
                }}
                className="inline-flex items-center gap-1 h-8 px-3 text-xs font-medium rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-base">delete</span>
                {deletingTemplate ? 'Đang xóa...' : 'Xóa mẫu'}
              </button>
            </>
          )}

          {selectedTemplate && (
            <div className="relative flex-1 max-w-[240px]">
              <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm bước..."
                className="w-full h-8 pl-7 pr-3 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: 20 }}>refresh</span>
            <span className="text-sm">Đang tải...</span>
          </div>
        )}

        {error && !loading && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</p>
        )}

        {!loading && !selectedTemplate && (
          <div className="flex flex-col items-center py-16 text-slate-500 gap-3">
            <span className="material-symbols-outlined text-slate-200" style={{ fontSize: 48 }}>checklist</span>
            <p className="text-sm font-medium">Chọn một mẫu thủ tục để xem và chỉnh sửa</p>
            <p className="text-xs text-slate-400">Hiện có {templates.length} mẫu trong hệ thống</p>
          </div>
        )}

        {!loading && selectedTemplate && (
          <>
            {/* Template info + stats */}
            <div className="flex flex-wrap gap-2 mb-3">
              <div className="flex-1 min-w-[240px] p-3 rounded-lg bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mẫu thủ tục</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${selectedTemplate.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                    {selectedTemplate.is_active ? 'Đang dùng' : 'Đã tắt'}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-800">{selectedTemplate.template_code}</p>
                <p className="text-xs text-slate-600">{selectedTemplate.template_name}</p>
                {selectedTemplate.description && <p className="text-[11px] text-slate-400 mt-0.5">{selectedTemplate.description}</p>}
              </div>

              <div className="flex gap-2">
                <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-sm min-w-[88px] text-center">
                  <p className="text-lg font-bold text-slate-800">{templateStepsCount}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Tổng bước</p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-sm min-w-[88px] text-center">
                  <p className="text-lg font-bold text-slate-800">{phaseStats.length}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Giai đoạn</p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-sm min-w-[88px] text-center">
                  <p className="text-lg font-bold text-slate-800">{steps.filter((s) => s.parent_step_id).length}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Bước con</p>
                </div>
              </div>
            </div>

            {/* Phase pills */}
            {phaseStats.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {phaseStats.map(([phase, count]) => (
                  <span key={phase} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                    {phase} <span className="opacity-70">({count})</span>
                  </span>
                ))}
              </div>
            )}

            {/* Add step button */}
            {canWrite && (
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">
                    {selectedStepIds.length > 0 ? `Đã chọn ${selectedStepIds.length} bước` : 'Chọn nhiều bước để xóa nhanh'}
                  </span>
                  <button
                    type="button"
                    disabled={selectedStepIds.length === 0 || deletingAnySteps}
                    onClick={() => { void handleDeleteSelectedSteps(); }}
                    className="inline-flex items-center gap-1 h-8 px-3 text-xs font-semibold rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete_sweep</span>
                    {deletingSelectedSteps ? 'Đang xóa...' : `Xóa đã chọn (${selectedStepIds.length})`}
                  </button>
                </div>

                <button
                  type="button"
                  disabled={deletingAnySteps}
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
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add_circle</span>
                  Thêm bước
                </button>
              </div>
            )}

            {/* Steps table */}
            {stepsLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>refresh</span>
                <span className="text-xs">Đang tải bước...</span>
              </div>
            ) : filteredTree.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-slate-500 gap-2">
                <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 36 }}>playlist_add</span>
                <p className="text-sm">{searchTerm ? 'Không tìm thấy bước phù hợp.' : 'Chưa có bước nào. Nhấn "Thêm bước" để bắt đầu.'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[1020px] border-separate border-spacing-0">
                  <thead className="bg-slate-50/90 sticky top-0 z-10">
                    <tr>
                      {canWrite && (
                        <th className="px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 text-center w-10 border-b border-slate-200">
                          <input
                            ref={selectAllStepsRef}
                            type="checkbox"
                            checked={allVisibleStepsSelected}
                            disabled={visibleStepIds.length === 0 || deletingAnySteps}
                            onChange={(e) => toggleSelectAllVisibleSteps(e.target.checked)}
                            aria-label="Chọn tất cả bước hiển thị"
                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30 disabled:cursor-not-allowed"
                          />
                        </th>
                      )}
                      <th className="px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 text-left w-10 border-b border-slate-200">TT</th>
                      <th className="px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 text-left w-44 min-w-[176px] border-b border-slate-200">Giai đoạn</th>
                      <th className="px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 text-left border-b border-slate-200">Trình tự công việc</th>
                      <th className="px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 text-left w-32 border-b border-slate-200">ĐV chủ trì</th>
                      <th className="px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 text-left w-40 border-b border-slate-200">Kết quả dự kiến</th>
                      <th className="px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 text-center w-14 border-b border-slate-200">Ngày</th>
                      <th className="px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 text-center w-12 border-b border-slate-200">Sort</th>
                      {canWrite && (
                        <th className="px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 text-center w-20 border-b border-slate-200">Thao tác</th>
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
                          {canWrite && (
                            <td className="px-2 py-2 text-center align-top">
                              <input
                                type="checkbox"
                                checked={selectedStepIdSet.has(String(s.id))}
                                disabled={deletingAnySteps}
                                onChange={(e) => toggleStepSelection(s.id, e.target.checked)}
                                aria-label={`Chọn bước ${s.step_number}: ${s.step_name}`}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30 disabled:cursor-not-allowed"
                              />
                            </td>
                          )}
                          <td className="px-2 py-2 text-xs text-slate-700 font-mono font-bold">{s.step_number}</td>
                          <td className="px-2 py-2 min-w-[176px]">
                            {s.phase ? (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                                {s.phase}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <p className={`text-xs ${isChild ? 'pl-5 text-slate-600' : 'font-semibold text-slate-800'}`}>
                              {isChild && <span className="text-slate-300 mr-1">└</span>}
                              {s.step_name}
                            </p>
                            {s.step_detail && <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[320px]">{isChild ? <span className="pl-5">{s.step_detail}</span> : s.step_detail}</p>}
                          </td>
                          <td className="px-2 py-2 text-xs text-slate-600">{s.lead_unit || <span className="text-slate-300">—</span>}</td>
                          <td className="px-2 py-2 text-xs text-slate-600 truncate max-w-[152px]">{s.expected_result || <span className="text-slate-300">—</span>}</td>
                          <td className="px-2 py-2 text-xs text-slate-600 text-center">{s.default_duration_days ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-2 py-2 text-xs text-slate-400 text-center">{s.sort_order}</td>
                          {canWrite && (
                            <td className="px-2 py-2 text-center">
                              <div className="flex items-center gap-0.5 justify-center">
                                <button
                                  type="button"
                                  disabled={deletingAnySteps}
                                  onClick={() => {
                                    if (deletingAnySteps) {
                                      return;
                                    }
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
                                  className="p-1 rounded text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Sửa"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={deletingAnySteps}
                                  onClick={() => {
                                    if (deletingAnySteps) return;
                                    const maxNum = steps.reduce((m, st) => Math.max(m, st.step_number ?? 0), 0);
                                    setStepFormMode('ADD');
                                    setEditingStep(null);
                                    setStepForm({
                                      step_number: maxNum + 1,
                                      phase: s.phase || '',
                                      step_name: `${s.step_name} (bản sao)`,
                                      step_detail: s.step_detail || '',
                                      lead_unit: s.lead_unit || '',
                                      support_unit: s.support_unit || '',
                                      expected_result: s.expected_result || '',
                                      default_duration_days: s.default_duration_days != null ? String(s.default_duration_days) : '',
                                      sort_order: String(maxNum + 1),
                                      parent_step_id: s.parent_step_id != null ? String(s.parent_step_id) : '',
                                    });
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-secondary hover:bg-secondary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Sao chép để tạo mới"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>content_copy</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={deletingAnySteps}
                                  onClick={async () => {
                                    if (deletingAnySteps) return;
                                    if (!confirm(`Xoá bước "${s.step_name}"?`)) return;
                                    setDeletingSingleStepId(String(s.id));
                                    try {
                                      const templateId = selectedTemplate!.id;
                                      await deleteProcedureTemplateStep(templateId, s.id);
                                      await loadSteps(templateId);
                                    } catch (err: unknown) {
                                      const msg = err instanceof Error ? err.message : 'Lỗi xoá bước';
                                      useToastStore.getState().addToast('error', 'Không thể xoá bước', msg);
                                    } finally {
                                      setDeletingSingleStepId(null);
                                    }
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Xoá"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                                    {deletingSingleStepId === String(s.id) ? 'hourglass_top' : 'delete'}
                                  </span>
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

      {showImportModal ? (
        <ImportModal
          title={`Nhập dữ liệu bước thủ tục${selectedTemplate ? ` - ${selectedTemplate.template_name}` : ''}`}
          moduleKey={PROCEDURE_TEMPLATE_IMPORT_MODULE_KEY}
          onClose={() => {
            if (!isImporting) {
              setShowImportModal(false);
            }
          }}
          onSave={handleSaveImportedSteps}
          isLoading={isImporting}
          loadingText="Đang nhập bước thủ tục..."
        />
      ) : null}

      {/* ── Template edit modal ──────────────────────────────────────── */}
      {editingTemplate !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setEditingTemplate(null)} />
          <div className="relative w-full max-w-md bg-white rounded-lg shadow-2xl p-4 flex flex-col gap-3">
            <h3 className="text-sm font-bold text-slate-800">
              {editingTemplate.id ? 'Sửa mẫu thủ tục' : 'Thêm mẫu thủ tục'}
            </h3>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700">Mã template <span className="text-red-500">*</span></label>
              <input
                value={templateForm.template_code}
                onChange={(e) => setTemplateForm((p) => ({ ...p, template_code: e.target.value.toUpperCase() }))}
                placeholder="VD: THUE_DICH_VU_DACTHU"
                className="h-8 w-full px-3 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none font-mono"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700">Tên mẫu <span className="text-red-500">*</span></label>
              <input
                value={templateForm.template_name}
                onChange={(e) => setTemplateForm((p) => ({ ...p, template_name: e.target.value }))}
                placeholder="Thủ tục dự án thuê dịch vụ CNTT đặc thù"
                className="h-8 w-full px-3 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700">Mô tả</label>
              <textarea
                value={templateForm.description}
                onChange={(e) => setTemplateForm((p) => ({ ...p, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-1.5 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none resize-y"
              />
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={templateForm.is_active}
                onChange={(e) => setTemplateForm((p) => ({ ...p, is_active: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
              />
              <span className="text-xs font-medium text-slate-700">Đang sử dụng</span>
            </label>

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingTemplate(null)}
                className="flex-1 h-8 rounded border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
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
                className="flex-1 h-8 rounded bg-primary text-white text-xs font-semibold hover:bg-deep-teal transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
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
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-800">{stepFormMode === 'ADD' ? 'Thêm bước mới' : 'Sửa bước'}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{selectedTemplate.template_code} — {selectedTemplate.template_name}</p>
              </div>
              <button type="button" onClick={() => setStepFormMode(null)} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700">Số TT <span className="text-red-500">*</span></label>
                  <input
                    type="number" min={1}
                    value={stepForm.step_number}
                    onChange={(e) => setStepForm((p) => ({ ...p, step_number: Number(e.target.value) }))}
                    className="h-8 px-3 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700">Sort order</label>
                  <input
                    type="number"
                    value={stepForm.sort_order}
                    onChange={(e) => setStepForm((p) => ({ ...p, sort_order: e.target.value }))}
                    className="h-8 px-3 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Giai đoạn (phase)</label>
                <input
                  value={stepForm.phase}
                  onChange={(e) => setStepForm((p) => ({ ...p, phase: e.target.value }))}
                  placeholder="VD: CHUAN_BI, THUC_HIEN, NGHIEM_THU"
                  className="h-8 px-3 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Tên bước <span className="text-red-500">*</span></label>
                <input
                  value={stepForm.step_name}
                  onChange={(e) => setStepForm((p) => ({ ...p, step_name: e.target.value }))}
                  className="h-8 px-3 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Chi tiết</label>
                <textarea
                  value={stepForm.step_detail}
                  onChange={(e) => setStepForm((p) => ({ ...p, step_detail: e.target.value }))}
                  rows={2}
                  className="px-3 py-1.5 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none resize-y"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700">ĐV chủ trì</label>
                  <input
                    value={stepForm.lead_unit}
                    onChange={(e) => setStepForm((p) => ({ ...p, lead_unit: e.target.value }))}
                    className="h-8 px-3 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700">ĐV hỗ trợ</label>
                  <input
                    value={stepForm.support_unit}
                    onChange={(e) => setStepForm((p) => ({ ...p, support_unit: e.target.value }))}
                    className="h-8 px-3 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Kết quả dự kiến</label>
                <input
                  value={stepForm.expected_result}
                  onChange={(e) => setStepForm((p) => ({ ...p, expected_result: e.target.value }))}
                  className="h-8 px-3 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700">Thời gian (ngày)</label>
                  <input
                    type="number" min={0}
                    value={stepForm.default_duration_days}
                    onChange={(e) => setStepForm((p) => ({ ...p, default_duration_days: e.target.value }))}
                    className="h-8 px-3 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700">Bước cha</label>
                  <select
                    value={stepForm.parent_step_id}
                    onChange={(e) => setStepForm((p) => ({ ...p, parent_step_id: e.target.value }))}
                    className="h-8 px-3 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none bg-white"
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

              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</p>}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex gap-2">
              <button
                type="button"
                onClick={() => setStepFormMode(null)}
                className="flex-1 h-8 rounded border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
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

                    await loadSteps(selectedTemplate!.id);
                    setStepFormMode(null);
                    setEditingStep(null);
                  } catch (err: unknown) {
                    setError(err instanceof Error ? err.message : 'Lỗi lưu bước');
                  } finally {
                    setSaving(false);
                  }
                }}
                className="flex-1 h-8 rounded bg-primary text-white text-xs font-semibold hover:bg-deep-teal transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
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
