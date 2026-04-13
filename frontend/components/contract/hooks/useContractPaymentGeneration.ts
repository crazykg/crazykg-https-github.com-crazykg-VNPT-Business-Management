import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  ContractCycleDraftInstallmentInput,
  ContractPaymentAllocationMode,
  GenerateContractPaymentsPayload,
  GenerateContractPaymentsResult,
} from '../../../services/api/contractApi';
import type { Contract, PaymentSchedule } from '../../../types';
import {
  ALLOCATION_MODE_OPTIONS,
  buildCycleDraftInstallments,
  buildCyclePreviewRows,
  buildPaymentMilestoneName,
  buildMilestoneInstallmentDrafts,
  buildMilestonePreviewRows,
  clampPercentage,
  type CycleDraftInstallmentDraft,
  inferAllocationModeFromSchedules,
  type MilestoneInputMode,
  type MilestoneInstallmentDraft,
  type MilestonePreviewRow,
  parseIsoDate,
  resolveContractGenerationStartIso,
  roundMoney,
  todayIsoDate,
} from '../contractPaymentUtils';

type ContractModalTab = 'CONTRACT' | 'PAYMENT';

interface UseContractPaymentGenerationParams {
  type: 'ADD' | 'EDIT';
  activeTab: ContractModalTab;
  contractId?: string | number;
  initialFormData: Partial<Contract>;
  formData: Partial<Contract>;
  schedules: PaymentSchedule[];
  initialProjectInvestmentModeCode: string;
  selectedProjectInvestmentModeCode: string;
  contractValueNumber: number;
  draftItemsCount: number;
  isPaymentLoading: boolean;
  setInlineNotice: Dispatch<SetStateAction<string>>;
  onGenerateSchedules?: (
    contractId: string | number,
    options?: GenerateContractPaymentsPayload
  ) => Promise<GenerateContractPaymentsResult | void>;
}

interface UseContractPaymentGenerationResult {
  isGenerating: boolean;
  allocation: {
    allocationMode: ContractPaymentAllocationMode;
    allocationModeOptions: Array<{ value: ContractPaymentAllocationMode; label: string }>;
    allocationModeLockMessage: string;
    isAllocationModeSelectionDisabled: boolean;
    onAllocationModeChange: (nextMode: ContractPaymentAllocationMode) => void;
  };
  generation: {
    advancePercentage: string;
    retentionPercentage: string;
    installmentCount: string;
    milestoneInputMode: MilestoneInputMode;
    milestoneInstallments: MilestoneInstallmentDraft[];
    generateButtonLockMessage: string;
    isGenerateButtonDisabled: boolean;
    isGenerating: boolean;
    onAdvancePercentageChange: (value: string) => void;
    onRetentionPercentageChange: (value: string) => void;
    onInstallmentCountChange: (value: string) => void;
    onMilestoneInputModeChange: (nextMode: MilestoneInputMode) => void;
    onGenerateSchedules: () => Promise<void>;
    onSyncMilestoneInstallmentsFromAuto: () => void;
    onAddMilestoneInstallment: () => void;
    onMilestoneInstallmentChange: (
      index: number,
      field: keyof MilestoneInstallmentDraft,
      value: string
    ) => void;
    onRemoveMilestoneInstallment: (index: number) => void;
  };
  preview: {
    hasCollectedSchedules: boolean;
    isPreviewDirty: boolean;
    showCyclePreview: boolean;
    cyclePreviewTab: 'PROPOSAL' | 'EDIT';
    cyclePreview: {
      error: string;
      rows: MilestonePreviewRow[];
    };
    cycleDraftRows: CycleDraftInstallmentDraft[];
    cycleDraftError: string;
    cycleDraftTotal: number;
    cycleDraftStatusLabel: string;
    isCycleDraftDirty: boolean;
    onCyclePreviewTabChange: (nextTab: 'PROPOSAL' | 'EDIT') => void;
    onCycleDraftRowChange: (
      index: number,
      field: keyof CycleDraftInstallmentDraft,
      value: string
    ) => void;
    onAddCycleDraftRow: () => void;
    onRemoveCycleDraftRow: (index: number) => void;
    onResetCycleDraftRows: () => void;
    showMilestonePreview: boolean;
    customInstallmentPreviewRows: MilestonePreviewRow[];
    milestonePreview: {
      error: string;
      rows: MilestonePreviewRow[];
    };
    milestoneSummary: {
      installmentCount: number;
      installmentTotal: number;
      overallTotal: number;
      invalidPercentageCount: number;
      invalidDateIndex: number;
    };
  };
}

const DEFAULT_RETENTION_PERCENTAGE = '5';
const DEFAULT_INSTALLMENT_COUNT = '3';
const AUTO_SYNC_INLINE_NOTICE = 'Đã tự đồng bộ lại kỳ thanh toán theo tổng hạng mục hợp đồng.';

const parseDraftExpectedAmount = (value: unknown): number => {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildGeneratePayload = ({
  allocationMode,
  advancePercentage,
  retentionPercentage,
  installmentCount,
  milestoneInputMode,
  normalizedMilestoneInstallments,
  normalizedCycleDraftInstallments,
}: {
  allocationMode: ContractPaymentAllocationMode;
  advancePercentage: string;
  retentionPercentage: string;
  installmentCount: string;
  milestoneInputMode: MilestoneInputMode;
  normalizedMilestoneInstallments: Array<{
    label?: string;
    percentage: number;
    expected_date: string | null;
  }>;
  normalizedCycleDraftInstallments: ContractCycleDraftInstallmentInput[];
}): GenerateContractPaymentsPayload => {
  const parsedAdvancePercentage = Number(advancePercentage);
  const normalizedAdvancePercentage = Number.isFinite(parsedAdvancePercentage)
    ? Math.min(100, Math.max(0, parsedAdvancePercentage))
    : 0;
  const parsedRetentionPercentage = Number(retentionPercentage);
  const normalizedRetentionPercentage = Number.isFinite(parsedRetentionPercentage)
    ? Math.min(100, Math.max(0, parsedRetentionPercentage))
    : 5;
  const parsedInstallmentCount = Number(installmentCount);
  const normalizedInstallmentCount = Number.isFinite(parsedInstallmentCount)
    ? Math.min(50, Math.max(1, Math.round(parsedInstallmentCount)))
    : 3;

  return {
    allocation_mode: allocationMode,
    advance_percentage: allocationMode === 'MILESTONE' ? normalizedAdvancePercentage : undefined,
    retention_percentage: allocationMode === 'MILESTONE' ? normalizedRetentionPercentage : undefined,
    installment_count: allocationMode === 'MILESTONE'
      ? (milestoneInputMode === 'CUSTOM' ? normalizedMilestoneInstallments.length : normalizedInstallmentCount)
      : undefined,
    installments: allocationMode === 'MILESTONE' && milestoneInputMode === 'CUSTOM'
      ? normalizedMilestoneInstallments.map((installment) => ({
          label: installment.label,
          percentage: Number(installment.percentage),
          expected_date: installment.expected_date || null,
        }))
      : undefined,
    draft_installments: allocationMode === 'EVEN'
      ? normalizedCycleDraftInstallments.map((installment) => ({
          label: installment.label,
          expected_date: installment.expected_date,
          expected_amount: installment.expected_amount,
        }))
      : undefined,
  };
};

export const useContractPaymentGeneration = ({
  type,
  activeTab,
  contractId,
  initialFormData,
  formData,
  schedules,
  initialProjectInvestmentModeCode,
  selectedProjectInvestmentModeCode,
  contractValueNumber,
  draftItemsCount,
  isPaymentLoading,
  setInlineNotice,
  onGenerateSchedules,
}: UseContractPaymentGenerationParams): UseContractPaymentGenerationResult => {
  const defaultAllocationMode = inferAllocationModeFromSchedules(schedules, initialProjectInvestmentModeCode) || (
    initialProjectInvestmentModeCode === 'DAU_TU' ? 'MILESTONE' : 'EVEN'
  );
  const defaultAdvancePercentage = defaultAllocationMode === 'MILESTONE' ? '15' : '30';

  const [isGenerating, setIsGenerating] = useState(false);
  const [allocationMode, setAllocationMode] = useState<ContractPaymentAllocationMode>(defaultAllocationMode);
  const [advancePercentage, setAdvancePercentage] = useState<string>(defaultAdvancePercentage);
  const [retentionPercentage, setRetentionPercentage] = useState<string>(DEFAULT_RETENTION_PERCENTAGE);
  const [installmentCount, setInstallmentCount] = useState<string>(DEFAULT_INSTALLMENT_COUNT);
  const [milestoneInputMode, setMilestoneInputMode] = useState<MilestoneInputMode>('AUTO');
  const [milestoneInstallments, setMilestoneInstallments] = useState<MilestoneInstallmentDraft[]>([]);
  const [cyclePreviewTab, setCyclePreviewTab] = useState<'PROPOSAL' | 'EDIT'>('PROPOSAL');
  const [cycleDraftRows, setCycleDraftRows] = useState<CycleDraftInstallmentDraft[]>([]);
  const [isCycleDraftDirty, setIsCycleDraftDirty] = useState<boolean>(false);
  const [previewDirty, setPreviewDirty] = useState<boolean>(true);

  const previewTrackingReadyRef = useRef(false);
  const cyclePreviewTrackingReadyRef = useRef(false);
  const paymentModeHydrationRef = useRef(false);
  const scheduleModeAutoDetectedRef = useRef(false);
  const hasCollectedSchedules = useMemo(
    () => schedules.some((schedule) => {
      const actualPaidAmount = Number(schedule.actual_paid_amount || 0);
      const normalizedStatus = String(schedule.status || '').trim().toUpperCase();
      return actualPaidAmount > 0 || normalizedStatus === 'PAID' || normalizedStatus === 'PARTIAL';
    }),
    [schedules]
  );
  const isInvestmentProject = selectedProjectInvestmentModeCode === 'DAU_TU';
  const allocationModeLockMessage = isInvestmentProject
    ? 'Dự án Đầu tư chỉ hỗ trợ cách phân bổ Tạm ứng + Đợt đầu tư.'
    : '';
  const baseGenerateButtonLockMessage = hasCollectedSchedules
    ? 'Đã có kỳ được xác nhận thu tiền. Không thể sinh lại kỳ thanh toán để tránh lệch dữ liệu thực thu.'
    : '';
  const baseGenerateButtonDisabled = !contractId || !onGenerateSchedules || isGenerating || hasCollectedSchedules;
  const isAllocationModeSelectionDisabled = isInvestmentProject;

  useEffect(() => {
    setAllocationMode(defaultAllocationMode);
    setAdvancePercentage(defaultAdvancePercentage);
    setRetentionPercentage(DEFAULT_RETENTION_PERCENTAGE);
    setInstallmentCount(DEFAULT_INSTALLMENT_COUNT);
    setMilestoneInputMode('AUTO');
    setMilestoneInstallments([]);
    setCyclePreviewTab('PROPOSAL');
    setCycleDraftRows([]);
    setIsCycleDraftDirty(false);
    setPreviewDirty(schedules.length === 0);
    previewTrackingReadyRef.current = false;
    cyclePreviewTrackingReadyRef.current = false;
    paymentModeHydrationRef.current = true;
    scheduleModeAutoDetectedRef.current = false;
  }, [
    defaultAdvancePercentage,
    defaultAllocationMode,
    initialFormData,
    schedules.length,
    type,
  ]);

  useEffect(() => {
    if (type !== 'EDIT' || schedules.length === 0 || scheduleModeAutoDetectedRef.current) {
      return;
    }

    setAllocationMode(defaultAllocationMode);
    setAdvancePercentage(defaultAdvancePercentage);
    setRetentionPercentage(DEFAULT_RETENTION_PERCENTAGE);
    setInstallmentCount(DEFAULT_INSTALLMENT_COUNT);
    scheduleModeAutoDetectedRef.current = true;
  }, [
    defaultAdvancePercentage,
    defaultAllocationMode,
    schedules.length,
    type,
  ]);

  useEffect(() => {
    if (!selectedProjectInvestmentModeCode) {
      return;
    }

    if (paymentModeHydrationRef.current) {
      paymentModeHydrationRef.current = false;
      if (type === 'EDIT' && schedules.length > 0) {
        return;
      }
    }

    if (selectedProjectInvestmentModeCode === 'DAU_TU') {
      setAllocationMode('MILESTONE');
      setAdvancePercentage('15');
      setRetentionPercentage(DEFAULT_RETENTION_PERCENTAGE);
      setInstallmentCount(DEFAULT_INSTALLMENT_COUNT);
      setMilestoneInputMode('AUTO');
      setMilestoneInstallments([]);
      setCyclePreviewTab('PROPOSAL');
      setCycleDraftRows([]);
      setIsCycleDraftDirty(false);
      return;
    }

    setRetentionPercentage(DEFAULT_RETENTION_PERCENTAGE);
    setInstallmentCount(DEFAULT_INSTALLMENT_COUNT);
    setMilestoneInputMode('AUTO');
    setMilestoneInstallments([]);
    setCyclePreviewTab('PROPOSAL');
    if (allocationMode === 'MILESTONE') {
      setAllocationMode('EVEN');
    }
  }, [allocationMode, schedules.length, selectedProjectInvestmentModeCode, type]);

  const allocationModeOptions = useMemo(
    () => (isInvestmentProject
      ? ALLOCATION_MODE_OPTIONS.filter((item) => item.value === 'MILESTONE')
      : ALLOCATION_MODE_OPTIONS.filter((item) => item.value !== 'MILESTONE')),
    [isInvestmentProject]
  );

  const normalizedMilestoneInstallments = useMemo(
    () => milestoneInstallments.map((installment) => ({
      label: String(installment.label || '').trim() || undefined,
      percentage: Number(installment.percentage),
      expected_date: String(installment.expected_date || '').trim() || null,
    })),
    [milestoneInstallments]
  );

  const milestoneSummary = useMemo(() => {
    const advance = clampPercentage(advancePercentage, 15);
    const retention = clampPercentage(retentionPercentage, 5);
    const installmentTotal = roundMoney(normalizedMilestoneInstallments.reduce((sum, installment) => {
      const percentage = Number(installment.percentage);
      return sum + (Number.isFinite(percentage) ? percentage : 0);
    }, 0));

    return {
      installmentCount: normalizedMilestoneInstallments.length,
      installmentTotal,
      overallTotal: roundMoney(advance + retention + installmentTotal),
      invalidPercentageCount: normalizedMilestoneInstallments.filter((installment) => {
        const percentage = Number(installment.percentage);
        return !Number.isFinite(percentage) || percentage <= 0;
      }).length,
      invalidDateIndex: normalizedMilestoneInstallments.findIndex((installment) =>
        Boolean(installment.expected_date) && !parseIsoDate(installment.expected_date)
      ),
    };
  }, [advancePercentage, normalizedMilestoneInstallments, retentionPercentage]);

  useEffect(() => {
    if (activeTab !== 'PAYMENT') {
      return;
    }

    setInlineNotice((currentNotice) => (
      currentNotice === AUTO_SYNC_INLINE_NOTICE
        ? ''
        : currentNotice
    ));
  }, [activeTab, setInlineNotice]);

  const syncMilestoneInstallmentsFromAuto = () => {
    const startIso = resolveContractGenerationStartIso(formData) || todayIsoDate();
    const expiryIso = String(formData.expiry_date || '').trim();
    const endIso = parseIsoDate(expiryIso) ? expiryIso : startIso;
    const safeInstallmentCount = Math.max(1, Math.min(50, Math.round(Number(installmentCount) || 3)));

    setMilestoneInstallments(
      buildMilestoneInstallmentDrafts(
        startIso,
        endIso,
        Number(advancePercentage),
        Number(retentionPercentage),
        safeInstallmentCount
      )
    );
  };

  const handleMilestoneInputModeChange = (nextMode: MilestoneInputMode) => {
    if (nextMode === 'CUSTOM' && milestoneInstallments.length === 0) {
      syncMilestoneInstallmentsFromAuto();
    }
    setMilestoneInputMode(nextMode);
  };

  const handleMilestoneInstallmentChange = (
    index: number,
    field: keyof MilestoneInstallmentDraft,
    value: string
  ) => {
    setMilestoneInstallments((prev) => prev.map((installment, installmentIndex) =>
      installmentIndex === index
        ? { ...installment, [field]: value }
        : installment
    ));
  };

  const handleAddMilestoneInstallment = () => {
    setMilestoneInstallments((prev) => [
      ...prev,
      {
        label: `Thanh toán đợt ${prev.length + 1}`,
        percentage: '0',
        expected_date: '',
      },
    ]);
  };

  const handleRemoveMilestoneInstallment = (index: number) => {
    setMilestoneInstallments((prev) => prev.filter((_, installmentIndex) => installmentIndex !== index));
  };

  useEffect(() => {
    if (allocationMode !== 'MILESTONE') {
      previewTrackingReadyRef.current = true;
      return;
    }

    if (!previewTrackingReadyRef.current) {
      previewTrackingReadyRef.current = true;
      return;
    }

    setPreviewDirty(true);
  }, [
    advancePercentage,
    allocationMode,
    formData.effective_date,
    formData.expiry_date,
    formData.sign_date,
    formData.value,
    installmentCount,
    milestoneInputMode,
    milestoneInstallments,
    retentionPercentage,
  ]);

  useEffect(() => {
    if (allocationMode !== 'EVEN') {
      cyclePreviewTrackingReadyRef.current = false;
      return;
    }

    if (!cyclePreviewTrackingReadyRef.current) {
      cyclePreviewTrackingReadyRef.current = true;
      return;
    }

    setPreviewDirty(true);
  }, [
    allocationMode,
    formData.effective_date,
    formData.expiry_date,
    formData.payment_cycle,
    formData.sign_date,
    formData.value,
  ]);

  const milestonePreview = useMemo(() => {
    if (allocationMode !== 'MILESTONE') {
      return { rows: [] as MilestonePreviewRow[], error: '' };
    }

    const startIso = resolveContractGenerationStartIso(formData);
    const endIso = String(formData.expiry_date || '').trim();
    if (!startIso) {
      return { rows: [] as MilestonePreviewRow[], error: 'Cần có Ngày hiệu lực hoặc Ngày ký để preview mốc thanh toán.' };
    }
    if (!parseIsoDate(endIso)) {
      return { rows: [] as MilestonePreviewRow[], error: 'Cần có Ngày hết hiệu lực hợp lệ để preview mốc thanh toán.' };
    }
    if (contractValueNumber <= 0) {
      return { rows: [] as MilestonePreviewRow[], error: 'Giá trị hợp đồng phải lớn hơn 0 để preview mốc thanh toán.' };
    }

    const safeAdvancePercentage = clampPercentage(advancePercentage, 15);
    const safeRetentionPercentage = clampPercentage(retentionPercentage, 5);
    const safeInstallmentCount = Math.max(1, Math.min(50, Math.round(Number(installmentCount) || 3)));

    if (milestoneInputMode === 'CUSTOM') {
      if (normalizedMilestoneInstallments.length === 0) {
        return { rows: [] as MilestonePreviewRow[], error: 'Hãy thêm ít nhất 1 đợt thanh toán cho cấu hình custom.' };
      }
      if (milestoneSummary.invalidPercentageCount > 0) {
        return { rows: [] as MilestonePreviewRow[], error: 'Mỗi đợt thanh toán custom phải có tỷ lệ % lớn hơn 0.' };
      }
      if (milestoneSummary.invalidDateIndex >= 0) {
        return {
          rows: [] as MilestonePreviewRow[],
          error: `Ngày dự kiến của đợt ${milestoneSummary.invalidDateIndex + 1} không hợp lệ.`,
        };
      }
      if (Math.abs(milestoneSummary.overallTotal - 100) >= 0.01) {
        return {
          rows: [] as MilestonePreviewRow[],
          error: 'Tổng % tạm ứng, các đợt custom và % giữ lại phải đúng 100%.',
        };
      }

      return {
        rows: buildMilestonePreviewRows(
          contractValueNumber,
          startIso,
          endIso,
          safeAdvancePercentage,
          safeRetentionPercentage,
          normalizedMilestoneInstallments.length,
          normalizedMilestoneInstallments
        ),
        error: '',
      };
    }

    if (safeAdvancePercentage + safeRetentionPercentage >= 100) {
      return { rows: [] as MilestonePreviewRow[], error: 'Tổng % tạm ứng và % giữ lại phải nhỏ hơn 100%.' };
    }

    return {
      rows: buildMilestonePreviewRows(
        contractValueNumber,
        startIso,
        endIso,
        safeAdvancePercentage,
        safeRetentionPercentage,
        safeInstallmentCount
      ),
      error: '',
    };
  }, [
    advancePercentage,
    allocationMode,
    contractValueNumber,
    formData,
    installmentCount,
    milestoneInputMode,
    milestoneSummary.invalidDateIndex,
    milestoneSummary.invalidPercentageCount,
    milestoneSummary.overallTotal,
    normalizedMilestoneInstallments,
    retentionPercentage,
  ]);

  const customInstallmentPreviewRows = useMemo(() => {
    if (allocationMode !== 'MILESTONE' || milestoneInputMode !== 'CUSTOM' || normalizedMilestoneInstallments.length === 0) {
      return [] as MilestonePreviewRow[];
    }
    if (milestoneSummary.invalidPercentageCount > 0 || Math.abs(milestoneSummary.overallTotal - 100) >= 0.01) {
      return [] as MilestonePreviewRow[];
    }

    const startIso = resolveContractGenerationStartIso(formData);
    const endIso = String(formData.expiry_date || '').trim();
    if (!startIso || !parseIsoDate(endIso) || contractValueNumber <= 0) {
      return [] as MilestonePreviewRow[];
    }

    return buildMilestonePreviewRows(
      contractValueNumber,
      startIso,
      endIso,
      clampPercentage(advancePercentage, 15),
      clampPercentage(retentionPercentage, 5),
      normalizedMilestoneInstallments.length,
      normalizedMilestoneInstallments
    ).filter((row) => row.tone === 'INSTALLMENT');
  }, [
    advancePercentage,
    allocationMode,
    contractValueNumber,
    formData,
    milestoneInputMode,
    milestoneSummary.invalidPercentageCount,
    milestoneSummary.overallTotal,
    normalizedMilestoneInstallments,
    retentionPercentage,
  ]);

  const cyclePreview = useMemo(() => {
    if (allocationMode !== 'EVEN') {
      return { rows: [] as MilestonePreviewRow[], error: '' };
    }

    const startIso = resolveContractGenerationStartIso(formData);
    if (!startIso) {
      return { rows: [] as MilestonePreviewRow[], error: 'Cần có Ngày hiệu lực hoặc Ngày ký để dự thảo kỳ thanh toán.' };
    }
    if (contractValueNumber <= 0) {
      return { rows: [] as MilestonePreviewRow[], error: 'Giá trị hợp đồng phải lớn hơn 0 để dự thảo kỳ thanh toán.' };
    }

    const normalizedCycle = String(formData.payment_cycle || '').trim().toUpperCase() || 'ONCE';
    const expiryIso = String(formData.expiry_date || '').trim();

    return {
      rows: buildCyclePreviewRows(
        contractValueNumber,
        normalizedCycle,
        startIso,
        parseIsoDate(expiryIso) ? expiryIso : null,
        selectedProjectInvestmentModeCode
      ),
      error: '',
    };
  }, [
    allocationMode,
    contractValueNumber,
    formData,
    selectedProjectInvestmentModeCode,
  ]);

  const normalizedCycleDraftInstallments = useMemo<ContractCycleDraftInstallmentInput[]>(
    () => cycleDraftRows.map((row) => ({
      label: String(row.label || '').trim(),
      expected_date: String(row.expected_date || '').trim(),
      expected_amount: roundMoney(parseDraftExpectedAmount(row.expected_amount)),
    })),
    [cycleDraftRows]
  );

  const normalizedCycle = String(formData.payment_cycle || '').trim().toUpperCase() || 'ONCE';

  const resetCycleDraftRows = () => {
    setCycleDraftRows(buildCycleDraftInstallments(cyclePreview.rows));
    setIsCycleDraftDirty(false);
    setCyclePreviewTab('EDIT');
  };

  useEffect(() => {
    if (allocationMode !== 'EVEN') {
      return;
    }

    if (cyclePreview.error) {
      if (!isCycleDraftDirty) {
        setCycleDraftRows([]);
      }
      return;
    }

    if (!isCycleDraftDirty) {
      setCycleDraftRows(buildCycleDraftInstallments(cyclePreview.rows));
      setIsCycleDraftDirty(false);
    }
  }, [allocationMode, cycleDraftRows.length, cyclePreview.error, cyclePreview.rows, isCycleDraftDirty]);

  const cycleDraftTotal = useMemo(
    () => roundMoney(normalizedCycleDraftInstallments.reduce((sum, row) => sum + row.expected_amount, 0)),
    [normalizedCycleDraftInstallments]
  );

  const cycleDraftError = useMemo(() => {
    if (allocationMode !== 'EVEN') {
      return '';
    }

    if (cyclePreview.error) {
      return cyclePreview.error;
    }

    if (normalizedCycleDraftInstallments.length === 0) {
      return 'Hãy thêm ít nhất 1 kỳ dự thảo trước khi sinh kỳ thanh toán.';
    }

    const missingLabelIndex = normalizedCycleDraftInstallments.findIndex((row) => row.label === '');
    if (missingLabelIndex >= 0) {
      return `Tên kỳ ở dòng ${missingLabelIndex + 1} không được để trống.`;
    }

    const invalidDateIndex = normalizedCycleDraftInstallments.findIndex((row) => !parseIsoDate(row.expected_date));
    if (invalidDateIndex >= 0) {
      return `Ngày dự kiến ở dòng ${invalidDateIndex + 1} không hợp lệ.`;
    }

    const invalidAmountIndex = normalizedCycleDraftInstallments.findIndex((row) => row.expected_amount <= 0);
    if (invalidAmountIndex >= 0) {
      return `Số tiền dự kiến ở dòng ${invalidAmountIndex + 1} phải lớn hơn 0.`;
    }

    if (Math.abs(cycleDraftTotal - contractValueNumber) > 0.5) {
      return `Tổng dự thảo phải bằng ${roundMoney(contractValueNumber).toLocaleString('vi-VN')} đ để sinh kỳ thanh toán.`;
    }

    return '';
  }, [
    allocationMode,
    contractValueNumber,
    cycleDraftTotal,
    cyclePreview.error,
    normalizedCycleDraftInstallments,
  ]);

  const isPreviewDirty = previewDirty || schedules.length === 0;
  const cycleDraftStatusLabel = isCycleDraftDirty
    ? 'Đã chỉnh tay'
    : isPreviewDirty
      ? 'Chưa chốt lại'
      : 'Theo cấu hình hiện tại';
  const generateButtonLockMessage = baseGenerateButtonLockMessage || (
    allocationMode === 'EVEN'
      ? cycleDraftError
      : ''
  );
  const isGenerateButtonDisabled = baseGenerateButtonDisabled || (
    allocationMode === 'EVEN' && cycleDraftError !== ''
  );
  const showCyclePreview = allocationMode === 'EVEN';
  const showMilestonePreview = allocationMode === 'MILESTONE' && (previewDirty || schedules.length === 0);

  const handleCyclePreviewTabChange = (nextTab: 'PROPOSAL' | 'EDIT') => {
    setCyclePreviewTab(nextTab);
  };

  const handleCycleDraftRowChange = (
    index: number,
    field: keyof CycleDraftInstallmentDraft,
    value: string
  ) => {
    setCyclePreviewTab('EDIT');
    setIsCycleDraftDirty(true);
    setCycleDraftRows((prev) => prev.map((row, rowIndex) => (
      rowIndex === index
        ? { ...row, [field]: value }
        : row
    )));
  };

  const handleAddCycleDraftRow = () => {
    const nextIndex = cycleDraftRows.length + 1;
    const fallbackStartDate = resolveContractGenerationStartIso(formData) || todayIsoDate();
    const lastExpectedDate = cycleDraftRows[cycleDraftRows.length - 1]?.expected_date || fallbackStartDate;

    setCyclePreviewTab('EDIT');
    setIsCycleDraftDirty(true);
    setCycleDraftRows((prev) => [
      ...prev,
      {
        label: buildPaymentMilestoneName(normalizedCycle, nextIndex, selectedProjectInvestmentModeCode),
        expected_date: lastExpectedDate,
        expected_amount: '0',
      },
    ]);
  };

  const handleRemoveCycleDraftRow = (index: number) => {
    setCyclePreviewTab('EDIT');
    setIsCycleDraftDirty(true);
    setCycleDraftRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const handleGenerateSchedules = async () => {
    if (!contractId || !onGenerateSchedules) {
      return;
    }

    if (draftItemsCount === 0) {
      const confirmed = window.confirm('Chưa có hạng mục hợp đồng. Bạn có chắc muốn sinh kỳ thanh toán?');
      if (!confirmed) {
        return;
      }
    }

    if (allocationMode === 'MILESTONE' && milestonePreview.error) {
      window.alert(milestonePreview.error);
      return;
    }

    if (allocationMode === 'EVEN' && cycleDraftError) {
      window.alert(cycleDraftError);
      return;
    }

    if (schedules.length > 0) {
      const confirmMessage = `Đã có ${schedules.length} kỳ thanh toán. Sinh lại sẽ thay toàn bộ lịch thu tiền hiện có. Bạn có chắc muốn tiếp tục?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    setIsGenerating(true);
    try {
      await onGenerateSchedules(
        contractId,
        buildGeneratePayload({
          allocationMode,
          advancePercentage,
          retentionPercentage,
          installmentCount,
          milestoneInputMode,
          normalizedMilestoneInstallments,
          normalizedCycleDraftInstallments,
        })
      );
      setPreviewDirty(false);
    } catch {
      // Error toast is handled at App level.
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    allocation: {
      allocationMode,
      allocationModeOptions,
      allocationModeLockMessage,
      isAllocationModeSelectionDisabled,
      onAllocationModeChange: setAllocationMode,
    },
    generation: {
      advancePercentage,
      retentionPercentage,
      installmentCount,
      milestoneInputMode,
      milestoneInstallments,
      generateButtonLockMessage,
      isGenerateButtonDisabled,
      isGenerating,
      onAdvancePercentageChange: setAdvancePercentage,
      onRetentionPercentageChange: setRetentionPercentage,
      onInstallmentCountChange: setInstallmentCount,
      onMilestoneInputModeChange: handleMilestoneInputModeChange,
      onGenerateSchedules: handleGenerateSchedules,
      onSyncMilestoneInstallmentsFromAuto: syncMilestoneInstallmentsFromAuto,
      onAddMilestoneInstallment: handleAddMilestoneInstallment,
      onMilestoneInstallmentChange: handleMilestoneInstallmentChange,
      onRemoveMilestoneInstallment: handleRemoveMilestoneInstallment,
    },
    preview: {
      hasCollectedSchedules,
      isPreviewDirty,
      showCyclePreview,
      cyclePreviewTab,
      cyclePreview,
      cycleDraftRows,
      cycleDraftError,
      cycleDraftTotal,
      cycleDraftStatusLabel,
      isCycleDraftDirty,
      onCyclePreviewTabChange: handleCyclePreviewTabChange,
      onCycleDraftRowChange: handleCycleDraftRowChange,
      onAddCycleDraftRow: handleAddCycleDraftRow,
      onRemoveCycleDraftRow: handleRemoveCycleDraftRow,
      onResetCycleDraftRows: resetCycleDraftRows,
      showMilestonePreview,
      customInstallmentPreviewRows,
      milestonePreview,
      milestoneSummary,
    },
  };
};
