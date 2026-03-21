import type { YeuCau } from '../../types';

const CLOSED_STATUSES = new Set(['completed', 'customer_notified', 'not_executed']);
const ACTIVE_STATUSES = new Set(['in_progress']);
const PENDING_STATUS_PRIORITY: Record<string, number> = {
  returned_to_manager: 0,
  analysis: 1,
  waiting_customer_feedback: 2,
  new_intake: 3,
};

const getStatusPriority = (statusCode: string): number => {
  if (statusCode in PENDING_STATUS_PRIORITY) {
    return PENDING_STATUS_PRIORITY[statusCode];
  }

  if (ACTIVE_STATUSES.has(statusCode)) {
    return 10;
  }

  if (CLOSED_STATUSES.has(statusCode)) {
    return 30;
  }

  return 20;
};

const getTimestamp = (value: string | null | undefined): number => {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortWorkspaceRows = (rows: YeuCau[]): YeuCau[] =>
  [...rows].sort((left, right) => {
    const leftStatus = String(left.trang_thai ?? left.current_status_code ?? '');
    const rightStatus = String(right.trang_thai ?? right.current_status_code ?? '');
    const byPriority = getStatusPriority(leftStatus) - getStatusPriority(rightStatus);
    if (byPriority !== 0) {
      return byPriority;
    }

    return getTimestamp(right.updated_at) - getTimestamp(left.updated_at);
  });

export const splitPerformerWorkspaceRows = (rows: YeuCau[]): {
  pendingRows: YeuCau[];
  activeRows: YeuCau[];
  closedRows: YeuCau[];
} => {
  const pendingRows: YeuCau[] = [];
  const activeRows: YeuCau[] = [];
  const closedRows: YeuCau[] = [];

  rows.forEach((row) => {
    const statusCode = String(row.trang_thai ?? row.current_status_code ?? '');
    if (ACTIVE_STATUSES.has(statusCode)) {
      activeRows.push(row);
      return;
    }

    if (CLOSED_STATUSES.has(statusCode)) {
      closedRows.push(row);
      return;
    }

    pendingRows.push(row);
  });

  return {
    pendingRows: sortWorkspaceRows(pendingRows),
    activeRows: sortWorkspaceRows(activeRows),
    closedRows: sortWorkspaceRows(closedRows),
  };
};
