import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CircleDollarSign, Loader2, RefreshCw } from 'lucide-react';
import { Attachment, PaymentSchedule, PaymentScheduleConfirmationPayload, PaymentScheduleStatus } from '../types';
import { uploadDocumentAttachment } from '../services/v5Api';
import { downloadExcelWorkbook } from '../utils/excelTemplate';
import { useEscKey } from '../hooks/useEscKey';
import { AttachmentManager } from './AttachmentManager';

const DATE_INPUT_MIN = '1900-01-01';
const DATE_INPUT_MAX = '9999-12-31';
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

interface PaymentScheduleTabProps {
  contractCode?: string;
  contractAmount?: number;
  schedules: PaymentSchedule[];
  isLoading?: boolean;
  onRefresh?: () => Promise<void> | void;
  onConfirmPayment: (
    scheduleId: string | number,
    payload: PaymentScheduleConfirmationPayload
  ) => Promise<void>;
}

type PaymentScheduleFilter = 'ALL' | 'PENDING' | 'PAID' | 'OVERDUE';
type PaymentScheduleViewMode = 'TABLE' | 'TIMELINE';

const STATUS_STYLES: Record<PaymentScheduleStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  INVOICED: 'bg-blue-100 text-blue-700',
  PARTIAL: 'bg-cyan-100 text-cyan-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
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
  PENDING: 'border-amber-200 bg-amber-50',
  INVOICED: 'border-blue-200 bg-blue-50',
  PARTIAL: 'border-cyan-200 bg-cyan-50',
  PAID: 'border-green-200 bg-green-50',
  OVERDUE: 'border-red-200 bg-red-50',
  CANCELLED: 'border-slate-200 bg-slate-50',
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0);

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

const parseAmount = (rawValue: string): number => {
  const normalized = rawValue.replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
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
    return 'bg-fuchsia-100 text-fuchsia-700';
  }
  if (normalized.includes('QUYẾT TOÁN') || normalized.includes('QUYET TOAN')) {
    return 'bg-amber-100 text-amber-700';
  }
  if (normalized.includes('THANH TOÁN ĐỢT') || normalized.includes('THANH TOAN DOT')) {
    return 'bg-sky-100 text-sky-700';
  }

  return null;
};

export const PaymentScheduleTab: React.FC<PaymentScheduleTabProps> = ({
  contractCode = '',
  contractAmount = 0,
  schedules = [],
  isLoading = false,
  onRefresh,
  onConfirmPayment,
}) => {
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
  const [formError, setFormError] = useState<string>('');
  const [pendingRemoveAttachmentId, setPendingRemoveAttachmentId] = useState<string | null>(null);

  const summary = useMemo(() => {
    return schedules.reduce(
      (acc, item) => {
        acc.expected += Number(item.expected_amount || 0);
        acc.actual += Number(item.actual_paid_amount || 0);
        if (item.status === 'OVERDUE') {
          const overdueGap = Math.max(0, Number(item.expected_amount || 0) - Number(item.actual_paid_amount || 0));
          acc.overdue += overdueGap;
        }
        return acc;
      },
      { expected: 0, actual: 0, overdue: 0 }
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
  const hasScheduleMismatch = contractAmount > 0 && Math.abs(summary.expected - contractAmount) > 0.5;

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

  const startConfirm = (item: PaymentSchedule) => {
    setConfirmingItem(item);
    setActualDate(item.actual_paid_date || new Date().toISOString().slice(0, 10));
    setActualAmount(String(item.actual_paid_amount || item.expected_amount || 0));
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

  useEscKey(() => setPendingRemoveAttachmentId(null), !!pendingRemoveAttachmentId);
  useEscKey(cancelConfirm, !!confirmingItem && !pendingRemoveAttachmentId);

  const isReadOnlyConfirm = confirmingItem
    ? confirmingItem.status === 'PAID' || confirmingItem.status === 'CANCELLED'
    : false;

  const handleFillFullAmount = () => {
    if (!confirmingItem || isReadOnlyConfirm) {
      return;
    }
    setActualAmount(String(confirmingItem.expected_amount || 0));
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

    const status: PaymentScheduleStatus = parsedAmount >= Number(confirmingItem.expected_amount || 0) ? 'PAID' : 'PARTIAL';

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
  const previewStatus: PaymentScheduleStatus | null = confirmingItem
    ? (previewAmount >= Number(confirmingItem.expected_amount || 0) ? 'PAID' : previewAmount > 0 ? 'PARTIAL' : null)
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
    <div className="space-y-4">
      {hasScheduleMismatch && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Lịch thanh toán hiện đang tính theo <span className="font-semibold">{formatCurrency(summary.expected)}</span>,
          trong khi giá trị hợp đồng hiệu lực là <span className="font-semibold">{formatCurrency(contractAmount)}</span>.
          Hãy sinh lại kỳ thanh toán để đồng bộ.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Dự kiến thu</p>
            <p className="text-lg font-black text-slate-900 mt-1">{formatCurrency(summary.expected)}</p>
          </div>
          <CircleDollarSign className="w-5 h-5 text-primary" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Đã thu thực tế</p>
            <p className="text-lg font-black text-emerald-600 mt-1">{formatCurrency(summary.actual)}</p>
          </div>
          <CircleDollarSign className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Còn phải thu</p>
            <p className="text-lg font-black text-amber-600 mt-1">{formatCurrency(Math.max(0, summary.expected - summary.actual))}</p>
          </div>
          <CalendarClock className="w-5 h-5 text-amber-600" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
        <div className="h-2.5 rounded-full overflow-hidden border border-slate-100 bg-slate-100 flex">
          <div style={{ width: `${paidPercent}%` }} className="bg-emerald-500 transition-all" />
          <div style={{ width: `${remainingPercent}%` }} className="bg-amber-400 transition-all" />
          <div style={{ width: `${overduePercent}%` }} className="bg-red-400 transition-all" />
        </div>
        <p className="text-xs text-slate-600">
          Đã thu {Math.round(paidPercent)}% ({formatCurrency(summary.actual)} / {formatCurrency(summary.expected)})
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-800">Danh sách kỳ thanh toán</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportXls}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-base">download</span>
                Xuất Excel
              </button>
              {onRefresh && (
                <button
                  type="button"
                  onClick={() => onRefresh()}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Làm mới
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'ALL', label: 'All' },
                { key: 'PENDING', label: 'Chờ thu' },
                { key: 'PAID', label: 'Đã thu' },
                { key: 'OVERDUE', label: 'Quá hạn' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key as PaymentScheduleFilter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    filter === item.key
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setViewMode('TABLE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  viewMode === 'TABLE'
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Bảng
              </button>
              <button
                type="button"
                onClick={() => setViewMode('TIMELINE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  viewMode === 'TIMELINE'
                    ? 'bg-primary text-white'
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
            <Loader2 className="w-4 h-4 animate-spin" />
            Đang tải dòng tiền...
          </div>
        ) : viewMode === 'TABLE' ? (
          <div className="max-h-[48vh] overflow-auto">
            <table className="w-full min-w-[1180px] border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Kỳ</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Ngày dự kiến</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Số tiền dự kiến</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Ngày thực thu</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Số tiền thực thu</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Người xác nhận</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Hồ sơ</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSchedules.length > 0 ? (
                  filteredSchedules.map((item) => {
                    const canConfirm = item.status !== 'PAID' && item.status !== 'CANCELLED';
                    const canViewDetails = canConfirm
                      || Boolean(item.confirmed_by_name)
                      || Boolean((item.attachments || []).length)
                      || Boolean(item.actual_paid_date)
                      || Number(item.actual_paid_amount || 0) > 0
                      || Boolean(item.notes);
                    const isCurrentCycle = String(currentCycleId || '') === String(item.id);
                    const overdueDays = getOverdueDays(item);
                    const rowClass = item.status === 'OVERDUE'
                      ? 'bg-red-50 hover:bg-red-100/70'
                      : isCurrentCycle
                      ? 'bg-primary/5 hover:bg-primary/10'
                      : 'hover:bg-slate-50';
                    const attachmentCount = item.attachments?.length ?? 0;
                    const hasAttachments = attachmentCount > 0;
                    const milestoneTone = resolveMilestoneBadgeTone(item.milestone_name);

                    return (
                      <tr key={item.id} className={`transition-colors ${rowClass}`}>
                        <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                          <div className="flex items-center gap-1.5">
                            {item.status === 'OVERDUE' && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                            {milestoneTone ? (
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${milestoneTone}`}>
                                {item.milestone_name}
                              </span>
                            ) : (
                              <span>{item.milestone_name}</span>
                            )}
                            <span className="text-xs text-slate-400">#{item.cycle_number}</span>
                            {hasAttachments && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                                <span className="material-symbols-outlined text-[13px] leading-none">attach_file</span>
                                {attachmentCount}
                              </span>
                            )}
                          </div>
                          {item.status === 'OVERDUE' && overdueDays > 0 && (
                            <p className="text-xs text-red-600 mt-1">Quá hạn {overdueDays} ngày</p>
                          )}
                          {isCurrentCycle && item.status !== 'OVERDUE' && (
                            <p className="text-xs text-primary mt-1">Kỳ hiện tại</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{formatDate(item.expected_date)}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 font-semibold">{formatCurrency(item.expected_amount)}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{formatDate(item.actual_paid_date)}</td>
                        <td className="px-4 py-3 text-sm text-slate-900">{formatCurrency(item.actual_paid_amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[item.status]}`}>
                            {STATUS_LABELS[item.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {item.confirmed_by_name ? (
                            <div className="space-y-1">
                              <span className="inline-flex max-w-[180px] items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                <span className="material-symbols-outlined text-[14px] leading-none">verified_user</span>
                                <span className="truncate">{item.confirmed_by_name}</span>
                              </span>
                              <p className="text-[11px] text-slate-500">{formatDateTime(item.confirmed_at)}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {hasAttachments ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                                <span className="material-symbols-outlined text-[14px] leading-none">attach_file</span>
                                {attachmentCount} file
                              </span>
                              <p className="text-[11px] text-slate-500">
                                {attachmentCount === 1 ? 'Đã đính kèm hồ sơ nghiệm thu' : 'Có hồ sơ nghiệm thu đi kèm'}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canViewDetails ? (
                            <button
                              type="button"
                              onClick={() => startConfirm(item)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-white hover:bg-deep-teal transition-colors"
                            >
                              <CircleDollarSign className="w-3.5 h-3.5" />
                              {canConfirm ? 'Xác nhận thu tiền' : 'Xem thu tiền'}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">
                      {filter === 'ALL' ? 'Chưa có kỳ thanh toán nào cho hợp đồng này.' : 'Không có kỳ thanh toán phù hợp bộ lọc.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 max-h-[48vh] overflow-auto">
            {filteredSchedules.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">Không có dữ liệu để hiển thị timeline.</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex items-stretch gap-4 min-w-max pb-2">
                  {filteredSchedules.map((item) => {
                    const canConfirm = item.status !== 'PAID' && item.status !== 'CANCELLED';
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
                          className={`w-[260px] rounded-xl border p-3 ${TIMELINE_NODE_STYLES[item.status]} ${
                            isCurrentCycle ? 'ring-2 ring-primary/30' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-slate-600">{formatDate(item.expected_date)}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLES[item.status]}`}>
                              {STATUS_LABELS[item.status]}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {item.confirmed_by_name && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                <span className="material-symbols-outlined text-[13px] leading-none">verified_user</span>
                                Đã xác nhận
                              </span>
                            )}
                            {attachmentCount > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                                <span className="material-symbols-outlined text-[13px] leading-none">attach_file</span>
                                {attachmentCount} file
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {milestoneTone ? (
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${milestoneTone}`}>
                                {item.milestone_name}
                              </span>
                            ) : (
                              <p className="text-sm font-bold text-slate-900 line-clamp-2">
                                {item.milestone_name}
                              </p>
                            )}
                            <span className="text-xs font-semibold text-slate-400">#{item.cycle_number}</span>
                          </div>
                          <p className="text-sm text-slate-700 mt-1">{formatCurrency(item.expected_amount)}</p>
                          {item.status === 'OVERDUE' && overdueDays > 0 && (
                            <p className="text-xs text-red-600 mt-1">Quá hạn {overdueDays} ngày</p>
                          )}
                          {isCurrentCycle && item.status !== 'OVERDUE' && (
                            <p className="text-xs text-primary mt-1">Kỳ hiện tại</p>
                          )}
                          {item.confirmed_by_name && (
                            <p className="text-xs text-slate-500 mt-1">Người xác nhận: {item.confirmed_by_name}</p>
                          )}
                          {(item.attachments || []).length > 0 && (
                            <p className="text-xs text-slate-500 mt-1">{(item.attachments || []).length} file nghiệm thu</p>
                          )}

                          {canViewDetails && (
                            <button
                              type="button"
                              onClick={() => startConfirm(item)}
                              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-white hover:bg-deep-teal transition-colors"
                            >
                              <CircleDollarSign className="w-3.5 h-3.5" />
                              {canConfirm ? 'Xác nhận thu tiền' : 'Xem thu tiền'}
                            </button>
                          )}
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
          <div className="relative w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl animate-fade-in">
            <p className="text-sm font-semibold text-slate-900 mb-2">Xác nhận gỡ file</p>
            <p className="text-sm text-slate-600 mb-4">Bạn có chắc muốn gỡ file này khỏi kỳ thanh toán?</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRemoveAttachmentId(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={confirmRemoveAttachment}
                className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600"
              >
                Gỡ file
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmingItem && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={cancelConfirm} />
          <div className="relative w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div>
                <h4 className="text-sm font-bold text-slate-900">{isReadOnlyConfirm ? 'Chi tiết thu tiền' : 'Xác nhận thu tiền'}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {confirmingItem.milestone_name} #{confirmingItem.cycle_number}
                </p>
              </div>
              <button onClick={cancelConfirm} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600">Ngày thực thu</label>
                  <input
                    type="date"
                    value={actualDate}
                    onChange={(e) => setActualDate(e.target.value)}
                    disabled={isReadOnlyConfirm}
                    lang="vi-VN"
                    min={DATE_INPUT_MIN}
                    max={DATE_INPUT_MAX}
                    className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-600">Số tiền thực thu</label>
                    <button
                      type="button"
                      onClick={handleFillFullAmount}
                      disabled={isReadOnlyConfirm}
                      className="text-xs font-semibold text-primary hover:text-deep-teal"
                    >
                      Thu đủ
                    </button>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={actualAmount}
                    onChange={(e) => setActualAmount(e.target.value)}
                    disabled={isReadOnlyConfirm}
                    className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Ghi chú</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Nội dung thu tiền"
                  disabled={isReadOnlyConfirm}
                  className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              {(confirmingItem.confirmed_by_name || confirmingItem.confirmed_at) && (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
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
              />

              {attachmentError && (
                <p className="text-xs text-red-600 inline-flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {attachmentError}
                </p>
              )}

              {!attachmentError && attachmentNotice && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {attachmentNotice}
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                Số tiền dự kiến: <span className="font-semibold">{formatCurrency(Number(confirmingItem.expected_amount || 0))}</span>
                {' | '}Bạn đang nhập: <span className="font-semibold">{formatCurrency(previewAmount)}</span>
                {' -> '}Trạng thái:{' '}
                <span className="font-semibold">{previewStatus ? STATUS_LABELS[previewStatus] : '--'}</span>
              </div>

              {formError && (
                <p className="text-xs text-red-600 inline-flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {formError}
                </p>
              )}
            </div>

            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={cancelConfirm}
                className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100"
              >
                {isReadOnlyConfirm ? 'Đóng' : 'Hủy'}
              </button>
              {!isReadOnlyConfirm && (
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={String(submittingId || '') === String(confirmingItem.id)}
                  className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-deep-teal disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  {String(submittingId || '') === String(confirmingItem.id) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
