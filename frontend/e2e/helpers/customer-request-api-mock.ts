import type { Page, Route } from '@playwright/test';
import type { MockCustomerRequestCase, MockCustomerRequestScenarioState } from './customer-request-fixtures';

const STATUS_LABELS: Record<string, string> = {
  new_intake: 'Mới tiếp nhận',
  dispatched: 'Đã điều phối',
  waiting_customer_feedback: 'Đợi phản hồi KH',
  in_progress: 'Đang xử lý',
  analysis: 'Phân tích',
  coding: 'Lập trình',
  dms_transfer: 'Chuyển DMS',
  returned_to_manager: 'Trả người quản lý',
  completed: 'Hoàn thành',
  customer_notified: 'Báo khách hàng',
  not_executed: 'Không thực hiện',
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  new_intake: ['in_progress', 'analysis', 'waiting_customer_feedback', 'not_executed'],
  dispatched: ['in_progress', 'analysis', 'returned_to_manager'],
  waiting_customer_feedback: ['in_progress', 'not_executed'],
  in_progress: ['analysis', 'completed', 'returned_to_manager'],
  analysis: ['in_progress', 'coding', 'dms_transfer', 'completed', 'returned_to_manager'],
  coding: ['in_progress', 'completed', 'returned_to_manager'],
  dms_transfer: ['in_progress', 'completed', 'returned_to_manager'],
  returned_to_manager: ['in_progress', 'analysis', 'not_executed'],
  completed: ['customer_notified'],
  customer_notified: [],
  not_executed: [],
};

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeSearch(value: unknown): string {
  return normalize(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function nowSql(): string {
  return '2026-03-21 10:00:00';
}

async function fulfillJson(route: Route, payload: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

function parseJsonBody(route: Route): Record<string, unknown> {
  const raw = route.request().postData();
  if (!raw) {
    return {};
  }

  return JSON.parse(raw) as Record<string, unknown>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function statusMeta(statusCode: string) {
  return {
    status_code: statusCode,
    process_code: statusCode,
    process_label: STATUS_LABELS[statusCode] ?? statusCode,
    group_code:
      statusCode === 'new_intake'
        ? 'intake'
        : statusCode === 'waiting_customer_feedback'
        ? 'feedback'
        : ['completed', 'customer_notified', 'not_executed'].includes(statusCode)
        ? 'closure'
        : 'execution',
    group_label:
      statusCode === 'new_intake'
        ? 'Tiếp nhận'
        : statusCode === 'waiting_customer_feedback'
        ? 'Phản hồi KH'
        : ['completed', 'customer_notified', 'not_executed'].includes(statusCode)
        ? 'Hoàn tất'
        : 'Xử lý',
    table_name: `customer_request_${statusCode}`,
    default_status: statusCode,
    read_roles: ['creator', 'dispatcher', 'performer', 'admin'],
    write_roles: ['creator', 'dispatcher', 'performer', 'admin'],
    allowed_next_processes: STATUS_TRANSITIONS[statusCode] ?? [],
    form_fields:
      statusCode === 'waiting_customer_feedback'
        ? [
            { name: 'feedback_request_content', label: 'Nội dung cần khách hàng bổ sung', type: 'textarea', required: false },
            { name: 'customer_due_at', label: 'Hạn phản hồi', type: 'datetime', required: false },
          ]
        : statusCode === 'in_progress'
        ? [
            { name: 'performer_user_id', label: 'Người xử lý', type: 'user_select', required: false },
            { name: 'processing_content', label: 'Nội dung xử lý', type: 'textarea', required: false },
          ]
        : statusCode === 'analysis'
        ? [
            { name: 'performer_user_id', label: 'Người xử lý', type: 'user_select', required: false },
            { name: 'analysis_content', label: 'Nội dung phân tích', type: 'textarea', required: false },
          ]
        : statusCode === 'coding'
        ? [
            { name: 'performer_user_id', label: 'Người lập trình', type: 'user_select', required: false },
            { name: 'coding_content', label: 'Nội dung lập trình', type: 'textarea', required: false },
          ]
        : statusCode === 'dms_transfer'
        ? [
            { name: 'performer_user_id', label: 'Người phụ trách DMS', type: 'user_select', required: false },
            { name: 'dms_transfer_note', label: 'Ghi chú chuyển DMS', type: 'textarea', required: false },
          ]
        : statusCode === 'completed'
        ? [
            { name: 'completed_by_user_id', label: 'Người hoàn thành', type: 'user_select', required: false },
            { name: 'completed_at', label: 'Thời điểm hoàn thành', type: 'datetime', required: false },
            { name: 'result_content', label: 'Kết quả thực hiện', type: 'textarea', required: false },
          ]
        : statusCode === 'returned_to_manager'
        ? [
            { name: 'blocking_reason', label: 'Lý do chuyển trả', type: 'textarea', required: false },
          ]
        : statusCode === 'customer_notified'
        ? [
            { name: 'notification_channel', label: 'Kênh báo', type: 'enum', options: ['Điện thoại', 'Email', 'Zalo', 'Teams'], required: false },
            { name: 'notification_content', label: 'Nội dung đã báo khách hàng', type: 'textarea', required: false },
          ]
        : statusCode === 'not_executed'
        ? [{ name: 'decision_reason', label: 'Lý do không thực hiện', type: 'textarea', required: false }]
        : [],
    list_columns: [
      { key: 'request_code', label: 'Mã YC' },
      { key: 'summary', label: 'Tóm tắt' },
    ],
  };
}

function allStatuses() {
  return [
    'new_intake',
    'dispatched',
    'waiting_customer_feedback',
    'in_progress',
    'analysis',
    'coding',
    'dms_transfer',
    'returned_to_manager',
    'completed',
    'customer_notified',
    'not_executed',
  ].map((code) => statusMeta(code));
}

function computeDerived(caseItem: MockCustomerRequestCase) {
  caseItem.total_hours_spent = Number(
    caseItem.worklogs.reduce((sum, row) => sum + Number(row.hours_spent ?? 0), 0).toFixed(2)
  );
  const missingEstimate = caseItem.estimated_hours == null || Number(caseItem.estimated_hours) <= 0;
  const overEstimate = !missingEstimate && caseItem.total_hours_spent > Number(caseItem.estimated_hours);
  const hoursUsagePct =
    caseItem.estimated_hours && Number(caseItem.estimated_hours) > 0
      ? Math.round((caseItem.total_hours_spent / Number(caseItem.estimated_hours)) * 100)
      : null;

  return {
    missingEstimate,
    overEstimate,
    hoursUsagePct,
    warningLevel: overEstimate ? 'critical' : missingEstimate ? 'warning' : 'normal',
  };
}

function toYeuCau(caseItem: MockCustomerRequestCase) {
  const derived = computeDerived(caseItem);
  return {
    id: caseItem.id,
    ma_yc: caseItem.request_code,
    request_code: caseItem.request_code,
    tieu_de: caseItem.summary,
    summary: caseItem.summary,
    mo_ta: caseItem.description,
    description: caseItem.description,
    do_uu_tien: caseItem.priority,
    source_channel: caseItem.source_channel,
    kenh_tiep_nhan: caseItem.source_channel,
    created_by: caseItem.created_by,
    created_by_name: caseItem.created_by_name,
    nguoi_tao_id: caseItem.created_by,
    nguoi_tao_name: caseItem.created_by_name,
    received_by_user_id: caseItem.received_by_user_id,
    received_by_name: caseItem.received_by_name,
    dispatcher_user_id: caseItem.dispatcher_user_id,
    dispatcher_name: caseItem.dispatcher_name,
    performer_user_id: caseItem.performer_user_id,
    performer_name: caseItem.performer_name,
    customer_id: caseItem.customer_id,
    customer_name: caseItem.customer_name,
    khach_hang_id: caseItem.customer_id,
    khach_hang_name: caseItem.customer_name,
    customer_personnel_id: caseItem.customer_personnel_id,
    requester_name: caseItem.customer_personnel_name,
    support_service_group_id: caseItem.support_service_group_id,
    support_service_group_name: caseItem.support_service_group_name,
    project_id: caseItem.project_id,
    project_name: caseItem.project_name,
    project_item_id: caseItem.project_item_id,
    product_id: caseItem.product_id,
    current_status_code: caseItem.current_status_code,
    current_status_name_vi: STATUS_LABELS[caseItem.current_status_code] ?? caseItem.current_status_code,
    trang_thai: caseItem.current_status_code,
    tien_trinh_hien_tai: caseItem.current_status_code,
    current_process_label: STATUS_LABELS[caseItem.current_status_code] ?? caseItem.current_status_code,
    ket_qua:
      caseItem.current_status_code === 'not_executed'
        ? 'khong_tiep_nhan'
        : ['completed', 'customer_notified'].includes(caseItem.current_status_code)
        ? 'hoan_thanh'
        : 'dang_xu_ly',
    estimated_hours: caseItem.estimated_hours,
    total_hours_spent: caseItem.total_hours_spent,
    hours_usage_pct: derived.hoursUsagePct,
    warning_level: derived.warningLevel,
    over_estimate: derived.overEstimate,
    missing_estimate: derived.missingEstimate,
    sla_due_at: caseItem.sla_due_at,
    sla_status:
      caseItem.sla_due_at && ['completed', 'customer_notified', 'not_executed'].includes(caseItem.current_status_code) === false
        ? 'at_risk'
        : null,
    completed_at: caseItem.completed_at,
    received_at: caseItem.created_at,
    created_at: caseItem.created_at,
    updated_at: caseItem.updated_at,
  };
}

function buildHoursReport(caseItem: MockCustomerRequestCase) {
  const byPerformerMap = new Map<string, { performed_by_user_id: number | null; performed_by_name: string | null; hours_spent: number; worklog_count: number }>();
  const byActivityMap = new Map<string, { activity_type_code: string; hours_spent: number; worklog_count: number }>();

  caseItem.worklogs.forEach((row) => {
    const performerKey = String(row.performed_by_user_id ?? '0');
    const performerEntry = byPerformerMap.get(performerKey) ?? {
      performed_by_user_id: Number(row.performed_by_user_id ?? 0) || null,
      performed_by_name: String(row.performed_by_name ?? '') || null,
      hours_spent: 0,
      worklog_count: 0,
    };
    performerEntry.hours_spent += Number(row.hours_spent ?? 0);
    performerEntry.worklog_count += 1;
    byPerformerMap.set(performerKey, performerEntry);

    const activityKey = String(row.activity_type_code ?? 'support');
    const activityEntry = byActivityMap.get(activityKey) ?? {
      activity_type_code: activityKey,
      hours_spent: 0,
      worklog_count: 0,
    };
    activityEntry.hours_spent += Number(row.hours_spent ?? 0);
    activityEntry.worklog_count += 1;
    byActivityMap.set(activityKey, activityEntry);
  });

  const derived = computeDerived(caseItem);

  return {
    request_case_id: caseItem.id,
    estimated_hours: caseItem.estimated_hours,
    total_hours_spent: caseItem.total_hours_spent,
    remaining_hours:
      caseItem.estimated_hours == null ? null : Number((Number(caseItem.estimated_hours) - caseItem.total_hours_spent).toFixed(2)),
    hours_usage_pct: derived.hoursUsagePct,
    warning_level: derived.warningLevel,
    over_estimate: derived.overEstimate,
    missing_estimate: derived.missingEstimate,
    latest_estimate: caseItem.estimates[caseItem.estimates.length - 1] ?? null,
    worklog_count: caseItem.worklogs.length,
    billable_hours: caseItem.worklogs.reduce((sum, row) => sum + (row.is_billable ? Number(row.hours_spent ?? 0) : 0), 0),
    non_billable_hours: caseItem.worklogs.reduce((sum, row) => sum + (!row.is_billable ? Number(row.hours_spent ?? 0) : 0), 0),
    by_performer: Array.from(byPerformerMap.values()),
    by_activity: Array.from(byActivityMap.values()),
  };
}

function buildPeople(caseItem: MockCustomerRequestCase) {
  const rows = [
    {
      id: `${caseItem.id}-creator`,
      yeu_cau_id: caseItem.id,
      user_id: caseItem.created_by,
      user_name: caseItem.created_by_name,
      vai_tro: 'nguoi_nhap',
      is_active: true,
    },
    {
      id: `${caseItem.id}-dispatcher`,
      yeu_cau_id: caseItem.id,
      user_id: caseItem.dispatcher_user_id,
      user_name: caseItem.dispatcher_name,
      vai_tro: 'nguoi_dieu_phoi',
      is_active: true,
    },
    {
      id: `${caseItem.id}-performer`,
      yeu_cau_id: caseItem.id,
      user_id: caseItem.performer_user_id,
      user_name: caseItem.performer_name,
      vai_tro: 'nguoi_thuc_hien',
      is_active: true,
    },
  ];

  return rows.filter((row) => row.user_id != null);
}

function filterByRole(cases: MockCustomerRequestCase[], role: string | null | undefined, actorUserId: number) {
  if (!role) {
    return cases;
  }

  if (role === 'creator') {
    return cases.filter((item) => item.created_by === actorUserId);
  }
  if (role === 'dispatcher') {
    return cases.filter((item) => item.dispatcher_user_id === actorUserId || item.received_by_user_id === actorUserId);
  }
  if (role === 'performer') {
    return cases.filter((item) => item.performer_user_id === actorUserId);
  }

  return cases;
}

function collectTop<T extends { name: string; count: number }>(items: T[]) {
  return items.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'));
}

function buildDashboard(state: MockCustomerRequestScenarioState, role: string) {
  const actorUserId = Number(state.authUser.id);
  const scoped = filterByRole(state.cases, role === 'overview' ? '' : role, actorUserId);
  const rows = scoped.map((item) => toYeuCau(item));
  const attentionCases = rows
    .filter((item) => Boolean(item.missing_estimate) || Boolean(item.over_estimate) || ['at_risk', 'overdue'].includes(String(item.sla_status ?? '')))
    .slice()
    .sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')))
    .slice(0, 10)
    .map((request_case) => ({
      request_case,
      reasons: [
        ...(request_case.missing_estimate ? ['missing_estimate'] : []),
        ...(request_case.over_estimate ? ['over_estimate'] : []),
        ...(['at_risk', 'overdue'].includes(String(request_case.sla_status ?? '')) ? ['sla_risk'] : []),
      ],
    }));

  const topCustomerMap = new Map<string, { customer_id: number; customer_name: string; count: number }>();
  const topProjectMap = new Map<string, { project_id: number; project_name: string; count: number }>();
  const topPerformerMap = new Map<string, { performer_user_id: number; performer_name: string; count: number }>();
  const statusCountMap = new Map<string, number>();

  rows.forEach((row) => {
    statusCountMap.set(String(row.current_status_code), (statusCountMap.get(String(row.current_status_code)) ?? 0) + 1);
    if (row.customer_id != null) {
      const key = String(row.customer_id);
      topCustomerMap.set(key, {
        customer_id: Number(row.customer_id),
        customer_name: String(row.customer_name ?? row.khach_hang_name ?? '--'),
        count: (topCustomerMap.get(key)?.count ?? 0) + 1,
      });
    }
    if (row.project_id != null) {
      const key = String(row.project_id);
      topProjectMap.set(key, {
        project_id: Number(row.project_id),
        project_name: String(row.project_name ?? '--'),
        count: (topProjectMap.get(key)?.count ?? 0) + 1,
      });
    }
    if (row.performer_user_id != null) {
      const key = String(row.performer_user_id);
      topPerformerMap.set(key, {
        performer_user_id: Number(row.performer_user_id),
        performer_name: String(row.performer_name ?? '--'),
        count: (topPerformerMap.get(key)?.count ?? 0) + 1,
      });
    }
  });

  return {
    role,
    summary: {
      total_cases: rows.length,
      status_counts: Array.from(statusCountMap.entries()).map(([status_code, count]) => ({ status_code, count })),
      alert_counts: {
        over_estimate: rows.filter((row) => row.over_estimate).length,
        missing_estimate: rows.filter((row) => row.missing_estimate).length,
        sla_risk: rows.filter((row) => ['at_risk', 'overdue'].includes(String(row.sla_status ?? ''))).length,
      },
    },
    top_customers: collectTop(Array.from(topCustomerMap.values()).map((item) => ({ name: item.customer_name, ...item }))).map(({ name: _name, ...item }) => item),
    top_projects: collectTop(Array.from(topProjectMap.values()).map((item) => ({ name: item.project_name, ...item }))).map(({ name: _name, ...item }) => item),
    top_performers: collectTop(Array.from(topPerformerMap.values()).map((item) => ({ name: item.performer_name, ...item }))).map(({ name: _name, ...item }) => item),
    attention_cases: attentionCases,
  };
}

function buildSearchItems(cases: MockCustomerRequestCase[]) {
  return cases.map((item) => {
    const row = toYeuCau(item);
    return {
      id: item.id,
      request_case_id: item.id,
      request_code: item.request_code,
      label: `${item.request_code} - ${item.summary}`,
      summary: item.summary,
      customer_name: item.customer_name,
      project_name: item.project_name,
      dispatcher_name: item.dispatcher_name,
      performer_name: item.performer_name,
      current_status_code: row.current_status_code,
      current_status_name_vi: row.current_status_name_vi,
      updated_at: item.updated_at,
    };
  });
}

function buildCatalog(state: MockCustomerRequestScenarioState) {
  const statuses = allStatuses().map((status) => ({
    ...status,
    active_count: state.cases.filter((item) => item.current_status_code === status.process_code).length,
  }));

  return {
    master_fields: [
      { name: 'customer_id', label: 'Khách hàng', type: 'customer_select', required: true },
      { name: 'customer_personnel_id', label: 'Người liên hệ KH', type: 'customer_personnel_select', required: true },
      { name: 'project_item_id', label: 'Hạng mục dự án', type: 'project_item_select', required: true },
      { name: 'support_service_group_id', label: 'Nhóm hỗ trợ', type: 'support_group_select', required: true },
      { name: 'summary', label: 'Tóm tắt yêu cầu', type: 'text', required: true },
      { name: 'description', label: 'Mô tả chi tiết', type: 'textarea', required: false },
      { name: 'priority', label: 'Độ ưu tiên', type: 'priority', required: true },
      { name: 'source_channel', label: 'Kênh tiếp nhận', type: 'enum', options: ['Phone', 'Email', 'Zalo', 'Teams'], required: true },
    ],
    groups: [
      { group_code: 'intake', group_label: 'Tiếp nhận', processes: statuses.filter((item) => item.group_code === 'intake') },
      { group_code: 'feedback', group_label: 'Phản hồi KH', processes: statuses.filter((item) => item.group_code === 'feedback') },
      { group_code: 'execution', group_label: 'Xử lý', processes: statuses.filter((item) => item.group_code === 'execution') },
      { group_code: 'closure', group_label: 'Hoàn tất', processes: statuses.filter((item) => item.group_code === 'closure') },
    ],
  };
}

function buildProcessDetail(caseItem: MockCustomerRequestCase, processCode: string) {
  const process = statusMeta(processCode);
  const currentProcess = statusMeta(caseItem.current_status_code);
  return {
    yeu_cau: toYeuCau(caseItem),
    current_process: currentProcess,
    process,
    process_row: {
      process_code: processCode,
      process_label: process.process_label,
      table_name: process.table_name,
      data: clone(caseItem.status_rows[processCode] ?? {}),
    },
    allowed_next_processes: (STATUS_TRANSITIONS[caseItem.current_status_code] ?? []).map((code) => statusMeta(code)),
    allowed_previous_processes: [],
    transition_allowed: true,
    can_write: true,
    available_actions: {
      can_write: true,
      can_transition: (STATUS_TRANSITIONS[caseItem.current_status_code] ?? []).length > 0,
      can_transition_backward: false,
      can_transition_forward: (STATUS_TRANSITIONS[caseItem.current_status_code] ?? []).length > 0,
      can_add_worklog: true,
      can_add_estimate: true,
      can_delete: true,
    },
    people: buildPeople(caseItem),
    estimates: clone(caseItem.estimates),
    hours_report: buildHoursReport(caseItem),
    attachments: clone(caseItem.attachments),
    ref_tasks: clone(caseItem.ref_tasks),
    worklogs: clone(caseItem.worklogs),
  };
}

function upsertStatusPayload(caseItem: MockCustomerRequestCase, statusCode: string, payload: Record<string, unknown>) {
  caseItem.status_rows[statusCode] = {
    ...(caseItem.status_rows[statusCode] ?? {}),
    ...payload,
  };
}

function applyMasterPayload(state: MockCustomerRequestScenarioState, caseItem: MockCustomerRequestCase, payload: Record<string, unknown>) {
  if (payload.customer_id != null) {
    const customerId = Number(payload.customer_id);
    const customer = state.customers.find((item) => Number(item.id) === customerId);
    caseItem.customer_id = customerId;
    caseItem.customer_name = String(customer?.customer_name ?? caseItem.customer_name);
  }
  if (payload.customer_personnel_id != null) {
    const personnelId = Number(payload.customer_personnel_id);
    const person = state.customerPersonnel.find((item) => Number(item.id) === personnelId);
    caseItem.customer_personnel_id = personnelId;
    caseItem.customer_personnel_name = String(person?.fullName ?? person?.full_name ?? caseItem.customer_personnel_name);
  }
  if (payload.support_service_group_id != null) {
    const groupId = Number(payload.support_service_group_id);
    const group = state.supportServiceGroups.find((item) => Number(item.id) === groupId);
    caseItem.support_service_group_id = groupId;
    caseItem.support_service_group_name = String(group?.group_name ?? caseItem.support_service_group_name);
  }
  if (payload.project_item_id != null) {
    const projectItemId = Number(payload.project_item_id);
    const projectItem = state.projectItems.find((item) => Number(item.id) === projectItemId);
    if (projectItem) {
      caseItem.project_item_id = projectItemId;
      caseItem.project_id = Number(projectItem.project_id);
      caseItem.project_name = String(projectItem.project_name);
      caseItem.product_id = Number(projectItem.product_id);
      caseItem.product_name = String(projectItem.product_name);
      caseItem.customer_id = Number(projectItem.customer_id);
      caseItem.customer_name = String(projectItem.customer_name);
    }
  }
  if (payload.summary != null) {
    caseItem.summary = normalize(payload.summary);
  }
  if (payload.description != null) {
    caseItem.description = normalize(payload.description);
  }
  if (payload.priority != null) {
    caseItem.priority = Number(payload.priority);
  }
  if (payload.source_channel != null) {
    caseItem.source_channel = normalize(payload.source_channel);
  }
  if (payload.dispatcher_user_id !== undefined) {
    const dispatcherId = payload.dispatcher_user_id == null || normalize(payload.dispatcher_user_id) === '' ? null : Number(payload.dispatcher_user_id);
    caseItem.dispatcher_user_id = dispatcherId;
    caseItem.dispatcher_name =
      dispatcherId == null
        ? null
        : String(state.employees.find((item) => Number(item.id) === dispatcherId)?.full_name ?? caseItem.dispatcher_name ?? '--');
  }
  if (payload.performer_user_id !== undefined) {
    const performerId = payload.performer_user_id == null || normalize(payload.performer_user_id) === '' ? null : Number(payload.performer_user_id);
    caseItem.performer_user_id = performerId;
    caseItem.performer_name =
      performerId == null
        ? null
        : String(state.employees.find((item) => Number(item.id) === performerId)?.full_name ?? caseItem.performer_name ?? '--');
  }
}

function appendTimeline(state: MockCustomerRequestScenarioState, caseItem: MockCustomerRequestCase, statusCode: string, reason?: string) {
  caseItem.timeline.push({
    id: state.nextTimelineId++,
    yeu_cau_id: caseItem.id,
    tien_trinh: STATUS_LABELS[statusCode] ?? statusCode,
    status_code: statusCode,
    trang_thai_cu: caseItem.current_status_code,
    trang_thai_moi: statusCode,
    nguoi_thay_doi_id: 1,
    nguoi_thay_doi_name: String(state.authUser.full_name ?? 'Smoke Tester'),
    ly_do: reason ?? null,
    thay_doi_luc: nowSql(),
  });
}

function transitionCase(
  state: MockCustomerRequestScenarioState,
  caseItem: MockCustomerRequestCase,
  toStatusCode: string,
  payload: Record<string, unknown>,
) {
  upsertStatusPayload(caseItem, toStatusCode, payload);
  if (payload.performer_user_id !== undefined) {
    applyMasterPayload(state, caseItem, { performer_user_id: payload.performer_user_id });
  }
  if (payload.dispatcher_user_id !== undefined) {
    applyMasterPayload(state, caseItem, { dispatcher_user_id: payload.dispatcher_user_id });
  }
  if (toStatusCode === 'completed') {
    caseItem.completed_at = normalize(payload.completed_at) || nowSql();
  }
  if (toStatusCode === 'customer_notified' && Array.isArray(payload.attachments)) {
    const attachmentRows = payload.attachments
      .map((row) => {
        const attachmentId = Number((row as Record<string, unknown>).id ?? 0);
        return caseItem.attachments.find((item) => Number(item.id) === attachmentId);
      })
      .filter((row): row is Record<string, unknown> => Boolean(row));
    caseItem.attachments = attachmentRows.length > 0 ? attachmentRows : caseItem.attachments;
  }

  appendTimeline(state, caseItem, toStatusCode, normalize(payload.notes));
  caseItem.current_status_code = toStatusCode;
  caseItem.updated_at = nowSql();
  return toYeuCau(caseItem);
}

function saveCaseStatus(
  state: MockCustomerRequestScenarioState,
  caseItem: MockCustomerRequestCase,
  processCode: string,
  body: Record<string, unknown>,
) {
  applyMasterPayload(state, caseItem, body);
  const statusPayload = (body.status_payload as Record<string, unknown> | undefined) ?? {};
  upsertStatusPayload(caseItem, processCode, statusPayload);
  if (Array.isArray(body.attachments)) {
    caseItem.attachments = clone(body.attachments as Array<Record<string, unknown>>);
  }
  if (Array.isArray(body.ref_tasks)) {
    caseItem.ref_tasks = clone(body.ref_tasks as Array<Record<string, unknown>>);
  }
  caseItem.updated_at = nowSql();
  appendTimeline(state, caseItem, processCode, normalize(statusPayload.notes));
  return toYeuCau(caseItem);
}

function createCase(
  state: MockCustomerRequestScenarioState,
  body: Record<string, unknown>,
) {
  const nextId = state.nextCaseId++;
  const payload = {
    customer_id: body.customer_id,
    customer_personnel_id: body.customer_personnel_id,
    support_service_group_id: body.support_service_group_id,
    project_item_id: body.project_item_id,
    summary: body.summary,
    description: body.description,
    priority: body.priority,
    source_channel: body.source_channel,
    dispatcher_user_id: body.dispatcher_user_id,
    performer_user_id: body.performer_user_id,
  };
  const created: MockCustomerRequestCase = {
    id: nextId,
    request_code: `CRC-202603-${String(nextId).padStart(4, '0')}`,
    summary: normalize(body.summary) || `Yêu cầu mới #${nextId}`,
    description: normalize(body.description),
    customer_id: 20,
    customer_name: 'VNPT Hà Nội',
    customer_personnel_id: 30,
    customer_personnel_name: 'Nguyễn Văn A',
    support_service_group_id: 40,
    support_service_group_name: 'Nhóm SOC 01',
    project_id: 501,
    project_name: 'SOC Dashboard',
    project_item_id: 101,
    product_id: 301,
    product_name: 'SOC Portal',
    priority: Number(body.priority ?? 2),
    source_channel: normalize(body.source_channel) || 'Phone',
    created_by: Number(body.created_by ?? 1),
    created_by_name: String(state.authUser.full_name ?? 'Smoke Tester'),
    received_by_user_id: 1,
    received_by_name: String(state.authUser.full_name ?? 'Smoke Tester'),
    dispatcher_user_id: null,
    dispatcher_name: null,
    performer_user_id: null,
    performer_name: null,
    current_status_code: 'new_intake',
    estimated_hours: null,
    total_hours_spent: 0,
    sla_due_at: null,
    completed_at: null,
    created_at: nowSql(),
    updated_at: nowSql(),
    status_rows: {
      new_intake: clone((body.status_payload as Record<string, unknown> | undefined) ?? {}),
    },
    attachments: clone((body.attachments as Array<Record<string, unknown>> | undefined) ?? []),
    ref_tasks: clone((body.ref_tasks as Array<Record<string, unknown>> | undefined) ?? []),
    estimates: [],
    worklogs: [],
    timeline: [],
  };
  applyMasterPayload(state, created, payload);
  appendTimeline(state, created, 'new_intake');
  state.cases.unshift(created);
  return {
    request_case: toYeuCau(created),
    yeu_cau: toYeuCau(created),
    status_instance: { id: nextId * 10, request_case_id: nextId, status_code: 'new_intake', is_current: true },
    current_status: statusMeta('new_intake'),
    status_row: {
      process_code: 'new_intake',
      process_label: STATUS_LABELS.new_intake,
      table_name: 'customer_request_cases',
      data: clone(created.status_rows.new_intake ?? {}),
    },
    attachments: clone(created.attachments),
    ref_tasks: clone(created.ref_tasks),
  };
}

function buildPerformerWeeklyTimesheet(state: MockCustomerRequestScenarioState) {
  const entries = state.cases
    .flatMap((item) => item.worklogs.map((row) => ({ row, item })))
    .filter(({ row }) => Number(row.performed_by_user_id ?? 0) === Number(state.authUser.id));

  return {
    start_date: '2026-03-16',
    end_date: '2026-03-22',
    performer_user_id: state.authUser.id,
    total_hours: Number(entries.reduce((sum, entry) => sum + Number(entry.row.hours_spent ?? 0), 0).toFixed(2)),
    billable_hours: Number(entries.reduce((sum, entry) => sum + (entry.row.is_billable ? Number(entry.row.hours_spent ?? 0) : 0), 0).toFixed(2)),
    non_billable_hours: Number(entries.reduce((sum, entry) => sum + (!entry.row.is_billable ? Number(entry.row.hours_spent ?? 0) : 0), 0).toFixed(2)),
    worklog_count: entries.length,
    days: ['2026-03-17', '2026-03-18', '2026-03-19', '2026-03-20', '2026-03-21']
      .map((date) => {
        const dayEntries = entries.filter((entry) => String(entry.row.work_date ?? '') === date);
        return {
          date,
          hours_spent: Number(dayEntries.reduce((sum, entry) => sum + Number(entry.row.hours_spent ?? 0), 0).toFixed(2)),
          billable_hours: Number(dayEntries.reduce((sum, entry) => sum + (entry.row.is_billable ? Number(entry.row.hours_spent ?? 0) : 0), 0).toFixed(2)),
          non_billable_hours: Number(dayEntries.reduce((sum, entry) => sum + (!entry.row.is_billable ? Number(entry.row.hours_spent ?? 0) : 0), 0).toFixed(2)),
          entry_count: dayEntries.length,
        };
      }),
    top_cases: entries
      .reduce<Array<{ request_case_id: number; request_code: string; summary: string; customer_name: string; project_name: string; status_code: string; status_name_vi: string; hours_spent: number; entry_count: number; last_worked_at: string }>>((acc, entry) => {
        const existing = acc.find((item) => item.request_case_id === entry.item.id);
        if (existing) {
          existing.hours_spent += Number(entry.row.hours_spent ?? 0);
          existing.entry_count += 1;
          existing.last_worked_at = String(entry.row.work_date ?? existing.last_worked_at);
          return acc;
        }
        acc.push({
          request_case_id: entry.item.id,
          request_code: entry.item.request_code,
          summary: entry.item.summary,
          customer_name: entry.item.customer_name,
          project_name: entry.item.project_name,
          status_code: entry.item.current_status_code,
          status_name_vi: STATUS_LABELS[entry.item.current_status_code] ?? entry.item.current_status_code,
          hours_spent: Number(entry.row.hours_spent ?? 0),
          entry_count: 1,
          last_worked_at: String(entry.row.work_date ?? ''),
        });
        return acc;
      }, [])
      .sort((a, b) => b.hours_spent - a.hours_spent),
    recent_entries: entries
      .map(({ row, item }) => ({
        ...clone(row),
        request_code: item.request_code,
        summary: item.summary,
        customer_name: item.customer_name,
        project_name: item.project_name,
        current_status_code: item.current_status_code,
        current_status_name_vi: STATUS_LABELS[item.current_status_code] ?? item.current_status_code,
        worked_on: row.work_date,
      }))
      .sort((a, b) => String(b.worked_on ?? '').localeCompare(String(a.worked_on ?? '')))
      .slice(0, 10),
  };
}

export async function registerCustomerRequestScenarioMock(
  page: Page,
  state: MockCustomerRequestScenarioState,
): Promise<void> {
  await page.route('**/api/v5/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method().toUpperCase();

    try {
      if (path === '/api/v5/bootstrap' && method === 'GET') {
        await fulfillJson(route, {
          data: {
            user: state.authUser,
            permissions: state.authUser.permissions ?? [],
            counters: {},
          },
        });
        return;
      }

    if (path === '/api/v5/auth/refresh') {
      await fulfillJson(route, { data: { ok: true } });
      return;
    }

    if (path === '/api/v5/auth/me' && method === 'GET') {
      await fulfillJson(route, { data: state.authUser });
      return;
    }

    if (path === '/api/v5/auth/tab/claim') {
      await fulfillJson(route, { data: { ok: true } });
      return;
    }

    if (path === '/api/v5/auth/login' && method === 'POST') {
      await fulfillJson(route, {
        data: {
          user: state.authUser,
          password_change_required: false,
        },
        password_change_required: false,
      });
      return;
    }

    if (path === '/api/v5/customers' && method === 'GET') {
      await fulfillJson(route, { data: state.customers, meta: { page: 1, per_page: 50, total: state.customers.length, total_pages: 1 } });
      return;
    }

    if (path === '/api/v5/customer-personnel' && method === 'GET') {
      await fulfillJson(route, { data: state.customerPersonnel, meta: { page: 1, per_page: 50, total: state.customerPersonnel.length, total_pages: 1 } });
      return;
    }

    if (path === '/api/v5/support-service-groups' && method === 'GET') {
      await fulfillJson(route, { data: state.supportServiceGroups, meta: { page: 1, per_page: 50, total: state.supportServiceGroups.length, total_pages: 1 } });
      return;
    }

    if (path === '/api/v5/internal-users' && method === 'GET') {
      await fulfillJson(route, { data: state.employees, meta: { page: 1, per_page: 50, total: state.employees.length, total_pages: 1 } });
      return;
    }

    if (path === '/api/v5/customer-requests/project-items' && method === 'GET') {
      await fulfillJson(route, { data: state.projectItems });
      return;
    }

    if (path === '/api/v5/projects/raci-assignments' && method === 'GET') {
      const projectIds = normalize(url.searchParams.get('project_ids'))
        .split(',')
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);
      const rows = projectIds.flatMap((projectId) => {
        const projectItem = state.projectItems.find((item) => Number(item.project_id) === projectId);
        if (!projectItem) {
          return [];
        }
        return [
          {
            id: `${projectId}-a`,
            project_id: projectId,
            project_name: projectItem.project_name,
            project_item_id: projectItem.id,
            assigned_user_id: 2,
            assigned_user_name: 'PM Lan',
            user_id: 2,
            user_name: 'PM Lan',
            role_code: 'A',
            role_name: 'Approver',
          },
          {
            id: `${projectId}-r`,
            project_id: projectId,
            project_name: projectItem.project_name,
            project_item_id: projectItem.id,
            assigned_user_id: 3,
            assigned_user_name: 'Dev Bình',
            user_id: 3,
            user_name: 'Dev Bình',
            role_code: 'R',
            role_name: 'Responsible',
          },
        ];
      });
      await fulfillJson(route, { data: rows });
      return;
    }

    if (path === '/api/v5/customer-requests/reference-search' && method === 'GET') {
      const keyword = normalizeSearch(url.searchParams.get('q'));
      const rows = state.cases
        .flatMap((item) => item.ref_tasks)
        .filter((row) => keyword === '' || normalizeSearch(row.task_code ?? '').includes(keyword));
      await fulfillJson(route, {
        data: rows.map((row, index) => ({
          id: Number(row.id ?? index + 1),
          request_case_id: 100 + index,
          task_code: row.task_code,
          task_link: row.task_link,
          task_source: row.task_source,
          task_status: row.task_status,
          task_note: row.task_note ?? null,
        })),
      });
      return;
    }

    if (path === '/api/v5/worklog-activity-types' && method === 'GET') {
      await fulfillJson(route, { data: state.worklogActivityTypes });
      return;
    }

    if (path === '/api/v5/documents/upload-attachment' && method === 'POST') {
      const attachment = {
        id: state.nextAttachmentId++,
        fileName: `uat-attachment-${state.nextAttachmentId}.txt`,
        file_name: `uat-attachment-${state.nextAttachmentId}.txt`,
        fileUrl: `https://example.test/uat-attachment-${state.nextAttachmentId}.txt`,
        file_url: `https://example.test/uat-attachment-${state.nextAttachmentId}.txt`,
        fileSize: 512,
        mimeType: 'text/plain',
        mime_type: 'text/plain',
        createdAt: nowSql(),
      };
      await fulfillJson(route, { data: attachment });
      return;
    }

    if (path === '/api/v5/customer-request-statuses' && method === 'GET') {
      await fulfillJson(route, { data: buildCatalog(state) });
      return;
    }

    if (path === '/api/v5/customer-request-cases/search' && method === 'GET') {
      const keyword = normalizeSearch(url.searchParams.get('q'));
      const limit = Number(url.searchParams.get('limit') ?? 10);
      const rows = buildSearchItems(state.cases)
        .filter((row) => {
          if (keyword === '') {
            return true;
          }
          return [
            row.request_code,
            row.summary,
            row.customer_name,
            row.project_name,
            row.dispatcher_name,
            row.performer_name,
          ].some((field) => normalizeSearch(field).includes(keyword));
        })
        .slice(0, limit);
      await fulfillJson(route, { data: rows });
      return;
    }

    if (path === '/api/v5/customer-request-cases/timesheet/performer-weekly' && method === 'GET') {
      await fulfillJson(route, { data: buildPerformerWeeklyTimesheet(state) });
      return;
    }

    const dashboardMatch = path.match(/^\/api\/v5\/customer-request-cases\/dashboard\/(creator|dispatcher|performer|overview)$/);
    if (dashboardMatch && method === 'GET') {
      await fulfillJson(route, { data: buildDashboard(state, dashboardMatch[1]) });
      return;
    }

    if (path === '/api/v5/customer-request-cases' && method === 'GET') {
      const processCode = normalize(url.searchParams.get('process_code'));
      const keyword = normalizeSearch(url.searchParams.get('q'));
      const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
      const perPage = Math.max(1, Number(url.searchParams.get('per_page') ?? 10));
      const myRole = normalize(url.searchParams.get('my_role'));
      const customerId = normalize(url.searchParams.get('customer_id'));
      const supportGroupId = normalize(url.searchParams.get('support_service_group_id'));
      const priority = normalize(url.searchParams.get('priority'));
      const rows = filterByRole(
        state.cases.filter((item) => {
          if (processCode && item.current_status_code !== processCode) {
            return false;
          }
          if (customerId && String(item.customer_id) !== customerId) {
            return false;
          }
          if (supportGroupId && String(item.support_service_group_id) !== supportGroupId) {
            return false;
          }
          if (priority && String(item.priority) !== priority) {
            return false;
          }
          if (keyword) {
            return [
              item.request_code,
              item.summary,
              item.customer_name,
              item.project_name,
              item.dispatcher_name,
              item.performer_name,
            ].some((field) => normalizeSearch(field).includes(keyword));
          }
          return true;
        }),
        myRole,
        Number(state.authUser.id),
      )
        .map((item) => toYeuCau(item))
        .sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')));

      const total = rows.length;
      const totalPages = Math.max(1, Math.ceil(total / perPage));
      const sliceStart = (page - 1) * perPage;
      await fulfillJson(route, {
        data: rows.slice(sliceStart, sliceStart + perPage),
        meta: {
          page,
          per_page: perPage,
          total,
          total_pages: totalPages,
        },
      });
      return;
    }

    if (path === '/api/v5/customer-request-cases' && method === 'POST') {
      await fulfillJson(route, { data: createCase(state, parseJsonBody(route)) }, 201);
      return;
    }

    const showMatch = path.match(/^\/api\/v5\/customer-request-cases\/(\d+)$/);
    if (showMatch && method === 'GET') {
      const caseItem = state.cases.find((item) => item.id === Number(showMatch[1]));
      await fulfillJson(route, { data: caseItem ? toYeuCau(caseItem) : null }, caseItem ? 200 : 404);
      return;
    }

    if (showMatch && method === 'DELETE') {
      const caseId = Number(showMatch[1]);
      state.cases = state.cases.filter((item) => item.id !== caseId);
      await fulfillJson(route, { data: { ok: true } });
      return;
    }

    const timelineMatch = path.match(/^\/api\/v5\/customer-request-cases\/(\d+)\/timeline$/);
    if (timelineMatch && method === 'GET') {
      const caseItem = state.cases.find((item) => item.id === Number(timelineMatch[1]));
      await fulfillJson(route, { data: clone(caseItem?.timeline ?? []) });
      return;
    }

    const peopleMatch = path.match(/^\/api\/v5\/customer-request-cases\/(\d+)\/people$/);
    if (peopleMatch && method === 'GET') {
      const caseItem = state.cases.find((item) => item.id === Number(peopleMatch[1]));
      await fulfillJson(route, { data: caseItem ? buildPeople(caseItem) : [] });
      return;
    }

    const worklogMatch = path.match(/^\/api\/v5\/customer-request-cases\/(\d+)\/worklogs$/);
    if (worklogMatch && method === 'GET') {
      const caseItem = state.cases.find((item) => item.id === Number(worklogMatch[1]));
      await fulfillJson(route, { data: clone(caseItem?.worklogs ?? []) });
      return;
    }

    if (worklogMatch && method === 'POST') {
      const caseItem = state.cases.find((item) => item.id === Number(worklogMatch[1]));
      if (!caseItem) {
        await fulfillJson(route, { message: 'Not found' }, 404);
        return;
      }
      const body = parseJsonBody(route);
      const employee = state.employees.find((item) => Number(item.id) === 1);
      const worklog = {
        id: state.nextWorklogId++,
        request_case_id: caseItem.id,
        status_instance_id: caseItem.id * 10,
        status_code: caseItem.current_status_code,
        performed_by_user_id: 1,
        performed_by_name: employee?.full_name ?? 'Smoke Tester',
        performed_by_code: employee?.user_code ?? 'ST001',
        work_content: normalize(body.work_content),
        work_date: normalize(body.work_date) || '2026-03-21',
        activity_type_code: normalize(body.activity_type_code) || 'support',
        is_billable: body.is_billable !== false,
        is_auto_transition: false,
        transition_id: null,
        work_started_at: `${normalize(body.work_date) || '2026-03-21'} 08:00:00`,
        work_ended_at: `${normalize(body.work_date) || '2026-03-21'} 09:00:00`,
        hours_spent: Number(body.hours_spent ?? 0) || 0,
        created_at: nowSql(),
        updated_at: nowSql(),
      };
      caseItem.worklogs.unshift(worklog);
      caseItem.updated_at = nowSql();
      await fulfillJson(route, { data: worklog, meta: { hours_report: buildHoursReport(caseItem) } }, 201);
      return;
    }

    const estimateMatch = path.match(/^\/api\/v5\/customer-request-cases\/(\d+)\/estimates$/);
    if (estimateMatch && method === 'GET') {
      const caseItem = state.cases.find((item) => item.id === Number(estimateMatch[1]));
      await fulfillJson(route, { data: clone(caseItem?.estimates ?? []) });
      return;
    }

    if (estimateMatch && method === 'POST') {
      const caseItem = state.cases.find((item) => item.id === Number(estimateMatch[1]));
      if (!caseItem) {
        await fulfillJson(route, { message: 'Not found' }, 404);
        return;
      }
      const body = parseJsonBody(route);
      const estimate = {
        id: state.nextEstimateId++,
        request_case_id: caseItem.id,
        status_instance_id: caseItem.id * 10,
        status_code: caseItem.current_status_code,
        estimated_hours: Number(body.estimated_hours ?? 0),
        estimate_type: normalize(body.estimate_type) || 'manual',
        estimate_scope: normalize(body.estimate_scope) || 'total',
        phase_label: normalize(body.phase_label) || null,
        note: normalize(body.note) || null,
        estimated_by_user_id: 1,
        estimated_by_name: String(state.authUser.full_name ?? 'Smoke Tester'),
        estimated_by_code: 'ST001',
        estimated_at: nowSql(),
      };
      caseItem.estimates.push(estimate);
      caseItem.estimated_hours = Number(body.estimated_hours ?? 0);
      caseItem.updated_at = nowSql();
      await fulfillJson(route, { data: { estimate, request_case: toYeuCau(caseItem) } }, 201);
      return;
    }

    const hoursMatch = path.match(/^\/api\/v5\/customer-request-cases\/(\d+)\/hours-report$/);
    if (hoursMatch && method === 'GET') {
      const caseItem = state.cases.find((item) => item.id === Number(hoursMatch[1]));
      await fulfillJson(route, { data: caseItem ? buildHoursReport(caseItem) : null });
      return;
    }

    const statusMatch = path.match(/^\/api\/v5\/customer-request-cases\/(\d+)\/statuses\/([^/]+)$/);
    if (statusMatch && method === 'GET') {
      const caseItem = state.cases.find((item) => item.id === Number(statusMatch[1]));
      const processCode = decodeURIComponent(statusMatch[2]);
      await fulfillJson(route, { data: caseItem ? buildProcessDetail(caseItem, processCode) : null }, caseItem ? 200 : 404);
      return;
    }

    if (statusMatch && method === 'POST') {
      const caseItem = state.cases.find((item) => item.id === Number(statusMatch[1]));
      const processCode = decodeURIComponent(statusMatch[2]);
      if (!caseItem) {
        await fulfillJson(route, { message: 'Not found' }, 404);
        return;
      }
      await fulfillJson(route, { data: { request_case: saveCaseStatus(state, caseItem, processCode, parseJsonBody(route)) } });
      return;
    }

    const transitionMatch = path.match(/^\/api\/v5\/customer-request-cases\/(\d+)\/transition$/);
    if (transitionMatch && method === 'POST') {
      const caseItem = state.cases.find((item) => item.id === Number(transitionMatch[1]));
      if (!caseItem) {
        await fulfillJson(route, { message: 'Not found' }, 404);
        return;
      }
      const body = parseJsonBody(route);
      const statusPayload = (body.status_payload as Record<string, unknown> | undefined) ?? {};
      const transitioned = transitionCase(state, caseItem, normalize(body.to_status_code), statusPayload);
      await fulfillJson(route, { data: { request_case: transitioned } });
      return;
    }

    if (path === '/api/v5/permissions' && method === 'GET') {
      await fulfillJson(route, { data: [] });
      return;
    }

    if (path === '/api/v5/roles' && method === 'GET') {
      await fulfillJson(route, { data: [] });
      return;
    }

      if (method === 'GET') {
        await fulfillJson(route, { data: [] });
        return;
      }

      await fulfillJson(route, { data: {} });
    } catch (error) {
      console.error('[customer-request-mock] handler failed', method, path, error);
      await fulfillJson(route, { message: error instanceof Error ? error.message : 'Mock handler failed' }, 500);
    }
  });
}
