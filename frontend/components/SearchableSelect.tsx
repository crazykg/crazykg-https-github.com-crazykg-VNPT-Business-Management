import React, { CSSProperties, ReactNode, Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { createPortal } from 'react-dom';

export interface SearchableSelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  searchText?: string;
  optionClassName?: string;
  selectedOptionClassName?: string;
  highlightedOptionClassName?: string;
  triggerButtonClassName?: string;
  triggerLabelClassName?: string;
}

interface SearchableSelectProps {
  value: string | number | null | undefined;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  onDisabledInteract?: () => void;
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
  denseLabel?: boolean;
  usePortal?: boolean;
  portalZIndex?: number;
  portalMinWidth?: number;
  portalMaxWidth?: number;
  optionEstimateSize?: number;
  allowCustomValue?: boolean;
  customValueLabel?: (value: string) => string;
  autoFocusTrigger?: boolean;
  triggerButtonRef?: Ref<HTMLButtonElement>;
  onTriggerKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  rightAction?: {
    icon?: string;
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  renderOptionContent?: (
    option: SearchableSelectOption,
    state: { isSelected: boolean; isHighlighted: boolean }
  ) => ReactNode;
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

export const SearchableSelect: React.FC<SearchableSelectProps> = React.memo(function SearchableSelectComponent({
  value,
  options,
  onChange,
  searchTerm: controlledSearchTerm,
  onSearchTermChange,
  onDisabledInteract,
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
  denseLabel = false,
  usePortal = true,
  portalZIndex = 2000,
  portalMinWidth,
  portalMaxWidth,
  optionEstimateSize,
  allowCustomValue = false,
  customValueLabel,
  autoFocusTrigger = false,
  triggerButtonRef,
  onTriggerKeyDown,
  rightAction,
  renderOptionContent,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const [openDirection, setOpenDirection] = useState<'up' | 'down'>('down');
  const [portalStyle, setPortalStyle] = useState<CSSProperties>({});
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const instanceIdRef = useRef(
    `searchable-select-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  );
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const openHighlightModeRef = useRef<'default' | 'first' | 'last'>('default');
  const labelId = `${instanceIdRef.current}-label`;
  const triggerAriaLabel = label?.trim() || placeholder;
  const searchInputAriaLabel = label?.trim() ? `Tìm ${label.trim()}` : searchPlaceholder;
  const searchTerm = controlledSearchTerm ?? internalSearchTerm;

  const updateSearchTerm = useCallback(
    (nextValue: string) => {
      if (controlledSearchTerm === undefined) {
        setInternalSearchTerm(nextValue);
      }
      onSearchTermChange?.(nextValue);
    },
    [controlledSearchTerm, onSearchTermChange]
  );

  const normalizedValue = String(value ?? '');
  const canUsePortal = usePortal && typeof document !== 'undefined';
  const resolveCustomValueLabel = useCallback(
    (rawValue: string) => {
      const trimmed = rawValue.trim();
      if (!trimmed) {
        return '';
      }
      return customValueLabel ? customValueLabel(trimmed) : `Dùng "${trimmed}"`;
    },
    [customValueLabel]
  );

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

    const viewportMaxWidth = Math.max(220, window.innerWidth - 16);
    const requestedWidth = Math.max(220, rect.width, portalMinWidth ?? 0);
    const width = Math.min(
      viewportMaxWidth,
      portalMaxWidth ?? viewportMaxWidth,
      requestedWidth
    );
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
  }, [canUsePortal, compact, isOpen, portalMaxWidth, portalMinWidth, portalZIndex]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
    openHighlightModeRef.current = 'default';
  }, []);

  const focusTrigger = useCallback(() => {
    triggerRef.current?.focus();
    window.requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    const handleOtherSelectOpened = (event: Event) => {
      const customEvent = event as CustomEvent<SearchableSelectOpenEventDetail>;
      if (customEvent.detail?.id !== instanceIdRef.current) {
        closeDropdown();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedTrigger = wrapperRef.current?.contains(target);
      const clickedDropdown = dropdownRef.current?.contains(target);

      if (!clickedTrigger && !clickedDropdown) {
        closeDropdown();
      }
    };

    document.addEventListener(SEARCHABLE_SELECT_OPEN_EVENT, handleOtherSelectOpened);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener(SEARCHABLE_SELECT_OPEN_EVENT, handleOtherSelectOpened);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [closeDropdown]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (autoFocusTrigger && !disabled) {
      triggerRef.current?.focus();
    }
  }, [autoFocusTrigger, disabled]);

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
      if (controlledSearchTerm === undefined) {
        setInternalSearchTerm('');
      }
      setHighlightedIndex(-1);
      optionRefs.current = [];
      onSearchTermChange?.('');
    }
  }, [controlledSearchTerm, isOpen, onSearchTermChange]);

  const selectedOption = useMemo(() => {
    const matched = options.find((option) => String(option.value) === normalizedValue);
    if (matched) {
      return matched;
    }
    if (allowCustomValue && normalizedValue.trim() !== '') {
      return {
        value: normalizedValue,
        label: normalizedValue,
      } satisfies SearchableSelectOption;
    }
    return null;
  }, [allowCustomValue, options, normalizedValue]);

  const customOption = useMemo<SearchableSelectOption | null>(() => {
    const trimmedSearchTerm = searchTerm.trim();
    if (!allowCustomValue || trimmedSearchTerm === '') {
      return null;
    }

    const alreadyExists = options.some((option) => normalizeToken(option.value) === normalizeToken(trimmedSearchTerm));
    if (alreadyExists) {
      return null;
    }

    return {
      value: trimmedSearchTerm,
      label: resolveCustomValueLabel(trimmedSearchTerm),
      searchText: trimmedSearchTerm,
    };
  }, [allowCustomValue, options, resolveCustomValueLabel, searchTerm]);

  const filteredOptions = useMemo<SearchableSelectOption[]>(() => {
    const keyword = normalizeToken(searchTerm);
    const baseOptions = keyword
      ? options.filter((option) => {
          const haystack = normalizeToken(option.searchText ?? `${option.label} ${option.value}`);
          return haystack.includes(keyword);
        })
      : options;

    if (!customOption) {
      return baseOptions;
    }

    return [...baseOptions, customOption];
  }, [customOption, options, searchTerm]);

  const resolvedOptionEstimateSize = optionEstimateSize ?? (compact ? 40 : 44);
  const rowVirtualizer = useVirtualizer({
    count: filteredOptions.length,
    getScrollElement: () => optionsScrollRef.current,
    estimateSize: () => resolvedOptionEstimateSize,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const visibleRows = virtualRows.length > 0
    ? virtualRows
    : filteredOptions.map((_, index) => ({
        index,
        start: index * resolvedOptionEstimateSize,
      }));

  const getBoundaryEnabledIndex = useCallback(
    (mode: 'first' | 'last'): number => {
      if (filteredOptions.length === 0) {
        return -1;
      }

      const indexes = mode === 'first'
        ? filteredOptions.map((_, index) => index)
        : filteredOptions.map((_, index) => filteredOptions.length - 1 - index);

      return indexes.find((index) => filteredOptions[index] && !filteredOptions[index].disabled) ?? -1;
    },
    [filteredOptions]
  );

  const moveHighlight = useCallback(
    (direction: 'up' | 'down') => {
      if (filteredOptions.length === 0) {
        return;
      }

      setHighlightedIndex((previousIndex) => {
        const step = direction === 'down' ? 1 : -1;
        const total = filteredOptions.length;
        let nextIndex = previousIndex;

        for (let attempt = 0; attempt < total; attempt += 1) {
          nextIndex = previousIndex < 0
            ? direction === 'down'
              ? attempt
              : total - 1 - attempt
            : (nextIndex + step + total) % total;

          if (!filteredOptions[nextIndex]?.disabled) {
            return nextIndex;
          }
        }

        return -1;
      });
    },
    [filteredOptions]
  );

  const commitCustomValue = useCallback(() => {
    const trimmedSearchTerm = searchTerm.trim();
    if (!allowCustomValue || trimmedSearchTerm === '') {
      return false;
    }

    onChange(trimmedSearchTerm);
    closeDropdown();
    focusTrigger();
    return true;
  }, [allowCustomValue, closeDropdown, focusTrigger, onChange, searchTerm]);

  useEffect(() => {
    if (!isOpen) {
      optionRefs.current = [];
      return;
    }

    if (filteredOptions.length === 0) {
      setHighlightedIndex(-1);
      return;
    }

    const selectedIndex = filteredOptions.findIndex(
      (option) => String(option.value) === normalizedValue && !option.disabled
    );

    let nextIndex = -1;
    if (openHighlightModeRef.current === 'first') {
      nextIndex = getBoundaryEnabledIndex('first');
    } else if (openHighlightModeRef.current === 'last') {
      nextIndex = getBoundaryEnabledIndex('last');
    } else if (selectedIndex >= 0) {
      nextIndex = selectedIndex;
    } else {
      nextIndex = getBoundaryEnabledIndex('first');
    }

    openHighlightModeRef.current = 'default';
    setHighlightedIndex(nextIndex);
  }, [filteredOptions, getBoundaryEnabledIndex, isOpen, normalizedValue]);

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) {
      return;
    }

    rowVirtualizer.scrollToIndex(highlightedIndex, { align: 'auto' });
    optionRefs.current[highlightedIndex]?.scrollIntoView({
      block: 'nearest',
    });
  }, [highlightedIndex, isOpen, rowVirtualizer]);

  useEffect(() => {
    if (!isOpen || !optionsScrollRef.current) {
      return;
    }

    optionsScrollRef.current.scrollTop = 0;
  }, [isOpen, searchTerm]);

  const openDropdown = useCallback(
    (mode: 'default' | 'first' | 'last' = 'default') => {
      if (disabled) {
        return;
      }

      openHighlightModeRef.current = mode;
      setIsOpen(true);
      if (typeof document !== 'undefined') {
        document.dispatchEvent(
          new CustomEvent<SearchableSelectOpenEventDetail>(SEARCHABLE_SELECT_OPEN_EVENT, {
            detail: { id: instanceIdRef.current },
          })
        );
      }
    },
    [disabled]
  );

  const selectOption = useCallback(
    (option: SearchableSelectOption) => {
      if (option.disabled) {
        return;
      }

      onChange(String(option.value));
      closeDropdown();
      focusTrigger();
    },
    [closeDropdown, focusTrigger, onChange]
  );

  const toggleDropdown = useCallback(() => {
    if (disabled) {
      return;
    }

    if (isOpen) {
      closeDropdown();
      return;
    }

    openDropdown();
  }, [closeDropdown, disabled, isOpen, openDropdown]);

  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        moveHighlight('down');
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        moveHighlight('up');
        return;
      }

      if (event.key === 'Enter') {
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].disabled) {
          event.preventDefault();
          event.stopPropagation();
          selectOption(filteredOptions[highlightedIndex]);
          return;
        }

        if (commitCustomValue()) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeDropdown();
      }
    },
    [closeDropdown, commitCustomValue, filteredOptions, highlightedIndex, moveHighlight, selectOption]
  );

  const hasRightAction = Boolean(rightAction);
  const baseTriggerClass = compact
    ? 'relative flex min-w-0 w-full items-center h-9 px-3 rounded border border-slate-200 bg-white text-left text-sm text-slate-900 focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed'
    : 'relative flex min-w-0 w-full items-center h-10 px-3 rounded border border-slate-300 bg-white text-left text-sm text-slate-900 focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed';

  const mergedTriggerClass = `${baseTriggerClass} ${error ? 'border-red-500 ring-1 ring-red-500' : ''} ${selectedOption?.triggerButtonClassName || ''} ${triggerClassName}`.trim();
  const disabledOverlayClassName = compact
    ? 'absolute inset-0 z-10 cursor-not-allowed rounded bg-transparent'
    : 'absolute inset-0 z-10 cursor-not-allowed rounded bg-transparent';

  const resolveOptionClassName = (option: SearchableSelectOption, isSelected: boolean, isHighlighted: boolean): string => {
    const baseClassName = option.disabled
      ? 'cursor-not-allowed text-slate-300'
      : isSelected
      ? 'bg-primary/10 text-primary font-semibold'
      : isHighlighted
      ? 'bg-slate-100 text-slate-900'
      : 'text-slate-700 hover:bg-slate-50';

    return `${compact ? 'block w-full rounded px-3 py-2 text-sm leading-5' : 'block w-full rounded px-3 py-2 text-xs leading-5'} transition-colors ${baseClassName} ${option.optionClassName || ''} ${isSelected ? option.selectedOptionClassName || '' : ''} ${isHighlighted ? option.highlightedOptionClassName || '' : ''}`.trim();
  };

  const renderOptionBody = useCallback(
    (option: SearchableSelectOption, isSelected: boolean, isHighlighted: boolean) => {
      if (renderOptionContent) {
        return renderOptionContent(option, { isSelected, isHighlighted });
      }

      return (
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 flex-1 text-left">{option.label}</span>
          {isSelected ? <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14 }}>check</span> : null}
        </div>
      );
    },
    [renderOptionContent]
  );

  const nonPortalDropdownStyle = useMemo<CSSProperties>(() => {
    if (!portalMinWidth && !portalMaxWidth) {
      return {};
    }

    return {
      minWidth: portalMinWidth,
      maxWidth: portalMaxWidth,
    };
  }, [portalMaxWidth, portalMinWidth]);

  const renderDropdownOptions = useCallback(() => {
    const scrollClassName = `${compact ? 'max-h-48' : 'max-h-60'} overflow-y-auto custom-scrollbar p-1`;

    if (filteredOptions.length === 0) {
      return (
        <div ref={optionsScrollRef} className={scrollClassName}>
          <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-xs text-slate-400">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>search_off</span>
            <span>{noOptionsText}</span>
          </div>
        </div>
      );
    }

    return (
      <div ref={optionsScrollRef} className={scrollClassName}>
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: 'relative',
            width: '100%',
          }}
        >
          {visibleRows.map((virtualRow) => {
            const option = filteredOptions[virtualRow.index];
            if (!option) {
              return null;
            }

            const optionValue = String(option.value);
            const isSelected = optionValue === normalizedValue;
            const isHighlighted = highlightedIndex === virtualRow.index;

            return (
              <button
                key={`${optionValue}-${virtualRow.index}`}
                ref={(node) => {
                  optionRefs.current[virtualRow.index] = node;
                }}
                type="button"
                disabled={option.disabled}
                className={resolveOptionClassName(option, isSelected, isHighlighted)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onMouseEnter={() => {
                  if (!option.disabled) {
                    setHighlightedIndex(virtualRow.index);
                  }
                }}
                onClick={() => selectOption(option)}
              >
                {renderOptionBody(option, isSelected, isHighlighted)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }, [
    compact,
    filteredOptions,
    highlightedIndex,
    noOptionsText,
    normalizedValue,
    renderOptionBody,
    resolveOptionClassName,
    rowVirtualizer,
    selectOption,
    visibleRows,
  ]);

  const setMergedTriggerRef = useCallback((node: HTMLButtonElement | null) => {
    triggerRef.current = node;

    if (!triggerButtonRef) {
      return;
    }

    if (typeof triggerButtonRef === 'function') {
      triggerButtonRef(node);
      return;
    }

    triggerButtonRef.current = node;
  }, [triggerButtonRef]);
  const suppressNextTriggerClickRef = useRef(false);

  return (
    <div ref={wrapperRef} className={`relative ${className}`.trim()}>
      {label ? (
        <label
          id={labelId}
          className={`${denseLabel ? 'mb-1' : 'mb-1'} block text-xs font-semibold text-neutral`}
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      ) : null}

      <div className="relative">
        <button
          ref={setMergedTriggerRef}
          type="button"
          className={mergedTriggerClass}
          onClick={(event) => {
            if (suppressNextTriggerClickRef.current) {
              suppressNextTriggerClickRef.current = false;
              event.preventDefault();
              return;
            }

            toggleDropdown();
          }}
          onKeyDown={(event) => {
            if (disabled) {
              return;
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              event.stopPropagation();
              if (!isOpen) {
                openDropdown('first');
                return;
              }
              moveHighlight('down');
              return;
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              event.stopPropagation();
              if (!isOpen) {
                openDropdown('last');
                return;
              }
              moveHighlight('up');
              return;
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              closeDropdown();
            }

            onTriggerKeyDown?.(event);

            if (event.key === 'Enter' && event.defaultPrevented) {
              suppressNextTriggerClickRef.current = true;
            }
          }}
          disabled={disabled}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={triggerAriaLabel}
          aria-labelledby={label ? labelId : undefined}
        >
          <span
            title={selectedOption?.label || placeholder}
            className={`block min-w-0 w-full truncate ${hasRightAction ? 'pr-16' : 'pr-8'} text-left leading-5 ${selectedOption ? selectedOption.triggerLabelClassName || '' : 'text-slate-400'}`}
          >
            {selectedOption?.label || placeholder}
          </span>
          {hasRightAction ? (
            <span
              className="absolute right-8 top-1/2 -translate-y-1/2 z-10"
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!disabled && !rightAction?.disabled) {
                  rightAction?.onClick();
                }
              }}
              role="button"
              tabIndex={disabled || rightAction?.disabled ? -1 : 0}
              aria-label={rightAction?.label}
              title={rightAction?.label}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!disabled && !rightAction?.disabled) {
                    rightAction?.onClick();
                  }
                }
              }}
            >
              <span
                className={`material-symbols-outlined rounded-full border p-0.5 text-[14px] leading-none transition-colors ${disabled || rightAction?.disabled ? 'cursor-not-allowed border-slate-200 text-slate-300' : 'border-primary/30 text-primary hover:bg-primary/10'}`}
                aria-hidden="true"
              >
                {rightAction?.icon ?? 'add'}
              </span>
            </span>
          ) : null}
          <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={{ fontSize: 16 }}>expand_more</span>
        </button>

        {disabled && onDisabledInteract ? (
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className={disabledOverlayClassName}
            onMouseDown={(event) => {
              event.preventDefault();
              onDisabledInteract();
            }}
          />
        ) : null}
      </div>

      {isOpen ? (
        (canUsePortal ? createPortal(
        <div
          ref={dropdownRef}
          style={portalStyle}
            className={`rounded border border-slate-200 bg-white shadow-2xl overflow-hidden ${dropdownClassName}`.trim()}
        >
          <div className="border-b border-slate-100 bg-slate-50 p-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>search</span>
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  updateSearchTerm(nextValue);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder}
                aria-label={searchInputAriaLabel}
                className="h-9 w-full rounded border border-slate-200 bg-white py-0 pl-8 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                onClick={(event) => event.stopPropagation()}
              />
              {searching ? (
                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-slate-400" style={{ fontSize: 15 }}>
                  progress_activity
                </span>
              ) : null}
            </div>
          </div>

          {renderDropdownOptions()}
        </div>, document.body
        ) : <div
          ref={dropdownRef}
          style={nonPortalDropdownStyle}
          className={`absolute left-0 z-[120] w-full rounded border border-slate-200 bg-white shadow-2xl overflow-hidden ${
            openDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
          } ${dropdownClassName}`.trim()}
        >
          <div className="border-b border-slate-100 bg-slate-50 p-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>search</span>
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  updateSearchTerm(nextValue);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder}
                aria-label={searchInputAriaLabel}
                className="h-9 w-full rounded border border-slate-200 bg-white py-0 pl-8 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                onClick={(event) => event.stopPropagation()}
              />
              {searching ? (
                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-slate-400" style={{ fontSize: 15 }}>
                  progress_activity
                </span>
              ) : null}
            </div>
          </div>

          {renderDropdownOptions()}
        </div>)
      ) : null}

      {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}
    </div>
  );
});
