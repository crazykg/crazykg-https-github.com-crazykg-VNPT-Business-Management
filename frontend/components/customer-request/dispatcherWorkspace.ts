import type { YeuCau } from '../../types';

const getTimestamp = (value: string | null | undefined): number => {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortRows = (rows: YeuCau[]): YeuCau[] =>
  [...rows].sort((left, right) => getTimestamp(right.updated_at) - getTimestamp(left.updated_at));

const ACTIVE_WORKLOAD_STATUSES = new Set([
  'new_intake',
  'analysis',
  'in_progress',
  'waiting_customer_feedback',
  'returned_to_manager',
]);

export type DispatcherTeamLoadRow = {
  performer_user_id: string;
  performer_name: string;
  active_count: number;
  total_hours_spent: number;
  estimated_hours: number | null;
  load_pct: number;
  missing_estimate_count: number;
  over_estimate_count: number;
};

export const splitDispatcherWorkspaceRows = (rows: YeuCau[]): {
  queueRows: YeuCau[];
  returnedRows: YeuCau[];
  feedbackRows: YeuCau[];
  approvalRows: YeuCau[];
  activeRows: YeuCau[];
} => {
  const queueRows: YeuCau[] = [];
  const returnedRows: YeuCau[] = [];
  const feedbackRows: YeuCau[] = [];
  const approvalRows: YeuCau[] = [];
  const activeRows: YeuCau[] = [];

  rows.forEach((row) => {
    const statusCode = String(row.trang_thai ?? row.current_status_code ?? '');
    const hasPerformer = String(row.performer_user_id ?? '').trim() !== '';

    if (statusCode === 'returned_to_manager') {
      returnedRows.push(row);
      return;
    }

    if (statusCode === 'waiting_customer_feedback') {
      feedbackRows.push(row);
      return;
    }

    if (statusCode === 'completed') {
      approvalRows.push(row);
      return;
    }

    if (!hasPerformer && ['new_intake', 'analysis', 'in_progress'].includes(statusCode)) {
      queueRows.push(row);
      return;
    }

    if (['in_progress', 'analysis'].includes(statusCode)) {
      activeRows.push(row);
    }
  });

  return {
    queueRows: sortRows(queueRows),
    returnedRows: sortRows(returnedRows),
    feedbackRows: sortRows(feedbackRows),
    approvalRows: sortRows(approvalRows),
    activeRows: sortRows(activeRows),
  };
};

export const buildDispatcherTeamLoadRows = (rows: YeuCau[]): DispatcherTeamLoadRow[] => {
  const grouped = new Map<string, YeuCau[]>();

  rows.forEach((row) => {
    const performerUserId = String(row.performer_user_id ?? '').trim();
    const statusCode = String(row.trang_thai ?? row.current_status_code ?? '');
    if (performerUserId === '' || !ACTIVE_WORKLOAD_STATUSES.has(statusCode)) {
      return;
    }

    const current = grouped.get(performerUserId) ?? [];
    current.push(row);
    grouped.set(performerUserId, current);
  });

  return Array.from(grouped.entries())
    .map(([performerUserId, performerRows]) => {
      const first = performerRows[0];
      const totalHoursSpent = performerRows.reduce((sum, row) => sum + Number(row.total_hours_spent ?? 0), 0);
      const estimatedHoursSum = performerRows.reduce((sum, row) => sum + Number(row.estimated_hours ?? 0), 0);
      const hasEstimate = performerRows.some((row) => Number(row.estimated_hours ?? 0) > 0);
      const loadPct = hasEstimate
        ? Math.min(100, Math.round((totalHoursSpent / Math.max(estimatedHoursSum, 0.01)) * 100))
        : Math.min(100, performerRows.length * 25);

      return {
        performer_user_id: performerUserId,
        performer_name: String(first.performer_name ?? first.received_by_name ?? `#${performerUserId}`),
        active_count: performerRows.length,
        total_hours_spent: Number(totalHoursSpent.toFixed(2)),
        estimated_hours: hasEstimate ? Number(estimatedHoursSum.toFixed(2)) : null,
        load_pct: loadPct,
        missing_estimate_count: performerRows.filter((row) => Boolean(row.missing_estimate)).length,
        over_estimate_count: performerRows.filter((row) => Boolean(row.over_estimate)).length,
      };
    })
    .sort((left, right) => {
      if (right.load_pct !== left.load_pct) {
        return right.load_pct - left.load_pct;
      }
      if (right.active_count !== left.active_count) {
        return right.active_count - left.active_count;
      }
      return right.total_hours_spent - left.total_hours_spent;
    });
};

const pmWatchPriority = (row: YeuCau): number => {
  const statusCode = String(row.trang_thai ?? row.current_status_code ?? '');
  if (Boolean(row.over_estimate)) {
    return 4;
  }
  if (statusCode === 'returned_to_manager') {
    return 3;
  }
  if (Boolean(row.missing_estimate)) {
    return 2;
  }
  if (['soft', 'hard'].includes(String(row.warning_level ?? ''))) {
    return 1;
  }

  return 0;
};

export const buildDispatcherPmWatchRows = (rows: YeuCau[]): YeuCau[] =>
  [...rows]
    .filter((row) => {
      const statusCode = String(row.trang_thai ?? row.current_status_code ?? '');
      if (['customer_notified', 'not_executed'].includes(statusCode)) {
        return false;
      }

      return pmWatchPriority(row) > 0;
    })
    .sort((left, right) => {
      const priorityDiff = pmWatchPriority(right) - pmWatchPriority(left);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return getTimestamp(right.updated_at) - getTimestamp(left.updated_at);
    });
