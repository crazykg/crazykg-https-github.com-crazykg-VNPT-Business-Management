import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthUser, Contract, Customer } from '../types';
import {
  fetchFeeCollectionDashboard,
  fetchInvoices,
  fetchReceipts,
} from '../services/v5Api';
import { queryClient } from '../shared/queryClient';
import { queryKeys } from '../shared/queryKeys';
import { FeeCollectionSubView, useFeeCollectionStore } from '../shared/stores/feeCollectionStore';
import { hasPermission } from '../utils/authorization';
import { FeeCollectionDashboard } from './fee-collection/FeeCollectionDashboard';
import { InvoiceList } from './fee-collection/InvoiceList';
import { ReceiptList } from './fee-collection/ReceiptList';
import { DebtAgingReport } from './fee-collection/DebtAgingReport';
import {
  DateRangePresetPicker,
  getDefaultCustomDateRange,
  resolveDateRangePresetRange,
  type DateRangePresetValue,
} from './DateRangePresetPicker';

interface FeeCollectionHubProps {
  contracts: Contract[];
  customers: Customer[];
  currentUser: AuthUser | null;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  addToast?: (type: 'success' | 'error', title: string, message: string) => void;
}

const SUB_VIEWS: { id: FeeCollectionSubView; label: string; icon: string }[] = [
  { id: 'DASHBOARD', label: 'Tổng quan', icon: 'dashboard' },
  { id: 'INVOICES', label: 'Hóa đơn', icon: 'receipt_long' },
  { id: 'RECEIPTS', label: 'Phiếu thu', icon: 'payments' },
  { id: 'DEBT_REPORT', label: 'Báo cáo công nợ', icon: 'analytics' },
];

const PRESET_VALUES: DateRangePresetValue[] = ['this_month', 'last_month', 'this_quarter', 'this_year'];

const resolvePresetValueFromRange = (from: string, to: string): DateRangePresetValue =>
  PRESET_VALUES.find((preset) => {
    const range = resolveDateRangePresetRange(preset, '', '');
    return range.from === from && range.to === to;
  }) ?? 'custom';

export const FeeCollectionHub: React.FC<FeeCollectionHubProps> = ({
  contracts, customers, currentUser, addToast,
  canAdd: canAddProp, canEdit: canEditProp, canDelete: canDeleteProp,
}) => {
  const canAdd = canAddProp ?? hasPermission(currentUser, 'fee_collection.write');
  const canEdit = canEditProp ?? hasPermission(currentUser, 'fee_collection.write');
  const canDelete = canDeleteProp ?? hasPermission(currentUser, 'fee_collection.delete');
  const defaultCustomDateRange = useMemo(() => getDefaultCustomDateRange(), []);
  const {
    activeView,
    periodFrom,
    periodTo,
    setActiveView,
    setPeriod,
    syncFromUrl,
  } = useFeeCollectionStore();

  // Invoice filter carry-over from Dashboard navigation
  const [invoiceCustomerFilter, setInvoiceCustomerFilter] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('');
  const [customDateFrom, setCustomDateFrom] = useState(defaultCustomDateRange.from);
  const [customDateTo, setCustomDateTo] = useState(defaultCustomDateRange.to);
  const [periodPreset, setPeriodPreset] = useState<DateRangePresetValue>(() => resolvePresetValueFromRange(periodFrom, periodTo));

  useEffect(() => {
    syncFromUrl();
  }, [syncFromUrl]);

  useEffect(() => {
    const inferredPreset = resolvePresetValueFromRange(periodFrom, periodTo);

    if (periodPreset === 'custom') {
      const isTrackingCustomRange = periodFrom === customDateFrom && periodTo === customDateTo;
      if (!isTrackingCustomRange) {
        setPeriodPreset(inferredPreset);
      }
    } else if (periodPreset !== inferredPreset) {
      setPeriodPreset(inferredPreset);
    }

    if (inferredPreset === 'custom') {
      setCustomDateFrom(periodFrom || defaultCustomDateRange.from);
      setCustomDateTo(periodTo || defaultCustomDateRange.to);
    }
  }, [
    customDateFrom,
    customDateTo,
    defaultCustomDateRange.from,
    defaultCustomDateRange.to,
    periodFrom,
    periodPreset,
    periodTo,
  ]);

  const handleViewChange = useCallback((v: FeeCollectionSubView) => {
    setActiveView(v);
  }, [setActiveView]);

  const handlePrefetchView = useCallback((view: FeeCollectionSubView) => {
    if (view === 'DASHBOARD') {
      const filters = { period_from: periodFrom, period_to: periodTo };
      void queryClient.prefetchQuery({
        queryKey: queryKeys.invoices.dashboard(filters),
        queryFn: () => fetchFeeCollectionDashboard(filters),
        staleTime: 60_000,
      });
      return;
    }

    if (view === 'INVOICES') {
      const queryFilters = {
        page: 1,
        per_page: 25,
        sort_key: 'invoice_date',
        sort_dir: 'desc' as const,
        customer_id: invoiceCustomerFilter || undefined,
        status: invoiceStatusFilter || undefined,
      };
      const apiFilters: Record<string, string> = {
        page: '1',
        per_page: '25',
        sort_key: 'invoice_date',
        sort_dir: 'desc',
      };
      if (invoiceCustomerFilter) apiFilters.customer_id = invoiceCustomerFilter;
      if (invoiceStatusFilter) apiFilters.status = invoiceStatusFilter;

      void queryClient.prefetchQuery({
        queryKey: queryKeys.invoices.list(queryFilters),
        queryFn: () => fetchInvoices(apiFilters),
        staleTime: 60_000,
      });
      return;
    }

    if (view === 'RECEIPTS') {
      const queryFilters = {
        page: 1,
        per_page: 25,
        sort_key: 'receipt_date',
        sort_dir: 'desc' as const,
      };

      void queryClient.prefetchQuery({
        queryKey: queryKeys.receipts.list(queryFilters),
        queryFn: () => fetchReceipts({
          page: '1',
          per_page: '25',
          sort_key: 'receipt_date',
          sort_dir: 'desc',
        }),
        staleTime: 60_000,
      });
    }
  }, [invoiceCustomerFilter, invoiceStatusFilter, periodFrom, periodTo]);

  const handlePresetChange = useCallback((preset: DateRangePresetValue) => {
    setPeriodPreset(preset);

    if (preset === 'custom') {
      setPeriod(customDateFrom, customDateTo);
      return;
    }

    const range = resolveDateRangePresetRange(preset, customDateFrom, customDateTo);
    setPeriod(range.from, range.to);
  }, [customDateFrom, customDateTo, setPeriod]);

  const onNotify = useCallback((type: 'success' | 'error', title: string, message: string) => {
    addToast?.(type, title, message);
  }, [addToast]);

  const handleNavigateToInvoices = useCallback((filter?: { customer_id?: number; status?: string }) => {
    setInvoiceCustomerFilter(filter?.customer_id ? String(filter.customer_id) : '');
    setInvoiceStatusFilter(filter?.status ?? '');
    handleViewChange('INVOICES');
  }, [handleViewChange]);

  const handlePeriodFromChange = useCallback((value: string) => {
    setCustomDateFrom(value);
    if (periodPreset === 'custom') {
      setPeriod(value, customDateTo);
    }
  }, [customDateTo, periodPreset, setPeriod]);

  const handlePeriodToChange = useCallback((value: string) => {
    setCustomDateTo(value);
    if (periodPreset === 'custom') {
      setPeriod(customDateFrom, value);
    }
  }, [customDateFrom, periodPreset, setPeriod]);

  const showPeriodSelector = useMemo(() => activeView === 'DASHBOARD', [activeView]);

  const contentNode = useMemo(() => {
    if (activeView === 'DASHBOARD') {
      return (
        <FeeCollectionDashboard
          periodFrom={periodFrom}
          periodTo={periodTo}
          onNotify={onNotify}
          onNavigateToInvoices={handleNavigateToInvoices}
        />
      );
    }

    if (activeView === 'INVOICES') {
      return (
        <InvoiceList
          contracts={contracts}
          customers={customers}
          canAdd={canAdd}
          canEdit={canEdit}
          canDelete={canDelete}
          onNotify={onNotify}
          initialCustomerFilter={invoiceCustomerFilter}
          initialStatusFilter={invoiceStatusFilter}
        />
      );
    }

    if (activeView === 'RECEIPTS') {
      return (
        <ReceiptList
          contracts={contracts}
          customers={customers}
          canAdd={canAdd}
          canEdit={canEdit}
          canDelete={canDelete}
          onNotify={onNotify}
        />
      );
    }

    return <DebtAgingReport onNotify={onNotify} />;
  }, [
    activeView,
    canAdd,
    canDelete,
    canEdit,
    contracts,
    customers,
    handleNavigateToInvoices,
    invoiceCustomerFilter,
    invoiceStatusFilter,
    onNotify,
    periodFrom,
    periodTo,
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col p-3 pb-6">
      <div className="flex-none overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-secondary/15">
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>
                  receipt_long
                </span>
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold leading-tight text-deep-teal">Thu cước &amp; Công nợ</h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {SUB_VIEWS.find((item) => item.id === activeView)?.label || 'Tổng quan'}
              </span>
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral ring-1 ring-slate-200">
                {periodFrom} &rarr; {periodTo}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3 bg-slate-50/60 px-3 py-3">
          <div className="overflow-x-auto">
            <div className="flex min-w-max items-center gap-2">
              {SUB_VIEWS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => handleViewChange(v.id)}
                  onMouseEnter={() => handlePrefetchView(v.id)}
                  className={[
                    'inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors',
                    activeView === v.id
                      ? 'border-primary bg-primary text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{v.icon}</span>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {showPeriodSelector ? (
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-700">Chu kỳ theo dõi</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-primary-container-soft px-2 py-0.5 text-[10px] font-bold text-deep-teal">
                  Dashboard
                </span>
              </div>

              <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                <DateRangePresetPicker
                  size="dense"
                  label="Chu kỳ:"
                  value={periodPreset}
                  onPresetChange={handlePresetChange}
                  dateFrom={customDateFrom}
                  dateTo={customDateTo}
                  onDateFromChange={handlePeriodFromChange}
                  onDateToChange={handlePeriodToChange}
                  dateFromLabel="Kỳ thu từ"
                  dateToLabel="Kỳ thu đến"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex-1 min-h-0 overflow-auto">
        {contentNode}
      </div>
    </div>
  );
};
