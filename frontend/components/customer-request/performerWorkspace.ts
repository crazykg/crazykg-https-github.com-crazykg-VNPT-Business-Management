import type { YeuCau } from '../../types';
import {
  classifyPerformerWorkspaceStatus,
  getPerformerWorkspaceStatusPriority,
  resolveRequestCurrentStatusCode,
} from './presentation';

const getStatusPriority = (statusCode: string): number =>
  getPerformerWorkspaceStatusPriority(statusCode);

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
    const bucket = classifyPerformerWorkspaceStatus(statusCode);
    if (bucket === 'active') {
      activeRows.push(row);
      return;
    }

    if (bucket === 'closed') {
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
