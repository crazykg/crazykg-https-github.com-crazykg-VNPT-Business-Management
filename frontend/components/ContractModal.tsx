import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CircleDollarSign, Loader2 } from 'lucide-react';
import { CONTRACT_STATUSES } from '../constants';
import {
  Contract,
  Customer,
  PaymentCycle,
  PaymentSchedule,
  PaymentScheduleStatus,
  Project,
} from '../types';
import { PaymentScheduleTab } from './PaymentScheduleTab';

type ContractModalTab = 'CONTRACT' | 'PAYMENT';

interface ContractModalProps {
  type: 'ADD' | 'EDIT';
  data?: Contract | null;
  projects: Project[];
  customers: Customer[];
  paymentSchedules: PaymentSchedule[];
  isPaymentLoading?: boolean;
  onClose: () => void;
  onSave: (data: Partial<Contract>) => Promise<void> | void;
  onGenerateSchedules?: (contractId: string | number) => Promise<void>;
  onRefreshSchedules?: (contractId: string | number) => Promise<void>;
  onConfirmPayment?: (
    scheduleId: string | number,
    payload: Pick<PaymentSchedule, 'actual_paid_date' | 'actual_paid_amount' | 'status' | 'notes'>
  ) => Promise<void>;
}

const PAYMENT_CYCLE_LABELS: Record<PaymentCycle, string> = {
  ONCE: 'Một lần',
  MONTHLY: 'Hàng tháng',
  QUARTERLY: 'Hàng quý',
  HALF_YEARLY: '6 tháng/lần',
  YEARLY: 'Hàng năm',
};

const PAYMENT_CYCLE_OPTIONS: Array<{ value: PaymentCycle; label: string }> = [
  { value: 'ONCE', label: 'Một lần' },
  { value: 'MONTHLY', label: 'Hàng tháng' },
  { value: 'QUARTERLY', label: 'Hàng quý' },
  { value: 'HALF_YEARLY', label: '6 tháng/lần' },
  { value: 'YEARLY', label: 'Hàng năm' },
];

const normalizeMode = (mode: unknown): 'DAU_TU' | 'THUE_DICH_VU' | null => {
  const raw = String(mode || '').trim().toUpperCase();
  if (!raw) return null;
  if (raw.includes('DAU') || raw.includes('ĐẦU')) return 'DAU_TU';
  if (raw.includes('THUE') || raw.includes('THUÊ')) return 'THUE_DICH_VU';
  if (raw === 'DAU_TU') return 'DAU_TU';
  if (raw === 'THUE_DICH_VU') return 'THUE_DICH_VU';
  return null;
};

const formatCurrency = (value: number | string): string => {
  if (value === '' || value === null || value === undefined) return '';
  const number = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(number)) return '';
  return new Intl.NumberFormat('vi-VN').format(number);
};

const parseCurrency = (value: number | string): number => {
  if (typeof value === 'number') return value;
  const parsed = Number(String(value).replace(/[^\d-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const ContractModal: React.FC<ContractModalProps> = ({
  type,
  data,
  projects = [],
  customers = [],
  paymentSchedules = [],
  isPaymentLoading = false,
  onClose,
  onSave,
  onGenerateSchedules,
  onRefreshSchedules,
  onConfirmPayment,
}) => {
  const [activeTab, setActiveTab] = useState<ContractModalTab>('CONTRACT');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<Partial<Contract>>({
    contract_code: data?.contract_code || data?.contract_number || '',
    contract_name: data?.contract_name || '',
    customer_id: data?.customer_id || '',
    project_id: data?.project_id || '',
    value: data?.value || data?.total_value || 0,
    payment_cycle: data?.payment_cycle || 'ONCE',
    status: data?.status || 'DRAFT',
  });

  const selectedProject = useMemo(
    () => projects.find((project) => String(project.id) === String(formData.project_id || '')),
    [projects, formData.project_id]
  );

  const projectMode = normalizeMode(selectedProject?.investment_mode || selectedProject?.project_name);
  const isInvestmentProject = projectMode === 'DAU_TU';
  const isServiceProject = projectMode === 'THUE_DICH_VU';

  const cycleOptions = useMemo(() => {
    if (isInvestmentProject) {
      return PAYMENT_CYCLE_OPTIONS.filter((item) => item.value === 'ONCE');
    }

    if (isServiceProject) {
      return PAYMENT_CYCLE_OPTIONS.filter((item) => item.value !== 'ONCE');
    }

    return PAYMENT_CYCLE_OPTIONS;
  }, [isInvestmentProject, isServiceProject]);

  useEffect(() => {
    const nextValue = formData.payment_cycle || '';
    const allowedValues = cycleOptions.map((item) => item.value);

    if (!nextValue || !allowedValues.includes(nextValue as PaymentCycle)) {
      if (isInvestmentProject) {
        setFormData((prev) => ({ ...prev, payment_cycle: 'ONCE' }));
      } else if (isServiceProject) {
        setFormData((prev) => ({ ...prev, payment_cycle: 'MONTHLY' }));
      }
    }
  }, [cycleOptions, formData.payment_cycle, isInvestmentProject, isServiceProject]);

  const contractId = data?.id;
  const schedules = useMemo(
    () => paymentSchedules.filter((item) => String(item.contract_id) === String(contractId || '')),
    [paymentSchedules, contractId]
  );

  const handleChange = (field: keyof Contract, value: unknown) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'project_id') {
        const project = projects.find((item) => String(item.id) === String(value));
        if (project) {
          if (!next.customer_id) {
            next.customer_id = project.customer_id;
          }
          const total = (project.items || []).reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
          if (total > 0) {
            next.value = total;
          }
        }
      }
      return next;
    });

    if (errors[field as string]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};
    if (!formData.contract_code) nextErrors.contract_code = 'Mã hợp đồng là bắt buộc.';
    if (!formData.contract_name) nextErrors.contract_name = 'Tên hợp đồng là bắt buộc.';
    if (!formData.customer_id) nextErrors.customer_id = 'Vui lòng chọn khách hàng.';
    if (!formData.project_id) nextErrors.project_id = 'Vui lòng chọn dự án.';
    if (!formData.payment_cycle) nextErrors.payment_cycle = 'Vui lòng chọn chu kỳ thanh toán.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    await Promise.resolve(
      onSave({
        ...formData,
        value: parseCurrency(formData.value || 0),
      })
    );
  };

  const handleGenerateSchedules = async () => {
    if (!contractId || !onGenerateSchedules) return;
    setIsGenerating(true);
    try {
      await onGenerateSchedules(contractId);
    } catch {
      // Error toast is handled at App level.
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmPayment = async (
    scheduleId: string | number,
    payload: Pick<PaymentSchedule, 'actual_paid_date' | 'actual_paid_amount' | 'status' | 'notes'>
  ) => {
    if (!onConfirmPayment) return;
    await onConfirmPayment(scheduleId, payload);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3 text-slate-900">
            <span className="material-symbols-outlined text-primary text-2xl">description</span>
            <h2 className="text-lg md:text-xl font-bold leading-tight tracking-tight line-clamp-1">
              {type === 'ADD' ? 'Thêm mới Hợp đồng' : 'Cập nhật Hợp đồng'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        {type === 'EDIT' && (
          <div className="px-6 pt-4 pb-2 border-b border-slate-100 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('CONTRACT')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === 'CONTRACT' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Thông tin hợp đồng
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PAYMENT')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-2 ${
                activeTab === 'PAYMENT' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <CircleDollarSign className="w-4 h-4" />
              Dòng tiền
            </button>
          </div>
        )}

        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {(type === 'ADD' || activeTab === 'CONTRACT') && (
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Mã hợp đồng <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.contract_code || ''}
                    onChange={(e) => handleChange('contract_code', e.target.value)}
                    placeholder="HD-2026-001"
                    className={`w-full h-11 px-4 rounded-lg border bg-white text-slate-900 outline-none transition-all ${
                      errors.contract_code ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary'
                    }`}
                  />
                  {errors.contract_code && <p className="text-xs text-red-600">{errors.contract_code}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Tên hợp đồng <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.contract_name || ''}
                    onChange={(e) => handleChange('contract_name', e.target.value)}
                    placeholder="Hợp đồng triển khai giải pháp..."
                    className={`w-full h-11 px-4 rounded-lg border bg-white text-slate-900 outline-none transition-all ${
                      errors.contract_name ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary'
                    }`}
                  />
                  {errors.contract_name && <p className="text-xs text-red-600">{errors.contract_name}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Khách hàng <span className="text-red-500">*</span></label>
                  <select
                    value={formData.customer_id ? String(formData.customer_id) : ''}
                    onChange={(e) => handleChange('customer_id', e.target.value)}
                    className={`w-full h-11 px-4 rounded-lg border bg-white text-slate-900 outline-none transition-all ${
                      errors.customer_id ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary'
                    }`}
                  >
                    <option value="">Chọn khách hàng</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {`${customer.customer_code} - ${customer.customer_name}`}
                      </option>
                    ))}
                  </select>
                  {errors.customer_id && <p className="text-xs text-red-600">{errors.customer_id}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Dự án liên kết <span className="text-red-500">*</span></label>
                  <select
                    value={formData.project_id ? String(formData.project_id) : ''}
                    onChange={(e) => handleChange('project_id', e.target.value)}
                    className={`w-full h-11 px-4 rounded-lg border bg-white text-slate-900 outline-none transition-all ${
                      errors.project_id ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary'
                    }`}
                  >
                    <option value="">Chọn dự án</option>
                    {(projects || [])
                      .filter((project) => !formData.customer_id || String(project.customer_id) === String(formData.customer_id))
                      .map((project) => (
                        <option key={project.id} value={project.id}>
                          {`${project.project_code} - ${project.project_name}`}
                        </option>
                      ))}
                  </select>
                  {errors.project_id && <p className="text-xs text-red-600">{errors.project_id}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Giá trị hợp đồng (VNĐ)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formatCurrency(formData.value || 0)}
                      onChange={(e) => handleChange('value', e.target.value)}
                      onBlur={() => setFormData((prev) => ({ ...prev, value: parseCurrency(prev.value || 0) }))}
                      placeholder="0"
                      className="w-full h-11 pl-4 pr-10 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400 font-bold">₫</div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 inline-flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-primary" />
                    Chu kỳ thanh toán <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.payment_cycle || ''}
                    onChange={(e) => handleChange('payment_cycle', e.target.value as PaymentCycle)}
                    disabled={isInvestmentProject}
                    className={`w-full h-11 px-4 rounded-lg border bg-white text-slate-900 outline-none transition-all ${
                      errors.payment_cycle ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary'
                    } ${isInvestmentProject ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                  >
                    {cycleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.payment_cycle && <p className="text-xs text-red-600">{errors.payment_cycle}</p>}
                {isInvestmentProject && (
                    <p className="text-xs text-slate-500">Dự án đầu tư: hệ thống khóa chu kỳ ở giá trị Một lần.</p>
                )}
                {isServiceProject && (
                    <p className="text-xs text-slate-500">Dự án thuê dịch vụ: cho phép chọn các chu kỳ Hàng tháng, Hàng quý, 6 tháng/lần, Hàng năm.</p>
                )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Trạng thái</label>
                  <select
                    value={formData.status || 'DRAFT'}
                    onChange={(e) => handleChange('status', e.target.value)}
                    className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  >
                    {CONTRACT_STATUSES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Chu kỳ hiện tại</label>
                  <div className="h-11 px-4 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-sm flex items-center">
                    {PAYMENT_CYCLE_LABELS[(formData.payment_cycle || 'ONCE') as PaymentCycle] || 'Một lần'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {type === 'EDIT' && activeTab === 'PAYMENT' && (
            <div className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 inline-flex items-center gap-2">
                    <CircleDollarSign className="w-4 h-4 text-primary" />
                    Dòng tiền hợp đồng
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Theo dõi các mốc thu tiền theo chu kỳ {PAYMENT_CYCLE_LABELS[(formData.payment_cycle || 'ONCE') as PaymentCycle] || 'Một lần'}.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateSchedules}
                  disabled={!contractId || !onGenerateSchedules || isGenerating}
                  className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-deep-teal disabled:opacity-60 inline-flex items-center gap-2"
                >
                  {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Sinh kỳ thanh toán
                </button>
              </div>

              <PaymentScheduleTab
                schedules={schedules}
                isLoading={isPaymentLoading}
                onRefresh={contractId && onRefreshSchedules ? () => onRefreshSchedules(contractId) : undefined}
                onConfirmPayment={(scheduleId, payload) =>
                  handleConfirmPayment(scheduleId, {
                    actual_paid_date: payload.actual_paid_date || new Date().toISOString().slice(0, 10),
                    actual_paid_amount: Number(payload.actual_paid_amount || 0),
                    status: (payload.status || 'PAID') as PaymentScheduleStatus,
                    notes: payload.notes || null,
                  })
                }
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors">
            Hủy
          </button>
          {(type === 'ADD' || activeTab === 'CONTRACT') && (
            <button
              onClick={handleSave}
              className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-deep-teal shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">check</span> {type === 'ADD' ? 'Lưu' : 'Cập nhật'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
