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
    product_package_id?: number;
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
