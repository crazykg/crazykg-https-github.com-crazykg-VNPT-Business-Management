import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { createPortal } from 'react-dom';

export interface SearchableMultiSelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  searchText?: string;
}

export interface SearchableMultiSelectAsyncLoadParams {
  page: number;
  perPage: number;
  query: string;
  selectedValues: string[];
}

export interface SearchableMultiSelectAsyncLoadResult {
  options: SearchableMultiSelectOption[];
  hasMore?: boolean;
}

interface SearchableMultiSelectProps {
  values: Array<string | number>;
  options: SearchableMultiSelectOption[];
  onChange: (values: string[]) => void;
  ariaLabel?: string;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  searchPlaceholder?: string;
  noOptionsText?: string;
  showSelectedChips?: boolean;
  selectedSummaryFormatter?: (selectedOptions: SearchableMultiSelectOption[]) => string;
  usePortal?: boolean;
  portalZIndex?: number;
  asyncLoader?: (
    params: SearchableMultiSelectAsyncLoadParams
  ) => Promise<SearchableMultiSelectAsyncLoadResult>;
  asyncDebounceMs?: number;
  asyncPerPage?: number;
}

const normalizeToken = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const SearchableMultiSelect: React.FC<SearchableMultiSelectProps> = React.memo(function SearchableMultiSelectComponent({
  values,
  options,
  onChange,
  ariaLabel,
  placeholder = 'Chọn...',
  label,
  error,
  disabled = false,
  className = '',
  triggerClassName = '',
  dropdownClassName = '',
  searchPlaceholder = 'Tìm kiếm...',
  noOptionsText = 'Không tìm thấy kết quả',
  showSelectedChips = true,
  selectedSummaryFormatter,
  usePortal = true,
  portalZIndex = 2000,
  asyncLoader,
  asyncDebounceMs = 300,
  asyncPerPage = 30,
}) {
  const dropdownComfortHeight = 220;
  const dropdownIdealHeight = 320;
  const dropdownViewportPadding = 12;
  const dropdownHeaderHeight = 56;
  const dropdownMinOptionsHeight = 96;
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDirection, setOpenDirection] = useState<'up' | 'down'>('down');
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({});
  const [optionsMaxHeight, setOptionsMaxHeight] = useState(240);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const asyncRequestIdRef = useRef(0);
  const canUsePortal = usePortal && typeof document !== 'undefined';
  const isAsync = typeof asyncLoader === 'function';
  const [asyncOptions, setAsyncOptions] = useState<SearchableMultiSelectOption[]>([]);
  const [asyncPage, setAsyncPage] = useState(1);
  const [asyncHasMore, setAsyncHasMore] = useState(false);
  const [isLoadingAsyncOptions, setIsLoadingAsyncOptions] = useState(false);
  const externalOptionsRef = useRef(options);
  const selectedValuesRef = useRef((values || []).map(String));

  useEffect(() => {
    externalOptionsRef.current = options;
  }, [options]);

  useEffect(() => {
    selectedValuesRef.current = (values || []).map(String);
  }, [values]);

  const selectedSet = useMemo(() => new Set((values || []).map((item) => String(item))), [values]);
  const mergedOptions = useMemo(() => {
    const dedup = new Map<string, SearchableMultiSelectOption>();

    [...options, ...asyncOptions].forEach((option) => {
      dedup.set(String(option.value), option);
    });

    return Array.from(dedup.values());
  }, [asyncOptions, options]);
  const activeOptions = isAsync ? mergedOptions : options;
  const selectedOptions = useMemo(() => {
    const optionMap = new Map(activeOptions.map((option) => [String(option.value), option]));
    return (values || [])
      .map((item) => optionMap.get(String(item)))
      .filter((option): option is SearchableMultiSelectOption => Boolean(option));
  }, [activeOptions, values]);
  const selectedValuesKey = useMemo(
    () => (values || []).map(String).slice().sort().join('|'),
    [values]
  );

  const loadAsyncOptions = useCallback(async (
    page: number,
    query: string,
    mode: 'replace' | 'append'
  ) => {
    if (!asyncLoader) {
      return;
    }

    const requestId = ++asyncRequestIdRef.current;
    setIsLoadingAsyncOptions(true);

    try {
      const result = await asyncLoader({
        page,
        perPage: asyncPerPage,
        query,
        selectedValues: selectedValuesRef.current,
      });

      if (requestId !== asyncRequestIdRef.current) {
        return;
      }

      setAsyncHasMore(Boolean(result.hasMore));
      setAsyncPage(page);
      setAsyncOptions((previous) => {
        const dedup = new Map<string, SearchableMultiSelectOption>();
        const source = mode === 'append'
          ? [...externalOptionsRef.current, ...previous, ...result.options]
          : [...externalOptionsRef.current, ...result.options];

        source.forEach((option) => {
          dedup.set(String(option.value), option);
        });

        return Array.from(dedup.values());
      });
    } finally {
      if (requestId === asyncRequestIdRef.current) {
        setIsLoadingAsyncOptions(false);
      }
    }
  }, [asyncLoader, asyncPerPage]);

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

    const viewportMaxWidth = Math.max(220, window.innerWidth - 16);
    const width = Math.min(viewportMaxWidth, Math.max(rect.width, 280));
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
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedTrigger = wrapperRef.current?.contains(target);
      const clickedDropdown = dropdownRef.current?.contains(target);
      if (!clickedTrigger && !clickedDropdown) {
        setIsOpen(false);
      }
    };
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
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !optionsScrollRef.current) {
      return;
    }

    optionsScrollRef.current.scrollTop = 0;
  }, [isOpen, searchTerm]);

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

  useEffect(() => {
    if (!isAsync || !isOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadAsyncOptions(1, searchTerm.trim(), 'replace');
    }, asyncDebounceMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [asyncDebounceMs, isAsync, isOpen, loadAsyncOptions, searchTerm, selectedValuesKey]);

  useEffect(() => {
    if (!isAsync || isOpen || selectedOptions.length === values.length) {
      return;
    }

    void loadAsyncOptions(1, '', 'replace');
  }, [isAsync, isOpen, loadAsyncOptions, selectedOptions.length, values.length, selectedValuesKey]);

  const filteredOptions = useMemo(() => {
    const keyword = normalizeToken(searchTerm);
    if (!keyword) {
      return activeOptions;
    }

    return activeOptions.filter((option) => {
      const haystack = normalizeToken(option.searchText ?? `${option.label} ${option.value}`);
      return haystack.includes(keyword);
    });
  }, [activeOptions, searchTerm]);

  const handleOptionsScroll = useCallback(() => {
    if (!isAsync || isLoadingAsyncOptions || !asyncHasMore || !optionsScrollRef.current) {
      return;
    }

    const container = optionsScrollRef.current;
    const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;

    if (remaining > 48) {
      return;
    }

    void loadAsyncOptions(asyncPage + 1, searchTerm.trim(), 'append');
  }, [asyncHasMore, asyncPage, isAsync, isLoadingAsyncOptions, loadAsyncOptions, searchTerm]);

  const rowVirtualizer = useVirtualizer({
    count: filteredOptions.length,
    getScrollElement: () => optionsScrollRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const visibleRows = virtualRows.length > 0
    ? virtualRows
    : filteredOptions.map((_, index) => ({
        index,
        start: index * 64,
      }));

  const toggleOption = (optionValue: string) => {
    if (selectedSet.has(optionValue)) {
      onChange((values || []).map(String).filter((value) => value !== optionValue));
      return;
    }
    onChange([...(values || []).map(String), optionValue]);
  };

  const summaryText = selectedOptions.length
    ? selectedSummaryFormatter
      ? selectedSummaryFormatter(selectedOptions)
      : selectedOptions.length === 1
      ? selectedOptions[0].label
      : `Đã chọn ${selectedOptions.length}`
    : placeholder;

  const hasCustomTriggerHeight = /\b(?:h-|min-h-)/.test(triggerClassName);
  const baseTriggerClass =
    `w-full rounded-[var(--ui-control-radius)] border border-slate-300 bg-white text-left text-sm text-slate-900 transition focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${
      hasCustomTriggerHeight ? 'px-2.5 py-0' : 'min-h-[44px] px-4 py-2'
    }`;
  const mergedTriggerClass = `${baseTriggerClass} ${error ? 'border-red-500 ring-1 ring-red-500' : ''} ${triggerClassName}`.trim();

  return (
    <div ref={wrapperRef} className={`relative ${className}`.trim()}>
      {label ? <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">{label}</label> : null}

      <button
        type="button"
        aria-label={ariaLabel || label || placeholder}
        className={mergedTriggerClass}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={`line-clamp-1 ${selectedOptions.length ? 'text-slate-900' : 'text-slate-400'}`}>{summaryText}</span>
          <span aria-hidden="true" className="material-symbols-outlined text-slate-400 text-[20px]">expand_more</span>
        </div>
      </button>

      {showSelectedChips && selectedOptions.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {selectedOptions.slice(0, 3).map((option) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => toggleOption(String(option.value))}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20"
            >
              <span className="line-clamp-1 max-w-[200px]">{option.label}</span>
              <span aria-hidden="true" className="material-symbols-outlined text-xs">close</span>
            </button>
          ))}
          {selectedOptions.length > 3 ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
              +{selectedOptions.length - 3}
            </span>
          ) : null}
        </div>
      ) : null}

      {isOpen ? (
        (canUsePortal ? createPortal(
          <div
            ref={dropdownRef}
            style={portalStyle}
            className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl ${dropdownClassName}`.trim()}
          >
            <div className="border-b border-slate-100 bg-slate-50 p-2">
              <div className="relative">
                <span aria-hidden="true" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
            </div>
            <div
              ref={optionsScrollRef}
              onScroll={handleOptionsScroll}
              className="overflow-y-auto p-1 custom-scrollbar"
              style={{ maxHeight: optionsMaxHeight }}
            >
              {filteredOptions.length > 0 ? (
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
                    const isSelected = selectedSet.has(optionValue);

                    return (
                      <button
                        key={optionValue}
                        type="button"
                        disabled={option.disabled}
                        className={`flex min-h-16 items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm leading-5 transition-colors ${
                          option.disabled
                            ? 'cursor-not-allowed text-slate-300'
                            : isSelected
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        onClick={() => {
                          if (option.disabled) {
                            return;
                          }
                          toggleOption(optionValue);
                        }}
                      >
                        <span className="line-clamp-2 min-w-0 flex-1 text-left">{option.label}</span>
                        {isSelected ? <span aria-hidden="true" className="material-symbols-outlined text-sm">check</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : isLoadingAsyncOptions ? (
                <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-400">
                  <span aria-hidden="true" className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                  <span>Đang tải dữ liệu...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-slate-400">
                  <span aria-hidden="true" className="material-symbols-outlined text-2xl">search_off</span>
                  <span>{noOptionsText}</span>
                </div>
              )}
              {filteredOptions.length > 0 && isLoadingAsyncOptions ? (
                <div className="px-3 py-2 text-xs font-semibold text-slate-400">Đang tải thêm...</div>
              ) : null}
            </div>
          </div>,
          document.body
        ) : (
          <div
            ref={dropdownRef}
            className={`absolute left-0 z-[120] w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl ${
              openDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
            } ${dropdownClassName}`.trim()}
          >
          <div className="border-b border-slate-100 bg-slate-50 p-2">
            <div className="relative">
              <span aria-hidden="true" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          </div>
          <div
            ref={optionsScrollRef}
            onScroll={handleOptionsScroll}
            className="overflow-y-auto p-1 custom-scrollbar"
            style={{ maxHeight: optionsMaxHeight }}
          >
            {filteredOptions.length > 0 ? (
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
                  const isSelected = selectedSet.has(optionValue);

                  return (
                    <button
                      key={optionValue}
                      type="button"
                      disabled={option.disabled}
                      className={`flex min-h-16 items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm leading-5 transition-colors ${
                        option.disabled
                          ? 'cursor-not-allowed text-slate-300'
                          : isSelected
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      onClick={() => {
                        if (option.disabled) {
                          return;
                        }
                        toggleOption(optionValue);
                      }}
                    >
                      <span className="line-clamp-2 min-w-0 flex-1 text-left">{option.label}</span>
                      {isSelected ? <span aria-hidden="true" className="material-symbols-outlined text-sm">check</span> : null}
                    </button>
                  );
                })}
              </div>
            ) : isLoadingAsyncOptions ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-400">
                <span aria-hidden="true" className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                <span>Đang tải dữ liệu...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-slate-400">
                <span aria-hidden="true" className="material-symbols-outlined text-2xl">search_off</span>
                <span>{noOptionsText}</span>
              </div>
            )}
            {filteredOptions.length > 0 && isLoadingAsyncOptions ? (
              <div className="px-3 py-2 text-xs font-semibold text-slate-400">Đang tải thêm...</div>
            ) : null}
          </div>
          </div>
        ))
      ) : null}

      {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}
    </div>
  );
});
