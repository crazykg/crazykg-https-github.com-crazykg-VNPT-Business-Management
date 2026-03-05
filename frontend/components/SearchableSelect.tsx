import React, { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface SearchableSelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  searchText?: string;
}

interface SearchableSelectProps {
  value: string | number | null | undefined;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  onSearchTermChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  searchPlaceholder?: string;
  noOptionsText?: string;
  searching?: boolean;
  label?: string;
  required?: boolean;
  error?: string;
  compact?: boolean;
  usePortal?: boolean;
  portalZIndex?: number;
}

const SEARCHABLE_SELECT_OPEN_EVENT = 'searchable-select:open';

type SearchableSelectOpenEventDetail = {
  id: string;
};

const normalizeToken = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  options,
  onChange,
  onSearchTermChange,
  placeholder = 'Chọn...',
  disabled = false,
  className = '',
  triggerClassName = '',
  dropdownClassName = '',
  searchPlaceholder = 'Tìm kiếm...',
  noOptionsText = 'Không tìm thấy kết quả',
  searching = false,
  label,
  required = false,
  error,
  compact = false,
  usePortal = false,
  portalZIndex = 2000,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDirection, setOpenDirection] = useState<'up' | 'down'>('down');
  const [portalStyle, setPortalStyle] = useState<CSSProperties>({});
  const instanceIdRef = useRef(
    `searchable-select-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  );
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedValue = String(value ?? '');
  const canUsePortal = usePortal && typeof document !== 'undefined';

  const syncPortalPlacement = useCallback(() => {
    if (!canUsePortal || !isOpen || !wrapperRef.current) {
      return;
    }

    const rect = wrapperRef.current.getBoundingClientRect();
    const estimatedDropdownHeight = compact ? 220 : 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const nextDirection = spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow ? 'up' : 'down';

    setOpenDirection(nextDirection);

    const width = Math.max(220, rect.width);
    const maxLeft = Math.max(8, window.innerWidth - width - 8);
    const left = Math.min(Math.max(8, rect.left), maxLeft);

    const style: CSSProperties = {
      position: 'fixed',
      left,
      width,
      zIndex: portalZIndex,
    };

    if (nextDirection === 'up') {
      style.bottom = window.innerHeight - rect.top + 4;
    } else {
      style.top = rect.bottom + 4;
    }

    setPortalStyle(style);
  }, [canUsePortal, compact, isOpen, portalZIndex]);

  useEffect(() => {
    const handleOtherSelectOpened = (event: Event) => {
      const customEvent = event as CustomEvent<SearchableSelectOpenEventDetail>;
      if (customEvent.detail?.id !== instanceIdRef.current) {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedTrigger = wrapperRef.current?.contains(target);
      const clickedDropdown = dropdownRef.current?.contains(target);

      if (!clickedTrigger && !clickedDropdown) {
        setIsOpen(false);
      }
    };

    document.addEventListener(SEARCHABLE_SELECT_OPEN_EVENT, handleOtherSelectOpened);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener(SEARCHABLE_SELECT_OPEN_EVENT, handleOtherSelectOpened);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !wrapperRef.current) {
      return;
    }

    if (canUsePortal) {
      syncPortalPlacement();
      return;
    }

    const rect = wrapperRef.current.getBoundingClientRect();
    const estimatedDropdownHeight = compact ? 220 : 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow) {
      setOpenDirection('up');
      return;
    }

    setOpenDirection('down');
  }, [canUsePortal, isOpen, options.length, compact, syncPortalPlacement]);

  useEffect(() => {
    if (!isOpen || !canUsePortal) {
      return;
    }

    syncPortalPlacement();
    const handleWindowUpdate = () => syncPortalPlacement();
    window.addEventListener('scroll', handleWindowUpdate, true);
    window.addEventListener('resize', handleWindowUpdate);

    return () => {
      window.removeEventListener('scroll', handleWindowUpdate, true);
      window.removeEventListener('resize', handleWindowUpdate);
    };
  }, [canUsePortal, isOpen, syncPortalPlacement, options.length, searchTerm]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      onSearchTermChange?.('');
    }
  }, [isOpen, onSearchTermChange]);

  const selectedOption = useMemo(
    () => options.find((option) => String(option.value) === normalizedValue),
    [options, normalizedValue]
  );

  const filteredOptions = useMemo(() => {
    const keyword = normalizeToken(searchTerm);
    if (!keyword) {
      return options;
    }

    return options.filter((option) => {
      const haystack = normalizeToken(option.searchText ?? `${option.label} ${option.value}`);
      return haystack.includes(keyword);
    });
  }, [options, searchTerm]);

  const baseTriggerClass = compact
    ? 'w-full h-9 px-3 rounded-md border border-slate-300 bg-white text-left text-sm text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed relative'
    : 'w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-left text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed relative';

  const mergedTriggerClass = `${baseTriggerClass} ${error ? 'border-red-500 ring-1 ring-red-500' : ''} ${triggerClassName}`.trim();

  return (
    <div ref={wrapperRef} className={`relative ${className}`.trim()}>
      {label ? (
        <label className="mb-1.5 block text-sm font-semibold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      ) : null}

      <button
        type="button"
        className={mergedTriggerClass}
        onClick={() => {
          if (disabled) {
            return;
          }

          setIsOpen((prev) => {
            const nextIsOpen = !prev;
            if (nextIsOpen && typeof document !== 'undefined') {
              document.dispatchEvent(
                new CustomEvent<SearchableSelectOpenEventDetail>(SEARCHABLE_SELECT_OPEN_EVENT, {
                  detail: { id: instanceIdRef.current },
                })
              );
            }
            return nextIsOpen;
          });
        }}
        disabled={disabled}
      >
        <span className={selectedOption ? '' : 'text-slate-400'}>
          {selectedOption?.label || placeholder}
        </span>
        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
      </button>

      {isOpen ? (
        (canUsePortal ? createPortal(
        <div
          ref={dropdownRef}
          style={portalStyle}
          className={`rounded-lg border border-slate-200 bg-white shadow-2xl overflow-hidden ${dropdownClassName}`.trim()}
        >
          <div className="border-b border-slate-100 bg-slate-50 p-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setSearchTerm(nextValue);
                  onSearchTermChange?.(nextValue);
                }}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                onClick={(event) => event.stopPropagation()}
              />
              {searching ? (
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400 text-lg">
                  progress_activity
                </span>
              ) : null}
            </div>
          </div>

          <div className={`${compact ? 'max-h-44' : 'max-h-60'} overflow-y-auto custom-scrollbar p-1`}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const optionValue = String(option.value);
                const isSelected = optionValue === normalizedValue;

                return (
                  <button
                    key={optionValue}
                    type="button"
                    disabled={option.disabled}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors ${
                      option.disabled
                        ? 'cursor-not-allowed text-slate-300'
                        : isSelected
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => {
                      if (option.disabled) {
                        return;
                      }
                      onChange(optionValue);
                      setIsOpen(false);
                    }}
                  >
                    <span className="text-left">{option.label}</span>
                    {isSelected ? <span className="material-symbols-outlined text-sm">check</span> : null}
                  </button>
                );
              })
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-slate-400">
                <span className="material-symbols-outlined text-2xl">search_off</span>
                <span>{noOptionsText}</span>
              </div>
            )}
          </div>
        </div>, document.body
        ) : <div
          ref={dropdownRef}
          className={`absolute left-0 z-[120] w-full rounded-lg border border-slate-200 bg-white shadow-2xl overflow-hidden ${
            openDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
          } ${dropdownClassName}`.trim()}
        >
          <div className="border-b border-slate-100 bg-slate-50 p-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setSearchTerm(nextValue);
                  onSearchTermChange?.(nextValue);
                }}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                onClick={(event) => event.stopPropagation()}
              />
              {searching ? (
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400 text-lg">
                  progress_activity
                </span>
              ) : null}
            </div>
          </div>

          <div className={`${compact ? 'max-h-44' : 'max-h-60'} overflow-y-auto custom-scrollbar p-1`}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const optionValue = String(option.value);
                const isSelected = optionValue === normalizedValue;

                return (
                  <button
                    key={optionValue}
                    type="button"
                    disabled={option.disabled}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors ${
                      option.disabled
                        ? 'cursor-not-allowed text-slate-300'
                        : isSelected
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => {
                      if (option.disabled) {
                        return;
                      }
                      onChange(optionValue);
                      setIsOpen(false);
                    }}
                  >
                    <span className="text-left">{option.label}</span>
                    {isSelected ? <span className="material-symbols-outlined text-sm">check</span> : null}
                  </button>
                );
              })
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-slate-400">
                <span className="material-symbols-outlined text-2xl">search_off</span>
                <span>{noOptionsText}</span>
              </div>
            )}
          </div>
        </div>)
      ) : null}

      {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}
    </div>
  );
};
