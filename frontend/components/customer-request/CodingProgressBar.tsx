import React from 'react';
import type { CodingPhase } from '../../types/customerRequest';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';

type CodingProgressBarProps = {
  coding_phase?: CodingPhase | string | null;
  developer_name?: string | null;
  coding_started_at?: string | null;
  upcode_version?: string | null;
};

type CodingStep = {
  phase: CodingPhase;
  label: string;
  icon: string;
};

const CODING_STEPS: CodingStep[] = [
  { phase: 'coding', label: 'Đang lập trình', icon: 'code' },
  { phase: 'coding_done', label: 'Lập trình xong', icon: 'check_circle' },
  { phase: 'upcode_pending', label: 'Chờ upcode', icon: 'schedule' },
  { phase: 'upcode_deployed', label: 'Đã upcode', icon: 'rocket_launch' },
];

const PHASE_ORDER: CodingPhase[] = ['coding', 'coding_done', 'upcode_pending', 'upcode_deployed'];

const resolveStepState = (
  stepPhase: CodingPhase,
  currentPhase: CodingPhase | string | null | undefined
): 'done' | 'active' | 'pending' => {
  if (!currentPhase || currentPhase === 'suspended') {
    return 'pending';
  }
  const currentIndex = PHASE_ORDER.indexOf(currentPhase as CodingPhase);
  const stepIndex = PHASE_ORDER.indexOf(stepPhase);
  if (currentIndex < 0) {
    return 'pending';
  }
  if (stepIndex < currentIndex) {
    return 'done';
  }
  if (stepIndex === currentIndex) {
    return 'active';
  }
  return 'pending';
};

export const CodingProgressBar: React.FC<CodingProgressBarProps> = ({
  coding_phase,
  developer_name,
  coding_started_at,
  upcode_version,
}) => {
  const isSuspended = coding_phase === 'suspended';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Tiến độ lập trình</h4>
        {isSuspended && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
            <span className="material-symbols-outlined text-sm">pause_circle</span>
            Tạm dừng
          </span>
        )}
      </div>

      <div className="mt-4 flex items-start gap-0">
        {CODING_STEPS.map((step, index) => {
          const state = resolveStepState(step.phase, coding_phase);
          const isLast = index === CODING_STEPS.length - 1;

          const iconCls =
            state === 'done'
              ? 'bg-emerald-500 text-white'
              : state === 'active'
                ? isSuspended
                  ? 'bg-slate-400 text-white'
                  : 'bg-violet-600 text-white ring-2 ring-violet-200'
                : 'bg-slate-200 text-slate-400';

          const labelCls =
            state === 'done'
              ? 'text-emerald-600 font-semibold'
              : state === 'active'
                ? isSuspended
                  ? 'text-slate-500 font-semibold'
                  : 'text-violet-700 font-bold'
                : 'text-slate-400';

          const connectorCls =
            state === 'done' || (state === 'active' && !isLast)
              ? 'bg-emerald-400'
              : 'bg-slate-200';

          return (
            <div key={step.phase} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${iconCls} transition-all`}>
                  <span className="material-symbols-outlined text-base">{step.icon}</span>
                </div>
                {!isLast && (
                  <div className={`h-0.5 flex-1 ${connectorCls} transition-all`} />
                )}
              </div>
              <p className={`mt-2 max-w-[80px] text-center text-[11px] leading-tight ${labelCls}`}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>

      {(developer_name || coding_started_at || upcode_version) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {developer_name && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              <span className="material-symbols-outlined text-sm">person</span>
              {developer_name}
            </span>
          )}
          {coding_started_at && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              <span className="material-symbols-outlined text-sm">calendar_today</span>
              Bắt đầu: {formatDateTimeDdMmYyyy(coding_started_at)?.slice(0, 10) ?? coding_started_at}
            </span>
          )}
          {upcode_version && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
              <span className="material-symbols-outlined text-sm">tag</span>
              v{upcode_version}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
