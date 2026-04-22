import React, { useEffect, useRef, useState } from 'react';
import { resolveStatusMeta } from './presentation';

type SearchResultItem = {
  id: number;
  request_code: string;
  summary: string | null;
  current_status_code: string | null;
  customer_name?: string | null;
};

type CustomerRequestSearchBarProps = {
  onSelect: (item: { id: number; request_code: string; summary: string | null; current_status_code: string | null }) => void;
  placeholder?: string;
  className?: string;
};

const DEBOUNCE_MS = 300;
const MIN_QUERY_LEN = 2;

export const CustomerRequestSearchBar: React.FC<CustomerRequestSearchBarProps> = ({
  onSelect,
  placeholder = 'Tìm yêu cầu theo mã, tiêu đề, người xử lý...',
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length < MIN_QUERY_LEN) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query.trim() });
        const res = await fetch(`/api/v5/customer-request-cases/search?${params.toString()}`, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const json = (await res.json()) as { data?: SearchResultItem[] };
          setResults(json.data ?? []);
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const handleSelect = (item: SearchResultItem) => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
    onSelect(item);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        handleSelect(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const showDropdown = isOpen && query.trim().length >= MIN_QUERY_LEN;

  return (
    <div className={`relative ${className}`}>
      <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[18px] text-slate-400">
        search
      </span>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 150);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
      />

      {showDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {isLoading ? (
            <p className="px-4 py-3 text-sm text-slate-400">Đang tìm...</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">Không tìm thấy kết quả.</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {results.map((item, idx) => {
                const code = item.current_status_code ?? '';
                const meta = resolveStatusMeta(code);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50 ${
                        idx === activeIndex ? 'bg-slate-50' : ''
                      }`}
                      onMouseDown={() => handleSelect(item)}
                    >
                      <span className="mt-0.5 font-mono text-xs font-semibold text-slate-600">
                        {item.request_code}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-800">
                          {item.summary ?? '(không có tiêu đề)'}
                        </p>
                        {item.customer_name && (
                          <p className="truncate text-xs text-slate-400">{item.customer_name}</p>
                        )}
                      </div>
                      <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
