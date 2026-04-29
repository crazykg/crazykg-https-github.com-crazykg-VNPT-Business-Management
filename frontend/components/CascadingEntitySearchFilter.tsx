import React, { Ref, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Customer, Project, ProjectItemMaster } from '../types';

export interface CascadingEntitySearchValue {
  customerIds: string[];
  projectIds: string[];
  productIds: string[];
}

interface CascadingEntitySearchFilterProps {
  customers: Customer[];
  projects: Project[];
  projectItems: ProjectItemMaster[];
  value: CascadingEntitySearchValue;
  onChange: (value: CascadingEntitySearchValue) => void;
  textValue: string;
  onTextChange: (value: string) => void;
  actions?: React.ReactNode;
  selectionActions?: React.ReactNode;
  searchInputRef?: Ref<HTMLInputElement>;
  showSearchRow?: boolean;
}

interface MultiSearchOption {
  value: string;
  label: string;
  meta?: string;
  searchText: string;
}

interface EntityMultiSelectProps {
  label: string;
  placeholder: string;
  options: MultiSearchOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}

const normalizeSearchText = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const toId = (value: unknown): string => String(value ?? '').trim();

const uniqueIds = (values: string[]): string[] => Array.from(new Set(values.map(toId).filter(Boolean)));

const getCustomerLabel = (customer: Customer): string =>
  customer.customer_name || customer.customer_code || `KH ${customer.id}`;

const getProjectLabel = (project: Project): string =>
  project.project_name || project.project_code || `Dự án ${project.id}`;

const getProductLabel = (item: ProjectItemMaster): string =>
  item.product_name || item.display_name || item.product_code || `Sản phẩm ${item.product_id}`;

const getProductId = (item: ProjectItemMaster): string => toId(item.product_id || item.product_code || item.id);

function EntityMultiSelect({ label, placeholder, options, selectedValues, onChange }: EntityMultiSelectProps) {
  const triggerId = useId();
  const listboxId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const selectedSet = useMemo(() => new Set(selectedValues.map(toId)), [selectedValues]);
  const selectedOptions = useMemo(
    () => options.filter((option) => selectedSet.has(option.value)),
    [options, selectedSet],
  );
  const selectedCount = selectedOptions.length;
  const searchNeedle = normalizeSearchText(search);
  const filteredOptions = useMemo(() => {
    if (!searchNeedle) return options;
    return options.filter((option) => normalizeSearchText(`${option.label} ${option.meta || ''} ${option.searchText}`).includes(searchNeedle));
  }, [options, searchNeedle]);

  const syncDropdownPosition = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const width = Math.max(rect.width, 280);
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: Math.min(rect.left, Math.max(8, viewportWidth - width - 8)),
      width,
      zIndex: 2100,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    syncDropdownPosition();
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', syncDropdownPosition);
    window.addEventListener('scroll', syncDropdownPosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', syncDropdownPosition);
      window.removeEventListener('scroll', syncDropdownPosition, true);
    };
  }, [open, syncDropdownPosition]);

  const toggleOption = (optionValue: string) => {
    const next = selectedSet.has(optionValue)
      ? selectedValues.filter((value) => toId(value) !== optionValue)
      : [...selectedValues, optionValue];
    onChange(uniqueIds(next));
  };

  const summary = selectedCount === 0
    ? placeholder
    : selectedCount === 1
      ? selectedOptions[0]?.label || placeholder
      : `${selectedOptions[0]?.label || placeholder} +${selectedCount - 1}`;

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="rounded-md border border-slate-300 bg-white shadow-lg shadow-slate-900/10"
    >
      <div className="border-b border-slate-200 p-2">
        <label className="sr-only" htmlFor={`${triggerId}-search`}>
          Tìm {label}
        </label>
        <input
          ref={searchRef}
          id={`${triggerId}-search`}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-8 w-full rounded border border-slate-300 px-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary/70 focus:outline-none focus:ring-1 focus:ring-primary/20"
          placeholder={`Tìm ${label.toLowerCase()}...`}
        />
      </div>
      <div
        id={listboxId}
        role="listbox"
        aria-labelledby={triggerId}
        aria-multiselectable="true"
        className="max-h-64 overflow-y-auto p-1"
      >
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => {
            const isSelected = selectedSet.has(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => toggleOption(option.value)}
                className="flex min-h-[40px] w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/35 hover:bg-slate-50"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                    isSelected ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white text-transparent'
                  }`}
                >
                  {isSelected ? <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check</span> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{option.label}</span>
                  {option.meta ? <span className="block truncate text-[11px] text-slate-600">{option.meta}</span> : null}
                </span>
              </button>
            );
          })
        ) : (
          <p className="px-3 py-4 text-sm text-slate-600" aria-live="polite">
            Không có lựa chọn phù hợp.
          </p>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      <button
        id={triggerId}
        type="button"
        aria-label={`Lọc theo ${label.toLowerCase()}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`flex h-8 w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-2 text-left text-sm text-slate-900 transition-colors focus:border-primary/70 focus:outline-none focus:ring-2 focus:ring-primary/25 ${
          selectedCount > 0 ? 'pr-16' : 'pr-8'
        }`}
      >
        <span className={`min-w-0 flex-1 truncate ${selectedCount ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
          {summary}
        </span>
        {selectedCount > 0 ? (
          <span
            aria-hidden="true"
            className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-50 px-1 text-[11px] font-bold text-slate-700"
          >
            {selectedCount}
          </span>
        ) : null}
      </button>
      {selectedCount > 0 ? (
        <button
          type="button"
          aria-label={`Xóa lựa chọn ${label.toLowerCase()}`}
          onClick={(event) => {
            event.stopPropagation();
            onChange([]);
          }}
          className="absolute right-8 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/25"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
        </button>
      ) : null}
      <span
        aria-hidden="true"
        className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
        style={{ fontSize: 16 }}
      >
        expand_more
      </span>
      {typeof document !== 'undefined' ? createPortal(dropdown, document.body) : null}
    </div>
  );
}

export function CascadingEntitySearchFilter({
  customers,
  projects,
  projectItems,
  value,
  onChange,
  textValue,
  onTextChange,
  actions,
  selectionActions,
  searchInputRef,
  showSearchRow = true,
}: CascadingEntitySearchFilterProps) {
  const projectById = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((project) => map.set(toId(project.id), project));
    return map;
  }, [projects]);

  const customerOptions = useMemo<MultiSearchOption[]>(() => (
    customers
      .map((customer) => ({
        value: toId(customer.id),
        label: getCustomerLabel(customer),
        meta: customer.customer_code || undefined,
        searchText: `${customer.customer_code || ''} ${customer.customer_name || ''}`,
      }))
      .filter((option) => option.value)
      .sort((left, right) => left.label.localeCompare(right.label, 'vi'))
  ), [customers]);

  const selectedCustomerSet = useMemo(() => new Set(value.customerIds.map(toId).filter(Boolean)), [value.customerIds]);

  const projectOptions = useMemo<MultiSearchOption[]>(() => (
    projects
      .filter((project) => selectedCustomerSet.size === 0 || selectedCustomerSet.has(toId(project.customer_id)))
      .map((project) => ({
        value: toId(project.id),
        label: getProjectLabel(project),
        meta: project.project_code,
        searchText: `${project.project_code || ''} ${project.project_name || ''}`,
      }))
      .filter((option) => option.value)
      .sort((left, right) => left.label.localeCompare(right.label, 'vi'))
  ), [projects, selectedCustomerSet]);

  const selectedProjectSet = useMemo(() => new Set(value.projectIds.map(toId).filter(Boolean)), [value.projectIds]);
  const scopedProjectIdsForProducts = useMemo(() => {
    if (selectedProjectSet.size > 0) return selectedProjectSet;
    return new Set(projectOptions.map((option) => option.value));
  }, [projectOptions, selectedProjectSet]);

  const productOptions = useMemo<MultiSearchOption[]>(() => {
    const productMap = new Map<string, MultiSearchOption>();
    projectItems.forEach((item) => {
      const productId = getProductId(item);
      const projectId = toId(item.project_id);
      if (!productId || !projectId || !scopedProjectIdsForProducts.has(projectId)) return;
      const project = projectById.get(projectId);
      if (selectedCustomerSet.size > 0 && project && !selectedCustomerSet.has(toId(project.customer_id))) return;
      const label = getProductLabel(item);
      const existing = productMap.get(productId);
      const searchText = `${item.product_code || ''} ${item.product_name || ''} ${item.display_name || ''} ${project?.project_code || ''} ${project?.project_name || ''}`;
      if (existing) {
        existing.searchText = `${existing.searchText} ${searchText}`;
        return;
      }
      productMap.set(productId, {
        value: productId,
        label,
        meta: item.product_code || undefined,
        searchText,
      });
    });
    return Array.from(productMap.values()).sort((left, right) => left.label.localeCompare(right.label, 'vi'));
  }, [projectById, projectItems, scopedProjectIdsForProducts, selectedCustomerSet]);

  useEffect(() => {
    const validProjectIds = new Set(projectOptions.map((option) => option.value));
    const validProductIds = new Set(productOptions.map((option) => option.value));
    const nextProjectIds = value.projectIds.filter((projectId) => validProjectIds.has(toId(projectId)));
    const nextProductIds = value.productIds.filter((productId) => validProductIds.has(toId(productId)));
    if (nextProjectIds.length !== value.projectIds.length || nextProductIds.length !== value.productIds.length) {
      onChange({
        customerIds: uniqueIds(value.customerIds),
        projectIds: uniqueIds(nextProjectIds),
        productIds: uniqueIds(nextProductIds),
      });
    }
  }, [onChange, productOptions, projectOptions, value.customerIds, value.productIds, value.projectIds]);

  const updateValue = (patch: Partial<CascadingEntitySearchValue>) => {
    onChange({
      customerIds: uniqueIds(patch.customerIds ?? value.customerIds),
      projectIds: uniqueIds(patch.projectIds ?? value.projectIds),
      productIds: uniqueIds(patch.productIds ?? value.productIds),
    });
  };

  return (
    <fieldset className="space-y-2">
      <legend className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
        <span aria-hidden="true" className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>account_tree</span>
        Tìm theo cấu trúc
      </legend>
      <div className={`grid gap-2 ${selectionActions ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]' : 'lg:grid-cols-3'}`}>
        <EntityMultiSelect
          label="Khách hàng"
          placeholder="Khách hàng"
          options={customerOptions}
          selectedValues={value.customerIds}
          onChange={(customerIds) => updateValue({ customerIds })}
        />
        <EntityMultiSelect
          label="Dự án"
          placeholder="Dự án"
          options={projectOptions}
          selectedValues={value.projectIds}
          onChange={(projectIds) => updateValue({ projectIds })}
        />
        <EntityMultiSelect
          label="Sản phẩm"
          placeholder="Sản phẩm"
          options={productOptions}
          selectedValues={value.productIds}
          onChange={(productIds) => updateValue({ productIds })}
        />
        {selectionActions ? (
          <div className="min-w-0 lg:flex lg:items-center">
            {selectionActions}
          </div>
        ) : null}
      </div>
      {showSearchRow ? (
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="relative min-w-0">
            <span className="sr-only">Tìm tự do trong phạm vi đã chọn</span>
            <span aria-hidden="true" className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" style={{ fontSize: 15 }}>
              search
            </span>
            <input
              ref={searchInputRef}
              type="search"
              enterKeyHint="search"
              aria-label="Tìm tự do trong phạm vi đã chọn"
              value={textValue}
              onChange={(event) => onTextChange(event.target.value)}
              className="h-8 w-full rounded-md border border-slate-300 bg-white pl-8 pr-8 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary/70 focus:outline-none focus:ring-2 focus:ring-primary/25"
              placeholder="Tìm tự do trong phạm vi đã chọn..."
              title="Tìm kiếm trong phạm vi đã chọn (Enter)"
            />
            {textValue ? (
              <button
                type="button"
                aria-label="Xóa nội dung tìm tự do"
                onClick={() => onTextChange('')}
                className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/25"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
              </button>
            ) : null}
          </label>
          {actions ? <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center">{actions}</div> : null}
        </div>
      ) : null}
    </fieldset>
  );
}
