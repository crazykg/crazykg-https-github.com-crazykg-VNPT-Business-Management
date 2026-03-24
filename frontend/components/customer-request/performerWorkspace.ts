import type { YeuCau } from '../../types';
import { resolveRequestCurrentStatusCode } from './presentation';

const CLOSED_STATUSES = new Set(['completed', 'customer_notified', 'not_executed']);
const ACTIVE_STATUSES = new Set(['in_progress', 'analysis', 'coding', 'dms_transfer']);
const PENDING_STATUS_PRIORITY: Record<string, number> = {
  returned_to_manager: 0,
  waiting_customer_feedback: 1,
  new_intake: 2,
  dispatched: 2, // legacy — tương đương new_intake (Creator đã giao, chờ nhận việc)
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
    const leftStatus = resolveRequestCurrentStatusCode(left);
    const rightStatus = resolveRequestCurrentStatusCode(right);
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
    const statusCode = resolveRequestCurrentStatusCode(row);
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
