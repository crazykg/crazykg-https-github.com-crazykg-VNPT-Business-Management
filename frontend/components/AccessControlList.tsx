import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEscKey } from '../hooks/useEscKey';
import {
  Department,
  DeptScopeType,
  Permission,
  Role,
  UserAccessRecord,
} from '../types';
import { PaginationControls } from './PaginationControls';
import { SearchableMultiSelect } from './SearchableMultiSelect';
import { SearchableSelect } from './SearchableSelect';

const SCOPE_OPTIONS: Array<{ value: DeptScopeType; label: string }> = [
  { value: 'ALL', label: 'Toàn hệ thống' },
  { value: 'DEPT_AND_CHILDREN', label: 'Phòng ban + cấp dưới' },
  { value: 'DEPT_ONLY', label: 'Chỉ phòng ban' },
  { value: 'SELF_ONLY', label: 'Chỉ bản thân' },
];

const PERMISSION_DECISION_OPTIONS: Array<{ value: PermissionDecision; label: string }> = [
  { value: 'INHERIT', label: 'Kế thừa' },
  { value: 'GRANT', label: 'GRANT' },
  { value: 'DENY', label: 'DENY' },
];

interface AccessControlListProps {
  records: UserAccessRecord[];
  roles: Role[];
  permissions: Permission[];
  departments: Department[];
  onRefresh: () => Promise<void>;
  onUpdateRoles: (userId: number, roleIds: number[]) => Promise<void>;
  onBulkUpdateRoles: (
    updates: Array<{
      userId: number;
      roleIds: number[];
    }>
  ) => Promise<void>;
  onBulkUpdatePermissions: (
    updates: Array<{
      userId: number;
      overrides: Array<{
        permission_id: number;
        type: 'GRANT' | 'DENY';
        reason?: string | null;
      }>;
    }>
  ) => Promise<void>;
  onBulkUpdateScopes: (
    updates: Array<{
      userId: number;
      scopes: Array<{
        dept_id: number;
        scope_type: DeptScopeType;
      }>;
    }>
  ) => Promise<void>;
  onUpdatePermissions: (
    userId: number,
    overrides: Array<{
      permission_id: number;
      type: 'GRANT' | 'DENY';
      reason?: string | null;
      expires_at?: string | null;
    }>
  ) => Promise<void>;
  onUpdateScopes: (
    userId: number,
    scopes: Array<{
      dept_id: number;
      scope_type: DeptScopeType;
    }>
  ) => Promise<void>;
}

type EditorMode = 'roles' | 'permissions' | 'scopes' | null;
type PermissionDecision = 'INHERIT' | 'GRANT' | 'DENY';

interface PermissionDraftValue {
  type: PermissionDecision;
  reason: string;
}

interface BulkPermissionDraftRow {
  permission_ids: number[];
  type: Exclude<PermissionDecision, 'INHERIT'>;
  reason: string;
}

interface BulkScopeDraftRow {
  dept_id: number;
  scope_type: DeptScopeType;
}

interface PermissionGroupConfig {
  key: string;
  label: string;
  resources: string[];
  order: number;
}

interface PermissionModuleView {
  key: string;
  label: string;
  permissions: Permission[];
}

interface PermissionGroupView {
  key: string;
  label: string;
  order: number;
  total: number;
  modules: PermissionModuleView[];
}

const normalizeRoleDraft = (values: number[]): number[] =>
  Array.from(new Set(values.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))).sort(
    (left, right) => left - right
  );

const normalizeScopeDraft = (values: Array<{ dept_id: number; scope_type: DeptScopeType }>): Array<{ dept_id: number; scope_type: DeptScopeType }> =>
  values
    .map((value) => ({ dept_id: Number(value.dept_id || 0), scope_type: value.scope_type }))
    .filter((value) => value.dept_id > 0)
    .sort((left, right) => {
      if (left.dept_id !== right.dept_id) {
        return left.dept_id - right.dept_id;
      }
      return left.scope_type.localeCompare(right.scope_type, 'vi');
    });

const normalizePermissionDraftValue = (value?: PermissionDraftValue): PermissionDraftValue => ({
  type: value?.type || 'INHERIT',
  reason: String(value?.reason || '').trim(),
});

const buildPermissionDraftMap = (
  permissionCatalog: Permission[],
  overrides: Array<{
    permission_id: number;
    type?: unknown;
    reason?: string | null;
  }>
): Record<number, PermissionDraftValue> => {
  const nextDraft: Record<number, PermissionDraftValue> = {};
  permissionCatalog.forEach((permission) => {
    nextDraft[permission.id] = { type: 'INHERIT', reason: '' };
  });

  overrides.forEach((item) => {
    const permissionId = Number(item.permission_id || 0);
    if (!Number.isFinite(permissionId) || permissionId <= 0) {
      return;
    }
    nextDraft[permissionId] = {
      type: item.type === 'DENY' ? 'DENY' : 'GRANT',
      reason: item.reason || '',
    };
  });

  return nextDraft;
};

const normalizePermissionIds = (values: Array<string | number>): number[] =>
  Array.from(
    new Set(
      values
        .map((value) => Number(value || 0))
        .filter((value) => Number.isFinite(value) && value > 0)
    )
  ).sort((left, right) => left - right);

const createEmptyBulkPermissionRow = (): BulkPermissionDraftRow => ({
  permission_ids: [],
  type: 'GRANT',
  reason: '',
});

const serializeRoleDraft = (values: number[]): string => JSON.stringify(normalizeRoleDraft(values));

const serializeScopeDraft = (values: Array<{ dept_id: number; scope_type: DeptScopeType }>): string =>
  JSON.stringify(normalizeScopeDraft(values));

const serializePermissionOverrides = (values: Record<number, PermissionDraftValue>): string => {
  const normalized = Object.entries(values)
    .map(([permissionId, value]) => ({
      permission_id: Number(permissionId),
      ...normalizePermissionDraftValue(value),
    }))
    .filter((value) => Number.isFinite(value.permission_id) && value.permission_id > 0 && value.type !== 'INHERIT')
    .map((value) => ({
      permission_id: value.permission_id,
      type: value.type === 'DENY' ? 'DENY' : 'GRANT',
      reason: value.reason || null,
    }))
    .sort((left, right) => left.permission_id - right.permission_id);

  return JSON.stringify(normalized);
};

const normalizeBulkPermissionRows = (rows: BulkPermissionDraftRow[]): BulkPermissionDraftRow[] => {
  return rows
    .map((row): BulkPermissionDraftRow => {
      const type: BulkPermissionDraftRow['type'] = row.type === 'DENY' ? 'DENY' : 'GRANT';
      return {
        permission_ids: normalizePermissionIds(row.permission_ids || []),
        type,
        reason: String(row.reason || '').trim(),
      };
    })
    .filter((row) => row.permission_ids.length > 0);
};

const flattenBulkPermissionRows = (
  rows: BulkPermissionDraftRow[]
): Array<{ permission_id: number; type: 'GRANT' | 'DENY'; reason: string }> => {
  const flattened = new Map<number, { permission_id: number; type: 'GRANT' | 'DENY'; reason: string }>();

  normalizeBulkPermissionRows(rows).forEach((row) => {
    row.permission_ids.forEach((permissionId) => {
      flattened.set(permissionId, {
        permission_id: permissionId,
        type: row.type,
        reason: row.reason,
      });
    });
  });

  return Array.from(flattened.values()).sort((left, right) => left.permission_id - right.permission_id);
};

const normalizeBulkScopeRows = (rows: BulkScopeDraftRow[]): BulkScopeDraftRow[] => {
  const deduped = new Map<number, BulkScopeDraftRow>();
  rows.forEach((row) => {
    const deptId = Number(row.dept_id || 0);
    if (!Number.isFinite(deptId) || deptId <= 0) {
      return;
    }
    deduped.set(deptId, {
      dept_id: deptId,
      scope_type: row.scope_type,
    });
  });

  return Array.from(deduped.values()).sort((left, right) => left.dept_id - right.dept_id);
};

const normalizeScopeType = (value: unknown): DeptScopeType =>
  SCOPE_OPTIONS.some((option) => option.value === value)
    ? (value as DeptScopeType)
    : 'DEPT_ONLY';

const normalizePermissionOverrideType = (value: unknown): 'GRANT' | 'DENY' =>
  value === 'DENY' ? 'DENY' : 'GRANT';

const buildBulkPermissionRowsFromOverrides = (
  overrides: Array<{
    permission_id: number;
    type?: unknown;
    reason?: string | null;
  }>
): BulkPermissionDraftRow[] => {
  const grouped = new Map<string, BulkPermissionDraftRow>();

  overrides.forEach((item) => {
    const permissionId = Number(item.permission_id || 0);
    if (!Number.isFinite(permissionId) || permissionId <= 0) {
      return;
    }

    const type = normalizePermissionOverrideType(item.type);
    const reason = String(item.reason || '').trim();
    const key = `${type}::${reason}`;
    const current = grouped.get(key) || {
      permission_ids: [],
      type,
      reason,
    };

    current.permission_ids = normalizePermissionIds([...current.permission_ids, permissionId]);
    grouped.set(key, current);
  });

  const rows = Array.from(grouped.values())
    .map((row) => ({
      ...row,
      permission_ids: normalizePermissionIds(row.permission_ids),
    }))
    .filter((row) => row.permission_ids.length > 0)
    .sort((left, right) => {
      const permissionCompare = (left.permission_ids[0] || 0) - (right.permission_ids[0] || 0);
      if (permissionCompare !== 0) {
        return permissionCompare;
      }

      const typeCompare = left.type.localeCompare(right.type, 'vi');
      if (typeCompare !== 0) {
        return typeCompare;
      }

      return left.reason.localeCompare(right.reason, 'vi');
    });

  return rows.length > 0 ? rows : [createEmptyBulkPermissionRow()];
};

const PERMISSION_GROUP_CONFIGS: PermissionGroupConfig[] = [
  { key: 'user', label: 'Người dùng', resources: ['employees', 'departments', 'user_dept_history'], order: 1 },
  { key: 'customer', label: 'Khách hàng', resources: ['customers', 'customer_personnel', 'opportunities'], order: 2 },
  { key: 'contract', label: 'Hợp đồng', resources: ['contracts'], order: 3 },
  { key: 'project', label: 'Dự án', resources: ['projects'], order: 4 },
  { key: 'master_data', label: 'Danh mục', resources: ['businesses', 'vendors', 'products'], order: 5 },
  {
    key: 'support',
    label: 'Hỗ trợ',
    resources: [
      'support_requests',
      'support_service_groups',
      'support_contact_positions',
      'support_worklog_activity_types',
      'support_sla_configs',
    ],
    order: 6,
  },
  { key: 'document', label: 'Tài liệu', resources: ['documents'], order: 7 },
  { key: 'reminder', label: 'Nhắc việc', resources: ['reminders'], order: 8 },
  { key: 'system', label: 'Hệ thống', resources: ['audit_logs', 'authz', 'system', 'dashboard'], order: 9 },
];

const PERMISSION_RESOURCE_LABEL: Record<string, string> = {
  employees: 'Nhân sự',
  departments: 'Phòng ban',
  user_dept_history: 'Lịch sử luân chuyển',
  customers: 'Khách hàng',
  customer_personnel: 'Đầu mối liên hệ',
  opportunities: 'Cơ hội kinh doanh',
  contracts: 'Hợp đồng',
  projects: 'Dự án',
  businesses: 'Lĩnh vực kinh doanh',
  vendors: 'Nhà cung cấp',
  products: 'Sản phẩm',
  support_requests: 'Yêu cầu KH & danh mục hỗ trợ',
  support_service_groups: 'Nhóm Zalo/Telegram yêu cầu',
  support_contact_positions: 'Chức vụ liên hệ',
  support_worklog_activity_types: 'Loại công việc worklog',
  support_sla_configs: 'Cấu hình SLA hỗ trợ',
  documents: 'Tài liệu',
  reminders: 'Nhắc việc',
  audit_logs: 'Nhật ký hệ thống',
  authz: 'Phân quyền',
  system: 'Hệ thống',
  dashboard: 'Dashboard',
};

const PERMISSION_ACTION_LABEL: Record<string, string> = {
  read: 'Xem/Tìm kiếm',
  view: 'Xem/Tìm kiếm',
  write: 'Thêm/Sửa',
  delete: 'Xóa',
  import: 'Nhập',
  export: 'Xuất',
  payments: 'Quản lý thanh toán',
  history: 'Xem lịch sử',
  status: 'Cập nhật trạng thái',
  manage: 'Quản trị',
};

const PERMISSION_ACTION_ORDER: Record<string, number> = {
  read: 1,
  view: 1,
  write: 2,
  delete: 3,
  import: 4,
  export: 5,
  payments: 6,
  history: 7,
  status: 8,
  manage: 9,
};

const parsePermissionKey = (permKey: string): { resource: string; action: string } => {
  const [resource = '', action = ''] = String(permKey || '')
    .trim()
    .toLowerCase()
    .split('.', 2);
  return { resource, action };
};

const resolvePermissionActionLabel = (permKey: string): string => {
  const { action } = parsePermissionKey(permKey);
  if (!action) {
    return 'Quyền khác';
  }
  return PERMISSION_ACTION_LABEL[action] || action.toUpperCase();
};

const resolvePermissionActionOrder = (permKey: string): number => {
  const { action } = parsePermissionKey(permKey);
  return PERMISSION_ACTION_ORDER[action] ?? 99;
};

const secondaryButtonClass =
  'inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50';

const primaryButtonClass =
  'inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-deep-teal disabled:opacity-50';

const dangerButtonClass =
  'inline-flex items-center gap-1.5 rounded bg-error px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50';

const tableActionButtonClass =
  'inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50';

const compactInputClass =
  'h-8 rounded border border-slate-300 px-3 text-xs text-slate-700 placeholder:text-neutral focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30';

const compactSelectTriggerClass =
  'h-8 rounded border border-slate-300 px-3 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30';

const compactMultiSelectTriggerClass =
  'min-h-[32px] rounded border border-slate-300 px-3 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30';

const modalOverlayClass = 'fixed inset-0 z-[500] overflow-y-auto bg-slate-900/35 p-3 backdrop-blur-sm sm:p-4';
const modalPanelClass = 'mx-auto overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl';

export const AccessControlList: React.FC<AccessControlListProps> = ({
  records,
  roles,
  permissions,
  departments,
  onRefresh,
  onUpdateRoles,
  onBulkUpdateRoles,
  onBulkUpdatePermissions,
  onBulkUpdateScopes,
  onUpdatePermissions,
  onUpdateScopes,
}) => {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [selectedRecord, setSelectedRecord] = useState<UserAccessRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [permissionSearch, setPermissionSearch] = useState('');
  const [permissionCopySourceUserId, setPermissionCopySourceUserId] = useState(0);
  const [showChangedOnly, setShowChangedOnly] = useState(false);
  const [initialRoleDraft, setInitialRoleDraft] = useState<number[]>([]);
  const [initialScopeDraft, setInitialScopeDraft] = useState<Array<{ dept_id: number; scope_type: DeptScopeType }>>([]);
  const [initialPermissionDraft, setInitialPermissionDraft] = useState<Record<number, PermissionDraftValue>>({});
  const [closeAfterSaveRequested, setCloseAfterSaveRequested] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isBulkRoleModalOpen, setIsBulkRoleModalOpen] = useState(false);
  const [isBulkPermissionModalOpen, setIsBulkPermissionModalOpen] = useState(false);
  const [isBulkScopeModalOpen, setIsBulkScopeModalOpen] = useState(false);
  const [bulkRoleDraft, setBulkRoleDraft] = useState<number[]>([]);
  const [bulkRoleMode, setBulkRoleMode] = useState<'MERGE' | 'REPLACE'>('MERGE');
  const [bulkPermissionDraft, setBulkPermissionDraft] = useState<BulkPermissionDraftRow[]>([]);
  const [bulkPermissionMode, setBulkPermissionMode] = useState<'MERGE' | 'REPLACE'>('MERGE');
  const [bulkPermissionCopySourceUserId, setBulkPermissionCopySourceUserId] = useState(0);
  const [bulkPermissionCopiedSourceUserId, setBulkPermissionCopiedSourceUserId] = useState(0);
  const [bulkScopeDraft, setBulkScopeDraft] = useState<BulkScopeDraftRow[]>([]);
  const [bulkScopeMode, setBulkScopeMode] = useState<'MERGE' | 'REPLACE'>('MERGE');
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const [roleDraft, setRoleDraft] = useState<number[]>([]);
  const [scopeDraft, setScopeDraft] = useState<Array<{ dept_id: number; scope_type: DeptScopeType }>>([]);
  const [permissionDraft, setPermissionDraft] = useState<Record<number, PermissionDraftValue>>({});
  const roleEditorPanelRef = useRef<HTMLDivElement | null>(null);
  const roleEditorTriggerRef = useRef<HTMLButtonElement | null>(null);

  const isAnyBulkModalOpen = isBulkRoleModalOpen || isBulkPermissionModalOpen || isBulkScopeModalOpen;
  const isEditorModalOpen = !!editorMode && selectedRecord !== null;
  const isAnyAccessControlModalOpen = isAnyBulkModalOpen || isEditorModalOpen;
  const portalRoot = typeof document !== 'undefined' ? document.body : null;

  const selectedUserIdSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds]);

  const selectedRecords = useMemo(
    () => records.filter((record) => selectedUserIdSet.has(Number(record.user.id))),
    [records, selectedUserIdSet]
  );

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return records;
    }

    return records.filter((record) => {
      const user = record.user;
      const text = `${user.user_code || ''} ${user.username || ''} ${user.full_name || ''} ${user.email || ''} ${user.department_name || ''}`.toLowerCase();
      return text.includes(keyword);
    });
  }, [records, search]);

  const filteredPermissions = useMemo(() => {
    const keyword = permissionSearch.trim().toLowerCase();
    if (!keyword) {
      return permissions;
    }
    return permissions.filter((item) => {
      const text = `${item.perm_key} ${item.perm_name} ${item.perm_group}`.toLowerCase();
      return text.includes(keyword);
    });
  }, [permissions, permissionSearch]);

  const changedPermissionCount = useMemo(() => {
    return permissions.reduce((count, permission) => {
      const current = normalizePermissionDraftValue(permissionDraft[permission.id]);
      const initial = normalizePermissionDraftValue(initialPermissionDraft[permission.id]);
      if (current.type !== initial.type || current.reason !== initial.reason) {
        return count + 1;
      }
      return count;
    }, 0);
  }, [permissions, permissionDraft, initialPermissionDraft]);

  const groupedPermissions = useMemo((): PermissionGroupView[] => {
    const permissionSource = showChangedOnly
      ? filteredPermissions.filter((permission) => {
          const current = normalizePermissionDraftValue(permissionDraft[permission.id]);
          const initial = normalizePermissionDraftValue(initialPermissionDraft[permission.id]);
          return current.type !== initial.type || current.reason !== initial.reason;
        })
      : filteredPermissions;

    const grouped = new Map<string, { meta: PermissionGroupConfig | { key: string; label: string; order: number }; modules: Map<string, Permission[]> }>();

    const fallbackMeta = { key: 'other', label: 'Nhóm khác', order: 999 };

    permissionSource.forEach((permission) => {
      const { resource } = parsePermissionKey(permission.perm_key);
      const config =
        PERMISSION_GROUP_CONFIGS.find((group) => group.resources.includes(resource)) ??
        fallbackMeta;

      if (!grouped.has(config.key)) {
        grouped.set(config.key, {
          meta: config,
          modules: new Map<string, Permission[]>(),
        });
      }

      const group = grouped.get(config.key);
      if (!group) {
        return;
      }

      const moduleKey = resource || permission.perm_group.toLowerCase() || 'other';
      const current = group.modules.get(moduleKey) || [];
      current.push(permission);
      group.modules.set(moduleKey, current);
    });

    return Array.from(grouped.values())
      .map((group): PermissionGroupView => {
        const modules = Array.from(group.modules.entries())
          .map(([moduleKey, modulePermissions]): PermissionModuleView => {
            const moduleLabel =
              PERMISSION_RESOURCE_LABEL[moduleKey] ||
              modulePermissions[0]?.perm_group ||
              moduleKey;

            const sortedPermissions = [...modulePermissions].sort((left, right) => {
              const orderCompare = resolvePermissionActionOrder(left.perm_key) - resolvePermissionActionOrder(right.perm_key);
              if (orderCompare !== 0) {
                return orderCompare;
              }
              return left.perm_name.localeCompare(right.perm_name, 'vi');
            });

            return {
              key: moduleKey,
              label: moduleLabel,
              permissions: sortedPermissions,
            };
          })
          .sort((left, right) => left.label.localeCompare(right.label, 'vi'));

        const total = modules.reduce((sum, module) => sum + module.permissions.length, 0);

        return {
          key: group.meta.key,
          label: group.meta.label,
          order: group.meta.order,
          total,
          modules,
        };
      })
      .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label, 'vi'));
  }, [filteredPermissions, showChangedOnly, permissionDraft, initialPermissionDraft]);

  const totalItems = filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));

  const paginatedRecords = useMemo(
    () => filteredRecords.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage),
    [filteredRecords, currentPage, rowsPerPage]
  );

  const areAllVisibleSelected = useMemo(() => {
    if (paginatedRecords.length === 0) {
      return false;
    }
    return paginatedRecords.every((record) => selectedUserIdSet.has(Number(record.user.id)));
  }, [paginatedRecords, selectedUserIdSet]);

  const permissionMultiSelectOptions = useMemo(
    () =>
      permissions.map((permission) => ({
        value: permission.id,
        label: `${permission.perm_name} (${permission.perm_key})`,
        searchText: `${permission.perm_name} ${permission.perm_key} ${permission.perm_group}`,
      })),
    [permissions]
  );

  const permissionCopySourceOptions = useMemo(
    () => [
      { value: 0, label: 'Chọn người dùng nguồn' },
      ...records
        .filter((record) => Number(record.user.id) !== Number(selectedRecord?.user.id || 0))
        .map((record) => ({
          value: record.user.id,
          label: `${record.user.full_name || record.user.username} (${record.user.username}) • ${record.permissions.length} override`,
          searchText: `${record.user.user_code || ''} ${record.user.username || ''} ${record.user.full_name || ''} ${record.user.email || ''}`,
        })),
    ],
    [records, selectedRecord]
  );

  const bulkPermissionCopySourceOptions = useMemo(
    () => [
      { value: 0, label: 'Chọn người dùng nguồn' },
      ...records
        .filter((record) => !selectedUserIdSet.has(Number(record.user.id)))
        .map((record) => ({
          value: record.user.id,
          label: `${record.user.full_name || record.user.username} (${record.user.username}) • ${record.permissions.length} override`,
          searchText: `${record.user.user_code || ''} ${record.user.username || ''} ${record.user.full_name || ''} ${record.user.email || ''}`,
        })),
    ],
    [records, selectedUserIdSet]
  );

  const departmentScopeOptions = useMemo(
    () => [
      { value: 0, label: 'Chọn phòng ban' },
      ...departments.map((department) => ({
        value: department.id,
        label: `${department.dept_code} - ${department.dept_name}`,
      })),
    ],
    [departments]
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!editorMode) {
      return false;
    }
    if (editorMode === 'roles') {
      return serializeRoleDraft(roleDraft) !== serializeRoleDraft(initialRoleDraft);
    }
    if (editorMode === 'permissions') {
      return serializePermissionOverrides(permissionDraft) !== serializePermissionOverrides(initialPermissionDraft);
    }
    return serializeScopeDraft(scopeDraft) !== serializeScopeDraft(initialScopeDraft);
  }, [
    editorMode,
    roleDraft,
    initialRoleDraft,
    permissionDraft,
    initialPermissionDraft,
    scopeDraft,
    initialScopeDraft,
  ]);

  useEffect(() => {
    if (selectedRecords.length !== 0) {
      return;
    }

    if (isBulkRoleModalOpen) {
      setIsBulkRoleModalOpen(false);
      setBulkRoleDraft([]);
      setBulkRoleMode('MERGE');
    }
    if (isBulkPermissionModalOpen) {
      setIsBulkPermissionModalOpen(false);
      setBulkPermissionDraft([]);
      setBulkPermissionMode('MERGE');
      setBulkPermissionCopySourceUserId(0);
      setBulkPermissionCopiedSourceUserId(0);
    }
    if (isBulkScopeModalOpen) {
      setIsBulkScopeModalOpen(false);
      setBulkScopeDraft([]);
      setBulkScopeMode('MERGE');
    }
  }, [
    isBulkPermissionModalOpen,
    isBulkRoleModalOpen,
    isBulkScopeModalOpen,
    selectedRecords.length,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (selectedUserIds.length === 0) {
      return;
    }

    const recordIdSet = new Set(records.map((record) => Number(record.user.id)));
    setSelectedUserIds((prev) => prev.filter((id) => recordIdSet.has(id)));
  }, [records, selectedUserIds.length]);

  useEffect(() => {
    if (!editorMode || !hasUnsavedChanges) {
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [editorMode, hasUnsavedChanges]);

  useEffect(() => {
    if (editorMode !== 'roles' || !selectedRecord) {
      return;
    }

    const panel = roleEditorPanelRef.current;
    if (!panel) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      const nextFocusTarget =
        panel.querySelector<HTMLElement>('input[type="checkbox"]:checked:not([disabled])') ||
        panel.querySelector<HTMLElement>('input[type="checkbox"]:not([disabled])') ||
        panel.querySelector<HTMLElement>(
          'button:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

      nextFocusTarget?.focus();
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [editorMode, selectedRecord, roles]);

  useEffect(() => {
    if (!isAnyAccessControlModalOpen) {
      return;
    }

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;

    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isAnyAccessControlModalOpen]);

  const openRoleEditor = (record: UserAccessRecord, trigger?: HTMLButtonElement | null) => {
    if (isSaving || isBulkSaving || isAnyBulkModalOpen) {
      return;
    }
    const draft = record.roles.map((role) => role.role_id);
    roleEditorTriggerRef.current = trigger || null;
    setSelectedRecord(record);
    setRoleDraft(draft);
    setInitialRoleDraft(draft);
    setEditorMode('roles');
  };

  const openPermissionEditor = (record: UserAccessRecord) => {
    if (isSaving || isBulkSaving || isAnyBulkModalOpen) {
      return;
    }
    roleEditorTriggerRef.current = null;
    setSelectedRecord(record);
    setPermissionDraft(buildPermissionDraftMap(permissions, record.permissions));
    setInitialPermissionDraft(buildPermissionDraftMap(permissions, record.permissions));
    setPermissionCopySourceUserId(0);
    setPermissionSearch('');
    setShowChangedOnly(false);
    setEditorMode('permissions');
  };

  const openScopeEditor = (record: UserAccessRecord) => {
    if (isSaving || isBulkSaving || isAnyBulkModalOpen) {
      return;
    }
    roleEditorTriggerRef.current = null;
    const scopes: BulkScopeDraftRow[] = record.dept_scopes.map((scope) => ({
      dept_id: Number(scope.dept_id || 0),
      scope_type: normalizeScopeType(scope.scope_type),
    }));
    const normalizedScopes: BulkScopeDraftRow[] = scopes.length > 0
      ? scopes
      : [{ dept_id: Number(record.user.department_id || 0), scope_type: 'DEPT_ONLY' }];
    setSelectedRecord(record);
    setScopeDraft(normalizedScopes);
    setInitialScopeDraft(normalizedScopes);
    setEditorMode('scopes');
  };

  const closeEditorNow = () => {
    const roleTrigger = editorMode === 'roles' ? roleEditorTriggerRef.current : null;
    setCloseAfterSaveRequested(false);
    setIsSaving(false);
    setEditorMode(null);
    setSelectedRecord(null);
    setRoleDraft([]);
    setInitialRoleDraft([]);
    setScopeDraft([]);
    setInitialScopeDraft([]);
    setPermissionDraft({});
    setInitialPermissionDraft({});
    setPermissionCopySourceUserId(0);
    setPermissionSearch('');
    setShowChangedOnly(false);
    roleEditorTriggerRef.current = null;
    if (roleTrigger?.isConnected) {
      window.requestAnimationFrame(() => {
        if (roleTrigger.isConnected) {
          roleTrigger.focus();
        }
      });
    }
  };

  const openBulkRoleEditor = () => {
    if (isSaving || isBulkSaving || selectedRecords.length === 0 || editorMode || isAnyBulkModalOpen) {
      return;
    }
    setBulkRoleDraft([]);
    setBulkRoleMode('MERGE');
    setIsBulkRoleModalOpen(true);
  };

  const closeBulkRoleEditor = (force = false) => {
    if (isBulkSaving && !force) {
      return;
    }
    setIsBulkRoleModalOpen(false);
    setBulkRoleDraft([]);
    setBulkRoleMode('MERGE');
  };

  const openBulkPermissionEditor = () => {
    if (isSaving || isBulkSaving || selectedRecords.length === 0 || editorMode || isAnyBulkModalOpen) {
      return;
    }
    setBulkPermissionDraft([createEmptyBulkPermissionRow()]);
    setBulkPermissionMode('MERGE');
    setBulkPermissionCopySourceUserId(0);
    setBulkPermissionCopiedSourceUserId(0);
    setIsBulkPermissionModalOpen(true);
  };

  const closeBulkPermissionEditor = (force = false) => {
    if (isBulkSaving && !force) {
      return;
    }
    setIsBulkPermissionModalOpen(false);
    setBulkPermissionDraft([]);
    setBulkPermissionMode('MERGE');
    setBulkPermissionCopySourceUserId(0);
    setBulkPermissionCopiedSourceUserId(0);
  };

  const openBulkScopeEditor = () => {
    if (isSaving || isBulkSaving || selectedRecords.length === 0 || editorMode || isAnyBulkModalOpen) {
      return;
    }
    setBulkScopeDraft([{ dept_id: 0, scope_type: 'DEPT_ONLY' }]);
    setBulkScopeMode('MERGE');
    setIsBulkScopeModalOpen(true);
  };

  const closeBulkScopeEditor = (force = false) => {
    if (isBulkSaving && !force) {
      return;
    }
    setIsBulkScopeModalOpen(false);
    setBulkScopeDraft([]);
    setBulkScopeMode('MERGE');
  };

  const requestCloseEditor = (skipUnsavedCheck = false) => {
    if (isSaving) {
      setCloseAfterSaveRequested(true);
      return;
    }

    if (!skipUnsavedCheck && hasUnsavedChanges) {
      const confirmed = window.confirm('Bạn có thay đổi chưa lưu. Đóng trình chỉnh sửa?');
      if (!confirmed) {
        return;
      }
    }

    closeEditorNow();
  };

  const handleRoleEditorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => element.tabIndex !== -1 && !element.hasAttribute('disabled'));

    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  useEscKey(closeBulkRoleEditor, isBulkRoleModalOpen);
  useEscKey(closeBulkPermissionEditor, isBulkPermissionModalOpen);
  useEscKey(closeBulkScopeEditor, isBulkScopeModalOpen);
  useEscKey(requestCloseEditor, !!editorMode && selectedRecord !== null);

  const renderModalInPortal = (modal: React.ReactNode) => {
    if (!modal) {
      return null;
    }

    if (!portalRoot) {
      return modal;
    }

    return createPortal(modal, portalRoot);
  };

  const handleRefresh = async () => {
    if (isSaving || isBulkSaving) {
      return;
    }

    if (editorMode && hasUnsavedChanges) {
      const confirmed = window.confirm('Bạn có thay đổi chưa lưu. Làm mới sẽ mất thay đổi, tiếp tục?');
      if (!confirmed) {
        return;
      }
      closeEditorNow();
    }

    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleRowSelection = (userId: number, checked: boolean) => {
    setSelectedUserIds((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, userId]));
      }
      return prev.filter((id) => id !== userId);
    });
  };

  const toggleVisibleSelection = (checked: boolean) => {
    if (checked) {
      setSelectedUserIds((prev) => {
        const next = new Set(prev);
        paginatedRecords.forEach((record) => next.add(Number(record.user.id)));
        return Array.from(next);
      });
      return;
    }

    const filteredIdSet = new Set(paginatedRecords.map((record) => Number(record.user.id)));
    setSelectedUserIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
  };

  const handleSaveBulkRoles = async () => {
    if (isBulkSaving || bulkRoleDraft.length === 0 || selectedRecords.length === 0) {
      return;
    }

    const updates = selectedRecords
      .map((record) => {
        const currentRoleIds = record.roles.map((role) => role.role_id);
        const nextRoleIds = bulkRoleMode === 'REPLACE'
          ? normalizeRoleDraft(bulkRoleDraft)
          : normalizeRoleDraft([...currentRoleIds, ...bulkRoleDraft]);

        return {
          userId: Number(record.user.id),
          roleIds: nextRoleIds,
        };
      })
      .filter((item) => item.roleIds.length > 0);

    if (updates.length === 0) {
      return;
    }

    setIsBulkSaving(true);
    try {
      await onBulkUpdateRoles(updates);
      setSelectedUserIds([]);
      closeBulkRoleEditor(true);
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleSaveBulkPermissions = async () => {
    if (isBulkSaving || selectedRecords.length === 0) {
      return;
    }

    const normalizedDraft = flattenBulkPermissionRows(bulkPermissionDraft);
    const canApplyEmptyReplace = bulkPermissionMode === 'REPLACE' && Number(bulkPermissionCopiedSourceUserId || 0) > 0;
    if (normalizedDraft.length === 0 && !canApplyEmptyReplace) {
      return;
    }

    const updates = selectedRecords
      .map((record) => {
        const currentOverrides: BulkPermissionDraftRow[] = record.permissions.map((item) => ({
          permission_ids: [Number(item.permission_id)],
          type: normalizePermissionOverrideType(item.type),
          reason: item.reason || '',
        }));

        const merged = new Map<number, { permission_id: number; type: 'GRANT' | 'DENY'; reason: string }>();
        if (bulkPermissionMode === 'MERGE') {
          flattenBulkPermissionRows(currentOverrides).forEach((item) => {
            merged.set(item.permission_id, item);
          });
        }
        normalizedDraft.forEach((item) => {
          merged.set(item.permission_id, item);
        });

        const overrides = Array.from(merged.values())
          .sort((left, right) => left.permission_id - right.permission_id)
          .map((item) => ({
            permission_id: item.permission_id,
            type: item.type,
            reason: item.reason || null,
          }));

        return {
          userId: Number(record.user.id),
          overrides,
        };
      })
      .filter((item) => item.overrides.length > 0 || canApplyEmptyReplace);

    if (updates.length === 0) {
      return;
    }

    setIsBulkSaving(true);
    try {
      await onBulkUpdatePermissions(updates);
      setSelectedUserIds([]);
      closeBulkPermissionEditor(true);
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleSaveBulkScopes = async () => {
    if (isBulkSaving || selectedRecords.length === 0) {
      return;
    }

    const normalizedDraft = normalizeBulkScopeRows(bulkScopeDraft);
    if (normalizedDraft.length === 0) {
      return;
    }

    const updates = selectedRecords
      .map((record) => {
        const currentScopes = normalizeBulkScopeRows(
          record.dept_scopes.map((item) => ({
            dept_id: Number(item.dept_id || 0),
            scope_type: item.scope_type,
          }))
        );

        const merged = new Map<number, BulkScopeDraftRow>();
        if (bulkScopeMode === 'MERGE') {
          currentScopes.forEach((item) => merged.set(item.dept_id, item));
        }
        normalizedDraft.forEach((item) => merged.set(item.dept_id, item));

        const scopes = Array.from(merged.values())
          .sort((left, right) => left.dept_id - right.dept_id)
          .map((item) => ({
            dept_id: item.dept_id,
            scope_type: item.scope_type,
          }));

        return {
          userId: Number(record.user.id),
          scopes,
        };
      })
      .filter((item) => item.scopes.length > 0);

    if (updates.length === 0) {
      return;
    }

    setIsBulkSaving(true);
    try {
      await onBulkUpdateScopes(updates);
      setSelectedUserIds([]);
      closeBulkScopeEditor(true);
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleSaveRoles = async () => {
    if (!selectedRecord || roleDraft.length === 0) {
      return;
    }
    setIsSaving(true);
    let saved = false;
    try {
      await onUpdateRoles(selectedRecord.user.id, roleDraft);
      saved = true;
      closeEditorNow();
    } finally {
      setIsSaving(false);
      if (!saved) {
        setCloseAfterSaveRequested(false);
      }
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedRecord) {
      return;
    }

    const permissionEntries = Object.entries(permissionDraft) as Array<
      [string, PermissionDraftValue]
    >;

    const overrides = permissionEntries
      .filter(([, value]) => value.type !== 'INHERIT')
      .map(([permissionId, value]) => ({
        permission_id: Number(permissionId),
        type: normalizePermissionOverrideType(value.type),
        reason: value.reason || null,
      }));

    setIsSaving(true);
    let saved = false;
    try {
      await onUpdatePermissions(selectedRecord.user.id, overrides);
      saved = true;
      closeEditorNow();
    } finally {
      setIsSaving(false);
      if (!saved) {
        setCloseAfterSaveRequested(false);
      }
    }
  };

  const handleCopyPermissionsFromSource = () => {
    if (!selectedRecord) {
      return;
    }

    const sourceUserId = Number(permissionCopySourceUserId || 0);
    if (!Number.isFinite(sourceUserId) || sourceUserId <= 0) {
      return;
    }

    const sourceRecord = records.find((record) => Number(record.user.id) === sourceUserId);
    if (!sourceRecord) {
      return;
    }

    setPermissionDraft(buildPermissionDraftMap(permissions, sourceRecord.permissions));
    setPermissionSearch('');
    setShowChangedOnly(sourceRecord.permissions.length > 0);
  };

  const handleCopyBulkPermissionsFromSource = () => {
    const sourceUserId = Number(bulkPermissionCopySourceUserId || 0);
    if (!Number.isFinite(sourceUserId) || sourceUserId <= 0) {
      return;
    }

    const sourceRecord = records.find((record) => Number(record.user.id) === sourceUserId);
    if (!sourceRecord) {
      return;
    }

    setBulkPermissionDraft(buildBulkPermissionRowsFromOverrides(sourceRecord.permissions));
    setBulkPermissionMode('REPLACE');
    setBulkPermissionCopiedSourceUserId(sourceUserId);
  };

  const handleSaveScopes = async () => {
    if (!selectedRecord) {
      return;
    }

    const cleanScopes = scopeDraft
      .map((scope): BulkScopeDraftRow => ({
        dept_id: Number(scope.dept_id || 0),
        scope_type: normalizeScopeType(scope.scope_type),
      }))
      .filter((scope) => scope.dept_id > 0);

    if (cleanScopes.length === 0) {
      return;
    }

    setIsSaving(true);
    let saved = false;
    try {
      await onUpdateScopes(selectedRecord.user.id, cleanScopes);
      saved = true;
      closeEditorNow();
    } finally {
      setIsSaving(false);
      if (!saved) {
        setCloseAfterSaveRequested(false);
      }
    }
  };

  return (
    <div data-testid="access-control-page" className="space-y-3 px-3 pb-6 pt-0">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-secondary/15">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>
              shield
            </span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal leading-tight">Phân quyền người dùng</h2>
            <p className="text-[11px] text-slate-400 leading-tight">
              Quản trị vai trò, quyền override và phạm vi dữ liệu theo phòng ban.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedUserIds.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>
                done_all
              </span>
              Đã chọn {selectedUserIds.length}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleRefresh}
            className={secondaryButtonClass}
            disabled={isRefreshing || isSaving || isBulkSaving}
          >
            <span
              className={`material-symbols-outlined text-primary ${isRefreshing ? 'animate-spin' : ''}`}
              style={{ fontSize: 16 }}
            >
              refresh
            </span>
            Làm mới
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral">Người dùng quản trị</span>
            <div className="flex h-7 w-7 items-center justify-center rounded bg-secondary/15">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>
                group
              </span>
            </div>
          </div>
          <p className="text-xl font-black leading-tight text-deep-teal">{records.length}</p>
          <p className="mt-0.5 text-[10px] text-slate-400">Hiển thị {filteredRecords.length} bản ghi theo bộ lọc</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral">Đã gán vai trò</span>
            <div className="flex h-7 w-7 items-center justify-center rounded bg-secondary/15">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>
                badge
              </span>
            </div>
          </div>
          <p className="text-xl font-black leading-tight text-deep-teal">
            {records.filter((record) => record.roles.length > 0).length}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">Người dùng có ít nhất một vai trò đang hoạt động</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral">Có quyền override</span>
            <div className="flex h-7 w-7 items-center justify-center rounded bg-secondary/15">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>
                vpn_key
              </span>
            </div>
          </div>
          <p className="text-xl font-black leading-tight text-deep-teal">
            {records.filter((record) => record.permissions.length > 0).length}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">Các tài khoản có cấu hình quyền riêng ngoài role</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral">Có scope dữ liệu</span>
            <div className="flex h-7 w-7 items-center justify-center rounded bg-secondary/15">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>
                tune
              </span>
            </div>
          </div>
          <p className="text-xl font-black leading-tight text-deep-teal">
            {records.filter((record) => record.dept_scopes.length > 0).length}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">Đã khai báo phạm vi dữ liệu theo phòng ban</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="space-y-3 border-b border-slate-100 p-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-md">
              <span
                className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral"
                style={{ fontSize: 16 }}
              >
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Tìm theo mã NV, username, họ tên, email..."
                className={`w-full pl-9 ${compactInputClass}`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-500">
                {filteredRecords.length}/{records.length} người dùng
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-deep-teal/10 px-2 py-0.5 font-bold text-deep-teal">
                {records.filter((record) => record.roles.length > 0).length} có vai trò
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 font-bold text-warning">
                {records.filter((record) => record.permissions.length > 0).length} có override
              </span>
            </div>
          </div>

          {selectedUserIds.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-lg border border-primary/15 bg-primary/5 p-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>
                    fact_check
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-deep-teal">Đang thao tác hàng loạt trên {selectedUserIds.length} người dùng</p>
                  <p className="text-[11px] text-slate-500">
                    Chọn nhóm hành động phù hợp để cập nhật role, override quyền hoặc scope dữ liệu.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserIds([])}
                  className={secondaryButtonClass}
                  disabled={isSaving || isBulkSaving}
                >
                  <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>
                    check_box_outline_blank
                  </span>
                  Bỏ chọn
                </button>
                <button
                  type="button"
                  onClick={openBulkRoleEditor}
                  className={primaryButtonClass}
                  disabled={isSaving || isBulkSaving}
                >
                  <span className="material-symbols-outlined text-white" style={{ fontSize: 15 }}>
                    group
                  </span>
                  Gán vai trò
                </button>
                <button
                  type="button"
                  onClick={openBulkPermissionEditor}
                  className={secondaryButtonClass}
                  disabled={isSaving || isBulkSaving}
                >
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>
                    vpn_key
                  </span>
                  Gán quyền
                </button>
                <button
                  type="button"
                  onClick={openBulkScopeEditor}
                  className={secondaryButtonClass}
                  disabled={isSaving || isBulkSaving}
                >
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>
                    tune
                  </span>
                  Gán scope
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left">
            <thead className="border-b border-slate-200 bg-slate-50/90">
              <tr className="text-[11px] font-bold uppercase tracking-[0.08em] text-deep-teal">
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={areAllVisibleSelected}
                    onChange={(event) => toggleVisibleSelection(event.target.checked)}
                    aria-label="Chọn tất cả người dùng trong trang hiện tại"
                    disabled={paginatedRecords.length === 0 || isSaving || isBulkSaving}
                  />
                </th>
                <th className="px-4 py-3">Mã NV</th>
                <th className="px-4 py-3">Tài khoản</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3">Phạm vi dữ liệu</th>
                <th className="px-4 py-3">Override quyền</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <div className="mx-auto max-w-sm space-y-2">
                      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                        <span className="material-symbols-outlined text-neutral" style={{ fontSize: 18 }}>
                          search_off
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-700">Không tìm thấy người dùng phù hợp</p>
                      <p className="text-[11px] text-slate-400">Thử lại với mã NV, email hoặc phòng ban khác.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((record) => {
                  const isSelected = selectedUserIdSet.has(Number(record.user.id));
                  return (
                    <tr
                      key={record.user.id}
                      className={`border-b border-slate-100 ${isSelected ? 'bg-primary/5' : 'hover:bg-slate-50/70'}`}
                    >
                      <td className="px-4 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(event) => toggleRowSelection(Number(record.user.id), event.target.checked)}
                          aria-label={`Chọn người dùng ${record.user.username}`}
                          disabled={isSaving || isBulkSaving}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-sm font-bold text-slate-700">{record.user.user_code || `U${record.user.id}`}</p>
                        <p className="text-[10px] text-slate-400">ID: {record.user.id}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-800">{record.user.full_name || '-'}</p>
                          <p className="text-[11px] text-slate-500">{record.user.username}</p>
                          <p className="text-[10px] text-slate-400">{record.user.email || 'Chưa cập nhật email'}</p>
                          <p className="text-[10px] text-slate-400">{record.user.department_name || 'Chưa gắn phòng ban'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          {record.roles.length > 0 ? (
                            record.roles.map((role) => (
                              <span
                                key={`${record.user.id}-${role.role_id}`}
                                className="inline-flex items-center rounded-full bg-deep-teal/10 px-2 py-0.5 text-[10px] font-bold text-deep-teal"
                              >
                                {role.role_code}
                              </span>
                            ))
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                              Chưa gán
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {record.dept_scopes.length > 0 ? (
                          <div className="space-y-1">
                            {record.dept_scopes.slice(0, 2).map((scope) => (
                              <p
                                key={`${record.user.id}-${scope.id || `${scope.dept_id}-${scope.scope_type}`}`}
                                className="text-[11px] text-slate-600"
                              >
                                {(scope.dept_code ? `${scope.dept_code} - ` : '') +
                                  (scope.dept_name || `Phòng ban ${scope.dept_id}`)}{' '}
                                <span className="font-semibold text-deep-teal">({scope.scope_type})</span>
                              </p>
                            ))}
                            {record.dept_scopes.length > 2 ? (
                              <p className="text-[10px] text-slate-400">+{record.dept_scopes.length - 2} scope khác</p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                            Chưa cấu hình
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            record.permissions.length > 0
                              ? 'bg-warning/15 text-warning'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {record.permissions.length > 0 ? `${record.permissions.length} mục` : 'Kế thừa toàn bộ'}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(event) => openRoleEditor(record, event.currentTarget)}
                            className={tableActionButtonClass}
                          >
                            <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>
                              group
                            </span>
                            Vai trò
                          </button>
                          <button
                            type="button"
                            onClick={() => openPermissionEditor(record)}
                            className={tableActionButtonClass}
                          >
                            <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>
                              vpn_key
                            </span>
                            Quyền
                          </button>
                          <button
                            type="button"
                            onClick={() => openScopeEditor(record)}
                            className={tableActionButtonClass}
                          >
                            <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>
                              tune
                            </span>
                            Scope
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredRecords.length > 0 ? (
          <PaginationControls
            currentPage={currentPage}
            totalItems={totalItems}
            rowsPerPage={rowsPerPage}
            onPageChange={(page) => setCurrentPage(page)}
            onRowsPerPageChange={(rows) => {
              setRowsPerPage(rows);
              setCurrentPage(1);
            }}
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
        ) : null}
      </div>

      {isBulkRoleModalOpen
        ? renderModalInPortal(
            <div
              className={modalOverlayClass}
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  closeBulkRoleEditor();
                }
              }}
            >
              <div className={`${modalPanelClass} max-w-3xl`}>
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-secondary/15">
                      <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>
                        group
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-deep-teal leading-tight">Gán vai trò hàng loạt</h3>
                      <p className="text-[11px] text-slate-400 leading-tight">
                        Áp dụng cho {selectedRecords.length} người dùng đã chọn.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => closeBulkRoleEditor()}
                    className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
                      close
                    </span>
                  </button>
                </div>

                <div className="max-h-[78vh] space-y-3 overflow-y-auto bg-slate-50/30 p-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-xs font-bold text-slate-700">Danh sách người dùng</p>
                    <p className="mb-2 text-[10px] text-slate-400">Kiểm tra nhanh phạm vi áp dụng trước khi lưu.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedRecords.map((record) => (
                        <span
                          key={`bulk-user-${record.user.id}`}
                          className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600"
                        >
                          {record.user.full_name || record.user.username} ({record.user.username})
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="mb-2 text-xs font-bold text-slate-700">Chế độ áp dụng</p>
                    <div className="space-y-2 text-sm text-slate-700">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="bulk-role-mode"
                          checked={bulkRoleMode === 'MERGE'}
                          onChange={() => setBulkRoleMode('MERGE')}
                        />
                        Bổ sung vai trò đã chọn, giữ nguyên role hiện có.
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="bulk-role-mode"
                          checked={bulkRoleMode === 'REPLACE'}
                          onChange={() => setBulkRoleMode('REPLACE')}
                        />
                        Thay toàn bộ role bằng danh sách dưới đây.
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {roles.map((role) => {
                      const checked = bulkRoleDraft.includes(role.id);
                      return (
                        <label
                          key={`bulk-role-${role.id}`}
                          className={`cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition ${
                            checked ? 'border-primary bg-primary/5' : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={checked}
                              onChange={(event) => {
                                if (event.target.checked) {
                                  setBulkRoleDraft((prev) => Array.from(new Set([...prev, role.id])));
                                } else {
                                  setBulkRoleDraft((prev) => prev.filter((id) => id !== role.id));
                                }
                              }}
                            />
                            <div>
                              <span className="text-sm font-semibold text-slate-800">{role.role_code}</span>
                              <p className="mt-1 text-[11px] text-slate-500">{role.role_name}</p>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-4 py-3">
                  <button
                    type="button"
                    onClick={() => closeBulkRoleEditor()}
                    className={secondaryButtonClass}
                    disabled={isBulkSaving}
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBulkRoles}
                    className={primaryButtonClass}
                    disabled={isBulkSaving || bulkRoleDraft.length === 0}
                  >
                    {isBulkSaving ? 'Đang lưu...' : 'Áp dụng'}
                  </button>
                </div>
              </div>
            </div>
          )
        : null}

      {isBulkPermissionModalOpen
        ? renderModalInPortal(
            <div
              className={modalOverlayClass}
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  closeBulkPermissionEditor();
                }
              }}
            >
              <div className={`${modalPanelClass} max-w-4xl`}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-secondary/15">
                  <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>
                    vpn_key
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-deep-teal leading-tight">Gán quyền hàng loạt</h3>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Áp dụng cho {selectedRecords.length} người dùng đã chọn.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => closeBulkPermissionEditor()}
                className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
                  close
                </span>
              </button>
            </div>

            <div className="max-h-[78vh] space-y-3 overflow-y-auto bg-slate-50/30 p-4">
              <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <p className="mb-2 text-xs font-bold text-slate-700">Chế độ áp dụng</p>
                <div className="space-y-2 text-sm text-slate-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="bulk-permission-mode"
                      checked={bulkPermissionMode === 'MERGE'}
                      onChange={() => setBulkPermissionMode('MERGE')}
                    />
                    Bổ sung hoặc ghi đè các quyền đã chọn, giữ override hiện có.
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="bulk-permission-mode"
                      checked={bulkPermissionMode === 'REPLACE'}
                      onChange={() => setBulkPermissionMode('REPLACE')}
                    />
                    Thay toàn bộ override quyền bằng danh sách bên dưới.
                  </label>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded bg-secondary/15">
                    <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>
                      content_copy
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Sao chép quyền từ user khác</p>
                    <p className="text-[10px] text-slate-400">
                      Nạp override của user nguồn vào danh sách bên dưới để áp dụng cho toàn bộ user đã chọn.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 lg:flex-row">
                  <SearchableSelect
                    className="w-full"
                    usePortal
                    value={bulkPermissionCopySourceUserId || 0}
                    options={bulkPermissionCopySourceOptions}
                    placeholder="Chọn người dùng nguồn"
                    onChange={(nextUserId) => setBulkPermissionCopySourceUserId(Number(nextUserId || 0))}
                    triggerClassName={compactSelectTriggerClass}
                  />
                  <button
                    type="button"
                    onClick={handleCopyBulkPermissionsFromSource}
                    className={secondaryButtonClass}
                    disabled={Number(bulkPermissionCopySourceUserId || 0) <= 0}
                  >
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>
                      content_copy
                    </span>
                    Sao chép quyền
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {bulkPermissionDraft.map((row, index) => (
                  <div
                    key={`bulk-permission-row-${index}`}
                    className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[minmax(0,1.4fr)_150px_minmax(0,1fr)_92px]"
                  >
                    <SearchableMultiSelect
                      className="w-full"
                      values={row.permission_ids}
                      options={permissionMultiSelectOptions}
                      ariaLabel={`Chọn nhiều quyền cho dòng ${index + 1}`}
                      placeholder="Chọn quyền"
                      searchPlaceholder="Tìm quyền..."
                      onChange={(nextPermissionIds) => {
                        setBulkPermissionDraft((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, permission_ids: normalizePermissionIds(nextPermissionIds) }
                              : item
                          )
                        );
                      }}
                      triggerClassName={compactMultiSelectTriggerClass}
                    />
                    <SearchableSelect
                      className="w-full"
                      usePortal
                      value={row.type}
                      options={PERMISSION_DECISION_OPTIONS.filter((option) => option.value !== 'INHERIT')}
                      onChange={(nextType) => {
                        setBulkPermissionDraft((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, type: nextType === 'DENY' ? 'DENY' : 'GRANT' } : item
                          )
                        );
                      }}
                      triggerClassName={compactSelectTriggerClass}
                    />
                    <input
                      type="text"
                      value={row.reason}
                      onChange={(event) => {
                        const nextReason = event.target.value;
                        setBulkPermissionDraft((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, reason: nextReason } : item
                          )
                        );
                      }}
                      placeholder="Lý do (tuỳ chọn)"
                      className={compactInputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setBulkPermissionDraft((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                      className={dangerButtonClass}
                      disabled={bulkPermissionDraft.length <= 1}
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setBulkPermissionDraft((prev) => [...prev, createEmptyBulkPermissionRow()])
                }
                className={secondaryButtonClass}
              >
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>
                  add
                </span>
                Thêm quyền
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-4 py-3">
              <button
                type="button"
                onClick={() => closeBulkPermissionEditor()}
                className={secondaryButtonClass}
                disabled={isBulkSaving}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveBulkPermissions}
                className={primaryButtonClass}
                disabled={
                  isBulkSaving ||
                  (
                    normalizeBulkPermissionRows(bulkPermissionDraft).length === 0 &&
                    Number(bulkPermissionCopiedSourceUserId || 0) <= 0
                  )
                }
              >
                {isBulkSaving ? 'Đang lưu...' : 'Áp dụng'}
              </button>
            </div>
              </div>
            </div>
          )
        : null}

      {isBulkScopeModalOpen
        ? renderModalInPortal(
            <div
              className={modalOverlayClass}
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  closeBulkScopeEditor();
                }
              }}
            >
              <div className={`${modalPanelClass} max-w-3xl`}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-secondary/15">
                  <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>
                    tune
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-deep-teal leading-tight">Gán scope hàng loạt</h3>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Áp dụng cho {selectedRecords.length} người dùng đã chọn.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => closeBulkScopeEditor()}
                className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
                  close
                </span>
              </button>
            </div>

            <div className="max-h-[78vh] space-y-3 overflow-y-auto bg-slate-50/30 p-4">
              <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <p className="mb-2 text-xs font-bold text-slate-700">Chế độ áp dụng</p>
                <div className="space-y-2 text-sm text-slate-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="bulk-scope-mode"
                      checked={bulkScopeMode === 'MERGE'}
                      onChange={() => setBulkScopeMode('MERGE')}
                    />
                    Bổ sung hoặc ghi đè scope theo phòng ban, giữ cấu hình hiện có.
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="bulk-scope-mode"
                      checked={bulkScopeMode === 'REPLACE'}
                      onChange={() => setBulkScopeMode('REPLACE')}
                    />
                    Thay toàn bộ scope bằng danh sách dưới đây.
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                {bulkScopeDraft.map((row, index) => (
                  <div
                    key={`bulk-scope-row-${index}`}
                    className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[1fr_200px_92px]"
                  >
                    <SearchableSelect
                      className="w-full"
                      usePortal
                      value={row.dept_id || 0}
                      options={departmentScopeOptions}
                      onChange={(nextDept) => {
                        setBulkScopeDraft((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, dept_id: Number(nextDept || 0) } : item
                          )
                        );
                      }}
                      triggerClassName={compactSelectTriggerClass}
                    />
                    <SearchableSelect
                      className="w-full"
                      usePortal
                      value={row.scope_type}
                      options={SCOPE_OPTIONS}
                      onChange={(nextType) => {
                        setBulkScopeDraft((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, scope_type: nextType as DeptScopeType } : item
                          )
                        );
                      }}
                      triggerClassName={compactSelectTriggerClass}
                    />
                    <button
                      type="button"
                      onClick={() => setBulkScopeDraft((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                      className={dangerButtonClass}
                      disabled={bulkScopeDraft.length <= 1}
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setBulkScopeDraft((prev) => [...prev, { dept_id: 0, scope_type: 'DEPT_ONLY' }])}
                className={secondaryButtonClass}
              >
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>
                  add
                </span>
                Thêm scope
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-4 py-3">
              <button
                type="button"
                onClick={() => closeBulkScopeEditor()}
                className={secondaryButtonClass}
                disabled={isBulkSaving}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveBulkScopes}
                className={primaryButtonClass}
                disabled={isBulkSaving || normalizeBulkScopeRows(bulkScopeDraft).length === 0}
              >
                {isBulkSaving ? 'Đang lưu...' : 'Áp dụng'}
              </button>
            </div>
              </div>
            </div>
          )
        : null}

      {editorMode === 'roles' && selectedRecord
        ? renderModalInPortal(
            <div
              className={modalOverlayClass}
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  requestCloseEditor();
                }
              }}
            >
              <div
                ref={roleEditorPanelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={`access-role-editor-title-${selectedRecord.user.id}`}
                onKeyDown={handleRoleEditorKeyDown}
                className={`${modalPanelClass} max-w-3xl`}
              >
            <div className="flex max-h-[min(90vh,calc(100dvh-32px))] flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-secondary/15">
                    <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>
                      group
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3
                      id={`access-role-editor-title-${selectedRecord.user.id}`}
                      className="text-sm font-bold leading-tight text-deep-teal"
                    >
                      Cập nhật vai trò
                    </h3>
                    <p className="text-[11px] leading-tight text-slate-400">
                      {selectedRecord.user.full_name} ({selectedRecord.user.username})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => requestCloseEditor()}
                  aria-label="Đóng modal cập nhật vai trò"
                  className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
                    close
                  </span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-slate-50/30 p-4">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded bg-secondary/15">
                        <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>
                          person
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700">Thông tin người dùng</p>
                        <p className="text-[10px] text-slate-400">Dữ liệu gốc để đối chiếu khi cấu hình.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral">Mã NV</p>
                        <p className="text-sm font-semibold text-slate-800">
                          {selectedRecord.user.user_code || `U${selectedRecord.user.id}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral">Tài khoản</p>
                        <p className="text-sm font-semibold text-slate-800">{selectedRecord.user.username}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral">Email</p>
                        <p className="text-sm text-slate-700">{selectedRecord.user.email || 'Chưa cập nhật'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral">Phòng ban</p>
                        <p className="text-sm text-slate-700">{selectedRecord.user.department_name || 'Chưa gắn phòng ban'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded bg-secondary/15">
                        <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>
                          insights
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700">Tóm tắt chỉnh sửa</p>
                        <p className="text-[10px] text-slate-400">Kiểm tra nhanh trước khi lưu cấu hình.</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-slate-700">
                      <div className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
                        <span>Chế độ</span>
                        <span className="text-xs font-bold text-deep-teal">Vai trò</span>
                      </div>
                      <div className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
                        <span>Mục đang cấu hình</span>
                        <span className="text-xs font-bold text-deep-teal">{roleDraft.length}</span>
                      </div>
                      <div className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
                        <span>Trạng thái</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            hasUnsavedChanges ? 'bg-warning/15 text-warning' : 'bg-success/10 text-success'
                          }`}
                        >
                          {hasUnsavedChanges ? 'Chưa lưu' : 'Đồng bộ'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
	                  {roles.map((role) => {
	                    const checked = roleDraft.includes(role.id);
	                    return (
	                      <label
	                        key={role.id}
	                        className={`cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition ${
	                          checked ? 'border-primary bg-primary/5' : 'border-slate-200 hover:bg-slate-50'
	                        }`}
	                      >
	                        <div className="grid grid-cols-[20px_minmax(0,1fr)] items-start gap-3">
	                          <div className="flex h-5 items-center pt-0.5">
	                            <input
	                              type="checkbox"
	                              className="h-5 w-5 shrink-0 rounded border-slate-300 text-primary focus:ring-2 focus:ring-primary/30"
	                              aria-label={`Chọn vai trò ${role.role_code}`}
	                              checked={checked}
	                              onChange={(event) => {
	                                if (event.target.checked) {
	                                  setRoleDraft((prev) => Array.from(new Set([...prev, role.id])));
	                                } else {
	                                  setRoleDraft((prev) => prev.filter((id) => id !== role.id));
	                                }
	                              }}
	                            />
	                          </div>
	                          <div className="min-w-0">
	                            <span className="block text-sm font-semibold leading-5 text-slate-800">{role.role_code}</span>
	                            <p className="mt-1 text-[11px] leading-5 text-slate-500">{role.role_name}</p>
	                          </div>
	                        </div>
	                      </label>
	                    );
	                  })}
                </div>
              </div>

              <div className="sticky bottom-0 shrink-0 border-t border-slate-100 bg-white px-4 py-3">
                {closeAfterSaveRequested ? (
                  <p className="mb-2 text-[10px] text-slate-400">
                    Yêu cầu đóng đã ghi nhận, màn hình sẽ tự đóng sau khi lưu xong.
                  </p>
                ) : null}
                <div className="flex items-center justify-end gap-2">
                  <button type="button" onClick={() => requestCloseEditor()} className={secondaryButtonClass}>
                    {isSaving ? 'Đóng sau khi lưu' : 'Hủy'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRoles}
                    className={primaryButtonClass}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
                  </button>
                </div>
              </div>
            </div>
              </div>
            </div>
          )
        : null}

      {editorMode && editorMode !== 'roles' && selectedRecord
        ? renderModalInPortal(
            <div
              className={modalOverlayClass}
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  requestCloseEditor();
                }
              }}
            >
              <div className={`${modalPanelClass} max-w-4xl`}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-secondary/15">
                  <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>
                    {editorMode === 'permissions' ? 'vpn_key' : 'tune'}
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-deep-teal leading-tight">
                    {editorMode === 'permissions' ? 'Cập nhật quyền override' : 'Cập nhật phạm vi dữ liệu'}
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    {selectedRecord.user.full_name} ({selectedRecord.user.username})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => requestCloseEditor()}
                className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
                  close
                </span>
              </button>
            </div>

            <div className="max-h-[78vh] space-y-3 overflow-y-auto bg-slate-50/30 p-4">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.3fr_0.7fr]">
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-secondary/15">
                      <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>
                        person
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">Thông tin người dùng</p>
                      <p className="text-[10px] text-slate-400">Dữ liệu gốc để đối chiếu khi cấu hình.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral">Mã NV</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {selectedRecord.user.user_code || `U${selectedRecord.user.id}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral">Tài khoản</p>
                      <p className="text-sm font-semibold text-slate-800">{selectedRecord.user.username}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral">Email</p>
                      <p className="text-sm text-slate-700">{selectedRecord.user.email || 'Chưa cập nhật'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral">Phòng ban</p>
                      <p className="text-sm text-slate-700">{selectedRecord.user.department_name || 'Chưa gắn phòng ban'}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-secondary/15">
                      <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>
                        insights
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">Tóm tắt chỉnh sửa</p>
                      <p className="text-[10px] text-slate-400">Kiểm tra nhanh trước khi lưu cấu hình.</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-slate-700">
                    <div className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
                      <span>Chế độ</span>
                      <span className="text-xs font-bold text-deep-teal">
                        {editorMode === 'permissions' ? 'Override quyền' : 'Scope dữ liệu'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
                      <span>Mục đang cấu hình</span>
                      <span className="text-xs font-bold text-deep-teal">
                        {editorMode === 'permissions'
                          ? changedPermissionCount
                          : scopeDraft.filter((item) => Number(item.dept_id || 0) > 0).length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
                      <span>Trạng thái</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          hasUnsavedChanges ? 'bg-warning/15 text-warning' : 'bg-success/10 text-success'
                        }`}
                      >
                        {hasUnsavedChanges ? 'Chưa lưu' : 'Đồng bộ'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {editorMode === 'permissions' ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded bg-secondary/15">
                        <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>
                          content_copy
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700">Sao chép quyền từ user khác</p>
                        <p className="text-[10px] text-slate-400">
                          Chỉ sao chép phần override quyền. Bạn vẫn có thể chỉnh thêm trước khi lưu.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 lg:flex-row">
                      <SearchableSelect
                        className="w-full"
                        usePortal
                        value={permissionCopySourceUserId || 0}
                        options={permissionCopySourceOptions}
                        placeholder="Chọn người dùng nguồn"
                        onChange={(nextUserId) => setPermissionCopySourceUserId(Number(nextUserId || 0))}
                        triggerClassName={compactSelectTriggerClass}
                      />
                      <button
                        type="button"
                        onClick={handleCopyPermissionsFromSource}
                        className={secondaryButtonClass}
                        disabled={Number(permissionCopySourceUserId || 0) <= 0}
                      >
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>
                          content_copy
                        </span>
                        Sao chép quyền
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-warning/30 border-l-4 border-l-warning bg-white p-3 shadow-sm">
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-warning" style={{ fontSize: 16 }}>
                        warning
                      </span>
                      <p className="text-[11px] text-slate-600">
                        Lưu cấu hình sẽ áp dụng cho toàn bộ override hiện tại, không chỉ các quyền đang hiển thị theo bộ lọc tìm kiếm.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative w-full lg:max-w-sm">
                      <span
                        className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral"
                        style={{ fontSize: 16 }}
                      >
                        search
                      </span>
                      <input
                        type="text"
                        value={permissionSearch}
                        onChange={(event) => setPermissionSearch(event.target.value)}
                        placeholder="Tìm quyền theo key, tên hoặc nhóm..."
                        className={`w-full pl-9 ${compactInputClass}`}
                      />
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={showChangedOnly}
                        onChange={(event) => setShowChangedOnly(event.target.checked)}
                      />
                      Chỉ hiển thị quyền đã thay đổi ({changedPermissionCount})
                    </label>
                  </div>

                  <div className="space-y-3">
                    {groupedPermissions.length === 0 ? (
                      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
                        <p className="text-sm font-semibold text-slate-700">Không tìm thấy quyền phù hợp.</p>
                        <p className="mt-1 text-[11px] text-slate-400">Thử từ khóa khác hoặc bỏ bộ lọc thay đổi.</p>
                      </div>
                    ) : (
                      groupedPermissions.map((group) => (
                        <div key={group.key} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                            <p className="text-xs font-bold text-slate-700">{group.label}</p>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                              {group.total} quyền
                            </span>
                          </div>

                          <div className="space-y-3 p-3">
                            {group.modules.map((module) => (
                              <div key={`${group.key}-${module.key}`} className="overflow-hidden rounded-lg border border-slate-100">
                                <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-2">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-deep-teal">
                                    {module.label}
                                  </p>
                                </div>

                                <div className="divide-y divide-slate-100">
                                  {module.permissions.map((permission) => {
                                    const draft = permissionDraft[permission.id] || { type: 'INHERIT', reason: '' };
                                    return (
                                      <div key={permission.id} className="p-3">
                                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                          <div className="md:flex-1">
                                            <p className="text-sm font-semibold text-slate-800">{permission.perm_name}</p>
                                            <p className="text-[11px] text-slate-500">
                                              {permission.perm_key} • {resolvePermissionActionLabel(permission.perm_key)}
                                            </p>
                                          </div>
                                          <SearchableSelect
                                            compact
                                            className="w-full md:w-[150px]"
                                            usePortal
                                            value={draft.type}
                                            options={PERMISSION_DECISION_OPTIONS}
                                            onChange={(nextType) => {
                                              setPermissionDraft((prev) => ({
                                                ...prev,
                                                [permission.id]: { ...draft, type: nextType as PermissionDecision },
                                              }));
                                            }}
                                            triggerClassName={compactSelectTriggerClass}
                                          />
                                        </div>
                                        {draft.type !== 'INHERIT' ? (
                                          <input
                                            type="text"
                                            value={draft.reason}
                                            onChange={(event) => {
                                              setPermissionDraft((prev) => ({
                                                ...prev,
                                                [permission.id]: { ...draft, reason: event.target.value },
                                              }));
                                            }}
                                            placeholder="Lý do override (khuyến nghị nhập)"
                                            className={`mt-2 w-full ${compactInputClass}`}
                                          />
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}

              {editorMode === 'scopes' ? (
                <div className="space-y-3">
                  {scopeDraft.map((scope, index) => (
                    <div
                      key={`scope-row-${index}`}
                      className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[1fr_200px_92px]"
                    >
                      <SearchableSelect
                        className="w-full"
                        usePortal
                        value={scope.dept_id || 0}
                        options={[
                          { value: 0, label: 'Chọn phòng ban' },
                          ...departments.map((department) => ({
                            value: department.id,
                            label: `${department.dept_code} - ${department.dept_name}`,
                          })),
                        ]}
                        onChange={(nextDept) => {
                          setScopeDraft((prev) =>
                            prev.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, dept_id: Number(nextDept || 0) } : row
                            )
                          );
                        }}
                        triggerClassName={compactSelectTriggerClass}
                      />
                      <SearchableSelect
                        className="w-full"
                        usePortal
                        value={scope.scope_type}
                        options={SCOPE_OPTIONS}
                        onChange={(nextType) => {
                          setScopeDraft((prev) =>
                            prev.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, scope_type: nextType as DeptScopeType } : row
                            )
                          );
                        }}
                        triggerClassName={compactSelectTriggerClass}
                      />
                      <button
                        type="button"
                        onClick={() => setScopeDraft((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                        className={dangerButtonClass}
                        disabled={scopeDraft.length <= 1}
                      >
                        Xóa
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setScopeDraft((prev) => [...prev, { dept_id: 0, scope_type: 'DEPT_ONLY' }])}
                    className={secondaryButtonClass}
                  >
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>
                      add
                    </span>
                    Thêm scope
                  </button>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-4 py-3">
              <button type="button" onClick={() => requestCloseEditor()} className={secondaryButtonClass}>
                {isSaving ? 'Đóng sau khi lưu' : 'Hủy'}
              </button>
              <button
                type="button"
                onClick={editorMode === 'permissions' ? handleSavePermissions : handleSaveScopes}
                className={primaryButtonClass}
                disabled={isSaving}
              >
                {isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </div>
            {closeAfterSaveRequested ? (
              <div className="bg-white px-4 pb-3 text-[10px] text-slate-400">
                Yêu cầu đóng đã ghi nhận, màn hình sẽ tự đóng sau khi lưu xong.
              </div>
            ) : null}
              </div>
            </div>
          )
        : null}
    </div>
  );
};
