import { create } from 'zustand';
import type { AuthLoginPayload, AuthLoginResult, AuthUser } from '../../types';
import {
  fetchAuthBootstrap,
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
} from '../../services/v5Api';

interface AuthState {
  user: AuthUser | null;
  isAuthLoading: boolean;
  isLoginLoading: boolean;
  passwordChangeRequired: boolean;

  bootstrapAuth: () => Promise<void>;
  login: (payload: AuthLoginPayload) => Promise<AuthLoginResult>;
  logout: () => Promise<void>;
  refreshCurrentUser: () => Promise<AuthUser>;
  setUser: (user: AuthUser | null) => void;
  clearAuth: () => void;
  setPasswordChangeRequired: (value: boolean) => void;
}

const resolvePasswordChangeRequired = (user: AuthUser | null | undefined): boolean =>
  Boolean(user?.password_change_required);

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthLoading: true,
  isLoginLoading: false,
  passwordChangeRequired: false,

  bootstrapAuth: async () => {
    set({ isAuthLoading: true });
    try {
      const bootstrap = await fetchAuthBootstrap();
      set({
        user: bootstrap.user,
        passwordChangeRequired: resolvePasswordChangeRequired(bootstrap.user),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'PASSWORD_CHANGE_REQUIRED') {
        try {
          const currentUser = await fetchCurrentUser();
          set({
            user: currentUser,
            passwordChangeRequired: Boolean(currentUser.password_change_required ?? true),
          });
          return;
        } catch {
          // Fall through to clearing auth state below.
        }
      }

      set({
        user: null,
        passwordChangeRequired: false,
      });
    } finally {
      set({ isAuthLoading: false });
    }
  },

  login: async (payload) => {
    set({ isLoginLoading: true });
    try {
      const session = await loginRequest(payload);
      const passwordChangeRequired = Boolean(
        session.password_change_required || session.user.password_change_required
      );

      set({
        user: session.user,
        passwordChangeRequired,
      });

      return session;
    } finally {
      set({ isLoginLoading: false });
    }
  },

  logout: async () => {
    try {
      await logoutRequest();
    } catch {
      // Ignore logout request failures and clear local auth state anyway.
    } finally {
      set({
        user: null,
        isAuthLoading: false,
        isLoginLoading: false,
        passwordChangeRequired: false,
      });
    }
  },

  refreshCurrentUser: async () => {
    const currentUser = await fetchCurrentUser();
    set({
      user: currentUser,
      passwordChangeRequired: resolvePasswordChangeRequired(currentUser),
    });
    return currentUser;
  },

  setUser: (user) =>
    set({
      user,
      passwordChangeRequired: resolvePasswordChangeRequired(user),
    }),

  clearAuth: () =>
    set({
      user: null,
      isAuthLoading: false,
      isLoginLoading: false,
      passwordChangeRequired: false,
    }),

  setPasswordChangeRequired: (value) => set({ passwordChangeRequired: value }),
}));
