import React, { useEffect, useState } from 'react';
import { AuthUser, Contract, Customer } from '../types';
import { hasPermission } from '../utils/authorization';
import { FeeCollectionDashboard } from './fee-collection/FeeCollectionDashboard';
import { InvoiceList } from './fee-collection/InvoiceList';
import { ReceiptList } from './fee-collection/ReceiptList';
import { DebtAgingReport } from './fee-collection/DebtAgingReport';

type SubView = 'DASHBOARD' | 'INVOICES' | 'RECEIPTS' | 'DEBT_REPORT';

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

const SUB_VIEWS: { id: SubView; label: string; icon: string }[] = [
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
  const presets = buildPresets();
  const [activeView, setActiveView] = useState<SubView>('DASHBOARD');
  const [periodFrom, setPeriodFrom] = useState(presets[0].from);
  const [periodTo, setPeriodTo] = useState(presets[0].to);
  const [selectedPreset, setSelectedPreset] = useState<string>(presets[0].label);

  // Invoice filter carry-over from Dashboard navigation
  const [invoiceCustomerFilter, setInvoiceCustomerFilter] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('');

  // URL state sync
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('fc_view') as SubView | null;
    const from = params.get('fc_period_from');
    const to = params.get('fc_period_to');
    if (view && SUB_VIEWS.some((v) => v.id === view)) setActiveView(view);
    if (from) setPeriodFrom(from);
    if (to) setPeriodTo(to);
  }, []);

  const updateUrl = (view: SubView, from: string, to: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('fc_view', view);
    params.set('fc_period_from', from);
    params.set('fc_period_to', to);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  };

  const handleViewChange = (v: SubView) => {
    setActiveView(v);
    updateUrl(v, periodFrom, periodTo);
  };

  const handlePreset = (p: PeriodPreset) => {
    setSelectedPreset(p.label);
    setPeriodFrom(p.from);
    setPeriodTo(p.to);
    updateUrl(activeView, p.from, p.to);
  };

  const onNotify = (type: 'success' | 'error', title: string, message: string) => {
    addToast?.(type, title, message);
  };

  const handleNavigateToInvoices = (filter?: { customer_id?: number; status?: string }) => {
    setInvoiceCustomerFilter(filter?.customer_id ? String(filter.customer_id) : '');
    setInvoiceStatusFilter(filter?.status ?? '');
    handleViewChange('INVOICES');
  };

  const showPeriodSelector = activeView === 'DASHBOARD';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-xl">receipt_long</span>
            <h1 className="text-base font-semibold text-gray-800">Thu cước & Công nợ</h1>
          </div>

          {/* Sub-view tabs */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-gray-50 ml-2">
            {SUB_VIEWS.map((v) => (
              <button key={v.id} onClick={() => handleViewChange(v.id)}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeView === v.id
                    ? 'bg-white text-blue-700 shadow-sm border-r border-l border-gray-200 -mx-px z-10 relative'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                <span className="material-symbols-outlined text-sm">{v.icon}</span>
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>

          {/* Period selector — only for Dashboard */}
          {showPeriodSelector && (
            <div className="flex items-center gap-2 ml-auto">
              <div className="flex border border-gray-200 rounded overflow-hidden bg-gray-50">
                {presets.map((p) => (
                  <button key={p.label} onClick={() => handlePreset(p)}
                    className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                      selectedPreset === p.label ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <input type="date" value={periodFrom} onChange={(e) => { setPeriodFrom(e.target.value); setSelectedPreset(''); updateUrl(activeView, e.target.value, periodTo); }}
                  className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-32" />
                <span>—</span>
                <input type="date" value={periodTo} onChange={(e) => { setPeriodTo(e.target.value); setSelectedPreset(''); updateUrl(activeView, periodFrom, e.target.value); }}
                  className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-32" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {activeView === 'DASHBOARD' && (
          <FeeCollectionDashboard
            periodFrom={periodFrom}
            periodTo={periodTo}
            onNotify={onNotify}
            onNavigateToInvoices={handleNavigateToInvoices}
          />
        )}
        {activeView === 'INVOICES' && (
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
        )}
        {activeView === 'RECEIPTS' && (
          <ReceiptList
            contracts={contracts}
            customers={customers}
            canAdd={canAdd}
            canEdit={canEdit}
            canDelete={canDelete}
            onNotify={onNotify}
          />
        )}
        {activeView === 'DEBT_REPORT' && (
          <DebtAgingReport onNotify={onNotify} />
        )}
      </div>
    </div>
  );
};
