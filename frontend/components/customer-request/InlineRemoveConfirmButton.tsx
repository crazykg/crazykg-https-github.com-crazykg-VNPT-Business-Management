import React, { useEffect, useId, useRef, useState } from 'react';
import { useEscKey } from '../../hooks/useEscKey';
import { customerRequestDenseSecondaryButtonClass } from './uiClasses';

type InlineRemoveConfirmButtonProps = {
  triggerLabel: string;
  confirmTitle: string;
  confirmDescription: string;
  confirmActionLabel: string;
  disabled?: boolean;
  onConfirm: () => void;
};

const triggerButtonClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-[var(--ui-control-radius)] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-bg)] text-[color:var(--ui-text-subtle)] transition hover:border-rose-200 hover:bg-[var(--ui-danger-bg)] hover:text-[var(--ui-danger-fg)] focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-50';

const confirmActionButtonClass =
  'inline-flex h-8 items-center justify-center rounded-[var(--ui-control-radius)] bg-[var(--ui-danger-fg)] px-3 text-[13px] font-semibold leading-5 text-white shadow-[var(--ui-shadow-shell)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50';

export const InlineRemoveConfirmButton: React.FC<InlineRemoveConfirmButtonProps> = ({
  triggerLabel,
  confirmTitle,
  confirmDescription,
  confirmActionLabel,
  disabled = false,
  onConfirm,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const panelId = useId();

  useEscKey(() => setIsOpen(false), isOpen);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
    }
  }, [disabled, isOpen]);

  const handleConfirm = () => {
    onConfirm();
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className="relative flex items-start justify-end">
      <button
        type="button"
        disabled={disabled}
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={panelId}
        title={triggerLabel}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`${triggerButtonClass} ${isOpen ? 'border-rose-200 bg-[var(--ui-danger-bg)] text-[var(--ui-danger-fg)]' : ''}`}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[18px] leading-none">close</span>
      </button>

      {isOpen ? (
        <div
          id={panelId}
          role="alertdialog"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          className="absolute right-0 top-10 z-20 w-[236px] rounded-[var(--ui-shell-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] p-3 shadow-[0_14px_30px_rgba(15,23,42,0.14)]"
        >
          <span
            aria-hidden="true"
            className="absolute -top-1 right-3 h-2.5 w-2.5 rotate-45 border-l border-t border-[var(--ui-border)] bg-[var(--ui-surface-bg)]"
          />
          <p id={titleId} className="text-sm font-semibold leading-5 text-[color:var(--ui-text-default)]">
            {confirmTitle}
          </p>
          <p id={descriptionId} className="mt-1.5 text-xs leading-5 text-[color:var(--ui-text-muted)]">
            {confirmDescription}
          </p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className={customerRequestDenseSecondaryButtonClass}
            >
              Giữ lại
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={confirmActionButtonClass}
            >
              {confirmActionLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
