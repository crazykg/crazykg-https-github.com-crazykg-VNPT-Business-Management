export interface InvoiceStatusMeta {
  bg: string;
  text: string;
  label: string;
}

export const INVOICE_STATUS_BADGE: Record<string, InvoiceStatusMeta> = {
  DRAFT:     { bg: 'bg-slate-100',  text: 'text-slate-600',  label: 'Nháp' },
  ISSUED:    { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Đã phát hành' },
  PARTIAL:   { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Thanh toán 1 phần' },
  PAID:      { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Đã thanh toán' },
  CANCELLED: { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Đã huỷ' },
  VOID:      { bg: 'bg-zinc-200',   text: 'text-zinc-600',   label: 'Vô hiệu' },
};

export const getInvoiceStatusMeta = (status: string): InvoiceStatusMeta =>
  INVOICE_STATUS_BADGE[status] ?? { bg: 'bg-slate-100', text: 'text-slate-600', label: status };
