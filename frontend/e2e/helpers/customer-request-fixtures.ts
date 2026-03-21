type MockRole = 'creator' | 'dispatcher' | 'performer';

export type MockCustomerRequestCase = {
  id: number;
  request_code: string;
  summary: string;
  description: string;
  customer_id: number;
  customer_name: string;
  customer_personnel_id: number;
  customer_personnel_name: string;
  support_service_group_id: number;
  support_service_group_name: string;
  project_id: number;
  project_name: string;
  project_item_id: number;
  product_id: number;
  product_name: string;
  priority: number;
  source_channel: string;
  created_by: number;
  created_by_name: string;
  received_by_user_id: number;
  received_by_name: string;
  dispatcher_user_id: number | null;
  dispatcher_name: string | null;
  performer_user_id: number | null;
  performer_name: string | null;
  current_status_code: string;
  estimated_hours: number | null;
  total_hours_spent: number;
  sla_due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  status_rows: Record<string, Record<string, unknown>>;
  attachments: Array<Record<string, unknown>>;
  ref_tasks: Array<Record<string, unknown>>;
  estimates: Array<Record<string, unknown>>;
  worklogs: Array<Record<string, unknown>>;
  timeline: Array<Record<string, unknown>>;
};

export type MockCustomerRequestScenarioState = {
  authUser: Record<string, unknown>;
  customers: Array<Record<string, unknown>>;
  customerPersonnel: Array<Record<string, unknown>>;
  supportServiceGroups: Array<Record<string, unknown>>;
  employees: Array<Record<string, unknown>>;
  projectItems: Array<Record<string, unknown>>;
  worklogActivityTypes: Array<Record<string, unknown>>;
  cases: MockCustomerRequestCase[];
  nextCaseId: number;
  nextTimelineId: number;
  nextWorklogId: number;
  nextEstimateId: number;
  nextAttachmentId: number;
};

export const CUSTOMER_REQUEST_TEST_LOGIN = {
  username: 'smoke',
  password: 'secret123',
};

const NOW = '2026-03-21 09:30:00';

function buildTimelineEntry(
  id: number,
  requestId: number,
  statusCode: string,
  statusLabel: string,
  changedAt: string,
  actorName: string,
  reason?: string,
) {
  return {
    id,
    yeu_cau_id: requestId,
    tien_trinh: statusLabel,
    status_code: statusCode,
    trang_thai_cu: null,
    trang_thai_moi: statusCode,
    nguoi_thay_doi_id: 1,
    nguoi_thay_doi_name: actorName,
    ly_do: reason ?? null,
    thay_doi_luc: changedAt,
  };
}

function buildWorklogEntry(
  id: number,
  requestCaseId: number,
  content: string,
  hours: number,
  workDate: string,
  activity: string,
  performerName = 'Smoke Tester',
) {
  return {
    id,
    request_case_id: requestCaseId,
    status_instance_id: requestCaseId * 10,
    status_code: 'in_progress',
    performed_by_user_id: 1,
    performed_by_name: performerName,
    performed_by_code: 'ST001',
    work_content: content,
    work_date: workDate,
    activity_type_code: activity,
    is_billable: true,
    is_auto_transition: false,
    transition_id: null,
    work_started_at: `${workDate} 08:00:00`,
    work_ended_at: `${workDate} 09:00:00`,
    hours_spent: hours,
    created_at: `${workDate} 09:00:00`,
    updated_at: `${workDate} 09:00:00`,
  };
}

export function buildCustomerRequestScenarioState(): MockCustomerRequestScenarioState {
  const customers = [
    {
      id: 20,
      customer_code: 'C020',
      customer_name: 'VNPT Hà Nội',
      status: 'Active',
    },
    {
      id: 21,
      customer_code: 'C021',
      customer_name: 'Bệnh viện Số 2',
      status: 'Active',
    },
  ];

  const customerPersonnel = [
    {
      id: 30,
      customerId: 20,
      customer_id: 20,
      fullName: 'Nguyễn Văn A',
      full_name: 'Nguyễn Văn A',
      email: 'nva@example.com',
      phoneNumber: '0909000001',
      positionLabel: 'Đầu mối kỹ thuật',
    },
    {
      id: 31,
      customerId: 21,
      customer_id: 21,
      fullName: 'Trần Thị B',
      full_name: 'Trần Thị B',
      email: 'ttb@example.com',
      phoneNumber: '0909000002',
      positionLabel: 'PM khách hàng',
    },
  ];

  const supportServiceGroups = [
    {
      id: 40,
      group_code: 'SOC',
      group_name: 'Nhóm SOC 01',
      customer_id: 20,
      customer_name: 'VNPT Hà Nội',
    },
    {
      id: 41,
      group_code: 'NOC',
      group_name: 'Nhóm NOC 02',
      customer_id: 21,
      customer_name: 'Bệnh viện Số 2',
    },
  ];

  const employees = [
    {
      id: 1,
      uuid: 'employee-1',
      username: 'smoke',
      full_name: 'Smoke Tester',
      user_code: 'ST001',
      email: 'smoke@example.com',
      status: 'ACTIVE',
      department_id: 10,
      position_id: 1,
    },
    {
      id: 2,
      uuid: 'employee-2',
      username: 'pm.lan',
      full_name: 'PM Lan',
      user_code: 'PM002',
      email: 'pmlan@example.com',
      status: 'ACTIVE',
      department_id: 10,
      position_id: 2,
    },
    {
      id: 3,
      uuid: 'employee-3',
      username: 'dev.binh',
      full_name: 'Dev Bình',
      user_code: 'DEV003',
      email: 'devbinh@example.com',
      status: 'ACTIVE',
      department_id: 10,
      position_id: 3,
    },
  ];

  const projectItems = [
    {
      id: 101,
      project_id: 501,
      project_name: 'SOC Dashboard',
      project_code: 'DA501',
      customer_id: 20,
      customer_name: 'VNPT Hà Nội',
      customer_code: 'C020',
      product_id: 301,
      product_name: 'SOC Portal',
      product_code: 'PR301',
      display_name: 'Dashboard SOC | Portal',
    },
    {
      id: 102,
      project_id: 502,
      project_name: 'NOC Analytics',
      project_code: 'DA502',
      customer_id: 21,
      customer_name: 'Bệnh viện Số 2',
      customer_code: 'C021',
      product_id: 302,
      product_name: 'NOC Console',
      product_code: 'PR302',
      display_name: 'NOC Analytics | Console',
    },
  ];

  const cases: MockCustomerRequestCase[] = [
    {
      id: 101,
      request_code: 'CRC-202603-0101',
      summary: 'Khách hàng đã phản hồi, cần creator đánh giá',
      description: 'Khách hàng đã gửi đủ phản hồi cho ca SOC.',
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
      priority: 3,
      source_channel: 'Phone',
      created_by: 1,
      created_by_name: 'Smoke Tester',
      received_by_user_id: 1,
      received_by_name: 'Smoke Tester',
      dispatcher_user_id: 1,
      dispatcher_name: 'Smoke Tester',
      performer_user_id: 1,
      performer_name: 'Smoke Tester',
      current_status_code: 'waiting_customer_feedback',
      estimated_hours: 4,
      total_hours_spent: 1.5,
      sla_due_at: '2026-03-22 17:00:00',
      completed_at: null,
      created_at: '2026-03-19 09:00:00',
      updated_at: '2026-03-21 09:00:00',
      status_rows: {
        waiting_customer_feedback: {
          feedback_request_content: 'Vui lòng gửi lại file log mới nhất.',
          feedback_requested_at: '2026-03-20 16:00:00',
          customer_due_at: '2026-03-22 17:00:00',
          customer_feedback_at: '2026-03-21 08:30:00',
          customer_feedback_content: 'Khách hàng đã gửi log và ảnh màn hình.',
        },
      },
      attachments: [
        {
          id: 501,
          fileName: 'log-hien-trang.zip',
          file_name: 'log-hien-trang.zip',
          fileUrl: 'https://example.test/log-hien-trang.zip',
          file_url: 'https://example.test/log-hien-trang.zip',
          mimeType: 'application/zip',
          fileSize: 4096,
          createdAt: '2026-03-20 16:05:00',
        },
      ],
      ref_tasks: [
        {
          id: 701,
          task_code: 'IT360-0101',
          task_link: 'https://it360.example.test/101',
          task_source: 'IT360',
          task_status: 'IN_PROGRESS',
        },
      ],
      estimates: [
        {
          id: 801,
          request_case_id: 101,
          status_code: 'waiting_customer_feedback',
          estimated_hours: 4,
          estimate_scope: 'total',
          estimate_type: 'manual',
          note: 'Estimate ban đầu',
          estimated_by_user_id: 1,
          estimated_by_name: 'Smoke Tester',
          estimated_at: '2026-03-19 09:10:00',
        },
      ],
      worklogs: [
        buildWorklogEntry(901, 101, 'Đã rà soát phản hồi và chuẩn bị đánh giá.', 1.5, '2026-03-21', 'analysis'),
      ],
      timeline: [
        buildTimelineEntry(1001, 101, 'waiting_customer_feedback', 'Đợi phản hồi KH', '2026-03-20 16:00:00', 'Smoke Tester'),
      ],
    },
    {
      id: 102,
      request_code: 'CRC-202603-0102',
      summary: 'Case đã hoàn thành chờ báo khách hàng',
      description: 'Đã hoàn tất cấu hình và cần xác nhận đã báo cho khách hàng.',
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
      priority: 2,
      source_channel: 'Email',
      created_by: 1,
      created_by_name: 'Smoke Tester',
      received_by_user_id: 1,
      received_by_name: 'Smoke Tester',
      dispatcher_user_id: 1,
      dispatcher_name: 'Smoke Tester',
      performer_user_id: 1,
      performer_name: 'Smoke Tester',
      current_status_code: 'completed',
      estimated_hours: 4,
      total_hours_spent: 3.5,
      sla_due_at: null,
      completed_at: '2026-03-21 08:45:00',
      created_at: '2026-03-18 08:00:00',
      updated_at: '2026-03-21 08:45:00',
      status_rows: {
        completed: {
          completed_by_user_id: 1,
          completed_at: '2026-03-21 08:45:00',
          result_content: 'Đã cấu hình xong dashboard và xuất báo cáo mẫu.',
        },
      },
      attachments: [
        {
          id: 502,
          fileName: 'bao-cao-mau.pdf',
          file_name: 'bao-cao-mau.pdf',
          fileUrl: 'https://example.test/bao-cao-mau.pdf',
          file_url: 'https://example.test/bao-cao-mau.pdf',
          mimeType: 'application/pdf',
          fileSize: 2048,
          createdAt: '2026-03-21 08:40:00',
        },
      ],
      ref_tasks: [
        {
          id: 702,
          task_code: 'IT360-0102',
          task_link: 'https://it360.example.test/102',
          task_source: 'IT360',
          task_status: 'DONE',
        },
      ],
      estimates: [
        {
          id: 802,
          request_case_id: 102,
          status_code: 'completed',
          estimated_hours: 4,
          estimate_scope: 'total',
          estimate_type: 'manual',
          note: 'Estimate chốt',
          estimated_by_user_id: 1,
          estimated_by_name: 'Smoke Tester',
          estimated_at: '2026-03-18 08:10:00',
        },
      ],
      worklogs: [
        buildWorklogEntry(902, 102, 'Hoàn tất cấu hình và kiểm tra báo cáo.', 3.5, '2026-03-21', 'support'),
      ],
      timeline: [
        buildTimelineEntry(1002, 102, 'completed', 'Hoàn thành', '2026-03-21 08:45:00', 'Smoke Tester'),
      ],
    },
    {
      id: 103,
      request_code: 'CRC-202603-0103',
      summary: 'Ca mới chờ điều phối',
      description: 'Yêu cầu mới cần PM phân công người xử lý.',
      customer_id: 21,
      customer_name: 'Bệnh viện Số 2',
      customer_personnel_id: 31,
      customer_personnel_name: 'Trần Thị B',
      support_service_group_id: 41,
      support_service_group_name: 'Nhóm NOC 02',
      project_id: 502,
      project_name: 'NOC Analytics',
      project_item_id: 102,
      product_id: 302,
      product_name: 'NOC Console',
      priority: 4,
      source_channel: 'Zalo',
      created_by: 1,
      created_by_name: 'Smoke Tester',
      received_by_user_id: 1,
      received_by_name: 'Smoke Tester',
      dispatcher_user_id: 1,
      dispatcher_name: 'Smoke Tester',
      performer_user_id: null,
      performer_name: null,
      current_status_code: 'new_intake',
      estimated_hours: null,
      total_hours_spent: 0,
      sla_due_at: '2026-03-21 18:00:00',
      completed_at: null,
      created_at: '2026-03-21 08:00:00',
      updated_at: '2026-03-21 08:15:00',
      status_rows: {
        new_intake: {
          intake_notes: 'Cần PM xác nhận phạm vi xử lý.',
        },
      },
      attachments: [],
      ref_tasks: [],
      estimates: [],
      worklogs: [],
      timeline: [
        buildTimelineEntry(1003, 103, 'new_intake', 'Mới tiếp nhận', '2026-03-21 08:15:00', 'Smoke Tester'),
      ],
    },
    {
      id: 104,
      request_code: 'CRC-202603-0104',
      summary: 'Ca performer đang xử lý',
      description: 'Đang triển khai thay đổi dữ liệu đồng bộ.',
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
      priority: 3,
      source_channel: 'Email',
      created_by: 1,
      created_by_name: 'Smoke Tester',
      received_by_user_id: 1,
      received_by_name: 'Smoke Tester',
      dispatcher_user_id: 1,
      dispatcher_name: 'Smoke Tester',
      performer_user_id: 1,
      performer_name: 'Smoke Tester',
      current_status_code: 'in_progress',
      estimated_hours: 6,
      total_hours_spent: 2,
      sla_due_at: '2026-03-23 17:00:00',
      completed_at: null,
      created_at: '2026-03-20 10:00:00',
      updated_at: '2026-03-21 09:10:00',
      status_rows: {
        in_progress: {
          performer_user_id: 1,
          processing_content: 'Đang xử lý phần mapping dữ liệu.',
        },
      },
      attachments: [
        {
          id: 503,
          fileName: 'mapping.xlsx',
          file_name: 'mapping.xlsx',
          fileUrl: 'https://example.test/mapping.xlsx',
          file_url: 'https://example.test/mapping.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          fileSize: 1024,
          createdAt: '2026-03-21 09:00:00',
        },
      ],
      ref_tasks: [
        {
          id: 703,
          task_code: 'REF-104',
          task_link: 'https://ref.example.test/104',
          task_source: 'REFERENCE',
          task_status: 'OPEN',
        },
      ],
      estimates: [
        {
          id: 803,
          request_case_id: 104,
          status_code: 'in_progress',
          estimated_hours: 6,
          estimate_scope: 'total',
          estimate_type: 'manual',
          note: 'Estimate đang thực hiện',
          estimated_by_user_id: 1,
          estimated_by_name: 'Smoke Tester',
          estimated_at: '2026-03-20 10:15:00',
        },
      ],
      worklogs: [
        buildWorklogEntry(903, 104, 'Đã bắt đầu xử lý mapping dữ liệu.', 2, '2026-03-21', 'implementation'),
      ],
      timeline: [
        buildTimelineEntry(1004, 104, 'in_progress', 'Đang xử lý', '2026-03-21 09:10:00', 'Smoke Tester'),
      ],
    },
    {
      id: 105,
      request_code: 'CRC-202603-0105',
      summary: 'Ca performer chờ nhận việc',
      description: 'Performer cần xác nhận nhận việc.',
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
      priority: 2,
      source_channel: 'Teams',
      created_by: 1,
      created_by_name: 'Smoke Tester',
      received_by_user_id: 1,
      received_by_name: 'Smoke Tester',
      dispatcher_user_id: 1,
      dispatcher_name: 'Smoke Tester',
      performer_user_id: 1,
      performer_name: 'Smoke Tester',
      current_status_code: 'new_intake',
      estimated_hours: 2,
      total_hours_spent: 0,
      sla_due_at: null,
      completed_at: null,
      created_at: '2026-03-21 07:50:00',
      updated_at: '2026-03-21 07:50:00',
      status_rows: {
        new_intake: {
          intake_notes: 'Chờ performer nhận việc.',
        },
      },
      attachments: [],
      ref_tasks: [],
      estimates: [
        {
          id: 804,
          request_case_id: 105,
          status_code: 'new_intake',
          estimated_hours: 2,
          estimate_scope: 'total',
          estimate_type: 'manual',
          note: 'Estimate nhỏ',
          estimated_by_user_id: 1,
          estimated_by_name: 'Smoke Tester',
          estimated_at: '2026-03-21 07:55:00',
        },
      ],
      worklogs: [],
      timeline: [
        buildTimelineEntry(1005, 105, 'new_intake', 'Mới tiếp nhận', '2026-03-21 07:50:00', 'Smoke Tester'),
      ],
    },
    {
      id: 106,
      request_code: 'CRC-202603-0106',
      summary: 'Ca đã báo khách hàng',
      description: 'Case đã đóng sau khi báo khách hàng.',
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
      priority: 2,
      source_channel: 'Email',
      created_by: 1,
      created_by_name: 'Smoke Tester',
      received_by_user_id: 1,
      received_by_name: 'Smoke Tester',
      dispatcher_user_id: 1,
      dispatcher_name: 'Smoke Tester',
      performer_user_id: 1,
      performer_name: 'Smoke Tester',
      current_status_code: 'customer_notified',
      estimated_hours: 3,
      total_hours_spent: 2.5,
      sla_due_at: null,
      completed_at: '2026-03-20 17:00:00',
      created_at: '2026-03-19 07:00:00',
      updated_at: '2026-03-20 17:10:00',
      status_rows: {
        customer_notified: {
          notification_channel: 'Email',
          notification_content: 'Đã gửi email xác nhận kết quả.',
        },
      },
      attachments: [],
      ref_tasks: [],
      estimates: [],
      worklogs: [
        buildWorklogEntry(904, 106, 'Đã gửi email báo khách hàng.', 0.5, '2026-03-20', 'support'),
      ],
      timeline: [
        buildTimelineEntry(1006, 106, 'customer_notified', 'Báo khách hàng', '2026-03-20 17:10:00', 'Smoke Tester'),
      ],
    },
  ];

  return {
    authUser: {
      id: 1,
      user_code: 'ST001',
      username: CUSTOMER_REQUEST_TEST_LOGIN.username,
      full_name: 'Smoke Tester',
      email: 'smoke@example.com',
      status: 'ACTIVE',
      department_id: 10,
      roles: ['ADMIN'],
      permissions: ['*', 'support_requests.read', 'support_requests.write', 'support_requests.delete'],
      dept_scopes: [],
      password_change_required: false,
    },
    customers,
    customerPersonnel,
    supportServiceGroups,
    employees,
    projectItems,
    worklogActivityTypes: [
      { id: 1, code: 'support', name: 'Hỗ trợ' },
      { id: 2, code: 'analysis', name: 'Phân tích' },
      { id: 3, code: 'implementation', name: 'Thực hiện' },
    ],
    cases,
    nextCaseId: 500,
    nextTimelineId: 2000,
    nextWorklogId: 3000,
    nextEstimateId: 4000,
    nextAttachmentId: 5000,
  };
}
