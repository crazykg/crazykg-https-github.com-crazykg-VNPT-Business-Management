import React from 'react';
import type { DmsPhase } from '../../types';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';

type DmsProgressBarProps = {
  dms_phase?: DmsPhase | string | null;
  dms_contact_name?: string | null;
  task_ref?: string | null;
  task_url?: string | null;
  dms_started_at?: string | null;
};

type DmsStep = {
  phase: DmsPhase;
  label: string;
  icon: string;
};

const DMS_STEPS: DmsStep[] = [
  { phase: 'exchange', label: 'Trao đổi', icon: 'forum' },
  { phase: 'task_created', label: 'Tạo task', icon: 'add_task' },
  { phase: 'in_progress', label: 'Đang xử lý', icon: 'sync' },
  { phase: 'completed', label: 'Hoàn thành', icon: 'task_alt' },
];

const PHASE_ORDER: DmsPhase[] = ['exchange', 'task_created', 'in_progress', 'completed'];

const resolveStepState = (
  stepPhase: DmsPhase,
  currentPhase: DmsPhase | string | null | undefined
): 'done' | 'active' | 'pending' => {
  if (!currentPhase || currentPhase === 'suspended') {
    return 'pending';
  }
  const currentIndex = PHASE_ORDER.indexOf(currentPhase as DmsPhase);
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

export const DmsProgressBar: React.FC<DmsProgressBarProps> = ({
  dms_phase,
  dms_contact_name,
  task_ref,
  task_url,
  dms_started_at,
}) => {
  const isSuspended = dms_phase === 'suspended';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Tiến độ chuyển DMS</h4>
        {isSuspended && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
            <span className="material-symbols-outlined text-sm">pause_circle</span>
            Tạm dừng
          </span>
        )}
      </div>

      <div className="mt-4 flex items-start gap-0">
        {DMS_STEPS.map((step, index) => {
          const state = resolveStepState(step.phase, dms_phase);
          const isLast = index === DMS_STEPS.length - 1;

          const iconCls =
            state === 'done'
              ? 'bg-emerald-500 text-white'
              : state === 'active'
                ? isSuspended
                  ? 'bg-slate-400 text-white'
                  : 'bg-lime-600 text-white ring-2 ring-lime-200'
                : 'bg-slate-200 text-slate-400';

          const labelCls =
            state === 'done'
              ? 'text-emerald-600 font-semibold'
              : state === 'active'
                ? isSuspended
                  ? 'text-slate-500 font-semibold'
                  : 'text-lime-700 font-bold'
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

      {(dms_contact_name || dms_started_at || task_ref || task_url) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {dms_contact_name && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              <span className="material-symbols-outlined text-sm">contacts</span>
              {dms_contact_name}
            </span>
          )}
          {dms_started_at && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              <span className="material-symbols-outlined text-sm">calendar_today</span>
              Bắt đầu: {formatDateTimeDdMmYyyy(dms_started_at)?.slice(0, 10) ?? dms_started_at}
            </span>
          )}
          {task_ref && !task_url && (
            <span className="inline-flex items-center gap-1 rounded-full bg-lime-100 px-2.5 py-1 text-xs font-semibold text-lime-700">
              <span className="material-symbols-outlined text-sm">tag</span>
              {task_ref}
            </span>
          )}
          {task_ref && task_url && (
            <a
              href={task_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-lime-100 px-2.5 py-1 text-xs font-semibold text-lime-700 underline-offset-2 hover:underline"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              {task_ref}
            </a>
          )}
        </div>
      )}
    </div>
  );
};
