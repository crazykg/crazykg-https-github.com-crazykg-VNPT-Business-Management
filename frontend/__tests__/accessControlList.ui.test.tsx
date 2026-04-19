import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AccessControlList } from '../components/AccessControlList';
import type { Department, Permission, Role, UserAccessRecord } from '../types';

const departments: Department[] = [
  {
    id: 1,
    dept_code: 'PGP2',
    dept_name: 'Phong giai phap 2',
    parent_id: null,
    dept_path: '1',
    is_active: true,
  },
];

const roles: Role[] = [
  {
    id: 1,
    role_code: 'ADMIN',
    role_name: 'Quan tri he thong',
  },
];

const permissions: Permission[] = [
  {
    id: 1,
    perm_key: 'authz.read',
    perm_name: 'Xem phan quyen',
    perm_group: 'He thong',
  },
  {
    id: 2,
    perm_key: 'authz.manage',
    perm_name: 'Quan tri phan quyen',
    perm_group: 'He thong',
  },
];

const buildRecord = (
  index: number,
  overrides: UserAccessRecord['permissions'] = index % 3 === 0
    ? [{ permission_id: 1, perm_key: 'authz.read', perm_name: 'Xem phan quyen', perm_group: 'He thong', type: 'GRANT' }]
    : []
): UserAccessRecord => ({
  user: {
    id: index,
    user_code: `VNPT${String(index).padStart(5, '0')}`,
    username: `user${String(index).padStart(2, '0')}`,
    full_name: `Nhan vien ${String(index).padStart(2, '0')}`,
    email: `user${String(index).padStart(2, '0')}@vnpt.vn`,
    department_id: 1,
    department_code: 'PGP2',
    department_name: 'Phong giai phap 2',
  },
  roles: index % 2 === 0 ? [{ role_id: 1, role_code: 'ADMIN', role_name: 'Quan tri he thong' }] : [],
  permissions: overrides,
  dept_scopes: [],
});

describe('AccessControlList pagination', () => {
  it('keeps the access control page flush to the top edge for overlay rendering', () => {
    render(
      <AccessControlList
        records={[buildRecord(1)]}
        roles={roles}
        permissions={permissions}
        departments={departments}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        onUpdateRoles={vi.fn().mockResolvedValue(undefined)}
        onBulkUpdateRoles={vi.fn().mockResolvedValue(undefined)}
        onBulkUpdatePermissions={vi.fn().mockResolvedValue(undefined)}
        onBulkUpdateScopes={vi.fn().mockResolvedValue(undefined)}
        onUpdatePermissions={vi.fn().mockResolvedValue(undefined)}
        onUpdateScopes={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const page = screen.getByTestId('access-control-page');

    expect(page).toHaveClass('px-3', 'pt-0', 'pb-6');
    expect(page).not.toHaveClass('p-3');
  });

  it('uses PaginationControls for local pagination and resets to page 1 when searching', async () => {
    const user = userEvent.setup();
    const records = Array.from({ length: 12 }, (_, index) => buildRecord(index + 1));

    render(
      <AccessControlList
        records={records}
        roles={roles}
        permissions={permissions}
        departments={departments}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        onUpdateRoles={vi.fn().mockResolvedValue(undefined)}
        onBulkUpdateRoles={vi.fn().mockResolvedValue(undefined)}
        onBulkUpdatePermissions={vi.fn().mockResolvedValue(undefined)}
        onBulkUpdateScopes={vi.fn().mockResolvedValue(undefined)}
        onUpdatePermissions={vi.fn().mockResolvedValue(undefined)}
        onUpdateScopes={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText('Nhan vien 01')).toBeInTheDocument();
    expect(screen.queryByText('Nhan vien 11')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '2' }));

    expect(screen.getByText('Nhan vien 11')).toBeInTheDocument();
    expect(screen.queryByText('Nhan vien 01')).not.toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText('Tìm theo mã NV, username, họ tên, email...'));
    await user.type(screen.getByPlaceholderText('Tìm theo mã NV, username, họ tên, email...'), 'Nhan vien 01');

    expect(screen.getByText('Nhan vien 01')).toBeInTheDocument();
    expect(screen.queryByText('Nhan vien 11')).not.toBeInTheDocument();
  });

  it('opens the single role editor with dialog semantics, saves selected roles, and restores trigger focus', async () => {
    const user = userEvent.setup();
    const onUpdateRoles = vi.fn().mockResolvedValue(undefined);
    const roleCatalog: Role[] = [
      ...roles,
      {
        id: 2,
        role_code: 'PM',
        role_name: 'Quan ly du an',
      },
    ];

    render(
      <AccessControlList
        records={[buildRecord(1)]}
        roles={roleCatalog}
        permissions={permissions}
        departments={departments}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        onUpdateRoles={onUpdateRoles}
        onBulkUpdateRoles={vi.fn().mockResolvedValue(undefined)}
        onBulkUpdatePermissions={vi.fn().mockResolvedValue(undefined)}
        onBulkUpdateScopes={vi.fn().mockResolvedValue(undefined)}
        onUpdatePermissions={vi.fn().mockResolvedValue(undefined)}
        onUpdateScopes={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const openRoleButton = screen.getByRole('button', { name: /Vai trò/i });
    await user.click(openRoleButton);

    const dialog = screen.getByRole('dialog', { name: 'Cập nhật vai trò' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.parentElement?.className).toContain('z-[500]');
    expect(dialog.parentElement?.className).toContain('backdrop-blur-sm');
    expect(document.body.contains(dialog)).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(within(dialog).getByText('Nhan vien 01 (user01)')).toBeInTheDocument();
    expect(within(dialog).getByText('VNPT00001')).toBeInTheDocument();

    const pmCheckbox = within(dialog).getByRole('checkbox', { name: 'Chọn vai trò PM' });
    expect(within(dialog).getByRole('checkbox', { name: 'Chọn vai trò ADMIN' })).toHaveFocus();

    await user.click(pmCheckbox);
    await user.click(within(dialog).getByRole('button', { name: 'Lưu cấu hình' }));

    await waitFor(() => {
      expect(onUpdateRoles).toHaveBeenCalledWith(1, [2]);
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Cập nhật vai trò' })).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(document.body.style.overflow).toBe('');
      expect(document.documentElement.style.overflow).toBe('');
    });

    await waitFor(() => {
      expect(openRoleButton).toHaveFocus();
    });
  });

  it('allows selecting multiple permissions in the bulk permission modal', async () => {
    const user = userEvent.setup();
    const onBulkUpdatePermissions = vi.fn().mockResolvedValue(undefined);

    render(
      <AccessControlList
        records={[buildRecord(1), buildRecord(2)]}
        roles={roles}
        permissions={permissions}
        departments={departments}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        onUpdateRoles={vi.fn().mockResolvedValue(undefined)}
        onBulkUpdateRoles={vi.fn().mockResolvedValue(undefined)}
        onBulkUpdatePermissions={onBulkUpdatePermissions}
        onBulkUpdateScopes={vi.fn().mockResolvedValue(undefined)}
        onUpdatePermissions={vi.fn().mockResolvedValue(undefined)}
        onUpdateScopes={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.click(screen.getByLabelText('Chọn người dùng user01'));
    await user.click(screen.getByRole('button', { name: /Gán quyền/i }));

    await user.click(screen.getByRole('button', { name: 'Chọn nhiều quyền cho dòng 1' }));
    await user.click(screen.getByRole('button', { name: /Xem phan quyen/i }));
    await user.click(screen.getByRole('button', { name: /Quan tri phan quyen/i }));
    await user.click(screen.getByRole('button', { name: 'Chọn nhiều quyền cho dòng 1' }));

    await user.click(screen.getByRole('button', { name: 'Áp dụng' }));

    await waitFor(() => {
      expect(onBulkUpdatePermissions).toHaveBeenCalledWith([
        {
          userId: 1,
          overrides: [
            { permission_id: 1, type: 'GRANT', reason: null },
            { permission_id: 2, type: 'GRANT', reason: null },
          ],
        },
      ]);
    });
  });

  it('copies permission overrides from one user to another in the editor', async () => {
    const user = userEvent.setup();
    const onUpdatePermissions = vi.fn().mockResolvedValue(undefined);
    const sourceRecord = buildRecord(1, [
      {
        permission_id: 2,
        perm_key: 'authz.manage',
        perm_name: 'Quan tri phan quyen',
        perm_group: 'He thong',
        type: 'DENY',
        reason: 'Tam khoa cap nhat',
      },
    ]);
    const targetRecord = buildRecord(2, []);

    render(
      <AccessControlList
        records={[sourceRecord, targetRecord]}
        roles={roles}
        permissions={permissions}
        departments={departments}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        onUpdateRoles={vi.fn().mockResolvedValue(undefined)}
        onBulkUpdateRoles={vi.fn().mockResolvedValue(undefined)}
        onBulkUpdatePermissions={vi.fn().mockResolvedValue(undefined)}
        onBulkUpdateScopes={vi.fn().mockResolvedValue(undefined)}
        onUpdatePermissions={onUpdatePermissions}
        onUpdateScopes={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.click(screen.getAllByRole('button', { name: /Quyền/i })[1]);
    await user.click(screen.getByRole('button', { name: 'Chọn người dùng nguồn' }));
    await user.click(screen.getByRole('button', { name: /Nhan vien 01 \(user01\)/i }));
    await user.click(screen.getByRole('button', { name: /Sao chép quyền/i }));
    await user.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));

    await waitFor(() => {
      expect(onUpdatePermissions).toHaveBeenCalledWith(2, [
        {
          permission_id: 2,
          type: 'DENY',
          reason: 'Tam khoa cap nhat',
        },
      ]);
    });
  });

  it('copies permission overrides from one user to many selected users in the bulk modal', async () => {
    const user = userEvent.setup();
    const onBulkUpdatePermissions = vi.fn().mockResolvedValue(undefined);
    const sourceRecord = buildRecord(1, [
      {
        permission_id: 1,
        perm_key: 'authz.read',
        perm_name: 'Xem phan quyen',
        perm_group: 'He thong',
        type: 'GRANT',
        reason: 'Cho phep xem',
      },
      {
        permission_id: 2,
        perm_key: 'authz.manage',
        perm_name: 'Quan tri phan quyen',
        perm_group: 'He thong',
        type: 'DENY',
        reason: 'Tam khoa cap nhat',
      },
    ]);
    const targetRecordA = buildRecord(2, [
      {
        permission_id: 1,
        perm_key: 'authz.read',
        perm_name: 'Xem phan quyen',
        perm_group: 'He thong',
        type: 'DENY',
        reason: 'Override cu',
      },
    ]);
    const targetRecordB = buildRecord(3, []);

    render(
      <AccessControlList
        records={[sourceRecord, targetRecordA, targetRecordB]}
        roles={roles}
        permissions={permissions}
        departments={departments}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        onUpdateRoles={vi.fn().mockResolvedValue(undefined)}
        onBulkUpdateRoles={vi.fn().mockResolvedValue(undefined)}
        onBulkUpdatePermissions={onBulkUpdatePermissions}
        onBulkUpdateScopes={vi.fn().mockResolvedValue(undefined)}
        onUpdatePermissions={vi.fn().mockResolvedValue(undefined)}
        onUpdateScopes={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.click(screen.getByLabelText('Chọn người dùng user02'));
    await user.click(screen.getByLabelText('Chọn người dùng user03'));
    await user.click(screen.getByRole('button', { name: /Gán quyền/i }));

    await user.click(screen.getByRole('button', { name: 'Chọn người dùng nguồn' }));
    await user.click(screen.getByRole('button', { name: /Nhan vien 01 \(user01\)/i }));
    await user.click(screen.getByRole('button', { name: /Sao chép quyền/i }));
    await user.click(screen.getByRole('button', { name: 'Áp dụng' }));

    await waitFor(() => {
      expect(onBulkUpdatePermissions).toHaveBeenCalledWith([
        {
          userId: 2,
          overrides: [
            { permission_id: 1, type: 'GRANT', reason: 'Cho phep xem' },
            { permission_id: 2, type: 'DENY', reason: 'Tam khoa cap nhat' },
          ],
        },
        {
          userId: 3,
          overrides: [
            { permission_id: 1, type: 'GRANT', reason: 'Cho phep xem' },
            { permission_id: 2, type: 'DENY', reason: 'Tam khoa cap nhat' },
          ],
        },
      ]);
    });
  });

  it('allows bulk copy from a source without overrides to clear selected users', async () => {
    const user = userEvent.setup();
    const onBulkUpdatePermissions = vi.fn().mockResolvedValue(undefined);
    const sourceRecord = buildRecord(1, []);
    const targetRecord = buildRecord(2, [
      {
        permission_id: 2,
        perm_key: 'authz.manage',
        perm_name: 'Quan tri phan quyen',
        perm_group: 'He thong',
        type: 'DENY',
        reason: 'Tam khoa cap nhat',
      },
    ]);

    render(
      <AccessControlList
        records={[sourceRecord, targetRecord]}
        roles={roles}
        permissions={permissions}
        departments={departments}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        onUpdateRoles={vi.fn().mockResolvedValue(undefined)}
        onBulkUpdateRoles={vi.fn().mockResolvedValue(undefined)}
        onBulkUpdatePermissions={onBulkUpdatePermissions}
        onBulkUpdateScopes={vi.fn().mockResolvedValue(undefined)}
        onUpdatePermissions={vi.fn().mockResolvedValue(undefined)}
        onUpdateScopes={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.click(screen.getByLabelText('Chọn người dùng user02'));
    await user.click(screen.getByRole('button', { name: /Gán quyền/i }));

    await user.click(screen.getByRole('button', { name: 'Chọn người dùng nguồn' }));
    await user.click(screen.getByRole('button', { name: /Nhan vien 01 \(user01\)/i }));
    await user.click(screen.getByRole('button', { name: /Sao chép quyền/i }));
    await user.click(screen.getByRole('button', { name: 'Áp dụng' }));

    await waitFor(() => {
      expect(onBulkUpdatePermissions).toHaveBeenCalledWith([
        {
          userId: 2,
          overrides: [],
        },
      ]);
    });
  });
});
