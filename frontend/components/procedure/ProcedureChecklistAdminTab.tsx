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

interface ProcedureChecklistAdminTabProps {
  steps: ProjectProcedureStep[];
  worklogs: ProcedureStepWorklog[];
  worklogsLoading: boolean;
  overallPercent: number;
  onRefresh: () => void | Promise<void>;
  onChangeIssueStatus: (logId: string | number, newStatus: IssueStatus) => Promise<void>;
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
    logId: string | number,
    newStatus: IssueStatus,
  ) => {
    setIssueUpdating((prev) => ({ ...prev, [logId]: true }));
    try {
      await onChangeIssueStatus(logId, newStatus);
    } finally {
      setIssueUpdating((prev) => ({ ...prev, [logId]: false }));
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
          onClick={() => void onRefresh()}
          disabled={worklogsLoading}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
        >
          <span className={`material-symbols-outlined ${worklogsLoading ? 'animate-spin' : ''}`} style={{ fontSize: 14 }}>refresh</span>
          Làm mới
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
            <span className="material-symbols-outlined text-deep-teal" style={{ fontSize: 14 }}>trending_up</span>
            Tiến độ tổng thể
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Tổng bước', value: stepStats.total, color: 'text-slate-700', bg: 'bg-slate-50', icon: 'format_list_numbered' },
              { label: 'Hoàn thành', value: stepStats.done, color: 'text-success', bg: 'bg-success/10', icon: 'check_circle' },
              { label: 'Đang TH', value: stepStats.inProgress, color: 'text-tertiary', bg: 'bg-tertiary/8', icon: 'sync' },
              { label: 'Chưa TH', value: stepStats.todo, color: 'text-slate-400', bg: 'bg-slate-50', icon: 'radio_button_unchecked' },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-lg ${stat.bg} px-3 py-2 flex items-center gap-2`}>
                <span className={`material-symbols-outlined ${stat.color}`} style={{ fontSize: 16 }}>{stat.icon}</span>
                <div>
                  <div className={`text-lg font-black leading-none ${stat.color}`}>{stat.value}</div>
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">{stat.label}</div>
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
            <div className="flex gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />Hoàn thành</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-warning inline-block" />Đang TH</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-200 inline-block" />Chưa TH</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 flex flex-col items-center gap-3">
          <h4 className="w-full text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
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
        type PhaseRow = { total: number; done: number; inProg: number; label: string };
        const phaseMap = steps.reduce((acc: Record<string, PhaseRow>, step) => {
          if (step.parent_step_id) return acc;
          const phase = step.phase ?? 'KHAC';
          const label = step.phase_label ?? PHASE_LABELS[phase] ?? phase;
          if (!acc[phase]) acc[phase] = { total: 0, done: 0, inProg: 0, label };
          acc[phase].total++;
          if (step.progress_status === 'HOAN_THANH') acc[phase].done++;
          if (step.progress_status === 'DANG_THUC_HIEN') acc[phase].inProg++;
          return acc;
        }, {});
        const phases = (Object.entries(phaseMap) as [string, PhaseRow][]).filter(([, data]) => data.total > 0);
        const hasPhases = phases.length > 1;
        const hasIssues = issueWorklogs.length > 0;
        if (!hasPhases && !hasIssues) return null;

        return (
          <div className={`grid grid-cols-1 gap-3 ${hasPhases && hasIssues ? 'lg:grid-cols-2' : ''}`}>
            {hasPhases && (
              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-deep-teal" style={{ fontSize: 14 }}>bar_chart</span>
                  Tiến độ theo giai đoạn
                </h4>
                <div className="space-y-2">
                  {phases.map(([phase, data]) => {
                    const donePct = Math.round((data.done / data.total) * 100);
                    const inProgPct = Math.round((data.inProg / data.total) * 100);
                    return (
                      <div key={phase} className="space-y-0.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-medium text-slate-600 truncate max-w-[180px]" title={data.label}>{data.label}</span>
                          <span className="text-slate-400 shrink-0 ml-2">{data.done}/{data.total}</span>
                        </div>
                        <div className="h-3 w-full rounded bg-slate-100 overflow-hidden flex">
                          <div
                            className="h-full bg-success transition-all duration-500 flex items-center justify-center"
                            style={{ width: `${donePct}%` }}
                          >
                            {donePct >= 15 && <span className="text-[9px] font-bold text-white">{donePct}%</span>}
                          </div>
                          <div
                            className="h-full bg-warning transition-all duration-500"
                            style={{ width: `${inProgPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {hasIssues && (
              <div className="rounded-lg border border-slate-200 bg-white p-3 flex flex-col gap-2.5">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
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
                            key={segment.label}
                            onClick={() => {
                              setIssueFilterTab(segment.statusKey);
                              issuesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            className="w-full flex items-center gap-1.5 text-[11px] rounded px-1.5 py-1 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: segment.color }} />
                            <span className="text-slate-500 flex-1">{segment.label}</span>
                            <span className="font-bold text-slate-700">{segment.val}</span>
                            <span className="text-slate-300 text-[10px]">({Math.round((segment.val / (issueWorklogs.length || 1)) * 100)}%)</span>
                            <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 12 }}>chevron_right</span>
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
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
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
              key={filter.key}
              onClick={() => setIssueFilterTab(filter.key)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                issueFilterTab === filter.key
                  ? `${filter.color} ring-1 ring-inset ring-current`
                  : 'text-slate-400 hover:text-slate-600 bg-slate-50'
              }`}
            >
              {filter.dot && <span className={`w-1.5 h-1.5 rounded-full ${filter.dot}`} />}
              {filter.label}
              {filter.count > 0 && <span className="ml-1 opacity-70">({filter.count})</span>}
            </button>
          ))}
        </div>

        {worklogsLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-400 py-4 justify-center">
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>progress_activity</span>
            Đang tải dữ liệu...
          </div>
        ) : (() => {
          const displayed = issueFilterTab === 'all'
            ? issueWorklogs
            : issuesByStatus[issueFilterTab as IssueStatus] ?? [];

          if (displayed.length === 0) {
            return (
              <div className="text-center py-6 text-xs text-slate-400 italic">
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
                      <span className="ml-auto text-slate-400">
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
                      <span className="text-[10px] text-slate-400 font-medium">Đổi trạng thái:</span>
                      {(['JUST_ENCOUNTERED', 'IN_PROGRESS', 'RESOLVED'] as IssueStatus[]).map((status) => (
                        <button
                          key={status}
                          data-testid={`checklist-issue-status-${worklog.id}-${status}`}
                          disabled={isUpdating || issue.issue_status === status}
                          onClick={() => void handleChangeIssueStatus(worklog.id, status)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
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
