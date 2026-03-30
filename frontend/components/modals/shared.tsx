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
  panelClassName = 'rounded-xl',
  disableClose = false,
  headerAside,
  headerClassName = '',
}: ModalWrapperProps) {
  useEscKey(() => { if (!disableClose) onClose(); });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !disableClose && onClose()}></div>
      <div className={`relative bg-white w-full ${width} ${heightClass} ${minHeightClass} ${maxHeightClass} ${panelClassName} shadow-2xl flex flex-col overflow-hidden animate-fade-in`}>
        <div className={`flex flex-col gap-3 border-b border-slate-100 px-4 py-4 md:px-6 xl:flex-row xl:items-start xl:justify-between flex-shrink-0 ${headerClassName}`}>
          <div className="flex min-w-0 flex-1 items-center gap-3 text-slate-900">
            <span className="material-symbols-outlined text-primary text-2xl">{icon}</span>
            <h2 className="min-w-0 flex-1 text-lg font-bold leading-tight tracking-tight md:text-xl">{title}</h2>
          </div>
          <div className="flex items-start justify-between gap-3 xl:justify-end">
            {headerAside ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {headerAside}
              </div>
            ) : null}
            <button
              onClick={() => !disableClose && onClose()}
              disabled={disableClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
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
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-fade-in border border-slate-200">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{title}</h3>
              <p className="text-sm text-slate-500 mt-1">Hành động này cần xác nhận.</p>
            </div>
          </div>
          <div className="text-slate-600 mb-6">{message}</div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium">Hủy</button>
            <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-lg shadow-red-600/20">Xóa</button>
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
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-semibold text-slate-700">
      {label} {required && <span className="text-red-500">*</span>}
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
      className={`w-full h-11 px-4 rounded-lg border bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400 ${disabled ? 'bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed' : error ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'}`}
    />
    {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
  </div>
);
