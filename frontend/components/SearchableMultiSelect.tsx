import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface SearchableMultiSelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  searchText?: string;
}

interface SearchableMultiSelectProps {
  values: Array<string | number>;
  options: SearchableMultiSelectOption[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  searchPlaceholder?: string;
  noOptionsText?: string;
}

const normalizeToken = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const SearchableMultiSelect: React.FC<SearchableMultiSelectProps> = ({
  values,
  options,
  onChange,
  placeholder = 'Chọn...',
  label,
  error,
  disabled = false,
  className = '',
  triggerClassName = '',
  dropdownClassName = '',
  searchPlaceholder = 'Tìm kiếm...',
  noOptionsText = 'Không tìm thấy kết quả',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDirection, setOpenDirection] = useState<'up' | 'down'>('down');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(() => new Set((values || []).map((item) => String(item))), [values]);
  const selectedOptions = useMemo(
    () => options.filter((option) => selectedSet.has(String(option.value))),
    [options, selectedSet]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
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

    const rect = wrapperRef.current.getBoundingClientRect();
    const estimatedDropdownHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow) {
      setOpenDirection('up');
      return;
    }

    setOpenDirection('down');
  }, [isOpen, options.length]);

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

  const toggleOption = (optionValue: string) => {
    if (selectedSet.has(optionValue)) {
      onChange((values || []).map(String).filter((value) => value !== optionValue));
      return;
    }
    onChange([...(values || []).map(String), optionValue]);
  };

  const summaryText = selectedOptions.length
    ? selectedOptions.length === 1
      ? selectedOptions[0].label
      : `Đã chọn ${selectedOptions.length}`
    : placeholder;

  const baseTriggerClass =
    'w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-left text-sm text-slate-900 transition focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed';
  const mergedTriggerClass = `${baseTriggerClass} ${error ? 'border-red-500 ring-1 ring-red-500' : ''} ${triggerClassName}`.trim();

  return (
    <div ref={wrapperRef} className={`relative ${className}`.trim()}>
      {label ? <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">{label}</label> : null}

      <button
        type="button"
        className={mergedTriggerClass}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={`line-clamp-1 ${selectedOptions.length ? 'text-slate-900' : 'text-slate-400'}`}>{summaryText}</span>
          <span className="material-symbols-outlined text-slate-400 text-[20px]">expand_more</span>
        </div>
      </button>

      {selectedOptions.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {selectedOptions.slice(0, 3).map((option) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => toggleOption(String(option.value))}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20"
            >
              <span className="line-clamp-1 max-w-[200px]">{option.label}</span>
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

      {isOpen ? (
        <div
          className={`absolute left-0 z-[120] w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl ${
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
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const optionValue = String(option.value);
                const isSelected = selectedSet.has(optionValue);

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
                      toggleOption(optionValue);
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
        </div>
      ) : null}

      {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}
    </div>
  );
};

