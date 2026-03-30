export interface Business {
  id: string | number;
  uuid?: string;
  domain_code: string;
  domain_name: string;
  focal_point_name?: string | null;
  focal_point_phone?: string | null;
  focal_point_email?: string | null;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}

export interface Vendor {
  id: string | number;
  uuid: string;
  vendor_code: string;
  vendor_name: string;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}
