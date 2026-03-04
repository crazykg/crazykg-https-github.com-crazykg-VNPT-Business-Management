
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Department, Employee, EmployeeType, Gender, EmployeeStatus, VpnStatus, ModalType, Business, Vendor, Product, Customer, CustomerPersonnel, SupportContactPosition, Opportunity, OpportunityStage, OpportunityStageOption, Project, ProjectStatus, InvestmentMode, ProjectItem, ProjectItemMaster, Contract, ContractStatus, Document as AppDocument, Attachment, DocumentType, Reminder, ProjectRACI, RACIRole, UserDeptHistory } from '../types';
import { PARENT_OPTIONS, PROJECT_STATUSES, INVESTMENT_MODES, CONTRACT_STATUSES, DOCUMENT_TYPES, DOCUMENT_STATUSES, RACI_ROLES } from '../constants';
import { getEmployeeLabel, normalizeEmployeeCode, resolvePositionName } from '../utils/employeeDisplay';
import { parseImportFile, pickImportSheetByModule, ParsedImportSheet } from '../utils/importParser';
import { deleteUploadedDocumentAttachment, uploadDocumentAttachment } from '../services/v5Api';
import { buildAgeRangeValidationMessage, isAgeInAllowedRange } from '../utils/ageValidation';
import { downloadExcelWorkbook } from '../utils/excelTemplate';
import { formatDateDdMmYyyy } from '../utils/dateDisplay';

const DATE_INPUT_MIN = '1900-01-01';
const DATE_INPUT_MAX = '9999-12-31';
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_DATE_REGEX = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/;
const ROOT_DEPARTMENT_CODE = 'BGĐVT';
const MAX_DEPARTMENT_LEVEL = 2;
const SOLUTION_DEPARTMENT_CODE_PREFIX = 'PGP';
const SOLUTION_SUMMARY_TEAM_CODE = 'TTH';
const SOLUTION_CENTER_CODE_TOKENS = ['TTKDGIAIPHAP', 'TTKDGP', 'TTGP'];
const SOLUTION_CENTER_NAME_TOKEN = 'TRUNGTAMKINHDOANHGIAIPHAP';
const AGE_RANGE_ERROR_MESSAGE = buildAgeRangeValidationMessage();

const parseVietnameseCurrencyInput = (value: string): number => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return 0;
  }

  const sanitized = normalized
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatVietnameseCurrencyInput = (value: unknown): string => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '';
  }

  const sign = numeric < 0 ? '-' : '';
  const absoluteText = Math.abs(numeric).toString();
  const [integerPart, decimalPartRaw] = absoluteText.split('.');
  const integerFormatted = Number(integerPart || '0').toLocaleString('vi-VN');
  const decimalPart = (decimalPartRaw || '').replace(/0+$/, '');

  if (!decimalPart) {
    return `${sign}${integerFormatted}`;
  }

  return `${sign}${integerFormatted},${decimalPart}`;
};

const formatVietnameseIntegerWithThousands = (digits: string): string => {
  const normalized = String(digits || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!normalized) {
    return '';
  }
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const sanitizeVietnameseCurrencyDraft = (value: string): string => {
  const normalized = String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/\./g, '');
  if (!normalized) {
    return '';
  }

  const cleaned = normalized.replace(/[^0-9,]/g, '');
  const firstCommaIndex = cleaned.indexOf(',');
  const hasComma = firstCommaIndex >= 0;

  const integerRaw = hasComma ? cleaned.slice(0, firstCommaIndex) : cleaned;
  const decimalRaw = hasComma ? cleaned.slice(firstCommaIndex + 1).replace(/,/g, '') : '';
  const integerDigits = integerRaw.replace(/^0+(?=\d)/, '');
  const integerFormatted = formatVietnameseIntegerWithThousands(integerDigits);
  const decimalDigits = decimalRaw.slice(0, 2);

  if (!hasComma) {
    return integerFormatted;
  }

  const integerPart = integerFormatted || '0';
  return `${integerPart},${decimalDigits}`;
};

const VIETNAMESE_DIGIT_WORDS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const VIETNAMESE_LARGE_UNITS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ', 'tỷ tỷ'];

const toTitleVietnameseSentence = (value: string): string => {
  const text = String(value || '').trim();
  if (!text) return '';
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
};

const readVietnameseThreeDigitBlock = (value: number, forceHundreds: boolean): string => {
  const hundred = Math.floor(value / 100);
  const ten = Math.floor((value % 100) / 10);
  const unit = value % 10;
  const tokens: string[] = [];

  if (hundred > 0 || forceHundreds) {
    tokens.push(`${VIETNAMESE_DIGIT_WORDS[hundred]} trăm`);
  }

  if (ten > 1) {
    tokens.push(`${VIETNAMESE_DIGIT_WORDS[ten]} mươi`);
    if (unit === 1) {
      tokens.push('mốt');
    } else if (unit === 4) {
      tokens.push('tư');
    } else if (unit === 5) {
      tokens.push('lăm');
    } else if (unit > 0) {
      tokens.push(VIETNAMESE_DIGIT_WORDS[unit]);
    }
    return tokens.join(' ');
  }

  if (ten === 1) {
    tokens.push('mười');
    if (unit === 5) {
      tokens.push('lăm');
    } else if (unit > 0) {
      tokens.push(VIETNAMESE_DIGIT_WORDS[unit]);
    }
    return tokens.join(' ');
  }

  if (unit > 0) {
    if (hundred > 0 || forceHundreds) {
      tokens.push('lẻ');
    }
    tokens.push(VIETNAMESE_DIGIT_WORDS[unit]);
  }

  return tokens.join(' ');
};

const formatVietnameseAmountInWords = (currencyInput: string): string => {
  const sanitizedInput = sanitizeVietnameseCurrencyDraft(currencyInput);
  if (!sanitizedInput) {
    return '';
  }

  const numericAmount = parseVietnameseCurrencyInput(sanitizedInput);
  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    return 'Giá trị không hợp lệ';
  }

  const compactInput = sanitizedInput.replace(/\./g, '');
  const [integerPartRaw = '0', decimalPartRaw = ''] = compactInput.split(',');
  const integerPart = integerPartRaw || '0';

  if (!/^\d+$/.test(integerPart) || (decimalPartRaw && !/^\d+$/.test(decimalPartRaw))) {
    return 'Giá trị không hợp lệ';
  }

  const integerValue = Number(integerPart);
  if (!Number.isSafeInteger(integerValue) || integerValue < 0) {
    return 'Giá trị không hợp lệ';
  }

  let remaining = integerValue;
  const blocks: number[] = [];

  if (remaining === 0) {
    blocks.push(0);
  } else {
    while (remaining > 0) {
      blocks.push(remaining % 1000);
      remaining = Math.floor(remaining / 1000);
    }
  }

  const spokenBlocks: string[] = [];
  let hasHigherNonZeroBlock = false;

  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const blockValue = blocks[index];
    if (blockValue === 0) {
      continue;
    }

    const forceHundreds = hasHigherNonZeroBlock && blockValue < 100;
    const blockText = readVietnameseThreeDigitBlock(blockValue, forceHundreds);
    const unit = VIETNAMESE_LARGE_UNITS[index] || '';
    spokenBlocks.push(unit ? `${blockText} ${unit}` : blockText);
    hasHigherNonZeroBlock = true;
  }

  const integerWords = spokenBlocks.length > 0 ? spokenBlocks.join(' ') : 'không';

  if (!decimalPartRaw) {
    return toTitleVietnameseSentence(`${integerWords} đồng`);
  }

  const decimalWords = decimalPartRaw
    .split('')
    .map((digit) => VIETNAMESE_DIGIT_WORDS[Number(digit)] || '')
    .filter(Boolean)
    .join(' ');
  return toTitleVietnameseSentence(`${integerWords} phẩy ${decimalWords} đồng`);
};

const normalizeProductUnit = (value: unknown): string => {
  const text = String(value ?? '').trim();
  if (!text || text === '--' || text === '---') {
    return 'Cái/Gói';
  }
  return text;
};

const isRootDepartmentCode = (value: unknown): boolean => {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, '');
  return normalized === 'BGĐVT' || normalized === 'BGDVT';
};

const normalizeDepartmentCodeToken = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, '');

const normalizeDepartmentNameToken = (value: unknown): string => {
  const text = String(value ?? '').trim();
  if (!text) {
    return '';
  }

  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
};

const isSolutionDepartmentCode = (value: unknown): boolean => {
  const token = normalizeDepartmentCodeToken(value);
  return token.startsWith(SOLUTION_DEPARTMENT_CODE_PREFIX);
};

const isSolutionSummaryTeamCode = (value: unknown): boolean =>
  normalizeDepartmentCodeToken(value) === SOLUTION_SUMMARY_TEAM_CODE;

const isSolutionChildDepartmentCode = (value: unknown): boolean =>
  isSolutionDepartmentCode(value) || isSolutionSummaryTeamCode(value);

const isSolutionCenterDepartment = (department: Partial<Department> | null | undefined): boolean => {
  if (!department) {
    return false;
  }

  const codeToken = normalizeDepartmentCodeToken(department.dept_code);
  if (SOLUTION_CENTER_CODE_TOKENS.includes(codeToken)) {
    return true;
  }

  const nameToken = normalizeDepartmentNameToken(department.dept_name);
  return nameToken.includes(SOLUTION_CENTER_NAME_TOKEN);
};

const isValidIsoDate = (value: string): boolean => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;

  const matched = normalized.match(ISO_DATE_REGEX);
  if (!matched) return false;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (!Number.isFinite(year) || year < 1900 || year > 9999) return false;
  if (!Number.isFinite(month) || month < 1 || month > 12) return false;
  if (!Number.isFinite(day) || day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
};

const normalizeDateInputToIso = (value: string): string | null => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;

  const isoPrefixMatched = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefixMatched && isValidIsoDate(isoPrefixMatched[1])) {
    return isoPrefixMatched[1];
  }

  if (isValidIsoDate(normalized)) {
    return normalized;
  }

  const dmyMatched = normalized.match(DMY_DATE_REGEX);
  if (!dmyMatched) {
    return null;
  }

  const day = Number(dmyMatched[1]);
  const month = Number(dmyMatched[2]);
  const year = Number(dmyMatched[3]);
  const isoValue = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return isValidIsoDate(isoValue) ? isoValue : null;
};

const normalizeImportTokenForPreview = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const normalizeImportDatePreviewToIso = (value: unknown): string | null => {
  const text = String(value ?? '').trim();
  if (!text) {
    return null;
  }

  const normalized = normalizeDateInputToIso(text);
  if (normalized) {
    return normalized;
  }

  const numeric = Number(text);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const date = new Date(excelEpoch.getTime() + numeric * 86400000);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

  if (year < 1900 || year > 9999) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const formatImportPreviewCellValue = (moduleKey: string, header: string, value: unknown): string => {
  const rawValue = String(value ?? '');
  const moduleToken = normalizeImportTokenForPreview(moduleKey);
  if (moduleToken !== 'employees' && moduleToken !== 'internaluserlist') {
    return rawValue;
  }

  const headerToken = normalizeImportTokenForPreview(header);
  if (!['ngaysinh', 'dateofbirth', 'dob', 'birthday'].includes(headerToken)) {
    return rawValue;
  }

  const isoDate = normalizeImportDatePreviewToIso(rawValue);
  if (!isoDate) {
    return rawValue;
  }

  const formatted = formatDateDdMmYyyy(isoDate);
  return formatted === '--' ? rawValue : formatted;
};

interface ModalWrapperProps {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  icon: string;
  width?: string;
  maxHeightClass?: string;
  disableClose?: boolean;
}

const ModalWrapper: React.FC<ModalWrapperProps> = ({
  children,
  onClose,
  title,
  icon,
  width = 'max-w-[560px]',
  maxHeightClass = 'max-h-[90vh]',
  disableClose = false,
}) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !disableClose && onClose()}></div>
    <div className={`relative bg-white w-full ${width} ${maxHeightClass} rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in`}>
      <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-3 text-slate-900">
          <span className="material-symbols-outlined text-primary text-2xl">{icon}</span>
          <h2 className="text-lg md:text-xl font-bold leading-tight tracking-tight line-clamp-1">{title}</h2>
        </div>
        <button
          onClick={() => !disableClose && onClose()}
          disabled={disableClose}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-2xl">close</span>
        </button>
      </div>
      <div className="overflow-y-auto flex-1 custom-scrollbar">
        {children}
      </div>
    </div>
  </div>
);

// --- Searchable Select Component ---
interface SearchableSelectProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder,
  label,
  error,
  required,
  disabled,
  className,
  triggerClassName,
  dropdownClassName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openDirection, setOpenDirection] = useState<'up' | 'down'>('down');
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
        inputRef.current.focus();
    }
  }, [isOpen]);

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

  const filteredOptions = (options || []).filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Find label for current value if exists to display
  const currentLabel = (options || []).find(opt => opt.value === value)?.label || value;

  return (
    <div className={`col-span-1 flex flex-col gap-1.5 relative ${isOpen ? 'z-[110]' : 'z-10'} ${className || ''}`} ref={wrapperRef}>
      {label && <label className="block text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>}
      <div
        className={`w-full h-[46px] px-4 rounded-lg border bg-white flex items-center gap-2 cursor-pointer transition-all ${
            disabled ? 'bg-slate-50 cursor-not-allowed text-slate-400 border-slate-200' :
            error ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300 hover:border-primary focus:ring-2 focus:ring-primary focus:border-primary'
        } ${triggerClassName || ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span
          className={`text-sm min-w-0 flex-1 truncate ${value ? 'text-slate-900 font-medium' : 'text-slate-400'}`}
          title={currentLabel || placeholder || 'Chọn...'}
        >
          {currentLabel || placeholder || 'Chọn...'}
        </span>
        <span className="material-symbols-outlined text-slate-400 text-[20px] flex-shrink-0">expand_more</span>
      </div>
      
      {isOpen && (
        <div
          className={`absolute left-0 z-[130] w-full bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden flex flex-col animate-fade-in ring-1 ring-slate-900/5 ${
            openDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
          } ${dropdownClassName || ''}`}
        >
          <div className="p-2 border-b border-slate-100 bg-slate-50">
             <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                <input
                  ref={inputRef}
                  type="text"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-slate-900 placeholder:text-slate-400 shadow-sm"
                  placeholder="Tìm kiếm..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
             </div>
          </div>
          <div className="overflow-y-auto max-h-60 p-1 custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <div
                  key={opt.value}
                  className={`px-3 py-2.5 text-sm rounded-md cursor-pointer transition-colors flex items-center justify-between ${value === opt.value ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                >
                  <span className="min-w-0 flex-1 truncate pr-2 text-left" title={opt.label}>{opt.label}</span>
                  {value === opt.value && <span className="material-symbols-outlined text-sm flex-shrink-0">check</span>}
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-sm text-slate-400 text-center flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-2xl">search_off</span>
                  <span>Không tìm thấy kết quả</span>
              </div>
            )}
          </div>
        </div>
      )}
       {error && <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1 animate-fade-in"><span className="material-symbols-outlined text-[14px]">error</span>{error}</p>}
    </div>
  );
};

interface SearchableMultiSelectProps {
  options: { value: string; label: string }[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

const SearchableMultiSelect: React.FC<SearchableMultiSelectProps> = ({
  options,
  values,
  onChange,
  placeholder,
  label,
  error,
  required,
  disabled,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openDirection, setOpenDirection] = useState<'up' | 'down'>('down');
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
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

  return (
    <div className={`col-span-1 flex flex-col gap-1.5 relative ${isOpen ? 'z-[90]' : 'z-10'}`} ref={wrapperRef}>
      {label && (
        <label className="block text-sm font-semibold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
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

      {selectedOptions.length > 0 && (
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
          {selectedOptions.length > 3 && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
              +{selectedOptions.length - 3}
            </span>
          )}
        </div>
      )}

      {isOpen && (
        <div
          className={`absolute left-0 w-full bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden flex flex-col animate-fade-in ring-1 ring-slate-900/5 ${
            openDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          <div className="p-2 border-b border-slate-100 bg-slate-50">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              <input
                ref={inputRef}
                type="text"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-slate-900 placeholder:text-slate-400 shadow-sm"
                placeholder="Tìm kiếm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-60 p-1 custom-scrollbar">
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
      )}
      {error && <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1 animate-fade-in"><span className="material-symbols-outlined text-[14px]">error</span>{error}</p>}
    </div>
  );
};

// --- Helper Components for Forms ---
const FormInput = ({ label, value, onChange, placeholder, disabled, required, error, type = 'text' }: any) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(event);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input 
        type={type}
        value={value || ''}
        onChange={handleChange}
        placeholder={placeholder} 
        disabled={disabled}
        lang={type === 'date' ? 'vi-VN' : undefined}
        min={type === 'date' ? DATE_INPUT_MIN : undefined}
        max={type === 'date' ? DATE_INPUT_MAX : undefined}
        className={`w-full h-11 px-4 rounded-lg border bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400 ${disabled ? 'bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed' : error ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'}`}
      />
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
};

const FormSelect = ({ label, value, onChange, options, disabled, required, error }: any) => (
  <SearchableSelect
    label={label}
    required={required}
    value={String(value || '')}
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

const DeleteConfirmModal: React.FC<{ title: string; message: React.ReactNode; onClose: () => void; onConfirm: () => void }> = ({ title, message, onClose, onConfirm }) => (
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

export interface DepartmentFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: Department | null;
  departments?: Department[];
  onClose: () => void;
  onSave: (data: Partial<Department>) => void;
  isLoading?: boolean;
}

export const DepartmentFormModal: React.FC<DepartmentFormModalProps> = ({ type, data, departments = [], onClose, onSave, isLoading }) => {
  const rootDepartment = useMemo(
    () =>
      departments.find((department) => isRootDepartmentCode(department.dept_code)) ||
      null,
    [departments]
  );
  const solutionCenterDepartment = useMemo(() => {
    const currentId = data?.id === null || data?.id === undefined ? '' : String(data.id);
    const otherDepartments = departments.filter((department) => String(department.id) !== currentId);

    return (
      otherDepartments.find((department) => isSolutionCenterDepartment(department)) ||
      departments.find((department) => isSolutionCenterDepartment(department)) ||
      null
    );
  }, [departments, data?.id]);

  const childrenByParentId = useMemo(() => {
    const map = new Map<string, string[]>();
    (departments || []).forEach((department) => {
      const parentToken =
        department.parent_id === null || department.parent_id === undefined || department.parent_id === ''
          ? ''
          : String(department.parent_id);
      if (!parentToken) {
        return;
      }
      const next = map.get(parentToken) || [];
      next.push(String(department.id));
      map.set(parentToken, next);
    });
    return map;
  }, [departments]);

  const levelById = useMemo(() => {
    const byId = new Map<string, Department>();
    (departments || []).forEach((department) => {
      byId.set(String(department.id), department);
    });

    const cache = new Map<string, number>();
    const resolveLevel = (id: string, trail: Set<string> = new Set()): number => {
      if (cache.has(id)) {
        return cache.get(id) as number;
      }
      if (trail.has(id)) {
        return MAX_DEPARTMENT_LEVEL + 99;
      }

      const current = byId.get(id);
      if (!current) {
        return MAX_DEPARTMENT_LEVEL + 99;
      }

      const parentToken =
        current.parent_id === null || current.parent_id === undefined || current.parent_id === ''
          ? ''
          : String(current.parent_id);
      if (!parentToken) {
        cache.set(id, 0);
        return 0;
      }

      const nextTrail = new Set(trail);
      nextTrail.add(id);
      const level = resolveLevel(parentToken, nextTrail) + 1;
      cache.set(id, level);
      return level;
    };

    const result = new Map<string, number>();
    (departments || []).forEach((department) => {
      const token = String(department.id);
      result.set(token, resolveLevel(token));
    });
    return result;
  }, [departments]);

  const currentDepartmentToken = data?.id === null || data?.id === undefined ? '' : String(data.id);
  const descendantDepartmentIds = useMemo(() => {
    if (!currentDepartmentToken) {
      return new Set<string>();
    }
    const visited = new Set<string>();
    const stack = [...(childrenByParentId.get(currentDepartmentToken) || [])];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      const children = childrenByParentId.get(current) || [];
      children.forEach((child) => stack.push(child));
    }
    return visited;
  }, [childrenByParentId, currentDepartmentToken]);

  const subtreeMaxDepth = useMemo(() => {
    if (!currentDepartmentToken) {
      return 0;
    }
    let maxDepth = 0;
    const stack: Array<{ id: string; depth: number }> = [{ id: currentDepartmentToken, depth: 0 }];
    const visited = new Set<string>();
    while (stack.length > 0) {
      const current = stack.pop() as { id: string; depth: number };
      if (visited.has(current.id)) {
        continue;
      }
      visited.add(current.id);
      if (current.depth > maxDepth) {
        maxDepth = current.depth;
      }
      const children = childrenByParentId.get(current.id) || [];
      children.forEach((child) => stack.push({ id: child, depth: current.depth + 1 }));
    }
    return maxDepth;
  }, [childrenByParentId, currentDepartmentToken]);

  const [formData, setFormData] = useState<Partial<Department>>({
    id: data?.id,
    dept_code: isRootDepartmentCode(data?.dept_code) ? ROOT_DEPARTMENT_CODE : data?.dept_code || '',
    dept_name: data?.dept_name || '',
    parent_id: data?.parent_id ?? null,
    is_active: data?.is_active ?? (data ? data.status === 'ACTIVE' : true)
  });

  const isRootDepartment = isRootDepartmentCode(formData.dept_code);
  const isSolutionChildDepartment = isSolutionChildDepartmentCode(formData.dept_code);
  const maxAllowedParentLevel = 1 - subtreeMaxDepth;

  const candidateParents = useMemo(() => {
    if (isRootDepartment) {
      return [] as Department[];
    }

    if (isSolutionChildDepartment) {
      if (!solutionCenterDepartment) {
        return [] as Department[];
      }
      return [solutionCenterDepartment];
    }

    return (departments || []).filter((department) => {
      const departmentIdToken = String(department.id);
      if (!departmentIdToken) {
        return false;
      }
      if (departmentIdToken === currentDepartmentToken) {
        return false;
      }
      if (descendantDepartmentIds.has(departmentIdToken)) {
        return false;
      }

      const level = levelById.get(departmentIdToken);
      if (level === undefined || !Number.isFinite(level)) {
        return false;
      }

      return level <= maxAllowedParentLevel;
    });
  }, [
    isRootDepartment,
    isSolutionChildDepartment,
    solutionCenterDepartment,
    departments,
    currentDepartmentToken,
    descendantDepartmentIds,
    levelById,
    maxAllowedParentLevel,
  ]);

  useEffect(() => {
    setFormData((prev) => {
      if (isRootDepartmentCode(prev.dept_code)) {
        if (prev.parent_id !== null) {
          return { ...prev, dept_code: ROOT_DEPARTMENT_CODE, parent_id: null };
        }
        if (prev.dept_code !== ROOT_DEPARTMENT_CODE) {
          return { ...prev, dept_code: ROOT_DEPARTMENT_CODE };
        }
        return prev;
      }

      if (isSolutionChildDepartmentCode(prev.dept_code)) {
        if (!solutionCenterDepartment) {
          return prev;
        }
        if (String(prev.parent_id ?? '') !== String(solutionCenterDepartment.id)) {
          return { ...prev, parent_id: solutionCenterDepartment.id };
        }
        return prev;
      }

      const parentToken = prev.parent_id === null || prev.parent_id === undefined || prev.parent_id === ''
        ? ''
        : String(prev.parent_id);
      const candidateIds = new Set(candidateParents.map((department) => String(department.id)));

      if (parentToken && !candidateIds.has(parentToken)) {
        return { ...prev, parent_id: null };
      }

      if (!parentToken && rootDepartment && candidateIds.has(String(rootDepartment.id))) {
        return { ...prev, parent_id: rootDepartment.id };
      }

      return prev;
    });
  }, [candidateParents, rootDepartment, solutionCenterDepartment, formData.dept_code]);

  const parentOptions = useMemo(() => {
    if (isRootDepartment) {
      return [{ value: '', label: 'Không có (phòng ban gốc)' }];
    }

    const sortedCandidates = [...candidateParents].sort((a, b) => {
      const levelA = levelById.get(String(a.id)) ?? 99;
      const levelB = levelById.get(String(b.id)) ?? 99;
      if (levelA !== levelB) {
        return levelA - levelB;
      }
      return String(a.dept_code || '').localeCompare(String(b.dept_code || ''), 'vi');
    });

    return sortedCandidates.map((department) => ({
      value: String(department.id),
      label: `${department.dept_code} - ${department.dept_name}`,
    }));
  }, [isRootDepartment, candidateParents, levelById]);

  const parentError = useMemo(() => {
    if (isRootDepartment) {
      return '';
    }

    if (isSolutionChildDepartment && !solutionCenterDepartment) {
      return 'Vui lòng tạo Trung tâm Kinh doanh Giải pháp trước khi thêm mã PGP/TTH.';
    }

    if (candidateParents.length === 0) {
      return 'Không có phòng ban cha hợp lệ. Hệ thống chỉ cho phép tối đa 3 cấp (0,1,2).';
    }

    return '';
  }, [isRootDepartment, isSolutionChildDepartment, solutionCenterDepartment, candidateParents.length]);

  return (
    <ModalWrapper 
      onClose={onClose} 
      title={type === 'ADD' ? 'Thêm mới phòng ban' : 'Chỉnh sửa phòng ban'} 
      icon={type === 'ADD' ? 'domain_add' : 'edit_note'}
    >
      <div className="p-6 space-y-5 relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-white/80 flex flex-col items-center justify-center backdrop-blur-[1px]">
             <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin mb-3"></div>
             <p className="text-primary font-semibold text-sm animate-pulse">Đang lưu dữ liệu...</p>
          </div>
        )}

        <FormInput 
            label="Mã phòng ban" 
            value={formData.dept_code} 
            onChange={(e: any) => setFormData({...formData, dept_code: e.target.value})} 
            placeholder={`Nhập mã phòng ban (gốc: ${ROOT_DEPARTMENT_CODE})`} 
            required 
            error={type === 'ADD' && !formData.dept_code ? 'Mã phòng ban là bắt buộc' : ''}
        />
        <FormInput 
            label="Tên phòng ban" 
            value={formData.dept_name} 
            onChange={(e: any) => setFormData({...formData, dept_name: e.target.value})} 
            placeholder="Nhập tên phòng ban" 
            required 
        />
        <FormSelect 
            label="Phòng ban cha"
            value={formData.parent_id === null || formData.parent_id === undefined ? '' : String(formData.parent_id)}
            onChange={(e: any) => {
              const raw = e.target.value;
              if (!raw) {
                setFormData({ ...formData, parent_id: null });
                return;
              }
              const numeric = Number(raw);
              setFormData({ ...formData, parent_id: Number.isNaN(numeric) ? raw : numeric });
            }}
            options={parentOptions}
            disabled={isRootDepartment || parentOptions.length === 0}
            error={parentError}
        />

        <div className="flex items-center justify-between py-2">
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-slate-700">Trạng thái hoạt động</label>
            <span className="text-xs text-slate-500">Kích hoạt để cho phép phòng ban hoạt động ngay</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={Boolean(formData.is_active)}
              onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
              className="sr-only peer" 
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100 flex-shrink-0">
        <button onClick={onClose} className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition-colors">
          Hủy
        </button>
        <button 
          onClick={() => {
            if (!isRootDepartment && parentError) {
              return;
            }

            const rawParentId = isRootDepartment ? null : formData.parent_id;
            const normalizedParentId =
              rawParentId === null || rawParentId === undefined || rawParentId === ''
                ? null
                : Number.isNaN(Number(rawParentId))
                  ? rawParentId
                  : Number(rawParentId);

            onSave({
              ...formData,
              dept_code: isRootDepartment ? ROOT_DEPARTMENT_CODE : formData.dept_code,
              parent_id: normalizedParentId,
            });
          }}
          className="px-8 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
        >
          {isLoading ? 'Đang lưu...' : (type === 'ADD' ? 'Lưu' : 'Lưu thay đổi')}
        </button>
      </div>
    </ModalWrapper>
  );
};

export const ViewDepartmentModal: React.FC<{ data: Department; departments: Department[]; onClose: () => void; onEdit: () => void }> = ({
  data,
  departments,
  onClose,
  onEdit,
}) => {
  const parentDept = (departments || []).find((d) => String(d.id) === String(data.parent_id));
  const parentName = parentDept ? `${parentDept.dept_code} - ${parentDept.dept_name}` : data.parent_id || '---';
  
  return (
    <ModalWrapper onClose={onClose} title="Thông tin phòng ban" icon="apartment">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs text-slate-500 font-medium uppercase">Mã phòng ban</label><p className="font-mono font-medium text-slate-900">{data.dept_code}</p></div>
          <div><label className="text-xs text-slate-500 font-medium uppercase">Tên phòng ban</label><p className="font-medium text-slate-900">{data.dept_name}</p></div>
          <div><label className="text-xs text-slate-500 font-medium uppercase">Phòng ban cha</label><p className="text-slate-900">{parentName}</p></div>
          <div><label className="text-xs text-slate-500 font-medium uppercase">Trạng thái</label>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${data.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {data.is_active ? 'Hoạt động' : 'Ngừng hoạt động'}
            </span>
          </div>
          <div><label className="text-xs text-slate-500 font-medium uppercase">Số lượng nhân sự</label><p className="text-slate-900">{data.employeeCount || 0} nhân viên</p></div>
          <div><label className="text-xs text-slate-500 font-medium uppercase">Ngày tạo</label><p className="text-slate-900">{data.createdDate || '---'}</p></div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100">Đóng</button>
        <button onClick={() => { onClose(); onEdit(); }} className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-deep-teal flex items-center gap-2"><span className="material-symbols-outlined text-lg">edit</span> Chỉnh sửa</button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteWarningModal: React.FC<{ data: Department; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal 
    title="Xóa phòng ban" 
    message={<p>Bạn có chắc chắn muốn xóa phòng ban <span className="font-bold text-slate-900">"{data.dept_name}"</span>? Hành động này không thể hoàn tác.</p>}
    onClose={onClose} 
    onConfirm={onConfirm} 
  />
);

export const CannotDeleteModal: React.FC<{ data: Department; onClose: () => void }> = ({ data, onClose }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>
    <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl p-6 animate-fade-in border-l-4 border-yellow-500">
       <div className="flex items-start gap-4">
          <span className="material-symbols-outlined text-3xl text-yellow-500">warning_amber</span>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Không thể xóa phòng ban</h3>
            <p className="text-slate-600 mt-2">Phòng ban <span className="font-bold">"{data.dept_name}"</span> đang có <span className="font-bold text-slate-900">{data.employeeCount} nhân sự</span>. Vui lòng điều chuyển hết nhân sự trước khi xóa.</p>
          </div>
       </div>
       <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium">Đã hiểu</button>
       </div>
    </div>
  </div>
);

export interface ImportPayload {
  moduleKey: string;
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: string[][];
  sheets?: Array<{
    name: string;
    headers: string[];
    rows: string[][];
  }>;
}

export interface ProjectItemImportBatchGroup {
  project_code: string;
  items: Array<{
    product_id: number;
    quantity: number;
    unit_price: number;
  }>;
}

export interface ProjectItemImportBatchResult {
  success_projects: Array<{
    project_code: string;
    applied_count: number;
  }>;
  failed_projects: Array<{
    project_code: string;
    message: string;
  }>;
}

export interface ProjectRaciImportBatchGroup {
  project_code: string;
  raci: Array<{
    project_item_id: string | number;
    user_id: number;
    raci_role: 'R' | 'A' | 'C' | 'I';
  }>;
}

export interface ProjectRaciImportBatchResult {
  success_projects: Array<{
    project_code: string;
    applied_count: number;
  }>;
  failed_projects: Array<{
    project_code: string;
    message: string;
  }>;
}

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;
const DEFAULT_IMPORT_PREVIEW_PAGE_SIZE = 20;

export const ImportModal: React.FC<{
  title: string;
  moduleKey: string;
  onClose: () => void;
  onSave: (payload: ImportPayload) => Promise<void> | void;
  isLoading?: boolean;
  loadingText?: string;
}> = ({ title, moduleKey, onClose, onSave, isLoading = false, loadingText = '' }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [payload, setPayload] = useState<ImportPayload | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(DEFAULT_IMPORT_PREVIEW_PAGE_SIZE);
  const normalizedModuleKey = String(moduleKey || '').trim().toLowerCase();
  const isProjectItemsImport = normalizedModuleKey === 'project_items' || normalizedModuleKey === 'projectitems' || normalizedModuleKey === 'projectitem';
  const isProjectRaciImport = normalizedModuleKey === 'project_raci' || normalizedModuleKey === 'projectraci' || normalizedModuleKey === 'raci';
  const shouldIncludeAllSheets =
    isProjectItemsImport ||
    isProjectRaciImport ||
    normalizedModuleKey === 'projects' ||
    normalizedModuleKey === 'project';
  const excelOnlyImport = isProjectItemsImport || isProjectRaciImport;
  const fileAccept = excelOnlyImport ? '.xlsx,.xls' : '.xlsx,.xls,.xml,.csv';
  const supportFormatText = excelOnlyImport
    ? 'Hỗ trợ định dạng .xlsx, .xls (Tối đa 5MB)'
    : 'Hỗ trợ định dạng .xlsx, .xls, .xml, .csv (Tối đa 5MB)';
  const isFileInteractionDisabled = isLoading || isParsing;
  const fileInputId = `import-file-input-${normalizedModuleKey || 'default'}`;

  const totalPreviewRows = payload?.rows.length || 0;
  const totalPreviewPages = Math.max(1, Math.ceil(totalPreviewRows / previewPageSize));
  const safePreviewPage = Math.min(previewPage, totalPreviewPages);
  const previewStartIndex = (safePreviewPage - 1) * previewPageSize;
  const previewRows = useMemo(
    () => (payload?.rows || []).slice(previewStartIndex, previewStartIndex + previewPageSize),
    [payload, previewPageSize, previewStartIndex]
  );

  useEffect(() => {
    setPreviewPage(1);
  }, [payload, moduleKey]);

  useEffect(() => {
    if (previewPage > totalPreviewPages) {
      setPreviewPage(totalPreviewPages);
    }
  }, [previewPage, totalPreviewPages]);

  const handleSelectFile = async (file: File) => {
    if (!file) return;

    setErrorMessage('');
    setPayload(null);

    const lowerFileName = String(file.name || '').toLowerCase();
    if (excelOnlyImport && !lowerFileName.endsWith('.xlsx') && !lowerFileName.endsWith('.xls')) {
      setErrorMessage('File nhập chỉ hỗ trợ định dạng Excel (.xlsx, .xls).');
      return;
    }

    if (file.size > MAX_IMPORT_FILE_SIZE) {
      setErrorMessage('File vượt quá 5MB. Vui lòng chọn file nhỏ hơn.');
      return;
    }

    setIsParsing(true);
    try {
      const parsedFile = await parseImportFile(file);
      const selectedSheet = pickImportSheetByModule(moduleKey, parsedFile);

      if (!selectedSheet || selectedSheet.headers.length === 0) {
        setErrorMessage('Không tìm thấy dữ liệu hợp lệ trong file đã chọn.');
        return;
      }

      const normalizedRows = (selectedSheet.rows || []).filter((row) =>
        row.some((cell) => String(cell || '').trim().length > 0)
      );

      setPayload({
        moduleKey,
        fileName: parsedFile.fileName,
        sheetName: selectedSheet.name,
        headers: selectedSheet.headers,
        rows: normalizedRows,
        sheets: shouldIncludeAllSheets
          ? (parsedFile.sheets || []).map((sheet: ParsedImportSheet) => ({
            name: sheet.name,
            headers: sheet.headers || [],
            rows: (sheet.rows || []).filter((row) =>
              row.some((cell) => String(cell || '').trim().length > 0)
            ),
          }))
          : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể đọc file import.';
      setErrorMessage(message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await handleSelectFile(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      await handleSelectFile(file);
    }
  };

  const handleConfirmImport = async () => {
    if (!payload || isParsing || isLoading) {
      return;
    }

    try {
      await onSave(payload);
    } catch {
      // Lỗi đã được xử lý tại App qua Toast.
    }
  };

  const blockClose = isLoading || isParsing;

  return (
    <ModalWrapper onClose={onClose} title={title} icon="upload_file" width="max-w-4xl" disableClose={blockClose}>
      <div className="p-6 space-y-4">
        <label
          htmlFor={fileInputId}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
            isDragOver ? 'border-primary bg-slate-50' : 'border-slate-300 hover:border-primary hover:bg-slate-50'
          }`}
          aria-disabled={isFileInteractionDisabled}
          onClick={(event) => {
            if (isFileInteractionDisabled) {
              event.preventDefault();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!isFileInteractionDisabled) {
              setIsDragOver(true);
            }
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!isFileInteractionDisabled) {
              setIsDragOver(true);
            }
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragOver(false);
          }}
          onDrop={handleDrop}
        >
          {isParsing ? (
            <>
              <span className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin mb-3"></span>
              <p className="text-sm font-semibold text-slate-900">Đang đọc file...</p>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">cloud_upload</span>
              <p className="text-sm font-medium text-slate-900">Kéo thả file vào đây hoặc click để chọn file</p>
              <p className="text-xs text-slate-500 mt-1">{supportFormatText}</p>
            </>
          )}
        </label>

        <input
          ref={fileInputRef}
          id={fileInputId}
          type="file"
          className="sr-only"
          accept={fileAccept}
          onChange={handleInputChange}
          disabled={isFileInteractionDisabled}
        />

        {errorMessage && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 p-3 rounded-lg border border-red-100">
            <span className="material-symbols-outlined text-red-600 text-base">error</span>
            <p>{errorMessage}</p>
          </div>
        )}

        {payload && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{payload.fileName}</p>
                <p className="text-xs text-slate-500">
                  Sheet: {payload.sheetName} | Số dòng dữ liệu: {payload.rows.length}
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isFileInteractionDisabled}
                className="px-3 py-1.5 rounded-md border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-white transition-colors disabled:opacity-50"
              >
                Chọn file khác
              </button>
            </div>
            <div className="overflow-x-auto max-h-72 custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10">
                  <tr>
                    <th className="px-3 py-2 text-xs font-bold text-slate-600 uppercase w-16">#</th>
                    {payload.headers.map((header) => (
                      <th key={header} className="px-3 py-2 text-xs font-bold text-slate-600 uppercase whitespace-nowrap">
                        {header || '--'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rowIndex) => (
                    <tr key={`preview-row-${rowIndex}`} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-3 py-2 text-xs text-slate-400">{previewStartIndex + rowIndex + 2}</td>
                      {payload.headers.map((_, colIndex) => (
                        <td key={`preview-cell-${rowIndex}-${colIndex}`} className="px-3 py-2 text-sm text-slate-700 whitespace-nowrap">
                          {formatImportPreviewCellValue(moduleKey, payload.headers[colIndex] || '', row[colIndex] || '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 text-xs text-slate-500 bg-white border-t border-slate-100 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                {totalPreviewRows > 0 ? (
                  <>
                    Đang xem {previewStartIndex + 1}-{previewStartIndex + previewRows.length}/{totalPreviewRows} dòng dữ liệu.
                  </>
                ) : (
                  <>Không có dòng dữ liệu hợp lệ để xem trước.</>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-slate-500">
                  Hiển thị
                  <span className="inline-block ml-1 w-[96px] align-middle">
                    <SearchableSelect
                      compact
                      value={previewPageSize}
                      disabled={isLoading || isParsing || totalPreviewRows === 0}
                      options={[
                        { value: 10, label: '10' },
                        { value: 20, label: '20' },
                        { value: 50, label: '50' },
                        { value: 100, label: '100' },
                      ]}
                      onChange={(value) => {
                        setPreviewPageSize(Number(value) || DEFAULT_IMPORT_PREVIEW_PAGE_SIZE);
                        setPreviewPage(1);
                      }}
                      triggerClassName="h-8 px-2 py-1 border border-slate-300 rounded-md bg-white text-slate-700 text-sm"
                    />
                  </span>
                </label>
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setPreviewPage((prev) => Math.max(1, prev - 1))}
                  disabled={safePreviewPage <= 1 || totalPreviewRows === 0}
                >
                  Trước
                </button>
                <span className="min-w-20 text-center">
                  Trang {safePreviewPage}/{totalPreviewPages}
                </span>
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setPreviewPage((prev) => Math.min(totalPreviewPages, prev + 1))}
                  disabled={safePreviewPage >= totalPreviewPages || totalPreviewRows === 0}
                >
                  Sau
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-slate-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
          <span className="material-symbols-outlined text-blue-600">info</span>
          <p>Vui lòng tải file mẫu để đảm bảo định dạng dữ liệu đúng trước khi import.</p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button
          onClick={() => !blockClose && onClose()}
          disabled={blockClose}
          className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Hủy
        </button>
        <button
          onClick={handleConfirmImport}
          disabled={!payload || isParsing || isLoading}
          className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-deep-teal shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? (loadingText || 'Đang nhập...') : 'Lưu dữ liệu'}
        </button>
      </div>
    </ModalWrapper>
  );
};

export const EmployeeFormModal: React.FC<{
  type: 'ADD' | 'EDIT';
  data?: Employee | null;
  departments?: Department[];
  onClose: () => void;
  onSave: (data: Partial<Employee>) => void;
}> = ({ type, data, departments = [], onClose, onSave }) => {
  const normalizeEmployeeStatusValue = (status: unknown): EmployeeStatus => {
    const normalized = String(status || '').trim().toUpperCase();
    if (normalized === 'ACTIVE') return 'ACTIVE';
    if (normalized === 'SUSPENDED' || normalized === 'TRANSFERRED') return 'SUSPENDED';
    return 'INACTIVE';
  };

  const [formData, setFormData] = useState<Partial<Employee>>({
    id: data?.id || '',
    uuid: data?.uuid || '',
    user_code: data?.employee_code || data?.user_code || String(data?.id || ''),
    username: data?.username || '',
    full_name: data?.full_name || data?.name || '',
    phone_number: data?.phone_number || data?.phone || data?.mobile || '',
    email: data?.email || '',
    job_title_raw: data?.job_title_vi || data?.job_title_raw || '',
    date_of_birth: (() => {
      const normalized = normalizeDateInputToIso(String(data?.date_of_birth || ''));
      if (!normalized) {
        return '';
      }
      const formatted = formatDateDdMmYyyy(normalized);
      return formatted === '--' ? '' : formatted;
    })(),
    gender: data?.gender || null,
    vpn_status: data?.vpn_status || 'NO',
    ip_address: data?.ip_address || '',
    status: normalizeEmployeeStatusValue(data?.status || 'ACTIVE'),
    department_id: data?.department_id || '',
    position_id: data?.position_id || '',
  });
  const [formErrors, setFormErrors] = useState<{ department_id?: string; date_of_birth?: string }>({});

  const positionOptions = useMemo(() => {
    const options = [
      { value: '1', label: 'Giám đốc' },
      { value: '2', label: 'Phó giám đốc' },
      { value: '3', label: 'Trưởng phòng' },
      { value: '4', label: 'Phó phòng' },
      { value: '5', label: 'Chuyên viên' },
    ];

    const currentValue = String(formData.position_id || '');
    if (currentValue && !options.some((option) => option.value === currentValue)) {
      options.unshift({ value: currentValue, label: resolvePositionName(data || { position_id: currentValue }) });
    }

    return [{ value: '', label: 'Chọn chức vụ' }, ...options];
  }, [formData.position_id, data?.position_name]);

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm mới nhân sự' : 'Cập nhật nhân sự'} icon="person_add" width="max-w-2xl">
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormInput label="Mã nhân viên" value={String(formData.user_code || '')} onChange={(e: any) => {
          if (type === 'ADD') {
            setFormData({...formData, user_code: e.target.value});
          }
        }} placeholder="VNPT022327 / CTV091020" disabled={type !== 'ADD'} required />
        <FormInput label="Tên đăng nhập" value={formData.username} onChange={(e: any) => setFormData({...formData, username: e.target.value})} placeholder="nguyenvana" required />
        <FormInput label="Họ và tên" value={formData.full_name} onChange={(e: any) => setFormData({...formData, full_name: e.target.value})} placeholder="Nguyễn Văn A" required />
        <FormInput
          label="Số điện thoại"
          value={String(formData.phone_number || '')}
          onChange={(e: any) => setFormData({ ...formData, phone_number: e.target.value })}
          placeholder="0912345678"
        />
        <FormInput label="Email" value={formData.email} onChange={(e: any) => setFormData({...formData, email: e.target.value})} placeholder="email@vnpt.vn" required />
        <FormSelect
          label="Phòng ban tham chiếu"
          value={String(formData.department_id || '')}
          onChange={(e: any) => {
            setFormData({ ...formData, department_id: e.target.value });
            if (formErrors.department_id) {
              setFormErrors((prev) => ({ ...prev, department_id: undefined }));
            }
          }}
          options={[{value: '', label: 'Chọn phòng ban'}, ...departments.map(d => ({ value: String(d.id), label: `${d.dept_code} - ${d.dept_name}` }))]}
          required
          error={formErrors.department_id}
        />
        <FormSelect label="Chức vụ" value={String(formData.position_id || '')} onChange={(e: any) => setFormData({...formData, position_id: e.target.value})} options={positionOptions} required />
        <FormInput label="Chức danh" value={formData.job_title_raw} onChange={(e: any) => setFormData({...formData, job_title_raw: e.target.value})} placeholder="Chuyên viên kinh doanh" />
        <FormInput
          label="Ngày sinh"
          type="text"
          value={formData.date_of_birth}
          onChange={(e: any) => {
            setFormData({ ...formData, date_of_birth: e.target.value || '' });
            if (formErrors.date_of_birth) {
              setFormErrors((prev) => ({ ...prev, date_of_birth: undefined }));
            }
          }}
          placeholder="dd/mm/yyyy"
          error={formErrors.date_of_birth}
        />
        <FormSelect
          label="Giới tính"
          value={formData.gender || ''}
          onChange={(e: any) => setFormData({...formData, gender: e.target.value || null})}
          options={[
            {value: '', label: 'Chọn giới tính'},
            {value: 'MALE', label: 'Nam'},
            {value: 'FEMALE', label: 'Nữ'},
            {value: 'OTHER', label: 'Khác'},
          ]}
        />
        <FormSelect
          label="Trạng thái VPN"
          value={formData.vpn_status || 'NO'}
          onChange={(e: any) => setFormData({...formData, vpn_status: e.target.value})}
          options={[
            {value: 'YES', label: 'Có'},
            {value: 'NO', label: 'Không'},
          ]}
        />
        <FormInput
          label="Địa chỉ IP"
          value={formData.ip_address}
          onChange={(e: any) => setFormData({...formData, ip_address: e.target.value})}
          placeholder="192.168.1.10"
          disabled={type === 'EDIT'}
        />
        
        <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
           <FormSelect
             label="Trạng thái"
             value={formData.status}
             onChange={(e: any) => setFormData({...formData, status: e.target.value})}
             options={[
               {value: 'ACTIVE', label: 'Hoạt động'},
               {value: 'INACTIVE', label: 'Không hoạt động'},
               {value: 'SUSPENDED', label: 'Luân chuyển'},
             ]}
           />
           <div></div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100">Hủy</button>
        <button
          onClick={() => {
            const nextErrors: { department_id?: string; date_of_birth?: string } = {};

            if (!String(formData.department_id || '').trim()) {
              nextErrors.department_id = 'Nhân sự bắt buộc thuộc một phòng ban.';
            }

            const normalizedDateOfBirth = normalizeDateInputToIso(String(formData.date_of_birth || ''));
            if (formData.date_of_birth && !normalizedDateOfBirth) {
              nextErrors.date_of_birth = 'Ngày sinh không hợp lệ (dd/mm/yyyy hoặc yyyy-mm-dd).';
            } else if (normalizedDateOfBirth && !isAgeInAllowedRange(normalizedDateOfBirth)) {
              nextErrors.date_of_birth = AGE_RANGE_ERROR_MESSAGE;
            }

            if (Object.keys(nextErrors).length > 0) {
              setFormErrors(nextErrors);
              return;
            }

            onSave({
              ...formData,
              date_of_birth: normalizedDateOfBirth,
              phone_number: String(formData.phone_number || '').trim() || null,
            });
          }}
          className="px-6 py-2 rounded-lg bg-primary text-white font-medium hover:bg-deep-teal shadow-lg shadow-primary/20"
        >
          {type === 'ADD' ? 'Lưu' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteEmployeeModal: React.FC<{ data: Employee; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal 
     title="Xóa nhân sự" 
     message={<p>Bạn có chắc chắn muốn xóa nhân sự <span className="font-bold text-slate-900">"{data.full_name || data.name}"</span>? Dữ liệu này không thể khôi phục.</p>}
     onClose={onClose} 
     onConfirm={onConfirm} 
  />
);

export const BusinessFormModal: React.FC<{ type: 'ADD' | 'EDIT'; data?: Business | null; onClose: () => void; onSave: (data: Partial<Business>) => void }> = ({ type, data, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Business>>({
    domain_code: data?.domain_code || '',
    domain_name: data?.domain_name || ''
  });

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm lĩnh vực kinh doanh' : 'Cập nhật lĩnh vực'} icon="category" width="max-w-md">
      <div className="p-6 space-y-4">
        <FormInput label="Mã lĩnh vực" value={formData.domain_code} onChange={(e: any) => setFormData({...formData, domain_code: e.target.value})} placeholder="KD001" required />
        <FormInput label="Tên lĩnh vực" value={formData.domain_name} onChange={(e: any) => setFormData({...formData, domain_name: e.target.value})} placeholder="Tên lĩnh vực" required />
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg">Hủy</button>
        <button onClick={() => onSave(formData)} className="px-4 py-2 bg-primary text-white rounded-lg">Lưu</button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteBusinessModal: React.FC<{ data: Business; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal title="Xóa lĩnh vực" message={<p>Xóa lĩnh vực <span className="font-bold">"{data.domain_name}"</span>?</p>} onClose={onClose} onConfirm={onConfirm} />
);

export const VendorFormModal: React.FC<{ type: 'ADD' | 'EDIT'; data?: Vendor | null; onClose: () => void; onSave: (data: Partial<Vendor>) => void }> = ({ type, data, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Vendor>>({
    vendor_code: data?.vendor_code || '',
    vendor_name: data?.vendor_name || ''
  });

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm đối tác' : 'Cập nhật đối tác'} icon="storefront" width="max-w-md">
      <div className="p-6 space-y-4">
        <FormInput label="Mã đối tác" value={formData.vendor_code} onChange={(e: any) => setFormData({...formData, vendor_code: e.target.value})} placeholder="DT001" required />
        <FormInput label="Tên đối tác" value={formData.vendor_name} onChange={(e: any) => setFormData({...formData, vendor_name: e.target.value})} placeholder="Tên đối tác" required />
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg">Hủy</button>
        <button onClick={() => onSave(formData)} className="px-4 py-2 bg-primary text-white rounded-lg">Lưu</button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteVendorModal: React.FC<{ data: Vendor; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal title="Xóa đối tác" message={<p>Xóa đối tác <span className="font-bold">"{data.vendor_name}"</span>?</p>} onClose={onClose} onConfirm={onConfirm} />
);

export const ProductFormModal: React.FC<{ type: 'ADD' | 'EDIT'; data?: Product | null; businesses: Business[]; vendors: Vendor[]; onClose: () => void; onSave: (data: Partial<Product>) => void }> = ({ type, data, businesses, vendors, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Product>>({
    product_code: data?.product_code || '',
    product_name: data?.product_name || '',
    domain_id: data?.domain_id || '',
    vendor_id: data?.vendor_id || '',
    standard_price: data?.standard_price || 0,
    unit: normalizeProductUnit(data?.unit),
    description: data?.description || '',
    is_active: data?.is_active !== false,
  });

  const businessOptions = useMemo(
    () => [
      { value: '', label: 'Chọn lĩnh vực' },
      ...(businesses || []).map((business) => ({
        value: String(business.id),
        label: `${business.domain_code} - ${business.domain_name}`,
      })),
    ],
    [businesses]
  );

  const vendorOptions = useMemo(
    () => [
      { value: '', label: 'Chọn nhà cung cấp' },
      ...(vendors || []).map((vendor) => ({
        value: String(vendor.id),
        label: `${vendor.vendor_code} - ${vendor.vendor_name}`,
      })),
    ],
    [vendors]
  );

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm sản phẩm' : 'Cập nhật sản phẩm'} icon="inventory_2" width="max-w-lg">
      <div className="p-6 space-y-4">
        <FormInput label="Mã sản phẩm" value={formData.product_code} onChange={(e: any) => setFormData({...formData, product_code: e.target.value})} placeholder="SP001" required />
        <FormInput label="Tên sản phẩm" value={formData.product_name} onChange={(e: any) => setFormData({...formData, product_name: e.target.value})} placeholder="Tên sản phẩm" required />
        <FormInput
          label="Giá tiêu chuẩn (VNĐ)"
          type="text"
          value={formatVietnameseCurrencyInput(formData.standard_price)}
          onChange={(e: any) =>
            setFormData({
              ...formData,
              standard_price: parseVietnameseCurrencyInput(e.target.value),
            })
          }
          placeholder="0"
        />
        <FormInput label="Đơn vị tính" value={formData.unit} onChange={(e: any) => setFormData({...formData, unit: e.target.value})} placeholder="Cái/Gói" />
        <FormSelect
          label="Trạng thái"
          value={formData.is_active === false ? '0' : '1'}
          onChange={(e: any) => setFormData({ ...formData, is_active: String(e.target.value) !== '0' })}
          options={[
            { value: '1', label: 'Hoạt động' },
            { value: '0', label: 'Ngưng hoạt động' },
          ]}
        />
        <SearchableSelect
          label="Lĩnh vực kinh doanh"
          required
          options={businessOptions}
          value={String(formData.domain_id || '')}
          onChange={(value) => setFormData({ ...formData, domain_id: value })}
          placeholder="Chọn lĩnh vực"
        />
        <SearchableSelect
          label="Nhà cung cấp"
          required
          options={vendorOptions}
          value={String(formData.vendor_id || '')}
          onChange={(value) => setFormData({ ...formData, vendor_id: value })}
          placeholder="Chọn nhà cung cấp"
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">Mô tả</label>
          <textarea
            value={String(formData.description || '')}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Mô tả sản phẩm/dịch vụ"
            rows={3}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg">Hủy</button>
        <button onClick={() => onSave(formData)} className="px-4 py-2 bg-primary text-white rounded-lg">Lưu</button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteProductModal: React.FC<{ data: Product; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal title="Xóa sản phẩm" message={<p>Xóa sản phẩm <span className="font-bold">"{data.product_name}"</span>?</p>} onClose={onClose} onConfirm={onConfirm} />
);

export const CustomerFormModal: React.FC<{ type: 'ADD' | 'EDIT'; data?: Customer | null; onClose: () => void; onSave: (data: Partial<Customer>) => void }> = ({ type, data, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Customer>>({
    customer_code: data?.customer_code || '',
    customer_name: data?.customer_name || data?.company_name || '',
    tax_code: data?.tax_code || '',
    address: data?.address || '',
    uuid: data?.uuid || '',
  });

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm khách hàng' : 'Cập nhật khách hàng'} icon="domain" width="max-w-lg">
      <div className="p-6 space-y-4">
        <FormInput label="Mã khách hàng" value={formData.customer_code} onChange={(e: any) => setFormData({...formData, customer_code: e.target.value})} placeholder="KH001" required />
        <FormInput label="Tên khách hàng" value={formData.customer_name} onChange={(e: any) => setFormData({...formData, customer_name: e.target.value})} placeholder="Tên khách hàng" required />
        <FormInput label="Mã số thuế" value={formData.tax_code} onChange={(e: any) => setFormData({...formData, tax_code: e.target.value})} placeholder="010xxxxxx" required />
        <FormInput label="Địa chỉ" value={formData.address} onChange={(e: any) => setFormData({...formData, address: e.target.value})} placeholder="Địa chỉ công ty" />
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg">Hủy</button>
        <button onClick={() => onSave(formData)} className="px-4 py-2 bg-primary text-white rounded-lg">Lưu</button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteCustomerModal: React.FC<{ data: Customer; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal title="Xóa khách hàng" message={<p>Xóa khách hàng <span className="font-bold">"{data.customer_name}"</span>?</p>} onClose={onClose} onConfirm={onConfirm} />
);

export interface CusPersonnelFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: CustomerPersonnel | null;
  customers: Customer[];
  supportContactPositions: SupportContactPosition[];
  onClose: () => void;
  onSave: (data: Partial<CustomerPersonnel>) => void;
}

export const CusPersonnelFormModal: React.FC<CusPersonnelFormModalProps> = ({
  type,
  data,
  customers,
  supportContactPositions,
  onClose,
  onSave,
}) => {
  const normalizePositionCode = (value: unknown): string => String(value || '').trim().toUpperCase();
  const normalizeCusPersonnelStatusValue = (value: unknown): 'Active' | 'Inactive' => {
    const normalized = String(value || '').trim().toUpperCase();
    return normalized === 'INACTIVE' ? 'Inactive' : 'Active';
  };
  const defaultPosition = (supportContactPositions || []).find((position) => position.is_active !== false) || supportContactPositions?.[0] || null;

  const [formData, setFormData] = useState<Partial<CustomerPersonnel>>({
    fullName: data?.fullName || '',
    birthday: normalizeDateInputToIso(String(data?.birthday || '')) || '',
    positionType: String(data?.positionType || defaultPosition?.position_code || ''),
    positionId: data?.positionId ?? (defaultPosition?.id ?? null),
    positionLabel: data?.positionLabel || String(defaultPosition?.position_name || defaultPosition?.position_code || ''),
    phoneNumber: data?.phoneNumber || '',
    email: data?.email || '',
    customerId: data?.customerId || '',
    status: normalizeCusPersonnelStatusValue(data?.status || 'Active'),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const positionOptions = useMemo(() => {
    const options = (supportContactPositions || []).map((position) => ({
      value: String(position.id || ''),
      label: String(position.position_name || position.position_code || ''),
      id: String(position.id || ''),
      code: String(position.position_code || ''),
    }));

    const currentId = String(formData.positionId ?? '').trim();
    if (currentId && !options.some((option) => option.value === currentId)) {
      const fallbackCode = String(formData.positionType || '').trim();
      options.unshift({
        value: currentId,
        label: String(formData.positionLabel || data?.positionLabel || fallbackCode || `ID ${currentId}`),
        id: currentId,
        code: fallbackCode,
      });
    }

    return options;
  }, [supportContactPositions, formData.positionId, formData.positionType, formData.positionLabel, data?.positionLabel]);

  useEffect(() => {
    if (!positionOptions.length) {
      return;
    }

    setFormData((prev) => {
      const currentId = String(prev.positionId ?? '').trim();
      const currentCode = normalizePositionCode(prev.positionType);

      let selected = currentId
        ? positionOptions.find((option) => option.id === currentId)
        : null;

      if (!selected && currentCode) {
        selected = positionOptions.find((option) => normalizePositionCode(option.code) === currentCode) || null;
      }

      if (!selected && type === 'ADD') {
        selected = positionOptions[0] || null;
      }

      if (!selected) {
        return prev;
      }

      const nextId = selected.id;
      const nextCode = String(selected.code || '').trim();
      const nextLabel = String(selected.label || '').trim();

      if (
        String(prev.positionId ?? '').trim() === nextId
        && String(prev.positionType || '').trim() === nextCode
        && String(prev.positionLabel || '').trim() === nextLabel
      ) {
        return prev;
      }

      return {
        ...prev,
        positionType: nextCode,
        positionId: nextId,
        positionLabel: nextLabel,
      };
    });
  }, [positionOptions, type]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName) newErrors.fullName = 'Vui lòng nhập Họ và tên';
    if (!formData.customerId) newErrors.customerId = 'Vui lòng chọn Khách hàng';
    if (!String(formData.positionId || '').trim()) newErrors.positionId = 'Vui lòng chọn Chức vụ';
    const normalizedBirthday = normalizeDateInputToIso(String(formData.birthday || ''));
    if (formData.birthday && !normalizedBirthday) {
      newErrors.birthday = 'Ngày sinh không hợp lệ (dd/mm/yyyy hoặc yyyy-mm-dd).';
    } else if (normalizedBirthday && !isAgeInAllowedRange(normalizedBirthday)) {
      newErrors.birthday = AGE_RANGE_ERROR_MESSAGE;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Email không hợp lệ';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      const normalizedBirthday = normalizeDateInputToIso(String(formData.birthday || ''));
      const selectedPosition = positionOptions.find((option) => option.value === String(formData.positionId || ''));
      onSave({
        ...formData,
        birthday: normalizedBirthday || '',
        positionType: selectedPosition?.code || String(formData.positionType || ''),
        positionId: selectedPosition?.id ?? formData.positionId ?? null,
        positionLabel: selectedPosition?.label || formData.positionLabel || null,
        status: normalizeCusPersonnelStatusValue(formData.status || 'Active'),
      });
    }
  };

  const handleChange = (field: keyof CustomerPersonnel, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <ModalWrapper
      onClose={onClose}
      title={type === 'ADD' ? 'Thêm Nhân sự liên hệ' : 'Cập nhật Nhân sự liên hệ'}
      icon="contact_phone"
      width="max-w-3xl"
      maxHeightClass="max-h-[98vh]"
    >
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        
        <div className="col-span-1">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Họ và tên <span className="text-red-500">*</span></label>
          <input 
            type="text" 
            value={formData.fullName}
            onChange={(e) => handleChange('fullName', e.target.value)}
            placeholder="Nhập họ và tên"
            className={`w-full h-11 px-4 rounded-lg border ${errors.fullName ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'} bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all`}
          />
          {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
        </div>

        <div className="col-span-1">
          <FormInput
            label="Ngày sinh"
            type="date"
            value={formData.birthday || ''}
            onChange={(e: any) => handleChange('birthday', e.target.value)}
            error={errors.birthday}
          />
        </div>

        <div className="col-span-1">
          <SearchableSelect
            label="Chức vụ"
            options={positionOptions.map((position) => ({ value: position.value, label: position.label }))}
            value={String(formData.positionId || '')}
            onChange={(value) => {
              const selectedPosition = positionOptions.find((option) => option.value === String(value || ''));
              handleChange('positionId', selectedPosition?.id ?? null);
              handleChange('positionType', selectedPosition?.code || '');
              handleChange('positionLabel', selectedPosition?.label ?? null);
            }}
            error={errors.positionId}
            placeholder="Chọn chức vụ"
          />
        </div>

        <div className="col-span-1">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Số điện thoại</label>
          <input 
            type="tel"
            className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
            placeholder="091xxxxxxx"
            value={formData.phoneNumber || ''}
            onChange={(e) => handleChange('phoneNumber', e.target.value)}
          />
        </div>

        <div className="col-span-1">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
          <input 
            type="email"
            className={`w-full h-11 px-4 rounded-lg border ${errors.email ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'} bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all`}
            placeholder="example@domain.com"
            value={formData.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
          />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
        </div>

        <div className="col-span-1">
          <SearchableSelect
            label="Trạng thái"
            options={[
              { value: 'Active', label: 'Hoạt động' },
              { value: 'Inactive', label: 'Không hoạt động' },
            ]}
            value={String(formData.status || 'Active')}
            onChange={(value) => handleChange('status', normalizeCusPersonnelStatusValue(value))}
            placeholder="Chọn trạng thái"
          />
        </div>

        <div className="col-span-2">
            <SearchableSelect 
                label="Khách hàng"
                required
                options={customers.map(c => ({ value: String(c.id), label: `${c.customer_code} - ${c.customer_name}` }))}
                value={formData.customerId || ''}
                onChange={(val) => handleChange('customerId', val)}
                error={errors.customerId}
                placeholder="Chọn khách hàng"
            />
        </div>

      </div>
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
        <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors">Hủy</button>
        <button onClick={handleSubmit} className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-deep-teal shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
           <span className="material-symbols-outlined text-lg">check</span> {type === 'ADD' ? 'Lưu' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteCusPersonnelModal: React.FC<{ data: CustomerPersonnel; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal 
     title="Xóa nhân sự liên hệ" 
     message={<p>Bạn có chắc chắn muốn xóa nhân sự <span className="font-bold text-slate-900">"{data.fullName}"</span>? Dữ liệu sẽ không thể khôi phục.</p>}
     onClose={onClose} 
     onConfirm={onConfirm}
  />
);

export interface OpportunityFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: Opportunity | null;
  opportunityStageOptions: OpportunityStageOption[];
  customers: Customer[];
  personnel: CustomerPersonnel[];
  products: Product[];
  employees: Employee[];
  onClose: () => void;
  onSave: (data: Partial<Opportunity>) => void;
}

const KNOWN_OPPORTUNITY_STAGE_LABELS: Record<string, string> = {
  NEW: 'Mới',
  PROPOSAL: 'Đề xuất',
  NEGOTIATION: 'Đàm phán',
  WON: 'Thắng',
  LOST: 'Thất bại',
};

const normalizeOpportunityStageCode = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toUpperCase();

const sortOpportunityStageDefinitions = (
  left: OpportunityStageOption,
  right: OpportunityStageOption
): number => {
  const leftSort = Number(left.sort_order ?? 0);
  const rightSort = Number(right.sort_order ?? 0);

  if (leftSort !== rightSort) {
    return leftSort - rightSort;
  }

  return String(left.stage_name || left.stage_code || '').localeCompare(
    String(right.stage_name || right.stage_code || ''),
    'vi'
  );
};

export const OpportunityFormModal: React.FC<OpportunityFormModalProps> = ({ 
  type,
  data,
  opportunityStageOptions = [],
  customers,
  onClose,
  onSave
}) => {
  const initialAmountRaw = Number(data?.amount ?? 0);
  const initialAmount = Number.isFinite(initialAmountRaw) ? initialAmountRaw : 0;
  const initialStageCode = (() => {
    const fromData = normalizeOpportunityStageCode(data?.stage || '');
    if (fromData) {
      return fromData;
    }

    const firstActiveStage = (opportunityStageOptions || [])
      .filter((stage) => stage.is_active !== false)
      .slice()
      .sort(sortOpportunityStageDefinitions)[0];
    const fallback = normalizeOpportunityStageCode(firstActiveStage?.stage_code || 'NEW');

    return fallback || 'NEW';
  })();

  const [formData, setFormData] = useState<Partial<Opportunity>>({
    opp_name: data?.opp_name || '',
    customer_id: data?.customer_id || '',
    amount: initialAmount,
    stage: initialStageCode as OpportunityStage,
  });

  const [amountInput, setAmountInput] = useState<string>(() => {
    if (initialAmount <= 0) {
      return '';
    }
    return formatVietnameseCurrencyInput(Number(initialAmount.toFixed(2)));
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const syncedAmountRaw = Number(data?.amount ?? 0);
    const syncedAmount = Number.isFinite(syncedAmountRaw) ? syncedAmountRaw : 0;
    const syncedStageCode = normalizeOpportunityStageCode(data?.stage || initialStageCode) || 'NEW';

    setFormData({
      opp_name: data?.opp_name || '',
      customer_id: data?.customer_id || '',
      amount: syncedAmount,
      stage: syncedStageCode as OpportunityStage,
    });
    setAmountInput(syncedAmount > 0 ? formatVietnameseCurrencyInput(Number(syncedAmount.toFixed(2))) : '');
    setErrors({});
  }, [data?.id, data?.opp_name, data?.customer_id, data?.amount, data?.stage, initialStageCode]);

  const stageDefinitionByCode = useMemo(() => {
    const map = new Map<string, OpportunityStageOption>();

    (opportunityStageOptions || []).forEach((stage) => {
      const code = normalizeOpportunityStageCode(stage.stage_code);
      if (!code || map.has(code)) {
        return;
      }
      map.set(code, stage);
    });

    Object.entries(KNOWN_OPPORTUNITY_STAGE_LABELS).forEach(([code, label]) => {
      if (!map.has(code)) {
        map.set(code, {
          id: null,
          stage_code: code,
          stage_name: label,
          is_active: true,
          sort_order: 0,
        });
      }
    });

    return map;
  }, [opportunityStageOptions]);

  const stageSelectOptions = useMemo(() => {
    const options = (opportunityStageOptions || [])
      .filter((stage) => stage.is_active !== false)
      .slice()
      .sort(sortOpportunityStageDefinitions)
      .map((stage) => {
        const code = normalizeOpportunityStageCode(stage.stage_code);
        return {
          value: code,
          label: stage.stage_name || KNOWN_OPPORTUNITY_STAGE_LABELS[code] || code,
        };
      })
      .filter((item) => item.value !== '');

    const currentStageCode = normalizeOpportunityStageCode(formData.stage);
    if (currentStageCode && !options.some((item) => item.value === currentStageCode)) {
      const currentDefinition = stageDefinitionByCode.get(currentStageCode);
      const baseLabel = currentDefinition?.stage_name || KNOWN_OPPORTUNITY_STAGE_LABELS[currentStageCode] || currentStageCode;
      const inactiveSuffix = currentDefinition && currentDefinition.is_active === false ? ' (ngưng hoạt động)' : '';
      options.push({
        value: currentStageCode,
        label: `${baseLabel}${inactiveSuffix}`,
      });
    }

    if (options.length > 0) {
      return options;
    }

    return Object.entries(KNOWN_OPPORTUNITY_STAGE_LABELS).map(([code, label]) => ({
      value: code,
      label,
    }));
  }, [opportunityStageOptions, formData.stage, stageDefinitionByCode]);

  const defaultStageCode = useMemo(() => {
    const firstCode = normalizeOpportunityStageCode(stageSelectOptions[0]?.value || 'NEW');
    return firstCode || 'NEW';
  }, [stageSelectOptions]);

  const selectedStageCode = normalizeOpportunityStageCode(formData.stage);
  const selectedStageDefinition = stageDefinitionByCode.get(selectedStageCode);
  const isSelectedStageInactive = Boolean(selectedStageDefinition && selectedStageDefinition.is_active === false);

  const amountInWords = useMemo(() => {
    if (!amountInput.trim()) {
      return '';
    }
    return formatVietnameseAmountInWords(amountInput);
  }, [amountInput]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.opp_name) newErrors.opp_name = 'Vui lòng nhập Tên cơ hội';
    if (!formData.customer_id) newErrors.customer_id = 'Vui lòng chọn Khách hàng';
    if (!normalizeOpportunityStageCode(formData.stage)) newErrors.stage = 'Vui lòng chọn Giai đoạn';
    if (!formData.amount || Number(formData.amount) <= 0) newErrors.amount = 'Giá trị kỳ vọng phải lớn hơn 0';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      const normalizedAmount = Number(Number(formData.amount || 0).toFixed(2));
      const stageCode = normalizeOpportunityStageCode(formData.stage || defaultStageCode) || defaultStageCode;
      const payload: Partial<Opportunity> = {
        ...formData,
        amount: Number.isFinite(normalizedAmount) ? normalizedAmount : 0,
        stage: stageCode as OpportunityStage,
      };

      const originalStageCode = normalizeOpportunityStageCode(data?.stage || '');
      if (
        type === 'EDIT' &&
        originalStageCode &&
        stageCode === originalStageCode &&
        stageDefinitionByCode.get(originalStageCode)?.is_active === false
      ) {
        delete payload.stage;
      }

      onSave(payload);
    }
  };

  const handleChange = (field: keyof Opportunity, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleAmountInputChange = (value: string) => {
    const sanitizedValue = sanitizeVietnameseCurrencyDraft(value);
    setAmountInput(sanitizedValue);

    const parsedAmount = sanitizedValue ? parseVietnameseCurrencyInput(sanitizedValue) : 0;
    setFormData((prev) => ({
      ...prev,
      amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
    }));
    if (errors.amount) {
      setErrors((prev) => ({ ...prev, amount: '' }));
    }
  };

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm Cơ hội kinh doanh' : 'Cập nhật Cơ hội'} icon="lightbulb" width="max-w-3xl">
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        
        <div className="col-span-2">
           <label className="block text-sm font-semibold text-slate-700 mb-2">Tên cơ hội <span className="text-red-500">*</span></label>
           <input 
              type="text" 
              value={formData.opp_name}
              onChange={(e) => handleChange('opp_name', e.target.value)}
              placeholder="VD: Triển khai phần mềm quản lý cho..."
              className={`w-full h-11 px-4 rounded-lg border ${errors.opp_name ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'} bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all`}
           />
           {errors.opp_name && <p className="text-xs text-red-500 mt-1">{errors.opp_name}</p>}
        </div>

        <div className="col-span-1">
            <SearchableSelect 
                label="Khách hàng"
                required
                options={customers.map(c => ({ value: String(c.id), label: `${c.customer_code} - ${c.customer_name}` }))}
                value={formData.customer_id ? String(formData.customer_id) : ''}
                onChange={(val) => handleChange('customer_id', val)}
                error={errors.customer_id}
                placeholder="Chọn khách hàng"
            />
        </div>

        <div className="col-span-1">
          <SearchableSelect
            label="Giai đoạn"
            required
            options={stageSelectOptions}
            value={selectedStageCode || defaultStageCode}
            onChange={(value) => handleChange('stage', normalizeOpportunityStageCode(value) as OpportunityStage)}
            placeholder="Chọn giai đoạn"
            error={errors.stage}
          />
          {isSelectedStageInactive && (
            <p className="text-xs text-amber-700 mt-1">
              Giai đoạn hiện tại đã ngưng hoạt động, vui lòng chọn giai đoạn đang hoạt động nếu muốn thay đổi.
            </p>
          )}
        </div>

        <div className="col-span-1">
           <label className="block text-sm font-semibold text-slate-700 mb-2">Giá trị kỳ vọng (VNĐ)</label>
           <input 
              type="text"
              inputMode="decimal"
              placeholder="VD: 1.500.000,25"
              value={amountInput}
              onChange={(e) => handleAmountInputChange(e.target.value)}
              className={`w-full h-11 px-4 rounded-lg border ${errors.amount ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'} bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all`}
           />
           {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
        </div>

        <div className="col-span-1"></div>

        {amountInput && (
          <div className="col-span-2 -mt-2">
            <div
              className={`rounded-lg border px-4 py-3 ${
                amountInWords === 'Giá trị không hợp lệ'
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-primary/30 bg-primary/5 text-deep-teal'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">Bằng chữ</p>
              <p className="text-sm font-semibold leading-relaxed">{amountInWords}</p>
            </div>
          </div>
        )}

        <div className="col-span-2 pb-20"></div>

      </div>
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 absolute bottom-0 left-0 right-0 z-[60]">
        <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors">Hủy</button>
        <button onClick={handleSubmit} className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-deep-teal shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
           <span className="material-symbols-outlined text-lg">check</span> {type === 'ADD' ? 'Lưu' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteOpportunityModal: React.FC<{ data: Opportunity; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal 
     title="Xóa Cơ hội" 
     message={<p>Bạn có chắc chắn muốn xóa cơ hội <span className="font-bold text-slate-900">"{data.opp_name || data.name}"</span>? Dữ liệu sẽ không thể khôi phục.</p>}
     onClose={onClose} 
     onConfirm={onConfirm}
  />
);

// --- Project Modals ---

interface ProjectFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: Project | null;
  initialTab?: 'info' | 'items' | 'raci';
  customers: Customer[];
  opportunities: Opportunity[];
  products: Product[];
  projectItems?: ProjectItemMaster[];
  employees: Employee[];
  departments: Department[];
  onClose: () => void;
  onSave: (data: Partial<Project>) => void;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
  onImportProjectItemsBatch?: (
    groups: ProjectItemImportBatchGroup[]
  ) => Promise<ProjectItemImportBatchResult>;
  onImportProjectRaciBatch?: (
    groups: ProjectRaciImportBatchGroup[]
  ) => Promise<ProjectRaciImportBatchResult>;
}

interface ProjectItemImportSummary {
  success: number;
  failed: number;
  warnings: string[];
  errors: string[];
}

const normalizeProjectItemImportToken = (value: unknown): string =>
  String(value ?? '')
    .replace(/\uFEFF/g, '')
    .trim()
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({ 
  type,
  data,
  initialTab = 'info',
  customers,
  opportunities,
  products,
  projectItems = [],
  employees,
  departments,
  onClose,
  onSave,
  onNotify,
  onImportProjectItemsBatch,
  onImportProjectRaciBatch,
}) => {
  const getLocalIsoDate = () => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60 * 1000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
  };
  const todayIsoDate = getLocalIsoDate();
  const isPersistedProject = type === 'EDIT' && Boolean(data?.id);

  const [formData, setFormData] = useState<Partial<Project>>({
    project_code: data?.project_code || '',
    project_name: data?.project_name || '',
    customer_id: data?.customer_id || '',
    opportunity_id: data?.opportunity_id || '',
    investment_mode: data?.investment_mode || 'DAU_TU',
    start_date: data?.start_date || (type === 'ADD' ? todayIsoDate : ''),
    expected_end_date: data?.expected_end_date || '',
    actual_end_date: data?.actual_end_date || todayIsoDate,
    status: data?.status || 'TRIAL',
    items: data?.items,
    raci: data?.raci
  });
  
  const [activeTab, setActiveTab] = useState<'info' | 'items' | 'raci'>(initialTab);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showItemImportMenu, setShowItemImportMenu] = useState(false);
  const [showItemImportModal, setShowItemImportModal] = useState(false);
  const [isItemImportSaving, setIsItemImportSaving] = useState(false);
  const [itemImportLoadingText, setItemImportLoadingText] = useState('');
  const [itemImportSummary, setItemImportSummary] = useState<ProjectItemImportSummary | null>(null);
  const itemImportInFlightRef = useRef(false);
  const itemImportMenuRef = useRef<HTMLDivElement>(null);
  const [showRaciImportMenu, setShowRaciImportMenu] = useState(false);
  const [showRaciImportModal, setShowRaciImportModal] = useState(false);
  const [isRaciImportSaving, setIsRaciImportSaving] = useState(false);
  const [raciImportLoadingText, setRaciImportLoadingText] = useState('');
  const [raciImportSummary, setRaciImportSummary] = useState<ProjectItemImportSummary | null>(null);
  const raciImportInFlightRef = useRef(false);
  const raciImportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showItemImportMenu) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!itemImportMenuRef.current) {
        return;
      }
      if (!itemImportMenuRef.current.contains(event.target as Node)) {
        setShowItemImportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showItemImportMenu]);

  useEffect(() => {
    if (!showRaciImportMenu) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!raciImportMenuRef.current) {
        return;
      }
      if (!raciImportMenuRef.current.contains(event.target as Node)) {
        setShowRaciImportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRaciImportMenu]);

  useEffect(() => {
    if (activeTab !== 'items') {
      setShowItemImportMenu(false);
      setShowItemImportModal(false);
    }
    if (activeTab !== 'raci') {
      setShowRaciImportMenu(false);
      setShowRaciImportModal(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, type, data?.id]);

  useEffect(() => {
    if (!isPersistedProject && activeTab !== 'info') {
      setActiveTab('info');
    }
  }, [activeTab, isPersistedProject]);

  // Helper to get name
  const getCustomerName = (id: string | number) => {
    const customer = customers.find(c => String(c.id) === String(id));
    return customer ? `${customer.customer_code} - ${customer.customer_name}` : String(id);
  };
  const getOpportunityName = (id: string) => opportunities.find(o => String(o.id) === id)?.opp_name || id;

  const productLookupMap = useMemo(() => {
    const lookup = new Map<string, Product>();
    const register = (rawKey: unknown, product: Product) => {
      const key = normalizeProjectItemImportToken(rawKey);
      if (!key || lookup.has(key)) {
        return;
      }
      lookup.set(key, product);
    };

    (products || []).forEach((product) => {
      register(product.id, product);
      register(product.product_code, product);
      register(product.product_name, product);
    });

    return lookup;
  }, [products]);

  const employeeLookupMap = useMemo(() => {
    const lookup = new Map<string, Employee>();
    const register = (rawKey: unknown, employee: Employee) => {
      const key = normalizeProjectItemImportToken(rawKey);
      if (!key || lookup.has(key)) {
        return;
      }
      lookup.set(key, employee);
    };

    (employees || []).forEach((employee) => {
      register(employee.id, employee);
      register(employee.user_code, employee);
      register(employee.employee_code, employee);
      register(employee.username, employee);
      register(employee.full_name, employee);
    });

    return lookup;
  }, [employees]);

  const projectItemLookupByCode = useMemo(() => {
    const lookup = new Map<string, ProjectItemMaster[]>();
    const register = (rawKey: unknown, item: ProjectItemMaster) => {
      const key = normalizeProjectItemImportToken(rawKey);
      if (!key) {
        return;
      }
      const bucket = lookup.get(key) || [];
      const itemId = String(item.id ?? '');
      if (!bucket.some((candidate) => String(candidate.id ?? '') === itemId)) {
        bucket.push(item);
      }
      lookup.set(key, bucket);
    };

    (projectItems || []).forEach((item) => {
      const source = item as Record<string, unknown>;
      register(item.id, item);
      register(source.project_item_code, item);
      register(source.item_code, item);
      register(source.code, item);
      register(source.project_item_name, item);
      register(source.item_name, item);
      register(item.display_name, item);
    });

    return lookup;
  }, [projectItems]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.project_code) newErrors.project_code = 'Mã dự án là bắt buộc';
    if (!formData.project_name) newErrors.project_name = 'Tên dự án là bắt buộc';
    if (!formData.start_date) newErrors.start_date = 'Ngày bắt đầu là bắt buộc';
    if (
      formData.start_date &&
      formData.expected_end_date &&
      String(formData.start_date) > String(formData.expected_end_date)
    ) {
      newErrors.start_date = 'Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc';
      newErrors.expected_end_date = 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  // --- Helpers for Formatting ---
  const formatNumber = (num: number | string | undefined | null) => {
    if (num === undefined || num === null || num === '') return '';
    if (typeof num === 'string') return num; // Return raw string if typing
    // Use Intl for correct formatting (VN: dots for thousands, comma for decimal)
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(num);
  };

  const parseNumber = (str: string | number) => {
    if (typeof str === 'number') return str;
    // Remove dots (thousands), replace comma with dot (decimal)
    const normalized = str.replace(/\./g, '').replace(/,/g, '.');
    return parseFloat(normalized) || 0;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)}%`;
  };

  const handleDownloadProjectItemTemplate = () => {
    setShowItemImportMenu(false);
    downloadExcelWorkbook('mau_nhap_hang_muc_du_an', [
      {
        name: 'DuAn',
        headers: [
          'Mã dự án',
          'Tên dự án',
        ],
        rows: [
          ['DA001', 'Dự án VNPT HIS'],
          ['DA002', 'Dự án SOC'],
        ],
      },
      {
        name: 'HangMuc',
        headers: ['Mã dự án', 'Mã sản phẩm', 'Số lượng', 'Đơn giá', '% CK', 'Giảm giá'],
        rows: [
          ['DA001', 'SP001', 2, 1500000, 10, ''],
          ['DA002', 'SP002', 1, 2000000, '', 100000],
        ],
      },
    ]);
  };

  const handleDownloadProjectRaciTemplate = () => {
    setShowRaciImportMenu(false);
    downloadExcelWorkbook('mau_nhap_doi_ngu_du_an', [
      {
        name: 'MaHangMuc',
        headers: [
          'Mã hạng mục dự án',
          'Tên hạng mục dự án',
        ],
        rows: [
          ['HM-DA001-01', 'Hạng mục HIS Core'],
          ['HM-DA001-02', 'Hạng mục HIS Report'],
        ],
      },
      {
        name: 'RACI',
        headers: [
          'Mã hạng mục dự án',
          'Mã nhân sự',
          'Vai trò RACI',
          'Ngày phân công',
        ],
        rows: [
          ['HM-DA001-01', 'NV001', 'A', '01/03/2026'],
          ['HM-DA001-02', 'NV001', 'R', '01/03/2026'],
        ],
      },
    ]);
  };

  const withMinimumDelay = async <T,>(runner: () => Promise<T>, minimumMs: number): Promise<T> => {
    const startedAt = Date.now();
    try {
      const result = await runner();
      const elapsed = Date.now() - startedAt;
      if (elapsed < minimumMs) {
        await new Promise((resolve) => setTimeout(resolve, minimumMs - elapsed));
      }
      return result;
    } catch (error) {
      const elapsed = Date.now() - startedAt;
      if (elapsed < minimumMs) {
        await new Promise((resolve) => setTimeout(resolve, minimumMs - elapsed));
      }
      throw error;
    }
  };

  const triggerProjectItemImport = () => {
    if (!isPersistedProject) {
      onNotify?.('error', 'Dự án chưa lưu', 'Vui lòng lưu dự án thành công trước khi nhập hạng mục.');
      return;
    }
    if (itemImportInFlightRef.current || isItemImportSaving) {
      return;
    }
    setShowItemImportMenu(false);
    setShowItemImportModal(true);
  };

  const triggerProjectRaciImport = () => {
    if (!isPersistedProject) {
      onNotify?.('error', 'Dự án chưa lưu', 'Vui lòng lưu dự án thành công trước khi nhập đội ngũ dự án.');
      return;
    }
    if (raciImportInFlightRef.current || isRaciImportSaving) {
      return;
    }
    setShowRaciImportMenu(false);
    setShowRaciImportModal(true);
  };

  const handleTabSwitch = (tab: 'info' | 'items' | 'raci') => {
    if (tab === 'info') {
      setActiveTab('info');
      return;
    }

    if (!isPersistedProject) {
      onNotify?.('error', 'Dự án chưa lưu', 'Vui lòng lưu dự án thành công trước khi nhập Hạng mục và Đội ngũ dự án.');
      return;
    }

    setActiveTab(tab);
  };

  const buildProjectItemHeaderIndex = (headers: string[]): Map<string, number> => {
    const indexMap = new Map<string, number>();
    (headers || []).forEach((header, index) => {
      const token = normalizeProjectItemImportToken(header);
      if (!token || indexMap.has(token)) {
        return;
      }
      indexMap.set(token, index);
    });
    return indexMap;
  };

  const getProjectItemImportCell = (
    row: string[],
    headerIndex: Map<string, number>,
    aliases: string[]
  ): string => {
    for (const alias of aliases) {
      const key = normalizeProjectItemImportToken(alias);
      const index = headerIndex.get(key);
      if (typeof index === 'number' && index >= 0 && index < row.length) {
        return String(row[index] ?? '').trim();
      }
    }
    return '';
  };

  const normalizeRaciRoleImport = (value: string): 'R' | 'A' | 'C' | 'I' | null => {
    const raw = String(value || '').trim().toUpperCase();
    if (['R', 'A', 'C', 'I'].includes(raw)) {
      return raw as 'R' | 'A' | 'C' | 'I';
    }

    const token = normalizeProjectItemImportToken(value);
    if (token === 'responsible' || token === 'thuchien') return 'R';
    if (token === 'accountable' || token === 'chiutrachnhiem') return 'A';
    if (token === 'consulted' || token === 'thamkhao') return 'C';
    if (token === 'informed' || token === 'duocthongbao') return 'I';
    return null;
  };

  const mergeImportedProjectItems = (
    existingItems: ProjectItem[],
    importedItems: ProjectItem[]
  ): ProjectItem[] => {
    const nextItems = [...(existingItems || [])];
    const existingIndexByProduct = new Map<string, number>();
    nextItems.forEach((item, index) => {
      const key = normalizeProjectItemImportToken(item.productId || item.product_id || '');
      if (!key || existingIndexByProduct.has(key)) {
        return;
      }
      existingIndexByProduct.set(key, index);
    });

    importedItems.forEach((importedItem) => {
      const productKey = normalizeProjectItemImportToken(importedItem.productId || '');
      if (!productKey) {
        return;
      }
      const existingIndex = existingIndexByProduct.get(productKey);
      if (existingIndex !== undefined) {
        const preservedId = nextItems[existingIndex]?.id || importedItem.id;
        nextItems[existingIndex] = {
          ...nextItems[existingIndex],
          ...importedItem,
          id: preservedId,
        };
        return;
      }

      nextItems.push(importedItem);
    });

    return nextItems;
  };

  const mergeImportedProjectRaci = (
    existingRaci: ProjectRACI[],
    importedRaci: ProjectRACI[]
  ): ProjectRACI[] => {
    const next = [...(existingRaci || [])];
    const indexByIdentity = new Map<string, number>();
    next.forEach((item, index) => {
      const identity = `${String(item.userId || '').trim()}|${String(item.roleType || '').trim().toUpperCase()}`;
      if (!identity || indexByIdentity.has(identity)) {
        return;
      }
      indexByIdentity.set(identity, index);
    });

    importedRaci.forEach((item) => {
      const identity = `${String(item.userId || '').trim()}|${String(item.roleType || '').trim().toUpperCase()}`;
      if (!identity) {
        return;
      }
      const currentIndex = indexByIdentity.get(identity);
      if (currentIndex !== undefined) {
        const preservedId = next[currentIndex]?.id || item.id;
        next[currentIndex] = {
          ...next[currentIndex],
          ...item,
          id: preservedId,
        };
        return;
      }
      next.push(item);
    });

    return next;
  };

  const handleProjectItemsImportSave = async (payload: ImportPayload) => {
    if (itemImportInFlightRef.current || isItemImportSaving) {
      return;
    }

    itemImportInFlightRef.current = true;
    setIsItemImportSaving(true);
    setItemImportLoadingText('Đang xử lý hạng mục dự án...');
    setItemImportSummary(null);

    try {
      await withMinimumDelay(async () => {
        const lowerName = String(payload.fileName || '').toLowerCase();
        if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
          const nextSummary = {
            success: 0,
            failed: 1,
            warnings: [],
            errors: ['File nhập chỉ hỗ trợ định dạng Excel (.xlsx, .xls).'],
          };
          setItemImportSummary(nextSummary);
          onNotify?.('error', 'Nhập hạng mục dự án', nextSummary.errors[0]);
          return;
        }

        const allSheets = (payload.sheets && payload.sheets.length > 0)
          ? payload.sheets
          : [{
            name: payload.sheetName || 'Sheet1',
            headers: payload.headers || [],
            rows: payload.rows || [],
          }];

        const findSheet = (keywords: string[], fallbackToFirst = false) => {
          const byName = allSheets.find((sheet) => {
            const token = normalizeProjectItemImportToken(sheet.name || '');
            return keywords.some((keyword) => token.includes(keyword));
          });
          if (byName) {
            return byName;
          }
          if (!fallbackToFirst) {
            return undefined;
          }
          return allSheets.find((sheet) => (sheet.headers || []).length > 0);
        };

        const hangMucSheet = findSheet(['hangmuc', 'projectitem', 'item'], true) || {
          name: payload.sheetName || 'HangMuc',
          headers: payload.headers || [],
          rows: payload.rows || [],
        };
        const duAnSheet = findSheet(['duan', 'project']);

        const projectCodeByToken = new Map<string, string>();
        const projectCodeByNameToken = new Map<string, string>();
        if (duAnSheet && (duAnSheet.headers || []).length > 0) {
          const projectHeaderIndex = buildProjectItemHeaderIndex(duAnSheet.headers || []);
          (duAnSheet.rows || []).forEach((row) => {
            const codeRaw = getProjectItemImportCell(row, projectHeaderIndex, ['maduan', 'projectcode', 'code']);
            const nameRaw = getProjectItemImportCell(row, projectHeaderIndex, ['duan', 'project', 'tenduan', 'projectname', 'name']);
            const code = String(codeRaw || '').trim();
            if (!code) {
              return;
            }
            const codeToken = normalizeProjectItemImportToken(code);
            if (!projectCodeByToken.has(codeToken)) {
              projectCodeByToken.set(codeToken, code);
            }
            const nameToken = normalizeProjectItemImportToken(nameRaw);
            if (nameToken && !projectCodeByNameToken.has(nameToken)) {
              projectCodeByNameToken.set(nameToken, code);
            }
          });
        }

        const headerIndex = buildProjectItemHeaderIndex(hangMucSheet.headers || []);
        const normalizedRows = (hangMucSheet.rows || []).filter((row) =>
          (row || []).some((cell) => String(cell || '').trim().length > 0)
        );

        if (normalizedRows.length === 0) {
          const nextSummary = {
            success: 0,
            failed: 1,
            warnings: [],
            errors: ['Không có dòng dữ liệu hợp lệ để nhập.'],
          };
          setItemImportSummary(nextSummary);
          onNotify?.('error', 'Nhập hạng mục dự án', nextSummary.errors[0]);
          return;
        }

        const warnings: string[] = [];
        const errors: string[] = [];
        const importRowsByProject = new Map<string, {
          project_code: string;
          itemsByProduct: Map<string, ProjectItem>;
        }>();

        normalizedRows.forEach((row, rowIndex) => {
          const lineNumber = rowIndex + 2;
          const projectCodeRaw = getProjectItemImportCell(row, headerIndex, ['maduan', 'projectcode', 'code']);
          const projectRefRaw = getProjectItemImportCell(row, headerIndex, ['duan', 'project', 'tenduan', 'projectname', 'name']);
          const productRaw = getProjectItemImportCell(row, headerIndex, [
            'masanpham',
            'sanpham',
            'product',
            'productcode',
            'productname',
            'product_id',
          ]);
          const quantityRaw = getProjectItemImportCell(row, headerIndex, ['soluong', 'sl', 'quantity']);
          const unitPriceRaw = getProjectItemImportCell(row, headerIndex, ['dongia', 'gia', 'unitprice', 'unit_price']);
          const discountPercentRaw = getProjectItemImportCell(row, headerIndex, [
            'ck',
            'chietkhau',
            'discountpercent',
            'discount_percent',
          ]);
          const discountAmountRaw = getProjectItemImportCell(row, headerIndex, [
            'giamgia',
            'discountamount',
            'discount_amount',
          ]);

          if (!projectCodeRaw && !projectRefRaw && !productRaw && !quantityRaw && !unitPriceRaw && !discountPercentRaw && !discountAmountRaw) {
            return;
          }

          const projectCodeToken = normalizeProjectItemImportToken(projectCodeRaw);
          const projectRefToken = normalizeProjectItemImportToken(projectRefRaw);
          let resolvedProjectCode = '';

          if (projectCodeToken && projectCodeByToken.has(projectCodeToken)) {
            resolvedProjectCode = projectCodeByToken.get(projectCodeToken) || '';
          } else if (projectCodeToken) {
            resolvedProjectCode = String(projectCodeRaw || '').trim();
          }

          if (!resolvedProjectCode && projectRefToken && projectCodeByNameToken.has(projectRefToken)) {
            resolvedProjectCode = projectCodeByNameToken.get(projectRefToken) || '';
          }

          if (
            resolvedProjectCode &&
            projectRefToken &&
            projectCodeByNameToken.has(projectRefToken)
          ) {
            const resolvedByRef = projectCodeByNameToken.get(projectRefToken) || '';
            if (
              resolvedByRef &&
              normalizeProjectItemImportToken(resolvedByRef) !== normalizeProjectItemImportToken(resolvedProjectCode)
            ) {
              errors.push(`Dòng ${lineNumber}: Mã dự án và cột Dự án không khớp nhau.`);
              return;
            }
          }

          if (!resolvedProjectCode) {
            errors.push(`Dòng ${lineNumber}: thiếu hoặc không xác định được Mã dự án.`);
            return;
          }

          if (!productRaw) {
            errors.push(`Dòng ${lineNumber}: thiếu mã/tên sản phẩm.`);
            return;
          }

          const product = productLookupMap.get(normalizeProjectItemImportToken(productRaw));
          if (!product) {
            errors.push(`Dòng ${lineNumber}: không tìm thấy sản phẩm "${productRaw}".`);
            return;
          }

          const quantity = parseNumber(quantityRaw);
          if (!Number.isFinite(quantity) || quantity <= 0) {
            errors.push(`Dòng ${lineNumber}: số lượng phải lớn hơn 0.`);
            return;
          }

          const unitPrice = unitPriceRaw === '' ? 0 : parseNumber(unitPriceRaw);
          if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            errors.push(`Dòng ${lineNumber}: đơn giá phải lớn hơn hoặc bằng 0.`);
            return;
          }

          const baseTotal = quantity * unitPrice;

          let discountPercent = discountPercentRaw === '' ? 0 : parseNumber(discountPercentRaw);
          if (!Number.isFinite(discountPercent)) {
            discountPercent = 0;
          }
          if (discountPercent < 0 || discountPercent > 100) {
            const clamped = Math.min(100, Math.max(0, discountPercent));
            warnings.push(`Dòng ${lineNumber}: % CK vượt ngưỡng, đã tự điều chỉnh về ${clamped}.`);
            discountPercent = clamped;
          }

          let discountAmount = discountAmountRaw === '' ? null : parseNumber(discountAmountRaw);
          if (discountAmount !== null && !Number.isFinite(discountAmount)) {
            discountAmount = 0;
          }

          let discountMode: ProjectItem['discountMode'] = undefined;
          if (discountAmount !== null) {
            if (discountAmount < 0 || discountAmount > baseTotal) {
              const clamped = Math.min(baseTotal, Math.max(0, discountAmount));
              warnings.push(`Dòng ${lineNumber}: Giảm giá vượt ngưỡng, đã tự điều chỉnh.`);
              discountAmount = clamped;
            }
            discountPercent = baseTotal > 0 ? Number(((discountAmount / baseTotal) * 100).toFixed(2)) : 0;
            discountMode = discountAmount > 0 ? 'AMOUNT' : undefined;
          } else {
            discountAmount = Math.round(baseTotal * (discountPercent / 100));
            discountMode = discountPercent > 0 ? 'PERCENT' : undefined;
          }

          const lineTotal = Math.max(0, baseTotal - (discountAmount || 0));
          const productKey = normalizeProjectItemImportToken(product.id);
          const normalizedProjectCode = String(resolvedProjectCode).trim().toUpperCase();
          const normalizedProjectToken = normalizeProjectItemImportToken(normalizedProjectCode);
          const projectGroup = importRowsByProject.get(normalizedProjectToken) || {
            project_code: normalizedProjectCode,
            itemsByProduct: new Map<string, ProjectItem>(),
          };

          if (projectGroup.itemsByProduct.has(productKey)) {
            warnings.push(`Dòng ${lineNumber}: sản phẩm "${productRaw}" bị trùng trong dự án "${normalizedProjectCode}", hệ thống dùng dòng sau.`);
          }

          projectGroup.itemsByProduct.set(productKey, {
            id: `ITEM_${Date.now()}_${lineNumber}`,
            productId: String(product.id),
            quantity,
            unitPrice,
            discountPercent,
            discountAmount: discountAmount || 0,
            lineTotal,
            discountMode,
          });
          importRowsByProject.set(normalizedProjectToken, projectGroup);
        });

        if (importRowsByProject.size === 0) {
          const nextSummary = {
            success: 0,
            failed: errors.length || 1,
            warnings,
            errors: errors.length > 0 ? errors : ['Không có dòng hợp lệ để nhập từ file Excel.'],
          };
          setItemImportSummary(nextSummary);
          onNotify?.('error', 'Nhập hạng mục dự án', nextSummary.errors[0]);
          return;
        }

        const groupedPayload: ProjectItemImportBatchGroup[] = Array.from(importRowsByProject.values()).map((group) => ({
          project_code: group.project_code,
          items: Array.from(group.itemsByProduct.values()).map((item) => ({
            product_id: Number(item.productId),
            quantity: Number(item.quantity) || 0,
            unit_price: Number(item.unitPrice) || 0,
          })),
        }));

        const currentProjectToken = normalizeProjectItemImportToken(formData.project_code || '');
        let batchResult: ProjectItemImportBatchResult | null = null;
        if (type === 'EDIT' && onImportProjectItemsBatch) {
          batchResult = await onImportProjectItemsBatch(groupedPayload);
        }

        const successfulProjectTokens = new Set<string>();
        if (batchResult) {
          (batchResult.success_projects || []).forEach((item) => {
            const token = normalizeProjectItemImportToken(item.project_code);
            if (token) {
              successfulProjectTokens.add(token);
            }
          });
        } else if (type === 'ADD') {
          if (currentProjectToken && importRowsByProject.has(currentProjectToken)) {
            successfulProjectTokens.add(currentProjectToken);
            const skippedProjects = importRowsByProject.size - 1;
            if (skippedProjects > 0) {
              warnings.push(`Đã bỏ qua ${skippedProjects} dự án khác trong file vì dự án mới chưa được lưu lên hệ thống.`);
            }
          } else if (!currentProjectToken) {
            errors.push('Vui lòng nhập Mã dự án ở tab Thông tin chung trước khi nhập hạng mục.');
          } else {
            errors.push('Không tìm thấy dòng hạng mục nào khớp với Mã dự án đang tạo.');
          }
        } else {
          groupedPayload.forEach((item) => {
            const token = normalizeProjectItemImportToken(item.project_code);
            if (token) {
              successfulProjectTokens.add(token);
            }
          });
        }

        if (currentProjectToken) {
          const currentProjectGroup = importRowsByProject.get(currentProjectToken);
          const shouldMergeCurrent = Boolean(currentProjectGroup) && (
            type === 'ADD' || successfulProjectTokens.has(currentProjectToken)
          );

          if (currentProjectGroup && shouldMergeCurrent) {
            const importedItems = Array.from(currentProjectGroup.itemsByProduct.values());
            setFormData((prev) => ({
              ...prev,
              items: mergeImportedProjectItems(prev.items || [], importedItems),
            }));
          }
        }

        if (batchResult?.failed_projects?.length) {
          batchResult.failed_projects.forEach((item) => {
            errors.push(`Dự án ${item.project_code}: ${item.message}`);
          });
        }

        if (importRowsByProject.size > 1) {
          warnings.push(`Đã xử lý ${importRowsByProject.size} dự án trong cùng một lần import theo Mã dự án.`);
        }

        let successCount = 0;
        if (successfulProjectTokens.size > 0) {
          importRowsByProject.forEach((group, token) => {
            if (successfulProjectTokens.has(token)) {
              successCount += group.itemsByProduct.size;
            }
          });
        }

        const nextSummary = {
          success: successCount,
          failed: errors.length,
          warnings,
          errors,
        };
        setItemImportSummary(nextSummary);
        if (nextSummary.success > 0) {
          onNotify?.('success', 'Nhập hạng mục dự án', `Đã áp dụng ${nextSummary.success} dòng hạng mục.`);
        }
        if (nextSummary.warnings.length > 0) {
          onNotify?.(
            'error',
            'Nhập hạng mục dự án',
            `Có ${nextSummary.warnings.length} cảnh báo. Vui lòng kiểm tra lại danh sách hạng mục.`
          );
        }
        if (nextSummary.errors.length > 0) {
          onNotify?.('error', 'Nhập hạng mục dự án', `Có ${nextSummary.errors.length} dòng lỗi đã được bỏ qua.`);
        }
        if (nextSummary.success > 0) {
          setShowItemImportModal(false);
        }
      }, 600);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể đọc file nhập hạng mục.';
      setItemImportSummary({
        success: 0,
        failed: 1,
        warnings: [],
        errors: [message],
      });
      onNotify?.('error', 'Nhập hạng mục dự án', message);
      throw error;
    } finally {
      setItemImportLoadingText('');
      setIsItemImportSaving(false);
      itemImportInFlightRef.current = false;
    }
  };

  const handleProjectRaciImportSave = async (payload: ImportPayload) => {
    if (raciImportInFlightRef.current || isRaciImportSaving) {
      return;
    }

    raciImportInFlightRef.current = true;
    setIsRaciImportSaving(true);
    setRaciImportLoadingText('Đang xử lý đội ngũ dự án...');
    setRaciImportSummary(null);

    try {
      await withMinimumDelay(async () => {
        const lowerName = String(payload.fileName || '').toLowerCase();
        if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
          const nextSummary = {
            success: 0,
            failed: 1,
            warnings: [],
            errors: ['File nhập chỉ hỗ trợ định dạng Excel (.xlsx, .xls).'],
          };
          setRaciImportSummary(nextSummary);
          onNotify?.('error', 'Nhập đội ngũ dự án', nextSummary.errors[0]);
          return;
        }

        const allSheets = (payload.sheets && payload.sheets.length > 0)
          ? payload.sheets
          : [{
            name: payload.sheetName || 'Sheet1',
            headers: payload.headers || [],
            rows: payload.rows || [],
          }];

        const findSheet = (keywords: string[], fallbackToFirst = false) => {
          const byName = allSheets.find((sheet) => {
            const token = normalizeProjectItemImportToken(sheet.name || '');
            return keywords.some((keyword) => token.includes(keyword));
          });
          if (byName) {
            return byName;
          }
          if (!fallbackToFirst) {
            return undefined;
          }
          return allSheets.find((sheet) => (sheet.headers || []).length > 0);
        };

        const raciSheet = findSheet(['raci', 'doingu', 'nhansu'], true) || {
          name: payload.sheetName || 'RACI',
          headers: payload.headers || [],
          rows: payload.rows || [],
        };
        const maHangMucSheet = findSheet(['mahangmuc', 'hangmuc', 'projectitem', 'item']);
        if (!maHangMucSheet || (maHangMucSheet.headers || []).length === 0) {
          const nextSummary = {
            success: 0,
            failed: 1,
            warnings: [],
            errors: ['Thiếu sheet tham chiếu "MaHangMuc". Vui lòng dùng đúng file mẫu đội ngũ dự án.'],
          };
          setRaciImportSummary(nextSummary);
          onNotify?.('error', 'Nhập đội ngũ dự án', nextSummary.errors[0]);
          return;
        }

        const warnings: string[] = [];
        const errors: string[] = [];

        const maHangMucHeaderIndex = buildProjectItemHeaderIndex(maHangMucSheet.headers || []);
        const maHangMucRows = (maHangMucSheet.rows || []).filter((row) =>
          (row || []).some((cell) => String(cell || '').trim().length > 0)
        );
        const maHangMucByToken = new Map<string, { code: string; name: string }>();
        maHangMucRows.forEach((row, rowIndex) => {
          const lineNumber = rowIndex + 2;
          const itemCodeRaw = getProjectItemImportCell(row, maHangMucHeaderIndex, [
            'mahangmucduan',
            'mahangmuc',
            'hangmucduan',
            'projectitemcode',
            'projectitemid',
            'projectitem',
            'itemcode',
            'itemid',
          ]);
          const itemNameRaw = getProjectItemImportCell(row, maHangMucHeaderIndex, [
            'tenhangmucduan',
            'tenhangmuc',
            'hangmucduan',
            'projectitemname',
            'itemname',
            'name',
          ]);
          if (!itemCodeRaw && !itemNameRaw) {
            return;
          }
          if (!itemCodeRaw) {
            errors.push(`Sheet MaHangMuc dòng ${lineNumber}: thiếu Mã hạng mục dự án.`);
            return;
          }
          const itemCode = String(itemCodeRaw || '').trim();
          const token = normalizeProjectItemImportToken(itemCode);
          if (!token) {
            errors.push(`Sheet MaHangMuc dòng ${lineNumber}: Mã hạng mục dự án không hợp lệ.`);
            return;
          }
          if (maHangMucByToken.has(token)) {
            warnings.push(`Sheet MaHangMuc dòng ${lineNumber}: mã hạng mục "${itemCode}" bị trùng, hệ thống dùng dòng sau.`);
          }
          maHangMucByToken.set(token, {
            code: itemCode,
            name: String(itemNameRaw || '').trim(),
          });
        });

        if (maHangMucByToken.size === 0) {
          const nextSummary = {
            success: 0,
            failed: errors.length || 1,
            warnings,
            errors: errors.length > 0 ? errors : ['Sheet MaHangMuc chưa có dữ liệu hợp lệ.'],
          };
          setRaciImportSummary(nextSummary);
          onNotify?.('error', 'Nhập đội ngũ dự án', nextSummary.errors[0]);
          return;
        }

        const headerIndex = buildProjectItemHeaderIndex(raciSheet.headers || []);
        const normalizedRows = (raciSheet.rows || []).filter((row) =>
          (row || []).some((cell) => String(cell || '').trim().length > 0)
        );

        if (normalizedRows.length === 0) {
          const nextSummary = {
            success: 0,
            failed: 1,
            warnings,
            errors: ['Không có dòng dữ liệu hợp lệ để nhập.'],
          };
          setRaciImportSummary(nextSummary);
          onNotify?.('error', 'Nhập đội ngũ dự án', nextSummary.errors[0]);
          return;
        }

        const importRowsByProject = new Map<string, {
          project_code: string;
          raciByIdentity: Map<string, { project_item_id: string | number; user_id: number; raci_role: 'R' | 'A' | 'C' | 'I'; assignedDate: string }>;
        }>();

        normalizedRows.forEach((row, rowIndex) => {
          const lineNumber = rowIndex + 2;
          const projectItemCodeRaw = getProjectItemImportCell(row, headerIndex, [
            'mahangmucduan',
            'mahangmuc',
            'hangmucduan',
            'projectitemcode',
            'projectitemid',
            'projectitem',
            'itemcode',
            'itemid',
          ]);
          const userRaw = getProjectItemImportCell(row, headerIndex, [
            'manhansu',
            'usercode',
            'userid',
            'nhansu',
            'employee',
            'user',
          ]);
          const roleRaw = getProjectItemImportCell(row, headerIndex, ['vaitroraci', 'vaitro', 'racirole', 'role']);
          const assignedDateRaw = getProjectItemImportCell(row, headerIndex, ['ngayphancong', 'assigneddate', 'ngaygiao']);

          if (!projectItemCodeRaw && !userRaw && !roleRaw && !assignedDateRaw) {
            return;
          }
          if (!projectItemCodeRaw) {
            errors.push(`Dòng ${lineNumber}: thiếu Mã hạng mục dự án.`);
            return;
          }

          const projectItemToken = normalizeProjectItemImportToken(projectItemCodeRaw);
          const referenceItem = maHangMucByToken.get(projectItemToken);
          if (!referenceItem) {
            errors.push(`Dòng ${lineNumber}: mã hạng mục "${projectItemCodeRaw}" không tồn tại trong sheet MaHangMuc.`);
            return;
          }

          const itemCandidates = projectItemLookupByCode.get(projectItemToken) || [];
          if (itemCandidates.length === 0) {
            errors.push(`Dòng ${lineNumber}: không tìm thấy mã hạng mục "${referenceItem.code}" trong hệ thống.`);
            return;
          }
          if (itemCandidates.length > 1) {
            const projectHints = Array.from(new Set(itemCandidates
              .map((candidate) => String(candidate.project_code || '').trim().toUpperCase())
              .filter((value) => value.length > 0)
            ));
            const hintText = projectHints.length > 0 ? ` (${projectHints.slice(0, 3).join(', ')})` : '';
            errors.push(`Dòng ${lineNumber}: mã hạng mục "${referenceItem.code}" bị trùng trên nhiều dự án${hintText}.`);
            return;
          }

          if (!userRaw) {
            errors.push(`Dòng ${lineNumber}: thiếu mã/tên nhân sự.`);
            return;
          }

          const raciRole = normalizeRaciRoleImport(roleRaw);
          if (!raciRole) {
            errors.push(`Dòng ${lineNumber}: vai trò RACI không hợp lệ (chỉ nhận R/A/C/I).`);
            return;
          }

          const employee = employeeLookupMap.get(normalizeProjectItemImportToken(userRaw));
          if (!employee) {
            errors.push(`Dòng ${lineNumber}: không tìm thấy nhân sự "${userRaw}".`);
            return;
          }

          const employeeId = Number(employee.id);
          if (!Number.isFinite(employeeId) || employeeId <= 0) {
            errors.push(`Dòng ${lineNumber}: mã nhân sự "${userRaw}" không hợp lệ.`);
            return;
          }

          const projectItem = itemCandidates[0];
          const source = projectItem as Record<string, unknown>;
          const resolvedProjectCode = String(projectItem.project_code || '').trim().toUpperCase();
          if (!resolvedProjectCode) {
            errors.push(`Dòng ${lineNumber}: không xác định được dự án từ mã hạng mục "${referenceItem.code}".`);
            return;
          }

          const referenceNameToken = normalizeProjectItemImportToken(referenceItem.name);
          const systemItemName = String(
            source.project_item_name ||
            source.item_name ||
            projectItem.display_name ||
            projectItem.product_name ||
            ''
          ).trim();
          const systemItemNameToken = normalizeProjectItemImportToken(systemItemName);
          if (
            referenceNameToken &&
            systemItemNameToken &&
            referenceNameToken !== systemItemNameToken
          ) {
            warnings.push(`Dòng ${lineNumber}: tên hạng mục "${referenceItem.name}" khác dữ liệu hệ thống "${systemItemName}".`);
          }

          const assignedDate = String(assignedDateRaw || '').trim() || new Date().toLocaleDateString('vi-VN');
          const normalizedProjectToken = normalizeProjectItemImportToken(resolvedProjectCode);
          const group = importRowsByProject.get(normalizedProjectToken) || {
            project_code: resolvedProjectCode,
            raciByIdentity: new Map<string, { project_item_id: string | number; user_id: number; raci_role: 'R' | 'A' | 'C' | 'I'; assignedDate: string }>(),
          };
          const identity = `${employeeId}|${raciRole}`;
          if (group.raciByIdentity.has(identity)) {
            warnings.push(`Dòng ${lineNumber}: nhân sự "${userRaw}" trùng vai trò "${raciRole}" trong dự án "${resolvedProjectCode}", hệ thống dùng dòng sau.`);
          }

          group.raciByIdentity.set(identity, {
            project_item_id: projectItem.id,
            user_id: employeeId,
            raci_role: raciRole,
            assignedDate,
          });
          importRowsByProject.set(normalizedProjectToken, group);
        });

        if (importRowsByProject.size === 0) {
          const nextSummary = {
            success: 0,
            failed: errors.length || 1,
            warnings,
            errors: errors.length > 0 ? errors : ['Không có dòng hợp lệ để nhập từ file Excel.'],
          };
          setRaciImportSummary(nextSummary);
          onNotify?.('error', 'Nhập đội ngũ dự án', nextSummary.errors[0]);
          return;
        }

        const groupedPayload: ProjectRaciImportBatchGroup[] = Array.from(importRowsByProject.values()).map((group) => ({
          project_code: group.project_code,
          raci: Array.from(group.raciByIdentity.values()).map((entry) => ({
            project_item_id: entry.project_item_id,
            user_id: entry.user_id,
            raci_role: entry.raci_role,
          })),
        }));

        const currentProjectToken = normalizeProjectItemImportToken(formData.project_code || '');
        let batchResult: ProjectRaciImportBatchResult | null = null;
        if (type === 'EDIT' && onImportProjectRaciBatch) {
          batchResult = await onImportProjectRaciBatch(groupedPayload);
        }

        const successfulProjectTokens = new Set<string>();
        if (batchResult) {
          (batchResult.success_projects || []).forEach((item) => {
            const token = normalizeProjectItemImportToken(item.project_code);
            if (token) {
              successfulProjectTokens.add(token);
            }
          });
        } else if (type === 'ADD') {
          if (currentProjectToken && importRowsByProject.has(currentProjectToken)) {
            successfulProjectTokens.add(currentProjectToken);
            const skippedProjects = importRowsByProject.size - 1;
            if (skippedProjects > 0) {
              warnings.push(`Đã bỏ qua ${skippedProjects} dự án khác trong file vì dự án mới chưa được lưu lên hệ thống.`);
            }
          } else if (!currentProjectToken) {
            errors.push('Vui lòng nhập Mã dự án ở tab Thông tin chung trước khi nhập đội ngũ dự án.');
          } else {
            errors.push('Không tìm thấy dòng đội ngũ nào khớp với Mã dự án đang tạo.');
          }
        } else {
          groupedPayload.forEach((item) => {
            const token = normalizeProjectItemImportToken(item.project_code);
            if (token) {
              successfulProjectTokens.add(token);
            }
          });
        }

        if (currentProjectToken) {
          const currentProjectGroup = importRowsByProject.get(currentProjectToken);
          const shouldMergeCurrent = Boolean(currentProjectGroup) && (
            type === 'ADD' || successfulProjectTokens.has(currentProjectToken)
          );

          if (currentProjectGroup && shouldMergeCurrent) {
            const importedRaci = Array.from(currentProjectGroup.raciByIdentity.values()).map((entry) => ({
              id: `RACI_${Date.now()}_${entry.user_id}_${entry.raci_role}`,
              userId: String(entry.user_id),
              roleType: entry.raci_role,
              assignedDate: entry.assignedDate,
            } as ProjectRACI));

            setFormData((prev) => ({
              ...prev,
              raci: mergeImportedProjectRaci(prev.raci || [], importedRaci),
            }));
          }
        }

        if (batchResult?.failed_projects?.length) {
          batchResult.failed_projects.forEach((item) => {
            errors.push(`Dự án ${item.project_code}: ${item.message}`);
          });
        }

        if (importRowsByProject.size > 1) {
          warnings.push(`Đã xử lý ${importRowsByProject.size} dự án trong cùng một lần import theo Mã hạng mục dự án.`);
        }

        let successCount = 0;
        if (successfulProjectTokens.size > 0) {
          importRowsByProject.forEach((group, token) => {
            if (successfulProjectTokens.has(token)) {
              successCount += group.raciByIdentity.size;
            }
          });
        }

        const nextSummary = {
          success: successCount,
          failed: errors.length,
          warnings,
          errors,
        };
        setRaciImportSummary(nextSummary);
        if (nextSummary.success > 0) {
          onNotify?.('success', 'Nhập đội ngũ dự án', `Đã áp dụng ${nextSummary.success} dòng phân công RACI.`);
        }
        if (nextSummary.warnings.length > 0) {
          onNotify?.('error', 'Nhập đội ngũ dự án', `Có ${nextSummary.warnings.length} cảnh báo. Vui lòng kiểm tra lại dữ liệu.`);
        }
        if (nextSummary.errors.length > 0) {
          onNotify?.('error', 'Nhập đội ngũ dự án', `Có ${nextSummary.errors.length} dòng lỗi đã được bỏ qua.`);
        }
        if (nextSummary.success > 0) {
          setShowRaciImportModal(false);
        }
      }, 600);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể đọc file nhập đội ngũ dự án.';
      setRaciImportSummary({
        success: 0,
        failed: 1,
        warnings: [],
        errors: [message],
      });
      onNotify?.('error', 'Nhập đội ngũ dự án', message);
      throw error;
    } finally {
      setRaciImportLoadingText('');
      setIsRaciImportSaving(false);
      raciImportInFlightRef.current = false;
    }
  };

  // --- Project Item Handlers ---
  const handleAddItem = () => {
    if (!isPersistedProject) {
      onNotify?.('error', 'Dự án chưa lưu', 'Vui lòng lưu dự án thành công trước khi thêm hạng mục.');
      return;
    }
    const newItem: ProjectItem = {
        id: `ITEM_${Date.now()}`,
        productId: '',
        quantity: 1,
        unitPrice: 0,
        discountPercent: 0,
        discountAmount: 0,
        lineTotal: 0,
        discountMode: undefined
    };
    setFormData(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
  };

  const handleUpdateItem = (itemId: string, field: keyof ProjectItem, value: any) => {
    setFormData(prev => {
        const newItems = prev.items?.map(item => {
            if (item.id !== itemId) return item;
            
            const updatedItem = { ...item, [field]: value };
            
            // Auto update unit price if product changed
            if (field === 'productId') {
               const product = products.find(p => p.id === value);
               if (product) {
                   updatedItem.unitPrice = product.standard_price;
                   updatedItem.discountPercent = 0;
                   updatedItem.discountAmount = 0;
                   updatedItem.discountMode = undefined;
               }
            }

            // Logic: Calculate derived fields
            const baseTotal = updatedItem.quantity * updatedItem.unitPrice;

            if (field === 'discountPercent') {
                const rawValue = value.toString();
                
                // Allow empty
                if (rawValue === '') {
                    updatedItem.discountPercent = '';
                    updatedItem.discountAmount = 0;
                    updatedItem.discountMode = undefined;
                } else {
                    // Regex: digits, optional comma/dot, max 2 decimals
                    // Allow "5," or "5." during typing
                    if (!/^\d*([.,]\d{0,2})?$/.test(rawValue)) return item; // Reject invalid input

                    const parsed = parseFloat(rawValue.replace(',', '.'));
                    
                    // Immediate Clamp: Max 100%
                    if (parsed > 100) {
                        updatedItem.discountPercent = 100;
                        updatedItem.discountAmount = baseTotal;
                    } else {
                        updatedItem.discountPercent = rawValue; // Keep raw string for input
                        updatedItem.discountAmount = Math.round(baseTotal * (parsed / 100));
                    }
                    
                    if (parsed > 0) updatedItem.discountMode = 'PERCENT';
                    else updatedItem.discountMode = undefined;
                }

            } else if (field === 'discountAmount') {
                const rawValue = value.toString();
                
                // Allow empty
                if (rawValue === '') {
                    updatedItem.discountAmount = '';
                    updatedItem.discountPercent = 0;
                    updatedItem.discountMode = undefined;
                } else {
                    // Regex: digits, dots (thousands), optional comma/dot (decimal)
                    // Allow "1.000," during typing
                    if (!/^[\d.]*([.,]\d{0,2})?$/.test(rawValue)) return item; // Reject invalid input

                    const parsed = Math.round(parseNumber(rawValue));
                    
                    // Immediate Clamp: Max Base Total
                    if (parsed > baseTotal) {
                        updatedItem.discountAmount = baseTotal;
                        updatedItem.discountPercent = 100;
                    } else {
                        updatedItem.discountAmount = parsed;
                        if (baseTotal > 0) {
                            updatedItem.discountPercent = parseFloat(((parsed / baseTotal) * 100).toFixed(2));
                        } else {
                            updatedItem.discountPercent = 0;
                        }
                    }

                    if (parsed > 0) updatedItem.discountMode = 'AMOUNT';
                    else updatedItem.discountMode = undefined;
                }

            } else if (field === 'quantity' || field === 'unitPrice') {
                // Recalculate derived based on mode
                const currentAmount = parseNumber(updatedItem.discountAmount);
                const currentPercent = parseNumber(updatedItem.discountPercent);

                if (updatedItem.discountMode === 'AMOUNT') {
                     // Check if amount exceeds new baseTotal
                     if (currentAmount > baseTotal) {
                         updatedItem.discountAmount = baseTotal;
                         updatedItem.discountPercent = 100;
                     } else {
                         // Keep amount constant, update percent
                         if (baseTotal > 0) {
                            updatedItem.discountPercent = parseFloat(((currentAmount / baseTotal) * 100).toFixed(2));
                         } else {
                            updatedItem.discountPercent = 0;
                         }
                     }
                } else {
                     // Default or PERCENT mode: Keep percent constant, update amount
                     updatedItem.discountAmount = Math.round(baseTotal * (currentPercent / 100));
                }
            }

            // Recalculate line total
            const finalAmount = parseNumber(updatedItem.discountAmount);
            updatedItem.lineTotal = baseTotal - finalAmount;
            
            return updatedItem;
        }) || [];
        return { ...prev, items: newItems };
    });
  };

  const handleItemBlur = (itemId: string, field: keyof ProjectItem) => {
      setFormData(prev => {
        const newItems = prev.items?.map(item => {
            if (item.id !== itemId) return item;
            
            const updatedItem = { ...item };
            const baseTotal = updatedItem.quantity * updatedItem.unitPrice;

            if (field === 'discountPercent') {
                 let val = updatedItem.discountPercent;
                 let parsed = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
                 if (isNaN(parsed)) parsed = 0;

                 // Safety clamp
                 if (parsed > 100) {
                    parsed = 100;
                 }
                 
                 // Warning Threshold > 50%
                 if (parsed > 50) {
                    if (!window.confirm("Cảnh báo: Tỷ lệ chiết khấu lớn hơn 50%. Bạn có chắc chắn muốn áp dụng?")) {
                        parsed = 0;
                        updatedItem.discountMode = undefined;
                    }
                 }
                 
                 updatedItem.discountPercent = parsed; // Commit to number
                 updatedItem.discountAmount = Math.round(baseTotal * (parsed / 100));
            
            } else if (field === 'discountAmount') {
                let val = updatedItem.discountAmount;
                let parsed = parseNumber(val);
                
                // Safety clamp
                if (parsed > baseTotal) {
                    parsed = baseTotal;
                }
                
                // Warning Threshold > 50% of Total
                if (parsed > baseTotal * 0.5) {
                    if (!window.confirm("Cảnh báo: Số tiền giảm giá lớn hơn 50% thành tiền. Bạn có chắc chắn muốn áp dụng?")) {
                        parsed = 0;
                        updatedItem.discountMode = undefined;
                    }
                }
                
                updatedItem.discountAmount = parsed; // Commit to number
                if (baseTotal > 0) {
                    updatedItem.discountPercent = parseFloat(((parsed / baseTotal) * 100).toFixed(2));
                } else {
                    updatedItem.discountPercent = 0;
                }
            }

            // Final Recalculate
            const finalAmount = typeof updatedItem.discountAmount === 'number' ? updatedItem.discountAmount : parseNumber(updatedItem.discountAmount);
            updatedItem.lineTotal = baseTotal - finalAmount;
            
            return updatedItem;
        }) || [];
        return { ...prev, items: newItems };
    });
  };

  const handleRemoveItem = (itemId: string) => {
    setFormData(prev => ({
        ...prev,
        items: prev.items?.filter(item => item.id !== itemId)
    }));
  };

  // --- RACI Management ---
  const handleAddRACI = () => {
    if (!isPersistedProject) {
      onNotify?.('error', 'Dự án chưa lưu', 'Vui lòng lưu dự án thành công trước khi thêm đội ngũ dự án.');
      return;
    }
    const newRACI: ProjectRACI = {
        id: `RACI_${Date.now()}`,
        userId: '',
        roleType: 'R',
        assignedDate: new Date().toLocaleDateString('vi-VN')
    };
    setFormData(prev => ({ ...prev, raci: [...(prev.raci || []), newRACI] }));
  };

  const handleUpdateRACI = (raciId: string, field: keyof ProjectRACI, value: any) => {
    const currentRACI = formData.raci?.find(r => r.id === raciId);
    if (!currentRACI) return;

    // Validation Logic: Unique (userId, roleType)
    const nextUserId = field === 'userId' ? value : currentRACI.userId;
    const nextRoleType = field === 'roleType' ? value : currentRACI.roleType;

    if (nextUserId && nextRoleType) {
        const duplicate = formData.raci?.find(r => 
            r.id !== raciId && 
            r.userId === nextUserId && 
            r.roleType === nextRoleType
        );

        if (duplicate) {
            const roleLabel = RACI_ROLES.find(role => role.value === nextRoleType)?.label || nextRoleType;
            alert(`Nhân sự này đã được phân công vai trò [${roleLabel}] trong dự án. Vui lòng chọn vai trò khác!`);
            return;
        }
    }

    setFormData(prev => ({
        ...prev,
        raci: prev.raci?.map(r => r.id === raciId ? { ...r, [field]: value } : r)
    }));
  };

  const handleRemoveRACI = (raciId: string) => {
    setFormData(prev => ({
        ...prev,
        raci: prev.raci?.filter(r => r.id !== raciId)
    }));
  };

  const itemSummary = useMemo(() => {
    return (formData.items || []).reduce(
      (acc, item) => {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        const baseTotal = quantity * unitPrice;
        const discountAmount = Math.max(0, parseNumber(item.discountAmount));
        const cappedDiscount = Math.min(discountAmount, Math.max(0, baseTotal));
        const resolvedLineTotal = Number.isFinite(Number(item.lineTotal))
          ? Number(item.lineTotal)
          : Math.max(0, baseTotal - cappedDiscount);

        acc.baseTotal += baseTotal;
        acc.discountTotal += cappedDiscount;
        acc.lineTotal += resolvedLineTotal;
        return acc;
      },
      { baseTotal: 0, discountTotal: 0, lineTotal: 0 }
    );
  }, [formData.items]);

  const totalDiscountPercent = itemSummary.baseTotal > 0
    ? (itemSummary.discountTotal / itemSummary.baseTotal) * 100
    : 0;

  return (
    <>
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm mới Dự án' : 'Cập nhật Dự án'} icon="topic" width="max-w-6xl">
      
      {/* Tabs */}
      <div className="flex border-b border-slate-200">
         <button 
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'info' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => handleTabSwitch('info')}
         >
            Thông tin chung
         </button>
         <button 
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
              !isPersistedProject && activeTab !== 'items'
                ? 'border-transparent text-slate-400 cursor-not-allowed'
                : activeTab === 'items'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => handleTabSwitch('items')}
            disabled={!isPersistedProject}
         >
            Hạng mục dự án ({formData.items?.length || 0})
         </button>
         <button 
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
              !isPersistedProject && activeTab !== 'raci'
                ? 'border-transparent text-slate-400 cursor-not-allowed'
                : activeTab === 'raci'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => handleTabSwitch('raci')}
            disabled={!isPersistedProject}
         >
            Đội ngũ dự án ({formData.raci?.length || 0})
         </button>
      </div>
      {!isPersistedProject && (
        <div className="px-6 py-2 border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
          Lưu dự án thành công để mở tab Hạng mục dự án và Đội ngũ dự án.
        </div>
      )}

      <div className="p-6">
        {activeTab === 'info' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <FormInput 
                    label="Mã dự án" 
                    value={formData.project_code} 
                    onChange={(e: any) => handleChange('project_code', e.target.value)} 
                    placeholder="DA001" 
                    required 
                    error={errors.project_code}
                />
                
                <FormInput 
                    label="Tên dự án" 
                    value={formData.project_name} 
                    onChange={(e: any) => handleChange('project_name', e.target.value)} 
                    placeholder="Dự án triển khai..." 
                    required 
                    error={errors.project_name}
                />

                <div className="col-span-1">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Khách hàng</label>
                    {formData.opportunity_id ? (
                        <div className="w-full h-11 px-4 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 flex items-center">
                            {getCustomerName(String(formData.customer_id || ''))}
                        </div>
                    ) : (
                        <SearchableSelect
                            options={[
                              { value: '', label: 'Chọn khách hàng...' },
                              ...customers.map((customer) => ({
                                value: String(customer.id),
                                label: `${customer.customer_code} - ${customer.customer_name}`,
                              })),
                            ]}
                            value={String(formData.customer_id || '')}
                            onChange={(value) => handleChange('customer_id', value)}
                            placeholder="Chọn khách hàng..."
                        />
                    )}
                </div>

                <div className="col-span-1">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Cơ hội</label>
                    <div className="w-full h-11 px-4 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 flex items-center truncate">
                        <span className="truncate">{formData.opportunity_id ? getOpportunityName(String(formData.opportunity_id)) : '---'}</span>
                    </div>
                </div>

                <FormSelect 
                    label="Hình thức đầu tư" 
                    value={formData.investment_mode} 
                    onChange={(e: any) => handleChange('investment_mode', e.target.value)} 
                    options={INVESTMENT_MODES} 
                />

                <FormSelect 
                    label="Trạng thái" 
                    value={formData.status} 
                    onChange={(e: any) => handleChange('status', e.target.value)} 
                    options={PROJECT_STATUSES} 
                />

                <FormInput 
                    label="Ngày bắt đầu" 
                    type="date"
                    value={formData.start_date} 
                    onChange={(e: any) => handleChange('start_date', e.target.value)} 
                    required
                    error={errors.start_date}
                />

                <FormInput 
                    label="Ngày kết thúc" 
                    type="date"
                    value={formData.expected_end_date} 
                    onChange={(e: any) => handleChange('expected_end_date', e.target.value)} 
                    error={errors.expected_end_date}
                />

                <FormInput 
                    label="Ngày kết thúc thực tế" 
                    type="date"
                    value={formData.actual_end_date} 
                    onChange={(e: any) => handleChange('actual_end_date', e.target.value)} 
                />
            </div>
        ) : activeTab === 'items' ? (
            <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold text-slate-700">Danh sách sản phẩm/dịch vụ</h3>
                    <div className="flex items-center gap-2">
                        <div className="relative" ref={itemImportMenuRef}>
                            <button
                                type="button"
                                onClick={() => setShowItemImportMenu((prev) => !prev)}
                                disabled={isItemImportSaving}
                                className="text-xs flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-50 font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-outlined text-sm">upload</span>
                                {isItemImportSaving ? 'Đang nhập...' : 'Nhập'}
                                <span className="material-symbols-outlined text-sm">expand_more</span>
                            </button>
                            {showItemImportMenu && (
                                <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-slate-200 rounded-lg shadow-xl z-[120] overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={triggerProjectItemImport}
                                        disabled={isItemImportSaving}
                                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <span className="material-symbols-outlined text-sm">upload_file</span>
                                        Nhập dữ liệu
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDownloadProjectItemTemplate}
                                        disabled={isItemImportSaving}
                                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors border-t border-slate-100 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <span className="material-symbols-outlined text-sm">download</span>
                                        Tải file mẫu
                                    </button>
                                </div>
                            )}
                        </div>
                        <button onClick={handleAddItem} className="text-xs flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-100 font-medium">
                            <span className="material-symbols-outlined text-sm">add</span> Thêm hạng mục
                        </button>
                    </div>
                </div>

                {itemImportSummary && (
                    <div className="space-y-2">
                        <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                            Đã nhập {itemImportSummary.success} dòng, lỗi {itemImportSummary.failed} dòng.
                        </div>
                        {itemImportSummary.warnings.length > 0 && (
                            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                                {itemImportSummary.warnings.slice(0, 3).map((warning, index) => (
                                    <p key={`${warning}-${index}`}>{warning}</p>
                                ))}
                                {itemImportSummary.warnings.length > 3 && (
                                    <p>... còn {itemImportSummary.warnings.length - 3} cảnh báo.</p>
                                )}
                            </div>
                        )}
                        {itemImportSummary.errors.length > 0 && (
                            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                                {itemImportSummary.errors.slice(0, 5).map((error, index) => (
                                    <p key={`${error}-${index}`}>{error}</p>
                                ))}
                                {itemImportSummary.errors.length > 5 && (
                                    <p>... còn {itemImportSummary.errors.length - 5} lỗi.</p>
                                )}
                            </div>
                        )}
                    </div>
                )}
                
                <div className="border border-slate-200 rounded-lg bg-slate-50 p-4 overflow-visible">
                    <table className="w-full table-fixed text-left bg-white rounded-lg shadow-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[32%]">Sản phẩm</th>
                                <th className="px-2 py-3 text-xs font-bold text-slate-500 uppercase w-[8%] text-center whitespace-nowrap">SL</th>
                                <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[15%] text-right whitespace-nowrap">Đơn giá</th>
                                <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[10%] text-right whitespace-nowrap">% CK</th>
                                <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[15%] text-right whitespace-nowrap">Giảm giá</th>
                                <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[15%] text-right whitespace-nowrap">Thành tiền</th>
                                <th className="px-2 py-3 text-xs font-bold text-slate-500 uppercase w-[5%] text-center whitespace-nowrap">Xóa</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {formData.items && formData.items.length > 0 ? (
                                formData.items.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50">
                                        <td className="p-2">
                                            <SearchableSelect
                                                compact
                                                value={item.productId}
                                                options={[
                                                  { value: '', label: 'Chọn sản phẩm' },
                                                  ...products.map((product) => ({
                                                    value: product.id,
                                                    label: `${product.product_code} - ${product.product_name}`,
                                                  })),
                                                ]}
                                                onChange={(value) => handleUpdateItem(item.id, 'productId', value)}
                                                triggerClassName="w-full text-sm border border-slate-300 rounded-md focus:ring-primary focus:border-primary py-1.5 bg-white text-slate-900 shadow-sm h-9"
                                                dropdownClassName="min-w-[360px] max-w-[720px]"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input 
                                                type="number" 
                                                min="0"
                                                step="0.01"
                                                className="w-full text-sm border border-slate-300 rounded-md text-center focus:ring-primary focus:border-primary py-1.5 bg-white text-slate-900 shadow-sm"
                                                value={item.quantity === 0 ? '' : item.quantity}
                                                onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                placeholder="0"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input 
                                                type="text" 
                                                className="w-full text-sm border border-slate-300 rounded-md text-right focus:ring-primary focus:border-primary py-1.5 bg-white text-slate-900 shadow-sm pr-4"
                                                value={formatNumber(item.unitPrice)}
                                                onChange={(e) => handleUpdateItem(item.id, 'unitPrice', parseNumber(e.target.value))}
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input 
                                                type="text" 
                                                disabled={item.discountMode === 'AMOUNT'}
                                                className={`w-full text-sm border border-slate-300 rounded-md text-right focus:ring-primary focus:border-primary py-1.5 shadow-sm pr-4 ${item.discountMode === 'AMOUNT' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white text-slate-900'}`}
                                                value={item.discountPercent === 0 ? '' : item.discountPercent}
                                                onChange={(e) => handleUpdateItem(item.id, 'discountPercent', e.target.value)}
                                                onBlur={() => handleItemBlur(item.id, 'discountPercent')}
                                                placeholder="0"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    disabled={item.discountMode === 'PERCENT'}
                                                    className={`w-full text-sm border border-slate-300 rounded-md text-right focus:ring-primary focus:border-primary py-1.5 shadow-sm pr-8 ${
                                                      item.discountMode === 'PERCENT'
                                                        ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                                                        : 'bg-white text-slate-900'
                                                    }`}
                                                    value={parseNumber(item.discountAmount) <= 0 ? '' : formatNumber(parseNumber(item.discountAmount))}
                                                    onChange={(e) => handleUpdateItem(item.id, 'discountAmount', e.target.value)}
                                                    onBlur={() => handleItemBlur(item.id, 'discountAmount')}
                                                    placeholder="0"
                                                />
                                                <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs ${
                                                  item.discountMode === 'PERCENT' ? 'text-slate-300' : 'text-slate-400'
                                                }`}>
                                                  ₫
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-2 text-right text-sm font-bold text-slate-900 whitespace-nowrap">
                                            {formatCurrency(item.lineTotal || 0)}
                                        </td>
                                        <td className="p-2 text-center">
                                            <button 
                                                onClick={() => handleRemoveItem(item.id)}
                                                className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                            >
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">Chưa có hạng mục nào.</td>
                                </tr>
                            )}
                        </tbody>
                        {formData.items && formData.items.length > 0 && (
                            <tfoot className="bg-slate-50 border-t border-slate-200">
                                <tr>
                                    <td colSpan={3} className="px-4 py-3 text-sm font-bold text-slate-700 text-right">Tổng % CK:</td>
                                    <td className="px-4 py-3 text-sm font-bold text-amber-600 text-right whitespace-nowrap">
                                        {formatPercent(totalDiscountPercent)}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-bold text-red-600 text-right">
                                        {formatCurrency(itemSummary.discountTotal)}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-bold text-primary text-right whitespace-nowrap">
                                        {formatCurrency(itemSummary.lineTotal)}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        ) : (
            <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold text-slate-700">Đội ngũ dự án (RACI)</h3>
                    <div className="flex items-center gap-2">
                        <div className="relative" ref={raciImportMenuRef}>
                            <button
                                type="button"
                                onClick={() => setShowRaciImportMenu((prev) => !prev)}
                                disabled={isRaciImportSaving}
                                className="text-xs flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-50 font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-outlined text-sm">upload</span>
                                {isRaciImportSaving ? 'Đang nhập...' : 'Nhập'}
                                <span className="material-symbols-outlined text-sm">expand_more</span>
                            </button>
                            {showRaciImportMenu && (
                                <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-slate-200 rounded-lg shadow-xl z-[120] overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={triggerProjectRaciImport}
                                        disabled={isRaciImportSaving}
                                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <span className="material-symbols-outlined text-sm">upload_file</span>
                                        Nhập dữ liệu
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDownloadProjectRaciTemplate}
                                        disabled={isRaciImportSaving}
                                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors border-t border-slate-100 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <span className="material-symbols-outlined text-sm">download</span>
                                        Tải file mẫu
                                    </button>
                                </div>
                            )}
                        </div>
                        <button onClick={handleAddRACI} className="text-xs flex items-center gap-1 bg-purple-50 text-purple-600 px-3 py-1.5 rounded-md hover:bg-purple-100 font-medium">
                            <span className="material-symbols-outlined text-sm">person_add</span> Thêm nhân sự
                        </button>
                    </div>
                </div>

                {raciImportSummary && (
                    <div className="space-y-2">
                        <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                            Đã nhập {raciImportSummary.success} dòng, lỗi {raciImportSummary.failed} dòng.
                        </div>
                        {raciImportSummary.warnings.length > 0 && (
                            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                                {raciImportSummary.warnings.slice(0, 3).map((warning, index) => (
                                    <p key={`${warning}-${index}`}>{warning}</p>
                                ))}
                                {raciImportSummary.warnings.length > 3 && (
                                    <p>... còn {raciImportSummary.warnings.length - 3} cảnh báo.</p>
                                )}
                            </div>
                        )}
                        {raciImportSummary.errors.length > 0 && (
                            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                                {raciImportSummary.errors.slice(0, 5).map((error, index) => (
                                    <p key={`${error}-${index}`}>{error}</p>
                                ))}
                                {raciImportSummary.errors.length > 5 && (
                                    <p>... còn {raciImportSummary.errors.length - 5} lỗi.</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="border border-slate-200 rounded-lg bg-slate-50 p-4 overflow-x-auto">
                    <table className="min-w-[980px] w-full table-fixed text-left bg-white rounded-lg shadow-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase w-[34%]">Nhân sự</th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase w-[26%]">Phòng ban</th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase w-[20%] whitespace-nowrap">Vai trò</th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase w-[12%] whitespace-nowrap text-center">Ngày phân công</th>
                                <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[120px] text-center whitespace-nowrap">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {formData.raci && formData.raci.length > 0 ? (
                                formData.raci.map((r) => {
                                    const employee = employees.find(e => String(e.id) === String(r.userId));
                                    const dept = departments.find(d => d.id === employee?.department_id);
                                    const deptName = dept ? `${dept.dept_code} - ${dept.dept_name}` : String(employee?.department_id || '---');
                                    
                                    return (
                                        <tr key={r.id} className="hover:bg-slate-50">
                                            <td className="p-2">
                                                <SearchableSelect
                                                    compact
                                                    value={r.userId}
                                                    options={[
                                                      { value: '', label: 'Chọn nhân viên' },
                                                      ...employees.map((employee) => ({
                                                        value: employee.id,
                                                        label: getEmployeeLabel(employee),
                                                      })),
                                                    ]}
                                                    onChange={(value) => handleUpdateRACI(r.id, 'userId', value)}
                                                    triggerClassName="w-full text-sm border border-slate-300 rounded-md focus:ring-primary focus:border-primary py-1.5 bg-white text-slate-900 shadow-sm h-9"
                                                    dropdownClassName="min-w-[340px] max-w-[680px]"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-sm text-slate-600">
                                                <span className="block truncate" title={deptName}>{deptName}</span>
                                            </td>
                                            <td className="p-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${RACI_ROLES.find(role => role.value === r.roleType)?.color || 'bg-slate-100 text-slate-700'}`}>
                                                        {r.roleType}
                                                    </div>
                                                    <SearchableSelect
                                                        compact
                                                        className="flex-1"
                                                        value={r.roleType}
                                                        options={RACI_ROLES.map((role) => ({ value: role.value, label: role.label }))}
                                                        onChange={(value) => handleUpdateRACI(r.id, 'roleType', value)}
                                                        triggerClassName="flex-1 text-sm border border-slate-300 rounded-md focus:ring-primary focus:border-primary py-1.5 bg-white text-slate-900 shadow-sm h-9"
                                                        dropdownClassName="min-w-[220px] max-w-[340px]"
                                                    />
                                                </div>
                                            </td>
                                            <td className="p-2">
                                                <input 
                                                    type="text"
                                                    className="w-full text-sm border border-slate-300 rounded-md focus:ring-primary focus:border-primary py-1.5 bg-white text-slate-900 shadow-sm px-2 text-center"
                                                    value={r.assignedDate}
                                                    onChange={(e) => handleUpdateRACI(r.id, 'assignedDate', e.target.value)}
                                                />
                                            </td>
                                            <td className="p-2 text-center w-[120px]">
                                                <button 
                                                    onClick={() => handleRemoveRACI(r.id)}
                                                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">Chưa có nhân sự nào được phân công.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
        
        {/* Spacer for footer */}
        <div className="pb-24"></div>
      </div>

      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 absolute bottom-0 left-0 right-0 z-[60]">
        <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors">Hủy</button>
        <button onClick={handleSubmit} className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-deep-teal shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
           <span className="material-symbols-outlined text-lg">check</span> {type === 'ADD' ? 'Lưu' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
    {showItemImportModal && (
      <ImportModal
        title="Nhập dữ liệu hạng mục dự án"
        moduleKey="project_items"
        onClose={() => {
          if (isItemImportSaving) {
            return;
          }
          setShowItemImportModal(false);
        }}
        onSave={handleProjectItemsImportSave}
        isLoading={isItemImportSaving}
        loadingText={itemImportLoadingText || 'Đang xử lý hạng mục dự án...'}
      />
    )}
    {showRaciImportModal && (
      <ImportModal
        title="Nhập dữ liệu đội ngũ dự án"
        moduleKey="project_raci"
        onClose={() => {
          if (isRaciImportSaving) {
            return;
          }
          setShowRaciImportModal(false);
        }}
        onSave={handleProjectRaciImportSave}
        isLoading={isRaciImportSaving}
        loadingText={raciImportLoadingText || 'Đang xử lý đội ngũ dự án...'}
      />
    )}
    </>
  );
};

export const DeleteProjectModal: React.FC<{ data: Project; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal 
     title="Xóa Dự án" 
     message={<p>Bạn có chắc chắn muốn xóa dự án <span className="font-bold text-slate-900">"{data.project_name}"</span>? Dữ liệu sẽ không thể khôi phục.</p>}
     onClose={onClose} 
     onConfirm={onConfirm}
  />
);

// --- Contract Modals ---

interface ContractFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: Contract | null;
  projects: Project[];
  customers: Customer[];
  onClose: () => void;
  onSave: (data: Partial<Contract>) => void;
}

export const ContractFormModal: React.FC<ContractFormModalProps> = ({ 
  type, data, projects, customers, onClose, onSave 
}) => {
  const [formData, setFormData] = useState<Partial<Contract>>({
    contract_code: data?.contract_code || data?.contract_number || '',
    contract_name: data?.contract_name || '',
    customer_id: data?.customer_id || '',
    project_id: data?.project_id || '',
    value: data?.value || data?.total_value || 0,
    status: data?.status || 'DRAFT'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Formatting helpers
  const formatNumber = (num: number | string | undefined | null) => {
    if (num === undefined || num === null || num === '') return '';
    if (typeof num === 'string') return num; 
    return new Intl.NumberFormat('vi-VN').format(num);
  };

  const parseNumber = (str: string | number) => {
    if (typeof str === 'number') return str;
    const normalized = str.replace(/\./g, '').replace(/,/g, '.');
    return parseFloat(normalized) || 0;
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.contract_code) newErrors.contract_code = 'Mã hợp đồng là bắt buộc';
    if (!formData.contract_name) newErrors.contract_name = 'Tên hợp đồng là bắt buộc';
    if (!formData.customer_id) newErrors.customer_id = 'Vui lòng chọn Khách hàng';
    if (!formData.project_id) newErrors.project_id = 'Vui lòng chọn Dự án';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      const finalData = {
        ...formData,
        value: typeof formData.value === 'string' ? parseNumber(formData.value) : formData.value
      };
      onSave(finalData);
    }
  };

  const handleChange = (field: keyof Contract, value: any) => {
    setFormData(prev => {
        const updated = { ...prev, [field]: value };
        
        // Khi chọn dự án, tự động map khách hàng và giá trị line total nếu có.
        if (field === 'project_id') {
            const project = projects.find(p => p.id === value);
            if (project) {
                const total = (project.items || []).reduce((sum, item) => sum + (item.lineTotal || 0), 0);
                if (total > 0) {
                  updated.value = total;
                }
                if (!updated.customer_id) {
                  updated.customer_id = project.customer_id;
                }
            }
        }
        
        return updated;
    });
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm mới Hợp đồng' : 'Cập nhật Hợp đồng'} icon="description" width="max-w-lg">
      <div className="p-6 space-y-5">
        <FormInput 
            label="Mã hợp đồng" 
            value={formData.contract_code} 
            onChange={(e: any) => handleChange('contract_code', e.target.value)} 
            placeholder="HD-2024-001" 
            required 
            error={errors.contract_code}
        />

        <FormInput 
            label="Tên hợp đồng" 
            value={formData.contract_name} 
            onChange={(e: any) => handleChange('contract_name', e.target.value)} 
            placeholder="Hợp đồng triển khai giải pháp..."
            required 
            error={errors.contract_name}
        />

        <div className="col-span-1">
            <SearchableSelect 
                label="Khách hàng"
                required
                options={customers.map(c => ({ value: String(c.id), label: `${c.customer_code} - ${c.customer_name}` }))}
                value={formData.customer_id ? String(formData.customer_id) : ''}
                onChange={(val) => handleChange('customer_id', val)}
                error={errors.customer_id}
                placeholder="Chọn khách hàng"
            />
        </div>

        <div className="col-span-1">
            <SearchableSelect 
                label="Dự án liên kết"
                required
                options={(projects || [])
                  .filter(p => !formData.customer_id || String(p.customer_id) === String(formData.customer_id))
                  .map(p => ({ value: String(p.id), label: `${p.project_code} - ${p.project_name}` }))}
                value={formData.project_id ? String(formData.project_id) : ''}
                onChange={(val) => handleChange('project_id', val)}
                error={errors.project_id}
                placeholder="Chọn dự án"
            />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">
            Giá trị hợp đồng (VNĐ)
          </label>
          <div className="relative">
            <input 
              type="text"
              value={formatNumber(formData.value)} 
              onChange={(e) => handleChange('value', e.target.value)} 
              onBlur={() => {
                const parsed = parseNumber(formData.value as any);
                setFormData(prev => ({ ...prev, value: parsed }));
              }}
              placeholder="0"
              className="w-full h-11 pl-4 pr-10 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400 font-bold">
              ₫
            </div>
          </div>
        </div>

        <FormSelect 
            label="Trạng thái" 
            value={formData.status} 
            onChange={(e: any) => handleChange('status', e.target.value)} 
            options={CONTRACT_STATUSES} 
        />
      </div>

      <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors">Hủy</button>
        <button onClick={handleSubmit} className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-deep-teal shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
           <span className="material-symbols-outlined text-lg">check</span> {type === 'ADD' ? 'Lưu' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteContractModal: React.FC<{ data: Contract; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal 
     title="Xóa Hợp đồng" 
     message={<p>Bạn có chắc chắn muốn xóa hợp đồng <span className="font-bold text-slate-900">"{data.contract_code || data.contract_number}"</span>? Dữ liệu sẽ không thể khôi phục.</p>}
     onClose={onClose} 
     onConfirm={onConfirm}
  />
);

// --- Document Modals ---

interface AttachmentManagerProps {
  attachments: Attachment[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isUploading: boolean;
}

const AttachmentManager: React.FC<AttachmentManagerProps> = ({ attachments, onUpload, onDelete, isUploading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onUpload(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">attach_file</span>
          Danh sách file đính kèm
        </h3>
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="text-xs flex items-center gap-1 bg-primary/10 text-primary px-3 py-1.5 rounded-md hover:bg-primary/20 font-bold transition-all disabled:opacity-50"
        >
          {isUploading ? (
            <span className="w-3 h-3 border-2 border-primary/20 border-t-primary rounded-full animate-spin mr-1"></span>
          ) : (
            <span className="material-symbols-outlined text-sm">upload</span>
          )}
          Tải lên Drive
        </button>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Tên file</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center">Kích thước</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {attachments.length > 0 ? (
              attachments.map((file) => (
                <tr key={file.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900 truncate max-w-[200px]" title={file.fileName}>{file.fileName}</span>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">{file.mimeType.split('/')[1] || 'FILE'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 text-center">{formatSize(file.fileSize)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <a 
                        href={file.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-all"
                        title="Xem trên Drive"
                      >
                        <span className="material-symbols-outlined text-lg">open_in_new</span>
                      </a>
                      <button 
                        onClick={() => onDelete(file.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-all"
                        title="Xóa file"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400 text-sm">Chưa có file nào được tải lên.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface DocumentFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: AppDocument | null;
  customers: Customer[];
  projects: Project[];
  products: Product[];
  preselectedProduct?: Product | null;
  mode?: 'default' | 'product_upload';
  onClose: () => void;
  onSave: (data: Partial<AppDocument>) => void;
}

export const DocumentFormModal: React.FC<DocumentFormModalProps> = ({ 
  type, data, customers, projects, products, preselectedProduct, mode = 'default', onClose, onSave
}) => {
  const isProductUploadMode = mode === 'product_upload';

  const initialProductIds = useMemo(() => {
    const selected = Array.isArray(data?.productIds) && data?.productIds.length > 0
      ? data?.productIds
      : data?.productId
        ? [data.productId]
        : mode === 'product_upload' && preselectedProduct?.id
          ? [preselectedProduct.id]
          : [];

    return Array.from(
      new Set(
        selected
          .map((value) => String(value ?? '').trim())
          .filter((value) => value.length > 0)
      )
    );
  }, [data?.productId, data?.productIds, mode, preselectedProduct?.id]);

  const [formData, setFormData] = useState<Partial<AppDocument>>({
    id: data?.id || '',
    name: data?.name || '',
    typeId: data?.typeId || '',
    customerId: data?.customerId || '',
    projectId: data?.projectId || '',
    productId: initialProductIds[0] || '',
    productIds: initialProductIds,
    expiryDate: data?.expiryDate || '',
    status: data?.status || 'ACTIVE',
    attachments: data?.attachments || []
  });

  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredProjects = useMemo(() => {
    if (!formData.customerId) return [];
    return (projects || []).filter(p => p.customer_id === formData.customerId);
  }, [formData.customerId, projects]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.id) newErrors.id = isProductUploadMode ? 'Số văn bản là bắt buộc' : 'Mã tài liệu là bắt buộc';
    if (!formData.name) newErrors.name = isProductUploadMode ? 'Tên/Trích yếu văn bản là bắt buộc' : 'Tên tài liệu là bắt buộc';
    if (!isProductUploadMode && !formData.typeId) newErrors.typeId = 'Vui lòng chọn Loại tài liệu';
    if (!isProductUploadMode && !formData.customerId) newErrors.customerId = 'Vui lòng chọn Khách hàng';
    if (isProductUploadMode && !(formData.productIds || []).length) newErrors.productIds = 'Vui lòng chọn ít nhất 1 sản phẩm';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      if (isProductUploadMode) {
        onSave({
          ...formData,
          scope: 'PRODUCT_PRICING',
          releaseDate: formData.expiryDate,
          typeId: '',
          customerId: null,
          projectId: null,
        });
        return;
      }

      onSave({
        ...formData,
        scope: 'DEFAULT',
      });
    }
  };

  const handleChange = (field: keyof AppDocument, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const productOptions = useMemo(
    () =>
      (products || []).map((product) => ({
        value: String(product.id),
        label: `${product.product_code} - ${product.product_name}`,
      })),
    [products]
  );

  const handleUploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const newAttachment = await uploadDocumentAttachment(file);

      setFormData(prev => ({
        ...prev,
        attachments: [...(prev.attachments || []), newAttachment]
      }));
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Tải file lên Drive thất bại. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa file đính kèm này?')) {
      try {
        const targetAttachment = (formData.attachments || []).find((attachment) => String(attachment.id) === String(id));
        if (targetAttachment) {
          await deleteUploadedDocumentAttachment({
            driveFileId: targetAttachment.driveFileId || null,
            fileUrl: targetAttachment.fileUrl || null,
          });
        }

        setFormData(prev => ({
          ...prev,
          attachments: prev.attachments?.filter(a => a.id !== id)
        }));
      } catch (error) {
        console.error('Delete upload failed:', error);
        alert('Xóa file đính kèm thất bại. Vui lòng thử lại.');
      }
    }
  };

  return (
    <ModalWrapper
      onClose={onClose}
      title={
        mode === 'product_upload'
          ? 'Upload tài liệu sản phẩm'
          : type === 'ADD'
            ? 'Thêm mới Hồ sơ tài liệu'
            : 'Cập nhật Hồ sơ tài liệu'
      }
      icon={mode === 'product_upload' ? 'upload_file' : 'folder_open'}
      width="max-w-4xl"
    >
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Main Info */}
        <div className="space-y-5">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="material-symbols-outlined text-primary text-lg">info</span>
            Thông tin cơ bản
          </h3>
          
          <FormInput 
              label={isProductUploadMode ? 'Số văn bản' : 'Mã tài liệu'} 
              value={formData.id} 
              onChange={(e: any) => handleChange('id', e.target.value)} 
              placeholder={isProductUploadMode ? '123/QĐ-VNPT' : 'TL-2024-001'} 
              disabled={type === 'EDIT'} 
              required 
              error={errors.id}
          />

          <FormInput 
              label={isProductUploadMode ? 'Tên/Trích yếu văn bản' : 'Tên tài liệu'} 
              value={formData.name} 
              onChange={(e: any) => handleChange('name', e.target.value)} 
              placeholder={isProductUploadMode ? 'Nhập tên/trích yếu văn bản' : 'Nhập tên tài liệu'} 
              required 
              error={errors.name}
          />

          {!isProductUploadMode && (
            <FormSelect 
                label="Loại tài liệu" 
                value={formData.typeId} 
                onChange={(e: any) => handleChange('typeId', e.target.value)} 
                options={[{value: '', label: 'Chọn loại tài liệu'}, ...DOCUMENT_TYPES.map(t => ({value: t.id, label: t.name}))]} 
                required
                error={errors.typeId}
            />
          )}

          {!isProductUploadMode && (
            <SearchableSelect 
                label="Khách hàng"
                required
                options={customers.map(c => ({ value: String(c.id), label: `${c.customer_code} - ${c.customer_name}` }))}
                value={formData.customerId || ''}
                onChange={(val) => handleChange('customerId', val)}
                error={errors.customerId}
                placeholder="Chọn khách hàng"
            />
          )}

          {!isProductUploadMode && (
            <SearchableSelect 
                label="Dự án liên quan"
                options={filteredProjects.map(p => ({ value: String(p.id), label: `${p.project_code} - ${p.project_name}` }))}
                value={formData.projectId || ''}
                onChange={(val) => handleChange('projectId', val)}
                disabled={!formData.customerId}
                placeholder={!formData.customerId ? 'Vui lòng chọn KH trước' : 'Chọn dự án (không bắt buộc)'}
            />
          )}

          <SearchableMultiSelect
            label="Sản phẩm áp dụng"
            required={isProductUploadMode}
            options={productOptions}
            values={(formData.productIds || []).map((value) => String(value))}
            onChange={(nextValues) => {
              handleChange('productIds', nextValues);
              handleChange('productId', nextValues[0] || '');
            }}
            placeholder="Chọn một hoặc nhiều sản phẩm"
            error={errors.productIds}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormInput 
                label={isProductUploadMode ? 'Ngày ban hành' : 'Ngày hết hạn'} 
                type="date"
                value={formData.expiryDate} 
                onChange={(e: any) => handleChange('expiryDate', e.target.value)} 
            />
            <FormSelect 
                label="Trạng thái" 
                value={formData.status} 
                onChange={(e: any) => handleChange('status', e.target.value)} 
                options={DOCUMENT_STATUSES} 
            />
          </div>
        </div>

        {/* Right Column: Attachments */}
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
          <AttachmentManager 
            attachments={formData.attachments || []}
            onUpload={handleUploadFile}
            onDelete={handleDeleteFile}
            isUploading={isUploading}
          />
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-3">
            <span className="material-symbols-outlined text-blue-600 text-xl">cloud_done</span>
            <div>
              <p className="text-xs font-bold text-blue-800">Tích hợp Google Drive</p>
              <p className="text-[11px] text-blue-600 mt-0.5 leading-relaxed">
                File sẽ tải lên Google Drive khi hệ thống đã cấu hình Service Account. Nếu chưa cấu hình, file được lưu tạm trên máy chủ nội bộ.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors">Hủy</button>
        <button onClick={handleSubmit} className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-deep-teal shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
           <span className="material-symbols-outlined text-lg">check</span> {type === 'ADD' ? 'Lưu' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteDocumentModal: React.FC<{ data: AppDocument; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal 
     title="Xóa Hồ sơ tài liệu" 
     message={<p>Bạn có chắc chắn muốn xóa hồ sơ <span className="font-bold text-slate-900">"{data.name}"</span>? Các file đính kèm liên quan sẽ không bị xóa trên Drive nhưng sẽ mất liên kết.</p>}
     onClose={onClose} 
     onConfirm={onConfirm}
  />
);

// --- Reminder Modals ---

interface ReminderFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: Reminder | null;
  employees: Employee[];
  onClose: () => void;
  onSave: (data: Partial<Reminder>) => void;
}

export const ReminderFormModal: React.FC<ReminderFormModalProps> = ({ 
  type, data, employees, onClose, onSave 
}) => {
  const [formData, setFormData] = useState<Partial<Reminder>>({
    id: data?.id || '',
    title: data?.title || '',
    content: data?.content || '',
    remindDate: data?.remindDate || '',
    assignedToUserId: data?.assignedToUserId || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.title) newErrors.title = 'Tiêu đề là bắt buộc';
    if (!formData.remindDate) newErrors.remindDate = 'Ngày nhắc là bắt buộc';
    if (!formData.assignedToUserId) newErrors.assignedToUserId = 'Vui lòng chọn người được giao';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  const handleChange = (field: keyof Reminder, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm nhắc việc' : 'Cập nhật nhắc việc'} icon="notifications_active" width="max-w-lg">
      <div className="p-6 space-y-5">
        <FormInput 
            label="Tiêu đề nhắc việc" 
            value={formData.title} 
            onChange={(e: any) => handleChange('title', e.target.value)} 
            placeholder="Nhập tiêu đề..." 
            required 
            error={errors.title}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">Nội dung</label>
          <textarea 
            className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[100px] text-sm"
            value={formData.content}
            onChange={(e) => handleChange('content', e.target.value)}
            placeholder="Chi tiết công việc cần làm..."
          />
        </div>

        <FormInput 
            label="Ngày nhắc" 
            type="date"
            value={formData.remindDate} 
            onChange={(e: any) => handleChange('remindDate', e.target.value)} 
            required
            error={errors.remindDate}
        />

        <SearchableSelect 
            label="Người được giao"
            required
            options={employees.map(e => ({ value: String(e.id), label: getEmployeeLabel(e) }))}
            value={formData.assignedToUserId || ''}
            onChange={(val) => handleChange('assignedToUserId', val)}
            error={errors.assignedToUserId}
            placeholder="Chọn nhân viên"
        />
      </div>

      <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors">Hủy</button>
        <button onClick={handleSubmit} className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-deep-teal shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
           <span className="material-symbols-outlined text-lg">check</span> {type === 'ADD' ? 'Lưu' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteReminderModal: React.FC<{ data: Reminder; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal 
     title="Xóa nhắc việc" 
     message={<p>Bạn có chắc chắn muốn xóa nhắc việc <span className="font-bold text-slate-900">"{data.title}"</span>?</p>}
     onClose={onClose} 
     onConfirm={onConfirm}
  />
);

// --- User Dept History Modals ---

interface UserDeptHistoryFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: UserDeptHistory | null;
  employees: Employee[];
  departments: Department[];
  onClose: () => void;
  onSave: (data: Partial<UserDeptHistory>) => void;
}

const normalizeTransferCode = (value: unknown): string => {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return '';

  if (/^LC\d+$/.test(raw)) {
    const digits = raw.replace(/\D+/g, '');
    return `LC${digits.padStart(3, '0')}`;
  }

  const digits = raw.replace(/\D+/g, '');
  if (!digits) return raw;

  return `LC${digits.padStart(3, '0')}`;
};

export const UserDeptHistoryFormModal: React.FC<UserDeptHistoryFormModalProps> = ({ 
  type, data, employees, departments, onClose, onSave 
}) => {
  const resolveDeptId = (value: unknown): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    const matched = departments.find(
      (dept) => String(dept.id) === raw || dept.dept_code === raw || dept.dept_name === raw
    );
    return matched ? String(matched.id) : raw;
  };

  const [formData, setFormData] = useState<Partial<UserDeptHistory>>({
    id: data?.id || '',
    userId: String(data?.userId || ''),
    fromDeptId: resolveDeptId(data?.fromDeptId),
    toDeptId: resolveDeptId(data?.toDeptId),
    transferDate: data?.transferDate || new Date().toISOString().split('T')[0],
    reason: data?.reason || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-fill fromDeptId when userId changes
  useEffect(() => {
    if (type === 'ADD' && formData.userId) {
      const employee = employees.find(e => String(e.id) === String(formData.userId));
      if (employee) {
        setFormData(prev => ({ ...prev, fromDeptId: String(employee.department_id ?? '') }));
      }
    }
  }, [formData.userId, employees, type]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.userId) newErrors.userId = 'Vui lòng chọn nhân sự';
    if (!formData.toDeptId) newErrors.toDeptId = 'Vui lòng chọn phòng ban mới';
    if (!formData.transferDate) newErrors.transferDate = 'Ngày luân chuyển là bắt buộc';
    if (formData.fromDeptId === formData.toDeptId) newErrors.toDeptId = 'Phòng ban mới phải khác phòng ban hiện tại';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  const handleChange = (field: keyof UserDeptHistory, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const fromDeptLabel = useMemo(() => {
    const currentValue = String(formData.fromDeptId || '');
    if (!currentValue) return '';

    const matchedDept = departments.find(
      (dept) => String(dept.id) === currentValue || dept.dept_code === currentValue || dept.dept_name === currentValue
    );
    if (matchedDept) {
      return `${matchedDept.dept_code} - ${matchedDept.dept_name}`;
    }

    if (data?.fromDeptCode || data?.fromDeptName) {
      return `${data?.fromDeptCode || currentValue}${data?.fromDeptName ? ` - ${data.fromDeptName}` : ''}`;
    }

    return currentValue;
  }, [formData.fromDeptId, departments, data?.fromDeptCode, data?.fromDeptName]);

  const toDepartmentOptions = useMemo(
    () =>
      departments
        .filter((department) => String(department.id) !== String(formData.fromDeptId || ''))
        .map((department) => ({
          value: String(department.id),
          label: `${department.dept_code} - ${department.dept_name}`,
        })),
    [departments, formData.fromDeptId]
  );

  useEffect(() => {
    if (String(formData.toDeptId || '') === String(formData.fromDeptId || '')) {
      setFormData((prev) => ({ ...prev, toDeptId: '' }));
    }
  }, [formData.fromDeptId, formData.toDeptId]);

  const employeeOptions = useMemo(() => {
    const options = employees.map((e) => ({
      value: String(e.id),
      label: getEmployeeLabel(e),
    }));

    const currentUserId = String(data?.userId || '');
    if (currentUserId && !options.some((option) => option.value === currentUserId)) {
      options.unshift({
        value: currentUserId,
        label: `${normalizeEmployeeCode(data?.userCode || currentUserId, currentUserId)}${data?.userName ? ` - ${data.userName}` : ''}`,
      });
    }

    return options;
  }, [employees, data?.userId, data?.userCode, data?.userName]);

  const transferCodeDisplay = useMemo(() => {
    if (type === 'ADD') {
      return '';
    }
    return normalizeTransferCode(formData.id || data?.id || '');
  }, [type, formData.id, data?.id]);

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm mới Luân chuyển' : 'Cập nhật Luân chuyển'} icon="history_edu" width="max-w-lg">
      <div className="p-6 space-y-5">
        {type === 'EDIT' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700">
              Mã luân chuyển
              <span className="text-red-500"> *</span>
            </label>
            <input
              type="text"
              value={transferCodeDisplay}
              disabled
              className="w-full h-11 px-4 rounded-lg border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
            />
          </div>
        )}

        <SearchableSelect 
            label="Nhân sự"
            required
            options={employeeOptions}
            value={formData.userId || ''}
            onChange={(val) => handleChange('userId', val)}
            error={errors.userId}
            placeholder="Chọn nhân sự"
            disabled={type === 'EDIT'}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">Từ phòng ban</label>
          <input 
            type="text" 
            value={fromDeptLabel} 
            disabled 
            className="w-full h-11 px-4 rounded-lg border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
            placeholder="Tự động điền..."
          />
        </div>

        <SearchableSelect 
            label="Đến phòng ban"
            required
            options={toDepartmentOptions}
            value={formData.toDeptId || ''}
            onChange={(val) => handleChange('toDeptId', val)}
            error={errors.toDeptId}
            placeholder="Chọn phòng ban mới"
        />

        <FormInput 
            label="Ngày luân chuyển" 
            type="date"
            value={formData.transferDate} 
            onChange={(e: any) => handleChange('transferDate', e.target.value)} 
            required
            error={errors.transferDate}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">Lý do / Ghi chú</label>
          <textarea 
            className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[100px] text-sm"
            value={formData.reason}
            onChange={(e) => handleChange('reason', e.target.value)}
            placeholder="Nhập lý do điều chuyển..."
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors">Hủy</button>
        <button onClick={handleSubmit} className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-deep-teal shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
           <span className="material-symbols-outlined text-lg">check</span> {type === 'ADD' ? 'Lưu & Cập nhật' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteUserDeptHistoryModal: React.FC<{ data: UserDeptHistory; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal 
     title="Xóa lịch sử luân chuyển" 
     message={<p>Bạn có chắc chắn muốn xóa bản ghi <span className="font-bold text-slate-900">"{normalizeTransferCode(data.id)}"</span>?</p>}
     onClose={onClose} 
     onConfirm={onConfirm}
  />
);
