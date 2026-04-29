import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { PublicProcedurePayload, PublicProcedureStep } from '../types';
import { fetchPublicProcedureShare } from '../services/api/projectApi';

type LoadState = 'locked' | 'loading' | 'ready' | 'error';

const formatDate = (value: string | null | undefined): string => {
  if (!value) return '';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('vi-VN');
};

const formatExpiry = (value: string | null | undefined): string => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const statusClassName = (status: string | null | undefined): string => {
  switch (String(status || '').toUpperCase()) {
    case 'HOAN_THANH':
      return 'text-emerald-800';
    case 'DANG_THUC_HIEN':
      return 'text-amber-800';
    default:
      return 'text-slate-700';
  }
};

const toRomanNumeral = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return String(value);

  const romanMap: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];

  let remaining = Math.floor(value);
  let result = '';

  for (const [number, roman] of romanMap) {
    while (remaining >= number) {
      result += roman;
      remaining -= number;
    }
  }

  return result;
};

const resolveDocumentText = (step: PublicProcedureStep): string => {
  const number = String(step.document_number || '').trim();
  const date = formatDate(step.document_date);
  if (number && date) return `${number} - ${date}`;
  return number || date || '';
};

const resolveErrorStatus = (error: unknown): number | null => {
  if (!error || typeof error !== 'object' || !('status' in error)) return null;
  const status = Number((error as { status?: unknown }).status);
  return Number.isFinite(status) ? status : null;
};

export const PublicProjectProcedurePage: React.FC = () => {
  const location = useLocation();
  const token = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const raw = segments[0] === 'public' && segments[1] === 'project-procedure'
      ? segments[2] || ''
      : segments[segments.length - 1] || '';
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [location.pathname]);

  const [state, setState] = useState<LoadState>(() => (token ? 'locked' : 'error'));
  const [payload, setPayload] = useState<PublicProcedurePayload | null>(null);
  const [accessKey, setAccessKey] = useState('');
  const [errorMessage, setErrorMessage] = useState(() => (token ? '' : 'Link public thiếu token.'));
  const accessKeyInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setState(token ? 'locked' : 'error');
    setPayload(null);
    setAccessKey('');
    setErrorMessage(token ? '' : 'Link public thiếu token.');
  }, [token]);

  useEffect(() => {
    if (state === 'locked') {
      window.setTimeout(() => accessKeyInputRef.current?.focus(), 0);
    }
  }, [state]);

  const handleUnlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setErrorMessage('Link public thiếu token.');
      setState('error');
      return;
    }

    const normalizedKey = accessKey.trim();
    if (!normalizedKey) {
      setErrorMessage('Vui lòng nhập key truy cập.');
      accessKeyInputRef.current?.focus();
      return;
    }

    setState('loading');
    setErrorMessage('');
    setPayload(null);

    try {
      const data = await fetchPublicProcedureShare(token, normalizedKey);
      setPayload(data);
      setState('ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể mở bảng thủ tục.';
      setPayload(null);
      setErrorMessage(message);
      setState(resolveErrorStatus(error) === 404 ? 'error' : 'locked');
    }
  };

  const projectTitle = useMemo(() => {
    const code = String(payload?.project.project_code || '').trim();
    const name = String(payload?.project.project_name || '').trim();
    return `${code}${code && name ? ' - ' : ''}${name}`.trim() || 'Dự án';
  }, [payload]);
  const procedureTitle = useMemo(() => {
    const name = String(payload?.project.project_name || '').trim();
    const procedureName = String(payload?.procedure.procedure_name || '').trim();
    const derivedProjectPlanName = name ? `Kế hoạch triển khai - ${name}` : '';

    return procedureName && procedureName !== derivedProjectPlanName ? procedureName : '';
  }, [payload]);

  if (state === 'locked') {
    return (
      <main className="h-[100dvh] min-h-[100dvh] overflow-y-auto overscroll-contain bg-slate-50 text-slate-900">
        <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center px-4 py-6">
          <section className="w-full rounded border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 inline-flex h-8 items-center gap-2 rounded border border-primary/20 bg-primary/5 px-2.5 text-xs font-semibold text-primary">
              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">lock</span>
              Bảng thủ tục public
            </div>
            <h1 className="text-base font-bold text-slate-900">Nhập key truy cập</h1>

            <form className="mt-4 space-y-3" onSubmit={handleUnlock}>
              <div>
                <input
                  ref={accessKeyInputRef}
                  id="public-procedure-access-key"
                  data-testid="public-procedure-access-key"
                  type="password"
                  autoComplete="off"
                  aria-label="Key truy cập"
                  value={accessKey}
                  onChange={(event) => {
                    setAccessKey(event.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  aria-invalid={errorMessage ? 'true' : undefined}
                  aria-describedby={errorMessage ? 'public-procedure-key-error' : undefined}
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
                  placeholder="Nhập key truy cập"
                />
                {errorMessage ? (
                  <p id="public-procedure-key-error" role="alert" aria-live="assertive" className="mt-2 text-xs font-semibold text-rose-700">
                    {errorMessage}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                data-testid="public-procedure-unlock"
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded bg-primary px-3 text-sm font-bold text-white transition-colors hover:bg-deep-teal focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <span className="material-symbols-outlined text-[17px]" aria-hidden="true">key</span>
                Mở bảng thủ tục
              </button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  if (state === 'loading') {
    return (
      <main className="h-[100dvh] min-h-[100dvh] overflow-y-auto overscroll-contain bg-slate-50 text-slate-900">
        <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center px-4">
          <div className="flex items-center gap-3 text-slate-600" role="status" aria-live="polite">
            <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
            <span className="text-sm font-semibold">Đang kiểm tra key truy cập...</span>
          </div>
        </div>
      </main>
    );
  }

  if (state === 'error' || !payload) {
    return (
      <main className="h-[100dvh] min-h-[100dvh] overflow-y-auto overscroll-contain bg-slate-50 text-slate-900">
        <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center px-4">
          <section className="w-full rounded border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-rose-700" aria-hidden="true">link_off</span>
              <div>
                <h1 className="text-base font-bold text-slate-900">Không mở được bảng thủ tục</h1>
                <p className="mt-1 text-sm text-slate-600">{errorMessage || 'Link public không còn hiệu lực.'}</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="h-[100dvh] min-h-[100dvh] overflow-y-auto overscroll-contain bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-2 inline-flex h-8 items-center gap-2 rounded border border-primary/20 bg-primary/5 px-2.5 text-xs font-semibold text-primary">
                <span className="material-symbols-outlined text-[15px]" aria-hidden="true">account_tree</span>
                Bảng thủ tục public
              </div>
              <h1 className="text-lg font-bold text-deep-teal sm:text-xl">{projectTitle}</h1>
              {procedureTitle ? (
                <p className="mt-1 text-sm font-semibold text-slate-700">{procedureTitle}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 md:min-w-[430px]">
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase text-slate-500">Tiến độ</div>
                <div className="text-lg font-black text-deep-teal">{payload.summary.overall_percent}%</div>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase text-slate-500">Tổng bước</div>
                <div className="text-lg font-black text-slate-900">{payload.summary.total_steps}</div>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase text-slate-500">Hoàn thành</div>
                <div className="text-lg font-black text-emerald-800">{payload.summary.completed_steps}</div>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase text-slate-500">Hết hạn</div>
                <div className="text-xs font-bold text-slate-700">{formatExpiry(payload.share?.expires_at) || 'Theo hạn public'}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-8 pt-4 sm:px-6 sm:pb-10">
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200 ring-1 ring-inset ring-slate-300">
          <div className="h-full rounded-full bg-primary" style={{ width: `${payload.summary.overall_percent}%` }} />
        </div>

        <div className="space-y-4">
          {payload.phases.map((phase, phaseIndex) => (
            <section key={`${phase.phase_label}-${phaseIndex}`} className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded bg-primary px-2 text-sm font-black text-white">
                    {toRomanNumeral(phaseIndex + 1)}
                  </span>
                  <h2 className="text-sm font-bold text-slate-900">{phase.phase_label}</h2>
                </div>
                <span className="text-xs font-semibold text-slate-600">
                  {phase.summary.completed_steps}/{phase.summary.total_steps} bước hoàn thành
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] border-collapse text-left">
                  <thead className="bg-white">
                    <tr className="border-b border-slate-200">
                      <th className="w-14 px-3 py-2 text-[11px] font-bold uppercase text-slate-600">TT</th>
                      <th className="min-w-[280px] px-3 py-2 text-[11px] font-bold uppercase text-slate-600">Trình tự công việc</th>
                      <th className="w-[160px] px-3 py-2 text-[11px] font-bold uppercase text-slate-600">ĐV chủ trì</th>
                      <th className="w-[220px] px-3 py-2 text-[11px] font-bold uppercase text-slate-600">Kết quả dự kiến</th>
                      <th className="w-20 px-3 py-2 text-center text-[11px] font-bold uppercase text-slate-600">Ngày</th>
                      <th className="w-28 px-3 py-2 text-[11px] font-bold uppercase text-slate-600">Từ ngày</th>
                      <th className="w-28 px-3 py-2 text-[11px] font-bold uppercase text-slate-600">Đến ngày</th>
                      <th className="w-36 min-w-[144px] px-3 py-2 text-[11px] font-bold uppercase text-slate-600">Tiến độ</th>
                      <th className="w-40 px-3 py-2 text-[11px] font-bold uppercase text-slate-600">Văn bản</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {phase.steps.map((step, stepIndex) => (
                      <tr key={`${step.display_number}-${stepIndex}`} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 text-center text-xs font-mono text-slate-600">{step.display_number}</td>
                        <td className="px-3 py-2 text-sm text-slate-800" style={{ paddingLeft: step.level > 0 ? 28 : 12 }}>
                          <div className={step.level > 0 ? 'text-xs text-slate-700' : 'font-semibold'}>
                            {step.step_name}
                          </div>
                          {step.step_detail ? (
                            <div className="mt-1 text-xs text-slate-500">{step.step_detail}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">{step.lead_unit || '-'}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{step.expected_result || '-'}</td>
                        <td className="px-3 py-2 text-center text-xs text-slate-700">{step.duration_days ?? 0}</td>
                        <td className="px-3 py-2 text-xs text-slate-700">{formatDate(step.actual_start_date) || '-'}</td>
                        <td className="px-3 py-2 text-xs text-slate-700">{formatDate(step.actual_end_date) || '-'}</td>
                        <td className="px-3 py-2 align-top">
                          <span className={`block whitespace-normal break-words text-xs font-bold leading-snug ${statusClassName(step.progress_status)}`}>
                            {step.progress_status_label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-700">{resolveDocumentText(step) || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
};

export default PublicProjectProcedurePage;
