import { useState, useCallback } from 'react';
import {
  fetchRoles,
  fetchPermissions,
  fetchUserAccess,
  updateUserAccessRoles,
  updateUserAccessPermissions,
  updateUserAccessDeptScopes,
} from '../services/v5Api';
import type { Role, Permission, UserAccessRecord } from '../types';

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

export function useAccessControl(addToast?: (type: 'success' | 'error', title: string, message: string) => void): UseAccessControlReturn {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userAccessRecords, setUserAccessRecords] = useState<UserAccessRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshAccessControlData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextRoles, nextPermissions, nextUserAccess] = await Promise.all([
        fetchRoles(),
        fetchPermissions(),
        fetchUserAccess(),
      ]);
      setRoles(nextRoles || []);
      setPermissions(nextPermissions || []);
      setUserAccessRecords(nextUserAccess || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Tải dữ liệu phân quyền thất bại', message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const replaceUserAccessRecord = useCallback((updatedRecord: UserAccessRecord) => {
    setUserAccessRecords((prev) => {
      const next = (prev || []).map((item) =>
        Number(item.user.id) === Number(updatedRecord.user.id)
          ? updatedRecord
          : item
      );
      return next;
    });
  }, []);

  const handleUpdateAccessRoles = useCallback(async (userId: number, roleIds: number[]) => {
    try {
      const updated = await updateUserAccessRoles(userId, roleIds);
      replaceUserAccessRecord(updated);
      addToast?.('success', 'Thành công', 'Đã cập nhật vai trò người dùng.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      addToast?.('error', 'Cập nhật vai trò thất bại', message);
      throw err;
    }
  }, [addToast, replaceUserAccessRecord]);

  const handleBulkUpdateAccessRoles = useCallback(async (
    updates: Array<{
      userId: number;
      roleIds: number[];
    }>
  ) => {
    const normalizedUpdates = updates
      .map((item) => ({
        userId: Number(item.userId || 0),
        roleIds: Array.from(
          new Set(
            (item.roleIds || [])
              .map((roleId) => Number(roleId || 0))
              .filter((roleId) => Number.isFinite(roleId) && roleId > 0)
          )
        ),
      }))
      .filter((item) => item.userId > 0 && item.roleIds.length > 0);

    if (normalizedUpdates.length === 0) {
      return;
    }

    const settled = await Promise.allSettled(
      normalizedUpdates.map(async (item) => {
        const updated = await updateUserAccessRoles(item.userId, item.roleIds);
        return {
          userId: item.userId,
          updated,
        };
      })
    );

    const updatedMap = new Map<number, UserAccessRecord>();
    const failedMessages: string[] = [];
    settled.forEach((result) => {
      if (result.status === 'fulfilled') {
        updatedMap.set(result.value.userId, result.value.updated);
        return;
      }
      const message = result.reason instanceof Error ? result.reason.message : 'Lỗi không xác định';
      failedMessages.push(message);
    });

    if (updatedMap.size > 0) {
      setUserAccessRecords((prev) =>
        (prev || []).map((record) => updatedMap.get(Number(record.user.id)) ?? record)
      );
    }

    if (updatedMap.size > 0) {
      addToast?.(
        'success',
        'Cập nhật vai trò hàng loạt thành công',
        failedMessages.length > 0
          ? `Đã cập nhật ${updatedMap.size}/${normalizedUpdates.length} người dùng.`
          : `Đã cập nhật ${updatedMap.size} người dùng.`
      );
    }

    if (failedMessages.length > 0) {
      const failedCount = failedMessages.length;
      addToast?.('error', 'Một phần cập nhật thất bại', `${failedCount} người dùng chưa cập nhật được.`);
    }

    if (updatedMap.size === 0) {
      throw new Error(failedMessages[0] || 'Cập nhật vai trò hàng loạt thất bại.');
    }
  }, [addToast]);

  const handleBulkUpdateAccessPermissions = useCallback(async (
    updates: Array<{
      userId: number;
      overrides: Array<{
        permission_id: number;
        type: 'GRANT' | 'DENY';
        reason?: string | null;
      }>;
    }>
  ) => {
    const normalizedUpdates = updates
      .map((item) => ({
        userId: Number(item.userId || 0),
        overrides: Array.from(
          new Map(
            (item.overrides || [])
              .map((override) => ({
                permission_id: Number(override.permission_id || 0),
                type: (override.type === 'DENY' ? 'DENY' : 'GRANT') as 'GRANT' | 'DENY',
                reason: override.reason || null,
              }))
              .filter((override) => Number.isFinite(override.permission_id) && override.permission_id > 0)
              .map((override) => [override.permission_id, override])
          ).values()
        ),
      }))
      .filter((item) => item.userId > 0 && item.overrides.length > 0);

    if (normalizedUpdates.length === 0) {
      return;
    }

    const settled = await Promise.allSettled(
      normalizedUpdates.map(async (item) => {
        const updated = await updateUserAccessPermissions(item.userId, item.overrides);
        return {
          userId: item.userId,
          updated,
        };
      })
    );

    const updatedMap = new Map<number, UserAccessRecord>();
    const failedMessages: string[] = [];
    settled.forEach((result) => {
      if (result.status === 'fulfilled') {
        updatedMap.set(result.value.userId, result.value.updated);
        return;
      }
      const message = result.reason instanceof Error ? result.reason.message : 'Lỗi không xác định';
      failedMessages.push(message);
    });

    if (updatedMap.size > 0) {
      setUserAccessRecords((prev) =>
        (prev || []).map((record) => updatedMap.get(Number(record.user.id)) ?? record)
      );
    }

    if (updatedMap.size > 0) {
      addToast?.(
        'success',
        'Cập nhật quyền hàng loạt thành công',
        failedMessages.length > 0
          ? `Đã cập nhật ${updatedMap.size}/${normalizedUpdates.length} người dùng.`
          : `Đã cập nhật ${updatedMap.size} người dùng.`
      );
    }

    if (failedMessages.length > 0) {
      addToast?.('error', 'Một phần cập nhật quyền thất bại', `${failedMessages.length} người dùng chưa cập nhật được.`);
    }

    if (updatedMap.size === 0) {
      throw new Error(failedMessages[0] || 'Cập nhật quyền hàng loạt thất bại.');
    }
  }, [addToast]);

  const handleBulkUpdateAccessScopes = useCallback(async (
    updates: Array<{
      userId: number;
      scopes: Array<{
        dept_id: number;
        scope_type: 'SELF_ONLY' | 'DEPT_ONLY' | 'DEPT_AND_CHILDREN' | 'ALL';
      }>;
    }>
  ) => {
    const normalizedUpdates = updates
      .map((item) => ({
        userId: Number(item.userId || 0),
        scopes: Array.from(
          new Map(
            (item.scopes || [])
              .map((scope) => ({
                dept_id: Number(scope.dept_id || 0),
                scope_type: scope.scope_type,
              }))
              .filter((scope) => Number.isFinite(scope.dept_id) && scope.dept_id > 0)
              .map((scope) => [scope.dept_id, scope])
          ).values()
        ),
      }))
      .filter((item) => item.userId > 0 && item.scopes.length > 0);

    if (normalizedUpdates.length === 0) {
      return;
    }

    const settled = await Promise.allSettled(
      normalizedUpdates.map(async (item) => {
        const updated = await updateUserAccessDeptScopes(item.userId, item.scopes);
        return {
          userId: item.userId,
          updated,
        };
      })
    );

    const updatedMap = new Map<number, UserAccessRecord>();
    const failedMessages: string[] = [];
    settled.forEach((result) => {
      if (result.status === 'fulfilled') {
        updatedMap.set(result.value.userId, result.value.updated);
        return;
      }
      const message = result.reason instanceof Error ? result.reason.message : 'Lỗi không xác định';
      failedMessages.push(message);
    });

    if (updatedMap.size > 0) {
      setUserAccessRecords((prev) =>
        (prev || []).map((record) => updatedMap.get(Number(record.user.id)) ?? record)
      );
    }

    if (updatedMap.size > 0) {
      addToast?.(
        'success',
        'Cập nhật scope hàng loạt thành công',
        failedMessages.length > 0
          ? `Đã cập nhật ${updatedMap.size}/${normalizedUpdates.length} người dùng.`
          : `Đã cập nhật ${updatedMap.size} người dùng.`
      );
    }

    if (failedMessages.length > 0) {
      addToast?.('error', 'Một phần cập nhật scope thất bại', `${failedMessages.length} người dùng chưa cập nhật được.`);
    }

    if (updatedMap.size === 0) {
      throw new Error(failedMessages[0] || 'Cập nhật scope hàng loạt thất bại.');
    }
  }, [addToast]);

  const handleUpdateAccessPermissions = useCallback(async (
    userId: number,
    overrides: Array<{
      permission_id: number;
      type: 'GRANT' | 'DENY';
      reason?: string | null;
      expires_at?: string | null;
    }>
  ) => {
    try {
      const updated = await updateUserAccessPermissions(userId, overrides);
      replaceUserAccessRecord(updated);
      addToast?.('success', 'Thành công', 'Đã cập nhật quyền override.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      addToast?.('error', 'Cập nhật quyền thất bại', message);
      throw err;
    }
  }, [addToast, replaceUserAccessRecord]);

  const handleUpdateAccessScopes = useCallback(async (
    userId: number,
    scopes: Array<{
      dept_id: number;
      scope_type: 'SELF_ONLY' | 'DEPT_ONLY' | 'DEPT_AND_CHILDREN' | 'ALL';
    }>
  ) => {
    try {
      const updated = await updateUserAccessDeptScopes(userId, scopes);
      replaceUserAccessRecord(updated);
      addToast?.('success', 'Thành công', 'Đã cập nhật phạm vi dữ liệu.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      addToast?.('error', 'Cập nhật phạm vi thất bại', message);
      throw err;
    }
  }, [addToast, replaceUserAccessRecord]);

  return {
    roles,
    permissions,
    userAccessRecords,
    isLoading,
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