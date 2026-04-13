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

interface PeriodPreset {
  label: string;
  from: string;
  to: string;
}

function buildPresets(): PeriodPreset[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const firstDay = (year: number, month: number) => new Date(year, month, 1);
  const lastDay = (year: number, month: number) => new Date(year, month + 1, 0);

  const prevM = m === 0 ? 11 : m - 1;
  const prevY = m === 0 ? y - 1 : y;
  const qStart = Math.floor(m / 3) * 3;

  return [
    { label: 'Tháng này', from: fmt(firstDay(y, m)), to: fmt(lastDay(y, m)) },
    { label: 'Tháng trước', from: fmt(firstDay(prevY, prevM)), to: fmt(lastDay(prevY, prevM)) },
    { label: 'Quý này', from: fmt(firstDay(y, qStart)), to: fmt(lastDay(y, qStart + 2)) },
    { label: 'Năm này', from: `${y}-01-01`, to: `${y}-12-31` },
  ];
}

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

export const FeeCollectionHub: React.FC<FeeCollectionHubProps> = ({
  contracts, customers, currentUser, addToast,
  canAdd: canAddProp, canEdit: canEditProp, canDelete: canDeleteProp,
}) => {
  const canAdd = canAddProp ?? hasPermission(currentUser, 'fee_collection.write');
  const canEdit = canEditProp ?? hasPermission(currentUser, 'fee_collection.write');
  const canDelete = canDeleteProp ?? hasPermission(currentUser, 'fee_collection.delete');
  const presets = useMemo(() => buildPresets(), []);
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

  useEffect(() => {
    syncFromUrl();
  }, [syncFromUrl]);

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.from === periodFrom && preset.to === periodTo)?.label ?? '',
    [periodFrom, periodTo, presets]
  );

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

  const handlePreset = useCallback((p: PeriodPreset) => {
    setPeriod(p.from, p.to);
  }, [setPeriod]);

  const onNotify = useCallback((type: 'success' | 'error', title: string, message: string) => {
    addToast?.(type, title, message);
  }, [addToast]);

  const handleNavigateToInvoices = useCallback((filter?: { customer_id?: number; status?: string }) => {
    setInvoiceCustomerFilter(filter?.customer_id ? String(filter.customer_id) : '');
    setInvoiceStatusFilter(filter?.status ?? '');
    handleViewChange('INVOICES');
  }, [handleViewChange]);

  const handlePeriodFromChange = useCallback((value: string) => {
    setPeriod(value, periodTo);
  }, [periodTo, setPeriod]);

  const handlePeriodToChange = useCallback((value: string) => {
    setPeriod(periodFrom, value);
  }, [periodFrom, setPeriod]);

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
                <div className="flex flex-wrap items-center gap-2">
                  {presets.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => handlePreset(p)}
                      className={[
                        'inline-flex items-center rounded border px-2.5 py-1.5 text-xs font-semibold transition-colors',
                        selectedPreset === p.label
                          ? 'border-primary/20 bg-primary-container-soft text-deep-teal'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_auto_140px] sm:items-center">
                  <input
                    type="date"
                    value={periodFrom}
                    onChange={(e) => handlePeriodFromChange(e.target.value)}
                    className="h-8 rounded border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
                  />
                  <span className="text-center text-xs font-semibold text-slate-400">đến</span>
                  <input
                    type="date"
                    value={periodTo}
                    onChange={(e) => handlePeriodToChange(e.target.value)}
                    className="h-8 rounded border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
                  />
                </div>
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
