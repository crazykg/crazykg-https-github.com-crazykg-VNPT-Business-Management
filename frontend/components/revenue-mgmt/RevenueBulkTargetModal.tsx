import { type ClipboardEvent, type KeyboardEvent, useMemo, useRef, useState } from 'react';
import { fetchRevenueTargetSuggestion } from '../../services/v5Api';
import { useBulkSetRevenueTargets } from '../../shared/hooks/useRevenue';
import { useToastStore } from '../../shared/stores/toastStore';
import type {
  Department,
  RevenuePeriodType,
  RevenueSuggestion,
  RevenueSuggestionPreview,
  RevenueSuggestionPreviewContractSource,
  RevenueTargetType,
} from '../../types';
import {
  formatCompactCurrencyVnd,
  formatRevenueTargetTypeLabel,
} from '../../utils/revenueDisplay';
import {
  formatVietnameseCurrencyInput,
  formatVietnameseCurrencyValue,
  formatSignedVietnameseCurrencyValue,
  parseVietnameseCurrencyInput,
  sanitizeVietnameseCurrencyDraft,
} from '../../utils/vietnameseCurrency';
import { SearchableMultiSelect } from '../SearchableMultiSelect';
import { RevenueSuggestionPreviewModal } from './RevenueSuggestionPreviewModal';

interface Props {
  year: number;
  departments: Department[];
  defaultPeriodType?: RevenuePeriodType;
  defaultDeptIds?: number[];
  defaultTargetType?: RevenueTargetType;
  onClose: () => void;
  onSaved: () => void;
}

type PeriodRow = { period_key: string; label: string };

type SuggestionPreviewState = {
  preview: RevenueSuggestionPreview;
  selectedProjectIds: number[];
  selectedContractKeys: string[];
};

type ConfirmedSelectionSummary = {
  projectCount: number;
  contractCount: number;
  total: number;
};

const PERIOD_TYPE_OPTIONS: Array<{ value: RevenuePeriodType; label: string }> = [
  { value: 'MONTHLY', label: 'Tháng' },
  { value: 'QUARTERLY', label: 'Quý' },
  { value: 'YEARLY', label: 'Năm' },
];

const TARGET_TYPE_OPTIONS: RevenueTargetType[] = ['TOTAL', 'NEW_CONTRACT', 'RENEWAL', 'RECURRING'];

function buildPeriodRows(periodType: RevenuePeriodType, year: number): PeriodRow[] {
  if (periodType === 'MONTHLY') {
    const monthNames = [
      'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
      'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
      'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
    ];
    return monthNames.map((label, index) => ({
      period_key: `${year}-${String(index + 1).padStart(2, '0')}`,
      label,
    }));
  }

  if (periodType === 'QUARTERLY') {
    return [1, 2, 3, 4].map((quarter) => ({
      period_key: `${year}-Q${quarter}`,
      label: `Quý ${quarter}`,
    }));
  }

  return [{ period_key: String(year), label: `Năm ${year}` }];
}

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const buildContractSourceKey = (source: RevenueSuggestionPreviewContractSource): string =>
  [
    source.contract_id,
    source.period_key ?? '',
    source.expected_date ?? '',
    source.outstanding_amount,
  ].join(':');

const buildScopeLabel = (selectedDeptIds: number[], departments: Department[]): string => {
  if (selectedDeptIds.includes(0)) {
    return 'Toàn công ty';
  }

  if (selectedDeptIds.length === 0) {
    return 'Chưa chọn đơn vị';
  }

  if (selectedDeptIds.length === 1) {
    return departments.find((department) => Number(department.id) === selectedDeptIds[0])?.dept_name || '1 đơn vị';
  }

  return `${selectedDeptIds.length} đơn vị`;
};

const buildSuggestionsFromPreview = (
  preview: RevenueSuggestionPreview,
  periodRows: PeriodRow[],
  selectedProjectIds: number[],
  selectedContractKeys: string[],
): RevenueSuggestion[] => {
  const periodKeys = new Set(periodRows.map((row) => row.period_key));
  const periodData = new Map<string, RevenueSuggestion>();
  const projectIdsByPeriod = new Map<string, Set<number>>();
  const contractIdsByPeriod = new Map<string, Set<number>>();

  const ensurePeriod = (periodKey: string): RevenueSuggestion => {
    const existing = periodData.get(periodKey);
    if (existing) {
      return existing;
    }

    const next: RevenueSuggestion = {
      period_key: periodKey,
      contract_amount: 0,
      opportunity_amount: 0,
      suggested_total: 0,
      contract_count: 0,
      opportunity_count: 0,
    };
    periodData.set(periodKey, next);
    return next;
  };

  const selectedProjectSet = new Set(selectedProjectIds);
  preview.project_sources.forEach((project) => {
    if (!selectedProjectSet.has(project.project_id)) {
      return;
    }

    const seenPeriods = new Set<string>();
    project.periods.forEach((period) => {
      if (!period.period_key || !periodKeys.has(period.period_key)) {
        return;
      }

      const row = ensurePeriod(period.period_key);
      row.opportunity_amount = roundMoney(row.opportunity_amount + Number(period.expected_amount || 0));
      seenPeriods.add(period.period_key);
    });

    seenPeriods.forEach((periodKey) => {
      if (!projectIdsByPeriod.has(periodKey)) {
        projectIdsByPeriod.set(periodKey, new Set<number>());
      }
      projectIdsByPeriod.get(periodKey)?.add(project.project_id);
    });
  });

  const selectedContractSet = new Set(selectedContractKeys);
  preview.contract_sources.forEach((contract) => {
    const contractKey = buildContractSourceKey(contract);
    if (!selectedContractSet.has(contractKey) || !contract.period_key || !periodKeys.has(contract.period_key)) {
      return;
    }

    const row = ensurePeriod(contract.period_key);
    row.contract_amount = roundMoney(row.contract_amount + Number(contract.outstanding_amount || 0));

    if (!contractIdsByPeriod.has(contract.period_key)) {
      contractIdsByPeriod.set(contract.period_key, new Set<number>());
    }
    contractIdsByPeriod.get(contract.period_key)?.add(contract.contract_id);
  });

  periodData.forEach((row, periodKey) => {
    row.contract_count = contractIdsByPeriod.get(periodKey)?.size ?? 0;
    row.opportunity_count = projectIdsByPeriod.get(periodKey)?.size ?? 0;
    row.suggested_total = roundMoney(row.contract_amount + row.opportunity_amount);
  });

  return periodRows
    .map((row) => periodData.get(row.period_key))
    .filter((row): row is RevenueSuggestion => Boolean(row && row.suggested_total > 0));
};

const SummaryCard = ({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper?: string;
  tone: 'slate' | 'emerald' | 'amber';
}) => {
  const toneClasses = {
    slate: { container: 'border-slate-200 bg-surface-low', value: 'text-deep-teal' },
    emerald: { container: 'border-emerald-200 bg-emerald-50', value: 'text-emerald-800' },
    amber: { container: 'border-amber-200 bg-amber-50', value: 'text-tertiary' },
  };

  return (
    <div className={`rounded-lg border p-3 ${toneClasses[tone].container}`}>
      <p className="text-[11px] font-semibold text-neutral">{label}</p>
      <p className={`mt-1 text-xl font-black leading-tight ${toneClasses[tone].value}`}>{value}</p>
      {helper ? <p className="mt-0.5 text-[10px] text-slate-400">{helper}</p> : null}
    </div>
  );
};

export function RevenueBulkTargetModal({
  year,
  departments,
  defaultPeriodType = 'MONTHLY',
  defaultDeptIds = [0],
  defaultTargetType = 'TOTAL',
  onClose,
  onSaved,
}: Props) {
  const addToast = useToastStore((state) => state.addToast);
  const bulkSetRevenueTargetsMutation = useBulkSetRevenueTargets();
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [periodType, setPeriodType] = useState<RevenuePeriodType>(defaultPeriodType);
  const [selectedDeptIds, setSelectedDeptIds] = useState<number[]>(defaultDeptIds);
  const [targetType, setTargetType] = useState<RevenueTargetType>(defaultTargetType);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [quickFillDraft, setQuickFillDraft] = useState('');
  const [suggestions, setSuggestions] = useState<RevenueSuggestion[]>([]);
  const [previewState, setPreviewState] = useState<SuggestionPreviewState | null>(null);
  const [confirmedSelectionSummary, setConfirmedSelectionSummary] = useState<ConfirmedSelectionSummary | null>(null);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periodRows = useMemo(() => buildPeriodRows(periodType, year), [periodType, year]);
  const departmentOptions = useMemo(
    () => [
      {
        value: '0',
        label: 'Toàn công ty',
        searchText: 'toan cong ty tat ca don vi',
      },
      ...departments.map((department) => ({
        value: String(department.id),
        label: department.dept_name,
        searchText: department.dept_name,
      })),
    ],
    [departments]
  );
  const selectedDeptValues = useMemo(
    () => selectedDeptIds.map((value) => String(value)),
    [selectedDeptIds]
  );
  const suggestionMap = useMemo(
    () => new Map(suggestions.map((suggestion) => [suggestion.period_key, suggestion])),
    [suggestions]
  );
  const scopeLabel = useMemo(
    () => buildScopeLabel(selectedDeptIds, departments),
    [selectedDeptIds, departments]
  );

  const enteredTotal = useMemo(
    () => roundMoney(periodRows.reduce((sum, row) => sum + parseVietnameseCurrencyInput(amounts[row.period_key] ?? ''), 0)),
    [amounts, periodRows]
  );
  const suggestedTotal = useMemo(
    () => roundMoney(suggestions.reduce((sum, suggestion) => sum + suggestion.suggested_total, 0)),
    [suggestions]
  );
  const deltaTotal = roundMoney(enteredTotal - suggestedTotal);

  const selectedPreviewProjectTotal = useMemo(() => {
    if (!previewState) {
      return 0;
    }

    const selectedIds = new Set(previewState.selectedProjectIds);
    return roundMoney(
      previewState.preview.project_sources.reduce(
        (sum, project) => sum + (selectedIds.has(project.project_id) ? Number(project.total_amount || 0) : 0),
        0,
      )
    );
  }, [previewState]);

  const selectedPreviewContractTotal = useMemo(() => {
    if (!previewState) {
      return 0;
    }

    const selectedKeys = new Set(previewState.selectedContractKeys);
    return roundMoney(
      previewState.preview.contract_sources.reduce((sum, contract) => (
        sum + (selectedKeys.has(buildContractSourceKey(contract)) ? Number(contract.outstanding_amount || 0) : 0)
      ), 0)
    );
  }, [previewState]);

  const resetSuggestionState = () => {
    setSuggestions([]);
    setPreviewState(null);
    setConfirmedSelectionSummary(null);
  };

  const handleDeptSelectionChange = (values: string[]) => {
    const normalizedValues = Array.from(new Set(values.map((value) => String(value))));
    const nextDeptIds = normalizedValues.includes('0')
      ? [0]
      : normalizedValues
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);

    setSelectedDeptIds(nextDeptIds);
    resetSuggestionState();
    setError(null);
  };

  const handlePeriodTypeChange = (nextPeriodType: RevenuePeriodType) => {
    setPeriodType(nextPeriodType);
    setAmounts({});
    setQuickFillDraft('');
    resetSuggestionState();
    setError(null);
  };

  const handleAmountChange = (periodKey: string, draft: string) => {
    setAmounts((previous) => ({
      ...previous,
      [periodKey]: sanitizeVietnameseCurrencyDraft(draft),
    }));
  };

  const handleAmountBlur = (periodKey: string) => {
    setAmounts((previous) => ({
      ...previous,
      [periodKey]: sanitizeVietnameseCurrencyDraft(previous[periodKey] ?? ''),
    }));
  };

  const applySuggestionValues = (nextSuggestions: RevenueSuggestion[]) => {
    const nextSuggestionMap = new Map(nextSuggestions.map((suggestion) => [suggestion.period_key, suggestion]));
    const nextAmounts: Record<string, string> = {};

    periodRows.forEach((row) => {
      const amount = nextSuggestionMap.get(row.period_key)?.suggested_total ?? 0;
      nextAmounts[row.period_key] = amount > 0 ? formatVietnameseCurrencyInput(amount) : '';
    });

    setAmounts(nextAmounts);
  };

  const handleApplyAllPeriods = () => {
    const normalized = sanitizeVietnameseCurrencyDraft(quickFillDraft);
    setQuickFillDraft(normalized);

    const nextAmounts: Record<string, string> = {};
    periodRows.forEach((row) => {
      nextAmounts[row.period_key] = normalized;
    });

    setAmounts(nextAmounts);
  };

  const handleApplyAllSuggestions = () => {
    if (suggestions.length === 0) {
      return;
    }

    applySuggestionValues(suggestions);
    addToast('success', 'Đã áp dụng gợi ý', `Đã điền ${formatVietnameseCurrencyValue(suggestedTotal)} vào bảng kế hoạch.`);
  };

  const handleClearAll = () => {
    setAmounts({});
    setQuickFillDraft('');
  };

  const handleSuggestAll = async () => {
    if (selectedDeptIds.length === 0) {
      setError('Vui lòng chọn ít nhất một đơn vị trước khi đề xuất dữ liệu.');
      return;
    }

    const deptId = selectedDeptIds.length === 1 ? selectedDeptIds[0] : 0;
    setIsSuggestLoading(true);
    setError(null);

    try {
      const response = await fetchRevenueTargetSuggestion({
        year,
        period_type: periodType,
        dept_id: deptId,
        include_breakdown: true,
      });

      if (!response.preview) {
        setSuggestions(response.data);
        applySuggestionValues(response.data);
        setConfirmedSelectionSummary({
          projectCount: 0,
          contractCount: 0,
          total: roundMoney(response.meta.total_suggested),
        });
        addToast('success', 'Đã gợi ý', `Tổng gợi ý: ${formatVietnameseCurrencyValue(response.meta.total_suggested)}`);
        return;
      }

      const projectIds = response.preview.project_sources.map((project) => project.project_id);
      const contractKeys = response.preview.contract_sources.map((contract) => buildContractSourceKey(contract));

      if (projectIds.length === 0 && contractKeys.length === 0 && response.meta.total_suggested === 0) {
        resetSuggestionState();
        addToast('info', 'Không có gợi ý', 'Không tìm thấy dữ liệu phân kỳ hoặc dòng tiền hợp đồng để đề xuất.');
        return;
      }

      setPreviewState({
        preview: response.preview,
        selectedProjectIds: projectIds,
        selectedContractKeys: contractKeys,
      });
    } catch (err) {
      setError((err as Error).message);
      addToast('error', 'Lỗi', (err as Error).message);
    } finally {
      setIsSuggestLoading(false);
    }
  };

  const handleTogglePreviewProject = (projectId: number) => {
    setPreviewState((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        selectedProjectIds: previous.selectedProjectIds.includes(projectId)
          ? previous.selectedProjectIds.filter((value) => value !== projectId)
          : [...previous.selectedProjectIds, projectId],
      };
    });
  };

  const handleToggleAllPreviewProjects = (checked: boolean) => {
    setPreviewState((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        selectedProjectIds: checked
          ? previous.preview.project_sources.map((project) => project.project_id)
          : [],
      };
    });
  };

  const handleTogglePreviewContract = (sourceKey: string) => {
    setPreviewState((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        selectedContractKeys: previous.selectedContractKeys.includes(sourceKey)
          ? previous.selectedContractKeys.filter((value) => value !== sourceKey)
          : [...previous.selectedContractKeys, sourceKey],
      };
    });
  };

  const handleToggleAllPreviewContracts = (checked: boolean) => {
    setPreviewState((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        selectedContractKeys: checked
          ? previous.preview.contract_sources.map((contract) => buildContractSourceKey(contract))
          : [],
      };
    });
  };

  const handleConfirmPreview = () => {
    if (!previewState) {
      return;
    }

    const nextSuggestions = buildSuggestionsFromPreview(
      previewState.preview,
      periodRows,
      previewState.selectedProjectIds,
      previewState.selectedContractKeys,
    );

    setSuggestions(nextSuggestions);
    applySuggestionValues(nextSuggestions);

    const total = roundMoney(nextSuggestions.reduce((sum, suggestion) => sum + suggestion.suggested_total, 0));
    setConfirmedSelectionSummary({
      projectCount: previewState.selectedProjectIds.length,
      contractCount: previewState.selectedContractKeys.length,
      total,
    });
    setPreviewState(null);

    if (total === 0) {
      addToast('info', 'Đã xác nhận nguồn dữ liệu', 'Bạn chưa chọn nguồn nào để áp dụng vào bảng kế hoạch.');
      return;
    }

    addToast(
      'success',
      'Đã xác nhận gợi ý',
      `Áp dụng ${previewState.selectedProjectIds.length} dự án và ${previewState.selectedContractKeys.length} dòng hợp đồng vào bảng kế hoạch.`,
    );
  };

  const handleAmountKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    const nextRow = periodRows[index + 1];
    if (nextRow) {
      inputRefs.current[nextRow.period_key]?.focus();
      inputRefs.current[nextRow.period_key]?.select();
    }
  };

  const handleAmountPaste = (startIndex: number, event: ClipboardEvent<HTMLInputElement>) => {
    const rawText = event.clipboardData.getData('text');
    const tokens = rawText
      .replace(/\t/g, '\n')
      .split(/\r?\n/)
      .map((value) => sanitizeVietnameseCurrencyDraft(value))
      .filter((value) => value !== '');

    if (tokens.length <= 1) {
      return;
    }

    event.preventDefault();
    setAmounts((previous) => {
      const next = { ...previous };
      tokens.forEach((token, offset) => {
        const row = periodRows[startIndex + offset];
        if (!row) {
          return;
        }
        next[row.period_key] = token;
      });
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedDeptIds.length === 0) {
      setError('Vui lòng chọn ít nhất một đơn vị.');
      return;
    }

    const targets = periodRows
      .filter((row) => (amounts[row.period_key] ?? '').trim() !== '')
      .map((row) => ({
        period_key: row.period_key,
        amount: roundMoney(parseVietnameseCurrencyInput(amounts[row.period_key] ?? '')),
      }))
      .filter((target) => Number.isFinite(target.amount) && target.amount >= 0);

    if (targets.length === 0) {
      setError('Vui lòng nhập ít nhất một số tiền kế hoạch.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await bulkSetRevenueTargetsMutation.mutateAsync({
        year,
        period_type: periodType,
        target_type: targetType,
        dept_ids: selectedDeptIds,
        targets,
      });

      addToast(
        'success',
        'Đã lưu kế hoạch',
        `Tạo mới: ${response.data.created} · Cập nhật: ${response.data.updated}`,
      );
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-5xl items-start justify-center">
          <div className="relative flex w-full max-h-[94vh] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>trending_up</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h2 className="text-sm font-bold text-deep-teal leading-tight">
                      Nhập kế hoạch doanh thu hàng loạt
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      Năm {year}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-500">
                      {scopeLabel}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 rounded transition-colors text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className="space-y-3">
                {/* Config */}
                <section className="rounded-lg border border-slate-200 bg-surface-low p-3">
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-neutral">Loại kỳ</p>
                        <div className="mt-1 inline-flex rounded bg-white p-0.5 ring-1 ring-slate-200">
                          {PERIOD_TYPE_OPTIONS.map((option) => {
                            const active = periodType === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => handlePeriodTypeChange(option.value)}
                                className={`rounded px-2.5 py-1 text-[11px] font-semibold transition ${
                                  active
                                    ? 'bg-primary text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label htmlFor="revenue-bulk-target-type" className="text-xs font-semibold text-neutral">
                          Chỉ tiêu
                        </label>
                        <select
                          id="revenue-bulk-target-type"
                          aria-label="Nhóm kế hoạch"
                          className="mt-1 w-full h-8 px-3 rounded border border-slate-300 bg-white text-xs text-on-surface outline-none transition focus:ring-1 focus:ring-primary/30 focus:border-primary"
                          value={targetType}
                          onChange={(event) => setTargetType(event.target.value as RevenueTargetType)}
                        >
                          {TARGET_TYPE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {formatRevenueTargetTypeLabel(option)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="xl:justify-self-end xl:w-full xl:max-w-[360px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold text-neutral">Đơn vị áp dụng</p>
                        {selectedDeptIds.length > 0 ? (
                          <span className="inline-flex max-w-full items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">
                            <span className="line-clamp-1">{scopeLabel}</span>
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        Có thể chọn nhiều đơn vị hoặc chọn Toàn công ty.
                      </p>
                      <SearchableMultiSelect
                        values={selectedDeptValues}
                        options={departmentOptions}
                        onChange={handleDeptSelectionChange}
                        ariaLabel="Đơn vị áp dụng"
                        placeholder="Chọn đơn vị áp dụng"
                        searchPlaceholder="Tìm đơn vị..."
                        className="mt-1.5 min-w-0"
                        triggerClassName="!h-8 !min-h-0 rounded border-slate-300 px-3 !text-xs"
                        dropdownClassName="rounded"
                        showSelectedChips={false}
                        selectedSummaryFormatter={() => scopeLabel}
                      />
                    </div>
                  </div>
                </section>

                {/* Quick fill + actions */}
                <section className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                    <div>
                      <p className="text-xs font-semibold text-neutral">Điền tất cả kỳ</p>
                      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          aria-label="Điền tất cả kỳ"
                          type="text"
                          inputMode="decimal"
                          className="h-8 px-3 rounded border border-slate-300 text-right text-xs font-medium text-on-surface outline-none transition focus:ring-1 focus:ring-primary/30 focus:border-primary sm:max-w-xs"
                          placeholder="Ví dụ: 1.234.567,89"
                          value={quickFillDraft}
                          onChange={(event) => setQuickFillDraft(sanitizeVietnameseCurrencyDraft(event.target.value))}
                          onBlur={() => setQuickFillDraft((previous) => sanitizeVietnameseCurrencyDraft(previous))}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              handleApplyAllPeriods();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleApplyAllPeriods}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        >
                          Áp dụng
                        </button>
                        <span className="text-[11px] text-slate-400">
                          Chuẩn: <span className="font-semibold text-on-surface-variant">1.234.567,89</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                      <button
                        type="button"
                        disabled={isSuggestLoading}
                        onClick={() => void handleSuggestAll()}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-amber-200 bg-amber-50 text-tertiary hover:bg-amber-100 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 15 }}>lightbulb</span>
                        {isSuggestLoading ? 'Đang tải dữ liệu...' : 'Đề xuất từ dữ liệu'}
                      </button>
                      <button
                        type="button"
                        disabled={suggestions.length === 0}
                        onClick={handleApplyAllSuggestions}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-secondary/30 bg-secondary/10 text-deep-teal hover:bg-secondary/20 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>playlist_add_check</span>
                        Áp dụng tất cả gợi ý
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAll}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>ink_eraser</span>
                        Xóa trắng
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 rounded border border-dashed border-slate-200 bg-surface-low px-3 py-2 text-xs text-slate-500">
                    {confirmedSelectionSummary ? (
                      <span>
                        Nguồn đã xác nhận: <span className="font-semibold text-on-surface">{confirmedSelectionSummary.projectCount}</span> dự án,
                        {' '}
                        <span className="font-semibold text-on-surface">{confirmedSelectionSummary.contractCount}</span> dòng hợp đồng,
                        {' '}
                        tổng <span className="font-semibold text-on-surface">{formatVietnameseCurrencyValue(confirmedSelectionSummary.total)}</span>.
                      </span>
                    ) : (
                      <span>
                        Chưa có bộ gợi ý nào được xác nhận. Bấm <span className="font-semibold text-on-surface">Đề xuất từ dữ liệu</span> để kiểm tra nguồn trước khi điền.
                      </span>
                    )}
                  </div>
                </section>

                {/* Summary cards */}
                <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <SummaryCard
                    label="Tổng kế hoạch nhập"
                    value={formatVietnameseCurrencyValue(enteredTotal)}
                    helper={`${periodRows.filter((row) => (amounts[row.period_key] ?? '').trim() !== '').length}/${periodRows.length} kỳ đã có dữ liệu`}
                    tone="slate"
                  />
                  <SummaryCard
                    label="Tổng gợi ý đã xác nhận"
                    value={formatVietnameseCurrencyValue(suggestedTotal)}
                    helper={suggestions.length > 0 ? `${suggestions.length} kỳ có gợi ý` : 'Chưa có gợi ý nào được áp dụng'}
                    tone="emerald"
                  />
                  <SummaryCard
                    label="Chênh lệch"
                    value={formatVietnameseCurrencyValue(deltaTotal)}
                    helper={deltaTotal === 0 ? 'Kế hoạch đang khớp với gợi ý' : 'So sánh giữa số nhập và gợi ý đã xác nhận'}
                    tone="amber"
                  />
                </section>

                {/* Data entry table */}
                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-700">Bảng nhập kế hoạch</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Dùng Enter để nhảy sang kỳ kế tiếp. Bạn cũng có thể dán nhiều dòng số liên tiếp từ Excel vào cột kế hoạch.
                        </p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-500 shrink-0">
                        Định dạng: 1.234.567,89
                      </span>
                    </div>
                  </div>

                  <div className="max-h-[360px] overflow-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-xs">
                      <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                        <tr className="text-left">
                          <th className="px-4 py-2 text-[11px] font-semibold text-neutral">Kỳ</th>
                          <th className="px-4 py-2 text-[11px] font-semibold text-neutral">Số tiền kế hoạch (VND)</th>
                          <th className="px-4 py-2 text-[11px] font-semibold text-neutral text-right">Gợi ý</th>
                          <th className="px-4 py-2 text-[11px] font-semibold text-neutral text-right">Chênh lệch</th>
                          <th className="px-4 py-2 text-[11px] font-semibold text-neutral">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {periodRows.map((row, index) => {
                          const suggestion = suggestionMap.get(row.period_key);
                          const enteredAmount = parseVietnameseCurrencyInput(amounts[row.period_key] ?? '');
                          const rowDelta = roundMoney(enteredAmount - Number(suggestion?.suggested_total ?? 0));
                          const hasValue = (amounts[row.period_key] ?? '').trim() !== '';
                          const hasSuggestion = Boolean(suggestion && suggestion.suggested_total > 0);
                          const status = !hasSuggestion
                            ? hasValue
                              ? { label: 'Nhập tay', className: 'bg-slate-200 text-slate-500' }
                              : { label: 'Trống', className: 'bg-slate-100 text-slate-400' }
                            : !hasValue
                              ? { label: 'Có gợi ý', className: 'bg-amber-100 text-amber-700' }
                              : rowDelta === 0
                                ? { label: 'Khớp gợi ý', className: 'bg-emerald-100 text-emerald-700' }
                                : rowDelta > 0
                                  ? { label: 'Tăng so với gợi ý', className: 'bg-secondary/10 text-deep-teal' }
                                  : { label: 'Giảm so với gợi ý', className: 'bg-tertiary-fixed text-tertiary' };

                          return (
                            <tr key={row.period_key} className="bg-surface-container-lowest transition hover:bg-surface-variant">
                              <td className="px-4 py-2.5 text-xs font-medium text-on-surface">{row.label}</td>
                              <td className="px-4 py-2.5">
                                <input
                                  ref={(element) => {
                                    inputRefs.current[row.period_key] = element;
                                  }}
                                  aria-label={`Kế hoạch ${row.label}`}
                                  type="text"
                                  inputMode="decimal"
                                  className="w-full h-8 px-3 rounded border border-slate-300 text-right text-xs font-medium text-on-surface outline-none transition focus:ring-1 focus:ring-primary/30 focus:border-primary"
                                  placeholder="0"
                                  value={amounts[row.period_key] ?? ''}
                                  onChange={(event) => handleAmountChange(row.period_key, event.target.value)}
                                  onBlur={() => handleAmountBlur(row.period_key)}
                                  onKeyDown={(event) => handleAmountKeyDown(index, event)}
                                  onPaste={(event) => handleAmountPaste(index, event)}
                                />
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                {hasSuggestion ? (
                                  <button
                                    type="button"
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                                    title={`HĐ: ${formatCompactCurrencyVnd(suggestion?.contract_amount)} · Dự án: ${formatCompactCurrencyVnd(suggestion?.opportunity_amount)}`}
                                    onClick={() => handleAmountChange(row.period_key, formatVietnameseCurrencyInput(suggestion?.suggested_total ?? 0))}
                                  >
                                    {formatVietnameseCurrencyValue(suggestion?.suggested_total ?? 0)}
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-300">--</span>
                                )}
                              </td>
                              <td className={`px-4 py-2.5 text-right text-xs font-medium ${rowDelta === 0 ? 'text-slate-400' : rowDelta > 0 ? 'text-success' : 'text-tertiary'}`}>
                                {hasSuggestion
                                  ? formatSignedVietnameseCurrencyValue(rowDelta)
                                  : <span className="text-[10px] text-slate-300">--</span>}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.className}`}>
                                  {status.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {error ? (
                  <div className="rounded border border-error/20 bg-error/5 px-3 py-2 text-xs text-error">
                    {error}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 flex-shrink-0 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Hệ thống sẽ lưu kế hoạch cho <span className="font-semibold text-on-surface">{scopeLabel}</span> với chỉ tiêu
                {' '}
                <span className="font-semibold text-on-surface">{formatRevenueTargetTypeLabel(targetType)}</span>.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-colors text-white shadow-sm hover:bg-deep-teal disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#004481,#005BAA)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
                  {isSubmitting ? 'Đang lưu...' : 'Lưu kế hoạch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {previewState ? (
        <RevenueSuggestionPreviewModal
          year={year}
          scopeLabel={scopeLabel}
          preview={previewState.preview}
          selectedProjectIds={previewState.selectedProjectIds}
          selectedContractKeys={previewState.selectedContractKeys}
          selectedProjectTotal={selectedPreviewProjectTotal}
          selectedContractTotal={selectedPreviewContractTotal}
          onToggleProject={handleTogglePreviewProject}
          onToggleAllProjects={handleToggleAllPreviewProjects}
          onToggleContract={handleTogglePreviewContract}
          onToggleAllContracts={handleToggleAllPreviewContracts}
          getContractKey={buildContractSourceKey}
          onClose={() => setPreviewState(null)}
          onConfirm={handleConfirmPreview}
        />
      ) : null}
    </>
  );
}
