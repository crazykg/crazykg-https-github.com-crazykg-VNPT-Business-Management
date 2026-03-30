import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchAuthBootstrapMock = vi.hoisted(() => vi.fn());
const fetchCurrentUserMock = vi.hoisted(() => vi.fn());
const loginMock = vi.hoisted(() => vi.fn());
const logoutMock = vi.hoisted(() => vi.fn());

vi.mock('../services/v5Api', () => ({
  fetchAuthBootstrap: fetchAuthBootstrapMock,
  fetchCurrentUser: fetchCurrentUserMock,
  login: loginMock,
  logout: logoutMock,
}));

import { useAuthStore } from '../shared/stores';

const defaultState = {
  user: null,
  isAuthLoading: true,
  isLoginLoading: false,
  passwordChangeRequired: false,
};

describe('useAuthStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState(defaultState);
  });

  it('bootstraps auth from the bootstrap endpoint', async () => {
    fetchAuthBootstrapMock.mockResolvedValue({
      user: {
        id: 1,
        username: 'admin',
        full_name: 'Administrator',
        email: 'admin@example.com',
        status: 'ACTIVE',
        roles: ['ADMIN'],
        permissions: ['*'],
        dept_scopes: [],
        password_change_required: false,
      },
    });

    await useAuthStore.getState().bootstrapAuth();

    expect(fetchAuthBootstrapMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({
      user: expect.objectContaining({
        username: 'admin',
      }),
      isAuthLoading: false,
      passwordChangeRequired: false,
    });
  });

  it('falls back to fetchCurrentUser when bootstrap reports PASSWORD_CHANGE_REQUIRED', async () => {
    fetchAuthBootstrapMock.mockRejectedValue(new Error('PASSWORD_CHANGE_REQUIRED'));
    fetchCurrentUserMock.mockResolvedValue({
      id: 2,
      username: 'first-login-user',
      full_name: 'First Login User',
      email: 'first-login@example.com',
      status: 'ACTIVE',
      roles: ['STAFF'],
      permissions: ['dashboard.read'],
      dept_scopes: [],
      password_change_required: true,
    });

    await useAuthStore.getState().bootstrapAuth();

    expect(fetchCurrentUserMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({
      user: expect.objectContaining({
        username: 'first-login-user',
      }),
      isAuthLoading: false,
      passwordChangeRequired: true,
    });
  });

  it('stores the logged-in user and first-login flag after login', async () => {
    loginMock.mockResolvedValue({
      user: {
        id: 3,
        username: 'editor',
        full_name: 'Editor',
        email: 'editor@example.com',
        status: 'ACTIVE',
        roles: ['EDITOR'],
        permissions: ['projects.read'],
        dept_scopes: [],
        password_change_required: true,
      },
      password_change_required: true,
    });

    const result = await useAuthStore.getState().login({
      username: 'editor',
      password: 'secret',
    });

    expect(result.user.username).toBe('editor');
    expect(useAuthStore.getState()).toMatchObject({
      user: expect.objectContaining({
        username: 'editor',
      }),
      isLoginLoading: false,
      passwordChangeRequired: true,
    });
  });

  it('clears auth state even when logout request fails', async () => {
    logoutMock.mockRejectedValue(new Error('network'));
    useAuthStore.setState({
      ...defaultState,
      user: {
        id: 4,
        username: 'viewer',
        full_name: 'Viewer',
        email: 'viewer@example.com',
        status: 'ACTIVE',
        roles: ['VIEWER'],
        permissions: ['dashboard.read'],
        dept_scopes: [],
      },
      isAuthLoading: false,
      passwordChangeRequired: true,
    });

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      isAuthLoading: false,
      isLoginLoading: false,
      passwordChangeRequired: false,
    });
  });
});
