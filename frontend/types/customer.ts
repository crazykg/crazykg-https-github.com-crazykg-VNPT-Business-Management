import type { Status } from './common';
import type { Product } from './product';

export interface Customer {
  id: string | number;
  uuid: string;
  customer_code: string | null;
  customer_code_auto_generated?: boolean | null;
  customer_name: string;
  company_name?: string | null;
  tax_code: string;
  address: string;
  customer_sector?: 'HEALTHCARE' | 'GOVERNMENT' | 'INDIVIDUAL' | 'OTHER' | null;
  healthcare_facility_type?:
    | 'PUBLIC_HOSPITAL'
    | 'PRIVATE_HOSPITAL'
    | 'MEDICAL_CENTER'
    | 'PRIVATE_CLINIC'
    | 'TYT_PKDK'
    | 'HOSPITAL_TTYT'
    | 'TYT_CLINIC'
    | 'OTHER'
    | null;
  bed_capacity?: number | null;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}

export interface CustomerInsightServiceUsed {
  product_id: string | number;
  product_name: string;
  unit?: string | null;
  service_group?: string | null;
  contract_count: number;
  total_value: number;
}

export interface CustomerInsightUpsellCandidate {
  product_id: string | number;
  product_code: string;
  product_name: string;
  product_description?: string | null;
  standard_price: number;
  unit?: string | null;
  service_group?: string | null;
  service_group_label: string;
  reason: string;
  popularity: number;
  is_priority: boolean;
  recommendation_type: 'targeted' | 'popular';
  segment_priority?: number | null;
  sales_notes?: string | null;
  similar_customers: UpsellSimilarCustomer[];
  reference_customers: string[];
}

export interface UpsellSimilarCustomer {
  customer_name: string;
  customer_sector?: string | null;
  healthcare_facility_type?: string | null;
  is_same_type: boolean;
}

export interface UpsellFeatureGroup {
  id: string | number;
  group_name: string;
  features: {
    feature_name: string;
    detail_description?: string | null;
  }[];
}

export interface UpsellSectorCustomer {
  customer_name: string;
  customer_sector?: string | null;
  healthcare_facility_type?: string | null;
  contract_count: number;
  total_value: number;
}

export interface UpsellProductDetail {
  product: Pick<
    Product,
    'id' | 'product_code' | 'product_name' | 'description' | 'standard_price' | 'unit' | 'service_group'
  >;
  feature_groups: UpsellFeatureGroup[];
  sector_customers: UpsellSectorCustomer[];
  segment_match?: {
    priority: number;
    sales_notes?: string | null;
    match_criteria: string;
  } | null;
}

export interface CustomerInsight {
  customer: Customer;
  contracts_summary: {
    total_count: number;
    total_value: number;
    active_value: number;
    by_status: Record<string, number>;
  };
  services_used: CustomerInsightServiceUsed[];
  crc_summary: {
    total_cases: number;
    open_cases: number;
    by_status: Record<string, number>;
  };
  upsell_candidates: CustomerInsightUpsellCandidate[];
}

export type PositionType = string;

export interface CustomerPersonnel {
  id: string;
  fullName: string;
  birthday: string;
  positionType: PositionType;
  positionId?: string | number | null;
  positionLabel?: string | null;
  phoneNumber: string;
  email: string;
  customerId: string;
  status: Status;
}
