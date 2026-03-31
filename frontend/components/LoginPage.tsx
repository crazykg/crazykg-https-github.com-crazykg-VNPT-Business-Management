import React, { useRef, useState } from 'react';
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
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const password = passwordInputRef.current?.value ?? '';

    if (!username.trim() || !password.trim() || isLoading) {
      return;
    }
    await onSubmit({
      username: username.trim(),
      password,
    });
  };

  return (
    <div className="min-h-screen bg-bg-light flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 rounded-3xl overflow-hidden shadow-xl border border-slate-200 bg-white">
        <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary via-deep-teal to-slate-900 text-white p-10">
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl">business</span>
            </div>
            <div>
              <h1 className="text-3xl font-black leading-tight">VNPT Business</h1>
              <p className="mt-2 text-white/80">Hệ thống quản lý doanh nghiệp</p>
            </div>
          </div>
          <p className="text-sm text-white/70">
            Đăng nhập để truy cập dữ liệu theo quyền được phân công.
          </p>
        </div>

        <div className="p-8 md:p-10">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-primary">
              <span className="material-symbols-outlined">business</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">VNPT Business</h1>
              <p className="text-xs text-slate-500">Hệ thống quản lý</p>
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
                value={username}
                onChange={(event) => setUsername(event.target.value)}
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
        </div>
      </div>
    </div>
  );
};
