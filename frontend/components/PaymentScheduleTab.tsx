import React, { useMemo, useState } from 'react';
import { Attachment, PaymentSchedule, PaymentScheduleConfirmationPayload, PaymentScheduleStatus } from '../types';
import { uploadDocumentAttachment } from '../services/v5Api';
import { downloadExcelWorkbook } from '../utils/excelTemplate';
import { useEscKey } from '../hooks/useEscKey';
import { AttachmentManager } from './AttachmentManager';

const DATE_INPUT_MIN = '1900-01-01';
const DATE_INPUT_MAX = '9999-12-31';
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const PAYMENT_OVER_AMOUNT_MESSAGE = 'Số tiền thực thu không được vượt quá số tiền dự kiến của kỳ.';

interface PaymentScheduleTabProps {
  contractCode?: string;
  contractAmount?: number;
  schedules: PaymentSchedule[];
  isLoading?: boolean;
  generateSchedulesLockMessage?: string;
  isGeneratingSchedules?: boolean;
  isGenerateSchedulesDisabled?: boolean;
  onRefresh?: () => Promise<void> | void;
  onGenerateSchedules?: () => Promise<void> | void;
  onConfirmPayment: (
    scheduleId: string | number,
    payload: PaymentScheduleConfirmationPayload
  ) => Promise<void>;
  onDeletePaymentSchedule?: (scheduleId: string | number) => Promise<void>;
}

type PaymentScheduleFilter = 'ALL' | 'PENDING' | 'PAID' | 'OVERDUE';
type PaymentScheduleViewMode = 'TABLE' | 'TIMELINE';

const STATUS_STYLES: Record<PaymentScheduleStatus, string> = {
  PENDING: 'bg-warning/15 text-warning',
  INVOICED: 'bg-secondary/15 text-secondary',
  PARTIAL: 'bg-primary/10 text-primary',
  PAID: 'bg-success/15 text-success',
  OVERDUE: 'bg-error/10 text-error',
  CANCELLED: 'bg-slate-100 text-slate-700',
};

const STATUS_LABELS: Record<PaymentScheduleStatus, string> = {
  PENDING: 'Chờ thu',
  INVOICED: 'Đã xuất HĐ',
  PARTIAL: 'Thu một phần',
  PAID: 'Đã thu đủ',
  OVERDUE: 'Quá hạn',
  CANCELLED: 'Hủy',
};

const TIMELINE_NODE_STYLES: Record<PaymentScheduleStatus, string> = {
  PENDING: 'border-warning/20 bg-warning/10',
  INVOICED: 'border-secondary/20 bg-secondary/10',
  PARTIAL: 'border-primary/20 bg-primary/5',
  PAID: 'border-success/20 bg-success/10',
  OVERDUE: 'border-error/20 bg-error/5',
  CANCELLED: 'border-slate-200 bg-slate-50',
};

const summaryMetricClass =
  'inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap';

const compactButtonClass =
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[13px] font-semibold leading-5 text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50';

const primaryButtonClass =
  'inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[13px] font-semibold leading-5 text-white shadow-sm transition-colors hover:bg-deep-teal focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-60';

const compactInputClass =
  'h-8 rounded border border-slate-300 bg-white px-3 text-sm leading-5 text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:bg-slate-100 disabled:text-slate-500';
const segmentedButtonClass =
  'inline-flex h-8 items-center rounded-md px-2.5 text-[13px] font-semibold leading-5 transition-colors focus:outline-none focus:ring-1 focus:ring-primary/30';
const dangerButtonClass =
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-error/20 bg-white px-2.5 text-[13px] font-semibold leading-5 text-error transition-colors hover:bg-error/5 disabled:opacity-50';
const solidDangerButtonClass =
  'inline-flex h-8 items-center gap-1.5 rounded-md bg-error px-2.5 text-[13px] font-semibold leading-5 text-white transition-colors hover:bg-error/90 focus:outline-none focus:ring-1 focus:ring-error/20';

const modalShellClass =
  'relative w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl animate-fade-in';

const sectionTitleClass = 'text-sm font-bold leading-5 text-deep-teal';
const cardLabelClass = 'text-xs font-semibold uppercase tracking-wide leading-4 text-slate-500';
const cardValueBaseClass = 'text-base font-bold leading-6';
const tableHeaderClass = 'sticky top-0 z-10 whitespace-nowrap bg-slate-50 px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide leading-4 text-slate-500';
const tableHeaderCenterClass = 'sticky top-0 z-10 whitespace-nowrap bg-slate-50 px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide leading-4 text-slate-500';
const tableHeaderRightClass = 'sticky top-0 z-10 whitespace-nowrap bg-slate-50 px-2 py-1.5 text-right text-[10px] font-bold uppercase tracking-wide leading-4 text-slate-500';
const rowPrimaryTextClass = 'align-middle text-[13px] font-medium leading-4 text-slate-900';
const rowMutedTextClass = 'align-middle text-[13px] font-medium leading-4 text-slate-600';
const rowMetaTextClass = 'text-xs font-medium leading-4 text-slate-500';
const scheduleTableClass = 'w-full min-w-[1390px] table-fixed border-collapse';
const statusHeaderClass = `${tableHeaderClass} w-[112px]`;
const statusCellClass = 'w-[112px] px-2 py-2 align-middle';
const actionHeaderClass = `${tableHeaderRightClass} w-[104px]`;
const actionCellBaseClass = 'w-[104px] px-2 py-2 text-right align-middle';
const iconActionButtonClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50';

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0);

const formatCurrencyInput = (value: number): string =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(value || 0)));

const formatDate = (value?: string | null): string => {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('vi-VN');
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('vi-VN');
};

const parseAmount = (rawValue: unknown): number => {
  if (typeof rawValue === 'number') {
    return Number.isFinite(rawValue) ? Math.round(rawValue) : 0;
  }

  const trimmed = String(rawValue ?? '').trim();
  if (!trimmed) {
    return 0;
  }

  const normalized = trimmed.replace(/\s/g, '');
  const isNegative = normalized.startsWith('-');
  const unsignedValue = normalized.replace(/^-/, '');
  const decimalMatch = unsignedValue.match(/^(.+)([.,])(\d{1,2})$/);

  if (decimalMatch) {
    const integerDigits = decimalMatch[1].replace(/\D/g, '') || '0';
    const parsedDecimal = Number(`${integerDigits}.${decimalMatch[3]}`);
    if (Number.isFinite(parsedDecimal)) {
      return Math.round(isNegative ? -parsedDecimal : parsedDecimal);
    }
  }

  const digitOnlyValue = `${isNegative ? '-' : ''}${unsignedValue.replace(/\D/g, '')}`;
  const parsed = Number(digitOnlyValue);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toWholeVndAmount = (value: unknown): number => Math.max(0, parseAmount(value));

const formatAmountDraft = (rawValue: string | number): string => {
  const normalized = String(rawValue ?? '').trim();
  if (normalized === '') {
    return '';
  }

  const parsed = parseAmount(normalized);
  if (parsed <= 0) {
    return normalized.replace(/[^\d]/g, '') === '' ? '' : '0';
  }

  return formatCurrencyInput(parsed);
};

const isValidIsoDate = (value: string): boolean => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;

  const matched = normalized.match(ISO_DATE_REGEX);
  if (!matched) return false;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (!Number.isFinite(year) || year < 1900 || year > 9999) return false;
  if (!Number.isFinite(month) || month < 1 || month > 12) return false;
  if (!Number.isFinite(day) || day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
};

const parseExpectedDateTimestamp = (value?: string | null): number | null => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const toFileToken = (value: string): string => {
  const normalized = String(value || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^0-9A-Za-z_-]/g, '');
  return normalized || 'HD';
};

const resolveMilestoneBadgeTone = (milestoneName: string): string | null => {
  const normalized = String(milestoneName || '').trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  if (normalized.includes('TẠM ỨNG') || normalized.includes('TAM UNG')) {
    return 'bg-secondary/15 text-secondary';
  }
  if (normalized.includes('QUYẾT TOÁN') || normalized.includes('QUYET TOAN')) {
    return 'bg-warning/15 text-warning';
  }
  if (normalized.includes('THANH TOÁN ĐỢT') || normalized.includes('THANH TOAN DOT')) {
    return 'bg-primary/10 text-primary';
  }

  return null;
};

export const PaymentScheduleTab: React.FC<PaymentScheduleTabProps> = ({
  contractCode = '',
  contractAmount = 0,
  schedules = [],
  isLoading = false,
  generateSchedulesLockMessage = '',
  isGeneratingSchedules = false,
  isGenerateSchedulesDisabled = false,
  onRefresh,
  onGenerateSchedules,
  onConfirmPayment,
  onDeletePaymentSchedule,
}: PaymentScheduleTabProps) => {
  const [filter, setFilter] = useState<PaymentScheduleFilter>('ALL');
  const [viewMode, setViewMode] = useState<PaymentScheduleViewMode>('TABLE');
  const [confirmingItem, setConfirmingItem] = useState<PaymentSchedule | null>(null);
  const [actualDate, setActualDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [actualAmount, setActualAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState<boolean>(false);
  const [attachmentError, setAttachmentError] = useState<string>('');
  const [attachmentNotice, setAttachmentNotice] = useState<string>('');
  const [submittingId, setSubmittingId] = useState<string | number | null>(null);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [formError, setFormError] = useState<string>('');
  const [pendingRemoveAttachmentId, setPendingRemoveAttachmentId] = useState<string | null>(null);

  const summary = useMemo(() => {
    return schedules.reduce(
      (acc, item) => {
        const expectedAmount = Number(item.expected_amount || 0);
        const actualPaidAmount = Number(item.actual_paid_amount || 0);
        const expectedComparableAmount = Math.round(Math.max(0, expectedAmount));

        acc.expected += expectedAmount;
        acc.actual += actualPaidAmount;
        if (actualPaidAmount > expectedComparableAmount) {
          acc.overpaid += actualPaidAmount - expectedComparableAmount;
          acc.overpaidCount += 1;
        }
        if (item.status === 'OVERDUE') {
          const overdueGap = Math.max(0, expectedAmount - actualPaidAmount);
          acc.overdue += overdueGap;
        }
        return acc;
      },
      { expected: 0, actual: 0, overdue: 0, overpaid: 0, overpaidCount: 0 }
    );
  }, [schedules]);

  const sortedSchedules = useMemo(() => {
    return [...(schedules || [])].sort((a, b) => {
      const aDate = parseExpectedDateTimestamp(a.expected_date) ?? Number.MAX_SAFE_INTEGER;
      const bDate = parseExpectedDateTimestamp(b.expected_date) ?? Number.MAX_SAFE_INTEGER;
      if (aDate !== bDate) {
        return aDate - bDate;
      }
      const aCycle = Number(a.cycle_number || 0);
      const bCycle = Number(b.cycle_number || 0);
      if (aCycle !== bCycle) {
        return aCycle - bCycle;
      }
      return String(a.id).localeCompare(String(b.id));
    });
  }, [schedules]);

  const filteredSchedules = useMemo(() => {
    if (filter === 'PENDING') {
      return sortedSchedules.filter((item) => item.status === 'PENDING' || item.status === 'INVOICED');
    }

    if (filter === 'PAID') {
      return sortedSchedules.filter((item) => item.status === 'PAID' || item.status === 'PARTIAL');
    }

    if (filter === 'OVERDUE') {
      return sortedSchedules.filter((item) => item.status === 'OVERDUE');
    }

    return sortedSchedules;
  }, [filter, sortedSchedules]);

  const scheduleFilterCounts = useMemo(() => {
    return sortedSchedules.reduce(
      (acc, item) => {
        const status = String(item.status || '').trim().toUpperCase();
        acc.ALL += 1;
        if (status === 'PENDING' || status === 'INVOICED') {
          acc.PENDING += 1;
        }
        if (status === 'PAID' || status === 'PARTIAL') {
          acc.PAID += 1;
        }
        if (status === 'OVERDUE') {
          acc.OVERDUE += 1;
        }
        return acc;
      },
      { ALL: 0, PENDING: 0, PAID: 0, OVERDUE: 0 } as Record<PaymentScheduleFilter, number>
    );
  }, [sortedSchedules]);

  const currentCycleId = useMemo(() => {
    const candidates = sortedSchedules.filter((item) => item.status !== 'PAID' && item.status !== 'CANCELLED');
    if (candidates.length === 0) {
      return null;
    }

    const now = new Date();
    const nowTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const nearest = [...candidates].sort((a, b) => {
      const aTs = parseExpectedDateTimestamp(a.expected_date) ?? nowTs;
      const bTs = parseExpectedDateTimestamp(b.expected_date) ?? nowTs;
      const aDiff = Math.abs(aTs - nowTs);
      const bDiff = Math.abs(bTs - nowTs);
      if (aDiff !== bDiff) {
        return aDiff - bDiff;
      }
      return aTs - bTs;
    })[0];

    return nearest?.id ?? null;
  }, [sortedSchedules]);

  const paidPercent = summary.expected > 0 ? Math.min(100, (summary.actual / summary.expected) * 100) : 0;
  const overduePercent = summary.expected > 0 ? Math.min(100, (summary.overdue / summary.expected) * 100) : 0;
  const remainingPercent = Math.max(0, 100 - paidPercent - overduePercent);
  const hasLegacyOverpaidSchedules = summary.overpaidCount > 0;
  const hasScheduleMismatch = contractAmount > 0 && Math.abs(summary.expected - contractAmount) > 0.5;
  const hasNoSchedules = sortedSchedules.length === 0;
  const canRenderGenerateSchedulesCta = Boolean(onGenerateSchedules);
  const generateScheduleButtonLabel = hasNoSchedules ? 'Sinh kỳ thanh toán ngay' : 'Sinh lại kỳ thanh toán';

  const getOverdueDays = (item: PaymentSchedule): number => {
    if (item.status !== 'OVERDUE') {
      return 0;
    }

    const expectedTs = parseExpectedDateTimestamp(item.expected_date);
    if (expectedTs === null) {
      return 0;
    }

    const now = new Date();
    const todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const expectedDayTs = new Date(new Date(expectedTs).getFullYear(), new Date(expectedTs).getMonth(), new Date(expectedTs).getDate()).getTime();
    const diff = Math.floor((todayTs - expectedDayTs) / DAY_MS);
    return diff > 0 ? diff : 0;
  };

  const canDeleteSchedule = (item: PaymentSchedule): boolean => {
    const normalizedStatus = String(item.status || '').trim().toUpperCase();
    const actualPaidAmount = Number(item.actual_paid_amount || 0);
    const actualPaidDate = String(item.actual_paid_date || '').trim();

    return actualPaidAmount <= 0
      && actualPaidDate === ''
      && normalizedStatus !== 'PAID'
      && normalizedStatus !== 'PARTIAL';
  };

  const startConfirm = (item: PaymentSchedule) => {
    setConfirmingItem(item);
    setActualDate(item.actual_paid_date || new Date().toISOString().slice(0, 10));
    setActualAmount(formatAmountDraft(String(item.actual_paid_amount || item.expected_amount || 0)));
    setNotes(item.notes || '');
    setAttachments([...(item.attachments || [])]);
    setAttachmentError('');
    setAttachmentNotice('');
    setFormError('');
  };

  const cancelConfirm = () => {
    setConfirmingItem(null);
    setActualDate(new Date().toISOString().slice(0, 10));
    setActualAmount('');
    setNotes('');
    setAttachments([]);
    setIsUploadingAttachment(false);
    setAttachmentError('');
    setAttachmentNotice('');
    setFormError('');
    setPendingRemoveAttachmentId(null);
  };

  const handleDeleteSchedule = async (item: PaymentSchedule) => {
    if (!onDeletePaymentSchedule || !canDeleteSchedule(item)) {
      return;
    }

    const confirmed = window.confirm(`Bạn có chắc muốn xóa kỳ thanh toán "${item.milestone_name}" không?`);
    if (!confirmed) {
      return;
    }

    setDeletingId(item.id);
    try {
      await onDeletePaymentSchedule(item.id);
    } catch {
      // Error toast is handled at App level.
    } finally {
      setDeletingId(null);
    }
  };

  useEscKey(() => setPendingRemoveAttachmentId(null), !!pendingRemoveAttachmentId);
  useEscKey(cancelConfirm, !!confirmingItem && !pendingRemoveAttachmentId);

  const isReadOnlyConfirm = confirmingItem
    ? confirmingItem.status === 'PAID' || confirmingItem.status === 'CANCELLED'
    : false;

  const handleFillFullAmount = () => {
    if (!confirmingItem || isReadOnlyConfirm) {
      return;
    }
    setActualAmount(formatAmountDraft(String(confirmingItem.expected_amount || 0)));
  };

  const handleUploadAttachment = async (file: File) => {
    if (isReadOnlyConfirm) {
      return;
    }

    setAttachmentError('');
    setAttachmentNotice('');
    setIsUploadingAttachment(true);

    try {
      const uploaded = await uploadDocumentAttachment(file);
      setAttachments((prev) => [...prev, uploaded]);
      if (String(uploaded.warningMessage || '').trim() !== '') {
        setAttachmentNotice(String(uploaded.warningMessage || '').trim());
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tải file thất bại.';
      setAttachmentError(message);
      setAttachmentNotice('');
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    if (isReadOnlyConfirm) {
      return;
    }

    setPendingRemoveAttachmentId(String(id));
  };

  const confirmRemoveAttachment = () => {
    if (!pendingRemoveAttachmentId) {
      return;
    }

    setAttachments((prev) =>
      prev.filter((attachment) => String(attachment.id) !== String(pendingRemoveAttachmentId))
    );
    setPendingRemoveAttachmentId(null);
  };

  const handleConfirm = async () => {
    if (!confirmingItem || isReadOnlyConfirm) {
      return;
    }

    const parsedAmount = parseAmount(actualAmount);
    if (!actualDate || !isValidIsoDate(actualDate)) {
      setFormError('Ngày thực thu phải đúng định dạng dd/mm/yyyy.');
      return;
    }
    if (parsedAmount <= 0) {
      setFormError('Số tiền thực thu phải lớn hơn 0.');
      return;
    }

    const expectedComparableAmount = toWholeVndAmount(confirmingItem.expected_amount);
    const paidComparableAmount = toWholeVndAmount(parsedAmount);
    if (paidComparableAmount > expectedComparableAmount) {
      setFormError(PAYMENT_OVER_AMOUNT_MESSAGE);
      return;
    }

    const status: PaymentScheduleStatus = paidComparableAmount >= expectedComparableAmount ? 'PAID' : 'PARTIAL';

    setSubmittingId(confirmingItem.id);
    setFormError('');
    try {
      await onConfirmPayment(confirmingItem.id, {
        actual_paid_date: actualDate,
        actual_paid_amount: parsedAmount,
        status,
        notes: notes || null,
        attachments,
      });
      cancelConfirm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể cập nhật kỳ thanh toán.';
      setFormError(message);
    } finally {
      setSubmittingId(null);
    }
  };

  const previewAmount = parseAmount(actualAmount);
  const previewComparableAmount = toWholeVndAmount(previewAmount);
  const expectedPreviewAmount = confirmingItem ? toWholeVndAmount(confirmingItem.expected_amount) : 0;
  const previewStatus: PaymentScheduleStatus | null = confirmingItem
    ? (previewComparableAmount >= expectedPreviewAmount ? 'PAID' : previewAmount > 0 ? 'PARTIAL' : null)
    : null;

  const handleExportXls = () => {
    const fileDate = new Date().toISOString().slice(0, 10);
    const fileName = `DongTien_${toFileToken(contractCode)}_${fileDate}`;

    const headers = [
      'Kỳ',
      'Ngày dự kiến',
      'Số tiền dự kiến',
      'Ngày thực thu',
      'Số tiền thực thu',
      'Trạng thái',
      'Ghi chú',
    ];

    const rows = sortedSchedules.map((item) => [
      `${item.milestone_name} #${item.cycle_number}`,
      formatDate(item.expected_date),
      Number(item.expected_amount || 0),
      formatDate(item.actual_paid_date),
      Number(item.actual_paid_amount || 0),
      STATUS_LABELS[item.status],
      item.notes || '',
    ]);

    downloadExcelWorkbook(fileName, [
      {
        name: 'DongTien',
        headers,
        rows,
      },
    ]);
  };

  return (
      <div className="space-y-3">
      {hasScheduleMismatch && (
        <div className="flex flex-col gap-2 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-xs font-medium leading-4 text-warning sm:flex-row sm:items-center sm:justify-between">
          <div>
            Lịch thanh toán hiện đang tính theo <span className="font-semibold">{formatCurrency(summary.expected)}</span>,
            trong khi giá trị hợp đồng hiệu lực là <span className="font-semibold">{formatCurrency(contractAmount)}</span>.
            {' '}
            {hasNoSchedules ? 'Hãy sinh kỳ thanh toán để đồng bộ.' : 'Hãy sinh lại kỳ thanh toán để đồng bộ.'}
          </div>
          {canRenderGenerateSchedulesCta ? (
            <div className="inline-flex" title={generateSchedulesLockMessage || undefined}>
              <button
                type="button"
                onClick={() => {
                  void onGenerateSchedules?.();
                }}
                disabled={isGenerateSchedulesDisabled}
                className={primaryButtonClass}
              >
                {isGeneratingSchedules ? (
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 15 }} aria-hidden="true">
                    progress_activity
                  </span>
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }} aria-hidden="true">
                    auto_awesome
                  </span>
                )}
                {generateScheduleButtonLabel}
              </button>
            </div>
          ) : null}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className={summaryMetricClass}>
              <span className={cardLabelClass}>Dự kiến thu:</span>
              <span className={`${cardValueBaseClass} text-slate-900`}>{formatCurrency(summary.expected)}</span>
            </span>
            <span className={summaryMetricClass}>
              <span className={cardLabelClass}>Đã thu:</span>
              <span className={`${cardValueBaseClass} ${hasLegacyOverpaidSchedules ? 'text-warning' : 'text-success'}`}>{formatCurrency(summary.actual)}</span>
              {hasLegacyOverpaidSchedules && (
                <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-semibold leading-4 text-warning">
                  Thu vượt dữ liệu
                </span>
              )}
            </span>
            <span className={summaryMetricClass}>
              <span className={cardLabelClass}>Còn phải thu:</span>
              <span className={`${cardValueBaseClass} text-warning`}>{formatCurrency(Math.max(0, summary.expected - summary.actual))}</span>
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-1 xl:w-[360px]">
            <div className="flex h-2 overflow-hidden rounded-full border border-slate-100 bg-slate-100">
              <div style={{ width: `${paidPercent}%` }} className="bg-success" />
              <div style={{ width: `${remainingPercent}%` }} className="bg-warning" />
              <div style={{ width: `${overduePercent}%` }} className="bg-error" />
            </div>
            <p className={rowMetaTextClass}>
              {hasLegacyOverpaidSchedules
                ? `Thu vượt ${formatCurrency(summary.overpaid)} ở ${summary.overpaidCount} kỳ (${formatCurrency(summary.actual)} / ${formatCurrency(summary.expected)})`
                : `Đã thu ${Math.round(paidPercent)}% (${formatCurrency(summary.actual)} / ${formatCurrency(summary.expected)})`}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="space-y-2 border-b border-slate-200 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className={sectionTitleClass}>Danh sách kỳ thanh toán</p>
              {[
                { key: 'ALL', label: 'All' },
                { key: 'PENDING', label: 'Chờ thu' },
                { key: 'PAID', label: 'Đã thu' },
                { key: 'OVERDUE', label: 'Quá hạn' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-label={`${item.label} ${scheduleFilterCounts[item.key as PaymentScheduleFilter]}`}
                  onClick={() => setFilter(item.key as PaymentScheduleFilter)}
                  className={`${segmentedButtonClass} h-7 gap-1 px-2 ${
                    filter === item.key
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-4 ${
                      filter === item.key
                        ? 'bg-white/20 text-white'
                        : 'bg-white text-slate-500'
                    }`}
                  >
                    {scheduleFilterCounts[item.key as PaymentScheduleFilter]}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleExportXls}
                aria-label="Xuất Excel"
                title="Xuất Excel"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>
              </button>
              {onRefresh && (
                <button
                  type="button"
                  onClick={() => onRefresh()}
                  aria-label="Làm mới"
                  title="Làm mới"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>refresh</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewMode('TABLE')}
                className={`${segmentedButtonClass} h-7 px-2 ${
                  viewMode === 'TABLE'
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Bảng
              </button>
              <button
                type="button"
                onClick={() => setViewMode('TIMELINE')}
                className={`${segmentedButtonClass} h-7 px-2 ${
                  viewMode === 'TIMELINE'
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Timeline
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-slate-500">
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>
              progress_activity
            </span>
            Đang tải dòng tiền...
          </div>
        ) : viewMode === 'TABLE' ? (
          <div className="max-h-[56vh] overflow-auto">
            <table className={scheduleTableClass}>
              <colgroup>
                <col className="w-[56px]" />
                <col className="w-[230px]" />
                <col className="w-[96px]" />
                <col className="w-[96px]" />
                <col className="w-[96px]" />
                <col className="w-[124px]" />
                <col className="w-[96px]" />
                <col className="w-[124px]" />
                <col className="w-[112px]" />
                <col className="w-[170px]" />
                <col className="w-[64px]" />
                <col className="w-[104px]" />
              </colgroup>
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className={tableHeaderCenterClass}>TT</th>
                  <th className={tableHeaderClass}>Kỳ</th>
                  <th className={tableHeaderClass}>Từ ngày</th>
                  <th className={tableHeaderClass}>Đến ngày</th>
                  <th className={tableHeaderClass}>Dự kiến thu</th>
                  <th className={tableHeaderClass}>Tiền dự kiến</th>
                  <th className={tableHeaderClass}>Ngày thu</th>
                  <th className={tableHeaderClass}>Thực thu</th>
                  <th className={statusHeaderClass}>Trạng thái</th>
                  <th className={tableHeaderClass}>Người xác nhận</th>
                  <th className={tableHeaderClass}>Hồ sơ</th>
                  <th className={actionHeaderClass}>Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSchedules.length > 0 ? (
                  filteredSchedules.map((item) => {
                    const canConfirm = item.status !== 'PAID' && item.status !== 'CANCELLED';
                    const canDelete = canDeleteSchedule(item) && Boolean(onDeletePaymentSchedule);
                    const canViewDetails = canConfirm
                      || Boolean(item.confirmed_by_name)
                      || Boolean((item.attachments || []).length)
                      || Boolean(item.actual_paid_date)
                      || Number(item.actual_paid_amount || 0) > 0
                      || Boolean(item.notes);
                    const isCurrentCycle = String(currentCycleId || '') === String(item.id);
                    const overdueDays = getOverdueDays(item);
                    const rowClass = item.status === 'OVERDUE'
                      ? 'bg-error/5 hover:bg-error/10'
                      : isCurrentCycle
                      ? 'bg-primary/5 hover:bg-primary/10'
                      : 'hover:bg-slate-50';
                    const actionCellClass = item.status === 'OVERDUE'
                      ? 'bg-error/5 group-hover:bg-error/10'
                      : isCurrentCycle
                      ? 'bg-primary/5 group-hover:bg-primary/10'
                      : 'bg-white group-hover:bg-slate-50';
                    const expectedStartDate = String(item.expected_start_date || item.expected_date || '').trim();
                    const expectedEndDate = String(item.expected_end_date || item.expected_date || '').trim();
                    const attachmentCount = item.attachments?.length ?? 0;
                    const hasAttachments = attachmentCount > 0;
                    const milestoneTone = resolveMilestoneBadgeTone(item.milestone_name);
                    const shouldRenderMilestoneMeta = (item.status === 'OVERDUE' && overdueDays > 0)
                      || (isCurrentCycle && item.status !== 'OVERDUE');

                    return (
                      <tr key={item.id} className={`group transition-colors ${rowClass}`}>
                        <td className="whitespace-nowrap px-2 py-2 text-center align-middle">
                          <span className="inline-flex min-w-7 justify-center rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-semibold leading-4 text-slate-500">
                            #{item.cycle_number}
                          </span>
                        </td>
                        <td className={`min-w-[210px] px-3 py-2 ${rowPrimaryTextClass}`}>
                          <div className="space-y-1">
                            <div className="flex items-start gap-2">
                              {item.status === 'OVERDUE' && (
                                <span className="material-symbols-outlined mt-0.5 shrink-0 text-error" style={{ fontSize: 14 }}>
                                  warning
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                {milestoneTone ? (
                                  <span className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-xs font-semibold leading-4 ${milestoneTone}`}>
                                    {item.milestone_name}
                                  </span>
                                ) : (
                                  <p className="line-clamp-2 break-words text-[13px] font-semibold leading-4 text-slate-900">
                                    {item.milestone_name}
                                  </p>
                                )}
                              </div>
                            </div>

                            {shouldRenderMilestoneMeta && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {item.status === 'OVERDUE' && overdueDays > 0 && (
                                  <span className="inline-flex items-center rounded-full bg-error/10 px-2 py-0.5 text-xs font-semibold leading-4 text-error">
                                    Quá hạn {overdueDays} ngày
                                  </span>
                                )}
                                {isCurrentCycle && item.status !== 'OVERDUE' && (
                                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold leading-4 text-primary">
                                    Kỳ hiện tại
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className={`whitespace-nowrap px-2 py-2 ${rowMutedTextClass}`}>{formatDate(expectedStartDate)}</td>
                        <td className={`whitespace-nowrap px-2 py-2 ${rowMutedTextClass}`}>{formatDate(expectedEndDate)}</td>
                        <td className={`whitespace-nowrap px-2 py-2 ${rowMutedTextClass}`}>{formatDate(item.expected_date)}</td>
                        <td className="whitespace-nowrap px-2 py-2 align-middle text-[13px] font-medium leading-4 text-slate-900">{formatCurrency(item.expected_amount)}</td>
                        <td className={`whitespace-nowrap px-2 py-2 ${rowMutedTextClass}`}>{formatDate(item.actual_paid_date)}</td>
                        <td className="whitespace-nowrap px-2 py-2 align-middle text-[13px] font-medium leading-4 text-slate-900">{formatCurrency(item.actual_paid_amount)}</td>
                        <td className={statusCellClass}>
                          <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium leading-4 ${STATUS_STYLES[item.status]}`}>
                            {STATUS_LABELS[item.status]}
                          </span>
                        </td>
                        <td className={`px-2 py-2 ${rowMutedTextClass}`}>
                          {item.confirmed_by_name ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex max-w-[150px] items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold leading-4 text-success">
                                <span className="material-symbols-outlined text-[14px] leading-none">verified_user</span>
                                <span className="truncate">{item.confirmed_by_name}</span>
                              </span>
                              <p className={rowMetaTextClass}>{formatDateTime(item.confirmed_at)}</p>
                            </div>
                          ) : (
                            <span className="text-xs font-medium leading-4 text-slate-400">--</span>
                          )}
                        </td>
                        <td className={`px-2 py-2 ${rowMutedTextClass}`}>
                          {hasAttachments ? (
                            <button
                              type="button"
                              onClick={() => startConfirm(item)}
                              aria-label={`Mở hồ sơ nghiệm thu: ${attachmentCount} file`}
                              title={`Mở hồ sơ nghiệm thu (${attachmentCount} file)`}
                              className="inline-flex h-7 min-w-[44px] items-center justify-center gap-1 rounded-full bg-secondary/10 px-2 text-xs font-bold leading-4 text-secondary transition-colors hover:bg-secondary/15 focus:outline-none focus:ring-1 focus:ring-secondary/30"
                            >
                              <span className="material-symbols-outlined text-[15px] leading-none" aria-hidden="true">attach_file</span>
                              {attachmentCount}
                            </button>
                          ) : (
                            <span className="text-xs font-medium leading-4 text-slate-400">--</span>
                          )}
                        </td>
                        <td className={`${actionCellBaseClass} ${actionCellClass}`}>
                          {canViewDetails || canDelete ? (
                            <div className="flex justify-end gap-1.5">
                              {canViewDetails ? (
                                <button
                                  type="button"
                                  onClick={() => startConfirm(item)}
                                  aria-label={`${canConfirm ? 'Xác nhận thu tiền' : 'Xem thu tiền'} ${item.milestone_name}`}
                                  title={canConfirm ? 'Xác nhận thu tiền' : 'Xem thu tiền'}
                                  className={`${iconActionButtonClass} border-primary/20 text-primary hover:bg-primary/10`}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 15 }} aria-hidden="true">
                                    {canConfirm ? 'payments' : 'visibility'}
                                  </span>
                                </button>
                              ) : null}
                              {canDelete ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleDeleteSchedule(item);
                                  }}
                                  disabled={String(deletingId || '') === String(item.id)}
                                  aria-label={`Xóa kỳ ${item.milestone_name}`}
                                  title="Xóa kỳ"
                                  className={`${iconActionButtonClass} border-error/20 text-error hover:bg-error/10`}
                                >
                                  <span className={`material-symbols-outlined ${String(deletingId || '') === String(item.id) ? 'animate-spin' : ''}`} style={{ fontSize: 15 }} aria-hidden="true">
                                    {String(deletingId || '') === String(item.id) ? 'progress_activity' : 'delete'}
                                  </span>
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs font-medium leading-4 text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-sm font-medium leading-5 text-slate-500">
                      {filter === 'ALL' ? (
                        <div className="flex flex-col items-center gap-3">
                          <span>Chưa có kỳ thanh toán nào cho hợp đồng này.</span>
                          {canRenderGenerateSchedulesCta ? (
                            <div className="inline-flex flex-col items-center gap-2" title={generateSchedulesLockMessage || undefined}>
                              <button
                                type="button"
                                onClick={() => {
                                  void onGenerateSchedules?.();
                                }}
                                disabled={isGenerateSchedulesDisabled}
                                className={primaryButtonClass}
                              >
                                {isGeneratingSchedules ? (
                                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 15 }} aria-hidden="true">
                                    progress_activity
                                  </span>
                                ) : (
                                  <span className="material-symbols-outlined" style={{ fontSize: 15 }} aria-hidden="true">
                                    add_circle
                                  </span>
                                )}
                                Sinh kỳ thanh toán ngay
                              </button>
                              <span className="text-xs font-medium leading-4 text-slate-400">
                                Hệ thống sẽ tạo lịch thu tiền theo cấu hình hợp đồng hiện tại.
                              </span>
                            </div>
                          ) : null}
                        </div>
                      ) : 'Không có kỳ thanh toán phù hợp bộ lọc.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 max-h-[48vh] overflow-auto">
            {filteredSchedules.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center text-sm font-medium leading-5 text-slate-500">
                <span>{filter === 'ALL' ? 'Chưa có kỳ thanh toán để hiển thị timeline.' : 'Không có dữ liệu để hiển thị timeline.'}</span>
                {filter === 'ALL' && canRenderGenerateSchedulesCta ? (
                  <div className="inline-flex" title={generateSchedulesLockMessage || undefined}>
                    <button
                      type="button"
                      onClick={() => {
                        void onGenerateSchedules?.();
                      }}
                      disabled={isGenerateSchedulesDisabled}
                      className={primaryButtonClass}
                    >
                      {isGeneratingSchedules ? (
                        <span className="material-symbols-outlined animate-spin" style={{ fontSize: 15 }} aria-hidden="true">
                          progress_activity
                        </span>
                      ) : (
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }} aria-hidden="true">
                          timeline
                        </span>
                      )}
                      Sinh kỳ thanh toán ngay
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex items-stretch gap-4 min-w-max pb-2">
                  {filteredSchedules.map((item) => {
                    const canConfirm = item.status !== 'PAID' && item.status !== 'CANCELLED';
                    const canDelete = canDeleteSchedule(item) && Boolean(onDeletePaymentSchedule);
                    const canViewDetails = canConfirm
                      || Boolean(item.confirmed_by_name)
                      || Boolean((item.attachments || []).length)
                      || Boolean(item.actual_paid_date)
                      || Number(item.actual_paid_amount || 0) > 0
                      || Boolean(item.notes);
                    const overdueDays = getOverdueDays(item);
                    const isCurrentCycle = String(currentCycleId || '') === String(item.id);
                    const attachmentCount = item.attachments?.length ?? 0;
                    const milestoneTone = resolveMilestoneBadgeTone(item.milestone_name);

                    return (
                      <div key={item.id} className="flex items-center gap-3">
                        <div
                          className={`w-[260px] rounded-lg border p-3 shadow-sm ${TIMELINE_NODE_STYLES[item.status]} ${
                            isCurrentCycle ? 'ring-2 ring-primary/30' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium leading-5 text-slate-600">{formatDate(item.expected_date)}</p>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium leading-4 ${STATUS_STYLES[item.status]}`}>
                              {STATUS_LABELS[item.status]}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {item.confirmed_by_name && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold leading-4 text-success">
                                <span className="material-symbols-outlined text-[13px] leading-none">verified_user</span>
                                Đã xác nhận
                              </span>
                            )}
                            {attachmentCount > 0 && (
                              <button
                                type="button"
                                onClick={() => startConfirm(item)}
                                aria-label={`Mở hồ sơ nghiệm thu: ${attachmentCount} file`}
                                className="inline-flex h-7 items-center gap-1 rounded-full bg-secondary/10 px-2 text-xs font-semibold leading-4 text-secondary transition-colors hover:bg-secondary/15 focus:outline-none focus:ring-1 focus:ring-secondary/30"
                              >
                                <span className="material-symbols-outlined text-[13px] leading-none" aria-hidden="true">attach_file</span>
                                {attachmentCount}
                              </button>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {milestoneTone ? (
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-4 ${milestoneTone}`}>
                                {item.milestone_name}
                              </span>
                            ) : (
                              <p className="text-sm font-medium leading-5 text-slate-900 line-clamp-2">
                                {item.milestone_name}
                              </p>
                            )}
                            <span className="text-xs font-medium leading-4 text-slate-400">#{item.cycle_number}</span>
                          </div>
                          <p className="mt-1 text-sm font-medium leading-5 text-slate-700">{formatCurrency(item.expected_amount)}</p>
                          {item.status === 'OVERDUE' && overdueDays > 0 && (
                            <p className="mt-1 text-xs font-medium leading-4 text-error">Quá hạn {overdueDays} ngày</p>
                          )}
                          {isCurrentCycle && item.status !== 'OVERDUE' && (
                            <p className="mt-1 text-xs font-medium leading-4 text-primary">Kỳ hiện tại</p>
                          )}
                          {item.confirmed_by_name && (
                            <p className="mt-1 text-xs font-medium leading-4 text-slate-500">Người xác nhận: {item.confirmed_by_name}</p>
                          )}
                          {canViewDetails || canDelete ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {canViewDetails ? (
                                <button
                                  type="button"
                                  onClick={() => startConfirm(item)}
                                  className={primaryButtonClass}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 15 }} aria-hidden="true">
                                    payments
                                  </span>
                                  {canConfirm ? 'Xác nhận thu tiền' : 'Xem thu tiền'}
                                </button>
                              ) : null}
                              {canDelete ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleDeleteSchedule(item);
                                  }}
                                  disabled={String(deletingId || '') === String(item.id)}
                                  className={dangerButtonClass}
                                >
                                  <span className={`material-symbols-outlined ${String(deletingId || '') === String(item.id) ? 'animate-spin' : ''}`} style={{ fontSize: 15 }} aria-hidden="true">
                                    {String(deletingId || '') === String(item.id) ? 'progress_activity' : 'delete'}
                                  </span>
                                  {String(deletingId || '') === String(item.id) ? 'Đang xóa' : 'Xóa kỳ'}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="w-6 h-[2px] bg-slate-300" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {pendingRemoveAttachmentId && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => setPendingRemoveAttachmentId(null)} />
          <div className={`${modalShellClass} max-w-sm p-4`}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded bg-error/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-error" style={{ fontSize: 18 }}>delete</span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold leading-5 text-deep-teal">Xác nhận gỡ file</p>
                <p className="text-xs font-medium leading-4 text-slate-600">Bạn có chắc muốn gỡ file này khỏi kỳ thanh toán?</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRemoveAttachmentId(null)}
                className={compactButtonClass}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={confirmRemoveAttachment}
                className={solidDangerButtonClass}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                  delete
                </span>
                Gỡ file
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmingItem && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={cancelConfirm} />
          <div className={`${modalShellClass} max-w-2xl`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>payments</span>
                </div>
                <div>
                  <h4 className="text-base font-bold leading-6 text-deep-teal">{isReadOnlyConfirm ? 'Chi tiết thu tiền' : 'Xác nhận thu tiền'}</h4>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide leading-4 text-slate-400">
                    {confirmingItem.milestone_name} #{confirmingItem.cycle_number}
                  </p>
                </div>
              </div>
              <button onClick={cancelConfirm} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-1 focus:ring-primary/30">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 gap-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
                  <p className={cardLabelClass}>Dự kiến thu</p>
                  <p className={`mt-1 ${cardValueBaseClass} text-on-surface`}>{formatCurrency(Number(confirmingItem.expected_amount || 0))}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold leading-4 text-neutral">Ngày thực thu</label>
                  <input
                    type="date"
                    value={actualDate}
                    onChange={(e) => setActualDate(e.target.value)}
                    disabled={isReadOnlyConfirm}
                    lang="vi-VN"
                    min={DATE_INPUT_MIN}
                    max={DATE_INPUT_MAX}
                    className={compactInputClass}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold leading-4 text-neutral">Số tiền thực thu</label>
                    <button
                      type="button"
                      onClick={handleFillFullAmount}
                      disabled={isReadOnlyConfirm}
                      className="text-[13px] font-semibold leading-[18px] text-primary hover:text-deep-teal disabled:text-slate-400"
                    >
                      Thu đủ
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={actualAmount}
                    onChange={(e) => setActualAmount(formatAmountDraft(e.target.value))}
                    disabled={isReadOnlyConfirm}
                    className={compactInputClass}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold leading-4 text-neutral">Ghi chú</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Nội dung thu tiền"
                  disabled={isReadOnlyConfirm}
                  className={compactInputClass}
                />
              </div>

              {(confirmingItem.confirmed_by_name || confirmingItem.confirmed_at) && (
                <div className="rounded-lg border border-success/20 bg-success/10 px-3 py-2 text-xs font-medium leading-4 text-success">
                  Người xác nhận:{' '}
                  <span className="font-semibold">{confirmingItem.confirmed_by_name || '--'}</span>
                  {' | '}
                  Thời điểm xác nhận:{' '}
                  <span className="font-semibold">{formatDateTime(confirmingItem.confirmed_at)}</span>
                </div>
              )}

              <AttachmentManager
                attachments={attachments}
                onUpload={handleUploadAttachment}
                onDelete={handleRemoveAttachment}
                isUploading={isUploadingAttachment}
                disabled={isReadOnlyConfirm}
                helperText="Đính kèm biên bản nghiệm thu, phiếu thu hoặc file đối soát liên quan."
                emptyStateDescription="Tải file nghiệm thu để lưu cùng lần xác nhận thu tiền này."
                uploadButtonLabel="Tải file nghiệm thu"
                uploadButtonClassName={primaryButtonClass}
              />

              {attachmentError && (
                <p className="inline-flex items-center gap-1 text-xs font-medium leading-4 text-error">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    warning
                  </span>
                  {attachmentError}
                </p>
              )}

              {!attachmentError && attachmentNotice && (
                <div className="rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-xs font-medium leading-4 text-warning">
                  {attachmentNotice}
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium leading-4 text-slate-700">
                Số tiền dự kiến: <span className="font-semibold">{formatCurrency(Number(confirmingItem.expected_amount || 0))}</span>
                {' | '}Bạn đang nhập: <span className="font-semibold">{formatCurrency(previewAmount)}</span>
                {' -> '}Trạng thái:{' '}
                <span className="font-semibold">{previewStatus ? STATUS_LABELS[previewStatus] : '--'}</span>
              </div>

              {formError && (
                <p className="inline-flex items-center gap-1 text-xs font-medium leading-4 text-error">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    warning
                  </span>
                  {formError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
              <button
                type="button"
                onClick={cancelConfirm}
                className={compactButtonClass}
              >
                {isReadOnlyConfirm ? 'Đóng' : 'Hủy'}
              </button>
              {!isReadOnlyConfirm && (
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={String(submittingId || '') === String(confirmingItem.id)}
                  className={primaryButtonClass}
                >
                  {String(submittingId || '') === String(confirmingItem.id) && (
                    <span className="material-symbols-outlined animate-spin" style={{ fontSize: 15 }}>
                      progress_activity
                    </span>
                  )}
                  Lưu thu tiền
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
