import React, { useCallback, useMemo, useRef, useState } from 'react';
import { PHASE_LABELS } from '../../constants';
import type {
  IssueStatus,
  ProjectProcedureStep,
  ProcedureStepWorklog,
} from '../../types';

type IssueFilterTab = IssueStatus | 'all';

const ISSUE_STATUS_META: Record<IssueStatus, { label: string; color: string; dot: string }> = {
  JUST_ENCOUNTERED: { label: 'Vừa gặp', color: 'text-error bg-error/8 border-error/20', dot: 'bg-error' },
  IN_PROGRESS: { label: 'Đang xử lý', color: 'text-tertiary bg-tertiary/8 border-tertiary/20', dot: 'bg-tertiary' },
  RESOLVED: { label: 'Đã giải quyết', color: 'text-success bg-success/10 border-success/20', dot: 'bg-success' },
};

type PhaseSummary = {
  phase: string;
  orderLabel: string;
  label: string;
  total: number;
  done: number;
  inProgress: number;
  todo: number;
  percent: number;
  unresolvedIssues: number;
};

const normalizeStepKey = (value: string | number | null | undefined): string =>
  value === null || value === undefined || value === '' ? '' : String(value);

const compareStepOrder = (left: ProjectProcedureStep, right: ProjectProcedureStep): number => {
  const orderDiff = Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0);
  if (orderDiff !== 0) return orderDiff;
  const numberDiff = Number(left.step_number ?? 0) - Number(right.step_number ?? 0);
  if (numberDiff !== 0) return numberDiff;
  return normalizeStepKey(left.id).localeCompare(normalizeStepKey(right.id), 'vi');
};

interface ProcedureChecklistAdminTabProps {
  steps: ProjectProcedureStep[];
  worklogs: ProcedureStepWorklog[];
  worklogsLoading: boolean;
  overallPercent: number;
  onRefresh: () => void | Promise<void>;
  onChangeIssueStatus: (issueId: string | number, newStatus: IssueStatus) => Promise<void>;
}

export const ProcedureChecklistAdminTab: React.FC<ProcedureChecklistAdminTabProps> = ({
  steps,
  worklogs,
  worklogsLoading,
  overallPercent,
  onRefresh,
  onChangeIssueStatus,
}) => {
  const issuesSectionRef = useRef<HTMLDivElement | null>(null);
  const [issueFilterTab, setIssueFilterTab] = useState<IssueFilterTab>('all');
  const [issueUpdating, setIssueUpdating] = useState<Record<string | number, boolean>>({});

  const issueWorklogs = useMemo(
    () => worklogs.filter((worklog) => worklog.issue != null),
    [worklogs],
  );

  const issuesByStatus = useMemo(() => ({
    JUST_ENCOUNTERED: issueWorklogs.filter((worklog) => worklog.issue?.issue_status === 'JUST_ENCOUNTERED'),
    IN_PROGRESS: issueWorklogs.filter((worklog) => worklog.issue?.issue_status === 'IN_PROGRESS'),
    RESOLVED: issueWorklogs.filter((worklog) => worklog.issue?.issue_status === 'RESOLVED'),
  }), [issueWorklogs]);

  const phaseSummaries = useMemo<PhaseSummary[]>(() => {
    const topSteps = steps
      .filter((step) => !step.parent_step_id)
      .sort(compareStepOrder);
    const stepById = new Map(steps.map((step) => [normalizeStepKey(step.id), step]));
    const phaseByStepId = new Map<string, string>();
    const phaseOrder: string[] = [];
    const phaseMap = new Map<string, Omit<PhaseSummary, 'orderLabel' | 'percent'>>();

    topSteps.forEach((step) => {
      const phase = step.phase ?? 'KHAC';
      const label = step.phase_label ?? PHASE_LABELS[phase] ?? phase;
      if (!phaseMap.has(phase)) {
        phaseOrder.push(phase);
        phaseMap.set(phase, {
          phase,
          label,
          total: 0,
          done: 0,
          inProgress: 0,
          todo: 0,
          unresolvedIssues: 0,
        });
      }

      const summary = phaseMap.get(phase)!;
      summary.total++;
      if (step.progress_status === 'HOAN_THANH') {
        summary.done++;
      } else if (step.progress_status === 'DANG_THUC_HIEN') {
        summary.inProgress++;
      } else {
        summary.todo++;
      }
    });

    steps.forEach((step) => {
      const stepKey = normalizeStepKey(step.id);
      const parent = step.parent_step_id ? stepById.get(normalizeStepKey(step.parent_step_id)) : null;
      const owner = parent ?? step;
      phaseByStepId.set(stepKey, owner.phase ?? step.phase ?? 'KHAC');
    });

    issueWorklogs.forEach((worklog) => {
      if (!worklog.issue || worklog.issue.issue_status === 'RESOLVED') return;
      const phase = phaseByStepId.get(normalizeStepKey(worklog.step_id));
      if (!phase) return;
      const summary = phaseMap.get(phase);
      if (summary) {
        summary.unresolvedIssues++;
      }
    });

    return phaseOrder.map((phase, index) => {
      const summary = phaseMap.get(phase)!;
      return {
        ...summary,
        orderLabel: String(index + 1).padStart(2, '0'),
        percent: summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0,
      };
    });
  }, [issueWorklogs, steps]);

  const stepStats = useMemo(() => {
    const topSteps = steps.filter((step) => !step.parent_step_id);
    return {
      total: topSteps.length,
      done: topSteps.filter((step) => step.progress_status === 'HOAN_THANH').length,
      inProgress: topSteps.filter((step) => step.progress_status === 'DANG_THUC_HIEN').length,
      todo: topSteps.filter((step) => step.progress_status === 'CHUA_THUC_HIEN').length,
    };
  }, [steps]);

  const handleChangeIssueStatus = useCallback(async (
    worklogId: string | number,
    issueId: string | number,
    newStatus: IssueStatus,
  ) => {
    setIssueUpdating((prev) => ({ ...prev, [worklogId]: true }));
    try {
      await onChangeIssueStatus(issueId, newStatus);
    } finally {
      setIssueUpdating((prev) => ({ ...prev, [worklogId]: false }));
    }
  }, [onChangeIssueStatus]);

  return (
    <div className="flex flex-col gap-3 overflow-y-auto flex-1">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-deep-teal" style={{ fontSize: 16 }}>dashboard</span>
          Quản trị checklist
        </h3>
        <button
          type="button"
          title="Làm mới"
          aria-label="Làm mới dữ liệu quản trị checklist"
          onClick={() => void onRefresh()}
          disabled={worklogsLoading}
          className="inline-flex min-h-11 items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-8"
        >
          <span className={`material-symbols-outlined ${worklogsLoading ? 'animate-spin' : ''}`} style={{ fontSize: 14 }}>refresh</span>
          Làm mới
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <span className="material-symbols-outlined text-deep-teal" style={{ fontSize: 14 }}>trending_up</span>
            Tiến độ tổng thể
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Tổng bước', value: stepStats.total, color: 'text-slate-700', bg: 'bg-slate-50', icon: 'format_list_numbered' },
              { label: 'Hoàn thành', value: stepStats.done, color: 'text-success', bg: 'bg-success/10', icon: 'check_circle' },
              { label: 'Đang TH', value: stepStats.inProgress, color: 'text-tertiary', bg: 'bg-tertiary/8', icon: 'sync' },
              { label: 'Chưa TH', value: stepStats.todo, color: 'text-slate-500', bg: 'bg-slate-50', icon: 'radio_button_unchecked' },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-lg ${stat.bg} px-3 py-2 flex items-center gap-2`}>
                <span className={`material-symbols-outlined ${stat.color}`} style={{ fontSize: 16 }}>{stat.icon}</span>
                <div>
                  <div className={`text-lg font-black leading-none ${stat.color}`}>{stat.value}</div>
                  <div className="text-[10px] text-slate-600 font-medium mt-0.5">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Tỷ lệ hoàn thành</span>
              <span className="font-bold text-deep-teal">{overallPercent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
              {stepStats.total > 0 && (
                <>
                  <div
                    className="h-full bg-success transition-all duration-500"
                    style={{ width: `${Math.round((stepStats.done / stepStats.total) * 100)}%` }}
                  />
                  <div
                    className="h-full bg-warning transition-all duration-500"
                    style={{ width: `${Math.round((stepStats.inProgress / stepStats.total) * 100)}%` }}
                  />
                </>
              )}
            </div>
            <div className="flex gap-3 text-[10px] text-slate-600">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />Hoàn thành</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-warning inline-block" />Đang TH</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-200 inline-block" />Chưa TH</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 flex flex-col items-center gap-3">
          <h4 className="w-full text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <span className="material-symbols-outlined text-deep-teal" style={{ fontSize: 14 }}>donut_large</span>
            Phân bố trạng thái
          </h4>
          {(() => {
            const total = stepStats.total || 1;
            const segments = [
              { val: stepStats.done, color: '#34d399', label: 'Hoàn thành' },
              { val: stepStats.inProgress, color: '#fbbf24', label: 'Đang TH' },
              { val: stepStats.todo, color: '#e2e8f0', label: 'Chưa TH' },
            ];
            const radius = 52;
            const cx = 64;
            const cy = 64;
            const stroke = 20;
            let offset = 0;
            const circumference = 2 * Math.PI * radius;
            return (
              <div className="flex items-center gap-6">
                <svg width="128" height="128" viewBox="0 0 128 128">
                  <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
                  {segments.map((segment, index) => {
                    const pct = segment.val / total;
                    const dash = pct * circumference;
                    const gap = circumference - dash;
                    const element = (
                      <circle
                        key={index}
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill="none"
                        stroke={segment.color}
                        strokeWidth={stroke}
                        strokeDasharray={`${dash} ${gap}`}
                        strokeDashoffset={-offset * circumference}
                        strokeLinecap="butt"
                        style={{ transition: 'stroke-dasharray 0.5s ease' }}
                        transform={`rotate(-90 ${cx} ${cy})`}
                      />
                    );
                    offset += pct;
                    return element;
                  })}
                  <text x={cx} y={cy - 5} textAnchor="middle" fontSize="18" fontWeight="900" fill="#0f4c5c">{overallPercent}%</text>
                  <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#94a3b8">hoàn thành</text>
                </svg>
                <div className="space-y-1.5">
                  {segments.map((segment) => (
                    <div key={segment.label} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: segment.color }} />
                      <span className="text-slate-500">{segment.label}</span>
                      <span className="font-bold text-slate-700 ml-auto pl-2">{segment.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {(() => {
        const hasPhases = phaseSummaries.length > 0;
        const hasIssues = issueWorklogs.length > 0;
        if (!hasPhases && !hasIssues) return null;

        return (
          <div className={`grid grid-cols-1 gap-3 ${hasPhases && hasIssues ? 'lg:grid-cols-2' : ''}`}>
            {hasPhases && (
              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-deep-teal" style={{ fontSize: 14 }}>bar_chart</span>
                  Tiến độ theo giai đoạn
                </h4>
                <ol className="space-y-2" aria-label="Tiến độ theo giai đoạn">
                  {phaseSummaries.map((summary) => {
                    const inProgressPct = summary.total > 0
                      ? Math.round((summary.inProgress / summary.total) * 100)
                      : 0;
                    const statusMeta = summary.done === summary.total
                      ? {
                          label: 'Hoàn thành',
                          icon: 'check_circle',
                          className: 'border-success/25 bg-success/10 text-success',
                        }
                      : summary.inProgress > 0
                        ? {
                            label: 'Đang TH',
                            icon: 'sync',
                            className: 'border-tertiary/25 bg-tertiary/10 text-slate-700',
                          }
                        : {
                            label: 'Chưa TH',
                            icon: 'radio_button_unchecked',
                            className: 'border-slate-300 bg-slate-50 text-slate-700',
                          };
                    return (
                      <li key={summary.phase} className="rounded-md border border-slate-200 bg-slate-50/70 p-2 sm:p-2.5">
                        <div className="flex items-start gap-2.5">
                          <span className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/8 text-[11px] font-black tabular-nums text-primary">
                            {summary.orderLabel}
                          </span>
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800" title={summary.label}>
                                {summary.label}
                              </span>
                              <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-700">
                                {summary.done}/{summary.total}
                              </span>
                              <span className={`inline-flex min-h-6 items-center gap-1 rounded border px-1.5 text-[10px] font-bold ${statusMeta.className}`}>
                                <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 12 }}>{statusMeta.icon}</span>
                                {statusMeta.label}
                              </span>
                            </div>
                            <div
                              role="progressbar"
                              aria-label={`Giai đoạn ${summary.orderLabel} ${summary.label}: ${summary.done} trên ${summary.total} bước hoàn thành`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={summary.percent}
                              aria-valuetext={`${summary.done}/${summary.total} bước hoàn thành`}
                              className="flex h-3 w-full overflow-hidden rounded bg-slate-200"
                            >
                              <div
                                className="h-full bg-success transition-all duration-500"
                                style={{ width: `${summary.percent}%` }}
                              />
                              <div
                                className="h-full bg-warning transition-all duration-500"
                                style={{ width: `${inProgressPct}%` }}
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-slate-600">
                              <span>{summary.percent}% hoàn thành</span>
                              <span>{summary.inProgress} đang TH</span>
                              <span>{summary.todo} chưa TH</span>
                              <span className={summary.unresolvedIssues > 0 ? 'font-bold text-error' : 'text-slate-600'}>
                                {summary.unresolvedIssues > 0
                                  ? `${summary.unresolvedIssues} vấn đề mở`
                                  : 'Không vấn đề mở'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {hasIssues && (
              <div className="rounded-lg border border-slate-200 bg-white p-3 flex flex-col gap-2.5">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-error" style={{ fontSize: 14 }}>troubleshoot</span>
                  Tình trạng xử lý vấn đề
                  <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    {issueWorklogs.length} vấn đề
                  </span>
                </h4>
                {(() => {
                  const total = issueWorklogs.length || 1;
                  const segments = [
                    { val: issuesByStatus.JUST_ENCOUNTERED.length, color: '#f87171', label: 'Vừa gặp' },
                    { val: issuesByStatus.IN_PROGRESS.length, color: '#fbbf24', label: 'Đang xử lý' },
                    { val: issuesByStatus.RESOLVED.length, color: '#34d399', label: 'Đã giải quyết' },
                  ].filter((segment) => segment.val > 0);
                  const radius = 40;
                  const cx = 50;
                  const cy = 50;
                  const stroke = 16;
                  const circumference = 2 * Math.PI * radius;
                  let offset = 0;
                  return (
                    <div className="flex items-center gap-4">
                      <svg width="100" height="100" viewBox="0 0 100 100">
                        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
                        {segments.map((segment, index) => {
                          const pct = segment.val / total;
                          const dash = pct * circumference;
                          const element = (
                            <circle
                              key={index}
                              cx={cx}
                              cy={cy}
                              r={radius}
                              fill="none"
                              stroke={segment.color}
                              strokeWidth={stroke}
                              strokeDasharray={`${dash} ${circumference - dash}`}
                              strokeDashoffset={-offset * circumference}
                              transform={`rotate(-90 ${cx} ${cy})`}
                            />
                          );
                          offset += pct;
                          return element;
                        })}
                        <text x={cx} y={cy - 3} textAnchor="middle" fontSize="14" fontWeight="900" fill="#0f4c5c">{issueWorklogs.length}</text>
                        <text x={cx} y={cy + 9} textAnchor="middle" fontSize="7" fill="#94a3b8">vấn đề</text>
                      </svg>
                      <div className="flex-1 space-y-1.5">
                        {([
                          { val: issuesByStatus.JUST_ENCOUNTERED.length, color: '#f87171', label: 'Vừa gặp', statusKey: 'JUST_ENCOUNTERED' as IssueStatus },
                          { val: issuesByStatus.IN_PROGRESS.length, color: '#fbbf24', label: 'Đang xử lý', statusKey: 'IN_PROGRESS' as IssueStatus },
                          { val: issuesByStatus.RESOLVED.length, color: '#34d399', label: 'Đã giải quyết', statusKey: 'RESOLVED' as IssueStatus },
                        ]).map((segment) => (
                          <button
                            type="button"
                            key={segment.label}
                            aria-label={`Lọc vấn đề ${segment.label}: ${segment.val} mục`}
                            aria-pressed={issueFilterTab === segment.statusKey}
                            onClick={() => {
                              setIssueFilterTab(segment.statusKey);
                              issuesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            className="flex min-h-11 w-full cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-left text-[11px] transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-8 sm:px-1.5"
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: segment.color }} />
                            <span className="text-slate-700 flex-1">{segment.label}</span>
                            <span className="font-bold text-slate-700">{segment.val}</span>
                            <span className="text-slate-600 text-[10px]">({Math.round((segment.val / (issueWorklogs.length || 1)) * 100)}%)</span>
                            <span className="material-symbols-outlined text-slate-500" aria-hidden="true" style={{ fontSize: 12 }}>chevron_right</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })()}

      <div ref={issuesSectionRef} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <span className="material-symbols-outlined text-error" style={{ fontSize: 14 }}>warning</span>
            Khó khăn &amp; Đề xuất
            {issueWorklogs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-error/8 text-error text-[10px] font-bold">
                {issueWorklogs.length}
              </span>
            )}
          </h4>
        </div>

        <div className="flex gap-1 flex-wrap">
          {([
            { key: 'all', label: 'Tất cả', count: issueWorklogs.length, color: 'text-slate-600 bg-slate-100' },
            { key: 'JUST_ENCOUNTERED', label: 'Vừa gặp', count: issuesByStatus.JUST_ENCOUNTERED.length, color: 'text-error bg-error/8', dot: 'bg-error' },
            { key: 'IN_PROGRESS', label: 'Đang xử lý', count: issuesByStatus.IN_PROGRESS.length, color: 'text-tertiary bg-tertiary/8', dot: 'bg-tertiary' },
            { key: 'RESOLVED', label: 'Đã giải quyết', count: issuesByStatus.RESOLVED.length, color: 'text-success bg-success/10', dot: 'bg-success' },
          ] as { key: IssueFilterTab; label: string; count: number; color: string; dot?: string }[]).map((filter) => (
            <button
              type="button"
              key={filter.key}
              aria-label={`Lọc danh sách vấn đề ${filter.label}, ${filter.count} mục`}
              aria-pressed={issueFilterTab === filter.key}
              onClick={() => setIssueFilterTab(filter.key)}
              className={`inline-flex min-h-11 items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-8 ${
                issueFilterTab === filter.key
                  ? `${filter.color} ring-1 ring-inset ring-current`
                  : 'text-slate-600 hover:text-slate-800 bg-slate-50'
              }`}
            >
              {filter.dot && <span className={`w-1.5 h-1.5 rounded-full ${filter.dot}`} />}
              {filter.label}
              {filter.count > 0 && <span className="ml-1 opacity-70">({filter.count})</span>}
            </button>
          ))}
        </div>

        {worklogsLoading ? (
          <div role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-slate-600 py-4 justify-center">
            <span className="material-symbols-outlined animate-spin" aria-hidden="true" style={{ fontSize: 14 }}>progress_activity</span>
            Đang tải dữ liệu...
          </div>
        ) : (() => {
          const displayed = issueFilterTab === 'all'
            ? issueWorklogs
            : issuesByStatus[issueFilterTab as IssueStatus] ?? [];

          if (displayed.length === 0) {
            return (
              <div role="status" aria-live="polite" className="text-center py-6 text-xs text-slate-600 italic">
                {issueWorklogs.length === 0
                  ? 'Chưa có khó khăn nào được ghi nhận.'
                  : 'Không có vấn đề ở trạng thái này.'}
              </div>
            );
          }

          return (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {displayed.map((worklog) => {
                const issue = worklog.issue!;
                const statusMeta = ISSUE_STATUS_META[issue.issue_status];
                const isUpdating = issueUpdating[worklog.id] ?? false;

                return (
                  <div key={worklog.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 space-y-1.5 hover:border-slate-300 transition-colors">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      {worklog.step && (
                        <span className="font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          #{worklog.step.step_number} {worklog.step.step_name}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusMeta.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                        {statusMeta.label}
                      </span>
                      <span className="ml-auto text-slate-600">
                        {worklog.creator?.full_name ?? ''}
                        {worklog.creator?.user_code ? ` (${worklog.creator.user_code})` : ''}
                        {worklog.created_at ? ` — ${new Date(worklog.created_at).toLocaleDateString('vi-VN')}` : ''}
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-xs">
                      <span className="material-symbols-outlined text-error shrink-0 mt-0.5" style={{ fontSize: 14 }}>error_outline</span>
                      <p className="text-slate-700 leading-snug">{issue.issue_content}</p>
                    </div>
                    {issue.proposal_content && (
                      <div className="flex items-start gap-2 text-xs">
                        <span className="material-symbols-outlined text-tertiary shrink-0 mt-0.5" style={{ fontSize: 14 }}>lightbulb</span>
                        <p className="text-slate-600 leading-snug italic">{issue.proposal_content}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <span className="text-[10px] text-slate-600 font-medium">Đổi trạng thái:</span>
                      {(['JUST_ENCOUNTERED', 'IN_PROGRESS', 'RESOLVED'] as IssueStatus[]).map((status) => (
                        <button
                          type="button"
                          key={status}
                          data-testid={`checklist-issue-status-${worklog.id}-${status}`}
                          aria-label={`Đổi vấn đề ${worklog.id} sang ${ISSUE_STATUS_META[status].label}`}
                          aria-pressed={issue.issue_status === status}
                          disabled={isUpdating || issue.issue_status === status}
                          onClick={() => void handleChangeIssueStatus(worklog.id, issue.id, status)}
                          className={`min-h-11 rounded border px-2 py-0.5 text-[10px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-7 ${
                            issue.issue_status === status
                              ? `${ISSUE_STATUS_META[status].color} cursor-default`
                              : 'text-slate-500 bg-white border-slate-200 hover:border-slate-400 hover:text-slate-700'
                          }`}
                        >
                          {isUpdating && issue.issue_status !== status ? '...' : ISSUE_STATUS_META[status].label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
