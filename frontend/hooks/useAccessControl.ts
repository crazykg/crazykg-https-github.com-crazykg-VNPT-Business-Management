import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchPermissions,
  fetchRoles,
  fetchUserAccess,
  updateUserAccessDeptScopes,
  updateUserAccessPermissions,
  updateUserAccessRoles,
} from '../services/api/adminApi';
import { queryKeys } from '../shared/queryKeys';
import type { Permission, Role, UserAccessRecord } from '../types/admin';

type ToastFn = (type: 'success' | 'error', title: string, message: string) => void;

interface UseAccessControlOptions {
  enabled?: boolean;
}

interface UseAccessControlReturn {
  roles: Role[];
  permissions: Permission[];
  userAccessRecords: UserAccessRecord[];
  isLoading: boolean;
  error: string | null;
  refreshAccessControlData: () => Promise<void>;
  handleUpdateAccessRoles: (userId: number, roleIds: number[]) => Promise<void>;
  handleBulkUpdateAccessRoles: (
    updates: Array<{ userId: number; roleIds: number[] }>
  ) => Promise<void>;
  handleBulkUpdateAccessPermissions: (
    updates: Array<{
      userId: number;
      overrides: Array<{
        permission_id: number;
        type: 'GRANT' | 'DENY';
        reason?: string | null;
      }>;
    }>
  ) => Promise<void>;
  handleBulkUpdateAccessScopes: (
    updates: Array<{
      userId: number;
      scopes: Array<{
        dept_id: number;
        scope_type: 'SELF_ONLY' | 'DEPT_ONLY' | 'DEPT_AND_CHILDREN' | 'ALL';
      }>;
    }>
  ) => Promise<void>;
  handleUpdateAccessPermissions: (
    userId: number,
    overrides: Array<{
      permission_id: number;
      type: 'GRANT' | 'DENY';
      reason?: string | null;
      expires_at?: string | null;
    }>
  ) => Promise<void>;
  handleUpdateAccessScopes: (
    userId: number,
    scopes: Array<{
      dept_id: number;
      scope_type: 'SELF_ONLY' | 'DEPT_ONLY' | 'DEPT_AND_CHILDREN' | 'ALL';
    }>
  ) => Promise<void>;
}

const extractErrorMessage = (error: unknown, fallback = 'Lỗi không xác định'): string =>
  error instanceof Error ? error.message : fallback;

const normalizeUserId = (value: unknown): number => {
  const normalized = Number(value || 0);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
};

export function useAccessControl(
  addToast?: ToastFn,
  options: UseAccessControlOptions = {},
): UseAccessControlReturn {
  const enabled = options.enabled ?? true;
  const queryClient = useQueryClient();

  const rolesQuery = useQuery({
    queryKey: queryKeys.admin.roles(),
    queryFn: fetchRoles,
    enabled,
  });

  const permissionsQuery = useQuery({
    queryKey: queryKeys.admin.permissions(),
    queryFn: fetchPermissions,
    enabled,
  });

  const userAccessQuery = useQuery({
    queryKey: queryKeys.admin.userAccess(),
    queryFn: () => fetchUserAccess(),
    enabled,
  });

  const updateRolesMutation = useMutation({
    mutationFn: ({ userId, roleIds }: { userId: number; roleIds: number[] }) =>
      updateUserAccessRoles(userId, roleIds),
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: ({
      userId,
      overrides,
    }: {
      userId: number;
      overrides: Array<{
        permission_id: number;
        type: 'GRANT' | 'DENY';
        reason?: string | null;
        expires_at?: string | null;
      }>;
    }) => updateUserAccessPermissions(userId, overrides),
  });

  const updateScopesMutation = useMutation({
    mutationFn: ({
      userId,
      scopes,
    }: {
      userId: number;
      scopes: Array<{
        dept_id: number;
        scope_type: 'SELF_ONLY' | 'DEPT_ONLY' | 'DEPT_AND_CHILDREN' | 'ALL';
      }>;
    }) => updateUserAccessDeptScopes(userId, scopes),
  });

  const replaceUserAccessRecord = useCallback((updatedRecord: UserAccessRecord) => {
    queryClient.setQueryData(
      queryKeys.admin.userAccess(),
      (previous: UserAccessRecord[] | undefined) => {
        const current = previous ?? [];
        let found = false;
        const next = current.map((item) => {
          if (Number(item.user.id) === Number(updatedRecord.user.id)) {
            found = true;
            return updatedRecord;
          }
          return item;
        });

        return found ? next : [updatedRecord, ...current];
      },
    );
  }, [queryClient]);

  const mergeUpdatedRecords = useCallback((updatedMap: Map<number, UserAccessRecord>) => {
    queryClient.setQueryData(
      queryKeys.admin.userAccess(),
      (previous: UserAccessRecord[] | undefined) =>
        (previous ?? []).map((record) => updatedMap.get(Number(record.user.id)) ?? record),
    );
  }, [queryClient]);

  const refreshAccessControlData = useCallback(async () => {
    await Promise.all([
      rolesQuery.refetch(),
      permissionsQuery.refetch(),
      userAccessQuery.refetch(),
    ]);
  }, [permissionsQuery, rolesQuery, userAccessQuery]);

  const handleUpdateAccessRoles = useCallback(async (userId: number, roleIds: number[]) => {
    try {
      const updated = await updateRolesMutation.mutateAsync({ userId, roleIds });
      replaceUserAccessRecord(updated);
      addToast?.('success', 'Thành công', 'Đã cập nhật vai trò người dùng.');
    } catch (error) {
      addToast?.('error', 'Cập nhật vai trò thất bại', extractErrorMessage(error));
      throw error;
    }
  }, [addToast, replaceUserAccessRecord, updateRolesMutation]);

  const handleUpdateAccessPermissions = useCallback(async (
    userId: number,
    overrides: Array<{
      permission_id: number;
      type: 'GRANT' | 'DENY';
      reason?: string | null;
      expires_at?: string | null;
    }>,
  ) => {
    try {
      const updated = await updatePermissionsMutation.mutateAsync({ userId, overrides });
      replaceUserAccessRecord(updated);
      addToast?.('success', 'Thành công', 'Đã cập nhật quyền override.');
    } catch (error) {
      addToast?.('error', 'Cập nhật quyền thất bại', extractErrorMessage(error));
      throw error;
    }
  }, [addToast, replaceUserAccessRecord, updatePermissionsMutation]);

  const handleUpdateAccessScopes = useCallback(async (
    userId: number,
    scopes: Array<{
      dept_id: number;
      scope_type: 'SELF_ONLY' | 'DEPT_ONLY' | 'DEPT_AND_CHILDREN' | 'ALL';
    }>,
  ) => {
    try {
      const updated = await updateScopesMutation.mutateAsync({ userId, scopes });
      replaceUserAccessRecord(updated);
      addToast?.('success', 'Thành công', 'Đã cập nhật phạm vi dữ liệu.');
    } catch (error) {
      addToast?.('error', 'Cập nhật phạm vi thất bại', extractErrorMessage(error));
      throw error;
    }
  }, [addToast, replaceUserAccessRecord, updateScopesMutation]);

  const handleBulkUpdateAccessRoles = useCallback(async (
    updates: Array<{ userId: number; roleIds: number[] }>,
  ) => {
    const normalizedUpdates = updates
      .map((item) => ({
        userId: normalizeUserId(item.userId),
        roleIds: Array.from(
          new Set(
            (item.roleIds || [])
              .map((roleId) => Number(roleId || 0))
              .filter((roleId) => Number.isFinite(roleId) && roleId > 0),
          ),
        ),
      }))
      .filter((item) => item.userId > 0 && item.roleIds.length > 0);

    if (normalizedUpdates.length === 0) {
      return;
    }

    const settled = await Promise.allSettled(
      normalizedUpdates.map(async (item) => ({
        userId: item.userId,
        updated: await updateUserAccessRoles(item.userId, item.roleIds),
      })),
    );

    const updatedMap = new Map<number, UserAccessRecord>();
    const failedMessages: string[] = [];
    settled.forEach((result) => {
      if (result.status === 'fulfilled') {
        updatedMap.set(result.value.userId, result.value.updated);
        return;
      }
      failedMessages.push(extractErrorMessage(result.reason));
    });

    if (updatedMap.size > 0) {
      mergeUpdatedRecords(updatedMap);
      addToast?.(
        'success',
        'Cập nhật vai trò hàng loạt thành công',
        failedMessages.length > 0
          ? `Đã cập nhật ${updatedMap.size}/${normalizedUpdates.length} người dùng.`
          : `Đã cập nhật ${updatedMap.size} người dùng.`,
      );
    }

    if (failedMessages.length > 0) {
      addToast?.('error', 'Một phần cập nhật thất bại', `${failedMessages.length} người dùng chưa cập nhật được.`);
    }

    if (updatedMap.size === 0) {
      throw new Error(failedMessages[0] || 'Cập nhật vai trò hàng loạt thất bại.');
    }
  }, [addToast, mergeUpdatedRecords]);

  const handleBulkUpdateAccessPermissions = useCallback(async (
    updates: Array<{
      userId: number;
      overrides: Array<{
        permission_id: number;
        type: 'GRANT' | 'DENY';
        reason?: string | null;
      }>;
    }>,
  ) => {
    const normalizedUpdates = updates
      .map((item) => ({
        userId: normalizeUserId(item.userId),
        overrides: Array.from(
          new Map(
            (item.overrides || [])
              .map((override) => ({
                permission_id: Number(override.permission_id || 0),
                type: (override.type === 'DENY' ? 'DENY' : 'GRANT') as 'GRANT' | 'DENY',
                reason: override.reason || null,
              }))
              .filter((override) => Number.isFinite(override.permission_id) && override.permission_id > 0)
              .map((override) => [override.permission_id, override]),
          ).values(),
        ),
      }))
      .filter((item) => item.userId > 0 && item.overrides.length > 0);

    if (normalizedUpdates.length === 0) {
      return;
    }

    const settled = await Promise.allSettled(
      normalizedUpdates.map(async (item) => ({
        userId: item.userId,
        updated: await updateUserAccessPermissions(item.userId, item.overrides),
      })),
    );

    const updatedMap = new Map<number, UserAccessRecord>();
    const failedMessages: string[] = [];
    settled.forEach((result) => {
      if (result.status === 'fulfilled') {
        updatedMap.set(result.value.userId, result.value.updated);
        return;
      }
      failedMessages.push(extractErrorMessage(result.reason));
    });

    if (updatedMap.size > 0) {
      mergeUpdatedRecords(updatedMap);
      addToast?.(
        'success',
        'Cập nhật quyền hàng loạt thành công',
        failedMessages.length > 0
          ? `Đã cập nhật ${updatedMap.size}/${normalizedUpdates.length} người dùng.`
          : `Đã cập nhật ${updatedMap.size} người dùng.`,
      );
    }

    if (failedMessages.length > 0) {
      addToast?.('error', 'Một phần cập nhật quyền thất bại', `${failedMessages.length} người dùng chưa cập nhật được.`);
    }

    if (updatedMap.size === 0) {
      throw new Error(failedMessages[0] || 'Cập nhật quyền hàng loạt thất bại.');
    }
  }, [addToast, mergeUpdatedRecords]);

  const handleBulkUpdateAccessScopes = useCallback(async (
    updates: Array<{
      userId: number;
      scopes: Array<{
        dept_id: number;
        scope_type: 'SELF_ONLY' | 'DEPT_ONLY' | 'DEPT_AND_CHILDREN' | 'ALL';
      }>;
    }>,
  ) => {
    const normalizedUpdates = updates
      .map((item) => ({
        userId: normalizeUserId(item.userId),
        scopes: Array.from(
          new Map(
            (item.scopes || [])
              .map((scope) => ({
                dept_id: Number(scope.dept_id || 0),
                scope_type: scope.scope_type,
              }))
              .filter((scope) => Number.isFinite(scope.dept_id) && scope.dept_id > 0)
              .map((scope) => [scope.dept_id, scope]),
          ).values(),
        ),
      }))
      .filter((item) => item.userId > 0 && item.scopes.length > 0);

    if (normalizedUpdates.length === 0) {
      return;
    }

    const settled = await Promise.allSettled(
      normalizedUpdates.map(async (item) => ({
        userId: item.userId,
        updated: await updateUserAccessDeptScopes(item.userId, item.scopes),
      })),
    );

    const updatedMap = new Map<number, UserAccessRecord>();
    const failedMessages: string[] = [];
    settled.forEach((result) => {
      if (result.status === 'fulfilled') {
        updatedMap.set(result.value.userId, result.value.updated);
        return;
      }
      failedMessages.push(extractErrorMessage(result.reason));
    });

    if (updatedMap.size > 0) {
      mergeUpdatedRecords(updatedMap);
      addToast?.(
        'success',
        'Cập nhật scope hàng loạt thành công',
        failedMessages.length > 0
          ? `Đã cập nhật ${updatedMap.size}/${normalizedUpdates.length} người dùng.`
          : `Đã cập nhật ${updatedMap.size} người dùng.`,
      );
    }

    if (failedMessages.length > 0) {
      addToast?.('error', 'Một phần cập nhật scope thất bại', `${failedMessages.length} người dùng chưa cập nhật được.`);
    }

    if (updatedMap.size === 0) {
      throw new Error(failedMessages[0] || 'Cập nhật scope hàng loạt thất bại.');
    }
  }, [addToast, mergeUpdatedRecords]);

  const error =
    extractErrorMessage(rolesQuery.error, '') ||
    extractErrorMessage(permissionsQuery.error, '') ||
    extractErrorMessage(userAccessQuery.error, '') ||
    null;

  return {
    roles: rolesQuery.data ?? [],
    permissions: permissionsQuery.data ?? [],
    userAccessRecords: userAccessQuery.data ?? [],
    isLoading:
      rolesQuery.isLoading ||
      permissionsQuery.isLoading ||
      userAccessQuery.isLoading ||
      rolesQuery.isFetching ||
      permissionsQuery.isFetching ||
      userAccessQuery.isFetching,
    error,
    refreshAccessControlData,
    handleUpdateAccessRoles,
    handleBulkUpdateAccessRoles,
    handleBulkUpdateAccessPermissions,
    handleBulkUpdateAccessScopes,
    handleUpdateAccessPermissions,
    handleUpdateAccessScopes,
  };
}
