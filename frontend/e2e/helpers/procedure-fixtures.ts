export type ProcedureRaciRole = 'R' | 'A' | 'C' | 'I';

export type MockMember = {
  id: number;
  full_name: string;
  user_code: string;
  username: string;
};

export type MockProcedureRaciEntry = {
  id: number;
  procedure_id: number;
  user_id: number;
  raci_role: ProcedureRaciRole;
  note?: string | null;
};

export type MockStepRaciEntry = {
  id: number;
  step_id: number;
  user_id: number;
  raci_role: ProcedureRaciRole;
  created_at: string;
};

export type MockStep = {
  id: number;
  procedure_id: number;
  template_step_id: number | null;
  step_number: number;
  parent_step_id: number | null;
  phase: string;
  phase_label: string | null;
  step_name: string;
  step_detail: string | null;
  lead_unit: string | null;
  support_unit: string | null;
  expected_result: string | null;
  duration_days: number;
  progress_status: 'CHUA_THUC_HIEN' | 'DANG_THUC_HIEN' | 'HOAN_THANH';
  document_number: string | null;
  document_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  step_notes: string | null;
  sort_order: number;
  created_by: number | null;
  updated_by: number | null;
  worklogs_count?: number;
  blocking_worklogs_count?: number;
};

export type MockProcedureAttachment = {
  id: number;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string | null;
  driveFileId: string | null;
  storageDisk: string | null;
  storagePath: string | null;
  storageVisibility: string | null;
  createdAt: string;
  createdBy: number | null;
  createdByName: string | null;
};

export type MockProcedureWorklog = Record<string, unknown>;

export type MockProcedureScenarioState = {
  authUser: Record<string, unknown>;
  project: Record<string, unknown>;
  projectType: Record<string, unknown>;
  template: Record<string, unknown>;
  procedure: Record<string, unknown>;
  members: MockMember[];
  procedureRaci: MockProcedureRaciEntry[];
  steps: MockStep[];
  stepRaci: MockStepRaciEntry[];
  stepWorklogs: Record<string, MockProcedureWorklog[]>;
  procedureWorklogs: MockProcedureWorklog[];
  stepAttachments: Record<string, MockProcedureAttachment[]>;
  nextStepRaciId: number;
  nextWorklogId: number;
  nextIssueId: number;
};

export const PROCEDURE_TEST_PROJECT_ID = 101;
export const PROCEDURE_TEST_PROCEDURE_ID = 301;
export const PROCEDURE_TEST_PHASE_CODE = 'CHUAN_BI';
export const PROCEDURE_TEST_LOGIN = {
  username: 'tester',
  password: 'secret123',
};

const ISO_NOW = '2026-03-19T09:00:00.000Z';

export function buildProcedureScenarioState(): MockProcedureScenarioState {
  const members: MockMember[] = [
    { id: 201, full_name: 'Ha Quang Tuan', user_code: 'HQT', username: 'hqtuan' },
    { id: 202, full_name: 'Phan Vinh Rang', user_code: 'PVR', username: 'pvrang' },
    { id: 203, full_name: 'Nguyen Thanh Lam', user_code: 'NTL', username: 'ntlam' },
  ];

  return {
    authUser: {
      id: 1,
      user_code: 'ADMIN01',
      username: 'tester',
      full_name: 'Smoke Tester',
      department_id: 10,
      roles: [],
      permissions: ['projects.read', 'projects.write'],
      password_change_required: false,
    },
    project: {
      id: PROCEDURE_TEST_PROJECT_ID,
      project_code: 'DA016',
      project_name: 'Du an Dich vu giam sat SOC',
      customer_id: null,
      opportunity_id: null,
      start_date: '2026-03-01',
      expected_end_date: '2026-12-31',
      status: 'IN_PROGRESS',
      investment_mode: 'DAU_TU',
    },
    projectType: {
      id: 1,
      type_code: 'DAU_TU',
      type_name: 'Dau tu',
      is_active: true,
    },
    template: {
      id: 501,
      template_code: 'DAU_TU',
      template_name: 'Thu tuc dau tu',
      is_active: true,
    },
    procedure: {
      id: PROCEDURE_TEST_PROCEDURE_ID,
      project_id: PROCEDURE_TEST_PROJECT_ID,
      template_id: 501,
      procedure_name: 'Thu tuc DA016',
      overall_progress: 0,
    },
    members,
    procedureRaci: [
      { id: 9001, procedure_id: PROCEDURE_TEST_PROCEDURE_ID, user_id: 201, raci_role: 'A' },
      { id: 9002, procedure_id: PROCEDURE_TEST_PROCEDURE_ID, user_id: 202, raci_role: 'R' },
      { id: 9003, procedure_id: PROCEDURE_TEST_PROCEDURE_ID, user_id: 203, raci_role: 'C' },
    ],
    steps: [
      {
        id: 1001,
        procedure_id: PROCEDURE_TEST_PROCEDURE_ID,
        template_step_id: 7001,
        step_number: 1,
        parent_step_id: null,
        phase: PROCEDURE_TEST_PHASE_CODE,
        phase_label: 'Chuan bi',
        step_name: 'Bao cao de xuat chu truong dau tu',
        step_detail: null,
        lead_unit: 'Chu dau tu',
        support_unit: null,
        expected_result: 'To trinh va bao cao',
        duration_days: 5,
        progress_status: 'CHUA_THUC_HIEN',
        document_number: null,
        document_date: null,
        actual_start_date: '2026-03-10',
        actual_end_date: null,
        step_notes: null,
        sort_order: 1,
        created_by: null,
        updated_by: null,
        worklogs_count: 0,
        blocking_worklogs_count: 0,
      },
      {
        id: 1002,
        procedure_id: PROCEDURE_TEST_PROCEDURE_ID,
        template_step_id: 7002,
        step_number: 2,
        parent_step_id: null,
        phase: PROCEDURE_TEST_PHASE_CODE,
        phase_label: 'Chuan bi',
        step_name: 'Tham dinh ho so',
        step_detail: null,
        lead_unit: 'So KHDT',
        support_unit: null,
        expected_result: 'Bao cao tham dinh',
        duration_days: 3,
        progress_status: 'DANG_THUC_HIEN',
        document_number: null,
        document_date: null,
        actual_start_date: '2026-03-12',
        actual_end_date: null,
        step_notes: null,
        sort_order: 2,
        created_by: null,
        updated_by: null,
        worklogs_count: 0,
        blocking_worklogs_count: 0,
      },
      {
        id: 1003,
        procedure_id: PROCEDURE_TEST_PROCEDURE_ID,
        template_step_id: 7003,
        step_number: 3,
        parent_step_id: null,
        phase: PROCEDURE_TEST_PHASE_CODE,
        phase_label: 'Chuan bi',
        step_name: 'Trinh phe duyet',
        step_detail: null,
        lead_unit: 'UBND',
        support_unit: null,
        expected_result: 'Quyet dinh phe duyet',
        duration_days: 2,
        progress_status: 'CHUA_THUC_HIEN',
        document_number: null,
        document_date: null,
        actual_start_date: '2026-03-15',
        actual_end_date: null,
        step_notes: null,
        sort_order: 3,
        created_by: null,
        updated_by: null,
        worklogs_count: 0,
        blocking_worklogs_count: 0,
      },
    ],
    stepRaci: [
      { id: 9101, step_id: 1001, user_id: 201, raci_role: 'A', created_at: ISO_NOW },
      { id: 9102, step_id: 1001, user_id: 202, raci_role: 'R', created_at: ISO_NOW },
      { id: 9103, step_id: 1001, user_id: 203, raci_role: 'C', created_at: ISO_NOW },
      { id: 9104, step_id: 1002, user_id: 203, raci_role: 'I', created_at: ISO_NOW },
    ],
    stepWorklogs: {},
    procedureWorklogs: [],
    stepAttachments: {},
    nextStepRaciId: 9200,
    nextWorklogId: 9300,
    nextIssueId: 9400,
  };
}
