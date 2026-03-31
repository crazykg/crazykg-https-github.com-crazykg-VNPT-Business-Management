import type { YeuCau } from '../../types';
import {
  classifyCreatorWorkspaceStatus,
  resolveRequestCurrentStatusCode,
} from './presentation';

const sortRows = (rows: YeuCau[]): YeuCau[] =>
  [...rows].sort((left, right) => {
    const leftTime = Date.parse(String(left.updated_at ?? left.created_at ?? ''));
    const rightTime = Date.parse(String(right.updated_at ?? right.created_at ?? ''));
    const safeLeft = Number.isNaN(leftTime) ? 0 : leftTime;
    const safeRight = Number.isNaN(rightTime) ? 0 : rightTime;
    return safeRight - safeLeft;
  });

export const splitCreatorWorkspaceRows = (rows: YeuCau[]): {
  reviewRows: YeuCau[];
  notifyRows: YeuCau[];
  followUpRows: YeuCau[];
  closedRows: YeuCau[];
} => {
  const reviewRows: YeuCau[] = [];
  const notifyRows: YeuCau[] = [];
  const followUpRows: YeuCau[] = [];
  const closedRows: YeuCau[] = [];

  rows.forEach((row) => {
    const statusCode = resolveRequestCurrentStatusCode(row);
    const bucket = classifyCreatorWorkspaceStatus(statusCode);

    if (bucket === 'review') {
      reviewRows.push(row);
      return;
    }

    if (bucket === 'notify') {
      notifyRows.push(row);
      return;
    }

    if (bucket === 'follow_up') {
      followUpRows.push(row);
      return;
    }

    closedRows.push(row);
  });

  return {
    reviewRows: sortRows(reviewRows),
    notifyRows: sortRows(notifyRows),
    followUpRows: sortRows(followUpRows),
    closedRows: sortRows(closedRows),
  };
};
