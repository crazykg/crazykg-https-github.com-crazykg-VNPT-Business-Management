import React from 'react';
import { useEscKey } from '../../hooks/useEscKey';

const DATE_INPUT_MIN = '1900-01-01';
const DATE_INPUT_MAX = '9999-12-31';

export interface ModalWrapperProps {
  children: React.ReactNode;
  onClose: () => void;
  title: React.ReactNode;
  icon: string;
  width?: string;
  heightClass?: string;
  minHeightClass?: string;
  maxHeightClass?: string;
  panelClassName?: string;
  disableClose?: boolean;
  disableBackdropClose?: boolean;
  headerAside?: React.ReactNode;
  headerClassName?: string;
}

export function ModalWrapper({
  children,
  onClose,
  title,
  icon,
  width = 'max-w-[560px]',
  heightClass = '',
  minHeightClass = '',
  maxHeightClass = 'max-h-[90vh]',
  panelClassName = 'rounded-lg',
  disableClose = false,
  disableBackdropClose = false,
  headerAside,
  headerClassName = '',
}: ModalWrapperProps) {
  useEscKey(() => { if (!disableClose) onClose(); });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        data-testid="modal-backdrop"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={() => !disableClose && !disableBackdropClose && onClose()}
      ></div>
      <div className={`relative bg-white w-full ${width} ${heightClass} ${minHeightClass} ${maxHeightClass} ${panelClassName} shadow-xl flex flex-col overflow-hidden animate-fade-in border border-slate-200`}>
        {/* Header */}
        <div className={`flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0 ${headerClassName}`}>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>{icon}</span>
            </div>
            <h2 className="min-w-0 flex-1 text-sm font-bold text-deep-teal leading-tight truncate">{title}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerAside ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {headerAside}
              </div>
            ) : null}
            <button
              aria-label="Đóng modal"
              onClick={() => !disableClose && onClose()}
              disabled={disableClose}
              className="p-1.5 hover:bg-slate-100 rounded transition-colors text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}

export interface DeleteConfirmModalProps {
  title: string;
  message: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({ title, message, onClose, onConfirm }: DeleteConfirmModalProps) {
  useEscKey(onClose);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-sm rounded-lg shadow-xl overflow-hidden animate-fade-in border border-slate-200">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded bg-error/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-error" style={{ fontSize: 18 }}>warning</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-deep-teal">{title}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Hành động này cần xác nhận.</p>
            </div>
          </div>
          <div className="text-xs text-slate-600 mb-4 pl-12">{message}</div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              onClick={onConfirm}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors bg-error text-white hover:bg-red-700 shadow-sm"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
              Xóa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface FormInputProps {
  label: string;
  value?: string | number | null;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  type?: React.HTMLInputTypeAttribute;
  min?: string;
  max?: string;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  errorClassName?: string;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  required,
  error,
  type = 'text',
  min,
  max,
  className,
  labelClassName,
  inputClassName,
  errorClassName,
}) => (
  <div className={`flex flex-col gap-1 ${className || ''}`}>
    <label className={labelClassName || 'text-xs font-semibold text-neutral'}>
      {label} {required && <span className="text-error">*</span>}
    </label>
    <input
      type={type}
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      title={String(value || '')}
      lang={type === 'date' ? 'vi-VN' : undefined}
      min={type === 'date' ? (min || DATE_INPUT_MIN) : undefined}
      max={type === 'date' ? (max || DATE_INPUT_MAX) : undefined}
      className={`w-full border bg-white text-slate-900 focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none transition-all placeholder:text-slate-400 ${inputClassName || 'h-8 px-3 rounded text-xs'} ${disabled ? 'bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed' : error ? 'border-error ring-1 ring-error/30' : 'border-slate-300'}`}
    />
    {error && <p className={errorClassName || 'text-[11px] text-error mt-0.5'}>{error}</p>}
  </div>
);
