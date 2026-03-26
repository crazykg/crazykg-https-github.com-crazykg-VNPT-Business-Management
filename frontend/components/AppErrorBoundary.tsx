// @ts-nocheck
import { Component } from 'react';

export class AppErrorBoundary extends Component {
  state = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.',
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AppErrorBoundary caught an error', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetView = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('tab');
    window.location.assign(`${url.pathname}${url.search}${url.hash}`);
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-bg-light flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-2xl border border-amber-200 bg-white shadow-xl p-6 md:p-8">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined">warning</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900">Ứng dụng tạm thời gặp lỗi hiển thị</h2>
              <p className="mt-2 text-sm text-slate-600">
                Mình đã chặn lỗi để tránh màn hình trắng hoàn toàn. Anh/chị có thể tải lại trang hoặc quay về tab mặc định.
              </p>
              {this.state.errorMessage ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chi tiết tạm thời</p>
                  <p className="mt-1 break-words font-mono text-xs text-slate-700">{this.state.errorMessage}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={this.handleResetView}
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Về tab mặc định
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      </div>
    );
  }
}
