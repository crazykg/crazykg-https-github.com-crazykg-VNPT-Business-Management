import { describe, expect, it } from 'vitest';
import type { CodingPhase, CRCStatusCode, DmsPhase, DispatchRoute } from '../types';
import {
  buildXmlAlignedTransitionOptionsForRequest,
  classifyCreatorWorkspaceStatus,
  classifyDispatcherWorkspaceRow,
  classifyPerformerWorkspaceStatus,
  filterTransitionOptionsForRequest,
  filterXmlVisibleProcesses,
  getPerformerWorkspaceStatusPriority,
  isDispatcherTeamLoadActiveStatus,
  isXmlVisibleProcessCode,
  normalizeStatusCodeForXmlUi,
  PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE,
  resolveRequestIntakeLane,
  resolveStatusMeta,
  resolveTransitionOptionsForRequest,
  STATUS_COLOR_MAP,
  SLA_STATUS_META,
  WARNING_LEVEL_META,
} from '../components/customer-request/presentation';

// ── P4a.3 — V4 Status + Types Tests ──────────────────────────────────────────

const ALL_V4_STATUS_CODES: CRCStatusCode[] = [
  'new_intake',
  'pending_dispatch',
  'dispatched',
  'assigned_to_receiver',
  'in_progress',
  'analysis',
  'analysis_completed',
  'analysis_suspended',
  'coding',
  'coding_in_progress',
  'coding_suspended',
  'dms_transfer',
  'dms_task_created',
  'dms_in_progress',
  'dms_suspended',
  'completed',
  'customer_notified',
  'not_executed',
  'waiting_customer_feedback',
  'returned_to_manager',
];

// ── STATUS_COLOR_MAP ──────────────────────────────────────────────────────────

describe('STATUS_COLOR_MAP', () => {
  it('contains all workflow status codes used by XML-aligned UI', () => {
    for (const code of ALL_V4_STATUS_CODES) {
      expect(STATUS_COLOR_MAP[code], `STATUS_COLOR_MAP missing: ${code}`).toBeDefined();
    }
  });

  it('each status has non-empty label and cls', () => {
    for (const code of ALL_V4_STATUS_CODES) {
      const entry = STATUS_COLOR_MAP[code];
      expect(entry.label, `label empty for ${code}`).toBeTruthy();
      expect(entry.cls, `cls empty for ${code}`).toBeTruthy();
    }
  });

  it('aliases runtime-only intake statuses back to the XML-visible label', () => {
    expect(STATUS_COLOR_MAP['pending_dispatch'].label).toBe('Tiếp nhận');
    expect(STATUS_COLOR_MAP['dispatched'].label).toBe('Tiếp nhận');
    expect(STATUS_COLOR_MAP['assigned_to_receiver'].label).toBe('Giao R thực hiện');
    expect(STATUS_COLOR_MAP['analysis_completed'].label).toBe('Chuyển BA Phân tích hoàn thành');
    expect(STATUS_COLOR_MAP['analysis_suspended'].label).toBe('Chuyển BA Phân tích tạm ngưng');
    expect(STATUS_COLOR_MAP['coding_in_progress'].label).toBe('Dev đang thực hiện');
    expect(STATUS_COLOR_MAP['coding_suspended'].label).toBe('Dev tạm ngưng');
    expect(STATUS_COLOR_MAP['dms_task_created'].label).toBe('Tạo task');
    expect(STATUS_COLOR_MAP['dms_in_progress'].label).toBe('DMS Đang thực hiện');
    expect(STATUS_COLOR_MAP['dms_suspended'].label).toBe('DMS tạm ngưng');
    expect(STATUS_COLOR_MAP['coding'].label).toBe('Lập trình');
    expect(STATUS_COLOR_MAP['dms_transfer'].label).toBe('Chuyển DMS');
  });

  it('keeps runtime-only intake aliases on the same colour as new_intake', () => {
    // pending_dispatch is now visible with its own styling
    expect(STATUS_COLOR_MAP['dispatched'].cls).toContain('sky');
    expect(STATUS_COLOR_MAP['coding'].cls).toContain('violet');
    expect(STATUS_COLOR_MAP['dms_transfer'].cls).toContain('lime');
  });
});

describe('XML-visible CRC UI filters', () => {
  it('marks runtime-only intake statuses as hidden in XML-aligned UI', () => {
    // pending_dispatch is now visible
    expect(isXmlVisibleProcessCode('pending_dispatch')).toBe(true);
    expect(isXmlVisibleProcessCode('dispatched')).toBe(false);
    expect(isXmlVisibleProcessCode('new_intake')).toBe(true);
    expect(isXmlVisibleProcessCode('coding')).toBe(true);
  });

  it('normalizes runtime-only intake statuses to new_intake for display', () => {
    // pending_dispatch is now visible with its own label
    expect(normalizeStatusCodeForXmlUi('pending_dispatch')).toBe('pending_dispatch');
    expect(normalizeStatusCodeForXmlUi('dispatched')).toBe('new_intake');
    expect(normalizeStatusCodeForXmlUi('waiting_customer_feedback')).toBe('waiting_customer_feedback');
  });

  it('filters runtime-only intake statuses out of process dropdowns', () => {
    const visible = filterXmlVisibleProcesses([
      { process_code: 'new_intake' },
      { process_code: 'pending_dispatch' },
      { process_code: 'dispatched' },
      { process_code: 'in_progress' },
    ]);

    expect(visible).toEqual([
      { process_code: 'new_intake' },
      { process_code: 'pending_dispatch' },
      { process_code: 'in_progress' },
    ]);
  });

  it('filters new_intake transition targets by the case lane', () => {
    const allTargets = [
      { process_code: 'not_executed' },
      { process_code: 'waiting_customer_feedback' },
      { process_code: 'assigned_to_receiver' },
      { process_code: 'analysis' },
      { process_code: 'returned_to_manager' },
    ];

    expect(
      filterTransitionOptionsForRequest(allTargets, {
        current_status_code: 'new_intake',
        dispatch_route: 'assign_pm',
      }).map((item) => item.process_code)
    ).toEqual(['assigned_to_receiver', 'returned_to_manager']);

    expect(
      filterTransitionOptionsForRequest(allTargets, {
        current_status_code: 'new_intake',
        dispatch_route: 'self_handle',
        performer_user_id: 3,
      }).map((item) => item.process_code)
    ).toEqual(['assigned_to_receiver', 'returned_to_manager']);
  });

  it('filters in_progress transition targets down to XML-valid outcomes', () => {
    const allTargets = [
      { process_code: 'completed' },
      { process_code: 'waiting_customer_feedback' },
      { process_code: 'analysis' },
      { process_code: 'returned_to_manager' },
      { process_code: 'not_executed' },
    ];

    expect(
      filterTransitionOptionsForRequest(allTargets, {
        current_status_code: 'in_progress',
        dispatch_route: 'self_handle',
        performer_user_id: 3,
      }).map((item) => item.process_code)
    ).toEqual(['completed', 'returned_to_manager']);
  });

  it('keeps only workflow-A dispatcher target for new_intake dispatcher lane', () => {
    const allTargets = [
      {
        process_code: 'assigned_to_receiver',
        process_label: 'Giao R thực hiện',
        group_code: 'processing',
        group_label: 'Xử lý',
        table_name: 'customer_request_assigned_to_receiver',
        default_status: 'assigned_to_receiver',
        read_roles: [],
        write_roles: [],
        allowed_next_processes: [],
        form_fields: [],
        list_columns: [],
      },
      {
        process_code: 'returned_to_manager',
        process_label: 'Giao PM/Trả YC cho PM',
        group_code: 'analysis',
        group_label: 'Phân tích',
        table_name: 'customer_request_returned_to_manager',
        default_status: 'returned_to_manager',
        read_roles: [],
        write_roles: [],
        allowed_next_processes: [],
        form_fields: [],
        list_columns: [],
      },
      {
        process_code: 'analysis',
        process_label: 'Phân tích',
        group_code: 'analysis',
        group_label: 'Phân tích',
        table_name: 'customer_request_analysis',
        default_status: 'analysis',
        read_roles: [],
        write_roles: [],
        allowed_next_processes: [],
        form_fields: [],
        list_columns: [],
      },
      {
        process_code: 'not_executed',
        process_label: 'Không tiếp nhận',
        group_code: 'closure',
        group_label: 'Kết quả',
        table_name: 'customer_request_not_executed',
        default_status: 'not_executed',
        read_roles: [],
        write_roles: [],
        allowed_next_processes: [],
        form_fields: [],
        list_columns: [],
      },
    ];

    expect(
      buildXmlAlignedTransitionOptionsForRequest(allTargets, {
        current_status_code: 'new_intake',
        dispatch_route: 'assign_pm',
      }).map((item) => item.process_code)
    ).toEqual(['assigned_to_receiver', 'returned_to_manager']);
  });

  it('reuses the same PM missing-customer-info decision step for returned_to_manager', () => {
    const allTargets = [
      {
        process_code: 'waiting_customer_feedback',
        process_label: 'Đợi phản hồi KH',
        group_code: 'feedback',
        group_label: 'Phản hồi',
        table_name: 'customer_request_waiting_customer_feedbacks',
        default_status: 'waiting_customer_feedback',
        read_roles: [],
        write_roles: [],
        allowed_next_processes: [],
        form_fields: [],
        list_columns: [],
      },
      {
        process_code: 'in_progress',
        process_label: 'R Đang thực hiện',
        group_code: 'processing',
        group_label: 'Xử lý',
        table_name: 'customer_request_in_progress',
        default_status: 'in_progress',
        read_roles: [],
        write_roles: [],
        allowed_next_processes: [],
        form_fields: [],
        list_columns: [],
      },
      {
        process_code: 'analysis',
        process_label: 'Phân tích',
        group_code: 'analysis',
        group_label: 'Phân tích',
        table_name: 'customer_request_analysis',
        default_status: 'analysis',
        read_roles: [],
        write_roles: [],
        allowed_next_processes: [],
        form_fields: [],
        list_columns: [],
      },
      {
        process_code: 'not_executed',
        process_label: 'Không tiếp nhận',
        group_code: 'closure',
        group_label: 'Kết quả',
        table_name: 'customer_request_not_executed',
        default_status: 'not_executed',
        read_roles: [],
        write_roles: [],
        allowed_next_processes: [],
        form_fields: [],
        list_columns: [],
      },
    ];

    expect(
      buildXmlAlignedTransitionOptionsForRequest(allTargets, {
        current_status_code: 'returned_to_manager',
      }).map((item) => item.process_code)
    ).toEqual([
      PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE,
      'in_progress',
      'analysis',
    ]);
  });
});

// ── CRCStatusCode type narrowing ──────────────────────────────────────────────

describe('CRCStatusCode type', () => {
  it('accepts all workflow status codes at compile time', () => {
    // These are compile-time checks — if they compile, they pass
    const codes: CRCStatusCode[] = [
      'new_intake',
      'pending_dispatch',
      'dispatched',
      'assigned_to_receiver',
      'in_progress',
      'analysis',
      'analysis_completed',
      'analysis_suspended',
      'coding',
      'coding_in_progress',
      'coding_suspended',
      'dms_transfer',
      'dms_task_created',
      'dms_in_progress',
      'dms_suspended',
      'completed',
      'customer_notified',
      'not_executed',
      'waiting_customer_feedback',
      'returned_to_manager',
    ];
    expect(codes).toHaveLength(20);
  });
});

// ── CodingPhase ────────────────────────────────────────────────────────────────

describe('CodingPhase type', () => {
  it('accepts all 5 valid coding phases', () => {
    const phases: CodingPhase[] = [
      'coding',
      'coding_done',
      'upcode_pending',
      'upcode_deployed',
      'suspended',
    ];
    expect(phases).toHaveLength(5);
  });

  it('coding phases form a logical progression', () => {
    const progressPhases: CodingPhase[] = [
      'coding',
      'coding_done',
      'upcode_pending',
      'upcode_deployed',
    ];
    // Each step index is in order
    progressPhases.forEach((phase, index) => {
      expect(progressPhases.indexOf(phase)).toBe(index);
    });
  });
});

// ── DmsPhase ──────────────────────────────────────────────────────────────────

describe('DmsPhase type', () => {
  it('accepts all 5 valid DMS phases', () => {
    const phases: DmsPhase[] = [
      'exchange',
      'task_created',
      'in_progress',
      'completed',
      'suspended',
    ];
    expect(phases).toHaveLength(5);
  });

  it('DMS phases form a logical progression', () => {
    const progressPhases: DmsPhase[] = ['exchange', 'task_created', 'in_progress', 'completed'];
    progressPhases.forEach((phase, index) => {
      expect(progressPhases.indexOf(phase)).toBe(index);
    });
  });
});

// ── DispatchRoute type ────────────────────────────────────────────────────────

describe('DispatchRoute type', () => {
  it('accepts all 3 valid dispatch routes', () => {
    const routes: DispatchRoute[] = ['self_handle', 'assign_pm', 'assign_direct'];
    expect(routes).toHaveLength(3);
  });

  it('dispatch routes have semantic meaning', () => {
    const routes: DispatchRoute[] = ['self_handle', 'assign_pm', 'assign_direct'];
    // Ensure they can be used in a type-guarded switch
    let count = 0;
    for (const route of routes) {
      switch (route) {
        case 'self_handle':
        case 'assign_pm':
        case 'assign_direct':
          count++;
          break;
      }
    }
    expect(count).toBe(3);
  });
});

// ── SLA_STATUS_META ──────────────────────────────────────────────────────────

describe('SLA_STATUS_META', () => {
  it('has entries for overdue, at_risk, on_track, closed', () => {
    const expected = ['overdue', 'at_risk', 'on_track', 'closed'];
    for (const key of expected) {
      expect(SLA_STATUS_META[key], `SLA_STATUS_META missing: ${key}`).toBeDefined();
    }
  });
});

// ── WARNING_LEVEL_META ────────────────────────────────────────────────────────

describe('WARNING_LEVEL_META', () => {
  it('has entries for hard, soft, missing, normal', () => {
    const expected = ['hard', 'soft', 'missing', 'normal'];
    for (const key of expected) {
      expect(WARNING_LEVEL_META[key], `WARNING_LEVEL_META missing: ${key}`).toBeDefined();
    }
  });
});

// ── CodingProgressBar step resolver (pure logic) ─────────────────────────────

const CODING_ORDER: CodingPhase[] = ['coding', 'coding_done', 'upcode_pending', 'upcode_deployed'];

function resolveStepState(
  stepPhase: CodingPhase,
  currentPhase: CodingPhase | string | null | undefined
): 'done' | 'active' | 'pending' {
  if (!currentPhase || currentPhase === 'suspended') return 'pending';
  const currentIndex = CODING_ORDER.indexOf(currentPhase as CodingPhase);
  const stepIndex = CODING_ORDER.indexOf(stepPhase);
  if (currentIndex < 0) return 'pending';
  if (stepIndex < currentIndex) return 'done';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

describe('CodingProgressBar step resolver', () => {
  it('marks all steps before current as done', () => {
    expect(resolveStepState('coding', 'coding_done')).toBe('done');
    expect(resolveStepState('coding', 'upcode_pending')).toBe('done');
    expect(resolveStepState('coding_done', 'upcode_deployed')).toBe('done');
  });

  it('marks current step as active', () => {
    expect(resolveStepState('coding', 'coding')).toBe('active');
    expect(resolveStepState('coding_done', 'coding_done')).toBe('active');
    expect(resolveStepState('upcode_deployed', 'upcode_deployed')).toBe('active');
  });

  it('marks all steps after current as pending', () => {
    expect(resolveStepState('upcode_pending', 'coding')).toBe('pending');
    expect(resolveStepState('upcode_deployed', 'coding_done')).toBe('pending');
  });

  it('marks all steps as pending when suspended', () => {
    for (const step of CODING_ORDER) {
      expect(resolveStepState(step, 'suspended')).toBe('pending');
    }
  });

  it('marks all steps as pending when phase is null', () => {
    for (const step of CODING_ORDER) {
      expect(resolveStepState(step, null)).toBe('pending');
    }
  });
});

// ── DmsProgressBar step resolver (pure logic) ────────────────────────────────

const DMS_ORDER: DmsPhase[] = ['exchange', 'task_created', 'in_progress', 'completed'];

function resolveDmsStepState(
  stepPhase: DmsPhase,
  currentPhase: DmsPhase | string | null | undefined
): 'done' | 'active' | 'pending' {
  if (!currentPhase || currentPhase === 'suspended') return 'pending';
  const currentIndex = DMS_ORDER.indexOf(currentPhase as DmsPhase);
  const stepIndex = DMS_ORDER.indexOf(stepPhase);
  if (currentIndex < 0) return 'pending';
  if (stepIndex < currentIndex) return 'done';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

describe('DmsProgressBar step resolver', () => {
  it('marks all steps before current as done', () => {
    expect(resolveDmsStepState('exchange', 'task_created')).toBe('done');
    expect(resolveDmsStepState('exchange', 'completed')).toBe('done');
    expect(resolveDmsStepState('in_progress', 'completed')).toBe('done');
  });

  it('marks current step as active', () => {
    expect(resolveDmsStepState('exchange', 'exchange')).toBe('active');
    expect(resolveDmsStepState('completed', 'completed')).toBe('active');
  });

  it('marks all steps after current as pending', () => {
    expect(resolveDmsStepState('in_progress', 'exchange')).toBe('pending');
    expect(resolveDmsStepState('completed', 'task_created')).toBe('pending');
  });

  it('marks all steps as pending when suspended', () => {
    for (const step of DMS_ORDER) {
      expect(resolveDmsStepState(step, 'suspended')).toBe('pending');
    }
  });
});

// ── dispatch_route field ──────────────────────────────────────────────────────

describe('dispatch_route field on YeuCau', () => {
  it('is recognized as an optional nullable string field', () => {
    // Type-level check — if this compiles, YeuCau.dispatch_route exists and is nullable
    const mockCase: { dispatch_route?: string | null } = {
      dispatch_route: 'assign_pm',
    };
    expect(mockCase.dispatch_route).toBe('assign_pm');

    const mockCase2: { dispatch_route?: string | null } = {
      dispatch_route: null,
    };
    expect(mockCase2.dispatch_route).toBeNull();
  });

  it('helps resolve the intake lane for XML-aligned new_intake cases', () => {
    expect(
      resolveRequestIntakeLane({
        current_status_code: 'new_intake',
        dispatch_route: 'assign_pm',
      })
    ).toBe('dispatcher');

    expect(
      resolveRequestIntakeLane({
        current_status_code: 'new_intake',
        performer_user_id: 3,
      })
    ).toBe('performer');
  });
});

describe('phase 2 transition option adapter', () => {
  it('falls back to XML-aligned transition options for dispatcher intake', () => {
    const allTargets = [
      { process_code: 'waiting_customer_feedback', process_label: 'Đợi phản hồi KH' },
      { process_code: 'in_progress', process_label: 'Đang xử lý' },
      { process_code: 'analysis', process_label: 'Phân tích' },
      { process_code: 'not_executed', process_label: 'Không thực hiện' },
    ] as Array<{ process_code: string; process_label: string }>;

    expect(
      resolveTransitionOptionsForRequest(allTargets as never, {
        current_status_code: 'new_intake',
        dispatch_route: 'assign_pm',
      }).map((item) => item.process_code)
    ).toEqual([
      PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE,
      'in_progress',
      'analysis',
    ]);
  });

  it('returns visible backend-provided options when no legacy rewrite applies', () => {
    const allTargets = [
      { process_code: 'analysis', process_label: 'Phân tích' },
      { process_code: 'coding', process_label: 'Lập trình' },
      { process_code: 'dispatched', process_label: 'Legacy hidden' },
    ] as Array<{ process_code: string; process_label: string }>;

    expect(
      resolveTransitionOptionsForRequest(allTargets as never, {
        current_status_code: 'analysis',
      }).map((item) => item.process_code)
    ).toEqual(['analysis', 'coding']);
  });
});

describe('phase 3 status metadata resolver', () => {
  it('uses fallback label for unknown status codes', () => {
    expect(resolveStatusMeta('future_status_code', 'Trạng thái động')).toEqual({
      label: 'Trạng thái động',
      cls: 'bg-slate-100 text-slate-500',
    });
  });

  it('normalizes legacy dispatched to the visible intake status', () => {
    expect(resolveStatusMeta('dispatched')).toEqual(STATUS_COLOR_MAP.new_intake);
  });
});

describe('phase 4 workspace classifiers', () => {
  it('classifies creator workspace buckets consistently', () => {
    expect(classifyCreatorWorkspaceStatus('waiting_customer_feedback')).toBe('review');
    expect(classifyCreatorWorkspaceStatus('completed')).toBe('notify');
    expect(classifyCreatorWorkspaceStatus('coding')).toBe('follow_up');
    expect(classifyCreatorWorkspaceStatus('customer_notified')).toBe('closed');
  });

  it('classifies performer workspace buckets and priority consistently', () => {
    expect(classifyPerformerWorkspaceStatus('analysis')).toBe('active');
    expect(classifyPerformerWorkspaceStatus('completed')).toBe('closed');
    expect(classifyPerformerWorkspaceStatus('new_intake')).toBe('pending');
    expect(getPerformerWorkspaceStatusPriority('returned_to_manager')).toBe(0);
    expect(getPerformerWorkspaceStatusPriority('analysis')).toBe(10);
    expect(getPerformerWorkspaceStatusPriority('completed')).toBe(30);
  });

  it('classifies dispatcher workspace buckets consistently', () => {
    expect(
      classifyDispatcherWorkspaceRow({
        current_status_code: 'new_intake',
        dispatch_route: 'assign_pm',
      })
    ).toBe('queue');

    expect(
      classifyDispatcherWorkspaceRow({
        current_status_code: 'new_intake',
        dispatch_route: 'self_handle',
        performer_user_id: 99,
      })
    ).toBe('active');

    expect(
      classifyDispatcherWorkspaceRow({
        current_status_code: 'returned_to_manager',
      })
    ).toBe('returned');

    expect(isDispatcherTeamLoadActiveStatus('dms_task_created')).toBe(true);
    expect(isDispatcherTeamLoadActiveStatus('customer_notified')).toBe(false);
  });
});

describe('phase 5 hardening smoke checks', () => {
  it('keeps PM missing-info synthetic option labeled via status metadata', () => {
    expect(resolveStatusMeta(PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE).label).toBe('Đợi phản hồi KH');
  });
});
