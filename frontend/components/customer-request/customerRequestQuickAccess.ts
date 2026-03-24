import type { YeuCau } from '../../types';
import {
  resolveRequestProcessCode,
  type CustomerRequestRoleFilter,
} from './presentation';
import type { CustomerRequestSurfaceKey } from './CustomerRequestSurfaceSwitch';

export type CustomerRequestWorkspaceKey =
  | 'overview'
  | 'creator'
  | 'dispatcher'
  | 'performer';

export type CustomerRequestQuickFilters = {
  processCode?: string;
  keyword?: string;
  customerId?: string;
  supportGroupId?: string;
  priority?: string;
  roleFilter?: CustomerRequestRoleFilter;
  missingEstimate?: boolean;
  overEstimate?: boolean;
  slaRisk?: boolean;
};

export type CustomerRequestSavedView = {
  id: string;
  label: string;
  subtitle: string;
  workspaceTab: CustomerRequestWorkspaceKey;
  surface: CustomerRequestSurfaceKey;
  filters?: CustomerRequestQuickFilters;
};

export type CustomerRequestQuickRequestItem = {
  requestId: string | number;
  statusCode?: string | null;
  code: string;
  title: string;
  subtitle: string;
};

export const DEFAULT_CUSTOMER_REQUEST_SAVED_VIEWS: CustomerRequestSavedView[] = [
  {
    id: 'overview_hot',
    label: 'Toàn cảnh',
    subtitle: 'Toàn cảnh customer request',
    workspaceTab: 'overview',
    surface: 'analytics',
  },
  {
    id: 'sla_risk',
    label: 'Nguy cơ SLA',
    subtitle: 'Danh sách nguy cơ SLA',
    workspaceTab: 'overview',
    surface: 'list',
    filters: { slaRisk: true },
  },
  {
    id: 'creator_follow_up',
    label: 'Người tạo cần xử lý',
    subtitle: 'Đánh giá và thông báo KH',
    workspaceTab: 'creator',
    surface: 'inbox',
  },
  {
    id: 'dispatcher_queue',
    label: 'Mới tiếp nhận (PM)',
    subtitle: 'Ca bước đầu PM cần rà soát',
    workspaceTab: 'dispatcher',
    surface: 'list',
    filters: { roleFilter: 'dispatcher', processCode: 'new_intake' },
  },
  {
    id: 'performer_focus',
    label: 'Người xử lý đang làm',
    subtitle: 'Danh sách việc đang xử lý',
    workspaceTab: 'performer',
    surface: 'list',
    filters: { roleFilter: 'performer', processCode: 'in_progress' },
  },
  {
    id: 'over_estimate',
    label: 'Vượt ước lượng',
    subtitle: 'Cần PM can thiệp sớm',
    workspaceTab: 'overview',
    surface: 'list',
    filters: { overEstimate: true },
  },
];

export const CUSTOMER_REQUEST_PINNED_LIMIT = 8;
export const CUSTOMER_REQUEST_RECENT_LIMIT = 6;

export const buildCustomerRequestQuickItem = (
  request: YeuCau
): CustomerRequestQuickRequestItem => ({
  requestId: request.id,
  statusCode: resolveRequestProcessCode(request),
  code: request.ma_yc || request.request_code || String(request.id),
  title: request.tieu_de || request.summary || 'Yêu cầu không có tiêu đề',
  subtitle: [
    request.khach_hang_name || request.customer_name,
    request.project_name,
    request.product_name,
  ]
    .filter(Boolean)
    .join(' · '),
});
