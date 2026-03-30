import type { Customer } from '../types';

export type CustomerSectorValue = NonNullable<Customer['customer_sector']>;
export type CanonicalHealthcareFacilityTypeValue =
  | 'PUBLIC_HOSPITAL'
  | 'PRIVATE_HOSPITAL'
  | 'MEDICAL_CENTER'
  | 'PRIVATE_CLINIC'
  | 'TYT_PKDK'
  | 'OTHER';

type LegacyHealthcareFacilityTypeValue = 'HOSPITAL_TTYT' | 'TYT_CLINIC';

export const CUSTOMER_SECTOR_OPTIONS = [
  { value: 'OTHER', label: 'Khác', description: 'Khách hàng không thuộc các nhóm ưu tiên bên dưới.' },
  { value: 'HEALTHCARE', label: 'Y tế', description: 'Khách hàng là bệnh viện, trung tâm y tế, trạm y tế hoặc phòng khám.' },
  { value: 'GOVERNMENT', label: 'Chính quyền', description: 'Khách hàng thuộc cơ quan nhà nước hoặc đơn vị hành chính.' },
  { value: 'INDIVIDUAL', label: 'Cá nhân', description: 'Khách hàng là cá nhân hoặc hộ kinh doanh cá thể.' },
] as const;

export const HEALTHCARE_FACILITY_TYPE_OPTIONS = [
  { value: 'PUBLIC_HOSPITAL', label: 'Bệnh viện (Công lập)', description: 'Bệnh viện công lập hoặc thuộc hệ thống nhà nước.' },
  { value: 'PRIVATE_HOSPITAL', label: 'Bệnh viện (Tư nhân)', description: 'Bệnh viện tư nhân hoặc ngoài công lập.' },
  { value: 'MEDICAL_CENTER', label: 'Trung tâm Y tế', description: 'Trung tâm y tế tuyến huyện, quận hoặc tương đương.' },
  { value: 'PRIVATE_CLINIC', label: 'Phòng khám (Tư nhân)', description: 'Phòng khám tư nhân hoặc phòng khám chuyên khoa.' },
  { value: 'TYT_PKDK', label: 'TYT và PKĐK', description: 'Trạm y tế, phòng khám đa khoa hoặc mô hình tương đương.' },
  { value: 'OTHER', label: 'Khác', description: 'Mô hình y tế khác.' },
] as const;

const HEALTHCARE_CUSTOMER_KEYWORDS = [
  'benh vien',
  'bệnh viện',
  'trung tam y te',
  'trung tâm y tế',
  'tram y te',
  'trạm y tế',
  'phong kham',
  'phòng khám',
  'pkdk',
] as const;

const CUSTOMER_SECTOR_LABEL_MAP: Record<CustomerSectorValue, string> = {
  OTHER: 'Khác',
  HEALTHCARE: 'Y tế',
  GOVERNMENT: 'Chính quyền',
  INDIVIDUAL: 'Cá nhân',
};

const HEALTHCARE_FACILITY_TYPE_LABEL_MAP: Record<CanonicalHealthcareFacilityTypeValue, string> = {
  PUBLIC_HOSPITAL: 'Bệnh viện (Công lập)',
  PRIVATE_HOSPITAL: 'Bệnh viện (Tư nhân)',
  MEDICAL_CENTER: 'Trung tâm Y tế',
  PRIVATE_CLINIC: 'Phòng khám (Tư nhân)',
  TYT_PKDK: 'TYT và PKĐK',
  OTHER: 'Khác',
};

const CUSTOMER_SECTOR_ALIAS_MAP: Record<string, CustomerSectorValue> = {
  yte: 'HEALTHCARE',
  healthcare: 'HEALTHCARE',
  benhvien: 'HEALTHCARE',
  trungtamyte: 'HEALTHCARE',
  tramyte: 'HEALTHCARE',
  pkdk: 'HEALTHCARE',
  phongkham: 'HEALTHCARE',
  chinhquyen: 'GOVERNMENT',
  government: 'GOVERNMENT',
  coquannhanuoc: 'GOVERNMENT',
  coquanhanhchinh: 'GOVERNMENT',
  canhan: 'INDIVIDUAL',
  individual: 'INDIVIDUAL',
  hokinhdoanh: 'INDIVIDUAL',
  khac: 'OTHER',
  other: 'OTHER',
};

const HEALTHCARE_FACILITY_TYPE_ALIAS_MAP: Record<string, CanonicalHealthcareFacilityTypeValue> = {
  benhvienconglap: 'PUBLIC_HOSPITAL',
  publichospital: 'PUBLIC_HOSPITAL',
  hospitalpublic: 'PUBLIC_HOSPITAL',
  benhvien: 'PUBLIC_HOSPITAL',
  benhvientunhan: 'PRIVATE_HOSPITAL',
  privatehospital: 'PRIVATE_HOSPITAL',
  hospitalprivate: 'PRIVATE_HOSPITAL',
  benhvienngoaiconglap: 'PRIVATE_HOSPITAL',
  benhvienquocte: 'PRIVATE_HOSPITAL',
  trungtamyte: 'MEDICAL_CENTER',
  medicalcenter: 'MEDICAL_CENTER',
  ttyt: 'MEDICAL_CENTER',
  phongkhamtunhan: 'PRIVATE_CLINIC',
  privateclinic: 'PRIVATE_CLINIC',
  clinicprivate: 'PRIVATE_CLINIC',
  phongkham: 'PRIVATE_CLINIC',
  clinic: 'PRIVATE_CLINIC',
  tytvapkdk: 'TYT_PKDK',
  tytpkdk: 'TYT_PKDK',
  tramyte: 'TYT_PKDK',
  tyt: 'TYT_PKDK',
  pkdk: 'TYT_PKDK',
  phongkhamdakhoa: 'TYT_PKDK',
  khac: 'OTHER',
  other: 'OTHER',
};

const LEGACY_HEALTHCARE_FACILITY_TYPE_ALIAS_MAP: Record<string, LegacyHealthcareFacilityTypeValue> = {
  bvttyt: 'HOSPITAL_TTYT',
  tytpk: 'TYT_CLINIC',
};

const BED_CAPACITY_ENABLED_FACILITY_TYPES = new Set<CanonicalHealthcareFacilityTypeValue>([
  'PUBLIC_HOSPITAL',
  'PRIVATE_HOSPITAL',
  'MEDICAL_CENTER',
]);

const normalizeVietnameseLookupText = (value: unknown): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeVietnameseLookupToken = (value: unknown): string =>
  normalizeVietnameseLookupText(value).replace(/\s+/g, '');

const isCustomerSectorValue = (value: string): value is CustomerSectorValue => (
  value === 'OTHER'
  || value === 'HEALTHCARE'
  || value === 'GOVERNMENT'
  || value === 'INDIVIDUAL'
);

const isCanonicalHealthcareFacilityTypeValue = (value: string): value is CanonicalHealthcareFacilityTypeValue => (
  value === 'PUBLIC_HOSPITAL'
  || value === 'PRIVATE_HOSPITAL'
  || value === 'MEDICAL_CENTER'
  || value === 'PRIVATE_CLINIC'
  || value === 'TYT_PKDK'
  || value === 'OTHER'
);

const isLegacyHealthcareFacilityTypeValue = (value: string): value is LegacyHealthcareFacilityTypeValue => (
  value === 'HOSPITAL_TTYT'
  || value === 'TYT_CLINIC'
);

export const inferCustomerSector = (value: unknown): CustomerSectorValue => {
  const normalized = normalizeVietnameseLookupText(value);
  if (!normalized) {
    return 'OTHER';
  }

  return HEALTHCARE_CUSTOMER_KEYWORDS.some((keyword) => normalized.includes(normalizeVietnameseLookupText(keyword)))
    ? 'HEALTHCARE'
    : 'OTHER';
};

export const inferHealthcareFacilityType = (value: unknown): CanonicalHealthcareFacilityTypeValue | null => {
  const normalized = normalizeVietnameseLookupText(value);
  const token = normalizeVietnameseLookupToken(value);
  if (!normalized) {
    return null;
  }

  const hasPrivateMarker = normalized.includes('tu nhan')
    || normalized.includes('ngoai cong lap')
    || normalized.includes('private')
    || normalized.includes('quoc te')
    || token.includes('tunhan')
    || token.includes('private')
    || token.includes('ngoaiconglap')
    || token.includes('quocte');

  if (normalized.includes('benh vien') || token.includes('benhvien')) {
    return hasPrivateMarker ? 'PRIVATE_HOSPITAL' : 'PUBLIC_HOSPITAL';
  }

  if (normalized.includes('trung tam y te') || token.includes('trungtamyte') || token.includes('ttyt')) {
    return 'MEDICAL_CENTER';
  }

  if (
    normalized.includes('phong kham da khoa')
    || token.includes('phongkhamdakhoa')
    || normalized.includes('pkdk')
    || token.includes('pkdk')
    || normalized.includes('tram y te')
    || token.includes('tramyte')
    || token === 'tyt'
  ) {
    return 'TYT_PKDK';
  }

  if (normalized.includes('phong kham') || token.includes('phongkham') || token.includes('clinic')) {
    return 'PRIVATE_CLINIC';
  }

  return null;
};

export const normalizeCustomerSectorValue = (
  value: unknown,
  fallback: CustomerSectorValue = 'OTHER',
): CustomerSectorValue => {
  const normalized = String(value || '').trim().toUpperCase();
  if (isCustomerSectorValue(normalized)) {
    return normalized;
  }

  const alias = CUSTOMER_SECTOR_ALIAS_MAP[normalizeVietnameseLookupToken(value)];
  return alias || fallback;
};

export const normalizeHealthcareFacilityTypeValue = (
  value: unknown,
  fallback: CanonicalHealthcareFacilityTypeValue | null = null,
): CanonicalHealthcareFacilityTypeValue | null => {
  const normalized = String(value || '').trim().toUpperCase();
  if (isCanonicalHealthcareFacilityTypeValue(normalized)) {
    return normalized;
  }

  if (isLegacyHealthcareFacilityTypeValue(normalized)) {
    return normalized === 'HOSPITAL_TTYT'
      ? (fallback || 'PUBLIC_HOSPITAL')
      : (fallback || 'TYT_PKDK');
  }

  const token = normalizeVietnameseLookupToken(value);
  const alias = HEALTHCARE_FACILITY_TYPE_ALIAS_MAP[token];
  if (alias) {
    return alias;
  }

  const legacyAlias = LEGACY_HEALTHCARE_FACILITY_TYPE_ALIAS_MAP[token];
  if (legacyAlias) {
    return legacyAlias === 'HOSPITAL_TTYT'
      ? (fallback || 'PUBLIC_HOSPITAL')
      : (fallback || 'TYT_PKDK');
  }

  return fallback;
};

export const resolveCustomerSector = (
  customer: Pick<Customer, 'customer_sector' | 'customer_name' | 'company_name'>,
): CustomerSectorValue => {
  return normalizeCustomerSectorValue(
    customer.customer_sector,
    inferCustomerSector(customer.customer_name || customer.company_name || ''),
  );
};

export const resolveHealthcareFacilityType = (
  customer: Pick<Customer, 'healthcare_facility_type' | 'customer_name' | 'company_name'>,
): CanonicalHealthcareFacilityTypeValue | null => {
  const inferred = inferHealthcareFacilityType(customer.customer_name || customer.company_name || '');
  return normalizeHealthcareFacilityTypeValue(customer.healthcare_facility_type, inferred);
};

export const getCustomerSectorLabel = (sector: Customer['customer_sector'] | undefined): string => {
  const normalized = String(sector || '').trim().toUpperCase();
  return isCustomerSectorValue(normalized) ? CUSTOMER_SECTOR_LABEL_MAP[normalized] : CUSTOMER_SECTOR_LABEL_MAP.OTHER;
};

export const getHealthcareFacilityTypeLabel = (
  facilityType: Customer['healthcare_facility_type'] | undefined,
  customerName?: unknown,
): string | null => {
  const normalized = normalizeHealthcareFacilityTypeValue(
    facilityType,
    customerName ? inferHealthcareFacilityType(customerName) : null,
  );
  return normalized ? HEALTHCARE_FACILITY_TYPE_LABEL_MAP[normalized] : null;
};

export const facilityTypeSupportsBedCapacity = (
  facilityType: Customer['healthcare_facility_type'] | undefined,
  customerName?: unknown,
): boolean => {
  const resolvedType = normalizeHealthcareFacilityTypeValue(
    facilityType,
    customerName ? inferHealthcareFacilityType(customerName) : null,
  );
  return resolvedType ? BED_CAPACITY_ENABLED_FACILITY_TYPES.has(resolvedType) : false;
};

export const getCustomerGroupDisplay = (
  customer: Pick<Customer, 'customer_sector' | 'healthcare_facility_type' | 'customer_name' | 'company_name'>,
): { label: string; detail: string | null; sector: CustomerSectorValue } => {
  const sector = resolveCustomerSector(customer);
  const facilityType = sector === 'HEALTHCARE' ? resolveHealthcareFacilityType(customer) : null;

  return {
    label: getCustomerSectorLabel(sector),
    detail: facilityType ? HEALTHCARE_FACILITY_TYPE_LABEL_MAP[facilityType] : null,
    sector,
  };
};
