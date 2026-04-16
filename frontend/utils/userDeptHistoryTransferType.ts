import type { UserDeptHistoryTransferType } from '../types';

export const DEFAULT_USER_DEPT_HISTORY_TRANSFER_TYPE: UserDeptHistoryTransferType = 'LUAN_CHUYEN';

export const USER_DEPT_HISTORY_TRANSFER_TYPE_OPTIONS: Array<{
  value: UserDeptHistoryTransferType;
  label: string;
}> = [
  { value: 'LUAN_CHUYEN', label: 'Luân chuyển' },
  { value: 'BIET_PHAI', label: 'Biệt phái' },
];

export const normalizeUserDeptHistoryTransferType = (value: unknown): UserDeptHistoryTransferType =>
  value === 'BIET_PHAI' ? 'BIET_PHAI' : DEFAULT_USER_DEPT_HISTORY_TRANSFER_TYPE;

export const getUserDeptHistoryTransferTypeLabel = (value: unknown): string =>
  USER_DEPT_HISTORY_TRANSFER_TYPE_OPTIONS.find((option) => option.value === normalizeUserDeptHistoryTransferType(value))?.label
  ?? 'Luân chuyển';

export const getUserDeptHistoryTransferTypeBadgeClassName = (value: unknown): string =>
  normalizeUserDeptHistoryTransferType(value) === 'BIET_PHAI'
    ? 'bg-amber-100 text-amber-700'
    : 'bg-primary/10 text-primary';
