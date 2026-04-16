import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  labelClassName?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  compact?: boolean;
  size?: 'sm';
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  usePortal?: boolean;
  portalZIndex?: number;
  renderOptionContent?: (
    option: SearchableSelectOption,
    state: { isSelected: boolean; isHighlighted: boolean }
  ) => React.ReactNode;
  renderDropdownHeader?: React.ReactNode;
  triggerButtonRef?: React.Ref<HTMLDivElement>;
  onTriggerKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}

const normalizeSearchableSelectToken = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder = 'Tìm kiếm...',
  label,
  labelClassName,
  error,
  required,
  disabled,
  compact = false,
  size,
  className,
  triggerClassName,
  dropdownClassName,
  usePortal = true,
  portalZIndex = 220,
  renderOptionContent,
  renderDropdownHeader,
  triggerButtonRef,
  onTriggerKeyDown,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openDirection, setOpenDirection] = useState<'up' | 'down'>('down');
  const [searchTerm, setSearchTerm] = useState('');
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({});
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const highlightedIndexRef = useRef(-1);
  const openHighlightModeRef = useRef<'default' | 'first' | 'last'>('default');
  const canUsePortal = usePortal && typeof document !== 'undefined';
  const normalizedValue = String(value ?? '');
  const isSmall = size === 'sm';

  const updateHighlightedIndex = useCallback((nextIndex: number) => {
    highlightedIndexRef.current = nextIndex;
    setHighlightedIndex(nextIndex);
  }, []);

  const syncPortalPlacement = useCallback(() => {
    if (!canUsePortal || !isOpen || !wrapperRef.current) {
      return;
    }

    const rect = wrapperRef.current.getBoundingClientRect();
    const estimatedDropdownHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const nextDirection = spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow ? 'up' : 'down';

    setOpenDirection(nextDirection);

    const width = Math.max(rect.width, 280);
    const maxLeft = Math.max(8, window.innerWidth - width - 8);
    const left = Math.min(Math.max(8, rect.left), maxLeft);

    const nextStyle: React.CSSProperties = {
      position: 'fixed',
      left,
      width,
      zIndex: portalZIndex,
    };

    if (nextDirection === 'up') {
      nextStyle.bottom = window.innerHeight - rect.top + 6;
    } else {
      nextStyle.top = rect.bottom + 6;
    }

    setPortalStyle(nextStyle);
  }, [canUsePortal, isOpen, portalZIndex]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchTerm('');
    updateHighlightedIndex(-1);
    openHighlightModeRef.current = 'default';
  }, [updateHighlightedIndex]);
  const setMergedTriggerRef = useCallback(
    (node: HTMLDivElement | null) => {
      triggerRef.current = node;

      if (!triggerButtonRef) {
        return;
      }

      if (typeof triggerButtonRef === 'function') {
        triggerButtonRef(node);
        return;
      }

      (
        triggerButtonRef as React.MutableRefObject<HTMLDivElement | null>
      ).current = node;
    },
    [triggerButtonRef]
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const clickedTrigger = wrapperRef.current?.contains(target);
      const clickedDropdown = dropdownRef.current?.contains(target);
      if (!clickedTrigger && !clickedDropdown) {
        closeDropdown();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeDropdown]);

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
    const estimatedDropdownHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow) {
      setOpenDirection('up');
      return;
    }

    setOpenDirection('down');
  }, [canUsePortal, isOpen, options.length, syncPortalPlacement]);

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
  }, [canUsePortal, isOpen, options.length, searchTerm, syncPortalPlacement]);

  const filteredOptions = useMemo(() => {
    return (options || []).filter((opt) => {
      const normalizedKeyword = normalizeSearchableSelectToken(searchTerm);
      if (!normalizedKeyword) {
        return true;
      }

      const haystack = normalizeSearchableSelectToken(opt.searchText ?? `${opt.label} ${opt.value}`);
      return haystack.includes(normalizedKeyword);
    });
  }, [options, searchTerm]);

  const getBoundaryEnabledIndex = useCallback((mode: 'first' | 'last') => {
    if (filteredOptions.length === 0) {
      return -1;
    }

    const indexes = mode === 'first'
      ? filteredOptions.map((_, index) => index)
      : filteredOptions.map((_, index) => filteredOptions.length - 1 - index);

    return indexes.find((index) => filteredOptions[index] && !filteredOptions[index].disabled) ?? -1;
  }, [filteredOptions]);

  useEffect(() => {
    if (!isOpen) {
      optionRefs.current = [];
      return;
    }

    if (filteredOptions.length === 0) {
      updateHighlightedIndex(-1);
      return;
    }

    const selectedIndex = filteredOptions.findIndex(
      (opt) => String(opt.value) === normalizedValue && !opt.disabled
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
    updateHighlightedIndex(nextIndex);
  }, [filteredOptions, getBoundaryEnabledIndex, isOpen, normalizedValue, updateHighlightedIndex]);

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) {
      return;
    }

    optionRefs.current[highlightedIndex]?.scrollIntoView({
      block: 'nearest',
    });
  }, [highlightedIndex, isOpen]);

  const selectOption = useCallback((option: SearchableSelectOption) => {
    if (option.disabled) {
      return;
    }

    onChange(String(option.value));
    closeDropdown();
    triggerRef.current?.focus();
    queueMicrotask(() => {
      triggerRef.current?.focus();
    });
    window.requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, [closeDropdown, onChange]);

  const selectedOption = (options || []).find((opt) => String(opt.value) === normalizedValue);
  const currentLabel = selectedOption?.label || value;

  const moveHighlight = useCallback((direction: 'up' | 'down') => {
    if (filteredOptions.length === 0) {
      return;
    }

    const previousIndex = highlightedIndexRef.current;
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
        updateHighlightedIndex(nextIndex);
        return;
      }
    }

    updateHighlightedIndex(-1);
  }, [filteredOptions, updateHighlightedIndex]);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
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
      const currentHighlightedIndex = highlightedIndexRef.current;
      if (currentHighlightedIndex >= 0 && filteredOptions[currentHighlightedIndex] && !filteredOptions[currentHighlightedIndex].disabled) {
        event.preventDefault();
        event.stopPropagation();
        selectOption(filteredOptions[currentHighlightedIndex]);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeDropdown();
    }
  };

  const openDropdown = useCallback((mode: 'default' | 'first' | 'last' = 'default') => {
    if (disabled) {
      return;
    }

    openHighlightModeRef.current = mode;
    setIsOpen(true);
  }, [disabled]);

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

  const dropdownContent = (
    <div
      ref={dropdownRef}
      style={canUsePortal ? portalStyle : undefined}
      className={`${
        canUsePortal
          ? 'rounded-lg bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col animate-fade-in ring-1 ring-slate-900/5'
          : `absolute left-0 z-[130] w-full bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden flex flex-col animate-fade-in ring-1 ring-slate-900/5 ${
              openDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
            }`
      } ${dropdownClassName || ''}`}
    >
      <div className="p-2 border-b border-slate-100 bg-slate-50">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input
            ref={inputRef}
            type="text"
            className={`w-full pl-9 pr-3 border border-slate-300 rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-slate-900 placeholder:text-slate-400 shadow-sm ${
              isSmall ? 'py-1.5 text-xs' : 'py-2.5 text-[15px]'
            }`}
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              updateHighlightedIndex(getBoundaryEnabledIndex('first'));
            }}
            onKeyDown={handleSearchKeyDown}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      </div>
      {renderDropdownHeader ? (
        <div className="border-b border-slate-100 bg-slate-50/80">
          {renderDropdownHeader}
        </div>
      ) : null}
      <div className="overflow-y-auto max-h-72 p-1 custom-scrollbar">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((opt, index) => {
            const isSelected = normalizedValue === String(opt.value);
            const isHighlighted = highlightedIndex === index;

            return (
              <button
                key={String(opt.value)}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                type="button"
                className={`w-full px-3 rounded-md cursor-pointer transition-colors ${
                  isSmall ? 'py-2 text-xs' : 'py-2.5 text-[15px]'
                } ${
                  isSelected
                    ? opt.selectedOptionClassName || 'bg-primary/10 text-primary font-semibold'
                    : isHighlighted
                      ? opt.highlightedOptionClassName || 'bg-slate-100 text-slate-900'
                      : opt.optionClassName || 'text-slate-700 hover:bg-slate-50'
                }`}
                onMouseEnter={() => updateHighlightedIndex(index)}
                onClick={() => selectOption(opt)}
              >
                {renderOptionContent ? (
                  renderOptionContent(opt, { isSelected, isHighlighted })
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate pr-2 text-left" title={opt.label}>{opt.label}</span>
                    {isSelected ? <span className="material-symbols-outlined text-sm flex-shrink-0">check</span> : null}
                  </div>
                )}
              </button>
            );
          })
        ) : (
          <div className="px-4 py-8 text-sm text-slate-400 text-center flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-2xl">search_off</span>
            <span>Không tìm thấy kết quả</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`col-span-1 flex flex-col gap-1 relative ${isOpen ? 'z-[110]' : 'z-10'} ${className || ''}`} ref={wrapperRef}>
      {label ? (
        <label className={labelClassName || 'text-xs font-semibold text-neutral'}>
          {label} {required ? <span className="text-red-500">*</span> : null}
        </label>
      ) : null}
      <div
        ref={setMergedTriggerRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`w-full ${size === 'sm' ? 'h-8 px-3 rounded' : compact ? 'h-10 px-3.5 rounded-md' : 'h-[46px] px-4 rounded-lg'} border bg-white flex items-center gap-2 cursor-pointer transition-all ${
          disabled
            ? 'bg-slate-50 cursor-not-allowed text-slate-400 border-slate-200'
            : error
              ? 'border-red-500 ring-1 ring-red-500'
              : 'border-slate-300 hover:border-primary focus:ring-2 focus:ring-primary focus:border-primary'
        } ${selectedOption?.triggerButtonClassName || ''} ${triggerClassName || ''}`}
        onClick={toggleDropdown}
        onKeyDown={(event) => {
          if (disabled) {
            return;
          }

          onTriggerKeyDown?.(event);
          if (event.defaultPrevented) {
            return;
          }

          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            toggleDropdown();
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
        }}
      >
        <span
          className={`${size === 'sm' ? 'text-xs' : 'text-[15px]'} min-w-0 flex-1 truncate ${value ? selectedOption?.triggerLabelClassName || 'text-slate-900' : 'text-slate-400'}`}
          title={String(currentLabel || placeholder || 'Chọn...')}
        >
          {currentLabel || placeholder || 'Chọn...'}
        </span>
        <span className="material-symbols-outlined text-slate-400 text-[20px] flex-shrink-0">expand_more</span>
      </div>

      {isOpen ? (canUsePortal ? createPortal(dropdownContent, document.body) : dropdownContent) : null}
      {error ? <p className="mt-0.5 flex items-center gap-1 animate-fade-in text-xs text-red-500"><span className="material-symbols-outlined text-[14px]">error</span>{error}</p> : null}
    </div>
  );
};

export interface SearchableMultiSelectProps {
  options: { value: string; label: string }[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  labelClassName?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  usePortal?: boolean;
  portalZIndex?: number;
}

export const SearchableMultiSelect: React.FC<SearchableMultiSelectProps> = ({
  options,
  values,
  onChange,
  placeholder,
  searchPlaceholder = 'Tìm kiếm...',
  label,
  labelClassName,
  error,
  required,
  disabled,
  usePortal = true,
  portalZIndex = 220,
}) => {
  const dropdownComfortHeight = 220;
  const dropdownIdealHeight = 320;
  const dropdownViewportPadding = 12;
  const dropdownHeaderHeight = 56;
  const dropdownMinOptionsHeight = 96;
  const [isOpen, setIsOpen] = useState(false);
  const [openDirection, setOpenDirection] = useState<'up' | 'down'>('down');
  const [searchTerm, setSearchTerm] = useState('');
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({});
  const [optionsMaxHeight, setOptionsMaxHeight] = useState(240);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canUsePortal = usePortal && typeof document !== 'undefined';

  const resolveDropdownPlacement = useCallback(() => {
    if (!wrapperRef.current) {
      return null;
    }

    const rect = wrapperRef.current.getBoundingClientRect();
    const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - dropdownViewportPadding);
    const spaceAbove = Math.max(0, rect.top - dropdownViewportPadding);
    const shouldOpenUp =
      (spaceBelow < dropdownComfortHeight && spaceAbove > spaceBelow)
      || (spaceBelow < dropdownHeaderHeight + dropdownMinOptionsHeight && spaceAbove > spaceBelow);
    const nextDirection: 'up' | 'down' = shouldOpenUp ? 'up' : 'down';
    const availableSpace = nextDirection === 'up' ? spaceAbove : spaceBelow;
    const nextOptionsMaxHeight = Math.max(
      dropdownMinOptionsHeight,
      Math.min(dropdownIdealHeight - dropdownHeaderHeight, availableSpace - dropdownHeaderHeight)
    );

    return {
      rect,
      direction: nextDirection,
      optionsHeight: nextOptionsMaxHeight,
    };
  }, [dropdownComfortHeight, dropdownHeaderHeight, dropdownIdealHeight, dropdownMinOptionsHeight, dropdownViewportPadding]);

  const syncPortalPlacement = useCallback(() => {
    if (!canUsePortal || !isOpen) {
      return;
    }

    const placement = resolveDropdownPlacement();
    if (!placement) {
      return;
    }

    const { rect, direction, optionsHeight } = placement;
    setOpenDirection(direction);
    setOptionsMaxHeight(optionsHeight);

    const width = Math.max(rect.width, 320);
    const maxLeft = Math.max(8, window.innerWidth - width - 8);
    const left = Math.min(Math.max(8, rect.left), maxLeft);

    const nextStyle: React.CSSProperties = {
      position: 'fixed',
      left,
      width,
      zIndex: portalZIndex,
    };

    if (direction === 'up') {
      nextStyle.bottom = window.innerHeight - rect.top + 6;
    } else {
      nextStyle.top = rect.bottom + 6;
    }

    setPortalStyle(nextStyle);
  }, [canUsePortal, isOpen, portalZIndex, resolveDropdownPlacement]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const clickedTrigger = wrapperRef.current?.contains(target);
      const clickedDropdown = dropdownRef.current?.contains(target);
      if (!clickedTrigger && !clickedDropdown) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || !wrapperRef.current) {
      return;
    }

    if (canUsePortal) {
      syncPortalPlacement();
      return;
    }

    const placement = resolveDropdownPlacement();
    if (!placement) {
      return;
    }

    setOpenDirection(placement.direction);
    setOptionsMaxHeight(placement.optionsHeight);
  }, [canUsePortal, isOpen, options.length, resolveDropdownPlacement, syncPortalPlacement]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

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
  }, [canUsePortal, isOpen, options.length, searchTerm, syncPortalPlacement]);

  const selectedSet = useMemo(() => new Set((values || []).map((item) => String(item))), [values]);
  const selectedOptions = useMemo(
    () => (options || []).filter((option) => selectedSet.has(option.value)),
    [options, selectedSet]
  );
  const filteredOptions = useMemo(
    () =>
      (options || []).filter((opt) =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [options, searchTerm]
  );

  const toggleOption = (optionValue: string) => {
    const normalized = String(optionValue);
    if (selectedSet.has(normalized)) {
      onChange((values || []).filter((item) => String(item) !== normalized));
      return;
    }

    onChange([...(values || []), normalized]);
  };

  const summary = selectedOptions.length
    ? selectedOptions.length === 1
      ? selectedOptions[0].label
      : `Đã chọn ${selectedOptions.length} sản phẩm`
    : placeholder || 'Chọn sản phẩm';

  const dropdownContent = (
    <div
      ref={dropdownRef}
      style={canUsePortal ? portalStyle : undefined}
      className={`${
        canUsePortal
          ? 'rounded-lg bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col animate-fade-in ring-1 ring-slate-900/5'
          : `absolute left-0 w-full bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden flex flex-col animate-fade-in ring-1 ring-slate-900/5 ${
              openDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
            }`
      }`}
    >
      <div className="p-2 border-b border-slate-100 bg-slate-50">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input
            ref={inputRef}
            type="text"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-slate-900 placeholder:text-slate-400 shadow-sm"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      </div>
      <div className="overflow-y-auto p-1 custom-scrollbar" style={{ maxHeight: optionsMaxHeight }}>
        {filteredOptions.length > 0 ? (
          filteredOptions.map((opt) => {
            const checked = selectedSet.has(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                className={`w-full px-3 py-2.5 text-sm rounded-md transition-colors flex items-center justify-between ${
                  checked ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-700 hover:bg-slate-50'
                }`}
                onClick={() => toggleOption(opt.value)}
              >
                <span className="text-left">{opt.label}</span>
                <span className="material-symbols-outlined text-sm">{checked ? 'check_box' : 'check_box_outline_blank'}</span>
              </button>
            );
          })
        ) : (
          <div className="px-4 py-8 text-sm text-slate-400 text-center flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-2xl">search_off</span>
            <span>Không tìm thấy kết quả</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`col-span-1 flex flex-col gap-1.5 relative ${isOpen ? 'z-[90]' : 'z-10'}`} ref={wrapperRef}>
      {label ? (
        <label className={labelClassName || 'block text-sm font-semibold text-slate-700'}>
          {label} {required ? <span className="text-red-500">*</span> : null}
        </label>
      ) : null}
      <div
        className={`w-full min-h-[46px] px-4 rounded-lg border bg-white flex items-center justify-between cursor-pointer transition-all ${
          disabled
            ? 'bg-slate-50 cursor-not-allowed text-slate-400 border-slate-200'
            : error
              ? 'border-red-500 ring-1 ring-red-500'
              : 'border-slate-300 hover:border-primary focus:ring-2 focus:ring-primary focus:border-primary'
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={`text-sm line-clamp-1 ${selectedOptions.length ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
          {summary}
        </span>
        <span className="material-symbols-outlined text-slate-400 text-[20px]">expand_more</span>
      </div>

      {selectedOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedOptions.slice(0, 3).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleOption(opt.value)}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              <span className="line-clamp-1 max-w-[180px]">{opt.label}</span>
              <span className="material-symbols-outlined text-xs">close</span>
            </button>
          ))}
          {selectedOptions.length > 3 ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
              +{selectedOptions.length - 3}
            </span>
          ) : null}
        </div>
      ) : null}

      {isOpen ? (canUsePortal ? createPortal(dropdownContent, document.body) : dropdownContent) : null}
      {error ? <p className="mt-0.5 flex items-center gap-1 animate-fade-in text-xs text-red-500"><span className="material-symbols-outlined text-[14px]">error</span>{error}</p> : null}
    </div>
  );
};

export const FormSelect = ({ label, labelClassName, size, value, onChange, options, disabled, required, error }: any) => (
  <SearchableSelect
    label={label}
    labelClassName={labelClassName}
    size={size}
    required={required}
    value={value === null || value === undefined ? '' : String(value)}
    disabled={disabled}
    error={error}
    options={(options || []).map((option: any) => ({
      value: String(option.value ?? ''),
      label: String(option.label ?? option.value ?? ''),
    }))}
    onChange={(nextValue) => onChange?.({ target: { value: nextValue } })}
    placeholder="Chọn..."
  />
);
