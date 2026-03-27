import { useState, useCallback, useEffect } from 'react';
import { fetchAuthBootstrap, fetchCurrentUser, login, logout, changePasswordFirstLogin } from '../services/v5Api';
import type { AuthUser } from '../types';

interface PasswordChangeForm {
  current_password: string;
  new_password: string;
  new_password_confirmation: string;
}

interface UseAuthReturn {
  authUser: AuthUser | null;
  isAuthLoading: boolean;
  isLoginLoading: boolean;
  loginError: string;
  loginInfoMessage: string;
  passwordChangeRequired: boolean;
  passwordChangeForm: PasswordChangeForm;
  isPasswordChanging: boolean;
  passwordChangeError: string;
  handleLogin: (payload: { username: string; password: string }) => Promise<void>;
  handleLogout: () => Promise<void>;
  handleChangePasswordRequired: () => Promise<void>;
  updatePasswordChangeForm: (field: keyof PasswordChangeForm, value: string) => void;
}

export function useAuth(
  options?: {
    onAuthChange?: (user: AuthUser | null) => void;
    onPasswordChangeRequired?: () => void;
    getTabIdFromPath?: (pathname: string) => string | null;
    canAccessTab?: (user: AuthUser | null, tabId: string) => boolean;
    navigate?: (path: string) => void;
    getRoutePathFromTabId?: (tabId: string) => string;
    resetModuleData?: () => void;
    clearToasts?: () => void;
  }
): UseAuthReturn {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginInfoMessage, setLoginInfoMessage] = useState('');
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [passwordChangeForm, setPasswordChangeForm] = useState<PasswordChangeForm>({
    current_password: '',
    new_password: '',
    new_password_confirmation: '',
  });
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState('');

  // Bootstrap auth on mount
  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const bootstrap = await fetchAuthBootstrap();
        setAuthUser(bootstrap.user);
        setPasswordChangeRequired(Boolean(bootstrap.user.password_change_required));
        setLoginError('');
        options?.onAuthChange?.(bootstrap.user);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message === 'PASSWORD_CHANGE_REQUIRED') {
          try {
            const currentUser = await fetchCurrentUser();
            setAuthUser(currentUser);
            setPasswordChangeRequired(Boolean(currentUser.password_change_required ?? true));
            setLoginError('');
            options?.onAuthChange?.(currentUser);
            return;
          } catch {
            // fall through to unauthenticated state
          }
        }

        setAuthUser(null);
        setPasswordChangeRequired(false);
        options?.onAuthChange?.(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    bootstrapAuth();
  }, []);

  const handleLogin = useCallback(async (payload: { username: string; password: string }) => {
    setIsLoginLoading(true);
    setLoginError('');
    setPasswordChangeError('');
    setLoginInfoMessage('');
    try {
      const session = await login(payload);
      setAuthUser(session.user);
      setPasswordChangeRequired(Boolean(session.password_change_required || session.user.password_change_required));
      setPasswordChangeForm({
        current_password: '',
        new_password: '',
        new_password_confirmation: '',
      });
      options?.onAuthChange?.(session.user);

      // Navigate to requested tab or default
      const requestedTab = typeof window !== 'undefined'
        ? options?.getTabIdFromPath?.(window.location.pathname) || new URLSearchParams(window.location.search).get('tab')
        : null;
      if (requestedTab && options?.canAccessTab?.(session.user, requestedTab)) {
        options?.navigate?.(options.getRoutePathFromTabId?.(requestedTab) || '/');
      } else {
        options?.navigate?.(
          options?.canAccessTab?.(session.user, 'dashboard') ? '/' : '/internal-user-dashboard'
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Đăng nhập thất bại.';
      setLoginError(message);
    } finally {
      setIsLoginLoading(false);
    }
  }, [options]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } finally {
      setAuthUser(null);
      setPasswordChangeRequired(false);
      setPasswordChangeError('');
      setPasswordChangeForm({
        current_password: '',
        new_password: '',
        new_password_confirmation: '',
      });
      setLoginError('');
      setLoginInfoMessage('');
      options?.onAuthChange?.(null);
      options?.resetModuleData?.();
      options?.clearToasts?.();
    }
  }, [options]);

  const handleChangePasswordRequired = useCallback(async () => {
    if (isPasswordChanging) {
      return;
    }

    setPasswordChangeError('');
    if (!passwordChangeForm.current_password || !passwordChangeForm.new_password || !passwordChangeForm.new_password_confirmation) {
      setPasswordChangeError('Vui lòng nhập đầy đủ thông tin đổi mật khẩu.');
      return;
    }
    if (passwordChangeForm.new_password !== passwordChangeForm.new_password_confirmation) {
      setPasswordChangeError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsPasswordChanging(true);
    try {
      const result = await changePasswordFirstLogin(passwordChangeForm);
      setAuthUser(result.user);
      setPasswordChangeRequired(false);
      setPasswordChangeForm({
        current_password: '',
        new_password: '',
        new_password_confirmation: '',
      });
      options?.onAuthChange?.(result.user);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể đổi mật khẩu.';
      setPasswordChangeError(message);
    } finally {
      setIsPasswordChanging(false);
    }
  }, [passwordChangeForm, isPasswordChanging, options]);

  const updatePasswordChangeForm = useCallback((field: keyof PasswordChangeForm, value: string) => {
    setPasswordChangeForm((current) => ({ ...current, [field]: value }));
  }, []);

  return {
    authUser,
    isAuthLoading,
    isLoginLoading,
    loginError,
    loginInfoMessage,
    passwordChangeRequired,
    passwordChangeForm,
    isPasswordChanging,
    passwordChangeError,
    handleLogin,
    handleLogout,
    handleChangePasswordRequired,
    updatePasswordChangeForm,
  };
}