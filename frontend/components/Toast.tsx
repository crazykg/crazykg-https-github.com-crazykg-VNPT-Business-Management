import React, { useEffect } from 'react';
import { Toast as ToastType } from '../types';

interface ToastProps {
  toast: ToastType;
  onClose: (id: number) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    const durationMs = toast.type === 'success' ? 4000 : 7000;
    const timeoutId = window.setTimeout(() => onClose(toast.id), durationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [onClose, toast.id, toast.type]);

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-4 pr-12 rounded-lg shadow-lg border-l-4 w-full max-w-sm bg-white animate-slide-in relative ${toast.type === 'success' ? 'border-success' : 'border-error'}`}
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
       <div className="flex-shrink-0">
         <span className={`material-symbols-outlined text-xl ${toast.type === 'success' ? 'text-success' : 'text-error'}`}>
           {toast.type === 'success' ? 'check_circle' : 'error'}
         </span>
       </div>
       <div className="flex-1 pt-0.5">
         <h3 className="text-sm font-semibold text-slate-900">{toast.title}</h3>
         <p className="text-sm text-slate-600 mt-1">{toast.message}</p>
       </div>
       <button
         type="button"
         onClick={() => onClose(toast.id)}
         aria-label="Đóng thông báo"
         className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
       >
         <span className="material-symbols-outlined text-lg">close</span>
       </button>
    </div>
  );
};

export const ToastContainer: React.FC<{ toasts: ToastType[], removeToast: (id: number) => void }> = ({ toasts, removeToast }) => {
  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[2000] flex flex-col gap-3">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>
  );
};
