import React, { useMemo, useState } from 'react';
import { KeyRound, RefreshCcw, Search, Shield, SlidersHorizontal, Users2 } from 'lucide-react';
import {
  Department,
  DeptScopeType,
  Permission,
  Role,
  UserAccessRecord,
} from '../types';
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

const PERMISSION_GROUP_CONFIGS: PermissionGroupConfig[] = [
  { key: 'user', label: 'Người dùng', resources: ['employees', 'departments', 'user_dept_history'], order: 1 },
  { key: 'customer', label: 'Khách hàng', resources: ['customers', 'customer_personnel', 'opportunities'], order: 2 },
  { key: 'contract', label: 'Hợp đồng', resources: ['contracts'], order: 3 },
  { key: 'project', label: 'Dự án', resources: ['projects'], order: 4 },
  { key: 'master_data', label: 'Danh mục', resources: ['businesses', 'vendors', 'products'], order: 5 },
  { key: 'support', label: 'Hỗ trợ', resources: ['support_requests', 'support_service_groups'], order: 6 },
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
  support_requests: 'Yêu cầu hỗ trợ',
  support_service_groups: 'Nhóm Zalo/Telegram yêu cầu',
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

export const AccessControlList: React.FC<AccessControlListProps> = ({
  records,
  roles,
  permissions,
  departments,
  onRefresh,
  onUpdateRoles,
  onUpdatePermissions,
  onUpdateScopes,
}) => {
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [selectedRecord, setSelectedRecord] = useState<UserAccessRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [permissionSearch, setPermissionSearch] = useState('');

  const [roleDraft, setRoleDraft] = useState<number[]>([]);
  const [scopeDraft, setScopeDraft] = useState<Array<{ dept_id: number; scope_type: DeptScopeType }>>([]);
  const [permissionDraft, setPermissionDraft] = useState<Record<number, PermissionDraftValue>>({});

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

  const groupedPermissions = useMemo((): PermissionGroupView[] => {
    const grouped = new Map<string, { meta: PermissionGroupConfig | { key: string; label: string; order: number }; modules: Map<string, Permission[]> }>();

    const fallbackMeta = { key: 'other', label: 'Nhóm khác', order: 999 };

    filteredPermissions.forEach((permission) => {
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
  }, [filteredPermissions]);

  const openRoleEditor = (record: UserAccessRecord) => {
    setSelectedRecord(record);
    setRoleDraft(record.roles.map((role) => role.role_id));
    setEditorMode('roles');
  };

  const openPermissionEditor = (record: UserAccessRecord) => {
    setSelectedRecord(record);
    const nextDraft: Record<number, PermissionDraftValue> = {};
    permissions.forEach((permission) => {
      nextDraft[permission.id] = { type: 'INHERIT', reason: '' };
    });
    record.permissions.forEach((item) => {
      nextDraft[item.permission_id] = {
        type: item.type === 'DENY' ? 'DENY' : 'GRANT',
        reason: item.reason || '',
      };
    });
    setPermissionDraft(nextDraft);
    setPermissionSearch('');
    setEditorMode('permissions');
  };

  const openScopeEditor = (record: UserAccessRecord) => {
    setSelectedRecord(record);
    const scopes = record.dept_scopes.map((scope) => ({
      dept_id: Number(scope.dept_id || 0),
      scope_type: scope.scope_type,
    }));
    setScopeDraft(scopes.length > 0 ? scopes : [{ dept_id: Number(record.user.department_id || 0), scope_type: 'DEPT_ONLY' }]);
    setEditorMode('scopes');
  };

  const closeEditor = () => {
    if (isSaving) {
      return;
    }
    setEditorMode(null);
    setSelectedRecord(null);
    setRoleDraft([]);
    setScopeDraft([]);
    setPermissionDraft({});
    setPermissionSearch('');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveRoles = async () => {
    if (!selectedRecord || roleDraft.length === 0) {
      return;
    }
    setIsSaving(true);
    try {
      await onUpdateRoles(selectedRecord.user.id, roleDraft);
      closeEditor();
    } finally {
      setIsSaving(false);
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
        type: value.type === 'DENY' ? 'DENY' : 'GRANT',
        reason: value.reason || null,
      }));

    setIsSaving(true);
    try {
      await onUpdatePermissions(selectedRecord.user.id, overrides);
      closeEditor();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveScopes = async () => {
    if (!selectedRecord) {
      return;
    }

    const cleanScopes = scopeDraft
      .map((scope) => ({
        dept_id: Number(scope.dept_id || 0),
        scope_type: scope.scope_type,
      }))
      .filter((scope) => scope.dept_id > 0);

    if (cleanScopes.length === 0) {
      return;
    }

    setIsSaving(true);
    try {
      await onUpdateScopes(selectedRecord.user.id, cleanScopes);
      closeEditor();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8">
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 md:w-8 md:h-8 text-primary" />
            Phân quyền người dùng
          </h2>
          <p className="text-slate-500 text-sm mt-1">Quản trị vai trò, quyền và phạm vi dữ liệu theo phòng ban.</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-lg font-bold text-sm shadow-sm"
          disabled={isRefreshing}
        >
          <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo mã NV, username, họ tên, email..."
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-xs font-bold uppercase tracking-wider text-deep-teal">
                <th className="px-5 py-4">Mã NV</th>
                <th className="px-5 py-4">Tài khoản</th>
                <th className="px-5 py-4">Vai trò</th>
                <th className="px-5 py-4">Phạm vi dữ liệu</th>
                <th className="px-5 py-4">Override quyền</th>
                <th className="px-5 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.user.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-700">{record.user.user_code || `U${record.user.id}`}</p>
                    <p className="text-xs text-slate-400">ID: {record.user.id}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-800">{record.user.full_name || '-'}</p>
                    <p className="text-sm text-slate-500">{record.user.username}</p>
                    <p className="text-xs text-slate-400">{record.user.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      {record.roles.length > 0 ? (
                        record.roles.map((role) => (
                          <span key={`${record.user.id}-${role.role_id}`} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                            {role.role_code}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-400">Chưa gán</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {record.dept_scopes.length > 0 ? (
                      <div className="space-y-1">
                        {record.dept_scopes.slice(0, 2).map((scope) => (
                          <p key={`${record.user.id}-${scope.id || `${scope.dept_id}-${scope.scope_type}`}`} className="text-sm text-slate-600">
                            {(scope.dept_code ? `${scope.dept_code} - ` : '') + (scope.dept_name || `Phòng ban ${scope.dept_id}`)} ({scope.scope_type})
                          </p>
                        ))}
                        {record.dept_scopes.length > 2 ? (
                          <p className="text-xs text-slate-400">+{record.dept_scopes.length - 2} scope khác</p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">Chưa cấu hình</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                      {record.permissions.length} mục
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openRoleEditor(record)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                      >
                        <Users2 className="w-3.5 h-3.5" /> Vai trò
                      </button>
                      <button
                        type="button"
                        onClick={() => openPermissionEditor(record)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                      >
                        <KeyRound className="w-3.5 h-3.5" /> Quyền
                      </button>
                      <button
                        type="button"
                        onClick={() => openScopeEditor(record)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" /> Scope
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editorMode && selectedRecord ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm p-4 md:p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {editorMode === 'roles' ? 'Cập nhật vai trò' : editorMode === 'permissions' ? 'Cập nhật quyền override' : 'Cập nhật phạm vi dữ liệu'}
                </h3>
                <p className="text-sm text-slate-500">{selectedRecord.user.full_name} ({selectedRecord.user.username})</p>
              </div>
              <button type="button" onClick={closeEditor} className="p-2 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-auto">
              {editorMode === 'roles' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {roles.map((role) => {
                    const checked = roleDraft.includes(role.id);
                    return (
                      <label key={role.id} className={`rounded-xl border p-3 cursor-pointer transition ${checked ? 'border-primary bg-primary/5' : 'border-slate-200 hover:bg-slate-50'}`}>
                        <input
                          type="checkbox"
                          className="mr-2"
                          checked={checked}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setRoleDraft((prev) => Array.from(new Set([...prev, role.id])));
                            } else {
                              setRoleDraft((prev) => prev.filter((id) => id !== role.id));
                            }
                          }}
                        />
                        <span className="font-semibold text-slate-800">{role.role_code}</span>
                        <p className="text-sm text-slate-500 mt-1">{role.role_name}</p>
                      </label>
                    );
                  })}
                </div>
              ) : null}

              {editorMode === 'permissions' ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={permissionSearch}
                      onChange={(event) => setPermissionSearch(event.target.value)}
                      placeholder="Tìm quyền theo key, tên hoặc nhóm..."
                      className="w-full h-10 rounded-lg border border-slate-200 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-3">
                    {groupedPermissions.length === 0 ? (
                      <div className="border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
                        Không tìm thấy quyền phù hợp.
                      </div>
                    ) : (
                      groupedPermissions.map((group) => (
                        <div key={group.key} className="border border-slate-200 rounded-xl overflow-hidden">
                          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <p className="font-bold text-slate-800">{group.label}</p>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-600">
                              {group.total} quyền
                            </span>
                          </div>

                          <div className="p-3 space-y-3">
                            {group.modules.map((module) => (
                              <div key={`${group.key}-${module.key}`} className="border border-slate-100 rounded-lg overflow-hidden">
                                <div className="px-3 py-2 bg-slate-50/80 border-b border-slate-100">
                                  <p className="text-xs font-bold uppercase tracking-wider text-deep-teal">{module.label}</p>
                                </div>

                                <div className="divide-y divide-slate-100">
                                  {module.permissions.map((permission) => {
                                    const draft = permissionDraft[permission.id] || { type: 'INHERIT', reason: '' };
                                    return (
                                      <div key={permission.id} className="p-3">
                                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                                          <div className="md:flex-1">
                                            <p className="font-semibold text-slate-800">{permission.perm_name}</p>
                                            <p className="text-xs text-slate-500">
                                              {permission.perm_key} • {resolvePermissionActionLabel(permission.perm_key)}
                                            </p>
                                          </div>
                                          <SearchableSelect
                                            compact
                                            className="w-full md:w-[170px]"
                                            value={draft.type}
                                            options={PERMISSION_DECISION_OPTIONS}
                                            onChange={(nextType) => {
                                              setPermissionDraft((prev) => ({
                                                ...prev,
                                                [permission.id]: { ...draft, type: nextType as PermissionDecision },
                                              }));
                                            }}
                                            triggerClassName="h-9 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
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
                                            className="mt-2 w-full h-9 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
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
                    <div key={`scope-row-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_220px_90px] gap-2">
                      <SearchableSelect
                        className="w-full"
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
                            prev.map((row, rowIndex) => rowIndex === index ? { ...row, dept_id: Number(nextDept || 0) } : row)
                          );
                        }}
                        triggerClassName="h-10 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                      <SearchableSelect
                        className="w-full"
                        value={scope.scope_type}
                        options={SCOPE_OPTIONS}
                        onChange={(nextType) => {
                          setScopeDraft((prev) =>
                            prev.map((row, rowIndex) => rowIndex === index ? { ...row, scope_type: nextType as DeptScopeType } : row)
                          );
                        }}
                        triggerClassName="h-10 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setScopeDraft((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                        className="h-10 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold"
                        disabled={scopeDraft.length <= 1}
                      >
                        Xóa
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setScopeDraft((prev) => [...prev, { dept_id: 0, scope_type: 'DEPT_ONLY' }])}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-deep-teal"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    Thêm scope
                  </button>
                </div>
              ) : null}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeEditor}
                className="h-10 px-5 rounded-lg border border-slate-300 text-slate-600 hover:bg-white font-semibold"
                disabled={isSaving}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={editorMode === 'roles' ? handleSaveRoles : editorMode === 'permissions' ? handleSavePermissions : handleSaveScopes}
                className="h-10 px-5 rounded-lg bg-primary hover:bg-deep-teal text-white font-semibold disabled:opacity-60"
                disabled={isSaving}
              >
                {isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
