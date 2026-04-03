import React, { useEffect, useRef, useState } from 'react';
import { AuthLoginPayload } from '../types';

interface LoginPageProps {
  isLoading: boolean;
  errorMessage: string;
  /** Nếu được set → hiển thị banner phía trên form (tab bị evict, session hết hạn...) */
  infoMessage?: string;
  onSubmit: (payload: AuthLoginPayload) => Promise<void> | void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ isLoading, errorMessage, infoMessage, onSubmit }) => {
  const [username, setUsername] = useState('');
  const [hasPasswordValue, setHasPasswordValue] = useState(false);
  const usernameInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const copyrightLine = 'Bản quyền: Phan Văn...- 094 520 0..., email: ...hgi@vnpt.vn';
  const vnptLogo = (
    <svg viewBox="0 0 120 120" aria-hidden="true" className="h-full w-full">
      <g transform="rotate(-26 60 60)">
        <ellipse cx="48" cy="64" rx="26" ry="54" fill="#0a67b2" />
        <path
          d="M67 10c22 3 34 18 35 36 1 15-7 31-20 47-11 13-26 25-46 39 7-17 17-32 26-45 10-14 17-27 19-39 2-14-2-27-14-38z"
          fill="#0a67b2"
        />
      </g>
      <ellipse
        cx="64"
        cy="57"
        rx="39"
        ry="55"
        transform="rotate(35 64 57)"
        fill="none"
        stroke="#0a67b2"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <ellipse cx="26" cy="42" rx="11" ry="24" transform="rotate(21 26 42)" fill="#ffffff" />
      <ellipse cx="90" cy="19" rx="8" ry="17" transform="rotate(-32 90 19)" fill="#ffffff" />
      <path
        d="M33 110c14-4 31-14 48-29 16-15 28-31 36-49-1 19-9 39-24 55-16 17-38 27-60 23z"
        fill="#ffffff"
      />
    </svg>
  );

  const syncCredentialStateFromDom = () => {
    const nextUsername = usernameInputRef.current?.value ?? '';
    const nextPassword = passwordInputRef.current?.value ?? '';

    setUsername((currentUsername) => (currentUsername === nextUsername ? currentUsername : nextUsername));
    setHasPasswordValue(nextPassword.trim().length > 0);
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const immediateSyncTimer = window.setTimeout(syncCredentialStateFromDom, 0);
    const delayedSyncTimer = window.setTimeout(syncCredentialStateFromDom, 220);

    return () => {
      window.clearTimeout(immediateSyncTimer);
      window.clearTimeout(delayedSyncTimer);
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextUsername = usernameInputRef.current?.value ?? username;
    const password = passwordInputRef.current?.value ?? '';

    if (!nextUsername.trim() || !password.trim() || isLoading) {
      return;
    }
    await onSubmit({
      username: nextUsername.trim(),
      password,
    });
  };

  return (
    <div className="min-h-screen bg-bg-light flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 rounded-3xl overflow-hidden shadow-xl border border-slate-200 bg-white">
        <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary via-deep-teal to-slate-900 text-white p-10">
          <div className="space-y-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white/96 p-2.5 shadow-[0_18px_32px_-18px_rgba(15,23,42,0.65)] ring-1 ring-white/60">
              {vnptLogo}
            </div>
            <div>
              <h1 className="text-3xl font-black leading-tight">TTKDGP-PGP2</h1>
              <p className="mt-2 text-white/80">Hệ thống quản lý nội bộ phòng</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-white/70">{copyrightLine}</p>
        </div>

        <div className="p-8 md:p-10">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200">
              {vnptLogo}
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">TTKDGP-PGP2</h1>
              <p className="text-xs text-slate-500">Hệ thống quản lý nội bộ phòng</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900">Đăng nhập</h2>
            <p className="text-sm text-slate-500 mt-1">Sử dụng tài khoản nội bộ để tiếp tục.</p>
          </div>

          {/* ★ Banner thông báo khi bị evict hoặc session hết hạn */}
          {infoMessage ? (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="material-symbols-outlined text-amber-500 text-lg mt-px shrink-0">
                info
              </span>
              <p className="text-sm text-amber-800 leading-snug">{infoMessage}</p>
            </div>
          ) : null}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Tên đăng nhập</label>
              <input
                type="text"
                ref={usernameInputRef}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                onInput={syncCredentialStateFromDom}
                onFocus={syncCredentialStateFromDom}
                placeholder="admin hoặc admin@vnpt.vn"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                autoComplete="username"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Mật khẩu</label>
              <input
                type="password"
                ref={passwordInputRef}
                onChange={(event) => setHasPasswordValue(event.target.value.length > 0)}
                onInput={syncCredentialStateFromDom}
                onFocus={syncCredentialStateFromDom}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>

            {errorMessage ? (
              <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
                {errorMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isLoading || !username.trim() || !hasPasswordValue}
              className="w-full h-12 rounded-xl bg-primary text-white font-bold shadow-md shadow-primary/30 hover:bg-deep-teal transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-4 lg:hidden">
            <p className="text-xs leading-5 text-slate-500">{copyrightLine}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
