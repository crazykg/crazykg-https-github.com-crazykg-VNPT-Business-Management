import type { AuditLog } from './admin';
import type { Attachment } from './common';
import type { Employee } from './employee';

export interface Product {
  id: string | number;
  uuid?: string;
  service_group?: string | null;
  product_code: string;
  product_name: string;
  package_name?: string | null;
  domain_id: string | number;
  vendor_id: string | number;
  standard_price: number;
  unit?: string | null;
  description?: string | null;
  attachments?: Attachment[];
  is_active?: boolean;
  standard_price_locked?: boolean;
  standard_price_lock_message?: string | null;
  standard_price_lock_references?: Array<{ table: string; label: string; count: number }>;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}

export type ProductTargetSegmentCustomerSector = 'HEALTHCARE' | 'GOVERNMENT' | 'INDIVIDUAL' | 'OTHER';

export type ProductTargetSegmentFacilityType =
  | 'PUBLIC_HOSPITAL'
  | 'PRIVATE_HOSPITAL'
  | 'MEDICAL_CENTER'
  | 'PRIVATE_CLINIC'
  | 'TYT_PKDK'
  | 'OTHER';

export interface ProductTargetSegment {
  id: string | number;
  uuid?: string | null;
  product_id: string | number;
  customer_sector: ProductTargetSegmentCustomerSector;
  facility_type: ProductTargetSegmentFacilityType | null;
  facility_types?: ProductTargetSegmentFacilityType[] | null;
  bed_capacity_min: number | null;
  bed_capacity_max: number | null;
  priority: number;
  sales_notes?: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | number | null;
  updated_by?: string | number | null;
}

export type ProductFeatureStatus = 'ACTIVE' | 'INACTIVE';

export interface ProductFeature {
  id: string | number;
  uuid?: string | null;
  product_id: string | number;
  group_id: string | number;
  feature_name: string;
  detail_description?: string | null;
  status: ProductFeatureStatus;
  display_order: number;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
  created_by_actor?: Pick<Employee, 'id' | 'full_name' | 'username'> | null;
  updated_by_actor?: Pick<Employee, 'id' | 'full_name' | 'username'> | null;
}

export interface ProductFeatureGroup {
  id: string | number;
  uuid?: string | null;
  product_id: string | number;
  group_name: string;
  display_order: number;
  notes?: string | null;
  features: ProductFeature[];
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
  created_by_actor?: Pick<Employee, 'id' | 'full_name' | 'username'> | null;
  updated_by_actor?: Pick<Employee, 'id' | 'full_name' | 'username'> | null;
}

export interface ProductFeatureCatalog {
  product: Pick<Product, 'id' | 'uuid' | 'service_group' | 'product_code' | 'product_name' | 'package_name' | 'description' | 'is_active'> & {
    catalog_package_count?: number;
  };
  catalog_scope?: {
    catalog_product_id: string | number;
    product_ids: Array<string | number>;
    package_count: number;
    product_codes: string[];
  };
  groups: ProductFeatureGroup[];
  audit_logs: AuditLog[];
}

export interface ProductFeatureCatalogListRow {
  row_type: 'group' | 'feature';
  group_id: string | number;
  feature_id?: string | number | null;
  group_display_order: number;
  feature_display_order?: number | null;
  name: string;
  detail: string;
}

export interface ProductFeatureCatalogListPage {
  product: Pick<Product, 'id' | 'uuid' | 'service_group' | 'product_code' | 'product_name' | 'package_name' | 'description' | 'is_active'> & {
    catalog_package_count?: number;
  };
  catalog_scope?: {
    catalog_product_id: string | number;
    product_ids: Array<string | number>;
    package_count: number;
    product_codes: string[];
  };
  group_filters: Array<{
    id: string | number;
    group_name: string;
    display_order: number;
    notes?: string | null;
  }>;
  rows: ProductFeatureCatalogListRow[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}
