import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  IWorklog,
  WORKLOG_PHASES,
  WorklogPhase,
  WorklogPhaseSummary,
} from '../types/programmingRequest';
import { SearchableSelect } from './SearchableSelect';

const PHASE_LABEL: Record<WorklogPhase, string> = {
  ANALYZE: 'Phân tích',
  CODE: 'Lập trình',
  UPCODE: 'Upcode',
  NOTIFY: 'Thông báo',
  OTHER: 'Khác',
};

const worklogSchema = z.object({
  phase: z.enum(WORKLOG_PHASES),
  logged_date: z.string().min(1, 'Bắt buộc nhập ngày log').refine((value) => {
    const selected = new Date(value);
    if (Number.isNaN(selected.getTime())) {
      return false;
    }
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return selected.getTime() <= today.getTime();
  }, 'Không cho phép log ngày tương lai'),
  hours_estimated: z.union([z.number(), z.null()]),
  hours_spent: z.number().min(0.01, 'Giờ thực tế phải > 0').max(24, 'Giờ thực tế tối đa 24h'),
  content: z.string().min(1, 'Nội dung không được bỏ trống'),
});

type WorklogFormValues = z.infer<typeof worklogSchema>;

interface WorklogSectionProps {
  worklogs: IWorklog[];
  summary?: WorklogPhaseSummary[];
  loading?: boolean;
  onCreate: (payload: Pick<IWorklog, 'phase' | 'logged_date' | 'hours_estimated' | 'hours_spent' | 'content'>) => Promise<void> | void;
  onUpdate: (
    id: string | number,
    payload: Pick<IWorklog, 'phase' | 'logged_date' | 'hours_estimated' | 'hours_spent' | 'content'>
  ) => Promise<void> | void;
  onDelete: (id: string | number) => Promise<void> | void;
}

export const WorklogSection: React.FC<WorklogSectionProps> = ({
  worklogs,
  summary,
  loading = false,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    handleSubmit,
    setValue,
    reset,
    register,
    watch,
    formState: { errors },
  } = useForm<WorklogFormValues>({
    resolver: zodResolver(worklogSchema),
    defaultValues: {
      phase: 'OTHER',
      logged_date: new Date().toISOString().slice(0, 10),
      hours_estimated: null,
      hours_spent: 1,
      content: '',
    },
  });

  const phaseValue = watch('phase');

  const phaseSummary = useMemo(() => {
    if (Array.isArray(summary) && summary.length > 0) {
      return summary;
    }

    const map = new Map<WorklogPhase, WorklogPhaseSummary>();
    WORKLOG_PHASES.forEach((phase) => {
      map.set(phase, { phase, hours_spent_sum: 0, hours_estimated_sum: 0 });
    });

    worklogs.forEach((log) => {
      if (log.deleted_at) {
        return;
      }
      const phase = log.phase;
      const current = map.get(phase);
      if (!current) {
        return;
      }
      current.hours_spent_sum += Number(log.hours_spent || 0);
      current.hours_estimated_sum += Number(log.hours_estimated || 0);
    });

    return Array.from(map.values());
  }, [worklogs, summary]);

  const resetForm = () => {
    setEditingId(null);
    reset({
      phase: 'OTHER',
      logged_date: new Date().toISOString().slice(0, 10),
      hours_estimated: null,
      hours_spent: 1,
      content: '',
    });
  };

  const submitForm = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const payload = {
        phase: values.phase,
        logged_date: values.logged_date,
        hours_estimated: values.hours_estimated,
        hours_spent: values.hours_spent,
        content: values.content,
      };

      if (editingId !== null) {
        await onUpdate(editingId, payload);
      } else {
        await onCreate(payload);
      }

      resetForm();
    } finally {
      setSubmitting(false);
    }
  });

  const startEdit = (item: IWorklog) => {
    if (item.deleted_at) {
      return;
    }

    setEditingId(item.id);
    setValue('phase', item.phase);
    setValue('logged_date', item.logged_date || '');
    setValue('hours_estimated', item.hours_estimated);
    setValue('hours_spent', Number(item.hours_spent));
    setValue('content', item.content || '');
  };

  const formatNumber = (value: number) =>
    new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(value || 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="text-base font-bold text-slate-900 mb-3">Log giờ thực tế</h4>

        <form onSubmit={submitForm} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SearchableSelect
            value={phaseValue}
            onChange={(value) => setValue('phase', value as WorklogPhase, { shouldValidate: true })}
            options={WORKLOG_PHASES.map((phase) => ({ value: phase, label: PHASE_LABEL[phase] }))}
            label="Pha"
            required
            error={errors.phase?.message}
          />

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Ngày log <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              {...register('logged_date')}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {errors.logged_date?.message ? <p className="mt-1 text-xs text-red-500">{errors.logged_date.message}</p> : null}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Giờ ước tính</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="24"
              {...register('hours_estimated', {
                setValueAs: (value) => {
                  if (value === '' || value === null || value === undefined) {
                    return null;
                  }
                  const parsed = Number(value);
                  return Number.isFinite(parsed) ? parsed : null;
                },
              })}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {errors.hours_estimated?.message ? <p className="mt-1 text-xs text-red-500">{errors.hours_estimated.message}</p> : null}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Giờ thực tế <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="24"
              {...register('hours_spent', { valueAsNumber: true })}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {errors.hours_spent?.message ? <p className="mt-1 text-xs text-red-500">{errors.hours_spent.message}</p> : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Nội dung <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              {...register('content')}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {errors.content?.message ? <p className="mt-1 text-xs text-red-500">{errors.content.message}</p> : null}
          </div>

          <div className="md:col-span-2 flex items-center justify-end gap-2">
            {editingId !== null ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Hủy sửa
              </button>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-deep-teal disabled:opacity-60"
            >
              {submitting ? 'Đang lưu...' : editingId !== null ? 'Cập nhật log' : 'Thêm log'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead className="border-y border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-deep-teal">Ngày</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-deep-teal">Pha</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-deep-teal">Nội dung</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-deep-teal">Giờ ước tính</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-deep-teal">Giờ thực tế</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-deep-teal">Người log</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    Đang tải worklog...
                  </td>
                </tr>
              ) : worklogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    Chưa có worklog.
                  </td>
                </tr>
              ) : (
                worklogs.map((item) => {
                  const isDeleted = Boolean(item.deleted_at);
                  return (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 text-sm text-slate-700">{item.logged_date || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{PHASE_LABEL[item.phase]}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{item.content}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{item.hours_estimated === null ? '-' : formatNumber(Number(item.hours_estimated))}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(Number(item.hours_spent))}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{item.created_by_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {isDeleted ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">Đã xóa</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(item.id)}
                              className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                            >
                              Xóa
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50">
              {phaseSummary.map((row) => (
                <tr key={row.phase}>
                  <td className="px-4 py-2 text-xs font-semibold text-slate-600" colSpan={2}>
                    Tổng {PHASE_LABEL[row.phase]}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">-</td>
                  <td className="px-4 py-2 text-xs font-semibold text-slate-700">{formatNumber(row.hours_estimated_sum)}</td>
                  <td className="px-4 py-2 text-xs font-semibold text-slate-700">{formatNumber(row.hours_spent_sum)}</td>
                  <td className="px-4 py-2 text-xs text-slate-500" colSpan={2}>
                    -
                  </td>
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
